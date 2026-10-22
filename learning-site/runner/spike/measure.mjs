// Checkpoint 3 measurements for the C# runner (see learning-site/CHECKPOINT-3.md).
// Usage (from learning-site/, after `LY_RUNNER_SPIKE=1 npx tsx scripts/runner/publish.ts --force` and a build):
//   node runner/spike/measure.mjs http://localhost:4336/LearnYourself/runner/spike/
// Prints JSON: transfer sizes, cold start, warm compile+run, runaway-loop handling, second visit.
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4336/LearnYourself/runner/spike/';
const browser = await chromium.launch();
const context = await browser.newContext();
const result = {};

function track(page) {
  const t = { requests: 0, bytes: 0, files: [] };
  page.on('requestfinished', async (req) => {
    try {
      const s = await req.sizes();
      const res = await req.response();
      const fromCache = res ? res.fromServiceWorker() || (await res.headerValue('x-from-cache')) === '1' : false;
      t.requests++;
      t.bytes += s.responseBodySize + s.responseHeadersSize;
      t.files.push({ url: req.url().replace(/^.*\/LearnYourself\//, ''), body: s.responseBodySize, status: res?.status(), fromCache });
    } catch {
      /* ignore */
    }
  });
  return t;
}

// ── 1. cold start: empty cache, download + boot + first compile + run ──────────────────────────
let page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
const cold = track(page);
const coldRun = await page.evaluate(async () => {
  const t0 = performance.now();
  const r = await window.__run(window.__SORT, window.__HARNESS);
  return { ...r, totalMs: performance.now() - t0, ready: window.__ready };
});
await page.waitForTimeout(500);
result.cold = {
  totalMs: Math.round(coldRun.totalMs),
  bootMs: Math.round(coldRun.ready?.bootMs ?? 0),
  downloadMs: Math.round(coldRun.ready?.downloadMs ?? 0),
  firstCompileMs: Math.round(coldRun.compileMs ?? 0),
  firstRunMs: Math.round(coldRun.run?.ms ?? 0),
  output: coldRun.output,
  outcome: coldRun.run?.outcome,
  transferredBytes: cold.bytes,
  transferredMB: +(cold.bytes / 1048576).toFixed(2),
  requests: cold.requests,
};

// ── 2. warm: same worker, compile + run again (same code, then edited code) ─────────────────────
const warm = await page.evaluate(async () => {
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const code = window.__SORT + `\n// edit ${i}`;
    const t0 = performance.now();
    const r = await window.__run(code, window.__HARNESS.replace('2, 5, 7, 3', `2, 5, 7, ${3 + i}`));
    runs.push({ wallMs: performance.now() - t0, compileMs: r.compileMs, runMs: r.run?.ms, output: r.output.trim() });
  }
  return runs;
});
result.warm = warm.map((w) => ({ wallMs: Math.round(w.wallMs), compileMs: Math.round(w.compileMs), runMs: +w.runMs.toFixed(1), output: w.output }));

// ── 3. runaway loop: stopped by terminating the worker after 5 s; page stays responsive ────────
const loopStart = Date.now();
const loopPromise = page.evaluate(() => window.__run(window.__LOOP, null));
await page.waitForTimeout(1500);
const framesBefore = Number(await page.textContent('#frames'));
const clickLatencies = [];
for (let i = 0; i < 3; i++) {
  const before = Number(await page.textContent('#clicks'));
  const t0 = Date.now();
  await page.click('#tick');
  await page.waitForFunction((b) => Number(document.getElementById('clicks').textContent) > b, before);
  clickLatencies.push(Date.now() - t0);
  await page.waitForTimeout(300);
}
const framesAfter = Number(await page.textContent('#frames'));
const loop = await loopPromise;
result.loop = {
  outcome: loop.outcome,
  stoppedAfterMs: Date.now() - loopStart,
  framesDuringLoop: framesAfter - framesBefore,
  clickLatencyMs: clickLatencies,
};
// the runner restarts after a timeout (new worker; files come from Cache Storage)
const after = await page.evaluate(async () => {
  const t0 = performance.now();
  const r = await window.__run(window.__SORT, window.__HARNESS);
  return { wallMs: performance.now() - t0, output: r.output.trim(), ready: window.__ready };
});
result.restartAfterTimeout = { wallMs: Math.round(after.wallMs), output: after.output };
await page.close();

// ── 4. second visit: same browser profile, new page ─────────────────────────────────────────────
page = await context.newPage();
await page.goto(url);
const second = track(page);
const secondRun = await page.evaluate(async () => {
  const t0 = performance.now();
  const r = await window.__run(window.__SORT, window.__HARNESS);
  return { totalMs: performance.now() - t0, ready: window.__ready, output: r.output };
});
await page.waitForTimeout(500);
result.secondVisit = {
  totalMs: Math.round(secondRun.totalMs),
  bootMs: Math.round(secondRun.ready?.bootMs ?? 0),
  transferredBytes: second.bytes,
  transferredKB: +(second.bytes / 1024).toFixed(1),
  requests: second.requests,
  networkFiles: second.files.map((f) => `${f.url} ${f.status} ${f.body}`),
  output: secondRun.output.trim(),
};
result.consoleErrors = errors;
console.log(JSON.stringify(result, null, 2));
await browser.close();
