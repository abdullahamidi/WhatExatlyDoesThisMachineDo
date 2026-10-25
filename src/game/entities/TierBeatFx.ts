import Phaser from 'phaser';
import { MACHINE_COMPONENTS, MACHINE_LAYER_DEPTH } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
import { PART_TIERS, PART_TIER_FX, TIER_DEBRIS, TIER_FX_COLORS } from '../../data/machineTiers';
import type { TierChange, TierDebris } from '../math/partTiers';
import { tierBeatFrame } from '../math/tierBeat';
import type { TierBeatFrame } from '../math/tierBeat';
import { TierShine } from './TierShine';
import { ensureTierPixel, TIER_PIXEL_KEY, TierSparks } from './TierSparks';

// WP22 tier-up beat FX (docs/plan/PART_TIERS.md §3.1 / §3.4, WP22 D7). Rendering only: every beat timing comes from tierBeatFrame,
// the pools are created once in the constructor and reused, and the owner applies textures through the hooks.

/** Owner callbacks of a beat. The FX never sets a machine sprite's texture, position or scale; MachineView does that through the animator. */
export interface TierBeatHooks {
  /** The machine sprite of a component, or undefined when it has none. */
  sprite(id: MachineComponentId): Phaser.GameObjects.Sprite | undefined;
  /** Applies the new tier textures to change.hosts (at swapAtMs; at t 0 in reduced motion; at once for instant swaps). */
  swap(change: TierChange): void;
  /** Once per played beat, when its time reaches 0 (after any delay). */
  started(change: TierChange): void;
  /** Once per full-motion beat, at settleMs: the owner shakes at PART_TIER_FX.shakeScale. */
  settle(): void;
}

interface Point { x: number; y: number }
interface Velocity { vx: number; vy: number }
interface Box { left: number; top: number; width: number; height: number }

/** Crown pattern: three sparks from one point, straight up, up-left and up-right (speed from PART_TIER_FX.crownSpeed, no gravity). */
const CROWN_VELOCITY: readonly Velocity[] = [
  { vx: 0, vy: -PART_TIER_FX.crownSpeed },
  { vx: -PART_TIER_FX.crownSpeed, vy: -PART_TIER_FX.crownSpeed },
  { vx: PART_TIER_FX.crownSpeed, vy: -PART_TIER_FX.crownSpeed },
];
/** Beats in flight at once: one flash image, one ghost and one shine slot each (the D6 cap is applied by the owner). */
const BEAT_SLOTS = Math.min(PART_TIER_FX.pools.flashes, PART_TIER_FX.pools.ghosts, PART_TIER_FX.pools.shines);

/** Declared bolt-down points of a host (track `mounts`), or undefined when no track declares any. */
function mountsOf(host: MachineComponentId): readonly Point[] | undefined {
  for (const track of PART_TIERS) {
    const mounts = track.mounts?.[host];
    if (mounts !== undefined) return mounts;
  }
  return undefined;
}

/** The sprite's on-screen box in parts space (art px), from its origin, position and display size. */
function boxOf(host: Phaser.GameObjects.Sprite): Box {
  const width = host.displayWidth;
  const height = host.displayHeight;
  return { left: host.x - host.originX * width, top: host.y - host.originY * height, width, height };
}

/**
 * Bolt-down points: the declared mounts as offsets from the sprite position, else the two bottom corners (PART_TIERS §3.1):
 * inset from the sides by PART_TIER_FX.mountInsetPx and lifted off the bottom edge by PART_TIER_FX.mountLiftPx.
 */
function mountPoints(host: Phaser.GameObjects.Sprite, mounts: readonly Point[] | undefined): Point[] {
  if (mounts !== undefined) return mounts.map((m) => ({ x: host.x + m.x, y: host.y + m.y }));
  const box = boxOf(host);
  const y = box.top + box.height - PART_TIER_FX.mountLiftPx;
  return [
    { x: box.left + PART_TIER_FX.mountInsetPx, y },
    { x: box.left + box.width - PART_TIER_FX.mountInsetPx, y },
  ];
}

/** Uniform random value in [min, max] (debris spread). */
function spread(range: readonly [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0]);
}

/** Random colour of a non-empty palette (TIER_DEBRIS palettes are never empty). */
function pickColor(colors: readonly number[]): number {
  return colors[Math.floor(Math.random() * colors.length)] ?? colors[0] ?? 0;
}

/** Rotating hosts (driven and spin kinds) turn under the sweep, so they skip the shine (PART_TIERS §3.1). */
function isRotating(id: MachineComponentId): boolean {
  const kind = MACHINE_COMPONENTS[id].animation.kind;
  return kind === 'driven' || kind === 'spin';
}

