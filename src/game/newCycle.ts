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
