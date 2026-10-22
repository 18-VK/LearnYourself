/**
 * Interview questions (src/data/generated/interview.json) → render-ready views, shared by the topic pages,
 * Browse, the lesson cards and the JSON the flashcards and mock interview load. Build time only.
 */
import { getCollection } from 'astro:content';
import interviewSources from '../data/generated/interview-sources.json';
import { normText } from '../markdown/text';
import {
  DIFFICULTIES,
  lessonIndex,
  lessonRefUrl,
  originLabel,
  questions,
  questionUrl,
  subtopicLabel,
  topicById,
  type NoteSection,
  type Question,
  type WebSource,
} from './data';
import { inlineText, markdownText, renderBlock, renderCode, renderInline } from './markdown';
import { site } from './site';

export interface SourceView {
  kind: 'web' | 'note';
  label: string;
  href: string;
  /** web: when it was read. */
  accessed?: string;
  /** note: true when the link goes to the lesson that renders the section (else to the note on GitHub). */
  onSite?: boolean;
}
export interface QuestionView {
  id: string;
  topic: string;
  topicTitle: string;
  subtopic: string;
  subtopicLabel: string;
  difficulty: Question['difficulty'];
  origin: Question['origin'];
  originLabel: string;
  reviewed: boolean;
  notCoveredYet: boolean;
  question: string;
  questionText: string;
  short: string;
  shortText: string;
  answer: string;
  code: string | null;
  pitfalls: string[];
  followUps: string[];
  versionNote: string | null;
  sources: SourceView[];
  lessons: { title: string; href: string; courseTitle: string }[];
  /** Short ids of the lessons that teach it. */
  lessonIds: string[];
  href: string;
  /** Plain text of everything in the card, lowercase, for client-side search. */
  text: string;
}

const githubBlob = (file: string) => `${site.repo}/blob/main/${file.split('/').map(encodeURIComponent).join('/')}`;
const routed = new Map((interviewSources as { file: string; url: string }[]).map((s) => [s.file, s.url]));

let fileLessons: Promise<Map<string, string[]>> | null = null;
/** note file → short ids of the lessons built from it */
function lessonsByFile(): Promise<Map<string, string[]>> {
  return (fileLessons ??= getCollection('lessons').then((entries) => {
    const m = new Map<string, string[]>();
    for (const e of entries) for (const s of e.data.sources) m.set(s.file, [...(m.get(s.file) ?? []), e.data.lesson]);
    return m;
  }));
}

async function noteSource(src: NoteSection): Promise<SourceView> {
  const heading = src.section.replace(/^\s*#{1,6}\s+/, '');
  const name = src.file.split('/').pop() ?? src.file;
  const want = normText(heading);
  for (const slug of (await lessonsByFile()).get(src.file) ?? []) {
    const l = lessonIndex[slug];
    const hits = l?.headings.filter((h) => normText(h.text) === want) ?? [];
    const h = hits[(src.occurrence ?? 1) - 1] ?? hits[0];
    if (l && h) return { kind: 'note', label: `${heading} · lesson “${l.title}”`, href: lessonRefUrl(l, h.id), onSite: true };
  }
  return { kind: 'note', label: `${name} › ${heading}`, href: routed.get(src.file) ?? githubBlob(src.file), onSite: false };
}
const webSource = (s: WebSource): SourceView => ({ kind: 'web', label: s.title, href: s.url, accessed: s.accessed });

const views = new Map<string, Promise<QuestionView>>();
export function viewOf(q: Question): Promise<QuestionView> {
  let v = views.get(q.id);
  if (!v) {
    v = build(q);
    views.set(q.id, v);
  }
  return v;
}

async function build(q: Question): Promise<QuestionView> {
  const sources = await Promise.all(q.sources.map((s) => ('url' in s ? webSource(s) : noteSource(s))));
  const text = [q.question, q.shortAnswer, markdownText(q.answer), ...q.pitfalls, ...q.followUps, q.code?.source ?? '', q.versionNote ?? '']
    .map((t) => inlineText(t))
    .join(' ')
    .toLowerCase();
  return {
    id: q.id,
    topic: q.topic,
    topicTitle: topicById.get(q.topic)?.title ?? q.topic,
    subtopic: q.subtopic,
    subtopicLabel: subtopicLabel(q.subtopic),
    difficulty: q.difficulty,
    origin: q.origin,
    originLabel: originLabel(q),
    reviewed: q.reviewed,
    notCoveredYet: q.notCoveredYet,
    question: renderInline(q.question),
    questionText: inlineText(q.question),
    short: renderInline(q.shortAnswer),
    shortText: inlineText(q.shortAnswer),
    answer: q.answer.trim() ? await renderBlock(q.answer, { idPrefix: q.id, baseFile: q.origin === 'notes' ? q.answerFrom?.file : undefined }) : '',
    code: q.code ? await renderCode(q.code.source, q.code.lang, `${q.id}-code`) : null,
    pitfalls: q.pitfalls.map((p) => renderInline(p.replace(/^\s*❌\s*/u, ''))),
    followUps: q.followUps.map((f) => renderInline(f)),
    versionNote: q.versionNote ? renderInline(q.versionNote) : null,
    sources,
    lessons: q.relatedLessons.map((l) => ({ title: l.title, href: lessonRefUrl(l), courseTitle: l.courseTitle })),
    lessonIds: q.relatedLessons.map((l) => l.id),
    href: questionUrl(q),
    text,
  };
}

const ORIGIN_RANK = { notes: 0, web: 1 } as const;
/** Notes questions first, then by difficulty, keeping file order otherwise. */
export function sortQuestions<T extends { origin: 'notes' | 'web'; difficulty: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin] || DIFFICULTIES.indexOf(a.difficulty as never) - DIFFICULTIES.indexOf(b.difficulty as never));
}

export const allViews = (): Promise<QuestionView[]> => Promise.all(sortQuestions(questions).map(viewOf));

/** Counts per difficulty and origin, for the overview. */
export function countsOf(list: { difficulty: string; origin: string; reviewed: boolean }[]) {
  return {
    total: list.length,
    notes: list.filter((q) => q.origin === 'notes').length,
    web: list.filter((q) => q.origin === 'web').length,
    reviewed: list.filter((q) => q.reviewed).length,
    junior: list.filter((q) => q.difficulty === 'junior').length,
    mid: list.filter((q) => q.difficulty === 'mid').length,
    senior: list.filter((q) => q.difficulty === 'senior').length,
  };
}
