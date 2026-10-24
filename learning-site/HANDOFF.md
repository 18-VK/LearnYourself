# Handoff: finishing the LearnYourself site

Written 2026-10-24 to move this work to a new Claude session. Read this file first, then the files it points to.
It is the whole context you need. The previous session's transcript is not required.

## 1. What this is

The owner asked for the interactive learning site specified in `WEBSITE_BUILD_PROMPT.md` at the repo root. It is an
Astro static site in `learning-site/`, generated from the owner's .NET study notes, hosted free on GitHub Pages at
`https://18-vk.github.io/LearnYourself/` (repo `https://github.com/18-VK/LearnYourself`, branch `main`).

The owner's last instruction before the handoff was "resume the unfinished things.. complete it", so finish
everything below.

## 2. Rules you must keep (from the build prompt and the owner's decisions)

- **Scope.** Never modify, move or rename anything outside `learning-site/`. The only exception is
  `.github/workflows/deploy-learning-site.yml`. The notes are the source of truth.
- **Notes.** Problems in notes go to `learning-site/CONTENT_ISSUES.md`. Edit a note only with the owner's explicit
  approval; 7 edits were approved earlier and are listed under "Resolved".
- **Publishing.** Don't push, change repository settings, enable Pages or trigger a deployment without asking the
  owner first.
- **Privacy.** Before the first public deploy, run the personal-data scan and show the owner the results.
- **No invented technical content.** Facts come from the notes, or from official docs that are cited and labelled
  "from docs".
- **$0.** No paid services. Code runs in the learner's browser, never on a remote compile service.
- **Packages.** New npm or NuGet packages must be exact-pinned versions at least 7 days old.
- **Commits.** Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Owner decisions** (full list in `learning-site/CHECKPOINT-1.md`):
  - Desktop and Math are separate courses; the site is named LearnYourself.
  - Binary assets are view-only, with no download links. Third-party files are credited.
  - The two personal files stay excluded. The owner's name stays in sample data.
  - Single newlines render as line breaks.
  - Of 9 chatbot lines, 7 are dropped and 2 kept (`omitLines` in `_site.yaml`).

## 3. State at handoff

### Done, merged into `main`, and already on GitHub (`main` = `b23c3cd`)

Someone pushed `main` after the initial commit. The reflog says "update by push" for `7f83697`, `95b8168` and
`b23c3cd`; it was probably the owner's editor sync. Pages is **not** enabled, so nothing is public.

On GitHub Actions the **build job passes**: content checks, unit tests, .NET runner tests, the runnable-block check,
the build, the personal-data scan and the Playwright smoke tests. Only the **deploy** job fails, because Pages isn't
enabled. That is expected.

- **Content.** 7 courses, 178 lessons from 140 notes (all mapped or excluded), and 188 recovered code blocks.
- **Visualizers.** 43 of them in 156 placements, covering DSA, SQL, Phase 1 C#, Phase 2 ASP.NET Core and Desktop.
  - FlowDiagram covers 65 diagrams: 4 planned plus 61 converted from ASCII (see `curriculum/FLOW_DIAGRAMS.md`).
  - Every roadmap lesson has a roadmap graph.
  - The checklist key bug is fixed.
- **Quizzes.** All 165 teaching lessons, 871 questions.
- **Cheat sheets.** 14 sheets with 1,028 items and a print layout.
- **Interview Prep.** 464 questions: 59 from the notes, verbatim-enforced, and 405 web-researched and sourced. Pages
  for browse, topics, flashcards, mock interview and gallery.
- **C# runner, Run half.** .NET 10 WebAssembly plus Roslyn in a Web Worker.
  - 206 runnable programs, checked at build time with the real SDK.
  - About 7 MB on first use; cold start 2–3 s; `while(true)` is stopped at 5 s.
  - Details in `CHECKPOINT-3.md` and `runner/NOTES.md`.
- **Tooling.**
  - Personal-data scan: `npm run scan:personal` (CI runs it too).
  - Data contracts: `src/data/schema.ts` and `scripts/lib/data-check.ts`.
  - Fast data check: `npm run data:check`.
  - Visualizer playground: `npm run playground`.
- **Latest local verification on `main`.** tsc clean; 1,486 vitest tests; build 220 pages / 732 files / 36.7 MB /
  19,703 links OK; 234 Playwright tests passed.

### Not finished (the remaining work)

