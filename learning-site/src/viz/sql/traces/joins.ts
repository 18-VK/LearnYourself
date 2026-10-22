import { lines } from '../../engine/code';
import type { Counters, Prediction } from '../../engine/types';
import { countOptions, mkStep, ZERO, type Cell, type Mark, type SqlStage, type SqlStep, type TableView } from '../model';
import { CUSTOMERS, ORDERS, SELF_EMPLOYEES, SQL, type Customer, type Order, type SelfEmployee } from '../notes';

/**
 * Row-by-row join traces over the joins note's sample data. Each join is walked as nested loops over the
 * two tables in the note's row order, which reproduces the note's result tables row for row. (The engine
 * may pick another physical join; the rows are the same, and without ORDER BY their order isn't promised.)
 */
export type JoinKind = 'inner' | 'left' | 'right' | 'full' | 'cross' | 'self' | 'outer-apply' | 'cross-apply' | 'anti' | 'anti-exists';

export const JOIN_KINDS: JoinKind[] = ['inner', 'left', 'right', 'full', 'cross', 'self', 'outer-apply', 'cross-apply', 'anti', 'anti-exists'];

export const JOIN_LABEL: Record<JoinKind, string> = {
  inner: 'INNER JOIN',
  left: 'LEFT JOIN',
  right: 'RIGHT JOIN',
  full: 'FULL OUTER JOIN',
  cross: 'CROSS JOIN',
  self: 'SELF JOIN',
  'outer-apply': 'OUTER APPLY',
  'cross-apply': 'CROSS APPLY',
  anti: 'Anti-join: LEFT JOIN + IS NULL',
  'anti-exists': 'Anti-join: NOT EXISTS',
};

export const JOIN_SQL: Record<JoinKind, string> = {
  inner: SQL.inner.code,
  left: SQL.left.code,
  right: SQL.right.code,
  full: SQL.full.code,
  cross: SQL.cross.code,
  self: SQL.self.code,
  'outer-apply': SQL.outerApply.code,
  'cross-apply': SQL.crossApply.code,
  anti: SQL.antiLeft.code,
  'anti-exists': SQL.antiNotExists.code,
};

export interface JoinData {
  customers: readonly Customer[];
  orders: readonly Order[];
  employees: readonly SelfEmployee[];
}
export const NOTE_JOIN_DATA: JoinData = { customers: CUSTOMERS, orders: ORDERS, employees: SELF_EMPLOYEES };

export type JoinState = SqlStage;
export type JoinTrace = SqlStep<JoinState>[];

const RESULT_COLS = ['CustomerId', 'Name', 'OrderId', 'Amount'];
const DEC2 = [undefined, undefined, undefined, 2];

type Vars = Record<string, string | number | boolean>;

class Recorder {
  readonly steps: JoinTrace = [];
  readonly c: Counters = { ...ZERO };
  readonly rows: Cell[][] = [];
  readonly rowIds: string[] = [];
  /** Extra tables (APPLY subquery output, the LEFT JOIN before WHERE) shown between the inputs and the result. */
  middle: TableView | null = null;

  constructor(
    readonly code: string,
    readonly cols: string[],
    readonly decimals: (number | undefined)[],
  ) {}

  add(row: Cell[], id: string): void {
    this.rows.push(row);
    this.rowIds.push(id);
    this.c.writes++;
  }

  result(justAdded: boolean, caption = 'Result'): TableView {
    const marks = this.rows.map((_, i) => (justAdded && i === this.rows.length - 1 ? 'write' : null) as Mark | null);
    return { id: 'result', caption, columns: this.cols, rows: this.rows.map((r) => [...r]), rowIds: [...this.rowIds], marks, decimals: this.decimals, empty: 'No rows yet' };
  }

  step(inputs: TableView[], lineNos: number[], action: SqlStep['action'], narration: string, vars: Vars, opts: { added?: boolean; predict?: Prediction } = {}): void {
    const tables = [...inputs, ...(this.middle ? [this.middle] : []), this.result(Boolean(opts.added))];
    this.steps.push(mkStep({ tables, code: { block: 0, lines: lineNos } }, action, narration, vars, this.c, opts.predict));
  }
}

