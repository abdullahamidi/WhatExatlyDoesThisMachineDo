import Phaser from 'phaser';
import type { AssetId } from '../../assets/assetIds';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { FINALE_BIRDS, FINALE_SEEDS } from '../../data/finale';
import type { FinaleBeat } from '../../data/finale';
import { WORLD_SHEET_KEYS } from '../../data/livingWorld';
import { MACHINE_MOTION } from '../../data/machineComponents';
import type { Vec2 } from '../../data/machineComponents';
import { CAMERA, DEPTH, DUST, MACHINE_ANCHOR, PIXEL_SCALE, VIEW, WORLD } from '../../data/world';
import { effectiveMinZoom } from '../math/camera';
import { birdPose, flockSchedule } from '../math/finale';
import type { FinaleFrame } from '../math/finale';
import { sheetFrameIndex } from '../math/worldPlayback';
import type { CrowLead } from '../math/worldScript';

const MOTE_TEXTURE: AssetId = 'fx.dust';
// The crow lead (WP23b) draws the crow sheet with the sheet's own texture and origin, so it reads like the world crow.
const CROW_TEXTURE = WORLD_SHEET_KEYS.crow;
const CROW_ORIGIN = ASSET_MANIFEST[WORLD_SHEET_KEYS.crow as AssetId].origin;
// Screen layer: birds and the white / cut rect sit above every world object (DEPTH.floatingText is the top world layer); DOM is above the canvas.
const BIRD_DEPTH = DEPTH.floatingText + 1;
const SCREEN_DEPTH = DEPTH.floatingText + 2;

/** A flock on its clock: it started at startS on that clock and `clock` is the current reading. */
interface Flock {
  startS: number;
  size: number;
  clock: number;
}

/** Frame step in seconds: non-finite or negative input is zero, the step is capped like the machine motion. */
function frameSeconds(deltaMs: number): number {
  const raw = Number.isFinite(deltaMs) ? deltaMs / 1000 : 0;
  return Math.min(MACHINE_MOTION.maxFrameSeconds, Math.max(0, raw));
}

function seedFrames(): number[] {
  return Array.from({ length: FINALE_SEEDS.frames }, (_, i) => i);
}

