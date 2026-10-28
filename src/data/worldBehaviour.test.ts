// Living world behaviour data tests (WP24 T1): every clip frame, burst rest frame and unison accent exists in its sheet; the clip fields are
// well formed; no finale payoff frame is used before the finale; the girl and the crow stay still; the stare-safe rules; the era lists and
// the unison map cover their actions; the cue routes and producers match; the spots sit inside their actor bands (actorBand).
// Why: a frame name, cue or spot that does not exist fails silently in the renderers, so the data is checked where it is written.
// Structure and canon only: the hold, weight and cooldown numbers are tuned by T3d and are never pinned here. Pure data test; the spot
// rule reads the placement maths (src/game/math/worldPlacement.ts), which is pure (no Phaser).
import { describe, it, expect } from 'vitest';
import {
  WORLD_BEHAVIOUR, WORLD_PREFINALE_BANNED, WORLD_REACT, WORLD_REPERTOIRE, WORLD_SPOTS, WORLD_STARE_SAFE, WORLD_UNISON, WORLD_WALK,
} from './worldBehaviour';
import type { Activity, BehaviourActor, Clip, CueId, UnisonClip, UnisonId } from './worldBehaviour';
import { WORLD_ENV, WORLD_FRAMES, WORLD_PLACEMENTS, WORLD_PLAYBACK } from './livingWorld';
import type { FramingKey } from './livingWorld';
import type { TechId } from './types';
import { actorBand, framingKey, framingPose, placeCast } from '../game/math/worldPlacement';

// The smoke stage buy lists (scripts/smoke/stages.mjs), copied as literals as in worldPlacement.test.ts.
const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning',
  'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S8 = [...S7, '@blueprint', 'generator'];
