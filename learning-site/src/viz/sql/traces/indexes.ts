import { lineOf } from '../../engine/code';
import type { Counters, Prediction } from '../../engine/types';
import { mkStep, ZERO, type Cell, type Mark, type SqlStage, type SqlStep, type TableView } from '../model';
import { ORDERS, SQL, SUBQUERY_EMPLOYEES, type DeptEmployee, type Order } from '../notes';

/**
 * Index walk-throughs for 6.SQL_IndexNKeys.md and 7.SQL_ExecutionPlanNMore.md.
 *
 * Structure facts beyond the notes come from Microsoft Learn's index design guide
 * (https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-index-design-guide):
 * rowstore indexes are B+ trees; a clustered index's leaf level holds the data rows; a non-clustered
 * index's leaf rows hold its key plus a row locator, which is the clustered index key when the table has
 * one; INCLUDE columns are stored only at the leaf level
 * (https://learn.microsoft.com/en-us/sql/relational-databases/indexes/create-indexes-with-included-columns).
 * Pages hold two rows here so a five-row table still has more than one page; real pages hold far more.
 * Counters: reads = pages read, comparisons = keys or rows checked, swaps = key lookups,
 * writes = result rows (reads) or index structures changed (writes).
 */
export const PAGE_ROWS = 2;

export interface EntryView {
  text: string;
  /** INCLUDE column text, drawn muted. */
  inc?: string;
  mark?: Mark;
}
export interface PageView {
  id: string;
  label: string;
  entries: EntryView[];
  mark?: Mark;
}
export interface TreeView {
  id: string;
  title: string;
  subtitle: string;
  root: PageView;
  leaves: PageView[];
  /** Leaf indexes whose root pointer is on the current path. */
  path: number[];
}
export interface IndexState extends SqlStage {
  trees: TreeView[];
  /** write-cost: the non-clustered indexes, drawn as compact chips. */
  ncis: { name: string; mark: Mark | null }[] | null;
}
export type IndexTrace = SqlStep<IndexState>[];

type Key = number | string;
interface Entry {
  key: Key;
  text: string;
  inc?: string;
  /** For non-clustered entries: the clustered key (row locator). */
  locator?: Key;
}
interface Tree {
  id: string;
  title: string;
  subtitle: string;
  leaves: Entry[][];
}

const cmp = (a: Key, b: Key) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'en'));
const chunk = <T>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const build = (id: string, title: string, subtitle: string, entries: Entry[]): Tree => ({ id, title, subtitle, leaves: chunk([...entries].sort((a, b) => cmp(a.key, b.key)), PAGE_ROWS) });
const rootKeys = (t: Tree) => t.leaves.map((l) => l[0]?.key ?? '');
/** The child the root sends a search for `k` to: the last leaf whose first key is <= k. */
const childFor = (t: Tree, k: Key) => {
  let c = 0;
  rootKeys(t).forEach((rk, i) => {
    if (cmp(rk, k) <= 0) c = i;
  });
  return c;
};

interface Marks {
  pages?: Record<string, Mark>;
  entries?: Record<string, Mark>;
  path?: number[];
}
function render(t: Tree, m: Marks = {}): TreeView {
  const rootId = `${t.id}-root`;
  return {
    id: t.id,
    title: t.title,
    subtitle: t.subtitle,
    root: { id: rootId, label: 'root', mark: m.pages?.[rootId], entries: rootKeys(t).map((k, i) => ({ text: `${k} → p${i + 1}`, mark: m.entries?.[`${rootId}:${i}`] })) },
    leaves: t.leaves.map((l, i) => {
      const id = `${t.id}-p${i + 1}`;
      return { id, label: `leaf p${i + 1}`, mark: m.pages?.[id], entries: l.map((e, j) => ({ text: e.text, ...(e.inc ? { inc: e.inc } : {}), mark: m.entries?.[`${id}:${j}`] })) };
    }),
    path: m.path ?? [],
  };
}
const pageId = (t: Tree, leaf: number) => `${t.id}-p${leaf + 1}`;
const rootId = (t: Tree) => `${t.id}-root`;

