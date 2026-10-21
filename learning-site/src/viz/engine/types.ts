/**
 * The visualizer engine's data model.
 *
 * A trace generator is a pure function that runs an algorithm on an input and records every step up
 * front. The player only moves an index through that list, so stepping back costs nothing and every
 * panel (stage, code, narration, variables, counters) renders from the same step object.
 */

export interface Counters {
  comparisons: number;
  swaps: number;
  /** Array element reads (an element used in a condition or on the right-hand side). */
  reads: number;
  /** Array element writes. */
  writes: number;
}

export type ActionKind =
  | 'start'
  | 'compare'
  | 'swap'
  | 'write'
  | 'read'
  | 'select'
  | 'settle'
  | 'call'
  | 'return'
  | 'branch'
  | 'done';

/** A question asked in predict mode before the step's outcome is revealed. */
export interface Prediction {
  question: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
}

/** A secondary array shown under the main one: merge halves, count arrays, output arrays, buckets. */
export interface AuxArray {
  name: string;
  values: (number | null)[];
  /** Original identity of each value (for stability colouring); null when the value has no original element. */
  ids?: (number | null)[];
  highlight?: { compare?: number[]; write?: number[]; active?: number[] };
  pointers?: Record<string, number>;
  /** Labels shown under the cells instead of indexes (for example the value each count slot stands for). */
  labels?: string[];
}

export interface ArrayState {
  values: number[];
  /**
   * The original input position of the element now at each index, so equal keys can be told apart.
   * null means the value was rebuilt from counts and is not an original element.
   */
  ids: (number | null)[];
  aux?: AuxArray[];
  /** Heap sort: indexes at or beyond heapSize are outside the heap. */
  heapSize?: number;
}

export interface Highlights {
  compare?: number[];
  /** Elements swapped or written in this step. */
  swap?: number[];
  /** Elements in their final position. */
  settled?: number[];
  /** The key, pivot, current minimum or other element the step is about. */
  active?: number[];
  pointers?: Record<string, number>;
  /** The current sub-range; elements outside it are dimmed. */
  range?: [number, number];
  band?: { from: number; to: number; label: string };
}

export interface Step<S = ArrayState> {
  state: S;
  highlights: Highlights;
  action: ActionKind;
  /** 1-based line in the C# shown in the code panel. */
  codeLine: number;
  narration: string;
  variables: Record<string, string | number | boolean>;
  counters: Counters;
  predict?: Prediction;
}

export type Trace<S = ArrayState> = Step<S>[];
