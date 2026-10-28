import { describe, it, expect } from 'vitest';
import { FAULTS } from './faults';
import { FAULT_MARKER, FAULT_TEXT } from './faultMarker';
import { MACHINE_COMPONENT_IDS } from './machineComponents';

// WP27 fault data: the anchors, art timing and texts are read by the marker and the clock. A broken id, a flicker
// faster than 3 Hz or a text that names a restore fails here instead of in the browser.
const ERAS = [1, 2, 3, 4, 5] as const;

describe('FAULT_MARKER anchors', () => {
  it('every era has two anchors, both real machine components', () => {
    for (const era of ERAS) {
      const ids = FAULT_MARKER.anchors[era];
      expect(ids).toHaveLength(2);
      for (const id of ids) expect(MACHINE_COMPONENT_IDS).toContain(id);
    }
  });

  // Serials 0 and 1 mark different parts in every era (AD2 round 2 F8 replaced the era V duplicate with the generator).
  it('every era has two distinct anchors', () => {
    for (const era of ERAS) expect(new Set(FAULT_MARKER.anchors[era]).size).toBe(2);
  });

  it('the fallback anchor is a real machine component', () => {
    expect(MACHINE_COMPONENT_IDS).toContain(FAULT_MARKER.fallbackAnchor);
  });

  // The ADb hand-off (docs/plan/ART_AUDIT.md, WP27-FAULT-HANDOFF): pinned here so a re-pick is a visible data change.
  it('the anchors and the fallback are the ADb hand-off', () => {
    expect(FAULT_MARKER.anchors[1]).toEqual(['pistonArray', 'flywheel']);
    expect(FAULT_MARKER.anchors[2]).toEqual(['sparkGap', 'flywheel']);
    expect(FAULT_MARKER.anchors[3]).toEqual(['boiler', 'steamHammer']);
    expect(FAULT_MARKER.anchors[4]).toEqual(['spireExciter', 'calliope']);
    expect(FAULT_MARKER.anchors[5]).toEqual(['graviticAnchorR', 'generator']);
    expect(FAULT_MARKER.fallbackAnchor).toBe('handCrank');
  });
});

describe('FAULT_MARKER layout', () => {
  // AD2 F4: the plate sits 10 art px above the part top (-14 left the era III plate 1-4 px clear of the UI-150 HUD).
  it('the marker offset is x 0, y -10', () => {
    expect(FAULT_MARKER.layout.offsetArtPx).toEqual({ x: 0, y: -10 });
  });

  it('the layout numbers are positive or zero where a size is meant', () => {
    const L = FAULT_MARKER.layout;
    expect(L.hitMinScreenPx).toBeGreaterThan(0);
    expect(L.barArtPx.w).toBeGreaterThan(0);
    expect(L.barArtPx.h).toBeGreaterThan(0);
    expect(L.gapArtPx).toBeGreaterThanOrEqual(0);
    expect(L.anchorInsetWorldPx).toBeGreaterThanOrEqual(0);
    expect(L.label.fontPx).toBeGreaterThan(0);
    expect(L.label.minScreenPx).toBeGreaterThan(0);
    expect(L.label.strokePx).toBeGreaterThanOrEqual(0);
  });

  it('the fade and the clear frame are short (under a second)', () => {
    expect(FAULT_MARKER.layout.fadeMs).toBeLessThan(1000);
    expect(FAULT_MARKER.layout.clearFrameMs).toBeLessThan(1000);
  });
});

describe('FAULTS clock numbers', () => {
  it('the interval range is ordered and a fault stays 8 s', () => {
    expect(FAULTS.intervalS[0]).toBeLessThan(FAULTS.intervalS[1]);
    expect(FAULTS.windowS).toBe(8);
  });

  it('the live frame clamp is positive and shorter than a fault', () => {
    expect(FAULTS.maxStepS).toBeGreaterThan(0);
    expect(FAULTS.maxStepS).toBeLessThan(FAULTS.windowS);
  });
});

describe('FAULT_MARKER art', () => {
  it('the flicker is at most 3 Hz (one frame at least 334 ms)', () => {
    expect(FAULT_MARKER.art.frameMs).toBeGreaterThanOrEqual(334);
  });

  it('the tag has two frames and every era has two fx frames', () => {
    expect(FAULT_MARKER.art.tag).toHaveLength(2);
    for (const era of ERAS) expect(FAULT_MARKER.art.fx[era]).toHaveLength(2);
  });

  it('the clear frame is not one of the tag or fx frames', () => {
    const used: number[] = [...FAULT_MARKER.art.tag, ...ERAS.flatMap((era) => FAULT_MARKER.art.fx[era])];
    expect(used).not.toContain(FAULT_MARKER.art.clear);
  });
});

describe('FAULT_TEXT', () => {
  it('every era has three codes, unique within the era', () => {
    for (const era of ERAS) {
      const codes = FAULT_TEXT.codes[era];
      expect(codes).toHaveLength(3);
      expect(new Set(codes).size).toBe(3);
    }
  });

  it('no text mentions a restore (case-insensitive)', () => {
    const texts: string[] = [
      FAULT_TEXT.tag, FAULT_TEXT.key, FAULT_TEXT.announceSpawn, FAULT_TEXT.announceClear,
      FAULT_TEXT.a11yPrefix, FAULT_TEXT.popupHeader, FAULT_TEXT.overdrive,
      ...ERAS.flatMap((era) => FAULT_TEXT.codes[era]),
    ];
    for (const text of texts) expect(text.toUpperCase()).not.toContain('RESTOR');
  });
});
