import { formatCost, formatNumber } from '../utils/format';
import { DEMO_TEXT } from '../data/demo';
import { ERA_KEYSTONES } from '../data/eras';
import { INSTALL_LINES } from '../data/notifications';
import { RESOURCES } from '../data/resources';
import { RESOURCE_IDS } from '../data/types';
import type { PurchaseFailure, ResourceId, ResourceMap, TechId, TechStatus, TechView } from '../data/types';
import { tierLevelSuffix } from '../game/math/partTiers';
import { resourceShort } from './revealRules';

// Pure view model for the TECH INDEX overlay. No DOM, no Phaser.

export const TECH_TREE_LAYOUT = { nodeWidth: 144, nodeHeight: 68, colGap: 14, rowGap: 28, padding: 18 } as const;
// WP20 fit: the widest era (1128 px) scales down to minScale to fit maxWidthPx; reveal keeps a node revealPadPx inside the window.
export const TECH_TREE_FIT = { maxWidthPx: 1140, minScale: 0.6, revealPadPx: 12 } as const;

export type TechKindLabel = 'ORIGIN' | 'UNLOCK' | 'REPEATABLE' | 'MILESTONE';
// 'demo': the tech sits above the demo era cap, so it can never be bought in this edition.
export type BuyState = 'buy' | 'insufficient' | 'locked' | 'maxed' | 'owned' | 'automatic' | 'demo';

export interface TechNodeView {
  id: TechId; name: string; status: TechStatus; kindLabel: TechKindLabel; milestone: boolean;
  levelText: string; costText: string | null; ariaLabel: string; affordable: boolean; selected: boolean; x: number; y: number; width: number; height: number;
}
export interface TechEdgeView { key: string; from: TechId; to: TechId; met: boolean; d: string }
export interface TechDetailView {
  id: TechId; name: string; kindLabel: TechKindLabel;
  statusLabel: 'LOCKED' | 'AVAILABLE' | 'PURCHASED' | 'MAXED' | 'ACHIEVED';
  description: string; flavor: string | null; requirements: Array<{ label: string; met: boolean }>; levelText: string;
  currentEffect: string; nextEffect: string | null; costText: string | null;
  buyState: BuyState; buyLabel: string; buyEnabled: boolean; shortfallText: string | null;
}
export interface TechTreeView { width: number; height: number; headerText: string; nodes: TechNodeView[]; edges: TechEdgeView[]; detail: TechDetailView | null }
// affordable: buyable techs in the era (0 when unreached). ariaLabel appends the count when > 0.
// fullGame: the era lies above the demo cap (shown as FULL GAME, never reached).
export interface EraTabView { era: number; label: string; reached: boolean; fullGame: boolean; selected: boolean; resourceText: string; affordable: number; ariaLabel: string }

const ROMAN_ERAS = ['I', 'II', 'III', 'IV', 'V'] as const;

/** Resource that marks an era: the one whose era matches, else ME. */
function eraResourceOf(era: number): ResourceId {
  return RESOURCE_IDS.find((id) => RESOURCES[id].era === era) ?? 'me';
}

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

/** Right-middle of `from` and left-middle of `to`: the two ends of a tech edge. */
function edgeEnds(from: TechNodeView, to: TechNodeView): { x1: number; y1: number; x2: number; y2: number } {
  return { x1: from.x + from.width, y1: from.y + from.height / 2, x2: to.x, y2: to.y + to.height / 2 };
}

