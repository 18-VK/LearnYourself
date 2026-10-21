import type { VerbatimCheck } from '../engine/loader';
import { SORT_CODE, SORT_SOURCE_HEADING, type SortAlgorithm } from './csharp';

export const VERBATIM: VerbatimCheck[] = (Object.keys(SORT_CODE) as SortAlgorithm[]).map((alg) => ({
  label: `${alg} sort visualizer`,
  file: 'Competitive Programming/sorting-algorithms-notes.md',
  heading: SORT_SOURCE_HEADING[alg],
  code: SORT_CODE[alg],
  fix: 'src/viz/sorting/csharp.ts and the matching trace generator in src/viz/sorting/traces/',
}));
