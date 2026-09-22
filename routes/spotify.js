const express = require('express');
const router = express.Router();

const {
  getCurrentlyPlaying,
  resumePlayback,
  playTrackAt,
  pausePlayback,
  skipToNext,
  skipToPrevious,
} = require('../lib/spotifyClient');
const { getValidAccessToken } = require('../lib/authHelper');
const oceanState = require('../lib/oceanState');

// GET /spotify/currently-playing
// Used by the standalone test dashboard (routes/spotify.js is separate
// from the ocean page's group-based data, which comes over Socket.IO).
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
      trackId: data.item?.id,
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
      const spotifyMessage = err.response?.data?.error?.message;

      if (status === 401 && spotifyMessage === 'Permissions missing') {
        return res.status(401).json({
          error: 'Your login is missing the playback-control permission. Log out and log in again to grant it.',
        });
      }
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

// POST /spotify/join
// Called when someone clicks a bubble on the ocean page. Starts that
// track on THEIR Spotify at (roughly) the live position everyone else
// is at, and folds them into that song's listener group.
router.post('/join', async (req, res) => {
  const { trackUri, trackId } = req.body || {};
  if (!trackUri || !trackId) {
    return res.status(400).json({ error: 'trackUri and trackId are required' });
  }

  try {
    const userId = req.sessionID;

    // The actual bug fix: if this session is already anchoring/part of
    // this track's group (whether paused or playing), calling Spotify's
    // play endpoint again on ourselves interrupts our own playback
    // instead of "joining" anything - so just no-op instead.
    if (oceanState.isSessionInGroup(userId, trackId)) {
      return res.json({ success: true, alreadyListening: true });
    }

    const accessToken = await getValidAccessToken(userId);

    const groups = oceanState.computeGroups();
    const group = groups.find((g) => g.trackId === trackId);
    const positionMs = group ? oceanState.getLiveProgressMs(group) : 0;

    await playTrackAt(accessToken, trackUri, positionMs);
    res.json({ success: true, joinedAtMs: positionMs });
  } catch (err) {
    const status = err.response?.status;
    const spotifyMessage = err.response?.data?.error?.message;

    if (status === 401 && spotifyMessage === 'Permissions missing') {
      return res.status(401).json({
        error: 'Your login is missing the playback-control permission. Log out and log in again to grant it.',
      });
    }
    if (status === 403) {
      return res.status(403).json({ error: 'This action requires Spotify Premium.' });
    }
    if (status === 404) {
      return res.status(404).json({
        error: 'No active Spotify device found. Open Spotify on a device first.',
      });
    }

    console.error('join failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not join this song' });
  }
});

module.exports = router;
