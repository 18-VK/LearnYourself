# CORS Notes (Cross-Origin Resource Sharing)

## 1. What CORS is

Browsers enforce the **Same-Origin Policy**: JavaScript on one origin can't read responses from a different origin.

An origin = **scheme + host + port**. All of these are different origins:

- `https://app.yourdomain.com` vs `https://api.yourdomain.com` (host differs)
- `http://localhost:3000` vs `http://localhost:5001` (port differs)
- `http://site.com` vs `https://site.com` (scheme differs)

**CORS is how the server opts in** to letting specific other origins read its responses.

**Key points**

- Enforced **by the browser only**. curl, Postman, mobile apps and server-to-server calls ignore it.
- The request usually **still reaches the server**. The browser just refuses to hand the response to the page's JS.
- CORS protects the user's browser, **not your API**. It is not authentication.

---

## 2. The headers

| Header | Sent by | Purpose |
|---|---|---|
| `Origin` | Browser (automatic) | Where the page came from. JS cannot set or fake it. |
| `Access-Control-Allow-Origin` | Server | Which origin may read the response (one origin, or `*`). |
| `Access-Control-Allow-Methods` | Server (preflight reply) | Allowed HTTP methods. |
| `Access-Control-Allow-Headers` | Server (preflight reply) | Allowed request headers (`Authorization`, `Content-Type`...). |
| `Access-Control-Allow-Credentials` | Server | `true` lets the browser send credentials and expose the response to JS. |
| `Access-Control-Max-Age` | Server (preflight reply) | How long the browser may cache the preflight result. |
| `Access-Control-Expose-Headers` | Server | Extra response headers JS may read (e.g. `ETag`). |
| `Access-Control-Request-Method` / `-Headers` | Browser (preflight) | "I want to do this. Is it allowed?" |
| `Vary: Origin` | Server | Tells caches the response depends on the caller's origin. |

```http
Origin: https://app.yourdomain.com

Access-Control-Allow-Origin: https://app.yourdomain.com
Access-Control-Allow-Origin: *
```

---

## 3. Flow 1: simple request (no preflight)

`GET` / `HEAD` / `POST` with only basic headers and form-style content types.

```http
GET /api/tasks/categories HTTP/1.1
Host: api.yourdomain.com
Origin: https://app.yourdomain.com
```

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.yourdomain.com
Content-Type: application/json
```

The browser compares `Origin` with `Access-Control-Allow-Origin`:

- Match: JS receives the data.
- No match: JS gets a network error, and the console shows "blocked by CORS policy", even though the server responded.

---

## 4. Flow 2: preflighted request

Triggered by anything beyond a simple request: `PUT` / `PATCH` / `DELETE`, an `Authorization` header, or `Content-Type: application/json`. This covers most real API calls.

**Step 1: browser sends an automatic `OPTIONS` request**

```http
OPTIONS /api/tasks HTTP/1.1
Origin: https://app.yourdomain.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization, content-type
```

**Step 2: server answers with what is permitted**

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.yourdomain.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 600
```

**Step 3: if allowed, the browser sends the real request**

```http
POST /api/tasks HTTP/1.1
Origin: https://app.yourdomain.com
Authorization: Bearer <token>
Content-Type: application/json
```

```http
HTTP/1.1 201 Created
Access-Control-Allow-Origin: https://app.yourdomain.com
```

**Notes**

- The real response **also** needs `Access-Control-Allow-Origin`.
- `Access-Control-Max-Age` lets the browser skip the preflight for that period (saves a round trip per call).

---

## 5. Client side

Almost nothing to configure. The browser does the CORS work.

```javascript
// Triggers a preflight (Authorization header + JSON body)
const res = await fetch('https://api.yourdomain.com/api/tasks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ title: 'Write notes' })
});
const data = await res.json();
```

```javascript
// Send cookies cross-origin (needs AllowCredentials on the server)
fetch('https://api.yourdomain.com/api/tasks/me', {
  credentials: 'include'          // axios equivalent: withCredentials: true
});
```


---

## 6. Server side (ASP.NET Core)

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("WebApp", policy => policy
        .WithOrigins("https://app.yourdomain.com", "http://localhost:3000")
        .WithMethods("GET", "POST", "PUT", "DELETE")
        .WithHeaders("Authorization", "Content-Type")
        .WithExposedHeaders("ETag")                      // lets JS read the ETag header
        .AllowCredentials()                               // only if using cookies (see section 7)
        .SetPreflightMaxAge(TimeSpan.FromMinutes(10)));   // Access-Control-Max-Age
});

