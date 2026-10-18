import Phaser from 'phaser';
import { CRANK_FEEDBACK } from '../../data/world';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import { formatNumber } from '../../utils/format';
import type { GameContext } from '../context';
import type { MachineView } from './MachineView';
import type { FloatingText } from '../rendering/FloatingText';

/** Clickable hand crank: each click credits ME, rotates the crank, shakes the machine and shows "+N". */
export class HandCrank {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly ctx: GameContext;
  private readonly machine: MachineView;
  private readonly floatingText: FloatingText;
  private readonly scene: Phaser.Scene;
  private readonly onPointerDown: () => void;
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

    const cx = def.size.width / 2;
    const cy = def.size.height / 2;
    sprite.setInteractive({
      hitArea: new Phaser.Geom.Circle(cx, cy, CRANK_FEEDBACK.hitRadius),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });

    this.onPointerDown = (): void => {
      const gained = this.ctx.session.click(); // the only state mutation
      this.targetAngle += anim.degreesPerClick;
      this.tween?.stop();
      this.tween = this.scene.tweens.add({
        targets: this.sprite,
        angle: this.targetAngle,
        duration: anim.tweenMs,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.sprite.angle = this.targetAngle % 360;
          this.targetAngle = this.sprite.angle;
          this.tween = null;
        },
      });
      this.floatingText.spawn(this.machine.getComponentWorldPosition('handCrank'), '+' + formatNumber(gained));
      this.machine.shake();
    };
    this.sprite.on('pointerdown', this.onPointerDown);
  }

  destroy(): void {
    this.sprite.off('pointerdown', this.onPointerDown);
    this.sprite.disableInteractive();
    this.tween?.stop();
    this.tween = null;
  }
}
