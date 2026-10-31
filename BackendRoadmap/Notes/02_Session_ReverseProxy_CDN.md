# Web Concepts: Cookies, Sessions, Reverse Proxy, CDN

Continues from `stage1-internet-notes.md`. Topics are added one at a time as we study.

1. Cookies
2. Session / session key
3. Reverse proxy
4. CDN

---

## Topic 1: Cookies

### Why cookies exist
HTTP is stateless (Topic 2 of Stage 1): the server doesn't remember earlier requests. A **cookie** is a small piece of data the server asks the browser to store and automatically send back on later requests to that site. It's how login state, preferences and carts survive between requests.

### How it works

```
1. Browser -> Server:   GET /login ...
2. Server  -> Browser:  Set-Cookie: sid=abc123; Max-Age=3600; Path=/; Secure; HttpOnly; SameSite=Lax
3. Browser stores the cookie.
4. Browser -> Server:   GET /profile
                        Cookie: sid=abc123        <- sent automatically on every matching request
```

### Cookie attributes

| Attribute | Meaning |
| --- | --- |
| `name=value` | The data (keep it small) |
| `Domain` | Which hosts receive it. Default: only the exact host that set it. `Domain=example.com` includes subdomains |
| `Path` | Only sent for URLs under this path |
| `Expires` / `Max-Age` | Lifetime. Without either it's a **session cookie** (gone when the browser closes); with one it's **persistent** |
| `Secure` | Only sent over HTTPS (relies on TLS) |
| `HttpOnly` | JavaScript can't read it (`document.cookie`); limits damage from XSS |
| `SameSite` | `Strict`, `Lax`, `None`: controls sending on cross-site requests; limits CSRF. `None` requires `Secure`. Browsers default to `Lax` |

- Prefixes `__Host-` and `__Secure-` make browsers enforce extra rules (Secure, no Domain, Path=/).

#### Attributes in detail

**name=value**
- Name can't contain spaces, `;` or `,`. Value is usually an opaque token (session ID).
- Total size per cookie (name + value + attributes) is about 4 KB.
- Cookies with the same name but different `Domain`/`Path` can coexist, a common source of "why does the server see two copies" bugs.

**Domain**
- No `Domain` = **host-only** cookie: sent only to the exact host that set it (`shop.example.com`, not `api.example.com`, not `example.com`).
- `Domain=example.com` = sent to `example.com` and **all subdomains**. Useful for single sign-on across subdomains.
- Risk: every subdomain can read it and overwrite it, so one weak or hijacked subdomain exposes it. Prefer host-only unless you need sharing.
- A site can't set cookies for unrelated domains or for public suffixes like `.com` or `.co.uk`.

**Path**
- Cookie is sent only for URLs under this path. `Path=/admin` matches `/admin` and `/admin/users`, not `/` or `/administrator`.
- If omitted, the default is the directory of the URL that set it (set from `/account/login` gives `/account`). Set `Path=/` explicitly to avoid surprises.
- Use it to limit where a cookie travels (e.g. a refresh-token cookie only to `/auth/refresh`).
- **Not a security boundary**: other paths on the same origin can still get at it. Don't rely on Path for secrecy.

**Expires / Max-Age**
- `Expires=<date>` is absolute (depends on clocks); `Max-Age=<seconds>` is relative. If both are present, `Max-Age` wins. Prefer `Max-Age`.
- Neither = **session cookie** (until the browser closes; some browsers restore them on "continue where you left off"). Not the same thing as a server-side session.
- Delete a cookie by sending the same name, `Domain` and `Path` with `Max-Age=0` (or a past date).
- Browsers cap lifetimes (Chrome: 400 days).
- Auth cookies: short, often **sliding** (reset on activity) plus an absolute limit. Preference cookies: long.

**Secure**
- Cookie is only sent over HTTPS, and modern browsers refuse to set `Secure` cookies from plain HTTP pages.
- Without it, the cookie travels on any HTTP request to the host (even an accidental `http://` link), where an on-path attacker can read it. HSTS helps.
- It doesn't encrypt the value; TLS does. The user can still see it in DevTools.
- ASP.NET Core: `CookieSecurePolicy.Always` vs `SameAsRequest` (behind a proxy without forwarded headers, "same as request" is wrong).

**HttpOnly**
- JavaScript can't read the cookie (`document.cookie`), but the browser still sends it with requests.
- Stops XSS from **stealing** the cookie value. It does **not** stop XSS from **using** it: injected script can still call your API from the victim's browser and the cookie is attached. It limits damage; it doesn't fix XSS.
- Leave it off only when your frontend JS must read the cookie (e.g. the `XSRF-TOKEN` cookie pattern in SPAs).

**SameSite**
- **Site** = registrable domain (e.g. `example.com`) + scheme. `shop.example.com` and `api.example.com` are **same-site**; `example.com` and `evil.com` are **cross-site**.

| Request type | Strict | Lax | None |
| --- | --- | --- | --- |
| Same-site request | Sent | Sent | Sent |
| Click a link from another site (cross-site top-level GET navigation) | Not sent | Sent | Sent |
| Cross-site form POST | Not sent | Not sent | Sent |
| Cross-site fetch/XHR, iframe, image | Not sent | Not sent | Sent |

- **Strict**: maximum protection, but arriving from an external link (email, search result) shows the user as logged out on that first request. Good for very sensitive cookies.
- **Lax**: good default for login cookies; blocks the CSRF POST case but keeps links working.
- **None** (requires `Secure`): for legitimate cross-site use: embedded widgets/iframes, a frontend on a different site than the API. Cross-site `fetch` with cookies also needs `credentials: 'include'` and CORS with `Access-Control-Allow-Credentials: true` and a specific origin (not `*`).
- SameSite is not a complete CSRF defence (state-changing GETs, same-site attackers such as a hijacked subdomain, old browsers). Keep antiforgery tokens too.

**Prefixes and Partitioned**
- `__Secure-` requires `Secure`. `__Host-` requires `Secure`, `Path=/` and **no** `Domain`, so a subdomain can't overwrite it. Use `__Host-sid` for session cookies where possible.
- `Partitioned` (CHIPS): third-party cookies are stored separately per top-level site, a privacy-friendlier way to keep embeds working.

**Putting it together**

```
Session:      Set-Cookie: __Host-sid=abc123; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=28800
Preference:   Set-Cookie: theme=dark; Path=/; Secure; SameSite=Lax; Max-Age=31536000
Cross-site embed: Set-Cookie: widget=xyz; Secure; SameSite=None; Partitioned; Path=/
```

ASP.NET Core `CookieOptions` fields: `Domain`, `Path`, `Expires`, `MaxAge`, `Secure`, `HttpOnly`, `SameSite`, `IsEssential`. Cookie auth: `o.Cookie.Name = "__Host-sid"; o.Cookie.Path = "/";`.

### Kinds of cookies
- **Session vs persistent**: whether `Expires` / `Max-Age` is present (details below).
- **First-party vs third-party**: third-party cookies come from a domain other than the one in the address bar (ads, tracking). Safari and Firefox block them by default; Chrome's plans have changed several times, so check the current status.

#### Session vs persistent cookie in detail

The **only** thing that distinguishes them is whether the `Set-Cookie` header carries an `Expires` or `Max-Age` attribute. No such attribute = session cookie; either one present = persistent cookie.

| | Session cookie | Persistent cookie |
| --- | --- | --- |
| **Lifespan** | Deleted when browser closes | Survives until expiry date or manual deletion |
| **Storage** | Browser memory (RAM) | Written to disk |
| **Expiration** | None | `Expires` or `Max-Age` |
| **Typical use** | Login state, cart, CSRF token | "Remember me", language, theme, analytics |
| **Consent (GDPR / ePrivacy)** | Exempt only if strictly necessary (login, cart) | Same rule: strictly necessary is exempt; analytics and marketing need consent |

- Consent depends on the cookie's **purpose**, not on whether it is session or persistent.
- "Deleted when the browser closes" and "RAM only" are the typical behaviour, but some browsers restore session cookies with "continue where you left off" and may keep them on disk for session restore.

**In ASP.NET Core**

```csharp
// Session cookie: no Expires, dies with browser
Response.Cookies.Append("sessionId", "abc123", new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Strict
});

// Persistent cookie: survives browser restart for 30 days
Response.Cookies.Append("rememberMe", "xyz789", new CookieOptions
{
    Expires = DateTime.UtcNow.AddDays(30),
    // equivalent: MaxAge = TimeSpan.FromDays(30),
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Lax
});
```

**Rule of thumb**
- **Session cookie**: anything that should vanish when the user leaves (auth tokens, CSRF, cart during checkout).
- **Persistent cookie**: anything that should survive across visits (remember-me, preferences). Keep the lifetime as short as the use case allows, and for auth tokens prefer server-side invalidation so a stolen cookie is useless after logout.

### Limits and cost
**Limits**
- About 4 KB per cookie (name + value + attributes).
- Roughly 50 to 180 cookies per domain depending on the browser. Beyond that, browsers silently evict older cookies ("my cookie vanished" bugs).
- Servers limit the total `Cookie` header size too. Commonly: Nginx about 8 KB per header line (`400 Request Header Or Cookie Too Large`), Kestrel 32 KB total headers by default (`431 Request Header Fields Too Large`). Exact defaults vary by server and version.

**Hidden cost: the cookie rides along on every request to its domain**

The browser attaches matching cookies to **every** request, including images, CSS and JS, even though the server doesn't need them for static files.

Example: page on `shop.example.com` loads 60 resources (1 HTML, 10 CSS/JS, 40 images, 9 API calls). Cookies for that host: session ID (~40 B), consent flag, analytics IDs (~100 B), A/B test flag, and a `cart` cookie with ~1.8 KB of JSON. Total `Cookie` header ~2 KB.

