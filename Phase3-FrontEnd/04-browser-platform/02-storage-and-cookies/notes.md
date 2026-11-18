# Browser Storage and Cookies

> Browser platform · Topic 2

A browser gives a page several places to keep data: **cookies**, which travel to the server with every matching request; **Web Storage** (`localStorage` and `sessionStorage`), a small synchronous key–value store; **IndexedDB**, an asynchronous transactional database for structured data and files; and the **Cache API** for HTTP responses. They differ in who can read them (the server, JavaScript, or both), how long they live, how much they hold and what they cost the main thread. This note covers each one with the attributes and behaviour interviews probe, how quotas and eviction work, the current state of third-party cookies, and where an app should keep its auth tokens.

## Cookies

### How cookies work

A cookie is a small name–value pair the browser stores for a site and **attaches automatically to every matching HTTP request**. The server sets it with a response header and reads it back from a request header:

```http
HTTP/1.1 200 OK
Set-Cookie: sessionId=abc123; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600

GET /dashboard HTTP/1.1
Cookie: sessionId=abc123; theme=dark
```

- Each cookie needs its own `Set-Cookie` header; the request carries all matching cookies in one `Cookie` header, as names and values only (no attributes).
- Because they are sent automatically, cookies are the natural place for **session identity**, and also the reason **CSRF** exists (see [Security: XSS, CSRF and CSP](../04-security-xss-csrf-csp/notes.md)).
- Every cookie adds bytes to every request to its domain, including requests for images and scripts.

JavaScript can read and write cookies that are not `HttpOnly` through `document.cookie`, an awkward string API:

```js
document.cookie = 'theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure'; // adds or updates one cookie
document.cookie = 'lang=en; Path=/';                                            // does not remove theme
console.log(document.cookie); // → "theme=dark; lang=en" (no attributes, no HttpOnly cookies)
document.cookie = 'lang=; Path=/; Max-Age=0';                                   // delete: same Path (and Domain), Max-Age=0
```

The asynchronous **Cookie Store API** (`await cookieStore.get('theme')`, `cookieStore.set(...)`, `change` events, also usable in service workers) replaces the string parsing. Chromium has supported it for years and the other engines added it more recently, so check MDN's compatibility table before relying on it.

### Cookie attributes

| Attribute | When omitted | What it does |
| --- | --- | --- |
| `Domain=example.com` | **Host-only**: sent only to the exact host that set it | Sent to that domain **and all its subdomains**. A host can only name itself or a parent domain, never a public suffix such as `co.uk` |
| `Path=/account` | The path of the URL that set it (up to its last `/`) | Sent only to URLs whose path starts with this prefix. A convenience, not a security boundary |
| `Expires=<date>` / `Max-Age=<seconds>` | **Session cookie**: deleted when the browser session ends | When the cookie expires. `Max-Age` wins if both are set; `Max-Age=0` deletes it now. Chrome caps lifetimes at 400 days |
| `Secure` | Sent over HTTP too | Only sent over HTTPS (and to `localhost`). Required for `SameSite=None`, `Partitioned` and the name prefixes |
| `HttpOnly` | Visible to `document.cookie` | **Hidden from JavaScript**, still sent with requests. The main defence against token theft through XSS |
| `SameSite=Strict / Lax / None` | `Lax` in Chromium; other browsers differ | Whether the cookie is sent on cross-site requests (next section) |
| `Partitioned` | Not partitioned | Stores a third-party cookie separately per top-level site (CHIPS, below) |

> **Note:** Browsers restore "session" cookies when the user has "continue where you left off" turned on, so a cookie without `Expires` or `Max-Age` can live for weeks. Do not rely on the session ending; give security-sensitive sessions an explicit lifetime enforced on the server.

### SameSite: Strict, Lax and None

`SameSite` is about the **site**, not the origin. A site is the scheme plus the **registrable domain** (eTLD+1, from the Public Suffix List): `https://app.example.com` and `https://api.example.com` are **same-site** but **cross-origin**. `https://a.github.io` and `https://b.github.io` are different sites, because `github.io` is a public suffix.

| Value | Same-site requests | Cross-site top-level navigation (link click, `GET`) | Cross-site subrequests (`fetch`, `<img>`, `<iframe>`, form `POST`) |
| --- | --- | --- | --- |
| `Strict` | Sent | **Not sent**: a user following a link from another site arrives "logged out" on that first request | Not sent |
| `Lax` | Sent | Sent, for safe methods such as `GET` | Not sent |
| `None` (requires `Secure`) | Sent | Sent | Sent, if third-party cookies are allowed |

