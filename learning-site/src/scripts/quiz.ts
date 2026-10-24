/**
 * "Check your understanding" behaviour: choose or reorder, check, per-question feedback, score, retry.
 * The best score is saved with the rest of the progress (src/scripts/progress.ts, key ly-progress-v1).
 * Order-steps questions reorder by dragging the handle (mouse, pen or touch) or with the ↑/↓ buttons;
 * Alt+↑/↓ also moves the focused step.
 */
import { loadProgress, recordQuestionResult, recordQuizScore, type QuizScore } from './progress';

const qsa = <T extends Element = HTMLElement>(root: ParentNode, sel: string): T[] => [...root.querySelectorAll<T>(sel)];

export function initQuiz(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';
  const id = root.dataset.quiz ?? '';
  const questions = qsa(root, '.quiz-q');
  const checkBtn = root.querySelector<HTMLButtonElement>('[data-quiz-check]')!;
  const retryBtn = root.querySelector<HTMLButtonElement>('[data-quiz-retry]')!;
  const result = root.querySelector<HTMLElement>('[data-quiz-result]')!;
  const bestEl = root.querySelector<HTMLElement>('[data-quiz-best]');
  let checked = false;

  const showBest = (b: QuizScore | undefined) => {
    if (!bestEl) return;
    bestEl.hidden = !b;
    if (b) bestEl.textContent = `Your best: ${b.best} of ${b.of}`;
  };
  showBest(loadProgress().quiz[id]);

  // ── order-steps: reordering ─────────────────────────────────────────────────────────────
  const stepLists = qsa<HTMLOListElement>(root, '.quiz-steps');
  const refreshButtons = (list: HTMLElement) => {
    const steps = qsa(list, ':scope > .quiz-step');
    steps.forEach((s, i) => {
      const [up, down] = qsa<HTMLButtonElement>(s, '.quiz-move');
      if (up) up.disabled = checked || i === 0;
      if (down) down.disabled = checked || i === steps.length - 1;
    });
  };
  const announce = (list: HTMLElement, step: HTMLElement) => {
    const live = list.parentElement?.querySelector<HTMLElement>('[data-steps-live]');
    const steps = qsa(list, ':scope > .quiz-step');
    if (live) live.textContent = `${step.querySelector('.quiz-step-text')?.textContent?.trim() ?? 'Step'}: position ${steps.indexOf(step) + 1} of ${steps.length}.`;
  };
  const move = (step: HTMLElement, dir: number, focusSel?: string) => {
    const list = step.parentElement as HTMLElement;
    if (dir < 0 && step.previousElementSibling) list.insertBefore(step, step.previousElementSibling);
    else if (dir > 0 && step.nextElementSibling) list.insertBefore(step.nextElementSibling, step);
    else return;
    refreshButtons(list);
    announce(list, step);
    // moving a node drops its focus; put it back where the learner was
    const target = focusSel ? step.querySelector<HTMLButtonElement>(focusSel) : step;
    (target && !target.matches(':disabled') ? target : step.querySelector<HTMLButtonElement>('.quiz-move:not(:disabled)') ?? step).focus();
  };
  for (const list of stepLists) {
    qsa(list, '.quiz-step').forEach((s) => (s.tabIndex = -1));
    refreshButtons(list);
    list.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.quiz-move');
      if (!btn || checked) return;
      const dir = Number(btn.dataset.dir);
      move(btn.closest<HTMLElement>('.quiz-step')!, dir, `.quiz-move[data-dir="${dir}"]`);
    });
    list.addEventListener('keydown', (e) => {
      if (checked || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      const step = (e.target as HTMLElement).closest<HTMLElement>('.quiz-step');
      if (!step) return;
      e.preventDefault();
      const focusSel = (e.target as HTMLElement).matches('.quiz-move') ? `.quiz-move[data-dir="${(e.target as HTMLElement).dataset.dir}"]` : undefined;
      move(step, e.key === 'ArrowUp' ? -1 : 1, focusSel);
    });
    // pointer drag: by the handle (any pointer) or anywhere on the text with a mouse
    list.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      const step = t.closest<HTMLElement>('.quiz-step');
      if (checked || !step || t.closest('.quiz-move') || e.button !== 0) return;
      if (!t.closest('.quiz-grip') && e.pointerType !== 'mouse') return;
      e.preventDefault();
      step.setPointerCapture(e.pointerId);
      step.classList.add('is-dragging');
      const onMove = (ev: PointerEvent) => {
        const others = qsa(list, ':scope > .quiz-step').filter((s) => s !== step);
        const before = others.find((s) => {
          const r = s.getBoundingClientRect();
          return ev.clientY < r.top + r.height / 2;
        });
        if (before) {
          if (step.nextElementSibling !== before) list.insertBefore(step, before);
        } else if (list.lastElementChild !== step) list.appendChild(step);
      };
      const onUp = () => {
        step.classList.remove('is-dragging');
        step.removeEventListener('pointermove', onMove);
        step.removeEventListener('pointerup', onUp);
        step.removeEventListener('pointercancel', onUp);
        refreshButtons(list);
        announce(list, step);
      };
      step.addEventListener('pointermove', onMove);
      step.addEventListener('pointerup', onUp);
      step.addEventListener('pointercancel', onUp);
    });
  }

  const shuffle = (list: HTMLElement) => {
    const steps = qsa(list, ':scope > .quiz-step');
    for (let tries = 0; tries < 10; tries++) {
      for (let i = steps.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [steps[i], steps[j]] = [steps[j]!, steps[i]!];
      }
      if (steps.some((s, i) => Number(s.dataset.step) !== i)) break;
    }
    steps.forEach((s) => list.appendChild(s));
  };

  // ── checking ────────────────────────────────────────────────────────────────────────────
  const setDisabled = (on: boolean) => {
    qsa<HTMLInputElement>(root, '.quiz-opt input').forEach((i) => (i.disabled = on));
    root.classList.toggle('is-checked', on);
    stepLists.forEach(refreshButtons);
  };

  checkBtn.addEventListener('click', () => {
    let score = 0;
    let unanswered = 0;
    for (const q of questions) {
      const fb = q.querySelector<HTMLElement>('.quiz-feedback')!;
      const verdict = fb.querySelector<HTMLElement>('.quiz-verdict')!;
      let ok = false;
      if (q.dataset.type === 'order-steps') {
        const steps = qsa(q, '.quiz-step');
        steps.forEach((s, i) => s.classList.toggle('is-right', Number(s.dataset.step) === i));
        steps.forEach((s, i) => s.classList.toggle('is-wrong', Number(s.dataset.step) !== i));
        ok = steps.every((s, i) => Number(s.dataset.step) === i);
        const placed = steps.filter((s, i) => Number(s.dataset.step) === i).length;
        verdict.textContent = ok ? 'Correct: that is the order.' : `Not quite: ${placed} of ${steps.length} steps are in the right place. The correct order:`;
        const sol = fb.querySelector<HTMLElement>('.quiz-solution');
        if (sol) sol.hidden = ok;
      } else {
        const answer = Number(q.dataset.answer);
        const opts = qsa<HTMLLabelElement>(q, '.quiz-opt');
        const chosen = q.querySelector<HTMLInputElement>('.quiz-opt input:checked');
        ok = Boolean(chosen) && Number(chosen!.value) === answer;
        if (!chosen) unanswered++;
        opts.forEach((o, k) => {
          const input = o.querySelector('input')!;
          o.classList.toggle('is-right', k === answer);
          o.classList.toggle('is-wrong', input.checked && k !== answer);
        });
        const right = opts[answer]?.textContent?.trim() ?? '';
        verdict.textContent = ok ? 'Correct.' : chosen ? `Not quite. The answer is: ${right}` : `Not answered. The answer is: ${right}`;
      }
      q.classList.toggle('is-correct', ok);
      q.classList.toggle('is-incorrect', !ok);
      fb.hidden = false;
      if (ok) score++;
      // each answer schedules the question for review (wrong: tomorrow; right: later and later)
      if (q.dataset.qid) recordQuestionResult(id, q.dataset.qid, ok);
    }
    checked = true;
    setDisabled(true);
    const total = questions.length;
    const { best, improved } = recordQuizScore(id, score, total);
    showBest(best);
    const tail = score === total ? ' Well done.' : improved ? ' That is your best so far.' : ` Your best is ${best.best} of ${best.of}.`;
    result.textContent = `You got ${score} of ${total}${unanswered ? ` (${unanswered} not answered)` : ''}.${tail}`;
    checkBtn.hidden = true;
    retryBtn.hidden = false;
    result.focus();
  });

  retryBtn.addEventListener('click', () => {
    checked = false;
    for (const q of questions) {
      q.classList.remove('is-correct', 'is-incorrect');
      q.querySelector<HTMLElement>('.quiz-feedback')!.hidden = true;
      qsa(q, '.is-right, .is-wrong').forEach((x) => x.classList.remove('is-right', 'is-wrong'));
      qsa<HTMLInputElement>(q, '.quiz-opt input').forEach((i) => (i.checked = false));
    }
    stepLists.forEach(shuffle);
    setDisabled(false);
    result.textContent = '';
    retryBtn.hidden = true;
    checkBtn.hidden = false;
    (questions[0]?.querySelector<HTMLElement>('input, .quiz-move:not(:disabled)') ?? checkBtn).focus();
  });
}
