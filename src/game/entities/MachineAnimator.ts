import Phaser from 'phaser';
import type { GameSession } from '../../simulation';
import {
  DRIVE_TRAIN,
  EXOTIC_MILESTONE_FX,
  INVERSION_GHOST_FX,
  MACHINE_COMPONENTS,
  MACHINE_COMPONENT_IDS,
  MACHINE_LAYER_DEPTH,
  MACHINE_MOTION,
  RESONANCE_MILESTONE_FX,
  RING_GEOMETRY,
} from '../../data/machineComponents';
import type { ComponentAnimation, MachineComponentId, SpeedCurve } from '../../data/machineComponents';
import { HAMMER_FX } from '../../data/steamFx';
import { FINALE_BOOST } from '../../data/finale';
import { CRANK_FEEDBACK } from '../../data/world';
import {
  addActivity,
  advancePhase,
  alignStep,
  animationSpeed,
  clampFrameSeconds,
  decayActivity,
  driverValue,
  echoAlpha,
  framesIndex,
  gaugeFrame,
  latchFrame,
  lowPass,
  milestonePhase,
  mirrorAngle,
  orbitFront,
  orbitPoint,
  orbitStep,
  reciprocateOffset,
  spinStep,
  stageFrameOf,
  strikeCount,
  vibrateOffset,
} from '../math/animation';
import { addClickImpulse, partAngle, rotationFrame, sliderCrank, stepMaster } from '../math/driveTrain';
import type { MasterState } from '../math/driveTrain';
import { crankAngle, crankOffsetOnGearUp } from '../math/crankLink';
import { componentDepth, resolveAttachment } from '../math/machineLayout';
import { motionPolicy } from '../../simulation/settings';
import { boostedValue } from '../math/finale';

/** Top frame rate of any frame-cycle part in the data: the boost target for `frames` maxHz (frame parts carry no speed curve). */
const FRAMES_MAX_HZ = MACHINE_COMPONENT_IDS.reduce((top, id) => {
  const anim = MACHINE_COMPONENTS[id].animation;
  return anim.kind === 'frames' ? Math.max(top, anim.maxHz) : top;
}, 0);

/** Finale hold frames (FINALE_BOOST.holdFrames) keyed by part: shown while the finale boost is above 0. */
const FINALE_HOLD_FRAMES: Partial<Record<MachineComponentId, number>> = FINALE_BOOST.holdFrames;

/** Caps a degrees-per-second speed at maxDegPerSec (null: uncapped). Reduced motion only. */
function capSpeed(degPerSec: number, maxDegPerSec: number | null): number {
  return maxDegPerSec === null ? degPerSec : Math.min(degPerSec, maxDegPerSec);
}

/**
 * Master / crank state after one frame, with the angle travelled in that frame capped at maxDegPerSec (null: uncapped).
 * Impulse that would have been released beyond the cap is dropped; the queue (pending) is kept as stepped.
 */
function capTravel(prev: MasterState, next: MasterState, dt: number, maxDegPerSec: number | null): MasterState {
  if (maxDegPerSec === null) return next;
  const limit = maxDegPerSec * dt;
  const travel = next.deg - prev.deg;
  if (Math.abs(travel) <= limit) return next;
  return { deg: prev.deg + Math.sign(travel) * limit, pending: next.pending };
}

/**
 * Shows a driven or spin part at deg. A sprite on a rotation sheet (`#rot` texture) shows the nearest pre-rendered frame with no
 * angle; any other sprite (sheet missing) is rotated by angle.
 */
function applyAngle(sprite: Phaser.GameObjects.Sprite, deg: number): void {
  const frames = sprite.texture.frameTotal - 1; // Phaser counts the __BASE frame
  if (sprite.texture.key.endsWith('#rot') && frames > 1) {
    sprite.setFrame(rotationFrame(deg, frames));
    sprite.setAngle(0);
    return;
  }
  sprite.setAngle(deg);
}

/** Parts that turn with the hand crank (the servo arm is a parallel crank). They share one crank angle state and one driven ratio/phase. */
const CRANK_PARTS: readonly MachineComponentId[] = ['handCrank', 'crankBrace', 'servoArm'];

