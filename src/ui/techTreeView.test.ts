import { describe, it, expect, afterEach } from 'vitest';
import {
  TECH_TREE_FIT,
  TECH_TREE_LAYOUT,
  buildEraTabs,
  buildTechTreeView,
  defaultSelection,
  edgePath,
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
import { getAllTechViews, getTechView, createInitialState, emptyResourceMap } from '../simulation';
import { TECHNOLOGIES } from '../data/technologies';
import { DEMO_TEXT } from '../data/demo';
import type { GameState, ResourceMap, TechDefinition, TechId, TechView } from '../data/types';
import { TECH_IDS } from '../data/types';
import { setDefaultNotation } from '../utils/format';
import { setRevealed } from './revealRules';

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
      expect(view.nodes).toHaveLength(9);
      for (const node of view.nodes) {
        const def = TECHNOLOGIES[node.id];
        expect({ x: node.x, y: node.y }).toEqual(techNodePosition(def.tree));
        expect(node.width).toBe(TECH_TREE_LAYOUT.nodeWidth);
        expect(node.height).toBe(TECH_TREE_LAYOUT.nodeHeight);
      }
    });

    it('computes the canvas size from the tree extents', () => {
      expect(view.width).toBe(812);
      expect(view.height).toBe(296);
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
        [1, 812],
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

  it('uncapped mainsBackfeed keeps the infinity cap and reads MK II', () => {
    expect(detailLevelOf('mainsBackfeed', 4)).toBe('LV 4/∞ · MK II — MK III AT 7');
  });

  it('a tracked part at level 0 shows no tier mark', () => {
    expect(detailLevelOf('gearRatio', 0)).toBe('LV 0/15');
  });

  it('an untracked repeatable keeps the plain level text', () => {
    expect(detailLevelOf('horizonField', 3)).toBe('LV 3/20');
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
