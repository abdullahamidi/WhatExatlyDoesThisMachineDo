import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  chladniOffsetPx, chladniTargetX, clientToGamePx, countInView, dropFraction, dustPuffing, findEligible, flipScaleX, flipShown, glintFrame,
  glintSlowed, hopOffsetPx, itemCell, leadWaitMs, liftBobPx, liftHeightPx, pickSpot, riseOffsetPx, ringAlpha, spotInView,
  spotUsable, zoneSideWorld,
} from './findMarker';
import type { SpotLike, ViewRect } from './findMarker';
import type { FaultGates } from './faultMarker';
import { FIND_ART, FIND_COLORS, FIND_LAYOUT, FIND_PRODUCER, FIND_PRODUCERS, FIND_SPOTS, FIND_WORLD_TEXT } from '../../data/findWorld';
import type { FindProducer, FindSpot } from '../../data/findWorld';
import { FIND_PRODUCER_ACT } from '../../data/findProducer';
import { DEPTH, GROUND_Y, MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import { WORLD_LAYOUT } from '../../data/livingWorld';
import { FINDS } from '../../data/finds';
import type { Vec2 } from '../../data/machineComponents';
import type { FramingKey } from '../../data/livingWorld';

// WP28 Finds: the marker maths (C5 renderer rules). Pure: the spot pick, the item and glint frames, the ring alpha, the
// intro, hop and fade curves, the zone size and the eligibility. The numbers come from src/data/findWorld.ts.

function clear(): FaultGates {
  return { tabHidden: false, photoActive: false, techTreeOpen: false, eraCardShown: false, modalOpen: false,
    cycleBusy: false, teaserOn: false, demoCardOpen: false, endingPhase: 'none', enabled: true };
}

const ALL_ON = (): boolean => true;
const NONE: readonly Vec2[] = [];
const VIEW: ViewRect = { x: 0, y: 0, right: 1280, bottom: 720 };

describe('pickSpot', () => {
  const spots: SpotLike[] = [{ x: 100, lane: 10 }, { x: 400, lane: 10 }, { x: 700, lane: 10 }, { x: 1000, lane: 10 }];

  it('returns null when no spot is on screen', () => {
    expect(pickSpot(spots, 0, () => false, NONE, 24)).toBeNull();
    expect(pickSpot([], 0, ALL_ON, NONE, 24)).toBeNull();
  });

  it('takes serial % count among the spots on screen', () => {
    expect(pickSpot(spots, 0, ALL_ON, NONE, 24)).toBe(spots[0]);
    expect(pickSpot(spots, 1, ALL_ON, NONE, 24)).toBe(spots[1]);
    expect(pickSpot(spots, 5, ALL_ON, NONE, 24)).toBe(spots[1]);
  });

  it('counts only the spots on screen', () => {
    const onScreen = (s: SpotLike): boolean => s.x !== 400;
    expect(pickSpot(spots, 1, onScreen, NONE, 24)).toBe(spots[2]);
    expect(pickSpot(spots, 0, onScreen, NONE, 24)).toBe(spots[0]);
  });

  it('skips a spot within minDist of a cast member\'s feet, to the next on-screen spot', () => {
    const cast: Vec2[] = [{ x: 100, y: GROUND_Y + 10 + 10 }];   // 10 px from spot 0
    expect(pickSpot(spots, 0, ALL_ON, cast, 24)).toBe(spots[1]);
  });

  it('falls back to the serial slot when every spot is too close to the cast', () => {
    const cast: Vec2[] = spots.map((s) => ({ x: s.x, y: GROUND_Y + s.lane }));
    expect(pickSpot(spots, 2, ALL_ON, cast, 24)).toBe(spots[2]);
  });

  it('a spot exactly minDist away is clear', () => {
    const cast: Vec2[] = [{ x: 100 + 24, y: GROUND_Y + 10 }];
    expect(pickSpot(spots, 0, ALL_ON, cast, 24)).toBe(spots[0]);
  });

  it('a negative or non-finite serial wraps to a slot, never throws', () => {
    expect(pickSpot(spots, -1, ALL_ON, NONE, 24)).toBe(spots[3]);
    expect(pickSpot(spots, Number.NaN, ALL_ON, NONE, 24)).toBe(spots[0]);
  });
});

describe('itemCell', () => {
  it('cycles the seven item cells by serial % 7', () => {
    for (let s = 0; s < 14; s += 1) expect(itemCell(s, false)).toBe(s % 7);
  });

  it('a relic is cell 7 whatever the serial', () => {
    expect(itemCell(4, true)).toBe(FIND_ART.relic);
    expect(itemCell(0, true)).toBe(7);
  });

  it('wraps a negative serial and reads a non-finite one as 0', () => {
    expect(itemCell(-1, false)).toBe(6);
    expect(itemCell(Number.NaN, false)).toBe(0);
  });
});

describe('glintFrame', () => {
  it('holds the first glint cell under reduced motion', () => {
    for (const t of [0, 125, 500, 9000]) expect(glintFrame(t, true)).toBe(FIND_ART.glint[0]);
  });

  it('ping-pongs 8 9 10 9 at 125 ms a frame (2 Hz cycle)', () => {
    expect([0, 125, 250, 375, 500].map((t) => glintFrame(t, false))).toEqual([8, 9, 10, 9, 8]);
  });

  it('is slower in the last seconds of a Find (half the step)', () => {
    expect([0, 250, 500, 750, 1000].map((t) => glintFrame(t, false, true))).toEqual([8, 9, 10, 9, 8]);
    expect(glintFrame(125, false, true)).toBe(8);
    expect(glintFrame(250, false, true)).toBe(9);
  });

  it('only ever returns a glint cell, also for a bad clock', () => {
    for (const t of [-5, Number.NaN, 0.1, 99999]) {
      expect([8, 9, 10]).toContain(glintFrame(t, false));
    }
  });
});

describe('glintSlowed', () => {
  it('turns on in the last fadeLastS of the window', () => {
    expect(glintSlowed(0, 25)).toBe(false);
    expect(glintSlowed(19.9, 25)).toBe(false);
    expect(glintSlowed(20, 25)).toBe(true);
    expect(glintSlowed(25, 25)).toBe(true);
  });
});

describe('ringAlpha', () => {
  it('is in 0..1 and breathes between 1 and 1 - depth', () => {
    const lo = 1 - FIND_LAYOUT.ringBreatheDepth;
    for (let t = 0; t < 2000; t += 50) {
      const a = ringAlpha(t, 0, 25, false);
      expect(a).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(a).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('is static (full) under reduced motion while the Find is young', () => {
    expect(ringAlpha(0, 0, 25, true)).toBe(1);
    expect(ringAlpha(123, 3, 25, true)).toBe(1);
  });

  it('fades linearly over the last fadeLastS and is 0 at the window', () => {
    expect(ringAlpha(0, 20, 25, true)).toBe(1);
    expect(ringAlpha(0, 22.5, 25, true)).toBeCloseTo(0.5, 9);
    expect(ringAlpha(0, 25, 25, true)).toBe(0);
  });

  it('a non-finite age or window gives 0', () => {
    expect(ringAlpha(0, Number.NaN, 25, false)).toBe(0);
    expect(ringAlpha(0, 0, Number.POSITIVE_INFINITY, true)).toBe(0);
  });
});

describe('findEligible', () => {
  it('needs the fault gates and at least one spot on screen', () => {
    expect(findEligible(clear(), 1)).toBe(true);
    expect(findEligible(clear(), 0)).toBe(false);
    expect(findEligible({ ...clear(), enabled: false }, 2)).toBe(false);
    expect(findEligible({ ...clear(), modalOpen: true }, 2)).toBe(false);
    expect(findEligible({ ...clear(), endingPhase: 'choice' }, 2)).toBe(false);
  });
});

describe('spotInView and countInView', () => {
  const spots: SpotLike[] = [{ x: 100, lane: 0 }, { x: 1300, lane: 0 }, { x: 600, lane: 2000 }, { x: 600, lane: 50 }];

  it('a spot inside the view, inset on every side, is on screen', () => {
    const inset = FIND_LAYOUT.viewInsetWorldPx;
    expect(spotInView({ x: 600, lane: 0 }, { x: 0, y: GROUND_Y - 100, right: 1280, bottom: GROUND_Y + 100 }, inset)).toBe(true);
    expect(spotInView({ x: 1300, lane: 0 }, { x: 0, y: GROUND_Y - 100, right: 1280, bottom: GROUND_Y + 100 }, inset)).toBe(false);
  });

  it('counts the spots on screen without allocating a list', () => {
    const view: ViewRect = { x: 0, y: GROUND_Y - 100, right: 1280, bottom: GROUND_Y + 100 };
    expect(countInView(spots, view, FIND_LAYOUT.viewInsetWorldPx)).toBe(2);
    expect(countInView([], view, 0)).toBe(0);
  });
});

describe('the HUD rect in the spot test (WP28a E3)', () => {
  const inset = FIND_LAYOUT.viewInsetWorldPx;
  const view: ViewRect = { x: 0, y: GROUND_Y - 100, right: 1280, bottom: GROUND_Y + 200 };
  // A HUD box at x 600..700 and y G-9..G+48. A spot's item box is 16 px square, its feet at the bottom centre.
  const hud: ViewRect = { x: 600, y: GROUND_Y - 9, right: 700, bottom: GROUND_Y + 48 };

  it('a spot whose item box overlaps the HUD box is off screen', () => {
    expect(spotInView({ x: 650, lane: 30 }, view, inset, hud)).toBe(false);
    expect(spotInView({ x: 650, lane: 26 }, view, inset, hud)).toBe(false);
  });

  it('touching the HUD box counts as meeting it; a box clear of it by 1 px stays on screen', () => {
    // The box of x 592 spans 584..600 and touches the HUD's left edge at 600.
    expect(spotInView({ x: 592, lane: 30 }, view, inset, hud)).toBe(false);
    expect(spotInView({ x: 591, lane: 30 }, view, inset, hud)).toBe(true);
  });

  it('a spot above or below the HUD box is clear of it', () => {
    // Feet at G-26: the box spans G-42..G-26, above the HUD top at G-9.
    expect(spotInView({ x: 650, lane: -26 }, view, inset, hud)).toBe(true);
    // Feet at G+80: the box spans G+64..G+80, below the HUD bottom at G+48.
    expect(spotInView({ x: 650, lane: 80 }, view, inset, hud)).toBe(true);
  });

  it('a null HUD rect is the view alone, as before', () => {
    expect(spotInView({ x: 650, lane: 30 }, view, inset, null)).toBe(true);
    expect(spotInView({ x: 650, lane: 30 }, view, inset)).toBe(true);
  });

  it('countInView leaves out the spots under the HUD box', () => {
    const spots: SpotLike[] = [{ x: 650, lane: 30 }, { x: 591, lane: 30 }, { x: 900, lane: 30 }];
    expect(countInView(spots, view, inset)).toBe(3);
    expect(countInView(spots, view, inset, hud)).toBe(2);
  });

  it('the UI 150 boxes cover the s8 crow spot and the s9 crow ring, and leave the s9 dog spot clear', () => {
    const wide: ViewRect = { x: 2000, y: GROUND_Y - 300, right: 3200, bottom: GROUND_Y + 200 };
    const s8Hud: ViewRect = { x: 2136, y: GROUND_Y - 9, right: 2680, bottom: GROUND_Y + 48 };
    const s9Hud: ViewRect = { x: 2269, y: GROUND_Y + 25, right: 3013, bottom: GROUND_Y + 101 };
    expect(spotInView({ x: 2656, lane: 26 }, wide, inset, s8Hud)).toBe(false);
    expect(spotInView({ x: 2996, lane: 26 }, wide, inset, s9Hud)).toBe(false);
    expect(spotInView({ x: 2904, lane: 20 }, wide, inset, s9Hud)).toBe(true);
  });
});

describe('clientToGamePx', () => {
  it('maps client px to game px through the canvas start and size', () => {
    expect(clientToGamePx(100, 20, 640, 1280)).toBe(160);
    expect(clientToGamePx(20, 20, 640, 1280)).toBe(0);
    expect(clientToGamePx(660, 20, 640, 1280)).toBe(1280);
  });

  it('reads 0 for an empty canvas', () => {
    expect(clientToGamePx(50, 0, 0, 1280)).toBe(0);
  });
});

describe('the WP28a Find layout and spot fixes', () => {
  it('the marker depth base is the Splice yard convention (DEPTH.machine + 3)', () => {
    expect(FIND_LAYOUT.depthBase).toBe(DEPTH.machine + 3);
  });

  it('the spot fixes are in the data (s8w ground and yard spot, s8 ground, s9 dog)', () => {
    expect(FIND_SPOTS.s8w ?? []).toContainEqual({ x: 1508, lane: 104, producer: 'ground' });
    expect(FIND_SPOTS.s8w ?? []).toContainEqual({ x: 1556, lane: 30, producer: 'ground' });
    expect(FIND_SPOTS.s8 ?? []).toContainEqual({ x: 1452, lane: 100, producer: 'ground' });
    expect(FIND_SPOTS.s9 ?? []).toContainEqual({ x: 2904, lane: 20, producer: 'dog' });
  });
});

describe('the drop, hop, rise and flip curves', () => {
  it('the crow drop starts at 0, lands at 1 from the fall end on, and bounces once in between', () => {
    expect(dropFraction(0)).toBe(0);
    expect(dropFraction(FIND_LAYOUT.dropBounceMs * FIND_LAYOUT.dropFallFraction)).toBeCloseTo(1, 9);
    expect(dropFraction(FIND_LAYOUT.dropBounceMs)).toBeCloseTo(1, 9);
    const bounce = dropFraction(FIND_LAYOUT.dropBounceMs * 0.85);
    expect(bounce).toBeLessThan(1);
    expect(bounce).toBeGreaterThan(0.85);
    for (let t = 0; t <= FIND_LAYOUT.dropBounceMs; t += 10) {
      const f = dropFraction(t);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('the collect hop goes up to hopPx at the middle and is back at 0 at the end', () => {
    expect(hopOffsetPx(0)).toBeCloseTo(0, 9);
    expect(hopOffsetPx(FIND_LAYOUT.hopMs / 2)).toBeCloseTo(-FIND_LAYOUT.hopPx, 9);
    expect(hopOffsetPx(FIND_LAYOUT.hopMs)).toBeCloseTo(0, 9);
  });

  it('the ground rise starts risePx below the feet and is gone by riseMs', () => {
    expect(riseOffsetPx(0)).toBe(FIND_LAYOUT.risePx);
    expect(riseOffsetPx(FIND_LAYOUT.riseMs)).toBe(0);
    expect(riseOffsetPx(FIND_LAYOUT.riseMs * 2)).toBe(0);
  });

  it('the gust flip is full at the start and the end, edge-on at the half turn, and shows from the half turn', () => {
    expect(flipScaleX(0)).toBeCloseTo(1, 9);
    expect(flipScaleX(FIND_LAYOUT.flipMs / 2)).toBeCloseTo(0, 9);
    expect(flipScaleX(FIND_LAYOUT.flipMs)).toBeCloseTo(1, 9);
    expect(flipShown(FIND_LAYOUT.flipMs / 2 - 1)).toBe(false);
    expect(flipShown(FIND_LAYOUT.flipMs / 2)).toBe(true);
  });

  it('the dog puff lasts one frame', () => {
    expect(dustPuffing(0)).toBe(true);
    expect(dustPuffing(FIND_LAYOUT.puffMs)).toBe(false);
  });
});

describe('zoneSideWorld', () => {
  it('is at least an item cell and at least hitMinScreenPx on screen at the zoom', () => {
    expect(zoneSideWorld(1)).toBe(FIND_LAYOUT.hitMinScreenPx);
    expect(zoneSideWorld(0.5)).toBe(FIND_LAYOUT.hitMinScreenPx * 2);
    expect(zoneSideWorld(2)).toBe(FIND_LAYOUT.hitMinScreenPx / 2);
    expect(zoneSideWorld(100)).toBe(FIND_ART.cellArtPx * 2);
  });
});

describe('the Find data', () => {
  it('has seven items, one relic cell and three glint cells in the sheet', () => {
    expect(FIND_ART.items).toHaveLength(7);
    expect(FIND_ART.relic).toBe(7);
    expect(FIND_ART.glint).toEqual([8, 9, 10]);
  });

  it('has a colour set for each of the five eras, with the tint fill in eras III and IV only', () => {
    for (const era of [1, 2, 3, 4, 5] as const) expect(FIND_COLORS[era]).toBeDefined();
    expect(FIND_COLORS[3].tintFill).toBe(0xffd27a);
    expect(FIND_COLORS[4].tintFill).toBe(0xffd27a);
    expect(FIND_COLORS[1].tintFill).toBeNull();
    expect(FIND_COLORS[5].tintFill).toBeNull();
  });

  it('has spots with a known producer, numeric lanes and feet inside the yard limits', () => {
    const producers = new Set<string>(FIND_PRODUCERS);
    for (const list of Object.values(FIND_SPOTS)) {
      for (const s of list ?? []) {
        expect(producers.has(s.producer)).toBe(true);
        expect(Number.isFinite(s.x)).toBe(true);
        expect(Number.isFinite(s.lane)).toBe(true);
      }
    }
    expect(FIND_SPOTS.e1?.length).toBe(4);
  });

  it('the payout spread is the Find payout seconds ±2 (the marker shows 4, 6 or 8 s)', () => {
    expect(FINDS.payoutSpreadS.map((s) => FINDS.payoutS + s)).toEqual([4, 6, 8]);
  });

  it('the marker text has no exclamation mark, no ellipsis dots and no "you"', () => {
    const strings: string[] = [FIND_WORLD_TEXT.a11yPrefix, FIND_WORLD_TEXT.announceSpawn, FIND_WORLD_TEXT.announceCollect,
      FIND_WORLD_TEXT.announceRelic, FIND_WORLD_TEXT.popupHeader, FIND_WORLD_TEXT.relicItem, ...FIND_WORLD_TEXT.items,
      ...Object.values(FIND_WORLD_TEXT.producers)];
    for (const text of strings) {
      expect(text).not.toMatch(/!/);
      expect(text).not.toMatch(/\.\.\./);
      expect(text.toLowerCase()).not.toMatch(/\byou\b/);
    }
  });

  it('the spawn announcement reads right for every producer (no doubled word, e.g. "the the")', () => {
    for (const name of Object.values(FIND_WORLD_TEXT.producers)) {
      const line = FIND_WORLD_TEXT.announceSpawn.replace('{producer}', name);
      expect(line).not.toMatch(/\b(\w+) \1\b/i);
      expect(line).toMatch(/^Something glints near the [a-z]+\. /);
    }
  });

  it('the bare yard producer reads as the dust (plain words; the dark read as a place, WP28b r2-FX3)', () => {
    expect(FIND_WORLD_TEXT.producers.lift).toBe('the dust');
    expect(FIND_WORLD_TEXT.announceSpawn.replace('{producer}', FIND_WORLD_TEXT.producers.lift)).toBe('Something glints near the dust. Click it or press G.');
  });
});

describe('the Find producers (WP28b, AD3 hand-off O-e)', () => {
  const SPLICE_PRODUCERS: readonly FindProducer[] = ['organ', 'radio', 'coinReturn', 'pump'];

  it('lists every producer once, and each has a lead of 0-500 ms', () => {
    expect(new Set(FIND_PRODUCERS).size).toBe(FIND_PRODUCERS.length);
    expect(Object.keys(FIND_PRODUCER_ACT.leadMs).sort()).toEqual([...FIND_PRODUCERS].sort());
    for (const p of FIND_PRODUCERS) {
      expect(FIND_PRODUCER_ACT.leadMs[p]).toBeGreaterThanOrEqual(0);
      expect(FIND_PRODUCER_ACT.leadMs[p]).toBeLessThanOrEqual(500);
    }
  });

  it('gives the leads of the hand-off (dog 400, crow 500, the Splice twitches 300, puddle 300, vent 500, the rest 0)', () => {
    expect(FIND_PRODUCER_ACT.leadMs).toEqual({
      dog: 400, crow: 500, gust: 0, ground: 0, organ: 300, radio: 300, coinReturn: 300, puddle: 300, vent: 500, pump: 300, chladni: 0, lift: 0,
    });
    expect(FIND_PRODUCER.chladniWalkMs).toBe(1500);
    expect(FIND_PRODUCER.liftPx).toEqual([12, 16]);
    expect(FIND_PRODUCER.liftMs).toBe(600);
    expect(FIND_PRODUCER.liftBobPx).toBe(1);
    expect(FIND_PRODUCER.liftBobHz).toBe(0.5);
  });

  it('the marker waits the returned lead, clamped to 0-500 ms; a bad value waits 0', () => {
    expect(leadWaitMs(300)).toBe(300);
    expect(leadWaitMs(900)).toBe(500);
    expect(leadWaitMs(-4)).toBe(0);
    expect(leadWaitMs(Number.NaN)).toBe(0);
  });

  it('a spot with requires shows only while that Splice is woken', () => {
    const organ: FindSpot = { x: 1504, lane: 60, producer: 'organ', requires: 'spliceOrgan' };
    expect(spotUsable(organ, {}, 2)).toBe(false);
    expect(spotUsable(organ, { spliceOrgan: 0 }, 2)).toBe(false);
    expect(spotUsable(organ, { spliceOrgan: 1 }, 2)).toBe(true);
    expect(spotUsable(organ, { spliceRadio: 1 }, 2)).toBe(false);
  });

  it('the coin return spot needs the payphone, the coin return stand-in (r2-FX3): the spot shows only with the payphone woken', () => {
    const coin: FindSpot = { x: 3012, lane: 24, producer: 'coinReturn', requires: 'splicePayphone' };
    expect(FIND_PRODUCER_ACT.standIn.coinReturn).toBe(coin.requires);
    expect(spotUsable(coin, {}, 2)).toBe(false);
    expect(spotUsable(coin, { splicePayphone: 1 }, 2)).toBe(true);
  });

  it('the era III producers show only in era III, the Chladni rings in era IV and the lift in era V', () => {
    const vent: FindSpot = { x: 1250, lane: 88, producer: 'vent' };
    const chladni: FindSpot = { x: 780, lane: 110, producer: 'chladni' };
    const lift: FindSpot = { x: 720, lane: 160, producer: 'lift' };
    expect([1, 2, 3, 4, 5].map((e) => spotUsable(vent, {}, e))).toEqual([false, false, true, false, false]);
    expect([1, 2, 3, 4, 5].map((e) => spotUsable(chladni, {}, e))).toEqual([false, false, false, true, false]);
    expect([1, 2, 3, 4, 5].map((e) => spotUsable(lift, {}, e))).toEqual([false, false, false, false, true]);
  });

  it('the plain producers (dog, crow, gust, ground) are usable in every era', () => {
    const dog: FindSpot = { x: 2420, lane: 56, producer: 'dog' };
    expect([1, 2, 3, 4, 5].every((e) => spotUsable(dog, {}, e))).toBe(true);
  });

  it('the Chladni item walks to the nearest node of the grid, at most half a spacing away', () => {
    const n = FIND_PRODUCER.chladniNodePx;
    expect(chladniTargetX(MACHINE_ANCHOR.x)).toBe(MACHINE_ANCHOR.x);
    expect(chladniTargetX(MACHINE_ANCHOR.x + n * 3 + 10)).toBe(MACHINE_ANCHOR.x + n * 3);
    for (const x of [780, 3040, 2930, 1000, 2500]) {
      const node = chladniTargetX(x);
      expect(Math.abs(node - x)).toBeLessThanOrEqual(n / 2);
      expect(Math.abs(node - MACHINE_ANCHOR.x) % n).toBe(0);
    }
  });

  it('the Chladni walk is a smoothstep over chladniWalkMs from the spot to its node', () => {
    const spot = 780;
    const node = chladniTargetX(spot);
    expect(chladniOffsetPx(spot, 0)).toBe(0);
    expect(chladniOffsetPx(spot, FIND_PRODUCER.chladniWalkMs / 2)).toBeCloseTo((node - spot) / 2, 9);
    expect(chladniOffsetPx(spot, FIND_PRODUCER.chladniWalkMs)).toBeCloseTo(node - spot, 9);
    expect(chladniOffsetPx(spot, FIND_PRODUCER.chladniWalkMs * 3)).toBeCloseTo(node - spot, 9);
    let prev = 0;
    for (let t = 0; t <= FIND_PRODUCER.chladniWalkMs; t += 50) {
      const v = chladniOffsetPx(spot, t);
      expect(Math.abs(v)).toBeGreaterThanOrEqual(Math.abs(prev) - 1e-9);
      expect(Math.abs(v)).toBeLessThanOrEqual(Math.abs(node - spot) + 1e-9);
      prev = v;
    }
  });

  it('the lift rises to its serial height over liftMs, then holds, and never falls', () => {
    const [lo, hi] = FIND_PRODUCER.liftPx;
    const heights = new Set<number>();
    for (let serial = 0; serial < 10; serial += 1) {
      const top = liftHeightPx(FIND_PRODUCER.liftMs, serial);
      expect(top).toBeGreaterThanOrEqual(lo);
      expect(top).toBeLessThanOrEqual(hi);
      expect(liftHeightPx(FIND_PRODUCER.liftMs * 4, serial)).toBe(top);
      heights.add(top);
    }
    expect([...heights].sort((a, b) => a - b)).toEqual([12, 13, 14, 15, 16]);
    expect(liftHeightPx(0, 3)).toBe(0);
    for (let t = 0; t < 1200; t += 40) expect(liftHeightPx(t + 40, 2)).toBeGreaterThanOrEqual(liftHeightPx(t, 2));
  });

  it('the lift bob stays within liftBobPx and is still before the lift starts', () => {
    expect(liftBobPx(0)).toBe(0);
    for (let t = 0; t < 8000; t += 37) expect(Math.abs(liftBobPx(t))).toBeLessThanOrEqual(FIND_PRODUCER.liftBobPx + 1e-9);
  });
});

describe('the FIND_SPOTS guard (WP28b, AD3 hand-off O-e)', () => {
  const lists = (): (readonly [string, readonly FindSpot[]])[] => {
    const out: (readonly [string, readonly FindSpot[]])[] = [];
    for (const [key, list] of Object.entries(FIND_SPOTS)) if (list !== undefined) out.push([key, list]);
    return out;
  };
  const SPLICE_PRODUCERS: readonly FindProducer[] = ['organ', 'radio', 'coinReturn', 'pump'];

  it('every spot names a producer of the enum and a Splice (requires) only for the Splice producers', () => {
    for (const [, list] of lists()) {
      for (const s of list) {
        expect(FIND_PRODUCERS).toContain(s.producer);
        if (s.requires !== undefined) {
          expect(SPLICE_PRODUCERS).toContain(s.producer);
          expect(s.requires.startsWith('splice')).toBe(true);
        }
        if (SPLICE_PRODUCERS.includes(s.producer)) expect(s.requires, `${s.producer} at ${s.x}`).toBeDefined();
      }
    }
  });

  // The O-e hand-off puts s9's coin return at 3012,24, 16.1 px from the WP28a crow spot at 2996,26 (the 24 px rule is for cast feet, pickSpot).
  // Only one Find is alive at once, so the spots of a framing never share a box: they stay at least one item box (16 px) apart.
  it('spots of one framing are at least one item box (16 px) apart', () => {
    const box = FIND_ART.cellArtPx * PIXEL_SCALE;
    for (const [key, list] of lists()) {
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          if (a === undefined || b === undefined) continue;
          const d = Math.hypot(a.x - b.x, a.lane - b.lane);
          expect(d, `${key} ${a.x},${a.lane} vs ${b.x},${b.lane}`).toBeGreaterThanOrEqual(box);
        }
      }
    }
  });

  it('no item sits within 96 px of the crank hub', () => {
    const hub = WORLD_LAYOUT.crankHub;
    const itemHalf = (FIND_ART.cellArtPx * PIXEL_SCALE) / 2;
    for (const [key, list] of lists()) {
      for (const s of list) {
        const d = Math.hypot(s.x - hub.x, GROUND_Y + s.lane - itemHalf - hub.y);
        expect(d, `${key} ${s.x},${s.lane}`).toBeGreaterThanOrEqual(96);
      }
    }
  });

  it('the era III-V producers sit in their framings (s10, s11 for III-IV; s11 and s15 for V)', () => {
    const producersOf = (key: FramingKey): string[] => (FIND_SPOTS[key] ?? []).map((s) => s.producer);
    expect(producersOf('s10')).toEqual(['vent', 'ground']);
    expect(producersOf('s15').every((p) => p === 'lift')).toBe(true);
    expect(producersOf('s11')).toContain('chladni');
  });
});

describe('findMarker.ts purity', () => {
  it('has no Phaser import (pure maths)', () => {
    const src = readFileSync(new URL('./findMarker.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/phaser/i);
  });
});
