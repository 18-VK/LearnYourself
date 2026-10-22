# Checkpoint 3: C# runner spike

Status: **go.** The approach works well inside the limits, so the Run half of §11 was built on it (see "What was
built after the spike" below). The tracing debugger is the next step; nothing here was deployed or pushed.

## The approach

- **.NET 10 WebAssembly + Roslyn in a Web Worker.** A plain `Microsoft.NET.Sdk.WebAssembly` app (no Blazor UI) exposes
  `Init`, `WarmUp` and `Run` with `[JSExport]`. The page posts a message to the worker; the worker compiles the code
  with Roslyn (Microsoft.CodeAnalysis.CSharp 5.9.0) to an in-memory assembly + portable PDB, loads it into its own
  `AssemblyLoadContext`, runs `Main` with `Console.Out/In` redirected, and posts output back as it is written.
- **Reference assemblies:** 11 from the SDK's own targeting pack (`Microsoft.NETCore.App.Ref` 10.0.13), embedded in the
  runner, and kept untrimmed at run time so anything that compiles also runs. Basic.Reference.Assemblies would have
  added ~170 assemblies to the download for no benefit. (Details in `runner/NOTES.md`.)
- **Runaway code** is stopped by the page: when the worker reports that execution started, the page waits 5 s and
  terminates the worker, then boots a fresh one in the background.
- **Hosting:** the bundle is published under `<base>runner/`, with a `.nojekyll` at the site root. Only gzip twins of
  the runtime files are published; the worker fetches them and inflates them with the browser's `DecompressionStream`,
  then keeps them in Cache Storage.

### What GitHub Pages does with precompressed files (verified)

Checked against Microsoft's own Blazor sample on GitHub Pages (`dotnet.github.io/blazor-samples`, the deployment its
hosting guide uses), with `Accept-Encoding: gzip, deflate, br`:

| Request | Content-Type | Content-Encoding | Size |
|---|---|---|---|
| `System.Private.CoreLib.*.wasm` | application/wasm | **gzip** (compressed on the fly) | 689 KB |
| `System.Private.CoreLib.*.wasm.gz` | application/gzip | none | 701 KB |
| `System.Private.CoreLib.*.wasm.br` | application/octet-stream | gzip (gzip over Brotli) | 566 KB |

So GitHub Pages never serves `.br`/`.gz` as an encoding; Microsoft's guide works around it with a JavaScript Brotli
decoder in `loadBootResource`. Our loader does the equivalent for gzip with no dependency: fetch `X.gz`, inflate with
`DecompressionStream('gzip')`. Transfer is gzip-sized on any host — GitHub Pages, Cloudflare Pages, or `astro preview`
(which compresses nothing). Brotli would save about 20 % more but needs a decoder library. `Cache-Control` on GitHub
Pages is `max-age=600`, which is why the files are also kept in Cache Storage.

## Measurements

Production build (`npm run build`), served by `astro preview` under `/LearnYourself/`, measured with Playwright
(Chromium) by `runner/spike/measure.mjs` on the real lesson UI: the note's `InsertionSort` block from
`Competitive Programming/sorting-algorithms-notes.md` plus a harness with the note's own input `[2, 5, 7, 3]`.
The machine was shared with about 15 other build agents (8 GB RAM), so times are pessimistic; localhost has no network
latency, so add download time for a real connection (≈3 s at 20 Mbit/s).

| What | Result |
|---|---|
| **Download, first visit** | **6.95 MB** over the wire (53 requests): runtime, Roslyn, BCL, ICU as gzip; `dotnet*.js` and the worker as plain JS (compressed by the host). Nothing loads until the learner presses Run (or Edit). |
| Bundle in the site | 54 files, 7.2 MB (`dist/runner/`), counted in the 200 MB / 20,000-file budget (whole site: 732 files, 36.7 MB). Largest file: Microsoft.CodeAnalysis.CSharp, 2.0 MB gzip. |
| **Cold start** (empty cache: download + runtime start + first compile + run) | **2.7 s** wall clock from pressing Run to output; first compile 1.4 s, run 19 ms. Under heavy load (an earlier spike run while ~15 agents were building) the same was 12.6 s: download 3.7 s, runtime start 5.1 s, first compile 7.2 s. |
| **Warm compile + run** (same page, unchanged and edited code) | **93–306 ms** wall clock; compile 43–98 ms, run 1–5 ms. (Loaded machine: 250–400 ms.) |
| **`while (true) { }`** | Stopped **5.2 s** after pressing Run (5 s limit from the moment execution starts) by terminating the worker; "Stopped after 5 seconds…" shown. During the loop the page painted 121 frames in 2 s (60 fps) and the theme button answered clicks in 47–95 ms. |
| Next run after a timeout | 221 ms: a fresh worker had already booted in the background from Cache Storage. |
| **Second visit** (same browser, new page) | **0.8 KB** transferred: the manifest and the JS modules revalidated, every runtime file came from Cache Storage. Run took 1.8 s (runtime start + first compile, no download). |
| Console errors | none |
| Output | `[2, 3, 5, 7]`, the same as the note's own example and as the build-time check recorded |

