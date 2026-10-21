import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SORT_CODE, SORT_LABEL, SORT_SOURCE_HEADING, type SortAlgorithm } from '../../../src/viz/sorting/csharp';
import { NOTES_EMPLOYEES } from '../../../src/viz/sorting/traces/counting';
import { SORT_ALGORITHMS, SORT_ORDER } from '../../../src/viz/sorting/traces/index';
import { expectWellFormed, finalValues, sortedCopy } from './helpers';

const notePath = fileURLToPath(new URL('../../../../Competitive%20Programming/sorting-algorithms-notes.md', import.meta.url));
const note = readFileSync(notePath, 'utf8');

/** The cells after the name in the note's "## Summary Table" row for `name`. */
function summaryRow(name: string): string[] {
  const table = note.slice(note.indexOf('## Summary Table')).split(/\r?\n/);
  const line = table.find((l) => l.startsWith(`| ${name} |`));
  if (!line) throw new Error(`No Summary Table row for ${name}`);
  return line.split('|').slice(2, -1).map((c) => c.trim());
}

const ROW_NAME: Record<SortAlgorithm, string> = {
  bubble: 'Bubble Sort',
  selection: 'Selection Sort',
  insertion: 'Insertion Sort',
  merge: 'Merge Sort',
  quick: 'Quick Sort',
  heap: 'Heap Sort',
  countingStable: 'Counting Sort',
  countingSimple: 'Counting Sort',
  countingByAge: 'Counting Sort',
  radix: 'Radix Sort',
  bucket: 'Bucket Sort',
};

describe('sort algorithm registry', () => {
  it('lists every algorithm exactly once, in the expected order', () => {
    expect(SORT_ORDER).toEqual([
      'bubble', 'selection', 'insertion', 'merge', 'quick', 'heap',
      'countingStable', 'countingSimple', 'countingByAge', 'radix', 'bucket',
    ]);
    expect(new Set(SORT_ORDER).size).toBe(SORT_ORDER.length);
    expect([...SORT_ORDER].sort()).toEqual(Object.keys(SORT_CODE).sort());
    expect(Object.keys(SORT_ALGORITHMS).sort()).toEqual(Object.keys(SORT_CODE).sort());
  });

  describe.each(SORT_ORDER)('%s', (id) => {
    const info = SORT_ALGORITHMS[id];

    it('carries the code, label and heading for its id', () => {
      expect(info.id).toBe(id);
      expect(info.code).toBe(SORT_CODE[id]);
      expect(info.label).toBe(SORT_LABEL[id]);
      expect(info.sourceHeading).toBe(SORT_SOURCE_HEADING[id]);
      expect(note).toContain(info.sourceHeading);
    });

    it('sorts its default values with a well-formed trace', () => {
      const { defaultValues } = info.input;
      const t = info.trace(defaultValues);
      expect(finalValues(t)).toEqual(sortedCopy(defaultValues));
      expectWellFormed(t, defaultValues, info.code.split('\n').length);
    });

    it('has default values that fit its own input rules', () => {
      const { kind, min, max, maxLength, defaultValues } = info.input;
      expect(defaultValues.length).toBeGreaterThan(1);
      expect(defaultValues.length).toBeLessThanOrEqual(maxLength);
      for (const v of defaultValues) {
        expect(v).toBeGreaterThanOrEqual(min);
        expect(v).toBeLessThanOrEqual(max);
        if (kind === 'int') expect(Number.isInteger(v)).toBe(true);
        if (kind === 'non-negative-int') expect(Number.isInteger(v) && v >= 0).toBe(true);
        if (kind === 'unit-float') {
          expect(v >= 0 && v < 1).toBe(true);
          expect(Number(v.toFixed(2))).toBe(v);
        }
      }
    });

    it("matches the note's Summary Table row exactly", () => {
      const { best, average, worst, space } = info.complexity;
      const cells = summaryRow(ROW_NAME[id]);
      expect(cells).toEqual([best, average, worst, space, info.stable, info.inPlace]);
      const line = note.split(/\r?\n/).find((l) => l.startsWith(`| ${ROW_NAME[id]} |`))!;
      for (const s of [best, average, worst, space, info.stable, info.inPlace]) expect(line).toContain(s);
    });
  });

  it("defaults the by-age sort to the note's employees and names them", () => {
    const info = SORT_ALGORITHMS.countingByAge;
    expect(info.input.defaultValues).toEqual([30, 25, 30, 25, 28]);
    expect(info.input.defaultValues).toEqual(NOTES_EMPLOYEES.map((e) => e.age));
    const narration = info.trace(info.input.defaultValues).map((s) => s.narration).join('\n');
    expect(narration).toContain('Riya (25)');
  });

  it('uses the input ranges the UI expects', () => {
    expect(SORT_ALGORITHMS.radix.input).toMatchObject({ kind: 'non-negative-int', min: 0, max: 999, maxLength: 12 });
    expect(SORT_ALGORITHMS.bucket.input).toMatchObject({ kind: 'unit-float', min: 0, max: 0.99, maxLength: 10 });
    for (const id of SORT_ORDER.filter((x) => x !== 'radix' && x !== 'bucket')) {
      expect(SORT_ALGORITHMS[id].input).toMatchObject({ kind: 'int', min: 1, max: 99, maxLength: 14 });
    }
  });
});