/** Reads the driven ratio and phase of a component; throws when it is not a driven part. */
function drivenOf(id: MachineComponentId): { ratio: number; phaseDeg: number } {
  const anim = MACHINE_COMPONENTS[id].animation;
  if (anim.kind !== 'driven') throw new Error(`${id} animation must be driven`);
  return anim;
}

/**
 * Drives part motion from one master angle thetaM (the drive train). Manual activity from clicks and automation from ME/s
 * feed the combined driver; clicks queue an impulse on thetaM. The hand crank is never tweened: it is a driven part too.
 *
 * Before the gears are unlocked the crank is not meshed to thetaM: clicks turn only crankState, and the motor turns
 * thetaM alone. On the moment the pinion appears, the crank angle is captured as an offset on thetaM (no snap).
 *
 * Other kinds: `vibrate` / `frames` follow the manual, automation, electric, thermal (PR/s), resonance (RS/s) or exotic (XF/s)
 * driver; `spin` turns its own angle at a driver-set speed; `gauge` low-passes its driver into a needle frame; `reciprocate`
 * strikes with thetaM and counts hammer strikes (see consumeStrikes).
 *
 * Era V: `orbit` beads advance on their ring with the exotic driver and switch front / back depth (consumeDepthChanged);
 * `latch` parts open once their gate holds (latchFrame); `stage` parts show the number of gates met; the inversion ghost
 * mirrors the hand crank for the echo window after a click (INVERSION_GHOST_FX).
 *
 * Milestone FX (Era IV): on the RESONANCE_MILESTONE_FX milestone the crystal holds its hold frame for holdMs, and the dish
 * waves restart their frame clock at 0. Frame clocks are otherwise the animator clock (`elapsed`).
 * Milestone FX (Era V): on the EXOTIC_MILESTONE_FX milestone the beads align to beadPhiDeg and hold, the null core spins
 * faster for coreSpinMs and the anchor glows hold glowFrame for glowHoldMs.
 * Finale (setFinale): boost lifts every speed and frame rate towards its curve max (boostedValue) and shows the
 * FINALE_BOOST.holdFrames frames; restored moves stage parts to their endingFrame. Boost 0 and not restored = unchanged.
 */
export class MachineAnimator {
  private readonly session: GameSession;
  private readonly sprites: ReadonlyMap<MachineComponentId, Phaser.GameObjects.Sprite>;
  /** Driven ratio and phase of the hand crank: converts a crank click into a thetaM impulse. */
  private readonly crankRatio: number;
  private readonly crankPhaseDeg: number;
  /** Driven ratio and phase of the rod's crank part (main shaft): positions the slider. */
  private readonly rodCrank: { ratio: number; phaseDeg: number };
  /** Phase in cycles for vibrating parts. */
  private readonly phases = new Map<MachineComponentId, number>();
  /** Own angle of each spin part (deg, [0, 360)); cleared on reset. */
  private readonly spinAngles = new Map<MachineComponentId, number>();
  /** Low-passed driver value of each gauge part; starts at 0 after a load and is cleared on reset. */
  private readonly gaugeValues = new Map<MachineComponentId, number>();
  private master: MasterState = { deg: 0, pending: 0 };
  /** Crank-only angle state (degPerSec 0, click impulses only), used while the gears are not active. */
  private crankState: MasterState = { deg: 0, pending: 0 };
  /** True once the pinion has been active: crank parts follow thetaM plus crankOffsetDeg from then on. */
  private geared = false;
  private crankOffsetDeg = 0;
  /** Gear visibility at the last update; click routing reads it between frames. */
  private gearsActive = false;
  private manual = 0;
  private lastDegPerSec = 0;
  /** Seconds of clamped frame time since the last reset: the clock of frame-cycle parts. */
  private elapsed = 0;
  /** Hammer strikes since the last consumeStrikes call. */
  private strikes = 0;
  /** Animator clock until which the milestone crystal holds its hold frame; -1 when not holding. */
  private crystalHoldUntil = -1;
  /** Frame-clock origin of parts restarted by the milestone (absent: origin 0). Cleared on reset. */
  private readonly frameOrigins = new Map<MachineComponentId, number>();
  /** Animator clock of the last manual click (null before the first click and after reset): drives the inversion ghost. */
  private lastClickAt: number | null = null;
  /** Current angle of each orbit bead (deg); absent means the bead's phi0Deg. Cleared on reset. */
  private readonly orbitAngles = new Map<MachineComponentId, number>();
  /** Set when a bead changed front / back depth; read and cleared by consumeDepthChanged(). */
  private depthChanged = false;
  /** Animator clock of the finalAlignment milestone (null until it fires; cleared on reset). */
  private exoticMilestoneAt: number | null = null;
  /** Bead angles captured when the finalAlignment milestone fired; the align step starts from them. */
  private readonly exoticFrom = new Map<MachineComponentId, number>();
  /**
   * Latch state: 'off' = gate not met yet (frame 0), 'done' = gate already met at the first update after load / reset (last frame,
   * no animation), number = clock when the gate opened (a gate met later animates, also when its part was still assembling).
   */
  private readonly latchStart = new Map<MachineComponentId, number | 'off' | 'done'>();
  /** Last frame shown by each latch part (see latchFrame). */
  private readonly latchFrames = new Map<MachineComponentId, number>();
  /** True until the end of the first update after construction / reset: gates met then are 'done' (see latchStart). */
  private firstFrame = true;
  /** Finale boost 0..1 (setFinale): 0 = WP11 behaviour. */
  private finaleBoost = 0;
  /** Finale restored flag (setFinale): stage parts show their endingFrame. */
  private finaleRestored = false;
  private readonly unsubscribeClick: () => void;
  private readonly unsubscribeReset: () => void;
  private readonly unsubscribeMilestone: () => void;
  private readonly unsubscribeExotic: () => void;

