import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { ASSET_IDS } from './assetIds';
import type { AssetId } from './assetIds';
import { ASSET_MANIFEST } from './manifest';
import type { AssetEntry } from './manifest';
import { MACHINE_COMPONENTS, MACHINE_LAYER_DEPTH } from '../data/machineComponents';
import { PARALLAX_LAYERS, GROUND_LAYER } from '../data/world';
import { TECHNOLOGIES } from '../data/technologies';

// Guard for docs/ASSET_GUIDE.md: one correct table row per manifest id.
// Layer and description cells are informational (not asserted).
// Regenerate the table: ASSET_GUIDE_OUT=<abs path> npx vitest run src/assets/assetGuide.test.ts

const GUIDE_URL = new URL('../../docs/ASSET_GUIDE.md', import.meta.url);
const TABLE_HEADER =
  '| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |';
const TABLE_SEPARATOR = '|---|---|---|---|---|---|---|---|';

interface GuideRow {
  id: string;
  file: string;
  size: string;
  origin: string;
  tileable: string;
  frames: string;
  layer: string;
  description: string;
}

const ERA_GROUPS: readonly { era: number; label: string }[] = [
  { era: 1, label: 'Machine — Era I' },
  { era: 2, label: 'Machine — Era II' },
  { era: 3, label: 'Machine — Era III' },
  { era: 4, label: 'Machine — Era IV' },
  { era: 5, label: 'Machine — Era V' },
];

/** Placement text for ids that are neither machine parts nor parallax / ground layers. */
const PLACEMENT_NOTES: Partial<Record<AssetId, string>> = {
  'fx.dust': 'dust field (DUST), world depth 200',
  'fx.steam': 'reserved: no renderer (live steam uses fx.steamPuff / fx.smoke)',
  'fx.steamPuff': 'steam emitters (STEAM_EMITTERS), world depth 101',
  'fx.smoke': 'chimney smoke (STEAM_EMITTERS), world depth 101',
  'fx.beam': 'aperture beam (APERTURE_BEAM), world depth 101',
  'fx.beamWhite': 'finale white beam (FINALE_BEAM)',
  'fx.seed': 'finale seeds (FINALE_SEEDS), world depth 200',
  'fx.bird': 'finale birds (FINALE_BIRDS)',
  'bg.eclipse': 'eclipse in the sky (ECLIPSE), world depth -98',
  'bg.regrowth1': 'finale regrowth (FINALE wipe), world depth 2',
  'bg.regrowth2': 'finale regrowth (FINALE wipe), world depth 2',
  'bg.regrowth3': 'finale regrowth (FINALE wipe), world depth 2',
  'terrain.groundGreen': 'restored ground (RESTORED_GROUND), world depth 0.5',
  'ui.nameplate': 'DOM UI (CSS background image)',
  'ui.panel': 'DOM UI (CSS background image)',
  'ui.button': 'DOM UI (CSS background image)',
  'ui.icons16': 'DOM UI (CSS background image)',
};

function readGuideOrNull(): string | null {
  try {
    return readFileSync(GUIDE_URL, 'utf8');
  } catch {
    return null;
  }
}

