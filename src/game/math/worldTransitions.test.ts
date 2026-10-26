// Transition queue tests (WP24 T5a core, T5b sequence rows): every simple row runs at least its data minimum with no presented jump, gates freeze and hold
// the queue, starts keep the order and the release and stagger gaps, counts never fall (seeded random gates), snap and settle land at
// once, the hole waits for dig bouts in era II, the fog builds after the first vent puff, virga phases hold their spans, and the
// stare spreads per actor. Fake clocks only (no Phaser, no real time). Ramp spans come from WORLD_TRANSITIONS; no tuned value here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WORLD_TRANSITIONS } from '../../data/worldTransitions';
import { createTransitionQueue, stareActive } from './worldTransitions';
import type { QueueCues, QueueGates, TransitionQueue, WorldTween } from './worldTransitions';
import type { WorldEra, WorldVisualState } from './worldState';

const SRC = readFileSync(new URL('./worldTransitions.ts', import.meta.url), 'utf8');
const { rows } = WORLD_TRANSITIONS;
const OPEN: QueueGates = { indexOpen: false, eraCardUp: false, modalOpen: false, ending: 'none', reduced: false };
const LIMIT_STEPS = 6000;

// A quiet era I street: nothing shown but the first-era base, the rest zeroed. Tests patch only the fields they move.
function base(): WorldVisualState {
  return {
    visible: true, ending: 'none', era: 1, eraRow: 0, alpha: 0.75, shadows: true, shadowScale: 0.5, mode: 'crank', seam: true,
    reverse: false, stare: false, vents: false, dogPose: 'loop',
    girl: { stage: 0, stageName: 'window', row: 'back', steps: 0 },
    props: {
      girlWindow: 'flicker', girlMini: false, girlMiniNear: false, windows: 'off', windowsLit: 0, windowsBreathe: false, lamp: 'dead',
      lampGlow: false, lampGlowWarm: false, lampPulse: false, boothLit: false, boothFog: false, motes: false, motesMode: 'orbit',
      stakeChain: true, holeStage: 0, scraps: 3, marks: 40, puddle: { size: 0, look: 'grey' }, sprout: 0, chladni: 0,
      chladniViolet: false, pages: false, virga: 'off',
    },
    sensor: { led: 'red', readout: 'dash', fog: false, pulse: false },
    traces: { redBall: false, crowHigh: false, clipboard: 0 },
  };
}

function stateWith(patch: (s: WorldVisualState) => void): WorldVisualState {
  const s = base();
  patch(s);
  return s;
}

// Mulberry32: a seeded stream for the random gate sequences.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Steps from the target change until the row id leaves pending(); returns the ms from the change.
function rowSettle(a: WorldVisualState, b: WorldVisualState, id: string, stepMs: number): number {
  const q = createTransitionQueue();
  q.snap(a);
  q.setTarget(b, 0, OPEN);
  let now = 0;
  for (let i = 0; i < LIMIT_STEPS; i += 1) {
    now += stepMs;
    q.step(now, stepMs, OPEN, { digBouts: 0, ventPuffs: 0 });
    if (!q.pending().some((p) => p.id === id)) return now;
  }
  throw new Error(`row ${id} never settled`);
}

// Presented value of a Blend row (from + (to - from) x k).
function blendValue(b: { from: number; to: number; k: number }): number {
  return b.from + (b.to - b.from) * b.k;
}

