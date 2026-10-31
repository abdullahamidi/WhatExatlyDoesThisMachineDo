// WP23a PNG gate for the living world: every manifest entry with a file (world.*, bg.windowLit and, since WP23b AD3c,
// bg.virga) must be an 8-bit RGBA, non-interlaced PNG at the manifest size, with alpha 0 or 255 only and opaque pixels from
// the Rust Wasteland palette (ART_BRIEF, 25 colours) plus violetLight 0x9a6ad0. WP23b AD3c: the restored-world colours
// (PALETTE green0-3, skyClear0-3) are allowed only inside the two finale cells of the per-id allow-list (puddle whole,
// sprout bloom). The parser and the checks are covered by a synthetic PNG round trip. Node fs and zlib only, no Phaser.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { ASSET_IDS } from './assetIds';
import type { AssetId } from './assetIds';
import { ASSET_MANIFEST } from './manifest';
import { PALETTE } from '../data/palette';

// docs/plan/ART_BRIEF.md palette "Rust Wasteland" (25 colours) plus the era V rim colour violetLight.
const RUST_WASTELAND = [
  0x14110f,
  0x1f2225, 0x2b2e31, 0x3e4246, 0x5a5f63, 0x7d8286, 0xa3a6a4,
  0x2e1a12, 0x4e2a1a, 0x6e3a22, 0x8c4a2a, 0xad6236, 0xc98552,
  0x5f5244, 0x8a7a64, 0xa8957a, 0xc9b28a, 0xddc9a3,
  0x7a7468, 0x9c9182, 0xb8a98f, 0xd2bf9c,
  0xd9822b, 0xf0a848, 0xffd27a,
];
const ALLOWED = new Set<number>([...RUST_WASTELAND, 0x9a6ad0]);

// WP23b AD3c per-id allow-list: the restored-world colours, only in these frames (index into the manifest frame grid,
// row-major): world.puddle 9 = whole (the restored sky in the water), world.sprout 4 = bloom. Nothing else may use them.
const RESTORED_COLOURS: ReadonlySet<number> = new Set<number>([
  PALETTE.green0, PALETTE.green1, PALETTE.green2, PALETTE.green3,
  PALETTE.skyClear0, PALETTE.skyClear1, PALETTE.skyClear2, PALETTE.skyClear3,
]);
const RESTORED_CELLS: Partial<Record<AssetId, readonly number[]>> = { 'world.puddle': [9], 'world.sprout': [4] };

interface AllowRect { x: number; y: number; width: number; height: number; colours: ReadonlySet<number> }

/** The allow-listed cells of one id as sheet rects (empty for every id outside RESTORED_CELLS). */
function restoredRects(id: AssetId): AllowRect[] {
  const entry = ASSET_MANIFEST[id];
  const fw = entry.frame?.width ?? entry.width;
  const fh = entry.frame?.height ?? entry.height;
  const columns = Math.max(1, Math.floor(entry.width / fw));
  return (RESTORED_CELLS[id] ?? []).map((i) => ({
    x: (i % columns) * fw, y: Math.floor(i / columns) * fh, width: fw, height: fh, colours: RESTORED_COLOURS,
  }));
}

function allowedAt(rgb: number, x: number, y: number, allow: readonly AllowRect[]): boolean {
  if (ALLOWED.has(rgb)) return true;
  return allow.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height && r.colours.has(rgb));
}
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface Decoded { width: number; height: number; rgba: Buffer }

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Decodes an 8-bit RGBA, non-interlaced PNG (all five scanline filters). Throws on anything else. */
function decodePng(buf: Buffer): Decoded {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) throw new Error('not a PNG (bad signature)');
  }
  let pos = PNG_SIGNATURE.length;
  let header: { width: number; height: number; bitDepth: number; colorType: number; interlace: number } | null = null;
  const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length; // length + type + data + crc
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8] ?? 0,
        colorType: data[9] ?? 0,
        interlace: data[12] ?? 0,
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (header === null) throw new Error('PNG has no IHDR');
  if (header.bitDepth !== 8 || header.colorType !== 6) {
    throw new Error(`PNG must be 8-bit RGBA (colour type 6), got depth ${header.bitDepth}, colour type ${header.colorType}`);
  }
  if (header.interlace !== 0) throw new Error('PNG must not be interlaced');

  const bpp = 4;
  const stride = header.width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * header.height) throw new Error(`PNG data length ${raw.length}, expected ${(stride + 1) * header.height}`);
  const out = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x] ?? 0;
      const left = x >= bpp ? (out[dst + x - bpp] ?? 0) : 0;
      const up = y > 0 ? (out[dst - stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= bpp ? (out[dst - stride + x - bpp] ?? 0) : 0;
      let pred: number;
      switch (filter) {
        case 0: pred = 0; break;
        case 1: pred = left; break;
        case 2: pred = up; break;
        case 3: pred = (left + up) >> 1; break;
        case 4: pred = paeth(left, up, upLeft); break;
        default: throw new Error(`PNG scanline ${y} has unknown filter ${String(filter)}`);
      }
      out[dst + x] = (v + pred) & 0xff;
    }
  }
  return { width: header.width, height: header.height, rgba: out };
}

