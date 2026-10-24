# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A personal .NET learning repository with two halves:

1. **Notes and practice projects.** Mostly Markdown study notes, plus runnable projects that
   illustrate them. No root solution, no tests, no shared build. Each project stands alone with
   its own `.sln`/`.slnx`.
2. **`learning-site/`.** An Astro static site (Node + TypeScript, plus a .NET 10 C# runner) that
   is *generated from those notes* and deployed to GitHub Pages. This half does have unit, .NET and
   Playwright tests, and CI (`.github/workflows/deploy-learning-site.yml`).

```
Phase1-CSharp_And_DotNet_core_fundamental/   C# language + BCL topics (folders 1..21, numbered by study order)
Phase2-ASP.NetAndBackend/
  ASP.Net Core/       numbered ASP.NET notes + Examples/ (the two real API projects)
  SQLTutorial/        numbered SQL Server notes (no code)
BackendRoadmap/       roadmap and production-checklist notes (no code)
Competitive Programming/   DSA notes + one Sorting console project
Git-Github/           Git & GitHub notes (site course `git-github`; `4.DailyScenarios.md` was written for the site)
InterviewPrep/, InterviewQuestion.md, Intro.txt, Type of CSharp projects.md, DotNet_ProjectTypes.txt
learning-site/        the generated learning site (see its README.md and HANDOFF.md)
WEBSITE_BUILD_PROMPT.md   the owner's spec for learning-site/
```

Most Phase1 folders are `Console` scratch projects for one topic. The substantial .NET code lives
in three places, described under **Architecture** below.

### Notes conventions
Phase2 and WPF notes are `N.Topic.md`, numbered by intended reading order within a folder; Phase1
topic folders are numbered but most notes inside are named by topic alone. Style is heavy on
tables, `❌ bad / ✅ good` comparisons, and "why it exists" framing aimed at interview prep. When
editing or adding notes, match the folder's naming and that explanatory tone rather than writing
API reference prose. The larger projects keep design rationale in companion notes in the same
style (`ProjectRelatedStuff.md` in the Task API, `Notes.md` in TaskFlowStudio).

### Notes are the site's input

Every `.md`/`.txt` file in the repo is a note the site build must account for. The build skips
only `bin`, `obj`, `.git`, `.github`, `.vs`, `.vscode`, `node_modules` and `learning-site`, plus the
root `CLAUDE.md` and `WEBSITE_BUILD_PROMPT.md`. Other dot-folders such as `.claude/` are *not*
skipped. So:

- **A new note** fails `npm run content` ("Unmapped note: …") until it is added to a lesson in
  `learning-site/curriculum/<course>.yaml`, or listed in `curriculum/_site.yaml` (`excluded`,
  `linkOnly`, `interview`, …). The same applies to any new `.md`/`.txt` file you create outside the
  skipped folders.
- **Renaming, moving or re-heading a note** can break manifest anchors (`from`/`until`/`at.section`
  name headings) and the line partition, which requires every line of a note to be mapped exactly
  once. After touching a note, run `npm run content:dry` in `learning-site/`.
- The site never edits notes. Problems found in a note go in `learning-site/CONTENT_ISSUES.md`.

## Commands

### .NET notes projects

Paths contain spaces and `#` — always quote them, and prefer `--project` over `cd`.

```bash
# Build / run any project
dotnet build "Phase2-ASP.NetAndBackend/ASP.Net Core/Examples/Task_Management_System_API/Task_Management_System_API.csproj"
dotnet run --project "Phase2-ASP.NetAndBackend/ASP.Net Core/Examples/Task_Management_System_API" --launch-profile https

# EF Core migrations (run from inside the project folder; both API apps are single-project)
dotnet ef migrations add <Name>
dotnet ef database update
dotnet ef migrations script -o scripts/migration.sql
```

These projects have no tests. Verification is manual: run the API and use Swagger at `/swagger`
(Development only), or run the WPF app. Plain `dotnet run` picks the first launch profile (`http`,
`http://localhost:5287`); `--launch-profile https` serves `https://localhost:7060`. The checked-in
`Task_Management_System_API.http` is a stale scaffold (its routes lack the `api/` prefix), so use
Swagger instead.

**The Task API fails fast at startup unless all of these are in place:**
1. SQL Server is reachable at the configured connection string (LocalDB, database
   `DevelopmentTesting`) and migrations are applied. `UseRequiredPipeline()` throws if
   `Database.CanConnect()` is false.
2. `jwt:PublicKeyPath` / `jwt:PrivateKeyPath` point at real PEM files. They are hardcoded to
   another machine's `C:\Users\amanp\...` paths. The public key is read during service registration;
   the private key is read when `TokenService` is first constructed. Generate a pair with the
   `openssl` commands in the auth module's README.
3. Environment variable `TASK_MNG_ADMIN_PWD` is set. `SeedIdentityAsync()` seeds the roles and an
   admin user from `AdminSettings`, and calls `Environment.FailFast` on any error. The password must
   be ≥12 chars with an uppercase letter and a digit (seeder check) **and** pass Identity's rules
   (lowercase and a non-alphanumeric character too).

### learning-site

Run from `learning-site/`. Needs Node ≥ 22.22 (CI uses 24) and, for the C# runner, the .NET 10 SDK.
Without the SDK, `npm run build` warns and builds the site without Run buttons. `LY_REQUIRE_RUNNER=1`
(set in CI) turns that into an error. If the system Node or .NET is too old, portable installs go in
`learning-site/.tools/` and `source scripts/local-env.sh` (Git Bash) puts them on PATH. The README
has the full command table.

```bash
npm ci
npm run content        # content pipeline + all mapping checks; writes coverage-report.md
npm run content:dry    # same checks, writes nothing (safe while a dev server runs)
npm run data:check     # fast re-check of quizzes/cheat sheets/interview JSON+YAML (after one `content`)
npm run dev            # http://localhost:4321/LearnYourself/; dev skips the C# runner (`npm run runner` once for Run buttons)
npm run build          # content → runner → astro build → pagefind → scripts/verify-output.ts
npm run check          # astro check + tsc --noEmit
npm test               # vitest unit tests (tests/unit/)
npm run test:e2e       # Playwright against `astro preview`, so build first; `npx playwright install chromium` once
npm run test:runner    # xunit v3 tests for runner/ (Microsoft.Testing.Platform)

# Single tests
npx vitest run tests/unit/sorting          # by path, or add -t "<test name>"
npx playwright test tests/e2e/runner.spec.ts -g "<title>"
cd runner && dotnet test --project Runner.Tests/Runner.Tests.csproj --filter-class "*DetectionTests"
```

`LY_PORT` changes Playwright's preview port (default 4321). `SITE_URL` / `BASE_PATH` override the
GitHub Pages base path.

Target frameworks are *not* uniform — they range from `net6.0` to `net10.0` across projects, and
each was pinned to whatever SDK was current when that topic was studied. Check the `.csproj`
before assuming language/API availability; do not "upgrade" a project's TFM as a side effect.

## Architecture

### Task_Management_System_API (`Phase2/ASP.Net Core/Examples/`, net10.0)
The reference backend project. Clean Architecture inside a **single** csproj, layered by folder
under `Src/`: `API` → `Application` → `Domain` ← `Infrastructure`. Namespaces mirror the folders
(`Task_Management_System_API.Src.API.Controllers`), so moving a file means renaming its namespace.

`Program.cs` holds the rate limiter and Swagger setup and enables `ValidateOnBuild`/`ValidateScopes`;
everything else is wired through extension methods:
- `AddApplicationServices()` — [ServiceCollectionExtensions.cs](Phase2-ASP.NetAndBackend/ASP.Net%20Core/Examples/Task_Management_System_API/Src/API/Extensions/ServiceCollectionExtensions.cs) registers services, AutoMapper, and each `IValidator<T>` **explicitly** (no assembly scanning — a new validator must be added here or it silently never runs).
- `AddInfrastructure(config)` — DbContext with `EnableRetryOnFailure` driven by the `DBConfig` config section, plus repositories.
- `AddAuthInfrastructure(config)` — [AuthInfrastructure.cs](Phase2-ASP.NetAndBackend/ASP.Net%20Core/Examples/Task_Management_System_API/Src/Infrastructure/DependencyInjection/AuthInfrastructure.cs): ASP.NET Core Identity (`ApplicationUser` + `IdentityRole<Guid>`, stored in `AppDbContext`), RS256 JWT bearer validation, and a **global fallback authorization policy requiring an authenticated user**. Every endpoint is protected by default; public ones need `[AllowAnonymous]` (only `register` and `login` have it).
- `UseCustomMiddleware()` then `UseRequiredPipeline()`, then `SeedIdentityAsync()` (see the startup list above).

Auth lives inside this API: `AuthController` exposes `api/auth/register|login|refresh|revoke`,
`IdentityService` + `TokenService` issue access tokens and rotating refresh tokens, and
registration assigns the `User` role (seeded roles: Admin, User, Moderator). `ICurrentUser` exposes
the caller's identity to services.

The global rate limiter is a token bucket of 10 requests per 5 seconds, partitioned by the
`X-ClientId` header. Requests without that header share a single `anonymous` bucket, so rapid
manual testing from Swagger hits 429s.

Error handling is deliberately two-tiered, and new code should respect the split:
- **Expected failures** flow as data. Services return `Result<T>` (`IsSuccess`, `Value`, `Error`, `StatusCode`) and never throw for business outcomes; controllers translate with a `result.StatusCode switch` into `NotFound`/`BadRequest`/`Conflict`/etc. Services catch `OperationCanceledException` → 408 and unexpected exceptions → 500 after logging.
- **Unexpected failures** hit `GlobalExceptionMiddleware`, which maps exception types to RFC 7807 `ProblemDetails` and attaches `traceId`.

Request validation runs in `ValidationFilter` (registered globally in `Program.cs`) and
short-circuits with a shaped `{ Message, Instance, TraceId, Errors }` body, so controllers contain
no validation code. It resolves `IValidator<>` for each non-null action argument's type and
validates that argument; arguments with no registered validator pass through.

There are three DTO tiers on purpose: `API/DTOs/Requests|Responses` (wire contracts) ↔
`Application/DTOs` (service contracts) ↔ `Domain/Entities`. AutoMapper `MappingProfile` bridges
them; controllers map Request→ApplicationDTO and ApplicationDTO→Response.

`DbContext` config lives in `IEntityTypeConfiguration` classes under `Infrastructure/Configurations/`,
not in `OnModelCreating` inline.

### TaskManagementApi.Auth (`Phase2/.../Examples/CustomAuthServerWithNoFramework_.../`, net8.0)
A deliberately framework-free auth server (no IdentityServer/OpenIddict) written as a drop-in
module: RS256 JWTs signed with an RSA key pair loaded from `.pem` files (paths in the `Jwt` config
section) plus rotating refresh tokens. Layers are top-level folders
(`Api/Application/Domain/Infrastructure`), all registered by `AddAuthInfrastructure(configuration)`.
The Task API carries its own adapted copy of this code (different role names and config section,
`Src/` layout), so changes here do not affect it.

It has no `appsettings.json` and no migrations checked in. Create the config from §2 of its
[README.md](Phase2-ASP.NetAndBackend/ASP.Net%20Core/Examples/CustomAuthServerWithNoFramework_TaskManagementApi.Auth/TaskManagementApi.Auth/README.md)
before running. The README's `-p Infrastructure -s Api` EF flags don't apply, because it is a single
project. `RegisterAsync` assigns the `"Member"` role, so roles must be seeded before registration works.

### TaskFlowStudio (`Phase1/21.TaskFlow Studio/`, net8.0-windows, WPF)
MVVM WPF app that uses the **Generic Host** (`Host.CreateDefaultBuilder` in `App.xaml.cs`) for DI,
configuration, and Serilog — the same composition model as the ASP.NET projects, which is the point
of the exercise. ViewModels are Transient, UI/infra services Singleton, EF repositories Scoped
(`IRepository<>` → `EFRepositoryService<>`), and the container is built with
`ValidateOnBuild`/`ValidateScopes` enabled. `ApplicationSettings` options use `ValidateOnStart`.

Windows open through `IWindowService`, which looks up the View for a ViewModel in a
`Dictionary<Type, Type>` registered in `App.xaml.cs`. A new window needs an entry there plus its
ViewModel registration. Cross-ViewModel communication goes through `IMessageBusService`. There is an
`AutoSaveBackgroundService` whose draft-vs-final-save semantics are discussed in the project's
`Notes.md`. The project has no EF migrations and no `EnsureCreated`, so its tables must already
exist in the configured database.

### learning-site (Astro 7, React islands, TypeScript; C# runner on .NET 10)

`learning-site/README.md` is the authoritative guide, including how to add lessons, visualizers,
harnesses, quizzes, cheat sheets and interview questions. The big picture:

- **Content pipeline** (`scripts/build-content.ts`, `scripts/lib/`). `curriculum/*.yaml` manifests
  slice notes into lessons by heading anchors (one YAML per course, plus `_site.yaml`, `_assets.yaml`,
  `_cheatsheets.yaml` and `_interview.yaml`; fields are documented in `curriculum/README.md`). The
  output (`src/content/lessons/`, `src/data/generated/`, `public/generated/`) is gitignored and
  regenerated on every build, so never edit it. URLs come from manifest ids, never from file paths.
  The build fails on unmapped notes, broken anchors, line gaps or overlaps, and heading/code/table
  count mismatches between a note and its lesson.
- **Hand-edited data** in `src/data/{quizzes,cheatsheets,interview,runnable}/`, validated by Zod
  schemas in `src/data/schema.ts`. Lessons are referenced by their *short* id. Notes-origin interview
  answers must be verbatim excerpts of the note section, and the build enforces that.
- **Visualizers** (`src/viz/`). A pure TS trace generator records every step up front, and a React
  component replays it via `src/viz/engine/usePlayer`. Components are registered by name in
  `src/viz/registry.ts` and placed through `place:` in a manifest. When a note has a C#
  implementation, the code panel shows it verbatim (checked in `scripts/lib/generate.ts`), and the
  trace must mirror its loops and comparisons line for line.
- **C# runner** (`runner/`, its own `Runner.slnx`, `global.json`, `Directory.Build.props` with
  `TreatWarningsAsErrors` and central package management). `Runner.Core` builds and compiles snippets
  with Roslyn. `Runner.Wasm` runs them in the browser in a Web Worker. `Runner.Check` decides at
  build time, using the real SDK and Roslyn's semantic model, which note blocks are runnable, and
  records their expected output. Harnesses that make declaration-only blocks runnable live in
  `src/data/runnable/<lesson id>.yaml` and may only use inputs that appear in the note. Design notes
  are in `runner/NOTES.md`.
