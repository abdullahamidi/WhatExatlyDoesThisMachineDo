// WP15R perf tables: median.json (scripts/perf/perf-median.mjs output) -> Markdown tables on stdout.
// Usage: node scripts/perf/perf-tables.mjs <median.json>
// Values print as stored (String(value)); null / missing -> '-'. A section without source data is skipped.
// Missing / unreadable / invalid input: message on stderr, exit 2.
import { readFileSync } from 'fs';

const STAGES = ['s0_crank', 's7_era1_full', 's9_era2_full', 's11_era3_full', 's13_era4_full', 's15_era5_full', 's16_postgame'];
const FINALE_T = ['t8', 't22', 't34', 't36'];
const GPU_ONLY = ['frameP95Ms', 'postFrameP95Ms'];

// ---- helpers -------------------------------------------------------------------------------------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// null-safe path read: at(o, 'a', 'b') = o.a.b, null when any step is missing
const at = (o, ...path) => {
  let cur = o;
  for (const k of path) {
    if (!isObj(cur)) return null;
    cur = cur[k];
  }
  return cur === undefined ? null : cur;
};
const cell = (v) => (v === null || v === undefined ? '-' : String(v));
const pick = (o, keys) => keys.map((k) => at(o, k));
const tableRows = (header, rows) => {
  if (rows.length === 0) return [];
  const line = (cells) => `| ${cells.map(cell).join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)];
};
const statusOf = (key, value, budget, gpu) => {
  if (value === null || budget === null) return '-';
  if (GPU_ONLY.includes(key) && !gpu) return 'report';
  return value <= budget ? 'ok' : 'BREACH';
};

// ---- sections ------------------------------------------------------------------------------------
function build(median) {
  const lines = [];
  const block = (title, body) => {
    if (body.length > 0) lines.push('', `#### ${title}`, '', ...body);
  };
  const gpu = at(median, 'gpu') === true;
  const runs = cell(at(median, 'runs'));
  const renderers = at(median, 'renderers');
  const rendererText = Array.isArray(renderers) && renderers.length > 0 ? renderers.map(cell).join(' | ') : '-';

  const stageOf = (name) => at(median, 'stages', name);
  // each stage value is the median of its own n runs (stages[*].n); 'runs' counts input files, not n
  const nStage = Math.max(0, ...STAGES.map((n) => num(at(stageOf(n), 'n')) ?? 0));
  const nStageLabel = nStage > 0 ? String(nStage) : '-';
  lines.push(`Renderer: ${rendererText}; GPU gate: ${gpu ? 'yes' : 'no'}; runs: ${runs} files (median of ${nStageLabel} per stage)`);

  const present = STAGES.filter((n) => stageOf(n) !== null);
  const s15 = stageOf('s15_era5_full');
  const s16 = stageOf('s16_postgame');

  // idle windows
  const idleKeys = ['n', 'machineMeanMs', 'machineMaxMs', 'uiMeanMs', 'uiMaxMs', 'displayObjects', 'frameP50Ms', 'frameP95Ms', 'frameMaxMs'];
  block(`Idle windows (median of ${nStageLabel})`, tableRows(
    ['stage', 'n', 'machine mean ms', 'machine max ms', 'ui mean ms', 'ui max ms', 'displayObjects', 'frame p50 ms', 'frame p95 ms', 'frame max ms'],
    present.map((n) => [n, ...pick(stageOf(n), idleKeys)]),
  ));

  // post-purchase windows: a window exists when okAll is non-null (null = no input had it)
  const postRows = [];
  for (const n of present) {
    for (const win of ['repeat', 'keystone']) {
      const p = at(stageOf(n), 'post', win);
      if (at(p, 'okAll') === null) continue;
      const vals = pick(p, ['frameP95Ms', 'frameMaxMs', 'machineMeanMs', 'machineMaxMs', 'uiMaxMs', 'displayObjects']);
      postRows.push([n, win, at(p, 'id'), ...vals]);
    }
  }
  block('Post-purchase windows (0-3 s after a purchase)', tableRows(
    ['stage', 'window', 'tech', 'frame p95 ms', 'frame max ms', 'machine mean ms', 'machine max ms', 'ui max ms', 'displayObjects'],
    postRows,
  ));

  // finale
  const finale = at(median, 'finale');
  const hasFinale = FINALE_T.some((t) => (at(finale, t, 'n') ?? 0) > 0);
  const finaleKeys = ['finaleMeanMs', 'machineMeanMs', 'machineMaxMs', 'uiMeanMs', 'uiMaxMs', 'displayObjects'];
  block('Finale', hasFinale ? tableRows(
    ['t', 'finaleMeanMs', 'machine mean ms', 'machine max ms', 'ui mean ms', 'ui max ms', 'displayObjects'],
    FINALE_T.map((t) => [t, ...pick(at(finale, t), finaleKeys)]),
  ) : []);

  // boot, heap, tech tree, cycle
  const bootRows = [
    ['navToBootMs', at(median, 'boot', 'navToBootMs')],
    ['bootMs', at(median, 'boot', 'bootMs')],
    ['bootToFirstFrameMs', at(median, 'boot', 'bootToFirstFrameMs')],
    ['heap used MB (s15)', at(s15, 'heap', 'usedMb')],
    ['heap growth MB (s15)', at(s15, 'heap', 'growthMb')],
    ['tech tree open ms (s15)', at(s15, 'techTree', 'medianMs')],
    ['cycle display pct (s16)', at(s16, 'cycle', 'pct')],
  ];
  if (bootRows.some(([, v]) => v !== null)) block('Boot, heap, tech tree, cycle', tableRows(['item', 'value'], bootRows));

  // audio
  const audioKeys = ['era', 'theme', 'musicBus', 'liveVoices', 'musicVoices', 'peakDb'];
  block('Audio', tableRows(
    ['stage', 'era', 'theme', 'musicBus', 'liveVoices', 'musicVoices', 'peakDb'],
    present.map((n) => [n, ...pick(at(stageOf(n), 'audio'), audioKeys)]),
  ));

  // gate
  const gate = at(median, 'gate');
  const budgets = at(median, 'budgets');
  const gateRows = isObj(gate)
    ? Object.keys(gate).map((key) => [key, gate[key], at(budgets, key), statusOf(key, num(gate[key]), num(at(budgets, key)), gpu)])
    : [];
  block('Gate', tableRows(['key', 'value', 'budget', 'status'], gateRows));

  // s15 ui stats vs a0 reference
  if (s15 !== null) {
    block('s15 uiStats vs a0 reference', tableRows(['metric', 'measured', 'a0 reference'], [
      ['ui mean ms', at(s15, 'uiMeanMs'), '~0.08'],
      ['ui max ms', at(s15, 'uiMaxMs'), '<= 0.4'],
    ]));
  }

  const failList = at(median, 'fail');
  const fail = Array.isArray(failList) ? failList.map(String) : [];
  lines.push('', `fail: ${fail.length > 0 ? fail.join('; ') : 'none'}`);
  return lines;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write('usage: node scripts/perf/perf-tables.mjs <median.json>\n');
    return 2;
  }
  let median;
  try {
    median = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    process.stderr.write(`perf-tables: cannot read ${file}: ${String(e && e.message ? e.message : e).split('\n')[0]}\n`);
    return 2;
  }
  if (!isObj(median)) {
    process.stderr.write(`perf-tables: ${file} is not a median.json object\n`);
    return 2;
  }
  process.stdout.write(`${build(median).join('\n')}\n`);
  return 0;
}

process.exitCode = main();
