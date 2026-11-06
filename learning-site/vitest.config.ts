import { globSync, readFileSync } from 'node:fs';
import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Tests that compare a visualizer with the note it was built from. The notes keep changing and the notes win, so
 * when one of these fails it means "this visualizer could use a refresh", not "the site is broken". They run
 * separately (`npm run test:notes`) and never block a deploy; `npm test` covers the code itself.
 * A test joins this group by reading a note, so there is no list to keep up to date.
 */
export const noteFidelityTests = globSync('tests/unit/**/*.test.ts')
  .map((f) => f.split('\\').join('/'))
  .filter((f) => /\b(?:readNote|noteText|readFileSync|VERBATIM\w*)\b/.test(readFileSync(f, 'utf8')));

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    exclude: [...configDefaults.exclude, ...noteFidelityTests],
    environment: 'node',
  },
});
