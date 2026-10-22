import { lines } from '../../engine/code';
import type { Counters, Prediction } from '../../engine/types';
import { countOptions, mkStep, ZERO, type Cell, type Mark, type SqlStage, type SqlStep, type TableView } from '../model';
import { CUSTOMERS, ORDERS, SQL, SUBQUERY_CUSTOMERS, SUBQUERY_ORDERS, type NoteSql, type Order } from '../notes';

/**
 * The logical processing order of a SELECT, from `4.SQL_JoinsNMore.md` › Why This Happens (Logical Order),
 * which follows Microsoft Learn's SELECT (Transact-SQL) page
 * (https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql#logical-processing-order-of-the-select-statement).
 * Each query below is from the notes and runs on the notes' sample data; every stage shows the working
 * table after it. Stages a query doesn't use pass the rows through unchanged.
 */
export const ALL_STAGES = ['FROM', 'ON', 'JOIN', 'WHERE', 'GROUP BY', 'WITH CUBE or WITH ROLLUP', 'HAVING', 'SELECT', 'DISTINCT', 'ORDER BY', 'TOP'] as const;
export type Stage = (typeof ALL_STAGES)[number];
/** The eight steps the site's plan names; the note's list adds JOIN, WITH CUBE or WITH ROLLUP and DISTINCT. */
export const CORE_STAGES: Stage[] = ['FROM', 'ON', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'ORDER BY', 'TOP'];
export const isExtra = (s: Stage) => !CORE_STAGES.includes(s);

export type QueryId = 'where-mistake' | 'on-fix' | 'distinct' | 'group-count' | 'apply-inner';

export interface QoData {
  orders: readonly Order[];
  /** Orders for the GROUP BY query (5.SQL_Subqueries.md's Orders table). */
  orders5: readonly { Id: number; CustomerId: number; Amount: number }[];
  /** The customer the APPLY subquery runs for. */
  applyCustomer: number;
}
export const NOTE_QO_DATA: QoData = { orders: ORDERS, orders5: SUBQUERY_ORDERS, applyCustomer: 1 };

export interface QoState extends SqlStage {
  /** Index into the stage list; -1 at the start, stages.length at the end. */
  stage: number;
  stages: Stage[];
  used: boolean[];
  clause: string | null;
}
export type QoTrace = SqlStep<QoState>[];

interface QueryDef {
  id: QueryId;
  label: string;
  sql: NoteSql;
  /** Where the data comes from, shown under the picker. */
  source: string;
  /** Clause text per stage (as written in the query) and the code-panel line it sits on. */
  clauses: Partial<Record<Stage, { text: string; marker: string }>>;
  /** Lines of the code panel outside the query that runs (the APPLY subquery runs alone). */
  faded?: number[];
}

