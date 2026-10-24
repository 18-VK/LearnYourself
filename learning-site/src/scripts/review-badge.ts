/**
 * "Review today: N due" on the home and progress pages (any element with [data-review-card]): the due quiz
 * questions plus the flashcards in the "Review again" pile. Hidden when nothing is due.
 */
import { dueReviews } from './progress';
import { flashcardsToReview } from './review-schedule';

function render(): void {
  const due = dueReviews().length;
  const cards = flashcardsToReview();
  document.querySelectorAll<HTMLElement>('[data-review-card]').forEach((card) => {
    const n = due + cards;
    card.hidden = n === 0;
    const count = card.querySelector<HTMLElement>('[data-review-count]');
    if (count) count.textContent = String(n);
    const note = card.querySelector<HTMLElement>('[data-review-note]');
    if (note) note.textContent = [due ? `${due} quiz question${due === 1 ? '' : 's'}` : '', cards ? `${cards} flashcard${cards === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
  });
}
render();
window.addEventListener('ly:progress', render);
window.addEventListener('pageshow', render);
