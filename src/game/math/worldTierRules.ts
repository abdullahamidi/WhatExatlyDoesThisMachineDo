// World tier coupling (WP23a): the TierPort seam, the stub that stands in until X1, and the tier tracker that turns part tier
// events into world effects (ripple, lamp flicker, Inspector tick, Sensor 7 blink, tier offers, heartbeat, ear flick).
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
 * it mirrors TierTracker.heartbeat() after the event (true once a top tier was observed this cycle).
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
// Line ids the tier offers claim by (WORLD_LINES in src/data/livingWorld.ts): a line that is in seen is not offered again.
const FIRST_TOP_LINE = 'INS-13';
const DOG_LINE_ID = 'DOG-04';

/**
 * Tracks the tier state of one cycle. topObserved is set by a partEvolved event that reaches the top tier, or by a TECH INDEX
 * close that sees a part at top (WP22 over-cap instant swaps emit no event, so the close re-checks anyTop); reset() clears it.
 * heartbeat() is topObserved, whatever the offers. Tier offers claim by seen, not by a latch (WP23b follow-up b): every event and
 * every close offers at most ONE tier line, INS-13 first while topObserved and INS-13 is unseen, else DOG-04 while improvedPistons
 * is at tier 3 or more and DOG-04 is unseen. An offer repeats on each later event or close until its line is in seen, so WORLD
 * VOICES OFF or a speaker off screen loses nothing (the scheduler keeps one pending tier entry, so a repeat waits harmlessly).
 * Nothing here reads the clock except through the nowMs arguments.
 */
export function createTierTracker(
  port: TierPort,
  cfg: TierTrackerConfig = WORLD_VOICE_CONFIG,
  isSeen: (id: string) => boolean = () => false,
): TierTracker {
  let lastRippleMs: number | null = null;
  let lastEarFlickMs: number | null = null;
  let topObserved = false;

  // The one tier offer of an event or close: INS-13 first, then DOG-04 when its tier condition holds. Null when neither is due.
  function tierOffer(dogTier: boolean): WorldOffer | null {
    if (topObserved && !isSeen(FIRST_TOP_LINE)) return { kind: 'tier', firstTop: true };
    if (dogTier && !isSeen(DOG_LINE_ID)) return { kind: 'tier', techId: DOG_LINE.techId, tier: DOG_LINE.tier };
    return null;
  }

  return {
    onEvolved(e, nowMs) {
      const ripple = lastRippleMs === null || nowMs - lastRippleMs >= cfg.rippleOutsideGapMs;
      if (ripple) lastRippleMs = nowMs;

      if (e.toTier === e.topTier) topObserved = true;
      const offer = tierOffer(e.techId === DOG_LINE.techId && e.toTier >= DOG_LINE.tier);

      return {
        ripple,
        lampFlicker: LAMP_TECHS.includes(e.techId),
        sheetTick: true,
        sensorBlink: true,
        offers: offer === null ? [] : [offer],
        heartbeat: topObserved,
      };
    },

    onTorqued(_e, nowMs) {
      const earFlick = lastEarFlickMs === null || nowMs - lastEarFlickMs >= cfg.earFlickGapMs;
      if (earFlick) lastEarFlickMs = nowMs;
      return { earFlick };
    },

    onIndexClose(levels) {
      // WP22 moves a part to top or to tier 3 with no partEvolved event (over-cap swaps), so both reads happen on the close.
      if (port.anyTop(levels)) topObserved = true;
      const offer = tierOffer(port.tierOf(DOG_LINE.techId, levels) >= DOG_LINE.tier);
      return {
        ripple: false,
        lampFlicker: false,
        sheetTick: false,
        sensorBlink: false,
        offers: offer === null ? [] : [offer],
        heartbeat: topObserved,
      };
    },

    heartbeat() {
      return topObserved;
    },

    reset() {
      topObserved = false;
      lastRippleMs = null;
      lastEarFlickMs = null;
    },
  };
}