class Rec {
  readonly steps: IndexTrace = [];
  readonly c: Counters = { ...ZERO };
  result: Cell[][] = [];
  constructor(
    readonly resultCols: string[],
    readonly decimals: (number | undefined)[] = [],
  ) {}
  resultView(justAdded: boolean): TableView {
    return { id: 'result', caption: 'Rows returned', columns: this.resultCols, rows: this.result.map((r) => [...r]), marks: this.result.map((_, i) => (justAdded && i === this.result.length - 1 ? 'write' : null)), decimals: this.decimals, empty: 'No rows yet' };
  }
  push(trees: TreeView[], code: SqlStage['code'], action: SqlStep['action'], narration: string, vars: SqlStep['variables'], opts: { added?: boolean; predict?: Prediction; ncis?: IndexState['ncis']; noResult?: boolean } = {}) {
    const tables = opts.noResult ? [] : [this.resultView(Boolean(opts.added))];
    this.steps.push(mkStep({ tables, code, trees, ncis: opts.ncis ?? null }, action, narration, vars, this.c, opts.predict));
  }
}

// ── 1. clustered vs non-clustered vs covering (6.SQL_IndexNKeys.md › Covering Index) ────────

export type CoverMode = 'scan' | 'nci' | 'covering';
export const COVER_MODES: { id: CoverMode; label: string }[] = [
  { id: 'scan', label: 'Clustered index only' },
  { id: 'nci', label: 'Non-clustered on Name' },
  { id: 'covering', label: 'Covering: INCLUDE (Salary)' },
];
export const COVER_BLOCKS = [SQL.coveringQuery.code, SQL.coveringIndex.code];

function employeeTrees(es: readonly DeptEmployee[], include: boolean) {
  const ci = build('ci', 'Clustered index (PK Id)', 'leaf pages hold the full rows', es.map((e) => ({ key: e.Id, text: `${e.Id} · ${e.Name} · ${e.Salary} · ${e.DepartmentId}` })));
  const nci = build('nci', 'IX_Employee_Name', include ? 'Name + Id (row locator), INCLUDE Salary at the leaf' : 'Name + Id (row locator)', es.map((e) => ({ key: e.Name, text: `${e.Name} → Id ${e.Id}`, locator: e.Id, ...(include ? { inc: `Salary ${e.Salary}` } : {}) })));
  return { ci, nci };
}

/** Root → leaf navigation, then read entries from the start of that leaf while they are <= key (crossing pages). */
function seek(r: Rec, t: Tree, key: Key, others: () => TreeView[], code: SqlStage['code'], label: string, vars: SqlStep['variables']): { leaf: number; idx: number; entry: Entry }[] {
  const child = childFor(t, key);
  r.c.reads++;
  r.c.comparisons += t.leaves.length;
  r.push([render(t, { pages: { [rootId(t)]: 'active' }, entries: { [`${rootId(t)}:${child}`]: 'compare' }, path: [child] }), ...others()], code, 'read', `${label}: read the root page. ${t.leaves.length > 1 ? `${JSON.stringify(key)} sorts ${child === 0 ? `before ${JSON.stringify(rootKeys(t)[1])}` : `at or after ${JSON.stringify(rootKeys(t)[child])}`}, so follow the pointer to leaf page p${child + 1}.` : 'It points to the only leaf page.'}`, vars);
  const found: { leaf: number; idx: number; entry: Entry }[] = [];
  for (let leaf = child; leaf < t.leaves.length; leaf++) {
    r.c.reads++;
    const entries = t.leaves[leaf]!;
    const em: Record<string, Mark> = {};
    let done = false;
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]!;
      r.c.comparisons++;
      const d = cmp(e.key, key);
      if (d === 0) found.push({ leaf, idx: j, entry: e });
      em[`${pageId(t, leaf)}:${j}`] = d === 0 ? 'settled' : 'compare';
      if (d > 0) {
        done = true;
        break;
      }
    }
    const hits = found.filter((f) => f.leaf === leaf).length;
    const last = leaf === t.leaves.length - 1;
    r.push([render(t, { pages: { [pageId(t, leaf)]: 'active' }, entries: em, path: [child] }), ...others()], code, 'read', `Read leaf page p${leaf + 1}: ${hits ? `${hits} entr${hits === 1 ? 'y matches' : 'ies match'} ${JSON.stringify(key)}` : `no entry equals ${JSON.stringify(key)}`}.${done ? ' The next key is larger, so the seek stops here.' : last ? ' That was the last page.' : ' The page ended without a larger key, so the seek reads the next page too.'}`, vars);
    if (done) break;
  }
  return found;
}

