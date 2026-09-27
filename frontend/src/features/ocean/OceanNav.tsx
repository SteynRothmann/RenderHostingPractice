import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, LogOut, MessageCircle, Search } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { useAuth } from '../../data/AuthContext';
import { fetchIncomingChatRequests } from '../../lib/api';
import OceanButton from '../../components/OceanButton';
import BrandLogo from '../../components/BrandLogo';
import Tooltip from '../../components/Tooltip';

interface Props {
  onSearch: (query: string) => void;
  onOpenNotifications: () => void;
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

export default function OceanNav({ onSearch, onOpenNotifications }: Props) {
  const { db } = useData();
  const { isLoggedIn, logout, profile } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

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
    <div className="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 bg-[#02182b]/80 px-4 py-2.5 text-cyan-100 backdrop-blur">
      {/* Logo + wordmark, top-left of the nav bar - the single Wavelength
          brand mark shown to everyone, logged in or not. There used to
          also be a second, smaller logo-only fallback rendered here for
          guests; it's removed so only this one ever shows. */}
      <div className="flex items-center gap-2">
        <Link to="/" aria-label="Wavelength home" className="flex items-center gap-2">
          <BrandLogo className="h-7 w-7" withWordmark />
        </Link>

        {isLoggedIn && (
          <>
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
                  className="relative flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium hover:bg-cyan-500/10 hover:text-white"
                >
                  <MessageCircle className="h-5 w-5" />
                  {db.hasChatDot && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
                </OceanButton>
              </Tooltip>
            </NavBob>

            <NavBob index={2}>
              <Tooltip label="Notifications">
                <OceanButton
                  onClick={onOpenNotifications}
                  aria-label="Notifications"
                  className="relative flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium hover:bg-cyan-500/10 hover:text-white"
                >
                  <Bell className="h-5 w-5" />
                  {pendingCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
                </OceanButton>
              </Tooltip>
            </NavBob>
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-[#04385a]/60 px-3 py-1.5">
          <Search className="h-4 w-4 text-cyan-400" />
          <input
            type="text"
            placeholder="Search / filter"
            aria-label="Search or filter"
            onChange={(e) => onSearch(e.target.value)}
            className="w-32 bg-transparent text-sm text-cyan-100 placeholder:text-cyan-100/40 outline-none sm:w-48"
          />
        </div>

        {isLoggedIn ? (
          <NavBob index={3}>
            <Tooltip label="Log out">
              <OceanButton
                onClick={logout}
                aria-label="Log out"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-cyan-300/70 hover:bg-cyan-500/10 hover:text-cyan-100"
              >
                <LogOut className="h-4 w-4" />
              </OceanButton>
            </Tooltip>
          </NavBob>
        ) : (
          <Link to="/login" className="rounded-full bg-[#1ED760] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#1fdf64]">
            Log in
          </Link>
        )}
      </div>
    </div>
  );
}
