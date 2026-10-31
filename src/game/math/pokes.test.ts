// Poke ladder tests (WP28a T15a, A13): the levels, the 600 ms ignore, the 25 s reset, the 20 s unavailable window (A, B, A), the bag rules over
// 1000 pokes for seeds 1 to 5 (the unavailable window included), the answer delay, determinism, and the clip data: frames exist in their
// sheet, the girl and the props never move, Sensor 7 never shows glyphOne or headUp, no pre-finale ban, era IV one accent frame, era V
// stare-safe frames, the answer caps, the reduced-motion form and the crow perches and hop. WP28a fix round 1: the own Splice object tables, the
// level-2 cadence and the level-3 answer (never the same clip twice, every target and era), the Sensor 7 solid LED and the perch rows and ground
// perch. WP28b (B-T6a): the poke bubble rule (B7) and the Splice-top perches (AD3 O-f). Pure: fixed seeds, no clock, no Phaser.
import { describe, it, expect } from 'vitest';
import {
  CROW_HOP, CROW_MACHINE_X, CROW_PERCHES, POKES, POKE_BUBBLE, POKE_OBJECT_KEY, POKE_OBJECT_TABLES, POKE_RENDER, POKE_SHEET, POKE_TABLES,
} from '../../data/pokes';
import type { CrowPerch, PokeClip, PokeSoundId, PokeTable, PokeTargetKey } from '../../data/pokes';
import { WORLD_FRAMES, WORLD_PLACEMENTS } from '../../data/livingWorld';
import type { FramingKey } from '../../data/livingWorld';
import { GROUND_Y, MACHINE_ANCHOR } from '../../data/world';
import { WORLD_PREFINALE_BANNED, WORLD_STARE_SAFE } from '../../data/worldBehaviour';
import { TECH_IDS } from '../../data/types';
import {
  createPokeBubbleState, createPokeLadder, isUnavailable, notePokeBubble, pokeBubbleDue, pokeOn, reducedClip, resetLadder,
} from './pokes';
import type { PokeBubbleActor, PokeResult } from './pokes';

const KEYS: readonly PokeTargetKey[] = [
  'inspector', 'dog', 'crow', 'girlWindow', 'girlMini', 'girlGround', 'sensor7', 'payphone', 'lamp', 'clock', 'object',
];
// The own-art Splice objects: each has its own table (POKE_OBJECT_TABLES); their poke keys are 'object:<id>' (AD2 F10).
const OWN_OBJECTS: readonly string[] = ['spliceBicycle', 'spliceOrgan', 'spliceRadio', 'spliceSign'];
// Every poke key of the reaction tests: the generic keys and the own objects' keys.
const TARGETS: readonly string[] = [...KEYS, ...OWN_OBJECTS.map((id) => `${POKE_OBJECT_KEY}${id}`)];
const ERAS = [1, 2, 3, 4, 5] as const;
const SEEDS = [1, 2, 3, 4, 5] as const;
// The cast targets: the actors with frames (the girl and the props answer with light and sound only).
const CAST: readonly PokeTargetKey[] = ['inspector', 'dog', 'crow', 'sensor7'];
const SOUNDS: readonly PokeSoundId[] = ['tick', 'pencil', 'woof', 'caw', 'beep', 'ring', 'tink', 'note', 'organ', 'bell', 'crackle', 'buzz'];
const LEAVES: readonly (string | null)[] = [null, 'leaveWrite', 'leaveSit', 'hop', 'tilt'];

// Whether a poke key is a generic target (the keys of POKE_TABLES).
function isTargetKey(key: string): key is PokeTargetKey {
  return KEYS.some((k) => k === key);
}
// The table of a poke key and era (a missing one fails the test). An object key reads the object's own table when it has one.
function tableOf(key: string, era: number): PokeTable {
  const own = key.startsWith(POKE_OBJECT_KEY) ? POKE_OBJECT_TABLES[key.slice(POKE_OBJECT_KEY.length)] : undefined;
  const list = own ?? (isTargetKey(key) ? POKE_TABLES[key] : undefined);
  const t = list?.[era - 1];
  if (t === undefined) throw new Error(`no table for ${key} era ${era}`);
  return t;
}
// Every answer of a table: the bag, the level-2 and level-3 clips and the two wordless unavailable ones.
function allClips(t: PokeTable): PokeClip[] {
  return [...t.l1, t.l2, t.l3, ...t.unavailable];
}
const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);
// A deterministic fraction in [0, 1) from a number (the sine law; the test's own draws, independent of the ladder).
function frac(n: number): number {
  const f = Math.sin(n * 12.9898) * 43758.5453;
  return f - Math.floor(f);
}

