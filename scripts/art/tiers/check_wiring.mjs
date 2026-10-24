// Part evolution tiers (WP22): wiring completeness of public/assets/machine/tiers/** against the manifest.
//   node scripts/art/tiers/check_wiring.mjs [--report <out.md>]
// Checks: every PNG on disk is referenced exactly once (tiers file / rotationFile / pulseFile or a decal entry file),
// every manifest reference exists; naming rule (machine/tiers/<stem>-t<N>.png, machine/tiers/rot/<stem>-t<N>-rot.png,
// machine/tiers/<stem>-t<N>b.png, machine/tiers/decals/*.png; <stem> = the entry's own file stem); `from` 2..5 strictly
// ascending; rotationFile iff the entry has `rotation` (a rotation tier carries BOTH file and rotationFile); pulseFile
// only on the highest tier of an asset and never on a rotation asset; no entry has both tiers and restored; PNG size =
// entry size (frame sheets: the shipped sheet size; rot sheets: the shipped rot sheet size); the variant set equals the
// expected table below (PART_TIERS 2.3 + WP22 D10; top tier = the track's tier count, pulse only at the top).
// Exit code 1 on any failure. Read-only: never writes into the repo.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ASSETS = join(ROOT, 'public', 'assets');
const TIERS = join(ASSETS, 'machine', 'tiers');
const require = createRequire(join(ROOT, 'package.json'));
const esbuild = require('esbuild');

// asset id -> { track, top (track tier count), tiers (declared `from` list), rot, pulse (tier with a heartbeat frame) }
const EXPECTED = {
  'machine.motor': { track: 'motorTuning', top: 5, tiers: [2, 3, 4, 5], pulse: 5 },
  'machine.motorPlinth': { track: 'motorTuning', top: 5, tiers: [2, 3, 4, 5] },
  'machine.gearLarge': { track: 'gearRatio', top: 3, tiers: [2, 3], rot: true },
  'machine.gearSmall': { track: 'gearRatio', top: 3, tiers: [2, 3], rot: true },
  'machine.pulleyMain': { track: 'gearRatio', top: 3, tiers: [2, 3], rot: true },
  'machine.flywheel': { track: 'flywheel', top: 3, tiers: [3], rot: true },
  'machine.pulleyFlywheel': { track: 'flywheel', top: 3, tiers: [3], rot: true },
  'machine.pulleyCrank': { track: 'flywheel', top: 3, tiers: [3], rot: true },
  'machine.pedestal': { track: 'flywheel', top: 3, tiers: [2, 3], pulse: 3 },
  'machine.pistonBlock': { track: 'improvedPistons', top: 5, tiers: [2, 3, 4, 5], pulse: 5 },
  'machine.coils1': { track: 'copperWinding', top: 5, tiers: [2] },
  'machine.coils3': { track: 'copperWinding', top: 5, tiers: [5] },
  'machine.motorRetrofit': { track: 'motorRetrofit', top: 5, tiers: [2, 3, 4, 5], pulse: 5 },
  'machine.transformer': { track: 'transformer', top: 5, tiers: [2, 3, 4, 5], pulse: 5 },
  'machine.fireGlow1': { track: 'firebox', top: 5, tiers: [2] },
  'machine.fireGlow3': { track: 'firebox', top: 5, tiers: [5] },
  'machine.inductionHeater': { track: 'inductionHeater', top: 5, tiers: [2, 3, 4, 5], pulse: 5 },
  'machine.condenser': { track: 'condenser', top: 5, tiers: [2, 3, 4, 5], pulse: 5 },
  'machine.bellows': { track: 'bellowsDrive', top: 3, tiers: [2, 3], pulse: 3 },
  'machine.coilRing1': { track: 'harmonicCoil', top: 5, tiers: [2] },
  'machine.calliope': { track: 'pressureResonator', top: 5, tiers: [2, 3, 4, 5], pulse: 5 },
  'machine.servoBase': { track: 'crankServo', top: 3, tiers: [2, 3], pulse: 3 },
  'machine.servoArm': { track: 'crankServo', top: 3, tiers: [2, 3], rot: true },
  'machine.spireWave': { track: 'standingWave', top: 5, tiers: [2, 3, 4, 5] },
  'machine.exciterFeed': { track: 'gridExciter', top: 3, tiers: [2, 3], pulse: 3 },
  'machine.backfeedTerminal': { track: 'mainsBackfeed', top: 3, tiers: [2, 3], pulse: 3 },
  'machine.steamLance': { track: 'steamLance', top: 3, tiers: [2, 3], pulse: 3 },
};
const DECALS = { 'machine.gearRim': 64, 'machine.flywheelRim2': 96, 'machine.flywheelRim3': 96 };

