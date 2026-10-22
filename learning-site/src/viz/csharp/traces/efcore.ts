import type { Prediction, Trace } from '../../engine/types';
import { docOf, lineIn, linesIn, Recorder, type CodeDoc } from '../shared/step';

/*
 * EF Core, from the notes: change-tracker states through the CRUD and AsNoTracking examples in
 * 18.LINQ/EFCore/Notes.md (states as described in Notes2.md › Change tracking in EF Core), and the N+1
 * problem from Notes2.md › Lazy Loading and SQLTutorial/11.Question.md › The N+1 Problem, with its
 * Include and projection fixes.
 *
 * SQL is shown simplified (EF Core sends parameterized commands) and labelled so in the UI. Runtime facts
 * beyond the notes:
 *  - states and what SaveChanges does with each (Added → INSERT, Modified → UPDATE, Deleted → DELETE);
 *    query results start Unchanged; disposing the context stops tracking:
 *    https://learn.microsoft.com/en-us/ef/core/change-tracking/
 *  - after SaveChanges, inserted entities have their real key values and are Unchanged; deleted entities
 *    are detached: https://learn.microsoft.com/en-us/ef/core/change-tracking/explicit-tracking
 *  - a property set on a tracked entity is found by DetectChanges, which SaveChanges calls automatically:
 *    https://learn.microsoft.com/en-us/ef/core/change-tracking/change-detection
 *  - by default EF Core loads Include'd collections in a single query with JOINs:
 *    https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries
 *  - lazy loading runs a query the first time each navigation is accessed (the N+1 problem):
 *    https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying#beware-of-lazy-loading
 */

export type EntityState = 'Detached' | 'Added' | 'Unchanged' | 'Modified' | 'Deleted';

export interface EfProp {
  name: string;
  current: string;
  /** Snapshot taken when the entity started being tracked. */
  original?: string;
}

export interface EfEntry {
  /** Variable name in the code. */
  name: string;
  type: string;
  state: EntityState;
  props: EfProp[];
}

export interface EfRow {
  id: number;
  cols: Record<string, string>;
}

export interface EfState {
  contextOpen: boolean;
  entries: EfEntry[];
  table: string;
  rows: EfRow[];
  sql: string[];
  output: string[];
  /** Entry whose state changed in this step. */
  changed: string | null;
  /** Row changed by the last command. */
  rowChanged: number | null;
}

export interface EfPart {
  id: string;
  label: string;
  doc: CodeDoc;
  trace: Trace<EfState>;
  /** Shown under the stage, e.g. the assumed starting rows. */
  assumption: string;
}

class Ef {
  readonly r = new Recorder<EfState>();
  s: EfState;
  constructor(table: string, rows: EfRow[]) {
    this.s = { contextOpen: false, entries: [], table, rows, sql: [], output: [], changed: null, rowChanged: null };
  }
  e(name: string): EfEntry {
    return this.s.entries.find((x) => x.name === name)!;
  }
  setState(name: string, state: EntityState): void {
    this.e(name).state = state;
    this.s.changed = name;
  }
  step(line: number, narration: string, opts: { predict?: Prediction; action?: 'start' | 'read' | 'write' | 'call' | 'done' } = {}): void {
    const vars: Record<string, string | number> = {};
    for (const x of this.s.entries) vars[x.name] = x.state;
    vars['SQL commands'] = this.s.sql.length;
    this.r.push(this.s, { action: opts.action ?? 'call', line, narration, predict: opts.predict, vars });
    this.s.changed = null;
    this.s.rowChanged = null;
  }
}

const stateQ = (what: string, options: EntityState[], answer: EntityState): Prediction => ({ question: `What is the entity's state after ${what}?`, options, answer: options.indexOf(answer) });

