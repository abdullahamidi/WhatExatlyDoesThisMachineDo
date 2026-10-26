import { PALETTE } from './palette';
import type { TechId } from './types';

// New-cycle prestige data (WP14, C1). Pure data: numbers, ids, texts and art frames only. Tunable values are marked.

export const PERK_IDS = ['muscleMemory', 'residualCharge', 'longSilence', 'servoRecall', 'ledger'] as const;   // = ui.perks frame order
export type PerkId = typeof PERK_IDS[number];

export type PerkEffect =
  | { type: 'startLevels'; levels: Partial<Record<TechId, number>> }   // applied as max(level, n): at cycle start AND at purchase
  | { type: 'convertPct'; percent: number }                           // every `convert` amount × (1 + p/100)
  | { type: 'offlineHours'; hours: number }                           // offline cap
  | { type: 'autoClick'; perSecond: number }                          // automatic cranks (counts offline)
  | { type: 'costMult'; techIds: readonly TechId[]; factor: number }; // baseCost × factor

export interface PerkDefinition { id: PerkId; name: string; description: string; cost: number; icon: number; effect: PerkEffect }

// Perk table. Costs are Echo budgets (spending never lowers the Echo bonus). Icons = frame index in perks.png.
export const PERKS: Readonly<Record<PerkId, PerkDefinition>> = {
  muscleMemory: {
    id: 'muscleMemory', name: 'Muscle Memory', description: 'Each new cycle starts with Worn Motor 1 and Gear Ratio 3.',
    cost: 1, icon: 0, effect: { type: 'startLevels', levels: { wornMotor: 1, gearRatio: 3 } },
  },
  residualCharge: {
    id: 'residualCharge', name: 'Residual Charge', description: 'Every converter yields 50 % more.',
    cost: 2, icon: 1, effect: { type: 'convertPct', percent: 50 },
  },
  longSilence: {
    id: 'longSilence', name: 'Long Silence', description: 'Offline cap +4 hours.',
    cost: 2, icon: 2, effect: { type: 'offlineHours', hours: 4 },
  },
  servoRecall: {
    id: 'servoRecall', name: 'Servo Recall', description: 'Automatic crank: +1 click per second, offline too.',
    cost: 3, icon: 3, effect: { type: 'autoClick', perSecond: 1 },
  },
  ledger: {
    id: 'ledger', name: 'Ledger', description: 'Keystone converters (Generator to Null Chamber) cost half.',
    cost: 3, icon: 4, effect: { type: 'costMult', techIds: ['generator', 'boiler', 'resonatorSpire', 'nullChamber'], factor: 0.5 },
  },
};

export const PERK_LIST: readonly PerkDefinition[] = PERK_IDS.map((id) => PERKS[id]);

// Echo formula (tunable): base + one per threshold reached by this cycle's lifetime Restoration Flux.
// Bonus = allPctPerEcho × min(echoesEarned, maxCountedEchoes) percent on every per-second rate (clicks unaffected).
// WP25: 30 -> 15 % per Echo. WHY: the faster passive economy would otherwise push cycle 2 out of its 0.50-0.65 pace band.
export const ECHO_RULES = { base: 3, bonusAtXf: [2e9, 8e9, 3.2e10], allPctPerEcho: 15, maxCountedEchoes: 30 } as const;

// Starting tech (always level 1) that carries the memory effects (rateMult, autoClick, offline) in the derived tech table.
export const MEMORY_SOURCE_TECH = 'handCrank' as const;

// Cycle label: number shown = base + cycle − 1 (cycle 1 -> 0042, cycle 2 -> 0043), zero-padded to `digits`.
export const CYCLE_LABEL = { prefix: 'CYCLE ', base: 42, digits: 4 } as const;

// New-cycle white transition (ART §7). Times in ms; `reduced` is used when reduced motion is on.
// maxStepMs caps one frame's clock step (tab switch, GC stall) so a long frame never skips the peak and end at once.
export const CYCLE_TRANSITION = {
  color: PALETTE.steam, inMs: 800, outMs: 1500, reduced: { inMs: 500, outMs: 500 }, maxStepMs: 250,
} as const;

// Memory UI sheets (ART §8). perks.png = 5 frames of 32², perk-slot.png = 3 frames of 36², drawn at `scale`.
// beginIcon = ui.icons16 frame on the cycle confirm BEGIN button.
export const PRESTIGE_ART = {
  echo: 'assets/ui/echo.png', perks: 'assets/ui/perks.png', perkSlot: 'assets/ui/perk-slot.png',
  perkFrame: 32, slotFrame: 36, slotInset: 2, scale: 2, slot: { locked: 0, affordable: 1, owned: 2 }, beginIcon: 1,
} as const;

const KEPT_LINES: readonly string[] = ['Echoes and Memory perks', 'Settings', 'Stats and achievements'];
const RESET_LINES: readonly string[] = ['Machine, resources and tech levels', 'Finale replays from the start'];

export const PRESTIGE_TEXT = {
  tab: 'MEMORY',
  blocked: 'Engage the primary function first.',
  busy: 'Cycle in progress.',
  empty: 'NO CYCLE RECORDED.',
  owned: 'OWNED',
  buy: 'RECALL',
  cost: 'COST',              // status `COST 2 ECHOES`
  need: 'NEED',              // status `NEED 2 ECHOES`
  echoes: 'ECHOES',          // header `ECHOES 3 (+45% ALL/S)`, gain `+3 ECHOES`
  unspent: 'UNSPENT',        // header `UNSPENT 1`
  allPerSecond: 'ALL/S',     // bonus suffix `(+45% ALL/S)`
  nextCycle: 'NEXT CYCLE',   // panel line once the run is revealed
  begin: 'BEGIN',            // dialog title `BEGIN CYCLE 0043?` (view appends `?`), button `BEGIN CYCLE 0043`
  cancel: 'CANCEL',
  echoAt: '+1 ECHO AT',      // next-threshold hint `+1 ECHO AT 2B RF`
  keptTitle: 'KEPT',
  resetTitle: 'RESET',
  kept: KEPT_LINES,
  reset: RESET_LINES,
} as const;
