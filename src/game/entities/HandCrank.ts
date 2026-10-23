import Phaser from 'phaser';
import { CRANK_FEEDBACK, CRANK_PULSE, DEPTH, FLOATING_TEXT, PIXEL_SCALE } from '../../data/world';
import { emptyResourceMap } from '../../simulation';
import { motionPolicy } from '../../simulation/settings';
import type { ResourceMap } from '../../data/types';
import { clickGainLines } from '../../ui/hudView';
import { gainFontPx, mergeGains } from '../math/gainBlock';
import type { GainBlock } from '../math/gainBlock';
import type { GameContext } from '../context';
import type { MachineView } from './MachineView';
import type { FloatingText } from '../rendering/FloatingText';
import { ONBOARDING } from '../../data/ux';
import { CrankSparks } from '../rendering/CrankSparks';

/**
 * Clickable hand crank: a world-space circular zone over the crank. Each click credits ME, shows the stacked gain text, throws sparks and shakes the machine.
 * The turn itself comes from MachineAnimator's click subscription.
 * Until the first click a pulsing ring and a blinking world-space prompt (WP20) mark the crank; they are torn down on that click
 * and recreated after a reset while totalClicks is 0.
 */
export class HandCrank {
  private readonly scene: Phaser.Scene;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly ctx: GameContext;
  private readonly machine: MachineView;
  private readonly floatingText: FloatingText;
  private readonly onPointerDown: () => void;
  private readonly unsubscribeClick: () => void;
  private readonly unsubscribeCrank: () => void;
  private readonly unsubscribeReset: () => void;
  private readonly sparks: CrankSparks;
  /** Resources gained by the latest click, from the session 'click' event. */
  private lastGain: ResourceMap = emptyResourceMap();
  /** The gain block of the latest click: rapid clicks merge into it (WP17 T8). */
  private block: GainBlock | null = null;
  private pulseRing: Phaser.GameObjects.Arc | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private pulseOutline: Phaser.GameObjects.Arc | null = null;
  private promptText: Phaser.GameObjects.Text | null = null;
  private promptBlink: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, ctx: GameContext, machine: MachineView, floatingText: FloatingText) {
    this.scene = scene;
    this.ctx = ctx;
    this.machine = machine;
    this.floatingText = floatingText;

    this.unsubscribeClick = ctx.session.on('click', (e) => {
      this.lastGain = e.gainedAll;
    });

    const pos = machine.getComponentWorldPosition('handCrank');
    const r = CRANK_FEEDBACK.hitRadius * PIXEL_SCALE;
    this.zone = scene.add.zone(pos.x, pos.y, 2 * r, 2 * r).setDepth(DEPTH.machine + 1);
    // Zone hit areas are in local top-left coordinates, hence the centre (r, r).
    this.zone.setInteractive({
      hitArea: new Phaser.Geom.Circle(r, r, r),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });

    if (ctx.session.state.totalClicks === 0) {
      this.startPulse(scene, pos.x, pos.y);
    }

    this.onPointerDown = (): void => {
      this.crank();
    };
    this.zone.on('pointerdown', this.onPointerDown);
    // Keyboard crank (HOTKEYS via bootstrap): same effect as a pointer click.
    this.unsubscribeCrank = ctx.commands.crank.on(() => this.crank());
    this.sparks = new CrankSparks(scene, () => motionPolicy(ctx.session.settings).flashes);
    // WP20: a hard reset (new game or new cycle) brings the first-run ring and prompt back while no crank turn has happened.
    this.unsubscribeReset = ctx.session.on('reset', () => {
      if (ctx.session.state.totalClicks === 0 && this.pulseRing === null) {
        const p = this.machine.getComponentWorldPosition('handCrank');
        this.startPulse(this.scene, p.x, p.y);
      }
    });
  }

  destroy(): void {
    this.stopPulse();
    this.unsubscribeClick();
    this.unsubscribeCrank();
    this.unsubscribeReset();
    this.sparks.destroy();
    // Phaser may already have destroyed the zone (scene teardown); its scene is then unset.
    if (this.zone.scene) {
      this.zone.off('pointerdown', this.onPointerDown);
      this.zone.destroy();
    }
  }

  /** One crank turn: the pointer path and the keyboard command both come here. */
  private crank(): void {
    this.ctx.session.click(); // the only state mutation
    const { block, merged } = mergeGains(this.block, this.lastGain, this.scene.time.now, FLOATING_TEXT.coalesceMs, FLOATING_TEXT.blockMaxMs);
    this.block = block;
    const fontPx = gainFontPx(this.scene.cameras.main.zoom, FLOATING_TEXT.fontSizePx, FLOATING_TEXT.minScreenPx);
    const crankPos = this.machine.getComponentWorldPosition('handCrank');
    // A fresh block gets a small random x jitter; a merged block stays on its spot.
    const jitterX = merged ? 0 : (Math.random() - 0.5) * 2 * FLOATING_TEXT.jitterX; // jitter in [-jitterX, +jitterX]
    // A17: the block floats in clear sky right of the crank: over the frame's right half (eras I-III), right of the spire once it stands.
    const offset = this.machine.getComponentState(FLOATING_TEXT.spireComponent).visible ? FLOATING_TEXT.spawnOffsetSpire : FLOATING_TEXT.spawnOffset;
    this.floatingText.showBlock(
      { x: crankPos.x + offset.x + jitterX, y: crankPos.y + offset.y },
      clickGainLines(block.gains),
      fontPx,
      merged,
    );
    this.machine.shake(); // no-op under reduced motion (MachineView owns the policy check)
    this.sparks.burst(crankPos.x, crankPos.y); // WP20: manual clicks only; the emitter itself checks reduced motion
    this.stopPulse();
  }

  private startPulse(scene: Phaser.Scene, x: number, y: number): void {
    // Ink outline (WP20 D8): 1 art px per side around the amber ring, so the ring reads on any backdrop. Created first, so the ring draws on top.
    const outline = scene.add
      .circle(x, y, CRANK_PULSE.radiusArtPx * PIXEL_SCALE)
      .setStrokeStyle((CRANK_PULSE.strokeArtPx + 2 * CRANK_PULSE.outlineArtPx) * PIXEL_SCALE, CRANK_PULSE.outlineColor)
      .setDepth(DEPTH.machine + 1)
      .setAlpha(0);
    this.pulseOutline = outline;
    const ring = scene.add
      .circle(x, y, CRANK_PULSE.radiusArtPx * PIXEL_SCALE)
      .setStrokeStyle(CRANK_PULSE.strokeArtPx * PIXEL_SCALE, CRANK_PULSE.color)
      .setDepth(DEPTH.machine + 1)
      .setAlpha(0);
    this.pulseRing = ring;
    this.pulseTween = scene.tweens.add({
      targets: [outline, ring],
      alpha: CRANK_PULSE.alphaPeak,
      duration: CRANK_PULSE.periodMs / 2,
      yoyo: true,
      repeat: -1,
      // Reduced motion (flashes off): ring and outline are held static at peak alpha. Checked live on every tween step.
      onUpdate: () => {
        if (!motionPolicy(this.ctx.session.settings).flashes) {
          outline.setAlpha(CRANK_PULSE.alphaPeak);
          ring.setAlpha(CRANK_PULSE.alphaPeak);
        }
      },
    });

    // First-run prompt above the crank hub (WP20 D8). Display only: it never touches session state.
    const text = scene.add
      .text(x + ONBOARDING.promptOffset.x, y + ONBOARDING.promptOffset.y, ONBOARDING.crankPrompt + ONBOARDING.cursor, {
        fontFamily: 'monospace',
        fontSize: ONBOARDING.fontPx + 'px',
        color: ONBOARDING.color,
        stroke: ONBOARDING.strokeColor,
        strokeThickness: ONBOARDING.strokePx,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.floatingText)
      .setName('crank-prompt');
    this.promptText = text;
    // The cursor blinks; a space in its place keeps the monospace width so the line does not shift.
    // Reduced motion: the cursor holds ON. Checked live on every tick.
    let cursorOn = true;
    this.promptBlink = scene.time.addEvent({
      delay: ONBOARDING.blinkMs,
      loop: true,
      callback: () => {
        cursorOn = !motionPolicy(this.ctx.session.settings).flashes || !cursorOn;
        text.setText(ONBOARDING.crankPrompt + (cursorOn ? ONBOARDING.cursor : ' '));
      },
    });
  }

  private stopPulse(): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    if (this.pulseRing) {
      // Scene teardown may already have destroyed the ring; its scene is then unset.
      if (this.pulseRing.scene) this.pulseRing.destroy();
      this.pulseRing = null;
    }
    if (this.pulseOutline) {
      if (this.pulseOutline.scene) this.pulseOutline.destroy();
      this.pulseOutline = null;
    }
    if (this.promptBlink) {
      this.promptBlink.remove(false);
      this.promptBlink = null;
    }
    if (this.promptText) {
      if (this.promptText.scene) this.promptText.destroy();
      this.promptText = null;
    }
  }
}
