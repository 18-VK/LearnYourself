/**
 * Practice mode build step: reads src/data/practice/<lesson id>.yaml, builds each exercise's starter code and test
 * harness (scripts/practice/harness.ts), checks that every case marked `reviewed: true` quotes its note, and — with a
 * .NET SDK — compiles and runs two programs per exercise with the C# runner's own build-time tool (Runner.Check):
 *   1. the note's implementation + the harness: every case must pass (so the expected values agree with the note);
 *   2. the starter code + the harness: it must compile, and at least one case must fail.
 * Writes src/data/generated/practice.json (what lesson pages read) and practice-report.md. Part of `npm run build`
 * (after the C# runner step); `npm run practice` runs it alone.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import type { PracticeData, PracticeExerciseData } from '../../src/lib/practice';
import { parseCases } from '../../src/scripts/practice/protocol';
import { OUT_DATA, OUT_LESSONS, SITE_ROOT } from '../lib/paths';
import { allBlocks } from '../runner/blocks';
import { toolStamp } from '../runner/check';
import { findDotnet, RUNNER_DIR, runDotnet } from '../runner/dotnet';
import { buildExercise, type BuiltExercise } from './harness';
import { PracticeFileSchema, type PracticeExercise } from './schema';

export const PRACTICE_DIR = path.join(SITE_ROOT, 'src', 'data', 'practice');
export const PRACTICE_JSON = path.join(OUT_DATA, 'practice.json');
const CACHE_JSON = path.join(OUT_DATA, 'practice-cache.json');
const REPORT_MD = path.join(SITE_ROOT, 'practice-report.md');
const WORK = path.join(SITE_ROOT, '.cache', 'practice-check');
const CHECK_DLL = path.join(RUNNER_DIR, 'Runner.Check', 'bin', 'Release', 'net10.0', 'Runner.Check.dll');

const normalize = (s: string) => s.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();

function yamlFiles(dir = PRACTICE_DIR): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.ya?ml$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

function lessonMarkdown(id: string): string | null {
  const file = path.join(OUT_LESSONS, ...id.split('/')) + '.md';
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
/** A full lesson id from a full or short one (the last path segment). */
function resolveLesson(id: string, all: string[]): string | null {
  if (all.includes(id)) return id;
  const hits = all.filter((l) => l.endsWith(`/${id}`));
  return hits.length === 1 ? hits[0]! : null;
}

interface Planned {
  lesson: string;
  ex: PracticeExercise;
  built: BuiltExercise;
  data: PracticeExerciseData;
}

export function planExercises(errors: string[]): Planned[] {
  const blocks = allBlocks();
  const lessons = fs.existsSync(OUT_LESSONS)
    ? fs
        .readdirSync(OUT_LESSONS, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => path.relative(OUT_LESSONS, path.join(e.parentPath, e.name)).split(path.sep).join('/').replace(/\.md$/, ''))
    : [];
  const out: Planned[] = [];
  for (const file of yamlFiles()) {
    const rel = path.relative(PRACTICE_DIR, file).split(path.sep).join('/');
    const lesson = rel.replace(/\.ya?ml$/, '');
    const where = `src/data/practice/${rel}`;
    let parsed: unknown;
    try {
      parsed = YAML.parse(fs.readFileSync(file, 'utf8'), { version: '1.2' });
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      continue;
    }
    const r = PracticeFileSchema.safeParse(parsed);
    if (!r.success) {
      for (const i of r.error.issues) errors.push(`${where}: ${i.path.join('.') || '(root)'}: ${i.message}`);
      continue;
    }
    const list = blocks.get(lesson);
    if (!list) {
      errors.push(`${where}: lesson ${lesson} has no C# blocks (or does not exist). The file name must be the lesson id.`);
      continue;
    }
    const ids = new Set<string>();
    for (const ex of r.data.exercises) {
      const at = `${where}: ${ex.id}`;
      if (ids.has(ex.id)) errors.push(`${at}: duplicate exercise id`);
      ids.add(ex.id);
      const block = list[ex.solution.block - 1];
      if (!block) {
        errors.push(`${at}: C# block ${ex.solution.block} does not exist (the lesson has ${list.length})`);
        continue;
      }
      if (!block.code.trimStart().startsWith(ex.solution.startsWith.trim())) {
        errors.push(`${at}: C# block ${ex.solution.block} no longer starts with "${ex.solution.startsWith}". The note changed: update the block number.`);
        continue;
      }
      // a case marked reviewed must quote the note
      ex.cases.forEach((c, i) => {
        if (!c.reviewed || !c.quote) return;
        const from = c.quoteFrom ? resolveLesson(c.quoteFrom, lessons) : lesson;
        const md = from ? lessonMarkdown(from) : null;
        if (!md) errors.push(`${at}: case ${i + 1}: quoteFrom "${c.quoteFrom}" is not a lesson`);
        else if (!normalize(md).includes(normalize(c.quote))) errors.push(`${at}: case ${i + 1}: the quote "${c.quote.slice(0, 60)}" is not in lesson ${from} (copy it from the note, or mark the case reviewed: false)`);
      });
      let built: BuiltExercise;
      try {
        built = buildExercise(ex, block.code);
      } catch (e) {
        errors.push(`${at}: ${(e as Error).message}`);
        continue;
      }
      const sig = built.signature;
      out.push({
        lesson,
        ex,
        built,
        data: {
          id: ex.id,
          title: ex.title,
          task: ex.task,
          signature: `${sig.returnType} ${sig.name}(${sig.params.map((p) => `${p.type} ${p.name}`).join(', ')})`,
          starter: built.starter,
          harness: built.harness,
          solution: { index: block.index, hash: block.hash, code: block.code },
          cases: ex.cases.map((c, i) => ({
            input: built.cases[i]!.input,
            expected: built.cases[i]!.expected,
            reviewed: c.reviewed,
            ...(c.reviewed ? { source: c.source ?? `From the note: “${c.quote}”` } : c.source ? { source: c.source } : {}),
          })),
        },
      });
    }
  }
  return out;
}

