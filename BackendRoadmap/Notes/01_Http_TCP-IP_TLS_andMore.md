# Stage 1: How the Internet Actually Works

Notes built topic by topic as we study. Newest topics are added at the bottom.

---

## Topic 1: What happens when you type a URL and hit Enter

This is the master map. Every later topic (HTTP, TCP, DNS, TLS) is one step in this journey.

### Anatomy of a URL

Example: `https://shop.example.com/products?id=42`

| Part | Value | Used for |
| --- | --- | --- |
| Scheme | `https` | Which protocol; HTTP vs HTTPS |
| Host | `shop.example.com` | DNS lookup |
| Port | 443 (implied for HTTPS), 80 for HTTP | TCP connection |
| Path | `/products` | Which resource, inside the HTTP request |
| Query string | `?id=42` | Extra parameters, inside the HTTP request |

### The full journey

1. **Browser parses the URL** and checks local caches (browser cache, OS DNS cache, HSTS list). Anything found lets later steps be skipped.
2. **DNS lookup**: resolve `shop.example.com` to an IP like `203.0.113.10`. Computers route by IP, not names.
3. **TCP connection**: three-way handshake (SYN, SYN-ACK, ACK) to port 443. Gives a reliable, ordered channel.
4. **TLS handshake**: agree on encryption; server proves identity with a certificate. Everything after is encrypted.
5. **HTTP request** is sent:

   ```
   GET /products?id=42 HTTP/1.1
   Host: shop.example.com
   Accept: text/html
   Cookie: session=abc123
   ```

