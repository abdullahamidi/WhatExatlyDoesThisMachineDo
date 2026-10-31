import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import { isManifestModule, stripManifestDescriptions } from './stripManifestDescriptions';

const BS = String.fromCharCode(92);
const MANIFEST_PATH = fileURLToPath(new URL('../assets/manifest.ts', import.meta.url));

/** Non-overlapping occurrences of a part in a text. */
function countOf(text: string, part: string): number {
  return text.split(part).length - 1;
}

describe('stripManifestDescriptions: unit cases', () => {
  it('removes a plain description line', () => {
    expect(stripManifestDescriptions("    description: 'Plain text.',\n")).toBe('');
  });

  it('removes a line whose string holds an escaped quote', () => {
    const line = "    description: 'It" + BS + "'s here.',\n";
    expect(stripManifestDescriptions('a\n' + line + 'b\n')).toBe('a\nb\n');
  });

  it('ends the string at a quote that follows an escaped backslash', () => {
    const line = "  description: 'ends with a backslash" + BS + BS + "',\n";
    expect(stripManifestDescriptions(line)).toBe('');
  });

  it('removes a CRLF line and keeps its neighbours', () => {
    const text = "  id: 'a',\r\n  description: 'Two lines.',\r\n  file: 'b.png',\r\n";
    expect(stripManifestDescriptions(text)).toBe("  id: 'a',\r\n  file: 'b.png',\r\n");
  });

  it('removes a description line that has no trailing comma', () => {
    expect(stripManifestDescriptions("  id: 'a',\n  description: 'Last field'\n}\n")).toBe("  id: 'a',\n}\n");
  });

  it('returns text with no description line unchanged', () => {
    const text = "export const X = 1;\r\n  id: 'x',\n  file: null,\n";
    expect(stripManifestDescriptions(text)).toBe(text);
  });

  it('keeps a line that only mentions description inside another string or statement', () => {
    const text = [
      "  label: 'description: kept',",
      "const note = 'description: kept too';",
      "  description: 'x' + y,",
      '  description: string;',
      '',
    ].join('\n');
    expect(stripManifestDescriptions(text)).toBe(text);
  });
});

describe('stripManifestDescriptions: src/assets/manifest.ts', () => {
  const source = readFileSync(MANIFEST_PATH, 'utf8');
  const stripped = stripManifestDescriptions(source);

  it('removes every quoted description value', () => {
    expect(countOf(stripped, "description: '")).toBe(0);
  });

  it('keeps the AssetEntry description field (a type, not a quoted string)', () => {
    expect(countOf(source, 'description:')).toBeGreaterThan(1);
    expect(countOf(stripped, 'description:')).toBe(1);
  });

  it('keeps every id line', () => {
    expect(countOf(source, "id: '")).toBeGreaterThan(0);
    expect(countOf(stripped, "id: '")).toBe(countOf(source, "id: '"));
  });

  it('removes at least 13000 characters', () => {
    expect(source.length - stripped.length).toBeGreaterThanOrEqual(13000);
  });

  it('parses as TypeScript with esbuild', () => {
    expect(() => transformSync(stripped, { loader: 'ts' })).not.toThrow();
  });
});

describe('isManifestModule', () => {
  it('matches a Windows path with backslashes', () => {
    const windows = 'C:/Users/dev/wedtmd-shell/src/assets/manifest.ts'.split('/').join(BS);
    expect(isManifestModule(windows)).toBe(true);
  });

  it('matches a posix path', () => {
    expect(isManifestModule('/home/dev/wedtmd-shell/src/assets/manifest.ts')).toBe(true);
  });

  it('rejects other modules and other folders', () => {
    expect(isManifestModule('/home/dev/wedtmd-shell/src/assets/assetIds.ts')).toBe(false);
    expect(isManifestModule('/home/dev/wedtmd-shell/src/assets/manifest.test.ts')).toBe(false);
    expect(isManifestModule('/home/dev/wedtmd-shell/src/other/manifest.ts')).toBe(false);
  });
});
