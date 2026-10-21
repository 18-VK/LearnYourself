# Checkpoint 1: Curriculum

Status: **approved 2026-10-21.** Your answers are recorded below and applied to the manifests. Building
continues with Checkpoint 2.

| # | Decision |
|---|---|
| Q1 | Repository `https://github.com/18-VK/LearnYourself` (public, empty, default branch `main`). This folder is the repo root. Site URL: `https://18-vk.github.io/LearnYourself/` |
| Q2 | Node 24 LTS with the latest Astro. A checksum-verified portable Node 24.22.1 lives in `learning-site/.tools/` (gitignored); CI uses Node 24 |
| Q3 | npm cache, temp files and Playwright browsers live in `learning-site/.cache/` on D: (see `scripts/local-env.sh`) |
| Q4 | Desktop is a separate course |
| Q5 | Math is its own roadmap course |
| Q6 | All binaries **view-only**, with no download links: your 4 files are shown inline (PDF viewer; DOCX converted to read-only pages); the 15 third-party files are shown with credits |
| Q7 | Drop the 7 chatbot offers/filler lines, keep the 2 that carry content (`omitLines` in `_site.yaml`) |
| Q8 | Keep the ChatGPT share links; `XSDForValidation.md` becomes a link on the XML lesson |
| Q9 | Keep your name in sample data as written |
| Q10 | Both personal files stay excluded |
| Q11 | 14 cheat sheets: the 12 plus SOLID & Clean Architecture and Configuration, logging & hosting |
| Q12 | Full logical order; the joins note was corrected to Microsoft's documented order, so nothing needs a "not in note" label |
| Q13 | Site name: **LearnYourself** |
| Q14 | Single newlines render as line breaks |
| Issues | Six note errors fixed in the notes with your approval (see "Resolved" in `CONTENT_ISSUES.md`) |

The original questions follow for reference.

Visual sample (private to you): https://claude.ai/artifact/6oUV9tEUm8iDHWUYVtTQAJ. It is a clickable
preview of the planned look and feel: home catalogue, a DSA lesson with working sorting visualizers,
lesson components, a cheat sheet and Interview Prep. All lesson text, code and answers in it come from
your notes; progress figures are example data.

## 1. Decisions I need from you

### Blockers (the build can't start until these are settled)

**Q1. GitHub repository.** What is the repository URL (`https://github.com/<owner>/<repo>`), and is it,
or will it be, public? Free GitHub Pages needs a public repository. The prompt says this folder isn't a
git checkout, but it is: `git init` has been run here, with no commits and no remote. So the workflow
would go in this folder's `.github/workflows/`. Please confirm that this folder is the repository root.

**Q2. Node version.** The latest Astro (7.4.1) needs Node ≥ 22.22, and Vitest 5 needs ≥ 22.12. This
machine has Node 20.14, which reached end of life in April 2026. Options:
- **Install Node 24 LTS (recommended).** Use the latest Astro, and set CI to Node 24 to match.
- Pin Astro 5.18 (the last line that supports Node 20) and Vitest 3. This means an old major
  version, which the prompt asks me not to choose silently.

**Q3. Disk space.** Drive C: has 1.4 MB free. The npm cache and the temp folder are on C:, so
`npm install` will fail. Either free some space on C: (a few GB), or let me point npm's cache and
temp folder at D: for this project only, for example `npm install --cache D:\npm-cache`. D: has 18 GB free.

### Curriculum

**Q4. Desktop course.** Should WinForms and WPF (folders 20 and 21, 30 lessons) be their own course,
an optional branch after Phase 1? *Recommended: yes.*

**Q5. Math course.** Should Math for Programming be its own roadmap course rather than a DSA track?
*Recommended: own course.* It has 6 levels and 196 checkboxes, its own learning paths, and levels 5–6
go well beyond DSA. It cross-links with the DSA roadmap.

**Q6. Binary files.** Which files may be published? (Full list in §8.) My recommendation:
- **Publish, if you made them:** `Validation And Data Modeling Attributes.pdf`, `Efcore Fluent Api And Attributes.docx`,
  `Modern Wpf Practice Project — Design.pdf`, `Requirements.docx`.