const customersView = (cs: readonly Customer[], marks: (Mark | null)[]): TableView => ({
  id: 'left',
  caption: 'Customers c',
  columns: ['CustomerId', 'Name'],
  rows: cs.map((c) => [c.CustomerId, c.Name]),
  rowIds: cs.map((c) => `c${c.CustomerId}`),
  marks,
});
const ordersView = (os: readonly Order[], marks: (Mark | null)[]): TableView => ({
  id: 'right',
  caption: 'Orders o',
  columns: ['OrderId', 'CustomerId', 'Amount'],
  rows: os.map((o) => [o.OrderId, o.CustomerId, o.Amount]),
  rowIds: os.map((o) => `o${o.OrderId}`),
  marks,
  decimals: [undefined, undefined, 2],
});

const marksFor = (n: number, map: Record<number, Mark>, rest: Mark | null = null): (Mark | null)[] => Array.from({ length: n }, (_, i) => map[i] ?? rest);
const amt = (v: number) => v.toFixed(2);
const who = (c: Customer) => `${c.Name} (CustomerId ${c.CustomerId})`;

function countQuestion(subject: string, answer: number): Prediction {
  const o = countOptions(answer);
  return { question: `How many result rows will ${subject} produce?`, options: o.options, answer: o.answer };
}

// ── INNER / LEFT / FULL (left table drives) and RIGHT (right table drives) ────────────────────

