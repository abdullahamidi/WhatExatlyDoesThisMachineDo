// Test-only hook. Installed only when debugEnabled(search, DEV) and not in a packaged desktop host.
import Phaser from 'phaser';
import type { GameSession } from '../simulation';
import type { TechTree } from '../ui/techTree';
import type { ModalStack } from '../ui/modalStack';
import type { SystemMenu } from '../ui/systemMenu';
import type { SaveController } from '../persistence/saveController';
import type { GameAudio } from '../audio/gameAudio';
import type { PrestigeState, TechId } from '../data/types';
import type { GameAudioStats } from '../audio/gameAudio';
import type { CyclePreview } from '../simulation/prestige';
import type { MachineComponentId } from '../data/machineComponents';
import { MACHINE_COMPONENTS } from '../data/machineComponents';
import { MACHINE_ANCHOR } from '../data/world';
import { SHOWCASE_SCENE_KEY } from '../data/showcase';
import { machineLocalToWorld, resolveAttachment } from './math/machineLayout';
import { isRestoredKey, restoredComponentIds } from './math/restoredTextures';
import { worldToClient } from './math/camera';
import type { WorldScene } from './scenes/WorldScene';
import { ShowcaseScene } from './scenes/ShowcaseScene';
import type { ShowcaseState } from './scenes/ShowcaseScene';
import type { FinaleState } from './rendering/FinaleDirector';
import type { FinaleFrame } from './math/finale';
import type { CycleTransitionState } from './rendering/CycleTransition';
import type { NewCycleController } from './newCycle';
import type { DemoEndDebugState } from '../ui/demoEndModel';

/** Live objects the hook reads from. Read-only views only; no mutation helpers. */
export interface DebugExtras {
  modals: ModalStack;
  systemMenu: SystemMenu;
  saveController: SaveController;
  audio: GameAudio;
  newCycle: NewCycleController;
  /** WP21: demo end state; null in the full build or before the demo module loads. */
  demo?: () => DemoEndDebugState | null;
}

/** Cycle state for smokes: controller busy flag + preview, and the transition clock (inactive without a scene). */
export interface CycleDebugState {
  busy: boolean;
  preview: CyclePreview;
  transition: CycleTransitionState;
}

declare global {
  interface Window {
    __wedtmd?: {
      session: GameSession;
      crankClientPoint(): { x: number; y: number };
      componentState(id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number; frame: number } | null;
      techTreeOpen(): boolean;
      crankPrompt(): boolean;
      saveNow(): boolean;
      systemMenuOpen(): boolean;
      modalCount(): number;
      audioUnlocked(): boolean;
      cameraState(): { zoom: number; centerX: number; centerY: number; relX: number; relY: number };
      machineStats(): { meanMs: number; maxMs: number; components: number };
      finaleState(): (FinaleState & { frame: FinaleFrame }) | null;
      skipFinale(): void;
      finaleSeek(t: number): void;
      displayObjects(): number;
      uiStats(): { meanMs: number; maxMs: number };
      perfMarks(): { bootStartMs: number; firstFrameMs: number } | null;
      audioStats(): GameAudioStats | null;
      prestige(): PrestigeState;
      cycleState(): CycleDebugState;
      // WP18: parts visibility probe, photo mode and the final-machine teaser (ShowcaseScene)
      partsVisible(): { visible: number; total: number; hidden: MachineComponentId[] } | null;
      photoMode(on: boolean, opts?: { hint?: boolean }): boolean;
      photoState(): { active: boolean; hint: boolean } | null;
      showcasePlay(opts?: { reduced?: boolean }): void;
      showcaseSeek(t: number): void;
      showcaseState(): ShowcaseState | null;
      showcaseStop(): void;
      // WP21: demo end state (phase, cap, card and teaser flags); null outside the demo build
      demoState(): DemoEndDebugState | null;
      // WP18b restored accent probes (World machine)
      restoredTextures(): { swapped: MachineComponentId[]; total: number } | null;
      textureKey(id: MachineComponentId): string | null;
      // WP16b-3: store-shot plate cap (World name plate + HUD plaque, rendering only)
      setPlateCap(maxTech: TechId | null): TechId | null;
      plateCap(): TechId | null;
    };
  }
}

