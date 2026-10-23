import Phaser from 'phaser';
import { APERTURE_BEAM, CAMERA, PYLON_FEEDS, VIEW, WORLD } from '../../data/world';
import { FINALE_CLOCK } from '../../data/finale';
import { PALETTE_CSS } from '../../data/palette';
import { SHOWCASE_SCENE_KEY, SHOWCASE_TEASER } from '../../data/showcase';
import { TECHNOLOGIES } from '../../data/technologies';
import type { MachineComponentId } from '../../data/machineComponents';
import type { SettingsState, TechId } from '../../data/types';
import { motionPolicy } from '../../simulation/settings';
import { createSignal } from '../../utils/signal';
import { clampCenter, clampZoom, effectiveMinZoom } from '../math/camera';
import type { CameraPose } from '../math/finale';
import { capPlateLevels } from '../math/plateCap';
import { apertureGate } from '../math/showcase';
import { teaserFrame, teaserRates } from '../math/teaser';
import type { TeaserEra, TeaserFrame } from '../math/teaser';
import { createStandInSource } from '../sources';
import type { StandInSource } from '../sources';
import { MachineView } from '../entities/MachineView';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { PylonLine } from '../rendering/PylonLine';
import { Terrain } from '../rendering/Terrain';
import { Eclipse } from '../rendering/Eclipse';
import { ApertureBeam } from '../rendering/ApertureBeam';
import { SteamFx } from '../rendering/SteamFx';

// WP18 showcase teaser: a scripted scene that completes the era II machine to era V, flies the camera to the portrait,
// ramps the boost and opens the aperture. It has its own camera and a StandInSource, so the real session is never read
// or written. The World is slept while it plays. Timing comes from teaser.ts (data/showcase.ts), not from here.

/** WorldScene's key (WorldScene.ts); the World is slept while the teaser runs. */
const WORLD_SCENE_KEY = 'World';

/** Lowest zoom the teaser camera may use (the same floor CameraController uses). */
const MIN_ZOOM = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);

export interface ShowcasePlayOptions {
  settings: Readonly<SettingsState>;
  /** Reduced motion for the teaser (portrait from t 0, no flashes). Default: read from the settings. */
  reduced?: boolean;
  /** Sleep the World while the teaser plays (default true). */
  sleepWorld?: boolean;
  /** Called once when the teaser reaches its end. Not called by stop or seek. */
  onDone?: () => void;
  /** Caps the stand-in nameplate at this plaque milestone (gates after it read as unmet). The demo passes its cap tech so the teaser plate never spells the answer. */
  plateMaxTech?: TechId;
}

export interface ShowcaseState {
  active: boolean;
  t: number;
  era: TeaserEra;
  apertureOpen: boolean;
  boost: number;
  done: boolean;
  visible: number;
  total: number;
  hidden: MachineComponentId[];
  camera: CameraPose;
  /** namePlate sprite frame (plaque milestone); null when the teaser is inactive. */
  plateFrame: number | null;
}

export class ShowcaseScene extends Phaser.Scene {
  /** True while this scene put the World to sleep (stop wakes it again). */
  private static worldSlept = false;
  private running = false;
  private reduced = false;
  private t = 0;
  private frame: TeaserFrame | null = null;
  private doneFired = false;
  private onDone?: () => void;
  private plateMaxTech: TechId | null = null;
  private source: StandInSource | null = null;
  // Last frame applied to the stand-in: applyLevels compares against these to find era steps and the aperture opening.
  private lastLevels: TeaserFrame['levels'] | null = null;
  private lastEra: TeaserEra | null = null;
  private lastOpen = false;
  private background: ParallaxBackground | null = null;
  private terrain: Terrain | null = null;
  private pylonLines: PylonLine[] = [];
  private machine: MachineView | null = null;
  private eclipse: Eclipse | null = null;
  private beam: ApertureBeam | null = null;
  private steamFx: SteamFx | null = null;
  /** Teardown steps in creation order; SHUTDOWN runs them in reverse. */
  private readonly disposers: Array<() => void> = [];

  constructor() {
    super(SHOWCASE_SCENE_KEY);
  }

