/**
 * Renders one visualizer outside the site, for development and screenshots:
 *   npm run playground                      → http://localhost:5199/?viz=SortVisualizer&props={"algorithm":"quick"}
 *   &theme=dark   dark theme      &width=360   narrow viewport check (sets the article width)
 * Uses the site's own CSS, so what you see here is what a lesson shows.
 */
import '@fontsource-variable/literata';
import '@fontsource-variable/jetbrains-mono';
import '../src/styles/global.css';
import '../src/styles/viz.css';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { VIZ_REGISTRY } from '../src/viz/registry';

const q = new URLSearchParams(location.search);
const name = q.get('viz') ?? '';
const theme = q.get('theme');
if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
const width = q.get('width');
if (width) (document.getElementById('lesson-article') as HTMLElement).style.maxWidth = `${width}px`;
const root = document.getElementById('root')!;
(document.getElementById('pg-title') as HTMLElement).textContent = name || 'Pick a visualizer';
const load = VIZ_REGISTRY[name];
if (!load) {
  root.innerHTML = `<p>Unknown visualizer "${name}". Registered: ${Object.keys(VIZ_REGISTRY).join(', ')}</p>`;
} else {
  let props: Record<string, unknown> = {};
  try {
    props = JSON.parse(q.get('props') ?? '{}') as Record<string, unknown>;
  } catch {
    /* defaults */
  }
  void load().then((mod) => {
    createRoot(root).render(createElement(mod.default, { ...props, placement: q.get('placement') ?? '' }));
    document.body.dataset.ready = 'true';
  });
}
