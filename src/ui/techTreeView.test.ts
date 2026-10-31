import { describe, it, expect, afterEach } from 'vitest';
import {
  TECH_TREE_FIT,
  TECH_TREE_LAYOUT,
  buildEraTabs,
  buildSpliceDetail,
  buildSpliceRows,
  buildSpliceTab,
  buildTechTreeView,
  buyMaxAllowed,
  defaultSelection,
  defaultSpliceSelection,
  edgePath,
  edgePathAround,
  eraHeaderText,
  graphFitScale,
  nodeAriaLabel,
  priorityTech,
  purchaseFailureText,
  purchaseFeedbackText,
  reachedEras,
  revealScroll,
  techNodePosition,
} from './techTreeView';
import type { SpliceRowView, TechNodeView } from './techTreeView';
import { getAllTechViews, getTechView, createInitialState, emptyResourceMap } from '../simulation';
import { isSplice } from '../simulation/progression/status';
import { spliceState, spliceTooltip } from '../game/math/spliceWorld';
import { TECHNOLOGIES } from '../data/technologies';
import { DEMO_TEXT } from '../data/demo';
import type { GameState, ResourceMap, TechDefinition, TechId, TechView } from '../data/types';
import { TECH_IDS } from '../data/types';
import { setDefaultNotation } from '../utils/format';
import { setRevealed } from './revealRules';

// Edges whose straight line ran behind a node: same-row ones (WP25 AD1 F2), cross-row ones (WP26 T9).
const DETOURED = ['condenser->pressureVesselBlueprint', 'motorRetrofit->powerLines', 'nullChamber->mainsBackfeed', 'nullChamber->steamLance'];

function stateWith(overrides: Partial<GameState>): GameState {
  return { ...createInitialState(0), ...overrides };
}

/** A resource map holding only `me`. */
function resWithMe(me: number): ResourceMap {
  return { ...emptyResourceMap(), me };
}

function viewsOf(state: GameState): TechView[] {
  return getAllTechViews(state);
}

/** Era-I views only (real data; era II content may or may not be present). */
function eraOneViewsOf(state: GameState): TechView[] {
  return viewsOf(state).filter((v) => v.def.era === 1);
}

// Injected era-II content: wornMotor and motorTuning moved to era 2 (EE-priced, own tree columns).
const ERA_TWO_AVAILABLE: Record<TechId, TechDefinition> = {
  ...TECHNOLOGIES,
  wornMotor: { ...TECHNOLOGIES.wornMotor, era: 2, costRes: 'ee', tree: { col: 3, row: 0 } },
  motorTuning: { ...TECHNOLOGIES.motorTuning, era: 2, tree: { col: 4, row: 0 } },
};

// Same as above, but wornMotor is gated behind a lifetime EE requirement nobody reaches.
const ERA_TWO_LOCKED: Record<TechId, TechDefinition> = {
  ...ERA_TWO_AVAILABLE,
  wornMotor: {
    ...ERA_TWO_AVAILABLE.wornMotor,
    requires: [{ type: 'lifetime', res: 'ee', amount: 1e12 }],
  },
};

