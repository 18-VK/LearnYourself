/**
 * Publishes the in-browser C# runner (runner/Runner.Wasm) into public/runner/, where Astro copies it to
 * dist/runner/ (served at <base>runner/).
 *
 * What is copied, and why:
 * - `_framework/*.gz` only, for the fingerprinted runtime, Roslyn, BCL and ICU files: the worker downloads the
 *   `.gz` and inflates it with DecompressionStream, so the transfer is gzip-sized on any static host (GitHub Pages
 *   serves `.gz` files as plain downloads, without Content-Encoding). Publishing only the `.gz` keeps the bundle at
 *   about a third of its uncompressed size in the site budget. `.br` twins are not copied: no browser API inflates
 *   Brotli, and a JavaScript Brotli decoder would be one more dependency for ~20 % less transfer.
 * - `_framework/*.js` uncompressed: they are imported as modules by URL, and hosts compress JavaScript on the fly.
 * - only the ICU shard the runner uses (EFIGS: en-US is fixed so expected outputs match), not the CJK shards.
 * - runner-worker.js and runner-manifest.json (file sizes, for the progress bar and for pruning old cache entries).
 *
 * Skips the (slow, ~1–3 min) `dotnet publish` when the sources, SDK version and options are unchanged.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ROOT } from '../lib/paths';
import { findDotnet, RUNNER_DIR, runDotnet } from './dotnet';

export const RUNNER_PUBLIC = path.join(SITE_ROOT, 'public', 'runner');
const SELF = fileURLToPath(import.meta.url);
const STAMP = path.join(RUNNER_PUBLIC, '.stamp');
const PUBLISH_DIR = path.join(RUNNER_DIR, 'Runner.Wasm', 'bin', 'publish');
/** ICU shards the runtime may request for en-US (see runner/NOTES.md, "Globalization"). */
const KEEP_ICU = /^icudt_EFIGS\./;

export interface RunnerManifest {
  version: string;
  files: Record<string, { raw: number; gz: number }>;
  /** Compressed bytes a first visit downloads through the worker's loader (everything except the JS modules). */
  total: number;
  /** Everything a first visit downloads, JS modules included (as gzip, the way a host compresses them). */
  totalWithScripts: number;
  fileCount: number;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'bin' || e.name === 'obj' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(full, out);
    else out.push(full);
  }
  return out;
}

export function runnerStamp(sdk: string): string {
  const hash = createHash('sha256').update(`sdk ${sdk}\n`);
  const files = [
    ...sourceFiles(path.join(RUNNER_DIR, 'Runner.Core')),
    ...sourceFiles(path.join(RUNNER_DIR, 'Runner.Wasm')),
    ...['Directory.Build.props', 'Directory.Packages.props', 'References.props', 'global.json', 'nuget.config'].map((f) => path.join(RUNNER_DIR, f)),
    SELF,
  ].sort();
  for (const f of files) hash.update(path.relative(RUNNER_DIR, f)).update(fs.readFileSync(f));
  return hash.digest('hex').slice(0, 16);
}

function copyBundle(from: string, to: string): RunnerManifest {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.join(to, '_framework'), { recursive: true });
  const files: RunnerManifest['files'] = {};
  let total = 0;
  let totalWithScripts = 0;
  let fileCount = 0;
  const fw = path.join(from, '_framework');
  for (const name of fs.readdirSync(fw).sort()) {
    if (/\.(br|gz)$/.test(name)) continue;
    if (name.startsWith('icudt') && !KEEP_ICU.test(name)) continue;
    const raw = fs.statSync(path.join(fw, name)).size;
    const gzFile = path.join(fw, `${name}.gz`);
    const gz = fs.existsSync(gzFile) ? fs.statSync(gzFile).size : raw;
    totalWithScripts += gz;
    if (name.endsWith('.js') || !fs.existsSync(gzFile)) {
      // JavaScript modules are imported by URL (the host compresses them on the fly, as GitHub Pages does)
      fs.copyFileSync(path.join(fw, name), path.join(to, '_framework', name));
      fileCount++;
      if (!name.endsWith('.js')) {
        files[name] = { raw, gz: 0 };
        total += raw;
      }
      continue;
    }
    // everything else is fetched by the worker as its .gz twin, so only the .gz is published
    fs.copyFileSync(gzFile, path.join(to, '_framework', `${name}.gz`));
    fileCount++;
    files[name] = { raw, gz };
    total += gz;
  }
  for (const name of ['runner-worker.js']) {
    fs.copyFileSync(path.join(from, name), path.join(to, name));
    fileCount++;
  }
  // Checkpoint 3 measurement page (LY_RUNNER_SPIKE=1 only; never part of a normal build)
  if (process.env.LY_RUNNER_SPIKE === '1') {
    fs.mkdirSync(path.join(to, 'spike'), { recursive: true });
    fs.copyFileSync(path.join(RUNNER_DIR, 'spike', 'index.html'), path.join(to, 'spike', 'index.html'));
  }
  const manifest: RunnerManifest = { version: '', files, total, totalWithScripts, fileCount: fileCount + 1 };
  return manifest;
}

export interface PublishResult {
  published: boolean;
  skipped?: 'no-sdk' | 'up-to-date';
  manifest?: RunnerManifest;
}

export async function publishRunner(opts: { log?: (m: string) => void; force?: boolean } = {}): Promise<PublishResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const dotnet = findDotnet();
  if (!dotnet) return { published: false, skipped: 'no-sdk' };
  const stamp = runnerStamp(dotnet.version);
  const manifestFile = path.join(RUNNER_PUBLIC, 'runner-manifest.json');
  if (!opts.force && fs.existsSync(STAMP) && fs.readFileSync(STAMP, 'utf8') === stamp && fs.existsSync(manifestFile)) {
    return { published: false, skipped: 'up-to-date', manifest: JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as RunnerManifest };
  }
  log(`runner: publishing the C# runner with .NET SDK ${dotnet.version} (one to three minutes)…`);
  const started = Date.now();
  fs.rmSync(PUBLISH_DIR, { recursive: true, force: true }); // old fingerprinted files would linger otherwise
  await runDotnet(dotnet, ['publish', 'Runner.Wasm/Runner.Wasm.csproj', '-c', 'Release', '-o', PUBLISH_DIR, '-v:minimal', '-nologo'], { quiet: true });
  const manifest = copyBundle(path.join(PUBLISH_DIR, 'wwwroot'), RUNNER_PUBLIC);
  manifest.version = stamp;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
  fs.writeFileSync(STAMP, stamp);
  log(`runner: published ${manifest.fileCount} files, ${(manifest.totalWithScripts / 1048576).toFixed(1)} MB to download (gzip), in ${Math.round((Date.now() - started) / 1000)} s`);
  return { published: true, manifest };
}

// CLI: tsx scripts/runner/publish.ts [--force]
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SELF)) {
  const r = await publishRunner({ force: process.argv.includes('--force') });
  if (r.skipped === 'no-sdk') {
    console.error('runner: no .NET SDK 10+ found (see README, "C# runner").');
    process.exit(1);
  }
  if (r.skipped === 'up-to-date') console.log('runner: up to date.');
}
