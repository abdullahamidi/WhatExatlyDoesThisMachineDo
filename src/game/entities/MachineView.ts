import Phaser from 'phaser';
import { DEPTH, CRANK_FEEDBACK, MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import {
  MACHINE_ASSEMBLY,
  MACHINE_BOUNDS,
  MACHINE_COMPONENTS,
  MACHINE_COMPONENT_IDS,
  MACHINE_LAYER_DEPTH,
  MACHINE_RENDER,
  MACHINE_SHADOWS,
  MACHINE_SHADOW_STYLE,
} from '../../data/machineComponents';
import type { MachineComponentId, Vec2 } from '../../data/machineComponents';
import { HAMMER_FX } from '../../data/steamFx';
import { REDUCED_MOTION } from '../../data/settings';
import { motionPolicy } from '../../simulation/settings';
import { componentDepth, machineLocalToWorld, resolveAttachment } from '../math/machineLayout';
import { connectionOffset } from '../math/machineLinks';
import { newlyVisible, visibleComponentIds } from '../math/machineVisibility';
import type { GameContext } from '../context';
import { MachineAnimator } from './MachineAnimator';
import { MachineLinks } from '../rendering/MachineLinks';

/** Uniform random number in [lo, hi). Visual only. */
function between(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo); // lo + r * span
}

