import { expect, test, type Page } from '@playwright/test';

/** Interaction checks for the searching, graph search, Big-O and collections visualizers. */

async function mounted(page: Page, url: string, name: string, nth = 0) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  const slot = page.locator(`.viz-slot[data-viz="${name}"]`).nth(nth);
  await slot.scrollIntoViewIfNeeded();
  await expect(slot).toHaveAttribute('data-state', 'mounted', { timeout: 15_000 });
  return { slot, errors };
}

test('binary search asks which half is kept, and steps with the keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { slot, errors } = await mounted(page, 'dsa/searching/linear-and-binary-search/', 'SearchVisualizer', 1);
  await expect(slot.getByLabel('Predict mode')).toBeChecked();
  await slot.locator('.viz').click({ position: { x: 5, y: 5 } });
  for (let k = 0; k < 8 && (await slot.locator('.predict').count()) === 0; k++) await page.keyboard.press('ArrowRight');
  await expect(slot.locator('.predict .q')).toContainText('Which half');
  await expect(slot.locator('.narr')).toHaveText(/Make a prediction/);
  await slot.locator('.predict .opts button').first().click();
  await expect(slot.locator('.narr')).not.toHaveText(/Make a prediction/);
  await slot.getByRole('button', { name: 'Recursive' }).click();
  await expect(slot.locator('.viz-title')).toHaveText('Binary search (recursive)');
  expect(errors).toEqual([]);
});

test('unsorted input is sorted for binary search, and the learner is told', async ({ page }) => {
  const { slot } = await mounted(page, 'dsa/searching/linear-and-binary-search/', 'SearchVisualizer', 1);
  const values = slot.getByLabel('Sorted values');
  await values.fill('9, 3, 7, 1');
  await values.press('Enter');
  await expect(values).toHaveValue('1, 3, 7, 9');
  await expect(slot.locator('.sv-notice')).toContainText('needs sorted input');
});

test("the bounds placement uses the note's example and ends with its counts", async ({ page }) => {
  const { slot } = await mounted(page, 'dsa/searching/linear-and-binary-search/', 'SearchVisualizer', 2);
  await expect(slot.getByLabel('Sorted values')).toHaveValue('1, 2, 2, 2, 3');
  await slot.getByLabel('Timeline').focus();
  await page.keyboard.press('End');
  await expect(slot.locator('.viz-verdict')).toHaveText('LowerBound = 1, UpperBound = 4');
});

test('BFS: picking a new target restarts the trace', async ({ page }) => {
  const { slot, errors } = await mounted(page, 'dsa/searching/hash-bfs-dfs/', 'GraphSearchVisualizer', 0);
  await slot.getByRole('button', { name: 'Set target' }).click();
  await slot.getByRole('button', { name: 'Node 3', exact: true }).click();
  await expect(slot.locator('.sv-facts')).toContainText('target 3');
  await expect(slot.locator('.stepno')).toHaveText(/^Step 1 \//);
  await slot.getByRole('button', { name: 'Grid (as a graph)' }).click();
  await expect(slot.locator('.gs-grid')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Big-O growth updates the table when n changes', async ({ page }) => {
  const { slot } = await mounted(page, 'dsa/roadmap/dsa-roadmap/', 'BigOGrowthVisualizer');
  await slot.getByRole('button', { name: 'n = 100', exact: true }).click();
  await expect(slot.locator('.bo-table tbody tr').nth(4)).toContainText('10,000');
  await slot.getByLabel('Log scale (y)').check();
  await expect(slot.locator('.bo-line')).toHaveCount(6);
});

test('List<T> Add shows the cost from the notes', async ({ page }) => {
  const { slot, errors } = await mounted(page, 'dsa/csharp-toolbox/collections-cheatsheet/', 'CollectionVisualizer', 0);
  await slot.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(slot.locator('.cv-cost')).toContainText('O(1) amortized');
  await expect(slot.locator('.viz-keys')).toContainText('Capacity 4');
  expect(errors).toEqual([]);
});
