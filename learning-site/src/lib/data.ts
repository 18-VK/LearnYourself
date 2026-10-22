/**
 * Typed access to the resolved data the content pipeline writes (src/data/generated/*.json, see
 * scripts/lib/data-check.ts): quizzes, cheat sheets, interview questions and the lesson index.
 * Every dataset may be empty; pages show an empty state then.
 */
import cheatsheetsRaw from '../data/generated/cheatsheets.json';
import interviewRaw from '../data/generated/interview.json';
import lessonIndexRaw from '../data/generated/lesson-index.json';
import quizzesRaw from '../data/generated/quizzes.json';
import type { InterviewQuestion, NoteSection, QuizQuestion, WebSource } from '../data/schema';
import { lessonUrl, site, url } from './site';

export type { NoteSection, WebSource };

/** A lesson as data files refer to it: short id (`id`) plus the full path used in URLs. */
export interface LessonRef {
  id: string;
  path: string;
  title: string;
  course: string;
  courseTitle: string;
}
/** A lesson section: LessonRef plus the heading and its anchor id on the lesson page. */
export interface SectionRef extends LessonRef {
  section: string;
  anchor: string;
}
export interface LessonIndexEntry {
  path: string;
  title: string;
  course: string;
  courseTitle: string;
  module: string;
  kind: 'lesson' | 'checklist' | 'roadmap';
  headings: { depth: number; text: string; id: string }[];
}

// ── quizzes ───────────────────────────────────────────────────────────────────────────────────
export type ResolvedQuizQuestion = QuizQuestion & { source: { section: string; anchor: string | null } };
export const quizzes = quizzesRaw as unknown as Record<string, ResolvedQuizQuestion[]>;

// ── cheat sheets ──────────────────────────────────────────────────────────────────────────────
export interface SheetItem {
  term: string;
  desc?: string;
  code?: string;
  lang?: string;
  from: SectionRef | null;
  docs?: WebSource;
}
export interface SheetRow {
  cells: string[];
  from: SectionRef | null;
  docs: WebSource | null;
}
export interface SheetGroup {
  title: string;
  note: string | null;
  items: SheetItem[];
  table: { columns: string[]; rows: SheetRow[]; from: SectionRef | null } | null;
}
export interface Sheet {
  id: string;
  title: string;
  summary: string;
  groups: SheetGroup[];
}
const sheetData = cheatsheetsRaw as unknown as { sheets: Sheet[]; byLesson: Record<string, string[]> };
export const sheets: Sheet[] = sheetData.sheets ?? [];
const sheetById = new Map(sheets.map((s) => [s.id, s]));
export const sheetItemCount = (s: Sheet): number => s.groups.reduce((n, g) => n + g.items.length + (g.table?.rows.length ?? 0), 0);

export interface SheetLink {
  id: string;
  title: string;
  url: string;
  /** false while the sheet is planned but not written: the link then goes to its entry on the index. */
  ready: boolean;
}
const plannedTitle = new Map(site.cheatsheets.map((s) => [s.id, s.title]));
export function sheetLink(id: string): SheetLink {
  const s = sheetById.get(id);
  return s
    ? { id, title: s.title, url: url(`cheat-sheets/${id}/`), ready: true }
    : { id, title: plannedTitle.get(id) ?? id, url: url(`cheat-sheets/#${id}`), ready: false };
}
/** Sheets related to some lessons: their manifest `cheatsheets` first, then sheets that cite them. */
export function sheetsFor(lessonSlugs: string[], manifest: { id: string }[] = []): SheetLink[] {
  const ids = new Set<string>(manifest.map((m) => m.id));
  for (const slug of lessonSlugs) for (const id of sheetData.byLesson?.[slug] ?? []) ids.add(id);
  return [...ids].filter((id) => sheetById.has(id) || plannedTitle.has(id)).map(sheetLink);
}

// ── interview ─────────────────────────────────────────────────────────────────────────────────
export interface Topic {
  id: string;
  title: string;
  subtopics: string[];
  notCoveredYet: boolean;
  notes: number;
  web: number;
  reviewed: number;
}
export type Question = Omit<InterviewQuestion, 'relatedLessons' | 'answer'> & { answer: string; relatedLessons: LessonRef[] };
const interviewData = interviewRaw as unknown as { topics: Topic[]; questions: Question[]; byLesson: Record<string, string[]> };
export const topics: Topic[] = interviewData.topics ?? [];
export const questions: Question[] = interviewData.questions ?? [];
const questionById = new Map(questions.map((q) => [q.id, q]));
export const topicById = new Map(topics.map((t) => [t.id, t]));
export const questionsOfTopic = (topic: string): Question[] => questions.filter((q) => q.topic === topic);
export const questionsForLesson = (slug: string): Question[] => (interviewData.byLesson?.[slug] ?? []).map((id) => questionById.get(id)).filter((q): q is Question => Boolean(q));

export const DIFFICULTIES = ['junior', 'mid', 'senior'] as const;
export const difficultyLabel = (d: string): string => d[0]!.toUpperCase() + d.slice(1);
/** "model-binding-and-validation" → "Model binding and validation" */
export const subtopicLabel = (s: string): string => {
  const words = s.split('-');
  const fix: Record<string, string> = { api: 'API', apis: 'APIs', ctes: 'CTEs', clr: 'CLR', jit: 'JIT', il: 'IL', gc: 'GC', jwt: 'JWT', oauth2: 'OAuth 2.0', pkce: 'PKCE', mvvm: 'MVVM', xaml: 'XAML', http: 'HTTP', httpclient: 'HttpClient', rest: 'REST', openapi: 'OpenAPI', idisposable: 'IDisposable', iqueryable: 'IQueryable', ienumerable: 'IEnumerable', dp: 'DP', solid: 'SOLID', winforms: 'WinForms', oop: 'OOP', ui: 'UI', io: 'I/O', json: 'JSON', xml: 'XML', cli: 'CLI', mvc: 'MVC', aspnet: 'ASP.NET', ef: 'EF', dapper: 'Dapper', wpf: 'WPF', sql: 'SQL', di: 'DI', vs: 'vs' };
  const out = words.map((w) => fix[w] ?? w).join(' ');
  return out[0]!.toUpperCase() + out.slice(1);
};
export function originLabel(q: { origin: string; reviewed: boolean }): string {
  if (q.origin === 'notes') return 'From my notes';
  return q.reviewed ? 'Web-researched, reviewed' : 'Web-researched, unreviewed';
}
export const topicUrl = (topic: string): string => url(`interview-prep/topics/${topic}/`);
export const questionUrl = (q: { topic: string; id: string }): string => `${topicUrl(q.topic)}#${q.id}`;

// ── lessons ───────────────────────────────────────────────────────────────────────────────────
export const lessonIndex = lessonIndexRaw as unknown as Record<string, LessonIndexEntry>;
export const lessonRefUrl = (l: { path: string }, anchor?: string | null): string => lessonUrl(l.path) + (anchor ? `#${anchor}` : '');
