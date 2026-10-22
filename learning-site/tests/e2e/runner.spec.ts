/**
 * C# runner, on the production build: runs a sample of runnable blocks in the browser and compares their output with
 * what the build-time check recorded (src/data/generated/runnable.json), and proves that a runaway loop is stopped
 * while the page stays responsive. Also covers edit, stdin, compile errors, runtime exceptions, the output cap and the
 * harness toggle.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { RunnableBlockData, RunnableData } from '../../src/lib/runnable';

const FILE = 'src/data/generated/runnable.json';
const data: RunnableData | null = fs.existsSync(FILE) ? (JSON.parse(fs.readFileSync(FILE, 'utf8')) as RunnableData) : null;
const available = Boolean(data?.available && data.runner && fs.existsSync('dist/runner/runner-worker.js'));
const entries = Object.entries(data?.lessons ?? {}).flatMap(([lesson, blocks]) => blocks.map((b) => ({ lesson, ...b })));

test.skip(!available, 'No runner in this build (no .NET SDK); the build skipped the C# runner.');
// one worker boot is shared by the runs in a test; the first download and compile take a while
test.describe.configure({ timeout: 240_000 });

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** A spread of programs with recorded output: DSA harnesses first, then one per course. */
function sample(): (RunnableBlockData & { lesson: string })[] {
  const withOutput = entries.filter((e) => e.expected && e.expected.outcome === 'completed' && !e.varies && !e.readsInput);
  const picked = new Map<string, (typeof withOutput)[number]>();
  for (const e of withOutput.filter((x) => x.harness && x.lesson.startsWith('dsa/')).slice(0, 3)) picked.set(e.id, e);
  for (const course of ['phase-1', 'dsa', 'math', 'phase-2', 'desktop', 'backend-roadmap']) {
    const e = withOutput.find((x) => x.lesson.startsWith(`${course}/`) && !picked.has(x.id));
    if (e) picked.set(e.id, e);
  }
  for (const e of withOutput) {
    if (picked.size >= 8) break;
    if (!picked.has(e.id) && ![...picked.values()].some((p) => p.lesson === e.lesson)) picked.set(e.id, e);
  }
  return [...picked.values()];
}

const panelOf = (page: Page, id: string) => page.locator(`.runner[data-run-id="${id}"]`);
const frameOf = (page: Page, id: string) => page.locator(`figure.code-frame[data-run-id="${id}"]`);

async function runBlock(page: Page, id: string) {
  const frame = frameOf(page, id);
  await frame.scrollIntoViewIfNeeded();
  await frame.getByRole('button', { name: /^Run / }).click();
  const panel = panelOf(page, id);
  await expect(panel).toHaveAttribute('data-outcome', /.+/, { timeout: 180_000 });
  return panel;
}

test('a sample of runnable blocks prints what the build recorded', async ({ page }) => {
  const errors = watchErrors(page);
  const picks = sample();
  expect(picks.length).toBeGreaterThan(0);
  for (const e of picks) {
    await page.goto(`${e.lesson}/`);
    await expect(page.locator('body')).toHaveAttribute('data-runner-ready', 'true');
    const panel = await runBlock(page, e.id);
    await expect(panel, e.id).toHaveAttribute('data-outcome', 'completed');
    const out = (await panel.locator('.runner-output').textContent()) ?? '';
    expect(out === '(no output)' ? '' : out, e.id).toBe(e.expected!.stdout);
    await expect(panel).toHaveAttribute('data-matches', 'true');
  }
  expect(errors).toEqual([]);
});

/** A lesson with a runnable block that has a harness (the DSA sorting notes). */
const harnessed = entries.find((e) => e.harness && e.lesson.startsWith('dsa/sorting/')) ?? entries.find((e) => e.harness);
const plain = entries.find((e) => !e.harness && !e.merged && e.lesson.startsWith('phase-1/')) ?? entries.find((e) => !e.harness && !e.merged);

