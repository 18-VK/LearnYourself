import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { keysOf, sizeOf, type HashTableState } from '../../../src/viz/dsa/hash/model';
import { STRUCTURES } from '../../../src/viz/dsa/collections';
import { DICT_DEF, SET_DEF } from '../../../src/viz/dsa/collections/hashing';
import { LINKED_DEF, LINKED_EXAMPLE, noteExample, noteList, type LinkedListState } from '../../../src/viz/dsa/collections/linkedlist';
import { emptyList, LIST_DEF, listAdd, listInsert, listRemove, listRemoveAt, type ListState } from '../../../src/viz/dsa/collections/list';
import { parentOf, PQ_DEF, pqDequeue, pqEnqueue, pqFrom, type PQState } from '../../../src/viz/dsa/collections/pq';
import { cloneSorted, inOrder, SORTED_DEF, sortedFrom, type RBNode, type SortedState } from '../../../src/viz/dsa/collections/sorted';
import { QUEUE_DEF, STACK_DEF, type SeqState } from '../../../src/viz/dsa/collections/stackqueue';
import type { OpTrace, StructureDef } from '../../../src/viz/dsa/collections/types';
import { rng } from '../searching/helpers';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const sheet = readFileSync(root('Competitive%20Programming/csharp-dsa-collections-cheatsheet.md'), 'utf8').replace(/\r\n/g, '\n');

const op = <S>(def: StructureDef<S>, id: string) => def.ops.find((o) => o.id === id)!;
const after = <S>(t: OpTrace<S>, s: S) => (t.steps.length ? t.steps.at(-1)!.state : s);
function problems<S>(t: OpTrace<S>): string[] {
  const p: string[] = [];
  if (!t.error && t.steps.length === 0) p.push(`${t.call}: no steps`);
  for (const s of t.steps) if (!s.narration || /undefined|NaN/.test(s.narration)) p.push(`${t.call}: "${s.narration}"`);
  if (/undefined|NaN/.test(t.work + t.call)) p.push(`${t.call}: work "${t.work}"`);
  return p;
}

