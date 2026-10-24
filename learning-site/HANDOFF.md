# Handoff: the LearnYourself site

Updated 2026-10-24, after the second session finished the work the first one left. Read this file first, then the
files it points to. The previous sessions' transcripts are not required.

## 1. What this is

The owner asked for the interactive learning site specified in `WEBSITE_BUILD_PROMPT.md` at the repo root. It is an
Astro static site in `learning-site/`, generated from the owner's .NET study notes, meant to be hosted free on GitHub
Pages at `https://18-vk.github.io/LearnYourself/` (repo `https://github.com/18-VK/LearnYourself`, branch `main`).

**Everything in the build prompt is now built and verified locally.** The final report is `CHECKPOINT-4-8.md`.
What is left is go-live, which is the owner's call (section 4).

## 2. Rules you must keep (from the build prompt and the owner's decisions)

- **Scope.** Never modify, move or rename anything outside `learning-site/`. The only exception is
  `.github/workflows/deploy-learning-site.yml`. The notes are the source of truth.
- **Notes.** Problems in notes go to `learning-site/CONTENT_ISSUES.md`. Edit a note only with the owner's explicit
  approval; 7 edits were approved earlier and are listed under "Resolved".
- **Publishing.** Don't push, change repository settings, enable Pages or trigger a deployment without asking the
  owner first.
- **Committing.** The owner said "do not commit and push changes, I'll do myself": leave work as uncommitted changes
  in the working tree for them to review. If they do ask for commits, every commit message ends with the
  `Co-Authored-By` line the session's instructions give.
- **One copy.** All edits go in the git clone at `D:\Data\ly-wt\repo` (section 3). `E:\Aman\LearnYourself-main` is a
  plain copy of `main` without `.git`; the owner asked that changes be made in one copy only, so leave E: alone.
- **Privacy.** Before the first public deploy, run the personal-data scan and show the owner the results (done; the
  findings are in `CHECKPOINT-4-8.md`, "Go-live").
- **No invented technical content.** Facts come from the notes, or from official docs that are cited and labelled
  "from docs". Generated practice test cases are marked `reviewed: false`.
- **$0.** No paid services. Code runs in the learner's browser, never on a remote compile service.
- **Packages.** New npm or NuGet packages must be exact-pinned versions at least 7 days old.
- **Owner decisions** (full list in `CHECKPOINT-1.md`):
  - Desktop and Math are separate courses; the site is named LearnYourself.
  - Binary assets are view-only, with no download links. Third-party files are credited.
  - The two personal files stay excluded. The owner's name stays in sample data.
  - Single newlines render as line breaks.
  - Of 9 chatbot lines, 7 are dropped and 2 kept (`omitLines` in `_site.yaml`).

## 3. State at handoff

### Where the work is

`D:\Data\ly-wt\repo` is a clone of `main` (`cf3e1f8`) with the former `wt/runner` and `wt/extras` branches applied
as working-tree changes plus everything the second session did: **142 files changed, uncommitted** (`git status`).
Nothing new is on GitHub. The two WIP branches on GitHub (`wt/runner`, `wt/extras`) are superseded by this working
tree and can be deleted once it is committed.

### Done and verified (details and numbers in `CHECKPOINT-4-8.md`)

- Content, visualizers, quizzes, cheat sheets, Interview Prep, the C# runner: as in the first session.
- **Debugger** (`runner/Runner.Core/Debugger/`, `src/scripts/runner/debug/`, `src/styles/debugger.css`): tracing
  debugger with Continue / Step over / into / out / back / Restart, breakpoints, Variables, Call stack, Console,
  exceptions, array auto-visualization, a 10,000-step cap. The build-time check runs every runnable program
  instrumented and only gives a Debug button when the output is identical (206 of 206). Design: `runner/NOTES.md` §6.
- **Runnable SQL** (`scripts/sqlrun/`, `src/scripts/sqlrun/`, `src/data/sqlrun/`, `src/styles/sqlrun.css`): sql.js
  in a worker; 47 of 408 blocks runnable, the rest labelled or left alone; part of every build (`npm run sqlrun` alone).
- **Practice mode** (`scripts/practice/`, `src/scripts/practice/`, `src/components/TryIt.astro`, `src/data/practice/`,
  `src/styles/practice.css`): 20 exercises in 6 DSA lessons, verified with the notes' own code on every build
  (`npm run practice` alone).
- **Lighthouse** (mobile): lesson page 93 / 98, home 99 / 96, after two accessibility fixes (search button name,
  a high-contrast light code theme).
- **Colour scheme** (the Coding Ninjas palette, owner's choice; values from codingninjas.com's CSS variables): all
  tokens in `src/styles/global.css` (light and dark), course accents from their secondary colours,
  `github-light-high-contrast` / `github-dark-high-contrast` for code (`astro.config.ts`, `src/lib/markdown.ts`),
  matching palettes in `runner.css` (editor) and `viz.css` (visualizer code), the cheat-sheet print palette, the
  favicon. To change the scheme again, edit the token blocks and run the two checkers below. `.cache/tmp/token-contrast.mjs` and `theme-contrast.mjs` check contrast (≥ 4.5:1 for
  text, ≥ 3:1 for visualizer marks); run them after changing a token.
