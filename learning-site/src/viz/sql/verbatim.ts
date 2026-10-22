import type { VerbatimCheck } from '../engine/loader';
import { SQL, type SqlId } from './notes';
import { NOTE_STATEMENTS } from './traces/isolation-sql';

/** Code panels in this area that copy SQL from a note; the build checks each one still matches. */
export const VERBATIM: VerbatimCheck[] = [
  ...(Object.keys(SQL) as SqlId[]).map((id) => ({
    label: `SQL visualizer snippet "${id}"`,
    file: SQL[id].file,
    heading: SQL[id].heading,
    code: SQL[id].code,
    fix: 'src/viz/sql/notes.ts and the trace that uses it in src/viz/sql/traces/',
  })),
  ...NOTE_STATEMENTS.map((s) => ({
    label: `isolation simulator statement "${s.code.split('\n')[0]}"`,
    file: s.file,
    heading: s.heading,
    code: s.code,
    fix: 'src/viz/sql/traces/isolation-sql.ts',
  })),
];
