import { describe, it, expect } from 'vitest';
import {
  TECH_TREE_LAYOUT,
  buildTechTreeView,
  defaultSelection,
  edgePath,
  purchaseFailureText,
  techNodePosition,
} from './techTreeView';
import { getAllTechViews, createInitialState } from '../simulation';
import { TECHNOLOGIES } from '../data/technologies';
import type { GameState, TechView } from '../data/types';

function stateWith(overrides: Partial<GameState>): GameState {
  return { ...createInitialState(0), ...overrides };
}

function viewsOf(state: GameState): TechView[] {
  return getAllTechViews(state);
}

describe('techTreeView', () => {
  describe('initial state', () => {
    const views = viewsOf(createInitialState(0));
    const view = buildTechTreeView(views, 0, null);

    it('builds one node per tech at its tree position', () => {
      expect(view.nodes).toHaveLength(9);
      for (const node of view.nodes) {
        const def = TECHNOLOGIES[node.id];
        expect({ x: node.x, y: node.y }).toEqual(techNodePosition(def.tree));
        expect(node.width).toBe(TECH_TREE_LAYOUT.nodeWidth);
        expect(node.height).toBe(TECH_TREE_LAYOUT.nodeHeight);
      }
    });

    it('computes the canvas size from the tree extents', () => {
      expect(view.width).toBe(1112);
      expect(view.height).toBe(300);
      expect(view.width).toBe(
        TECH_TREE_LAYOUT.padding * 2 + 5 * TECH_TREE_LAYOUT.nodeWidth + 4 * TECH_TREE_LAYOUT.colGap,
      );
    });

    it('has 10 edges and only the crank edges are met', () => {
      expect(view.edges).toHaveLength(10);
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

    it('defaults the selection to gearRatio', () => {
      expect(defaultSelection(views)).toBe('gearRatio');
    });
  });

  describe('gearRatio purchase states', () => {
    it('is insufficient at ME 0 with a shortfall of 15', () => {
      const views = viewsOf(stateWith({ me: 0 }));
      const view = buildTechTreeView(views, 0, 'gearRatio');
      expect(view.detail?.buyState).toBe('insufficient');
      expect(view.detail?.shortfallText).toBe('NEED 15 MORE ME');
      expect(view.detail?.buyEnabled).toBe(true);
    });

    it('is buyable at ME 15 with the cost in the label', () => {
      const views = viewsOf(stateWith({ me: 15 }));
      const view = buildTechTreeView(views, 15, 'gearRatio');
      expect(view.detail?.buyState).toBe('buy');
      expect(view.detail?.buyLabel).toContain('15 ME');
      expect(view.detail?.buyEnabled).toBe(true);
      expect(view.detail?.shortfallText).toBeNull();
    });

    it('keeps gearRatio as default selection at ME 15', () => {
      expect(defaultSelection(viewsOf(stateWith({ me: 15 })))).toBe('gearRatio');
    });

    it('is maxed at level 15', () => {
      const state = stateWith({
        techLevels: { ...createInitialState(0).techLevels, gearRatio: 15 },
      });
      const view = buildTechTreeView(viewsOf(state), 0, 'gearRatio');
      const node = view.nodes.find((n) => n.id === 'gearRatio');
      expect(node?.levelText).toBe('LV 15/15');
      expect(view.detail?.statusLabel).toBe('MAXED');
      expect(view.detail?.buyState).toBe('maxed');
      expect(view.detail?.buyEnabled).toBe(false);
    });
  });

  describe('locked and special techs', () => {
    it('marks reinforcedCrank locked with the unmet Gear Ratio requirement', () => {
      const view = buildTechTreeView(viewsOf(createInitialState(0)), 0, 'reinforcedCrank');
      expect(view.detail?.buyState).toBe('locked');
      expect(view.detail?.statusLabel).toBe('LOCKED');
      expect(view.detail?.requirements).toContainEqual({ label: 'Gear Ratio Lv 3', met: false });
    });

    it('shows generatorBlueprint as automatic milestone', () => {
      const view = buildTechTreeView(viewsOf(createInitialState(0)), 0, 'generatorBlueprint');
      expect(view.detail?.buyState).toBe('automatic');
      expect(view.detail?.buyLabel).toBe('MILESTONE — AUTOMATIC');
      const node = view.nodes.find((n) => n.id === 'generatorBlueprint');
      expect(node?.milestone).toBe(true);
      expect(node?.kindLabel).toBe('MILESTONE');
      expect(view.detail?.requirements.some((r) => r.label.includes('lifetime ME'))).toBe(true);
    });

    it('shows handCrank as owned', () => {
      const view = buildTechTreeView(viewsOf(createInitialState(0)), 0, 'handCrank');
      expect(view.detail?.buyState).toBe('owned');
      expect(view.detail?.buyEnabled).toBe(false);
    });

    it('shows an achieved milestone as owned with ACHIEVED label', () => {
      const state = stateWith({
        techLevels: { ...createInitialState(0).techLevels, generatorBlueprint: 1 },
      });
      const view = buildTechTreeView(viewsOf(state), 0, 'generatorBlueprint');
      expect(view.detail?.buyState).toBe('owned');
      expect(view.detail?.buyLabel).toBe('ACHIEVED');
      expect(view.detail?.statusLabel).toBe('ACHIEVED');
    });
  });

  describe('selection and helpers', () => {
    it('returns null detail for an unselected tree', () => {
      expect(buildTechTreeView(viewsOf(createInitialState(0)), 0, null).detail).toBeNull();
    });

    it('marks the selected node', () => {
      const view = buildTechTreeView(viewsOf(createInitialState(0)), 0, 'gearRatio');
      const selected = view.nodes.filter((n) => n.selected).map((n) => n.id);
      expect(selected).toEqual(['gearRatio']);
    });

    it('formats purchase failure texts', () => {
      expect(purchaseFailureText('insufficient', 3.2)).toContain('4');
      expect(purchaseFailureText('insufficient', 3.2)).toBe('NEED 4 MORE ME');
      expect(purchaseFailureText('locked', 0)).toBe('REQUIREMENTS UNMET');
      expect(purchaseFailureText('maxed', 0)).toBe('MAXIMUM LEVEL');
      expect(purchaseFailureText('owned', 0)).toBe('ALREADY INSTALLED');
      expect(purchaseFailureText('notPurchasable', 0)).toBe('CANNOT BE PURCHASED');
    });

    it('falls back to handCrank when nothing is available', () => {
      const views = viewsOf(createInitialState(0)).map((v): TechView => ({
        ...v,
        status: 'purchased',
        affordable: false,
      }));
      expect(defaultSelection(views)).toBe('handCrank');
    });

    it('edge keys are from->to', () => {
      const view = buildTechTreeView(viewsOf(createInitialState(0)), 0, null);
      expect(view.edges.every((e) => e.key === `${e.from}->${e.to}`)).toBe(true);
    });
  });
});
