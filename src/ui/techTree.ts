import './techTree.css';
import type { PurchaseFailure, TechId, TechView } from '../data/types';
import { UI_ART } from '../data/achievements';
import { BUY_MAX, SPLICE_TAB } from '../data/ux';
import type { GameContext } from '../game/context';
import type { GameSession } from '../simulation';
import { isSplice } from '../simulation/progression/status';
import { buildEraTabs, buildSpliceDetail, buildSpliceRows, buildSpliceTab, buildTechTreeView, defaultSelection, defaultSpliceSelection, eraHeaderText, graphFitScale, priorityTech, purchaseFailureText, purchaseFeedbackText, reachedEras, revealScroll, TECH_TREE_FIT } from './techTreeView';
import type { EraTabView, SpliceDetailView, SpliceRowView, SpliceTabView, TechDetailView, TechNodeView, TechTreeView } from './techTreeView';
import { trapFocus } from './hotkeys';

// TECH INDEX overlay (DOM). Built once; update() patches only what changed. No Phaser.

export interface TechTree { open(): void; close(): void; isOpen(): boolean; update(): void; destroy(): void; onOpenChange(fn: (open: boolean) => void): () => void }

/** How long the buy button shows the denied shake (UI timing, not balance). */
const DENIED_FLASH_MS = 400;
/** Longest age of the cached view before update() rebuilds it anyway (UI timing, catches ME changes). */
const REBUILD_INTERVAL_MS = 100;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface ElementOptions { id?: string; className?: string; text?: string }

interface NodeRefs { button: HTMLButtonElement; name: HTMLSpanElement; level: HTMLSpanElement; cost: HTMLSpanElement }
interface SpliceRowRefs { button: HTMLButtonElement; fields: HTMLSpanElement[] }

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

/** What the overlay shows in one pass: the era graph (null in SPLICES mode) or the Splice rows with their detail, and the tabs. */
interface Shown {
  headerText: string; tabs: EraTabView[]; spliceTab: SpliceTabView | null; graph: TechTreeView | null;
  rows: SpliceRowView[]; spliceDetail: SpliceDetailView | null;
}

/** Change key: the JSON of everything the overlay shows (labels, resource short names and ARIA names included). Equal strings mean nothing changed. */
function stampOf(s: Shown): string {
  return JSON.stringify(s);
}

