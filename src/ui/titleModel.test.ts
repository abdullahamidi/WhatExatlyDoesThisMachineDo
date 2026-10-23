import { describe, it, expect } from 'vitest';
import { TITLE_TEXT } from '../data/title';
import type { EndingPhase } from '../data/types';
import { TITLE_BUTTON_DOM_IDS, shouldShowTitle, titleView } from './titleModel';
import type { TitleButtonId } from './titleModel';

const ORDER: readonly TitleButtonId[] = ['continue', 'newGame', 'settings', 'credits', 'quit'];

describe('titleView', () => {
  it('lists the five buttons in fixed order with their DOM ids', () => {
    const view = titleView({ hasSave: true, canQuit: true, newGameArmed: false });
    expect(view.buttons.map((b) => b.id)).toEqual(ORDER);
    expect(view.buttons.map((b) => b.domId)).toEqual([
      'title-continue',
      'title-new',
      'title-settings',
      'title-credits',
      'title-quit',
    ]);
    expect(TITLE_BUTTON_DOM_IDS.newGame).toBe('title-new');
  });

  const combos: ReadonlyArray<[boolean, boolean, boolean]> = [
    [false, false, false],
    [false, false, true],
    [false, true, false],
    [false, true, true],
    [true, false, false],
    [true, false, true],
    [true, true, false],
    [true, true, true],
  ];

  it.each(combos)('hasSave=%s canQuit=%s newGameArmed=%s', (hasSave, canQuit, newGameArmed) => {
    const view = titleView({ hasSave, canQuit, newGameArmed });
    const byId = new Map(view.buttons.map((b) => [b.id, b] as const));

    expect(view.buttons.map((b) => b.id)).toEqual(ORDER);
    for (const id of ORDER) {
      expect(byId.get(id)?.domId).toBe(TITLE_BUTTON_DOM_IDS[id]);
    }

    expect(byId.get('continue')).toEqual({
      id: 'continue',
      domId: 'title-continue',
      label: TITLE_TEXT.continue,
      visible: hasSave,
    });
    expect(byId.get('newGame')).toEqual({
      id: 'newGame',
      domId: 'title-new',
      label: newGameArmed ? TITLE_TEXT.newGameArmed : TITLE_TEXT.newGame,
      visible: true,
    });
    expect(byId.get('settings')).toEqual({
      id: 'settings',
      domId: 'title-settings',
      label: TITLE_TEXT.settings,
      visible: true,
    });
    expect(byId.get('credits')).toEqual({
      id: 'credits',
      domId: 'title-credits',
      label: TITLE_TEXT.credits,
      visible: true,
    });
    expect(byId.get('quit')).toEqual({
      id: 'quit',
      domId: 'title-quit',
      label: TITLE_TEXT.quit,
      visible: canQuit,
    });

    expect(view.focus).toBe(hasSave ? 'continue' : 'newGame');
  });

  it('uses the armed label only for NEW GAME', () => {
    const view = titleView({ hasSave: true, canQuit: true, newGameArmed: true });
    const labels = view.buttons.map((b) => b.label);
    expect(labels).toEqual([
      TITLE_TEXT.continue,
      TITLE_TEXT.newGameArmed,
      TITLE_TEXT.settings,
      TITLE_TEXT.credits,
      TITLE_TEXT.quit,
    ]);
  });
});

describe('shouldShowTitle', () => {
  const cases: Array<[string, EndingPhase, boolean]> = [
    ['', 'none', true],
    ['?title=0', 'none', false],
    ['?debug=1', 'none', false],
    ['?debug', 'none', false],
    ['?debug=1&title=1', 'none', true],
    ['?debug=0', 'none', true],
    ['', 'sequence', false],
    ['?title=1', 'choice', false],
    ['', 'postgame', true],
    ['?title=0', 'postgame', false],
  ];

  it.each(cases)('search %j, phase %s -> %s', (search, phase, expected) => {
    expect(shouldShowTitle({ search, phase })).toBe(expected);
  });
});
