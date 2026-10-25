// Living world save block (WP23a): lenient normaliser for the optional `world` block of save v2.
// Why: an old, hand-edited or future save must never fail a load, and the session must never share arrays with the caller.
// Pure: no Phaser, no DOM, no persistence imports. The id list and defaults come from src/data/livingWorld.ts.
import { DEFAULT_WORLD_SAVE, WORLD_KNOWN_IDS } from '../data/livingWorld';
import type { WorldSaveState } from '../data/livingWorld';

// Format limits of the save block (not balance numbers): list length, moments per era, bitmask width.
const MAX_IDS = 128;
const MAX_MOMENTS = 99;
const MAX_YOU_ERAS = 31;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A fresh copy of the default block: new arrays every call. */
function defaultWorld(): WorldSaveState {
  const [a, b, c, d, e] = DEFAULT_WORLD_SAVE.eraMoments;
  return {
    seen: [...DEFAULT_WORLD_SAVE.seen],
    seenEver: [...DEFAULT_WORLD_SAVE.seenEver],
    eraMoments: [a, b, c, d, e],
    youEras: DEFAULT_WORLD_SAVE.youEras,
  };
}

/**
 * Known ids from the given lists, in order: strings in WORLD_KNOWN_IDS only, first occurrence kept,
 * at most MAX_IDS. A non-array source contributes nothing.
 */
function idList(...sources: readonly unknown[]): string[] {
  const out: string[] = [];
  const have = new Set<string>();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const id of source) {
      if (out.length >= MAX_IDS) return out;
      if (typeof id !== 'string' || !WORLD_KNOWN_IDS.has(id) || have.has(id)) continue;
      have.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Five per-era counts: finite values are floored and clamped to 0..MAX_MOMENTS; any other entry is 0. */
function readMoments(raw: unknown): [number, number, number, number, number] {
  const list: unknown[] = Array.isArray(raw) ? raw : [];
  const at = (i: number): number => {
    const v = list[i];
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_MOMENTS, Math.max(0, Math.floor(v))) : 0;
  };
  return [at(0), at(1), at(2), at(3), at(4)];
}

/** Era bitmask: an integer clamped to 0..MAX_YOU_ERAS; anything else is 0. */
function readYouEras(raw: unknown): number {
  return typeof raw === 'number' && Number.isInteger(raw) ? Math.min(MAX_YOU_ERAS, Math.max(0, raw)) : 0;
}

/**
 * Lenient normaliser for the living-world block. Never throws and never returns its input.
 * A missing or non-object value gives a fresh copy of DEFAULT_WORLD_SAVE. `seen` keeps known ids (first kept,
 * capped); `seenEver` is the union of its own known ids and every id of `seen`, capped; `eraMoments` and
 * `youEras` are clamped (see the helpers above).
 */
export function normalizeWorld(raw: unknown): WorldSaveState {
  if (!isPlainObject(raw)) return defaultWorld();
  const seen = idList(raw['seen']);
  const seenEver = idList(raw['seenEver'], seen);
  return {
    seen,
    seenEver,
    eraMoments: readMoments(raw['eraMoments']),
    youEras: readYouEras(raw['youEras']),
  };
}
