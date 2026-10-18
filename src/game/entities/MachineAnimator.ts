import Phaser from 'phaser';
import type { GameSession } from '../../simulation';
import { DRIVE_TRAIN, MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS, MACHINE_MOTION } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
import { CRANK_FEEDBACK } from '../../data/world';
import {
  addActivity,
  advancePhase,
  animationSpeed,
  clampFrameSeconds,
  decayActivity,
  driverValue,
  vibrateOffset,
} from '../math/animation';
import { addClickImpulse, partAngle, sliderCrank, stepMaster } from '../math/driveTrain';
import type { MasterState } from '../math/driveTrain';
import { crankAngle, crankOffsetOnGearUp } from '../math/crankLink';
import { resolveAttachment } from '../math/machineLayout';

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
      this.phases.clear();
      // Stale angles must not snap in later: every driven part goes back to angle 0.
      for (const id of MACHINE_COMPONENT_IDS) {
        if (MACHINE_COMPONENTS[id].animation.kind !== 'driven') continue;
        this.sprites.get(id)?.setAngle(0);
      }
    });
  }

  /** Advances the master angle and places every active part by one frame. */
  update(deltaMs: number, isActive: (id: MachineComponentId) => boolean): void {
    const dt = clampFrameSeconds(deltaMs, MACHINE_MOTION.maxFrameSeconds);
    this.manual = decayActivity(this.manual, dt, MACHINE_MOTION.manualTauSeconds); // activity fades when idle
    const dv = driverValue('combined', this.manual, this.session.rates.perSecond);
    const degPerSec = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(DRIVE_TRAIN.masterSpeed, dv); // rest below threshold
    this.syncGearing(isActive('gearSmall'));
    this.master = stepMaster(this.master, degPerSec, DRIVE_TRAIN.masterDirection, dt, DRIVE_TRAIN.clickTauSeconds);
    this.crankState = stepMaster(this.crankState, 0, 1, dt, DRIVE_TRAIN.clickTauSeconds); // crank clicks only, no drift
    this.lastDegPerSec = degPerSec;

    for (const id of MACHINE_COMPONENT_IDS) {
      const anim = MACHINE_COMPONENTS[id].animation;
      if (anim.kind === 'none') continue;
      const sprite = this.sprites.get(id);
      if (sprite === undefined || !isActive(id)) continue;

      switch (anim.kind) {
        case 'driven': {
          const angle = CRANK_PARTS.includes(id)
            ? crankAngle(this.geared, this.crankState.deg, this.master.deg, this.crankOffsetDeg, anim.ratio, anim.phaseDeg)
            : partAngle(this.master.deg, anim.ratio, anim.phaseDeg);
          sprite.setAngle(angle);
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
          const vdv = driverValue(anim.driver, this.manual, this.session.rates.perSecond);
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
      }
    }
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

  /** Current driver inputs: manual activity and automation rate (ME/s). */
  getDriverValues(): { manual: number; automation: number } {
    return { manual: this.manual, automation: this.session.rates.perSecond };
  }

  /** Removes the session subscriptions. */
  destroy(): void {
    this.unsubscribeClick();
    this.unsubscribeReset();
  }
}