function pngSize(path) {
  const b = readFileSync(path);
  if (b.readUInt32BE(12) !== 0x49484452) throw new Error(`${path}: no IHDR`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

async function loadManifest() {
  const res = await esbuild.build({
    entryPoints: [join(ROOT, 'src', 'assets', 'manifest.ts')], bundle: true, write: false, format: 'esm',
    platform: 'neutral', logLevel: 'silent',
  });
  const code = res.outputFiles[0].text;
  const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  return mod.ASSET_MANIFEST;
}

const stemOf = (file) => basename(file).replace(/\.png$/, '');

async function main() {
  const args = process.argv.slice(2);
  const reportAt = args.indexOf('--report');
  const manifest = await loadManifest();
  const fails = [];
  const refs = new Map();   // 'machine/tiers/...' -> [where]
  const ref = (file, where) => { refs.set(file, [...(refs.get(file) ?? []), where]); };
  const rows = [];
  const decoded = [];
  for (const entry of Object.values(manifest)) {
    const id = entry.id;
    const exp = EXPECTED[id];
    if (DECALS[id] !== undefined) {
      const want = `machine/tiers/decals/${basename(entry.file ?? '')}`;
      if (entry.file !== want) fails.push(`${id}: decal file ${entry.file}, expected under machine/tiers/decals/`);
      if (entry.width !== DECALS[id] || entry.height !== DECALS[id]) fails.push(`${id}: decal size ${entry.width}x${entry.height}`);
      if (entry.file) ref(entry.file, `${id} (decal)`);
      rows.push(`| \`${id}\` | decal | \`${entry.file}\` | - | - |`);
      continue;
    }
    if (!entry.tiers) {
      if (exp) fails.push(`${id}: expected tiers ${exp.tiers.join('/')}, manifest has none`);
      continue;
    }
    if (!exp) fails.push(`${id}: has tiers but is not an expected tier host`);
    if (entry.restored) fails.push(`${id}: has both tiers and restored`);
    const stem = stemOf(entry.file ?? '');
    const froms = entry.tiers.map((t) => t.from);
    for (let i = 0; i < froms.length; i++) {
      if (froms[i] < 2 || froms[i] > 5 || (i > 0 && froms[i] <= froms[i - 1])) fails.push(`${id}: from list ${froms.join('/')} not strictly ascending in 2..5`);
    }
    if (exp && froms.join('/') !== exp.tiers.join('/')) fails.push(`${id}: tiers ${froms.join('/')}, expected ${exp.tiers.join('/')}`);
    if (exp && Math.max(...froms) > exp.top) fails.push(`${id}: tier ${Math.max(...froms)} above the ${exp.track} top ${exp.top}`);
    const top = Math.max(...froms);
    const baseSize = pngSize(join(ASSETS, entry.file));
    const rotSize = entry.rotation ? pngSize(join(ASSETS, entry.rotation.file)) : null;
    for (const t of entry.tiers) {
      const n = t.from;
      const want = `machine/tiers/${stem}-t${n}.png`;
      if (t.file !== want) fails.push(`${id} t${n}: file ${t.file}, expected ${want}`);
      ref(t.file, `${id} t${n} file`);
      if (entry.rotation) {
        const wantRot = `machine/tiers/rot/${stem}-t${n}-rot.png`;
        if (!t.rotationFile) fails.push(`${id} t${n}: rotation asset tier without rotationFile`);
        else {
          if (t.rotationFile !== wantRot) fails.push(`${id} t${n}: rotationFile ${t.rotationFile}, expected ${wantRot}`);
          ref(t.rotationFile, `${id} t${n} rotationFile`);
        }
        if (t.pulseFile) fails.push(`${id} t${n}: pulseFile on a rotation asset`);
      } else if (t.rotationFile) fails.push(`${id} t${n}: rotationFile on an asset without rotation`);
      if (t.pulseFile) {
        const wantPulse = `machine/tiers/${stem}-t${n}b.png`;
        if (t.pulseFile !== wantPulse) fails.push(`${id} t${n}: pulseFile ${t.pulseFile}, expected ${wantPulse}`);
        if (n !== top) fails.push(`${id} t${n}: pulseFile below the asset's highest tier t${top}`);
        if (exp && exp.pulse !== n) fails.push(`${id} t${n}: unexpected pulseFile (expected ${exp.pulse ? 't' + exp.pulse : 'none'})`);
        ref(t.pulseFile, `${id} t${n} pulseFile`);
      } else if (exp && exp.pulse === n) fails.push(`${id} t${n}: missing pulseFile (heartbeat host)`);
      const check = (file, size, what) => {
        const p = join(ASSETS, file);
        let s;
        try { s = pngSize(p); } catch { fails.push(`${id} t${n}: ${what} ${file} missing on disk`); return; }
        decoded.push({ file, bytes: s.w * s.h * 4 });
        if (s.w !== size.w || s.h !== size.h) fails.push(`${id} t${n}: ${what} ${s.w}x${s.h}, shipped ${size.w}x${size.h}`);
      };
      check(t.file, baseSize, 'file');
      if (t.rotationFile && rotSize) check(t.rotationFile, rotSize, 'rotationFile');
      if (t.pulseFile) check(t.pulseFile, baseSize, 'pulseFile');
    }
    rows.push(`| \`${id}\` | ${exp ? `${exp.track} (${exp.top})` : '?'} | ${entry.tiers.map((t) => `t${t.from}`).join(', ')} | ${entry.rotation ? 'yes' : '-'} | ${entry.tiers.filter((t) => t.pulseFile).map((t) => `t${t.from}b`).join(', ') || '-'} |`);
  }
  for (const id of Object.keys(EXPECTED)) if (!manifest[id]) fails.push(`${id}: expected tier host missing from the manifest`);
  for (const id of Object.keys(DECALS)) if (!manifest[id]) fails.push(`${id}: decal entry missing from the manifest`);
  for (const id of Object.keys(DECALS)) {
    const e = manifest[id];
    if (e?.file) {
      try { const s = pngSize(join(ASSETS, e.file)); decoded.push({ file: e.file, bytes: s.w * s.h * 4 }); } catch { fails.push(`${id}: ${e.file} missing on disk`); }
    }
  }
  const disk = walk(TIERS).map((p) => relative(ASSETS, p).split('\\').join('/'));
  const pngs = disk.filter((f) => f.endsWith('.png'));
  for (const f of disk) if (!f.endsWith('.png')) fails.push(`stray non-PNG file on disk: ${f}`);
  for (const f of pngs) {
    const r = refs.get(f) ?? [];
    if (r.length !== 1) fails.push(`${f}: referenced ${r.length} times${r.length ? ' (' + r.join('; ') + ')' : ''}`);
  }
  for (const f of refs.keys()) if (!pngs.includes(f)) fails.push(`${f}: referenced but not on disk`);
  const bytes = pngs.reduce((s, f) => s + statSync(join(ASSETS, f)).size, 0);
  const dec = decoded.reduce((s, d) => s + d.bytes, 0);
  const lines = [
    '# Tier wiring (check_wiring.mjs)', '',
    `PNGs on disk: ${pngs.length}. Manifest tier references: ${refs.size}. Bytes: ${bytes} (${(bytes / 1024).toFixed(1)} KB, budget 1,228,800).`,
    `Decoded RGBA of the added textures: ${dec} B (${(dec / 1048576).toFixed(2)} MiB).`, '',
    '| asset | track (tiers) | variants | rot | pulse |', '|---|---|---|---|---|', ...rows, '',
    `Failures: ${fails.length}`, ...fails.map((f) => '- ' + f), '',
  ];
  if (reportAt >= 0 && args[reportAt + 1]) {
    mkdirSync(dirname(args[reportAt + 1]), { recursive: true });
    writeFileSync(args[reportAt + 1], lines.join('\n'));
  }
  console.log(`pngs ${pngs.length}, refs ${refs.size}, bytes ${bytes}, decodedMiB ${(dec / 1048576).toFixed(2)}, failures ${fails.length}`);
  for (const f of fails) console.log('FAIL', f);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
