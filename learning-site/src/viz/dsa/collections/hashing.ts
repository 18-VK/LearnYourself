import { cloneTable, HashTable, sizeOf, type HashEvent, type HashTableState } from '../hash/model';
import type { Cost, OpStep, OpTrace, StructureDef } from './types';

/**
 * Dictionary<int, int> and HashSet<int> on the bucket model in ../hash/model.ts (prime bucket counts,
 * bucket = key % buckets, new entries at the front of the chain, resize to GetPrime(2 × count)).
 * Costs come from the cheat sheet's "## 3. Hashing — Fast Lookup" table; Dictionary.Remove is not in that
 * table, so its cost comes from Microsoft's docs.
 */
export const MAX_HASH = 24;

const SET_COST: Cost = { ops: 'Add/Contains/Remove', cost: 'O(1) avg', source: 'notes' };
const DICT_COST: Cost = { ops: 'Get/Set', cost: 'O(1) avg', source: 'notes' };
const DICT_REMOVE: Cost = { ops: 'Remove', cost: 'approaches O(1)', source: 'https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2.remove' };

function narrate(e: HashEvent, t: HashTableState): string {
  switch (e.type) {
    case 'init':
      return `No buckets yet, so the first insert allocates GetPrime(0) = ${e.size} buckets.`;
    case 'hash':
      return `${e.key}.GetHashCode() = ${e.key}, so look in bucket ${e.key} % ${e.size} = ${e.bucket}${t.buckets![e.bucket] === 0 ? ', which is empty' : ''}.`;
    case 'compare':
      return e.equal ? `The chain holds ${e.other}: equal to ${e.key}.` : `The chain holds ${e.other}, not ${e.key}: follow the chain.`;
    case 'insert':
      return `${e.key} goes to the front of bucket ${e.bucket}${e.collision ? ', which already had an entry: a collision, so the chain grows' : ''}${e.reusedFree ? ' (in a slot freed by an earlier Remove)' : ''}.`;
    case 'overwrite':
      return `${e.key} is already a key: the indexer replaces its value ${e.old} with ${e.value}.`;
    case 'duplicate':
      return t.kind === 'set' ? `${e.key} is already in the set: Add returns false.` : `${e.key} is already a key.`;
    case 'found':
      return `Found ${e.key}.`;
    case 'missing':
      return e.bucket === null ? `The table has no buckets yet, so ${e.key} is not there.` : `End of the chain: ${e.key} is not there.`;
    case 'resize':
      return `All ${e.from} entry slots are in use, so it resizes to GetPrime(2 × ${e.from}) = ${e.to} buckets and re-chains every entry. This one insert is O(n); spread over all inserts it stays O(1) on average.`;
    case 'trim':
      return `TrimExcess shrinks the table to ${e.to} buckets.`;
    case 'remove':
      return `Unlink ${e.key} from its chain; its entry slot goes on the free list for the next insert.`;
  }
}

function run(state: HashTableState, f: (h: HashTable) => void): { steps: OpStep<HashTableState>[]; compares: number } {
  const steps: OpStep<HashTableState>[] = [];
  let compares = 0;
  let bucket: number | undefined;
  const h = new HashTable(state.kind, (e, t) => {
    if (e.type === 'hash') bucket = e.bucket;
    if (e.type === 'resize' || e.type === 'init' || e.type === 'trim') bucket = undefined;
    if (e.type === 'compare') compares++;
    const hl =
      e.type === 'compare'
        ? { bucket, compare: e.entry }
        : e.type === 'insert'
          ? { bucket: e.bucket, write: e.entry }
          : e.type === 'overwrite'
            ? { bucket, write: e.entry }
            : e.type === 'found' || e.type === 'duplicate'
              ? { bucket, found: e.entry }
              : { ...(bucket !== undefined ? { bucket } : {}) };
    steps.push({ state: t, narration: narrate(e, t), hl: { hash: hl } });
  });
  h.t = cloneTable(state);
  f(h);
  return { steps, compares };
}

const comparedText = (n: number) => `compared with ${n} entr${n === 1 ? 'y' : 'ies'} in one bucket`;
const full = (call: string, cost: Cost): OpTrace<HashTableState> => ({ call, cost, work: 'nothing', steps: [], error: `This demo stops at ${MAX_HASH} entries.` });

function seeded(kind: 'set' | 'dict'): HashTableState {
  const h = new HashTable(kind);
  [7, 12, 3].forEach((k, i) => h.insert(k, kind === 'dict' ? (i + 1) * 10 : null, 'overwrite'));
  return cloneTable(h.t);
}

