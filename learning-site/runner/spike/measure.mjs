// Checkpoint 3 measurements for the C# runner, on the production build (see learning-site/CHECKPOINT-3.md).
// Usage, from learning-site/ after `npm run build` and with `astro preview` running:
//   node runner/spike/measure.mjs http://localhost:4336/LearnYourself/
// Uses the real lesson UI: the insertion sort block of dsa/sorting/stability-and-simple-sorts (the note's code plus
// a harness with the note's own input). Prints JSON: transfer, cold start, warm compile+run, runaway loop, second visit.
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const base = (process.argv[2] ?? 'http://localhost:4336/LearnYourself/').replace(/\/?$/, '/');
const lesson = 'dsa/sorting/stability-and-simple-sorts';
const data = JSON.parse(fs.readFileSync('src/data/generated/runnable.json', 'utf8'));
const entry = data.lessons[lesson].find((b) => b.harness && b.harness.includes('InsertionSort'));
const browser = await chromium.launch();
const context = await browser.newContext();
const result = { block: entry.id, runner: data.runner };

function track(page) {
  const t = { requests: 0, bytes: 0, runnerBytes: 0, files: [] };
  page.on('requestfinished', async (req) => {
    try {
      const s = await req.sizes();
      const res = await req.response();
      const bytes = s.responseBodySize + s.responseHeadersSize;
      const url = req.url().replace(base, '');
      t.requests++;
      t.bytes += bytes;
      if (url.startsWith('runner/')) t.runnerBytes += bytes;
      t.files.push({ url, status: res?.status(), body: s.responseBodySize, encoding: (await res?.headerValue('content-encoding')) ?? '' });
    } catch {
      /* ignore */
    }
  });
  return t;
}

const errors = [];
async function open(page) {
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}${lesson}/`);
  await page.waitForSelector('body[data-runner-ready="true"]');
}
const frame = (page) => page.locator(`figure.code-frame[data-run-id="${entry.id}"]`);
const panel = (page) => page.locator(`.runner[data-run-id="${entry.id}"]`);

async function runAndWait(page, outcome = 'completed') {
  const t0 = Date.now();
  await frame(page).getByRole('button', { name: /^Run / }).click();
  await page.waitForFunction(
    ([id, want]) => document.querySelector(`.runner[data-run-id="${id}"]`)?.getAttribute('data-outcome') === want,
    [entry.id, outcome],
    { timeout: 240_000 },
  );
  const p = panel(page);
  return {
    wallMs: Date.now() - t0,
    compileMs: Number(await p.getAttribute('data-compile-ms')),
    runMs: Number(await p.getAttribute('data-run-ms')),
    output: (await p.locator('.runner-output').textContent())?.trim(),
  };
}
async function editTo(page, code) {
  const f = frame(page);
  const edit = f.getByRole('button', { name: /^Edit / });
  if (await edit.isVisible()) await edit.click();
  await f.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

// ── 1. cold start: empty cache; download + runtime start + first compile + run ─────────────────
let page = await context.newPage();
const cold = track(page);
await open(page);
const coldRun = await runAndWait(page);
await page.waitForTimeout(500);
result.cold = {
  ...coldRun,
  transferredMB: +(cold.runnerBytes / 1048576).toFixed(2),
  requests: cold.files.filter((f) => f.url.startsWith('runner/')).length,
  contentEncodings: [...new Set(cold.files.filter((f) => f.url.startsWith('runner/')).map((f) => `${f.url.split('.').pop()}:${f.encoding || 'none'}`))],
};

// ── 2. warm: same page, compile + run again (unchanged, then edited code) ────────────────────────
result.warm = [];
for (let i = 0; i < 3; i++) result.warm.push(await runAndWait(page));
const code = (await frame(page).locator('pre').textContent()) ?? '';
for (let i = 0; i < 3; i++) {
  await editTo(page, `${code}\n// edit ${i}`);
  result.warm.push(await runAndWait(page));
}

// ── 3. runaway loop: stopped by terminating the worker; the page stays responsive ───────────────
// keep the method the harness calls, but make it loop forever
await editTo(page, ['void InsertionSort(int[] arr)', '{', '    while (true) { }', '}'].join('\n'));
const loopStart = Date.now();
await frame(page).getByRole('button', { name: /^Run / }).click();
await page.waitForFunction((id) => /^Running/.test(document.querySelector(`.runner[data-run-id="${id}"] .runner-status`)?.textContent ?? ''), entry.id, { timeout: 120_000 }).catch(async (e) => {
  console.error('status:', await panel(page).locator('.runner-status').textContent(), 'outcome:', await panel(page).getAttribute('data-outcome'));
  throw e;
});
const ticks = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let n = 0;
      const start = performance.now();
      const tick = () => {
        n++;
        if (performance.now() - start < 2000) requestAnimationFrame(tick);
        else resolve(n);
      };
      requestAnimationFrame(tick);
    }),
);
const clickLatency = [];
for (let i = 0; i < 3; i++) {
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const t0 = Date.now();
  await page.click('#theme-toggle');
  await page.waitForFunction((b) => document.documentElement.getAttribute('data-theme') !== b, before);
  clickLatency.push(Date.now() - t0);
}
await page.waitForFunction((id) => document.querySelector(`.runner[data-run-id="${id}"]`)?.getAttribute('data-outcome') === 'timeout', entry.id, { timeout: 30_000 });
result.loop = { stoppedAfterMsFromClick: Date.now() - loopStart, framesIn2s: ticks, clickLatencyMs: clickLatency };
// the next run after a timeout (a new worker, booted from Cache Storage in the background)
await page.waitForTimeout(3000);
await editTo(page, code);
result.afterTimeout = await runAndWait(page);
await page.close();

// ── 4. second visit: same browser profile, new page ─────────────────────────────────────────────
page = await context.newPage();
const second = track(page);
await open(page);
const secondRun = await runAndWait(page);
await page.waitForTimeout(500);
result.secondVisit = {
  ...secondRun,
  transferredKB: +(second.runnerBytes / 1024).toFixed(1),
  runnerRequests: second.files.filter((f) => f.url.startsWith('runner/')).map((f) => `${f.url} ${f.status} ${f.body}`),
};
result.consoleErrors = errors;
console.log(JSON.stringify(result, null, 2));
await browser.close();
