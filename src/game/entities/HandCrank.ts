import Phaser from 'phaser';
import { CRANK_FEEDBACK } from '../../data/world';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import { formatNumber } from '../../utils/format';
import type { GameContext } from '../context';
import type { MachineView } from './MachineView';
import type { FloatingText } from '../rendering/FloatingText';

const FULL_TURN_DEG = 360;
/** Unwrapped angle magnitude above which both angle values are re-based by whole turns. */
const REBASE_THRESHOLD_DEG = 3600;

/** Clickable hand crank: each click credits ME, rotates the crank, shakes the machine and shows "+N". */
export class HandCrank {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly ctx: GameContext;
  private readonly machine: MachineView;
  private readonly floatingText: FloatingText;
  private readonly scene: Phaser.Scene;
  private readonly onPointerDown: () => void;
  /** Tweened proxy for the sprite angle. Never read back from sprite.angle, which Phaser wraps to [-180, 180]. */
  private readonly spin = { deg: 0 };
  private targetAngle = 0;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, ctx: GameContext, machine: MachineView, floatingText: FloatingText) {
    const sprite = machine.getComponentSprite('handCrank');
    if (sprite === undefined) throw new Error('handCrank sprite missing');
    const def = MACHINE_COMPONENTS.handCrank;
    const anim = def.animation;
    if (anim.kind !== 'clickRotate') throw new Error('handCrank animation must be clickRotate');

    this.scene = scene;
    this.ctx = ctx;
    this.machine = machine;
    this.floatingText = floatingText;
    this.sprite = sprite;

    // Hit circle centred on the texture actually in use, not the declared size.
    const cx = sprite.width / 2;
    const cy = sprite.height / 2;
    sprite.setInteractive({
      hitArea: new Phaser.Geom.Circle(cx, cy, CRANK_FEEDBACK.hitRadius),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });

    this.onPointerDown = (): void => {
      const gained = this.ctx.session.click(); // the only state mutation
      this.targetAngle += anim.degreesPerClick;
      // Stopping leaves spin.deg at its current value, so the new tween continues from there.
      this.tween?.stop();
      this.rebaseAngles();
      this.tween = this.scene.tweens.add({
        targets: this.spin,
        deg: this.targetAngle,
        duration: anim.tweenMs,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          this.sprite.angle = this.spin.deg;
        },
        onComplete: () => {
          this.sprite.angle = this.spin.deg;
          this.tween = null;
        },
      });
      this.floatingText.spawn(this.machine.getComponentWorldPosition('handCrank'), '+' + formatNumber(gained));
      this.machine.shake();
    };
    this.sprite.on('pointerdown', this.onPointerDown);
  }

  /** Shifts targetAngle and spin.deg by the same whole number of turns; the visual angle is unchanged. */
  private rebaseAngles(): void {
    if (Math.abs(this.targetAngle) <= REBASE_THRESHOLD_DEG) return;
    const shift = Math.trunc(this.targetAngle / FULL_TURN_DEG) * FULL_TURN_DEG;
    this.targetAngle -= shift;
    this.spin.deg -= shift;
  }

  destroy(): void {
    this.tween?.stop();
    this.tween = null;
    // Phaser may already have destroyed the sprite (container teardown on shutdown); its scene is then unset.
    if (this.sprite.scene) {
      this.sprite.off('pointerdown', this.onPointerDown);
      this.sprite.disableInteractive();
    }
  }
}
