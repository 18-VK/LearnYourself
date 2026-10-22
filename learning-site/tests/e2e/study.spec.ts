/**
 * Quizzes, cheat sheets and Interview Prep against the production build. Every test reads the resolved data
 * the pipeline wrote (src/data/generated/*.json), so it works whether a dataset is empty (the pages must show
 * an empty state) or full.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const read = <T>(f: string): T => JSON.parse(fs.readFileSync(`src/data/generated/${f}`, 'utf8')) as T;
interface QuizQ {
  id: string;
  type: 'mcq' | 'predict-output' | 'order-steps';
  answer?: number;
  steps?: string[];
}
const quizzes = read<Record<string, QuizQ[]>>('quizzes.json');
const lessonIndex = read<Record<string, { path: string; title: string; course: string }>>('lesson-index.json');
const cheats = read<{ sheets: { id: string; title: string; groups: { items: { term: string }[]; table: { rows: unknown[] } | null }[] }[]; byLesson: Record<string, string[]> }>('cheatsheets.json');
const interview = read<{ topics: { id: string }[]; questions: { id: string; topic: string; difficulty: string; origin: string; question: string }[]; byLesson: Record<string, string[]> }>('interview.json');
const assets = read<{ usedBy: string | null; kind: string; src?: string }[]>('assets.json');

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
const quizLessons = Object.keys(quizzes).filter((k) => lessonIndex[k] && quizzes[k]!.length);
/** The lesson whose quiz has the most question types, so one run covers all of them. */
const quizLesson = quizLessons.sort((a, b) => new Set(quizzes[b]!.map((q) => q.type)).size - new Set(quizzes[a]!.map((q) => q.type)).size)[0];

async function answerQuiz(page: Page, correct: boolean) {
  const quiz = page.locator('#ly-quiz');
  for (const q of quizzes[quizLesson!]!) {
    const box = quiz.locator(`.quiz-q[data-qid="${q.id}"]`);
    if (q.type === 'order-steps') {
      // put the steps in the right order with the "Move up" buttons (keyboard-reachable controls)
      const n = q.steps!.length;
      for (let target = 0; target < n; target++) {
        const steps = box.locator('.quiz-step');
        let at = -1;
        for (let i = 0; i < n; i++) if ((await steps.nth(i).getAttribute('data-step')) === String(target)) at = i;
        for (let i = at; i > target; i--) await box.locator(`.quiz-step[data-step="${target}"] .quiz-move[data-dir="-1"]`).click();
      }
      if (!correct) await box.locator('.quiz-step').first().locator('.quiz-move[data-dir="1"]').click();
    } else {
      const options = box.locator('.quiz-opt input');
      const pick = correct ? q.answer! : (q.answer! + 1) % (await options.count());
      await options.nth(pick).check();
    }
  }
  await quiz.getByRole('button', { name: 'Check answers' }).click();
}