  constructor(session: GameSession, sprites: ReadonlyMap<MachineComponentId, Phaser.GameObjects.Sprite>) {
    this.session = session;
    this.sprites = sprites;
    const crank = drivenOf('handCrank');
    this.crankRatio = crank.ratio;
    this.crankPhaseDeg = crank.phaseDeg;
    for (const id of CRANK_PARTS) {
      const d = drivenOf(id);
      if (d.ratio !== crank.ratio || d.phaseDeg !== crank.phaseDeg) {
        throw new Error(`${id} must share the hand crank driven ratio and phase`);
      }
    }
    this.rodCrank = drivenOf(DRIVE_TRAIN.rod.crank);
    this.unsubscribeClick = session.on('click', ({ gained }) => {
      this.lastClickAt = this.elapsed; // inversion ghost echo starts here
      this.manual = addActivity(this.manual, gained, MACHINE_MOTION.manualTauSeconds); // activity from the click
      // queued turn: thetaM while meshed to the gears, the crank-only state before that
      if (this.gearsActive) {
        this.master = addClickImpulse(this.master, CRANK_FEEDBACK.degreesPerClick, this.crankRatio);
      } else {
        this.crankState = addClickImpulse(this.crankState, CRANK_FEEDBACK.degreesPerClick, this.crankRatio);
      }
    });
    this.unsubscribeReset = session.on('reset', () => {
      this.master = { deg: 0, pending: 0 };
      this.crankState = { deg: 0, pending: 0 };
      this.geared = false;
      this.crankOffsetDeg = 0;
      this.gearsActive = false;
      this.manual = 0;
      this.lastDegPerSec = 0;
      this.elapsed = 0;
      this.strikes = 0;
      this.crystalHoldUntil = -1;
      this.frameOrigins.clear();
      this.phases.clear();
      this.spinAngles.clear();
      this.gaugeValues.clear();
      this.lastClickAt = null;
      this.orbitAngles.clear();
      this.exoticMilestoneAt = null;
      this.exoticFrom.clear();
      this.latchStart.clear();
      this.latchFrames.clear();
      this.firstFrame = true;
      // Stale angles must not snap in later: every driven and spin part goes back to angle 0.
      for (const id of MACHINE_COMPONENT_IDS) {
        const kind = MACHINE_COMPONENTS[id].animation.kind;
        if (kind !== 'driven' && kind !== 'spin') continue;
        const sprite = this.sprites.get(id);
        if (sprite !== undefined) applyAngle(sprite, 0);
      }
      this.restoreBeadDepths();
    });
    this.unsubscribeMilestone = session.on('milestone', ({ id }) => {
      if (id !== RESONANCE_MILESTONE_FX.techId) return;
      this.crystalHoldUntil = this.elapsed + RESONANCE_MILESTONE_FX.holdMs / 1000; // crystal holds bright
      for (const part of RESONANCE_MILESTONE_FX.restart) this.frameOrigins.set(part, this.elapsed); // dish waves restart at 0
    });
    this.unsubscribeExotic = session.on('milestone', ({ id }) => {
      if (id !== EXOTIC_MILESTONE_FX.techId) return;
      this.exoticMilestoneAt = this.elapsed; // beads align, core spins and glows hold from here
      this.exoticFrom.clear();
      for (const bid of MACHINE_COMPONENT_IDS) {
        const a = MACHINE_COMPONENTS[bid].animation;
        if (a.kind !== 'orbit') continue;
        this.exoticFrom.set(bid, this.orbitAngles.get(bid) ?? a.phi0Deg); // angle at the milestone
      }
    });
  }

