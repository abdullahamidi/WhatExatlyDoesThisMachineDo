import './achievementsPanel.css';
import { ACHIEVEMENT_LIST } from '../../data/achievements';
import type { AchievementDefinition } from '../../data/achievements';
import type { AchievementsState } from '../../data/types';
import { achievementCards, counterText, fieldNotes } from './achievementsView';
import type { AchievementCard, SpriteView } from './achievementsView';

// RECORDS tab (WP12 T8). DOM only: no Phaser, no GameSession import. Text is always written with textContent.
// One card per definition, built once; refresh() rewrites only the cards whose visible state changed.

export interface RecordsPanelDeps {
  getUnlocked(): Readonly<AchievementsState>;
  subscribe(fn: () => void): () => void;
  // Rows to show (an edition's subset). Default: every achievement.
  defs?: readonly AchievementDefinition[];
  // FIELD NOTES (WP28): the found notes (world.relics) and the edition's era cap. Absent = no section. The host calls
  // refresh through `subscribe` on the 'find' event too.
  fieldNotes?: { relics(): number; maxEra: number | null };
}

// FIELD NOTES section: a head line (title and n/N) and the found notes in order.
interface NotesView {
  root: HTMLDivElement;
  title: HTMLSpanElement;
  count: HTMLSpanElement;
  list: HTMLOListElement;
  signature: string;
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

function buildNotes(): NotesView {
  const root = el('div', 'ach-notes');
  const head = el('div', 'ach-notes-head');
  const title = el('span', 'ach-notes-title');
  const count = el('span', 'ach-notes-count');
  head.append(title, ' ', count);
  const list = el('ol', 'ach-notes-list');
  root.append(head, list);
  return { root, title, count, list, signature: '' };
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
  const notes = deps.fieldNotes === undefined ? null : buildNotes();
  if (notes !== null) wrap.appendChild(notes.root);

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
    if (card.lock !== null) paintSprite(view.lock, card.lock);
    view.lock.hidden = card.lock === null;
    view.name.textContent = card.name;
    view.desc.textContent = card.description;
    view.status.textContent = card.statusText;
  }

  // FIELD NOTES: the head always, the list only when its text changed (a note is added, or a reset clears them).
  function paintNotes(): void {
    const source = deps.fieldNotes;
    if (notes === null || source === undefined) return;
    const view = fieldNotes(source.relics(), source.maxEra);
    const signature = `${view.countText}\n${view.notes.join('\n')}`;
    if (signature === notes.signature) return;
    notes.signature = signature;
    notes.title.textContent = view.title;
    notes.count.textContent = view.countText;
    notes.list.replaceChildren(...view.notes.map((text) => {
      const item = el('li');
      item.textContent = text;
      return item;
    }));
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
    paintNotes();
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
