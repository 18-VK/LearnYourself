/**
 * Client-side access to the interview bank, all static files generated at build time:
 *   interview-prep/questions.json   every question's metadata (no answers): flashcards, mock interview
 *   interview-prep/search.json      question id → plain text of the full answer: Browse's full-text search
 *   interview-prep/topics/<topic>/  the topic pages; full answers are read from there on demand
 */
export interface QMeta {
  id: string;
  topic: string;
  topicTitle: string;
  subtopic: string;
  subtopicLabel: string;
  difficulty: 'junior' | 'mid' | 'senior';
  origin: 'notes' | 'web';
  originLabel: string;
  reviewed: boolean;
  /** question and short answer as safe inline HTML */
  question: string;
  short: string;
  /** topic page URL with the question's anchor */
  href: string;
  lessons: { title: string; href: string }[];
}
export interface QBank {
  topics: { id: string; title: string }[];
  questions: QMeta[];
}

export const base = document.body.dataset.base ?? '/';

let bank: Promise<QBank> | null = null;
export function loadBank(): Promise<QBank> {
  bank ??= fetch(`${base}interview-prep/questions.json`).then((r) => {
    if (!r.ok) throw new Error(`questions.json: ${r.status}`);
    return r.json() as Promise<QBank>;
  });
  bank.catch(() => (bank = null));
  return bank;
}

let search: Promise<Record<string, string>> | null = null;
export function loadSearchText(): Promise<Record<string, string>> {
  search ??= fetch(`${base}interview-prep/search.json`).then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : {}));
  search.catch(() => (search = null));
  return search;
}

const pages = new Map<string, Promise<Document>>();
/** The full answer of a question (a detached copy of its `.iq-body` on the topic page), or null. */
export async function loadAnswer(href: string, id: string): Promise<HTMLElement | null> {
  const pageUrl = href.split('#')[0]!;
  let page = pages.get(pageUrl);
  if (!page) {
    page = fetch(pageUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`${pageUrl}: ${r.status}`);
        return r.text();
      })
      .then((html) => new DOMParser().parseFromString(html, 'text/html'));
    pages.set(pageUrl, page);
    page.catch(() => pages.delete(pageUrl));
  }
  const doc = await page;
  const body = doc.getElementById(id)?.querySelector<HTMLElement>('.iq-body');
  return body ? (document.importNode(body, true) as HTMLElement) : null;
}

/** Fisher–Yates, returns a new array. */
export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function readStore<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function writeStore(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the session still works, it just isn't kept */
  }
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
export function badges(q: QMeta, pile?: 'know' | 'review'): string {
  const diff = q.difficulty[0]!.toUpperCase() + q.difficulty.slice(1);
  return (
    `<div class="iq-badges"><span class="badge iq-origin iq-origin-${q.origin}${q.reviewed ? ' is-reviewed' : ''}">${esc(q.originLabel)}</span>` +
    `<span class="badge iq-diff iq-diff-${q.difficulty}">${diff}</span><span class="badge iq-topic">${esc(q.topicTitle)}</span>` +
    `<span class="badge iq-sub">${esc(q.subtopicLabel)}</span>` +
    (pile ? `<span class="badge iq-pile iq-pile-${pile}">${pile === 'know' ? 'In “Know it”' : 'In “Review again”'}</span>` : '') +
    '</div>'
  );
}
