Plan A17. 1 wave, 3 workers, no file overlap. Patch verified: `git apply --check` OK whole + per slice (`--include`). Worktree has no src changes yet, patch applies clean.

Wave 1 (parallel):
- A17-assets: src/assets/manifest.ts, manifest.test.ts, painters/legacy.ts, painters/legacy.test.ts. Apply slice `src/assets/*`. Then set 5 new descriptions + comment.
- A17-data: src/data/machineComponents.ts, machineComponents.test.ts, machineComponents.wp17.test.ts. Apply slice `src/data/machineComponents*`. Seats, sizes, lugs, hose via, glow depthBias 4, new A17 placement tests.
- A17-gaintext: src/data/world.ts, world.test.ts, src/game/rendering/FloatingText.ts, src/game/entities/HandCrank.ts, scripts/smoke/README.md. Apply slice `src/data/world*` + `src/game/*`. Plus N1 README line.

Merged: W1+W2 (assets+painter, test reads manifest). W3+W4 (data+tests). W5 alone. Wave 2 not needed.

Known cross-worker coupling: manifest.test.ts "gives every machine component the size of its manifest entry" needs assets AND data done. May fail mid-wave. Not a real fail. Mode B runs full suite.

Notes (not assigned, out of scope list):
- N1 README CLICK_SHOT line: DONE inside A17-gaintext (one line, smoke README, tied to stages.mjs option).
- N2 src/data/steamFx.ts lance emitter y -430 to -421: skip. Off limits, current value fine.
- N3 src/game/math/gainBlock.test.ts spireTower clearance case: skip. Off limits. Suggest follow-up by main repo owner.
- N4 postgame accent wiring: WP18. No code here.
- Docs ASSET_GUIDE / ART_AUDIT, stages.mjs, scripts/art, PNGs: already on disk. Workers touch none.

Mode B checklist after wave: typecheck clean; npm test 84 files / 2610 pass; npm run build; node scripts/perf/bundle-budget.mjs PASS; rebuild dist, then CLICK_SHOT=1 stages.mjs on s9 s11 s13 s15 s16 (errors [], parts17 all true at s15/s16, bellowsFrames not all equal, no '[assets] size mismatch' or 'failed to load' for the 5 ids); `grep -rn "floatPoolSize\|MAX_BLOCK_LINES" src` empty.
