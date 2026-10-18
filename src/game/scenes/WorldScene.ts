import Phaser from 'phaser';
import type { GameContext } from '../context';
import type { Hud } from '../../ui/hud';
import type { TechTree } from '../../ui/techTree';
import type { ModalStack } from '../../ui/modalStack';
import { buildHudView } from '../../ui/hudView';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { PylonLine } from '../rendering/PylonLine';
import { Terrain } from '../rendering/Terrain';
import { DustField } from '../rendering/DustField';
import { FloatingText } from '../rendering/FloatingText';
import { CameraController } from '../rendering/CameraController';
import { MachineView } from '../entities/MachineView';
import { HandCrank } from '../entities/HandCrank';

// Builds the wasteland, machine and camera; reads session state each frame and pushes it to the HUD.
export class WorldScene extends Phaser.Scene {
  private readonly ctx: GameContext;
  private readonly ui: { hud: Hud; techTree: TechTree; modals: ModalStack };
  private readonly disposables: Array<() => void> = [];
  private lastRevision = -1;
  private machineView: MachineView | null = null;
  private background: ParallaxBackground | null = null;
  private pylonLine: PylonLine | null = null;

  constructor(ctx: GameContext, ui: { hud: Hud; techTree: TechTree; modals: ModalStack }) {
    super('World');
    this.ctx = ctx;
    this.ui = ui;
  }

  create(): void {
    const background = new ParallaxBackground(this, this.ctx.session.state.techLevels);
    this.background = background;
    const pylonLine = new PylonLine(this, this.ctx.session.state.techLevels, () => this.machineView?.isAssembling('cableMast') === true);
    this.pylonLine = pylonLine;
    const terrain = new Terrain(this);
    const dust = new DustField(this);
    const machine = new MachineView(this, this.ctx);
    this.machineView = machine;
    const floatingText = new FloatingText(this);
    const crank = new HandCrank(this, this.ctx, machine, floatingText);
    const camera = new CameraController(this, this.ctx.session);
    const unsubscribeRefocus = this.ctx.commands.refocus.on(() => camera.refocus());

    // The crank uses the machine and the floating text, so it is disposed first.
    this.disposables.push(
      unsubscribeRefocus,
      () => camera.destroy(),
      () => crank.destroy(),
      () => floatingText.destroy(),
      () => {
        this.machineView = null;
        machine.destroy();
      },
      () => dust.destroy(),
      () => terrain.destroy(),
      () => {
        this.pylonLine = null;
        pylonLine.destroy();
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

  // Required here: Phaser's Scene typings declare update(time, delta), unlike create/preload/init.
  override update(_time: number, delta: number): void {
    this.ctx.session.update();
    this.background?.update(this.ctx.session.state.techLevels, delta);
    this.pylonLine?.update(this.cameras.main, this.ctx.session.state.techLevels, delta);
    this.machineView?.update(delta);
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
