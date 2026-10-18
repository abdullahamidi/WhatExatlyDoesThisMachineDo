import { describe, it, expect } from 'vitest';
import { messageFor } from './notificationRules';
import type { NotificationEvent } from './notificationRules';
import { FIRST_CLICK_MESSAGE, INSTALL_LINES, TOAST_CONFIG } from '../data/notifications';
import { TECHNOLOGIES } from '../data/technologies';
import { TECH_IDS } from '../data/types';

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
