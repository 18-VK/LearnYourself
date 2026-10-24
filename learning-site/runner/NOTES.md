# C# runner: design notes

The runner lets a learner edit and run a C# block from a lesson **in their own browser**. Nothing is sent to a
server: the .NET WebAssembly runtime and the Roslyn compiler run inside a Web Worker on the page. This note explains
how the pieces fit and *why* each decision was made, and how the tracing debugger is built on top (section 6).

| Piece | Where | Runs |
|---|---|---|
| Program shapes, compiler, executor | `Runner.Core/` | in the browser **and** at build time |
| Browser bundle (`[JSExport]` API + worker script) | `Runner.Wasm/` → `public/runner/` | browser (Web Worker) |
| Runnable-block check | `Runner.Check/` + `scripts/runner/check.ts` | build time (CI) |
| Page UI (buttons, panel, editor) | `src/scripts/runner/*`, `src/styles/runner.css` | browser (page) |
| Debugger: instrumenter, recorder, trace | `Runner.Core/Debugger/` | in the browser **and** at build time |
| Debugger UI | `src/scripts/runner/debug/*`, `src/styles/debugger.css` | browser (page) |
| Unit tests | `Runner.Tests/` (xUnit v3) | `npm run test:runner` |

## 1. Why one shared core

`Runner.Core` is compiled into both the browser bundle and the build-time check. "Runnable" is decided by compiling
the block with **the same code and the same reference assemblies** the browser uses, so "it compiled in CI" means
"it compiles in the learner's browser". A second, hand-written copy would drift.

### Reference assemblies (`References.props`)

A learner's program is compiled against a short list of reference assemblies from the SDK's own targeting pack
(`Microsoft.NETCore.App.Ref`, net10.0): `System.Runtime`, `System.Console`, `System.Collections` (+ NonGeneric,
Specialized, Concurrent), `System.Linq`, `System.Memory`, `System.ObjectModel`, `System.Runtime.Numerics`,
`System.Text.RegularExpressions`.

- **Why the targeting pack and not Basic.Reference.Assemblies?** The pack ships with the SDK (no extra package) and is
  exactly the version the browser runtime pack is built from. Basic.Reference.Assemblies embeds *every* reference
  assembly in one DLL, which would put ~170 assemblies in the download when ~11 are needed.
- **Why a short list?** Every assembly a program can compile against must also be present, *untrimmed*, at run time
  (`RunnerKeep` → `TrimmerRootAssembly`), or a program could compile and then fail with `MissingMethodException`.
  Each addition costs download size. `runnable-report.json` lists the assemblies blocks use, and blocks that need
  something else are reported as `not-in-runner`, so the list can grow on evidence.
- `System.Private.CoreLib` is kept whole (≈1.6 MB gzip) for the same reason: `System.Runtime`'s types live there.

### Program shapes (`ProgramBuilder`)

Notes contain whole programs, bare statements, and bare methods. The learner's text is **never edited**; added code
goes into separate files or is fenced with `#line` directives, so compiler messages and stack traces always point at
the learner's own line numbers.

