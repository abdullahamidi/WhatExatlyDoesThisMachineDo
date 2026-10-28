import Phaser from 'phaser';
import { CRANK_FEEDBACK, DEPTH, FLOATING_TEXT } from '../../data/world';
import type { Vec2 } from '../../data/machineComponents';
import { PALETTE_CSS } from '../../data/palette';
import type { GainLine } from '../../ui/hudView';

/** One pooled gain block: a container holding its stacked line texts; it rises and fades as one. */
interface GainBlockView {
  container: Phaser.GameObjects.Container;
  texts: Phaser.GameObjects.Text[];
}

/**
 * Pooled stacked crank gain text (WP17 T8). A fresh click takes the next block of the round-robin pool;
 * a merged click re-texts the newest block in place. Lines are tinted per resource and sized in world px by the caller.
 */
export class FloatingText {
  private readonly scene: Phaser.Scene;
  private readonly blocks: GainBlockView[] = [];
  private next = 0;
  /** The block last taken by a fresh showBlock: the target of merged updates. */
  private newest: GainBlockView | null = null;
  /** The lines of the latest showBlock call, merged or not, tracked or not (the debug hook reads their text). */
  private lastLines: readonly GainLine[] | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Shows the stacked gain block. `lines` are listed top-first; at most FLOATING_TEXT.maxLines are shown.
   * merged = false: the block starts at worldPos. merged = true: the newest block is re-texted and keeps its position
   * (with no block yet it is treated as fresh). Each (re)show restarts the rise and fade from the block's current y.
   * track = false (WP27 fault popups): the block is shown as usual but is never the merge target, so a later crank
   * click cannot re-text it.
   */
  showBlock(worldPos: Vec2, lines: readonly GainLine[], fontPx: number, merged: boolean, track = true): void {
    this.lastLines = lines;
    const reused = merged ? this.newest : null;
    const block = reused ?? this.acquire();
    if (track) this.newest = block;
    else if (this.newest === block) this.newest = null;
    const container = block.container;
    if (reused === null) container.setPosition(worldPos.x, worldPos.y);

    const scale = fontPx / FLOATING_TEXT.fontSizePx;
    const shown = lines.slice(0, FLOATING_TEXT.maxLines);
    const stepY = fontPx + FLOATING_TEXT.lineGapPx * scale;
    shown.forEach((line, i) => {
      // Line i sits above the bottom line: the last line of the stack is at local y 0.
      this.textAt(block, i)
        .setText(line.text)
        .setFontSize(fontPx)
        .setColor(FLOATING_TEXT.colors[line.res])
        .setStroke(PALETTE_CSS.ink, FLOATING_TEXT.strokePx * scale)
        .setPosition(0, -(shown.length - 1 - i) * stepY)
        .setVisible(true);
    });
    block.texts.slice(shown.length).forEach((textObj) => textObj.setVisible(false));

    container.setAlpha(1).setVisible(true);
    this.scene.tweens.killTweensOf(container);
    // Rise decelerates; alpha holds near 1 for the first half, then fades (Quad.easeIn), so the number stays readable.
    this.scene.tweens.add({
      targets: container,
      y: container.y - CRANK_FEEDBACK.floatRisePx * scale,
      duration: CRANK_FEEDBACK.floatMs,
      ease: 'Cubic.easeOut',
    });
    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      duration: CRANK_FEEDBACK.floatMs,
      ease: 'Quad.easeIn',
      onComplete: () => container.setVisible(false),
    });
  }

  /** The lines given to the latest showBlock, or null before the first one (smoke probe; the lines are not copied). */
  lastBlockLines(): readonly GainLine[] | null {
    return this.lastLines;
  }

  /** Kills tweens and destroys every pooled block and text. */
  destroy(): void {
    for (const block of this.blocks) {
      // Scene teardown may already have destroyed the block; its scene is then unset.
      if (!block.container.scene) continue;
      this.scene.tweens.killTweensOf(block.container);
      for (const textObj of block.texts) textObj.destroy();
      block.container.destroy();
    }
    this.blocks.length = 0;
    this.next = 0;
    this.newest = null;
  }

  /** Returns the next block of the round-robin pool: a new one while the pool is growing, else the oldest one. */
  private acquire(): GainBlockView {
    const existing = this.blocks[this.next];
    this.next = (this.next + 1) % FLOATING_TEXT.blockPoolSize;
    if (existing) {
      this.scene.tweens.killTweensOf(existing.container);
      return existing;
    }
    const created: GainBlockView = {
      container: this.scene.add.container(0, 0).setDepth(DEPTH.floatingText),
      texts: [],
    };
    this.blocks.push(created);
    return created;
  }

  /** The block's text at `index`, created on first use (indices are used in order, so the pool grows by one). */
  private textAt(block: GainBlockView, index: number): Phaser.GameObjects.Text {
    const existing = block.texts[index];
    if (existing) return existing;
    const created = this.scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: FLOATING_TEXT.fontSizePx + 'px',
        color: FLOATING_TEXT.colors.me,
        fontStyle: 'bold',
        stroke: PALETTE_CSS.ink,
        strokeThickness: FLOATING_TEXT.strokePx,
      })
      .setOrigin(0.5, 1);
    block.container.add(created);
    block.texts.push(created);
    return created;
  }
}