function traceEquiJoin(kind: 'inner' | 'left' | 'right' | 'full', data: JoinData): JoinTrace {
  const code = JOIN_SQL[kind];
  const joinMarker = { inner: 'INNER JOIN Orders o', left: 'LEFT JOIN Orders o', right: 'RIGHT JOIN Orders o', full: 'FULL OUTER JOIN Orders o' }[kind];
  const L = lines(code, { select: 'SELECT c.CustomerId', from: 'FROM Customers c', join: joinMarker, on: 'ON c.CustomerId = o.CustomerId' });
  const r = new Recorder(code, RESULT_COLS, DEC2);
  const { customers: cs, orders: os } = data;
  const label = JOIN_LABEL[kind];
  const keepsLeft = kind === 'left' || kind === 'full';

  r.step(
    [customersView(cs, []), ordersView(os, [])],
    [L.from, L.join],
    'start',
    kind === 'right'
      ? `FROM Customers c ${label} Orders o. RIGHT JOIN keeps every row of the right table (Orders), so this walk takes each order in turn and looks for its customer.`
      : `FROM Customers c ${label} Orders o. The walk takes each customer in turn and checks the ON condition against every order.`,
    {},
  );

  if (kind === 'right') {
    for (let j = 0; j < os.length; j++) {
      const o = os[j]!;
      r.c.reads++;
      const matchesFor = cs.filter((c) => c.CustomerId === o.CustomerId).length;
      r.step([customersView(cs, []), ordersView(os, marksFor(os.length, { [j]: 'active' }))], [L.join], 'select', `Take order ${o.OrderId} (CustomerId ${o.CustomerId}). Look for customers with the same CustomerId.`, { 'o.OrderId': o.OrderId, 'o.CustomerId': o.CustomerId }, { predict: countQuestion(`order ${o.OrderId}`, Math.max(1, matchesFor)) });
      let matches = 0;
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i]!;
        r.c.reads++;
        r.c.comparisons++;
        const hit = c.CustomerId === o.CustomerId;
        const om = marksFor(os.length, { [j]: 'active' });
        r.step([customersView(cs, marksFor(cs.length, { [i]: 'compare' })), ordersView(os, om)], [L.on], 'compare', `ON c.CustomerId = o.CustomerId: ${c.CustomerId} = ${o.CustomerId} is ${hit ? 'true, so the pair joins' : 'false'}.`, { 'o.OrderId': o.OrderId, 'o.CustomerId': o.CustomerId, 'c.CustomerId': c.CustomerId, matches });
        if (hit) {
          matches++;
          r.add([c.CustomerId, c.Name, o.OrderId, o.Amount], `${c.CustomerId}-${o.OrderId}`);
          r.step([customersView(cs, marksFor(cs.length, { [i]: 'settled' })), ordersView(os, om)], [L.select], 'write', `Add ${c.Name} with order ${o.OrderId} (${amt(o.Amount)}) to the result.`, { 'o.OrderId': o.OrderId, 'c.CustomerId': c.CustomerId, matches }, { added: true });
        }
      }
      if (matches === 0) {
        r.add([null, null, o.OrderId, o.Amount], `null-${o.OrderId}`);
        r.step([customersView(cs, []), ordersView(os, marksFor(os.length, { [j]: 'active' }))], [L.join], 'write', `No customer has CustomerId ${o.CustomerId}. RIGHT JOIN keeps order ${o.OrderId} anyway and fills the Customers columns with NULL.`, { 'o.OrderId': o.OrderId, matches }, { added: true });
      }
    }
  } else {
    const matchedRight = new Set<number>();
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!;
      r.c.reads++;
      const answer = os.filter((o) => o.CustomerId === c.CustomerId).length || (keepsLeft ? 1 : 0);
      const settledRight = (): Record<number, Mark> => (kind === 'full' ? Object.fromEntries([...matchedRight].map((k) => [k, 'settled' as Mark])) : {});
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, marksFor(os.length, settledRight()))], [L.from], 'select', `Take ${who(c)}. Check the ON condition against every order.`, { 'c.CustomerId': c.CustomerId, 'c.Name': c.Name }, { predict: countQuestion(c.Name, answer) });
      let matches = 0;
      for (let j = 0; j < os.length; j++) {
        const o = os[j]!;
        r.c.reads++;
        r.c.comparisons++;
        const hit = c.CustomerId === o.CustomerId;
        r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, marksFor(os.length, { ...settledRight(), [j]: 'compare' }))], [L.on], 'compare', `ON c.CustomerId = o.CustomerId: ${c.CustomerId} = ${o.CustomerId} is ${hit ? `true, so ${c.Name} joins order ${o.OrderId}` : 'false'}.`, { 'c.CustomerId': c.CustomerId, 'o.OrderId': o.OrderId, 'o.CustomerId': o.CustomerId, matches });
        if (hit) {
          matches++;
          matchedRight.add(j);
          r.add([c.CustomerId, c.Name, o.OrderId, o.Amount], `${c.CustomerId}-${o.OrderId}`);
          r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, marksFor(os.length, { ...settledRight(), [j]: 'settled' }))], [L.select], 'write', `Add ${c.Name} with order ${o.OrderId} (${amt(o.Amount)}) to the result.`, { 'c.CustomerId': c.CustomerId, 'o.OrderId': o.OrderId, matches }, { added: true });
        }
      }
      if (matches === 0 && keepsLeft) {
        r.add([c.CustomerId, c.Name, null, null], `${c.CustomerId}-null`);
        r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, marksFor(os.length, settledRight()))], [L.join], 'write', `No order matched ${c.Name}. ${label} keeps every customer, so ${c.Name} is added with NULL in the Orders columns.`, { 'c.CustomerId': c.CustomerId, matches }, { added: true });
      } else if (matches === 0) {
        r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, [])], [L.join], 'branch', `No order matched ${c.Name}, so INNER JOIN leaves ${c.Name} out.`, { 'c.CustomerId': c.CustomerId, matches });
      } else {
        r.step([customersView(cs, marksFor(cs.length, { [i]: 'settled' })), ordersView(os, marksFor(os.length, settledRight()))], [L.on], 'settle', `${c.Name} matched ${matches} order${matches === 1 ? '' : 's'}, so ${c.Name} appears ${matches === 1 ? 'once' : `${matches} times`}.`, { 'c.CustomerId': c.CustomerId, matches });
      }
    }
    if (kind === 'full') {
      const leftovers = os.map((o, j) => ({ o, j })).filter(({ j }) => !matchedRight.has(j));
      const settled = Object.fromEntries([...matchedRight].map((k) => [k, 'settled' as Mark]));
      r.step([customersView(cs, []), ordersView(os, marksFor(os.length, settled))], [L.join], 'branch', leftovers.length ? `Every customer is done. FULL OUTER JOIN also keeps orders that matched no customer: ${leftovers.map(({ o }) => o.OrderId).join(', ')}.` : 'Every customer is done, and every order matched a customer, so nothing is left over.', { leftovers: leftovers.length });
      for (const { o, j } of leftovers) {
        r.step([customersView(cs, []), ordersView(os, marksFor(os.length, { ...settled, [j]: 'active' }))], [L.join], 'select', `Order ${o.OrderId} (CustomerId ${o.CustomerId}) matched no customer.`, { 'o.OrderId': o.OrderId, 'o.CustomerId': o.CustomerId }, { predict: { question: `Is order ${o.OrderId} in the FULL OUTER JOIN result?`, options: ['Yes, with NULL customer columns', 'No, it is dropped'], answer: 0 } });
        r.add([null, null, o.OrderId, o.Amount], `null-${o.OrderId}`);
        r.step([customersView(cs, []), ordersView(os, marksFor(os.length, { ...settled, [j]: 'active' }))], [L.join], 'write', `Add order ${o.OrderId} with NULL in the Customers columns.`, { 'o.OrderId': o.OrderId }, { added: true });
      }
    }
  }
  const unmatched = (kind === 'inner' || kind === 'left') ? os.filter((o) => !cs.some((c) => c.CustomerId === o.CustomerId)) : [];
  r.step(
    [customersView(cs, []), ordersView(os, [])],
    [L.select],
    'done',
    `Done: ${r.rows.length} row${r.rows.length === 1 ? '' : 's'}.` + (unmatched.length ? ` Order${unmatched.length === 1 ? '' : 's'} ${unmatched.map((o) => o.OrderId).join(', ')} matched no customer, so ${unmatched.length === 1 ? 'it is' : 'they are'} not in a ${label} result.` : ''),
    {},
  );
  return r.steps;
}

