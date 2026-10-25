// Finale film script (WP23b): one WorldScriptFrame per finale clock time, as a pure function. Why: the storyboard (STORY_BIBLE §9.1,
// DENIZEN_ART §3 and §5), the KEEP beats (§9.2) and the reduced-motion variant are one tested rule, and the renderers only draw the
// frame. Every time derives from src/data/finale.ts and src/data/worldEnding.ts; the one derived constant is the second hand's
// 360 / 60 degrees a second. Pure: no Phaser, no DOM, no random source.
// Conventions: dx is world px from WORLD_ENDING.homeX of the member in every phase (the postgame dog carries
// postgameDogHomeX - homeX.dog); dy is world px from the member's home feet line; the crow is relative to its perch.
// worldRow is set only in the postgame (the dog always, the Inspector on its loop walk and pat); the film leaves it undefined.
// Film phases (sequence, choice) read the finale clock t; the postgame reads the KEEP clock keepS, the loop clock loopS and the frozen film clock t (the second hand's start).
import { FINALE_BEAM, FINALE_BIRDS, FINALE_DUST, FINALE_ECLIPSE, FINALE_REVEAL, FINALE_TRACKS, FINALE_WIPE } from '../../data/finale';
import { WORLD_ERA_ROW } from '../../data/livingWorld';
import { MACHINE_ANCHOR } from '../../data/world';
import { WORLD_ENDING } from '../../data/worldEnding';
import { WORLD_TRACES } from '../../data/worldEras';
import { choiceStartS, trackValue } from './finale';
import type { RevealCfg } from './finale';
import { postgamePosesAt } from './worldPostgame';
import type { CastScriptPose, CrowLead, PropScript, ScriptCastId, WorldScriptFrame } from './worldScript';

export interface WorldFinaleInput {
  phase: 'sequence' | 'choice' | 'postgame';
  t: number;            // finale clock (seconds); the film phases read it, the postgame its frozen end (the second hand)
  reduced: boolean;     // reduced motion: cuts instead of crossfades, no takeoff or glide
  keepS: number;        // seconds since KEEP IT RUNNING; -1 before KEEP; Infinity when the session booted into postgame
  loopS: number;        // seconds on the 90 s postgame loop clock
  sensorTurn: boolean;  // the postgame Sensor 7 camera turn is running
  lastFrame: boolean;   // LAST FRAME (the cycle transition white-in): the LAST LOOK set in choice and postgame
  cycle: number;
}

const WHOLE_ROW = WORLD_ERA_ROW.whole;          // 5: restored
const ERA_V_ROW = WORLD_ERA_ROW[5];             // 4: the era V row a restore fades from
const SHIELD_FROM_S = FINALE_BEAM.whiteAtS;     // the beam: shields up
const SHIELD_TO_S = FINALE_ECLIPSE.restoreAtS;  // shields down
const GROUND_END_S = FINALE_TRACKS.ground.startS + FINALE_TRACKS.ground.durS;  // reduced motion restores everyone here
const RUN_S = WORLD_ENDING.girlRun.startS + WORLD_ENDING.girlRun.dropMs / 1000;  // the girl runs and the lantern lands when the drop ends
const CROSSFADE_S = WORLD_ENDING.crossfadeMs / 1000;
const CLOCK_DEG_PER_S = 360 / 60;               // the second hand: one turn a minute (the only derived constant)
const HOME = WORLD_ENDING.homeX;
const PG_DOG_DX = WORLD_ENDING.postgameDogHomeX - HOME.dog;   // the postgame spot, relative to the film home
const K = WORLD_ENDING.keep;
const CROW = WORLD_ENDING.crow;
const DOG_RUN: readonly string[] = ['chase0', 'chase1'];
const FLOCK_S = FINALE_BIRDS.firstAtS;          // the crow's takeoff climbs to the first flock
const LAST_LOOK_S = lastLookS();
const BLINK_END_S = LAST_LOOK_S + WORLD_ENDING.lastLookBlinkMs / 1000;
const HOP_S = K.hopMs / 1000;
const PECK_S = K.peckMs / 1000;
const HOP_OUT_END_S = K.scratchStartS + HOP_S;
const PECKS_END_S = HOP_OUT_END_S + K.pecks * PECK_S;
const HOP_BACK_END_S = PECKS_END_S + HOP_S;

