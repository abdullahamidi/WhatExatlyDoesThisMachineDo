import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { GameState, TechId } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import { GameSession } from './GameSession';
import { createInitialState } from './state';

// WP21 demo cap: a session with maxEra 2 (Substation Blueprint, era II) never owns era-III+ progress.

const HOUR_MS = 3_600_000;
const PR_RS_XF = ['pr', 'rs', 'xf'] as const;

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// Substation Blueprint owned and EE to spare: the era-III Boiler is affordable on the full game only.
const richState = (): GameState => {
  const s = withLevels({ substationBlueprint: 1 });
  return { ...s, res: { ...s.res, ee: 1e9 }, lifetime: { ...s.lifetime, ee: 1e9 } };
};

// Late era-II run with era-III+ levels and pr/rs/xf stock, as a full-game save might hold it.
const lateEraTwo = (): GameState => {
  const s = withLevels(
    {
      handCrank: 1,
      primaryFunction: 1,
      wornMotor: 1,
      generatorBlueprint: 1,
      generator: 3,
      copperWinding: 5,
      substationBlueprint: 1,
      boiler: 1,
      resonatorSpire: 1,
    },
    { createdAt: 0, lastSimTime: 0 },
  );
  const stock = { me: 1e6, ee: 1e6, pr: 1e6, rs: 1e6, xf: 1e6 };
  return { ...s, res: { ...s.res, ...stock }, lifetime: { ...s.lifetime, ...stock } };
};

// Ids of every purchase, unlock and milestone event, in emission order.
const watch = (session: GameSession): TechId[] => {
  const ids: TechId[] = [];
  session.on('purchase', (p) => ids.push(p.id));
  session.on('unlock', (p) => ids.push(p.id));
  session.on('milestone', (p) => ids.push(p.id));
  return ids;
};

describe('GameSession demo cap (WP21)', () => {
  describe('construction', () => {
    it('clamps era-III+ levels of the given state and exposes the cap', () => {
      const state = withLevels({ substationBlueprint: 1, boiler: 1, resonatorSpire: 1 });
      const session = new GameSession({ state, maxEra: 2, now: () => 0 });
      expect(session.state.techLevels.boiler).toBe(0);
      expect(session.state.techLevels.resonatorSpire).toBe(0);
      expect(session.state.techLevels.substationBlueprint).toBe(1);
      expect(session.maxEra).toBe(2);
      expect(state.techLevels.boiler).toBe(1); // the input snapshot is never mutated
    });

    it('a default session has no cap and keeps its era-III levels', () => {
      const state = withLevels({ substationBlueprint: 1, boiler: 1, resonatorSpire: 1 });
      const session = new GameSession({ state, now: () => 0 });
      expect(session.maxEra).toBeNull();
      expect(session.state.techLevels.boiler).toBe(1);
      expect(session.state.techLevels.resonatorSpire).toBe(1);
    });
  });

  describe('purchase', () => {
    it('refuses an era-III tech with reason demo, and changes and emits nothing', () => {
      const session = new GameSession({ state: richState(), maxEra: 2, now: () => 0 });
      const events = watch(session);
      const revision = session.revision;
      expect(session.purchase('boiler')).toEqual({ ok: false, reason: 'demo' });
      expect(events).toEqual([]);
      expect(session.revision).toBe(revision);
      expect(session.state.techLevels.boiler).toBe(0);
    });

    it('buys the same tech on the full game', () => {
      const session = new GameSession({ state: richState(), now: () => 0 });
      const events = watch(session);
      expect(session.purchase('boiler').ok).toBe(true);
      expect(session.state.techLevels.boiler).toBe(1);
      expect(events).toContain('boiler');
    });
  });

  describe('views', () => {
    it('reports an era-III tech as demo-locked and locked, though it is affordable on the full game', () => {
      const full = new GameSession({ state: richState(), now: () => 0 });
      expect(full.getTechView('boiler').affordable).toBe(true);

      const cap = new GameSession({ state: richState(), maxEra: 2, now: () => 0 });
      const view = cap.getTechView('boiler');
      expect(view.demoLocked).toBe(true);
      expect(view.status).toBe('locked');
      expect(view.affordable).toBe(false);
    });

    it('lists no affordable era-III+ view at the cap', () => {
      const session = new GameSession({ state: richState(), maxEra: 2, now: () => 0 });
      const views = session.getAllTechViews();
      expect(views.some((v) => v.def.era > 2 && v.demoLocked)).toBe(true);
      expect(views.filter((v) => v.def.era > 2 && v.affordable)).toEqual([]);
    });

    it('marks no tech demo-locked on the full game', () => {
      const session = new GameSession({ state: richState(), now: () => 0 });
      expect(session.getAllTechViews().some((v) => v.demoLocked)).toBe(false);
    });
  });

  describe('time at the cap', () => {
    it('an 8 h offline catch-up keeps era-II automation and clears era-III+ progress and pr/rs/xf', () => {
      const session = new GameSession({ state: lateEraTwo(), maxEra: 2, now: () => 0 });
      const report = session.applyOffline(session.state.lastSimTime + 8 * HOUR_MS);
      expect(report.gained.me).toBeGreaterThan(0);

      for (const id of TECH_IDS) {
        if (TECHNOLOGIES[id].era > 2) expect(session.state.techLevels[id]).toBe(0);
      }
      for (const r of PR_RS_XF) {
        expect(session.state.res[r]).toBe(0);
        expect(session.state.lifetime[r]).toBe(0);
      }
      for (const r of RESOURCE_IDS) {
        expect(Number.isFinite(session.state.res[r])).toBe(true);
        expect(Number.isFinite(session.state.lifetime[r])).toBe(true);
      }
    });

    it('a one-second update at the cap buys and unlocks nothing above the cap', () => {
      const session = new GameSession({ state: lateEraTwo(), maxEra: 2, now: () => 0 });
      session.applyOffline(0);
      const events = watch(session);
      session.update(1000);
      expect(events.filter((id) => TECHNOLOGIES[id].era > 2)).toEqual([]);
      for (const id of TECH_IDS) {
        if (TECHNOLOGIES[id].era > 2) expect(session.state.techLevels[id]).toBe(0);
      }
    });
  });
});