  /** Advances the master angle and places every active part by one frame. */
  update(deltaMs: number, isActive: (id: MachineComponentId) => boolean): void {
    const dt = clampFrameSeconds(deltaMs, MACHINE_MOTION.maxFrameSeconds);
    this.elapsed += dt; // frame-cycle clock
    const policy = motionPolicy(this.session.settings); // read live each frame: reduced motion caps speeds and stops flicker
    const prevMasterDeg = this.master.deg; // before this frame's step: strike detection
    const me = this.session.rates.perSecond.me;
    const ee = this.session.rates.perSecond.ee;
    const pr = this.session.rates.perSecond.pr;
    const rs = this.session.rates.perSecond.rs;
    const xf = this.session.rates.perSecond.xf; // exotic driver: XF/s
    const levels = this.session.state.techLevels;
    const boost = this.finaleBoost;
    const exoticSince = this.exoticMilestoneAt === null ? null : this.elapsed - this.exoticMilestoneAt;
    const exotic = milestonePhase(exoticSince, EXOTIC_MILESTONE_FX.alignMs, EXOTIC_MILESTONE_FX.holdMs); // finalAlignment: align, hold, none
    this.manual = decayActivity(this.manual, dt, MACHINE_MOTION.manualTauSeconds); // activity fades when idle
    const dv = driverValue('combined', this.manual, me);
    const idleDeg = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(DRIVE_TRAIN.masterSpeed, dv); // rest below threshold
    const degPerSec = boostedValue(idleDeg, DRIVE_TRAIN.masterSpeed.max, boost); // finale boost; identity at 0
    this.syncGearing(isActive('gearSmall'));
    this.master = capTravel(
      this.master,
      stepMaster(this.master, degPerSec, DRIVE_TRAIN.masterDirection, dt, DRIVE_TRAIN.clickTauSeconds),
      dt,
      policy.maxDegPerSec,
    );
    // crank clicks only, no drift
    this.crankState = capTravel(this.crankState, stepMaster(this.crankState, 0, 1, dt, DRIVE_TRAIN.clickTauSeconds), dt, policy.maxDegPerSec);
    this.lastDegPerSec = degPerSec;
    // Latches already met at the first update after load / reset show their last frame without animating (even if their part
    // is still hidden or assembling). Later gates animate when the part is active.
    if (this.firstFrame) {
      for (const id of MACHINE_COMPONENT_IDS) {
        const a = MACHINE_COMPONENTS[id].animation;
        if (a.kind === 'latch' && levels[a.techId] >= a.minLevel) this.latchStart.set(id, 'done');
      }
    }

    for (const id of MACHINE_COMPONENT_IDS) {
      const anim = MACHINE_COMPONENTS[id].animation;
      if (anim.kind === 'none') continue;
      const sprite = this.sprites.get(id);
      if (sprite === undefined) continue;
      if (!isActive(id)) {
        // Assembling: the tween owns x/y/scale/alpha, but a visible driven or spin part keeps turning so it does not snap on landing.
        // A visible ram adds its stroke offset on top of the tween's y (tweens step before scene update), so it lands
        // in step with thetaM without overriding the drop. Strikes are not counted while assembling.
        if (anim.kind === 'driven' && sprite.visible) applyAngle(sprite, this.drivenAngle(id, anim));
        if (anim.kind === 'spin' && sprite.visible) {
          this.spinPart(id, sprite, anim, driverValue(anim.driver, this.manual, me, ee, pr, rs, xf), dt, policy.maxDegPerSec, boost);
        }
        if (anim.kind === 'reciprocate' && sprite.visible) sprite.y += this.ramOffset(anim, prevMasterDeg, dt);
        continue;
      }

      if (id === INVERSION_GHOST_FX.component) {
        this.placeGhost(sprite);
        continue;
      }

      switch (anim.kind) {
        case 'driven': {
          applyAngle(sprite, this.drivenAngle(id, anim));
          break;
        }
        case 'slider': {
          const centre = resolveAttachment(MACHINE_COMPONENTS[DRIVE_TRAIN.rod.crank]);
          const angle = partAngle(this.master.deg, this.rodCrank.ratio, this.rodCrank.phaseDeg) + DRIVE_TRAIN.rod.pinPhaseDeg;
          const slider = sliderCrank(centre, DRIVE_TRAIN.rod.pinRadius, DRIVE_TRAIN.rod.length, angle).slider;
          sprite.setPosition(DRIVE_TRAIN.rod.sliderX, Math.round(slider.y));
          break;
        }
        case 'vibrate': {
          const vdv = driverValue(anim.driver, this.manual, me, ee, pr, rs, xf);
          const speed = vdv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(anim.speed, vdv); // rest below threshold
          const base = resolveAttachment(MACHINE_COMPONENTS[id]);
          if (speed === 0) {
            sprite.setPosition(base.x, base.y);
            break;
          }
          const phase = advancePhase(this.phases.get(id) ?? 0, speed, dt);
          this.phases.set(id, phase);
          const o = vibrateOffset(phase, anim.amplitude);
          sprite.setPosition(base.x + o.x, base.y + o.y);
          break;
        }
        case 'frames': {
          // Frame cycle: advances at up to maxHz while the driver is above rest, holds frame 0 otherwise.
          const fdv = driverValue(anim.driver, this.manual, me, ee, pr, rs, xf);
          if (id === RESONANCE_MILESTONE_FX.crystal && this.elapsed < this.crystalHoldUntil) {
            sprite.setFrame(RESONANCE_MILESTONE_FX.holdFrame); // milestone hold: bright frame, no cycle
            break;
          }
          const glows: readonly string[] = EXOTIC_MILESTONE_FX.anchorGlows;
          if (glows.includes(id) && this.exoticWithin(EXOTIC_MILESTONE_FX.glowHoldMs)) {
            sprite.setFrame(EXOTIC_MILESTONE_FX.glowFrame); // finalAlignment hold: anchor glow at its hold frame
            break;
          }
          const hold = FINALE_HOLD_FRAMES[id];
          if (hold !== undefined && boost > 0) {
            sprite.setFrame(hold); // finale boost: the part holds its finale frame
            break;
          }
          const origin = this.frameOrigins.get(id) ?? 0; // milestone restarts count from their origin
          // Reduced motion (no flashes): the cycle is frozen on the rest frame (spark gap flicker, siphon arcs, dish waves).
          // A finale boost starts the cycle even when the driver is at rest.
          const cycling = policy.flashes && (fdv >= MACHINE_MOTION.restThreshold || boost > 0);
          const hz = boostedValue(anim.maxHz, FRAMES_MAX_HZ, boost);
          const cycle = framesIndex(this.elapsed - origin, anim.frames, hz, cycling);
          sprite.setFrame((cycle + (anim.frameOffset ?? 0)) % anim.frames); // staggered sheets offset their cycle
          break;
        }
        case 'spin': {
          this.spinPart(id, sprite, anim, driverValue(anim.driver, this.manual, me, ee, pr, rs, xf), dt, policy.maxDegPerSec, boost);
          break;
        }
        case 'gauge': {
          // Needle: the driver is low-passed, then mapped onto the log scale of the frames sheet.
          const target = driverValue(anim.driver, this.manual, me, ee, pr, rs, xf);
          const value = lowPass(this.gaugeValues.get(id) ?? 0, target, dt, anim.tauSeconds);
          this.gaugeValues.set(id, value);
          sprite.setFrame(gaugeFrame(value, anim.frames, anim.minLog, anim.maxLog));
          break;
        }
        case 'reciprocate': {
          this.placeRam(id, sprite, anim, prevMasterDeg, dt);
          break;
        }
        case 'orbit': {
          this.placeBead(id, sprite, anim, dt, exotic, xf, policy.maxDegPerSec, boost);
          break;
        }
        case 'latch': {
          this.placeLatch(sprite, id, anim, levels[anim.techId] >= anim.minLevel);
          break;
        }
        case 'stage': {
          const met = anim.gates.filter(([techId, level]) => levels[techId] >= level).length; // gates met
          sprite.setFrame(stageFrameOf(met, anim.frames, this.finaleRestored, anim.endingFrame));
          break;
        }
      }
    }
    this.firstFrame = false;
  }

