import Phaser from 'phaser';
import type { GameContext } from '../context';
import type { Hud } from '../../ui/hud';
import type { TechTree } from '../../ui/techTree';
import type { ModalStack } from '../../ui/modalStack';
import type { FinaleOverlayHandle } from '../../ui/finale';
import { buildHudView, plaqueText } from '../../ui/hudView';
import { APERTURE_BEAM, DUST_RISING, HUD_REFRESH_MS, PYLON_FEEDS } from '../../data/world';
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
import { CycleTransition } from '../rendering/CycleTransition';
import { MachineView } from '../entities/MachineView';
import { HandCrank } from '../entities/HandCrank';
import { createDisplaySource } from '../sources';
import { createPhotoModeController } from '../photoModeController';
import type { PhotoModeController } from '../photoModeController';
import { createPhotoOverlay } from '../../ui/photoMode';
import { portraitPose } from '../math/showcase';
import { PHOTO_MODE } from '../../data/photoMode';
import { motionPolicy } from '../../simulation';
import { cappedPlaqueLevels, plateFrameCap } from '../math/plateCap';
import type { TechId } from '../../data/types';

/** Modal id held on the stack while the new-cycle transition runs (input lock). */
const CYCLE_MODAL_ID = 'cycle';

/** Frames kept for the uiStats probe (debug hook). */
const UI_STATS_FRAMES = 120;

/** Ring of the last UI_STATS_FRAMES frame timings (ms). Preallocated: recording a frame allocates nothing. */
class FrameTimings {
  private readonly samples = new Float64Array(UI_STATS_FRAMES);
  private count = 0;
  private next = 0;

  record(ms: number): void {
    this.samples[this.next] = ms;
    this.next = (this.next + 1) % UI_STATS_FRAMES;
    if (this.count < UI_STATS_FRAMES) this.count += 1;
  }

  stats(): { meanMs: number; maxMs: number } {
    if (this.count === 0) return { meanMs: 0, maxMs: 0 };
    let sum = 0;
    let max = 0;
    for (let i = 0; i < this.count; i += 1) {
      const ms = this.samples[i] ?? 0;
      sum += ms;
      if (ms > max) max = ms;
    }
    return { meanMs: sum / this.count, maxMs: max };
  }
}

/** UI handles WorldScene needs: the HUD / dialogs, the finale overlay, and the late-bound finale skip target and cycle port. */
export interface WorldUi {
  hud: Hud;
  techTree: TechTree;
  modals: ModalStack;
  finaleOverlay: FinaleOverlayHandle;
  finaleLink: { skip: () => void };
  /** New-cycle transition port: WorldScene points `play` at its CycleTransition; before that (or after teardown) it runs both callbacks at once. */
  cycleLink: { play(onPeak: () => void, onDone: () => void): void };
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
  private cycleTransition: CycleTransition | null = null;
  private photo: PhotoModeController | null = null;
  /** performance.now() of the last HUD rebuild (poll or event); the poll waits HUD_REFRESH_MS after it. */
  private hudRenderedAtMs = Number.NEGATIVE_INFINITY;
  private readonly frameTimings = new FrameTimings();
  private firstFrameMarked = false;
  /** WP16b-3 store shots (debug hook): plate gate the name plate and the HUD plaque are capped at; null = none. Rendering only. */
  private plateCap: TechId | null = null;

  constructor(ctx: GameContext, ui: WorldUi) {
    super('World');
    this.ctx = ctx;
    this.ui = ui;
  }

