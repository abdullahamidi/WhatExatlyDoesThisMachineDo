// Page splash: logo and progress bar over the canvas until the first rendered frame. DOM only, no Phaser.
// Timings and mark names live in src/data/shell.ts (SPLASH); the splash element ids stay private to this module.
import { SPLASH } from '../data/shell';

const SPLASH_ID = 'splash';
const SPLASH_BAR_ID = 'splash-bar';
const UI_ROOT_ID = 'ui-root';
const HIDING_CLASS = 'is-hiding';
const ON = 'on';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface HideSplashOptions {
  reducedMotion: boolean;
  doc?: Document;
  fadeMs?: number;
}

export interface FirstFrameOptions {
  markName?: string;
  maxWaitMs?: number;
}

let watching = false;

/** Bar width for progress p: clamped to 0..1 (NaN counts as 0), shown in percent with one decimal. */
export function splashWidth(p: number): string {
  const clamped = Number.isNaN(p) ? 0 : Math.min(1, Math.max(0, p));
  return `${Math.round(clamped * 1000) / 10}%`;
}

/** Sets the splash bar width for loader progress p (0..1). Does nothing when the bar is missing. */
export function setSplashProgress(p: number, doc: Document = document): void {
  const bar = doc.getElementById(SPLASH_BAR_ID);
  if (bar === null) return;
  bar.style.width = splashWidth(p);
}

/** True when the UI root has data-reduced-motion="on" or the OS asks for reduced motion. */
export function splashReducedMotion(doc: Document = document, win: Window = window): boolean {
  const root = doc.getElementById(UI_ROOT_ID);
  if (root?.dataset.reducedMotion === ON) return true;
  return win.matchMedia?.(REDUCED_MOTION_QUERY)?.matches === true;
}

/**
 * Hides the splash once. Reduced motion removes it at once; otherwise it fades (is-hiding) and is
 * removed after fadeMs. A missing splash and repeat calls do nothing.
 */
export function hideSplash(o: HideSplashOptions): void {
  const doc = o.doc ?? document;
  const el = doc.getElementById(SPLASH_ID);
  if (el === null || el.dataset.hiding === ON) return;
  el.dataset.hiding = ON;
  const win = doc.defaultView;
  if (o.reducedMotion || win === null) {
    el.remove();
    return;
  }
  el.classList.add(HIDING_CLASS);
  win.setTimeout(() => {
    el.remove();
  }, o.fadeMs ?? SPLASH.fadeMs);
}

/** True when this browser can observe 'mark' entries (PerformanceObserver with the mark type). */
function canObserveMarks(): boolean {
  if (typeof PerformanceObserver === 'undefined') return false;
  return PerformanceObserver.supportedEntryTypes?.includes('mark') === true;
}

/**
 * Calls cb exactly once: at once when the first-frame mark already exists, else when the mark observer or a
 * per-frame poll sees it, else at maxWaitMs. The returned disposer stops the wait (disconnects the observer,
 * clears the timer, cancels the pending frame) and cb never runs after it.
 */
export function onFirstFrame(cb: () => void, o: FirstFrameOptions = {}): () => void {
  const markName = o.markName ?? SPLASH.firstFrameMark;
  const maxWaitMs = o.maxWaitMs ?? SPLASH.maxWaitMs;
  let settled = false;
  let observer: PerformanceObserver | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let raf: number | null = null;

  const release = (): void => {
    observer?.disconnect();
    observer = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = null;
  };

  const dispose = (): void => {
    settled = true;
    release();
  };

  const fire = (): void => {
    if (settled) return;
    settled = true;
    release();
    cb();
  };

  // One check per animation frame: the observer callback lags the mark by a task or more, the frame poll does not.
  const poll = (): void => {
    raf = null;
    if (settled) return;
    if (performance.getEntriesByName(markName).length > 0) {
      fire();
      return;
    }
    raf = requestAnimationFrame(poll);
  };

  if (performance.getEntriesByName(markName).length > 0) {
    fire();
    return dispose;
  }

  if (canObserveMarks()) {
    try {
      observer = new PerformanceObserver((list) => {
        if (list.getEntriesByName(markName).length > 0) fire();
      });
      observer.observe({ type: 'mark', buffered: true });
    } catch {
      // The observer is only a fast path; the frame poll and the timeout below still settle the wait.
      observer = null;
    }
  }

  if (!settled && typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
    raf = requestAnimationFrame(poll);
  }

  timer = setTimeout(fire, maxWaitMs);
  return dispose;
}

/** Hides the splash on the first rendered frame (or after the max wait). Registers once per page. */
export function watchSplash(): void {
  if (watching) return;
  watching = true;
  onFirstFrame(() => {
    hideSplash({ reducedMotion: splashReducedMotion() });
  });
}
