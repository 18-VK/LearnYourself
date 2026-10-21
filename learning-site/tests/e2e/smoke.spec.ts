import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface SiteData {
  courses: { id: string; modules: { lessons: { id: string; viz: number }[] }[] }[];
}
const site = JSON.parse(fs.readFileSync('src/data/generated/site.json', 'utf8')) as SiteData;
const lessons = site.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons));
/** Visualizers that exist in the engine; any other placement shows the note's text plus a "planned" note. */
const BUILT = new Set(
  fs
    .readdirSync('src/viz', { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(`src/viz/${d.name}/registry.ts`))
    .flatMap((d) => [...fs.readFileSync(`src/viz/${d.name}/registry.ts`, 'utf8').matchAll(/^\s+(\w+): \(\) => import/gm)].map((m) => m[1]!)),
);

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('home page renders the catalogue', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.course-card')).toHaveCount(site.courses.length + 2);
  expect(errors).toEqual([]);
});

for (const c of site.courses) {
  test(`course page ${c.id}`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${c.id}/`);
    await expect(page.locator('h1')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const l of lessons) {
  test(`lesson ${l.id}`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${l.id}/`);
    await expect(page.locator('#lesson-body')).toBeVisible();
    const slots = page.locator('.viz-slot[data-viz]');
    const count = await slots.count();
    expect(count).toBe(l.viz);
    for (let i = 0; i < count; i++) {
      const slot = slots.nth(i);
      await slot.scrollIntoViewIfNeeded();
      const name = (await slot.getAttribute('data-viz')) ?? '';
      const want = BUILT.has(name) ? 'mounted' : 'unavailable';
      await expect(slot, `${name} placement ${i + 1}`).toHaveAttribute('data-state', want, { timeout: 15_000 });
      if (want === 'mounted') await expect(slot.locator('.viz').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test('the sorting visualizer steps with the keyboard and stays truthful under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('dsa/sorting/stability-and-simple-sorts/');
  const viz = page.locator('.viz-slot[data-viz="SortVisualizer"]').first();
  await viz.scrollIntoViewIfNeeded();
  await expect(viz).toHaveAttribute('data-state', 'mounted');
  const step = viz.locator('.stepno');
  await expect(step).toHaveText(/Step 1 \//);
  await viz.locator('.viz').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowRight');
  await expect(step).toHaveText(/Step 2 \//);
  await page.keyboard.press('ArrowLeft');
  await expect(step).toHaveText(/Step 1 \//);
  const narration = viz.locator('.narr');
  const before = await narration.textContent();
  await page.keyboard.press('ArrowRight');
  await expect(narration).not.toHaveText(before ?? '');
  await expect(viz.locator('.viz-code li.is-current')).toHaveCount(1);
});

test('predict mode pauses for an answer before revealing the outcome', async ({ page }) => {
  await page.goto('dsa/sorting/stability-and-simple-sorts/');
  const viz = page.locator('.viz-slot[data-viz="SortVisualizer"]').first();
  await viz.scrollIntoViewIfNeeded();
  await expect(viz).toHaveAttribute('data-state', 'mounted');
  await viz.getByLabel('Predict mode').check();
  for (let k = 0; k < 6 && (await viz.locator('.predict').count()) === 0; k++) await viz.getByRole('button', { name: 'Step forward' }).click();
  await expect(viz.locator('.predict')).toBeVisible();
  await expect(viz.locator('.narr')).toHaveText(/Make a prediction/);
  await viz.locator('.predict .opts button').first().click();
  await expect(viz.locator('.narr')).not.toHaveText(/Make a prediction/);
});

test('search finds lessons', async ({ page }) => {
  await page.goto('');
  await page.keyboard.press('/');
  await page.locator('#search-input').fill('insertion sort');
  await expect(page.locator('#search-results a').first()).toBeVisible({ timeout: 15_000 });
});

test('unknown pages show the custom 404', async ({ page }) => {
  await page.goto('this/page/does/not/exist/');
  await expect(page.getByRole('heading', { name: "This page doesn't exist" })).toBeVisible();
});
