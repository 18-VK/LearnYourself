# Prompt: Turn my .NET notes into an interactive learning website

You are building an interactive learning website from the study notes in this repository. Read
`CLAUDE.md` first. It explains what the repo is, how the notes are organised, and their conventions.

## 1. What I want

A static website, hosted on **GitHub Pages**, where each subject is a **separate, self-contained course** with its own landing
page, modules, sidebar and progress. It should not be one long docs tree. It should feel like a
polished course platform: readable lessons, animated diagrams that explain flows, and **live,
step-through algorithm visualizers** where the animation, the code and a plain-English narration
move together. Learners can also edit, run and step-debug C# examples right in the lesson, like
the online IDE on GeeksforGeeks (§11).

The notes are the curriculum. Your job is structure, presentation and interactivity. Do not
rewrite or extend the technical content in the courses.

Besides the courses, the site has two more top-level sections. The main navigation is
**Courses | Cheat Sheets | Interview Prep**.
- **Cheat Sheets** (§9): one-page quick references condensed from the notes, for revision.
- **Interview Prep** (§10): a question bank that combines my notes with questions researched on
  the web. This is the one place where you add researched content.

## 2. Non-negotiables

1. **Don't modify, move or rename anything outside `learning-site/`.** The original `.md`/`.txt`
   notes stay the source of truth, and I'll keep editing them. The site must rebuild from them.
   The only exception is the deploy workflow at `.github/workflows/deploy-learning-site.yml` in
   the repo root (§4), because GitHub only reads workflows from there.
2. **Build the site in `learning-site/`** at the repo root, as a self-contained project with its
   own `package.json` and its own `learning-site/.gitignore` (for `node_modules/`, build output and
   generated content).
3. **No invented technical content.** Lesson text, code and tables come from the notes. You may
   add navigation, learning objectives and summaries drawn from a lesson's own text, quiz questions
   answerable from that lesson's text, and narration strings inside visualizers. If a note looks
   wrong or contradicts another note, log it in `learning-site/CONTENT_ISSUES.md` with the file and
   heading. Don't silently fix it. There are three exceptions, and all are always labelled:
   web-researched interview questions (§10), cheat sheet items verified against official
   documentation (§9), and small harnesses or test cases that make a note's code runnable (§11).
4. **No content loss.** Every table, code block, callout and ❌/✅ comparison in a source note must
   appear in its lesson. The build produces a coverage report (§5) proving every note is either
   mapped to a lesson or explicitly excluded with a reason.
5. **Visualizers explain the code in the notes.** When a note contains a C# implementation (for
   example, every algorithm in `sorting-algorithms-notes.md`), the visualizer's code panel shows
   that exact C# code. The TypeScript trace generator must mirror its logic (same loops, pivot
   choice and comparisons) so the highlighted line is always truthful.
6. **The site is hosted on GitHub Pages** (§4). Set up the workflow, but don't push commits,
   change repository settings or trigger a deployment without asking me first. GitHub Pages sites
   are public, so before the first deploy, scan the generated output for personal data (names,
   emails, machine names, local file paths, connection strings) and show me what you find.

## 3. Course structure

Each course gets its own URL prefix, accent colour, icon, landing page and course-scoped sidebar.
The landing page shows an overview, the modules, the lesson count, estimated hours and
prerequisites. The home page is a course catalogue plus a suggested path: **Phase 1 → SQL Server →
Phase 2 → Backend Roadmap**, with **DSA** running in parallel and **Desktop** as an optional branch
after Phase 1. Cheat Sheets and Interview Prep are separate top-level sections, not courses, but
every course and lesson links to its related cheat sheets and interview questions.

Proposed mapping (refine it at Checkpoint 1):

