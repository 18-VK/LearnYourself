import type { Counters, Prediction, Step } from '../../engine/types';
import { ZERO } from '../model';
import { SUBQUERY_ORDERS } from '../notes';
import { FLOW, setLevel, STMT, type Level, type Provenance, type StatementText } from './isolation-sql';

/**
 * A two-session lock and row-version simulator for the scenarios in `10.SQL_Transactions&Concurrency.md`.
 *
 * The rules come from the SQL Server docs, kept to what the note's examples need
 * (https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql):
 * - Writes always take an exclusive (X) lock held until the transaction ends, at every isolation level.
 * - READ UNCOMMITTED reads take no shared locks and are not blocked by X locks, so they can read
 *   uncommitted changes (dirty reads).
 * - READ COMMITTED (READ_COMMITTED_SNAPSHOT OFF, the SQL Server default, which is what the note's
 *   "Session 2 waits" describes) takes a shared (S) lock to read a row, waits behind an X lock, and
 *   releases the S lock as soon as the row is read.
 * - REPEATABLE READ holds its S locks until the transaction ends, so others can't modify rows it read,
 *   but they can insert new rows that match its search condition (phantoms).
 * - SERIALIZABLE places range locks on the key range its search condition covers, which blocks other
 *   transactions from inserting rows into that range until it ends.
 * - SNAPSHOT takes no locks to read; it reads the committed data as of the start of the transaction
 *   (a transaction starts the first time it accesses data). Writers don't block it and it doesn't block
 *   writers. (The database also needs ALLOW_SNAPSHOT_ISOLATION ON.)
 * Deadlocks (https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-deadlocks-guide):
 * the lock monitor finds the cycle, picks a victim (lower DEADLOCK_PRIORITY first, then the transaction
 * that is cheapest to roll back, and at random when those are equal, as in the note's example), rolls the
 * victim's transaction back, releases its locks and returns error 1205; the other session continues.
 */

export type Sess = 'A' | 'B';
export type Anomaly = 'dirty' | 'nonrepeatable' | 'phantom';
export type Scenario = Anomaly | 'blocking' | 'deadlock';
export const ANOMALIES: Anomaly[] = ['dirty', 'nonrepeatable', 'phantom'];
export const ANOMALY_LABEL: Record<Anomaly, string> = { dirty: 'Dirty read', nonrepeatable: 'Non-repeatable read', phantom: 'Phantom read' };
/** Column headers of the note's isolation table, per anomaly. */
export const ANOMALY_COLUMN: Record<Anomaly, string> = { dirty: 'Dirty Read', nonrepeatable: 'Non-Repeatable Read', phantom: 'Phantom Read' };

export interface IsoOptions {
  scenario: Scenario;
  /** The isolation level of the reading session (anomalies) or of Session 2 (blocking). */
  level?: Level;
  /** How the writing session ends (dirty read: Session A; blocking: Session 1). */
  ending?: 'commit' | 'rollback';
  /** Deadlock: which session SQL Server picks as the victim. */
  victim?: Sess;
  /** Deadlock: both sessions update the rows in the same order (the note's first prevention tip). */
  sameOrder?: boolean;
}

type LockMode = 'S' | 'X' | 'Range S';
interface Lock {
  res: string;
  mode: LockMode;
  s: Sess;
}
interface OrderRow {
  Id: number;
  CustomerId: number;
  Amount: number;
}

type Op =
  | { k: 'set'; level: Level }
  | { k: 'begin' }
  | { k: 'read'; id: number }
  | { k: 'count' }
  | { k: 'update'; id: number; value: number }
  | { k: 'insert'; row: OrderRow }
  | { k: 'commit' }
  | { k: 'rollback' };

interface Line {
  s: Sess;
  stmt: StatementText;
  op: Op;
  /** Ask a predict-mode question before this statement runs. */
  ask?: 'read' | 'reread' | 'write';
  /** Line of the note's flow diagram this statement acts out. */
  flow?: [block: number, line: number];
}

export interface TimelineRow {
  s: Sess;
  code: string;
  prov: Provenance;
  kind: 'run' | 'wait' | 'resume' | 'error';
  out: string;
  /** Sessions still waiting when this row happened (drawn as a waiting bar in their column). */
  waiting: Sess[];
}

