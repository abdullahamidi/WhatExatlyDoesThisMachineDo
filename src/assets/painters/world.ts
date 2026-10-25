// WP23a living-world fallback painters: procedural ink silhouettes for the 25 living-world ids (world.*, bg.windowLit, bg.virga).
// Why: a missing PNG must still stage the scene until the Art Director delivers the sprites (DENIZEN_ART 6.4).
// Only used when the real PNG is missing. Texture-local coordinates, (0,0) = top-left; every draw stays inside its cell.
import type { Gfx, Painter } from './painterTypes';
import { rect, disc } from './draw';
import { sheetFrameRects } from '../manifest';
import type { AssetEntry } from '../manifest';
import { PALETTE } from '../../data/palette';

/** The 25 WP23a ids (DENIZEN_ART 5.1), in manifest order. */
export type WorldPaintId =
  | 'world.inspector' | 'world.clipboardPages' | 'world.dog' | 'world.stakeChain' | 'world.hole' | 'world.redBall'
  | 'world.crow' | 'world.girl' | 'world.girlMini' | 'world.girlWindow' | 'world.lantern' | 'world.payphone'
  | 'world.receiver' | 'world.lamp' | 'world.lampGlow' | 'world.clock' | 'world.sensor7' | 'world.puddle'
  | 'world.sprout' | 'world.scraps' | 'world.mote' | 'world.page' | 'world.shadow' | 'bg.windowLit' | 'bg.virga';

type WorldKind = 'person' | 'animal' | 'bird' | 'tall' | 'flat';

// Kind table: person = Inspector, girl, girl mini; animal = dog; bird = crow; tall box = booth, receiver, Sensor 7,
// street lamp, street clock; flat = every other id (props, glow, motes, page, shadow, windows, virga).
const KIND_OF: Record<WorldPaintId, WorldKind> = {
  'world.inspector': 'person',
  'world.clipboardPages': 'flat',
  'world.dog': 'animal',
  'world.stakeChain': 'flat',
  'world.hole': 'flat',
  'world.redBall': 'flat',
  'world.crow': 'bird',
  'world.girl': 'person',
  'world.girlMini': 'person',
  'world.girlWindow': 'flat',
  'world.lantern': 'flat',
  'world.payphone': 'tall',
  'world.receiver': 'tall',
  'world.lamp': 'tall',
  'world.lampGlow': 'flat',
  'world.clock': 'tall',
  'world.sensor7': 'tall',
  'world.puddle': 'flat',
  'world.sprout': 'flat',
  'world.scraps': 'flat',
  'world.mote': 'flat',
  'world.page': 'flat',
  'world.shadow': 'flat',
  'bg.windowLit': 'flat',
  'bg.virga': 'flat',
};

// Body and accent colours per kind, and the ink alpha of the 1 px outline (flat stand-ins are softer).
const KIND_STYLE: Record<WorldKind, { body: number; accent: number; ink: number }> = {
  person: { body: PALETTE.industrialGray, accent: PALETTE.dirtyBeige, ink: 1 },
  animal: { body: PALETTE.dirtyBeige, accent: PALETTE.rustDark, ink: 1 },
  bird: { body: PALETTE.industrialGray, accent: PALETTE.grayDark, ink: 1 },
  tall: { body: PALETTE.industrialGray, accent: PALETTE.grayDark, ink: 1 },
  flat: { body: PALETTE.dirtyBeige, accent: PALETTE.rust, ink: 0.8 },
};

interface Cell { x: number; y: number; width: number; height: number }
type Fill = 'body' | 'accent';
type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: Fill }
  | { kind: 'disc'; cx: number; cy: number; r: number; fill: Fill };

// Person: head disc (r = 20 % of the width, 1 px below the top) over a rect body that stops 2 px above the feet row.
function layoutPerson(c: Cell): Shape[] {
  const r = Math.max(1, Math.floor(c.width * 0.2));
  const bodyW = Math.max(2, Math.floor(c.width * 0.5));
  const bodyTop = c.y + 2 * r + 3;
  const bodyBottom = c.y + c.height - 2;
  return [
    { kind: 'disc', cx: c.x + Math.floor(c.width / 2), cy: c.y + r + 1, r, fill: 'accent' },
    { kind: 'rect', x: c.x + Math.floor((c.width - bodyW) / 2), y: bodyTop, w: bodyW, h: bodyBottom - bodyTop + 1, fill: 'body' },
  ];
}

