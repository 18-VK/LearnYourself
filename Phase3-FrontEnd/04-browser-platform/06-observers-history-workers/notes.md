# Observers, History API and Workers

> Browser platform · Topic 6 · Demo: [index.html](index.html) · [script.js](script.js) · [worker.js](worker.js) · [primes.js](primes.js) · Open index.html through a local server (Live Server): Chrome does not start workers from `file://` pages.

This note covers the browser APIs that let an app react to the page **without polling**, change the URL **without reloading**, and do work **off the main thread**. The observers (`IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `PerformanceObserver`) replace scroll listeners and timers with batched, browser-scheduled callbacks. The History API and the newer Navigation API are what every SPA router is built on. Web Workers, shared workers and service workers run JavaScript in separate threads, and service workers add offline support and installable PWAs. `BroadcastChannel` rounds it off by letting tabs talk to each other.

## Why observers exist

Before observers, "is this element visible?" meant a `scroll` listener calling `getBoundingClientRect()` on every element, many times per frame, on the main thread, which forces layout and causes jank. "Did this element change size?" meant polling. Observers invert this: you say what you care about, and the browser tells you when it changes, in batches, at a time that suits rendering. Every observer has the same shape: `new XObserver(callback, options)`, `observe(target)`, `unobserve(target)` (not on `MutationObserver`) and `disconnect()`.

| Observer | Watches | Callback timing | Typical uses |
|---|---|---|---|
| `IntersectionObserver` | How much of an element overlaps the viewport (or a scroll container) | Asynchronously after rendering, when a threshold is crossed | Lazy loading, infinite scroll, impression tracking, scroll-spy, pausing off-screen video |
| `ResizeObserver` | An element's content/border box size | After layout, before paint, in the same frame | Charts and canvas sizing, virtualised lists, "is this text truncated?" |
| `MutationObserver` | DOM changes: children, attributes, text | As a microtask after the mutating script | Reacting to DOM you do not control, waiting for an element to appear |
| `PerformanceObserver` | Performance entries (LCP, layout shifts, long frames, resources) | Asynchronously, when entries are recorded | Real-user monitoring |

## IntersectionObserver

```js
const observer = new IntersectionObserver(callback, {
  root: null,                 // null = the viewport; or a scrollable ancestor element
  rootMargin: "200px 0px",    // grow (or shrink, with negatives) the root box, like CSS margin
  threshold: [0, 0.5, 1],     // fire when the visible ratio crosses 0%, 50%, 100%
});

function callback(entries, observer) {
  for (const entry of entries) {
    entry.target;             // the observed element
    entry.isIntersecting;     // true when it overlaps the (expanded) root
    entry.intersectionRatio;  // 0..1, fraction of the target that is visible
    entry.boundingClientRect; // the target's rectangle, computed for you (no forced layout)
  }
}

observer.observe(document.querySelector(".card"));
```

- The callback fires **once immediately** after `observe()` with the current state, then only when a threshold is crossed. It does not fire continuously while scrolling.
- `rootMargin` starts work early: `"200px 0px"` reports elements 200 px before they reach the viewport, so images are loaded by the time they appear. It only accepts `px` and `%`.
- One observer can watch many elements; share it for all elements with the same options.

### Lazy loading

For plain images and iframes, native `loading="lazy"` is simpler and needs no JavaScript (see [Web performance](../05-web-performance/notes.md)). Use an observer for things native lazy loading cannot do: custom scroll containers, components, background images, or choosing your own distance. The demo's `lazyObserver` lazy-loads images inside a scrolling box, so it passes that box as `root` with `rootMargin: "100px 0px"`; when an image intersects it copies `img.dataset.src` into `img.src` and calls `observer.unobserve(img)`, so each image loads once and stops being watched.

### Infinite scroll with a sentinel

Observe one empty element after the last item instead of every item:

```js
const sentinel = document.querySelector("#sentinel"); // an empty div after the list
let loading = false;

const loadMore = new IntersectionObserver(async ([entry]) => {
  if (!entry.isIntersecting || loading) return;
  loading = true;
  const items = await fetchNextPage();
  if (items.length === 0) {
    loadMore.disconnect();                 // nothing left: stop observing
  } else {
    list.append(...items.map(renderItem));
    loadMore.unobserve(sentinel);          // re-observe so we get a fresh initial callback:
    loadMore.observe(sentinel);            // if the sentinel is STILL visible, load again
  }
  loading = false;
}, { rootMargin: "0px 0px 600px 0px" });

loadMore.observe(sentinel);
```

The re-observe trick matters: if one page of results does not fill the screen, the sentinel never stops intersecting, so no new callback would fire and loading would stall. Also consider a "Load more" button: endless lists make the footer unreachable and are hard for keyboard and screen-reader users.

### Impression tracking

"Seen" usually means at least 50% visible for at least one second (the common display-ad definition). The demo's `script.js` implements it with `threshold: 0.5`: when a card starts intersecting it starts a 1-second timer, when the card leaves it clears the timer, and when the timer fires it records the impression and calls `unobserve(card)` so each card counts once. Batch the analytics calls and send them with `navigator.sendBeacon` so impressions are not lost when the page closes.

> **Note:** An element covered by another element (a modal, a sticky banner) still counts as "intersecting". Intersection Observer v2 (`trackVisibility`, Chromium only) checks real visibility, mainly for ad and anti-clickjacking use.

## ResizeObserver

`ResizeObserver` reports size changes of **an element**, whatever caused them: window resize, sidebar collapse, content loading, font swap. `window.onresize` only knows about the viewport.

```js
const ro = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { inlineSize, blockSize } = entry.contentBoxSize[0]; // width and height in horizontal writing
    chart.resize(inlineSize, blockSize);
  }
});
ro.observe(document.querySelector(".chart-container"));
```

- `contentBoxSize`, `borderBoxSize` and `devicePixelContentBoxSize` (exact device pixels, for crisp canvas drawing) are arrays because an element can be split into fragments; for normal elements use `[0]`. `contentRect` is the older API.
- The callback runs after layout and before paint, so changes you make appear in the same frame without flicker.
- If your callback changes the size of observed elements, the browser processes deeper elements again, and when it gives up it fires the error **"ResizeObserver loop completed with undelivered notifications"**. It is usually harmless but means you have a feedback loop. The demo writes the size readout **outside** the observed box for this reason.

### ResizeObserver vs container queries

[Container queries](../../02-css/15-media-and-container-queries/notes.md) let CSS respond to a parent's size. For styling, they are better than a ResizeObserver toggling classes: no JavaScript, no flash before the script runs, and they work with server rendering. (The demo's ResizeObserver switches the box to a stacked layout only to show the API; in a real component that part would be a container query, and the observer would only drive the size readout.)

| Need | Use |
|---|---|
| Change layout, font size or visibility based on the component's width | Container queries |
| Redraw a canvas or chart at a new pixel size | ResizeObserver |
| Recalculate how many rows fit in a virtualised list | ResizeObserver |
| Detect whether text is truncated, to show a tooltip | ResizeObserver (compare `scrollWidth` and `clientWidth`) |
| Tell a parent page an embedded iframe's content height | ResizeObserver inside the iframe + `postMessage` |

## MutationObserver

```js
const mo = new MutationObserver((records) => {
  // each record: type ("childList" | "attributes" | "characterData"), addedNodes, attributeName...
  for (const record of records) console.log(record.type, record.target);
});
mo.observe(container, {
  childList: true,          // children added or removed
  subtree: true,            // ...anywhere below container
  attributes: true,
  attributeFilter: ["class", "aria-expanded"], // only these attributes
});
```

Mutations are **batched**: many DOM changes in one script produce one callback with many records, delivered as a microtask after the script. The demo's log counter is a MutationObserver on the log list.

Good uses: reacting to DOM you do not own (a third-party widget, a CMS), waiting for an element to appear, syncing state with attributes changed by other code. In your own components, prefer explicit events or a custom element's `attributeChangedCallback`.

```js
function waitForElement(selector, root = document) {
  return new Promise((resolve) => {
    const existing = root.querySelector(selector);
    if (existing) return resolve(existing);
    const mo = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        mo.disconnect();
        resolve(el);
      }
    });
    mo.observe(root, { childList: true, subtree: true });
  });
}