| Block contains | Shape | What is compiled |
|---|---|---|
| top-level statements (+ local functions / types) | `TopLevel` | `snippet.cs`; type declarations written *before* the statements are moved after them (C# requires statements first), and a harness goes after the statements, each moved part with its own `#line` |
| only types, one with `static Main` | `EntryPoint` | as written |
| only types, no Main | `TypesWithHarness` | as written + `harness.cs` (top-level statements) |
| only methods / fields / properties | `MembersWithHarness` | wrapped in `partial class Snippet { … }` with `#line`; the harness becomes `Snippet.RunHarness()` |
| declarations and no harness | `NothingToRun` | not runnable (`no-entry-point`) |

Every program also gets `usings.cs`: the SDK's implicit usings for a console app (`ImplicitUsings=enable`) minus
`System.Net.Http`. That is the "wrap as top-level statements with standard usings" rule.

Wrapping member-only blocks in a class (rather than treating `void Sort(int[] a)` as a local function) also accepts
`public static` methods, and gives the debugger proper method frames (`Snippet.BubbleSort`).

### Compiling (`SnippetCompiler`)

- `OutputKind.ConsoleApplication`, Debug optimisation (exact statement lines), portable PDB, C# 14, nullable off
  (notes are written without annotations), `concurrentBuild: false` (WebAssembly is single-threaded).
- **Each tree has an empty path and names itself with a leading `#line 1 "snippet.cs"`.** When emitting a PDB,
  Roslyn computes a checksum for every tree that has a path with `Task.Run` and blocks on it; on single-threaded
  WebAssembly that wait throws "Cannot wait on monitors on this runtime". Files named only by `#line` get no checksum.
  `SnippetCompiler.DocumentPath(tree)` recovers the name.
- `CompilationTransform` is the hook for the debugger: a function from compilation to compilation, applied after
  parsing and before emitting (the instrumenter rewrites the trees there).

### Running (`SnippetExecutor`)

- Loaded with `AssemblyLoadContext.LoadFromStream` (collectible when the runtime allows), entry point invoked by
  reflection with `Console.Out/Error/In` redirected. Reading `Console.In` throws in the browser, so it is replaced, not
  saved.
- **Async Main is awaited, not blocked on.** The compiler's synthesized `<Main>` wrapper calls
  `GetAwaiter().GetResult()`, which a single-threaded runtime can't do; the executor finds the real async method
  (`Main` or `<Main>$`) and awaits it. (Async blocks are still excluded by the check; this keeps edited code working.)
- **Output cap** (64 KB): `CappedWriter` counts characters and throws `OutputLimitExceededException` into the program;
  output is flushed to the page in chunks (every 4 KB or 50 ms at a newline), so output before a timeout is not lost.
- **Exception lines**: the executor maps each stack frame's IL offset to a sequence point in the PDB with
  `System.Reflection.Metadata` itself. That works the same on Mono/WebAssembly and CoreCLR, where runtime support for
  file/line info differs.
- Culture is fixed to en-US in both places (`RunnerCulture`) so number/date formatting in "Expected output" matches.

## 2. The browser bundle (`Runner.Wasm`)

Plain `Microsoft.NET.Sdk.WebAssembly` app — no Blazor. `RunnerExports` exposes `Init`, `WarmUp` and `Run` with
`[JSExport]`; output and phase changes come back through `[JSImport]` functions in the `runner-host` module.

Publish settings: trimmed (`TrimMode=full`, so Roslyn is trimmed to what we call), the reference/runtime assemblies
above rooted, no threads, `UseSystemResourceKeys=false` (real exception messages: notes print `ex.Message`), ICU on with
the culture fixed to en-US (so only the `icudt_EFIGS` shard is published), and no PDBs (`DebugType=none`,
`TrimmerRemoveSymbols`): otherwise the trimmer stamps every assembly it rewrites with the path of a PDB under `obj/`,
a local machine path on a public site. `publish.ts` fails the build if any published file (inflated) contains a path
of the build machine. No `wasm-tools` workload: AOT would make compiling faster but the download several times larger.

### Hosting on a static host (`scripts/runner/publish.ts`)

Verified against Microsoft's own GitHub Pages deployment (dotnet.github.io/blazor-samples, see CHECKPOINT-3.md):
GitHub Pages gzips `.wasm` on the fly, serves `.gz` files as `application/gzip` **without** `Content-Encoding`, and
serves `.br` as `application/octet-stream`. Microsoft's guidance is a JavaScript Brotli decoder in `loadBootResource`.
We do the same with what browsers already have:

- Only the `.gz` twin of each runtime file is published; the worker's resource loader fetches it and inflates it with
  `DecompressionStream('gzip')`. Transfer is gzip-sized on any static host (GitHub Pages, Cloudflare Pages,
  `astro preview`), and the bundle takes ~8 MB of the 200 MB site budget instead of ~28 MB (raw + gz + br).
- No `.br`: Brotli would save ~20 % but needs a JS decoder (one more dependency to vet and pin).
- `.js` modules are published uncompressed: they are imported by URL, and hosts compress JavaScript on the fly.
- `.nojekyll` sits at the site root (`public/.nojekyll`). Deploying with `actions/deploy-pages` bypasses Jekyll anyway,
  but without it a branch-based deploy would drop `_framework/` (folders starting with `_`).
- Base path: the worker resolves everything relative to its own URL (`<base>runner/runner-worker.js`), and the page
  builds that URL from `import.meta.env.BASE_URL`.

### Caching

GitHub Pages sends `Cache-Control: max-age=600`, so after ten minutes the browser revalidates every file. The worker
keeps each downloaded `.gz` in Cache Storage (`ly-csharp-runner-v1`) under its fingerprinted URL; a second visit
downloads only the manifest and the small JS modules (or gets 304s for them). After a successful boot it deletes cache
entries whose names are no longer in `runner-manifest.json` (an older runner build).

## 3. Worker protocol

```text
page → worker   { type: 'init', warm? }                       boot; warm = also compile a small program
                { type: 'run', id, code, harness, stdin, maxOutput, mode: 'run'|'debug', maxSteps }
worker → page   { type: 'progress', loaded, total }           compressed bytes so far / expected (manifest)
                { type: 'ready', info }                       runtime and compiler ready (timings in info)
                { type: 'phase', id, phase: 'running'|'compiled', ms }
                { type: 'output', id, text }                  console output chunk
                { type: 'trace', id, json, stopped }          debug mode: the execution trace (section 6), posted
                                                              before the result; stopped = a limit ended recording
                { type: 'result', id, result }                RunnerExports.Run's / Debug's JSON (below)
                { type: 'fatal', id?, message }
```

`result`: `{ id, shape, problem, compiled, compileMs, diagnostics: [{ id, severity, message, file, line, column,
endLine, endColumn }], run: { outcome: 'completed'|'exception'|'output-limit', exitCode, truncated, ms, error: { type,
message, file, line, stack: [{ method, file, line }] } }, internalError? }`. Lines and files are the learner's (after
`#line` mapping): `snippet.cs` is the code in the editor, `harness.cs` the added harness. In debug mode `run.outcome` can also be
`trace-limit` (the recorder's step, depth or size cap stopped the program) and the result carries `debug: { level,
instrumentMs, steps, stop }`, or `debug: { level: -1, error }` when the program can't be traced.

**Timeouts are enforced by the page** (`src/scripts/runner/host.ts`): a program stuck in `while (true) { }` never
yields, so nothing inside the worker could stop it. When the worker reports `running`, the page starts a 5 s timer; on
expiry it terminates the worker (instant), reports the timeout, and boots a new worker in the background (from Cache
Storage). Compilation time doesn't count against the limit.

`WarmUp` exists because Roslyn's first compile in the WebAssembly interpreter takes several seconds. Pressing **Edit**
starts the runtime and compiles a small program while the learner reads or types, so the first **Run** is quick.

## 4. Which blocks are runnable (`Runner.Check`, `scripts/runner/check.ts`)

`check.ts` extracts every C# block from the generated lessons with the same Markdown parser the site uses (so "block
3" here is the third C# code frame on the page), applies `src/data/runnable/<lesson id>.yaml`, and passes the
programs to `Runner.Check`. For each program, the first rule that applies decides:

1. `runnable: false` in the YAML → `forced-off`.
2. Compiled against the **full** reference set (all of `Microsoft.NETCore.App.Ref` + `Microsoft.AspNetCore.App.Ref`
   from the SDK), the **semantic model** shows a symbol the browser can't support (`Classifier`): namespaces of
   ASP.NET Core / hosting, WPF/WinForms, databases, network, threading (`System.Threading*`, `lock`, `await`,
   timers), file system (`System.IO` except in-memory readers/writers/streams), the host (`Process`, `Environment.*`
   except `NewLine` and friends), or any API .NET marks `[UnsupportedOSPlatform("browser")]` (console colours,
   `ReadKey`, …). Unresolvable `using` directives name the package a block needs (EF Core → `database`, etc.).
   `runnable: true` skips this step (the block must still compile).
3. It doesn't compile → `compile-error` (first message kept for the report).
4. Declarations only, no harness → `no-entry-point`.
5. It doesn't compile against the browser's short reference list → `not-in-runner` (names the assemblies).
6. Otherwise it is run **twice**, each time in a fresh child process (`Runner.Check exec-batch`), one program after
   another in its own `AssemblyLoadContext`, with a 5 s hard timeout enforced by the parent (kill + restart the child
   with the next program). Timeouts and crashes are excluded. A block is marked "output varies" and shows no expected
   output when the two runs differ (string hash codes are randomized per process, for example), when the semantic
   model shows it reads the clock or unseeded randomness (`DateTime.Now/Today`, `new Random()`, `Guid.NewGuid`,
   `Stopwatch`, …: two runs a second apart can agree, yet an age computed from `DateTime.Today` changes next year), or
   when the output contains the build machine's name, user name or paths (so those can never be published).

Results are cached per program (code + harness + stdin + override + a hash of the tool's sources and the SDK
version) in `src/data/generated/runnable-cache.json`; CI starts without the cache.

Outputs: `src/data/generated/runnable.json` (what pages read: per lesson, the runnable blocks with hash, harness,
stdin and expected output), `runnable-report.json` and `runnable-report.md` (every block and why).

The page attaches a program to a block only if the block's rendered text still hashes (FNV-1a, `hash.ts`) to the value
the build checked, so a stale JSON can never put the wrong program behind a block.

## 5. Page UI (`src/scripts/runner/`)

- `attach.ts` (loaded only on lessons with runnable blocks): Edit / Run / Reset in the code frame's header, then a
  panel: stdin box, progress bar on first load ("Loading the C# compiler, one-time download of about N MB"), status
  line (`role=status`), compile errors, output, "Expected output", "Show harness" (marked as added code, with where
  its input comes from in the note).
- `editor.ts` (loaded on the first Edit): CodeMirror 6 with C# highlighting from `@codemirror/legacy-modes`
  (`clike` → `csharp`; there is no Lezer C# grammar) and `classHighlighter` colours themed in `runner.css`. Compile
  errors are underlined, the line tinted, and the message shown as a block under the line (visible without hovering).
  Tab is not captured (keyboard users can leave the editor); Ctrl/Cmd+Enter runs.
- `host.ts`: one worker per page, one run at a time, timeout handling.
- `actions.ts`: `registerRunnerAction()` adds buttons (with a `RunnerBlockContext`: code, harness, stdin, editor,
  status, run) — the hook for **Debug**.

## 6. Debugger

A tracing debugger (Python Tutor style): the program is rewritten to report what it does, runs once, and the page replays
the recording. Nothing attaches to a running process, which is what makes it possible in a single-threaded WebAssembly
runtime, and what makes Step Back free.

### Instrumenter (`Runner.Core/Debugger/Instrumenter.cs`)

A `CSharpSyntaxRewriter` applied as `SnippetCompiler`'s `CompilationTransform`, after parsing and before emitting, to
`snippet.cs` and `harness.cs` only (never `usings.cs`, never `#line hidden` code). For every function (method,
constructor, accessor, operator, local function, block lambda) the body becomes

    { int f = Recorder.Enter(site, new object[] { args… }); try { BODY } catch (Exception e) when (Recorder.Thrown(e, f, 1)) { throw; } finally { Recorder.Exit(f); } }

