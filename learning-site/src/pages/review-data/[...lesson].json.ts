/**
 * One JSON file per lesson with a quiz, with the questions' Markdown already rendered to HTML, so the review page
 * (src/pages/review.astro) can show due questions without a Markdown renderer in the browser. Fetched only for the
 * lessons that have something due.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { lessonIndex, quizzes, type ResolvedQuizQuestion } from '../../lib/data';
import { renderCode, renderInline } from '../../lib/markdown';
import { courseById, lessonUrl } from '../../lib/site';

export interface ReviewQuestion {
  id: string;
  type: ResolvedQuizQuestion['type'];
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  code: string | null;
  section: string;
  anchor: string | null;
  reviewed: boolean;
}
export interface ReviewLesson {
  lesson: string;
  title: string;
  course: string;
  courseTitle: string;
  url: string;
  questions: ReviewQuestion[];
}

const sectionTitle = (s: string) => s.replace(/^\s*#{1,6}\s+/, '');

export const getStaticPaths: GetStaticPaths = () =>
  Object.keys(quizzes)
    .filter((slug) => lessonIndex[slug] && quizzes[slug]!.length)
    .map((slug) => ({ params: { lesson: lessonIndex[slug]!.path }, props: { slug } }));

export const GET: APIRoute = async ({ props }) => {
  const slug = (props as { slug: string }).slug;
  const entry = lessonIndex[slug]!;
  const questions: ReviewQuestion[] = await Promise.all(
    quizzes[slug]!.map(async (q) => ({
      id: q.id,
      type: q.type,
      prompt: renderInline(q.prompt),
      options: q.type === 'order-steps' ? [] : q.options.map((o) => renderInline(o)),
      answer: q.type === 'order-steps' ? -1 : q.answer,
      explanation: renderInline(q.explanation),
      code: q.type === 'predict-output' ? await renderCode(q.code.source, q.code.lang, `review-${q.id}`) : null,
      section: sectionTitle(q.source.section),
      anchor: q.source.anchor,
      reviewed: q.reviewed,
    })),
  );
  const data: ReviewLesson = { lesson: entry.path, title: entry.title, course: entry.course, courseTitle: courseById(entry.course).title, url: lessonUrl(entry.path), questions };
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