- Chromium treats a cookie without `SameSite` as `Lax` (with a two-minute grace period in which a freshly set cookie is still sent on a top-level cross-site `POST`). Firefox and Safari do not apply that default, so **always set `SameSite` explicitly**.
- `Lax` blocks the classic CSRF form post from another site, which makes it a good default for session cookies. It does nothing against requests from a *same-site* origin (a compromised subdomain), so state-changing endpoints still need a CSRF defence: see [Security: XSS, CSRF and CSP](../04-security-xss-csrf-csp/notes.md).

### Cookie prefixes: `__Host-` and `__Secure-`

Cookie attributes are not sent back to the server, so the server cannot tell whether the `session` cookie it receives was set by itself with `Secure`, or by a compromised subdomain or a plain-HTTP page ("cookie tossing"). A prefix in the cookie's **name** makes the browser enforce rules when the cookie is set:

| Prefix | The browser accepts the cookie only if |
| --- | --- |
| `__Secure-` | It has `Secure` and is set from an HTTPS page |
| `__Host-` | It has `Secure`, is set from HTTPS, has **no `Domain`** (host-only) and has `Path=/` |

`__Host-` is the strongest: a cookie named `__Host-session` can only have been set by that exact host over HTTPS, and a sibling subdomain cannot overwrite it. Use it for session cookies unless you deliberately share the cookie across subdomains.

### Size and count limits

- About **4 KB per cookie** (name, value and attributes). Bigger cookies are silently ignored.
- A per-domain cap on the number of cookies: the spec minimum is 50, Chromium allows 180. Past it, the browser evicts the oldest ones, which can silently log users out.
- Servers have limits too: a large `Cookie` header can exceed the request header limit of the server or proxy and fail with `400` or `431 Request Header Fields Too Large`.

Keep cookies few and small: an opaque session ID, not a serialised user profile.

### Third-party cookies in 2026

A **third-party cookie** is one sent with a request to a site other than the one in the address bar: an embedded iframe, ad, analytics script or widget. They power cross-site tracking, so browsers have restricted them for years, and the defaults differ:

| Browser | Third-party cookies by default |
| --- | --- |
| Safari | **Blocked** since 2020 (Intelligent Tracking Prevention). Safari also caps cookies written by `document.cookie` at 7 days. |
| Firefox | **Partitioned** per top-level site (Total Cookie Protection, the default since 2022) and blocked outright for known trackers. A cookie set by `widget.example` inside `shop-a.com` is a different cookie from the one inside `shop-b.com`. |
| Chrome | **Allowed**, except in Incognito, where they are blocked. Users can block them in settings. |
| Edge | Allowed, with known trackers blocked by its tracking prevention. |

Chrome's history is the part to get right, because it changed course several times. Google announced in 2020 that it would phase third-party cookies out and, in January 2024, disabled them for 1% of users as a test. In July 2024 it dropped the deprecation in favour of a user-choice prompt; in April 2025 it dropped the separate prompt as well and kept third-party cookies enabled by default; and in October 2025 it announced it was retiring most of the Privacy Sandbox advertising APIs (Topics, Protected Audience, Attribution Reporting and others) that were meant to replace them. Cross-browser pieces such as CHIPS and FedCM remain.

The practical conclusion has not changed: **design as if third-party cookies are unavailable**. They are already blocked or partitioned for every Safari and Firefox user, in Chrome Incognito and for anyone who turns them off, and the rules keep moving.

### Partitioned cookies (CHIPS)

CHIPS (Cookies Having Independent Partitioned State) is the opt-in, standardised version of Firefox's partitioning. The embedded service adds `Partitioned`:

```http
Set-Cookie: __Host-widget_session=xyz; Secure; Path=/; SameSite=None; Partitioned
```

The browser keys the cookie by the **top-level site** as well as by the cookie's own host. A chat widget embedded on `shop-a.com` gets its session back on `shop-a.com`, but cannot see the one it set on `shop-b.com`. That is enough for embedded state (chat widgets, embedded maps, load-balancer cookies on a third-party CDN) and useless for cross-site tracking. `Partitioned` requires `Secure`, and the `__Host-` prefix is recommended. Chromium has supported it since 2023 (version 114); Firefox partitions third-party cookies anyway and Safari blocks unpartitioned ones, so check MDN for current support of the attribute itself.

An embed that genuinely needs its **unpartitioned** cookies (a "you are signed in as..." widget, an embedded document editor) can ask for them with the **Storage Access API**: `await document.requestStorageAccess()`, called after a user gesture inside the iframe; the browser may show a prompt. It is supported in all major browsers.