/** Index of a sprite's current texture frame. Phaser names numeric frames by their index; the __BASE frame (not numeric) reads as 0. */
function frameIndexOf(sprite: Phaser.GameObjects.Sprite): number {
  const n = Number(sprite.frame.name);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/** Perf probe window: number of recent update() durations kept for getUpdateStats. Debug only, not tuning. */
const UPDATE_SAMPLE_COUNT = 120;

/**
 * The machine container: one sprite per component, visibility driven by tech levels.
 * Layout lives on the outer `container`; the inner `parts` container holds the sprites, links and contact shadows and is the only thing shaken.
 * Render modes (`MACHINE_RENDER.mode`):
 *  - `renderTexture`: `parts` is off the display list and is drawn once per frame into a RenderTexture on the art-pixel grid
 *    (RT pixel (-MACHINE_BOUNDS.left, -MACHINE_BOUNDS.top) is machine (0,0); era V bounds: pixel (560, 616), RT 1120 x 624); the RT is the only
 *    machine image on the display list, scaled by `container`.
 *  - `direct`: `parts` sits under `container` and Phaser draws the sprites itself.
 * Newly unlocked parts fly in (assembly tween) and puff dust on landing; motion, links and shadows are driven per frame by `update`.
 * Each hammer strike (animator) puffs dust at the hammer foot; `getHammerStrikes` counts them since the last session reset.
 */
export class MachineView {
  readonly container: Phaser.GameObjects.Container;
  private readonly parts: Phaser.GameObjects.Container;
  /** Art-resolution target for `parts` in renderTexture mode; null in direct mode. */
  private readonly rt: Phaser.GameObjects.RenderTexture | null;
  private readonly shadows: Phaser.GameObjects.Graphics;
  private lastShadowKey = '';
  private readonly ctx: GameContext;
  private readonly scene: Phaser.Scene;
  private readonly sprites = new Map<MachineComponentId, Phaser.GameObjects.Sprite>();
  private readonly assembling = new Map<MachineComponentId, Phaser.Tweens.Tween>();
  private readonly puffs = new Map<Phaser.GameObjects.Image, Phaser.Tweens.Tween>();
  private readonly links: MachineLinks;
  private readonly animator: MachineAnimator;
  private readonly unsubscribes: Array<() => void> = [];
  private visibleIds: Set<MachineComponentId> = new Set();
  private shakeTween: Phaser.Tweens.TweenChain | null = null;
  /** Hammer strikes seen since the last session reset. */
  private hammerStrikes = 0;
  /** Ring buffer of the last update() durations (ms) for the perf probe; `updateCursor` is the next slot to write. */
  private readonly updateSamplesMs: number[] = [];
  private updateCursor = 0;

  /** Animator gate: a part moves only while visible and not assembling. */
  private readonly isActive = (id: MachineComponentId): boolean => this.visibleIds.has(id) && !this.assembling.has(id);

  /** Link endpoint lookup: live sprite position + connection offset; null while hidden or assembling. */
  private readonly pointOf = (component: MachineComponentId, pointId: string): Vec2 | null => {
    if (!this.visibleIds.has(component) || this.assembling.has(component)) return null;
    const sprite = this.sprites.get(component);
    const off = connectionOffset(MACHINE_COMPONENTS[component], pointId);
    return sprite !== undefined && off !== null ? { x: sprite.x + off.x, y: sprite.y + off.y } : null;
  };

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    this.container = scene.add
      .container(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y)
      .setScale(PIXEL_SCALE)
      .setDepth(DEPTH.machine);
    let parts: Phaser.GameObjects.Container;
    let rt: Phaser.GameObjects.RenderTexture | null = null;
    if (MACHINE_RENDER.mode === 'renderTexture') {
      parts = scene.make.container({ x: 0, y: 0 }, false);
      rt = scene.make
        .renderTexture(
          {
            x: MACHINE_BOUNDS.left,
            y: MACHINE_BOUNDS.top,
            width: MACHINE_BOUNDS.right - MACHINE_BOUNDS.left,
            height: MACHINE_BOUNDS.bottom - MACHINE_BOUNDS.top,
          },
          false,
        )
        .setOrigin(0, 0);
      rt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.container.add(rt);
    } else {
      parts = scene.add.container(0, 0);
      this.container.add(parts);
    }
    this.parts = parts;
    this.rt = rt;

    for (const id of MACHINE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      const att = resolveAttachment(def);
      // Driven and spin parts start on their RotSprite rotation sheet when it is loaded; the animator picks frames from it.
      const rotKey = def.assetId + '#rot';
      const rotates = def.animation.kind === 'driven' || def.animation.kind === 'spin';
      const textureKey = rotates && scene.textures.exists(rotKey) ? rotKey : def.assetId;
      const sprite = scene.add
        .sprite(att.x, att.y, textureKey, 0)
        .setOrigin(def.origin.x, def.origin.y)
        .setDepth(componentDepth(def))
        .setFlipX(def.flipX === true);
      this.sprites.set(id, sprite);
      this.parts.add(sprite);
    }
    // Links are added before the depth sort so the container orders them with the sprites.
    this.links = new MachineLinks(scene, this.parts);
    // Contact shadows sit at the bottom of the parts stack (depth -1).
    this.shadows = scene.make.graphics({}, false).setDepth(MACHINE_SHADOW_STYLE.depth);
    this.parts.add(this.shadows);
    // Container renders children in list order; sort by depth so layers stack correctly.
    this.parts.sort('depth');
    this.animator = new MachineAnimator(ctx.session, this.sprites);
    // Build and load: parts appear instantly, no assembly.
    this.sync();

    this.unsubscribes.push(
      ctx.session.on('unlock', () => this.refresh(true)),
      ctx.session.on('purchase', () => this.refresh(true)),
      ctx.session.on('reset', () => this.reset()),
    );
  }

  /** Non-animated: recompute visibility from the tech levels and place every component at rest. */
  sync(): void {
    this.stopAssemblies();
    this.visibleIds = visibleComponentIds(this.ctx.session.state.techLevels);
    this.lastShadowKey = '';
    for (const id of MACHINE_COMPONENT_IDS) this.settle(id, this.visibleIds.has(id));
  }

  /** Diffs visibility against the tech levels: hides lost parts, then assembles (or instantly settles) new ones. */
  private refresh(animate: boolean): void {
    const next = visibleComponentIds(this.ctx.session.state.techLevels);
    const added = newlyVisible(this.visibleIds, next);
    for (const id of MACHINE_COMPONENT_IDS) {
      if (next.has(id)) continue;
      this.cancelAssembly(id);
      this.sprites.get(id)?.setVisible(false);
    }
    this.visibleIds = next;
    for (const id of added) {
      if (animate) this.startAssembly(id);
      else this.settle(id, true);
    }
  }

  /**
   * Fly-in tween from above with a fade; on landing the part settles, puffs dust and the machine shakes.
   * Reduced motion (assemblyDrop off): fade-in only, no fly-in offset or scale, no dust and no landing shake.
   */
  private startAssembly(id: MachineComponentId): void {
    this.cancelAssembly(id);
    const sprite = this.sprites.get(id);
    if (sprite === undefined) return;
    const base = resolveAttachment(MACHINE_COMPONENTS[id]);
    const drop = motionPolicy(this.ctx.session.settings).assemblyDrop;
    sprite
      .setVisible(true)
      .setPosition(base.x, base.y - (drop ? MACHINE_ASSEMBLY.dropArtPx : REDUCED_MOTION.assemblyDropPx))
      .setScale(drop ? MACHINE_ASSEMBLY.startScale : 1)
      .setAlpha(0);
    const tween = this.scene.tweens.add({
      targets: sprite,
      y: base.y,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: MACHINE_ASSEMBLY.durationMs,
      ease: drop ? MACHINE_ASSEMBLY.ease : 'Linear',
      onComplete: () => {
        this.settle(id, true);
        if (drop) {
          this.spawnPuff(id);
          this.shake();
        }
        this.ctx.feedback.partLanded.emit(id);
      },
    });
    this.assembling.set(id, tween);
  }

  /** Exact rest state: at its base position, scale 1, alpha 1. The angle is left alone. */
  private settle(id: MachineComponentId, visible: boolean): void {
    this.assembling.delete(id);
    const sprite = this.sprites.get(id);
    if (sprite === undefined) return;
    const base = resolveAttachment(MACHINE_COMPONENTS[id]);
    sprite.setVisible(visible).setPosition(base.x, base.y).setScale(1).setAlpha(1);
  }

  /** Dust puffs rising from the bottom edge of a part that just landed. Bounded by puffCount per landing. */
  private spawnPuff(id: MachineComponentId): void {
    const def = MACHINE_COMPONENTS[id];
    const base = resolveAttachment(def);
    const bottomY = base.y + (1 - def.origin.y) * def.size.height; // sprite bottom edge in art px
    this.spawnDust(base.x, bottomY, MACHINE_ASSEMBLY.puffCount, MACHINE_ASSEMBLY.puffSpreadArtPx);
  }

  /** `count` dust puffs rising from (x, bottomY), spread uniformly over +-spread art px in x. Visual only. */
  private spawnDust(x: number, bottomY: number, count: number, spread: number): void {
    for (let i = 0; i < count; i += 1) {
      const img = this.scene.add
        .image(x + between(-spread, spread), bottomY, 'fx.dust')
        .setAlpha(MACHINE_ASSEMBLY.puffAlpha)
        .setDepth(MACHINE_LAYER_DEPTH.front + 1);
      this.parts.add(img); // appended on top; no re-sort
      const tween = this.scene.tweens.add({
        targets: img,
        y: bottomY - MACHINE_ASSEMBLY.puffRiseArtPx,
        alpha: 0,
        scale: MACHINE_ASSEMBLY.puffEndScale,
        duration: MACHINE_ASSEMBLY.puffMs,
        onComplete: () => {
          this.puffs.delete(img);
          img.destroy();
        },
      });
      this.puffs.set(img, tween);
    }
  }

  private cancelAssembly(id: MachineComponentId): void {
    this.assembling.get(id)?.stop();
    this.assembling.delete(id);
  }

  private stopAssemblies(): void {
    for (const tween of this.assembling.values()) tween.stop();
    this.assembling.clear();
  }

  private destroyPuffs(): void {
    for (const [img, tween] of this.puffs) {
      tween.stop();
      img.destroy();
    }
    this.puffs.clear();
  }

  /** Session reset: clear in-flight assembly and dust, then settle every part to the fresh tech levels. */
  private reset(): void {
    this.stopAssemblies();
    this.destroyPuffs();
    this.hammerStrikes = 0;
    this.sync();
  }

  /**
   * Shadows under the live static parts. Redrawn only when the set of live shadow owners changes.
   * Oval shadows are stepped row by row with an integer half-ellipse width.
   */
  private drawShadows(): void {
    const active = MACHINE_SHADOWS.filter((shadow) => this.isActive(shadow.component));
    const key = active.map((shadow) => shadow.component).join(',');
    if (key === this.lastShadowKey) return;
    this.lastShadowKey = key;
    this.shadows.clear();
    this.shadows.fillStyle(MACHINE_SHADOW_STYLE.color, MACHINE_SHADOW_STYLE.alpha);
    for (const shadow of active) {
      if (shadow.oval !== true) {
        this.shadows.fillRect(shadow.x, shadow.y, shadow.width, shadow.height);
        continue;
      }
      for (let j = 0; j < shadow.height; j += 1) {
        const t = (j + 0.5 - shadow.height / 2) / (shadow.height / 2);
        const w = Math.round(shadow.width * Math.sqrt(1 - t * t));
        this.shadows.fillRect(shadow.x + Math.floor((shadow.width - w) / 2), shadow.y + j, w, 1);
      }
    }
  }

  /**
   * Per frame: drive part motion, redraw the links between live part positions and the contact shadows,
   * then (renderTexture mode) repaint the RenderTexture from `parts`, carrying the shake offset.
   */
  update(deltaMs: number): void {
    const t0 = performance.now();
    this.animator.update(deltaMs, this.isActive);
    // A bead crossed between front and back depth: re-sort so the parts stack follows.
    if (this.animator.consumeDepthChanged()) this.parts.sort('depth');
    const strikes = this.animator.consumeStrikes();
    if (strikes > 0) {
      this.hammerStrikes += strikes;
      for (let i = 0; i < Math.min(strikes, 2); i += 1) {
        this.spawnDust(HAMMER_FX.dustAt.x, HAMMER_FX.dustAt.y, HAMMER_FX.dustPuffs, HAMMER_FX.dustSpreadArtPx);
      }
    }
    const drive = this.animator.getDrive();
    this.links.draw({
      pointOf: this.pointOf,
      isLive: this.isActive,
      masterDeg: drive.masterDeg,
      angleOf: (id) => this.animator.angleOf(id),
    });
    this.drawShadows();
    if (this.rt !== null) {
      this.rt.clear();
      this.rt.draw(
        this.parts,
        -MACHINE_BOUNDS.left + Math.round(this.parts.x),
        -MACHINE_BOUNDS.top + Math.round(this.parts.y),
      );
    }
    this.recordUpdate(performance.now() - t0);
  }

  /** Keeps the last UPDATE_SAMPLE_COUNT update() durations; the oldest is overwritten once the buffer is full. */
  private recordUpdate(ms: number): void {
    if (this.updateSamplesMs.length < UPDATE_SAMPLE_COUNT) this.updateSamplesMs.push(ms);
    else this.updateSamplesMs[this.updateCursor] = ms;
    this.updateCursor = (this.updateCursor + 1) % UPDATE_SAMPLE_COUNT;
  }

  isAssembling(id: MachineComponentId): boolean {
    return this.assembling.has(id);
  }

  /** Hammer strikes since the last session reset (monotonic between resets). */
  getHammerStrikes(): number {
    return this.hammerStrikes;
  }

  getComponentState(id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number; frame: number } {
    const sprite = this.sprites.get(id);
    if (sprite === undefined) return { visible: false, assembling: false, alpha: 0, scale: 0, frame: 0 };
    return {
      visible: sprite.visible,
      assembling: this.assembling.has(id),
      alpha: sprite.alpha,
      scale: sprite.scaleX,
      frame: frameIndexOf(sprite),
    };
  }

  /** Finale render state (boost, restored) forwarded to the animator; see MachineAnimator.setFinale. */
  applyFinale(f: { boost: number; restored: boolean }): void {
    this.animator.setFinale(f);
  }

  getComponentSprite(id: MachineComponentId): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(id);
  }

  /** Current frame of a latch part (animator); null for any other part. */
  latchFrame(id: MachineComponentId): number | null {
    return this.animator.latchFrame(id);
  }

  /**
   * Perf probe: mean and max of the recent update() durations (ms) plus the sprite count.
   * Before the first update the timings are zero.
   */
  getUpdateStats(): { meanMs: number; maxMs: number; components: number } {
    const n = this.updateSamplesMs.length;
    let sum = 0;
    let max = 0;
    for (const ms of this.updateSamplesMs) {
      sum += ms;
      if (ms > max) max = ms;
    }
    return { meanMs: n === 0 ? 0 : sum / n, maxMs: max, components: this.sprites.size };
  }

  /** World px position of a component's attachment point. */
  getComponentWorldPosition(id: MachineComponentId): Vec2 {
    return machineLocalToWorld(resolveAttachment(MACHINE_COMPONENTS[id]));
  }

  /**
   * Short horizontal jolt of the machine parts: -a, then +a, then back to rest (x = 0).
   * A running shake is stopped first; the rest position is only reached by the final step.
   * Single source of truth for the shake: a no-op while the motion policy has shake off (click and landing both come here).
   */
  shake(): void {
    if (!motionPolicy(this.ctx.session.settings).shake) return;
    this.shakeTween?.stop();
    const a = CRANK_FEEDBACK.shakePx; // art px; parts live inside the scaled container, so no PIXEL_SCALE here
    const quarter = CRANK_FEEDBACK.shakeMs / 4;
    this.shakeTween = this.scene.tweens.chain({
      targets: this.parts,
      tweens: [
        { x: -a, duration: quarter, ease: 'Sine.easeInOut' },
        { x: a, duration: quarter * 2, ease: 'Sine.easeInOut' },
        { x: 0, duration: quarter, ease: 'Sine.easeInOut' },
      ],
      onComplete: () => {
        this.parts.setX(0);
        this.shakeTween = null;
      },
    });
  }

  destroy(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes.length = 0;
    // Tweens and puffs go before the container: they reference its children.
    this.stopAssemblies();
    this.destroyPuffs();
    this.animator.destroy();
    this.links.destroy();
    this.shakeTween?.stop();
    this.shakeTween = null;
    this.container.setPosition(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y);
    this.sprites.clear();
    // Guard: Phaser clears `scene` once an object is destroyed; skip what is already gone.
    if (this.shadows.scene) this.shadows.destroy();
    // parts is not a child of container in renderTexture mode, so it is destroyed explicitly.
    if (this.rt !== null && this.parts.scene) this.parts.destroy(true);
    if (this.container.scene) this.container.destroy(true); // frees the RT image and its texture
  }
}
