# Front-end System Design

> Interview · Topic 1

A front-end system design round asks you to design a product feature or a reusable component end to end (a news feed, an autocomplete, a chat app, a data table) in 45–60 minutes, at the level of architecture rather than code. You are judged on how you scope the problem, split the UI into components, model state and data flow, define the API between client and server, and reason about performance, accessibility, real-time updates, offline behaviour and security on real devices and networks. This note gives a repeatable framework (RADIO), the building blocks you reach for in every design, and four worked designs at interview depth. It links to the deeper notes in this repo instead of re-teaching them; the hands-on counterpart is [Machine coding round](../02-machine-coding/notes.md).

## What the Round Tests

| | Backend system design | Front-end system design |
|---|---|---|
| Typical prompt | "Design the Twitter timeline service" | "Design the Twitter timeline UI", "Design an autocomplete component" |
| What has to scale | Requests per second, data volume, number of servers | One device: slow CPU, flaky network, limited memory, DOM size, users with different abilities and languages |
| Boxes on the board | Load balancers, services, databases, queues, caches | Component tree, client store, data layer and cache, service worker, the API boundary |
| Data | Schema, sharding, replication, consistency | State shape, normalisation, cache invalidation, optimistic updates |
| API | Contracts between services | The HTTP/WebSocket contract the client consumes, and the component's props and events |
| Numbers | QPS, storage, latency percentiles | Core Web Vitals, JS and payload size, items rendered, the 16 ms frame budget |
| Cross-cutting concerns | Availability, durability, cost | Accessibility, i18n, performance, XSS and auth, offline, observability |

What interviewers grade:

- **Scoping:** you ask about users, devices, data size and must-have features before drawing anything.
- **Structure:** you cover the whole system first, then go deep where it matters.
- **Trade-offs with decisions:** "cursor pagination, because posts are inserted at the top constantly", not a list of options.
- **Product sense:** loading, empty, error and offline states; perceived performance.
- **Accessibility and performance as design inputs,** not closing remarks.
- **Communication and time management:** you drive, check in, and adapt when pushed.

Junior and mid-level candidates are expected to produce a sound component design, state shape and API. Senior candidates are expected to drive the conversation, quantify budgets, discuss failure modes, rollout and observability, and think about the other teams who will consume the component.

## A Repeatable Framework: RADIO

| Step | Time (of ~45 min) | Output | Questions to ask |
|---|---|---|---|
| **R**equirements | 5 | Functional list, non-functional list, out of scope | Who uses it, on what devices and networks? Which features are core? How much data? Real time? Offline? SEO? Locales? |
| **A**rchitecture | 10 | Component tree and data flow | What comes from the server, what is client-only? Which rendering strategy? |
| **D**ata model | 5–10 | State shape: server cache, UI, URL and persisted state | What is normalised, what is derived, what must survive a reload? |
| **I**nterface (API) | 5–10 | Endpoints or events with request and response shapes; component props and events | Pagination? Errors? Idempotency? |
| **O**ptimisations | 15 | Deep dives: performance, network, accessibility, i18n, security, offline, observability | What breaks first on a slow phone or at 10× the data? |

> **Note:** RADIO is the name GreatFrontEnd popularised for this structure; other guides use different labels for the same steps. What matters is requirements before boxes and decisions before details, not the acronym. Say the plan out loud at the start ("5 minutes of requirements, then architecture…") so the interviewer can redirect you early.

Most designs fit this shape:

```text
+------------------------------ Browser -------------------------------+
|  View: component tree  <------ re-render on state change ------+     |
|     | user events                                              |     |
|     v                                                          |     |
|  Controller / store: UI state, URL state ----------------------+     |
|     | reads and mutations                                      |     |
|     v                                                          |     |
|  Data layer: fetch, cache, dedupe, retry (server state) -------+     |
|     |             ^                                                  |
|     |   service worker: offline cache, background sync               |
+-----|-------------|--------------------------------------------------+
      v             |  HTTP / SSE / WebSocket
        Server API (REST, GraphQL or a backend-for-frontend)
```

## Building Blocks

### Component Architecture

- Split by responsibility: route or container components fetch and own state; presentational components render props; leaf components are generic and reusable.
- Keep state in the lowest component that needs it, and lift it only when siblings share it.
- For reusable components prefer composition (children, slots) over a growing list of configuration props, and support both controlled (`value` + `onChange`) and uncontrolled (`defaultValue`) use.
- Put boundaries where failures and loading should be contained: an error boundary per widget so one failing widget does not blank the page, a loading boundary per independent data source, a code-split boundary per route or heavy widget.
- Styling at scale (tokens, naming, scoping) is covered in [CSS architecture](../../02-css/21-css-architecture/notes.md).

### Client State vs Server State

| Kind | Examples | Lives in | Notes |
|---|---|---|---|
| Server state | Posts, profile, search results | A data-fetching cache (TanStack Query, SWR, RTK Query, Apollo) or your own `Map` | Owned by the server: it goes stale and needs keys and invalidation |
| UI state | Open menu, active tab, hover, draft text | Component-local | Dies with the component |
| URL state | Filters, sort, page, search query, selected item | Path and query string | Shareable, bookmarkable, back button works, SSR can render it |
| Form state | Values, touched, errors | Local or a form library | Validate on the client for speed and on the server for truth |
| Persisted client state | Theme, drafts, recently viewed | `localStorage` or IndexedDB, see [Storage and cookies](../../04-browser-platform/02-storage-and-cookies/notes.md) | Version the shape; validate on read |
| Auth/session | Current user, tokens | HttpOnly cookie plus an in-memory user object | Never put tokens where XSS can read them |