- **Exclude:** all 14 images and PDFs in `InterviewPrep/`, which credit other authors (Rocky Bhatia, Kanaiya Katarmal,
  Pankaj Ikhar, a "LinkedIn Interview Questions Card" by kommula Harikareddy) or look like shared posts, and
  `18.LINQ/Join.jpg`, which carries a `www.dotnetmob.com` watermark. The prompt asked for `Join.jpg` to appear in the LINQ
  joins lesson. Excluding it loses no lesson text, because no note links to it. Interview Prep would then have no image
  gallery at launch.

**Q7. Leftover chatbot lines.** Nine lines in the notes are leftover AI-chat phrasing, such as "Would you like me
to…" and "If you want next, I can:", and three address you by name. *Recommended:* drop the seven pure
follow-up offers (each one listed in the coverage report, so nothing is dropped silently) and keep the two
that carry content. Lines: `ProductionGrade_WebAPI_Checklist.md:48`, `19. OtherTopics/Notes.md:458, 516, 526, 571, 656`,
`ProjectExampleWithCommand.md:324`, `ProjectRelatedStuff.md:617`, `1.Notes_SQL.md:640`.

**Q8. ChatGPT share links.** Four notes link to private ChatGPT conversations: `AppSettingExample.md:3`,
`XSDForValidation.md:3`, `CSharp_Developer_Checklist.md:67` and `10.ASP_AuthenticationNAuthorisation.md:509`. A public
site makes those conversations easy to find. Keep the links, or drop those lines? (`XSDForValidation.md` contains
nothing else, so it is excluded until you decide.)

**Q9. Your name in the notes.** "Aman" or "Aman Kumar" appears in about 100 code samples as sample data
(`aman@example.com` and similar), in one heading ("Practical Recommendations for You (Aman)" in `9.Summary.md`)
and in three chat lines. All the connection strings in the notes are placeholders: `DESKTOP-ABC123`, `Server=.`,
`(localdb)`. No real machine names or paths appear in the notes. *Default:* keep the sample data as it is. Say if you
want it changed in your notes.

**Q10. Personal files.** Should `IntroForInterview.txt` and `Things, I'll focus on.md` stay excluded?
*Default: yes, as the prompt says.*

**Q11. Cheat sheets.** Do you confirm the 12 sheets in §9? Should I add the two optional ones (SOLID &
Clean Architecture; Configuration, logging & hosting)?

**Q12. Query-order visualizer.** The joins note lists the logical order as FROM, JOIN, WHERE, GROUP BY, SELECT, ORDER BY.
The prompt's visualizer uses the fuller FROM → ON → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → TOP. May I use the
fuller order and label HAVING and TOP as additions? Logged as issue 6 in `CONTENT_ISSUES.md`.

**Q13. Site name.** "Dotnet Notebook" is a placeholder used in the sample. Keep it, or give me a name.

**Q14. Line breaks.** Your notes rely on single line breaks (for example "Definition:" on one line and the text on the
next), so the site will render single newlines as line breaks. Confirm.

## 2. Inventory and validation

- **140 notes** (`.md`/`.txt`), excluding `bin/`, `obj/`, `CLAUDE.md` and this prompt, plus **20 binary files**.
- Every note is mapped: **178 lessons**, 2 landing-page slices, 3 Interview Prep sources, 1 verified duplicate,
  1 link-only note and 3 exclusions.
- A throwaway validator checked the manifests against the real files: exact-case paths, every heading anchor,
  every placement anchor and code-block index, every cross-link and asset. It also checked that each note's slices
  cover **every line exactly once**. Result: **0 errors, 0 warnings.** The same checks become part of
  `scripts/build-content.ts` at Checkpoint 2.
- Lesson length: median 5.9 min, longest 16.3 min. Nothing goes over the 20-minute split threshold.

## 3. Courses

| Course | Modules | Lessons | Reading time | Notes |
|---|---|---|---|---|
| Phase 1 — C# & .NET Fundamentals | 11 | 62 | ≈ 6.6 h | Folders 1–19 plus the intro/root notes; ends with the interactive C# checklist |
| Desktop — WinForms & WPF | 5 | 30 | ≈ 3.0 h | Folders 20–21; TaskFlow Studio capstone |
| Phase 2 — ASP.NET Core Web API | 9 | 45 | ≈ 5.3 h | Notes 1–16, auth split into two modules, Task API capstone |
| SQL Server | 7 | 19 | ≈ 2.2 h | Notes 1–10, unnumbered notes placed by topic, plus a Reference module |
| DSA in C# | 4 | 11 | ≈ 0.9 h | 32 visualizer placements |
| Math for Programming | 7 | 7 | — | Roadmap only: 6 level checklists plus paths and resources |
| Backend Developer Roadmap | 12 | 4 | — | Three roadmaps plus a checklist; 11 planned topic modules (see §4) |

