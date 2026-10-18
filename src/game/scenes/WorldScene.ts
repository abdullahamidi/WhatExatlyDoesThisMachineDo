import Phaser from 'phaser';
import type { GameContext } from '../context';
import type { Hud } from '../../ui/hud';
import { buildHudView } from '../../ui/hudView';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { Terrain } from '../rendering/Terrain';
import { DustField } from '../rendering/DustField';
import { FloatingText } from '../rendering/FloatingText';
import { CameraController } from '../rendering/CameraController';
import { MachineView } from '../entities/MachineView';
import { HandCrank } from '../entities/HandCrank';

// Builds the wasteland, machine and camera; reads session state each frame and pushes it to the HUD.
export class WorldScene extends Phaser.Scene {
  private readonly ctx: GameContext;
  private readonly hud: Hud;
  private readonly disposables: Array<() => void> = [];
  private lastRevision = -1;

  constructor(ctx: GameContext, hud: Hud) {
    super('World');
    this.ctx = ctx;
    this.hud = hud;
  }

  create(): void {
    const background = new ParallaxBackground(this);
    const terrain = new Terrain(this);
    const dust = new DustField(this);
    const machine = new MachineView(this, this.ctx);
    const floatingText = new FloatingText(this);
    const crank = new HandCrank(this, this.ctx, machine, floatingText);
    const camera = new CameraController(this);
    const unsubscribeRefocus = this.ctx.commands.refocus.on(() => camera.refocus());

    // The crank uses the machine and the floating text, so it is disposed first.
    this.disposables.push(
      unsubscribeRefocus,
      () => camera.destroy(),
      () => crank.destroy(),
      () => floatingText.destroy(),
      () => machine.destroy(),
      () => dust.destroy(),
      () => terrain.destroy(),
      () => background.destroy(),
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

  // Required here: Phaser's Scene typings declare update(time, delta), unlike create/preload/init.
  override update(): void {
    this.ctx.session.update();
    if (this.ctx.session.revision !== this.lastRevision) this.renderHud();
  }

  private renderHud(): void {
    const session = this.ctx.session;
    this.lastRevision = session.revision;
    this.hud.render(buildHudView(session.state, session.rates));
  }
}