// ── verification with Runner.Check ────────────────────────────────────────────────────────
interface Verdict {
  id: string;
  runnable: boolean;
  category?: string;
  reason?: string;
  diagnostics?: { file: string; line: number; message: string }[];
  expected?: { stdout: string; outcome: string };
  runs?: { stdout: string; outcome: string }[];
}

async function verify(planned: Planned[], log: (m: string) => void, errors: string[]): Promise<{ verified: boolean; notes: Map<string, string> }> {
  const notes = new Map<string, string>();
  const d = findDotnet();
  if (!d) {
    const msg = 'practice: no .NET SDK 10+ found, so the exercises are not verified and the lesson pages show none.';
    if (process.env.LY_REQUIRE_RUNNER === '1') errors.push(`${msg} LY_REQUIRE_RUNNER=1 makes this an error.`);
    else log(msg);
    return { verified: false, notes };
  }
  if (!fs.existsSync(CHECK_DLL)) {
    log('practice: building Runner.Check…');
    await runDotnet(d, ['build', 'Runner.Check/Runner.Check.csproj', '-c', 'Release', '-v:minimal', '-nologo'], { quiet: true });
  }
  const stamp = toolStamp(d.version);
  const programs = planned.flatMap((p) => [
    { id: `${p.lesson}#${p.ex.id}#solution`, code: p.data.solution.code, harness: p.built.harness, stdin: '', force: null, forceReason: null },
    { id: `${p.lesson}#${p.ex.id}#starter`, code: p.built.starter, harness: p.built.harness, stdin: '', force: null, forceReason: null },
  ]);
  const key = createHash('sha256').update(JSON.stringify([stamp, programs])).digest('hex');
  const cache = fs.existsSync(CACHE_JSON) ? (JSON.parse(fs.readFileSync(CACHE_JSON, 'utf8')) as { key: string; verdicts: Verdict[] }) : null;
  let verdicts: Verdict[];
  if (cache?.key === key) verdicts = cache.verdicts;
  else {
    fs.mkdirSync(WORK, { recursive: true });
    const input = path.join(WORK, 'input.json');
    const output = path.join(WORK, 'output.json');
    fs.writeFileSync(input, JSON.stringify({ programs, timeoutMs: 5000, maxOutputChars: 64 * 1024 }));
    const started = Date.now();
    await runDotnet(d, [CHECK_DLL, 'check', input, output, '--work', WORK], { quiet: true });
    verdicts = (JSON.parse(fs.readFileSync(output, 'utf8')) as { programs: Verdict[] }).programs;
    log(`practice: compiled and ran ${programs.length} programs in ${Math.round((Date.now() - started) / 1000)} s`);
    fs.writeFileSync(CACHE_JSON, JSON.stringify({ key, verdicts: verdicts.map((v) => ({ ...v, runs: undefined })) }));
  }
  const byId = new Map(verdicts.map((v) => [v.id, v]));
  for (const p of planned) {
    const at = `src/data/practice/${p.lesson}.yaml: ${p.ex.id}`;
    const expected = p.data.cases.map((c) => c.expected);
    const sol = byId.get(`${p.lesson}#${p.ex.id}#solution`);
    const st = byId.get(`${p.lesson}#${p.ex.id}#starter`);
    const out = (v: Verdict | undefined) => v?.expected?.stdout ?? v?.runs?.[0]?.stdout;
    if (!sol?.runnable || out(sol) === undefined) {
      errors.push(`${at}: the note's implementation with the tests does not run (${sol?.category}: ${sol?.reason ?? sol?.diagnostics?.[0]?.message ?? 'no output'})`);
      continue;
    }
    const cases = parseCases(out(sol)!, expected);
    for (const c of cases) {
      if (c.status === 'pass') continue;
      errors.push(`${at}: case ${c.n} fails with the note's own implementation: expected ${expected[c.n - 1]}, got ${c.actual ?? c.error ?? c.status}. Fix the case, or log the note's bug in CONTENT_ISSUES.md.`);
    }
    if (!st?.runnable) errors.push(`${at}: the starter code with the tests does not compile (${st?.category}: ${st?.reason ?? ''})`);
    else if (out(st) !== undefined && parseCases(out(st)!, expected).every((c) => c.status === 'pass')) errors.push(`${at}: the starter code (empty methods) already passes every case: add a case it fails`);
    notes.set(p.ex.id, `${cases.filter((c) => c.status === 'pass').length}/${cases.length} pass with the note's code`);
  }
  return { verified: true, notes };
}