function insert(): EfPart {
  const doc = docOf('efInsert');
  const L = linesIn(doc, 0, {
    using: 'using (var db = new EFContext())',
    make: 'var product = new Product',
    add: 'db.Products.Add(product);',
    save: 'db.SaveChanges();',
    print: 'Console.WriteLine($"Product inserted with ID: {product.Id}");',
  });
  const end = doc.parts[0]!.code.split('\n').length;
  const ef = new Ef('Products', []);
  ef.s.contextOpen = true;
  ef.step(L.using, 'A new EFContext is created. Its change tracker is empty.', { action: 'start' });
  ef.s.entries.push({ name: 'product', type: 'Product', state: 'Detached', props: [{ name: 'Id', current: '0' }, { name: 'Name', current: '"Laptop"' }, { name: 'Price', current: '75000' }] });
  ef.s.changed = 'product';
  ef.step(L.make, 'new Product { … } is just an object in memory. The context does not know about it yet: its state is Detached.');
  ef.setState('product', 'Added');
  ef.step(L.add, 'Add() starts tracking product in the Added state: it is new and will be inserted when SaveChanges is called. Nothing has been sent to the database.', {
    predict: stateQ('db.Products.Add(product)', ['Detached', 'Added', 'Unchanged'], 'Added'),
  });
  ef.s.sql.push('INSERT INTO Products (Name, Price) VALUES (\'Laptop\', 75000)');
  ef.s.rows.push({ id: 1, cols: { Name: 'Laptop', Price: '75000' } });
  ef.s.rowChanged = 1;
  ef.step(L.save, 'SaveChanges() sees one Added entity, so it sends one INSERT. The database generates the key: 1 in an empty table.', { action: 'write' });
  const p = ef.e('product');
  p.props[0]!.current = '1';
  for (const x of p.props) x.original = x.current;
  ef.setState('product', 'Unchanged');
  ef.step(L.save, 'EF Core reads the new key back into product.Id and marks the entity Unchanged: it now matches its row.', {
    predict: stateQ('SaveChanges() finishes', ['Added', 'Unchanged', 'Detached'], 'Unchanged'),
  });
  ef.s.output.push('Product inserted with ID: 1');
  ef.step(L.print, 'product.Id is 1 now (assuming the Products table started empty).', { action: 'read' });
  ef.s.contextOpen = false;
  ef.setState('product', 'Detached');
  ef.step(end, 'The using block ends and the context is disposed, so it stops tracking product. The object still exists; nothing tracks it.', { action: 'done' });
  return { id: 'insert', label: 'Insert', doc, trace: ef.r.steps, assumption: 'Assumes an empty Products table, so the new row gets Id 1.' };
}

function update(): EfPart {
  const doc = docOf('efUpdate');
  const L = linesIn(doc, 0, { using: 'using (var db = new EFContext())', find: 'Product product = db.Products.Find(1);', set: 'product.Name = "Better Pen Drive";', save: 'db.SaveChanges();' });
  const closeUsing = lineIn(doc, 0, '    }');
  const ef = new Ef('Products', [{ id: 1, cols: { Name: 'Pen Drive' } }]);
  ef.s.contextOpen = true;
  ef.step(L.using, 'A new EFContext; nothing is tracked yet.', { action: 'start' });
  ef.s.sql.push('SELECT … FROM Products WHERE Id = 1');
  ef.s.entries.push({ name: 'product', type: 'Product', state: 'Unchanged', props: [{ name: 'Id', current: '1', original: '1' }, { name: 'Name', current: '"Pen Drive"', original: '"Pen Drive"' }] });
  ef.s.changed = 'product';
  ef.step(L.find, 'Find(1) is not in the tracker yet, so EF Core queries the database. Entities returned from a query start Unchanged, and EF keeps a snapshot of their original values.', {
    action: 'read',
    predict: stateQ('Find(1) loads it', ['Added', 'Unchanged', 'Modified'], 'Unchanged'),
  });
  ef.e('product').props[1]!.current = '"Better Pen Drive"';
  ef.step(L.set, 'The property changes in memory. EF Core notices by comparing with the snapshot when DetectChanges runs, which SaveChanges does first. Until then the entry still says Unchanged.', { action: 'write' });
  ef.setState('product', 'Modified');
  ef.step(L.save, 'SaveChanges() runs DetectChanges: Name differs from its original value, so the entity is Modified ("If we make any changes to the entity then its state becomes Modified").', {
    predict: stateQ('DetectChanges compares the snapshot', ['Unchanged', 'Modified', 'Deleted'], 'Modified'),
  });
  ef.s.sql.push('UPDATE Products SET Name = \'Better Pen Drive\' WHERE Id = 1');
  ef.s.rows[0]!.cols.Name = 'Better Pen Drive';
  ef.s.rowChanged = 1;
  for (const x of ef.e('product').props) x.original = x.current;
  ef.setState('product', 'Unchanged');
  ef.step(L.save, 'Modified means UPDATE, and only the changed column is sent. Afterwards the entity matches its row again: Unchanged.', { action: 'write' });
  ef.s.contextOpen = false;
  ef.setState('product', 'Detached');
  ef.step(closeUsing, 'The context is disposed; tracking ends.', { action: 'done' });
  return { id: 'update', label: 'Update', doc, trace: ef.r.steps, assumption: 'Assumes row 1 is the Pen Drive product from the note’s insert steps.' };
}