waitForElement("#cookie-banner").then((banner) => banner.classList.add("restyled"));
```

Pitfalls: a callback that changes the nodes it observes triggers itself again (an infinite loop if each run mutates); and `subtree: true` on `document.body` in a busy app delivers thousands of records, so keep callbacks cheap and scope the target narrowly.

## PerformanceObserver

`PerformanceObserver` delivers performance entries as they are recorded: `largest-contentful-paint`, `layout-shift`, `event` (interactions), `long-animation-frame`, `resource`, `navigation`, `paint`. Pass `buffered: true` to also receive entries recorded before you started observing, and check `PerformanceObserver.supportedEntryTypes`, because support differs by browser. How to use it for Core Web Vitals and real-user monitoring is in [Web performance](../05-web-performance/notes.md).

## The History API

The History API lets a page change the URL and add entries to the back/forward list **without loading a new document**. That is the foundation of SPA routing.

| API | Does |
|---|---|
| `history.pushState(state, "", url)` | Adds a new entry with that URL and state. No request, no page load, **no `popstate` event** |
| `history.replaceState(state, "", url)` | Replaces the current entry (for redirects, filters, scroll state) |
| `history.back()`, `forward()`, `go(n)` | Move through entries, like the browser buttons |
| `popstate` event | Fires when the user (or `back`/`go`) moves to another entry of the same document; `event.state` is that entry's state |
| `history.state` | The current entry's state |
| `history.scrollRestoration = "manual"` | Turn off the browser's automatic scroll restoration when your router handles it |

The URL must be **same-origin** (or `pushState` throws), the second argument is an unused title (pass `""`), and `state` is stored with the structured clone algorithm with a browser size cap, so keep it small: IDs and scroll positions, not data.

### How an SPA router works

```js
const routes = { "/": renderHome, "/about": renderAbout };