```
GET /img/logo.png HTTP/1.1
Host: shop.example.com
Accept: image/avif,image/webp,*/*
User-Agent: ...                                   (~150 B)
Cookie: __Host-sid=...; consent=true; _ga=...; ab_test=variant_b; cart=%7B%22items%22...   (~2,000 B)
```

The logo response is ~4 KB, so the request's cookie header is half the size of the image.

- 60 requests x 2 KB = **120 KB of extra upload**. At a 1 Mbps uplink that is about 1 second of upload capacity, competing with the real requests.
- Each request spans 2 or more packets instead of 1: more packets, more chances of loss on poor mobile networks.
- HTTP/1.1 resends the full header every time. HTTP/2 (HPACK) and HTTP/3 (QPACK) compress repeated headers, so cost drops a lot, but the first request is full size and frequently changing cookies defeat the compression.
- The server parses the header and logs on every request, even for static files.
- Caches/CDNs: if they bypass the cache or include cookies in the cache key when a `Cookie` header is present, every user gets a cache miss. Configure them to ignore cookies for static paths.
- A big session cookie or a JWT with many claims can push you over the header limit, causing 400/431 errors.

**Fix: serve static files from a cookieless domain or CDN**

Cookies are scoped by `Domain`, so a host-only cookie for `shop.example.com` is **not** sent to `static.example-cdn.com`.

| | Requests with cookies | Extra upload |
| --- | --- | --- |
| Before: all 60 to `shop.example.com` | 60 | 120 KB |
| After: 10 (HTML + API) to `shop.example.com`, 50 static to a cookieless domain | 10 | 20 KB (about 83% less) |

- Caution: if you set `Domain=example.com`, then `static.example.com` also receives the cookie, so it is not cookieless. Use host-only cookies on the main host, or a different registrable domain/CDN hostname for static files.
- `Path` can also keep a cookie away from `/static/`, but a separate domain is more reliable.

**Other ways to reduce the cost**
- Keep cookies tiny: store only a session ID and keep the cart server-side.
- Remove unused cookies; watch third-party tags that add many tracking cookies over time.
- Scope special cookies with `Path` (e.g. refresh token only to `/auth/refresh`).
- Use HTTP/2 or HTTP/3.
- Last resort for header-size errors: raise the server limit, e.g. `builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestHeadersTotalSize = 65536);`

**See it yourself:** DevTools -> Network -> click an image request -> Request Headers. If a `Cookie` header is present on a static file, you are paying this cost.

### What to store
- Small identifiers (a session ID), preferences (theme, language), consent flags.
- Never put passwords or large data in cookies. If data must live client-side, sign or encrypt it (ASP.NET Core Data Protection does this). Never trust cookie values blindly: users can edit them.

### Cookies vs other browser storage

| | Cookies | localStorage / sessionStorage |
| --- | --- | --- |
| Sent to server automatically | Yes | No |
| Readable by JavaScript | Not if `HttpOnly` | Always |
| Size | ~4 KB | ~5 MB |
| Best for | Session IDs, auth | UI state, cached data |

### Where backend developers use cookies
- Login sessions and cookie authentication
- "Remember me", language and theme preferences
- CSRF (antiforgery) tokens
- Load balancer sticky sessions (affinity cookie)
- Analytics and consent tracking

### ASP.NET Core

```csharp
Response.Cookies.Append("theme", "dark", new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Lax,
    MaxAge = TimeSpan.FromDays(30),
    Path = "/"
});

var theme = Request.Cookies["theme"];
Response.Cookies.Delete("theme");
```

Cookie authentication:

```csharp
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.Cookie.HttpOnly = true;
        o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        o.Cookie.SameSite = SameSiteMode.Lax;
        o.ExpireTimeSpan = TimeSpan.FromHours(8);
        o.SlidingExpiration = true;
    });
```

### Security threats and defences

| Threat | What happens | Defence |
| --- | --- | --- |
| XSS cookie theft | Injected script reads `document.cookie` | `HttpOnly`, fix XSS, Content Security Policy |
| CSRF | A malicious site makes the browser send a request to your site, and the browser attaches your cookie automatically | `SameSite=Lax/Strict`, antiforgery tokens |
| Sniffing / hijacking | Cookie read in transit | `Secure`, HTTPS everywhere, HSTS |
| Tampering | User edits the cookie value | Sign/encrypt, validate on the server |

CSRF example: you're logged into `bank.com`; you visit `evil.com`, which has a hidden form posting to `bank.com/transfer`. Without SameSite or an antiforgery token, the browser attaches your bank cookie and the transfer goes through.

### Debugging
- Browser DevTools -> Application -> Cookies; Network tab shows `Set-Cookie` and `Cookie` headers.
- curl: `curl -v -c jar.txt https://host/login` (save), `curl -b jar.txt https://host/profile` (send).
- Cookie not sent? Check: `Secure` on a plain HTTP page, `SameSite` blocking a cross-site request, `Domain`/`Path` mismatch, cookie too large, expired.
- Behind a reverse proxy without forwarded headers, the app thinks requests are HTTP and may not set `Secure` cookies correctly.

### Self-check
- Why are cookies needed if HTTP is stateless, and what does the browser do with a `Set-Cookie` header?
- What do `HttpOnly`, `Secure` and `SameSite` each protect against?
- Why might the browser attach your bank cookie to a request triggered by `evil.com`, and what stops the attack?
- Why is it a bad idea to store `role=admin` or a large cart in a plain cookie?

### Interview questions and answers

> Tip: answer in layers: definition, how it works, a concrete example, then a trade-off or gotcha. Interviewers usually probe the gotcha.

**Q1. [Basic] What is a cookie and how does it work?**

**A.** A small piece of data the server asks the browser to store with a `Set-Cookie` response header. The browser then sends it back automatically in a `Cookie` request header on every matching request (matched by `Domain`, `Path`, `Secure` and `SameSite`). It's how a stateless protocol carries login state, preferences and carts, usually as a small ID that points to server-side data.

**Q2. [Basic] Session cookie vs persistent cookie? Is a session cookie the same as a server-side session?**

**A.** The only difference is whether `Expires` or `Max-Age` is set: without it the cookie is a **session cookie** (normally dropped when the browser closes; some browsers restore them), with it the cookie is **persistent** (stored until it expires). A session cookie is **not** a server-side session. A server-side session is data kept on the server, usually found through an ID that is itself stored in a cookie (session or persistent).

**Q3. [Basic] Explain `HttpOnly`, `Secure` and `SameSite`.**

**A.**
- **HttpOnly**: JavaScript can't read the cookie via `document.cookie`, so XSS can't steal its value. The cookie is still sent with requests, so XSS can still *use* the session by making requests from the victim's browser.
- **Secure**: sent only over HTTPS, protecting it from sniffing on plain HTTP. It doesn't encrypt the value.
- **SameSite**: controls whether the cookie is sent on cross-site requests, which mitigates CSRF.

**Q4. [Intermediate] SameSite Strict vs Lax vs None? What is a "site" compared to an "origin"?**

**A.** A **site** is the scheme plus the registrable domain (`example.com`), so `shop.example.com` and `api.example.com` are same-site. An **origin** is scheme plus host plus port, so those two are different origins.
- **Strict**: only sent on same-site requests. Even clicking a link from an email arrives without the cookie.
- **Lax**: also sent on top-level cross-site GET navigations (links), but not on cross-site POSTs, iframes or fetch calls. Browsers treat a missing attribute as Lax.
- **None**: always sent, and requires `Secure`. Needed for genuine cross-site use (embeds, a frontend on another site).

**Q5. [Intermediate] What is CSRF, and how do you prevent it? Is SameSite enough?**

**A.** In CSRF a malicious site makes the victim's browser send a request to your site, and the browser attaches the victim's cookie automatically, so the server sees a valid logged-in request (`evil.com` posting a hidden form to `bank.com/transfer`). Defences: `SameSite=Lax` or `Strict`, antiforgery tokens (synchronizer token or double-submit; in ASP.NET Core `[ValidateAntiForgeryToken]`, `AutoValidateAntiforgeryToken`, `UseAntiforgery()`), checking `Origin` or `Referer`, requiring custom headers for APIs, and never changing state on GET. SameSite alone isn't enough: it doesn't cover state-changing GETs, same-site attackers (a hijacked subdomain) or older browsers.

**Q6. [Intermediate] XSS vs CSRF? Does HttpOnly prevent XSS?**

**A.** XSS runs attacker script inside your page (it abuses the user's trust in your site); CSRF makes the browser send an unwanted request from another site (it abuses your site's trust in the browser). HttpOnly doesn't prevent XSS. It only stops the script from reading the cookie. The script can still act as the user, so you also need output encoding, a Content Security Policy, and input handling. Also note that XSS defeats CSRF protections, because script on your own origin can read antiforgery tokens.

**Q7. [Intermediate] Cookies or localStorage for storing an auth token?**

**A.** An `HttpOnly`, `Secure`, `SameSite` cookie can't be read by scripts, so XSS can't steal it; the cost is that you need CSRF protection because the browser sends it automatically. `localStorage` is readable by any script on the page, so XSS can steal the token, but it isn't sent automatically (no CSRF). For browser apps, an HttpOnly cookie is usually the safer choice; for mobile or non-browser clients, use platform secure storage.

**Q8. [Intermediate] What does the `Domain` attribute do, and what is the `__Host-` prefix?**

**A.** With no `Domain`, the cookie is **host-only** (sent only to the exact host that set it). `Domain=example.com` sends it to the domain and all subdomains, which enables single sign-on but means every subdomain can read and overwrite it (one weak subdomain exposes it). The `__Host-` prefix makes browsers require `Secure`, `Path=/` and no `Domain`, so subdomains can't set or overwrite it. Prefer host-only cookies and `__Host-` for session cookies.

**Q9. [Intermediate] Why can cookies hurt performance, and how do you fix it?**

