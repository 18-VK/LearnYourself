/**
 * "Before you read" behaviour (src/components/PreTest.astro): check the guesses, show which was right, and schedule
 * each question for review. No score is kept: the quiz at the end of the lesson is the one that counts.
 */
import { recordQuestionResult } from './progress';

export function initPretest(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';
  const lesson = root.dataset.pretest ?? '';
  const questions = [...root.querySelectorAll<HTMLElement>('.pretest-q')];
  const check = root.querySelector<HTMLButtonElement>('[data-pretest-check]')!;
  check.addEventListener('click', () => {
    let right = 0;
    for (const q of questions) {
      const answer = Number(q.dataset.answer);
      const opts = [...q.querySelectorAll<HTMLLabelElement>('.quiz-opt')];
      const chosen = q.querySelector<HTMLInputElement>('.quiz-opt input:checked');
      const ok = Boolean(chosen) && Number(chosen!.value) === answer;
      opts.forEach((o, k) => {
        o.classList.toggle('is-right', k === answer);
        o.classList.toggle('is-wrong', Boolean(o.querySelector('input')?.checked) && k !== answer);
        o.querySelector('input')!.disabled = true;
      });
      const fb = q.querySelector<HTMLElement>('.pretest-fb')!;
      fb.querySelector('.pretest-verdict')!.textContent = ok ? 'Right.' : chosen ? 'Not yet: read on and see why.' : 'No guess: read on and see.';
      fb.classList.toggle('is-right', ok);
      fb.classList.toggle('is-wrong', !ok);
      fb.hidden = false;
      q.classList.toggle('is-correct', ok);
      q.classList.toggle('is-incorrect', !ok);
      if (q.dataset.qid) recordQuestionResult(lesson, q.dataset.qid, ok);
      if (ok) right++;
    }
    root.dataset.done = String(right);
    check.hidden = true;
    const skip = root.querySelector<HTMLAnchorElement>('[data-pretest-skip]');
    if (skip) {
      skip.textContent = right === questions.length ? 'Read the lesson' : 'Read the lesson and find out';
      skip.classList.add('btn-primary');
      skip.focus();
    }
  });
}