export const DICT_DEF: StructureDef<HashTableState> = {
  id: 'dictionary-buckets',
  title: 'Dictionary<TKey, TValue>',
  variable: 'dict',
  section: '## 3. Hashing — Fast Lookup',
  costs: [DICT_COST, DICT_REMOVE],
  initial: () => seeded('dict'),
  setup: 'var dict = new Dictionary<int, int>(); // then dict[7] = 10; dict[12] = 20; dict[3] = 30;',
  ops: [
    {
      id: 'set',
      label: 'dict[key] = value',
      arg: 'key-value',
      run: (s, k, v) => {
        const call = `dict[${k}] = ${v};`;
        if (sizeOf(s) >= MAX_HASH && !s.entries.some((e) => e && e.next >= -1 && e.key === k)) return full(call, DICT_COST);
        const r = run(s, (h) => h.insert(k, v, 'overwrite'));
        return { call, cost: DICT_COST, work: comparedText(r.compares), steps: r.steps };
      },
    },
    {
      id: 'add',
      label: 'Add(key, value)',
      arg: 'key-value',
      run: (s, k, v) => {
        const call = `dict.Add(${k}, ${v});`;
        if (sizeOf(s) >= MAX_HASH) return full(call, DICT_COST);
        const r = run(s, (h) => h.insert(k, v, 'throw'));
        const dup = r.steps.some((st) => st.narration.endsWith('is already a key.'));
        return dup
          ? { call, cost: DICT_COST, work: comparedText(r.compares), steps: r.steps, error: `ArgumentException: an item with the key ${k} has already been added. Add never overwrites; the indexer does.` }
          : { call, cost: DICT_COST, work: comparedText(r.compares), steps: r.steps };
      },
    },
    {
      id: 'tryget',
      label: 'TryGetValue(key)',
      arg: 'key',
      run: (s, k) => {
        let idx = -1;
        const r = run(s, (h) => (idx = h.lookup(k)));
        const v = idx >= 0 ? s.entries[idx]!.value : null;
        r.steps.push({ state: r.steps.at(-1)?.state ?? cloneTable(s), narration: idx >= 0 ? `TryGetValue returns true with value = ${v}.` : 'TryGetValue returns false.', hl: r.steps.at(-1)?.hl ?? {} });
        return { call: `dict.TryGetValue(${k}, out var value);`, cost: DICT_COST, work: comparedText(r.compares), steps: r.steps };
      },
    },
    {
      id: 'remove',
      label: 'Remove(key)',
      arg: 'key',
      run: (s, k) => {
        let ok = false;
        const r = run(s, (h) => (ok = h.remove(k)));
        r.steps.push({ state: r.steps.at(-1)?.state ?? cloneTable(s), narration: `Remove returns ${ok}.`, hl: {} });
        return { call: `dict.Remove(${k});`, cost: DICT_REMOVE, work: comparedText(r.compares), steps: r.steps };
      },
    },
  ],
  simplified: 'Each bucket is drawn with its chain under it. .NET keeps all entries in one array linked by index, stores each key\'s hash code, and reuses removed slots through a free list.',
  summary: (s) => `Count ${sizeOf(s)} · ${s.buckets?.length ?? 0} buckets`,
};

export const SET_DEF: StructureDef<HashTableState> = {
  id: 'hash-set',
  title: 'HashSet<T>',
  variable: 'set',
  section: '## 3. Hashing — Fast Lookup',
  costs: [SET_COST],
  initial: () => seeded('set'),
  setup: 'var set = new HashSet<int>(); // then Add(7), Add(12), Add(3)',
  ops: [
    {
      id: 'add',
      label: 'Add',
      arg: 'value',
      run: (s, v) => {
        const call = `set.Add(${v});`;
        if (sizeOf(s) >= MAX_HASH) return full(call, SET_COST);
        let added = false;
        const r = run(s, (h) => (added = h.insert(v, null, 'none').added));
        r.steps.push({ state: r.steps.at(-1)!.state, narration: `Add returns ${added}.`, hl: r.steps.at(-1)!.hl });
        return { call, cost: SET_COST, work: comparedText(r.compares), steps: r.steps };
      },
    },
    {
      id: 'contains',
      label: 'Contains',
      arg: 'value',
      run: (s, v) => {
        let idx = -1;
        const r = run(s, (h) => (idx = h.lookup(v)));
        r.steps.push({ state: r.steps.at(-1)?.state ?? cloneTable(s), narration: `Contains returns ${idx >= 0}, after looking in one bucket only.`, hl: r.steps.at(-1)?.hl ?? {} });
        return { call: `set.Contains(${v});`, cost: SET_COST, work: comparedText(r.compares), steps: r.steps };
      },
    },
    {
      id: 'remove',
      label: 'Remove',
      arg: 'value',
      run: (s, v) => {
        let ok = false;
        const r = run(s, (h) => (ok = h.remove(v)));
        r.steps.push({ state: r.steps.at(-1)?.state ?? cloneTable(s), narration: `Remove returns ${ok}.`, hl: {} });
        return { call: `set.Remove(${v});`, cost: SET_COST, work: comparedText(r.compares), steps: r.steps };
      },
    },
  ],
  simplified: DICT_DEF.simplified,
  summary: (s) => `Count ${sizeOf(s)} · ${s.buckets?.length ?? 0} buckets`,
};