### Setting cookies from ASP.NET Core

Auth cookies should be set by the server, not by JavaScript. In ASP.NET Core:

```csharp
Response.Cookies.Append("__Host-session", sessionId, new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Lax,
    Path = "/",                     // __Host- requires Path=/ and no Domain
    MaxAge = TimeSpan.FromHours(8),
});
```

With cookie authentication (`AddAuthentication().AddCookie(...)`), the same settings live on `options.Cookie` (`Name`, `HttpOnly`, `SecurePolicy = CookieSecurePolicy.Always`, `SameSite`).

## Web Storage: `localStorage` and `sessionStorage`

Both are simple synchronous key–value stores scoped to the **origin** (scheme + host + port), with the same API:

```js
localStorage.setItem('theme', 'dark');
localStorage.getItem('theme');    // → "dark"
localStorage.getItem('missing');  // → null
localStorage.removeItem('theme');
localStorage.clear();             // removes everything for this origin
localStorage.length;              // number of keys; localStorage.key(i) returns the i-th name
```

| | `localStorage` | `sessionStorage` |
| --- | --- | --- |
| Lifetime | Until code, the user or eviction deletes it | Until the tab is closed (survives reloads and tab restores) |
| Shared between | All tabs and windows of the same origin | **One tab**: two tabs of the same site have separate copies (duplicating a tab copies it) |
| `storage` event in other tabs | Yes | No |
| Typical use | Preferences, drafts, cached non-sensitive data | Per-tab wizard state, scroll position, "this tab only" flags |

### Strings only

Keys and values are always strings; anything else goes through `String()`:

```js
localStorage.setItem('count', 5);
typeof localStorage.getItem('count');  // → "string"
localStorage.setItem('user', { name: 'Ana' });
localStorage.getItem('user');          // → "[object Object]"

// ✅ serialise explicitly, and guard the parse
localStorage.setItem('user', JSON.stringify({ name: 'Ana' }));
function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }           // corrupted or hand-edited value
}
readJson('user', null);                // → { name: 'Ana' }
```

`JSON.stringify` turns a `Date` into a string and drops or mangles `Map`, `Set`, `undefined` and functions: see [JSON and XML](../../03-javascript/25-json-and-xml/notes.md).

### The `storage` event

When one tab changes `localStorage`, every **other** same-origin tab receives a `storage` event (the tab that made the change does not):

```js
window.addEventListener('storage', (e) => {
  if (e.key === 'logout-at') location.assign('/login'); // another tab logged out
  // also available: e.oldValue, e.newValue, e.url; e.key is null after clear()
});

// in the tab where the user clicks "Log out"
localStorage.setItem('logout-at', String(Date.now()));
```

For messages between tabs, `BroadcastChannel` is cleaner, because nothing is left behind in storage: `new BroadcastChannel('auth').postMessage({ type: 'logout' })`.

### Synchronous and limited

- Every call **blocks the main thread**, and the first access may load the origin's whole store from disk. A few small reads are fine; storing megabytes of JSON and parsing it on every page load is a measurable startup cost.
- The quota is about **5 MB per origin**. Writing past it throws a `QuotaExceededError` `DOMException`, so wrap writes of user-generated content in `try/catch`.
- Not available in workers and service workers. Use IndexedDB there.
- Any script running on the origin can read all of it: an injected XSS payload and every third-party script you include.

## IndexedDB

IndexedDB is a transactional, asynchronous database built into the browser. Use it when you need more than a few kilobytes, structured data, lookups by index, binary data (`Blob`, `File`, `ArrayBuffer`) or access from workers.

| Concept | Meaning |
| --- | --- |
| Database | Named, per origin, with an integer **version** |
| Object store | Like a table: holds values by key. Values can be anything the structured clone algorithm copies: objects, arrays, `Date`, `Map`, `Blob`... |
| Key | Taken from the value (`keyPath: 'id'`), generated (`autoIncrement: true`) or passed explicitly |
| Index | A secondary key path for lookups and ordered ranges (`byEmail`, `byUpdated`) |
| Transaction | Every read and write happens inside one: `readonly`, `readwrite`, or `versionchange` for schema changes |

### The raw API

The native API is event-based, because it predates promises:

