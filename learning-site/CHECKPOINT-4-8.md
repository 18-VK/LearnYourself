# Checkpoints 4–8: content, visualizers, quizzes, C# runner and debugger, runnable SQL, practice mode, cheat sheets, Interview Prep

Status: **built and verified locally on 2026-10-24; not committed, pushed or deployed.** Everything below is in the
working tree of the clone at `D:\Data\ly-wt\repo` (uncommitted, for you to review with `git diff` and commit).
Publishing (push + turning on GitHub Pages) waits for your OK. See "Go-live" at the end.

You asked me to complete every point, so I didn't stop at two planned review points:
- **Checkpoint 3 (runner spike):** the result was a clear go (numbers in `CHECKPOINT-3.md`), so I built on it.
- **Checkpoint 7 (interview pilot):** all topics were researched at once instead of a 20-question ASP.NET Core pilot
  first. Every web-researched question is marked `reviewed: false`. ASP.NET Core is still the best topic to
  review first.

## What was built

### Checkpoint 4: all content
- All 7 courses, 178 lessons, rendered from the notes. All 140 notes are mapped or explicitly excluded, with 0 gaps
  or overlaps.
- Code written as plain text in the notes is shown as code blocks: 188 blocks, 23 more than at Checkpoint 2.
  `InterviewQuestion.md`, `SQL_ClauseNmore.md` and the hosted-services note were added to the recovery list.
- **Checklist fix:** checklist ticks had been stored under one shared key, so after a reload, ticking one item
  showed every item ticked. Each item now has its own key.

### Checkpoint 5: Tier 1 visualizers, diagrams and quizzes
**Visualizers.** 43 visualizers fill 156 placements. Each has play/pause, step back/forward, scrubber, speed,
keyboard control (Space, ←, →), reduced motion and a 360 px layout. Predict mode is included wherever it makes
sense. Code panels show the notes' code exactly, and the build fails if a note changes.