/** Parses every table row (lines starting with "| `") into its 8 cells. Escaped pipes (`\|`) do not split. */
function parseGuideRows(md: string): GuideRow[] {
  const rows: GuideRow[] = [];
  for (const line of md.split(/\r?\n/)) {
    if (!line.startsWith('| `')) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 8) {
      throw new Error(`ASSET_GUIDE row has ${cells.length} cells, expected 8: ${line}`);
    }
    const [id = '', file = '', size = '', origin = '', tileable = '', frames = '', layer = '', description = ''] = cells;
    rows.push({ id: id.replace(/`/g, ''), file, size, origin, tileable, frames, layer, description });
  }
  return rows;
}

function guideRow(rows: readonly GuideRow[], id: string): GuideRow[] {
  return rows.filter((row) => row.id === id);
}

function machineComponentsFor(id: AssetId) {
  return Object.values(MACHINE_COMPONENTS).filter((c) => c.assetId === id);
}

function machineEra(id: AssetId): number {
  const eras = machineComponentsFor(id).map((c) => TECHNOLOGIES[c.techId].era);
  if (eras.length === 0) throw new Error(`no machine component uses ${id}`);
  return Math.min(...eras);
}

function fileCell(entry: AssetEntry): string {
  if (entry.file === null) return 'none (procedural)';
  let cell = `\`${entry.file}\``;
  if (entry.restored) {
    const rotation = entry.restored.rotationFile ? `, \`${entry.restored.rotationFile}\`` : '';
    cell += ` (restored \`${entry.restored.file}\`${rotation})`;
  }
  return cell;
}

function sizeCell(entry: AssetEntry): string {
  return `${entry.width} x ${entry.height}`;
}

function originCell(entry: AssetEntry): string {
  return `${entry.origin.x}, ${entry.origin.y}`;
}

function framesCell(entry: AssetEntry): string {
  const parts: string[] = [];
  if (entry.frame) parts.push(`${entry.frame.count} (${entry.frame.width} x ${entry.frame.height})`);
  if (entry.rotation) parts.push(`rot ${entry.rotation.frames} (\`${entry.rotation.file}\`)`);
  return parts.length > 0 ? parts.join('; ') : 'none';
}

function layerCell(id: AssetId): string {
  if (id.startsWith('machine.')) {
    const parts = [
      ...new Set(
        machineComponentsFor(id).map(
          (c) => `machine layer \`${c.layer}\`, depth ${MACHINE_LAYER_DEPTH[c.layer] + (c.depthBias ?? 0)}`,
        ),
      ),
    ];
    if (parts.length === 0) throw new Error(`no machine component uses ${id}`);
    return parts.join('; ');
  }
  const parallax = PARALLAX_LAYERS.filter((layer) => layer.assetId === id).map(
    (layer) => `parallax \`${layer.id}\`, scroll ${layer.scrollFactor}, world depth ${layer.depth}`,
  );
  if (parallax.length > 0) return parallax.join('; ');
  if (id === GROUND_LAYER.assetId) return `ground, world depth ${GROUND_LAYER.depth}`;
  const note = PLACEMENT_NOTES[id];
  if (note === undefined) throw new Error(`no placement source for ${id}`);
  return note;
}

function guideRowLine(id: AssetId): string {
  const entry = ASSET_MANIFEST[id];
  const description = entry.description.replace(/\|/g, '\\|');
  return `| \`${id}\` | ${fileCell(entry)} | ${sizeCell(entry)} | ${originCell(entry)} | ${entry.tileable} | ${framesCell(entry)} | ${layerCell(id)} | ${description} |`;
}

function guideGroup(label: string, ids: readonly AssetId[]): string {
  return [`### ${label}`, '', TABLE_HEADER, TABLE_SEPARATOR, ...ids.map(guideRowLine)].join('\n') + '\n';
}

/** Whole generated block (the content between the asset-table markers). */
function guideTables(): string {
  const world = ASSET_IDS.filter((id) => id.startsWith('bg.') || id.startsWith('terrain.'));
  const machine = ASSET_IDS.filter((id) => id.startsWith('machine.'));
  const fx = ASSET_IDS.filter((id) => id.startsWith('fx.'));
  const ui = ASSET_IDS.filter((id) => id.startsWith('ui.'));
  if (world.length + machine.length + fx.length + ui.length !== ASSET_IDS.length) {
    throw new Error('ASSET_IDS has an id outside the bg/terrain/machine/fx/ui groups');
  }
  const groups: { label: string; ids: AssetId[] }[] = [{ label: 'World', ids: world }];
  for (const group of ERA_GROUPS) {
    groups.push({ label: group.label, ids: machine.filter((id) => machineEra(id) === group.era) });
  }
  groups.push({ label: 'FX', ids: fx }, { label: 'UI', ids: ui });
  return groups
    .filter((group) => group.ids.length > 0)
    .map((group) => guideGroup(group.label, group.ids))
    .join('\n');
}

const guide = readGuideOrNull();

describe.skipIf(guide === null)('docs/ASSET_GUIDE.md', () => {
  const md = guide ?? '';

  it('has exactly one table row per manifest id', () => {
    const rows = parseGuideRows(md);
    const mismatches: string[] = [];
    for (const id of ASSET_IDS) {
      const count = guideRow(rows, id).length;
      if (count !== 1) mismatches.push(`${id}: ${count} rows, expected 1`);
    }
    expect(mismatches).toEqual([]);
  });

  it('file cell matches the manifest file (or says none for procedural ids)', () => {
    const rows = parseGuideRows(md);
    const mismatches: string[] = [];
    for (const id of ASSET_IDS) {
      const [row] = guideRow(rows, id);
      if (!row) continue;
      const entry = ASSET_MANIFEST[id];
      if (entry.file === null) {
        if (!row.file.startsWith('none')) mismatches.push(`${id}: file cell "${row.file}", expected none`);
      } else if (!row.file.includes(`\`${entry.file}\``)) {
        mismatches.push(`${id}: file cell "${row.file}", expected \`${entry.file}\``);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('size cell is the manifest width x height', () => {
    const rows = parseGuideRows(md);
    const mismatches: string[] = [];
    for (const id of ASSET_IDS) {
      const [row] = guideRow(rows, id);
      if (!row) continue;
      const expected = sizeCell(ASSET_MANIFEST[id]);
      if (row.size !== expected) mismatches.push(`${id}: size cell "${row.size}", expected "${expected}"`);
    }
    expect(mismatches).toEqual([]);
  });

  it('frames cell matches the manifest frame count and rotation file', () => {
    const rows = parseGuideRows(md);
    const mismatches: string[] = [];
    for (const id of ASSET_IDS) {
      const [row] = guideRow(rows, id);
      if (!row) continue;
      const { frame, rotation } = ASSET_MANIFEST[id];
      if (frame) {
        const expected = `${frame.count} (${frame.width} x ${frame.height})`;
        if (!row.frames.includes(expected)) mismatches.push(`${id}: frames cell "${row.frames}", expected "${expected}"`);
      }
      if (rotation && !row.frames.includes(rotation.file)) {
        mismatches.push(`${id}: frames cell "${row.frames}", expected rotation file ${rotation.file}`);
      }
      if (!frame && !rotation && row.frames !== 'none') {
        mismatches.push(`${id}: frames cell "${row.frames}", expected none`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every table row id is a manifest id', () => {
    const manifestIds = new Set<string>(Object.keys(ASSET_MANIFEST));
    const mismatches = parseGuideRows(md)
      .filter((row) => !manifestIds.has(row.id))
      .map((row) => `${row.id}: not a manifest id`);
    expect(mismatches).toEqual([]);
  });
});

// Writer: only when ASSET_GUIDE_OUT is set (never writes into the repo by default).
describe('docs/ASSET_GUIDE.md table writer', () => {
  it('writes the generated table block to ASSET_GUIDE_OUT when set', () => {
    const out = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['ASSET_GUIDE_OUT'];
    if (!out) return;
    writeFileSync(out, guideTables());
  });
});
