import type { Trace } from '../../engine/types';
import { SORT_CODE, SORT_LABEL, SORT_SOURCE_HEADING, type SortAlgorithm } from '../csharp';
import { traceBubble } from './bubble';
import { traceBucket } from './bucket';
import { NOTES_EMPLOYEES, traceCountingByAge, traceCountingSimple, traceCountingStable } from './counting';
import { traceHeap } from './heap';
import { traceInsertion } from './insertion';
import { traceMerge } from './merge';
import { traceQuick } from './quick';
import { traceRadix } from './radix';
import { traceSelection } from './selection';

export type InputKind = 'int' | 'non-negative-int' | 'unit-float';

export interface SortAlgorithmInfo {
  id: SortAlgorithm;
  label: string;
  code: string;
  sourceHeading: string;
  trace: (input: readonly number[]) => Trace;
  input: { kind: InputKind; min: number; max: number; maxLength: number; defaultValues: number[] };
  /** Copied exactly from the note's "## Summary Table" row (the counting variants use the Counting Sort row). */
  complexity: { best: string; average: string; worst: string; space: string };
  stable: 'Yes' | 'No' | 'Depends';
  inPlace: 'Yes' | 'No';
}

type Row = Pick<SortAlgorithmInfo, 'complexity' | 'stable' | 'inPlace'>;
const row = (best: string, average: string, worst: string, space: string, stable: SortAlgorithmInfo['stable'], inPlace: SortAlgorithmInfo['inPlace']): Row => ({
  complexity: { best, average, worst, space },
  stable,
  inPlace,
});

// Summary Table rows from `Competitive Programming/sorting-algorithms-notes.md`.
const COUNTING_ROW = row('O(n+k)', 'O(n+k)', 'O(n+k)', 'O(n+k)', 'Yes', 'No');

const ints = (defaultValues: number[]): SortAlgorithmInfo['input'] => ({ kind: 'int', min: 1, max: 99, maxLength: 14, defaultValues });

const info = (id: SortAlgorithm, trace: SortAlgorithmInfo['trace'], input: SortAlgorithmInfo['input'], r: Row): SortAlgorithmInfo => ({
  id,
  label: SORT_LABEL[id],
  code: SORT_CODE[id],
  sourceHeading: SORT_SOURCE_HEADING[id],
  trace,
  input,
  ...r,
});

export const SORT_ALGORITHMS: Record<SortAlgorithm, SortAlgorithmInfo> = {
  bubble: info('bubble', traceBubble, ints([5, 1, 4, 2, 8]), row('O(n)', 'O(n²)', 'O(n²)', 'O(1)', 'Yes', 'Yes')),
  selection: info('selection', traceSelection, ints([64, 25, 12, 22, 11]), row('O(n²)', 'O(n²)', 'O(n²)', 'O(1)', 'No', 'Yes')),
  insertion: info('insertion', traceInsertion, ints([2, 5, 7, 3]), row('O(n)', 'O(n²)', 'O(n²)', 'O(1)', 'Yes', 'Yes')),
  merge: info('merge', traceMerge, ints([38, 27, 43, 3, 9, 82, 10]), row('O(n log n)', 'O(n log n)', 'O(n log n)', 'O(n)', 'Yes', 'No')),
  quick: info('quick', traceQuick, ints([10, 80, 30, 90, 40, 50, 70]), row('O(n log n)', 'O(n log n)', 'O(n²)', 'O(log n)', 'No', 'Yes')),
  heap: info('heap', traceHeap, ints([4, 10, 3, 5, 1, 8]), row('O(n log n)', 'O(n log n)', 'O(n log n)', 'O(1)', 'No', 'Yes')),
  countingStable: info('countingStable', traceCountingStable, ints([4, 2, 2, 8, 3, 3, 1]), COUNTING_ROW),
  countingSimple: info('countingSimple', traceCountingSimple, ints([4, 2, 2, 8, 3, 3, 1]), COUNTING_ROW),
  // Called with the note's ages, the trace names the employees from NOTES_EMPLOYEES.
  countingByAge: info('countingByAge', (ages) => traceCountingByAge(ages), ints(NOTES_EMPLOYEES.map((e) => e.age)), COUNTING_ROW),
  radix: info(
    'radix',
    traceRadix,
    { kind: 'non-negative-int', min: 0, max: 999, maxLength: 12, defaultValues: [170, 45, 75, 90, 802, 24, 2, 66] },
    row('O(d(n+b))', 'O(d(n+b))', 'O(d(n+b))', 'O(n+b)', 'Yes', 'No'),
  ),
  bucket: info(
    'bucket',
    traceBucket,
    { kind: 'unit-float', min: 0, max: 0.99, maxLength: 10, defaultValues: [0.42, 0.32, 0.23, 0.52, 0.25, 0.47, 0.51] },
    row('O(n+k)', 'O(n+k)', 'O(n²)', 'O(n+k)', 'Depends', 'No'),
  ),
};

export const SORT_ORDER: SortAlgorithm[] = [
  'bubble',
  'selection',
  'insertion',
  'merge',
  'quick',
  'heap',
  'countingStable',
  'countingSimple',
  'countingByAge',
  'radix',
  'bucket',
];
