import { formatCost, formatNumber } from '../utils/format';
import type { PurchaseFailure, TechId, TechStatus, TechView } from '../data/types';

// Pure view model for the TECH INDEX overlay. No DOM, no Phaser.

export const TECH_TREE_LAYOUT = { nodeWidth: 176, nodeHeight: 68, colGap: 48, rowGap: 28, padding: 20 } as const;

export type TechKindLabel = 'ORIGIN' | 'UNLOCK' | 'REPEATABLE' | 'MILESTONE';
export type BuyState = 'buy' | 'insufficient' | 'locked' | 'maxed' | 'owned' | 'automatic';

export interface TechNodeView {
  id: TechId; name: string; status: TechStatus; kindLabel: TechKindLabel; milestone: boolean;
  levelText: string; costText: string | null; affordable: boolean; selected: boolean; x: number; y: number; width: number; height: number;
}
export interface TechEdgeView { key: string; from: TechId; to: TechId; met: boolean; d: string }
export interface TechDetailView {
  id: TechId; name: string; kindLabel: TechKindLabel;
  statusLabel: 'LOCKED' | 'AVAILABLE' | 'PURCHASED' | 'MAXED' | 'ACHIEVED';
  description: string; flavor: string | null; requirements: Array<{ label: string; met: boolean }>; levelText: string;
  currentEffect: string; nextEffect: string | null; costText: string | null;
  buyState: BuyState; buyLabel: string; buyEnabled: boolean; shortfallText: string | null;
}
export interface TechTreeView { width: number; height: number; meText: string; nodes: TechNodeView[]; edges: TechEdgeView[]; detail: TechDetailView | null }

/** Top-left corner of a node: padding + index * (node size + gap). */
export function techNodePosition(
  tree: { col: number; row: number },
  layout: typeof TECH_TREE_LAYOUT = TECH_TREE_LAYOUT,
): { x: number; y: number } {
  return {
    x: layout.padding + tree.col * (layout.nodeWidth + layout.colGap),
    y: layout.padding + tree.row * (layout.nodeHeight + layout.rowGap),
  };
}

