import type { EndingPhase } from '../../data/types';
import {
  FINALE_BEAM, FINALE_BIRDS, FINALE_BOOST, FINALE_CAMERA, FINALE_CUT, FINALE_DUST, FINALE_ECLIPSE, FINALE_PLATE,
  FINALE_REVEAL, FINALE_SEEDS, FINALE_SHOTS, FINALE_TRACKS, FINALE_VIEWS, FINALE_WHITE, FINALE_WIPE, FINALE_BEATS, FINALE_COMPLETE,
} from '../../data/finale';
import type { CompleteEra, FinaleBeat, FinaleTrackId, FinaleViewId } from '../../data/finale';
import { APERTURE_BEAM, MACHINE_ANCHOR, PIXEL_SCALE, VIEW, WORLD } from '../../data/world';

// WP13 finale maths: the storyboard (ART_ERA5 §7) as pure functions of the finale clock t (seconds since the
// ending sequence started). Every number comes from src/data/finale.ts or src/data/world.ts. No Phaser, no DOM,
// no random source: sub-random values come from a sine hash of their integer inputs.

export type FinaleShot = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

export interface CameraPose { centerX: number; centerY: number; zoom: number }

export interface FinaleFrame {
  active: boolean;                 // phase 'sequence' | 'choice' (input locked, HUD hidden, overlay shown)
  t: number;
  shot: FinaleShot | null;
  restored: boolean;               // name plate endingFrame: t >= FINALE_PLATE.atS, or phase choice/postgame
  tracks: Record<FinaleTrackId, number>;                    // 0..1
  wipe: { mode: 'hidden' | 'wipe' | 'fade' | 'full'; halfWidthPx: readonly [number, number, number, number]; alpha: number };  // [ground, r1, r2, r3]
  overlay: { alpha: number; color: number };               // white fade or reduced-motion cut fade (screen rect)
  beam: { violet: boolean; whiteHeadPx: number; animate: boolean };
  eclipse: { kind: 'stage' } | { kind: 'frame'; frame: number } | { kind: 'hidden' };
  dust: 'normal' | 'reverse' | 'stopped';
  seeds: 'off' | 'finale' | 'postgame';
  birds: 'off' | 'finale' | 'postgame';
  boost: number;                   // 0..1 driver boost
  completeEra: CompleteEra;       // WP18 completion beat: era whose visual max the machine shows (0 = real levels)
  camera: CameraPose | null;       // null = CameraController owns the camera
}

/** Reveal timing as typewriter reads it (FINALE_REVEAL satisfies this structurally). */
export interface RevealCfg {
  startS: number;
  nameplateFadeMs: number;
  holdS: number;
  cps: number;
  linePauseS: number;
  lines: readonly string[];
  lastLine: string;
  buttonsDelayS: number;
}

/** Flock geometry as birdPose reads it (FINALE_BIRDS satisfies this structurally). */
export interface BirdCfg {
  speedPx: number;
  skyY: readonly [number, number];
  spacingPx: { x: number; y: number };
  flapHz: number;
  bobPx: number;
  bobHz: number;
}

export interface TypewriterState {
  nameplateAlpha: number;
  lines: { text: string; shown: number }[];   // text = full line; shown = visible character count (text.slice(0, shown))
  buttons: boolean;                            // true once the last line is complete + buttonsDelayS
  done: boolean;                               // true once every line is fully shown
}

export interface WipeRect { x: number; y: number; w: number; h: number }

/** Beam height at full head: the aperture foot row (ApertureBeam bottomY) down to world y 0. */
export const BEAM_MAX_PX = MACHINE_ANCHOR.y + PIXEL_SCALE * APERTURE_BEAM.footArtY;
/** Wipe half-extent that reaches the farther world edge from the machine. */
const WIPE_SPAN_PX = Math.max(MACHINE_ANCHOR.x, WORLD.width - MACHINE_ANCHOR.x);
const WIPE_FULL: readonly [number, number, number, number] = [WIPE_SPAN_PX, WIPE_SPAN_PX, WIPE_SPAN_PX, WIPE_SPAN_PX];
const WIPE_NONE: readonly [number, number, number, number] = [0, 0, 0, 0];

