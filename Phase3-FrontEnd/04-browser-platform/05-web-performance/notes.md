# Web Performance

> Browser platform · Topic 5

Web performance is the work of making pages load fast, respond quickly and stay visually stable **for real users on real devices**, which mostly means mid-range Android phones on mobile networks, not your laptop. [SEO and Core Web Vitals](../../01-html/10-seo-and-core-web-vitals/notes.md) introduces LCP, INP and CLS and their thresholds; this note is about **diagnosing and improving** them: what each metric is made of, how to measure in the lab and the field, how to load less and load it in the right order, what JavaScript really costs, how caching, the back/forward cache and speculation rules make navigations instant, and how to stop performance regressing with budgets in CI.

## The metrics and what they are made of

| Metric | Measures | Good (p75) | Field / lab |
|---|---|---|---|
| **TTFB** (Time to First Byte) | Request start until the first byte of the HTML arrives: redirects, DNS, connection, server time | ≤ 0.8 s | Both |
| **FCP** (First Contentful Paint) | First text or image painted | ≤ 1.8 s | Both |
| **LCP** (Largest Contentful Paint) | Largest image or text block in the viewport painted | ≤ 2.5 s | Both |
| **INP** (Interaction to Next Paint) | Roughly the worst click/tap/key interaction latency of the visit, until the next frame is painted | ≤ 200 ms | Field only |
| **CLS** (Cumulative Layout Shift) | Largest burst of unexpected layout shifts | ≤ 0.1 | Both (lab sees only load-time shifts) |
| **TBT** (Total Blocking Time) | Sum of the part of each long task beyond 50 ms, from FCP until the page becomes interactive | ≤ 200 ms | Lab only: the lab proxy for INP |

Each Core Web Vital breaks down into parts, and the breakdown tells you what to fix.

### LCP sub-parts

| Sub-part | Is | Typical fix |
|---|---|---|
| TTFB | Time until the HTML starts arriving | CDN, caching HTML, fewer redirects, faster server |
| Resource load delay | Gap between TTFB and the LCP image *starting* to download | Make the image discoverable in the HTML (not CSS or JS), `fetchpriority="high"`, never `loading="lazy"` |
| Resource load duration | Download time of the image | Smaller, correctly sized AVIF/WebP, a CDN |
| Element render delay | Image downloaded but not yet painted | Remove render-blocking CSS/JS, avoid client-side rendering of the hero, long tasks |

On a well-tuned page most of the time is TTFB and download; delay and render delay should be small. A large **resource load delay** is the most common and cheapest problem: the browser simply found the image too late.

### INP sub-parts

| Sub-part | Is | Typical cause |
|---|---|---|
| Input delay | Interaction happens, but the main thread is busy with another task | Long tasks from hydration, third-party scripts, timers |
| Processing duration | Your event handlers run | Too much synchronous work in the handler |
| Presentation delay | Handlers finished; style, layout and paint of the next frame | Huge DOM updates, layout thrashing, large `innerHTML` re-renders |

### CLS details

Shifts are grouped into **session windows** (at most 5 s long, with gaps under 1 s), and CLS is the worst window, so a long-lived SPA is not punished for many small shifts spread over an hour. Shifts within 500 ms after a click, tap or key press are excluded: content moving because the user asked for it is expected. Animations using `transform` do not count as layout shifts.

## Lab data vs field data

| Tool | Type | Good for |
|---|---|---|
| Lighthouse (DevTools, CLI, CI) | Lab | Repeatable checks, diagnostics, regression tests; simulated throttling; no INP (uses TBT) |
| WebPageTest | Lab | Real devices and locations, filmstrips, request waterfalls, scripted journeys |
| DevTools Performance panel | Lab / live | Flame charts of long tasks, layout and paint; shows live LCP, CLS and INP as you click |
| CrUX (Chrome UX Report) | Field | Real Chrome users, p75 over a rolling 28 days, per origin and per URL with enough traffic; behind PageSpeed Insights and Search Console |
| RUM (your own monitoring) | Field | Every page and route, every browser that supports the metric, segmented by device, country, release |