| Area | Visualizers |
|---|---|
| DSA | Sorting (Checkpoint 2), searching (linear, binary, bounds, binary search on answer, jump, interpolation, exponential, ternary plot, hash buckets), BFS/DFS on an editable graph or grid, Big-O growth, C# collections (List growth, Dictionary/HashSet buckets, Stack/Queue, LinkedList, PriorityQueue heap, SortedDictionary) |
| SQL Server | Joins on the note's Customers/Orders data (INNER, LEFT, RIGHT, FULL, CROSS, SELF, APPLY, anti-joins), the full logical query order, an isolation-level simulator (dirty/non-repeatable/phantom reads under each level, blocking, deadlock), indexes, window functions, a correlated subquery, a recursive CTE |
| Phase 1 C# | Stack vs heap (struct vs class, boxing), async/await timeline, race condition and deadlock with you choosing the thread order, LINQ deferred vs immediate, DI lifetimes, EF Core change tracking and N+1, delegate invocation lists, exceptions through the call stack, StringBuilder, ThreadPool |
| Phase 2 ASP.NET Core | Middleware pipeline (reorderable, with the consequences), JWT decoder (editing breaks the signature, via the browser's Web Crypto), RS256 sign/verify, the JWT request sequence, rate limiters (fixed, sliding, token bucket, concurrency, leaky bucket), route matching, model binding, HttpClient vs IHttpClientFactory, CORS preflight, ProblemDetails, HTTPS redirect vs HSTS, refresh-token rotation, a capstone trace through the Task API's real code |
| Desktop | Data binding modes, `ICommand.CanExecute`, debounce timeline |

**Flow diagrams.** A `FlowDiagram` component animates a token along the arrows; each diagram keeps the original
ASCII behind "Show text version". It covers 4 planned diagrams plus 61 converted from the notes' ASCII.
`curriculum/FLOW_DIAGRAMS.md` lists all 141 flow-style blocks found, which were converted, and why the rest stayed
as code.

**Roadmap graphs.** Every roadmap lesson (DSA, the 6 math levels, 3 backend roadmaps) opens with an interactive
graph built from the note's headings. Ticks are shared with the page checklist, and nodes link to lessons;
topics with no lesson yet show as "coming soon".

**Quizzes.** All 165 teaching lessons have one: 871 questions (707 multiple choice, 91 predict-the-output, 73
order-the-steps).
- Each question records the section its answer comes from.
- Predict-the-output code must be copied from the lesson, and the build checks this.
- Every question is marked "not yet reviewed".
- Best scores are saved with your progress.
- The 14 roadmap and checklist lessons have no quiz, because they list topics rather than teach them.

### Checkpoint 6: live C# runner and debugger
- **Run** works in the browser. .NET 10 WebAssembly and Roslyn run in a Web Worker, with no remote compile
  service.
  - Download: about 7 MB on first Run, and it's cached after that.
  - Speed: cold start 2–3 s; a warm compile-and-run 0.1–0.3 s.
  - Safety: `while (true) { }` is stopped at 5 s while the page stays responsive.
  - What learners get: edit, stdin, compile errors on the right line, runtime exceptions, an output cap,
    "Expected output", and "Show harness" for added test code.
- **Which blocks are runnable** is decided at build time with the real .NET SDK, and CI does the same.
  - 206 programs (221 code blocks) are runnable, 20 of them with a harness that calls the note's code with the
    note's own inputs.
  - The other 1,175 programs aren't runnable. Most are fragments that don't compile on their own (754), use
    threading (189), or have no entry point (133). The rest use files, ASP.NET, WPF, a database or the network.
  - Details: `runnable-report.md`.
- **Debug** (step-through tracing debugger, like Python Tutor) is on every runnable block.
  - Controls: Continue (to the next breakpoint), Step over, Step into, Step out, **Step back**, Restart, Stop, a
    timeline to scrub and play, and keyboard shortcuts (F5, F10, F11, Shift+F11, ←/→, Space). Breakpoints are set by
    clicking a line number (or F9 in the editor).
  - Panels: the current line highlighted in the code block or the editor; Variables (values flash when they change,
    `this` with its fields, a shared-object marker when two variables point at the same object); Call stack (click a
    caller to see its variables); Console output up to the current step; the exception and its line; the harness's
    line when it is running; and the **auto-visualization**: arrays and lists as cells with `i`, `j`, `lo`, `hi`,
    `mid` and the other index variables drawn as pointers, so every sorting and searching snippet has a basic
    visualization without any extra work.
  - How it works: before compiling, a Roslyn syntax rewriter instruments the program (a step before every statement
    with the locals and parameters that are in scope and definitely assigned there, a frame per call, return values,
    exceptions where they are thrown); a recorder compiled into the program writes the trace; the program runs once in
    the worker; the page replays the trace with the visualizers' player. Values: primitives, strings, arrays, lists,
    sets, queues, stacks, dictionaries (first 64 items), tuples, your own objects by their fields (three levels, cycles
    marked), without running any learner code. The learner's line numbers never move.
  - Limits: 10,000 steps (an endless loop stops there and its first steps are shown; the page stays responsive),
    1,000 nested calls, 4 MB of recorded values, and the usual 5 s and 64 KB.
  - **Instrumentation changes nothing the learner can see.** The build-time check runs every runnable program a
    third time, instrumented, and gives it a Debug button only when the output, outcome, exception type and line are
    identical to the plain run: **206 of 206** pass, all at full instrumentation. `runnable-report.md` has a Debug
    column.
  - Tests: 28 .NET tests on the instrumenter and recorder (line numbers after moved types, loop conditions, foreach,
    definite assignment, out parameters, `this`, recursion, lambdas, three kinds of exception, the step and depth caps,
    value snapshots, the trace format) plus 24 programs run plain and instrumented with identical output; 13 unit
    tests on the stepping rules and the array view; 2 browser tests (debugging a sorting method through its harness
    with a breakpoint and Step back; `while (true)` under Debug stopped by the step cap with the page responsive).
  - Design: `runner/NOTES.md`, section 6.

### Checkpoint 7: cheat sheets and Interview Prep
- **Cheat sheets:**
  - All 14 sheets are done: 1,028 items, each linked back to the lesson section it came from. 16 items fill gaps
    from official docs and are labelled "from docs" with their source.
  - One template renders them all, with a live filter, copy buttons and a print layout (A4/Letter, light theme,
    no navigation).
  - Lessons and course pages link to their sheets.
- **Interview Prep:**
  - 464 questions: 59 from your notes and 405 web-researched.
  - Notes questions copy the answer straight from your note. Their short answer, pitfalls and code must be exact
    quotes, which the build enforces. Every line of `InterviewQuestion.md`, `11.Question.md` and the C++ section,
    and every interview section in the lessons, is used.
  - Every web question cites at least one source with a URL, title and date, mostly learn.microsoft.com, RFCs or
    OWASP. The source URLs were checked live.
  - Pages: Browse (with filters and search), a page per topic, flashcards with "Know it / Review again" piles, a
    timed mock interview with a weak-topics summary, and a credited, view-only gallery of the images and PDFs.
  - Each question has an origin badge and links to its lessons, and each lesson lists its interview questions.

### Checkpoint 8: Tier 2 and 3
- Tier 2 visualizers: all built (listed above), including the debugger's auto-visualization of arrays and lists.
- Tier 3: StringBuilder and ThreadPool visualizers are built, and:
- **Runnable SQL (sql.js).** SQL blocks that can run in the browser get the same Edit / Run / Reset as C#, a result
  table per statement, "Show expected result" (recorded at build time) and "Show setup". SQLite (sql.js, 0.6 MB)
  runs in a Web Worker, from a fresh in-memory database filled with the lesson's own sample data on every run.
  - **Never fake results:** a block is runnable only when the build proves SQLite's result can't differ from SQL
    Server's. The check rejects T-SQL-only syntax and syntax SQL Server lacks, runs the block on the lesson's data,
    checks the data fits its declared types the way SQL Server stores them, rejects anything that depends on
    SQLite's typing (DECIMAL arithmetic, integer division, implicit conversion) or collation, re-runs AVG of INT
    columns as integer averages, and re-runs each query with the table rows stored in reverse order. Queries without
    ORDER BY run with a note that SQL Server may order the rows differently.
  - Result: of 408 SQL blocks in 23 lessons, **47 are runnable**, in 5 lessons (joins, subqueries, CTEs, window
    functions, data types), fed by 7 sample-data blocks. 184 are T-SQL only (42 of them carry the **T-SQL only** label
    on the page, with the construct: `dbo.`, `@variables`, IDENTITY, OFFSET … FETCH, …), 97 query tables the note never
    creates, 24 return no rows, 16 use non-SQL Server syntax, 4 depend on SQLite typing. `sqlrun-report.md` lists
    every block and its verdict.
  - Sample data and which queries use it: `src/data/sqlrun/<lesson>.yaml` (5 files), with a drift guard on the
    setup block's first line.
  - Edited queries run too; when an edit leaves the dialect both engines share, the page says so under the result.
  - Tests: 15 unit tests (tokenizer, dialect rules, grouping, ORDER BY detection, the engine's formatting and
    errors, the reverse-order check, the per-block decision); 3 browser tests (a note's query matches the recorded
    result; labels; an edited query with LIMIT gets the heads-up).
- **Practice mode ("Try it yourself").** 6 DSA lessons (sorting and searching) end with exercises: a starter (the
  note's method signature with an empty body), the cases with expected values, Start → editor, Run tests (through the
  C# runner; pass/fail per case, lists compared item by item), Show solution (the note's implementation, loadable into
  the editor).
  - **20 exercises, 91 test cases**: 12 quote the note's own examples (`reviewed: true`, the quote is checked against
    the lesson), 79 are generated and marked unreviewed on the page.
  - The build compiles and runs two programs per exercise with `Runner.Check`: the note's implementation must pass
    every case, and the starter must compile and fail at least one. It did find one note bug: `RadixSort` throws on an
    empty array (Q-86), so that exercise has no empty-array case.
  - Tests: 20 unit tests (signatures, starter code, C# literals, the harness, the output protocol, the diff); 1
    browser test (starter fails → solution passes → a wrong signature is explained).

### After the checkpoints: learning-effectiveness features (2026-10-24, at your request)
Built from the existing quizzes, exercises and progress data, with no new hand-written content:
- **Before you read** (`src/components/PreTest.astro`): a lesson with a quiz opens with two of its multiple-choice
  questions. A guess before reading makes the answer stick (the pretesting effect); the end-of-lesson quiz asks
  them again for the score. 165 lessons have one.
- **Review today** (`/review/`, `src/scripts/review-schedule.ts`): every quiz question you answer, in the quiz, the
  pre-test or the review page, is scheduled for spaced review (wrong → tomorrow; right → 4 days, then ×2.5, up to
  180 days). Due questions are fetched per lesson (`review-data/<lesson>.json`, 165 files, about 1.5 MB in all,
  loaded only when due), shown interleaved across courses, graded at once and rescheduled; "put in order" questions
  link to their lesson quiz. The home and progress pages show a "Review today: N due" card, which also counts the
  flashcards in the "Review again" pile.
- **Mastery signals** (progress page): a lesson counts as mastered at a best quiz score ≥ 80 %; the others are
  listed as the course's weak spots.
- **Practice hints**: a failed test case says what it tests (its own description), and a **Hint** button reveals the
  note's solution one line at a time (a faded worked example).
- Tests: 11 unit tests (the schedule, interleaving); browser tests for the whole review flow (wrong guess → home
  card → review page → rescheduled → weak spot on the progress page) and the hints.
- **Git & GitHub course** (added the same day, from the new `Git-Github/` notes you dropped in): 22 lessons in six
  modules (basics, core commands, command reference, remotes and undo, branches and pull requests, daily practice),
  a quiz for every lesson (77 questions, unreviewed), the two diagrams in the folder as view-only resources, and a
  new note `Git-Github/4.DailyScenarios.md` with 18 everyday situations and their commands, written for the site and
  labelled as such (commands checked against git-scm.com). The two "copy" files are a verified duplicate and an
  exclusion (Q-87); Q-88 and Q-89 note rendering and wording issues in the notes.
- Not built, because each needs per-lesson authoring or its own review: "repair it" exercises from the notes'
  ❌/✅ pairs, guided debugging tasks with predictions, self-explanation prompts under visualizers, and offline use
  (a service worker). Worth doing next, in that order.

## How to run

```bash
cd learning-site
source scripts/local-env.sh   # this machine only: portable .NET 10 SDK in .tools/, caches on D:
npm ci
npm run dev                    # http://localhost:4321/LearnYourself/ (run `npm run runner` once for Run, Debug and Try it yourself in dev)
npm run build && npm run preview
```

## Results

| Check | Result |
|---|---|
| Content pipeline | 149/149 notes mapped or excluded; 200 lessons; 0 errors, 0 warnings |
| Data checks | 187/187 lessons have a quiz; 14/14 sheets; 464 interview questions pass schema, link and verbatim checks |
| Runnable C# | 206 programs runnable, 206 debuggable (traced output identical) |
| Runnable SQL | 47 of 408 blocks; 5 data files valid; 7 setups each feed a runnable query |
| Practice | 20 exercises verified: the note's code passes 91/91 cases, every starter fails at least one |
| Source vs rendered counts | All 178 lessons match (headings, code blocks, tables, ❌/✅/👉 markers) |
| Internal links and anchors | 22,114 checked, 0 broken |
| Unit tests (`npm test`) | 1,530 passed in 48 files |
| .NET runner tests (`npm run test:runner`) | 99 passed |
| Browser tests (`npm run test:e2e`) | 264 passed: every one of the 200 lesson pages, every visualizer mounts, quizzes, cheat sheet filter and print, Interview Prep, Run, Debug (2), runnable SQL (3), practice with hints (1), pre-test → review queue → weak spots (1) |
| Type check (`npm run check`) | `tsc` clean; `astro check` 0 errors, 0 warnings |
| Lighthouse, mobile, lesson page with visualizers, Run/Debug and exercises (`dsa/sorting/stability-and-simple-sorts`) | Performance **96**, Accessibility **98** (targets ≥ 90 and ≥ 95); a Git lesson scored 96 / 100 |
| Lighthouse, mobile, home page | Performance **95**, Accessibility **96** |

Lighthouse was run with `.cache/tmp/lh/run.sh` (Playwright's Chromium + lighthouse 13.4.1, simulated mobile
throttling) against `astro preview`. Two accessibility findings were fixed on the way: the header's search button had
no name at phone widths (its text label is hidden there), and the light code theme's red and grey were under the
4.5:1 contrast ratio on the code background. The site's colours were then changed twice at your request, finally to
the **Coding Ninjas palette** read from codingninjas.com's own CSS variables: orange `#fa7328` as the brand,
`#141414` text on `#fafafa`, ash greys, and their blue, basil, red, purple and yellow as course accents (`global.css`
tokens for both modes; code in `github-light-high-contrast` / `github-dark-high-contrast`). Their orange is 2.8:1 on
white, so it carries the brand (bars, chips, borders, dark-mode text) while light-mode links use a darker orange of the
same family. Every text colour was checked against every surface it sits on (`.cache/tmp/token-contrast.mjs`, 257
pairs ≥ 4.5:1).

## Budgets

| Budget | Limit | Now |
|---|---|---|
| Total size | 200 MB | 41.5 MB (C# runner 7.3 MB, sql.js 0.6 MB and the review data 1.6 MB of it) |
| Files | 20,000 | 988 (187 of them the per-lesson review-data JSON files) |
| Largest file | 25 MiB | 2.0 MB (the compiler, gzipped) |
| Binaries outside the approved list | 0 | 0 (the runner's `.wasm.gz`/`.dat.gz` files and sql.js's one `.wasm` have narrow allowlist entries by path) |

## Interview questions by topic and origin

| Topic | From notes | Web | Junior / mid / senior | No lesson yet |
|---|---|---|---|---|
| C# language | 25 | 42 | 31 / 27 / 9 | 7 |
| .NET runtime & BCL | 2 | 41 | 13 / 20 / 10 | 9 |
| LINQ & EF Core | 2 | 44 | 10 / 27 / 9 | 11 |
| ASP.NET Core & Web API | 3 | 48 | 15 / 24 / 12 | 7 |
| Auth | 0 | 47 | 9 / 24 / 14 | 2 |
| SQL Server | 14 | 45 | 21 / 26 / 12 | 2 |
| DSA | 0 | 44 | 15 / 20 / 9 | 17 |
| WPF, MVVM & WinForms | 7 | 47 | 14 / 25 / 15 | 6 |
| Backend design | 0 | 47 | 8 / 27 / 12 | 12 |
| C++ (notes only) | 6 | 0 | 3 / 2 / 1 | 6 |
| **Total** | **59** | **405** | | **79** |

Reviewed so far: 0. Set `"reviewed": true` per question as you check them (see the README).

## New entries in CONTENT_ISSUES.md

About 141 new entries; 91 are marked `open` (need your call). Nothing in the notes was changed. Where a note is
wrong, no quiz uses it as a right answer; interview questions follow the docs they cite; visualizers say what they
do. The main groups:

| Section | Entries |
|---|---|
| Formatting that affects rendering (new rows 18–22) | 5 |
| SQL Server (SQL-1…12), searching/collections (S1…8), C# visualizers (CS1…7), ASP.NET (A1…8), diagrams (F1…5), runner (R1, R2) | 42 |
| Found while writing quizzes, cheat sheets and interview questions (Q-1…Q-85), and Q-86 from practice mode | 86 |

Worth fixing first because they render wrongly on the page (and on GitHub):
- the unclosed code fence in `1.Notes_SQL.md` (#19);
- the `Width="*"` heading (#20);
- the broken fence in the TaskFlow notes (#21);
- `[*]` instead of `[x]` in the WPF checklist (#22).

## Not done or limited
- **Heading order.** Lighthouse's `heading-order` audit (weight 3) still flags lessons whose note skips heading
  levels (`##` straight to `####`, e.g. "Quick concept: what does stable mean" in the sorting note). The levels are the
  notes' own structure, so I left them; a rehype plugin that closes the gaps would be a presentation-only fix if you
  want it.
- **Home-page glyphs.** Lighthouse's `color-contrast` audit on the home page flags the course cards' decorative
  glyphs (`aria-hidden`, drawn in a course's accent colour on a 13 % tint of the same colour, a little under 4.5:1
  for the lighter accents). They carry no information, so I left them; the home page still scores 96. Darkening
  the glyph text (or using `--ink` for it) would clear it.
- **Runnable SQL is deliberately narrow:** 47 of 408 blocks. The biggest groups it leaves out are the 97 queries on
  tables the notes never create (a note that added sample data would make them runnable) and arithmetic on DECIMAL
  columns, which SQLite computes differently.
- **Practice cases:** 79 of 91 are generated and unreviewed; they pass with the notes' own implementations, but only
  you can say whether they are good teaching cases. `RadixSort` has no empty-array case (Q-86).
- **Debugger:** expression-bodied lambdas (`x => x * 2`) and iterator blocks are stepped through only partly
  (no steps inside expression lambdas, no catch step in iterators); loops whose condition assigns a variable used
  after the loop fall back to a trace without loop-condition steps and return values (level 1); the trace stops at
  10,000 steps.
- The Browse page holds all 464 questions (about 650 KB of HTML). It works, but rendering from JSON would be lighter.
- Changes you make to visualizer inputs aren't saved across reloads.

## Go-live (Checkpoint 9): waiting for your OK

Nothing has been pushed or deployed, and GitHub Pages is still off. Before the first public deploy, these are the
personal-data scan's findings on the final build (`npm run scan:personal`, full list in `personal-data-report.md`),
none of them new:

| Finding | Where | What it is |
|---|---|---|
| 4 sample passwords (`Strong@123`, `MyPassword`, `StrongP@ssw0rd!`, `__FROM_ENV__`) | notes' connection-string examples | sample values from the notes, not real credentials |
| `DESKTOP-ABC123\SQLEXPRESS` | the SQL Server setup note | the note's own example instance name |
| "Kumar" (44×) and "aman kumar" in sample data | records, XML/JSON and OOP examples, one refresh-token example | kept under your Checkpoint 1 decision (Q9) |
| Email addresses | font and PDF metadata inside two third-party PDFs, Pagefind's credits | third-party; none of yours |
| `/home/web_user` | the .NET WebAssembly runtime and the sql.js worker | the runtimes' virtual file system, not a real path |
| PDF metadata: author "kommula Harikareddy" | `interviewques1.pdf` | the third-party PDF's own author field |
| Q-85 | `19. OtherTopics/Notes.md` | the chat line that addresses you by name; an `omitLines` entry would drop it |

On your OK:
1. Review the working tree in `D:\Data\ly-wt\repo` (`git status`, `git diff`), commit and push `main`.
2. In the repository: Settings → Pages → Build and deployment → Source: **GitHub Actions**. Then re-run the
   "Deploy learning site" workflow (or push again).
3. Verify the live site at https://18-vk.github.io/LearnYourself/: the home page, one lesson per course, a
   visualizer, Run and Debug on a C# example, Run on a SQL example (`sql-server/querying/joins`), a practice exercise
   (`dsa/sorting/stability-and-simple-sorts`), search, a cheat sheet, and Interview Prep.
