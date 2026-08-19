---
inclusion: always
---

# Beam Run build — always-on project rules

This workspace builds **Beam Run: Market Entry** (an ANSR HTML5 Canvas platformer).

## Do this at the start of every session
1. Read `HANDOFF.md` (project root) — it is the source of truth for *current
   state* and the **router** to everything else. Follow it. It carries status,
   environment, locked defaults and the model proper; the detail is split so a
   session does not load all of it. Read **only** the companion doc your task
   touches: `docs/INVARIANTS.md` (rules and traps — before editing anything) ·
   `docs/SCREENS.md` (per-screen model) · `docs/ARCHITECTURE.md` (module map) ·
   `docs/OPEN.md` (owner decisions). Full history is `docs/JOURNAL.md`; read it
   only when you need the background on a specific past decision.
2. The full spec docs live in the parent `ANSR Game/` folder
   (`01_Game_Design_Document.md` … `10_Project_Plan_and_Roadmap.md`,
   `tuning.config.ts`, `levels.json`, `analytics-events.json`) and are
   authoritative. If they disagree with any summary, the docs win. If the parent
   folder is not visible in this workspace, ask the user to open the `ANSR Game`
   folder instead.

## Environment (required)
- Node is not on PATH. Prefix every shell command with:
  `export PATH="$HOME/.local/node/bin:$PATH"`
- The bash tool prints a spurious `Exit Code: 1`; rely on stdout, not exit codes.
- For tests: `npx vitest run > /tmp/vitest.out 2>&1` then read the file.

## Engineering rules
- `world/*` and `core/Simulation.ts` stay **headless** — never import Renderer/DOM.
- No `Math.random()` inside `step()` (determinism); gameplay numbers/layouts come
  only from `src/data/tuning.config.ts` and `levels.json`.
- Orange is reserved for the "value" accent (badges, active power, CTA, fire).
- Hazards must be distinguishable by shape + motion, not colour alone.
- All motion/juice respects `prefers-reduced-motion`.
- Keep the bundle within budget (JS ≤ 90 KB, total ≤ 250 KB gzipped).

## After completing each task (do not skip)
1. Ensure green: `npm run typecheck && npm run lint && npm run test && npm run build && npm run build:site && npm run validate:levels`.
2. **Append the full entry to `docs/JOURNAL.md`** (append-only; never delete or
   rewrite older entries — the findings are the valuable part).
3. **Update `HANDOFF.md`**, keeping it lean:
   - add a one-line summary at the top of "Recent passes" and drop the oldest so
     the list stays at 3;
   - refresh the status numbers (tests, gzip, budget gate).
   Everything else goes to the doc that owns it, **never back into HANDOFF.md**:
   permanent rules and traps → `docs/INVARIANTS.md` (the one meant to grow) ·
   per-screen detail → `docs/SCREENS.md` · module changes →
   `docs/ARCHITECTURE.md` · owner questions → `docs/OPEN.md`.
   Do **not** paste the full narrative anywhere but the journal. If HANDOFF.md
   passes ~250 lines or ~20 KB, something is in the wrong file.
4. Only then start the next task.