Lab data tells you **why**; field data tells you **whether** users are affected. A good workflow: notice a problem in field data, reproduce it in the lab under similar conditions (throttled CPU, slow network, the same page state), fix, then confirm in field data after release.

### Collecting field data yourself

The `web-vitals` library handles the edge cases (background tabs, bfcache restores, prerendering, when to report CLS and INP) that make hand-written measurement wrong:

```js
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals/attribution";

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,          // "LCP", "INP", ...
    value: metric.value,
    rating: metric.rating,      // "good" | "needs-improvement" | "poor"
    id: metric.id,
    navigationType: metric.navigationType, // "navigate", "back-forward-cache", "prerender", ...
    page: location.pathname,
    // from metric.attribution pick a few fields: the LCP element, the INP interaction target and sub-parts
  });
  // sendBeacon survives the page being closed
  if (!navigator.sendBeacon("/rum", body)) {
    fetch("/rum", { method: "POST", body, keepalive: true });
  }
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Underneath, metrics come from `PerformanceObserver` (more in [Observers, History API and Workers](../06-observers-history-workers/notes.md)):

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log("LCP candidate at", entry.startTime, entry.element); // the last candidate wins
  }
}).observe({ type: "largest-contentful-paint", buffered: true });

// Long Animation Frames (Chromium): which scripts made a frame slow
new PerformanceObserver((list) => {
  for (const frame of list.getEntries()) {
    if (frame.duration > 100) {
      console.log("slow frame", Math.round(frame.duration), frame.scripts.map((s) => s.sourceURL));
    }
  }
}).observe({ type: "long-animation-frame", buffered: true });
```

`buffered: true` delivers entries recorded before the observer was created. Browser support differs: LCP and INP are measurable in Chromium, Firefox (LCP since 2024, INP since late 2025) and Safari (since 26.2, December 2025); CLS (the Layout Instability API) and Long Animation Frames are Chromium-only. CrUX contains Chrome users only.

## Loading: send less, in the right order

How the browser turns bytes into pixels (render-blocking CSS, parser-blocking scripts, layout and paint) is covered in [The rendering pipeline](../01-rendering-pipeline/notes.md). The goal here is to get the critical resources (HTML, critical CSS, the LCP image, critical fonts) first and push everything else back.

### Critical CSS

CSS in `<head>` blocks rendering until it has downloaded and parsed. For large stylesheets, inline the small set of rules needed for the first screen and load the rest without blocking:

```html
<style>/* critical rules for the header and hero, generated at build time */</style>
<link rel="stylesheet" href="/css/site.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="/css/site.css"></noscript>
```

The `media="print"` trick downloads the file at low priority without blocking, then applies it. The inline `onload` handler conflicts with a strict CSP (see [Security](../04-security-xss-csrf-csp/notes.md)), so many teams attach that handler from a script instead, or simply keep CSS small and split per route, which is often enough.

### Resource hints and priorities

| Hint | What it does | Use for | Misuse |
|---|---|---|---|
| `<link rel="preconnect" href="https://cdn.example.net">` | DNS + TCP + TLS now | 1–3 critical third-party origins (image CDN, font host) | Many preconnects waste sockets and CPU; unused ones are closed after ~10 s |
| `<link rel="dns-prefetch" href="...">` | DNS lookup only | Less critical origins; cheap | Rarely harmful |
| `<link rel="preload" href="..." as="image\|font\|style\|script">` | Fetch now, high priority, for **this** page | Late-discovered critical resources: an LCP image set in CSS, fonts, a critical lazy chunk | Preloading many files makes them compete; unused preloads trigger console warnings |
| `<link rel="modulepreload" href="/app.js">` | Fetch, parse and compile an ES module | Entry and critical module chunks | Same as preload |
| `<link rel="prefetch" href="...">` | Low-priority fetch for a **likely next navigation** | Next page's bundle | Wasted bandwidth; not supported in Safari |
| `fetchpriority="high\|low"` | Adjusts priority of an `<img>`, `<link>`, `<script>` or `fetch()` | `high` on the LCP image, `low` on off-screen carousel slides | Marking everything high means nothing is |

```html
<link rel="preconnect" href="https://images.example.net">
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<img src="https://images.example.net/hero-1200.avif" fetchpriority="high"
     width="1200" height="600" alt="Spring collection">
```

