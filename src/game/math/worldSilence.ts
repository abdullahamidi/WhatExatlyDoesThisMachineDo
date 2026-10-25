// Hard-silence reason and toast gate (WP23a): which condition keeps a living-world bubble from starting, and whether a toast
// still holds the one narrative surface (D3, D14).
// Why: the director asks one pure question per tick ("why is the world silent?") and reads the reasons in the bible's priority
// order (STORY_BIBLE §7.4), so the order is tested here and not re-derived in the renderer. The Toasts API has no completion
// event, so the toast state is approximated from the configured durations in one table-tested place.
// Pure: no Phaser, no DOM. Reason ids come from src/data/livingWorld (WORLD_SILENCE); durations from src/data/notifications.
import type { WorldSilence } from '../../data/livingWorld';
import { WORLD_SILENCE } from '../../data/livingWorld';
import { TOAST_CONFIG } from '../../data/notifications';

/** One flag per hard-silence condition. The director sets each from the live scene, menus and session state. */
export interface SilenceInputs {
  quiet: boolean;        // debug or store-shot quiet (D4)
  layerHidden: boolean;  // era III+ or a hidden layer (A11)
  asleep: boolean;       // World scene asleep (teaser, menus)
  tabHidden: boolean;    // document hidden
  photo: boolean;        // photo mode
  finaleLocked: boolean; // finale sequence or choice phase (isFinaleLocked)
  cycleBusy: boolean;    // cycle transition running
  teaser: boolean;       // demo teaser on screen
  demoCard: boolean;     // END OF DEMO card up
  techTree: boolean;     // TECH INDEX open
  modal: boolean;        // SYSTEM menu, title, credits or cycle confirm
  eraCard: boolean;      // era card up
  onboarding: boolean;   // crank or schematic prompt visible
}

// Input flag behind each reason. The Record type keeps this table in step with WORLD_SILENCE.
const INPUT_OF: Record<WorldSilence, keyof SilenceInputs> = {
  quiet: 'quiet',
  'layer-hidden': 'layerHidden',
  asleep: 'asleep',
  'tab-hidden': 'tabHidden',
  photo: 'photo',
  finale: 'finaleLocked',
  cycle: 'cycleBusy',
  teaser: 'teaser',
  'demo-card': 'demoCard',
  'tech-index': 'techTree',
  modal: 'modal',
  'era-card': 'eraCard',
  onboarding: 'onboarding',
};

/** First hard-silence reason in WORLD_SILENCE order whose flag is true; null when the world may speak. */
export function silenceReason(i: SilenceInputs): WorldSilence | null {
  for (const reason of WORLD_SILENCE) {
    if (i[INPUT_OF[reason]]) return reason;
  }
  return null;
}

/** Toast gate timings (ms on screen, before the fade). Defaults come from TOAST_CONFIG. */
export interface ToastGateConfig {
  unlockMs: number;
  milestoneMs: number;
  welcomeMs: number;
  fadeMs: number;
}

export const TOAST_GATE_CONFIG: ToastGateConfig = {
  unlockMs: TOAST_CONFIG.durationMs,
  milestoneMs: TOAST_CONFIG.milestoneDurationMs,
  welcomeMs: TOAST_CONFIG.welcomeDurationMs,
  fadeMs: TOAST_CONFIG.fadeMs,
};

export interface ToastGate {
  onUnlock(nowMs: number): void;
  onMilestone(nowMs: number): void;
  onLogShown(nowMs: number): void;
  onLogCleared(nowMs: number): void;
  onWelcome(nowMs: number): void;
  onEraCardClosed(nowMs: number): void;
  /** Wall time that passed while the director clock was stopped (asleep or tab hidden). Finite slots move that much earlier. */
  elapse(ms: number): void;
  /** True while any tracked toast is still on screen at nowMs. */
  up(nowMs: number): boolean;
  /** Latest time a tracked toast leaves the screen; null when none ever showed; Infinity while a SYS LOG is up. */
  clearedAtMs(): number | null;
  reset(): void;
}

// One slot per tracked toast kind. A slot holds the time its toast leaves the screen (null: never shown).
type ToastChannel = 'unlock' | 'milestone' | 'log' | 'welcome' | 'era';
const CHANNELS: readonly ToastChannel[] = ['unlock', 'milestone', 'log', 'welcome', 'era'];

/**
 * Tracks the narrative toast strip from events. Purchase toasts are not tracked (they never block a bubble).
 * Each timed toast ends at now + duration + fade. A SYS LOG is up (Infinity) from onLogShown until onLogCleared,
 * which ends it at that instant. Closing the era card ends it at once.
 */
export function createToastGate(cfg: ToastGateConfig = TOAST_GATE_CONFIG): ToastGate {
  const slots: Record<ToastChannel, number | null> = { unlock: null, milestone: null, log: null, welcome: null, era: null };
  const untilTimed = (ms: number, nowMs: number): number => nowMs + ms + cfg.fadeMs;

  return {
    onUnlock(nowMs) { slots.unlock = untilTimed(cfg.unlockMs, nowMs); },
    onMilestone(nowMs) { slots.milestone = untilTimed(cfg.milestoneMs, nowMs); },
    onLogShown() { slots.log = Infinity; },
    onLogCleared(nowMs) {
      // A clear with no SYS LOG up is ignored, so a spurious call cannot move clearedAtMs.
      if (slots.log === Infinity) slots.log = nowMs;
    },
    onWelcome(nowMs) { slots.welcome = untilTimed(cfg.welcomeMs, nowMs); },
    onEraCardClosed(nowMs) { slots.era = nowMs; },
    // The director clock stops while asleep or hidden, but a toast runs on wall time. Each finite slot moves back by the wall time
    // that passed, so up() and clearedAtMs() read the real end. Null (never shown) and Infinity (SYS LOG up) stay as they are.
    elapse(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return;
      for (const c of CHANNELS) {
        const until = slots[c];
        if (until !== null && Number.isFinite(until)) slots[c] = until - ms;
      }
    },
    up(nowMs) {
      return CHANNELS.some((c) => {
        const until = slots[c];
        return until !== null && until > nowMs;
      });
    },
    clearedAtMs() {
      let latest: number | null = null;
      for (const c of CHANNELS) {
        const until = slots[c];
        if (until !== null && (latest === null || until > latest)) latest = until;
      }
      return latest;
    },
    reset() {
      for (const c of CHANNELS) slots[c] = null;
    },
  };
}