6. **Server-side processing** (the backend developer's world): load balancer / reverse proxy (Nginx, Azure Front Door), then web server (Kestrel in ASP.NET Core), middleware pipeline, routing, controller, then database or cache. The app builds a response.
7. **HTTP response**: status line (`200 OK`), headers, body (HTML or JSON).
8. **Browser renders**: parses HTML, finds more resources (CSS, JS, images, API calls), and repeats steps 1-7 for each, usually reusing the connection (keep-alive).

### Step 1 in detail: parsing and local caches

The browser tries hard to avoid the network because the network is the slowest part.

**Parsing.** Decide whether the input is a URL or a search, then split it into parts. Each part feeds a later step (host to DNS, scheme and port to the connection, path and query to the HTTP request).

**Browser cache: "Do I already have this?"**
- Servers can send `Cache-Control: max-age=3600` meaning "reuse this for 1 hour."
- Fresh copy: used directly, with no DNS, TCP, TLS or request at all.
- Stale copy: browser may ask "has this changed?" using a validator such as `ETag`. If not, the server replies `304 Not Modified` with no body.
- No copy: continue to the next steps.
- Backend takeaway: `Cache-Control` headers are how you decide how often browsers come back to your server.

**OS DNS cache: "Do I already know the IP?"**
- Browser, then the OS, remember earlier DNS answers.
- Each answer has a TTL (e.g. 300 seconds) saying how long it can be reused.
- If cached, the DNS step is skipped.

**HSTS: "Must this site be HTTPS?"**
- Problem: typing `http://bank.com` sends the first request unencrypted, so an attacker on the same network could tamper with it or redirect you to a fake site.
- A site sends once: `Strict-Transport-Security: max-age=31536000`.
- The browser then upgrades `http://` to `https://` locally, before sending anything, for that period.
- Browsers also ship a preload list of major sites that get this from the first visit.

**Who imposes HSTS?** No one forces it; it's opt-in.
- Site owner sends the header (ASP.NET Core: `app.UseHsts();`).
- Browser remembers it and does the upgrade locally.
- Defined by a standard (RFC 6797), so all browsers behave the same.
- Once enabled it's hard to undo: a bad or expired certificate becomes an unskippable error. Start with a short `max-age`.

**First-visit weakness (trust on first use):**
- On the first visit the browser has no HSTS record, so a typed `http://` request goes out unencrypted. An attacker on the same network can intercept it (SSL stripping).
- The header is ignored if it arrives over plain HTTP; it's only trusted over valid HTTPS.
- Fixes: the **preload list** (hstspreload.org, maintained by Chrome and copied by other browsers) makes a domain HTTPS-only from the first request; browsers also try HTTPS first when no scheme is typed.
- HSTS shrinks the attack window to one request but doesn't remove it for non-preloaded sites.

**Decision flow:**

```
Type URL
  -> parse it
  -> fresh copy in browser cache?   yes -> done, show it
  -> HSTS says use HTTPS?           yes -> switch to https
  -> IP in DNS cache?               yes -> skip DNS
  -> continue to TCP, TLS, HTTP request
```

Pattern to remember: each cache lets the browser skip one expensive step. Caching shows up everywhere in backend work (Redis, CDNs, query caches).

### Why this matters

- **Slow page?** Ask where the time went: DNS, connection setup, TLS, server processing, or download size.
- **Errors map to steps:** "Could not resolve host" is DNS, "connection refused" is TCP, a certificate warning is TLS, a 500 is your server code.
- Your code lives in step 6, but everything around it affects how users experience your API.

### Self-check

- Why does the browser need DNS before it can open a TCP connection?
- Why does TLS come after TCP rather than before?

### Interview questions and answers

> Tip: answer in layers: definition, how it works, a concrete example, then a trade-off or gotcha. Interviewers usually probe the gotcha.

**Q1. [Basic] What happens when you type a URL in the browser and press Enter?**

**A.**
1. The browser parses the URL (scheme, host, port, path, query) and checks local state first: HSTS list, browser cache, DNS caches, hosts file.
2. DNS resolves the host to an IP (resolver, then root, TLD and authoritative servers, unless cached).
3. TCP three-way handshake to the server (port 443 for HTTPS).
4. TLS handshake: agree on version and cipher, verify the server certificate, derive session keys.
5. The browser sends the HTTP request.
6. Server side: load balancer or reverse proxy, then the web server (Kestrel), middleware, routing, controller, database or cache, and a response is built.
7. The response comes back (status, headers, body). The browser renders it, finds more resources (CSS, JS, images, API calls) and repeats the process, reusing connections where it can.

Good answers also say where their own code sits (step 6) and how caches let the browser skip steps.

**Q2. [Basic] Which parts of a URL are sent to the server, and which are not?**

**A.** The scheme and host are used by the browser itself (protocol choice, DNS, the `Host` header and SNI). The path and query go in the HTTP request line. The fragment (`#section`) is never sent to the server; only the browser and its JavaScript use it. The port is used to connect, and appears in the `Host` header when it isn't the default.

**Q3. [Intermediate] Which caches can short-circuit the journey?**

**A.**
- **Browser HTTP cache**: a fresh copy (per `Cache-Control`) means no request at all. A stale copy triggers a conditional request (`ETag`), and `304 Not Modified` saves the body.
- **HSTS**: upgrades `http://` to `https://` locally before anything is sent.
- **DNS caches** (browser, OS, resolver, TTL-based): skip the lookup.
- **Connection reuse** (keep-alive, HTTP/2): skips TCP and TLS setup.
- **TLS session resumption**: shortens the TLS handshake.
- **CDN or proxy caches**: skip the origin.

**Q4. [Intermediate] What is HSTS, who enforces it, and what is its weak point?**

**A.** `Strict-Transport-Security: max-age=...` tells the browser to use only HTTPS for that domain. The **browser** enforces it, upgrading requests locally. Weak point: **trust on first use**. The very first visit has no HSTS record, so an `http://` request is exposed to SSL stripping, and the header is ignored if it arrives over plain HTTP. Mitigations: the **preload list** (hstspreload.org), and browsers trying HTTPS first. Operational risk: once enabled, certificate problems become hard errors users can't click through, so start with a short `max-age`.

**Q5. [Intermediate] Why does DNS come before TCP, and TCP before TLS?**

**A.** TCP connects to an IP address, which DNS provides. TLS runs on top of an existing reliable byte stream, so it needs TCP first. (HTTP/3 changes this: QUIC runs over UDP and combines the transport and TLS handshakes.)

**Q6. [Intermediate] How many round trips before the first byte of a response on a cold HTTPS connection?**

**A.** DNS (at least one lookup, more if uncached) plus TCP (1 RTT), TLS 1.3 (1 RTT; TLS 1.2 needs 2), and the HTTP request and response (1 RTT). So roughly 3 RTT after DNS with TLS 1.3. Ways to cut it: keep-alive, TLS resumption, HTTP/3, a CDN (shorter RTT), and `preconnect` hints.

**Q7. [Intermediate] A page loads slowly. How do you find where the time goes?**

**A.** DevTools, Network tab, Timing breakdown: queueing, DNS lookup, initial connection (TCP), SSL (TLS), waiting for server response (TTFB), content download.
- Slow DNS: TTLs, resolver, DNS provider.
- Slow connect or TLS: distance (use a CDN), TLS version, connection reuse.
- High TTFB: your server, database, cache.
- Slow download: payload size, compression, CDN.

From the command line:

```bash
curl -o /dev/null -s -w "dns:%{time_namelookup} tcp:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}\n" https://example.com
```

**Q8. [Intermediate] Map each error to a step: "could not resolve host", "connection refused", "connection timed out", certificate warning, 502, 500.**

**A.**
- Could not resolve host: **DNS**.
- Connection refused: **TCP**, the machine answered but nothing listens on that port.
- Connection timed out: **TCP or network**, packets dropped (firewall, wrong IP, host down).
- Certificate warning: **TLS** (expired, wrong name, untrusted issuer).
- 502: the **proxy** got no valid answer from your app or upstream.
- 500: your **application code** failed.

**Q9. [Basic] What is keep-alive and why does it matter?**

**A.** Reusing one TCP (and TLS) connection for many requests instead of opening a new one each time. It avoids repeated handshake round trips and CPU work, and avoids restarting TCP's slow start. HTTP/1.1 connections are persistent by default, and HTTP/2 multiplexes many requests over one connection. In .NET it's why you reuse `HttpClient` (or use `IHttpClientFactory`), and database connection pooling is the same idea.

**Q10. [Advanced] Where does an ASP.NET Core app sit in this journey, and what is usually in front of it?**

**A.** In step 6. A typical production path is CDN, then load balancer or reverse proxy (TLS termination), then Kestrel, then the middleware pipeline (forwarded headers, HTTPS redirection, HSTS, authentication, routing), then the endpoint and its data stores. Because proxies sit in front, the app must process forwarded headers to see the real client IP and original scheme.

---

## Topic 2: HTTP

HTTP is the request/response language browsers and servers speak. The client sends a request, the server sends one response.

### Key ideas
- **Stateless**: each request is independent; the server doesn't remember earlier ones. State is added on top with cookies, sessions or tokens.
- HTTP/1.1 is plain text (easy to read). HTTP/2 and HTTP/3 change how data travels (binary, multiplexing, QUIC) but the concepts below stay the same.

### Request structure

```
POST /orders HTTP/1.1            <- request line: method, path, version
Host: shop.example.com           <- headers
Content-Type: application/json
Authorization: Bearer <token>
                                 <- blank line
{"productId": 42, "qty": 2}      <- body (optional)
```

### Response structure

```
HTTP/1.1 201 Created             <- status line: version, code, reason
Content-Type: application/json   <- headers
Location: /orders/981
                                 <- blank line
{"id": 981, "status": "pending"} <- body
```

### Methods

| Method | Meaning | Safe | Idempotent |
| --- | --- | --- | --- |
| GET | Read a resource | Yes | Yes |
| POST | Create a resource or trigger an action | No | No |
| PUT | Replace a resource completely | No | Yes |
| PATCH | Change part of a resource | No | Not guaranteed |
| DELETE | Remove a resource | No | Yes |

- **Safe** = doesn't change server state. **Idempotent** = repeating it gives the same end result as doing it once (matters for retries).
- GET has no body and must never change data.

### Status codes

| Range | Meaning | Common codes |
| --- | --- | --- |
| 1xx | Informational | 101 Switching Protocols |
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301 Moved Permanently, 302 Found, 304 Not Modified |
| 4xx | Client's fault | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 429 Too Many Requests |
| 5xx | Server's fault | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

- **401** = we don't know who you are (not logged in). **403** = we know who you are, but you're not allowed.
- 4xx means fix the request; 5xx means fix the server. 502/504 usually point to a proxy or upstream service problem.

### Redirects (3xx) in more detail

How it works: the server replies with a 3xx code plus a `Location` header; the client automatically sends a new request to that URL.

```
GET /old-page            ->  301 Moved Permanently
                             Location: https://example.com/new-page
GET /new-page            ->  200 OK
```

| Code | Permanent? | Method on the new request |
| --- | --- | --- |
| 301 | Yes | May change to GET |
| 308 | Yes | Preserved |
| 302 | No | May change to GET |
| 307 | No | Preserved |
| 303 | No | Always GET |

(304 Not Modified is not a redirect; it's cache validation.)

Where to use:
- HTTP to HTTPS (301/308), pairs with HSTS
- Site or domain moves, `www` vs non-`www`, trailing-slash cleanup (301, keeps SEO)
- Post/Redirect/Get: after a form POST, 303 to a result page so refresh doesn't resubmit
- Login and OAuth flows: 302 to the login page or identity provider, then back
- URL shorteners, A/B tests, maintenance pages (302/307, temporary)
- Moved API endpoint that takes POST/PUT: 308 (keeps method and body)

Pitfalls:
- Redirect loops give "too many redirects" errors; long chains add a round trip each.
- 301/308 are cached hard by browsers and hard to undo; use 302/307 while testing.
- Open redirect vulnerability: never redirect to an unchecked user-supplied URL (e.g. `?returnUrl=`); validate it.

ASP.NET Core: `Redirect` (302), `RedirectPermanent` (301), `RedirectPreserveMethod` (307), `RedirectPermanentPreserveMethod` (308), `LocalRedirect` (only local URLs, safer), `app.UseHttpsRedirection()`.

### Headers (metadata about the message)

- Request: `Host`, `Accept`, `Content-Type`, `Authorization`, `Cookie`, `User-Agent`
- Response: `Content-Type`, `Content-Length`, `Set-Cookie`, `Cache-Control`, `ETag`, `Location`
- Apps can define custom headers (e.g. `X-Correlation-Id` for tracing).

### HTTP versions in detail

Only the way messages are **carried** changes between versions. Methods, status codes, headers, cookies, caching rules and URLs stay the same, so application code doesn't care which version the client used.

| | HTTP/1.0 | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- | --- |
| Year | 1996 | 1997 (revised 2014) | 2015 | 2022 |
| Format | Text | Text | Binary frames | Binary frames |
| Transport | TCP | TCP | TCP (TLS in practice) | QUIC over UDP (TLS 1.3 built in) |
| Connections | New one per request | Keep-alive by default | One per origin, multiplexed | One per origin, multiplexed |
| Header compression | None | None | HPACK | QPACK |
| Head-of-line blocking | Yes | Yes, per connection | Solved in HTTP, **still present in TCP** | Gone (independent streams) |
| Setup cost (new HTTPS connection) | TCP + TLS each request | TCP (1 RTT) + TLS (1 to 2 RTT) | Same as 1.1 | 1 RTT (0-RTT on resumption) |

#### HTTP/1.0
Every request opened a new TCP connection and closed it afterwards, so each one paid the TCP (and TLS) handshake.

#### HTTP/1.1
- **Keep-alive**: one TCP connection is reused for many requests.
- **`Host` header**: many sites can share one IP address (virtual hosting), which is why SNI and reverse proxies work.
- Chunked transfer encoding, caching headers (`Cache-Control`, `ETag`), range requests.
- **Weakness, head-of-line blocking**: responses must come back in request order. One slow response delays the ones behind it. Browsers opened about 6 connections per host, and developers used workarounds: bundling files, image sprites, domain sharding.

#### HTTP/2
- **Multiplexing**: many requests and responses interleave as frames on one connection.
- **HPACK header compression**: repeated headers (`Cookie`, `User-Agent`) are sent as small references. This reduces the per-request cookie cost.
- Binary framing and stream prioritization. Server push exists but is deprecated and effectively unused in browsers.
- **Weakness**: everything rides on one TCP connection. One lost packet makes TCP hold back **all** streams until it is retransmitted, which hurts on lossy mobile networks.

#### HTTP/3
- Runs on **QUIC**: reliability, congestion control and TLS 1.3 encryption built on UDP, in user space.
- **Independent streams**: a lost packet stalls only its own stream.
- **Faster setup**: transport and TLS handshakes are combined (1 RTT, 0-RTT on resumption, with the replay risk covered under TLS).
- **Connection migration**: a connection ID (not IP and port) identifies the connection, so switching from Wi-Fi to mobile data doesn't break it.
- **Costs**: some networks block UDP (clients fall back to HTTP/2), and CPU use on servers is higher.

#### How a version gets chosen
- **HTTP/2**: negotiated inside the TLS handshake with **ALPN** (`h2` or `http/1.1`).
- **HTTP/3**: the server advertises it with `Alt-Svc: h3=":443"` (or a DNS HTTPS record). The browser then tries QUIC and falls back to TCP if it fails.

```bash
curl -I --http1.1 https://example.com    # force HTTP/1.1
curl -I --http2   https://example.com    # force HTTP/2
curl -I --http3   https://example.com    # needs a curl build with HTTP/3 support
```

In browser DevTools, Network tab, enable the **Protocol** column (`http/1.1`, `h2`, `h3`).

#### In practice
- A CDN or reverse proxy usually speaks HTTP/2 or HTTP/3 to browsers and HTTP/1.1 (or h2c) to your app behind it. That is normal.
- **gRPC requires HTTP/2.**
- With HTTP/2 and 3, bundling everything into one file and domain sharding stop helping, and can hurt caching.
- Kestrel supports all three. HTTP/3 needs TLS 1.3 and OS QUIC support:

```csharp
builder.WebHost.ConfigureKestrel(o =>
{
    o.ConfigureEndpointDefaults(l =>
        l.Protocols = HttpProtocols.Http1AndHttp2AndHttp3);
});
```

- `HttpClient` can request a version: `new HttpRequestMessage(HttpMethod.Get, url) { Version = HttpVersion.Version20, VersionPolicy = HttpVersionPolicy.RequestVersionOrLower }`.

### Why this matters
- Choosing the right method and status code is the core of good REST API design.
- Idempotency decides which requests are safe to retry automatically.
- Most debugging starts with: what did the request look like, and what status and headers came back?

### Self-check
- Why is it dangerous if a GET request deletes data?
- A user is logged in but opens another user's order. 401 or 403?
- A client retries a timed-out PUT and a timed-out POST. Which retry is safer, and why?

### Interview questions and answers

**Q1. [Basic] What does "HTTP is stateless" mean, and how do apps keep state anyway?**

**A.** Each request is independent: the protocol keeps no memory of earlier requests. State is added on top with cookies carrying a session ID (server-side sessions), tokens such as JWTs in the `Authorization` header, hidden form fields, query parameters, or client-side storage that scripts send explicitly. The benefit of statelessness is that any server can handle any request, which makes scaling easy.

**Q2. [Basic] GET vs POST?**

**A.** GET reads data: it is safe and idempotent, has no body by convention, can be cached and bookmarked, and must not change state. POST sends data in the body to create something or trigger an action: it is not idempotent and not cached by default. It is not a security difference: both are readable on the wire without HTTPS. Query strings leak into logs, browser history and `Referer` headers, so never put secrets in them.

**Q3. [Intermediate] Explain safe vs idempotent, and which methods are which.**

**A.** **Safe** means the request doesn't change server state (GET, HEAD, OPTIONS). **Idempotent** means repeating it leaves the same end state as doing it once (GET, HEAD, OPTIONS, PUT, DELETE). POST is neither; PATCH isn't guaranteed to be idempotent. It matters for retries: clients and proxies can retry idempotent requests after a timeout, but retrying a POST can duplicate the action (a double charge). Idempotent doesn't mean the same response: a repeated `DELETE` can return `204`, then `404`, with the same end state.

**Q4. [Intermediate] PUT vs PATCH vs POST?**

**A.** **PUT** replaces the whole resource at a known URL (idempotent). **PATCH** applies a partial change (JSON Patch or merge patch). **POST** creates a new resource where the server picks the ID (`POST /orders` returns `201` and a `Location` header) or triggers a process.

**Q5. [Intermediate] 401 vs 403? When do you return 404 instead of 403?**

**A.** **401** ("unauthenticated"): missing or invalid credentials; the response should carry `WWW-Authenticate`, and logging in can fix it. **403**: the caller is known but not allowed; logging in again won't help. Return **404** instead of 403 when you don't want to reveal that a resource exists (for example another user's order).

**Q6. [Intermediate] Which status codes would you return for: created, accepted for async work, no content, validation failure, conflict, rate limited, dependency down?**

**A.**
- Created: `201` plus `Location`.
- Accepted for async processing: `202`, with a status URL.
- Success with nothing to return: `204`.
- Validation failure: `400` (ASP.NET Core's default for validation problems) or `422` (well-formed but invalid).
- Conflict (duplicate, version mismatch): `409`; a failed `If-Match` precondition is `412`.
- Rate limited: `429` plus `Retry-After`.
- Dependency down: `503` plus `Retry-After`, or `502`/`504` when you are a gateway.

**Q7. [Intermediate] 301 vs 302 vs 303 vs 307 vs 308?**

**A.**
- **301** permanent, **308** permanent and method-preserving.
- **302** temporary, **307** temporary and method-preserving.
- **303** always continues with GET (used for Post/Redirect/Get after a form POST).

301 and 302 historically let clients turn POST into GET, which is why 307 and 308 exist. Browsers cache permanent redirects aggressively, so test with temporary ones first. Never redirect to an unvalidated `returnUrl` (open redirect); use `LocalRedirect`.

**Q8. [Intermediate] How does HTTP caching work (Cache-Control, ETag, 304)?**

**A.** The server sends `Cache-Control: max-age=N` (fresh for N seconds, so no request) plus validators (`ETag`, `Last-Modified`). After expiry the client sends a conditional request (`If-None-Match`), and the server answers `304 Not Modified` with no body if nothing changed. `no-cache` means "revalidate before reuse", not "don't store"; `no-store` means never store; `private` keeps it out of shared caches; `Vary` creates separate cached variants.

**Q9. [Advanced] HTTP/1.1 vs HTTP/2 vs HTTP/3?**

**A.**
- **1.1**: text protocol, one request at a time per connection (browsers open about 6 connections per host), head-of-line blocking.
- **2**: binary framing, many multiplexed streams over one TCP connection, HPACK header compression. A lost TCP packet still stalls all streams (TCP-level head-of-line blocking).
- **3**: HTTP over QUIC (on UDP): independent streams, faster setup (transport and TLS 1.3 combined), connection migration across networks.

Semantics (methods, status codes, headers) are the same in all three. HTTP/3 needs TLS and UDP port 443 open.

**Q10. [Intermediate] How would you make a POST safe to retry?**

**A.** Use an **idempotency key**: the client sends a unique `Idempotency-Key` header; the server stores the key and the result (database or Redis, with a unique constraint), and on a repeat returns the stored response instead of running the action again. Handle two simultaneous requests with the same key (lock or unique constraint). Alternatives: PUT with a client-generated ID, optimistic concurrency with `ETag` and `If-Match`, or de-duplication on a natural business key.

**Q11. [Intermediate] What is a CORS preflight and why do browsers send OPTIONS?**

**A.** For cross-origin requests that aren't "simple" (custom headers, a JSON `Content-Type`, PUT or DELETE), the browser first asks the target with an `OPTIONS` request whether the origin, method and headers are allowed. The server answers with `Access-Control-Allow-Origin`, `-Methods` and `-Headers`. CORS is enforced by the **browser** to protect users; it is not server-side access control and doesn't stop curl or other servers. Sending cookies cross-origin needs `Access-Control-Allow-Credentials: true` and a specific origin, not `*`.

**Q12. [Basic] Content-Type vs Accept?**

**A.** `Content-Type` says what format the body you're sending is in; `Accept` says which formats the client can handle (content negotiation). If the server can't produce an acceptable format it may return `406`; if it can't read the request's format, `415`. `Accept-Encoding` and `Content-Encoding` do the same for compression.

**Q13. [Intermediate] What is head-of-line blocking, and how does each HTTP version deal with it?**

**A.** It's when one delayed item holds up everything queued behind it. In HTTP/1.1, responses on a connection must return in order, so a slow one blocks the rest (browsers open about 6 connections to cope). HTTP/2 multiplexes streams on one connection, which removes it at the HTTP level, but TCP delivers bytes in order, so one lost packet still stalls all streams. HTTP/3 runs on QUIC, where each stream is recovered independently, so loss only affects the stream it hit.

**Q14. [Intermediate] How does a client end up using HTTP/2 or HTTP/3?**

**A.** HTTP/2 is negotiated during the TLS handshake with ALPN: the client lists `h2` and `http/1.1`, the server picks one. HTTP/3 can't be assumed, since it uses UDP, so the server advertises it via an `Alt-Svc: h3=":443"` header (or a DNS HTTPS record); the browser then attempts QUIC and falls back to HTTP/2 over TCP if UDP is blocked.

**Q15. [Advanced] Which HTTP/1.1 performance tricks become unnecessary or harmful with HTTP/2?**

**A.** Domain sharding (extra connections defeat multiplexing and add handshakes), large bundles and image sprites (one change invalidates the whole cached file; many small files are cheap with multiplexing), and inlining resources. HTTP/2 server push was meant to replace some of these but is deprecated; use `103 Early Hints` or `preload` instead.

**Q16. [Intermediate] Your app is behind Nginx or a CDN. Do you need HTTP/2 or HTTP/3 in Kestrel?**

**A.** Usually not. The proxy terminates the browser's connection (HTTP/2 or 3) and talks HTTP/1.1 to the app over a fast private link, where multiplexing matters little. You'd enable HTTP/2 in Kestrel for gRPC (which requires it), for proxies that forward h2, or when clients connect to the app directly.

---

## Topic 3: TCP/IP basics

### The layers (simplified)

| Layer | Job | Example |
| --- | --- | --- |
| Application | The conversation itself | HTTP, DNS, SSH |
| Transport | Delivery between programs | TCP, UDP (uses ports) |
| Internet | Addressing and routing between machines | IP |
| Link | Moving bits over one physical hop | Wi-Fi, Ethernet |

### IP: addressing and routing
- An IP address identifies a machine on a network (`203.0.113.10` is IPv4; IPv6 is the longer format).
- Data is split into **packets**. Each is routed independently and may arrive late, out of order, duplicated, or not at all. IP is "best effort" with no guarantees (like the postal system).

### TCP: reliable, ordered stream on top of IP
- Adds sequence numbers, acknowledgments (ACKs), retransmission of lost packets, flow control and congestion control.
- The app sees a clean, ordered stream of bytes.

### What a "connection" is
- Not a physical wire. It's shared state (sequence numbers, buffers) kept by both ends.
- Identified by 4 values: source IP, source port, destination IP, destination port.
- **Three-way handshake**: SYN, SYN-ACK, ACK. Costs one round trip before any data. Closed with FIN/ACK.

### Ports
- A number from 0 to 65535. IP gets a packet to the machine; the port gets it to the right program.
- Well-known ports: 80 HTTP, 443 HTTPS, 22 SSH, 53 DNS, 1433 SQL Server, 5432 PostgreSQL, 3306 MySQL, 6379 Redis, 5672 RabbitMQ.
- Servers **listen** on a fixed port. Clients use a random temporary (ephemeral) port.
- Only one program can listen on a port at a time ("address already in use").
- Docker `-p 8080:80` maps host port 8080 to container port 80.

### TCP vs UDP

| | TCP | UDP |
| --- | --- | --- |
| Connection | Handshake first | None, just send |
| Delivery | Guaranteed, retransmits lost data | Not guaranteed |
| Order | Preserved | Not preserved |
| Speed | Slower start, more overhead | Low latency, light |
| Used for | HTTP/1.1 and 2, databases, SSH, email | DNS queries, video calls, gaming, streaming, HTTP/3 (QUIC) |

- Rule of thumb: TCP when every byte must arrive correctly; UDP when speed matters more than perfection.

### Deep dive: the TCP/IP model with an example

#### Why layers exist

Sending data across the world involves separate problems: representing the message, delivering it to the right program, finding a path across networks, and moving bits over a wire or radio wave. Instead of one giant protocol, the internet splits the work into four layers. Each layer does one job, talks only to the layer above and below, and can be swapped without breaking the others (Wi-Fi to Ethernet, IPv4 to IPv6, HTTP/1.1 to HTTP/2).

| Layer | Question it answers | Examples |
| --- | --- | --- |
| Application | What are we saying? | HTTP, DNS, SSH, SMTP |
| Transport | Which program, and how reliably? | TCP, UDP |
| Internet | Which machine, and what route? | IP |
| Link | How do bits cross this one hop? | Ethernet, Wi-Fi |

#### The core idea: encapsulation

Going **down** the layers on the sender, each layer wraps the data with its own header, like putting a letter in an envelope, then that envelope in a bigger one (**encapsulation**). On the receiver, each layer removes its own wrapper going **up** (**decapsulation**).

#### A worked example

Your laptop (`192.168.1.5`) sends `GET /products` to `shop.example.com` (`203.0.113.10`, port 443).

1. **Application layer.** The browser creates the HTTP message (`GET /products HTTP/1.1`, `Host: shop.example.com`). With HTTPS, TLS encrypts it first; TLS sits at this level in the TCP/IP model.
2. **Transport layer (TCP).** Adds a header: source port `52144` (random temporary port), destination port `443`, a sequence number, flags. Big messages are chopped into pieces, each with its own sequence number. Each piece is a **segment**.
3. **Internet layer (IP).** Adds a header: source IP `192.168.1.5`, destination IP `203.0.113.10`, a TTL counter. Now it's a **packet**.
4. **Link layer (Wi-Fi/Ethernet).** The laptop can only send to the next hop, the home router, so the router's MAC address is the destination, plus a checksum. Now it's a **frame**, sent out as radio signals or electrical pulses.

Summary:

| Layer | Adds | Result | Example values |
| --- | --- | --- | --- |
| Application | The HTTP message | Data | `GET /products HTTP/1.1 ...` |
| Transport (TCP) | Source/destination port, sequence number, flags | Segment | `52144 -> 443`, seq 1001 |
| Internet (IP) | Source/destination IP, TTL | Packet | `192.168.1.5 -> 203.0.113.10` |
| Link (Ethernet/Wi-Fi) | Source/destination MAC, checksum | Frame | laptop MAC -> router MAC |

```
[ Frame hdr | [ IP hdr | [ TCP hdr | HTTP data ] ] | Frame trailer ]
```

#### The journey and the server side

Three kinds of address:
- **MAC**: identifies the next hop only; rewritten at every router.
- **IP**: identifies the destination machine end to end (stays the same across hops, except NAT at your home router swaps your private IP for the public one).
- **Port**: identifies the program on that machine.

Journey: laptop -> home router (NAT) -> ISP -> many routers -> server network -> server. Routers read only up to the IP header, pick the next hop, decrement TTL (drops the packet at 0, preventing loops), and rebuild the frame.

At the server: link layer accepts the frame, IP checks the destination is this machine, TCP reorders segments and hands data to whichever process listens on port 443, and the app (Nginx/Kestrel) reads the HTTP request.

TLS (HTTPS) sits between TCP and HTTP: it encrypts the HTTP data before TCP wraps it. Routers can see IPs and ports but not the HTTP content.

Mapping to OSI: Application = OSI 5-7, Transport = 4, Internet = 3, Link = 1-2.

Debugging ladder (bottom up):
- `ping host` -> is the machine reachable (IP level)?
- `nc -vz host 443` or `telnet host 443` -> is the port open (TCP level)?
- `curl -v https://host/path` -> does the app answer correctly (HTTP level)?
- Load balancers: **L4** balances on IP and port only; **L7** reads HTTP (paths, headers) and can route by them.
- Wireshark or `tcpdump` show the actual headers on the wire.

### Why this matters for backend work
- Connection setup costs round trips, so we reuse connections: HTTP keep-alive and **database connection pooling**.
- In .NET, creating a new `HttpClient` per request can exhaust sockets; use `IHttpClientFactory`.
- **Connection refused** = machine reachable but nothing listening on that port (service down, wrong port). **Timed out** = packets silently dropped (firewall, wrong IP, network issue).
- Firewalls and cloud security groups open or close **ports**.
- Binding: listening on `localhost` accepts only local connections; `0.0.0.0` accepts from anywhere (needed inside Docker).
- Set both a connect timeout and a read timeout on outgoing calls.

### Self-check
- Why can't IP alone guarantee a web page arrives complete and in order, and what does TCP add?
- "Connection refused" vs "connection timed out": what does each suggest?
- Why does DNS typically use UDP while a payment API uses TCP?

### Interview questions and answers

**Q1. [Basic] TCP vs UDP?**

**A.**
- **TCP**: connection-oriented, reliable, ordered, with flow and congestion control. Used for HTTP/1.1 and HTTP/2, databases, SSH, email.
- **UDP**: connectionless, no delivery or order guarantee, low overhead and latency. Used for DNS queries, video calls, games, streaming, and QUIC (HTTP/3).

Choose TCP when every byte must arrive correctly, UDP when late data is useless anyway or the application adds its own reliability.

**Q2. [Intermediate] Explain the TCP three-way handshake. Why three steps?**

**A.** SYN (client sends its initial sequence number), SYN-ACK (server sends its own and acknowledges the client's), ACK (client acknowledges the server's). Each side has to announce its initial sequence number and have it acknowledged; three messages are the minimum to confirm both directions. It costs one round trip before data flows (data can ride on the final ACK). A **SYN flood** attack fills the server's half-open connection table; **SYN cookies** are the standard defence.

**Q3. [Intermediate] How does TCP provide reliability, flow control and congestion control?**

**A.**
- **Reliability**: sequence numbers, acknowledgments, retransmission on timeout or after three duplicate ACKs (fast retransmit), checksums.
- **Flow control**: the receiver advertises a window so a fast sender doesn't overwhelm a slow receiver.
- **Congestion control**: the sender keeps a congestion window (slow start, then congestion avoidance, backing off on loss) so it doesn't overwhelm the network. Common algorithms: CUBIC, BBR.

The amount in flight is limited by the smaller of the two windows.

**Q4. [Intermediate] What is TIME_WAIT, and how can it hurt a .NET app?**

**A.** The side that closes a connection first keeps it in `TIME_WAIT` for a while (about 60 seconds on Linux, 240 seconds by default on Windows) to make sure the final ACK arrives and old packets don't leak into a new connection with the same 4-tuple. If you create and dispose a new `HttpClient` per request, you close many connections, pile up `TIME_WAIT` sockets, and can exhaust ephemeral ports (`SocketException`). Fix: reuse one `HttpClient` or use `IHttpClientFactory`, and set `PooledConnectionLifetime` so connections still pick up DNS changes.

**Q5. [Basic] What is a port, a socket, and what identifies a TCP connection?**

**A.** A port is a 16-bit number that identifies a program on a host. A socket is an endpoint (IP address plus port). A TCP connection is identified by the 4-tuple: source IP, source port, destination IP, destination port. That is why one server on port 443 can serve thousands of clients: every connection has a different tuple. Servers listen on a fixed port; clients get a temporary (ephemeral) port. Only one process can listen on a given IP and port ("address already in use").

**Q6. [Intermediate] "Connection refused" vs "timed out" vs "connection reset"?**

**A.**
- **Refused**: the host is reachable and replied with a reset because nothing listens on that port (service down, wrong port, listening only on localhost). It fails immediately.
- **Timed out**: no reply at all, so packets are being dropped (firewall or security group, wrong IP, host down, routing). It fails slowly.
- **Reset**: a connection existed but the peer or a middlebox aborted it (app crashed, proxy or load balancer idle timeout, socket closed with unread data).

Tools: `ping`, `nc -vz host port`, `curl -v`, `ss -tlnp`, and firewall rules.

**Q7. [Intermediate] IP vs MAC vs port: what changes at each router hop?**

**A.** MAC addresses (link layer) change at every hop; they identify only the next hop. IP addresses stay the same end to end, except that NAT rewrites the source IP (and often port) at the network edge. Ports stay the same unless NAT rewrites them. The TTL is decremented at each hop and the packet is dropped at zero (the basis of `traceroute`).

**Q8. [Intermediate] TCP/IP model vs OSI. What are L4 and L7 load balancers?**

**A.** TCP/IP has 4 layers (application, transport, internet, link); OSI has 7. "L4" means transport: the balancer sees IP and port only, is very fast, can pass TLS through, but can't route by URL. "L7" means application: it reads HTTP, so it can route by host, path or header, terminate TLS, rewrite requests and run a WAF, at a higher CPU cost. Examples: AWS NLB vs ALB, Azure Load Balancer vs Application Gateway.

**Q9. [Advanced] Why does HTTP/3 use UDP?**

**A.** With HTTP/2 over TCP, one lost packet stalls every multiplexed stream (TCP delivers in order). TCP also lives in operating system kernels and middleboxes, so it's hard to change, and TCP plus TLS needs extra round trips. QUIC builds reliable, encrypted, multiplexed streams in user space on top of UDP: streams recover from loss independently, setup takes 1 RTT (0-RTT on resumption), and connection IDs let a connection survive a switch from Wi-Fi to mobile data. Trade-offs: some networks block or throttle UDP, and CPU cost is higher.

**Q10. [Intermediate] Your container works inside Docker but is unreachable from the host. Why?**

**A.** Usually the app listens on `localhost` or `127.0.0.1` inside the container, which only accepts connections from inside it. Bind to `0.0.0.0` (`ASPNETCORE_URLS=http://+:8080`), publish the port (`-p 8080:8080`), and check firewalls and security groups.

**Q11. [Intermediate] What is NAT, and why does it matter to backend developers?**

**A.** NAT maps private addresses and ports to public ones (home routers, cloud NAT gateways). Consequences:
- Many users can share one public IP, so IP-based rate limiting or blocking can hit innocent users.
- Inbound connections need port forwarding or a load balancer.
- Idle NAT mappings expire and silently drop long-lived connections, so use TCP keep-alive or heartbeats.
- Outbound NAT can run out of ports (SNAT exhaustion) under heavy parallel connections.

---

## Topic 4: DNS (Domain Name System)

DNS is a distributed, hierarchical database that turns names (`shop.example.com`) into IP addresses (`203.0.113.10`). Machines route by IP; people remember names.

### Reading a domain (right to left)

`shop.example.com.` = subdomain `shop` + domain `example` + TLD `com` + root `.`

### Who is involved

**DNS (Domain Name System)** is the hierarchical, distributed database that acts as the internet's phone book, **translating human-readable domain names** (like `www.example.com`) into **machine-readable IP addresses** (like `192.0.2.1`) that computers use to locate and communicate with each other.

The system operates through a multi-step **DNS resolution** process involving four key server types:

- **Recursive Resolver:** The initial point of contact that receives the user's query and manages the search for the IP address.
- **Root Nameserver:** The first step in resolution, which directs the resolver to the appropriate Top-Level Domain (TLD) server.
- **TLD Nameserver:** Manages specific domain extensions (like `.com` or `.org`) and points the query to the authoritative server.
- **Authoritative Nameserver:** The final server that holds the actual DNS records and provides the specific IP address for the requested domain.

This distributed architecture ensures **scalability and fault tolerance**, allowing billions of daily requests to be processed in milliseconds without relying on a single centralized database.

### Resolution walk (when nothing is cached)

1. Browser/OS cache (and the hosts file) checked first.
2. Ask the recursive resolver: "IP for `shop.example.com`?"
3. Resolver asks a root server: "who handles `.com`?" -> gets TLD servers.
4. Resolver asks the `.com` server: "who handles `example.com`?" -> gets its name servers.
5. Resolver asks the authoritative server -> gets `203.0.113.10`, TTL 300.
6. Resolver caches it and answers; OS and browser cache it too.

- Client to resolver is **recursive** ("do it all for me"); resolver to servers is **iterative** (each replies with a referral).
- Usually UDP port 53. Uncached lookups take tens of ms; cached ones are near instant.

### Record types

| Type | Meaning |
| --- | --- |
| A | Name -> IPv4 address |
| AAAA | Name -> IPv6 address |
| CNAME | Alias to another name (not allowed at the zone apex, e.g. `example.com` itself) |
| MX | Mail servers for the domain |
| TXT | Free text: SPF/DKIM/DMARC, domain verification |
| NS | The authoritative name servers for the zone |
| PTR | Reverse lookup: IP -> name |

### TTL and "propagation"

- TTL = how long a cached answer may be reused.
- Low TTL (60-300 s): changes spread fast, more queries. High TTL (hours): fewer queries, slow changes.
- "DNS propagation" is just caches expiring. Before a migration, **lower the TTL ahead of time**, then change the record.

### Where backend developers use DNS

- Point a domain at a server, load balancer or CDN (A / CNAME records).
- Service discovery: Docker Compose and Kubernetes resolve service names (`db`, `orders-service`) through internal DNS, so connection strings use hostnames, not IPs.
- Round-robin DNS (several A records), geo-DNS, DNS-based failover (limited by TTL).
- Email setup (MX, SPF, DKIM, DMARC) and certificate validation (DNS challenge).
- **.NET gotcha:** a long-lived `HttpClient` keeps pooled connections open and never re-resolves DNS, so it can keep hitting an old IP after a failover. Set `PooledConnectionLifetime` on `SocketsHttpHandler` (or use `IHttpClientFactory`, which recycles handlers).

### Errors and debugging

- "Could not resolve host", `NXDOMAIN` (name doesn't exist), `SERVFAIL` (resolver failed to get an answer) = DNS problems, not your app code.
- Tools: `nslookup host`, `dig host`, `dig +short A host`, `dig @8.8.8.8 host` (ask a specific resolver), `dig +trace host` (walk root to authoritative).
- Flush local cache: Windows `ipconfig /flushdns`; Linux `resolvectl flush-caches`; macOS `sudo dscacheutil -flushcache`.
- Hosts file overrides DNS locally and is checked first: `C:\Windows\System32\drivers\etc\hosts` or `/etc/hosts`.

### Security notes

- Plain DNS is unencrypted and can be spoofed (cache poisoning). Defences: DNSSEC (signed records), DoH/DoT (encrypted DNS lookups).

### Self-check

- Why does DNS use a hierarchy instead of one giant list?
- You change an A record, but some users still reach the old server for an hour. Why, and what could you have done beforehand?
- A long-running .NET service keeps calling the old server after a failover, though DNS now points to the new IP. What is a likely cause?

### Interview questions and answers

**Q1. [Basic] What is DNS and how does a lookup work?**

**A.** DNS is a distributed, hierarchical database that maps names to IP addresses (and other records). Your app asks the OS stub resolver, which asks a recursive resolver (ISP, `8.8.8.8`, `1.1.1.1`). If the answer isn't cached, the resolver asks a root server ("who handles `.com`?"), then a TLD server ("who handles `example.com`?"), then the authoritative server for the real record. The answer is cached everywhere along the path for its TTL.

**Q2. [Intermediate] Recursive vs iterative queries? Recursive resolver vs authoritative server?**

**A.** In a **recursive** query the client says "do all the work and bring me the answer" (client to resolver). In **iterative** queries each server answers with the best it knows or a referral to the next server (resolver to root, TLD, authoritative). A **recursive resolver** does the walking and caches; an **authoritative server** holds the actual records for a zone and answers only for it.

**Q3. [Basic] Name the common record types.**

**A.**

| Type | Purpose |
| --- | --- |
| A / AAAA | Name to IPv4 / IPv6 address |
| CNAME | Alias to another name |
| MX | Mail servers |
| TXT | Free text: SPF, DKIM, DMARC, domain verification |
| NS | Name servers of the zone |
| SOA | Zone metadata (serial, negative-cache TTL) |
| PTR | Reverse lookup (IP to name) |
| SRV | Service host and port |

**Q4. [Intermediate] Why can't you put a CNAME at the root (apex) of a domain? What do you use instead?**

**A.** A CNAME must be the only record for its name, but the apex already holds SOA and NS records (and usually MX and TXT). Use A/AAAA records, or your provider's ALIAS/ANAME/"CNAME flattening" (Route 53 alias records, Cloudflare flattening, Azure alias records), which resolves on the server side and returns plain A records.

**Q5. [Intermediate] What is TTL, and how do you migrate a site to a new server without surprises?**

**A.** TTL is how many seconds a cached answer may be reused. "Propagation" is just caches expiring. Plan: lower the TTL (for example to 60 to 300 seconds) at least one old-TTL period before the change, change the record, keep the old server serving until traffic drains (some resolvers ignore TTL), then raise the TTL again. Failed lookups are cached too (negative caching, controlled by the SOA).

**Q6. [Intermediate] Where does DNS caching happen?**

**A.** Browser, OS stub resolver, home router, the ISP or public recursive resolver, and sometimes the application runtime. In .NET, pooled `HttpClient` connections keep using the IP they connected to, which is a form of "caching" DNS indefinitely.

**Q7. [Intermediate] Does DNS use UDP or TCP?**

**A.** Mostly UDP port 53: tiny request and response, no handshake cost. It falls back to TCP when the answer is too large (the truncated flag is set), for zone transfers, and with DNS over TLS. EDNS0 raised the UDP payload size beyond the classic 512 bytes.

**Q8. [Intermediate] NXDOMAIN vs SERVFAIL vs NODATA vs REFUSED?**

**A.**
- **NXDOMAIN**: the name doesn't exist.
- **NODATA** (NOERROR with an empty answer): the name exists but has no record of that type (for example no AAAA).
- **SERVFAIL**: the resolver couldn't get a valid answer (upstream unreachable, broken delegation, DNSSEC validation failure).
- **REFUSED**: the server refuses to answer (policy).

**Q9. [Advanced] Can DNS do load balancing and failover? What are the limits?**

**A.** Yes: several A records (round robin), weighted or geo/latency-based routing, and health-checked failover (Route 53, Azure Traffic Manager, Cloudflare). Limits: caching means failover takes at least a TTL (and sometimes longer), clients may stick to one IP, and DNS knows nothing about real load. For fast failover use a load balancer or anycast in front, and use DNS for coarse routing.

**Q10. [Advanced] What are the main DNS security risks and defences?**

**A.**
- **Cache poisoning or spoofing** (plain DNS is unauthenticated UDP): DNSSEC, source port randomization, DoH/DoT.
- **Hijacking** (stolen registrar or DNS account): MFA, registrar lock.
- **Subdomain takeover** (a dangling CNAME to a deleted cloud resource): audit and remove stale records.
- **DDoS on the DNS provider**: anycast, multiple providers.
- **DNS tunneling or exfiltration**: monitoring and egress filtering.

**Q11. [Intermediate] A long-running .NET service keeps calling the old server after a failover. Why?**

**A.** `HttpClient` keeps pooled connections open and doesn't re-resolve DNS for connections that are already established, so it can keep talking to the old IP. Fix: set `PooledConnectionLifetime` on `SocketsHttpHandler` (for example 2 to 5 minutes), or use `IHttpClientFactory`, which recycles handlers (default 2 minutes).

**Q12. [Basic] How do you debug a DNS problem?**

**A.** `nslookup host` or `dig host`; `dig +short A host`; `dig @8.8.8.8 host` to compare resolvers; `dig +trace host` to walk root, TLD, authoritative; check the hosts file (it overrides DNS locally); flush caches (`ipconfig /flushdns`, `resolvectl flush-caches`).

**Q13. [Intermediate] How does service discovery work in Docker Compose and Kubernetes?**

**A.** Both use built-in DNS. On a user-defined Docker network, containers resolve each other by service name through Docker's embedded resolver (`127.0.0.11`). In Kubernetes, CoreDNS gives every Service a name like `orders.shop.svc.cluster.local`, and headless Services return pod IPs. That is why connection strings use hostnames, not IP addresses.

---

## Topic 5: HTTPS and TLS

### The problem
Plain HTTP is readable text, and packets cross many untrusted hops (Wi-Fi, ISP, routers). Anyone on the path could **read** it, **modify** it, or **impersonate** the server.

### What TLS provides

| Goal | Meaning | How |
| --- | --- | --- |
| Confidentiality | Nobody on the path can read the data | Symmetric encryption (AES, ChaCha20) |
| Integrity | Tampering is detected | Authenticated encryption / MACs |
| Authentication | The server really is `shop.example.com` | Certificate + signature |

- **HTTPS = HTTP over TLS**, port 443. TLS (Transport Layer Security) replaced SSL; use TLS 1.2 or 1.3 (SSL and TLS 1.0/1.1 are deprecated, though people still say "SSL").
- **Why at this layer:** you can't trust the network, so encrypt once between TCP and the application. HTTP stays unchanged, and the same TLS protects other protocols too (SMTP, databases, gRPC).
- Routers still see IP addresses, ports and timing, but not the content.

### Two kinds of encryption (hybrid)

| | Symmetric | Asymmetric |
| --- | --- | --- |
| Keys | One shared secret | Key pair: public (shared) + private (secret) |
| Speed | Very fast | Slow |
| Problem it solves | Encrypting bulk data | Agreeing on a secret / proving identity (signatures) |
| Weakness | How to share the key safely? | Too slow for all data |

TLS uses key exchange (ECDHE) to agree on a shared secret over an open network, then switches to symmetric encryption for the actual data.

### Certificates (conceptual)
- Problem: how does the browser know a public key really belongs to `shop.example.com` and not an attacker?
- A **certificate** binds a domain name to a public key and is **signed by a Certificate Authority (CA)**. It contains: domain names, public key, issuer, validity dates, signature.
- **Chain of trust:** server certificate -> intermediate CA -> root CA. Root CAs are pre-installed in the OS/browser trust store. (Like a passport: you trust it because a government you trust vouches for it.)
- The browser checks: signature chain valid, domain matches, not expired, not revoked.
- The **private key** never leaves the server. If it leaks, attackers can impersonate the site.
- Let's Encrypt gives free, automated certificates (90-day lifetime, auto-renew). Self-signed certificates aren't trusted by default (dev: `dotnet dev-certs https --trust`).

### TLS 1.3 handshake (simplified)
1. **ClientHello**: supported versions/ciphers, client's key share, **SNI** (hostname wanted, so the server picks the right certificate), ALPN (`h2` or `http/1.1`).
2. **ServerHello**: chosen cipher, server's key share. Both sides now compute the same session keys. The server sends its certificate and a signature proving it holds the private key, encrypted.
3. Client verifies the certificate, sends Finished.
4. Encrypted HTTP flows.

- TLS 1.3 takes 1 extra round trip (TLS 1.2: 2). Total before the first HTTP byte: TCP 1 RTT + TLS 1 RTT.
- **Forward secrecy:** session keys are temporary, so recorded traffic can't be decrypted later even if the server's private key leaks.

### What each side holds

| Item | Server | Client | Secret? |
| --- | --- | --- | --- |
| Certificate chain (leaf + intermediates): domain names, public key, issuer, dates, CA signature | Holds it and sends it | Receives and verifies it | No, public |
| **Private key** matching the certificate | Holds it, never sends it | - | **Yes**; in TLS 1.3 it is used to *sign* the handshake |
| Trust store (root CA certificates) | Only for mTLS | Holds it (OS/browser) | No, public |
| Hostname expected (from the URL / SNI) and current time | - | Uses both to validate | No |
| Supported versions, cipher suites, ALPN protocols | Preferences/config | Offered in ClientHello | No |
| Ephemeral key pair (new for every handshake) | Yes | Yes | Private half is secret, discarded after |
| Random values (client_random, server_random) | Yes | Yes | No |
| Session (traffic) keys, derived from the shared secret | Yes | Yes | **Yes**; memory only, one set per direction, discarded at close |
| Session ticket (resumption) | Holds the ticket-encryption key | Stores the opaque ticket | Yes (the key) |
| Client certificate + private key (mTLS only) | Verifies it | Holds it | Private key yes |

### Handshake in detail (TLS 1.3, after TCP is connected)

```
Client                                              Server
  |--- ClientHello (key_share, SNI, ALPN, ciphers) ---->|
  |                                                     |  picks cipher, makes its own ephemeral key
  |<-- ServerHello (key_share) -------------------------|  <- everything below is encrypted
  |<-- {EncryptedExtensions}                            |
  |<-- {Certificate}                                    |
  |<-- {CertificateVerify}                              |
  |<-- {Finished}                                       |
  | (verify chain, hostname, dates, signature)          |
  |--- {Finished} ------------------------------------>|
  |=== {HTTP request} ===============================> |
  |<== {HTTP response} ================================ |
```

1. **ClientHello** (plaintext): supported versions, `client_random`, cipher suites, key exchange groups (e.g. x25519), the client's **ephemeral public key** (`key_share`), signature algorithms, **SNI** (`shop.example.com`), **ALPN** (`h2`, `http/1.1`), optionally a resumption ticket.
2. **ServerHello** (plaintext): chosen version and cipher suite, `server_random`, the server's ephemeral public key. Now both sides compute the **same shared secret** with ECDHE (client: its private key x server's public key; server: its private key x client's public key). Both derive handshake keys; **everything after this is encrypted**.
3. **Server's encrypted flight**:
   - `EncryptedExtensions`: negotiated options (e.g. the chosen ALPN protocol).
   - `Certificate`: the chain.
   - `CertificateVerify`: a **signature over the handshake transcript made with the server's private key**; it proves the server holds the key matching the certificate and binds the key exchange to that identity.
   - `Finished`: a MAC over the whole handshake; detects tampering and downgrade attempts.
4. **Client verification**:
   - Chain: leaf signed by an intermediate, intermediate by a root, root in the trust store, all signatures valid.
   - Hostname matches the certificate's names (SAN).
   - Current time inside the validity dates.
   - Intended use allows server authentication; revocation status checked where available (OCSP stapling, CRLs, browser lists; many clients are lenient on failures).
   - `CertificateVerify` and `Finished` are valid.
5. **Client `Finished`** (and a client certificate in mTLS). Both sides derive the **application traffic keys** (separate per direction).
6. **Application data**: HTTP is encrypted with an authenticated cipher (AES-GCM or ChaCha20-Poly1305). A sequence number in each record prevents replay and reordering.

- Total cost: **1 round trip** after TCP. A legacy no-op "change cipher spec" message may appear for middlebox compatibility.
- If the client guessed an unsupported key exchange group, the server sends HelloRetryRequest (one extra round trip).

**Why Diffie-Hellman *and* a signature?**
- DH lets two strangers agree on a secret over an open network, but on its own it's unauthenticated: a man in the middle could do one DH with you and one with the server.
- The server's signature (`CertificateVerify`) over the transcript, checked against a CA-vouched certificate, proves the DH partner really is `shop.example.com`.
- A certificate alone isn't enough either: it's public and could be replayed; the signature proves live possession of the private key.
- Fresh ephemeral keys per connection give **forward secrecy**.

**Intuition for DH (paint mixing):** both pick a secret colour; each mixes it with a public colour and sends the mixture; each adds their own secret to the other's mixture and both end with the same final colour. An eavesdropper sees only the mixtures.

**TLS 1.2 vs 1.3**

| | TLS 1.2 | TLS 1.3 |
| --- | --- | --- |
| Handshake cost | 2 round trips | 1 round trip |
| Certificate | Sent in plaintext | Encrypted |
| Cipher suites | Many, including legacy weak ones | A few modern AEAD suites |
| RSA key exchange (no forward secrecy) | Allowed | Removed |
| Forward secrecy | Optional | Mandatory |
| Resumption early data (0-RTT) | No | Optional, with replay risk (only for safe/idempotent requests) |

**Resumption:** after a handshake the server sends a session ticket (encrypted state). The client presents it next time to skip the certificate exchange (abbreviated handshake).

**What an observer sees:** the ClientHello (including SNI, ALPN, offered ciphers, unless ECH), the ServerHello; in TLS 1.2 also the certificate. After the Finished messages, only encrypted records.

**Failures you will see:** `unknown_ca` / untrusted issuer, `bad_certificate` or name mismatch, `certificate_expired`, `protocol_version` or `handshake_failure` (no common version/cipher). A man in the middle can't pass: their certificate isn't trusted or doesn't match the hostname, and they can't produce `CertificateVerify` without the real private key.

**See it live**
- `curl -v https://example.com` prints lines like:

```
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* TLSv1.3 (IN), TLS handshake, Server hello (2):
* TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):
* TLSv1.3 (IN), TLS handshake, Certificate (11):
* TLSv1.3 (IN), TLS handshake, CERT verify (15):
* TLSv1.3 (IN), TLS handshake, Finished (20):
* TLSv1.3 (OUT), TLS handshake, Finished (20):
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
```

- `openssl s_client -connect example.com:443 -servername example.com -tls1_3` shows the chain, protocol and cipher.
- Wireshark with filter `tls.handshake`; set the `SSLKEYLOGFILE` environment variable to let it decrypt your own browser traffic.

**In .NET (client side)**

```csharp
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;

using var tcp = new TcpClient("example.com", 443);
using var ssl = new SslStream(tcp.GetStream());
await ssl.AuthenticateAsClientAsync(new SslClientAuthenticationOptions
{
    TargetHost = "example.com",                          // SNI + hostname check
    EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
    ApplicationProtocols = new List<SslApplicationProtocol>
        { SslApplicationProtocol.Http2, SslApplicationProtocol.Http11 }
});

Console.WriteLine(ssl.SslProtocol);                      // Tls13
Console.WriteLine(ssl.NegotiatedCipherSuite);            // TLS_AES_256_GCM_SHA384
Console.WriteLine(ssl.NegotiatedApplicationProtocol);    // h2
Console.WriteLine(ssl.RemoteCertificate?.Subject);
```

### Who is allowed to connect? TLS authenticates the server, not the client

- With normal (server-only) TLS, **any client can connect and complete the handshake**. TLS gives confidentiality, integrity and *server* authentication; it is not access control.
- "Is this client valid?" is decided by one of these, at different points:

```
1. TCP connect     -> firewall / security group / IP allowlist   (who may reach the port)
2. TLS handshake   -> server proves identity; with mTLS the client proves identity with a certificate
3. HTTP request    -> cookie / token / API key                   -> 401 if not authenticated
4. Authorization   -> roles / policies / claims                  -> 403 if not allowed
```

| Method | Proves | Checked when | Typical use |
| --- | --- | --- | --- |
| Standard TLS | Server only | Handshake | Every HTTPS website |
| **mTLS** (client certificate) | Server and client (a device/service) | Handshake, before any HTTP | Service-to-service, B2B APIs, IoT, internal APIs |
| Password + session cookie | A user | Every request, after the handshake | Websites |
| Token (JWT/OAuth2) or API key | A user or app | Every request, after the handshake | APIs, SPAs, mobile |
| IP allowlist / firewall / VPN | Network location | Before TLS | Admin panels, internal services |

**mTLS (mutual TLS)**
- The server asks for a client certificate during the handshake. The client proves it holds the certificate's **private key**, and the server checks the certificate against CAs it trusts for clients.
- Extra messages in the TLS 1.3 handshake:

```
Server: {EncryptedExtensions} {CertificateRequest} {Certificate} {CertificateVerify} {Finished}
Client: {Certificate} {CertificateVerify (signed with the CLIENT's private key)} {Finished}
```

- Extra things held: **client** holds a client certificate + private key; **server** holds the CA certificate(s) it accepts for clients.
- Server checks: chain leads to a trusted client CA, validity dates, intended use (`clientAuth`), the `CertificateVerify` signature, revocation where configured; then maps the certificate (subject or thumbprint) to an identity and permissions.
- Failure shows up as a handshake alert (`certificate required`, `bad certificate`, `unknown ca`) or an HTTP 400 from the proxy; either way the request never reaches your app.
- Client certificates usually come from your **own private CA** (Vault, step-ca, AD CS, cert-manager); public CAs are increasingly moving away from issuing client-authentication certificates.
- mTLS identifies the **device/service** holding the key, not necessarily the human; combine with user authentication when needed.

Nginx (validated at the proxy):

```nginx
server {
    listen 443 ssl;
    server_name api.example.com;
    ssl_certificate        /etc/ssl/api.crt;
    ssl_certificate_key    /etc/ssl/api.key;

    ssl_client_certificate /etc/ssl/client-ca.pem;   # CAs allowed to issue client certificates
    ssl_verify_client on;                            # "optional" lets the app decide

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header X-Client-Cert-Subject $ssl_client_s_dn;
        proxy_set_header X-Client-Verify $ssl_client_verify;
    }
}
```

Behind a proxy, the proxy validates the certificate and passes details in headers; ASP.NET Core can read the forwarded certificate with `AddCertificateForwarding` / `UseCertificateForwarding`. Only trust such headers from your proxy.

ASP.NET Core / Kestrel (package `Microsoft.AspNetCore.Authentication.Certificate`):

```csharp
builder.WebHost.ConfigureKestrel(k =>
    k.ConfigureHttpsDefaults(h => h.ClientCertificateMode = ClientCertificateMode.RequireCertificate));

builder.Services.AddAuthentication(CertificateAuthenticationDefaults.AuthenticationScheme)
    .AddCertificate(o =>
    {
        o.AllowedCertificateTypes = CertificateTypes.Chained;           // reject self-signed
        o.ChainTrustValidationMode = X509ChainTrustMode.CustomRootTrust; // .NET 7+: trust only your CA
        o.CustomTrustStore.Add(new X509Certificate2("client-ca.crt"));
    });

app.UseAuthentication();
app.UseAuthorization();
// then protect endpoints with [Authorize] / RequireAuthorization()
```

.NET client:

```csharp
var handler = new HttpClientHandler();
handler.ClientCertificates.Add(new X509Certificate2("client.pfx", password));
using var client = new HttpClient(handler);
var response = await client.GetAsync("https://api.example.com/orders");
```

curl: `curl --cert client.crt --key client.key --cacert server-ca.crt https://api.example.com/orders`

**Other notes**
- Handshakes cost CPU (public-key cryptography), so unauthenticated clients can still burn server resources: use rate limits, connection limits, SYN cookies, a CDN/WAF in front, TLS session resumption.
- Real-world analogy: normal HTTPS is a bank whose building is proven genuine; anyone can walk in, and the teller then checks your ID (app-layer auth). mTLS is a door that needs your badge before you get in at all.

### Preventing someone from pretending to be a client

"Pretending to be the client" covers four different attacks:

| Attack | What the attacker does | What stops it |
| --- | --- | --- |
| Fake client | Connects and claims to be a legitimate client | Client authentication: mTLS, tokens + MFA, device attestation |
| Fake server / MITM | Sits between client and server, answering as each | Certificate validation (chain + hostname), HSTS, pinning, CT/CAA; never disable validation |
| Stolen identity | Steals a real client's cookie/token/key and uses it elsewhere | Protect and **bind** credentials: HttpOnly, short lifetimes, hardware-backed keys, certificate-bound tokens, DPoP |
| Replay | Records genuine requests and resends them | Per-connection keys (TLS), nonces/idempotency keys/timestamps, no unrestricted 0-RTT |

- Standard TLS does **not** authenticate the client; you must add it (mTLS or application-layer authentication).
- TLS itself already blocks replaying a recorded session (fresh ephemeral keys, sequence numbers) and relaying a handshake (the signature covers the whole transcript). The weak spot is **stolen credentials**: a valid cookie, token or key works from any machine.

**Defence layers**
1. **Authenticate the client strongly**: mTLS for services/devices; for users, passwords + MFA (passkeys/WebAuthn are phishing-resistant), then short-lived tokens.
2. **Protect the secrets**:
   - Client private keys in hardware or the OS keystore (TPM, smart card, HSM, Secure Enclave), **non-exportable**; load from the store, not from a `.pfx` + password beside the app.
   - **Short-lived certificates** (hours to days) issued automatically (Vault, cert-manager, SPIFFE/SPIRE), so a theft expires quickly.
   - Cookies: `HttpOnly`, `Secure`, `SameSite`, `__Host-`; short lifetimes; refresh-token rotation; revoke on logout; fix XSS (CSP).
   - Don't ship a shared client certificate or API key inside a mobile app binary (it can be extracted). Use per-device enrollment and app attestation (Play Integrity, App Attest).
3. **Bind credentials to the client**: certificate-bound access tokens (RFC 8705: the token carries the certificate hash, and the server compares it with the certificate from the TLS handshake) or **DPoP** (RFC 9449: the client signs each request with its private key). A stolen token alone is then useless. Browser-side device-bound cookies are emerging (check current support).
4. **Stop replay**: keep TLS 1.3 0-RTT off (`ssl_early_data off`) unless you handle replay (only idempotent requests, `425 Too Early`); at the application level use nonces, timestamps, idempotency keys and short expirations.
5. **Stop MITM**: always validate the server certificate and hostname, use HSTS, never disable validation, monitor Certificate Transparency logs, set DNS CAA records. Certificate pinning is optional for apps you control (pin the public key, keep a backup pin). A rogue root CA installed on a device defeats normal validation; manage devices (MDM).
6. **Limit and detect**: least-privilege authorization after authentication, rate limiting, anomaly detection (new device/IP/location), logging and alerts, quick revocation, step-up authentication for sensitive actions. TLS versions: TLS 1.2+ (prefer 1.3), modern ciphers, patched libraries.

**mTLS hardening checklist (server)**
- Trust **only your own client CA** (custom trust store), not the system roots; otherwise a certificate from any public CA could pass.
- Reject self-signed; require `clientAuth` usage and valid dates.
- Check revocation (needs a CRL/OCSP from your CA) or rely on short-lived certificates plus an allow-list.
- Map the certificate to a specific identity (thumbprint, serial, subject/SAN allow-list), then authorize; "has some valid certificate" is not enough.
- Behind a proxy: the proxy always **overwrites** the client-certificate headers, and the app is reachable only through it.

```csharp
builder.Services.AddAuthentication(CertificateAuthenticationDefaults.AuthenticationScheme)
    .AddCertificate(o =>
    {
        o.AllowedCertificateTypes = CertificateTypes.Chained;             // no self-signed
        o.ChainTrustValidationMode = X509ChainTrustMode.CustomRootTrust;  // trust ONLY your client CA (.NET 7+)
        o.CustomTrustStore.Add(clientCa);
        o.ValidateCertificateUse = true;                                  // clientAuth usage (default)
        o.ValidateValidityPeriod = true;                                  // dates (default)
        o.RevocationMode = X509RevocationMode.Online;                     // needs a CRL/OCSP from your CA; otherwise use short-lived certs + allow-list
        o.Events = new CertificateAuthenticationEvents
        {
            OnCertificateValidated = ctx =>
            {
                var cert = ctx.ClientCertificate;
                if (!allowedThumbprints.Contains(cert.Thumbprint))        // loaded from config/DB; or check serial/SAN
                {
                    ctx.Fail("Certificate not authorized");
                    return Task.CompletedTask;
                }
                ctx.Principal = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.Name, cert.Subject) }, ctx.Scheme.Name));
                ctx.Success();
                return Task.CompletedTask;
            }
        };
    });
```

Nginx:

```nginx
ssl_client_certificate /etc/ssl/client-ca.pem;   # ONLY your private client CA
ssl_verify_client on;
ssl_verify_depth 2;
ssl_crl /etc/ssl/client-ca.crl;                  # optional: revoked client certificates
ssl_protocols TLSv1.2 TLSv1.3;
ssl_early_data off;                              # default; avoids 0-RTT replay

location / {
    proxy_pass http://localhost:5000;
    proxy_set_header X-Client-Verify $ssl_client_verify;             # always set by the proxy
    proxy_set_header X-Client-Cert-Fingerprint $ssl_client_fingerprint;
}
```

Client side (.NET): load the certificate from the OS store (non-exportable key) instead of a password-protected file:

```csharp
using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
store.Open(OpenFlags.ReadOnly);
var cert = store.Certificates.Find(X509FindType.FindByThumbprint, thumbprint, validOnly: true).Single();

var handler = new HttpClientHandler();
handler.ClientCertificates.Add(cert);
using var client = new HttpClient(handler);
```

**Limits:** TLS can't protect a compromised endpoint. Malware on the client machine can use the legitimate certificate or cookies. Hardware-backed keys, short lifetimes and detection reduce the damage.

### How this is handled in production

No single control does it. Production uses **layers**, mostly **managed services and automation**, and avoids hand-built crypto or identity systems.

```
Internet
  -> CDN / WAF / DDoS protection        TLS at the edge, bot checks, rate limits, managed certificates
  -> Load balancer / reverse proxy      TLS to the origin (re-encrypted); optional mTLS from the CDN; origin locked to the CDN
  -> API gateway                        validates tokens (JWT), quotas, rate limits, IP allowlists
  -> App services                       authorization policies (who may do what)
  <-> Service mesh                      automatic mTLS between services, workload identities, authorization policies
  -> Database, cache, queues            TLS + managed identity, private endpoints
Identity provider (Entra ID, Auth0, Okta, Keycloak, Cognito): passkeys/MFA, issues tokens
Secrets/keys: Key Vault / Secrets Manager / HashiCorp Vault, HSM-backed CA keys
Logs, metrics, alerts: SIEM, anomaly detection
```

**By client type**

| Client | Typical production setup |
| --- | --- |
| Browser users | Identity provider (OIDC) with MFA/passkeys; `__Host-` `HttpOnly` `Secure` `SameSite` cookies; server-side session store (Redis); short sessions; WAF, bot management, rate limits; risk-based/step-up authentication |
| Mobile apps | OAuth2 authorization code + **PKCE** (no embedded secrets); tokens in Keychain/Keystore; short access tokens + **rotating refresh tokens**; app attestation (Play Integrity, App Attest); optional certificate pinning with backup pins |
| Public/partner APIs | OAuth2 client credentials; API gateway (Azure API Management, Kong, AWS API Gateway) validates JWTs, enforces quotas, rate limits, allowlists; high security (banking, FAPI/open banking): **mTLS** or `private_key_jwt` plus certificate-bound tokens (RFC 8705) or DPoP |
| Internal services | **Service mesh** (Istio, Linkerd, Consul) with automatic mTLS and workload identities (SPIFFE); or cert-manager + private CA (Vault PKI, AWS Private CA, step-ca); cloud managed identities instead of stored secrets |
| IoT / devices | Per-device X.509 certificate, key in a TPM/secure element, provisioned at manufacturing or enrollment (EST/SCEP, AWS IoT, Azure DPS), revoked per device |
| Employees / admin | Zero-trust access proxy (Cloudflare Access, Google IAP, Entra Private Access): checks user + device posture (MDM-issued device certificate) before forwarding; replaces broad VPN access |

**Walk-through: a mobile user places an order**
1. App gets tokens from the identity provider (auth code + PKCE, passkey/MFA). Access token ~10 minutes, refresh token rotated on each use.
2. Request -> CDN/WAF (bot check, rate limit) -> load balancer -> API gateway, which validates the JWT (signature via the IdP's published keys, audience, expiry, scopes) and applies quotas.
3. Gateway -> Orders service over **mesh mTLS**; the mesh policy says only the gateway identity may call `POST /orders`.
4. Orders -> Payments over mTLS; Payments allows only the Orders identity and requires an idempotency key.
5. Database access uses TLS, a managed identity and a private endpoint.
6. Every hop logs with a correlation ID; anomaly detection watches for odd patterns.

**Certificates and keys**
- Public certificates: ACME automation (certbot, cert-manager) or the cloud's managed certificates on the CDN/load balancer; the private key often never touches a disk you manage (ACM, Key Vault).
- Private CA: offline root, online intermediates, **HSM-backed** keys; short-lived workload certificates (meshes commonly default to about 24 hours, configurable), renewed automatically at roughly two-thirds of their life.
- Servers reload certificates without downtime (Nginx reload, Envoy SDS, Kestrel reload on config change).
- **Monitor expiry** (e.g. Prometheus blackbox exporter `probe_ssl_earliest_cert_expiry`), alert at 30/14/7 days; watch Certificate Transparency logs; set CAA records. Expired certificates still cause big outages (Microsoft Teams in 2020).
- Secrets live in a vault, rotated on a schedule, never in Git.

**Mesh: strict mTLS + authorization (Istio)**

```yaml
apiVersion: security.istio.io/v1          # older Istio versions: v1beta1
kind: PeerAuthentication
metadata: { name: default, namespace: shop }
spec:
  mtls:
    mode: STRICT                          # reject plain-text traffic
---
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata: { name: orders-allow-gateway, namespace: shop }
spec:
  selector:
    matchLabels: { app: orders }
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/shop/sa/gateway"]
    to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/orders*"]
```

mTLS only proves *who* is calling; the authorization policy decides *what* they may do.

**Tokens in the app (ASP.NET Core)**

```csharp
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", o =>
    {
        o.Authority = "https://login.example.com";      // IdP; signing keys fetched from its JWKS endpoint
        o.Audience = "shop-api";
        o.TokenValidationParameters.ClockSkew = TimeSpan.FromSeconds(30);
    });
builder.Services.AddAuthorization(o =>
    o.AddPolicy("CanOrder", p => p.RequireClaim("scope", "orders.write")));

app.MapPost("/orders", CreateOrder).RequireAuthorization("CanOrder");
```

Also use ASP.NET Core rate limiting (`AddRateLimiter`, `UseRateLimiter`) per user or client.

- **Refresh token reuse detection**: if an old refresh token is presented again, assume theft and revoke the whole token family.

**Detection and response**
- Log authentication failures, certificate identities, token IDs; send to a SIEM; alert on impossible travel, new devices, spikes.
- Key-compromise runbook: contain (revoke certificate, token family, block identity) -> rotate keys/secrets -> invalidate sessions and force re-authentication -> re-issue -> post-mortem.
- Routine checks: SSL Labs / testssl.sh, dependency and OpenSSL patching, penetration tests, compliance (PCI DSS, SOC 2, ISO 27001).

**By team size**
- Small team: managed identity provider, managed certificates on the CDN/load balancer, HTTPS + HSTS, cookie hardening, WAF + rate limiting, secrets in Key Vault, managed identities, TLS to the database, basic alerts. Don't build identity or crypto yourself.
- Mid-size: add an API gateway, short-lived tokens with refresh rotation, central logging, mTLS between key services (mesh), certificate automation and expiry alerts.
- High security (fintech, health, government): mTLS plus certificate-bound tokens/DPoP, HSM-backed keys, short-lived workload certificates, device attestation, strict revocation, continuous monitoring and audits.

**Common production mistakes**
- Expired certificates; no expiry monitoring.
- mTLS trusting public CAs or any valid certificate; mTLS without authorization policies; mesh left in PERMISSIVE mode.
- Trusting forwarded or client-certificate headers from the internet.
- Origin reachable directly, bypassing the CDN/WAF.
- Long-lived static API keys or shared service credentials; secrets in repos or logs; tokens in `localStorage`.
- Disabling certificate validation "temporarily" and forgetting.
- No rotation, no revocation plan, no rate limits.

### Cipher and cipher suite

- A **cipher** is an algorithm that turns plaintext into unreadable ciphertext using a key, and back again. Toy example (Caesar cipher, key = 3): `HELLO` -> `KHOOR`. Real ciphers (AES, ChaCha20) use 128/256-bit keys, so there are about 2^128 or more possibilities.
- Related but different tools:

| Tool | What it does | Example |
| --- | --- | --- |
| Cipher | Reversible with the key: encrypt / decrypt | AES, ChaCha20 |
| Hash | One-way fingerprint | SHA-256 |
| MAC | Keyed hash that proves integrity | HMAC |
| Signature | Asymmetric proof of origin | RSA, ECDSA |

- TLS uses **symmetric** ciphers for the data (fast), after the handshake agrees on keys (Topic 5: hybrid encryption).
- **AEAD** ciphers (AES-GCM, ChaCha20-Poly1305) give encryption **and** integrity in one step.
- AES is fast with hardware support (AES-NI); ChaCha20 is faster on devices without it (some older phones).

**Cipher suite** = a named set of algorithms used together in a handshake.

TLS 1.2 example: `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`

| Part | Role |
| --- | --- |
| `ECDHE` | Key exchange (ephemeral elliptic-curve Diffie-Hellman, gives forward secrecy) |
| `RSA` | Authentication: the server's certificate key signs the handshake |
| `AES_256_GCM` | Bulk encryption: AES, 256-bit key, Galois/Counter Mode (AEAD) |
| `SHA384` | Hash used for key derivation / handshake integrity |

TLS 1.3 suites only name the AEAD cipher and hash, e.g. `TLS_AES_256_GCM_SHA384`; key exchange (groups such as x25519) and signature algorithms are negotiated separately. TLS 1.3 defines five suites: `TLS_AES_128_GCM_SHA256`, `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`, `TLS_AES_128_CCM_SHA256`, `TLS_AES_128_CCM_8_SHA256`.

**Negotiation**
- Client lists the suites it supports in the ClientHello (in preference order); the server picks one (the server's or the client's preference, depending on configuration).
- Client offers [A, B, C], server supports [B, D] -> B. No overlap -> `handshake_failure`.

**Good vs bad**
- Prefer: ECDHE + (RSA or ECDSA) + AES-GCM or ChaCha20-Poly1305 (TLS 1.2); any TLS 1.3 suite.
- Avoid: NULL, EXPORT, RC4, DES/3DES, MD5, CBC with SHA-1 (legacy), static RSA key exchange (no forward secrecy), anonymous Diffie-Hellman.
- Most teams don't hand-tune: the defaults of modern proxies/runtimes are good. Use the Mozilla SSL Configuration Generator, disable old protocol versions, and test.

Nginx (Mozilla "intermediate"-style):

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;
```

(`ssl_ciphers` applies to TLS 1.2 and below; TLS 1.3 suites are set separately, e.g. `ssl_conf_command Ciphersuites ...`.)

Kestrel (Linux/macOS; on Windows the OS controls suites, so verify for your version):

```csharp
builder.WebHost.ConfigureKestrel(k =>
    k.ConfigureHttpsDefaults(h =>
    {
        h.SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13;
        h.OnAuthenticate = (ctx, ssl) =>
            ssl.CipherSuitesPolicy = new CipherSuitesPolicy(new[]
            {
                TlsCipherSuite.TLS_AES_256_GCM_SHA384,
                TlsCipherSuite.TLS_AES_128_GCM_SHA256,
                TlsCipherSuite.TLS_CHACHA20_POLY1305_SHA256,
                TlsCipherSuite.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
                TlsCipherSuite.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
            });
    }));
```

**See it**
- `openssl s_client -connect example.com:443 -servername example.com` prints `Protocol` and `Cipher`.
- `curl -v https://example.com` prints `SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384`.
- `nmap --script ssl-enum-ciphers -p 443 example.com`, SSL Labs, or testssl.sh list every supported suite.

### SNI (Server Name Indication)

- A TLS extension in the **ClientHello** where the client says which **hostname** it wants (`server_name = blog.example.org`).
- **Problem it solves:** TLS happens *before* HTTP, so the server can't read the HTTP `Host` header yet, but it must already present the right certificate. Without SNI, one IP:port could serve only one certificate (one IP per HTTPS site).
- **With SNI:** the server reads the name, picks the matching certificate and configuration, so thousands of sites share one IP on port 443.

```
Without SNI:  client -> 203.0.113.10:443 -> server must send *a* certificate (which site?)
With SNI:     ClientHello(server_name = blog.example.org) -> server sends blog.example.org's certificate
```

- SNI (TLS layer) vs `Host` header (HTTP layer): normally identical; a mismatch is "domain fronting", which many CDNs now block.
- ALPN is a sibling extension: it says which application protocol (`h2` or `http/1.1`).

**Where it matters**
- Reverse proxies, CDNs and cloud load balancers pick a certificate per host with SNI (Nginx `server_name`, AWS ALB multiple certificates, Kubernetes Ingress TLS secrets, Istio gateways).
- L4 proxies can route by SNI **without decrypting** (Nginx `stream` with `ssl_preread`, HAProxy, Envoy).
- Firewalls and filters can allow or block by hostname.

**Privacy**
- SNI is sent in **plaintext**, so a network observer sees which hostname you visit, even though the content is encrypted.
- **Encrypted Client Hello (ECH)** encrypts the inner ClientHello including the SNI, using a key published in DNS (HTTPS/SVCB records). Support is growing; check current status.

**If SNI is missing or unmatched**
- The server returns its **default certificate**, so clients see a name-mismatch error.
- Common causes: connecting by IP address (clients don't send SNI for IP literals), very old clients, or a client that doesn't set the target host.

Nginx (two sites, one IP):

```nginx
server {
    listen 443 ssl default_server;           # used when SNI is missing or unmatched
    server_name shop.example.com;
    ssl_certificate     /etc/ssl/shop.crt;
    ssl_certificate_key /etc/ssl/shop.key;
}
server {
    listen 443 ssl;
    server_name blog.example.org;
    ssl_certificate     /etc/ssl/blog.crt;
    ssl_certificate_key /etc/ssl/blog.key;
}
```

Kestrel:

```csharp
builder.WebHost.ConfigureKestrel(k =>
    k.ListenAnyIP(443, listen => listen.UseHttps(new HttpsConnectionAdapterOptions
    {
        ServerCertificateSelector = (conn, name) => name switch
        {
            "shop.example.com" => shopCert,
            "blog.example.org" => blogCert,
            _ => defaultCert
        }
    })));
```

(Kestrel also has a configuration-based `Sni` section in newer versions; check the docs.)

Client side:
- `HttpClient` sends the URL's host as SNI automatically. With `SslStream`, set `TargetHost` (`SslClientAuthenticationOptions`).
- curl: `curl --resolve shop.example.com:443:203.0.113.10 https://shop.example.com/` connects to a chosen IP but still sends the right SNI.

**Debugging**
- `openssl s_client -connect 203.0.113.10:443` (no `-servername`) shows the default certificate; add `-servername blog.example.org` to see the site's real certificate.
- Wireshark filter `tls.handshake.extensions_server_name` shows the SNI in each ClientHello.

### TLS versions: history and what to allow

SSL and TLS are the same protocol family. SSL was Netscape's; it was renamed TLS when the IETF took over. People still say "SSL certificate" for what is really a TLS certificate.

| Version | Year | Status | Notes |
| --- | --- | --- | --- |
| SSL 2.0 | 1995 | Broken, prohibited | Fundamental design flaws |
| SSL 3.0 | 1996 | Broken, prohibited | **POODLE** (2014): padding oracle against CBC |
| TLS 1.0 | 1999 | Deprecated (RFC 8996, 2021) | **BEAST** (CBC in TLS 1.0), weak legacy crypto; PCI DSS banned it |
| TLS 1.1 | 2006 | Deprecated (RFC 8996, 2021) | Fixed BEAST's cause but still no modern AEAD ciphers; browsers dropped it |
| **TLS 1.2** | 2008 | **Still fine if configured well** | Needs careful cipher choice; the compatibility baseline |
| **TLS 1.3** | 2018 (RFC 8446) | **Preferred** | Simpler, faster, safer by default |

#### Attacks that shaped the versions
- **POODLE**: SSL 3.0 padding oracle. Fix: disable SSL 3.0.
- **BEAST**: predictable IVs in CBC mode (TLS 1.0).
- **CRIME / BREACH**: compression leaks secrets. TLS compression was removed; BREACH (HTTP-level compression) is handled in the app (don't reflect secrets, add random padding).
- **Heartbleed** (2014): a bug in the OpenSSL *implementation*, not the protocol. It leaked memory, including private keys. Lesson: keep TLS libraries patched.
- **FREAK / Logjam**: downgrade to weak "export-grade" keys and DH parameters.
- **DROWN**: SSL 2.0 on any server sharing the key endangered TLS servers.
- **Lucky13, ROBOT** (RSA key exchange padding oracles): one reason TLS 1.3 removed static RSA key exchange.

#### Downgrade protection
An attacker could try to force both sides to use an old version. TLS 1.3 servers put a special marker in `ServerHello.random` when negotiating an older version, and clients abort if they see it. The `supported_versions` extension replaced the old version field. The simplest defence is to not offer old versions at all.

#### TLS 1.2 vs TLS 1.3 handshake, side by side
```
TLS 1.2 (full handshake, 2 RTT)           TLS 1.3 (1 RTT)
C -> S  ClientHello                       C -> S  ClientHello + key_share
C <- S  ServerHello, Certificate,         C <- S  ServerHello + key_share,
        ServerKeyExchange, HelloDone              {EncryptedExtensions, Certificate,
C -> S  ClientKeyExchange, CCS, Finished          CertificateVerify, Finished}
C <- S  CCS, Finished                     C -> S  {Finished} + application data
        --> app data starts after 2 RTT           --> app data starts after 1 RTT
(braces = already encrypted)
```
The 1.3 client guesses the key-exchange group and sends its key share in the first message, which saves a round trip.

#### Other differences worth knowing
- 1.3 **removed**: RSA key exchange, static DH, CBC and RC4 ciphers, SHA-1 and MD5 signatures, compression, renegotiation.
- 1.3 handshake messages after ServerHello are **encrypted**, so the certificate is hidden from passive observers.
- 1.3 uses **HKDF** for key derivation and always uses AEAD ciphers (AES-GCM, ChaCha20-Poly1305).
- 1.3 cipher suite names only name the AEAD and hash (`TLS_AES_256_GCM_SHA384`); key exchange and signature are negotiated separately.
- 1.2 resumption uses session IDs or tickets; 1.3 uses PSK-based tickets and allows 0-RTT.

#### What to allow in production
- **Enable TLS 1.3 and TLS 1.2. Disable TLS 1.1, 1.0 and SSL.**
- Keep 1.2 only for older clients (old Android, Java 7, legacy devices). Check your logs to see whether any real traffic still needs it before dropping it.
- With 1.2, allow only ECDHE key exchange and AEAD ciphers (see Cipher section).
- Compliance: PCI DSS and many standards require TLS 1.2 or higher. Government guidance (for example NIST SP 800-52r2) requires support for 1.3.

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
```

```csharp
// Kestrel
o.ConfigureHttpsDefaults(h => h.SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13);

// HttpClient (usually leave it to the OS default; set only if you must restrict)
var handler = new SocketsHttpHandler
{
    SslOptions = { EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13 }
};
```

In modern .NET, leaving protocols unset uses the **operating system's defaults**, which is usually the safest choice. Hard-coding versions in code can later block newer ones.

#### Checking what a server supports
```bash
openssl s_client -connect example.com:443 -tls1_3     # succeeds if 1.3 is supported
openssl s_client -connect example.com:443 -tls1_1     # should FAIL on a modern server
nmap --script ssl-enum-ciphers -p 443 example.com     # lists versions and ciphers
```
Online: SSL Labs Server Test (ssllabs.com/ssltest) grades the configuration.

### What is and isn't hidden
- Encrypted: URL path and query, headers, cookies, body.
- Visible to observers: IPs, port, traffic size/timing, and the hostname (via DNS and SNI, unless DoH/ECH are used).
- Secrets in URLs are still bad: they end up in browser history and server logs.

### Where backend developers meet TLS
- **TLS termination** is usually at a load balancer or reverse proxy (Nginx, Azure App Gateway, Cloudflare); traffic behind it may be plain HTTP or re-encrypted (end-to-end TLS). Kestrel can also serve TLS directly.
- **Certificate expiry** is a top cause of outages: automate renewal and monitor expiry dates.
- ASP.NET Core: `app.UseHttpsRedirection()`, `app.UseHsts()`, `dotnet dev-certs https --trust`.
- **Never disable certificate validation** in code (`ServerCertificateCustomValidationCallback` returning true). It removes the authentication guarantee and enables man-in-the-middle attacks. The same applies to `TrustServerCertificate=True` in SQL Server connection strings; use `Encrypt=True` with a properly trusted certificate.
- **mTLS**: the client also presents a certificate; common for service-to-service calls.
- Handshake cost is why connections are reused: keep-alive, session resumption, HTTP/2 and HTTP/3.

### Practical: installing and using TLS

"Installing TLS" = (1) get a certificate + private key, (2) configure the server to use them, (3) make sure clients trust the issuer. TLS itself is already built into the OS and runtimes.

**Server side**

- **Local dev (ASP.NET Core):** `dotnet dev-certs https --trust` (also `--check`, `--clean`). Use an `https://localhost:xxxx` URL in `launchSettings.json`.
- **Production, most common: reverse proxy + Let's Encrypt (Nginx):**

  ```bash
  sudo apt install certbot python3-certbot-nginx
  sudo certbot --nginx -d shop.example.com
  sudo certbot renew --dry-run      # test auto-renewal
  ```

  Needs: the domain's A record pointing at the server, ports 80 and 443 open (80 is used for the validation challenge). Files: `/etc/letsencrypt/live/<domain>/fullchain.pem` and `privkey.pem`.

  ```nginx
  server {
      listen 443 ssl;
      server_name shop.example.com;
      ssl_certificate     /etc/letsencrypt/live/shop.example.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/shop.example.com/privkey.pem;
      ssl_protocols TLSv1.2 TLSv1.3;
      location / {
          proxy_pass http://localhost:5000;
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  server { listen 80; server_name shop.example.com; return 301 https://$host$request_uri; }
  ```

  In the app, trust the forwarded headers (before other middleware) or you get redirect loops:

  ```csharp
  app.UseForwardedHeaders(new ForwardedHeadersOptions {
      ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto });
  ```

- **Kestrel directly** (`appsettings.json`; supply the password via env var or secret store, never commit it):

  ```json
  { "Kestrel": { "Endpoints": { "Https": {
      "Url": "https://*:443",
      "Certificate": { "Path": "/etc/ssl/shop.pfx", "Password": "<from secret store>" } } } } }
  ```

  PEM files also work: `"Path"` = certificate, `"KeyPath"` = private key.
- **Managed:** Azure App Service managed certificates, Front Door/App Gateway, AWS ACM + load balancer, Cloudflare. Issuance and renewal are handled for you.

**Verify**
- `curl -v https://shop.example.com`
- `openssl s_client -connect shop.example.com:443 -servername shop.example.com`
- Expiry: `echo | openssl s_client -connect host:443 -servername host 2>/dev/null | openssl x509 -noout -dates`
- Public test: SSL Labs server test.

**Client side**
- **Browsers/OS:** nothing to install; public CAs are already trusted. Only import a CA certificate when the server uses a private/internal CA (Windows: Trusted Root Certification Authorities; Linux: copy to `/usr/local/share/ca-certificates/` then `update-ca-certificates`).
- **.NET `HttpClient`:** just use an `https://` URL; validation uses the OS trust store. Don't set `SslProtocols` manually unless required (then `Tls12 | Tls13` via `SocketsHttpHandler.SslOptions.EnabledSslProtocols`).
- **Private CA, without disabling validation:** trust only your CA.

  ```csharp
  var ca = new X509Certificate2("internal-root-ca.crt");
  var handler = new HttpClientHandler {
      ServerCertificateCustomValidationCallback = (msg, cert, chain, errors) => {
          if (cert is null || chain is null) return false;
          chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
          chain.ChainPolicy.CustomTrustStore.Add(ca);
          return chain.Build(cert);
      } };
  ```

- **curl:** `curl --cacert internal-ca.crt https://host`. Avoid `-k` / `--insecure` except for a throwaway local test.
- **SQL Server:** `Encrypt=True;TrustServerCertificate=False` with a certificate from a trusted CA on the server (Microsoft.Data.SqlClient 4.0+ defaults `Encrypt` to true).
- **mTLS (advanced):** server `ClientCertificateMode.RequireCertificate`; client `handler.ClientCertificates.Add(cert)`.

**Pitfalls**
- Serving only the leaf certificate: use `fullchain.pem` so intermediates are included.
- Hostname must match the certificate's names (SAN); connecting by IP fails.
- DNS not pointing at the server yet, or port 80/443 blocked: Let's Encrypt validation fails.
- Wildcard certificates (`*.example.com`) need the DNS-01 challenge.
- Behind a proxy without forwarded headers: redirect loops (the app thinks the request is HTTP).
- Protect the private key (restricted permissions, never in Git); monitor expiry.
- Wrong system clock on a client gives "not yet valid" / "expired" errors.

### ASP.NET Core: adding SSL/TLS from local dev to production

**1. Local development (dev certificate)**

```bash
dotnet dev-certs https --trust
dotnet run --launch-profile https
```

Creates and trusts a self-signed certificate for `localhost`. `Properties/launchSettings.json`:

```json
"https": {
  "commandName": "Project",
  "applicationUrl": "https://localhost:7001;http://localhost:5001",
  "environmentVariables": { "ASPNETCORE_ENVIRONMENT": "Development" }
}
```

If the browser still warns locally: `dotnet dev-certs https --clean`, then `--trust` again.

**2. Enforce HTTPS in code**

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpsRedirection(o =>
{
    o.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
    o.HttpsPort = 443;
});

builder.Services.AddHsts(o =>
{
    o.MaxAge = TimeSpan.FromDays(365);
    o.IncludeSubDomains = true;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
    app.UseHsts();

app.UseHttpsRedirection();
```

**3. Production: real certificate with Kestrel**

Get a certificate (Let's Encrypt, DigiCert, corporate CA, etc.) as a `.pfx`, then configure it.

`appsettings.json`:

```json
{
  "Kestrel": {
    "Endpoints": {
      "Https": {
        "Url": "https://*:443",
        "Certificate": {
          "Path": "/https/mycert.pfx",
          "Password": "from-secret-store"
        }
      }
    }
  }
}
```

Or in code:

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(443, listen =>
    {
        listen.UseHttps("/https/mycert.pfx", builder.Configuration["Cert:Password"]);
    });
});
```

- Never commit the password. Use environment variables, user-secrets, Azure Key Vault, or Docker/Kubernetes secrets.
- Load from the OS certificate store instead (mainly Windows):

```json
"Certificate": {
  "Subject": "api.example.com",
  "Store": "My",
  "Location": "LocalMachine"
}
```

**4. Docker**

```bash
# Export dev cert for container testing
dotnet dev-certs https -ep ./certs/aspnetapp.pfx -p MyPassword123

docker run -p 8443:443 \
  -e ASPNETCORE_URLS="https://+:443" \
  -e ASPNETCORE_Kestrel__Certificates__Default__Password="MyPassword123" \
  -e ASPNETCORE_Kestrel__Certificates__Default__Path=/https/aspnetapp.pfx \
  -v $(pwd)/certs:/https:ro \
  myapp
```

For production containers, mount the real certificate via secrets, not a baked-in file.

**5. Recommended: terminate TLS at a reverse proxy**

Nginx, IIS, Azure App Service, Traefik or a cloud load balancer terminate TLS; Kestrel runs plain HTTP behind it. Make the app aware of the original scheme:

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

var app = builder.Build();
app.UseForwardedHeaders();
```

- Put `UseForwardedHeaders()` **before** `UseHttpsRedirection()` and `UseHsts()`, otherwise you can get redirect loops.
- Note: by default only proxies on loopback are trusted. If the proxy is on another machine or container, add its address to `KnownProxies` / `KnownNetworks` or the headers are ignored.

**6. Restrict TLS versions (optional hardening)**

```csharp
options.ConfigureHttpsDefaults(https =>
{
    https.SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13;   // using System.Security.Authentication;
});
```

**Quick tips**
- Free certificates: Let's Encrypt via certbot, or `win-acme` on Windows. They renew every 90 days, so automate it.
- PEM files work too: `"Path": "cert.pem", "KeyPath": "key.pem"`.
- mTLS: set `ClientCertificateMode = ClientCertificateMode.RequireCertificate` in `ConfigureHttpsDefaults`.

### Common errors and debugging

| Error | Likely cause |
| --- | --- |
| Certificate expired | Renewal failed or wasn't automated |
| Name mismatch | Certificate issued for a different domain |
| Untrusted issuer / self-signed | CA not in trust store, or missing intermediate certificate |
| Handshake failure | No shared TLS version or cipher |

- Tools: `curl -v https://host`, `openssl s_client -connect host:443 -servername host`, browser padlock -> certificate details.

### Self-check
- What three problems does TLS solve, and what solves each?
- Why does TLS use both asymmetric and symmetric encryption?
- A browser shows a certificate error for your site. Name three possible causes.
- Why is disabling certificate validation dangerous even though the connection is "encrypted"?

### Interview questions and answers

**Q1. [Basic] What problems does TLS solve?**

**A.** Three: **confidentiality** (nobody on the path can read the data: symmetric encryption), **integrity** (tampering is detected: authenticated encryption), and **authentication** (the server really is `shop.example.com`: certificate plus signature). HTTPS is HTTP over TLS. Standard TLS does **not** authenticate the client.

**Q2. [Intermediate] Symmetric vs asymmetric encryption, and why does TLS use both?**

**A.** Symmetric uses one shared key and is very fast, but sharing the key safely is the problem. Asymmetric uses a public/private key pair; it solves key agreement and signatures, but is slow. TLS uses key exchange (ECDHE) to agree on a shared secret over an open network and signatures to prove identity, then switches to fast symmetric encryption (AES-GCM or ChaCha20-Poly1305) for the actual data.

**Q3. [Intermediate] Walk through the TLS 1.3 handshake.**

**A.**
1. **ClientHello** (plaintext): supported versions and cipher suites, the client's ephemeral public key (`key_share`), SNI, ALPN.
2. **ServerHello** (plaintext): chosen cipher suite and the server's ephemeral public key. Both sides now compute the same shared secret and derive keys; everything after this is encrypted.
3. Server sends **Certificate**, **CertificateVerify** (a signature over the handshake made with its private key) and **Finished**.
4. The client verifies the chain, hostname, dates and signature, then sends **Finished**.
5. Encrypted application data flows. Total: 1 round trip after TCP.

**Q4. [Intermediate] How does a browser decide to trust a certificate?**

**A.** It checks that the certificate chains (leaf, intermediate, root) to a root CA in its trust store with valid signatures; the hostname matches the certificate's SAN names; today's date is within the validity period; the certificate allows server authentication; and (where available) it isn't revoked. Finally it checks the `CertificateVerify` signature, which proves the server holds the private key.

**Q5. [Intermediate] TLS 1.2 vs TLS 1.3?**

**A.** 1.3 needs 1 round trip instead of 2, encrypts the certificate, removes legacy and weak options (static RSA key exchange, CBC modes, SHA-1, compression), always provides forward secrecy, offers only a handful of strong AEAD cipher suites, and supports 0-RTT resumption (with replay risk). Allow 1.2 for compatibility and prefer 1.3; disable SSL and TLS 1.0 and 1.1.

**Q6. [Intermediate] What is forward secrecy?**

**A.** The session keys come from temporary (ephemeral) Diffie-Hellman keys that are discarded after the connection, not from the server's long-term private key. So if the private key is stolen later, previously recorded traffic still can't be decrypted. TLS 1.3 requires it; in TLS 1.2 it depends on the cipher suite (ECDHE).

**Q7. [Intermediate] What are SNI and ALPN?**

**A.** Both are ClientHello extensions. **SNI** carries the hostname the client wants, so one IP address can serve many HTTPS sites and the server can pick the right certificate before it has seen any HTTP. **ALPN** negotiates the application protocol (`h2` or `http/1.1`). SNI is sent in plaintext (visible to observers) unless Encrypted Client Hello is used. Connecting by IP address sends no SNI and usually produces a name mismatch.

**Q8. [Intermediate] What is TLS termination, and where should it happen?**

**A.** The point where TLS is decrypted: commonly a CDN, load balancer or reverse proxy, which then forwards plain HTTP or re-encrypted traffic to the app. Benefits: central certificate management and offloaded CPU work. Risk: traffic behind the proxy is unencrypted unless you re-encrypt (end-to-end TLS or mTLS), which regulated systems often require. The app must trust `X-Forwarded-Proto` from known proxies so it knows the original request was HTTPS.

**Q9. [Advanced] What is mutual TLS (mTLS), and when would you use it?**

**A.** Both sides present certificates: the server sends `CertificateRequest`, and the client proves it holds its private key with its own `CertificateVerify`. Use it for service-to-service calls, partner and B2B APIs, IoT devices and zero-trust internal networks. Hardening: trust only your own client CA, reject self-signed certificates, map each certificate to a specific identity, then authorize; prefer short-lived certificates. In ASP.NET Core: `ClientCertificateMode.RequireCertificate` plus `AddCertificate`, with `CustomRootTrust`.

**Q10. [Intermediate] Why is disabling certificate validation (or `TrustServerCertificate=True`) dangerous even though the connection is "encrypted"?**

**A.** You still get encryption, but you no longer verify who is on the other end. A man in the middle can present any certificate, you accept it, and they decrypt and re-encrypt everything. Fix the real problem instead: use a certificate from a trusted CA, add your internal CA to the trust store (or trust only that CA), and use the correct hostname.

**Q11. [Intermediate] How do you obtain and renew certificates in production?**

**A.** Use ACME with Let's Encrypt (certbot, Caddy, win-acme, cert-manager) or your cloud's managed certificates (ACM, Key Vault, App Service, Front Door). Domain validation: **HTTP-01** (serve a token on port 80) or **DNS-01** (a TXT record; required for wildcards). Public certificates are short-lived (Let's Encrypt: 90 days, and the industry is shortening lifetimes), so automate renewal, reload without downtime, monitor expiry (alert at 30, 14 and 7 days) and use Certificate Transparency monitoring and CAA records.

**Q12. [Intermediate] A user sees a certificate error. What are the likely causes?**

**A.**
- **Expired** certificate (renewal failed), or a client clock that is wrong.
- **Name mismatch** (certificate for another domain, or connecting by IP).
- **Untrusted issuer or self-signed** (CA not in the trust store).
- **Missing intermediate certificate** on the server (serve `fullchain.pem`).
- **Revoked** certificate.
- **TLS version or cipher mismatch** (`handshake_failure`).
- A corporate TLS-inspection proxy re-signing traffic.

Debug with `openssl s_client -connect host:443 -servername host` and `curl -v`.

**Q13. [Intermediate] Break down `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`.**

**A.** `ECDHE` is the key exchange (ephemeral elliptic-curve Diffie-Hellman, gives forward secrecy); `RSA` is the authentication (the certificate's key signs the handshake); `AES_256_GCM` is the bulk cipher (AES, 256-bit key, GCM authenticated mode); `SHA384` is the hash used for key derivation and handshake integrity. TLS 1.3 suite names (like `TLS_AES_256_GCM_SHA384`) only name the cipher and hash, because key exchange and signatures are negotiated separately.

**Q14. [Advanced] How is a man-in-the-middle attack prevented or detected?**

**A.** Certificate validation (trusted chain, hostname), HSTS (no downgrade to HTTP), and the signed handshake (an attacker can't produce `CertificateVerify` without the private key). Extras: Certificate Transparency logs (detect mis-issued certificates), CAA records (limit which CAs may issue), and certificate or public-key pinning in apps you control (with backup pins). A rogue root CA installed on a device defeats normal validation, so device management matters.

**Q15. [Advanced] What does TLS cost, and what is the 0-RTT risk?**

**A.** The handshake costs about 1 RTT and some public-key CPU, then symmetric encryption is cheap with hardware support. Reduce the cost with keep-alive, session resumption (tickets), HTTP/2 or HTTP/3, and a CDN that terminates TLS near users. TLS 1.3 **0-RTT** lets a resuming client send data in the first flight, but that data can be replayed by an attacker, so allow it only for idempotent requests (and answer `425 Too Early` otherwise). In Nginx `ssl_early_data` is off by default.

**Q16. [Intermediate] What happens if a server's private key leaks?**

**A.** Anyone with it can impersonate the server (and, without forward secrecy, decrypt recorded traffic). Response: generate a new key pair, get a new certificate, deploy it, revoke the old certificate with the CA, rotate any related secrets, and investigate how it leaked. Forward secrecy protects past sessions from retroactive decryption. Prevent it with restricted file permissions, HSM or Key Vault storage, and short certificate lifetimes.


**Q17. [Basic] What is the difference between SSL and TLS, and which versions should you allow?**

**A.** TLS is the successor to SSL (the name changed when the IETF took over). SSL 2.0 and 3.0 are broken, and TLS 1.0 and 1.1 were formally deprecated in 2021. Allow TLS 1.3 and TLS 1.2 only. Keep 1.2 for older clients and use only ECDHE with AEAD ciphers there. "SSL certificate" is just habit; the certificates are the same.

**Q18. [Intermediate] Why is TLS 1.3 faster and safer than 1.2?**

**A.** Faster: the client sends its key share in the first message, so the handshake takes 1 RTT instead of 2, and resumption can use 0-RTT. Safer: it removed RSA key exchange, CBC and RC4, SHA-1, compression and renegotiation, makes forward secrecy mandatory, always uses AEAD ciphers, and encrypts the certificate and the rest of the handshake. Fewer options means fewer misconfigurations and fewer downgrade targets.

**Q19. [Advanced] What is a downgrade attack and how does TLS defend against it?**

**A.** An attacker interferes with negotiation to make both sides pick an old, weak version or cipher (as in POODLE, FREAK and Logjam). TLS 1.3 servers embed a marker in `ServerHello.random` when they negotiate a lower version, and clients abort if they see it; the handshake transcript is also signed and verified in `Finished`, so tampering with negotiation is detected. The strongest practical defence is to disable old versions and weak ciphers so there is nothing to downgrade to.

**Q20. [Intermediate] Heartbleed: was it a flaw in TLS?**

**A.** No. It was a bug in OpenSSL's implementation of the TLS heartbeat extension (a missing bounds check) that let an attacker read server memory, including private keys and session data. The protocol was fine. The lesson is to patch TLS libraries quickly, and after such a bug to reissue and revoke certificates, because the private key may have leaked.

**Q21. [Intermediate] A legacy client fails with `protocol_version` or `handshake_failure`. What do you check?**

**A.** The client and server probably share no TLS version or cipher suite, usually because the server dropped TLS 1.0 or 1.1 and the client is too old, or the client is forced to an old version in its code. Check with `openssl s_client -tls1_2` and `nmap --script ssl-enum-ciphers`, look at the server's `ssl_protocols` and cipher settings, and prefer upgrading or patching the client over re-enabling insecure versions. If you must support it, isolate it (a separate endpoint) rather than weakening the main site.

---

<!-- End of Stage 1 notes -->
