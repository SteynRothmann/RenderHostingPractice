const { getAllUserIds, getTokens } = require('../db/tokenStore');
const { getValidAccessToken } = require('./authHelper');
const { getCurrentlyPlaying, playTrackAt } = require('./spotifyClient');
const oceanState = require('./oceanState');

const POLL_INTERVAL_MS = 2000; // how often we check each user's playback

async function pollAllSessions() {
  const userIds = await getAllUserIds();

  // Poll everyone in parallel - fine for a class-project-sized user
  // count. If this ever needs to scale to many more users, this should
  // be batched/staggered to respect Spotify's rate limits (this matters
  // more now that the interval is 1s instead of 4s).
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const stored = await getTokens(userId);
        const accessToken = await getValidAccessToken(userId);
        const data = await getCurrentlyPlaying(accessToken);
        oceanState.updateSessionFromPoll(userId, data, {
          spotifyUserId: stored?.spotifyUserId,
          displayName: stored?.displayName,
          profileUrl: stored?.profileUrl,
          profileImage: stored?.profileImage,
        });
      } catch (err) {
        // A single user's poll failing (expired refresh token, revoked
        // access, etc.) shouldn't break the whole ocean update.
        console.error(`Poll failed for session ${userId}:`, err.response?.data || err.message);
      }
    })
  );

  oceanState.pruneStalePausedSessions();
}

// "Follow Along": for every follower, if their followed host is now on a
// different track than they are, push the follower's own Spotify onto
// that track at the host's live position. Also handles host succession
// (promoting the next-earliest follower when a host disappears) via
// oceanState.reconcileFollowsAndGetSyncList().
async function syncFollowers() {
  const pairs = oceanState.reconcileFollowsAndGetSyncList();

  await Promise.all(
    pairs.map(async ({ followerSessionId, hostSessionId }) => {
      const hostSession = oceanState.getSession(hostSessionId);
      if (!hostSession || hostSession.sunk) return; // host not really active yet - try again next cycle

      const followerSession = oceanState.getSession(followerSessionId);
      const alreadyOnHostTrack = followerSession && followerSession.trackId === hostSession.trackId;
      if (alreadyOnHostTrack) {
        oceanState.clearFollowSyncError(followerSessionId);
        return;
      }

      // Not on the host's track yet - before blindly resyncing, tell apart
      // "the host just moved on and we haven't caught the follower up yet"
      // (should sync) from "the follower manually picked a different song
      // on their own Spotify" (should NOT be overwritten - turn Follow
      // Along off for them instead). Three cases:
      //   1. Freshly followed, never synced yet (lastSyncedTrackId === null)
      //      -> sync, regardless of whatever they happen to be on already.
      //   2. Nothing currently playing for them, or they're still sitting
      //      on exactly what we last synced them onto -> sync (catch up
      //      to the host's latest change).
      //   3. They're on some OTHER track that isn't what we last synced
      //      them to and isn't the host's current track -> they changed
      //      it themselves -> respect that and clear Follow Along instead
      //      of overwriting it again.
      const followEntry = oceanState.getFollow(followerSessionId);
      const neverSyncedYet = !followEntry || followEntry.lastSyncedTrackId === null;
      const nothingPlayingForFollower = !followerSession?.trackId;
      const stillOnLastSynced =
        !!followerSession && followEntry && followerSession.trackId === followEntry.lastSyncedTrackId;
      const okToSync = neverSyncedYet || nothingPlayingForFollower || stillOnLastSynced;

      if (!okToSync) {
        // Manual override detected - turn Follow Along off for them rather
        // than fighting their own choice every cycle.
        oceanState.clearFollow(followerSessionId);
        return;
      }

      try {
        const accessToken = await getValidAccessToken(followerSessionId);
        const positionMs = hostSession.isPlaying
          ? Math.min(
              hostSession.progressMs + (Date.now() - hostSession.lastPolledAt),
              hostSession.durationMs || Infinity
            )
          : hostSession.progressMs;
        await playTrackAt(accessToken, hostSession.trackUri, positionMs);
        oceanState.clearFollowSyncError(followerSessionId);
        oceanState.setLastSyncedTrackId(followerSessionId, hostSession.trackId);
      } catch (err) {
        // This used to only ever reach the server's own console - Follow
        // Along's toggle would show "on" in the UI forever with no way to
        // tell it was actually failing every single cycle. Now the reason
        // is recorded and surfaced through GET /spotify/follow-status (see
        // routes/spotify.js), same friendly-message treatment as the
        // manual Join button already gets for these exact Spotify error
        // codes - the common cases being no Premium (403) or no active
        // Spotify device anywhere (404) on the follower's account.
        const status = err.response?.status;
        const spotifyMessage = err.response?.data?.error?.message;
        let message = 'Could not sync with the host - try again shortly.';
        if (status === 401 && spotifyMessage === 'Permissions missing') {
          message = 'Your login is missing the playback-control permission. Log out and log in again to grant it.';
        } else if (status === 403) {
          message = 'Following along requires Spotify Premium.';
        } else if (status === 404) {
          message = 'No active Spotify device found - open Spotify on a device to follow along.';
        }
        oceanState.setFollowSyncError(followerSessionId, message);

        console.error(
          `Follow-sync failed for follower ${followerSessionId}:`,
          err.response?.data || err.message
        );
      }
    })
  );
}

// Starts the polling loop and wires it up to broadcast to every
// connected browser via Socket.IO whenever state changes.
function startOceanPoller(io) {
  setInterval(async () => {
    await pollAllSessions();
    await syncFollowers();
    const groups = oceanState.computeGroups();
    io.emit('oceanUpdate', groups);
  }, POLL_INTERVAL_MS);
}

module.exports = { startOceanPoller };
