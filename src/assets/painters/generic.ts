import type { Painter } from './painterTypes';
import { rect, disc, line } from './draw';
import { PALETTE } from '../../data/palette';

// Placeholder plate for assets without a dedicated painter: rust plate, dark border, rivets and a muted X.
export const paintGenericPlate: Painter = (g, entry) => {
  const w = entry.width;
  const h = entry.height;
  rect(g, PALETTE.rustDark, 0, 0, w, h);
  rect(g, PALETTE.rust, 1, 1, w - 2, h - 2);
  // 1-px border as four edge rects
  rect(g, PALETTE.ink, 0, 0, w, 1, 0.8);
  rect(g, PALETTE.ink, 0, h - 1, w, 1, 0.8);
  rect(g, PALETTE.ink, 0, 0, 1, h, 0.8);
  rect(g, PALETTE.ink, w - 1, 0, 1, h, 0.8);
  // rivets at the four corners, inset by 4
  for (const x of [4, w - 5]) {
    for (const y of [4, h - 5]) {
      disc(g, PALETTE.dirtyBeige, x, y, 1);
    }
  }
  // placeholder X
  line(g, PALETTE.mutedOrange, 4, 4, w - 5, h - 5, 1, 0.8);
  line(g, PALETTE.mutedOrange, w - 5, 4, 4, h - 5, 1, 0.8);
};
