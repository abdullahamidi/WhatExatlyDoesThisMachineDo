// Build-only source transform for the asset manifest (vite.config.ts, apply 'build'). The description lines of src/assets/manifest.ts
// are documentation: the generated ASSET_GUIDE table and the manifest tests read them, no runtime code does. The app build drops
// them to stay inside the app chunk budget (P14); the source keeps them. Pure: no Phaser, no DOM, no node imports.

// One backslash, built from its code so no escape in this file can be mistaken for one.
const BS = String.fromCharCode(92);

// The manifest module, as Vite passes its id (forward slashes after normalising).
const MANIFEST_SUFFIX = '/src/assets/manifest.ts';

// One whole description line: an indent, `description: `, a single-quoted string, an optional comma and a LF or CRLF end.
// Inside the string a backslash escapes the next character, and no other character may be a quote, a backslash or a line break:
// the class is [^'\\\r\n] (quote, backslash, CR, LF) and the escape is \\. (a backslash and any character).
const DESCRIPTION_LINE = new RegExp(
  '^[ \\t]+description: \'(?:[^\'' + BS + BS + '\\r\\n]|' + BS + BS + '.)*\',?\\r?\\n',
  'gm',
);

/** The code with every whole description line removed. Every other character is returned unchanged; the input is not changed. */
export function stripManifestDescriptions(code: string): string {
  return code.replace(DESCRIPTION_LINE, '');
}

/** True when a module id is the asset manifest. Windows ids (backslashes) and posix ids both match. */
export function isManifestModule(id: string): boolean {
  return id.split(BS).join('/').endsWith(MANIFEST_SUFFIX);
}
