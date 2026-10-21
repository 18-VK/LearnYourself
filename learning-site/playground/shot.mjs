// Screenshot a playground page: node playground/shot.mjs "<query string>" out.png [width=900]
// e.g. node playground/shot.mjs 'viz=SortVisualizer&props={"algorithm":"heap"}&theme=dark' .cache/heap.png 390
// Prints console errors from the page. Needs the playground server running (npm run playground).
import { chromium } from '@playwright/test';

const [query = '', out = 'shot.png', width = '900'] = process.argv.slice(2);
const port = process.env.LY_PG_PORT ?? '5199';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/?${query}`);
await page.waitForSelector('body[data-ready="true"]', { timeout: 20000 }).catch(() => errors.push('visualizer did not mount within 20 s'));
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
console.log(`saved ${out}`);
