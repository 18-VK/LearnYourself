/**
 * Runnable-SQL check: which SQL blocks get a Run button (run in the browser with sql.js), what they return
 * ("Expected output"), and which get the "T-SQL only" label. Part of `npm run build`; `npm run sqlrun` runs it alone.
 *
 * A block is runnable only when it runs in SQLite *and* its result can't differ from SQL Server's:
 * 1. no T-SQL-only syntax, nothing SQL Server rejects (src/scripts/sqlrun/classify.ts, dialect + grouping rules);
 * 2. it runs in sql.js — the same engine and version the browser uses — on the lesson's own sample data
 *    (src/data/sqlrun/<lesson id>.yaml says which blocks are the setup), and returns rows;
 * 3. nothing in it depends on typing (classify.ts typing rules, with the column types the setup declares);
 * 4. the data fits its declared types the way SQL Server would store it (lengths, ranges, DECIMAL scale, PK/UNIQUE
 *    NULLs) and every text value compares the same under SQL Server's case-insensitive default collation as under
 *    SQLite's binary one;
 * 5. every value prints the same (no float noise, no INT overflow);
 * 6. AVG of an INT column: run again as CAST(AVG(x) AS INTEGER) (SQL Server's integer AVG); the rows must match;
 * 7. run again with every table's rows in reverse order: the same rows must come back (ROW_NUMBER over ties, …).
 *    Without ORDER BY the page says SQL Server may order the rows differently.
 * "Expected output" is the result of step 2. Nothing is typed in by hand.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import initSqlJs, { type SqlJsStatic, type SqlValue } from 'sql.js';
import YAML from 'yaml';
import type { ExpectedStatement, LessonSqlRun, SqlLabel, SqlRunData, SqlRunnableBlock } from '../../src/lib/sqlrun';
import { avgAsInteger, classify, dialectFindings, groupingFindings, hasTopLevelOrderBy, kindOfType, type Finding, type Schema } from '../../src/scripts/sqlrun/classify';
import { introspect, runScript, type RunResult, type StatementResult, type TableInfo } from '../../src/scripts/sqlrun/engine';
import { significant, stringValue, tokenize } from '../../src/scripts/sqlrun/tokens';
import { OUT_DATA, SITE_ROOT } from '../lib/paths';
import { allSqlBlocks, type SqlBlock } from './blocks';
import { SqlRunFileSchema, type SqlRunFile } from './schema';

export const SQLRUN_DIR = path.join(SITE_ROOT, 'src', 'data', 'sqlrun');
export const SQLRUN_JSON = path.join(OUT_DATA, 'sqlrun.json');
const REPORT_JSON = path.join(OUT_DATA, 'sqlrun-report.json');
const REPORT_MD = path.join(SITE_ROOT, 'sqlrun-report.md');

export type Category =
  | 'runnable'
  | 'setup'
  | 'tsql-only'
  | 'not-tsql'
  | 'typing'
  | 'unverified'
  | 'order-dependent'
  | 'no-data'
  | 'syntax'
  | 'sqlite-error'
  | 'no-result'
  | 'forced-off';

export interface BlockVerdict {
  id: string;
  lesson: string;
  index: number;
  category: Category;
  construct?: string;
  detail?: string;
  setup?: string;
  expected?: ExpectedStatement[];
  firstLine: string;
}

// ── data checks ───────────────────────────────────────────────────────────────────────────
const INT_RANGE: Record<string, [number, number]> = {
  TINYINT: [0, 255],
  SMALLINT: [-32768, 32767],
  INT: [-2147483648, 2147483647],
  INTEGER: [-2147483648, 2147483647],
  BIGINT: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
};
/** Text SQL Server's default collation (case-insensitive) and SQLite's (binary) order the same way: plain ASCII. */
const SAFE_TEXT = /^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/;
const ci = (s: string) => s.toLowerCase();
const sign = (n: number) => (n < 0 ? -1 : n > 0 ? 1 : 0);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function schemaOf(tables: TableInfo[]): Schema {
  return { columns: tables.flatMap((t) => t.columns.map((c) => ({ table: t.name, name: c.name, type: c.type, kind: kindOfType(c.type) }))) };
}

