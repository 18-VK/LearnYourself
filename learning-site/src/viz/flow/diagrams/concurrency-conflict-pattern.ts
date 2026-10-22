import { chain, src } from '../build';

// phase-1/ef-core/ef-core-indexes-tracking-bulk-concurrency › Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore/Notes.md › "### Microsoft's Recommended Pattern" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'concurrency-conflict-pattern', title: 'Microsoft\'s Recommended Pattern', source: src('Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore/Notes.md', '### Microsoft\'s Recommended Pattern', 1) },
  ['Detect conflict', 'Return conflict', 'Client decides'],
);
