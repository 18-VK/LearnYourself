/**
 * A model of .NET's HashSet<int> and Dictionary<int, TValue> internals, used by the hash-search and the
 * collection visualizers. It follows the dotnet/runtime source for int keys:
 *
 * - bucket count is a prime from HashHelpers (GetPrime, ExpandPrime = GetPrime(2 × count), GetPrimeAtLeast)
 *   https://github.com/dotnet/runtime/blob/main/src/libraries/Common/src/System/Collections/HashHelpers.cs
 * - an int's hash code is the int itself, and the bucket is (uint)hashCode % buckets.Length (FastMod on
 *   64-bit computes the same remainder);
 * - buckets hold a 1-based index into the entries array; each entry has a `next` index, so a bucket is a
 *   chain. A new entry goes to the FRONT of its bucket's chain. Lookups compare the stored hash code, then
 *   the value, walking the chain from the front;
 * - when every entry slot is used, Resize allocates GetPrime(2 × count) slots and re-chains every entry in
 *   entries order; removed slots go on a free list that the next insert reuses;
 * - `new HashSet<T>(collection)` starts with GetPrime(collection.Count) buckets, adds each item, then calls
 *   TrimExcess when buckets / count > 3; `new Dictionary<,>()` allocates GetPrime(0) = 3 buckets on the first
 *   insert; the indexer's set overwrites the value of an existing key.
 *   https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/HashSet.cs
 *   https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/Dictionary.cs
 *   https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2.item
 *
 * The views built on it say "simplified": they draw buckets as chains and leave out the entries array,
 * the stored hash codes and the free-list encoding.
 */

export const PRIMES = [
  3, 7, 11, 17, 23, 29, 37, 47, 59, 71, 89, 107, 131, 163, 197, 239, 293, 353, 431, 521, 631, 761, 919, 1103, 1327,
  1597, 1931, 2333, 2801, 3371, 4049, 4861, 5839, 7013, 8419, 10103,
] as const;

const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};

/** HashHelpers.GetPrime: the smallest prime in the table that is ≥ min (3 for min ≤ 3). */
export function getPrime(min: number): number {
  if (min <= 3) return 3;
  for (const p of PRIMES) if (p >= min) return p;
  return getPrimeAtLeast(min);
}

/** HashHelpers.GetPrimeAtLeast: the smallest prime ≥ min, skipping primes p where (p − 1) % 101 == 0. */
export function getPrimeAtLeast(min: number): number {
  if (min <= 3) return 3;
  for (let p = min; ; p++) if (isPrime(p) && (p - 1) % 101 !== 0) return p;
}

/** HashHelpers.ExpandPrime. */
export const expandPrime = (oldSize: number) => getPrime(2 * oldSize);

/** The bucket index for an int key: (uint)key.GetHashCode() % size, and int.GetHashCode() is the int itself. */
export const bucketOf = (key: number, size: number) => (key >>> 0) % size;

const START_OF_FREE_LIST = -3;

export interface HashEntry {
  key: number;
  value: number | null;
  /** -1 = end of chain, ≥ 0 = next entry index, ≤ -2 = this slot is on the free list. */
  next: number;
}

export interface HashTableState {
  kind: 'set' | 'dict';
  /** 1-based indexes into entries; 0 = empty bucket. Null until the first insert allocates them. */
  buckets: number[] | null;
  entries: (HashEntry | null)[];
  count: number;
  freeList: number;
  freeCount: number;
}

export type HashEvent =
  | { type: 'init'; size: number; reason: string }
  | { type: 'hash'; key: number; bucket: number; size: number }
  | { type: 'compare'; key: number; entry: number; other: number; equal: boolean }
  | { type: 'insert'; key: number; entry: number; bucket: number; collision: boolean; reusedFree: boolean }
  | { type: 'overwrite'; key: number; entry: number; old: number | null; value: number | null }
  | { type: 'duplicate'; key: number; entry: number }
  | { type: 'found'; key: number; entry: number }
  | { type: 'missing'; key: number; bucket: number | null }
  | { type: 'resize'; from: number; to: number }
  | { type: 'trim'; from: number; to: number }
  | { type: 'remove'; key: number; entry: number };