| Course | Source | Structure |
|---|---|---|
| **Phase 1 — C# & .NET Fundamentals** | `Phase1-CSharp_And_DotNet_core_fundamental/` folders 1–19, plus `Intro.txt`, `Type of CSharp projects.md`, `DotNet_ProjectTypes.txt` and Phase 1 root files (`CSharp_Developer_Checklist.md`, `Dot Net_CLI.md`, `Musthave.md`, `Note.md`) | Modules follow folder numbers. Suggested grouping: Language basics (1–5), OOP & types (6–10), Collections, errors, async, files (11–14), Advanced C# & runtime (15–17), Data access: LINQ, EF Core, Dapper, logging (18–19). `CSharp_Developer_Checklist.md` becomes an interactive checklist. |
| **Desktop — WinForms & WPF** | Phase 1 folders `20.WFA_and_WPF/` and `21.TaskFlow Studio/` | `WPF_Tutorial/` is already numbered 1–12. TaskFlow Studio's `Notes.md` is the capstone module. Sourced from Phase 1 but large and distinct enough to stand alone. Confirm this split with me. |
| **Phase 2 — ASP.NET Core Web API** | `Phase2-ASP.NetAndBackend/ASP.Net Core/` | Numbered 1–16 in order. `3.ASP_ReturnTypesNMore_2.md` follows lesson 3. `File13_content.md` belongs with 13. Place the unnumbered files (`CleanArchitectureNMore`, `DotNet_DesignPatterns`, `HttpsImplementation`, `OpenAPIandSwagger`, `http-headers-rest-api`) by topic. Capstone module from `Examples/` (`ProjectRelatedStuff.md`, the auth module's `README.md` and `docs/IdentityUser_Tutorial.md`). |
| **SQL Server** | `Phase2-ASP.NetAndBackend/SQLTutorial/` | Numbered 1–11 (`1.1 SQLServerSetup.md` follows 1). Place the unnumbered files (ALTER guide, functions, stored procedures, clauses, privileges) by topic or in a "Reference" module. |
| **DSA in C#** | `Competitive Programming/` | `dsa-roadmap.md` is the course map. Then the collections cheatsheet, sorting and searching. `Practice/SortingAlgo` is linked as "try it locally". |
| **Math for Programming** | `Competitive Programming/math-for-programming-roadmap.md` | Roadmap-only: levels become modules with checklists. Make it its own course or a DSA track, and explain your choice. |
| **Backend Developer Roadmap** | `BackendRoadmap/` | Interactive roadmaps with progress, plus `ProductionGrade_WebAPI_Checklist.md` as a persistent checklist. |

Interview material (`InterviewQuestion.md`, `InterviewPrep/`, `SQLTutorial/11.Question.md`) feeds
the Interview Prep section (§10) rather than a course. `csharp-dsa-collections-cheatsheet.md`
appears both as a DSA lesson and as a cheat sheet (§9).

Mapping rules:
- **Paths contain spaces, `#` and `..`** (for example `17..C#_ThreadsAndMultithreading`,
  `1.C#_Basics`). Never derive URLs, slugs or import paths from file paths. Slugs come from the
  manifest (`/phase-1/async-programming/async-await`).
- Numbered files (`N.Topic.md`) keep their order. Unnumbered files are placed by topic, with a
  one-line reason in the manifest.
- **Split long notes** into several lessons at `##` boundaries when a lesson would exceed about 20
  minutes of reading (for example `13.ASP_Custom_authServer.md` at about 1,900 lines and
  `3.OtherUsefulThings.md` at about 1,400). Merge tiny related files into one lesson (for example
  `MemoryStream.md` into the JSON lesson).
- Near-empty files (`ASP.Net Core/Question.md`, `XSDForValidation.md`, `EFCore/Tutoriallink.md`)
  become a link or are excluded. List them in the coverage report.
- `Dot Net_CLI.md` exists both at the Phase 1 root and in `15.C#_AdvanceTopics/`. Compare them and
  propose how to combine them without losing content.
- **Exclude by default (personal, not course material):**
  `InterviewPrep/InterviewPrep/Intro/IntroForInterview.txt` and `InterviewPrep/Things, I'll focus on.md`.
  Ask me before including either.
- PDFs and DOCX files become downloadable resources on the relevant lesson. Don't convert them.
- **The site is public, so third-party files are excluded by default.** The PDFs and images in
  `InterviewPrep/` (for example `50InterviewQuestions.pdf`, `InterviewQues1.pdf`–`InterviewQues3.pdf`
  and `100InterviewQuestion.jpg`) look like they came from other authors. Keep them out of the
  public build. At Checkpoint 1, list every binary file in the repo (PDF, DOCX, image) with your
  best guess at whether I authored it, and ask me which ones to publish. Only approved files go
  into the build.
- Copy images that sit next to notes (for example `18.LINQ/Join.jpg`) into site assets and show
  them in the matching lesson. The heap-sort section hotlinks an external image. The heap
  visualizer replaces it, but keep the link as "original image".
- In the generated output, render `.txt` notes with whitespace preserved or light Markdown
  conversion. The source files stay untouched.

### Backend learning path (grows over time)

I'll add backend topic notes later (caching, message queues, load balancing, observability, system
design, testing, DevOps and so on). Build the **Backend Developer Roadmap** course so it can grow
without restructuring:
- Its first module holds the three roadmaps and the production checklist, as described above.
- Add one **planned module** per topic area that my roadmaps name but no note covers yet, ordered
  by "Suggested order given where you are" in `backend-developer-roadmap.md`. Each planned module
  lists the roadmap headings it will fill and shows as "coming soon" on the course page and on the
  matching roadmap nodes. Don't write content for planned modules.
- Each planned module names a note folder (for example `BackendRoadmap/1.Caching/`). New notes go
  there as `N.Topic.md`. Adding a note must only need a lesson entry in the manifest: until a new
  note is mapped, the coverage check fails, names the file and prints a ready-to-paste lesson entry.
- Once a module has lessons, it gets everything other courses get: callouts, quizzes, cheat sheet
  links, interview questions, and visualizers or diagrams where the notes back them. Roadmap nodes
  switch from "coming soon" to links automatically.

## 4. Tech stack

Use this stack unless you hit a concrete blocker. If you do, tell me before switching.
- **Astro** (latest stable): static output, content collections, Shiki highlighting for C#, SQL,
  JSON, XML, HTTP, PowerShell and Bash. Node v20.14 is installed. If the latest Astro needs a newer
  Node, stop and tell me rather than silently pinning an old major.