> **Note:** Font preloads need `crossorigin` even for same-origin fonts, because fonts are always fetched in CORS mode. Without it the preload is not reused and the font downloads twice.

**103 Early Hints** let the server or CDN send `Link: <...>; rel=preload` and `rel=preconnect` headers while it is still generating the HTML, turning slow server time into useful download time. Support is good in Chromium and Firefox and partial in Safari.

### Lazy loading

- `loading="lazy"` on `<img>` and `<iframe>` defers off-screen media until the user scrolls near it. Use it for everything **below** the fold.
- Never lazy-load the LCP image or anything in the first viewport: lazy images wait for layout before they start downloading.
- Lazy-load heavy embeds (maps, video players, chat widgets) behind a **facade**: a static preview image that loads the real widget on click.
- For custom cases (infinite lists, components, analytics), use `IntersectionObserver` (see [Observers, History API and Workers](../06-observers-history-workers/notes.md)).

### Responsive images and modern formats

```html
<picture>
  <source type="image/avif" srcset="hero-800.avif 800w, hero-1600.avif 1600w"
          sizes="(max-width: 800px) 100vw, 800px">
  <source type="image/webp" srcset="hero-800.webp 800w, hero-1600.webp 1600w"
          sizes="(max-width: 800px) 100vw, 800px">
  <img src="hero-800.jpg" srcset="hero-800.jpg 800w, hero-1600.jpg 1600w"
       sizes="(max-width: 800px) 100vw, 800px"
       width="1600" height="900" alt="Spring collection" fetchpriority="high">
</picture>
```

- `srcset` with `w` descriptors plus `sizes` lets the browser pick the smallest file that is sharp enough for the layout width and device pixel ratio. Without `sizes`, it assumes `100vw` and often downloads a too-large file.
- AVIF is usually smallest, WebP is the safe modern default, JPEG/PNG the fallback; all current browsers support AVIF and WebP. An image CDN can negotiate the format from the `Accept` header instead.
- `width` and `height` (or CSS `aspect-ratio`) reserve space and prevent CLS.

### Fonts

- Use WOFF2, self-host (no extra connection), and subset to the characters you need (`unicode-range` splits by script).
- Preload only the one or two fonts used above the fold.
- `font-display: swap` shows fallback text immediately (no invisible text) but causes a shift when the web font arrives; `optional` uses the web font only if it is ready almost immediately, and never shifts.
- Reduce the swap shift with a **metric-matched fallback**: a `@font-face` for a local font with `size-adjust` (and, where supported, `ascent-override` / `descent-override`) so the fallback takes the same space as the web font. Tools and frameworks can generate these values.

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-latin.woff2") format("woff2");
  font-display: swap;
}
@font-face {
  font-family: "Inter Fallback";
  src: local("Arial");
  size-adjust: 107%;       /* illustrative value: generate it for your font */
}
body { font-family: "Inter", "Inter Fallback", sans-serif; }
```

## JavaScript cost

Byte for byte, JavaScript is the most expensive resource: it is downloaded, then **parsed, compiled and executed on the main thread**, and while it runs the page cannot respond. 300 KB of JavaScript costs far more than a 300 KB image, especially on a mid-range phone with a CPU several times slower than a developer laptop.

### Ship less

- **Measure first**: a bundle analyser (`rollup-plugin-visualizer`, `webpack-bundle-analyzer`, `source-map-explorer`) shows what is actually in the bundle. Moment locales, a whole icon set and a duplicated library version are classic finds.
- **Code splitting** with dynamic `import()` loads code when it is needed: per route, and for heavy features behind an interaction (editor, charts, admin panels). How `import()` works is in [Modules](../../03-javascript/15-modules/notes.md).

```js
editButton.addEventListener("click", async () => {
  const { openEditor } = await import("./editor.js"); // separate chunk, downloaded on first click
  openEditor();
});
```

- Do not split what the first screen needs (that creates a request waterfall), and preload or prefetch chunks the user is likely to need next.
- **Tree shaking** removes unused exports, but only with static ES module `import`/`export`. CommonJS (`require`), dynamic property access and modules with side effects defeat it. Libraries mark side-effect-free files with `"sideEffects": false` in `package.json`; large barrel files (`index.js` re-exporting everything) can pull in more than you import.
- **Polyfills and transpilation**: target modern browsers; do not ship ES5 output and polyfills for features every supported browser has.

### Hydration cost

Server-side rendering paints HTML early (good LCP), but a classic SPA then **hydrates**: it downloads the JavaScript for the whole page, re-runs the components and attaches listeners. Until that finishes, the page looks ready but clicks do nothing or are slow, which shows up as poor INP and TBT. Approaches that reduce it: hydrating only interactive parts (**islands**, partial hydration), components that render only on the server (React Server Components), streaming with progressive hydration, and resumability (Qwik), which avoids re-running components on load.

### Long tasks and yielding

A **long task** is any main-thread task over 50 ms. While it runs, input waits, which is the "input delay" part of INP. The fix is to break work into smaller tasks and **yield** to the main thread between them, so the browser can handle input and paint. The event loop details are in [The event loop](../../03-javascript/19-event-loop/notes.md).

```js
function yieldToMain() {
  if (globalThis.scheduler?.yield) return scheduler.yield(); // continuation keeps its priority
  return new Promise((resolve) => setTimeout(resolve, 0));   // fallback (Safari)
}

