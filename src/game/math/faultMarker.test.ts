import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  faultEligible, pickAnchor, faultCode, faultFrames, faultTagFrame, faultFxFrame, hitSizeWorld, barWidthPx, fadeAlpha,
} from './faultMarker';
import type { FaultGates } from './faultMarker';
import { FAULT_MARKER, FAULT_TEXT } from '../../data/faultMarker';
import type { EraNumber } from '../../data/eras';
import type { MachineComponentId } from '../../data/machineComponents';

// WP27 C9 fault marker maths. The gates, the anchor and code choice, the flicker frames, the hit zone, the timer bar
// and the fade. Pure: no Phaser, so the renderer's rules are pinned here.
const ERAS: readonly EraNumber[] = [1, 2, 3, 4, 5];

function clear(): FaultGates {
  return { tabHidden: false, photoActive: false, techTreeOpen: false, eraCardShown: false, modalOpen: false,
    cycleBusy: false, teaserOn: false, demoCardOpen: false, endingPhase: 'none', enabled: true };
}

describe('faultEligible', () => {
  it('is true when every gate is clear', () => {
    expect(faultEligible(clear())).toBe(true);
  });

  // Each case flips exactly one gate off the clear state; the rest stay clear.
  const flips: [string, Partial<FaultGates>][] = [
    ['tab hidden', { tabHidden: true }],
    ['photo mode', { photoActive: true }],
    ['TECH INDEX open', { techTreeOpen: true }],
    ['era card shown', { eraCardShown: true }],
    ['modal open', { modalOpen: true }],
    ['cycle transition busy', { cycleBusy: true }],
    ['teaser on', { teaserOn: true }],
    ['demo end card open', { demoCardOpen: true }],
    ['ending sequence running', { endingPhase: 'sequence' }],
    ['faults disabled', { enabled: false }],
  ];
  for (const [name, patch] of flips) {
    it(`${name} alone makes it false`, () => {
      expect(faultEligible({ ...clear(), ...patch })).toBe(false);
    });
  }

  it('the ending choice and postgame phases are not eligible', () => {
    expect(faultEligible({ ...clear(), endingPhase: 'choice' })).toBe(false);
    expect(faultEligible({ ...clear(), endingPhase: 'postgame' })).toBe(false);
  });
});

describe('pickAnchor', () => {
  const allOn = (): boolean => true;
  // The pins read FAULT_MARKER.anchors, so a re-pick of the parts (data) moves the expectations with it, not the maths.
  const A = FAULT_MARKER.anchors;

  it('picks the preferred anchor when it is on screen; serials 0 and 1 pick different ids', () => {
    expect(pickAnchor(1, 0, allOn)).toBe(A[1][0]);
    expect(pickAnchor(1, 1, allOn)).toBe(A[1][1]);
    expect(pickAnchor(1, 0, allOn)).not.toBe(pickAnchor(1, 1, allOn));
  });

  it('wraps the serial over the two anchors', () => {
    expect(pickAnchor(2, 2, allOn)).toBe(A[2][0]);
    expect(pickAnchor(2, 3, allOn)).toBe(A[2][1]);
  });

  it('picks the other anchor when the preferred one is off screen', () => {
    expect(pickAnchor(1, 0, (id) => id !== A[1][0])).toBe(A[1][1]);
    expect(pickAnchor(1, 1, (id) => id !== A[1][1])).toBe(A[1][0]);
  });

  it('falls back to FAULT_MARKER.fallbackAnchor when both anchors are off screen', () => {
    expect(pickAnchor(1, 0, (id) => id === FAULT_MARKER.fallbackAnchor)).toBe(FAULT_MARKER.fallbackAnchor);
    expect(pickAnchor(4, 1, (id) => id === FAULT_MARKER.fallbackAnchor)).toBe(FAULT_MARKER.fallbackAnchor);
  });

  it('probes preferred first, then the other anchors in list order, then the fallback', () => {
    const probed: MachineComponentId[] = [];
    const picked = pickAnchor(1, 1, (id) => { probed.push(id); return false; });
    expect(picked).toBeNull();
    expect(probed).toEqual([A[1][1], A[1][0], FAULT_MARKER.fallbackAnchor]);
  });

  it('gives null when nothing is on screen', () => {
    expect(pickAnchor(3, 0, () => false)).toBeNull();
    expect(pickAnchor(5, 1, () => false)).toBeNull();
  });

  it('is safe for negative serials: -1 is the second anchor, -2 the first', () => {
    expect(pickAnchor(1, -1, allOn)).toBe(A[1][1]);
    expect(pickAnchor(1, -2, allOn)).toBe(A[1][0]);
  });

  it('a non-finite serial counts as 0', () => {
    expect(pickAnchor(1, Number.NaN, allOn)).toBe(A[1][0]);
  });

  it('returns an anchor of the era for every era', () => {
    for (const era of ERAS) {
      const picked = pickAnchor(era, 1, allOn);
      expect(picked).toBe(FAULT_MARKER.anchors[era][1]);
    }
  });
});

