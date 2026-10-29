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
import { OutputTicker } from '../rendering/OutputTicker';
import type { FaultMarker } from '../rendering/FaultMarker';
import type { WorldReach } from '../rendering/WorldReach';
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
import type { WorldFinalePort } from '../math/worldScript';
import type { OfflineReport, TechId } from '../../data/types';
import type { Edition } from '../../data/edition';
import type { EraCards } from '../../ui/eraCard';
import type { WorldVoiceView } from '../../ui/worldVoice';
import type { LivingWorldDirector, WorldDirectorPorts } from '../rendering/LivingWorldDirector';

/** Modal id held on the stack while the new-cycle transition runs (input lock). */
const CYCLE_MODAL_ID = 'cycle';

/** Frames kept for the uiStats probe (debug hook). */
const UI_STATS_FRAMES = 120;

/** WP23b: true when the living world director implements the finale port (applyFinale). A type guard, so no cast is needed. */
function isWorldFinalePort(d: unknown): d is WorldFinalePort {
  return typeof d === 'object' && d !== null && 'applyFinale' in d && typeof d.applyFinale === 'function';
}

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

/**
 * WP23a living world hooks. bootstrap creates the object and hands the SYS LOG and KEEP TINKERING calls through it; WorldScene
 * points the members at its director while it lives and resets them to no-ops on teardown.
 */