The classic mistake is copying server data into a global store and hand-syncing it. Treat it as a cache instead, and **normalise** entities that appear in several places:

```js
// ❌ nested: the same author is copied into every post; renaming them means finding every copy
{ posts: [{ id: "p1", author: { id: "u1", name: "Asha" } }, { id: "p2", author: { id: "u1", name: "Asha" } }] }

// ✅ normalised: entities by id plus ordered id lists
{
  users: { u1: { id: "u1", name: "Asha" } },
  posts: { p1: { id: "p1", authorId: "u1" }, p2: { id: "p2", authorId: "u1" } },
  feed:  { ids: ["p2", "p1"], nextCursor: "c_42" },
}
```

### Data Fetching and Caching

- **Stale-while-revalidate:** show cached data immediately, refetch in the background, update when it arrives.
- **Cache key** = endpoint + parameters. **Dedupe** identical in-flight requests, so three components asking for the same user make one call.
- **After a mutation**, write the server's response into the cache or invalidate the affected keys.
- **Avoid waterfalls:** start independent requests in parallel, and fetch at the route level (or on the server) rather than each component fetching after its parent renders.
- **Prefetch** likely next data on hover, focus or when a link enters the viewport.
- **Cancel and ignore stale responses** with `AbortController` (see [async/await and fetch](../../03-javascript/18-async-await-and-fetch/notes.md#timeouts-and-cancelling-with-abortcontroller)).
- **Retry** idempotent requests with exponential backoff and jitter. Retry a POST only with an idempotency key.
- **HTTP caching** (`Cache-Control`, `ETag`) and CDNs do a lot for free: [Networking, CORS and caching](../../04-browser-platform/03-networking-cors-caching/notes.md).

### Pagination: Offset vs Cursor

| | Offset (`?page=3&limit=20`) | Cursor (`?after=c_42&limit=20`) |
|---|---|---|
| Jump to page N | Yes | No, only next (and previous) |
| Items inserted while paging | Duplicates or skipped items | Stable |
| Database cost on deep pages | Grows: the database still walks past `offset` rows | Constant: an index seek from the cursor |
| Total count and page numbers | Easy | Usually not available |
| Fits | Admin tables, search results with page numbers | Feeds, chat history, infinite scroll, real-time lists |

```json
{ "items": [], "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTExLTE4In0", "hasMore": true }
```

The cursor is opaque to the client (often an encoded sort key plus id). The client just sends it back.

### Optimistic Updates

Update the UI before the server confirms, reconcile with the server's answer, and roll back on failure:

```js
async function setLiked(postId, liked) {
  const before = store.getPost(postId);                                  // 1. snapshot
  store.updatePost(postId, { liked, likeCount: before.likeCount + (liked ? 1 : -1) }); // 2. apply
  try {
    const saved = await api.put(`/api/posts/${postId}/like`, { liked }); // 3. send the desired state
    store.updatePost(postId, saved);                                     // 4. reconcile with the truth
  } catch {
    store.updatePost(postId, before);                                    // 5. roll back and say so
    toast("Couldn't update the like. Try again.");
  }
}
```

Good for likes, toggles, reordering and sending chat messages (shown as "sending…"). Avoid it for payments, irreversible actions and operations the server often rejects. Send the **desired state** (`liked: true`) rather than "toggle", so retries and duplicates are harmless.

### Rendering Strategies

| Strategy | How it works | Strengths | Costs | Good for |
|---|---|---|---|---|
| CSR | Empty HTML shell; JS fetches data and renders | Simple hosting, rich interactivity | Slow first paint and LCP on weak devices; SEO relies on crawlers running JS | Apps behind a login, dashboards |
| SSR | Server renders HTML per request; the client hydrates | Fast first paint, SEO, personalised pages | Server cost; TTFB waits for the slowest data; hydration cost | E-commerce, public feeds |
| SSG | HTML built at build time and served from a CDN | Fastest and cheapest, very robust | Rebuild to update; not per user | Docs, blogs, marketing pages |
| ISR / revalidation | Static pages regenerated after a TTL or on demand | Static speed with fresher data | Framework and host specific; brief staleness | Product listings, CMS pages |
| Streaming SSR | HTML sent in chunks: the shell first, slow sections as their data resolves | Fast TTFB and FCP even with slow data | Needs framework support; status code and headers are fixed once streaming starts | Pages that mix fast and slow data |
| Hydration | Client JS re-attaches state and listeners to server HTML | Makes SSR/SSG pages interactive | Downloads and runs JS for the whole page; the page looks ready before it responds (hurts INP) | Default in SSR frameworks |
| Islands / partial hydration | Only interactive islands ship and hydrate JS; the rest stays static HTML | Far less JS | Sharing state between islands is harder | Content sites with a few widgets (Astro) |
| Server Components (React) | Components run only on the server and send rendered output, not their code | Less client JS; data fetching next to the component | New mental model; framework lock-in | Next.js App Router apps |

Decide **per route**, not per app: public, SEO-relevant, LCP-critical pages get SSR, SSG or streaming; authenticated, highly interactive tools are fine with CSR. Either way, minimise the JavaScript that has to hydrate. How the browser turns HTML into pixels is in [Rendering pipeline](../../04-browser-platform/01-rendering-pipeline/notes.md).

### Real-time Updates

| | Short polling | Long polling | Server-Sent Events | WebSocket |
|---|---|---|---|---|
| Direction | Client asks every N seconds | Client asks; the server holds the request until there is data | Server → client | Both ways |
| Transport | Plain HTTP | Plain HTTP | HTTP with `text/event-stream` | Upgraded, persistent connection |
| Reconnect | Not needed | Manual | Built into `EventSource`, resumes with `Last-Event-ID` | Manual |
| Costs | Wasted requests; up to N seconds of delay | One open request per client | One open connection per client | One open connection per client; stateful servers |
| Use for | Data that tolerates delay; the simplest option | Fallback where streaming is blocked | Notifications, live scores, LLM token streams | Chat, collaboration, games, presence |

Whatever the transport, production needs: reconnect with exponential backoff and jitter; resume from the last event id and fetch anything missed over HTTP; dedupe by id; order by server sequence, not client clocks; heartbeats to detect dead connections; slow down or pause when `document.visibilityState` is `"hidden"`; and one connection per browser rather than per tab (a `SharedWorker`, or a leader tab plus `BroadcastChannel`; see [Observers, history and workers](../../04-browser-platform/06-observers-history-workers/notes.md)).

### Offline Support

- **App shell and static assets:** a service worker with cache-first.
- **API reads:** network-first with a cached fallback, or stale-while-revalidate.
- **Data:** IndexedDB (asynchronous, large, structured), not `localStorage` (synchronous, about 5 MB, strings only).
- **Writes:** an outbox queue in IndexedDB, replayed on the `online` event or with Background Sync (Chromium only), with idempotency keys so replays never duplicate.
- **Conflicts:** last write wins, a version check that asks the user, or CRDTs for collaborative data.
- **UI:** show that the app is offline and which items are waiting to send.

### Performance

- **Budgets per route:** LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile ([Core Web Vitals](../../01-html/10-seo-and-core-web-vitals/notes.md#core-web-vitals)), plus a compressed-JS budget enforced in CI.
- **Ship less JS:** route-level code splitting, lazy-loading below-the-fold widgets, auditing dependencies.
- **Images:** `srcset`/`sizes`, modern formats, `loading="lazy"` below the fold, `fetchpriority="high"` on the LCP image, width and height (or `aspect-ratio`) to prevent layout shift.
- **Long lists:** virtualise (render the visible rows plus a small overscan), or `content-visibility: auto` for simpler cases.
- **Keep the main thread free:** debounce input, split long tasks and yield between chunks, move heavy work to a Web Worker. Why this matters: [Event loop](../../03-javascript/19-event-loop/notes.md).
- More techniques: [Web performance](../../04-browser-platform/05-web-performance/notes.md).

### Accessibility

- Semantic HTML first (buttons, links, lists, headings, landmarks); ARIA only for patterns HTML lacks (combobox, tabs, grid, feed).
- Every feature works with a keyboard, with a visible focus indicator and a logical order.
- Manage focus: on client-side route changes (to the new `<h1>` or `<main>`), into dialogs and back out.
- Announce asynchronous changes with live regions: `role="status"` for result counts, `role="log"` for chat.
- Respect `prefers-reduced-motion`, colour contrast (4.5:1 for body text), 200% zoom and touch target size.
- Details in [Accessibility](../../01-html/11-accessibility/notes.md).

### Internationalisation

- Keep strings out of code; use ICU message format for plurals (`{count, plural, one {# item} other {# items}}`); never concatenate sentence fragments.
- Format with `Intl` (`DateTimeFormat`, `NumberFormat`, `RelativeTimeFormat`) and sort with `Intl.Collator`.
- Right-to-left languages: `dir="rtl"`, CSS logical properties (`margin-inline-start`), mirrored directional icons.
- Layouts must survive text expansion (German is often around 30% longer than English), long words and other scripts: no fixed widths on text.
- Put the locale in the URL (`/de/...`), set `lang` on `<html>`, and load translations per locale and per route.

### Security

- **XSS:** render user content as text; sanitise rich HTML (for example DOMPurify) before inserting it; add a strict Content Security Policy as a second line of defence.
- **Tokens:** prefer `HttpOnly; Secure; SameSite` cookies to `localStorage`, which any XSS can read.
- **CSRF:** `SameSite` cookies plus CSRF tokens for cookie-authenticated state-changing requests.
- **Clickjacking:** `Content-Security-Policy: frame-ancestors`.
- **Third-party code:** load the minimum, use Subresource Integrity for CDN files, sandbox embedded widgets in iframes.
- **User-supplied links:** allow only `http:` and `https:` (block `javascript:`); `rel="noopener noreferrer"` on `target="_blank"`.
- Details in [XSS, CSRF and CSP](../../04-browser-platform/04-security-xss-csrf-csp/notes.md).

### Observability

- **Real-user monitoring** of Core Web Vitals by route, device class and country (the `web-vitals` library or `PerformanceObserver`).
- **Errors:** the `error` and `unhandledrejection` events plus framework error boundaries; upload source maps; tag every report with the release version.
- **Delivery:** send analytics with `navigator.sendBeacon()` or `fetch(url, { keepalive: true })` on `visibilitychange`, so data is not lost when the tab closes.
- **Rollout:** feature flags, gradual rollouts and dashboards that compare the new and old versions.

### Testing

| Level | What | Typical tools |
|---|---|---|
| Unit | Pure logic: reducers, formatters, cache, debounce | Vitest or Jest with fake timers |
| Component | Rendering and interaction, queried by role and label | Testing Library |
| Integration | A feature with a mocked network | Mock Service Worker (MSW) |
| End to end | Critical journeys in real browsers | Playwright, Cypress |
| Visual regression | Design-system components across themes | Storybook plus screenshot diffs |
| Accessibility | Automated rules plus manual keyboard and screen-reader passes | axe-core; NVDA, VoiceOver |
| Performance | Budgets in CI, RUM in production | Lighthouse CI |

## Worked Design 1: Autocomplete / Typeahead

**Requirements.** Functional: suggestions as the user types; keyboard and mouse selection; the matched text highlighted; selecting fills the input or navigates; recent searches when empty (optional). Non-functional: results feel instant after a pause; works against millions of server-side records; accessible; works on mobile and slow networks; reusable for site search, address fields and user pickers.

**Component tree.**

```text
<Autocomplete>                         props: source, onSelect, minChars, debounceMs, renderOption
├── <input role="combobox">            aria-expanded, aria-controls, aria-activedescendant
├── <Listbox role="listbox">
│   └── <Option role="option"> × n     aria-selected, highlighted match
└── <Status role="status">             "5 suggestions", "No results", errors
Controller: input → debounce → cache lookup → request (abort the previous one) → state → render
```

**State.**

```js
{
  query: "jav",
  results: [{ id: "t_12", label: "JavaScript", type: "topic" }],
  status: "idle",   // idle | loading | success | error
  activeIndex: -1,  // highlighted option, -1 = none
  open: false,
}
// outside render state: cache Map<normalisedQuery, { results, fetchedAt }>, the current AbortController
```

**API.**

```text
GET /api/suggest?q=jav&limit=8
200 { "query": "jav", "items": [{ "id": "t_12", "label": "JavaScript", "type": "topic" }] }
```

Echoing `query` lets the client discard responses that no longer match the input. The component takes `source(query, { signal }) => Promise<Item[]>`, so the same component works with REST, GraphQL or a local array, and cancellation still works.

**Trade-offs.**

| Decision | Options | Recommendation |
|---|---|---|
| When to request | Every keystroke, debounce, throttle | Debounce 150–300 ms with `minChars` of 1–2 |
| Race conditions | Abort old requests, or compare the query / a request id | Both: aborting saves work, comparing guarantees correctness |
| Where to filter | Ship the data and filter on the client, or filter on the server | Client for small sets (up to a few thousand items, in a worker if slow); server otherwise |
| Cache | None, a `Map`, an LRU with TTL, the HTTP cache | In-memory LRU (around 50 queries, a few minutes' TTL) |
| Highlighting | `innerHTML` with `<mark>`, or DOM nodes | Text nodes plus `<mark>`: the query is user input (XSS) |
| Accessibility | ARIA combobox pattern, live-region count | Required, not optional |
| Mobile | `type="search"`, `enterkeyhint="search"`, 16 px font (iOS zooms smaller inputs), list visible above the keyboard | All of them |

The working implementation, with keyboard handling and stale-response logic, is [Build 1 of the machine coding note](../02-machine-coding/notes.md#build-1-autocomplete-with-debounce-keyboard-and-aria-combobox).

## Worked Design 2: News Feed With Infinite Scroll

**Requirements.** Functional: a personalised feed of posts with text, images and links; more posts load as the user scrolls; like and comment; create a post; "N new posts" without the page jumping. Non-functional: fast first post (LCP), smooth scrolling through thousands of posts on low-end Android, usable on slow 3G, accessible, scroll position survives back navigation.

**Component tree.**

```text
<FeedPage>
├── <Composer>                    create a post (optimistic, shows "posting…")
├── <NewPostsPill>                "5 new posts ↑": inserts them only when clicked
├── <Feed role="feed">            virtualised after a few hundred posts; aria-busy while loading
│   └── <FeedPost role="article"> × n    aria-posinset, aria-setsize
│       ├── <PostHeader> <PostBody> <MediaGrid>   images reserve space with aspect-ratio
│       └── <PostActions>         like (optimistic), comment, share
├── <Sentinel>                    IntersectionObserver → loadMore()
└── <LoadMoreButton>              fallback for keyboard users and failed requests
```

**State.**

```js
{
  users: { u1: { id: "u1", name: "Asha", avatarUrl: "https://example.com/a.png" } },
  posts: { p9: { id: "p9", authorId: "u1", text: "…", media: [], likeCount: 12, liked: false, createdAt: "2026-11-18T09:00:00Z" } },
  feed: {
    ids: ["p9", "p8", "p7"],  // display order
    nextCursor: "c_123",      // null when there is nothing more
    status: "idle",           // idle | loading | error
    pendingNewIds: ["p10"],   // arrived in real time, not shown yet
  },
}
```

**API.**

```text
GET  /api/feed?cursor=c_123&limit=10     → { items: Post[], users: User[], nextCursor: "c_133" | null }
POST /api/posts                          → Post            (Idempotency-Key header)
PUT  /api/posts/p9/like  { liked: true } → { liked: true, likeCount: 13 }
GET  /api/feed/updates (SSE)             → event: post.created  data: { "id": "p10" }
```

Returning `users` next to `items` lets the client normalise without one request per author.

**Trade-offs and deep dives.**

- **Rendering:** SSR or stream the first page for a fast LCP (and SEO if the feed is public), hydrate, then load later pages on the client.
- **Pagination:** cursor-based. New posts are inserted at the top all the time, so offsets would show duplicates.
- **Loading more:** a sentinel with `IntersectionObserver` and a `rootMargin` of about one viewport, a guard against double requests, an end condition, and a "Load more" button fallback (the [infinite scroll build](../02-machine-coding/notes.md#build-5-infinite-scroll-with-intersectionobserver)). Pure infinite scroll makes the footer unreachable, so put footer links elsewhere.
- **DOM size:** after a few hundred posts, memory and style recalculation grow. Virtualise with measured, variable row heights, or start with `content-visibility: auto` on each post. Virtualisation hides off-screen posts from Ctrl+F and screen readers; the ARIA `feed` pattern (`aria-setsize`, `aria-posinset`, `aria-busy`) tells assistive technology what is going on.
- **New posts:** never insert them above the reading position automatically (layout shift, lost place). Buffer them in `pendingNewIds` behind a pill.
- **Back navigation:** keep the feed cache outside the page component and restore the scroll anchor (first visible post id plus offset), not a raw pixel value.
- **Likes:** optimistic with rollback, sending the desired state.
- **Memory:** keep a window of pages in the DOM; drop distant pages and re-render them from cached data when the user scrolls back.

## Worked Design 3: Chat With Notifications

**Requirements.** Functional: one-to-one and group conversations; send and receive in real time; load older messages when scrolling up; sent, delivered and read status; typing indicator; unread counts and notifications when the tab is in the background; messages written offline are sent later. Non-functional: no lost or duplicated messages, correct order, low latency, several open tabs, flaky mobile networks, accessible.

**Component tree.**

```text
<ChatApp>
├── <ConnectionBanner>            "Reconnecting…" / "Offline: messages will send later"
├── <ConversationList>            sorted by lastMessageAt, unread badges
│   └── <ConversationItem> × n
└── <ConversationView>
    ├── <MessageList role="log">  older messages load at the top
    │   └── <Message> × n         sending | sent | delivered | read | failed (with Retry)
    ├── <TypingIndicator>
    └── <Composer>                Enter sends, Shift+Enter adds a new line
```

**State.**

```js
{
  connection: "open", // connecting | open | reconnecting | offline
  conversations: { byId: { c1: { id: "c1", title: "Team", lastMessageAt: "…", unread: 2 } }, order: ["c1", "c4"] },
  messages: {
    byId: { m7: { id: "m7", clientId: "tmp_9f2", conversationId: "c1", authorId: "u1", text: "Hi", seq: 1042, status: "sent" } },
    byConversation: { c1: { ids: ["m5", "m6", "m7"], olderCursor: "m5", hasOlder: true } },
  },
  outbox: [],          // unsent messages, mirrored in IndexedDB
  typing: { c1: ["u3"] },
}
```

**API.**

```text
GET /api/conversations?cursor=…
GET /api/conversations/c1/messages?before=m5&limit=30   history while scrolling up
GET /api/conversations/c1/messages?after=m7             fill the gap after a reconnect
WS → { "type": "message.send", "clientId": "tmp_9f2", "conversationId": "c1", "text": "Hi" }
WS ← { "type": "message.ack", "clientId": "tmp_9f2", "id": "m7", "seq": 1042 }
WS ← { "type": "message.new", "message": { … } }
WS ↔ { "type": "typing", "conversationId": "c1" }  and  { "type": "read", "conversationId": "c1", "upTo": "m7" }
```

**Trade-offs and deep dives.**

- **Transport:** WebSocket for low-latency two-way traffic. SSE for receiving plus HTTP POST for sending is a valid, simpler alternative: it reconnects automatically and passes through more proxies. State which one you pick and why.
- **Delivery:** the client generates a `clientId` and appends the message optimistically as "sending". The server dedupes by `clientId`, so retries are idempotent, and acks with the real id and a sequence number; the client swaps the temporary message for the real one.
- **Ordering:** sort by the server's sequence number, never the client clock; late arrivals are inserted in place.
- **Reconnect:** backoff with jitter; on reconnect, fetch `after=lastSeenId` for open conversations, then flush the outbox.
- **Many tabs:** one socket per browser through a `SharedWorker`, or a leader tab that relays over `BroadcastChannel`; otherwise every tab connects and every tab shows the same notification.
- **Scrolling:** stay pinned to the bottom only if the user is already there, otherwise show "New messages ↓". When older messages are prepended, keep the visible message still (CSS scroll anchoring, or adjust `scrollTop` by the change in `scrollHeight`).
- **Notifications:** unread count in the document title; the Notifications API only while the tab is hidden, with permission requested after a user action, never on page load.
- **Accessibility:** `role="log"` announces incoming messages politely; do not announce the user's own messages or every typing event.
- **Security:** messages render as text; links are created only for `http(s):` URLs with `rel="noopener noreferrer"`.
- **Performance:** virtualise long histories; batch bursts of incoming messages into one render per animation frame.

## Worked Design 4: A Design-System Data Table

**Requirements.** Functional: configurable columns with custom cells, sorting, filtering, pagination (client- or server-side), row selection, sticky header, loading, empty and error states. Non-functional: used by many teams with different data sources; accessible; fast with 10,000 rows; themeable; localised; a stable, versioned API. The interesting part is the **component API**.

| API shape | Example | Pros | Cons |
|---|---|---|---|
| Configuration | `createDataTable(el, { columns, rows })` | Quick to adopt, consistent output | A new prop for every special case ("prop explosion") |
| Compound components | `<Table><Table.Header>…<Table.Row>…</Table>` | Flexible markup, readable | Consumers can get structure and accessibility wrong |
| Headless | `useTable({ data, columns })` returns state and handlers; consumers render | Total control of markup and styling | Every team re-solves accessibility and styling |

Recommendation: a configuration-driven component built on a headless core, so most teams use the simple API and the few with unusual needs use the core directly.

```ts
type Column<Row> = {
  id: string;
  header: string;                                  // already translated
  accessor: (row: Row) => string | number | Date;  // the value used for sorting and filtering
  cell?: (row: Row) => Node;                       // custom rendering: links, badges
  sortable?: boolean;
  align?: "start" | "end";                         // numbers align to the end
};

createDataTable(container, {
  columns,
  rows,
  getRowId: (row) => row.id,          // selection survives sorting and paging
  mode: "client",                     // "server": the table emits changes and the consumer fetches
  sort: { columnId: "createdAt", direction: "desc" }, // controlled; omit it and use defaultSort for uncontrolled
  onSortChange: (sort) => {},
  selection: "multiple",
  onSelectionChange: (ids) => {},
  pageSize: 50,
  emptyMessage: "No invoices yet",
});
```

**State.** `{ sort, filters, page: { index, size }, selection: Set<rowId>, columnWidths }`. Every slice can be owned by the table (uncontrolled) or by the consumer (controlled), so a page can keep sort, filters and page in the URL.

**Deep dives.**

- **Semantics:** a real `<table>` with `<caption>`, `<th scope="col">`, `aria-sort` on the sorted header and a `<button>` inside each sortable header. Use `role="grid"` only if you implement cell-by-cell arrow-key navigation (spreadsheet-style editing); it is a lot more work, and a plain table is better for read-mostly data.
- **Selection:** labelled checkboxes ("Select invoice INV-104"), a header checkbox with the indeterminate state, and selection stored by row id, never by index.
- **Large data:** server mode for big datasets; virtualise rows beyond a few hundred while keeping `aria-rowcount` and `aria-rowindex` so screen readers know the real size; sticky header with `position: sticky`.
- **Small screens:** horizontal scrolling inside a focusable, labelled region (`role="region"`, `aria-label`, `tabindex="0"`) or a card layout; never hide columns silently.
- **Theming:** design tokens as CSS custom properties, density variants, and support for dark mode and forced-colours (Windows High Contrast) mode.
- **i18n:** numbers, currencies and dates through `Intl`; string sorting with `Intl.Collator`; logical properties for right-to-left layouts.
- **Shipping to many teams:** semantic versioning, deprecation warnings and codemods for breaking changes; tree-shakeable builds; Storybook docs with accessibility notes; visual regression and axe tests in CI; usage telemetry before removing a prop.

A **date picker** raises the same API questions plus locale-specific week starts and formats, a keyboard-navigable grid of days, time zones, and whether native `<input type="date">` is good enough (often it is, especially on mobile).

## Common Mistakes

- **Drawing components before asking** about users, devices, data size and must-have features.
- **Designing only the happy path:** no loading, empty, error, offline or slow-network states.
- **Copying server data into a global store** and syncing it by hand, instead of a cache with keys, staleness and invalidation.
- **Offset pagination for a feed** that changes constantly.
- **Accessibility as a closing remark** rather than part of each component's design.
- **One rendering strategy for the whole app** ("we'll SSR everything") instead of choosing per route.
- **Ignoring races:** stale responses, double submits, two quick toggles, reconnects that duplicate messages.
- **Listing trade-offs without deciding.** End each one with a choice and a reason.
- **Spending twenty minutes on one deep dive** and never reaching the API or the data model.
- **Real-time without reconnection, gap-filling and dedupe.**

## Key Takeaways

- Front-end system design is about the client: components, state, data flow, rendering, and performance and accessibility on real devices and networks.
- Use a timeboxed framework: Requirements → Architecture → Data model → Interface → Optimisations.
- Separate server state (a cache) from UI, URL, form and persisted state, and normalise shared entities.
- Use cursor pagination for feeds and offset pagination for page-numbered tables.
- Choose CSR, SSR, SSG, streaming or islands per route, and count the cost of hydration.
- Real time means a transport choice plus reconnect, resume, dedupe and ordering.
- Optimistic updates need a snapshot, reconciliation and rollback, and should send desired state rather than toggles.
- Make accessibility, i18n, security and observability explicit deep dives, and quantify performance with budgets.

## Interview Questions

These are design prompts. Junior prompts are small in scope; Senior prompts are large and deliberately ambiguous.

### Junior (0–1 year)

**Q1. Design an image carousel component. What do you ask, and what is its API?**
Ask: how many images, autoplay or not, looping, swipe on touch, thumbnails? API: `images: { src, alt }[]`, `startIndex`, `loop`, `autoplay`, `onChange(index)`. State: `currentIndex` and `isPlaying`. Markup: a labelled region with `aria-roledescription="carousel"`, each slide labelled "2 of 5", Previous and Next buttons with text labels, and a Pause button whenever it autoplays (moving content must be stoppable); autoplay also pauses on hover and focus. Performance: lazy-load images that are not visible and reserve their space with `aspect-ratio`. CSS scroll snapping gives swipe for free. A built example: [Horizontal carousel](../../05-projects/04-horizontal-carousel/notes.md).

**Q2. Design a toast notification system.**
API: `toast.show({ message, type, duration, action })` returns an id; `toast.dismiss(id)`. State: a queue, with at most three visible and the rest waiting. Timers pause on hover and focus so users can read and reach an action button. Toasts render into one container; info and success toasts go in a `role="status"` region, errors in `role="alert"`. Toasts never steal focus, never cover primary controls, and respect `prefers-reduced-motion`. Anything the user must act on belongs in a dialog, not a toast.

**Q3. Where should the filters, sort order and page number of a product listing live?**
In the URL as query parameters. The page becomes shareable and bookmarkable, the back button works, and the server can render the right results on first load. Components read the parameters, and changes write them with the router or `history.pushState` (use `replaceState` while the user is typing in a text filter, so each keystroke is not a history entry). The fetched results are cached under a key built from the same parameters.

**Q4. Design a Like button with a count.**
Update optimistically: snapshot the post, flip `liked` and adjust the count, send `PUT /like { liked }` with the desired state, reconcile with the count the server returns, and roll back with a short message on failure. The button is a real `<button>` with `aria-pressed` reflecting the state. Because the request carries the desired state, double clicks and retries are harmless, and responses older than the latest request can be ignored. Format big numbers with `Intl.NumberFormat` in `compact` notation ("1.2K").

**Q5. Offset or cursor pagination for an infinite news feed? Why?**
Cursor. New posts are inserted at the top constantly, so with offsets every page shifts and the user sees duplicates or misses posts. A cursor ("everything older than post X") stays stable, and the database can seek straight to it with an index, while a large offset makes it walk past every skipped row. A feed never needs "jump to page 37", which is the one thing offsets do better.

**Q6. How would you show a list of 10,000 rows?**
First ask whether the user needs all of them at once; usually search, filters and pagination are the real answer. If they must scroll through everything, virtualise: render only the visible rows plus a small overscan, positioned inside a container with the full height, and keep `aria-rowcount` and `aria-rowindex` for screen readers. For moderately long, simple lists, `content-visibility: auto` on each row may be enough. Fixed row heights make virtualisation much simpler.

### Mid-level (2–4 years)

**Q7. Design an e-commerce product listing page with faceted filters.**
Requirements: SEO, fast LCP, filters (category, price, brand), sort, pagination, mobile. Render with SSR or ISR so crawlers and first visits get HTML; keep filters, sort and page in the URL; fetch results and facet counts keyed by those parameters. Debounce the price slider, keep the old results visible (dimmed) while new ones load instead of a blank spinner, and announce "124 products" in a live region. Page numbers are fine here (offset pagination, good for SEO), or "Load more". The first row of images loads eagerly with the LCP image prioritised; the rest lazy-load. Filters are fieldsets with checkboxes, and on mobile they open in a dialog.

**Q8. Choose a rendering strategy for a marketing site, a logged-in analytics dashboard, a blog and a product detail page.**
Marketing site: SSG on a CDN, with islands for the few interactive widgets. Dashboard: CSR behind the login (no SEO need, highly interactive), with a cached app shell. Blog: SSG, with comments loaded on the client or revalidated. Product detail page: SSR or ISR for SEO and LCP, streaming slow sections such as reviews and recommendations, with price and stock fetched fresh or on a short TTL. The general rule is per route: what does the first paint need, who needs to crawl it, and how much JavaScript must hydrate?

**Q9. Design a file uploader that handles large files.**
Drag-and-drop plus a real `<input type="file">` for keyboard users; client-side checks for type and size, repeated on the server. Split large files into chunks (for example 5–10 MB) uploaded straight to storage with pre-signed URLs, three or four in parallel, recording which chunks finished so an upload can resume after a network drop. Show progress per file with `<progress>` (XHR's `upload.onprogress` reports upload progress; `fetch` does not), allow cancel through an abort signal, retry failed chunks with backoff, and verify a checksum at the end. Per-file state: queued, uploading, paused, done, failed. Hash big files in a Web Worker so the UI stays responsive.

**Q10. Live sports scores for millions of viewers: polling, SSE or WebSocket?**
Data flows one way, updates are infrequent, and viewers are many. SSE fits: plain HTTP, automatic reconnect, `Last-Event-ID` to resume, and edge servers can fan it out. At very large scale, short polling of a CDN-cached JSON file every 10–15 seconds is often cheaper still, because the CDN absorbs nearly all the requests. A WebSocket only earns its cost if viewers also send data (chat, predictions). In every case, pause updates while the tab is hidden and resume from the last event.

**Q11. Design a nested comment system like Reddit's.**
The API returns comments flat, with `parentId`, `replyCount` and the first few replies of each comment, paginated by cursor at each level ("Load 37 more replies" per parent). The client keeps a normalised store (`byId` plus child ids per parent) so new pages merge without duplicates. Render recursively, cap the visual indent and offer "Continue this thread" for deep chains, and let users collapse branches. Posting is optimistic; deleting a comment that has replies is a soft delete. Comment bodies use a restricted Markdown subset that is sanitised before rendering. The UI side is built in [Build 6 of the machine coding note](../02-machine-coding/notes.md#build-6-nested-comments).

**Q12. How would you make a form-heavy field-inspection app work offline?**
A service worker caches the app shell; reference data (sites, checklists) lives in IndexedDB and syncs when online. Drafts save locally on every change. Submitting puts the record in an outbox with a client-generated id; the app syncs when the connection returns (the `online` event, or Background Sync where supported), and the server treats that id as an idempotency key. Conflicts are detected with a version number or `ETag` and shown to the user rather than silently overwritten. Request persistent storage (`navigator.storage.persist()`), handle quota errors, and show each record's sync status.

**Q13. Design the notification bell: unread count, dropdown list, mark as read.**
Endpoints for the unread count and for a cursor-paginated list; real-time updates by SSE, or over the app's existing socket. The badge caps at "9+", and the button's accessible name carries the real number ("Notifications, 3 unread"). The dropdown is a disclosure button controlling a popover. Marking as read is optimistic, with a "mark all as read" action. Notifications are deduped by id, grouped where similar, kept in sync across tabs with `BroadcastChannel`, and updates are throttled while the tab is hidden.

### Senior (5+ years)

**Q14. Design a collaborative document editor like Google Docs, from the front-end side.**
Clarify scope first: rich text or plain, comments, offline editing, how many simultaneous editors per document. Keep a document model separate from the DOM (an editor framework such as ProseMirror or Lexical, with `contenteditable` as the view), and put a sync layer under it: either OT (operational transformation, which needs a central server to order operations; Google Docs uses it) or a CRDT (Yjs, Automerge: merges without a central authority and handles offline edits naturally, at some memory cost). Presence (cursors, selections, avatars) travels over a WebSocket as ephemeral, throttled messages that are never persisted. Persist snapshots plus an operation log, keep offline edits in IndexedDB, make undo per user, and sanitise pasted HTML. For big documents, render by block and lazily.

Recommendation: use a proven CRDT library with an established editor framework, and spend your own effort on presence, permissions and accessibility, because `contenteditable` accessibility is hard to get right from scratch.

**Q15. Twelve teams ship into one single-page app, and LCP has drifted from 2.2 s to 3.9 s over a year. How do you fix it and keep it fixed?**
Measure before changing anything: RUM by route and device class, bundle analysis per team's code, long tasks, and third-party scripts. Then fix the biggest causes: route-level code splitting and lazy feature loading, SSR or streaming for landing routes, a priority hint on the LCP image, deferring third-party scripts, and removing dead experiments behind old flags. Keeping it fixed is an organisational problem: per-route budgets for bundle size and Lighthouse scores enforced in CI, code ownership of each chunk, RUM dashboards with alerts per team, and a review step for new dependencies. Micro-frontends address team independence, not performance, and usually make it worse (duplicate frameworks, more requests).

Recommendation: budgets plus ownership plus RUM alerts, inside a modular monolith with lazy feature boundaries, before considering micro-frontends.

**Q16. Design a component library used by 20 teams, some on React, some on other frameworks and some on server-rendered pages.**
Build it in layers. Design tokens (one source, compiled to CSS custom properties) and a CSS foundation are usable by everyone, including server-rendered pages. For components, Web Components (custom elements) work in every framework; the costs are server rendering (Declarative Shadow DOM), form participation (`ElementInternals`), styling across shadow boundaries and framework integration (React 19 finally handles custom element properties and events properly). The alternative is React-first components with thin wrappers for the others. Either way, accessibility is built in and tested, releases follow semantic versioning with changelogs and codemods, documentation lives in Storybook, visual regression and axe run in CI, and adoption metrics show which components and props are actually used.

Recommendation: tokens and CSS for everyone; Web Components for leaf primitives (button, input, dialog) only if several frameworks are a real, lasting requirement; framework-specific composites on top. If almost everyone is on React, React-only is cheaper.

**Q17. A trading dashboard shows 5,000 cells that update several times a second, and the UI freezes. Design it.**
Profile first (the Performance panel's long tasks), then decouple the network rate from the render rate. Ask the server to conflate updates (latest value per instrument rather than every tick). Parse messages in a Web Worker and keep the latest value per key in a `Map`; flush to the UI once per animation frame, or at 4–10 Hz, which is as fast as people can read numbers. Update only the cells that changed by writing `textContent` directly, with no full re-render, and virtualise rows. Use fixed-size cells with `contain: strict` so updates never trigger page-wide layout, and animate change highlights with `opacity` and `transform` only. Canvas or WebGL handles even higher density, but then you must provide an accessible table view separately. Do not make the grid a live region; offer opt-in announcements for watched symbols. Pause or slow down while the tab is hidden.

Recommendation: server-side conflation, per-frame batching on the client and targeted cell updates; move to canvas only if profiling proves the DOM cannot keep up.

## References

- [GreatFrontEnd: Front End System Design Playbook](https://www.greatfrontend.com/front-end-system-design-playbook)
- [web.dev: Rendering on the Web](https://web.dev/articles/rendering-on-the-web)
- [web.dev: Web Vitals](https://web.dev/articles/vitals)
- [patterns.dev: rendering and design patterns](https://www.patterns.dev/)
- [TanStack Query documentation](https://tanstack.com/query/latest)
- [MDN: Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN: The WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN: Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [WAI-ARIA APG: Feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
- [OWASP: Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
