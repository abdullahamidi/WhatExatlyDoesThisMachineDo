// World visual state (WP23a): one pure derivation from the tech levels, lifetime EE, cycle, motor retrofit tier and ending phase to
// everything the living-world renderers draw (era row and cast alpha, playback mode, prop states, dog pose, Sensor 7 LED, hole
// stage, tally marks). Why: the cast and props renderers read one tested rule instead of their own copies of the era, tech and tier
// gates (DENIZEN_ART §5, STORY_BIBLE §4.1, WP23 A2, A10, A11). Numbers come from src/data/livingWorld.ts.
// Pure: no Phaser, no DOM. Inputs are never mutated.
import type { EndingPhase, TechId } from '../../data/types';
import { LIVING_WORLD, WORLD_ERA_ROW, WORLD_HOLE, WORLD_MARKS, WORLD_PLACEMENTS } from '../../data/livingWorld';
import { currentEra } from '../../simulation/progression/era';
import { castAlpha, playbackMode, shadowScale } from './worldPlayback';
import type { PlaybackMode } from './worldPlayback';

export interface WorldStateInput {
  levels: Readonly<Record<TechId, number>>;
  lifetimeEe: number;
  cycle: number;
  edition: 'full' | 'demo';
  dogLies: boolean;
  motorRetrofitTier: number;
  phase: EndingPhase;
  maxEra?: number;
}

export interface WorldVisualState {
  visible: boolean;
  era: 1 | 2;
  eraRow: number;
  alpha: number;
  shadowScale: number;
  mode: PlaybackMode;
  seam: boolean;
  dogPose: 'loop' | 'dig' | 'lie';
  props: {
    girlWindow: 'flicker' | 'dark';
    girlMini: boolean;
    windows: 'off' | 'dim' | 'lit';   // skyline windows: dim while only the generator is owned, lit with powerLines
    lamp: 'dead' | 'lit';
    lampGlow: boolean;
    boothLit: boolean;
    motes: boolean;
    stakeChain: boolean;
    holeStage: number;
    scraps: number;
    marks: number;
  };
  sensor: { led: 'red' | 'amber'; readout: 'dash' | 'one' };
}

// Scraps on the street: the placed x positions of the era I framing (DENIZEN_ART §5, "3 scraps").
const SCRAP_COUNT: number = WORLD_PLACEMENTS.e1.scraps?.xs?.length ?? 0;

// Owned = a finite level >= 1 (the same test as currentEra).
function owned(levels: Readonly<Record<TechId, number>>, tech: TechId): boolean {
  const level = levels[tech];
  return Number.isFinite(level) && level >= 1;
}

// Hole stage (bible §10): none before the load-beneath EE; then motorRetrofit tier - tierOffset, kept in minStage..maxStage.
// NaN EE means no hole; a non-finite tier counts as 0.
function holeStageOf(lifetimeEe: number, tier: number): number {
  if (!(lifetimeEe >= WORLD_HOLE.loadBeneathEe)) return 0;
  const t = Number.isFinite(tier) ? Math.floor(tier) : 0;
  return Math.min(WORLD_HOLE.maxStage, Math.max(WORLD_HOLE.minStage, t - WORLD_HOLE.tierOffset));
}

// Tally marks on the booth pane (DENIZEN_ART §5): base plus cycle. A non-finite or negative cycle counts as 0.
function marksOf(cycle: number): number {
  const c = Number.isFinite(cycle) ? Math.max(0, Math.floor(cycle)) : 0;
  return WORLD_MARKS.base + c;
}

/**
 * Visual state of the living world for one frame of inputs. Era I and II rules come from the owned keystone techs
 * (generator opens era II and dims the windows; powerLines lights the lamp, booth and windows). The layer is visible only
 * in eras up to maxEra and with no
 * ending phase running; the figures of later eras are derived but hidden by the caller (A11).
 */
export function deriveWorldState(i: WorldStateInput): WorldVisualState {
  const eraNow = currentEra(i.levels);
  const generator = owned(i.levels, 'generator');
  const powerLines = owned(i.levels, 'powerLines');
  const holeStage = holeStageOf(i.lifetimeEe, i.motorRetrofitTier);
  const era: 1 | 2 = eraNow >= 2 ? 2 : 1;
  const dogPose: 'loop' | 'dig' | 'lie' = i.dogLies ? 'lie' : holeStage > 0 ? 'dig' : 'loop';
  return {
    visible: eraNow <= (i.maxEra ?? LIVING_WORLD.maxEra) && i.phase === 'none',
    era,
    eraRow: WORLD_ERA_ROW[era],
    alpha: castAlpha(i.levels, eraNow),
    shadowScale: shadowScale(eraNow),
    mode: playbackMode(i.levels, eraNow),
    seam: true,
    dogPose,
    props: {
      girlWindow: generator ? 'dark' : 'flicker',
      girlMini: generator,
      windows: powerLines ? 'lit' : generator ? 'dim' : 'off',
      lamp: powerLines ? 'lit' : 'dead',
      lampGlow: powerLines,
      boothLit: powerLines,
      motes: generator,
      stakeChain: true,
      holeStage,
      scraps: SCRAP_COUNT,
      marks: marksOf(i.cycle),
    },
    sensor: { led: generator ? 'amber' : 'red', readout: 'dash' },
  };
}
