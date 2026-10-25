// Tests for worldTierRules (WP23a): the stub port values, the 4 s ripple gap, the Inspector and Sensor 7 notices on every beat,
// the lamp flicker techs, the DOG-04 offer only at improvedPistons tier 3 (a 2 -> 4 jump offers it once), DOG-04 and INS-13
// once per cycle from a partEvolved event and from a TECH INDEX close, the heartbeat state, the 10 s ear-flick gap, reset, injected
// gaps, and a purity check (no Phaser). Pure maths, no Phaser.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createTierTracker, STUB_TIER_PORT } from './worldTierRules';
import type { TierPort } from './worldTierRules';
import type { PartEvolvedEvent, PartTorquedEvent } from '../context';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';

function levelsOf(over: Partial<Record<TechId, number>> = {}): Record<TechId, number> {
  const out = {} as Record<TechId, number>;
  for (const id of TECH_IDS) out[id] = over[id] ?? 0;
  return out;
}

function evo(over: Partial<PartEvolvedEvent> = {}): PartEvolvedEvent {
  return { techId: 'gearRatio', fromTier: 1, toTier: 2, topTier: 5, hosts: [], ...over };
}

function torque(over: Partial<PartTorquedEvent> = {}): PartTorquedEvent {
  return { techId: 'gearRatio', host: 'gearSmall', step: 1, ...over };
}

// A port whose anyTop answer the test controls.
function portWithTop(top: () => boolean): TierPort {
  return { ...STUB_TIER_PORT, anyTop: () => top() };
}

// A port whose improvedPistons tier the test controls (other parts stay at tier 1), and whose anyTop the test may control.
function portWithDogTier(tier: () => number, top: () => boolean = () => false): TierPort {
  return { ...STUB_TIER_PORT, anyTop: () => top(), tierOf: (id) => (id === 'improvedPistons' ? tier() : 1) };
}

describe('STUB_TIER_PORT', () => {
  it('reports tier 1, top 5, never any top, LED never low', () => {
    const levels = levelsOf({ improvedPistons: 50, copperWinding: 50 });
    expect(STUB_TIER_PORT.tierOf('gearRatio', levels)).toBe(1);
    expect(STUB_TIER_PORT.topTier('gearRatio')).toBe(5);
    expect(STUB_TIER_PORT.anyTop(levels)).toBe(false);
    expect(STUB_TIER_PORT.heartbeatLow(0)).toBe(false);
    expect(STUB_TIER_PORT.heartbeatLow(1e9)).toBe(false);
  });
});

describe('onEvolved notices and ripple', () => {
  it('ticks the Inspector sheet and blinks Sensor 7 on every beat', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    for (const now of [0, 100, 9000]) {
      const fx = t.onEvolved(evo(), now);
      expect(fx.sheetTick).toBe(true);
      expect(fx.sensorBlink).toBe(true);
    }
  });

  it('plays a ripple on the first beat', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    expect(t.onEvolved(evo(), 0).ripple).toBe(true);
  });

  it('holds ripples to one per 4000 ms outside the tree', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    expect(t.onEvolved(evo(), 0).ripple).toBe(true);
    expect(t.onEvolved(evo(), 3999).ripple).toBe(false);
    expect(t.onEvolved(evo(), 4000).ripple).toBe(true);
    expect(t.onEvolved(evo(), 4500).ripple).toBe(false);
    expect(t.onEvolved(evo(), 8000).ripple).toBe(true);
  });

  it('does not record a suppressed ripple, so the gap runs from the last one played', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    t.onEvolved(evo(), 1000);
    expect(t.onEvolved(evo(), 2000).ripple).toBe(false);
    expect(t.onEvolved(evo(), 4999).ripple).toBe(false);
    expect(t.onEvolved(evo(), 5000).ripple).toBe(true);
  });

  it('gives the lamp flicker to copperWinding and transformer only', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    expect(t.onEvolved(evo({ techId: 'copperWinding' }), 0).lampFlicker).toBe(true);
    expect(t.onEvolved(evo({ techId: 'transformer' }), 10000).lampFlicker).toBe(true);
    expect(t.onEvolved(evo({ techId: 'gearRatio' }), 20000).lampFlicker).toBe(false);
    expect(t.onEvolved(evo({ techId: 'improvedPistons' }), 30000).lampFlicker).toBe(false);
  });
});