export interface IsoState {
  rows: TimelineRow[];
  /** Row this step is about (-1 before anything runs or on a pre-statement step). */
  current: number;
  /** The statement each session runs next (faded preview); `upNext` is the one about to run. */
  next: Partial<Record<Sess, { code: string; prov: Provenance; waiting: boolean }>>;
  upNext: Sess | null;
  accounts: { id: number; committed: number; pending: { value: number; by: Sess } | null }[];
  orders: (OrderRow & { pendingBy: Sess | null })[] | null;
  locks: { res: string; mode: LockMode; s: Sess; waiting: boolean }[];
  waits: { from: Sess; to: Sess; res: string }[];
  cycle: boolean;
  victim: Sess | null;
  flow: [block: number, line: number] | null;
  levels: Record<Sess, Level>;
  outcome: { happened: boolean; text: string } | null;
}

export type IsoStep = Step<IsoState>;

export interface IsoResult {
  steps: IsoStep[];
  /** Did the scenario's anomaly happen (anomaly scenarios), was there blocking, or a deadlock. */
  happened: boolean;
  reads: { s: Sess; value: number; dirty: boolean }[];
}

/** Display names: the anomaly examples say Txn A / Txn B, the blocking and deadlock ones Session 1 / Session 2. */
export function sessionNames(scenario: Scenario): Record<Sess, string> {
  return scenario === 'blocking' || scenario === 'deadlock' ? { A: 'Session 1', B: 'Session 2' } : { A: 'Session A', B: 'Session B' };
}

/** Starting balances are illustrative: the note's examples don't give them. */
export const START_BALANCE = 1000;

// ── scripts ──────────────────────────────────────────────────────────────────────────────

function script(o: Required<Pick<IsoOptions, 'scenario' | 'level' | 'ending' | 'sameOrder'>>): Line[] {
  const L = (s: Sess, stmt: StatementText, op: Op, extra: Partial<Line> = {}): Line => ({ s, stmt, op, ...extra });
  const end = (s: Sess, how: 'commit' | 'rollback', extra: Partial<Line> = {}) => L(s, how === 'commit' ? STMT.commit : STMT.rollback, { k: how }, extra);
  switch (o.scenario) {
    case 'dirty':
      return [
        L('A', STMT.beginTransaction, { k: 'begin' }),
        L('A', STMT.update500, { k: 'update', id: 1, value: 500 }),
        L('B', setLevel(o.level), { k: 'set', level: o.level }),
        L('B', STMT.selectRow, { k: 'read', id: 1 }, { ask: 'read' }),
        { ...end('A', o.ending), stmt: { ...(o.ending === 'commit' ? STMT.commit : STMT.rollback), prov: 'added' } },
      ];
    case 'nonrepeatable':
      return [
        L('A', setLevel(o.level), { k: 'set', level: o.level }),
        L('A', STMT.beginTran, { k: 'begin' }),
        L('A', STMT.selectRow, { k: 'read', id: 1 }),
        L('B', STMT.beginTran, { k: 'begin' }),
        L('B', STMT.update500, { k: 'update', id: 1, value: 500 }, { ask: 'write' }),
        end('B', 'commit'),
        L('A', STMT.selectRow, { k: 'read', id: 1 }, { ask: 'reread' }),
        end('A', 'commit'),
      ];
    case 'phantom':
      return [
        L('A', setLevel(o.level), { k: 'set', level: o.level }),
        L('A', STMT.beginTran, { k: 'begin' }),
        L('A', STMT.countOrders, { k: 'count' }),
        L('B', STMT.beginTran, { k: 'begin' }),
        L('B', STMT.insertOrder, { k: 'insert', row: { Id: 4, CustomerId: 3, Amount: 500 } }, { ask: 'write' }),
        end('B', 'commit'),
        L('A', STMT.countOrders, { k: 'count' }, { ask: 'reread' }),
        end('A', 'commit'),
      ];
    case 'blocking': {
      const lines: Line[] = [L('A', STMT.beginTran, { k: 'begin' }), L('A', STMT.blockingUpdate, { k: 'update', id: 1, value: 500 }, { flow: [0, 1] })];
      // Session 2 runs at the default level in the note; another level needs a SET first.
      if (o.level !== 'READ COMMITTED') lines.push(L('B', setLevel(o.level), { k: 'set', level: o.level }));
      lines.push(L('B', STMT.selectRow, { k: 'read', id: 1 }, { ask: 'read', flow: [0, 2] }));
      lines.push(o.ending === 'commit' ? L('A', STMT.commit, { k: 'commit' }, { flow: [0, 3] }) : L('A', { ...STMT.rollback, prov: 'added' }, { k: 'rollback' }));
      return lines;
    }
    case 'deadlock':
      return o.sameOrder
        ? [
            L('A', STMT.beginTran, { k: 'begin' }),
            L('A', STMT.dl100, { k: 'update', id: 1, value: 100 }),
            L('B', STMT.beginTran, { k: 'begin' }),
            L('B', STMT.dl400, { k: 'update', id: 1, value: 400 }, { ask: 'write' }),
            L('A', STMT.dl300, { k: 'update', id: 2, value: 300 }),
            L('A', { ...STMT.commit, prov: 'added' }, { k: 'commit' }),
            L('B', STMT.dl200, { k: 'update', id: 2, value: 200 }),
            L('B', { ...STMT.commit, prov: 'added' }, { k: 'commit' }),
          ]
        : [
            L('A', STMT.beginTran, { k: 'begin' }),
            L('A', STMT.dl100, { k: 'update', id: 1, value: 100 }),
            L('B', STMT.beginTran, { k: 'begin' }),
            L('B', STMT.dl200, { k: 'update', id: 2, value: 200 }),
            L('A', STMT.dl300, { k: 'update', id: 2, value: 300 }, { ask: 'write', flow: [0, 1] }),
            L('B', STMT.dl400, { k: 'update', id: 1, value: 400 }, { ask: 'write', flow: [0, 2] }),
            L('A', { ...STMT.commit, prov: 'added' }, { k: 'commit' }),
            L('B', { ...STMT.commit, prov: 'added' }, { k: 'commit' }),
          ];
  }
}

