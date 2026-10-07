import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../data/AuthContext';
import { GUEST_STEPS, TOUR_EVENT_PREFIX, USER_STEPS, type TourEvent, type TourStep } from './tourSteps';
import TourOverlay from './TourOverlay';

// First-time tour controller. Owns "which step are we on", moves between
// pages when a step lives elsewhere, fires the events that open/close
// panels, and remembers (per browser, per account) that the tour was seen
// so it only pops up automatically once.

interface TourContextValue {
  active: boolean;
  start: () => void;
}

const TourContext = createContext<TourContextValue>({ active: false, start: () => {} });

export function useTour() {
  return useContext(TourContext);
}

const STORAGE_PREFIX = 'wl-tour-v1:';

function readDone(key: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) === '1';
  } catch {
    return false;
  }
}

function writeDone(key: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, '1');
  } catch {
    // private mode etc. - the tour may show again next visit, which is fine
  }
}

function fire(event: TourEvent) {
  window.dispatchEvent(new Event(TOUR_EVENT_PREFIX + event));
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);

  // Tour progress is remembered per account (guests share one slot), so a
  // guest who later logs in still gets the full tour once.
  const storageKey = isLoggedIn ? profile?.spotifyUserId || 'user' : 'guest';

  const step: TourStep | undefined = active ? steps[index] : undefined;

  const start = useCallback(() => {
    setSteps(isLoggedIn ? USER_STEPS : GUEST_STEPS);
    setIndex(0);
    setActive(true);
  }, [isLoggedIn]);

  const finish = useCallback(() => {
    fire('close-challenge');
    writeDone(storageKey);
    setActive(false);
    if (window.location.pathname !== '/') navigate('/', { replace: true });
  }, [navigate, storageKey]);

  const leave = useCallback((from: TourStep | undefined) => {
    if (!from) return;
    if (from.blurOnExit) (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  const next = useCallback(() => {
    leave(step);
    if (index >= steps.length - 1) finish();
    else setIndex(index + 1);
  }, [finish, index, leave, step, steps.length]);

  const back = useCallback(() => {
    leave(step);
    if (index > 0) setIndex(index - 1);
  }, [index, leave, step]);

  // First visit: start on its own once we know who is looking, and only on
  // the Ocean (the landing page).
  useEffect(() => {
    if (loading || active || location.pathname !== '/') return;
    if (readDone(storageKey)) return;
    const timer = window.setTimeout(start, 1500);
    return () => window.clearTimeout(timer);
  }, [loading, active, location.pathname, storageKey, start]);

  // Entering a step: go to its page, then open panels / click tabs it needs.
  const enteredRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      enteredRef.current = null;
      return;
    }
    if (!step) return;
    if (location.pathname !== step.route) {
      navigate(step.route, { replace: true });
      return;
    }
    if (enteredRef.current === index) return;
    enteredRef.current = index;

    if (step.enter) fire(step.enter);

    if (step.enterClick) {
      const selector = `[data-tour="${step.enterClick}"]`;
      let tries = 0;
      const timer = window.setInterval(() => {
        const el = document.querySelector<HTMLElement>(selector);
        tries += 1;
        if (el) {
          el.click();
          window.clearInterval(timer);
        } else if (tries > 40) {
          window.clearInterval(timer);
        }
      }, 100);
      return () => window.clearInterval(timer);
    }
  }, [active, step, index, location.pathname, navigate]);

  // If someone logs out mid-tour, the user steps no longer make sense.
  useEffect(() => {
    if (active && !isLoggedIn && steps === USER_STEPS) setActive(false);
  }, [active, isLoggedIn, steps]);

  const value = useMemo(() => ({ active, start }), [active, start]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && step && (
        <TourOverlay
          step={step}
          index={index}
          total={steps.length}
          onNext={next}
          onBack={back}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}
