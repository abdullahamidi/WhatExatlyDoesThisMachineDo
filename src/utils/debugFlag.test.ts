import { describe, it, expect } from 'vitest';
import { debugEnabled, urlFlag } from './debugFlag';

describe('urlFlag', () => {
  it('returns null when the flag is absent', () => {
    expect(urlFlag('', 'title')).toBeNull();
    expect(urlFlag('?x=1', 'title')).toBeNull();
  });

  it.each([
    ['?title=0', false],
    ['?title=OFF', false],
    ['?title=off', false],
    ['?title=False', false],
    ['?title=false', false],
    ['?title=', true],
    ['?title=yes', true],
    ['?title=1', true],
  ])('parses %s as %s', (search, expected) => {
    expect(urlFlag(search, 'title')).toBe(expected);
  });

  it('accepts a search string without the leading ?', () => {
    expect(urlFlag('title=0', 'title')).toBe(false);
  });
});

describe('debugEnabled', () => {
  it.each([
    ['', false, false],
    ['', true, true],
    ['?debug', false, true],
    ['?debug=1', false, true],
    ['?debug=0', false, false],
    ['?debug=0', true, false],
    ['?x=1&debug', false, true],
    ['?debug=false', true, false],
    ['debug=1', false, true],
    ['?debugger=1', false, false],
  ])('search %s, dev %s -> %s', (search, dev, expected) => {
    expect(debugEnabled(search, dev)).toBe(expected);
  });
});