describe('onEvolved DOG-04 offer', () => {
  it('offers the dog line when improvedPistons reaches tier 3', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    const fx = t.onEvolved(evo({ techId: 'improvedPistons', fromTier: 2, toTier: 3 }), 0);
    expect(fx.offers).toEqual([{ kind: 'tier', techId: 'improvedPistons', tier: 3 }]);
  });

  it('offers nothing below or past tier 3', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    expect(t.onEvolved(evo({ techId: 'improvedPistons', fromTier: 1, toTier: 2 }), 0).offers).toEqual([]);
    expect(t.onEvolved(evo({ techId: 'improvedPistons', fromTier: 3, toTier: 4 }), 10000).offers).toEqual([]);
  });

  it('offers tier 3 once for a 2 -> 4 jump', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    const fx = t.onEvolved(evo({ techId: 'improvedPistons', fromTier: 2, toTier: 4 }), 0);
    expect(fx.offers).toEqual([{ kind: 'tier', techId: 'improvedPistons', tier: 3 }]);
  });

  it('never offers the dog line for another part', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    expect(t.onEvolved(evo({ techId: 'gearRatio', fromTier: 2, toTier: 4 }), 0).offers).toEqual([]);
  });
});

describe('onEvolved first top tier (INS-13)', () => {
  it('offers firstTop once per cycle from a top-tier event', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    const first = t.onEvolved(evo({ fromTier: 4, toTier: 5, topTier: 5 }), 0);
    expect(first.offers).toEqual([{ kind: 'tier', firstTop: true }]);
    const second = t.onEvolved(evo({ techId: 'powerLines', fromTier: 4, toTier: 5, topTier: 5 }), 10000);
    expect(second.offers).toEqual([]);
  });

  it('offers nothing before the top tier', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    const fx = t.onEvolved(evo({ fromTier: 3, toTier: 4, topTier: 5 }), 0);
    expect(fx.offers).toEqual([]);
    expect(fx.heartbeat).toBe(false);
  });

  it('turns the heartbeat on with the first top tier and keeps it on', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    expect(t.onEvolved(evo({ fromTier: 4, toTier: 5, topTier: 5 }), 0).heartbeat).toBe(true);
    expect(t.heartbeat()).toBe(true);
    expect(t.onEvolved(evo({ toTier: 2 }), 10000).heartbeat).toBe(true);
    expect(t.heartbeat()).toBe(true);
  });

  it('keeps the heartbeat off until a top tier', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    t.onEvolved(evo({ toTier: 3 }), 0);
    expect(t.heartbeat()).toBe(false);
  });
});

describe('onIndexClose first top tier', () => {
  it('offers nothing with the stub port (never any top)', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    const fx = t.onIndexClose(levelsOf({ gearRatio: 99 }), 0);
    expect(fx.offers).toEqual([]);
    expect(fx.heartbeat).toBe(false);
    expect(t.heartbeat()).toBe(false);
  });

  it('offers firstTop once when a part is at top after an over-cap swap', () => {
    let top = false;
    const t = createTierTracker(portWithTop(() => top));
    expect(t.onIndexClose(levelsOf(), 0).offers).toEqual([]);
    top = true;
    const fx = t.onIndexClose(levelsOf({ gearRatio: 80 }), 2500);
    expect(fx.offers).toEqual([{ kind: 'tier', firstTop: true }]);
    expect(fx.heartbeat).toBe(true);
    expect(t.onIndexClose(levelsOf({ gearRatio: 80 }), 5000).offers).toEqual([]);
  });

  it('keeps every one-shot effect false', () => {
    const t = createTierTracker(portWithTop(() => true));
    const fx = t.onIndexClose(levelsOf(), 0);
    expect(fx.ripple).toBe(false);
    expect(fx.lampFlicker).toBe(false);
    expect(fx.sheetTick).toBe(false);
    expect(fx.sensorBlink).toBe(false);
  });

  it('passes the levels record to anyTop', () => {
    let seen: Readonly<Record<TechId, number>> | null = null;
    const port: TierPort = { ...STUB_TIER_PORT, anyTop: (lv) => { seen = lv; return false; } };
    const levels = levelsOf({ gearRatio: 3 });
    createTierTracker(port).onIndexClose(levels, 0);
    expect(seen).toBe(levels);
  });

  it('does not offer again after an event already claimed firstTop', () => {
    const t = createTierTracker(portWithTop(() => true));
    expect(t.onEvolved(evo({ fromTier: 4, toTier: 5, topTier: 5 }), 0).offers).toEqual([{ kind: 'tier', firstTop: true }]);
    const fx = t.onIndexClose(levelsOf(), 3000);
    expect(fx.offers).toEqual([]);
    expect(fx.heartbeat).toBe(true);
  });

  it('does not record a ripple, so the next beat still ripples', () => {
    const t = createTierTracker(portWithTop(() => true));
    t.onIndexClose(levelsOf(), 0);
    expect(t.onEvolved(evo(), 0).ripple).toBe(true);
  });
});