export function traceCovering(mode: CoverMode, name = 'Aman', es: readonly DeptEmployee[] = SUBQUERY_EMPLOYEES): IndexTrace {
  const r = new Rec(['Name', 'Salary']);
  const { ci, nci } = employeeTrees(es, mode === 'covering');
  const q = (l: string) => ({ block: 0, lines: [lineOf(COVER_BLOCKS[0]!, l)] });
  const ix = (l: string) => ({ block: 1, lines: [lineOf(COVER_BLOCKS[1]!, l)] });
  const vars = { 'Name searched': name };
  if (mode === 'scan') {
    r.push([render(ci)], q('WHERE Name ='), 'start', `Without an index on Name, the only index is the clustered index on Id. Its leaf pages hold the whole rows, sorted by Id, so finding Name = '${name}' means reading every leaf page: a scan.`, vars);
    for (let leaf = 0; leaf < ci.leaves.length; leaf++) {
      r.c.reads++;
      const em: Record<string, Mark> = {};
      ci.leaves[leaf]!.forEach((e, j) => {
        r.c.comparisons++;
        const row = es.find((x) => x.Id === e.key)!;
        const hit = row.Name === name;
        em[`${pageId(ci, leaf)}:${j}`] = hit ? 'settled' : 'compare';
        if (hit) r.result.push([row.Name, row.Salary]);
      });
      const hits = ci.leaves[leaf]!.filter((e) => es.find((x) => x.Id === e.key)!.Name === name).length;
      r.push([render(ci, { pages: { [pageId(ci, leaf)]: 'active' }, entries: em })], q('WHERE Name ='), hits ? 'write' : 'read', `Read leaf page p${leaf + 1} and check each row's Name: ${hits ? `found ${name}` : 'no match'}.`, vars, { added: hits > 0 });
    }
    r.push([render(ci)], q('SELECT Name, Salary'), 'done', `Clustered index scan: ${r.c.reads} pages read and ${r.c.comparisons} rows checked to return ${r.result.length} row${r.result.length === 1 ? '' : 's'}. The note: a scan reads the entire index, which gets expensive as the table grows.`, vars);
    return r.steps;
  }
  r.push([render(nci), render(ci)], ix('CREATE INDEX IX_Employee_Name'), 'start', mode === 'covering' ? `IX_Employee_Name stores Name (sorted) plus Id, and INCLUDE (Salary) copies Salary into its leaf pages. Every column the query needs is in the index.` : `IX_Employee_Name stores Name (sorted) plus the clustered key Id as the row locator. Salary is not in it.`, vars);
  const found = seek(r, nci, name, () => [render(ci)], q('WHERE Name ='), 'Index Seek on IX_Employee_Name', vars);
  if (!found.length) {
    r.push([render(nci), render(ci)], q('WHERE Name ='), 'done', `No employee is named ${name}: the seek read ${r.c.reads} pages and returns nothing.`, vars);
    return r.steps;
  }
  for (const f of found) {
    const row = es.find((x) => x.Id === f.entry.locator)!;
    if (mode === 'covering') {
      r.result.push([row.Name, row.Salary]);
      r.push([render(nci, { pages: { [pageId(nci, f.leaf)]: 'active' }, entries: { [`${pageId(nci, f.leaf)}:${f.idx}`]: 'settled' }, path: [f.leaf] }), render(ci)], q('SELECT Name, Salary'), 'write', `The leaf entry already has Salary ${row.Salary} (the INCLUDE column), so the row is returned straight from the index. No Key Lookup.`, vars, { added: true });
      continue;
    }
    r.c.swaps++;
    const child = childFor(ci, row.Id);
    r.c.reads++;
    r.c.comparisons += ci.leaves.length;
    r.push([render(nci, { entries: { [`${pageId(nci, f.leaf)}:${f.idx}`]: 'settled' }, path: [f.leaf] }), render(ci, { pages: { [rootId(ci)]: 'active' }, entries: { [`${rootId(ci)}:${child}`]: 'compare' }, path: [child] })], q('SELECT Name, Salary'), 'call', `Salary is not in IX_Employee_Name, so SQL goes back to the clustered index with Id ${row.Id}: a Key Lookup. Read the clustered index root and follow the pointer to p${child + 1}.`, vars);
    r.c.reads++;
    const idx = ci.leaves[child]!.findIndex((e) => e.key === row.Id);
    r.result.push([row.Name, row.Salary]);
    r.push([render(nci, { entries: { [`${pageId(nci, f.leaf)}:${f.idx}`]: 'settled' }, path: [f.leaf] }), render(ci, { pages: { [pageId(ci, child)]: 'active' }, entries: { [`${pageId(ci, child)}:${idx}`]: 'settled' }, path: [child] })], q('SELECT Name, Salary'), 'write', `Read leaf page p${child + 1} of the clustered index: the row with Id ${row.Id} has Salary ${row.Salary}.`, vars, { added: true });
  }
  r.push([render(nci), render(ci)], q('SELECT Name, Salary'), 'done', mode === 'covering' ? `Index Seek on IX_Employee_Name and no Key Lookup: ${r.c.reads} pages read. This is the note's check that the covering index works.` : `Index Seek plus ${r.c.swaps} Key Lookup${r.c.swaps === 1 ? '' : 's'}: ${r.c.reads} pages read. With many matching rows, a lookup per row gets expensive; INCLUDE (Salary) removes it.`, vars);
  return r.steps;
}

