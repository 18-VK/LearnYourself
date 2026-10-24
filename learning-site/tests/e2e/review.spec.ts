/**
 * Pre-test, spaced review and mastery signals, on the production build: wrong guesses in "Before you read" show up
 * on the home page's review card and on the review page, answering them there reschedules them, and a low quiz
 * score marks the lesson as a weak spot on the progress page.
 */
import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const read = <T>(f: string): T => JSON.parse(fs.readFileSync(`src/data/generated/${f}`, 'utf8')) as T;
interface QuizQ {
  id: string;
  type: 'mcq' | 'predict-output' | 'order-steps';
  answer?: number;
  options?: string[];
}
const quizzes = read<Record<string, QuizQ[]>>('quizzes.json');
const lessonIndex = read<Record<string, { path: string; title: string; course: string }>>('lesson-index.json');
const slug = Object.keys(quizzes).find((k) => lessonIndex[k] && quizzes[k]!.some((q) => q.type === 'mcq'));
/** The pre-test asks the lesson's first two multiple-choice questions. */
const mcqs = slug ? quizzes[slug]!.filter((q) => q.type === 'mcq').slice(0, 2) : [];

test.skip(!slug || !mcqs.length, 'no multiple-choice quiz question in the data');

test('wrong pre-test guesses come back in the review queue; a weak quiz shows on the progress page', async ({ page }) => {
  const lesson = lessonIndex[slug!]!;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // the pre-test sits before the lesson body and asks the quiz's first multiple-choice questions
  await page.goto(`${lesson.path}/`);
  const pre = page.locator('#ly-pretest');
  await expect(pre).toBeVisible();
  expect(await page.evaluate(() => Boolean(document.querySelector('#ly-pretest')!.compareDocumentPosition(document.querySelector('#lesson-body')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(pre.locator('.pretest-q')).toHaveCount(mcqs.length);
  for (const q of mcqs) {
    const wrong = (q.answer! + 1) % q.options!.length;
    await pre.locator(`.pretest-q[data-qid="${q.id}"] .quiz-opt input`).nth(wrong).check();
  }
  await pre.getByRole('button', { name: 'Check my guesses' }).click();
  const first = pre.locator(`.pretest-q[data-qid="${mcqs[0]!.id}"]`);
  await expect(first.locator('.pretest-fb')).toContainText('Not yet');
  await expect(first.locator('.quiz-opt.is-right')).toHaveCount(1);
  await expect(pre).toHaveAttribute('data-done', '0');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ly-progress-v1') ?? '{}'));
  for (const q of mcqs) expect(saved.review[`${lesson.path}#${q.id}`]).toMatchObject({ interval: 1, lapses: 1 });

  // they are due tomorrow: make them due now, then the home card and the review page show them
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('ly-progress-v1')!);
    for (const k of Object.keys(p.review)) p.review[k].due = Date.now() - 1000;
    localStorage.setItem('ly-progress-v1', JSON.stringify(p));
  });
  await page.goto('');
  await expect(page.locator('#review-card')).toBeVisible();
  await expect(page.locator('#review-card [data-review-count]')).toHaveText(String(mcqs.length));
  await page.locator('#review-card').getByRole('link', { name: 'Review now' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-review-ready', 'true');
  await expect(page.locator('[data-review-status]')).toContainText(`${mcqs.length} of ${mcqs.length} left`);
  for (const q of mcqs) {
    const item = page.locator(`.review-q[data-qid="${q.id}"]`);
    await expect(item).toBeVisible();
    await expect(item.locator('.review-lesson')).toContainText(lesson.title);
    await item.locator('.quiz-opt input').nth(q.answer!).check();
    await expect(item).toHaveClass(/is-correct/);
    await expect(item.locator('.quiz-verdict')).toContainText('Back in 3 days');
  }
  await expect(page.locator('[data-review-status]')).toContainText('Done for today');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ly-progress-v1') ?? '{}'));
  for (const q of mcqs) expect(after.review[`${lesson.path}#${q.id}`]).toMatchObject({ interval: 3, right: 1 });
  await page.goto('');
  await expect(page.locator('#review-card')).toBeHidden();

  // a quiz checked with nothing answered scores 0: a weak spot on the progress page
  await page.goto(`${lesson.path}/`);
  const quiz = page.locator('#ly-quiz');
  await quiz.scrollIntoViewIfNeeded();
  await expect(quiz).toHaveAttribute('data-ready', 'true');
  await quiz.getByRole('button', { name: 'Check answers' }).click();
  await expect(quiz.locator('[data-quiz-result]')).toContainText('You got 0 of');
  await page.goto('progress/');
  const row = page.locator(`[data-quiz-summary] [data-lesson-id="${lesson.path}"]`);
  await expect(row).toBeVisible();
  await expect(row).toHaveClass(/is-weak/);
  await expect(page.locator(`[data-course="${lesson.course}"] [data-quiz-summary-text]`)).toContainText('weak spots: 1');
  expect(errors).toEqual([]);
});
