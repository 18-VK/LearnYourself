import { HashTable, cloneTable, sizeOf, type HashEvent, type HashTableState } from '../../dsa/hash/model';
import { lines } from '../../engine/code';
import type { ActionKind, Highlights } from '../../engine/types';
import { SEARCH_CODE } from '../csharp';
import { SearchRecorder, type HashHighlight, type SearchTrace } from '../recorder';

export const HASH_LINES = lines(SEARCH_CODE.hash, {
  set: 'var seen = new HashSet<int>(arr);',
  contains: 'bool exists = seen.Contains(target);',
  dict: 'var index = new Dictionary<int, int>();',
  loop: 'for (int i = 0; i < arr.Length; i++) index[arr[i]] = i;',
});

/**
 * Mirrors the note's hash-based search: build a HashSet<int> from arr, call Contains(target), then build a
 * value → index Dictionary<int, int>. The bucket layout comes from the model in src/viz/dsa/hash/model.ts,
 * which follows dotnet/runtime (prime bucket counts, bucket = hash % count, new entries at the chain front).
 */
export function traceHash(arr: readonly number[], target: number): SearchTrace {
  const L = HASH_LINES;
  const r = new SearchRecorder(arr);
  r.hash = { seen: null, index: null, focus: 'seen', hl: {} };
  let line: number = L.set;
  let active: number[] = [];
  let vars: Record<string, string | number | boolean> = { target };
  let collisions = 0;
  const show = (which: 'seen' | 'index', t: HashTableState, hl: HashHighlight) => {
    r.hash = { ...r.hash!, [which]: t, focus: which, hl };
  };
  const emit = (action: ActionKind, narration: string, hl: Highlights = {}) => r.step(action, line, narration, { active, ...hl }, { ...vars, collisions });

  const listener = (which: 'seen' | 'index') => (e: HashEvent, t: HashTableState) => {
    const name = which === 'seen' ? 'seen' : 'index';
    switch (e.type) {
      case 'init':
        show(which, t, {});
        emit('start', which === 'seen' ? `${e.reason}: it allocates GetPrime(${arr.length}) = ${e.size} buckets.` : `The first insert allocates GetPrime(0) = ${e.size} buckets.`);
        break;
      case 'hash':
        r.probe();
        show(which, t, { bucket: e.bucket });
        emit('select', `${e.key}.GetHashCode() = ${e.key}, so the bucket is ${e.key} % ${e.size} = ${e.bucket}.${t.buckets![e.bucket] === 0 ? ' It is empty.' : ''}`);
        break;
      case 'compare':
        r.compare();
        show(which, t, { bucket: r.hash!.hl.bucket!, compare: e.entry });
        emit('compare', e.equal ? `Bucket ${r.hash!.hl.bucket} holds ${e.other}: equal to ${e.key}.` : `Bucket ${r.hash!.hl.bucket} holds ${e.other}: not ${e.key}, so follow the chain.`);
        break;
      case 'insert':
        if (e.collision) collisions++;
        show(which, t, { bucket: e.bucket, write: e.entry });
        emit(
          'write',
          which === 'seen'
            ? `${e.key} is new: it goes to the front of bucket ${e.bucket}${e.collision ? `. That bucket already had a value: a collision, so the chain grows to ${chainLength(t, e.bucket)}` : ''}.`
            : `index[${e.key}] = ${t.entries[e.entry]!.value}: a new key in bucket ${e.bucket}${e.collision ? ` (a collision: the chain is now ${chainLength(t, e.bucket)} long)` : ''}.`,
        );
        break;
      case 'duplicate':
        show(which, t, { bucket: r.hash!.hl.bucket!, found: e.entry });
        emit('branch', `${e.key} is already in ${name}, so Add returns false and nothing changes.`);
        break;
      case 'overwrite':
        show(which, t, { bucket: r.hash!.hl.bucket!, write: e.entry });
        emit('write', `${e.key} is already a key, so the indexer replaces its value ${e.old} with ${e.value}. With duplicates, the last index wins.`);
        break;
      case 'resize':
        show(which, t, {});
        emit('write', `All ${e.from} entry slots are used, so the dictionary resizes to GetPrime(2 × ${e.from}) = ${e.to} buckets and re-chains every key.`);
        break;
      case 'trim':
        show(which, t, {});
        emit('write', `Only ${sizeOf(t)} distinct value${sizeOf(t) === 1 ? '' : 's'} for ${e.from} buckets (more than 3 per value), so the constructor calls TrimExcess: now ${e.to} buckets.`);
        break;
      case 'found':
        show(which, t, { bucket: r.hash!.hl.bucket!, found: e.entry });
        break;
      case 'missing':
        show(which, t, e.bucket === null ? {} : { bucket: e.bucket });
        break;
      case 'remove':
        break;
    }
  };

  // 1. var seen = new HashSet<int>(arr);
  r.step('start', line, `Build a HashSet<int> from the ${arr.length} values in arr.`, {}, vars);
  const seen = new HashTable('set', listener('seen'));
  if (arr.length > 0) seen.initialize(arr.length, `new HashSet<int>(arr) sizes itself from arr.Length = ${arr.length}`);
  arr.forEach((v, i) => {
    r.read(i);
    active = [i];
    vars = { target, item: v };
    seen.insert(v, null, 'none');
  });
  active = [];
  if (seen.t.count > 0 && Math.floor(seen.t.entries.length / seen.t.count) > 3) seen.trimExcess();
  show('seen', cloneTable(seen.t), {});
  vars = { target };
  emit('branch', `seen holds ${sizeOf(seen.t)} distinct value${sizeOf(seen.t) === 1 ? '' : 's'} in ${seen.t.buckets?.length ?? 0} buckets, with ${collisions} collision${collisions === 1 ? '' : 's'} along the way.`);

  // 2. bool exists = seen.Contains(target);
  line = L.contains;
  const before = r.c.comparisons;
  emit('call', `seen.Contains(${target}): hash the target and look in one bucket only.`);
  const found = seen.lookup(target) >= 0;
  const looked = r.c.comparisons - before;
  vars = { target, exists: found };
  emit('compare', found ? `exists = true: found after ${looked} comparison${looked === 1 ? '' : 's'} in one bucket, without scanning the array.` : `exists = false: the bucket ${looked === 0 ? 'is empty' : `chain ended after ${looked} comparison${looked === 1 ? '' : 's'}`}, so ${target} is not in the set.`);

  // 3. var index = new Dictionary<int, int>();
  line = L.dict;
  collisions = 0;
  const index = new HashTable('dict', listener('index'));
  show('index', cloneTable(index.t), {});
  emit('call', 'new Dictionary<int, int>(): empty. It allocates its buckets on the first insert.');

  // 4. for (...) index[arr[i]] = i;
  line = L.loop;
  for (let i = 0; i < arr.length; i++) {
    const v = r.read(i);
    active = [i];
    vars = { target, exists: found, i };
    emit('branch', `i = ${i}: index[arr[${i}]] = index[${v}] = ${i}.`, { pointers: { i } });
    index.insert(v, i, 'overwrite');
  }
  active = [];
  vars = { target, exists: found };
  show('index', cloneTable(index.t), {});
  r.step(
    'done',
    line,
    `Done. exists = ${found}. index maps ${sizeOf(index.t)} value${sizeOf(index.t) === 1 ? '' : 's'} to ${sizeOf(index.t) === 1 ? 'its' : 'their'} index, so later lookups such as index[${arr[0] ?? target}] cost O(1) on average.`,
    {},
    { ...vars, collisions },
    undefined,
    `exists = ${found}`,
  );
  return r.steps;
}

function chainLength(t: HashTableState, bucket: number): number {
  let k = 0;
  for (let i = t.buckets![bucket]! - 1; i >= 0 && k <= t.entries.length; i = t.entries[i]!.next) k++;
  return k;
}
