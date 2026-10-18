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

Stages s0_crank … s9_era2_full (era I / II), s10_boiler and s11_era3_full (era III; s10 / s11 also print the 16 Era III part visibilities). Every stage prints its plaque text.
In a buy list, `@<techId>` jumps 8 h at a time (up to 8 jumps) until that tech is owned; `@blueprint` is an alias of `@generatorBlueprint`.
