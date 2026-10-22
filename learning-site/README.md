# LearnYourself (learning site)

A static learning site generated from the .NET study notes in this repository: seven courses, step-through
algorithm visualizers, and (coming) cheat sheets and an interview question bank. Hosted on GitHub Pages at
**https://18-vk.github.io/LearnYourself/**.

The notes stay where they are and remain the source of truth. This folder only holds the curriculum
manifests that map notes to lessons, the build pipeline, and the site itself. Nothing here edits a note.

## Requirements

- **Node 22.22 or newer** (Node 24 LTS recommended; CI uses 24). Check with `node --version`.
- No other services: no database, no accounts, no paid APIs. Progress is stored in the browser.

If your system Node is older, put a portable Node in `learning-site/.tools/node/` and run
`source scripts/local-env.sh` (Git Bash) before the commands below. The script also keeps npm's cache,
temp files and Playwright's browsers inside `learning-site/.cache/`. Both folders are gitignored.

## Commands

Run these from `learning-site/`:

| Command | What it does |
|---|---|
| `npm ci` | Install the exact dependency versions from `package-lock.json` |
| `npm run dev` | Generate content, start the dev server at `http://localhost:4321/LearnYourself/`, and regenerate whenever a note or manifest changes |
| `npm run content` | Run only the content pipeline and its checks; writes `coverage-report.md` |
| `npm run build` | Content pipeline → Astro build → Pagefind search index → output verification (see below) |
| `npm run preview` | Serve `dist/` exactly as GitHub Pages will, under the base path |
| `npm test` | Unit tests (trace generators) |
| `npm run test:e2e` | Playwright smoke tests against `astro preview` (every lesson, every visualizer, search, 404) |
| `npm run check` | Type-check Astro pages and TypeScript |

Before the first `npm run test:e2e`, install the browser once: `npx playwright install chromium`.

## How the site is built

```text
notes (*.md, *.txt)         curriculum/*.yaml (manifests)
        \                          /
         scripts/build-content.ts   ← checks: every note mapped, anchors exist, every line used exactly once
                    |
   src/content/lessons/**.md + src/data/generated/*.json + public/generated/assets/   (all gitignored)
                    |
   astro build  (src/markdown/* plugins: callouts, ❌/✅ cards, interview sections, visualizer slots, code frames)
                    |
   pagefind --site dist   (static full-text search)
                    |
   scripts/verify-output.ts   ← checks: source vs output counts, links/anchors, size budgets, binary allowlist
```

`npm run build` fails if:
- a note is not mapped to a lesson or listed as excluded, link-only or duplicate;
- a heading anchor in a manifest no longer exists in its note;
- a note line is unmapped (a gap) or mapped twice (an overlap);
- a lesson's rendered headings, code blocks, tables or ❌/✅/👉 markers differ from its source note;
- an internal link, asset or `#anchor` is broken;
- the output exceeds 200 MB or 20,000 files, or any file is over 25 MiB;
- a binary file that isn't approved in `curriculum/_assets.yaml` ends up in the output;
- the C# shown in a visualizer no longer matches the note it came from.

`coverage-report.md` lists every note and where it went, per-lesson counts, recovered code blocks,
omitted lines, exclusions and assets. CI keeps it as a build artifact.

## Add a lesson

Lessons are defined in `curriculum/<course>.yaml`. URLs come from the manifest ids, never from file
paths, so folder names with spaces, `#` or `..` are fine.

```yaml
modules:
  - id: sorting                       # → /dsa/sorting/
    title: "Sorting"
    lessons:
      - id: merge-and-quick-sort      # → /dsa/sorting/merge-and-quick-sort/
        title: "Merge sort & quick sort"
        reason: "Why this note sits here (required for unnumbered or moved notes)."
        sources:
          - file: "Competitive Programming/sorting-algorithms-notes.md"   # exact case
            from: "## 4. Merge Sort"       # first heading included (omit = start of file)
            until: "## 6. Heap Sort"       # first heading excluded (omit = end of file)
        cheatsheets: [sorting-searching]
        related: [sql-server/querying/joins]   # other lessons by id; must exist
```

- A lesson can merge several notes or slices. Every line of every note must end up in exactly one place.
- To split a long note, give consecutive lessons `from`/`until` anchors at its own headings.
  `fromLine`/`untilLine` anchor on a plain line when a note has no sub-headings.
- Anchors ignore case, punctuation, emoji and formatting. If a heading appears twice, add `fromOccurrence: 2`.
- `objectives:` (3–5 items) is optional. Without it, the lesson shows "What this lesson covers" from its own headings.
- `curriculum/README.md` documents every field.

**New notes.** Add the note anywhere and run `npm run content`. It fails with "Unmapped note: …" until you
add the note to a lesson. For the Backend course's planned modules, put notes in the module's
`noteFolder` (for example `BackendRoadmap/1.Caching/1.RedisBasics.md`); the error then prints a
ready-to-paste lesson entry. Once a planned module has a lesson, remove its `status: planned`.

