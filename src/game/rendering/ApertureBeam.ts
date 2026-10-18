import Phaser from 'phaser';
import { APERTURE_BEAM, MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import { FINALE_BEAM } from '../../data/finale';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
import type { GameSession } from '../../simulation';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { BEAM_MAX_PX } from '../math/finale';
import type { FinaleFrame } from '../math/finale';

// Era V aperture beam: a world-space shaft of light from the aperture part's mouth up to the top of the world.
// One tileSprite on the fx.beam sheet, tiled PIXEL_SCALE times so one tile is 32 world px wide, bottom at the
// aperture foot and top at world y 0. The sheet frame cycles at APERTURE_BEAM.fps. No fallback path was needed:
// the tileSprite takes a sheet frame directly (TileSprite.setFrame).
// Visible once the aperture's latch tech is owned and the latch has passed APERTURE_BEAM.minLatchFrame; the latch
// tech and level come from the aperture component's latch data, not from a literal. A reset hides it.
// WP13 finale: a white tile (fx.beamWhite) grows up from the same mouth to FINALE_BEAM head height; the violet tile is
// hidden while the finale says !violet. With no applyFinale call the white tile stays hidden and the violet logic is unchanged.
export class ApertureBeam {
  private readonly session: GameSession;
  private readonly latchFrameOf: () => number | null;
  private readonly latch: { techId: TechId; minLevel: number } | null;
  private readonly frameCount: number;
  private readonly tile: Phaser.GameObjects.TileSprite;
  private readonly white: Phaser.GameObjects.TileSprite;
  private readonly whiteFrameCount: number;
  private readonly unsubscribe: () => void;
  private clockMs = 0; // ms of frame time since construction
  private shown = false;
  private shownFrame = -1;
  private finale: FinaleFrame['beam'] | null = null; // null = no finale call yet
  private whiteHeightPx = -1;
  private whiteFrame = -1;

  constructor(scene: Phaser.Scene, session: GameSession, latchFrameOf: () => number | null) {
    this.session = session;
    this.latchFrameOf = latchFrameOf;
    const animation = MACHINE_COMPONENTS[APERTURE_BEAM.component].animation;
    this.latch = animation.kind === 'latch' ? { techId: animation.techId, minLevel: animation.minLevel } : null;
    const art = ASSET_MANIFEST[APERTURE_BEAM.assetId];
    this.frameCount = art.frame?.count ?? 1;
    const tileWidthWorld = PIXEL_SCALE * (art.frame?.width ?? art.width);
    const bottomY = MACHINE_ANCHOR.y + PIXEL_SCALE * APERTURE_BEAM.footArtY;
    const centreX = MACHINE_ANCHOR.x + PIXEL_SCALE * APERTURE_BEAM.artX;
    this.tile = scene.add
      .tileSprite(centreX, bottomY, tileWidthWorld, bottomY, APERTURE_BEAM.assetId, 0)
      .setOrigin(0.5, 1)
      .setTileScale(PIXEL_SCALE, PIXEL_SCALE)
      .setDepth(APERTURE_BEAM.depth)
      .setAlpha(APERTURE_BEAM.alpha)
      .setVisible(false);
    const whiteArt = ASSET_MANIFEST[FINALE_BEAM.assetId];
    this.whiteFrameCount = whiteArt.frame?.count ?? 1;
    this.white = scene.add
      .tileSprite(centreX, bottomY, PIXEL_SCALE * (whiteArt.frame?.width ?? whiteArt.width), bottomY, FINALE_BEAM.assetId, 0)
      .setOrigin(0.5, 1)
      .setTileScale(PIXEL_SCALE, PIXEL_SCALE)
      .setDepth(APERTURE_BEAM.depth)
      .setAlpha(FINALE_BEAM.alpha)
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setVisible(false);
    this.unsubscribe = session.on('reset', () => this.hide());
  }

  // Finale state of the beam: white head height and animation, violet on/off. Applied at once.
  applyFinale(b: FinaleFrame['beam']): void {
    this.finale = b;
    if (!b.violet) this.hide();
    this.refreshWhite();
  }

  // Shows the beam while the latch gate holds, cycling its frames; hides it otherwise.
  update(deltaMs: number): void {
    this.clockMs += deltaMs;
    this.refreshWhite();
    const latchFrame = this.latchFrameOf();
    const open = this.latch !== null
      && this.session.state.techLevels[this.latch.techId] >= this.latch.minLevel
      && latchFrame !== null
      && latchFrame >= APERTURE_BEAM.minLatchFrame
      && (this.finale === null || this.finale.violet);
    if (!open) {
      this.hide();
      return;
    }
    if (!this.shown) {
      this.shown = true;
      this.tile.setVisible(true);
    }
    const frame = Math.floor((this.clockMs * APERTURE_BEAM.fps) / 1000) % this.frameCount;
    if (frame !== this.shownFrame) {
      this.shownFrame = frame;
      this.tile.setFrame(frame);
    }
  }

  destroy(): void {
    this.unsubscribe();
    if (this.tile.scene) this.tile.destroy(); // Phaser clears scene on destroy
    if (this.white.scene) this.white.destroy();
  }

  private hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.tile.setVisible(false);
  }

  // White head: height min(BEAM_MAX_PX, whiteHeadPx) from the mouth; hidden at 0. Frames cycle only when animate.
  private refreshWhite(): void {
    const b = this.finale;
    const height = b === null ? 0 : Math.min(BEAM_MAX_PX, b.whiteHeadPx);
    if (!(height > 0)) {
      if (this.white.visible) this.white.setVisible(false);
      return;
    }
    if (!this.white.visible) this.white.setVisible(true);
    if (height !== this.whiteHeightPx) {
      this.whiteHeightPx = height;
      this.white.setSize(this.white.width, height).setOrigin(0.5, 1);
    }
    const frame = b !== null && b.animate
      ? Math.floor((this.clockMs * APERTURE_BEAM.fps) / 1000) % this.whiteFrameCount
      : 0;
    if (frame !== this.whiteFrame) {
      this.whiteFrame = frame;
      this.white.setFrame(frame);
    }
  }
}