**A.** Matching cookies are sent on **every** request to that domain, including images, CSS and JS. A 2 KB cookie on a page with 60 requests adds about 120 KB of upload (upload bandwidth is the scarce direction), more packets, parsing on the server, and it can fragment CDN caches or exceed header limits (400/431 errors). Fixes: keep cookies tiny (store an ID, keep data server-side), remove unused ones, scope with `Path`, serve static files from a cookieless host or CDN (host-only cookies, not `Domain=example.com`), and use HTTP/2 or HTTP/3 header compression.

**Q10. [Advanced] What are third-party cookies, and what are the alternatives now that browsers restrict them?**

**A.** Cookies set by a domain other than the one in the address bar (ads, analytics, embedded widgets, cross-site tracking). Safari and Firefox block them by default, and Chrome's plans have shifted, so check current status. Alternatives and mitigations: **Partitioned cookies (CHIPS)** keyed per top-level site for embeds, the **Storage Access API**, first-party data and server-side tracking, token-based federation flows, and redesigning embeds to avoid needing cross-site state.

**Q11. [Advanced] A frontend on `app.com` needs to call an API on `api.other.com` using cookies. What does it take?**

**A.** The cookie must be `SameSite=None; Secure` (and ideally `Partitioned`), the request must use `credentials: 'include'`, and the API must send `Access-Control-Allow-Credentials: true` with a specific `Access-Control-Allow-Origin` (not `*`). Even then, browsers that block third-party cookies may refuse it. The more robust design is to make it **same-site**: serve the API under the same registrable domain (`api.app.com`), or proxy it through the frontend's own origin, then use `SameSite=Lax`.

**Q12. [Intermediate] How does ASP.NET Core cookie authentication work, and what is inside the cookie?**

**A.** After login, `SignInAsync` serializes the user's claims into an authentication ticket, encrypts and signs it with **Data Protection**, and stores it in the cookie. On each request the cookie middleware decrypts and validates it and builds the `ClaimsPrincipal`. So by default it is stateless: the claims travel in the cookie (server-side storage is optional through `ITicketStore`). With several instances you must share Data Protection keys, or each instance can't read the others' cookies. Tune `ExpireTimeSpan`, `SlidingExpiration`, `HttpOnly`, `SecurePolicy` and `SameSite`.

**Q13. [Intermediate] A cookie isn't being sent or seems to vanish. How do you debug it?**

**A.** DevTools, Application, Cookies, and the Network tab (`Set-Cookie` and `Cookie` headers). Typical causes: `Secure` cookie on a plain HTTP page; `SameSite` blocking a cross-site request; `Domain` or `Path` mismatch; expired or deleted; cookie or total header too large; more than the per-domain cookie limit (older ones evicted); a cookie-consent policy blocking non-essential cookies (`IsEssential`); behind a proxy without forwarded headers, so the app thinks the request is HTTP.

**Q14. [Basic] How do you delete a cookie?**

**A.** Send `Set-Cookie` with the same name, `Domain` and `Path` and an expiry in the past (or `Max-Age=0`). In ASP.NET Core: `Response.Cookies.Delete("name")` (pass the same options if you set a custom `Path` or `Domain`). A mismatch in `Domain` or `Path` creates a different cookie and the original stays.

**Q15. [Intermediate] Which cookies need user consent under GDPR and ePrivacy?**

**A.** It depends on purpose, not on session vs persistent. Strictly necessary cookies (login, cart, load-balancer affinity, security tokens) are exempt. Preferences that aren't required, analytics and advertising cookies need prior consent. In ASP.NET Core, mark essential cookies with `IsEssential = true` so a consent policy doesn't block them.

---

## Topic 2: Session / session key

### What a session is
- A **session** = server-side memory of one user's ongoing interaction (who they are, cart, preferences), kept between login and logout/expiry.
- The **session key (session ID)** = a random, unguessable identifier that points to that data. The browser holds only the ID (usually in a cookie); the data stays on the server.
- Analogy: a coat-check ticket or hotel key card. The ticket doesn't contain your coat; the hotel's records say which room it opens, and a lost card can be deactivated instantly.
- "Session" is an overloaded word: **server-side session** (this topic), **session cookie** (a cookie with no expiry, Topic 1), **TLS session** (resumption, Stage 1).

### Flow

```
1. POST /login (credentials)  -> server verifies, creates a record in the session store:
                                 sid=9f3a...  ->  { userId: 42, role: "user", cart: [...], expiresAt: ... }
2. Server -> Browser:  Set-Cookie: sid=9f3a...; Path=/; Secure; HttpOnly; SameSite=Lax
3. Browser -> Server:  GET /profile   Cookie: sid=9f3a...
4. Server looks up sid in the store -> knows it's user 42 -> handles the request
5. Logout: server deletes the record (and clears the cookie) -> the ID is useless immediately
```

### What a good session ID looks like
- Generated by a cryptographically secure random generator; at least 128 bits is a safe standard.
- No meaning: never a user ID, counter or timestamp.
- Only in a cookie, **never in the URL** (leaks via logs, Referer headers, shared links).
- Don't invent your own scheme; use the framework's.

### Where session data lives (session store)

| Store | Speed | Survives restart | Works with many servers | Notes |
| --- | --- | --- | --- | --- |
| In-process memory | Fastest | No | No (each server has its own) | Dev/single server only |
| Database (e.g. SQL Server) | Slower | Yes | Yes | Needs cleanup of expired rows |
| Distributed cache (Redis) | Fast | Depends on config | Yes | Common choice; built-in TTL expiry |

### Where `HttpContext.Session` actually stores data

- `HttpContext.Session` has **no storage of its own**. It saves into whatever **`IDistributedCache`** you registered. `AddSession` requires one; without it the app throws "Unable to resolve service for type IDistributedCache".
- The **browser holds only the cookie** (the session key, protected with Data Protection). The data lives on the server side, in the cache.

```
Browser: Cookie (protected session key)
   -> Session middleware: decrypt cookie -> session key (a GUID)
   -> IDistributedCache.Get(key) -> [ Server memory | SQL Server table | Redis | other provider ]
```

- Each session is **one cache entry** under the session key: all its keys and values serialized together as bytes. Idle timeout is set as the entry's sliding expiration, so the cache removes idle sessions.
- Values are **not encrypted in the store** (only the cookie is protected). Anyone with access to the database or Redis can read them: don't store secrets, secure the store (TLS, authentication, private network) or encrypt sensitive values yourself.

| Store | Registration | Where the data is | Notes |
| --- | --- | --- | --- |
| Memory | `AddDistributedMemoryCache()` | The web server's process RAM | Fastest; lost on restart, deploy or app-pool recycle; not shared between servers; has a size limit; "distributed" in name only |
| SQL Server | `AddDistributedSqlServerCache(...)` | Table `dbo.SessionCache` | Durable and shared; slower; expired rows are cleaned by a background scan |
| Redis | `AddStackExchangeRedisCache(...)` | A Redis hash per session (`InstanceName` + key) | Fast, shared, built-in TTL; sessions are lost if Redis loses data (check persistence/replication) |
| Others | NCache, Azure Cosmos DB cache, etc. | Provider-specific | Implement `IDistributedCache` |

SQL Server setup:

```bash
dotnet tool install --global dotnet-sql-cache
dotnet sql-cache create "<connection string>" dbo SessionCache
```

```csharp
builder.Services.AddDistributedSqlServerCache(o =>
{
    o.ConnectionString = builder.Configuration.GetConnectionString("Sessions");
    o.SchemaName = "dbo";
    o.TableName = "SessionCache";
});
```

Columns: `Id` (the session key), `Value` (binary), `ExpiresAtTime`, `SlidingExpirationInSeconds`, `AbsoluteExpiration`.

```sql
SELECT Id, ExpiresAtTime, SlidingExpirationInSeconds FROM dbo.SessionCache;
```

Redis (roughly what you will see):

```
127.0.0.1:6379> KEYS shop:*                      (use SCAN on a busy server)
1) "shop:5d2e9f6c-3b1a-4c7e-8a55-0f1c2d3e4a5b"
127.0.0.1:6379> HGETALL shop:5d2e9f6c-3b1a-4c7e-8a55-0f1c2d3e4a5b
1) "absexp"   2) "-1"
3) "sldexp"   4) "1200"                          (20-minute idle timeout)
5) "data"     6) <binary blob>
127.0.0.1:6379> TTL shop:5d2e9f6c-3b1a-4c7e-8a55-0f1c2d3e4a5b
(integer) 1187
```

**Three different values (correction: `Session.Id` is not the store key)**

| Value | What it is | Where it lives |
| --- | --- | --- |
| Cookie value | The session **key encrypted with Data Protection** (looks like `CfDJ8...`) | Browser |
| **Session key** | A random GUID generated by the session middleware; decrypted from the cookie | The **cache key** (Redis key, SQL `Id` column, memory dictionary key) |
| `HttpContext.Session.Id` | A **separate** GUID generated by the session object and saved *inside* the session data | Inside the stored entry; **not** the cache key |

```
Cookie:       CfDJ8Nq...(encrypted)
   -> Data Protection decrypts
Session key:  5d2e9f6c-3b1a-4c7e-8a55-0f1c2d3e4a5b    <- used to look up the entry (Redis: shop:5d2e9f6c-...)
   -> IDistributedCache.Get(key)
Session data: { "visits": 2, "cart": [...] }  + Session.Id = a1b2c3d4-... (stored inside the data)
```

- You can't paste the cookie into Redis to find the session, and `Session.Id` won't match the Redis key either. List the keys in the store, or enable Debug logging for `Microsoft.AspNetCore.Session` (`"Logging": { "LogLevel": { "Microsoft.AspNetCore.Session": "Debug" } }`): its log lines show both the Key and the Id.
- Docs: `ISession.Id` is "not the same as the session cookie since the cookie lifetime may not be the same as the session entry lifetime in the data store". As far as I can tell, if an entry expires but the browser still sends the old cookie, a new entry can be created under the same key with a new `Id`.
- The cookie is a wrapper around the key. If the wrapper can't be opened (Data Protection keys changed or not shared between instances), the key is lost: the user gets a new session and looks logged out, while the old entry sits unused in the store until it expires.
- The session key is 16 random bytes, and the cookie is encrypted, so clients can't forge or guess other sessions.
- Consequences: with the memory store, restarts and IIS app-pool recycles log everyone out, and multiple servers each have their own sessions ("randomly logged out"). Use Redis or SQL Server for anything beyond a single dev server.