- Docs: README sections "Debugger", "Runnable SQL", "Practice mode"; `runner/NOTES.md` §6; `CONTENT_ISSUES.md`
  Q-86 (the note's `RadixSort` throws on an empty array).
- **Learning-effectiveness features** (owner's request, after the report): pre-test box on lessons
  (`src/components/PreTest.astro`, `src/scripts/pretest.ts`), spaced review (`src/scripts/review-schedule.ts`,
  `review` in `ly-progress-v1`, `src/pages/review.astro` + `src/scripts/review.ts`, per-lesson
  `src/pages/review-data/[...lesson].json.ts`, the "Review today" card via `src/scripts/review-badge.ts`), mastery
  signals in `src/scripts/quiz-scores.ts`, practice hints in `src/scripts/practice/attach.ts`; README section
  "Pre-test, spaced review and mastery". Not built: repair-it exercises, guided debug tasks, self-explanation
  prompts, offline (see CHECKPOINT-4-8.md).
- **Git & GitHub course** (owner's request): `curriculum/git-github.yaml` (22 lessons from the owner's new
  `Git-Github/` notes, copied from E: into the clone as they were), `COURSE_FILES` in `scripts/lib/generate.ts`,
  the `--git` colour token and `[data-course="git-github"]` rule, the glyph in `src/lib/site.ts`, 22 quiz files,
  two `_assets.yaml` entries, `_site.yaml` (catalogue, suggested path, one duplicate, one exclusion), and the
  site-written note `Git-Github/4.DailyScenarios.md` (labelled in its header). Adding a course needs all of these.

### Full verification (all passed on the final build)

```bash
cd learning-site && source scripts/local-env.sh
npx tsc --noEmit -p . && npx astro check          # clean
npx vitest run                                     # 1,526 tests
npm run test:runner                                # 99 .NET tests
LY_REQUIRE_RUNNER=1 npm run build                  # content, sqlrun, runner + practice checks, astro, pagefind, verify
npm run scan:personal                              # findings listed in CHECKPOINT-4-8.md
npx playwright test --workers=2                    # every lesson, every visualizer, Run, Debug, SQL, practice
bash .cache/tmp/lh/run.sh http://127.0.0.1:4321/LearnYourself/dsa/sorting/stability-and-simple-sorts/ .cache/tmp/lh/x.json
```

## 4. What is left: go-live (Checkpoint 9), the owner's call

1. The owner reviews and commits the working tree in `D:\Data\ly-wt\repo`, then pushes `main`.
2. Settings → Pages → Source: "GitHub Actions"; re-run the workflow (the build job already passed on GitHub for the
   first session's `main`; only the deploy job failed because Pages was off).
3. Verify the live site: home, one lesson per course, a visualizer, Run and Debug a C# example, Run a SQL example,
   a practice exercise, search, a cheat sheet, Interview Prep.

Open for the owner afterwards: the ~91 `open` entries in `CONTENT_ISSUES.md` (Q-85 is the one personal-data item),
reviewing the 405 web-researched interview questions and the 79 generated practice cases, and whether to close the
notes' heading-level gaps on the site (Lighthouse `heading-order`).

## 5. Environment (this Windows machine)

- Git Bash through the Bash tool, 8 GB RAM. Keep one build or Playwright run going at a time.
- **Before node, npm or dotnet:** `cd learning-site && source scripts/local-env.sh`. It puts the portable **.NET 10 SDK
  10.0.402** (`.tools/dotnet`, installed with Microsoft's `dotnet-install.ps1`) on PATH and keeps NuGet, npm, temp
  and Playwright's Chromium under `learning-site/.cache`. System Node is 25 (fine; CI uses 24).
- A preview of `dist/` is served with `npx astro preview --port 4321 --host 127.0.0.1` at
  `http://127.0.0.1:4321/LearnYourself/`; Playwright reuses it (`reuseExistingServer`). Stop it before `npm ci`
  (a running preview locks the `lightningcss` native module).
- Lighthouse: `bash .cache/tmp/lh/run.sh <url> <out.json>` launches Playwright's Chromium with a remote-debugging
  port and runs `lighthouse@13.4.1` through `npx`; it prints the scores and the audits under 0.9.
- Gotchas: `LF will be replaced by CRLF` warnings from git are harmless; the runner's `Recorder.cs.txt` must stay an
  `EmbeddedResource` with `WithCulture="false"` (MSBuild otherwise treats `.cs` as the Czech culture and the debugger
  silently loses its recorder).

## 6. Files to read, in order

1. `CHECKPOINT-4-8.md`: the final report, results, budgets, the scan findings and the go-live steps.
2. `README.md`: how everything works and how to add things (lessons, visualizers, harnesses, SQL data, exercises).
3. `runner/NOTES.md`: runner and debugger design.
4. `CONTENT_ISSUES.md`: about 150 entries, 91 open, for the owner.
5. `CHECKPOINT-1.md` … `CHECKPOINT-3.md`: earlier decisions and the runner spike.