```js
const request = indexedDB.open('notes-app', 2);  // name, version

request.onupgradeneeded = (event) => {           // runs when the version increases: the only place to change the schema
  const db = request.result;
  if (event.oldVersion < 1) db.createObjectStore('notes', { keyPath: 'id' });
  if (event.oldVersion < 2) request.transaction.objectStore('notes').createIndex('byUpdated', 'updatedAt');
};

request.onsuccess = () => {
  const db = request.result;
  const tx = db.transaction('notes', 'readwrite');
  tx.objectStore('notes').put({ id: 1, title: 'Hello', updatedAt: Date.now() });
  tx.oncomplete = () => console.log('saved');    // → saved
  tx.onerror = () => console.error(tx.error);
};
request.onerror = () => console.error(request.error);
```

### Things that catch people out

- **Migrations by version.** Schema changes happen only in `upgradeneeded`, which receives `oldVersion`. Write migrations as "if `oldVersion < N`" steps, so a user can jump several versions at once.
- **Other tabs block upgrades.** If another tab still has the old version open, the upgrade waits and `request.onblocked` fires. Handle `db.onversionchange` in every tab by closing the connection (and asking the user to reload), or the new version never opens.
- **Transactions auto-commit.** A transaction commits as soon as it has no pending requests when control returns to the event loop. Awaiting anything that is not an IndexedDB request (a `fetch`, a timer) in the middle of it ends it:

```js
// ❌ the transaction commits while fetch is pending
const tx = db.transaction('notes', 'readwrite');
const store = tx.objectStore('notes');
const notes = await (await fetch('/api/notes')).json();
store.put(notes[0]);                       // TransactionInactiveError

// ✅ do the network work first, then open a short transaction
const fresh = await (await fetch('/api/notes')).json();
const tx2 = db.transaction('notes', 'readwrite');
fresh.forEach((note) => tx2.objectStore('notes').put(note));
```

### Wrapper libraries

Few teams use the raw API directly:

| Library | What it adds |
| --- | --- |
| `idb` | A tiny promise wrapper that keeps the IndexedDB model: `await db.get('notes', 1)` |
| Dexie.js | A richer query API, declarative schemas, live queries that re-run when data changes, optional sync |
| localForage | A `localStorage`-like async key–value API on top of IndexedDB |

```js
import { openDB } from 'idb';

const db = await openDB('notes-app', 2, {
  upgrade(db, oldVersion, newVersion, transaction) {
    if (oldVersion < 1) db.createObjectStore('notes', { keyPath: 'id' });
    if (oldVersion < 2) transaction.objectStore('notes').createIndex('byUpdated', 'updatedAt');
  },
});
await db.put('notes', { id: 1, title: 'Hello', updatedAt: Date.now() });
const byDate = await db.getAllFromIndex('notes', 'byUpdated'); // → notes, oldest first
```

For large files, or SQLite compiled to WebAssembly, the **Origin Private File System** (`navigator.storage.getDirectory()`) gives fast, file-like storage in all major browsers.

## Cache API

The Cache API stores **HTTP request/response pairs** in named caches. It is the storage layer of service workers (offline pages, caching strategies; see [Observers, history and workers](../06-observers-history-workers/notes.md)), and it is also available on `window` in secure contexts:

```js
const cache = await caches.open('assets-v3');
await cache.addAll(['/', '/css/site.css', '/js/app.js']); // fetches and stores
const response = await cache.match('/css/site.css');      // → Response, or undefined if missing
await caches.delete('assets-v2');                         // drop an old version
```

- It is **separate from the HTTP cache**: it ignores `Cache-Control` and never expires anything on its own. You decide what goes in and when it goes, usually by versioning cache names and deleting old caches when a new service worker activates. HTTP caching is covered in [CORS and HTTP caching](../03-networking-cors-caching/notes.md).
- It stores whole responses, bodies included, so it is the place for app-shell files and API responses you want offline, not for small pieces of app state.

## Quotas, eviction and persistence

Apart from cookies and Web Storage (which have their own small limits), everything an origin stores (IndexedDB, Cache API, OPFS, service worker registrations) counts against one **quota per origin**. A third-party iframe gets its own separate quota for each top-level site, because all major browsers now partition third-party storage the way Firefox partitions cookies.

| Browser | Rough quota per origin |
| --- | --- |
| Chromium | Up to 60% of the total disk size |
| Firefox | The smaller of 10% of the disk and 10 GiB per site by default; up to 50% of the disk once persistent |
| Safari | A percentage of the disk since Safari 17. Safari also **deletes all script-writable storage** of a site the user has not interacted with during 7 days of browser use (Home Screen web apps are exempt) |

