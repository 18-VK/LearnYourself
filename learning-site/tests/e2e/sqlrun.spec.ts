/**
 * Runnable SQL, on the production build: a note's query runs in sql.js in the browser and returns the rows the build
 * recorded, blocks the build excluded carry their label, and an edited query that leaves the shared dialect gets a
 * heads-up.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { SqlRunData } from '../../src/lib/sqlrun';

const FILE = 'src/data/generated/sqlrun.json';
const data: SqlRunData | null = fs.existsSync(FILE) ? (JSON.parse(fs.readFileSync(FILE, 'utf8')) as SqlRunData) : null;
const lessons = Object.entries(data?.lessons ?? {});
const withRun = lessons.filter(([, l]) => l.blocks.length > 0);

test.skip(!data?.available || withRun.length === 0, 'No runnable SQL in this build.');
test.describe.configure({ timeout: 120_000 });

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const frameOf = (page: Page, id: string) => page.locator(`figure.code-frame[data-sql-run-id="${id}"]`);
const panelOf = (page: Page, id: string) => page.locator(`.sqlrun[data-sql-run-id="${id}"]`);

test('a query with sample data runs in the browser and matches the recorded result', async ({ page }) => {
  const errors = watchErrors(page);
  const [lesson, l] = withRun.find(([id]) => id.endsWith('/joins')) ?? withRun[0]!;
  const block = l.blocks.find((b) => b.setup && b.expected.some((s) => s.kind === 'rows' && (s.total ?? 0) > 1)) ?? l.blocks[0]!;
  await page.goto(`${lesson}/`);
  await expect(page.locator('body')).toHaveAttribute('data-sqlrun-ready', 'true');
  const frame = frameOf(page, block.id);
  await frame.scrollIntoViewIfNeeded();
  await frame.getByRole('button', { name: /^Run / }).click();
  const panel = panelOf(page, block.id);
  await expect(panel).toHaveAttribute('data-outcome', 'completed', { timeout: 90_000 });
  await expect(panel).toHaveAttribute('data-matches', 'true');
  const rows = block.expected.find((s) => s.kind === 'rows')!;
  const table = panel.locator('.sqlrun-output .sqlrun-table').first();
  await expect(table.locator('tbody tr')).toHaveCount(rows.rows!.length);
  await expect(table.locator('thead th').first()).toHaveText(rows.columns![0]!);
  // the sample data is shown as the note's own code
  if (block.setup) {
    await panel.getByRole('button', { name: 'Show setup' }).click();
    await expect(panel.locator('.sqlrun-setup')).toContainText('From the note');
  }
  expect(errors).toEqual([]);
});

test('blocks the build kept off the Run button are labelled', async ({ page }) => {
  const labelled = lessons.find(([, l]) => l.labels.some((x) => x.kind === 'tsql-only'));
  test.skip(!labelled, 'no T-SQL-only label in this build');
  await page.goto(`${labelled![0]}/`);
  await expect(page.locator('body')).toHaveAttribute('data-sqlrun-ready', 'true');
  const label = page.locator('.sqlrun-label-tsql-only').first();
  await expect(label).toContainText('T-SQL only');
  await expect(label.locator('..').locator('..')).toHaveAttribute('data-sql-label', 'tsql-only');
});

test('an edited query that leaves the shared dialect still runs, with a heads-up', async ({ page }) => {
  const errors = watchErrors(page);
  const [lesson, l] = withRun[0]!;
  const block = l.blocks.find((b) => b.setup) ?? l.blocks[0]!;
  await page.goto(`${lesson}/`);
  await expect(page.locator('body')).toHaveAttribute('data-sqlrun-ready', 'true');
  const frame = frameOf(page, block.id);
  await frame.scrollIntoViewIfNeeded();
  await frame.getByRole('button', { name: /^Edit / }).click();
  const content = frame.locator('.cm-content');
  await expect(content).toBeVisible();
  const setup = block.setup ? l.setups[block.setup]!.code : '';
  const table = /CREATE TABLE\s+("?[\w]+"?)/i.exec(setup)?.[1]?.replace(/"/g, '') ?? 'Customers';
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(`SELECT * FROM ${table} LIMIT 1`);
  await frame.getByRole('button', { name: /^Run / }).click();
  const panel = panelOf(page, block.id);
  await expect(panel).toHaveAttribute('data-outcome', 'completed', { timeout: 90_000 });
  await expect(panel.locator('.sqlrun-hint')).toBeVisible();
  await expect(panel.locator('.sqlrun-hint')).toContainText('SQL Server');
  await expect(panel).toHaveAttribute('data-matches', 'false');
  expect(errors).toEqual([]);
});