const S9 = [...S7, '@blueprint', 'generator', ...rep('motorRetrofit', 5), ...rep('copperWinding', 20), 'dynamoCrank',
  'capacitorBank', 'sparkGap', ...rep('transformer', 3), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...rep('inductionHeater', 3), ...rep('firebox', 20), 'steamHammer', 'superheater', ...rep('condenser', 5),
  'turbine', 'reliefValves', ...rep('bellowsDrive', 3), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...rep('crankServo', 3), ...rep('harmonicCoil', 25), ...rep('pressureResonator', 3), 'echoCrank', 'phaseLock',
  ...rep('standingWave', 3), 'crystalLattice', ...rep('gridExciter', 5), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...rep('containmentRing', 25), '@resonantSiphon:20', '@graviticAnchor:10', 'inversionCrank', 'lensArray',
  ...rep('horizonField', 20), 'skyAperture', ...rep('mainsBackfeed', 5), ...rep('steamLance', 5), '@finalAlignment'];

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
const CUES: readonly CueId[] = ['atSensor', 'digBout', 'crowMove', 'ring', 'ventPuff', 'rapid', 'crankClick', 'gust'];
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
  const PERCH_FRAMES = ['perch0', 'perch1', 'perchTurn', 'peck0', 'peck1', 'ruffle'];
  const SPREAD_FRAMES = ['frozen', 'frozenTip', 'head', 'talk', 'fly0', 'fly1', 'fly2'];
  const EARLY_CROW = ROWS.filter((r) => r.actor === 'crow' && (r.era === 1 || r.era === 2));

  it('every era I-II crow activity but tipTry draws only the perched frames, never a spread-wing or head or talk frame', () => {
    for (const { era, act } of EARLY_CROW) {
      if (act.id === 'tipTry') continue;
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

describe('stare-safe rules (D2, Q7)', () => {
  it('the first stare-safe entry is the actor front: front, head, head, stand0', () => {
    expect(WORLD_STARE_SAFE.inspector[0]).toBe('front');
    expect(WORLD_STARE_SAFE.dog[0]).toBe('head');
    expect(WORLD_STARE_SAFE.crow[0]).toBe('head');
    expect(WORLD_STARE_SAFE.girl[0]).toBe('stand0');
  });

  it('every rest frame of the era V lists and of the post-observer unison is stare-safe', () => {
    for (const r of ROWS) {
      if (r.era !== 5 || r.act.travel !== undefined) continue;
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
          expect(a.holdMs[0], `${actor} ${a.id} hold`).toBeLessThan(a.holdMs[1]);
          expect(a.weight, `${actor} ${a.id} weight`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('a weight-0 activity is reaction-only (it names a reaction, never free); free activities are interruptible', () => {
    for (const { actor, act } of ROWS) {
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

// Spots (WP24 T1, decision 3): each Inspector and dog spot FEET x (the base placement x plus dx) must lie in the actor band of the
// framing; neighbouring spots are at least minTravelPx apart; the Inspector has at least two spots and the dog three, except that the
// Inspector keeps one spot beside Sensor 7 in the sensor-side framings (WP27 F6.2: s8, s8w, s10).
describe('spots against the actor bands (actorBand)', () => {
  // The framings where Sensor 7 stands beside the Inspector (WP27 F6.2): the Inspector keeps his one spot there.
  const SENSOR_SIDE_FRAMINGS: readonly FramingKey[] = ['s8', 's8w', 's10'];

  const SPOT_STAGES: readonly { name: string; buys: readonly string[] }[] = [
    { name: 'S7', buys: S7 }, { name: 'S8', buys: S8 }, { name: 'S9', buys: S9 }, { name: 'S10', buys: S10 }, { name: 'S11', buys: S11 },
    { name: 'S15', buys: S15 },
  ];

  it.each(SPOT_STAGES)('$name: every Inspector and dog spot feet x lies in its band, neighbours are >= minTravelPx apart', (s) => {
    const levels = levelsOf(s.buys);
    const framing: FramingKey = framingKey(levels);
    const pose = framingPose(levels);
    for (const actor of ['inspector', 'dog'] as const) {
      const spots = WORLD_SPOTS[framing]?.[actor] ?? [];
      const base = WORLD_PLACEMENTS[framing][actor];
      const band = actorBand(framing, pose, levels, actor);
      console.log(`${s.name} ${framing} ${actor} spots ${JSON.stringify(spots.map((p) => [p.id, p.dx]))} band ${JSON.stringify(band)}`);
      expect(base, `${framing} ${actor} placement`).toBeDefined();
      const minSpots = actor === 'dog' ? 3 : SENSOR_SIDE_FRAMINGS.includes(framing) ? 1 : 2;
      expect(spots.length, `${framing} ${actor} spot count`).toBeGreaterThanOrEqual(minSpots);
      expect(new Set(spots.map((p) => p.id)).size, `${framing} ${actor} unique spot ids`).toBe(spots.length);
      for (let i = 1; i < spots.length; i++) {
        const prev = spots[i - 1];
        const cur = spots[i];
        if (prev === undefined || cur === undefined) continue;
        expect(Math.abs(cur.dx - prev.dx), `${framing} ${actor} ${prev.id} to ${cur.id}`).toBeGreaterThanOrEqual(WORLD_WALK.minTravelPx);
      }
      for (const spot of spots) {
        const feet = (base?.x ?? Number.NaN) + spot.dx;
        expect(band !== null && band.min <= feet && feet <= band.max, `${framing} ${actor} ${spot.id} feet ${feet} band ${JSON.stringify(band)}`)
          .toBe(true);
      }
    }
  });

  it('the placed Inspector and dog stand where their band says (placeCast agrees with actorBand)', () => {
    for (const s of SPOT_STAGES) {
      const levels = levelsOf(s.buys);
      const framing = framingKey(levels);
      const placed = placeCast(levels, framing);
      expect(placed.inspector === null, `${s.name} inspector`).toBe(actorBand(framing, undefined, levels, 'inspector') === null);
      expect(placed.dog === null, `${s.name} dog`).toBe(actorBand(framing, undefined, levels, 'dog') === null);
    }
  });

  it('the ending framings (portrait, baseL, baseR) have no spots', () => {
    expect(WORLD_SPOTS.portrait).toBeUndefined();
    expect(WORLD_SPOTS.baseL).toBeUndefined();
    expect(WORLD_SPOTS.baseR).toBeUndefined();
  });
});
