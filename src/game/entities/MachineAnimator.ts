import Phaser from 'phaser';
import type { GameSession } from '../../simulation';
import { DRIVE_TRAIN, MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS, MACHINE_MOTION } from '../../data/machineComponents';
import type { MachineComponentId, SpeedCurve } from '../../data/machineComponents';
import { HAMMER_FX } from '../../data/steamFx';
import { CRANK_FEEDBACK } from '../../data/world';
import {
  addActivity,
  advancePhase,
  animationSpeed,
  clampFrameSeconds,
  decayActivity,
  driverValue,
  framesIndex,
  gaugeFrame,
  lowPass,
  reciprocateOffset,
  spinStep,
  strikeCount,
  vibrateOffset,
} from '../math/animation';
import { addClickImpulse, partAngle, rotationFrame, sliderCrank, stepMaster } from '../math/driveTrain';
import type { MasterState } from '../math/driveTrain';
import { crankAngle, crankOffsetOnGearUp } from '../math/crankLink';
import { resolveAttachment } from '../math/machineLayout';

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

/** Parts that turn with the hand crank. They share one crank angle state and one driven ratio/phase. */
const CRANK_PARTS: readonly MachineComponentId[] = ['handCrank', 'crankBrace'];

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
 * Other kinds: `vibrate` / `frames` follow the manual, automation, electric or thermal (PR/s) driver; `spin` turns its own
 * angle at a driver-set speed; `gauge` low-passes its driver into a needle frame; `reciprocate` strikes with thetaM and counts
 * hammer strikes (see consumeStrikes).
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
  private readonly unsubscribeClick: () => void;
  private readonly unsubscribeReset: () => void;

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
      this.phases.clear();
      this.spinAngles.clear();
      this.gaugeValues.clear();
      // Stale angles must not snap in later: every driven and spin part goes back to angle 0.
      for (const id of MACHINE_COMPONENT_IDS) {
        const kind = MACHINE_COMPONENTS[id].animation.kind;
        if (kind !== 'driven' && kind !== 'spin') continue;
        const sprite = this.sprites.get(id);
        if (sprite !== undefined) applyAngle(sprite, 0);
      }
    });
  }

  /** Advances the master angle and places every active part by one frame. */
  update(deltaMs: number, isActive: (id: MachineComponentId) => boolean): void {
    const dt = clampFrameSeconds(deltaMs, MACHINE_MOTION.maxFrameSeconds);
    this.elapsed += dt; // frame-cycle clock
    const prevMasterDeg = this.master.deg; // before this frame's step: strike detection
    const me = this.session.rates.perSecond.me;
    const ee = this.session.rates.perSecond.ee;
    const pr = this.session.rates.perSecond.pr;
    this.manual = decayActivity(this.manual, dt, MACHINE_MOTION.manualTauSeconds); // activity fades when idle
    const dv = driverValue('combined', this.manual, me);
    const degPerSec = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(DRIVE_TRAIN.masterSpeed, dv); // rest below threshold
    this.syncGearing(isActive('gearSmall'));
    this.master = stepMaster(this.master, degPerSec, DRIVE_TRAIN.masterDirection, dt, DRIVE_TRAIN.clickTauSeconds);
    this.crankState = stepMaster(this.crankState, 0, 1, dt, DRIVE_TRAIN.clickTauSeconds); // crank clicks only, no drift
    this.lastDegPerSec = degPerSec;

    for (const id of MACHINE_COMPONENT_IDS) {
      const anim = MACHINE_COMPONENTS[id].animation;
      if (anim.kind === 'none') continue;
      const sprite = this.sprites.get(id);
      if (sprite === undefined) continue;
      if (!isActive(id)) {
        // Assembling: the tween owns x/y/scale/alpha, but a visible driven or spin part keeps turning so it does not snap on landing.
        if (anim.kind === 'driven' && sprite.visible) applyAngle(sprite, this.drivenAngle(id, anim));
        if (anim.kind === 'spin' && sprite.visible) {
          this.spinPart(id, sprite, anim, driverValue(anim.driver, this.manual, me, ee, pr), dt);
        }
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
          const vdv = driverValue(anim.driver, this.manual, me, ee, pr);
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
          const fdv = driverValue(anim.driver, this.manual, me, ee, pr);
          sprite.setFrame(framesIndex(this.elapsed, anim.frames, anim.maxHz, fdv >= MACHINE_MOTION.restThreshold));
          break;
        }
        case 'spin': {
          this.spinPart(id, sprite, anim, driverValue(anim.driver, this.manual, me, ee, pr), dt);
          break;
        }
        case 'gauge': {
          // Needle: the driver is low-passed, then mapped onto the log scale of the frames sheet.
          const target = driverValue(anim.driver, this.manual, me, ee, pr);
          const value = lowPass(this.gaugeValues.get(id) ?? 0, target, dt, anim.tauSeconds);
          this.gaugeValues.set(id, value);
          sprite.setFrame(gaugeFrame(value, anim.frames, anim.minLog, anim.maxLog));
          break;
        }
        case 'reciprocate': {
          // Ram: rides thetaM. A swing faster than HAMMER_FX.maxDegPerSec is parked mid-stroke and counts no strike.
          const base = resolveAttachment(MACHINE_COMPONENTS[id]);
          const deltaDeg = this.master.deg - prevMasterDeg;
          const fast = dt > 0 && Math.abs(anim.ratio * deltaDeg) / dt > HAMMER_FX.maxDegPerSec;
          if (fast) {
            sprite.setPosition(base.x, base.y + HAMMER_FX.midOffsetArtPx);
            break;
          }
          const offset = reciprocateOffset(this.master.deg, anim.ratio, anim.strokeArtPx, anim.phaseDeg);
          sprite.setPosition(base.x, base.y + offset);
          if (dt > 0) this.strikes += strikeCount(prevMasterDeg, this.master.deg, anim.ratio, anim.phaseDeg);
          break;
        }
      }
    }
  }

  /** Spin part: own angle += speed(driver) * dt, rest below the threshold; shown on its rotation sheet or rotated. */
  private spinPart(id: MachineComponentId, sprite: Phaser.GameObjects.Sprite, anim: { speed: SpeedCurve }, dv: number, dt: number): void {
    const speed = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(anim.speed, dv); // rest below threshold
    const angle = spinStep(this.spinAngles.get(id) ?? 0, speed, dt);
    this.spinAngles.set(id, angle);
    applyAngle(sprite, angle);
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

  /** Current driver inputs: manual activity, automation rate (ME/s), electric rate (EE/s) and thermal rate (PR/s). */
  getDriverValues(): { manual: number; automation: number; electric: number; thermal: number } {
    const rates = this.session.rates.perSecond;
    return { manual: this.manual, automation: rates.me, electric: rates.ee, thermal: rates.pr };
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
  }
}