function render() {
  const view = routes[location.pathname] ?? renderNotFound;
  view(); // each view renders into <main> and sets document.title
}

// 1. Intercept same-origin link clicks (event delegation)
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[href]");
  if (!link || link.origin !== location.origin) return;            // external link: let it go
  if (link.target || link.hasAttribute("download")) return;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab etc.
  e.preventDefault();
  history.pushState({}, "", link.href);  // 2. change the URL without loading
  render();                              // 3. render the new route ourselves
});

// 4. Back/forward: the browser changed the URL, we re-render
window.addEventListener("popstate", render);

render(); // initial route
```

Delegation is covered in [Events and delegation](../../03-javascript/24-events-and-delegation/notes.md). A production router also moves focus to the new content (or announces the route change) for screen-reader users, updates the title, restores scroll position and cancels data loading for a route the user already left.

**The server must cooperate.** `/products/42` only exists in your JavaScript. If the user refreshes or opens that URL directly, the server gets a request for `/products/42` and must return `index.html` (an "SPA fallback": nginx `try_files $uri /index.html;`, or a rewrite rule on your static host), while real missing files still return 404.

### Hash routing

| | History routing (`/products/42`) | Hash routing (`/#/products/42`) |
|---|---|---|
| Server configuration | Needs the SPA fallback | None: the fragment is never sent to the server |
| URLs | Clean | `#` in every URL |
| Event | `popstate` | `hashchange` |
| SEO and server rendering | Works (each URL can be server-rendered) | Poor: the server sees only `/` |
| In-page anchors (`#section`) | Work normally | Conflict with the routes |

Hash routing is fine for static hosting without rewrite rules, demos and internal tools; use history routing for anything public.

## The Navigation API

The History API was not designed for apps: `popstate` fires only for back/forward, link clicks and form submissions must be intercepted separately, and you cannot see the list of entries. The **Navigation API** (`window.navigation`) replaces all of that with **one `navigate` event for every navigation**: link clicks, form submissions, back/forward, `location.href = ...` and `navigation.navigate()`.

```js
navigation.addEventListener("navigate", (event) => {
  if (!event.canIntercept || event.hashChange || event.downloadRequest !== null) return;
  const url = new URL(event.destination.url);
  const route = routes[url.pathname];
  if (!route) return; // unknown route: let the browser do a normal page load

  event.intercept({
    async handler() {
      // URL is already updated; the browser shows loading UI until this promise settles
      await route({ signal: event.signal }); // aborted if the user navigates again
    },
  });
});
```

Benefits over the History API: no click-interception code, an `AbortSignal` for stale navigations, built-in focus and scroll handling after the handler, programmatic `navigation.navigate(url)` and `navigation.back()` that return promises, readable history (`navigation.entries()`, `currentEntry.getState()`), and `navigatesuccess`/`navigateerror` events for analytics and error UI.

**Support:** Chromium since 2022, Safari 26.2 (December 2025) and Firefox 147 (January 2026), so it became **Baseline newly available in January 2026**. Some newer parts are not yet in every engine, and users on older browsers will be around until it is widely available (expected around 2028). Feature-detect with `"navigation" in window` and keep a History API fallback, which is what routers are doing.

## Web Workers

A **dedicated worker** runs a script in a separate thread, with its own global scope (`self`) and its own event loop. It cannot touch the page; it communicates only through messages.