/** Cubic bezier from the right-middle of `from` to the left-middle of `to`. */
export function edgePath(from: TechNodeView, to: TechNodeView): string {
  const { x1, y1, x2, y2 } = edgeEnds(from, to);
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

/** Straight-edge test of edgePathAround (WP26 T9): a curve closer than clearPx to a third node is routed around it. */
const TECH_TREE_EDGE = { clearPx: 4, samples: 64 } as const;

/** True when the straight edgePath curve comes within TECH_TREE_EDGE.clearPx of a node that is not one of its ends. */
function straightEdgeClips(from: TechNodeView, to: TechNodeView, nodes: readonly TechNodeView[]): boolean {
  const { x1, y1, x2, y2 } = edgeEnds(from, to);
  const mx = (x1 + x2) / 2;
  const others = nodes.filter((n) => n.id !== from.id && n.id !== to.id);
  for (let i = 0; i <= TECH_TREE_EDGE.samples; i++) {
    const t = i / TECH_TREE_EDGE.samples;
    const s = 1 - t;
    const w0 = s * s * s;
    const w1 = 3 * s * s * t;
    const w2 = 3 * s * t * t;
    const w3 = t * t * t;
    const px = w0 * x1 + w1 * mx + w2 * mx + w3 * x2;
    const py = w0 * y1 + w1 * y1 + w2 * y2 + w3 * y2;
    for (const n of others) {
      const dx = Math.max(n.x - px, 0, px - (n.x + n.width));
      const dy = Math.max(n.y - py, 0, py - (n.y + n.height));
      if (Math.hypot(dx, dy) < TECH_TREE_EDGE.clearPx) return true;
    }
  }
  return false;
}

/**
 * Edge path that keeps clear of the nodes its straight curve would cross (WP25 AD1 F2, WP26 T9): edgePath, unless the
 * curve comes within TECH_TREE_EDGE.clearPx of a node that is not one of its ends. Same row: the line runs along the
 * row gap above (the top row uses the gap below). Cross row: it runs along the outer channel in the padding above the
 * top row (target above) or below the bottom row (target below). Why: the row gaps carry the diagonal edges, so a
 * detour there reads as a junction, while no straight edge reaches the padding. Edges the slots already clear stay straight.
 */
export function edgePathAround(
  from: TechNodeView,
  to: TechNodeView,
  nodes: readonly TechNodeView[],
  layout: typeof TECH_TREE_LAYOUT = TECH_TREE_LAYOUT,
): string {
  if (!straightEdgeClips(from, to, nodes)) return edgePath(from, to);
  const { x1, y1, x2, y2 } = edgeEnds(from, to);
  const g = layout.colGap / 2;
  if (from.y === to.y) {
    const gapY = from.y > layout.padding ? from.y - layout.rowGap / 2 : from.y + from.height + layout.rowGap / 2;
    return `M ${x1} ${y1} C ${x1 + g} ${y1}, ${x1 + g} ${gapY}, ${x1 + 2 * g} ${gapY} L ${x2 - 2 * g} ${gapY} C ${x2 - g} ${gapY}, ${x2 - g} ${y2}, ${x2} ${y2}`;
  }
  const yc = to.y < from.y
    ? Math.min(...nodes.map((n) => n.y)) - layout.padding / 2
    : Math.max(...nodes.map((n) => n.y + n.height)) + layout.padding / 2;
  // d1, d2: each leg bends into the channel over a g-long corner, which keeps the vertical run in the middle of the column gap.
  const d1 = Math.sign(yc - y1);
  const d2 = Math.sign(yc - y2);
  return `M ${x1} ${y1} C ${x1 + g} ${y1}, ${x1 + g} ${y1}, ${x1 + g} ${y1 + d1 * g} L ${x1 + g} ${yc - d1 * g} C ${x1 + g} ${yc}, ${x1 + g} ${yc}, ${x1 + 2 * g} ${yc} L ${x2 - 2 * g} ${yc} C ${x2 - g} ${yc}, ${x2 - g} ${yc}, ${x2 - g} ${yc - d2 * g} L ${x2 - g} ${y2 + d2 * g} C ${x2 - g} ${y2}, ${x2 - g} ${y2}, ${x2} ${y2}`;
}

/** WP20: primaryFunction when open, else the first open era keystone (table order). Open = available and not installed. Null when none. */
export function priorityTech(views: readonly TechView[]): TechId | null {
  const open = (id: TechId): boolean =>
    views.some((view) => view.id === id && view.status === 'available' && view.level === 0);
  if (open('primaryFunction')) return 'primaryFunction';
  return ERA_KEYSTONES.find((keystone) => open(keystone.techId))?.techId ?? null;
}

/**
 * Default selection (WP20): open keystone; else first affordable unlock; else first affordable tech;
 * else first available non-starting tech; else the crank (or the first view).
 */
export function defaultSelection(views: readonly TechView[]): TechId {
  const priority = priorityTech(views);
  if (priority) return priority;
  const affordableUnlock = views.find((view) => view.affordable && view.def.kind === 'unlock');
  if (affordableUnlock) return affordableUnlock.id;
  const affordable = views.find((view) => view.affordable);
  if (affordable) return affordable.id;
  const available = views.find((view) => view.status === 'available' && view.def.kind !== 'starting');
  if (available) return available.id;
  if (views.some((view) => view.id === 'handCrank')) return 'handCrank';
  return views[0]?.id ?? 'handCrank';
}

/**
 * Era header (WP20): `N RES · M RES` over the distinct costRes of the era's unlocks and repeatables,
 * in RESOURCE_IDS order. No such view: the era's own resource alone.
 */
export function eraHeaderText(views: readonly TechView[], res: Readonly<ResourceMap>, era: number): string {
  const priced = new Set(views.filter((view) => view.def.kind === 'unlock' || view.def.kind === 'repeatable').map((view) => view.def.costRes));
  const shown = RESOURCE_IDS.filter((id) => priced.has(id));
  const ids = shown.length > 0 ? shown : [eraResourceOf(era)];
  return ids.map((id) => `${formatNumber(res[id])} ${resourceShort(id)}`).join(' · ');
}

/** Eras whose tab is open: era 1 always; era n > 1 once any of its techs is not locked. Ascending. */
export function reachedEras(views: readonly TechView[]): number[] {
  const eras = new Set<number>([1]);
  for (const view of views) {
    if (view.status !== 'locked') eras.add(view.def.era);
  }
  return [...eras].sort((a, b) => a - b);
}

/** One tab per era present in `views` (ascending). Unreached eras show a placeholder; demo-capped eras show FULL GAME. */
export function buildEraTabs(
  views: readonly TechView[],
  res: Readonly<ResourceMap>,
  selectedEra: number,
): EraTabView[] {
  const reached = new Set(reachedEras(views));
  // Checked before the placeholder: a capped era is never reached, but it is not an unknown signal either.
  const fullGameEras = new Set(views.filter((view) => view.demoLocked).map((view) => view.def.era));
  const eras = [...new Set(views.map((view) => view.def.era))].sort((a, b) => a - b);
  return eras.map((era): EraTabView => {
    if (fullGameEras.has(era)) {
      const roman = ROMAN_ERAS[era - 1] ?? String(era);
      return {
        era,
        label: DEMO_TEXT.fullGameTab,
        reached: false,
        fullGame: true,
        selected: era === selectedEra,
        resourceText: '',
        affordable: 0,
        ariaLabel: `ERA ${roman} · ${DEMO_TEXT.fullGameTab}`,
      };
    }
    const isReached = reached.has(era);
    if (!isReached) {
      return { era, label: 'SIGNAL ?', reached: false, fullGame: false, selected: era === selectedEra, resourceText: '', affordable: 0, ariaLabel: 'SIGNAL ?' };
    }
    const eraRes = eraResourceOf(era);
    const short = resourceShort(eraRes);
    const roman = ROMAN_ERAS[era - 1] ?? String(era);
    const label = `ERA ${roman} · ${short}`;
    const affordable = views.filter((view) => view.def.era === era && view.affordable).length;
    return {
      era,
      label,
      reached: true,
      fullGame: false,
      selected: era === selectedEra,
      resourceText: `${formatNumber(res[eraRes])} ${short}`,
      affordable,
      ariaLabel: affordable > 0 ? `${label}, ${affordable} affordable` : label,
    };
  });
}

/** Missing amount as whole units, rounded up: ceil(max(0, x) - eps). */
function formatShortfall(x: number): string {
  return formatNumber(Math.ceil(Math.max(0, x) - 1e-9));
}

/** Label text for the purchase failure reason shown as feedback. */
export function purchaseFailureText(reason: PurchaseFailure, shortfall: number, res: ResourceId = 'me'): string {
  switch (reason) {
    case 'insufficient': return `NEED ${formatShortfall(shortfall)} MORE ${resourceShort(res)}`;
    case 'locked': return 'REQUIREMENTS UNMET';
    case 'maxed': return 'MAXIMUM LEVEL';
    case 'owned': return 'ALREADY INSTALLED';
    case 'notPurchasable': return 'CANNOT BE PURCHASED';
    case 'demo': return DEMO_TEXT.fullGameOnly;
  }
}

/** WP20 feedback line after a purchase: the install line on the first level, else the new level. */
export function purchaseFeedbackText(id: TechId, newLevel: number): string {
  return newLevel > 1 ? `LEVEL ${newLevel}` : `INSTALLED — ${INSTALL_LINES[id]}`;
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
  return view.nextCost === null ? null : `${formatCost(view.nextCost)} ${resourceShort(view.def.costRes)}`;
}

/** Status word of a node for its accessible name (WP12 D8). */
function nodeStatusWord(view: TechView): 'locked' | 'available' | 'purchased' | 'maxed' {
  if (view.status === 'locked') return 'locked';
  if (view.status === 'available') return 'available';
  return isAtMaxLevel(view) ? 'maxed' : 'purchased';
}

/**
 * Accessible name of a tech node (WP12 D8): "<name>, <status word>, level <n>, cost <price> <resource>".
 * No cost for purchased unlocks / milestones and for a maxed repeatable.
 */
export function nodeAriaLabel(view: TechView): string {
  const word = nodeStatusWord(view);
  const parts = [view.def.name, word, `level ${view.level}`];
  const hasCost = view.nextCost !== null
    && word !== 'maxed'
    && !(word === 'purchased' && view.def.kind !== 'repeatable');
  if (hasCost && view.nextCost !== null) {
    parts.push(`cost ${formatCost(view.nextCost)} ${resourceShort(view.def.costRes)}`);
  }
  return parts.join(', ');
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
  if (view.demoLocked) return 'demo';
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
    case 'insufficient': return `INSUFFICIENT ${resourceShort(view.def.costRes)}`;
    case 'locked': return 'REQUIREMENTS UNMET';
    case 'maxed': return 'MAXIMUM LEVEL';
    case 'owned': return view.def.kind === 'milestone' ? 'ACHIEVED' : 'INSTALLED';
    case 'automatic': return 'MILESTONE — AUTOMATIC';
    case 'demo': return DEMO_TEXT.fullGameOnly;
  }
}

