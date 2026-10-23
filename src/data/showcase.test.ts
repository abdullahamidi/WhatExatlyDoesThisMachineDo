import { describe, it, expect } from 'vitest';
import { FINALE_BOOST, FINALE_VIEWS } from './finale';
import { MACHINE_ASSEMBLY, MACHINE_COMPONENT_IDS, MACHINE_COMPONENTS } from './machineComponents';
import type { MachineComponentId } from './machineComponents';
import { RESTORED_ACCENT, SHOWCASE_PORTRAIT, SHOWCASE_SCENE_KEY, SHOWCASE_TEASER } from './showcase';

describe('showcase data', () => {
  it('portrait is a finale view (the canonical full view)', () => {
    expect(Object.keys(FINALE_VIEWS)).toContain(SHOWCASE_PORTRAIT.view);
    expect(SHOWCASE_PORTRAIT.view).toBe('full');
  });

  it('scene key is Showcase', () => {
    expect(SHOWCASE_SCENE_KEY).toBe('Showcase');
  });
});

describe('restored accent hold frames', () => {
  const holds: Partial<Record<string, number>> = RESTORED_ACCENT.holdFrames;

  it('every key is a frames or gauge component with its hold frame in [0, anim.frames)', () => {
    for (const id of Object.keys(holds)) {
      expect(MACHINE_COMPONENT_IDS as readonly string[]).toContain(id);
      const frame = holds[id];
      const anim = MACHINE_COMPONENTS[id as MachineComponentId].animation;
      expect(['frames', 'gauge']).toContain(anim.kind);
      if ((anim.kind !== 'frames' && anim.kind !== 'gauge') || frame === undefined) continue;
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(anim.frames);
    }
  });

  it('keeps the finale boost holds unchanged, adds crystal at frame 2 and generatorGlow at its top gauge frame', () => {
    for (const [id, frame] of Object.entries(FINALE_BOOST.holdFrames)) {
      expect(holds[id]).toBe(frame);
    }
    expect(holds.crystal).toBe(2);
    expect(holds.generatorGlow).toBe(3);
    const glow = MACHINE_COMPONENTS.generatorGlow.animation;
    expect(glow.kind).toBe('gauge');
    if (glow.kind === 'gauge') expect(holds.generatorGlow).toBe(glow.frames - 1);
    expect(Object.keys(holds).sort()).toEqual([...Object.keys(FINALE_BOOST.holdFrames), 'crystal', 'generatorGlow'].sort());
  });
});

describe('teaser timeline', () => {
  it('starts from era II and steps through eras III, IV, V with ascending times', () => {
    expect(SHOWCASE_TEASER.fromEra).toBe(2);
    expect(SHOWCASE_TEASER.steps.map((s) => s.era)).toEqual([3, 4, 5]);
    for (let i = 1; i < SHOWCASE_TEASER.steps.length; i++) {
      const prev = SHOWCASE_TEASER.steps[i - 1];
      const next = SHOWCASE_TEASER.steps[i];
      expect(prev).toBeDefined();
      expect(next).toBeDefined();
      if (prev && next) expect(next.atS).toBeGreaterThan(prev.atS);
    }
  });

  it('camera move ends before the boost ramp starts', () => {
    expect(SHOWCASE_TEASER.camera.startS + SHOWCASE_TEASER.camera.durS).toBeLessThanOrEqual(SHOWCASE_TEASER.boost.startS);
  });

  it('aperture latch comes after the last era step has finished assembling', () => {
    const lastStepAt = Math.max(...SHOWCASE_TEASER.steps.map((s) => s.atS));
    expect(SHOWCASE_TEASER.apertureAtS).toBeGreaterThan(lastStepAt + MACHINE_ASSEMBLY.durationMs / 1000);
  });

  it('ends after the aperture latch has played out (6 frames at 5 fps)', () => {
    const aperture = MACHINE_COMPONENTS.aperture.animation;
    expect(aperture.kind).toBe('latch');
    if (aperture.kind !== 'latch') return;
    expect(SHOWCASE_TEASER.endS).toBeGreaterThanOrEqual(SHOWCASE_TEASER.apertureAtS + aperture.frames / aperture.fps);
  });
});
