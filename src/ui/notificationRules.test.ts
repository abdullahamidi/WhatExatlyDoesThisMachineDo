import { describe, it, expect } from 'vitest';
import { achievementMessage, messageFor, recoveredMessage, welcomeBackMessage } from './notificationRules';
import type { NotificationEvent } from './notificationRules';
import { ACHIEVEMENTS } from '../data/achievements';
import type { AchievementId } from '../data/achievements';
import {
  ACHIEVEMENT_TEXT,
  FIRST_CLICK_MESSAGE,
  INSTALL_LINES,
  RECOVERED_TEXT,
  TOAST_CONFIG,
  WELCOME_MIN_ELAPSED_SECONDS,
} from '../data/notifications';
import { TECHNOLOGIES } from '../data/technologies';
import { TECH_IDS } from '../data/types';
import type { OfflineReport, ResourceMap } from '../data/types';
import { formatDuration, formatNumber } from '../utils/format';

describe('INSTALL_LINES', () => {
  it('has a non-empty line of at most 60 chars for every tech', () => {
    for (const id of TECH_IDS) {
      const line = INSTALL_LINES[id];
      expect(line.length).toBeGreaterThan(0);
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });

  it('matches the flavor text where a tech has one', () => {
    for (const id of TECH_IDS) {
      const flavor = TECHNOLOGIES[id].flavor;
      if (flavor !== undefined) expect(INSTALL_LINES[id]).toBe(flavor);
    }
  });
});

describe('messageFor click', () => {
  it('announces only the first click', () => {
    const first = messageFor({ type: 'click', totalClicks: 1 });
    expect(first).toEqual({
      key: 'first-click',
      title: FIRST_CLICK_MESSAGE,
      body: null,
      tone: 'system',
      durationMs: TOAST_CONFIG.durationMs,
    });
    expect(messageFor({ type: 'click', totalClicks: 0 })).toBeNull();
    expect(messageFor({ type: 'click', totalClicks: 2 })).toBeNull();
    expect(messageFor({ type: 'click', totalClicks: 50 })).toBeNull();
  });
});

describe('messageFor purchase', () => {
  it('stays silent at level 1', () => {
    expect(messageFor({ type: 'purchase', id: 'gearRatio', level: 1 })).toBeNull();
  });

  it('announces level 2 and 3 under the same key', () => {
    const two = messageFor({ type: 'purchase', id: 'gearRatio', level: 2 });
    const three = messageFor({ type: 'purchase', id: 'gearRatio', level: 3 });
    expect(two?.title).toBe('GEAR RATIO — LV 2');
    expect(two?.key).toBe('purchase:gearRatio');
    expect(two?.body).toBeNull();
    expect(two?.tone).toBe('info');
    expect(three?.key).toBe('purchase:gearRatio');
    expect(three?.title).toBe('GEAR RATIO — LV 3');
  });
});

describe('messageFor unlock', () => {
  it('announces an installed unlock with its install line', () => {
    const msg = messageFor({ type: 'unlock', id: 'gearRatio' });
    expect(msg).toEqual({
      key: 'unlock:gearRatio',
      title: 'INSTALLED: GEAR RATIO',
      body: INSTALL_LINES.gearRatio,
      tone: 'info',
      durationMs: TOAST_CONFIG.durationMs,
    });
  });

  it('stays silent for a milestone-kind tech', () => {
    expect(messageFor({ type: 'unlock', id: 'generatorBlueprint' })).toBeNull();
  });
});

describe('messageFor milestone', () => {
  it('uses the milestone tone and longer duration', () => {
    const msg = messageFor({ type: 'milestone', id: 'generatorBlueprint' });
    expect(msg?.tone).toBe('milestone');
    expect(msg?.durationMs).toBe(TOAST_CONFIG.milestoneDurationMs);
    expect(msg?.title).toBe('MILESTONE: GENERATOR BLUEPRINT');
    expect(msg?.body).toBe(INSTALL_LINES.generatorBlueprint);
    expect(msg?.key).toBe('milestone:generatorBlueprint');
  });
});

describe('messageFor titles', () => {
  it('never produces an empty title', () => {
    const events: NotificationEvent[] = [{ type: 'click', totalClicks: 1 }];
    for (const id of TECH_IDS) {
      events.push({ type: 'purchase', id, level: 2 });
      events.push({ type: 'unlock', id });
      events.push({ type: 'milestone', id });
    }
    for (const event of events) {
      const msg = messageFor(event);
      if (msg !== null) expect(msg.title.length).toBeGreaterThan(0);
    }
  });
});

describe('welcomeBackMessage', () => {
  // ME gain plus optional gains for the other resources (all zero unless overridden).
  const report = (
    elapsedSeconds: number,
    cappedSeconds: number,
    me: number,
    extra: Partial<ResourceMap> = {},
  ): OfflineReport => ({
    elapsedSeconds,
    cappedSeconds,
    gained: { me, ee: 0, pr: 0, rs: 0, xf: 0, ...extra },
  });

  it('stays silent when nothing was gained', () => {
    expect(welcomeBackMessage(report(7200, 28800, 0))).toBeNull();
    expect(welcomeBackMessage(report(7200, 28800, Number.NaN))).toBeNull();
    expect(welcomeBackMessage(report(7200, 28800, -5))).toBeNull();
  });

  it('stays silent below the minimum elapsed time', () => {
    expect(welcomeBackMessage(report(59, 28800, 5))).toBeNull();
    expect(WELCOME_MIN_ELAPSED_SECONDS).toBe(60);
  });

  it('shows a system toast at the minimum elapsed time', () => {
    const msg = welcomeBackMessage(report(60, 28800, 5));
    expect(msg).not.toBeNull();
    expect(msg?.key).toBe('welcome-back');
    expect(msg?.tone).toBe('system');
    expect(msg?.title).toBe('WELCOME BACK');
    expect(msg?.durationMs).toBe(TOAST_CONFIG.welcomeDurationMs);
  });

  it('body carries the elapsed time and the gain', () => {
    const msg = welcomeBackMessage(report(7200, 28800, 1234));
    expect(msg?.body).toContain(formatDuration(7200));
    expect(msg?.body).toContain(formatNumber(1234));
  });

  it('omits the cap note when the absence was within the cap', () => {
    const msg = welcomeBackMessage(report(7200, 28800, 5));
    expect(msg?.body).not.toContain('capped');
  });

  it('adds the cap note when the absence exceeded the cap', () => {
    const msg = welcomeBackMessage(report(36000, 28800, 5));
    expect(msg?.body).toContain('capped at 8h');
  });

  it('lists every resource with a gain in RESOURCE_IDS order', () => {
    const msg = welcomeBackMessage(report(7200, 28800, 1500, { ee: 20 }));
    expect(msg?.body).toBe(
      `Unattended for ${formatDuration(7200)}. +1.5K ME, +20 EE accumulated.`,
    );
  });

  it('shows a message when only a non-ME resource gained', () => {
    const msg = welcomeBackMessage(report(7200, 28800, 0, { ee: 20 }));
    expect(msg).not.toBeNull();
    expect(msg?.body).toContain('+20 EE');
    expect(msg?.body).not.toContain('ME');
  });

  it('uses the ??? short name for Unknown Flux', () => {
    const msg = welcomeBackMessage(report(7200, 28800, 0, { xf: 3 }));
    expect(msg?.body).toContain('+3 ???');
  });

  it('stays silent when every gain is zero', () => {
    expect(welcomeBackMessage(report(7200, 28800, 0, { ee: 0, pr: 0, rs: 0, xf: 0 }))).toBeNull();
  });

  it('ignores non-finite or negative gains on other resources', () => {
    const msg = welcomeBackMessage(report(7200, 28800, 5, { ee: Infinity, pr: Number.NaN, rs: -3 }));
    expect(msg?.body).toContain('+5 ME accumulated.');
    expect(msg?.body).not.toContain('EE');
    expect(msg?.body).not.toContain('PR');
    expect(msg?.body).not.toContain('RS');
    expect(welcomeBackMessage(report(7200, 28800, 0, { ee: Infinity }))).toBeNull();
  });
});

describe('recoveredMessage', () => {
  it('is a system toast with the recovered texts', () => {
    const msg = recoveredMessage();
    expect(msg.key).toBe('save-recovered');
    expect(msg.tone).toBe('system');
    expect(msg.title.length).toBeGreaterThan(0);
    expect(msg.title).toBe(RECOVERED_TEXT.title);
    expect(msg.body).toBe(RECOVERED_TEXT.body);
    expect(msg.durationMs).toBe(TOAST_CONFIG.welcomeDurationMs);
  });
});

describe('achievementMessage (D5)', () => {
  it('returns null for an empty list', () => {
    expect(achievementMessage([])).toBeNull();
  });

  it('returns null when no id resolves to a definition', () => {
    expect(achievementMessage(['nope' as AchievementId])).toBeNull();
    expect(achievementMessage(['nope' as AchievementId, 'bogus' as AchievementId])).toBeNull();
  });

  it('one id: record title and the name as body', () => {
    const msg = achievementMessage(['firstTurn']);
    expect(msg).toEqual({
      key: ACHIEVEMENT_TEXT.key,
      title: 'RECORD LOGGED',
      body: 'First Turn',
      tone: 'system',
      durationMs: TOAST_CONFIG.durationMs,
    });
  });

  it('two ids: count title and the first two names with an ellipsis', () => {
    const msg = achievementMessage(['firstTurn', 'steadyHand']);
    expect(msg?.title).toBe('2 RECORDS LOGGED');
    expect(msg?.body).toBe('First Turn, Steady Hand…');
    expect(msg?.tone).toBe('system');
  });

  it('three ids: count title and only the first two names in list order', () => {
    const msg = achievementMessage(['firstTurn', 'steadyHand', 'tireless']);
    expect(msg?.title).toBe('3 RECORDS LOGGED');
    expect(msg?.body).toBe('First Turn, Steady Hand…');
    expect(msg?.key).toBe('achievement');
  });

  it('a secret id shows its real name', () => {
    const msg = achievementMessage(['eraExotic']);
    expect(msg?.body).toBe(ACHIEVEMENTS.eraExotic.name);
    expect(msg?.body).not.toBe('???');
  });

  it('ignores unknown ids and counts only resolved ones', () => {
    const msg = achievementMessage(['nope' as AchievementId, 'firstTurn']);
    expect(msg?.title).toBe('RECORD LOGGED');
    expect(msg?.body).toBe('First Turn');
    const two = achievementMessage(['nope' as AchievementId, 'firstTurn', 'steadyHand']);
    expect(two?.title).toBe('2 RECORDS LOGGED');
  });

  it('uses a custom definitions table when given', () => {
    const defs = {
      ...ACHIEVEMENTS,
      firstTurn: { ...ACHIEVEMENTS.firstTurn, name: 'Custom' },
    };
    expect(achievementMessage(['firstTurn'], defs)?.body).toBe('Custom');
  });
});