Reading time is a word count (code weighted double). Visualizers and quizzes add to it.

Placement decisions worth checking (each one is recorded as a `reason:` in the manifests):
- **Splits.** Long notes are split at their own headings, for example `13.ASP_Custom_authServer.md` into 5 lessons
  (its 1,000-line UserManager section at `###` level), `10.ASP_Authentication…` into 5, `3.OtherUsefulThings.md` into 4,
  and the sorting note into 5. `WFA_Notes.md` has no sub-headings, so it splits at the line `9) DateTimePicker`.
- **Merges.** Tiny companion notes join their main note: `LamdaExpression.md` into delegates, `MemoryStream.md` into
  JSON, `StringBuilder.md` into strings, `Note_2.md` into file handling, `CleanArchitectureNMore.md` into Clean
  Architecture, and `Question.md` (throttling) into the rate-limiter lesson.
- **The grab-bag `19. OtherTopics/Notes.md`** is distributed by topic: data-access overview, string interpolation,
  environment variables and launchSettings, WinForms file dialogs (Desktop course), AssemblyResolve, C++ questions
  (Interview Prep) and `using`/IDisposable.
- **`Dot Net_CLI.md`.** The two copies differ only in formatting. A normalised line comparison found nothing in the root
  copy that the `15.C#_AdvanceTopics/` copy lacks. The lesson uses the fenced copy, and the build re-checks every time
  that they still match.
- **Folder 15 is unnumbered** inside, so its notes are ordered by topic: modern syntax, records, pattern matching,
  extensions, events, DI, configuration, environment, hosted services, resources.

## 4. Backend learning path (ready for future notes)

As you asked, the Backend Developer Roadmap course is built to grow, and `WEBSITE_BUILD_PROMPT.md` has a new subsection,
"Backend learning path (grows over time)", at the end of §3.
- Module 1 holds the three roadmaps and the production checklist. Roadmap headings become nodes and their bullets
  become saved checkboxes.
- 11 **planned modules**, ordered as your roadmap's "Suggested order given where you are" puts them: Caching (Redis),
  Message queues, Load balancers/API gateways/reverse proxies, Observability, System design & resilience, then
  How requests travel, APIs & protocols, Security beyond the basics, Testing, DevOps & infrastructure, and Architecture
  at scale. Each one lists the roadmap headings it will fill (all checked to exist) and shows as "coming soon" until it
  has lessons.
- Each planned module names a folder for future notes (`BackendRoadmap/1.Caching/`, …). When you add a note there,
  the build names the unmapped file and prints a ready-to-paste lesson entry. Add it to the manifest and the
  roadmap nodes link to it automatically.

## 5. Visualizer placement plan

89 placements: **53 Tier 1, 34 Tier 2, 2 Tier 3.** Each one is in the course manifests with its exact heading
anchor, and visualizers load only when they scroll into view.

| Tier | Where | What |
|---|---|---|
| 1 | DSA › Sorting (5 lessons) | Bubble, selection, insertion, merge, quick (plus the sorted-input worst case), heap (array and tree), counting (stable and simple), radix, bucket; two stability demos (including the note's Employee example); interactive summary table; compare mode |
| 1 | DSA › Searching (3 lessons) | Linear, binary (iterative and recursive, predict mode), lower/upper bound on the note's `[1,2,2,2,3]`, binary search on answer (`MySqrt`), jump, interpolation, exponential, ternary (as a function plot), hash buckets, BFS and DFS on an editable graph (grids are modelled as graphs, so the note's `Dictionary` code stays truthful) |
| 1 | SQL › Joins | One placement per join section (INNER, LEFT, RIGHT, FULL, CROSS, SELF, APPLY, anti-join) on the note's exact Customers/Orders data, including the orphan `CustomerId = 4`; query-order pipeline |
| 1 | SQL › Transactions | Two-session simulator: anomalies, all 5 isolation levels, blocking, deadlock |
| 1 | Phase 1 | Stack vs heap (value vs reference, struct vs class copies, boxing), async/await timeline (sync vs async, thread release, `Task.WhenAll`), race condition plus `lock` fix and lock-order deadlock, LINQ deferred vs `ToList()` |
| 1 | Phase 2 | Middleware in/out pipeline plus a reorderable production order, JWT decoder (editing the payload breaks the signature), JWT login → API sequence, RS256 sign/verify, rate limiters (fixed, sliding, token bucket, concurrency, leaky bucket), ASP.NET architecture diagram |
| 2 | Various | DI lifetimes and captive dependency, delegate/event invocation lists, exception through `finally`, EF N+1 and change-tracker states, MVVM layers, binding modes, `CanExecute`, debounce timeline, route matcher, model binding, `HttpClient` pooling, CORS preflight, ProblemDetails, HTTPS vs HSTS, auth three-party flow, refresh rotation, capstone request trace, SQL hierarchy, correlated subquery, indexes (B-trees, seek/scan/lookup, write cost), window functions, recursive CTE, Big-O growth, C# collections (5 placements) |
| 3 | Phase 1 | String immutability vs `StringBuilder`, ThreadPool work queue |

