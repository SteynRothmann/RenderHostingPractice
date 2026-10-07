import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import BrandLogo from '../../components/BrandLogo';
import type { TourStep } from './tourSteps';

// The dimmed screen with one lit-up circle, plus the little "chat" bubble
// that explains it.
//
// - The dark layer is an SVG mask with a hole; four invisible blocks around
//   the hole stop clicks reaching the page, while the hole itself stays
//   clickable so people can really do what a step asks.
// - The bubble follows the highlighted element (nav icons bob, panels slide)
//   by re-reading its position every frame.

interface Props {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 8; // breathing room between the element and the edge of the light
const GIVE_UP_MS = 4000; // stop looking for a missing element and just talk
const BUBBLE_W = 340;
const MARGIN = 12;

function holeFor(rect: DOMRect): Box & { rx: number } {
  const circleish = Math.max(rect.width, rect.height) <= 120 && Math.max(rect.width, rect.height) / Math.min(rect.width, rect.height) < 1.5;
  if (circleish) {
    const size = Math.max(rect.width, rect.height) + PAD * 2;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return { x: cx - size / 2, y: cy - size / 2, w: size, h: size, rx: size / 2 };
  }
  const w = rect.width + PAD * 2;
  const h = rect.height + PAD * 2;
  return { x: rect.left - PAD, y: rect.top - PAD, w, h, rx: Math.min(h / 2, 32) };
}

export default function TourOverlay({ step, index, total, onNext, onBack, onSkip }: Props) {
  const [hole, setHole] = useState<(Box & { rx: number }) | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [typing, setTyping] = useState(true);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [bubbleH, setBubbleH] = useState(180);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const scrolledFor = useRef<string | null>(null);

  // Follow the target element, frame by frame.
  useEffect(() => {
    setHole(null);
    setGaveUp(false);
    scrolledFor.current = null;
    if (!step.target) return;

    const selector = `[data-tour="${step.target}"]`;
    const startedAt = performance.now();
    let frame = 0;

    const tick = () => {
      const el = document.querySelector<HTMLElement>(selector);
      const rect = el?.getBoundingClientRect();
      if (el && rect && rect.width > 0 && rect.height > 0) {
        if (scrolledFor.current !== step.id) {
          scrolledFor.current = step.id;
          const off = rect.top < 60 || rect.bottom > window.innerHeight - 20;
          if (off) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        const next = holeFor(rect);
        setHole((prev) =>
          prev && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5 && Math.abs(prev.w - next.w) < 0.5 && Math.abs(prev.h - next.h) < 0.5
            ? prev
            : next
        );
        setGaveUp(false);
      } else {
        setHole((prev) => (prev ? null : prev));
        if (performance.now() - startedAt > GIVE_UP_MS) setGaveUp(true);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step.id, step.target]);

  // "Typing..." dots for a moment on each new message, like a real chat.
  useEffect(() => {
    setTyping(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setTyping(false), reduce ? 0 : 450);
    return () => window.clearTimeout(timer);
  }, [step.id]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    const h = bubbleRef.current?.offsetHeight;
    if (h && Math.abs(h - bubbleH) > 1) setBubbleH(h);
  });

  // Doing what the step asks completes it.
  useEffect(() => {
    if (!step.advanceOn || !step.target) return;
    const selector = `[data-tour="${step.target}"]`;
    const eventName = step.advanceOn === 'focus' ? 'focusin' : 'click';
    let timer = 0;
    const handler = (e: Event) => {
      const el = document.querySelector(selector);
      if (el && e.target instanceof Node && el.contains(e.target)) {
        window.clearTimeout(timer);
        // Let the element's own handler run first (open the panel, etc.).
        timer = window.setTimeout(onNext, 450);
      }
    };
    document.addEventListener(eventName, handler, true);
    return () => {
      document.removeEventListener(eventName, handler, true);
      window.clearTimeout(timer);
    };
    // onNext changes identity each step; the effect re-subscribes with it
  }, [step.advanceOn, step.target, onNext]);

  // Keyboard: Esc skips, arrows move.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const typingInField = ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement | null)?.tagName ?? '');
      if (typingInField && e.key !== 'Escape') return; // arrows belong to the text box
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'ArrowLeft') onBack();
    },
    [onBack, onNext, onSkip]
  );
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  useEffect(() => {
    if (!typing) nextRef.current?.focus({ preventScroll: true });
  }, [typing, step.id]);

  const waiting = !!step.target && !hole && !gaveUp; // still looking for the element
  const centered = !step.target || gaveUp;
  const last = index === total - 1;

  // --- Where does the bubble go? ---
  const bw = Math.min(BUBBLE_W, viewport.w - MARGIN * 2);
  let left = (viewport.w - bw) / 2;
  let top = (viewport.h - bubbleH) / 2;
  let tail: { side: 'top' | 'bottom'; x: number } | null = null;