/** Problems with a decoded sheet against the manifest size (empty = pass); `allow` widens the palette per cell rect. */
function sheetProblems(img: Decoded, width: number, height: number, allow: readonly AllowRect[] = []): string[] {
  const problems: string[] = [];
  if (img.width !== width || img.height !== height) {
    problems.push(`size ${img.width}x${img.height}, manifest ${width}x${height}`);
  }
  let partialAlpha = 0;
  const offPalette = new Set<string>();
  for (let i = 0; i < img.rgba.length; i += 4) {
    const alpha = img.rgba[i + 3] ?? 0;
    if (alpha !== 0 && alpha !== 255) {
      partialAlpha++;
    } else if (alpha === 255) {
      const rgb = ((img.rgba[i] ?? 0) << 16) | ((img.rgba[i + 1] ?? 0) << 8) | (img.rgba[i + 2] ?? 0);
      const p = i / 4;
      if (!allowedAt(rgb, p % img.width, Math.floor(p / img.width), allow)) offPalette.add(`#${rgb.toString(16).padStart(6, '0')}`);
    }
  }
  if (partialAlpha > 0) problems.push(`${partialAlpha} pixels with alpha other than 0 or 255`);
  if (offPalette.size > 0) problems.push(`off-palette colours: ${[...offPalette].slice(0, 5).join(', ')}`);
  return problems;
}