// ── CROSS JOIN ─────────────────────────────────────────────────────────────────────────────

function traceCross(data: JoinData): JoinTrace {
  const code = JOIN_SQL.cross;
  const L = lines(code, { select: 'SELECT c.Name, o.OrderId', from: 'FROM Customers c', join: 'CROSS JOIN Orders o;' });
  const r = new Recorder(code, ['Name', 'OrderId'], []);
  const { customers: cs, orders: os } = data;
  r.step([customersView(cs, []), ordersView(os, [])], [L.from, L.join], 'start', `CROSS JOIN has no ON condition: every customer is paired with every order. ${cs.length} customers × ${os.length} orders = ${cs.length * os.length} rows.`, { customers: cs.length, orders: os.length });
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    r.c.reads++;
    r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, [])], [L.from], 'select', `Take ${who(c)}.`, { 'c.Name': c.Name }, { predict: countQuestion(c.Name, os.length) });
    for (let j = 0; j < os.length; j++) {
      const o = os[j]!;
      r.c.reads++;
      r.add([c.Name, o.OrderId], `${c.CustomerId}-${o.OrderId}`);
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, marksFor(os.length, { [j]: 'settled' }))], [L.join, L.select], 'write', `Pair ${c.Name} with order ${o.OrderId}. No condition is checked, so every pair is kept.`, { 'c.Name': c.Name, 'o.OrderId': o.OrderId }, { added: true });
    }
  }
  r.step([customersView(cs, []), ordersView(os, [])], [L.select], 'done', `Done: ${r.rows.length} rows, one for every customer and order pair. The query selects c.Name and o.OrderId, so those are the result's columns.`, {});
  return r.steps;
}

// ── SELF JOIN ──────────────────────────────────────────────────────────────────────────────

const empView = (id: string, caption: string, es: readonly SelfEmployee[], marks: (Mark | null)[]): TableView => ({
  id,
  caption,
  columns: ['EmpId', 'Name', 'ManagerId'],
  rows: es.map((e) => [e.EmpId, e.Name, e.ManagerId]),
  rowIds: es.map((e) => `${id}${e.EmpId}`),
  marks,
});

