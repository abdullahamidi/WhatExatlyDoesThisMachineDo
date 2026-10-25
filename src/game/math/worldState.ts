// World visual state (WP23a, WP23b): one pure derivation from the tech levels, part tiers, lifetime EE and PR, cycle, motor retrofit
// tier, ending phase and observer-one flag to everything the living-world renderers draw: era row and cast alpha, playback mode, prop
// states, dog pose, girl stage, Sensor 7, cycle traces (DENIZEN_ART §5, STORY_BIBLE §4.1 and §9.3, WP23 A2, A10, A11). Why: the cast and
// props renderers read one tested rule instead of their own copies of the era, tech and tier gates. Nothing un-happens: every count only
// rises with the levels. Numbers come from src/data (livingWorld.ts, worldEras.ts).
// Pure: no Phaser, no DOM. Inputs are never mutated.
import type { EndingPhase, TechId } from '../../data/types';
import { LIVING_WORLD, WORLD_ERA_ROW, WORLD_HOLE, WORLD_MARKS, WORLD_PLACEMENTS, WORLD_PLAYBACK, WORLD_SHADOWS } from '../../data/livingWorld';
import type { WorldRow } from '../../data/livingWorld';
import { WORLD_CHLADNI, WORLD_ERA_RULES, WORLD_GIRL, WORLD_LAMP, WORLD_MOTES_BY_ERA, WORLD_PAGES, WORLD_PUDDLE, WORLD_SCRAPS, WORLD_SENSOR,
  WORLD_SPROUT, WORLD_TRACES, WORLD_VENTS, WORLD_VIRGA, WORLD_WINDOWS } from '../../data/worldEras';
import type { StageRule } from '../../data/worldEras';
import { currentEra } from '../../simulation/progression/era';
import { castAlpha, playbackMode, shadowScale } from './worldPlayback';
import type { PlaybackMode } from './worldPlayback';

export type WorldEra = 1 | 2 | 3 | 4 | 5;
export type GirlStageName = 'window' | 'mini' | 'miniNear' | 'ground';
export type DogPose = 'loop' | 'dig' | 'lie' | 'shake' | 'still' | 'roam';
export type MotesMode = 'orbit' | 'freeze' | 'fall';
export type VirgaMode = 'off' | 'fall' | 'frozen' | 'fade';

type TechLevels = Readonly<Record<TechId, number>>;
// Part tiers (condenser, firebox, standingWave): a tech with no entry is at tier 1.
type PartTiers = Readonly<Partial<Record<TechId, number>>>;

export interface WorldStateInput {
  levels: Readonly<Record<TechId, number>>;
  lifetimeEe: number;
  cycle: number;
  edition: 'full' | 'demo';
  dogLies: boolean;
  motorRetrofitTier: number;
  phase: EndingPhase;
  maxEra?: number;
  lifetimePr?: number;          // virga gate, absent = 0
  tiers?: PartTiers;            // part tiers (condenser, firebox, standingWave), absent = tier 1
  observerOne?: boolean;        // the observer-one SYS LOG was shown this cycle (stare, readout 1)
}

export interface WorldVisualState {
  visible: boolean;             // era <= maxEra; the ending phases keep it true (the script draws the film)
  ending: EndingPhase;
  era: WorldEra;
  eraRow: number;               // WORLD_ERA_ROW[era]
  alpha: number;
  shadows: boolean;             // false in era V once horizonField >= 5
  shadowScale: number;          // 0 when !shadows, else 0.5 in era I, 1 after
  mode: PlaybackMode;
  seam: boolean;                // eras I-II only
  reverse: boolean;             // era V, ending none
  stare: boolean;               // = observerOne
  vents: boolean;               // era >= III and reliefValves owned
  dogPose: DogPose;
  girl: { stage: 0 | 1 | 2 | 3; stageName: GirlStageName; row: WorldRow; steps: number };
  props: {
    girlWindow: 'flicker' | 'dark';   // dark once the generator is owned or the girl has left the window (stage > 0); else flicker
    girlMini: boolean;          // stageName mini
    girlMiniNear: boolean;      // stageName miniNear
    windows: 'off' | 'dim' | 'lit';   // skyline windows: dim while only the generator is owned, lit with powerLines and from era III
    windowsLit: number;         // 0..6 lit windows drawn
    windowsBreathe: boolean;    // era IV
    lamp: 'dead' | 'lit' | 'warm';
    lampGlow: boolean;
    lampGlowWarm: boolean;
    lampPulse: boolean;         // era IV with the warm lamp
    boothLit: boolean;
    boothFog: boolean;          // era III with vents
    motes: boolean;
    motesMode: MotesMode;
    stakeChain: boolean;
    holeStage: number;
    scraps: number;
    marks: number;
    puddle: { size: 0 | 1 | 2 | 3; look: 'grey' | 'black' };
    sprout: number;             // 0 none, 1..4
    chladni: 0 | 1 | 2;
    chladniViolet: boolean;     // era V
    pages: boolean;
    virga: VirgaMode;
  };
  sensor: { led: 'red' | 'amber'; readout: 'dash' | 'one'; fog: boolean; pulse: boolean };
  traces: { redBall: boolean; crowHigh: boolean; clipboard: number };   // clipboard 0..3 pages on the board
}

