import Phaser from 'phaser';

/** Key of the 1x1 white canvas texture that the tier-beat FX images tint (TierSparks and TierShine share it). */
export const TIER_PIXEL_KEY = 'fx.tierPixel';

/** Creates the 1x1 white texture once; a no-op when it already exists. */
export function ensureTierPixel(scene: Phaser.Scene): void {
  if (scene.textures.exists(TIER_PIXEL_KEY)) return;
  const tex = scene.textures.createCanvas(TIER_PIXEL_KEY, 1, 1);
  if (tex === null) return;
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1, 1);
  tex.refresh();
}

/** One particle launch: art px position, velocity (art px/s), gravity (art px/s squared), life (ms), tint and alpha (default 1). */
export interface SparkRequest {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  lifeMs: number;
  color: number;
  alpha?: number;
}

/** Pool slot: its image plus the motion state of the particle it carries. `live` false means the slot is free. */
interface Spark {
  readonly image: Phaser.GameObjects.Image;
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  age: number;
  life: number;
  alpha0: number;
}

/**
 * Shared particle pool for the tier beat (debris, bolt crowns, torque sparks; WP22 D7).
 * The `size` images are created once in the constructor and added to `parts` (the machine RT container); nothing is created per beat.
 * spawn takes a free slot or does nothing; update moves the live particles and rounds every position to whole art px.
 */
export class TierSparks {
  private readonly pool: Spark[] = [];

  constructor(scene: Phaser.Scene, parts: Phaser.GameObjects.Container, size: number, depth: number) {
    ensureTierPixel(scene);
    for (let i = 0; i < size; i += 1) {
      const image = scene.add.image(0, 0, TIER_PIXEL_KEY).setVisible(false).setDepth(depth);
      parts.add(image);
      this.pool.push({ image, live: false, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, age: 0, life: 1, alpha0: 1 });
    }
  }

  /** Launches one particle in a free slot. Returns false, and allocates nothing, when every slot is live. */
  spawn(req: SparkRequest): boolean {
    for (const p of this.pool) {
      if (p.live) continue;
      p.live = true;
      p.x = req.x;
      p.y = req.y;
      p.vx = req.vx;
      p.vy = req.vy;
      p.gravity = req.gravity;
      p.age = 0;
      p.life = req.lifeMs;
      p.alpha0 = req.alpha ?? 1;
      p.image
        .setTint(req.color)
        .setAlpha(p.alpha0)
        .setPosition(Math.round(p.x), Math.round(p.y))
        .setVisible(true);
      return true;
    }
    return false;
  }

  /** Advances the live particles by dtMs (semi-implicit Euler), fades them and frees the ones past their life. */
  update(dtMs: number): void {
    const s = dtMs / 1000;
    for (const p of this.pool) {
      if (!p.live) continue;
      p.age += dtMs;
      if (p.age >= p.life) {
        this.free(p);
        continue;
      }
      p.vy += p.gravity * s;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.image.setPosition(Math.round(p.x), Math.round(p.y)).setAlpha(p.alpha0 * (1 - p.age / p.life));
    }
  }

  /** Number of live particles. */
  active(): number {
    let n = 0;
    for (const p of this.pool) {
      if (p.live) n += 1;
    }
    return n;
  }

  /** Frees and hides every live particle. */
  clear(): void {
    for (const p of this.pool) {
      if (p.live) this.free(p);
    }
  }

  /** Destroys the pooled images. The shared pixel texture stays (TierShine uses it too). */
  destroy(): void {
    for (const p of this.pool) p.image.destroy();
    this.pool.length = 0;
  }

  private free(p: Spark): void {
    p.live = false;
    p.image.setVisible(false);
  }
}