  /** The scene, registered on first use. Idempotent: a registered scene is returned as is. */
  static ensure(game: Phaser.Game): ShowcaseScene {
    const registered = game.scene.keys[SHOWCASE_SCENE_KEY];
    if (registered instanceof ShowcaseScene) return registered;
    const scene = new ShowcaseScene();
    game.scene.add(SHOWCASE_SCENE_KEY, scene, false);
    return scene;
  }

  /** Starts the teaser from t 0. A running teaser is restarted; the World sleeps unless sleepWorld is false. */
  static play(game: Phaser.Game, opts: ShowcasePlayOptions): void {
    ShowcaseScene.ensure(game);
    if (game.scene.isActive(SHOWCASE_SCENE_KEY)) game.scene.stop(SHOWCASE_SCENE_KEY);
    if (opts.sleepWorld !== false && game.scene.isActive(WORLD_SCENE_KEY) && !ShowcaseScene.worldSlept) {
      game.scene.sleep(WORLD_SCENE_KEY);
      ShowcaseScene.worldSlept = true;
    } else if (opts.sleepWorld === false && ShowcaseScene.worldSlept) {
      game.scene.wake(WORLD_SCENE_KEY);
      ShowcaseScene.worldSlept = false;
    }
    game.scene.run(SHOWCASE_SCENE_KEY, opts);
  }

  /** Stops the teaser (no onDone) and wakes the World if play put it to sleep. */
  static stop(game: Phaser.Game): void {
    if (game.scene.isActive(SHOWCASE_SCENE_KEY)) game.scene.stop(SHOWCASE_SCENE_KEY);
    if (ShowcaseScene.worldSlept) {
      ShowcaseScene.worldSlept = false;
      game.scene.wake(WORLD_SCENE_KEY);
    }
  }

  // Phaser's Scene typings do not declare create, so no `override` here.
  create(data: ShowcasePlayOptions): void {
    this.reduced = data.reduced ?? !motionPolicy(data.settings).flashes;
    // Reduced motion also switches the renderers' own motion gates off (they read the stand-in's settings).
    const settings: Readonly<SettingsState> = this.reduced ? { ...data.settings, reducedMotion: true } : data.settings;
    this.running = true;
    this.t = 0;
    this.frame = null;
    this.doneFired = false;
    this.onDone = data.onDone;
    this.plateMaxTech = data.plateMaxTech ?? null;

    const f0 = teaserFrame(0, this.reduced);
    const source = createStandInSource({ levels: capPlateLevels(f0.levels, this.plateMaxTech), settings, perSecond: teaserRates(f0.era, false) });
    this.source = source;
    this.lastLevels = f0.levels;
    this.lastEra = f0.era;
    this.lastOpen = false;

    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD.width, WORLD.height);
    camera.setBackgroundColor(PALETTE_CSS.ink);
    this.applyCamera(f0.camera);