export function createTechTree(root: HTMLElement, ctx: GameContext): TechTree {
  const { session, commands, modals, feedback } = ctx;
  const patch = new Patcher();

  // ---- DOM skeleton (built once) ----
  const overlay = createElement('div', { id: 'tech-overlay' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tech-title');
  // Status-marker glyphs (CSS, opt-in via #ui-root[data-status-markers="on"]) read this sheet. Absolute URL (see systemMenu).
  overlay.style.setProperty('--ui-icons', `url("${new URL(UI_ART.icons16, document.baseURI).href}")`);

  const panel = createElement('div', { id: 'tech-panel' });

  const header = createElement('header', { className: 'tech-header' });
  const title = createElement('h2', { id: 'tech-title', text: 'TECH INDEX' });
  const meEl = createElement('span', { id: 'tech-me' });
  const closeButton = createElement('button', { id: 'tech-close', className: 'tech-close-btn', text: 'CLOSE [ESC]' });
  closeButton.type = 'button';
  header.append(title, meEl, closeButton);

  const tabList = createElement('div', { id: 'tech-tabs', className: 'tech-tabs' });
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', 'Eras');
  // WP28 C9: the SPLICES tab follows the era tabs (ensureTab inserts before it); hidden until a Splice is not locked.
  const spliceTab = createElement('button', { className: 'tech-tab', id: 'tech-tab-splices' });
  spliceTab.type = 'button';
  spliceTab.setAttribute('role', 'tab');
  spliceTab.setAttribute('aria-controls', 'tech-splices');
  spliceTab.hidden = true;
  tabList.appendChild(spliceTab);

  const graph = createElement('div', { id: 'tech-graph' });
  graph.setAttribute('role', 'tabpanel');
  const inner = createElement('div', { className: 'tech-graph-inner' });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = 'tech-edges';
  svg.setAttribute('aria-hidden', 'true');
  inner.appendChild(svg);
  graph.appendChild(inner);
  // WP28 C9: the Splice rows take the graph's place (same box) while SPLICES is selected.
  const spliceList = createElement('div', { id: 'tech-splices' });
  spliceList.setAttribute('role', 'tabpanel');
  spliceList.setAttribute('aria-labelledby', 'tech-tab-splices');
  spliceList.hidden = true;

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
  // WP28 C9: BUY MAX (one purchaseMax per press) is shown only for an affordable repeatable.
  const buyMaxButton = createElement('button', { id: 'tech-buy-max', text: BUY_MAX.label });
  buyMaxButton.type = 'button';
  buyMaxButton.hidden = true;
  const feedbackEl = createElement('div', { id: 'tech-feedback' });
  feedbackEl.setAttribute('aria-live', 'polite');
  side.append(levelEl, effectCurrentEl, effectNextEl, costEl, shortfallEl, buyButton, buyMaxButton, feedbackEl);
  detailEl.append(main, side);

  panel.append(header, tabList, graph, spliceList, detailEl);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  // ---- keyed element caches ----
  const tabRefs = new Map<number, HTMLButtonElement>();
  const nodeRefs = new Map<TechId, NodeRefs>();
  const spliceRowRefs = new Map<TechId, SpliceRowRefs>();
  const edgeRefs = new Map<string, SVGPathElement>();
  const reqItems: HTMLLIElement[] = [];

  // ---- state ----
  let isOpenFlag = false;
  let destroyed = false;
  let selected: TechId | null = null;
  let selectedEra = 1;
  // WP28 C9: true while the SPLICES tab shows the Splice rows (the era graph and its tabs are then not selected).
  let spliceMode = false;
  let dirty = true;
  let lastStamp = '';
  let returnFocus: HTMLElement | null = null;
  let disposeFocusTrap: (() => void) | null = null;
  let deniedTimer: number | null = null;
  // Inputs the cached view was built from; update() rebuilds only when they change or the cache is old.
  let builtLevels: object | null = null;
  let builtSelected: TechId | null = null;
  let builtEra = 0;
  let builtAt = Number.NEGATIVE_INFINITY;
  // What the detail panel showed on the last render; feedback text is stale once either changes.
  let renderedSelected: TechId | null = null;
  let renderedBuyState: TechDetailView['buyState'] | null = null;
  // WP20: onOpenChange listeners; the view the graph was last rendered from (fit + reveal); the fit zoom in use.
  const openListeners = new Set<(open: boolean) => void>();
  let lastView: TechTreeView | null = null;
  let fitScale = 1;
  const emitOpen = (open: boolean): void => { for (const fn of [...openListeners]) fn(open); };

  const setFeedback = (text: string): void => {
    patch.text(feedbackEl, text);
  };

  /** Selects one tech (a node or a Splice row; null for none) and redraws. */
  const select = (id: TechId | null): void => {
    selected = id;
    setFeedback('');
    dirty = true;
    update();
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

  /** WP16b-2: releases the Tab trap of the open tree (no-op when none is armed). */
  const releaseFocusTrap = (): void => {
    const dispose = disposeFocusTrap;
    disposeFocusTrap = null;
    if (dispose !== null) dispose();
  };

  const viewsOfEra = (era: number): TechView[] =>
    session.getAllTechViews().filter((view) => view.def.era === era);

  const ensureTab = (era: number): HTMLButtonElement => {
    const existing = tabRefs.get(era);
    if (existing !== undefined) return existing;
    const button = createElement('button', { className: 'tech-tab', id: `tech-tab-${era}` });
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('data-era', String(era));
    button.setAttribute('aria-controls', 'tech-graph');
    tabList.insertBefore(button, spliceTab);
    tabRefs.set(era, button);
    return button;
  };

  /** Tabs in era order, then SPLICES, that the player can currently open. */
  const enabledTabs = (): HTMLButtonElement[] =>
    [...tabRefs.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, button]) => button)
      .concat(spliceTab)
      .filter((button) => !button.disabled && !button.hidden);

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

  /** One tab button (the era tabs and SPLICES): label, selection, the affordable chip (WP20) and the screen-reader name with the count. */
  const paintTab = (button: HTMLButtonElement, tab: EraTabView | SpliceTabView): void => {
    patch.text(button, tab.label);
    patch.attr(button, 'aria-selected', tab.selected ? 'true' : 'false');
    patch.attr(button, 'tabindex', tab.selected ? '0' : '-1');
    patch.attr(button, 'data-affordable', String(tab.affordable));
    patch.attr(button, 'aria-label', tab.ariaLabel);
  };

  const renderTabs = (tabs: readonly EraTabView[]): void => {
    for (const tab of tabs) {
      const button = ensureTab(tab.era);
      paintTab(button, tab);
      patch.disabled(button, !tab.reached);
    }
    patch.attr(graph, 'aria-labelledby', `tech-tab-${selectedEra}`);
  };

  const renderSpliceTab = (tab: SpliceTabView | null): void => {
    patch.hidden(spliceTab, tab === null);
    if (tab !== null) paintTab(spliceTab, tab);
  };

  const ensureSpliceRow = (id: TechId): SpliceRowRefs => {
    const existing = spliceRowRefs.get(id);
    if (existing !== undefined) return existing;
    const button = createElement('button', { className: 'tech-splice-row' });
    button.type = 'button';
    button.setAttribute('data-tech', id);
    // Five columns: name, state, cost, effect, progress (the grid in techTree.css).
    const fields = Array.from({ length: 5 }, () => createElement('span'));
    button.append(...fields);
    spliceList.appendChild(button);
    const refs: SpliceRowRefs = { button, fields };
    spliceRowRefs.set(id, refs);
    return refs;
  };

  /** One button per Splice in table order. A bought or reachable row reuses the node colours; DARK rows keep the plain tab frame (readable, not dimmed). */
  const renderSpliceRows = (rows: readonly SpliceRowView[]): void => {
    for (const row of rows) {
      const refs = ensureSpliceRow(row.id);
      const kind = row.state === SPLICE_TAB.spliced ? ' is-purchased' : row.state === SPLICE_TAB.inReach ? ' is-available' : '';
      const isSelected = row.id === selected;
      const values = [row.name, row.state, row.costText, row.effectText, row.progressText];
      refs.fields.forEach((field, i) => patch.text(field, values[i] ?? ''));
      patch.attr(refs.button, 'class', `tech-splice-row${kind}${row.affordable ? ' is-affordable' : ''}${isSelected ? ' is-selected' : ''}`);
      patch.attr(refs.button, 'aria-label', row.ariaLabel);
      patch.attr(refs.button, 'aria-current', isSelected ? 'true' : 'false');
    }
  };

  const renderEdges = (view: TechTreeView): void => {
    const inView = new Set<string>(view.edges.map((e) => e.key));
    for (const edge of view.edges) {
      const path = ensureEdge(edge.key);
      patch.attr(path, 'display', 'inline');
      patch.attr(path, 'class', edge.met ? 'tech-edge is-met' : 'tech-edge');
      patch.attr(path, 'd', edge.d);
    }
    // Edges of the other era stay in the DOM, hidden.
    for (const [key, path] of edgeRefs) {
      if (!inView.has(key)) patch.attr(path, 'display', 'none');
    }
  };

  const renderNodes = (view: TechTreeView): void => {
    const inView = new Set<TechId>(view.nodes.map((n) => n.id));
    for (const node of view.nodes) {
      const refs = ensureNode(node.id);
      patch.hidden(refs.button, false);
      patch.text(refs.name, node.name);
      patch.text(refs.level, node.levelText);
      patch.text(refs.cost, node.costText ?? '');
      patch.attr(refs.button, 'class', nodeClassOf(node));
      patch.attr(refs.button, 'aria-label', node.ariaLabel);
      patch.px(refs.button, 'left', node.x);
      patch.px(refs.button, 'top', node.y);
      patch.px(refs.button, 'width', node.width);
      patch.px(refs.button, 'height', node.height);
    }
    // Nodes of the other era stay in the DOM, hidden.
    for (const [id, refs] of nodeRefs) {
      if (!inView.has(id)) patch.hidden(refs.button, true);
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
    renderBuy(d.buyState, d.buyLabel, d.buyEnabled, d.buyMax);
  };

  const renderBuy = (state: TechDetailView['buyState'], label: string, enabled: boolean, buyMax: boolean): void => {
    patch.text(buyButton, label);
    patch.disabled(buyButton, !enabled);
    patch.attr(buyButton, 'data-buy-state', state);
    patch.hidden(buyMaxButton, !buyMax);
  };

  /** The selected Splice (C9) in the same panel: the world tooltip's title, cost, effect and state lines, then the buy. */
  const renderSpliceDetail = (d: SpliceDetailView | null): void => {
    patch.hidden(detailEl, d === null);
    if (d === null) return;
    patch.text(nameEl, d.title);
    patch.text(kindEl, d.costText);
    patch.text(statusEl, d.stateText);
    patch.text(descEl, d.description);
    patch.hidden(flavorEl, true);
    renderRequirements(d.requirements);
    patch.text(levelEl, d.effectText);
    patch.text(effectCurrentEl, '');
    patch.hidden(effectNextEl, true);
    patch.text(costEl, '');
    patch.text(shortfallEl, '');
    renderBuy(d.buyState, d.buyLabel, d.buyEnabled, false);
  };

  const render = (s: Shown): void => {
    lastView = s.graph;
    const buyState = s.graph?.detail?.buyState ?? s.spliceDetail?.buyState ?? null;
    if (selected !== renderedSelected || buyState !== renderedBuyState) setFeedback('');
    renderedSelected = selected;
    renderedBuyState = buyState;
    renderTabs(s.tabs);
    renderSpliceTab(s.spliceTab);
    patch.text(meEl, s.headerText);
    patch.hidden(graph, s.graph === null);
    patch.hidden(spliceList, s.graph !== null);
    if (s.graph === null) {
      renderSpliceRows(s.rows);
      renderSpliceDetail(s.spliceDetail);
      return;
    }
    const view = s.graph;
    patch.px(inner, 'width', view.width);
    patch.px(inner, 'height', view.height);
    patch.attr(svg, 'width', String(view.width));
    patch.attr(svg, 'height', String(view.height));
    renderEdges(view);
    renderNodes(view);
    renderDetail(view.detail);
  };

  /** Everything the overlay shows: the era graph, or in SPLICES mode the Splice rows and the selected Splice. */
  const buildView = (): Shown => {
    const all = session.getAllTechViews();
    const tabs = buildEraTabs(all, session.state.res, spliceMode ? 0 : selectedEra);
    const spliceTabView = buildSpliceTab(all, spliceMode);
    if (!spliceMode) {
      const view = buildTechTreeView(viewsOfEra(selectedEra), session.state.res, selected, selectedEra);
      return { headerText: view.headerText, tabs, spliceTab: spliceTabView, graph: view, rows: [], spliceDetail: null };
    }
    const chosen = selected === null ? undefined : all.find((view) => view.id === selected);
    return {
      headerText: eraHeaderText(viewsOfEra(selectedEra), session.state.res, selectedEra),
      tabs,
      spliceTab: spliceTabView,
      graph: null,
      rows: buildSpliceRows(all, session.state.lifetime),
      spliceDetail: chosen === undefined ? null : buildSpliceDetail(chosen, session.state),
    };
  };

  function update(): void {
    if (destroyed || !isOpenFlag) return;
    const now = performance.now();
    const levels = session.state.techLevels;
    const due = dirty
      || levels !== builtLevels
      || selected !== builtSelected
      || selectedEra !== builtEra
      || now - builtAt >= REBUILD_INTERVAL_MS;
    if (!due) return;
    const shown = buildView();
    builtLevels = levels;
    builtSelected = selected;
    builtEra = selectedEra;
    builtAt = now;
    const stamp = stampOf(shown);
    if (!dirty && stamp === lastStamp) return;
    render(shown);
    dirty = false;
    lastStamp = stamp;
  }

  /**
   * WP20 fit + reveal: the inline zoom shrinks an era wider than the viewport; the graph scrolls (never scrollIntoView,
   * which would also move the overflow-hidden panel). Reads layout, so it runs on open / era / selection / resize /
   * settings only, never per frame.
   */
  const layoutGraph = (): void => {
    if (!isOpenFlag || lastView === null) return;
    const scale = graphFitScale(graph.clientWidth, lastView.width);
    if (scale !== fitScale) {
      fitScale = scale;
      if (scale === 1) inner.style.removeProperty('zoom');
      else inner.style.setProperty('zoom', String(scale));
    }
    const node = selected === null ? undefined : lastView.nodes.find((n) => n.id === selected);
    if (node === undefined) return;
    const viewport = { width: graph.clientWidth, height: graph.clientHeight };
    const next = revealScroll({ left: graph.scrollLeft, top: graph.scrollTop }, viewport, node, fitScale, TECH_TREE_FIT.revealPadPx);
    if (next.left !== graph.scrollLeft) graph.scrollLeft = next.left;
    if (next.top !== graph.scrollTop) graph.scrollTop = next.top;
  };

  function open(): void {
    if (destroyed || isOpenFlag) return;
    const active = document.activeElement;
    returnFocus = active instanceof HTMLElement ? active : null;
    const all = session.getAllTechViews();
    selectedEra = Math.max(...reachedEras(all));
    spliceMode = false;
    const eraViews = viewsOfEra(selectedEra);
    // WP20: an open keystone overrides a remembered selection; otherwise keep it while it is in this era (a Splice never is).
    const priority = priorityTech(eraViews);
    const selectedView = selected === null ? undefined : all.find((view) => view.id === selected);
    if (priority !== null) {
      selected = priority;
    } else if (selectedView === undefined || isSplice(selectedView.def) || selectedView.def.era !== selectedEra) {
      selected = defaultSelection(eraViews);
    }
    isOpenFlag = true;
    overlay.classList.add('is-open');
    modals.push('tech-tree', close);
    disposeFocusTrap = trapFocus(overlay);
    dirty = true;
    update();
    layoutGraph();
    // WP20: focus the selected node, so Space/Enter buys it. preventScroll: layoutGraph does the reveal.
    const node = selected === null ? undefined : nodeRefs.get(selected);
    (node?.button ?? closeButton).focus({ preventScroll: true });
    emitOpen(true);
  }

  function close(): void {
    if (!isOpenFlag) return;
    isOpenFlag = false;
    releaseFocusTrap();
    overlay.classList.remove('is-open');
    modals.remove('tech-tree');
    setFeedback('');
    const target = returnFocus;
    returnFocus = null;
    restoreFocus(target);
    emitOpen(false);
  }

  // Rendered = in the document and has a layout box (hidden / display:none elements cannot take focus).
  function isRendered(el: HTMLElement): boolean {
    return el.isConnected && el.getClientRects().length > 0;
  }

  // Focus goes back to the element that opened the tree. If that element is gone or no longer rendered (e.g. the
  // photo-mode exit chip, hidden once photo mode ended while the tree was open), fall back to VIEW MACHINE
  // (postgame) or the TECH INDEX button, so focus never drops to <body>.
  function restoreFocus(target: HTMLElement | null): void {
    if (target !== null && isRendered(target)) {
      target.focus();
      return;
    }
    for (const id of ['hud-view-machine', 'hud-tech']) {
      const el = document.getElementById(id);
      if (el !== null && isRendered(el)) {
        el.focus();
        return;
      }
    }
  }

  const onClose = (): void => close();

  const onBackdropClick = (event: Event): void => {
    if (event.target === overlay) close();
  };

  /** Opens an era tab (ignored while the era is still signal-locked). */
  const selectEra = (era: number): void => {
    if (!reachedEras(session.getAllTechViews()).includes(era)) return;
    spliceMode = false;
    selectedEra = era;
    select(defaultSelection(viewsOfEra(era)));
    layoutGraph();
  };

  /** Opens the SPLICES tab (C9): the first affordable Splice, else the first reachable one, is selected. */
  const selectSplices = (): void => {
    if (spliceTab.hidden) return;
    spliceMode = true;
    select(defaultSpliceSelection(session.getAllTechViews()));
    layoutGraph();
  };

  const onTabClick = (event: Event): void => {
    if (!isOpenFlag) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tab = target.closest('.tech-tab');
    if (tab === null) return;
    if (tab === spliceTab) selectSplices();
    else selectEra(Number(tab.getAttribute('data-era')));
  };

  /** Roving focus over the enabled tabs: arrows wrap, Home/End jump. Enter/Space are native clicks. */
  const onTabKeydown = (event: KeyboardEvent): void => {
    if (!isOpenFlag) return;
    const enabled = enabledTabs();
    const count = enabled.length;
    if (count === 0) return;
    const target = event.target instanceof Element ? event.target.closest('.tech-tab') : null;
    const index = Math.max(0, enabled.findIndex((button) => button === target));
    let next: HTMLButtonElement | undefined;
    switch (event.key) {
      case 'ArrowRight': next = enabled[(index + 1) % count]; break;
      case 'ArrowLeft': next = enabled[(index - 1 + count) % count]; break;
      case 'Home': next = enabled[0]; break;
      case 'End': next = enabled[count - 1]; break;
      default: return;
    }
    if (next === undefined) return;
    event.preventDefault();
    next.focus();
  };

  const onGraphClick = (event: Event): void => {
    if (!isOpenFlag) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const node = target.closest('.tech-node');
    if (node === null) return;
    const id = node.getAttribute('data-tech') as TechId;
    // WP28 C9 BUY MAX: Shift+click on a repeatable node selects it and buys its levels in one purchaseMax; Shift on an unlock is ignored.
    if (event instanceof MouseEvent && event.shiftKey && session.getTechView(id).def.kind === 'repeatable') {
      select(id);
      buyMaxOf(id);
      return;
    }
    // WP20: Space/Enter (native click, detail 0) on the already selected node buys it; a mouse click only selects.
    const keyboard = event instanceof MouseEvent && event.detail === 0;
    if (keyboard && id === selected) {
      onBuy();
      return;
    }
    select(id);
    layoutGraph();
  };

  /** A refused buy (WP20, C9): the reason as feedback, the button shakes, and feedback.purchaseDenied carries the reason. */
  const denyBuy = (id: TechId, reason: PurchaseFailure): void => {
    const view = session.getTechView(id);
    const costRes = view.def.costRes;
    const shortfall = Math.max(0, (view.nextCost ?? 0) - session.state.res[costRes]);
    setFeedback(purchaseFailureText(reason, shortfall, costRes));
    flashDenied();
    feedback.purchaseDenied.emit(reason);
  };

  /** A bought buy: render first (the purchase changes buyState, and render clears feedback on that change), then the install or level line. */
  const bought = (id: TechId, newLevel: number): void => {
    dirty = true;
    update();
    setFeedback(purchaseFeedbackText(id, newLevel));
  };

  const onBuy = (): void => {
    if (selected === null) return;
    const id = selected;
    const result = session.purchase(id);
    if (result.ok) bought(id, result.newLevel);
    else denyBuy(id, result.reason);
  };

  /** BUY MAX (C9): one session.purchaseMax per call; when nothing was bought the first failure is denied as a buy. */
  const buyMaxOf = (id: TechId): void => {
    const result = session.purchaseMax(id);
    if (result.ok) bought(id, result.newLevel);
    else denyBuy(id, result.reason);
  };

  const onBuyMaxClick = (): void => {
    if (selected !== null) buyMaxOf(selected);
  };

  /** A click on a Splice row (C9) selects it; buying is the detail's BUY (Enter on the row only selects). */
  const onSpliceClick = (event: Event): void => {
    if (!isOpenFlag || !spliceMode) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest('.tech-splice-row');
    if (row !== null) select(row.getAttribute('data-tech') as TechId);
  };

  /** Shift+Enter on the selected repeatable node is BUY MAX (C9). Its default (the click that buys once) is suppressed; unlocks keep Enter. */
  const onGraphKeydown = (event: KeyboardEvent): void => {
    if (!isOpenFlag || selected === null || event.key !== 'Enter' || !event.shiftKey) return;
    const target = event.target;
    const refs = nodeRefs.get(selected);
    if (!(target instanceof Element) || refs === undefined || refs.button !== target.closest('.tech-node')) return;
    if (session.getTechView(selected).def.kind !== 'repeatable') return;
    event.preventDefault();
    buyMaxOf(selected);
  };

  const unsubscribes: Array<() => void> = [
    session.on('purchase', () => { dirty = true; }),
    session.on('unlock', () => { dirty = true; }),
    // Notation changes re-format costs and requirement labels: rebuild on the next update.
    session.on('settings', () => { dirty = true; }),
    // WP20: a notation / UI-zoom change moves the fit and the reveal.
    session.on('settings', () => { if (isOpenFlag) layoutGraph(); }),
    // The xf reveal flag flips on ending / reset: labels re-render on the next update.
    session.on('ending', () => { dirty = true; }),
    // WP14: Memory perks change tech costs and effects (Ledger, Residual Charge); a new cycle restarts the levels.
    session.on('prestige', () => { dirty = true; }),
    session.on('cycle', () => { dirty = true; }),
    session.on('reset', () => {
      spliceMode = false;
      selectedEra = 1;
      selected = isOpenFlag ? defaultSelection(viewsOfEra(1)) : null;
      setFeedback('');
      dirty = true;
    }),
    commands.openTechTree.on(() => { open(); }),
  ];

  closeButton.addEventListener('click', onClose);
  overlay.addEventListener('click', onBackdropClick);
  tabList.addEventListener('click', onTabClick);
  tabList.addEventListener('keydown', onTabKeydown);
  graph.addEventListener('click', onGraphClick);
  graph.addEventListener('keydown', onGraphKeydown);
  spliceList.addEventListener('click', onSpliceClick);
  buyButton.addEventListener('click', onBuy);
  buyMaxButton.addEventListener('click', onBuyMaxClick);
  // WP20: the fit zoom and the reveal depend on the viewport size.
  const onResize = (): void => { if (isOpenFlag) layoutGraph(); };
  window.addEventListener('resize', onResize);

  function onOpenChange(fn: (open: boolean) => void): () => void {
    openListeners.add(fn);
    return () => { openListeners.delete(fn); };
  }

  function isOpen(): boolean {
    return isOpenFlag;
  }

  function destroy(): void {
    openListeners.clear(); // first: teardown must not notify listeners
    if (destroyed) return;
    close();
    releaseFocusTrap();
    destroyed = true;
    for (const unsubscribe of unsubscribes) unsubscribe();
    closeButton.removeEventListener('click', onClose);
    overlay.removeEventListener('click', onBackdropClick);
    tabList.removeEventListener('click', onTabClick);
    tabList.removeEventListener('keydown', onTabKeydown);
    graph.removeEventListener('click', onGraphClick);
    graph.removeEventListener('keydown', onGraphKeydown);
    spliceList.removeEventListener('click', onSpliceClick);
    buyButton.removeEventListener('click', onBuy);
    buyMaxButton.removeEventListener('click', onBuyMaxClick);
    window.removeEventListener('resize', onResize);
    if (deniedTimer !== null) {
      window.clearTimeout(deniedTimer);
      deniedTimer = null;
    }
    overlay.remove();
    tabRefs.clear();
    nodeRefs.clear();
    spliceRowRefs.clear();
    edgeRefs.clear();
    reqItems.length = 0;
  }

  return { open, close, isOpen, update, destroy, onOpenChange };
}
