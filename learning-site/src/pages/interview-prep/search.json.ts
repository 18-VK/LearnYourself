/** Question id → plain text of everything in its card (lowercase), for Browse's full-text search. */
import type { APIRoute } from 'astro';
import { allViews } from '../../lib/interview';

export const GET: APIRoute = async () => {
  const views = await allViews();
  return new Response(JSON.stringify(Object.fromEntries(views.map((v) => [v.id, v.text]))), { headers: { 'Content-Type': 'application/json' } });
};
