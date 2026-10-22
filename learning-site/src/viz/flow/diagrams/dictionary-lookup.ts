import { chain, src } from '../build';

// phase-1/advanced-csharp/records-equality-partial › Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Notes_3.md › "## How Lookup Works" (code block 2). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'dictionary-lookup', title: 'How Lookup Works', source: src('Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Notes_3.md', '## How Lookup Works', 2) },
  ['205.GetHashCode()', 'find the bucket', 'compare keys using Equals()', 'return "Bob"'],
);