export const QUERIES: Record<QueryId, QueryDef> = {
  'where-mistake': {
    id: 'where-mistake',
    label: 'LEFT JOIN + WHERE (the mistake)',
    sql: SQL.leftWhereMistake,
    source: "Customers and Orders from the joins note's sample data.",
    clauses: {
      FROM: { text: 'FROM Customers c LEFT JOIN Orders o', marker: 'FROM Customers c' },
      ON: { text: 'ON c.CustomerId = o.CustomerId', marker: 'ON c.CustomerId = o.CustomerId' },
      JOIN: { text: 'LEFT JOIN Orders o', marker: 'LEFT JOIN Orders o' },
      WHERE: { text: 'WHERE o.Amount > 60', marker: 'WHERE o.Amount > 60;' },
      SELECT: { text: 'SELECT c.Name, o.OrderId', marker: 'SELECT c.Name, o.OrderId' },
    },
  },
  'on-fix': {
    id: 'on-fix',
    label: 'Condition in ON (the fix)',
    sql: SQL.leftOnFix,
    source: "Customers and Orders from the joins note's sample data. The note doesn't print this query's result; it is computed here.",
    clauses: {
      FROM: { text: 'FROM Customers c LEFT JOIN Orders o', marker: 'FROM Customers c' },
      ON: { text: 'ON c.CustomerId = o.CustomerId\n   AND o.Amount > 60', marker: 'ON c.CustomerId = o.CustomerId' },
      JOIN: { text: 'LEFT JOIN Orders o', marker: 'LEFT JOIN Orders o' },
      SELECT: { text: 'SELECT c.Name, o.OrderId', marker: 'SELECT c.Name, o.OrderId' },
    },
  },
  distinct: {
    id: 'distinct',
    label: 'SELECT DISTINCT after INNER JOIN',
    sql: SQL.distinctJoin,
    source: "Customers and Orders from the joins note's sample data.",
    clauses: {
      FROM: { text: 'FROM Customers c INNER JOIN Orders o', marker: 'FROM Customers c' },
      ON: { text: 'ON c.CustomerId = o.CustomerId', marker: 'INNER JOIN Orders o ON' },
      JOIN: { text: 'INNER JOIN Orders o', marker: 'INNER JOIN Orders o ON' },
      SELECT: { text: 'SELECT c.CustomerId, c.Name', marker: 'SELECT DISTINCT c.CustomerId, c.Name' },
      DISTINCT: { text: 'DISTINCT', marker: 'SELECT DISTINCT c.CustomerId, c.Name' },
    },
  },
  'group-count': {
    id: 'group-count',
    label: 'LEFT JOIN + GROUP BY (execution plans note)',
    sql: SQL.groupCount,
    source: "From 7.SQL_ExecutionPlanNMore.md, run on the subqueries note's Customers (Aman, Rahul, Priya, Neha) and Orders. The note doesn't print the result; it is computed here.",
    clauses: {
      FROM: { text: 'FROM Customers c LEFT JOIN Orders o', marker: 'FROM Customers c' },
      ON: { text: 'ON o.CustomerId = c.Id', marker: 'LEFT JOIN Orders o ON o.CustomerId = c.Id' },
      JOIN: { text: 'LEFT JOIN Orders o', marker: 'LEFT JOIN Orders o ON o.CustomerId = c.Id' },
      'GROUP BY': { text: 'GROUP BY c.Id', marker: 'GROUP BY c.Id;' },
      SELECT: { text: 'SELECT c.Id, COUNT(o.Id) AS OrderCount', marker: 'SELECT c.Id, COUNT(o.Id) AS OrderCount' },
    },
  },
  'apply-inner': {
    id: 'apply-inner',
    label: "The OUTER APPLY subquery, for one customer",
    sql: SQL.outerApply,
    source: "The subquery inside the joins note's OUTER APPLY example, run for one customer on the note's Orders.",
    clauses: {
      FROM: { text: 'FROM Orders o', marker: 'FROM Orders o' },
      WHERE: { text: 'WHERE o.CustomerId = c.CustomerId', marker: 'WHERE o.CustomerId = c.CustomerId' },
      SELECT: { text: 'SELECT o.OrderId, o.Amount', marker: 'SELECT TOP(1) o.OrderId, o.Amount' },
      'ORDER BY': { text: 'ORDER BY o.OrderId DESC', marker: 'ORDER BY o.OrderId DESC' },
      TOP: { text: 'TOP(1)', marker: 'SELECT TOP(1) o.OrderId, o.Amount' },
    },
    faded: [1, 2, 3, 8],
  },
};
export const QUERY_ORDER: QueryId[] = ['where-mistake', 'on-fix', 'distinct', 'group-count', 'apply-inner'];

// ── a tiny relation type ────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  v: Cell[];
}
interface Rel {
  cols: string[];
  rows: Row[];
  decimals?: (number | undefined)[];
  groups?: { from: number; to: number; label: string }[];
}

const view = (id: string, caption: string, r: Rel, marks: (Mark | null)[] = [], notes: (string | null)[] = []): TableView => ({
  id,
  caption,
  columns: r.cols,
  rows: r.rows.map((x) => [...x.v]),
  rowIds: r.rows.map((x) => x.id),
  marks,
  notes,
  decimals: r.decimals,
  groups: r.groups,
  empty: 'No rows',
});