// Scraps on the street: the placed x positions of the era I framing (DENIZEN_ART §5, "3 scraps").
const SCRAP_COUNT: number = WORLD_PLACEMENTS.e1.scraps?.xs?.length ?? 0;

// Stage rule met: the level is finite and >= minLevel (default 1), and the part tier >= minTier (default 0). Absent tier = 1,
// NaN tier = 0 (as a non-finite hole tier counts as 0). Owned = ruleMet on the bare tech (the same test as currentEra).
export function ruleMet(levels: TechLevels, rule: StageRule, tiers?: PartTiers): boolean {
  const level = levels[rule.techId];
  if (!Number.isFinite(level) || level < (rule.minLevel ?? 1)) return false;
  return tierOf(tiers, rule.techId) >= (rule.minTier ?? 0);
}

function tierOf(tiers: PartTiers | undefined, techId: TechId): number {
  const tier = tiers?.[techId];
  if (tier === undefined) return 1;
  return Number.isNaN(tier) ? 0 : tier;
}

function owned(levels: TechLevels, techId: TechId): boolean {
  return ruleMet(levels, { techId });
}

// The first entry of a top-down tier table whose part tier is reached (first match wins); undefined when none is.
function tierEntry<T extends { minTier: number }>(levels: TechLevels, techId: TechId, tiers: PartTiers | undefined,
  table: readonly T[]): T | undefined {
  return table.find((entry) => ruleMet(levels, { techId, minTier: entry.minTier }, tiers));
}

// Girl steps (era V, DENIZEN_ART §5): how many WORLD_GIRL.steps rules are met, 0..5. T10 reads it for the step offset.
export function girlStepsOf(levels: TechLevels): number {
  return WORLD_GIRL.steps.filter((rule) => ruleMet(levels, rule)).length;
}

// Hole stage (bible §10): none before the load-beneath EE; then motorRetrofit tier - tierOffset, kept in minStage..maxStage.
// NaN EE means no hole; a non-finite tier counts as 0.
function holeStageOf(lifetimeEe: number, tier: number): number {
  if (!(lifetimeEe >= WORLD_HOLE.loadBeneathEe)) return 0;
  const t = Number.isFinite(tier) ? Math.floor(tier) : 0;
  return Math.min(WORLD_HOLE.maxStage, Math.max(WORLD_HOLE.minStage, t - WORLD_HOLE.tierOffset));
}

// Cycle count: a non-finite or negative cycle counts as 0.
function cycleOf(cycle: number): number {
  return Number.isFinite(cycle) ? Math.max(0, Math.floor(cycle)) : 0;
}

// Tally marks on the booth pane (DENIZEN_ART §5): base plus cycle.
function marksOf(cycle: number): number {
  return WORLD_MARKS.base + cycleOf(cycle);
}

// Girl stage 0 window .. 3 ground: the further along of the era stage and the cycle trace stage (cycle 2 mini, cycle 3+ ground).
function girlStageOf(era: WorldEra, cycle: number): 0 | 1 | 2 | 3 {
  const trace = cycle >= 3 ? WORLD_GIRL.traceStageByCycle[3] : cycle === 2 ? WORLD_GIRL.traceStageByCycle[2] : 0;
  const stage = Math.max(WORLD_GIRL.stageByEra[era], trace);
  return stage >= 3 ? 3 : stage === 2 ? 2 : stage === 1 ? 1 : 0;
}