  /** Inversion ghost: a mirror of the hand crank, shown with hard alpha steps for echoSeconds after a click. */
  private placeGhost(sprite: Phaser.GameObjects.Sprite): void {
    const since = this.lastClickAt === null ? null : this.elapsed - this.lastClickAt;
    const alpha = echoAlpha(since, INVERSION_GHOST_FX.alphaSteps);
    sprite.setVisible(alpha > 0).setAlpha(alpha);
    if (alpha <= 0) return;
    const mirror = INVERSION_GHOST_FX.mirrorOf;
    applyAngle(sprite, mirrorAngle(this.drivenAngle(mirror, drivenOf(mirror))));
  }

  /**
   * Containment bead on its ring. phi advances with the exotic driver (XF/s); during the finalAlignment milestone it aligns
   * to beadPhiDeg (align, then hold) and the normal orbit resumes from there. In front of the core (sin phi >= 0) the bead
   * draws on its frontLayer; a depth change is flagged for the parts re-sort.
   */
  private placeBead(
    id: MachineComponentId,
    sprite: Phaser.GameObjects.Sprite,
    anim: Extract<ComponentAnimation, { kind: 'orbit' }>,
    dt: number,
    exotic: { phase: 'none' | 'align' | 'hold'; t01: number },
    xf: number,
    maxDegPerSec: number | null,
    boost: number,
  ): void {
    const from = this.orbitAngles.get(id) ?? anim.phi0Deg;
    let phi: number;
    if (exotic.phase === 'align') {
      phi = alignStep(this.exoticFrom.get(id) ?? from, EXOTIC_MILESTONE_FX.beadPhiDeg, anim.dir, exotic.t01);
    } else if (exotic.phase === 'hold') {
      phi = EXOTIC_MILESTONE_FX.beadPhiDeg;
    } else {
      const actual = xf < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(anim.speed, xf) * anim.speedScale; // rest below threshold
      const raw = boostedValue(actual, anim.speed.max * anim.speedScale, boost); // finale boost towards the bead's top speed
      phi = orbitStep(from, anim.dir, capSpeed(raw, maxDegPerSec), dt);
    }
    this.orbitAngles.set(id, phi);
    const def = MACHINE_COMPONENTS[id];
    const base = resolveAttachment(def);
    const p = orbitPoint(RING_GEOMETRY[anim.ring], phi);
    sprite.setPosition(base.x + Math.floor(p.x), base.y + Math.floor(p.y));
    const depth = orbitFront(phi) ? MACHINE_LAYER_DEPTH[anim.frontLayer] + anim.frontBias : componentDepth(def);
    if (sprite.depth !== depth) {
      sprite.setDepth(depth);
      this.depthChanged = true;
    }
  }