```js
const { usage, quota } = await navigator.storage.estimate();
console.log(`${(usage / 2 ** 20).toFixed(1)} MB of ${(quota / 2 ** 20).toFixed(0)} MB`);
// → e.g. "3.2 MB of 1024 MB" (deliberately approximate)

const persisted = await navigator.storage.persist(); // → true if the browser granted persistence
```

- By default storage is **best-effort**: when the device runs low on space, the browser evicts whole origins, least recently used first. Everything the origin stored goes at once, so the app must always be able to rebuild from the server.
- `navigator.storage.persist()` asks for **persistent** storage, which only the user can clear. Chromium grants or refuses it silently based on engagement (installed, bookmarked, frequently used); Firefox asks the user. `navigator.storage.persisted()` checks the current state.
- Users can always clear site data, and private windows use storage that disappears when the window closes.

## Choosing a storage mechanism

| | Cookies | `localStorage` | `sessionStorage` | IndexedDB | Cache API |
| --- | --- | --- | --- | --- | --- |
| Sent to the server automatically | **Yes** | No | No | No | No |
| Readable by JavaScript | Unless `HttpOnly` | Yes | Yes | Yes | Yes |
| API | Headers / `document.cookie` | Synchronous | Synchronous | Async, transactional | Async (promises) |
| Data | Strings | Strings | Strings | Structured clone, `Blob`, `File` | `Request` → `Response` |
| Capacity | ~4 KB each | ~5 MB per origin | ~5 MB per origin | Large (share of disk) | Large (share of disk) |
| Lifetime | `Expires`/`Max-Age`, or the session | Until cleared or evicted | The tab | Until cleared or evicted | Until cleared or evicted |
| Scope | Domain and path, plus `SameSite` rules | Origin | Origin and tab | Origin | Origin |
| In workers and service workers | Cookie Store API | No | No | Yes | Yes |
| Use for | Session identity, preferences the server needs | Small preferences, drafts | Per-tab UI state | App data, offline data, files | Offline assets and responses |

## Where to keep auth tokens

Every option trades one attack against another. **XSS** runs the attacker's script inside your page, so it can read anything JavaScript can read. **CSRF** makes the browser send a request to your API from another site, which only works when credentials are attached automatically, and that means cookies. The defences themselves are in [Security: XSS, CSRF and CSP](../04-security-xss-csrf-csp/notes.md#cross-site-request-forgery-csrf).

| Where | Can XSS steal it? | Sent automatically (CSRF risk)? | Survives reloads and new tabs? |
| --- | --- | --- | --- |
| `HttpOnly; Secure; SameSite` cookie | **No**: script cannot read it, although it can make requests while it runs in the page | Yes: mitigated by `SameSite` plus a CSRF token or origin check on unsafe methods | Yes |
| In memory (a variable or closure) | Harder: only while the attacker's script runs, and only if it can reach the variable or intercept your requests | No | **No**: lost on reload, so a silent refresh is needed |
| `localStorage` | **Yes**: one line of injected script sends it away, and it stays usable until it expires | No | Yes |
| `sessionStorage` | **Yes** | No | Per tab only |

The nuance: XSS defeats every option in the sense that injected script can call your API as the user while the page is open. `HttpOnly` limits the damage to that window, because the attacker cannot take the token away and replay it later from anywhere. That is why long-lived credentials should never be readable by JavaScript.

Recommended patterns, most preferred first:

1. **Server-side session or a Backend-for-Frontend (BFF).** The browser holds only a `__Host-` cookie (`HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`); the BFF keeps the OAuth tokens and calls the APIs. JavaScript never sees a token. The IETF's guidance on OAuth for browser-based apps ranks this as the most secure architecture.
2. **Access token in memory, refresh token in an `HttpOnly` cookie.** The SPA keeps a short-lived (5–15 minute) access token in a variable and sends it as `Authorization: Bearer`; on reload or expiry it calls a refresh endpoint, and the browser attaches the refresh cookie (`SameSite=Strict`, limited with `Path` to the auth endpoints, rotated on every use).
3. **`localStorage`** only for low-value, short-lived tokens, and only with a strong Content Security Policy. Avoid it for anything long-lived.

A path-scoped refresh cookie is one case where `__Secure-` beats `__Host-`: `__Host-` requires `Path=/`, while `__Secure-refresh` with `Path=/api/auth` is sent only to the refresh and revoke endpoints.

## Common Mistakes

