const { getAllUserIds } = require('../db/tokenStore');
const { getValidAccessToken } = require('./authHelper');
const { getCurrentlyPlaying } = require('./spotifyClient');
const oceanState = require('./oceanState');

const POLL_INTERVAL_MS = 4000; // how often we check each user's playback

async function pollAllSessions() {
  const userIds = await getAllUserIds();

  // Poll everyone in parallel - fine for a class-project-sized user
  // count. If this ever needs to scale to many more users, this should
  // be batched/staggered to respect Spotify's rate limits.
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const accessToken = await getValidAccessToken(userId);
        const data = await getCurrentlyPlaying(accessToken);
        oceanState.updateSessionFromPoll(userId, data);
      } catch (err) {
        // A single user's poll failing (expired refresh token, revoked
        // access, etc.) shouldn't break the whole ocean update.
        console.error(`Poll failed for session ${userId}:`, err.response?.data || err.message);
      }
    })
  );

  oceanState.pruneStalePausedSessions();
}

// Starts the polling loop and wires it up to broadcast to every
// connected browser via Socket.IO whenever state changes.
function startOceanPoller(io) {
  setInterval(async () => {
    await pollAllSessions();
    const groups = oceanState.computeGroups();
    io.emit('oceanUpdate', groups);
  }, POLL_INTERVAL_MS);
}

module.exports = { startOceanPoller };
