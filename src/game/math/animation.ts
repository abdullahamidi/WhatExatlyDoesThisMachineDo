import type { AnimationDriver, SpeedCurve, Vec2 } from '../../data/machineComponents';

/** Clamp v into [lo, hi]. */
function clampTo(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi); // max(v, lo) then min(.., hi)
}

/** Normalise -0 to 0. */
function noNegativeZero(v: number): number {
  return v === 0 ? 0 : v; // -0 === 0 is true, so this returns +0 for both zeros
}

/** Animation speed from a driver value: base * (1 + gain * log10(1 + v)), clamped to [min, max]; 0 for non-positive or non-finite drivers. */
export function animationSpeed(curve: SpeedCurve, driverValue: number): number {
  if (!Number.isFinite(driverValue) || driverValue <= 0) return 0;
  const raw = curve.base * (1 + curve.gain * Math.log10(1 + driverValue)); // base * (1 + gain * log10(1 + v))
  return clampTo(raw, curve.min, curve.max);
}

/** Exponential decay of activity: value * e^(-dt / tau); values below 1e-3 snap to 0; dt <= 0 or non-finite returns value. */
export function decayActivity(value: number, dtSeconds: number, tauSeconds: number): number {
  if (!(dtSeconds > 0) || !Number.isFinite(dtSeconds)) return value;
  const r = value * Math.exp(-dtSeconds / tauSeconds); // value * e^(-dt / tau)
  return r < 1e-3 ? 0 : r; // snap tiny residue to rest
}

/** Add a click impulse to activity: value + gained / tau; non-positive or non-finite gains are ignored. */
export function addActivity(value: number, gained: number, tauSeconds: number): number {
  if (!(gained > 0) || !Number.isFinite(gained)) return value;
  return value + gained / tauSeconds; // value + gained / tau
}

/** Driver value picked from the activity sources: manual, automation, their sum for 'combined', electric (EE/s), thermal (PR/s), resonance (RS/s), or exotic (XF/s). */
export function driverValue(
  driver: AnimationDriver,
  manual: number,
  automation: number,
  electric = 0,
  thermal = 0,
  resonance = 0,
  exotic = 0,
): number {
  switch (driver) {
    case 'manual':
      return manual; // manual only
    case 'automation':
      return automation; // automation only
    case 'combined':
      return manual + automation; // sum of both
    case 'electric':
      return electric; // electric only
    case 'thermal':
      return thermal; // thermal only
    case 'resonance':
      return resonance; // resonance only
    case 'exotic':
      return exotic; // exotic only
  }
}

/**
 * Frame of a frame-cycle part at time t: floor(t * maxHz) % frames while active. 0 when inactive, frames < 2,
 * maxHz <= 0, or t negative / non-finite.
 */
export function framesIndex(t: number, frames: number, maxHz: number, active: boolean): number {
  if (!active || !Number.isFinite(frames) || frames < 2) return 0;
  if (!Number.isFinite(maxHz) || maxHz <= 0 || !(t >= 0) || !Number.isFinite(t)) return 0;
  return Math.floor(t * maxHz) % frames; // whole steps of maxHz, wrapped to the frame count
}

/** Frame time in seconds: deltaMs / 1000 capped at maxSeconds; NaN, negative or zero input gives 0. */
export function clampFrameSeconds(deltaMs: number, maxSeconds: number): number {
  if (!(deltaMs > 0)) return 0; // rejects NaN, negatives and zero
  return Math.min(deltaMs / 1000, maxSeconds); // min(delta / 1000, max)
}

/** Phase advance in cycles wrapped to [0, 1): x = phase + cps * dt; x - floor(x). */
export function advancePhase(phase: number, cyclesPerSecond: number, dtSeconds: number): number {
  const x = phase + cyclesPerSecond * dtSeconds; // linear advance
  const raw = Number.isFinite(x) ? x : phase; // non-finite advance keeps the old phase
  const frac = raw - Math.floor(raw); // fractional part
  return frac >= 1 || !Number.isFinite(frac) ? 0 : noNegativeZero(frac); // rounding can give exactly 1
}

/** Vibration offset in whole art px: x = round(A sin(2 pi phase 7)), y = round(A sin(2 pi phase 11 + 1)). */
export function vibrateOffset(phase: number, amplitude: number): Vec2 {
  const x = Math.round(amplitude * Math.sin(2 * Math.PI * phase * 7)); // fast horizontal jitter
  const y = Math.round(amplitude * Math.sin(2 * Math.PI * phase * 11 + 1)); // offset vertical jitter
  return { x: noNegativeZero(x), y: noNegativeZero(y) };
}

