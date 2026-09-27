import { useEffect, useState } from 'react';
import { Check, MessageCircle, X } from 'lucide-react';
import NavPanel from '../../components/NavPanel';
import { fetchIncomingChatRequests, respondToChatRequest } from '../../lib/api';
import type { ChatRequest } from '../../data/types';

// Real chat requests, addressed to your actual Spotify account (see
// backend/lib/chatRequests.js) - not mock data. Chat itself isn't opened
// from here; Accept/Decline only resolves the request.
export default function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [error, setError] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchIncomingChatRequests()
      .then(setRequests)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load notifications'));
  }, [open]);

  async function respond(id: string, accept: boolean) {
    setError('');
    setRespondingId(id);
    try {
      await respondToChatRequest(id, accept);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not respond to chat request');
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <NavPanel open={open} onClose={onClose} title="Notifications">
      <div className="flex flex-col gap-5 px-5 py-5">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Chat Requests
              </p>
              <h3 className="mt-1 text-sm font-semibold text-white">People wanting to connect</h3>
            </div>

            {requests.length > 0 && (
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/10 px-2 text-xs font-semibold text-cyan-100">
                {requests.length}
              </span>
            )}
          </div>

          {error && (
            <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {requests.length === 0 && !error ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-8 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                <MessageCircle className="h-5 w-5 text-cyan-200" />
              </div>
              <p className="mt-3 text-sm font-medium text-white">You're all caught up</p>
              <p className="mt-1 text-xs text-white/40">New chat requests will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:bg-white/[0.09]"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/25 bg-slate-700">
                      {r.fromProfileImage ? (
                        <img src={r.fromProfileImage} alt={r.fromDisplayName ?? ''} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                          {(r.fromDisplayName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {r.fromDisplayName || 'Someone'}
                      </p>
                      <p className="mt-0.5 text-xs text-white/45">wants to chat with you</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => respond(r.id, true)}
                      disabled={respondingId === r.id}
                      className="flex items-center justify-center gap-2 rounded-full bg-white py-2.5 text-xs font-semibold text-[#3d2fb0] transition hover:bg-white/90 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </button>

                    <button
                      type="button"
                      onClick={() => respond(r.id, false)}
                      disabled={respondingId === r.id}
                      className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </NavPanel>
  );
}