  /**
   * Latch part: frame 0 until its gate holds, then 0 -> frames-1 once and held (latchFrame). A gate already met at the first
   * update after load / reset (see seeding in update) shows the last frame without animating. A gate met later animates from
   * the moment it opened, also when the part was still assembling then. Losing the gate re-arms the latch.
   */
  private placeLatch(
    sprite: Phaser.GameObjects.Sprite,
    id: MachineComponentId,
    anim: Extract<ComponentAnimation, { kind: 'latch' }>,
    gate: boolean,
  ): void {
    const prior = this.latchStart.get(id);
    let since: number | null;
    if (!gate) {
      this.latchStart.set(id, 'off'); // gate not met (or reset): frame 0
      since = null;
    } else if (prior === undefined || prior === 'off') {
      this.latchStart.set(id, this.elapsed); // the gate just opened: the sequence starts now
      since = 0;
    } else if (prior === 'done') {
      since = Infinity;
    } else {
      since = this.elapsed - prior;
    }
    const frame = latchFrame(since, anim.frames, anim.fps);
    sprite.setFrame(frame);
    this.latchFrames.set(id, frame);
  }

  /** True for `ms` after the finalAlignment milestone (animator clock). */
  private exoticWithin(ms: number): boolean {
    return this.exoticMilestoneAt !== null && this.elapsed - this.exoticMilestoneAt < ms / 1000;
  }