/** Builds the detail panel for one selected tech. The level line adds the part tier (WP22 A6); node cards keep LV n/max. */
function detailOf(view: TechView, res: Readonly<ResourceMap>): TechDetailView {
  const costText = costTextOf(view);
  const buyState = buyStateOf(view);
  const buyEnabled = buyState === 'buy' || buyState === 'insufficient';
  const costRes = view.def.costRes;
  // shortfall = max(0, nextCost - res[costRes]) when the buy is blocked by money
  const shortfallText = buyState === 'insufficient' && view.nextCost !== null
    ? `NEED ${formatShortfall(view.nextCost - res[costRes])} MORE ${resourceShort(costRes)}`
    : null;
  return {
    id: view.id,
    name: view.def.name,
    kindLabel: kindLabelOf(view),
    statusLabel: statusLabelOf(view),
    description: view.def.description,
    flavor: view.def.flavor ?? null,
    requirements: view.requirements.map((r) => ({ label: r.label, met: r.met })),
    levelText: levelTextOf(view) + (tierLevelSuffix(view.id, view.level) ?? ''),
    currentEffect: view.currentEffectText,
    nextEffect: view.nextEffectText,
    costText,
    buyState,
    buyLabel: buyLabelOf(buyState, view, costText),
    buyEnabled,
    shortfallText,
  };
}

