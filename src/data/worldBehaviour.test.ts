// Living world behaviour data tests (WP24 T1): every clip frame, burst rest frame and unison accent exists in its sheet; the clip fields are
// well formed; no finale payoff frame is used before the finale; the girl and the crow stay still; the stare-safe rules; the era lists and
// the unison map cover their actions; the cue routes and producers match; the spots sit inside their actor bands (actorBand); the roaming
// holds, repeats and micro activities (WP28b).
// Why: a frame name, cue or spot that does not exist fails silently in the renderers, so the data is checked where it is written.
// Structure and canon only: the hold, weight and cooldown numbers are tuned by T3d and are never pinned here. Pure data test; the spot
// rule reads the placement maths (src/game/math/worldPlacement.ts), which is pure (no Phaser).
import { describe, it, expect } from 'vitest';
import {
  WORLD_BEHAVIOUR, WORLD_PREFINALE_BANNED, WORLD_REACT, WORLD_REPERTOIRE, WORLD_SPOTS, WORLD_STARE_SAFE, WORLD_UNISON, WORLD_VISITS, WORLD_WALK,
  WORLD_YARD,
} from './worldBehaviour';
import type { Activity, BehaviourActor, BehaviourCond, Clip, CueId, UnisonClip, UnisonId } from './worldBehaviour';
import { WORLD_ENV, WORLD_FRAMES, WORLD_PLACEMENTS, WORLD_PLAYBACK, WORLD_ROWS } from './livingWorld';
import { GROUND_Y, MACHINE_ANCHOR } from './world';
import { SPLICE_WORLD } from './spliceWorld';
import type { SpliceObjectId } from './spliceWorld';
import type { FramingKey } from './livingWorld';
import type { TechId } from './types';
import { actorBand, framingKey, framingPose, placeCast } from '../game/math/worldPlacement';

// The smoke stage buy lists (scripts/smoke/stages.mjs), copied as literals as in worldPlacement.test.ts.
const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning',
  'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S8 = [...S7, '@blueprint', 'generator'];
const S9 = [...S7, '@blueprint', 'generator', ...rep('motorRetrofit', 10), ...rep('copperWinding', 40), 'dynamoCrank',
  'capacitorBank', 'sparkGap', ...rep('transformer', 6), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...rep('inductionHeater', 9), ...rep('firebox', 40), 'steamHammer', 'superheater', ...rep('condenser', 15),
  'turbine', 'reliefValves', ...rep('bellowsDrive', 9), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...rep('crankServo', 3), ...rep('harmonicCoil', 50), ...rep('pressureResonator', 6), 'echoCrank', 'phaseLock',
  ...rep('standingWave', 6), 'crystalLattice', ...rep('gridExciter', 15), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...rep('containmentRing', 50), '@resonantSiphon:60', '@graviticAnchor:20', 'inversionCrank', 'lensArray',
  ...rep('horizonField', 40), 'skyAperture', ...rep('mainsBackfeed', 15), ...rep('steamLance', 15), '@finalAlignment'];

// Tech levels of a buy list: plain id += 1; '@blueprint' = generatorBlueprint 1; '@tech' = 1; '@tech:n' = n.
function levelsOf(buys: readonly string[]): Record<TechId, number> {
  const out: Record<string, number> = {};
  for (const raw of buys) {
    if (raw.startsWith('@')) {
      const [name = '', n] = raw.slice(1).split(':');
      out[name === 'blueprint' ? 'generatorBlueprint' : name] = n === undefined ? 1 : Number(n);
    } else {
      out[raw] = (out[raw] ?? 0) + 1;
    }
  }
  return out as Record<TechId, number>;
}

const ACTORS: readonly BehaviourActor[] = ['inspector', 'dog', 'crow', 'girl'];
const ERA_KEYS = [1, 2, 3, 5] as const;
const CUES: readonly CueId[] = ['atSensor', 'digBout', 'crowMove', 'ring', 'ventPuff', 'rapid', 'crankClick', 'gust', 'fault', 'faultClear', 'find',
  'bigBuy', 'era', 'splice'];
const UNISON_IDS: readonly UnisonId[] = ['still', 'stare', 'sway', 'beat', 'look', 'mouth', 'hold', 'rise'];
const SHEET: Record<BehaviourActor, readonly string[]> = {
  inspector: WORLD_FRAMES.inspector, dog: WORLD_FRAMES.dog, crow: WORLD_FRAMES.crow, girl: WORLD_FRAMES.girl,
};
// The sheet a clip draws from: a girl activity with girlMini in its conditions draws the mini sheet; every other girl clip the girl sheet.
const sheetOf = (actor: BehaviourActor, when: readonly string[] | undefined): readonly string[] =>
  actor === 'girl' && when?.includes('girlMini') === true ? WORLD_FRAMES.girlMini : SHEET[actor];

interface Row { actor: BehaviourActor; era: 1 | 2 | 3 | 5; act: Activity }
const ROWS: readonly Row[] = ACTORS.flatMap((actor) => ERA_KEYS.flatMap((era) =>
  (WORLD_REPERTOIRE[actor][era] ?? []).map((act) => ({ actor, era, act }))));

interface UnisonRow { set: 'pre' | 'post'; actor: BehaviourActor; id: UnisonId; clip: UnisonClip }
const UNISON_ROWS: readonly UnisonRow[] = (['pre', 'post'] as const).flatMap((set) => ACTORS.flatMap((actor) =>
  Object.entries(WORLD_UNISON.map[set][actor]).flatMap(([id, clip]) =>
    clip === undefined ? [] : [{ set, actor, id: id as UnisonId, clip }])));

// Every frame a clip shows: its frames, the burst rest frame and the unison accent.
const shownFrames = (clip: Clip | UnisonClip): string[] => [
  ...clip.frames,
  ...(clip.burst === undefined ? [] : [clip.burst.restFrame]),
  ...('accent' in clip && clip.accent !== undefined ? [clip.accent] : []),
];

function expectWellFormed(label: string, clip: Clip): void {
  expect(clip.fps, label).toBeGreaterThan(0);
  expect(clip.frames.length, label).toBeGreaterThan(0);
  if (clip.alpha !== undefined) {
    expect(clip.alpha, label).toBeGreaterThan(0);
    expect(clip.alpha, label).toBeLessThan(1);
  }
  if (clip.frameAlpha !== undefined) {
    expect(clip.frameAlpha.length, label).toBe(clip.frames.length);
    for (const a of clip.frameAlpha) {
      expect(a, label).toBeGreaterThan(0);
      expect(a, label).toBeLessThanOrEqual(1);
    }
  }
  if (clip.dxPx !== undefined) expect(clip.dxPx.length, label).toBe(clip.frames.length);
  if (clip.frameHoldMs !== undefined) expect(clip.frameHoldMs[0], label).toBeLessThanOrEqual(clip.frameHoldMs[1]);
  if (clip.burst !== undefined) {
    expect(clip.burst.onMs[0], label).toBeLessThanOrEqual(clip.burst.onMs[1]);
    expect(clip.burst.restMs[0], label).toBeLessThanOrEqual(clip.burst.restMs[1]);
  }
}