/**
 * Crank offset of a reciprocating part in whole art px: round(-(stroke / 2) * (1 + cos(ratio * masterDeg + phase))).
 * 0 at the strike (driven angle 180 deg); -stroke at the top of travel. Non-finite input gives 0.
 */
export function reciprocateOffset(masterDeg: number, ratio: number, strokeArtPx: number, phaseDeg: number): number {
  if (![masterDeg, ratio, strokeArtPx, phaseDeg].every((v) => Number.isFinite(v))) return 0;
  const theta = ((ratio * masterDeg + phaseDeg) * Math.PI) / 180; // driven angle in radians
  const off = Math.round((-strokeArtPx / 2) * (1 + Math.cos(theta))); // whole px, 0 at the strike
  return noNegativeZero(off);
}

/**
 * Strikes between two master angles: |floor((b - 180) / 360) - floor((a - 180) / 360)| with a = ratio * prev + phase
 * and b = ratio * next + phase. Each crossing of 180 deg (mod 360) counts once, in either direction. Non-finite gives 0.
 */
export function strikeCount(prevDeg: number, nextDeg: number, ratio: number, phaseDeg: number): number {
  if (![prevDeg, nextDeg, ratio, phaseDeg].every((v) => Number.isFinite(v))) return 0;
  const a = ratio * prevDeg + phaseDeg; // driven angle before the step
  const b = ratio * nextDeg + phaseDeg; // driven angle after the step
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.abs(Math.floor((b - 180) / 360) - Math.floor((a - 180) / 360)); // whole crossings of 180 deg
}

/**
 * Gauge sheet frame: round(clamp01((log10(1 + v) - minLog) / (maxLog - minLog)) * (frames - 1)).
 * Frame 0 for non-finite or negative v, frames < 2, or maxLog <= minLog.
 */
export function gaugeFrame(v: number, frames: number, minLog: number, maxLog: number): number {
  if (!Number.isFinite(v) || !(v >= 0)) return 0;
  if (!Number.isFinite(frames) || frames < 2) return 0;
  if (!Number.isFinite(minLog) || !Number.isFinite(maxLog) || !(maxLog > minLog)) return 0;
  const t = clampTo((Math.log10(1 + v) - minLog) / (maxLog - minLog), 0, 1); // position on the log scale
  return noNegativeZero(Math.round(t * (frames - 1))); // whole frame index
}

/**
 * Exponential low-pass towards target: prev + (target - prev) * (1 - e^(-dt / tau)).
 * dt <= 0 or non-finite returns prev; tau <= 0 jumps straight to target.
 */
export function lowPass(prev: number, target: number, dtSeconds: number, tauSeconds: number): number {
  if (!(dtSeconds > 0) || !Number.isFinite(dtSeconds)) return prev;
  if (!(tauSeconds > 0)) return target; // no smoothing
  const k = 1 - Math.exp(-dtSeconds / tauSeconds); // blend factor in [0, 1)
  const next = prev + (target - prev) * k; // move part of the way to the target
  return Number.isFinite(next) ? noNegativeZero(next) : prev;
}

/** Wrap an angle in degrees into [0, 360); rounding that lands on 360 wraps to 0; never -0. */
function wrapDeg(angleDeg: number): number {
  const r = angleDeg - 360 * Math.floor(angleDeg / 360); // remainder, [0, 360) up to rounding
  return r >= 360 || r < 0 ? 0 : noNegativeZero(r);
}

/**
 * Rotor angle after dt: wrap(angle + degPerSec * dt) into [0, 360). A non-finite step keeps the wrapped angle;
 * a non-finite angle gives 0.
 */
export function spinStep(angleDeg: number, degPerSec: number, dtSeconds: number): number {
  if (!Number.isFinite(angleDeg)) return 0;
  const step = degPerSec * dtSeconds; // degrees travelled this frame
  return wrapDeg(Number.isFinite(step) ? angleDeg + step : angleDeg);
}

/** Angle in degrees wrapped into [0, 360) with no -0; non-finite input gives 0. */
function mod360(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) return 0;
  return noNegativeZero(((angleDeg % 360) + 360) % 360); // ((x % 360) + 360) % 360
}

/**
 * Point on a tilted orbit ring at orbit angle phiDeg (+y down):
 * X = a cos p cos t - b sin p sin t, Y = a cos p sin t + b sin p cos t, with p = phi and t = tilt in radians.
 */
export function orbitPoint(ring: { a: number; b: number; tiltDeg: number }, phiDeg: number): Vec2 {
  const t = (ring.tiltDeg * Math.PI) / 180; // tilt in radians
  const p = (phiDeg * Math.PI) / 180; // orbit angle in radians
  const cosP = Math.cos(p);
  const sinP = Math.sin(p);
  const cosT = Math.cos(t);
  const sinT = Math.sin(t);
  const x = ring.a * cosP * cosT - ring.b * sinP * sinT; // horizontal screen offset
  const y = ring.a * cosP * sinT + ring.b * sinP * cosT; // vertical offset, +y down
  return { x: noNegativeZero(x), y: noNegativeZero(y) };
}

