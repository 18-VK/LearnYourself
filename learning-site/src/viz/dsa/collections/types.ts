import type { HashHighlight } from '../hash/model';

/** What a step of a collection operation points at, by position in the structure's own layout. */
export interface CollectionHighlight {
  compare?: number[];
  /** Cells written or moved in this step. */
  write?: number[];
  active?: number[];
  /** Cells holding the answer (found, returned). */
  found?: number[];
  /** Cells shown faded (an old array being copied from, a node being unlinked…). */
  out?: number[];
  pointers?: Record<string, number>;
  hash?: HashHighlight;
}

export interface OpStep<S> {
  state: S;
  narration: string;
  hl: CollectionHighlight;
  /** Line in a code panel (only for scripted examples copied from a note). */
  codeLine?: number;
}

/** The cost a cheat-sheet row (or, where it says so, the Microsoft docs) gives for an operation. */
export interface Cost {
  /** The operation names as the source writes them, e.g. "Add/Contains/Remove". */
  ops: string;
  cost: string;
  /** "notes" = csharp-dsa-collections-cheatsheet.md; otherwise a learn.microsoft.com URL. */
  source: 'notes' | string;
  note?: string;
}

export interface OpTrace<S> {
  /** The C# call, e.g. `list.Add(7);`. */
  call: string;
  cost: Cost | null;
  /** What this particular call did, e.g. "copied 4 elements, wrote 1". */
  work: string;
  steps: OpStep<S>[];
  /** Set when the call throws: the exception, explained. */
  error?: string;
}

export type ArgKind = 'none' | 'value' | 'index' | 'index-value' | 'key-value' | 'key' | 'element-priority';

export interface OpDef<S> {
  id: string;
  label: string;
  arg: ArgKind;
  /** Why the button is disabled right now, or null when it can run. */
  blocked?: (s: S) => string | null;
  /** a = the first input (value, key or element); b = the second (index, position, value or priority). */
  run: (s: S, a: number, b: number) => OpTrace<S>;
}

export interface StructureDef<S> {
  id: string;
  /** The C# type, e.g. `List<T>`. */
  title: string;
  /** The variable name used in the calls (list, dict, set, stack…). */
  variable: string;
  /** The cheat-sheet section the costs come from. */
  section: string;
  costs: Cost[];
  initial: () => S;
  /** The C# that creates `initial()`. */
  setup: string;
  ops: OpDef<S>[];
  /** Shown under the stage when the drawing simplifies .NET's real layout. */
  simplified?: string;
  summary: (s: S) => string;
}
