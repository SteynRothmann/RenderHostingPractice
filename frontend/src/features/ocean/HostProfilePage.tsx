import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, ListMusic, MessageCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../data/AuthContext';
import { fetchHostProfile, sendChatRequest } from '../../lib/api';
import type { HostProfile, PublicPlaylist } from '../../data/types';

// A read-only Wavelength profile for someone else - reached by clicking
// "View Profile" on an ocean song panel for a host who isn't you. Shows
// only what Spotify's public API actually exposes for a third party:
// their name, avatar, and public playlists. No editing (it's not your
// profile), no nickname/bio/genres (that's mock app-only state that only
// exists for whoever is currently logged in as "me" - see MyProfilePage),
// and no recently-played (Spotify never exposes that for anyone but the
// authenticated user themselves).
//
// "Request Chat" sends a real request to their Spotify account, which
// shows up in their Notifications to accept or decline - see
// backend/lib/chatRequests.js. Chat itself isn't built yet; this only
// covers the request/accept/decline step.
export default function HostProfilePage() {
  const { spotifyUserId } = useParams<{ spotifyUserId: string }>();
  const { profile: myProfile } = useAuth();
  const [profile, setProfile] = useState<HostProfile | null>(null);
  const [playlists, setPlaylists] = useState<PublicPlaylist[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [chatRequestState, setChatRequestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [chatRequestError, setChatRequestError] = useState('');

  useEffect(() => {
    if (!spotifyUserId) return;
    setLoading(true);
    setError('');
    setChatRequestState('idle');
    fetchHostProfile(spotifyUserId)
      .then(({ profile, playlists }) => {
        setProfile(profile);
        setPlaylists(playlists);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this profile'))
      .finally(() => setLoading(false));
  }, [spotifyUserId]);

  const isMe = !!myProfile && myProfile.spotifyUserId === spotifyUserId;

  async function handleRequestChat() {
    if (!spotifyUserId) return;
    setChatRequestState('sending');
    setChatRequestError('');
    try {
      await sendChatRequest(spotifyUserId);
      setChatRequestState('sent');
    } catch (err) {
      setChatRequestState('error');
      setChatRequestError(err instanceof Error ? err.message : 'Could not send chat request');
    }
  }

  return (
    <div className="min-h-screen bg-[#02182b] pb-24 text-white">
      <PageHeader title={profile?.displayName || 'Profile'} />

      <div className="mx-auto my-8 max-w-4xl rounded-3xl border border-cyan-500/20 bg-[#04385a]/90 p-6 shadow-2xl backdrop-blur-md md:p-8">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <>
            {/* Header: avatar + name, read-only */}
            <div className="flex flex-col items-center gap-4 border-b border-cyan-500/20 pb-6 sm:flex-row">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400 bg-slate-300 shadow-md">
                {profile?.profileImage ? (
                  <img src={profile.profileImage} alt={profile.displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-semibold text-slate-700">
                    {(profile?.displayName || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-lg font-semibold text-cyan-100">{profile?.displayName}</p>
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

              {!isMe && (
                <div className="flex flex-col items-center gap-1 sm:items-end">
                  <button
                    onClick={handleRequestChat}
                    disabled={chatRequestState === 'sending' || chatRequestState === 'sent'}
                    type="button"
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#543ab7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a319f] disabled:opacity-50"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {chatRequestState === 'sent'
                      ? 'Request sent'
                      : chatRequestState === 'sending'
                        ? 'Sending…'
                        : 'Request Chat'}
                  </button>
                  {chatRequestState === 'error' && <p className="text-xs text-red-400">{chatRequestError}</p>}
                </div>
              )}
            </div>

            {/* Public playlists */}
            <div className="pt-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-300">Public playlists</h3>
              {playlists.length === 0 ? (
                <p className="text-xs text-slate-400">No public playlists on this account.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {playlists.map((p) => (
                    <a
                      key={p.id}
                      href={p.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-lg border border-cyan-500/10 bg-[#02182b] p-2 transition hover:border-cyan-500/30"
                    >
                      <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-cyan-950">
                        {p.image ? (
                          <img src={p.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ListMusic className="h-6 w-6 text-cyan-500/50" />
                        )}
                      </div>
                      <p className="truncate text-xs font-medium text-cyan-100 group-hover:text-cyan-300">{p.name}</p>
                      <p className="text-[11px] text-slate-500">{p.trackCount} tracks</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
