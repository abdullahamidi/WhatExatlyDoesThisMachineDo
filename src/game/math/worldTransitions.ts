// Living world transition queue (WP24 T5a, T5b). Why: nothing in the living world changes in one frame. Every change of the visual
// state becomes an item here: it waits for the gates (TECH INDEX, era card, modal) to close, starts in the queue order (cfg.order)
// spaced by a hashed stagger, and runs for its data duration (src/data/worldTransitions.ts). Counts (hole, puddle, sprout) only grow;
// scalars ramp from the value on screen; booleans flip at their start slot. The sequence rows run several timed steps as one item:
// the lamp buzzes on and flickers out, the booth stutters on after it, the windows and the motes come one by one, the rings light
// ring by ring. Every stutter toggles at toggleMs or slower (at most three on-to-off a second, WCAG); reduced motion turns each
// stutter into a monotone ramp of the same length.
// Pure: no Phaser, no DOM. One WorldTween is mutated in place; step() allocates nothing.
import { WORLD_TRANSITIONS } from '../../data/worldTransitions';
import type { TransitionId } from '../../data/worldTransitions';
import { WORLD_CHLADNI, WORLD_ERA_RULES, WORLD_SCRAPS, WORLD_WINDOWS } from '../../data/worldEras';
import { WORLD_ENV } from '../../data/livingWorld';
import type { MicroFlags } from '../../data/worldDay';
import type { EndingPhase } from '../../data/types';
import { playbackFps, shadowScale as shadowScaleOfEra } from './worldPlayback';
import type { WorldEra, WorldVisualState } from './worldState';

// A crossfade of two sprite identities (or counts): the presented value is from + (to - from) x k.
export interface Blend { from: number; to: number; k: number }
export interface QueueGates { indexOpen: boolean; eraCardUp: boolean; modalOpen: boolean; ending: EndingPhase; reduced: boolean }
// Counts since boot: a dig bout ends (hole steps), a vent puff sounds (fog builds).
export interface QueueCues { digBouts: number; ventPuffs: number }
export interface TransitionInfo { id: string; startedAtMs: number | null; durMs: number; k: number }

// Every presented value the renderers read. Mutated in place. Sequence values: lamp 0 dead / 1 lit / 2 warm (k stutters in the buzz-on
// and the flicker-out), glowAlpha 0-1 (the renderer scales it by WORLD_ENV.lampGlow.alpha), booth 0 dark / 1 lit (k stutters on),
// windows 0-1 (dim = WORLD_ENV.windowDimLevel), motes and moteFall, scrapBurn 0 whole .. 1 gone, chladni ring alphas.
export interface WorldTween {
  eraRow: Blend;                                  // sheet row 0-5 (era crossfade)
  alpha: number;                                  // cast alpha
  shadowScale: number;
  shadows: number;                                // 0-1
  drawFps: number;                                // 0 crank, 2, 4, 8, ramping
  led: Blend;                                     // 0 red, 1 amber
  lamp: Blend;                                    // 0 dead, 1 lit, 2 warm
  glowAlpha: number;                              // 0-1 (scaled by WORLD_ENV.lampGlow.alpha by the renderer)
  glowWarm: boolean;
  booth: Blend;                                   // 0 dark, 1 lit
  windows: number[];                              // six, 0-1
  breatheK: number;
  pulseK: number;
  girlWindow: { alpha: number; slowK: number };
  motes: number[];                                // five alphas
  motesFreezeK: number;
  moteFall: number[];                             // five, 0-1 fall progress
  hole: Blend;                                    // stage 0-4
  scrapBurn: number[];                            // three, 0 whole .. 1 gone
  puddle: Blend;                                  // size 0-3
  puddleBlackK: number;
  sprout: Blend;                                  // stage 0-4
  boothFog: number;                               // 0-1: builds at the first vent puff, clears after
  sensorFog: number;                              // 0-1, as boothFog
  chladni: number[];                              // five ring alphas
  chladniViolet: number;                          // 0-1
  virga: { alpha: number; speed: number };        // 0-1 normalized
  receiverLevelK: number;                         // 0 swung, 1 level
  stareK: number;                                 // 0-1 (the stare spreads over spreadMs)
  reverseOn: boolean;
  unisonOn: boolean;
  micro: MicroFlags;
}

export interface TransitionQueue {
  // Takes the new target. Changed rows retarget: a running Blend row restarts its ramp from the sprite on screen, a scalar restarts
  // from the value on screen, a count row lets its running step land first. Nothing changes until the next step. Under reduced motion the
  // receiver rise waits for the era row (one twin sprite: the rise must not hang inside the era crossfade).
  setTarget(state: WorldVisualState, nowMs: number, gates: QueueGates): void;
  step(nowMs: number, dtMs: number, gates: QueueGates, cues: QueueCues): WorldTween;
  snap(state: WorldVisualState): void;
  settle(on: boolean): void;
  // Active items only (queued or running). The view is reused: read it before the next call.
  pending(): readonly TransitionInfo[];
  tween(): WorldTween;
}

// Rows of the T5a ramps (eraRow, scalars, counts, flags, virga, fogs).
type BaseRowKey = 'eraRow' | 'alpha' | 'shadowScale' | 'shadows' | 'drawFps' | 'led' | 'receiverLevelK' | 'stareK' | 'reverseOn' | 'unisonOn'
  | 'hole' | 'puddle' | 'puddleBlackK' | 'sprout' | 'chladniViolet' | 'virga' | 'boothFog' | 'sensorFog';
// Sequence rows: one item each, started once; the item's steps are written from its elapsed ms (writeSeq).
type SeqRow = 'lamp' | 'booth' | 'windows' | 'breatheK' | 'pulseK' | 'girlWindow' | 'motes' | 'motesFreezeK' | 'moteFall' | 'scrapBurn'
  | 'chladni';
type RowKey = BaseRowKey | SeqRow;
type BlendKey = 'eraRow' | 'led' | 'hole' | 'puddle' | 'sprout';
type CountKey = 'hole' | 'puddle' | 'sprout';
type ScalarKey = 'alpha' | 'shadowScale' | 'shadows' | 'drawFps' | 'receiverLevelK' | 'stareK' | 'puddleBlackK' | 'chladniViolet'
  | 'boothFog' | 'sensorFog';
type FlagKey = 'reverseOn' | 'unisonOn';
// The wanted values: one number per row, virga split in two.
type WantKey = Exclude<BaseRowKey, 'virga'> | 'virgaAlpha' | 'virgaSpeed';

// Row iteration order: ties in the queue rank (cfg.order) keep this order; the rank itself is the data order.
const ROWS: readonly RowKey[] = ['eraRow', 'alpha', 'shadowScale', 'shadows', 'drawFps', 'led', 'receiverLevelK', 'stareK', 'reverseOn',
  'unisonOn', 'hole', 'puddle', 'puddleBlackK', 'sprout', 'chladniViolet', 'virga', 'boothFog', 'sensorFog',
  'lamp', 'booth', 'windows', 'breatheK', 'pulseK', 'girlWindow', 'motes', 'motesFreezeK', 'moteFall', 'scrapBurn', 'chladni'];