// ── the simulator ────────────────────────────────────────────────────────────────────────

const RANGE = 'Orders range: Amount>100';
const rowRes = (id: number) => `Accounts Id = ${id}`;
const orderRes = (id: number) => `Orders Id = ${id}`;
const conflicts = (a: LockMode, b: LockMode) => a === 'X' || b === 'X';

interface SessionState {
  level: Level;
  inTxn: boolean;
  snapshot: { accounts: Map<number, number>; orders: OrderRow[] } | null;
  waiting: { line: Line; reqs: { res: string; mode: LockMode }[]; blockers: Sess[] } | null;
  victim: boolean;
}

export function traceIsolation(opts: IsoOptions): IsoResult {
  const o = { scenario: opts.scenario, level: opts.level ?? 'READ COMMITTED', ending: opts.ending ?? 'rollback', sameOrder: Boolean(opts.sameOrder) };
  if (o.scenario === 'blocking' && !opts.ending) o.ending = 'commit';
  const victimPick: Sess = opts.victim ?? 'B';
  const names = sessionNames(o.scenario);
  const lines = script(o);

  const accounts = new Map<number, { committed: number; pending: { value: number; by: Sess } | null }>();
  const accountIds = o.scenario === 'deadlock' ? [1, 2] : o.scenario === 'phantom' ? [] : [1];
  for (const id of accountIds) accounts.set(id, { committed: START_BALANCE, pending: null });
  const orders: (OrderRow & { pendingBy: Sess | null })[] | null = o.scenario === 'phantom' ? SUBQUERY_ORDERS.map((r) => ({ ...r, pendingBy: null })) : null;
  let locks: Lock[] = [];
  const S: Record<Sess, SessionState> = {
    A: { level: 'READ COMMITTED', inTxn: false, snapshot: null, waiting: null, victim: false },
    B: { level: 'READ COMMITTED', inTxn: false, snapshot: null, waiting: null, victim: false },
  };
  const rows: TimelineRow[] = [];
  const steps: IsoStep[] = [];
  const counters: Counters = { ...ZERO }; // comparisons = lock waits, swaps = deadlocks, writes = statements run
  const reads: IsoResult['reads'] = [];
  let firstRead: number | null = null;
  let anomaly = false;
  let blocked = false;
  let deadlocked = false;
  let cycle = false;
  let victim: Sess | null = null;
  let flow: [number, number] | null = null;
  const pending = [...lines];

  const waitingSessions = () => (['A', 'B'] as Sess[]).filter((s) => S[s].waiting);
  const nextFor = (s: Sess) => {
    if (S[s].victim) return undefined;
    const w = S[s].waiting;
    if (w) return { code: w.line.stmt.code, prov: w.line.stmt.prov, waiting: true };
    const l = pending.find((x) => x.s === s);
    return l ? { code: l.stmt.code, prov: l.stmt.prov, waiting: false } : undefined;
  };

  const snapshotState = (current: number, upNext: Sess | null, outcome: IsoState['outcome'] = null): IsoState => {
    const waits = waitingSessions().flatMap((s) => S[s].waiting!.blockers.map((b) => ({ from: s, to: b, res: S[s].waiting!.reqs[0]!.res })));
    const next: IsoState['next'] = {};
    for (const s of ['A', 'B'] as Sess[]) {
      const n = nextFor(s);
      if (n) next[s] = n;
    }
    return {
      rows: rows.map((r) => ({ ...r, waiting: [...r.waiting] })),
      current,
      next,
      upNext,
      accounts: [...accounts].map(([id, a]) => ({ id, committed: a.committed, pending: a.pending ? { ...a.pending } : null })),
      orders: orders ? orders.map((r) => ({ ...r })) : null,
      locks: [
        ...locks.map((l) => ({ ...l, waiting: false })),
        ...waitingSessions().flatMap((s) => S[s].waiting!.reqs.map((r) => ({ res: r.res, mode: r.mode, s, waiting: true }))),
      ],
      waits,
      cycle,
      victim,
      flow,
      levels: { A: S.A.level, B: S.B.level },
      outcome,
    };
  };
  const push = (action: IsoStep['action'], narration: string, current: number, upNext: Sess | null = null, predict?: Prediction, outcome: IsoState['outcome'] = null) => {
    const vars: Record<string, string | number | boolean> = {};
    vars[`${names.A} level`] = S.A.level;
    vars[`${names.B} level`] = S.B.level;
    for (const [id, a] of accounts) vars[`Balance (Id ${id})`] = a.pending ? `${a.committed} committed, ${a.pending.value} uncommitted` : a.committed;
    if (orders) vars['Committed orders'] = orders.filter((r) => !r.pendingBy).length;
    const step: IsoStep = { state: snapshotState(current, upNext, outcome), highlights: {}, action, codeLine: 1, narration, variables: vars, counters: { ...counters } };
    if (predict) step.predict = predict;
    steps.push(step);
    return step;
  };
  const addRow = (s: Sess, line: Line, kind: TimelineRow['kind'], out: string) => {
    rows.push({ s, code: line.stmt.code, prov: line.stmt.prov, kind, out, waiting: waitingSessions().filter((w) => w !== s) });
    return rows.length - 1;
  };

  /** Locks of other sessions that conflict with these requests. */
  const blockersOf = (s: Sess, reqs: { res: string; mode: LockMode }[]): Sess[] => {
    const out = new Set<Sess>();
    for (const r of reqs) for (const l of locks) if (l.s !== s && l.res === r.res && conflicts(l.mode, r.mode)) out.add(l.s);
    return [...out];
  };
  const grant = (s: Sess, reqs: { res: string; mode: LockMode }[]) => {
    for (const r of reqs) if (!locks.some((l) => l.s === s && l.res === r.res && (l.mode === r.mode || l.mode === 'X'))) locks.push({ s, ...r });
  };
  const release = (s: Sess) => {
    locks = locks.filter((l) => l.s !== s);
  };
  const takeSnapshot = (s: Sess) => {
    if (S[s].level !== 'SNAPSHOT' || S[s].snapshot) return;
    S[s].snapshot = { accounts: new Map([...accounts].map(([id, a]) => [id, a.committed])), orders: (orders ?? []).filter((r) => !r.pendingBy).map((r) => ({ ...r })) };
  };
  const endStatement = (s: Sess) => {
    // outside an explicit transaction every statement is its own transaction (auto-commit)
    if (!S[s].inTxn) {
      release(s);
      S[s].snapshot = null;
    }
  };

  /** Lock requests a statement needs at its session's level. */
  const requests = (s: Sess, op: Op): { res: string; mode: LockMode }[] => {
    const lvl = S[s].level;
    switch (op.k) {
      case 'read':
        return lvl === 'READ UNCOMMITTED' || lvl === 'SNAPSHOT' ? [] : [{ res: rowRes(op.id), mode: 'S' }];
      case 'count':
        if (lvl === 'READ UNCOMMITTED' || lvl === 'SNAPSHOT') return [];
        if (lvl === 'SERIALIZABLE') return [{ res: RANGE, mode: 'Range S' }];
        return (orders ?? []).filter((r) => r.Amount > 100 && !r.pendingBy).map((r) => ({ res: orderRes(r.Id), mode: 'S' as LockMode }));
      case 'update':
        return [{ res: rowRes(op.id), mode: 'X' }];
      case 'insert':
        return [{ res: orderRes(op.row.Id), mode: 'X' }, ...(op.row.Amount > 100 ? [{ res: RANGE, mode: 'X' as LockMode }] : [])];
      default:
        return [];
    }
  };

  /** Runs a statement whose locks are granted. Returns the timeline text. */
  const execute = (s: Sess, line: Line, reqs: { res: string; mode: LockMode }[]): string => {
    const op = line.op;
    const st = S[s];
    counters.writes++;
    switch (op.k) {
      case 'set':
        st.level = op.level;
        return `level = ${op.level}`;
      case 'begin':
        st.inTxn = true;
        return 'transaction started';
      case 'read': {
        takeSnapshot(s);
        const a = accounts.get(op.id)!;
        let value: number;
        let dirty = false;
        if (st.level === 'SNAPSHOT') value = st.snapshot!.accounts.get(op.id)!;
        else if (a.pending && (a.pending.by === s || st.level === 'READ UNCOMMITTED')) {
          value = a.pending.value;
          dirty = a.pending.by !== s;
        } else value = a.committed;
        if (st.level === 'REPEATABLE READ' || st.level === 'SERIALIZABLE') grant(s, reqs);
        reads.push({ s, value, dirty });
        if (dirty) anomaly ||= o.scenario === 'dirty';
        if (o.scenario === 'nonrepeatable' && s === 'A') {
          if (firstRead === null) firstRead = value;
          else if (value !== firstRead) anomaly = true;
        }
        endStatement(s);
        return `Balance = ${value}${dirty ? ' (uncommitted)' : ''}`;
      }
      case 'count': {
        takeSnapshot(s);
        const rowsSeen = st.level === 'SNAPSHOT' ? st.snapshot!.orders : (orders ?? []).filter((r) => !r.pendingBy || r.pendingBy === s || st.level === 'READ UNCOMMITTED');
        const n = rowsSeen.filter((r) => r.Amount > 100).length;
        if (st.level === 'REPEATABLE READ' || st.level === 'SERIALIZABLE') grant(s, reqs);
        reads.push({ s, value: n, dirty: false });
        if (firstRead === null) firstRead = n;
        else if (n !== firstRead) anomaly = true;
        endStatement(s);
        return `COUNT(*) = ${n}`;
      }
      case 'update': {
        grant(s, reqs);
        accounts.get(op.id)!.pending = { value: op.value, by: s };
        return `Balance (Id ${op.id}) = ${op.value}, not committed yet`;
      }
      case 'insert': {
        grant(s, reqs.filter((r) => r.res !== RANGE));
        orders!.push({ ...op.row, pendingBy: s });
        return `order ${op.row.Id} (Amount ${op.row.Amount}) inserted, not committed yet`;
      }
      case 'commit':
      case 'rollback': {
        const commit = op.k === 'commit';
        for (const a of accounts.values()) {
          if (a.pending?.by !== s) continue;
          if (commit) a.committed = a.pending.value;
          a.pending = null;
        }
        if (orders) {
          for (let k = orders.length - 1; k >= 0; k--) {
            if (orders[k]!.pendingBy !== s) continue;
            if (commit) orders[k]!.pendingBy = null;
            else orders.splice(k, 1);
          }
        }
        release(s);
        st.inTxn = false;
        st.snapshot = null;
        return commit ? 'committed, locks released' : 'rolled back, locks released';
      }
    }
  };

  const describeWait = (s: Sess, blockers: Sess[], reqs: { res: string; mode: LockMode }[]) => {
    const held = locks.find((l) => blockers.includes(l.s) && reqs.some((r) => r.res === l.res));
    const need = reqs.find((r) => held && r.res === held.res) ?? reqs[0]!;
    return { need, held };
  };

  const modeName = (m: LockMode) => (m === 'S' ? 'shared (S)' : m === 'X' ? 'exclusive (X)' : 'range');

  /** Try the statement; returns true if it ran, false if the session now waits. */
  const attempt = (line: Line, resumed: boolean): boolean => {
    const s = line.s;
    const reqs = requests(s, line.op);
    const blockers = blockersOf(s, reqs);
    if (blockers.length === 0) {
      S[s].waiting = null;
      if (line.flow && !resumed) flow = line.flow;
      const out = execute(s, line, reqs);
      const idx = addRow(s, line, resumed ? 'resume' : 'run', out);
      push(line.op.k === 'commit' || line.op.k === 'rollback' ? 'settle' : line.op.k === 'read' || line.op.k === 'count' ? 'read' : 'write', narrateRun(line, out, resumed), idx);
      return true;
    }
    // must wait
    const { need, held } = describeWait(s, blockers, reqs);
    S[s].waiting = { line, reqs, blockers };
    counters.comparisons++;
    blocked = true;
    if (line.flow) flow = line.flow;
    const blockerName = names[blockers[0]!];
    const idx = addRow(s, line, 'wait', `waiting for ${blockerName}`);
    const cyc = blockers.some((b) => S[b].waiting?.blockers.includes(s));
    push(
      'compare',
      `${names[s]} needs a ${modeName(need.mode)} lock on ${need.res}, but ${blockerName} holds ${held ? `an ${modeName(held.mode)} lock` : 'a conflicting lock'} on it. ${names[s]} waits.` + (cyc ? ` And ${blockerName} is already waiting for ${names[s]}: neither can continue.` : ''),
      idx,
    );
    if (cyc) resolveDeadlock();
    return false;
  };

  const resolveDeadlock = () => {
    deadlocked = true;
    cycle = true;
    counters.swaps++;
    flow = [1, 1];
    push('compare', `Circular dependency: ${names.A} waits for ${names.B} and ${names.B} waits for ${names.A}. SQL Server's lock monitor detects the cycle and picks one session as the deadlock victim.`, rows.length - 1);
    const v = victimPick;
    victim = v;
    const vl = S[v].waiting!.line;
    S[v].waiting = null;
    S[v].victim = true;
    // the victim's batch ends and its transaction is rolled back
    for (const a of accounts.values()) if (a.pending?.by === v) a.pending = null;
    release(v);
    S[v].inTxn = false;
    for (let k = pending.length - 1; k >= 0; k--) if (pending[k]!.s === v) pending.splice(k, 1);
    flow = [2, 1];
    rows.push({ s: v, code: vl.stmt.code, prov: vl.stmt.prov, kind: 'error', out: FLOW.deadlockError.code, waiting: waitingSessions().filter((w) => w !== v) });
    push('swap', `${names[v]} is the victim: its transaction is rolled back, its locks are released and it gets the error "${FLOW.deadlockError.code}". The application should retry it.`, rows.length - 1);
    wake();
  };

  const wake = () => {
    for (const s of ['A', 'B'] as Sess[]) {
      const w = S[s].waiting;
      if (!w) continue;
      if (blockersOf(s, w.reqs).length === 0) {
        if (o.scenario === 'blocking') flow = [0, 4];
        attempt(w.line, true);
      }
    }
  };

  const narrateRun = (line: Line, out: string, resumed: boolean): string => {
    const s = line.s;
    const who = names[s];
    const op = line.op;
    const pre = resumed ? `The lock is free now, so ${who}'s waiting statement runs: ` : '';
    switch (op.k) {
      case 'set':
        return `${who} sets its isolation level to ${op.level}.` + (op.level === 'SNAPSHOT' ? ' (SNAPSHOT also needs the database option ALLOW_SNAPSHOT_ISOLATION ON.)' : '');
      case 'begin':
        return `${who} starts a transaction. Its changes stay invisible to committed readers until it commits.`;
      case 'read': {
        const lvl = S[s].level;
        const how =
          lvl === 'READ UNCOMMITTED'
            ? 'READ UNCOMMITTED takes no shared lock and ignores exclusive locks, so it reads the newest value, committed or not.'
            : lvl === 'SNAPSHOT'
              ? 'SNAPSHOT takes no lock: it reads the committed version from when its transaction started.'
              : lvl === 'READ COMMITTED'
                ? 'READ COMMITTED takes a shared lock just long enough to read the committed row, then releases it.'
                : `${lvl} takes a shared lock and keeps it until the transaction ends, so nobody can change this row meanwhile.`;
        return `${pre}${who} reads: ${out}. ${how}`;
      }
      case 'count': {
        const lvl = S[s].level;
        const how =
          lvl === 'SERIALIZABLE'
            ? 'SERIALIZABLE locks the range of rows that match Amount>100 until the transaction ends, so no one can insert into it.'
            : lvl === 'REPEATABLE READ'
              ? 'REPEATABLE READ keeps shared locks on the rows it read, but it does not lock the range: new rows can still be inserted.'
              : lvl === 'SNAPSHOT'
                ? 'SNAPSHOT counts the committed rows as of the start of its transaction.'
                : lvl === 'READ COMMITTED'
                  ? 'READ COMMITTED releases its shared locks after reading.'
                  : 'READ UNCOMMITTED takes no locks.';
        return `${pre}${who} counts orders with Amount > 100: ${out}. ${how}`;
      }
      case 'update':
        return `${pre}${who} updates the row and holds an exclusive (X) lock on it until the transaction ends: ${out}.`;
      case 'insert':
        return `${pre}${who} inserts a new order with Amount > 100 and holds an exclusive lock on it: ${out}.`;
      case 'commit':
        return `${who} commits: its changes become permanent and all its locks are released.`;
      case 'rollback':
        return `${who} rolls back: its changes are undone and all its locks are released.`;
    }
  };

  // opening step
  push(
    'start',
    o.scenario === 'deadlock'
      ? `Two sessions update Accounts rows 1 and 2${o.sameOrder ? ', both in the same order (row 1, then row 2)' : ' in opposite orders'}. Both balances start at ${START_BALANCE} (made-up values; the note doesn't give them).`
      : o.scenario === 'phantom'
        ? `${names.A} counts orders with Amount > 100 twice. The Orders rows are the subqueries lesson's sample data: three orders, all over 100.`
        : `Accounts row Id = 1 starts with Balance = ${START_BALANCE} (a made-up value; the note doesn't give one).`,
    -1,
  );

  // main loop: run statements in script order; a waiting session's later statements wait too
  let guard = 0;
  while (pending.length && guard++ < 100) {
    const k = pending.findIndex((l) => !S[l.s].waiting && !S[l.s].victim);
    if (k < 0) break;
    const line = pending.splice(k, 1)[0]!;
    if (line.ask) {
      const pre = push('call', `${names[line.s]} issues: ${line.stmt.code.replace(/\n/g, ' ')}`, -1, line.s, predictionFor(line, names, firstRead));
      const before = { blocked: counters.comparisons, reads: reads.length };
      const ran = attempt(line, false);
      pre.predict!.answer = answerFor(line, ran, before.blocked !== counters.comparisons && !ran, reads.slice(before.reads), firstRead);
    } else {
      attempt(line, false);
    }
    if (line.op.k === 'commit' || line.op.k === 'rollback') wake();
  }

  // outcome
  const happened = o.scenario === 'blocking' ? blocked : o.scenario === 'deadlock' ? deadlocked : anomaly;
  push('done', outcomeText(o, names, happened, reads, victim), -1, null, undefined, { happened, text: outcomeText(o, names, happened, reads, victim) });
  return { steps, happened, reads };
}

