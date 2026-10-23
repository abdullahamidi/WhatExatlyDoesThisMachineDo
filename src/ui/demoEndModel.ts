// Pure demo end model (WP21 T6): phase reducer, END OF DEMO card view, teaser caption, wishlist URL and cap check.
// Plain data in, plain data out, so the demo controller and the card DOM stay thin.
import type { Edition, EditionId } from '../data/edition';
import { DEMO_TEXT } from '../data/demo';
import { PLAQUE_LINES } from '../data/story';
import type { PlaqueLine } from '../data/story';
import type { TechId } from '../data/types';

export type DemoEndPhase = 'idle' | 'waiting' | 'teaser' | 'card';

export interface DemoEndState {
  phase: DemoEndPhase;
  // True when the card was reached through the teaser, so REPLAY and KEEP know where they came from.
  fromTeaser: boolean;
}

export const DEMO_END_IDLE: DemoEndState = Object.freeze({ phase: 'idle', fromTeaser: false });

export type DemoEndEventType =
  | 'capReached'
  | 'delayElapsed'
  | 'teaserDone'
  | 'skip'
  | 'keep'
  | 'openCard'
  | 'replay'
  | 'reset';

/** Unlisted event/phase pairs return the same state object so callers can skip redundant redraws. */
export function reduceDemoEnd(s: DemoEndState, e: { type: DemoEndEventType }): DemoEndState {
  switch (s.phase) {
    case 'idle':
      if (e.type === 'capReached') return { phase: 'waiting', fromTeaser: false };
      if (e.type === 'openCard') return { phase: 'card', fromTeaser: false };
      return s;
    case 'waiting':
      if (e.type === 'delayElapsed') return { phase: 'teaser', fromTeaser: false };
      if (e.type === 'openCard') return { phase: 'card', fromTeaser: false };
      if (e.type === 'reset') return DEMO_END_IDLE;
      return s;
    case 'teaser':
      if (e.type === 'teaserDone') return { phase: 'card', fromTeaser: true };
      if (e.type === 'skip') return { phase: 'card', fromTeaser: true };
      if (e.type === 'reset') return DEMO_END_IDLE;
      return s;
    case 'card':
      if (e.type === 'keep') return DEMO_END_IDLE;
      if (e.type === 'replay') return { phase: 'teaser', fromTeaser: false };
      if (e.type === 'reset') return DEMO_END_IDLE;
      return s;
    default:
      return s;
  }
}

export interface DemoCardButton {
  id: 'wishlist' | 'keep' | 'replay' | 'quit';
  label: string;
  visible: boolean;
}

export interface DemoCardView {
  title: string;
  body: string;
  buttons: DemoCardButton[];
  feedback: { url: string; label: string } | null;
}

/** Button order is fixed: wishlist, keep, replay, quit. QUIT is hidden where the shell cannot quit. */
export function demoCardView(edition: Edition, canQuit: boolean): DemoCardView {
  return {
    title: DEMO_TEXT.cardTitle,
    body: DEMO_TEXT.cardBody,
    buttons: [
      { id: 'wishlist', label: DEMO_TEXT.wishlist, visible: true },
      { id: 'keep', label: DEMO_TEXT.keep, visible: true },
      { id: 'replay', label: DEMO_TEXT.replay, visible: true },
      { id: 'quit', label: DEMO_TEXT.quit, visible: canQuit },
    ],
    feedback: edition.feedbackUrl === null ? null : { url: edition.feedbackUrl, label: DEMO_TEXT.feedback },
  };
}

/** The plaque line that names the cap tech is shown as the teaser caption; unknown caps fall back to the first line. */
export function demoTeaserCaption(capTech: TechId | null, lines: readonly PlaqueLine[] = PLAQUE_LINES): string {
  return lines.find((l) => l.milestone === capTech)?.text ?? lines[0]?.text ?? '';
}

/** Desktop opens the Steam client page; web opens the store page. */
export function wishlistUrl(edition: Edition, desktop: boolean): string {
  return desktop ? edition.steamUrl : edition.storeUrl;
}

export { capReached } from '../data/edition';

export interface DemoEndDebugState {
  edition: EditionId;
  phase: DemoEndPhase;
  capReached: boolean;
  cardOpen: boolean;
  teaserActive: boolean;
  caption: string;
}
