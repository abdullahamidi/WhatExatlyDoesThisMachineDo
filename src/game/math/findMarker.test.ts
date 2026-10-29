import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  clientToGamePx, countInView, dropFraction, dustPuffing, findEligible, flipScaleX, flipShown, glintFrame, glintSlowed, hopOffsetPx,
  itemCell, pickSpot, riseOffsetPx, ringAlpha, spotInView, zoneSideWorld,
} from './findMarker';
import type { SpotLike, ViewRect } from './findMarker';
import type { FaultGates } from './faultMarker';
import { FIND_ART, FIND_COLORS, FIND_LAYOUT, FIND_SPOTS, FIND_WORLD_TEXT } from '../../data/findWorld';
import { DEPTH, GROUND_Y } from '../../data/world';
import { FINDS } from '../../data/finds';
import type { Vec2 } from '../../data/machineComponents';

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
    const producers = new Set(['dog', 'crow', 'gust', 'ground']);
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
      expect(line).toMatch(/^Something glints near the (dog|crow|scraps|yard)\. /);
    }
  });
});

describe('findMarker.ts purity', () => {
  it('has no Phaser import (pure maths)', () => {
    const src = readFileSync(new URL('./findMarker.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/phaser/i);
  });
});
