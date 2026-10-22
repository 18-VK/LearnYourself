/**
 * Shows saved best quiz scores next to lessons (course pages, the progress page). Any element with
 * `data-quiz-badge` inside an element with `data-lesson-id` gets " · quiz 4/5" once that quiz has been
 * checked; until then it keeps its server-rendered " · quiz" label.
 */
import { loadProgress } from './progress';

function render() {
  const { quiz } = loadProgress();
  document.querySelectorAll<HTMLElement>('[data-quiz-badge]').forEach((badge) => {
    const id = badge.closest<HTMLElement>('[data-lesson-id]')?.dataset.lessonId ?? '';
    const s = quiz[id];
    badge.textContent = s ? ` · quiz ${s.best}/${s.of}` : ' · quiz';
    badge.classList.toggle('quiz-done', Boolean(s));
    badge.classList.toggle('quiz-full', Boolean(s && s.best === s.of));
    if (s) badge.title = `Best quiz score: ${s.best} of ${s.of}`;
    else badge.removeAttribute('title');
  });
  // progress page: a summary per course and the lessons whose quiz has a score
  document.querySelectorAll<HTMLElement>('[data-quiz-summary]').forEach((box) => {
    const rows = [...box.querySelectorAll<HTMLElement>('[data-lesson-id]')];
    const done = rows.filter((r) => quiz[r.dataset.lessonId ?? '']);
    rows.forEach((r) => (r.hidden = !quiz[r.dataset.lessonId ?? '']));
    const text = box.querySelector<HTMLElement>('[data-quiz-summary-text]');
    if (text) {
      if (!rows.length) text.textContent = 'No quizzes in this course yet.';
      else if (!done.length) text.textContent = `${rows.length} lesson quiz${rows.length === 1 ? '' : 'zes'}, none taken yet.`;
      else {
        const pct = Math.round((done.reduce((n, r) => n + quiz[r.dataset.lessonId!]!.best / quiz[r.dataset.lessonId!]!.of, 0) / done.length) * 100);
        text.textContent = `Quizzes: ${done.length} of ${rows.length} taken · average best score ${pct}%`;
      }
    }
  });
}
render();
window.addEventListener('ly:progress', render);
window.addEventListener('pageshow', render);