/** Bead is in front of the core when sin(phi) >= 0: d = phi mod 360 in [0, 360), true for d <= 180 (0, 90, 180 true; 270 false). */
export function orbitFront(phiDeg: number): boolean {
  if (!Number.isFinite(phiDeg)) return false;
  const d = ((phiDeg % 360) + 360) % 360; // [0, 360)
  return d <= 180;
}

/** Orbit angle after dt: wrap(phi + dir * degPerSec * dt) into [0, 360); non-finite step keeps phi; non-finite phi gives 0. */
export function orbitStep(phiDeg: number, dir: 1 | -1, degPerSec: number, dt: number): number {
  if (!Number.isFinite(phiDeg)) return 0;
  const step = dir * degPerSec * dt; // degrees travelled this frame
  return mod360(phiDeg + (Number.isFinite(step) ? step : 0));
}

/**
 * Move from phi along dir to the next angle equal to targetDeg (mod 360). t01 is clamped to 0..1 linearly;
 * t01 >= 1 lands on the target exactly. Starting on the target returns the target for every t01.
 */
export function alignStep(phiDeg: number, targetDeg: number, dir: 1 | -1, t01: number): number {
  if (!Number.isFinite(phiDeg)) return 0;
  if (!Number.isFinite(targetDeg)) return mod360(phiDeg);
  if (t01 >= 1) return mod360(targetDeg); // exact landing
  const k = t01 > 0 ? t01 : 0; // clamp below 0 (NaN gives 0)
  const dist = dir === 1 ? mod360(targetDeg - phiDeg) : mod360(phiDeg - targetDeg); // travel along dir, [0, 360)
  return mod360(phiDeg + dir * dist * k);
}

/**
 * Latch sprite frame: null -> 0; Infinity (gate already true at load) -> frames - 1; otherwise
 * min(frames - 1, floor(s * fps)). Negative / NaN time or non-positive fps gives 0.
 */
export function latchFrame(secondsSinceGate: number | null, frames: number, fps: number): number {
  if (secondsSinceGate === null || !(frames >= 1) || !Number.isFinite(frames)) return 0;
  const last = frames - 1; // last frame index
  if (secondsSinceGate === Infinity) return last;
  if (!(fps > 0) || !Number.isFinite(fps) || !(secondsSinceGate >= 0)) return 0;
  return Math.min(last, Math.floor(secondsSinceGate * fps)); // whole frames since the gate opened
}

/** Stage frame: restored (with endingFrame) -> endingFrame; otherwise floor(gatesMet). Clamped to [0, frames - 1]. */
export function stageFrameOf(gatesMet: number, frames: number, restored = false, endingFrame?: number): number {
  const pick = restored && endingFrame !== undefined ? endingFrame : gatesMet; // value to clamp
  if (Number.isNaN(pick)) return 0;
  const hi = Math.max(0, frames - 1); // last frame index
  return noNegativeZero(clampTo(Math.floor(pick), 0, hi));
}

/** Echo alpha: null or negative time -> 0; else the alpha of the first step with s < untilS; past the last step -> 0. */
export function echoAlpha(
  secondsSinceClick: number | null,
  steps: readonly { untilS: number; alpha: number }[],
): number {
  if (secondsSinceClick === null || !(secondsSinceClick >= 0)) return 0;
  for (const step of steps) {
    if (secondsSinceClick < step.untilS) return step.alpha; // hard steps, boundary goes to the next step
  }
  return 0;
}

/** Mirror of an angle about the vertical: -deg wrapped into [0, 360); never -0; non-finite gives 0. */
export function mirrorAngle(deg: number): number {
  return mod360(-deg);
}

/**
 * Milestone bead timeline in seconds since the milestone: align for alignMs (t01 0..1), then hold for holdMs
 * (t01 0..1), then none (t01 0). null, negative or NaN time is none.
 */
export function milestonePhase(
  secondsSince: number | null,
  alignMs: number,
  holdMs: number,
): { phase: 'none' | 'align' | 'hold'; t01: number } {
  if (secondsSince === null || !(secondsSince >= 0)) return { phase: 'none', t01: 0 };
  const ms = secondsSince * 1000; // elapsed milliseconds
  if (ms < alignMs) return { phase: 'align', t01: ms / alignMs }; // alignMs > 0 here
  if (ms < alignMs + holdMs) return { phase: 'hold', t01: (ms - alignMs) / holdMs }; // holdMs > 0 here
  return { phase: 'none', t01: 0 };
}
