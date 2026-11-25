# CSRF Protection for Cookie-Based SPA in ASP.NET Core

Nov 24, 2026 · @Aman Kumar

### Navigation

- [CORS and cookie behavior](<cors-notes.md#cross-site-samesite-and-secure>)
- [The problem](#the-problem)
- [The two defenses and the two tokens](#the-two-defenses-and-the-two-tokens)
- [Server setup](#server-setup-aspnet-core)
- [SPA side](#spa-side-reading-and-attaching-the-token)
- [The `__Host-` cookie prefix](#the-host--cookie-prefix)
- [Troubleshooting and gotchas](#troubleshooting-and-gotchas)

## The problem

When a SPA authenticates with cookies, the browser attaches the cookie to every request sent to your domain, including requests triggered by another site. CSRF (Cross-Site Request Forgery) abuses this: a malicious page silently submits a request to your API, the auth cookie goes along, and the server runs the action as the logged-in user.

- Applies only to cookie-based auth. A JWT kept in memory and sent in the `Authorization` header is not attached automatically, so CSRF does not apply.
- Mostly matters for state-changing requests (POST, PUT, PATCH, DELETE). GET should never change data.

## The two defenses, and the two tokens

Use both layers: SameSite cookies stop most attacks, antiforgery tokens cover what is left.

1. **`SameSite=Lax` or `Strict` on the auth cookie.** The browser will not send the cookie on cross-site requests. `Strict` blocks it almost entirely. `Lax` allows it only on safe top-level navigations such as clicking a link, so cross-site POST/PUT/DELETE carry no cookie.
2. **Antiforgery tokens.** The server issues a random token. The SPA reads it and sends it back in a custom header (`X-XSRF-TOKEN`) on every state-changing request. A foreign site cannot read your token (same-origin policy) and cannot add custom headers to a cross-site form post, so its forged request fails validation.

ASP.NET Core's antiforgery uses two tokens that are validated as a pair:

| Token | Where it lives | Who reads it | Purpose |
| --- | --- | --- | --- |
| Cookie token | `__Host-antiforgery` cookie, HttpOnly | Browser sends it automatically | Proves this browser got a token from your server |
| Request token | `XSRF-TOKEN` cookie, not HttpOnly, copied by JS into the `X-XSRF-TOKEN` header | Your SPA's JavaScript | Proves the request came from your own page, not a foreign site |

An attacker's page can make the browser send the cookie token, but cannot read the request token, so the pair never matches.

## Server setup (ASP.NET Core)

Three pieces: configure antiforgery and the auth cookie, validate automatically on unsafe methods, and expose an endpoint that hands the SPA a request token.

**Program.cs**

```
        HttpOnly = false,   // JS must be able to read this
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = "/"
    });

```

```
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

// 1. Antiforgery: read the request token from this header
builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = "X-XSRF-TOKEN";
    o.Cookie.Name = "__Host-antiforgery";
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
});

// 2. Auth cookie with SameSite protection
builder.Services.AddAuthentication("Cookies")
    .AddCookie("Cookies", o =>
    {
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Lax;
        o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    });

// 3. Validate antiforgery on POST/PUT/PATCH/DELETE automatically
builder.Services.AddControllers(o =>
{
    o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

// 4. Endpoint the SPA calls to get a token
app.MapGet("/api/antiforgery/token", (HttpContext context, IAntiforgery antiforgery) =>
{
    var tokens = antiforgery.GetAndStoreTokens(context);

    // Readable (non-HttpOnly) cookie carrying the REQUEST token
    context.Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!, new CookieOptions
    {

    return Results.NoContent();
}).AllowAnonymous();

app.MapControllers();
app.Run();
```

**Protected controller**

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TasksController : ControllerBase
{
    [HttpGet]                  // not validated
    public IActionResult GetAll() => Ok();

    [HttpPost]                 // header token validated
    public IActionResult Create(TaskDto dto) => Ok();

    [HttpDelete("{id}")]       // header token validated
    public IActionResult Delete(int id) => NoContent();
}
```

`AutoValidateAntiforgeryToken` skips GET, HEAD, OPTIONS and TRACE and validates everything else. Use `[ValidateAntiForgeryToken]` instead to protect only specific actions.

## SPA side: reading and attaching the token

The flow: call the token endpoint once at startup and again after login (the token is tied to the user identity), read the `XSRF-TOKEN` cookie, and copy its value into the `X-XSRF-TOKEN` header on every POST/PUT/PATCH/DELETE.

**Plain fetch wrapper**

```javascript
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function initCsrf() {
  await fetch('/api/antiforgery/token', { credentials: 'include' });
}

export async function api(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  // Attach the token only on state-changing requests
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['X-XSRF-TOKEN'] = getCookie('XSRF-TOKEN');
  }

  return fetch(url, { ...options, headers, credentials: 'include' });
}

// Usage
await initCsrf();
await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title: 'Test' }) });
```

**Axios (React or Vue)**

```javascript
import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

await http.get('/antiforgery/token');        // once at startup and after login
await http.post('/tasks', { title: 'Test' }); // header attached automatically
```

**Angular**

`HttpClient` already reads the `XSRF-TOKEN` cookie and sends `X-XSRF-TOKEN` on mutating requests. Only the startup call to the token endpoint is needed.

**Same-origin requirement.** `document.cookie` can read `XSRF-TOKEN` only when the SPA and API share a site. If they are on different origins (for example `localhost:4200` calling `localhost:5000`), use a dev proxy, or return the token in the JSON body of the token endpoint and keep it in memory.

## The `__Host-` cookie prefix

`__Host-antiforgery` is only the name of the antiforgery cookie. The `__Host-` prefix is optional hardening, not a requirement: CSRF protection works with the default cookie name.

**What the browser enforces.** A cookie whose name starts with `__Host-` is accepted only if it has the `Secure` attribute (HTTPS only), `Path=/`, and no `Domain` attribute. If any rule is broken, the browser silently rejects the cookie.

**Why it helps.** Browsers do not check who set a cookie, only that it matches the domain. Without the prefix, two attacks can plant a cookie token of the attacker's choosing:

- **Cookie tossing from a subdomain.** A compromised or abandoned subdomain (for example `blog.yourapp.com`) sets a cookie with `Domain=yourapp.com`, and the browser sends it to the main app.
- **Overwrite over plain HTTP.** A network attacker on public Wi-Fi injects a cookie over an HTTP request and overwrites yours.

If the attacker controls the cookie token, they can also generate a matching request token, so the pair validates and the CSRF check is bypassed. The prefix blocks both attacks because only the exact host, over HTTPS, can set the cookie.

| Situation | Use `__Host-`? |
| --- | --- |
| Single domain, HTTPS only, no untrusted subdomains | Optional. `SameSite=Strict` already covers most of it |
| Many subdomains, user-generated subdomains, shared parent domain | Recommended |
| High-security app (banking, admin panels) | Good defense in depth |

**Local development.** The cookie is rejected over plain HTTP, so POST requests fail with 400 on `http://localhost`. Use HTTPS (`dotnet dev-certs https --trust`) or apply the name only outside Development:

```csharp
if (!builder.Environment.IsDevelopment())
    o.Cookie.Name = "__Host-antiforgery";
```

## Troubleshooting and gotchas

A 400 response on a POST/PUT/DELETE almost always means the antiforgery check failed.

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| 400 on every POST | Header missing or wrong name | Send `X-XSRF-TOKEN`, matching `HeaderName` in `AddAntiforgery` |
| 400 only after login or logout | Token tied to the old identity | Call the token endpoint again after sign-in |
| 400, cookie never arrives | Missing `credentials: 'include'` or `withCredentials: true` | Add it to every request |
| 400 only on localhost | `__Host-` or `Secure` cookie over plain HTTP | Use HTTPS, or skip the prefix in Development |
| SPA cannot read `XSRF-TOKEN` | SPA and API on different origins | Use a dev proxy, or return the token in the response body |

**When you do not need any of this.** If the SPA sends a JWT in the `Authorization` header (kept in memory, not in a cookie), the browser never attaches credentials automatically, so CSRF is not a concern.