```js
// main thread
const worker = new Worker(new URL("./prime-worker.js", import.meta.url), { type: "module" });
worker.postMessage({ type: "count-primes", limit: 5_000_000 });
worker.addEventListener("message", (event) => console.log(event.data)); // → { type: "primes-result", count: 348513 }
worker.addEventListener("error", (event) => console.error(event.message));

// prime-worker.js (a module worker)
import { countPrimes } from "./math.js";
self.addEventListener("message", (event) => {
  const count = countPrimes(event.data.limit);
  self.postMessage({ type: "primes-result", count });
});
```

- `{ type: "module" }` makes it a **module worker** that can use `import` (supported in all current browsers since 2023). The `new URL("./prime-worker.js", import.meta.url)` pattern lets bundlers find and bundle the worker file. Classic workers, like the demo's `worker.js`, load helpers with `importScripts("primes.js")` instead.
- **Available** in workers: `fetch`, WebSockets, IndexedDB, the Cache API, timers, `crypto`, `OffscreenCanvas`. **Not available**: the DOM, `window`, `document`, `localStorage`/`sessionStorage`, `alert`.
- Stop a worker with `worker.terminate()` from the page or `self.close()` inside it.

### Structured clone and transferables

`postMessage` **copies** data with the structured clone algorithm (also available directly as `structuredClone()`):

| Cloned fine | Fails or changes |
|---|---|
| Primitives (except symbols), plain objects, arrays | Functions, DOM nodes, symbols → `DataCloneError` |
| `Date`, `RegExp`, `Map`, `Set`, `BigInt`, `Error` types | Class instances arrive as plain objects (prototype and methods lost) |
| `ArrayBuffer`, typed arrays, `Blob`, `File`, `ImageData` | Getters are evaluated; property descriptors are lost |
| Circular references | |

Copying a large buffer costs time and memory. **Transferable** objects can be moved instead: ownership passes to the receiver in constant time, and the sender's copy becomes unusable ("detached"):

```js
const buffer = new ArrayBuffer(32 * 1024 * 1024);
worker.postMessage({ type: "buffer", buffer }, [buffer]); // second argument: the transfer list
console.log(buffer.byteLength); // → 0 (detached: the worker owns it now)
```

Transferables include `ArrayBuffer`, `MessagePort`, `ImageBitmap`, `OffscreenCanvas`, streams and `VideoFrame`. The demo's "Transfer" button logs the byte length before and after. True shared memory is `SharedArrayBuffer` with `Atomics`, which requires cross-origin isolation (`COOP` + `COEP` headers, see [Security](../04-security-xss-csrf-csp/notes.md)).

### When to use a worker

Use one for CPU-heavy work that would otherwise block the main thread for more than ~50 ms and that does not need the DOM: parsing or transforming large data, search indexing and fuzzy search, image and audio processing, compression, syntax highlighting, diffing, WebAssembly. Do not use one for small tasks or DOM-heavy work: starting a worker costs time and memory, and every message is copied. A small RPC library such as Comlink hides the message plumbing behind `await api.method()` calls. Try the demo's two buttons: on the main thread the `requestAnimationFrame` dot and the text box freeze for about two seconds; in the worker they keep running.

## SharedWorker

A `SharedWorker` is one worker instance shared by all same-origin pages that create it with the same URL. Each page talks to it through a `MessagePort`:

```js
// page
const shared = new SharedWorker("/shared.js");
shared.port.onmessage = (event) => console.log("from shared worker:", event.data);
shared.port.postMessage({ type: "subscribe", topic: "prices" });

// shared.js: each connecting tab gets its own port
const ports = new Set();
self.onconnect = ({ ports: [port] }) => {
  ports.add(port);
  port.onmessage = (msg) => ports.forEach((p) => p.postMessage(msg.data)); // broadcast to every tab
};
```

Typical use: one WebSocket connection or one in-memory cache for all open tabs instead of one per tab. It lives while at least one connected page is open, and there is no simple event telling you a tab has gone, so long-lived designs add heartbeats. Support caveat: Safari re-added it in version 16, and Chrome for Android lacked it for years and only began enabling it in 2026, so check support before depending on it on mobile.

## Service Workers

A service worker is a worker that sits **between your pages and the network** for its scope. It can intercept every request, answer from a cache, and receive push messages and background sync events when no page is open. It is the basis of offline support and PWAs.

```js
// page: register after load, so it does not compete with the first load
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js")); // scope: "/"
}
```

### Lifecycle

