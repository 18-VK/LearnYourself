/**
 * Runnable-block check: which C# blocks get Run/Edit/Reset buttons, and what they print ("Expected output").
 *
 * 1. Reads every lesson's C# blocks (blocks.ts) and the harnesses/overrides in src/data/runnable/<lesson id>.yaml.
 * 2. Hands the programs to the .NET tool runner/Runner.Check, which decides with Roslyn's semantic model (and the real
 *    SDK) and runs each candidate twice in a child process with a hard timeout (see runner/NOTES.md).
 * 3. Writes src/data/generated/runnable.json (what the lesson pages read) and runnable-report.{json,md} (every block,
 *    with the reason it is or isn't runnable).
 *
 * Results are cached per program (code + harness + stdin + override + tool version) in
 * src/data/generated/runnable-cache.json, so only new or edited blocks are compiled and run again.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import type { RunnableBlockData, RunnableData } from '../../src/lib/runnable';
import { OUT_DATA, SITE_ROOT } from '../lib/paths';
import { allBlocks, type CsBlock } from './blocks';
import { findDotnet, RUNNER_DIR, runDotnet, type Dotnet } from './dotnet';
import { RunnableFileSchema, type RunnableEntry } from './schema';

export const RUNNABLE_DIR = path.join(SITE_ROOT, 'src', 'data', 'runnable');
export const RUNNABLE_JSON = path.join(OUT_DATA, 'runnable.json');
const REPORT_JSON = path.join(OUT_DATA, 'runnable-report.json');
const REPORT_MD = path.join(SITE_ROOT, 'runnable-report.md');
const CACHE_JSON = path.join(OUT_DATA, 'runnable-cache.json');
const WORK = path.join(SITE_ROOT, '.cache', 'runner-check');
const CHECK_DLL = path.join(RUNNER_DIR, 'Runner.Check', 'bin', 'Release', 'net10.0', 'Runner.Check.dll');
/** Run time limit per program, the same as the browser's. */
export const TIMEOUT_MS = 5000;
export const MAX_OUTPUT = 64 * 1024;

/** One program the check decides on: a block, or consecutive blocks merged, plus its harness. */
export interface ProgramSpec {
  /** Id of the program's last block (where the Run button goes). */
  id: string;
  lesson: string;
  blocks: CsBlock[];
  code: string;
  harness?: string;
  input?: string;
  stdin: string;
  force?: 'on' | 'off';
  forceReason?: string;
}

interface Diagnostic {
  id: string;
  severity: string;
  message: string;
  file: string;
  line: number;
}
interface RunRecord {
  outcome: string;
  stdout: string;
  error?: { type: string; message: string; line: number };
  ms: number;
}
export interface Verdict {
  id: string;
  runnable: boolean;
  category?: string;
  reason?: string;
  shape?: string;
  readsInput?: boolean;
  varies?: boolean;
  assemblies?: string[];
  diagnostics?: Diagnostic[];
  runs?: RunRecord[];
  expected?: RunRecord;
}

export interface CheckSummary {
  blocks: number;
  programs: number;
  runnable: number;
  withHarness: number;
  merged: number;
  varies: number;
  excluded: Record<string, number>;
}

// ── 1. programs from blocks + YAML ────────────────────────────────────────────────────────
function yamlFiles(dir = RUNNABLE_DIR): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.ya?ml$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

const firstLine = (code: string) => code.trimStart().split('\n')[0]!.trim();

