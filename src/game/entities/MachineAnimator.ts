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
import { resolveAttachment } from '../math/machineLayout';

/** Reads the driven ratio and phase of a component; throws when it is not a driven part. */
function drivenOf(id: MachineComponentId): { ratio: number; phaseDeg: number } {
  const anim = MACHINE_COMPONENTS[id].animation;
  if (anim.kind !== 'driven') throw new Error(`${id} animation must be driven`);
  return anim;
}

/**
 * Drives part motion from one master angle thetaM (the drive train). Manual activity from clicks and automation from ME/s
 * feed the combined driver; clicks queue an impulse on thetaM. The hand crank is never tweened: it is a driven part too.
 */
export class MachineAnimator {
  private readonly session: GameSession;
  private readonly sprites: ReadonlyMap<MachineComponentId, Phaser.GameObjects.Sprite>;
  /** Driven ratio of the hand crank: converts a crank click into a thetaM impulse. */
  private readonly crankRatio: number;
  /** Driven ratio and phase of the rod's crank part (main shaft): positions the slider. */
  private readonly rodCrank: { ratio: number; phaseDeg: number };
  /** Phase in cycles for vibrating parts. */
  private readonly phases = new Map<MachineComponentId, number>();
  private master: MasterState = { deg: 0, pending: 0 };
  private manual = 0;
  private lastDegPerSec = 0;
  private readonly unsubscribeClick: () => void;
  private readonly unsubscribeReset: () => void;

  constructor(session: GameSession, sprites: ReadonlyMap<MachineComponentId, Phaser.GameObjects.Sprite>) {
    this.session = session;
    this.sprites = sprites;
    this.crankRatio = drivenOf('handCrank').ratio;
    this.rodCrank = drivenOf(DRIVE_TRAIN.rod.crank);
    this.unsubscribeClick = session.on('click', ({ gained }) => {
      this.manual = addActivity(this.manual, gained, MACHINE_MOTION.manualTauSeconds); // activity from the click
      this.master = addClickImpulse(this.master, CRANK_FEEDBACK.degreesPerClick, this.crankRatio); // queued turn of thetaM
    });
    this.unsubscribeReset = session.on('reset', () => {
      this.master = { deg: 0, pending: 0 };
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
    this.master = stepMaster(this.master, degPerSec, DRIVE_TRAIN.masterDirection, dt, DRIVE_TRAIN.clickTauSeconds);
    this.lastDegPerSec = degPerSec;

    for (const id of MACHINE_COMPONENT_IDS) {
      const anim = MACHINE_COMPONENTS[id].animation;
      if (anim.kind === 'none') continue;
      const sprite = this.sprites.get(id);
      if (sprite === undefined || !isActive(id)) continue;

      switch (anim.kind) {
        case 'driven':
          sprite.setAngle(partAngle(this.master.deg, anim.ratio, anim.phaseDeg));
          break;
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