function remove(): EfPart {
  const doc = docOf('efDelete');
  const L = linesIn(doc, 0, { using: 'using (var db = new EFContext())', find: 'Product product = db.Products.Find(1);', check: 'if (product !=null)', remove: 'db.Products.Remove(product);', save: 'db.SaveChanges();' });
  const closeUsing = lineIn(doc, 0, '    }', 2);
  const ef = new Ef('Products', [{ id: 1, cols: { Name: 'Pen Drive' } }]);
  ef.s.contextOpen = true;
  ef.step(L.using, 'A new EFContext.', { action: 'start' });
  ef.s.sql.push('SELECT … FROM Products WHERE Id = 1');
  ef.s.entries.push({ name: 'product', type: 'Product', state: 'Unchanged', props: [{ name: 'Id', current: '1', original: '1' }, { name: 'Name', current: '"Pen Drive"', original: '"Pen Drive"' }] });
  ef.s.changed = 'product';
  ef.step(L.find, '"To delete, first we have to get the entity": Find(1) loads it, Unchanged.', { action: 'read' });
  ef.step(L.check, 'Row 1 exists, so product is not null.', { action: 'read' });
  ef.setState('product', 'Deleted');
  ef.step(L.remove, 'Remove() marks the entity Deleted. The row is still in the database until SaveChanges.', { predict: stateQ('Remove(product)', ['Detached', 'Deleted', 'Modified'], 'Deleted') });
  ef.s.sql.push('DELETE FROM Products WHERE Id = 1');
  ef.s.rows = [];
  ef.setState('product', 'Detached');
  ef.step(L.save, 'Deleted means DELETE. After SaveChanges the row is gone and the entity is detached from the context, since it no longer exists in the database.', {
    action: 'write',
    predict: stateQ('SaveChanges() deletes the row', ['Deleted', 'Unchanged', 'Detached'], 'Detached'),
  });
  ef.s.contextOpen = false;
  ef.step(closeUsing, 'The context is disposed.', { action: 'done' });
  return { id: 'delete', label: 'Delete', doc, trace: ef.r.steps, assumption: 'Assumes row 1 exists (the Pen Drive product).' };
}