export interface WorldLink {
  onLogShown(id: string): void;
  onLogCleared(id: string): void;
  defer(): boolean;
  onKeep(): void;
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
  /** WP23a: the late-bound SYS LOG / KEEP hooks (see WorldLink). */
  worldLink: WorldLink;
  /** WP23a: the speech bubble DOM view, created at boot (page-lifetime). */
  worldView: WorldVoiceView;
  /** WP23a: the era card handle (its isShown() is a director port). */
  eraCards: EraCards;
  edition: Edition;
  /** WP23a: the boot offline report (startup.offline); the director reads it once at start. */
  bootOffline: OfflineReport | null;
  /** WP23a: true when the boot WELCOME BACK toast is queued (its gate starts with the director). */
  welcomeShown: boolean;
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
  /** WP23a living world director; null before `create`, until its lazy chunk resolves, after its teardown, or when #ui-root is missing. */
  private worldDirector: LivingWorldDirector | null = null;
  /** WP27 fault marker; null before `create`, until its lazy chunk resolves, after its teardown. */
  private faultMarker: FaultMarker | null = null;
  /** WP28 the machine's reach (Finds, and the poke layer later); null before `create`, until its lazy chunk resolves, after its teardown. */
  private worldReach: WorldReach | null = null;
  /** The gain-text pool of this scene (the crank and the fault popups share it); null before `create` and after its teardown. */
  private floatingText: FloatingText | null = null;
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
    const background = new ParallaxBackground(this, this.ctx.session.state.techLevels, { slowFadeIn: true });
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
    this.floatingText = floatingText;
    const crank = new HandCrank(this, this.ctx, machine, floatingText);
    const outputTicker = new OutputTicker(this, { session: this.ctx.session, machine: () => this.machineView, photoActive: () => this.photo?.isActive() === true, finaleOrPostgame: () => this.ctx.session.state.ending.phase !== 'none', reducedMotion: () => this.ctx.session.settings.reducedMotion });
    // WP27 machine faults: the marker over a faulted part, a lazy chunk (the app chunk is budgeted). bootstrap warms it; it is built
    // here once it resolves, long before the first fault (era I waits at least 180 eligible seconds). Its overlay checks mirror the living
    // world's ports (the same overlays hide it). Set by the disposable below: a chunk that resolves after teardown builds nothing.
    const worldRoot = document.getElementById('ui-root');
    let faultTornDown = false;
    import('../rendering/FaultMarker')
      .then(({ FaultMarker: Marker }) => {
        if (faultTornDown) return;
        this.faultMarker = new Marker(this, {
          session: this.ctx.session,
          machine: () => this.machineView,
          floatingText,
          ui: this.ui,
          photo: () => this.photo,
          cycle: () => this.cycleTransition,
          clearCommand: this.ctx.commands.clearFault,
        });
      })
      .catch((err: unknown) => console.error('[faults] marker failed to load', err));
    // WP28 the machine's reach (the Find marker now, the poke layer next): a lazy chunk like the fault marker, built with the same
    // torn-down guard. Its tooltip slab lives in #ui-root, so without the root there is no reach.
    let reachTornDown = false;
    if (worldRoot !== null) {
      import('../rendering/WorldReach')
        .then(({ WorldReach: Reach }) => {
          if (reachTornDown) return;
          this.worldReach = new Reach(this, {
            session: this.ctx.session,
            floatingText,
            director: () => this.worldDirector,
            ui: this.ui,
            photo: () => this.photo,
            cycle: () => this.cycleTransition,
            collectCommand: this.ctx.commands.collectFind,
            reducedMotion: () => this.ctx.session.settings.reducedMotion,
            tooltipRoot: worldRoot,
            feedback: this.ctx.feedback,
          });
        })
        .catch((err: unknown) => console.error('[finds] reach failed to load', err));
    }
    const camera = new CameraController(this, this.ctx.session);
    const unsubscribeRefocus = this.ctx.commands.refocus.on(() => camera.refocus());
    // WP23a living world: after SteamFx, before the finale. Its ports read scene and UI state lazily, so the photo mode and the
    // cycle transition (created below) may still be null here. Needs #ui-root for the bubble DOM; without it there is no director.
    // The director is a lazy chunk (the app chunk is budgeted): it is built a moment after create, and update() and the links
    // stay no-ops until then. bootstrap warms the chunk during the asset load, so the import is normally already resolved.
    const worldDisposables: Array<() => void> = [];
    if (worldRoot !== null) {
      const ports: WorldDirectorPorts = {
        techTreeOpen: () => this.ui.techTree.isOpen(),
        onTechTreeOpenChange: (fn) => this.ui.techTree.onOpenChange(fn),
        eraCardShown: () => this.ui.eraCards.isShown(),
        modalOpen: () => this.ui.modals.isOpen() && this.ui.modals.topId() !== PHOTO_MODE.modalId && !this.ui.techTree.isOpen(),
        photoActive: () => this.photo?.isActive() === true,
        cycleBusy: () => this.cycleTransition?.isActive() === true || this.ui.modals.has('cycleConfirm'),
        teaserOn: () => worldRoot.classList.contains('demo-teaser-on'),
        demoCardOpen: () => this.ui.modals.has('demo-end'),
        tabHidden: () => document.hidden,
        // WP23b: the cycle transition is running (LAST FRAME of the finale film reads it).
        cycleTransitionActive: () => this.cycleTransition?.isActive() === true,
      };
      // Set by the disposable below: a chunk that resolves after teardown builds nothing.
      let worldTornDown = false;
      // Detaches the director's SLEEP / WAKE listeners once they are attached; a no-op before that.
      let detachSleepWake: () => void = () => undefined;
      worldDisposables.push(() => {
        worldTornDown = true;
        detachSleepWake();
        // The links go quiet before the director dies, so a late SYS LOG poll or KEEP cannot reach a destroyed director.
        const link = this.ui.worldLink;
        link.onLogShown = () => undefined;
        link.onLogCleared = () => undefined;
        link.defer = () => false;
        link.onKeep = () => undefined;
        const director = this.worldDirector;
        this.worldDirector = null;
        director?.destroy();
      });
      import('../rendering/LivingWorldDirector')
        .then(({ LivingWorldDirector: Director }) => {
          if (worldTornDown) return;
          const director = new Director({
            scene: this,
            session: this.ctx.session,
            feedback: this.ctx.feedback,
            edition: this.ui.edition,
            root: worldRoot,
            view: this.ui.worldView,
            ports,
            bootOffline: this.ui.bootOffline,
            welcomeShown: this.ui.welcomeShown,
          });
          this.worldDirector = director;
          const link = this.ui.worldLink;
          link.onLogShown = (id) => director.onLogShown(id);
          link.onLogCleared = (id) => director.onLogCleared(id);
          link.defer = () => director.sysLogDefer();
          link.onKeep = () => director.onKeep();
          const onSleep = (): void => director.onSleep();
          const onWake = (): void => director.onWake();
          this.events.on(Phaser.Scenes.Events.SLEEP, onSleep);
          this.events.on(Phaser.Scenes.Events.WAKE, onWake);
          detachSleepWake = () => {
            this.events.off(Phaser.Scenes.Events.SLEEP, onSleep);
            this.events.off(Phaser.Scenes.Events.WAKE, onWake);
          };
          // A World put to sleep before the chunk arrived (the teaser) must reach the director asleep as well.
          if (this.scene.isSleeping()) director.onSleep();
        })
        .catch((err: unknown) => console.error('[world] living world failed to load', err));
    }

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
      // WP23b: the living world film port; null until the lazy director exists and implements applyFinale (T19).
      world: () => (isWorldFinalePort(this.worldDirector) ? this.worldDirector : null),
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
      () => {
        this.floatingText = null;
        floatingText.destroy();
      },
      () => outputTicker.destroy(),
      () => {
        faultTornDown = true;
        const marker = this.faultMarker;
        this.faultMarker = null;
        marker?.destroy();
      },
      () => {
        reachTornDown = true;
        const reach = this.worldReach;
        this.worldReach = null;
        reach?.destroy();
      },
      // WP23a: the living world goes before SteamFx and the dust (and so before the display source, which is disposed last).
      ...worldDisposables,
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

