import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// desktop/edition.cjs is CommonJS and shared with the packager, so it is loaded through require here.
const edition = createRequire(import.meta.url)('../../desktop/edition.cjs') as {
  editionOf(pkg: unknown): string;
  userDirName(e: string, packaged: boolean): string;
  windowTitle(e: string): string;
  appUserModelId(e: string): string;
};

const repoFile = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('editionOf', () => {
  it('reads the demo edition from the staged package.json', () => {
    expect(edition.editionOf({ wedtmdEdition: 'demo' })).toBe('demo');
  });

  it('falls back to the full game when the field is missing or not the demo marker', () => {
    expect(edition.editionOf({})).toBe('full');
    expect(edition.editionOf(null)).toBe('full');
    expect(edition.editionOf(undefined)).toBe('full');
    expect(edition.editionOf({ wedtmdEdition: 'full' })).toBe('full');
    expect(edition.editionOf('demo')).toBe('full');
  });
});

describe('userDirName', () => {
  it('gives the demo its own packaged save folder', () => {
    expect(edition.userDirName('demo', true)).toBe('WhatExactlyDoesThisMachineDo Demo');
    expect(edition.userDirName('full', true)).toBe('WhatExactlyDoesThisMachineDo');
  });

  it('adds the -dev suffix to unpackaged runs, demo included', () => {
    expect(edition.userDirName('demo', false)).toMatch(/Demo-dev$/);
    expect(edition.userDirName('full', false)).toBe('WhatExactlyDoesThisMachineDo-dev');
  });
});

describe('window title and app user model id', () => {
  it('differ between the editions', () => {
    expect(edition.windowTitle('demo')).not.toBe(edition.windowTitle('full'));
    expect(edition.appUserModelId('demo')).not.toBe(edition.appUserModelId('full'));
  });

  it('mark the demo in both values', () => {
    expect(edition.windowTitle('demo')).toMatch(/ Demo$/);
    expect(edition.appUserModelId('demo')).toMatch(/\.demo$/);
  });
});

describe('desktop shell wiring', () => {
  it('the packager stages edition.cjs and the demo marker, and builds into a per-edition vite folder', () => {
    const pkg = repoFile('../../scripts/desktop/package.mjs');
    expect(pkg).toContain('edition.cjs');
    expect(pkg).toContain('wedtmdEdition');
    expect(pkg).toContain('vite-${');
  });

  it('main.cjs loads edition.cjs and no longer hard-codes the user dir', () => {
    const main = repoFile('../../desktop/main.cjs');
    expect(main).toContain("require('./edition.cjs')");
    expect(main).not.toContain("const USER_DIR = 'WhatExactlyDoesThisMachineDo'");
  });

  it('main.cjs keeps the Steam store allowlist', () => {
    const main = repoFile('../../desktop/main.cjs');
    expect(main).toContain("const EXTERNAL_ALLOW = ['https://store.steampowered.com/', 'steam://'];");
  });
});
