// Pure URL switch parsing for debug and dev flags. No DOM, no Phaser: callers pass the search string.

// Values that switch a URL flag off (compared case-insensitively).
const OFF_VALUES: readonly string[] = ['0', 'false', 'off'];

// Reads a URL flag. Absent -> null (the caller decides). Present with an off value -> false.
// Any other value, including an empty one (as in ?debug), -> true.
export function urlFlag(search: string, name: string): boolean | null {
  const value = new URLSearchParams(search).get(name);
  if (value === null) return null;
  return !OFF_VALUES.includes(value.toLowerCase());
}

// Debug mode: an explicit ?debug flag wins; otherwise the build default (dev) applies.
export function debugEnabled(search: string, dev: boolean): boolean {
  return urlFlag(search, 'debug') ?? dev;
}
