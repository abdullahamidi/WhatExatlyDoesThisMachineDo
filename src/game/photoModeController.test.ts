import { describe, it, expect } from 'vitest';
import type { EndingPhase } from '../data/types';
import { PHOTO_MODE } from '../data/photoMode';
import { createModalStack } from '../ui/modalStack';
import type { PhotoOverlay } from '../ui/photoMode';
import { createPhotoModeController } from './photoModeController';
import type { PhotoCamera } from './photoModeController';
import type { CameraPose } from './math/finale';

const PORTRAIT: CameraPose = { centerX: 1920, centerY: 1080, zoom: 0.5 };
const START: CameraPose = { centerX: 1000, centerY: 500, zoom: 0.8 };

class FakeCamera implements PhotoCamera {
  current: CameraPose;
  moves: CameraPose[] = [];
  pans: Array<[number, number]> = [];
  zooms: Array<1 | -1> = [];

  constructor(start: CameraPose) {
    this.current = { ...start };
  }

  pose(): CameraPose {
    return { ...this.current };
  }

  moveTo(pose: CameraPose): void {
    this.moves.push({ ...pose });
    this.current = { ...pose };
  }

  panBy(dxScreenPx: number, dyScreenPx: number): void {
    this.pans.push([dxScreenPx, dyScreenPx]);
  }

  zoomStep(dir: 1 | -1): void {
    this.zooms.push(dir);
  }
}

class FakeCrank {
  calls: boolean[] = [];

  setEnabled(on: boolean): void {
    this.calls.push(on);
  }
}

class FakeOverlay implements Pick<PhotoOverlay, 'show' | 'hide' | 'hintVisible'> {
  shows: Array<{ hint: boolean }> = [];
  hides = 0;
  hint = false;

  show(opts: { hint: boolean }): void {
    this.shows.push(opts);
  }

  hide(): void {
    this.hides += 1;
  }

  hintVisible(): boolean {
    return this.hint;
  }
}

function setup(phase: EndingPhase = 'postgame', start: CameraPose = START) {
  const env = {
    phase,
    modals: createModalStack(),
    camera: new FakeCamera(start),
    crank: new FakeCrank(),
    overlay: new FakeOverlay(),
  };
  const controller = createPhotoModeController({
    phase: () => env.phase,
    modals: env.modals,
    camera: env.camera,
    crank: env.crank,
    overlay: env.overlay,
    portrait: () => ({ ...PORTRAIT }),
  });
  // Same object as the closures read, so a test can change env.phase after entry.
  return Object.assign(env, { controller });
}

type Env = ReturnType<typeof setup>;

function expectUntouched(env: Env): void {
  expect(env.modals.isOpen()).toBe(false);
  expect(env.camera.moves).toHaveLength(0);
  expect(env.crank.calls).toHaveLength(0);
  expect(env.overlay.shows).toHaveLength(0);
}

function lastMove(env: Env): CameraPose | undefined {
  return env.camera.moves[env.camera.moves.length - 1];
}

describe('photo mode entry', () => {
  it.each(['none', 'sequence', 'choice'] as const)('refuses entry in phase %s without force', (phase) => {
    const env = setup(phase);
    expect(env.controller.enter()).toBe(false);
    expect(env.controller.isActive()).toBe(false);
    expectUntouched(env);
  });

  it.each(['sequence', 'choice'] as const)('refuses entry in phase %s even with force', (phase) => {
    const env = setup(phase);
    expect(env.controller.enter({ force: true })).toBe(false);
    expect(env.controller.isActive()).toBe(false);
    expectUntouched(env);
  });

  it('refuses entry in postgame while another modal is open', () => {
    const env = setup('postgame');
    env.modals.push('systemMenu', () => {});
    expect(env.controller.enter()).toBe(false);
    expect(env.controller.isActive()).toBe(false);
    expect(env.modals.size()).toBe(1);
    expect(env.modals.topId()).toBe('systemMenu');
    expect(env.camera.moves).toHaveLength(0);
    expect(env.crank.calls).toHaveLength(0);
    expect(env.overlay.shows).toHaveLength(0);
  });

  it('enters in postgame: modal on top, crank off, portrait, overlay with hint', () => {
    const env = setup('postgame');
    expect(env.controller.enter()).toBe(true);
    expect(env.controller.isActive()).toBe(true);
    expect(env.modals.topId()).toBe(PHOTO_MODE.modalId);
    expect(env.crank.calls).toEqual([false]);
    expect(env.camera.moves).toEqual([PORTRAIT]);
    expect(env.overlay.shows).toEqual([{ hint: true }]);
  });

  it('refuses a second enter while active', () => {
    const env = setup('postgame');
    expect(env.controller.enter()).toBe(true);
    expect(env.controller.enter()).toBe(false);
    expect(env.modals.size()).toBe(1);
    expect(env.crank.calls).toEqual([false]);
    expect(env.overlay.shows).toHaveLength(1);
  });

  it('passes hint false to the overlay', () => {
    const env = setup('postgame');
    expect(env.controller.enter({ hint: false })).toBe(true);
    expect(env.overlay.shows).toEqual([{ hint: false }]);
  });

  it('forced entry in phase none works and restores the entry pose on exit', () => {
    const env = setup('none', START);
    expect(env.controller.enter({ force: true })).toBe(true);
    expect(env.camera.moves).toEqual([PORTRAIT]);
    env.controller.exit();
    expect(lastMove(env)).toEqual(START);
  });
});