async function editTo(page: Page, id: string, code: string) {
  const frame = frameOf(page, id);
  await frame.scrollIntoViewIfNeeded();
  const edit = frame.getByRole('button', { name: /^Edit / });
  if (await edit.isVisible()) await edit.click();
  const content = frame.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

test('while (true) { } is stopped after the time limit and the page stays responsive', async ({ page }) => {
  test.skip(!plain, 'no plain runnable block');
  const errors = watchErrors(page);
  await page.goto(`${plain!.lesson}/`);
  await expect(page.locator('body')).toHaveAttribute('data-runner-ready', 'true');
  await editTo(page, plain!.id, 'while (true) { }');
  const frame = frameOf(page, plain!.id);
  await frame.getByRole('button', { name: /^Run / }).click();
  const panel = panelOf(page, plain!.id);
  await expect(panel.locator('.runner-status')).toHaveText('Running…', { timeout: 180_000 });
  // while the loop runs in the worker, the page keeps painting and handling input
  const ticks = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const start = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - start < 1500) requestAnimationFrame(tick);
          else resolve(n);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(ticks).toBeGreaterThan(20);
  const toggle = page.locator('#theme-toggle');
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await toggle.click();
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).not.toBe(before);
  await expect(panel).toHaveAttribute('data-outcome', 'timeout', { timeout: 15_000 });
  await expect(panel.locator('.runner-status')).toContainText('Stopped after 5 seconds');
  // the runner restarts: the next run works
  await editTo(page, plain!.id, 'Console.WriteLine("still alive");');
  await frame.getByRole('button', { name: /^Run / }).click();
  await expect(panel).toHaveAttribute('data-outcome', 'completed', { timeout: 120_000 });
  await expect(panel.locator('.runner-output')).toHaveText('still alive\n');
  expect(errors).toEqual([]);
});

test('edit, stdin, compile errors, runtime exceptions, output cap and reset', async ({ page }) => {
  test.skip(!plain, 'no plain runnable block');
  const errors = watchErrors(page);
  await page.goto(`${plain!.lesson}/`);
  await expect(page.locator('body')).toHaveAttribute('data-runner-ready', 'true');
  const frame = frameOf(page, plain!.id);
  const panel = panelOf(page, plain!.id);
  const run = async (outcome: string) => {
    await frame.getByRole('button', { name: /^Run / }).click();
    await expect(panel).toHaveAttribute('data-outcome', outcome, { timeout: 180_000 });
  };

  // stdin
  await editTo(page, plain!.id, 'var name = Console.ReadLine();\nConsole.WriteLine($"Hello, {name}!");');
  await panel.locator('textarea.runner-stdin').fill('Ada');
  await run('completed');
  await expect(panel.locator('.runner-output')).toHaveText('Hello, Ada!\n');

  // compile error, shown inline on its line with the compiler's message
  await editTo(page, plain!.id, 'int x = 1;\nint y = "two";\nConsole.WriteLine(x + y);');
  await run('compile-error');
  await expect(frame.locator('.cm-runner-msg-error')).toContainText('CS0029');
  await expect(frame.locator('.cm-runner-line-error')).toHaveCount(1);
  await expect(panel.locator('.runner-problems')).toContainText('Line 2');

  // runtime exception: type, message and line
  await editTo(page, plain!.id, 'Console.WriteLine("before");\nint[] a = new int[2];\nConsole.WriteLine(a[5]);');
  await run('exception');
  await expect(panel.locator('.runner-exception')).toContainText('System.IndexOutOfRangeException');
  await expect(panel.locator('.runner-exception')).toContainText('line 3');
  await expect(frame.locator('.cm-runner-msg-exception')).toBeVisible();

  // output cap
  await editTo(page, plain!.id, 'while (true) Console.WriteLine("spam");');
  await run('output-limit');
  await expect(panel.locator('.runner-status')).toContainText('more than 64 KB');

  // reset brings back the note's code
  await frame.getByRole('button', { name: /^Reset / }).click();
  await expect(frame.locator('.cm-content')).not.toContainText('spam');
  expect(errors).toEqual([]);
});

test('harness is behind "Show harness" and marked as added code', async ({ page }) => {
  test.skip(!harnessed, 'no block with a harness');
  await page.goto(`${harnessed!.lesson}/`);
  await expect(page.locator('body')).toHaveAttribute('data-runner-ready', 'true');
  const panel = panelOf(page, harnessed!.id);
  const toggle = panel.getByRole('button', { name: 'Show harness' });
  await toggle.scrollIntoViewIfNeeded();
  await expect(panel.locator('.runner-harness')).toBeHidden();
  await toggle.click();
  await expect(panel.locator('.runner-harness')).toBeVisible();
  await expect(panel.locator('.runner-harness')).toContainText('Added code, not from the note');
  await expect(panel.locator('.runner-harness pre')).toHaveText(harnessed!.harness!);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

test('runner controls fit a 360 px screen', async ({ page }) => {
  test.skip(!plain, 'no plain runnable block');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`${plain!.lesson}/`);
  await expect(page.locator('body')).toHaveAttribute('data-runner-ready', 'true');
  const frame = frameOf(page, plain!.id);
  await frame.scrollIntoViewIfNeeded();
  for (const name of [/^Edit /, /^Run /]) await expect(frame.getByRole('button', { name })).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