/** Problems with the data itself (after the setup and the block ran), as typing findings. */
export function dataFindings(tables: TableInfo[], literals: string[]): Finding[] {
  const out: Finding[] = [];
  const add = (construct: string, detail: string) => {
    if (!out.some((f) => f.construct === construct)) out.push({ category: 'typing', construct, detail, line: 1 });
  };
  const texts = new Set<string>(literals);
  for (const t of tables) {
    t.columns.forEach((c, ci_) => {
      const kind = kindOfType(c.type);
      const type = c.type.trim().toUpperCase();
      if (kind === 'other') {
        add(`${type || 'untyped'} column`, `${t.name}.${c.name} is declared ${c.type || 'without a type'}; only INT, BIT, DECIMAL and (N)VARCHAR(n) columns are checked to behave the same in SQLite.`);
        return;
      }
      const values = t.rows.map((r) => r[ci_]);
      const types = t.types.map((r) => r[ci_]);
      if (c.pk && values.some((v) => v === null)) add('NULL in a primary key', `${t.name}.${c.name}: SQL Server rejects NULL in a primary key; SQLite allows it.`);
      values.forEach((v, k) => {
        if (v === null) return;
        const st = types[k];
        if (kind === 'int') {
          const [lo, hi] = INT_RANGE[type] ?? INT_RANGE.INT!;
          if (st !== 'integer') add('value of the wrong type', `${t.name}.${c.name} (${c.type}) holds ${JSON.stringify(v)}, which SQL Server would convert or reject.`);
          else if ((v as number) < lo || (v as number) > hi) add('value out of range', `${t.name}.${c.name} (${c.type}) holds ${String(v)}, outside the type's range in SQL Server.`);
        } else if (kind === 'bit') {
          if (st !== 'integer' || (v !== 0 && v !== 1)) add('BIT value', `${t.name}.${c.name} (BIT) holds ${JSON.stringify(v)}; SQL Server stores only 0 and 1.`);
        } else if (kind === 'decimal') {
          const m = /\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)/.exec(c.type);
          const p = m ? Number(m[1]) : 18;
          const s = m?.[2] !== undefined ? Number(m[2]) : 0;
          if (st !== 'integer' && st !== 'real') add('value of the wrong type', `${t.name}.${c.name} (${c.type}) holds ${JSON.stringify(v)}.`);
          else {
            const n = v as number;
            const scaled = n * 10 ** s;
            if (Math.abs(scaled - Math.round(scaled)) > 1e-6 * Math.max(1, Math.abs(scaled))) add('DECIMAL rounding', `${t.name}.${c.name} (${c.type}) holds ${n}: SQL Server would round it to ${s} decimals.`);
            if (Math.abs(n) >= 10 ** (p - s)) add('DECIMAL overflow', `${t.name}.${c.name} (${c.type}) holds ${n}, too large for the type in SQL Server.`);
          }
        } else if (kind === 'text') {
          const n = Number(/\(\s*(\d+)\s*\)/.exec(c.type)?.[1] ?? 0);
          if (st !== 'text') add('value of the wrong type', `${t.name}.${c.name} (${c.type}) holds ${JSON.stringify(v)}.`);
          else {
            const s = v as string;
            if (s.length > n) add('text longer than the column', `${t.name}.${c.name} (${c.type}) holds "${s}": SQL Server rejects text longer than ${n} characters.`);
            texts.add(s);
          }
        }
      });
    });
    for (const u of t.unique) {
      const idx = u.map((name) => t.columns.findIndex((c) => c.name === name));
      const nulls = t.rows.filter((r) => idx.some((i) => r[i] === null)).length;
      if (nulls > 1) add('NULLs in a UNIQUE column', `${t.name}(${u.join(', ')}): SQL Server allows one NULL in a UNIQUE column, SQLite many.`);
    }
  }
  // collation: every pair of text values must compare the same case-insensitively (SQL Server) and in binary (SQLite)
  const list = [...texts];
  for (const s of list) {
    if (s !== '' && !SAFE_TEXT.test(s)) {
      add('text collation', `"${s}": only letters, digits and single spaces are checked to sort and compare the same under SQL Server's default collation and SQLite's.`);
      return out;
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (sign(cmp(a, b)) !== sign(cmp(ci(a), ci(b)))) {
        add('text collation', `"${a}" and "${b}" compare differently in SQL Server (case-insensitive) and SQLite (binary).`);
        return out;
      }
    }
  }
  return out;
}