- **Storing objects in `localStorage` without `JSON.stringify`**, then reading back `"[object Object]"`, or calling `JSON.parse` without a `try/catch`.
- **Keeping long-lived tokens or personal data in `localStorage`**, where any injected or third-party script can read them.
- **Leaving out `SameSite`** and relying on Chromium's `Lax` default, which Firefox and Safari do not apply.
- **Setting `SameSite=None` without `Secure`**: the browser rejects the cookie.
- **Deleting a cookie with a different `Path` or `Domain`** from the one it was set with, which creates or targets a different cookie and leaves the original in place.
- **Adding `Domain=example.com` "to be safe"**, which actually widens the cookie to every subdomain. Omit `Domain` (or use `__Host-`) for host-only cookies.
- **Putting large data in cookies**, so every request (images and scripts included) carries kilobytes of headers, or the cookie passes 4 KB and is silently dropped.
- **Awaiting a `fetch` inside an IndexedDB transaction**, which auto-commits it and causes `TransactionInactiveError`.
- **Treating client storage as durable**: eviction, Safari's 7-day rule, private windows and users clearing data mean the server must stay the source of truth.
- **Building an embedded widget on third-party cookies**, then finding it broken in Safari, Firefox and Chrome Incognito.

## Key Takeaways

- Cookies go to the server automatically with matching requests. Use them for session identity, keep them small, and set `Secure`, `HttpOnly` (for anything auth-related), an explicit `SameSite` and ideally the `__Host-` prefix.
- `SameSite` works on the site (scheme + registrable domain), not the origin: `app.example.com` and `api.example.com` are same-site.
- `localStorage` and `sessionStorage` are synchronous, string-only, origin-scoped and about 5 MB. `localStorage` is shared across tabs and fires `storage` events; `sessionStorage` belongs to one tab.
- IndexedDB is the real client-side database: async, transactional, versioned, able to store structured data and files, and usually used through `idb` or Dexie.
- The Cache API stores request/response pairs for service workers and offline use; it is separate from the HTTP cache and never expires entries by itself.
- Storage is best-effort and can be evicted; check usage with `navigator.storage.estimate()` and ask for durability with `persist()`.
- Third-party cookies are blocked or partitioned in Safari and Firefox and still allowed by default in Chrome; build embeds on CHIPS or the Storage Access API, not on unpartitioned third-party cookies.
- Keep auth tokens out of JavaScript's reach: an `HttpOnly` cookie or a BFF first, an in-memory access token plus an `HttpOnly` refresh cookie second.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between cookies, `localStorage` and `sessionStorage`?**
Cookies are small (about 4 KB) values that the browser sends to the server with every matching request; they have an expiry, a domain and path scope, and can be hidden from JavaScript with `HttpOnly`. `localStorage` holds about 5 MB per origin, is never sent to the server and lasts until it is cleared. `sessionStorage` has the same API but belongs to one tab and is cleared when the tab closes. Use cookies for data the server needs on each request (session identity) and Web Storage for client-only data.

**Q2. What do the `HttpOnly` and `Secure` cookie attributes do?**
`HttpOnly` hides the cookie from JavaScript (`document.cookie` does not show it), so a script injected through XSS cannot read and steal it; the browser still sends it with requests. `Secure` makes the browser send the cookie only over HTTPS, so it cannot leak over an unencrypted connection. Session and auth cookies should have both.

**Q3. How do you store an object in `localStorage`?**
Serialise it with `JSON.stringify` when writing and `JSON.parse` when reading, because Web Storage only stores strings; passing the object directly stores `"[object Object]"`. Wrap the parse in `try/catch`, since the value may be corrupted or edited by hand, and remember that JSON turns `Date` objects into strings and drops `Map`, `Set`, `undefined` and functions.

**Q4. What does the `SameSite` attribute do, and how do `Strict`, `Lax` and `None` differ?**
It controls whether a cookie is sent with requests that come from another site. `Strict` never sends it cross-site, not even when the user follows a link to your site. `Lax` sends it on top-level `GET` navigations (following a link) but not on cross-site subrequests or form posts. `None` always sends it and requires `Secure`. It is the browser's main built-in defence against CSRF, and `Lax` is a sensible default for session cookies.

**Q5. What is the difference between `Expires` and `Max-Age`, and what is a session cookie?**
`Expires` sets an absolute date and `Max-Age` a number of seconds from now; if both are present `Max-Age` wins, and `Max-Age=0` deletes the cookie. A cookie with neither is a session cookie, deleted when the browser session ends, although browsers that restore the previous session may keep it far longer.

**Q6. A user opens your site in two tabs. Do the tabs share `sessionStorage`? And `localStorage`?**
No: each tab has its own `sessionStorage`, so changes in one are invisible in the other (duplicating a tab copies the data at that moment). `localStorage` is shared by every tab and window of the same origin, and the other tabs receive a `storage` event when it changes.

