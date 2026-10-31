// src/data/version.ts - APP_VERSION must equal package.json and desktop/package.json 'version' (checked by src/data/packageVersion.test.ts)
export const APP_VERSION = '0.12.0';
export const VERSION_TEXT = { prefix: 'v', save: 'SAVE v', separator: ' · ', ariaPrefix: 'Version' } as const;
