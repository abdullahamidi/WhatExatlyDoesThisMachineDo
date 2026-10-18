import type { Gfx, Painter } from './painterTypes';
import { rect, disc, ring, line } from './draw';
import { PALETTE } from '../../data/palette';

// Era II fallback painters: procedural stand-ins for the electrical machine parts (rust family plus cyan accents).
// Only used when the real PNG is missing. Texture-local coordinates, (0,0) = top-left; every draw stays inside the texture.

// Low riveted skid (104x10) the generator sits on.
export const paintGeneratorPlinth: Painter = (g) => {
  rect(g, PALETTE.grayDark, 0, 6, 104, 4);
  rect(g, PALETTE.rustDark, 2, 2, 100, 5);
  rect(g, PALETTE.rust, 2, 2, 100, 3);
  rect(g, PALETTE.mutedOrange, 2, 2, 100, 1, 0.35);
  for (let x = 8; x <= 96; x += 16) disc(g, PALETTE.dirtyBeige, x, 4, 1);
  rect(g, PALETTE.grayDark, 0, 8, 8, 2);
  rect(g, PALETTE.grayDark, 96, 8, 8, 2);
};

// Generator housing (96x64): cast body with cooling fins, a cyan terminal strip and a cable terminal at the top right.
export const paintGenerator: Painter = (g) => {
  rect(g, PALETTE.grayDark, 2, 4, 92, 6);
  rect(g, PALETTE.industrialGray, 2, 4, 92, 2);
  rect(g, PALETTE.rustDark, 4, 8, 88, 48);
  rect(g, PALETTE.rust, 6, 10, 84, 44);
  rect(g, PALETTE.mutedOrange, 6, 10, 84, 1, 0.3);
  for (let x = 9; x < 87; x += 6) rect(g, PALETTE.rustDark, x, 12, 2, 40);
  rect(g, PALETTE.grayDark, 2, 56, 92, 6);
  disc(g, PALETTE.dirtyBeige, 4, 30, 1);
  disc(g, PALETTE.dirtyBeige, 91, 30, 1);
  rect(g, PALETTE.cyanDark, 8, 52, 80, 2);
  rect(g, PALETTE.cyan, 8, 52, 80, 1);
  rect(g, PALETTE.grayDark, 62, 3, 22, 8);
  rect(g, PALETTE.cyanDark, 64, 5, 18, 4);
  rect(g, PALETTE.cyan, 64, 5, 18, 2);
  rect(g, PALETTE.cyanLight, 64, 5, 4, 1);
};

// Belt pulley seen face-on (20x20): rim, three spokes, hub and an off-centre orange mark so rotation reads.
export const paintPulleyGenerator: Painter = (g) => {
  ring(g, PALETTE.grayDark, 10, 10, 9, 7);
  ring(g, PALETTE.industrialGray, 10, 10, 7, 5);
  for (let k = 0; k < 3; k++) {
    const a = (2 * Math.PI * k) / 3 - Math.PI / 2;
    line(g, PALETTE.grayDark, 10, 10, Math.round(10 + Math.cos(a) * 6), Math.round(10 + Math.sin(a) * 6), 2);
  }
  disc(g, PALETTE.grayDark, 10, 10, 3);
  disc(g, PALETTE.rustDark, 10, 10, 1);
  rect(g, PALETTE.mutedOrange, 14, 3, 2, 2);
};

// Coil stages (64x40). Stage = number of winding rows (1, 2, 3, from the id suffix). Every stage paints the same
// opaque silhouette, so a higher stage fully covers a lower one; only the copper windings and cyan ties differ.
export const paintCoils: Painter = (g, entry) => {
  const rows = entry.id.endsWith('3') ? 3 : entry.id.endsWith('2') ? 2 : 1;
  rect(g, PALETTE.rustDark, 0, 0, 64, 40);
  rect(g, PALETTE.grayDark, 0, 0, 64, 2);
  rect(g, PALETTE.grayDark, 0, 38, 64, 2);
  for (let r = 0; r < rows; r++) {
    const y0 = 4 + r * 12;
    for (let x = 3; x <= 57; x += 6) rect(g, PALETTE.rust, x, y0, 3, 8);
    rect(g, PALETTE.cyan, 0, y0 + 9, 64, 1);
  }
};