### Mid-level (2–4 years)

**Q7. After switching the session cookie to `SameSite=Strict`, users who click a link to your app in an email or chat arrive looking logged out. Why, and what do you do?**
Webmail and chat apps are other sites, so following their link is a cross-site top-level navigation, and a `Strict` cookie is not sent on it: the first request arrives without a session and the server renders the logged-out page (a reload, now same-site, would work). Use `SameSite=Lax` for the session cookie: it is sent on top-level `GET` navigations and still withheld from cross-site form posts and subrequests. If you want `Strict` protection for sensitive actions, use two cookies: a `Lax` one that identifies the user for reading pages and a `Strict` one that state-changing or sensitive endpoints require.

**Q8. When would you choose IndexedDB over `localStorage`, and what is the most common IndexedDB bug?**
Choose IndexedDB for anything beyond a few small values: structured or queried data (indexes, key ranges), binary data such as `Blob`s, or data that workers and service workers need. It is asynchronous, so it does not block the main thread the way `localStorage` does. The most common bug is awaiting something other than an IndexedDB request (a `fetch`, say) inside a transaction: the transaction auto-commits once it has no pending requests, and the next operation throws `TransactionInactiveError`. Do the network work first, then open a short transaction.

**Q9. What does the `__Host-` cookie prefix guarantee, and why use it?**
The browser only accepts a `__Host-` cookie if it is `Secure`, set from an HTTPS page, has no `Domain` attribute and has `Path=/`. So a cookie with that name can only have been set by that exact host over HTTPS: a compromised subdomain or an attacker on plain HTTP cannot set or overwrite it ("cookie tossing"). It is cheap hardening for session cookies; the only cost is that the cookie cannot be shared with subdomains or limited to a path.

