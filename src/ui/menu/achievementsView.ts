// Pure view model for the RECORDS tab (WP12 T8). No DOM, no Phaser.
import { ACHIEVEMENT_IDS, ACHIEVEMENT_LIST, UI_ART } from '../../data/achievements';
import type { AchievementDefinition, AchievementId } from '../../data/achievements';
import { ACHIEVEMENT_TEXT, BADGE_VIEW } from '../../data/notifications';
import type { AchievementsState } from '../../data/types';

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

// Counter line: how many known ids are unlocked, e.g. "3/31 LOGGED". Unknown ids are not counted.
export function counterText(
  unlocked: AchievementsState['unlocked'],
  total: number = ACHIEVEMENT_LIST.length,
): string {
  const count = ACHIEVEMENT_IDS.filter((id) => unlocked[id] !== undefined).length;
  return `${count}/${total} ${ACHIEVEMENT_TEXT.logged}`;
}
