import { expect, test, type Page } from '@playwright/test';

/** Interaction checks for the ASP.NET Core visualizers (src/viz/aspnet), on the production build. */

async function mount(page: Page, path: string, viz: string, nth = 0) {
  await page.goto(path);
  const slot = page.locator(`.viz-slot[data-viz="${viz}"]`).nth(nth);
  await slot.scrollIntoViewIfNeeded();
  await expect(slot).toHaveAttribute('data-state', 'mounted', { timeout: 15_000 });
  return slot;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('JWT decoder: the demo token verifies, an edited payload breaks the signature, re-signing fixes it', async ({ page }) => {
  const errors = watchErrors(page);
  const viz = await mount(page, 'phase-2/auth-fundamentals/jwt/', 'JwtDecoderVisualizer');
  const verdict = viz.locator('.jwt-verdict');
  await expect(verdict).toContainText('Signature valid', { timeout: 15_000 });
  const editor = viz.getByLabel('Payload JSON');
  const text = await editor.inputValue();
  await editor.fill(text.replace('"Admin"', '"SuperAdmin"'));
  await expect(verdict).toContainText('does not match');
  await viz.getByRole('button', { name: 'Re-sign with the demo secret' }).click();
  await expect(verdict).toContainText('Signature valid');
  expect(errors).toEqual([]);
});

test('middleware order: authorization before authentication turns a valid token into 401', async ({ page }) => {
  const errors = watchErrors(page);
  const viz = await mount(page, 'phase-2/pipeline/middleware/', 'MiddlewarePipelineVisualizer', 1);
  await viz.getByRole('button', { name: 'Authorization before authentication' }).click();
  await viz.getByRole('button', { name: 'Valid token' }).click();
  await viz.locator('.viz').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
  await expect(viz.locator('.asp-outcome')).toContainText('401');
  await expect(viz.locator('.asp-rules-head')).toContainText('broken');
  // move UseAuthentication back above UseAuthorization with the arrow buttons
  await viz.getByRole('button', { name: 'Move UseAuthentication up' }).click();
  await expect(viz.locator('.asp-rules-head')).toHaveText('Every ordering rule holds');
  expect(errors).toEqual([]);
});

test('rate limiter: the note’s curl test ends with 429s, and firing a burst adds requests', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const viz = await mount(page, 'phase-2/production-concerns/rate-limiting/', 'RateLimiterVisualizer');
  await viz.locator('.viz').click({ position: { x: 5, y: 5 } });
  const step = viz.locator('.stepno');
  const total = Number(/\/ (\d+)/.exec((await step.textContent()) ?? '')![1]);
  await viz.getByLabel('Timeline', { exact: true }).fill(String(total - 1));
  await expect(viz.locator('.asp-stats')).toContainText('Rejected (429)');
  await expect(viz.locator('.asp-stats .tone-bad b')).toHaveText('3');
  await viz.getByRole('button', { name: 'Burst of 10' }).click();
  await expect(viz.locator('.asp-stats div').first().locator('b')).not.toHaveText('15', { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('RS256: a forged token is rejected and Web Crypto agrees', async ({ page }) => {
  const errors = watchErrors(page);
  const viz = await mount(page, 'phase-2/auth-fundamentals/creating-and-signing-jwts/', 'Rs256Visualizer');
  await viz.getByRole('button', { name: "Signed with someone else's private key" }).click();
  await expect(viz.locator('.rs-stage')).toBeVisible({ timeout: 30_000 });
  await viz.locator('.viz').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  await expect(viz.locator('.rs-verdict')).toContainText('Rejected', { timeout: 30_000 });
  await expect(viz.locator('.narr')).toContainText('verify() agrees: false');
  expect(errors).toEqual([]);
});

test('capstone trace: an empty title stops at the ValidationFilter with 400', async ({ page }) => {
  const errors = watchErrors(page);
  const viz = await mount(page, 'phase-2/capstone/validation-filter-and-extensions/', 'CapstoneTraceVisualizer');
  await viz.getByRole('button', { name: 'Empty title (400 from ValidationFilter)' }).click();
  await viz.locator('.viz').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await expect(viz.locator('.cap-response')).toContainText('400');
  await expect(viz.locator('.viz-code-head')).toContainText('ValidationFilter.cs');
  expect(errors).toEqual([]);
});

test('route matcher: GET …/abc ends in 405 with an Allow header', async ({ page }) => {
  const errors = watchErrors(page);
  const viz = await mount(page, 'phase-2/controllers-and-routing/routing/', 'RouteMatcherVisualizer');
  await viz.getByRole('button', { name: 'GET …/abc (constraint)' }).click();
  await viz.locator('.viz').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  await expect(viz.locator('.asp-outcome')).toContainText('Allow: DELETE, PUT');
  expect(errors).toEqual([]);
});