**Diagrams.** The scan found 77 flow-style text blocks. Six are folder trees, which stay as code. The rest go through
one data-driven `FlowDiagram` component. Simple arrow chains (`A → B → C`, vertical `▼` chains) convert automatically;
the box diagrams named in the manifests get hand-written diagram data. Every diagram keeps a "Text version" toggle
showing the original ASCII. Any flow block not yet converted stays a code block and is listed in the coverage report.

## 6. Exclusions and routing

| Note | Goes to | Why |
|---|---|---|
| `InterviewQuestion.md` | Interview Prep | Interview Q&A (3 questions) |
| `SQLTutorial/11.Question.md` | Interview Prep | Interview Q&A (2 questions) |
| `19. OtherTopics/Notes.md` › C++ questions | Interview Prep, `notCoveredYet` | No C++ course |
| `Phase1-…/Dot Net_CLI.md` (root) | Verified duplicate | See §3 |
| `18.LINQ/EFCore/Tutoriallink.md` | Link on the EF Core basics lesson | One URL |
| `Musthave.md` | Phase 1 landing page | Topic headings only |
| `IntroForInterview.txt`, `Things, I'll focus on.md` | Excluded | Personal (Q10) |
| `16.C#_JSON_XML/XSDForValidation.md` | Excluded | Only a ChatGPT link (Q8) |

26 interview-headed sections stay in their lessons and are **also** collected into Interview Prep. Two headings
that match the word "Interview" are roadmap level names, not questions, and are ignored.

## 7. Pipeline design decisions

- **Unfenced code recovery.** Five notes hold code as plain text, including 586 lines of XAML that plain Markdown
  would silently drop. The pipeline detects these runs and renders them as code (issues 14–16 in `CONTENT_ISSUES.md`).
- **Raw HTML is escaped** unless it is on a small allow-list, so a bare `<T>` or XAML tag shows as text instead of vanishing.
- **Heading anchors match on normalised text** (case, punctuation, emoji and HTML entities ignored). Reformatting a
  heading doesn't break the build; renaming or deleting one fails with a clear message.
- **YAML 1.2 parsing.** In YAML 1.1, an unquoted `ON` becomes `true`. The validator caught exactly this in the
  query-order stages. The build will use the `yaml` package's 1.2 core schema.

## 8. Binary files (publishing list)

Nothing is published until you approve it. The same list, with evidence, is in `curriculum/_assets.yaml`.

