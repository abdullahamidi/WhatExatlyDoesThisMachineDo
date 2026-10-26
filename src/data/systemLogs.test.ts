// WP25 SYS LOG guard: `manual-optional` (manual clicks become optional) keeps its table slot, its text and an EE threshold
// below the substation gate. Tech values are read from data, never retyped.
import { describe, it, expect } from 'vitest';
import { SYSTEM_LOGS } from './systemLogs';
import type { SystemLogEntry } from './systemLogs';
import { TECHNOLOGIES } from './technologies';

const ID = 'manual-optional';
const TEXT = 'Manual operation no longer required. Still detected.';
const THRESHOLD = 500000;

const entryOf = (): SystemLogEntry | undefined => SYSTEM_LOGS.find((log) => log.id === ID);
const indexOf = (id: string): number => SYSTEM_LOGS.findIndex((log) => log.id === id);

describe('manual-optional SYS LOG (WP25)', () => {
  it('exists exactly once', () => {
    expect(SYSTEM_LOGS.filter((log) => log.id === ID)).toHaveLength(1);
  });

  it('text is the calibrated line, 52 characters long', () => {
    expect(entryOf()?.text).toBe(TEXT);
    expect(entryOf()?.text.length).toBe(52);
  });

  it('text does not use the RESTOR wording', () => {
    expect(entryOf()?.text ?? '').not.toMatch(/restor/i);
  });

  it('trigger is a lifetime EE threshold at the calibrated value', () => {
    expect(entryOf()?.trigger).toEqual({ kind: 'lifetime', res: 'ee', atLeast: THRESHOLD });
  });

  it('sits directly after load-beneath and before copper-memory', () => {
    const at = indexOf(ID);
    expect(at).toBeGreaterThan(0);
    expect(SYSTEM_LOGS[at - 1]?.id).toBe('load-beneath');
    expect(SYSTEM_LOGS[at + 1]?.id).toBe('copper-memory');
  });

  it('lifetime EE thresholds still strictly increase in table order', () => {
    const thresholds = SYSTEM_LOGS.flatMap((log) =>
      log.trigger.kind === 'lifetime' && log.trigger.res === 'ee' ? [log.trigger.atLeast] : []);
    expect(thresholds.length).toBeGreaterThan(1);
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1] as number);
    }
  });

  it('text starts with the hand crank flavour line it echoes', () => {
    expect(TECHNOLOGIES.handCrank.flavor).toBe('Manual operation detected.');
    expect(entryOf()?.text.startsWith('Manual operation')).toBe(true);
  });

  it('threshold is below the substation Blueprint lifetime EE requirement', () => {
    const gates = TECHNOLOGIES.substationBlueprint.requires.flatMap((req) =>
      req.type === 'lifetime' && req.res === 'ee' ? [req.amount] : []);
    expect(gates).toHaveLength(1);
    const trigger = entryOf()?.trigger;
    expect(trigger?.kind === 'lifetime' ? trigger.atLeast : Number.NaN).toBeLessThan(gates[0] as number);
  });
});
