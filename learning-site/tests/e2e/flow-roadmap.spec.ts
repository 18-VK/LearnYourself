import { expect, test, type Page } from '@playwright/test';

/** Behaviour of FlowDiagram, the roadmap graphs, the persistent checklists and the WPF visualizers. */

const mounted = async (page: Page, name: string, nth = 0) => {
  const slot = page.locator(`.viz-slot[data-viz="${name}"]`).nth(nth);
  await slot.scrollIntoViewIfNeeded();
  await expect(slot).toHaveAttribute('data-state', 'mounted', { timeout: 15_000 });
  return slot;
};

test('flow diagram: text version toggle, keyboard steps, click-to-step, reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('phase-2/foundations/aspnet-core-overview/');
  const slot = await mounted(page, 'FlowDiagram');
  const text = slot.locator('.viz-text');
  await expect(text).toBeHidden();
  await slot.getByRole('button', { name: 'Show text version' }).click();
  await expect(text).toBeVisible();
  await expect(text).toContainText('Kestrel Web Server');
  await slot.getByRole('button', { name: 'Hide text version' }).click();
  await expect(text).toBeHidden();

  const narr = slot.locator('.narr');
  await expect(narr).toHaveText('A client sends an HTTP request.');
  await slot.locator('.viz').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowRight');
  await expect(narr).toContainText('it is first received by the Kestrel web server');
  await expect(slot.locator('.flow-node.is-active')).toHaveCount(1);
  await expect(slot.locator('.flow-node.is-visited')).toHaveCount(1);
  await expect(slot.locator('.flow-edge.is-active')).toHaveCount(1);
  // reduced motion: the token never travels
  await expect(slot.locator('.flow-token')).toHaveCSS('opacity', '0');
  await page.keyboard.press('ArrowLeft');
  await expect(slot.locator('.stepno')).toHaveText(/Step 1 \//);
  // a box jumps to its step
  await slot.getByRole('button', { name: 'Show the step for: Database' }).click();
  await expect(slot.locator('.stepno')).toHaveText(/Step 8 \//);
});

test('flow diagram: the token travels along the edge with motion allowed', async ({ page }) => {
  await page.goto('sql-server/setup-and-security/server-database-schema/');
  const slot = await mounted(page, 'FlowDiagram');
  await slot.getByRole('button', { name: 'Step forward' }).click();
  await expect(slot.locator('.flow-token')).toHaveCSS('opacity', '1');
  await expect(slot.locator('.flow-token')).toHaveCSS('opacity', '0', { timeout: 3000 });
  await expect(slot.locator('.narr')).toContainText('Logins (Server-level security)');
});

const ROADMAPS = [
  'backend-roadmap/roadmaps/beginner-to-job-ready',
  'backend-roadmap/roadmaps/request-to-response',
  'backend-roadmap/roadmaps/database-design-roadmap',
  'dsa/roadmap/dsa-roadmap',
  'math/level-1/foundations',
  'math/level-2/core-programming-math',
  'math/level-3/intermediate',
  'math/level-4/upper-intermediate',
  'math/level-5/advanced',
  'math/level-6/expert',
];

interface Item {
  key: string;
  row?: boolean;
}
interface Node {
  items: Item[];
  children: Node[];
}
const listKeys = (nodes: Node[]): string[] => nodes.flatMap((n) => [...n.items.filter((i) => !i.row).map((i) => i.key), ...listKeys(n.children)]);

for (const id of ROADMAPS) {
  test(`roadmap graph on ${id} uses the page checklist's keys`, async ({ page }) => {
    await page.goto(`${id}/`);
    const slot = await mounted(page, 'RoadmapGraph');
    const props = JSON.parse((await slot.getAttribute('data-props')) ?? '{}') as { lessonId: string; nodes: Node[] };
    expect(props.lessonId).toBe(id);
    const graph = listKeys(props.nodes);
    const onPage = await page.locator('#lesson-body input[data-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')));
    expect(new Set(onPage).size).toBe(onPage.length);
    for (const k of graph) expect(onPage).toContain(k);
  });
}