/** Look of heat-flash step 1 or 2 (fill and alpha), or undefined when no step runs. */
function flashLook(step: 0 | 1 | 2): { tint: number; alpha: number } | undefined {
  if (step === 0) return undefined;
  const tint = TIER_FX_COLORS.flash[step - 1];
  const alpha = PART_TIER_FX.flashAlpha[step - 1];
  return tint !== undefined && alpha !== undefined ? { tint, alpha } : undefined;
}

/** Copies the host's position, origin, flip and scale onto an overlay image. */
function follow(image: Phaser.GameObjects.Image, host: Phaser.GameObjects.Sprite): void {
  image
    .setPosition(host.x, host.y)
    .setOrigin(host.originX, host.originY)
    .setFlipX(host.flipX)
    .setScale(host.scaleX, host.scaleY);
}

/** `count` hidden pixel images added to `parts` at `depth`. Called from the constructor only. */
function imagePool(scene: Phaser.Scene, parts: Phaser.GameObjects.Container, count: number, depth: number): Phaser.GameObjects.Image[] {
  const images: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < count; i += 1) {
    const image = scene.add.image(0, 0, TIER_PIXEL_KEY).setVisible(false).setDepth(depth);
    parts.add(image);
    images.push(image);
  }
  return images;
}

/** One played tier-change beat, holding one pool slot until it ends. */
interface Beat {
  readonly change: TierChange;
  readonly primary: MachineComponentId;
  readonly slot: number;
  readonly reduced: boolean;
  readonly flash: Phaser.GameObjects.Image;
  readonly ghost: Phaser.GameObjects.Image;
  /** The old art (texture key and frame) that the flash, the ghost and the reduced crossfade show. */
  readonly oldKey: string;
  readonly oldFrame: string;
  /** Beat-local time (ms); negative while a delay runs. */
  tMs: number;
  startedFired: boolean;
  swapped: boolean;
  boltsDone: number;
  debrisDone: boolean;
  shaken: boolean;
  glinted: boolean;
}

/**
 * Tier-up beat FX inside the machine parts container (WP22 D7). Owns the flash, ghost, shine and particle pools; nothing is created per beat.
 * A beat plays on its primary host only; other hosts of the change are swapped by the owner through `hooks.swap`.
 */
export class TierBeatFx {
  private readonly hooks: TierBeatHooks;
  /** The machine parts container; re-sorted by depth when a beat starts (its overlays take a new depth). */
  private readonly parts: Phaser.GameObjects.Container;
  private readonly flashes: Phaser.GameObjects.Image[];
  private readonly ghosts: Phaser.GameObjects.Image[];
  private readonly sparks: TierSparks;
  private readonly shine: TierShine;
  /** Beats in flight, oldest first. */
  private readonly beats: Beat[] = [];
  /** Counts torque sparks: even ones take the first mount point, odd ones the next. */
  private torqueCount = 0;

  constructor(scene: Phaser.Scene, parts: Phaser.GameObjects.Container, hooks: TierBeatHooks) {
    this.hooks = hooks;
    this.parts = parts;
    ensureTierPixel(scene);
    this.flashes = imagePool(scene, parts, PART_TIER_FX.pools.flashes, MACHINE_LAYER_DEPTH.front + 3);
    this.ghosts = imagePool(scene, parts, PART_TIER_FX.pools.ghosts, MACHINE_LAYER_DEPTH.front + 3);
    this.sparks = new TierSparks(scene, parts, PART_TIER_FX.pools.particles, MACHINE_LAYER_DEPTH.front + 4);
    this.shine = new TierShine(scene, parts, PART_TIER_FX.pools.shines, PART_TIER_FX.shineCache, MACHINE_LAYER_DEPTH.front + 3);
  }

