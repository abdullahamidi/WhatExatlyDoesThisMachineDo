// Shared row containers (WP23a): the back and front ground rows of the living world, one container each, created once per scene.
// Why: the cast and props renderers draw into the same two rows, so depth sorting is one rule. Row depths and per-kind offsets
// live in src/data/livingWorld.ts (WORLD_ROWS, WORLD_DEPTH_OFFSETS; DENIZEN_ART §1.4). This file owns no other state.
import type Phaser from 'phaser';
import { WORLD_ROWS } from '../../data/livingWorld';

export interface WorldRows {
  back: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Container;
}

/** Creates the back and front row containers at (0, 0), each at its row depth. Call once per scene; nothing else is added. */
export function createWorldRows(scene: Phaser.Scene): WorldRows {
  return {
    back: scene.add.container(0, 0).setDepth(WORLD_ROWS.back.depth),
    front: scene.add.container(0, 0).setDepth(WORLD_ROWS.front.depth),
  };
}

/** Re-sorts the children of both rows by depth. Call after a child's depth changes. */
export function sortWorldRows(rows: WorldRows): void {
  rows.back.sort('depth');
  rows.front.sort('depth');
}
