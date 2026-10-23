import { describe, it, expect, vi, afterEach } from 'vitest';
import { SPLASH } from '../data/shell';
import { hideSplash, onFirstFrame, setSplashProgress, splashReducedMotion, splashWidth } from './splash';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('splashWidth', () => {
  it.each([
    [0, '0%'],
    [0.4567, '45.7%'],
    [1.2, '100%'],
    [-3, '0%'],
    [NaN, '0%'],
    [1, '100%'],
    [0.5, '50%'],
  ])('progress %s -> %s', (p, expected) => {
    expect(splashWidth(p)).toBe(expected);
  });
});

interface FakeEl {
  dataset: Record<string, string | undefined>;
  classes: Set<string>;
  classList: { add(name: string): void };
  style: { width: string };
  removed: boolean;
  remove(): void;
}

function fakeEl(): FakeEl {
  const classes = new Set<string>();
  const el: FakeEl = {
    dataset: {},
    classes,
    classList: {
      add: (name: string): void => {
        classes.add(name);
      },
    },
    style: { width: '' },
    removed: false,
    remove(): void {
      el.removed = true;
    },
  };
  return el;
}

function fakeDoc(els: Record<string, FakeEl>, view: unknown = globalThis): Document {
  return {
    getElementById: (id: string): FakeEl | null => els[id] ?? null,
    defaultView: view,
  } as unknown as Document;
}

describe('setSplashProgress', () => {
  it('sets the bar width and ignores a missing bar', () => {
    const bar = fakeEl();
    setSplashProgress(0.25, fakeDoc({ 'splash-bar': bar }));
    expect(bar.style.width).toBe('25%');
    expect(() => setSplashProgress(0.5, fakeDoc({}))).not.toThrow();
  });
});

describe('splashReducedMotion', () => {
  const win = (matches: boolean): Window =>
    ({ matchMedia: (): { matches: boolean } => ({ matches }) }) as unknown as Window;

  it('is true when the UI root opts in, even if the OS is silent', () => {
    const root = fakeEl();
    root.dataset.reducedMotion = 'on';
    expect(splashReducedMotion(fakeDoc({ 'ui-root': root }), win(false))).toBe(true);
  });

  it('follows the OS query when the UI root does not opt in', () => {
    const root = fakeEl();
    root.dataset.reducedMotion = 'off';
    expect(splashReducedMotion(fakeDoc({ 'ui-root': root }), win(true))).toBe(true);
    expect(splashReducedMotion(fakeDoc({ 'ui-root': root }), win(false))).toBe(false);
  });

  it('is false without a UI root and without matchMedia', () => {
    expect(splashReducedMotion(fakeDoc({}), win(false))).toBe(false);
    expect(splashReducedMotion(fakeDoc({}), {} as Window)).toBe(false);
  });
});

describe('hideSplash', () => {
  it('removes the splash at once with reduced motion', () => {
    const el = fakeEl();
    hideSplash({ reducedMotion: true, doc: fakeDoc({ splash: el }) });
    expect(el.removed).toBe(true);
    expect(el.classes.has('is-hiding')).toBe(false);
  });

  it('fades (is-hiding) and removes after the given fade time', () => {
    vi.useFakeTimers();
    const el = fakeEl();
    hideSplash({ reducedMotion: false, doc: fakeDoc({ splash: el }), fadeMs: 300 });
    expect(el.classes.has('is-hiding')).toBe(true);
    vi.advanceTimersByTime(299);
    expect(el.removed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(el.removed).toBe(true);
  });

  it('defaults the fade time to SPLASH.fadeMs', () => {
    vi.useFakeTimers();
    const el = fakeEl();
    hideSplash({ reducedMotion: false, doc: fakeDoc({ splash: el }) });
    vi.advanceTimersByTime(SPLASH.fadeMs);
    expect(el.removed).toBe(true);
  });

  it('is idempotent: a second call schedules nothing', () => {
    vi.useFakeTimers();
    const el = fakeEl();
    const doc = fakeDoc({ splash: el });
    hideSplash({ reducedMotion: false, doc });
    hideSplash({ reducedMotion: false, doc });
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(SPLASH.fadeMs);
    expect(el.removed).toBe(true);
  });

  it('does nothing without a splash element', () => {
    expect(() => hideSplash({ reducedMotion: false, doc: fakeDoc({}) })).not.toThrow();
    expect(() => hideSplash({ reducedMotion: true, doc: fakeDoc({}) })).not.toThrow();
  });
});

class FakeObserver {
  static readonly supportedEntryTypes: string[] = ['mark'];
  static live: FakeObserver[] = [];
  disconnected = false;
  observed: unknown = null;
  private readonly onEntries: (list: { getEntriesByName(name: string): unknown[] }) => void;

  constructor(onEntries: (list: { getEntriesByName(name: string): unknown[] }) => void) {
    this.onEntries = onEntries;
    FakeObserver.live.push(this);
  }

  observe(init: unknown): void {
    this.observed = init;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  emit(name: string): void {
    this.onEntries({ getEntriesByName: (n: string): unknown[] => (n === name ? [{}] : []) });
  }
}

function stubMarks(marks: string[]): void {
  vi.stubGlobal('performance', {
    getEntriesByName: (name: string): unknown[] => (marks.includes(name) ? [{}] : []),
  });
}

function lastObserver(): FakeObserver {
  const obs = FakeObserver.live[FakeObserver.live.length - 1];
  if (obs === undefined) throw new Error('no observer created');
  return obs;
}

interface FrameStub {
  pending: Map<number, FrameRequestCallback>;
  cancelled: number[];
  /** Runs the oldest queued frame. False when no frame is queued. */
  runFrame(): boolean;
}

function stubFrames(): FrameStub {
  const pending = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  let nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = nextId;
    nextId += 1;
    pending.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    cancelled.push(id);
    pending.delete(id);
  });
  return {
    pending,
    cancelled,
    runFrame(): boolean {
      const next = pending.entries().next();
      if (next.done === true) return false;
      const [id, cb] = next.value;
      pending.delete(id);
      cb(0);
      return true;
    },
  };
}