async function processAll(items) {
  let deadline = performance.now() + 50;
  for (const item of items) {
    processItem(item);
    if (performance.now() > deadline) {
      await yieldToMain();
      deadline = performance.now() + 50;
    }
  }
}

// In an event handler: give visual feedback first, yield, then do the heavy part
filterButton.addEventListener("click", async () => {
  filterButton.setAttribute("aria-pressed", "true");
  await yieldToMain();      // the browser can paint the pressed state now
  applyFiltersAndRender();  // expensive work no longer delays the next paint
});
```

`scheduler.yield()` is in Chromium (129+) and Firefox (142+) but not Safari, hence the fallback. For CPU-heavy work that cannot be chunked (parsing, image processing, search indexing), move it to a **Web Worker**.

## Rendering performance

Most rendering problems come from the steps described in [The rendering pipeline](../01-rendering-pipeline/notes.md):

- **Layout thrashing**: interleaving DOM reads (`offsetHeight`, `getBoundingClientRect()`) with writes in a loop forces a synchronous layout each time. Batch reads, then writes.
- **Animate `transform` and `opacity`** only; they can run on the compositor without layout or paint. Animating `top`, `width` or `height` re-lays out every frame.
- **`content-visibility: auto`** skips rendering work for off-screen sections; pair it with `contain-intrinsic-size: auto 600px` so the scrollbar and layout stay stable. Supported in all current browsers.
- **Keep the DOM small**; long lists need virtualisation (render only visible rows).
- **`will-change`** sparingly, on elements about to animate; on everything it wastes memory.

## Caching and CDNs

The fastest request is the one that never happens. HTTP caching is covered in [Networking, CORS and caching](../03-networking-cors-caching/notes.md); the performance rules of thumb:

| Resource | Caching |
|---|---|
| Hashed build assets (`app.3f9a1c.js`) | `Cache-Control: public, max-age=31536000, immutable`: cached for a year, never revalidated |
| HTML | `no-cache` (revalidate every time) or a short `max-age` with `stale-while-revalidate` at the CDN |
| API responses | Depends on the data; `private` for user-specific responses |

- A **CDN** serves cached files from a location near the user, cutting latency. It only helps TTFB for the HTML if the HTML itself is cacheable at the edge (static, or cached with revalidation); personalised server-rendered HTML still goes to the origin.
- Compress text with Brotli (or gzip); HTTP/2 and HTTP/3 multiplex many requests over one connection, so combining files for request count matters less than it used to, but each request still has a cost.

## The back/forward cache (bfcache)

When the user navigates away, the browser can keep the whole page (JS heap included) in memory, and restore it **instantly** on Back or Forward. A large share of mobile navigations are back/forward, so bfcache eligibility is one of the cheapest wins available.

Common reasons a page is not restored:

- An `unload` event listener (also from third-party scripts). Chrome is deprecating `unload`; use `pagehide` or `visibilitychange`.
- `Cache-Control: no-store` on the HTML. Chrome has allowed such pages into bfcache since 2025 in limited cases (evicted if cookies change, shorter timeout); other browsers still refuse them. Use `no-cache` unless the page really contains sensitive data.
- Open connections or locks at navigation time: WebSocket, WebRTC, unfinished IndexedDB transactions, held Web Locks, in some browsers.
- A `window.opener` relationship with another window.

```js
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    // restored from bfcache: refresh stale data, restart timers, count a page view
  }
});

