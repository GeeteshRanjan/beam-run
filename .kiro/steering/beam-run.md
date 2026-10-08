---
inclusion: always
---
# Beam Run — always-on project rules

**Beam Run: Market Entry**, an ANSR HTML5 Canvas platformer. Git repo and all code: `beam-run/`.
Root `ANSR Game/` holds the authoritative specs (`01_…`–`10_…`, `tuning.config.ts`, `levels.json`,
`analytics-events.json`); where they disagree with a summary the specs win, except where
`beam-run/docs/MODEL.md` supersedes them. If the open workspace is `beam-run/` itself, drop the
`beam-run/` prefix from paths below; the specs are then in the parent folder.

## Stack + commands (run inside `beam-run/`)
Vite 5 + TypeScript 5, Vitest 2 (jsdom), ESLint 8, tsx. Output: IIFE + ESM library (`dist/`) and a
static site (`dist-site/`). Node is not on PATH; prefix every command with
`export PATH="$HOME/.local/node/bin:$PATH"`. The bash tool prints a spurious `Exit Code: 1` — trust stdout.
- Gate after any change to code, data or config (skip for docs-only / Q&A). `build` already runs
  `tsc --noEmit`, so no separate typecheck. Send output to a file and read only the tail:
  `{ npm run lint && npm run test && npm run build && npm run build:site && npm run validate:levels; } > /tmp/br-gate.out 2>&1; tail -n 40 /tmp/br-gate.out`
  (on failure, `grep -n -i 'error\|fail' /tmp/br-gate.out` rather than reading it all).
- Just typecheck: `npm run typecheck`. One test file: `npx vitest run src/path/file.test.ts`.
- Budget: JS ≤ 90 KB, total ≤ 250 KB gzip — read the IIFE figure from `npm run build`
  (`npm run analyze` fails by design, `docs/OPEN.md` §1).
- Long-running (`npm run dev`, `npm run preview`, `test:watch`): ask the user to run them.

## Where things are (`beam-run/`)
- `src/core/` engine (Game, Simulation, Loop, StateMachine, Input) · `src/world/` + `world/Hazards/`
  headless physics/hazards · `src/render/` canvas art · `src/ui/` DOM overlays, HUD, `styles.ts`
  (CSS in a TS literal) · `src/audio/` · `src/analytics/` · `src/embed/` (`mount.ts`, IIFE API) ·
  `src/test/helpers.ts` headless drivers.
- Constants: `src/data/tuning.config.ts` (all gameplay numbers + palette) · layouts:
  `src/data/levels.json` (both mirror root copies — update both) · copy: `src/data/copy.ts` ·
  tokens: `src/data/tokens.ts`.
- Scripts: `scripts/validate-levels.ts`, `strip-level-notes.ts`, `budget.mjs`, `build-404.ts`.
  Configs: `vite.config.ts` (library), `vite.config.site.ts` (site), `vercel.json`.
- Docs: `HANDOFF.md` (now + gotchas) · `docs/MODEL.md` (locked decisions + model; before gameplay
  changes) · `docs/INVARIANTS.md` (rules/traps by group) · `docs/SCREENS.md` (per screen) ·
  `docs/ARCHITECTURE.md` (module map, "where to look by task" table at the top) · `docs/OPEN.md`
  (owner decisions). Read only the one the task touches, and only the section you need.

## Engineering rules
- `world/*` and `core/Simulation.ts` stay headless — never import Renderer/DOM.
- No `Math.random()` in `step()`; gameplay numbers/layouts only from `tuning.config.ts` / `levels.json`.
- Orange is reserved for the "value" accent (badges, active power, CTA, fire).
- Hazards distinguishable by shape + motion, not colour alone. All juice respects `prefers-reduced-motion`.

## Git
Remote `origin` = github.com/GeeteshRanjan/beam-run, branch `main`. Deploy: Vercel builds
`npm run build:site` → `dist-site/`. Commit or push only when asked.

## Reading economy
- **Never open:** `node_modules/`, `dist/`, `dist-site/`, `coverage/`, `stats.html`, `package-lock.json`,
  `.git/`, `.DS_Store`, `*.docx`, `*.svg` logos, `/tmp/*` render PNGs and gate/test output (tail/grep
  only), `docs/JOURNAL.md` (~500 KB frozen archive — grep only).
- **Large docs** (INVARIANTS ~180 KB, SCREENS ~60 KB, MODEL/OPEN/ARCHITECTURE ~25 KB): list headings
  first (`grep -n '^#' file`; OPEN/MODEL items: `grep -n '^[0-9]\+\. \*\*' file`; SCREENS: its
  table at lines 14–22 maps screen → §, then `grep -n '§4.10' docs/SCREENS.md`), or
  `grep -n -i '<keyword>' file`, then read only that line range.
- **Large code** (~1000+ lines: `scenery.ts`, `workplace.ts`, `Game.ts`, `dragon.ts`, `tuning.config.ts`,
  `Overlays.ts`, `Dragon.ts`, `styles.ts`, `brickBreaker.ts`, big `*.test.ts`): grep or read a symbol,
  never a full read.
- Only re-read code you are about to change.

## Handoff (`beam-run/HANDOFF.md`, `beam-run/HANDOFF_LOG.md`)
- Read `HANDOFF.md` once per session, only when about to change code or asked about project state.
  Skip it for unrelated Q&A.
- `HANDOFF_LOG.md` is append-only, one self-contained line per entry. Never read by default:
  `grep -n -i '<keyword>' HANDOFF_LOG.md` for history, `tail -n 15 HANDOFF_LOG.md` for recent activity.
  A still-relevant fact must never live only in the log.
- After any task that changed files (skip for Q&A/read-only):
  a) `HANDOFF.md` "Now": replace only the lines that became false (tests, gzip, next).
  b) `HANDOFF.md` "Gotchas": add new cross-cutting traps, delete ones that no longer apply. Domain
     rules go to `docs/INVARIANTS.md` under their `## ` group; model changes to `docs/MODEL.md`;
     per-screen to `docs/SCREENS.md`; modules to `docs/ARCHITECTURE.md`; owner questions to `docs/OPEN.md`.
  c) `HANDOFF_LOG.md`: append one line `- YYYY-MM-DD: what changed (files). Why, if not obvious.`
     without reading the file.
- Never summarise, compact or reword these files to make them fit.