const STARE: Record<ScriptCastId, string> = WORLD_ENDING.stareFrames;
const SHIELD: Record<ScriptCastId, string> = { ...WORLD_ENDING.shieldFrames, sensor7: WORLD_ENDING.stareFrames.sensor7 };
const WHOLE_FRAME: Record<ScriptCastId, string> = { inspector: 'idleA', dog: 'sit0', crow: 'perch0', girl: 'stand0', sensor7: 'headUp' };
const WHOLE_FLIP: Record<ScriptCastId, boolean> = { inspector: true, dog: false, crow: false, girl: false, sensor7: false };

const clamp01 = (x: number): number => (x > 0 ? (x < 1 ? x : 1) : 0);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * clamp01(k);
const within = (t: number, fromS: number, toS: number): boolean => t >= fromS && t < toS;
const wrapDeg = (deg: number): number => ((deg % 360) + 360) % 360;
// Frame i of a cycle (wraps; the lists are never empty).
function frameOf(frames: readonly string[], i: number): string {
  const n = frames.length;
  return frames[((i % n) + n) % n] ?? '';
}

// Film time of LAST LOOK: the fourth reveal line starts (the first three type out after the name plate). 59.83 s with FINALE_REVEAL.
export function lastLookS(cfg: RevealCfg = FINALE_REVEAL): number {
  let at = cfg.startS + cfg.nameplateFadeMs / 1000 + cfg.holdS;
  for (const line of cfg.lines.slice(0, -1)) at += line.length / cfg.cps + cfg.linePauseS;
  return at;
}

// Restore time of a denizen or prop with home feet x (world px): the wipe front reaches x (the first layer's lag). Reduced motion
// restores everything at GROUND_END_S instead (restoreAt).
export function restoreTimeOf(x: number): number {
  const w = FINALE_WIPE;
  return w.startS + w.regrowthLagS[0] + Math.abs(x - MACHINE_ANCHOR.x) / w.pxPerS;
}
const restoreAt = (x: number, reduced: boolean): number => (reduced ? GROUND_END_S : restoreTimeOf(x));

interface Row { row: number; blendRow: number | null; blend: number; shadow: boolean }
const WHOLE: Row = { row: WHOLE_ROW, blendRow: null, blend: 0, shadow: true };

// dx / dy + 0: a zero offset is never -0 (a product with a negative constant can be).
function pose(frame: string, r: Row, dx = 0, flip = false, visible = true, dy = 0): CastScriptPose {
  return { visible, frame, row: r.row, blendRow: r.blendRow, blend: r.blend, dx: dx + 0, dy: dy + 0, flip, alpha: 1, shadow: visible && r.shadow };
}
// The dog stands on the front row in the postgame (its placement row too): the row is set only where the postgame draws it.
const onFront = (p: CastScriptPose): CastScriptPose => ({ ...p, worldRow: 'front' });

// Sheet row of a denizen restored at restoreS: era V until then, then a crossfade to the whole row over CROSSFADE_S (reduced: no fade).
function rowAt(restoreS: number, t: number, reduced: boolean): Row {
  if (t < restoreS) return { row: ERA_V_ROW, blendRow: null, blend: 0, shadow: false };
  if (!reduced && t < restoreS + CROSSFADE_S) {
    return { row: ERA_V_ROW, blendRow: WHOLE_ROW, blend: (t - restoreS) / CROSSFADE_S, shadow: true };
  }
  return WHOLE;
}

// The restored frame at t: the Inspector idles B in the base-left survey, the dog wags for a moment.
function wholeFrameAt(m: ScriptCastId, t: number): string {
  const b = WORLD_ENDING.inspectorBaseL;
  const w = WORLD_ENDING.dogWag;
  if (m === 'inspector' && within(t, b.fromS, b.toS)) return b.frame;
  if (m === 'dog' && within(t, w.fromS, w.toS)) return w.frame;
  return WHOLE_FRAME[m];
}

// A denizen in the film: the stare frame (the shield frame in the beam window) until its restore, then the whole frame.
function filmPose(m: ScriptCastId, t: number, reduced: boolean): CastScriptPose {
  const restoreS = restoreAt(HOME[m], reduced);
  const restored = t >= restoreS;
  let frame = STARE[m];
  if (restored) frame = wholeFrameAt(m, t);
  else if (within(t, SHIELD_FROM_S, SHIELD_TO_S)) frame = SHIELD[m];
  return pose(frame, rowAt(restoreS, t, reduced), 0, restored && WHOLE_FLIP[m]);
}