/** Full overlay view for one era: nodes, tech-requirement edges and the detail of the selection. */
export function buildTechTreeView(
  views: readonly TechView[],
  res: Readonly<ResourceMap>,
  selected: TechId | null,
  era: number,
  layout: typeof TECH_TREE_LAYOUT = TECH_TREE_LAYOUT,
): TechTreeView {
  // min/max col and row over the tree hints; nodes are shifted so the era's first column/row sits at 0.
  // width = 2*pad + (span+1)*w + span*gap, span = maxCol - minCol (same for rows)
  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = 0;
  let maxRow = 0;
  for (const view of views) {
    minCol = Math.min(minCol, view.def.tree.col);
    minRow = Math.min(minRow, view.def.tree.row);
    maxCol = Math.max(maxCol, view.def.tree.col);
    maxRow = Math.max(maxRow, view.def.tree.row);
  }
  if (!Number.isFinite(minCol)) minCol = 0;
  if (!Number.isFinite(minRow)) minRow = 0;
  const spanCol = maxCol - minCol;
  const spanRow = maxRow - minRow;
  const width = layout.padding * 2 + (spanCol + 1) * layout.nodeWidth + spanCol * layout.colGap;
  const height = layout.padding * 2 + (spanRow + 1) * layout.nodeHeight + spanRow * layout.rowGap;

  const nodes: TechNodeView[] = views.map((view) => {
    const pos = techNodePosition(
      { col: view.def.tree.col - minCol, row: view.def.tree.row - minRow },
      layout,
    );
    return {
      id: view.id,
      name: view.def.name,
      status: view.status,
      kindLabel: kindLabelOf(view),
      milestone: view.def.kind === 'milestone',
      levelText: levelTextOf(view),
      costText: costTextOf(view),
      ariaLabel: nodeAriaLabel(view),
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
        d: edgePathAround(fromNode, toNode, nodes, layout),
      });
    }
  }

  const selectedView = selected === null ? undefined : views.find((view) => view.id === selected);
  return {
    width,
    height,
    headerText: eraHeaderText(views, res, era),
    nodes,
    edges,
    detail: selectedView ? detailOf(selectedView, res) : null,
  };
}