  /**
   * Starts a tier-up beat on `primary`. A beat already running on that host ends first (at once). A missing host swaps and starts at once.
   * When every slot is busy the oldest beat ends at once. `delayMs` holds the beat back (it counts as active).
   */
  play(change: TierChange, primary: MachineComponentId, reduced: boolean, delayMs = 0): void {
    this.cancel(primary);
    const host = this.hooks.sprite(primary);
    if (host === undefined) {
      this.landNow(change);
      return;
    }
    if (this.beats.length >= BEAT_SLOTS) {
      const oldest = this.beats[0];
      if (oldest !== undefined) this.end(oldest);
    }
    const slot = this.freeSlot();
    const flash = this.flashes[slot];
    const ghost = this.ghosts[slot];
    if (flash === undefined || ghost === undefined) {
      this.landNow(change);
      return;
    }
    // Overlays sit just above the host and below every part in front of it (PART_TIER_FX.overlayDepthBias).
    const depth = host.depth + PART_TIER_FX.overlayDepthBias;
    flash.setDepth(depth);
    ghost.setDepth(depth);
    this.shine.setDepth(slot, depth);
    this.parts.sort('depth');
    const beat: Beat = {
      change,
      primary,
      slot,
      reduced,
      flash,
      ghost,
      oldKey: host.texture.key,
      oldFrame: host.frame.name,
      tMs: Number.isFinite(delayMs) ? -Math.max(0, delayMs) : 0,
      startedFired: false,
      swapped: false,
      boltsDone: 0,
      debrisDone: false,
      shaken: false,
      glinted: false,
    };
    flash.setTexture(beat.oldKey, beat.oldFrame).clearTint();
    ghost.setTexture(beat.oldKey, beat.oldFrame).setTintFill(TIER_FX_COLORS.ghost);
    this.beats.push(beat);
  }

  /**
   * Instant swap (over the cap, or a change with no beat): the owner swaps now. Debris at the primary host when not reduced.
   * No flash, ghost, started hook or signal.
   */
  instant(change: TierChange, primary: MachineComponentId | null, reduced: boolean): void {
    this.hooks.swap(change);
    if (reduced || primary === null) return;
    const host = this.hooks.sprite(primary);
    if (host !== undefined) this.debris(host, change.debris);
  }

  /** One torque spark (a 3-pixel crown) at the host's next mount point. Full motion only; `_step` is not shown. */
  torque(host: MachineComponentId, _step: number, reduced: boolean): void {
    if (reduced) return;
    const sprite = this.hooks.sprite(host);
    if (sprite === undefined) return;
    const points = mountPoints(sprite, mountsOf(host));
    const at = points.length > 0 ? points[this.torqueCount % points.length] : undefined;
    this.torqueCount += 1;
    if (at !== undefined) this.crown(at);
  }

  /** Advances every beat and the particles by dtMs (clamped to PART_TIER_FX.maxStepMs: a longer frame, from a tab switch or hitch, counts as this much). */
  update(dtMs: number): void {
    const dt = Number.isFinite(dtMs) ? Math.max(0, Math.min(dtMs, PART_TIER_FX.maxStepMs)) : 0;
    this.sparks.update(dt);
    for (let i = this.beats.length - 1; i >= 0; i -= 1) {
      const beat = this.beats[i];
      if (beat !== undefined) this.step(beat, dt);
    }
  }

  /** Beats not done yet, delayed ones included. */
  active(): number {
    return this.beats.length;
  }

  /** Ends every beat whose primary is `host`, at once: unfired hooks fire, the slot frees, the images hide. */
  cancel(host: MachineComponentId): void {
    for (const beat of this.beats.filter((b) => b.primary === host)) this.end(beat);
  }

  /** Drops every beat without firing its hooks, hides every pooled image and clears the particles. */
  reset(): void {
    this.beats.length = 0;
    for (const image of this.flashes) image.setVisible(false);
    for (const image of this.ghosts) image.setVisible(false);
    for (let slot = 0; slot < BEAT_SLOTS; slot += 1) this.shine.hide(slot);
    this.sparks.clear();
  }

  /** Destroys the pooled images, the particles and the shine. */
  destroy(): void {
    this.beats.length = 0;
    for (const image of this.flashes) image.destroy();
    for (const image of this.ghosts) image.destroy();
    this.sparks.destroy();
    this.shine.destroy();
  }

  /** Swap and start at once, with no beat (a missing host or no free slot). */
  private landNow(change: TierChange): void {
    this.hooks.swap(change);
    this.hooks.started(change);
  }

  /** Lowest slot no beat holds. Called only while a slot is free. */
  private freeSlot(): number {
    let slot = 0;
    while (this.beats.some((b) => b.slot === slot)) slot += 1;
    return slot;
  }

  /** Ends a beat: it leaves its slot, its unfired hooks fire, and its images hide. */
  private end(beat: Beat): void {
    const i = this.beats.indexOf(beat);
    if (i >= 0) this.beats.splice(i, 1);
    if (!beat.startedFired) {
      beat.startedFired = true;
      this.hooks.started(beat.change);
    }
    if (!beat.swapped) {
      beat.swapped = true;
      this.hooks.swap(beat.change);
    }
    beat.flash.setVisible(false);
    beat.ghost.setVisible(false);
    this.shine.hide(beat.slot);
  }

