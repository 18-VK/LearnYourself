# C# runner: design notes

The runner lets a learner edit and run a C# block from a lesson **in their own browser**. Nothing is sent to a
server: the .NET WebAssembly runtime and the Roslyn compiler run inside a Web Worker on the page. This note explains
how the pieces fit and *why* each decision was made, so the tracing debugger (next checkpoint) can be built on top.

| Piece | Where | Runs |
|---|---|---|
| Program shapes, compiler, executor | `Runner.Core/` | in the browser **and** at build time |
| Browser bundle (`[JSExport]` API + worker script) | `Runner.Wasm/` → `public/runner/` | browser (Web Worker) |
| Runnable-block check | `Runner.Check/` + `scripts/runner/check.ts` | build time (CI) |
| Page UI (buttons, panel, editor) | `src/scripts/runner/*`, `src/styles/runner.css` | browser (page) |
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
                { type: 'run', id, code, harness, stdin, maxOutput }
worker → page   { type: 'progress', loaded, total }           compressed bytes so far / expected (manifest)
                { type: 'ready', info }                       runtime and compiler ready (timings in info)
                { type: 'phase', id, phase: 'running'|'compiled', ms }
                { type: 'output', id, text }                  console output chunk
                { type: 'result', id, result }                RunnerExports.Run's JSON (below)
                { type: 'fatal', id?, message }
```

`result`: `{ id, shape, problem, compiled, compileMs, diagnostics: [{ id, severity, message, file, line, column,
endLine, endColumn }], run: { outcome: 'completed'|'exception'|'output-limit', exitCode, truncated, ms, error: { type,
message, file, line, stack: [{ method, file, line }] } }, internalError? }`. Lines and files are the learner's (after
`#line` mapping): `snippet.cs` is the code in the editor, `harness.cs` the added harness.

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

## 6. Adding the debugger (next checkpoint)

What is already in place for it:

- **Protocol**: add `mode: 'debug'` (and options such as a step cap) to the `run` message; the worker passes it to a
  new `[JSExport] Debug(...)` or to `Run` with a mode argument. The result can carry a `trace` array. Keep `run` as is.
- **Compile pipeline**: `SnippetCompiler.Compile(program, transform)`. The instrumenter is a `CompilationTransform`:
  for each tree whose `DocumentPath` is `snippet.cs` or `harness.cs`, rewrite statements with a `CSharpSyntaxRewriter`
  using `compilation.GetSemanticModel(tree)` for in-scope locals, then `compilation.ReplaceSyntaxTree`. Mapped line
  numbers come from `tree.GetMappedLineSpan(node.Span)` (the `#line` directives already map to the learner's lines).
  The trace recorder can live in a source file added by the transform (no new reference assembly needed).
- **Same output**: the plain run's output is recorded at build time; a unit test can assert that the instrumented
  program prints the same.
- **UI**: `registerRunnerAction({ id: 'debug', label: 'Debug', order: 20, onClick })` from a module imported in
  `attach.ts`'s `loadExtensions()`; `ctx.openEditor()` gives the CodeMirror view for the current-line highlight and
  gutter breakpoints; the visualizer player (`src/viz/engine`) replays the trace.
- **Step cap**: the instrumented code can count steps itself and stop at ~10,000; the 5 s page timeout stays as the
  backstop.

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
