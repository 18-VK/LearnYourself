import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import type { Cell, SqlStep, TableView } from '../../../src/viz/sql/model';

/** Reads a note by its repo-relative path (LF line endings). */
export function readNote(rel: string): string {
  const url = new URL(`../../../../${rel.split('/').map(encodeURIComponent).join('/')}`, import.meta.url);
  return readFileSync(fileURLToPath(url), 'utf8').replace(/\r\n/g, '\n');
}

/** The fenced code blocks of a note, as text. */
export function codeBlocks(note: string): string[] {
  const out: string[] = [];
  const lines = note.split('\n');
  let open: string[] | null = null;
  for (const l of lines) {
    if (/^\s*```/.test(l)) {
      if (open) {
        out.push(open.join('\n'));
        open = null;
      } else open = [];
    } else if (open) open.push(l);
  }
  return out;
}

/**
 * The first Markdown table after `marker` (a heading or any line of text, matched exactly at line start),
 * optionally skipping `skip` tables. Returns header + rows as trimmed strings.
 */
export function noteTable(note: string, marker: string, skip = 0): { header: string[]; rows: string[][] } {
  const lines = note.split('\n');
  let i = lines.findIndex((l) => l.trim() === marker.trim());
  if (i < 0) throw new Error(`marker not found: ${marker}`);
  for (let found = 0; ; ) {
    while (i < lines.length && !lines[i]!.trim().startsWith('|')) i++;
    if (i >= lines.length) throw new Error(`no table after ${marker}`);
    const block: string[] = [];
    while (i < lines.length && lines[i]!.trim().startsWith('|')) block.push(lines[i++]!.trim());
    if (found++ === skip) {
      const cells = (l: string) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      return { header: cells(block[0]!), rows: block.slice(2).map(cells) };
    }
  }
}

/** Normalises a cell for comparison: numbers by value, NULL as null. */
export const norm = (v: Cell | string): string | number | null => {
  if (v === null || v === 'NULL') return null;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return v !== '' && Number.isFinite(n) ? n : v;
};
export const normRows = (rows: (Cell | string)[][]) => rows.map((r) => r.map(norm));

export function table(step: SqlStep, id: string): TableView {
  const t = step.state.tables.find((x) => x.id === id);
  if (!t) throw new Error(`no table ${id}`);
  return t;
}

/** Shape checks every SQL trace must pass. */
export function expectWellFormed(trace: SqlStep[], codeLineCount: number): void {
  expect(trace.length).toBeGreaterThan(1);
  let prev = trace[0]!.counters;
  for (const s of trace) {
    expect(s.narration.length).toBeGreaterThan(0);
    for (const l of s.state.code.lines) {
      expect(l).toBeGreaterThanOrEqual(1);
      expect(l).toBeLessThanOrEqual(codeLineCount);
    }
    for (const k of ['comparisons', 'swaps', 'reads', 'writes'] as const) expect(s.counters[k]).toBeGreaterThanOrEqual(prev[k]);
    prev = s.counters;
    for (const t of s.state.tables) {
      for (const r of t.rows) expect(r).toHaveLength(t.columns.length);
      if (t.marks) expect(t.marks.length).toBeLessThanOrEqual(t.rows.length);
    }
    if (s.predict) {
      expect(s.predict.answer).toBeGreaterThanOrEqual(0);
      expect(s.predict.answer).toBeLessThan(s.predict.options.length);
    }
  }
  expect(trace[0]!.action).toBe('start');
  expect(trace.at(-1)!.action).toBe('done');
}
