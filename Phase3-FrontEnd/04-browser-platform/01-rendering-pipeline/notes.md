# How the Browser Renders a Page

> Browser platform · Topic 1 · Demo: [index.html](index.html) · [script.js](script.js) · Open index.html in a browser, record with the DevTools Performance panel and compare the two buttons.

Between the first bytes of HTML arriving and pixels appearing, the browser runs a pipeline: it parses HTML into the DOM and CSS into the CSSOM, works out every element's style, lays the boxes out, paints them and composites the painted layers into a frame. Knowing which stage a change triggers is what lets you explain why a page is slow to first paint, why an animation stutters, or why a loop that reads `offsetWidth` takes 200 ms. This note follows a page from navigation to first paint, then looks at the work done on every frame after that, how to avoid the expensive stages, and how to see all of it in the DevTools Performance panel.

## From URL to first paint

1. **Navigation.** DNS lookup, TCP connection and TLS handshake (a single combined handshake with HTTP/3), then the HTTP request. These round trips happen before a single byte of HTML arrives; connection reuse and a CDN close to the user shorten them.
2. **First byte (TTFB).** The HTML arrives as a stream. The browser does not wait for the whole file: it starts parsing the first chunk straight away.
3. **Parsing.** The HTML parser builds the DOM and, on the way, finds stylesheets, scripts, images and fonts and requests them.
4. **Style.** Once the render-blocking CSS has arrived, the browser builds the CSSOM and computes each element's style.
5. **Layout, paint, composite.** Boxes get sizes and positions, are painted into layers, and the layers are combined into the first frame: **First Paint**, then **First Contentful Paint** (FCP) when text or an image appears.
6. **Later milestones.** `DOMContentLoaded` fires when the HTML is fully parsed and `defer` scripts have run; `load` fires when images, stylesheets and iframes are done as well. **Largest Contentful Paint** (LCP) is the moment the biggest element in the viewport is rendered.

| Milestone | Meaning | Usually delayed by |
| --- | --- | --- |
| TTFB | First byte of the HTML response | Server time, redirects, network round trips |
| FCP | First text or image painted | Render-blocking CSS, parser-blocking scripts in `<head>` |
| LCP | Largest image or text block in the viewport painted | Everything above, plus the LCP resource's own download |
| `DOMContentLoaded` | HTML parsed, `defer` scripts done | Parser-blocking scripts, slow `defer` scripts |
| `load` | All subresources finished | Images, iframes, slow third parties |

