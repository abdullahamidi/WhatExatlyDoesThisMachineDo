import { FINALE_CHOICE } from '../data/finale';

// Hook behind BEGIN A NEW CYCLE (finale overlay and system menu). WP13 ships the stub below; WP14 swaps it
// in bootstrap.ts for the real implementation (Echoes, reset, wasteland return, CYCLE 0043 transition).

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
