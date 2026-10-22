import type { HashHighlight, HashTableState } from '../dsa/hash/model';
import type { ActionKind, Counters, Highlights, Prediction, Step } from '../engine/types';

export type { HashHighlight };

export interface HashView {
  /** `seen`, the HashSet<int>. Null before its constructor runs. */
  seen: HashTableState | null;
  /** `index`, the Dictionary<int, int>. Null before it is created. */
  index: HashTableState | null;
  focus: 'seen' | 'index';
  hl: HashHighlight;
}

export interface SearchState {
  values: number[];
  /** How many positions the search has probed so far (mid, pos, block ends, chain entries…). */
  probes: number;
  /** Calls on the recursion stack, outermost first (recursive binary search). */
  calls?: string[];
  /** Per-index marks for the answer space of binary search on answer (✓ feasible / ✗ not). */
  marks?: (string | null)[];
  hash?: HashView;
  /** Set on the last step: what the C# returns. */
  result?: string;
}

export type SearchStep = Step<SearchState>;
export type SearchTrace = SearchStep[];

type Vars = Record<string, string | number | boolean>;

/** Records search steps; counts element comparisons and array reads the way the C# performs them. */
export class SearchRecorder {
  readonly steps: SearchStep[] = [];
  readonly c: Counters = { comparisons: 0, swaps: 0, reads: 0, writes: 0 };
  probes = 0;
  calls: string[] | undefined;
  marks: (string | null)[] | undefined;
  hash: HashView | undefined;

  constructor(readonly values: readonly number[]) {}

  get n(): number {
    return this.values.length;
  }

  /** Reads arr[i] (one array access). */
  read(i: number): number {
    this.c.reads++;
    return this.values[i]!;
  }

  /** Counts array reads made inside one expression without needing their values. */
  countReads(k: number): void {
    this.c.reads += k;
  }

  /** Counts one comparison that involves an array element or the target. */
  compare(times = 1): void {
    this.c.comparisons += times;
  }

  probe(): void {
    this.probes++;
  }

  step(action: ActionKind, codeLine: number, narration: string, highlights: Highlights = {}, variables: Vars = {}, predict?: Prediction, result?: string): void {
    const state: SearchState = { values: [...this.values], probes: this.probes };
    if (this.calls) state.calls = [...this.calls];
    if (this.marks) state.marks = [...this.marks];
    if (this.hash) state.hash = { ...this.hash, hl: { ...this.hash.hl } };
    if (result !== undefined) state.result = result;
    const s: SearchStep = { state, highlights, action, codeLine, narration, variables: { ...variables }, counters: { ...this.c } };
    if (predict) s.predict = predict;
    this.steps.push(s);
  }
}

export const span = (from: number, to: number): number[] => (to < from ? [] : Array.from({ length: to - from + 1 }, (_, k) => from + k));
