import type { ActionKind, ArrayState, AuxArray, Counters, Highlights, Prediction, Step } from './types';

type Vars = Record<string, string | number | boolean>;

const cloneAux = (a: AuxArray): AuxArray => ({
  ...a,
  values: [...a.values],
  ...(a.ids ? { ids: [...a.ids] } : {}),
  ...(a.highlight
    ? {
        highlight: {
          ...(a.highlight.compare ? { compare: [...a.highlight.compare] } : {}),
          ...(a.highlight.write ? { write: [...a.highlight.write] } : {}),
          ...(a.highlight.active ? { active: [...a.highlight.active] } : {}),
        },
      }
    : {}),
  ...(a.pointers ? { pointers: { ...a.pointers } } : {}),
  ...(a.labels ? { labels: [...a.labels] } : {}),
});

/**
 * Records array-algorithm steps. Mutate `values`/`ids` through the helpers so the counters stay in step
 * with what the C# actually does, then call `step()` once per executed line worth showing.
 */
export class ArrayRecorder {
  readonly steps: Step[] = [];
  readonly c: Counters = { comparisons: 0, swaps: 0, reads: 0, writes: 0 };
  values: number[];
  ids: (number | null)[];
  aux: AuxArray[] | undefined;
  heapSize: number | undefined;

  constructor(input: readonly number[]) {
    this.values = [...input];
    this.ids = input.map((_, i) => i);
  }

  get n(): number {
    return this.values.length;
  }

  /** Reads arr[i] (counts one array access). */
  read(i: number): number {
    this.c.reads++;
    return this.values[i]!;
  }

  /** Counts one element comparison. */
  compare(): void {
    this.c.comparisons++;
  }

  /** `(arr[i], arr[j]) = (arr[j], arr[i])`: two reads, two writes, one swap. */
  swap(i: number, j: number): void {
    this.c.reads += 2;
    this.c.writes += 2;
    this.c.swaps++;
    const v = this.values[i]!;
    this.values[i] = this.values[j]!;
    this.values[j] = v;
    const id = this.ids[i]!;
    this.ids[i] = this.ids[j]!;
    this.ids[j] = id;
  }

  /** `arr[i] = value` (one write). Pass the identity of the element being written, or null. */
  write(i: number, value: number, id: number | null): void {
    this.c.writes++;
    this.values[i] = value;
    this.ids[i] = id;
  }

  step(
    action: ActionKind,
    codeLine: number,
    narration: string,
    highlights: Highlights = {},
    variables: Vars = {},
    predict?: Prediction,
  ): void {
    const state: ArrayState = { values: [...this.values], ids: [...this.ids] };
    if (this.aux) state.aux = this.aux.map(cloneAux);
    if (this.heapSize !== undefined) state.heapSize = this.heapSize;
    const s: Step = { state, highlights, action, codeLine, narration, variables: { ...variables }, counters: { ...this.c } };
    if (predict) s.predict = predict;
    this.steps.push(s);
  }
}

export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
