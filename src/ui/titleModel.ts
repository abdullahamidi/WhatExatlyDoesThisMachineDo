// Pure title screen model (WP19 T7): button list, NEW GAME label and the title show rule. No DOM, no Phaser.
import type { EndingPhase } from '../data/types';
import { TITLE_TEXT, TITLE_URL_PARAM } from '../data/title';
import { urlFlag } from '../utils/debugFlag';

export type TitleButtonId = 'continue' | 'newGame' | 'settings' | 'credits' | 'quit';

export const TITLE_BUTTON_DOM_IDS: Readonly<Record<TitleButtonId, string>> = {
  continue: 'title-continue',
  newGame: 'title-new',
  settings: 'title-settings',
  credits: 'title-credits',
  quit: 'title-quit',
};

export interface TitleButtonView {
  id: TitleButtonId;
  domId: string;
  label: string;
  visible: boolean;
}

export interface TitleView {
  buttons: readonly TitleButtonView[];
  focus: TitleButtonId;
}

// Debug switch name read by shouldShowTitle (?debug hides the title unless ?title says otherwise).
const DEBUG_URL_PARAM = 'debug';

/** Button list in fixed order (continue, newGame, settings, credits, quit). CONTINUE and QUIT are conditional. */
export function titleView(o: { hasSave: boolean; canQuit: boolean; newGameArmed: boolean }): TitleView {
  const buttons: TitleButtonView[] = [
    { id: 'continue', domId: TITLE_BUTTON_DOM_IDS.continue, label: TITLE_TEXT.continue, visible: o.hasSave },
    {
      id: 'newGame',
      domId: TITLE_BUTTON_DOM_IDS.newGame,
      label: o.newGameArmed ? TITLE_TEXT.newGameArmed : TITLE_TEXT.newGame,
      visible: true,
    },
    { id: 'settings', domId: TITLE_BUTTON_DOM_IDS.settings, label: TITLE_TEXT.settings, visible: true },
    { id: 'credits', domId: TITLE_BUTTON_DOM_IDS.credits, label: TITLE_TEXT.credits, visible: true },
    { id: 'quit', domId: TITLE_BUTTON_DOM_IDS.quit, label: TITLE_TEXT.quit, visible: o.canQuit },
  ];
  return { buttons, focus: o.hasSave ? 'continue' : 'newGame' };
}

/**
 * Whether the title shows on boot. Rules in order: a sequence or choice ending phase hides it; an explicit
 * ?title flag wins; ?debug hides it; otherwise it shows.
 */
export function shouldShowTitle(o: { search: string; phase: EndingPhase }): boolean {
  if (o.phase === 'sequence' || o.phase === 'choice') return false;
  const forced = urlFlag(o.search, TITLE_URL_PARAM);
  if (forced !== null) return forced;
  if (urlFlag(o.search, DEBUG_URL_PARAM) === true) return false;
  return true;
}