// Test-only encoder: filters each row with the given type (0..4) and writes chunks with a zero CRC (the decoder ignores CRCs).
function encodePng(width: number, height: number, rgba: Buffer, filters: readonly number[]): Buffer {
  const bpp = 4;
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const type = filters[y % filters.length] ?? 0;
    raw[y * (stride + 1)] = type;
    for (let x = 0; x < stride; x++) {
      const v = rgba[y * stride + x] ?? 0;
      const left = x >= bpp ? (rgba[y * stride + x - bpp] ?? 0) : 0;
      const up = y > 0 ? (rgba[(y - 1) * stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= bpp ? (rgba[(y - 1) * stride + x - bpp] ?? 0) : 0;
      const pred = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][type] ?? 0;
      raw[y * (stride + 1) + 1 + x] = (v - pred) & 0xff;
    }
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('living-world PNG decoder and checks (synthetic PNGs)', () => {
  const width = 5;
  const height = 6;
  const pixels = Buffer.alloc(width * height * 4);
  const palette = [0x14110f, 0x8c4a2a, 0xd9822b, 0x9a6ad0, 0xddc9a3];
  for (let i = 0; i < width * height; i++) {
    const rgb = palette[i % palette.length] ?? 0;
    pixels[i * 4] = rgb >> 16;
    pixels[i * 4 + 1] = (rgb >> 8) & 0xff;
    pixels[i * 4 + 2] = rgb & 0xff;
    pixels[i * 4 + 3] = i % 7 === 0 ? 0 : 255;
  }

  it('round-trips every scanline filter type (0..4) back to the same pixels', () => {
    const png = encodePng(width, height, pixels, [0, 1, 2, 3, 4, 4]);
    const img = decodePng(png);
    expect(img.width).toBe(width);
    expect(img.height).toBe(height);
    expect(Buffer.compare(img.rgba, pixels)).toBe(0);
    expect(sheetProblems(img, width, height)).toEqual([]);
  });

  it('rejects a size mismatch, partial alpha and an off-palette colour', () => {
    const img = decodePng(encodePng(width, height, pixels, [0]));
    expect(sheetProblems(img, width + 1, height)).toEqual([`size ${width}x${height}, manifest ${width + 1}x${height}`]);
    const partial = Buffer.from(pixels);
    partial[3] = 128;
    expect(sheetProblems(decodePng(encodePng(width, height, partial, [0])), width, height)[0]).toMatch(/alpha/);
    const offColour = Buffer.from(pixels);
    offColour[0] = 0x12;
    offColour[1] = 0x34;
    offColour[2] = 0x56;
    offColour[3] = 255;
    expect(sheetProblems(decodePng(encodePng(width, height, offColour, [0])), width, height)[0]).toMatch(/#123456/);
  });

  it('accepts a restored-world colour only inside an allow-listed cell rect', () => {
    const green = Buffer.from(pixels);
    green[4] = PALETTE.green2 >> 16;             // pixel (1, 0)
    green[5] = (PALETTE.green2 >> 8) & 0xff;
    green[6] = PALETTE.green2 & 0xff;
    green[7] = 255;
    const img = decodePng(encodePng(width, height, green, [0]));
    const cell: AllowRect = { x: 0, y: 0, width: 2, height: 2, colours: RESTORED_COLOURS };
    expect(sheetProblems(img, width, height, [cell])).toEqual([]);
    expect(sheetProblems(img, width, height, [{ ...cell, x: 2 }])[0]).toMatch(/off-palette/);
    expect(sheetProblems(img, width, height)[0]).toMatch(/off-palette/);
  });

  it('refuses a PNG that is not 8-bit RGBA (colour type 2 here)', () => {
    const png = Buffer.from(encodePng(width, height, pixels, [0]));
    // IHDR colour type sits at byte 8 (signature) + 8 (length, type) + 9 (width, height, bit depth) = 25.
    png[25] = 2;
    expect(() => decodePng(png)).toThrow(/8-bit RGBA/);
  });
});

// Every living-world entry that has a file (the Art Director sets them with each PNG; all but world.shadow since AD3c).
const GATED: AssetId[] = ASSET_IDS.filter(
  (id) => (id.startsWith('world.') || id === 'bg.windowLit' || id === 'bg.virga') && ASSET_MANIFEST[id].file !== null,
);

describe('living-world PNG gate (WP23a)', () => {
  for (const id of GATED) {
    it(`${id}: 8-bit RGBA PNG at the manifest size, alpha 0/255, palette-only`, () => {
      const entry = ASSET_MANIFEST[id];
      const url = new URL(`../../public/assets/${entry.file ?? ''}`, import.meta.url);
      const img = decodePng(readFileSync(url));
      expect(sheetProblems(img, entry.width, entry.height, restoredRects(id)), id).toEqual([]);
    });
  }

  it('maps the allow-list to the finale cells: puddle whole and sprout bloom do use restored colours', () => {
    expect(GATED).toEqual(expect.arrayContaining(['world.puddle', 'world.sprout', 'bg.virga', 'world.splicesB', 'world.splicesC']));
    for (const id of ['world.puddle', 'world.sprout'] as const) {
      const entry = ASSET_MANIFEST[id];
      const img = decodePng(readFileSync(new URL(`../../public/assets/${entry.file ?? ''}`, import.meta.url)));
      const [cell] = restoredRects(id);
      expect(cell, id).toBeDefined();
      if (cell === undefined) continue;
      let restored = 0;
      for (let y = cell.y; y < cell.y + cell.height; y++) {
        for (let x = cell.x; x < cell.x + cell.width; x++) {
          const i = (y * img.width + x) * 4;
          const rgb = ((img.rgba[i] ?? 0) << 16) | ((img.rgba[i + 1] ?? 0) << 8) | (img.rgba[i + 2] ?? 0);
          if ((img.rgba[i + 3] ?? 0) === 255 && RESTORED_COLOURS.has(rgb)) restored++;
        }
      }
      expect(restored, id).toBeGreaterThan(0);
      // without the allow-list the same sheet fails: the restored colours are confined to that cell
      expect(sheetProblems(img, entry.width, entry.height), id).not.toEqual([]);
    }
  });
});
