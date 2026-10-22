import type { Counters, Prediction, Step } from '../engine/types';

/** A table cell. `null` is SQL NULL and is drawn as a NULL marker, never as an empty cell. */
export type Cell = string | number | null;

/**
 * Row marks. They map onto the shared colour classes so every visualizer uses the same meanings:
 * compare → is-compare, write → is-swap ("written"), active → is-active, settled → is-settled.
 * `out` dims a row that is not part of the current step; `removed` strikes out a row a clause just dropped.
 */
export type Mark = 'compare' | 'write' | 'active' | 'settled' | 'out' | 'removed';

export interface TableView {
  /** Stable id, so React keeps the same table between steps. */
  id: string;
  caption: string;
  columns: string[];
  rows: Cell[][];
  /** Stable row ids (for entrance animation); defaults to the row index. */
  rowIds?: string[];
  marks?: (Mark | null)[];
  /** A short note shown after the row, e.g. "NULL > 60 is UNKNOWN". */
  notes?: (string | null)[];
  /** Group or partition bands: a label row is drawn before row `from`. */
  groups?: { from: number; to: number; label: string }[];
  /** Digits after the decimal point, per column (DECIMAL(9,2) columns show 2). */
  decimals?: (number | undefined)[];
  /** Extra classes per cell, `${row}:${col}` → mark. */
  cellMarks?: Record<string, Mark>;
  /** Placeholder text when the table has no rows. */
  empty?: string;
}

/** Common step state for the SQL visualizers: the tables on the stage plus the SQL lines to highlight. */
export interface SqlStage {
  tables: TableView[];
  /** Index into the code panel's blocks and the 1-based lines to highlight in it. */
  code: { block: number; lines: number[] };
}

export type SqlStep<S extends SqlStage = SqlStage> = Step<S>;

export const ZERO: Counters = { comparisons: 0, swaps: 0, reads: 0, writes: 0 };

export const fmtCell = (v: Cell, decimals?: number): string => {
  if (v === null) return 'NULL';
  if (typeof v === 'number') return decimals !== undefined ? v.toFixed(decimals) : String(v);
  return v;
};

/** Builds a step with the engine's shape. `codeLine` is the first highlighted line. */
export function mkStep<S extends SqlStage>(
  state: S,
  action: Step['action'],
  narration: string,
  variables: Step['variables'],
  counters: Counters,
  predict?: Prediction,
): SqlStep<S> {
  const s: SqlStep<S> = {
    state,
    highlights: {},
    action,
    codeLine: state.code.lines[0] ?? 1,
    narration,
    variables: { ...variables },
    counters: { ...counters },
  };
  if (predict) s.predict = predict;
  return s;
}

/** Deterministic option list for "how many?" predictions: 0..max(3, answer). */
export function countOptions(answer: number, min = 0): { options: string[]; answer: number } {
  const hi = Math.max(min + 3, answer);
  const options = Array.from({ length: hi - min + 1 }, (_, i) => String(min + i));
  return { options, answer: answer - min };
}