describe('onFirstFrame', () => {
  it('calls at once when the mark already exists', () => {
    stubMarks([SPLASH.firstFrameMark]);
    const cb = vi.fn();
    onFirstFrame(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('honours a custom mark name', () => {
    stubMarks(['custom-mark']);
    const cb = vi.fn();
    onFirstFrame(cb, { markName: 'custom-mark' });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('waits for the mark through an observer, then calls once and disconnects', () => {
    vi.useFakeTimers();
    stubMarks([]);
    FakeObserver.live = [];
    vi.stubGlobal('PerformanceObserver', FakeObserver);
    const cb = vi.fn();
    onFirstFrame(cb);
    expect(cb).not.toHaveBeenCalled();
    const obs = lastObserver();
    expect(obs.observed).toEqual({ type: 'mark', buffered: true });
    obs.emit('some-other-mark');
    expect(cb).not.toHaveBeenCalled();
    obs.emit(SPLASH.firstFrameMark);
    obs.emit(SPLASH.firstFrameMark);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(obs.disconnected).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('calls at the max wait when the mark never arrives', () => {
    vi.useFakeTimers();
    stubMarks([]);
    FakeObserver.live = [];
    vi.stubGlobal('PerformanceObserver', FakeObserver);
    const cb = vi.fn();
    onFirstFrame(cb, { maxWaitMs: 500 });
    vi.advanceTimersByTime(499);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(lastObserver().disconnected).toBe(true);
  });

  it('falls back to the timeout where mark observation is unavailable', () => {
    vi.useFakeTimers();
    stubMarks([]);
    vi.stubGlobal('PerformanceObserver', undefined);
    const cb = vi.fn();
    onFirstFrame(cb, { maxWaitMs: 500 });
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('the disposer stops the wait and cb never runs afterwards', () => {
    vi.useFakeTimers();
    stubMarks([]);
    FakeObserver.live = [];
    vi.stubGlobal('PerformanceObserver', FakeObserver);
    const cb = vi.fn();
    const dispose = onFirstFrame(cb, { maxWaitMs: 500 });
    const obs = lastObserver();
    dispose();
    expect(obs.disconnected).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    obs.emit(SPLASH.firstFrameMark);
    vi.advanceTimersByTime(1000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('polls the mark once per animation frame and fires once when it appears', () => {
    vi.useFakeTimers();
    const marks: string[] = [];
    stubMarks(marks);
    vi.stubGlobal('PerformanceObserver', undefined);
    const frames = stubFrames();
    const cb = vi.fn();
    onFirstFrame(cb);
    expect(cb).not.toHaveBeenCalled();
    expect(frames.pending.size).toBe(1);
    expect(frames.runFrame()).toBe(true);
    expect(cb).not.toHaveBeenCalled();
    expect(frames.pending.size).toBe(1);
    marks.push(SPLASH.firstFrameMark);
    expect(frames.runFrame()).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(frames.pending.size).toBe(0);
    expect(frames.runFrame()).toBe(false);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dispose cancels the pending frame', () => {
    vi.useFakeTimers();
    const marks: string[] = [];
    stubMarks(marks);
    vi.stubGlobal('PerformanceObserver', undefined);
    const frames = stubFrames();
    const cb = vi.fn();
    const dispose = onFirstFrame(cb);
    expect(frames.pending.size).toBe(1);
    const pendingId = [...frames.pending.keys()][0];
    dispose();
    expect(frames.cancelled).toEqual([pendingId]);
    expect(frames.pending.size).toBe(0);
    marks.push(SPLASH.firstFrameMark);
    expect(frames.runFrame()).toBe(false);
    expect(cb).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('observer and poll together still fire once', () => {
    vi.useFakeTimers();
    const marks: string[] = [];
    stubMarks(marks);
    FakeObserver.live = [];
    vi.stubGlobal('PerformanceObserver', FakeObserver);
    const frames = stubFrames();

    // Observer first: the entry settles the wait, the pending frame is cancelled and nothing runs later.
    const cb = vi.fn();
    onFirstFrame(cb);
    lastObserver().emit(SPLASH.firstFrameMark);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(lastObserver().disconnected).toBe(true);
    expect(frames.pending.size).toBe(0);
    expect(frames.runFrame()).toBe(false);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    // Poll first: the next frame sees the mark, then a late observer entry is ignored.
    const lateCb = vi.fn();
    onFirstFrame(lateCb, { markName: 'late-mark' });
    expect(frames.pending.size).toBe(1);
    marks.push('late-mark');
    expect(frames.runFrame()).toBe(true);
    expect(lateCb).toHaveBeenCalledTimes(1);
    lastObserver().emit('late-mark');
    expect(lateCb).toHaveBeenCalledTimes(1);
    expect(frames.pending.size).toBe(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
