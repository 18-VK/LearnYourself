import { describe, expect, it } from 'vitest';
import { locateEntry } from '../../../scripts/runner/check';
import type { RunnableEntry } from '../../../scripts/runner/schema';

const blocks = (...firstLines: string[]) => firstLines.map((code, i) => ({ index: i + 1, code: `${code}\nmore code` }));
const entry = (e: Record<string, unknown>) => e as unknown as RunnableEntry;

describe('a harness entry when its note changes', () => {
  it('stays on its block when nothing moved', () => {
    expect(locateEntry(entry({ block: 2, startsWith: 'class B' }), blocks('class A', 'class B'), 'w', [])).toEqual([2]);
  });

  it('follows its block when the note gained one earlier on', () => {
    const warnings: string[] = [];
    expect(locateEntry(entry({ block: 2, startsWith: 'class B' }), blocks('class New', 'class A', 'class B'), 'w', warnings)).toEqual([3]);
    expect(warnings).toEqual([]);
  });

  it('moves a whole merge together', () => {
    expect(locateEntry(entry({ merge: [1, 2], startsWith: 'class A' }), blocks('class New', 'class A', 'class B'), 'w', [])).toEqual([2, 3]);
  });

  it('is ignored, with a warning, when its block is gone', () => {
    const warnings: string[] = [];
    expect(locateEntry(entry({ block: 1, startsWith: 'class Gone' }), blocks('class A'), 'file.yaml', warnings)).toBeNull();
    expect(warnings[0]).toContain('file.yaml');
  });

  it('is ignored when several blocks could be the one', () => {
    expect(locateEntry(entry({ block: 3, startsWith: 'class A' }), blocks('class X', 'class A', 'class B', 'class A'), 'w', [])).toBeNull();
  });

  it('is ignored when the lesson has fewer blocks now', () => {
    const warnings: string[] = [];
    expect(locateEntry(entry({ block: 5 }), blocks('class A'), 'w', warnings)).toBeNull();
    expect(warnings[0]).toContain('1 C# block now');
  });
});
