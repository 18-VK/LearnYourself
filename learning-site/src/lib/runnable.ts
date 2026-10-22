/**
 * Runnable C# blocks, as decided at build time by scripts/runner/check.ts (src/data/generated/runnable.json).
 * The file is optional: without a .NET SDK the build writes `available: false`, and before the first build it may not
 * exist at all; either way lessons simply show no Run buttons.
 */

export interface RunnableExpected {
  stdout: string;
  outcome: string;
  error?: { type: string; message: string; line: number };
}
export interface RunnableBlockData {
  /** 1-based position among the lesson's C# code blocks (the block that gets the buttons). */
  index: number;
  /** codeHash() of the block's code; the page re-checks it before attaching buttons. */
  hash: string;
  id: string;
  /** Earlier blocks merged into this program (their indexes), and the combined code the editor starts with. */
  merged?: number[];
  code?: string;
  /** Added statements that call the note's code with the note's own sample input, and where that input comes from. */
  harness?: string;
  input?: string;
  stdin: string;
  readsInput: boolean;
  varies: boolean;
  expected?: RunnableExpected;
}
export interface RunnableData {
  available: boolean;
  note?: string;
  runner: { version: string; downloadBytes: number; fileCount: number } | null;
  lessons: Record<string, RunnableBlockData[]>;
}

/** What a lesson page embeds for its runner script. */
export interface LessonRunnable {
  downloadMB: number | null;
  blocks: RunnableBlockData[];
}

const found = import.meta.glob<{ default: RunnableData }>('../data/generated/runnable.json', { eager: true });
const data: RunnableData | null = Object.values(found)[0]?.default ?? null;

export function runnableFor(lessonId: string): LessonRunnable | null {
  if (!data?.available || !data.runner) return null;
  const blocks = data.lessons[lessonId];
  if (!blocks?.length) return null;
  return { downloadMB: Math.max(1, Math.round(data.runner.downloadBytes / 1048576)), blocks };
}

/** JSON for a <script type="application/json"> element: `<` is escaped so code containing "</script>" can't end it. */
export const scriptJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');