// The crow: perched; the takeoff climbs to the first flock (37-38 s); out of view while the flock flies (38-47.5 s); the glide back to
// the lamp (47.5-49.3 s). Reduced motion: no takeoff and no glide, out of view from the flock to the glide's end.
function crowFilm(t: number, reduced: boolean): CastScriptPose {
  const base = filmPose('crow', t, reduced);
  const gone = { ...base, visible: false, shadow: false };
  if (reduced) return within(t, FLOCK_S, CROW.returnToS) ? gone : base;
  if (within(t, CROW.takeoffS, FLOCK_S)) {
    const k = (t - CROW.takeoffS) / (FLOCK_S - CROW.takeoffS);
    const frame = frameOf(CROW.flyFrames, Math.floor((t - CROW.takeoffS) * CROW.fps));
    return pose(frame, WHOLE, CROW.climbDx * k, false, true, CROW.climbDy * k);
  }
  if (within(t, FLOCK_S, CROW.returnFromS)) return gone;
  if (within(t, CROW.returnFromS, CROW.returnToS)) {
    const left = 1 - clamp01((t - CROW.returnFromS) / (CROW.returnToS - CROW.returnFromS));
    const frame = frameOf(CROW.flyFrames, Math.floor((t - CROW.returnFromS) * CROW.fps));
    return pose(frame, WHOLE, CROW.returnStartDx * left, false, true, CROW.returnStartDy * left);
  }
  return base;
}

// The girl: she drops the lantern at 31.5 s (dropMs), then runs off left (dxWorldPx by endS) and is out of the film. Reduced motion:
// she is simply gone from the ground restore.
function girlFilm(t: number, reduced: boolean): CastScriptPose {
  const g = WORLD_ENDING.girlRun;
  const base = filmPose('girl', t, reduced);
  if (reduced ? t >= GROUND_END_S : t >= g.endS) return { ...base, visible: false, shadow: false };
  if (reduced) return base;
  if (within(t, g.startS, RUN_S)) return { ...base, frame: g.dropFrame, dx: 0 };
  if (within(t, RUN_S, g.endS)) {
    const frame = frameOf(g.frames, Math.floor((t - RUN_S) * g.fps));
    return { ...base, frame, dx: lerp(0, g.dxWorldPx, (t - RUN_S) / (g.endS - RUN_S)) };
  }
  return base;
}

// The crow's lead hand-off: from the flock (38 s) to the glide (47.5 s) the first bird of the flock draws the crow's flying frame.
function leadAt(t: number, reduced: boolean): CrowLead | null {
  if (reduced || !within(t, FLOCK_S, CROW.returnFromS)) return null;
  return { frame: frameOf(CROW.flyFrames, Math.floor((t - FLOCK_S) * CROW.fps)), row: WHOLE_ROW };
}

function filmCast(t: number, reduced: boolean): Record<ScriptCastId, CastScriptPose> {
  return {
    inspector: filmPose('inspector', t, reduced),
    dog: filmPose('dog', t, reduced),
    crow: crowFilm(t, reduced),
    girl: girlFilm(t, reduced),
    sensor7: filmPose('sensor7', t, reduced),
  };
}

// The LAST LOOK set: every denizen on stage faces the camera at its stare frame on the whole row, at home (the dog at dogDx); the girl is gone.
function lastLookCast(dogDx: number): Record<ScriptCastId, CastScriptPose> {
  return {
    inspector: pose(STARE.inspector, WHOLE),
    dog: pose(STARE.dog, WHOLE, dogDx),
    crow: pose(STARE.crow, WHOLE),
    girl: pose(STARE.girl, WHOLE, 0, false, false),
    sensor7: pose(STARE.sensor7, WHOLE),
  };
}