LCP is one of the Core Web Vitals, with INP and CLS: see [SEO and Core Web Vitals](../../01-html/10-seo-and-core-web-vitals/notes.md#core-web-vitals) for thresholds and fixes, and [Web performance](../05-web-performance/notes.md) for the wider toolbox.

> **Note:** Rendering is progressive. Once the render-blocking resources in the `<head>` are in, the browser can paint the part of the `<body>` parsed so far and keep painting as more HTML streams in. That is why sending the `<head>` early (flushing it before the server has finished building the rest of the page) improves FCP.

## Parsing HTML into the DOM

### Tokenizer and tree construction

Parsing is two steps that run together:

- The **tokenizer** reads the character stream and emits tokens: start tag `<p class="x">`, text, end tag `</p>`, comment.
- **Tree construction** turns the tokens into DOM nodes and inserts them into the tree, applying the HTML spec's error-recovery rules on the way: an unclosed `<p>` is closed, a missing `<tbody>` is inserted. HTML parsing never fails with a syntax error; the parser always produces a DOM. See [DOM and BOM](../../03-javascript/20-dom-and-bom/notes.md) for the DOM itself.

The parser is incremental, and it has to pause for one thing: a **classic `<script>`** (no `async`, `defer` or `type="module"`). The script might call `document.write()` and inject markup at that exact position, or query the DOM parsed so far, so the parser stops until the script has downloaded and run. That is a **parser-blocking** script.

### The preload scanner

If the main parser sat idle while a blocking script downloaded, nothing below the script would be requested until it finished. To avoid that, browsers run a **preload scanner** (speculative parser): a lightweight tokenizer that races ahead through the raw HTML and starts downloading the resources it sees in markup while the main parser is blocked. It is one of the biggest loading optimisations browsers have, and it only helps resources that appear **in the HTML**.

| The preload scanner finds | It cannot find |
| --- | --- |
| `<link rel="stylesheet" href>` | Images set from CSS (`background-image`), including hero images |
| `<script src>` (classic, `async`, `defer`, module) | Fonts from `@font-face` (requested only once CSS is parsed and text needs them) |
| `<img src>` and `srcset` | Scripts and styles injected by JavaScript |
| `<link rel="preload">`, `<link rel="modulepreload">` | Lazy images that swap a `data-src` in with script |
| | Stylesheets pulled in by CSS `@import` (found only after the parent CSS downloads) |

Anything in the right-hand column is a **late-discovered resource**. If it is critical (an LCP background image, a font used above the fold), announce it in the HTML:

```html
<link rel="preload" href="/img/hero.avif" as="image" fetchpriority="high">
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
```

The font preload needs `crossorigin` even on the same origin. Fonts are always fetched in CORS mode, so a preload without it does not match the real request and the font downloads twice.

## CSS and the CSSOM

Stylesheets are parsed into the **CSSOM** (CSS Object Model): rules, selectors and declarations. Unlike HTML, CSS is not useful half-applied: a rule at the end of a file can override one at the start, so the browser needs the complete stylesheet before it can compute final styles.

**Style calculation** (DevTools calls it *Recalculate Style*) matches selectors against elements and runs the cascade to produce each element's **computed style**. The DOM plus computed styles is usually described as the **render tree**: the elements that actually generate boxes.

| | In the DOM | Generates boxes (in the render tree) |
| --- | --- | --- |
| `display: none` element and its descendants | Yes | No |
| `visibility: hidden` element | Yes | Yes: it takes up space, it is just not painted |
| `<head>`, `<script>`, `<meta>` | Yes | No |
| `::before` / `::after` content | No | Yes |

## Render-blocking vs parser-blocking resources

These are two different kinds of blocking, and interviewers like to check that you can separate them.

| Resource | Blocks HTML parsing? | Blocks the first paint? |
| --- | --- | --- |
| `<link rel="stylesheet">` in `<head>` | No | **Yes**, until downloaded and parsed |
| `<link rel="stylesheet" media="print">` (media does not match) | No | No: downloaded at low priority |
| Classic `<script src>` | **Yes**, for download and execution | Indirectly: nothing below it is parsed, so nothing below it can be painted |
| `<script defer>`, `<script type="module">` | No | No |
| `<script async>` | Only while it executes | No |
| `<img>` | No | No (but it may be the LCP element) |
| Web font | No | Text in that font can stay invisible for up to about 3 s (the default block period), not the whole page |

Two points that are easy to miss:

- **CSS also blocks scripts.** A classic script may read styles (`getComputedStyle`, `offsetWidth`), so the browser does not execute it until every stylesheet before it has loaded. A slow stylesheet therefore delays the scripts below it as well as the paint.
- **`async`, `defer` and modules** decide when a script runs relative to parsing. The comparison is in [async and defer](../../03-javascript/01-how-js-runs/notes.md#async-and-defer): `defer` (or a module) for your own code, `async` for independent third-party scripts.

A newer, explicit control: `blocking="render"` on a `<script>`, `<style>` or `<link>` marks it as render-blocking even if it would not be (for example a small theme script that must run before the first paint to avoid a flash). It is not supported in every browser yet, so treat it as an enhancement.

## The rendering pipeline: style → layout → paint → composite

```text
  DOM / CSS change
        │
        ▼
  ┌─────────┐    ┌────────┐    ┌───────┐    ┌───────────┐
  │  Style  │ →  │ Layout │ →  │ Paint │ →  │ Composite │ →  frame on screen
  └─────────┘    └────────┘    └───────┘    └───────────┘
  which rules     size and      drawing      combine layers
  apply           position      commands     (compositor thread, GPU)
  ◄──────────── main thread ─────────────►
```

| Stage | What it does | Name in DevTools |
| --- | --- | --- |
| Style | Matches selectors, computes each element's final values | Recalculate Style |
| Layout (reflow) | Computes geometry: size, position, line breaks of every box | Layout |
| Paint | Records drawing commands (text, colours, borders, shadows, images) for each layer | Paint |
| Composite | Rasterises layers into pixels, often on the GPU, and assembles them with transforms and opacity applied | Commit, Raster, Composite (varies by version) |

Each stage feeds the next, so a change that invalidates an early stage pays for every later stage too. Changing `width` re-runs layout, paint and composite; changing `background-color` skips layout; changing `transform` on an element that has its own layer can go straight to composite.

Style, layout and paint run on the **main thread**, the same thread that runs your JavaScript. Compositing happens on a separate **compositor thread** and the GPU. That split is why composite-only animations stay smooth while JavaScript is busy (Q12).

> **Note:** Four stages is a simplification. Chromium's real pipeline (RenderingNG) has more steps (pre-paint, layerize, commit, raster, draw), and Firefox and Safari differ in detail, but style → layout → paint → composite is the model every engine shares and the one you need to reason about cost.

## Layers and compositing

A **compositing layer** is a part of the page painted into its own bitmap (a GPU texture), so the compositor can move, fade or scroll it without repainting it. Common reasons an element gets its own layer (the exact rules differ between engines):

- `will-change: transform` or `will-change: opacity`.
- A 3D transform (`translateZ(0)`, `translate3d()`) or `perspective`: the old "force GPU" hack.
- A running CSS animation or transition of `transform`, `opacity` or `filter` (promoted while it runs).
- `<video>`, a WebGL `<canvas>`, iframes, `backdrop-filter`.
- Scroll containers, so they can scroll on the compositor thread.
- **Overlap:** an element painted on top of a composited layer may need a layer of its own to keep the stacking order correct (implicit promotion).

Layers are not free:

- Every layer is a texture in GPU memory, roughly `width × height × 4` bytes at device pixels. One full-screen layer on a high-density phone is several megabytes.
- Too many layers (a **layer explosion**, often from `will-change` on every list item, or from overlap) costs memory and compositing time, and on low-end phones makes things slower rather than faster.

```css
/* ❌ promotes everything, permanently */
* { will-change: transform; }

/* ✅ promote only what is about to animate, and only while it does */
.drawer { transition: transform 200ms ease-out; }
.drawer.is-opening { will-change: transform; }
```

`will-change: transform`, like `transform` itself, also creates a stacking context and a containing block for `position: fixed` descendants, so it can change layout as well as performance: see [CSS positioning](../../02-css/11-position-and-z-index/notes.md) and the performance section of [CSS transforms](../../02-css/17-transforms/notes.md#performance).

## Reflow vs repaint: what each property costs

- **Reflow** (layout) recomputes geometry. It can spread: a width change in one element can move its siblings, its parent and everything after it.
- **Repaint** redraws pixels without changing geometry.
- **Composite-only** changes neither: the existing layer bitmaps are moved or blended.

| Kind of change | Layout | Paint | Composite | Examples |
| --- | --- | --- | --- | --- |
| Geometry | Yes | Yes | Yes | `width`, `height`, `padding`, `margin`, `border-width`, `top`/`left`, `font-size`, `line-height`, `display`, `position`, flex and grid properties, adding or removing nodes, changing text, resizing the window |
| Appearance only | No | Yes | Yes | `color`, `background-color`, `background-image`, `box-shadow`, `border-radius`, `outline`, `visibility` |
| Compositor only (element on its own layer) | No | No | Yes | `transform`, `opacity`; in Chromium usually `filter` too |

Two clarifications interviewers probe:

- **Reflow is not always the whole page.** Engines track dirty subtrees and lay out only what is affected, and `contain: layout` draws a hard boundary. But a change high in the tree, or one that affects many boxes (a web font finishing loading, a class toggled on `<body>`), can still relayout everything.
- **Setting a property is cheap; the work happens later**, once per frame, when the browser updates the rendering. Ten style writes in a row cost one style and layout pass, not ten, unless you force the browser to do the work early (next section).

## Layout thrashing and forced synchronous layout

Normally the browser defers style and layout work until the next frame. But if JavaScript **reads** a geometry value after a **write** has made layout dirty, the browser must run style and layout immediately, synchronously, to return a correct number. That is a **forced synchronous layout** (DevTools calls it *Forced reflow*). Doing it repeatedly (write, read, write, read) is **layout thrashing**.

Reads that force layout when something is dirty include:

- `offsetTop/Left/Width/Height`, `clientTop/Left/Width/Height`, `scrollWidth/Height`, `scrollTop/Left`
- `getBoundingClientRect()`, `getClientRects()`
- `getComputedStyle(el)` when you read a layout-dependent value such as `width`
- `innerText`, `focus()`, `scrollIntoView()`, `window.scrollY`, `window.innerWidth`, `document.elementFromPoint()`

```js
const ruler = document.querySelector('#ruler');
const boxes = document.querySelectorAll('.box');

// ❌ read → write → read → write: one forced layout per box
for (const box of boxes) {
  const width = ruler.offsetWidth;    // read: the previous write made layout dirty, so this forces layout
  box.style.width = `${width / 8}px`; // write: makes layout dirty again
}

// ✅ read first, then write: no forced layout in the loop, one normal layout at the next frame
const width = ruler.offsetWidth;      // read once
for (const box of boxes) {
  box.style.width = `${width / 8}px`; // writes only
}
```

When each element needs its own measurement, read everything into an array first, then write in a second pass:

```js
// ✅ batch per-element reads, then writes
const heights = [...cards].map((card) => card.scrollHeight);             // all reads
cards.forEach((card, i) => { card.style.height = `${heights[i]}px`; }); // all writes
```

The demo runs both versions over 1,000 boxes and prints the time. Record it in the Performance panel: the interleaved run is one long task made of hundreds of purple *Layout* slices, each flagged "Forced reflow"; the batched run has none. The batched time printed on the page leaves out the single layout the browser does afterwards, at the next frame, which the recording does show.

Ways to avoid thrashing:

- Separate reads from writes, as above. In a large app where independent components read and write on their own, a small scheduler (the `fastdom` library is the classic one) queues reads and writes and flushes them in two phases per frame.
- Read in event handlers before any writes; do visual writes in `requestAnimationFrame`.
- Prefer CSS (and `transform`) to measuring in JavaScript.
- Use `ResizeObserver` and `IntersectionObserver` instead of polling sizes and positions: they deliver measurements at a point in the frame where layout is already up to date. See [Observers, history and workers](../06-observers-history-workers/notes.md).

## `requestAnimationFrame`

`requestAnimationFrame(callback)` asks the browser to run `callback` **once, just before the next frame is rendered**: after the current task and its microtasks, and before that frame's style, layout and paint. That makes it the right place for visual updates:

- It runs at the display's refresh rate (60 Hz: every ~16.7 ms; 120 Hz: every ~8.3 ms), so you never do work for a frame that will not be shown.
- It is paused in background tabs and hidden iframes.
- The callback receives a high-resolution timestamp, so animations can be time-based rather than frame-count based.
- Writes made in it are picked up by the very next frame.

```js
const box = document.querySelector('.box');
const duration = 1000;
let start;

function step(timestamp) {
  start ??= timestamp;
  const progress = Math.min((timestamp - start) / duration, 1); // 0 → 1 over one second
  box.style.transform = `translateX(${progress * 300}px)`;
  if (progress < 1) requestAnimationFrame(step);                // schedule the next frame
}
requestAnimationFrame(step);
```

It also throttles a high-frequency event to at most one update per frame:

```js
let scheduled = false;
window.addEventListener('scroll', () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    header.classList.toggle('is-compact', window.scrollY > 100);
  });
}, { passive: true });
```

| | `setTimeout(fn, 16)` / `setInterval` | `requestAnimationFrame(fn)` |
| --- | --- | --- |
| Runs | As a task when the timer fires; drifts relative to frames | Right before rendering, once per frame |
| Rate | A fixed guess | Matches the display |
| Background tab | Throttled (about once per second or less), but keeps running | Paused |
| Use for | Delays, timeouts, non-visual work | Animation, visual updates, batching DOM writes |

`cancelAnimationFrame(id)` cancels a pending callback. For where rendering sits among tasks and microtasks, see [The event loop](../../03-javascript/19-event-loop/notes.md). For most animations, CSS transitions and animations or the Web Animations API (`element.animate()`) beat a hand-written loop, because composite-only ones can run off the main thread.

## Skipping rendering work: `contain` and `content-visibility`

**`contain`** promises the browser that an element's insides do not affect the outside, so it can limit style, layout and paint work to that subtree.

| Value | Promise |
| --- | --- |
| `layout` | Nothing inside affects layout outside (the element also becomes a containing block) |
| `paint` | Nothing inside is painted outside the element's box (like `overflow: clip`) |
| `size` / `inline-size` | The element's size does not depend on its children, so you must size it yourself |
| `style` | Counters and quotes do not escape the subtree |
| `content` | `layout paint style`: a safe default for independent widgets |
| `strict` | `size layout paint style` |

Container queries use the same mechanism: `container-type: inline-size` applies inline-size containment (see [Media and container queries](../../02-css/15-media-and-container-queries/notes.md)).

**`content-visibility: auto`** goes further: while an element is off-screen, the browser **skips its style, layout and paint entirely**, and renders it only as it approaches the viewport. On long pages (articles, feeds, documentation, long settings screens) this can cut initial rendering time dramatically.

```css
.feed-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 600px; /* placeholder height while skipped; "auto" remembers the real size once rendered */
}
```

- Without `contain-intrinsic-size`, a skipped section is 0 px tall, so the scrollbar jumps as sections render. The placeholder fixes that, and `auto` makes the browser remember the last rendered size.
- Skipped content stays in the DOM and the accessibility tree, and find-in-page and anchor links still work. That is the big difference from a virtualised list, where off-screen rows do not exist at all.
- `content-visibility: hidden` keeps the content unrendered (like `display: none`) but caches its rendering state, so showing it again is cheaper.
- Support: Chromium since 2020, Firefox and Safari since 2024 (Baseline since September 2024). Older browsers ignore it, so it is safe as progressive enhancement.

## The critical rendering path and how to shorten it

The **critical rendering path** (CRP) is the work between receiving the HTML and the first paint: HTML → DOM, CSS → CSSOM, style, layout, paint. Three numbers govern how long it takes:

- **Critical resources:** how many resources block the first paint (render-blocking CSS, parser-blocking scripts in `<head>`).
- **Critical bytes:** how much those resources weigh.
- **Critical path length:** how many sequential round trips it takes to fetch them. A CSS `@import` adds one; a font discovered from CSS adds one.

How to shorten it, roughly in order of impact:

1. **Fast HTML.** Low TTFB (CDN, server-side caching, no redirect chains), and stream the `<head>` early.
2. **Fewer render-blocking bytes.** Remove unused CSS, split CSS by media (`media="print"`, `media="(min-width: 64em)"`), never chain `@import`.
3. **Inline the critical CSS** for above-the-fold content into a `<style>` in the `<head>` (keep it small: the first round trip carries roughly 14 KB compressed) and load the rest without blocking:

   ```html
   <style>/* critical above-the-fold rules */</style>
   <link rel="stylesheet" href="/css/site.css" media="print" onload="this.media='all'">
   <noscript><link rel="stylesheet" href="/css/site.css"></noscript>
   ```

   The inline `onload` handler is blocked by a strict Content Security Policy unless you allow it with a hash: see [Security: XSS, CSRF and CSP](../04-security-xss-csrf-csp/notes.md). Extraction tooling and trade-offs are in [Critical CSS](../05-web-performance/notes.md#critical-css).
4. **No parser-blocking scripts in `<head>`.** `defer` or `type="module"` for app code, `async` for independent third parties.
5. **Help discovery.** `preload` late-discovered critical resources, `preconnect` to critical third-party origins, `fetchpriority="high"` on the LCP image, and `103 Early Hints` from the server so preloads start while the HTML is still being generated.
6. **Fewer bytes overall.** Brotli or gzip, minification, modern image formats, subset fonts with `font-display: swap` or `optional`.

## Using the DevTools Performance panel

Chrome's Performance panel is where the pipeline becomes visible.

1. Open the panel. Its landing view shows **live metrics** (LCP, CLS, INP) for your local session, next to real-user field data when Google has it for the URL.
2. Turn on **CPU throttling** (4× or 6×) and network throttling: a developer laptop is many times faster than a mid-range phone.
3. Click **Record**, perform the interaction, then stop. For page load, use **Record and reload**.
4. Read the **Main** track as a flame chart. Grey **Task** bars with a red corner are **long tasks** (over 50 ms) that block input.
5. Click a purple **Layout** entry. A "Forced reflow" warning with a link to the JavaScript line that triggered it means layout thrashing.
6. Check the **Insights** sidebar in recent Chrome versions for ready-made diagnoses such as render-blocking requests, the LCP breakdown by phase and layout shift culprits, and the **Bottom-Up** and **Call Tree** tabs for which functions take the time.

| Colour | Category | Typical entries |
| --- | --- | --- |
| Yellow | Scripting | Event handlers, timers, `Function call`, `Evaluate script` |
| Purple | Rendering | Recalculate Style, Layout, Pre-paint, Layerize |
| Green | Painting | Paint, Commit, Raster |
| Blue | Loading | Parse HTML |
| Grey | System | Browser work outside your code |

Other tools that show the pipeline:

- **Rendering** drawer (⋮ menu → More tools → Rendering): *Paint flashing* highlights repainted areas in green, plus *Layout shift regions*, *Layer borders*, *Frame rendering stats*, and emulation of `prefers-reduced-motion` and `prefers-color-scheme`.
- **Layers** panel (More tools → Layers): every compositing layer, its memory cost and *why* it was composited.

Lab recordings tell you what is possible; field data tells you what users get. Collect Core Web Vitals from real users with the `web-vitals` library and, in Chromium, the Long Animation Frames API (`PerformanceObserver` with type `long-animation-frame`), which attributes slow frames to the scripts that caused them.

## Common Mistakes

- **Animating layout properties** (`top`, `left`, `width`, `height`, `margin`) or using `transition: all`, instead of animating `transform` and `opacity`.
- **Interleaving DOM reads and writes in a loop**, often hidden inside helper functions or spread across components that each "just measure once".
- **Adding `will-change` or `translateZ(0)` to many elements "for performance"**, causing a layer explosion and high GPU memory use, or leaving `will-change` on permanently.
- **Hiding critical resources from the preload scanner**: the hero image as a CSS background, fonts without `preload`, CSS `@import`, scripts injected by a loader.
- **Leaving a classic `<script>` in `<head>`** and assuming that placing it after the CSS is harmless: it now waits for the CSS as well as blocking the parser.
- **Using `setTimeout` or `setInterval` for animation** instead of CSS animations or `requestAnimationFrame`.
- **Using `content-visibility: auto` without `contain-intrinsic-size`**, so the scrollbar jumps and the page shifts as sections render.
- **Inlining all the CSS** (or a huge "critical" chunk) into every page, which bloats the HTML and throws away caching across pages.
- **Profiling only on a fast machine without CPU throttling**, or trusting a single lab run instead of field data.

## Key Takeaways

- HTML is parsed into the DOM and CSS into the CSSOM; every frame then runs style → layout → paint → composite, and a change pays for its own stage and every stage after it.
- CSS is render-blocking (and blocks later classic scripts); classic scripts are parser-blocking. `defer`/modules fix the scripts; less, split and inlined critical CSS fixes the CSS.
- The preload scanner only sees resources in the markup. Preload critical resources that are discovered late.
- `transform` and `opacity` on a layer are composite-only and can animate off the main thread; layers cost memory, so use `will-change` sparingly and temporarily.
- Reading geometry after a write forces a synchronous layout. Batch reads before writes and do visual writes in `requestAnimationFrame`.
- `contain` and `content-visibility: auto` let the browser skip work for independent or off-screen subtrees.
- Measure with the Performance panel and CPU throttling, then confirm with field data.

## Interview Questions

### Junior (0–1 year)

**Q1. What happens between the browser receiving HTML and showing pixels on screen?**
The parser turns the HTML into the DOM, requesting subresources as it finds them. CSS is parsed into the CSSOM. The browser then computes each element's style (style), works out the size and position of every box (layout), records drawing commands and fills in pixels (paint), and combines the painted layers into the final frame (composite). The first frame with content is First Contentful Paint.

**Q2. What are the DOM, the CSSOM and the render tree? Is a `display: none` element in the render tree?**
The DOM is the tree of nodes built from the HTML. The CSSOM is the parsed form of the stylesheets. The render tree combines them: the elements that will generate boxes, each with its computed style. A `display: none` element (and everything inside it) is in the DOM but generates no boxes. A `visibility: hidden` element does generate a box: it takes up space but is not painted.

**Q3. Why is CSS called render-blocking, and why do browsers do that on purpose?**
The browser will not paint until the stylesheets in the `<head>` have downloaded and been parsed. If it painted earlier, users would see unstyled content that then jumps into place (a "flash of unstyled content"). The cost is that a slow or large stylesheet delays the first paint, so keep render-blocking CSS small and fast.

**Q4. What is the difference between reflow and repaint? Give examples of each.**
Reflow (layout) recalculates the size and position of boxes, for example after changing `width`, `font-size`, `padding`, adding elements or resizing the window, and it is always followed by a repaint. Repaint redraws pixels without changing geometry, for example after changing `color`, `background-color` or `box-shadow`. Reflow is more expensive because it can affect many other elements.

**Q5. Why should you animate `transform` and `opacity` rather than `left` or `width`?**
Changing `left` or `width` triggers layout and paint on every frame, on the main thread, which is easily too slow for 60 frames per second. `transform` and `opacity` on an element with its own layer only need compositing: the browser moves or fades an existing bitmap, often on the GPU and on the compositor thread, so the animation stays smooth even when JavaScript is busy.

**Q6. What is `requestAnimationFrame`, and why is it better than `setInterval` for animation?**
It schedules a callback to run once right before the browser renders the next frame. Unlike `setInterval`, it is synchronised with the display's refresh rate, so you never compute frames that are never shown or miss frames through timer drift. It is paused in background tabs, and the callback receives a timestamp for time-based animation. You call it again inside the callback for the next frame.

### Mid-level (2–4 years)

**Q7. What is the preload scanner, which resources can it not discover, and how do you help it?**
It is a secondary, lightweight parser that scans ahead through the raw HTML and starts downloading resources referenced in markup while the main parser is blocked by a script. It cannot see resources that only exist after CSS or JavaScript runs: CSS background images, fonts from `@font-face`, `@import`ed stylesheets, script-injected scripts and `data-src` lazy images. For critical ones, put a `<link rel="preload">` (with `as`, and `crossorigin` for fonts) in the `<head>`, or better, reference the resource directly in markup, for example an `<img>` with `fetchpriority="high"` instead of a CSS background for the LCP image.

**Q8. What is wrong with this code, and how do you fix it?**

```js
items.forEach((item) => {
  item.style.height = `${item.parentElement.offsetHeight / 2}px`;
});
```

Each iteration reads `offsetHeight` after the previous iteration wrote a height, so every read forces a synchronous style and layout pass: layout thrashing, with a cost proportional to the number of items times the size of the layout. Read all values first, then write:

```js
const heights = [...items].map((item) => item.parentElement.offsetHeight); // reads
items.forEach((item, i) => { item.style.height = `${heights[i] / 2}px`; }); // writes
```

If the parent is the same for every item, read it once outside the loop. DevTools shows the problem as many *Layout* entries marked "Forced reflow".

**Q9. A classic `<script src="app.js">` comes after `<link rel="stylesheet" href="big.css">` in the `<head>`. The CSS takes 2 s and the script 200 ms. When does the script run, and what do users see?**
The script downloads in parallel (the preload scanner found it), but it does not execute until `big.css` has loaded, because a classic script may query styles. The parser is blocked at the script the whole time, so nothing in the `<body>` is parsed or painted for about 2 s. Fix it by adding `defer` to the script and reducing or splitting the render-blocking CSS.

**Q10. What gives an element its own compositing layer, and why not add `will-change: transform` to everything?**
`will-change: transform` or `opacity`, 3D transforms, running transform or opacity animations, `<video>`, WebGL canvases, iframes, scroll containers, and overlapping an already composited element. Each layer is a GPU texture costing roughly width × height × 4 bytes, and many layers increase memory use and compositing time; on low-end devices a layer explosion can crash tabs or slow everything down. `will-change` also creates a stacking context and a containing block for fixed-position descendants. Apply it only to elements that are about to animate, and remove it afterwards.

**Q11. What does `content-visibility: auto` do, and what do you need to pair it with?**
It lets the browser skip style, layout and paint for an element's contents while the element is off-screen, and render them when they approach the viewport, which can make long pages render much faster. Pair it with `contain-intrinsic-size` (ideally `auto <estimate>`) so skipped sections keep a placeholder size; otherwise they collapse to 0 px and the scrollbar jumps. The content stays in the DOM and accessibility tree, so find-in-page and anchors still work. Browsers without support ignore it.

**Q12. A spinner animated with a CSS `transform` animation keeps spinning during a 2-second JavaScript task, but a progress bar animated with `requestAnimationFrame` freezes. Why?**
A CSS animation of `transform` (or `opacity`) on a composited layer can be run by the compositor thread, which does not need the main thread for each frame. The `requestAnimationFrame` callback is JavaScript, so it runs on the main thread and cannot run until the long task finishes. To keep visuals smooth, prefer CSS or Web Animations API animations of composite-only properties, and break long tasks up (or move the work to a Web Worker).

**Q13. First Contentful Paint is slow on a page. How do you find out why, and what are the usual fixes?**
Record a page load with network and CPU throttling in the Performance panel (or run Lighthouse), and look at what happens before FCP: TTFB, the render-blocking requests in the network track, and any long parser-blocking scripts. Usual fixes: reduce TTFB (CDN, caching, no redirects); defer scripts in the `<head>`; shrink render-blocking CSS by removing unused rules, splitting by media and inlining the critical part; remove `@import` chains; preconnect to critical third-party origins; and preload late-discovered critical resources such as fonts.

### Senior (5+ years)

**Q14. After a release, users report that scrolling a large dashboard feels janky, but it is fine on your machine. How do you investigate and fix it?**
Start with field data: INP and Long Animation Frames from real users, segmented by device class and release, to confirm the regression and find the pages and interactions affected. Reproduce in the lab with 4–6× CPU throttling (or a real mid-range Android device), record a scroll in the Performance panel, and look for long tasks during scrolling, forced reflows from scroll or resize handlers, large *Paint* entries (turn on *Paint flashing*), and an exploding layer count in the Layers panel. Typical culprits are non-passive scroll listeners doing layout reads, a `box-shadow` or `filter` repainting on every frame, `will-change` added to every card, or a huge DOM that makes every style recalculation slow.

Fix the specific cause (passive listeners, rAF-throttled handlers, observers instead of measurement, composite-only effects, `content-visibility` or virtualisation for the large list), then guard against recurrence: add the scenario to a performance test in CI and alert on the field metric. Recommendation: always confirm with field data, profile under throttling, and fix the root cause rather than sprinkling `will-change`.

**Q15. You own a component library used by many teams. How do you make animations and transitions performant by default, and keep them that way?**
Make the fast path the easy path. Ship motion tokens (durations, easings) and ready-made transition utilities that only animate `transform` and `opacity`, components whose open and close animations are built that way (for example a drawer that slides with `translate`, an accordion that animates a composited wrapper or uses a known pattern), and a `prefers-reduced-motion` fallback built in. Avoid exposing a generic "animate any property" API.

Enforce it with tooling rather than review comments: Stylelint rules that disallow `transition: all` and transitions on layout properties, a lint rule against hand-written `will-change` outside the library, visual and performance tests in the library's Storybook, and a Lighthouse CI or WebPageTest budget on a reference app. Recommendation: encode the rules in tokens, components and linters, and document the reasoning (the pipeline stages) once, so teams understand why the rule exists.

**Q16. Should you inline critical CSS? What are the trade-offs, and when would you not do it?**
Inlining the above-the-fold CSS removes a render-blocking round trip, which helps FCP and LCP on first visits, especially on slow networks. The costs: the inlined CSS is downloaded again with every HTML response and cannot be cached separately; extraction tooling adds build complexity and can get out of sync with the page (missing rules cause a flash of unstyled or shifted content and hurt CLS); and the non-blocking load trick for the rest needs care with CSP.

Inline when first visits dominate and the HTML is the critical path: landing pages, marketing and content sites, SEO traffic. Do not bother for an authenticated app shell with mostly repeat visitors, where a well-cached, fingerprinted external stylesheet served over HTTP/2 or HTTP/3 (plus `103 Early Hints` or preload) is close to free after the first load. Recommendation: measure first-visit LCP in the field, keep render-blocking CSS small in all cases, and inline only where the data shows first visits matter.

**Q17. A page must show a table of 10,000 rows. Would you use virtualisation, `content-visibility`, or pagination?**
Pagination (or server-side filtering) is the simplest and most accessible, and often what users actually need: question the requirement first. If the rows must be scrollable in one list, `content-visibility: auto` on row groups keeps every row in the DOM, so find-in-page, anchors, screen readers and SEO keep working, but the DOM is still 10,000 rows of memory and style work, which is fine for thousands of simple rows and too much for heavy rows or slow devices.

Virtualisation (rendering only the visible rows plus a buffer) keeps the DOM small and scales to hundreds of thousands of rows, but breaks find-in-page and printing, needs `aria-rowcount`/`aria-rowindex` and careful focus management for accessibility, and complicates variable row heights and scroll restoration. Recommendation: paginate or filter if the product allows it; use `content-visibility` up to a few thousand moderate rows; reach for a well-tested virtualisation library (with accessibility handled) only when profiling on target devices shows the DOM size itself is the bottleneck.

> **Note:** Related questions answered elsewhere: [The event loop](../../03-javascript/19-event-loop/notes.md#interview-questions) (where `requestAnimationFrame` runs relative to tasks and microtasks); [Web performance](../05-web-performance/notes.md#interview-questions) (long tasks, INP triage and performance budgets).

## References

- [web.dev Learn Performance: Understand the critical path](https://web.dev/learn/performance/understanding-the-critical-path)
- [web.dev: Avoid large, complex layouts and layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)
- [web.dev: Stick to compositor-only properties and manage layer count](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)
- [web.dev: Don't fight the browser preload scanner](https://web.dev/articles/preload-scanner)
- [web.dev: content-visibility](https://web.dev/articles/content-visibility)
- [MDN: Populating the page: how browsers work](https://developer.mozilla.org/en-US/docs/Web/Performance/How_browsers_work)
- [MDN: Critical rendering path](https://developer.mozilla.org/en-US/docs/Web/Performance/Critical_rendering_path)
- [MDN: window.requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN: will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)
- [MDN: contain](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)
- [MDN: content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)
- [Chrome for Developers: RenderingNG architecture](https://developer.chrome.com/docs/chromium/renderingng-architecture)
- [Chrome for Developers: Performance panel reference](https://developer.chrome.com/docs/devtools/performance/reference)
- [HTML Standard: Parsing HTML documents](https://html.spec.whatwg.org/multipage/parsing.html)
