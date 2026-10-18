# CLAUDE.md — What Exactly Does This Machine Do?

2D incremental/idle game prototype. Phaser 3 + strict TypeScript + Vite + Vitest. LocalStorage saves.

- Requirements: `docs/GAME_SPEC.md` (authoritative)
- Progress / context restore: `docs/PROJECT_STATUS.md` (update after every work package)
- Asset replacement: `docs/ASSET_GUIDE.md`

## Commands
- `npm run dev` — dev server
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest (simulation, persistence, formatting)
- `npm run build` — production build

## Architecture rules
- `src/simulation`, `src/data`, `src/persistence`, `src/utils` must not import Phaser (pure, testable).
- All balancing constants live in `src/data/`.
- Rendering reads simulation state; it never owns economy state.
- Save data is plain JSON, versioned, independent of Phaser objects.

## Multi-agent orchestration

Hierarchy (agent definitions in `.claude/agents/`):

| Level | Role | Agent | Model |
|---|---|---|---|
| 1 | Project Director | main session | session model |
| 2 | Task Planner | `task-planner` | `opus` |
| 3 | Engineering Manager | `engineering-manager` | `sonnet` |
| 4 | Implementation Worker | `implementation-worker` | `haiku` |
| 4r | Implementation Reviewer | `implementation-reviewer` | `opus` |

Iteration loop:
1. Director → `task-planner`: plan next work package from spec + status + repo.
2. Director → `engineering-manager` (Mode A): decompose into worker assignments with exclusive file ownership and waves (≤4 parallel).
3. Director spawns `implementation-worker` agents exactly per the EM's assignments
   (nested spawning is not available to subagents in this environment, so the Director is the bridge;
   the EM keeps responsibility for decomposition and validation).
4. `implementation-reviewer` (Opus) reviews the combined worker diff.
5. Director → `engineering-manager` (Mode B): validate (typecheck, tests, build) against acceptance criteria;
   fix assignments go back to workers.
6. Director updates `docs/PROJECT_STATUS.md`, commits, reports a 3–6 line summary to the user.

Project-local agent definitions are loaded only at session start. In a session where they were created
mid-session (or are otherwise not registered), invoke each role as a `general-purpose` agent with the
matching `model` override (`opus` / `sonnet` / `haiku`) and instruct it to read and follow its definition
file in `.claude/agents/`. Verify the effective model from the subagent transcript's `"model"` field.

No global forced subagent model setting is used — each role's model comes from its own frontmatter.
If a requested model is unavailable, report it rather than substituting a more expensive one.

## Agent communication style
All agent reports and Director updates to the user: caveman style — minimal words, facts only.
