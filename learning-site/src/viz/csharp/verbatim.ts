import type { VerbatimCheck } from '../engine/loader';
import { SNIPPETS, type SnippetKey } from './snippets';

/** Code panels in this area that copy code from a note; the build checks each one still matches. */
export const VERBATIM: VerbatimCheck[] = (Object.keys(SNIPPETS) as SnippetKey[]).map((key) => ({
  label: `C# visualizer snippet "${key}"`,
  file: SNIPPETS[key].file,
  heading: SNIPPETS[key].heading,
  code: SNIPPETS[key].code,
  fix: `src/viz/csharp/snippets.ts (entry "${key}") and the trace in src/viz/csharp/traces/ that resolves lines in it`,
}));