// Motor retrofit bracket (32x16) with a small cyan lamp on top.
export const paintMotorRetrofit: Painter = (g) => {
  rect(g, PALETTE.grayDark, 0, 4, 32, 12);
  rect(g, PALETTE.rust, 2, 6, 28, 8);
  rect(g, PALETTE.mutedOrange, 2, 6, 28, 1, 0.35);
  rect(g, PALETTE.rustDark, 2, 12, 28, 2);
  disc(g, PALETTE.dirtyBeige, 5, 9, 1);
  disc(g, PALETTE.dirtyBeige, 26, 9, 1);
  rect(g, PALETTE.cyanDark, 13, 0, 6, 4);
  rect(g, PALETTE.cyan, 14, 1, 4, 2);
  rect(g, PALETTE.cyanLight, 15, 1, 2, 1);
};

// Crank dynamo (24x24): round can with a cyan stripe.
export const paintDynamo: Painter = (g) => {
  disc(g, PALETTE.grayDark, 12, 12, 11);
  disc(g, PALETTE.industrialGray, 12, 12, 9);
  rect(g, PALETTE.cyan, 2, 10, 20, 3);
  rect(g, PALETTE.cyanDark, 2, 13, 20, 1);
  rect(g, PALETTE.cyanLight, 4, 10, 6, 1, 0.8);
  disc(g, PALETTE.dirtyBeige, 12, 4, 1);
  disc(g, PALETTE.dirtyBeige, 12, 20, 1);
};

// Capacitor rack (48x64): four stacked cylinders with cyan caps on a rack frame.
export const paintCapacitorRack: Painter = (g) => {
  rect(g, PALETTE.rustDark, 2, 0, 3, 58);
  rect(g, PALETTE.rustDark, 43, 0, 3, 58);
  for (let i = 0; i < 4; i++) {
    const y0 = 4 + i * 14;
    rect(g, PALETTE.rustDark, 8, y0, 32, 11);
    rect(g, PALETTE.rust, 10, y0 + 2, 28, 8);
    rect(g, PALETTE.mutedOrange, 12, y0 + 3, 3, 5, 0.3);
    rect(g, PALETTE.cyan, 9, y0, 30, 2);
    rect(g, PALETTE.cyanLight, 12, y0, 6, 1, 0.8);
  }
  for (const y of [16, 30, 44]) rect(g, PALETTE.grayDark, 2, y, 44, 2);
  rect(g, PALETTE.grayDark, 0, 58, 48, 6);
};

// Spark gap sheet frame (32x48 at column offset ox): electrodes and stand (identical in every frame) plus the arc.
function paintSparkFrame(g: Gfx, ox: number, bright: boolean, dip: number): void {
  rect(g, PALETTE.grayDark, ox + 6, 10, 3, 30);
  rect(g, PALETTE.grayDark, ox + 23, 10, 3, 30);
  disc(g, PALETTE.dirtyBeige, ox + 7, 9, 2);
  disc(g, PALETTE.dirtyBeige, ox + 24, 9, 2);
  rect(g, PALETTE.rustDark, ox + 4, 40, 24, 3);
  rect(g, PALETTE.rust, ox + 2, 43, 28, 4);
  rect(g, PALETTE.grayDark, ox + 12, 36, 8, 4);
  if (bright) {
    line(g, PALETTE.cyanLight, ox + 9, 12, ox + 11, 19, 1);
    line(g, PALETTE.cyanLight, ox + 11, 19, ox + 16, 23, 1);
    line(g, PALETTE.cyanLight, ox + 16, 23, ox + 21, 19, 1);
    line(g, PALETTE.cyanLight, ox + 21, 19, ox + 23, 12, 1);
  } else {
    line(g, PALETTE.cyanDark, ox + 9, 14, ox + 13, 18 + dip, 1);
    line(g, PALETTE.cyan, ox + 13, 18 + dip, ox + 17, 16, 1);
  }
}

