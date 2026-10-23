// WP19 T10 desktop packaging: vite build -> stage -> @electron/packager -> SteamPipe ContentRoot -> fuses.
// Vite writes build/vite-<edition>/ per edition; dist/ (the browser build) is never written here.
// Usage: node scripts/desktop/package.mjs [--mode production|demo] [--no-asar-integrity]
//   --mode production (default)  full edition -> out/steam/full/win-x64/
//   --mode demo                  demo edition -> out/steam/demo/win-x64/
//   --no-asar-integrity          documented fallback (decision D17): EnableEmbeddedAsarIntegrityValidation OFF,
//                                the other four fuses stay as set. Only for a build that does not boot with the
//                                integrity fuse ON.
// Works from any cwd: root = two levels up from this file.
// Stdout: exactly one JSON line { edition, mode, version, dest, exe, files, sizeMB } (last line).
// Progress, fuse wire and errors go to stderr. Vite's own stdout is sent to stderr for the same reason.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { packager } from '@electron/packager';
import { FuseState, FuseV1Options, FuseVersion, flipFuses, getCurrentFuseWire } from '@electron/fuses';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESKTOP_DIR = path.join(ROOT, 'desktop');
const STAGE_DIR = path.join(ROOT, 'build', 'desktop-app');
const PACKAGER_OUT = path.join(ROOT, 'build', 'packager');
const STEAM_OUT = path.join(ROOT, 'out', 'steam');
const EXE_NAME = 'WhatExactlyDoesThisMachineDo';
const APP_TITLE = 'What Exactly Does This Machine Do?';
const COMPANY = 'abdullahamidi';
const COPYRIGHT = '© 2026 abdullahamidi';
const MODES = ['production', 'demo'];
const DEFAULT_MODE = 'production';
const MB = 1024 * 1024;

function fail(message, code = 1) {
  console.error(`package: ${message}`);
  process.exit(code);
}

// 1. Arguments

function parseArgs(argv) {
  const opts = { mode: DEFAULT_MODE, noAsarIntegrity: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-asar-integrity') {
      opts.noAsarIntegrity = true;
    } else if (arg === '--mode') {
      opts.mode = argv[++i] ?? '';
    } else if (arg.startsWith('--mode=')) {
      opts.mode = arg.slice('--mode='.length);
    } else {
      fail(`unknown argument: ${arg}`, 2);
    }
  }
  if (!MODES.includes(opts.mode)) {
    fail(`invalid --mode "${opts.mode}" (expected ${MODES.join(' or ')})`, 2);
  }
  return opts;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// 2. Vite build for the chosen mode (vite stdout goes to stderr; stdout stays the JSON line)

// Own output folder per edition, so a demo build never overwrites the browser dist/.
function viteBuild(mode, edition) {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const outDir = path.join(ROOT, 'build', `vite-${edition}`);
  const args = ['build', '--mode', mode, '--outDir', outDir, '--emptyOutDir'];
  const result = spawnSync(process.execPath, [viteBin, ...args], {
    stdio: ['inherit', 2, 'inherit'],
    cwd: ROOT,
  });
  if (result.error) fail(`vite build failed to start: ${result.error.message}`);
  if (result.status !== 0) fail(`vite build failed (status ${result.status})`);
  if (!fs.existsSync(path.join(outDir, 'index.html'))) fail(`vite build produced no ${outDir}/index.html`);
  return outDir;
}

// 3. Stage the app folder that packager reads

function stageApp(version, edition, viteOutDir) {
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.cpSync(viteOutDir, path.join(STAGE_DIR, 'dist'), { recursive: true });
  for (const file of ['main.cjs', 'preload.cjs', 'edition.cjs', 'icon.png']) {
    fs.copyFileSync(path.join(DESKTOP_DIR, file), path.join(STAGE_DIR, file));
  }
  const desktopPkg = readJson(path.join(DESKTOP_DIR, 'package.json'));
  fs.writeFileSync(
    path.join(STAGE_DIR, 'package.json'),
    JSON.stringify({ ...desktopPkg, version, wedtmdEdition: edition }, null, 2) + '\n',
  );
}