describe('worldTransitions: shape and identity', () => {
  it('preallocates the fixed-length arrays and the micro flags', () => {
    const t = createTransitionQueue().tween();
    expect(t.windows).toHaveLength(6);
    expect(t.motes).toHaveLength(5);
    expect(t.moteFall).toHaveLength(5);
    expect(t.scrapBurn).toHaveLength(3);
    expect(t.chladni).toHaveLength(5);
    expect(t.micro).toEqual({ hitch: false, ledBlink: false, ledDim: false, lampDip: false, boothDip: false, girlWindowDim: false,
      clockTwitch: false, pageStarts: 0 });
  });

  it('returns the same tween object from every step, and no array is reallocated', () => {
    const q = createTransitionQueue();
    q.snap(base());
    const before = q.tween();
    const windows = before.windows;
    const motes = before.motes;
    q.setTarget(stateWith((s) => {
      s.alpha = 0.85;
      s.props.windowsLit = 6;
      s.props.windows = 'lit';
    }), 0, OPEN);
    const first = q.step(100, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
    for (let i = 0; i < 200; i += 1) {
      expect(q.step(100 + i * 100, 100, OPEN, { digBouts: 0, ventPuffs: 0 })).toBe(first);
    }
    expect(first).toBe(before);
    expect(first.windows).toBe(windows);
    expect(first.motes).toBe(motes);
    expect(q.tween()).toBe(first);
  });

  it('imports nothing from Phaser', () => {
    expect(SRC).not.toMatch(/from\s+['"]phaser/);
  });
});

describe('worldTransitions: stare', () => {
  it('turns each actor on its offset once the stare has spread that far', () => {
    expect(stareActive('inspector', true, rows.stare.offsets.inspector)).toBe(true);
    expect(stareActive('inspector', true, rows.stare.offsets.inspector - 0.01)).toBe(false);
    expect(stareActive('dog', true, 0.5)).toBe(true);
    expect(stareActive('crow', true, 0.5)).toBe(false);
    expect(stareActive('girl', true, 0.99)).toBe(false);
    expect(stareActive('girl', true, 1)).toBe(true);
  });

  it('is off without the stare, whatever the spread', () => {
    expect(stareActive('inspector', false, 1)).toBe(false);
    expect(stareActive('girl', false, 1)).toBe(false);
  });
});

describe('worldTransitions: minimum spans (every simple row)', () => {
  const cases: { name: string; id: string; min: number; a: WorldVisualState; b: WorldVisualState }[] = [
    { name: 'era row', id: 'eraRow', min: rows.eraRow.ms, a: base(), b: stateWith((s) => { s.eraRow = 1; }) },
    { name: 'cast alpha', id: 'alpha', min: rows.alpha.ms, a: base(), b: stateWith((s) => { s.alpha = 0.85; }) },
    { name: 'shadow scale', id: 'shadowScale', min: rows.shadowScale.ms, a: base(), b: stateWith((s) => { s.era = 2; s.shadowScale = 1; }) },
    { name: 'shadows off', id: 'shadows', min: rows.shadows.ms, a: base(), b: stateWith((s) => { s.shadows = false; s.shadowScale = 0; }) },
    { name: 'drawn fps', id: 'drawFps', min: rows.drawFps.ms, a: base(), b: stateWith((s) => { s.mode = 'fps8'; }) },
    { name: 'LED amber', id: 'led', min: rows.led.ms, a: base(), b: stateWith((s) => { s.sensor.led = 'amber'; }) },
    { name: 'receiver level', id: 'receiverLevelK', min: rows.receiver.ms, a: stateWith((s) => { s.era = 4; }),
      b: stateWith((s) => { s.era = 5; }) },
    { name: 'stare spread', id: 'stareK', min: rows.stare.spreadMs, a: base(), b: stateWith((s) => { s.stare = true; }) },
    { name: 'hole stage (era III)', id: 'hole', min: rows.hole.settleMs, a: stateWith((s) => { s.era = 3; }),
      b: stateWith((s) => { s.era = 3; s.props.holeStage = 2; }) },
    { name: 'puddle size', id: 'puddle', min: rows.puddle.ms, a: stateWith((s) => { s.era = 3; }),
      b: stateWith((s) => { s.era = 3; s.props.puddle = { size: 2, look: 'grey' }; }) },
    { name: 'puddle black', id: 'puddleBlackK', min: rows.puddleBlack.ms, a: stateWith((s) => { s.era = 5; }),
      b: stateWith((s) => { s.era = 5; s.props.puddle = { size: 0, look: 'black' }; }) },
    { name: 'sprout stage', id: 'sprout', min: rows.sprout.ms, a: stateWith((s) => { s.era = 3; }),
      b: stateWith((s) => { s.era = 3; s.props.sprout = 2; }) },
    { name: 'chladni violet', id: 'chladniViolet', min: rows.chladniViolet.ms, a: base(),
      b: stateWith((s) => { s.props.chladniViolet = true; }) },
    { name: 'virga in', id: 'virga', min: rows.virga.inMs, a: base(), b: stateWith((s) => { s.props.virga = 'fall'; }) },
    { name: 'virga frozen', id: 'virga', min: rows.virga.freezeMs, a: stateWith((s) => { s.props.virga = 'fall'; }),
      b: stateWith((s) => { s.props.virga = 'frozen'; }) },
    { name: 'virga out', id: 'virga', min: rows.virga.outMs, a: stateWith((s) => { s.props.virga = 'frozen'; }),
      b: stateWith((s) => { s.props.virga = 'fade'; }) },
  ];

  for (const c of cases) {
    it(`${c.name} runs at least ${c.min} ms at 100 ms and 16.7 ms steps`, () => {
      expect(rowSettle(c.a, c.b, c.id, 100)).toBeGreaterThanOrEqual(c.min);
      expect(rowSettle(c.a, c.b, c.id, 16.7)).toBeGreaterThanOrEqual(c.min);
    });
  }

  it('lands the target exactly after the ramp', () => {
    const q = createTransitionQueue();
    q.snap(base());
    q.setTarget(stateWith((s) => { s.alpha = 0.85; s.eraRow = 2; }), 0, OPEN);
    for (let i = 1; i <= 400; i += 1) q.step(i * 100, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
    expect(q.tween().alpha).toBe(0.85);
    expect(q.tween().eraRow).toEqual({ from: 2, to: 2, k: 1 });
    expect(q.pending()).toEqual([]);
  });
});

describe('worldTransitions: presented values never jump', () => {
  it('moves a scalar ramp by at most dt / duration per step (plus epsilon)', () => {
    const dt = 16.7;
    const span = rows.alpha.ms;
    const q = createTransitionQueue();
    q.snap(base());
    q.setTarget(stateWith((s) => { s.alpha = 0.85; }), 0, OPEN);
    let prev = q.tween().alpha;
    let max = 0;
    for (let i = 1; i <= 500; i += 1) {
      const v = q.step(i * dt, dt, OPEN, { digBouts: 0, ventPuffs: 0 }).alpha;
      max = Math.max(max, Math.abs(v - prev));
      prev = v;
    }
    expect(max).toBeLessThanOrEqual(0.1 * dt / span + 1e-9);
  });

  it('moves an era row crossfade by at most dt / duration per step', () => {
    const dt = 100;
    const q = createTransitionQueue();
    q.snap(base());
    q.setTarget(stateWith((s) => { s.eraRow = 1; }), 0, OPEN);
    let prev = blendValue(q.tween().eraRow);
    let max = 0;
    for (let i = 1; i <= 200; i += 1) {
      const v = blendValue(q.step(i * dt, dt, OPEN, { digBouts: 0, ventPuffs: 0 }).eraRow);
      max = Math.max(max, Math.abs(v - prev));
      prev = v;
    }
    expect(max).toBeLessThanOrEqual(dt / rows.eraRow.ms + 1e-9);
  });

  it('continues a retargeted scalar from the value on screen, with no jump', () => {
    const q = createTransitionQueue();
    q.snap(base());
    q.setTarget(stateWith((s) => { s.alpha = 0.85; }), 0, OPEN);
    let t = 0;
    for (let i = 0; i < 20; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
    }
    const mid = q.tween().alpha;
    expect(mid).toBeGreaterThan(0.75);
    expect(mid).toBeLessThan(0.85);
    q.setTarget(stateWith((s) => { s.alpha = 0.75; }), t, OPEN);
    expect(q.tween().alpha).toBe(mid);
    const after = q.step(t + 100, 100, OPEN, { digBouts: 0, ventPuffs: 0 }).alpha;
    expect(Math.abs(after - mid)).toBeLessThanOrEqual(0.1 * 100 / rows.alpha.ms + 1e-9);
  });
});

describe('worldTransitions: gates', () => {
  const gateSets: ('indexOpen' | 'eraCardUp' | 'modalOpen')[] = ['indexOpen', 'eraCardUp', 'modalOpen'];

  for (const gate of gateSets) {
    it(`freezes every ramp while the ${gate} gate is up`, () => {
      const q = createTransitionQueue();
      q.snap(base());
      q.setTarget(stateWith((s) => { s.alpha = 0.85; s.eraRow = 1; }), 0, OPEN);
      let t = 0;
      for (let i = 0; i < 20; i += 1) {
        t += 100;
        q.step(t, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
      }
      const gated: QueueGates = { ...OPEN, [gate]: true };
      const alphaAtClose = q.tween().alpha;
      const eraAtClose = blendValue(q.tween().eraRow);
      for (let i = 0; i < 100; i += 1) {
        t += 100;
        q.step(t, 100, gated, { digBouts: 0, ventPuffs: 0 });
        expect(q.tween().alpha).toBe(alphaAtClose);
        expect(blendValue(q.tween().eraRow)).toBe(eraAtClose);
      }
      expect(q.pending().length).toBeGreaterThan(0);
    });
  }

  it('starts nothing before 1000 ms after the last gate drops, then spaces starts by at least 600 ms in queue order', () => {
    const q = createTransitionQueue();
    q.snap(base());
    const gated: QueueGates = { ...OPEN, indexOpen: true };
    q.setTarget(stateWith((s) => {
      s.eraRow = 1;
      s.alpha = 0.85;
      s.shadows = false;
      s.shadowScale = 0.5;
      s.mode = 'fps8';
      s.sensor.led = 'amber';
    }), 0, gated);
    const starts = new Map<string, number>();
    let t = 0;
    for (let i = 0; i < 50; i += 1) {
      t += 100;
      q.step(t, 100, gated, { digBouts: 0, ventPuffs: 0 });
      for (const p of q.pending()) expect(p.startedAtMs).toBeNull();
    }
    const dropAt = t + 100;
    t = dropAt;
    for (let i = 0; i < 400; i += 1) {
      q.step(t, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
      for (const p of q.pending()) {
        if (p.startedAtMs !== null && !starts.has(p.id)) starts.set(p.id, p.startedAtMs);
      }
      t += 100;
    }
    const ordered = ['eraRow', 'alpha', 'shadows', 'drawFps', 'led'].map((id) => starts.get(id) ?? Number.NaN);
    expect(ordered.every((v) => Number.isFinite(v))).toBe(true);
    expect(ordered[0]).toBeGreaterThanOrEqual(dropAt + WORLD_TRANSITIONS.startAfterCloseMs);
    for (let i = 1; i < ordered.length; i += 1) {
      expect((ordered[i] ?? 0) - (ordered[i - 1] ?? 0)).toBeGreaterThanOrEqual(WORLD_TRANSITIONS.staggerMs[0]);
    }
  });

  it('starts at once after boot when no gate was ever up, still spaced by the stagger', () => {
    const q = createTransitionQueue();
    q.snap(base());
    q.setTarget(stateWith((s) => { s.eraRow = 1; s.alpha = 0.85; }), 0, OPEN);
    q.step(100, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
    const first = q.pending().find((p) => p.id === 'eraRow');
    const second = q.pending().find((p) => p.id === 'alpha');
    expect(first?.startedAtMs).toBe(100);
    expect(second?.startedAtMs).toBeNull();
    q.step(200, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
    expect(q.pending().find((p) => p.id === 'alpha')?.startedAtMs ?? null).toBeNull();
  });
});

describe('worldTransitions: random gate sequences', () => {
  it('never lowers hole, puddle or sprout and ends on the target', () => {
    const rand = seeded(24);
    const q = createTransitionQueue();
    const a = stateWith((s) => { s.era = 3; });
    const b = stateWith((s) => { s.era = 3; s.props.holeStage = 4; s.props.puddle = { size: 3, look: 'grey' }; s.props.sprout = 4; });
    q.snap(a);
    q.setTarget(b, 0, OPEN);
    const prev = { hole: 0, puddle: 0, sprout: 0 };
    const cues: QueueCues = { digBouts: 0, ventPuffs: 0 };
    let t = 0;
    let gate: QueueGates = OPEN;
    for (let i = 0; i < 3000; i += 1) {
      if (i % 10 === 0) {
        const pick = rand();
        const up = rand() < 0.5;
        gate = { ...OPEN, indexOpen: up && pick < 0.33, eraCardUp: up && pick >= 0.33 && pick < 0.66, modalOpen: up && pick >= 0.66 };
      }
      t += 100;
      const tw = q.step(t, 100, gate, cues);
      const now = { hole: blendValue(tw.hole), puddle: blendValue(tw.puddle), sprout: blendValue(tw.sprout) };
      expect(now.hole).toBeGreaterThanOrEqual(prev.hole - 1e-9);
      expect(now.puddle).toBeGreaterThanOrEqual(prev.puddle - 1e-9);
      expect(now.sprout).toBeGreaterThanOrEqual(prev.sprout - 1e-9);
      prev.hole = now.hole;
      prev.puddle = now.puddle;
      prev.sprout = now.sprout;
    }
    for (let i = 0; i < 1200; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
    }
    const end = q.tween();
    expect(end.hole).toEqual({ from: 4, to: 4, k: 1 });
    expect(end.puddle).toEqual({ from: 3, to: 3, k: 1 });
    expect(end.sprout).toEqual({ from: 4, to: 4, k: 1 });
    expect(q.pending()).toEqual([]);
  });

  it('keeps a retargeted count rising: the running step lands, then the next one starts', () => {
    const q = createTransitionQueue();
    q.snap(stateWith((s) => { s.era = 3; }));
    q.setTarget(stateWith((s) => { s.era = 3; s.props.holeStage = 1; }), 0, OPEN);
    let t = 0;
    for (let i = 0; i < 100; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
    }
    const before = blendValue(q.tween().hole);
    q.setTarget(stateWith((s) => { s.era = 3; s.props.holeStage = 3; }), t, OPEN);
    expect(blendValue(q.tween().hole)).toBe(before);
    let last = before;
    for (let i = 0; i < 1000; i += 1) {
      t += 100;
      const v = blendValue(q.step(t, 100, OPEN, { digBouts: 0, ventPuffs: 0 }).hole);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      last = v;
    }
    expect(q.tween().hole).toEqual({ from: 3, to: 3, k: 1 });
  });
});

describe('worldTransitions: snap, ending and settle', () => {
  it('snaps every row to the boot state at once, nothing pending', () => {
    const target = stateWith((s) => {
      s.era = 5;
      s.eraRow = 4;
      s.alpha = 0.85;
      s.shadows = false;
      s.reverse = true;
      s.props.holeStage = 4;
      s.props.puddle = { size: 3, look: 'black' };
      s.props.sprout = 4;
      s.props.virga = 'fade';
      s.props.chladniViolet = true;
      s.stare = true;
      s.sensor.fog = true;
    });
    const q = createTransitionQueue();
    q.snap(target);
    const t = q.tween();
    expect(t.eraRow).toEqual({ from: 4, to: 4, k: 1 });
    expect(t.alpha).toBe(0.85);
    expect(t.shadows).toBe(0);
    expect(t.reverseOn).toBe(true);
    expect(t.hole).toEqual({ from: 4, to: 4, k: 1 });
    expect(t.puddle).toEqual({ from: 3, to: 3, k: 1 });
    expect(t.puddleBlackK).toBe(1);
    expect(t.virga).toEqual({ alpha: 0, speed: 0 });
    expect(t.chladniViolet).toBe(1);
    expect(t.stareK).toBe(1);
    expect(t.sensorFog).toBe(1);
    expect(q.pending()).toEqual([]);
  });

  it('snaps at once when an ending phase is on, whatever the gates', () => {
    const q = createTransitionQueue();
    q.snap(base());
    const ending: QueueGates = { ...OPEN, indexOpen: true, ending: 'sequence' };
    q.setTarget(stateWith((s) => { s.alpha = 0.85; s.eraRow = 2; }), 0, ending);
    expect(q.tween().alpha).toBe(0.85);
    expect(q.tween().eraRow).toEqual({ from: 2, to: 2, k: 1 });
    expect(q.pending()).toEqual([]);
    q.step(100, 100, ending, { digBouts: 0, ventPuffs: 0 });
    expect(q.tween().alpha).toBe(0.85);
    expect(q.pending()).toEqual([]);
  });

  it('lands every target at the next gate-free step while settle is on, and resumes normal rules when it is off', () => {
    const q = createTransitionQueue();
    q.snap(base());
    q.settle(true);
    const gated: QueueGates = { ...OPEN, eraCardUp: true };
    q.setTarget(stateWith((s) => { s.alpha = 0.85; s.eraRow = 1; s.props.holeStage = 0; }), 0, gated);
    q.step(100, 100, gated, { digBouts: 0, ventPuffs: 0 });
    expect(q.tween().alpha).toBe(0.75);
    q.step(200, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
    expect(q.tween().alpha).toBe(0.85);
    expect(q.tween().eraRow).toEqual({ from: 1, to: 1, k: 1 });
    expect(q.pending()).toEqual([]);
    q.settle(false);
    q.setTarget(stateWith((s) => { s.eraRow = 1; s.alpha = 0.75; }), 200, OPEN);
    q.step(300, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
    expect(q.pending().map((p) => p.id)).toEqual(['alpha']);
  });
});

describe('worldTransitions: hole and fog', () => {
  it('era II: a stage waits for a dig bout, crossfades one stage over the bout span, then waits again', () => {
    const q = createTransitionQueue();
    const eraII = (holeStage: number): WorldVisualState => stateWith((s) => { s.era = 2; s.props.holeStage = holeStage; });
    q.snap(eraII(0));
    q.setTarget(eraII(2), 0, OPEN);
    const cues: QueueCues = { digBouts: 0, ventPuffs: 0 };
    let t = 0;
    for (let i = 0; i < 600; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
    }
    expect(q.tween().hole).toEqual({ from: 0, to: 1, k: 0 });
    expect(q.pending()).toHaveLength(1);
    expect(q.pending()[0]?.startedAtMs ?? null).toBeNull();
    cues.digBouts = 1;
    const bout = t + 100;
    let landed = -1;
    for (let i = 0; i < 200; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
      if (landed < 0 && q.tween().hole.from === 1 && q.tween().hole.k === 1) landed = t;
    }
    expect(landed - bout).toBeGreaterThanOrEqual(rows.hole.boutMinMs);
    // Landed at 1; the next stage (1 to 2) is queued and waits for the next bout.
    expect(q.tween().hole).toEqual({ from: 1, to: 2, k: 0 });
    expect(q.pending()).toHaveLength(1);
    expect(q.pending()[0]?.startedAtMs ?? null).toBeNull();
    for (let i = 0; i < 600; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
    }
    expect(q.tween().hole).toEqual({ from: 1, to: 2, k: 0 });
    expect(q.pending()).toHaveLength(1);
    cues.digBouts = 2;
    for (let i = 0; i < 200; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
    }
    expect(q.tween().hole).toEqual({ from: 2, to: 2, k: 1 });
    expect(q.pending()).toEqual([]);
  });

  it('era III and later: the hole crossfades straight to the target over the settle span', () => {
    const elapsed = rowSettle(stateWith((s) => { s.era = 4; }), stateWith((s) => { s.era = 4; s.props.holeStage = 3; }), 'hole', 100);
    expect(elapsed).toBeGreaterThanOrEqual(rows.hole.settleMs);
  });

  it('the booth and sensor fog build only after the first vent puff, then clear over the clear span', () => {
    const q = createTransitionQueue();
    const cues: QueueCues = { digBouts: 0, ventPuffs: 0 };
    const vents = stateWith((s) => { s.era = 3; s.vents = true; });
    q.snap(vents);
    q.setTarget(stateWith((s) => { s.era = 3; s.vents = true; s.props.boothFog = true; s.sensor.fog = true; }), 0, OPEN);
    let t = 0;
    for (let i = 0; i < 400; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
    }
    expect(q.tween().boothFog).toBe(0);
    expect(q.tween().sensorFog).toBe(0);
    expect(q.pending().map((p) => p.id).sort()).toEqual(['boothFog', 'sensorFog']);
    cues.ventPuffs = 1;
    let buildStart = -1;
    let buildEnd = -1;
    for (let i = 0; i < 600; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
      const booth = q.pending().find((p) => p.id === 'boothFog');
      if (buildStart < 0 && booth && booth.startedAtMs !== null) buildStart = t;
      if (buildEnd < 0 && booth === undefined) buildEnd = t;
    }
    expect(buildStart).toBeGreaterThanOrEqual(0);
    expect(buildEnd - buildStart).toBeGreaterThanOrEqual(rows.fogBuild.ms);
    expect(q.tween().boothFog).toBe(1);
    expect(q.tween().sensorFog).toBe(1);
    q.setTarget(vents, t, OPEN);
    let clearEnd = -1;
    for (let i = 0; i < 600 && clearEnd < 0; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
      if (!q.pending().some((p) => p.id === 'boothFog' || p.id === 'sensorFog')) clearEnd = t;
    }
    expect(q.tween().boothFog).toBe(0);
    expect(q.tween().sensorFog).toBe(0);
    expect(clearEnd).toBeGreaterThan(0);
  });

  it('fog clears on its own span and does not wait for a vent puff', () => {
    const q = createTransitionQueue();
    const cues: QueueCues = { digBouts: 0, ventPuffs: 0 };
    q.snap(stateWith((s) => { s.era = 3; s.props.boothFog = true; }));
    q.setTarget(stateWith((s) => { s.era = 3; s.props.boothFog = false; }), 0, OPEN);
    let t = 0;
    let end = -1;
    for (let i = 0; i < 600 && end < 0; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
      if (!q.pending().some((p) => p.id === 'boothFog')) end = t;
    }
    expect(end).toBeGreaterThanOrEqual(rows.fogClear.ms);
    expect(q.tween().boothFog).toBe(0);
  });
});

describe('worldTransitions: virga and flips', () => {
  it('fades in, decelerates into frozen, then fades out on its own spans', () => {
    const q = createTransitionQueue();
    const cues: QueueCues = { digBouts: 0, ventPuffs: 0 };
    q.snap(base());
    q.setTarget(stateWith((s) => { s.props.virga = 'fall'; }), 0, OPEN);
    let t = 0;
    let fallAt = -1;
    for (let i = 0; i < 400 && fallAt < 0; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
      if (q.pending().length === 0) fallAt = t;
    }
    expect(fallAt).toBeGreaterThanOrEqual(rows.virga.inMs);
    expect(q.tween().virga).toEqual({ alpha: 1, speed: 1 });

    q.setTarget(stateWith((s) => { s.props.virga = 'frozen'; }), t, OPEN);
    let frozenAt = -1;
    for (let i = 0; i < 400 && frozenAt < 0; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
      if (q.pending().length === 0) frozenAt = t;
    }
    expect(frozenAt).toBeGreaterThanOrEqual(rows.virga.freezeMs);
    expect(q.tween().virga).toEqual({ alpha: 1, speed: 0 });

    q.setTarget(stateWith((s) => { s.props.virga = 'fade'; }), t, OPEN);
    let outAt = -1;
    for (let i = 0; i < 1000 && outAt < 0; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, cues);
      if (q.pending().length === 0) outAt = t;
    }
    expect(outAt).toBeGreaterThanOrEqual(rows.virga.outMs);
    expect(q.tween().virga).toEqual({ alpha: 0, speed: 0 });
  });

  it('flips reverse and unison at their start slot with no ramp, one stagger apart', () => {
    const q = createTransitionQueue();
    const cues: QueueCues = { digBouts: 0, ventPuffs: 0 };
    q.snap(stateWith((s) => { s.era = 3; }));
    q.setTarget(stateWith((s) => { s.era = 4; s.reverse = true; }), 0, OPEN);
    expect(q.tween().reverseOn).toBe(false);
    expect(q.tween().unisonOn).toBe(false);
    q.step(100, 100, OPEN, cues);
    expect(q.tween().reverseOn).toBe(true);
    expect(q.tween().unisonOn).toBe(false);
    let t = 100;
    while (!q.tween().unisonOn && t < 10000) {
      t += 100;
      q.step(t, 100, OPEN, cues);
    }
    expect(q.tween().unisonOn).toBe(true);
    expect(t - 100).toBeGreaterThanOrEqual(WORLD_TRANSITIONS.staggerMs[0]);
    expect(q.pending()).toEqual([]);
  });
});

// ---- T5b: sequence rows (lamp, booth, windows, breathe, girl window, motes, mote fall, scraps, rings) ------------------------------

const STEP = 16.7;          // a 60 fps frame: the luminance and the timing checks run at this step
const COARSE = 100;         // long runs (mote fall) step coarser
const TOL = 2 * STEP;       // sampling tolerance of a first-crossing time
const REDUCED: QueueGates = { ...OPEN, reduced: true };
const NO_CUES: QueueCues = { digBouts: 0, ventPuffs: 0 };

function litGlow(): WorldVisualState {
  return stateWith((s) => { s.era = 2; s.props.lamp = 'lit'; s.props.lampGlow = true; });
}

function litGlowBooth(): WorldVisualState {
  return stateWith((s) => { s.era = 2; s.props.lamp = 'lit'; s.props.lampGlow = true; s.props.boothLit = true; });
}

function warmGlow(): WorldVisualState {
  return stateWith((s) => { s.era = 3; s.props.lamp = 'warm'; s.props.lampGlow = true; s.props.lampGlowWarm = true; });
}

function deadLamp(): WorldVisualState {
  return stateWith((s) => { s.era = 5; s.props.lamp = 'dead'; });
}

function windowsLit6(): WorldVisualState {
  return stateWith((s) => { s.props.windows = 'lit'; s.props.windowsLit = 6; });
}

function windowsOff(): WorldVisualState {
  return stateWith((s) => { s.era = 5; s.props.windows = 'lit'; s.props.windowsLit = 0; });
}

// Everything on at once (era IV): the landing check reads every sequence row.
function everything(): WorldVisualState {
  return stateWith((s) => {
    s.era = 4;
    s.props.lamp = 'lit';
    s.props.lampGlow = true;
    s.props.boothLit = true;
    s.props.windows = 'lit';
    s.props.windowsLit = 6;
    s.props.windowsBreathe = true;
    s.props.girlWindow = 'dark';
    s.props.motes = true;
    s.props.motesMode = 'freeze';
    s.props.chladni = 1;
    s.props.scraps = 0;
  });
}

// One step of the presented sequence rows (copies: the tween is mutated in place).
interface Sample {
  now: number;
  lamp: number;
  lampK: number;
  glow: number;
  glowWarm: boolean;
  booth: number;
  boothK: number;
  windows: number[];
  breathe: number;
  pulse: number;
  girlAlpha: number;
  girlSlow: number;
  motes: number[];
  freeze: number;
  fall: number[];
  scrap: number[];
  rings: number[];
}

interface Timeline {
  samples: Sample[];
  startAt: Map<string, number>;   // first start of each item id
  leaveAt: Map<string, number>;   // the step an item id left the queue
}

function sampleOf(now: number, tw: WorldTween): Sample {
  return {
    now, lamp: blendValue(tw.lamp), lampK: tw.lamp.k, glow: tw.glowAlpha, glowWarm: tw.glowWarm, booth: blendValue(tw.booth),
    boothK: tw.booth.k, windows: [...tw.windows], breathe: tw.breatheK, pulse: tw.pulseK, girlAlpha: tw.girlWindow.alpha,
    girlSlow: tw.girlWindow.slowK, motes: [...tw.motes], freeze: tw.motesFreezeK, fall: [...tw.moteFall], scrap: [...tw.scrapBurn],
    rings: [...tw.chladni],
  };
}

// Runs a change from `a` to `b` for totalMs at stepMs, recording the samples and when each item started and left.
function timeline(a: WorldVisualState, b: WorldVisualState, totalMs: number, stepMs: number, gates: QueueGates = OPEN): Timeline {
  const q: TransitionQueue = createTransitionQueue();
  q.snap(a);
  q.setTarget(b, 0, gates);
  const tl: Timeline = { samples: [], startAt: new Map(), leaveAt: new Map() };
  const seen = new Set<string>();
  let now = 0;
  while (now < totalMs) {
    now += stepMs;
    const tw = q.step(now, stepMs, gates, NO_CUES);
    const live = new Set<string>();
    for (const p of q.pending()) {
      live.add(p.id);
      seen.add(p.id);
      if (p.startedAtMs !== null && !tl.startAt.has(p.id)) tl.startAt.set(p.id, p.startedAtMs);
    }
    for (const id of seen) {
      if (!live.has(id) && !tl.leaveAt.has(id)) tl.leaveAt.set(id, now);
    }
    tl.samples.push(sampleOf(now, tw));
  }
  return tl;
}

// Time of the first sample that satisfies the predicate (NaN when none does).
function firstAt(samples: readonly Sample[], pred: (s: Sample) => boolean): number {
  const hit = samples.find(pred);
  return hit === undefined ? Number.NaN : hit.now;
}

function last(samples: readonly Sample[]): Sample {
  const s = samples[samples.length - 1];
  if (s === undefined) throw new Error('empty timeline');
  return s;
}

// Times of the on-to-off crossings (value above 0.5, then at or below it) of one presented value.
function offEdges(samples: readonly Sample[], pick: (s: Sample) => number): number[] {
  const out: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const cur = samples[i];
    if (prev === undefined || cur === undefined) continue;
    if (pick(prev) > 0.5 && pick(cur) <= 0.5) out.push(cur.now);
  }
  return out;
}

// The most off-edges in any one-second window that starts at an edge (WCAG: at most three a second).
function maxEdgesPerSecond(edges: readonly number[]): number {
  let max = 0;
  for (const e of edges) max = Math.max(max, edges.filter((x) => x >= e && x < e + 1000).length);
  return max;
}

function nonDecreasing(xs: readonly number[]): boolean {
  for (let i = 1; i < xs.length; i += 1) {
    if ((xs[i] ?? 0) < (xs[i - 1] ?? 0) - 1e-9) return false;
  }
  return true;
}

function nonIncreasing(xs: readonly number[]): boolean {
  for (let i = 1; i < xs.length; i += 1) {
    if ((xs[i] ?? 0) > (xs[i - 1] ?? 0) + 1e-9) return false;
  }
  return true;
}

// Presented values of one index over the samples.
function column(samples: readonly Sample[], pick: (s: Sample) => readonly number[], i: number): number[] {
  return samples.map((s) => pick(s)[i] ?? 0);
}

// Every sequence row sits on its goal (everything(): lamp lit with glow, booth, windows, breathe, girl dark, motes frozen,
// three rings, no scraps burning).
function expectLanded(tw: WorldTween): void {
  expect(tw.lamp).toEqual({ from: 1, to: 1, k: 1 });
  expect(tw.glowAlpha).toBe(1);
  expect(tw.glowWarm).toBe(false);
  expect(tw.booth).toEqual({ from: 1, to: 1, k: 1 });
  expect(tw.windows).toEqual([1, 1, 1, 1, 1, 1]);
  expect(tw.breatheK).toBe(1);
  expect(tw.pulseK).toBe(0);
  expect(tw.girlWindow).toEqual({ alpha: 0, slowK: 1 });
  expect(tw.motes).toEqual([1, 1, 1, 1, 1]);
  expect(tw.motesFreezeK).toBe(1);
  expect(tw.moteFall).toEqual([0, 0, 0, 0, 0]);
  expect(tw.scrapBurn).toEqual([1, 1, 1]);
  expect(tw.chladni).toEqual([1, 1, 1, 0, 0]);
}

describe('worldTransitions: sequence rows minimum spans (T5b)', () => {
  it('lamp: a buzz-on stutter for buzzMs, then the glow fades in over glowMs', () => {
    const r = timeline(base(), litGlow(), 9000, STEP);
    const start = r.startAt.get('lamp') ?? Number.NaN;
    const glowOn = firstAt(r.samples, (s) => s.glow > 0);
    const glowFull = firstAt(r.samples, (s) => s.glow >= 1);
    expect(Number.isFinite(start)).toBe(true);
    expect(glowOn - start).toBeGreaterThanOrEqual(rows.lamp.buzzMs - STEP);
    expect(glowFull - glowOn).toBeGreaterThanOrEqual(rows.lamp.glowMs - TOL);
    expect(last(r.samples).lamp).toBe(1);
    expect(last(r.samples).glow).toBe(1);
  });

  it('booth: stutters on 1.5 s after the lamp when both change in one batch, and runs for 2.5 s', () => {
    const r = timeline(base(), litGlowBooth(), 9000, STEP);
    const lampStart = r.startAt.get('lamp') ?? Number.NaN;
    const boothStart = r.startAt.get('booth') ?? Number.NaN;
    expect(boothStart - lampStart).toBeGreaterThanOrEqual(rows.booth.delayAfterLampMs);
    expect((r.leaveAt.get('booth') ?? Number.NaN) - boothStart).toBeGreaterThanOrEqual(rows.booth.totalMs);
    expect(last(r.samples).booth).toBe(1);
    expect(last(r.samples).boothK).toBe(1);
  });

  it('booth on its own starts at its own slot, with no wait for a lamp', () => {
    const r = timeline(litGlow(), litGlowBooth(), 4000, STEP);
    expect(r.startAt.get('booth') ?? Number.NaN).toBeLessThan(rows.booth.delayAfterLampMs);
  });

  it('lamp lit to warm: the shift takes lampWarm.ms and the glow fades through zero to the warm glow', () => {
    const r = timeline(litGlow(), warmGlow(), rows.lampWarm.ms + 2000, STEP);
    const start = r.startAt.get('lamp') ?? Number.NaN;
    expect((r.leaveAt.get('lamp') ?? Number.NaN) - start).toBeGreaterThanOrEqual(rows.lampWarm.ms);
    expect(nonDecreasing(r.samples.filter((s) => s.now >= start).map((s) => s.lamp))).toBe(true);
    const half = start + rows.lampWarm.ms / 2;
    expect(r.samples.filter((s) => s.now < half - STEP).every((s) => !s.glowWarm)).toBe(true);
    expect(r.samples.filter((s) => s.now > half + STEP).every((s) => s.glowWarm)).toBe(true);
    const lows = r.samples.filter((s) => s.now >= start).map((s) => s.glow);
    expect(Math.min(...lows)).toBeLessThan(0.05);
    expect(last(r.samples).lamp).toBe(2);
    expect(last(r.samples).glow).toBe(1);
  });

  it('any to dead: the flicker-out takes lampDead.ms and the glow goes out with it', () => {
    const r = timeline(litGlow(), deadLamp(), 4000, STEP);
    const start = r.startAt.get('lamp') ?? Number.NaN;
    expect((r.leaveAt.get('lamp') ?? Number.NaN) - start).toBeGreaterThanOrEqual(rows.lampDead.ms);
    expect(last(r.samples).lamp).toBe(0);
    expect(last(r.samples).lampK).toBe(1);
    expect(last(r.samples).glow).toBe(0);
  });

  it('windows: six lit one at a time, each after a gap, over at least totalMinMs', () => {
    const r = timeline(base(), windowsLit6(), 30000, STEP);
    const firsts = [0, 1, 2, 3, 4, 5].map((i) => firstAt(r.samples, (s) => (s.windows[i] ?? 0) > 0));
    for (let i = 1; i < firsts.length; i += 1) {
      expect((firsts[i] ?? 0) - (firsts[i - 1] ?? 0)).toBeGreaterThanOrEqual(rows.windows.gapMs[0] - TOL);
    }
    expect((firsts[5] ?? 0) - (firsts[0] ?? 0)).toBeGreaterThanOrEqual(rows.windows.totalMinMs - TOL);
    for (let i = 1; i < r.samples.length; i += 1) {
      const prev = r.samples[i - 1];
      const cur = r.samples[i];
      if (prev === undefined || cur === undefined) continue;
      const changed = cur.windows.filter((v, j) => v !== prev.windows[j]).length;
      expect(changed).toBeLessThanOrEqual(1);
    }
    expect(last(r.samples).windows).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('breathe and pulse fade in over breathe.ms; the girl window goes dark over girlWindow.ms', () => {
    const era4 = stateWith((s) => {
      s.era = 4;
      s.props.windowsBreathe = true;
      s.props.lamp = 'warm';
      s.props.lampGlow = true;
      s.props.lampGlowWarm = true;
      s.props.lampPulse = true;
    });
    const r = timeline(base(), era4, 8000, STEP);
    expect(firstAt(r.samples, (s) => s.breathe >= 1) - firstAt(r.samples, (s) => s.breathe > 0)).toBeGreaterThanOrEqual(
      rows.breathe.ms - TOL);
    expect(firstAt(r.samples, (s) => s.pulse >= 1) - firstAt(r.samples, (s) => s.pulse > 0)).toBeGreaterThanOrEqual(
      rows.breathe.ms - TOL);
    const dark = timeline(base(), stateWith((s) => { s.props.girlWindow = 'dark'; }), 8000, STEP);
    expect(firstAt(dark.samples, (s) => s.girlAlpha <= 0) - firstAt(dark.samples, (s) => s.girlAlpha < 1)).toBeGreaterThanOrEqual(
      rows.girlWindow.ms - TOL);
    expect(firstAt(dark.samples, (s) => s.girlSlow >= 1) - firstAt(dark.samples, (s) => s.girlSlow > 0)).toBeGreaterThanOrEqual(
      rows.girlWindow.ms - TOL);
    expect(last(dark.samples).girlAlpha).toBe(0);
    expect(last(dark.samples).girlSlow).toBe(1);
  });

  it('motes: five appear one at a time, at least one gap apart, over at least totalMinMs', () => {
    const r = timeline(base(), stateWith((s) => { s.props.motes = true; }), 60000, STEP);
    const start = r.startAt.get('motes') ?? Number.NaN;
    const firsts = [0, 1, 2, 3, 4].map((i) => firstAt(r.samples, (s) => (s.motes[i] ?? 0) > 0));
    for (let i = 1; i < firsts.length; i += 1) {
      expect((firsts[i] ?? 0) - (firsts[i - 1] ?? 0)).toBeGreaterThanOrEqual(rows.motes.gapMs[0] - TOL);
    }
    expect((firsts[4] ?? 0) - start).toBeGreaterThanOrEqual(rows.motes.totalMinMs - TOL);
    expect(last(r.samples).motes).toEqual([1, 1, 1, 1, 1]);
  });

  it('motes freeze over freezeMs (era IV); each mote falls over at least the fall minimum, staggered (era V)', () => {
    const orbit = stateWith((s) => { s.era = 2; s.props.motes = true; });
    const frozen = stateWith((s) => { s.era = 4; s.props.motes = true; s.props.motesMode = 'freeze'; });
    const f = timeline(orbit, frozen, 6000, STEP);
    expect(firstAt(f.samples, (s) => s.freeze >= 1) - firstAt(f.samples, (s) => s.freeze > 0)).toBeGreaterThanOrEqual(
      rows.motesFreeze.ms - TOL);
    const falling = stateWith((s) => { s.era = 5; s.props.motes = true; s.props.motesMode = 'fall'; });
    const fall = timeline(orbit, falling, 90000, COARSE);
    const starts = [0, 1, 2, 3, 4].map((i) => firstAt(fall.samples, (s) => (s.fall[i] ?? 0) > 0));
    for (let i = 0; i < 5; i += 1) {
      const full = firstAt(fall.samples, (s) => (s.fall[i] ?? 0) >= 1);
      expect(full - (starts[i] ?? 0)).toBeGreaterThanOrEqual(rows.motesFall.ms[0] - 2 * COARSE);
    }
    for (let i = 1; i < starts.length; i += 1) {
      expect((starts[i] ?? 0) - (starts[i - 1] ?? 0)).toBeGreaterThan(0);
    }
    expect(last(fall.samples).fall).toEqual([1, 1, 1, 1, 1]);
  });

  it('scrap burn: each scrap burns over scrapBurn.ms, burning scraps start gapMs apart in descending index order', () => {
    const r = timeline(base(), stateWith((s) => { s.props.scraps = 0; }), 12000, STEP);
    const on = [2, 1, 0].map((i) => firstAt(r.samples, (s) => (s.scrap[i] ?? 0) > 0));
    for (let i = 1; i < on.length; i += 1) {
      expect((on[i] ?? 0) - (on[i - 1] ?? 0)).toBeGreaterThanOrEqual(rows.scrapBurn.gapMs - TOL);
    }
    for (const i of [0, 1, 2]) {
      const a = firstAt(r.samples, (s) => (s.scrap[i] ?? 0) > 0);
      const b = firstAt(r.samples, (s) => (s.scrap[i] ?? 0) >= 1);
      expect(b - a).toBeGreaterThanOrEqual(rows.scrapBurn.ms - TOL);
    }
  });

  it('chladni rings light ring by ring: ringMs each, gapMs apart', () => {
    const r = timeline(base(), stateWith((s) => { s.era = 4; s.props.chladni = 1; }), 12000, STEP);
    const on = [0, 1, 2].map((i) => firstAt(r.samples, (s) => (s.rings[i] ?? 0) > 0));
    const full = [0, 1, 2].map((i) => firstAt(r.samples, (s) => (s.rings[i] ?? 0) >= 1));
    for (let i = 0; i < 3; i += 1) {
      expect((full[i] ?? 0) - (on[i] ?? 0)).toBeGreaterThanOrEqual(rows.chladni.ringMs - TOL);
    }
    for (let i = 1; i < 3; i += 1) {
      expect((on[i] ?? 0) - (full[i - 1] ?? 0)).toBeGreaterThanOrEqual(rows.chladni.gapMs - TOL);
    }
    expect(last(r.samples).rings).toEqual([1, 1, 1, 0, 0]);
  });
});

describe('worldTransitions: luminance and reduced motion (T5b)', () => {
  it('the lamp buzz, the booth stutter and the flicker-out toggle at most three times on-to-off in any second', () => {
    const buzz = timeline(base(), litGlowBooth(), 9000, STEP);
    expect(maxEdgesPerSecond(offEdges(buzz.samples, (s) => s.lampK))).toBeLessThanOrEqual(3);
    expect(maxEdgesPerSecond(offEdges(buzz.samples, (s) => s.boothK))).toBeLessThanOrEqual(3);
    const dying = timeline(litGlow(), deadLamp(), 4000, STEP);
    expect(maxEdgesPerSecond(offEdges(dying.samples, (s) => s.lampK))).toBeLessThanOrEqual(3);
  });

  it('each window toggles at most three times on-to-off in any second, rising and falling', () => {
    const rising = timeline(base(), windowsLit6(), 30000, STEP);
    const falling = timeline(windowsLit6(), windowsOff(), 9000, STEP);
    for (let i = 0; i < 6; i += 1) {
      expect(maxEdgesPerSecond(offEdges(rising.samples, (s) => s.windows[i] ?? 0))).toBeLessThanOrEqual(3);
      expect(maxEdgesPerSecond(offEdges(falling.samples, (s) => s.windows[i] ?? 0))).toBeLessThanOrEqual(3);
    }
  });

  it('reduced motion: the lamp buzz, the booth and the windows move monotone over the same total time', () => {
    const r = timeline(base(), litGlowBooth(), 9000, STEP, REDUCED);
    const lampStart = r.startAt.get('lamp') ?? Number.NaN;
    const buzz = r.samples.filter((s) => s.now >= lampStart && s.now <= lampStart + rows.lamp.buzzMs);
    expect(nonDecreasing(buzz.map((s) => s.lampK))).toBe(true);
    expect(offEdges(buzz, (s) => s.lampK)).toEqual([]);
    const boothStart = r.startAt.get('booth') ?? Number.NaN;
    const booth = r.samples.filter((s) => s.now >= boothStart && s.now <= boothStart + rows.booth.totalMs);
    expect(nonDecreasing(booth.map((s) => s.boothK))).toBe(true);
    expect(offEdges(booth, (s) => s.boothK)).toEqual([]);
    const up = timeline(base(), windowsLit6(), 20000, STEP, REDUCED);
    for (let i = 0; i < 6; i += 1) expect(nonDecreasing(column(up.samples, (s) => s.windows, i))).toBe(true);
    const down = timeline(windowsLit6(), windowsOff(), 9000, STEP, REDUCED);
    for (let i = 0; i < 6; i += 1) expect(nonIncreasing(column(down.samples, (s) => s.windows, i))).toBe(true);
    const dying = timeline(litGlow(), deadLamp(), 4000, STEP, REDUCED);
    const dyingStart = dying.startAt.get('lamp') ?? Number.NaN;
    const dyingK = dying.samples.filter((s) => s.now >= dyingStart && s.now <= dyingStart + rows.lampDead.ms).map((s) => s.lampK);
    expect(nonDecreasing(dyingK)).toBe(true);
    expect(offEdges(dying.samples, (s) => s.lampK)).toEqual([]);
  });
});

describe('worldTransitions: counts that only grow, settle and snap (T5b)', () => {
  it('lit windows, rings, burning scraps and motes never fall while their target only grows (seeded gates)', () => {
    const rand = seeded(19);
    const q = createTransitionQueue();
    q.snap(base());
    q.setTarget(stateWith((s) => {
      s.era = 4;
      s.props.windows = 'lit';
      s.props.windowsLit = 6;
      s.props.chladni = 1;
      s.props.scraps = 0;
      s.props.motes = true;
    }), 0, OPEN);
    let gate: QueueGates = OPEN;
    let t = 0;
    let rings = 0;
    let scraps = 0;
    let motes = 0;
    let litIdle = 0;
    for (let i = 0; i < 3000; i += 1) {
      if (i % 10 === 0) {
        const pick = rand();
        gate = pick < 0.25 ? { ...OPEN, indexOpen: true } : pick < 0.5 ? { ...OPEN, eraCardUp: true }
          : pick < 0.75 ? { ...OPEN, modalOpen: true } : OPEN;
      }
      t += 100;
      const tw = q.step(t, 100, gate, NO_CUES);
      const ringsNow = tw.chladni.filter((v) => v > 0).length;
      const scrapsNow = tw.scrapBurn.filter((v) => v > 0).length;
      const motesNow = tw.motes.filter((v) => v > 0).length;
      expect(ringsNow).toBeGreaterThanOrEqual(rings);
      expect(scrapsNow).toBeGreaterThanOrEqual(scraps);
      expect(motesNow).toBeGreaterThanOrEqual(motes);
      rings = ringsNow;
      scraps = scrapsNow;
      motes = motesNow;
      if (!q.pending().some((p) => p.id === 'windows')) {
        const lit = tw.windows.filter((v) => v > 0).length;
        expect(lit).toBeGreaterThanOrEqual(litIdle);
        litIdle = lit;
      }
    }
    for (let i = 0; i < 1500; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, NO_CUES);
    }
    const end = q.tween();
    expect(end.windows).toEqual([1, 1, 1, 1, 1, 1]);
    expect(end.chladni).toEqual([1, 1, 1, 0, 0]);
    expect(end.scrapBurn).toEqual([1, 1, 1]);
    expect(end.motes).toEqual([1, 1, 1, 1, 1]);
    expect(q.pending()).toEqual([]);
  });

  it('settle lands every sequence row at the next gate drop, and snap lands them at once', () => {
    const q = createTransitionQueue();
    q.snap(base());
    q.settle(true);
    const gated: QueueGates = { ...OPEN, eraCardUp: true };
    q.setTarget(everything(), 0, gated);
    q.step(100, 100, gated, NO_CUES);
    q.step(200, 100, OPEN, NO_CUES);
    expectLanded(q.tween());
    expect(q.pending()).toEqual([]);
    const snapped = createTransitionQueue();
    snapped.snap(everything());
    expectLanded(snapped.tween());
    expect(snapped.pending()).toEqual([]);
  });

  it('no sequence row progresses while a gate is up', () => {
    const q = createTransitionQueue();
    q.snap(base());
    q.setTarget(litGlowBooth(), 0, OPEN);
    let t = 0;
    for (let i = 0; i < 30; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, NO_CUES);
    }
    const before = JSON.stringify(sampleOf(0, q.tween()));
    const gated: QueueGates = { ...OPEN, modalOpen: true };
    for (let i = 0; i < 50; i += 1) {
      t += 100;
      q.step(t, 100, gated, NO_CUES);
    }
    expect(JSON.stringify(sampleOf(0, q.tween()))).toBe(before);
  });

  it('step keeps the sequence arrays (identity) while the rows run', () => {
    const q = createTransitionQueue();
    q.snap(base());
    q.setTarget(everything(), 0, OPEN);
    const first = q.tween();
    const arrays = [first.windows, first.motes, first.moteFall, first.scrapBurn, first.chladni];
    for (let i = 1; i <= 400; i += 1) {
      const tw = q.step(i * 100, 100, OPEN, NO_CUES);
      expect(tw).toBe(first);
      expect([tw.windows, tw.motes, tw.moteFall, tw.scrapBurn, tw.chladni]).toEqual(arrays);
      expect(tw.windows).toBe(arrays[0]);
      expect(tw.chladni).toBe(arrays[4]);
    }
  });
});

// ---- WP24 fix round 1: idle early-out and the reduced receiver ----------------------------------------------------------------------

// The era IV to era V change of the receiver (the rise) and its era row (the crossfade), as the era V entry buys make them.
const ERA_IV: WorldVisualState = stateWith((s) => { s.era = 4; s.eraRow = 3; });
const ERA_V: WorldVisualState = stateWith((s) => { s.era = 5; s.eraRow = 4; });

describe('worldTransitions: idle queue and the reduced receiver (WP24 fix r1)', () => {
  it('an idle queue returns the same tween object with every value unchanged over 1000 steps', () => {
    const q = createTransitionQueue();
    q.snap(everything());
    const tw = q.tween();
    const before = JSON.stringify(tw);
    for (let i = 1; i <= 1000; i += 1) {
      expect(q.step(i * 100, 100, OPEN, NO_CUES)).toBe(tw);
    }
    expect(JSON.stringify(tw)).toBe(before);
    expect(q.pending()).toEqual([]);
  });

  it('a target change after a long idle period starts and finishes with the same gaps and durations as on a fresh queue', () => {
    const busy = stateWith((s) => {
      s.eraRow = 1;
      s.alpha = 0.85;
      s.shadows = false;
      s.mode = 'fps8';
      s.sensor.led = 'amber';
      s.props.windows = 'lit';
      s.props.windowsLit = 6;
      s.props.lamp = 'lit';
      s.props.lampGlow = true;
    });
    // One line per step: the active rows (id, start relative to the change, span, k) and the whole tween.
    const log = (idleSteps: number): string[] => {
      const q = createTransitionQueue();
      q.snap(base());
      let now = 0;
      for (let i = 0; i < idleSteps; i += 1) {
        now += 100;
        q.step(now, 100, OPEN, NO_CUES);
      }
      const at = now;
      q.setTarget(busy, at, OPEN);
      const lines: string[] = [];
      for (let i = 0; i < 1500; i += 1) {
        now += 100;
        const tw = q.step(now, 100, OPEN, NO_CUES);
        const rows = q.pending().map((p) => [p.id, p.startedAtMs === null ? null : p.startedAtMs - at, p.durMs, p.k]);
        lines.push(JSON.stringify({ rows, tw }));
      }
      return lines;
    };
    const fresh = log(0);
    expect(fresh.some((line) => JSON.parse(line).rows.length > 0)).toBe(true);
    expect(JSON.parse(fresh[fresh.length - 1] ?? '{"rows":[1]}').rows).toEqual([]);
    expect(log(1000)).toEqual(fresh);
  });

  it('reduced motion: the receiver rise starts only after the era row has landed', () => {
    const r = timeline(ERA_IV, ERA_V, 20000, STEP, REDUCED);
    const eraLeft = r.leaveAt.get('eraRow') ?? Number.NaN;
    const riseStart = r.startAt.get('receiverLevelK') ?? Number.NaN;
    expect(Number.isFinite(eraLeft)).toBe(true);
    expect(Number.isFinite(riseStart)).toBe(true);
    expect(riseStart).toBeGreaterThanOrEqual(eraLeft);
    const q = createTransitionQueue();
    q.snap(ERA_IV);
    q.setTarget(ERA_V, 0, REDUCED);
    let now = 0;
    for (let i = 0; i < 1000; i += 1) {
      now += 100;
      q.step(now, 100, REDUCED, NO_CUES);
    }
    expect(q.tween().receiverLevelK).toBe(1);
    expect(q.pending()).toEqual([]);
  });

  it('not reduced: the receiver rise keeps its stagger slot and starts while the era row is still crossfading', () => {
    const r = timeline(ERA_IV, ERA_V, 20000, STEP);
    const eraLeft = r.leaveAt.get('eraRow') ?? Number.NaN;
    const riseStart = r.startAt.get('receiverLevelK') ?? Number.NaN;
    expect(Number.isFinite(riseStart)).toBe(true);
    expect(riseStart).toBeLessThan(eraLeft);
  });

  it('a receiver rise cancelled before it starts leaves no wait behind for the next change', () => {
    const q = createTransitionQueue();
    q.snap(ERA_IV);
    q.setTarget(ERA_V, 0, REDUCED);
    q.setTarget(ERA_IV, 0, REDUCED);
    expect(q.pending().some((p) => p.id === 'receiverLevelK')).toBe(false);
    q.setTarget(ERA_V, 0, OPEN);
    let riseAt = Number.NaN;
    let eraLeftAt = Number.NaN;
    let now = 0;
    for (let i = 0; i < 200; i += 1) {
      now += 100;
      q.step(now, 100, OPEN, NO_CUES);
      const pend = q.pending();
      const rise = pend.find((p) => p.id === 'receiverLevelK');
      if (Number.isNaN(riseAt) && rise?.startedAtMs !== null && rise !== undefined) riseAt = now;
      if (Number.isNaN(eraLeftAt) && !pend.some((p) => p.id === 'eraRow')) eraLeftAt = now;
    }
    expect(Number.isFinite(riseAt)).toBe(true);
    expect(riseAt).toBeLessThan(eraLeftAt);
  });
});

describe('worldTransitions: falling windows and the dead-to-warm batch (T5b)', () => {
  it('era V windows go dark one by one in descending order: two flickers, then a fade, windowsDark.gapMs apart', () => {
    const fewer = stateWith((s) => { s.era = 5; s.props.windows = 'lit'; s.props.windowsLit = 4; });
    const r = timeline(windowsLit6(), fewer, 12000, STEP);
    const first5 = firstAt(r.samples, (s) => (s.windows[5] ?? 1) < 1);
    const first4 = firstAt(r.samples, (s) => (s.windows[4] ?? 1) < 1);
    expect(first4 - first5).toBeGreaterThanOrEqual(rows.windowsDark.gapMs - TOL);
    // The first dip is one flicker phase into the row; the dark flickers then the fade run from the row start.
    const phase = rows.windowsDark.flickerMs;
    const start5 = first5 - phase;
    const flickerLen = (2 * rows.windowsDark.flickers + 1) * phase;
    const dark5 = firstAt(r.samples, (s) => s.now >= start5 + flickerLen && (s.windows[5] ?? 1) <= 0);
    expect(dark5 - (start5 + flickerLen)).toBeGreaterThanOrEqual(rows.windowsDark.fadeMs - TOL);
    const flickerEndAt = start5 + flickerLen;
    const flickers = offEdges(r.samples.filter((s) => s.now <= flickerEndAt), (s) => s.windows[5] ?? 0);
    expect(flickers.length).toBe(rows.windowsDark.flickers);
    expect(r.samples.every((s) => s.windows.slice(0, 4).every((v) => v === 1))).toBe(true);
    expect(last(r.samples).windows).toEqual([1, 1, 1, 1, 0, 0]);
  });

  it('dead to warm in one batch: the buzz runs first, then the warm shift and the warm glow', () => {
    const r = timeline(base(), warmGlow(), rows.lampWarm.ms + 6000, STEP);
    const start = r.startAt.get('lamp') ?? Number.NaN;
    expect(firstAt(r.samples, (s) => s.lamp > 1.0001) - start).toBeGreaterThanOrEqual(rows.lamp.buzzMs - STEP);
    expect(last(r.samples).lamp).toBe(2);
    expect(last(r.samples).glow).toBe(1);
    expect(last(r.samples).glowWarm).toBe(true);
    expect(maxEdgesPerSecond(offEdges(r.samples, (s) => s.lampK))).toBeLessThanOrEqual(3);
  });
});

// ---- WP24 r3-F2: queue parity and the ROWS-order ties (the active list) ----------------------------------------------------------------

// A seeded run of targets, gates, clock steps, cues, settles and snaps. Every step's whole tween and pending() list is hashed (two 32-bit
// hashes of the JSON line). The digest was taken from the queue before the active list (r3-F2): a changed value or a changed pending
// order fails it.
const PARITY_SEED = 31;
const PARITY_STEPS = 6000;
const PARITY_DT_MS: readonly number[] = [16.7, 50, 100, 250, 500];
const PARITY_ERAS: readonly WorldEra[] = [1, 2, 3, 4, 5];
const PARITY_DIGEST = 'de17f4d-168ab288';
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function pickOf<T>(rand: () => number, xs: readonly T[]): T {
  const x = xs[Math.floor(rand() * xs.length)];
  if (x === undefined) throw new Error('pickOf: empty list');
  return x;
}

// A random visual state: every field the queue reads takes a value from its own range.
function randomState(rand: () => number): WorldVisualState {
  const on = (): boolean => rand() < 0.5;
  return stateWith((s) => {
    s.era = pickOf(rand, PARITY_ERAS);
    s.eraRow = Math.floor(rand() * 6);
    s.alpha = pickOf(rand, [0.75, 0.85]);
    s.shadows = on();
    s.shadowScale = s.shadows ? pickOf(rand, [0.5, 1]) : 0;
    s.mode = pickOf(rand, ['crank', 'fps2', 'fps4', 'fps8'] as const);
    s.reverse = on();
    s.stare = on();
    s.vents = on();
    s.sensor.led = on() ? 'amber' : 'red';
    s.sensor.fog = on();
    s.props.girlWindow = on() ? 'dark' : 'flicker';
    s.props.windows = pickOf(rand, ['off', 'dim', 'lit'] as const);
    s.props.windowsLit = Math.floor(rand() * 7);
    s.props.windowsBreathe = on();
    s.props.lamp = pickOf(rand, ['dead', 'lit', 'warm'] as const);
    s.props.lampGlow = on();
    s.props.lampGlowWarm = on();
    s.props.lampPulse = on();
    s.props.boothLit = on();
    s.props.boothFog = on();
    s.props.motes = on();
    s.props.motesMode = pickOf(rand, ['orbit', 'freeze', 'fall'] as const);
    s.props.holeStage = Math.floor(rand() * 5);
    s.props.scraps = Math.floor(rand() * 4);
    s.props.puddle = { size: pickOf(rand, [0, 1, 2, 3] as const), look: on() ? 'black' : 'grey' };
    s.props.sprout = Math.floor(rand() * 5);
    s.props.chladni = pickOf(rand, [0, 1, 2] as const);
    s.props.chladniViolet = on();
    s.props.virga = pickOf(rand, ['off', 'fall', 'frozen', 'fade'] as const);
  });
}

// Two 32-bit hashes of a string folded in order: FNV-1a and a djb2 variant.
function foldHash(h: { a: number; b: number }, s: string): void {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    h.a = Math.imul(h.a ^ c, FNV_PRIME) >>> 0;
    h.b = (Math.imul(h.b, 31) + c) | 0;
  }
}

function parityRun(): { digest: string; maxPending: number; startsSeen: number } {
  const rand = seeded(PARITY_SEED);
  const q = createTransitionQueue();
  q.snap(base());
  const h = { a: FNV_OFFSET, b: 0 };
  const cues: QueueCues = { digBouts: 0, ventPuffs: 0 };
  let gates: QueueGates = OPEN;
  let settleOn = false;
  let now = 0;
  let maxPending = 0;
  let startsSeen = 0;
  for (let n = 0; n < PARITY_STEPS; n += 1) {
    if (n % 12 === 0) {
      const pick = rand();
      gates = {
        indexOpen: pick < 0.2,
        eraCardUp: pick >= 0.2 && pick < 0.35,
        modalOpen: pick >= 0.35 && pick < 0.5,
        ending: rand() < 0.02 ? pickOf(rand, ['sequence', 'choice', 'postgame'] as const) : 'none',
        reduced: rand() < 0.3,
      };
    }
    const r = rand();
    if (r < 0.04) q.setTarget(randomState(rand), now, gates);
    else if (r < 0.042) q.snap(randomState(rand));
    else if (r < 0.044) {
      settleOn = !settleOn;
      q.settle(settleOn);
    }
    if (rand() < 0.05) cues.digBouts += 1;
    if (rand() < 0.05) cues.ventPuffs += 1;
    const dt = pickOf(rand, PARITY_DT_MS);
    now += dt;
    const tw = q.step(now, dt, gates, cues);
    const pend = q.pending();
    maxPending = Math.max(maxPending, pend.length);
    startsSeen += pend.filter((p) => p.startedAtMs !== null).length;
    foldHash(h, JSON.stringify({ tw, pend }));
  }
  return { digest: `${(h.a >>> 0).toString(16)}-${(h.b >>> 0).toString(16)}`, maxPending, startsSeen };
}

describe('worldTransitions: queue parity (WP24 r3-F2)', () => {
  it('a seeded run of targets, gates, cues, settles and snaps keeps every tween value and the pending order (frozen digest)', () => {
    const run = parityRun();
    // The run must exercise overlapping rows and starts, or the digest proves little.
    expect(run.maxPending).toBeGreaterThanOrEqual(5);
    expect(run.startsSeen).toBeGreaterThan(0);
    expect(run.digest).toBe(PARITY_DIGEST);
  });
});

describe('worldTransitions: the active list keeps ROWS order (WP24 r3-F2)', () => {
  it('two rows of one batch with the same start rank start in ROWS order, whatever the order they were queued in', () => {
    const q = createTransitionQueue();
    q.snap(base());
    const gated: QueueGates = { ...OPEN, indexOpen: true };
    // pulseK queues first (its own change); breatheK joins in a later batch. Both rank 'breathe' and ROWS puts breatheK first.
    q.setTarget(stateWith((s) => { s.props.lampPulse = true; }), 0, gated);
    q.setTarget(stateWith((s) => { s.props.lampPulse = true; s.props.windowsBreathe = true; }), 0, gated);
    expect(q.pending().map((p) => p.id)).toEqual(['breatheK', 'pulseK']);
    let t = 0;
    for (let i = 0; i < 3; i += 1) {
      t += 100;
      q.step(t, 100, gated, { digBouts: 0, ventPuffs: 0 });
    }
    const starts = new Map<string, number>();
    for (let i = 0; i < 200; i += 1) {
      t += 100;
      q.step(t, 100, OPEN, { digBouts: 0, ventPuffs: 0 });
      for (const p of q.pending()) {
        if (p.startedAtMs !== null && !starts.has(p.id)) starts.set(p.id, p.startedAtMs);
      }
    }
    const breathe = starts.get('breatheK') ?? Number.NaN;
    const pulse = starts.get('pulseK') ?? Number.NaN;
    expect(Number.isFinite(breathe)).toBe(true);
    expect(Number.isFinite(pulse)).toBe(true);
    expect(breathe).toBeLessThan(pulse);
    expect(pulse - breathe).toBeGreaterThanOrEqual(WORLD_TRANSITIONS.staggerMs[0]);
    expect(q.pending()).toEqual([]);
  });
});
