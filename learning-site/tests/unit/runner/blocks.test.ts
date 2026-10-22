import { describe, expect, it } from 'vitest';
import { blocksOfLesson } from '../../../scripts/runner/blocks';
import { RunnableFileSchema } from '../../../scripts/runner/schema';
import { codeHash } from '../../../src/scripts/runner/hash';

describe('C# block extraction (the page and the build must number blocks the same way)', () => {
  const md = [
    '---',
    'title: x',
    '---',
    '',
    '```csharp',
    'Console.WriteLine(1);',
    '```',
    '',
    '```sql',
    'SELECT 1;',
    '```',
    '',
    '- a list item',
    '',
    '  ```csharp',
    '  int x = 2;',
    '  ```',
    '',
    '```csharp recovered',
    'void A() { }',
    '```',
  ].join('\n');

  it('counts only C# fences, in page order, including recovered and indented ones', () => {
    const blocks = blocksOfLesson('dsa/sorting/demo', md);
    expect(blocks.map((b) => b.index)).toEqual([1, 2, 3]);
    expect(blocks.map((b) => b.code)).toEqual(['Console.WriteLine(1);', 'int x = 2;', 'void A() { }']);
    expect(blocks[2]!.recovered).toBe(true);
    expect(blocks[0]!.id).toBe(`dsa/sorting/demo#cs1-${codeHash('Console.WriteLine(1);')}`);
  });

  it('hashes code the same way regardless of line endings and a trailing newline', () => {
    expect(codeHash('a\r\nb\n')).toBe(codeHash('a\nb'));
    expect(codeHash('a\nb')).not.toBe(codeHash('a\nc'));
    expect(codeHash('')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('src/data/runnable schema', () => {
  it('accepts a harness with its input source', () => {
    expect(RunnableFileSchema.safeParse({ blocks: [{ block: 1, harness: 'A();', input: 'the note' }] }).success).toBe(true);
  });
  it('rejects a harness without saying where its input comes from', () => {
    expect(RunnableFileSchema.safeParse({ blocks: [{ block: 1, harness: 'A();' }] }).success).toBe(false);
  });
  it('rejects merges of blocks that are not consecutive', () => {
    expect(RunnableFileSchema.safeParse({ blocks: [{ merge: [2, 4] }] }).success).toBe(false);
    expect(RunnableFileSchema.safeParse({ blocks: [{ merge: [2, 3] }] }).success).toBe(true);
  });
  it('requires a reason for forcing a block on or off', () => {
    expect(RunnableFileSchema.safeParse({ blocks: [{ block: 2, runnable: false }] }).success).toBe(false);
    expect(RunnableFileSchema.safeParse({ blocks: [{ block: 2, runnable: false, reason: 'prints differently' }] }).success).toBe(true);
  });
});
