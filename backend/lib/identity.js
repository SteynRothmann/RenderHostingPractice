const crypto = require('crypto');

const COOKIE_NAME = 'wl_uid';
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 180; // 180 days

// Wavelength needs a stable way to recognize "this browser" across visits -
// this used to be req.sessionID (from express-session), but that turned out
// to be the root cause of a real bug: express-session's session records
// live in RAM (the default MemoryStore) with no persistence of their own.
// Every time the backend restarts - a Render redeploy, or the free tier
// spinning the service down after inactivity - every session record is
// wiped. A returning browser still presents its OLD 'connect.sid' cookie,
// but since that id no longer matches anything in the (now-empty) store,
// express-session silently swaps in a brand new session id for that
// request, with no error and no way for the browser to know.
//
// Since Spotify tokens were saved keyed by that session id, the result was:
// after any restart, /auth/me would report "logged out" for someone whose
// tokens were still sitting there safely in the token store (Postgres, or
// even just the still-running process's own memory) - because it was now
// being looked up under a new, never-used id. Meanwhile the background
// poller reads tokens directly by whatever ids exist in the store, so it
// kept polling and broadcasting their song just fine. That mismatch is
// exactly the "shows as logged out, but can still play songs" symptom.
//
// The fix: a dedicated identity cookie, completely independent of
// express-session, set once with a long lifetime and simply read back on
// every later request. As long as the browser still has this cookie, it
// keeps the same identity no matter how many times the backend restarts.
function ensureIdentity(req, res, next) {
  let id = req.cookies?.[COOKIE_NAME];
  if (!id) {
    id = crypto.randomBytes(20).toString('hex');
    res.cookie(COOKIE_NAME, id, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: req.app.get('needsCrossSiteCookies') ? 'none' : 'lax',
      secure: !!req.app.get('needsCrossSiteCookies'),
    });
  }
  req.userId = id;
  next();
}

module.exports = { ensureIdentity, COOKIE_NAME };
