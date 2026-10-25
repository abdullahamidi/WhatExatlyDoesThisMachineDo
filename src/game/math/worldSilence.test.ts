// Tests for worldSilence (WP23a): every hard-silence reason alone, the WORLD_SILENCE priority with several flags up, the
// toast gate durations (unlock 3200 + 250, milestone 6500 + 250, welcome 7000 + 250), a SYS LOG held until cleared, the era card
// marker, clearedAtMs semantics, reset, the wall-time elapse of a stopped director clock (asleep, tab hidden), and a purity check
// (no Phaser, no DOM). Pure maths, no Phaser.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { silenceReason, createToastGate, TOAST_GATE_CONFIG } from './worldSilence';
import type { SilenceInputs } from './worldSilence';
import { WORLD_SILENCE } from '../../data/livingWorld';
import type { WorldSilence } from '../../data/livingWorld';

const NONE: SilenceInputs = {
  quiet: false, layerHidden: false, asleep: false, tabHidden: false, photo: false, finaleLocked: false, cycleBusy: false,
  teaser: false, demoCard: false, techTree: false, modal: false, eraCard: false, onboarding: false,
};

// Each input flag with the reason it stands for, in WORLD_SILENCE order.
const PAIRS: readonly [keyof SilenceInputs, WorldSilence][] = [
  ['quiet', 'quiet'],
  ['layerHidden', 'layer-hidden'],
  ['asleep', 'asleep'],
  ['tabHidden', 'tab-hidden'],
  ['photo', 'photo'],
  ['finaleLocked', 'finale'],
  ['cycleBusy', 'cycle'],
  ['teaser', 'teaser'],
  ['demoCard', 'demo-card'],
  ['techTree', 'tech-index'],
  ['modal', 'modal'],
  ['eraCard', 'era-card'],
  ['onboarding', 'onboarding'],
];

function flags(...keys: (keyof SilenceInputs)[]): SilenceInputs {
  const out: SilenceInputs = { ...NONE };
  for (const k of keys) out[k] = true;
  return out;
}

describe('silenceReason', () => {
  it('returns null when no flag is up', () => {
    expect(silenceReason(NONE)).toBeNull();
  });

  it('maps each flag alone to its reason', () => {
    for (const [key, reason] of PAIRS) {
      expect(silenceReason(flags(key))).toBe(reason);
    }
  });

  it('keeps the flag table in WORLD_SILENCE order', () => {
    expect(PAIRS.map(([, r]) => r)).toEqual([...WORLD_SILENCE]);
  });

  it('returns the earlier reason in WORLD_SILENCE order for every pair of flags up', () => {
    for (let i = 0; i < PAIRS.length; i++) {
      for (let j = i + 1; j < PAIRS.length; j++) {
        const [ki, ri] = PAIRS[i]!;
        const [kj] = PAIRS[j]!;
        expect(silenceReason(flags(ki, kj))).toBe(ri);
      }
    }
  });

  it('reports quiet first when everything is up', () => {
    expect(silenceReason(flags(...PAIRS.map(([k]) => k)))).toBe('quiet');
  });

  it('reports layer-hidden when all but quiet are up', () => {
    expect(silenceReason(flags(...PAIRS.slice(1).map(([k]) => k)))).toBe('layer-hidden');
  });

  it('gives the modal reason before the era card and onboarding', () => {
    expect(silenceReason(flags('onboarding', 'eraCard', 'modal'))).toBe('modal');
  });

  it('gives the tab-hidden reason before photo and finale', () => {
    expect(silenceReason(flags('finaleLocked', 'photo', 'tabHidden'))).toBe('tab-hidden');
  });

  it('gives the TECH INDEX reason before the era card', () => {
    expect(silenceReason(flags('eraCard', 'techTree'))).toBe('tech-index');
  });
});

describe('createToastGate durations', () => {
  it('uses TOAST_CONFIG values with the fade added', () => {
    expect(TOAST_GATE_CONFIG).toEqual({ unlockMs: 3200, milestoneMs: 6500, welcomeMs: 7000, fadeMs: 250 });
  });

  it('keeps an unlock toast up for 3200 + 250 ms', () => {
    const g = createToastGate();
    g.onUnlock(1000);
    expect(g.up(1000)).toBe(true);
    expect(g.up(4449)).toBe(true);
    expect(g.up(4450)).toBe(false);
    expect(g.clearedAtMs()).toBe(4450);
  });

  it('keeps a milestone toast up for 6500 + 250 ms', () => {
    const g = createToastGate();
    g.onMilestone(0);
    expect(g.up(6749)).toBe(true);
    expect(g.up(6750)).toBe(false);
    expect(g.clearedAtMs()).toBe(6750);
  });

  it('keeps the welcome toast up for 7000 + 250 ms from its start', () => {
    const g = createToastGate();
    g.onWelcome(500);
    expect(g.up(500)).toBe(true);
    expect(g.up(7749)).toBe(true);
    expect(g.up(7750)).toBe(false);
    expect(g.clearedAtMs()).toBe(7750);
  });

  it('honours an injected config', () => {
    const g = createToastGate({ unlockMs: 100, milestoneMs: 200, welcomeMs: 300, fadeMs: 10 });
    g.onUnlock(0);
    expect(g.up(109)).toBe(true);
    expect(g.up(110)).toBe(false);
  });
});

