import Phaser from 'phaser';
import { CYCLE_TRANSITION } from '../../data/prestige';
import { CAMERA, DEPTH, VIEW, WORLD } from '../../data/world';
import { effectiveMinZoom } from '../math/camera';
import { cycleTransitionAlpha, cycleTransitionEndMs, cycleTransitionPeakMs } from '../math/cycleTransition';

// New-cycle white transition (WP14 C6, ART_ERA5 §7). One screen-fixed rect above every world layer (FinaleFx's screen
// rect is DEPTH.floatingText + 2); DOM sits above the canvas. Timing and colour: CYCLE_TRANSITION; alpha: math/cycleTransition.
// onPeak fires once when the clock crosses the peak (the cycle swap runs there, the screen is white), onDone once at the end.

const TRANSITION_DEPTH = DEPTH.floatingText + 3;

export interface CycleTransitionState {
  active: boolean;
  tMs: number;
  alpha: number;
}

/** Step in ms: non-finite or negative input is zero, a long frame is capped at CYCLE_TRANSITION.maxStepMs. */
function stepMs(deltaMs: number): number {
  const raw = Number.isFinite(deltaMs) ? deltaMs : 0;
  return Math.min(CYCLE_TRANSITION.maxStepMs, Math.max(0, raw));
}

export class CycleTransition {
  private readonly rect: Phaser.GameObjects.Rectangle;
  private active = false;
  private reduced = false;
  private tMs = 0;
  private alpha = 0;
  private peaked = false;
  private onPeak: (() => void) | null = null;
  private onDone: (() => void) | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    // Covers the widest visible rect at any zoom (same sizing as the finale screen rect).
    const minZoom = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);
    this.rect = scene.add
      .rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width / minZoom, VIEW.height / minZoom, CYCLE_TRANSITION.color, 1)
      .setScrollFactor(0)
      .setDepth(TRANSITION_DEPTH)
      .setVisible(false);
  }

  /**
   * Starts the transition from alpha 0. reduced picks the shorter timings (settings.reducedMotion, read by the caller).
   * A transition already running completes first (its callbacks fire once). Destroyed: both callbacks run at once.
   */
  play(reduced: boolean, onPeak: () => void, onDone: () => void): void {
    if (this.destroyed) {
      onPeak();
      onDone();
      return;
    }
    if (this.active) this.finish();
    this.reduced = reduced;
    this.active = true;
    this.tMs = 0;
    this.peaked = false;
    this.onPeak = onPeak;
    this.onDone = onDone;
    this.setAlpha(0);
  }

  /** Advances the clock by deltaMs (clamped). Idle when not active. */
  update(deltaMs: number): void {
    if (!this.active) return;
    this.tMs += stepMs(deltaMs);
    if (!this.peaked && this.tMs >= cycleTransitionPeakMs(this.reduced)) {
      this.peaked = true;
      this.setAlpha(1);
      this.onPeak?.();
      if (!this.active) return; // the peak callback destroyed the transition
    }
    if (this.tMs >= cycleTransitionEndMs(this.reduced)) {
      this.finish();
      return;
    }
    this.setAlpha(cycleTransitionAlpha(this.tMs, this.reduced));
  }

  isActive(): boolean {
    return this.active;
  }

  getState(): CycleTransitionState {
    return { active: this.active, tMs: this.tMs, alpha: this.alpha };
  }

  /** Disposes the rect. A running transition finishes first (a pending peak and the end fire), so the cycle is never lost. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.active) this.finish();
    this.rect.destroy();
  }

  /** Ends the transition now: a pending peak fires, then the end. Each callback runs at most once. */
  private finish(): void {
    const peak = this.onPeak;
    const done = this.onDone;
    const wasPeaked = this.peaked;
    this.active = false;
    this.peaked = false;
    this.onPeak = null;
    this.onDone = null;
    this.setAlpha(0);
    if (!wasPeaked) peak?.();
    done?.();
  }

  private setAlpha(alpha: number): void {
    if (alpha === this.alpha) return;
    this.alpha = alpha;
    this.rect.setAlpha(alpha).setVisible(alpha > 0);
  }
}
