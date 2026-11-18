# Networking from the Browser: CORS and HTTP Caching

> Browser platform · Topic 3

Every `fetch` a page makes passes through two browser mechanisms that the backend configures but the browser enforces. **CORS** decides whether JavaScript on one origin may read a response from another; **HTTP caching** decides whether a request reaches the network at all. Both are driven by response headers your server sets (in ASP.NET Core, through the CORS middleware and caching headers), and both cause some of the most confusing bugs in front-end work: "CORS errors" that are really `500`s, and users stuck on old JavaScript after a deploy. This note covers the same-origin policy, CORS in depth, HTTP caching from `Cache-Control` to CDNs, what HTTP/2 and HTTP/3 changed for bundling, the real-time options, and the client side of timeouts and retries.

## Same-origin policy recap

An **origin** is **scheme + host + port**. Two URLs are same-origin only if all three match.

| Compared with `https://app.example.com/page` | Same origin? | Why |
| --- | --- | --- |
| `https://app.example.com/other?x=1` | Yes | Path and query do not matter |
| `http://app.example.com/page` | No | Different scheme |
| `https://app.example.com:8443/page` | No | Different port |
| `https://api.example.com/page` | No | Different host (but the **same site**) |

The **same-origin policy** (SOP) is the browser's base security rule: a page may *send* requests to other origins and *embed* their resources, but may not *read* what comes back.

| Cross-origin action | Allowed? |
| --- | --- |
| Embedding: `<img>`, `<script src>`, `<link rel="stylesheet">`, `<video>`, `<iframe>` | Yes: the page uses the resource but cannot read its bytes |
| Writing: links, redirects, form submissions | Yes, which is why CSRF is possible |
| Reading a `fetch` or XHR response | **No**, unless the server allows it with CORS |
| Reading another origin's DOM (iframe, popup), cookies, `localStorage` or IndexedDB | No |
| Reading the pixels of a cross-origin image drawn on a `<canvas>` | No (the canvas becomes "tainted"), unless the image was loaded with `crossorigin` and allowed by CORS |