describe('techTreeView', () => {
  describe('initial state', () => {
    const views = eraOneViewsOf(createInitialState(0));
    const view = buildTechTreeView(views, emptyResourceMap(), null, 1);

    it('builds one node per tech at its tree position', () => {
      expect(view.nodes).toHaveLength(10);
      for (const node of view.nodes) {
        const def = TECHNOLOGIES[node.id];
        expect({ x: node.x, y: node.y }).toEqual(techNodePosition(def.tree));
        expect(node.width).toBe(TECH_TREE_LAYOUT.nodeWidth);
        expect(node.height).toBe(TECH_TREE_LAYOUT.nodeHeight);
      }
    });

    it('computes the canvas size from the tree extents', () => {
      expect(view.width).toBe(970);
      expect(view.height).toBe(296);
      expect(view.width).toBe(
        TECH_TREE_LAYOUT.padding * 2 + 6 * TECH_TREE_LAYOUT.nodeWidth + 5 * TECH_TREE_LAYOUT.colGap,
      );
    });

    it('has 11 edges and only the crank edges are met', () => {
      expect(view.edges).toHaveLength(11);
      const met = view.edges.filter((e) => e.met).map((e) => e.key).sort();
      expect(met).toEqual(['handCrank->gearRatio', 'handCrank->wornMotor']);
    });

    it('starts each edge at the from-node right side and ends at the to-node left side', () => {
      for (const edge of view.edges) {
        const from = view.nodes.find((n) => n.id === edge.from);
        const to = view.nodes.find((n) => n.id === edge.to);
        expect(from && to).toBeTruthy();
        if (!from || !to) continue;
        expect(edge.d.startsWith(`M ${from.x + from.width} ${from.y + from.height / 2} `)).toBe(true);
        expect(edge.d.endsWith(` ${to.x} ${to.y + to.height / 2}`)).toBe(true);
        expect(edge.d).toBe(edgePath(from, to));
      }
    });

    it('has no detail when nothing is selected', () => {
      expect(view.detail).toBeNull();
    });

    it('formats the level text of gearRatio', () => {
      const node = view.nodes.find((n) => n.id === 'gearRatio');
      expect(node?.levelText).toBe('LV 0/15');
    });

    it('shows the era header as headerText', () => {
      expect(view.headerText).toBe('0 ME');
    });

    it('defaults the selection to gearRatio', () => {
      expect(defaultSelection(views)).toBe('gearRatio');
    });
  });

  describe('gearRatio purchase states', () => {
    it('is insufficient at ME 0 with a shortfall of 15', () => {
      const views = eraOneViewsOf(stateWith({ res: resWithMe(0) }));
      const view = buildTechTreeView(views, resWithMe(0), 'gearRatio', 1);
      expect(view.detail?.buyState).toBe('insufficient');
      expect(view.detail?.buyLabel).toBe('INSUFFICIENT ME');
      expect(view.detail?.shortfallText).toBe('NEED 15 MORE ME');
      expect(view.detail?.buyEnabled).toBe(true);
    });

    it('is buyable at ME 15 with the cost in the label', () => {
      const views = eraOneViewsOf(stateWith({ res: resWithMe(15) }));
      const view = buildTechTreeView(views, resWithMe(15), 'gearRatio', 1);
      expect(view.detail?.buyState).toBe('buy');
      expect(view.detail?.buyLabel).toContain('15 ME');
      expect(view.detail?.buyEnabled).toBe(true);
      expect(view.detail?.shortfallText).toBeNull();
    });

    it('keeps gearRatio as default selection at ME 15', () => {
      expect(defaultSelection(eraOneViewsOf(stateWith({ res: resWithMe(15) })))).toBe('gearRatio');
    });

    it('shows the cost text with the ME unit', () => {
      const view = buildTechTreeView(eraOneViewsOf(createInitialState(0)), emptyResourceMap(), 'gearRatio', 1);
      expect(view.detail?.costText).toBe('15 ME');
      expect(view.nodes.find((n) => n.id === 'gearRatio')?.costText).toBe('15 ME');
    });

    it('is maxed at level 15', () => {
      const state = stateWith({
        techLevels: { ...createInitialState(0).techLevels, gearRatio: 15 },
      });
      const view = buildTechTreeView(eraOneViewsOf(state), emptyResourceMap(), 'gearRatio', 1);
      const node = view.nodes.find((n) => n.id === 'gearRatio');
      expect(node?.levelText).toBe('LV 15/15');
      expect(view.detail?.statusLabel).toBe('MAXED');
      expect(view.detail?.buyState).toBe('maxed');
      expect(view.detail?.buyEnabled).toBe(false);
    });
  });

  describe('non-ME cost resource', () => {
    // wornMotor (baseCost 40) priced in EE instead of ME
    const techs: Record<TechId, TechDefinition> = {
      ...TECHNOLOGIES,
      wornMotor: { ...TECHNOLOGIES.wornMotor, costRes: 'ee' },
    };
    const viewsFor = (state: GameState): TechView[] =>
      getAllTechViews(state, techs).filter((v) => v.def.era === 1);
    const rich = stateWith({ res: { ...emptyResourceMap(), me: 1e9, ee: 0 } });

    it('takes the cost text unit from costRes', () => {
      const view = buildTechTreeView(viewsFor(rich), rich.res, 'wornMotor', 1);
      expect(view.detail?.costText).toBe('40 EE');
      expect(view.nodes.find((n) => n.id === 'wornMotor')?.costText).toBe('40 EE');
    });

    it('is insufficient on EE even when ME is huge, with shortfall from res.ee', () => {
      const view = buildTechTreeView(viewsFor(rich), rich.res, 'wornMotor', 1);
      expect(view.detail?.buyState).toBe('insufficient');
      expect(view.detail?.buyLabel).toBe('INSUFFICIENT EE');
      expect(view.detail?.shortfallText).toBe('NEED 40 MORE EE');
    });

    it('computes the shortfall from the costRes balance', () => {
      const partial = stateWith({ res: { ...emptyResourceMap(), me: 1e9, ee: 5 } });
      const view = buildTechTreeView(viewsFor(partial), partial.res, 'wornMotor', 1);
      expect(view.detail?.shortfallText).toBe('NEED 35 MORE EE');
    });

    it('is buyable when res.ee covers the cost, whatever ME is', () => {
      const funded = stateWith({ res: { ...emptyResourceMap(), me: 0, ee: 40 } });
      const view = buildTechTreeView(viewsFor(funded), funded.res, 'wornMotor', 1);
      expect(view.detail?.buyState).toBe('buy');
      expect(view.detail?.buyLabel).toBe('PURCHASE — 40 EE');
    });

    it('lists the era-I ME and EE balances in headerText when EE is a cost', () => {
      const view = buildTechTreeView(viewsFor(rich), rich.res, 'wornMotor', 1);
      expect(view.headerText).toBe('1B ME · 0 EE');
    });
  });

  describe('locked and special techs', () => {
    it('marks reinforcedCrank locked with the unmet Gear Ratio requirement', () => {
      const view = buildTechTreeView(eraOneViewsOf(createInitialState(0)), emptyResourceMap(), 'reinforcedCrank', 1);
      expect(view.detail?.buyState).toBe('locked');
      expect(view.detail?.statusLabel).toBe('LOCKED');
      expect(view.detail?.requirements).toContainEqual({ label: 'Gear Ratio Lv 3', met: false });
    });

    it('shows generatorBlueprint as automatic milestone', () => {
      const view = buildTechTreeView(eraOneViewsOf(createInitialState(0)), emptyResourceMap(), 'generatorBlueprint', 1);
      expect(view.detail?.buyState).toBe('automatic');
      expect(view.detail?.buyLabel).toBe('MILESTONE — AUTOMATIC');
      const node = view.nodes.find((n) => n.id === 'generatorBlueprint');
      expect(node?.milestone).toBe(true);
      expect(node?.kindLabel).toBe('MILESTONE');
      expect(view.detail?.requirements.some((r) => r.label.includes('lifetime ME'))).toBe(true);
    });

    it('shows handCrank as owned', () => {
      const view = buildTechTreeView(eraOneViewsOf(createInitialState(0)), emptyResourceMap(), 'handCrank', 1);
      expect(view.detail?.buyState).toBe('owned');
      expect(view.detail?.buyEnabled).toBe(false);
    });

    it('shows an achieved milestone as owned with ACHIEVED label', () => {
      const state = stateWith({
        techLevels: { ...createInitialState(0).techLevels, generatorBlueprint: 1 },
      });
      const view = buildTechTreeView(eraOneViewsOf(state), emptyResourceMap(), 'generatorBlueprint', 1);
      expect(view.detail?.buyState).toBe('owned');
      expect(view.detail?.buyLabel).toBe('ACHIEVED');
      expect(view.detail?.statusLabel).toBe('ACHIEVED');
    });
  });

  describe('selection and helpers', () => {
    it('returns null detail for an unselected tree', () => {
      expect(buildTechTreeView(eraOneViewsOf(createInitialState(0)), emptyResourceMap(), null, 1).detail).toBeNull();
    });

    it('marks the selected node', () => {
      const view = buildTechTreeView(eraOneViewsOf(createInitialState(0)), emptyResourceMap(), 'gearRatio', 1);
      const selected = view.nodes.filter((n) => n.selected).map((n) => n.id);
      expect(selected).toEqual(['gearRatio']);
    });

    it('formats purchase failure texts', () => {
      expect(purchaseFailureText('insufficient', 3.2)).toContain('4');
      expect(purchaseFailureText('insufficient', 3.2)).toBe('NEED 4 MORE ME');
      expect(purchaseFailureText('insufficient', 5, 'ee')).toBe('NEED 5 MORE EE');
      expect(purchaseFailureText('locked', 0)).toBe('REQUIREMENTS UNMET');
      expect(purchaseFailureText('maxed', 0)).toBe('MAXIMUM LEVEL');
      expect(purchaseFailureText('owned', 0)).toBe('ALREADY INSTALLED');
      expect(purchaseFailureText('notPurchasable', 0)).toBe('CANNOT BE PURCHASED');
    });

    it('falls back to handCrank when nothing is available', () => {
      const views = eraOneViewsOf(createInitialState(0)).map((v): TechView => ({
        ...v,
        status: 'purchased',
        affordable: false,
      }));
      expect(defaultSelection(views)).toBe('handCrank');
    });

    it('edge keys are from->to', () => {
      const view = buildTechTreeView(eraOneViewsOf(createInitialState(0)), emptyResourceMap(), null, 1);
      expect(view.edges.every((e) => e.key === `${e.from}->${e.to}`)).toBe(true);
    });
  });

  describe('era tabs', () => {
    it('reachedEras: fresh state is [1]', () => {
      expect(reachedEras(viewsOf(createInitialState(0)))).toEqual([1]);
    });

    it('reachedEras: an available era-II tech opens era 2', () => {
      const views = getAllTechViews(createInitialState(0), ERA_TWO_AVAILABLE);
      expect(reachedEras(views)).toEqual([1, 2]);
    });

    it('reachedEras: a locked era-II tech keeps era 2 closed', () => {
      const views = getAllTechViews(createInitialState(0), ERA_TWO_LOCKED);
      expect(reachedEras(views)).toEqual([1]);
    });

    it('buildEraTabs: fresh state gives one reached, selected ERA I · ME tab', () => {
      const tabs = buildEraTabs(eraOneViewsOf(createInitialState(0)), emptyResourceMap(), 1);
      expect(tabs).toEqual([
        { era: 1, label: 'ERA I · ME', reached: true, fullGame: false, selected: true, resourceText: '0 ME', affordable: 0, ariaLabel: 'ERA I · ME' },
      ]);
    });

    it('buildEraTabs: locked era II shows the SIGNAL ? placeholder', () => {
      const views = getAllTechViews(createInitialState(0), ERA_TWO_LOCKED);
      const tabs = buildEraTabs(views, emptyResourceMap(), 1);
      expect(tabs).toHaveLength(5);
      const placeholder = { label: 'SIGNAL ?', reached: false, fullGame: false, selected: false, resourceText: '', affordable: 0, ariaLabel: 'SIGNAL ?' };
      expect(tabs[1]).toEqual({ era: 2, ...placeholder });
      expect(tabs[2]).toEqual({ era: 3, ...placeholder });
      expect(tabs[3]).toEqual({ era: 4, ...placeholder });
      expect(tabs[4]).toEqual({ era: 5, ...placeholder });
    });

    it('buildEraTabs: reached era II shows ERA II · EE with the EE balance and its affordable count', () => {
      const res: ResourceMap = { ...emptyResourceMap(), ee: 1200 };
      const views = getAllTechViews(stateWith({ res }), ERA_TWO_AVAILABLE);
      const tabs = buildEraTabs(views, res, 2);
      expect(tabs[1]).toEqual({
        era: 2, label: 'ERA II · EE', reached: true, fullGame: false, selected: true, resourceText: '1.2K EE',
        affordable: 1, ariaLabel: 'ERA II · EE, 1 affordable',
      });
    });

    it('buildEraTabs: selected follows the argument', () => {
      const views = getAllTechViews(createInitialState(0), ERA_TWO_AVAILABLE);
      const tabs = buildEraTabs(views, emptyResourceMap(), 2);
      expect(tabs.map((t) => t.selected)).toEqual([false, true, false, false, false]);
    });

    it('buildEraTabs: one tab per era present in the views, ascending', () => {
      const views = getAllTechViews(createInitialState(0), ERA_TWO_AVAILABLE);
      expect(buildEraTabs(views, emptyResourceMap(), 1).map((t) => t.era)).toEqual([1, 2, 3, 4, 5]);
      const eraTwoOnly = views.filter((v) => v.def.era === 2);
      expect(buildEraTabs(eraTwoOnly, emptyResourceMap(), 2).map((t) => t.era)).toEqual([2]);
    });
  });

  describe('era-II tree (injected)', () => {
    const state = createInitialState(0);
    const eraTwoViews = [
      getTechView(state, 'wornMotor', ERA_TWO_AVAILABLE),
      getTechView(state, 'motorTuning', ERA_TWO_AVAILABLE),
    ];

    it('starts the layout at column 0 and row 0', () => {
      const view = buildTechTreeView(eraTwoViews, emptyResourceMap(), null, 2);
      const worn = view.nodes.find((n) => n.id === 'wornMotor');
      const tuning = view.nodes.find((n) => n.id === 'motorTuning');
      expect(worn?.x).toBe(TECH_TREE_LAYOUT.padding);
      expect(worn?.y).toBe(TECH_TREE_LAYOUT.padding);
      expect(tuning?.x).toBe(TECH_TREE_LAYOUT.padding + TECH_TREE_LAYOUT.nodeWidth + TECH_TREE_LAYOUT.colGap);
    });

    it('sizes the canvas from the era span only', () => {
      const view = buildTechTreeView(eraTwoViews, emptyResourceMap(), null, 2);
      expect(view.width).toBe(TECH_TREE_LAYOUT.padding * 2 + 2 * TECH_TREE_LAYOUT.nodeWidth + TECH_TREE_LAYOUT.colGap);
      expect(view.height).toBe(TECH_TREE_LAYOUT.padding * 2 + TECH_TREE_LAYOUT.nodeHeight);
    });

    it('drops edges from techs outside the era but keeps the requirement in the detail', () => {
      const view = buildTechTreeView(eraTwoViews, emptyResourceMap(), 'wornMotor', 2);
      expect(view.edges.map((e) => e.key)).toEqual(['wornMotor->motorTuning']);
      expect(view.detail?.requirements.some((r) => r.label.includes('Hand Crank'))).toBe(true);
    });

    it('headerText lists the ME and EE balances priced in era II', () => {
      const res: ResourceMap = { ...emptyResourceMap(), ee: 1200 };
      const view = buildTechTreeView(eraTwoViews, res, null, 2);
      expect(view.headerText).toBe('0 ME · 1.2K EE');
    });
  });

  describe('edge routing around nodes (WP25 AD1 F2)', () => {
    /** Tree view of one era built from the real techs, as the overlay builds it. */
    function realEraView(era: number) {
      const views = getAllTechViews(createInitialState(0)).filter((v) => v.def.era === era);
      return buildTechTreeView(views, emptyResourceMap(), null, era);
    }

    /** Node at (x, y) with the default node size; edge routing reads only the geometry and the id. */
    function nodeAt(id: TechId, x: number, y: number): TechNodeView {
      return {
        id, name: id, status: 'available', kindLabel: 'UNLOCK', milestone: false, levelText: '', costText: null,
        ariaLabel: id, affordable: false, selected: false, x, y,
        width: TECH_TREE_LAYOUT.nodeWidth, height: TECH_TREE_LAYOUT.nodeHeight,
      };
    }

    it('routes Motor Retrofit -> Power Lines above Crank Servo in era II', () => {
      const view = buildTechTreeView(viewsOf(createInitialState(0)).filter((v) => v.def.era === 2), emptyResourceMap(), null, 2);
      const edge = view.edges.find((e) => e.key === 'motorRetrofit->powerLines');
      expect(edge?.d).toBe('M 320 244 C 327 244, 327 196, 334 196 L 636 196 C 643 196, 643 244, 650 244');
    });

    it('routes Condenser -> Vessel Blueprint above Turbine in era III', () => {
      const view = buildTechTreeView(viewsOf(createInitialState(0)).filter((v) => v.def.era === 3), emptyResourceMap(), null, 3);
      const edge = view.edges.find((e) => e.key === 'condenser->pressureVesselBlueprint');
      expect(edge?.d).toBe('M 636 148 C 643 148, 643 100, 650 100 L 952 100 C 959 100, 959 148, 966 148');
    });

    it.each([1, 2, 3, 4, 5])('era %i: every edge is the straight path unless it is detoured', (era) => {
      const view = realEraView(era);
      for (const edge of view.edges) {
        const from = view.nodes.find((n) => n.id === edge.from);
        const to = view.nodes.find((n) => n.id === edge.to);
        if (!from || !to) throw new Error(`missing node for ${edge.key}`);
        if (DETOURED.includes(edge.key)) {
          expect(edge.d).not.toBe(edgePath(from, to));
        } else {
          expect(edge.d).toBe(edgePath(from, to));
        }
      }
    });

    it('detours exactly the same-row and cross-row edges that pass a node across eras I-V', () => {
      const detoured: string[] = [];
      for (const era of [1, 2, 3, 4, 5]) {
        const view = realEraView(era);
        for (const edge of view.edges) {
          const from = view.nodes.find((n) => n.id === edge.from);
          const to = view.nodes.find((n) => n.id === edge.to);
          if (from && to && edge.d !== edgePath(from, to)) detoured.push(edge.key);
        }
      }
      expect(detoured.sort()).toEqual(DETOURED);
    });

    it('detours a blocked edge on the top row through the gap below', () => {
      const from = nodeAt('handCrank', 18, 18);
      const mid = nodeAt('gearRatio', 176, 18);
      const to = nodeAt('wornMotor', 334, 18);
      expect(edgePathAround(from, to, [from, mid, to])).toBe(
        'M 162 52 C 169 52, 169 100, 176 100 L 320 100 C 327 100, 327 52, 334 52',
      );
    });

    it('keeps the straight path when no node of the row lies strictly between the ends', () => {
      const from = nodeAt('handCrank', 18, 18);
      const to = nodeAt('gearRatio', 176, 18);
      const beyond = nodeAt('wornMotor', 334, 18);
      const otherRow = nodeAt('motorTuning', 176, 114);
      expect(edgePathAround(from, to, [from, to, beyond, otherRow])).toBe(edgePath(from, to));
    });

    it('detours a cross-row edge through the outer channel below the grid when its curve clips a node', () => {
      const from = nodeAt('handCrank', 18, 18);
      const mid = nodeAt('gearRatio', 176, 114);
      const to = nodeAt('wornMotor', 334, 114);
      expect(edgePathAround(from, to, [from, mid, to])).toBe(
        'M 162 52 C 169 52, 169 52, 169 59 L 169 184 C 169 191, 169 191, 176 191 L 320 191 C 327 191, 327 191, 327 184 L 327 155 C 327 148, 327 148, 334 148',
      );
    });

    it('detours a cross-row edge that climbs to a target row above it through the outer channel above the grid', () => {
      const from = nodeAt('handCrank', 18, 114);
      const mid = nodeAt('gearRatio', 176, 18);
      const to = nodeAt('wornMotor', 334, 18);
      expect(edgePathAround(from, to, [from, mid, to])).toBe(
        'M 162 148 C 169 148, 169 148, 169 141 L 169 16 C 169 9, 169 9, 176 9 L 320 9 C 327 9, 327 9, 327 16 L 327 45 C 327 52, 327 52, 334 52',
      );
    });

    it('keeps the straight path for a cross-row edge whose curve clears every node', () => {
      const from = nodeAt('handCrank', 18, 18);
      const to = nodeAt('wornMotor', 334, 114);
      const belowTarget = nodeAt('motorTuning', 176, 210);
      const beyond = nodeAt('pistonArray', 500, 114);
      expect(edgePathAround(from, to, [from, to, belowTarget, beyond])).toBe(edgePath(from, to));
    });

    it('routes Null Chamber to Mains Backfeed and Steam Lance through the outer channels in era V', () => {
      const view = realEraView(5);
      const pathOf = (key: string): string | undefined => view.edges.find((e) => e.key === key)?.d;
      expect(pathOf('nullChamber->mainsBackfeed')).toBe('M 162 148 C 169 148, 169 148, 169 141 L 169 16 C 169 9, 169 9, 176 9 L 952 9 C 959 9, 959 9, 959 16 L 959 45 C 959 52, 959 52, 966 52');
      expect(pathOf('nullChamber->steamLance')).toBe('M 162 148 C 169 148, 169 148, 169 155 L 169 280 C 169 287, 169 287, 176 287 L 952 287 C 959 287, 959 287, 959 280 L 959 251 C 959 244, 959 244, 966 244');
    });
  });

  describe('no edge passes through a third node (WP26 Q6)', () => {
    const CLEAR_PX = 4;            // layout px: the closest an edge may come to a node box that is not one of its two ends
    const SAMPLES_PER_SEGMENT = 64; // points per L or C segment, the same sampling as the detour test in edgePathAround
    const SHARED_PX = 0.5;          // layout px: a point of one edge lies on another edge's line within this distance
    const MAX_SHARED_RUN_PX = 8;    // layout px: the longest stretch two edges with no port in common may run along each other
    type Pt = { x: number; y: number };

    /** Tree view of one era built from the real techs, as the overlay builds it. */
    function realEraView(era: number) {
      const views = getAllTechViews(createInitialState(0)).filter((v) => v.def.era === era);
      return buildTechTreeView(views, emptyResourceMap(), null, era);
    }

    /** Points along an absolute path of M, C and L commands: the only ones edgePath and edgePathAround emit. */
    function samplePath(d: string): Pt[] {
      const tokens = d.replace(/,/g, ' ').trim().split(/\s+/);
      const pts: Pt[] = [];
      let cur: Pt = { x: 0, y: 0 };
      let i = 0;
      const num = (): number => {
        const token = tokens[i++];
        if (token === undefined) throw new Error(`truncated path: ${d}`);
        return Number(token);
      };
      const point = (): Pt => ({ x: num(), y: num() });
      while (i < tokens.length) {
        const cmd = tokens[i++];
        if (cmd === 'M') {
          cur = point();
          pts.push(cur);
        } else if (cmd === 'L') {
          const end = point();
          for (let s = 0; s <= SAMPLES_PER_SEGMENT; s++) {
            const u = s / SAMPLES_PER_SEGMENT;
            pts.push({ x: cur.x + (end.x - cur.x) * u, y: cur.y + (end.y - cur.y) * u });
          }
          cur = end;
        } else if (cmd === 'C') {
          const c1 = point();
          const c2 = point();
          const end = point();
          for (let s = 0; s <= SAMPLES_PER_SEGMENT; s++) {
            const u = s / SAMPLES_PER_SEGMENT;
            const k = 1 - u;
            const w0 = k * k * k;
            const w1 = 3 * k * k * u;
            const w2 = 3 * k * u * u;
            const w3 = u * u * u;
            pts.push({
              x: w0 * cur.x + w1 * c1.x + w2 * c2.x + w3 * end.x,
              y: w0 * cur.y + w1 * c1.y + w2 * c2.y + w3 * end.y,
            });
          }
          cur = end;
        } else {
          throw new Error(`unsupported path command ${cmd ?? '(none)'} in ${d}`);
        }
      }
      return pts;
    }

    /** Distance from a point to a node box, 0 inside the box. */
    function distToBox(p: Pt, n: TechNodeView): number {
      const dx = Math.max(n.x - p.x, 0, p.x - (n.x + n.width));
      const dy = Math.max(n.y - p.y, 0, p.y - (n.y + n.height));
      return Math.hypot(dx, dy);
    }

    it('samplePath follows a straight L segment', () => {
      const pts = samplePath('M 0 0 L 10 0');
      expect(pts[0]).toEqual({ x: 0, y: 0 });
      expect(pts[pts.length - 1]).toEqual({ x: 10, y: 0 });
      expect(pts).toContainEqual({ x: 5, y: 0 });
      expect(pts.every((p) => p.y === 0)).toBe(true);
    });

    it('samplePath ends a C segment on its end point and passes the t = 0.5 point', () => {
      // Symmetric cubic (0,0) (0,10) (10,10) (10,0): at t = 0.5 the point is (5, 7.5).
      const pts = samplePath('M 0 0 C 0 10, 10 10, 10 0');
      expect(pts[0]).toEqual({ x: 0, y: 0 });
      expect(pts[pts.length - 1]).toEqual({ x: 10, y: 0 });
      expect(pts).toContainEqual({ x: 5, y: 7.5 });
    });

    it('samplePath of a real edge runs from the right side of from to the left side of to', () => {
      const view = realEraView(1);
      const edge = view.edges[0];
      const from = view.nodes.find((n) => n.id === edge?.from);
      const to = view.nodes.find((n) => n.id === edge?.to);
      if (edge === undefined || from === undefined || to === undefined) throw new Error('era I has no edge');
      const pts = samplePath(edge.d);
      expect(pts[0]).toEqual({ x: from.x + from.width, y: from.y + from.height / 2 });
      expect(pts[pts.length - 1]).toEqual({ x: to.x, y: to.y + to.height / 2 });
    });

    it('distToBox is 0 inside a node and the Euclidean gap outside it', () => {
      const node = realEraView(1).nodes.find((n) => n.id === 'gearRatio');
      if (node === undefined) throw new Error('missing gearRatio node');
      expect(distToBox({ x: node.x + 1, y: node.y + 1 }, node)).toBe(0);
      expect(distToBox({ x: node.x - 3, y: node.y - 4 }, node)).toBe(5);
      expect(distToBox({ x: node.x - 10, y: node.y + node.height / 2 }, node)).toBe(10);
    });

    it.each([1, 2, 3, 4, 5])('era %i: every edge keeps CLEAR_PX from every third node', (era) => {
      const view = realEraView(era);
      const bad: string[] = [];
      for (const edge of view.edges) {
        const pts = samplePath(edge.d);
        for (const node of view.nodes) {
          if (node.id === edge.from || node.id === edge.to) continue;
          const min = Math.min(...pts.map((p) => distToBox(p, node)));
          if (min < CLEAR_PX) bad.push(`${edge.key} -> ${node.id} (${min.toFixed(1)} px)`);
        }
      }
      expect(bad).toEqual([]);
    });

    /** Consecutive point pairs of a sampled polyline. */
    function segmentsOf(pts: Pt[]): [Pt, Pt][] {
      const segments: [Pt, Pt][] = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (a && b) segments.push([a, b]);
      }
      return segments;
    }

    /** Proper crossing of segments ab and cd: each pair strictly on opposite sides. Touching and collinear pairs do not count. */
    function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
      const side = (p: Pt, q: Pt, r: Pt): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
    }

    it('era V: no detoured edge crosses another edge', () => {
      const view = realEraView(5);
      const sampled = view.edges.map((edge) => ({ edge, segments: segmentsOf(samplePath(edge.d)) }));
      const crossings: string[] = [];
      for (const detour of sampled) {
        if (!DETOURED.includes(detour.edge.key)) continue;
        for (const other of sampled) {
          // Edges out of the same source or into the same target share a port, so they meet there by design.
          if (other === detour || other.edge.from === detour.edge.from || other.edge.to === detour.edge.to) continue;
          const hit = detour.segments.some(([a, b]) => other.segments.some(([c, d]) => segmentsCross(a, b, c, d)));
          if (hit) crossings.push(`${detour.edge.key} x ${other.edge.key}`);
        }
      }
      expect(crossings).toEqual([]);
    });

    /** Distance from a point to the segment ab. */
    function distToSegment(p: Pt, a: Pt, b: Pt): number {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const u = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
      return Math.hypot(a.x + dx * u - p.x, a.y + dy * u - p.y);
    }

    /**
     * Longest stretch (layout px) of `a` that runs along `b`: consecutive sample points of `a` that both lie
     * within SHARED_PX of b's line, summed over the stretch. A run of two edges sharing one track shows here.
     */
    function longestSharedRun(a: Pt[], b: Pt[]): number {
      const segments = segmentsOf(b);
      const on = a.map((p) => segments.some(([s, t]) => distToSegment(p, s, t) < SHARED_PX));
      let best = 0;
      let run = 0;
      for (let i = 1; i < a.length; i++) {
        const p = a[i - 1];
        const q = a[i];
        if (!p || !q || !on[i - 1] || !on[i]) {
          run = 0;
          continue;
        }
        run += Math.hypot(q.x - p.x, q.y - p.y);
        best = Math.max(best, run);
      }
      return best;
    }

    it.each([1, 2, 3, 4, 5])('era %i: no two edges share a run', (era) => {
      const view = realEraView(era);
      const sampled = view.edges.map((edge) => ({ edge, pts: samplePath(edge.d) }));
      const shared: string[] = [];
      for (const first of sampled) {
        for (const second of sampled) {
          // Edges out of the same source or into the same target share a port, so they run together there by design.
          if (first === second || first.edge.from === second.edge.from || first.edge.to === second.edge.to) continue;
          const run = longestSharedRun(first.pts, second.pts);
          if (run >= MAX_SHARED_RUN_PX) shared.push(`${first.edge.key} = ${second.edge.key} (${run.toFixed(1)} px)`);
        }
      }
      expect(shared).toEqual([]);
    });
  });

  describe('tab width and height stay (WP26)', () => {
    // Max tree col and row per era, and the tab width they give. WP27 Fault Lamp (5,2) widens tab I to 970 px; the other eras keep their WP26 size.
    it.each([
      [1, 5, 2, 970],
      [2, 5, 2, 970],
      [3, 6, 2, 1128],
      [4, 5, 2, 970],
      [5, 6, 2, 1128],
    ])('era %i keeps max col %i, max row %i and a %i px wide tab', (era, maxCol, maxRow, width) => {
      const views = getAllTechViews(createInitialState(0)).filter((v) => v.def.era === era);
      expect(Math.max(...views.map((v) => v.def.tree.col))).toBe(maxCol);
      expect(Math.max(...views.map((v) => v.def.tree.row))).toBe(maxRow);
      expect(buildTechTreeView(views, emptyResourceMap(), null, era).width).toBe(width);
    });
  });

  describe('defaultSelection fallbacks', () => {
    it('returns the first view when there is no handCrank and nothing is available', () => {
      const views = getAllTechViews(createInitialState(0), ERA_TWO_LOCKED).filter((v) => v.def.era === 2);
      expect(defaultSelection(views)).toBe('wornMotor');
    });
  });

  describe('node accessible names (D8)', () => {
    afterEach(() => {
      setDefaultNotation('suffix');
    });

    /** Initial state with the given tech levels applied on top. */
    function stateWithLevels(levels: Partial<Record<TechId, number>>): GameState {
      const base = createInitialState(0);
      return { ...base, techLevels: { ...base.techLevels, ...levels } };
    }

    it('names a purchased starting tech without a cost', () => {
      const view = getTechView(createInitialState(0), 'handCrank');
      expect(view.status).toBe('purchased');
      expect(nodeAriaLabel(view)).toBe('Hand Crank, purchased, level 1');
    });

    it('names an available repeatable with its next cost in suffix notation', () => {
      const view = getTechView(createInitialState(0), 'gearRatio');
      expect(view.status).toBe('available');
      expect(nodeAriaLabel({ ...view, nextCost: 1234 })).toBe('Gear Ratio, available, level 0, cost 1.24K ME');
    });

    it('names a locked tech as locked', () => {
      const locked = getAllTechViews(createInitialState(0)).find((v) => v.status === 'locked');
      if (locked === undefined) throw new Error('expected a locked tech in the initial state');
      expect(nodeAriaLabel(locked).startsWith(`${locked.def.name}, locked, level 0`)).toBe(true);
    });

    it('names a purchased unlock without a cost', () => {
      const id = TECH_IDS.find((t) => TECHNOLOGIES[t].kind === 'unlock');
      if (id === undefined) throw new Error('expected an unlock tech');
      const view = getTechView(stateWithLevels({ [id]: 1 }), id);
      expect(view.status).toBe('purchased');
      expect(nodeAriaLabel(view)).toBe(`${TECHNOLOGIES[id].name}, purchased, level 1`);
    });

    it('names a repeatable below its cap as available (its node status) with the next cost', () => {
      const view = getTechView(stateWithLevels({ gearRatio: 3 }), 'gearRatio');
      expect(view.status).toBe('available');
      expect(nodeAriaLabel(view)).toMatch(/^Gear Ratio, available, level 3, cost \S+ ME$/);
    });

    it('names a repeatable at its cap as maxed without a cost', () => {
      const view = getTechView(stateWithLevels({ gearRatio: 15 }), 'gearRatio');
      expect(nodeAriaLabel(view)).toBe('Gear Ratio, maxed, level 15');
    });

    it('follows the default notation at call time', () => {
      const view = getTechView(createInitialState(0), 'gearRatio');
      setDefaultNotation('scientific');
      expect(nodeAriaLabel({ ...view, nextCost: 1234 })).toBe('Gear Ratio, available, level 0, cost 1.24e3 ME');
    });

    it('is carried on every built node', () => {
      const views = eraOneViewsOf(createInitialState(0));
      const built = buildTechTreeView(views, emptyResourceMap(), null, 1);
      for (const node of built.nodes) {
        const view = views.find((v) => v.id === node.id);
        if (view === undefined) throw new Error(`missing view for ${node.id}`);
        expect(node.ariaLabel).toBe(nodeAriaLabel(view));
      }
    });
  });

  describe('WP20 view model', () => {
    /** All-era views with `levels` applied on top of the initial state. */
    function viewsWith(levels: Partial<Record<TechId, number>>, res: ResourceMap = emptyResourceMap()): TechView[] {
      const base = createInitialState(0);
      return getAllTechViews({ ...base, res, techLevels: { ...base.techLevels, ...levels } });
    }

    /** Tech levels that satisfy the tech requirements of `id` (read from the tech table). */
    function levelsFor(id: TechId): Partial<Record<TechId, number>> {
      const levels: Partial<Record<TechId, number>> = {};
      for (const req of TECHNOLOGIES[id].requires) {
        if (req.type === 'tech') levels[req.id] = req.minLevel;
      }
      return levels;
    }

    describe('priority and default selection', () => {
      it('fresh state: no priority tech, gearRatio selected', () => {
        const views = viewsOf(createInitialState(0));
        expect(priorityTech(views)).toBeNull();
        expect(defaultSelection(views)).toBe('gearRatio');
      });

      it('priorityTech is null on a fresh era I list', () => {
        expect(priorityTech(eraOneViewsOf(createInitialState(0)))).toBeNull();
      });

      it('priorityTech is null while primaryFunction and the keystones are locked', () => {
        expect(priorityTech(viewsWith({}))).toBeNull();
      });

      it('priorityTech is null when the open keystone is already installed', () => {
        expect(priorityTech(viewsWith({ ...levelsFor('generator'), generator: 1 }))).toBeNull();
      });

      it('priorityTech returns the open keystone when it is the only one', () => {
        expect(priorityTech(viewsWith(levelsFor('generator')))).toBe('generator');
      });

      it('priorityTech returns primaryFunction over a simultaneously open keystone', () => {
        const levels = { ...levelsFor('generator'), ...levelsFor('primaryFunction') };
        expect(priorityTech(viewsWith(levels))).toBe('primaryFunction');
      });

      it('defaultSelection selects an open era keystone even when unaffordable', () => {
        const views = viewsWith(levelsFor('generator')).filter((v) => v.def.era === 2);
        expect(views.find((v) => v.id === 'generator')?.affordable).toBe(false);
        expect(defaultSelection(views)).toBe('generator');
      });

      it('defaultSelection selects primaryFunction once finalAlignment is installed', () => {
        const views = viewsWith(levelsFor('primaryFunction')).filter((v) => v.def.era === 5);
        expect(defaultSelection(views)).toBe('primaryFunction');
      });

      it('defaultSelection prefers an affordable unlock over an affordable repeatable', () => {
        const views = eraOneViewsOf(stateWith({ res: resWithMe(40) }));
        expect(views.find((v) => v.id === 'gearRatio')?.affordable).toBe(true);
        expect(views.find((v) => v.id === 'wornMotor')?.affordable).toBe(true);
        expect(defaultSelection(views)).toBe('wornMotor');
      });
    });

    describe('tab affordable counts', () => {
      it('counts the affordable techs of a reached era and labels the tab', () => {
        const res = resWithMe(15);
        const tabs = buildEraTabs(viewsWith({}, res), res, 1);
        expect(tabs[0]).toEqual({
          era: 1, label: 'ERA I · ME', reached: true, fullGame: false, selected: true, resourceText: '15 ME',
          affordable: 1, ariaLabel: 'ERA I · ME, 1 affordable',
        });
        expect(tabs[1]?.affordable).toBe(0);
        expect(tabs[1]?.ariaLabel).toBe('SIGNAL ?');
      });
    });

    describe('era header and install feedback', () => {
      afterEach(() => {
        setRevealed(false);
      });

      it('shows only the era I balance when ME alone prices the era', () => {
        const res = resWithMe(15);
        expect(eraHeaderText(eraOneViewsOf(stateWith({ res })), res, 1)).toBe('15 ME');
      });

      it('lists every unlock and repeatable cost resource of era II', () => {
        const views = viewsOf(createInitialState(0)).filter((v) => v.def.era === 2);
        expect(eraHeaderText(views, { ...emptyResourceMap(), me: 15, ee: 40 }, 2)).toBe('15 ME · 40 EE');
      });

      it('ends era V with the flux label, hidden then revealed', () => {
        const views = viewsOf(createInitialState(0)).filter((v) => v.def.era === 5);
        expect(eraHeaderText(views, emptyResourceMap(), 5).endsWith(' ???')).toBe(true);
        setRevealed(true);
        expect(eraHeaderText(views, emptyResourceMap(), 5).endsWith(' RF')).toBe(true);
      });

      it('falls back to the era resource when no unlock or repeatable is priced', () => {
        const crank = getTechView(createInitialState(0), 'handCrank');
        expect(eraHeaderText([crank], resWithMe(42), 1)).toBe('42 ME');
        expect(eraHeaderText([], { ...emptyResourceMap(), ee: 7 }, 2)).toBe('7 EE');
      });

      it('purchaseFeedbackText gives the install line on the first level, the level after', () => {
        expect(purchaseFeedbackText('gearRatio', 1)).toBe('INSTALLED — Gear mesh recalibrated. Cause: unknown.');
        expect(purchaseFeedbackText('gearRatio', 3)).toBe('LEVEL 3');
      });
    });

    describe('fit and reveal', () => {
      it('graphFitScale fits content, floors to 3 decimals and clamps at minScale', () => {
        expect(graphFitScale(1142, 1128)).toBe(1);
        expect(graphFitScale(782, 1128)).toBe(0.693);
        expect(graphFitScale(300, 1128)).toBe(TECH_TREE_FIT.minScale);
        expect(graphFitScale(0, 1128)).toBe(1);
        expect(graphFitScale(1128, 1128)).toBe(1);
      });

      describe('revealScroll', () => {
        const viewport = { width: 1000, height: 300 };
        const box = (x: number, y: number) => ({ x, y, width: 144, height: 68 });

        it('keeps the scroll when the node is already inside', () => {
          expect(revealScroll({ left: 100, top: 50 }, viewport, box(300, 100), 1)).toEqual({ left: 100, top: 50 });
        });

        it('scrolls left to the node plus padding', () => {
          expect(revealScroll({ left: 400, top: 0 }, viewport, box(300, 100), 1)).toEqual({ left: 288, top: 0 });
        });

        it('scrolls right so the node end sits inside the padding', () => {
          expect(revealScroll({ left: 0, top: 0 }, viewport, box(1000, 100), 1)).toEqual({ left: 156, top: 0 });
        });

        it('scrolls up to the node plus padding', () => {
          expect(revealScroll({ left: 0, top: 100 }, viewport, box(300, 20), 1)).toEqual({ left: 0, top: 8 });
        });

        it('scrolls down so the node bottom sits inside the padding', () => {
          expect(revealScroll({ left: 0, top: 0 }, viewport, box(300, 280), 1)).toEqual({ left: 0, top: 60 });
        });

        it('clamps the scroll at the top-left edge', () => {
          expect(revealScroll({ left: 50, top: 0 }, viewport, box(5, 100), 1)).toEqual({ left: 0, top: 0 });
        });

        it('works on the scaled box', () => {
          const narrow = { width: 250, height: 300 };
          expect(revealScroll({ left: 0, top: 0 }, narrow, box(600, 0), 0.5)).toEqual({ left: 134, top: 0 });
        });
      });
    });

    describe('per-era canvas with real techs', () => {
      it.each([
        [1, 970],
        [2, 970],
        [3, 1128],
        [4, 970],
        [5, 1128],
      ])('era %i canvas is %i px wide, within the fit, and 296 px tall', (era, width) => {
        const views = getAllTechViews(createInitialState(0)).filter((v) => v.def.era === era);
        const view = buildTechTreeView(views, emptyResourceMap(), null, era);
        expect(view.width).toBe(width);
        expect(view.width).toBeLessThanOrEqual(TECH_TREE_FIT.maxWidthPx);
        expect(view.height).toBe(296);
      });
    });
  });
});

