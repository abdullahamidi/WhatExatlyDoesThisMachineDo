import Phaser from 'phaser';
import type { GameSession } from '../../simulation';
import { MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS, MACHINE_MOTION } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
import {
  addActivity,
  advanceAngle,
  advancePhase,
  animationSpeed,
  clampFrameSeconds,
  decayActivity,
  driverValue,
  reciprocateOffset,
  vibrateOffset,
} from '../math/animation';
import { resolveAttachment } from '../math/machineLayout';

/** Drives part motion: manual activity from clicks, automation from ME/s. The hand crank is never touched. */
export class MachineAnimator {
  private readonly session: GameSession;
  private readonly sprites: ReadonlyMap<MachineComponentId, Phaser.GameObjects.Sprite>;
  /** Stored angle in degrees for rotating parts. */
  private readonly angles = new Map<MachineComponentId, number>();
  /** Stored phase in cycles for reciprocating and vibrating parts. */
  private readonly phases = new Map<MachineComponentId, number>();
  private manual = 0;
  private readonly unsubscribeClick: () => void;
  private readonly unsubscribeReset: () => void;

  constructor(session: GameSession, sprites: ReadonlyMap<MachineComponentId, Phaser.GameObjects.Sprite>) {
    this.session = session;
    this.sprites = sprites;
    this.unsubscribeClick = session.on('click', ({ gained }) => {
      this.manual = addActivity(this.manual, gained, MACHINE_MOTION.manualTauSeconds); // impulse per click
    });
    this.unsubscribeReset = session.on('reset', () => {
      this.manual = 0;
      this.angles.clear();
      this.phases.clear();
    });
  }

  /** Advances every active, animated part by one frame. */
  update(deltaMs: number, isActive: (id: MachineComponentId) => boolean): void {
    const dt = clampFrameSeconds(deltaMs, MACHINE_MOTION.maxFrameSeconds);
    this.manual = decayActivity(this.manual, dt, MACHINE_MOTION.manualTauSeconds); // activity fades when idle
    const automation = this.session.rates.perSecond;

    for (const id of MACHINE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      const anim = def.animation;
      if (anim.kind === 'none' || anim.kind === 'clickRotate') continue; // HandCrank owns clickRotate
      const sprite = this.sprites.get(id);
      if (sprite === undefined || !isActive(id)) continue;

      const dv = driverValue(anim.driver, this.manual, automation);
      const speed = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(anim.speed, dv); // rest below threshold

      switch (anim.kind) {
        case 'rotate': {
          const angle = advanceAngle(this.angles.get(id) ?? 0, speed, anim.direction, dt);
          this.angles.set(id, angle);
          sprite.setAngle(angle);
          break;
        }
        case 'reciprocate': {
          if (speed === 0) break; // stay where it is
          const phase = advancePhase(this.phases.get(id) ?? 0, speed, dt);
          this.phases.set(id, phase);
          const off = reciprocateOffset(phase, anim.amplitude);
          const base = resolveAttachment(def);
          sprite.setPosition(base.x + (anim.axis === 'x' ? off : 0), base.y + (anim.axis === 'y' ? off : 0));
          break;
        }
        case 'vibrate': {
          const base = resolveAttachment(def);
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
