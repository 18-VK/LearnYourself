/**
 * Spaced review: when a question comes back after it was answered. Pure functions, unit-tested in
 * tests/unit/study/review.test.ts; the storage is src/scripts/progress.ts (`review` in ly-progress-v1).
 *
 * The schedule is deliberately simple (a cut-down SM-2): a wrong answer comes back tomorrow; a right answer
 * comes back in 4 days the first time, 3 days after a lapse, and then 2.5× the previous interval, up to 180 days.
 */
export interface ReviewItem {
  /** When the question is due again (ms since the epoch). */
  due: number;
  /** Days until the next review, as scheduled at `last`. */
  interval: number;
  /** When it was last answered. */
  last: number;
  /** Right answers in a row. */
  right: number;
  /** Wrong answers in total. */
  lapses: number;
}

export const DAY = 86_400_000;
const MAX_INTERVAL = 180;

export function schedule(prev: ReviewItem | undefined, ok: boolean, now = Date.now()): ReviewItem {
  if (!ok) return { due: now + DAY, interval: 1, last: now, right: 0, lapses: (prev?.lapses ?? 0) + 1 };
  const interval = !prev ? 4 : prev.right === 0 ? 3 : Math.min(MAX_INTERVAL, Math.round(prev.interval * 2.5));
  return { due: now + interval * DAY, interval, last: now, right: (prev?.right ?? 0) + 1, lapses: prev?.lapses ?? 0 };
}

export const isDue = (item: ReviewItem, now = Date.now()): boolean => item.due <= now;

/**
 * Round-robin across groups (courses, then lessons): consecutive items come from different places, which helps
 * more than reviewing one lesson's questions in a row (interleaving).
 */
export function interleave<T>(items: T[], groupOf: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = groupOf(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const queues = [...groups.values()];
  const out: T[] = [];
  for (let round = 0; out.length < items.length; round++) for (const q of queues) if (q[round] !== undefined) out.push(q[round]!);
  return out;
}

/** The flashcards page keeps its piles in ly-flashcards-v1; its "review" pile is the review queue's other half. */
export function flashcardsToReview(): number {
  try {
    const s = JSON.parse(localStorage.getItem('ly-flashcards-v1') ?? 'null') as { piles?: Record<string, string> } | null;
    return Object.values(s?.piles ?? {}).filter((p) => p === 'review').length;
  } catch {
    return 0;
  }
}

/** The earliest due time among items that aren't due yet, or null. */
export function nextDue(items: ReviewItem[], now = Date.now()): number | null {
  let next: number | null = null;
  for (const it of items) if (it.due > now && (next === null || it.due < next)) next = it.due;
  return next;
}