function traceSelf(data: JoinData): JoinTrace {
  const code = JOIN_SQL.self;
  const L = lines(code, { select: 'SELECT e.Name AS Employee', from: 'FROM Employees e', join: 'LEFT JOIN Employees m', on: 'ON e.ManagerId = m.EmpId' });
  const r = new Recorder(code, ['Employee', 'Manager'], []);
  const es = data.employees;
  const views = (eMarks: Record<number, Mark>, mMarks: Record<number, Mark>) => [empView('left', 'Employees e', es, marksFor(es.length, eMarks)), empView('right', 'Employees m', es, marksFor(es.length, mMarks))];
  r.step(views({}, {}), [L.from, L.join], 'start', 'The same Employees table is used twice: as e (each employee) and as m (a possible manager). The ON condition looks for the row whose EmpId equals e.ManagerId.', {});
  for (let i = 0; i < es.length; i++) {
    const e = es[i]!;
    r.c.reads++;
    const answer = 1; // LEFT JOIN on a key: one manager row or one NULL row
    r.step(views({ [i]: 'active' }, {}), [L.from], 'select', `Take ${e.Name} (EmpId ${e.EmpId}, ManagerId ${e.ManagerId ?? 'NULL'}).`, { 'e.Name': e.Name, 'e.ManagerId': e.ManagerId ?? 'NULL' }, { predict: countQuestion(e.Name, es.filter((m) => e.ManagerId !== null && m.EmpId === e.ManagerId).length || answer) });
    let matches = 0;
    for (let j = 0; j < es.length; j++) {
      const m = es[j]!;
      r.c.reads++;
      r.c.comparisons++;
      const unknown = e.ManagerId === null;
      const hit = !unknown && e.ManagerId === m.EmpId;
      r.step(
        views({ [i]: 'active' }, { [j]: 'compare' }),
        [L.on],
        'compare',
        unknown ? `ON e.ManagerId = m.EmpId: NULL = ${m.EmpId} is UNKNOWN, not true, so no match.` : `ON e.ManagerId = m.EmpId: ${e.ManagerId} = ${m.EmpId} is ${hit ? `true, so ${m.Name} is ${e.Name}'s manager` : 'false'}.`,
        { 'e.Name': e.Name, 'e.ManagerId': e.ManagerId ?? 'NULL', 'm.EmpId': m.EmpId, matches },
      );
      if (hit) {
        matches++;
        r.add([e.Name, m.Name], `${e.EmpId}-${m.EmpId}`);
        r.step(views({ [i]: 'active' }, { [j]: 'settled' }), [L.select], 'write', `Add ${e.Name} with manager ${m.Name}.`, { 'e.Name': e.Name, 'm.Name': m.Name, matches }, { added: true });
      }
    }
    if (matches === 0) {
      r.add([e.Name, null], `${e.EmpId}-null`);
      r.step(views({ [i]: 'active' }, {}), [L.join], 'write', `No row matched, and LEFT JOIN keeps ${e.Name} anyway: Manager is NULL.`, { 'e.Name': e.Name, matches }, { added: true });
    }
  }
  r.step(views({}, {}), [L.select], 'done', `Done: ${r.rows.length} rows, every employee with their manager's name (NULL when there is none).`, {});
  return r.steps;
}

// ── OUTER APPLY / CROSS APPLY ──────────────────────────────────────────────────────────────

