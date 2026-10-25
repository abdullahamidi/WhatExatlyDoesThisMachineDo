// Tests for the pure speech bubble model (WP23a, DENIZEN_ART 4.1): transform string, class list and live-region text.
import { describe, it, expect } from 'vitest';
import { WORLD_A11Y_PREFIX } from '../data/livingWorld';
import { bubbleClass, bubbleTransform, liveText, snapToDevicePx } from './worldVoiceModel';
import type { WorldVoicePos } from './worldVoiceModel';

const POS: WorldVoicePos = { x: 100, y: 200, tailX: 40, tailUp: false };

describe('bubbleTransform', () => {
  it('translates the box origin in whole px', () => {
    expect(bubbleTransform(POS)).toBe('translate(100px, 200px)');
  });

  it('rounds fractional positions to whole px', () => {
    expect(bubbleTransform({ ...POS, x: 10.4, y: 20.6 })).toBe('translate(10px, 21px)');
  });

  it('keeps negative offsets (a bubble near the left or top inset)', () => {
    expect(bubbleTransform({ ...POS, x: -12.6, y: -3 })).toBe('translate(-13px, -3px)');
  });

  it('ignores the tail (the tail goes through --tx)', () => {
    expect(bubbleTransform({ ...POS, tailX: 999, tailUp: true })).toBe('translate(100px, 200px)');
  });

  it('is unchanged at zoom 1 (whole CSS px)', () => {
    expect(bubbleTransform({ ...POS, x: 10.4, y: 20.6 }, 1)).toBe('translate(10px, 21px)');
  });

  it('snaps to whole device px at zoom 1.5', () => {
    // 10.3 CSS px is 15.45 device px: 15 device px is 10 CSS px.
    expect(bubbleTransform({ ...POS, x: 10.3, y: 20 }, 1.5)).toBe('translate(10px, 20px)');
    // 10.5 CSS px is 15.75 device px: 16 device px is 16 / 1.5 CSS px.
    expect(bubbleTransform({ ...POS, x: 10.5, y: 20 }, 1.5)).toBe(`translate(${16 / 1.5}px, 20px)`);
  });

  it('keeps every translate on a whole device px at zoom 1.25 and 1.5', () => {
    const values = [0.3, 10.1, 10.5, 10.7, 123.45, 499.99, -12.6];
    for (const zoom of [1.25, 1.5]) {
      for (const v of values) {
        for (const css of translatePx(bubbleTransform({ ...POS, x: v, y: v }, zoom))) {
          const device = css * zoom;
          expect(Math.abs(device - Math.round(device))).toBeLessThan(1e-9);
        }
      }
    }
  });
});

describe('snapToDevicePx', () => {
  it('returns the value unchanged at zoom 1 when it is whole', () => {
    expect(snapToDevicePx(42, 1)).toBe(42);
  });

  it('rounds to the nearest device px at the zoom', () => {
    expect(snapToDevicePx(10.3, 1.5)).toBe(10);
    expect(snapToDevicePx(10.5, 1.5)).toBe(16 / 1.5);
  });
});

// The px numbers of a translate string, in order.
function translatePx(transform: string): number[] {
  return (transform.match(/-?[\d.]+(?=px)/g) ?? []).map(Number);
}

describe('bubbleClass', () => {
  it('is the bare class while hidden', () => {
    expect(bubbleClass(false, false)).toBe('wv');
  });

  it('adds on while shown', () => {
    expect(bubbleClass(true, false)).toBe('wv on');
  });

  it('adds up when the tail points up', () => {
    expect(bubbleClass(false, true)).toBe('wv up');
    expect(bubbleClass(true, true)).toBe('wv on up');
  });
});

describe('liveText', () => {
  it('joins the prefix and the line with one space', () => {
    expect(liveText('Inspector:', "Unchanged. I'm not on the count either.")).toBe(
      "Inspector: Unchanged. I'm not on the count either.",
    );
  });

  it('reads with the speaker prefixes from the living world data', () => {
    expect(liveText(WORLD_A11Y_PREFIX.girl, 'Is someone there? Your light is on.')).toBe(
      'Girl: Is someone there? Your light is on.',
    );
    expect(liveText(WORLD_A11Y_PREFIX.payphone, 'Hello? Operator?')).toBe('Payphone: Hello? Operator?');
  });
});
