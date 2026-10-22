import { describe, expect, it } from 'vitest';
import { NOTE, ORDERS } from '../../../src/viz/sql/notes';
import { COVER_BLOCKS, GUID_KEYS, NEW_GUID, SEEK_BLOCKS, traceCovering, traceSeekScan, traceWriteCost, WRITE_BLOCKS, WRITE_OPS, type CoverMode } from '../../../src/viz/sql/traces/indexes';
import { codeBlocks, normRows, readNote, table } from './helpers';

const n6 = readNote(NOTE.indexes);
const n7 = readNote(NOTE.plans);
const MODES: CoverMode[] = ['scan', 'nci', 'covering'];
const last = <T>(t: T[]) => t[t.length - 1]!;

describe('index code panels quote the notes', () => {
  it('covering, seek/scan and write blocks are verbatim', () => {
    for (const b of COVER_BLOCKS) expect(codeBlocks(n6).some((x) => x.includes(b))).toBe(true);
    for (const b of SEEK_BLOCKS) expect(codeBlocks(n7).some((x) => x.includes(b))).toBe(true);
    for (const b of WRITE_BLOCKS) expect(codeBlocks(n6).some((x) => x.includes(b))).toBe(true);
  });
});

describe('clustered vs non-clustered vs covering', () => {
  it.each(MODES)('%s returns Aman, 60000', (mode) => {
    expect(normRows(table(last(traceCovering(mode)), 'result').rows)).toEqual([['Aman', 60000]]);
  });

  it('a scan reads every leaf page; a seek reads one page per level; the key lookup adds the clustered path', () => {
    expect(last(traceCovering('scan')).counters).toMatchObject({ reads: 3, comparisons: 5, swaps: 0 });
    expect(last(traceCovering('nci')).counters).toMatchObject({ reads: 4, swaps: 1 });
    expect(last(traceCovering('covering')).counters).toMatchObject({ reads: 2, swaps: 0 });
    expect(n6).toContain('❌ No Key Lookup');
  });

  it('finds every name, and nothing when the name is absent', () => {
    for (const name of ['Aman', 'Rahul', 'Priya', 'Neha', 'Karan'])
      for (const m of MODES) expect(table(last(traceCovering(m, name)), 'result').rows.map((r) => r[0])).toEqual([name]);
    expect(table(last(traceCovering('nci', 'Zed')), 'result').rows).toEqual([]);
  });

  it('INCLUDE columns appear only in the leaf pages of the non-clustered index', () => {
    for (const s of traceCovering('covering')) {
      const nci = s.state.trees.find((t) => t.id === 'nci')!;
      expect(nci.root.entries.every((e) => !e.inc)).toBe(true);
      expect(nci.leaves.flatMap((l) => l.entries).every((e) => e.inc?.startsWith('Salary'))).toBe(true);
    }
  });

  it('counters never go backwards and predictions are valid', () => {
    for (const m of MODES) {
      const t = traceCovering(m);
      for (let i = 1; i < t.length; i++) for (const k of ['reads', 'comparisons', 'swaps', 'writes'] as const) expect(t[i]!.counters[k]).toBeGreaterThanOrEqual(t[i - 1]!.counters[k]);
    }
  });
});

describe('seek, scan and key lookup', () => {
  it("CustomerId = 123 (the note's value) finds nothing; CustomerId = 1 needs two key lookups", () => {
    expect(table(last(traceSeekScan('seek', 123)), 'result').rows).toEqual([]);
    const one = last(traceSeekScan('seek', 1));
    expect(normRows(table(one, 'result').rows)).toEqual([[101, 1, 100], [102, 1, 50]]);
    expect(one.counters.swaps).toBe(2);
    const pre = traceSeekScan('seek', 1)[0]!.predict!;
    expect(pre.options[pre.answer]).toBe('2');
  });

  it('every CustomerId value returns exactly its orders', () => {
    for (const v of [1, 2, 3, 4, 5, 123]) expect(table(last(traceSeekScan('seek', v)), 'result').rows.map((r) => r[0])).toEqual(ORDERS.filter((o) => o.CustomerId === v).map((o) => o.OrderId));
  });

  it('Amount > 0 scans the clustered index and returns every order', () => {
    const s = last(traceSeekScan('scan'));
    expect(table(s, 'result').rows).toHaveLength(ORDERS.length);
    expect(s.counters).toMatchObject({ reads: 2, comparisons: 4, swaps: 0 });
  });
});

describe('write cost', () => {
  it("1 clustered + 5 non-clustered = 6 structures for an insert (the note's example)", () => {
    expect(n6).toContain('Then 6 structures must be updated.');
    expect(last(traceWriteCost('insert-seq', 5)).counters.writes).toBe(6);
  });

  it.each(WRITE_OPS.map((w) => w.id))('%s changes the clustered index and every non-clustered index (only the row for a non-indexed column)', (op) => {
    for (let k = 0; k <= 5; k++) {
      const t = traceWriteCost(op, k);
      expect(last(t).counters.writes).toBe(op === 'update-col' ? 1 : 1 + k);
      const p = t[0]!.predict!;
      expect(Number(p.options[p.answer])).toBe(op === 'update-col' ? 1 : 1 + k);
    }
  });

  it('a sequential insert appends a page; a random GUID insert splits a page in the middle', () => {
    const seq = last(traceWriteCost('insert-seq', 0)).state.trees[0]!;
    expect(seq.leaves.map((l) => l.entries.length)).toEqual([2, 2, 1]);
    expect(seq.leaves[2]!.entries[0]!.text).toMatch(/^105/);
    const guid = last(traceWriteCost('insert-guid', 0)).state.trees[0]!;
    expect(guid.leaves.map((l) => l.entries.map((e) => e.text.split(' ')[0]))).toEqual([[GUID_KEYS[0]], [GUID_KEYS[1], NEW_GUID], [GUID_KEYS[2], GUID_KEYS[3]]]);
  });

  it('updating the clustered key deletes the row and inserts it at its new place', () => {
    const keys = last(traceWriteCost('update-key', 0)).state.trees[0]!.leaves.flatMap((l) => l.entries.map((e) => e.text.split(' ')[0]));
    expect(keys).toEqual(['102', '103', '104', '5000']);
  });
});
