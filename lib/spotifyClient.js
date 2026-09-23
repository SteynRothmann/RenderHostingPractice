const axios = require('axios');

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI } = process.env;

function basicAuthHeader() {
  return (
    'Basic ' +
    Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
  );
}

// Step 3 of the flow: swap the ?code=... from the callback for tokens.
async function exchangeCodeForTokens(code) {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(),
      },
    }
  );
  return res.data; // { access_token, refresh_token, expires_in, ... }
}

// Called when a stored access token is expired (or about to expire).
async function refreshAccessToken(refreshToken) {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(),
      },
    }
  );
  return res.data; // { access_token, expires_in, refresh_token? }
  // Note: Spotify doesn't always send back a new refresh_token - keep the
  // old one if it's missing from this response.
}

// The actual "what's playing" call the Ocean feature needs.
async function getCurrentlyPlaying(accessToken) {
  try {
    const res = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Spotify returns 204 No Content if nothing is playing, which axios
    // surfaces as res.data === '' - normalize that to null.
    return res.data || null;
  } catch (err) {
    if (err.response?.status === 204) return null;
    throw err;
  }
}

// Fetches the real Spotify account behind a token: its id (used to tell
// "two browser tabs, same account" apart from "two different people"),
// display name, and public profile link.
async function getMyProfile(accessToken) {
  const res = await axios.get('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return {
    spotifyUserId: res.data.id,
    displayName: res.data.display_name || res.data.id,
    profileUrl: res.data.external_urls?.spotify || null,
  };
}

// Playback controls below all require the user to have Spotify Premium
// and an active device (Spotify open somewhere). Spotify returns:
// - 204 No Content on success (nothing useful to return to the caller)
// - 403 Forbidden if the user isn't Premium
// - 404 Not Found if there's no active device to control

async function resumePlayback(accessToken) {
  await axios.put(
    'https://api.spotify.com/v1/me/player/play',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

// Starts a SPECIFIC track at a specific position - this is what "joining"
// a song already playing in the ocean uses, so the listener starts near
// the live position instead of from the beginning.
async function playTrackAt(accessToken, trackUri, positionMs) {
  await axios.put(
    'https://api.spotify.com/v1/me/player/play',
    { uris: [trackUri], position_ms: Math.max(0, Math.floor(positionMs || 0)) },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

async function pausePlayback(accessToken) {
  await axios.put(
    'https://api.spotify.com/v1/me/player/pause',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

async function skipToNext(accessToken) {
  await axios.post(
    'https://api.spotify.com/v1/me/player/next',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

async function skipToPrevious(accessToken) {
  await axios.post(
    'https://api.spotify.com/v1/me/player/previous',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

module.exports = {
  exchangeCodeForTokens,
  refreshAccessToken,
  getCurrentlyPlaying,
  getMyProfile,
  resumePlayback,
  playTrackAt,
  pausePlayback,
  skipToNext,
  skipToPrevious,
};
