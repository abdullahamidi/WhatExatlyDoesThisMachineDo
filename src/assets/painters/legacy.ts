import type { Gfx, Painter } from './painterTypes';
import { rect, disc, ring } from './draw';
import { PALETTE } from '../../data/palette';

// WP17 legacy feed painters: procedural stand-ins for the feed parts of the older energies (cyan glow, bellows, feed post,
// backfeed terminal, steam lance). Only used when the real PNG is missing. Texture-local coordinates, (0,0) = top-left;
// every draw stays inside the texture. Sheet painters draw every cell in one call at cell offset k * cellWidth.

// Generator glow sheet (384x64 = 4 cells of 96x64). Cell k is a cyan overlay at alpha GLOW_ALPHAS[k] over the winding area.
const GLOW_CELL_WIDTH = 96;
const GLOW_ALPHAS: readonly number[] = [0.12, 0.24, 0.38, 0.55];
// Belt pulley circle in cell-local px (centre and r 11). No glow pixel may fall inside it.
const PULLEY_X = 52;
const PULLEY_Y = 49;
const PULLEY_R2 = 121;

// Open spans [x0, x1) of the winding area on row y (cell-local): x 6..89, skipping the pulley circle.
function glowRowSpans(y: number): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = -1;
  for (let x = 6; x <= 90; x++) {
    const dx = x - PULLEY_X;
    const dy = y - PULLEY_Y;
    const open = x < 90 && dx * dx + dy * dy > PULLEY_R2;
    if (open && start < 0) {
      start = x;
    } else if (!open && start >= 0) {
      spans.push([start, x]);
      start = -1;
    }
  }
  return spans;
}

function paintGlowCell(g: Gfx, ox: number, alpha: number): void {
  for (let y = 10; y < 54; y++) {
    for (const [x0, x1] of glowRowSpans(y)) rect(g, PALETTE.cyan, ox + x0, y, x1 - x0, 1, alpha);
  }
  // Terminal strip, split around the pulley circle.
  rect(g, PALETTE.cyanLight, ox + 8, 52, 34, 2, alpha);
  rect(g, PALETTE.cyanLight, ox + 63, 52, 25, 2, alpha);
}

export const paintGeneratorGlow: Painter = (g) => {
  GLOW_ALPHAS.forEach((alpha, k) => paintGlowCell(g, k * GLOW_CELL_WIDTH, alpha));
};

// Bellows sheet (240x28 = 4 cells of 60x28): a tilted top board hinged at the left lifts and lowers; the nozzle covers texture (59,16..17) in every cell.
const BELLOWS_CELL_WIDTH = 60;
const BELLOWS_TIPS: readonly number[] = [0, 6, 11, 6]; // row of the top board at its free left end (x = 1) per cell; it slopes down to row 15 at x = 51

function paintBellowsCell(g: Gfx, ox: number, t: number): void {
  // legs and feet
  rect(g, PALETTE.grayDark, ox + 9, 22, 5, 5);
  rect(g, PALETTE.grayDark, ox + 33, 22, 5, 5);
  rect(g, PALETTE.grayDark, ox + 8, 27, 7, 1);
  rect(g, PALETTE.grayDark, ox + 32, 27, 7, 1);
  // lower board with a lit top line
  rect(g, PALETTE.grayDark, ox + 4, 19, 48, 3);
  rect(g, PALETTE.industrialGray, ox + 4, 19, 48, 1);
  // tilted top board with the folded leather under it, one column at a time
  for (let x = 1; x <= 51; x++) {
    const yTop = Math.round(t + (15 - t) * (x - 1) / 50);
    rect(g, PALETTE.grayDark, ox + x, yTop, 1, 2);
    rect(g, PALETTE.rustDark, ox + x, yTop + 2, 1, Math.max(0, 17 - yTop));
    if (x % 6 === 0) rect(g, PALETTE.rust, ox + x, yTop + 2, 1, Math.max(0, 17 - yTop));
  }
  // snout cap and nozzle
  rect(g, PALETTE.grayDark, ox + 45, 13, 8, 2);
  rect(g, PALETTE.industrialGray, ox + 52, 15, 8, 4);
}

export const paintBellows: Painter = (g) => {
  BELLOWS_TIPS.forEach((t, k) => paintBellowsCell(g, k * BELLOWS_CELL_WIDTH, t));
};

// Exciter feed post (16x24): insulator discs stacked on a post, with a cyan cap at the top (lug at 8,2).
export const paintExciterFeed: Painter = (g) => {
  rect(g, PALETTE.grayDark, 7, 4, 2, 18);
  for (const cy of [8, 13, 18]) {
    disc(g, PALETTE.grayDark, 8, cy, 3);
    disc(g, PALETTE.industrialGray, 8, cy - 1, 2);
  }
  rect(g, PALETTE.grayDark, 3, 22, 10, 2);
  rect(g, PALETTE.cyanDark, 4, 0, 8, 5);
  rect(g, PALETTE.cyan, 5, 1, 6, 3);
  rect(g, PALETTE.cyanLight, 6, 1, 2, 1);
};

// Backfeed terminal (16x24): hanging grayDark plate with violet accents, insulator discs and a cyan cap at the bottom (lug at 8,22).
export const paintBackfeedTerminal: Painter = (g) => {
  rect(g, PALETTE.grayDark, 7, 3, 2, 14);
  for (const cy of [6, 11, 16]) {
    disc(g, PALETTE.grayDark, 8, cy, 3);
    disc(g, PALETTE.industrialGray, 8, cy - 1, 2);
    rect(g, PALETTE.violet, 7, cy, 2, 1);
  }
  rect(g, PALETTE.grayDark, 1, 0, 14, 3);
  rect(g, PALETTE.violet, 2, 1, 12, 1);
  rect(g, PALETTE.violetPale, 3, 1, 2, 1);
  rect(g, PALETTE.violetLight, 11, 1, 2, 1);
  rect(g, PALETTE.cyanDark, 4, 20, 8, 4);
  rect(g, PALETTE.cyan, 5, 21, 6, 2);
  rect(g, PALETTE.cyanLight, 6, 21, 2, 1);
};

// Steam lance (16x24): rust handwheel on a stem, industrialGray valve block with a steam highlight, flanged port at the bottom edge.
export const paintSteamLance: Painter = (g) => {
  ring(g, PALETTE.rust, 8, 3, 3, 1);
  rect(g, PALETTE.rustDark, 7, 2, 2, 2);
  rect(g, PALETTE.grayDark, 7, 5, 2, 2);
  rect(g, PALETTE.industrialGray, 3, 7, 10, 8);
  rect(g, PALETTE.grayDark, 3, 14, 10, 1);
  rect(g, PALETTE.steam, 4, 8, 3, 1);
  rect(g, PALETTE.steam, 4, 9, 1, 1);
  rect(g, PALETTE.industrialGray, 5, 15, 6, 5);
  rect(g, PALETTE.grayDark, 2, 20, 12, 4);
  rect(g, PALETTE.rustDark, 7, 21, 2, 3);
};

// Fallback painters for the 5 WP17 legacy feed asset ids.
export const LEGACY_PAINTERS: Record<string, Painter> = {
  'machine.generatorGlow': paintGeneratorGlow,
  'machine.bellows': paintBellows,
  'machine.exciterFeed': paintExciterFeed,
  'machine.backfeedTerminal': paintBackfeedTerminal,
  'machine.steamLance': paintSteamLance,
};