// Dog pose: the demo's lie wins; eras I-II dig once the hole exists; era III shakes with the vents, IV sits still, V roams.
function dogPoseOf(era: WorldEra, dogLies: boolean, holeStage: number, vents: boolean): DogPose {
  if (dogLies) return 'lie';
  if (era <= WORLD_ERA_RULES.dogDigMaxEra) return holeStage > 0 ? 'dig' : 'loop';
  if (era === WORLD_VENTS.minEra) return vents ? 'shake' : 'still';
  return era === WORLD_ERA_RULES.dogStillEra ? 'still' : 'roam';
}

// Street lamp: dead until powerLines, lit in era II, warm from era III, dead again once the skyAperture diamond is owned.
function lampOf(levels: TechLevels, era: WorldEra, powerLines: boolean): 'dead' | 'lit' | 'warm' {
  if (!powerLines || ruleMet(levels, WORLD_LAMP.deadRule)) return 'dead';
  return era >= WORLD_LAMP.warmFromEra ? 'warm' : 'lit';
}

// Skyline windows: era I-II follow the keystones (dim with the generator, lit with powerLines); era III and on are lit, era V
// only while a window is lit (skyAperture darkens them all).
function windowsOf(era: WorldEra, windowsLit: number, generator: boolean, powerLines: boolean): 'off' | 'dim' | 'lit' {
  if (era > WORLD_ERA_RULES.windowsKeystoneMaxEra) return windowsLit > 0 ? 'lit' : 'off';
  if (powerLines) return 'lit';
  return generator ? 'dim' : 'off';
}

// Lit windows: all six until era V, where the first matching stage rule sets the count (skyAperture 0, horizonField 1, lensArray 2,
// nullChamber 4; top-down).
function windowsLitOf(levels: TechLevels, era: WorldEra): number {
  if (era !== WORLD_WINDOWS.darkEra) return WORLD_WINDOWS.total;
  return WORLD_WINDOWS.stages.find((stage) => ruleMet(levels, stage.rule))?.lit ?? WORLD_WINDOWS.total;
}

// Paper scraps: all three on the street until era III, then the firebox tier burns them away (first match, else start).
function scrapsOf(levels: TechLevels, era: WorldEra, tiers: PartTiers | undefined): number {
  if (era < WORLD_SCRAPS.minEra) return SCRAP_COUNT;
  return tierEntry(levels, WORLD_SCRAPS.techId, tiers, WORLD_SCRAPS.burn)?.count ?? WORLD_SCRAPS.start;
}

// Puddle size by the condenser tier (era III and on, the condenser owned); 0 before.
function puddleSizeOf(levels: TechLevels, era: WorldEra, tiers: PartTiers | undefined): 0 | 1 | 2 | 3 {
  if (era < WORLD_PUDDLE.minEra) return 0;
  return tierEntry(levels, WORLD_PUDDLE.techId, tiers, WORLD_PUDDLE.sizeByTier)?.size ?? 0;
}

// Sprout: the highest stage whose rule is met, from era III (stages only grow).
function sproutOf(levels: TechLevels, era: WorldEra, tiers: PartTiers | undefined): number {
  if (era < WORLD_SPROUT.minEra) return 0;
  return WORLD_SPROUT.stages.reduce((best, s) => (ruleMet(levels, s.rule, tiers) ? Math.max(best, s.stage) : best), 0);
}

// Chladni rings: intensity by the standingWave tier, from era IV; 0 before.
function chladniOf(levels: TechLevels, era: WorldEra, tiers: PartTiers | undefined): 0 | 1 | 2 {
  if (era < WORLD_CHLADNI.minEra) return 0;
  return tierEntry(levels, WORLD_CHLADNI.techId, tiers, WORLD_CHLADNI.intensityByTier)?.intensity ?? 0;
}

// Virga: the lifetime PR gate, from era III; falls, then freezes (era IV), then fades (era V).
function virgaOf(era: WorldEra, lifetimePr: number): VirgaMode {
  if (era < WORLD_VIRGA.minEra || !(lifetimePr >= WORLD_VIRGA.minLifetimePr)) return 'off';
  return era === WORLD_VIRGA.minEra ? 'fall' : era === WORLD_VIRGA.frozenEra ? 'frozen' : 'fade';
}

