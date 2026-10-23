import { describe, it, expect } from 'vitest';
import { crashInfo, crashReport, crashView, shouldIgnoreError } from './crashModel';
import type { CrashInfo, CrashReportContext } from './crashModel';
import { CRASH, CRASH_TEXT } from '../data/shell';

const CTX: CrashReportContext = {
  versionLine: 'v0.9.0 · SAVE v2',
  runtime: 'web',
  userAgent: 'UA-TEST',
  isoTime: '2026-10-23T00:00:00.000Z',
  saved: true,
};

function infoWith(stack: string | null): CrashInfo {
  return { source: 'error', message: 'boom', stack };
}

describe('crashInfo', () => {
  it('reads message and stack from an Error', () => {
    const err = new Error('boom');
    const info = crashInfo(err, 'error');
    expect(info).toEqual({ source: 'error', message: 'boom', stack: err.stack ?? null });
    expect(typeof info.stack).toBe('string');
  });

  it('uses the error name when the message is empty', () => {
    const err = new Error('');
    err.name = 'TypeError';
    expect(crashInfo(err, 'error').message).toBe('TypeError');
  });

  it('falls back to Error when message and name are empty', () => {
    const err = new Error('');
    err.name = '';
    expect(crashInfo(err, 'error').message).toBe('Error');
  });

  it('keeps a string as the message with no stack', () => {
    expect(crashInfo('oops', 'rejection')).toEqual({ source: 'rejection', message: 'oops', stack: null });
  });

  it('takes the message from an object with a string message property', () => {
    expect(crashInfo({ message: 'bad' }, 'rejection')).toEqual({ source: 'rejection', message: 'bad', stack: null });
  });

  it('takes the stack from a string stack property of such an object', () => {
    expect(crashInfo({ message: 'bad', stack: 'S' }, 'rejection')).toEqual({
      source: 'rejection',
      message: 'bad',
      stack: 'S',
    });
  });

  it('maps null and undefined to Unknown error', () => {
    expect(crashInfo(null, 'error')).toEqual({ source: 'error', message: 'Unknown error', stack: null });
    expect(crashInfo(undefined, 'boot')).toEqual({ source: 'boot', message: 'Unknown error', stack: null });
  });

  it('maps an object whose toString throws to Unknown error', () => {
    const hostile = {
      toString(): string {
        throw new Error('nope');
      },
    };
    expect(crashInfo(hostile, 'rejection')).toEqual({ source: 'rejection', message: 'Unknown error', stack: null });
  });

  it('stringifies other values', () => {
    expect(crashInfo(42, 'error')).toEqual({ source: 'error', message: '42', stack: null });
  });

  it('keeps a message of exactly the limit length', () => {
    const text = 'a'.repeat(CRASH.maxMessageChars);
    expect(crashInfo(text, 'error').message).toBe(text);
  });

  it('truncates a long message to the limit and appends an ellipsis', () => {
    const info = crashInfo('a'.repeat(CRASH.maxMessageChars + 100), 'error');
    expect(info.message.length).toBe(CRASH.maxMessageChars + 1);
    expect(info.message.endsWith('…')).toBe(true);
    expect(info.message).toBe(`${'a'.repeat(CRASH.maxMessageChars)}…`);
  });

  it('truncates a long Error message too', () => {
    const info = crashInfo(new Error('b'.repeat(CRASH.maxMessageChars + 5)), 'error');
    expect(info.message.length).toBe(CRASH.maxMessageChars + 1);
    expect(info.message.endsWith('…')).toBe(true);
  });
});

describe('shouldIgnoreError', () => {
  it.each([
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
  ])('ignores %s', (message) => {
    expect(shouldIgnoreError(message)).toBe(true);
  });

  it('keeps ordinary errors', () => {
    expect(shouldIgnoreError('TypeError: x')).toBe(false);
  });

  it('keeps a message that only contains the prefix in the middle', () => {
    expect(shouldIgnoreError('Error: ResizeObserver loop limit exceeded')).toBe(false);
  });

  it('keeps an empty message', () => {
    expect(shouldIgnoreError('')).toBe(false);
  });
});

describe('crashReport', () => {
  it('writes header, context and stack lines in order', () => {
    const info = infoWith('Error: boom\n    at a (x.js:1:1)\n\n    at b (y.js:2:2)\n');
    expect(crashReport(info, CTX)).toBe(
      [
        CRASH_TEXT.reportHeader,
        'v0.9.0 · SAVE v2',
        'runtime: web',
        'time: 2026-10-23T00:00:00.000Z',
        'source: error',
        'saved: yes',
        'message: boom',
        'stack:',
        'Error: boom',
        'at a (x.js:1:1)',
        'at b (y.js:2:2)',
        'ua: UA-TEST',
      ].join('\n'),
    );
  });

  it('caps the stack at the configured line count', () => {
    const stack = Array.from({ length: 30 }, (_, i) => `    at fn${i} (f.js:${i}:1)`).join('\n');
    const lines = crashReport(infoWith(stack), CTX).split('\n');
    const start = lines.indexOf('stack:') + 1;
    const end = lines.indexOf('ua: UA-TEST');
    expect(end - start).toBe(CRASH.maxStackLines);
    expect(lines[start]).toBe('at fn0 (f.js:0:1)');
    expect(lines[end - 1]).toBe(`at fn${CRASH.maxStackLines - 1} (f.js:${CRASH.maxStackLines - 1}:1)`);
  });

  it('writes no stack lines when the stack is null', () => {
    const lines = crashReport(infoWith(null), CTX).split('\n');
    expect(lines[lines.indexOf('stack:') + 1]).toBe('ua: UA-TEST');
  });

  it.each([
    [true, 'saved: yes'],
    [false, 'saved: no'],
    [null, 'saved: unknown'],
  ] as const)('writes saved state for %s as %s', (saved, expected) => {
    expect(crashReport(infoWith(null), { ...CTX, saved })).toContain(expected);
  });
});

describe('crashView', () => {
  const info: CrashInfo = { source: 'boot', message: 'boom', stack: null };

  it('fills the static labels and copies the message and version', () => {
    const view = crashView(info, { versionLine: 'v0.9.0 · SAVE v2', canQuit: false, saved: null });
    expect(view).toEqual({
      title: CRASH_TEXT.title,
      message: 'boom',
      savedLine: null,
      version: 'v0.9.0 · SAVE v2',
      showQuit: false,
      copyLabel: CRASH_TEXT.copy,
      reloadLabel: CRASH_TEXT.reload,
      quitLabel: CRASH_TEXT.quit,
    });
  });

  it('shows quit only when the host can quit', () => {
    expect(crashView(info, { versionLine: 'v', canQuit: true, saved: null }).showQuit).toBe(true);
    expect(crashView(info, { versionLine: 'v', canQuit: false, saved: null }).showQuit).toBe(false);
  });

  it.each([
    [true, CRASH_TEXT.savedLine],
    [false, CRASH_TEXT.unsavedLine],
    [null, null],
  ] as const)('picks the saved line for %s', (saved, expected) => {
    expect(crashView(info, { versionLine: 'v', canQuit: false, saved }).savedLine).toBe(expected);
  });
});
