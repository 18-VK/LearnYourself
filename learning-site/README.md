# LearnYourself (learning site)

A static learning site generated from the .NET study notes in this repository: seven courses, step-through
algorithm visualizers, lesson quizzes, printable cheat sheets and an interview question bank. Hosted on GitHub Pages at
**https://18-vk.github.io/LearnYourself/**.

The notes stay where they are and remain the source of truth. This folder only holds the curriculum
manifests that map notes to lessons, the build pipeline, and the site itself. Nothing here edits a note.

## Requirements

- **Node 22.22 or newer** (Node 24 LTS recommended; CI uses 24). Check with `node --version`.
- No other services: no database, no accounts, no paid APIs. Progress is stored in the browser.
- **.NET SDK 10** (current LTS; 10.0.402 used here) for the in-browser C# runner. Optional locally: without it,
  `npm run build` warns and builds the site without Run buttons. CI installs it and sets `LY_REQUIRE_RUNNER=1`, which
  turns a missing SDK into an error. Check with `dotnet --list-sdks`.

If your system Node is older, put a portable Node in `learning-site/.tools/node/` and run
`source scripts/local-env.sh` (Git Bash) before the commands below. The script also keeps npm's cache,
temp files and Playwright's browsers inside `learning-site/.cache/`. Both folders are gitignored.

