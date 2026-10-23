// Pure version-label formatting for the title screen and the SYSTEM menu. Text comes from VERSION_TEXT.
import { VERSION_TEXT } from '../data/version';

// A blank or whitespace-only edition label counts as no label.
function normalizeLabel(editionLabel: string | null): string | null {
  if (editionLabel === null) return null;
  const trimmed = editionLabel.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Visible footer line, e.g. 'v0.9.0 · SAVE v2' or 'v0.9.0 · DEMO · SAVE v2'.
export function versionLine(version: string, saveVersion: number, editionLabel: string | null = null): string {
  const parts: string[] = [`${VERSION_TEXT.prefix}${version}`];
  const label = normalizeLabel(editionLabel);
  if (label !== null) parts.push(label);
  parts.push(`${VERSION_TEXT.save}${saveVersion}`);
  return parts.join(VERSION_TEXT.separator);
}

// Accessible label, e.g. 'Version 0.9.0' or 'Version 0.9.0 DEMO'.
export function versionAriaLabel(version: string, editionLabel: string | null = null): string {
  const parts: string[] = [VERSION_TEXT.ariaPrefix, version];
  const label = normalizeLabel(editionLabel);
  if (label !== null) parts.push(label);
  return parts.join(' ');
}