**Q10. The front end at `app.example.com` calls `fetch('https://api.example.com/me')`, but the session cookie set by the API is not sent. Why, and what is needed?**
`fetch` defaults to `credentials: 'same-origin'`, and these are different origins, so no cookies are attached. Pass `credentials: 'include'`, and have the API answer with `Access-Control-Allow-Credentials: true` and the exact origin in `Access-Control-Allow-Origin` (not `*`). Because the two hosts are same-site, a `SameSite=Lax` cookie is fine and third-party cookie blocking does not apply. See [Credentials and wildcards](../03-networking-cors-caching/notes.md#credentials-and-wildcards).

**Q11. What is the current state of third-party cookies, and what are partitioned cookies?**
Safari blocks third-party cookies by default, Firefox partitions them per top-level site (and blocks known trackers), and Chrome still allows them by default after abandoning its deprecation plan in 2024–2025, though Incognito blocks them and users can turn them off. Partitioned cookies (CHIPS, the `Partitioned` attribute) store an embedded service's cookie separately for each top-level site, so a chat widget keeps its state on every site that embeds it without being able to follow users between sites. Build embeds that work without unpartitioned third-party cookies.

**Q12. How much data can a site store, and what happens when it runs out or the device is low on space?**
Cookies are limited to about 4 KB each and Web Storage to about 5 MB per origin; writing past the Web Storage limit throws `QuotaExceededError`. IndexedDB, the Cache API and OPFS share a much larger per-origin quota based on disk size, and `navigator.storage.estimate()` reports usage and quota. That storage is best-effort by default: under storage pressure the browser evicts whole origins, least recently used first, and Safari also deletes script-writable storage after 7 days without user interaction. `navigator.storage.persist()` asks for persistent storage that only the user can clear.

**Q13. Is it safe to keep user data in `localStorage` or IndexedDB? What about on a shared computer?**
Any script running on your origin can read it, including XSS payloads and every third-party script you include, and it stays on disk after the browser closes. So do not store secrets, long-lived tokens or sensitive personal data there unless you must, and clear it on logout. Encrypting it in JavaScript adds little, because the key must be available to the same scripts. On logout the server can also send `Clear-Site-Data: "cache", "cookies", "storage"` to wipe the origin's data.

### Senior (5+ years)

**Q14. Design the token storage for a React SPA that calls an ASP.NET Core API. What do you choose and why?**
The strongest option is a Backend-for-Frontend: the SPA is served from (or proxied through) the same site as a thin ASP.NET Core BFF, the browser holds only a `__Host-` session cookie (`HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`), and the BFF stores the OAuth tokens server-side and attaches them when it forwards API calls. No token is ever readable by JavaScript, refresh logic lives on the server, and CORS often disappears because everything is same-origin. You still need CSRF protection on unsafe methods (ASP.NET Core antiforgery, or requiring a custom header that a cross-site form cannot send) and a strict CSP against XSS.

If a BFF is not possible (the API belongs to someone else, or you cannot run a server), keep a short-lived access token in memory and a rotating refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped by `Path` to the refresh endpoint, with reuse detection on the server. Recommendation: BFF with cookies by default, in-memory access token plus `HttpOnly` refresh cookie as the fallback, and never long-lived tokens in `localStorage`.

**Q15. You are building an offline-first app on IndexedDB. How do you handle schema migrations when users have several tabs open on different app versions?**
Make migrations incremental and idempotent (`if (oldVersion < N)` steps that work from any older version), test the upgrade path from every version still in the field, and keep each migration fast, because it holds the database for every tab. Handle `versionchange` in every tab by closing the connection and prompting a reload, so the upgrade is not blocked forever, and handle `blocked` in the upgrading tab with a clear message. Coordinate with the service worker so new code and the new schema activate together, and never let old code run against a newer schema.

Treat the local database as a cache of server state plus an outbox of pending changes: request persistent storage, queue local writes and sync them with retries, and make sure a fully evicted database (Safari's 7-day rule, storage pressure) can be rebuilt from the server. Recommendation: use Dexie or `idb` for the plumbing, version the schema with explicit migrations, and design for the database disappearing.

**Q16. Your product is an iframe widget embedded on customers' sites. It relies on a login cookie and has stopped working in Safari, Firefox and Chrome Incognito. What are your options?**
Separate two kinds of state. State that belongs to the widget on one embedding site (UI state, a session created inside the widget) should use a `Partitioned` cookie (CHIPS) or partitioned storage, which keeps working per site. State that depends on the user's existing login on your own site needs unpartitioned access: use the Storage Access API (`document.requestStorageAccess()` after a click inside the iframe, which may prompt), or replace cookie-based identity with an explicit flow: a popup or top-level redirect to your login page that hands a short-lived token back to the widget with `postMessage` (checking `event.origin`). In Chromium, FedCM is a further option for identity-provider logins.

Recommendation: design the widget to work with no third-party cookies at all, use CHIPS for its own session and the Storage Access API or a popup login for linking to the user's account, and test in Safari and Firefox, where these restrictions are the default, on every release.

**Q17. Users on shared computers must not leave data behind after logging out. How do you make logout thorough?**
Clear state at every layer. On the server, revoke the session and refresh tokens so that copies stop working. In the logout response, send `Clear-Site-Data: "cache", "cookies", "storage"` to wipe the origin's cookies, Web Storage, IndexedDB and service worker caches (check browser support), and expire the auth cookies explicitly as a fallback. In the client, clear in-memory state (query caches, stores), delete IndexedDB databases and Cache API entries yourself where `Clear-Site-Data` is not supported, and notify other tabs with `BroadcastChannel` so they drop their state too.

Better still, avoid persisting sensitive data in the first place: keep it in memory or `sessionStorage`, and send `Cache-Control: no-store` on sensitive API responses so they are not written to the HTTP cache. Recommendation: server-side revocation plus `Clear-Site-Data` as the baseline, explicit client cleanup as the fallback, and an automated test that logs out and checks the Application panel is empty.

> **Note:** Related questions answered elsewhere: [Observers, history and workers](../06-observers-history-workers/notes.md#interview-questions) (logging out every open tab at once); [Security: XSS, CSRF and CSP](../04-security-xss-csrf-csp/notes.md#interview-questions) (what CSRF is and how `SameSite` cookies help).

## References

- [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [MDN: Cookies Having Independent Partitioned State (CHIPS)](https://developer.mozilla.org/en-US/docs/Web/Privacy/Privacy_sandbox/Partitioned_cookies)
- [MDN: Storage Access API](https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API)
- [MDN: Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [MDN: Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [MDN: Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN: Clear-Site-Data](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Clear-Site-Data)
- [web.dev: SameSite cookies explained](https://web.dev/articles/samesite-cookies-explained)
- [web.dev: Storage for the web](https://web.dev/articles/storage-for-the-web)
- [WebKit blog: Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)
- [idb on GitHub](https://github.com/jakearchibald/idb) · [Dexie.js](https://dexie.org/)
- [RFC 6265: HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265)
- [IETF draft: OAuth 2.0 for Browser-Based Applications](https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/)
- [OWASP: Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Microsoft Learn: Cookie authentication in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/cookie)
