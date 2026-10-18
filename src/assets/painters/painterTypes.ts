import Phaser from 'phaser';
import type { AssetEntry } from '../manifest';

export type Gfx = Phaser.GameObjects.Graphics;
export type Painter = (g: Gfx, entry: AssetEntry) => void;       // draws into a Graphics at texture-local coordinates, (0,0) = top-left, size entry.width x entry.height
