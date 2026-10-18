import Phaser from 'phaser';
import { CRANK_FEEDBACK, CRANK_PULSE, DEPTH, PIXEL_SCALE } from '../../data/world';
import { formatNumber } from '../../utils/format';
import type { GameContext } from '../context';
import type { MachineView } from './MachineView';
import type { FloatingText } from '../rendering/FloatingText';

/**
 * Clickable hand crank: a world-space circular zone over the crank. Each click credits ME, shows "+N" and shakes the machine.
 * The turn itself comes from MachineAnimator's click subscription.
 * Until the first click a pulsing ring marks the crank; it is torn down on that click and never recreated.
 */
export class HandCrank {
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly ctx: GameContext;
  private readonly machine: MachineView;
  private readonly floatingText: FloatingText;
  private readonly onPointerDown: () => void;
  private pulseRing: Phaser.GameObjects.Arc | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;

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

    if (ctx.session.state.totalClicks === 0) {
      this.startPulse(scene, pos.x, pos.y);
    }

    this.onPointerDown = (): void => {
      const gained = this.ctx.session.click(); // the only state mutation
      this.floatingText.spawn(this.machine.getComponentWorldPosition('handCrank'), '+' + formatNumber(gained));
      this.machine.shake();
      this.stopPulse();
    };
    this.zone.on('pointerdown', this.onPointerDown);
  }

  destroy(): void {
    this.stopPulse();
    // Phaser may already have destroyed the zone (scene teardown); its scene is then unset.
    if (this.zone.scene) {
      this.zone.off('pointerdown', this.onPointerDown);
      this.zone.destroy();
    }
  }

  private startPulse(scene: Phaser.Scene, x: number, y: number): void {
    const ring = scene.add
      .circle(x, y, CRANK_PULSE.radiusArtPx * PIXEL_SCALE)
      .setStrokeStyle(CRANK_PULSE.strokeArtPx * PIXEL_SCALE, CRANK_PULSE.color)
      .setDepth(DEPTH.machine + 1)
      .setAlpha(0);
    this.pulseRing = ring;
    this.pulseTween = scene.tweens.add({
      targets: ring,
      alpha: CRANK_PULSE.alphaPeak,
      duration: CRANK_PULSE.periodMs / 2,
      yoyo: true,
      repeat: -1,
    });
  }

  private stopPulse(): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    if (this.pulseRing) {
      // Scene teardown may already have destroyed the ring; its scene is then unset.
      if (this.pulseRing.scene) this.pulseRing.destroy();
      this.pulseRing = null;
    }
  }
}