  /** Advances one beat. Fires `started` at t 0 and draws the frame; a missing host or the end of the beat finishes it. */
  private step(beat: Beat, dt: number): void {
    beat.tMs += dt;
    if (beat.tMs < 0) return;
    const host = this.hooks.sprite(beat.primary);
    if (host === undefined) {
      this.end(beat);
      return;
    }
    if (!beat.startedFired) {
      beat.startedFired = true;
      this.hooks.started(beat.change);
    }
    const frame = tierBeatFrame(beat.tMs, beat.reduced);
    if (frame.done) {
      this.end(beat);
      return;
    }
    if (frame.swapped && !beat.swapped) {
      beat.swapped = true;
      this.hooks.swap(beat.change);
    }
    if (!beat.reduced && frame.swapped && !beat.debrisDone) {
      beat.debrisDone = true;
      this.debris(host, beat.change.debris);
    }
    if (beat.reduced) this.drawReduced(beat, host, frame);
    else this.drawFull(beat, host, frame);
  }

  /** Full motion: heat flash, ghost, bolt crowns, shine and the settle shake. */
  private drawFull(beat: Beat, host: Phaser.GameObjects.Sprite, frame: TierBeatFrame): void {
    const look = flashLook(frame.flash);
    if (look !== undefined) {
      follow(beat.flash, host);
      beat.flash.setTintFill(look.tint).setAlpha(look.alpha).setVisible(true);
    } else {
      beat.flash.setVisible(false);
    }
    if (frame.ghost !== null) {
      follow(beat.ghost, host);
      beat.ghost.setScale(host.scaleX * frame.ghost.scale, host.scaleY * frame.ghost.scale).setAlpha(frame.ghost.alpha).setVisible(true);
    } else {
      beat.ghost.setVisible(false);
    }
    while (beat.boltsDone < frame.bolts) {
      const at = mountPoints(host, mountsOf(beat.primary))[beat.boltsDone];
      beat.boltsDone += 1;
      if (at !== undefined) this.crown(at);
    }
    if (frame.shine !== null && !isRotating(beat.primary)) this.shine.show(beat.slot, host, frame.shine);
    else this.shine.hide(beat.slot);
    if (frame.shake && !beat.shaken) {
      beat.shaken = true;
      this.hooks.settle();
    }
  }

  /** Reduced motion: the old art crossfades out and four static glints mark the mount points. No flash, ghost, shine or shake. */
  private drawReduced(beat: Beat, host: Phaser.GameObjects.Sprite, frame: TierBeatFrame): void {
    beat.ghost.setVisible(false);
    this.shine.hide(beat.slot);
    if (frame.fade !== null) {
      follow(beat.flash, host);
      beat.flash.setAlpha(frame.fade).setVisible(true);
    } else {
      beat.flash.setVisible(false);
    }
    if (frame.glints && !beat.glinted) {
      beat.glinted = true;
      // Two static pixels per mount point: the mount itself and the one PART_TIER_FX.glintRisePx above it (PART_TIERS §3.4).
      for (const at of mountPoints(host, mountsOf(beat.primary))) {
        this.glint(at.x, at.y);
        this.glint(at.x, at.y - PART_TIER_FX.glintRisePx);
      }
    }
  }

  /** Static glint pixel (no motion), alive for the reduced-glint length. */
  private glint(x: number, y: number): void {
    this.sparks.spawn({ x, y, vx: 0, vy: 0, gravity: 0, lifeMs: PART_TIER_FX.reducedGlintMs, color: TIER_FX_COLORS.glint });
  }

  /** Three-pixel crown of bolt sparks from one point, each alive for PART_TIER_FX.crownMs. An empty particle pool skips the request. */
  private crown(at: Point): void {
    for (const v of CROWN_VELOCITY) {
      this.sparks.spawn({ x: at.x, y: at.y, vx: v.vx, vy: v.vy, gravity: 0, lifeMs: PART_TIER_FX.crownMs, color: TIER_FX_COLORS.bolt });
    }
  }

  /** Debris of one step, scattered over the host box (rust, scale, spark or mote per TIER_DEBRIS). */
  private debris(host: Phaser.GameObjects.Sprite, kind: TierDebris): void {
    const spec = TIER_DEBRIS[kind];
    const box = boxOf(host);
    for (let i = 0; i < PART_TIER_FX.debrisCount; i += 1) {
      this.sparks.spawn({
        x: box.left + Math.random() * box.width,
        y: box.top + Math.random() * box.height,
        vx: spread(spec.vx),
        vy: spread(spec.vy),
        gravity: spec.gravity,
        lifeMs: spec.lifeMs,
        color: pickColor(spec.colors),
      });
    }
  }
}
