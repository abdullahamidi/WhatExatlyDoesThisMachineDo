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