describe('clips and sheets', () => {
  it('every clip frame and burst rest frame exists in its sheet', () => {
    for (const { actor, act } of ROWS) {
      const sheet = sheetOf(actor, act.when);
      for (const f of shownFrames(act.clip)) expect(sheet, `${actor} ${act.id} frame ${f}`).toContain(f);
    }
  });

  it('every unison frame and accent exists in its actor sheet', () => {
    for (const u of UNISON_ROWS) {
      for (const f of shownFrames(u.clip)) expect(SHEET[u.actor], `${u.set} ${u.actor} ${u.id} frame ${f}`).toContain(f);
    }
  });

  it('every stare-safe frame exists in its actor sheet', () => {
    for (const actor of ACTORS) {
      for (const f of WORLD_STARE_SAFE[actor]) expect(SHEET[actor], `${actor} stare-safe ${f}`).toContain(f);
    }
  });

  it('every clip is well formed: fps, alpha in (0, 1), frameAlpha and dxPx as long as the frames, holds ordered', () => {
    for (const { actor, act } of ROWS) expectWellFormed(`${actor} ${act.id}`, act.clip);
    for (const u of UNISON_ROWS) expectWellFormed(`${u.set} ${u.actor} ${u.id}`, u.clip);
  });

  it('the girl mini flicker never shows the warm frame (canon: the lantern is cold from the generator on)', () => {
    for (const { actor, act } of ROWS) {
      if (actor === 'girl' && act.when?.includes('girlMini') === true) expect(act.clip.frames, act.id).not.toContain('warm');
    }
  });
});

describe('finale payoff frames (D7)', () => {
  it('no pre-finale activity draws a banned payoff frame', () => {
    for (const { actor, act } of ROWS) {
      for (const f of shownFrames(act.clip)) expect(WORLD_PREFINALE_BANNED[actor], `${actor} ${act.id} ${f}`).not.toContain(f);
    }
  });

  it('no unison clip draws a banned payoff frame', () => {
    for (const u of UNISON_ROWS) {
      for (const f of shownFrames(u.clip)) expect(WORLD_PREFINALE_BANNED[u.actor], `${u.set} ${u.actor} ${u.id} ${f}`).not.toContain(f);
    }
  });
});

describe('girl and crow stay still on screen', () => {
  it('girl activities never travel, never offset a frame, and name girlMini or girlGround in their conditions', () => {
    for (const { actor, act } of ROWS) {
      if (actor !== 'girl') continue;
      expect(act.travel, act.id).toBeUndefined();
      expect(act.clip.dxPx, act.id).toBeUndefined();
      expect(act.when?.some((w) => w === 'girlMini' || w === 'girlGround') === true, act.id).toBe(true);
    }
  });

  it('crow activities never travel and offset at most WORLD_ENV.crowStutterPx', () => {
    for (const { actor, act } of ROWS) {
      if (actor !== 'crow') continue;
      expect(act.travel, act.id).toBeUndefined();
      for (const dx of act.clip.dxPx ?? []) expect(Math.abs(dx), act.id).toBeLessThanOrEqual(WORLD_ENV.crowStutterPx);
    }
  });
});

// The crow perched with folded wings in eras I-II (WP27 D5): the base activities draw only the perched frames; the spread-wing freeze is
// the one tip try glitch (at most 1.8 s, weight at most 0.5), the only activity marked glitch.
describe('the crow is perched in eras I-II (WP27 D5)', () => {
  // perchHead and perchTalk are folded-wing head frames (WP28b: the crow's era card reaction, eraPerchHead, draws perchHead).
  const PERCH_FRAMES = ['perch0', 'perch1', 'perchTurn', 'perchHead', 'perchTalk', 'peck0', 'peck1', 'ruffle'];
  const SPREAD_FRAMES = ['frozen', 'frozenTip', 'head', 'talk', 'fly0', 'fly1', 'fly2'];
  const EARLY_CROW = ROWS.filter((r) => r.actor === 'crow' && (r.era === 1 || r.era === 2));

  it('every era I-II crow activity but tipTry draws only the perched frames, never a spread-wing or head or talk frame', () => {
    for (const { era, act } of EARLY_CROW) {
      // The poke-only hop is the one flight (C3, the hop rule below); the WP28b free hop (hopFree) is the other.
      if (act.id === 'tipTry' || act.poke === true || act.id === 'hopFree') continue;
      for (const f of shownFrames(act.clip)) {
        expect(PERCH_FRAMES, `era ${era} crow ${act.id} ${f}`).toContain(f);
        expect(SPREAD_FRAMES, `era ${era} crow ${act.id} ${f}`).not.toContain(f);
      }
    }
  });

  it('tipTry is the brief glitch: hold at most 2 s, weight at most 0.5, in eras I and II', () => {
    const tips = EARLY_CROW.filter((r) => r.act.id === 'tipTry');
    expect(tips.map((r) => r.era)).toEqual([1, 2]);
    for (const { era, act } of tips) {
      expect(act.holdMs[1], `era ${era} tipTry hold`).toBeLessThanOrEqual(2000);
      expect(act.weight, `era ${era} tipTry weight`).toBeLessThanOrEqual(0.5);
    }
  });

  it('perchHead and perchTalk are crow sheet frames, and neither is a spread-wing frame', () => {
    expect(WORLD_FRAMES.crow).toEqual(expect.arrayContaining(['perchHead', 'perchTalk']));
    expect(SPREAD_FRAMES).not.toContain('perchHead');
    expect(SPREAD_FRAMES).not.toContain('perchTalk');
  });

  it('the era IV pre-stare unison crow shows only folded-wing frames (AD2 round 2 F9)', () => {
    for (const [id, clip] of Object.entries(WORLD_UNISON.map.pre.crow)) {
      if (clip === undefined) continue;
      for (const f of shownFrames(clip)) expect(SPREAD_FRAMES, `pre crow ${id} ${f}`).not.toContain(f);
    }
    expect(WORLD_UNISON.map.post.crow.stare?.frames).toEqual(['head']);
  });

  it('only the tipTry activity carries glitch, in eras I and II (the crank and first-pick rules read it)', () => {
    const glitch = ROWS.filter((r) => r.act.glitch === true).map((r) => `${r.actor} ${r.era} ${r.act.id}`);
    expect(glitch).toEqual(['crow 1 tipTry', 'crow 2 tipTry']);
  });
});