/** WP20 fit: 1 when the content already fits, else the fit ratio floored to 3 decimals and clamped at minScale. */
export function graphFitScale(viewportPx: number, contentPx: number, minScale: number = TECH_TREE_FIT.minScale): number {
  if (contentPx <= viewportPx || viewportPx <= 0) return 1;
  return Math.max(minScale, Math.floor(viewportPx / contentPx * 1000) / 1000);
}

/** One axis of revealScroll: scroll the least that keeps [start - pad, end + pad] inside [s, s + v]. */
function revealAxis(s: number, v: number, start: number, size: number, pad: number): number {
  const end = start + size;
  if (start - pad < s) return Math.max(0, start - pad);
  if (end + pad > s + v) return end + pad - v;
  return s;
}

/** WP20 reveal: scroll that brings `box` (graph units, drawn at `scale`) into the viewport with `padPx` margin. */
export function revealScroll(
  scroll: { left: number; top: number },
  viewport: { width: number; height: number },
  box: { x: number; y: number; width: number; height: number },
  scale: number,
  padPx: number = TECH_TREE_FIT.revealPadPx,
): { left: number; top: number } {
  return {
    left: revealAxis(scroll.left, viewport.width, box.x * scale, box.width * scale, padPx),
    top: revealAxis(scroll.top, viewport.height, box.y * scale, box.height * scale, padPx),
  };
}