// ── 2. seek, scan and key lookup (7.SQL_ExecutionPlanNMore.md › Index Seek vs Index Scan) ───────

export type SeekQuery = 'seek' | 'scan';
export const SEEK_BLOCKS = [SQL.seekScan.code, SQL.customerIdIndex.code];

function orderTrees(os: readonly Order[]) {
  const ci = build('ci', 'Clustered index (PK OrderId)', 'leaf pages hold the full rows', os.map((o) => ({ key: o.OrderId, text: `${o.OrderId} · cust ${o.CustomerId} · ${o.Amount.toFixed(2)}` })));
  const nci = build('nci', 'IX_Orders_CustomerID', 'CustomerId + OrderId (row locator)', os.map((o) => ({ key: o.CustomerId, text: `${o.CustomerId} → OrderId ${o.OrderId}`, locator: o.OrderId })));
  return { ci, nci };
}

export function traceSeekScan(query: SeekQuery, customerId = 123, os: readonly Order[] = ORDERS): IndexTrace {
  const r = new Rec(['OrderId', 'CustomerId', 'Amount'], [undefined, undefined, 2]);
  const { ci, nci } = orderTrees(os);
  const code = (marker: string) => ({ block: 0, lines: [lineOf(SEEK_BLOCKS[0]!, marker)] });
  if (query === 'scan') {
    const c = code('WHERE Amount > 0');
    const vars = { predicate: 'Amount > 0' };
    r.push([render(nci), render(ci)], c, 'start', 'No index has Amount as its key, so IX_Orders_CustomerID cannot help. SQL Server reads every leaf page of the clustered index and checks Amount > 0 on each row.', vars);
    for (let leaf = 0; leaf < ci.leaves.length; leaf++) {
      r.c.reads++;
      const em: Record<string, Mark> = {};
      let added = 0;
      ci.leaves[leaf]!.forEach((e, j) => {
        r.c.comparisons++;
        const o = os.find((x) => x.OrderId === e.key)!;
        const hit = o.Amount > 0;
        em[`${pageId(ci, leaf)}:${j}`] = hit ? 'settled' : 'compare';
        if (hit) {
          r.result.push([o.OrderId, o.CustomerId, o.Amount]);
          added++;
        }
      });
      r.push([render(nci), render(ci, { pages: { [pageId(ci, leaf)]: 'active' }, entries: em })], c, added ? 'write' : 'read', `Read leaf page p${leaf + 1}: ${added} row${added === 1 ? '' : 's'} with Amount > 0.`, vars, { added: added > 0 });
    }
    r.push([render(nci), render(ci)], c, 'done', `Clustered index scan: ${r.c.reads} pages read, ${r.c.comparisons} rows checked, ${r.result.length} returned. When a query needs most rows, reading everything is the sensible plan.`, vars);
    return r.steps;
  }
  const c = code('WHERE CustomerId = 123');
  const vars = { CustomerId: customerId };
  const n = os.filter((o) => o.CustomerId === customerId).length;
  r.push([render(nci), render(ci)], c, 'start', `IX_Orders_CustomerID keeps CustomerId sorted, with OrderId (the clustered key) as the row locator. Seek CustomerId = ${customerId}.${customerId === 123 ? " (123 is the note's value; no sample order has it. Pick another value above.)" : ''}`, vars, { predict: { question: `How many Key Lookups will this query need?`, options: ['0', '1', '2', '3', '4'], answer: Math.min(4, n) } });
  const found = seek(r, nci, customerId, () => [render(ci)], c, 'Index Seek on IX_Orders_CustomerID', vars);
  for (const f of found) {
    const o = os.find((x) => x.OrderId === f.entry.locator)!;
    r.c.swaps++;
    const child = childFor(ci, o.OrderId);
    r.c.reads += 2;
    r.c.comparisons += ci.leaves.length;
    const idx = ci.leaves[child]!.findIndex((e) => e.key === o.OrderId);
    r.result.push([o.OrderId, o.CustomerId, o.Amount]);
    r.push([render(nci, { entries: { [`${pageId(nci, f.leaf)}:${f.idx}`]: 'settled' }, path: [f.leaf] }), render(ci, { pages: { [rootId(ci)]: 'active', [pageId(ci, child)]: 'active' }, entries: { [`${pageId(ci, child)}:${idx}`]: 'settled' }, path: [child] })], c, 'write', `SELECT * also needs Amount, which the index doesn't have: Key Lookup ${r.c.swaps} goes back to the clustered index (root, then p${child + 1}) for OrderId ${o.OrderId}.`, vars, { added: true });
  }
  r.push([render(nci), render(ci)], c, 'done', found.length ? `Index Seek + ${found.length} Key Lookup${found.length === 1 ? '' : 's'}: ${r.c.reads} pages read for ${found.length} row${found.length === 1 ? '' : 's'}. The note: a seek plus lookup can be expensive if many rows match; a covering index avoids the lookups.` : `Index Seek found no matching key after ${r.c.reads} page reads, so there is nothing to look up.`, vars);
  return r.steps;
}

