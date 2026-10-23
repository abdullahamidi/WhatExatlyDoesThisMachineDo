import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { EDITIONS, STEAM_STORE, capReached, editionFor } from './edition';
import { TECHNOLOGIES } from './technologies';
import { TECH_IDS } from './types';
import type { TechId } from './types';

// The desktop shell only opens URLs whose prefix is in main.cjs EXTERNAL_ALLOW; read them from there so the two lists cannot drift.
function externalAllowPrefixes(): string[] {
  const src = readFileSync(fileURLToPath(new URL('../../desktop/main.cjs', import.meta.url)), 'utf8');
  const start = src.indexOf('EXTERNAL_ALLOW = [');
  expect(start).toBeGreaterThanOrEqual(0);
  const body = src.slice(start + 'EXTERNAL_ALLOW = ['.length, src.indexOf(']', start));
  const prefixes = body.split("'").filter((_, i) => i % 2 === 1);
  expect(prefixes.length).toBeGreaterThanOrEqual(2);
  return prefixes;
}

describe('editionFor', () => {
  it('returns the demo edition only for the exact mode demo', () => {
    expect(editionFor('demo')).toBe(EDITIONS.demo);
  });

  it.each(['production', 'development', 'test', '', 'DEMO', undefined])('falls back to the full edition for %s', (mode) => {
    expect(editionFor(mode)).toBe(EDITIONS.full);
  });
});

describe('EDITIONS', () => {
  it('demo caps progression at the Substation Blueprint era II', () => {
    const demo = EDITIONS.demo;
    expect(demo.demo).toBe(true);
    expect(demo.capTech).toBe('substationBlueprint');
    expect(demo.maxEra).toBe(2);
    expect(demo.label).toBe('DEMO');
    const cap = demo.capTech ? TECHNOLOGIES[demo.capTech] : undefined;
    expect(cap?.kind).toBe('milestone');
    expect(cap?.era).toBe(demo.maxEra);
  });

  it('full has no cap, no label and is not a demo', () => {
    const full = EDITIONS.full;
    expect(full.id).toBe('full');
    expect(full.demo).toBe(false);
    expect(full.capTech).toBeNull();
    expect(full.maxEra).toBeNull();
    expect(full.label).toBeNull();
  });

  it('builds store and steam urls from STEAM_STORE', () => {
    for (const edition of [EDITIONS.full, EDITIONS.demo]) {
      expect(edition.storeUrl).toBe(STEAM_STORE.storeUrl);
      expect(edition.steamUrl).toBe(STEAM_STORE.steamUrl);
      expect(edition.storeUrl).toContain(STEAM_STORE.appId);
      expect(edition.steamUrl).toContain(STEAM_STORE.appId);
    }
  });

  it('every non-null url starts with an EXTERNAL_ALLOW prefix of the desktop shell', () => {
    const prefixes = externalAllowPrefixes();
    for (const edition of [EDITIONS.full, EDITIONS.demo]) {
      for (const url of [edition.storeUrl, edition.steamUrl, edition.feedbackUrl]) {
        if (url === null) continue;
        expect(prefixes.some((prefix) => url.startsWith(prefix))).toBe(true);
      }
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(EDITIONS.full)).toBe(true);
    expect(Object.isFrozen(EDITIONS.demo)).toBe(true);
    expect(Object.isFrozen(EDITIONS)).toBe(true);
  });
});

describe('capReached', () => {
  // Built from TECH_IDS (as machineComponents.test.ts does) so the data layer does not import the simulation.
  const base = {} as Record<TechId, number>;
  for (const id of TECH_IDS) base[id] = 0;

  it('is true once the demo cap tech reaches level 1', () => {
    expect(capReached({ ...base, substationBlueprint: 1 }, 'substationBlueprint')).toBe(true);
  });

  it('is false while the cap tech is still at level 0', () => {
    expect(capReached(base, 'substationBlueprint')).toBe(false);
  });

  it('is false when there is no cap tech (full game)', () => {
    expect(capReached({ ...base, substationBlueprint: 1 }, null)).toBe(false);
    expect(capReached({ ...base, substationBlueprint: 1 }, EDITIONS.full.capTech)).toBe(false);
  });
});
