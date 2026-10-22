import { describe, expect, it } from 'vitest';
import { bucketOf, chains, expandPrime, getPrime, getPrimeAtLeast, HashTable, keysOf, sizeOf, type HashEvent } from '../../../src/viz/dsa/hash/model';

describe('HashHelpers primes', () => {
  it('GetPrime picks the smallest table prime ≥ min, and 3 for anything ≤ 3', () => {
    expect([0, 1, 3, 4, 7, 8, 11, 12, 17, 18].map(getPrime)).toEqual([3, 3, 3, 7, 7, 11, 11, 17, 17, 23]);
  });
  it('ExpandPrime doubles and rounds up to a prime: 3 → 7 → 17 → 37', () => {
    expect([3, 7, 17].map(expandPrime)).toEqual([7, 17, 37]);
  });
  it('GetPrimeAtLeast finds any prime ≥ min, not only table primes', () => {
    expect([2, 4, 5, 6, 9, 13].map(getPrimeAtLeast)).toEqual([3, 5, 5, 7, 11, 13]);
  });
  it('maps an int to (uint)value % size', () => {
    expect(bucketOf(25, 11)).toBe(3);
    expect(bucketOf(-1, 11)).toBe(4294967295 % 11);
  });
});

describe('HashTable as Dictionary<int, int>', () => {
  it('allocates 3 buckets on the first insert, then resizes 3 → 7 → 17 as it fills', () => {
    const events: HashEvent[] = [];
    const d = new HashTable('dict', (e) => events.push(e));
    for (let k = 0; k < 8; k++) d.insert(k * 10, k, 'overwrite');
    expect(events.filter((e) => e.type === 'init')).toEqual([{ type: 'init', size: 3, reason: 'first insert' }]);
    expect(events.filter((e) => e.type === 'resize').map((e) => (e.type === 'resize' ? [e.from, e.to] : []))).toEqual([[3, 7], [7, 17]]);
    expect(sizeOf(d.t)).toBe(8);
  });
  it('puts new keys at the front of their chain and finds keys by walking it', () => {
    const d = new HashTable('dict');
    d.insert(1, 0, 'overwrite'); // bucket 1
    d.insert(4, 1, 'overwrite'); // 4 % 3 = 1: collision
    expect(chains(d.t)[1]!.map((i) => d.t.entries[i]!.key)).toEqual([4, 1]);
    const events: HashEvent[] = [];
    const probe = new HashTable('dict', (e) => events.push(e));
    probe.t = d.t;
    expect(probe.lookup(1)).toBe(0);
    expect(events.filter((e) => e.type === 'compare').map((e) => (e.type === 'compare' ? e.other : 0))).toEqual([4, 1]);
  });
  it('overwrites the value of an existing key with the indexer', () => {
    const d = new HashTable('dict');
    d.insert(5, 0, 'overwrite');
    d.insert(5, 9, 'overwrite');
    expect(sizeOf(d.t)).toBe(1);
    expect(d.t.entries[0]!.value).toBe(9);
  });
  it('reuses a removed slot for the next insert (free list)', () => {
    const d = new HashTable('dict');
    d.insert(1, 1, 'overwrite');
    d.insert(2, 2, 'overwrite');
    expect(d.remove(1)).toBe(true);
    expect(d.remove(1)).toBe(false);
    expect(keysOf(d.t)).toEqual([2]);
    const r = d.insert(7, 7, 'overwrite');
    expect(r.entry).toBe(0);
    expect(d.t.count).toBe(2);
    expect(keysOf(d.t).sort()).toEqual([2, 7]);
  });
});

describe('HashTable as HashSet<int>', () => {
  it('new HashSet<int>(arr) sizes from arr.Length and ignores duplicates', () => {
    const s = HashTable.fromArray([12, 3, 25, 7, 14, 40, 9, 3]);
    expect(s.t.buckets).toHaveLength(11);
    expect(sizeOf(s.t)).toBe(7);
    expect(chains(s.t)[3]!.map((i) => s.t.entries[i]!.key)).toEqual([14, 25, 3]);
    for (const [b, chain] of chains(s.t).entries()) for (const i of chain) expect(bucketOf(s.t.entries[i]!.key, 11)).toBe(b);
  });
  it('trims excess buckets when most of the input was duplicates', () => {
    const s = HashTable.fromArray([5, 5, 5, 5, 5, 5, 5, 5]);
    // GetPrime(8) = 11 buckets for 1 value: 11 / 1 > 3, so TrimExcess shrinks to GetPrimeAtLeast(1) = 3.
    expect(s.t.buckets).toHaveLength(3);
    expect(keysOf(s.t)).toEqual([5]);
  });
  it('Add returns false for a value that is already present', () => {
    const s = new HashTable('set');
    expect(s.insert(1, null, 'none').added).toBe(true);
    expect(s.insert(1, null, 'none').added).toBe(false);
  });
});
