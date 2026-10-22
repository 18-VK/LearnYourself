import { chain, src } from '../build';

// sql-server/setup-and-security/server-database-schema › Phase2-ASP.NetAndBackend/SQLTutorial/1.Notes_SQL.md › "## Complete security flow (end-to-end)" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'sql-security-flow', title: 'Complete security flow (end-to-end)', source: src('Phase2-ASP.NetAndBackend/SQLTutorial/1.Notes_SQL.md', '## Complete security flow (end-to-end)', 1) },
  [
    'Client',
    'Login (Server authentication)',
    'User (Database mapping)',
    'Schema (Permission boundary)',
    'Object (Table / View / Proc)',
  ],
);
