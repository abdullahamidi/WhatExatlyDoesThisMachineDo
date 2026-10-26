// Living world clocks (WP24 T10b): one owner of the day clock, the weather, the micro-event schedules, the vent and gust cues and the
// transition queue. Why: the director keeps one instance, and the whole time side is unit-tested on fake clocks. step() advances the clock
// by dt (zero while the tape is frozen), moves the day minute toward its target (the ending phases and settle snap it), eases the base
// wind, runs the cue chains and the micro schedules, and drives the queue. Every number comes from src/data (WORLD_DAY, WORLD_WEATHER,
// WORLD_AMBIENT, and WORLD_BEHAVIOUR.advanceStepMs for the target cadence); the era identities below are structural.
// Pure: no Phaser, no DOM, no Date. Times are simulation ms on the clock (zero at reset). step() reuses one output object.
import type { EndingPhase, ResourceId, TechId } from '../../data/types';
import { WORLD_BEHAVIOUR } from '../../data/worldBehaviour';
import { WORLD_AMBIENT, WORLD_DAY } from '../../data/worldDay';
import type { MicroKind } from '../../data/worldDay';
import { createTransitionQueue } from './worldTransitions';
import type { QueueCues, QueueGates, TransitionInfo, WorldTween } from './worldTransitions';
import {
  dayProgress, dayTargetMin, dayTint, dustDriftAt, easeBaseWind, gustAt, lampGain, microActive, microAt, shadowOf, stepDayMin,
  ventPuffAt, weatherOf, windAt,
} from './worldDay';
import type { Ambient, WeatherState } from './worldDay';
import type { WorldEra, WorldVisualState } from './worldState';

export interface ClocksInput {
  state: WorldVisualState;
  levels: Readonly<Record<TechId, number>>;
  lifetime: Readonly<Record<ResourceId, number>>;
  edition: 'full' | 'demo';
  phase: EndingPhase;
  cycle: number;
  reduced: boolean;
  gates: { indexOpen: boolean; eraCardUp: boolean; modalOpen: boolean };
  digBouts: number;
  frozen: boolean;
}

export interface ClocksOut {
  tween: WorldTween;
  ambient: Ambient;
  tint: number;
  tintSnap: boolean;
  ventPuffs: number;
  gusts: number;
  min: number;
  target: number;
}

export interface WorldClocks {
  setTarget(i: ClocksInput, nowMs: number): void;
  step(dtMs: number, nowMs: number, i: ClocksInput): ClocksOut;
  snap(i: ClocksInput): void;
  settle(on: boolean): void;
  settling(): boolean;
  holdDay(min: number | null): void;
  debugDay(): {
    min: number; target: number; tint: number; wind: number; weather: string; held: boolean;
    micro: { hitch: boolean; clockTwitch: boolean; lampDip: boolean; boothDip: boolean };
  };
  transitions(): readonly TransitionInfo[];
  reset(seed: number): void;
}

// Structural era identities, not tuning: the front era (vent puffs, D6) and the held 16:41 key (the era V key at p 1, D5).
const VENT_ERA: WorldEra = 3;
const HELD_ERA: WorldEra = 5;
const HELD_P = 1;
// The day target is read at the director's sub-step (advanceStepMs of clock time).
const DAY_CADENCE_MS = WORLD_BEHAVIOUR.advanceStepMs;
const MICRO_KINDS = Object.keys(WORLD_AMBIENT.micro) as MicroKind[];

// One micro schedule: event k starts at startAt and holds until holdEnd. A schedule is armed while its kind runs; it re-arms from the
// present when the kind comes back (an era or gate change), and keeps its count k so the hashed sequence goes on.
interface MicroTimer { k: number; armed: boolean; startAt: number; holdEnd: number }