describe('faultCode', () => {
  it('cycles the three era I codes in order and wraps', () => {
    expect(faultCode(1, 0)).toBe('BELT SLIP');
    expect(faultCode(1, 1)).toBe('BEARING DRY');
    expect(faultCode(1, 2)).toBe('SHAFT KNOCK');
    expect(faultCode(1, 3)).toBe('BELT SLIP');
    expect(faultCode(1, -1)).toBe('SHAFT KNOCK');
  });

  it('gives the same code for the same serial', () => {
    expect(faultCode(3, 7)).toBe(faultCode(3, 7));
  });

  it('cycles the three codes of every era as FAULT_TEXT lists them', () => {
    for (const era of ERAS) {
      const list = [0, 1, 2].map((s) => faultCode(era, s));
      expect(list).toEqual(FAULT_TEXT.codes[era]);
      expect(new Set(list).size).toBe(3);
      expect(faultCode(era, 3)).toBe(list[0]);
    }
  });
});

describe('flicker frames', () => {
  const FRAME_MS = 340;

  it('the frame clock is 340 ms (2.9 Hz, never above 3 Hz)', () => {
    expect(FAULT_MARKER.art.frameMs).toBe(FRAME_MS);
  });

  it('the tag alternates every 340 ms: 0-339 phase 0, 340-679 phase 1, 680 phase 0', () => {
    expect(faultTagFrame(0, false)).toBe(FAULT_MARKER.art.tag[0]);
    expect(faultTagFrame(339, false)).toBe(FAULT_MARKER.art.tag[0]);
    expect(faultTagFrame(340, false)).toBe(FAULT_MARKER.art.tag[1]);
    expect(faultTagFrame(679, false)).toBe(FAULT_MARKER.art.tag[1]);
    expect(faultTagFrame(680, false)).toBe(FAULT_MARKER.art.tag[0]);
  });

  it('the fx alternates on the same clock, per era', () => {
    for (const era of ERAS) {
      expect(faultFxFrame(0, era, false)).toBe(FAULT_MARKER.art.fx[era][0]);
      expect(faultFxFrame(339, era, false)).toBe(FAULT_MARKER.art.fx[era][0]);
      expect(faultFxFrame(340, era, false)).toBe(FAULT_MARKER.art.fx[era][1]);
      expect(faultFxFrame(680, era, false)).toBe(FAULT_MARKER.art.fx[era][0]);
    }
  });

  it('era I and II share the fx pair 2 / 3; era III to V use their own pairs', () => {
    expect(FAULT_MARKER.art.fx[1]).toEqual([2, 3]);
    expect(FAULT_MARKER.art.fx[2]).toEqual([2, 3]);
    expect(FAULT_MARKER.art.fx[3]).toEqual([4, 5]);
    expect(FAULT_MARKER.art.fx[4]).toEqual([6, 7]);
    expect(FAULT_MARKER.art.fx[5]).toEqual([8, 9]);
    expect(faultFxFrame(0, 1, false)).toBe(2);
    expect(faultFxFrame(340, 2, false)).toBe(3);
    expect(faultFxFrame(340, 5, false)).toBe(9);
  });

  it('under reduced motion the frames stay on phase 0 at every time', () => {
    for (const t of [0, 340, 680, 1020, 123456]) {
      expect(faultTagFrame(t, true)).toBe(FAULT_MARKER.art.tag[0]);
      for (const era of ERAS) expect(faultFxFrame(t, era, true)).toBe(FAULT_MARKER.art.fx[era][0]);
    }
  });

  it('faultFrames returns both frames, matching the single-value functions', () => {
    expect(faultFrames(340, 3, false)).toEqual({ tag: faultTagFrame(340, false), fx: faultFxFrame(340, 3, false) });
    expect(faultFrames(340, 3, true)).toEqual({ tag: FAULT_MARKER.art.tag[0], fx: FAULT_MARKER.art.fx[3][0] });
  });

  it('a negative or non-finite clock reads as phase 0', () => {
    expect(faultTagFrame(-500, false)).toBe(FAULT_MARKER.art.tag[0]);
    expect(faultTagFrame(Number.NaN, false)).toBe(FAULT_MARKER.art.tag[0]);
    expect(faultFxFrame(Number.POSITIVE_INFINITY, 1, false)).toBe(FAULT_MARKER.art.fx[1][0]);
  });
});

