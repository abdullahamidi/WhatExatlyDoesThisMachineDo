import './eraCard.css';
import { ERA_CARD } from '../data/ux';
import type { GameSession } from '../simulation';
import { eraCardFor } from './guidanceView';
import type { EraCardView } from './guidanceView';
import type { TechTree } from './techTree';

// Era card (WP20 D10). DOM only: no Phaser. Purely visual, holds no game state.
// A keystone unlock shows a centred card. While the TECH INDEX is open the card waits as `pending`
// (the backdrop would hide it anyway) and shows when the tree closes. Text is always written with textContent.

// Only the tree surface this card reads, so the card imports nothing from guidance.ts.
export interface EraCardDeps { session: GameSession; techTree: Pick<TechTree, 'isOpen' | 'onOpenChange'> }
export interface EraCards { isShown(): boolean; hide(): void; destroy(): void }

export function createEraCards(root: HTMLElement, deps: EraCardDeps): EraCards {
  const el = document.createElement('div');
  el.id = 'era-card';
  el.setAttribute('role', 'status');
  el.hidden = true;

  const titleEl = document.createElement('div');
  titleEl.className = 'era-card-title';
  const subEl = document.createElement('div');
  subEl.className = 'era-card-sub';
  el.append(titleEl, subEl);
  root.appendChild(el);

  let pending: EraCardView | null = null;
  let fadeTimer: number | null = null;
  let hideTimer: number | null = null;
  let destroyed = false;

  function clearTimers(): void {
    if (fadeTimer !== null) window.clearTimeout(fadeTimer);
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    fadeTimer = null;
    hideTimer = null;
  }

  function hide(): void {
    clearTimers();
    el.classList.remove('is-shown', 'is-fading');
    el.hidden = true;
  }

  function show(card: EraCardView): void {
    clearTimers();
    titleEl.textContent = card.title;
    subEl.textContent = card.subtitle;
    el.hidden = false;
    // Removing and re-adding is-shown (after a reflow) restarts the fade-in when a card replaces one still up.
    el.classList.remove('is-shown', 'is-fading');
    void el.offsetWidth;
    el.classList.add('is-shown');
    fadeTimer = window.setTimeout(() => {
      fadeTimer = null;
      el.classList.add('is-fading');
      hideTimer = window.setTimeout(() => {
        hideTimer = null;
        hide();
      }, ERA_CARD.fadeOutMs);
    }, ERA_CARD.showMs);
  }

  // Clicking the card skips it.
  el.addEventListener('click', () => {
    hide();
  });

  const offUnlock = deps.session.on('unlock', ({ id }) => {
    const card = eraCardFor(id, deps.session.state.ending.phase);
    if (card === null) return;
    // Latest wins: a newer keystone replaces a pending card that has not been shown yet.
    if (deps.techTree.isOpen()) {
      pending = card;
    } else {
      show(card);
    }
  });

  // The finale and a fresh run both drop the card (and anything waiting behind it).
  const offEnding = deps.session.on('ending', ({ phase }) => {
    if (phase === 'none') return;
    pending = null;
    hide();
  });
  const offReset = deps.session.on('reset', () => {
    pending = null;
    hide();
  });

  const offOpenChange = deps.techTree.onOpenChange((open) => {
    if (open || pending === null) return;
    const card = pending;
    pending = null;
    show(card);
  });

  return {
    isShown(): boolean {
      return !el.hidden;
    },

    hide,

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearTimers();
      pending = null;
      offUnlock();
      offEnding();
      offReset();
      offOpenChange();
      el.remove();
    },
  };
}
