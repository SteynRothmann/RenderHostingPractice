import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import NavPanel from '../../components/NavPanel';
import { useChat } from '../../data/ChatContext';
import { fetchHostProfile } from '../../lib/api';
import type { HostProfile } from '../../data/types';

interface Props {
  // The spotifyUserId whose profile should be shown, or null to keep the
  // overlay closed. Works for ANY group member, not just accepted 1:1
  // friends - see isFriend below for how the Unfriend button adapts.
  spotifyUserId: string | null;
  onClose: () => void;
  // Called right after a successful unfriend, so ChatPage can close/clear
  // the now-gone conversation the same way its existing "⋮" → Unfriend
  // flow already does (setActive(null), setShowThread(false)).
  onUnfriended: () => void;
}

// An inline Wavelength profile overlay for use from within the Chat page -
// reached by clicking a friend's name/avatar in a 1:1 header, or a
// sender's name/avatar on a group message (see Conversation.tsx's
// onPersonClick). Deliberately separate from the standalone
// /hosts/:spotifyUserId route (HostProfilePage) - the PM asked for this to
// stay "still in the chat page", not navigate away from it.
export default function ChatProfileOverlay({ spotifyUserId, onClose, onUnfriended }: Props) {
  const { friends, unfriend } = useChat();
  const [profile, setProfile] = useState<HostProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unfriending, setUnfriending] = useState(false);

  useEffect(() => {
    if (!spotifyUserId) return;
    setLoading(true);
    setError('');
    setProfile(null);
    fetchHostProfile(spotifyUserId)
      .then(({ profile }) => setProfile(profile))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this profile'))
      .finally(() => setLoading(false));
  }, [spotifyUserId]);

  // Only an accepted 1:1 chat friend can be unfriended - a group member
  // who isn't already a direct-chat friend has no chat request to revoke,
  // so revokeChatRequest()/unfriend() wouldn't make sense for them.
  const friend = spotifyUserId ? friends.find((f) => f.spotifyUserId === spotifyUserId) : undefined;

  async function handleUnfriend() {
    if (!spotifyUserId || !friend) return;
    if (
      !confirm(
        `Unfriend and delete this chat with ${friend.displayName}? This will also unfollow them.`
      )
    ) {
      return;
    }
    setUnfriending(true);
    setError('');
    try {
      await unfriend(spotifyUserId);
      onUnfriended();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unfriend this person');
      setUnfriending(false);
    }
  }

  return (
    <NavPanel open={Boolean(spotifyUserId)} onClose={onClose} title={profile?.displayName || 'Profile'}>
      <div className="flex flex-col items-center gap-4 px-5 py-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error && !profile ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <>
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400 bg-slate-300 shadow-md">
              {profile?.profileImage ? (
                <img src={profile.profileImage} alt={profile.displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-semibold text-slate-700">
                  {(profile?.displayName || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="text-center">
              <p className="text-base font-semibold text-cyan-100">{profile?.displayName}</p>
              {profile?.profileUrl && (
                <a
                  href={profile.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300 underline hover:text-cyan-200"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Spotify profile
                </a>
              )}
            </div>

            {friend ? (
              <button
                type="button"
                onClick={handleUnfriend}
                disabled={unfriending}
                className="rounded-full bg-red-500/90 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {unfriending ? 'Unfriending…' : 'Unfriend'}
              </button>
            ) : (
              <p className="max-w-xs text-center text-xs text-white/40">
                Unfriending only applies to people you have a direct chat with - this person is a
                group member, not a direct-chat friend.
              </p>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
          </>
        )}
      </div>
    </NavPanel>
  );
}