- **React** islands for interactive pieces, TypeScript in strict mode
- **Tailwind CSS**
- **Motion** (`motion` package) for animation. Use `d3-hierarchy` / `d3-scale` for layout maths
  only, and render SVG with React.
- **Pagefind** for static full-text search
- **Vitest** for unit tests, **Playwright** for smoke tests
- **CodeMirror 6** for editable code, and the **.NET WebAssembly runtime + Roslyn** for the
  in-browser C# runner (§11). Building the runner needs the .NET SDK in CI. I only have .NET SDK
  7.0.202 locally, so tell me which SDK version to install.
- No backend and no accounts. Progress lives in `localStorage`, with JSON export/import.

**Hosting: GitHub Pages via GitHub Actions**
- Ask me for the GitHub repository URL at Checkpoint 1. This local folder is not a git checkout,
  so don't guess the owner or repo name. Also confirm where the git repo root is, because the
  workflow must sit in that root's `.github/workflows/`.
- Configure Astro's `site` and `base` for a project site (`https://<owner>.github.io/<repo>/`).
  **Every internal link, asset URL, Pagefind path and dynamic import must respect `base`.** Use
  `import.meta.env.BASE_URL` and never hardcode a leading `/`. Make the base path configurable, so
  a custom domain later only needs a config change.
- Workflow `.github/workflows/deploy-learning-site.yml`:
  - On pull requests: install, run the content pipeline, build and test, without deploying.
  - On pushes to `main`: the same, then deploy with the official Pages actions
    (`actions/upload-pages-artifact` + `actions/deploy-pages`, or `withastro/action`).
  - Trigger on changes to `learning-site/**` **and** to the note files and folders (`**/*.md`,
    `**/*.txt`, the note asset folders), because the site is built from the notes. Also allow
    manual runs with `workflow_dispatch`.
  - Use the minimal permissions (`pages: write`, `id-token: write`, `contents: read`) and a
    `concurrency` group so deploys don't overlap.
- The CI runner is Linux, so file paths are case-sensitive, unlike on my Windows machine.
  Manifest paths must match each file's exact case. Run the build once with a case-sensitivity
  check, for example by validating every manifest path against the actual directory listing.
- Copied assets (PDFs, images) get URL-safe file names in the output. Source names contain `#`,
  `&`, spaces and an em dash (`10.SQL_Transactions&Concurrency.md`,
  `Modern Wpf Practice Project — Design.pdf`).
- Add a custom `404.html` that links back to the home page and the course catalogue.
- Write down the one-time manual step in the README: in the repository settings, set Pages →
  Source to "GitHub Actions". Free GitHub Pages requires a public repository.

**Free hosting constraints: the whole setup must stay at $0**
- Host on the GitHub Pages free tier, from a public repository, at the default
  `https://<owner>.github.io/<repo>/` address. Don't add a custom domain unless I ask.
- No paid services anywhere: no servers, paid APIs, databases, paid analytics or paid fonts.
  Everything runs in the browser or at build time, using free and open-source packages only.
  GitHub Actions on standard runners is free for public repositories.
- Stay well inside the GitHub Pages limits:
  - The published site is capped at 1 GB. Set a budget of 200 MB. The C# runner (§11) will be
    the largest single asset, so count it in the budget and report its size separately.
  - Deployments time out after 10 minutes. Keep the deploy job well under that.
  - Bandwidth has a soft cap of about 100 GB per month. Compress and resize images, serve modern
    formats with responsive sizes, and keep lazy-loading the visualizers.