describe('createToastGate state', () => {
  it('is quiet and never-cleared before any event', () => {
    const g = createToastGate();
    expect(g.up(0)).toBe(false);
    expect(g.up(1e9)).toBe(false);
    expect(g.clearedAtMs()).toBeNull();
  });

  it('stays up while a SYS LOG is shown, then ends at the clear instant', () => {
    const g = createToastGate();
    g.onLogShown(1000);
    expect(g.up(1000)).toBe(true);
    expect(g.up(999_999_999)).toBe(true);
    expect(g.clearedAtMs()).toBe(Infinity);
    g.onLogCleared(5000);
    expect(g.up(4999)).toBe(true);
    expect(g.up(5000)).toBe(false);
    expect(g.clearedAtMs()).toBe(5000);
  });

  it('ignores a clear when no SYS LOG is up', () => {
    const g = createToastGate();
    g.onLogCleared(5000);
    expect(g.up(5000)).toBe(false);
    expect(g.clearedAtMs()).toBeNull();
  });

  it('ends the era-card marker at the closing instant', () => {
    const g = createToastGate();
    g.onEraCardClosed(2000);
    expect(g.up(2000)).toBe(false);
    expect(g.clearedAtMs()).toBe(2000);
  });

  it('reports the latest end across toast kinds in clearedAtMs', () => {
    const g = createToastGate();
    g.onUnlock(0); // ends 3450
    expect(g.clearedAtMs()).toBe(3450);
    g.onMilestone(1000); // ends 7750
    expect(g.clearedAtMs()).toBe(7750);
    g.onUnlock(2000); // ends 5450, earlier than the milestone still up
    expect(g.clearedAtMs()).toBe(7750);
  });

  it('is up while any tracked toast is still on screen', () => {
    const g = createToastGate();
    g.onUnlock(0); // ends 3450
    g.onMilestone(1000); // ends 7750
    expect(g.up(3500)).toBe(true);
    expect(g.up(7749)).toBe(true);
    expect(g.up(7750)).toBe(false);
  });

  it('keeps a SYS LOG and an unlock up together, then releases the log at its clear', () => {
    const g = createToastGate();
    g.onLogShown(0);
    g.onUnlock(100); // ends 3550
    g.onLogCleared(2000);
    expect(g.up(2000)).toBe(true);
    expect(g.up(3549)).toBe(true);
    expect(g.up(3550)).toBe(false);
    expect(g.clearedAtMs()).toBe(3550);
  });

  it('forgets everything on reset', () => {
    const g = createToastGate();
    g.onUnlock(0);
    g.onLogShown(0);
    g.onEraCardClosed(10);
    g.reset();
    expect(g.up(5)).toBe(false);
    expect(g.clearedAtMs()).toBeNull();
  });
});

describe('createToastGate elapse (stopped director clock)', () => {
  it('keeps an unlock toast up after 1 s of wall time while the clock was stopped', () => {
    const g = createToastGate();
    g.onUnlock(0); // ends 3450 on the director clock
    g.elapse(1000);
    expect(g.up(1)).toBe(true);
    expect(g.up(2449)).toBe(true);
    expect(g.up(2450)).toBe(false);
    expect(g.clearedAtMs()).toBe(2450);
  });

  it('ends every timed toast at once after a long stop and moves clearedAtMs earlier', () => {
    const g = createToastGate();
    g.onUnlock(0); // ends 3450
    expect(g.clearedAtMs()).toBe(3450);
    g.elapse(60000);
    expect(g.up(0)).toBe(false);
    expect(g.clearedAtMs()).toBe(3450 - 60000);
  });

  it('moves the milestone, welcome and era slots earlier too', () => {
    const g = createToastGate();
    g.onMilestone(0); // ends 6750
    g.onWelcome(0); // ends 7250
    g.onEraCardClosed(4000);
    g.elapse(1000);
    expect(g.clearedAtMs()).toBe(7250 - 1000);
    expect(g.up(6249)).toBe(true);
    expect(g.up(6250)).toBe(false);
  });

  it('leaves a SYS LOG slot at Infinity unchanged', () => {
    const g = createToastGate();
    g.onLogShown(0);
    g.elapse(5000);
    expect(g.up(999_999_999)).toBe(true);
    expect(g.clearedAtMs()).toBe(Infinity);
  });

  it('moves a SYS LOG clear instant earlier once it has cleared', () => {
    const g = createToastGate();
    g.onLogShown(0);
    g.onLogCleared(5000);
    g.elapse(1000);
    expect(g.clearedAtMs()).toBe(4000);
    expect(g.up(3999)).toBe(true);
    expect(g.up(4000)).toBe(false);
  });

  it('treats elapse(0), a negative and a non-finite amount as no-ops', () => {
    const g = createToastGate();
    g.onUnlock(0);
    g.elapse(0);
    expect(g.clearedAtMs()).toBe(3450);
    g.elapse(-500);
    expect(g.clearedAtMs()).toBe(3450);
    g.elapse(Number.NaN);
    g.elapse(Number.POSITIVE_INFINITY);
    expect(g.clearedAtMs()).toBe(3450);
  });

  it('keeps null slots null (nothing ever showed)', () => {
    const g = createToastGate();
    g.elapse(1000);
    expect(g.clearedAtMs()).toBeNull();
    expect(g.up(0)).toBe(false);
  });
});

describe('worldSilence purity', () => {
  it('stays free of Phaser and DOM globals', () => {
    const src = readFileSync(new URL('./worldSilence.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*phaser/i);
    expect(src).not.toContain('document.');
    expect(src).not.toContain('window.');
  });
});
