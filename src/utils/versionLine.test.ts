import { describe, it, expect } from 'vitest';
import { versionAriaLabel, versionLine } from './versionLine';

describe('versionLine', () => {
  it.each([
    ['0.9.0', 2, null, 'v0.9.0 · SAVE v2'],
    ['0.9.0', 2, 'DEMO', 'v0.9.0 · DEMO · SAVE v2'],
    ['0.9.0', 2, '', 'v0.9.0 · SAVE v2'],
    ['0.9.0', 2, '   ', 'v0.9.0 · SAVE v2'],
    ['0.9.0', 2, ' DEMO ', 'v0.9.0 · DEMO · SAVE v2'],
  ])('formats version %s, save %s, label %s as %s', (version, saveVersion, label, expected) => {
    expect(versionLine(version, saveVersion, label)).toBe(expected);
  });

  it('defaults the label to null', () => {
    expect(versionLine('0.9.0', 2)).toBe(versionLine('0.9.0', 2, null));
    expect(versionLine('0.9.0', 2)).toBe('v0.9.0 · SAVE v2');
  });
});

describe('versionAriaLabel', () => {
  it.each([
    ['0.9.0', null, 'Version 0.9.0'],
    ['0.9.0', 'DEMO', 'Version 0.9.0 DEMO'],
    ['0.9.0', '', 'Version 0.9.0'],
    ['0.9.0', '  ', 'Version 0.9.0'],
    ['0.9.0', ' DEMO ', 'Version 0.9.0 DEMO'],
  ])('labels version %s, label %s as %s', (version, label, expected) => {
    expect(versionAriaLabel(version, label)).toBe(expected);
  });

  it('defaults the label to null', () => {
    expect(versionAriaLabel('0.9.0')).toBe('Version 0.9.0');
  });
});
