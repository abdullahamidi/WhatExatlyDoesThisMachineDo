import type { SaveEnvelope } from '../data/types';
import { parseEnvelope } from './codec';

// Save export / import text format (WP12): base64 (standard alphabet, padded) of the UTF-8 save JSON.
// Pure: btoa / atob / TextEncoder / TextDecoder only, no Buffer and no DOM.

/** Largest import text accepted, in characters. A format limit, not a balance number. */
export const MAX_IMPORT_CHARS = 1024 * 1024;

/** Player-readable import errors are kept at or below this length. */
export const MAX_IMPORT_ERROR_CHARS = 80;

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export type DecodeResult = { ok: true; json: string } | { ok: false; error: string };
export type ImportResult =
  | { ok: true; envelope: SaveEnvelope; migrated: boolean }
  | { ok: false; error: string };

/** Encodes save JSON as a base64 string of its UTF-8 bytes. */
export function encodeSave(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * Turns pasted text back into save JSON. Surrounding and inner whitespace is ignored. Text starting
 * with '{' is taken as raw JSON. Anything else must be base64 of UTF-8 text.
 */
export function decodeSave(text: string): DecodeResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return fail('Nothing to import. Paste a save code first.');
  if (trimmed.length > MAX_IMPORT_CHARS) return fail('Import text is too large to be a save.');
  if (trimmed.startsWith('{')) return { ok: true, json: trimmed };

  const compact = trimmed.replace(/\s+/g, '');
  if (compact.length % 4 !== 0 || !BASE64_PATTERN.test(compact)) {
    return fail('Save code is not valid base64 text.');
  }

  let binary: string;
  try {
    binary = atob(compact);
  } catch {
    return fail('Save code is not valid base64 text.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  try {
    return { ok: true, json: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return fail('Save code does not decode to text.');
  }
}

/**
 * Full import pipeline: decodeSave, then parseEnvelope (migrations + validation). Never reports
 * 'recovered' and never touches storage. Error strings are short enough to show in the UI.
 */
export function parseImport(text: string, nowMs: number): ImportResult {
  const decoded = decodeSave(text);
  if (!decoded.ok) return decoded;
  const parsed = parseEnvelope(decoded.json, nowMs);
  if (!parsed.ok) {
    const error = parsed.error.length <= MAX_IMPORT_ERROR_CHARS ? parsed.error : 'This text is not a valid save.';
    return fail(error);
  }
  return { ok: true, envelope: parsed.envelope, migrated: parsed.migrated };
}
