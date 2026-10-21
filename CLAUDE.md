# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A personal .NET learning repository, not a shippable product. It is roughly 80% Markdown study
notes and 20% runnable practice projects that illustrate those notes. There is no root solution,
no test project, no CI, and no shared build. Each project stands alone with its own `.sln`/`.slnx`.

```
Phase1-CSharp_And_DotNet_core_fundamental/   C# language + BCL topics (folders 1..21, numbered by study order)
Phase2-ASP.NetAndBackend/
  ASP.Net Core/       numbered ASP.NET notes + Examples/ (the two real API projects)
  SQLTutorial/        numbered SQL Server notes (no code)
BackendRoadmap/       roadmap and production-checklist notes (no code)
Competitive Programming/   DSA notes + one Sorting console project
InterviewPrep/, InterviewQuestion.md, Intro.txt, Type of CSharp projects.md, DotNet_ProjectTypes.txt
```

Most Phase1 folders are `Console` scratch projects for one topic. The substantial code lives in
three places, described under **Architecture** below.

### Notes conventions
Phase2 and WPF notes are `N.Topic.md`, numbered by intended reading order within a folder; Phase1
topic folders are numbered but most notes inside are named by topic alone. Style is heavy on
tables, `❌ bad / ✅ good` comparisons, and "why it exists" framing aimed at interview prep. When
editing or adding notes, match the folder's naming and that explanatory tone rather than writing
API reference prose. The larger projects keep design rationale in companion notes in the same
style (`ProjectRelatedStuff.md` in the Task API, `Notes.md` in TaskFlowStudio).

## Commands

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

There are no tests to run. Verification is manual: run the API and use Swagger at `/swagger`
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

## Repository-specific gotchas

- **Connection strings and key paths are checked in and machine-specific.** TaskFlowStudio and Personal Finance Tracker (Development) point at `Server=LAPTOP-0DCLBA10\SQLEXPRESS;Database=SysDBPractice`; the Task API uses `(localdb)\MSSQLLocalDB;Database=DevelopmentTesting` and hardcoded PEM paths. Anything that touches a database or keys will fail on another machine until these are changed locally. Don't treat them as secrets to scrub, but don't propagate them into new projects either.
- Serilog is configured entirely from `appsettings.json` (`ReadFrom.Configuration`), with split `Logs/log-*.txt` / `Logs/errlog-*.txt` file sinks. In the Task API, `MinimumLevel:Default` is `Error`, so `LogInformation`/`LogWarning` calls from app code emit nothing and `log-*.txt` stays empty. Lower it locally when debugging.
- `Directory.Build.props` does not exist; package versions are per-project and intentionally inconsistent.
- `.gitignore` covers `bin/`, `obj/`, `.vs`, and `logs` only.
