// src/data/edition.ts - the two shipped editions. Demo caps progression at the Substation Blueprint; full has no cap.
import type { TechId } from './types';

export type EditionId = 'full' | 'demo';

export interface Edition {
  readonly id: EditionId;
  readonly demo: boolean;
  readonly capTech: TechId | null; // demo 'substationBlueprint'; full null
  readonly maxEra: number | null; // demo 2; full null
  readonly storeUrl: string; // web wishlist target (FULL game page)
  readonly steamUrl: string; // desktop wishlist target (Steam client)
  readonly feedbackUrl: string | null; // null = no feedback button
  readonly label: string | null; // footer/title label: demo 'DEMO'; full null
}

/**
 * Placeholder app id until the Steam app exists. Change it here AND keep the desktop/main.cjs
 * EXTERNAL_ALLOW prefixes valid, or the wishlist buttons open nothing in the desktop shell.
 */
export const STEAM_STORE = {
  appId: '0000000',
  storeUrl: 'https://store.steampowered.com/app/0000000/',
  steamUrl: 'steam://store/0000000',
} as const;

export const EDITIONS: { readonly full: Edition; readonly demo: Edition } = Object.freeze({
  full: Object.freeze({
    id: 'full',
    demo: false,
    capTech: null,
    maxEra: null,
    storeUrl: STEAM_STORE.storeUrl,
    steamUrl: STEAM_STORE.steamUrl,
    feedbackUrl: null,
    label: null,
  }),
  demo: Object.freeze({
    id: 'demo',
    demo: true,
    capTech: 'substationBlueprint',
    maxEra: 2,
    storeUrl: STEAM_STORE.storeUrl,
    steamUrl: STEAM_STORE.steamUrl,
    feedbackUrl: null,
    label: 'DEMO',
  }),
});

/** Only the exact build mode 'demo' selects the demo; anything else (dev, test, unset) is the full game. */
export function editionFor(mode: string | undefined): Edition {
  return mode === 'demo' ? EDITIONS.demo : EDITIONS.full;
}

/** The demo cap is reached once the cap tech has level 1. A null cap (full game) never reaches it. */
export function capReached(levels: Readonly<Record<TechId, number>>, capTech: TechId | null): boolean {
  return capTech !== null && levels[capTech] >= 1;
}