export function buildPrograms(blocks: Map<string, CsBlock[]>, errors: string[]): ProgramSpec[] {
  const entries = new Map<string, RunnableEntry[]>();
  for (const file of yamlFiles()) {
    const rel = path.relative(RUNNABLE_DIR, file).split(path.sep).join('/');
    const lesson = rel.replace(/\.ya?ml$/, '');
    const where = `src/data/runnable/${rel}`;
    let parsed: unknown;
    try {
      parsed = YAML.parse(fs.readFileSync(file, 'utf8'), { version: '1.2' });
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      continue;
    }
    const r = RunnableFileSchema.safeParse(parsed);
    if (!r.success) {
      for (const i of r.error.issues) errors.push(`${where}: ${i.path.join('.') || '(root)'}: ${i.message}`);
      continue;
    }
    if (!blocks.has(lesson)) {
      errors.push(`${where}: lesson ${lesson} has no C# blocks (or does not exist). The file name must be the lesson id.`);
      continue;
    }
    entries.set(lesson, r.data.blocks);
  }

  const programs: ProgramSpec[] = [];
  for (const [lesson, list] of blocks) {
    const where = `src/data/runnable/${lesson}.yaml`;
    const claimed = new Map<number, RunnableEntry>();
    for (const e of entries.get(lesson) ?? []) {
      const idx = 'merge' in e ? e.merge : [e.block];
      for (const i of idx) {
        if (i > list.length) errors.push(`${where}: block ${i} does not exist (the lesson has ${list.length} C# block${list.length === 1 ? '' : 's'})`);
        else if (claimed.has(i)) errors.push(`${where}: block ${i} appears in two entries`);
        else claimed.set(i, e);
      }
      const first = list[idx[0]! - 1];
      if (first && e.startsWith && !first.code.trimStart().startsWith(e.startsWith.trim())) {
        errors.push(`${where}: block ${idx[0]} no longer starts with "${e.startsWith}" (it starts with "${firstLine(first.code).slice(0, 60)}"). The note changed: update the block number or the harness.`);
      }
    }
    for (const b of list) {
      const e = claimed.get(b.index);
      if (e && 'merge' in e && e.merge[e.merge.length - 1] !== b.index) continue; // folded into the merge's last block
      const members = e && 'merge' in e ? e.merge.map((i) => list[i - 1]!).filter(Boolean) : [b];
      programs.push({
        id: b.id,
        lesson,
        blocks: members,
        code: members.map((m) => m.code).join('\n\n'),
        harness: e?.harness?.replace(/\n+$/, ''),
        input: e?.input,
        stdin: e?.stdin ?? '',
        force: e?.runnable === undefined ? undefined : e.runnable ? 'on' : 'off',
        forceReason: e?.reason,
      });
    }
  }
  return programs;
}

// ── 2. the .NET check, with a per-program cache ───────────────────────────────────────────
function hashFiles(dir: string, hash: ReturnType<typeof createHash>): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === 'bin' || e.name === 'obj' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) hashFiles(full, hash);
    else hash.update(e.name).update(fs.readFileSync(full));
  }
}

export function toolStamp(sdk: string): string {
  const h = createHash('sha256').update(`sdk ${sdk} timeout ${TIMEOUT_MS} max ${MAX_OUTPUT}\n`);
  hashFiles(path.join(RUNNER_DIR, 'Runner.Core'), h);
  hashFiles(path.join(RUNNER_DIR, 'Runner.Check'), h);
  for (const f of ['Directory.Build.props', 'Directory.Packages.props', 'References.props', 'CopyReferences.targets']) h.update(fs.readFileSync(path.join(RUNNER_DIR, f)));
  return h.digest('hex').slice(0, 16);
}

const programKey = (p: ProgramSpec, stamp: string) =>
  createHash('sha256').update(JSON.stringify([stamp, p.code, p.harness ?? null, p.stdin, p.force ?? null])).digest('hex').slice(0, 20);

async function buildCheckTool(d: Dotnet, stamp: string, log: (m: string) => void): Promise<void> {
  const marker = path.join(path.dirname(CHECK_DLL), '.stamp');
  if (fs.existsSync(CHECK_DLL) && fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === stamp) return;
  log('runner: building Runner.Check…');
  await runDotnet(d, ['build', 'Runner.Check/Runner.Check.csproj', '-c', 'Release', '-v:minimal', '-nologo'], { quiet: true });
  fs.writeFileSync(marker, stamp);
}

async function runCheckTool(d: Dotnet, programs: ProgramSpec[], log: (m: string) => void): Promise<Verdict[]> {
  fs.mkdirSync(WORK, { recursive: true });
  const input = path.join(WORK, 'input.json');
  const output = path.join(WORK, 'output.json');
  fs.writeFileSync(
    input,
    JSON.stringify({
      programs: programs.map((p) => ({ id: p.id, code: p.code, harness: p.harness ?? null, stdin: p.stdin, force: p.force ?? null, forceReason: p.forceReason ?? null })),
      timeoutMs: TIMEOUT_MS,
      maxOutputChars: MAX_OUTPUT,
    }),
  );
  const out = await runDotnet(d, [CHECK_DLL, 'check', input, output, '--work', WORK], { quiet: true });
  for (const line of out.split(/\r?\n/)) if (line.startsWith('check:')) log(`runner: ${line.slice(7)}`);
  const result = JSON.parse(fs.readFileSync(output, 'utf8')) as { programs: Verdict[] };
  return result.programs;
}

