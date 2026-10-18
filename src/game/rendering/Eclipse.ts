import Phaser from 'phaser';
import { VIEW, WORLD, CAMERA, ECLIPSE } from '../../data/world';
import type { GameSession } from '../../simulation';
import { motionPolicy } from '../../simulation/settings';
import { effectiveMinZoom } from '../math/camera';
import { skyPxToScrollZero, stageFrame } from '../math/parallax';
import type { FinaleFrame } from '../math/finale';

// Era V eclipse in the sky: one screen-fixed sprite whose sheet frame steps up with the null / lens / horizon /
// aperture stages (ECLIPSE data). Frame 0 is the baked sun in bg.sky, so the sprite is hidden there. The aperture
// purchase flashes the diamond frame for ECLIPSE.diamond.ms, then the stage frame returns. Frame changes are instant.
export class Eclipse {
  private readonly session: GameSession;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly unsubscribers: Array<() => void> = [];
  private diamondLeftMs: number | null = null; // ms left of the diamond flash; null when not flashing
  private shownFrame = -1;
  private finale: FinaleFrame['eclipse'] = { kind: 'stage' }; // finale override; 'stage' = WP11 behaviour

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

  // Finale override: 'frame' shows that sheet frame, 'hidden' hides the sprite, 'stage' returns to the WP11 stage logic.
  applyFinale(e: FinaleFrame['eclipse']): void {
    this.finale = e;
    this.refresh();
  }

  destroy(): void {
    for (const off of this.unsubscribers) off();
    this.unsubscribers.length = 0;
    if (this.sprite.scene) this.sprite.destroy(); // Phaser clears scene on destroy
  }

  // Sets the sheet frame only when it changes; frame 0 hides the sprite. Reduced motion (flashes off) skips the diamond flash.
  private refresh(): void {
    const frame = this.wantedFrame();
    if (frame === this.shownFrame) return;
    this.shownFrame = frame;
    this.sprite.setFrame(frame).setVisible(frame > 0);
  }

  private wantedFrame(): number {
    if (this.finale.kind === 'frame') return this.finale.frame;
    if (this.finale.kind === 'hidden') return 0;
    const flashing = this.diamondLeftMs !== null && motionPolicy(this.session.settings).flashes;
    return flashing
      ? ECLIPSE.diamond.frame
      : stageFrame(ECLIPSE.stages, this.session.state.techLevels);
  }
}
