// WP15R perf median merge + gate recompute. Usage: node scripts/perf/perf-median.mjs <perf.json> [<perf.json> ...]
// Inputs: outputs of scripts/smoke/perf.mjs ({ metrics, budgets, fail, errors }). Inputs may be halves (perf.mjs ONLY=...):
// each stage is medianed over the inputs that contain it (stage.n = how many inputs contained it).
// Gate: same formulas as perf.mjs, recomputed from the MEDIAN records. frameP95Ms and postFrameP95Ms are the max over the
// per-stage medians of the per-stage p95 (conservative: a max of p95s, not a pooled p95 over all windows).
// Budgets: numeric top-level keys of scripts/smoke/perf-budget.json (PERF_* env overrides are not applied here).
// GPU-only keys (frameP95Ms, postFrameP95Ms) gate only when every input ran with PERF_GPU=1 (budgets.frameP95MsGated).
// post.*.okAll: true only when every input that has the window has all its ok flags true (no flags = not ok); null when no input has it.
// Medians skip null / non-finite values; numeric outputs rounded to 2 decimals; a field with no numeric input stays null.
// Prints ONE JSON on stdout. PERF_STRICT=1 exits 1 when fail is non-empty. Missing / unreadable input exits 2.
import { readFileSync } from 'fs';

const STAGE_FIELDS = ['machineMeanMs', 'machineMaxMs', 'machineMaxMsRaw', 'uiMeanMs', 'uiMaxMs', 'uiMaxMsRaw', 'displayObjects', 'frameP50Ms', 'frameP95Ms', 'frameMaxMs'];
const REPEAT_FIELDS = ['frameP95Ms', 'frameMaxMs', 'machineMeanMs', 'machineMaxMs', 'machineMaxMsRaw', 'uiMaxMs', 'displayObjects'];
const KEYSTONE_FIELDS = ['frameP95Ms', 'frameMaxMs', 'machineMeanMs', 'machineMaxMs', 'uiMaxMs', 'displayObjects'];
const FINALE_T = ['t8', 't22', 't34', 't36'];
const FINALE_FIELDS = ['finaleMeanMs', 'machineMeanMs', 'machineMaxMs', 'uiMeanMs', 'uiMaxMs', 'displayObjects'];
const BOOT_FIELDS = ['bootMs', 'navToBootMs', 'bootToFirstFrameMs'];
const GPU_ONLY = ['frameP95Ms', 'postFrameP95Ms'];
const CARRIED = ['audioEra', 'audioTheme', 'audioWiring', 'gpu', 'errors'];

// ---- helpers -------------------------------------------------------------------------------------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (v) => (num(v) === null ? null : Math.round(v * 100) / 100);
const med = (xs) => {
  const a = xs.map(num).filter((v) => v !== null).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const m = a.length >> 1;
  return round(a.length % 2 === 1 ? a[m] : (a[m - 1] + a[m]) / 2);
};
const max = (xs) => {
  let best = null;
  for (const x of xs) {
    const v = num(x);
    if (v !== null && (best === null || v > best)) best = v;
  }
  return round(best);
};
// null-safe path read: at(o, 'a', 'b') = o.a.b, null when any step is missing
const at = (o, ...path) => {
  let cur = o;
  for (const k of path) {
    if (!isObj(cur)) return null;
    cur = cur[k];
  }
  return cur === undefined ? null : cur;
};
const medOf = (recs, ...path) => med(recs.map((r) => at(r, ...path)));
const firstOf = (recs, ...path) => {
  for (const r of recs) {
    const v = at(r, ...path);
    if (v !== null) return v;
  }
  return null;
};
const firstLine = (e) => String(e && e.message ? e.message : e).split('\n')[0];

// ---- merge ---------------------------------------------------------------------------------------
const okInput = (w) => (Array.isArray(w.ok) ? w.ok.length > 0 && w.ok.every((f) => f === true) : w.ok === true);

function mergePost(wins, fields) {
  const out = { id: firstOf(wins, 'id'), top: firstOf(wins, 'top'), okAll: wins.length === 0 ? null : wins.every(okInput) };
  for (const f of fields) out[f] = medOf(wins, f);
  return out;
}

function mergeStage(recs) {
  const out = { n: recs.length };
  for (const f of STAGE_FIELDS) out[f] = medOf(recs, f);
  out.audio = {
    liveVoices: medOf(recs, 'audio', 'liveVoices'),
    musicVoices: medOf(recs, 'audio', 'musicVoices'),
    peakDb: medOf(recs, 'audio', 'peakDb'),
    era: firstOf(recs, 'audio', 'era'),
    theme: firstOf(recs, 'audio', 'theme'),
    musicBus: firstOf(recs, 'audio', 'musicBus'),
  };
  out.heap = { usedMb: medOf(recs, 'heap', 'usedMb'), growthMb: medOf(recs, 'heap', 'growthMb') };
  out.techTree = { medianMs: medOf(recs, 'techTree', 'medianMs') };
  out.cycle = { pct: medOf(recs, 'cycle', 'pct') };
  out.post = {
    repeat: mergePost(recs.map((r) => at(r, 'post', 'repeat')).filter(isObj), REPEAT_FIELDS),
    keystone: mergePost(recs.map((r) => at(r, 'post', 'keystone')).filter(isObj), KEYSTONE_FIELDS),
  };
  return out;
}