export interface PracticeSummary {
  exercises: number;
  cases: number;
  reviewed: number;
  generated: number;
  verified: boolean;
}

export async function runPracticeCheck(opts: { log?: (m: string) => void; verify?: boolean } = {}): Promise<{ ok: boolean; errors: string[]; summary?: PracticeSummary }> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const errors: string[] = [];
  const planned = planExercises(errors);
  if (errors.length) return { ok: false, errors };
  const { verified, notes } = opts.verify === false ? { verified: false, notes: new Map<string, string>() } : await verify(planned, log, errors);
  const lessons: PracticeData['lessons'] = {};
  for (const p of planned) (lessons[p.lesson] ??= []).push(p.data);
  const data: PracticeData = { verified: verified && errors.length === 0, lessons };
  fs.mkdirSync(OUT_DATA, { recursive: true });
  fs.writeFileSync(PRACTICE_JSON, JSON.stringify(data));
  const cases = planned.flatMap((p) => p.data.cases);
  const summary: PracticeSummary = { exercises: planned.length, cases: cases.length, reviewed: cases.filter((c) => c.reviewed).length, generated: cases.filter((c) => !c.reviewed).length, verified };
  fs.writeFileSync(
    REPORT_MD,
    [
      '# Practice exercises',
      '',
      'Generated by `scripts/practice/check.ts`.',
      '',
      `- Exercises: **${summary.exercises}**; test cases: **${summary.cases}** (${summary.reviewed} from the notes, ${summary.generated} generated, not reviewed)`,
      `- Verified with the .NET SDK: ${verified ? 'yes' : 'no (no SDK)'}`,
      '',
      '| Lesson | Exercise | Method | Cases (note / generated) | Check |',
      '|---|---|---|---|---|',
      ...planned.map((p) => `| \`${p.lesson}\` | ${p.ex.id} | \`${p.data.signature}\` | ${p.data.cases.filter((c) => c.reviewed).length} / ${p.data.cases.filter((c) => !c.reviewed).length} | ${notes.get(p.ex.id) ?? '-'} |`),
      '',
    ].join('\n'),
  );
  log(`practice: ${summary.exercises} exercises, ${summary.cases} test cases (${summary.reviewed} from the notes, ${summary.generated} generated)${verified ? ', verified with the note implementations' : ', not verified'}. See practice-report.md.`);
  return { ok: errors.length === 0, errors, summary };
}

// CLI: tsx scripts/practice/check.ts
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const r = await runPracticeCheck();
  for (const e of r.errors) console.error(`• ${e}`);
  process.exit(r.ok ? 0 : 1);
}
