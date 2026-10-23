import { describe, it, expect } from 'vitest';
import { achievementCards, achievementInEdition, counterText, editionAchievements } from './achievementsView';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS, ACHIEVEMENT_LIST, UI_ART } from '../../data/achievements';
import type { AchievementDefinition } from '../../data/achievements';
import { ACHIEVEMENT_TEXT, BADGE_VIEW } from '../../data/notifications';
import type { AchievementsState } from '../../data/types';

const none: AchievementsState['unlocked'] = {};

// The 18 rows visible in the era-2 demo, in list order.
const DEMO_IDS = [
  'firstTurn', 'steadyHand', 'tireless', 'unrelenting', 'shiftWorker', 'wornMotor', 'fullStroke', 'blueprint',
  'tinkerer', 'engineer', 'eraElectric', 'noGrid', 'kilowatt', 'shortNap', 'longSilence', 'sevenDigits',
  'thirteenDigits', 'bigNumber',
] as const;

function withCondition(condition: AchievementDefinition['condition']): AchievementDefinition {
  return { ...ACHIEVEMENTS.firstTurn, condition };
}

describe('achievementCards: locked and unlocked', () => {
  it('returns one card per definition in definition order', () => {
    const cards = achievementCards(none);
    expect(cards.map((c) => c.id)).toEqual([...ACHIEVEMENT_IDS]);
  });

  it('locked card: silhouette sheet, lock icon, LOCKED status', () => {
    const card = achievementCards(none).find((c) => c.id === 'firstTurn');
    expect(card).toBeDefined();
    expect(card?.unlocked).toBe(false);
    expect(card?.locked).toBe(true);
    expect(card?.secretHidden).toBe(false);
    expect(card?.name).toBe('First Turn');
    expect(card?.description).toBe(ACHIEVEMENTS.firstTurn.description);
    expect(card?.statusText).toBe('LOCKED');
    expect(card?.badge.sheet).toBe(UI_ART.badgesLocked);
    expect(card?.lock).not.toBeNull();
    expect(card?.lock?.sheet).toBe(UI_ART.icons16);
    expect(card?.lock?.frameIndex).toBe(UI_ART.icon.lock);
  });

  it('unlocked card: colour sheet, no lock icon, LOGGED status', () => {
    const card = achievementCards({ firstTurn: 1 }).find((c) => c.id === 'firstTurn');
    expect(card?.unlocked).toBe(true);
    expect(card?.locked).toBe(false);
    expect(card?.statusText).toBe('LOGGED');
    expect(card?.badge.sheet).toBe(UI_ART.badges);
    expect(card?.lock).toBeNull();
  });

  it('badge frame index comes from the definition icon', () => {
    const cards = achievementCards(none);
    for (const card of cards) {
      expect(card.badge.frameIndex).toBe(ACHIEVEMENTS[card.id].icon);
    }
  });

  it('only the given ids are unlocked', () => {
    const cards = achievementCards({ firstTurn: 5, steadyHand: 6 });
    const unlockedIds = cards.filter((c) => c.unlocked).map((c) => c.id);
    expect(unlockedIds).toEqual(['firstTurn', 'steadyHand']);
  });

  it('an unknown id in the unlocked map does not create a card', () => {
    const cards = achievementCards({ nope: 1 } as AchievementsState['unlocked']);
    expect(cards).toHaveLength(ACHIEVEMENT_LIST.length);
  });
});

describe('achievementCards: secret rows', () => {
  it('locked secret: name ??? and description CLASSIFIED, real name hidden', () => {
    const card = achievementCards(none).find((c) => c.id === 'eraExotic');
    expect(card?.secretHidden).toBe(true);
    expect(card?.name).toBe(ACHIEVEMENT_TEXT.hiddenName);
    expect(card?.description).toBe(ACHIEVEMENT_TEXT.hiddenDescription);
    expect(card?.name).not.toBe(ACHIEVEMENTS.eraExotic.name);
    expect(card?.description).not.toBe(ACHIEVEMENTS.eraExotic.description);
    expect(card?.statusText).toBe('LOCKED');
    expect(card?.lock).not.toBeNull();
  });

  it('unlocked secret: real name and description shown', () => {
    const card = achievementCards({ eraExotic: 1 }).find((c) => c.id === 'eraExotic');
    expect(card?.secretHidden).toBe(false);
    expect(card?.name).toBe(ACHIEVEMENTS.eraExotic.name);
    expect(card?.description).toBe(ACHIEVEMENTS.eraExotic.description);
    expect(card?.statusText).toBe('LOGGED');
  });

  it('a non-secret row never hides its name', () => {
    const card = achievementCards(none).find((c) => c.id === 'tireless');
    expect(card?.secretHidden).toBe(false);
    expect(card?.name).toBe(ACHIEVEMENTS.tireless.name);
  });
});

