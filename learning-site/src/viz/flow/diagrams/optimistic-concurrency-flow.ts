import { chain, src } from '../build';

// phase-1/ef-core/ef-core-indexes-tracking-bulk-concurrency › Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore/Notes.md › "## If you want real optimistic concurrency" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'optimistic-concurrency-flow', title: 'Real optimistic concurrency', source: src('Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore/Notes.md', '## If you want real optimistic concurrency', 1) },
  [
    'GET Entity',
    'User edits',
    'Load tracked entity',
    'Apply changes',
    'SaveChangesAsync()',
    'DbUpdateConcurrencyException?',
    'Reload database values',
    'Return 409 Conflict (or merge & retry)',
  ],
);
