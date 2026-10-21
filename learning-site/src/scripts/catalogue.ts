/** Home and course pages: progress bars, lesson ticks and "continue where you left off", from local progress. */
import { loadProgress } from './progress';

function render() {
  const p = loadProgress();
  document.querySelectorAll<HTMLElement>('[data-progress-ids]').forEach((bar) => {
    const ids = JSON.parse(bar.dataset.progressIds ?? '[]') as string[];
    const done = ids.filter((id) => p.completed[id]).length;
    const pct = ids.length ? Math.round((done / ids.length) * 100) : 0;
    bar.querySelector('span')?.style.setProperty('--p', `${pct}%`);
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-label', `${done} of ${ids.length} complete`);
    const text = bar.parentElement?.querySelector<HTMLElement>('[data-progress-text]');
    if (text) text.textContent = done ? `${done} of ${ids.length} complete` : 'Not started';
  });
  document.querySelectorAll<HTMLElement>('[data-lesson-id]').forEach((el) => {
    const dot = el.querySelector('.dot');
    if (dot && p.completed[el.dataset.lessonId ?? '']) dot.classList.add('done');
  });
  const card = document.getElementById('continue-card');
  if (card && p.last) {
    const base = document.body.dataset.base ?? '/';
    card.dataset.course = p.last.course;
    card.querySelector('[data-continue-label]')!.textContent = 'Continue where you left off';
    card.querySelector('[data-continue-course]')!.textContent = p.last.courseTitle;
    card.querySelector('[data-continue-title]')!.textContent = p.last.title;
    const note = card.querySelector('[data-continue-note]');
    if (note) note.textContent = p.completed[p.last.id] ? 'Completed. Pick up the next lesson from there.' : 'Last opened lesson';
    const link = card.querySelector<HTMLAnchorElement>('[data-continue-link]');
    if (link) {
      link.href = `${base}${p.last.id}/`;
      link.textContent = 'Continue lesson';
    }
  }
}
render();
window.addEventListener('ly:progress', render);
window.addEventListener('pageshow', render);
