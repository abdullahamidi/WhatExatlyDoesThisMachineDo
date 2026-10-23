import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { EDITIONS } from '../data/edition';
import { DEMO_TEXT } from '../data/demo';
import { HUD_TEXT } from '../data/hud';
import { REVEALED } from '../data/finale';
import { PLAQUE_LINES } from '../data/story';
import type { PlaqueLine } from '../data/story';
import type { TechId } from '../data/types';
import { createInitialState } from '../simulation/state';
import {
  DEMO_END_IDLE,
  capReached,
  demoCardView,
  demoTeaserCaption,
  reduceDemoEnd,
  wishlistUrl,
} from './demoEndModel';
import type { DemoEndEventType, DemoEndPhase, DemoEndState } from './demoEndModel';

const PHASES: readonly DemoEndPhase[] = ['idle', 'waiting', 'teaser', 'card'];
const EVENTS: readonly DemoEndEventType[] = [
  'capReached',
  'delayElapsed',
  'teaserDone',
  'skip',
  'keep',
  'openCard',
  'replay',
  'reset',
];

// Expected result per cell: 'same' = same reference returned, 'idle' = DEMO_END_IDLE, else a new state.
type Expect = 'same' | 'idle' | { phase: DemoEndPhase; fromTeaser: boolean };

const TABLE: Record<DemoEndPhase, Record<DemoEndEventType, Expect>> = {
  idle: {
    capReached: { phase: 'waiting', fromTeaser: false },
    delayElapsed: 'same',
    teaserDone: 'same',
    skip: 'same',
    keep: 'same',
    openCard: { phase: 'card', fromTeaser: false },
    replay: 'same',
    reset: 'same',
  },
  waiting: {
    capReached: 'same',
    delayElapsed: { phase: 'teaser', fromTeaser: false },
    teaserDone: 'same',
    skip: 'same',
    keep: 'same',
    openCard: { phase: 'card', fromTeaser: false },
    replay: 'same',
    reset: 'idle',
  },
  teaser: {
    capReached: 'same',
    delayElapsed: 'same',
    teaserDone: { phase: 'card', fromTeaser: true },
    skip: { phase: 'card', fromTeaser: true },
    keep: 'same',
    openCard: 'same',
    replay: 'same',
    reset: 'idle',
  },
  card: {
    capReached: 'same',
    delayElapsed: 'same',
    teaserDone: 'same',
    skip: 'same',
    keep: 'idle',
    openCard: 'same',
    replay: { phase: 'teaser', fromTeaser: false },
    reset: 'idle',
  },
};

const INPUTS: Record<DemoEndPhase, DemoEndState> = {
  idle: DEMO_END_IDLE,
  waiting: { phase: 'waiting', fromTeaser: false },
  teaser: { phase: 'teaser', fromTeaser: false },
  card: { phase: 'card', fromTeaser: true },
};

describe('reduceDemoEnd', () => {
  for (const phase of PHASES) {
    for (const type of EVENTS) {
      it(`${phase} + ${type}`, () => {
        const input = INPUTS[phase];
        const out = reduceDemoEnd(input, { type });
        const want = TABLE[phase][type];
        if (want === 'same') {
          expect(out).toBe(input);
        } else if (want === 'idle') {
          expect(out).toBe(DEMO_END_IDLE);
        } else {
          expect(out).not.toBe(input);
          expect(out.phase).toBe(want.phase);
          expect(out.fromTeaser).toBe(want.fromTeaser);
        }
      });
    }
  }

  it('walks the happy path: cap, delay, teaser, card, replay, keep', () => {
    let s = reduceDemoEnd(DEMO_END_IDLE, { type: 'capReached' });
    s = reduceDemoEnd(s, { type: 'delayElapsed' });
    s = reduceDemoEnd(s, { type: 'teaserDone' });
    expect(s).toEqual({ phase: 'card', fromTeaser: true });
    s = reduceDemoEnd(s, { type: 'replay' });
    expect(s).toEqual({ phase: 'teaser', fromTeaser: false });
    s = reduceDemoEnd(s, { type: 'skip' });
    expect(s).toEqual({ phase: 'card', fromTeaser: true });
    s = reduceDemoEnd(s, { type: 'keep' });
    expect(s).toBe(DEMO_END_IDLE);
  });
});

describe('DEMO_END_IDLE', () => {
  it('is frozen and equals the idle state', () => {
    expect(Object.isFrozen(DEMO_END_IDLE)).toBe(true);
    expect(DEMO_END_IDLE).toEqual({ phase: 'idle', fromTeaser: false });
  });
});

