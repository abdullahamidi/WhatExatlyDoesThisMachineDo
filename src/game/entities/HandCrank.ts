import Phaser from 'phaser';
import { CRANK_FEEDBACK, DEPTH, PIXEL_SCALE } from '../../data/world';
import { formatNumber } from '../../utils/format';
import type { GameContext } from '../context';
import type { MachineView } from './MachineView';
import type { FloatingText } from '../rendering/FloatingText';

/**
 * Clickable hand crank: a world-space circular zone over the crank. Each click credits ME, shows "+N" and shakes the machine.
 * The turn itself comes from MachineAnimator's click subscription.
 */
export class HandCrank {
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly ctx: GameContext;
  private readonly machine: MachineView;
  private readonly floatingText: FloatingText;
  private readonly onPointerDown: () => void;

  constructor(scene: Phaser.Scene, ctx: GameContext, machine: MachineView, floatingText: FloatingText) {
    this.ctx = ctx;
    this.machine = machine;
    this.floatingText = floatingText;

    const pos = machine.getComponentWorldPosition('handCrank');
    const r = CRANK_FEEDBACK.hitRadius * PIXEL_SCALE;
    this.zone = scene.add.zone(pos.x, pos.y, 2 * r, 2 * r).setDepth(DEPTH.machine + 1);
    // Zone hit areas are in local top-left coordinates, hence the centre (r, r).
    this.zone.setInteractive({
      hitArea: new Phaser.Geom.Circle(r, r, r),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });

    this.onPointerDown = (): void => {
      const gained = this.ctx.session.click(); // the only state mutation
      this.floatingText.spawn(this.machine.getComponentWorldPosition('handCrank'), '+' + formatNumber(gained));
      this.machine.shake();
    };
    this.zone.on('pointerdown', this.onPointerDown);
  }

  destroy(): void {
    // Phaser may already have destroyed the zone (scene teardown); its scene is then unset.
    if (this.zone.scene) {
      this.zone.off('pointerdown', this.onPointerDown);
      this.zone.destroy();
    }
  }
}