and before every statement goes `Recorder.Step(site, f, new object[] { locals… })` with the parameters and locals that
are in scope there *and definitely assigned on entry* (Roslyn data-flow analysis), so the inserted reads always compile.
Loop conditions become `Recorder.Cond(…) && (cond)` (a step per iteration, with the loop variable), `return expr`
becomes `return Recorder.Ret<T>(…, expr)` (the value shows on the Return step), and a `catch … when (Thrown(e, f, 0))`
clause that never catches is put in front of the learner's own catch clauses, so an exception is shown where it was
thrown even when the program handles it. Sites (`TraceSite`) are numbered as they are created and carry the mapped
file and line (`GetMappedLineSpan`, so `#line` directives already give the learner's coordinates) plus, for functions,
their name, their parameters and the "index hints" (`arr[j + 1]` → `j` indexes `arr`) the array view uses.

Rules the rewriter keeps:
- **The learner's lines never move.** Inserted code has no line breaks and takes over the leading trivia of the statement
  it precedes; expression bodies become blocks laid out on the same lines. The transform throws if a file's line count
  changes, so a wrong highlight can't ship.
- **Behaviour is unchanged.** The recorder never writes to the console and never runs the learner's code to read a
  value: objects are read by their fields (auto-properties through backing fields), library collections by enumeration,
  and only the standard library's `ToString` is called. `Runner.Tests/DebuggerTests.cs` runs a set of programs plain and
  instrumented and compares output, outcome, exception type and line; the build-time check does the same for every
  runnable block (below).
- **Levels.** `DebugCompiler.Compile` tries full instrumentation (level 2), then without conditions, return values and
  caught exceptions (level 1), then without variables (level 0), and keeps the first that compiles. Level 2 can fail on
  code like `while ((x = Next()) != 0) …; Use(x);` — the `Cond() && (…)` wrapper makes `x` "not definitely assigned"
  after the loop. The learner's compile errors are always those of the un-instrumented program.
- Iterators get no catch clause (`yield` can't sit in a try with a catch), finalizers and expression lambdas are left
  alone (a lambda body could change overload resolution or an expression tree), generic ref-struct and pointer values
  aren't recorded.

### Recorder (`Runner.Core/Debugger/Recorder.cs.txt`)

Not part of Runner.Core: it is an embedded resource (`LyDebug.Recorder.cs`) that the instrumenter adds to the program
as one more syntax tree, so it is compiled against the same reference assemblies as the learner's code and needs nothing
at run time. (The `.cs.txt` name keeps it out of Runner.Core's own compilation; `WithCulture="false"` on the item is
required, or MSBuild reads `.cs` as the Czech culture and ships the file in a satellite assembly.) Every name in it is
fully qualified, so a learner's `class List` can't rebind it.

It appends one event (five ints: kind, frame, site, output length so far, payload) per `Enter` / `Step` / `Ret` /
`Thrown` / `Exit` and interns the value snapshots (JSON, one object per value) and the per-step variable sets, so a
10,000-step trace of a sorting loop is a few hundred KB. Snapshots cover null, primitives, enums, strings (cut at 200
chars), arrays (1-D and 2-D, first 64 items), library collections, tuples, the learner's own classes and structs (fields,
three levels deep, cycles as references with an object id) and exceptions; delegates and LINQ queries are shown opaque
("not run yet") rather than enumerated. Limits are fields the host sets through reflection before `Main` runs:
`MaxEvents` (10,000), `MaxDepth` (1,000) and `MaxValueChars` (4 MB). Hitting one calls `OnStop` (the host posts the
trace right away) and throws `StopException` into the program; a program that catches everything throws again on its
next step, so it still ends, and the page's 5 s timeout is the backstop.

### Running (`TraceSession`, `IRunObserver`)

`SnippetExecutor.RunAsync` takes an `IRunObserver`: `TraceSession.BeforeRun` finds the recorder type in the learner's
assembly and sets its limits and hooks, `AfterRun` copies the lists out before the assembly is unloaded, and
`Outcome(exception)` turns the recorder's `StopException` into the run outcome `trace-limit` (no error shown).
`TraceBuilder` turns the raw events into steps — `Line`, `Call` (with the arguments), `Return` (with the value), `Exception`
(with the exception, on the frame's current line), `End` — each with its frame (method, parent frame, depth, call site)
and its variables; the entry frame (`Main`, top-level statements, the harness) shows no Call step. `ExecutionTrace.ToJson`
writes the compact form the page reads (`src/scripts/runner/debug/trace.ts`): interned `names`, `values` and `vars`,
`methods`, `frames` as `[method, parent, depth, callFile, callLine]` and `steps` as `[kind, frame, file, line,
outputLength, vars, value]`.

### Page (`src/scripts/runner/debug/`)

`action.ts` registers the **Debug** button (`registerRunnerAction`, only on blocks the build marked debuggable);
`session.tsx` runs the block in debug mode through the same host and worker as Run (`mode: 'debug'`, the trace arrives
as a `trace` message before the result), then mounts `Panel.tsx` under the block. The panel drives the step index with
`src/viz/engine/usePlayer` — the visualizers' player — so Step Back, the timeline, autoplay and ←/→/Space behave as in
every visualizer; Continue / Step over / Step into / Step out are jumps computed from the frames' depths
(`trace.ts`), and breakpoints are a set of lines the Continue search stops at. The current line and the breakpoint
gutter live in the rendered code block (`code-view.ts`, a button per line) until the learner opens the editor, then in
CodeMirror (`editor-view.ts`, a gutter plus F9); breakpoints carry over, and editing the code marks the trace stale.
The array view (`values.ts`) draws one-dimensional arrays and lists of scalars as cells with the frame's `int` variables
as pointers: the instrumenter's index hints first, then index-like names (`i`, `j`, `lo`, `hi`, `mid`, …).

### Build-time check

`Runner.Check` compiles every runnable program through `DebugCompiler` too and runs the instrumented assembly in a third
batch (with the recorder's default limits). The verdict's `Debug` is true only when that run printed exactly what the
plain run printed, ended the same way, and threw the same exception on the same line (a run the step cap stopped counts
when its output is a prefix of the plain output). `runnable.json` carries `noDebug: <reason>` for the others, so they get
Run but no Debug; `runnable-report.md` has a Debug column. `DebuggerTests` covers the rest: line numbers after moved
types and `#line`, loop conditions, foreach variables, definite assignment, out parameters, `this`, wrapper-class fields,
recursion depth and return values, expression-bodied members, lambdas, uncaught / callee / caught exceptions, the step
and depth caps (also when the program catches everything), value snapshots (collections, objects, cycles, truncation,
no learner code run), the level-1 fallback, the trace JSON, and output equality for two dozen programs.

## 7. Versions (all exact, each at least 7 days old when chosen on 2026-10-22)

| What | Version | Published |
|---|---|---|
| .NET SDK (portable, `.tools/dotnet`, installed with the official `dotnet-install.ps1`) | 10.0.402 (runtime 10.0.13) | 2026-10-13 |
| Microsoft.CodeAnalysis.CSharp | 5.9.0 | 2026-08-17 |
| xunit.v3 | 4.0.2 | 2026-10-09 |
| @codemirror/state, view, commands, language, legacy-modes; @lezer/highlight | 6.7.6, 6.43.14, 6.11.1, 6.13.1, 6.5.5; 1.2.5 | ≤ 2026-10-07 |

npm packages were installed with `npm install --save-exact --before=2026-10-15`, so their dependencies resolved to
releases at least a week old as well. `runner/global.json` asks for SDK 10+ and opts `dotnet test` into
Microsoft.Testing.Platform (xunit.v3's runner). `runner/nuget.config` allows nuget.org only.