// ── 3. outputs ────────────────────────────────────────────────────────────────────────────
function runnerInfo(): RunnableData['runner'] {
  const m = path.join(SITE_ROOT, 'public', 'runner', 'runner-manifest.json');
  if (!fs.existsSync(m)) return null;
  const j = JSON.parse(fs.readFileSync(m, 'utf8')) as { version: string; totalWithScripts: number; fileCount: number };
  return { version: j.version, downloadBytes: j.totalWithScripts, fileCount: j.fileCount };
}

export function writeUnavailable(note: string): void {
  const data: RunnableData = { available: false, note, runner: null, lessons: {} };
  fs.mkdirSync(OUT_DATA, { recursive: true });
  fs.writeFileSync(RUNNABLE_JSON, JSON.stringify(data));
}

function summarize(programs: ProgramSpec[], verdicts: Map<string, Verdict>, blockCount: number): CheckSummary {
  const s: CheckSummary = { blocks: blockCount, programs: programs.length, runnable: 0, withHarness: 0, merged: 0, varies: 0, excluded: {} };
  for (const p of programs) {
    const v = verdicts.get(p.id)!;
    if (v.runnable) {
      s.runnable++;
      if (p.harness) s.withHarness++;
      if (p.blocks.length > 1) s.merged++;
      if (v.varies) s.varies++;
    } else {
      s.excluded[v.category ?? 'unknown'] = (s.excluded[v.category ?? 'unknown'] ?? 0) + 1;
    }
  }
  return s;
}

function writeOutputs(programs: ProgramSpec[], verdicts: Map<string, Verdict>, summary: CheckSummary): void {
  const lessons: RunnableData['lessons'] = {};
  for (const p of programs) {
    const v = verdicts.get(p.id)!;
    if (!v.runnable) continue;
    const last = p.blocks[p.blocks.length - 1]!;
    const entry: RunnableBlockData = {
      index: last.index,
      hash: last.hash,
      id: p.id,
      stdin: p.stdin,
      readsInput: Boolean(v.readsInput),
      varies: Boolean(v.varies),
    };
    if (p.blocks.length > 1) {
      entry.merged = p.blocks.slice(0, -1).map((b) => b.index);
      entry.code = p.code;
    }
    if (p.harness) {
      entry.harness = p.harness;
      entry.input = p.input;
    }
    if (v.expected) entry.expected = { stdout: v.expected.stdout, outcome: v.expected.outcome, ...(v.expected.error ? { error: v.expected.error } : {}) };
    (lessons[p.lesson] ??= []).push(entry);
  }
  const data: RunnableData = { available: true, runner: runnerInfo(), lessons };
  fs.mkdirSync(OUT_DATA, { recursive: true });
  fs.writeFileSync(RUNNABLE_JSON, JSON.stringify(data));
  const report = programs.map((p) => {
    const v = verdicts.get(p.id)!;
    return { ...v, id: p.id, blocks: p.blocks.map((b) => b.index), harness: Boolean(p.harness), runs: undefined, firstLine: firstLine(p.code).slice(0, 80) };
  });
  fs.writeFileSync(REPORT_JSON, JSON.stringify({ summary, programs: report }, null, 1));

  // human-readable report (gitignored, like coverage-report.md)
  const lines = [
    '# Runnable C# blocks',
    '',
    'Generated by `scripts/runner/check.ts`. Every C# block in the lessons, and whether it gets a Run button.',
    '',
    `- C# blocks: **${summary.blocks}**, checked as ${summary.programs} programs (merged blocks count once)`,
    `- Runnable: **${summary.runnable}** (with a harness: ${summary.withHarness}, merged: ${summary.merged}; output varies between runs: ${summary.varies})`,
    `- Not runnable: **${summary.programs - summary.runnable}**`,
    '',
    '| Reason | Programs |',
    '|---|---|',
    ...Object.entries(summary.excluded)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `| ${k} | ${n} |`),
    '',
    '## Per block',
    '',
    '| Block | Runnable | Reason | First line |',
    '|---|---|---|---|',
    ...programs.map((p) => {
      const v = verdicts.get(p.id)!;
      const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/`/g, "'");
      return `| \`${p.id}\` | ${v.runnable ? (v.varies ? 'yes (output varies)' : 'yes') : 'no'} | ${esc(v.runnable ? (p.harness ? 'harness' : '') : `${v.category}: ${v.reason ?? ''}`)} | ${esc(firstLine(p.code).slice(0, 60))} |`;
    }),
    '',
  ];
  fs.writeFileSync(REPORT_MD, lines.join('\n'));
}

