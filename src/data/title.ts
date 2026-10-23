// src/data/title.ts
export const TITLE_TEXT = {
  continue: 'CONTINUE', newGame: 'NEW GAME', newGameArmed: 'CONFIRM: ERASE ALL?', settings: 'SETTINGS',
  credits: 'CREDITS', quit: 'QUIT', logoAlt: 'What Exactly Does This Machine Do?', dialogLabel: 'Title screen',
} as const;
export const TITLE_URL_PARAM = 'title';
export const TITLE_LOGO = { url: 'assets/ui/logo.png', width: 230, height: 50, scale: 4 } as const;
