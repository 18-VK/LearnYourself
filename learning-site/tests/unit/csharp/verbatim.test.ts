import { describe, expect, it } from 'vitest';
import { loadNote } from '../../../scripts/lib/notes';
import { VERBATIM } from '../../../src/viz/csharp/verbatim';
import { SNIPPETS } from '../../../src/viz/csharp/snippets';

// The same rule the content pipeline enforces on every build (scripts/lib/generate.ts, step 5): each code
// panel's text must appear inside one fenced block of its note.
describe('C# visualizer snippets are verbatim copies of the notes', () => {
  it('registers every snippet with the build check', () => {
    expect(VERBATIM.map((v) => v.code)).toEqual(Object.values(SNIPPETS).map((s) => s.code));
  });

  for (const check of VERBATIM) {
    it(check.label, () => {
      const note = loadNote(check.file);
      const blocks = note.fences.map((f) => note.lines.slice(f.start + 1, f.end).join('\n'));
      expect(blocks.some((b) => b.includes(check.code))).toBe(true);
      // the recorded heading exists in the note and precedes the block
      expect(note.headings.some((h) => `${'#'.repeat(h.depth)} ${h.text}` === check.heading)).toBe(true);
    });
  }
});