const fmt = (v: Cell) => (v === null ? 'NULL' : String(v));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

interface StageOut {
  tables: TableView[];
  narration: string;
  rowsAfter: number;
}

/** Runs one query through every stage of the full order. */
function runQuery(q: QueryDef, data: QoData): Record<Stage, StageOut> {
  const out = {} as Record<Stage, StageOut>;
  const pass = (stage: Stage, rel: Rel, caption: string) => {
    out[stage] = { tables: [view('work', caption, rel)], narration: `No ${stage} in this query: the ${plural(rel.rows.length, 'row')} pass through unchanged.`, rowsAfter: rel.rows.length };
  };

  if (q.id === 'apply-inner') {
    const cid = data.applyCustomer;
    const name = CUSTOMERS.find((c) => c.CustomerId === cid)?.Name ?? `customer ${cid}`;
    let rel: Rel = { cols: ['o.OrderId', 'o.CustomerId', 'o.Amount'], rows: data.orders.map((o) => ({ id: `o${o.OrderId}`, v: [o.OrderId, o.CustomerId, o.Amount] })), decimals: [undefined, undefined, 2] };
    out.FROM = { tables: [view('work', 'Orders o', rel)], narration: `FROM Orders o: the subquery reads Orders (${plural(rel.rows.length, 'row')}). It runs with c.CustomerId = ${cid} (${name}).`, rowsAfter: rel.rows.length };
    pass('ON', rel, 'Orders o');
    pass('JOIN', rel, 'Orders o');
    const keep = rel.rows.map((r) => r.v[1] === cid);
    out.WHERE = {
      tables: [view('work', 'After WHERE', rel, keep.map((k) => (k ? 'settled' : 'removed')), rel.rows.map((r, i) => `${r.v[1]} = ${cid} is ${keep[i] ? 'true' : 'false'}`))],
      narration: `WHERE o.CustomerId = c.CustomerId with c.CustomerId = ${cid}: ${plural(keep.filter(Boolean).length, 'order')} kept, ${keep.filter((k) => !k).length} removed.`,
      rowsAfter: keep.filter(Boolean).length,
    };
    rel = { ...rel, rows: rel.rows.filter((_, i) => keep[i]) };
    pass('GROUP BY', rel, 'After WHERE');
    pass('WITH CUBE or WITH ROLLUP', rel, 'After WHERE');
    pass('HAVING', rel, 'After WHERE');
    rel = { cols: ['OrderId', 'Amount'], rows: rel.rows.map((r) => ({ id: r.id, v: [r.v[0]!, r.v[2]!] })), decimals: [undefined, 2] };
    out.SELECT = { tables: [view('work', 'After SELECT', rel)], narration: 'SELECT o.OrderId, o.Amount picks the two columns. TOP(1) is written in the SELECT clause, but it is applied last.', rowsAfter: rel.rows.length };
    pass('DISTINCT', rel, 'After SELECT');
    rel = { ...rel, rows: [...rel.rows].sort((a, b) => Number(b.v[0]) - Number(a.v[0])) };
    out['ORDER BY'] = { tables: [view('work', 'After ORDER BY', rel)], narration: `ORDER BY o.OrderId DESC sorts newest first: ${rel.rows.map((r) => r.v[0]).join(', ') || 'no rows'}.`, rowsAfter: rel.rows.length };
    const top = rel.rows.slice(0, 1);
    out.TOP = {
      tables: [view('work', 'After TOP(1)', rel, rel.rows.map((_, i) => (i === 0 ? 'settled' : 'removed')))],
      narration: top.length ? `TOP(1) keeps only the first row: order ${top[0]!.v[0]}, ${name}'s latest order.` : `There are no rows, so TOP(1) returns nothing (OUTER APPLY would then fill NULLs).`,
      rowsAfter: top.length,
    };
    return out;
  }

  // queries over two tables
  const five = q.id === 'group-count';
  const left: Rel = five
    ? { cols: ['c.Id', 'c.Name'], rows: SUBQUERY_CUSTOMERS.map((c) => ({ id: `c${c.Id}`, v: [c.Id, c.Name] })) }
    : { cols: ['c.CustomerId', 'c.Name'], rows: CUSTOMERS.map((c) => ({ id: `c${c.CustomerId}`, v: [c.CustomerId, c.Name] })) };
  const right: Rel = five
    ? { cols: ['o.Id', 'o.CustomerId', 'o.Amount'], rows: data.orders5.map((o) => ({ id: `o${o.Id}`, v: [o.Id, o.CustomerId, o.Amount] })) }
    : { cols: ['o.OrderId', 'o.CustomerId', 'o.Amount'], rows: data.orders.map((o) => ({ id: `o${o.OrderId}`, v: [o.OrderId, o.CustomerId, o.Amount] })), decimals: [undefined, undefined, 2] };
  out.FROM = {
    tables: [view('left', five ? 'Customers c' : 'Customers c', left), view('right', 'Orders o', right)],
    narration: `FROM names the inputs: Customers c (${plural(left.rows.length, 'row')}) and Orders o (${plural(right.rows.length, 'row')}).`,
    rowsAfter: left.rows.length * right.rows.length,
  };
  const cols = [...left.cols, ...right.cols];
  const decimals = [undefined, undefined, ...(right.decimals ?? [])];
  const onTrue = (c: Row, o: Row) => o.v[1] === c.v[0] && (q.id !== 'on-fix' || Number(o.v[2]) > 60);
  const pairs: Row[] = [];
  for (const c of left.rows) for (const o of right.rows) if (onTrue(c, o)) pairs.push({ id: `${c.id}-${o.id}`, v: [...c.v, ...o.v] });
  const onText = q.id === 'on-fix' ? 'ON c.CustomerId = o.CustomerId AND o.Amount > 60' : five ? 'ON o.CustomerId = c.Id' : 'ON c.CustomerId = o.CustomerId';
  out.ON = {
    tables: [view('work', 'After ON', { cols, rows: pairs, decimals })],
    narration: `${onText} is checked for every customer and order pair (${left.rows.length * right.rows.length} pairs): ${plural(pairs.length, 'pair')} ${pairs.length === 1 ? 'matches' : 'match'}.`,
    rowsAfter: pairs.length,
  };
  let rel: Rel = { cols, rows: [...pairs], decimals };
  if (q.id === 'distinct') {
    out.JOIN = { tables: [view('work', 'After INNER JOIN', rel)], narration: 'INNER JOIN keeps only matched pairs, so nothing is added.', rowsAfter: rel.rows.length };
  } else {
    const added: Row[] = left.rows.filter((c) => !pairs.some((p) => p.id.startsWith(`${c.id}-`))).map((c) => ({ id: `${c.id}-null`, v: [...c.v, null, null, null] }));
    // keep customers in their original order
    const rows = left.rows.flatMap((c) => [...pairs.filter((p) => p.id.startsWith(`${c.id}-`)), ...added.filter((a) => a.id === `${c.id}-null`)]);
    rel = { cols, rows, decimals };
    out.JOIN = {
      tables: [view('work', 'After LEFT JOIN', rel, rows.map((r) => (added.includes(r) ? 'write' : null)))],
      narration: added.length ? `LEFT JOIN adds back the customers with no match, with NULL in the Orders columns: ${added.map((a) => a.v[1]).join(', ')}.` : 'LEFT JOIN: every customer matched, so no NULL rows are added.',
      rowsAfter: rows.length,
    };
  }
  if (q.id === 'where-mistake') {
    const amountAt = cols.indexOf('o.Amount');
    const verdict = rel.rows.map((r) => {
      const a = r.v[amountAt];
      return a === null ? { keep: false, note: 'NULL > 60 is UNKNOWN' } : { keep: Number(a) > 60, note: `${Number(a).toFixed(2)} > 60 is ${Number(a) > 60 ? 'true' : 'false'}` };
    });
    const nullsLost = rel.rows.filter((r, i) => r.v[amountAt] === null && !verdict[i]!.keep).map((r) => r.v[1]);
    out.WHERE = {
      tables: [view('work', 'After WHERE', rel, verdict.map((x) => (x.keep ? 'settled' : 'removed')), verdict.map((x) => x.note))],
      narration: `WHERE o.Amount > 60 runs after the join and keeps only rows where it is true.` + (nullsLost.length ? ` For ${nullsLost.join(', ')}, NULL > 60 is UNKNOWN, so the row LEFT JOIN created is filtered out: the LEFT JOIN behaves like an INNER JOIN.` : ''),
      rowsAfter: verdict.filter((x) => x.keep).length,
    };
    rel = { ...rel, rows: rel.rows.filter((_, i) => verdict[i]!.keep) };
  } else pass('WHERE', rel, out.JOIN.tables[0]!.caption);

  if (q.id === 'group-count') {
    const keys = [...new Set(rel.rows.map((r) => r.v[0]))];
    const rows = keys.flatMap((k) => rel.rows.filter((r) => r.v[0] === k));
    let at = 0;
    const groups = keys.map((k) => {
      const n = rel.rows.filter((r) => r.v[0] === k).length;
      const g = { from: at, to: at + n - 1, label: `c.Id = ${fmt(k)} (${plural(n, 'row')})` };
      at += n;
      return g;
    });
    rel = { ...rel, rows, groups };
    out['GROUP BY'] = { tables: [view('work', 'After GROUP BY', rel)], narration: `GROUP BY c.Id makes ${plural(groups.length, 'group')}, one per customer. Each group becomes one row after SELECT.`, rowsAfter: groups.length };
  } else pass('GROUP BY', rel, out.WHERE.tables[0]!.caption.replace('After WHERE', 'After WHERE'));
  pass('WITH CUBE or WITH ROLLUP', rel, out['GROUP BY'].tables[0]!.caption);
  pass('HAVING', rel, out['GROUP BY'].tables[0]!.caption);

  if (q.id === 'group-count') {
    const oId = cols.indexOf('o.Id');
    const sel: Rel = {
      cols: ['Id', 'OrderCount'],
      rows: (rel.groups ?? []).map((g) => {
        const members = rel.rows.slice(g.from, g.to + 1);
        return { id: `g${members[0]!.v[0]}`, v: [members[0]!.v[0]!, members.filter((m) => m.v[oId] !== null).length] };
      }),
    };
    out.SELECT = { tables: [view('work', 'After SELECT', sel)], narration: 'SELECT c.Id, COUNT(o.Id) AS OrderCount gives one row per group. COUNT(o.Id) counts only non-NULL values, so customers with no orders get 0.', rowsAfter: sel.rows.length };
    rel = sel;
  } else {
    const pick = q.id === 'distinct' ? ['c.CustomerId', 'c.Name'] : ['c.Name', 'o.OrderId'];
    const idx = pick.map((c) => cols.indexOf(c));
    const sel: Rel = { cols: pick.map((c) => c.split('.')[1]!), rows: rel.rows.map((r) => ({ id: r.id, v: idx.map((k) => r.v[k]!) })) };
    out.SELECT = { tables: [view('work', 'After SELECT', sel)], narration: `${q.clauses.SELECT!.text} keeps just ${pick.join(' and ')}.`, rowsAfter: sel.rows.length };
    rel = sel;
  }
  if (q.id === 'distinct') {
    const seen = new Set<string>();
    const dup = rel.rows.map((r) => {
      const k = JSON.stringify(r.v);
      const d = seen.has(k);
      seen.add(k);
      return d;
    });
    out.DISTINCT = {
      tables: [view('work', 'After DISTINCT', rel, dup.map((d) => (d ? 'removed' : null)), dup.map((d) => (d ? 'duplicate' : null)))],
      narration: dup.some(Boolean) ? `DISTINCT removes duplicate rows: ${rel.rows.filter((_, i) => dup[i]).map((r) => r.v.map(fmt).join(' ')).join('; ')}. Each customer now appears once, however many orders they have.` : 'DISTINCT finds no duplicate rows.',
      rowsAfter: dup.filter((d) => !d).length,
    };
    rel = { ...rel, rows: rel.rows.filter((_, i) => !dup[i]) };
  } else pass('DISTINCT', rel, 'After SELECT');
  pass('ORDER BY', rel, out.DISTINCT.tables[0]!.caption);
  pass('TOP', rel, out.DISTINCT.tables[0]!.caption);
  return out;
}

