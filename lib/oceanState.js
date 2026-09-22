// Tracks what every logged-in user is currently listening to, and groups
// them by track so the ocean page shows ONE bubble per song with a
// listener count, rather than duplicate bubbles for the same song.
//
// This is all in-memory and rebuilt from Spotify polls every few seconds -
// it is NOT persisted anywhere, by design (it's live, ephemeral state,
// not something that needs to survive a restart).

// sessionId -> {
//   trackId, trackUri, trackName, artist, albumArt,
//   isPlaying, progressMs, durationMs,
//   lastPolledAt,      // Date.now() at last successful poll
//   pausedSince,        // Date.now() when isPlaying first became false, or null
//   firstSeenAt,         // Date.now() when this session started listening to this trackId
// }
const sessions = new Map();

const PAUSE_SINK_MS = 10_000; // sink a listener's bubble after 10s paused

// Called once per session, per poll cycle, with the raw Spotify
// currently-playing response (or null if nothing/no device).
function updateSessionFromPoll(sessionId, spotifyData) {
  if (!spotifyData || !spotifyData.item) {
    // Nothing playing / no active device - this listener sinks immediately.
    sessions.delete(sessionId);
    return;
  }

  const trackId = spotifyData.item.id;
  const existing = sessions.get(sessionId);

  const isPlaying = !!spotifyData.is_playing;

  let pausedSince = null;
  if (!isPlaying) {
    // Keep the original pause start time if they were already paused on
    // this same track - otherwise this is a fresh pause, starting now.
    pausedSince =
      existing && existing.trackId === trackId && existing.pausedSince
        ? existing.pausedSince
        : Date.now();
  }

  sessions.set(sessionId, {
    trackId,
    trackUri: spotifyData.item.uri,
    trackName: spotifyData.item.name,
    artist: spotifyData.item.artists?.map((a) => a.name).join(', '),
    albumArt: spotifyData.item.album?.images?.[0]?.url,
    isPlaying,
    progressMs: spotifyData.progress_ms,
    durationMs: spotifyData.item.duration_ms,
    lastPolledAt: Date.now(),
    pausedSince,
    firstSeenAt: existing?.trackId === trackId ? existing.firstSeenAt : Date.now(),
  });
}

// Removes any session that's been paused for too long - this is what
// makes a lone paused listener's bubble sink after PAUSE_SINK_MS.
function pruneStalePausedSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.pausedSince && now - session.pausedSince > PAUSE_SINK_MS) {
      sessions.delete(sessionId);
    }
  }
}

// Groups all current sessions by trackId, so the ocean shows one bubble
// per song with a listener count, instead of one per person.
function computeGroups() {
  const groups = new Map(); // trackId -> group

  for (const [sessionId, session] of sessions.entries()) {
    let group = groups.get(session.trackId);
    if (!group) {
      group = {
        trackId: session.trackId,
        trackUri: session.trackUri,
        trackName: session.trackName,
        artist: session.artist,
        albumArt: session.albumArt,
        listenerCount: 0,
        listenerSessionIds: [],
        // The earliest listener of this track anchors the "official"
        // playback position everyone else sees/joins at.
        isPlaying: session.isPlaying,
        progressMs: session.progressMs,
        durationMs: session.durationMs,
        lastPolledAt: session.lastPolledAt,
        firstSeenAt: session.firstSeenAt,
      };
      groups.set(session.trackId, group);
    }

    group.listenerCount += 1;
    group.listenerSessionIds.push(sessionId);

    // Keep whichever session has been listening to this track the
    // longest as the position/playing-state anchor, for stability.
    if (session.firstSeenAt < group.firstSeenAt) {
      group.isPlaying = session.isPlaying;
      group.progressMs = session.progressMs;
      group.durationMs = session.durationMs;
      group.lastPolledAt = session.lastPolledAt;
      group.firstSeenAt = session.firstSeenAt;
    }
  }

  return Array.from(groups.values());
}

// Extrapolates a group's live position right now, accounting for the
// time elapsed since its anchor session was last polled. Used when
// someone clicks to join a track, so they start close to the real
// current position rather than wherever it was last poll cycle.
function getLiveProgressMs(group) {
  if (!group.isPlaying) return group.progressMs;
  const elapsed = Date.now() - group.lastPolledAt;
  return Math.min(group.progressMs + elapsed, group.durationMs || Infinity);
}

function isSessionInGroup(sessionId, trackId) {
  const session = sessions.get(sessionId);
  return session?.trackId === trackId;
}

module.exports = {
  updateSessionFromPoll,
  pruneStalePausedSessions,
  computeGroups,
  getLiveProgressMs,
  isSessionInGroup,
};