var app = builder.Build();

app.UseRouting();
app.UseCors("WebApp");        // after UseRouting, BEFORE UseAuthentication / UseAuthorization
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

Per-endpoint instead of global:

```csharp
[EnableCors("WebApp")]        // on a controller or action
[DisableCors]                 // opt an action out
app.MapGet("/ping", () => "ok").RequireCors("WebApp");   // minimal API
```

---

## 7. `AllowCredentials` explained

### Browser side: `credentials: 'include'` (fetch) / `withCredentials: true` (Axios)

By default, a **cross-origin** request from JavaScript does not send cookies and ignores any `Set-Cookie` in the response. Credentials (cookies, HTTP auth, client certificates) must be opted into. Without it:

- The auth cookie is not sent, so the API sees an anonymous user and returns 401.
- Cookies the API sets are discarded, so login never "sticks".

For same-origin requests, `fetch` already sends cookies (the default is `same-origin`), so it's only strictly needed when the SPA and API are on different origins. Many people add it anyway so it keeps working if the setup changes.

### Server side: `AllowCredentials()` in CORS

Once the browser sends credentials cross-origin, the server must explicitly agree, or the browser blocks the response. `AllowCredentials()` makes the server send `Access-Control-Allow-Credentials: true`.

```csharp
builder.Services.AddCors(o => o.AddPolicy("spa", p => p
    .WithOrigins("https://app.example.com")   // must be explicit
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

app.UseCors("spa");
```

**Why it's a deliberate opt-in:** credentialed requests act as the logged-in user, so letting any site make them would be dangerous. The CORS spec therefore enforces extra rules:

- You **cannot** combine `AllowCredentials()` with `AllowAnyOrigin()` (the wildcard `*`). ASP.NET Core throws an error, and browsers reject it too.
- You must list exact origins with `WithOrigins(...)`.
- `AllowAnyHeader()`/`AllowAnyMethod()` are fine, but the browser still expects explicit matching for credentialed requests.

### What `AllowCredentials()` does

It makes ASP.NET Core add this header to responses:

```http
Access-Control-Allow-Credentials: true
```

That tells the browser: "this server accepts credentialed requests from the allowed origin, and JS may read the response".

### Both sides must opt in

| Side | What to do |
|---|---|
| Client | `fetch(url, { credentials: 'include' })` or axios `withCredentials: true` |
| Server | `.AllowCredentials()` plus a **specific** origin |

What happens if they don't match:

| Client | Server | Result |
|---|---|---|
| `include` | No `Allow-Credentials: true` | Browser **blocks the response** (CORS error). The cookie was still sent. |
| not `include` | `Allow-Credentials: true` | Works, but cookies are not sent. |
| `include` | `true` + exact origin | Works. Cookies are sent and the response is readable. |

### The wildcard rule

When credentials are involved, the browser **rejects wildcards**:
- `Access-Control-Allow-Origin: *` is not allowed. It must be the exact origin.
- `Access-Control-Allow-Headers: *`, `Allow-Methods: *` and `Expose-Headers: *` are also not honored as wildcards.

ASP.NET Core enforces this early. This throws an `InvalidOperationException` when the policy is built:

```csharp
// WRONG: throws
policy.AllowAnyOrigin().AllowCredentials();
```

Correct:

```csharp
policy.WithOrigins("https://app.yourdomain.com").AllowCredentials();
```

### Do NOT "work around" the wildcard rule

```csharp
// DANGEROUS: reflects ANY origin back, with credentials
policy.SetIsOriginAllowed(_ => true).AllowCredentials();
```

This lets **any website** make credentialed requests as the logged-in user and read the responses. Only list origins you trust. If the origin set is dynamic (e.g. tenant subdomains), validate against a real allow-list:

```csharp
policy.SetIsOriginAllowed(origin =>
        new Uri(origin).Host.EndsWith(".yourdomain.com", StringComparison.OrdinalIgnoreCase))
      .AllowCredentials();
```

### Do you even need it?

| Auth style | Need `AllowCredentials`? |
|---|---|
| `Authorization` header set in JavaScript | **No.** A manually set header is not a credential in the CORS sense. It only needs to be listed in `WithHeaders("Authorization")`. |
| Cookie-based auth (session or auth cookie) | **Yes.** Plus `credentials: 'include'` on the client. |

