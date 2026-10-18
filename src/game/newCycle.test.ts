import { describe, it, expect, vi } from 'vitest';
import { createNewCycleController, createNewCycleStub } from './newCycle';
import type { CyclePort, NewCycleControllerDeps } from './newCycle';
import { FINALE_CHOICE } from '../data/finale';
import { PRESTIGE_TEXT } from '../data/prestige';
import type { EndingPhase, EndingState, GameState, PrestigeState, SettingsState } from '../data/types';
import { DEFAULT_SETTINGS, createInitialState } from '../simulation/state';
import { DEFAULT_PRESTIGE } from '../simulation/prestige';
import type { CyclePreview } from '../simulation/prestige';

describe('createNewCycleStub', () => {
  it('is blocked with the data reason', () => {
    const hook = createNewCycleStub();
    expect(hook.blockedReason()).toBe(FINALE_CHOICE.cycleStubReason);
    expect(hook.blockedReason()).toBe('Cycle 0043 is still calibrating.');
  });

  it('begin is a no-op: nothing throws, the block stays', () => {
    const hook = createNewCycleStub();
    expect(() => hook.begin()).not.toThrow();
    expect(() => hook.begin()).not.toThrow();
    expect(hook.blockedReason()).toBe(FINALE_CHOICE.cycleStubReason);
  });

  it('each call returns an independent hook with the same behaviour', () => {
    const a = createNewCycleStub();
    const b = createNewCycleStub();
    expect(a).not.toBe(b);
    expect(b.blockedReason()).toBe(a.blockedReason());
  });
});

// Fakes for the WP14 controller: a session stub that records beginNewCycle calls, plus deps that record every call.
function fakeSession(phase: EndingPhase, settings: Partial<SettingsState> = {}, prestige: PrestigeState = DEFAULT_PRESTIGE) {
  const state: GameState = { ...createInitialState(0), ending: { phase, engagedAt: 0 } };
  const session = {
    state,
    prestige,
    settings: { ...DEFAULT_SETTINGS, confirmNewCycle: true, ...settings },
    beginNewCycle: vi.fn((_now?: number): boolean => true),
  };
  return session satisfies CyclePort & { beginNewCycle: ReturnType<typeof vi.fn> };
}

interface Harness {
  session: ReturnType<typeof fakeSession>;
  confirm: ReturnType<typeof vi.fn>;
  playTransition: ReturnType<typeof vi.fn>;
  closeDialogs: ReturnType<typeof vi.fn>;
  deps: NewCycleControllerDeps;
}

function harness(phase: EndingPhase, settings: Partial<SettingsState> = {}): Harness {
  const session = fakeSession(phase, settings);
  const confirm = vi.fn((_p: CyclePreview, _onConfirm: () => void): void => undefined);
  // Default transition: a scene that peaks and ends at once (sync path).
  const playTransition = vi.fn((onPeak: () => void, onDone: () => void): void => {
    onPeak();
    onDone();
  });
  const closeDialogs = vi.fn((): void => undefined);
  const deps: NewCycleControllerDeps = { session, now: () => 12345, confirm, playTransition, closeDialogs };
  return { session, confirm, playTransition, closeDialogs, deps };
}

describe('createNewCycleController blockedReason', () => {
  it('is the blocked text before the reveal', () => {
    const h = harness('sequence');
    expect(createNewCycleController(h.deps).blockedReason()).toBe(PRESTIGE_TEXT.blocked);
    expect(createNewCycleController(harness('none').deps).blockedReason()).toBe(PRESTIGE_TEXT.blocked);
  });

  it('is null once the run is revealed (choice or postgame)', () => {
    expect(createNewCycleController(harness('choice').deps).blockedReason()).toBeNull();
    expect(createNewCycleController(harness('postgame').deps).blockedReason()).toBeNull();
  });

  it('is the busy text while a transition runs, whatever the reveal', () => {
    const h = harness('choice', { confirmNewCycle: false });
    const pending = vi.fn((_onPeak: () => void, _onDone: () => void): void => undefined);
    const ctrl = createNewCycleController({ ...h.deps, playTransition: pending });
    ctrl.begin();
    expect(ctrl.isBusy()).toBe(true);
    expect(ctrl.blockedReason()).toBe(PRESTIGE_TEXT.busy);
  });

  it('preview() reports allowed = revealed and the next cycle label', () => {
    const revealed = createNewCycleController(harness('choice').deps).preview();
    expect(revealed.allowed).toBe(true);
    expect(revealed.nextCycle).toBe(2);
    expect(revealed.label).toBe('CYCLE 0043');
    expect(createNewCycleController(harness('sequence').deps).preview().allowed).toBe(false);
  });
});