#### What is `HttpContext.Session.Id` for?

- Why two values: the **lifetimes differ**. The server controls how long a session really lives; the client can keep and replay its cookie (key) indefinitely. `Session.Id` identifies one **server-side session instance**; the key says where the data is stored and rides in the cookie.
- If a session expires on the server and the browser later sends the old cookie, the server creates a **new** session under the **same key** (so no new cookie is needed), and it gets a **new `Id`**. (ASP.NET Core team explanation, aspnet/Session issue #151.)

| Time | Event | Cookie key | `Session.Id` |
| --- | --- | --- | --- |
| 10:00 | First value written, session created | K1 | A |
| 10:05 | Same session continues | K1 | A |
| 10:30 | 20-minute idle timeout passed; entry removed from the store | K1 (browser still has it) | - |
| 10:45 | Old cookie arrives; nothing found; new session stored under K1 | K1 | **B** |

**Real uses**
- **Logging, tracing and analytics**: group all requests of one visit (log scope below).
- **Audit and correlation**: store `Session.Id` next to your own records (login audit, cart, events) to tie them to one session instance.
- **A handle that isn't the cookie value**: knowing `Id` doesn't let anyone fetch the session (the cookie carries the encrypted key). It is still an identifier; don't publish it unnecessarily.
- To find out whether a session expired, you normally just check whether your own values (e.g. `userId`) are still there. Comparing `Id` is rarely needed.

**Not for**
- Authentication, authorization or user identity (use claims and cookie authentication).
- Defending against session fixation: rotating `Id` does not change the cookie key; you need a new cookie.
- A durable identifier: it ends with the session.

**Stability caveat:** the `Id` is saved with the session data, and only when the session has data. On an empty, new session, nothing is persisted, so `Id` can differ on every request. Write a value first if you need a stable `Id` (as far as I know from the source).

```csharp
app.Use(async (ctx, next) =>              // after app.UseSession()
{
    await ctx.Session.LoadAsync();
    var logger = ctx.RequestServices.GetRequiredService<ILogger<Program>>();
    using (logger.BeginScope("SessionId {SessionId}", ctx.Session.Id))
    {
        await next();
    }
});
```

### Server-side session vs token in the cookie

| | Server-side session | Token (e.g. JWT) |
| --- | --- | --- |
| Where state lives | Server store | Inside the token, held by the client |
| Logout / revoke | Instant (delete record) | Hard until expiry (needs a denylist) |
| Scaling | Needs a shared store | Any server can verify the signature |
| Size on the wire | Small ID | Larger (claims) |
| Per-request cost | Store lookup | Signature check |

- ASP.NET Core nuance: **cookie authentication by default keeps the user's claims encrypted inside the cookie** (stateless), not in a server-side session. Server-side storage is optional (`SessionStore` / `ITicketStore`). `HttpContext.Session` is a separate feature: a server-side key-value store keyed by a session cookie (`.AspNetCore.Session` by default).

### Lifetime
- **Idle (sliding) timeout**: e.g. 20 minutes without activity.
- **Absolute timeout**: e.g. 8-12 hours maximum regardless of activity.
- Explicit logout deletes the record. Issue a **new ID** when privileges change (login, role elevation).

### ASP.NET Core `HttpContext.Session`

```csharp
builder.Services.AddDistributedMemoryCache();   // dev only; use Redis in production
// builder.Services.AddStackExchangeRedisCache(o => o.Configuration = "localhost:6379");

builder.Services.AddSession(o =>
{
    o.IdleTimeout = TimeSpan.FromMinutes(20);     // default is 20 minutes
    o.Cookie.Name = "__Host-sid";
    o.Cookie.HttpOnly = true;
    o.Cookie.IsEssential = true;                  // otherwise a consent policy can block it
    o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    o.Cookie.SameSite = SameSiteMode.Lax;
});

var app = builder.Build();
app.UseSession();                                 // before the endpoints that use it

// usage
HttpContext.Session.SetString("cartId", "c-981");
HttpContext.Session.SetInt32("visits", 1);
var cartId = HttpContext.Session.GetString("cartId");
HttpContext.Session.Clear();
```

- Session values are strings, ints or byte arrays; serialize complex objects to JSON yourself.

#### `HttpContext.Session` in detail

**How it works per request**

```
Request arrives with Cookie: <protected session key>
  -> UseSession middleware: decrypt the cookie (Data Protection), get the session key; if none/invalid, create a new random key
  -> a lazy session object is attached to HttpContext.Session
  -> your code calls Get/Set (data is loaded from IDistributedCache on first use)
  -> response finishes: session is committed (written back to the cache if modified)
  -> Set-Cookie is sent only when a value was written to a new session
```

- The cookie holds the session key **encrypted with Data Protection**; the data itself lives in the `IDistributedCache` store (memory, Redis, SQL Server).
- Reading from a session that doesn't exist doesn't create a cookie. The first `Set...` does.
- Writing after the response has started throws ("The session cannot be established after the response has started").
- Session is **non-locking**: two simultaneous requests from the same session can overwrite each other's changes (last write wins, and the whole session is stored as one unit). Avoid parallel AJAX calls that write to the same session.
- `IdleTimeout` is sliding: it restarts while the session keeps being used. Session data is per **browser** (cookie), not per user: two devices = two sessions.

**Setup (3 steps)**
1. Register a cache that implements `IDistributedCache` (`AddDistributedMemoryCache()` for dev, Redis or SQL Server for production).
2. `builder.Services.AddSession(...)`.
3. `app.UseSession();` after `UseRouting`/`UseCors`/authentication (if used) and before the endpoints that use it.

**Working example (minimal API)**

```csharp
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(o =>
{
    o.IdleTimeout = TimeSpan.FromMinutes(20);
    o.Cookie.Name = "__Host-sid";            // needs HTTPS (Secure) and Path=/
    o.Cookie.HttpOnly = true;
    o.Cookie.IsEssential = true;
    o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    o.Cookie.SameSite = SameSiteMode.Lax;
});

var app = builder.Build();
app.UseHttpsRedirection();
app.UseSession();

app.MapGet("/", async (HttpContext ctx) =>
{
    await ctx.Session.LoadAsync();           // async load, avoids sync I/O on remote caches
    var visits = (ctx.Session.GetInt32("visits") ?? 0) + 1;
    ctx.Session.SetInt32("visits", visits);
    return $"Visit number {visits}";
});

app.MapPost("/cart/{productId:int}", (int productId, HttpContext ctx) =>
{
    var cart = ctx.Session.GetObject<List<int>>("cart") ?? new List<int>();
    cart.Add(productId);
    ctx.Session.SetObject("cart", cart);
    return Results.Ok(cart);
});

app.MapGet("/cart", (HttpContext ctx) =>
    Results.Ok(ctx.Session.GetObject<List<int>>("cart") ?? new List<int>()));

app.MapPost("/logout", (HttpContext ctx) =>
{
    ctx.Session.Clear();
    ctx.Response.Cookies.Delete("__Host-sid", new CookieOptions { Path = "/", Secure = true });
    return Results.Ok();
});

app.Run();

// helper: put in its own file
public static class SessionExtensions
{
    public static void SetObject<T>(this ISession session, string key, T value)
        => session.SetString(key, JsonSerializer.Serialize(value));

    public static T? GetObject<T>(this ISession session, string key)
    {
        var json = session.GetString(key);
        return json is null ? default : JsonSerializer.Deserialize<T>(json);
    }
}
```

In controllers/Razor Pages, `HttpContext` is a property, so the calls are the same (`HttpContext.Session...`). Elsewhere inject `IHttpContextAccessor`.

**`ISession` API**

| Member | Purpose |
| --- | --- |
| `SetString` / `GetString` | Store/read a string |
| `SetInt32` / `GetInt32` | Store/read an int (`GetInt32` returns `int?`) |
| `Set(key, byte[])` / `Get(key)` / `TryGetValue` | Raw bytes |
| `Remove(key)` | Delete one key |
| `Clear()` | Delete all data in this session |
| `Keys` | List keys |
| `Id` | A separate session identifier stored inside the session data (not the cache key, not the cookie value); still don't expose it to clients |
| `IsAvailable` | Whether the store was reachable |
| `LoadAsync()` / `CommitAsync()` | Explicit async load / save |

**Production setup**

```csharp
builder.Services.AddStackExchangeRedisCache(o =>
{
    o.Configuration = builder.Configuration.GetConnectionString("Redis");
    o.InstanceName = "shop:";
});
// or SQL Server: AddDistributedSqlServerCache(...) after creating the table with `dotnet sql-cache create`

// several instances: share the Data Protection keys so every instance can read the cookie
builder.Services.AddDataProtection()
    .SetApplicationName("shop")
    .PersistKeysToStackExchangeRedis(ConnectionMultiplexer.Connect("..."), "DataProtection-Keys");
// (package: Microsoft.AspNetCore.DataProtection.StackExchangeRedis)
```

**Gotchas**
- Keep sessions small: every request that loads the session reads all its keys.
- No `Session` in a Blazor Server component (no stable `HttpContext`); it isn't a fit for token-based APIs or cross-site SPAs.
- POST endpoints that rely on a session cookie still need CSRF protection (antiforgery).
- Don't store passwords or secrets in session. For **login**, use ASP.NET Core Identity / cookie authentication; use `Session` for temporary per-user data (cart, wizard steps, flash state).
- `IsEssential = true` or a cookie-consent policy can block the session cookie.
- In-memory store: lost on restart and not shared between servers.

**Try it**

```
curl -k -c jar.txt -b jar.txt https://localhost:7001/      # Visit number 1
curl -k -c jar.txt -b jar.txt https://localhost:7001/      # Visit number 2
```

(`-k` only because of the local dev certificate.) Or open DevTools -> Application -> Cookies and watch the cookie appear after the first `Set`.

### Security

| Threat | What happens | Defence |
| --- | --- | --- |
| Session hijacking | Attacker obtains the ID (sniffing, XSS, malware, logged URL) and acts as the user, no password needed | HTTPS + `Secure` + HSTS, `HttpOnly`, short timeouts, re-authenticate for sensitive actions, delete on logout |
| Session fixation | Attacker plants a known ID in the victim's browser; the victim logs in; the attacker reuses that ID | Issue a **new ID on login**, never accept IDs from the URL, `__Host-` prefix blocks subdomain-set cookies |
| Predictable IDs | Attacker guesses valid IDs | Long random IDs from a secure generator |
| Session store bloat | Creating sessions for every anonymous visitor fills the store | Create sessions only when needed, set TTLs |
| Data tampering | (Not possible: the data is server-side, an advantage over client-side data) | |

- As far as I know ASP.NET Core's `HttpContext.Session` has no built-in "regenerate ID" call; a common approach is to clear the session and delete its cookie on login (check current docs).

### Scaling: many servers
- Problem: request 1 hits server A (session in A's memory), request 2 hits server B (no session) -> user looks logged out.
- Fixes: (1) **shared session store** (Redis), preferred; (2) **sticky sessions**: the load balancer pins a user to one server with an affinity cookie (downsides: uneven load, session lost if that server dies); (3) stateless tokens.
- The shared store becomes a dependency: if Redis is down, everyone is logged out; use replication/persistence. A lookup per request is typically sub-millisecond on a nearby Redis.

### Debugging "randomly logged out"
- Multiple servers without a shared store, or an app restart with an in-memory store.
- **Data Protection keys** not shared or not persisted across instances (containers, scale-out): cookies encrypted by one instance can't be read by another. Persist/share the key ring (file share, Redis, Azure Blob) and set the same application name.
- Idle timeout expired; `Secure` cookie not set behind a proxy (missing forwarded headers); `SameSite`/`Domain` problems; cookie too large.
- DevTools -> Application -> Cookies to see `.AspNetCore.Session` or your session cookie.

### Self-check
- What is the difference between a session cookie and a server-side session?
- Why must a session ID be random and long, and why never in the URL?
- A user's requests alternate between two servers and they keep getting logged out. Why, and name two fixes.
- What is session fixation and how do you prevent it?
- Why is logout instant with server-side sessions but harder with JWTs?

### Interview questions and answers

**Q1. [Basic] Session vs cookie vs token: what's the difference?**

**A.** A **cookie** is a browser storage and transport mechanism. A **session** is server-side state about a user's interaction, found via a random ID. A **token** (for example a JWT) carries its claims inside itself and is verified by signature, so the server needn't look anything up. Typical combos: cookie carrying a session ID (stateful), or cookie or header carrying a JWT (stateless).

**Q2. [Basic] Explain how server-side sessions work end to end.**

**A.** On login the server verifies credentials, creates a session record in a store (`sid` maps to user ID, cart, expiry), and sends the random `sid` in a `Set-Cookie`. On each request the browser sends the cookie, the server looks the ID up, and restores the user context. On logout the server deletes the record, so the ID is dead immediately. The cookie should be `HttpOnly`, `Secure` and `SameSite`, and the ID should be long, random and never in the URL.

**Q3. [Intermediate] Where can session data be stored, and what are the trade-offs?**

**A.**
- **In-process memory**: fastest, but lost on restart or recycle and not shared between servers (dev or single server only).
- **SQL Server or another database**: durable and shared, slower, needs cleanup of expired rows.
- **Redis (distributed cache)**: fast, shared, built-in TTL expiry; the common production choice, but sessions are lost if Redis loses data, so plan persistence or replication.

**Q4. [Intermediate] How does `HttpContext.Session` work internally in ASP.NET Core?**

**A.** It has no storage of its own; it saves to whatever `IDistributedCache` you registered (`AddDistributedMemoryCache`, Redis, SQL Server). The session middleware reads the cookie (default `.AspNetCore.Session`), decrypts it with Data Protection to get a **session key**, and attaches a lazy session object. Data is loaded from the cache on first use and written back at the end of the request if modified, as one cache entry under the session key, with the idle timeout (default 20 minutes) as sliding expiration. The cookie is only issued when a value is written to a new session. Values in the store are not encrypted.

**Q5. [Advanced] What are the cookie value, the session key and `Session.Id`, and how do they differ?**

**A.** The **cookie value** is the session key encrypted by Data Protection. The **session key** is a GUID generated by the middleware and used as the cache key (Redis key, SQL `Id`). `Session.Id` is a separate GUID generated by the session object and stored inside the session data. They differ because their **lifetimes** differ: if a session expires on the server but the browser still sends the old cookie, a new session is created under the same key with a new `Id`. Use `Id` for logging and correlation, not for authentication.

**Q6. [Intermediate] Users get randomly logged out in production with several instances. Why?**

**A.**
- Sessions are in **in-memory** storage, so each instance has its own.
- **Data Protection keys** aren't shared or persisted across instances (containers, scale-out), so one instance can't decrypt cookies made by another. Persist keys to shared storage (Redis, Blob, file share) and set the same application name.
- The app restarted or the app pool recycled with an in-memory store.
- Idle timeout expired, or the cookie isn't being sent (`Secure` behind a proxy without forwarded headers, `SameSite`, size).

**Q7. [Intermediate] Sticky sessions vs a shared session store?**

**A.** Sticky sessions make the load balancer send a user to the same server (IP hash or an affinity cookie). It's easy but gives uneven load and loses the session if that server dies or is redeployed. A shared store (Redis) lets any instance serve any request, so scaling and deploys are easier, at the cost of a dependency and a network lookup per request. Prefer the shared store.

**Q8. [Intermediate] Session hijacking vs session fixation, and how do you prevent them?**

**A.** **Hijacking**: the attacker steals a valid session ID (sniffing, XSS, malware, logs) and acts as the user. Defences: HTTPS plus `Secure` and HSTS, `HttpOnly`, short timeouts, re-authentication for sensitive actions, logout deletes the server record, anomaly detection. **Fixation**: the attacker plants a known session ID in the victim's browser, the victim logs in, and the attacker reuses that ID. Defences: issue a **new session ID on login** and on privilege changes, never accept IDs from the URL, and use `__Host-` cookies so subdomains can't plant one. ASP.NET Core's `HttpContext.Session` has no built-in "regenerate ID" call, so clear the session and replace its cookie at login (check current docs).

**Q9. [Intermediate] Idle timeout vs absolute timeout?**

**A.** Idle (sliding) timeout ends the session after a period of inactivity (for example 20 minutes) and renews on each request. Absolute timeout ends it after a fixed maximum lifetime (for example 8 to 12 hours) no matter how active the user is, which limits how long a stolen session is useful. Use both for sensitive apps.

**Q10. [Advanced] Server-side sessions vs JWTs: how do you choose?**

**A.**

| | Server-side session | JWT |
| --- | --- | --- |
| State lives | Server store | Inside the token |
| Revoke or log out | Instant (delete the record) | Hard until expiry (needs a denylist) |
| Scaling | Needs a shared store | Any server verifies the signature |
| Size | Tiny ID | Larger |
| Per request | Store lookup | Signature check |

Common compromise: short-lived access tokens (5 to 15 minutes) plus rotating refresh tokens stored server-side, so you get cheap verification and the ability to revoke. For a classic server-rendered web app, cookie plus session (or cookie authentication) is simple and safe.

**Q11. [Advanced] Is `HttpContext.Session` thread-safe and consistent under concurrent requests?**

**A.** It is non-locking: two simultaneous requests from the same session can overwrite each other's changes, because the whole session is loaded and written back as one unit (last write wins). Avoid parallel AJAX calls that write to the same session, keep sessions small, or put frequently changing data in a proper store keyed by user.

**Q12. [Intermediate] When should you not use `HttpContext.Session`?**

**A.** Not for authentication (use ASP.NET Core Identity or cookie authentication), not for secrets (the store isn't encrypted), not for token-based APIs or cross-site SPAs, not in Blazor Server components (no stable `HttpContext`), and not for large or business-critical data. Use it for small temporary per-visitor state: a cart, wizard steps, flash messages.

**Q13. [Intermediate] How do you implement a secure logout?**

**A.** Delete the server-side session record (`Session.Clear()` and remove the store entry; revoke refresh tokens), expire the cookie (same name, `Path` and `Domain`), and for cookie authentication call `SignOutAsync`. Redirect and send `Cache-Control: no-store` for sensitive pages. For single sign-on you may also need identity-provider logout. A client that only deletes its cookie leaves the server session alive until it expires.

**Q14. [Advanced] What happens when the session store (Redis) is down, and how do you design for it?**

**A.** Requests that need the session fail, or users appear logged out. Design: replication or a managed highly available Redis, timeouts and retries with a circuit breaker, "fail closed" for security-sensitive paths, graceful degradation for non-critical session data, and alerting. Reduce dependence on the store with stateless auth cookies and short-lived tokens for the critical path.

---

## Topic 3: Reverse proxy

### What it is
A **reverse proxy** is a server that sits in front of one or more backend servers. Clients send requests to the proxy; the proxy picks a backend, forwards the request, and returns the response. Clients never talk to (or even know about) the backends.

- A **forward proxy** sits in front of *clients* (corporate proxy, VPN) and hides clients from the internet. A **reverse proxy** sits in front of *servers* and hides servers from clients.
- Analogy: a hotel front desk. Guests talk to reception, which routes them to the right department; nobody walks into the back office.

```
Client --HTTPS--> Reverse proxy (Nginx) --HTTP--> App servers (Kestrel :5000, :5001) --> Database
```

This is the "load balancer / reverse proxy" hop in step 6 of the URL journey (Stage 1, Topic 1).

### Request walk-through: `GET https://shop.example.com/api/products`
1. DNS returns the **proxy's** IP (not the app's).
2. TCP and TLS handshakes end at the proxy (TLS termination).
3. Proxy reads the HTTP request (`Host`, path) and matches a rule (`/api/` -> the API pool).
4. Proxy picks a backend (e.g. least connections), reuses or opens a connection to it, forwards the request with `X-Forwarded-*` headers added.
5. Kestrel/the app handles it and replies.
6. Proxy returns the response to the client (possibly compressed or cached).

### What a reverse proxy does
- **TLS termination**: certificates and HTTPS handled in one place; backends can speak plain HTTP.
- **Load balancing**: spreads requests across instances; removes unhealthy ones.
- **Routing**: by host or path (`/api` -> API, `/` -> frontend, `admin.example.com` -> admin app); many sites on one IP and port 443.
- **Caching and compression** (gzip/brotli), and serving **static files** directly.
- **Security**: hides backend IPs and ports, only 80/443 exposed; rate limiting, IP allow/deny, request size limits, WAF; buffers slow clients so they don't tie up backend workers.
- **Protocol bridging**: HTTP/2 or HTTP/3 to clients, HTTP/1.1 to backends.
- **Headers**: adds `X-Forwarded-*`, request/correlation IDs, security headers.
- **Zero-downtime deploys** (switch or drain backends), central logging and metrics.

### Related terms

| Term | What it is |
| --- | --- |
| Reverse proxy | General: in front of servers, forwards on their behalf |
| Load balancer | Spreads traffic across backends (often a reverse proxy feature); L4 (IP/port) or L7 (HTTP aware) |
| API gateway | Reverse proxy plus API features: auth, per-key rate limits, transformation, versioning (Kong, Azure API Management, YARP-based gateways) |
| CDN | A worldwide network of caching reverse proxies (Topic 4) |
| Forward proxy | In front of clients |

### Common tools
Nginx, HAProxy, Caddy, Traefik, Envoy, Apache httpd, IIS with ARR; cloud: Azure Application Gateway / Front Door, AWS ALB / CloudFront, Cloudflare; Kubernetes Ingress controllers; **YARP** (Microsoft's .NET reverse proxy library). Kestrel can face the internet directly, but a proxy in front is still the common setup for the reasons above.

### What the backend sees
- The connection comes from the **proxy's IP**, so `RemoteIpAddress` is the proxy unless you handle forwarded headers.
- The proxy tells the backend the original details:
  - `X-Forwarded-For: 203.0.113.50, 10.0.0.5` (client first; each proxy appends who connected to it)
  - `X-Forwarded-Proto: https`, `X-Forwarded-Host: shop.example.com` (standard form: `Forwarded`, RFC 7239)
- Also pass `Host` (`proxy_set_header Host $host;`) or the backend sees its internal name.
- Clients can forge these headers, so the backend must trust them **only from known proxies**. ASP.NET Core reads `X-Forwarded-For` right to left and only trusts entries added by known proxies.

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownProxies.Add(IPAddress.Parse("10.0.0.5"));   // your proxy's IP (loopback is trusted by default)
});

var app = builder.Build();
app.UseForwardedHeaders();      // first, before HTTPS redirection, HSTS, auth, cookies
```

- Without it: wrong client IPs in logs and rate limiting, `Request.Scheme` is `http`, redirect loops, `Secure` cookie problems.
- In containers, `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` turns the middleware on and trusts all proxies; use it only when the app is reachable solely through your proxy.

### Nginx example: TLS, load balancing, static files, API, frontend

```nginx
upstream shop_api {
    least_conn;
    server 10.0.0.11:5000;
    server 10.0.0.12:5000;
    server 10.0.0.13:5000 backup;
    keepalive 32;
}

server {
    listen 80;
    server_name shop.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name shop.example.com;
    ssl_certificate     /etc/letsencrypt/live/shop.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.example.com/privkey.pem;

    gzip on;
    gzip_types text/css application/javascript application/json;

    location /static/ {
        root /var/www/shop;
        expires 7d;
    }

    location /api/ {
        proxy_pass http://shop_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://localhost:3000;      # frontend
    }
}
```

- WebSockets/SignalR need `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` on that location.
- Test and apply: `sudo nginx -t` then `sudo systemctl reload nginx`.

### Load balancing details
- Algorithms: **round robin** (default), **weighted** round robin, **least connections**, **IP hash** (same client -> same backend).
- **Health checks**: passive (mark a backend failed after errors, e.g. `max_fails`/`fail_timeout` in Nginx) or active (the proxy probes a `/health` endpoint: HAProxy, cloud load balancers, Nginx Plus).
- **Sticky sessions** (IP hash or an affinity cookie) keep a user on one server; better to use a shared session store (Topic 2) so any backend can serve any request.
- Run 2+ proxies (or a cloud load balancer) so the proxy itself isn't a single point of failure.

### Trade-offs
- Pros: central TLS, scaling, security, simpler apps, zero-downtime deploys.
- Cons: one more hop (small latency), one more component to run and monitor, misconfigured headers/timeouts/body limits cause subtle bugs, harder to tell which layer produced an error.

### Errors and debugging

| Symptom | Likely cause |
| --- | --- |
| 502 Bad Gateway | Proxy got no valid response: backend down, wrong port, crashed, connection refused |
| 503 Service Unavailable | No healthy backend, or overloaded |
| 504 Gateway Timeout | Backend slower than `proxy_read_timeout` |
| 413 Request Entity Too Large | `client_max_body_size` (Nginx default 1 MB), classic for uploads |
| 400 "Header Or Cookie Too Large" / 431 | Cookies/headers over the limit (Topic 1) |
| Redirect loop, missing `Secure` cookie, wrong client IP | Forwarded headers not configured/trusted |
| SignalR/WebSocket fails | Missing `Upgrade`/`Connection` headers |

- Bypass the proxy to compare: `curl -v http://10.0.0.11:5000/api/products` vs `curl -v https://shop.example.com/api/products`.
- Check the proxy's `access.log` and `error.log`; add an `X-Request-Id` and log it in both proxy and app.

### Hands-on: Nginx + two app containers (Docker Compose)

```yaml
services:
  api1:
    image: myapi
  api2:
    image: myapi
  nginx:
    image: nginx:stable
    ports: ["80:80"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf:ro"]
    depends_on: [api1, api2]
```

```nginx
events {}
http {
    upstream api {
        server api1:8080;     # Docker DNS resolves service names; .NET 8+ images listen on 8080
        server api2:8080;
    }
    server {
        listen 80;
        location / {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

Make an endpoint return `Environment.MachineName`, then run `curl localhost/` several times and watch the answers alternate between the two containers.

### YARP: a reverse proxy inside a .NET app

```csharp
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));
app.MapReverseProxy();       // package: Yarp.ReverseProxy
```

```json
"ReverseProxy": {
  "Routes": { "api": { "ClusterId": "api", "Match": { "Path": "/api/{**catch-all}" } } },
  "Clusters": { "api": { "Destinations": {
    "a": { "Address": "http://10.0.0.11:5000/" },
    "b": { "Address": "http://10.0.0.12:5000/" } } } }
}
```

Useful for gateways and BFF (backend-for-frontend) services written in .NET.

### Self-check
- What is the difference between a forward proxy and a reverse proxy?
- Why does the backend see the proxy's IP, and what do `X-Forwarded-For` and `X-Forwarded-Proto` fix?
- Why must the app trust forwarded headers only from known proxies?
- What do 502, 503 and 504 each tell you?
- Why do sticky sessions become unnecessary with a shared session store?

### Interview questions and answers

**Q1. [Basic] What is a reverse proxy, and how is it different from a forward proxy?**

**A.** A reverse proxy sits in front of servers, receives client requests, forwards them to a backend and returns the response; clients don't know the backends. A forward proxy sits in front of clients (corporate proxy, VPN) and hides clients from the internet. Reverse proxies serve the server side: TLS termination, load balancing, caching, routing, security.

**Q2. [Intermediate] Reverse proxy vs load balancer vs API gateway vs CDN?**

**A.** A **reverse proxy** is the general pattern. A **load balancer** spreads traffic across instances (often a reverse proxy feature; L4 or L7). An **API gateway** is a reverse proxy plus API concerns: authentication, per-key rate limits and quotas, request transformation, versioning, usage analytics (Azure API Management, Kong, YARP-based gateways). A **CDN** is a global network of caching reverse proxies close to users.

**Q3. [Intermediate] Why put Nginx, IIS or a cloud load balancer in front of Kestrel?**

**A.** TLS termination and certificate management in one place, load balancing and health checks, routing several apps or paths behind one domain and port, static files, compression and caching, rate limiting, request size limits and slow-client buffering, hiding backend addresses, zero-downtime deployments, and centralized logging. Kestrel can face the internet directly, but a proxy adds these operational and security layers.

**Q4. [Intermediate] What is TLS termination, and what changes for the app?**

**A.** The proxy handles TLS and talks plain HTTP (or re-encrypted TLS) to the app. The app sees the proxy's IP, `http` as the scheme, and the internal host name, unless the proxy passes `X-Forwarded-For`, `X-Forwarded-Proto` and `Host` and the app processes them. Otherwise you get redirect loops, wrong client IPs, and `Secure` cookies not being issued.

**Q5. [Intermediate] How do you configure ASP.NET Core behind a proxy?**

**A.** Enable the forwarded headers middleware **first** in the pipeline (before HTTPS redirection, HSTS, authentication and cookies):

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownProxies.Add(IPAddress.Parse("10.0.0.5"));
});
app.UseForwardedHeaders();
```