    const background = new ParallaxBackground(this, f0.levels);
    this.background = background;
    this.disposers.push(() => {
      this.background = null;
      background.destroy();
    });
    const terrain = new Terrain(this);
    this.terrain = terrain;
    this.disposers.push(() => {
      this.terrain = null;
      terrain.destroy();
    });
    const pylonLines = PYLON_FEEDS.map(
      (feed) => new PylonLine(this, f0.levels, feed, () => this.machine?.isAssembling(feed.component) === true),
    );
    this.pylonLines = pylonLines;
    this.disposers.push(() => {
      this.pylonLines = [];
    }, ...pylonLines.map((line) => () => line.destroy()));
    const machine = new MachineView(this, { session: source, feedback: { partLanded: createSignal<MachineComponentId>() } });
    this.machine = machine;
    this.disposers.push(() => {
      this.machine = null;
      machine.destroy();
    });
    const eclipse = new Eclipse(this, source);
    this.eclipse = eclipse;
    this.disposers.push(() => {
      this.eclipse = null;
      eclipse.destroy();
    });
    const beam = new ApertureBeam(this, source, () => this.machine?.latchFrame(APERTURE_BEAM.component) ?? null);
    this.beam = beam;
    this.disposers.push(() => {
      this.beam = null;
      beam.destroy();
    });
    const steamFx = new SteamFx(this, source, () => this.machine);
    this.steamFx = steamFx;
    this.disposers.push(() => {
      this.steamFx = null;
      steamFx.destroy();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  // Required here: Phaser's Scene typings declare update(time, delta), unlike create/preload/init.
  override update(_time: number, delta: number): void {
    const source = this.source;
    const machine = this.machine;
    if (!this.running || source === null || machine === null) return;
    const dt = Math.min(Math.max(Number.isFinite(delta) ? delta : 0, 0), FINALE_CLOCK.maxFrameMs);
    this.t += dt / 1000;
    const f = teaserFrame(this.t, this.reduced);
    this.frame = f;
    this.applyLevels(f, false);
    this.applyCamera(f.camera);
    this.background?.update(f.levels, dt);
    for (const line of this.pylonLines) line.update(this.cameras.main, f.levels, dt);
    machine.applyFinale({ boost: f.boost, restored: false });
    machine.update(dt);
    this.eclipse?.update(dt);
    this.beam?.update(dt);
    this.steamFx?.update(dt);
    if (f.done && !this.doneFired) {
      this.doneFired = true;
      this.onDone?.();
    }
  }

  /** Debug / smoke: jumps the teaser clock to t and renders at once. Does not fire onDone. */
  seek(t: number): void {
    if (!this.running) return;
    this.t = Number.isFinite(t) ? Math.max(0, t) : 0;
    const f = teaserFrame(this.t, this.reduced);
    this.applyLevels(f, true);
    this.applyCamera(f.camera);
    this.frame = f;
  }

  getState(): ShowcaseState {
    const machine = this.machine;
    if (!this.running || machine === null) {
      return {
        active: false,
        t: 0,
        era: SHOWCASE_TEASER.fromEra,
        apertureOpen: false,
        boost: 0,
        done: false,
        visible: 0,
        total: 0,
        hidden: [],
        camera: { centerX: 0, centerY: 0, zoom: CAMERA.defaultZoom },
        plateFrame: null,
      };
    }
    const f = this.frame ?? teaserFrame(this.t, this.reduced);
    const parts = machine.partsVisibility();
    const cam = this.cameras.main;
    return {
      active: true,
      t: f.t,
      era: f.era,
      apertureOpen: f.apertureOpen,
      boost: f.boost,
      done: f.done,
      visible: parts.visible,
      total: parts.total,
      hidden: parts.hidden,
      camera: { centerX: cam.midPoint.x, centerY: cam.midPoint.y, zoom: cam.zoom },
      plateFrame: machine.getComponentState('namePlate').frame,
    };
  }

  /**
   * Pushes a frame's levels and rates to the stand-in. Era steps and seeks re-diff the machine here. An aperture opening
   * goes out as a purchase event instead, so MachineView refreshes and Eclipse flashes the diamond as it does for a real purchase.
   */
  private applyLevels(f: TeaserFrame, instant: boolean): void {
    const source = this.source;
    if (source === null || f.levels === this.lastLevels) return;
    const eraChanged = f.era !== this.lastEra;
    const opened = f.apertureOpen && !this.lastOpen;
    source.setLevels(capPlateLevels(f.levels, this.plateMaxTech));
    source.setRates(teaserRates(f.era, f.apertureOpen));
    if (eraChanged || instant || !opened) this.machine?.refreshDisplay(!instant && !this.reduced);
    if (opened && !instant) {
      const gate = apertureGate();
      source.emit('purchase', { id: gate.techId, level: gate.minLevel, cost: 0, res: TECHNOLOGIES[gate.techId].costRes });
    }
    this.lastLevels = f.levels;
    this.lastEra = f.era;
    this.lastOpen = f.apertureOpen;
  }

  /** Sets this scene's main camera to a pose, clamped to the world and the zoom range like any view. */
  private applyCamera(pose: CameraPose): void {
    const zoom = clampZoom(pose.zoom, MIN_ZOOM, CAMERA.maxZoom);
    const centre = clampCenter({ x: pose.centerX, y: pose.centerY }, zoom, VIEW, WORLD);
    const camera = this.cameras.main;
    camera.setZoom(zoom);
    camera.centerOn(centre.x, centre.y);
  }

  /** On SHUTDOWN: stop the update, then destroy in reverse creation order. One failing destroy must not skip the rest. */
  private teardown(): void {
    this.running = false;
    this.source = null;
    const steps = this.disposers.splice(0).reverse();
    for (const dispose of steps) {
      try {
        dispose();
      } catch (err) {
        console.error('[showcase] disposable failed during shutdown', err);
      }
    }
  }
}