function mergeFinale(metricsList) {
  const out = {};
  for (const t of FINALE_T) {
    const wins = metricsList.map((m) => at(m, 'finale', t)).filter(isObj);
    const w = { n: wins.length };
    for (const f of FINALE_FIELDS) w[f] = medOf(wins, f);
    out[t] = w;
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write('usage: node scripts/perf/perf-median.mjs <perf.json> [<perf.json> ...]\n');
    return 2;
  }
  const inputs = [];
  for (const file of args) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (e) {
      process.stderr.write(`perf-median: cannot read ${file}: ${firstLine(e)}\n`);
      return 2;
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      process.stderr.write(`perf-median: ${file} is not valid JSON: ${firstLine(e)}\n`);
      return 2;
    }
    if (!isObj(json)) {
      process.stderr.write(`perf-median: ${file} is not a perf.json object\n`);
      return 2;
    }
    inputs.push({ file, json });
  }

  let budgetRaw;
  try {
    budgetRaw = JSON.parse(readFileSync(new URL('../smoke/perf-budget.json', import.meta.url), 'utf8'));
  } catch (e) {
    process.stderr.write(`perf-median: cannot read scripts/smoke/perf-budget.json: ${firstLine(e)}\n`);
    return 2;
  }
  const budgets = {};
  for (const [k, v] of Object.entries(budgetRaw)) {
    if (num(v) !== null) budgets[k] = v;
  }

  const metricsList = inputs.map(({ json }) => (isObj(json.metrics) ? json.metrics : {}));
  const gpu = inputs.every(({ json }) => at(json, 'budgets', 'frameP95MsGated') === true);

  const renderers = [];
  for (const m of metricsList) {
    const r = at(m, 'renderer', 'renderer');
    if (typeof r === 'string' && !renderers.includes(r)) renderers.push(r);
  }

  // stages: union of names, first-appearance order; each name medianed over the inputs that contain it
  const stageRecs = new Map();
  for (const m of metricsList) {
    const st = at(m, 'stages');
    if (!isObj(st)) continue;
    for (const [name, rec] of Object.entries(st)) {
      if (!isObj(rec)) continue;
      if (!stageRecs.has(name)) stageRecs.set(name, []);
      stageRecs.get(name).push(rec);
    }
  }
  const stages = {};
  for (const [name, recs] of stageRecs) stages[name] = mergeStage(recs);

  const finale = mergeFinale(metricsList);
  const bootRecs = metricsList.map((m) => at(m, 'boot')).filter(isObj);
  const boot = { n: bootRecs.length };
  for (const f of BOOT_FIELDS) boot[f] = medOf(bootRecs, f);

  // gate: same formulas as perf.mjs, from the median records
  const stageList = Object.values(stages);
  const stageAt = (name, ...path) => at(stages[name], ...path);
  const stageMax = (...path) => max(stageList.map((s) => at(s, ...path)));
  const gateVals = {
    machineMeanMs: stageMax('machineMeanMs'),
    machineMaxMs: stageMax('machineMaxMs'),
    uiMeanMs: stageMax('uiMeanMs'),
    uiMaxMs: stageMax('uiMaxMs'),
    finaleMeanMs: max(FINALE_T.map((t) => at(finale, t, 'finaleMeanMs'))),
    displayObjects: max([stageAt('s15_era5_full', 'displayObjects'), stageAt('s16_postgame', 'displayObjects'), at(finale, 't34', 'displayObjects')]),
    techTreeOpenMs: stageAt('s15_era5_full', 'techTree', 'medianMs'),
    heapMb: stageAt('s15_era5_full', 'heap', 'usedMb'),
    heapGrowthMb: stageAt('s15_era5_full', 'heap', 'growthMb'),
    bootMs: at(boot, 'bootMs'),
    liveVoices: stageMax('audio', 'liveVoices'),
    musicVoices: stageMax('audio', 'musicVoices'),
    peakDbfs: stageMax('audio', 'peakDb'),
    frameP95Ms: stageMax('frameP95Ms'),
    cycleDisplayPct: stageAt('s16_postgame', 'cycle', 'pct'),
    postMachineMaxMs: max(stageList.flatMap((s) => [at(s, 'post', 'repeat', 'machineMaxMs'), at(s, 'post', 'keystone', 'machineMaxMs')])),
    postFrameP95Ms: max(stageList.flatMap((s) => [at(s, 'post', 'repeat', 'frameP95Ms'), at(s, 'post', 'keystone', 'frameP95Ms')])),
  };

  const fail = [];
  for (const [key, value] of Object.entries(gateVals)) {
    const limit = budgets[key];
    if (limit === undefined || num(value) === null) continue;
    if (GPU_ONLY.includes(key) && !gpu) continue; // report-only without a GPU
    if (value > limit) fail.push(`${key} ${value} > ${limit}`);
  }
  for (const { json } of inputs) {
    for (const entry of Array.isArray(json.fail) ? json.fail : []) {
      if (typeof entry === 'string' && CARRIED.includes(entry.split(' ')[0])) fail.push(entry);
    }
  }
  for (const { file, json } of inputs) {
    if (Array.isArray(json.errors) && json.errors.length > 0) fail.push(`errors ${file}: ${json.errors.length}`);
  }
  const failUnique = [...new Set(fail)];

  const audioWiring = metricsList.map((m) => at(m, 'audioWiring')).filter((v) => v !== null);
  const result = {
    runs: inputs.length,
    renderers,
    gpu,
    gate: gateVals,
    stages,
    finale,
    boot,
    budgets,
    audioWiring,
    fail: failUnique,
  };
  console.log(JSON.stringify(result, null, 1));
  return process.env.PERF_STRICT === '1' && failUnique.length > 0 ? 1 : 0;
}

process.exitCode = main();