const WANT_KEYS: readonly WantKey[] = ['eraRow', 'alpha', 'shadowScale', 'shadows', 'drawFps', 'led', 'receiverLevelK', 'stareK',
  'reverseOn', 'unisonOn', 'hole', 'puddle', 'puddleBlackK', 'sprout', 'chladniViolet', 'virgaAlpha', 'virgaSpeed', 'boothFog', 'sensorFog'];
const BLEND_ROWS: readonly BlendKey[] = ['eraRow', 'led', 'hole', 'puddle', 'sprout'];
const COUNT_ROWS: readonly CountKey[] = ['hole', 'puddle', 'sprout'];
const SCALAR_ROWS: readonly ScalarKey[] = ['alpha', 'shadowScale', 'shadows', 'drawFps', 'receiverLevelK', 'stareK', 'puddleBlackK',
  'chladniViolet', 'boothFog', 'sensorFog'];
const SEQ_ROWS: readonly SeqRow[] = ['lamp', 'booth', 'windows', 'breatheK', 'pulseK', 'girlWindow', 'motes', 'motesFreezeK', 'moteFall',
  'scrapBurn', 'chladni'];
const SEQ_SET: ReadonlySet<RowKey> = new Set<RowKey>(SEQ_ROWS);
// The queue rank of each sequence row (a windows row that falls takes 'windowsDark'; a lamp row takes lamp / lampWarm / lampDead).
const SEQ_ORDER: Record<SeqRow, TransitionId> = {
  lamp: 'lamp', booth: 'booth', windows: 'windows', breatheK: 'breathe', pulseK: 'breathe', girlWindow: 'girlWindow', motes: 'motes',
  motesFreezeK: 'motesFreeze', moteFall: 'motesFall', scrapBurn: 'scrapBurn', chladni: 'chladni',
};

// Era IV: the unison conductor joins every runner (no era constant for it in src/data yet).
const UNISON_ERA: WorldEra = 4;
// Virga fall: alpha and speed both 1; frozen: alpha 1, speed 0; fade and off: both 0.
const VIRGA_FALL = 1;
const VIRGA_STILL = 0;
// A running crossfade retargets from the sprite that is more visible (the half-way point).
const DOMINANT_K = 0.5;
// Lamp sprites on the lamp Blend.
const DEAD = 0;
const LIT = 1;
const WARM = 2;
// Hash salts per sequence plan (each plan draws its gaps and durations from its own block of salts).
const HASH_STRIDE = 1000;
const FALL_SALT = 100;

// One queued (or running) change. The presented value lives in the tween; the item carries the ramp and the timing.
interface Item {
  row: RowKey;
  idx: number;                    // position in ROWS: the active list keeps this order
  active: boolean;                // queued or running
  startedAtMs: number | null;     // null while queued
  elapsedMs: number;              // progress since the start (frozen under gates)
  durMs: number;                  // span of the ramp (virga: the longer of its two ramps); 0 = flips at its start
  from: number;
  to: number;
  alphaMs: number;                // virga alpha span
  speedFrom: number;              // virga speed ramp
  speedTo: number;
  speedMs: number;
  order: TransitionId;            // start priority (cfg.order)
  waitBout: boolean;              // hole step: starts after a dig bout beyond seenBouts
  seenBouts: number;
  waitVent: boolean;              // fog build: starts after the first vent puff
  waitLamp: boolean;              // booth step of a batch that moved the lamp: starts delayAfterLampMs after the lamp starts
  waitEra: boolean;               // receiver step under reduced motion: starts only once the era row has landed (one twin sprite)
}

// One presented number of a sequence row: from `start` ms into the item it shows `from`, flickers for `flickerMs` (phases of
// `phaseMs`: from first, then to, alternating), then ramps to `to` over `spanMs`. Only scheduled (on) slots are written.
interface Slot {
  on: boolean;
  start: number;
  from: number;
  to: number;
  flickerMs: number;
  phaseMs: number;
  spanMs: number;
}

// Sine hash of an integer in [0, 1): deterministic, no random source (as worldPlayback.ts).
function hash01(n: number): number {
  const f = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return f - Math.floor(f);
}

// A gap or a duration drawn by a hash inside the [lo, hi] pair of a WORLD_TRANSITIONS row.
function drawMs(range: readonly [number, number], n: number): number {
  const lo = range[0];
  const hi = range[1];
  return lo + (hi - lo) * hash01(n);
}