export type HashListener = (event: HashEvent, snapshot: HashTableState) => void;

/** Which part of a hash table a step is about (for the views). */
export interface HashHighlight {
  bucket?: number;
  /** Entry index being compared with the key. */
  compare?: number;
  /** Entry index just written. */
  write?: number;
  /** Entry index found. */
  found?: number;
}

export const cloneTable = (t: HashTableState): HashTableState => ({
  ...t,
  buckets: t.buckets ? [...t.buckets] : null,
  entries: t.entries.map((e) => (e ? { ...e } : null)),
});

export function emptyTable(kind: 'set' | 'dict'): HashTableState {
  return { kind, buckets: null, entries: [], count: 0, freeList: -1, freeCount: 0 };
}

/** The entry indexes in each bucket, front of the chain first. */
export function chains(t: HashTableState): number[][] {
  if (!t.buckets) return [];
  return t.buckets.map((b) => {
    const out: number[] = [];
    for (let i = b - 1; i >= 0 && out.length <= t.entries.length; i = t.entries[i]!.next) out.push(i);
    return out;
  });
}

/** Keys in the table, in bucket order (front of each chain first). */
export function keysOf(t: HashTableState): number[] {
  return chains(t).flatMap((c) => c.map((i) => t.entries[i]!.key));
}

export const sizeOf = (t: HashTableState) => t.count - t.freeCount;

/** A mutable hash table that reports every internal step to a listener. */
export class HashTable {
  t: HashTableState;
  constructor(
    kind: 'set' | 'dict',
    private readonly listen: HashListener = () => {},
  ) {
    this.t = emptyTable(kind);
  }

  private emit(e: HashEvent) {
    this.listen(e, cloneTable(this.t));
  }

  /** Initialize(capacity): GetPrime(capacity) buckets and entry slots. */
  initialize(capacity: number, reason: string): number {
    const size = getPrime(capacity);
    this.t.buckets = new Array<number>(size).fill(0);
    this.t.entries = new Array<HashEntry | null>(size).fill(null);
    this.t.freeList = -1;
    this.emit({ type: 'init', size, reason });
    return size;
  }

  private rechain(size: number, entries: (HashEntry | null)[], count: number) {
    const buckets = new Array<number>(size).fill(0);
    for (let i = 0; i < count; i++) {
      const e = entries[i];
      if (e && e.next >= -1) {
        const b = bucketOf(e.key, size);
        e.next = buckets[b]! - 1;
        buckets[b] = i + 1;
      }
    }
    this.t.buckets = buckets;
    this.t.entries = entries;
  }

  private resize() {
    const from = this.t.entries.length;
    const size = expandPrime(this.t.count);
    const entries = new Array<HashEntry | null>(size).fill(null);
    for (let i = 0; i < this.t.count; i++) entries[i] = this.t.entries[i] ? { ...this.t.entries[i]! } : null;
    this.rechain(size, entries, this.t.count);
    this.emit({ type: 'resize', from, to: size });
  }

  /** Walks key's chain; returns the entry index or -1, emitting a compare per entry visited. */
  private find(key: number): { bucket: number; index: number; last: number } {
    const size = this.t.buckets!.length;
    const bucket = bucketOf(key, size);
    this.emit({ type: 'hash', key, bucket, size });
    let last = -1;
    for (let i = this.t.buckets![bucket]! - 1; i >= 0; i = this.t.entries[i]!.next) {
      const other = this.t.entries[i]!.key;
      const equal = other === key;
      this.emit({ type: 'compare', key, entry: i, other, equal });
      if (equal) return { bucket, index: i, last };
      last = i;
    }
    return { bucket, index: -1, last };
  }