test.describe('quiz', () => {
  test('answering saves the best score, shown on the lesson, course and progress pages', async ({ page }) => {
    test.skip(!quizLesson, 'no quizzes in the data yet');
    const errors = watchErrors(page);
    const lesson = lessonIndex[quizLesson!]!;
    const total = quizzes[quizLesson!]!.length;
    await page.goto(`${lesson.path}/`);
    const quiz = page.locator('#ly-quiz');
    await quiz.scrollIntoViewIfNeeded();
    await expect(quiz).toHaveAttribute('data-ready', 'true');
    // it sits outside the lesson body and before "Mark complete"
    await expect(page.locator('#lesson-body #ly-quiz')).toHaveCount(0);
    expect(await page.evaluate(() => Boolean(document.querySelector('#ly-quiz')!.compareDocumentPosition(document.querySelector('#mark-complete')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

    await answerQuiz(page, false);
    await expect(quiz.locator('[data-quiz-result]')).toContainText(`of ${total}`);
    await expect(quiz.locator('.quiz-feedback:visible').first()).toBeVisible();
    await expect(quiz.locator('.quiz-q.is-incorrect').first()).toBeVisible();
    await quiz.getByRole('button', { name: 'Try again' }).click();
    await answerQuiz(page, true);
    await expect(quiz.locator('[data-quiz-result]')).toContainText(`You got ${total} of ${total}`);
    await expect(quiz.locator('.quiz-q.is-incorrect')).toHaveCount(0);
    // every feedback links to its section, and the anchor exists on the page
    for (const href of await quiz.locator('.quiz-src a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
      await expect(page.locator(`[id="${decodeURIComponent(href!.slice(1))}"]`)).toHaveCount(1);
    }

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ly-progress-v1') ?? '{}'));
    expect(saved.quiz[lesson.path]).toMatchObject({ best: total, of: total, attempts: 2 });

    await page.reload();
    await page.locator('#ly-quiz').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-quiz-best]')).toHaveText(`Your best: ${total} of ${total}`);

    await page.goto(`${lesson.course}/`);
    await expect(page.locator(`[data-lesson-id="${lesson.path}"] [data-quiz-badge]`)).toHaveText(` · quiz ${total}/${total}`);
    await page.goto('progress/');
    await expect(page.locator(`[data-quiz-summary] [data-lesson-id="${lesson.path}"]`)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('order-steps reorders by keyboard and by dragging', async ({ page }) => {
    const slug = quizLessons.find((k) => quizzes[k]!.some((q) => q.type === 'order-steps'));
    test.skip(!slug, 'no order-steps question in the data yet');
    const q = quizzes[slug!]!.find((x) => x.type === 'order-steps')!;
    await page.goto(`${lessonIndex[slug!]!.path}/`);
    const list = page.locator(`.quiz-q[data-qid="${q.id}"] .quiz-steps`);
    await list.scrollIntoViewIfNeeded();
    await expect(page.locator('#ly-quiz')).toHaveAttribute('data-ready', 'true');
    const order = () => list.locator('.quiz-step').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.step));
    const before = await order();
    // keyboard: the second step's "Move up" button, then Alt+ArrowDown moves it back
    await list.locator('.quiz-step').nth(1).locator('.quiz-move[data-dir="-1"]').focus();
    await page.keyboard.press('Enter');
    expect(await order()).toEqual([before[1], before[0], ...before.slice(2)]);
    await expect(list.locator('.quiz-step').first().locator('.quiz-move[data-dir="-1"]')).toBeDisabled();
    await page.keyboard.press('Alt+ArrowDown');
    expect(await order()).toEqual(before);
    // drag the first step below the second by its handle
    const grip = list.locator('.quiz-step').first().locator('.quiz-grip');
    const second = list.locator('.quiz-step').nth(1);
    const g = (await grip.boundingBox())!;
    const s = (await second.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.width / 2, s.y + s.height * 0.8, { steps: 6 });
    await page.mouse.up();
    expect(await order()).toEqual([before[1], before[0], ...before.slice(2)]);
  });
});

test.describe('cheat sheets', () => {
  test('the index lists the sheets, or says none are published', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('cheat-sheets/');
    if (cheats.sheets.length === 0) await expect(page.getByText('No sheets are published yet')).toBeVisible();
    else await expect(page.locator('.cs-card:not(.is-planned)')).toHaveCount(cheats.sheets.length);
    expect(errors).toEqual([]);
  });

  test('the filter narrows items and rows live, and the print view drops the chrome', async ({ page }) => {
    test.skip(cheats.sheets.length === 0, 'no cheat sheets in the data yet');
    const errors = watchErrors(page);
    const sheet = cheats.sheets.find((s) => s.groups.some((g) => g.items.length)) ?? cheats.sheets[0]!;
    await page.goto(`cheat-sheets/${sheet.id}/`);
    const total = sheet.groups.reduce((n, g) => n + g.items.length + (g.table?.rows.length ?? 0), 0);
    const count = page.locator('#cs-count');
    await expect(count).toHaveText(`${total} items`);
    // every item and row links back to a lesson section or is labelled "From docs"
    for (const el of await page.locator('.cs-item').all()) await expect(el.locator('a.cs-src, .cs-docs')).not.toHaveCount(0);
    for (const el of await page.locator('.cs-table tbody tr').all()) await expect(el.locator('td.cs-src-col a')).toHaveCount(1);

    const term = await page.locator('.cs-item .cs-term').first().innerText();
    const word = term.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)[0] ?? term.toLowerCase();
    const input = page.getByRole('searchbox', { name: 'Filter this sheet' });
    await input.fill(word);
    await expect(count).toHaveText(new RegExp(`^\\d+ of ${total} items$`));
    const shown = Number((await count.innerText()).split(' ')[0]);
    expect(shown).toBeGreaterThan(0);
    expect(await page.locator('[data-filter]:visible').count()).toBe(shown);
    await input.fill('zzqqxx-no-such-thing');
    await expect(count).toHaveText(`0 of ${total} items`);
    await expect(page.locator('#cs-empty')).toBeVisible();
    await input.press('Escape');
    await expect(count).toHaveText(`${total} items`);

    await input.fill(word); // printing still shows everything
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    await expect(page.locator('.cs-tools')).toBeHidden();
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.site-footer')).toBeHidden();
    expect(await page.locator('.cs-item, .cs-table tbody tr').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display === 'none').length)).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
    const pdf = await page.pdf({ format: 'A4' });
    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(errors).toEqual([]);
  });
});

test.describe('interview prep', () => {
  const total = interview.questions.length;

  test('overview and browse show counts, or an empty state', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('interview-prep/');
    await expect(page.locator('.iq-topic')).toHaveCount(interview.topics.length);
    if (total === 0) await expect(page.getByText('The question bank is being written')).toBeVisible();
    await page.goto('interview-prep/browse/');
    if (total === 0) await expect(page.getByText('No interview questions are published yet')).toBeVisible();
    else await expect(page.locator('.iq-card')).toHaveCount(total);
    expect(errors).toEqual([]);
  });

  test('browse filters by difficulty, origin and topic, searches, and loads a full answer', async ({ page }) => {
    test.skip(total === 0, 'no interview questions in the data yet');
    const errors = watchErrors(page);
    await page.goto('interview-prep/browse/');
    const count = page.locator('[data-iq-count]');
    const visible = () => page.locator('.iq-card:visible');
    const q0 = interview.questions[0]!;
    await page.locator('select[name="difficulty"]').selectOption(q0.difficulty);
    const want = interview.questions.filter((q) => q.difficulty === q0.difficulty).length;
    await expect(count).toHaveText(`Showing ${want} of ${total} question${total === 1 ? '' : 's'}`);
    await expect(visible()).toHaveCount(want);
    expect(page.url()).toContain(`difficulty=${q0.difficulty}`);
    await page.locator('select[name="topic"]').selectOption(q0.topic);
    await expect(visible()).toHaveCount(interview.questions.filter((q) => q.difficulty === q0.difficulty && q.topic === q0.topic).length);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(count).toHaveText(`${total} question${total === 1 ? '' : 's'}`);
    await page.locator('select[name="origin"]').selectOption('notes');
    await expect(visible()).toHaveCount(interview.questions.filter((q) => q.origin === 'notes').length);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();

    // search: a distinctive word from the first question
    const word = q0.question.toLowerCase().split(/[^a-z0-9]+/).sort((a, b) => b.length - a.length)[0]!;
    await page.getByRole('searchbox', { name: 'Search questions and answers' }).fill(word);
    await expect(page.locator(`.iq-card[data-qid="${q0.id}"]`)).toBeVisible();
    await expect(count).toContainText(`of ${total}`);

    // the full answer is fetched from the topic page into the card
    const card = page.locator(`.iq-card[data-qid="${q0.id}"]`);
    await card.locator('summary').click();
    await expect(card.locator('.iq-meta')).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('every question has a stable anchor on its topic page', async ({ page }) => {
    test.skip(total === 0, 'no interview questions in the data yet');
    const q = interview.questions[interview.questions.length - 1]!;
    await page.goto(`interview-prep/topics/${q.topic}/#${q.id}`);
    await expect(page.locator(`#${q.id}`)).toBeVisible();
    await expect(page.locator(`#${q.id} details.iq-more`)).toHaveAttribute('open', '');
    const ids = await page.locator('.iq-card').evaluateAll((els) => els.map((e) => e.id));
    expect(ids.sort()).toEqual(interview.questions.filter((x) => x.topic === q.topic).map((x) => x.id).sort());
  });

  test('flashcards: piles persist and a session resumes', async ({ page }) => {
    test.skip(total < 2, 'needs at least two interview questions');
    const errors = watchErrors(page);
    await page.goto('interview-prep/flashcards/');
    await expect(page.locator('[data-fc-setup-count]')).toContainText('selected');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.locator('[data-fc-pos]')).toHaveText(`Card 1 of ${total}`);
    await page.getByRole('button', { name: 'Show short answer' }).click();
    await expect(page.locator('[data-fc-short]')).toBeVisible();
    await page.getByRole('button', { name: 'Show full answer' }).click();
    await expect(page.locator('[data-fc-full] .iq-meta')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Know it' }).click();
    await expect(page.locator('[data-fc-pos]')).toHaveText(`Card 2 of ${total}`);
    await page.keyboard.press('r'); // "Review again" by keyboard
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ly-flashcards-v1') ?? '{}'));
    expect(Object.values(stored.piles).sort()).toEqual(['know', 'review']);

    await page.reload();
    await expect(page.locator('[data-fc-setup] [data-pile="know"]')).toHaveText('1');
    await expect(page.locator('[data-fc-setup] [data-pile="review"]')).toHaveText('1');
    if (total > 2) {
      await expect(page.locator('[data-fc-resume]')).toBeVisible();
      await page.getByRole('button', { name: 'Resume' }).click();
      await expect(page.locator('[data-fc-pos]')).toHaveText(`Card 3 of ${total}`);
      await page.getByRole('button', { name: 'End', exact: true }).click();
      await expect(page.locator('[data-fc-done]')).toBeVisible();
      await page.getByRole('button', { name: 'New session' }).click();
    }
    // reset needs a second press
    await page.getByRole('button', { name: 'Reset piles' }).click();
    await page.getByRole('button', { name: 'Select again to clear both piles' }).click();
    await expect(page.locator('[data-fc-setup] [data-pile="know"]')).toHaveText('0');
    expect(errors).toEqual([]);
  });

  test('a full mock interview runs to the summary and is kept in the history', async ({ page }) => {
    test.skip(total === 0, 'no interview questions in the data yet');
    const errors = watchErrors(page);
    await page.goto('interview-prep/mock/');
    await expect(page.locator('[data-mk-setup-count]')).not.toHaveText('Loading the questions…');
    await page.locator('select[name="mk-count"]').selectOption('3');
    await page.locator('select[name="mk-time"]').selectOption('5');
    await page.getByRole('button', { name: 'Start the interview' }).click();
    const n = Math.min(3, total);
    await expect(page.locator('[data-mk-timer]')).toContainText('left');
    const ratings = ['Got it', 'Missed it', 'Partly'];
    for (let i = 0; i < n; i++) {
      await expect(page.locator('[data-mk-pos]')).toHaveText(`Question ${i + 1} of ${n}`);
      await page.getByLabel(/Your answer/).fill(`My answer ${i + 1}`);
      await page.getByRole('button', { name: 'Reveal the model answer' }).click();
      await expect(page.locator('[data-mk-short]')).not.toBeEmpty();
      await page.getByLabel(ratings[i]!, { exact: true }).check();
      await page.getByRole('button', { name: i === n - 1 ? 'Finish the interview' : 'Next question' }).click();
    }
    const summary = page.locator('[data-mk-summary]');
    await expect(summary).toBeVisible();
    await expect(page.locator('[data-mk-score]')).toContainText('Score');
    await expect(page.locator('[data-mk-results] li')).toHaveCount(n);
    if (n > 1) await expect(summary.getByRole('heading', { name: 'What to revise' })).toBeVisible();
    await expect(summary.getByText('My answer 1')).toBeAttached();
    const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('ly-mock-v1') ?? '{}'));
    expect(hist.history).toHaveLength(1);
    expect(hist.history[0]).toMatchObject({ asked: n, rated: n });
    await page.getByRole('button', { name: 'Another interview' }).click();
    await expect(page.locator('[data-mk-history] li')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('the gallery shows the approved images and PDFs, credited, without download links', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('interview-prep/gallery/');
    const mine = assets.filter((a) => a.usedBy?.startsWith('interview-prep/') && a.src);
    await expect(page.locator('.gl-fig')).toHaveCount(mine.filter((a) => a.kind === 'image').length);
    await expect(page.locator('.gl-pdfs iframe')).toHaveCount(mine.filter((a) => a.kind === 'pdf').length);
    await expect(page.locator('a[download]')).toHaveCount(0);
    if (await page.locator('.gl-open').count()) {
      await page.locator('.gl-open').first().click();
      await expect(page.locator('#gl-dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#gl-dialog')).toBeHidden();
    }
    expect(errors).toEqual([]);
  });
});

test.describe('lesson pages link to their study material', () => {
  test('interview questions on this topic', async ({ page }) => {
    const slug = Object.keys(interview.byLesson).find((k) => lessonIndex[k]);
    test.skip(!slug, 'no lesson has interview questions yet');
    const errors = watchErrors(page);
    await page.goto(`${lessonIndex[slug!]!.path}/`);
    const card = page.locator('#ly-interview-questions');
    await expect(card).toBeVisible();
    await expect(card.locator('.lx-questions a')).toHaveCount(Math.min(6, interview.byLesson[slug!]!.length));
    await card.locator('.lx-questions a').first().click();
    await expect(page).toHaveURL(/interview-prep\/topics\/[^/]+\/#/);
    await expect(page.locator('.iq-card:target')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('related cheat sheets', async ({ page }) => {
    const slug = Object.keys(cheats.byLesson).find((k) => lessonIndex[k]);
    test.skip(!slug, 'no lesson is cited by a cheat sheet yet');
    const lesson = lessonIndex[slug!]!;
    await page.goto(`${lesson.path}/`);
    for (const id of cheats.byLesson[slug!]!) await expect(page.locator(`.lesson-extras a[href$="/cheat-sheets/${id}/"]`)).toHaveCount(1);
    await page.goto(`${lesson.course}/`);
    for (const id of cheats.byLesson[slug!]!) await expect(page.locator(`a[href$="/cheat-sheets/${id}/"]`).first()).toBeVisible();
  });
});