1. **Step-through debugger (§11 "Debug").** Branch `wt/runner`, worktree `D:/Data/ly-wt/runner`, 3 WIP commits on top
   of `main`. The last one is unverified (never built).
   - **Present:**
     - recorder and instrumenter sources (`runner/Runner.Core/Debugger/`);
     - trace model (`Trace.cs`) and `Runner.Tests/DebuggerTests.cs`;
     - worker/host protocol changes (`Runner.Wasm/RunnerExports.cs`, `runner-worker.js`, `src/scripts/runner/host.ts`,
       `attach.ts`, `actions.ts`);
     - the start of the debug UI (`src/scripts/runner/debug/`).
   - **Remaining:**
     - make it build;
     - finish the instrumenter: line plus definitely-assigned locals before each statement, call stack on
       entry/exit, exceptions;
     - value snapshots: primitives, strings, arrays, List and Dictionary first N, objects to a limited depth;
     - a step cap of about 10,000;
     - .NET unit tests: lines, locals, stack depth, exceptions, and instrumented output equal to plain output;
     - add that equivalence check to the build-time runnable check;
     - the debugger UI: Debug / Continue / Step Over / Into / Out / Back / Restart, gutter breakpoints, and Variables
       (flash on change), Call Stack, Console-up-to-step and exception panels, replayed with
       `src/viz/engine/usePlayer` so stepping back works;
     - T2 auto-visualize: arrays and lists as cells, with int locals `i, j, lo, hi, mid` as pointers;
     - Playwright: debug a sample; `while(true)` in Debug stopped by the step cap with the page responsive;
     - docs in `runner/NOTES.md` and README.
2. **Runnable SQL with sql.js (§8 T3).** Branch `wt/extras`, worktree `D:/Data/ly-wt/extras`, 3 WIP commits; the last
   one is unverified.
   - **Present:** `sql.js@1.14.2`; tokenizer, classifier, engine and build check (`scripts/sqlrun/`); worker and host
     (`src/scripts/sqlrun/`); some data files (`src/data/sqlrun/`); `attach.ts` and `sqlrun.css`.
   - **Remaining:** finish the data files and the Run UI. Runnable only when the query runs in SQLite and the result
     can't differ from SQL Server; be conservative and never fake results. Label T-SQL-only blocks. Add the binary
     allowlist entry for the wasm, tests and a README section.
3. **Practice mode for DSA lessons (§11 T3).** Same branch, `wt/extras`.
   - **Started:** `scripts/practice/`, `src/components/TryIt.astro`, `src/data/practice/`, `src/lib/practice.ts`,
     `src/scripts/practice/`.
   - **Remaining:** the starter code is the note's method signature; test cases come from the note's own examples, and
     any generated case is marked `reviewed: false`; tests run through the existing C# runner with per-case pass/fail;
     "Show solution" reveals the note's code; tests and a README section.
4. **Lighthouse** (§12 targets: Performance ≥ 90 and Accessibility ≥ 95 on a lesson page with a visualizer). Not
   measured yet. Two attempts failed for tooling reasons.
   - **Working approach:** launch Playwright's Chromium with `--remote-debugging-port=9333`, then run
     `npx --yes lighthouse@13.4.1 <url> --port=9333 --only-categories=performance,accessibility --output=json
     --form-factor=mobile` against `astro preview`.
   - A ready script is at `learning-site/.cache/tmp/lh/run.sh` and `browser.mjs` (gitignored, local only). If the
     scores miss, fix the pages.
5. **Final report.** `learning-site/CHECKPOINT-4-8.md` is a DRAFT. Fill the `*_PENDING` markers: debugger, SQL,
   practice, results, Lighthouse, residual items and go-live.
6. **Go-live (Checkpoint 9)** needs the owner:
   - Present the personal-data scan. The findings so far are all samples or accepted: the owner's first name in
     sample data (kept by decision), sample passwords and machine names from the notes, credits inside third-party
     libraries and PDFs, and one third-party PDF whose metadata author is someone else. Raise **Q-85** in
     CONTENT_ISSUES: a chat line in `19. OtherTopics/Notes.md` that addresses the owner by name and mentions job
     hunting; recommend adding it to `omitLines`.
   - Present the budgets, and ask for approval.
   - **On approval:** push `main`. The owner sets Settings → Pages → Source: "GitHub Actions" (or you do it, if they
     say so). Re-run the workflow.
   - Then verify the live site: home, one lesson per course, a visualizer, Run and Debug a C# example, search, a cheat
     sheet and Interview Prep.

## 4. Environment (this Windows machine)

- **Machine.** Git Bash through the Bash tool, 8 GB RAM, D: has about 15 GB free and C: is nearly full. Keep caches on
  D:.
