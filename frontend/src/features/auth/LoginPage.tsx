import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Music2, Trophy, Users, Waves } from 'lucide-react';
import { useAuth } from '../../data/AuthContext';

// Real login screen. The visual shell (animated wave background, single
// centered card) is adapted from the redesign mockup's LoginPage, but the
// button still does a full-page redirect into the backend's real OAuth flow
// (backend/routes/auth.js#/login -> Spotify -> #/callback), which lands
// back here with ?error=... on failure, or on the Ocean page ("/") already
// logged in on success.
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Spotify login was cancelled.',
  state_mismatch: 'Login could not be verified — please try again.',
  token_exchange_failed: "Something went wrong connecting to Spotify — please try again.",
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const errorReason = params.get('error');

  function handleLogin() {
    setConnecting(true);
    login();
  }

  return (
    <main className="min-h-screen bg-[#02182b] text-white">
      <section className="login-page">
        <div className="login-brand">
          <div className="login-brand-mark">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="#3d2fb0" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="login-brand-word">WaveLength</span>
        </div>

        <p className="login-tagline">
          Discover, connect and listen with people around the world
        </p>

        <div className="login-center">
          <div className="login-card">
            <h1>Welcome</h1>
            <p>
              Sign in to discover new music and connect with people who share your sound.
            </p>

            {errorReason && (
              <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-100">
                {ERROR_MESSAGES[errorReason] || 'Could not connect to Spotify — please try again.'}
              </p>
            )}

            <button
              className="login-spotify-button"
              type="button"
              onClick={handleLogin}
              disabled={connecting}
            >
              <Music2 className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>{connecting ? 'Redirecting to Spotify…' : 'Continue with Spotify'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-3 text-xs font-medium text-white/70 underline-offset-2 hover:text-white hover:underline"
            >
              Keep browsing as guest
            </button>

            <div className="login-fine-print">
              By continuing, you agree to WaveLength&apos;s Terms &amp; Privacy Policy
            </div>
          </div>
        </div>

        <div className="login-waves-wrap" aria-hidden="true">
          <svg
            className="login-waves"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 24 150 28"
            preserveAspectRatio="none"
            shapeRendering="auto"
          >
            <defs>
              <path
                id="login-gentle-wave"
                d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"
              />
            </defs>

            <g className="login-parallax">
              <use href="#login-gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.7)" />
              <use href="#login-gentle-wave" x="48" y="3" fill="rgba(255,255,255,0.5)" />
              <use href="#login-gentle-wave" x="48" y="5" fill="rgba(255,255,255,0.3)" />
              <use href="#login-gentle-wave" x="48" y="7" fill="#fff" />
            </g>
          </svg>
        </div>
      </section>

      <section className="border-t border-cyan-500/20 bg-[#04385a] px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-cyan-100">Find your people through music</h2>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <article className="rounded-lg border border-cyan-500/20 bg-[#02182b] p-6">
              <Waves className="size-7 text-cyan-400" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">Explore the Ocean</h3>
              <p className="mt-2 leading-6 text-slate-300">
                Discover songs through the live listening activity of other users.
              </p>
            </article>

            <article className="rounded-lg border border-cyan-500/20 bg-[#02182b] p-6">
              <Users className="size-7 text-cyan-400" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">Join Groups</h3>
              <p className="mt-2 leading-6 text-slate-300">
                Connect with communities built around shared musical interests.
              </p>
            </article>

            <article className="rounded-lg border border-cyan-500/20 bg-[#02182b] p-6">
              <Trophy className="size-7 text-cyan-400" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">Take on Challenges</h3>
              <p className="mt-2 leading-6 text-slate-300">
                Participate in weekly community challenges and unlock cosmetic profile effects.
              </p>
            </article>
          </div>
        </div>
      </section>

      <footer className="border-t border-cyan-500/20 bg-[#02182b] px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
          <p>&copy; 2026 WaveLength</p>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Legal information">
            <a className="hover:text-cyan-300" href="#privacy">Privacy Policy</a>
            <a className="hover:text-cyan-300" href="#terms">Terms of Use</a>
            <a className="hover:text-cyan-300" href="#data-processing">POPIA Data Processing Notice</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
