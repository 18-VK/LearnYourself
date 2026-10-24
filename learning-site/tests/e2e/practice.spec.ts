/**
 * Practice mode ("Try it yourself"), on the production build: the starter code fails the tests, the note's solution
 * passes them, and the page says which is which. Runs through the C# runner (the same worker as Run).
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { PracticeData } from '../../src/lib/practice';

const FILE = 'src/data/generated/practice.json';
const data: PracticeData | null = fs.existsSync(FILE) ? (JSON.parse(fs.readFileSync(FILE, 'utf8')) as PracticeData) : null;
const runnerBuilt = fs.existsSync('dist/runner/runner-worker.js');
const lessons = Object.entries(data?.lessons ?? {});

test.skip(!data?.verified || !runnerBuilt || lessons.length === 0, 'No verified practice exercises in this build (needs the .NET SDK).');
test.describe.configure({ timeout: 240_000 });

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('the starter code fails, the note’s solution passes', async ({ page }) => {
  const errors = watchErrors(page);
  const [lesson, exercises] = lessons.find(([id]) => id.endsWith('stability-and-simple-sorts')) ?? lessons[0]!;
  const ex = exercises[0]!;
  await page.goto(`${lesson}/`);
  await expect(page.locator('body')).toHaveAttribute('data-practice-ready', 'true');
  const article = page.locator(`#practice-${ex.id}`);
  await article.scrollIntoViewIfNeeded();
  await expect(article.locator('tbody tr')).toHaveCount(ex.cases.length);
  await expect(article.locator('.practice-tag-note')).toHaveCount(ex.cases.filter((c) => c.reviewed).length);

  await article.getByRole('button', { name: 'Start: open the editor' }).click();
  await expect(article.locator('.cm-content')).toBeVisible();
  await expect(article.locator('.cm-content')).toContainText('TODO');
  await article.getByRole('button', { name: 'Run tests' }).click();
  await expect(article).toHaveAttribute('data-passed', 'false', { timeout: 180_000 });
  await expect(article.locator('.practice-result.is-fail').first()).toBeVisible();
  await expect(article.locator('.runner-status')).toContainText(/of \d+ tests pass/);
  // a failed case says what it tests, and the hint ladder reveals the note's solution a line at a time
  await expect(article.locator('.practice-result.is-fail .practice-hint').first()).toContainText('Tests:');
  await article.getByRole('button', { name: 'Hint' }).click();
  await expect(article.locator('.practice-hint-code')).toContainText(ex.signature.split('(')[0]!.split(' ').pop()!);
  await expect(article).toHaveAttribute('data-hints', '1');
  await article.getByRole('button', { name: 'Next hint' }).click();
  await expect(article).toHaveAttribute('data-hints', '2');

  await article.getByRole('button', { name: 'Show solution' }).click();
  await expect(article.locator('.practice-solution')).toBeVisible();
  await article.getByRole('button', { name: 'Put it in the editor' }).click();
  await article.getByRole('button', { name: 'Run tests' }).click();
  await expect(article).toHaveAttribute('data-passed', 'true', { timeout: 180_000 });
  await expect(article.locator('.practice-result.is-pass')).toHaveCount(ex.cases.length);
  await expect(article.locator('.runner-status')).toContainText('All');

  // a wrong signature is explained
  await article.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('void Nothing() { }');
  await article.getByRole('button', { name: 'Run tests' }).click();
  await expect(article.locator('.runner-problems')).toContainText('keep that name and those parameters', { timeout: 60_000 });
  expect(errors).toEqual([]);
});