```text
register("/sw.js") → download and parse
   ▼
install    precache the app shell (event.waitUntil)
   ▼
waiting    an older version still controls open tabs: wait until they all close (self.skipWaiting() skips this)
   ▼
activate   delete old caches (event.waitUntil); self.clients.claim() takes control of open pages now
   ▼
fetch / push / sync events ... idle → terminated by the browser → restarted on the next event
```

```js
// sw.js
const CACHE = "static-v3";
const PRECACHE = ["/", "/css/site.css", "/js/app.js", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // not calling respondWith: the network handles it

  if (request.mode === "navigate") {
    // network first for pages, offline page as the fallback
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  const fromNetwork = fetch(event.request).then((response) => {
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  });
  event.waitUntil(fromNetwork.catch(() => {})); // keep the worker alive until the cache update ends
  return cached ?? fromNetwork;
}
```

- **Scope:** a worker controls pages under the folder its script is served from. `/js/sw.js` can only control `/js/...`, so serve it from the root (or widen it with the `Service-Worker-Allowed` header).
- **HTTPS only** (plus `localhost` for development): a service worker is a persistent proxy for your whole origin, so it must not be injectable over an insecure network.
- **No state in globals:** the browser stops idle workers and starts them again per event; use IndexedDB or the Cache API. And the first visit is not controlled (the worker installs during it) unless the worker calls `clients.claim()`.

### Caching strategies

| Strategy | How | Good for |
|---|---|---|
| Cache first | Cache, else network (and store) | Hashed static assets, fonts, versioned images |
| Network first | Network, fall back to cache when offline | HTML pages, data that must be fresh |
| Stale-while-revalidate | Answer from cache now, update the cache in the background | Avatars, non-critical API data, unhashed assets |
| Network only | Never cache | POST requests, payments, analytics |
| Cache only | Only the cache | Precached app shell in an offline-first app |

Libraries like Workbox implement these strategies, precaching with revisioned URLs, and cache expiry; most production apps use them rather than hand-written fetch handlers.

### The update flow

1. On navigation (and some other events) the browser re-fetches `sw.js`, bypassing the HTTP cache by default. If it differs by even one byte, the new version installs.
2. The new version **waits** while any tab is still controlled by the old one. Reloading a single tab is not enough, because the old page is still open while the new one loads.
3. Calling `self.skipWaiting()` activates it immediately, but then pages loaded with old HTML and JS are controlled by a worker with new caches, which can break lazy-loaded chunks.

The common pattern: when a new worker is waiting, show "A new version is available, reload"; on click, `postMessage` the waiting worker to call `skipWaiting()`, and reload the page on the `controllerchange` event.

## PWA basics

A Progressive Web App is a website that can be installed and launched like an app. The pieces are HTTPS, a **web app manifest**, and (for offline support) a service worker.

```html
<link rel="manifest" href="/manifest.webmanifest">
```

