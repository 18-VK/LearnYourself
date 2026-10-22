import { SEARCH_CODE, SEARCH_SOURCE_HEADING, type SearchCodeId } from '../csharp';
import type { SearchTrace } from '../recorder';
import { traceBinary, traceBinaryRec } from './binary';
import { traceBounds } from './bounds';
import { traceExponential } from './exponential';
import { traceHash } from './hash';
import { traceInterpolation } from './interpolation';
import { traceJump } from './jump';
import { traceLinear } from './linear';
import { SQRT_MAX_X, traceSqrt } from './sqrt';
import { traceTernary } from './ternary';

export type SearchAlgorithm = 'linear' | 'binary' | 'binaryRec' | 'bounds' | 'sqrt' | 'jump' | 'interpolation' | 'exponential' | 'ternary' | 'hash';

/**
 * What the input has to look like:
 * - any: any integers (linear and hash search do not need sorted input);
 * - sorted: sorted ascending (unsorted input is sorted, and the visualizer says so);
 * - unimodal: strictly rising, then strictly falling (other input is rejected);
 * - number: a single whole number x (binary search on the answer, MySqrt).
 */
export type InputKind = 'any' | 'sorted' | 'unimodal' | 'number';

export interface SearchAlgorithmInfo {
  id: SearchAlgorithm;
  label: string;
  codeId: SearchCodeId;
  code: string;
  sourceHeading: string;
  /** The row name in the note's "## Summary Table". */
  summaryRow: string;
  /** Copied from that row: Time (avg), Time (worst), Space, Needs Sorted? */
  complexity: { average: string; worst: string; space: string; sorted: string };
  input: InputKind;
  needsTarget: boolean;
  min: number;
  max: number;
  minLength: number;
  maxLength: number;
  defaults: { values: number[]; target: number };
  trace: (values: readonly number[], target: number) => SearchTrace;
}

const row = (average: string, worst: string, space: string, sorted: string) => ({ average, worst, space, sorted });

const info = (
  id: SearchAlgorithm,
  label: string,
  codeId: SearchCodeId,
  summaryRow: string,
  complexity: SearchAlgorithmInfo['complexity'],
  input: InputKind,
  defaults: SearchAlgorithmInfo['defaults'],
  trace: SearchAlgorithmInfo['trace'],
  limits: Partial<Pick<SearchAlgorithmInfo, 'min' | 'max' | 'minLength' | 'maxLength' | 'needsTarget'>> = {},
): SearchAlgorithmInfo => ({
  id,
  label,
  codeId,
  code: SEARCH_CODE[codeId],
  sourceHeading: SEARCH_SOURCE_HEADING[codeId],
  summaryRow,
  complexity,
  input,
  needsTarget: true,
  min: 0,
  max: 99,
  minLength: 1,
  maxLength: 16,
  defaults,
  trace,
  ...limits,
});

// Summary Table rows from `Competitive Programming/searching-algorithms-notes.md` (checked by the unit tests).
export const SEARCH_ALGORITHMS: Record<SearchAlgorithm, SearchAlgorithmInfo> = {
  linear: info('linear', 'Linear search', 'linear', 'Linear Search', row('O(n)', 'O(n)', 'O(1)', 'No'), 'any', { values: [7, 3, 9, 1, 8, 4, 6], target: 8 }, traceLinear),
  binary: info('binary', 'Binary search (iterative)', 'binary', 'Binary Search', row('O(log n)', 'O(log n)', 'O(1)', 'Yes'), 'sorted', { values: [3, 8, 12, 17, 23, 31, 38, 45, 52, 60, 71], target: 23 }, traceBinary),
  binaryRec: info('binaryRec', 'Binary search (recursive)', 'binaryRec', 'Binary Search', row('O(log n)', 'O(log n)', 'O(1)', 'Yes'), 'sorted', { values: [3, 8, 12, 17, 23, 31, 38, 45, 52, 60, 71], target: 23 }, traceBinaryRec),
  bounds: info('bounds', 'Lower bound & upper bound', 'bounds', 'Lower/Upper Bound', row('O(log n)', 'O(log n)', 'O(1)', 'Yes'), 'sorted', { values: [1, 2, 2, 2, 3], target: 2 }, traceBounds),
  sqrt: info('sqrt', 'Binary search on answer: integer square root', 'sqrt', 'Binary Search on Answer', row('O(log R · f)', 'O(log R · f)', 'O(1)', 'Monotonic condition'), 'number', { values: [30], target: 30 }, (_v, x) => traceSqrt(x), {
    needsTarget: false,
    max: SQRT_MAX_X,
  }),
  jump: info('jump', 'Jump search', 'jump', 'Jump Search', row('O(√n)', 'O(√n)', 'O(1)', 'Yes'), 'sorted', { values: [2, 5, 8, 11, 15, 19, 24, 28, 33, 37, 42, 46, 51, 55, 60, 64], target: 37 }, traceJump),
  interpolation: info('interpolation', 'Interpolation search', 'interpolation', 'Interpolation Search', row('O(log log n)', 'O(n)', 'O(1)', 'Yes (uniform)'), 'sorted', { values: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120], target: 70 }, traceInterpolation, {
    max: 200,
  }),
  exponential: info('exponential', 'Exponential search', 'exponential', 'Exponential Search', row('O(log n)', 'O(log n)', 'O(1)', 'Yes'), 'sorted', { values: [2, 4, 7, 9, 13, 18, 21, 26, 30, 35, 41, 47, 52, 58], target: 9 }, traceExponential),
  ternary: info('ternary', 'Ternary search (peak of a unimodal array)', 'ternary', 'Ternary Search', row('O(log n)', 'O(log n)', 'O(1)', 'Unimodal function'), 'unimodal', { values: [1, 4, 9, 15, 22, 26, 24, 19, 12, 6, 2], target: 0 }, (v) => traceTernary(v), {
    needsTarget: false,
    minLength: 3,
  }),
  hash: info('hash', 'Hash-based search', 'hash', 'Hash Lookup', row('O(1)', 'O(n)', 'O(n)', 'No'), 'any', { values: [12, 3, 25, 7, 14, 40, 9, 3], target: 3 }, traceHash, { maxLength: 12 }),
};

export const SEARCH_ORDER: SearchAlgorithm[] = ['linear', 'binary', 'binaryRec', 'bounds', 'sqrt', 'jump', 'interpolation', 'exponential', 'ternary', 'hash'];

/** Manifest names → ids (`algorithm: sqrt-answer` in curriculum/dsa.yaml). */
export function toSearchAlgorithm(name: string | undefined, variant?: string): SearchAlgorithm {
  if (name === 'sqrt-answer') return 'sqrt';
  if (name === 'binary' && variant === 'recursive') return 'binaryRec';
  return name && name in SEARCH_ALGORITHMS ? (name as SearchAlgorithm) : 'linear';
}