If you use JWTs in the `Authorization` header, **leave `AllowCredentials()` off**. Less surface area, and you can use broader origin rules safely for public APIs.

### Cookie requirements for cross-origin use

- **Same site, different origin** (`app.yourdomain.com` to `api.yourdomain.com`): cookies work with `SameSite=Lax`. They are cross-origin but same-site.
- **Truly cross-site** (`myapp.com` to `api.other.com`): the cookie needs `SameSite=None; Secure` (HTTPS only). Browsers increasingly block third-party cookies, so this can fail regardless of CORS settings.

```csharp
options.Cookie.SameSite = SameSiteMode.None;
options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
```

### Cross-site, SameSite and Secure

A request is **cross-site** when the page the user is on and the server receiving the request have different registrable domains, no matter who owns them. `SameSite` and `Secure` are attributes on the `Set-Cookie` header, not separate headers:

```http
Set-Cookie: access_token=eyJ...; HttpOnly; Secure; SameSite=Lax; Path=/
```

#### Site vs origin

| Term | Meaning | Example |
|---|---|---|
| Origin | Scheme + host + port | `https://app.example.com` and `https://api.example.com` are different origins |
| Site | Scheme + registrable domain (eTLD+1) | Those two URLs are the same site (`example.com`) |

`SameSite` compares sites. CORS compares origins. They are separate browser checks.

#### What the cookie attributes do

| Attribute | Effect |
|---|---|
| `SameSite=Strict` | Cookie is never sent on cross-site requests |
| `SameSite=Lax` | Cookie is sent cross-site only on top-level navigations with safe methods, such as clicking a link or a GET |
| `SameSite=None` | Cookie is always sent, but the browser requires `Secure` with it |
| `Secure` | Cookie is sent only over HTTPS (`localhost` is exempt in development) |

`SameSite=Lax` is the browser default.

#### Lax in plain words

Think of the cookie as an ID card. With `Lax`, the browser shows it on a cross-site request only if the user visibly navigated there (clicked a link) and the method only views data (GET). A secret background request from another site does not carry it.

This keeps a user logged in when they follow a link to a site they use, while blocking many CSRF attacks.

| User is on | Request goes to | Cookie sent with Lax? |
|---|---|---|
| `myapi.com` | `myapi.com` | Yes (same-site) |
| `app.myapi.com` | `api.myapi.com` | Yes (same-site) |
| `evil.com`, JS `fetch` or form POST | `myapi.com` | No |
| `evil.com`, user clicks a link | `myapi.com` | Yes (top-level navigation + GET) |
| `myfrontend.com` (your own React app) | `myapi.com` | No (cross-site) |

The last row surprises people: your own frontend and API on different registrable domains are still cross-site, even if you own both domains. With `Lax`, `fetch` calls lose the login cookie and the API can return `401`.

#### Flow 1: the CSRF attack that SameSite blocks

The user is logged in to `bank.com`, then visits `evil.com`, which automatically submits a hidden form:

```html
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="attacker">
  <input name="amount" value="5000">
</form>
<script>document.forms[0].submit()</script>
```

- With no `SameSite` attribute or with `SameSite=None`, the browser attaches the bank cookie and the transfer succeeds as the user.
- With `Lax` or `Strict`, this cross-site POST goes out without the cookie and fails.
- A GET link to `bank.com/dashboard` would carry a `Lax` cookie, so state-changing actions must never use GET.

#### Flow 2: a legitimate cross-site call

An SPA at `https://myapp.com` calls an API at `https://api.otherdomain.com`.

1. The user logs in with `POST https://api.otherdomain.com/login` using `credentials: "include"`.
2. The API responds with a cookie such as `Set-Cookie: access_token=eyJ...; HttpOnly; Secure; SameSite=None; Path=/`, plus `Access-Control-Allow-Origin: https://myapp.com` and `Access-Control-Allow-Credentials: true`.
3. Later calls use `fetch("https://api.otherdomain.com/orders", { credentials: "include" })`, and the cookie travels because of `SameSite=None; Secure`.
4. The server needs CORS set to `.WithOrigins("https://myapp.com").AllowCredentials()`.

All three pieces are required:

- Cookie attributes allow and secure cross-site cookie use.
- CORS allows credentials and a specific origin.
- The client sends `credentials: "include"`.