test('roadmap graph and page checklist stay in sync, and ticks persist per item', async ({ page }) => {
  await page.goto('backend-roadmap/roadmaps/beginner-to-job-ready/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const slot = await mounted(page, 'RoadmapGraph');
  const props = JSON.parse((await slot.getAttribute('data-props')) ?? '{}') as { nodes: (Node & { title: string })[] };
  const stage0 = props.nodes[0]!;
  expect(stage0.title).toBe('Stage 0 — Programming Foundations');
  const [k1, k2] = stage0.items.map((i) => i.key);
  const card = slot.locator('[data-node="h1"]');

  // graph → page
  await card.getByRole('button', { name: /Stage 0/ }).click();
  await card.locator('.rm-items input').first().check();
  await expect(page.locator(`#lesson-body input[data-key="${k1}"]`)).toBeChecked();
  // page → graph
  await page.locator(`#lesson-body input[data-key="${k2}"]`).check();
  await expect(card.locator('.rm-count').first()).toHaveText('2/5');
  await expect(card.locator('.rm-items input').nth(1)).toBeChecked();
  await expect(page.locator('#lesson-body > p.muted').first()).toContainText('2 of');

  // only those two survive a reload (each item has its own key)
  await page.reload();
  await expect(page.locator('#lesson-body input[data-key]:checked')).toHaveCount(2);
  const again = await mounted(page, 'RoadmapGraph');
  await expect(again.locator('[data-node="h1"] .rm-count').first()).toHaveText('2/5');

  // ticking a stop ticks everything in it, on the page too
  await again.getByLabel(/Mark everything in "Stage 1 —/).check();
  await expect(page.locator('#lesson-body input[data-key]:checked')).toHaveCount(7);
  // planned modules show as "coming soon"; lessons are links
  const stage7 = again.locator('.rm-stop', { hasText: 'Stage 7 — Testing' });
  await expect(stage7.locator('.rm-soon-badge')).toBeVisible();
  await expect(again.locator('a.rm-link').first()).toHaveAttribute('href', /\/LearnYourself\/.+\/$/);
});

test('the production checklist keeps each tick separately', async ({ page }) => {
  await page.goto('backend-roadmap/roadmaps/production-grade-web-api-checklist/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const boxes = page.locator('#lesson-body input[data-key]');
  const n = await boxes.count();
  expect(n).toBeGreaterThan(20);
  const keys = await boxes.evaluateAll((els) => els.map((e) => e.getAttribute('data-key')));
  expect(new Set(keys).size).toBe(n);
  await boxes.nth(2).check();
  await expect(page.locator('#lesson-body > p.muted').first()).toHaveText(`1 of ${n} items checked. Your ticks are saved in this browser.`);
  await page.reload();
  await expect(page.locator('#lesson-body input[data-key]:checked')).toHaveCount(1);
  await expect(page.locator('#lesson-body input[data-key]').nth(2)).toBeChecked();
});

test('WPF visualizers: OneTime keeps its value, debounce runs one search, CanExecute enables Delete', async ({ page }) => {
  await page.goto('desktop/mvvm/data-binding/');
  const db = await mounted(page, 'DataBindingVisualizer');
  // jump to the last step with the timeline slider (End key on a range input)
  const last = async (slot: typeof db) => {
    await slot.locator('input.scrub').focus();
    await page.keyboard.press('End');
  };
  await last(db);
  await expect(db.getByTestId('target-OneTime')).toHaveText('Aman');
  await expect(db.getByTestId('target-TwoWay')).toHaveText('Aman Kumar');

  await page.goto('desktop/real-app-architecture/debounce-search/');
  const deb = await mounted(page, 'DebounceTimelineVisualizer');
  await last(deb);
  await expect(deb.locator('.counters div').nth(2).locator('b')).toHaveText('1');
  await expect(deb.locator('.counters div').nth(3).locator('b')).toHaveText('4');

  await page.goto('desktop/mvvm/commands/');
  const cmd = await mounted(page, 'CommandCanExecuteVisualizer');
  await cmd.getByRole('button', { name: 'CommandManager.InvalidateRequerySuggested' }).click();
  await last(cmd);
  await expect(cmd.getByTestId('delete-button')).toHaveClass(/is-enabled/);
});