describe('hitSizeWorld', () => {
  const MIN = FAULT_MARKER.layout.hitMinScreenPx;

  it('doubles at zoom 0.5 and halves at zoom 2', () => {
    expect(hitSizeWorld(MIN, 0.5)).toBe(MIN * 2);
    expect(hitSizeWorld(MIN, 2)).toBe(MIN / 2);
  });

  it('gives the minimum at zoom 1', () => {
    expect(hitSizeWorld(MIN, 1)).toBe(MIN);
  });

  it('a zoom that is not a positive finite number gives the minimum', () => {
    expect(hitSizeWorld(MIN, 0)).toBe(MIN);
    expect(hitSizeWorld(MIN, Number.NaN)).toBe(MIN);
    expect(hitSizeWorld(MIN, -2)).toBe(MIN);
    expect(hitSizeWorld(MIN, Number.POSITIVE_INFINITY)).toBe(MIN);
  });
});

describe('barWidthPx', () => {
  const FULL = FAULT_MARKER.layout.barArtPx.w;

  it('is full at age 0 and empty at age >= window', () => {
    expect(barWidthPx(0, 8, 16)).toBe(16);
    expect(barWidthPx(8, 8, 16)).toBe(0);
    expect(barWidthPx(9, 8, 16)).toBe(0);
    expect(barWidthPx(0, 8, FULL)).toBe(FULL);
  });

  it('drains linearly', () => {
    expect(barWidthPx(4, 8, 16)).toBe(8);
    expect(barWidthPx(1, 8, 16)).toBe(14);
  });

  it('rounds to the nearest whole px', () => {
    expect(barWidthPx(1, 3, 16)).toBe(11);
    expect(barWidthPx(2, 3, 16)).toBe(5);
  });

  it('an age below 0 clamps to full', () => {
    expect(barWidthPx(-4, 8, 16)).toBe(16);
  });

  it('a window of 0 or less gives 0', () => {
    expect(barWidthPx(0, 0, 16)).toBe(0);
    expect(barWidthPx(0, -8, 16)).toBe(0);
  });

  it('a non-finite input gives 0', () => {
    expect(barWidthPx(Number.NaN, 8, 16)).toBe(0);
    expect(barWidthPx(0, Number.POSITIVE_INFINITY, 16)).toBe(0);
    expect(barWidthPx(0, 8, Number.NaN)).toBe(0);
  });
});

describe('fadeAlpha', () => {
  const FADE = FAULT_MARKER.layout.fadeMs;

  it('is 1 at age 0 and 0 at the end of the fade', () => {
    expect(fadeAlpha(0, FADE)).toBe(1);
    expect(fadeAlpha(FADE, FADE)).toBe(0);
  });

  it('fades linearly in between', () => {
    expect(fadeAlpha(FADE / 2, FADE)).toBe(0.5);
    expect(fadeAlpha(FADE / 4, FADE)).toBe(0.75);
  });

  it('clamps to 0 after the fade and to 1 before the start', () => {
    expect(fadeAlpha(FADE * 3, FADE)).toBe(0);
    expect(fadeAlpha(-50, FADE)).toBe(1);
  });

  it('a fade of 0 or less gives 0', () => {
    expect(fadeAlpha(0, 0)).toBe(0);
    expect(fadeAlpha(0, -300)).toBe(0);
  });

  it('a NaN age gives 0', () => {
    expect(fadeAlpha(Number.NaN, FADE)).toBe(0);
  });
});

describe('faultMarker.ts purity', () => {
  it('has no Phaser import (pure maths)', () => {
    const src = readFileSync(new URL('./faultMarker.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/phaser/i);
  });
});
