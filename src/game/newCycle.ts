import { FINALE_CHOICE } from '../data/finale';
import { PRESTIGE_TEXT } from '../data/prestige';
import type { GameState, PrestigeState, SettingsState } from '../data/types';
import { cyclePreview } from '../simulation/prestige';
import type { CyclePreview } from '../simulation/prestige';

// Hook behind BEGIN A NEW CYCLE (finale overlay and system menu). WP13 shipped the stub below (kept for its tests);
// WP14 swaps it in bootstrap.ts for createNewCycleController (Echoes, reset, wasteland return, CYCLE 0043 transition).

export interface NewCycleHook {
  /** null = can begin now; otherwise the short text shown under the disabled button. */
  blockedReason(): string | null;
  /** Starts a new cycle. Callers invoke it only when blockedReason() is null. */
  begin(): void;
}

/** WP13 stub: always blocked with the data reason; begin() does nothing. */
export function createNewCycleStub(): NewCycleHook {
  return {
    blockedReason: () => FINALE_CHOICE.cycleStubReason,
    begin: () => {
      // WP14 implements the cycle transition.
    },
  };
}

/** The slice of GameSession the controller reads and drives (GameSession satisfies it structurally). */
export interface CyclePort {
  readonly state: Readonly<GameState>;
  readonly prestige: Readonly<PrestigeState>;
  readonly settings: Readonly<SettingsState>;
  beginNewCycle(nowMs?: number): boolean;
}

export interface NewCycleControllerDeps {
  session: CyclePort;
  now(): number;
  /** Opens the confirm dialog (DOM). onConfirm runs only when the player presses BEGIN. */
  confirm(preview: CyclePreview, onConfirm: () => void): void;
  /** Runs the transition. onPeak fires once at the white peak; onDone fires once when it ends (sync when no scene). */
  playTransition(onPeak: () => void, onDone: () => void): void;
  /** Closes the tech tree and the system menu before the transition starts. */
  closeDialogs(): void;
}

export interface NewCycleController extends NewCycleHook {
  /** What beginning a new cycle would do right now (pure read of session state and prestige). */
  preview(): CyclePreview;
  /** True from commit until the transition is done. */
  isBusy(): boolean;
}

/**
 * Controller behind BEGIN A NEW CYCLE. blockedReason: busy -> PRESTIGE_TEXT.busy, not revealed -> PRESTIGE_TEXT.blocked,
 * else null. begin: blocked -> no-op; confirmNewCycle ON -> confirm dialog first, OFF -> commit at once.
 * commit: re-checks the block, marks busy, closes dialogs, plays the transition; beginNewCycle runs once at the peak.
 */
export function createNewCycleController(deps: NewCycleControllerDeps): NewCycleController {
  let busy = false;

  const preview = (): CyclePreview => cyclePreview(deps.session.state, deps.session.prestige);

  const blockedReason = (): string | null => {
    if (busy) return PRESTIGE_TEXT.busy;
    return preview().allowed ? null : PRESTIGE_TEXT.blocked;
  };

  const commit = (): void => {
    if (blockedReason() !== null) return;
    busy = true;
    let peaked = false;
    let done = false;
    const onPeak = (): void => {
      if (peaked) return;
      peaked = true;
      deps.session.beginNewCycle(deps.now());
    };
    const onDone = (): void => {
      if (done) return;
      done = true;
      onPeak(); // a transition that ends without its peak still starts the cycle exactly once
      busy = false;
    };
    deps.closeDialogs();
    deps.playTransition(onPeak, onDone);
  };

  return {
    blockedReason,
    begin: () => {
      if (blockedReason() !== null) return;
      if (deps.session.settings.confirmNewCycle) deps.confirm(preview(), commit);
      else commit();
    },
    preview,
    isBusy: () => busy,
  };
}
