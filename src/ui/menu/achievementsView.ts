// Pure view model for the RECORDS tab (WP12 T8). No DOM, no Phaser.
import { ACHIEVEMENT_IDS, ACHIEVEMENT_LIST, UI_ART } from '../../data/achievements';
import type { AchievementDefinition, AchievementId } from '../../data/achievements';
import { ACHIEVEMENT_TEXT, BADGE_VIEW } from '../../data/notifications';
import { RESOURCES } from '../../data/resources';
import { TECHNOLOGIES } from '../../data/technologies';
import { TECH_IDS } from '../../data/types';
import type { AchievementsState, ResourceDefinition, ResourceId, TechDefinition, TechId } from '../../data/types';

// One sprite drawn from a sheet: frame at (frameIndex * box) of a row of frames, drawn at `box` px.
export interface SpriteView {
  sheet: string; // path relative to public/
  frameIndex: number;
  box: number; // CSS px of one drawn frame
  bgPosition: string; // CSS background-position for the frame
  bgSize: string; // CSS background-size for the whole sheet
}

export interface AchievementCard {
  id: AchievementId;
  name: string;
  description: string;
  unlocked: boolean;
  locked: boolean;
  secretHidden: boolean;
  statusText: string; // text status, so the state is not shown by colour or art alone
  badge: SpriteView;
  lock: SpriteView | null;
}

// Frame of `frameSize` px at index `frameIndex` in a sheet of `sheetFrames` frames, drawn at `scale`.
function spriteFor(sheet: string, frameIndex: number, frameSize: number, sheetFrames: number, scale: number): SpriteView {
  const px = frameSize * scale;
  return {
    sheet,
    frameIndex,
    box: px,
    bgPosition: `${-frameIndex * px}px 0px`,
    bgSize: `${sheetFrames * px}px ${px}px`,
  };
}

// Card list in the given definition order. Unlocked state comes from the unlocked map only.
// Secret rows stay hidden (name and description) until unlocked; locked rows use the silhouette sheet + lock icon.
export function achievementCards(
  unlocked: AchievementsState['unlocked'],
  defs: readonly AchievementDefinition[] = ACHIEVEMENT_LIST,
): AchievementCard[] {
  return defs.map((def) => {
    const isUnlocked = unlocked[def.id] !== undefined;
    const secretHidden = def.secret === true && !isUnlocked;
    const sheet = isUnlocked ? UI_ART.badges : UI_ART.badgesLocked;
    return {
      id: def.id,
      name: secretHidden ? ACHIEVEMENT_TEXT.hiddenName : def.name,
      description: secretHidden ? ACHIEVEMENT_TEXT.hiddenDescription : def.description,
      unlocked: isUnlocked,
      locked: !isUnlocked,
      secretHidden,
      statusText: isUnlocked ? ACHIEVEMENT_TEXT.logged : ACHIEVEMENT_TEXT.locked,
      badge: spriteFor(sheet, def.icon, UI_ART.badgeFrame, BADGE_VIEW.badgeFrames, BADGE_VIEW.scale),
      lock: isUnlocked
        ? null
        : spriteFor(UI_ART.icons16, UI_ART.icon.lock, UI_ART.iconFrame, BADGE_VIEW.iconFrames, BADGE_VIEW.lockScale),
    };
  });
}

// Whether a row exists in an era-capped edition (maxEra null = full game). A row is shown only when every
// era it depends on is inside the cap, so the demo never lists a record it cannot reach.
export function achievementInEdition(
  def: AchievementDefinition,
  maxEra: number | null,
  techs: Readonly<Record<TechId, TechDefinition>> = TECHNOLOGIES,
  resources: Readonly<Record<ResourceId, ResourceDefinition>> = RESOURCES,
): boolean {
  if (maxEra === null) return true;
  const c = def.condition;
  switch (c.type) {
    case 'tech':
      return techs[c.id].era <= maxEra;
    case 'lifetime':
      return c.res === 'any' ? true : resources[c.res].era <= maxEra;
    case 'maxRate':
      return resources[c.res].era <= maxEra;
    case 'techsOwned': {
      // Owning N techs is only reachable in the cap if N techs exist inside it.
      const inEra = TECH_IDS.filter((id) => techs[id].era <= maxEra).length;
      return c.atLeast <= inEra;
    }
    case 'prestige':
      // Memory perks and echoes come from the cycle reset, which the demo does not reach.
      return false;
    case 'stat':
      // Cycle counts need a finished cycle, which the era-capped demo does not reach.
      return c.key !== 'cycles';
  }
}

// Card list for an edition: a new array in definition order, so callers may keep or mutate it.
export function editionAchievements(
  maxEra: number | null,
  defs: readonly AchievementDefinition[] = ACHIEVEMENT_LIST,
): AchievementDefinition[] {
  return defs.filter((d) => achievementInEdition(d, maxEra));
}

// Counter line: how many of the given ids are unlocked, e.g. "3/31 LOGGED". Unknown ids are not counted.
export function counterText(
  unlocked: AchievementsState['unlocked'],
  total: number = ACHIEVEMENT_LIST.length,
  ids: readonly AchievementId[] = ACHIEVEMENT_IDS,
): string {
  const count = ids.filter((id) => unlocked[id] !== undefined).length;
  return `${count}/${total} ${ACHIEVEMENT_TEXT.logged}`;
}
