import Phaser from 'phaser';
import { VIEW, WORLD, CAMERA, ECLIPSE } from '../../data/world';
import type { GameSession } from '../../simulation';
import { effectiveMinZoom } from '../math/camera';
import { skyPxToScrollZero, stageFrame } from '../math/parallax';

// Era V eclipse in the sky: one screen-fixed sprite whose sheet frame steps up with the null / lens / horizon /
// aperture stages (ECLIPSE data). Frame 0 is the baked sun in bg.sky, so the sprite is hidden there. The aperture
// purchase flashes the diamond frame for ECLIPSE.diamond.ms, then the stage frame returns. Frame changes are instant.
export class Eclipse {
  private readonly session: GameSession;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly unsubscribers: Array<() => void> = [];
  private diamondLeftMs: number | null = null; // ms left of the diamond flash; null when not flashing
  private shownFrame = -1;

  constructor(scene: Phaser.Scene, session: GameSession) {
    this.session = session;
    const minZoom = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);
    const at = skyPxToScrollZero(ECLIPSE.skyPx, VIEW, minZoom);
    this.sprite = scene.add
      .image(at.x, at.y, ECLIPSE.assetId, 0)
      .setScrollFactor(0)
      .setDepth(ECLIPSE.depth)
      .setScale(1 / minZoom)
      .setVisible(false);
    this.unsubscribers.push(
      session.on('purchase', ({ id }) => {
        if (id === ECLIPSE.diamond.techId) this.diamondLeftMs = ECLIPSE.diamond.ms;
      }),
      session.on('reset', () => {
        this.diamondLeftMs = null;
        this.refresh();
      }),
    );
    this.refresh();
  }

  // Runs the diamond countdown and applies the frame the current state calls for.
  update(deltaMs: number): void {
    if (this.diamondLeftMs !== null) {
      const left = this.diamondLeftMs - deltaMs;
      this.diamondLeftMs = left > 0 ? left : null;
    }
    this.refresh();
  }

  destroy(): void {
    for (const off of this.unsubscribers) off();
    this.unsubscribers.length = 0;
    if (this.sprite.scene) this.sprite.destroy(); // Phaser clears scene on destroy
  }

  // Sets the sheet frame only when it changes; frame 0 hides the sprite.
  private refresh(): void {
    const frame = this.diamondLeftMs !== null
      ? ECLIPSE.diamond.frame
      : stageFrame(ECLIPSE.stages, this.session.state.techLevels);
    if (frame === this.shownFrame) return;
    this.shownFrame = frame;
    this.sprite.setFrame(frame).setVisible(frame > 0);
  }
}