// Finite non-negative ms, else 0.
function msOf(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// The time of the next event: at + gap, or never when the gap cannot advance the schedule (zero or negative).
function later(at: number, gap: number): number {
  return gap > 0 ? at + gap : Infinity;
}

function freshTimer(k: number): MicroTimer {
  return { k, armed: false, startAt: Infinity, holdEnd: -Infinity };
}

// Under reduced motion (D10, D15) the tracking hitch, the clock twitch and the lamp and booth buzz dips stay off (a buzz dip is a
// luminance flicker: the lamp and booth keep their plain fades). The LED, the window dim and the page counter stay.
function reducedOff(kind: MicroKind): boolean {
  return kind === 'hitch' || kind === 'clockTwitch' || kind === 'lampDip' || kind === 'boothDip';
}

function blankWeather(): WeatherState {
  return { era: 1, label: 'dry', baseWind: 0, gusts: false, virgaAlpha: 0, virgaSpeed: 0, dustDrift: false, vents: false };
}

export function createWorldClocks(seed0: number): WorldClocks {
  let seed = seed0;
  let queue = createTransitionQueue();
  const gates: QueueGates = { indexOpen: false, eraCardUp: false, modalOpen: false, ending: 'none', reduced: false };
  const cues: QueueCues = { digBouts: 0, ventPuffs: 0 };
  const live: WeatherState = blankWeather();
  const ambient: Ambient = {
    wind: 0, dustDrift: 1, virgaAlpha: 0, virgaSpeed: 0, lampGain: 1, shadowDx: 0, shadowWidth: 1, mainsMs: 0, micro: queue.tween().micro,
  };
  const out: ClocksOut = {
    tween: queue.tween(), ambient, tint: 0, tintSnap: false, ventPuffs: 0, gusts: 0, min: WORLD_DAY.startMin, target: WORLD_DAY.startMin,
  };

  let clockMs = 0;                                // clock time since reset (frozen while the tape is)
  let presented: number = WORLD_DAY.startMin;     // the presented minute: never falls within a cycle
  let targetMin: number = WORLD_DAY.startMin;
  let progressP = 0;                              // the tape position p of the day, read at the cadence
  let dayAgeMs = Infinity;                        // clock ms since the day was read (Infinity: read at the next step)
  let holdMin: number | null = null;              // the debug pin of the minute (holdDay)
  let settleOn = false;
  let pendingSnap = false;                        // the next step() output carries tintSnap
  let baseWind = 0;                               // the eased base wind
  // The wind and the dust drift of the last sample (WP24 r4-F1). windAt and dustDriftAt are pure in (clock, weather, seed), so a step on
  // the same clock with the same weather (a frozen tape) keeps the sample; a reset (new seed) clears it through clear().
  let sampleMsAt = NaN;
  let sampleBase = 0;
  let sampleGusts = false;
  let sampleDust = false;
  let sampleWind = 0;
  let sampleDustDrift = 1;
  let wx: WeatherState = blankWeather();          // the era weather at the last read
  let lastEra: WorldEra | null = null;            // the discrete inputs of the last read: a change reads at once
  let lastPhase: EndingPhase | null = null;
  let lastVents: boolean | null = null;
  let ventCount = 0;                              // vent puffs since reset
  let ventK = 0;
  let ventAtMs = Infinity;                        // the next vent puff on the clock
  let gustCount = 0;                              // gust events since reset
  let gustK = 0;
  let gustStartMs = Infinity;                     // the next gust event on the clock (the wind's own gust track)
  let gustLenMs = 0;
  let pageStarts = 0;
  let shadowDx = 0;                               // the shadow shift and widening, read at the cadence (shadowOf allocates)
  let shadowWidth = 1;
  let tintMin = 0;                                // the presented minute of the cached tint and lamp gain (see step)
  let tintDirty = true;                           // a pin, settle or reset: the next step computes both at once
  let tintCache = 0;
  let lampCache = 1;
  let timers = {} as Record<MicroKind, MicroTimer>;

  function fillGates(i: ClocksInput): void {
    gates.indexOpen = i.gates.indexOpen;
    gates.eraCardUp = i.gates.eraCardUp;
    gates.modalOpen = i.gates.modalOpen;
    gates.ending = i.phase;
    gates.reduced = i.reduced;
  }

  // The next gust event after one that ends at endMs: a gap of afterMs, then its length (the same chain as the wind's gust track).
  function armGust(endMs: number): void {
    const g = gustAt(gustK, seed);
    gustStartMs = g.afterMs + g.lengthMs > 0 ? endMs + g.afterMs : Infinity;
    gustLenMs = g.lengthMs;
  }

  // Clock state back to a fresh clock on the current seed (the queue is kept by the caller).
  function clear(): void {
    ambient.mainsMs = 0;
    clockMs = 0;
    presented = WORLD_DAY.startMin;
    targetMin = WORLD_DAY.startMin;
    progressP = 0;
    readShadow();
    dayAgeMs = Infinity;
    holdMin = null;
    settleOn = false;
    pendingSnap = false;
    tintDirty = true;
    sampleMsAt = NaN;
    baseWind = 0;
    wx = blankWeather();
    lastEra = null;
    lastPhase = null;
    lastVents = null;
    ventCount = 0;
    ventK = 0;
    ventAtMs = later(0, ventPuffAt(0, seed));
    gustCount = 0;
    gustK = 0;
    armGust(0);
    pageStarts = 0;
    timers = {} as Record<MicroKind, MicroTimer>;
    for (const kind of MICRO_KINDS) timers[kind] = freshTimer(0);
  }

  function reset(s: number): void {
    seed = s;
    queue = createTransitionQueue();
    clear();
  }

  // Reads the day (progress, target) and the era weather from the input.
  function refresh(i: ClocksInput): void {
    progressP = dayProgress(i).p;
    targetMin = dayTargetMin(i);
    wx = weatherOf(i.state.era, progressP, i.phase, i.state.vents);
    lastEra = i.state.era;
    lastPhase = i.phase;
    lastVents = i.state.vents;
    dayAgeMs = 0;
  }

  // The presented minute: the held pin, then the ending phases (16:41 at once), settle (the target at once), else the eased walk.
  function stepDay(dtMs: number, ending: boolean): void {
    if (holdMin !== null) {
      presented = holdMin;
      targetMin = holdMin;
      return;
    }
    if (ending) {
      presented = WORLD_DAY.heldMin;
      targetMin = WORLD_DAY.heldMin;
      return;
    }
    presented = settleOn ? targetMin : stepDayMin(presented, targetMin, dtMs);
  }

  // Vent puffs (era III with the valves, not ending) and gust events (the era's weather gusts) run as chains on the clock: they go on
  // while the cue is off and count only while it is on, so the wind's gust bumps and the gust cues line up.
  function advanceCues(ending: boolean, i: ClocksInput): void {
    const ventsOn = !ending && i.state.era === VENT_ERA && i.state.vents;
    while (ventAtMs <= clockMs) {
      if (ventsOn) ventCount += 1;
      ventK += 1;
      ventAtMs = later(ventAtMs, ventPuffAt(ventK, seed));
    }
    while (gustStartMs <= clockMs) {
      if (live.gusts) gustCount += 1;
      const endMs = gustStartMs + gustLenMs;
      gustK += 1;
      armGust(endMs);
    }
  }

  // A micro kind runs in its eras (microActive) and outside the ending phases; lampDip needs a lit lamp, boothDip a lit booth.
  function microOn(kind: MicroKind, i: ClocksInput, ending: boolean): boolean {
    if (ending || !microActive(kind, i.state.era)) return false;
    if (kind === 'lampDip') return i.state.props.lamp !== 'dead';
    if (kind === 'boothDip') return i.state.props.boothLit;
    return true;
  }

  // Runs one micro schedule to the clock: starts due events (the hold and the gap to the next one by hash), counts pages, and returns
  // whether the clock is inside the last hold. Off kinds stop and re-arm when they come back.
  function runMicro(kind: MicroKind, on: boolean, era: WorldEra): boolean {
    const tm = timers[kind];
    if (!on) {
      tm.armed = false;
      tm.holdEnd = -Infinity;
      return false;
    }
    if (!tm.armed) {
      tm.armed = true;
      tm.holdEnd = -Infinity;
      tm.startAt = later(clockMs, microAt(kind, tm.k, seed, era).afterMs);
    }
    while (tm.startAt <= clockMs) {
      tm.holdEnd = tm.startAt + microAt(kind, tm.k, seed, era).holdMs;
      if (kind === 'pages') pageStarts += 1;
      tm.k += 1;
      tm.startAt = later(tm.holdEnd, microAt(kind, tm.k, seed, era).afterMs);
    }
    return clockMs < tm.holdEnd;
  }

  function readShadow(): void {
    const sh = shadowOf(presented);
    shadowDx = sh.dx;
    shadowWidth = sh.widthScale;
  }

  // Reads the day and weather now (a snap lands at once), and the cues and micro schedules re-arm from now.
  function snap(i: ClocksInput): void {
    queue.snap(i.state);
    refresh(i);
    presented = holdMin ?? targetMin;
    targetMin = presented;
    readShadow();
    baseWind = wx.baseWind;
    pendingSnap = true;
    const flags = queue.tween().micro;
    for (const kind of MICRO_KINDS) {
      timers[kind] = freshTimer(timers[kind].k);
      if (kind !== 'pages') flags[kind] = false;
    }
  }

  function step(dtMs: number, nowMs: number, i: ClocksInput): ClocksOut {
    const dt = i.frozen ? 0 : msOf(dtMs);
    clockMs += dt;
    const ending = i.phase !== 'none';
    dayAgeMs += dt;
    const read = i.state.era !== lastEra || i.phase !== lastPhase || i.state.vents !== lastVents || dayAgeMs >= DAY_CADENCE_MS;
    if (read) refresh(i);
    stepDay(dt, ending);
    if (read) readShadow();
    // The ending phases and settle set the base wind directly (the postgame stays 0); otherwise it eases at windSlewPerS.
    const direct = ending || settleOn;
    baseWind = direct ? wx.baseWind : easeBaseWind(baseWind, wx.baseWind, dt);
    live.era = i.state.era;
    live.label = wx.label;
    live.baseWind = baseWind;
    live.gusts = wx.gusts && !direct;
    live.virgaAlpha = wx.virgaAlpha;
    live.virgaSpeed = wx.virgaSpeed;
    live.dustDrift = wx.dustDrift;
    live.vents = i.state.vents;
    // The wind and dust drift are sampled again only when their inputs moved (the clock, the base wind, the gusts flag, the dust flag):
    // a frozen tape keeps the sample, and every moving step samples at its own clock, as before.
    if (clockMs !== sampleMsAt || live.baseWind !== sampleBase || live.gusts !== sampleGusts || live.dustDrift !== sampleDust) {
      sampleMsAt = clockMs;
      sampleBase = live.baseWind;
      sampleGusts = live.gusts;
      sampleDust = live.dustDrift;
      sampleWind = windAt(clockMs, live, seed);
      sampleDustDrift = dustDriftAt(clockMs, live);
    }
    advanceCues(ending, i);
    fillGates(i);
    cues.digBouts = i.digBouts;
    cues.ventPuffs = ventCount;
    // A frozen tape starts nothing: the queue waits unless an ending or settle lands its rows at once (no progress involved).
    const tween = i.frozen && !ending && !settleOn ? queue.tween() : queue.step(nowMs, dt, gates, cues);
    const micro = tween.micro;
    for (const kind of MICRO_KINDS) {
      const flag = runMicro(kind, microOn(kind, i, ending), i.state.era);
      if (kind === 'pages') continue;
      micro[kind] = flag && !(i.reduced && reducedOff(kind));
    }
    micro.pageStarts = pageStarts;
    ambient.wind = sampleWind;
    ambient.mainsMs = clockMs;
    ambient.dustDrift = sampleDustDrift;
    ambient.virgaAlpha = wx.virgaAlpha;
    ambient.virgaSpeed = wx.virgaSpeed;
    // The tint and the lamp gain are cached. They are recomputed on a read (the cadence, or an era, phase or vent change: the ending
    // phases enter through the phase change), a snap, a pin or settle, and once the presented minute has moved a whole minute. So a
    // cached tint is at most one minute behind the presented minute, and every hold, snap, settle and ending lands on the next step.
    if (read || pendingSnap || tintDirty || Math.abs(presented - tintMin) >= 1) {
      tintMin = presented;
      tintDirty = false;
      tintCache = ending ? dayTint(WORLD_DAY.heldMin, HELD_ERA, HELD_P) : dayTint(presented, i.state.era, progressP);
      lampCache = lampGain(presented);
    }
    ambient.lampGain = lampCache;
    ambient.shadowDx = shadowDx;
    ambient.shadowWidth = shadowWidth;
    ambient.micro = micro;
    out.tween = tween;
    out.tint = tintCache;
    out.tintSnap = pendingSnap;
    pendingSnap = false;
    out.ventPuffs = ventCount;
    out.gusts = gustCount;
    out.min = presented;
    out.target = targetMin;
    return out;
  }

  clear();

  return {
    setTarget(i, nowMs) {
      fillGates(i);
      queue.setTarget(i.state, nowMs, gates);
    },
    step,
    snap,
    settle(on) {
      settleOn = on;
      tintDirty = true;
      queue.settle(on);
    },
    settling: () => settleOn,
    holdDay(min) {
      holdMin = min;
      tintDirty = true;
      if (min !== null) {
        presented = min;
        targetMin = min;
      }
    },
    debugDay: () => {
      const micro = queue.tween().micro;
      return {
        min: presented, target: targetMin, tint: out.tint, wind: ambient.wind, weather: wx.label, held: holdMin !== null,
        micro: { hitch: micro.hitch, clockTwitch: micro.clockTwitch, lampDip: micro.lampDip, boothDip: micro.boothDip },
      };
    },
    transitions: () => queue.pending(),
    reset,
  };
}