function noTracking(): EfPart {
  const doc = docOf('efNoTracking');
  const L = linesIn(doc, 0, {
    using: 'using (var context = new AppDbContext())',
    tracked: 'var trackedCustomer = context.Customers.FirstOrDefault(c => c.Id == 1);',
    set1: 'trackedCustomer.Name = "Updated Name";',
    save1: ['context.SaveChanges();', 1],
    untracked: 'var untrackedCustomer = context.Customers',
    first2: '.FirstOrDefault(c => c.Id == 2);',
    set2: 'untrackedCustomer.Name = "Won\'t be saved";',
    save2: ['context.SaveChanges();', 2],
  });
  const end = doc.parts[0]!.code.split('\n').length;
  const ef = new Ef('Customers', [
    { id: 1, cols: { Name: '(original)' } },
    { id: 2, cols: { Name: '(original)' } },
  ]);
  ef.s.contextOpen = true;
  ef.step(L.using, 'A new AppDbContext.', { action: 'start' });
  ef.s.sql.push('SELECT … FROM Customers WHERE Id = 1');
  ef.s.entries.push({ name: 'trackedCustomer', type: 'Customer', state: 'Unchanged', props: [{ name: 'Id', current: '1', original: '1' }, { name: 'Name', current: '(original)', original: '(original)' }] });
  ef.s.changed = 'trackedCustomer';
  ef.step(L.tracked, 'A normal query: the customer is tracked, Unchanged, with a snapshot of its values.', { action: 'read' });
  ef.e('trackedCustomer').props[1]!.current = '"Updated Name"';
  ef.step(L.set1, 'The name changes in memory.', { action: 'write' });
  ef.setState('trackedCustomer', 'Modified');
  ef.step(L.save1, 'SaveChanges() runs DetectChanges and finds the change: Modified.', { action: 'call' });
  ef.s.sql.push('UPDATE Customers SET Name = \'Updated Name\' WHERE Id = 1');
  ef.s.rows[0]!.cols.Name = 'Updated Name';
  ef.s.rowChanged = 1;
  for (const x of ef.e('trackedCustomer').props) x.original = x.current;
  ef.setState('trackedCustomer', 'Unchanged');
  ef.step(L.save1, '"✅ Works — entity is tracked": one UPDATE, and the entity is Unchanged again.', { action: 'write' });
  ef.s.sql.push('SELECT … FROM Customers WHERE Id = 2');
  ef.s.entries.push({ name: 'untrackedCustomer', type: 'Customer', state: 'Detached', props: [{ name: 'Id', current: '2' }, { name: 'Name', current: '(original)' }] });
  ef.s.changed = 'untrackedCustomer';
  ef.step(L.first2, 'AsNoTracking(): the query runs, but the result is not put in the change tracker. EF Core keeps no snapshot; to the context this object is Detached.', {
    action: 'read',
    predict: stateQ('an AsNoTracking() query', ['Unchanged', 'Detached', 'Added'], 'Detached'),
  });
  ef.e('untrackedCustomer').props[1]!.current = '"Won\'t be saved"';
  ef.step(L.set2, 'The name changes in memory only.', { action: 'write' });
  ef.step(L.save2, '"❌ No effect — not tracked": the change tracker has no changed entities, so SaveChanges sends no command. Row 2 keeps its old name.', {
    action: 'call',
    predict: { question: 'How many SQL commands does this SaveChanges() send?', options: ['0', '1'], answer: 0 },
  });
  ef.s.contextOpen = false;
  ef.setState('trackedCustomer', 'Detached');
  ef.step(end, 'The context is disposed.', { action: 'done' });
  return { id: 'no-tracking', label: 'AsNoTracking', doc, trace: ef.r.steps, assumption: 'The note doesn’t give the customers’ names, so the starting values are shown as (original).' };
}

export const EF_STATE_PARTS = [
  { id: 'insert', label: 'Insert' },
  { id: 'update', label: 'Update' },
  { id: 'delete', label: 'Delete' },
  { id: 'no-tracking', label: 'AsNoTracking' },
] as const;

export function efStatePart(id: string): EfPart {
  return id === 'update' ? update() : id === 'delete' ? remove() : id === 'no-tracking' ? noTracking() : insert();
}

// ── N+1 ───────────────────────────────────────────────────────────────────────────────────

export type NpPartId = 'per-user' | 'lazy' | 'include' | 'projection';

export interface NpState {
  /** Parent rows loaded so far (users or students). */
  parents: { label: string; childrenLoaded: boolean }[];
  queries: string[];
  /** Index of the parent the loop is on. */
  current: number | null;
  /** Rows the last query brought back, as text. */
  lastResult: string;
}

export interface NpPart {
  id: NpPartId;
  label: string;
  doc: CodeDoc;
  trace: Trace<NpState>;
  roundTrips: number;
}

export const NP_RANGE = { min: 1, max: 8, default: 3 } as const;

