import './techTree.css';
import type { TechId } from '../data/types';
import type { GameCommands } from '../game/context';
import type { GameSession } from '../simulation';
import { buildTechTreeView, defaultSelection, purchaseFailureText } from './techTreeView';
import type { TechDetailView, TechNodeView, TechTreeView } from './techTreeView';

// TECH INDEX overlay (DOM). Built once; update() patches only what changed. No Phaser.

export interface TechTree { open(): void; close(): void; isOpen(): boolean; update(): void; destroy(): void }

/** How long the buy button shows the denied shake (UI timing, not balance). */
const DENIED_FLASH_MS = 400;
/** Longest age of the cached view before update() rebuilds it anyway (UI timing, catches ME changes). */
const REBUILD_INTERVAL_MS = 100;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface ElementOptions { id?: string; className?: string; text?: string }

interface NodeRefs { button: HTMLButtonElement; name: HTMLSpanElement; level: HTMLSpanElement; cost: HTMLSpanElement }

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (options.id !== undefined) el.id = options.id;
  if (options.className !== undefined) el.className = options.className;
  if (options.text !== undefined) el.textContent = options.text;
  return el;
}

/** Writes a DOM field only when its value differs from the last value written to it. */
class Patcher {
  private readonly last = new WeakMap<Element, Map<string, string>>();

  private write(el: Element, field: string, value: string, apply: (next: string) => void): void {
    let fields = this.last.get(el);
    if (fields === undefined) {
      fields = new Map<string, string>();
      this.last.set(el, fields);
    }
    if (fields.get(field) === value) return;
    fields.set(field, value);
    apply(value);
  }

  text(el: Element, value: string): void {
    this.write(el, 'text', value, (next) => { el.textContent = next; });
  }

  attr(el: Element, name: string, value: string): void {
    this.write(el, `attr:${name}`, value, (next) => { el.setAttribute(name, next); });
  }

  hidden(el: HTMLElement, on: boolean): void {
    this.write(el, 'hidden', on ? '1' : '0', (next) => { el.hidden = next === '1'; });
  }

  disabled(el: HTMLButtonElement, on: boolean): void {
    this.write(el, 'disabled', on ? '1' : '0', (next) => { el.disabled = next === '1'; });
  }

  px(el: HTMLElement, prop: 'left' | 'top' | 'width' | 'height', value: number): void {
    this.write(el, `px:${prop}`, String(value), (next) => { el.style[prop] = `${next}px`; });
  }
}

/** Node class list from status and flags. */
function nodeClassOf(node: TechNodeView): string {
  const classes = ['tech-node', `is-${node.status}`];
  if (node.milestone) classes.push('is-milestone');
  if (node.selected) classes.push('is-selected');
  if (node.affordable) classes.push('is-affordable');
  return classes.join(' ');
}

/** Cheap change key: equal strings mean nothing the overlay shows has changed. */
function stampOf(view: TechTreeView): string {
  const nodes = view.nodes.map((n) => `${n.id}:${n.status}:${n.levelText}:${n.affordable}:${n.selected}`).join(';');
  const edges = view.edges.map((e) => `${e.key}:${e.met}`).join(';');
  const d = view.detail;
  const detail = d === null
    ? ''
    : [
      d.id, d.buyState, d.shortfallText ?? '', d.costText ?? '', d.levelText, d.statusLabel,
      d.currentEffect, d.nextEffect ?? '', d.requirements.map((r) => (r.met ? '1' : '0')).join(','),
    ].join('|');
  return [view.meText, nodes, edges, detail].join('#');
}