// The crow's hop (WP28a T15a, C3): the fly frames left the pre-finale ban; only the poke-only hop draws them, in eras I-III and V (not IV).
// The Inspector and the dog leave through the poke-only walks to the outer spot (eras I-III); era V has no walking leave (its level 3 plays in
// place, data/pokes.ts leave null); every other poke-only activity is absent.
describe('the poke-only activities (WP28a T15a, C3)', () => {
  const FLY = ['fly0', 'fly1', 'fly2'];
  const POKE_ROWS = ROWS.filter((r) => r.act.poke === true);

  it('the fly frames are not banned before the finale, and only poke-only activities and the WP28b free hop draw them', () => {
    expect(WORLD_PREFINALE_BANNED.crow).toEqual([]);
    for (const { actor, era, act } of ROWS) {
      if (!shownFrames(act.clip).some((f) => FLY.includes(f))) continue;
      expect(actor, `era ${era} ${act.id}`).toBe('crow');
      expect(act.poke === true || act.id === 'hopFree', `era ${era} ${act.id}`).toBe(true);
    }
  });

  it('the crow hop is one poke-only activity in eras I-III and V (not IV), weight 0, no reaction, no travel, its own fly frames', () => {
    const hops = POKE_ROWS.filter((r) => r.actor === 'crow');
    expect(hops.map((r) => r.era)).toEqual([1, 2, 3, 5]);
    for (const { act } of hops) {
      expect(act.id).toBe('hop');
      expect(act.weight).toBe(0);
      expect(act.reaction).toBeUndefined();
      expect(act.travel).toBeUndefined();
      expect(act.clip.frames).toEqual(FLY);
    }
    expect(WORLD_REPERTOIRE.crow[4]).toBeUndefined();
  });

  it('the era V hop plays its frames in reverse; the other eras play them forward', () => {
    for (const { era, act } of POKE_ROWS.filter((r) => r.actor === 'crow')) {
      expect(act.reversed === true, `crow era ${era}`).toBe(era === 5);
    }
  });

  it('the poke-only leaves are the Inspector (write) and the dog (sit), eras I-III, walking to the outer spot', () => {
    const leaves = POKE_ROWS.filter((r) => r.actor !== 'crow').map((r) => `${r.actor} ${r.era} ${r.act.id}`);
    expect(leaves).toEqual([
      'inspector 1 leaveWrite', 'inspector 2 leaveWrite', 'inspector 3 leaveWrite',
      'dog 1 leaveSit', 'dog 2 leaveSit', 'dog 3 leaveSit',
    ]);
    for (const { act } of POKE_ROWS.filter((r) => r.actor !== 'crow')) expect(act.travel, act.id).toBe('outer');
  });

  it('era V has no poke-only walk: the Inspector and the dog play their level 3 in place, so only the crow hop is poke-only there', () => {
    expect(POKE_ROWS.filter((r) => r.era === 5).map((r) => r.actor)).toEqual(['crow']);
  });
});

describe('stare-safe rules (D2, Q7)', () => {
  it('the first stare-safe entry is the actor front: front, head, head, stand0', () => {
    expect(WORLD_STARE_SAFE.inspector[0]).toBe('front');
    expect(WORLD_STARE_SAFE.dog[0]).toBe('head');
    expect(WORLD_STARE_SAFE.crow[0]).toBe('head');
    expect(WORLD_STARE_SAFE.girl[0]).toBe('stand0');
  });

  it('every rest frame of the era V lists and of the post-observer unison is stare-safe', () => {
    for (const r of ROWS) {
      // The hop's fly frames are the one facing exemption (C3), so the hop is not a stare-safe rest frame (WP28b: nor is the free hop).
      if (r.era !== 5 || r.act.travel !== undefined || r.act.id === 'hop' || r.act.id === 'hopFree') continue;
      for (const f of shownFrames(r.act.clip)) expect(WORLD_STARE_SAFE[r.actor], `era 5 ${r.actor} ${r.act.id} ${f}`).toContain(f);
    }
    for (const u of UNISON_ROWS) {
      if (u.set !== 'post') continue;
      for (const f of shownFrames(u.clip)) expect(WORLD_STARE_SAFE[u.actor], `post ${u.actor} ${u.id} ${f}`).toContain(f);
    }
  });
});

