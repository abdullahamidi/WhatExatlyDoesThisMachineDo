// Pure crash model (WP19 T5): turns any thrown value into a message and stack, then builds the
// copied report text and the overlay view. No DOM, no Phaser. Limits and player text come from src/data/shell.ts.
import { CRASH, CRASH_TEXT } from '../data/shell';

export type CrashSource = 'error' | 'rejection' | 'boot';

export interface CrashInfo { source: CrashSource; message: string; stack: string | null }

export interface CrashReportContext {
  versionLine: string;
  runtime: string;
  userAgent: string;
  isoTime: string;
  saved: boolean | null;
}

export interface CrashView {
  title: string;
  message: string;
  savedLine: string | null;
  version: string;
  showQuit: boolean;
  copyLabel: string;
  reloadLabel: string;
  quitLabel: string;
}

const UNKNOWN_ERROR = 'Unknown error';
const ERROR_NAME_FALLBACK = 'Error';
const TRUNCATION_MARK = '…';

interface Described { message: string; stack: string | null }

function describeValue(err: unknown): Described {
  if (err instanceof Error) {
    const message = typeof err.message === 'string' ? err.message : '';
    return {
      message: message || err.name || ERROR_NAME_FALLBACK,
      stack: typeof err.stack === 'string' ? err.stack : null,
    };
  }
  if (typeof err === 'string') return { message: err, stack: null };
  if (err === null || err === undefined) return { message: UNKNOWN_ERROR, stack: null };
  if (typeof err === 'object') {
    const candidate = err as { message?: unknown; stack?: unknown };
    if (typeof candidate.message === 'string') {
      return { message: candidate.message, stack: typeof candidate.stack === 'string' ? candidate.stack : null };
    }
  }
  return { message: String(err), stack: null };
}

function clampMessage(message: string): string {
  if (message.length <= CRASH.maxMessageChars) return message;
  return `${message.slice(0, CRASH.maxMessageChars)}${TRUNCATION_MARK}`;
}

// Never throws: a hostile value (throwing getter or toString) becomes 'Unknown error'.
export function crashInfo(err: unknown, source: CrashSource): CrashInfo {
  let described: Described;
  try {
    described = describeValue(err);
  } catch {
    described = { message: UNKNOWN_ERROR, stack: null };
  }
  return { source, message: clampMessage(described.message), stack: described.stack };
}

// Prefix match only: a message that merely contains a prefix is not ignored.
export function shouldIgnoreError(message: string): boolean {
  if (typeof message !== 'string') return false;
  return CRASH.ignoreMessagePrefixes.some((prefix) => message.startsWith(prefix));
}

function savedWord(saved: boolean | null): string {
  if (saved === null) return 'unknown';
  return saved ? 'yes' : 'no';
}

// First non-empty lines of the stack, trimmed, capped at CRASH.maxStackLines.
function stackLines(stack: string | null): string[] {
  if (stack === null) return [];
  return stack
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, CRASH.maxStackLines);
}

export function crashReport(info: CrashInfo, ctx: CrashReportContext): string {
  const lines: string[] = [
    CRASH_TEXT.reportHeader,
    ctx.versionLine,
    `runtime: ${ctx.runtime}`,
    `time: ${ctx.isoTime}`,
    `source: ${info.source}`,
    `saved: ${savedWord(ctx.saved)}`,
    `message: ${info.message}`,
    'stack:',
    ...stackLines(info.stack),
    `ua: ${ctx.userAgent}`,
  ];
  return lines.join('\n');
}

function savedLineFor(saved: boolean | null): string | null {
  if (saved === null) return null;
  return saved ? CRASH_TEXT.savedLine : CRASH_TEXT.unsavedLine;
}

export function crashView(info: CrashInfo, o: { versionLine: string; canQuit: boolean; saved: boolean | null }): CrashView {
  return {
    title: CRASH_TEXT.title,
    message: info.message,
    savedLine: savedLineFor(o.saved),
    version: o.versionLine,
    showQuit: o.canQuit,
    copyLabel: CRASH_TEXT.copy,
    reloadLabel: CRASH_TEXT.reload,
    quitLabel: CRASH_TEXT.quit,
  };
}