// WP28 C9 SPLICES tab. ERA_NODE_IDS is the era graph as of v0.11.0 (90ebfb2): the Splices (branch 'splice') never join it.
const ERA_NODE_IDS: Record<number, TechId[]> = {
  1: ['handCrank', 'gearRatio', 'reinforcedCrank', 'flywheel', 'wornMotor', 'motorTuning', 'pistonArray', 'improvedPistons', 'generatorBlueprint', 'faultLamp'],
  2: ['generator', 'copperWinding', 'motorRetrofit', 'dynamoCrank', 'capacitorBank', 'sparkGap', 'transformer', 'powerLines', 'substationBlueprint', 'crankServo', 'dischargeLever'],
  3: ['boiler', 'firebox', 'inductionHeater', 'steamHammer', 'superheater', 'condenser', 'turbine', 'reliefValves', 'pressureVesselBlueprint', 'bellowsDrive', 'leakWhistle'],
  4: ['resonatorSpire', 'harmonicCoil', 'pressureResonator', 'echoCrank', 'phaseLock', 'standingWave', 'crystalLattice', 'harmonicConvergence', 'gridExciter', 'dampingFork'],
  5: ['nullChamber', 'containmentRing', 'resonantSiphon', 'graviticAnchor', 'inversionCrank', 'lensArray', 'horizonField', 'skyAperture', 'finalAlignment', 'primaryFunction', 'mainsBackfeed', 'steamLance', 'overrunClutch'],
};