export function npPart(id: NpPartId, n: number = NP_RANGE.default): NpPart {
  const r = new Recorder<NpState>();
  const s: NpState = { parents: [], queries: [], current: null, lastResult: '' };
  const push = (line: number, narration: string, opts: { predict?: Prediction; action?: 'start' | 'read' | 'call' | 'done' } = {}) =>
    r.push(s, { action: opts.action ?? 'read', line, narration, predict: opts.predict, vars: { 'round trips': s.queries.length, n } });
  const parent = id === 'lazy' ? 'Student' : 'User';
  const child = id === 'lazy' ? 'Courses' : 'Orders';
  const roundTripQ: Prediction = {
    question: `With ${n} ${parent.toLowerCase()}${n > 1 ? 's' : ''}, how many database round trips will this code make?`,
    options: [...new Set(['1', '2', String(n + 1)])].sort((a, b) => Number(a) - Number(b)),
    answer: 0,
  };
  const expect = id === 'per-user' || id === 'lazy' ? String(n + 1) : '1';
  roundTripQ.answer = roundTripQ.options.indexOf(expect);

  let doc: CodeDoc;
  if (id === 'per-user' || id === 'lazy') {
    doc = docOf(id === 'lazy' ? 'efLazyLoop' : 'qNPlusOne');
    const L =
      id === 'lazy'
        ? linesIn(doc, 0, { list: 'var students = context.Students.ToList();', loop: 'foreach (var s in students)', child: 'Console.WriteLine($"{s.Name} - {s.Courses.Count}");' })
        : linesIn(doc, 0, { list: 'var users = context.Users.ToList();', loop: 'foreach (var user in users)', child: ['.ToList();', 2] });
    push(L.list, `${id === 'lazy' ? 'Lazy loading is on (UseLazyLoadingProxies, virtual Courses).' : 'Users have Orders in a separate table.'} Let's count trips to the database.`, { action: 'start', predict: roundTripQ });
    s.queries.push(`SELECT … FROM ${parent}s`);
    s.parents = Array.from({ length: n }, (_, k) => ({ label: `${parent} ${k + 1}`, childrenLoaded: false }));
    s.lastResult = `${n} ${parent.toLowerCase()} row${n > 1 ? 's' : ''}`;
    push(L.list, `Query 1: ToList() loads the ${parent.toLowerCase()}s, without their ${child}.`, { action: 'call' });
    for (let k = 0; k < n; k++) {
      s.current = k;
      push(L.loop, `The loop moves to ${parent} ${k + 1}.`);
      s.queries.push(id === 'lazy' ? `SELECT … FROM Courses … (Courses of Student ${k + 1})` : `SELECT … FROM Orders WHERE UserId = ${k + 1}`);
      s.parents[k]!.childrenLoaded = true;
      s.lastResult = `${child} of ${parent} ${k + 1}`;
      push(
        L.child,
        id === 'lazy'
          ? `Reading s.Courses for the first time makes the lazy-loading proxy run another query: round trip ${s.queries.length}. "Lazy loading triggers separate query here."`
          : `context.Orders.Where(o => o.UserId == user.Id).ToList() is another query: round trip ${s.queries.length}.`,
        { action: 'call' },
      );
    }
    s.current = null;
    push(L.loop, `Done: 1 query for the ${parent.toLowerCase()}s + ${n} for their ${child} = ${n + 1} round trips. That is the N+1 problem: "1 (users) + N (orders per user) = N+1 queries".`, { action: 'done' });
  } else {
    doc = docOf(id === 'include' ? 'qInclude' : 'qProjection');
    const L = id === 'include' ? linesIn(doc, 0, { start: 'var users = context.Users', how: '.Include(u => u.Orders)', run: '.ToList();' }) : linesIn(doc, 0, { start: 'var users = context.Users', how: '.Select(u => new {', run: '.ToList();' });
    push(L.start, 'Same users and orders as the N+1 example.', { action: 'start', predict: roundTripQ });
    push(
      L.how,
      id === 'include'
        ? 'Include(u => u.Orders) asks for each user’s Orders in the same query (eager loading). Nothing runs yet.'
        : 'The projection asks only for each user’s Name and Orders. Nothing runs yet.',
    );
    s.queries.push(id === 'include' ? 'SELECT … FROM Users LEFT JOIN Orders ON Users.Id = Orders.UserId' : 'SELECT Users.Name, Orders.… FROM Users LEFT JOIN Orders ON Users.Id = Orders.UserId');
    s.parents = Array.from({ length: n }, (_, k) => ({ label: `User ${k + 1}`, childrenLoaded: true }));
    s.lastResult = `${n} user${n > 1 ? 's' : ''} with their orders`;
    push(L.run, `ToList() sends one query with a JOIN and gets users and orders together: "Loads all data in single query". 1 round trip, however many users there are.`, { action: 'call' });
    push(L.run, `Done: 1 round trip instead of ${n + 1}.`, { action: 'done' });
  }
  return { id, label: NP_PARTS.find((x) => x.id === id)!.label, doc, trace: r.steps, roundTrips: s.queries.length };
}

export const NP_PARTS: { id: NpPartId; label: string }[] = [
  { id: 'per-user', label: 'Query per user (N+1)' },
  { id: 'lazy', label: 'Lazy loading (N+1)' },
  { id: 'include', label: 'Fix: Include' },
  { id: 'projection', label: 'Fix: projection' },
];

export type EfScenario = 'change-tracker-states' | 'n-plus-one';
export function toEfScenario(s: unknown): EfScenario {
  return s === 'n-plus-one' ? 'n-plus-one' : 'change-tracker-states';
}