export interface CheckResult {
  ok: boolean;
  errors: string[];
  summary?: CheckSummary;
  skipped?: string;
}

/** Runs the whole check. Without a .NET SDK it writes an "unavailable" runnable.json and returns skipped. */
export async function runRunnableCheck(opts: { log?: (m: string) => void } = {}): Promise<CheckResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const errors: string[] = [];
  const blocks = allBlocks();
  const blockCount = [...blocks.values()].reduce((n, b) => n + b.length, 0);
  const programs = buildPrograms(blocks, errors);
  if (errors.length) return { ok: false, errors };
  const d = findDotnet();
  if (!d) {
    writeUnavailable('No .NET SDK 10+ was found when the site was built.');
    return { ok: true, errors, skipped: 'no-sdk' };
  }
  const stamp = toolStamp(d.version);
  await buildCheckTool(d, stamp, log);

  const cache = fs.existsSync(CACHE_JSON) ? (JSON.parse(fs.readFileSync(CACHE_JSON, 'utf8')) as Record<string, Verdict>) : {};
  const verdicts = new Map<string, Verdict>();
  const todo: ProgramSpec[] = [];
  for (const p of programs) {
    const hit = cache[programKey(p, stamp)];
    if (hit) verdicts.set(p.id, { ...hit, id: p.id });
    else todo.push(p);
  }
  log(`runner: ${blockCount} C# blocks in ${blocks.size} lessons → ${programs.length} programs; ${todo.length} to check (${programs.length - todo.length} cached)`);
  if (todo.length) {
    const started = Date.now();
    for (const v of await runCheckTool(d, todo, log)) verdicts.set(v.id, v);
    log(`runner: check took ${Math.round((Date.now() - started) / 1000)} s`);
  }
  const nextCache: Record<string, Verdict> = {};
  for (const p of programs) {
    const v = verdicts.get(p.id);
    if (!v) {
      errors.push(`runner: no result for ${p.id}`);
      continue;
    }
    nextCache[programKey(p, stamp)] = v;
  }
  if (errors.length) return { ok: false, errors };
  fs.writeFileSync(CACHE_JSON, JSON.stringify(nextCache));
  const summary = summarize(programs, verdicts, blockCount);
  writeOutputs(programs, verdicts, summary);
  // every harness must make its block runnable; a broken harness is a build error, not a silent "no Run button"
  for (const p of programs) {
    const v = verdicts.get(p.id)!;
    if (p.harness && !v.runnable) errors.push(`src/data/runnable/${p.lesson}.yaml: the harness for block ${p.blocks.map((b) => b.index).join('+')} does not make it runnable (${v.category}: ${v.reason})`);
    if (p.force === 'on' && !v.runnable) errors.push(`src/data/runnable/${p.lesson}.yaml: block ${p.blocks.map((b) => b.index).join('+')} is forced on but ${v.category}: ${v.reason}`);
  }
  log(
    `runner: ${summary.runnable} of ${summary.programs} programs runnable (${summary.withHarness} with a harness, ${summary.varies} with varying output); ` +
      `not runnable: ${Object.entries(summary.excluded)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(', ')}. See runnable-report.md.`,
  );
  return { ok: errors.length === 0, errors, summary };
}

// CLI: tsx scripts/runner/check.ts
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const r = await runRunnableCheck();
  for (const e of r.errors) console.error(`• ${e}`);
  if (r.skipped) {
    console.warn('runner: no .NET SDK 10+ found; wrote runnable.json without Run buttons.');
    if (process.env.LY_REQUIRE_RUNNER === '1') process.exit(1);
  }
  process.exit(r.ok ? 0 : 1);
}