// Animal: wedge body, head block at the front and one upright ear on top of the head.
function layoutAnimal(c: Cell): Shape[] {
  const headX = c.x + Math.floor(c.width * 0.6);
  const headY = c.y + Math.floor(c.height * 0.2);
  return [
    { kind: 'rect', x: c.x + 2, y: c.y + Math.floor(c.height * 0.35), w: Math.floor(c.width * 0.6) - 2, h: Math.max(2, Math.floor(c.height * 0.35)), fill: 'body' },
    { kind: 'rect', x: headX, y: headY, w: Math.max(2, Math.floor(c.width * 0.25)), h: Math.max(2, Math.floor(c.height * 0.4)), fill: 'body' },
    { kind: 'rect', x: headX + 1, y: headY - 2, w: 2, h: 2, fill: 'accent' },
  ];
}

// Bird: two overlapping wing rects, the upper one toward the back.
function layoutBird(c: Cell): Shape[] {
  return [
    { kind: 'rect', x: c.x + 3, y: c.y + Math.floor(c.height * 0.4), w: Math.floor(c.width * 0.55), h: Math.max(2, Math.floor(c.height * 0.3)), fill: 'body' },
    { kind: 'rect', x: c.x + Math.floor(c.width * 0.375), y: c.y + Math.floor(c.height * 0.2), w: Math.floor(c.width * 0.45), h: Math.max(2, Math.floor(c.height * 0.3)), fill: 'body' },
  ];
}

// Tall box: filled body with a top cap (cap about 12 % of the inner height, at least 1 px).
function layoutTall(c: Cell): Shape[] {
  const capH = Math.max(1, Math.floor((c.height - 2) * 0.12));
  return [
    { kind: 'rect', x: c.x + 1, y: c.y + 1 + capH, w: c.width - 2, h: c.height - 2 - capH, fill: 'body' },
    { kind: 'rect', x: c.x + 1, y: c.y + 1, w: c.width - 2, h: capH, fill: 'accent' },
  ];
}

// Flat: one filled rect inside the 1 px margin.
function layoutFlat(c: Cell): Shape[] {
  return [{ kind: 'rect', x: c.x + 1, y: c.y + 1, w: c.width - 2, h: c.height - 2, fill: 'body' }];
}

const LAYOUT: Record<WorldKind, (c: Cell) => Shape[]> = {
  person: layoutPerson,
  animal: layoutAnimal,
  bird: layoutBird,
  tall: layoutTall,
  flat: layoutFlat,
};

// Ink pass first (every shape grown by 1 px, so the outline sits just outside the fill), then the fills on top.
function paintCell(g: Gfx, cell: Cell, kind: WorldKind): void {
  const style = KIND_STYLE[kind];
  const shapes = LAYOUT[kind](cell);
  for (const s of shapes) {
    if (s.kind === 'rect') rect(g, PALETTE.ink, s.x - 1, s.y - 1, s.w + 2, s.h + 2, style.ink);
    else disc(g, PALETTE.ink, s.cx, s.cy, s.r + 1, style.ink);
  }
  for (const s of shapes) {
    const color = s.fill === 'body' ? style.body : style.accent;
    if (s.kind === 'disc') disc(g, color, s.cx, s.cy, s.r);
    else if (s.w > 0 && s.h > 0) rect(g, color, s.x, s.y, s.w, s.h);
  }
}

// Sheets: one silhouette per frame cell (row-major, frame.count cells). Plain images: the whole texture.
function cellsOf(entry: AssetEntry): Cell[] {
  const cells = sheetFrameRects(entry);
  return cells.length > 0 ? cells : [{ x: 0, y: 0, width: entry.width, height: entry.height }];
}

function worldPainter(kind: WorldKind): Painter {
  return (g, entry) => {
    for (const cell of cellsOf(entry)) paintCell(g, cell, kind);
  };
}

// Fallback painters for the 25 WP23a ids (spread into PAINTERS in fallbackTextures.ts).
export const WORLD_PAINTERS: Record<string, Painter> = Object.fromEntries(
  (Object.keys(KIND_OF) as WorldPaintId[]).map((id) => [id, worldPainter(KIND_OF[id])]),
);