#### Two ways to fix a cross-site setup

| Setup | Preferred configuration |
|---|---|
| Same site | Put frontend and API under one domain, such as `app.mysite.com` and `api.mysite.com`, and use `Lax`. Set the cookie `Domain=mysite.com` if it must be shared across subdomains |
| Different registrable domains | Use `SameSite=None; Secure` plus CORS with credentials, and add antiforgery tokens because `None` re-opens CSRF exposure |

Browsers increasingly block third-party cookies, so a `SameSite=None` setup can break in Safari, Firefox or privacy modes even when it is configured correctly. For authentication shared across unrelated domains, the same-site architecture is usually simpler and safer.

### Security notes

- Credentialed cross-origin access means the user's browser acts with their login. Allow **only** origins you fully trust.
- CORS does not stop CSRF for simple requests (the request is still sent with cookies). Use anti-forgery tokens or `SameSite` cookies for cookie-based APIs.

### Related navigation

- [CSRF protection for cookie-based SPAs](<CSRF Protection for Cookie-Based SPA in ASP.NET Core.md>)
- [Cross-site flow and cookie attributes](#cross-site-samesite-and-secure)
- [CORS credential configuration](#allowcredentials-explained)
- [Middleware and server setup](#6-server-side-aspnet-core)

---

## 8. Where you need CORS (and where you don't)

**Needed**

- A browser SPA (React / Angular / Vue) on one origin calling an API on another.
- Local development: React on `localhost:3000` calling your API on `localhost:5001`.

**Not needed**

- Same origin: the API serves the frontend, or a reverse proxy puts both under one host.
- A dev-server proxy (e.g. Vite/webpack proxy) locally.
- Mobile apps, server-to-server calls, curl, Postman.

**`*` vs a specific origin**

- `Access-Control-Allow-Origin: *` is fine for public, non-credentialed data.
- With credentials, `*` is not allowed. Name the exact origin.

---

## 9. Testing

### DevTools

Network tab: look for the `OPTIONS` preflight (type "preflight"), then the real request. Check the response headers on both. A blocked request shows a red CORS message in the Console.

### curl (simulate what the browser sends)

```bash
# Preflight
curl -i -X OPTIONS https://localhost:5001/api/tasks \
  -H "Origin: https://app.yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"

# Real request
curl -i https://localhost:5001/api/tasks/categories \
  -H "Origin: https://app.yourdomain.com"
```

Check that the response contains `Access-Control-Allow-Origin` with the exact origin. curl itself never enforces CORS; it just lets you inspect the headers.

---

## 10. Common gotchas

- **Origin must match exactly**: no trailing slash, no path. `https://app.yourdomain.com/` will not match.
- **Middleware order**: if `UseAuthorization` runs before `UseCors`, the preflight `OPTIONS` can receive `401` and the browser reports a CORS failure.
- **Errors look like CORS errors**: a `500` thrown before the CORS middleware adds headers shows up in the browser as a CORS problem. Check server logs and the Network tab.
- **`Vary: Origin`**: needed when the response depends on the caller's origin so caches don't serve one origin's CORS headers to another. ASP.NET Core adds it for origin-specific policies.
- **Reading `ETag` cross-origin**: JS can't read it unless it's in `Access-Control-Expose-Headers` (`WithExposedHeaders("ETag")`). The browser's own HTTP cache still uses ETags fine.
- **Preflight caching**: `Access-Control-Max-Age` is capped by browsers (Chrome caps it at 2 hours), so very large values are ignored.
- **CORS is not API security.** Anyone can call the API with curl. Real protection is authentication and authorization.

---

## 11. Quick cheat sheet

| Situation | Server config |
|---|---|
| Public read-only API, no cookies | `AllowAnyOrigin()` is fine |
| SPA + JWT in `Authorization` header | `WithOrigins(...)`, `WithHeaders("Authorization","Content-Type")`, no `AllowCredentials` |
| SPA + cookie auth | `WithOrigins(exact)`, `AllowCredentials()`, client `credentials: 'include'`, correct `SameSite` |
| JS needs to read `ETag` or custom headers | `WithExposedHeaders("ETag", ...)` |
| Reduce preflight traffic | `SetPreflightMaxAge(...)` |
| Dynamic subdomains | `SetIsOriginAllowed(...)` with a strict check, never `_ => true` |
