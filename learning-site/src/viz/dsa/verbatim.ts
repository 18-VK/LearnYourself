import type { VerbatimCheck } from '../engine/loader';
import { LINKED_EXAMPLE } from './collections/linkedlist';

/** Code panels in this area that copy code from a note; the build checks each one still matches. */
export const VERBATIM: VerbatimCheck[] = [
  {
    label: 'LinkedList example in the collections visualizer',
    file: 'Competitive Programming/csharp-dsa-collections-cheatsheet.md',
    heading: '#### Example',
    code: LINKED_EXAMPLE,
    fix: 'LINKED_EXAMPLE and noteExample() in src/viz/dsa/collections/linkedlist.ts',
  },
];