/** A fresh state with the given current balances, lifetime totals and tech levels. */
function withBalances(res: Partial<ResourceMap>, lifetime: Partial<ResourceMap> = {}, techLevels: Partial<Record<TechId, number>> = {}): GameState {
  return stateWith({
    res: { ...emptyResourceMap(), ...res },
    lifetime: { ...emptyResourceMap(), ...lifetime },
    techLevels: { ...createInitialState(0).techLevels, ...techLevels },
  });
}

/** The SPLICES rows of a state (its own lifetime map feeds the DARK progress). */
function rowsOf(state: GameState): SpliceRowView[] {
  return buildSpliceRows(viewsOf(state), state.lifetime);
}

describe('SPLICES tab (WP28 C9)', () => {
  it('keeps the era graph, tab counts and default selection free of Splices', () => {
    const state = withBalances({ me: 1000 }, { me: 15000 });
    const all = viewsOf(state);
    // spliceBicycle is affordable here: the era I count must not include it.
    expect(all.some((v) => isSplice(v.def) && v.affordable)).toBe(true);
    const tabs = buildEraTabs(all, state.res, 1);
    expect(tabs[0]?.affordable).toBe(all.filter((v) => v.def.era === 1 && !isSplice(v.def) && v.affordable).length);
    expect(defaultSelection(all.filter((v) => v.def.era === 1))).toBe(
      defaultSelection(all.filter((v) => v.def.era === 1 && !isSplice(v.def))),
    );
    for (const era of [1, 2, 3, 4, 5]) {
      const view = buildTechTreeView(all.filter((v) => v.def.era === era), state.res, null, era);
      expect(view.nodes.map((n) => n.id)).toEqual(ERA_NODE_IDS[era]);
    }
  });

  it.each([1, 2, 3, 4, 5])('era %i graph holds the v0.11.0 node ids in table order', (era) => {
    const views = getAllTechViews(createInitialState(0)).filter((v) => v.def.era === era);
    expect(buildTechTreeView(views, emptyResourceMap(), null, era).nodes.map((n) => n.id)).toEqual(ERA_NODE_IDS[era]);
  });

  it('is null while every Splice is locked, and shows with its affordable count once one is not locked', () => {
    expect(buildSpliceTab(viewsOf(withBalances({})), false)).toBeNull();
    expect(buildSpliceTab(viewsOf(withBalances({ me: 1000 }, { me: 15000 })), false)).toEqual({
      label: 'SPLICES', affordable: 1, selected: false, ariaLabel: 'SPLICES, 1 affordable',
    });
    expect(buildSpliceTab(viewsOf(withBalances({}, { me: 15000 })), true)).toEqual({
      label: 'SPLICES', affordable: 0, selected: true, ariaLabel: 'SPLICES',
    });
  });

  it('counts a demo-capped Splice as locked', () => {
    // A boiler owned and PR lifetime: the era III Splices are open in the full game but above the demo cap of 2.
    const state = withBalances({}, { pr: 1e9 }, { boiler: 1 });
    expect(buildSpliceTab(getAllTechViews(state, TECHNOLOGIES, 2), false)).toBeNull();
    expect(buildSpliceTab(getAllTechViews(state), false)).not.toBeNull();
  });

  it('lists the 16 Splices in table order, grouped by era, all DARK on a fresh machine', () => {
    const rows = rowsOf(withBalances({}));
    expect(rows.map((r) => r.id)).toEqual(TECH_IDS.filter((id) => isSplice(TECHNOLOGIES[id])));
    expect(rows).toHaveLength(16);
    expect(rows.map((r) => r.era)).toEqual([...rows.map((r) => r.era)].sort((a, b) => a - b));
    expect(new Set(rows.map((r) => r.state))).toEqual(new Set(['DARK']));
    expect(rows[0]).toMatchObject({ name: 'Bicycle', costText: '900 ME', effectText: '+5% automation', progressText: '0 / 15K LIFETIME ME', affordable: false });
  });

  it('shows the lifetime progress on a DARK row and IN REACH, SPLICED rows without it', () => {
    expect(rowsOf(withBalances({}, { me: 9100 }))[0]?.progressText).toBe('9.1K / 15K LIFETIME ME');
    expect(rowsOf(withBalances({}, { me: 15000 }))[0]).toMatchObject({ state: 'IN REACH', progressText: '' });
    expect(rowsOf(withBalances({}, { me: 15000 }, { spliceBicycle: 1 }))[0]).toMatchObject({ state: 'SPLICED', progressText: '' });
  });

  it('shows FULL GAME on the era III-V rows above a demo cap of 2', () => {
    const rows = buildSpliceRows(getAllTechViews(withBalances({}, { pr: 1e9 }), TECHNOLOGIES, 2), emptyResourceMap());
    expect(rows.filter((r) => r.era >= 3)).toHaveLength(10);
    expect(rows.filter((r) => r.era >= 3).every((r) => r.state === 'FULL GAME')).toBe(true);
    expect(rows.filter((r) => r.era <= 2).some((r) => r.state === 'FULL GAME')).toBe(false);
  });

  it('names a row with its state, cost, effect and the affordable flag', () => {
    const [bicycle] = rowsOf(withBalances({ me: 1000 }, { me: 15000 }));
    expect(bicycle?.ariaLabel).toBe('Bicycle, IN REACH, 900 ME, +5% automation, affordable');
    const [, organ] = rowsOf(withBalances({ me: 1000 }, { me: 15000 }));
    expect(organ?.ariaLabel).toBe('Barrel Organ, DARK, 12K ME, Finds pay +1s, 15K / 120K LIFETIME ME');
  });

  it('builds the Splice detail from the world tooltip lines and the buy state', () => {
    const open = withBalances({ me: 1000 }, { me: 15000 });
    expect(buildSpliceDetail(getTechView(open, 'spliceBicycle'), open)).toMatchObject({
      title: 'SPLICE · BICYCLE', costText: '900 ME', effectText: '+5% automation', stateText: 'CLICK TO SPLICE',
      buyState: 'buy', buyLabel: 'PURCHASE — 900 ME', buyEnabled: true,
    });
    const poor = withBalances({}, { me: 15000 });
    expect(buildSpliceDetail(getTechView(poor, 'spliceBicycle'), poor)).toMatchObject({
      stateText: 'NEED 900 MORE ME', buyState: 'insufficient', buyLabel: 'INSUFFICIENT ME', buyEnabled: true,
    });
    const fresh = withBalances({});
    expect(buildSpliceDetail(getTechView(fresh, 'spliceBicycle'), fresh)).toMatchObject({
      stateText: 'LINE NOT IN REACH · 0 / 15K LIFETIME ME', buyState: 'locked', buyLabel: 'REQUIREMENTS UNMET', buyEnabled: false,
    });
    const woken = withBalances({}, { me: 15000 }, { spliceBicycle: 1 });
    expect(buildSpliceDetail(getTechView(woken, 'spliceBicycle'), woken)).toMatchObject({ stateText: 'SPLICED', buyState: 'owned', buyLabel: 'INSTALLED' });
    const capped = withBalances({}, { pr: 1e9 }, { boiler: 1 });
    expect(buildSpliceDetail(getTechView(capped, 'splicePump', TECHNOLOGIES, 2), capped)).toMatchObject({
      stateText: 'FULL GAME', buyState: 'demo', buyLabel: DEMO_TEXT.fullGameOnly, buyEnabled: false,
    });
  });

  it('matches the world tooltip lines (spliceTooltip) for every Splice in every state', () => {
    const cases: Array<[GameState, 2 | null]> = [
      [withBalances({}), null],
      [withBalances({ me: 1000 }, { me: 15000 }), null],
      [withBalances({}, { me: 15000 }), null],
      [withBalances({}, { ee: 1e9 }), null],
      [withBalances({}, { me: 15000 }, { spliceBicycle: 1 }), null],
      [withBalances({}, { pr: 1e9 }, { boiler: 1 }), 2],
    ];
    for (const [state, cap] of cases) {
      for (const view of getAllTechViews(state, TECHNOLOGIES, cap)) {
        if (!isSplice(view.def)) continue;
        const detail = buildSpliceDetail(view, state);
        expect([detail.title, detail.costText, detail.effectText, detail.stateText]).toEqual(spliceTooltip(view, spliceState(view), state));
      }
    }
    // A Splice whose era keystone is not owned names it (the tech line), once its lifetime is met.
    expect(buildSpliceDetail(getTechView(withBalances({}, { ee: 1e9 }), 'spliceRadio'), withBalances({}, { ee: 1e9 })).stateText)
      .toBe('LINE NOT IN REACH · GENERATOR FIRST');
  });

  it('selects the first affordable Splice, else the first row, and none without Splices', () => {
    expect(defaultSpliceSelection(viewsOf(withBalances({}, { me: 15000 })))).toBe('spliceBicycle');
    expect(defaultSpliceSelection(viewsOf(withBalances({ me: 1000 }, { me: 15000 })))).toBe('spliceBicycle');
    expect(defaultSpliceSelection(viewsOf(withBalances({})).filter((v) => !isSplice(v.def)))).toBeNull();
  });

  it('allows BUY MAX only on an available, affordable repeatable', () => {
    const rich = withBalances({ me: 1e9, ee: 1e9, pr: 1e9, rs: 1e9, xf: 1e9 }, { me: 1e9 });
    expect(buyMaxAllowed(getTechView(rich, 'gearRatio'))).toBe(true);
    expect(buyMaxAllowed(getTechView(withBalances({}), 'gearRatio'))).toBe(false);
    expect(buyMaxAllowed(getTechView(withBalances({ me: 1e9 }, {}, { gearRatio: 15 }), 'gearRatio'))).toBe(false);
    expect(getTechView(rich, 'copperWinding').status).toBe('locked');
    expect(buyMaxAllowed(getTechView(rich, 'copperWinding'))).toBe(false);
    // An affordable unlock (a Splice or any unlock) never takes BUY MAX.
    expect(buyMaxAllowed(getTechView(rich, 'spliceBicycle'))).toBe(false);
    expect(buildTechTreeView(viewsOf(rich).filter((v) => v.def.era === 1), rich.res, 'gearRatio', 1).detail?.buyMax).toBe(true);
  });
});