/** Values that would print differently in SQL Server. */
export function resultFindings(statements: StatementResult[]): Finding[] {
  const out: Finding[] = [];
  for (const s of statements) {
    if (s.kind !== 'rows' || !s.raw || !s.table) continue;
    for (const row of s.raw) {
      row.forEach((v, i) => {
        const declared = (s.table!.declared[i] ?? '').toUpperCase();
        if (v instanceof Uint8Array) out.push({ category: 'typing', construct: 'binary value', detail: 'Binary values print differently.', line: s.line });
        else if (typeof v === 'number' && !Number.isInteger(v) && !/^(DECIMAL|NUMERIC)/.test(declared) && Number(v.toPrecision(15)) !== v)
          out.push({ category: 'typing', construct: 'floating-point value', detail: `${v} needs more than 15 significant digits; SQL Server shows such values rounded.`, line: s.line });
        else if (typeof v === 'number' && Number.isInteger(v) && Math.abs(v) > 2147483647 && declared !== 'BIGINT')
          out.push({ category: 'typing', construct: 'INT overflow', detail: `${v} is outside SQL Server's INT range, where the query would fail with an overflow.`, line: s.line });
      });
      if (out.length) return out.slice(0, 1);
    }
  }
  return out;
}

// ── comparing results ─────────────────────────────────────────────────────────────────────
const rowKey = (r: (string | null)[]) => JSON.stringify(r);
export function sameRows(a: (string | null)[][], b: (string | null)[][], ordered: boolean): boolean {
  if (a.length !== b.length) return false;
  if (ordered) return a.every((r, i) => rowKey(r) === rowKey(b[i]!));
  const ka = a.map(rowKey).sort();
  const kb = b.map(rowKey).sort();
  return ka.every((k, i) => k === kb[i]);
}
const rowsOf = (r: RunResult) => r.statements.filter((s) => s.kind === 'rows');

// ── one block ─────────────────────────────────────────────────────────────────────────────
export interface DecideInput {
  code: string;
  setupCode: string;
  forcedOff?: string;
}
export type Decision = Omit<BlockVerdict, 'id' | 'lesson' | 'index' | 'firstLine' | 'setup'>;

const reject = (category: Category, f: { construct?: string; detail?: string }): Decision => ({ category, construct: f.construct, detail: f.detail });