export function createTechTree(root: HTMLElement, session: GameSession, commands: GameCommands): TechTree {
  const patch = new Patcher();

  // ---- DOM skeleton (built once) ----
  const overlay = createElement('div', { id: 'tech-overlay' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tech-title');

  const panel = createElement('div', { id: 'tech-panel' });

  const header = createElement('header', { className: 'tech-header' });
  const title = createElement('h2', { id: 'tech-title', text: 'TECH INDEX' });
  const meEl = createElement('span', { id: 'tech-me' });
  const closeButton = createElement('button', { id: 'tech-close', className: 'tech-close-btn', text: 'CLOSE [ESC]' });
  closeButton.type = 'button';
  header.append(title, meEl, closeButton);

  const graph = createElement('div', { id: 'tech-graph' });
  const inner = createElement('div', { className: 'tech-graph-inner' });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = 'tech-edges';
  svg.setAttribute('aria-hidden', 'true');
  inner.appendChild(svg);
  graph.appendChild(inner);

  const detailEl = createElement('div', { id: 'tech-detail' });
  const main = createElement('div', { className: 'tech-detail-main' });
  const nameEl = createElement('h3', { id: 'tech-detail-name' });
  const kindEl = createElement('div', { id: 'tech-detail-kind', className: 'tech-dim' });
  const statusEl = createElement('div', { id: 'tech-detail-status' });
  const descEl = createElement('p', { id: 'tech-detail-desc' });
  const flavorEl = createElement('p', { id: 'tech-detail-flavor' });
  const reqList = createElement('ul', { id: 'tech-req-list' });
  main.append(nameEl, kindEl, statusEl, descEl, flavorEl, reqList);

  const side = createElement('div', { className: 'tech-detail-side' });
  const levelEl = createElement('div', { id: 'tech-level' });
  const effectCurrentEl = createElement('div', { id: 'tech-effect-current' });
  const effectNextEl = createElement('div', { id: 'tech-effect-next' });
  const costEl = createElement('div', { id: 'tech-cost' });
  const shortfallEl = createElement('div', { id: 'tech-shortfall' });
  const buyButton = createElement('button', { id: 'tech-buy' });
  buyButton.type = 'button';
  const feedbackEl = createElement('div', { id: 'tech-feedback' });
  feedbackEl.setAttribute('aria-live', 'polite');
  side.append(levelEl, effectCurrentEl, effectNextEl, costEl, shortfallEl, buyButton, feedbackEl);
  detailEl.append(main, side);

  panel.append(header, graph, detailEl);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  // ---- keyed element caches ----
  const nodeRefs = new Map<TechId, NodeRefs>();
  const edgeRefs = new Map<string, SVGPathElement>();
  const reqItems: HTMLLIElement[] = [];

  // ---- state ----
  let isOpenFlag = false;
  let destroyed = false;
  let selected: TechId | null = null;
  let dirty = true;
  let lastStamp = '';
  let returnFocus: HTMLElement | null = null;
  let deniedTimer: number | null = null;
  // Inputs the cached view was built from; update() rebuilds only when they change or the cache is old.
  let builtLevels: object | null = null;
  let builtSelected: TechId | null = null;
  let builtAt = Number.NEGATIVE_INFINITY;
  // What the detail panel showed on the last render; feedback text is stale once either changes.
  let renderedSelected: TechId | null = null;
  let renderedBuyState: TechDetailView['buyState'] | null = null;

  const setFeedback = (text: string): void => {
    patch.text(feedbackEl, text);
  };

  const flashDenied = (): void => {
    if (deniedTimer !== null) window.clearTimeout(deniedTimer);
    buyButton.classList.remove('is-denied');
    void buyButton.offsetWidth; // restart the CSS animation when the class is re-added
    buyButton.classList.add('is-denied');
    deniedTimer = window.setTimeout(() => {
      deniedTimer = null;
      buyButton.classList.remove('is-denied');
    }, DENIED_FLASH_MS);
  };

  const ensureNode = (id: TechId): NodeRefs => {
    const existing = nodeRefs.get(id);
    if (existing !== undefined) return existing;
    const button = createElement('button', { className: 'tech-node' });
    button.type = 'button';
    button.setAttribute('data-tech', id);
    const name = createElement('span', { className: 'tech-node-name' });
    const level = createElement('span', { className: 'tech-node-level' });
    const cost = createElement('span', { className: 'tech-node-cost' });
    button.append(name, level, cost);
    inner.appendChild(button);
    const refs: NodeRefs = { button, name, level, cost };
    nodeRefs.set(id, refs);
    return refs;
  };

  const ensureEdge = (key: string): SVGPathElement => {
    const existing = edgeRefs.get(key);
    if (existing !== undefined) return existing;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('data-edge', key);
    svg.appendChild(path);
    edgeRefs.set(key, path);
    return path;
  };

  const renderEdges = (view: TechTreeView): void => {
    for (const edge of view.edges) {
      const path = ensureEdge(edge.key);
      patch.attr(path, 'class', edge.met ? 'tech-edge is-met' : 'tech-edge');
      patch.attr(path, 'd', edge.d);
    }
  };

  const renderNodes = (view: TechTreeView): void => {
    for (const node of view.nodes) {
      const refs = ensureNode(node.id);
      patch.text(refs.name, node.name);
      patch.text(refs.level, node.levelText);
      patch.text(refs.cost, node.costText ?? '');
      patch.attr(refs.button, 'class', nodeClassOf(node));
      patch.px(refs.button, 'left', node.x);
      patch.px(refs.button, 'top', node.y);
      patch.px(refs.button, 'width', node.width);
      patch.px(refs.button, 'height', node.height);
    }
  };

  const renderRequirements = (requirements: TechDetailView['requirements']): void => {
    while (reqItems.length < requirements.length) {
      const li = createElement('li');
      reqList.appendChild(li);
      reqItems.push(li);
    }
    while (reqItems.length > requirements.length) {
      reqItems.pop()?.remove();
    }
    requirements.forEach((req, index) => {
      const li = reqItems[index];
      if (li === undefined) return;
      patch.text(li, `${req.met ? '✓' : '✗'} ${req.label}`);
      patch.attr(li, 'class', req.met ? 'is-met' : 'is-unmet');
    });
  };

  const renderDetail = (d: TechDetailView | null): void => {
    patch.hidden(detailEl, d === null);
    if (d === null) return;
    patch.text(nameEl, d.name);
    patch.text(kindEl, d.kindLabel);
    patch.text(statusEl, d.statusLabel);
    patch.text(descEl, d.description);
    patch.hidden(flavorEl, d.flavor === null);
    patch.text(flavorEl, d.flavor ?? '');
    renderRequirements(d.requirements);
    patch.text(levelEl, d.levelText);
    patch.text(effectCurrentEl, `NOW: ${d.currentEffect}`);
    patch.hidden(effectNextEl, d.nextEffect === null);
    patch.text(effectNextEl, d.nextEffect === null ? '' : `NEXT: ${d.nextEffect}`);
    patch.text(costEl, d.costText ?? '');
    patch.text(shortfallEl, d.shortfallText ?? '');
    patch.text(buyButton, d.buyLabel);
    patch.disabled(buyButton, !d.buyEnabled);
    patch.attr(buyButton, 'data-buy-state', d.buyState);
  };

  const render = (view: TechTreeView): void => {
    const buyState = view.detail?.buyState ?? null;
    if (selected !== renderedSelected || buyState !== renderedBuyState) setFeedback('');
    renderedSelected = selected;
    renderedBuyState = buyState;
    patch.text(meEl, `${view.meText} ME`);
    patch.px(inner, 'width', view.width);
    patch.px(inner, 'height', view.height);
    patch.attr(svg, 'width', String(view.width));
    patch.attr(svg, 'height', String(view.height));
    renderEdges(view);
    renderNodes(view);
    renderDetail(view.detail);
  };

  const buildView = (): TechTreeView =>
    buildTechTreeView(session.getAllTechViews(), session.state.me, selected);

  function update(): void {
    if (destroyed || !isOpenFlag) return;
    const now = performance.now();
    const levels = session.state.techLevels;
    const due = dirty || levels !== builtLevels || selected !== builtSelected || now - builtAt >= REBUILD_INTERVAL_MS;
    if (!due) return;
    const view = buildView();
    builtLevels = levels;
    builtSelected = selected;
    builtAt = now;
    const stamp = stampOf(view);
    if (!dirty && stamp === lastStamp) return;
    render(view);
    dirty = false;
    lastStamp = stamp;
  }

  function open(): void {
    if (destroyed || isOpenFlag) return;
    const active = document.activeElement;
    returnFocus = active instanceof HTMLElement ? active : null;
    if (selected === null) selected = defaultSelection(session.getAllTechViews());
    isOpenFlag = true;
    overlay.classList.add('is-open');
    window.addEventListener('keydown', onKeyDown);
    dirty = true;
    update();
    closeButton.focus();
  }

  function close(): void {
    if (!isOpenFlag) return;
    isOpenFlag = false;
    overlay.classList.remove('is-open');
    window.removeEventListener('keydown', onKeyDown);
    setFeedback('');
    const target = returnFocus;
    returnFocus = null;
    if (target !== null && target.isConnected) target.focus();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  }

  const onClose = (): void => close();

  const onBackdropClick = (event: Event): void => {
    if (event.target === overlay) close();
  };

  const onGraphClick = (event: Event): void => {
    if (!isOpenFlag) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const node = target.closest('.tech-node');
    if (node === null) return;
    for (const [id, refs] of nodeRefs) {
      if (refs.button !== node) continue;
      selected = id;
      setFeedback('');
      dirty = true;
      update();
      return;
    }
  };

  const onBuy = (): void => {
    if (selected === null) return;
    const before = session.getTechView(selected);
    const result = session.purchase(selected);
    if (!result.ok) {
      setFeedback(purchaseFailureText(result.reason, Math.max(0, (before.nextCost ?? 0) - session.state.me)));
      flashDenied();
      return;
    }
    // Render first: the purchase changes buyState, and render clears feedback on that change.
    dirty = true;
    update();
    setFeedback(result.newLevel > 1 ? `LEVEL ${result.newLevel}` : 'INSTALLED');
  };

  const unsubscribes: Array<() => void> = [
    session.on('purchase', () => { dirty = true; }),
    session.on('unlock', () => { dirty = true; }),
    session.on('reset', () => {
      selected = isOpenFlag ? defaultSelection(session.getAllTechViews()) : null;
      setFeedback('');
      dirty = true;
    }),
    commands.openTechTree.on(() => { open(); }),
  ];

  closeButton.addEventListener('click', onClose);
  overlay.addEventListener('click', onBackdropClick);
  graph.addEventListener('click', onGraphClick);
  buyButton.addEventListener('click', onBuy);

  function isOpen(): boolean {
    return isOpenFlag;
  }

  function destroy(): void {
    if (destroyed) return;
    close();
    destroyed = true;
    for (const unsubscribe of unsubscribes) unsubscribe();
    closeButton.removeEventListener('click', onClose);
    overlay.removeEventListener('click', onBackdropClick);
    graph.removeEventListener('click', onGraphClick);
    buyButton.removeEventListener('click', onBuy);
    if (deniedTimer !== null) {
      window.clearTimeout(deniedTimer);
      deniedTimer = null;
    }
    overlay.remove();
    nodeRefs.clear();
    edgeRefs.clear();
    reqItems.length = 0;
  }

  return { open, close, isOpen, update, destroy };
}
