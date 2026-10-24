/**
 * Runnable SQL blocks, as decided at build time by scripts/sqlrun/check.ts (src/data/generated/sqlrun.json).
 * Optional: before the first build it may not exist, and lessons then show no SQL Run buttons.
 */
import type { Cell } from '../scripts/sqlrun/engine';

export type OrderNote = 'none' | 'ties';

/** One statement's recorded result ("Expected output"), produced by running the block in sql.js at build time. */
export interface ExpectedStatement {
  line: number;
  kind: 'rows' | 'changes' | 'none';
  columns?: string[];
  rows?: Cell[][];
  total?: number;
  truncated?: boolean;
  changes?: number;
  /** 'none': no ORDER BY, so SQL Server may list the rows in another order; 'ties': ORDER BY leaves ties. */
  order?: OrderNote;
}

export interface SqlSetupData {
  /** The setup blocks' code, joined in order (what runs before the query). */
  code: string;
  blocks: number[];
  from: string;
}

export interface SqlRunnableBlock {
  index: number;
  hash: string;
  id: string;
  setup?: string;
  expected: ExpectedStatement[];
}

export type SqlLabelKind = 'tsql-only' | 'typing' | 'setup';
export interface SqlLabel {
  index: number;
  hash: string;
  kind: SqlLabelKind;
  /** Short name of what decided it ("TOP"), or the queries a setup feeds. */
  construct: string;
  detail: string;
}

export interface LessonSqlRun {
  setups: Record<string, SqlSetupData>;
  blocks: SqlRunnableBlock[];
  labels: SqlLabel[];
}

export interface SqlRunData {
  available: boolean;
  /** sql.js version (package.json) and the size of its WebAssembly file, for the loading message. */
  engine: { version: string; sqlite: string; wasmBytes: number } | null;
  lessons: Record<string, LessonSqlRun>;
}

/** What a lesson page embeds for src/scripts/sqlrun/attach.ts. */
export interface LessonSqlRunPage extends LessonSqlRun {
  downloadKB: number;
}

const found = import.meta.glob<{ default: SqlRunData }>('../data/generated/sqlrun.json', { eager: true });
const data: SqlRunData | null = Object.values(found)[0]?.default ?? null;

export function sqlRunFor(lessonId: string): LessonSqlRunPage | null {
  if (!data?.available || !data.engine) return null;
  const lesson = data.lessons[lessonId];
  if (!lesson || (!lesson.blocks.length && !lesson.labels.length)) return null;
  return { ...lesson, downloadKB: Math.max(1, Math.round(data.engine.wasmBytes / 1024)) };
}
