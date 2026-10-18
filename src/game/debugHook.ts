// test-only hook, safe to ship
import Phaser from 'phaser';
import type { GameSession } from '../simulation';
import { MACHINE_COMPONENTS } from '../data/machineComponents';
import { machineLocalToWorld, resolveAttachment } from './math/machineLayout';
import { worldToClient } from './math/camera';

declare global {
  interface Window {
    __wedtmd?: { session: GameSession; crankClientPoint(): { x: number; y: number } };
  }
}

export function installDebugHook(session: GameSession, game: Phaser.Game): void {
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
  window.__wedtmd = { session, crankClientPoint };
}