describe('onIndexClose DOG-04 offer', () => {
  it('offers the dog line once when improvedPistons is at tier 3 on a close', () => {
    let tier = 3;
    const t = createTierTracker(portWithDogTier(() => tier));
    expect(t.onIndexClose(levelsOf({ improvedPistons: 30 }), 0).offers).toEqual([{ kind: 'tier', techId: 'improvedPistons', tier: 3 }]);
    tier = 4;
    expect(t.onIndexClose(levelsOf({ improvedPistons: 40 }), 2500).offers).toEqual([]);
  });

  it('does not offer the dog line again after onEvolved already offered it', () => {
    const t = createTierTracker(portWithDogTier(() => 3));
    expect(t.onEvolved(evo({ techId: 'improvedPistons', fromTier: 2, toTier: 3 }), 0).offers).toEqual([{ kind: 'tier', techId: 'improvedPistons', tier: 3 }]);
    expect(t.onIndexClose(levelsOf({ improvedPistons: 30 }), 2500).offers).toEqual([]);
  });

  it('offers the dog line again after reset, whichever path offered it first', () => {
    const t = createTierTracker(portWithDogTier(() => 3));
    expect(t.onIndexClose(levelsOf(), 0).offers).toEqual([{ kind: 'tier', techId: 'improvedPistons', tier: 3 }]);
    t.reset();
    expect(t.onIndexClose(levelsOf(), 0).offers).toEqual([{ kind: 'tier', techId: 'improvedPistons', tier: 3 }]);
    t.onEvolved(evo({ techId: 'improvedPistons', fromTier: 2, toTier: 3 }), 0);
    t.reset();
    expect(t.onIndexClose(levelsOf(), 0).offers).toEqual([{ kind: 'tier', techId: 'improvedPistons', tier: 3 }]);
  });

  it('offers nothing while improvedPistons is below tier 3', () => {
    const t = createTierTracker(portWithDogTier(() => 2));
    expect(t.onIndexClose(levelsOf({ improvedPistons: 20 }), 0).offers).toEqual([]);
    expect(t.onIndexClose(levelsOf({ improvedPistons: 20 }), 2500).offers).toEqual([]);
  });

  it('gives firstTop and the dog offer on the same close when a part is at top and improvedPistons is at tier 3', () => {
    const t = createTierTracker(portWithDogTier(() => 3, () => true));
    expect(t.onIndexClose(levelsOf({ improvedPistons: 30 }), 0).offers).toEqual([
      { kind: 'tier', firstTop: true },
      { kind: 'tier', techId: 'improvedPistons', tier: 3 },
    ]);
  });
});

describe('onTorqued ear flick', () => {
  it('flicks on the first torque and then at most once per 10000 ms', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    expect(t.onTorqued(torque(), 0).earFlick).toBe(true);
    expect(t.onTorqued(torque(), 5000).earFlick).toBe(false);
    expect(t.onTorqued(torque(), 9999).earFlick).toBe(false);
    expect(t.onTorqued(torque(), 10000).earFlick).toBe(true);
    expect(t.onTorqued(torque(), 15000).earFlick).toBe(false);
    expect(t.onTorqued(torque(), 20000).earFlick).toBe(true);
  });

  it('does not share its gap with the ripple', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    t.onTorqued(torque(), 0);
    expect(t.onEvolved(evo(), 0).ripple).toBe(true);
  });
});

describe('heartbeat and reset', () => {
  it('is off before any top tier', () => {
    expect(createTierTracker(STUB_TIER_PORT).heartbeat()).toBe(false);
  });

  it('forgets the first top tier and the gaps on reset', () => {
    const t = createTierTracker(STUB_TIER_PORT);
    t.onEvolved(evo({ fromTier: 4, toTier: 5, topTier: 5 }), 1000);
    t.onTorqued(torque(), 1000);
    expect(t.heartbeat()).toBe(true);
    t.reset();
    expect(t.heartbeat()).toBe(false);
    const fx = t.onEvolved(evo({ fromTier: 4, toTier: 5, topTier: 5 }), 1100);
    expect(fx.offers).toEqual([{ kind: 'tier', firstTop: true }]);
    expect(fx.ripple).toBe(true);
    expect(t.onTorqued(torque(), 1100).earFlick).toBe(true);
  });
});

describe('createTierTracker config', () => {
  it('takes shortened gaps from the injected config', () => {
    const t = createTierTracker(STUB_TIER_PORT, { rippleOutsideGapMs: 1000, earFlickGapMs: 500 });
    expect(t.onEvolved(evo(), 0).ripple).toBe(true);
    expect(t.onEvolved(evo(), 999).ripple).toBe(false);
    expect(t.onEvolved(evo(), 1000).ripple).toBe(true);
    expect(t.onTorqued(torque(), 0).earFlick).toBe(true);
    expect(t.onTorqued(torque(), 499).earFlick).toBe(false);
    expect(t.onTorqued(torque(), 500).earFlick).toBe(true);
  });
});

describe('worldTierRules purity', () => {
  it('stays free of Phaser and DOM globals', () => {
    const src = readFileSync(new URL('./worldTierRules.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*phaser/i);
    expect(src).not.toContain('document.');
    expect(src).not.toContain('window.');
  });
});
