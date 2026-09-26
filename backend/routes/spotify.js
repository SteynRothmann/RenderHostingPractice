const express = require('express');
const router = express.Router();

const {
  getCurrentlyPlaying,
  resumePlayback,
  playTrackAt,
  pausePlayback,
  skipToNext,
  skipToPrevious,
  getRecentlyPlayed,
  getPublicPlaylists,
  getPublicProfile,
  getPublicPlaylistsForUser,
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

    // If they were following someone, a deliberate manual join means
    // they're choosing to do their own thing now - otherwise the
    // follow-sync loop would just snap them back to the host's track
    // on the very next poll cycle.
    oceanState.clearFollow(userId);

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

// POST /spotify/follow
// "Follow Along": keep following whoever is currently hosting this
// track, even as they change songs - handled by the background poller's
// syncFollowers(). If that host later disappears, host succession
// (also in the poller) promotes the next-earliest follower automatically.
router.post('/follow', async (req, res) => {
  const { trackId } = req.body || {};
  if (!trackId) {
    return res.status(400).json({ error: 'trackId is required' });
  }

  const userId = req.sessionID;
  const groups = oceanState.computeGroups();
  const group = groups.find((g) => g.trackId === trackId);
  if (!group) {
    return res.status(404).json({ error: 'That song is no longer playing' });
  }
  if (group.hostSessionId === userId) {
    return res.status(400).json({ error: "You can't follow yourself" });
  }

  oceanState.setFollow(userId, group.hostSessionId);
  res.json({ success: true });
});

// POST /spotify/unfollow
router.post('/unfollow', (req, res) => {
  oceanState.clearFollow(req.sessionID);
  res.json({ success: true });
});

// GET /spotify/follow-status - lets the frontend correctly restore the
// Follow Along toggle when a song panel is reopened (or the page is
// refreshed), instead of always assuming "not following".
router.get('/follow-status', (req, res) => {
  const follow = oceanState.getFollow(req.sessionID);
  res.json({ followingHostSessionId: follow?.hostSessionId ?? null });
});

// GET /spotify/user/:spotifyUserId - a host's read-only Wavelength
// profile page: their public Spotify identity + public playlists. There's
// no "recently played" here (see getPublicPlaylistsForUser) - that's only
// ever available for the currently authenticated user via Spotify's API,
// never for anyone else.
router.get('/user/:spotifyUserId', async (req, res) => {
  const { spotifyUserId } = req.params;
  let accessToken;
  try {
    accessToken = await getValidAccessToken(req.sessionID);
  } catch (err) {
    console.error('user profile fetch: no valid token for viewer:', err.message);
    return res.status(401).json({ error: 'You need to log in first' });
  }

  let profile;
  try {
    profile = await getPublicProfile(accessToken, spotifyUserId);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'That Spotify account could not be found' });
    }
    console.error('user profile fetch failed:', err.response?.data || err.message);
    return res.status(500).json({ error: "Could not load this person's profile" });
  }

  // The playlist fetch is treated as non-fatal on its own: a permissions
  // hiccup or transient error here shouldn't take down a profile that
  // otherwise loaded fine - it just shows with an empty playlist section.
  let playlists = [];
  try {
    playlists = await getPublicPlaylistsForUser(accessToken, spotifyUserId);
  } catch (err) {
    console.error('user playlists fetch failed:', err.response?.data || err.message);
  }

  res.json({ profile, playlists });
});

// GET /spotify/recently-played - for the profile page's listening history.
// Requires the user-read-recently-played scope - anyone who logged in
// before that scope was added needs to log out and back in once.
router.get('/recently-played', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.sessionID);
    const items = await getRecentlyPlayed(accessToken, 10);
    res.json({ items });
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      return res.status(403).json({
        error: 'Missing permission for listening history. Log out and log in again to grant it.',
      });
    }
    console.error('recently-played failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch recently played tracks' });
  }
});

// GET /spotify/playlists - the user's PUBLIC playlists only, for the
// profile page. Requires the playlist-read-private scope (yes, even
// though we then filter to public ones - Spotify needs it to return the
// full set of owned/followed playlists to filter from).
router.get('/playlists', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.sessionID);
    const items = await getPublicPlaylists(accessToken);
    res.json({ items });
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      return res.status(403).json({
        error: 'Missing permission for playlists. Log out and log in again to grant it.',
      });
    }
    console.error('playlists failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch playlists' });
  }
});

module.exports = router;
