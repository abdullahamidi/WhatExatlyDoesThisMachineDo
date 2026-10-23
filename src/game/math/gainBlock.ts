import { RESOURCE_IDS } from '../../data/types';
import type { ResourceMap } from '../../data/types';
import type { Vec2 } from '../../data/machineComponents';
import type { Bounds } from './camera';

/** One crank gain block (WP17 T8): the resources gained by rapid clicks, merged into one stacked text. */
export interface GainBlock { gains: ResourceMap; startMs: number; lastMs: number }

/** A gained value counts only when finite and > 0; anything else counts 0. */
function countable(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function zeroMap(): ResourceMap {
  return { me: 0, ee: 0, pr: 0, rs: 0, xf: 0 };
}

/**
 * Adds a click's gains to the open block, or starts a fresh one.
 * Merged iff a block exists, 0 <= nowMs - lastMs <= coalesceMs, and nowMs - startMs < blockMaxMs.
 * Inputs are never mutated; the returned block owns new objects.
 */
export function mergeGains(
  block: GainBlock | null,
  gained: Readonly<ResourceMap>,
  nowMs: number,
  coalesceMs: number,
  blockMaxMs: number,
): { block: GainBlock; merged: boolean } {
  if (block !== null) {
    const sinceLast = nowMs - block.lastMs;
    const sinceStart = nowMs - block.startMs;
    if (sinceLast >= 0 && sinceLast <= coalesceMs && sinceStart < blockMaxMs) {
      const gains = zeroMap();
      for (const id of RESOURCE_IDS) gains[id] = countable(block.gains[id]) + countable(gained[id]);
      return { block: { gains, startMs: block.startMs, lastMs: nowMs }, merged: true };
    }
  }
  const gains = zeroMap();
  for (const id of RESOURCE_IDS) gains[id] = countable(gained[id]);
  return { block: { gains, startMs: nowMs, lastMs: nowMs }, merged: false };
}

/**
 * Font size of the gain text in world px: never below `fontSizePx`, and at least `minScreenPx` on screen at this zoom.
 * A zoom that is not a positive finite number falls back to `fontSizePx`.
 */
export function gainFontPx(zoom: number, fontSizePx: number, minScreenPx: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return fontSizePx;
  return Math.max(fontSizePx, Math.ceil(minScreenPx / zoom));
}

/**
 * World px box of a stacked gain block: `maxChars` characters wide (centred on anchor.x), its bottom edge on anchor.y,
 * `lineCount` lines tall (each line is fontPx plus the gap).
 */
export function gainBlockBox(
  anchor: Vec2,
  lineCount: number,
  maxChars: number,
  fontPx: number,
  lineGapPx: number,
  charWidthEm: number,
): Bounds {
  const width = maxChars * charWidthEm * fontPx;
  const height = lineCount * (fontPx + lineGapPx);
  return {
    left: anchor.x - width / 2,
    right: anchor.x + width / 2,
    top: anchor.y - height,
    bottom: anchor.y,
  };
}
