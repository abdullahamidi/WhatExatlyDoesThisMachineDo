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

// Bellows sheet (240x28 = 4 cells of 60x28). Each cell has its own board gap; the boards close and open across the frames.
const BELLOWS_CELL_WIDTH = 60;
const BELLOWS_GAPS: readonly number[] = [18, 15, 12, 15];

function paintBellowsCell(g: Gfx, ox: number, gap: number): void {
  const top = Math.floor((24 - gap) / 2); // first row of the top board (3 rows tall)
  const bottom = top + gap - 3; // first row of the bottom board (3 rows tall)
  // Folded leather between the boards.
  rect(g, PALETTE.rustDark, ox + 6, top + 3, 20, gap - 6);
  for (let x = 7; x <= 23; x += 4) rect(g, PALETTE.rust, ox + x, top + 3, 2, gap - 6);
  // Boards with a lit top line.
  rect(g, PALETTE.grayDark, ox + 4, top, 24, 3);
  rect(g, PALETTE.industrialGray, ox + 4, top, 24, 1);
  rect(g, PALETTE.grayDark, ox + 4, bottom, 24, 3);
  rect(g, PALETTE.industrialGray, ox + 4, bottom, 24, 1);
  // Hinge block on the left, between the boards.
  rect(g, PALETTE.grayDark, ox, top + 1, 4, gap - 2);
  rect(g, PALETTE.industrialGray, ox + 1, top + 2, 2, gap - 4);
  // Neck and nozzle tip on the right, rows 9..11 (the tip covers texture 36,10 in every cell).
  rect(g, PALETTE.grayDark, ox + 25, 9, 8, 3);
  rect(g, PALETTE.industrialGray, ox + 33, 9, 7, 3);
}

export const paintBellows: Painter = (g) => {
  BELLOWS_GAPS.forEach((gap, k) => paintBellowsCell(g, k * BELLOWS_CELL_WIDTH, gap));
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