export function decide(SQL: SqlJsStatic, input: DecideInput): Decision {
  const { code, setupCode } = input;
  const static1 = [...dialectFindings(code), ...groupingFindings(code)];
  const tsql = static1.find((f) => f.category === 'tsql-only');
  if (tsql) return reject('tsql-only', tsql);
  const nott = static1.find((f) => f.category === 'not-tsql');
  if (nott) return reject('not-tsql', nott);
  if (input.forcedOff) return reject('forced-off', { detail: input.forcedOff });

  let tables: TableInfo[] = [];
  const first = runScript(SQL, setupCode, code, { keepRaw: true, inspect: (db) => (tables = introspect(db)) });
  if (first.error) {
    const m = first.error.message;
    if (first.error.phase === 'setup') return reject('sqlite-error', { construct: 'setup', detail: `The setup failed: ${m}` });
    if (/no such (table|column|function)/i.test(m)) return reject('no-data', { construct: m.replace(/:.*/, ''), detail: `${m} (the note doesn't create it in this lesson)` });
    if (/syntax error|incomplete input|unrecognized token/i.test(m)) return reject('syntax', { construct: 'syntax', detail: m });
    return reject('sqlite-error', { construct: 'error', detail: m });
  }
  const queries = rowsOf(first);
  if (!queries.length) return reject('no-result', { detail: 'returns no rows to show (only creates or changes data)' });

  const schema = schemaOf(tables);
  const typing = classify(code, schema).filter((f) => f.category === 'typing' || f.category === 'unverified');
  if (typing.length) return reject(typing[0]!.category, typing[0]!);
  const likePatterns = new Set<string>();
  const ts = significant(tokenize(code));
  ts.forEach((t, i) => {
    if (t.kind === 'string' && ts[i - 1]?.upper === 'LIKE') likePatterns.add(stringValue(t));
  });
  const literals = ts.filter((t) => t.kind === 'string').map(stringValue).filter((s) => !likePatterns.has(s));
  const data = dataFindings(tables, literals);
  if (data.length) return reject('typing', data[0]!);
  // SQL Server's AVG of an INT column is an INT
  const avg = avgAsInteger(code);
  if (avg) {
    const alt = runScript(SQL, setupCode, avg);
    const same = !alt.error && rowsOf(alt).length === queries.length && rowsOf(alt).every((s, i) => sameRows(s.table!.rows, queries[i]!.table!.rows, true) && s.table!.total === queries[i]!.table!.total);
    if (!same) return reject('typing', { construct: 'AVG of an INT column', detail: "SQL Server's AVG of an INT column drops the fraction (it returns an INT); here that changes the result." });
  }

  const values = resultFindings(first.statements);
  if (values.length) return reject('typing', values[0]!);

  // the same rows must come back when the tables hold their rows in another order
  let reversed: RunResult;
  try {
    reversed = runScript(SQL, setupCode, code, { reverseBeforeFirstQuery: true });
  } catch (e) {
    return reject('unverified', { construct: 'row order', detail: `could not re-run with the rows in another order: ${(e as Error).message}` });
  }
  const rq = rowsOf(reversed);
  if (reversed.error || rq.length !== queries.length) return reject('unverified', { construct: 'row order', detail: 'could not re-run with the rows in another order' });
  const expected: ExpectedStatement[] = [];
  for (const s of first.statements) {
    if (s.kind !== 'rows') {
      expected.push({ line: s.line, kind: s.kind, ...(s.kind === 'changes' ? { changes: s.changes } : {}) });
      continue;
    }
    const k = queries.indexOf(s);
    const other = rq[k]!.table!;
    const t = s.table!;
    if (t.truncated || other.total !== t.total || !sameRows(t.rows, other.rows, false)) {
      return reject('order-dependent', { construct: 'row order', detail: 'The rows (not just their order) change when the table rows are stored in another order: ties in ORDER BY or ROW_NUMBER, or a value picked from an arbitrary row.' });
    }
    const ordered = hasTopLevelOrderBy(s.sql);
    const order = t.total > 1 ? (!ordered ? 'none' : !sameRows(t.rows, other.rows, true) ? 'ties' : undefined) : undefined;
    expected.push({ line: s.line, kind: 'rows', columns: t.columns, rows: t.rows, total: t.total, ...(t.truncated ? { truncated: true } : {}), ...(order ? { order } : {}) });
  }
  return { category: 'runnable', expected };
}

// ── the whole site ────────────────────────────────────────────────────────────────────────
function yamlFiles(dir = SQLRUN_DIR): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.ya?ml$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