  create(): void {
    // First statement: its session 'reset' subscription must run before any consumer's (see createDisplaySource).
    const display = createDisplaySource(this.ctx.session);
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
    const machine = new MachineView(this, { session: display, feedback: this.ctx.feedback });
    this.machineView = machine;
    machine.setPlateCap(this.plateCap);
    const eclipse = new Eclipse(this, display);
    this.eclipse = eclipse;
    const beam = new ApertureBeam(this, display, () => this.machineView?.latchFrame(APERTURE_BEAM.component) ?? null);
    this.beam = beam;
    const steamFx = new SteamFx(this, display, () => this.machineView);
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
      display,
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
    // New-cycle transition (WP14): after the director, so the white sits above the finale FX. Created here, disposed first.
    const cycleTransition = new CycleTransition(this);
    this.cycleTransition = cycleTransition;
    this.ui.cycleLink.play = (onPeak, onDone) => this.playCycleTransition(onPeak, onDone);

    // Photo mode (WP18, VIEW MACHINE): needs #ui-root for its overlay. Without it there is no photo mode and getPhoto() is null.
    const photoDisposables: Array<() => void> = [];
    const uiRoot = document.getElementById('ui-root');
    if (uiRoot !== null) {
      // The overlay and the controller reference each other, so the controller is late-bound.
      let controller: PhotoModeController | null = null;
      const overlay = createPhotoOverlay(uiRoot, {
        onExit: () => controller?.exit(),
        onPan: (dx, dy) => controller?.pan(dx, dy),
        onZoom: (dir) => controller?.zoom(dir),
      });
      const photo = createPhotoModeController({
        phase: () => this.ctx.session.state.ending.phase,
        modals: this.ui.modals,
        camera,
        crank,
        overlay,
        portrait: portraitPose,
      });
      controller = photo;
      this.photo = photo;
      const offViewMachine = this.ui.hud.onViewMachine(() => {
        photo.enter();
      });
      photoDisposables.push(offViewMachine, () => {
        this.photo = null;
        photo.destroy();
      }, () => overlay.destroy());
    }

    // The finale director drives the renderers below, so it is disposed first; the crank uses the machine
    // and the floating text, so it goes before them. The cycle transition goes before the director: a running
    // transition fires its pending peak (the cycle swap, a 'reset' the director handles) while the director still exists.
    this.disposables.push(
      ...photoDisposables,
      () => {
        this.cycleTransition = null;
        cycleTransition.destroy();
      },
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
      // Last: the base 'reset' subscription goes after every consumer that reads the display levels.
      () => display.destroy(),
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

    // HUD refresh (WP15): the poll in update waits HUD_REFRESH_MS between rebuilds, so the events that change what the
    // player just did rebuild at once (same frame as the crank's +ME text). Unsubscribed on shutdown.
    const refreshHud = (): void => this.renderHud();
    const session = this.ctx.session;
    this.disposables.push(
      session.on('click', refreshHud),
      session.on('purchase', refreshHud),
      session.on('unlock', refreshHud),
      session.on('prestige', refreshHud),
      session.on('reset', refreshHud),
      session.on('cycle', refreshHud),
      session.on('ending', refreshHud),
      session.on('settings', refreshHud),
    );

    // WP20: part fly-ins wait while the TECH INDEX is open and play when it closes, with a camera nudge toward them.
    machine.setAssemblyHold(this.ui.techTree.isOpen());
    this.disposables.push(
      this.ui.techTree.onOpenChange((open) => {
        const released = machine.setAssemblyHold(open);
        if (released.length > 0) camera.nudgeToward(machine.centroidOf(released));
      }),
    );

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

  /** The new-cycle transition, or null before `create` and after its teardown. */
  getCycleTransition(): CycleTransition | null {
    return this.cycleTransition;
  }

  /** The photo-mode controller, or null before `create`, after its teardown, or when #ui-root is missing. */
  getPhoto(): PhotoModeController | null {
    return this.photo;
  }

  /**
   * WP16b-3 store shots: caps the World name plate frame and the HUD plaque line at a plate gate tech ('substationBlueprint' = RES?OR?,
   * the demo teaser cap). Null, or a tech that is not a plate gate, clears. Rendering only: session, save and display levels are untouched.
   * Returns the cap in force.
   */
  setPlateCap(maxTech: TechId | null): TechId | null {
    const cap = maxTech !== null && plateFrameCap(maxTech) !== null ? maxTech : null;
    this.plateCap = cap;
    this.machineView?.setPlateCap(cap);
    this.renderHud();
    return cap;
  }

  /** WP16b-3: the plate cap in force (null = none). */
  getPlateCap(): TechId | null {
    return this.plateCap;
  }

  /** Mean and max frame time (ms) of session update + HUD + tech tree over the last 120 frames (zeros before the first frame). */
  getUiStats(): { meanMs: number; maxMs: number } {
    return this.frameTimings.stats();
  }

  // Required here: Phaser's Scene typings declare update(time, delta), unlike create/preload/init.
  override update(_time: number, delta: number): void {
    if (!this.firstFrameMarked) {
      this.firstFrameMarked = true;
      performance.mark('wedtmd:first-frame');
    }
    const sessionStart = performance.now();
    this.ctx.session.update();
    const sessionEnd = performance.now();
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
    // The cycle transition runs after the director: its peak swaps the run (reset) before the HUD check below.
    this.cycleTransition?.update(delta);
    // Poll path: at most one rebuild per HUD_REFRESH_MS. Events in create() rebuild at once, so nothing the player
    // just did waits for the poll.
    const hudStart = performance.now();
    if (this.ctx.session.revision !== this.lastRevision && hudStart - this.hudRenderedAtMs >= HUD_REFRESH_MS) this.renderHud();
    this.ui.techTree.update();
    this.frameTimings.record((sessionEnd - sessionStart) + (performance.now() - hudStart));
    // Photo mode ends itself when another modal sits on top or the finale runs again.
    this.photo?.update();
    // Phaser also handles window-level mouse events, so a DOM overlay alone does not shield the canvas.
    // Gate on any modal dialog open (tech tree, system menu, reset confirm), not just the tech tree.
    // Photo mode keeps Phaser input on so drag and wheel pan / zoom still work.
    this.input.enabled = !this.ui.modals.isOpen() || this.ui.modals.topId() === PHOTO_MODE.modalId;
  }

  /**
   * Runs the white transition. A 'cycle' modal is held on the stack while it plays (input lock): Esc cannot drop it
   * (the close fn re-pushes it while the transition is still running). Reduced motion comes from settings, read here.
   */
  private playCycleTransition(onPeak: () => void, onDone: () => void): void {
    const transition = this.cycleTransition;
    if (transition === null) {
      onPeak();
      onDone();
      return;
    }
    const hold = (): void => {
      if (transition.isActive()) this.ui.modals.push(CYCLE_MODAL_ID, hold);
    };
    const reduced = !motionPolicy(this.ctx.session.settings).flashes;
    // play() first: it may finish a previous transition (that one removes the modal), so the lock is pushed after it.
    transition.play(reduced, onPeak, () => {
      this.ui.modals.remove(CYCLE_MODAL_ID);
      onDone();
    });
    if (transition.isActive()) this.ui.modals.push(CYCLE_MODAL_ID, hold);
  }

  private renderHud(): void {
    const session = this.ctx.session;
    this.lastRevision = session.revision;
    this.hudRenderedAtMs = performance.now();
    const view = buildHudView(session.state, session.rates, session.prestige, session.techs);
    // WP16b-3: a store-shot plate cap caps the plaque line too (cappedPlaqueLevels, src/game/math/plateCap.ts).
    this.ui.hud.render(this.plateCap === null ? view : { ...view, plaque: plaqueText(cappedPlaqueLevels(session.state.techLevels, this.plateCap)) });
  }
}