  /** Reset: every bead goes back to its own layer depth. */
  private restoreBeadDepths(): void {
    for (const id of MACHINE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      if (def.animation.kind !== 'orbit') continue;
      const sprite = this.sprites.get(id);
      if (sprite === undefined) continue;
      sprite.setDepth(componentDepth(def));
      this.depthChanged = true;
    }
  }

  /** Ram stroke offset (art px) for this frame: a swing faster than HAMMER_FX.maxDegPerSec is parked mid-stroke. */
  private ramOffset(anim: { ratio: number; strokeArtPx: number; phaseDeg: number }, prevMasterDeg: number, dt: number): number {
    const deltaDeg = this.master.deg - prevMasterDeg;
    const fast = dt > 0 && Math.abs(anim.ratio * deltaDeg) / dt > HAMMER_FX.maxDegPerSec;
    return fast ? HAMMER_FX.midOffsetArtPx : reciprocateOffset(this.master.deg, anim.ratio, anim.strokeArtPx, anim.phaseDeg);
  }

  /** Active ram: base + stroke offset; counts strikes unless parked (fast swing). */
  private placeRam(
    id: MachineComponentId,
    sprite: Phaser.GameObjects.Sprite,
    anim: { ratio: number; strokeArtPx: number; phaseDeg: number },
    prevMasterDeg: number,
    dt: number,
  ): void {
    const base = resolveAttachment(MACHINE_COMPONENTS[id]);
    const deltaDeg = this.master.deg - prevMasterDeg;
    const fast = dt > 0 && Math.abs(anim.ratio * deltaDeg) / dt > HAMMER_FX.maxDegPerSec;
    sprite.setPosition(base.x, base.y + this.ramOffset(anim, prevMasterDeg, dt));
    if (!fast && dt > 0) this.strikes += strikeCount(prevMasterDeg, this.master.deg, anim.ratio, anim.phaseDeg);
  }

  /**
   * Spin part: own angle += speed(driver) * dt, rest below the threshold; shown on its rotation sheet or rotated.
   * maxDegPerSec (reduced motion) caps the speed, milestone and finale boost included (the boost is applied before the cap).
   */
  private spinPart(
    id: MachineComponentId,
    sprite: Phaser.GameObjects.Sprite,
    anim: { speed: SpeedCurve },
    dv: number,
    dt: number,
    maxDegPerSec: number | null,
    finaleBoost: number,
  ): void {
    const actual = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(anim.speed, dv); // rest below threshold
    const base = boostedValue(actual, anim.speed.max, finaleBoost); // finale boost towards the curve max; identity at 0
    const milestone = id === EXOTIC_MILESTONE_FX.core && this.exoticWithin(EXOTIC_MILESTONE_FX.coreSpinMs) ? EXOTIC_MILESTONE_FX.coreSpinMult : 1;
    const angle = spinStep(this.spinAngles.get(id) ?? 0, capSpeed(base * milestone, maxDegPerSec), dt);
    this.spinAngles.set(id, angle);
    applyAngle(sprite, angle);
  }