/**
 * Visual state of the living world for one frame of inputs (eras I-V). The era is the highest keystone owned (currentEra). The layer
 * is visible in every era up to maxEra and through the ending phases (the script draws the film); later eras are hidden by maxEra only.
 * Every count only rises with the levels, the tiers, EE, PR and the cycle (nothing un-happens).
 */
export function deriveWorldState(i: WorldStateInput): WorldVisualState {
  const levels = i.levels;
  const tiers = i.tiers;
  const cycle = cycleOf(i.cycle);
  const era: WorldEra = currentEra(levels);   // currentEra is 1..5 already
  const generator = owned(levels, 'generator');
  const powerLines = owned(levels, 'powerLines');
  const vents = era >= WORLD_VENTS.minEra && owned(levels, WORLD_VENTS.techId);
  const holeStage = holeStageOf(i.lifetimeEe, i.motorRetrofitTier);
  const girlStage = girlStageOf(era, cycle);
  const girlStageName = WORLD_GIRL.stageNames[girlStage];
  const windowsLit = windowsLitOf(levels, era);
  const lamp = lampOf(levels, era, powerLines);
  const shadows = !(era === WORLD_SHADOWS.offEra && ruleMet(levels, WORLD_SHADOWS.offRule));
  return {
    visible: era <= (i.maxEra ?? LIVING_WORLD.maxEra),
    ending: i.phase,
    era,
    eraRow: WORLD_ERA_ROW[era],
    alpha: castAlpha(levels, era),
    shadows,
    shadowScale: shadows ? shadowScale(era) : 0,
    mode: playbackMode(levels, era),
    seam: WORLD_PLAYBACK.seamEras.some((e) => e === era),
    reverse: era === WORLD_ERA_RULES.reverseEra && i.phase === 'none',
    stare: i.observerOne ?? false,
    vents,
    dogPose: dogPoseOf(era, i.dogLies, holeStage, vents),
    girl: {
      stage: girlStage,
      stageName: girlStageName,
      row: era === WORLD_ERA_RULES.girlStepEra ? 'front' : 'back',
      steps: era === WORLD_ERA_RULES.girlStepEra ? girlStepsOf(levels) : 0,
    },
    props: {
      girlWindow: generator || girlStage > 0 ? 'dark' : 'flicker',
      girlMini: girlStageName === 'mini',
      girlMiniNear: girlStageName === 'miniNear',
      windows: windowsOf(era, windowsLit, generator, powerLines),
      windowsLit,
      windowsBreathe: era === WORLD_WINDOWS.breatheEra,
      lamp,
      lampGlow: powerLines && lamp !== 'dead',
      lampGlowWarm: lamp === 'warm',
      lampPulse: era === WORLD_LAMP.pulseEra && lamp === 'warm',
      boothLit: powerLines,
      boothFog: era === WORLD_VENTS.fogEra && vents,
      motes: generator,
      motesMode: era === WORLD_ERA_RULES.motesOrbitEra ? 'orbit' : WORLD_MOTES_BY_ERA[era],
      stakeChain: true,
      holeStage,
      scraps: scrapsOf(levels, era, tiers),
      marks: marksOf(cycle),
      puddle: { size: puddleSizeOf(levels, era, tiers), look: era === WORLD_PUDDLE.blackEra ? 'black' : 'grey' },
      sprout: sproutOf(levels, era, tiers),
      chladni: chladniOf(levels, era, tiers),
      chladniViolet: era === WORLD_ERA_RULES.chladniVioletEra,
      pages: era >= WORLD_PAGES.startEra,
      virga: virgaOf(era, i.lifetimePr ?? 0),
    },
    sensor: {
      led: generator ? 'amber' : 'red',
      readout: i.observerOne === true || cycle >= WORLD_TRACES.readoutOneFromCycle ? 'one' : 'dash',
      fog: era === WORLD_VENTS.fogEra && vents,
      pulse: era === WORLD_SENSOR.pulseEra,
    },
    traces: {
      redBall: cycle >= WORLD_TRACES.redBallFromCycle,
      crowHigh: cycle >= WORLD_TRACES.crowHighFromCycle,
      clipboard: Math.max(0, Math.min(WORLD_TRACES.clipboardMax, cycle - 1)),
    },
  };
}