describe('cost labels', () => {
  it('quote the cheat sheet exactly, or cite Microsoft docs', () => {
    const lines = sheet.split('\n');
    for (const def of Object.values(STRUCTURES)) {
      expect(sheet, def.id).toContain(def.section);
      for (const c of def.costs) {
        if (c.source === 'notes') {
          expect(lines.some((l) => l.includes(c.ops) && l.includes(c.cost)), `${def.id}: ${c.ops} ${c.cost}`).toBe(true);
          if (c.note) expect(sheet).toContain(c.note);
        } else expect(c.source).toMatch(/^https:\/\/learn\.microsoft\.com\//);
      }
    }
  });
  it('every placement names collections this visualizer has', () => {
    const dsa = parse(readFileSync(root('learning-site/curriculum/dsa.yaml'), 'utf8')) as { modules: { lessons: { place?: { viz?: string; props?: { structures?: string[] } }[] }[] }[] };
    const places = dsa.modules.flatMap((m) => m.lessons.flatMap((l) => l.place ?? [])).filter((p) => p.viz === 'CollectionVisualizer');
    expect(places).toHaveLength(5);
    const used = places.flatMap((p) => p.props!.structures!);
    for (const s of used) expect(STRUCTURES[s], s).toBeDefined();
    expect(new Set(used)).toEqual(new Set(Object.keys(STRUCTURES)));
  });
});

describe('List<T> capacity', () => {
  it('starts at Capacity 0, then grows 4 → 8 → 16, copying 4 + 8 elements', () => {
    let s = emptyList();
    const caps: number[] = [s.items.length];
    for (let k = 0; k < 9; k++) {
      s = after(listAdd(s, k), s);
      caps.push(s.items.length);
    }
    expect([...new Set(caps)]).toEqual([0, 4, 8, 16]);
    expect(s.growthCopies).toBe(12);
    expect(s.items.slice(0, s.count)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('shifts on Insert and RemoveAt, and Remove(value) removes only the first match', () => {
    let s: ListState = emptyList();
    for (const v of [5, 7, 5, 9]) s = after(listAdd(s, v), s);
    const ins = listInsert(s, 1, 6);
    // the list was full (Count 4 == Capacity 4), so Insert grows it and copies all 4 elements around the gap
    expect(ins.work).toBe('moved 4 elements, wrote 1');
    s = after(ins, s);
    expect(s.items.slice(0, s.count)).toEqual([5, 6, 7, 5, 9]);
    s = after(listRemove(s, 5), s);
    expect(s.items.slice(0, s.count)).toEqual([6, 7, 5, 9]);
    s = after(listRemoveAt(s, 3), s);
    expect(s.items.slice(0, s.count)).toEqual([6, 7, 5]);
    expect(s.items.length).toBe(8);
  });
  it('throws like .NET for bad indexes', () => {
    expect(listInsert(emptyList(), 1, 3).error).toMatch(/ArgumentOutOfRangeException/);
    expect(listRemoveAt(emptyList(), 0).error).toMatch(/ArgumentOutOfRangeException/);
  });
});

describe('LinkedList<T>', () => {
  it("runs the cheat sheet's example to 10, 20, 25, 40, stepping through its lines", () => {
    const t = noteExample();
    expect(t.steps.at(-1)!.state.nodes.map((n) => n.value)).toEqual([10, 20, 25, 40]);
    expect([...new Set(t.steps.map((s) => s.codeLine))]).toEqual([1, 3, 4, 5]);
    expect(sheet).toContain(LINKED_EXAMPLE);
    expect(problems(t)).toEqual([]);
  });
  it('Find walks from First; AddBefore needs a held node', () => {
    const s = noteList();
    expect(op(LINKED_DEF, 'addBefore').blocked!(s)).not.toBeNull();
    const f = op(LINKED_DEF, 'find').run(s, 30, 0);
    expect(f.steps.filter((x) => x.hl.compare).length).toBe(3);
    const held = after(f, s) as LinkedListState;
    expect(held.held).not.toBeNull();
    expect(op(LINKED_DEF, 'addBefore').blocked!(held)).toBeNull();
    expect(op(LINKED_DEF, 'removeFirst').run({ nodes: [], held: null, nextId: 0 }, 0, 0).error).toMatch(/InvalidOperationException/);
  });
  it('inserts by position after walking', () => {
    const t = op(LINKED_DEF, 'insertAt').run(noteList(), 15, 1);
    expect(after(t, noteList()).nodes.map((n) => n.value)).toEqual([10, 15, 20, 30, 40]);
  });
});

describe('Stack<T> and Queue<T>', () => {
  it('are LIFO and FIFO, and throw when empty', () => {
    let st: SeqState = { items: [] };
    let q: SeqState = { items: [] };
    for (const v of [1, 2, 3]) {
      st = after(op(STACK_DEF, 'push').run(st, v, 0), st);
      q = after(op(QUEUE_DEF, 'enqueue').run(q, v, 0), q);
    }
    expect(op(STACK_DEF, 'pop').run(st, 0, 0).steps[0]!.narration).toContain('returns 3');
    expect(op(QUEUE_DEF, 'dequeue').run(q, 0, 0).steps[0]!.narration).toContain('returns 1');
    expect(op(STACK_DEF, 'pop').run({ items: [] }, 0, 0).error).toMatch(/InvalidOperationException/);
    expect(op(QUEUE_DEF, 'dequeue').run({ items: [] }, 0, 0).error).toMatch(/InvalidOperationException/);
  });
});

describe('Dictionary and HashSet', () => {
  it('overwrite with the indexer, throw on Add of an existing key, and remove', () => {
    let d: HashTableState = DICT_DEF.initial();
    d = after(op(DICT_DEF, 'set').run(d, 7, 99), d);
    expect(d.entries.find((e) => e?.key === 7)!.value).toBe(99);
    expect(op(DICT_DEF, 'add').run(d, 7, 1).error).toMatch(/ArgumentException/);
    d = after(op(DICT_DEF, 'remove').run(d, 7, 0), d);
    expect(keysOf(d).sort((a, b) => a - b)).toEqual([3, 12]);
  });
  it('keeps every key in bucket key % size through random operations', () => {
    const next = rng(9);
    let d: HashTableState = DICT_DEF.initial();
    let s: HashTableState = SET_DEF.initial();
    const ref = new Set([7, 12, 3]);
    for (let k = 0; k < 300; k++) {
      const key = Math.floor(next() * 40);
      const which = next();
      const td = which < 0.6 ? op(DICT_DEF, 'set').run(d, key, k) : op(DICT_DEF, 'remove').run(d, key, 0);
      const ts = which < 0.6 ? op(SET_DEF, 'add').run(s, key, 0) : op(SET_DEF, 'remove').run(s, key, 0);
      expect(problems(td)).toEqual([]);
      expect(problems(ts)).toEqual([]);
      d = after(td, d);
      s = after(ts, s);
      if (!ts.error) {
        if (which < 0.6) ref.add(key);
        else ref.delete(key);
      }
      for (const t of [d, s]) for (const [b, chain] of (t.buckets ?? []).entries()) for (let i = chain - 1; i >= 0; i = t.entries[i]!.next) expect(t.entries[i]!.key % t.buckets!.length).toBe(b);
      expect(new Set(keysOf(s))).toEqual(ref);
    }
  });
});

describe('PriorityQueue (4-ary min-heap)', () => {
  const heapOk = (s: PQState) => s.nodes.every((n, i) => i === 0 || s.nodes[parentOf(i)]!.priority <= n.priority);
  it('keeps the heap property and dequeues in priority order', () => {
    const next = rng(21);
    let s = pqFrom([]);
    for (let k = 0; k < 20; k++) {
      const p = Math.floor(next() * 50);
      const t = pqEnqueue(s, p, p);
      expect(problems(t)).toEqual([]);
      s = after(t, s);
      expect(heapOk(s)).toBe(true);
      expect(s.hole).toBeNull();
    }
    const out: number[] = [];
    while (s.nodes.length) {
      const t = pqDequeue(s);
      out.push(Number(/root, (\d+)/.exec(t.steps[0]!.narration)![1]));
      s = after(t, s);
      expect(heapOk(s)).toBe(true);
    }
    expect(out).toEqual([...out].sort((a, b) => a - b));
  });
  it('has up to four children per node: parent of 1..4 is 0, of 5..8 is 1', () => {
    expect([1, 2, 3, 4, 5, 8, 9].map(parentOf)).toEqual([0, 0, 0, 0, 1, 1, 2]);
  });
  it('turns into a max-heap with negated priorities', () => {
    let s = pqFrom([]);
    for (const p of [3, 9, 5]) s = after(op(PQ_DEF, 'enqueueMax').run(s, p, p), s);
    expect(s.nodes[0]).toEqual({ element: 9, priority: -9 });
    expect(pqDequeue(pqFrom([])).error).toMatch(/InvalidOperationException/);
  });
});

describe('SortedDictionary (red-black tree)', () => {
  function check(s: SortedState): void {
    const root = s.root;
    if (root) expect(root.red).toBe(false);
    const blackHeight = (n: RBNode | null): number => {
      if (!n) return 1;
      if (n.red) {
        expect(n.left?.red ?? false).toBe(false);
        expect(n.right?.red ?? false).toBe(false);
      }
      const l = blackHeight(n.left);
      expect(blackHeight(n.right)).toBe(l);
      return l + (n.red ? 0 : 1);
    };
    blackHeight(root);
    const keys = inOrder(root).map((n) => n.key);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(s.count);
  }
  it('stays a valid red-black tree through random adds and removes', () => {
    const next = rng(77);
    let s = sortedFrom([]);
    const ref = new Set<number>();
    for (let k = 0; k < 400; k++) {
      const key = Math.floor(next() * 30);
      const t = next() < 0.6 ? op(SORTED_DEF, 'set').run(s, key, k) : op(SORTED_DEF, 'remove').run(s, key, 0);
      expect(problems(t)).toEqual([]);
      if (t.call.startsWith('dict[') && !t.error) ref.add(key);
      if (t.call.startsWith('dict.Remove')) ref.delete(key);
      s = after(t, s);
      check(s);
      expect(inOrder(s.root).map((n) => n.key)).toEqual([...ref].sort((a, b) => a - b));
    }
  });
  it('throws on Add of an existing key and updates in place with the indexer', () => {
    const s = SORTED_DEF.initial();
    expect(op(SORTED_DEF, 'add').run(s, 40, 1).error).toMatch(/ArgumentException/);
    const t = op(SORTED_DEF, 'set').run(cloneSorted(s), 40, 99);
    expect(inOrder(after(t, s).root).find((n) => n.key === 40)!.value).toBe(99);
  });
  it('enumerates keys in sorted order', () => {
    const t = op(SORTED_DEF, 'foreach').run(SORTED_DEF.initial(), 0, 0);
    expect(t.steps.map((s) => /\[(\d+),/.exec(s.narration)![1]).map(Number)).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });
  it('keeps the height logarithmic', () => {
    let s = sortedFrom([]);
    for (let k = 1; k <= 15; k++) s = after(op(SORTED_DEF, 'set').run(s, k, k), s);
    const h = (n: RBNode | null): number => (n ? 1 + Math.max(h(n.left), h(n.right)) : 0);
    expect(h(s.root)).toBeLessThanOrEqual(2 * Math.log2(16));
  });
});

describe('every operation of every collection', () => {
  it('produces readable steps from its starting state', () => {
    for (const def of Object.values(STRUCTURES)) {
      for (const o of def.ops) {
        const s = def.initial();
        if (o.blocked?.(s)) continue;
        expect(problems(o.run(s, 7, 1)), `${def.id}.${o.id}`).toEqual([]);
      }
    }
    expect(LIST_DEF.initial().items).toEqual([]);
  });
});
