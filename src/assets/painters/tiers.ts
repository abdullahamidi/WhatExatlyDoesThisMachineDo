import type { Gfx, Painter } from './painterTypes';
import { rect } from './draw';
import { PALETTE } from '../../data/palette';
import type { AssetEntry } from '../manifest';
import type { AssetId } from '../assetIds';

// WP22 tier decals: procedural annulus stand-ins for the three decal assets, used only when the real PNG is missing.
// Each decal is a thin ring with a transparent centre. Every pixel is alpha 1 and drawn as a 1x1 rect. Sizes are even,
// so the texture centre sits between pixels: pixel (x, y) is measured from its own centre (x + 0.5, y + 0.5).

// Offset of a pixel centre from the texture centre: dx, dy signed (x right, y down), d the distance.
interface Offset { dx: number; dy: number; d: number }

// Fills every pixel whose centre offset passes `hit` with `color`, one 1x1 rect per pixel, row by row.
function paintWhere(g: Gfx, entry: AssetEntry, hit: (o: Offset) => boolean, color: number): void {
  const cx = entry.width / 2;
  const cy = entry.height / 2;
  for (let y = 0; y < entry.height; y++) {
    for (let x = 0; x < entry.width; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (hit({ dx, dy, d: Math.hypot(dx, dy) })) rect(g, color, x, y, 1, 1);
    }
  }
}

// Gear rim (64x64): rust annulus d 20..22, with a mutedOrange glint arc on the upper left (d 21.2..22, dx < 0, dy < 0).
export const paintGearRim: Painter = (g, entry) => {
  paintWhere(g, entry, (o) => o.d >= 20 && o.d <= 22, PALETTE.rust);
  paintWhere(g, entry, (o) => o.d >= 21.2 && o.d <= 22 && o.dx < 0 && o.dy < 0, PALETTE.mutedOrange);
};

// Flywheel rim 2 (96x96): industrialGray annulus d 40.3..46.5, ink outer edge d 46.5..47, grayDark shadow arc lower right (d 40.3..42.5, dx > 0, dy > 0).
export const paintFlywheelRim2: Painter = (g, entry) => {
  paintWhere(g, entry, (o) => o.d >= 40.3 && o.d <= 46.5, PALETTE.industrialGray);
  paintWhere(g, entry, (o) => o.d > 46.5 && o.d <= 47, PALETTE.ink);
  paintWhere(g, entry, (o) => o.d >= 40.3 && o.d < 42.5 && o.dx > 0 && o.dy > 0, PALETTE.grayDark);
};

// Flywheel rim 3 (96x96): everything rim 2 draws, then a rust inlay ring d 42.5..43.4 on top.
export const paintFlywheelRim3: Painter = (g, entry) => {
  paintFlywheelRim2(g, entry);
  paintWhere(g, entry, (o) => o.d >= 42.5 && o.d <= 43.4, PALETTE.rust);
};

// The three WP22 decal ids and their fallback painters (spread into the fallback PAINTERS map).
export const TIER_PAINTERS: Partial<Record<AssetId, Painter>> = {
  'machine.gearRim': paintGearRim,
  'machine.flywheelRim2': paintFlywheelRim2,
  'machine.flywheelRim3': paintFlywheelRim3,
};