describe('repertoires', () => {
  it('each actor has eras I, II, III and V, and no era IV entry (the conductor)', () => {
    for (const actor of ACTORS) {
      for (const era of ERA_KEYS) expect(WORLD_REPERTOIRE[actor][era], `${actor} era ${era}`).toBeDefined();
      expect(WORLD_REPERTOIRE[actor][4], `${actor} era IV`).toBeUndefined();
    }
  });

  it('ids are unique within every era list; holds are ordered lo < hi; weights are at least 0', () => {
    for (const actor of ACTORS) {
      for (const era of ERA_KEYS) {
        const list = WORLD_REPERTOIRE[actor][era] ?? [];
        const ids = list.map((a) => a.id);
        expect(new Set(ids).size, `${actor} era ${era} ids`).toBe(ids.length);
        for (const a of list) {
          // A poke-only activity holds one fixed time (the hop: 600 ms); so do the WP28b free hop and the dog's bark (1.5 s). Every other hold is a range.
          if (a.poke === true || a.id === 'hopFree' || a.id === 'bark') expect(a.holdMs[0], `${actor} ${a.id} hold`).toBeLessThanOrEqual(a.holdMs[1]);
          else expect(a.holdMs[0], `${actor} ${a.id} hold`).toBeLessThan(a.holdMs[1]);
          expect(a.weight, `${actor} ${a.id} weight`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('a weight-0 activity is reaction-only (it names a reaction, never free); free activities are interruptible', () => {
    for (const { actor, act } of ROWS) {
      // A poke-only activity (WP28a T15a) is weight 0 with no reaction: BehaviourRunner.interrupt starts it, a cue never does.
      if (act.poke === true) {
        expect(act.weight, `${actor} ${act.id} weight`).toBe(0);
        expect(act.reaction, `${actor} ${act.id} reaction`).toBeUndefined();
        expect(act.interruptible, `${actor} ${act.id} interruptible`).toBe(false);
        continue;
      }
      // A micro activity (WP28b) is weight 0 with no reaction: the scheduler's fallback starts it, a cue never does.
      if (act.micro === true) {
        expect(act.weight, `${actor} ${act.id} weight`).toBe(0);
        expect(act.reaction, `${actor} ${act.id} reaction`).toBeUndefined();
        expect(act.interruptible, `${actor} ${act.id} interruptible`).toBe(true);
        continue;
      }
      if (act.weight === 0) {
        expect(act.reaction?.length ?? 0, `${actor} ${act.id} reaction`).toBeGreaterThanOrEqual(1);
        expect(act.interruptible, `${actor} ${act.id} interruptible`).toBe(false);
      } else {
        expect(act.interruptible, `${actor} ${act.id} interruptible`).toBe(true);
      }
    }
  });

  it('every cue an activity names (reaction, wakeOn, emits) is a valid CueId', () => {
    for (const { actor, act } of ROWS) {
      for (const cue of [...(act.reaction ?? []), ...(act.wakeOn ?? []), ...(act.emits === undefined ? [] : [act.emits])]) {
        expect(CUES, `${actor} ${act.id} cue ${cue}`).toContain(cue);
      }
    }
  });

  it('the dig walks home (the hole sits at the home spot)', () => {
    const dig = WORLD_REPERTOIRE.dog[2]?.find((a) => a.id === 'dig');
    expect(dig?.travel).toBe('home');
  });
});

// The roaming rules (WP28b, B-T1a): every roamer rest hold ends by the guard bound (9 s) and the rest poses hold at least 3 s; no roamer
// repeats an id (only the girl merges one); each roamer has its micro activity in eras I, II, III and V.
describe('roaming holds, repeats and micro activities (WP28b, B-T1a)', () => {
  const ROAM_ROWS = ROWS.filter((r) => r.actor !== 'girl');
  // The rest poses of each roamer: the ids whose holds the caps shorten (the rest range of WORLD_BEHAVIOUR.restHoldMs applies).
  const REST_IDS: Partial<Record<BehaviourActor, readonly string[]>> = {
    inspector: ['stand', 'write', 'reading', 'lookUp', 'crouch', 'umbrella', 'withSensor'],
    dog: ['sit', 'sniff', 'sleep', 'lookUp', 'dig', 'leaveSit'],
    crow: ['perch', 'stutterV', 'stillV'],
  };
  // The one micro activity of each roamer per era (weight 0, micro: true).
  const MICRO_IDS: Partial<Record<BehaviourActor, Partial<Record<1 | 2 | 3 | 5, string>>>> = {
    inspector: { 1: 'microGlance', 2: 'microGlance', 3: 'microGlance', 5: 'microTalk' },
    dog: { 1: 'microScratch', 2: 'microScratch', 3: 'microScratch', 5: 'microTalk' },
    crow: { 1: 'microPeck', 2: 'microPeck', 3: 'microPeck', 5: 'microCaw' },
  };

  it('the rest hold range is 3 to 9 s, and the hold caps are 10 s, 8 s and 10 s (the hold, early static and era V static caps)', () => {
    expect(WORLD_BEHAVIOUR.restHoldMs).toEqual([3000, 9000]);
    expect(WORLD_BEHAVIOUR.capMs).toEqual({ hold: 10000, staticEarly: 8000, staticV: 10000 });
    expect(WORLD_BEHAVIOUR.actionGapMs).toBeLessThanOrEqual(12000);
    // WP28b: the plan's 9.5 s micro rule is not built (the micro fallback runs only when nothing else passes), so there is no micro gap key.
    expect('microGapMs' in WORLD_BEHAVIOUR).toBe(false);
  });

  it('the machine-event cut keeps 250 ms of walk left (WP28b B3); the poke halt keeps haltMinLeftMs at 1 s', () => {
    expect(WORLD_BEHAVIOUR.reactHaltMinLeftMs).toBe(250);
    expect(WORLD_BEHAVIOUR.haltMinLeftMs).toBe(1000);
  });

  // WP28b (r2-FX4G, V5): the start gate holds a boundary pick by 150 ms, at most 3 times, and 150 ms clears the 125 ms lock window.
  it('the start gate moves a boundary pick by 150 ms at most 3 times (V5 window 125 ms)', () => {
    expect(WORLD_BEHAVIOUR.startGuardMs).toBe(150);
    expect(WORLD_BEHAVIOUR.startGuardExtMax).toBe(3);
    expect(WORLD_BEHAVIOUR.startGuardMs).toBeGreaterThan(125);
  });

  it('the girl ground statics (stand, lanternUp, tilt) keep the v0.11.0 cap of 16 s; the sway keeps 45 s (WP28b D)', () => {
    const girl = ROWS.filter((r) => r.actor === 'girl');
    for (const id of ['stand', 'lanternUp', 'tilt']) {
      const rows = girl.filter((r) => r.act.id === id);
      expect(rows.length, `girl ${id} exists`).toBeGreaterThan(0);
      for (const { era, act } of rows) expect(act.capMs, `era ${era} girl ${id}`).toBe(16000);
    }
    for (const { era, act } of girl.filter((r) => r.act.id === 'sway')) expect(act.capMs, `era ${era} girl sway`).toBe(45000);
  });

  it('every roamer activity holds at most the 9 s guard bound', () => {
    for (const { actor, era, act } of ROAM_ROWS) {
      expect(act.holdMs[1], `era ${era} ${actor} ${act.id}`).toBeLessThanOrEqual(WORLD_BEHAVIOUR.restHoldMs[1]);
    }
  });

  it('every roamer rest pose holds between the rest range bounds, and each named rest pose exists', () => {
    for (const actor of ['inspector', 'dog', 'crow'] as const) {
      for (const id of REST_IDS[actor] ?? []) {
        const rows = ROAM_ROWS.filter((r) => r.actor === actor && r.act.id === id);
        expect(rows.length, `${actor} ${id} exists`).toBeGreaterThan(0);
        for (const { era, act } of rows) {
          expect(act.holdMs[0], `era ${era} ${actor} ${id} lower`).toBeGreaterThanOrEqual(WORLD_BEHAVIOUR.restHoldMs[0]);
          expect(act.holdMs[1], `era ${era} ${actor} ${id} upper`).toBeLessThanOrEqual(WORLD_BEHAVIOUR.restHoldMs[1]);
        }
      }
    }
  });

  it('no roamer activity is repeatable; the girl keeps her merged rest poses', () => {
    for (const { actor, era, act } of ROAM_ROWS) expect(act.repeatable, `era ${era} ${actor} ${act.id}`).toBeUndefined();
    expect(ROWS.some((r) => r.actor === 'girl' && r.act.repeatable === true)).toBe(true);
  });

  it('each roamer has exactly one micro activity in eras I, II, III and V, weight 0, no cooldown, holds 1.2 to 2.2 s', () => {
    for (const actor of ['inspector', 'dog', 'crow'] as const) {
      for (const era of ERA_KEYS) {
        const micros = ROWS.filter((r) => r.actor === actor && r.era === era && r.act.micro === true);
        expect(micros.map((r) => r.act.id), `${actor} era ${era} micro`).toEqual([MICRO_IDS[actor]?.[era]]);
        for (const { act } of micros) {
          expect(act.weight, act.id).toBe(0);
          expect(act.cooldownMs, act.id).toBe(0);
          expect(act.interruptible, act.id).toBe(true);
          expect(act.holdMs, act.id).toEqual([1200, 2200]);
          expect(act.travel, act.id).toBeUndefined();
        }
      }
    }
    expect(ROWS.some((r) => r.actor === 'girl' && r.act.micro === true)).toBe(false);
  });
});

describe('cues (WORLD_REACT)', () => {
  it('the producers name every cue, and each cue has at least one consumer route', () => {
    expect(Object.keys(WORLD_REACT.producers).sort()).toEqual([...CUES].sort());
    for (const cue of CUES) expect(WORLD_REACT.routes[cue].length, cue).toBeGreaterThanOrEqual(1);
  });

  it('every cue the activities produce is emitted by some activity', () => {
    const emitted = new Set<CueId>();
    for (const { act } of ROWS) if (act.emits !== undefined) emitted.add(act.emits);
    for (const cue of CUES) {
      if (WORLD_REACT.producers[cue] === 'activity') expect(emitted.has(cue), cue).toBe(true);
    }
  });

  it('the latency bands are ordered for all four actors', () => {
    for (const actor of ACTORS) {
      const [lo, hi] = WORLD_REACT.latencyMs[actor];
      expect(lo, actor).toBeLessThanOrEqual(hi);
    }
  });

  it('the WP28b stagger bands and the find delay are ordered; the six new cues react at chance 1 (C2, C11)', () => {
    for (const actor of ACTORS) {
      const [lo, hi] = WORLD_REACT.staggerMs[actor];
      expect(lo, `${actor} stagger`).toBeLessThanOrEqual(hi);
    }
    expect(WORLD_REACT.findDelayMs[0]).toBeLessThanOrEqual(WORLD_REACT.findDelayMs[1]);
    expect(WORLD_REACT.staggerMs.inspector[1]).toBeLessThanOrEqual(WORLD_REACT.staggerMs.dog[0]);
    expect(WORLD_REACT.staggerMs.dog[1]).toBeLessThanOrEqual(WORLD_REACT.staggerMs.crow[0]);
    expect(WORLD_REACT.chanceByCue).toEqual({ fault: 1, faultClear: 1, find: 1, bigBuy: 1, era: 1, splice: 1 });
  });

  it('every route of a new cue names an activity that answers it, and every activity that answers it is routed', () => {
    const NEW_CUES: readonly CueId[] = ['fault', 'faultClear', 'find', 'bigBuy', 'era', 'splice'];
    for (const cue of NEW_CUES) {
      const routed = [...WORLD_REACT.routes[cue]].sort();
      const answering = [...new Set(ROWS.filter((r) => r.act.reaction?.includes(cue) === true).map((r) => `${r.actor}.${r.act.id}`))].sort();
      expect(routed, cue).toEqual(answering);
    }
  });
});

// The WP28b reactions, visits and free hop (B-T3a): the cue answers, the walks each travel kind allows (C1: a Find walk goes outward only, a
// visit walks to the Splice's visit spot), the stare set of era V and the hop's data guard.
describe('reactions, gathering and the free hop (WP28b, B-T3a)', () => {
  const FLY = ['fly0', 'fly1', 'fly2'];
  const NEW_REACTIONS = ['startle', 'writeTick', 'point', 'lookFind', 'eraFront', 'bark', 'sniffFind', 'sniffHere', 'eraHead', 'lookBigV',
    'ruffleReact', 'glanceDown', 'eraPerchHead', 'settle'];
  const VISITS = ['visitWrite', 'visitSniff'];

  it('the free hop is a weight 1.2 crow activity in eras I, II, III and V only: 20 s cooldown, hopOk, the three fly frames', () => {
    const hops = ROWS.filter((r) => r.act.id === 'hopFree');
    expect(hops.map((r) => `${r.actor} ${r.era}`)).toEqual(['crow 1', 'crow 2', 'crow 3', 'crow 5']);
    for (const { era, act } of hops) {
      expect(act.weight, `era ${era} hop weight`).toBe(1.2);
      expect(act.cooldownMs, `era ${era} hop cooldown`).toBe(20000);
      expect(act.when, `era ${era} hop when`).toEqual(['hopOk']);
      expect(act.clip.frames, `era ${era} hop frames`).toEqual(FLY);
      expect(act.reversed === true, `era ${era} hop reversed`).toBe(era === 5);
      expect(act.travel, `era ${era} hop travel`).toBeUndefined();
    }
  });

  it('a Find walks only outward (C1): sniffFind and point on the outer side, lookFind and sniffHere on the inner side', () => {
    const whenOf = (id: string): BehaviourCond[] => ROWS.filter((r) => r.act.id === id).flatMap((r) => r.act.when ?? []);
    expect([...new Set(whenOf('sniffFind'))]).toEqual(['findOuter']);
    expect([...new Set(whenOf('point'))]).toEqual(['findOuter']);
    expect([...new Set(whenOf('lookFind'))]).toEqual(['findInner']);
    expect([...new Set(whenOf('sniffHere'))]).toEqual(['findInner']);
    for (const { act } of ROWS.filter((r) => r.act.travel === 'find')) expect(act.when, act.id).toEqual(['findOuter']);
  });

  it('only the table names use the inner, visit and find travel; a visit needs its Splice (visits)', () => {
    const travelling = ROWS.filter((r) => r.act.travel === 'inner' || r.act.travel === 'visit' || r.act.travel === 'find')
      .map((r) => `${r.actor} ${r.act.id} ${r.act.travel}`);
    expect([...new Set(travelling)].sort()).toEqual([
      'dog eraHead inner', 'dog sniffFind find', 'dog visitSniff visit', 'inspector eraFront inner', 'inspector visitWrite visit',
    ]);
    for (const { act } of ROWS.filter((r) => r.act.travel === 'visit')) expect(act.when, act.id).toEqual(['visits']);
  });

  it('the visits are free (weight 2, 40 s cooldown) and answer the splice cue; the other reactions are reaction-only', () => {
    for (const r of ROWS.filter((x) => VISITS.includes(x.act.id))) {
      expect(r.act.weight, `${r.actor} ${r.act.id} ${r.era}`).toBe(2);
      expect(r.act.cooldownMs, `${r.actor} ${r.act.id} ${r.era}`).toBe(40000);
      expect(r.act.reaction, `${r.actor} ${r.act.id} ${r.era}`).toEqual(['splice']);
    }
    for (const r of ROWS.filter((x) => NEW_REACTIONS.includes(x.act.id))) {
      expect(r.act.weight, `${r.actor} ${r.act.id} ${r.era}`).toBe(0);
      expect(r.act.cooldownMs, `${r.actor} ${r.act.id} ${r.era}`).toBe(0);
      expect(r.act.interruptible, `${r.actor} ${r.act.id} ${r.era}`).toBe(false);
      expect(r.act.reaction?.length ?? 0, `${r.actor} ${r.act.id} ${r.era}`).toBeGreaterThan(0);
    }
  });

  it('every new reaction and visit holds at most the 9 s guard bound', () => {
    for (const r of ROWS.filter((x) => NEW_REACTIONS.includes(x.act.id) || VISITS.includes(x.act.id))) {
      expect(r.act.holdMs[1], `era ${r.era} ${r.actor} ${r.act.id}`).toBeLessThanOrEqual(WORLD_BEHAVIOUR.restHoldMs[1]);
    }
  });

  it('era V keeps the same reaction and visit ids with stare-safe frames only (the free hop excepted, C3)', () => {
    for (const r of ROWS) {
      if (r.era !== 5 || !(NEW_REACTIONS.includes(r.act.id) || VISITS.includes(r.act.id))) continue;
      for (const f of shownFrames(r.act.clip)) expect(WORLD_STARE_SAFE[r.actor], `era 5 ${r.actor} ${r.act.id} ${f}`).toContain(f);
    }
  });

  it('the startle, point and bark cells are profile frames: none is a stare-safe frame of its actor', () => {
    expect(WORLD_STARE_SAFE.inspector).not.toContain('startle');
    expect(WORLD_STARE_SAFE.inspector).not.toContain('point');
    expect(WORLD_STARE_SAFE.dog).not.toContain('bark0');
    expect(WORLD_STARE_SAFE.dog).not.toContain('bark1');
  });

  it('the new reaction and visit frames are sheet frames of their actor', () => {
    for (const { actor, act } of ROWS) {
      if (!NEW_REACTIONS.includes(act.id) && !VISITS.includes(act.id) && act.id !== 'hopFree') continue;
      for (const f of shownFrames(act.clip)) expect(SHEET[actor], `${actor} ${act.id} ${f}`).toContain(f);
    }
  });
});

describe('unison (WORLD_UNISON)', () => {
  it('the static ids are look, hold and stare', () => {
    expect(WORLD_UNISON.staticIds).toEqual(['look', 'hold', 'stare']);
  });

  it('every action is a known id with ordered beats and a weight of at least 0', () => {
    for (const a of [...WORLD_UNISON.pre, ...WORLD_UNISON.post]) {
      expect(UNISON_IDS, a.id).toContain(a.id);
      expect(a.beats[0], a.id).toBeLessThanOrEqual(a.beats[1]);
      expect(a.weight, a.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('map.pre covers every pre action and map.post every post action, for all four actors', () => {
    for (const actor of ACTORS) {
      for (const a of WORLD_UNISON.pre) expect(WORLD_UNISON.map.pre[actor][a.id], `pre ${actor} ${a.id}`).toBeDefined();
      for (const a of WORLD_UNISON.post) expect(WORLD_UNISON.map.post[actor][a.id], `post ${actor} ${a.id}`).toBeDefined();
    }
  });
});

describe('behaviour constants', () => {
  it('the actor salts and the scheduler salts are each distinct', () => {
    const actorSalts = Object.values(WORLD_BEHAVIOUR.actorSalt);
    expect(new Set(actorSalts).size).toBe(actorSalts.length);
    const salts = Object.values(WORLD_BEHAVIOUR.salts);
    expect(new Set(salts).size).toBe(salts.length);
  });

  it('the walk is at least one frame step long and the log ring is not empty', () => {
    expect(WORLD_WALK.minTravelPx).toBeGreaterThanOrEqual(WORLD_WALK.pxPerFrame);
    expect(WORLD_BEHAVIOUR.logSize).toBeGreaterThan(0);
  });

  it('the cadence step cap is a positive finite time below the walk tick period (fps8)', () => {
    expect(Number.isFinite(WORLD_BEHAVIOUR.cadenceMaxStepMs)).toBe(true);
    expect(WORLD_BEHAVIOUR.cadenceMaxStepMs).toBeGreaterThan(0);
    expect(WORLD_BEHAVIOUR.cadenceMaxStepMs).toBeLessThan(1000 / WORLD_PLAYBACK.fps.fps8);
  });
});

// Spots (WP24 T1, decision 3; WP28b Spots v2). The spots of a stage: each feet x lies in the actor band of its framing; two spots of one
// actor are at least minTravelPx apart (Euclidean, the lane counts) or share x in two lanes; the Inspector has one spot at least and the dog
// two, and the Inspector keeps one spot beside Sensor 7 in the sensor-side framings (WP27 F6.2: s8, s8w, s10).
// KNOWN_SPOT_FINDINGS (WP28b): the pairs the table keeps although they break the pair rule, as 'framing actor a-b'. The AD3 spot check (C-b) corrected
// the two findings of the plan table (e1 dog stake-home, s10 dog home-y1), so the list is empty: a new breach fails the test.
const KNOWN_SPOT_FINDINGS: readonly string[] = [];
describe('spots against the actor bands (actorBand)', () => {
  // The framings where Sensor 7 stands beside the Inspector (WP27 F6.2): the Inspector keeps his one spot there.
  const SENSOR_SIDE_FRAMINGS: readonly FramingKey[] = ['s8', 's8w', 's10'];
  const S8W = S9.slice(0, S9.indexOf('transformer'));
  const SPOT_STAGES: readonly { name: string; buys: readonly string[]; framing: FramingKey }[] = [
    { name: 'S7', buys: S7, framing: 'e1' }, { name: 'S8', buys: S8, framing: 's8' }, { name: 'S8W', buys: S8W, framing: 's8w' },
    { name: 'S9', buys: S9, framing: 's9' }, { name: 'S10', buys: S10, framing: 's10' }, { name: 'S11', buys: S11, framing: 's11' },
    { name: 'S15', buys: S15, framing: 's15' },
  ];
  const ACTORS_WITH_SPOTS = ['inspector', 'dog'] as const;
  const framingsWithSpots = (): FramingKey[] => Object.keys(WORLD_SPOTS) as FramingKey[];

  // The pairs of one actor's roaming spots that break the pair rule (every framing, table order). WP28b F25: a visit stand (v<n>) is AD3's
  // C-c stand next to its object, and plain travel never walks to one, so the roaming pair rule does not apply to it.
  function pairFindings(): string[] {
    const out: string[] = [];
    for (const framing of framingsWithSpots()) {
      for (const actor of ACTORS_WITH_SPOTS) {
        const spots = (WORLD_SPOTS[framing]?.[actor] ?? []).filter((s) => !s.id.startsWith('v'));
        for (let i = 0; i < spots.length; i++) {
          for (let j = i + 1; j < spots.length; j++) {
            const a = spots[i];
            const b = spots[j];
            if (a === undefined || b === undefined) continue;
            const sameColumn = a.x === b.x && a.lane !== b.lane;
            if (Math.hypot(b.x - a.x, b.lane - a.lane) < WORLD_WALK.minTravelPx && !sameColumn) out.push(`${framing} ${actor} ${a.id}-${b.id}`);
          }
        }
      }
    }
    return out;
  }

  it.each(SPOT_STAGES)('$name: the framing is $framing, every Inspector and dog spot feet x lies in its band, the counts and ids hold', (s) => {
    const levels = levelsOf(s.buys);
    expect(framingKey(levels), s.name).toBe(s.framing);
    const pose = framingPose(levels);
    for (const actor of ACTORS_WITH_SPOTS) {
      const spots = WORLD_SPOTS[s.framing]?.[actor] ?? [];
      const base = WORLD_PLACEMENTS[s.framing][actor];
      const band = actorBand(s.framing, pose, levels, actor);
      expect(base, `${s.framing} ${actor} placement`).toBeDefined();
      const minSpots = actor === 'dog' ? 2 : SENSOR_SIDE_FRAMINGS.includes(s.framing) ? 1 : 2;
      expect(spots.length, `${s.framing} ${actor} spot count`).toBeGreaterThanOrEqual(minSpots);
      expect(new Set(spots.map((p) => p.id)).size, `${s.framing} ${actor} unique spot ids`).toBe(spots.length);
      for (const spot of spots) {
        expect(band !== null && band.min <= spot.x && spot.x <= band.max, `${s.framing} ${actor} ${spot.id} x ${spot.x} band ${JSON.stringify(band)}`)
          .toBe(true);
      }
    }
  });

  it('the pair rule: two spots of one actor are >= minTravelPx apart or share x in two lanes; only the known findings break it', () => {
    expect(pairFindings()).toEqual(KNOWN_SPOT_FINDINGS);
  });

  it('ids: the Inspector has sensor (the back-row spot nearest Sensor 7), mid at his placement x and b / y numbers; the dog has home at his x', () => {
    for (const framing of framingsWithSpots()) {
      const ins = WORLD_SPOTS[framing]?.inspector ?? [];
      const sensor7 = WORLD_PLACEMENTS[framing].sensor7;
      const insX = WORLD_PLACEMENTS[framing].inspector?.x ?? NaN;
      const back = ins.filter((p) => p.lane === 0);
      const nearest = sensor7 === undefined ? back[0] : back.reduce((best, p) => (Math.abs(p.x - sensor7.x) < Math.abs(best.x - sensor7.x) ? p : best));
      expect(ins.find((p) => p.id === 'sensor')?.x, `${framing} sensor`).toBe(nearest?.x);
      const mid = ins.find((p) => p.id === 'mid');
      if (mid !== undefined) expect(mid.x, `${framing} mid`).toBe(insX);
      const backB = back.filter((p) => p.id.startsWith('b')).map((p) => p.x);
      expect(backB, `${framing} b ids by x`).toEqual([...backB].sort((a, b) => a - b));
      const dog = WORLD_SPOTS[framing]?.dog ?? [];
      const dogX = WORLD_PLACEMENTS[framing].dog?.x ?? NaN;
      expect(dog.find((p) => p.id === 'home'), `${framing} home`).toEqual({ id: 'home', x: dogX, lane: 32 });
      const stake = dog.find((p) => p.id === 'stake');
      expect(stake !== undefined, `${framing} stake only at e1 and s15`).toBe(framing === 'e1' || framing === 's15');
      if (stake !== undefined) expect(stake.lane, `${framing} stake lane`).toBe(32);
    }
  });

  // The dog's front row (lane 32, WORLD_ROWS.front) is the canon home row, not a yard: it is exempt from the yard limit (world.md section 5 lists
  // the s15 limit for the yard only; the front row there lies under the buttons already).
  it('every yard spot (below the front row) inside the HUD-button x-range of its framing stays within WORLD_YARD.maxLane', () => {
    const frontLane = WORLD_ROWS.front.y - GROUND_Y;
    for (const framing of framingsWithSpots()) {
      const yard = WORLD_YARD[framing];
      expect(yard, `${framing} yard limits`).toBeDefined();
      if (yard === undefined) continue;
      for (const actor of ACTORS_WITH_SPOTS) {
        for (const spot of WORLD_SPOTS[framing]?.[actor] ?? []) {
          if (spot.lane > frontLane && spot.x >= yard.hudMinX && spot.x <= yard.hudMaxX) {
            expect(spot.lane, `${framing} ${actor} ${spot.id}`).toBeLessThanOrEqual(yard.maxLane);
          }
        }
      }
    }
  });

  it('the ending framings (portrait, baseL, baseR) have no spots', () => {
    expect(WORLD_SPOTS.portrait).toBeUndefined();
    expect(WORLD_SPOTS.baseL).toBeUndefined();
    expect(WORLD_SPOTS.baseR).toBeUndefined();
  });
});

// WP28b F25 (visit stands, AD3 hand-off C-c), the cue keys of WP28b and the reaction gaps (the era I and V dog wag, the crow settle).
describe('visits, the new cue keys and the reaction gaps (WP28b F25, F30, reaction gaps)', () => {
  const ACTORS_WITH_SPOTS = ['inspector', 'dog'] as const;
  // The stand of each visit spot as AD3 placed it (C-c): framing, actor, id, feet x and lane. Pinned here so an edit shows up.
  const PINNED_STANDS: readonly [FramingKey, 'inspector' | 'dog', string, number, number][] = [
    ['e1', 'inspector', 'v1', 1390, 64], ['e1', 'dog', 'v1', 2440, 96], ['e1', 'dog', 'v2', 2484, 32],
    ['s8', 'dog', 'v1', 2576, 32], ['s8', 'dog', 'v2', 2648, 32],
    ['s8w', 'inspector', 'v1', 1548, 56],
    ['s9', 'inspector', 'v1', 1430, 80], ['s9', 'dog', 'v1', 2900, 32], ['s9', 'dog', 'v2', 2906, 32], ['s9', 'dog', 'v3', 2868, 32],
    ['s11', 'inspector', 'v1', 750, 72], ['s11', 'inspector', 'v2', 910, 170],
    ['s11', 'dog', 'v1', 2912, 130], ['s11', 'dog', 'v2', 3012, 76], ['s11', 'dog', 'v3', 3110, 120], ['s11', 'dog', 'v4', 3018, 32],
    ['s11', 'dog', 'v5', 3072, 128], ['s11', 'dog', 'v6', 2938, 32], ['s11', 'dog', 'v7', 2858, 32],
    ['s15', 'inspector', 'v1', 756, 56], ['s15', 'inspector', 'v2', 722, 128], ['s15', 'inspector', 'v3', 792, 112], ['s15', 'dog', 'v1', 2858, 32],
  ];

  it('the visit stands are the pinned C-c spots, numbered v1, v2, ... per framing and actor with no gap', () => {
    for (const [framing, actor, id, x, lane] of PINNED_STANDS) {
      expect(WORLD_SPOTS[framing]?.[actor]?.find((s) => s.id === id), `${framing} ${actor} ${id}`).toEqual({ id, x, lane });
    }
    for (const framing of Object.keys(WORLD_SPOTS) as FramingKey[]) {
      for (const actor of ACTORS_WITH_SPOTS) {
        const ids = (WORLD_SPOTS[framing]?.[actor] ?? []).map((s) => s.id).filter((id) => id.startsWith('v'));
        expect(ids, `${framing} ${actor} visit ids`).toEqual(ids.map((_, i) => `v${i + 1}`));
      }
    }
  });

  it('every visit names a woken Splice placed in its framing, a spot of its actor, on the walker of its wing, 24 to 48 px toward the machine', () => {
    for (const framing of Object.keys(WORLD_VISITS) as FramingKey[]) {
      for (const v of WORLD_VISITS[framing] ?? []) {
        const label = `${framing} ${v.object} ${v.actor} ${v.spot}`;
        const placement = SPLICE_WORLD[v.object as SpliceObjectId]?.placements[framing];
        expect(placement, `${label} placed`).toBeTruthy();
        if (placement === undefined || placement === null) continue;
        const stand = WORLD_SPOTS[framing]?.[v.actor]?.find((s) => s.id === v.spot);
        expect(stand, `${label} stand`).toBeDefined();
        const left = placement.x < MACHINE_ANCHOR.x;
        expect(v.actor === 'inspector', `${label} wing`).toBe(left);
        if (stand !== undefined) {
          const dx = stand.x - placement.x;
          expect(Math.abs(dx), `${label} distance`).toBeGreaterThanOrEqual(24);
          expect(Math.abs(dx), `${label} distance`).toBeLessThanOrEqual(48);
          expect(left ? dx > 0 : dx < 0, `${label} faces the object from the machine side`).toBe(true);
        }
        for (const id of v.from ?? []) {
          expect(WORLD_SPOTS[framing]?.[v.actor]?.some((s) => s.id === id), `${label} from ${id}`).toBe(true);
        }
        expect(v.minEra ?? 1, `${label} era range`).toBeLessThanOrEqual(v.maxEra ?? 5);
      }
    }
  });

  it('the era windows of the stands: no era IV-only stand (era IV plays no visit, R3), the cairn from era V on, the s11 gramophone dropped', () => {
    const stand = (framing: FramingKey, object: string) => WORLD_VISITS[framing]?.find((v) => v.object === object);
    expect(stand('s11', 'spliceGramophone'), 'era IV only, so dropped').toBeUndefined();
    const eraIvOnly = Object.entries(WORLD_VISITS).flatMap(([framing, list]) => (list ?? []).filter((v) => v.minEra === 4 && v.maxEra === 4)
      .map((v) => `${framing} ${v.object}`));
    expect(eraIvOnly).toEqual([]);
    expect(stand('s11', 'spliceCairn')).toMatchObject({ minEra: 5, spot: 'v2' });
    expect(stand('s15', 'spliceGramophone')).toBeDefined();
    expect(stand('s9', 'spliceBicycle'), 'exempt at s9').toBeUndefined();
    expect(stand('s15', 'spliceChimes'), 'exempt at s15').toBeUndefined();
  });

  it('the new cue keys: the splice delay 3-8 s, the visit hold 20 s, the halt cues, the lantern dim 1 s and the bigBuy hop chance 0.3', () => {
    expect(WORLD_REACT.spliceDelayMs).toEqual([3000, 8000]);
    expect(WORLD_REACT.visitHoldMs).toBe(20000);
    expect(WORLD_REACT.haltCues).toEqual(['fault', 'faultClear', 'find', 'bigBuy', 'era']);
    expect(WORLD_REACT.faultDimMs).toBe(1000);
    expect(WORLD_REACT.hopChanceByCue).toEqual({ bigBuy: 0.3 });
  });

  it('every halt cue and hop cue names a known cue; the splice cue never cuts a walk (a visit walks, it does not cut)', () => {
    for (const cue of WORLD_REACT.haltCues) expect(CUES).toContain(cue);
    expect(WORLD_REACT.haltCues).not.toContain('splice');
    for (const cue of Object.keys(WORLD_REACT.hopChanceByCue) as CueId[]) {
      expect(CUES).toContain(cue);
      const p = WORLD_REACT.hopChanceByCue[cue] ?? NaN;
      expect(p, cue).toBeGreaterThan(0);
      expect(p, cue).toBeLessThanOrEqual(1);
    }
    const [lo, hi] = WORLD_REACT.spliceDelayMs;
    expect(lo).toBeGreaterThan(0);
    expect(lo).toBeLessThanOrEqual(hi);
    expect(WORLD_REACT.faultDimMs).toBeGreaterThan(0);
    expect(WORLD_REACT.visitHoldMs).toBeGreaterThan(0);
  });

  it('the faultClear reactions: the dog wags in eras I, II, III and V (era V on the stare-safe frames) and the crow settles on its perch', () => {
    expect(WORLD_REACT.routes.faultClear).toEqual(expect.arrayContaining(['inspector.writeTick', 'dog.wag', 'crow.settle']));
    const wags = ROWS.filter((r) => r.actor === 'dog' && r.act.id === 'wag');
    expect(wags.map((r) => r.era).sort((a, b) => a - b)).toEqual([1, 2, 3, 5]);
    for (const { era, act } of wags) expect(act.reaction, `era ${era} wag`).toContain('faultClear');
    const wagV = wags.find((r) => r.era === 5);
    expect(wagV, 'era 5 wag').toBeDefined();
    if (wagV !== undefined) {
      for (const f of shownFrames(wagV.act.clip)) expect(WORLD_STARE_SAFE.dog, `era 5 wag ${f}`).toContain(f);
    }
    const settles = ROWS.filter((r) => r.actor === 'crow' && r.act.id === 'settle');
    expect(settles.map((r) => r.era).sort((a, b) => a - b)).toEqual([1, 2, 3, 5]);
    for (const { act } of settles) expect(act.reaction).toEqual(['faultClear']);
  });
});
