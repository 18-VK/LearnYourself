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

MEASUREMENTS_PLACEHOLDER

## Decision

GO. Cold start is far below the 60 s stop line, transfer far below 60 MB, a runaway loop is stopped cleanly while the
page keeps painting and responding, and a second visit downloads almost nothing. The one slow part is Roslyn's first
compile in the WebAssembly interpreter (several seconds); the UI hides most of it by warming the compiler up when the
learner presses **Edit**, and by booting a new worker in the background after a timeout.

$0 alternatives, had it failed (kept for the record): a smaller compiler front-end is not available for C#; the
realistic fallbacks were (1) show only build-time "Expected output" with no live runs, or (2) AOT-compile Roslyn with
the `wasm-tools` workload for faster compiles at several times the download. Neither was needed.

## Not covered by the spike

- Debug mode (tracing) is the next checkpoint; `runner/NOTES.md` § 6 describes the hooks left for it.
- Measurements on a real GitHub Pages deployment wait for the go-live checkpoint (no deploys yet).
