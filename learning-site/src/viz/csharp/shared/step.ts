import type { ActionKind, Counters, Prediction, Step, Trace } from '../../engine/types';
import { lineOf } from '../../engine/code';
import { SNIPPETS, sourceLabel, type SnippetKey } from '../snippets';

/**
 * Shared pieces for the C# & .NET visualizers. Their steps use the engine's `Step<S>` with an
 * area-specific state; the engine's array counters don't apply, so they stay at zero and each
 * visualizer keeps its own tallies (heap objects, SQL round trips, lost updates…) inside its state.
 */
export const NO_COUNTERS: Counters = { comparisons: 0, swaps: 0, reads: 0, writes: 0 };

export type Vars = Record<string, string | number | boolean>;

export interface StepInput {
  action?: ActionKind;
  /** Global 1-based line in the code document (see `CodeDoc`). */
  line: number;
  narration: string;
  vars?: Vars;
  predict?: Prediction;
}

/** Records steps, deep-copying the state so later mutations never leak into earlier steps. */
export class Recorder<S> {
  readonly steps: Trace<S> = [];
  push(state: S, s: StepInput): void {
    const step: Step<S> = {
      state: structuredClone(state),
      highlights: {},
      action: s.action ?? 'read',
      codeLine: s.line,
      narration: s.narration,
      variables: { ...(s.vars ?? {}) },
      counters: NO_COUNTERS,
    };
    if (s.predict) step.predict = s.predict;
    this.steps.push(step);
  }
}

// ── code documents: one or more verbatim snippets shown in one panel ─────────────────────────

export interface CodePart {
  /** The snippet this part copies, or null for a part that is not from a note (it is then labelled). */
  key: SnippetKey | null;
  title: string;
  code: string;
}

export interface CodeDoc {
  parts: CodePart[];
}

/** A document made of note snippets, in order. */
export function docOf(...keys: SnippetKey[]): CodeDoc {
  return { parts: keys.map((key) => ({ key, title: sourceLabel(key), code: SNIPPETS[key].code })) };
}

const lineCount = (code: string) => code.split('\n').length;

/** Total number of lines in the document. */
export function docLength(doc: CodeDoc): number {
  return doc.parts.reduce((n, p) => n + lineCount(p.code), 0);
}

/** Global 1-based line of `marker` inside part `part` (throws if the marker is missing, like `lineOf`). */
export function lineIn(doc: CodeDoc, part: number, marker: string, occurrence = 1): number {
  let offset = 0;
  for (let i = 0; i < part; i++) offset += lineCount(doc.parts[i]!.code);
  const p = doc.parts[part];
  if (!p) throw new Error(`No part ${part} in code document`);
  return offset + lineOf(p.code, marker, occurrence);
}

/**
 * Resolves a table of markers in one part: `linesIn(doc, 0, { assign: 'Point second = first;' })`.
 * A plain marker must match exactly one line; when the text repeats, say which one with
 * `[marker, occurrence]`. That stops a trace from silently highlighting the first of two look-alike lines.
 */
export function linesIn<K extends string>(doc: CodeDoc, part: number, spec: Record<K, string | readonly [string, number]>): Record<K, number> {
  const out = {} as Record<K, number>;
  const code = doc.parts[part]?.code ?? '';
  for (const k of Object.keys(spec) as K[]) {
    const s = spec[k];
    if (typeof s === 'string') {
      const hits = code.split('\n').filter((l) => l.includes(s)).length;
      if (hits > 1) throw new Error(`Code marker "${s}" matches ${hits} lines; use [marker, occurrence]`);
      out[k] = lineIn(doc, part, s);
    } else out[k] = lineIn(doc, part, s[0], s[1]);
  }
  return out;
}

/** Maps a global line back to (part index, local 1-based line). */
export function locate(doc: CodeDoc, line: number): { part: number; line: number } {
  let rest = line;
  for (let i = 0; i < doc.parts.length; i++) {
    const n = lineCount(doc.parts[i]!.code);
    if (rest <= n) return { part: i, line: rest };
    rest -= n;
  }
  return { part: doc.parts.length - 1, line: lineCount(doc.parts[doc.parts.length - 1]!.code) };
}

/** The text of a global line (used by tests to check that a step highlights the statement it describes). */
export function textAt(doc: CodeDoc, line: number): string {
  const { part, line: l } = locate(doc, line);
  return doc.parts[part]!.code.split('\n')[l - 1] ?? '';
}