// Finale effects that are not part of the world rows: the screen-fixed white / cut rect (FinaleFrame.overlay), the
// restored-world seed motes, the bird flocks over the restored sky and the dust burst at the name plate.
// Birds: 'finale' spawns one flock at FINALE_BIRDS.firstAtS on the finale clock (frame.t); 'postgame' loops flocks on
// its own clock (frame delta), each gap from flockSchedule. Bird sprites are a fixed pool of FINALE_BIRDS.size max.
// The crow lead (setLead, WP23b) turns the first pooled bird into the whole crow frame while the world crow is out of view.
export class FinaleFx {
  private readonly scene: Phaser.Scene;
  private readonly onBeat: (beat: FinaleBeat) => void;
  private readonly screen: Phaser.GameObjects.Rectangle;
  private readonly seeds: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly plate: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly birds: Phaser.GameObjects.Image[] = [];
  /** The crow lead (WP23b), null = none. The first bird draws it while the flock is on screen. */
  private lead: CrowLead | null = null;
  /** True while the first bird shows the crow sheet (its texture and origin swap on that change only). */
  private leadOnFirst = false;
  private overlayColor = NaN;
  private overlayAlpha = NaN;
  private seedMode: FinaleFrame['seeds'] = 'off';
  private birdsMode: FinaleFrame['birds'] = 'off';
  private finaleFlock: { startS: number; size: number } | null = null;
  private postFlock: { startS: number; size: number } | null = null;
  private postClock = 0;
  private postNextS = 0;
  private postIndex = 0;
  private prevT: number | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene, onBeat: (beat: FinaleBeat) => void) {
    this.scene = scene;
    this.onBeat = onBeat;
    // Covers the widest visible rect at any zoom (same sizing as the parallax sky).
    const minZoom = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);
    this.screen = scene.add
      .rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width / minZoom, VIEW.height / minZoom, 0, 1)
      .setScrollFactor(0)
      .setDepth(SCREEN_DEPTH)
      .setVisible(false);
    this.seeds = scene.add
      .particles(0, 0, FINALE_SEEDS.assetId, {
        x: { min: MACHINE_ANCHOR.x - DUST.spawnHalfWidth, max: MACHINE_ANCHOR.x + DUST.spawnHalfWidth },
        y: { min: FINALE_SEEDS.spawnY[0], max: FINALE_SEEDS.spawnY[1] },
        frame: { frames: seedFrames(), cycle: false },
        lifespan: { min: FINALE_SEEDS.lifespanMs[0], max: FINALE_SEEDS.lifespanMs[1] },
        speedX: { min: FINALE_SEEDS.speedX[0], max: FINALE_SEEDS.speedX[1] },
        speedY: { min: FINALE_SEEDS.speedY[0], max: FINALE_SEEDS.speedY[1] },
        scale: PIXEL_SCALE,
        alpha: { start: FINALE_SEEDS.alpha[1], end: FINALE_SEEDS.alpha[0] },
        frequency: FINALE_SEEDS.frequencyMs,
        emitting: false,
      })
      .setDepth(FINALE_SEEDS.depth);
    // Plate burst: explode-only (no flow), the same mote look as the dust field.
    this.plate = scene.add
      .particles(0, 0, MOTE_TEXTURE, {
        lifespan: { min: DUST.lifespanMs[0], max: DUST.lifespanMs[1] },
        speedX: { min: DUST.speedX[0], max: DUST.speedX[1] },
        speedY: { min: DUST.speedY[0], max: DUST.speedY[1] },
        scale: { min: DUST.scale[0], max: DUST.scale[1] },
        alpha: { start: DUST.alpha[1], end: DUST.alpha[0] },
        emitting: false,
      })
      .setDepth(DUST.depth);
    for (let i = 0; i < FINALE_BIRDS.size[1]; i += 1) {
      this.birds.push(
        scene.add
          .image(0, 0, FINALE_BIRDS.assetId, 0)
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(BIRD_DEPTH)
          .setVisible(false),
      );
    }
    this.postNextS = flockSchedule(0, FINALE_BIRDS.seed).delayS;
  }

  /** Applies one finale frame. deltaMs is the frame step (drives the postgame flock clock only). */
  applyFinale(frame: FinaleFrame, deltaMs: number): void {
    if (this.destroyed) return;
    this.applyOverlay(frame.overlay);
    this.applySeeds(frame.seeds);
    this.applyBirds(frame, frameSeconds(deltaMs));
    this.prevT = frame.t;
  }

  /** Bursts `count` dust motes at a world point (the name plate, FINALE_PLATE.puffs). */
  plateDust(world: Vec2, count: number): void {
    if (this.destroyed || !Number.isFinite(count) || count < 1) return;
    this.plate.explode(Math.floor(count), world.x, world.y);
  }

  /** Sets the crow lead (WP23b, null = none): the first bird draws that crow frame while the flock is on screen. No new objects. */
  setLead(lead: CrowLead | null): void {
    if (this.destroyed) return;
    this.lead = lead;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.seeds.destroy();
    this.plate.destroy();
    this.screen.destroy();
    for (const bird of this.birds) bird.destroy();
    this.birds.length = 0;
  }

  private applyOverlay(overlay: FinaleFrame['overlay']): void {
    if (overlay.color !== this.overlayColor) {
      this.overlayColor = overlay.color;
      this.screen.setFillStyle(overlay.color);
    }
    if (overlay.alpha !== this.overlayAlpha) {
      this.overlayAlpha = overlay.alpha;
      this.screen.setAlpha(overlay.alpha).setVisible(overlay.alpha > 0);
    }
  }

  // Acts on mode changes only. 'postgame' uses the slower rate (FINALE_SEEDS.postgameRateDiv).
  private applySeeds(mode: FinaleFrame['seeds']): void {
    if (mode === this.seedMode) return;
    this.seedMode = mode;
    if (mode === 'off') {
      this.seeds.stop();
      return;
    }
    const frequency = mode === 'postgame' ? FINALE_SEEDS.frequencyMs * FINALE_SEEDS.postgameRateDiv : FINALE_SEEDS.frequencyMs;
    this.seeds.setFrequency(frequency);
    if (!this.seeds.emitting) this.seeds.start();
  }

  private applyBirds(frame: FinaleFrame, dtS: number): void {
    if (frame.birds !== this.birdsMode) {
      this.birdsMode = frame.birds;
      this.resetFlocks();
    }
    let flock: Flock | null = null;
    if (frame.birds === 'finale') flock = this.finaleFlockAt(frame.t);
    else if (frame.birds === 'postgame') flock = this.postgameFlockAt(dtS);
    this.drawBirds(flock);
  }

  // Forgets every flock and hides the birds (a mode change starts the next mode from scratch).
  private resetFlocks(): void {
    this.finaleFlock = null;
    this.postFlock = null;
    this.postClock = 0;
    this.postIndex = 0;
    this.postNextS = flockSchedule(0, FINALE_BIRDS.seed).delayS;
    for (const bird of this.birds) bird.setVisible(false);
  }

  // The one finale flock. Spawns when the clock reaches firstAtS. The beat fires only when that crossing happens during play
  // and the flock is still on screen (a load into the choice or a skip past the flock must not chirp).
  private finaleFlockAt(t: number): Flock | null {
    const first = FINALE_BIRDS.firstAtS;
    if (t < first) {
      this.finaleFlock = null;
      return null;
    }
    if (this.finaleFlock === null) {
      this.finaleFlock = { startS: first, size: flockSchedule(0, FINALE_BIRDS.seed).size };
      const onScreen = birdPose(t - first, 0) !== null;   // the lead bird is the leftmost one
      if (onScreen && this.prevT !== null && this.prevT < first) this.onBeat('flock');
    }
    return { ...this.finaleFlock, clock: t };
  }

  // Postgame loop: flock k starts at the sum of the gaps up to k (flockSchedule delays), size from flockSchedule(k).
  private postgameFlockAt(dtS: number): Flock | null {
    this.postClock += dtS;
    if (this.postClock >= this.postNextS) {
      this.postFlock = { startS: this.postNextS, size: flockSchedule(this.postIndex, FINALE_BIRDS.seed).size };
      this.postIndex += 1;
      this.postNextS += flockSchedule(this.postIndex, FINALE_BIRDS.seed).delayS;
      this.onBeat('flock');
    }
    return this.postFlock === null ? null : { ...this.postFlock, clock: this.postClock };
  }

  // Poses every pooled bird. birdPose gives screen px (left/top edge); the camera zoom is undone so the bird lands there
  // at PIXEL_SCALE screen size whatever the view (the sprite origin is top-left).
  private drawBirds(flock: Flock | null): void {
    const cam = this.scene.cameras.main;
    const zoom = cam.zoom > 0 ? cam.zoom : 1;
    const elapsed = flock === null ? 0 : flock.clock - flock.startS;
    this.birds.forEach((bird, i) => {
      const pose = flock !== null && i < flock.size ? birdPose(elapsed, i) : null;
      if (pose === null) {
        bird.setVisible(false);
        return;
      }
      this.paintFrame(bird, i === 0, pose.frame);
      bird
        .setPosition(VIEW.width / 2 + (pose.x - VIEW.width / 2) / zoom, VIEW.height / 2 + (pose.y - VIEW.height / 2) / zoom)
        .setScale(PIXEL_SCALE / zoom)
        .setVisible(true);
    });
  }

  // The bird's frame. The first bird shows the crow lead while one is set (the crow sheet, frame by name and row); texture and
  // origin swap only when that changes, so the pool keeps the same sprites and no bird is created.
  private paintFrame(bird: Phaser.GameObjects.Image, first: boolean, frame: 0 | 1): void {
    const lead = first ? this.lead : null;
    if (lead !== null) {
      if (!this.leadOnFirst) {
        this.leadOnFirst = true;
        bird.setTexture(CROW_TEXTURE).setOrigin(CROW_ORIGIN.x, CROW_ORIGIN.y);
      }
      bird.setFrame(sheetFrameIndex('crow', lead.frame, lead.row));
    } else if (first && this.leadOnFirst) {
      this.leadOnFirst = false;
      bird.setTexture(FINALE_BIRDS.assetId, frame).setOrigin(0, 0);
    } else {
      bird.setFrame(frame);
    }
  }
}
