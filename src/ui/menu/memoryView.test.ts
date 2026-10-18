import { describe, it, expect } from 'vitest';
import { buildMemoryView } from './memoryView';
import type { MemoryCard, MemoryView } from './memoryView';
import { PERK_IDS, PERKS, PRESTIGE_ART } from '../../data/prestige';
import type { PerkId } from '../../data/prestige';
import type { PrestigeState } from '../../data/types';
import type { CyclePreview } from '../../simulation/prestige';

const NEXT: CyclePreview = {
  allowed: true, nextCycle: 2, label: 'CYCLE 0043', echoesGained: 3, echoesAfter: 6, bonusPctAfter: 180, nextBonusXf: 2e9,
};

function prestige(echoesEarned: number, perks: PerkId[] = [], cycle = 1): PrestigeState {
  return { cycle, echoesEarned, perks };
}

function cardOf(view: MemoryView, id: PerkId): MemoryCard {
  const found = view.cards.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no card for ${id}`);
  return found;
}

describe('buildMemoryView: empty state', () => {
  it('no Echo and not revealed: only the NO CYCLE RECORDED. message, no cards', () => {
    const view = buildMemoryView(prestige(0), NEXT, false);
    expect(view.empty).toBe(true);
    expect(view.message).toBe('NO CYCLE RECORDED.');
    expect(view.cards).toEqual([]);
  });

  it('no Echo but revealed: not empty, five cards and the next-cycle line', () => {
    const view = buildMemoryView(prestige(0), NEXT, true);
    expect(view.empty).toBe(false);
    expect(view.message).toBe('');
    expect(view.cards).toHaveLength(5);
    expect(view.nextCycleText).toBe('NEXT CYCLE: CYCLE 0043 · +3 ECHOES');
  });

  it('Echoes earned and not revealed: not empty, no next-cycle line', () => {
    const view = buildMemoryView(prestige(3), NEXT, false);
    expect(view.empty).toBe(false);
    expect(view.message).toBe('');
    expect(view.nextCycleText).toBeNull();
    expect(view.cards).toHaveLength(5);
  });
});

describe('buildMemoryView: header', () => {
  it('3 Echoes, nothing owned: ECHOES 3 (+90% ALL/S), UNSPENT 3, CYCLE 0042', () => {
    const view = buildMemoryView(prestige(3), NEXT, false);
    expect(view.echoesText).toBe('ECHOES 3 (+90% ALL/S)');
    expect(view.unspentText).toBe('UNSPENT 3');
    expect(view.cycleText).toBe('CYCLE 0042');
  });

  it('bonus counts earned Echoes and is capped at 30 counted Echoes', () => {
    expect(buildMemoryView(prestige(40), NEXT, false).echoesText).toBe('ECHOES 40 (+900% ALL/S)');
    expect(buildMemoryView(prestige(0, [], 1), NEXT, true).echoesText).toBe('ECHOES 0 (+0% ALL/S)');
  });

  it('cycle 2 shows CYCLE 0043', () => {
    expect(buildMemoryView(prestige(3, [], 2), NEXT, false).cycleText).toBe('CYCLE 0043');
  });

  it('spending does not lower the bonus; unspent drops', () => {
    const view = buildMemoryView(prestige(3, ['residualCharge']), NEXT, false);
    expect(view.echoesText).toBe('ECHOES 3 (+90% ALL/S)');
    expect(view.unspentText).toBe('UNSPENT 1');
  });
});

describe('buildMemoryView: cards', () => {
  it('cards follow PERK_IDS order', () => {
    const view = buildMemoryView(prestige(3), NEXT, false);
    expect(view.cards.map((c) => c.id)).toEqual([...PERK_IDS]);
  });

  it('3 Echoes, nothing owned: all five affordable, RECALL enabled, COST text', () => {
    const view = buildMemoryView(prestige(3), NEXT, false);
    for (const card of view.cards) {
      expect(card.status).toBe('affordable');
      expect(card.canBuy).toBe(true);
      expect(card.buttonText).toBe('RECALL');
      expect(card.slot.frameIndex).toBe(PRESTIGE_ART.slot.affordable);
    }
    expect(cardOf(view, 'muscleMemory').statusText).toBe('COST 1 ECHOES');
    expect(cardOf(view, 'residualCharge').statusText).toBe('COST 2 ECHOES');
    expect(cardOf(view, 'servoRecall').statusText).toBe('COST 3 ECHOES');
    expect(cardOf(view, 'ledger').ariaLabel).toBe('Ledger, COST 3 ECHOES, 3');
  });

  it('Residual Charge owned: OWNED, no button, owned frame; locked perks show NEED with the shortfall', () => {
    const view = buildMemoryView(prestige(3, ['residualCharge']), NEXT, false);
    const residual = cardOf(view, 'residualCharge');
    expect(residual.status).toBe('owned');
    expect(residual.statusText).toBe('OWNED');
    expect(residual.buttonText).toBeNull();
    expect(residual.canBuy).toBe(false);
    expect(residual.slot.frameIndex).toBe(PRESTIGE_ART.slot.owned);

    const muscle = cardOf(view, 'muscleMemory');
    expect(muscle.status).toBe('affordable');
    expect(muscle.canBuy).toBe(true);

    const long = cardOf(view, 'longSilence');
    expect(long.status).toBe('locked');
    expect(long.statusText).toBe('NEED 1 ECHOES');
    expect(long.canBuy).toBe(false);
    expect(long.buttonText).toBe('RECALL');
    expect(long.slot.frameIndex).toBe(PRESTIGE_ART.slot.locked);

    expect(cardOf(view, 'servoRecall').statusText).toBe('NEED 2 ECHOES');
    expect(cardOf(view, 'ledger').statusText).toBe('NEED 2 ECHOES');
  });

  it('all five owned: every card OWNED, no button, unspent 0', () => {
    const view = buildMemoryView(prestige(11, [...PERK_IDS]), NEXT, false);
    expect(view.unspentText).toBe('UNSPENT 0');
    expect(view.echoesText).toBe('ECHOES 11 (+330% ALL/S)');
    for (const card of view.cards) {
      expect(card.statusText).toBe('OWNED');
      expect(card.buttonText).toBeNull();
      expect(card.canBuy).toBe(false);
      expect(card.slot.frameIndex).toBe(PRESTIGE_ART.slot.owned);
    }
  });

  it('aria label is name, status, cost', () => {
    const view = buildMemoryView(prestige(3), NEXT, false);
    expect(cardOf(view, 'residualCharge').ariaLabel).toBe('Residual Charge, COST 2 ECHOES, 2');
  });

  it('icon frame comes from the perk definition; sheet and size are the perk art', () => {
    const view = buildMemoryView(prestige(3), NEXT, false);
    for (const card of view.cards) {
      expect(card.icon.frameIndex).toBe(PERKS[card.id].icon);
      expect(card.icon.sheet).toBe(PRESTIGE_ART.perks);
      expect(card.icon.box).toBe(PRESTIGE_ART.perkFrame * PRESTIGE_ART.scale);
    }
    const ledger = cardOf(view, 'ledger');
    expect(ledger.icon.bgPosition).toBe('-256px 0px');
    expect(ledger.icon.bgSize).toBe('320px 64px');
  });

  it('slot sprite uses the slot sheet with 3 frames', () => {
    const view = buildMemoryView(prestige(3), NEXT, false);
    const slot = cardOf(view, 'muscleMemory').slot;
    expect(slot.sheet).toBe(PRESTIGE_ART.perkSlot);
    expect(slot.box).toBe(PRESTIGE_ART.slotFrame * PRESTIGE_ART.scale);
    expect(slot.bgSize).toBe('216px 72px');
  });
});

describe('buildMemoryView: revealed next cycle and sprites', () => {
  it('revealed: next-cycle line uses the preview label and gain', () => {
    const view = buildMemoryView(prestige(3), NEXT, true);
    expect(view.nextCycleText).toBe('NEXT CYCLE: CYCLE 0043 · +3 ECHOES');
  });

  it('echo icon is the 32 px echo sheet at scale 2', () => {
    const view = buildMemoryView(prestige(3), NEXT, false);
    expect(view.echo.sheet).toBe(PRESTIGE_ART.echo);
    expect(view.echo.box).toBe(64);
    expect(view.echo.bgSize).toBe('64px 64px');
  });
});