describe('demo edition views (WP21)', () => {
  // Era II reached (generator owned), era III and up above the demo cap of 2.
  const MID_RES: ResourceMap = { ...emptyResourceMap(), me: 5000, ee: 1200 };
  const mid = stateWith({
    res: MID_RES,
    techLevels: { ...createInitialState(0).techLevels, generatorBlueprint: 1, generator: 1 },
  });
  const capped = getAllTechViews(mid, TECHNOLOGIES, 2);

  it('reaches only eras I and II in the capped mid state', () => {
    expect(reachedEras(capped)).toEqual([1, 2]);
  });

  it('shows FULL GAME on the era III-V tabs above the cap', () => {
    const tabs = buildEraTabs(capped, MID_RES, 1);
    expect(tabs.slice(2)).toEqual([
      { era: 3, label: 'FULL GAME', reached: false, fullGame: true, selected: false, resourceText: '', affordable: 0, ariaLabel: 'ERA III · FULL GAME' },
      { era: 4, label: 'FULL GAME', reached: false, fullGame: true, selected: false, resourceText: '', affordable: 0, ariaLabel: 'ERA IV · FULL GAME' },
      { era: 5, label: 'FULL GAME', reached: false, fullGame: true, selected: false, resourceText: '', affordable: 0, ariaLabel: 'ERA V · FULL GAME' },
    ]);
  });

  it('keeps the tabs of the reached eras identical to the full game', () => {
    const tabs = buildEraTabs(capped, MID_RES, 1);
    const fullTabs = buildEraTabs(getAllTechViews(mid), MID_RES, 1);
    expect(tabs.slice(0, 2)).toEqual(fullTabs.slice(0, 2));
  });

  it('keeps SIGNAL ? and fullGame false on every tab without a cap', () => {
    const tabs = buildEraTabs(getAllTechViews(createInitialState(0)), emptyResourceMap(), 1);
    expect(tabs.map((tab) => tab.fullGame)).toEqual([false, false, false, false, false]);
    expect(tabs.slice(1).map((tab) => tab.label)).toEqual(['SIGNAL ?', 'SIGNAL ?', 'SIGNAL ?', 'SIGNAL ?']);
  });

  it('marks a demo-locked tech as FULL GAME ONLY and not buyable', () => {
    const views = capped.filter((v) => v.def.era === 3);
    const view = buildTechTreeView(views, MID_RES, 'boiler', 3);
    expect(view.detail?.buyState).toBe('demo');
    expect(view.detail?.buyLabel).toBe('FULL GAME ONLY');
    expect(view.detail?.buyEnabled).toBe(false);
  });

  it('gives the demo failure text the FULL GAME ONLY copy', () => {
    expect(purchaseFailureText('demo', 0)).toBe(DEMO_TEXT.fullGameOnly);
  });
});