describe('demoCardView', () => {
  it('lists the four buttons in fixed order and hides QUIT when the shell cannot quit', () => {
    const view = demoCardView(EDITIONS.demo, false);
    expect(view.buttons.map((b) => b.id)).toEqual(['wishlist', 'keep', 'replay', 'quit']);
    expect(view.buttons.map((b) => b.label)).toEqual([
      DEMO_TEXT.wishlist,
      DEMO_TEXT.keep,
      DEMO_TEXT.replay,
      DEMO_TEXT.quit,
    ]);
    expect(view.buttons.map((b) => b.visible)).toEqual([true, true, true, false]);
    expect(view.title).toBe(DEMO_TEXT.cardTitle);
    expect(view.body).toBe(DEMO_TEXT.cardBody);
  });

  it('shows QUIT when the shell can quit', () => {
    const view = demoCardView(EDITIONS.demo, true);
    expect(view.buttons.map((b) => b.visible)).toEqual([true, true, true, true]);
  });

  it('has no feedback button when the edition has no feedback url', () => {
    expect(demoCardView(EDITIONS.demo, false).feedback).toBeNull();
    expect(demoCardView(EDITIONS.full, false).feedback).toBeNull();
  });

  it('shows the feedback button with its url when the edition has one', () => {
    const withFeedback = { ...EDITIONS.demo, feedbackUrl: 'https://store.steampowered.com/x' };
    expect(demoCardView(withFeedback, false).feedback).toEqual({
      url: 'https://store.steampowered.com/x',
      label: DEMO_TEXT.feedback,
    });
  });
});

describe('demoTeaserCaption', () => {
  it('shows the cap line for the Substation Blueprint', () => {
    expect(demoTeaserCaption('substationBlueprint')).toBe('PRIMARY FUNCTION: RES?OR?');
  });

  it('never spoils the restore word or the revealed plaque', () => {
    const caption = demoTeaserCaption('substationBlueprint');
    expect(caption).not.toContain('RESTOR');
    expect(caption).not.toBe(REVEALED.plaque);
    expect(caption).not.toBe(HUD_TEXT.restored);
    expect(caption).not.toContain(HUD_TEXT.restored);
  });

  it('falls back to the first plaque line with no cap tech', () => {
    expect(demoTeaserCaption(null)).toBe(PLAQUE_LINES[0]?.text);
    expect(demoTeaserCaption(null)).toBe('PRIMARY FUNCTION: UNKNOWN');
  });

  it('uses the custom lines and falls back to the first of them', () => {
    const lines: readonly PlaqueLine[] = [
      { milestone: null, text: 'FIRST' },
      { milestone: 'generatorBlueprint', text: 'GENERATOR' },
    ];
    expect(demoTeaserCaption('generatorBlueprint', lines)).toBe('GENERATOR');
    expect(demoTeaserCaption('substationBlueprint', lines)).toBe('FIRST');
  });

  it('returns an empty caption for empty lines', () => {
    expect(demoTeaserCaption('substationBlueprint', [])).toBe('');
  });
});

describe('wishlistUrl', () => {
  it('opens the Steam client page on desktop and the store page on the web', () => {
    expect(wishlistUrl(EDITIONS.demo, true)).toBe(EDITIONS.demo.steamUrl);
    expect(wishlistUrl(EDITIONS.demo, false)).toBe(EDITIONS.demo.storeUrl);
  });
});

describe('capReached', () => {
  const base: Record<TechId, number> = createInitialState(0).techLevels;

  it('is true once the cap tech reaches level 1', () => {
    expect(capReached({ ...base, substationBlueprint: 1 }, 'substationBlueprint')).toBe(true);
  });

  it('is false while the cap tech is still at level 0', () => {
    expect(capReached({ ...base, substationBlueprint: 0 }, 'substationBlueprint')).toBe(false);
  });

  it('is false when there is no cap tech (full game)', () => {
    expect(capReached({ ...base, substationBlueprint: 1 }, null)).toBe(false);
  });
});

describe('source guard', () => {
  it('keeps the model free of Phaser and DOM globals', () => {
    const src = readFileSync(fileURLToPath(new URL('./demoEndModel.ts', import.meta.url)), 'utf8');
    for (const word of ['phaser', 'document', 'window']) {
      expect(src).not.toContain(word);
    }
  });
});