function blank(): Blend {
  return { from: 0, to: 0, k: 1 };
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

function createTween(): WorldTween {
  return {
    eraRow: blank(), alpha: 0, shadowScale: 0, shadows: 0, drawFps: 0, led: blank(), lamp: blank(), glowAlpha: 0, glowWarm: false,
    booth: blank(), windows: zeros(WORLD_WINDOWS.total), breatheK: 0, pulseK: 0, girlWindow: { alpha: 0, slowK: 0 },
    motes: zeros(WORLD_ENV.motes.count), motesFreezeK: 0, moteFall: zeros(WORLD_ENV.motes.count), hole: blank(),
    scrapBurn: zeros(WORLD_SCRAPS.start), puddle: blank(), puddleBlackK: 0, sprout: blank(), boothFog: 0, sensorFog: 0,
    chladni: zeros(WORLD_CHLADNI.rings.length), chladniViolet: 0, virga: { alpha: 0, speed: 0 }, receiverLevelK: 0, stareK: 0,
    reverseOn: false, unisonOn: false,
    micro: { hitch: false, ledBlink: false, ledDim: false, lampDip: false, boothDip: false, girlWindowDim: false, clockTwitch: false,
      pageStarts: 0 },
  };
}

function newItem(row: RowKey): Item {
  return { row, idx: ROWS.indexOf(row), active: false, startedAtMs: null, elapsedMs: 0, durMs: 0, from: 0, to: 0, alphaMs: 0, speedFrom: 0,
    speedTo: 0,
    speedMs: 0, order: 'eraRow', waitBout: false, seenBouts: 0, waitVent: false, waitLamp: false, waitEra: false };
}

function newSlot(): Slot {
  return { on: false, start: 0, from: 0, to: 0, flickerMs: 0, phaseMs: 1, spanMs: 0 };
}

function slotsOf(n: number): Slot[] {
  return Array.from({ length: n }, () => newSlot());
}

function setSlot(s: Slot, start: number, from: number, to: number, flickerMs: number, phaseMs: number, spanMs: number): void {
  s.on = true;
  s.start = start;
  s.from = from;
  s.to = to;
  s.flickerMs = flickerMs;
  s.phaseMs = phaseMs;
  s.spanMs = spanMs;
}

function slotEnd(s: Slot): number {
  return s.start + s.flickerMs + s.spanMs;
}

// Value a flicker stops on: the last of its phases (from when there is no flicker, or when the last phase is even).
function flickerEnd(s: Slot): number {
  if (s.flickerMs <= 0) return s.from;
  return Math.floor((s.flickerMs - 1) / s.phaseMs) % 2 === 0 ? s.from : s.to;
}

// Value of a ramp at elapsed ms over span ms (span 0: the target at once).
function ramp(from: number, to: number, elapsedMs: number, span: number): number {
  return span > 0 ? from + (to - from) * Math.min(1, elapsedMs / span) : to;
}

// Value of a slot at the elapsed ms of its row. Before its start: from. Reduced motion: one monotone ramp over the same total.
function slotAt(s: Slot, elapsedMs: number, reduced: boolean): number {
  const x = elapsedMs - s.start;
  if (x <= 0) return s.from;
  if (reduced) return ramp(s.from, s.to, x, s.flickerMs + s.spanMs);
  if (x < s.flickerMs) return Math.floor(x / s.phaseMs) % 2 === 0 ? s.from : s.to;
  return ramp(flickerEnd(s), s.to, x - s.flickerMs, s.spanMs);
}

// Largest end of the scheduled slots (-1 when none is scheduled).
function spanOf(slots: readonly Slot[]): number {
  let end = -1;
  for (let i = 0; i < slots.length; i += 1) {
    const s = slots[i];
    if (s !== undefined && s.on) end = Math.max(end, slotEnd(s));
  }
  return end;
}

function clearSlots(slots: readonly Slot[]): void {
  for (let i = 0; i < slots.length; i += 1) {
    const s = slots[i];
    if (s !== undefined) s.on = false;
  }
}

function assignBlend(b: Blend, from: number, to: number, k: number): void {
  b.from = from;
  b.to = to;
  b.k = k;
}

// The sprite on screen of a Blend: the more visible one of the crossfade.
function dominantOf(b: Blend): number {
  return b.k >= DOMINANT_K ? b.to : b.from;
}

// Virga span of one field: rising uses inMs, falling uses the down span (outMs for alpha, freezeMs for speed).
function virgaSpan(from: number, to: number, up: number, down: number): number {
  return to > from ? up : to < from ? down : 0;
}

// Wanted values from the visual state (the one place every T5a row reads the state).
function fillWanted(w: Record<WantKey, number>, s: WorldVisualState): void {
  w.eraRow = s.eraRow;
  w.alpha = s.alpha;
  w.shadowScale = shadowScaleOfEra(s.era);
  w.shadows = s.shadows ? 1 : 0;
  w.drawFps = playbackFps(s.mode);
  w.led = s.sensor.led === 'amber' ? 1 : 0;
  w.receiverLevelK = s.era >= WORLD_ERA_RULES.reverseEra ? 1 : 0;
  w.stareK = s.stare ? 1 : 0;
  w.reverseOn = s.reverse ? 1 : 0;
  w.unisonOn = s.era === UNISON_ERA ? 1 : 0;
  w.hole = s.props.holeStage;
  w.puddle = s.props.puddle.size;
  w.puddleBlackK = s.props.puddle.look === 'black' ? 1 : 0;
  w.sprout = s.props.sprout;
  w.chladniViolet = s.props.chladniViolet ? 1 : 0;
  w.virgaAlpha = s.props.virga === 'fall' || s.props.virga === 'frozen' ? VIRGA_FALL : VIRGA_STILL;
  w.virgaSpeed = s.props.virga === 'fall' ? VIRGA_FALL : VIRGA_STILL;
  w.boothFog = s.props.boothFog ? 1 : 0;
  w.sensorFog = s.sensor.fog ? 1 : 0;
}

// The sequence goal of a state: the values each sequence row plans toward. Lamp 0 dead / 1 lit / 2 warm; glow 0 or 1 (the renderer
// scales it by WORLD_ENV.lampGlow.alpha); scalars 0 or 1; arrays one per element.
function writeGoal(g: WorldTween, s: WorldVisualState): void {
  const lampTo = s.props.lamp === 'dead' ? DEAD : s.props.lamp === 'lit' ? LIT : WARM;
  assignBlend(g.lamp, lampTo, lampTo, 1);
  g.glowAlpha = s.props.lampGlow ? 1 : 0;
  g.glowWarm = s.props.lampGlowWarm;
  const boothTo = s.props.boothLit ? 1 : 0;
  assignBlend(g.booth, boothTo, boothTo, 1);
  const windowLevel = s.props.windows === 'off' ? 0 : s.props.windows === 'dim' ? WORLD_ENV.windowDimLevel : 1;
  for (let i = 0; i < g.windows.length; i += 1) g.windows[i] = i < s.props.windowsLit ? windowLevel : 0;
  g.breatheK = s.props.windowsBreathe ? 1 : 0;
  g.pulseK = s.props.lampPulse ? 1 : 0;
  g.girlWindow.alpha = s.props.girlWindow === 'dark' ? 0 : 1;
  g.girlWindow.slowK = s.props.girlWindow === 'dark' ? 1 : 0;
  for (let i = 0; i < g.motes.length; i += 1) g.motes[i] = s.props.motes ? 1 : 0;
  g.motesFreezeK = s.props.motesMode === 'orbit' ? 0 : 1;
  for (let i = 0; i < g.moteFall.length; i += 1) g.moteFall[i] = s.props.motesMode === 'fall' ? 1 : 0;
  for (let i = 0; i < g.scrapBurn.length; i += 1) g.scrapBurn[i] = i >= s.props.scraps ? 1 : 0;
  const rings = WORLD_CHLADNI.ringsByIntensity[s.props.chladni];
  for (let i = 0; i < g.chladni.length; i += 1) g.chladni[i] = i < rings ? 1 : 0;
}

// Copies one sequence row of src into dst (goal to tween on landing, and goal to goal before a new target). Arrays go in reverse order.
function copyArr(dst: number[], src: readonly number[]): void {
  for (let i = src.length - 1; i >= 0; i -= 1) dst[i] = src[i] ?? 0;
}

function copySeqRow(dst: WorldTween, src: WorldTween, row: SeqRow): void {
  switch (row) {
    case 'lamp':
      assignBlend(dst.lamp, src.lamp.from, src.lamp.to, src.lamp.k);
      dst.glowAlpha = src.glowAlpha;
      dst.glowWarm = src.glowWarm;
      return;
    case 'booth':
      assignBlend(dst.booth, src.booth.from, src.booth.to, src.booth.k);
      return;
    case 'windows':
      copyArr(dst.windows, src.windows);
      return;
    case 'breatheK':
      dst.breatheK = src.breatheK;
      return;
    case 'pulseK':
      dst.pulseK = src.pulseK;
      return;
    case 'girlWindow':
      dst.girlWindow.alpha = src.girlWindow.alpha;
      dst.girlWindow.slowK = src.girlWindow.slowK;
      return;
    case 'motes':
      copyArr(dst.motes, src.motes);
      return;
    case 'motesFreezeK':
      dst.motesFreezeK = src.motesFreezeK;
      return;
    case 'moteFall':
      copyArr(dst.moteFall, src.moteFall);
      return;
    case 'scrapBurn':
      copyArr(dst.scrapBurn, src.scrapBurn);
      return;
    case 'chladni':
      copyArr(dst.chladni, src.chladni);
      return;
  }
}

function arrDiffers(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}

// True when a sequence goal moved between two goal tweens.
function seqDiffers(a: WorldTween, b: WorldTween, row: SeqRow): boolean {
  switch (row) {
    case 'lamp':
      return a.lamp.to !== b.lamp.to || a.glowAlpha !== b.glowAlpha || a.glowWarm !== b.glowWarm;
    case 'booth':
      return a.booth.to !== b.booth.to;
    case 'windows':
      return arrDiffers(a.windows, b.windows);
    case 'breatheK':
      return a.breatheK !== b.breatheK;
    case 'pulseK':
      return a.pulseK !== b.pulseK;
    case 'girlWindow':
      return a.girlWindow.alpha !== b.girlWindow.alpha || a.girlWindow.slowK !== b.girlWindow.slowK;
    case 'motes':
      return arrDiffers(a.motes, b.motes);
    case 'motesFreezeK':
      return a.motesFreezeK !== b.motesFreezeK;
    case 'moteFall':
      return arrDiffers(a.moteFall, b.moteFall);
    case 'scrapBurn':
      return arrDiffers(a.scrapBurn, b.scrapBurn);
    case 'chladni':
      return arrDiffers(a.chladni, b.chladni);
  }
}

function isSeqRow(row: RowKey): row is SeqRow {
  return SEQ_SET.has(row);
}

function gateUp(g: QueueGates): boolean {
  return g.indexOpen || g.eraCardUp || g.modalOpen;
}

export function createTransitionQueue(cfg: typeof WORLD_TRANSITIONS = WORLD_TRANSITIONS): TransitionQueue {
  const t = createTween();
  const goal = createTween();        // the sequence goal of the last state (writeGoal); the sequence rows plan toward it
  const prevGoal = createTween();    // the same before the last setTarget
  const wanted = {} as Record<WantKey, number>;
  const prev = {} as Record<WantKey, number>;
  const changed = {} as Record<WantKey, boolean>;
  for (const key of WANT_KEYS) {
    wanted[key] = 0;
    prev[key] = 0;
    changed[key] = false;
  }
  const items = {} as Record<RowKey, Item>;
  const infos = {} as Record<RowKey, TransitionInfo>;
  for (const row of ROWS) {
    items[row] = newItem(row);
    infos[row] = { id: row, startedAtMs: null, durMs: 0, k: 0 };
  }
  const view: TransitionInfo[] = [];
  const rank = {} as Record<TransitionId, number>;
  cfg.order.forEach((id, i) => {
    rank[id] = i;
  });

  // Sequence slots and the endpoints of the Blend rows (sized once; the plans set them, the writers read them).
  const lampA = newSlot();
  const lampB = newSlot();
  const lampG1 = newSlot();
  const lampG2 = newSlot();
  const lampEnds = { aFrom: DEAD, aTo: DEAD, bFrom: LIT, bTo: WARM, flagFrom: false, flagTo: false };
  const boothK = newSlot();
  const boothEnds = { from: 0, to: 0 };
  const breatheSlot = newSlot();
  const pulseSlot = newSlot();
  const freezeSlot = newSlot();
  const girlAlpha = newSlot();
  const girlSlow = newSlot();
  const winSlots = slotsOf(WORLD_WINDOWS.total);
  const moteSlots = slotsOf(WORLD_ENV.motes.count);
  const fallSlots = slotsOf(WORLD_ENV.motes.count);
  const scrapSlots = slotsOf(WORLD_SCRAPS.start);
  const ringSlots = slotsOf(WORLD_CHLADNI.rings.length);
  const seqSlots: Record<SeqRow, readonly Slot[]> = {
    lamp: [lampA, lampB, lampG1, lampG2], booth: [boothK], windows: winSlots, breatheK: [breatheSlot], pulseK: [pulseSlot],
    girlWindow: [girlAlpha, girlSlow], motes: moteSlots, motesFreezeK: [freezeSlot], moteFall: fallSlots, scrapBurn: scrapSlots,
    chladni: ringSlots,
  };

  let eraNow: WorldEra = 1;
  let releaseAtMs = -Infinity;      // gates dropped at T: nothing starts before T + startAfterCloseMs
  let wasGated = false;
  let nextStartAtMs = -Infinity;    // consecutive starts are at least one stagger apart
  let starts = 0;
  let settleOn = false;
  let reducedNow = false;           // the reduced flag of the last step: the stutters write as ramps
  let lampMoved = false;            // the lamp goal moved in the batch being set (a booth step waits for the lamp)
  let seqBase = 0;                  // hash salts of the sequence plans
  // The active items (queued or running) in ROWS order: activeList[0..activeCount). Preallocated at ROWS.length, so no frame allocates.
  // step() scans it only while it is not empty.
  const activeList: (Item | undefined)[] = new Array<Item | undefined>(ROWS.length).fill(undefined);
  let activeCount = 0;

  // Stagger between two starts: lerp over the configured range, hashed by the start count.
  function staggerMs(n: number): number {
    const lo = cfg.staggerMs[0];
    const hi = cfg.staggerMs[1];
    return lo + (hi - lo) * hash01(n);
  }

  function setBlend(row: BlendKey, from: number, to: number, k: number): void {
    assignBlend(t[row], from, to, k);
  }

  // Count rows step one sprite at a time in era I-II (hole), straight to the target otherwise.
  function countTarget(row: CountKey, from: number, w: number): number {
    return row === 'hole' && eraNow <= WORLD_ERA_RULES.dogDigMaxEra ? Math.min(w, from + 1) : w;
  }

  function countSpanMs(row: CountKey, waitBout: boolean): number {
    if (row === 'hole') return waitBout ? cfg.rows.hole.boutMinMs : cfg.rows.hole.settleMs;
    return row === 'puddle' ? cfg.rows.puddle.ms : cfg.rows.sprout.ms;
  }

  function scalarSpanMs(row: ScalarKey, from: number, to: number): number {
    switch (row) {
      case 'alpha': return cfg.rows.alpha.ms;
      case 'shadowScale': return cfg.rows.shadowScale.ms;
      case 'shadows': return cfg.rows.shadows.ms;
      case 'drawFps': return cfg.rows.drawFps.ms;
      case 'receiverLevelK': return cfg.rows.receiver.ms;
      case 'stareK': return cfg.rows.stare.spreadMs;
      case 'puddleBlackK': return cfg.rows.puddleBlack.ms;
      case 'chladniViolet': return cfg.rows.chladniViolet.ms;
      case 'boothFog':
      case 'sensorFog': return to > from ? cfg.rows.fogBuild.ms : cfg.rows.fogClear.ms;
    }
  }

  function scalarOrder(row: ScalarKey, from: number, to: number): TransitionId {
    switch (row) {
      case 'alpha': return 'alpha';
      case 'shadowScale': return 'shadowScale';
      case 'shadows': return 'shadows';
      case 'drawFps': return 'drawFps';
      case 'receiverLevelK': return 'receiver';
      case 'stareK': return 'stare';
      case 'puddleBlackK': return 'puddleBlack';
      case 'chladniViolet': return 'chladniViolet';
      case 'boothFog':
      case 'sensorFog': return to > from ? 'fogBuild' : 'fogClear';
    }
  }

  // The one writer of Item.active: keeps the active list in step (an active item is in the list, in ROWS order).
  function setActive(it: Item, on: boolean): void {
    if (it.active === on) return;
    it.active = on;
    if (on) insertActive(it);
    else removeActive(it);
  }

  // Inserts an item at its ROWS position: the later entries move up one slot.
  function insertActive(it: Item): void {
    let j = activeCount;
    while (j > 0) {
      const prev = activeList[j - 1];
      if (prev === undefined || prev.idx < it.idx) break;
      activeList[j] = prev;
      j -= 1;
    }
    activeList[j] = it;
    activeCount += 1;
  }

  // Drops an item from the list: the later entries move down one slot, so the rest stay in ROWS order.
  function removeActive(it: Item): void {
    let j = 0;
    while (j < activeCount && activeList[j] !== it) j += 1;
    if (j === activeCount) return;
    for (let k = j; k < activeCount - 1; k += 1) activeList[k] = activeList[k + 1];
    activeCount -= 1;
  }

  function cancel(it: Item): void {
    setActive(it, false);
    it.startedAtMs = null;
    it.elapsedMs = 0;
    it.waitEra = false;
  }

  function finish(it: Item): void {
    setActive(it, false);
    const row = it.row;
    if (isSeqRow(row)) {
      landSeq(row);
      return;
    }
    switch (row) {
      case 'eraRow':
      case 'led':
      case 'hole':
      case 'puddle':
      case 'sprout':
        setBlend(row, it.to, it.to, 1);
        return;
      case 'reverseOn':
      case 'unisonOn':
        t[row] = it.to === 1;
        return;
      case 'virga':
        t.virga.alpha = it.to;
        t.virga.speed = it.speedTo;
        return;
      default:
        t[row] = it.to;
    }
  }

  // Sprite crossfade rows (era row, LED): a retarget while running takes the sprite that is more visible as the new `from`.
  function retargetBlend(row: 'eraRow' | 'led', w: number): void {
    const it = items[row];
    const b = t[row];
    if (it.active && it.startedAtMs !== null) {
      const from = dominantOf(b);
      if (from === w) {
        cancel(it);
        setBlend(row, w, w, 1);
        return;
      }
      it.from = from;
      it.to = w;
      it.elapsedMs = 0;
      setBlend(row, from, w, 0);
      return;
    }
    if (it.active) {
      if (b.from === w) {
        cancel(it);
        setBlend(row, w, w, 1);
        return;
      }
      it.from = b.from;
      it.to = w;
      setBlend(row, b.from, w, 0);
      return;
    }
    const settled = b.to;
    if (settled === w) return;
    setActive(it, true);
    it.startedAtMs = null;
    it.elapsedMs = 0;
    it.durMs = row === 'eraRow' ? cfg.rows.eraRow.ms : cfg.rows.led.ms;
    it.from = settled;
    it.to = w;
    it.order = row;
    setBlend(row, settled, w, 0);
  }

  // Count rows: a queued step is dropped and re-queued on the next step (fresh bout count); a running step lands first.
  function dropPending(row: CountKey): void {
    const it = items[row];
    if (!it.active || it.startedAtMs !== null) return;
    cancel(it);
    setBlend(row, t[row].from, t[row].from, 1);
  }

  function retargetScalar(row: ScalarKey, w: number, reduced: boolean): void {
    const it = items[row];
    const p = t[row];
    if (p === w) {
      cancel(it);
      return;
    }
    it.from = p;
    it.to = w;
    it.elapsedMs = 0;
    it.durMs = scalarSpanMs(row, p, w);
    it.order = scalarOrder(row, p, w);
    it.waitVent = (row === 'boothFog' || row === 'sensorFog') && w > p;
    it.waitEra = row === 'receiverLevelK' && reduced;
    if (!it.active) {
      setActive(it, true);
      it.startedAtMs = null;
    }
  }

  function retargetFlag(row: FlagKey, w: number): void {
    const it = items[row];
    const cur = t[row] ? 1 : 0;
    if (cur === w) {
      cancel(it);
      return;
    }
    setActive(it, true);
    it.startedAtMs = null;
    it.elapsedMs = 0;
    it.durMs = 0;
    it.to = w;
    it.order = row === 'reverseOn' ? 'reverse' : 'unison';
  }

  function retargetVirga(): void {
    const it = items.virga;
    const v = t.virga;
    const wa = wanted.virgaAlpha;
    const ws = wanted.virgaSpeed;
    if (v.alpha === wa && v.speed === ws) {
      cancel(it);
      return;
    }
    it.from = v.alpha;
    it.to = wa;
    it.speedFrom = v.speed;
    it.speedTo = ws;
    it.alphaMs = virgaSpan(v.alpha, wa, cfg.rows.virga.inMs, cfg.rows.virga.outMs);
    it.speedMs = virgaSpan(v.speed, ws, cfg.rows.virga.inMs, cfg.rows.virga.freezeMs);
    it.durMs = Math.max(it.alphaMs, it.speedMs);
    it.elapsedMs = 0;
    it.order = 'virga';
    if (!it.active) {
      setActive(it, true);
      it.startedAtMs = null;
    }
  }

  function retarget(row: BaseRowKey, reduced: boolean): void {
    const w = wanted[row === 'virga' ? 'virgaAlpha' : row];
    switch (row) {
      case 'eraRow':
      case 'led':
        retargetBlend(row, w);
        return;
      case 'hole':
      case 'puddle':
      case 'sprout':
        dropPending(row);
        return;
      case 'reverseOn':
      case 'unisonOn':
        retargetFlag(row, w);
        return;
      case 'virga':
        retargetVirga();
        return;
      default:
        retargetScalar(row, w, reduced);
    }
  }

  // Queues the count steps that are below their wanted value and idle (one step at a time while a running step lands).
  function createCounts(cues: QueueCues): void {
    for (const row of COUNT_ROWS) {
      const it = items[row];
      const b = t[row];
      const w = wanted[row];
      if (it.active || b.to >= w) continue;
      it.waitBout = row === 'hole' && eraNow <= WORLD_ERA_RULES.dogDigMaxEra;
      setActive(it, true);
      it.startedAtMs = null;
      it.elapsedMs = 0;
      it.from = b.to;
      it.to = countTarget(row, b.to, w);
      it.durMs = countSpanMs(row, it.waitBout);
      it.order = row;
      it.seenBouts = cues.digBouts;
      setBlend(row, b.to, it.to, 0);
    }
  }

  // A booth step of a batch that moved the lamp waits until the lamp has started and its delay has passed (no wait once the lamp is idle).
  function lampHolds(nowMs: number): boolean {
    const lamp = items.lamp;
    if (!lamp.active) return false;
    return lamp.startedAtMs === null || nowMs < lamp.startedAtMs + cfg.rows.booth.delayAfterLampMs;
  }

  // Starts at most one queued item: the first eligible one in queue order, once the release and the stagger allow it.
  function startNext(nowMs: number, cues: QueueCues): void {
    if (nowMs < releaseAtMs || nowMs < nextStartAtMs) return;
    let pick: Item | null = null;
    let pickRank = Infinity;
    for (let j = 0; j < activeCount; j += 1) {
      const it = activeList[j];
      if (it === undefined || it.startedAtMs !== null) continue;
      if (it.waitBout && cues.digBouts <= it.seenBouts) continue;
      if (it.waitVent && cues.ventPuffs < 1) continue;
      if (it.waitLamp && lampHolds(nowMs)) continue;
      if (it.waitEra && items.eraRow.active) continue;
      const r = rank[it.order];
      if (r < pickRank) {
        pickRank = r;
        pick = it;
      }
    }
    if (pick === null) return;
    pick.startedAtMs = nowMs;
    pick.elapsedMs = 0;
    nextStartAtMs = nowMs + staggerMs(starts);
    starts += 1;
    if (pick.durMs <= 0) finish(pick);
  }

  // Progress of the started items by the live time (time after the release, at most dtMs). An item that lands leaves the list, so the
  // next one moves into its slot.
  function advance(liveMs: number): void {
    if (liveMs <= 0) return;
    let j = 0;
    while (j < activeCount) {
      const it = activeList[j];
      if (it === undefined || it.startedAtMs === null) {
        j += 1;
        continue;
      }
      it.elapsedMs += liveMs;
      if (it.elapsedMs >= it.durMs) finish(it);
      else j += 1;
    }
  }

  // Lamp and glow steps: the lamp Blend runs phase A (the buzz-on or the flicker-out), then phase B (the lit to warm ramp), then settles
  // on the goal. The glow runs its segments; its warm flag flips at the seam of the two segments (or at the end of the glow).
  function writeLamp(e: number): void {
    if (lampA.on && e < slotEnd(lampA)) assignBlend(t.lamp, lampEnds.aFrom, lampEnds.aTo, slotAt(lampA, e, reducedNow));
    else if (lampB.on && e < slotEnd(lampB)) assignBlend(t.lamp, lampEnds.bFrom, lampEnds.bTo, slotAt(lampB, e, reducedNow));
    else if (lampA.on || lampB.on) assignBlend(t.lamp, goal.lamp.to, goal.lamp.to, 1);
    const second = e >= lampG2.start;
    t.glowAlpha = slotAt(second ? lampG2 : lampG1, e, reducedNow);
    t.glowWarm = second ? lampEnds.flagTo : lampEnds.flagFrom;
  }

  function writeSlots(out: number[], slots: readonly Slot[], e: number): void {
    for (let i = 0; i < slots.length; i += 1) {
      const s = slots[i];
      if (s !== undefined && s.on) out[i] = slotAt(s, e, reducedNow);
    }
  }

  // Presented values of the running items (queued items keep their from value in the tween).
  function writeStarted(): void {
    for (let j = 0; j < activeCount; j += 1) {
      const it = activeList[j];
      if (it === undefined || it.startedAtMs === null) continue;
      const row = it.row;
      if (isSeqRow(row)) {
        writeSeq(row, it.elapsedMs);
        continue;
      }
      switch (row) {
        case 'eraRow':
        case 'led':
        case 'hole':
        case 'puddle':
        case 'sprout':
          t[row].k = kOf(it);
          break;
        case 'virga':
          t.virga.alpha = ramp(it.from, it.to, it.elapsedMs, it.alphaMs);
          t.virga.speed = ramp(it.speedFrom, it.speedTo, it.elapsedMs, it.speedMs);
          break;
        case 'reverseOn':
        case 'unisonOn':
          break;
        default:
          t[row] = ramp(it.from, it.to, it.elapsedMs, it.durMs);
      }
    }
  }

  function writeSeq(row: SeqRow, e: number): void {
    switch (row) {
      case 'lamp':
        writeLamp(e);
        return;
      case 'booth':
        assignBlend(t.booth, boothEnds.from, boothEnds.to, slotAt(boothK, e, reducedNow));
        return;
      case 'windows':
        writeSlots(t.windows, winSlots, e);
        return;
      case 'breatheK':
        t.breatheK = slotAt(breatheSlot, e, reducedNow);
        return;
      case 'pulseK':
        t.pulseK = slotAt(pulseSlot, e, reducedNow);
        return;
      case 'girlWindow':
        if (girlAlpha.on) t.girlWindow.alpha = slotAt(girlAlpha, e, reducedNow);
        if (girlSlow.on) t.girlWindow.slowK = slotAt(girlSlow, e, reducedNow);
        return;
      case 'motes':
        writeSlots(t.motes, moteSlots, e);
        return;
      case 'motesFreezeK':
        t.motesFreezeK = slotAt(freezeSlot, e, reducedNow);
        return;
      case 'moteFall':
        writeSlots(t.moteFall, fallSlots, e);
        return;
      case 'scrapBurn':
        writeSlots(t.scrapBurn, scrapSlots, e);
        return;
      case 'chladni':
        writeSlots(t.chladni, ringSlots, e);
        return;
    }
  }

  // Lands a sequence row on its goal and drops its steps (finish, snap).
  function landSeq(row: SeqRow): void {
    copySeqRow(t, goal, row);
    clearSlots(seqSlots[row]);
  }

  // Lands every row on its wanted value and clears the queue.
  function snapRows(): void {
    for (const row of ROWS) cancel(items[row]);
    for (const row of BLEND_ROWS) setBlend(row, wanted[row], wanted[row], 1);
    for (const row of SCALAR_ROWS) t[row] = wanted[row];
    t.reverseOn = wanted.reverseOn === 1;
    t.unisonOn = wanted.unisonOn === 1;
    t.virga.alpha = wanted.virgaAlpha;
    t.virga.speed = wanted.virgaSpeed;
    for (const row of SEQ_ROWS) landSeq(row);
  }

  // Lamp plan: the buzz-on (dead to lit, then a warm shift if the goal is warm), the flicker-out to dead, or the lit to warm shift;
  // the glow follows the lamp (after the buzz, or fading through zero at the warm shift). Returns the span, or -1 when nothing moves.
  function planLamp(): number {
    const r = cfg.rows;
    const from = dominantOf(t.lamp);
    const to = goal.lamp.to;
    const dying = to === DEAD && from !== DEAD;
    const buzzing = from === DEAD && to !== DEAD;
    const shifting = from !== DEAD && to !== DEAD && from !== to;
    const hasB = shifting || (buzzing && to === WARM);
    const flagFrom = t.glowWarm;
    const flagTo = goal.glowWarm;
    const glowFrom = t.glowAlpha;
    const glowTo = goal.glowAlpha;
    if (!dying && !buzzing && !shifting) assignBlend(t.lamp, to, to, 1);
    if (dying) setSlot(lampA, 0, 0, 1, r.lampDead.ms, r.lampDead.toggleMs, 0);
    else if (buzzing) setSlot(lampA, 0, 0, 1, r.lamp.buzzMs, r.lamp.toggleMs, 0);
    else lampA.on = false;
    if (hasB) setSlot(lampB, buzzing ? r.lamp.buzzMs : 0, 0, 1, 0, 0, r.lampWarm.ms);
    else lampB.on = false;
    lampEnds.aFrom = dying ? from : DEAD;
    lampEnds.aTo = dying ? DEAD : LIT;
    lampEnds.bFrom = buzzing ? LIT : from;
    lampEnds.bTo = to;
    lampEnds.flagFrom = flagFrom;
    lampEnds.flagTo = flagTo;
    const glowStart = buzzing ? r.lamp.buzzMs : 0;
    const glowSpan = dying ? r.lampDead.ms : hasB ? r.lampWarm.ms : r.lamp.glowMs;
    if (hasB && flagFrom !== flagTo) {
      const half = glowSpan / 2;
      setSlot(lampG1, glowStart, glowFrom, 0, 0, 0, half);
      setSlot(lampG2, glowStart + half, 0, glowTo, 0, 0, glowSpan - half);
    } else {
      setSlot(lampG1, glowStart, glowFrom, glowTo, 0, 0, glowSpan);
      setSlot(lampG2, glowStart + glowSpan, glowTo, glowTo, 0, 0, 0);
    }
    if (!dying && !buzzing && !shifting && glowFrom === glowTo && flagFrom === flagTo) {
      clearSlots(seqSlots.lamp);
      return -1;
    }
    items.lamp.order = dying ? 'lampDead' : shifting ? 'lampWarm' : 'lamp';
    return spanOf(seqSlots.lamp);
  }

  // Booth plan: the hood light stutters on (k 0 to 1) over totalMs, from the sprite on screen to the goal.
  function planBooth(): number {
    const from = dominantOf(t.booth);
    const to = goal.booth.to;
    if (from === to) {
      assignBlend(t.booth, to, to, 1);
      clearSlots(seqSlots.booth);
      return -1;
    }
    setSlot(boothK, 0, 0, 1, cfg.rows.booth.totalMs, cfg.rows.booth.toggleMs, 0);
    boothEnds.from = from;
    boothEnds.to = to;
    return cfg.rows.booth.totalMs;
  }

  // Window plan: rising windows come in index order, each after a hashed gap (the first too), two flickers from dark, then held;
  // falling windows (era V) go out in descending index order, gapMs apart: two dark flickers, then the fade to the new level.
  function planWindows(): number {
    const rise = cfg.rows.windows;
    const dark = cfg.rows.windowsDark;
    clearSlots(winSlots);
    let at = 0;
    let risers = 0;
    for (let i = 0; i < winSlots.length; i += 1) {
      const s = winSlots[i];
      const cur = t.windows[i] ?? 0;
      const to = goal.windows[i] ?? 0;
      if (s === undefined || to <= cur) continue;
      at += drawMs(rise.gapMs, seqBase + risers);
      risers += 1;
      setSlot(s, at, cur, to, 2 * dark.flickers * rise.flickerMs, rise.flickerMs, 0);
    }
    let fallers = 0;
    for (let i = winSlots.length - 1; i >= 0; i -= 1) {
      const s = winSlots[i];
      const cur = t.windows[i] ?? 0;
      const to = goal.windows[i] ?? 0;
      if (s === undefined || to >= cur) continue;
      setSlot(s, fallers * dark.gapMs, cur, to, (2 * dark.flickers + 1) * dark.flickerMs, dark.flickerMs, dark.fadeMs);
      fallers += 1;
    }
    items.windows.order = fallers > 0 ? 'windowsDark' : 'windows';
    return spanOf(winSlots);
  }

  // Mote plan: the lit motes come one at a time, each after a hashed gap (the first too) and fading in over fadeMs. Motes going
  // off snap to 0 at the item's start (reverse order, no delay): a zero-length item.
  function planMotes(): number {
    const r = cfg.rows.motes;
    clearSlots(moteSlots);
    for (let i = 0; i < moteSlots.length; i += 1) {
      if ((t.motes[i] ?? 0) > (goal.motes[i] ?? 0)) return 0;
    }
    let at = 0;
    let k = 0;
    for (let i = 0; i < moteSlots.length; i += 1) {
      const s = moteSlots[i];
      const cur = t.motes[i] ?? 0;
      const to = goal.motes[i] ?? 0;
      if (s === undefined || to <= cur) continue;
      at += drawMs(r.gapMs, seqBase + k);
      k += 1;
      setSlot(s, at, cur, to, 0, 0, r.fadeMs);
    }
    return spanOf(moteSlots);
  }

  // Mote fall plan: each mote drifts down over its own hashed duration, the motes started one after another. Leaving the fall
  // mode resets the progress at the item's start (a zero-length item).
  function planMoteFall(): number {
    clearSlots(fallSlots);
    for (let i = 0; i < fallSlots.length; i += 1) {
      if ((t.moteFall[i] ?? 0) > (goal.moteFall[i] ?? 0)) return 0;
    }
    let at = 0;
    let k = 0;
    for (let i = 0; i < fallSlots.length; i += 1) {
      const s = fallSlots[i];
      const cur = t.moteFall[i] ?? 0;
      const to = goal.moteFall[i] ?? 0;
      if (s === undefined || to <= cur) continue;
      at += drawMs(cfg.rows.motes.gapMs, seqBase + k);
      k += 1;
      setSlot(s, at, cur, to, 0, 0, drawMs(cfg.rows.motesFall.ms, seqBase + FALL_SALT + i));
    }
    return spanOf(fallSlots);
  }

  // Scrap plan: burning scraps start in descending index order, gapMs apart; each burns over its span.
  function planScrap(): number {
    const r = cfg.rows.scrapBurn;
    clearSlots(scrapSlots);
    let k = 0;
    for (let i = scrapSlots.length - 1; i >= 0; i -= 1) {
      const s = scrapSlots[i];
      const cur = t.scrapBurn[i] ?? 0;
      const to = goal.scrapBurn[i] ?? 0;
      if (s === undefined || to === cur) continue;
      setSlot(s, k * r.gapMs, cur, to, 0, 0, r.ms);
      k += 1;
    }
    return spanOf(scrapSlots);
  }

  // Ring plan: rings light in index order, one ringMs each, gapMs apart (ring k starts at k x (ringMs + gapMs)).
  function planRings(): number {
    const r = cfg.rows.chladni;
    clearSlots(ringSlots);
    let k = 0;
    for (let i = 0; i < ringSlots.length; i += 1) {
      const s = ringSlots[i];
      const cur = t.chladni[i] ?? 0;
      const to = goal.chladni[i] ?? 0;
      if (s === undefined || to === cur) continue;
      setSlot(s, k * (r.ringMs + r.gapMs), cur, to, 0, 0, r.ringMs);
      k += 1;
    }
    return spanOf(ringSlots);
  }

  // A single ramp (breathe, pulse, freeze): from the value on screen to the goal over spanMs.
  function planScalar(s: Slot, cur: number, to: number, spanMs: number): number {
    if (cur === to) {
      s.on = false;
      return -1;
    }
    setSlot(s, 0, cur, to, 0, 0, spanMs);
    return spanMs;
  }

  // Girl window plan: the alpha and the slow flicker ramp together over girlWindow.ms.
  function planGirl(): number {
    const span = cfg.rows.girlWindow.ms;
    if (t.girlWindow.alpha === goal.girlWindow.alpha) girlAlpha.on = false;
    else setSlot(girlAlpha, 0, t.girlWindow.alpha, goal.girlWindow.alpha, 0, 0, span);
    if (t.girlWindow.slowK === goal.girlWindow.slowK) girlSlow.on = false;
    else setSlot(girlSlow, 0, t.girlWindow.slowK, goal.girlWindow.slowK, 0, 0, span);
    return spanOf(seqSlots.girlWindow);
  }

  // Plans one sequence row from the values on screen to the goal. Returns the item span (0 flips at its start), or -1 when nothing moves.
  function planSeq(row: SeqRow): number {
    seqBase += HASH_STRIDE;
    items[row].order = SEQ_ORDER[row];
    switch (row) {
      case 'lamp':
        return planLamp();
      case 'booth':
        return planBooth();
      case 'windows':
        return planWindows();
      case 'breatheK':
        return planScalar(breatheSlot, t.breatheK, goal.breatheK, cfg.rows.breathe.ms);
      case 'pulseK':
        return planScalar(pulseSlot, t.pulseK, goal.pulseK, cfg.rows.breathe.ms);
      case 'girlWindow':
        return planGirl();
      case 'motes':
        return planMotes();
      case 'motesFreezeK':
        return planScalar(freezeSlot, t.motesFreezeK, goal.motesFreezeK, cfg.rows.motesFreeze.ms);
      case 'moteFall':
        return planMoteFall();
      case 'scrapBurn':
        return planScrap();
      case 'chladni':
        return planRings();
    }
  }

  function retargetSeq(row: SeqRow): void {
    const it = items[row];
    const span = planSeq(row);
    if (row === 'booth') it.waitLamp = lampMoved;
    if (span < 0) {
      cancel(it);
      return;
    }
    it.durMs = span;
    it.elapsedMs = 0;
    if (!it.active) {
      setActive(it, true);
      it.startedAtMs = null;
    }
  }

  function setTarget(state: WorldVisualState, _nowMs: number, gates: QueueGates): void {
    for (const key of WANT_KEYS) prev[key] = wanted[key];
    fillWanted(wanted, state);
    for (const key of WANT_KEYS) changed[key] = wanted[key] !== prev[key];
    const eraChanged = state.era !== eraNow;
    eraNow = state.era;
    for (const row of SEQ_ROWS) copySeqRow(prevGoal, goal, row);
    writeGoal(goal, state);
    lampMoved = seqDiffers(prevGoal, goal, 'lamp');
    for (const row of ROWS) {
      if (isSeqRow(row)) {
        if (seqDiffers(prevGoal, goal, row)) retargetSeq(row);
        continue;
      }
      const rowChanged = row === 'virga' ? changed.virgaAlpha || changed.virgaSpeed : changed[row];
      if (rowChanged) retarget(row, gates.reduced);
      else if (eraChanged && (row === 'hole' || row === 'puddle' || row === 'sprout')) dropPending(row);
    }
    if (gates.ending !== 'none') snapRows();
  }

  function step(nowMs: number, dtMs: number, gates: QueueGates, cues: QueueCues): WorldTween {
    reducedNow = gates.reduced;
    if (gates.ending !== 'none') {
      snapRows();
      return t;
    }
    if (gateUp(gates)) {
      wasGated = true;
      return t;
    }
    if (wasGated) {
      releaseAtMs = nowMs + cfg.startAfterCloseMs;
      wasGated = false;
    }
    createCounts(cues);
    if (settleOn) {
      snapRows();
      return t;
    }
    // Idle (nothing queued or running; createCounts just found no count row to start): advance, start and write would do nothing.
    if (activeCount === 0) return t;
    advance(Math.min(dtMs, Math.max(0, nowMs - releaseAtMs)));
    startNext(nowMs, cues);
    writeStarted();
    return t;
  }

  function snap(state: WorldVisualState): void {
    eraNow = state.era;
    fillWanted(wanted, state);
    writeGoal(goal, state);
    snapRows();
  }

  function pending(): readonly TransitionInfo[] {
    view.length = 0;
    for (let j = 0; j < activeCount; j += 1) {
      const it = activeList[j];
      if (it === undefined) continue;
      const info = infos[it.row];
      info.startedAtMs = it.startedAtMs;
      info.durMs = it.durMs;
      info.k = it.startedAtMs === null ? 0 : kOf(it);
      view.push(info);
    }
    return view;
  }

  return {
    setTarget,
    step,
    snap,
    settle(on: boolean): void {
      settleOn = on;
    },
    pending,
    tween: () => t,
  };
}

// Blend or count progress of an item (1 when it has no span).
function kOf(it: Item): number {
  return it.durMs > 0 ? Math.min(1, it.elapsedMs / it.durMs) : 1;
}

// Stare: an actor's walker turns to the camera once the stare has spread past its offset (WORLD_TRANSITIONS.rows.stare).
export function stareActive(actor: 'inspector' | 'dog' | 'crow' | 'girl', stare: boolean, stareK: number): boolean {
  return stare && stareK >= WORLD_TRANSITIONS.rows.stare.offsets[actor];
}
