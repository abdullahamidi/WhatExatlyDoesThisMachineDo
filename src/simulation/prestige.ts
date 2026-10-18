import { TECH_IDS } from '../data/types';
import type { Effect, GameState, PrestigeState, TechDefinition, TechId } from '../data/types';
import { CYCLE_LABEL, ECHO_RULES, MEMORY_SOURCE_TECH, PERKS, PERK_IDS } from '../data/prestige';
import type { PerkId } from '../data/prestige';
import { createInitialState } from './state';
import { isRevealed } from './progression/ending';

// Prestige logic (WP14, C2). Pure: no clock, no storage, no randomness, never mutates an input.
// Echoes are earned once per new cycle from the finished run's lifetime xf. Spending them buys
// Memory perks; the bonus counts EARNED Echoes, so spending never lowers it (D1).

/** Balance-rule shape. Defaults to the data table; tests may pass a variant. */
export interface EchoRules {
  base: number;
  bonusAtXf: readonly number[];
  allPctPerEcho: number;
  maxCountedEchoes: number;
}

/** Fresh-game prestige: cycle 1, no Echoes, no perks. */
export const DEFAULT_PRESTIGE: PrestigeState = { cycle: 1, echoesEarned: 0, perks: [] };

export type PerkStatus = 'owned' | 'affordable' | 'locked';

export type BuyPerkResult =
  | { ok: true; prestige: PrestigeState }
  | { ok: false; reason: 'owned' | 'insufficient' };

export interface CyclePreview {
  allowed: boolean;
  nextCycle: number;
  label: string;
  echoesGained: number;
  echoesAfter: number;
  bonusPctAfter: number;
  nextBonusXf: number | null;
}

/** Earned Echoes that count toward the bonus (capped). Non-finite or negative counts as zero. */
function countedEchoes(earned: number, rules: EchoRules): number {
  if (!Number.isFinite(earned) || earned <= 0) return 0;
  return Math.min(earned, rules.maxCountedEchoes);
}

/** Echoes granted by a finished run: base plus one per threshold the lifetime xf has reached. */
export function echoesForCycle(lifetimeXf: number, rules: EchoRules = ECHO_RULES): number {
  if (!Number.isFinite(lifetimeXf) || lifetimeXf < 0) return rules.base;
  let reached = 0;
  for (const threshold of rules.bonusAtXf) {
    if (threshold <= lifetimeXf) reached += 1;
  }
  return rules.base + reached;
}

/** Sum of the costs of the owned perks. */
export function spentEchoes(p: PrestigeState): number {
  let total = 0;
  for (const id of p.perks) total += PERKS[id].cost;
  return total;
}

/** Earned Echoes not yet spent on perks. */
export function unspentEchoes(p: PrestigeState): number {
  return p.echoesEarned - spentEchoes(p);
}

/** Global per-second multiplier from earned Echoes: 1 + pct/100 x counted Echoes. */
export function echoMultiplier(p: PrestigeState, rules: EchoRules = ECHO_RULES): number {
  return 1 + (rules.allPctPerEcho / 100) * countedEchoes(p.echoesEarned, rules);
}

/** Owned, affordable (unspent >= cost) or locked. */
export function perkStatus(p: PrestigeState, id: PerkId): PerkStatus {
  if (p.perks.includes(id)) return 'owned';
  return unspentEchoes(p) >= PERKS[id].cost ? 'affordable' : 'locked';
}

/** Buys one perk. Owned or unaffordable -> failure, input untouched. Perks stay in PERK_IDS order. */
export function buyPerk(p: PrestigeState, id: PerkId): BuyPerkResult {
  if (p.perks.includes(id)) return { ok: false, reason: 'owned' };
  if (unspentEchoes(p) < PERKS[id].cost) return { ok: false, reason: 'insufficient' };
  const perks = PERK_IDS.filter((x) => x === id || p.perks.includes(x));
  return { ok: true, prestige: { ...p, perks } };
}

/**
 * Tech table for the current prestige. Returns `base` itself when the Echo multiplier is 1 and no
 * perk is owned (era I-V stay bit-identical). Otherwise a copy where only the changed defs are
 * replaced; `base` is never mutated.
 */
