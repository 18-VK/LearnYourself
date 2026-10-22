// LearnYourself C# runner: Web Worker that hosts the .NET WebAssembly runtime and Roslyn.
//
// The page talks to this worker with postMessage (protocol in runner/NOTES.md, "Worker protocol"):
//   page → worker  { type: 'init', warm? }                   boot the runtime (downloads on first use); warm: also
//                                                           compile a small program so the first Run is quick
//                  { type: 'run', id, code, harness, stdin, maxOutput }
//   worker → page  { type: 'progress', loaded, total }      bytes downloaded so far (compressed)
//                  { type: 'ready', info }                  runtime + compiler ready
//                  { type: 'phase', id, phase, ms }         'running' when execution starts (the page's timeout
//                                                           starts here, not during compilation), 'compiled' on errors
//                  { type: 'output', id, text }             console output, in chunks, as it is written
//                  { type: 'result', id, result }           JSON result from RunnerExports.Run
//                  { type: 'fatal', id?, message }          the runtime could not start or crashed
//
// A runaway program is stopped by the page terminating this worker; nothing here needs to cooperate.
//
// Downloads: every runtime file is fetched as its precompressed `.gz` twin and inflated with the browser's own
// DecompressionStream, because static hosts such as GitHub Pages do not serve `.br`/`.gz` with Content-Encoding.
// The compressed bytes are kept in Cache Storage under the file's fingerprinted URL, so a second visit needs no
// download at all (GitHub Pages' 10-minute max-age would otherwise make the browser revalidate every file).

const CACHE_NAME = 'ly-csharp-runner-v1';
const here = new URL('./', import.meta.url);
let manifest = { files: {}, total: 0 };
let loaded = 0;
let cache = null;
let api = null;
let booting = null;

const post = (msg) => self.postMessage(msg);

const contentType = (name) =>
  name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.json') ? 'application/json' : name.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';

async function openCache() {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null; // Cache Storage needs a secure context; without it the browser's HTTP cache still applies
  }
}

const progress = (extra) => post({ type: 'progress', loaded: manifest.total ? Math.min(loaded, manifest.total) : loaded, total: manifest.total, ...extra });

/** Reads a response body to the end, reporting progress as bytes arrive. */
async function readAll(res, expected) {
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.byteLength;
    loaded += value.byteLength;
    progress();
  }
  // served uncompressed or partly from the HTTP cache: count what the manifest expected so the bar ends at 100 %
  if (expected && got < expected) loaded += expected - got;
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

const isGzip = (bytes) => bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

function inflate(bytes, name) {
  const body = isGzip(bytes) ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')) : bytes;
  return new Response(body, { headers: { 'content-type': contentType(name) } });
}

/** Fetches one runtime file: Cache Storage first, then the `.gz` twin, then the plain file. */
async function fetchResource(url, name) {
  const key = new URL(url, here).href;
  const entry = manifest.files[name];
  const cached = cache ? await cache.match(key) : undefined;
  if (cached) {
    const bytes = new Uint8Array(await cached.arrayBuffer());
    loaded += entry?.gz ?? bytes.byteLength;
    progress({ cached: true });
    return inflate(bytes, name);
  }
  // the publish step ships only the .gz twin of each file it lists with a gz size (and of every file, if the
  // manifest could not be read); files without one are published plain
  let res = !entry || entry.gz > 0 ? await fetch(key + '.gz') : null;
  if (!res || !res.ok) res = await fetch(key);
  if (!res.ok) throw new Error(`Could not download ${name} (HTTP ${res.status})`);
  const bytes = await readAll(res, entry?.gz);
  if (cache) {
    try {
      await cache.put(key, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }));
    } catch {
      /* storage quota: carry on without caching */
    }
  }
  return inflate(bytes, name);
}

/** Drops cached files from older runner builds (their fingerprinted names are no longer in the manifest). */
async function pruneCache() {
  if (!cache || !Object.keys(manifest.files).length) return;
  const keep = new Set(Object.keys(manifest.files).map((n) => new URL(`_framework/${n}`, here).href));
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
}

async function boot() {
  const started = performance.now();
  cache = await openCache();
  try {
    const res = await fetch(new URL('runner-manifest.json', here), { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch {
    /* without the manifest, progress shows bytes so far */
  }
  const { dotnet } = await import('./_framework/dotnet.js');
  const runtime = await dotnet
    .withConfig({ applicationCulture: 'en-US' })
    .withResourceLoader((type, name, defaultUri) => {
      // JavaScript modules are imported by URL; everything else goes through fetchResource
      if (type === 'dotnetjs' || name.endsWith('.js')) return defaultUri;
      return fetchResource(defaultUri, name);
    })
    .create();
  runtime.setModuleImports('runner-host', {
    output: (id, text) => post({ type: 'output', id, text }),
    phase: (id, phase, ms) => post({ type: 'phase', id, phase, ms }),
  });
  const downloadMs = performance.now() - started;
  const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
  api = exports.LearnYourself.Runner.Wasm.RunnerExports;
  const info = JSON.parse(api.Init());
  void pruneCache();
  return { ...info, bootMs: performance.now() - started, downloadMs, downloaded: loaded, cacheStorage: Boolean(cache) };
}

self.addEventListener('message', async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      // warm: also compile a small program now, so Roslyn's first-use cost is paid before the learner presses Run
      booting ??= boot().then((info) => (msg.warm ? { ...info, warmMs: api.WarmUp() } : info));
      post({ type: 'ready', info: await booting });
      return;
    }
    if (msg.type === 'run') {
      booting ??= boot();
      await booting;
      const json = await api.Run(msg.id, msg.code, msg.harness ?? null, msg.stdin ?? '', msg.maxOutput ?? 65536);
      post({ type: 'result', id: msg.id, result: JSON.parse(json) });
    }
  } catch (err) {
    post({ type: 'fatal', id: msg.id, message: String(err?.message ?? err) });
  }
});