- Keep the site non-commercial (GitHub's terms for free Pages): no selling, paywalls or ads.
- Keep the site portable, with plain static output and no GitHub-specific runtime features, so it
  can move to Cloudflare Pages' free tier if GitHub's terms ever change. That means at most 20,000
  files in the output and no single file over 25 MiB. Note this fallback in the README.
- Sources for these limits:
  [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits),
  [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/).
  Re-check both pages when you start, in case the limits have changed.

## 5. Content pipeline

The notes stay where they are.

1. **Manifests.** `learning-site/curriculum/<course>.yaml` defines modules and lessons. Each
   lesson has one or more source slices (a file, plus an optional heading range), a title, a slug,
   an order, and visualizer or diagram placements.
2. **Generator.** `scripts/build-content.ts` runs before `astro dev` and `astro build`, and watches
   the source notes in dev. It reads the manifests, slices and merges the source Markdown, and
   writes generated lessons into `src/content/lessons/` (gitignored). Each lesson's frontmatter
   includes course, module, order, source paths, estimated minutes (word count, weighted for code)
   and a "View original note" path.
3. **Plain Markdown, not MDX.** The notes contain bare `<T>`, `{ }` and HTML entities that break
   MDX parsing. Inject visualizers as placeholder elements
   (`<div data-viz="SortVisualizer" data-props='{"algorithm":"merge"}'></div>`) at
   manifest-specified anchors, either after a given heading or replacing the Nth code block.
   Hydrate them client-side when they scroll into view.
4. **Coverage report.** The same script emits `coverage-report.md`. It lists every `.md`/`.txt`
   note in the repo (excluding `bin/`, `obj/`, `CLAUDE.md`, this prompt and `learning-site/`) with
   the lesson(s) it maps to or its exclusion reason. It also gives per-lesson counts of headings,
   code blocks and tables in the source versus the generated output. **Any unmapped file or count
   mismatch fails the build.**
5. **Remark/rehype plugins** turn the notes' conventions into components:
   - ❌ / ✅ pairs → side-by-side "Bad vs Good" comparison cards (stacked on mobile)
   - Lines starting with 👉 💡 ⚠️ 🔥 or "VERY IMPORTANT" → callouts (key point, tip, warning)
   - Headings containing "Interview" or "interview traps" → interview callouts, also collected into
     the Interview Prep section (§10)
   - Flow-style ```` ```text ```` diagrams (arrows like `▼`, `│`, `->`) → animated diagrams (§8),
     always with a "Text version" toggle showing the original ASCII. Folder trees, URLs and console
     output stay as code blocks.
   - Tables → responsive, with horizontal scroll and a sticky header

## 6. Lesson experience

Every lesson page has:
- A breadcrumb (course › module › lesson), estimated reading time and a "View original note" link
- 3–5 learning objectives drawn from the lesson's own headings and text
- A sticky table of contents with scroll-spy, and a reading-progress bar
- Code blocks with syntax highlighting, a copy button, line highlighting and a language label
- **Edit / Run / Debug** buttons on C# blocks that can run in the browser (§11), with the
  expected output shown below the block
- A "Check your understanding" quiz at the end (3–6 questions)
- "Mark complete", previous/next lesson, and "Related in other courses" links that point only to
  lessons that exist (for example LINQ Joins ↔ SQL Joins, Phase 1 DI ↔ Phase 2 middleware)
- Light and dark themes, a comfortable line length (about 70ch) and a mobile-first layout

Quizzes and flashcards are data in `src/data/quizzes/<lesson-id>.json`. Each question records the
source heading its answer comes from, plus `"reviewed": false` until I've checked it. Question types:
multiple choice, predict-the-output (using C#/SQL snippets from the notes), and order-the-steps
(pipelines, query processing order).

Progress covers per-lesson completion, best quiz score, course % complete, and "continue where you
left off" on the home and course pages.

## 7. Visualizer engine: live algorithm explanation

Build one engine that drives every visualizer:

- **Trace generators**: pure TypeScript functions that take an input and return every step up
  front. Each step is `{ state, highlights, action, codeLine, narration, variables, counters }`.
  Counters cover comparisons, swaps/writes and array accesses.
- **Player**: play/pause, step forward/back, a scrubbable timeline, speed from 0.25× to 4×, reset,
  and keyboard shortcuts (Space, ←, →). Traces are precomputed, so stepping back is free.
- **Synchronised panels**: the visual stage, a code panel (the C# from the notes with the current
  line highlighted), narration, a variables panel (`i`, `j`, `lo`, `hi`, `mid`, `pivot`, …),
  counters and a legend. Example narration: "Comparing arr[3]=7 with pivot 5. 7 is larger, so it
  stays on the right."
- **Learner input**: editable values, a size slider, and presets (random, sorted, reversed, nearly
  sorted, many duplicates).
- **Predict mode**: pauses before key steps and asks the learner what happens next (which index is
  swapped, which half binary search keeps) before revealing it.
- **Compare mode**: two algorithms race side by side on the same input with live counters.
- **Accessibility**: under `prefers-reduced-motion`, state changes are instant but narration still
  updates. Narration goes into an `aria-live` region, and every control is keyboard operable.
- **Tests for every trace generator**: the final state matches a reference, invariants hold at
  every step (for example, insertion sort's prefix stays sorted), counters match hand-computed
  values for small inputs, and the step sequence for a fixed input matches the C# implementation.

Also build a data-driven **`FlowDiagram`** component (nodes, edges, and ordered steps with a token
animating along the edges). Reuse it for the request pipeline, auth flows, MVVM and the ASCII
diagram replacements, rather than building a one-off animation per diagram.

## 8. Visualizer catalogue

Build these in tier order. Tier 1 is the bar for "done". Every item is backed by an existing note.
Don't build visualizers for roadmap topics that have no lesson content yet. Show those as "coming
soon" nodes on the roadmap instead.

**DSA in C#**
- **T1 Sorting**: bubble, selection, insertion, merge, quick, heap, counting, radix and bucket.
  - Quick sort includes the note's "why quicksort is O(n²) on a sorted array" case as a preset.
  - Heap sort shows the array and tree views in sync.
  - Counting sort includes the note's stable and unstable variants.
  - A stability demo colours equal keys so the learner can see whether their order is preserved.
  - The summary table becomes interactive (best/avg/worst, space, stable) and links to compare mode.
- **T1 Searching**: linear, binary (with lo/mid/hi pointers), lower/upper bound, binary search on
  answer, jump, interpolation, exponential, ternary (on a unimodal function plot), hash-based
  (buckets and collisions), and BFS/DFS on an editable graph or grid with the queue/stack visible.
- **T2 C# collections** from the cheatsheet: `List<T>` capacity doubling, `Dictionary<K,V>`
  bucket hashing, `Stack`/`Queue`, `LinkedList`, `HashSet`, `PriorityQueue` (as a heap) and
  `SortedDictionary`.
- **T2 Big-O growth**: an n slider comparing O(1), O(log n), O(n), O(n log n), O(n²) and O(2ⁿ).

**SQL Server**
- **T1 Joins**: use the exact `Customers`/`Orders` sample data from `4.SQL_JoinsNMore.md`,
  including the orphan `CustomerId = 4`. Animate row-by-row matching for INNER, LEFT, RIGHT, FULL,
  CROSS, SELF, APPLY and anti-join, with the result table building up row by row. No Venn diagrams.
- **T1 Logical query processing order**: FROM → ON → WHERE → GROUP BY → HAVING → SELECT → ORDER BY
  → TOP, as an animated pipeline transforming a small table.
- **T1 Transactions & isolation levels** (`10.SQL_Transactions&Concurrency.md`): a two-session
  timeline simulator showing dirty reads, non-repeatable reads and phantoms under each isolation
  level, plus blocking and deadlock.
- **T2 Indexes** (`6.SQL_IndexNKeys.md`): B-trees for clustered vs non-clustered indexes, seek vs
  scan vs key lookup, covering indexes, and the cost of insert/update/delete.
- **T2 Window functions**: partitions and frames for ROW_NUMBER, RANK, DENSE_RANK and running
  totals over the note's sample data.
- **T2** A correlated subquery evaluated per outer row, and recursive CTE iterations step by step.
- **T3 Optional runnable SQL**: sql.js (SQLite WASM), only for queries valid in both dialects.
  Label T-SQL-only examples (TOP, APPLY, IDENTITY, …) as not runnable. Never fake results.

**Phase 1 — C# & .NET**
- **T1 Stack vs heap**: value vs reference types, copying structs vs classes (`Struct_vs_Class.md`)
  and boxing/unboxing.
- **T1 async/await timeline** (`13.C#_AsynchronousProgramming/`): the thread is released at
  `await` and the continuation resumes later. Includes a sync vs async comparison and `Task.WhenAll`.
- **T1 Race condition & deadlock** (`DeadlockNRaceCondition.md`): two threads interleaving
  `count++` and the fix with `lock`, then two locks taken in opposite order causing deadlock.
- **T1 LINQ deferred vs immediate execution** (`DeferredVsImmediate.md`): items pulled one at a
  time through `Where` → `Select`, and what changes with `ToList()`.
- **T2 DI lifetimes** (`Dependency_Injection.md`): Transient/Scoped/Singleton instance identity
  across scopes, and the captive-dependency trap.
- **T2 EF Core**: change-tracker states (Added, Modified, Unchanged, Deleted, Detached) and the
  N+1 query problem.
- **T2** Delegate invocation lists as subscribers add and remove, and exception propagation up the
  call stack through `finally` blocks.
- **T3** String immutability vs `StringBuilder` buffer growth, and the ThreadPool work queue.

**Phase 2 — ASP.NET Core**
- **T1 Middleware pipeline** (`8.ASP_MiddlewareNMore.md`): a request travels in through middleware
  A → B → C and back out. The learner can reorder middleware (for example, `UseAuthorization`
  before `UseAuthentication`) and see the consequence.
- **T1 JWT**:
  - An interactive decoder (header.payload.signature) where editing the payload breaks the
    signature.
  - RS256: sign with the private key, verify with the public key.
  - The login → token → API call → validation sequence.
- **T1 Rate limiting** (`15.ASP_RateLimitingNmore.md`): fixed window, sliding window, token bucket
  and concurrency limiters, plus leaky bucket from the theory section. The learner fires requests
  and sees accepted and 429 responses on a live timeline.
- **T2** The auth server's three-party flow (client, auth server, resource API) and refresh-token
  rotation (notes 11–14).
- **T2** Model binding (route, query, body and header → action parameters) and a route-template
  matcher.
- **T2** Global exception handling → ProblemDetails, the CORS preflight sequence, `HttpClient`
  socket exhaustion vs `IHttpClientFactory` handler pooling, and HTTPS redirection vs HSTS.
- **T2 Capstone trace** through the Task Management API: Controller → ValidationFilter → Service →
  `Result<T>` → Repository → EF Core → response mapping, using real code from
  `Examples/Task_Management_System_API/Src/`.

**Desktop — WinForms & WPF**
- **T2** Data binding (source ↔ target in OneWay, TwoWay and OneTime modes, with
  `INotifyPropertyChanged` firing), the MVVM layers, `ICommand.CanExecute` toggling, and a
  debounce-search timeline (`DebounceSearch.md`).

**Backend Roadmap and Math**
- **T1** An interactive roadmap graph for each roadmap file. Nodes come from headings, checkboxes
  persist, and nodes link to site lessons where they exist.
- **T1** `ProductionGrade_WebAPI_Checklist.md` as a persistent checklist.

## 9. Cheat Sheets section

A top-level section of quick-reference sheets for revision, separate from the courses. Each sheet
is condensed from the notes: tables, one-line definitions, syntax snippets and "when to use what".
Every row links back to the lesson section it came from.

Start from material that is already cheat-sheet shaped:
- `csharp-dsa-collections-cheatsheet.md`
- the summary tables and "When to Use What" sections in the sorting and searching notes
- the "Quick cheat sheet" in `2.RestAPI_N_HTTPBasics.md`, and `http-headers-rest-api.md`
- `Dot Net_CLI.md`, `EFCore_Migration_Deployment_Summary.md`, `SQL_Server_Functions.md`,
  `SQL_ClauseNmore.md` and `SQL_Server_ALTER_Command_Guide.md`

Proposed sheets (confirm them at Checkpoint 1):

| Sheet | Main sources |
|---|---|
| C# keywords, operators & pattern matching | `3.C#_Keywords/`, `2.C#_operators/`, `CSharp_Pattern_Matching_Notes.md` |
| C# collections & Big-O | `csharp-dsa-collections-cheatsheet.md`, `11.C#_Collections/` |
| LINQ operators, deferred vs immediate | `18.LINQ/Notes.md`, `DeferredVsImmediate.md` |
| Async & multithreading | `13.C#_AsynchronousProgramming/`, `17..C#_ThreadsAndMultithreading/` |
| EF Core & migrations | `18.LINQ/EFCore/`, `EFCore_Migration_Deployment_Summary.md` |
| .NET CLI | both `Dot Net_CLI.md` files |
| ASP.NET Core: middleware order, routing/binding attributes, return types, DI lifetimes | Phase 2 notes 3–9, `Dependency_Injection.md` |
| HTTP methods, status codes & headers | `2.RestAPI_N_HTTPBasics.md`, `http-headers-rest-api.md` |
| Auth & JWT | Phase 2 notes 10–14 |
| SQL Server: syntax, joins, window functions, indexes, isolation levels | `SQLTutorial/` |
| Sorting & searching complexity | `sorting-algorithms-notes.md`, `searching-algorithms-notes.md` |
| WPF & MVVM bindings | `WPF_Tutorial/` |

Requirements:
- Sheets are data (`src/data/cheatsheets/<sheet>.yaml`) rendered by one template, so I can edit
  them without touching components.
- A dense but scannable layout: grouped cards, a filter box, and copy buttons on snippets.
- A print stylesheet so each sheet prints cleanly to A4/Letter, in the light theme, with no
  navigation.
- If a sheet has an obvious gap the notes don't cover, you may add the item only after verifying
  it against official documentation (Microsoft Learn or the SQL Server docs). Link the source and
  mark the item "from docs".
- Each course landing page and lesson links to its related sheets.

## 10. Interview Prep section

A top-level section holding a question bank that covers every course topic: C#, .NET runtime and
BCL, LINQ and EF Core, ASP.NET Core and Web API, auth, SQL Server, DSA, WPF/MVVM, and backend
design and troubleshooting. It has two kinds of content.

**1. From my notes.** `InterviewQuestion.md`, `SQLTutorial/11.Question.md`, the interview
sections collected across all notes (§5), and the images and PDFs in `InterviewPrep/` that I've
approved for publishing (§3), shown as a gallery and downloads. These come first and are tagged
`origin: "notes"`.

**2. Researched on the web.** You may search the web for commonly asked interview questions on
each topic, to fill gaps the notes leave. Rules:
- Aim for broad coverage at junior, mid and senior level: about 40 or more questions per major
  topic, deduplicated against the notes and each other.
- Write every answer in your own words. Don't copy answers verbatim from other sites. Keep any
  quotation short and attributed.
- Verify each technical claim against official documentation: Microsoft Learn for C#, .NET,
  ASP.NET Core and EF Core, and the SQL Server docs on Microsoft Learn. Where an answer depends on
  the version (for example .NET Framework vs .NET 8), say so.
- Record the sources for each question (URL, title, date accessed). Prefer official docs and
  well-known sources. Skip sites behind paywalls or logins.
- If a web source contradicts my notes, don't override the notes. Log the conflict in
  `CONTENT_ISSUES.md`.
- Questions on topics no course covers yet are allowed, tagged `notCoveredYet: true`.

**Answer format** (mirrors the style of `InterviewQuestion.md`): a **short answer first** ("start
strong"), then key points, a code example where useful, common traps ❌, and likely follow-up
questions.

**Data.** Questions live in `src/data/interview/<topic>.json`. Each one has `id`, `topic`,
`subtopic`, `difficulty`, `question`, `shortAnswer`, `answer`, `code?`, `pitfalls[]`,
`followUps[]`, `origin`, `sources[]`, `relatedLessons[]`, `notCoveredYet` and `reviewed: false`.
Validate them against a schema at build time.

**Features:**
- Browse and filter by topic, difficulty, origin (notes or web) and reviewed status, with
  full-text search.
- Flashcards (question → short answer → full answer), with shuffle and "know it / review again"
  piles stored in `localStorage`.
- Mock interview mode: a random timed set from the chosen topics. The learner answers out loud or
  in a text box, reveals the model answer, then rates themselves. A summary at the end lists weak
  topics with links to the lessons that teach them.
- Each question links to the lessons that teach it, and each lesson shows "Interview questions on
  this topic".
- Every question carries an origin badge ("From my notes" or "Web-researched, unreviewed"), so I
  can see what I've checked.

## 11. Live code runner and debugger (like the GeeksforGeeks online IDE)

Learners can edit a C# example, run it, and debug it step by step without leaving the lesson.

**Hard rules**
- **Code compiles and runs entirely in the learner's browser.** Never send code to a remote
  compile service (Judge0, Piston, a hosted API, …). Those cost money or have rate limits, and
  they break the $0 rule (§4).
- Run the .NET WebAssembly runtime and Roslyn **inside a Web Worker**, not on the page's main
  thread. Use the plain .NET WebAssembly app model (`[JSExport]`), not a Blazor UI. A runaway loop
  must never freeze the page: terminating the worker stops it.
- Load the runner only when the learner first presses Run or Debug, with a progress bar
  ("Loading the C# compiler, one-time download of about N MB"). After that, it's cached.
- Follow Microsoft's guidance for hosting .NET WebAssembly on static hosts and GitHub Pages: the
  base path, a `.nojekyll` file, and how precompressed files are served. Verify that it works
  under the `base` path.

**Run**
- C# blocks that can run get **Edit**, **Run**, **Debug** and **Reset** buttons. Pressing Edit
  turns the block into a CodeMirror editor with C# highlighting.
- There's a stdin box for programs that call `Console.ReadLine()`, and an output panel.
- Compile errors appear inline on the right line, with the compiler's message. Runtime exceptions
  show their type, message and line.
- Limits: a run timeout (about 5 seconds) and an output cap. When a limit is hit, say so clearly.

**Which blocks are runnable**
- This is decided at build time, in CI, with the real .NET SDK. A block is runnable if it compiles
  as a console program as written, or after its statements are wrapped as top-level statements
  with standard `using`s.
- Blocks that define a method but have no entry point (for example the sorting and searching
  implementations) get a small **harness**: a `Main` that calls the method with the note's own
  sample input.
  - Harnesses live in `src/data/runnable/<lesson-id>.yaml`.
  - The learner sees them behind a "Show harness" toggle, marked as added code.
  - Overrides go in the same file: force a block on or off, or merge consecutive blocks into one
    program.
- These don't get a Run button, because they can't run in a browser: ASP.NET Core, WPF/WinForms,
  EF Core, and anything that needs a database, the file system or the network.
- Threading examples also stay non-runnable. .NET on WebAssembly is single-threaded, so race
  conditions and deadlocks won't reproduce. The visualizers in §8 explain those instead.
- CI runs every runnable block once and stores its output, which appears as "Expected output"
  under the block.
- Prioritise DSA algorithms and Phase 1 language topics (folders 1–12, 16, and LINQ in 18), where
  most blocks are self-contained.

**Debug: step-through, like Python Tutor**

A real debugger can't attach inside the browser, so build a **tracing debugger**:
- Before compiling, a Roslyn syntax rewriter instruments the code. Before each statement it
  records the line and the in-scope locals and parameters (found through the semantic model). On
  method entry and exit, it records the call stack.
- Running the instrumented program produces a full execution trace. The debugger replays that
  trace with the same player as the visualizers (§7), so **stepping back works**.
- Instrumentation must not change behaviour: the instrumented program's output must equal the
  plain run's output.
- **Controls**: Debug, Continue (to the next breakpoint), Step Over, Step Into, Step Out, Step
  Back and Restart. Clicking in the gutter sets a breakpoint.
- **Panels**:
  - the current line, highlighted in the editor
  - **Variables**, where values flash when they change
  - **Call Stack**
  - **Console output** up to the current step
  - the exception and its line, if one is thrown
- **Value snapshots** cover primitives and strings, arrays, `List<T>` and `Dictionary<K,V>`
  (first N items), and object fields and properties to a limited depth.
- A step cap (about 10,000 steps) stops infinite loops cleanly in debug mode.
- **T2 auto-visualize**: arrays and lists render as cells, with `int` locals such as `i`, `j`,
  `lo`, `hi` and `mid` drawn as pointers under the matching index. Every sorting or searching
  snippet then gets a basic visualization for free.

**SQL**: the optional sql.js runner (§8, T3) uses the same editor, Run button and output panel,
with the same dialect labelling.

**T3 Practice mode (optional)**: DSA lessons get a "Try it yourself" editor. The starter code is
the note's method signature, and the test cases come from the note's own examples. Tests run in the
browser and show pass/fail per case. Generated test cases are marked `reviewed: false`.

**Tests**
- Unit tests for the instrumenter: line numbers, captured locals, call-stack depth and exception
  steps are correct for a set of small programs.
- A Playwright test runs a sample of runnable blocks in the browser and compares their output with
  the output recorded in CI.
- A Playwright test proves that `while (true) { }` is stopped by the timeout or step cap, and that
  the page stays responsive.

## 12. Design

- A calm, editorial look: generous whitespace, readable type (one body font and one monospace) and
  a strong hierarchy. Animation exists to explain. No decorative motion.
- Each course has its own accent colour and icon on a shared neutral palette.
- Visualizer colour meanings (comparing, swapping, settled, pointer, active) are identical across
  every visualizer and pass WCAG AA contrast in both themes.
- Visualizers work at 360px wide, with panels stacked vertically.
- Visualizer JavaScript loads only when the visualizer scrolls into view.
- Lighthouse targets on a lesson page with a visualizer: Performance ≥ 90, Accessibility ≥ 95.

## 13. Build plan: stop at each checkpoint

1. **Curriculum (no site code yet).** Inventory every note. Write the course manifests, the
   visualizer placement plan (which visualizer goes in which lesson, after which heading), the
   exclusion list, the cheat sheet list, the interview topic list, the binary-file publishing list
   (§3) and your open questions. Include the GitHub repository URL and a confirmation that the
   repository is, or will be made, public. **Stop and wait for my approval.**
2. **Foundation plus one showcase.** Scaffold `learning-site/` with the content pipeline, coverage
   report, design system, home/course/lesson templates and the visualizer engine. Ship the complete
   Sorting visualizer in the DSA course. Add the GitHub Actions workflow and verify that a
   production build works under the `base` path locally (`astro preview`). Don't deploy yet.
   **Stop for my review of the look and feel before scaling.**
3. **C# runner spike.** Before building the full runner, prove the approach. From a production
   build served under the `base` path, compile and run one sorting snippet in a Web Worker, and
   trace it in debug mode. Report the download size, the cold-start time (download plus first
   compile), the warm compile-and-run time, and whether a runaway loop is stopped cleanly.
   **Stop for a go/no-go decision.** If it doesn't work well enough, propose alternatives that
   still cost $0.
4. **All content.** Every course rendered from the notes, with callouts, comparisons, search and
   progress working, and the coverage report passing.
5. **Tier 1 visualizers and diagrams**, then the lesson quizzes.
6. **Live code runner and debugger**: Run, Debug, runnable-block detection and harnesses, expected
   outputs, and the tests in §11.
7. **Cheat Sheets and Interview Prep.** Build the cheat sheet template and all sheets. For the
   interview bank, start with the questions from my notes. Then research a pilot batch of about
   20 web questions for one topic (ASP.NET Core), with sources. **Stop for my review of the format
   and quality**, then research the remaining topics.
8. **Tier 2 and 3 items** (visualizers, debugger auto-visualize, practice mode, runnable SQL) as
   time allows. Report what's left.
9. **Go live on GitHub Pages.** Run the personal-data scan, confirm that only approved binary
   files are in the build, check the size and file-count budgets, and show me the results. Once I
   approve, I'll enable Pages (or you can, if I say so), push, and confirm the deployed site works
   at the `github.io` address: home page, one lesson per course, a visualizer, running and
   debugging a C# example, search, a cheat sheet and Interview Prep.

At each checkpoint, report what was built, how to run it, the test results, a summary of the
coverage report, the built site's total size and file count against the budgets, the interview
question counts per topic and origin, and any new entries in `CONTENT_ISSUES.md`.

## 14. Definition of done

- `npm run build` in `learning-site/` passes, with every note mapped or explicitly excluded and
  zero coverage mismatches.
- `npm test` passes (trace generators and pipeline).
- A Playwright smoke test visits every lesson page and asserts that there are no console errors
  and that each placed visualizer mounts.
- The internal link check passes (no broken links or anchors).
- Every Tier 1 visualizer supports play, step back, step forward, custom input, reduced motion and
  keyboard control.
- Every C# block marked runnable compiles and runs in CI with the real .NET SDK. For a sample of
  blocks, the in-browser output matches the output recorded in CI.
- Run and Debug work on the production build: edit, run, stdin, compile errors, step
  over/into/out/back, breakpoints, variables, call stack and console output. An infinite loop is
  stopped by the timeout or step cap without freezing the page.
- Every cheat sheet renders, prints cleanly and links back to its lessons.
- Every interview question passes schema validation, and every web-researched question has at
  least one source. Each question links to a lesson unless it is tagged `notCoveredYet`.
- `learning-site/README.md` explains how to:
  - run and build the site
  - add a lesson to a manifest
  - add or edit a cheat sheet
  - add interview questions and mark them reviewed
  - place a visualizer in a lesson
  - add a new visualizer to the engine
  - mark a code block runnable, or add a harness for it
  - deploy to GitHub Pages, including the one-time repository setting and how to change the
    base path for a custom domain
- The GitHub Actions workflow builds and tests on pull requests and deploys on `main`. The
  production build works under the `base` path, with no broken links or assets in
  `astro preview`.
- A CI step fails the build if the output exceeds 200 MB in total, exceeds 20,000 files, contains
  any single file over 25 MiB, or includes a binary file that isn't on the approved publishing list.
- The site costs $0 to run: GitHub Pages free tier, no paid services or dependencies.
- Nothing outside `learning-site/` has changed except
  `.github/workflows/deploy-learning-site.yml`.