export function cycleTechs(
  base: Record<TechId, TechDefinition>,
  p: PrestigeState,
): Record<TechId, TechDefinition> {
  const multiplier = echoMultiplier(p);
  if (multiplier === 1 && p.perks.length === 0) return base;

  let convertFactor = 1;
  const costFactor: Partial<Record<TechId, number>> = {};
  const memoryEffects: Effect[] = [];
  if (multiplier !== 1) memoryEffects.push({ type: 'rateMult', factor: multiplier, res: 'all' });

  for (const id of PERK_IDS) {
    if (!p.perks.includes(id)) continue;
    const effect = PERKS[id].effect;
    switch (effect.type) {
      case 'convertPct':
        convertFactor *= 1 + effect.percent / 100;
        break;
      case 'costMult':
        for (const techId of effect.techIds) {
          costFactor[techId] = (costFactor[techId] ?? 1) * effect.factor;
        }
        break;
      case 'offlineHours':
        memoryEffects.push({ type: 'offlineHours', hours: effect.hours });
        break;
      case 'autoClick':
        memoryEffects.push({ type: 'autoClick', perSecond: effect.perSecond });
        break;
      case 'startLevels':
        break;
    }
  }

  const out: Record<TechId, TechDefinition> = { ...base };
  for (const id of TECH_IDS) {
    const def = base[id];
    const factor = costFactor[id];
    const scaleConverts = convertFactor !== 1 && def.effects.some((e) => e.type === 'convert');
    const addMemory = id === MEMORY_SOURCE_TECH && memoryEffects.length > 0;
    if (factor === undefined && !scaleConverts && !addMemory) continue;
    const effects: Effect[] = def.effects.map((e) =>
      e.type === 'convert' && convertFactor !== 1 ? { ...e, amount: e.amount * convertFactor } : e,
    );
    if (addMemory) effects.push(...memoryEffects);
    out[id] = {
      ...def,
      baseCost: factor === undefined ? def.baseCost : def.baseCost * factor,
      effects,
    };
  }
  return out;
}

/** Raises tech levels to the owned perks' start levels (max(level, n)). Same object when nothing changes. */
export function applyStartLevels(state: GameState, p: PrestigeState): GameState {
  const techLevels = { ...state.techLevels };
  let changed = false;
  for (const id of p.perks) {
    const effect = PERKS[id].effect;
    if (effect.type !== 'startLevels') continue;
    for (const techId of TECH_IDS) {
      const wanted = effect.levels[techId];
      if (wanted === undefined || wanted <= techLevels[techId]) continue;
      techLevels[techId] = wanted;
      changed = true;
    }
  }
  return changed ? { ...state, techLevels } : state;
}

/** Fresh run for the given prestige: initial state plus the start levels. */
export function newCycleState(nowMs: number, p: PrestigeState): GameState {
  return applyStartLevels(createInitialState(nowMs), p);
}

/** 'CYCLE 0042' for cycle 1, 'CYCLE 0043' for cycle 2. */
export function cycleLabel(cycle: number): string {
  const n = CYCLE_LABEL.base + cycle - 1;
  return CYCLE_LABEL.prefix + String(n).padStart(CYCLE_LABEL.digits, '0');
}

function isInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function freshDefault(): PrestigeState {
  return { ...DEFAULT_PRESTIGE, perks: [] };
}

/**
 * Lenient read of a stored prestige block. Never throws.
 * cycle: integer >= 1 else 1; echoesEarned: integer >= 0 else 0; perks: known, unique, PERK_IDS order;
 * while spent > earned the last perk is dropped.
 */
export function normalizePrestige(raw: unknown): PrestigeState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return freshDefault();
  const r = raw as { cycle?: unknown; echoesEarned?: unknown; perks?: unknown };

  const cycle = isInteger(r.cycle) && r.cycle >= 1 ? r.cycle : DEFAULT_PRESTIGE.cycle;
  const echoesEarned = isInteger(r.echoesEarned) && r.echoesEarned >= 0 ? r.echoesEarned : 0;

  const listed = new Set<unknown>(Array.isArray(r.perks) ? r.perks : []);
  let perks = PERK_IDS.filter((id) => listed.has(id));
  while (perks.length > 0 && perks.reduce((sum, id) => sum + PERKS[id].cost, 0) > echoesEarned) {
    perks = perks.slice(0, -1);
  }
  return { cycle, echoesEarned, perks };
}

/**
 * Pre-cycle screen data. `allowed` only once the run is revealed (WP13 isRevealed).
 * nextBonusXf: the next threshold above the current lifetime xf, null past the last one.
 */
export function cyclePreview(
  state: Pick<GameState, 'lifetime' | 'ending'>,
  p: PrestigeState,
  rules: EchoRules = ECHO_RULES,
): CyclePreview {
  const nextCycle = p.cycle + 1;
  const xf = state.lifetime.xf;
  const echoesGained = echoesForCycle(xf, rules);
  const echoesAfter = p.echoesEarned + echoesGained;
  const xfFloor = Number.isFinite(xf) && xf >= 0 ? xf : 0;
  return {
    allowed: isRevealed(state.ending),
    nextCycle,
    label: cycleLabel(nextCycle),
    echoesGained,
    echoesAfter,
    bonusPctAfter: rules.allPctPerEcho * countedEchoes(echoesAfter, rules),
    nextBonusXf: rules.bonusAtXf.find((t) => t > xfFloor) ?? null,
  };
}