- **Before node, npm or dotnet:** `cd learning-site && source scripts/local-env.sh`. It puts the portable **Node 24**
  (`.tools/node`) and **.NET 10 SDK 10.0.402** (`.tools/dotnet`) on PATH; npm and NuGet caches live in
  `learning-site/.cache`. Both folders are gitignored. The system has only .NET 7 and an older Node.
- **Worktrees.** One per work area under `D:/Data/ly-wt/<name>`, on branch `wt/<name>`. `.tools`, `.cache/npm` and
  `.cache/ms-playwright` are junctions to the main checkout. To create one: `bash /d/Data/ly-wt/setup.sh <name>`
  (about 3 minutes). Finished branches are already merged: `wt/viz-*`, `wt/ui`, `wt/content`. You may delete those
  worktrees with `git worktree remove`.
- **Memory lock.** Wrap every memory-heavy command in `bash /d/Data/ly-wt/heavy.sh <cmd>`: `npm run build`, Playwright,
  `astro preview`/`dev`, `npm run content`, `dotnet build/test/publish`, and full vitest. It allows one at a time
  machine-wide. A stale lock is the folder `D:/Data/ly-wt/.heavy.lock`; remove it only if no heavy job is running.
- **Ports.** `LY_PORT=<port>` selects Playwright's preview port (default 4321); worktrees used 4331–4338.
  `LY_PG_PORT` sets the playground port (default 5199).
- **Merging into main.** `CONTENT_ISSUES.md` conflicts every time, because each branch appends a section. Keep both
  sides, and keep the section "Found while writing quizzes, cheat sheets and interview questions" last. After
  merging a branch that changed `package.json`, run `npm ci` in `main`.
  - Before `npm ci`, kill any `astro preview` or `node` processes running from `learning-site`. A running preview
    locks the `lightningcss` native module, and `npm ci` then fails half-way with EPERM.
- **Full verification in main:**
  ```bash
  cd learning-site && source scripts/local-env.sh
  npx tsc --noEmit -p .
  bash /d/Data/ly-wt/heavy.sh npx vitest run
  LY_REQUIRE_RUNNER=1 bash /d/Data/ly-wt/heavy.sh npm run build
  npx tsx scripts/scan-personal.ts
  bash /d/Data/ly-wt/heavy.sh npx playwright test --workers=2
  ```
- **Gotchas.**
  - Background subagents often stalled on a "stream watchdog" after about 10 minutes without output. Tell agents to
    commit after each milestone and to keep tool calls short (long commands with `run_in_background`); resume a
    stalled one with SendMessage.
  - Line-ending warnings from git (`LF will be replaced by CRLF`) are harmless.
  - `.NET` blocks: 754 fail to compile as fragments. That's expected; only notes with sample inputs get harnesses.

### Continuing on another machine or account

`main` and the two unfinished branches, `wt/runner` and `wt/extras`, are on GitHub. On a fresh clone:

```bash
git clone https://github.com/18-VK/LearnYourself.git && cd LearnYourself
git fetch origin wt/runner wt/extras
git worktree add ../ly-wt/runner wt/runner     # debugger work
git worktree add ../ly-wt/extras wt/extras     # SQL runner + practice mode
```

In each checkout, `cd learning-site && npm ci`. You also need Node ≥ 22.22 and the .NET 10 SDK; on this machine they
were portable installs in `learning-site/.tools`, which is gitignored. `npm run content` regenerates the gitignored
lessons and data before a build. `heavy.sh` and `setup.sh` (section 4) exist only on the original machine, under
`D:/Data/ly-wt/`. On a machine with enough memory you don't need the lock.

## 5. Files to read, in order

1. `WEBSITE_BUILD_PROMPT.md`: §5–§14, especially §11 (runner and debugger) and §13–14 (checkpoints, definition of done).
2. `learning-site/README.md`: how everything works and how to add things.
3. `learning-site/runner/NOTES.md` and `learning-site/CHECKPOINT-3.md`: runner design and the debugger hooks
   (`registerRunnerAction`, worker protocol).
4. `learning-site/CHECKPOINT-4-8.md`: draft final report.
5. `learning-site/CONTENT_ISSUES.md`: about 150 entries, 90 open, for the owner.
6. `learning-site/CHECKPOINT-1.md` and `CHECKPOINT-2.md`: earlier decisions.

## 6. Suggested next steps

1. On `wt/runner`: make the debugger build and pass tests, then finish it. Commit often.
2. In parallel on `wt/extras`: finish the SQL runner, then practice mode.
3. Merge both into `main`, run `npm ci`, run the full verification and Lighthouse, fix anything that fails.
4. Finish `CHECKPOINT-4-8.md` and run the scan.
5. Ask the owner for go-live approval: push, then enable Pages. Verify the live site.