window.addEventListener("pagehide", (event) => {
  // the reliable "leaving" event: save state, close connections (reopen on pageshow)
});
```

Test in Chrome DevTools: **Application → Back/forward cache → Test back/forward cache** lists the blocking reasons. In the field, `PerformanceNavigationTiming.notRestoredReasons` (Chromium) reports them.

## Speculation rules: prefetch and prerender

The **Speculation Rules API** tells the browser which navigations to prepare in advance. Prefetch downloads the next document; **prerender** loads and renders the whole page in a hidden tab, so the navigation is instant.

```html
<script type="speculationrules">
{
  "prerender": [{
    "where": { "href_matches": "/products/*" },
    "eagerness": "moderate"
  }],
  "prefetch": [{
    "where": { "and": [
      { "href_matches": "/*" },
      { "not": { "href_matches": "/logout" } }
    ] },
    "eagerness": "conservative"
  }]
}
</script>
```

| `eagerness` | Triggered |
|---|---|
| `immediate` / `eager` | As soon as the rule is seen / on the earliest hint of intent |
| `moderate` | On hover for a short time (or pointer down) |
| `conservative` | On pointer down or touch start |

- **Status:** Chromium only (Chrome, Edge) in stable releases. Firefox and Safari are prototyping prefetch support; other browsers ignore the script, so it is a safe progressive enhancement.
- Exclude URLs with side effects (logout, add-to-cart via GET). Prerendered pages run JavaScript, so delay analytics until activation with `document.prerendering` and the `prerenderingchange` event.
- Speculations cost server capacity and the user's data; `moderate` and `conservative` keep waste low.
- With a strict CSP, an inline speculation rules script needs a nonce or the `'inline-speculation-rules'` keyword; rules can also be delivered with a `Speculation-Rules` response header.

It is mainly a tool for **multi-page apps**, where it delivers SPA-like navigation speed without client-side routing.

## Performance budgets in CI

A budget is a limit the team agrees not to exceed, checked automatically so regressions fail a build instead of reaching users.

| Budget type | Example | Tool |
|---|---|---|
| Quantity | Main bundle ≤ 170 KB compressed; ≤ 2 web fonts | `size-limit`, bundler size warnings |
| Lab timing | LCP ≤ 2.5 s, TBT ≤ 200 ms on a throttled mobile profile | Lighthouse CI |
| Field timing | p75 INP ≤ 200 ms per route | RUM dashboards with alerts |

A `.size-limit.json` that fails the build when compressed bundles grow past the limit:

```json
[
  { "path": "dist/assets/index-*.js", "limit": "170 kB" },
  { "path": "dist/assets/*.css", "limit": "40 kB" }
]
```

A `lighthouserc.json` for Lighthouse CI that checks two key routes against lab budgets:

```json
{
  "ci": {
    "collect": { "url": ["http://localhost:4173/", "http://localhost:4173/products/1"], "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 200 }]
      }
    }
  }
}
```

Bundle-size checks are fast and deterministic, so they make good blocking checks on every pull request. Lab timings are noisy: run several times, take the median and use them as warnings or on main-branch builds. Field budgets catch what the lab cannot (real devices, real interactions) and belong in alerting.

## Common Mistakes

- **Optimising the Lighthouse score instead of the field p75.** The score is a lab proxy; users experience the field numbers.
- **Preloading or `fetchpriority="high"` on many resources.** When everything is a priority, nothing is, and the LCP image competes with scripts.
- **Lazy-loading or JS-injecting the LCP image**, which delays the very element LCP measures.
- **Font preloads without `crossorigin`**, which download the font twice.
- **One huge bundle, or the opposite: hundreds of tiny chunks** loaded in a waterfall on first view.
- **Doing heavy work synchronously in click handlers**, so the next paint (and INP) waits for it.
- **`unload` listeners and unnecessary `Cache-Control: no-store`**, which silently disable the bfcache.
- **Testing only on a fast laptop and network.** Throttle CPU and network, or test on a mid-range phone.
- **Expecting a CDN to fix slow TTFB** when the HTML is personalised and never cached at the edge.
- **Treating performance as a one-off project** with no budgets or monitoring, so it regresses release by release.

## Key Takeaways

- Fix metrics by their sub-parts: LCP = TTFB + load delay + load duration + render delay; INP = input delay + processing + presentation delay.
- Field data (CrUX, your own RUM with `web-vitals`) decides whether there is a problem; lab tools (Lighthouse, WebPageTest, DevTools) explain why.
- Make the LCP image discoverable in the HTML with `fetchpriority="high"`; lazy-load only what is below the fold; serve responsive AVIF/WebP with dimensions.
- Use hints sparingly: `preconnect` for a few critical origins, `preload` for late-discovered critical resources, `prefetch` and speculation rules for the next navigation.
- JavaScript is the most expensive byte: split by route and interaction, tree-shake, reduce hydration, break long tasks and yield (`scheduler.yield()` with a fallback).
- Long-cache hashed assets, revalidate HTML, keep pages bfcache-eligible (no `unload`), and consider prerendering likely next pages in Chromium.
- Enforce budgets automatically: bundle size on every PR, Lighthouse CI on key routes, RUM alerts on p75.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between `preload`, `prefetch` and `preconnect`?**
`preconnect` sets up the connection (DNS, TCP, TLS) to another origin early, without downloading anything. `preload` downloads a resource the **current** page needs soon at high priority, for files the browser would otherwise discover late, like a font or a CSS background image. `prefetch` downloads a resource the **next** navigation will probably need, at low priority, into the HTTP cache.

**Q2. Why shouldn't you add `loading="lazy"` to every image?**
Lazy images do not start downloading until layout shows they are near the viewport, so images in the first screen, especially the LCP image, load later than they would otherwise, which directly worsens LCP. Lazy-load only images below the fold, and give the hero image `fetchpriority="high"` instead.

**Q3. What is a long task, and why does it hurt user experience?**
A long task is any piece of main-thread work that runs for more than 50 ms. JavaScript, style calculation and layout all share the main thread, so while a long task runs the browser cannot respond to clicks or paint frames; the user sees lag, which shows up as poor INP and TBT. The fix is to ship less JavaScript, break work into smaller chunks that yield, or move it to a Web Worker.

**Q4. What is tree shaking, and what can stop it working?**
Tree shaking is the bundler removing exports that are never imported. It relies on static ES module `import`/`export` syntax, so CommonJS `require()`, dynamic property access on a module, and modules that have side effects when imported prevent it. Libraries declare side-effect-free files with `"sideEffects": false` in `package.json`, and importing specific functions (`import { debounce } from "lodash-es"`) helps.

**Q5. How do you serve AVIF or WebP images with a fallback, and why set `width` and `height`?**
Use `<picture>` with `<source type="image/avif">` and `<source type="image/webp">` elements, and an `<img>` with a JPEG or PNG fallback; the browser picks the first format it supports. `width` and `height` let the browser reserve the right space (aspect ratio) before the image loads, which prevents layout shift (CLS).

**Q6. What is the back/forward cache, and what commonly stops a page using it?**
The bfcache keeps a complete snapshot of a page in memory when the user navigates away, so Back or Forward restores it instantly instead of reloading. Common blockers are `unload` event listeners, `Cache-Control: no-store` on the document (fully blocking outside Chrome), and open connections such as WebSockets at the moment of navigation. Use `pagehide` instead of `unload`, and the `pageshow` event with `event.persisted` to refresh data after a restore.

### Mid-level (2–4 years)

**Q7. Your LCP breakdown shows TTFB 600 ms, resource load delay 1,400 ms, load duration 300 ms and render delay 200 ms. What is wrong, and what do you do?**
The image downloads quickly but starts far too late: the browser discovers it late. Typical causes are an image set as a CSS background, injected by JavaScript or client-side rendering, marked `loading="lazy"`, or queued behind many other high-priority requests. Put the image in the initial HTML as an `<img>` (or preload it), add `fetchpriority="high"`, remove lazy loading, and preconnect to the image CDN if it is a different origin. Only after that is the remaining time worth attacking (TTFB with caching or a CDN).

**Q8. Field data shows INP of 450 ms, mostly from clicks on a "Filter" button in a product list. How do you investigate and fix it?**
Reproduce in the DevTools Performance panel with CPU throttling and look at the interaction: is time spent in input delay (another task was running), processing (the handler itself) or presentation (rendering the result)? RUM attribution from `web-vitals` gives the same breakdown from real users. Typical fixes: give immediate visual feedback, then `await` a yield before the heavy filtering; break the filtering into chunks or move it to a worker; render fewer DOM nodes (virtualise the list, avoid re-rendering unchanged items); and remove or defer unrelated work (analytics, third-party scripts) that runs at the same time.

**Q9. How would you set up real-user monitoring for Core Web Vitals?**
Load the `web-vitals` library (the attribution build), register `onLCP`, `onINP`, `onCLS`, `onFCP` and `onTTFB`, and send each metric with `navigator.sendBeacon` (falling back to `fetch` with `keepalive`) to an endpoint. Include context: route template, device type, connection, navigation type (normal, bfcache, prerender), app version and the attribution fields (LCP element, INP target and sub-parts). Aggregate at the **75th percentile** per route and device class, compare releases, and alert on regressions. Sample on very high-traffic sites to control cost.

**Q10. How do you decide how to code-split an application?**
Split by route first, so each page downloads only its own code, then split heavy features behind interactions (rich editor, charts, maps, admin tools) with dynamic `import()`. Keep code needed for the first render in the main chunk, because splitting it only adds a request waterfall. Put stable third-party code in a separate vendor chunk so it stays cached across releases, avoid hundreds of tiny chunks, and prefetch or `modulepreload` chunks for the likely next step. Verify the result with a bundle analyser and a size budget.

**Q11. Text is invisible for a second on slow connections, and when the web font arrives the page jumps. What is happening, and how do you fix both?**
Without a suitable `font-display`, browsers hide text while the font loads (FOIT); when the font arrives with different metrics from the fallback, lines rewrap and content shifts (CLS). Use `font-display: swap` (or `optional` if a late swap is unacceptable), self-host WOFF2 files subset to the characters you need, preload the one or two critical fonts with `crossorigin`, and define a metric-matched fallback with `size-adjust` (and the override descriptors where supported) so the swap barely moves anything.

**Q12. What are speculation rules, and what would you watch out for when adding prerendering?**
A `<script type="speculationrules">` block (or a response header) tells Chromium browsers which links to prefetch or prerender, with an `eagerness` setting from on-click to immediately; a prerendered page activates instantly. Watch out for: URLs with side effects (logout, GET-based actions), so exclude them; analytics and ads firing for pages the user never sees, so check `document.prerendering` and wait for `prerenderingchange`; extra server load and user data, so prefer `moderate` or `conservative`; and CSP, which needs a nonce or `'inline-speculation-rules'`. Other browsers ignore it, so it is safe progressive enhancement.

**Q13. A server-rendered page looks ready in 1.5 s on mobile, but buttons do nothing for another 3 seconds. Why, and what can you do?**
That is hydration: the HTML is painted, but the framework's JavaScript must download, parse and re-run components to attach event handlers, and the main thread is busy with long tasks meanwhile. Reduce the JavaScript the page hydrates (code splitting, removing unused libraries), hydrate only interactive parts (islands or server components), split hydration into chunks that yield, defer non-critical third-party scripts until after it, and make critical controls work without JavaScript where possible (real links and forms).

### Senior (5+ years)

**Q14. How would you introduce and enforce performance budgets in a monorepo where twelve teams ship to the same app?**
Agree on budgets from user-facing goals, not arbitrary numbers: start from current p75 field values and the Core Web Vitals thresholds, then derive per-route JavaScript and image budgets that keep the slowest important route within them. Make each budget owned: route or package ownership maps a budget breach to a team. Enforce in layers: a `size-limit`-style bundle check on every pull request (fast, deterministic, blocking), Lighthouse CI on key routes on the main branch (warning, median of several runs), and RUM alerts per route after release.

Provide an escape hatch with friction: raising a budget needs a reviewed change with a reason, so the trade-off is visible. Publish a dashboard per team and review trends regularly. Recommendation: block only on deterministic metrics (bytes), warn on noisy lab timings, alert on field p75, and require explicit, reviewed budget increases.

**Q15. After a release, RUM shows p75 INP rising from 180 ms to 320 ms on Android, but Lighthouse and your own testing look fine. How do you triage it?**
First narrow it down with the field data: which routes, devices, browsers and interaction targets regressed, and which INP sub-part grew (input delay points to other tasks such as third-party or hydration work; processing to your handlers; presentation to rendering). Correlate with the release diff and any third-party or tag-manager changes deployed in the same window, and check Long Animation Frame attribution if you collect it. Lab tools missed it because Lighthouse does not interact with the page, and laptops are much faster than a mid-range phone.

Reproduce with the identified interaction on a real mid-range device or 4–6x CPU throttling, fix or roll back, and confirm in field data. Then close the gap: add an interaction test (a scripted click measured in the Performance panel or with a lab INP tool) for that flow, and an alert on per-route INP. Recommendation: let field attribution pick the route and interaction, roll back fast if the cause is not obvious, and add a guard so the same class of regression is caught before release.

**Q16. Marketing has added twelve third-party tags and the main thread is now dominated by them. How do you bring performance back without simply removing everything?**
Start with data: measure each tag's cost (main-thread time per script from Long Animation Frames or a performance trace, bytes, requests) and its business value, owner and last review date. Then apply a policy: remove unused and duplicate tags; load the rest after the page is interactive (on `load` or idle, not in `<head>`); replace heavy widgets with facades that load on interaction; move server-capable tracking to server-side collection; and keep tags off critical flows like checkout.

Put a governance process in place: a tag inventory, a performance cost for each new tag, a main-thread budget for third parties monitored in RUM, and periodic review. Recommendation: make third-party cost visible per tag and per owner, defer by default, and require new tags to fit within a third-party budget rather than negotiating each one ad hoc.

**Q17. You have one quarter and a large site with hundreds of templates. How do you decide where to spend performance effort?**
Prioritise by user and business impact: rank page templates (not individual URLs) by traffic multiplied by how far their p75 metrics are from "good", weighted by business value (checkout and landing pages before the help centre). Fix shared causes first, because one change to the global bundle, image component, font setup or CDN configuration improves every template. Correlate performance with business metrics (conversion, bounce) per template to justify the work and choose between options.

Pick a few high-leverage items per metric, ship them behind measurement, and verify in field data before moving on. Recommendation: work template-first and shared-infrastructure-first, driven by field data weighted by traffic and value, and lock each win in with a budget so the quarter's gains are not lost the next quarter.

## References

- [web.dev: Learn Performance](https://web.dev/learn/performance)
- [web.dev: Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp)
- [web.dev: Optimize Interaction to Next Paint](https://web.dev/articles/optimize-inp)
- [web.dev: Optimize Cumulative Layout Shift](https://web.dev/articles/optimize-cls)
- [web.dev: Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
- [web.dev: Back/forward cache](https://web.dev/articles/bfcache)
- [web.dev: Best practices for fonts](https://web.dev/articles/font-best-practices)
- [web.dev: Lab and field data](https://web.dev/articles/lab-and-field-data-differences)
- [GitHub: web-vitals library](https://github.com/GoogleChrome/web-vitals)
- [Chrome for Developers: Prerender pages for faster page navigations](https://developer.chrome.com/docs/web-platform/prerender-pages)
- [Chrome for Developers: Long Animation Frames API](https://developer.chrome.com/docs/web-platform/long-animation-frames)
- [Chrome for Developers: Use scheduler.yield() to break up long tasks](https://developer.chrome.com/blog/use-scheduler-yield)
- [MDN: Web performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [MDN: Speculation Rules API](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API)
- [MDN: rel=preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preload)
- [MDN: Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images)
- [GitHub: Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [GitHub: size-limit](https://github.com/ai/size-limit)
