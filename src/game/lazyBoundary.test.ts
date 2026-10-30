// WP28a lazy boundary (G step 4b as a unit test): the reach maths and data (the Splice, Find and poke modules) reach the app only
// through the lazy World chunk. Every src/**/*.ts file that imports one of them is a test file, one of those modules, or one of the
// lazy renderers below. Node fs and path only, no Phaser: the import specifiers are read from the source text.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// src/ (this file sits in src/game/).
const SRC_DIR = fileURLToPath(new URL('../', import.meta.url));
// An import specifier that contains one of these substrings is a reach import.
const REACH_SPECIFIERS = [
  'reachLevel', 'data/worldReach', 'data/spliceWorld', 'data/pokes', 'data/findWorld', 'math/spliceWorld', 'math/pokes',
  'math/findMarker', 'math/worldReach', 'math/pokeRender',
  // WP28b r1-FX1: the shared and Director-only reach data and maths (the lazy chunks split on them), and PokeLayer's pick maths.
  'data/worldShared', 'data/findProducer', 'data/worldFx', 'math/worldFx', 'math/reachWave', 'math/pokePick',
];
// The lazy renderers and wiring of the World chunk: the only non-module files that may import a reach module (by file name).
const LAZY_IMPORTERS = [
  'LivingWorldDirector.ts', 'LivingWorld.ts', 'WorldProps.ts', 'SpliceProps.ts', 'SpliceLines.ts', 'WorldReach.ts', 'FindMarker.ts',
  'PokeLayer.ts', 'ReachFx.ts',
];
// The static import and re-export forms with a from clause, the dynamic import() and the bare import of a module (one statement per match).
const SPECIFIER_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]/g;

/** Every .ts file under a directory, depth first. */
function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSources(full));
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** The import specifiers of a source text that contain a reach substring. */
function reachImports(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const spec = match[1] ?? match[2] ?? match[3] ?? '';
    if (REACH_SPECIFIERS.some((s) => spec.includes(s))) found.push(spec);
  }
  return found;
}

/** The path of a file under the repo's src folder, with forward slashes (src/...). */
function srcPath(file: string): string {
  return `src/${relative(SRC_DIR, file).split(sep).join('/')}`;
}

describe('lazy boundary: the reach modules load only in the World chunk', () => {
  const files = listSources(SRC_DIR);

  it('scans the source tree', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('finds the lazy importers (the scan reads the import specifiers)', () => {
    const importers = files.filter((file) => reachImports(readFileSync(file, 'utf8')).length > 0).map(srcPath);
    expect(importers.some((p) => LAZY_IMPORTERS.includes(basename(p)))).toBe(true);
  });

  it('only tests, the reach modules and the lazy renderers import a reach module', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const path = srcPath(file);
      if (path.endsWith('.test.ts')) continue;
      if (REACH_SPECIFIERS.some((s) => path.includes(s))) continue;
      if (LAZY_IMPORTERS.includes(basename(path))) continue;
      for (const spec of reachImports(readFileSync(file, 'utf8'))) offenders.push(`${path} imports '${spec}'`);
    }
    expect(offenders).toEqual([]);
  });
});