// ── 3. the cost of writes (6.SQL_IndexNKeys.md › WRITE Performance Comparison) ──────────────

export type WriteOp = 'insert-seq' | 'insert-guid' | 'update-key' | 'update-col' | 'delete';
export const WRITE_OPS: { id: WriteOp; label: string }[] = [
  { id: 'insert-seq', label: 'INSERT (INT IDENTITY key)' },
  { id: 'insert-guid', label: 'INSERT (random GUID key)' },
  { id: 'update-key', label: 'UPDATE the clustered key' },
  { id: 'update-col', label: 'UPDATE a non-indexed column' },
  { id: 'delete', label: 'DELETE' },
];
export const WRITE_BLOCKS = [SQL.indexCount.code, SQL.updateClusteredKey.code];
/** Made-up GUID keys (shortened) for the random-key insert; the notes give none. */
export const GUID_KEYS = ['1F3A…', '5C90…', '9B27…', 'E4D1…'];
export const NEW_GUID = '7A12…';

export function traceWriteCost(op: WriteOp, nciCount = 5, os: readonly Order[] = ORDERS): IndexTrace {
  const r = new Rec([]);
  const guid = op === 'insert-guid';
  const keyOf = (o: Order, i: number): Key => (guid ? GUID_KEYS[i]! : o.OrderId);
  const entries: Entry[] = os.map((o, i) => ({ key: keyOf(o, i), text: `${keyOf(o, i)} · cust ${o.CustomerId} · ${o.Amount.toFixed(2)}` }));
  const ci: Tree = build('ci', guid ? 'Clustered index (GUID key)' : 'Clustered index (PK OrderId)', guid ? 'made-up GUID keys, shortened' : 'leaf pages hold the full rows', entries);
  const ncis = Array.from({ length: nciCount }, (_, i) => ({ name: `Non-clustered index ${i + 1}`, mark: null as Mark | null }));
  const nciView = (current: number, done: number) => ncis.map((x, i) => ({ name: x.name, mark: (i === current ? 'write' : i < done ? 'settled' : null) as Mark | null }));
  const block0 = { block: 0, lines: [1, 2] };
  const block1 = { block: 1, lines: [1, 2, 3] };
  const opts = (current = -1, done = 0) => ({ ncis: nciView(current, done), noResult: true });
  const label = WRITE_OPS.find((w) => w.id === op)!.label;
  const touchesNcis = op !== 'update-col';
  const vars = (structures: number) => ({ 'non-clustered indexes': nciCount, 'structures changed': structures });

  r.push([render(ci)], block0, 'start', `${label}. The table has 1 clustered index and ${nciCount} non-clustered index${nciCount === 1 ? '' : 'es'}.`, vars(0), { ...opts(), predict: { question: 'How many index structures must this statement change?', options: Array.from({ length: nciCount + 2 }, (_, i) => String(i)), answer: touchesNcis ? nciCount + 1 : 1 } });

  if (op === 'insert-seq' || op === 'insert-guid') {
    const newKey: Key = guid ? NEW_GUID : Math.max(...os.map((o) => o.OrderId)) + 1;
    const child = childFor(ci, newKey);
    const leaf = ci.leaves[child]!;
    const pos = leaf.filter((e) => cmp(e.key, newKey) < 0).length;
    const newEntry: Entry = { key: newKey, text: `${newKey} · new row` };
    r.c.reads += 2;
    r.push([render(ci, { pages: { [rootId(ci)]: 'active', [pageId(ci, child)]: 'compare' }, path: [child] })], block0, 'read', `The new row's key ${newKey} belongs in leaf page p${child + 1}${guid ? ', in the middle of the index' : ', at the end of the index'}. That page is ${leaf.length >= PAGE_ROWS ? 'full' : 'not full'}.`, vars(0), opts());
    if (leaf.length < PAGE_ROWS) {
      leaf.splice(pos, 0, newEntry);
    } else if (pos === leaf.length && child === ci.leaves.length - 1) {
      ci.leaves.push([newEntry]);
    } else {
      // page split: the second half of the full page moves to a new page, then the row goes where it belongs
      const half = Math.floor(PAGE_ROWS / 2);
      const left = leaf.slice(0, half);
      const right = leaf.slice(half);
      if (pos < half) left.splice(pos, 0, newEntry);
      else right.splice(pos - half, 0, newEntry);
      ci.leaves.splice(child, 1, left, right);
    }
    r.c.writes++;
    const newLeaf = ci.leaves.findIndex((l) => l.includes(newEntry));
    r.push(
      [render(ci, { pages: { [pageId(ci, newLeaf)]: 'write' }, entries: { [`${pageId(ci, newLeaf)}:${ci.leaves[newLeaf]!.indexOf(newEntry)}`]: 'write' }, path: [newLeaf] })],
      block0,
      'write',
      guid
        ? `Page split: p${child + 1} is full, so SQL Server moves part of its rows to a new page to make room for ${newKey}. The pages are now only partly full (fragmentation). The note: random keys cause page splits, fragmentation and slower inserts.`
        : `The new key is larger than every existing key, so the row goes on a new page at the end. No existing rows move. The note: a sequential key is fast with minimal page splits.`,
      vars(1),
      opts(),
    );
  } else {
    const target = op === 'delete' ? os[1]! : os[0]!;
    const child = childFor(ci, target.OrderId);
    const idx = ci.leaves[child]!.findIndex((e) => e.key === target.OrderId);
    r.c.reads += 2;
    r.push([render(ci, { pages: { [rootId(ci)]: 'active', [pageId(ci, child)]: 'active' }, entries: { [`${pageId(ci, child)}:${idx}`]: 'compare' }, path: [child] })], op === 'update-key' ? block1 : block0, 'read', `Seek the clustered index to OrderId ${target.OrderId} (root, then p${child + 1}).${op === 'update-key' ? " The note's example updates OrderId 100; the sample Orders start at 101, so this walk-through moves OrderId 101." : ''}`, vars(0), opts());
    if (op === 'update-col') {
      r.c.writes++;
      r.push([render(ci, { pages: { [pageId(ci, child)]: 'write' }, entries: { [`${pageId(ci, child)}:${idx}`]: 'write' }, path: [child] })], block0, 'write', `Change Amount in place in the data row. No index has Amount as a key or included column here, so no index needs updating: cheap.`, vars(1), opts());
    } else if (op === 'delete') {
      ci.leaves[child]!.splice(idx, 1);
      r.c.writes++;
      r.push([render(ci, { pages: { [pageId(ci, child)]: 'write' }, path: [child] })], block0, 'write', `Remove the row for OrderId ${target.OrderId} from the clustered index leaf.`, vars(1), opts());
    } else {
      ci.leaves[child]!.splice(idx, 1);
      r.push([render(ci, { pages: { [pageId(ci, child)]: 'write' }, path: [child] })], block1, 'write', `Step 1: DELETE the old row (OrderId ${target.OrderId}). SQL Server does not simply edit a key value, because the B-tree must stay ordered.`, vars(0), opts());
      const newEntry: Entry = { key: 5000, text: `5000 · cust ${target.CustomerId} · ${target.Amount.toFixed(2)}` };
      const last = ci.leaves[ci.leaves.length - 1]!;
      if (last.length < PAGE_ROWS) last.push(newEntry);
      else ci.leaves.push([newEntry]);
      r.c.writes++;
      const nl = ci.leaves.length - 1;
      r.push([render(ci, { pages: { [pageId(ci, nl)]: 'write' }, entries: { [`${pageId(ci, nl)}:${ci.leaves[nl]!.indexOf(newEntry)}`]: 'write' }, path: [nl] })], block1, 'write', 'Step 2: INSERT the row again as OrderId 5000, in its correct sorted place (the end).', vars(1), opts());
    }
  }
  if (touchesNcis) {
    for (let i = 0; i < nciCount; i++) {
      r.c.writes++;
      const what = op === 'delete' ? 'remove the row\'s entry' : op === 'update-key' ? 'update the entry, because it stores the clustered key as its row locator' : 'add an entry for the new row (its key + the clustered key)';
      r.push([render(ci)], op === 'update-key' ? block1 : block0, 'write', `Non-clustered index ${i + 1}: ${what}.`, vars(1 + i + 1), opts(i, i));
    }
  }
  const total = touchesNcis ? nciCount + 1 : 1;
  r.push([render(ci)], block0, 'done', touchesNcis ? `Done: ${total} structure${total === 1 ? '' : 's'} changed (1 clustered + ${nciCount} non-clustered). More non-clustered indexes = slower ${op === 'delete' ? 'deletes' : op === 'update-key' ? 'clustered-key updates' : 'inserts'}.` : 'Done: only the data row changed. Updating a column no index uses is cheap.', vars(total), { ...opts(-1, touchesNcis ? nciCount : 0) });
  return r.steps;
}
