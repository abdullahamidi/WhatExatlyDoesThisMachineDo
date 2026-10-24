import Phaser from 'phaser';
import { TIER_FX_COLORS } from '../../data/machineTiers';
import { ensureTierPixel, TIER_PIXEL_KEY } from './TierSparks';

/**
 * Frames per shine texture: the band moves across them in order. Fixed by the sweep design (PART_TIERS 3.1), not a tuning value.
 */
const SHINE_FRAMES = 4;

/**
 * Builds the sweep texture `key`: SHINE_FRAMES frames side by side, each the host frame's size.
 * In frame i the band centre is c = floor((w + h) * (i + 0.5) / SHINE_FRAMES). Pixels with source alpha > 0 and x + y = c - 1 take
 * shine[0], x + y = c take shine[1]; the band is clipped to the host alpha.
 * Returns false when the host has no drawable source or no canvas can be made. This is the only allocation outside the constructors.
 */
function buildShine(scene: Phaser.Scene, key: string, host: Phaser.GameObjects.Sprite): boolean {
  const source = host.texture.getSourceImage();
  if (!(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) return false;
  const w = host.frame.cutWidth;
  const h = host.frame.cutHeight;
  if (w <= 0 || h <= 0) return false;

  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const read = scratch.getContext('2d');
  if (read === null) return false;
  read.drawImage(source, host.frame.cutX, host.frame.cutY, w, h, 0, 0, w, h);
  const hostPixels = read.getImageData(0, 0, w, h).data;

  const tex = scene.textures.createCanvas(key, w * SHINE_FRAMES, h);
  if (tex === null) return false;
  const outW = w * SHINE_FRAMES;
  const out = tex.getContext().createImageData(outW, h);
  const dst = out.data;
  for (let i = 0; i < SHINE_FRAMES; i += 1) {
    const c = Math.floor(((w + h) * (i + 0.5)) / SHINE_FRAMES);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const s = x + y;
        if (s !== c - 1 && s !== c) continue;
        if ((hostPixels[(y * w + x) * 4 + 3] ?? 0) === 0) continue;
        const rgb = s === c - 1 ? TIER_FX_COLORS.shine[0] : TIER_FX_COLORS.shine[1];
        const d = (y * outW + i * w + x) * 4;
        dst[d] = (rgb >> 16) & 0xff;
        dst[d + 1] = (rgb >> 8) & 0xff;
        dst[d + 2] = rgb & 0xff;
        dst[d + 3] = 0xff;
      }
    }
  }
  tex.getContext().putImageData(out, 0, 0);
  tex.refresh();
  for (let i = 0; i < SHINE_FRAMES; i += 1) tex.add(i, 0, i * w, 0, w, h);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return true;
}

/**
 * Diagonal shine sweep over a host part (WP22 D7). `poolSize` images, one per slot, are created hidden in the constructor and added to `parts`.
 * `show` puts the sweep frame for a progress value on a host's current frame; the frame texture is built on first use (the only
 * on-demand texture) and kept in an LRU of `cacheSize`. A texture is never removed while a slot shows it.
 */
export class TierShine {
  private readonly scene: Phaser.Scene;
  private readonly images: Phaser.GameObjects.Image[] = [];
  /** Texture key each slot shows, or null when hidden. */
  private readonly shownKeys: (string | null)[] = [];
  /** Built texture keys, least recently used first (Map insertion order). */
  private readonly cache = new Map<string, true>();
  private readonly cacheSize: number;

  constructor(scene: Phaser.Scene, parts: Phaser.GameObjects.Container, poolSize: number, cacheSize: number, depth: number) {
    this.scene = scene;
    this.cacheSize = cacheSize;
    ensureTierPixel(scene);
    for (let i = 0; i < poolSize; i += 1) {
      const image = scene.add.image(0, 0, TIER_PIXEL_KEY).setVisible(false).setDepth(depth);
      parts.add(image);
      this.images.push(image);
      this.shownKeys.push(null);
    }
  }

  /** Shows sweep frame `progress` (0 to 1) over `host` in `slot`, matching its origin, position, scale, flip and alpha. */
  show(slot: number, host: Phaser.GameObjects.Sprite, progress: number): void {
    const image = this.images[slot];
    if (image === undefined) return;
    const key = `fx.tierShine:${host.texture.key}:${host.frame.name}`;
    if (!this.scene.textures.exists(key) && !buildShine(this.scene, key, host)) {
      this.hide(slot);
      return;
    }
    this.cache.delete(key); // move to the most recently used end
    this.cache.set(key, true);
    this.shownKeys[slot] = key;
    this.trim();
    const frame = Math.max(0, Math.min(SHINE_FRAMES - 1, Math.floor(progress * SHINE_FRAMES)));
    image
      .setTexture(key, frame)
      .setOrigin(host.originX, host.originY)
      .setPosition(Math.round(host.x), Math.round(host.y))
      .setScale(host.scaleX, host.scaleY)
      .setFlipX(host.flipX)
      .setAlpha(host.alpha)
      .setVisible(true);
  }

  /** Hides the slot's sweep. */
  hide(slot: number): void {
    const image = this.images[slot];
    if (image === undefined) return;
    image.setVisible(false);
    this.shownKeys[slot] = null;
  }

  /** Sets the slot's sweep depth (a beat overlay sits just above its host); `show` never changes it. */
  setDepth(slot: number, depth: number): void {
    this.images[slot]?.setDepth(depth);
  }

  /** Destroys the images and removes every built shine texture. */
  destroy(): void {
    for (const image of this.images) image.destroy();
    this.images.length = 0;
    this.shownKeys.length = 0;
    for (const key of this.cache.keys()) this.scene.textures.remove(key);
    this.cache.clear();
  }

  /** Drops least recently used textures until the cache is within cacheSize; a texture some slot shows is skipped. */
  private trim(): void {
    for (const key of this.cache.keys()) {
      if (this.cache.size <= this.cacheSize) return;
      if (this.shownKeys.includes(key)) continue;
      this.cache.delete(key);
      this.scene.textures.remove(key);
    }
  }
}