// 4. Package with @electron/packager (asar on, Windows metadata, pinned Electron version)

async function packageApp(version, edition) {
  const electronVersion = readJson(path.join(ROOT, 'node_modules', 'electron', 'package.json')).version;
  const title = APP_TITLE + (edition === 'demo' ? ' Demo' : '');
  const appDirs = await packager({
    dir: STAGE_DIR,
    out: PACKAGER_OUT,
    overwrite: true,
    quiet: true,
    platform: 'win32',
    arch: 'x64',
    asar: true,
    icon: path.join(DESKTOP_DIR, 'icon.ico'),
    name: EXE_NAME,
    executableName: EXE_NAME,
    appVersion: version,
    buildVersion: version,
    electronVersion,
    appCopyright: COPYRIGHT,
    win32metadata: {
      CompanyName: COMPANY,
      ProductName: title,
      FileDescription: title,
      InternalName: EXE_NAME,
      OriginalFilename: `${EXE_NAME}.exe`,
    },
  });
  const appDir = appDirs[0];
  if (appDir === undefined) fail('packager returned no output folder');
  return appDir;
}

// 5. Copy into the SteamPipe ContentRoot and add the license notice

function copyToContentRoot(appDir, edition) {
  const dest = path.join(STEAM_OUT, edition, 'win-x64');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(appDir, dest, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.txt'), path.join(dest, 'THIRD_PARTY_NOTICES.txt'));
  return dest;
}

// 6. Fuses: five flips (decision D17). --no-asar-integrity turns only the integrity fuse OFF.

async function applyFuses(exe, noAsarIntegrity) {
  await flipFuses(exe, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: !noAsarIntegrity,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
  const wire = await getCurrentFuseWire(exe);
  const stateName = new Map([
    [FuseState.DISABLE, 'off'],
    [FuseState.ENABLE, 'on'],
    [FuseState.REMOVED, 'removed'],
    [FuseState.INHERIT, 'inherit'],
  ]);
  const parts = Object.entries(FuseV1Options)
    .filter(([name]) => Number.isNaN(Number(name)))
    .map(([name, index]) => `${name}=${stateName.get(wire[index]) ?? String(wire[index])}`);
  console.error(`fuse wire v${wire.version}: ${parts.join(' ')}`);
}

// 7. Size summary

function walk(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = walk(full);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += fs.statSync(full).size;
    }
  }
  return { files, bytes };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const edition = opts.mode === 'demo' ? 'demo' : 'full';
  const version = readJson(path.join(ROOT, 'package.json')).version;

  console.error(`package: vite build --mode ${opts.mode} -> build/vite-${edition}`);
  const viteOutDir = viteBuild(opts.mode, edition);

  console.error('package: stage build/desktop-app');
  stageApp(version, edition, viteOutDir);

  console.error('package: @electron/packager win32-x64');
  const appDir = await packageApp(version, edition);

  console.error(`package: copy to out/steam/${edition}/win-x64`);
  const dest = copyToContentRoot(appDir, edition);

  const exe = path.join(dest, `${EXE_NAME}.exe`);
  if (!fs.existsSync(exe)) fail(`exe missing after copy: ${exe}`);
  console.error(`package: fuses (asar integrity ${opts.noAsarIntegrity ? 'OFF (--no-asar-integrity)' : 'ON'})`);
  await applyFuses(exe, opts.noAsarIntegrity);

  const { files, bytes } = walk(dest);
  const sizeMB = Number((bytes / MB).toFixed(1));
  console.log(JSON.stringify({ edition, mode: opts.mode, version, dest, exe, files, sizeMB }));
}

main().catch((err) => {
  console.error(`package: failed: ${err && err.stack ? err.stack : String(err)}`);
  process.exit(1);
});