  /**
   * Finale render state, pushed by the director each frame: boost 0..1 lifts speeds and frame rates towards their curve maxima
   * and holds the FINALE_BOOST.holdFrames parts; restored moves stage parts to their endingFrame. Non-finite boost reads as 0.
   */
  setFinale(f: { boost: number; restored: boolean }): void {
    this.finaleBoost = Number.isFinite(f.boost) ? Math.min(1, Math.max(0, f.boost)) : 0;
    this.finaleRestored = f.restored;
  }

  /** Angle of a driven part: crank parts follow the crank state and gearing, the rest follow thetaM. */
  private drivenAngle(id: MachineComponentId, anim: { ratio: number; phaseDeg: number }): number {
    return CRANK_PARTS.includes(id)
      ? crankAngle(this.geared, this.crankState.deg, this.master.deg, this.crankOffsetDeg, anim.ratio, anim.phaseDeg)
      : partAngle(this.master.deg, anim.ratio, anim.phaseDeg);
  }

  /**
   * Gear visibility edge: on the first frame the pinion is active the crank joins the drive train. The offset is taken
   * from the current crank and master angles, and pending crank clicks move onto thetaM (same ratio, so added directly).
   */
  private syncGearing(gearsActive: boolean): void {
    if (gearsActive && !this.gearsActive) {
      this.crankOffsetDeg = crankOffsetOnGearUp(this.crankState.deg, this.master.deg, this.crankRatio, this.crankPhaseDeg);
      this.master = { deg: this.master.deg, pending: this.master.pending + this.crankState.pending };
      this.crankState = { deg: this.crankState.deg, pending: 0 };
      this.geared = true;
    }
    this.gearsActive = gearsActive;
  }

  /** Master angle (unwrapped thetaM) and the idle drift magnitude of the last frame. */
  getDrive(): { masterDeg: number; degPerSec: number } {
    return { masterDeg: this.master.deg, degPerSec: this.lastDegPerSec };
  }

  /** Displayed angle of a driven part (deg), or null for any other kind. Snapped to the rotation frame when the part shows one. */
  angleOf(id: MachineComponentId): number | null {
    const anim = MACHINE_COMPONENTS[id].animation;
    if (anim.kind !== 'driven') return null;
    const deg = this.drivenAngle(id, anim);
    const sprite = this.sprites.get(id);
    const n = sprite === undefined ? 0 : sprite.texture.frameTotal - 1; // Phaser counts the __BASE frame
    if (sprite !== undefined && sprite.texture.key.endsWith('#rot') && n > 1) return (rotationFrame(deg, n) * 360) / n;
    return deg;
  }

  /** Current driver inputs: manual activity, ME/s, EE/s, PR/s, RS/s and XF/s (automation, electric, thermal, resonance, exotic). */
  getDriverValues(): { manual: number; automation: number; electric: number; thermal: number; resonance: number; exotic: number } {
    const rates = this.session.rates.perSecond;
    return { manual: this.manual, automation: rates.me, electric: rates.ee, thermal: rates.pr, resonance: rates.rs, exotic: rates.xf };
  }

  /** Current frame of a latch part, or null for any other part (0 before its first active frame). */
  latchFrame(id: MachineComponentId): number | null {
    if (MACHINE_COMPONENTS[id].animation.kind !== 'latch') return null;
    return this.latchFrames.get(id) ?? 0;
  }

  /** True once after any bead changed its front / back depth since the last call; then false. */
  consumeDepthChanged(): boolean {
    const changed = this.depthChanged;
    this.depthChanged = false;
    return changed;
  }

  /** Hammer strikes since the last call; returns the count and resets it to 0. */
  consumeStrikes(): number {
    const n = this.strikes;
    this.strikes = 0;
    return n;
  }

  /** Removes the session subscriptions. */
  destroy(): void {
    this.unsubscribeClick();
    this.unsubscribeReset();
    this.unsubscribeMilestone();
    this.unsubscribeExotic();
  }
}
