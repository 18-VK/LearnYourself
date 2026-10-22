import { describe, expect, it } from 'vitest';
import { NOTE } from '../../../src/viz/sql/notes';
import { ANOMALIES, ANOMALY_COLUMN, EXPECTED_MATRIX, traceIsolation, type IsoOptions, type IsoStep } from '../../../src/viz/sql/traces/isolation';
import { FLOW, LEVELS, NOTE_QUOTES, NOTE_STATEMENTS, setLevel, STMT } from '../../../src/viz/sql/traces/isolation-sql';
import { codeBlocks, noteTable, readNote } from './helpers';

const note = readNote(NOTE.tx);
const blocks = codeBlocks(note);
const final = (o: IsoOptions) => traceIsolation(o).steps.at(-1)!.state;

describe("the note's isolation table", () => {
  const t = noteTable(note, '# Isolation Levels');
  it('is the matrix the simulator shows', () => {
    expect(t.header).toEqual(['Isolation Level', ...ANOMALIES.map((a) => ANOMALY_COLUMN[a])]);
    expect(t.rows.map((r) => r[0])).toEqual(LEVELS);
    for (const r of t.rows) {
      const lvl = r[0] as (typeof LEVELS)[number];
      ANOMALIES.forEach((a, k) => expect(EXPECTED_MATRIX[lvl][a]).toBe(r[k + 1] === 'Yes'));
    }
  });
  it.each(LEVELS)('simulating %s reproduces its row', (level) => {
    const row = t.rows.find((r) => r[0] === level)!;
    ANOMALIES.forEach((a, k) => {
      for (const ending of ['commit', 'rollback'] as const) {
        if (a !== 'dirty' && ending === 'commit') continue;
        expect(traceIsolation({ scenario: a, level, ending }).happened, `${level} / ${a} / ${ending}`).toBe(row[k + 1] === 'Yes');
      }
    });
  });
});

describe('statement provenance', () => {
  it('every statement marked as from the note is in one of its SQL blocks', () => {
    for (const s of NOTE_STATEMENTS) {
      expect(s.file).toBe(NOTE.tx);
      expect(blocks.some((b) => b.includes(s.code)), s.code).toBe(true);
      expect(note).toContain(s.heading);
    }
  });
  it("quotes from the note's prose are in the note", () => {
    for (const q of NOTE_QUOTES) expect(note).toContain(q.code);
  });
  it('statements marked as added are really not in the note', () => {
    for (const s of [...Object.values(STMT), setLevel('READ COMMITTED')].filter((x) => x.prov === 'added')) expect(note.includes(s.code), s.code).toBe(false);
  });
  it('the error text and diagrams are verbatim', () => {
    for (const f of Object.values(FLOW)) expect(blocks.some((b) => b.includes(f.code))).toBe(true);
  });
});

function expectConsistentLocks(steps: IsoStep[]) {
  for (const s of steps) {
    const granted = s.state.locks.filter((l) => !l.waiting);
    for (const a of granted)
      for (const b of granted) {
        if (a === b || a.s === b.s || a.res !== b.res) continue;
        expect(a.mode === 'X' || b.mode === 'X', `${a.res}: ${a.mode} + ${b.mode}`).toBe(false);
      }
    for (const w of s.state.waits) expect(w.from).not.toBe(w.to);
  }
}

