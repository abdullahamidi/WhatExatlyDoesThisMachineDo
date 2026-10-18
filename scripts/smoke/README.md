# Browser smoke tests (Playwright, not part of `npm test`)

Uses a globally installed Playwright with a local Chromium.

```
npm run build && npx vite preview --port 4173 --strictPort &
PW=$(npm root -g)/playwright
mkdir -p /tmp/smoke
PW_PATH=$PW node scripts/smoke/wp2-crank.mjs        http://localhost:4173/ /tmp/smoke
PW_PATH=$PW node scripts/smoke/wp3-techtree.mjs     http://localhost:4173/ /tmp/smoke
PW_PATH=$PW node scripts/smoke/wp4-persistence.mjs  http://localhost:4173/ /tmp/smoke
PW_PATH=$PW node scripts/smoke/full-machine.mjs     http://localhost:4173/ /tmp/smoke/full.png
```
Each prints a JSON result; `errors` must be empty. They use the read-only `window.__wedtmd` debug hook.
PW_PATH=$PW node scripts/smoke/stages.mjs http://localhost:4173/ /tmp/smoke/stages   # unlock-stage screenshots (ONLY=s0_crank,... FRAME_MS=40 optional)

Stages s0_crank … s9_era2_full (era I / II), s10_boiler and s11_era3_full (era III; s10 / s11 also print the 16 Era III part visibilities), s12_spire and s13_era4_full (era IV; s12 / s13 also print `parts4`, the 16 Era IV part visibilities), s14_null (era V start; prints `parts5`), s15_era5_full and s16_primary (era V; print `parts5`, the 38 Era V part visibilities; both click the crank 3x before the screenshot so the inversion ghost shows). Every stage prints its plaque text and camera state.
In a buy list, `@<techId>` jumps 8 h at a time (up to 8 jumps) until that tech is owned; `@blueprint` is an alias of `@generatorBlueprint`.
`PERF=1` (stages.mjs): for s13_era4_full and s15_era5_full, waits 3 s after the screenshot and prints `machineStats` (`{ meanMs, maxMs, components }`, or `null` when the hook is missing).
wp3-techtree.mjs result keys: `12_tab5` (fifth tab text, expect `SIGNAL ?`), `13_tabs`, `13_tabCount` (expect 5), `13_header` (expect ends `???`), `13_nodes` (expect 10), `13_null` (classes of `nullChamber`, `'missing'` when absent).
