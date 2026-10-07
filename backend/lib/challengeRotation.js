// Automatic weekly-challenge rotation.
//
// A challenge is "live" while its row has is_active = TRUE. When its
// `deadline` passes, rotateChallenges() ends it (is_active = FALSE) and
// starts the next one drawn from lib/challengePool.js, stamping it with a
// fresh start time (created_at) and deadline (start + CHALLENGE_DURATION),
// so the countdown the frontend shows begins when the challenge begins and
// ends when it ends.
//
// "Unjoining" everybody needs no deletes: a join is a challenge_submissions
// row for ONE challenge_id, and the frontend only ever asks about the
// currently-active challenge, so the instant a new challenge starts nobody
// has joined it. The old rows stay behind as history.
//
// Runs on a timer (startChallengeScheduler), at boot (so a server that
// slept through a deadline catches up immediately), and lazily from
// GET /challenges/active. All three funnel through the same transaction,
// which is safe to run concurrently: the UPDATE row-locks the expired row,
// and the partial unique index on is_active makes a duplicate insert fail
// (23505), which is treated as "someone else already rotated".
//
// Needs Postgres - without DATABASE_URL (pool is null) everything here is
// a quiet no-op, same as the rest of the challenges feature.

const pool = require('../db/pool');
const { CHALLENGE_POOL, REWARDS } = require('./challengePool');

// Length of one challenge. Default one week; set CHALLENGE_DURATION_HOURS
// (e.g. 1) to speed rotation up for testing.
function durationMs() {
  const hours = Number(process.env.CHALLENGE_DURATION_HOURS);
  return (Number.isFinite(hours) && hours > 0 ? hours : 24 * 7) * 60 * 60 * 1000;
}

const CHECK_INTERVAL_MS = 15 * 1000;

// Picks the next challenge at random from the pool, skipping whatever was
// used most recently so the same theme doesn't come around again straight
// away (the last up-to-8 themes are excluded; with a 15-entry pool that
// always leaves plenty of choice).
async function pickNextPoolEntry(client) {
  const recentCount = Math.min(CHALLENGE_POOL.length - 1, 8);
  const recent = await client.query(
    `SELECT theme FROM challenges ORDER BY created_at DESC, id DESC LIMIT $1`,
    [recentCount]
  );
  const recentThemes = new Set(recent.rows.map((row) => row.theme));
  const candidates = CHALLENGE_POOL.filter((entry) => !recentThemes.has(entry.theme));
  const choices = candidates.length > 0 ? candidates : CHALLENGE_POOL;
  return choices[Math.floor(Math.random() * choices.length)];
}

// Ends the active challenge if it has expired (or unconditionally with
// force) and, if nothing is active afterwards, starts the next one.
// Returns { rotated, challenge?, endedChallengeIds, reason? }.
async function rotateChallenges({ io, force = false } = {}) {
  if (!pool) return { rotated: false, endedChallengeIds: [], reason: 'no-database' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ended = await client.query(
      `UPDATE challenges SET is_active = FALSE
       WHERE is_active = TRUE ${force ? '' : 'AND deadline <= now()'}
       RETURNING id`
    );
    const endedChallengeIds = ended.rows.map((row) => row.id);

    const stillActive = await client.query(`SELECT id FROM challenges WHERE is_active = TRUE LIMIT 1`);
    if (stillActive.rows.length > 0) {
      await client.query('COMMIT');
      return { rotated: false, endedChallengeIds, reason: 'still-active' };
    }

    const entry = await pickNextPoolEntry(client);

    // Make sure the border this challenge grants exists (user_cosmetics
    // references rewards, so granting a missing one would fail on join).
    for (const reward of REWARDS) {
      await client.query(
        `INSERT INTO rewards (reward_id, name, description, effect_type, css_class)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (reward_id) DO NOTHING`,
        [reward.reward_id, reward.name, reward.description, reward.effect_type, reward.css_class]
      );
    }

    const startedAt = new Date();
    const deadline = new Date(startedAt.getTime() + durationMs());
    const inserted = await client.query(
      `INSERT INTO challenges (theme, description, reward_id, deadline, is_active, created_at)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       RETURNING id, theme, description, reward_id, deadline, created_at`,
      [entry.theme, entry.description, entry.rewardId, deadline.toISOString(), startedAt.toISOString()]
    );
    await client.query('COMMIT');

    const challenge = inserted.rows[0];
    console.log(
      `Challenge rotation: ended [${endedChallengeIds.join(', ') || 'none'}], started "${challenge.theme}" (id ${challenge.id}) until ${deadline.toISOString()}`
    );
    if (io) io.emit('challenge:rotated', { challengeId: challenge.id });
    return { rotated: true, challenge, endedChallengeIds };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      // Another run started the next challenge first - nothing to do.
      return { rotated: false, endedChallengeIds: [], reason: 'already-rotated' };
    }
    throw err;
  } finally {
    client.release();
  }
}

// Cheap "is there a live challenge?" check so GET /challenges/active can
// call this on every request without opening a transaction each time.
async function ensureActiveChallenge(io) {
  if (!pool) return;
  const live = await pool.query(
    `SELECT 1 FROM challenges WHERE is_active = TRUE AND deadline > now() LIMIT 1`
  );
  if (live.rows.length > 0) return;
  await rotateChallenges({ io });
}

// Keeps existing rows' descriptions in line with lib/challengePool.js (the
// source of truth for challenge text), so reworded descriptions reach
// challenges that are already in the table.
async function syncPoolDescriptions() {
  if (!pool) return;
  for (const entry of CHALLENGE_POOL) {
    await pool.query(
      `UPDATE challenges SET description = $2 WHERE theme = $1 AND description <> $2`,
      [entry.theme, entry.description]
    );
  }
}

function startChallengeScheduler(io) {
  if (!pool) {
    console.log('Challenge rotation disabled - DATABASE_URL not set.');
    return;
  }

  async function tick() {
    try {
      await rotateChallenges({ io });
    } catch (err) {
      console.error('Challenge rotation check failed:', err.message);
    }
  }

  syncPoolDescriptions().catch((err) => {
    console.error('Could not sync challenge descriptions:', err.message);
  });
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log(
    `Challenge rotation started - checking every ${CHECK_INTERVAL_MS / 1000}s, challenges last ${durationMs() / 3600000}h.`
  );
}

module.exports = { rotateChallenges, ensureActiveChallenge, syncPoolDescriptions, startChallengeScheduler };
