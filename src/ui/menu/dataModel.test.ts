import { describe, it, expect } from 'vitest';
import { canImport, copyStatusLabel, importLabel, reduceImport, trimImportText } from './dataModel';
import type { ResetState } from '../systemMenuModel';
import { DATA_LABELS } from '../../data/notifications';
import { SYSTEM_MENU_CONFIG } from '../../data/systemMenu';

const ARM = SYSTEM_MENU_CONFIG.resetArmMs;
const idle: ResetState = { stage: 'idle' };

describe('reduceImport: two-step confirm', () => {
  it('first press arms without executing', () => {
    const r = reduceImport(idle, { type: 'press', nowMs: 1000 });
    expect(r.execute).toBe(false);
    expect(r.state).toEqual({ stage: 'armed', armedAt: 1000 });
  });

  it('second press inside the arm window executes and returns to idle', () => {
    const armed = reduceImport(idle, { type: 'press', nowMs: 1000 }).state;
    const r = reduceImport(armed, { type: 'press', nowMs: 1000 + ARM - 1 });
    expect(r.execute).toBe(true);
    expect(r.state).toEqual(idle);
  });

  it('press exactly at the window end re-arms instead of executing', () => {
    const armed = reduceImport(idle, { type: 'press', nowMs: 1000 }).state;
    const r = reduceImport(armed, { type: 'press', nowMs: 1000 + ARM });
    expect(r.execute).toBe(false);
    expect(r.state).toEqual({ stage: 'armed', armedAt: 1000 + ARM });
  });

  it('press after expiry re-arms', () => {
    const armed = reduceImport(idle, { type: 'press', nowMs: 0 }).state;
    const r = reduceImport(armed, { type: 'press', nowMs: ARM * 3 });
    expect(r.execute).toBe(false);
    expect(r.state).toEqual({ stage: 'armed', armedAt: ARM * 3 });
  });

  it('tick before expiry keeps the arm', () => {
    const armed = reduceImport(idle, { type: 'press', nowMs: 0 }).state;
    const r = reduceImport(armed, { type: 'tick', nowMs: ARM - 1 });
    expect(r.execute).toBe(false);
    expect(r.state).toEqual(armed);
  });

  it('tick after expiry returns to idle', () => {
    const armed = reduceImport(idle, { type: 'press', nowMs: 0 }).state;
    const r = reduceImport(armed, { type: 'tick', nowMs: ARM });
    expect(r.execute).toBe(false);
    expect(r.state).toEqual(idle);
  });

  it('cancel returns an armed import to idle', () => {
    const armed = reduceImport(idle, { type: 'press', nowMs: 0 }).state;
    const r = reduceImport(armed, { type: 'cancel', nowMs: 1 });
    expect(r.execute).toBe(false);
    expect(r.state).toEqual(idle);
  });

  it('a press after cancel arms again, not execute', () => {
    const armed = reduceImport(idle, { type: 'press', nowMs: 0 }).state;
    const cancelled = reduceImport(armed, { type: 'cancel', nowMs: 1 }).state;
    const r = reduceImport(cancelled, { type: 'press', nowMs: 2 });
    expect(r.execute).toBe(false);
    expect(r.state).toEqual({ stage: 'armed', armedAt: 2 });
  });

  it('honours a custom arm window', () => {
    const armed = reduceImport(idle, { type: 'press', nowMs: 0 }, 100).state;
    expect(reduceImport(armed, { type: 'press', nowMs: 99 }, 100).execute).toBe(true);
    expect(reduceImport(armed, { type: 'press', nowMs: 100 }, 100).execute).toBe(false);
  });
});

describe('importLabel', () => {
  it('idle shows the import label', () => {
    expect(importLabel(idle)).toBe(DATA_LABELS.importIdle);
  });

  it('armed shows the confirm label', () => {
    expect(importLabel({ stage: 'armed', armedAt: 0 })).toBe(DATA_LABELS.importArmed);
  });
});

describe('trimImportText', () => {
  it('removes surrounding spaces, tabs and newlines', () => {
    expect(trimImportText('  abc \n')).toBe('abc');
    expect(trimImportText('\n\t{"a":1}\r\n')).toBe('{"a":1}');
  });

  it('keeps inner whitespace', () => {
    expect(trimImportText(' a b\nc ')).toBe('a b\nc');
  });

  it('whitespace only becomes empty', () => {
    expect(trimImportText('\n\t ')).toBe('');
    expect(trimImportText('')).toBe('');
  });
});

describe('canImport', () => {
  it('empty and whitespace-only text cannot be imported', () => {
    expect(canImport('')).toBe(false);
    expect(canImport('   \n\t')).toBe(false);
  });

  it('any non-blank text can be imported', () => {
    expect(canImport('x')).toBe(true);
    expect(canImport('  eyJ2IjoyfQ==\n')).toBe(true);
  });
});

describe('copyStatusLabel', () => {
  it('copied shows COPIED', () => {
    expect(copyStatusLabel(true)).toBe('COPIED');
    expect(copyStatusLabel(true)).toBe(DATA_LABELS.copied);
  });

  it('failed shows SELECT AND COPY', () => {
    expect(copyStatusLabel(false)).toBe('SELECT AND COPY');
    expect(copyStatusLabel(false)).toBe(DATA_LABELS.selectAndCopy);
  });
});