describe('xf label reveal (WP13 D4)', () => {
  afterEach(() => {
    setRevealed(false);
  });

  // wornMotor (baseCost 40) priced in xf, era 1 so the era-I tree shows it.
  const techs: Record<TechId, TechDefinition> = {
    ...TECHNOLOGIES,
    wornMotor: { ...TECHNOLOGIES.wornMotor, costRes: 'xf' },
  };
  const viewsFor = (state: GameState): TechView[] =>
    getAllTechViews(state, techs).filter((v) => v.def.era === 1);
  const rich = stateWith({ res: { ...emptyResourceMap(), me: 1e9, xf: 0 } });

  it('shows RF in cost, buy, shortfall and aria texts once revealed', () => {
    setRevealed(true);
    const view = buildTechTreeView(viewsFor(rich), rich.res, 'wornMotor', 1);
    expect(view.detail?.costText).toBe('40 RF');
    expect(view.detail?.buyLabel).toBe('INSUFFICIENT RF');
    expect(view.detail?.shortfallText).toBe('NEED 40 MORE RF');
    expect(view.nodes.find((n) => n.id === 'wornMotor')?.costText).toBe('40 RF');
    expect(view.nodes.find((n) => n.id === 'wornMotor')?.ariaLabel).toContain('cost 40 RF');
  });

  it('keeps ??? in the same texts while unrevealed', () => {
    const view = buildTechTreeView(viewsFor(rich), rich.res, 'wornMotor', 1);
    expect(view.detail?.costText).toBe('40 ???');
    expect(view.detail?.buyLabel).toBe('INSUFFICIENT ???');
    expect(view.detail?.shortfallText).toBe('NEED 40 MORE ???');
  });

  it('shows RF in the era V header and tab once revealed', () => {
    setRevealed(true);
    const view = buildTechTreeView([], emptyResourceMap(), null, 5);
    expect(view.headerText).toBe('0 RF');
    const eraFive: Record<TechId, TechDefinition> = {
      ...TECHNOLOGIES,
      wornMotor: { ...TECHNOLOGIES.wornMotor, era: 5, costRes: 'xf' },
    };
    const tabs = buildEraTabs(getAllTechViews(createInitialState(0), eraFive), emptyResourceMap(), 1);
    expect(tabs.find((tab) => tab.era === 5)?.label).toBe('ERA V · RF');
  });

  it('shows RF in the insufficient failure text once revealed', () => {
    setRevealed(true);
    expect(purchaseFailureText('insufficient', 5, 'xf')).toBe('NEED 5 MORE RF');
    setRevealed(false);
    expect(purchaseFailureText('insufficient', 5, 'xf')).toBe('NEED 5 MORE ???');
  });
});
describe('part tier text in the tree detail panel (WP22 A6)', () => {
  /** Initial state with one tech level set on top. */
  function stateAt(id: TechId, level: number): GameState {
    const base = createInitialState(0);
    return { ...base, techLevels: { ...base.techLevels, [id]: level } };
  }

  /** Detail level line of `id` at `level`, built from its era as the tree panel does. */
  function detailLevelOf(id: TechId, level: number): string | undefined {
    const era = TECHNOLOGIES[id].era;
    const views = getAllTechViews(stateAt(id, level)).filter((v) => v.def.era === era);
    return buildTechTreeView(views, emptyResourceMap(), id, era).detail?.levelText;
  }

  it('motorTuning at level 7 reads MK II with the MK III threshold', () => {
    expect(detailLevelOf('motorTuning', 7)).toBe('LV 7/25 · MK II — MK III AT 10');
  });

  it('motorTuning at level 25 reads the top tier', () => {
    expect(detailLevelOf('motorTuning', 25)).toBe('LV 25/25 · MK V AS BUILT');
  });

  it('gearRatio at level 1 reads MK I with the MK II threshold', () => {
    expect(detailLevelOf('gearRatio', 1)).toBe('LV 1/15 · MK I — MK II AT 6');
  });

  it('gearRatio at level 15 reads the top of a three-tier track', () => {
    expect(detailLevelOf('gearRatio', 15)).toBe('LV 15/15 · MK III AS BUILT');
  });

  it('uncapped mainsBackfeed keeps the infinity cap and reads MK I', () => {
    expect(detailLevelOf('mainsBackfeed', 4)).toBe('LV 4/∞ · MK I — MK II AT 10');
  });

  it('a tracked part at level 0 shows no tier mark', () => {
    expect(detailLevelOf('gearRatio', 0)).toBe('LV 0/15');
  });

  it('an untracked repeatable keeps the plain level text', () => {
    expect(detailLevelOf('horizonField', 3)).toBe('LV 3/40');
  });

  it('unlocks and milestones keep their plain words', () => {
    expect(detailLevelOf('wornMotor', 1)).toBe('INSTALLED');
    expect(detailLevelOf('generatorBlueprint', 1)).toBe('ACHIEVED');
  });

  it('the node card keeps LV n/max on a tracked tech', () => {
    const view = buildTechTreeView(eraOneViewsOf(stateAt('motorTuning', 7)), emptyResourceMap(), 'motorTuning', 1);
    const node = view.nodes.find((n) => n.id === 'motorTuning');
    expect(node?.levelText).toBe('LV 7/25');
    expect(node?.ariaLabel).not.toContain('MK');
    expect(view.detail?.levelText).toBe('LV 7/25 · MK II — MK III AT 10');
  });
});