// The crow's KEEP beat (k seconds after KEEP): hop to the booth roof (hopDx, hopDy), peck `pecks` times (peck0 / peck1), hop back.
function crowKeep(k: number): CastScriptPose {
  if (k < K.scratchStartS || k >= HOP_BACK_END_S) return pose(WHOLE_FRAME.crow, WHOLE);
  const fly = (f: number, fromS: number): CastScriptPose =>
    pose(frameOf(CROW.flyFrames, Math.floor((k - fromS) * CROW.fps)), WHOLE, K.hopDx * f, false, true, K.hopDy * f);
  if (k < HOP_OUT_END_S) return fly((k - K.scratchStartS) / HOP_S, K.scratchStartS);
  if (k < PECKS_END_S) {
    const n = Math.floor((k - HOP_OUT_END_S) / PECK_S);
    return pose(n % 2 === 0 ? 'peck0' : 'peck1', WHOLE, K.hopDx, false, true, K.hopDy);
  }
  return fly(1 - (k - PECKS_END_S) / HOP_S, PECKS_END_S);
}

// The dog's KEEP run (keep.dogFade, keep.dogEnter): it fades out at its home (never crossing the machine), is hidden, walks back in
// from the left wing at the dog stride, then sits at the postgame spot.
function dogKeep(k: number): CastScriptPose {
  const f = K.dogFade;
  const n = K.dogEnter;
  const run = (fromS: number, toS: number, fromDx: number, toDx: number): CastScriptPose => {
    const frame = frameOf(DOG_RUN, Math.floor((k - fromS) * WORLD_ENDING.dogStride.fps));
    return pose(frame, WHOLE, lerp(fromDx, toDx, (k - fromS) / (toS - fromS)));
  };
  if (k < f.fromS) return pose(WHOLE_FRAME.dog, WHOLE);
  if (k < f.toS) return { ...pose(WHOLE_FRAME.dog, WHOLE), alpha: 1 - (k - f.fromS) / (f.toS - f.fromS) };
  if (k < n.fromS) return pose(WHOLE_FRAME.dog, WHOLE, 0, false, false);
  if (k < n.toS) return run(n.fromS, n.toS, n.fromX - HOME.dog, PG_DOG_DX);
  return pose(WHOLE_FRAME.dog, WHOLE, PG_DOG_DX);
}

// Postgame denizens. lastFrame: the LAST LOOK set, the dog on its postgame spot. KEEP: LAST LOOK until turnAwayS, then the turn away
// and the KEEP beats, then the loop from loopStartS (Infinity = booted into postgame: the loop only).
function postgameCast(k: number, loopS: number, lastFrame: boolean, sensorTurn: boolean): Record<ScriptCastId, CastScriptPose> {
  if (lastFrame) return lastLookCast(PG_DOG_DX);
  if (k < K.turnAwayS) return lastLookCast(0);
  const sensor = pose(sensorTurn ? 'headC' : 'headUp', WHOLE);
  const girlGone = pose(STARE.girl, WHOLE, 0, false, false);
  if (k < K.loopStartS) {
    const inspector = pose(WHOLE_FRAME.inspector, WHOLE, 0, WHOLE_FLIP.inspector);
    return { inspector, dog: onFront(dogKeep(k)), crow: crowKeep(k), girl: girlGone, sensor7: sensor };
  }
  const p = postgamePosesAt(loopS);
  return {
    inspector: { ...pose(p.inspector.frame, WHOLE, p.inspector.dx, p.inspector.flip, true, p.inspector.dy), worldRow: p.inspector.row },
    dog: onFront(pose(p.dog.frame, WHOLE, PG_DOG_DX + p.dog.dx, p.dog.flip)),
    crow: pose(p.crow.frame, WHOLE, p.crow.dx, p.crow.flip, true, p.crow.dy),
    girl: girlGone,
    sensor7: sensor,
  };
}

