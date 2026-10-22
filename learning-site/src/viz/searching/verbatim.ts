import type { VerbatimCheck } from '../engine/loader';
import { SEARCH_CODE, SEARCH_NOTE, SEARCH_SOURCE_HEADING, type SearchCodeId } from './csharp';

/** Code panels in this area that copy code from a note; the build checks each one still matches. */
export const VERBATIM: VerbatimCheck[] = (Object.keys(SEARCH_CODE) as SearchCodeId[]).map((id) => ({
  label: `${id} search visualizer`,
  file: SEARCH_NOTE,
  heading: SEARCH_SOURCE_HEADING[id],
  code: SEARCH_CODE[id],
  fix: 'src/viz/searching/csharp.ts and the matching trace generator in src/viz/searching/traces/',
}));
