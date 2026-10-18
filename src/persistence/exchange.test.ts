import { describe, it, expect } from 'vitest';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';
import { emptyStats } from '../simulation/stats';
import { serialize } from './codec';
import { MAX_IMPORT_CHARS, MAX_IMPORT_ERROR_CHARS, decodeSave, encodeSave, parseImport } from './exchange';
import v1Save from './fixtures/v1-save.json';

const NOW = 1_700_000_000_000;

describe('encodeSave', () => {
  it('encodes UTF-8 bytes as padded standard base64', () => {
    expect(encodeSave('{"a":1}')).toBe('eyJhIjoxfQ==');
    expect(encodeSave('hello')).toBe('aGVsbG8=');
  });

  it('encodes non-ASCII text through UTF-8', () => {
    const json = '{"name":"é ✓ 漢字 🛠"}';
    const encoded = encodeSave(json);
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(decodeSave(encoded)).toEqual({ ok: true, json });
  });
});

describe('decodeSave', () => {
  it('round-trips save JSON', () => {
    const json = JSON.stringify({ version: 2, savedAt: NOW, state: { res: { me: 1.5 } } });
    expect(decodeSave(encodeSave(json))).toEqual({ ok: true, json });
  });

  it('ignores surrounding and inner whitespace and newlines', () => {
    const json = '{"version":2}';
    const encoded = encodeSave(json);
    const messy = `  \n${encoded.slice(0, 5)}\r\n${encoded.slice(5)}\t\n`;
    expect(decodeSave(messy)).toEqual({ ok: true, json });
  });

  it('accepts raw JSON that starts with a brace', () => {
    expect(decodeSave('  {"version":2}\n')).toEqual({ ok: true, json: '{"version":2}' });
  });

  it('rejects empty and whitespace-only text', () => {
    for (const text of ['', ' ', '\n\t ']) {
      const result = decodeSave(text);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.error.length).toBeLessThanOrEqual(MAX_IMPORT_ERROR_CHARS);
    }
  });

  it('accepts text of exactly MAX_IMPORT_CHARS and rejects one character more', () => {
    expect(decodeSave('A'.repeat(MAX_IMPORT_CHARS)).ok).toBe(true);
    const over = decodeSave('A'.repeat(MAX_IMPORT_CHARS + 1));
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.error.length).toBeLessThanOrEqual(MAX_IMPORT_ERROR_CHARS);
  });

  it('rejects invalid base64 (bad characters, bad length, inner padding)', () => {
    for (const text of ['abc', 'ab!d', 'a=bc', 'not a save!!']) {
      const result = decodeSave(text);
      expect(result.ok, text).toBe(false);
      if (result.ok) continue;
      expect(result.error.length, text).toBeLessThanOrEqual(MAX_IMPORT_ERROR_CHARS);
    }
  });

  it('rejects base64 that does not decode to UTF-8 text', () => {
    const result = decodeSave('//4=');
    expect(result.ok).toBe(false);
  });
});

describe('parseImport', () => {
  const save = serialize(createInitialState(NOW), { ...DEFAULT_SETTINGS, muted: true }, NOW, {
    stats: { ...emptyStats(NOW), clicks: 7 },
    achievements: { unlocked: { firstTurn: NOW } },
  });

  it('accepts an encoded v2 save and returns the envelope with stats and achievements', () => {
    const result = parseImport(encodeSave(save), NOW + 1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(false);
    expect(result.envelope.savedAt).toBe(NOW);
    expect(result.envelope.settings.muted).toBe(true);
    expect(result.envelope.stats.clicks).toBe(7);
    expect(result.envelope.achievements.unlocked.firstTurn).toBe(NOW);
  });

  it('accepts raw JSON and reports a migrated v1 save as migrated', () => {
    expect(parseImport(save, NOW).ok).toBe(true);
    const v1 = parseImport(encodeSave(JSON.stringify(v1Save)), NOW);
    expect(v1.ok).toBe(true);
    if (!v1.ok) return;
    expect(v1.migrated).toBe(true);
    expect(v1.envelope.stats.clicks).toBe(321);
    expect(v1.envelope.achievements).toEqual({ unlocked: {} });
  });

  const badSaves: Array<[string, string]> = [
    ['truncated json', encodeSave('{"version":2,"state":{')],
    ['not json', encodeSave('hello')],
    ['json array', encodeSave('[1,2]')],
    ['json primitive', encodeSave('42')],
    ['future version', encodeSave(JSON.stringify({ version: 3, savedAt: NOW, state: {} }))],
    ['bad state', encodeSave(JSON.stringify({ version: 2, savedAt: NOW, state: { res: { me: -5 } } }))],
    ['no state', encodeSave(JSON.stringify({ version: 2, savedAt: NOW }))],
    ['empty text', ''],
    ['invalid base64', 'abc'],
  ];

  it.each(badSaves)('%s -> { ok: false } with a short error, never recovered', (_name, text) => {
    const result = parseImport(text, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result).not.toHaveProperty('status');
    expect(result.error.length).toBeGreaterThan(0);
    expect(result.error.length).toBeLessThanOrEqual(MAX_IMPORT_ERROR_CHARS);
  });
});
