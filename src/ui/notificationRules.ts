import { TECHNOLOGIES } from '../data/technologies';
import { ACHIEVEMENTS } from '../data/achievements';
import type { AchievementDefinition, AchievementId } from '../data/achievements';
import {
  ACHIEVEMENT_TEXT,
  FIRST_CLICK_MESSAGE,
  INSTALL_LINES,
  RECOVERED_TEXT,
  TOAST_CONFIG,
  WELCOME_MIN_ELAPSED_SECONDS,
  WELCOME_TEXT,
} from '../data/notifications';
import type { ToastMessage } from '../data/notifications';
import { PRESTIGE_TEXT } from '../data/prestige';
import { RESOURCE_IDS } from '../data/types';
import type { OfflineReport, TechId } from '../data/types';
import { cycleLabel, echoMultiplier } from '../simulation/prestige';
import type { SessionEvents } from '../simulation/events';
import { formatDuration, formatNumber } from '../utils/format';
import { resourceShort } from './revealRules';

// Pure mapping from session events to toast messages (WP3, WP4). No DOM, no Phaser.

export type NotificationEvent =
  | { type: 'click'; totalClicks: number }
  | { type: 'purchase'; id: TechId; level: number }
  | { type: 'unlock'; id: TechId }
  | { type: 'milestone'; id: TechId };

// Returns the toast for an event, or null when the event should stay silent.
export function messageFor(event: NotificationEvent): ToastMessage | null {
  switch (event.type) {
    case 'click':
      // Only the very first click announces itself.
      if (event.totalClicks !== 1) return null;
      return {
        key: 'first-click',
        title: FIRST_CLICK_MESSAGE,
        body: null,
        tone: 'system',
        durationMs: TOAST_CONFIG.durationMs,
      };
    case 'purchase': {
      // Level 1 is announced by the unlock event; only later levels toast here.
      if (event.level <= 1) return null;
      return {
        key: 'purchase:' + event.id,
        title: `${nameOf(event.id)} — LV ${event.level}`,
        body: null,
        tone: 'info',
        durationMs: TOAST_CONFIG.durationMs,
      };
    }
    case 'unlock': {
      // Milestones are announced by the milestone event instead.
      if (TECHNOLOGIES[event.id].kind === 'milestone') return null;
      return {
        key: 'unlock:' + event.id,
        title: `INSTALLED: ${nameOf(event.id)}`,
        body: INSTALL_LINES[event.id],
        tone: 'info',
        durationMs: TOAST_CONFIG.durationMs,
      };
    }
    case 'milestone':
      return {
        key: 'milestone:' + event.id,
        title: `MILESTONE: ${nameOf(event.id)}`,
        body: INSTALL_LINES[event.id],
        tone: 'milestone',
        durationMs: TOAST_CONFIG.milestoneDurationMs,
      };
  }
}

// Welcome-back toast after an offline catch-up, or null when the absence was too short or earned nothing.
// Lists every resource with a finite positive gain, in RESOURCE_IDS order (ME only: identical to the old text).
export function welcomeBackMessage(r: OfflineReport): ToastMessage | null {
  const parts: string[] = [];
  for (const id of RESOURCE_IDS) {
    const gain = r.gained[id];
    if (!Number.isFinite(gain) || !(gain > 0)) continue;
    parts.push(`+${formatNumber(gain)} ${resourceShort(id)}`);
  }
  if (parts.length === 0) return null;
  if (!(r.elapsedSeconds >= WELCOME_MIN_ELAPSED_SECONDS)) return null;
  let body = `Unattended for ${formatDuration(r.elapsedSeconds)}. ${parts.join(', ')} accumulated.`;
  if (r.elapsedSeconds > r.cappedSeconds) {
    body += ` Buffer capped at ${formatDuration(r.cappedSeconds)}.`;
  }
  return {
    key: 'welcome-back',
    title: WELCOME_TEXT.title,
    body,
    tone: 'system',
    durationMs: TOAST_CONFIG.welcomeDurationMs,
  };
}

// Toast shown when the stored save was unreadable and a fresh state was started.
export function recoveredMessage(): ToastMessage {
  return {
    key: 'save-recovered',
    title: RECOVERED_TEXT.title,
    body: RECOVERED_TEXT.body,
    tone: 'system',
    durationMs: TOAST_CONFIG.welcomeDurationMs,
  };
}

// Coalesced achievement toast (WP12 D5): one message for the ids unlocked in one evaluation.
// 1 id -> the record name; 2+ ids -> the count and the first two names. Unknown ids are ignored.
// Returns null when nothing resolves (the caller then shows nothing). Secret ids show their real name.
export function achievementMessage(
  ids: readonly AchievementId[],
  defs: Readonly<Record<AchievementId, AchievementDefinition>> = ACHIEVEMENTS,
): ToastMessage | null {
  const names: string[] = [];
  for (const id of ids) {
    const def: AchievementDefinition | undefined = defs[id];
    if (def !== undefined) names.push(def.name);
  }
  if (names.length === 0) return null;
  const [first = '', second = ''] = names;
  const title = names.length === 1
    ? ACHIEVEMENT_TEXT.title
    : `${names.length} ${ACHIEVEMENT_TEXT.multiTitleSuffix}`;
  const body = names.length === 1
    ? first
    : `${first}${ACHIEVEMENT_TEXT.nameSeparator}${second}${ACHIEVEMENT_TEXT.ellipsis}`;
  return {
    key: ACHIEVEMENT_TEXT.key,
    title,
    body,
    tone: 'system',
    durationMs: TOAST_CONFIG.durationMs,
  };
}

// New-cycle toast (WP14 T8a): `CYCLE 0043` / `+3 ECHOES (+90% ALL/S)`. The bonus is the all-rate multiplier after the
// gain (counts earned Echoes only, so perks do not change it). Shown after the reset, so it survives the toast clear.
export function cycleMessage(event: SessionEvents['cycle']): ToastMessage {
  const bonusPct = Math.round((echoMultiplier({ cycle: event.cycle, echoesEarned: event.echoesEarned, perks: [] }) - 1) * 100);
  return {
    key: 'cycle',
    title: cycleLabel(event.cycle),
    body: `+${event.echoesGained} ${PRESTIGE_TEXT.echoes} (+${bonusPct}% ${PRESTIGE_TEXT.allPerSecond})`,
    tone: 'system',
    durationMs: TOAST_CONFIG.durationMs,
  };
}

// Upper-case display name of a technology.
function nameOf(id: TechId): string {
  return TECHNOLOGIES[id].name.toUpperCase();
}
