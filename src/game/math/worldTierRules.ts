// World tier coupling (WP23a): the TierPort seam, the stub that stands in until X1, and the tier tracker that turns part tier
// events into world effects (ripple, lamp flicker, Inspector tick, Sensor 7 blink, dog offers, heartbeat, ear flick).
// Why: WP22 owns the tier maths. The living world needs only "what should the world do now", so the tiers sit behind TierPort
// (D8) and X1 can bind the real ones without touching the director or the cast. The rules are table-tested here.
// Pure: no Phaser, no DOM. Event types are type-only imports from game/context; numbers and tier props come from
// src/data/livingWorld (WORLD_VOICE_CONFIG, WORLD_TIER_PROPS). Times are ms on the World scene clock.
import type { TechId } from '../../data/types';
import type { WorldOffer } from '../../data/livingWorld';
import { WORLD_TIER_PROPS, WORLD_VOICE_CONFIG } from '../../data/livingWorld';
import type { PartEvolvedEvent, PartTorquedEvent } from '../context';

/** Tier reads the world needs from WP22 (D8). levels is the per-tech level record of the session. */
export interface TierPort {
  tierOf(techId: TechId, levels: Readonly<Record<TechId, number>>): number;
  topTier(techId: TechId): number;
  anyTop(levels: Readonly<Record<TechId, number>>): boolean;
  heartbeatLow(nowMs: number): boolean;
}

/** WP23a stub until X1: every part sits at tier 1, none is at top, the Sensor 7 LED is never low. */
export const STUB_TIER_PORT: TierPort = {
  tierOf: () => 1,
  topTier: () => 5,
  anyTop: () => false,
  heartbeatLow: () => false,
};

/**
 * What one tier event asks of the world. One-shot flags are true only for the event that asks for them:
 * ripple (subject to the 4 s gap), lampFlicker, sheetTick, sensorBlink. heartbeat is state, not a one-shot:
 * it mirrors TierTracker.heartbeat() after the event (true once the first top tier of the cycle was seen).
 */
export interface TierEffects {
  ripple: boolean;
  lampFlicker: boolean;
  sheetTick: boolean;
  sensorBlink: boolean;
  offers: WorldOffer[];
  heartbeat: boolean;
}

export interface TierTracker {
  onEvolved(e: PartEvolvedEvent, nowMs: number): TierEffects;
  onTorqued(e: PartTorquedEvent, nowMs: number): { earFlick: boolean };
  onIndexClose(levels: Readonly<Record<TechId, number>>, nowMs: number): TierEffects;
  heartbeat(): boolean;
  reset(): void;
}

/** The tracker reads only the two gaps it enforces. Tests may shorten them. */
export interface TierTrackerConfig { rippleOutsideGapMs: number; earFlickGapMs: number }

const LAMP_TECHS: readonly TechId[] = WORLD_TIER_PROPS.lampFlickerTechs;
const DOG_LINE = WORLD_TIER_PROPS.dogLine;

/**
 * Tracks the tier state of one cycle. The first top tier (INS-13) is offered once per cycle, from either a partEvolved
 * event or a TECH INDEX close (WP22 over-cap instant swaps emit no event, so the close re-checks anyTop). The dog line
 * (DOG-04, improvedPistons tier 3) gets the same two chances, once per cycle. The scheduler keeps ONE pending tier entry (a
 * newer tier offer replaces the older one), so each event or close offers at most one tier line, INS-13 first; a dog line that
 * loses the slot stays unclaimed, and the next close offers it. reset() starts a new cycle and clears the gaps. Nothing here
 * reads the clock except through the nowMs arguments.
 */
export function createTierTracker(port: TierPort, cfg: TierTrackerConfig = WORLD_VOICE_CONFIG): TierTracker {
  let lastRippleMs: number | null = null;
  let lastEarFlickMs: number | null = null;
  let firstTopSeen = false;
  let dogOffered = false;

  // Claims the once-per-cycle first top tier. Returns the offer when it was not yet seen, else null.
  function claimFirstTop(): WorldOffer | null {
    if (firstTopSeen) return null;
    firstTopSeen = true;
    return { kind: 'tier', firstTop: true };
  }

  // Claims the once-per-cycle dog line. Returns the offer when it was not yet offered, else null.
  function claimDog(): WorldOffer | null {
    if (dogOffered) return null;
    dogOffered = true;
    return { kind: 'tier', techId: DOG_LINE.techId, tier: DOG_LINE.tier };
  }

  return {
    onEvolved(e, nowMs) {
      const ripple = lastRippleMs === null || nowMs - lastRippleMs >= cfg.rippleOutsideGapMs;
      if (ripple) lastRippleMs = nowMs;

      // One tier offer per event, INS-13 first. The dog line is claimed only when it is the offer; a crossing that loses the slot
      // stays unclaimed for the next close.
      let offer: WorldOffer | null = e.toTier === e.topTier ? claimFirstTop() : null;
      if (offer === null && e.techId === DOG_LINE.techId && e.fromTier < DOG_LINE.tier && e.toTier >= DOG_LINE.tier) offer = claimDog();

      return {
        ripple,
        lampFlicker: LAMP_TECHS.includes(e.techId),
        sheetTick: true,
        sensorBlink: true,
        offers: offer === null ? [] : [offer],
        heartbeat: firstTopSeen,
      };
    },

    onTorqued(_e, nowMs) {
      const earFlick = lastEarFlickMs === null || nowMs - lastEarFlickMs >= cfg.earFlickGapMs;
      if (earFlick) lastEarFlickMs = nowMs;
      return { earFlick };
    },

    onIndexClose(levels) {
      // One tier offer per close, INS-13 first. WP22 moves a part to tier 3 with no partEvolved event (over-cap swaps), so the dog
      // line can become eligible here too; a close that offers INS-13 leaves the dog line for the next close.
      const first = port.anyTop(levels) ? claimFirstTop() : null;
      const dog = first === null && port.tierOf(DOG_LINE.techId, levels) >= DOG_LINE.tier ? claimDog() : null;
      const offer = first ?? dog;
      return {
        ripple: false,
        lampFlicker: false,
        sheetTick: false,
        sensorBlink: false,
        offers: offer === null ? [] : [offer],
        heartbeat: firstTopSeen,
      };
    },

    heartbeat() {
      return firstTopSeen;
    },

    reset() {
      firstTopSeen = false;
      dogOffered = false;
      lastRippleMs = null;
      lastEarFlickMs = null;
    },
  };
}