export function loadFiles(blocks: Map<string, SqlBlock[]>, errors: string[]): Map<string, SqlRunFile> {
  const out = new Map<string, SqlRunFile>();
  for (const file of yamlFiles()) {
    const rel = path.relative(SQLRUN_DIR, file).split(path.sep).join('/');
    const lesson = rel.replace(/\.ya?ml$/, '');
    const where = `src/data/sqlrun/${rel}`;
    let parsed: unknown;
    try {
      parsed = YAML.parse(fs.readFileSync(file, 'utf8'), { version: '1.2' });
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      continue;
    }
    const r = SqlRunFileSchema.safeParse(parsed);
    if (!r.success) {
      for (const i of r.error.issues) errors.push(`${where}: ${i.path.join('.') || '(root)'}: ${i.message}`);
      continue;
    }
    const list = blocks.get(lesson);
    if (!list) {
      errors.push(`${where}: lesson ${lesson} has no SQL blocks (or does not exist). The file name must be the lesson id.`);
      continue;
    }
    const all = [...r.data.setups.flatMap((s) => s.blocks), ...r.data.uses.flatMap((u) => u.blocks), ...r.data.overrides.map((o) => o.block)];
    for (const b of all) if (b > list.length) errors.push(`${where}: block ${b} does not exist (the lesson has ${list.length} SQL blocks)`);
    for (const s of r.data.setups) {
      const firstBlock = list[s.blocks[0]! - 1];
      if (firstBlock && !firstBlock.code.trimStart().startsWith(s.startsWith.trim()))
        errors.push(`${where}: setup ${s.id}: block ${s.blocks[0]} no longer starts with "${s.startsWith}" (it starts with "${firstBlock.code.trimStart().split('\n')[0]!.slice(0, 60)}"). The note changed: update the block numbers.`);
    }
    out.set(lesson, r.data);
  }
  return out;
}

export interface SqlCheckSummary {
  blocks: number;
  lessons: number;
  runnable: number;
  setups: number;
  labelled: number;
  byCategory: Record<string, number>;
  byConstruct: Record<string, number>;
}

const firstLine = (code: string) => code.trimStart().split('\n')[0]!.trim().slice(0, 80);
/** Blocks a learner would expect to run: queries and data changes (not admin or fragments). */
const looksLikeQuery = (code: string) => /^(SELECT|WITH|INSERT|UPDATE|DELETE|MERGE)\b/i.test(code.replace(/^\s*(--[^\n]*\n\s*)*/, '').trimStart());