export function installDebugHook(session: GameSession, game: Phaser.Game, techTree: TechTree, extras: DebugExtras): void {
  const crankClientPoint = (): { x: number; y: number } => {
    const world = machineLocalToWorld(resolveAttachment(MACHINE_COMPONENTS.handCrank));
    const cam = game.scene.getScene('World').cameras.main;
    const rect = game.canvas.getBoundingClientRect();
    return worldToClient(
      world,
      { x: cam.worldView.x, y: cam.worldView.y },
      cam.zoom,
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      { width: game.scale.gameSize.width, height: game.scale.gameSize.height },
    );
  };
  const componentState = (id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number; frame: number } | null => {
    const scene = game.scene.getScene<WorldScene>('World');
    return scene.getMachine()?.getComponentState(id) ?? null;
  };
  const techTreeOpen = (): boolean => techTree.isOpen();
  /** WP20: the world-space crank prompt text exists, is visible and active. */
  const crankPrompt = (): boolean => {
    const obj = game.scene.getScene('World').children.getByName('crank-prompt');
    return obj instanceof Phaser.GameObjects.Text && obj.visible && obj.active;
  };
  const saveNow = (): boolean => extras.saveController.saveNow();
  const systemMenuOpen = (): boolean => extras.systemMenu.isOpen();
  const modalCount = (): number => extras.modals.size();
  const audioUnlocked = (): boolean => extras.audio.unlocked;
  /** Camera centre is also reported relative to the machine anchor (rel = centre - MACHINE_ANCHOR). */
  const cameraState = (): { zoom: number; centerX: number; centerY: number; relX: number; relY: number } => {
    const cam = game.scene.getScene('World').cameras.main;
    const centerX = cam.midPoint.x;
    const centerY = cam.midPoint.y;
    return { zoom: cam.zoom, centerX, centerY, relX: centerX - MACHINE_ANCHOR.x, relY: centerY - MACHINE_ANCHOR.y };
  };
  /** Machine update timing (last 120 frames) for the perf probe; zeros while the machine is missing. */
  const machineStats = (): { meanMs: number; maxMs: number; components: number } => {
    const scene = game.scene.getScene<WorldScene>('World');
    return scene.getMachine()?.getUpdateStats() ?? { meanMs: 0, maxMs: 0, components: 0 };
  };
  /** Finale director state plus the last pushed frame; null before the world scene exists. */
  const finaleState = (): (FinaleState & { frame: FinaleFrame }) | null => {
    const director = game.scene.getScene<WorldScene>('World').getFinale();
    const frame = director?.getFrame() ?? null;
    if (director === null || frame === null) return null;
    return { ...director.getState(), frame };
  };
  const skipFinale = (): void => {
    game.scene.getScene<WorldScene>('World').getFinale()?.skip();
  };
  const finaleSeek = (t: number): void => {
    game.scene.getScene<WorldScene>('World').getFinale()?.seek(t);
  };
  /** Memory / prestige state (WP14): cycle, Echoes earned, owned perks. */
  const prestige = (): PrestigeState => session.prestige;
  /** New-cycle state (WP14): busy flag, what beginning now would give, and the transition clock. */
  const cycleState = (): CycleDebugState => ({
    busy: extras.newCycle.isBusy(),
    preview: extras.newCycle.preview(),
    transition: game.scene.getScene<WorldScene>('World').getCycleTransition()?.getState() ?? { active: false, tMs: 0, alpha: 0 },
  });
  /** Display list size of the world scene (perf probe). */
  const displayObjects = (): number => game.scene.getScene('World').children.list.length;
  /** Session update + HUD + tech tree time per frame (WP15), last 120 frames; zeros while the world scene is missing. */
  const uiStats = (): { meanMs: number; maxMs: number } =>
    game.scene.getScene<WorldScene>('World')?.getUiStats() ?? { meanMs: 0, maxMs: 0 };
  /** Performance marks (WP15): boot (first line of main.ts) and the first world-scene update; null when neither exists. */
  const perfMarks = (): { bootStartMs: number; firstFrameMs: number } | null => {
    const boot = performance.getEntriesByName('wedtmd:boot')[0];
    const firstFrame = performance.getEntriesByName('wedtmd:first-frame')[0];
    if (boot === undefined && firstFrame === undefined) return null;
    return { bootStartMs: boot?.startTime ?? 0, firstFrameMs: firstFrame?.startTime ?? 0 };
  };
  /** Music and mix readout (WP15): theme, slot gains, duck, live and music voices, master peak. Zeros before the first gesture. */
  const audioStats = (): GameAudioStats | null => extras.audio.stats();
  /** Visibility probe (WP18): hidden parts and counts, as the machine shows them now; null before the world scene exists. */
  const partsVisible = (): { visible: number; total: number; hidden: MachineComponentId[] } | null =>
    game.scene.getScene<WorldScene>('World')?.getMachine()?.partsVisibility() ?? null;
  /** Photo mode (WP18): forced entry from any phase, or exit. Returns whether photo mode is active afterwards; false without a controller. */
  const photoMode = (on: boolean, opts?: { hint?: boolean }): boolean => {
    const photo = game.scene.getScene<WorldScene>('World')?.getPhoto() ?? null;
    if (photo === null) return false;
    if (on) photo.enter({ force: true, hint: opts?.hint });
    else photo.exit();
    return photo.isActive();
  };
  /** Photo mode state (WP18): active flag and hint visibility; null without a controller. */
  const photoState = (): { active: boolean; hint: boolean } | null =>
    game.scene.getScene<WorldScene>('World')?.getPhoto()?.state() ?? null;
  /** The teaser scene once ShowcaseScene.ensure registered it; null before that. */
  const showcaseScene = (): ShowcaseScene | null => {
    const scene = game.scene.keys[SHOWCASE_SCENE_KEY];
    return scene instanceof ShowcaseScene ? scene : null;
  };
  /** Starts the final-machine teaser (WP18) with the live settings; reduced: portrait from t 0, no ramps. */
  const showcasePlay = (opts?: { reduced?: boolean }): void => {
    ShowcaseScene.play(game, { settings: session.settings, reduced: opts?.reduced, sleepWorld: true });
  };
  /** Jumps the running teaser clock to t (WP18 smoke); no-op when the teaser is not running. */
  const showcaseSeek = (t: number): void => {
    showcaseScene()?.seek(t);
  };
  /** Teaser state (WP18); null when the scene is missing or not playing. */
  const showcaseState = (): ShowcaseState | null => {
    const state = showcaseScene()?.getState() ?? null;
    return state?.active === true ? state : null;
  };
  /** Stops the teaser and wakes the World when play put it to sleep (WP18). */
  const showcaseStop = (): void => {
    ShowcaseScene.stop(game);
  };
  /** Restored texture probe (WP18b): ids of the parts of restoredComponentIds() whose sprite shows a `#restored` texture, and how many parts have a variant; null without a World machine. */
  const restoredTextures = (): { swapped: MachineComponentId[]; total: number } | null => {
    const machine = game.scene.getScene<WorldScene>('World')?.getMachine() ?? null;
    if (machine === null) return null;
    const ids = restoredComponentIds();
    const swapped = ids.filter((id) => {
      const key = machine.getComponentSprite(id)?.texture.key;
      return key !== undefined && isRestoredKey(key);
    });
    return { swapped, total: ids.length };
  };
  /** Texture key of one machine part's sprite (WP18b); null without a World machine or sprite. */
  const textureKey = (id: MachineComponentId): string | null =>
    game.scene.getScene<WorldScene>('World')?.getMachine()?.getComponentSprite(id)?.texture.key ?? null;
  /** Store-shot plate cap (WP16b-3): WorldScene.setPlateCap; returns the cap in force, null without a World scene. Rendering only. */
  const setPlateCap = (maxTech: TechId | null): TechId | null =>
    game.scene.getScene<WorldScene>('World')?.setPlateCap(maxTech) ?? null;
  /** The store-shot plate cap in force (WP16b-3); null when none or without a World scene. */
  const plateCap = (): TechId | null => game.scene.getScene<WorldScene>('World')?.getPlateCap() ?? null;
  window.__wedtmd = {
    session,
    crankClientPoint,
    componentState,
    techTreeOpen,
    crankPrompt,
    saveNow,
    systemMenuOpen,
    modalCount,
    audioUnlocked,
    cameraState,
    machineStats,
    finaleState,
    skipFinale,
    finaleSeek,
    displayObjects,
    uiStats,
    perfMarks,
    audioStats,
    prestige,
    cycleState,
    partsVisible,
    photoMode,
    photoState,
    showcasePlay,
    showcaseSeek,
    showcaseState,
    showcaseStop,
    demoState: () => extras.demo?.() ?? null,
    restoredTextures,
    textureKey,
    setPlateCap,
    plateCap,
  };
}