  /**
   * HashSet.AddIfNotPresent (value = null) or Dictionary.TryInsert. `behavior` is what happens when the key
   * already exists: 'none' (HashSet.Add returns false), 'overwrite' (indexer set), 'throw' (Dictionary.Add).
   */
  insert(key: number, value: number | null, behavior: 'none' | 'overwrite' | 'throw'): { added: boolean; entry: number } {
    if (!this.t.buckets) this.initialize(0, 'first insert');
    const { bucket: b0, index } = this.find(key);
    if (index >= 0) {
      if (behavior === 'overwrite') {
        const e = this.t.entries[index]!;
        const old = e.value;
        e.value = value;
        this.emit({ type: 'overwrite', key, entry: index, old, value });
      } else {
        this.emit({ type: 'duplicate', key, entry: index });
      }
      return { added: false, entry: index };
    }
    let bucket = b0;
    let slot: number;
    let reusedFree = false;
    if (this.t.freeCount > 0) {
      slot = this.t.freeList;
      this.t.freeList = START_OF_FREE_LIST - this.t.entries[slot]!.next;
      this.t.freeCount--;
      reusedFree = true;
    } else {
      if (this.t.count === this.t.entries.length) {
        this.resize();
        bucket = bucketOf(key, this.t.buckets!.length);
      }
      slot = this.t.count;
      this.t.count++;
    }
    const collision = this.t.buckets![bucket]! !== 0;
    this.t.entries[slot] = { key, value, next: this.t.buckets![bucket]! - 1 };
    this.t.buckets![bucket] = slot + 1;
    this.emit({ type: 'insert', key, entry: slot, bucket, collision, reusedFree });
    return { added: true, entry: slot };
  }

  /** Contains / ContainsKey / TryGetValue. */
  lookup(key: number): number {
    if (!this.t.buckets) {
      this.emit({ type: 'missing', key, bucket: null });
      return -1;
    }
    const { bucket, index } = this.find(key);
    if (index >= 0) this.emit({ type: 'found', key, entry: index });
    else this.emit({ type: 'missing', key, bucket });
    return index;
  }

  remove(key: number): boolean {
    if (!this.t.buckets) {
      this.emit({ type: 'missing', key, bucket: null });
      return false;
    }
    const { bucket, index, last } = this.find(key);
    if (index < 0) {
      this.emit({ type: 'missing', key, bucket });
      return false;
    }
    const e = this.t.entries[index]!;
    if (last < 0) this.t.buckets![bucket] = e.next + 1;
    else this.t.entries[last]!.next = e.next;
    e.next = START_OF_FREE_LIST - this.t.freeList;
    this.t.freeList = index;
    this.t.freeCount++;
    this.emit({ type: 'remove', key, entry: index });
    return true;
  }

  /** TrimExcess(Count): shrink to GetPrimeAtLeast(Count) slots when that is smaller, keeping entries in order. */
  trimExcess(): void {
    const n = sizeOf(this.t);
    const size = getPrimeAtLeast(n);
    const from = this.t.entries.length;
    if (size >= from) return;
    const kept: HashEntry[] = [];
    for (let i = 0; i < this.t.count; i++) {
      const e = this.t.entries[i];
      if (e && e.next >= -1) kept.push({ ...e });
    }
    const entries = new Array<HashEntry | null>(size).fill(null);
    kept.forEach((e, i) => (entries[i] = e));
    this.t.count = kept.length;
    this.t.freeCount = 0;
    this.t.freeList = -1;
    this.rechain(size, entries, kept.length);
    this.emit({ type: 'trim', from, to: size });
  }

  /** `new HashSet<int>(arr)`: Initialize(arr.Length), add each item, TrimExcess if buckets / count > 3. */
  static fromArray(arr: readonly number[], listen?: HashListener): HashTable {
    const h = new HashTable('set', listen);
    if (arr.length > 0) h.initialize(arr.length, `new HashSet<int>(arr) sizes itself from arr.Length = ${arr.length}`);
    for (const v of arr) h.insert(v, null, 'none');
    if (h.t.count > 0 && Math.floor(h.t.entries.length / h.t.count) > 3) h.trimExcess();
    return h;
  }
}