The same works for .NET: install a portable SDK with Microsoft's script, without touching the system install, and
`local-env.sh` puts it first on `PATH` (with telemetry off and NuGet's cache in `.cache/nuget`):

```powershell
# Windows PowerShell; on Linux/macOS use https://dot.net/v1/dotnet-install.sh with the same options
Invoke-WebRequest https://dot.net/v1/dotnet-install.ps1 -OutFile dotnet-install.ps1
./dotnet-install.ps1 -Version 10.0.402 -InstallDir learning-site/.tools/dotnet -NoPath
```

## Commands

Run these from `learning-site/`:

| Command | What it does |
|---|---|
| `npm ci` | Install the exact dependency versions from `package-lock.json` |
| `npm run dev` | Generate content, start the dev server at `http://localhost:4321/LearnYourself/`, and regenerate whenever a note or manifest changes |
| `npm run content` | Run only the content pipeline and its checks; writes `coverage-report.md` |
| `npm run content:dry` | The same checks without writing anything (safe to run alongside a dev server) |
| `npm run data:check` | Re-check only the quiz, cheat sheet and interview data in seconds, against the last content run (`-- --only quizzes/` to narrow it) |
| `npm run playground` | Render one visualizer on its own page with the site's CSS: `http://localhost:5199/?viz=SortVisualizer&props={"algorithm":"heap"}` (add `&theme=dark`, `&width=360`) |
| `npm run scan:personal` | After a build: scan `dist/` for personal data (emails, names from your git config or `LY_SCAN_NAMES`, machine names, local paths, connection strings, keys, PDF/image metadata); writes `personal-data-report.md` |
| `npm run build` | Content pipeline → Astro build → Pagefind search index → output verification (see below) |
| `npm run preview` | Serve `dist/` exactly as GitHub Pages will, under the base path |
| `npm test` | Unit tests (trace generators) |
| `npm run test:e2e` | Playwright smoke tests against `astro preview` (every lesson, every visualizer, search, 404) |
| `npm run check` | Type-check Astro pages and TypeScript |
| `npm run runner` | C# runner only: publish the browser bundle to `public/runner/` and run the runnable-block check (what `npm run build` does; `npm run dev` skips it, so run this once to get Run buttons in dev) |
| `npm run runner:check` | Only the runnable-block check; writes `runnable-report.md` |
| `npm run test:runner` | .NET unit tests for the runner (`runner/Runner.Tests`) |

Before the first `npm run test:e2e`, install the browser once: `npx playwright install chromium`.

## How the site is built

```text
notes (*.md, *.txt)         curriculum/*.yaml (manifests)
        \                          /
         scripts/build-content.ts   ← checks: every note mapped, anchors exist, every line used exactly once
                    |
   src/content/lessons/**.md + src/data/generated/*.json + public/generated/assets/   (all gitignored)
                    |
   scripts/runner/step.ts   (needs the .NET SDK) ← C# runner bundle → public/runner/; runnable-block check →
                    |                              src/data/generated/runnable.json + runnable-report.md
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
- a binary file that isn't approved in `curriculum/_assets.yaml` ends up in the output (the C# runner's
  `runner/_framework/*.gz` files are approved by path, and their size is reported separately);
- the C# shown in a visualizer no longer matches the note it came from;
- a harness or override in `src/data/runnable/` points at a block that moved or changed, or doesn't make its block
  runnable (see below).

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

## C# runner

C# blocks that can run in a browser get **Edit**, **Run** and **Reset** buttons, a stdin box, an output panel and
the output recorded at build time ("Expected output"). The code compiles and runs only in the learner's browser: the
.NET WebAssembly runtime and Roslyn run in a Web Worker, downloaded (about 7 MB, gzip) the first time someone presses
Run and cached after that. A run is stopped after 5 seconds or 64 KB of output. Design and reasons:
[`runner/NOTES.md`](runner/NOTES.md); measurements: [`CHECKPOINT-3.md`](CHECKPOINT-3.md).

Which blocks are runnable is decided at build time with the real .NET SDK (`runner/Runner.Check`):
- a block is runnable if it compiles as a console program as written, or as top-level statements with the SDK's
  standard `using`s, and then runs to completion;
- it is never runnable if Roslyn's semantic model shows it uses ASP.NET Core, WPF/WinForms, a database or EF Core,
  the file system, the network, threads/tasks/async/locks/timers, the host process, or an API .NET doesn't support in
  the browser;
- blocks that only declare methods or types need a **harness** (below);
- every runnable block is run twice; when the two outputs differ (random numbers, the clock), the block says "output
  varies" instead of showing an expected output.

`runnable-report.md` (gitignored, kept by CI as an artifact) lists every C# block and why it is or isn't runnable.

## Mark a code block runnable, or add a harness for it

Overrides and harnesses live in `src/data/runnable/<lesson id>.yaml`, for example
`src/data/runnable/dsa/sorting/stability-and-simple-sorts.yaml`. Blocks are numbered by their position among the
lesson's **C#** blocks (1 = the first C# block on the page; other languages don't count).

```yaml
blocks:
  # A harness: statements that call the note's code with the note's own sample input.
  - block: 3
    startsWith: "void InsertionSort(int[] arr)"   # guard: fails the build if the note's block changes or moves
    input: "the example in “3. Insertion Sort”: [2, 5, 7, 3]"   # required with a harness: where the input is from
    harness: |
      int[] arr = { 2, 5, 7, 3 };
      InsertionSort(arr);
      Console.WriteLine("[" + string.Join(", ", arr) + "]");

  # Merge consecutive blocks into one program (the buttons go on the last one).
  - merge: [3, 4]
    harness: |
      foreach (var e in staff) Console.WriteLine(e);

  # Text for Console.ReadLine(), taken from the note's own example.
  - block: 5
    stdin: |
      3
      1 2 3

  # Force a block off (or on). `runnable: true` skips the semantic exclusions; the block must still compile and run.
  - block: 6
    runnable: false
    reason: "Prints a different result in a browser"
```

Rules:
- **A harness may only call the note's code with inputs that appear in the note.** No invented examples. Learners see
  it behind **Show harness**, labelled as added code, with the `input:` text.
- Write plain statements; the runner places them: after the block's own statements, as top-level statements next to
  its classes, or (for blocks of bare methods) inside a wrapper class that also holds the methods. Compiler messages
  and exception lines still point at the learner's lines.
- The build fails if a harness doesn't make its block runnable, a block number doesn't exist, or `startsWith` no
  longer matches. Run `npm run runner:check` to try a change in seconds (results are cached per block).
- Problems in a note's code go in `CONTENT_ISSUES.md`, never into a harness that works around them silently.

## Quizzes, cheat sheets and interview questions: the data files

Three folders hold hand-edited data. Their schema is `src/data/schema.ts`; the content pipeline validates every
file on each build and resolves it into `src/data/generated/*.json`, which is all the pages read. A file that
fails stops the build with a message naming the file and the field.

```bash
npm run data:check                  # re-check src/data/* in seconds (after one `npm run content`)
npm run data:check -- --only quizzes   # only the messages about quizzes (or cheatsheets, interview)
npm run data:check -- --write       # also refresh the resolved JSON, so `npm run dev` shows the change
```

Data files refer to lessons by their **short id**: the lesson's `id` in its manifest (`merge-and-quick-sort`,
not `dsa/sorting/merge-and-quick-sort`). Sections are named by their heading as it appears in the note, with or
without the `#`s (`"## 5. Quick Sort"` or `"5. Quick Sort"`); matching ignores case, punctuation and emoji, and
`data:check` suggests the closest headings when one doesn't match.

### Quizzes

One file per lesson: `src/data/quizzes/<lesson-id>.json`, 3–6 questions. The quiz appears at the end of the
lesson as "Check your understanding"; the learner's best score is saved with their progress (`ly-progress-v1`,
included in export/import) and shown on the course page and the progress page.

```json
{
  "lesson": "operators",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "With `int a = 10, b = 3;`, what is `a % b`?",
      "options": ["1", "3", "3.33", "0"],
      "answer": 0,
      "explanation": "`%` is the remainder operator: 10 divided by 3 is 3 remainder **1**.",
      "source": { "section": "### 1. Arithmetic Operators" },
      "reviewed": false
    }
  ]
}
```

| Type | Fields besides the common ones | Notes |
|---|---|---|
| `mcq` | `options` (2–6), `answer` (index into options) | |
| `predict-output` | `code: { lang, source }`, `options`, `answer` | `code.source` must be copied from the lesson (the build checks it); use the smallest block that makes the point |
| `order-steps` | `steps` (3–8) in the **correct** order | the page shuffles them; learners reorder by drag or with ↑/↓ |

Common fields: `id` (`q1`, `q2`, … unique in the file), `prompt` and `explanation` (inline Markdown: `code`,
`**bold**`, `*italic*`, `[links](https://…)`; HTML is shown as text), `source.section` (the lesson heading the
answer comes from: the feedback links to it), and `reviewed`. Leave **`"reviewed": false`** until you have checked
the question yourself; until then it carries a small "Not yet reviewed" note. Set it to `true` once checked.

### Add or edit a cheat sheet

One file per sheet: `src/data/cheatsheets/<sheet-id>.yaml`. The id must be listed in
`curriculum/_cheatsheets.yaml` (that list also sets the order on the Cheat Sheets page). Every sheet is
rendered by the same template at `/cheat-sheets/<sheet-id>/`, with a live filter, copy buttons on snippets and a
print stylesheet; you never touch a component.

```yaml
id: sorting-searching
title: "Sorting & searching complexity"
summary: "One sentence shown under the title and on the index."
groups:
  - title: "When to use what"
    note: "Optional one-line intro."
    items:
      - term: "Need stability"                      # inline Markdown
        desc: "Merge sort, or LINQ `OrderBy()`."      # optional
        code: "var sorted = people.OrderBy(p => p.Age).ToList();"   # optional; gets a copy button
        lang: csharp
        from: { lesson: sorting-summary, section: "### When to Use What (LeetCode Context)" }
      - term: "`Array.Sort` algorithm"
        desc: "Introspective sort."
        docs: { url: "https://learn.microsoft.com/…", title: "Array.Sort Method", accessed: "2026-10-22" }
  - title: "Complexity at a glance"
    table:
      columns: [Algorithm, Best, Worst]
      from: { lesson: sorting-summary, section: "### Summary Table" }   # every row links here…
      rows:
        - ["Merge Sort", "O(n log n)", "O(n log n)"]
        - cells: ["Counting Sort", "O(n+k)", "O(n+k)"]                  # …unless a row names its own
          from: { lesson: counting-radix-bucket, section: "### 7. Counting Sort" }
```

- Each **item** needs exactly one of `from` (a lesson section) or `docs` (an official page). Use `docs` only for an
  obvious gap the notes don't cover, after checking it against Microsoft Learn or the SQL Server docs; the item is
  labelled "From docs" and links to that page.
- A **table row** is a list of cells (it links to the table's `from`), or `{ cells, from }` / `{ cells, docs }`.
  Rows must have as many cells as there are columns. Tables with four or more columns span the full width.
- Lessons cited by a sheet link to it automatically, as do the lessons that list it under `cheatsheets:` in their
  manifest. A course page links to every sheet its lessons do.
- To check printing: open the sheet and use Print (or Ctrl+P). The print view is light, has no navigation or
  filter, keeps cards whole where they fit, and prints docs links with their URL.

### Add interview questions and mark them reviewed

Questions live in `src/data/interview/<topic>.json`, or split by origin into `<topic>.notes.json` (questions from
the notes) and `<topic>.web.json` (web-researched). The topic id and its subtopics come from
`curriculum/_interview.yaml`. Question ids are unique across all topics and start with the topic id.

```json
{
  "topic": "aspnet-core",
  "questions": [
    {
      "id": "aspnet-core-middleware-order",
      "topic": "aspnet-core",
      "subtopic": "pipeline-and-middleware",
      "difficulty": "mid",
      "question": "Why does the order of middleware registration matter?",
      "shortAnswer": "Each middleware wraps the ones registered after it, so …",
      "answer": "**Key points**\n\n- …\n\n```csharp\napp.UseRouting();\n```",
      "code": { "lang": "csharp", "source": "app.UseAuthentication();\napp.UseAuthorization();" },
      "pitfalls": ["Calling `UseAuthorization()` before `UseAuthentication()`"],
      "followUps": ["What is the difference between `Use`, `Run` and `Map`?"],
      "origin": "web",
      "sources": [{ "url": "https://learn.microsoft.com/…", "title": "ASP.NET Core Middleware", "accessed": "2026-10-22" }],
      "relatedLessons": ["middleware"],
      "notCoveredYet": false,
      "versionNote": "Only when the answer depends on the version.",
      "reviewed": false
    }
  ]
}
```

- **`shortAnswer`** is the "start strong" answer: one to three sentences, shown first everywhere.
- **`answer`** is Markdown (lists, tables, fenced code), rendered at build time with the same highlighting as the
  lessons. `pitfalls` are shown with ❌; `followUps` as "Likely follow-ups".
- **`relatedLessons`** (short lesson ids) are required unless `notCoveredYet: true`; each listed lesson then shows
  the question under "Interview questions on this topic".
- **Web questions** (`origin: "web"`): write the answer in your own words, verify it against official docs, and
  give at least one web source (`url`, `title`, `accessed`). If a source contradicts the notes, keep the notes and
  log the conflict in `CONTENT_ISSUES.md`.
- **Notes questions** (`origin: "notes"`) are quoted, never paraphrased:
  - leave `answer` out and set `answerFrom: { file, section }` (the note and its heading line, including the `#`s;
    add `occurrence` if the heading repeats, `until` to stop early). The build copies that section as the answer;
  - `shortAnswer`, every `pitfalls` entry, every `followUps` entry and `code.source` must be **verbatim excerpts of
    that section**. Formatting, punctuation and spacing don't count, and `…` may join two excerpts. The build
    rejects anything it can't find in the section;
  - `followUps` holds only follow-up questions the note itself asks; `sources` lists the note section(s);
  - every line of a note routed to Interview Prep in `curriculum/_site.yaml` (`interview:`) should be used by
    some question, and every "interview" section inside a lesson should be collected too. `data:check` warns
    about the ones still unused.
- **Reviewing**: every question starts with `"reviewed": false`. Web questions show the badge
  "Web-researched, unreviewed" until you check them; set `"reviewed": true` and the badge becomes
  "Web-researched, reviewed". Notes questions always show "From my notes" (plus "Reviewed" once checked). The
  Reviewed filter in Browse finds what is left to check.

Interview Prep has an overview (counts per topic, origin and difficulty), **Browse** (filters and full-text
search; `?topic=…&difficulty=…&origin=…&reviewed=yes|no&q=…&lesson=…` links straight to a filtered view), one
page per topic at `/interview-prep/topics/<topic>/` (every question in full, each at `#<question-id>`, indexed by
site search), **Flashcards** (piles in `localStorage` key `ly-flashcards-v1`), a timed **Mock interview** (history
in `ly-mock-v1`) and the **Gallery** of approved images and PDFs (entries in `curriculum/_assets.yaml` whose
`usedBy` starts with `interview-prep/`).

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