describe('achievementCards: sprite geometry', () => {
  const frameBox = UI_ART.badgeFrame * BADGE_VIEW.scale;

  it('badge box is 24 px frame drawn at x2 (48 px)', () => {
    expect(frameBox).toBe(48);
    const card = achievementCards(none)[0];
    expect(card?.badge.box).toBe(48);
  });

  it('frame 0 sits at the origin of a 16-frame sheet', () => {
    const custom: AchievementDefinition = { ...ACHIEVEMENTS.firstTurn, icon: 0 };
    const card = achievementCards({ firstTurn: 1 }, [custom])[0];
    expect(card?.badge.bgPosition).toBe('0px 0px');
    expect(card?.badge.bgSize).toBe(`${BADGE_VIEW.badgeFrames * frameBox}px 48px`);
    expect(card?.badge.bgSize).toBe('768px 48px');
  });

  it('frame 15 is offset by 15 frames of 48 px', () => {
    const custom: AchievementDefinition = { ...ACHIEVEMENTS.firstTurn, icon: 15 };
    const card = achievementCards({ firstTurn: 1 }, [custom])[0];
    expect(card?.badge.frameIndex).toBe(15);
    expect(card?.badge.bgPosition).toBe('-720px 0px');
  });

  it('lock icon: frame 3 of a 5-frame 16 px sheet drawn at x1', () => {
    const card = achievementCards(none)[0];
    expect(card?.lock?.box).toBe(UI_ART.iconFrame * BADGE_VIEW.lockScale);
    expect(card?.lock?.bgPosition).toBe(`-${UI_ART.icon.lock * UI_ART.iconFrame}px 0px`);
    expect(card?.lock?.bgSize).toBe(`${BADGE_VIEW.iconFrames * UI_ART.iconFrame}px 16px`);
  });

  it('accepts a custom definition list', () => {
    const cards = achievementCards(none, [ACHIEVEMENTS.tireless]);
    expect(cards.map((c) => c.id)).toEqual(['tireless']);
  });
});

describe('counterText', () => {
  it('total is the 33 rows of the list', () => {
    expect(ACHIEVEMENT_LIST.length).toBe(33);
    expect(counterText(none)).toBe('0/33 LOGGED');
  });

  it('counts unlocked known ids', () => {
    expect(counterText({})).toBe('0/33 LOGGED');
    expect(counterText({ firstTurn: 1, steadyHand: 2 })).toBe('2/33 LOGGED');
  });

  it('ignores unknown ids', () => {
    expect(counterText({ nope: 1 } as AchievementsState['unlocked'])).toBe('0/33 LOGGED');
  });

  it('uses the given total', () => {
    expect(counterText({ firstTurn: 1 }, 4)).toBe('1/4 LOGGED');
  });

  it('counts only the given ids', () => {
    expect(counterText({ firstTurn: 1, restoration: 2 }, DEMO_IDS.length, DEMO_IDS)).toBe('1/18 LOGGED');
    expect(counterText({ firstTurn: 1, restoration: 2 })).toBe('2/33 LOGGED');
  });
});

describe('editionAchievements', () => {
  it('demo (maxEra 2) keeps the 18 era-2 rows in list order', () => {
    expect(editionAchievements(2).map((d) => d.id)).toEqual([...DEMO_IDS]);
  });

  it('full game (null) is the whole list, as a new array', () => {
    const all = editionAchievements(null);
    expect(all).toEqual(ACHIEVEMENT_LIST);
    expect(all).not.toBe(ACHIEVEMENT_LIST);
  });

  it('filters the given definitions', () => {
    expect(editionAchievements(2, [ACHIEVEMENTS.restoration, ACHIEVEMENTS.tireless]).map((d) => d.id)).toEqual(['tireless']);
  });
});

describe('achievementInEdition', () => {
  it('null cap keeps every row', () => {
    for (const def of ACHIEVEMENT_LIST) expect(achievementInEdition(def, null)).toBe(true);
  });

  it('tech: era above the cap is hidden, era at the cap is shown', () => {
    expect(achievementInEdition(ACHIEVEMENTS.eraThermal, 2)).toBe(false);
    expect(achievementInEdition(ACHIEVEMENTS.eraElectric, 2)).toBe(true);
  });

  it('maxRate: depends on the resource era', () => {
    expect(achievementInEdition(ACHIEVEMENTS.kilowatt, 2)).toBe(true);
    expect(achievementInEdition(ACHIEVEMENTS.rollingBoil, 2)).toBe(false);
  });

  it('lifetime: any resource is always reachable, a named one follows its era', () => {
    expect(achievementInEdition(ACHIEVEMENTS.thirteenDigits, 2)).toBe(true);
    expect(achievementInEdition(withCondition({ type: 'lifetime', res: 'me', atLeast: 1 }), 2)).toBe(true);
    expect(achievementInEdition(withCondition({ type: 'lifetime', res: 'pr', atLeast: 1 }), 2)).toBe(false);
  });

  it('techsOwned: the target must fit inside the cap (18 techs at era 2)', () => {
    expect(achievementInEdition(ACHIEVEMENTS.fullIndex, 2)).toBe(false);
    expect(achievementInEdition(withCondition({ type: 'techsOwned', atLeast: 18 }), 2)).toBe(true);
  });

  it('prestige rows are never in a capped edition', () => {
    expect(achievementInEdition(ACHIEVEMENTS.echoes, 2)).toBe(false);
    expect(achievementInEdition(ACHIEVEMENTS.keeper, 2)).toBe(false);
  });

  it('stat: cycle rows are hidden, other stats are shown', () => {
    expect(achievementInEdition(ACHIEVEMENTS.newCycle, 2)).toBe(false);
    expect(achievementInEdition(ACHIEVEMENTS.firstTurn, 2)).toBe(true);
  });
});
