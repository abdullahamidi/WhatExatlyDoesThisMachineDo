import './statsPanel.css';
import type { StatsState } from '../../data/types';
import { statsRows } from './statsView';
import type { StatsRow } from './statsView';

// STATS tab (DOM, WP12 T7). A <dl> of rows. refresh() reuses the row nodes by label and rewrites only
// the cells whose text changed; rows are moved or added/removed only when the row list itself changes.

export interface StatsPanelDeps {
  getStats(): Readonly<StatsState>;
  subscribe(fn: () => void): () => void;
}

export interface StatsPanelHandle {
  refresh(): void;
  destroy(): void;
}

interface RowNodes {
  wrap: HTMLDivElement;
  value: HTMLElement;
}

interface ElementOptions {
  id?: string;
  className?: string;
  text?: string;
}

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

export function createStatsPanel(host: HTMLElement, deps: StatsPanelDeps): StatsPanelHandle {
  const list = createElement('dl', { id: 'sys-stats', className: 'stats-panel' });
  const rows = new Map<string, RowNodes>();
  let destroyed = false;

  function rowNodes(label: string): RowNodes {
    const existing = rows.get(label);
    if (existing !== undefined) return existing;
    const wrap = createElement('div', { className: 'stats-row' });
    wrap.append(createElement('dt', { className: 'stats-label', text: label }));
    const value = createElement('dd', { className: 'stats-value' });
    wrap.appendChild(value);
    const created: RowNodes = { wrap, value };
    rows.set(label, created);
    return created;
  }

  function sync(view: StatsRow[]): void {
    const keep = new Set(view.map((row) => row.label));
    for (const [label, nodes] of rows) {
      if (keep.has(label)) continue;
      nodes.wrap.remove();
      rows.delete(label);
    }
    let prev: ChildNode | null = null;
    for (const row of view) {
      const nodes = rowNodes(row.label);
      if (nodes.value.textContent !== row.value) nodes.value.textContent = row.value;
      const expected: ChildNode | null = prev === null ? list.firstChild : prev.nextSibling;
      if (nodes.wrap !== expected) list.insertBefore(nodes.wrap, expected);
      prev = nodes.wrap;
    }
  }

  function refresh(): void {
    if (destroyed) return;
    sync(statsRows(deps.getStats()));
  }

  refresh();
  host.appendChild(list);
  const unsubscribe = deps.subscribe(refresh);

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    unsubscribe();
    rows.clear();
    list.remove();
  }

  return { refresh, destroy };
}