function traceApply(kind: 'outer-apply' | 'cross-apply', data: JoinData): JoinTrace {
  const outer = kind === 'outer-apply';
  const code = JOIN_SQL[kind];
  const L = lines(code, {
    select: 'SELECT c.CustomerId',
    from: 'FROM Customers c',
    apply: outer ? 'OUTER APPLY (' : 'CROSS APPLY (',
    top: 'SELECT TOP(1)',
    subFrom: 'FROM Orders o',
    where: 'WHERE o.CustomerId = c.CustomerId',
    order: 'ORDER BY o.OrderId DESC',
    alias: ') lo;',
  });
  const r = new Recorder(code, RESULT_COLS, DEC2);
  const { customers: cs, orders: os } = data;
  const sub = (rows: Order[], marks: (Mark | null)[], caption: string): TableView => ({
    id: 'sub',
    caption,
    columns: ['OrderId', 'Amount'],
    rows: rows.map((o) => [o.OrderId, o.Amount]),
    rowIds: rows.map((o) => `s${o.OrderId}`),
    marks,
    decimals: [undefined, 2],
    empty: 'No rows',
  });
  r.step([customersView(cs, []), ordersView(os, [])], [L.from, L.apply], 'start', `${outer ? 'OUTER' : 'CROSS'} APPLY runs the subquery once per customer, with c.CustomerId set to that customer's id. ${outer ? 'Customers whose subquery returns nothing are kept with NULLs (like a LEFT JOIN).' : 'Customers whose subquery returns nothing are removed (like an INNER JOIN).'}`, {});
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    r.c.reads++;
    const mine = os.filter((o) => o.CustomerId === c.CustomerId).sort((a, b) => b.OrderId - a.OrderId);
    const options = [...os.map((o) => `Order ${o.OrderId}`), 'No rows'];
    r.middle = sub([], [], `lo, for c.CustomerId = ${c.CustomerId}`);
    r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, [])], [L.apply, L.top], 'call', `Run the subquery for ${who(c)}.`, { 'c.CustomerId': c.CustomerId }, { predict: { question: `What does the subquery return for ${c.Name}?`, options, answer: mine.length ? os.findIndex((o) => o.OrderId === mine[0]!.OrderId) : options.length - 1 } });
    const found: Order[] = [];
    for (let j = 0; j < os.length; j++) {
      const o = os[j]!;
      r.c.reads++;
      r.c.comparisons++;
      const hit = o.CustomerId === c.CustomerId;
      if (hit) found.push(o);
      r.middle = sub(found, found.map(() => null), `lo, for c.CustomerId = ${c.CustomerId}`);
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, marksFor(os.length, { [j]: hit ? 'settled' : 'compare' }))], [L.where], 'compare', `WHERE o.CustomerId = c.CustomerId: ${o.CustomerId} = ${c.CustomerId} is ${hit ? `true, so order ${o.OrderId} qualifies` : 'false'}.`, { 'c.CustomerId': c.CustomerId, 'o.OrderId': o.OrderId, 'o.CustomerId': o.CustomerId });
    }
    const sorted = [...found].sort((a, b) => b.OrderId - a.OrderId);
    if (sorted.length) {
      r.middle = sub(sorted, sorted.map((_, k) => (k === 0 ? 'settled' : 'removed')), `lo, for c.CustomerId = ${c.CustomerId}`);
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, [])], [L.order, L.top], 'select', `ORDER BY o.OrderId DESC puts ${sorted.map((o) => o.OrderId).join(', ')} in that order, and TOP(1) keeps only ${sorted[0]!.OrderId}: ${c.Name}'s latest order.`, { 'c.CustomerId': c.CustomerId, 'lo.OrderId': sorted[0]!.OrderId });
      const top = sorted[0]!;
      r.middle = sub([top], ['settled'], `lo, for c.CustomerId = ${c.CustomerId}`);
      r.add([c.CustomerId, c.Name, top.OrderId, top.Amount], `${c.CustomerId}-${top.OrderId}`);
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'settled' })), ordersView(os, [])], [L.select], 'write', `Add ${c.Name} with order ${top.OrderId} (${amt(top.Amount)}).`, { 'c.CustomerId': c.CustomerId, 'lo.OrderId': top.OrderId }, { added: true });
    } else if (outer) {
      r.add([c.CustomerId, c.Name, null, null], `${c.CustomerId}-null`);
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, [])], [L.apply], 'write', `The subquery returned no rows for ${c.Name}. OUTER APPLY keeps ${c.Name} with NULL for lo.OrderId and lo.Amount.`, { 'c.CustomerId': c.CustomerId }, { added: true });
    } else {
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, [])], [L.apply], 'branch', `The subquery returned no rows for ${c.Name}, so CROSS APPLY removes ${c.Name}.`, { 'c.CustomerId': c.CustomerId });
    }
  }
  r.middle = null;
  r.step([customersView(cs, []), ordersView(os, [])], [L.select], 'done', `Done: ${r.rows.length} rows, the most recent order per customer${outer ? ' (NULL where a customer has none)' : ''}.`, {});
  return r.steps;
}

