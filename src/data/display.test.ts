import { describe, it, expect } from 'vitest';
import { UI_ZOOM, FRAME_RATE, DISPLAY_TEXT, VIEWPORT_SYNC } from './display';

/**
 * Phaser 3.90 TimeStep.stepLimitFPS model: the accumulator is zeroed after each step, so a limit that sits too close
 * to a refresh rate drops frames (60 Hz panels under a 60 fps limit lose steps). Returns steps per second.
 */
function phaserFps(refreshHz: number, limit: number, seconds = 10): number {
  const jitter = [0.15, -0.15, 0.05, -0.05];
  const frameMs = 1000 / refreshHz;
  const need = 1000 / limit;
  let acc = 0;
  let steps = 0;
  const frames = Math.round(refreshHz * seconds);
  for (let f = 0; f < frames; f++) {
    acc += frameMs + (jitter[f % 4] ?? 0);
    if (acc >= need) {
      steps++;
      acc = 0;
    }
  }
  return steps / seconds;
}

describe('UI_ZOOM', () => {
  it('fits the 720 px base height with a 1x minimum and a 6x cap', () => {
    expect(UI_ZOOM.baseHeight).toBe(720);
    expect(UI_ZOOM.minCanvasScale).toBe(1);
    expect(UI_ZOOM.maxZoom).toBe(6);
  });
});

describe('FRAME_RATE', () => {
  it('targets 60 fps with a 78 fps cap', () => {
    expect(FRAME_RATE.target).toBe(60);
    expect(FRAME_RATE.limit).toBe(78);
  });

  it('60 Hz and 75 Hz panels keep their full rate under the cap', () => {
    expect(phaserFps(60, FRAME_RATE.limit)).toBeGreaterThanOrEqual(59.5);
    expect(phaserFps(75, FRAME_RATE.limit)).toBeGreaterThanOrEqual(74.5);
  });

  it('90 Hz and 100 Hz panels do not fall below half rate', () => {
    expect(phaserFps(90, FRAME_RATE.limit)).toBeGreaterThanOrEqual(44);
    expect(phaserFps(100, FRAME_RATE.limit)).toBeGreaterThanOrEqual(49);
  });

  it('120, 144, 165 and 240 Hz panels land near the 60, 72, 55 and 60 fps the model predicts', () => {
    const at120 = phaserFps(120, FRAME_RATE.limit);
    expect(at120).toBeGreaterThanOrEqual(59);
    expect(at120).toBeLessThanOrEqual(61);
    const at144 = phaserFps(144, FRAME_RATE.limit);
    expect(at144).toBeGreaterThanOrEqual(71);
    expect(at144).toBeLessThanOrEqual(73);
    const at165 = phaserFps(165, FRAME_RATE.limit);
    expect(at165).toBeGreaterThanOrEqual(54);
    expect(at165).toBeLessThanOrEqual(56);
    const at240 = phaserFps(240, FRAME_RATE.limit);
    expect(at240).toBeGreaterThanOrEqual(59);
    expect(at240).toBeLessThanOrEqual(61);
  });

  it('every common refresh rate is capped at 76 fps or below', () => {
    for (const hz of [60, 75, 90, 100, 120, 144, 165, 240, 360]) {
      expect(phaserFps(hz, FRAME_RATE.limit), `${hz} Hz`).toBeLessThanOrEqual(76);
    }
  });
});

describe('VIEWPORT_SYNC', () => {
  it('debounces window resize by 120 ms', () => {
    expect(VIEWPORT_SYNC.resizeDebounceMs).toBe(120);
  });
});

describe('DISPLAY_TEXT', () => {
  it('has the fullscreen label and its key hint', () => {
    expect(DISPLAY_TEXT.fullscreen).toBe('FULLSCREEN');
    expect(DISPLAY_TEXT.fullscreenKeys).toBe('F11 / ALT+ENTER');
  });
});