// Prop states of the film at t (the choice clamps t to choiceStartS, so its props are the end state).
function filmProps(t: number, reduced: boolean, lastLook: boolean, cycle: number): PropScript {
  const at = (x: number): number => restoreAt(x, reduced);
  const clockS = at(HOME.clock);
  const lampS = at(HOME.lamp);
  const payS = at(HOME.payphone);
  const d = FINALE_DUST;
  let booth: PropScript['booth'] = 'dark';
  if (t < SHIELD_FROM_S) booth = 'stage';
  else if (within(t, LAST_LOOK_S, BLINK_END_S)) booth = 'blink';
  else if (t >= payS) booth = 'restored';
  return {
    windowsAlpha: 1 - trackValue('skyline', t, reduced),
    virgaAlpha: 1 - trackValue('mountains', t, reduced),
    chladniAlpha: 1 - clamp01((t - d.reverseAtS) / d.reverseS),
    girlWindow: lastLook ? 'restored' : 'stage',
    lamp: t >= lampS ? 'restored' : 'stage',
    lampGlow: t >= lampS ? 'warm' : 'stage',
    clock: t >= clockS ? 'restored' : 'ruin',
    secondHandDeg: t >= clockS ? wrapDeg(CLOCK_DEG_PER_S * (t - clockS)) : null,
    booth,
    receiver: t >= payS ? 'onHook' : 'stage',
    sensorLed: t >= at(HOME.sensor7) ? 'green' : t >= SHIELD_FROM_S ? 'dead' : 'stage',
    sensorGlyph: 'stage',
    sprout: t >= at(HOME.sprout) ? 'bloom' : 'stage',
    puddles: t >= at(HOME.puddles) ? 'whole' : 'stage',
    chain: t >= at(HOME.dog) ? 'fallen' : 'stage',
    hole: t >= at(HOME.hole) ? 'hidden' : 'stage',
    lantern: t >= (reduced ? GROUND_END_S : RUN_S) ? 'fallen' : 'none',
    redBall: cycle >= WORLD_TRACES.redBallFromCycle,
    motes: t >= lampS ? 'moth' : 'stage',
    marksPlus: 0,
  };
}

// The postgame second hand: the choice's angle carried on through KEEP (the film clock frozen at its end minus the clock's restore,
// plus the KEEP seconds), so the hand never snaps or stalls. A boot into the postgame has no film: the loop clock alone.
function postgameHandDeg(t: number, reduced: boolean, keepS: number, loopS: number): number {
  if (!Number.isFinite(keepS)) return wrapDeg(CLOCK_DEG_PER_S * loopS);
  const k = keepS < 0 ? 0 : keepS;
  const filmT = Math.max(t, choiceStartS());
  return wrapDeg(CLOCK_DEG_PER_S * (filmT - restoreAt(HOME.clock, reduced) + k));
}

// Postgame props: the restored world, the second hand at handDeg, the extra tally mark after the last KEEP peck.
function postgameProps(handDeg: number, k: number, sensorTurn: boolean): PropScript {
  return {
    windowsAlpha: 0,
    virgaAlpha: 0,
    chladniAlpha: 0,
    girlWindow: 'restored',
    lamp: 'restored',
    lampGlow: 'warm',
    clock: 'restored',
    secondHandDeg: handDeg,
    booth: 'restored',
    receiver: 'onHook',
    sensorLed: 'green',
    sensorGlyph: sensorTurn ? 'one' : 'dash',
    sprout: 'bloom',
    puddles: 'whole',
    chain: 'fallen',
    hole: 'hidden',
    lantern: 'fallen',
    redBall: true,
    motes: 'moth',
    marksPlus: k >= PECKS_END_S ? 1 : 0,
  };
}

// The script frame at one clock time. sequence: the film at t. choice: the film's end state (t clamped up to choiceStartS).
// postgame: the KEEP and loop poses. lastFrame (choice, postgame) forces the LAST LOOK set.
export function worldFinaleFrame(i: WorldFinaleInput): WorldScriptFrame {
  const t = Number.isFinite(i.t) ? Math.max(0, i.t) : 0;
  const keepS = Number.isNaN(i.keepS) ? -1 : i.keepS;
  const keepOut = keepS >= 0 ? keepS : null;
  const lastFrame = i.lastFrame && i.phase !== 'sequence';
  if (i.phase === 'postgame') {
    const k = keepS < 0 ? 0 : keepS;
    const loopS = Number.isFinite(i.loopS) ? i.loopS : 0;
    return {
      t,
      phase: 'postgame',
      lastLook: lastFrame || k < K.turnAwayS,
      keepS: keepOut,
      cast: postgameCast(k, loopS, lastFrame, i.sensorTurn),
      props: postgameProps(postgameHandDeg(t, i.reduced, keepS, loopS), k, i.sensorTurn),
      lead: null,
    };
  }
  const filmT = i.phase === 'choice' ? Math.max(t, choiceStartS()) : t;
  const lastLook = lastFrame || filmT >= LAST_LOOK_S;
  return {
    t,
    phase: i.phase,
    lastLook,
    keepS: keepOut,
    cast: lastLook ? lastLookCast(0) : filmCast(filmT, i.reduced),
    props: filmProps(filmT, i.reduced, lastLook, i.cycle),
    lead: lastLook ? null : leadAt(filmT, i.reduced),
  };
}