- **Debugger** (the Debug button on runnable blocks): a Roslyn syntax rewriter in `runner/Runner.Core/Debugger/`
  instruments the program, a recorder compiled into it writes a trace, and `src/scripts/runner/debug/` replays
  the trace with the visualizers' player. `Runner.Check` also runs every runnable program instrumented and only
  marks it debuggable when the output is identical (`noDebug` in `runnable.json` otherwise).
- **Runnable SQL** (`scripts/sqlrun/`, `src/scripts/sqlrun/`, data in `src/data/sqlrun/<lesson>.yaml`): sql.js
  in a worker; a block gets Run only when `scripts/sqlrun/check.ts` proves SQLite's result can't differ from
  SQL Server's. Checked by `npm run sqlrun` and on every build (no SDK needed).
- **Practice mode** ("Try it yourself", `scripts/practice/`, `src/scripts/practice/`, data in
  `src/data/practice/<lesson>.yaml`): exercises verified with `Runner.Check` after the runner step
  (`npm run practice`); the note's implementation must pass every case and the starter must fail one.
- **`scripts/verify-output.ts`** checks the built `dist/`: links and anchors, a 200 MB / 20,000-file /
  25 MiB-per-file budget, and a binary allowlist taken from `curriculum/_assets.yaml` (plus the C# runner's
  `runner/_framework/*.gz` and sql.js's `_astro/sql-wasm-browser-*.wasm`, approved by path).

**Ground rules for site work** (from `WEBSITE_BUILD_PROMPT.md` and the owner's decisions in
`learning-site/CHECKPOINT-1.md`):

- Don't modify anything outside `learning-site/`, except the deploy workflow. Edit a note only with
  the owner's explicit approval.
- No invented technical content. Text comes from the notes, or from official docs that are cited
  and labelled. Web-researched interview questions carry sources and `reviewed: false` until the
  owner checks them.
- Don't push, enable Pages, change repo settings or trigger a deploy without asking. Pages sites are
  public, so run `npm run scan:personal` after a build and show the owner the findings before a deploy.
- No paid services: code runs only in the learner's browser. New npm or NuGet packages must be
  exact-pinned versions at least 7 days old.
- `learning-site/HANDOFF.md` holds the work state (as of 2026-10-24 everything in the build prompt is
  built and verified locally; what is left is go-live, the owner's call) and the machine-specific
  setup; `learning-site/CHECKPOINT-4-8.md` is the final report.

## Repository-specific gotchas

- **Connection strings and key paths are checked in and machine-specific.** TaskFlowStudio and Personal Finance Tracker (Development) point at `Server=LAPTOP-0DCLBA10\SQLEXPRESS;Database=SysDBPractice`; the Task API uses `(localdb)\MSSQLLocalDB;Database=DevelopmentTesting` and hardcoded PEM paths. Anything that touches a database or keys will fail on another machine until these are changed locally. Don't treat them as secrets to scrub, but don't propagate them into new projects either.
- Serilog is configured entirely from `appsettings.json` (`ReadFrom.Configuration`), with split `Logs/log-*.txt` / `Logs/errlog-*.txt` file sinks. In the Task API, `MinimumLevel:Default` is `Error`, so `LogInformation`/`LogWarning` calls from app code emit nothing and `log-*.txt` stays empty. Lower it locally when debugging.
- Running the Task API writes `Logs/*.txt` inside its project folder. The site's note scan treats any `.txt` as a note, so a local `npm run content` then fails with "Unmapped note". Delete the logs before building the site. In git they are ignored (`**/logs`, case-insensitive on Windows), so CI is unaffected.
- No root `Directory.Build.props`. The only one is `learning-site/runner/`'s. Package versions in the notes projects are per-project and intentionally inconsistent.
- The root `.gitignore` covers `bin/`, `obj/`, `.vs`, and `logs` only. `learning-site/.gitignore` adds `node_modules/`, `.tools/`, `.cache/`, `dist/`, and all generated content and reports.