| File | Size | Who made it (my guess) | Recommendation |
|---|---|---|---|
| `18.LINQ/Join.jpg` | 36 KB | Third party (dotnetmob.com watermark) | Exclude |
| `18.LINQ/EFCore/Validation And Data Modeling Attributes.pdf` | 46 KB | Likely you (AI-chat export, no metadata) | Publish if yours |
| `18.LINQ/EFCore/Efcore Fluent Api And Attributes.docx` | 15 KB | Likely you (python-docx metadata) | Publish if yours |
| `21.TaskFlow Studio/…/Modern Wpf Practice Project — Design.pdf` | 50 KB | Likely you (your project's design doc) | Publish if yours |
| `21.TaskFlow Studio/…/TaskflowStudioIcon.ico` | 1 KB | Likely you (app icon) | Leave out (not a note asset) |
| `Examples/Task_Management_System_API/Requirements.docx` | 14 KB | Likely you (your project's spec) | Publish if yours |
| `InterviewPrep/InterviewPrep/1.jpg` | 103 KB | Third party (Pankaj Ikhar) | Exclude |
| `InterviewPrep/InterviewPrep/2.jpg` | 109 KB | Third party (shared post) | Exclude |
| `InterviewPrep/InterviewPrep/Auth.gif` | 772 KB | Third party (Rocky Bhatia) | Exclude |
| `InterviewPrep/InterviewPrep/LoggingCorelationId.jpg` | 111 KB | Third party (infographic) | Exclude |
| `InterviewPrep/InterviewPrep/MusthaveStrategy.PNG` | 62 KB | Third party (post screenshot) | Exclude |
| `InterviewPrep/InterviewPrep/MusthaveStrategy2.PNG` | 385 KB | Third party (Kanaiya Katarmal) | Exclude |
| `InterviewPrep/InterviewPrep/SlowAPIfix.jpg` | 96 KB | Third party (branded) | Exclude |
| `InterviewPrep/InterviewPrep/SlowAPIfix2.jpg` | 84 KB | Third party (infographic) | Exclude |
| `InterviewPrep/…/100InterviewQuestion.jpg` | 144 KB | Third party | Exclude |
| `InterviewPrep/…/InterviewQuestionsLevelWise.PNG` | 69 KB | Third party (post screenshot) | Exclude |
| `InterviewPrep/…/50InterviewQuestions.pdf` | 23 KB | Unknown (no metadata) | Exclude |
| `InterviewPrep/…/InterviewQues1.pdf` | 642 KB | Third party (metadata: kommula Harikareddy) | Exclude |
| `InterviewPrep/…/InterviewQues2.pdf` | 142 KB | Third party (slide carousel) | Exclude |
| `InterviewPrep/…/InterviewQues3.pdf` | 627 KB | Likely third party | Exclude |

The heap-sort section hotlinks an external image. The heap visualizer replaces it, and the URL stays as an
"original image" link, so the image isn't copied into the site.

## 9. Cheat sheets (`curriculum/_cheatsheets.yaml`)

The 12 sheets from the prompt: C# keywords, operators & pattern matching · C# collections & Big-O · LINQ ·
Async & multithreading · EF Core & migrations · .NET CLI · ASP.NET Core · HTTP methods, status codes & headers ·
Auth & JWT · SQL Server · Sorting & searching complexity · WPF & MVVM bindings.
Optional: SOLID & Clean Architecture; Configuration, logging & hosting (Q11).

## 10. Interview Prep topics (`curriculum/_interview.yaml`)

C# language · .NET runtime & BCL · LINQ & EF Core · ASP.NET Core & Web API (the web-research pilot) · Auth ·
SQL Server · DSA · WPF/MVVM & WinForms · Backend design & troubleshooting. Each targets 40 or more web
questions after the pilot review. C++ is notes-only.
From your notes: 5 standalone Q&As, 26 collected interview sections and the C++ list.

## 11. Hosting limits (re-checked 2026-10-21)

- **GitHub Pages:** published site ≤ 1 GB, deploy timeout 10 minutes, soft bandwidth of 100 GB/month, soft limit of
  10 builds/hour (which doesn't apply to custom Actions workflows), no commercial use. Unchanged from the prompt.
- **Cloudflare Pages (free fallback):** 20,000 files, 25 MiB per file, 500 builds/month, 20-minute build timeout.
  Unchanged from the prompt.

Our budgets are 200 MB and under 20,000 files. The total binary size even if everything were approved is about 4 MB.

## 12. What's in `learning-site/` now

```
learning-site/
  CHECKPOINT-1.md         this report
  CONTENT_ISSUES.md       17 entries (7 possible errors, 6 structural, 4 formatting)
  curriculum/
    README.md             manifest format and the guarantees the build enforces
    phase-1.yaml  desktop.yaml  phase-2.yaml  sql-server.yaml  dsa.yaml  math.yaml  backend-roadmap.yaml
    _site.yaml            catalogue, suggested path, routing, duplicates, exclusions
    _assets.yaml          binary publishing list (all publish: false)
    _cheatsheets.yaml     _interview.yaml
```

The only file changed outside `learning-site/` is `WEBSITE_BUILD_PROMPT.md`: an added subsection, "Backend learning
path (grows over time)", which you asked for. Nothing else was edited, moved or committed.
