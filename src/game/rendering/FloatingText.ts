import Phaser from 'phaser';
import { CRANK_FEEDBACK, DEPTH, FLOATING_TEXT } from '../../data/world';
import type { Vec2 } from '../../data/machineComponents';
import { PALETTE_CSS } from '../../data/palette';

/** Pooled "+N" text that rises and fades after a click. Never creates more than floatPoolSize texts. */
export class FloatingText {
  private readonly scene: Phaser.Scene;
  private readonly pool: Phaser.GameObjects.Text[] = [];
  private next = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Shows `text` at a world position, recycling the oldest pooled text when the pool is full. */
  spawn(worldPos: Vec2, text: string): void {
    const textObj = this.acquire();
    textObj.setText(text);
    textObj.setPosition(
      worldPos.x + (Math.random() - 0.5) * 2 * FLOATING_TEXT.jitterX, // jitter in [-jitterX, +jitterX]
      worldPos.y + FLOATING_TEXT.spawnOffsetY,
    );
    textObj.setAlpha(1).setVisible(true);
    // Rise decelerates; alpha holds near 1 for the first half, then fades (Quad.easeIn), so the number stays readable.
    this.scene.tweens.add({
      targets: textObj,
      y: textObj.y - CRANK_FEEDBACK.floatRisePx,
      duration: CRANK_FEEDBACK.floatMs,
      ease: 'Cubic.easeOut',
    });
    this.scene.tweens.add({
      targets: textObj,
      alpha: 0,
      duration: CRANK_FEEDBACK.floatMs,
      ease: 'Quad.easeIn',
      onComplete: () => textObj.setVisible(false),
    });
  }

  /** Kills tweens and destroys every pooled text. */
  destroy(): void {
    for (const textObj of this.pool) {
      this.scene.tweens.killTweensOf(textObj);
      textObj.destroy();
    }
    this.pool.length = 0;
    this.next = 0;
  }

  /** Returns the next free text: a new one while the pool is growing, else the oldest one (round-robin). */
  private acquire(): Phaser.GameObjects.Text {
    const existing = this.pool[this.next];
    if (existing) {
      this.scene.tweens.killTweensOf(existing);
      this.next = (this.next + 1) % CRANK_FEEDBACK.floatPoolSize;
      return existing;
    }
    const created = this.scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: FLOATING_TEXT.fontSizePx + 'px',
        color: FLOATING_TEXT.color,
        fontStyle: 'bold',
        stroke: PALETTE_CSS.ink,
        strokeThickness: FLOATING_TEXT.strokePx,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.floatingText);
    this.pool.push(created);
    this.next = (this.next + 1) % CRANK_FEEDBACK.floatPoolSize;
    return created;
  }
}
