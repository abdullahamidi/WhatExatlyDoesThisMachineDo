import { describe, it, expect } from 'vitest';
import rootPkg from '../../package.json';
import desktopPkg from '../../desktop/package.json';
import { APP_VERSION } from './version';

// The root package, the desktop package and the in-game version must agree. The Electron, packager and fuses pins
// are part of the Steam build contract (WP19), so a silent bump fails here.
describe('package versions', () => {
  it('root package.json version matches APP_VERSION', () => {
    expect(rootPkg.version).toBe(APP_VERSION);
  });

  it('desktop package.json version matches APP_VERSION', () => {
    expect(desktopPkg.version).toBe(APP_VERSION);
  });

  it('desktop entry point is main.cjs', () => {
    expect(desktopPkg.main).toBe('main.cjs');
  });

  it('pins Electron 44.7.0', () => {
    expect(rootPkg.devDependencies['electron']).toBe('44.7.0');
  });

  it('pins @electron/packager 20.3.0', () => {
    expect(rootPkg.devDependencies['@electron/packager']).toBe('20.3.0');
  });

  it('pins @electron/fuses 2.1.3', () => {
    expect(rootPkg.devDependencies['@electron/fuses']).toBe('2.1.3');
  });
});
