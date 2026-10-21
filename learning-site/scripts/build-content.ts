/**
 * Content pipeline entry point: `npm run content` (also runs automatically before `astro dev` and
 * `astro build` through the integration in scripts/content-integration.ts).
 *
 * Reads curriculum/*.yaml, slices the notes, writes generated lessons to src/content/lessons/ and data
 * to src/data/generated/, and writes coverage-report.md. Exits non-zero on any unmapped note, partition
 * gap/overlap, broken anchor or count mismatch.
 */
import { buildContent } from './lib/generate';

// --dry: validate only, write nothing (several checkouts or agents can run it at once)
const dry = process.argv.includes('--dry');
const result = await buildContent({ mode: 'check', write: !dry });
if (!result.ok) {
  console.error(`\n${result.errors.length} problem(s) found:\n`);
  for (const e of result.errors) console.error(`• ${e}\n`);
  console.error('See coverage-report.md for the full picture.');
  process.exit(1);
}
console.log(dry ? 'content OK (dry run: nothing written).' : 'content OK. See coverage-report.md.');