Without SOP, any site you visit could `fetch('https://mail.example.com/inbox')` with your cookies attached and read your mail. Note that **origin** (SOP, CORS, storage) and **site** (`SameSite` cookies) are different boundaries: see [SameSite: Strict, Lax and None](../02-storage-and-cookies/notes.md#samesite-strict-lax-and-none).

## CORS

### What it is and who enforces it

**CORS** (Cross-Origin Resource Sharing) is how a server **relaxes** the same-origin policy for chosen origins. The browser adds an `Origin` header to cross-origin requests, the server answers with `Access-Control-Allow-*` headers, and the **browser** decides whether to hand the response to JavaScript.

```http
GET /api/products HTTP/1.1
Host: api.example.com
Origin: https://app.example.com

HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.example.com
Vary: Origin
Content-Type: application/json
```

Three facts that clear up most of the confusion:

- **CORS is enforced by the browser and configured on the server.** The server only declares a policy. `curl`, Postman and server-to-server calls ignore it, which is why "it works in Postman".
- **CORS protects users, not your API.** It stops a malicious site from reading responses obtained with the visitor's cookies or from the visitor's network position (an intranet). It does not stop anyone from calling your API directly; authentication and authorisation do that.
- **A blocked simple request still reached the server.** For a simple request the browser sends it, the server processes it, and only then does the browser hide the response. Side effects happen, so CORS is not CSRF protection: see [Why CORS is not CSRF protection](../04-security-xss-csrf-csp/notes.md#why-cors-is-not-csrf-protection).

### Simple requests

A request is **simple**, and is sent without a preflight, only if all of these hold:

- The method is `GET`, `HEAD` or `POST`.
- The only headers set by script are CORS-safelisted ones: `Accept`, `Accept-Language`, `Content-Language`, `Content-Type` and `Range`, with simple values.
- `Content-Type`, if set, is `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`.
- There is no streaming request body and no upload progress listener.

These are exactly the requests an HTML form or an `<img>` could already send before CORS existed, so letting script *send* them adds no new risk. Anything else needs a preflight: `Content-Type: application/json`, an `Authorization` header, a custom header such as `X-Request-Id`, or `PUT`, `PATCH` and `DELETE`.

### Preflighted requests

For a non-simple request the browser first asks permission with an `OPTIONS` request, and sends the real request only if the answer allows it:

```text
Browser (app.example.com)                            Server (api.example.com)
  ── OPTIONS /api/orders/42 ─────────────────────────────►
     Origin: https://app.example.com
     Access-Control-Request-Method: PUT
     Access-Control-Request-Headers: authorization, content-type
  ◄── 204 No Content ─────────────────────────────────────
     Access-Control-Allow-Origin: https://app.example.com
     Access-Control-Allow-Methods: GET, POST, PUT, DELETE
     Access-Control-Allow-Headers: authorization, content-type
     Access-Control-Max-Age: 600
  ── PUT /api/orders/42 (the real request) ──────────────►
  ◄── 200 OK + Access-Control-Allow-Origin ───────────────
```

- If the preflight fails, the real request is **never sent**.
- The preflight carries **no cookies and no `Authorization` header**. An API that requires authentication on `OPTIONS` answers `401`, and the preflight fails.
- The preflight must get a `2xx` response. A redirect fails it; typical causes are an HTTP→HTTPS redirect or a trailing-slash redirect on the API.
- `Access-Control-Max-Age` lets the browser cache the preflight result for that URL. Without it the result lasts 5 seconds; browsers cap it at 2 hours (Chromium) or 24 hours (Firefox).

### The CORS headers

| Header | Sent by | Meaning |
| --- | --- | --- |
| `Origin` | Browser | The requesting page's origin, set automatically; page script cannot change it |
| `Access-Control-Request-Method` | Browser, preflight | The method the real request will use |
| `Access-Control-Request-Headers` | Browser, preflight | The non-safelisted headers it will send |
| `Access-Control-Allow-Origin` | Server | `*`, or **one** exact origin allowed to read the response |
| `Access-Control-Allow-Methods` | Server, preflight | Allowed methods |
| `Access-Control-Allow-Headers` | Server, preflight | Allowed request headers |
| `Access-Control-Allow-Credentials` | Server | `true` if the response may be read when credentials (cookies) were sent |
| `Access-Control-Expose-Headers` | Server | Response headers that script may read beyond the safelisted ones |
| `Access-Control-Max-Age` | Server, preflight | Seconds the preflight result may be cached |

`Access-Control-Allow-Origin` takes a single origin, not a list. To allow several, the server checks the request's `Origin` against an allowlist and echoes it back, adding `Vary: Origin` so that caches do not serve one origin's response to another (see [Vary](#vary-responses-that-depend-on-request-headers)).

By default script can read only the CORS-safelisted response headers: `Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`, `Expires`, `Last-Modified` and `Pragma`. Anything else (`Location` after a create, `ETag`, `Retry-After`, `X-Total-Count` for pagination) comes back as `null` from `response.headers.get()` unless the server lists it in `Access-Control-Expose-Headers`.

### Credentials and wildcards

A cross-origin `fetch` sends no cookies by default (`credentials: 'same-origin'`). To send them, both sides must opt in:

```js
const res = await fetch('https://api.example.com/me', { credentials: 'include' });
```

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

- With credentials, `Access-Control-Allow-Origin: *` is **rejected**: the server must name the origin. In `Allow-Headers`, `Allow-Methods` and `Expose-Headers`, `*` also stops being a wildcard and is read as a literal name. Even without credentials, `Authorization` is never covered by `*` and must be listed by name.
- The cookie must also be allowed to travel. For a cross-*site* API it needs `SameSite=None; Secure` and is subject to third-party cookie blocking (see [Third-party cookies in 2026](../02-storage-and-cookies/notes.md#third-party-cookies-in-2026)); for a same-site API (`app.example.com` → `api.example.com`), `SameSite=Lax` works.
- A bearer token in an `Authorization` header is not "credentials" in the CORS sense (that word means cookies, HTTP authentication and client certificates), but it does make the request preflighted.

### Configuring CORS in ASP.NET Core

CORS is a server-side policy, so in an ASP.NET Core API it is a policy registration plus a middleware:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>()!) // e.g. https://app.example.com
        .WithMethods("GET", "POST", "PUT", "DELETE")
        .WithHeaders("Content-Type", "Authorization")
        .WithExposedHeaders("Location", "ETag", "Retry-After")
        .AllowCredentials()
        .SetPreflightMaxAge(TimeSpan.FromMinutes(10)));
});

var app = builder.Build();
app.UseRouting();
app.UseCors("Frontend");   // after UseRouting, before authentication and authorisation
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

- With `UseCors` before authentication, the CORS middleware answers preflights before an authorisation policy (for example a global "require an authenticated user" fallback policy) can reject them.
- The middleware echoes the matching origin. If a cache or CDN sits in front of the API, check that the responses also carry `Vary: Origin`.
- `AllowAnyOrigin()` combined with `AllowCredentials()` is rejected by ASP.NET Core at startup, because the protocol forbids it. The workaround people then find, `SetIsOriginAllowed(_ => true)`, reflects *every* origin with credentials, which lets any website read your users' data (Q16).

### Reading a CORS error in DevTools

JavaScript learns almost nothing, on purpose: `fetch` rejects with a generic `TypeError` ("Failed to fetch" in Chrome, "NetworkError when attempting to fetch resource" in Firefox, "Load failed" in Safari) and no status code. The details are only in DevTools:

1. **Console**: the reason, for example:
   - `No 'Access-Control-Allow-Origin' header is present on the requested resource`: the response carried no CORS headers at all, which is often an error response.
   - `Response to preflight request doesn't pass access control check`: the `OPTIONS` request failed, because of its status (`401`, `404`, `405`), a redirect or missing allow headers.
   - `Request header field authorization is not allowed by Access-Control-Allow-Headers in preflight response`: add the header to the allowed list.
   - `The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'`: echo the origin instead.
2. **Network panel**: the failed request shows `CORS error` in the Status column. Chrome lists the preflight as a separate row of type `preflight`; open it to see the real status and headers of the `OPTIONS` response.
3. **Issues panel**: Chrome groups CORS problems there with an explanation of which header is wrong.

The classic misdiagnosis: the API threw and returned a `500`, or a gateway returned `502` or `413`, **without** CORS headers, because the response came from middleware or infrastructure that runs before the CORS middleware or clears the headers. The browser reports a CORS error and hides the real one. Check the server logs or the raw response in the Network panel before touching the CORS policy.

### Opaque responses and `mode: 'no-cors'`

The Console sometimes suggests `mode: 'no-cors'`. It does not fix CORS:

```js
const res = await fetch('https://other.example/data.json', { mode: 'no-cors' });
res.type;         // → "opaque"
res.status;       // → 0
res.ok;           // → false
await res.text(); // → "" (the body is not readable)
```

`no-cors` lets you send a simple request and get back an **opaque response**: no status, no headers, no readable body. Non-safelisted headers you set are silently dropped. It is useful only when you never need to read the result, such as a service worker caching a third-party image or script for offline use (an `<img>` or `<script>` can still use the opaque response). Caching opaque responses is also expensive: their real size is hidden, so browsers count each one against the storage quota with a large padding (several megabytes in Chromium).

Related: the `crossorigin` attribute on `<img>`, `<script>` and `<link>` makes those elements request in CORS mode. You need it to read a cross-origin image's pixels on a canvas and to get real error messages from a cross-origin script instead of `"Script error."`. Fonts are always fetched in CORS mode, so a font CDN must send `Access-Control-Allow-Origin`.

## HTTP caching

### How the browser decides

Every stored response has a **freshness lifetime** set by the server. On the next request for the same URL:

```text
Stored response for this URL?
 ├─ No ──────────────────────────────► request from the network
 └─ Yes: still fresh (age < max-age)?
       ├─ Yes ───────────────────────► use it, no request at all ("disk cache" / "memory cache")
       └─ No (stale): has a validator (ETag / Last-Modified)?
             ├─ Yes ─► conditional request ─► 304 Not Modified: reuse the stored body
             │                              └► 200 OK: replace the stored response
             └─ No ──► full request
```

A fresh hit costs nothing. A revalidation costs a round trip but no body. Choosing headers means deciding, per resource, how long it may be used without asking and how cheaply it can be checked.

> **Note:** Always send `Cache-Control`. A response with `Last-Modified` but no `Cache-Control` or `Expires` gets a **heuristic** freshness lifetime (commonly 10% of the time since it was last modified), so a file last changed a month ago may be reused for three days without the browser asking.

### `Cache-Control` directives

`Cache-Control` is set by the server on responses (a few directives also exist for requests).

| Directive | Meaning |
| --- | --- |
| `max-age=N` | Fresh for N seconds in any cache |
| `s-maxage=N` | Overrides `max-age` for **shared** caches (CDNs, proxies) only |
| `public` | Shared caches may store it, even when the request had an `Authorization` header |
| `private` | Only the user's browser may store it; CDNs and proxies must not |
| `no-cache` | May be stored, but must be **revalidated with the server before every use** |
| `no-store` | Must not be stored anywhere |
| `must-revalidate` | Once stale, must not be used without a successful revalidation (no stale copies when offline or on errors) |
| `immutable` | Will not change while fresh: do not revalidate, even when the user reloads |
| `stale-while-revalidate=N` | Once stale, may still be served for N seconds while a background request refreshes it |
| `stale-if-error=N` | May be served stale for N seconds if the origin returns an error (mainly honoured by CDNs) |

`Expires: <date>` is the older, absolute-date form of `max-age`, ignored when `max-age` is present. `Pragma: no-cache` is an HTTP/1.0 leftover.

### `no-cache` vs `no-store`

The names mislead: **`no-cache` does cache**. It means "store it, but ask me before using it". Together with an `ETag`, the check usually returns a tiny `304`, so it is the right setting for HTML documents and API data that must always be current. **`no-store`** means never write it anywhere (memory, disk, CDN): use it for sensitive responses such as banking pages, personal data or one-time tokens, where a copy left on disk is the problem. `max-age=0, must-revalidate` behaves practically like `no-cache`.

### Revalidation with `ETag` and `Last-Modified`

Validators let the browser ask "has this changed?" instead of downloading it again:

```http
GET /api/products/42 HTTP/1.1

HTTP/1.1 200 OK
Cache-Control: no-cache
ETag: "v7-9f86d081"
Content-Type: application/json
```

```http
GET /api/products/42 HTTP/1.1
If-None-Match: "v7-9f86d081"

HTTP/1.1 304 Not Modified
ETag: "v7-9f86d081"
```

| Validator | Response header | Conditional request header | Notes |
| --- | --- | --- | --- |
| Entity tag | `ETag: "abc"` (weak: `W/"abc"`) | `If-None-Match` | Any opaque version string (a hash, a row version). Preferred |
| Date | `Last-Modified: <date>` | `If-Modified-Since` | One-second resolution, so it can miss quick successive changes |

The same `ETag` drives **optimistic concurrency** on writes: the client sends `If-Match: "v7-9f86d081"` with its `PUT`, and the server answers `412 Precondition Failed` if someone else changed the resource in the meantime. In ASP.NET Core with SQL Server, a `rowversion` column is a natural source for it.

### Hashed file names and `immutable`

Once a browser has a fresh copy, you **cannot** make it ask again before `max-age` runs out. So the standard strategy splits resources in two groups:

| Resource | Header | Why |
| --- | --- | --- |
| HTML documents, a SPA's `index.html` | `Cache-Control: no-cache` plus `ETag` | Always checked, so a deploy is picked up on the next load; the check is a cheap `304` |
| Fingerprinted assets: `app.3f9a1c.js`, `site.82be0f.css`, fonts, images | `Cache-Control: public, max-age=31536000, immutable` | The name changes whenever the content does, so a given URL never changes: cache it for a year |
| Unversioned assets (`/favicon.ico`, `/logo.png`) | A short `max-age` (hours to a day) plus `ETag` | They can change at the same URL; better still, fingerprint them |
| Personalised API responses | `private, no-cache` plus `ETag`, or `no-store` if sensitive | Never in a CDN, always current |
| Public, cacheable API data | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` | Short in browsers, longer in the CDN, refreshed in the background |

Bundlers (Vite, webpack, esbuild) add the content hash to file names for you. The HTML that references them must therefore not be cached for long, or users keep requesting old file names.

### `stale-while-revalidate`

`Cache-Control: max-age=60, stale-while-revalidate=300` means: for 60 s, use the response without asking; for the next 300 s, still use it immediately but refresh it with a background request; after that, wait for the network. Users get instant responses with data at most one request out of date. It suits avatars, configuration, product listings and other "slightly stale is fine" data, and is widely supported by CDNs and, in the browser cache, by Chromium and Firefox. It is wrong for anything that must be current on the next view, such as an account balance after a payment. Client libraries such as SWR and TanStack Query apply the same idea in JavaScript.

### Browser cache vs CDN cache

| | Browser (private) cache | CDN or proxy (shared) cache |
| --- | --- | --- |
| Serves | One user | Every user behind it |
| Controlled by | `max-age`, `private`, `no-cache`, `no-store` | `s-maxage` (overrides `max-age`), `public`, `private`, and often CDN-specific headers such as `CDN-Cache-Control` |
| Can you clear it? | **No**: wait for expiry, change the URL, or send `Clear-Site-Data` to that user | Yes: purge by URL or tag through the CDN's API |
| Must never contain | — | Personalised or authenticated responses (`private` or `no-store` keeps them out) |

That asymmetry drives the strategy: long `max-age` only for URLs that never change, and `s-maxage` for content you can purge from the CDN when it does.

The browser's HTTP cache is also **partitioned by top-level site** in all major browsers, so a library loaded from a public CDN on site A is downloaded again on site B. The old argument for loading jQuery or fonts from a shared public CDN "because the user already has it cached" no longer holds; self-hosting is usually faster.

### `Vary`: responses that depend on request headers

Caches store responses by URL. If a response also depends on a request header, the server must say so with `Vary`, or a cache will serve the wrong variant.

| `Vary` value | Why |
| --- | --- |
| `Accept-Encoding` | Compressed (Brotli, gzip) and uncompressed variants of the same URL |
| `Origin` | CORS responses that echo the request's origin in `Access-Control-Allow-Origin` |
| `Accept-Language` | Content negotiated by language |

Without `Vary: Origin`, a CDN can cache the response for `https://app.example.com`, with that origin in `Access-Control-Allow-Origin`, and serve it to `https://admin.example.com`, which then fails CORS intermittently depending on which origin filled the cache. The opposite mistake is varying on high-cardinality headers such as `User-Agent` or `Cookie`, which splits the cache into near-unique entries and destroys the hit rate.

### Caching headers in ASP.NET Core and in DevTools

- **Static files:** `UseStaticFiles` sends `ETag` and `Last-Modified`; set `Cache-Control` in `StaticFileOptions.OnPrepareResponse`. Since .NET 9, `app.MapStaticAssets()` fingerprints files at build time, compresses them and sets `ETag` and long-lived caching headers for you.
- **Controllers and endpoints:** `[ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]` produces `Cache-Control: public,max-age=60`, and `[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]` produces `no-store`. Or set `Response.Headers.CacheControl` directly.
- **Output caching** (`AddOutputCache`, `.CacheOutput()`) is something else: a server-side cache of generated responses. It saves server work but sets no browser caching headers by itself.

In the DevTools Network panel, the **Size** column shows `(memory cache)`, `(disk cache)` or `(ServiceWorker)` for responses that never touched the network, and the Status column shows `304` for revalidations. **Disable cache** only applies while DevTools is open, and a hard reload (Ctrl+Shift+R) bypasses the cache, so neither shows what a normal user experiences.

## HTTP/2 and HTTP/3: what changes for front-end bundling

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- |
| Transport | TCP (+ TLS) | TCP + TLS (browsers only use HTTP/2 over HTTPS) | QUIC over UDP, with TLS 1.3 built in |
| Requests per connection | One at a time; browsers open about 6 connections per host | Many concurrent streams on one connection | Many concurrent streams |
| Head-of-line blocking | Yes, per connection | Solved at the HTTP layer, but one lost TCP packet stalls every stream | Solved: streams are independent |
| Header compression | None | HPACK | QPACK |
| Connection setup | TCP and TLS round trips | Same as HTTP/1.1 | Fewer round trips, 0-RTT on resumption, can survive network changes (Wi-Fi to mobile) |

What that means for front-end builds:

- **Stop domain sharding** (spreading assets over `static1.` and `static2.` hosts). It was a workaround for the 6-connection limit and now costs extra DNS lookups and TLS handshakes and defeats prioritisation. Image sprites, and inlining everything as `data:` URIs to save requests, are no longer worth their caching cost either.
- **Keep bundling, but less aggressively.** Extra requests are cheap now, not free: compression works better on larger files, every request has overhead, and deep `import` chains of unbundled ES modules become waterfalls, because each module is discovered only after its parent downloads. One giant bundle is the opposite problem: any change invalidates the whole file in every user's cache.
- **Aim for granular, stable chunks**: route-level code splitting, a vendor chunk that rarely changes, content hashes so a deploy invalidates only the chunks that changed, and `<link rel="modulepreload">` for critical module graphs.
- **Server Push is gone.** Chrome removed HTTP/2 push in 2022, and browsers never implemented it for HTTP/3. Use `<link rel="preload">` and `103 Early Hints` (the server sends preload hints while it is still generating the HTML) instead.
- **Fewer origins is better.** Each third-party origin needs its own connection; `preconnect` to the critical ones.

Bundle splitting is covered in more depth in [Web performance](../05-web-performance/notes.md).

## Real-time updates: long polling, Server-Sent Events and WebSockets

| | Long polling | Server-Sent Events (SSE) | WebSockets |
| --- | --- | --- | --- |
| Direction | The client asks; the server holds the request until there is data or a timeout, then the client asks again | Server → client only | Both directions |
| Protocol | Ordinary HTTP requests | One long HTTP response with `Content-Type: text/event-stream` | Starts as HTTP, then upgrades to its own framed protocol (`ws:`, `wss:`) |
| Browser API | `fetch` in a loop | `EventSource` | `WebSocket` |
| Reconnection | You write it | Built in, resuming with `Last-Event-ID` | You write it, plus heartbeats to detect dead connections |
| Data | Anything | UTF-8 text | Text or binary |
| Auth from the browser | Normal cookies and headers | Cookies only (`EventSource` cannot set headers) | Cookies, or a token in the URL or first message (the API cannot set headers) |
| Infrastructure | Works everywhere | Plain HTTP through proxies; on HTTP/1.1 each stream holds one of the ~6 connections per host, shared by all tabs | Proxies and load balancers must allow the upgrade; scaling out needs sticky sessions or a backplane |
| Good for | Fallback, infrequent updates | Notifications, live feeds, progress, streaming LLM output | Chat, collaborative editing, multiplayer games |

```js
// Server-Sent Events: server → client
const source = new EventSource('/api/notifications/stream');
source.addEventListener('order-shipped', (e) => {
  const { orderId } = JSON.parse(e.data);
  console.log(`Order ${orderId} shipped`); // → Order 1001 shipped
});
source.onerror = () => console.log('Connection lost; EventSource will retry');
// source.close() stops it
```

The server writes each event as plain text ending with a blank line:

```text
event: order-shipped
id: 42
data: {"orderId": 1001}

```

```js
// WebSocket: both directions
const socket = new WebSocket('wss://chat.example.com/ws');
socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', room: 'general' })));
socket.addEventListener('message', (e) => console.log(JSON.parse(e.data)));
socket.addEventListener('close', (e) => console.log('closed', e.code)); // reconnect with backoff here
```

On the .NET side, **SignalR** wraps all three: it negotiates WebSockets first and falls back to SSE and then long polling, and adds groups, reconnection and scale-out (a Redis backplane or Azure SignalR Service), at the cost of its own protocol and client library (`@microsoft/signalr`). For plain one-way streams, ASP.NET Core 10 adds `TypedResults.ServerSentEvents(...)`. A `fetch` with a streamed response body (`response.body.getReader()`) is a further option for server → client streams that need an `Authorization` header, which `EventSource` cannot send.

## Cancellation, timeouts and retries

`fetch` has no timeout option and does not reject on HTTP error statuses; `AbortController` and `AbortSignal.timeout()` are covered in [Timeouts and cancelling with AbortController](../../03-javascript/18-async-await-and-fetch/notes.md#timeouts-and-cancelling-with-abortcontroller). Two additions matter in real apps.

**Combine signals** with `AbortSignal.any()` (in all major browsers since 2024), so one request can be cancelled by the user *or* by a timeout:

```js
const userCancel = new AbortController(); // e.g. aborted when a newer search starts
const signal = AbortSignal.any([userCancel.signal, AbortSignal.timeout(8000)]);
const res = await fetch('/api/search?q=shoes', { signal });
```

**Retry only what is safe to retry**, with exponential backoff and jitter:

```js
const backoff = (attempt, base) => Math.random() * base * 2 ** attempt; // "full jitter"

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(signal.reason); }, { once: true });
  });
}

async function fetchWithRetry(url, options = {}, { retries = 3, baseDelay = 300 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, options);
      const retryable = [408, 429, 502, 503, 504].includes(res.status);
      if (!retryable || attempt === retries) return res;
      const retryAfterMs = Number(res.headers.get('Retry-After')) * 1000; // cross-origin: needs Access-Control-Expose-Headers
      await sleep(retryAfterMs || backoff(attempt, baseDelay), options.signal);
    } catch (err) {
      if (options.signal?.aborted || attempt === retries) throw err;    // cancelled, timed out or out of attempts
      await sleep(backoff(attempt, baseDelay), options.signal);         // network error: try again
    }
  }
}
```

- Retry network errors, `408`, `429` and `502`–`504`; never other `4xx` responses, which will fail again.
- Retry only **idempotent** requests (`GET`, `PUT`, `DELETE`) automatically. For `POST`, send an `Idempotency-Key` header that the server uses to de-duplicate, or do not retry.
- Respect `Retry-After`, add jitter so thousands of clients do not retry in lockstep after an outage, and cap the attempts.
- For analytics or "save on close" requests that must outlive the page, use `fetch(url, { keepalive: true })` or `navigator.sendBeacon()`.

## Common Mistakes

- **Trying to fix CORS in the front end** (`mode: 'no-cors'`, a browser extension, disabling web security) instead of configuring the server, or a dev-server proxy for local development only.
- **Reflecting any origin with credentials** (`SetIsOriginAllowed(_ => true).AllowCredentials()`), which lets every website read your users' data.
- **Requiring authentication on preflight `OPTIONS` requests**, or registering the CORS middleware after authentication.
- **Debugging the CORS policy when the real problem is a `500` or `502`** that was returned without CORS headers.
- **Echoing the origin without `Vary: Origin`**, so a CDN serves one origin's CORS headers to another.
- **Forgetting `Access-Control-Expose-Headers`**, then wondering why `response.headers.get('X-Total-Count')` returns `null`.
- **Reading `no-cache` as "do not cache"**: using it for sensitive data that should be `no-store`, or using `no-store` on every page and losing cheap `304`s.
- **Long `max-age` on `index.html` or on unfingerprinted URLs**, or no `Cache-Control` at all, so heuristic caching serves stale files.
- **Deleting the previous deploy's hashed assets immediately**, so users with an open tab hit `404`s when they lazy-load a chunk.
- **Retrying non-idempotent `POST`s automatically, or retrying without backoff and jitter**, turning a short outage into a retry storm.

## Key Takeaways

- An origin is scheme + host + port. The same-origin policy lets a page send and embed cross-origin, but not read; CORS is how a server allows reading. The browser enforces it, the server configures it.
- Simple requests are sent directly; everything else is preflighted with an `OPTIONS` request that carries no credentials and must get a `2xx` with the right allow headers.
- Credentialed CORS needs `credentials: 'include'`, `Access-Control-Allow-Credentials: true` and an explicit, echoed origin with `Vary: Origin`; `*` does not work.
- A CORS error in the Console often hides a different server error; check the Network panel and the server logs first.
- `no-cache` means revalidate, `no-store` means never store. Serve HTML with `no-cache` and fingerprinted assets with `max-age=31536000, immutable`; validators turn revalidations into cheap `304`s.
- You can purge a CDN but not a browser cache: `s-maxage` and purges for the CDN, new URLs for long browser caching, and a correct `Vary`.
- HTTP/2 and HTTP/3 made sharding and sprites obsolete and killed Server Push; ship granular, hashed chunks and use preload or Early Hints.
- Use SSE for server push, WebSockets for two-way traffic and long polling as a fallback; retry only idempotent requests, with backoff, jitter and cancellation.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between an origin and a site? Give an example of two URLs that are same-site but cross-origin.**
An origin is scheme + host + port; a site is scheme + registrable domain (the part just below a public suffix such as `.com` or `.co.uk`). `https://app.example.com` and `https://api.example.com` are cross-origin, because the hosts differ, but same-site, because both belong to `example.com`. The difference matters because the same-origin policy, CORS and storage work per origin, while `SameSite` cookies and third-party cookie rules work per site: a `fetch` between those two hosts needs CORS, yet a `SameSite=Lax` cookie is still sent with it when credentials are included.

**Q2. What is CORS, and is it configured in the browser or on the server?**
CORS (Cross-Origin Resource Sharing) is a set of HTTP headers that lets a server allow specific other origins to read its responses, relaxing the same-origin policy. It is configured on the server, which sends headers such as `Access-Control-Allow-Origin`, and enforced by the browser, which only hands the response to JavaScript if the headers allow it. In ASP.NET Core you configure it with `AddCors` and `UseCors`.

**Q3. Why does an API call work in Postman or `curl` but fail with a CORS error in the browser?**
CORS is enforced by browsers only. Postman and `curl` are not running a web page on another origin, so they ignore CORS headers and show the response. In the browser, the page's origin differs from the API's, so the browser blocks the response unless the API sends the right `Access-Control-Allow-*` headers. The fix is on the server (or a same-origin proxy), not in the request.

**Q4. What is a preflight request, and what triggers one?**
It is an `OPTIONS` request the browser sends before a cross-origin request that is not "simple", asking whether the real method and headers are allowed. It is triggered by methods other than `GET`, `HEAD` and `POST`, by custom or non-safelisted headers such as `Authorization`, and by a `Content-Type` other than form encodings or `text/plain`, including `application/json`. If the server's response does not allow the request, the real request is never sent.

**Q5. What is the difference between `Cache-Control: no-cache` and `no-store`?**
`no-cache` allows the response to be stored but requires the browser to check with the server before every use, usually getting a cheap `304 Not Modified` if nothing changed. `no-store` forbids storing the response anywhere at all. Use `no-cache` for HTML and data that must be current, and `no-store` for sensitive data that must not be left on disk.

**Q6. What is an `ETag`, and what does a `304 Not Modified` response mean?**
An `ETag` is a version identifier (often a hash) that the server sends with a response. When the cached copy is stale, the browser sends it back in `If-None-Match`; if the resource has not changed, the server replies `304 Not Modified` with no body, and the browser reuses its cached copy. That saves bandwidth while still guaranteeing fresh data.

### Mid-level (2–4 years)

**Q7. Why can't you use `Access-Control-Allow-Origin: *` with cookies, and how do you allow several specific origins?**
The wildcard means "any site may read this", which is acceptable for public data but not for responses produced with the user's cookies: any website could then read the user's private data. So with `credentials: 'include'` the browser rejects `*` and requires the exact origin plus `Access-Control-Allow-Credentials: true`. Since the header takes one origin, the server keeps an allowlist, compares the request's `Origin` header against it, echoes the match and adds `Vary: Origin`. ASP.NET Core's `WithOrigins(...)` does the echoing for you.

**Q8. `GET` requests to your API work from the SPA, but `PUT` fails with a CORS error, and the server logs show the `OPTIONS` request returning `401`. What is happening, and how do you fix it?**
`PUT` (and the `Authorization` and JSON content-type headers) make the request preflighted. The preflight `OPTIONS` request carries no `Authorization` header or cookies, the API's authentication rejects it with `401`, the preflight fails, and the browser never sends the `PUT`. Let the CORS middleware answer preflights before authentication runs: in ASP.NET Core, put `UseCors` after `UseRouting` and before `UseAuthentication`/`UseAuthorization`, and make sure the policy allows `PUT` and the `Authorization` and `Content-Type` headers.

**Q9. How should a SPA's `index.html` and its JavaScript and CSS bundles be cached, and why?**
Build the bundles with content hashes in their file names and serve them with `Cache-Control: public, max-age=31536000, immutable`: a given URL never changes, so it can be cached for a year without revalidation. Serve `index.html` with `Cache-Control: no-cache` (plus an `ETag`) so the browser checks it on every load; when you deploy, the new HTML points at new file names and users get the new code immediately, while unchanged chunks stay cached.

**Q10. What does `stale-while-revalidate` do, and when should you not use it?**
`max-age=60, stale-while-revalidate=300` lets a cache serve the response without asking for 60 s, then for another 300 s serve the stale copy immediately while it fetches a fresh one in the background. Users get instant responses with data at most one request behind. Do not use it for data that must be correct on the very next view (balances, stock levels at checkout, permissions), or for responses whose staleness would confuse users right after their own write.

**Q11. What does the `Vary` header do, and what goes wrong with CORS and a CDN if `Vary: Origin` is missing?**
`Vary` lists the request headers that the response depends on, so caches store separate variants (for example per `Accept-Encoding`). If the API echoes the request's origin in `Access-Control-Allow-Origin` without `Vary: Origin`, a CDN caches the first variant and serves it to every origin, so requests from a second allowed origin fail CORS intermittently, depending on which origin filled the cache. Varying on high-cardinality headers such as `Cookie` or `User-Agent` has the opposite problem: it destroys the hit rate.

**Q12. With HTTP/2 and HTTP/3, do you still need to bundle JavaScript?**
Yes, but differently. Multiplexing removed the 6-connection bottleneck, so domain sharding, sprites and one giant concatenated file are no longer needed, and a giant bundle hurts caching because any change invalidates it. But unbundled ES modules create request waterfalls (each import is discovered only after its parent loads), per-request overhead is not zero, and compression works better on larger files. The sweet spot is granular, content-hashed chunks: route-level splitting, a stable vendor chunk and `modulepreload` for critical paths.

**Q13. For a live notifications feed, would you use WebSockets, Server-Sent Events or polling?**
Server-Sent Events: the data flows only from server to client, SSE runs over plain HTTP (friendly to proxies, CDNs and HTTP/2 multiplexing), and `EventSource` reconnects automatically and resumes with `Last-Event-ID`. WebSockets add value only when the client also sends frequent messages (chat, collaborative editing, games), and they bring upgrade handling, heartbeats and sticky sessions. Polling is the fallback for infrastructure that cannot hold connections open. In ASP.NET Core, SignalR can negotiate between them for you.

### Senior (5+ years)

**Q14. After a deploy, some users get a blank screen with "ChunkLoadError" or "Failed to fetch dynamically imported module". Why does it happen, and how do you prevent it?**
Users still running the previous version (an open tab, a cached `index.html`, or an old service worker serving the old app shell) lazy-load a route chunk by its old hashed name, and the deploy has deleted that file. Often the SPA fallback then returns `index.html` for the missing `.js` path, which surfaces as a MIME-type error instead of a clear `404`.

Prevention works in layers. Deploy assets additively and keep the previous few releases' files for days, pruning old ones later; serve HTML with `no-cache` so new sessions get the new manifest; make the SPA fallback return a real `404` for missing files under `/assets/`; manage service worker updates deliberately; and handle chunk-load failures on the client by reloading the page once (guarded by a `sessionStorage` flag against reload loops; Vite fires a `vite:preloadError` event for this). Recommendation: additive, retained asset deploys plus a one-time reload handler, and monitor chunk-load errors after each release.

**Q15. Design the caching for a public product catalogue API behind a CDN, where logged-in users see personalised prices.**
Split public and personal data, because one response cannot be both shared and private. Product data and list prices go on public endpoints with `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=600, stale-if-error=86400`, an `ETag` and CDN cache tags per product so an edit purges exactly what changed. Personalised prices come from a separate, small endpoint with `private, no-cache` (or are computed client-side from the public price plus the user's discount), so the CDN never stores them. Normalise the CDN cache key (strip tracking query parameters, ignore cookies on public paths), never vary public responses on `Cookie` or `Authorization`, and make sure responses that set cookies are not cached.

Recommendation: a cacheable public layer with long `s-maxage` plus purge-on-write, a thin uncached personal layer, and monitoring of the CDN hit rate and origin load so a misconfigured header shows up quickly.

**Q16. A teammate fixes a CORS error with `SetIsOriginAllowed(_ => true).AllowCredentials()`. What is wrong with it, and what would you set up instead?**
It echoes any origin back with credentials allowed, so any website a logged-in user visits can call your API with the user's cookies and read the responses: the same-origin policy is switched off for your API, turning every XSS on any site into a data leak for yours. The original error was usually something else (a missing origin in the allowlist, the middleware order, an error response without headers) that this hides.

Instead: an explicit allowlist per environment from configuration (`WithOrigins`), only the methods and headers you need, and tests that assert an unknown origin gets no `Access-Control-Allow-Origin`. Better still, avoid CORS: serve the SPA and the API from the same origin through a reverse proxy (`/api` routed to the backend), and use the dev server's proxy locally. Recommendation: same-origin deployment where possible, a strict configured allowlist where not, and never reflection with credentials.

**Q17. How would you design client-side retry behaviour for an app with millions of users, so that an outage does not turn into a retry storm?**
Centralise it in one HTTP client (or a library such as TanStack Query) instead of ad-hoc retries per call. Classify failures: retry only network errors, `408`, `429` and `502`–`504`, and only for idempotent requests or `POST`s with idempotency keys. Use capped exponential backoff with full jitter and an overall deadline, honour `Retry-After` (exposed through CORS), and pause while the browser is offline (`online`/`offline` events). Add a client-side circuit breaker that stops sending after repeated failures and probes occasionally, plus a retry budget (retries no more than a small fraction of requests), and de-duplicate identical in-flight requests.

On the server side, shed load early with `503` and `Retry-After`, so clients back off cooperatively. Recommendation: one shared retry policy with backoff, jitter, budgets and circuit breaking, owned by the platform team and observable through client metrics, so that recovery from an outage is not delayed by the clients themselves.

> **Note:** Related questions answered elsewhere: [Security: XSS, CSRF and CSP](../04-security-xss-csrf-csp/notes.md#interview-questions) (what the same-origin policy is; whether a strict CORS policy protects against CSRF); [Observers, history and workers](../06-observers-history-workers/notes.md#interview-questions) (service worker caching strategies and users stuck on an old version).

## References

- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [MDN: CORS errors](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors)
- [Fetch Standard: CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
- [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [MDN: Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
- [web.dev: Prevent unnecessary network requests with the HTTP Cache](https://web.dev/articles/http-cache)
- [web.dev: Keeping things fresh with stale-while-revalidate](https://web.dev/articles/stale-while-revalidate)
- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
- [Chrome for Developers: Removing HTTP/2 Server Push from Chrome](https://developer.chrome.com/blog/removing-push)
- [Chrome for Developers: Faster page loads using server think-time with Early Hints](https://developer.chrome.com/docs/web-platform/early-hints)
- [MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN: The WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [MDN: AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static)
- [Microsoft Learn: Enable Cross-Origin Requests (CORS) in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/cors)
- [Microsoft Learn: Response caching in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/performance/caching/response)
- [Microsoft Learn: Overview of ASP.NET Core SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction)