describe('photo mode exit', () => {
  it('closeTop (Esc) exits: modal gone, overlay hidden, crank on, portrait restored', () => {
    const env = setup('postgame');
    env.controller.enter();
    expect(env.modals.closeTop()).toBe(true);
    expect(env.controller.isActive()).toBe(false);
    expect(env.modals.has(PHOTO_MODE.modalId)).toBe(false);
    expect(env.overlay.hides).toBe(1);
    expect(env.crank.calls).toEqual([false, true]);
    expect(lastMove(env)).toEqual(PORTRAIT);
  });

  it('exit twice does nothing extra', () => {
    const env = setup('postgame');
    env.controller.enter();
    env.controller.exit();
    env.controller.exit();
    expect(env.overlay.hides).toBe(1);
    expect(env.crank.calls).toEqual([false, true]);
    expect(env.camera.moves).toHaveLength(2);
  });

  it('exit when never entered does nothing', () => {
    const env = setup('postgame');
    env.controller.exit();
    expectUntouched(env);
    expect(env.overlay.hides).toBe(0);
  });

  it('destroy exits an active session', () => {
    const env = setup('postgame');
    env.controller.enter();
    env.controller.destroy();
    expect(env.controller.isActive()).toBe(false);
    expect(env.modals.has(PHOTO_MODE.modalId)).toBe(false);
    expect(env.overlay.hides).toBe(1);
    expect(env.crank.calls).toEqual([false, true]);
  });

  it('destroy when inactive does nothing', () => {
    const env = setup('postgame');
    env.controller.destroy();
    expectUntouched(env);
  });
});

describe('photo mode update', () => {
  it('exits when another modal is pushed on top', () => {
    const env = setup('postgame');
    env.controller.enter();
    env.modals.push('techTree', () => {});
    env.controller.update();
    expect(env.controller.isActive()).toBe(false);
    expect(env.modals.has(PHOTO_MODE.modalId)).toBe(false);
    expect(env.modals.topId()).toBe('techTree');
    expect(env.crank.calls).toEqual([false, true]);
  });

  it.each(['sequence', 'choice'] as const)('exits when the phase becomes %s', (phase) => {
    const env = setup('postgame');
    env.controller.enter();
    env.phase = phase;
    env.controller.update();
    expect(env.controller.isActive()).toBe(false);
    expect(env.modals.has(PHOTO_MODE.modalId)).toBe(false);
    expect(env.overlay.hides).toBe(1);
  });

  it('does nothing while photo is on top in postgame', () => {
    const env = setup('postgame');
    env.controller.enter();
    env.controller.update();
    expect(env.controller.isActive()).toBe(true);
    expect(env.modals.topId()).toBe(PHOTO_MODE.modalId);
    expect(env.overlay.hides).toBe(0);
    expect(env.crank.calls).toEqual([false]);
  });

  it('does nothing when inactive', () => {
    const env = setup('postgame');
    env.controller.update();
    expectUntouched(env);
  });
});

describe('photo mode pan and zoom', () => {
  it('pan scales the step by PHOTO_MODE.panScreenPx', () => {
    const env = setup('postgame');
    env.controller.enter();
    env.controller.pan(1, 0);
    expect(env.camera.pans).toEqual([[96, 0]]);
    env.controller.pan(-1, 1);
    expect(env.camera.pans).toEqual([[96, 0], [-96, 96]]);
  });

  it('zoom forwards the direction to zoomStep', () => {
    const env = setup('postgame');
    env.controller.enter();
    env.controller.zoom(1);
    env.controller.zoom(-1);
    expect(env.camera.zooms).toEqual([1, -1]);
  });

  it('pan and zoom are no-ops when inactive', () => {
    const env = setup('postgame');
    env.controller.pan(1, 1);
    env.controller.zoom(1);
    expect(env.camera.pans).toHaveLength(0);
    expect(env.camera.zooms).toHaveLength(0);
  });
});

describe('photo mode state', () => {
  it('reports hint only while active', () => {
    const env = setup('postgame');
    env.overlay.hint = true;
    expect(env.controller.state()).toEqual({ active: false, hint: false });
    env.controller.enter();
    expect(env.controller.state()).toEqual({ active: true, hint: true });
    env.overlay.hint = false;
    expect(env.controller.state()).toEqual({ active: true, hint: false });
  });
});
