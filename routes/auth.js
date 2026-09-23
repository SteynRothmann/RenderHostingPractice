const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { exchangeCodeForTokens, getMyProfile } = require('../lib/spotifyClient');
const { saveTokens } = require('../db/tokenStore');

const { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, FRONTEND_URL } = process.env;

const SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';

// GET /auth/login - frontend sends the user here to start the flow
router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('spotify_auth_state', state, { httpOnly: true, sameSite: 'lax' });

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SCOPES,
    state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// GET /auth/callback - Spotify redirects the browser back here
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const storedState = req.cookies?.spotify_auth_state;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/login-error?reason=${error}`);
  }
  if (!state || state !== storedState) {
    return res.redirect(`${FRONTEND_URL}/login-error?reason=state_mismatch`);
  }

  try {
    const { access_token, refresh_token, expires_in } = await exchangeCodeForTokens(code);

    // Each browser gets its own session (see server.js), so req.sessionID
    // uniquely identifies this person without needing real accounts yet.
    // Later, once you have a users table, you can swap this for the
    // logged-in user's actual database id.
    const userId = req.sessionID;

    // The real Spotify account id - used to tell "the same person in two
    // browser tabs" apart from "two different people" for listener
    // counts, and to show/link the host's name in the ocean panel.
    const profile = await getMyProfile(access_token);

    await saveTokens(userId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      spotifyUserId: profile.spotifyUserId,
      displayName: profile.displayName,
      profileUrl: profile.profileUrl,
    });

    res.clearCookie('spotify_auth_state');
    res.redirect(`${FRONTEND_URL}/ocean`);
  } catch (err) {
    console.error('Token exchange failed:', err.response?.data || err.message);
    res.redirect(`${FRONTEND_URL}/login-error?reason=token_exchange_failed`);
  }
});

module.exports = router;
