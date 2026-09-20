const express = require('express');
const router = express.Router();

const { refreshAccessToken, getCurrentlyPlaying } = require('../lib/spotifyClient');
const { saveTokens, getTokens } = require('../db/tokenStore');

// Ensures we hand back a valid, non-expired access token,
// refreshing it first if needed. This is the piece the Ocean
// team's polling job will end up calling indirectly via the
// route below.
async function getValidAccessToken(userId) {
  const stored = await getTokens(userId);
  if (!stored) {
    throw new Error('No Spotify tokens found for this user - they need to log in first.');
  }

  const isExpired = Date.now() > stored.expiresAt - 30_000; // 30s safety buffer
  if (!isExpired) {
    return stored.accessToken;
  }

  const refreshed = await refreshAccessToken(stored.refreshToken);
  const newTokens = {
    accessToken: refreshed.access_token,
    // Spotify doesn't always return a new refresh_token - keep the old one if so.
    refreshToken: refreshed.refresh_token || stored.refreshToken,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  };
  await saveTokens(userId, newTokens);

  return newTokens.accessToken;
}

// GET /spotify/currently-playing
// This is the endpoint the Ocean team's polling job hits.
router.get('/currently-playing', async (req, res) => {
  try {
    // Same session id used at login time - this identifies which
    // browser/person is asking, without needing real accounts yet.
    const userId = req.sessionID;

    const accessToken = await getValidAccessToken(userId);
    const data = await getCurrentlyPlaying(accessToken);

    if (!data) {
      return res.json({ playing: false });
    }

    res.json({
      playing: data.is_playing,
      track: data.item?.name,
      artist: data.item?.artists?.map((a) => a.name).join(', '),
      progressMs: data.progress_ms,
      durationMs: data.item?.duration_ms,
    });
  } catch (err) {
    console.error('currently-playing failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch currently-playing data' });
  }
});

module.exports = router;