`astro preview` turned out to serve `.gz` files with `Content-Encoding: gzip`, so the browser inflated them itself;
the worker checks the gzip magic bytes and only inflates what is still compressed, so the same bundle works on hosts
that do (preview) and don't (GitHub Pages) send that header.

## Decision

GO. Cold start is far below the 60 s stop line, transfer far below 60 MB, a runaway loop is stopped cleanly while the
page keeps painting and responding, and a second visit downloads almost nothing. The one slow part is Roslyn's first
compile in the WebAssembly interpreter (several seconds); the UI hides most of it by warming the compiler up when the
learner presses **Edit**, and by booting a new worker in the background after a timeout.

$0 alternatives, had it failed (kept for the record): a smaller compiler front-end is not available for C#; the
realistic fallbacks were (1) show only build-time "Expected output" with no live runs, or (2) AOT-compile Roslyn with
the `wasm-tools` workload for faster compiles at several times the download. Neither was needed.

## What was built after the spike (the Run half of §11)

- **Runnable-block check** at build time (`runner/Runner.Check` + `scripts/runner/check.ts`, part of `npm run build`):
  every C# block of every lesson, decided with Roslyn's semantic model and the real SDK, run twice in a child process
  with a hard timeout. Result for the current notes:

  | | Count |
  |---|---|
  | C# blocks in the lessons | 1,396 (1,381 programs: 10 merges of consecutive blocks) |
  | **Runnable** | **206 programs** covering 221 blocks (DSA 20, Phase 1 185, Phase 2 1); 20 with a harness; 205 show an expected output, 1 says "output varies" (it uses `DateTime.Today`) |
  | Not runnable: does not compile as a console program (fragments, undefined names, pseudo-code) | 754 |
  | threads, tasks, async, locks, timers | 189 |
  | declarations only, no harness (the note gives no sample input) | 133 |
  | file system | 27 |
  | a NuGet package (Newtonsoft.Json, FluentValidation, AutoMapper, …) | 20 |
  | ASP.NET Core / hosting | 19 |
  | WPF / WinForms | 11 |
  | database / EF Core / Dapper | 7 |
  | an assembly the browser runner doesn't include (System.Xml, `dynamic`) | 7 |
  | host process / environment | 5 |
  | network | 3 |

  `runnable-report.md` lists every block with its reason. Two note errors the check found are logged in
  `CONTENT_ISSUES.md` (R1, R2).
- **Harnesses** (`src/data/runnable/`) for the sorting and searching implementations, using the notes' own inputs
  (`[2, 5, 7, 3]` from the insertion sort example, `[1,2,3,4,5,6,7]` from the quick sort worst case,
  `arr = [1, 2, 2, 2, 3], target = 2` from the lower/upper bound example, the Employee "Input:" block), and merges of
  consecutive Phase 1 blocks that only work together (class + usage).
- **Run UI** on lesson pages: Edit (CodeMirror 6, C# highlighting, both themes), Run, Reset, stdin box, output panel,
  compile errors inline on their line with the compiler's message, runtime exceptions with type, message and line,
  5 s timeout and 64 KB output cap with clear messages, "Expected output", "Show harness" (marked as added code), a
  hook for the Debug button. Loads nothing until used; the progress bar names the download size.
- **CI**: `actions/setup-dotnet@v6.0.0` (10.0.x), .NET unit tests, bundle, runnable check with `LY_REQUIRE_RUNNER=1`.

### Tests

| Suite | Result |
|---|---|
| .NET unit tests (`npm run test:runner`: shapes, `#line` mapping, limits, detection) | 50 passed |
| Vitest (`npm test`, including block extraction and the YAML schema) | 1,486 passed |
| Playwright, runner (`tests/e2e/runner.spec.ts`): 8 sampled blocks (3 DSA harnesses, one block per course that has runnable blocks, then other lessons) match their recorded output in the browser; `while (true) { }` stopped with the page responsive; edit, stdin, compile error, exception, output cap, reset; harness toggle; 360 px | 5 passed |
| Playwright, all (`--workers=2`) | 234 passed |
| `npx tsc --noEmit -p .` | clean |
| `npm run build` (content + runner + Astro + Pagefind + verification) | passed: 732 files, 36.7 MB |

## How to run

```bash
cd learning-site
source scripts/local-env.sh            # puts .tools/dotnet (SDK 10.0.402) and .tools/node first on PATH
npm run build                          # also publishes the runner and runs the runnable check
LY_PORT=4336 npx playwright test tests/e2e/runner.spec.ts --workers=2
node runner/spike/measure.mjs http://localhost:4336/LearnYourself/   # with astro preview running on 4336
```

## Not covered by the spike

- Debug mode (tracing) is the next checkpoint; `runner/NOTES.md` § 6 describes the hooks left for it.
- Measurements on a real GitHub Pages deployment wait for the go-live checkpoint (no deploys yet).
