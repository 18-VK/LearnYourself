/** Every interview question's metadata (no answers), for the flashcards and the mock interview. */
import type { APIRoute } from 'astro';
import { topics } from '../../lib/data';
import { allViews } from '../../lib/interview';

export const GET: APIRoute = async () => {
  const views = await allViews();
  const body = {
    topics: topics.map((t) => ({ id: t.id, title: t.title })),
    questions: views.map((v) => ({
      id: v.id,
      topic: v.topic,
      topicTitle: v.topicTitle,
      subtopic: v.subtopic,
      subtopicLabel: v.subtopicLabel,
      difficulty: v.difficulty,
      origin: v.origin,
      originLabel: v.originLabel,
      reviewed: v.reviewed,
      question: v.question,
      short: v.short,
      href: v.href,
      lessons: v.lessons.map((l) => ({ title: l.title, href: l.href })),
    })),
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