```json
{
  "name": "Task Board",
  "short_name": "Tasks",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3367d6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Installation differs by browser. **Chrome and Edge** offer an install prompt when the manifest has a name, 192 and 512 px icons, `start_url` and a `display` mode (a service worker is no longer required for the prompt), and only they fire `beforeinstallprompt` for a custom install button. **Safari** installs through Share → "Add to Home Screen" on iOS (home-screen apps get web push since iOS 16.4) and File → "Add to Dock" on macOS (Safari 17+). **Firefox** installs on Android; desktop support is limited.

## BroadcastChannel

`BroadcastChannel` sends messages to every same-origin tab, iframe and worker that opened a channel with the same name:

```js
const channel = new BroadcastChannel("auth");
channel.postMessage({ type: "logout" });          // tab A: the user logs out
channel.addEventListener("message", (event) => {  // every other tab
  if (event.data.type === "logout") location.assign("/login");
});
```

The sender does not receive its own message, messages are structured clones, and it is supported in all current browsers since 2022. The other ways for tabs to cooperate:

| Option | Good for | Limits |
|---|---|---|
| `BroadcastChannel` | Fire-and-forget events between tabs: logout, theme change, "cart updated" | No history; tabs closed or not yet open miss the message |
| `storage` event on `localStorage` | Older code; the value persists for tabs opened later | Strings only; does not fire in the tab that wrote |
| `SharedWorker` | One shared connection or state for all tabs | Support caveats on mobile (above) |
| Service worker `clients.matchAll()` + `postMessage` | Messages from the worker to all controlled pages (e.g. "new version") | Needs a service worker |
| Web Locks (`navigator.locks.request`) | Electing one "leader" tab that owns a WebSocket and broadcasts to the others | Coordination only, combine with a channel |

## Common Mistakes

- **Using `scroll` listeners with `getBoundingClientRect()`** to detect visibility, forcing layout many times per frame, instead of an `IntersectionObserver`.
- **Never calling `unobserve()` or `disconnect()`**, so observers keep elements (and closures) alive after a component is removed.
- **An infinite-scroll sentinel that stays visible after loading**, so no new callback fires and loading stops.
- **Changing an observed element's size inside its ResizeObserver callback**, causing the "ResizeObserver loop" error, or using ResizeObserver for styling that container queries handle in CSS.
- **A MutationObserver callback that mutates what it observes**, looping, or a broad `subtree` observer on `body` with expensive callbacks.
- **Expecting `pushState` to fire `popstate`** or to load anything, and **forgetting the server fallback**, so deep links 404 on refresh.
- **Posting functions, DOM nodes or class instances to a worker** (`DataCloneError` or lost methods), or using an `ArrayBuffer` after transferring it.
- **Calling `skipWaiting()` unconditionally**, so already-open pages run with mismatched caches; or never deleting old caches in `activate`.
- **Caching non-GET requests, error responses or personalised API data** in a service worker, then serving them to the wrong user or forever.

## Key Takeaways

- Observers replace polling: `IntersectionObserver` for visibility, `ResizeObserver` for element size, `MutationObserver` for DOM changes, `PerformanceObserver` for metrics. Always disconnect them when done.
- Use `rootMargin` and thresholds to load early and track meaningful visibility; re-observe the sentinel in infinite scroll; prefer container queries over ResizeObserver for pure styling.
- SPA routers are `pushState` + intercepted link clicks + `popstate`, and they need a server fallback to `index.html`. The Navigation API (Baseline since January 2026) puts every navigation into one `navigate` event; keep a History API fallback for now.
- Web Workers run CPU-heavy code off the main thread; messages are structured clones, and large buffers should be transferred, not copied.
- Service workers are a programmable network proxy (HTTPS only, scoped by their script's folder) with an install → wait → activate lifecycle; choose a caching strategy per resource type and design the update flow deliberately.
- A PWA needs HTTPS, a manifest and usually a service worker; installation UI differs a lot between browsers.
- `BroadcastChannel` is the simple way to sync tabs; combine it with Web Locks when exactly one tab must own a resource.

## Interview Questions

### Junior (0–1 year)

**Q1. Why use `IntersectionObserver` instead of a scroll listener to lazy-load images?**
A scroll listener runs many times per second on the main thread, and checking positions with `getBoundingClientRect()` forces layout each time, which causes jank. `IntersectionObserver` lets the browser compute intersections during its rendering work and calls you only when an element crosses a threshold, asynchronously and in batches. You also get `rootMargin` to start loading before the element appears. For simple images, native `loading="lazy"` is simpler still.

**Q2. What is the difference between `pushState` and `replaceState`, and does `pushState` fire `popstate`?**
Both change the URL without loading a page. `pushState` adds a new history entry, so Back returns to the previous URL; `replaceState` overwrites the current entry, which suits redirects and filter changes that should not create Back steps. `pushState` does **not** fire `popstate`; `popstate` fires only when the active entry changes through Back/Forward or `history.go()`, so the router must render after calling `pushState` itself.

**Q3. What can't a Web Worker access, and how does it communicate with the page?**
A worker has no access to the DOM, `window`, `document`, `localStorage` or `alert`. It can use `fetch`, WebSockets, IndexedDB, timers and `OffscreenCanvas`. It communicates only through `postMessage()` and the `message` event; data is copied with the structured clone algorithm, or transferred for objects like `ArrayBuffer`.

**Q4. What is a service worker, and why does it require HTTPS?**
It is a script that runs separately from your pages and acts as a proxy for every request within its scope, so it can serve responses from a cache (offline support), handle push notifications and background sync. Because it can intercept and rewrite every response for your origin and keeps running across visits, an attacker who could inject one would control the site permanently, so browsers allow it only in secure contexts (HTTPS, or `localhost` for development).

**Q5. What is the difference between hash routing and history routing?**
Hash routing puts the route after `#` (`/#/products/42`) and listens for `hashchange`; the fragment is never sent to the server, so no server configuration is needed, but URLs are less clean and the server cannot render or index individual routes. History routing uses real paths (`/products/42`) with `pushState` and `popstate`; URLs are clean and server-renderable, but the server must return `index.html` for unknown paths so deep links work.

