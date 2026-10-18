// test-only hook, safe to ship
import Phaser from 'phaser';
import type { GameSession } from '../simulation';
import type { TechTree } from '../ui/techTree';
import type { MachineComponentId } from '../data/machineComponents';
import { MACHINE_COMPONENTS } from '../data/machineComponents';
import { machineLocalToWorld, resolveAttachment } from './math/machineLayout';
import { worldToClient } from './math/camera';
import type { WorldScene } from './scenes/WorldScene';

declare global {
  interface Window {
    __wedtmd?: {
      session: GameSession;
      crankClientPoint(): { x: number; y: number };
      componentState(id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number } | null;
      techTreeOpen(): boolean;
    };
  }
}

export function installDebugHook(session: GameSession, game: Phaser.Game, techTree: TechTree): void {
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
  const componentState = (id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number } | null => {
    const scene = game.scene.getScene<WorldScene>('World');
    return scene.getMachine()?.getComponentState(id) ?? null;
  };
  const techTreeOpen = (): boolean => techTree.isOpen();
  window.__wedtmd = { session, crankClientPoint, componentState, techTreeOpen };
}
