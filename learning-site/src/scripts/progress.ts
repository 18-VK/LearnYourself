/**
 * Learner progress, stored only in this browser (localStorage). No accounts, no server.
 * Export/import as JSON lets you move it between browsers.
 */
import { isDue, schedule, type ReviewItem } from './review-schedule';

export interface ProgressData {
  version: 1;
  /** lesson id → completion time (ms) */
  completed: Record<string, number>;
  /** lesson id → best quiz score */
  quiz: Record<string, QuizScore>;
  /** lesson id → checklist item key → checked */
  checklists: Record<string, Record<string, boolean>>;
  last: { id: string; title: string; course: string; courseTitle: string; at: number } | null;
  /** "<lesson id>#<question id>" → when that quiz question comes back for review (src/scripts/review-schedule.ts). */
  review: Record<string, ReviewItem>;
}
/** `at` (when the best was set) and `attempts` were added later; older exports simply lack them. */
export interface QuizScore {
  best: number;
  of: number;
  at?: number;
  attempts?: number;
}

const KEY = 'ly-progress-v1';
const empty = (): ProgressData => ({ version: 1, completed: {}, quiz: {}, checklists: {}, last: null, review: {} });

function sanitize(x: unknown): ProgressData {
  const p = empty();
  if (!x || typeof x !== 'object') return p;
  const o = x as Partial<ProgressData>;
  if (o.completed && typeof o.completed === 'object') for (const [k, v] of Object.entries(o.completed)) if (typeof v === 'number') p.completed[k] = v;
  if (o.quiz && typeof o.quiz === 'object') {
    for (const [k, v] of Object.entries(o.quiz)) {
      if (!v || typeof v.best !== 'number' || typeof v.of !== 'number' || !(v.of > 0)) continue;
      const q: QuizScore = { best: Math.max(0, Math.min(v.best, v.of)), of: v.of };
      if (typeof v.at === 'number') q.at = v.at;
      if (typeof v.attempts === 'number') q.attempts = v.attempts;
      p.quiz[k] = q;
    }
  }
  if (o.checklists && typeof o.checklists === 'object') {
    for (const [k, v] of Object.entries(o.checklists)) {
      if (!v || typeof v !== 'object') continue;
      p.checklists[k] = {};
      for (const [item, on] of Object.entries(v)) if (on === true) p.checklists[k]![item] = true;
    }
  }
  if (o.review && typeof o.review === 'object') {
    for (const [k, v] of Object.entries(o.review)) {
      if (!v || typeof v.due !== 'number' || typeof v.interval !== 'number' || !k.includes('#')) continue;
      p.review[k] = { due: v.due, interval: Math.max(1, v.interval), last: Number(v.last ?? 0), right: Number(v.right ?? 0), lapses: Number(v.lapses ?? 0) };
    }
  }
  if (o.last && typeof o.last.id === 'string') p.last = { id: o.last.id, title: String(o.last.title ?? ''), course: String(o.last.course ?? ''), courseTitle: String(o.last.courseTitle ?? ''), at: Number(o.last.at ?? 0) };
  return p;
}

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : empty();
  } catch {
    return empty();
  }
}

export function updateProgress(change: (p: ProgressData) => void): ProgressData {
  const p = loadProgress();
  change(p);
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode, blocked): progress just isn't kept */
  }
  window.dispatchEvent(new CustomEvent('ly:progress'));
  return p;
}

export const exportProgress = (): string => JSON.stringify(loadProgress(), null, 2);

/** Merges an exported file into the current progress (newest completion wins). Returns the lesson count imported. */
export function importProgress(text: string): number {
  const incoming = sanitize(JSON.parse(text));
  updateProgress((p) => {
    for (const [k, v] of Object.entries(incoming.completed)) p.completed[k] = Math.max(p.completed[k] ?? 0, v);
    for (const [k, v] of Object.entries(incoming.review)) if (!p.review[k] || v.last > p.review[k]!.last) p.review[k] = v;
    for (const [k, v] of Object.entries(incoming.quiz)) {
      const mine = p.quiz[k];
      const attempts = Math.max(v.attempts ?? 0, mine?.attempts ?? 0);
      const winner = !mine || v.best / v.of > mine.best / mine.of ? v : mine;
      p.quiz[k] = attempts ? { ...winner, attempts } : winner;
    }
    for (const [k, v] of Object.entries(incoming.checklists)) p.checklists[k] = { ...(p.checklists[k] ?? {}), ...v };
    if (incoming.last && (!p.last || incoming.last.at > p.last.at)) p.last = incoming.last;
  });
  return Object.keys(incoming.completed).length;
}

/**
 * Records a checked quiz. Keeps the best score (compared as a fraction, so a quiz that gained or lost a
 * question still compares fairly) and counts attempts. Returns the stored best and whether this attempt set it.
 */
export function recordQuizScore(id: string, score: number, of: number): { best: QuizScore; improved: boolean } {
  let improved = false;
  const p = updateProgress((data) => {
    const prev = data.quiz[id];
    const attempts = (prev?.attempts ?? 0) + 1;
    improved = !prev || score / of > prev.best / prev.of || (score === of && prev.of !== of);
    data.quiz[id] = improved || !prev ? { best: score, of, at: Date.now(), attempts } : { ...prev, attempts };
  });
  return { best: p.quiz[id]!, improved };
}

/** Schedules one quiz question for review after it was answered (in the lesson quiz, the pre-test or the review page). */
export function recordQuestionResult(lessonId: string, questionId: string, ok: boolean): ReviewItem {
  const key = `${lessonId}#${questionId}`;
  const p = updateProgress((d) => {
    d.review[key] = schedule(d.review[key], ok);
  });
  return p.review[key]!;
}

export interface DueReview {
  key: string;
  lesson: string;
  question: string;
  item: ReviewItem;
}

/** Questions due now, oldest due first. */
export function dueReviews(p: ProgressData = loadProgress(), now = Date.now()): DueReview[] {
  return Object.entries(p.review)
    .filter(([, v]) => isDue(v, now))
    .map(([key, item]) => {
      const at = key.lastIndexOf('#');
      return { key, lesson: key.slice(0, at), question: key.slice(at + 1), item };
    })
    .sort((a, b) => a.item.due - b.item.due);
}