**Q6. What does `MutationObserver` do, and when would you use it?**
It calls you back with a batch of records when the DOM changes: children added or removed, attributes changed, or text changed, optionally across a whole subtree. Callbacks run as microtasks after the mutating script. Use it to react to DOM you do not control (a third-party widget, CMS content) or to wait for an element to appear; for your own components, explicit events are clearer.

### Mid-level (2–4 years)

**Q7. How would you implement infinite scroll with `IntersectionObserver`, and what pitfalls would you handle?**
Put a sentinel element after the list and observe it with a generous bottom `rootMargin` so the next page starts loading before the user reaches the end. In the callback, ignore non-intersecting entries, guard against concurrent loads with a flag, append the new items, and stop observing when there is no more data. Pitfalls: if one page does not fill the viewport, the sentinel stays intersecting and no new callback fires, so re-observe it (or loop) after each load; handle fetch errors with a retry; keep the DOM size under control (virtualise long lists); restore scroll position on Back; and offer a "Load more" button or reachable footer for keyboard and screen-reader users.

**Q8. When would you use `ResizeObserver` instead of container queries?**
Container queries are better for anything that is purely styling: changing a card's layout or typography based on its container's width, with no JavaScript, no flash before scripts run, and server-rendering support. Use `ResizeObserver` when JavaScript actually needs the size: redrawing a canvas or chart at the new pixel size (`devicePixelContentBoxSize` for crisp output), recalculating a virtualised list, detecting text truncation, or reporting an iframe's height to its parent. Avoid changing the observed element's size in the callback, which causes the "ResizeObserver loop" error.

**Q9. What is the difference between cloning and transferring data to a worker? What happens to the original?**
By default `postMessage` copies data with the structured clone algorithm: the receiver gets an independent copy, which takes time and memory proportional to the data size, and functions, DOM nodes and class prototypes cannot be cloned. Transferring (`postMessage(data, [buffer])`) moves ownership of transferable objects such as `ArrayBuffer`, `MessagePort` or `OffscreenCanvas` in constant time; the sender's object becomes detached (`byteLength` is `0`) and can no longer be used. Transfer large binary data; clone small structured messages.

