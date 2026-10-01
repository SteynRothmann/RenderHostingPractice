import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, LogOut, MessageCircle, Search } from 'lucide-react';
import { useAuth } from '../../data/AuthContext';
import { useChat } from '../../data/ChatContext';
import { fetchIncomingChatRequests } from '../../lib/api';
import OceanButton from '../../components/OceanButton';
import BrandLogo from '../../components/BrandLogo';
import Tooltip from '../../components/Tooltip';
import ThemeToggle from '../../components/ThemeToggle';

// A single live search match, as handed down from OceanPage (which owns
// the actual `groups` data) for the search-as-you-type dropdown below.
export interface SearchResultItem {
  trackId: string;
  trackName: string;
  artist: string;
  albumArt: string | null;
}

interface Props {
  onSearch: (query: string) => void;
  onOpenNotifications: () => void;
  // Top ~6 matches for whatever's currently in the search box, computed by
  // OceanPage from its live ocean-groups data - empty when the query is
  // empty. Rendered as a dropdown while the input is focused.
  searchResults: SearchResultItem[];
  // Clicking a dropdown row does the same thing as clicking that song's
  // bubble on the canvas (opens its OceanSongPanel).
  onSelectSearchResult: (trackId: string) => void;
}

// Same slowed-down idle "bob" used by WeeklyChallengeButton (7.2s, was
// 4.5s there originally) - applied to every button in the nav row too, each
// with its own small delay (derived from index) so they don't all bob in
// perfect unison.
function NavBob({ index, children }: { index: number; children: ReactNode }) {
  return (
    <motion.div
      animate={{ y: [0, -3, 2, -1, 0], rotateZ: [0, 1, -1, 0] }}
      transition={{ repeat: Infinity, duration: 7.2, ease: 'easeInOut', delay: index * 0.6 }}
      className="flex items-center"
    >
      {children}
    </motion.div>
  );
}

export default function OceanNav({ onSearch, onOpenNotifications, searchResults, onSelectSearchResult }: Props) {
  const { isLoggedIn, logout, profile } = useAuth();
  const { hasAnyUnread } = useChat();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  // Local copy of the search text (the input used to be fully
  // uncontrolled) plus whether it's focused - together these decide when
  // the live-results dropdown should be visible: focused AND non-empty.
  // Clicking a result clears both so the dropdown collapses, per the PM's
  // "click a result... then clear/collapse the dropdown" ask.
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    setSearchText(value);
    onSearch(value);
  }

  function handleSearchFocus() {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setSearchFocused(true);
  }

  function handleSearchBlur() {
    // Delay closing so a click on a dropdown row (which blurs the input
    // first) still gets to run its onClick before the dropdown unmounts.
    blurTimerRef.current = setTimeout(() => setSearchFocused(false), 150);
  }

  function handleSelectResult(trackId: string) {
    onSelectSearchResult(trackId);
    setSearchText('');
    onSearch('');
    setSearchFocused(false);
  }

  const showDropdown = searchFocused && searchText.trim() !== '';

  // Real pending chat-request count, for the red dot - polled rather than
  // pushed, so it can lag a few seconds behind an incoming request; fine
  // for a notification badge.
  useEffect(() => {
    if (!isLoggedIn) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    function poll() {
      fetchIncomingChatRequests()
        .then((requests) => {
          if (!cancelled) setPendingCount(requests.length);
        })
        .catch(() => {
          // non-fatal - keep showing the last known count
        });
    }
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isLoggedIn]);

  return (
    <div className="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 bg-wl-bg/80 px-4 py-2.5 text-wl-title backdrop-blur">
      {/* Logo + wordmark, far left - the single Wavelength brand mark shown
          to everyone, logged in or not. There used to also be a second,
          smaller logo-only fallback rendered here for guests; it's removed
          so only this one ever shows. */}
      <div className="flex items-center gap-2">
        <Link to="/" aria-label="Wavelength home" className="flex items-center gap-2">
          <BrandLogo className="h-7 w-7" withWordmark />
        </Link>
      </div>

      {/* Profile / Chat / Notifications - truly centered on the nav bar via
          absolute positioning (left-1/2 + -translate-x-1/2) rather than a
          flex-1 middle child. The old flex-1 approach centered this group
          only within whatever space was LEFT OVER between the logo and the
          search/logout controls - since those two side groups aren't the
          same width, the "center" group ended up visibly off-center. This
          centers it against the nav bar's true width instead, regardless of
          how wide either side group is. Also spaced further apart (gap-8,
          was gap-3) per feedback that the three felt cramped together. */}
      {isLoggedIn && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-8">
          <NavBob index={0}>
            <Tooltip label="Profile">
              <Link to="/profile" aria-label="Your profile" className="flex items-center">
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-700 ring-2 ring-transparent hover:ring-cyan-400">
                  {profile?.profileImage ? (
                    <img src={profile.profileImage} alt="Your Spotify profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-slate-300">
                      {(profile?.displayName || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              </Link>
            </Tooltip>
          </NavBob>

          <NavBob index={1}>
            <Tooltip label="Chat">
              <OceanButton
                onClick={() => navigate('/chat')}
                aria-label="Chat"
                className="relative flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium hover:bg-cyan-500/10 hover:text-wl-title"
              >
                <MessageCircle className="h-5 w-5" />
                {hasAnyUnread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
              </OceanButton>
            </Tooltip>
          </NavBob>

          <NavBob index={2}>
            <Tooltip label="Notifications">
              <OceanButton
                onClick={onOpenNotifications}
                aria-label="Notifications"
                className="relative flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium hover:bg-cyan-500/10 hover:text-wl-title"
              >
                <Bell className="h-5 w-5" />
                {pendingCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
              </OceanButton>
            </Tooltip>
          </NavBob>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <div className="relative">
          <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-wl-panel/60 px-3 py-1.5">
            <Search className="h-4 w-4 text-wl-icon" />
            <input
              type="text"
              value={searchText}
              placeholder="Search / filter"
              aria-label="Search or filter"
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              className="w-32 bg-transparent text-sm text-wl-title placeholder:text-wl-faint outline-none sm:w-48"
            />
          </div>

          {/* Live search-as-you-type results dropdown, Claude.ai-style:
              shows while the input is focused and non-empty, including a
              "No matches" row so an empty result set doesn't just look
              broken. Clicking a row opens that song's panel, same as
              clicking its bubble on the canvas. */}
          {showDropdown && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-72 overflow-hidden rounded-xl border border-cyan-500/20 bg-wl-bg/95 shadow-xl backdrop-blur">
              {searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-wl-faint">No matches</p>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.trackId}
                    type="button"
                    onClick={() => handleSelectResult(result.trackId)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-cyan-500/10"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-cyan-950">
                      {result.albumArt ? (
                        <img src={result.albumArt} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Search className="h-3.5 w-3.5 text-cyan-500/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-wl-title">{result.trackName}</p>
                      <p className="truncate text-xs text-wl-muted">{result.artist}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <Tooltip label="Toggle theme">
          <ThemeToggle />
        </Tooltip>

        {isLoggedIn ? (
          <NavBob index={3}>
            <Tooltip label="Log out">
              <OceanButton
                onClick={logout}
                aria-label="Log out"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-wl-cyan/70 hover:bg-cyan-500/10 hover:text-wl-title"
              >
                <LogOut className="h-4 w-4" />
              </OceanButton>
            </Tooltip>
          </NavBob>
        ) : (
          <Link to="/login" className="rounded-full bg-wl-accent px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#1fdf64]">
            Log in
          </Link>
        )}
      </div>
    </div>
  );
}
