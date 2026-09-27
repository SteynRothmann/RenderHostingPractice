const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { exchangeCodeForTokens, getMyProfile } = require('../lib/spotifyClient');
const { saveTokens, getTokens } = require('../db/tokenStore');
const { COOKIE_NAME } = require('../lib/identity');

const { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, FRONTEND_URL } = process.env;

// Matches the check in server.js - the 'state' cookie below is only ever
// read back on a same-domain redirect from Spotify, but a real HTTPS
// deployment still needs Secure set (browsers are increasingly strict
// about this), while local http:// dev must NOT set it or the cookie
// won't be stored at all.
const NEEDS_SECURE_COOKIES = (FRONTEND_URL || '').startsWith('https://');

const SCOPES =
  'user-read-currently-playing user-read-playback-state user-modify-playback-state ' +
  'user-read-email user-read-recently-played playlist-read-private';

// GET /auth/login - frontend sends the user here to start the flow
router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('spotify_auth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: NEEDS_SECURE_COOKIES,
  });

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

  // The frontend's login screen lives at /login (not a separate
  // /login-error route) and reads ?error= to show a message - see
  // src/features/auth/LoginPage.tsx.
  if (error) {
    return res.redirect(`${FRONTEND_URL}/login?error=${error}`);
  }
  if (!state || state !== storedState) {
    return res.redirect(`${FRONTEND_URL}/login?error=state_mismatch`);
  }

  try {
    const { access_token, refresh_token, expires_in } = await exchangeCodeForTokens(code);

    // Each browser gets its own stable identity cookie (see
    // lib/identity.js), so req.userId uniquely identifies this person
    // without needing real accounts yet, and keeps working across backend
    // restarts. Later, once you have a users table, you can swap this for
    // the logged-in user's actual database id.
    const userId = req.userId;

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
      email: profile.email,
      profileImage: profile.profileImage,
    });

    res.clearCookie('spotify_auth_state');
    // The Ocean page is the frontend's root route ("/"), not "/ocean" -
    // see src/App.tsx.
    res.redirect(`${FRONTEND_URL}/`);
  } catch (err) {
    console.error('Token exchange failed:', err.response?.data || err.message);
    res.redirect(`${FRONTEND_URL}/login?error=token_exchange_failed`);
  }
});

// GET /auth/me - lets the frontend ask "is this browser logged in?" on
// load (and after the OAuth redirect lands back on the Ocean page), and
// get the real Spotify profile info to display, without exposing tokens.
router.get('/me', async (req, res) => {
  try {
    const stored = await getTokens(req.userId);
    if (!stored) {
      return res.json({ loggedIn: false, profile: null });
    }
    res.json({
      loggedIn: true,
      profile: {
        spotifyUserId: stored.spotifyUserId,
        displayName: stored.displayName,
        profileUrl: stored.profileUrl,
        email: stored.email ?? null,
        profileImage: stored.profileImage ?? null,
      },
    });
  } catch (err) {
    console.error('auth/me failed:', err.message);
    res.status(500).json({ loggedIn: false, profile: null });
  }
});

// GET /auth/logout - called by the frontend via fetch (not a page nav) so
// it can be triggered from the "Log out" button without leaving the app.
// Clears this browser's identity cookie so /auth/me reports logged-out
// afterwards (a fresh identity - and so a fresh login - is issued next
// time). This doesn't revoke the Spotify token itself - Spotify has no
// simple client revoke endpoint, so the old tokens are just left orphaned
// in the store and expire naturally.
router.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: NEEDS_SECURE_COOKIES ? 'none' : 'lax',
    secure: NEEDS_SECURE_COOKIES,
  });
  res.json({ success: true });
});

module.exports = router;
