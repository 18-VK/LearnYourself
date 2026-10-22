import { NOTE } from '../notes';

/**
 * Statements the isolation simulator runs, with where each one's text comes from in
 * `10.SQL_Transactions&Concurrency.md`:
 * - `block`: copied from one of the note's SQL code blocks (checked verbatim by the build);
 * - `text`: quoted from the note's prose (checked by tests/unit/sql/isolation.test.ts);
 * - `added`: not in the note; added to act out a step the note describes in words. Shown with a mark.
 */
export type Provenance = 'block' | 'text' | 'added';

export interface StatementText {
  code: string;
  prov: Provenance;
  /** Heading the text sits under (for `block` and `text`). */
  heading?: string;
}

const block = (code: string, heading: string): StatementText => ({ code, prov: 'block', heading });
const text = (code: string, heading: string): StatementText => ({ code, prov: 'text', heading });
const added = (code: string): StatementText => ({ code, prov: 'added' });

export type Level = 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' | 'SNAPSHOT';
export const LEVELS: Level[] = ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE', 'SNAPSHOT'];

export const STMT = {
  beginTransaction: block('BEGIN TRANSACTION', '## 1. READ UNCOMMITTED'),
  beginTran: block('BEGIN TRAN', '## 3. REPEATABLE READ'),
  update500: block('UPDATE Accounts SET Balance = 500 WHERE Id = 1', '## 1. READ UNCOMMITTED'),
  selectRow: block('SELECT * FROM Accounts WHERE Id = 1', '## 1. READ UNCOMMITTED'),
  commit: block('COMMIT', '# Blocking'),
  rollback: block('ROLLBACK', '## ROLLBACK'),
  countOrders: text('SELECT COUNT(*) FROM Orders WHERE Amount>100;', '## Phantom'),
  insertOrder: added('INSERT INTO Orders VALUES (4, 3, 500);'),
  blockingUpdate: block('UPDATE Accounts\nSET Balance = 500\nWHERE Id = 1', '# Blocking'),
  dl100: block('UPDATE Accounts SET Balance = 100 WHERE Id = 1', '# Deadlock'),
  dl200: block('UPDATE Accounts SET Balance = 200 WHERE Id = 2', '# Deadlock'),
  dl300: block('UPDATE Accounts SET Balance = 300 WHERE Id = 2', '# Deadlock'),
  dl400: block('UPDATE Accounts SET Balance = 400 WHERE Id = 1', '# Deadlock'),
} as const;

const SET_HEADING: Record<Level, string | null> = {
  'READ UNCOMMITTED': '## 1. READ UNCOMMITTED',
  'READ COMMITTED': null, // the note's READ COMMITTED example relies on the default and has no SET statement
  'REPEATABLE READ': '## 3. REPEATABLE READ',
  SERIALIZABLE: '## 4. SERIALIZABLE',
  SNAPSHOT: '## 5. SNAPSHOT',
};
export function setLevel(level: Level): StatementText {
  const code = `SET TRANSACTION ISOLATION LEVEL ${level}`;
  const h = SET_HEADING[level];
  return h ? block(code, h) : added(code);
}

/** The note's own text diagrams, shown beside the simulator and highlighted as the matching moment plays. */
export const FLOW = {
  blocking: block('Session1: Lock row\nSession2: Waiting...\nSession1: Commit\nSession2: Continue', '# Blocking'),
  deadlockRows: block('Session1 → waiting for row2\nSession2 → waiting for row1', '# Deadlock'),
  deadlockSessions: block('Session1 → waiting for Session2\nSession2 → waiting for Session1', '# Deadlock'),
  deadlockError: block('Transaction was deadlocked on resources', '# Deadlock'),
} as const;

/** Every `block` text, for the build's verbatim check. */
export const NOTE_STATEMENTS: { file: string; heading: string; code: string }[] = (() => {
  const all: StatementText[] = [...Object.values(STMT), ...Object.values(FLOW), ...(['READ UNCOMMITTED', 'REPEATABLE READ', 'SERIALIZABLE', 'SNAPSHOT'] as Level[]).map(setLevel)];
  const seen = new Set<string>();
  return all
    .filter((s) => s.prov === 'block' && !seen.has(s.code) && seen.add(s.code))
    .map((s) => ({ file: NOTE.tx, heading: s.heading!, code: s.code }));
})();

/** Every `text` quote, for the unit test that checks the note's prose. */
export const NOTE_QUOTES: StatementText[] = Object.values(STMT).filter((s) => s.prov === 'text');
