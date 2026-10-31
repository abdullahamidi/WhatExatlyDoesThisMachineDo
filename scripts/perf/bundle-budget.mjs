// WP15 bundle budget. Usage: node scripts/perf/bundle-budget.mjs [distDir]   (default: dist, relative to repo root)
// Reads the built app (index-*.js, phaser-*.js, *.css under <distDir>/assets) and public/assets.
// Limits for the raw rows come from scripts/smoke/perf-budget.json ("bundle" block, decimal KB / MB).
// App js gzip is report-only since WP15R (program D7: raw sizes only): printed with status 'report', never a breach.
// The lazy living-world chunk (LivingWorldDirector-*.js) is gated by bundle.lazyWorldKb (WP23a: the app chunk stays under appRawKb because the director loads lazily).
// The lazy fault marker chunk (FaultMarker-*.js) is gated by bundle.lazyFaultKb when that key exists (WP27; sum 0 when the chunk is absent).
// WP28: the lazy WorldReach chunk (WorldReach-*.js) is gated by bundle.lazyReachKb; every other lazy *.js (shared data and maths chunks) by bundle.lazySharedKb;
// the lazy world total (Director + WorldReach + shared) by bundle.lazyWorldTotalKb (fixed ceiling, plan WP28 D8).
// Prints a table; exit 1 on any breach.
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { gzipSync } from 'zlib';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const distDir = resolve(root, process.argv[2] ?? 'dist');
const assetsDir = join(distDir, 'assets');
const budget = JSON.parse(readFileSync(join(root, 'scripts', 'smoke', 'perf-budget.json'), 'utf8')).bundle;
const KB = 1000;

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...listFiles(p));
    else if (name.isFile()) out.push(p);
  }
  return out;
}

function dirBytes(dir) {
  return listFiles(dir).reduce((sum, f) => sum + statSync(f).size, 0);
}

if (!existsSync(assetsDir)) {
  console.error(`bundle-budget: ${assetsDir} missing; run the production build first`);
  process.exit(1);
}

const files = readdirSync(assetsDir).filter((f) => statSync(join(assetsDir, f)).isFile());
const appJs = files.filter((f) => /^index-.*\.js$/.test(f));
const phaserJs = files.filter((f) => /^phaser-.*\.js$/.test(f));
const css = files.filter((f) => f.endsWith('.css'));
const lazyWorld = files.filter((f) => /^LivingWorldDirector-.*.js$/.test(f));
const lazyFault = files.filter((f) => /^FaultMarker-.*\.js$/.test(f));
const lazyReach = files.filter((f) => /^WorldReach-.*\.js$/.test(f));
const lazyShared = files.filter((f) => f.endsWith('.js') && !/^(index|phaser|LivingWorldDirector|FaultMarker|WorldReach|demoEnd)-/.test(f));

if (appJs.length === 0) {
  console.error('bundle-budget: no index-*.js app chunk in ' + assetsDir);
  process.exit(1);
}

const sum = (list, fn) => list.reduce((s, f) => s + fn(join(assetsDir, f)), 0);
const rawOf = (p) => statSync(p).size;
const gzOf = (p) => gzipSync(readFileSync(p)).length;

const rows = [];
const row = (name, value, limit, unit, reportOnly = false) => {
  const ok = reportOnly ? true : value <= limit;
  rows.push({ name, value, limit: reportOnly ? '-' : limit, unit, ok, reportOnly });
};

row('app js raw (index-*.js)', sum(appJs, rawOf) / KB, budget.appRawKb, 'KB');
row('app js gzip (index-*.js)', sum(appJs, gzOf) / KB, undefined, 'KB', true);
row('phaser js raw (phaser-*.js)', sum(phaserJs, rawOf) / KB, budget.phaserKb, 'KB');
if (budget.lazyWorldKb !== undefined) row('lazy world js raw (Director-*.js)', sum(lazyWorld, rawOf) / KB, budget.lazyWorldKb, 'KB');
if (budget.lazyFaultKb !== undefined) row('lazy fault marker js raw (FaultMarker-*.js)', sum(lazyFault, rawOf) / KB, budget.lazyFaultKb, 'KB');
if (budget.lazyReachKb !== undefined) row('lazy reach js raw (WorldReach-*.js)', sum(lazyReach, rawOf) / KB, budget.lazyReachKb, 'KB');
if (budget.lazySharedKb !== undefined) row('lazy shared js raw (other lazy *.js)', sum(lazyShared, rawOf) / KB, budget.lazySharedKb, 'KB');
if (budget.lazyWorldTotalKb !== undefined) {
  row('lazy world total (Director+Reach+shared)', (sum(lazyWorld, rawOf) + sum(lazyReach, rawOf) + sum(lazyShared, rawOf)) / KB, budget.lazyWorldTotalKb, 'KB');
}
row('css raw (*.css)', sum(css, rawOf) / KB, budget.cssKb, 'KB');
const publicDir = join(root, 'public', 'assets');
const publicKb = existsSync(publicDir) ? dirBytes(publicDir) / KB : 0;
row('public/assets total', publicKb, budget.publicAssetsKb, 'KB');

const fmt = (n) => n.toFixed(1).padStart(10);
console.log(`bundle budget (${distDir}; decimal KB)`);
console.log('metric'.padEnd(44) + 'value'.padStart(10) + '  limit'.padEnd(12) + 'status');
for (const r of rows) {
  const status = r.reportOnly ? 'report' : r.ok ? 'ok' : 'BREACH';
  console.log(r.name.padEnd(44) + fmt(r.value) + '  ' + String(r.limit).padEnd(10) + status);
}
const breaches = rows.filter((r) => !r.ok);
console.log(breaches.length === 0 ? 'bundle budget: PASS' : `bundle budget: FAIL (${breaches.length} breach)`);
process.exitCode = breaches.length === 0 ? 0 : 1;