/** The query's result table after its last stage. */
export function queryResult(id: QueryId, data: QoData = NOTE_QO_DATA): Cell[][] {
  const out = runQuery(QUERIES[id], data);
  const last = out.TOP.tables[0]!;
  return last.rows.filter((_, i) => last.marks?.[i] !== 'removed');
}

export function traceQueryOrder(id: QueryId, stagesIn: readonly string[] = ALL_STAGES, data: QoData = NOTE_QO_DATA): QoTrace {
  const q = QUERIES[id];
  const stages = stagesIn.filter((s): s is Stage => (ALL_STAGES as readonly string[]).includes(s));
  const code = q.sql.code;
  const out = runQuery(q, data);
  const lineOf = (s: Stage) => {
    const c = q.clauses[s];
    return c ? [lines(code, { l: c.marker }).l] : [];
  };
  const used = stages.map((s) => Boolean(q.clauses[s]));
  const steps: QoTrace = [];
  const c: Counters = { ...ZERO };
  const st = (stage: number, tables: TableView[], codeLines: number[], clause: string | null): QoState => ({ tables, code: { block: 0, lines: codeLines }, stage, stages, used, clause });

  steps.push(mkStep(st(-1, out.FROM.tables, [], null), 'start', `The query is written SELECT first, but SQL Server processes its clauses in a fixed logical order: ${stages.join(' → ')}. ${q.source}`, { query: q.label }, c));
  stages.forEach((s, i) => {
    const o = out[s];
    const clause = q.clauses[s]?.text ?? null;
    if (clause) c.comparisons++;
    c.reads++;
    steps.push(mkStep(st(i, o.tables, lineOf(s), clause), clause ? 'select' : 'branch', `${isExtra(s) ? `${s} is one of the extra steps in the note's full list. ` : ''}${o.narration}`, { stage: `${i + 1} of ${stages.length}`, 'rows after': o.rowsAfter }, c));
  });
  const last = out[stages[stages.length - 1] ?? 'TOP'];
  const finalRows = queryResult(id, data);
  const result: TableView = { id: 'work', caption: 'Result', columns: last.tables[0]!.columns, rows: finalRows, decimals: last.tables[0]!.decimals, marks: finalRows.map(() => 'settled' as Mark) };
  steps.push(mkStep(st(stages.length, [result], [], null), 'done', `Done: ${plural(finalRows.length, 'row')}.${id === 'where-mistake' ? ' This is the note\'s result: Carol disappeared because WHERE ran after the LEFT JOIN.' : ''}`, { rows: finalRows.length }, c));

  // predict mode: before a stage that changes the row count, ask how many rows it leaves
  stages.forEach((s, i) => {
    if (!q.clauses[s] || s === 'FROM' || s === 'SELECT') return;
    const before = i === 0 ? 0 : out[stages[i - 1]!].rowsAfter;
    const after = out[s].rowsAfter;
    if (before === after && s !== 'WHERE') return;
    const o = countOptions(after);
    const predict: Prediction = { question: `How many rows will be left after ${s}?`, options: o.options, answer: o.answer };
    steps[i]!.predict = predict; // the step before stage i (steps[0] is the start step)
  });
  return steps;
}