function predictionFor(line: Line, names: Record<Sess, string>, firstRead: number | null): Prediction {
  const other = names[line.s === 'A' ? 'B' : 'A'];
  if (line.ask === 'read') return { question: `What happens to ${names[line.s]}'s SELECT?`, options: [`It reads ${other}'s uncommitted change`, `It waits for ${other} to finish`, 'It reads the last committed value right away'], answer: 0 };
  if (line.ask === 'reread') return { question: `${names[line.s]} runs the same query again. What does it get?`, options: [`The same as before (${firstRead})`, `A different result (${other}'s change shows up)`], answer: 0 };
  return { question: `Can ${names[line.s]}'s ${line.op.k === 'insert' ? 'INSERT' : 'UPDATE'} run now?`, options: ['Yes, it runs now', `No, it waits for ${other}`], answer: 0 };
}

function answerFor(line: Line, ran: boolean, waited: boolean, newReads: { value: number; dirty: boolean }[], firstRead: number | null): number {
  if (line.ask === 'read') return waited ? 1 : newReads[0]?.dirty ? 0 : 2;
  if (line.ask === 'reread') return newReads[0] && newReads[0].value === firstRead ? 0 : 1;
  return ran ? 0 : 1;
}

function outcomeText(o: { scenario: Scenario; level: Level; ending: string; sameOrder: boolean }, names: Record<Sess, string>, happened: boolean, reads: IsoResult['reads'], victim: Sess | null): string {
  const A = names.A;
  const B = names.B;
  switch (o.scenario) {
    case 'dirty': {
      const r = reads.find((x) => x.s === 'B');
      if (happened) return `Dirty read under ${o.level}: ${B} read ${r?.value}, a value ${A} had not committed${o.ending === 'rollback' ? ' and then rolled back, so it never officially existed' : ''}.`;
      return o.level === 'SNAPSHOT' ? `No dirty read under SNAPSHOT: ${B} read the last committed version (${r?.value}) without waiting.` : `No dirty read under ${o.level}: ${B} waited for ${A} to finish, then read the committed value ${r?.value}.`;
    }
    case 'nonrepeatable': {
      const [r1, r2] = reads.filter((x) => x.s === 'A');
      return happened ? `Non-repeatable read under ${o.level}: ${A} read ${r1?.value}, then ${r2?.value} in the same transaction, because ${B} changed and committed the row in between.` : `No non-repeatable read under ${o.level}: both of ${A}'s reads returned ${r1?.value}.` + (o.level === 'SNAPSHOT' ? ` ${B}'s update ran, but ${A} kept reading its snapshot.` : ` ${B}'s update had to wait for ${A}'s shared lock.`);
    }
    case 'phantom': {
      const [r1, r2] = reads.filter((x) => x.s === 'A');
      return happened ? `Phantom read under ${o.level}: ${A} counted ${r1?.value}, then ${r2?.value}, because ${B} inserted a matching order and committed.` : `No phantom under ${o.level}: both counts were ${r1?.value}.` + (o.level === 'SNAPSHOT' ? ` ${B}'s insert ran, but ${A} kept counting its snapshot.` : ` ${B}'s insert had to wait for ${A}'s range lock.`);
    }
    case 'blocking': {
      const r = reads.find((x) => x.s === 'B');
      return happened ? `Blocking: ${B} waited until ${A} finished, then continued and read ${r?.value}. The wait ended on its own; no cycle.` : `No blocking: under ${o.level}, ${B} didn't wait for ${A}'s exclusive lock and read ${r?.value}${r?.dirty ? ' (uncommitted)' : ' (the last committed value)'}.`;
    }
    case 'deadlock':
      return happened ? `Deadlock: ${names[victim!]} was chosen as the victim and rolled back; ${names[victim === 'A' ? 'B' : 'A']} finished its work.` : `No deadlock: both sessions locked row 1 first, so ${B} simply waited for ${A} (blocking) and then continued.`;
  }
}

/** The note's isolation table, as the simulator should reproduce it (checked against the note in tests). */
export const EXPECTED_MATRIX: Record<Level, Record<Anomaly, boolean>> = {
  'READ UNCOMMITTED': { dirty: true, nonrepeatable: true, phantom: true },
  'READ COMMITTED': { dirty: false, nonrepeatable: true, phantom: true },
  'REPEATABLE READ': { dirty: false, nonrepeatable: false, phantom: true },
  SERIALIZABLE: { dirty: false, nonrepeatable: false, phantom: false },
  SNAPSHOT: { dirty: false, nonrepeatable: false, phantom: false },
};