describe('levels and the ignore window (A13)', () => {
  it('levels: the first two pokes are level 1, the third level 2, the fourth level 3 with the leave id', () => {
    const l = createPokeLadder(1);
    const got = [0, 1000, 2000, 3000].map((t) => pokeOn(l, 'inspector', 1, t));
    expect(got.map((r) => r?.level)).toEqual([1, 1, 2, 3]);
    expect(got[3]?.leave).toBe('leaveWrite');
    expect(got[3]?.unavailable).toBe(false);
    expect(got[0]?.leave).toBeNull();
    expect(got[2]?.leave).toBeNull();
  });

  it('every target, era and seed 1-5: pokes 3 and 4 never repeat a clip; answer 4 stays level 3 with the table leave; the target is then unavailable', () => {
    const bad: string[] = [];
    for (const key of TARGETS) {
      for (const era of ERAS) {
        for (const seed of SEEDS) {
          const label = `${key} era ${era} seed ${seed}`;
          const l = createPokeLadder(seed);
          const got = [0, 1000, 2000, 3000].map((t) => pokeOn(l, key, era, t));
          const a3 = got[2];
          const a4 = got[3];
          if (a3 === null || a3 === undefined || a4 === null || a4 === undefined) {
            bad.push(`${label}: a spaced poke was ignored`);
            continue;
          }
          if (a3.level !== 2) bad.push(`${label}: answer 3 is level ${a3.level}`);
          if (a4.clip.id === a3.clip.id) bad.push(`${label}: answer 4 repeats ${a4.clip.id}`);
          if (a4.level !== 3 || a4.unavailable || a4.leave !== tableOf(key, era).leave) bad.push(`${label}: answer 4 is not the leave answer`);
          if (!isUnavailable(l, key, 3500)) bad.push(`${label}: not unavailable after answer 4`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('a poke within 600 ms of the last accepted one on its target returns null; the ignored pokes do not count', () => {
    const l = createPokeLadder(2);
    expect(pokeOn(l, 'lamp', 1, 1000)).not.toBeNull();
    expect(pokeOn(l, 'lamp', 1, 1300)).toBeNull();
    expect(pokeOn(l, 'lamp', 1, 1599)).toBeNull();
    expect(pokeOn(l, 'lamp', 1, 1600)?.level).toBe(1);
    expect(pokeOn(l, 'clock', 1, 1300)).not.toBeNull();
  });

  it('the count starts again after 25 s without a poke; pokes 7 s apart never reach level 2 (only 8 s count)', () => {
    const a = createPokeLadder(3);
    [0, 1000, 2000].forEach((t) => pokeOn(a, 'dog', 1, t));
    expect(pokeOn(a, 'dog', 1, 27000)?.level).toBe(1);
    const b = createPokeLadder(4);
    const levels = [0, 7000, 14000, 21000, 28000].map((t) => pokeOn(b, 'dog', 1, t)?.level);
    expect(levels).toEqual([1, 1, 1, 1, 1]);
  });

  it('resetLadder clears the counts and the unavailable window; the bags keep their picks and the last reaction stays', () => {
    const l = createPokeLadder(5);
    [0, 1000, 2000, 3000].forEach((t) => pokeOn(l, 'crow', 1, t));
    expect(isUnavailable(l, 'crow', 3500)).toBe(true);
    resetLadder(l);
    expect(isUnavailable(l, 'crow', 3500)).toBe(false);
    const after = pokeOn(l, 'crow', 1, 3700);
    expect(after?.level).toBe(1);
    expect(after?.unavailable).toBe(false);
  });
});

describe('the unavailable window (A13)', () => {
  it('after level 3 the 20 s window alternates the two wordless answers A, B, A: never the same twice in a row', () => {
    const l = createPokeLadder(6);
    [0, 1000, 2000, 3000].forEach((t) => pokeOn(l, 'inspector', 1, t));
    const t = tableOf('inspector', 1);
    const seq: PokeResult[] = [];
    for (let at = 3700; at < 23000; at += 700) {
      const r = pokeOn(l, 'inspector', 1, at);
      if (r !== null) seq.push(r);
    }
    expect(seq.length).toBeGreaterThan(20);
    expect(seq.every((r) => r.level === 3 && r.unavailable && r.leave === null && r.clip.durMs <= POKES.unavailableAnswerMs)).toBe(true);
    expect(seq.map((r) => r.clip.id)).toEqual(seq.map((_, i) => (i % 2 === 0 ? t.unavailable[0].id : t.unavailable[1].id)));
    expect(isUnavailable(l, 'inspector', 22900)).toBe(true);
    expect(isUnavailable(l, 'inspector', 23000)).toBe(false);
  });

  it('after the window, and after a long pause, the target answers normally again', () => {
    const l = createPokeLadder(7);
    [0, 1000, 2000, 3000].forEach((t) => pokeOn(l, 'dog', 1, t));
    const after = pokeOn(l, 'dog', 1, 40000);
    expect(after?.unavailable).toBe(false);
    expect(after?.level).toBe(1);
  });
});

describe('the bags over 1000 pokes (A13: seeds 1 to 5, the unavailable window included)', () => {
  it('no reaction repeats the one before it; a bag of three or more never repeats within its last two picks; delays are 300-500 ms', () => {
    const bad: string[] = [];
    const levelsSeen = new Set<string>();
    for (const seed of SEEDS) {
      for (const key of TARGETS) {
        for (const era of ERAS) {
          const l = createPokeLadder(seed);
          const bagSize = tableOf(key, era).l1.length;
          const picks: string[] = [];
          let prev: PokeResult | null = null;
          let at = 0;
          for (let i = 0; i < 1000; i++) {
            const gap = frac(seed * 1000 + i) < 0.9 ? POKES.minGapMs + Math.floor(frac(seed * 7919 + i) * 4000) : 26000;
            at += gap;
            const r = pokeOn(l, key, era, at);
            if (r === null) {
              bad.push(`${seed} ${key} ${era} ${i}: a spaced poke was ignored`);
              break;
            }
            levelsSeen.add(r.unavailable ? 'unavailable' : `level${r.level}`);
            if (r.delayMs < POKES.answerDelayMs[0] || r.delayMs >= POKES.answerDelayMs[1]) bad.push(`${seed} ${key} ${era}: delay ${r.delayMs}`);
            // Every consecutive pair of accepted pokes (all levels, the unavailable window included): never the same reaction twice (D4).
            if (prev !== null && r.clip.id === prev.clip.id) {
              bad.push(`${seed} ${key} ${era} ${i}: ${r.clip.id} repeats`);
            }
            // The bag's picks: the level-1 picks and the level-2 answers that repeated a level-2 clip (B4, a bag pick too).
            if (!r.unavailable && tableOf(key, era).l1.some((c) => c.id === r.clip.id)) picks.push(r.clip.id);
            prev = r;
          }
          if (bagSize >= 3) {
            for (let j = 2; j < picks.length; j++) {
              const c = picks[j];
              if (c === picks[j - 1] || c === picks[j - 2]) bad.push(`${seed} ${key} ${era}: bag pick ${j} repeats within two picks`);
            }
          }
        }
      }
    }
    // The cadence (B4, D4): pokes at 0, 1 s and 2 s, then the same triple every 8.5 s. Three pokes sit in the 8 s window, so the answers are
    // levels 1 and 2 only, and no two answers in a row share a clip (a level-2 clip never answers twice).
    for (const seed of SEEDS) {
      for (const key of TARGETS) {
        for (const era of ERAS) {
          const l = createPokeLadder(seed);
          let last: string | null = null;
          for (let i = 0; i < 1000; i++) {
            const r = pokeOn(l, key, era, Math.floor(i / 3) * 8500 + (i % 3) * 1000);
            if (r === null || r.unavailable || r.level === 3) {
              bad.push(`${seed} ${key} ${era} ${i}: the cadence poke was ${r === null ? 'ignored' : 'not level 1 or 2'}`);
              break;
            }
            if (r.clip.id === last) bad.push(`${seed} ${key} ${era} ${i}: cadence ${r.clip.id} repeats`);
            last = r.clip.id;
          }
        }
      }
    }
    expect(bad).toEqual([]);
    expect([...levelsSeen].sort()).toEqual(['level1', 'level2', 'level3', 'unavailable']);
  });

  it('the same seed gives the same answers; another seed picks differently', () => {
    const run = (seed: number): string => {
      const l = createPokeLadder(seed);
      const out: unknown[] = [];
      for (let i = 0; i < 120; i++) {
        const r = pokeOn(l, 'crow', 1, 700 * (i + 1));
        out.push(r === null ? null : [r.level, r.unavailable, r.clip.id, r.leave, r.delayMs]);
      }
      return JSON.stringify(out);
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });

  it('an object key maps to the object table and each object keeps its own count; unknown keys and eras give null', () => {
    const l = createPokeLadder(9);
    expect(pokeOn(l, `${POKE_OBJECT_KEY}spliceOrgan`, 1, 0)).not.toBeNull();
    expect(pokeOn(l, `${POKE_OBJECT_KEY}spliceBicycle`, 1, 100)?.level).toBe(1);
    expect(pokeOn(l, 'nope', 1, 0)).toBeNull();
    expect(pokeOn(l, 'dog', 0, 0)).toBeNull();
    expect(pokeOn(l, 'dog', 6, 0)).toBeNull();
  });
});

// The own-art Splice objects (AD2 F10): each answers from its own table, so a woken radio never plays the sign's buzz; Sensor 7's solid LED (AD2
// F18) on levels 2 and 3.
describe('own tables and the Sensor 7 solid LED (AD2 F10, F18)', () => {
  // The signature sound of each own-art object (its l1 pair is that sound and a tick).
  const OWN_SOUNDS: Readonly<Record<string, PokeSoundId>> = {
    spliceBicycle: 'bell', spliceOrgan: 'organ', spliceRadio: 'crackle', spliceSign: 'buzz',
  };

  it('the four objects have their own tables in every era: the sounds are its own and tick, no frames, no leave', () => {
    expect(Object.keys(POKE_OBJECT_TABLES).sort()).toEqual([...OWN_OBJECTS].sort());
    for (const id of OWN_OBJECTS) {
      for (const era of ERAS) {
        const t = tableOf(`${POKE_OBJECT_KEY}${id}`, era);
        expect(t.leave, `${id} era ${era}`).toBeNull();
        expect(t.l1.map((c) => c.sound), `${id} era ${era}`).toContain(OWN_SOUNDS[id]);
        for (const clip of allClips(t)) {
          expect(clip.frames, `${id} era ${era} ${clip.id}`).toEqual([]);
          expect(['tick', OWN_SOUNDS[id]], `${id} era ${era} ${clip.id}`).toContain(clip.sound);
        }
      }
    }
  });

  it('every answer of an own object is a clip of its own table; the unavailable window alternates the two variants', () => {
    for (const id of OWN_OBJECTS) {
      for (const era of ERAS) {
        const key = `${POKE_OBJECT_KEY}${id}`;
        const t = tableOf(key, era);
        const ids = new Set(allClips(t).map((c) => c.id));
        const l = createPokeLadder(21 + era);
        const got: PokeResult[] = [];
        for (const at of [0, 1000, 2000, 3000]) {
          const r = pokeOn(l, key, era, at);
          if (r !== null) got.push(r);
        }
        for (let at = 3700; at < 23000; at += 700) {
          const r = pokeOn(l, key, era, at);
          if (r !== null) got.push(r);
        }
        expect(got.map((r) => r.level).slice(0, 4), `${key} era ${era}`).toEqual([1, 1, 2, 3]);
        expect(got.every((r) => ids.has(r.clip.id)), `${key} era ${era}`).toBe(true);
        const unavailable = got.slice(4);
        expect(unavailable.length, `${key} era ${era}`).toBeGreaterThan(20);
        expect(unavailable.every((r) => r.unavailable && r.clip.durMs <= POKES.unavailableAnswerMs), `${key} era ${era}`).toBe(true);
        expect(unavailable.map((r) => r.clip.id)).toEqual(unavailable.map((_, i) => (i % 2 === 0 ? t.unavailable[0].id : t.unavailable[1].id)));
      }
    }
  });

  it('Sensor 7 levels 2 and 3 are the solid LED (one headC frame, ledSolid, within the answer cap); the lens glint is unavailable', () => {
    for (const era of ERAS) {
      const t = tableOf('sensor7', era);
      for (const clip of [t.l2, t.l3]) {
        expect(clip.light, `sensor7 era ${era} ${clip.id}`).toBe('ledSolid');
        expect(clip.frames, `sensor7 era ${era} ${clip.id}`).toEqual(['headC']);
        expect(clip.durMs, `sensor7 era ${era} ${clip.id}`).toBeLessThanOrEqual(POKES.maxAnswerMs);
      }
      expect(t.unavailable.map((c) => c.light), `sensor7 era ${era}`).toContain('lensGlint');
    }
    expect(POKE_RENDER.lensGlintMs).toBe(150);
    expect(POKE_RENDER.ledSolidMs).toBe(3000);
  });
});

describe('clip data (WP28 Pokes, C7, C11, C12)', () => {
  it('every frame of an answer is a frame of its target sheet; a target without a sheet has no frames', () => {
    for (const key of KEYS) {
      for (const era of ERAS) {
        for (const clip of allClips(tableOf(key, era))) {
          const sheet = POKE_SHEET[key];
          if (sheet === undefined) {
            expect(clip.frames, `${key} era ${era} ${clip.id}`).toEqual([]);
            continue;
          }
          for (const f of clip.frames) expect(WORLD_FRAMES[sheet], `${key} era ${era} ${clip.id} ${f}`).toContain(f);
        }
      }
    }
  });

  it('the frame holds match the frames, the durations add up, every answer is at most 2000 ms and the unavailable ones 800 ms', () => {
    for (const key of KEYS) {
      for (const era of ERAS) {
        const t = tableOf(key, era);
        for (const clip of allClips(t)) {
          const label = `${key} era ${era} ${clip.id}`;
          expect(clip.frameMs.length, label).toBe(clip.frames.length);
          if (clip.frames.length > 0) expect(clip.durMs, label).toBe(sum(clip.frameMs));
          expect(clip.durMs, label).toBeGreaterThan(0);
          expect(clip.durMs, label).toBeLessThanOrEqual(POKES.maxAnswerMs);
          if (clip.sound !== null) expect(SOUNDS, label).toContain(clip.sound);
        }
        for (const clip of t.unavailable) expect(clip.durMs, `${key} era ${era} unavailable ${clip.id}`).toBeLessThanOrEqual(POKES.unavailableAnswerMs);
      }
    }
  });

  it('the girl and the props answer with light and sound only: no frame, so the girl never moves on screen (C12)', () => {
    for (const key of KEYS) {
      if (CAST.includes(key)) continue;
      for (const era of ERAS) {
        for (const clip of allClips(tableOf(key, era))) expect(clip.frames, `${key} era ${era} ${clip.id}`).toEqual([]);
      }
    }
  });

  it('Sensor 7 never shows glyphOne or headUp (C7)', () => {
    for (const era of ERAS) {
      for (const clip of allClips(tableOf('sensor7', era))) {
        expect(clip.frames, `sensor7 era ${era} ${clip.id}`).not.toContain('glyphOne');
        expect(clip.frames, `sensor7 era ${era} ${clip.id}`).not.toContain('headUp');
      }
    }
  });

  it('no answer of a pre-finale actor draws a banned payoff frame, and no answer draws the crow fly frames (the hop is poke-only)', () => {
    for (const key of ['inspector', 'dog', 'crow'] as const) {
      for (const era of ERAS) {
        for (const clip of allClips(tableOf(key, era))) {
          for (const f of clip.frames) {
            expect(WORLD_PREFINALE_BANNED[key], `${key} era ${era} ${clip.id} ${f}`).not.toContain(f);
            expect(f.startsWith('fly'), `${key} era ${era} ${clip.id} ${f}`).toBe(false);
          }
        }
      }
    }
  });

  it('era IV answers of the cast are one off-beat accent frame each (C11)', () => {
    for (const key of ['inspector', 'dog', 'crow'] as const) {
      for (const clip of allClips(tableOf(key, 4))) expect(clip.frames.length, `${key} ${clip.id}`).toBe(1);
    }
  });

  it('era V cast answers draw the stare-safe frames only (the stare shows camera-facing frames)', () => {
    for (const key of ['inspector', 'dog', 'crow'] as const) {
      for (const clip of allClips(tableOf(key, 5))) {
        for (const f of clip.frames) expect(WORLD_STARE_SAFE[key], `era 5 ${key} ${clip.id} ${f}`).toContain(f);
      }
    }
  });

  it('every level-1 bag has at least two clips, so a bag never has to repeat; every leave names a known leave id', () => {
    for (const key of TARGETS) {
      for (const era of ERAS) {
        const t = tableOf(key, era);
        expect(t.l1.length, `${key} era ${era} bag`).toBeGreaterThanOrEqual(2);
        expect(LEAVES, `${key} era ${era} leave`).toContain(t.leave);
      }
    }
  });

  it('the reduced-motion form holds the longest frame for at most 1200 ms and keeps the sound and the id', () => {
    for (const key of TARGETS) {
      for (const era of ERAS) {
        for (const clip of allClips(tableOf(key, era))) {
          const rc = reducedClip(clip);
          expect(rc.durMs, clip.id).toBeLessThanOrEqual(POKES.reducedHoldMs);
          expect(rc.durMs, clip.id).toBeLessThanOrEqual(clip.durMs);
          expect(rc.sound, clip.id).toBe(clip.sound);
          expect(rc.id, clip.id).toBe(clip.id);
          if (clip.frames.length > 0) {
            const longest = clip.frameMs.indexOf(Math.max(...clip.frameMs));
            expect(rc.frames, clip.id).toEqual([clip.frames[longest]]);
          } else {
            expect(rc.frames, clip.id).toEqual([]);
          }
        }
      }
    }
  });
});

describe('the crow perches and the hop (C3)', () => {
  it('the perches sit on the right wing, outside the machine x-range and above the ground; s8 and s8w hold the AD1 perches, s10 has none', () => {
    expect(CROW_PERCHES.s8?.map((p) => p.id)).toEqual(['lampTop', 'boothRoof', 'clockTop']);
    expect(CROW_PERCHES.s8w?.map((p) => p.id)).toEqual(['lampTop', 'boothRoof']);
    expect(CROW_PERCHES.s10).toEqual([]);
    for (const [framing, perches] of Object.entries(CROW_PERCHES) as [FramingKey, readonly { id: string; x: number; y: number }[]][]) {
      const ids = perches.map((p) => p.id);
      expect(new Set(ids).size, `${framing} ids`).toBe(ids.length);
      for (const p of perches) {
        expect(p.x, `${framing} ${p.id} x`).toBeGreaterThan(MACHINE_ANCHOR.x);
        const machine = CROW_MACHINE_X[framing];
        expect(machine, `${framing} machine x-range`).toBeDefined();
        if (machine !== undefined) expect(p.x, `${framing} ${p.id} outside the machine`).toBeGreaterThan(machine.right);
        // The documented exemptions: the ground perch by the dog stands on the dog's ground row, and the bell frame (a Splice top, WP28b) on the
        // bell's front-row feet; both sit below the ground line (B3).
        if (p.id === 'groundDog') expect(p.y, `${framing} ${p.id} y`).toBe(GROUND_Y + 32);
        else if (p.id === 'bellFrame') expect(p.y, `${framing} ${p.id} y`).toBe(GROUND_Y + 64);
        // The bicycle seat and the sign top (WP28b FIX-C) sit on yard lanes too, so their feet may stand below the ground line.
        else if (p.id !== 'bicycleSeat' && p.id !== 'signTop') expect(p.y, `${framing} ${p.id} y`).toBeLessThan(GROUND_Y);
        expect(p.y, `${framing} ${p.id} y`).toBeGreaterThan(GROUND_Y - 200);
      }
    }
  });

  it('the perch feet sit on the top opaque rows (AD2 F8): lampTop G-112, boothRoof G-102, clockTop G-88; s15 has no clockTop', () => {
    const rows: Record<string, number> = { lampTop: 112, boothRoof: 102, clockTop: 88 };
    for (const perches of Object.values(CROW_PERCHES)) {
      for (const p of perches ?? []) {
        const height = rows[p.id];
        if (height !== undefined) expect(p.y, `${p.id} feet`).toBe(GROUND_Y - height);
      }
    }
    // AD4 F43 (WP28b round 3): s15 drops the bicycle seat (it sits under the chimes pendant); its lamp top and booth roof stay.
    expect(CROW_PERCHES.s15?.map((p) => p.id)).toEqual(['lampTop', 'boothRoof']);
  });

  it('the ground perch by the dog: e1 36 px right of the dog (2400), s9 and s11 at 2924, none at s8, s8w, s10 and s15', () => {
    const ground = (f: FramingKey): { id: string; x: number; y: number } | undefined => CROW_PERCHES[f]?.find((p) => p.id === 'groundDog');
    expect(WORLD_PLACEMENTS.e1.dog?.x).toBe(2364);
    expect(ground('e1')).toEqual({ id: 'groundDog', x: 2400, y: GROUND_Y + 32 });
    expect(ground('s9')?.x).toBe(2924);
    expect(ground('s11')?.x).toBe(2924);
    for (const f of ['s8', 's8w', 's10', 's15'] as const) expect(ground(f), f).toBeUndefined();
  });

  it('the hop limits: at most 160 px, an apex of at most 48 px, and frames the crow sheet has', () => {
    expect(CROW_HOP.maxDistPx).toBeLessThanOrEqual(160);
    expect(CROW_HOP.apexMaxPx).toBeLessThanOrEqual(48);
    expect(WORLD_FRAMES.crow).toEqual(expect.arrayContaining([...CROW_HOP.flyFrames, ...CROW_HOP.landFrames]));
  });

  it('the Splice tops (WP28b, AD3 O-f): s11 has whistleTop (G-88, spliceWhistle) and bellFrame (G+64, spliceBell); s10 has none', () => {
    const s11 = CROW_PERCHES.s11 ?? [];
    expect(s11.find((p) => p.id === 'whistleTop')).toEqual({ id: 'whistleTop', x: 2970, y: GROUND_Y - 88, spliceTop: 'spliceWhistle' });
    expect(s11.find((p) => p.id === 'bellFrame')).toEqual({ id: 'bellFrame', x: 3150, y: GROUND_Y + 64, spliceTop: 'spliceBell' });
    expect(CROW_PERCHES.s10).toEqual([]);
    expect(CROW_PERCHES.s15?.map((p) => p.id)).toEqual(['lampTop', 'boothRoof']);
    for (const perches of Object.values(CROW_PERCHES)) {
      for (const p of perches ?? []) {
        if (p.spliceTop !== undefined) expect(TECH_IDS, p.id).toContain(p.spliceTop);
      }
    }
  });

  it('every pair of perches a hop could join is at most 160 px apart, its apex at most 48 px, and its arc clears the machine x-range (C3)', () => {
    const bad: string[] = [];
    for (const [framing, perches] of Object.entries(CROW_PERCHES) as [FramingKey, readonly CrowPerch[]][]) {
      const machine = CROW_MACHINE_X[framing];
      if (machine === undefined) {
        bad.push(`${framing}: no machine x-range`);
        continue;
      }
      perches.forEach((a, i) => perches.slice(i + 1).forEach((b) => {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d > CROW_HOP.maxDistPx) return;
        const label = `${framing} ${a.id}-${b.id}`;
        const apex = Math.min(CROW_HOP.apexMaxPx, CROW_HOP.apexPerDist * d + CROW_HOP.apexAddPx);
        if (apex > 48) bad.push(`${label}: apex ${apex}`);
        if (Math.max(a.x, b.x) >= machine.left && Math.min(a.x, b.x) <= machine.right) bad.push(`${label}: arc over the machine`);
      }));
    }
    expect(bad).toEqual([]);
  });

  it('the Splice tops hop as the AD3 table says: whistleTop to clockTop 80 px, to groundDog 129 px; the bell frame is out of reach of the other s11 perches', () => {
    const s11 = CROW_PERCHES.s11 ?? [];
    const at = (id: string): CrowPerch => {
      const p = s11.find((q) => q.id === id);
      if (p === undefined) throw new Error(`no s11 perch ${id}`);
      return p;
    };
    const dist = (a: string, b: string): number => Math.hypot(at(b).x - at(a).x, at(b).y - at(a).y);
    expect(dist('whistleTop', 'clockTop')).toBe(80);
    expect(dist('whistleTop', 'groundDog')).toBeCloseTo(128.5, 1);
    // The bell frame is reached from the kite's arm end only (era V, the Director's replacement of lampTop), not from this list.
    for (const id of ['clockTop', 'groundDog', 'boothRoof', 'lampTop', 'whistleTop']) {
      expect(dist(id, 'bellFrame'), id).toBeGreaterThan(CROW_HOP.maxDistPx);
    }
  });

  it('the bicycle seat and the sign top (WP28b FIX-C, AD3 O-f): appended after the lamp top, on the right wing, each within a hop of a perch', () => {
    expect(CROW_PERCHES.e1?.map((p) => p.id)).toEqual(['lampTop', 'boothRoof', 'clockTop', 'groundDog', 'bicycleSeat']);
    expect(CROW_PERCHES.s9?.map((p) => p.id)).toEqual(['lampTop', 'boothRoof', 'clockTop', 'dropWire', 'groundDog', 'bicycleSeat', 'signTop']);
    expect(CROW_PERCHES.s11?.map((p) => p.id)).toEqual(['lampTop', 'boothRoof', 'clockTop', 'groundDog', 'whistleTop', 'bellFrame', 'bicycleSeat', 'signTop']);
    expect(CROW_PERCHES.e1?.find((p) => p.id === 'bicycleSeat')).toEqual({ id: 'bicycleSeat', x: 2483, y: GROUND_Y + 68, spliceTop: 'spliceBicycle' });
    expect(CROW_PERCHES.s9?.find((p) => p.id === 'bicycleSeat')).toEqual({ id: 'bicycleSeat', x: 2919, y: GROUND_Y + 104, spliceTop: 'spliceBicycle' });
    expect(CROW_PERCHES.s9?.find((p) => p.id === 'signTop')).toEqual({ id: 'signTop', x: 2972, y: GROUND_Y - 22, spliceTop: 'spliceSign' });
    expect(CROW_PERCHES.s11?.find((p) => p.id === 'bicycleSeat')).toEqual({ id: 'bicycleSeat', x: 2955, y: GROUND_Y + 104, spliceTop: 'spliceBicycle' });
    expect(CROW_PERCHES.s11?.find((p) => p.id === 'signTop')).toEqual({ id: 'signTop', x: 3078, y: GROUND_Y + 32, spliceTop: 'spliceSign' });
    // AD4 F43: s15 has no bicycle seat (it sits under the chimes pendant), so the bicycle tops are five.
    expect(CROW_PERCHES.s15?.find((p) => p.id === 'bicycleSeat')).toBeUndefined();
    // The bicycle and the sign tops only: each names a tech, sits outside the machine x-range and has another perch within a hop.
    const bicycleOrSign: readonly string[] = ['spliceBicycle', 'spliceSign'];
    let tops = 0;
    for (const [framing, perches] of Object.entries(CROW_PERCHES) as [FramingKey, readonly CrowPerch[]][]) {
      for (const p of perches) {
        if (p.spliceTop === undefined || !bicycleOrSign.includes(p.spliceTop)) continue;
        tops += 1;
        expect(TECH_IDS, `${framing} ${p.id}`).toContain(p.spliceTop);
        expect(p.x, `${framing} ${p.id} right wing`).toBeGreaterThan(CROW_MACHINE_X[framing]?.right ?? Number.POSITIVE_INFINITY);
        const reach = Math.min(...perches.filter((q) => q !== p).map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
        expect(reach, `${framing} ${p.id} reach`).toBeLessThanOrEqual(CROW_HOP.maxDistPx);
      }
    }
    expect(tops).toBe(5);
  });
});

// The poke bubbles (WP28b, P12, B7): the caps, the RARE chance, the line-bubble block, the state, the strings through the text lint, determinism.
// Neither bubble counts against the era voice caps, so nothing here reads the scheduler.
describe('poke bubbles (WP28b, P12, B7)', () => {
  const ON = { voices: 'on', lineBubbleUp: false } as const;
  // The words the bible bans before the finale (STORY_BIBLE §2.4, the same list textSweep's living world lint reads).
  const BANNED_BEFORE_FINALE = /restor|prior|rewind|undo|\bheal|repair|as it was|back the way|record|hold.{0,24}run|while it runs|running|keep it|\becho|memory|\bcycle\b|wishlist|\bsteam\b|full game|trailer|tutorial/i;
  // The text lint of textSweep.test.ts (length, no !, no three dots, the ending, US spelling, no restor) and the bible's list, for one bubble text.
  const lint = (text: string): string[] => {
    const bad: string[] = [];
    if (text.length > 52) bad.push('longer than 52');
    if (/!|\.\.\./.test(text)) bad.push('exclamation or three dots');
    if (!/[.?…]$/.test(text)) bad.push('ending');
    if (/restor|recognis|centre|colour|behaviour|favour/i.test(text)) bad.push('restor or spelling');
    if (/\byou\b/i.test(text)) bad.push('you');
    if (BANNED_BEFORE_FINALE.test(text)) bad.push('banned before the finale');
    return bad;
  };

  it('the numbers and the strings: Noted. for the Inspector, one wordless ellipsis (U+2026) for the girl; both pass the text lint', () => {
    expect(POKE_BUBBLE).toMatchObject({ perActorGapMs: 120000, perHourMax: 4, chance: 0.5, chanceRare: 0.25 });
    expect(POKE_BUBBLE.inspector.text).toBe('Noted.');
    expect(POKE_BUBBLE.girl.text).toBe('…');
    expect(POKE_BUBBLE.girl.text.length).toBe(1);
    expect(lint(POKE_BUBBLE.inspector.text)).toEqual([]);
    expect(lint(POKE_BUBBLE.girl.text)).toEqual([]);
  });

  it('WORLD VOICES OFF: no bubble, whatever the draw, the time or the history', () => {
    const s = createPokeBubbleState();
    for (const actor of ['inspector', 'girl'] as const) {
      for (const t of [0, 120000, 3600000]) {
        expect(pokeBubbleDue(s, actor, t, 0, { voices: 'off', lineBubbleUp: false }), `${actor} ${t}`).toBe(false);
      }
    }
  });

  it('RARE uses the lower chance: a draw between 0.25 and 0.5 is due on ON and not on RARE; a draw under 0.25 is due on both', () => {
    const s = createPokeBubbleState();
    const due = (voices: 'on' | 'rare', u: number): boolean => pokeBubbleDue(s, 'inspector', 0, u, { voices, lineBubbleUp: false });
    const between = (POKE_BUBBLE.chanceRare + POKE_BUBBLE.chance) / 2;
    expect(due('on', between)).toBe(true);
    expect(due('rare', between)).toBe(false);
    expect(due('rare', POKE_BUBBLE.chanceRare - 0.01)).toBe(true);
    expect(due('on', POKE_BUBBLE.chance)).toBe(false);
  });

  it('one bubble per actor per 120 s: the gap holds to 119.999 s and ends at 120 s; the other actor is not held by it', () => {
    const s = createPokeBubbleState();
    expect(pokeBubbleDue(s, 'girl', 0, 0, ON)).toBe(true);
    notePokeBubble(s, 'girl', 0);
    expect(pokeBubbleDue(s, 'girl', 119999, 0, ON)).toBe(false);
    expect(pokeBubbleDue(s, 'girl', 120000, 0, ON)).toBe(true);
    expect(pokeBubbleDue(s, 'inspector', 1000, 0, ON)).toBe(true);
  });

  it('4 bubbles an hour across both actors: the fifth waits until the first stamp is an hour old (a stamp exactly an hour old is out)', () => {
    const s = createPokeBubbleState();
    const shown: [PokeBubbleActor, number][] = [['inspector', 0], ['girl', 120000], ['inspector', 240000], ['girl', 360000]];
    for (const [actor, t] of shown) {
      expect(pokeBubbleDue(s, actor, t, 0, ON), `${actor} ${t}`).toBe(true);
      notePokeBubble(s, actor, t);
    }
    expect(pokeBubbleDue(s, 'inspector', 480000, 0, ON)).toBe(false);
    expect(pokeBubbleDue(s, 'girl', 3599999, 0, ON)).toBe(false);
    expect(pokeBubbleDue(s, 'girl', 3600000, 0, ON)).toBe(true);
    expect(pokeBubbleDue(s, 'inspector', 3600000, 0, ON)).toBe(true);
  });

  it('never while a line bubble is up, whatever the draw and the gaps', () => {
    const s = createPokeBubbleState();
    expect(pokeBubbleDue(s, 'inspector', 0, 0, { voices: 'on', lineBubbleUp: true })).toBe(false);
    expect(pokeBubbleDue(s, 'girl', 0, 0, { voices: 'rare', lineBubbleUp: true })).toBe(false);
  });

  it('notePokeBubble records the actor and the time and drops the stamps an hour old; the rule never writes the state', () => {
    expect(createPokeBubbleState()).toEqual({ lastAtMs: { inspector: -Infinity, girl: -Infinity }, hourStamps: [] });
    const s = createPokeBubbleState();
    notePokeBubble(s, 'inspector', 1000);
    notePokeBubble(s, 'girl', 5000);
    const before = JSON.stringify(s);
    pokeBubbleDue(s, 'inspector', 10000, 0.1, ON);
    pokeBubbleDue(s, 'girl', 10000, 0.1, { voices: 'rare', lineBubbleUp: false });
    expect(JSON.stringify(s)).toBe(before);
    notePokeBubble(s, 'inspector', 3601000);
    expect(s.hourStamps).toEqual([5000, 3601000]);
    expect(s.lastAtMs).toEqual({ inspector: 3601000, girl: 5000 });
  });

  it('deterministic: the same history and draws give the same bubbles, never more than 4 in the hour', () => {
    const run = (): boolean[] => {
      const s = createPokeBubbleState();
      const out: boolean[] = [];
      for (let i = 0; i < 400; i++) {
        const actor: PokeBubbleActor = i % 3 === 0 ? 'girl' : 'inspector';
        const t = i * 9000;
        const due = pokeBubbleDue(s, actor, t, frac(i + 1), { voices: 'on', lineBubbleUp: i % 7 === 0 });
        out.push(due);
        if (due) notePokeBubble(s, actor, t);
      }
      return out;
    };
    const got = run();
    expect(JSON.stringify(got)).toBe(JSON.stringify(run()));
    expect(got.filter(Boolean).length).toBeGreaterThan(0);
    // The run spans 3591 s, so every shown bubble falls in one hour: at most perHourMax.
    expect(got.filter(Boolean).length).toBeLessThanOrEqual(POKE_BUBBLE.perHourMax);
  });
});