**Q10. Our SPA works when you navigate inside it, but refreshing `/orders/15` returns a 404. Why, and how do you fix it?**
Inside the app, the router changes the URL with `pushState` and renders the page in JavaScript; no request is made for `/orders/15`. On refresh, the browser asks the server for `/orders/15`, and a static server has no such file. Configure an SPA fallback: serve `index.html` for any path that does not match a real file (for example nginx `try_files $uri /index.html;` or the host's rewrite rule), while keeping genuine 404s for missing assets, and let the client router show its own "not found" page for unknown routes. Server-side rendering frameworks handle these routes on the server instead.

**Q11. After a deploy, some users keep seeing the old version of the app for days. The app has a service worker. Why, and how do you fix it?**
A new service worker installs but **waits** until every tab controlled by the old worker is closed, and the old worker keeps serving the old cached files; users who keep a tab open (or only reload it) never switch. It gets worse if `sw.js` itself was served with a long cache lifetime or the precache list is not versioned. Fix: make sure `sw.js` is not cached and that asset names or cache names change on each release; detect a waiting worker (`registration.waiting`, `updatefound`) and show a "new version available" prompt that tells the waiting worker to `skipWaiting()` and reloads on `controllerchange`; and call `registration.update()` periodically for long-lived tabs.

**Q12. Which service worker caching strategy would you use for hashed JS bundles, HTML pages, product API data, user avatars and the checkout POST?**
Hashed JS bundles: cache first (the URL changes when the content changes, so cached copies are always correct). HTML pages: network first with a cached or offline fallback, so users get fresh pages that reference the current bundles. Product API data: network first, or stale-while-revalidate if slightly stale data is acceptable and speed matters more. Avatars: stale-while-revalidate with an expiry limit. Checkout POST: network only; never cache non-GET or payment requests.

**Q13. When a user logs out in one tab, all other open tabs should log out too. How do you implement it?**
Post a message on a `BroadcastChannel` (for example `"auth"`) when logging out, and in every tab listen on the same channel and clear local state and redirect to the login page. The older alternative is writing a key to `localStorage` and listening to the `storage` event in other tabs. Also handle it on the server: invalidate the session so tabs that missed the message (asleep, offline) fail their next request and redirect, because cross-tab messaging is a UX feature, not a security boundary.

### Senior (5+ years)

**Q14. Should our in-house SPA router move to the Navigation API now? How would you approach it?**
The Navigation API is clearly the better model (one `navigate` event for links, forms and back/forward, abort signals for stale navigations, built-in focus and scroll handling), and it became Baseline in January 2026. But "newly available" means a noticeable share of users, especially on older iOS versions, still lack it, and some newer parts of the API differ between engines. A big-bang rewrite would either drop those users or force you to maintain two routers anyway.

Recommendation: put the router behind its existing public API, add a Navigation API implementation selected by feature detection with the History API implementation kept as the fallback, and run both through the same routing test suite (deep links, back/forward, scroll restoration, focus, aborted navigations). Roll out by percentage, compare error rates and navigation timings in RUM, and remove the fallback only when your analytics show it is no longer needed.

**Q15. A service worker release cached a broken bundle, and users who received it are stuck on a blank page even after you fixed the server. How do you recover, and how do you prevent it?**
Users are stuck because their worker serves the broken files from its cache and the page may be too broken to show an update prompt. Recovery relies on the fact that the browser re-checks `sw.js` on navigation, bypassing the HTTP cache: deploy a fixed worker (or a "kill switch" worker that calls `skipWaiting()`, `clients.claim()`, deletes all caches, unregisters itself and reloads the clients). The `Clear-Site-Data: "storage"` header on a response is a heavier option, since it wipes all site storage. Verify the recovery through RUM before closing the incident.

Prevention: keep the worker simple (navigation requests network-first, so a fixed server is reflected immediately), version caches and precache lists from the build, never cache error responses, test update paths from the previous release in CI, keep a tested kill-switch worker in the repo, and roll out worker changes gradually. Recommendation: treat the service worker as deploy infrastructure with its own rollback plan, not as an ordinary script.

**Q16. Your data-heavy dashboard has slow interactions because of client-side aggregation. How do you decide whether and how to move work to Web Workers?**
First profile: if long tasks come from rendering (huge DOM, chart drawing), workers do not help much; fix the rendering (virtualisation, canvas, `OffscreenCanvas`). If they come from pure computation over data (aggregation, sorting, filtering, parsing), a worker is a good fit, but measure the message cost: cloning large objects to and from the worker can cost as much as the computation. Design for it: keep the dataset **inside** the worker and send only queries and small results, transfer binary data (`ArrayBuffer`, columnar typed arrays), cancel stale requests when filters change, and consider a small pool of workers for parallel work (`SharedArrayBuffer` needs cross-origin isolation).

Wrap it in a typed, promise-based API (for example with Comlink) so components do not deal with messages, and keep a main-thread fallback for tests. Recommendation: move computation and data ownership into one long-lived worker with a narrow query API, and confirm the INP improvement in field data rather than assuming it.

**Q17. You are designing a reusable "in view" utility (for lazy loading, animations and analytics) for a design system used by many teams. What API and implementation decisions matter?**
Implementation: share one `IntersectionObserver` per unique option set (root, `rootMargin`, threshold) instead of one per component, because hundreds of observers cost more than one observer watching hundreds of elements; always unobserve on unmount; support `once` (unobserve after the first hit) as the default for lazy loading and impressions; and make it safe on the server (no `window` at import time, render the "not in view" state, then hydrate).

API: expose a small, declarative surface (`useInView({ rootMargin, threshold, once })` returning `inView` and a ref, or an `<InView>` wrapper), with presets for common cases (`lazy`, `impression` with the 50%-for-1-second rule built in, `animateOnce`) so teams do not reinvent thresholds. Respect `prefers-reduced-motion` in the animation preset, never hide content until it is in view (print, search engines and failed scripts would see nothing), and document that pure styling belongs in CSS (container queries, scroll-driven animations). Recommendation: a shared-observer implementation behind a tiny preset-based API, with accessibility and SSR behaviour built in rather than left to each team.

## References

- [MDN: Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [MDN: Resize Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Resize_Observer_API)
- [MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [MDN: History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
- [MDN: Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- [MDN: Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [MDN: The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- [MDN: Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN: Progressive web apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [MDN: Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)
- [web.dev: The service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [web.dev: Learn PWA](https://web.dev/learn/pwa)
- [web.dev: Navigation API is now Baseline Newly Available](https://web.dev/blog/baseline-navigation-api)
- [Chrome for Developers: Modern client-side routing: the Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api)
- [Chrome for Developers: Workbox](https://developer.chrome.com/docs/workbox)
- [WHATWG HTML: Web workers](https://html.spec.whatwg.org/multipage/workers.html)
- [W3C: Service Workers](https://www.w3.org/TR/service-workers/)
