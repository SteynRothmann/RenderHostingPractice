const express = require('express');
const router = express.Router();

const { refreshAccessToken, getCurrentlyPlaying, resumePlayback, pausePlayback, skipToNext, skipToPrevious } = require('../lib/spotifyClient');
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
      albumArt: data.item?.album?.images?.[0]?.url, // largest available image
      progressMs: data.progress_ms,
      durationMs: data.item?.duration_ms,
    });
  } catch (err) {
    console.error('currently-playing failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch currently-playing data' });
  }
});

// Shared handler for the four control endpoints below - they all follow
// the same pattern: get a valid token, call the Spotify action, and
// translate Spotify's specific error codes into clearer messages.
function makeControlRoute(action) {
  return async (req, res) => {
    try {
      const userId = req.sessionID;
      const accessToken = await getValidAccessToken(userId);
      await action(accessToken);
      res.json({ success: true });
    } catch (err) {
      const status = err.response?.status;

      if (status === 403) {
        return res
          .status(403)
          .json({ error: 'This action requires Spotify Premium.' });
      }
      if (status === 404) {
        return res.status(404).json({
          error: 'No active Spotify device found. Open Spotify on a device first.',
        });
      }

      console.error('playback control failed:', err.response?.data || err.message);
      res.status(500).json({ error: 'Could not complete playback action' });
    }
  };
}

router.put('/play', makeControlRoute(resumePlayback));
router.put('/pause', makeControlRoute(pausePlayback));
router.post('/next', makeControlRoute(skipToNext));
router.post('/previous', makeControlRoute(skipToPrevious));

module.exports = router;
