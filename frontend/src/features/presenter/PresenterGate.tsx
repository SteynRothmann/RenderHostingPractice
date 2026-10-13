import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRESENTER_EVENT, PRESENTER_FLAG, PRESENTER_STEP } from './flags';

// The only presenter code in the main bundle. The real presenter is a lazy
// chunk that is downloaded ONLY when presenter mode has been switched on by
// visiting /present in this browser tab, so normal visitors never load it.
const Presenter = lazy(() => import('./Presenter'));

function isOn(): boolean {
  try {
    return sessionStorage.getItem(PRESENTER_FLAG) === '1';
  } catch {
    return false;
  }
}

export function PresenterGate() {
  const [on, setOn] = useState(isOn);
  useEffect(() => {
    const sync = () => setOn(isOn());
    window.addEventListener(PRESENTER_EVENT, sync);
    // /present sets the flag in an effect that can run before this listener exists.
    sync();
    return () => window.removeEventListener(PRESENTER_EVENT, sync);
  }, []);
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <Presenter />
    </Suspense>
  );
}

/** The /present page: switch presenter mode on for this tab, then go to the ocean. */
export function PresentEntry() {
  const navigate = useNavigate();
  useEffect(() => {
    try {
      sessionStorage.setItem(PRESENTER_FLAG, '1');
      sessionStorage.setItem(PRESENTER_STEP, '-1');
      // So the logged-out welcome message shows again for the recording.
      sessionStorage.removeItem('wl-guest-welcome-dismissed');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(PRESENTER_EVENT));
    navigate('/', { replace: true });
  }, [navigate]);
  return null;
}
