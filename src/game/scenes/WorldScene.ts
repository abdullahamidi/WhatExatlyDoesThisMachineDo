import Phaser from 'phaser';
import type { GameContext } from '../context';
import type { Hud } from '../../ui/hud';
import type { TechTree } from '../../ui/techTree';
import type { ModalStack } from '../../ui/modalStack';
import type { FinaleOverlayHandle } from '../../ui/finale';
import { buildHudView } from '../../ui/hudView';
import { APERTURE_BEAM, DUST_RISING, PYLON_FEEDS } from '../../data/world';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { PylonLine } from '../rendering/PylonLine';
import { SteamFx } from '../rendering/SteamFx';
import { Terrain } from '../rendering/Terrain';
import { DustField } from '../rendering/DustField';
import { FloatingText } from '../rendering/FloatingText';
import { CameraController } from '../rendering/CameraController';
import { Eclipse } from '../rendering/Eclipse';
import { ApertureBeam } from '../rendering/ApertureBeam';
import { RestoredGround } from '../rendering/RestoredGround';
import { FinaleFx } from '../rendering/FinaleFx';
import { FinaleDirector } from '../rendering/FinaleDirector';
import { MachineView } from '../entities/MachineView';
import { HandCrank } from '../entities/HandCrank';

/** UI handles WorldScene needs: the HUD / dialogs, the finale overlay and the late-bound finale skip target. */
export interface WorldUi {
  hud: Hud;
  techTree: TechTree;
  modals: ModalStack;
  finaleOverlay: FinaleOverlayHandle;
  finaleLink: { skip: () => void };
}

// Builds the wasteland, machine and camera; reads session state each frame and pushes it to the HUD.
export class WorldScene extends Phaser.Scene {
  private readonly ctx: GameContext;
  private readonly ui: WorldUi;
  private readonly disposables: Array<() => void> = [];
  private lastRevision = -1;
  private machineView: MachineView | null = null;
  private background: ParallaxBackground | null = null;
  private pylonLines: PylonLine[] = [];
  private steamFx: SteamFx | null = null;
  private dust: DustField | null = null;
  private eclipse: Eclipse | null = null;
  private beam: ApertureBeam | null = null;
  private finale: FinaleDirector | null = null;

  constructor(ctx: GameContext, ui: WorldUi) {
    super('World');
    this.ctx = ctx;
    this.ui = ui;
  }

  create(): void {
    const background = new ParallaxBackground(this, this.ctx.session.state.techLevels);
    this.background = background;
    const pylonLines = PYLON_FEEDS.map(
      (feed) => new PylonLine(this, this.ctx.session.state.techLevels, feed, () => this.machineView?.isAssembling(feed.component) === true),
    );
    this.pylonLines = pylonLines;
    const terrain = new Terrain(this);
    const dust = new DustField(this);
    this.dust = dust;
    // A loaded save with the spire already standing shows its rising dust at once.
    dust.setRising(this.ctx.session.state.techLevels[DUST_RISING.techId] >= DUST_RISING.minLevel, true);
    const machine = new MachineView(this, this.ctx);
    this.machineView = machine;
    const eclipse = new Eclipse(this, this.ctx.session);
    this.eclipse = eclipse;
    const beam = new ApertureBeam(this, this.ctx.session, () => this.machineView?.latchFrame(APERTURE_BEAM.component) ?? null);
    this.beam = beam;
    const steamFx = new SteamFx(this, this.ctx.session, () => this.machineView);
    this.steamFx = steamFx;
    const floatingText = new FloatingText(this);
    const crank = new HandCrank(this, this.ctx, machine, floatingText);
    const camera = new CameraController(this, this.ctx.session);
    const unsubscribeRefocus = this.ctx.commands.refocus.on(() => camera.refocus());
    // Finale (WP13): the restored ground and the screen-fixed FX sit above the ruined world; the director
    // drives every finale renderer, so it is created last and disposed first.
    const restoredGround = new RestoredGround(this);
    const finaleFx = new FinaleFx(this, (beat) => this.ctx.feedback.finaleBeat.emit(beat));
    const finale = new FinaleDirector(this, {
      session: this.ctx.session,
      newCycle: this.ctx.newCycle,
      overlay: this.ui.finaleOverlay,
      background,
      restoredGround,
      terrain,
      eclipse,
      beam,
      dust,
      fx: finaleFx,
      steamFx,
      machine,
      camera,
      emitBeat: (beat) => this.ctx.feedback.finaleBeat.emit(beat),
    });
    this.finale = finale;
    this.ui.finaleLink.skip = () => finale.skip();

    // The finale director drives the renderers below, so it is disposed first; the crank uses the machine
    // and the floating text, so it goes before them.
    this.disposables.push(
      () => {
        this.finale = null;
        this.ui.finaleLink.skip = () => undefined;
        finale.destroy();
      },
      unsubscribeRefocus,
      () => camera.destroy(),
      () => crank.destroy(),
      () => floatingText.destroy(),
      () => {
        this.steamFx = null;
        steamFx.destroy();
      },
      () => {
        this.machineView = null;
        machine.destroy();
      },
      () => {
        this.dust = null;
        dust.destroy();
      },
      () => finaleFx.destroy(),
      () => restoredGround.destroy(),
      () => terrain.destroy(),
      () => {
        this.pylonLines = [];
      },
      ...pylonLines.map((line) => () => line.destroy()),
      () => {
        this.beam = null;
        beam.destroy();
      },
      () => {
        this.eclipse = null;
        eclipse.destroy();
      },
      () => {
        this.background = null;
        background.destroy();
      },
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // One failing disposable must not skip the rest (e.g. the session 'reset' unsubscribe).
      for (const dispose of this.disposables) {
        try {
          dispose();
        } catch (err) {
          console.error('[world] disposable failed during shutdown', err);
        }
      }
      this.disposables.length = 0;
    });

    this.renderHud();
  }

  /** The machine view, or null before `create` and after its teardown. */
  getMachine(): MachineView | null {
    return this.machineView;
  }

  /** The finale director, or null before `create` and after its teardown. */
  getFinale(): FinaleDirector | null {
    return this.finale;
  }

  // Required here: Phaser's Scene typings declare update(time, delta), unlike create/preload/init.
  override update(_time: number, delta: number): void {
    this.ctx.session.update();
    this.background?.update(this.ctx.session.state.techLevels, delta);
    for (const line of this.pylonLines) line.update(this.cameras.main, this.ctx.session.state.techLevels, delta);
    this.machineView?.update(delta);
    this.eclipse?.update(delta);
    this.beam?.update(delta);
    this.steamFx?.update(delta);
    // Cheap flag compare each frame: the streams only switch when the spire's level crosses its gate (or a reset).
    this.dust?.setRising(this.ctx.session.state.techLevels[DUST_RISING.techId] >= DUST_RISING.minLevel);
    // Finale last: it overrides what the renderers above just drew (phase 'none' only pushes the neutral frame once).
    this.finale?.update(delta);
    if (this.ctx.session.revision !== this.lastRevision) this.renderHud();
    this.ui.techTree.update();
    // Phaser also handles window-level mouse events, so a DOM overlay alone does not shield the canvas.
    // Gate on any modal dialog open (tech tree, system menu, reset confirm), not just the tech tree.
    this.input.enabled = !this.ui.modals.isOpen();
  }

  private renderHud(): void {
    const session = this.ctx.session;
    this.lastRevision = session.revision;
    this.ui.hud.render(buildHudView(session.state, session.rates));
  }
}
