// src/data/credits.ts
export interface CreditsSection { heading: string; lines: readonly string[] }
export const CREDITS_TEXT = { title: 'CREDITS', close: 'CLOSE [ESC]' } as const;
export const CREDITS: readonly CreditsSection[] = [
  { heading: 'A GAME BY', lines: ['abdullahamidi'] },
  { heading: 'ART', lines: ['Pixel art created with PixelLab AI tools', 'and hand-finished by abdullahamidi'] },
  { heading: 'SOUND', lines: ['All sound and music synthesized live with Web Audio'] },
  { heading: 'BUILT WITH', lines: ['Phaser 3 (MIT License), Phaser Studio Inc.', 'Electron and Chromium (see THIRD_PARTY_NOTICES.txt)', 'TypeScript and Vite'] },
  { heading: 'THANK YOU', lines: ['For turning the crank.'] },
];