// Spark gap sheet (128x48 = 4 frames of 32x48): frames 0, 1, 3 dim short arcs, frame 2 the bright full arc.
export const paintSparkGap: Painter = (g) => {
  paintSparkFrame(g, 0, false, 0);
  paintSparkFrame(g, 32, false, 2);
  paintSparkFrame(g, 64, true, 0);
  paintSparkFrame(g, 96, false, 1);
};

// Transformer (64x64): tank with an iron core, two windings and a cyan bushing at the top right.
export const paintTransformer: Painter = (g) => {
  rect(g, PALETTE.rustDark, 4, 8, 56, 52);
  rect(g, PALETTE.rust, 7, 11, 50, 46);
  rect(g, PALETTE.mutedOrange, 7, 11, 50, 1, 0.3);
  rect(g, PALETTE.grayDark, 4, 58, 56, 4);
  rect(g, PALETTE.grayDark, 28, 12, 8, 44);
  rect(g, PALETTE.grayDark, 20, 14, 24, 3);
  rect(g, PALETTE.grayDark, 20, 44, 24, 3);
  rect(g, PALETTE.rustDark, 12, 18, 10, 24);
  rect(g, PALETTE.rustDark, 42, 18, 10, 24);
  for (let y = 18; y < 42; y += 2) {
    rect(g, PALETTE.mutedOrange, 13, y, 8, 1, 0.8);
    rect(g, PALETTE.mutedOrange, 43, y, 8, 1, 0.8);
  }
  rect(g, PALETTE.grayDark, 18, 3, 5, 6);
  rect(g, PALETTE.dirtyBeige, 19, 1, 3, 2);
  rect(g, PALETTE.cyanDark, 46, 3, 5, 6);
  rect(g, PALETTE.cyan, 47, 1, 3, 2);
  rect(g, PALETTE.cyanLight, 47, 1, 1, 1);
};

// Lattice cable mast (16x112): two legs, cross members with diagonals, cyan insulator at the top, footed base.
export const paintCableMast: Painter = (g) => {
  line(g, PALETTE.grayDark, 3, 111, 6, 6, 2);
  line(g, PALETTE.grayDark, 12, 111, 9, 6, 2);
  for (let y = 16; y + 12 <= 100; y += 12) {
    rect(g, PALETTE.rust, 4, y, 8, 1);
    line(g, PALETTE.rustDark, 4, y, 12, y + 12, 1);
    line(g, PALETTE.rustDark, 12, y, 4, y + 12, 1);
  }
  rect(g, PALETTE.grayDark, 6, 6, 4, 1);
  rect(g, PALETTE.cyan, 4, 2, 8, 4);
  rect(g, PALETTE.cyanLight, 5, 2, 2, 1);
  rect(g, PALETTE.cyanDark, 4, 5, 8, 1);
  rect(g, PALETTE.rustDark, 2, 106, 12, 2);
  rect(g, PALETTE.grayDark, 0, 108, 16, 4);
};

// Fallback painters for the 12 new machine asset ids (coils1/2/3 share one painter).
export const ERA2_PAINTERS: Record<string, Painter> = {
  'machine.generatorPlinth': paintGeneratorPlinth,
  'machine.generator': paintGenerator,
  'machine.pulleyGenerator': paintPulleyGenerator,
  'machine.coils1': paintCoils,
  'machine.coils2': paintCoils,
  'machine.coils3': paintCoils,
  'machine.motorRetrofit': paintMotorRetrofit,
  'machine.dynamo': paintDynamo,
  'machine.capacitorRack': paintCapacitorRack,
  'machine.sparkGap': paintSparkGap,
  'machine.transformer': paintTransformer,
  'machine.cableMast': paintCableMast,
};
