import './memoryPanel.css';
import { PERK_LIST, PRESTIGE_ART } from '../../data/prestige';
import type { PerkId } from '../../data/prestige';
import type { PrestigeState } from '../../data/types';
import type { CyclePreview } from '../../simulation/prestige';
import { buildMemoryView, echoSprite } from './memoryView';
import type { MemoryCard, MemorySprite } from './memoryView';

// MEMORY tab (WP14 T7). DOM only: no Phaser, no GameSession import. Text is always written with textContent.
// Built once; refresh() runs on session events and when the tab is shown, and rewrites only what changed.

export type MemoryPanelEvent = 'prestige' | 'cycle' | 'reset';

const MEMORY_EVENTS: readonly MemoryPanelEvent[] = ['prestige', 'cycle', 'reset'];

/** Structural subset of GameSession used by the panel. */
export interface MemoryPanelSession {
  readonly prestige: Readonly<PrestigeState>;
  on(type: MemoryPanelEvent, fn: () => void): () => void;
}

export interface MemoryPanelDeps {
  session: MemoryPanelSession;
  preview(): CyclePreview;
  buyPerk(id: PerkId): void;
  revealed(): boolean;
}

export interface MemoryPanelHandle {
  refresh(): void;
  destroy(): void;
}

interface CardNodes {
  root: HTMLLIElement;
  slot: HTMLSpanElement;
  icon: HTMLSpanElement;
  name: HTMLSpanElement;
  desc: HTMLSpanElement;
  status: HTMLSpanElement;
  button: HTMLButtonElement;
  signature: string;
  onBuy: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  return node;
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

// Sheet paths are relative to the page; a CSS url() in a style property must be absolute (see finale.ts artUrl).
function sheetUrl(path: string): string {
  return `url("${new URL(path, document.baseURI).href}")`;
}

// Draws one frame of a sheet on an element at the sprite's box size.
function paintSprite(node: HTMLElement, sprite: MemorySprite): void {
  node.style.backgroundImage = sheetUrl(sprite.sheet);
  node.style.backgroundPosition = sprite.bgPosition;
  node.style.backgroundSize = sprite.bgSize;
  node.style.width = `${sprite.box}px`;
  node.style.height = `${sprite.box}px`;
}

function signatureOf(card: MemoryCard): string {
  return [
    card.status, card.name, card.description, card.statusText, card.canBuy,
    card.buttonText ?? '', card.ariaLabel, card.slot.frameIndex, card.icon.frameIndex,
  ].join('|');
}

// One card per perk, built once. The icon sits inside the slot frame at the slot inset.
function buildCard(id: PerkId, onBuy: (id: PerkId) => void): CardNodes {
  const root = el('li', 'mem-card');
  root.tabIndex = -1;
  root.dataset.perkId = id;
  const slot = el('span', 'mem-slot');
  slot.setAttribute('aria-hidden', 'true');
  const icon = el('span', 'mem-icon');
  icon.setAttribute('aria-hidden', 'true');
  const inset = `${PRESTIGE_ART.slotInset * PRESTIGE_ART.scale}px`;
  icon.style.left = inset;
  icon.style.top = inset;
  slot.appendChild(icon);
  const text = el('span', 'mem-text');
  const name = el('span', 'mem-name');
  const desc = el('span', 'mem-desc');
  const status = el('span', 'mem-status');
  text.append(name, desc, status);
  const button = el('button', 'mem-buy');
  button.type = 'button';
  const nodes: CardNodes = { root, slot, icon, name, desc, status, button, signature: '', onBuy: () => onBuy(id) };
  button.addEventListener('click', nodes.onBuy);
  root.append(slot, text, button);
  return nodes;
}

export function createMemoryPanel(host: HTMLElement, deps: MemoryPanelDeps): MemoryPanelHandle {
  const wrap = el('div', 'mem-panel');

  const empty = el('p', 'mem-empty');
  const head = el('div', 'mem-head');
  const echoIcon = el('span', 'mem-echo-icon');
  echoIcon.setAttribute('aria-hidden', 'true');
  const headText = el('div', 'mem-head-text');
  const echoes = el('span', 'mem-echoes');
  const unspent = el('span', 'mem-unspent');
  const cycle = el('span', 'mem-cycle');
  const next = el('span', 'mem-next');
  headText.append(echoes, unspent, cycle, next);
  head.append(echoIcon, headText);

  const list = el('ul', 'mem-list');
  list.setAttribute('role', 'list');
  wrap.append(empty, head, list);

  let destroyed = false;
  const cardNodes = new Map<PerkId, CardNodes>();

  // RECALL: buy, then redraw. Focus moves to the card when its button disappears (owned).
  function onBuy(id: PerkId): void {
    if (destroyed) return;
    const nodes = cardNodes.get(id);
    const hadFocus = nodes !== undefined && document.activeElement === nodes.button;
    deps.buyPerk(id);
    refresh();
    if (hadFocus && nodes !== undefined && nodes.button.hidden) nodes.root.focus();
  }

  for (const def of PERK_LIST) {
    const nodes = buildCard(def.id, onBuy);
    cardNodes.set(def.id, nodes);
    list.appendChild(nodes.root);
  }

  // Rewrites one card's DOM. Called only when its signature changed.
  function paintCard(nodes: CardNodes, card: MemoryCard): void {
    nodes.root.dataset.status = card.status;
    nodes.root.classList.toggle('is-locked', card.status === 'locked');
    nodes.root.classList.toggle('is-affordable', card.status === 'affordable');
    nodes.root.classList.toggle('is-owned', card.status === 'owned');
    paintSprite(nodes.slot, card.slot);
    paintSprite(nodes.icon, card.icon);
    setText(nodes.name, card.name);
    setText(nodes.desc, card.description);
    setText(nodes.status, card.statusText);
    if (card.buttonText === null) {
      nodes.button.hidden = true;
    } else {
      nodes.button.hidden = false;
      setText(nodes.button, card.buttonText);
    }
    nodes.button.disabled = !card.canBuy;
    nodes.button.setAttribute('aria-label', card.ariaLabel);
  }

  function refresh(): void {
    if (destroyed) return;
    const view = buildMemoryView(deps.session.prestige, deps.preview(), deps.revealed());

    setText(empty, view.message);
    empty.hidden = !view.empty;
    head.hidden = view.empty;
    list.hidden = view.empty;
    if (view.empty) return;

    setText(echoes, view.echoesText);
    setText(unspent, view.unspentText);
    setText(cycle, view.cycleText);
    next.hidden = view.nextCycleText === null;
    setText(next, view.nextCycleText ?? '');

    for (const card of view.cards) {
      const nodes = cardNodes.get(card.id);
      if (nodes === undefined) continue;
      const signature = signatureOf(card);
      if (signature === nodes.signature) continue;
      nodes.signature = signature;
      paintCard(nodes, card);
    }
  }

  // Static art (currency icon), painted once.
  paintSprite(echoIcon, echoSprite());

  const unsubscribers = MEMORY_EVENTS.map((type) => deps.session.on(type, refresh));
  host.appendChild(wrap);
  refresh();

  return {
    refresh,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
      for (const nodes of cardNodes.values()) nodes.button.removeEventListener('click', nodes.onBuy);
      cardNodes.clear();
      wrap.remove();
    },
  };
}