  /** The WP27 fault marker, or null before `create`, until its lazy chunk resolves, after its teardown. */
  getFaultMarker(): FaultMarker | null {
    return this.faultMarker;
  }

  /** The WP28 reach (the Find marker, the poke layer later), or null before `create`, until its lazy chunk resolves, after its teardown. */
  getWorldReach(): WorldReach | null {
    return this.worldReach;
  }

  /** The gain-text pool, or null before `create` and after its teardown. */
  getFloatingText(): FloatingText | null {
    return this.floatingText;
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

  /** The WP23a living-world director, or null before `create`, until its lazy chunk resolves, after its teardown, or when #ui-root is missing. */
  getWorldDirector(): LivingWorldDirector | null {
    return this.worldDirector;
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
    // WP23a: the living world (figures, props, bubble, scheduler) before the finale, which may override the frame.
    this.worldDirector?.update(delta);
    // WP24 C6: the scenery follows the day clock, the wind and the settle state. A settle lands the fades stepped above in this frame.
    const ambient = this.worldDirector?.ambient() ?? null;
    if (ambient !== null) {
      this.background?.setDayTint(ambient.tint, ambient.snap);
      this.dust?.setWind(ambient.wind, ambient.dustDrift);
    } else {
      // White (no tint): the sky eases back to neutral while the living world layer is hidden.
      this.background?.setDayTint(0xffffff, true);
    }
    if (this.worldDirector?.settling() === true) {
      this.background?.settleFades();
      for (const line of this.pylonLines) line.settleFade();
    }
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
    OutputTicker.of(this)?.update(delta);
    this.faultMarker?.update(delta);
    this.worldReach?.update(delta);
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
    // WP27 C8: the wind-up and Overdrive readout of the CLICK row (stored output, cap, Overdrive time left and factor).
    const crank = { stored: session.windup.stored, cap: session.windup.cap, overdriveLeft: session.faults.overdriveLeft, overdriveFactor: session.faults.overdriveFactor };
    const view = buildHudView(session.state, session.rates, session.prestige, session.techs, crank);
    // WP16b-3: a store-shot plate cap caps the plaque line too (cappedPlaqueLevels, src/game/math/plateCap.ts).
    this.ui.hud.render(this.plateCap === null ? view : { ...view, plaque: plaqueText(cappedPlaqueLevels(session.state.techLevels, this.plateCap)) });
  }
}
