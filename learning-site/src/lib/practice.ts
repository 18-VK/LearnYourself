/**
 * Practice mode ("Try it yourself"), as built by scripts/practice/check.ts (src/data/generated/practice.json).
 * Exercises show only when the C# runner is in the build (they run through it) and the build verified them: the note's
 * own implementation passes every test, and the starter code compiles and fails at least one.
 */
import type { RunnableData } from './runnable';

export interface PracticeCaseData {
  input: string;
  expected: string;
  /** true: input and expected value are quoted from a note; false: generated for the exercise, not reviewed. */
  reviewed: boolean;
  source?: string;
}

export interface PracticeExerciseData {
  id: string;
  title: string;
  task: string;
  /** The tested method's signature, e.g. `void InsertionSort(int[] arr)`. */
  signature: string;
  starter: string;
  harness: string;
  /** The note's implementation: its position among the lesson's C# blocks, its hash, and the code. */
  solution: { index: number; hash: string; code: string };
  cases: PracticeCaseData[];
}

export interface PracticeData {
  /** True when the build compiled and ran every exercise (needs the .NET SDK). */
  verified: boolean;
  lessons: Record<string, PracticeExerciseData[]>;
}

export interface LessonPractice {
  downloadMB: number;
  exercises: PracticeExerciseData[];
}

const found = import.meta.glob<{ default: PracticeData }>('../data/generated/practice.json', { eager: true });
const data: PracticeData | null = Object.values(found)[0]?.default ?? null;
const runnable = Object.values(import.meta.glob<{ default: RunnableData }>('../data/generated/runnable.json', { eager: true }))[0]?.default ?? null;

export function practiceFor(lessonId: string): LessonPractice | null {
  if (!data?.verified || !runnable?.available || !runnable.runner) return null;
  const exercises = data.lessons[lessonId];
  if (!exercises?.length) return null;
  return { downloadMB: Math.max(1, Math.round(runnable.runner.downloadBytes / 1048576)), exercises };
}
