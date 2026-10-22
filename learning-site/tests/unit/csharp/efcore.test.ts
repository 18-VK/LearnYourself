import { describe, expect, it } from 'vitest';
import { EF_STATE_PARTS, efStatePart, NP_PARTS, NP_RANGE, npPart, type EntityState } from '../../../src/viz/csharp/traces/efcore';
import { textAt } from '../../../src/viz/csharp/shared/step';
import { expectWellFormed } from './helpers';

/** The states an entity goes through, collapsing repeats. */
function states(id: string, entity: string): EntityState[] {
  const out: EntityState[] = [];
  for (const s of efStatePart(id).trace) {
    const e = s.state.entries.find((x) => x.name === entity);
    if (e && out[out.length - 1] !== e.state) out.push(e.state);
  }
  return out;
}

describe('change tracker states (EFCore/Notes.md CRUD examples)', () => {
  for (const { id } of EF_STATE_PARTS) {
    it(`${id} is well formed`, () => {
      const p = efStatePart(id);
      expectWellFormed(p.trace, p.doc);
    });
  }
  it('insert: Detached → Added → Unchanged (after INSERT) → Detached (context disposed)', () => {
    expect(states('insert', 'product')).toEqual(['Detached', 'Added', 'Unchanged', 'Detached']);
    const last = efStatePart('insert').trace.at(-1)!.state;
    expect(last.sql).toEqual(["INSERT INTO Products (Name, Price) VALUES ('Laptop', 75000)"]);
    expect(last.output).toEqual(['Product inserted with ID: 1']);
  });
  it('update: Unchanged → Modified (found by DetectChanges in SaveChanges) → Unchanged, with one UPDATE', () => {
    expect(states('update', 'product')).toEqual(['Unchanged', 'Modified', 'Unchanged', 'Detached']);
    const t = efStatePart('update').trace;
    const modified = t.find((s) => s.state.entries[0]?.state === 'Modified')!;
    expect(textAt(efStatePart('update').doc, modified.codeLine).trim()).toBe('db.SaveChanges();');
    expect(t.at(-1)!.state.rows[0]!.cols.Name).toBe('Better Pen Drive');
  });
  it('delete: Unchanged → Deleted → Detached after the DELETE', () => {
    expect(states('delete', 'product')).toEqual(['Unchanged', 'Deleted', 'Detached']);
    const last = efStatePart('delete').trace.at(-1)!.state;
    expect(last.rows).toEqual([]);
    expect(last.sql.at(-1)).toBe('DELETE FROM Products WHERE Id = 1');
  });
  it('AsNoTracking: the tracked change is saved, the untracked one sends no SQL', () => {
    const t = efStatePart('no-tracking').trace;
    const last = t.at(-1)!.state;
    expect(last.rows.map((r) => r.cols.Name)).toEqual(['Updated Name', '(original)']);
    expect(last.sql.filter((q) => q.startsWith('UPDATE'))).toHaveLength(1);
    expect(states('no-tracking', 'untrackedCustomer')).toEqual(['Detached']);
  });
  it('only tracked entities change state while the context is open; nothing is tracked after disposal', () => {
    for (const { id } of EF_STATE_PARTS) {
      const last = efStatePart(id).trace.at(-1)!.state;
      expect(last.contextOpen).toBe(false);
      expect(last.entries.every((e) => e.state === 'Detached')).toBe(true);
    }
  });
});

describe('N+1 (Notes2.md › Lazy Loading, 11.Question.md › The N+1 Problem)', () => {
  for (const { id } of NP_PARTS) {
    for (let n = NP_RANGE.min; n <= NP_RANGE.max; n++) {
      it(`${id} with ${n}: well formed, round trips = ${id === 'include' || id === 'projection' ? '1' : 'n + 1'}`, () => {
        const p = npPart(id, n);
        expectWellFormed(p.trace, p.doc);
        const trips = p.trace.at(-1)!.state.queries.length;
        expect(trips).toBe(id === 'include' || id === 'projection' ? 1 : n + 1);
        expect(p.trace.at(-1)!.state.parents.every((x) => x.childrenLoaded)).toBe(true);
        // the round-trip question's answer is the real count
        const q = p.trace[0]!.predict!;
        expect(Number(q.options[q.answer])).toBe(trips);
      });
    }
  }
  it('highlights the per-user ToList() inside the loop, not the first one', () => {
    const p = npPart('per-user', 2);
    const loopQueries = p.trace.filter((s) => s.narration.includes('is another query'));
    expect(loopQueries.map((s) => textAt(p.doc, s.codeLine).trim())).toEqual(['.ToList();', '.ToList();']);
    expect(loopQueries.every((s) => s.codeLine > 3)).toBe(true);
  });
  it('round trips never decrease and each loop query names its parent', () => {
    const t = npPart('per-user', 4).trace;
    for (let i = 1; i < t.length; i++) expect(t[i]!.state.queries.length).toBeGreaterThanOrEqual(t[i - 1]!.state.queries.length);
    expect(t.at(-1)!.state.queries.slice(1)).toEqual([1, 2, 3, 4].map((k) => `SELECT … FROM Orders WHERE UserId = ${k}`));
  });
});