/** Cubic bezier from the right-middle of `from` to the left-middle of `to`. */
export function edgePath(from: TechNodeView, to: TechNodeView): string {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

/** Affordable node first; else first available non-starting node; else the crank. */
export function defaultSelection(views: readonly TechView[]): TechId {
  const affordable = views.find((view) => view.affordable);
  if (affordable) return affordable.id;
  const available = views.find((view) => view.status === 'available' && view.def.kind !== 'starting');
  if (available) return available.id;
  return 'handCrank';
}

/** Missing ME as whole units, rounded up: ceil(max(0, x) - eps). */
function formatShortfall(x: number): string {
  return formatNumber(Math.ceil(Math.max(0, x) - 1e-9));
}

/** Label text for the purchase failure reason shown as feedback. */
export function purchaseFailureText(reason: PurchaseFailure, shortfall: number): string {
  switch (reason) {
    case 'insufficient': return `NEED ${formatShortfall(shortfall)} MORE ME`;
    case 'locked': return 'REQUIREMENTS UNMET';
    case 'maxed': return 'MAXIMUM LEVEL';
    case 'owned': return 'ALREADY INSTALLED';
    case 'notPurchasable': return 'CANNOT BE PURCHASED';
  }
}

/** Kind label: starting/unlock/repeatable/milestone mapped to display words. */
function kindLabelOf(view: TechView): TechKindLabel {
  switch (view.def.kind) {
    case 'starting': return 'ORIGIN';
    case 'unlock': return 'UNLOCK';
    case 'repeatable': return 'REPEATABLE';
    case 'milestone': return 'MILESTONE';
  }
}

/** Repeatable at its cap (maxLevel reached). */
function isAtMaxLevel(view: TechView): boolean {
  return view.def.kind === 'repeatable' && view.def.maxLevel !== null && view.level >= view.def.maxLevel;
}

/** Level text: LV n/max for repeatables, installed/achieved/pending for the rest. */
function levelTextOf(view: TechView): string {
  const def = view.def;
  switch (def.kind) {
    case 'repeatable': return `LV ${view.level}/${def.maxLevel ?? '∞'}`;
    case 'starting':
    case 'unlock': return view.level >= 1 ? 'INSTALLED' : 'NOT INSTALLED';
    case 'milestone': return view.level >= 1 ? 'ACHIEVED' : 'PENDING';
  }
}

/** Next price with unit suffix, or null when nothing is left to buy. */
function costTextOf(view: TechView): string | null {
  return view.nextCost === null ? null : `${formatCost(view.nextCost)} ME`;
}

/** Detail status word for the selected tech. */
function statusLabelOf(view: TechView): TechDetailView['statusLabel'] {
  if (view.status === 'locked') return 'LOCKED';
  if (view.status === 'available') return 'AVAILABLE';
  if (view.def.kind === 'milestone') return 'ACHIEVED';
  if (isAtMaxLevel(view)) return 'MAXED';
  return 'PURCHASED';
}

/** Purchase button state, evaluated in priority order. */
function buyStateOf(view: TechView): BuyState {
  const def = view.def;
  if (def.kind === 'milestone') return view.level === 0 ? 'automatic' : 'owned';
  if ((def.kind === 'unlock' || def.kind === 'starting') && view.level >= 1) return 'owned';
  if (isAtMaxLevel(view)) return 'maxed';
  if (view.status === 'locked') return 'locked';
  if (view.affordable) return 'buy';
  return 'insufficient';
}

/** Button label for each buy state. */
function buyLabelOf(state: BuyState, view: TechView, costText: string | null): string {
  switch (state) {
    case 'buy': return `PURCHASE — ${costText ?? ''}`;
    case 'insufficient': return 'INSUFFICIENT ME';
    case 'locked': return 'REQUIREMENTS UNMET';
    case 'maxed': return 'MAXIMUM LEVEL';
    case 'owned': return view.def.kind === 'milestone' ? 'ACHIEVED' : 'INSTALLED';
    case 'automatic': return 'MILESTONE — AUTOMATIC';
  }
}

/** Builds the detail panel for one selected tech. */
function detailOf(view: TechView, me: number): TechDetailView {
  const costText = costTextOf(view);
  const buyState = buyStateOf(view);
  const buyEnabled = buyState === 'buy' || buyState === 'insufficient';
  // shortfall = max(0, nextCost - me) when the buy is blocked by money
  const shortfallText = buyState === 'insufficient' && view.nextCost !== null
    ? `NEED ${formatShortfall(view.nextCost - me)} MORE ME`
    : null;
  return {
    id: view.id,
    name: view.def.name,
    kindLabel: kindLabelOf(view),
    statusLabel: statusLabelOf(view),
    description: view.def.description,
    flavor: view.def.flavor ?? null,
    requirements: view.requirements.map((r) => ({ label: r.label, met: r.met })),
    levelText: levelTextOf(view),
    currentEffect: view.currentEffectText,
    nextEffect: view.nextEffectText,
    costText,
    buyState,
    buyLabel: buyLabelOf(buyState, view, costText),
    buyEnabled,
    shortfallText,
  };
}

/** Full overlay view: nodes, tech-requirement edges and the detail of the selection. */
export function buildTechTreeView(
  views: readonly TechView[],
  me: number,
  selected: TechId | null,
  layout: typeof TECH_TREE_LAYOUT = TECH_TREE_LAYOUT,
): TechTreeView {
  // maxCol/maxRow over the tree hints; width = 2*pad + (maxCol+1)*w + maxCol*gap (same for rows)
  let maxCol = 0;
  let maxRow = 0;
  for (const view of views) {
    maxCol = Math.max(maxCol, view.def.tree.col);
    maxRow = Math.max(maxRow, view.def.tree.row);
  }
  const width = layout.padding * 2 + (maxCol + 1) * layout.nodeWidth + maxCol * layout.colGap;
  const height = layout.padding * 2 + (maxRow + 1) * layout.nodeHeight + maxRow * layout.rowGap;

  const nodes: TechNodeView[] = views.map((view) => {
    const pos = techNodePosition(view.def.tree, layout);
    return {
      id: view.id,
      name: view.def.name,
      status: view.status,
      kindLabel: kindLabelOf(view),
      milestone: view.def.kind === 'milestone',
      levelText: levelTextOf(view),
      costText: costTextOf(view),
      affordable: view.affordable,
      selected: view.id === selected,
      x: pos.x,
      y: pos.y,
      width: layout.nodeWidth,
      height: layout.nodeHeight,
    };
  });

  // edges: one per tech requirement, drawn from the required node into the dependent node
  const byId = new Map<TechId, TechNodeView>(nodes.map((node) => [node.id, node]));
  const edges: TechEdgeView[] = [];
  for (const view of views) {
    const toNode = byId.get(view.id);
    if (!toNode) continue;
    for (const requirement of view.requirements) {
      if (requirement.req.type !== 'tech') continue;
      const fromNode = byId.get(requirement.req.id);
      if (!fromNode) continue;
      edges.push({
        key: `${requirement.req.id}->${view.id}`,
        from: requirement.req.id,
        to: view.id,
        met: requirement.met,
        d: edgePath(fromNode, toNode),
      });
    }
  }

  const selectedView = selected === null ? undefined : views.find((view) => view.id === selected);
  return {
    width,
    height,
    meText: formatNumber(me),
    nodes,
    edges,
    detail: selectedView ? detailOf(selectedView, me) : null,
  };
}