function clamp01(x: number): number {
  if (!(x > 0)) return 0; // also rejects NaN
  return x < 1 ? x : 1;
}

/** Cubic ease in-out on k clamped to 0..1. */
export function easeInOutCubic(k: number): number {
  const c = clamp01(k);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/** Cubic ease out on k clamped to 0..1. */
export function easeOutCubic(k: number): number {
  const c = clamp01(k);
  return 1 - Math.pow(1 - c, 3);
}

/** Sine hash of two integers in [0, 1): deterministic, no random source. */
function hash01(a: number, b: number): number {
  const f = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return f - Math.floor(f);
}

/** Seconds from the reveal start to the last line (the S5 start), from the typing data. */
function lastLineStartS(cfg: RevealCfg): number {
  let at = cfg.nameplateFadeMs / 1000 + cfg.holdS; // name plate fades, then holds
  for (const line of cfg.lines) at += line.length / cfg.cps + cfg.linePauseS; // each body line types, then pauses
  return at;
}

/** Film time at which the choice opens: reveal start + the last line's start (= 62.6 with the C3 data). */
export function choiceStartS(cfg: RevealCfg = FINALE_REVEAL): number {
  return cfg.startS + lastLineStartS(cfg);
}

/**
 * Film time at which the buttons are up (= the earliest t where typewriter(...).buttons is true). Normal: choice start +
 * last line typing + buttonsDelayS (= 64.47 with the C3 data). reduced: the last line appears whole, so choice start +
 * buttonsDelayS.
 */
export function finaleEndS(cfg: RevealCfg = FINALE_REVEAL, reduced = false): number {
  const typing = reduced ? 0 : cfg.lastLine.length / cfg.cps;
  return choiceStartS(cfg) + typing + cfg.buttonsDelayS;
}

/** Storyboard shot at film time t (S5 from choiceStartS). Below FINALE_SHOTS.s1 it is S0. */
export function shotAt(t: number): FinaleShot {
  if (t >= choiceStartS()) return 'S5';
  if (t >= FINALE_SHOTS.s4) return 'S4';
  if (t >= FINALE_SHOTS.s3) return 'S3';
  if (t >= FINALE_SHOTS.s2) return 'S2';
  if (t >= FINALE_SHOTS.s1) return 'S1';
  return 'S0';
}

/** Camera pose of a named view: world = MACHINE_ANCHOR + PIXEL_SCALE * art (full 1920,1080,.5 · crown 2048,640,1 · baseL 1320,1380,1 · baseR 2520,1380,1). */
export function viewPose(view: FinaleViewId): CameraPose {
  const v = FINALE_VIEWS[view];
  return {
    centerX: MACHINE_ANCHOR.x + PIXEL_SCALE * v.artX,
    centerY: MACHINE_ANCHOR.y + PIXEL_SCALE * v.artY,
    zoom: v.zoom,
  };
}

/**
 * Camera pose at film time t. Before the first key: start. Each FINALE_CAMERA key tweens from the previous pose to
 * its view over durS (cubic in-out). reduced: no tween, a cut at key.atS + fadeMs/2 with cutFade a triangle 0 -> 1 -> 0
 * over fadeMs (the fade covers the jump). reduced 'skip' keys (WP18 survey) are not applied at all under reduced motion.
 */
export function cameraPoseAt(t: number, start: CameraPose, reduced: boolean): { pose: CameraPose; cutFade: number } {
  const fadeS = FINALE_CUT.fadeMs / 1000;
  let from: CameraPose = start;
  let pose: CameraPose = start;
  let cutFade = 0;
  for (const key of FINALE_CAMERA) {
    // survey keys do not exist under reduced motion (no pose change, no cut fade, `from` is not advanced)
    if (reduced && key.reduced === 'skip') continue;
    const to = viewPose(key.to);
    if (reduced) {
      const cutAt = key.atS + fadeS / 2;
      const d = Math.abs(t - cutAt);
      if (d < fadeS / 2) cutFade = Math.max(cutFade, 1 - d / (fadeS / 2));
      if (t >= key.atS) pose = t >= cutAt ? to : from;
    } else {
      if (t < key.atS) break;
      const e = easeInOutCubic((t - key.atS) / key.durS);
      pose = {
        centerX: from.centerX * (1 - e) + to.centerX * e,
        centerY: from.centerY * (1 - e) + to.centerY * e,
        zoom: from.zoom * (1 - e) + to.zoom * e,
      };
    }
    from = to;
  }
  return { pose, cutFade };
}

/** Linear 0..1 across the track span (FINALE_TRACKS). `_reduced` is accepted for signature parity; reduced only changes the ground draw (fade instead of wipe) in finaleFrame. */
export function trackValue(id: FinaleTrackId, t: number, _reduced: boolean): number {
  const w = FINALE_TRACKS[id];
  return clamp01((t - w.startS) / w.durS);
}

function trackValues(t: number, reduced: boolean): Record<FinaleTrackId, number> {
  return {
    sky: trackValue('sky', t, reduced),
    glow: trackValue('glow', t, reduced),
    mountains: trackValue('mountains', t, reduced),
    skyline: trackValue('skyline', t, reduced),
    ground: trackValue('ground', t, reduced),
  };
}

/** White screen fade: ease-out in to peak over inMs, hold, linear out (never above peak). Reduced: shorter, lower peak. */
export function whiteAlpha(t: number, reduced: boolean): number {
  const w = FINALE_WHITE;
  if (t < w.atS) return 0;
  if (reduced) {
    const inS = w.reduced.inMs / 1000;
    const outS = w.reduced.outMs / 1000;
    if (t < w.atS + inS) return w.reduced.peak * easeOutCubic((t - w.atS) / inS);
    const outAt = w.atS + inS;
    if (t < outAt + outS) return w.reduced.peak * (1 - (t - outAt) / outS);
    return 0;
  }
  const inS = w.inMs / 1000;
  const holdS = w.holdMs / 1000;
  const outS = w.outMs / 1000;
  const peakAt = w.atS + inS;
  if (t < peakAt) return w.peak * easeOutCubic((t - w.atS) / inS);
  if (t < peakAt + holdS) return w.peak;
  const outAt = peakAt + holdS;
  if (t < outAt + outS) return w.peak * (1 - (t - outAt) / outS);
  return 0;
}

/** Driver boost 0..1: ramps up over [startS, startS + rampS], holds, ramps down over [releaseS, releaseS + releaseRampS]. */
export function boost01(t: number): number {
  const b = FINALE_BOOST;
  if (t <= b.startS) return 0;
  if (t < b.startS + b.rampS) return easeInOutCubic((t - b.startS) / b.rampS);
  if (t < b.releaseS) return 1;
  return 1 - easeInOutCubic((t - b.releaseS) / b.releaseRampS);
}

/** Driver value under the finale boost: max(actual, actual + (max - actual) * boost01), boost clamped to 0..1. */
export function boostedValue(actual: number, max: number, boost: number): number {
  const b = clamp01(boost);
  return Math.max(actual, actual + (max - actual) * b);
}

/** Completion beat (WP18): era of the last FINALE_COMPLETE step with atS <= t; 0 before the first step and for a non-finite t. */
export function completeEraAt(t: number): CompleteEra {
  if (!Number.isFinite(t)) return 0;
  let era: CompleteEra = 0;
  for (const step of FINALE_COMPLETE.steps) if (t >= step.atS) era = step.era;
  return era;
}

/** White beam head height (world px above the mouth). 0 before whiteAtS; reduced: full at once; else headPxPerS, capped at BEAM_MAX_PX. */
export function beamHeadPx(t: number, reduced: boolean): number {
  if (t < FINALE_BEAM.whiteAtS) return 0;
  if (reduced) return BEAM_MAX_PX;
  return Math.min(BEAM_MAX_PX, (t - FINALE_BEAM.whiteAtS) * FINALE_BEAM.headPxPerS);
}

/**
 * Eclipse sprite state. Stage until diamondAtS (reduced: until restoreAtS, no diamond ring); diamond frame until
 * restoreAtS; then steps every stepS; frame 0 (after the last step) is hidden.
 */
export function eclipseAt(t: number, reduced: boolean): FinaleFrame['eclipse'] {
  const e = FINALE_ECLIPSE;
  if (t < (reduced ? e.restoreAtS : e.diamondAtS)) return { kind: 'stage' };
  if (t < e.restoreAtS) return { kind: 'frame', frame: e.diamondFrame };
  const k = Math.floor((t - e.restoreAtS) / e.stepS + 1e-9);
  const step = e.steps[k];
  if (step === undefined || step === 0) return { kind: 'hidden' };
  return { kind: 'frame', frame: step };
}

/** Wipe half-width of one layer: grows at pxPerS from startS + lagS; 0 before. */
export function wipeHalfWidthPx(t: number, lagS: number): number {
  return Math.max(0, (t - FINALE_WIPE.startS - lagS) * FINALE_WIPE.pxPerS);
}

/** Edge offset of one wipe band in px: deterministic per (band, seed), 0..maxStepPx in stepPx steps. */
export function wipeEdgeOffsetPx(band: number, seed: number): number {
  const steps = Math.floor(FINALE_WIPE.maxStepPx / FINALE_WIPE.stepPx);
  const h = hash01(Math.floor(band), seed);
  return Math.min(steps, Math.floor(h * (steps + 1))) * FINALE_WIPE.stepPx;
}

/**
 * Mask rects for one wipe layer: one rect per bandPx band (last band partial), spanning centerX +- (halfWidth + edge
 * offset of the band), clamped to [0, worldWidth]. halfWidth <= 0 gives zero-width rects (count is unchanged).
 */
export function wipeRects(halfWidth: number, centerX: number, topY: number, heightPx: number, worldWidth: number, seed: number): WipeRect[] {
  if (!(heightPx > 0)) return [];
  const band = FINALE_WIPE.bandPx;
  const count = Math.ceil(heightPx / band);
  const rects: WipeRect[] = [];
  for (let i = 0; i < count; i++) {
    const y = topY + i * band;
    const h = Math.min(band, heightPx - i * band);
    if (!(halfWidth > 0)) {
      rects.push({ x: centerX, y, w: 0, h });
      continue;
    }
    const off = wipeEdgeOffsetPx(i, seed);
    const left = Math.max(0, centerX - halfWidth - off);
    const right = Math.min(worldWidth, centerX + halfWidth + off);
    rects.push({ x: left, y, w: Math.max(0, right - left), h });
  }
  return rects;
}

/** True once the wipe front (plus the largest edge step) covers the farther world edge. */
export function wipeComplete(halfWidth: number, centerX: number, worldWidth: number): boolean {
  const need = Math.max(centerX, worldWidth - centerX);
  return halfWidth + FINALE_WIPE.maxStepPx >= need;
}

function lineShown(text: string, t: number, start: number, cps: number, reduced: boolean): number {
  if (t < start) return 0;
  if (reduced) return text.length;
  return Math.min(text.length, Math.floor((t - start) * cps + 1e-9));
}

/**
 * Reveal panel at tSinceReveal (seconds since FINALE_REVEAL.startS). Name plate fades in over nameplateFadeMs; then the
 * lines (lines + lastLine) start one after another: each types at cps and is followed by linePauseS. Reduced: each line
 * appears whole at its start time. buttons after the last line + buttonsDelayS.
 */
export function typewriter(tSinceReveal: number, cfg: RevealCfg, reduced: boolean): TypewriterState {
  const t = Number.isFinite(tSinceReveal) ? tSinceReveal : 0;
  const fadeS = cfg.nameplateFadeMs / 1000;
  const nameplateAlpha = fadeS > 0 ? clamp01(t / fadeS) : (t >= 0 ? 1 : 0);
  const texts = [...cfg.lines, cfg.lastLine];
  let at = fadeS + cfg.holdS;
  let lastStart = at;
  let done = true;
  const lines = texts.map((text) => {
    const start = at;
    const shown = lineShown(text, t, start, cfg.cps, reduced);
    if (shown < text.length) done = false;
    lastStart = start;
    at += text.length / cfg.cps + cfg.linePauseS;
    return { text, shown };
  });
  const lastEnd = lastStart + (reduced ? 0 : cfg.lastLine.length / cfg.cps);
  return { nameplateAlpha, lines, buttons: t >= lastEnd + cfg.buttonsDelayS, done };
}

/** Beats with prevT < at <= t, in data order. 'choice' beats fire at choiceStartS(). */
export function beatsBetween(prevT: number, t: number): FinaleBeat[] {
  const s5 = choiceStartS();
  return FINALE_BEATS
    .filter((b) => {
      const at = b.atS === 'choice' ? s5 : b.atS;
      return at > prevT && at <= t;
    })
    .map((b) => b.id);
}

/** Flock number `index`: delay after the previous flock (everyS range) and size (size range). Deterministic. */
export function flockSchedule(index: number, seed: number): { delayS: number; size: number } {
  const [minGap, maxGap] = FINALE_BIRDS.everyS;
  const [minSize, maxSize] = FINALE_BIRDS.size;
  const a = hash01(index * 2, seed);
  const b = hash01(index * 2 + 1, seed);
  const delayS = minGap + (maxGap - minGap) * a;
  const size = minSize + Math.min(maxSize - minSize, Math.floor(b * (maxSize - minSize + 1)));
  return { delayS, size };
}

/**
 * Screen pose of bird i of a flock that started tSinceFlock seconds ago. x is the bird's LEFT edge in screen px:
 * the flock enters at the right edge, bird 0 leads (leftmost). null before the flock starts or once the bird's
 * left edge is off the left edge of the screen.
 */
export function birdPose(tSinceFlock: number, i: number, cfg: BirdCfg = FINALE_BIRDS): { x: number; y: number; frame: 0 | 1 } | null {
  if (!(tSinceFlock >= 0)) return null;
  const x = VIEW.width - cfg.speedPx * tSinceFlock + i * cfg.spacingPx.x;
  if (x < 0) return null;
  const row = i % 2 === 1 ? cfg.spacingPx.y : 0;
  const y = cfg.skyY[0] + row + cfg.bobPx * Math.sin(2 * Math.PI * cfg.bobHz * tSinceFlock + i);
  const frame: 0 | 1 = Math.floor(tSinceFlock * cfg.flapHz) % 2 === 0 ? 0 : 1;
  return { x, y, frame };
}

function allWipes(t: number): [number, number, number, number] {
  const [a, b, c] = FINALE_WIPE.regrowthLagS;
  return [wipeHalfWidthPx(t, 0), wipeHalfWidthPx(t, a), wipeHalfWidthPx(t, b), wipeHalfWidthPx(t, c)];
}

function wipeState(t: number, reduced: boolean): FinaleFrame['wipe'] {
  if (t < FINALE_WIPE.startS) return { mode: 'hidden', halfWidthPx: WIPE_NONE, alpha: 0 };
  if (reduced) {
    const g = FINALE_TRACKS.ground;
    if (t < g.startS + g.durS) return { mode: 'fade', halfWidthPx: WIPE_FULL, alpha: trackValue('ground', t, true) };
    return { mode: 'full', halfWidthPx: WIPE_FULL, alpha: 1 };
  }
  const hw = allWipes(t);
  const complete = hw.every((h) => wipeComplete(h, MACHINE_ANCHOR.x, WORLD.width));
  if (complete) return { mode: 'full', halfWidthPx: WIPE_FULL, alpha: 1 };
  return { mode: 'wipe', halfWidthPx: hw, alpha: 1 };
}

function dustMode(t: number): FinaleFrame['dust'] {
  if (t < FINALE_DUST.reverseAtS) return 'normal';
  if (t < FINALE_DUST.reverseAtS + FINALE_DUST.reverseS) return 'reverse';
  return 'stopped';
}

function sequenceFrame(t: number, reduced: boolean, start: CameraPose): FinaleFrame {
  const cam = cameraPoseAt(t, start, reduced);
  const white = whiteAlpha(t, reduced);
  const cut = reduced ? cam.cutFade : 0;
  const cutColor = trackValue('sky', t, reduced) < 0.5 ? FINALE_CUT.colorViolet : FINALE_CUT.colorRestored;
  return {
    active: true,
    t,
    shot: shotAt(t),
    restored: t >= FINALE_PLATE.atS,
    tracks: trackValues(t, reduced),
    wipe: wipeState(t, reduced),
    overlay: cut > white ? { alpha: cut, color: cutColor } : { alpha: white, color: FINALE_WHITE.color },
    beam: { violet: t < FINALE_BEAM.whiteAtS, whiteHeadPx: beamHeadPx(t, reduced), animate: !reduced },
    eclipse: eclipseAt(t, reduced),
    dust: dustMode(t),
    seeds: !reduced && t >= FINALE_SEEDS.startS ? 'finale' : 'off',
    birds: !reduced && t >= FINALE_BIRDS.firstAtS ? 'finale' : 'off',
    boost: boost01(t),
    completeEra: completeEraAt(t),
    camera: cam.pose,
  };
}

function postgameFrame(t: number, reduced: boolean): FinaleFrame {
  const idle: 'off' | 'postgame' = reduced ? 'off' : 'postgame';
  return {
    active: false,
    t,
    shot: null,
    restored: true,
    tracks: { sky: 1, glow: 1, mountains: 1, skyline: 1, ground: 1 },
    wipe: { mode: 'full', halfWidthPx: WIPE_FULL, alpha: 1 },
    overlay: { alpha: 0, color: FINALE_WHITE.color },
    beam: { violet: false, whiteHeadPx: BEAM_MAX_PX, animate: !reduced },
    eclipse: { kind: 'hidden' },
    dust: 'stopped',
    seeds: idle,
    birds: idle,
    boost: 0,
    completeEra: 5,
    camera: null,
  };
}

function neutralFrame(t: number): FinaleFrame {
  return {
    active: false,
    t,
    shot: null,
    restored: false,
    tracks: { sky: 0, glow: 0, mountains: 0, skyline: 0, ground: 0 },
    wipe: { mode: 'hidden', halfWidthPx: WIPE_NONE, alpha: 0 },
    overlay: { alpha: 0, color: FINALE_WHITE.color },
    beam: { violet: true, whiteHeadPx: 0, animate: false },
    eclipse: { kind: 'stage' },
    dust: 'normal',
    seeds: 'off',
    birds: 'off',
    boost: 0,
    completeEra: 0,
    camera: null,
  };
}

/**
 * Everything the renderers need for one frame. none: neutral (today's world). sequence: the film at t. choice: the
 * film's end state (t clamped up to choiceStartS, camera on the FULL view, completeEra 5). postgame: restored world, no
 * overlay, completeEra 5.
 */
export function finaleFrame(i: { phase: EndingPhase; t: number; reduced: boolean; start: CameraPose }): FinaleFrame {
  const t = Number.isFinite(i.t) ? Math.max(0, i.t) : 0;
  if (i.phase === 'sequence') return sequenceFrame(t, i.reduced, i.start);
  if (i.phase === 'choice') {
    const end = sequenceFrame(Math.max(t, choiceStartS()), i.reduced, i.start);
    return { ...end, active: true, restored: true, camera: viewPose('full'), completeEra: 5 };
  }
  if (i.phase === 'postgame') return postgameFrame(t, i.reduced);
  return neutralFrame(t);
}