export function checkLessons(SQL: SqlJsStatic, blocks: Map<string, SqlBlock[]>, files: Map<string, SqlRunFile>, errors: string[]): { verdicts: BlockVerdict[]; lessons: Record<string, LessonSqlRun> } {
  const verdicts: BlockVerdict[] = [];
  const lessons: Record<string, LessonSqlRun> = {};
  for (const [lesson, list] of blocks) {
    const file = files.get(lesson) ?? { setups: [], uses: [], overrides: [] };
    const where = `src/data/sqlrun/${lesson}.yaml`;
    const setupOf = new Map<number, string>();
    for (const u of file.uses) for (const b of u.blocks) setupOf.set(b, u.setup);
    const setupBlocks = new Map<number, string[]>();
    const setups: LessonSqlRun['setups'] = {};
    for (const s of file.setups) {
      const code = s.blocks.map((b) => list[b - 1]?.code ?? '').join('\n\n');
      for (const b of s.blocks) setupBlocks.set(b, [...(setupBlocks.get(b) ?? []), s.id]);
      // a setup must itself be plain, checked SQL: nothing T-SQL-only, it runs in SQLite, and its data is safe
      const dialect = dialectFindings(code).filter((f) => f.category === 'tsql-only' || f.category === 'not-tsql');
      if (dialect.length) errors.push(`${where}: setup ${s.id} can't run in SQLite: ${dialect[0]!.construct} (${dialect[0]!.detail})`);
      let tables: TableInfo[] = [];
      const run = runScript(SQL, code, '', { inspect: (db) => (tables = introspect(db)) });
      if (run.error) errors.push(`${where}: setup ${s.id} fails in SQLite at line ${run.error.line}: ${run.error.message}`);
      const data = dataFindings(tables, []);
      if (data.length) errors.push(`${where}: setup ${s.id}: ${data[0]!.detail}`);
      setups[s.id] = { code, blocks: s.blocks, from: s.from };
    }
    const off = new Map(file.overrides.map((o) => [o.block, o.reason]));
    const runnable: SqlRunnableBlock[] = [];
    const labels: SqlLabel[] = [];
    const lessonVerdicts: BlockVerdict[] = [];
    for (const b of list) {
      const base = { id: b.id, lesson, index: b.index, firstLine: firstLine(b.code) };
      const sid = setupBlocks.get(b.index);
      if (sid) {
        lessonVerdicts.push({ ...base, category: 'setup', setup: sid.join(', ') });
        continue;
      }
      const setup = setupOf.get(b.index);
      const d = decide(SQL, { code: b.code, setupCode: setup ? setups[setup]!.code : '', forcedOff: off.get(b.index) });
      lessonVerdicts.push({ ...base, ...d, ...(setup ? { setup } : {}) });
      if (d.category === 'runnable') runnable.push({ index: b.index, hash: b.hash, id: b.id, ...(setup ? { setup } : {}), expected: d.expected! });
    }
    // labels: every T-SQL-only block on a page with Run buttons, and T-SQL-only queries anywhere; on pages with Run
    // buttons also the queries that run in SQLite but could give a different result, and the setup blocks
    const hasRun = runnable.length > 0;
    for (const v of lessonVerdicts) {
      const b = list[v.index - 1]!;
      const label = (kind: SqlLabel['kind'], construct: string, detail: string) => labels.push({ index: b.index, hash: b.hash, kind, construct, detail });
      if (v.category === 'tsql-only' && (hasRun || looksLikeQuery(b.code))) label('tsql-only', v.construct ?? '', v.detail ?? '');
      else if (hasRun && v.category === 'typing' && looksLikeQuery(b.code)) label('typing', v.construct ?? '', v.detail ?? '');
      else if (hasRun && v.category === 'setup') {
        const ids = setupBlocks.get(v.index) ?? [];
        const users = runnable.filter((r) => r.setup && ids.includes(r.setup)).map((r) => r.index);
        if (users.length) label('setup', v.setup ?? '', `Sample data for the runnable ${users.length === 1 ? 'query' : 'queries'} below (SQL blocks ${users.join(', ')}).`);
      }
    }
    // a setup may also feed queries that turn out T-SQL-only, but one that feeds no runnable query is a sign of drift
    for (const s of file.setups) {
      if (!runnable.some((r) => r.setup === s.id)) errors.push(`${where}: setup ${s.id} feeds no runnable query. Remove it, or check the blocks listed under uses (sqlrun-report.md says why each one isn't runnable).`);
    }
    verdicts.push(...lessonVerdicts);
    if (runnable.length || labels.length) lessons[lesson] = { setups: Object.fromEntries(Object.entries(setups).filter(([id]) => runnable.some((r) => r.setup === id))), blocks: runnable, labels };
  }
  return { verdicts, lessons };
}

function summarize(verdicts: BlockVerdict[], lessons: Record<string, LessonSqlRun>): SqlCheckSummary {
  const s: SqlCheckSummary = { blocks: verdicts.length, lessons: new Set(verdicts.map((v) => v.lesson)).size, runnable: 0, setups: 0, labelled: 0, byCategory: {}, byConstruct: {} };
  for (const v of verdicts) {
    s.byCategory[v.category] = (s.byCategory[v.category] ?? 0) + 1;
    if (v.category === 'runnable') s.runnable++;
    if (v.category === 'setup') s.setups++;
    if (v.category === 'tsql-only' || v.category === 'typing' || v.category === 'not-tsql') {
      const key = `${v.category}: ${v.construct}`;
      s.byConstruct[key] = (s.byConstruct[key] ?? 0) + 1;
    }
  }
  s.labelled = Object.values(lessons).reduce((n, l) => n + l.labels.filter((x) => x.kind === 'tsql-only').length, 0);
  return s;
}