describe('createNewCycleController begin', () => {
  it('blocked begin is a no-op: no dialog, no transition, no beginNewCycle', () => {
    const h = harness('sequence');
    const ctrl = createNewCycleController(h.deps);
    ctrl.begin();
    expect(h.confirm).not.toHaveBeenCalled();
    expect(h.playTransition).not.toHaveBeenCalled();
    expect(h.closeDialogs).not.toHaveBeenCalled();
    expect(h.session.beginNewCycle).not.toHaveBeenCalled();
    expect(ctrl.isBusy()).toBe(false);
  });

  it('confirm ON: opens the confirm dialog with the preview and starts nothing yet', () => {
    const h = harness('choice', { confirmNewCycle: true });
    createNewCycleController(h.deps).begin();
    expect(h.confirm).toHaveBeenCalledTimes(1);
    const [preview] = h.confirm.mock.calls[0] ?? [];
    expect(preview).toMatchObject({ allowed: true, nextCycle: 2, echoesGained: 3 });
    expect(h.playTransition).not.toHaveBeenCalled();
    expect(h.closeDialogs).not.toHaveBeenCalled();
    expect(h.session.beginNewCycle).not.toHaveBeenCalled();
  });

  it('confirm ON: the confirmed commit runs the transition and begins the cycle once', () => {
    const h = harness('choice', { confirmNewCycle: true });
    createNewCycleController(h.deps).begin();
    const onConfirm = h.confirm.mock.calls[0]?.[1] as () => void;
    onConfirm();
    expect(h.closeDialogs).toHaveBeenCalledTimes(1);
    expect(h.playTransition).toHaveBeenCalledTimes(1);
    expect(h.session.beginNewCycle).toHaveBeenCalledTimes(1);
    expect(h.session.beginNewCycle).toHaveBeenCalledWith(12345);
  });

  it('confirm OFF: the transition starts at once, no dialog', () => {
    const h = harness('choice', { confirmNewCycle: false });
    createNewCycleController(h.deps).begin();
    expect(h.confirm).not.toHaveBeenCalled();
    expect(h.closeDialogs).toHaveBeenCalledTimes(1);
    expect(h.playTransition).toHaveBeenCalledTimes(1);
    expect(h.session.beginNewCycle).toHaveBeenCalledTimes(1);
  });

  it('closes dialogs before the transition starts', () => {
    const order: string[] = [];
    const h = harness('choice', { confirmNewCycle: false });
    const ctrl = createNewCycleController({
      ...h.deps,
      closeDialogs: () => order.push('close'),
      playTransition: (onPeak, onDone) => {
        order.push('play');
        onPeak();
        onDone();
      },
    });
    ctrl.begin();
    expect(order).toEqual(['close', 'play']);
  });
});

describe('createNewCycleController commit', () => {
  it('a commit while busy is ignored (second confirm and second begin)', () => {
    const h = harness('choice', { confirmNewCycle: true });
    let pendingPeak: (() => void) | null = null;
    let pendingDone: (() => void) | null = null;
    const transition = vi.fn((onPeak: () => void, onDone: () => void): void => {
      pendingPeak = onPeak;
      pendingDone = onDone;
    });
    const ctrl = createNewCycleController({ ...h.deps, playTransition: transition });
    ctrl.begin();
    const onConfirm = h.confirm.mock.calls[0]?.[1] as () => void;
    onConfirm();
    onConfirm();
    ctrl.begin();
    expect(transition).toHaveBeenCalledTimes(1);
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(ctrl.isBusy()).toBe(true);
    (pendingPeak as (() => void) | null)?.();
    (pendingDone as (() => void) | null)?.();
    expect(h.session.beginNewCycle).toHaveBeenCalledTimes(1);
  });

  it('onPeak calls beginNewCycle exactly once, even when the renderer repeats it', () => {
    const h = harness('choice', { confirmNewCycle: false });
    const ctrl = createNewCycleController({
      ...h.deps,
      playTransition: (onPeak, onDone) => {
        onPeak();
        onPeak();
        onPeak();
        onDone();
      },
    });
    ctrl.begin();
    expect(h.session.beginNewCycle).toHaveBeenCalledTimes(1);
  });

  it('busy is set during the transition and cleared on done', () => {
    const h = harness('choice', { confirmNewCycle: false });
    let done: (() => void) | null = null;
    const ctrl = createNewCycleController({
      ...h.deps,
      playTransition: (_onPeak, onDone) => {
        done = onDone;
      },
    });
    ctrl.begin();
    expect(ctrl.isBusy()).toBe(true);
    (done as (() => void) | null)?.();
    expect(ctrl.isBusy()).toBe(false);
    expect(ctrl.blockedReason()).toBeNull();
  });

  it('no-scene sync path: onPeak then onDone run immediately, cycle begins, busy is clear again', () => {
    const h = harness('choice', { confirmNewCycle: false });
    const ctrl = createNewCycleController(h.deps);
    ctrl.begin();
    expect(h.session.beginNewCycle).toHaveBeenCalledTimes(1);
    expect(ctrl.isBusy()).toBe(false);
  });

  it('a transition that ends without its peak still begins the cycle exactly once', () => {
    const h = harness('choice', { confirmNewCycle: false });
    const ctrl = createNewCycleController({
      ...h.deps,
      playTransition: (_onPeak, onDone) => {
        onDone();
        onDone();
      },
    });
    ctrl.begin();
    expect(h.session.beginNewCycle).toHaveBeenCalledTimes(1);
    expect(ctrl.isBusy()).toBe(false);
  });

  it('a commit after the block appeared (not revealed in between) does nothing', () => {
    const h = harness('choice', { confirmNewCycle: true });
    const ctrl = createNewCycleController(h.deps);
    ctrl.begin();
    const onConfirm = h.confirm.mock.calls[0]?.[1] as () => void;
    // Simulate a session that lost its reveal while the dialog was open.
    const lost: EndingState = { phase: 'sequence', engagedAt: 0 };
    h.session.state.ending = lost;
    onConfirm();
    expect(h.playTransition).not.toHaveBeenCalled();
    expect(h.session.beginNewCycle).not.toHaveBeenCalled();
    expect(ctrl.isBusy()).toBe(false);
  });
});