**Notes that aren't lessons** go in `curriculum/_site.yaml`: `interview` (routed to Interview Prep),
`duplicates` (re-verified on every build), `linkOnly`, `excluded` (with a reason), `omitLines` (lines dropped
on purpose, listed in the coverage report) and `recoverUnfencedCode` (notes whose code is unfenced text).

## Place a visualizer in a lesson

Add a `place:` entry to the lesson. The pipeline writes a placeholder into the lesson, and the browser
loads the visualizer's code only when it scrolls into view.

```yaml
        place:
          - viz: SortVisualizer
            props: { algorithm: quick, preset: sorted }
            tier: 1
            at: { section: "## 5. Quick Sort" }                  # injected at the end of that section
          - diagram: middleware-pipeline
            at: { section: "## How middleware works internally", codeBlock: 1 }   # replaces the 1st code block there
```

With `codeBlock`, the original text stays on the page behind a "Show text version" toggle. It is also what
shows if the visualizer isn't built yet; the slot then says an interactive version is planned.

A `diagram: <id>` placement shows `src/viz/flow/diagrams/<id>.ts` in the `FlowDiagram` component. To turn
another ASCII diagram into one, copy its labels exactly (the unit tests check them against the note) and
follow "Adding one later" in `curriculum/FLOW_DIAGRAMS.md`, which also lists every flow-style block and why it
was or wasn't converted. Roadmap lessons (`kind: roadmap`, and the checklists of a `kind: roadmap` course) need
no placement: the pipeline puts a `RoadmapGraph` built from the note's headings at the top of the lesson, and
its ticks are the same ones as the page checklist.

## Add a visualizer to the engine

1. **Trace generator** (pure TypeScript, `src/viz/<area>/traces/`): run the algorithm on an input and return every
   step up front as `{ state, highlights, action, codeLine, narration, variables, counters }`
   (`src/viz/engine/types.ts`). Use `ArrayRecorder` for array algorithms. Resolve code lines with
   `lines(code, { compare: 'if (arr[j] > arr[j + 1])' })` so the highlighted line can't silently drift.
2. **Code panel source**: when the note has an implementation, copy it verbatim (see `src/viz/sorting/csharp.ts`)
   and add it to the verbatim check in `scripts/lib/generate.ts`. The trace must mirror that code: same loops,
   same comparisons, same order.
3. **Tests** (`tests/unit/`): final state matches a reference, invariants hold at every step, counters match
   hand-computed values for small inputs, and the line sequence for a tiny input matches the C#.
4. **Component**: a React component that uses `usePlayer` (play/pause, step, scrub, speed, predict mode,
   keyboard) and the shared panels in `src/viz/engine/panels.tsx` (code, narration, variables, counters, legend).
   Use the colour classes `is-compare`, `is-swap`, `is-active`, `is-settled` so colour meanings stay identical.
5. **Register** it in `src/viz/registry.ts` under the name the manifests use. The smoke tests then expect
   every placement of that name to mount.

## Cheat sheets and interview questions

These arrive at Checkpoint 5. Their sources and topics are already planned in `curriculum/_cheatsheets.yaml`
and `curriculum/_interview.yaml`. This section will describe how to edit `src/data/cheatsheets/<sheet>.yaml`
and add questions to `src/data/interview/<topic>.json` (including setting `"reviewed": true` once checked).

## Deploy to GitHub Pages

The workflow is `.github/workflows/deploy-learning-site.yml` at the repository root:
- **pull requests**: install, content checks, unit tests, build with verification, smoke tests. No deploy.
- **pushes to `main`** (and manual runs): the same, then deploy with `actions/deploy-pages`.
- It triggers on changes to `learning-site/**` and to notes and their assets anywhere in the repo.

**One-time setup:** in the repository, open Settings → Pages → Build and deployment and set **Source** to
**GitHub Actions**. Free GitHub Pages needs a public repository.

**Custom domain later:** build with `SITE_URL=https://your.domain BASE_PATH=/` (in the workflow's build step
`env:`), add the domain in Settings → Pages, and you're done. Every internal URL goes through the base path,
so nothing else changes.

**Limits** (checked by the build): GitHub Pages allows a 1 GB site (our budget is 200 MB), 10-minute deploys and
about 100 GB/month bandwidth. The site is plain static files, so it can move to **Cloudflare Pages** (free) if
needed: build command `npm ci && npm run build`, output directory `learning-site/dist`, environment
`BASE_PATH=/`. Cloudflare's free plan allows 20,000 files and 25 MiB per file, which the build already enforces.
Keep the site non-commercial, as GitHub's free Pages terms require.

## Progress data

Lesson completion, quiz scores, checklist ticks and "continue where you left off" are kept in
`localStorage` (key `ly-progress-v1`). The **Your progress** page (footer link) exports and imports them as JSON.

## Content issues

Problems found in the notes are logged in `CONTENT_ISSUES.md`, not silently fixed.
