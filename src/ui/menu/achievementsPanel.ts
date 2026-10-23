import './achievementsPanel.css';
import { ACHIEVEMENT_LIST } from '../../data/achievements';
import type { AchievementDefinition } from '../../data/achievements';
import type { AchievementsState } from '../../data/types';
import { achievementCards, counterText } from './achievementsView';
import type { AchievementCard, SpriteView } from './achievementsView';

// RECORDS tab (WP12 T8). DOM only: no Phaser, no GameSession import. Text is always written with textContent.
// One card per definition, built once; refresh() rewrites only the cards whose visible state changed.

export interface RecordsPanelDeps {
  getUnlocked(): Readonly<AchievementsState>;
  subscribe(fn: () => void): () => void;
  // Rows to show (an edition's subset). Default: every achievement.
  defs?: readonly AchievementDefinition[];
}

interface CardView {
  root: HTMLLIElement;
  badge: HTMLSpanElement;
  lock: HTMLSpanElement;
  name: HTMLSpanElement;
  desc: HTMLSpanElement;
  status: HTMLSpanElement;
  signature: string;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  return node;
}

// Applies a sprite (position, size and sheet) to an element; the sheet path is a constant from data/.
function paintSprite(node: HTMLElement, sprite: SpriteView): void {
  node.style.backgroundImage = `url(${sprite.sheet})`;
  node.style.backgroundPosition = sprite.bgPosition;
  node.style.backgroundSize = sprite.bgSize;
  node.style.width = `${sprite.box}px`;
  node.style.height = `${sprite.box}px`;
}

// Everything a card shows; a changed value means its DOM must be rewritten.
function signatureOf(card: AchievementCard): string {
  return [card.unlocked, card.name, card.description, card.statusText, card.badge.sheet, card.badge.frameIndex].join('|');
}

function buildCard(): CardView {
  const root = el('li', 'ach-card');
  root.setAttribute('role', 'listitem');
  const badge = el('span', 'ach-badge');
  badge.setAttribute('aria-hidden', 'true');
  const lock = el('span', 'ach-lock');
  lock.setAttribute('aria-hidden', 'true');
  badge.appendChild(lock);
  const text = el('span', 'ach-text');
  const name = el('span', 'ach-name');
  const desc = el('span', 'ach-desc');
  const status = el('span', 'ach-status');
  text.append(name, desc, status);
  root.append(badge, text);
  return { root, badge, lock, name, desc, status, signature: '' };
}

export function createAchievementsPanel(
  host: HTMLElement,
  deps: RecordsPanelDeps,
): { refresh(): void; destroy(): void } {
  const defs = deps.defs ?? ACHIEVEMENT_LIST;
  const ids = defs.map((d) => d.id);
  const wrap = el('div', 'ach-panel');
  const counter = el('div', 'ach-counter');
  counter.setAttribute('aria-live', 'polite');
  const list = el('ul', 'ach-list');
  list.setAttribute('role', 'list');
  wrap.append(counter, list);

  const views = new Map<string, CardView>();
  for (const def of defs) {
    const view = buildCard();
    view.root.dataset.achievementId = def.id;
    views.set(def.id, view);
    list.appendChild(view.root);
  }
  host.appendChild(wrap);

  let destroyed = false;

  // Rewrites one card's DOM. Called only when its signature changed.
  function paintCard(view: CardView, card: AchievementCard): void {
    view.root.dataset.unlocked = card.unlocked ? 'true' : 'false';
    view.root.classList.toggle('is-locked', card.locked);
    view.root.classList.toggle('is-secret', card.secretHidden);
    paintSprite(view.badge, card.badge);
    if (card.lock !== null) {
      paintSprite(view.lock, card.lock);
      view.lock.hidden = false;
    } else {
      view.lock.hidden = true;
    }
    view.name.textContent = card.name;
    view.desc.textContent = card.description;
    view.status.textContent = card.statusText;
  }

  function refresh(): void {
    if (destroyed) return;
    const { unlocked } = deps.getUnlocked();
    const text = counterText(unlocked, defs.length, ids);
    if (counter.textContent !== text) counter.textContent = text;
    for (const card of achievementCards(unlocked, defs)) {
      const view = views.get(card.id);
      if (view === undefined) continue;
      const signature = signatureOf(card);
      if (signature === view.signature) continue;
      view.signature = signature;
      paintCard(view, card);
    }
  }

  const unsubscribe = deps.subscribe(refresh);
  refresh();

  return {
    refresh,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      wrap.remove();
      views.clear();
    },
  };
}
