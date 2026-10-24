/**
 * Post-build checks on dist/ (run by `npm run build` after Astro and Pagefind):
 * 1. every lesson's rendered headings, code blocks, tables and ❌/✅/👉 markers match its source counts;
 * 2. every internal link, asset and #anchor resolves under the base path;
 * 3. size budgets: ≤ 200 MB total, ≤ 20,000 files, no file over 25 MiB (GitHub Pages / Cloudflare Pages limits);
 * 4. no binary file reaches the output unless it is on the approved list in curriculum/_assets.yaml (or is part of
 *    the C# runner bundle under runner/_framework/, whose size and file count are reported separately).
 * Writes the output counts into coverage-report.md. Exits non-zero on any failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Element, Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { select, selectAll } from 'hast-util-select';
import { toString } from 'hast-util-to-string';
import { countMarkers } from '../src/markdown/html-policy';
import { assetSlug } from './lib/assets';
import { writeCoverage, type CoverageData, type OutputCounts } from './lib/coverage';
import { OUT_DATA, SITE_ROOT } from './lib/paths';

const DIST = path.join(SITE_ROOT, 'dist');
const BASE = (process.env.BASE_PATH ?? '/LearnYourself/').replace(/\/?$/, '/');
const BUDGET_TOTAL = 200 * 1024 * 1024;
const BUDGET_FILES = 20_000;
const BUDGET_FILE = 25 * 1024 * 1024;

const problems: string[] = [];
if (!fs.existsSync(DIST)) {
  console.error('dist/ not found. Run `astro build` first.');
  process.exit(1);
}

// ── collect files ─────────────────────────────────────────────────────────────────────────
const files: { rel: string; size: number }[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else files.push({ rel: path.relative(DIST, full).split(path.sep).join('/'), size: fs.statSync(full).size });
  }
};
walk(DIST);
const fileSet = new Set(files.map((f) => f.rel));

// ── 3. budgets ────────────────────────────────────────────────────────────────────────────
const total = files.reduce((s, f) => s + f.size, 0);
if (total > BUDGET_TOTAL) problems.push(`Output is ${(total / 1048576).toFixed(1)} MB; the budget is 200 MB.`);
if (files.length > BUDGET_FILES) problems.push(`Output has ${files.length} files; the limit is 20,000.`);
for (const f of files) if (f.size > BUDGET_FILE) problems.push(`${f.rel} is ${(f.size / 1048576).toFixed(1)} MiB; no file may exceed 25 MiB.`);

// ── 4. binary allowlist ───────────────────────────────────────────────────────────────────
const assets = JSON.parse(fs.readFileSync(path.join(OUT_DATA, 'assets.json'), 'utf8')) as { file: string; slug: string }[];
const approvedSlugs = new Set(assets.map((a) => a.slug));
const BINARY = /\.(pdf|docx?|pptx?|xlsx?|jpe?g|png|gif|webp|avif|bmp|ico|zip|wasm|dat|blat|gz|br|dll|pdb|exe|so)$/i;
// the C# runner bundle: .NET WebAssembly runtime, assemblies (webcil .wasm) and ICU data, published as .gz only
// (scripts/runner/publish.ts, runner/NOTES.md); approved by path, nowhere else
const RUNNER_BINARY = /^runner\/_framework\/[\w.-]+\.(wasm|dat)\.gz$/;
// the SQL runner's engine (sql.js, SQLite compiled to WebAssembly), bundled by Vite with the site's other assets
const SQL_BINARY = /^_astro\/sql-wasm-browser[.-][\w-]+\.wasm$/;
for (const f of files) {
  if (!BINARY.test(f.rel)) continue;
  if (RUNNER_BINARY.test(f.rel) || SQL_BINARY.test(f.rel)) continue;
  const m = /^generated\/assets\/(.+?)(?:-\d+)?\.(webp|pdf)$/.exec(f.rel);
  if (!m || !approvedSlugs.has(m[1]!)) problems.push(`Binary file not on the approved publishing list: ${f.rel}`);
}
// every approved asset must map back to an _assets.yaml entry with publish: true (assets.json only holds those)
for (const a of assets) if (assetSlug(a.file) !== a.slug && !a.slug.startsWith(assetSlug(a.file))) problems.push(`Asset slug mismatch for ${a.file}`);

// ── parse pages ───────────────────────────────────────────────────────────────────────────
const pages = files.filter((f) => f.rel.endsWith('.html'));
const trees = new Map<string, Root>();
const idsOf = new Map<string, Set<string>>();
for (const p of pages) {
  const tree = fromHtml(fs.readFileSync(path.join(DIST, p.rel), 'utf8'));
  trees.set(p.rel, tree);
  idsOf.set(p.rel, new Set(selectAll('[id]', tree).map((e) => String(e.properties?.id))));
}

// ── 2. internal links, assets, anchors ────────────────────────────────────────────────────
function targetFile(urlPath: string): string | null {
  let p = decodeURIComponent(urlPath);
  if (!p.startsWith(BASE)) return null;
  p = p.slice(BASE.length);
  if (p === '' || p.endsWith('/')) p += 'index.html';
  if (fileSet.has(p)) return p;
  if (fileSet.has(`${p}/index.html`)) return `${p}/index.html`;
  return null;
}
const linkAttrs: [string, string][] = [
  ['a[href]', 'href'],
  ['link[href]', 'href'],
  ['script[src]', 'src'],
  ['img[src]', 'src'],
  ['iframe[src]', 'src'],
  ['source[src]', 'src'],
];
let checkedLinks = 0;
for (const [page, tree] of trees) {
  const check = (raw: string, attr: string) => {
    if (!raw || /^(https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(raw)) return;
    checkedLinks++;
    const [pathPart, hash] = raw.split('#') as [string, string | undefined];
    let target: string | null = page;
    if (pathPart) {
      if (!pathPart.startsWith('/')) {
        problems.push(`${page}: relative ${attr}="${raw}" (internal URLs must be absolute under the base path)`);
        return;
      }
      if (!pathPart.startsWith(BASE)) {
        problems.push(`${page}: ${attr}="${raw}" ignores the base path ${BASE}`);
        return;
      }
      target = targetFile(pathPart.split('?')[0]!);
      if (!target) {
        problems.push(`${page}: broken link ${attr}="${raw}"`);
        return;
      }
    }
    if (hash && target.endsWith('.html') && !idsOf.get(target)?.has(decodeURIComponent(hash))) problems.push(`${page}: missing anchor #${hash} in ${target}`);
  };
  for (const [sel, attr] of linkAttrs) for (const el of selectAll(sel, tree)) check(String((el as Element).properties?.[attr] ?? ''), attr);
  for (const el of selectAll('img[srcset], source[srcset]', tree)) {
    for (const part of String(el.properties?.srcSet ?? el.properties?.srcset ?? '').split(',')) check(part.trim().split(/\s+/)[0] ?? '', 'srcset');
  }
}

// ── 1. source vs output counts ────────────────────────────────────────────────────────────
const coverage = JSON.parse(fs.readFileSync(path.join(OUT_DATA, 'coverage.json'), 'utf8')) as CoverageData;
const output: Record<string, OutputCounts> = {};
for (const l of coverage.lessons) {
  const page = `${l.id}/index.html`;
  const tree = trees.get(page);
  if (!tree) {
    problems.push(`Lesson page missing from the build: ${page}`);
    continue;
  }
  const body = select('#lesson-body', tree);
  if (!body) {
    problems.push(`${page}: no #lesson-body`);
    continue;
  }
  const headings = selectAll('h1, h2, h3, h4, h5, h6', body).length;
  const code = selectAll('pre', body).length;
  const tables = selectAll('table', body).length;
  const markers = countMarkers(toString(body));
  const wantCode = l.source.code + l.source.recovered + l.source.htmlAsCode;
  const issues: string[] = [];
  if (headings !== l.source.headings) issues.push(`headings ${l.source.headings}→${headings}`);
  if (code !== wantCode) issues.push(`code ${wantCode}→${code}`);
  if (tables !== l.source.tables) issues.push(`tables ${l.source.tables}→${tables}`);
  for (const [m, n] of Object.entries(l.markers)) if ((markers[m as keyof typeof markers] ?? 0) !== n) issues.push(`${m} ${n}→${markers[m as keyof typeof markers]}`);
  output[l.id] = { headings, code, tables, markers, ok: issues.length === 0, problems: issues };
  if (issues.length) problems.push(`${l.id}: rendered output differs from the notes (${issues.join(', ')})`);
}
coverage.output = output;
fs.writeFileSync(path.join(OUT_DATA, 'coverage.json'), JSON.stringify(coverage, null, 2));
writeCoverage(coverage);

// ── report ────────────────────────────────────────────────────────────────────────────────
const mb = (total / 1048576).toFixed(1);
console.log(`verify: ${pages.length} pages, ${files.length} files, ${mb} MB, ${checkedLinks} internal links checked, ${coverage.lessons.length} lessons compared`);
const runnerFiles = files.filter((f) => f.rel.startsWith('runner/'));
if (runnerFiles.length) {
  const bytes = runnerFiles.reduce((n, f) => n + f.size, 0);
  console.log(`verify: of which the C# runner bundle (runner/) is ${runnerFiles.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
}
const sqlFiles = files.filter((f) => SQL_BINARY.test(f.rel));
if (sqlFiles.length) {
  console.log(`verify: the SQL runner's engine (sql.js) is ${sqlFiles.length} file${sqlFiles.length === 1 ? '' : 's'}, ${(sqlFiles.reduce((s, f) => s + f.size, 0) / 1048576).toFixed(1)} MB`);
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 80)) console.error(`• ${p}`);
  if (problems.length > 80) console.error(`… and ${problems.length - 80} more (see coverage-report.md)`);
  process.exit(1);
}
console.log('verify: all checks passed (counts, links, anchors, budgets, binary allowlist).');
