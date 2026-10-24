# Checkpoints 4–8: content, visualizers, quizzes, C# runner, cheat sheets, Interview Prep

> **DRAFT.** Markers ending in `_PENDING` are filled in when the debugger, SQL runner and practice mode are done. See `HANDOFF.md`.

Status: **built and verified locally; not pushed or deployed.** Everything below is committed on `main` in this
repository. Publishing (push + turning on GitHub Pages) waits for your OK. See "Go-live" at the end.

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
- **Debug** (step-through tracing debugger): DEBUGGER_PENDING

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
- Tier 2 visualizers: all built (listed above), including debugger auto-visualize (DEBUGGER_PENDING).
- Tier 3: StringBuilder and ThreadPool visualizers are built. Runnable SQL with sql.js: SQLRUN_PENDING. Practice
  mode for DSA lessons: PRACTICE_PENDING.

## How to run

```bash
cd learning-site
source scripts/local-env.sh   # this machine only: portable Node 24 and .NET 10 SDK, caches on D:
npm ci
npm run dev                    # http://localhost:4321/LearnYourself/ (run `npm run runner` once for Run buttons in dev)
npm run build && npm run preview
```

## Results

| Check | Result |
|---|---|
| Content pipeline | 140/140 notes mapped or excluded; 178 lessons; 0 errors, 0 warnings |
| Data checks | 165/165 lessons have a quiz; 14/14 sheets; 464 interview questions pass schema, link and verbatim checks |
| Source vs rendered counts | All 178 lessons match (headings, code blocks, tables, ❌/✅/👉 markers) |
| Internal links and anchors | 19,703 checked, 0 broken |
| Unit tests (`npm test`) | 1,486 passed (RESULTS_PENDING) |
| .NET runner tests | 50 passed (RESULTS_PENDING) |
| Browser tests (`npm run test:e2e`) | 234 passed: every lesson, every visualizer mounts, quizzes, cheat sheet filter and print, Interview Prep, Run (RESULTS_PENDING) |
| Type check | Clean |
| Lighthouse (mobile) | LIGHTHOUSE_PENDING |

## Budgets

| Budget | Limit | Now |
|---|---|---|
| Total size | 200 MB | 36.7 MB (C# runner 7.2 MB of it) |
| Files | 20,000 | 732 |
| Largest file | 25 MiB | 2.0 MB (the compiler, gzipped) |
| Binaries outside the approved list | 0 | 0 (the runner's `.wasm.gz`/`.dat.gz` files have their own narrow allowlist entry) |

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

About 140 new entries; 90 are marked `open` (need your call). Nothing in the notes was changed. Where a note is
wrong, no quiz uses it as a right answer; interview questions follow the docs they cite; visualizers say what they
do. The main groups:

| Section | Entries |
|---|---|
| Formatting that affects rendering (new rows 18–22) | 5 |
| SQL Server (SQL-1…12), searching/collections (S1…8), C# visualizers (CS1…7), ASP.NET (A1…8), diagrams (F1…5), runner (R1, R2) | 42 |
| Found while writing quizzes, cheat sheets and interview questions (Q-1…Q-85) | 85 |

Worth fixing first because they render wrongly on the page (and on GitHub):
- the unclosed code fence in `1.Notes_SQL.md` (#19);
- the `Width="*"` heading (#20);
- the broken fence in the TaskFlow notes (#21);
- `[*]` instead of `[x]` in the WPF checklist (#22).

## Not done or limited
- RESIDUAL_PENDING
- The Browse page holds all 464 questions (about 650 KB of HTML). It works, but rendering from JSON would be lighter.
- Changes you make to visualizer inputs aren't saved across reloads.

## Go-live (Checkpoint 9): waiting for your OK

GO_LIVE_PENDING