// ── Anti-joins ─────────────────────────────────────────────────────────────────────────────

function traceAntiLeft(data: JoinData): JoinTrace {
  const code = JOIN_SQL.anti;
  const L = lines(code, { select: 'SELECT c.CustomerId, c.Name', from: 'FROM Customers c', join: 'LEFT JOIN Orders o ON', where: 'WHERE o.OrderId IS NULL;' });
  const r = new Recorder(code, ['CustomerId', 'Name'], []);
  const { customers: cs, orders: os } = data;
  const joined: { row: Cell[]; id: string }[] = [];
  const joinedView = (marks: (Mark | null)[], notes: (string | null)[] = []): TableView => ({
    id: 'joined',
    caption: 'After LEFT JOIN (before WHERE)',
    columns: ['CustomerId', 'Name', 'OrderId'],
    rows: joined.map((j) => [...j.row]),
    rowIds: joined.map((j) => j.id),
    marks,
    notes,
    empty: 'No rows yet',
  });
  r.step([customersView(cs, []), ordersView(os, [])], [L.from, L.join], 'start', 'Step 1: the LEFT JOIN pairs customers with their orders and keeps customers with none, with NULL in the Orders columns. Step 2: WHERE o.OrderId IS NULL keeps only those NULL rows.', {});
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    r.c.reads++;
    let matches = 0;
    for (let j = 0; j < os.length; j++) {
      const o = os[j]!;
      r.c.reads++;
      r.c.comparisons++;
      const hit = o.CustomerId === c.CustomerId;
      if (hit) {
        matches++;
        joined.push({ row: [c.CustomerId, c.Name, o.OrderId], id: `${c.CustomerId}-${o.OrderId}` });
      }
      r.middle = joinedView(joined.map((_, k) => (hit && k === joined.length - 1 ? 'write' : null)));
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, marksFor(os.length, { [j]: hit ? 'settled' : 'compare' }))], [L.join], 'compare', `ON c.CustomerId = o.CustomerId: ${c.CustomerId} = ${o.CustomerId} is ${hit ? `true, so ${c.Name} joins order ${o.OrderId}` : 'false'}.`, { 'c.CustomerId': c.CustomerId, 'o.OrderId': o.OrderId, matches });
    }
    if (matches === 0) {
      joined.push({ row: [c.CustomerId, c.Name, null], id: `${c.CustomerId}-null` });
      r.middle = joinedView(joined.map((_, k) => (k === joined.length - 1 ? 'write' : null)));
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, [])], [L.join], 'branch', `No order matched ${c.Name}, so the LEFT JOIN keeps ${c.Name} with o.OrderId = NULL.`, { 'c.CustomerId': c.CustomerId, matches });
    }
  }
  const notes: (string | null)[] = joined.map(() => null);
  const marks: (Mark | null)[] = joined.map(() => null);
  for (let k = 0; k < joined.length; k++) {
    const j = joined[k]!;
    const isNull = j.row[2] === null;
    r.c.comparisons++;
    marks[k] = 'compare';
    r.middle = joinedView([...marks], [...notes]);
    r.step([customersView(cs, []), ordersView(os, [])], [L.where], 'compare', `WHERE o.OrderId IS NULL for ${j.row[1]} with OrderId ${j.row[2] ?? 'NULL'}.`, { 'c.Name': String(j.row[1]), 'o.OrderId': j.row[2] ?? 'NULL' }, { predict: { question: `Does ${j.row[1]}'s row (OrderId ${j.row[2] ?? 'NULL'}) pass WHERE o.OrderId IS NULL?`, options: ['Yes, keep it', 'No, filter it out'], answer: isNull ? 0 : 1 } });
    marks[k] = isNull ? 'settled' : 'removed';
    notes[k] = isNull ? 'IS NULL is true' : `${j.row[2]} is not NULL`;
    if (isNull) r.add([j.row[0]!, j.row[1]!], `r${j.id}`);
    r.middle = joinedView([...marks], [...notes]);
    r.step([customersView(cs, []), ordersView(os, [])], [isNull ? L.select : L.where], isNull ? 'write' : 'branch', isNull ? `${j.row[1]} has no order: keep CustomerId ${j.row[0]}, ${j.row[1]}.` : `OrderId ${j.row[2]} is not NULL, so this row is filtered out.`, { 'c.Name': String(j.row[1]) }, { added: isNull });
  }
  r.step([customersView(cs, []), ordersView(os, [])], [L.select], 'done', `Done: ${r.rows.length ? r.rows.map((x) => `${x[1]} (CustomerId ${x[0]})`).join(', ') : 'no customer'} ${r.rows.length === 1 ? 'has' : 'have'} no orders.`, {});
  return r.steps;
}

