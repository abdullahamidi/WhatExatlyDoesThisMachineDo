import type { AssetEntry } from '../manifest';
import type { Gfx, Painter } from './painterTypes';
import { rect, disc, ring, line } from './draw';
import { createRng } from './rng';
import { PALETTE } from '../../data/palette';

// Rect clipped to the texture bounds [0,w) x [0,h): nothing is ever drawn outside the texture.
function clippedRect(g: Gfx, entry: AssetEntry, color: number, x: number, y: number, w: number, h: number, alpha: number = 1): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(entry.width, x + w);
  const y1 = Math.min(entry.height, y + h);
  if (x1 <= x0 || y1 <= y0) return;
  rect(g, color, x0, y0, x1 - x0, y1 - y0, alpha);
}

// Frame base (texture 200x110). The crank bearing sits on socket crankHub = texture (30,48).
export const paintFrame: Painter = (g, entry) => {
  // 1. base beam
  rect(g, PALETTE.rustDark, 0, 94, 200, 16);
  rect(g, PALETTE.rust, 0, 94, 200, 12);
  rect(g, PALETTE.mutedOrange, 0, 94, 200, 1, 0.35);
  // 2. feet
  rect(g, PALETTE.grayDark, 6, 104, 22, 6);
  rect(g, PALETTE.grayDark, 172, 104, 22, 6);
  // 3. uprights and shading
  rect(g, PALETTE.rust, 18, 24, 24, 70);
  rect(g, PALETTE.rust, 158, 24, 24, 70);
  rect(g, PALETTE.rustDark, 38, 24, 4, 70);
  rect(g, PALETTE.rustDark, 178, 24, 4, 70);
  // 4. braces
  line(g, PALETTE.rustDark, 42, 92, 100, 26, 3);
  line(g, PALETTE.rustDark, 158, 92, 100, 26, 3);
  // 5. top beam
  rect(g, PALETTE.rust, 10, 12, 180, 14);
  rect(g, PALETTE.rustDark, 10, 24, 180, 2);
  rect(g, PALETTE.mutedOrange, 10, 12, 180, 1, 0.35);
  // 6. crank bearing plate on the left upright
  disc(g, PALETTE.grayDark, 30, 48, 12);
  disc(g, PALETTE.industrialGray, 30, 48, 9);
  disc(g, PALETTE.grayDark, 30, 48, 3);
  // 7. rivets
  for (let x = 8; x < 200; x += 16) {
    disc(g, PALETTE.dirtyBeige, x, 100, 1);
    disc(g, PALETTE.dirtyBeige, x, 19, 1);
  }
  // 8. weathering (deterministic)
  const rng = createRng(11);
  for (let i = 0; i < 40; i++) {
    clippedRect(g, entry, PALETTE.mutedOrange, Math.floor(rng() * 196), Math.floor(rng() * 98) + 12, 2, 1, 0.25);
  }
  for (let i = 0; i < 25; i++) {
    clippedRect(g, entry, PALETTE.ink, Math.floor(rng() * 196), Math.floor(rng() * 98) + 12, 1, 2, 0.3);
  }
};

// Hand crank (48x48, centre (24,24)). The arm points up so rotation is visible.
export const paintCrank: Painter = (g) => {
  // 1. counterweight
  rect(g, PALETTE.rustDark, 21, 28, 6, 8);
  disc(g, PALETTE.rustDark, 24, 38, 4);
  // 2. arm
  rect(g, PALETTE.rustDark, 20, 4, 8, 22);
  rect(g, PALETTE.rust, 21, 5, 6, 20);
  disc(g, PALETTE.rust, 24, 7, 4);
  // 3. handle (bright, invites clicking)
  rect(g, PALETTE.ink, 13, 1, 22, 7, 0.8);
  rect(g, PALETTE.mutedOrange, 14, 2, 20, 5);
  rect(g, PALETTE.dirtyBeige, 14, 2, 20, 1, 0.7);
  // 4. hub
  disc(g, PALETTE.grayDark, 24, 24, 9);
  disc(g, PALETTE.industrialGray, 24, 24, 6);
  disc(g, PALETTE.rustDark, 24, 24, 2);
  disc(g, PALETTE.dirtyBeige, 22, 22, 1, 0.6);
};

// Gear (square texture, works for 40 and 64). Teeth may overhang the texture edge, so they are clipped.
export const paintGear: Painter = (g, entry) => {
  const c = entry.width / 2;
  const n = Math.max(8, Math.round(entry.width / 4));
  const rOuter = c - 1;
  const rBody = rOuter - 4;
  const body = entry.id === 'machine.gearLarge' ? PALETTE.rust : PALETTE.industrialGray;
  // 1. tooth outlines
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    for (let r = rBody; r <= rOuter; r++) {
      clippedRect(g, entry, PALETTE.grayDark,
        Math.round(c + Math.cos(angle) * r) - 2, Math.round(c + Math.sin(angle) * r) - 2, 5, 5);
    }
  }
  // 2. body disc
  disc(g, PALETTE.grayDark, c, c, rBody + 1);
  disc(g, body, c, c, rBody);
  // 3. teeth body
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    for (let r = rBody; r <= rOuter; r++) {
      clippedRect(g, entry, body,
        Math.round(c + Math.cos(angle) * r) - 1, Math.round(c + Math.sin(angle) * r) - 1, 3, 3);
    }
  }
  // 4. inner ring, spokes (so rotation is visible), hub, highlight
  ring(g, PALETTE.grayDark, c, c, rBody - 3, rBody - 4);
  for (let k = 0; k < 4; k++) {
    line(g, PALETTE.grayDark, c, c,
      Math.round(c + Math.cos((k * Math.PI) / 2) * (rBody - 3)),
      Math.round(c + Math.sin((k * Math.PI) / 2) * (rBody - 3)), 2);
  }
  disc(g, PALETTE.grayDark, c, c, Math.max(3, Math.round(entry.width / 10) + 1));
  disc(g, PALETTE.rustDark, c, c, 2);
  disc(g, PALETTE.dirtyBeige, c - 2, c - 2, 1, 0.5);
};