function writeReport(verdicts: BlockVerdict[], summary: SqlCheckSummary): void {
  fs.writeFileSync(REPORT_JSON, JSON.stringify({ summary, blocks: verdicts.map((v) => ({ ...v, expected: undefined })) }, null, 1));
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/`/g, "'").replace(/\n/g, ' ');
  const lines = [
    '# Runnable SQL blocks',
    '',
    'Generated by `scripts/sqlrun/check.ts`. Every SQL block in the lessons, and whether it gets a Run button (sql.js).',
    '',
    `- SQL blocks: **${summary.blocks}** in ${summary.lessons} lessons`,
    `- Runnable: **${summary.runnable}**; setup blocks (sample data): ${summary.setups}`,
    `- Labelled "T-SQL only": **${summary.labelled}**`,
    '',
    '| Category | Blocks |',
    '|---|---|',
    ...Object.entries(summary.byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `| ${k} | ${n} |`),
    '',
    '| Construct | Blocks |',
    '|---|---|',
    ...Object.entries(summary.byConstruct)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `| ${esc(k)} | ${n} |`),
    '',
    '## Per block',
    '',
    '| Block | Verdict | Why | First line |',
    '|---|---|---|---|',
    ...verdicts.map((v) => `| \`${v.lesson}\` #${v.index} | ${v.category} | ${esc([v.construct, v.detail].filter(Boolean).join(': ').slice(0, 160))} | ${esc(v.firstLine.slice(0, 60))} |`),
    '',
  ];
  fs.writeFileSync(REPORT_MD, lines.join('\n'));
}

const require_ = createRequire(import.meta.url);
function engineInfo(SQL: SqlJsStatic): SqlRunData['engine'] {
  const dist = path.dirname(require_.resolve('sql.js/dist/sql-wasm-browser.js'));
  const pkg = JSON.parse(fs.readFileSync(path.join(dist, '..', 'package.json'), 'utf8')) as { version: string };
  const wasm = fs.readFileSync(path.join(dist, 'sql-wasm-browser.wasm'));
  const js = fs.readFileSync(path.join(dist, 'sql-wasm-browser.js'));
  const db = new SQL.Database();
  const sqlite = String(db.exec('SELECT sqlite_version()')[0]!.values[0]![0] as SqlValue);
  db.close();
  return { version: pkg.version, sqlite, wasmBytes: zlib.gzipSync(wasm).length + zlib.gzipSync(js).length };
}

export interface SqlCheckResult {
  ok: boolean;
  errors: string[];
  summary?: SqlCheckSummary;
}

export async function runSqlCheck(opts: { log?: (m: string) => void } = {}): Promise<SqlCheckResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const errors: string[] = [];
  const blocks = allSqlBlocks();
  const files = loadFiles(blocks, errors);
  if (errors.length) return { ok: false, errors };
  const SQL = await initSqlJs();
  const started = Date.now();
  const { verdicts, lessons } = checkLessons(SQL, blocks, files, errors);
  const summary = summarize(verdicts, lessons);
  const data: SqlRunData = { available: true, engine: engineInfo(SQL), lessons };
  fs.mkdirSync(OUT_DATA, { recursive: true });
  fs.writeFileSync(SQLRUN_JSON, JSON.stringify(data));
  writeReport(verdicts, summary);
  log(
    `sqlrun: ${summary.blocks} SQL blocks in ${summary.lessons} lessons → ${summary.runnable} runnable (sql.js ${data.engine!.version}, SQLite ${data.engine!.sqlite}), ` +
      `${summary.labelled} labelled T-SQL only; ${Object.entries(summary.byCategory)
        .filter(([k]) => k !== 'runnable')
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(', ')} (${Date.now() - started} ms). See sqlrun-report.md.`,
  );
  return { ok: errors.length === 0, errors, summary };
}

// CLI: tsx scripts/sqlrun/check.ts
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const r = await runSqlCheck();
  for (const e of r.errors) console.error(`• ${e}`);
  process.exit(r.ok ? 0 : 1);
}
