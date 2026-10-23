// Test-only hook. Installed only when debugEnabled(search, DEV) and not in a packaged desktop host.
import Phaser from 'phaser';
import type { GameSession } from '../simulation';
import type { TechTree } from '../ui/techTree';
import type { ModalStack } from '../ui/modalStack';
import type { SystemMenu } from '../ui/systemMenu';
import type { SaveController } from '../persistence/saveController';
import type { GameAudio } from '../audio/gameAudio';
import type { PrestigeState } from '../data/types';
import type { AudioStats } from '../data/music';
import type { CyclePreview } from '../simulation/prestige';
import type { MachineComponentId } from '../data/machineComponents';
import { MACHINE_COMPONENTS } from '../data/machineComponents';
import { MACHINE_ANCHOR } from '../data/world';
import { machineLocalToWorld, resolveAttachment } from './math/machineLayout';
import { worldToClient } from './math/camera';
import type { WorldScene } from './scenes/WorldScene';
import type { FinaleState } from './rendering/FinaleDirector';
import type { FinaleFrame } from './math/finale';
import type { CycleTransitionState } from './rendering/CycleTransition';
import type { NewCycleController } from './newCycle';

/** Live objects the hook reads from. Read-only views only; no mutation helpers. */
export interface DebugExtras {
  modals: ModalStack;
  systemMenu: SystemMenu;
  saveController: SaveController;
  audio: GameAudio;
  newCycle: NewCycleController;
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
      audioStats(): AudioStats | null;
      prestige(): PrestigeState;
      cycleState(): CycleDebugState;
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
  const audioStats = (): AudioStats | null => extras.audio.stats();
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
  };
}
