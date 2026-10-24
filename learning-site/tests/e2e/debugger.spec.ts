/**
 * The tracing debugger, on the production build: debug a note's sorting code through its harness (steps, call stack,
 * the array view, a breakpoint, Step back, Stop), and prove that `while (true)` under Debug is stopped by the step cap
 * while the page stays responsive. Uses the same worker as Run (tests/e2e/runner.spec.ts).
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { RunnableData } from '../../src/lib/runnable';

const FILE = 'src/data/generated/runnable.json';
const data: RunnableData | null = fs.existsSync(FILE) ? (JSON.parse(fs.readFileSync(FILE, 'utf8')) as RunnableData) : null;
const available = Boolean(data?.available && data.runner && fs.existsSync('dist/runner/runner-worker.js'));
const entries = Object.entries(data?.lessons ?? {}).flatMap(([lesson, blocks]) => blocks.map((b) => ({ lesson, ...b })));

test.skip(!available, 'No runner in this build (no .NET SDK); the build skipped the C# runner.');
test.describe.configure({ timeout: 240_000 });

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const frameOf = (page: Page, id: string) => page.locator(`figure.code-frame[data-run-id="${id}"]`);
const panelOf = (page: Page, id: string) => page.locator(`.runner[data-run-id="${id}"]`);

/** A note's sort method run through its harness (an array to draw, a call to step into, a loop to break in). */
const sorting = entries.find((e) => e.harness && !e.merged && !e.noDebug && e.lesson.startsWith('dsa/sorting/') && /for\s*\(/.test(e.harness ? '' : 'for (')) ?? entries.find((e) => e.harness && !e.noDebug);
const plain = entries.find((e) => !e.harness && !e.merged && !e.noDebug && e.lesson.startsWith('phase-1/')) ?? entries.find((e) => !e.harness && !e.merged && !e.noDebug);

async function startDebugging(page: Page, id: string) {
  const frame = frameOf(page, id);
  await frame.scrollIntoViewIfNeeded();
  await frame.getByRole('button', { name: /^Debug / }).click();
  const dbg = panelOf(page, id).locator('.dbg');
  await expect(dbg.locator('.dbg-toolbar')).toBeVisible({ timeout: 180_000 });
  return dbg;
}

const stepNo = async (page: Page, id: string) => Number(((await panelOf(page, id).locator('.dbg-stepno').textContent()) ?? '').match(/Step ([\d,]+)/)![1]!.replace(/,/g, ''));

test('debugging a sorting method through its harness: steps, call stack, arrays, a breakpoint, Step back, Stop', async ({ page }) => {
  test.skip(!sorting, 'no runnable block with a harness');
  const errors = watchErrors(page);
  await page.goto(`${sorting!.lesson}/`);
  await expect(page.locator('body')).toHaveAttribute('data-runner-ready', 'true');
  const id = sorting!.id;
  const frame = frameOf(page, id);
  const dbg = await startDebugging(page, id);

  // it starts on the harness's first line, shown in the harness panel (added code, not the note's)
  await expect(dbg.locator('.dbg-status')).toContainText('harness line 1');
  await expect(dbg.locator('.dbg-harness')).toContainText('Harness: added code');
  await expect(dbg.locator('.dbg-stack li')).toHaveCount(1);

  // Step into until the note's method is called: a second frame, with the array argument drawn as cells
  const into = dbg.getByRole('button', { name: 'Step into' });
  for (let i = 0; i < 20 && !(await dbg.locator('.dbg-status').textContent())?.startsWith('Called'); i++) await into.click();
  await expect(dbg.locator('.dbg-status')).toContainText('Called');
  await expect(dbg.locator('.dbg-stack li')).toHaveCount(2);
  await expect(dbg.locator('.dbg-cells').first()).toBeVisible();
  expect(await dbg.locator('.dbg-cells').first().locator('.dbg-cell').count()).toBeGreaterThan(1);

  // one more step lands on a line of the note's code, highlighted in the code block itself
  await into.click();
  await expect(frame.locator('pre .line.dbg-current')).toHaveCount(1);

  // a breakpoint on the first loop line of the note's code: Continue stops there
  const code = sorting!.code ?? (await frame.locator('pre').innerText());
  const loopLine = code.split('\n').findIndex((l) => /\b(for|while)\s*\(/.test(l)) + 1;
  if (loopLine > 0) {
    await frame.locator(`.dbg-bp[data-line="${loopLine}"]`).click();
    await expect(frame.locator(`.dbg-bp[data-line="${loopLine}"]`)).toHaveAttribute('aria-pressed', 'true');
    const before = await stepNo(page, id);
    await dbg.getByRole('button', { name: 'Continue to the next breakpoint' }).click();
    await expect.poll(() => stepNo(page, id)).toBeGreaterThan(before);
    await expect(frame.locator('pre .line').nth(loopLine - 1)).toHaveClass(/dbg-current/);
    await expect(dbg.locator('.dbg-vars')).toBeVisible();
  }

  // Step back goes back exactly one step, without re-running anything
  const at = await stepNo(page, id);
  await dbg.getByRole('button', { name: 'Step back' }).click();
  await expect.poll(() => stepNo(page, id)).toBe(at - 1);

  // the timeline's end is the program's end, with the whole output in the console
  const scrub = dbg.locator('.dbg-scrub');
  await scrub.focus();
  await page.keyboard.press('End');
  await expect(dbg.locator('.dbg-status')).toContainText('The program finished');
  if (sorting!.expected?.stdout) await expect(dbg.locator('.dbg-console')).toHaveText(sorting!.expected.stdout.replace(/\n$/, ''), { useInnerText: true });

  // Stop removes the panel, the gutter and the highlight
  await dbg.getByRole('button', { name: 'Stop debugging' }).click();
  await expect(panelOf(page, id).locator('.dbg')).toHaveCount(0);
  await expect(frame.locator('.dbg-bp')).toHaveCount(0);
  await expect(frame.locator('pre .line.dbg-current')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('while (true) under Debug is stopped by the step cap and the page stays responsive', async ({ page }) => {
  test.skip(!plain, 'no plain runnable block');
  const errors = watchErrors(page);
  await page.goto(`${plain!.lesson}/`);
  await expect(page.locator('body')).toHaveAttribute('data-runner-ready', 'true');
  const id = plain!.id;
  const frame = frameOf(page, id);
  await frame.scrollIntoViewIfNeeded();
  await frame.getByRole('button', { name: /^Edit / }).click();
  const content = frame.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('int n = 0;\nwhile (true)\n{\n    n++;\n}');

  const dbg = await startDebugging(page, id);
  // the page painted and handled input the whole time
  const ticks = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const start = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve(n);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(ticks).toBeGreaterThan(20);
  // the cap counts recorded events (10,000), and the entry frame's first event shows no step of its own
  await expect(dbg.locator('.dbg-stepno')).toContainText(/\/ (9,99\d|10,000)$/);
  await dbg.locator('.dbg-scrub').focus();
  await page.keyboard.press('End');
  await expect(dbg.locator('.dbg-note')).toContainText('Recording stopped after 10,000 steps');
  // the variable changes on every pass: the last steps show a large n
  await expect(dbg.locator('.dbg-vars')).toContainText('n');

  // editing the code marks the trace as stale
  await content.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('\n// edited');
  await expect(dbg.locator('.dbg-stale')).toContainText('The code changed');
  expect(errors).toEqual([]);
});