Only loopback proxies are trusted by default, so list your proxy's address (or network). `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` trusts all proxies and is only appropriate if the app is reachable solely through your proxy.

**Q6. [Advanced] Why must forwarded headers be trusted only from known proxies? How is `X-Forwarded-For` processed?**

**A.** Any client can send its own `X-Forwarded-For` and spoof its IP (to bypass rate limits, IP allowlists or audit logs). Each proxy appends the address that connected to it, so the list reads client first, nearest proxy last. ASP.NET Core processes it from the **right**, skipping known proxies, and stops at the first untrusted address (`ForwardLimit` also caps how many it reads). The proxy should also overwrite or strip client-supplied forwarding headers.

**Q7. [Intermediate] Load balancing algorithms and health checks?**

**A.** Algorithms: round robin, weighted round robin, least connections, IP hash (same client to same backend), and sometimes random with two choices. Health checks: **passive** (mark a backend failed after errors or timeouts, such as `max_fails` in Nginx) or **active** (the proxy probes `/health` regularly: HAProxy, cloud load balancers). Use readiness endpoints that check dependencies carefully (so a database blip doesn't take every instance out at once).

**Q8. [Intermediate] 502 vs 503 vs 504?**

**A.** **502 Bad Gateway**: the proxy got no valid response (backend down, crashed, wrong port, connection refused, invalid response). **503 Service Unavailable**: no healthy backend, overloaded, or maintenance. **504 Gateway Timeout**: the backend didn't respond within the proxy's timeout (`proxy_read_timeout` in Nginx, default 60 s). Compare by calling the backend directly, and check the proxy's `error.log`.

**Q9. [Intermediate] L4 vs L7 load balancing?**

**A.** L4 works on IP and port: very fast, protocol-agnostic, can pass TLS through, but can't route by path or header. L7 understands HTTP: routes by host, path or header, terminates TLS, rewrites, compresses, runs a WAF and rate limits, at more CPU cost. Examples: AWS NLB vs ALB, Azure Load Balancer vs Application Gateway.

**Q10. [Advanced] What changes for WebSockets, SignalR and gRPC through a proxy?**

**A.** WebSockets need the `Upgrade` and `Connection` headers forwarded and HTTP/1.1 to the backend; connections are long-lived, so raise read and idle timeouts (load balancers commonly close idle connections after 60 s, so use heartbeats). gRPC needs HTTP/2 to the backend (`grpc_pass` in Nginx). SignalR with several servers needs either sticky sessions or a backplane (Redis) or a managed service (Azure SignalR) so a client's messages reach its connection.

**Q11. [Intermediate] Uploads fail with 413 behind a proxy. What do you check?**

**A.** Every layer has its own limit: Nginx `client_max_body_size` (default 1 MB), Kestrel `MaxRequestBodySize` (about 30 MB by default) or `[RequestSizeLimit]`, IIS `maxAllowedContentLength` (about 30 MB by default), form and multipart limits in ASP.NET Core, the load balancer or CDN's own cap, plus timeouts for slow uploads. For large files, upload straight to object storage with a pre-signed URL instead.

**Q12. [Advanced] How do you deploy without downtime using a proxy?**

**A.** Rolling or blue-green deployments: take an instance out of rotation, **drain connections** (let in-flight requests finish), deploy, wait for the readiness check to pass, put it back, then repeat. The app should shut down gracefully (handle SIGTERM, stop accepting new requests, finish current ones) and the proxy should stop sending new requests as soon as the instance reports unready. Database changes must be backward compatible while old and new versions run together.

**Q13. [Advanced] Isn't the proxy a single point of failure?**

**A.** It can be, so run at least two behind a highly available front: a cloud load balancer, DNS across several proxies, or a floating IP with VRRP/keepalived, plus health checks and auto-replacement. Keep proxy configuration in version control, test it (`nginx -t`) and reload gracefully.

**Q14. [Intermediate] What is YARP and when would you use it?**

**A.** Microsoft's reverse proxy library for .NET: you map routes and clusters (from configuration or code) and call `app.MapReverseProxy()`. Use it to build an API gateway or backend-for-frontend in C#, with custom logic in middleware (authentication, header rewriting, transforms, load balancing, health checks, rate limiting) that's awkward in Nginx. For plain TLS termination and static content, Nginx, HAProxy or a cloud load balancer is simpler.

---

## Topic 4: CDN (Content Delivery Network)

### What it is
A **CDN** is a geographically distributed network of servers (**edge servers**, located in **PoPs**, points of presence) that **cache and deliver your content close to users**. Your own server is the **origin**. Technically a CDN is a worldwide fleet of caching **reverse proxies** (Topic 3) run by a provider.

### Why use one

- **Latency (physics).** Light in fibre covers roughly 200,000 km/s, so distance sets a floor on round-trip time (RTT). A user in Delhi talking to an origin in the US East typically sees about 200-300 ms RTT. A cold HTTPS request needs about 3 round trips (TCP 1 + TLS 1 + HTTP 1, from Stage 1): roughly **0.6-0.9 s** before the first byte, versus about **50 ms** if the edge is in the same city at ~15 ms RTT (illustrative numbers).
- **Offload.** If 100,000 page views each download 2 MB (200 GB) and the CDN has a 95% hit ratio, the origin serves about 10 GB. Fewer servers, lower bandwidth bills, spikes absorbed.
- **Availability.** Can serve stale content while the origin is down; spreads DDoS traffic across many locations.
- **Security and features.** TLS at the edge, WAF, bot protection, hides the origin IP, compression, image optimization, HTTP/2 and HTTP/3, edge compute (Cloudflare Workers, Lambda@Edge, CloudFront Functions).

### How a request flows

```
User (Delhi) -> DNS: www.example.com CNAME -> d123.cdn-provider.net -> IP of the nearest edge
User -> Edge (TCP + TLS end here, close to the user)
Edge checks its cache (key = host + path + query, plus any Vary headers):
   HIT  -> respond immediately (Age: 3412, cache status HIT)
   MISS -> Edge -> (regional/shield tier) -> Origin -> response stored per cache rules -> User
Next user in that region -> HIT
```

- Routing to the nearest edge: geo/latency-based DNS answers, or **Anycast** (the same IP advertised from many places; the network routes you to the closest). Uses the CNAME record from DNS (Stage 1, Topic 4).
- **Tiered caching / origin shield**: edges ask a regional cache first, so many edge misses collapse into one origin request.
- Even **uncacheable dynamic requests** get faster: the short TCP/TLS leg is to the nearby edge, and the edge reuses warm persistent connections to the origin.

### Pull vs push

| | Pull (origin pull) | Push |
| --- | --- | --- |
| How | CDN fetches from your origin on first request | You upload files to CDN storage |
| Origin | Your web app or a storage bucket | Object storage (Azure Blob, S3) |
| Best for | Websites, APIs | Large static libraries, downloads, media |

### Controlling what is cached and for how long
The origin sends headers (Stage 1 Topic 1 and 2 introduced `Cache-Control`, `ETag`, 304):

| Header | Meaning |
| --- | --- |
| `Cache-Control: public, max-age=3600` | Browsers and shared caches may keep it for 1 hour |
| `s-maxage=86400` | Lifetime for **shared caches** (CDN), overriding `max-age` there |
| `private` | Browser only; the CDN must not store it |
| `no-store` | Never store anywhere |
| `no-cache` | May store, but must revalidate before reuse |
| `immutable` | Won't change during its lifetime; no revalidation |
| `stale-while-revalidate=60`, `stale-if-error=86400` | Serve stale while refreshing / when the origin errors (support varies by CDN) |
| `ETag` / `Last-Modified` | Revalidation: `304 Not Modified` instead of the full body |
| `Vary: Accept-Encoding` | Cache separate variants per request header |
| `CDN-Cache-Control` / `Surrogate-Control` | CDN-specific rules (where supported) |

- CDNs can also override with their own rules (TTLs by path, bypass rules).
- **Cache key**: normally scheme + host + path + query. Ignoring tracking parameters (`utm_*`) raises the **hit ratio** (hits / total requests).
- **Cookies** (Topic 1): requests with cookies or responses with `Set-Cookie` are often treated as uncacheable or fragment the cache. Strip or ignore cookies on static paths.
- Requests with `Authorization` are usually not cached.
- **What to cache**: static assets (JS, CSS, images, fonts, video segments); public API GETs with short TTLs; sometimes HTML.
- **Never cache personalized responses** (account page, cart) without keying correctly; a cached page for user A served to user B is a data leak. Send `private` or `no-store` for them.

### Cache invalidation (the hard part)
1. **Fingerprinted/versioned filenames** (best): `app.3f9c1a.js` or `?v=<hash>` with `Cache-Control: public, max-age=31536000, immutable`. A change creates a new URL, so nothing needs purging. Keep the HTML short-lived (or `no-cache`) so it points at the new asset names.
2. **Purge/invalidate** via the CDN API (by URL, prefix, tag or all). Watch limits, cost and delay.
3. **Short TTLs** plus `stale-while-revalidate` for HTML and APIs.

### ASP.NET Core

```csharp
// Long-lived static files (use with fingerprinted names)
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
        ctx.Context.Response.Headers.CacheControl = "public,max-age=31536000,immutable"
});

// Cacheable public data
[ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]   // Cache-Control: public,max-age=60
public IActionResult Products() => Ok(...);

// Personalized: keep out of shared caches
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public IActionResult Account() => View();
```

- Razor/MVC: `<script src="~/js/site.js" asp-append-version="true"></script>` adds a content hash (`site.js?v=...`). In .NET 9+, `MapStaticAssets` can fingerprint and compress static files for you (see the docs).

### Securing the origin and passing client info
- Users or attackers who learn the origin IP can bypass the CDN. Lock it down: allow only the CDN's published IP ranges, require a secret header set by the CDN, use mutual TLS from the CDN to the origin (authenticated origin pulls, Stage 1 mTLS), or private connectivity.
- The origin sees **CDN IPs**. The CDN passes the real client in `X-Forwarded-For` or a provider header (e.g. `CF-Connecting-IP`, `CloudFront-Viewer-Country`). Trust these only from the CDN's ranges (forwarded headers, Topic 3).
- Assets on a different hostname: cookies aren't sent there (cookieless, Topic 1), but fonts and `fetch` calls need **CORS** (`Access-Control-Allow-Origin`).
- Third-party/public CDNs (jsDelivr, cdnjs, unpkg): use **Subresource Integrity** so a compromised CDN can't swap the script:

```html
<script src="https://cdn.jsdelivr.net/npm/lib@1.2.3/dist/lib.min.js"
        integrity="sha384-..." crossorigin="anonymous"></script>
```

### Popular CDNs
Cloudflare, Amazon CloudFront, Akamai, Fastly, Azure Front Door / Azure CDN, Google Cloud CDN, Bunny.net.

### Pitfalls
- Stale content after a deploy (no fingerprinting, forgot to purge).
- Caching personalized pages (data leaks); web cache deception/poisoning via unkeyed headers.
- Cookies, `Vary` or random query strings fragmenting the cache (low hit ratio).
- Origin reachable directly; wrong client IPs in logs and rate limits.
- Errors (5xx) cached; mismatched TTLs between origin and CDN rules.
- Cost surprises: egress, request counts, invalidations.
- CORS errors for fonts or cross-origin `fetch`.

### Debugging
- `curl -I https://www.example.com/static/app.3f9c1a.js` and read `Age`, `Cache-Control` and the cache status header (`cf-cache-status: HIT|MISS|EXPIRED|BYPASS|DYNAMIC` on Cloudflare, `X-Cache: Hit from cloudfront` on CloudFront).
- Force a miss with a throwaway query string: `?cachebust=123`.
- See the CDN in DNS: `dig +short www.example.com` (CNAME / edge IPs).
- Bypass the CDN to compare with the origin: `curl --resolve www.example.com:443:<origin-ip> https://www.example.com/`.

### Hands-on: act as a CDN edge with Nginx

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=edge:10m max_size=1g inactive=60m;

server {
    listen 80;
    location /static/ {
        proxy_cache edge;
        proxy_cache_valid 200 10m;
        proxy_cache_key "$scheme$host$request_uri";
        add_header X-Cache $upstream_cache_status;
        proxy_pass http://origin:8080;
    }
}
```

Run `curl -I localhost/static/app.js` twice: first `X-Cache: MISS`, then `X-Cache: HIT`. For a real CDN: put Cloudflare (free plan) in front of a site, or CloudFront in front of a storage bucket, and watch the cache status header.

### Self-check
- Why does a CDN reduce latency even for the first byte of a TLS connection?
- What is the difference between `max-age` and `s-maxage`, and when would you use `private`?
- How do fingerprinted filenames avoid the need to purge?
- What could go wrong if a personalized page is cached by the CDN?
- How do you stop users from bypassing the CDN and hitting your origin directly?

### Interview questions and answers

**Q1. [Basic] What is a CDN and what are its benefits?**

**A.** A geographically distributed network of edge servers that cache content close to users; your server is the **origin**. Benefits: lower latency (shorter round trips, and TCP and TLS end at a nearby edge), offloading the origin (a 95% hit ratio means the origin serves about 5% of the bytes), availability (serve stale content during outages, absorb spikes and DDoS), plus security and features (TLS at the edge, WAF, bot protection, compression, image optimization, HTTP/2 and HTTP/3, edge compute).

**Q2. [Intermediate] How does a user's request reach the nearest edge?**

**A.** Your domain is a CNAME to the CDN's hostname. The CDN's DNS returns the address of a nearby edge (based on the resolver's location or measured latency), or it uses **anycast**: the same IP is advertised from many locations and the network routes the user to the closest. After that the browser connects to that edge, and a cache miss goes through an optional regional tier to the origin.

**Q3. [Intermediate] Explain the Cache-Control directives you use with a CDN.**

**A.**
- `public, max-age=N`: any cache may keep it for N seconds.
- `s-maxage=N`: lifetime for shared caches (the CDN), overriding `max-age` there.
- `private`: browser only; the CDN must not store it.
- `no-store`: never store anywhere.
- `no-cache`: may store, but must revalidate before reuse (it does not mean "don't cache").
- `immutable`: won't change during its lifetime (use with fingerprinted filenames).
- `stale-while-revalidate`, `stale-if-error`: serve stale while refreshing, or when the origin fails (support varies by CDN).

Plus validators (`ETag`, `Last-Modified`) so revalidation returns `304`.

**Q4. [Intermediate] What is the cache key and the hit ratio, and how do you improve it?**

**A.** The cache key identifies an object, normally scheme plus host plus path plus query (plus `Vary` headers). The hit ratio is hits divided by total requests. Improve it by ignoring irrelevant query parameters (`utm_*`), normalizing case and trailing slashes, avoiding cookies on cacheable paths, minimizing `Vary` values (`Vary: Accept-Encoding` is fine, `Vary: Cookie` or `User-Agent` fragments the cache), using long TTLs for fingerprinted assets, and enabling tiered caching.

**Q5. [Intermediate] How do you invalidate cached content?**

**A.** Best: **fingerprinted filenames** (`app.3f9c1a.js`) with `max-age=31536000, immutable`; a change creates a new URL, so nothing needs purging, and the HTML that references it stays short-lived. Otherwise: purge by URL, prefix or tag through the CDN API (mind delay, limits and cost), or use short TTLs with `stale-while-revalidate`.

**Q6. [Intermediate] What should never be cached on a shared cache?**

**A.** Personalized or authenticated responses (account pages, carts, anything with user data) unless the cache key accounts for the user, and responses with `Set-Cookie`. Send `private` or `no-store`. Failure modes: serving user A's page to user B (a data leak), **web cache deception** (an attacker tricks the cache into storing a victim's private page under a static-looking URL such as `/account/profile.css`), and **cache poisoning** (an unkeyed header changes the response and a bad version is cached). Don't decide cacheability by file extension alone.

**Q7. [Intermediate] How do cookies interact with a CDN?**

**A.** Requests with cookies, or responses with `Set-Cookie`, are often treated as uncacheable or split into variants, which wrecks the hit ratio. Configure the CDN to ignore or strip cookies on static paths, serve assets from a cookieless host, and never put cookies in the cache key unless you mean to. Requests with an `Authorization` header are usually not cached.

**Q8. [Advanced] How do you stop people bypassing the CDN and hitting your origin directly?**

**A.** Allow only the CDN's published IP ranges at the firewall or security group, require a secret header set by the CDN, use mutual TLS from the CDN to the origin (authenticated origin pulls), or use private connectivity (for example origin access control for storage buckets). Don't leak the origin IP through DNS history, email headers or subdomains. Otherwise attackers skip the WAF and DDoS protection.

**Q9. [Intermediate] How does HTTPS work with a CDN?**

**A.** The CDN terminates TLS at the edge with a certificate for your domain (managed by the CDN or uploaded), and opens a second TLS connection to the origin. Use "full (strict)" style modes so the origin certificate is validated; "flexible" modes that send plain HTTP to the origin leave that hop unencrypted. The origin sees the CDN's IP, so trust the CDN's forwarded headers (`X-Forwarded-For`, or provider headers such as `CF-Connecting-IP`) only from its IP ranges.

**Q10. [Advanced] Can a CDN help with dynamic or API content?**

**A.** Yes. Short TTLs on public GETs, `stale-while-revalidate`, and request collapsing (many CDNs merge simultaneous misses for the same object into one origin request). Even uncacheable requests are faster: TCP and TLS finish at the nearby edge, and the edge reuses warm, optimized connections to the origin. Edge compute (Cloudflare Workers, Lambda@Edge, CloudFront Functions) can handle redirects, header logic, A/B tests and authentication checks near users.

**Q11. [Advanced] What are origin shield and tiered caching?**

**A.** Edge servers check a regional (or single "shield") cache before the origin, so many edge misses collapse into one origin request. It raises the effective hit ratio, protects the origin from stampedes after a purge or deploy, and lowers egress costs, at the cost of slightly higher latency on a miss.

**Q12. [Intermediate] How do you tell whether a response came from the CDN cache?**

**A.** `curl -I https://host/file` and read `Age`, `Cache-Control` and the CDN's status header (`cf-cache-status: HIT|MISS|EXPIRED|BYPASS|DYNAMIC` on Cloudflare, `X-Cache: Hit from cloudfront` on CloudFront). Force a miss with a throwaway query string. Compare with the origin directly: `curl --resolve host:443:<origin-ip> https://host/file`.

**Q13. [Intermediate] Is loading a library from a public CDN (jsDelivr, cdnjs) safe?**

**A.** It adds a third-party dependency: if that CDN or package is compromised, malicious code runs on your pages. Mitigate with **Subresource Integrity** (`integrity="sha384-..."` and `crossorigin="anonymous"`) so the browser rejects altered files, pin exact versions, add a Content Security Policy, or self-host critical scripts. Note that browsers no longer share cached libraries across sites, so a public CDN no longer gives the old "already cached" benefit.

**Q14. [Basic] Pull vs push CDN?**

**A.** **Pull** (origin pull): the CDN fetches from your origin on the first request and caches it; simplest and the default for websites and APIs. **Push**: you upload files to the CDN or its storage; suits large static libraries, downloads and media where you control publishing.

**Q15. [Intermediate] What is the difference between a CDN and a reverse proxy?**

**A.** A CDN is essentially many caching reverse proxies deployed worldwide and run by a provider, with global routing (DNS or anycast), shared caching, and extras like DDoS protection. A single reverse proxy (Nginx) sits next to your servers in one location, mainly for TLS termination, load balancing and routing. Many setups use both: CDN, then load balancer or reverse proxy, then the app.

---

<!-- End of web concepts notes -->