  if (!centered && hole) {
    const cx = hole.x + hole.w / 2;
    const below = hole.y + hole.h + 16;
    const above = hole.y - bubbleH - 16;
    const fitsBelow = below + bubbleH <= viewport.h - MARGIN;
    const fitsAbove = above >= MARGIN;
    let place: 'top' | 'bottom' | 'dock' =
      step.placement === 'top' && fitsAbove ? 'top' : step.placement === 'bottom' && fitsBelow ? 'bottom' : fitsBelow ? 'bottom' : fitsAbove ? 'top' : 'dock';
    if (place === 'bottom') {
      top = below;
      tail = { side: 'top', x: cx };
    } else if (place === 'top') {
      top = above;
      tail = { side: 'bottom', x: cx };
    } else {
      top = viewport.h - bubbleH - MARGIN - 8; // big target: sit at the bottom edge
    }
    left = Math.min(Math.max(cx - bw / 2, MARGIN), viewport.w - bw - MARGIN);
  }
  const tailX = tail ? Math.min(Math.max(tail.x - left, 22), bw - 22) : 0;

  const dim = 'rgba(2, 8, 20, 0.78)';
  const maskId = 'wl-tour-mask';

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 10000 }} role="dialog" aria-label="Wavelength tour" aria-live="polite">
      {/* Dark layer with a lit-up hole */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                fill="black"
                style={{ x: hole.x, y: hole.y, width: hole.w, height: hole.h, rx: hole.rx, ry: hole.rx, transition: 'all 0.35s ease' }}
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={dim} mask={`url(#${maskId})`} />
        {hole && (
          <rect
            className="wl-tour-ring"
            fill="none"
            stroke="rgb(103 232 249)"
            strokeWidth="2"
            style={{ x: hole.x, y: hole.y, width: hole.w, height: hole.h, rx: hole.rx, ry: hole.rx, transition: 'all 0.35s ease' }}
          />
        )}
      </svg>

      {/* Click blockers: everything except the lit-up hole */}
      {hole ? (
        <>
          <div className="pointer-events-auto absolute left-0 right-0 top-0" style={{ height: Math.max(hole.y, 0) }} />
          <div className="pointer-events-auto absolute left-0 right-0 bottom-0" style={{ top: hole.y + hole.h }} />
          <div className="pointer-events-auto absolute left-0" style={{ top: hole.y, height: hole.h, width: Math.max(hole.x, 0) }} />
          <div className="pointer-events-auto absolute right-0" style={{ top: hole.y, height: hole.h, left: hole.x + hole.w }} />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0" />
      )}

      {/* The chat bubble */}
      {!waiting && (
        <div
          ref={bubbleRef}
          className="wl-tour-bubble pointer-events-auto absolute"
          style={{ left, top, width: bw }}
        >
          <div className="relative flex gap-3 rounded-2xl border border-cyan-400/40 bg-wl-bg p-4 text-wl-fg shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
            {tail && (
              <span
                aria-hidden="true"
                className="absolute h-3 w-3 rotate-45 border-cyan-400/40 bg-wl-bg"
                style={{
                  left: tailX - 6,
                  ...(tail.side === 'top'
                    ? { top: -7, borderLeftWidth: 1, borderTopWidth: 1 }
                    : { bottom: -7, borderRightWidth: 1, borderBottomWidth: 1 }),
                }}
              />
            )}

            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-wl-panel">
              <BrandLogo className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-wl-title">{step.title}</p>

              {typing ? (
                <div className="mt-2 flex h-5 items-center gap-1" aria-label="Typing">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="wl-tour-dot h-1.5 w-1.5 rounded-full bg-cyan-300" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              ) : (
                <>
                  <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-wl-fg/90">{step.body}</p>
                  {step.hint && (
                    <p className="mt-2 inline-block rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-wl-link">
                      {step.hint}
                    </p>
                  )}
                </>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-xs text-wl-muted underline-offset-2 hover:text-wl-title hover:underline"
                >
                  Skip tour
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] tabular-nums text-wl-faint">
                    {index + 1}/{total}
                  </span>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={onBack}
                      className="rounded-full border border-cyan-400/30 px-3 py-1.5 text-xs font-medium text-wl-title hover:bg-cyan-500/10"
                    >
                      Back
                    </button>
                  )}
                  <button
                    ref={nextRef}
                    type="button"
                    onClick={onNext}
                    className="rounded-full bg-wl-accent px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-[#1fdf64]"
                  >
                    {last ? 'Finish' : step.advanceOn ? 'Skip step' : index === 0 ? "Let's go" : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
