/**
 * The review page (src/pages/review.astro): finds the due questions in the progress store, fetches their lessons'
 * review-data JSON, shows them interleaved across courses, and reschedules each one as it is answered.
 */
import type { ReviewLesson, ReviewQuestion } from '../pages/review-data/[...lesson].json';
import { dueReviews, loadProgress, recordQuestionResult, type DueReview } from './progress';
import { flashcardsToReview, interleave, nextDue } from './review-schedule';

const base = document.body.dataset.base ?? '/';
const status = document.querySelector<HTMLElement>('[data-review-status]');
const list = document.querySelector<HTMLElement>('[data-review-list]');
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...children);
  return e;
}

interface Item {
  due: DueReview;
  lesson: ReviewLesson;
  q: ReviewQuestion;
}

let remaining = 0;

function updateStatus(total: number): void {
  if (!status) return;
  if (!total) {
    const items = Object.values(loadProgress().review);
    const next = nextDue(items);
    status.textContent = items.length
      ? `Nothing is due today. ${items.length} question${items.length === 1 ? '' : 's'} scheduled; the next comes back on ${fmtDate(next ?? Date.now())}.`
      : 'Nothing to review yet. Answer a lesson quiz or a “Before you read” box, and the questions come back here on the right day.';
    return;
  }
  status.textContent = remaining ? `${remaining} of ${total} left.` : `Done for today: ${total} reviewed. Come back tomorrow.`;
}

function render(item: Item, total: number): HTMLElement {
  const { lesson, q, due } = item;
  const li = el('li', { className: 'quiz-q review-q' });
  li.dataset.qid = q.id;
  li.dataset.lesson = lesson.lesson;
  const head = el('div', { className: 'quiz-q-head' });
  head.append(el('a', { className: 'review-lesson', href: lesson.url, textContent: `${lesson.courseTitle} › ${lesson.title}` }));
  if (due.item.lapses) head.append(el('span', { className: 'quiz-kind', textContent: `missed ${due.item.lapses}×` }));
  if (!q.reviewed) head.append(el('span', { className: 'quiz-unreviewed', title: "The author hasn't checked this question yet", textContent: 'Not yet reviewed' }));
  li.append(head);

  if (q.type === 'order-steps') {
    // ordering needs the drag/arrow UI of the lesson quiz; it is rescheduled when the lesson quiz is checked
    const p = el('p', { className: 'quiz-prompt' });
    p.innerHTML = q.prompt;
    li.append(p, el('p', { className: 'review-open' }, el('a', { href: `${lesson.url}#ly-quiz`, textContent: 'Put the steps in order in the lesson quiz' })));
    return li;
  }
  const fs = el('fieldset', { className: 'quiz-choice' });
  const legend = el('legend', { className: 'quiz-prompt' });
  legend.innerHTML = q.prompt;
  fs.append(legend);
  if (q.code) {
    const code = el('div', { className: 'quiz-code' });
    code.innerHTML = q.code;
    fs.append(code);
  }
  const opts = el('div', { className: 'quiz-options' });
  const labels = q.options.map((o, k) => {
    const label = el('label', { className: 'quiz-opt' });
    const input = el('input', { type: 'radio', name: `ly-review-${q.id}`, value: String(k) });
    const text = el('span');
    text.innerHTML = o;
    label.append(input, text);
    opts.append(label);
    return label;
  });
  fs.append(opts);
  li.append(fs);
  const fb = el('div', { className: 'quiz-feedback' });
  fb.hidden = true;
  const verdict = el('p', { className: 'quiz-verdict' });
  const expl = el('p', { className: 'quiz-expl' });
  expl.innerHTML = q.explanation;
  fb.append(verdict, expl);
  if (q.anchor) fb.append(el('p', { className: 'quiz-src' }, el('a', { href: `${lesson.url}#${q.anchor}`, textContent: `Read it in the lesson: ${q.section}` })));
  li.append(fb);

  // answering grades at once: this is review, not a test
  opts.addEventListener('change', (e) => {
    const chosen = (e.target as HTMLInputElement).closest<HTMLInputElement>('input');
    if (!chosen || li.dataset.answered) return;
    const k = Number(chosen.value);
    const ok = k === q.answer;
    labels.forEach((l, i) => {
      l.classList.toggle('is-right', i === q.answer);
      l.classList.toggle('is-wrong', i === k && !ok);
      l.querySelector('input')!.disabled = true;
    });
    verdict.textContent = ok ? 'Correct.' : `Not quite. The answer is: ${labels[q.answer]?.textContent?.trim() ?? ''}`;
    fb.hidden = false;
    li.classList.toggle('is-correct', ok);
    li.classList.toggle('is-incorrect', !ok);
    li.dataset.answered = ok ? 'right' : 'wrong';
    const next = recordQuestionResult(lesson.lesson, q.id, ok);
    verdict.textContent += ok ? ` Back in ${next.interval} day${next.interval === 1 ? '' : 's'}.` : ' Back tomorrow.';
    remaining--;
    updateStatus(total);
  });
  return li;
}

async function main(): Promise<void> {
  const due = dueReviews();
  const fc = flashcardsToReview();
  const fcBox = document.querySelector<HTMLElement>('[data-review-flashcards]');
  if (fcBox) {
    fcBox.hidden = fc === 0;
    const n = fcBox.querySelector('[data-review-flashcards-count]');
    if (n) n.textContent = String(fc);
  }
  if (!due.length) {
    updateStatus(0);
    return;
  }
  const lessons = [...new Set(due.map((d) => d.lesson))];
  const fetched = await Promise.all(
    lessons.map(async (id): Promise<[string, ReviewLesson | null]> => {
      try {
        const r = await fetch(`${base}review-data/${id}.json`);
        return [id, r.ok ? ((await r.json()) as ReviewLesson) : null];
      } catch {
        return [id, null];
      }
    }),
  );
  const byLesson = new Map(fetched);
  const items: Item[] = [];
  for (const d of due) {
    const lesson = byLesson.get(d.lesson);
    const q = lesson?.questions.find((x) => x.id === d.question);
    if (lesson && q) items.push({ due: d, lesson, q });
  }
  // consecutive questions come from different courses, then different lessons
  const ordered = interleave(interleave(items, (i) => i.lesson.lesson), (i) => i.lesson.course);
  remaining = ordered.filter((i) => i.q.type !== 'order-steps').length;
  list?.replaceChildren(...ordered.map((i) => render(i, remaining)));
  updateStatus(remaining);
  document.body.dataset.reviewReady = 'true';
}

// only the review page has the list; importing this module elsewhere does nothing
if (list) void main();
