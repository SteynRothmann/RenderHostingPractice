import { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trophy,
  Clock,
  Users,
  Search,
  X,
  CheckCircle2,
  Lock,
  Compass,
  Check,
  Power,
  Sparkles,
  Eye,
  Disc,
  User,
} from 'lucide-react';

import Cover from '../../components/Cover';
import { useData } from '../../data/DataContext';
import { formatCountdown } from '../../data/mockData';
import {
  fetchActiveChallenge,
  searchChallengeTracks,
  submitChallengeEntry,
  fetchCosmeticsInventory,
  equipCosmetic,
} from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { ActiveChallenge, ChallengeSearchResult, CosmeticItem } from '../../data/types';

// Unlike the other overlays (Notifications, Create Group), Weekly
// Challenges gets its own large, top-of-viewport presentation rather than
// the shared NavPanel's centered modal - the user explicitly wants this
// panel emphasized: big, anchored near the top-middle of the Ocean page,
// well clear of the floating song bubbles beneath it, and responsive down
// to phone width.
export default function WeeklyChallengePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db } = useData();

  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChallengeSearchResult[]>([]);
  const [pending, setPending] = useState<ChallengeSearchResult | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Submitting also tries to start the track playing on Spotify right
  // now (so it shows up in the ocean) - that can fail independently of
  // the submission itself (no Premium, no active device). Not an error
  // (the entry is saved either way), so it gets its own, calmer notice.
  const [playbackNotice, setPlaybackNotice] = useState('');

  const [cosmetics, setCosmetics] = useState<CosmeticItem[]>([]);
  const [equippingRewardId, setEquippingRewardId] = useState<string | null>(null);

  const [previewTab, setPreviewTab] = useState<'avatar' | 'track'>('avatar');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the real active challenge + the caller's cosmetics inventory
  // whenever the panel opens.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingChallenge(true);
    fetchActiveChallenge()
      .then((active) => {
        if (!cancelled) setChallenge(active);
      })
      .catch((err) => {
        console.error('Could not load active challenge:', err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingChallenge(false);
      });

    fetchCosmeticsInventory()
      .then((items) => {
        if (!cancelled) setCosmetics(items);
      })
      .catch((err) => {
        console.error('Could not load cosmetics inventory:', err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Live participant count: the backend broadcasts 'challenge:update'
  // right after any submission is saved (see POST /challenges/submit),
  // so the count here updates without the viewer needing to reopen the
  // panel. Only subscribed while the panel is actually open, and only
  // applied when the event's challengeId matches what's currently shown.
  useEffect(() => {
    if (!open) return;
    const socket = getSocket();

    function onChallengeUpdate(payload: { challengeId: string | number; participantCount: number }) {
      setChallenge((current) => {
        if (!current || String(current.id) !== String(payload.challengeId)) return current;
        return { ...current, participantCount: payload.participantCount };
      });
    }

    socket.on('challenge:update', onChallengeUpdate);
    return () => {
      socket.off('challenge:update', onChallengeUpdate);
    };
  }, [open]);

  // Countdown, fed by the real deadline once it's loaded.
  useEffect(() => {
    if (!open || !challenge) return;
    const deadlineMs = new Date(challenge.deadline).getTime();
    setRemaining(deadlineMs - Date.now());
    const id = setInterval(() => {
      setRemaining(deadlineMs - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [open, challenge]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 400;
      canvas.height = canvas.parentElement?.clientHeight || 900;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) {
        const xOffset = Math.sin(time + i) * 30;
        const gradient = ctx.createLinearGradient(
          canvas.width * 0.2 + i * 80 + xOffset,
          0,
          canvas.width * 0.1 + i * 60,
          canvas.height
        );
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
        gradient.addColorStop(0.4, 'rgba(14, 165, 233, 0.08)');
        gradient.addColorStop(1, 'rgba(3, 7, 18, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.15 + i * 80 + xOffset, 0);
        ctx.lineTo(canvas.width * 0.35 + i * 80 + xOffset, 0);
        ctx.lineTo(canvas.width * 0.25 + i * 60, canvas.height);
        ctx.lineTo(canvas.width * 0.05 + i * 60, canvas.height);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  const alreadyEntered = !!challenge?.mySubmission;

  const runSearch = useCallback((value: string) => {
    if (!value.trim()) {
      setResults([]);
      return;
    }
    searchChallengeTracks(value)
      .then((found) => setResults(found))
      .catch((err) => {
        console.error('Challenge track search failed:', err.message);
        setResults([]);
      });
  }, []);

  function handleQuery(value: string) {
    setQuery(value);
    setPending(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => runSearch(value), 300);
  }

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  function submit() {
    if (!pending || !challenge) return;
    setSubmitting(true);
    setSubmitError('');
    setPlaybackNotice('');

    submitChallengeEntry(challenge.id, pending.id)
      .then((result) => {
        setChallenge((current) =>
          current
            ? {
                ...current,
                mySubmission: result.submission,
              }
            : current
        );
        setQuery('');
        setResults([]);
        setPending(null);
        if (!result.playbackStarted && result.playbackError) {
          setPlaybackNotice(result.playbackError);
        }
      })
      .catch((err) => {
        setSubmitError(err.message || 'Could not submit challenge entry');
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  function toggleRelic(relic: CosmeticItem) {
    if (!relic.is_unlocked || equippingRewardId) return;
    const nextEquipped = !relic.is_equipped;

    setEquippingRewardId(relic.reward_id);
    equipCosmetic(relic.reward_id, nextEquipped)
      .then(() => {
        setCosmetics((current) =>
          current.map((item) => ({
            ...item,
            is_equipped: item.reward_id === relic.reward_id ? nextEquipped : nextEquipped ? false : item.is_equipped,
          }))
        );
      })
      .catch((err) => {
        console.error('Could not update cosmetic:', err.message);
      })
      .finally(() => {
        setEquippingRewardId(null);
      });
  }

  const equippedRelic = cosmetics.find((c) => c.is_equipped) || null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-wl-scrim px-3 pb-6 pt-[4vh] backdrop-blur-sm sm:px-4 sm:pt-[6vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* This panel's own interior (relic cards, canvas light-ray
              effect, etc.) is a deliberately vivid dark "glass dashboard"
              treatment ported from an earlier mockup round - kept as a
              theme-agnostic identity in both modes, same judgment as
              OceanSongPanel/WeeklyChallengeButton. Only the backdrop scrim
              and this outer card surface are tokenized so the modal still
              sits correctly against either theme's page behind it. */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Weekly Challenge"
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-cyan-400/20 bg-wl-panel/90 shadow-[0_30px_80px_rgba(2,10,25,0.6)] backdrop-blur-xl lg:max-w-4xl"
            initial={{ opacity: 0, scale: 0.94, y: -24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -24 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-400/20 bg-white/[0.02] px-5 py-4 sm:px-6">
              <span className="flex items-center gap-2 text-base font-semibold text-cyan-100 sm:text-lg">
                <Trophy className="h-5 w-5 text-amber-300" />
                Weekly Challenge
              </span>

              <button
                aria-label="Close panel"
                onClick={onClose}
                className="text-cyan-300/70 transition hover:text-cyan-200"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="nav-panel-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-gradient-to-b from-[#0e3a5a] via-[#061e38] to-[#020914] px-4 py-6 font-sans text-slate-100 antialiased selection:bg-cyan-500/30 sm:px-6">
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-80"
              />

              <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 bg-gradient-to-b from-cyan-300/20 via-sky-400/10 to-transparent blur-md" />

              {loadingChallenge && !challenge ? (
                <div className="relative z-10 flex items-center justify-center py-16 text-xs font-medium text-cyan-200/70">
                  Loading this week's challenge…
                </div>
              ) : !challenge ? (
                <div className="relative z-10 flex items-center justify-center py-16 text-xs font-medium text-slate-300/80">
                  No active challenge right now - check back soon.
                </div>
              ) : (
                <div className="relative z-10 space-y-6">
                  {/* 1. HERO / THEME CARD */}
                  <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 via-white/[0.04] to-transparent p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3.5 py-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)] backdrop-blur-md">
                        <Trophy className="h-3.5 w-3.5 text-amber-300" />
                        <span className="text-xs font-semibold text-amber-100">
                          This Week's Challenge
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 backdrop-blur-md">
                        <Clock className="h-3.5 w-3.5 text-cyan-300" />
                        <span className="font-mono text-xs font-medium text-slate-200">
                          {remaining > 0 ? formatCountdown(remaining) : 'Closed'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300/90">
                      Weekly Theme
                    </p>

                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                      {challenge.theme}
                    </h2>

                    <p className="mt-2 max-w-lg text-xs leading-relaxed text-slate-300/90">
                      {challenge.description}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-200">
                        <Users className="h-3.5 w-3.5 text-cyan-400" />
                        <span>{challenge.participantCount} joined</span>
                      </div>

                      {alreadyEntered && (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                          <span>Joined ✓</span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* 2. SONG SEARCH & ENTRY */}
                  <section className="relative">
                    <div className="mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
                        Your Entry
                      </p>
                      <h3 className="text-sm font-bold text-white">Choose your song</h3>
                    </div>

                    <div className="relative">
                      <div
                        className={`flex items-center gap-3 rounded-xl border px-3.5 transition-all duration-200 ${
                          isSearchFocused
                            ? 'border-cyan-400/80 bg-black/60 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
                            : 'border-white/10 bg-black/30'
                        }`}
                      >
                        <Search className="h-4 w-4 shrink-0 text-slate-400" />
                        <input
                          type="text"
                          disabled={alreadyEntered}
                          value={query}
                          onFocus={() => setIsSearchFocused(true)}
                          onBlur={() => setIsSearchFocused(false)}
                          onChange={(e) => handleQuery(e.target.value)}
                          placeholder="Search songs or artists..."
                          className="w-full bg-transparent py-3 text-xs text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
                        />
                        {query && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuery('');
                              setResults([]);
                              setPending(null);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {results.length > 0 && (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-[#071325]/95 shadow-2xl backdrop-blur-2xl">
                          {results.map((song) => (
                            <button
                              key={song.id}
                              onClick={() => {
                                setPending(song);
                                setQuery(`${song.title} — ${song.artist}`);
                                setResults([]);
                              }}
                              className="flex w-full items-center gap-3 border-b border-white/5 px-3.5 py-2.5 text-left text-xs text-white transition hover:bg-white/10"
                              type="button"
                            >
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10">
                                <Cover song={song} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-200">{song.title}</p>
                                <p className="truncate text-[11px] text-slate-400">{song.artist}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {pending && !alreadyEntered && (
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={submit}
                        disabled={submitting}
                        className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-300 py-3 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-60"
                        type="button"
                      >
                        <span>{submitting ? 'Submitting…' : 'Confirm & Submit Entry'}</span>
                      </motion.button>
                    )}

                    {submitError && (
                      <p className="mt-2 text-xs text-wl-danger">{submitError}</p>
                    )}

                    {alreadyEntered && (
                      <div className="mt-3.5 flex flex-col items-center gap-1 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-3 text-center text-xs font-bold text-emerald-300">
                        <span>Challenge entry submitted ✓</span>
                        {playbackNotice && (
                          <span className="px-4 text-[10px] font-normal text-emerald-200/80">{playbackNotice}</span>
                        )}
                      </div>
                    )}
                  </section>

                  {/* 3. LIVE REWARD PREVIEW */}
                  <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#061b2e]/80 to-[#030d17]/90 p-4 backdrop-blur-xl sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-cyan-300" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                          Live Reward Preview
                        </h3>
                      </div>

                      <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
                        <button
                          type="button"
                          onClick={() => setPreviewTab('avatar')}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                            previewTab === 'avatar'
                              ? 'border border-cyan-400/30 bg-cyan-500/20 text-cyan-200'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <User className="h-3 w-3" />
                          <span>Avatar Aura</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewTab('track')}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                            previewTab === 'track'
                              ? 'border border-cyan-400/30 bg-cyan-500/20 text-cyan-200'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Disc className="h-3 w-3" />
                          <span>Song Marker</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-black/50 p-4">
                      <div className="relative flex items-center justify-center">
                        {equippedRelic?.css_class === 'cyan-glow' && (
                          <>
                            <div className="absolute -inset-4 animate-pulse rounded-full bg-gradient-to-tr from-cyan-400 via-sky-300 to-teal-300 opacity-70 blur-lg" />
                            <div className="absolute -inset-2 animate-ping rounded-full border border-cyan-400/40 opacity-40" />
                          </>
                        )}

                        {equippedRelic?.css_class === 'gold-shimmer' && (
                          <>
                            <div className="absolute -inset-4 animate-pulse rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 opacity-80 blur-lg" />
                            <div className="absolute -inset-2 animate-ping rounded-full border border-amber-400/40 opacity-40" />
                          </>
                        )}

                        {previewTab === 'avatar' ? (
                          <div className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-300 bg-slate-900 shadow-xl">
                            {db.me.pic ? (
                              <img
                                src={db.me.pic}
                                alt="Preview Avatar"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-amber-500 font-bold text-slate-950">
                                <User className="h-10 w-10 text-white" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-400/80 bg-slate-950/90 shadow-2xl">
                            {challenge.mySubmission ? (
                              <div className="h-full w-full overflow-hidden rounded-full p-1">
                                <Cover song={challenge.mySubmission} />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center text-cyan-300">
                                <Disc className="h-8 w-8 animate-spin" />
                                <span className="mt-0.5 text-[9px] font-bold tracking-wider">NODE</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* 4. UNLOCKED COSMETICS */}
                  <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#061b2e]/80 to-[#030d17]/90 p-4 backdrop-blur-xl sm:p-5">
                    <div className="mb-1 flex items-center gap-2.5">
                      <Compass className="h-4 w-4 text-cyan-300" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                        Unlocked Cosmetics
                      </h3>
                    </div>
                    <p className="mb-4 text-[11px] text-slate-400">
                      Toggle effects on or off. Equipping a cosmetic applies the effect to both your profile avatar and your ocean song marker.
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                      {cosmetics.map((relic) => {
                        const isActive = relic.is_equipped;

                        return (
                          <div
                            key={relic.reward_id}
                            className={`relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200 ${
                              !relic.is_unlocked
                                ? 'border-white/5 bg-black/40 opacity-50'
                                : isActive
                                  ? 'border-cyan-400/50 bg-gradient-to-r from-cyan-950/40 via-cyan-900/20 to-black/40 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                                  : 'border-white/10 bg-black/30 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                                    isActive
                                      ? 'border-cyan-300 bg-cyan-400/20 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                                      : 'border-white/10 bg-white/5 text-slate-400'
                                  }`}
                                >
                                  {relic.is_unlocked ? (
                                    <Sparkles className="h-4 w-4" />
                                  ) : (
                                    <Lock className="h-4 w-4 text-slate-500" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-xs font-bold text-white">
                                      {relic.name}
                                    </p>
                                    <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-cyan-300">
                                      Profile & Ocean
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-[11px] leading-snug text-slate-300/80">
                                    {relic.description}
                                  </p>
                                </div>
                              </div>

                              <div>
                                {relic.is_unlocked ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleRelic(relic)}
                                    disabled={equippingRewardId === relic.reward_id}
                                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-all disabled:opacity-60 ${
                                      isActive
                                        ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                                        : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    {isActive ? (
                                      <>
                                        <Check className="h-3.5 w-3.5 text-cyan-300" />
                                        <span>Equipped</span>
                                      </>
                                    ) : (
                                      <>
                                        <Power className="h-3.5 w-3.5" />
                                        <span>Unequipped</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 text-[10px] font-semibold text-slate-500">
                                    Locked
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