describe('isolation scenarios', () => {
  const all: IsoOptions[] = [
    ...LEVELS.flatMap((level) => ANOMALIES.flatMap((scenario) => (['commit', 'rollback'] as const).map((ending) => ({ scenario, level, ending })))),
    ...(['READ COMMITTED', 'READ UNCOMMITTED', 'SNAPSHOT'] as const).flatMap((level) => (['commit', 'rollback'] as const).map((ending) => ({ scenario: 'blocking' as const, level, ending }))),
    { scenario: 'deadlock', victim: 'A' },
    { scenario: 'deadlock', victim: 'B' },
    { scenario: 'deadlock', sameOrder: true },
  ];
  it.each(all.map((o) => [JSON.stringify(o), o] as const))('%s: never grants conflicting locks, ends with none held, answers its own predictions', (_n, o) => {
    const { steps } = traceIsolation(o);
    expect(steps[0]!.action).toBe('start');
    expect(steps.at(-1)!.action).toBe('done');
    expect(steps.at(-1)!.state.outcome).not.toBeNull();
    expectConsistentLocks(steps);
    expect(steps.at(-1)!.state.locks).toEqual([]);
    for (const s of steps) {
      expect(s.narration.length).toBeGreaterThan(0);
      if (s.predict) expect(s.predict.answer).toBeLessThan(s.predict.options.length);
    }
    for (let k = 1; k < steps.length; k++) expect(steps[k]!.state.rows.length).toBeGreaterThanOrEqual(steps[k - 1]!.state.rows.length);
  });

  it('dirty read: READ UNCOMMITTED reads 500, READ COMMITTED waits and reads 1000 after the rollback, SNAPSHOT reads 1000 at once', () => {
    expect(traceIsolation({ scenario: 'dirty', level: 'READ UNCOMMITTED' }).reads).toEqual([{ s: 'B', value: 500, dirty: true }]);
    const rc = traceIsolation({ scenario: 'dirty', level: 'READ COMMITTED' });
    expect(rc.reads).toEqual([{ s: 'B', value: 1000, dirty: false }]);
    expect(rc.steps.at(-1)!.state.rows.map((r) => r.kind)).toEqual(['run', 'run', 'run', 'wait', 'run', 'resume']);
    const pre = rc.steps.find((s) => s.predict)!;
    expect(pre.predict!.options[pre.predict!.answer]).toMatch(/waits/);
    const snap = traceIsolation({ scenario: 'dirty', level: 'SNAPSHOT' });
    expect(snap.reads).toEqual([{ s: 'B', value: 1000, dirty: false }]);
    expect(snap.steps.some((s) => s.state.rows.some((r) => r.kind === 'wait'))).toBe(false);
    // committing instead: READ COMMITTED then reads the committed 500
    expect(traceIsolation({ scenario: 'dirty', level: 'READ COMMITTED', ending: 'commit' }).reads[0]!.value).toBe(500);
  });

  it("non-repeatable read: REPEATABLE READ makes Session B's UPDATE wait for Session A's shared lock", () => {
    const rr = traceIsolation({ scenario: 'nonrepeatable', level: 'REPEATABLE READ' });
    expect(rr.reads.map((r) => r.value)).toEqual([1000, 1000]);
    const rows = rr.steps.at(-1)!.state.rows;
    expect(rows.find((r) => r.kind === 'wait')).toMatchObject({ s: 'B', code: STMT.update500.code });
    expect(final({ scenario: 'nonrepeatable', level: 'REPEATABLE READ' }).accounts[0]!.committed).toBe(500);
    expect(traceIsolation({ scenario: 'nonrepeatable', level: 'READ COMMITTED' }).reads.map((r) => r.value)).toEqual([1000, 500]);
    expect(traceIsolation({ scenario: 'nonrepeatable', level: 'SNAPSHOT' }).reads.map((r) => r.value)).toEqual([1000, 1000]);
  });

  it('phantom: REPEATABLE READ lets the insert through (3 → 4); SERIALIZABLE blocks it with a range lock', () => {
    expect(traceIsolation({ scenario: 'phantom', level: 'REPEATABLE READ' }).reads.map((r) => r.value)).toEqual([3, 4]);
    const ser = traceIsolation({ scenario: 'phantom', level: 'SERIALIZABLE' });
    expect(ser.reads.map((r) => r.value)).toEqual([3, 3]);
    const waitStep = ser.steps.find((s) => s.action === 'compare')!;
    expect(waitStep.state.locks.some((l) => l.mode === 'Range S' && l.s === 'A')).toBe(true);
    expect(final({ scenario: 'phantom', level: 'SERIALIZABLE' }).orders!.filter((r) => !r.pendingBy)).toHaveLength(4);
  });

  it("blocking follows the note's flow: lock row, waiting, commit, continue", () => {
    const { steps, reads, happened } = traceIsolation({ scenario: 'blocking' });
    expect(happened).toBe(true);
    expect(reads).toEqual([{ s: 'B', value: 500, dirty: false }]);
    const flowLines = steps.map((s) => s.state.flow?.[1]).filter((x, i, a) => x !== undefined && x !== a[i - 1]);
    expect(flowLines).toEqual([1, 2, 3, 4]);
    expect(traceIsolation({ scenario: 'blocking', level: 'SNAPSHOT' })).toMatchObject({ happened: false, reads: [{ s: 'B', value: 1000, dirty: false }] });
    expect(traceIsolation({ scenario: 'blocking', level: 'READ UNCOMMITTED' })).toMatchObject({ happened: false, reads: [{ s: 'B', value: 500, dirty: true }] });
  });

  it('deadlock: the cycle is detected, the victim is rolled back and the other session finishes', () => {
    for (const victim of ['A', 'B'] as const) {
      const { steps, happened } = traceIsolation({ scenario: 'deadlock', victim });
      expect(happened).toBe(true);
      expect(steps.some((s) => s.state.cycle && s.state.waits.length === 2)).toBe(true);
      const end = steps.at(-1)!.state;
      expect(end.victim).toBe(victim);
      expect(end.rows.find((r) => r.kind === 'error')).toMatchObject({ s: victim, out: 'Transaction was deadlocked on resources' });
      const balances = end.accounts.map((a) => a.committed);
      expect(balances).toEqual(victim === 'B' ? [100, 300] : [400, 200]);
      expect(steps.at(-1)!.counters.swaps).toBe(1);
    }
    const same = traceIsolation({ scenario: 'deadlock', sameOrder: true });
    expect(same.happened).toBe(false);
    expect(same.steps.some((s) => s.state.cycle)).toBe(false);
    expect(same.steps.at(-1)!.state.accounts.map((a) => a.committed)).toEqual([400, 200]);
  });
});
