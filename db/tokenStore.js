// Stores Spotify tokens per user.
//
// If DATABASE_URL is set, this uses your Postgres instance (see the
// CREATE TABLE statement in README.md - run it once before using this).
//
// If DATABASE_URL is NOT set, it falls back to an in-memory Map so you
// can build/test the OAuth flow locally before Postgres is wired up.
// The in-memory store resets every time the server restarts and only
// works for a single userId ('demo-user') - it's a placeholder, not
// something to ship.

const useMemoryStore = !process.env.DATABASE_URL;

let pool;
if (!useMemoryStore) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

const memoryStore = new Map();

async function saveTokens(userId, { accessToken, refreshToken, expiresAt }) {
  if (useMemoryStore) {
    memoryStore.set(userId, { accessToken, refreshToken, expiresAt });
    return;
  }

  await pool.query(
    `INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id)
     DO UPDATE SET access_token = $2, refresh_token = $3, expires_at = $4`,
    [userId, accessToken, refreshToken, expiresAt]
  );
}

async function getTokens(userId) {
  if (useMemoryStore) {
    return memoryStore.get(userId) || null;
  }

  const result = await pool.query(
    `SELECT access_token AS "accessToken",
            refresh_token AS "refreshToken",
            expires_at AS "expiresAt"
     FROM spotify_tokens
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

module.exports = { saveTokens, getTokens, useMemoryStore };