function traceNotExists(data: JoinData): JoinTrace {
  const code = JOIN_SQL['anti-exists'];
  const L = lines(code, { select: 'SELECT c.CustomerId, c.Name', from: 'FROM Customers c', where: 'WHERE NOT EXISTS (', sub: 'SELECT 1 FROM Orders o WHERE o.CustomerId = c.CustomerId' });
  const r = new Recorder(code, ['CustomerId', 'Name'], []);
  const { customers: cs, orders: os } = data;
  r.step([customersView(cs, []), ordersView(os, [])], [L.from, L.where], 'start', 'For each customer, NOT EXISTS runs the subquery and asks one question: is there at least one matching order? The search stops at the first match.', {});
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    r.c.reads++;
    const has = os.some((o) => o.CustomerId === c.CustomerId);
    r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, [])], [L.where], 'call', `Take ${who(c)}.`, { 'c.CustomerId': c.CustomerId }, { predict: { question: `Will NOT EXISTS keep ${c.Name}?`, options: ['Yes', 'No'], answer: has ? 1 : 0 } });
    let found = false;
    for (let j = 0; j < os.length && !found; j++) {
      const o = os[j]!;
      r.c.reads++;
      r.c.comparisons++;
      found = o.CustomerId === c.CustomerId;
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'active' })), ordersView(os, marksFor(os.length, { [j]: found ? 'settled' : 'compare' }))], [L.sub], 'compare', found ? `o.CustomerId = c.CustomerId: ${o.CustomerId} = ${c.CustomerId} is true. A row exists, so the search stops here.` : `o.CustomerId = c.CustomerId: ${o.CustomerId} = ${c.CustomerId} is false.`, { 'c.CustomerId': c.CustomerId, 'o.OrderId': o.OrderId });
    }
    if (found) {
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'removed' })), ordersView(os, [])], [L.where], 'branch', `EXISTS is true for ${c.Name}, so NOT EXISTS is false: ${c.Name} is not returned.`, { 'c.CustomerId': c.CustomerId });
    } else {
      r.add([c.CustomerId, c.Name], `r${c.CustomerId}`);
      r.step([customersView(cs, marksFor(cs.length, { [i]: 'settled' })), ordersView(os, [])], [L.select], 'write', `No order has CustomerId ${c.CustomerId}. NOT EXISTS is true, so ${c.Name} is returned.`, { 'c.CustomerId': c.CustomerId }, { added: true });
    }
  }
  r.step([customersView(cs, []), ordersView(os, [])], [L.select], 'done', `Done: ${r.rows.length ? r.rows.map((x) => `${x[1]} (CustomerId ${x[0]})`).join(', ') : 'no customer'}. Each customer appears at most once, however many orders match.`, {});
  return r.steps;
}

export function traceJoin(kind: JoinKind, data: JoinData = NOTE_JOIN_DATA): JoinTrace {
  switch (kind) {
    case 'inner':
    case 'left':
    case 'right':
    case 'full':
      return traceEquiJoin(kind, data);
    case 'cross':
      return traceCross(data);
    case 'self':
      return traceSelf(data);
    case 'outer-apply':
    case 'cross-apply':
      return traceApply(kind, data);
    case 'anti':
      return traceAntiLeft(data);
    case 'anti-exists':
      return traceNotExists(data);
  }
}

/** The result table at the end of a trace. */
export function finalResult(trace: JoinTrace): TableView {
  return trace[trace.length - 1]!.state.tables.find((t) => t.id === 'result')!;
}
