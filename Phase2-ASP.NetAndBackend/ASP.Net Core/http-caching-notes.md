# HTTP Caching Notes (Cache-Control, ETag, Revalidation)

## 1. Core idea

Caching lets a stored response be reused instead of regenerated.
`Cache-Control` is how the **server** declares the policy, and how the **client** can request specific behavior.

---

## 2. Cache-Control directives

| Directive | Meaning |
|---|---|
| `max-age=N` | Response is **fresh** for N seconds. No request reaches the server during this window. |
| `public` | Any cache may store it (browser, CDN, proxy). |
| `private` | Only the end user's own cache (browser). CDNs/proxies must not store it. |
| `no-cache` | May be stored, but must be **revalidated before every reuse**. |
| `no-store` | Never write to any cache. Use for sensitive data. |
| `must-revalidate` | Once stale, don't serve it without checking the origin. |
| `stale-while-revalidate=N` | Serve stale immediately, refresh in the background for N seconds. |

```http
Cache-Control: no-store                  # never cache (sensitive data)
Cache-Control: no-cache                  # cache, but revalidate every time
Cache-Control: private, max-age=3600     # per-user cache for 1 hour
Cache-Control: public, max-age=86400     # shared cache for 1 day
```

**Use cases**
- `GET /api/tasks/categories` (rarely changes, same for everyone): `public, max-age=3600`
- `GET /api/tasks/me` (per-user, sensitive): `private, no-store`

---

## 3. Validators (make `304` possible)

- **`ETag`**: a fingerprint of the response (e.g. a hash of the body). Client echoes it back in `If-None-Match`.
- **`Last-Modified`**: timestamp. Client echoes it back in `If-Modified-Since`.

ETag is more precise; Last-Modified only has 1-second resolution.

---

## 4. Full flow: fresh, expired, revalidate

Assume the server sends `Cache-Control: public, max-age=60` and an `ETag`.

### Step 1: First request (t = 0s), cache miss

```http
GET /api/tasks/categories HTTP/1.1
```

```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=60
ETag: "abc123"
Content-Type: application/json

[{"id":1,"name":"Work"},{"id":2,"name":"Personal"}]
```

Browser stores body + `ETag` + freshness lifetime (60s).

### Step 2: Request at t = 30s, still fresh

Browser serves from its local cache. **No network request is made at all.**
(DevTools shows `200 (from disk cache)` or `(from memory cache)`.)

### Step 3: Request at t = 75s, stale, so revalidate

The entry is stale but **not discarded**. Browser sends a conditional request:

```http
GET /api/tasks/categories HTTP/1.1
If-None-Match: "abc123"
```

**Case A: data unchanged**

```http
HTTP/1.1 304 Not Modified
Cache-Control: public, max-age=60
ETag: "abc123"
```

No body. Browser reuses its stored copy and **resets the freshness timer** (fresh again until t = 135s).

**Case B: data changed**

```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=60
ETag: "def456"
Content-Type: application/json

[{"id":1,"name":"Work"},{"id":2,"name":"Personal"},{"id":3,"name":"Study"}]
```

Full body sent, cache entry replaced, new ETag stored.

### Timeline summary

```
t=0s    GET           -> 200 + ETag "abc123"        (stored, fresh for 60s)
t=30s   GET           -> served from cache          (no network)
t=75s   GET + If-None-Match "abc123"
                      -> 304 Not Modified           (reuse cache, timer reset)
t=140s  GET + If-None-Match "abc123"
                      -> 200 + ETag "def456"        (data changed, cache replaced)
```

---

## 5. Client-side request directives

Clients can send `Cache-Control` on requests too:

- `Cache-Control: no-cache`: force revalidation (browsers send this on hard refresh, Ctrl+Shift+R).
- `Cache-Control: max-age=0`: don't use a stale entry without checking.
- `Cache-Control: no-store`: don't store this response.

---

## 6. ETag support in ASP.NET Core

### Controller example

```csharp
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

[ApiController]
[Route("api/tasks")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _service;

    public CategoriesController(ICategoryService service) => _service = service;

    [HttpGet("categories")]
    public IActionResult GetCategories()
    {
        var categories = _service.GetCategories();
        var etag = ComputeETag(categories);

        // Always set validators + freshness policy (needed on 304 too)
        var responseHeaders = Response.GetTypedHeaders();
        responseHeaders.ETag = etag;
        responseHeaders.CacheControl = new CacheControlHeaderValue
        {
            Public = true,
            MaxAge = TimeSpan.FromSeconds(60)
        };

        // Does the client's cached copy match the current version?
        var ifNoneMatch = Request.GetTypedHeaders().IfNoneMatch;
        if (ifNoneMatch.Any(e => e.Equals(EntityTagHeaderValue.Any)
                              || e.Compare(etag, useStrongComparison: false)))
        {
            return StatusCode(StatusCodes.Status304NotModified); // no body
        }

        return Ok(categories); // 200 with full body
    }

    private static EntityTagHeaderValue ComputeETag<T>(T data)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(data);
        var hash = SHA256.HashData(bytes);
        return new EntityTagHeaderValue($"\"{Convert.ToHexString(hash)[..16]}\"");
    }
}
```

Notes:
- Don't combine `[ResponseCache]` with manually set `Cache-Control` on the same action. Both write the same header, which is redundant and confusing. Pick one per endpoint (see section 8).
- A `304` must still carry `ETag` and `Cache-Control` so the client can refresh its freshness timer.
- This saves **bandwidth**, not server work. The data is still fetched and hashed. To save DB work too, derive the ETag from something cheap (e.g. a row version or `UpdatedAt` max) *before* querying.

### Reusable approach: ETag middleware / filter

For many endpoints, wrap the hashing in an action filter so controllers stay clean:

```csharp
public class ETagFilter : IAsyncResultFilter
{
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        if (context.Result is ObjectResult { Value: not null } result
            && context.HttpContext.Request.Method == HttpMethods.Get)
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(result.Value);
            var etag = new EntityTagHeaderValue($"\"{Convert.ToHexString(SHA256.HashData(bytes))[..16]}\"");

            context.HttpContext.Response.GetTypedHeaders().ETag = etag;

            var inm = context.HttpContext.Request.GetTypedHeaders().IfNoneMatch;
            if (inm.Any(e => e.Compare(etag, useStrongComparison: false)))
            {
                context.Result = new StatusCodeResult(StatusCodes.Status304NotModified);
            }
        }
        await next();
    }
}

// Usage: [ServiceFilter(typeof(ETagFilter))] on an action, or register globally
// builder.Services.AddScoped<ETagFilter>();
```

---

## 7. What is `EntityTagHeaderValue`?

A .NET class (namespace `Microsoft.Net.Http.Headers`) that represents **one ETag value**. On the wire an ETag looks like `"abc123"`, or `W/"abc123"` for a weak one. This class is the parsed form.

```csharp
var etag = new EntityTagHeaderValue("\"abc123\"");   // quotes are part of the value
etag.Tag      // "\"abc123\""
etag.IsWeak   // false

var weak = new EntityTagHeaderValue("\"abc123\"", isWeak: true);   // W/"abc123"
```

Key points:
- **Strong vs weak**: strong means byte-for-byte identical. Weak (`W/`) means "semantically the same", which is fine for most JSON APIs.
- **`EntityTagHeaderValue.Any`** represents `*`, which matches any version (`If-None-Match: *`).
- **`Compare(other, useStrongComparison)`** applies the weak/strong matching rules for you, so you never compare ETag strings by hand.
- **Why use it**: `Request.GetTypedHeaders().IfNoneMatch` returns a parsed list of these, so you don't manually split a raw header like `"a", "b", W/"c"`.

---

## 8. `[ResponseCache]` vs `CacheControlHeaderValue`

Both only set the **`Cache-Control` response header**. Neither stores anything on the server.

| | `[ResponseCache(...)]` | `Response.GetTypedHeaders().CacheControl = ...` |
|---|---|---|
| Style | Declarative attribute | Imperative code in the action |
| Values | Fixed at compile time | Can be computed at runtime (per request, user, data) |
| Coverage | Common cases only | Any directive: `stale-while-revalidate`, `immutable`, `must-revalidate`, `s-maxage`, etc. |
| Reuse | `CacheProfiles` share settings | Write a helper or filter |

How the attribute maps to headers:

```csharp
[ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Any)]
// -> Cache-Control: public, max-age=3600

[ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Client)]
// -> Cache-Control: private, max-age=3600

[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
// -> Cache-Control: no-store, no-cache   (+ Pragma: no-cache)
```

The manual equivalent:

```csharp
responseHeaders.CacheControl = new CacheControlHeaderValue
{
    Public = true,
    MaxAge = TimeSpan.FromSeconds(60)
};
// -> Cache-Control: public, max-age=60
```

`3600` vs `60` is only a different number. The mechanism is identical.

**When to use which**
- **Attribute**: simple, static policy ("public for an hour").
- **Manual headers**: directives the attribute doesn't expose, or policy that depends on runtime data. In the ETag example, `Cache-Control` and `ETag` are set together because a `304` needs both.

**Important**: `[ResponseCache]` does **not** generate ETags or handle `304`. That is always your code (or a library). Server-side storage is a separate feature (`UseResponseCaching` middleware or `IMemoryCache`/`IDistributedCache`).

---

## 9. Does the browser handle this itself?

Yes. The browser's built-in HTTP cache does all of it automatically. Page code (`fetch`, `axios`, `<img>`, etc.) needs no caching logic.

### What the browser does by itself

1. **Stores the response** with `Cache-Control`, `ETag`, `Last-Modified` and `Vary`.
2. **On the next request for that URL**, it checks freshness:
   - **Still fresh** (within `max-age`): serves from cache, no network request.
   - **Stale**: automatically adds `If-None-Match: "<stored etag>"` (and `If-Modified-Since` if `Last-Modified` exists) and sends a conditional request.
3. **On `304`**: reuses the stored body and resets the freshness timer.
4. **On `200`**: replaces the cache entry.

### What the page's code sees

A `304` is invisible to JS. If code calls `fetch('/api/tasks/categories')`, the browser merges the cached body in and `fetch` resolves with a normal `200` and full data. The `304` only shows in DevTools' Network tab.

### What the browser does NOT do

- **No background polling.** Revalidation only happens when something requests that URL again. (Exception: `stale-while-revalidate` refreshes in the background right after a stale entry is served.)
- **No push.** If server data changes while the entry is still fresh, the user keeps seeing old data until `max-age` expires.

### Things that change the behavior

- **Hard refresh** (Ctrl+Shift+R) or DevTools "Disable cache": bypasses the cache, forces a full request.
- **Normal reload** (F5): usually revalidates even fresh entries.
- **`fetch` cache option**: `fetch(url, { cache: 'no-store' | 'no-cache' | 'reload' | 'force-cache' })` overrides the default per request.
- **No `Cache-Control` but a `Last-Modified` present**: browsers apply *heuristic* freshness (often ~10% of the time since last modification). Always send explicit headers to avoid surprises.
- **`Vary`** is honored. With `Vary: Authorization`, the browser keeps separate entries per header value.

### Non-browser clients differ

`HttpClient` (.NET), curl, Postman and server-to-server calls **do not cache by default** and ignore these headers unless a caching layer is added (custom `DelegatingHandler`, or a library like CacheCow). That is why the curl test in section 10 needs a manual `If-None-Match` header, while a browser sends it on its own.

### See it live

Open DevTools, go to the Network tab, and hit the endpoint repeatedly. Expect `200`, then `(from disk cache)`, then `304` once the entry goes stale.

---

## 10. Testing the flow with curl

```bash
# 1) First request: note the ETag in the response
curl -i https://localhost:5001/api/tasks/categories

# 2) Conditional request with that ETag: expect 304
curl -i https://localhost:5001/api/tasks/categories \
  -H 'If-None-Match: "A1B2C3D4E5F60718"'
```

In browser DevTools (Network tab), watch the **Status** and **Size** columns:
- `200 (from disk cache)`: still fresh, no request sent
- `304`: revalidated, body reused
- `200` with a size: full response

---

## 11. Vary and safety

- **`Vary: Authorization`** or **`Vary: Accept-Encoding`**: tells caches the response differs by that request header, so entries are keyed accordingly.
- **Danger**: a per-user response marked `public` (or with no headers, where a proxy may cache heuristically) can leak one user's data to another. Use `private` or `no-store` for anything user-specific.

---

## 12. Quick cheat sheet

| Goal | Header |
|---|---|
| Static, never changes (hashed assets) | `public, max-age=31536000, immutable` |
| Shared data, changes occasionally | `public, max-age=3600` + `ETag` |
| Per-user data, OK in browser | `private, max-age=300` |
| Always check freshness with server | `no-cache` + `ETag` |
| Sensitive (tokens, PII, banking) | `no-store` |

---

## 13. `IAsyncActionFilter` vs `IAsyncResultFilter`

Both are MVC/controller filters. They wrap **different stages** of the pipeline.

### Pipeline order

```
Authorization filters
  -> Resource filters
     -> Model binding
        -> Action filters      (IAsyncActionFilter wraps the action METHOD)
           -> [ your action method runs ]
        -> Result filters      (IAsyncResultFilter wraps the RESULT execution)
           -> [ IActionResult executes: serialization, body written to response ]
```

### Comparison

| | `IAsyncActionFilter` | `IAsyncResultFilter` |
|---|---|---|
| Method | `OnActionExecutionAsync(ActionExecutingContext, ActionExecutionDelegate next)` | `OnResultExecutionAsync(ResultExecutingContext, ResultExecutionDelegate next)` |
| Wraps | Your action method | Execution of the `IActionResult` (e.g. `OkObjectResult` writing JSON) |
| Before `next()` | Can read/modify `context.ActionArguments`; can short-circuit by setting `context.Result` | Can read/replace `context.Result`; can set response headers (body not started); can cancel via `context.Cancel` |
| After `next()` | `ActionExecutedContext`: sees `Result` and `Exception` from the action | `ResultExecutedContext`: result already written, **headers can no longer be changed** |
| Runs when | Around every action that reaches the action stage | Only when a result is actually produced (not if authorization/resource filters or an unhandled exception short-circuit) |
| Typical uses | Validate or transform arguments, logging, timing, audit, custom model checks | Add/modify response headers, wrap or reshape results, ETag, response envelope |

### Skeletons

```csharp
public class TimingActionFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        // BEFORE the action: arguments are bound, action not yet run
        var sw = Stopwatch.StartNew();

        var executed = await next();   // runs the action (and later action filters)

        // AFTER the action: result object exists but has NOT been written yet
        sw.Stop();
        // executed.Result, executed.Exception available here
    }
}

public class HeaderResultFilter : IAsyncResultFilter
{
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        // BEFORE the result executes: response has not started, headers are still writable
        context.HttpContext.Response.Headers["X-Custom"] = "value";

        await next();                  // result is executed (body written)

        // AFTER: response has started, too late to change headers or status
    }
}
```

### Which one for the ETag filter?

The ETag filter in section 6 uses **`IAsyncResultFilter`** because:
- It needs the final `ObjectResult.Value` to hash.
- It must set `ETag` and possibly swap the result for a `304` **before** the body is written, which is exactly the window before `next()` in a result filter.

An action filter could also do it after `next()` by reading `ActionExecutedContext.Result`, but the result filter is the more natural fit for "change what goes out in the response".

### Gotchas

- **Short-circuiting**: setting `context.Result` in an action filter skips the action method, but result filters still run around that result. If an authorization/resource filter short-circuits, normal result filters are skipped. Implement `IAlwaysRunResultFilter` (or `IAsyncAlwaysRunResultFilter`) if the filter must run in those cases too.
- **Sync vs async**: implement either `IActionFilter` (`OnActionExecuting`/`OnActionExecuted`) or `IAsyncActionFilter`, never both on the same class. The same applies to result filters.
- **Registration**: `[ServiceFilter(typeof(X))]` or `[TypeFilter]` on an action/controller, or globally via `options.Filters.Add<X>()`. Filters that need DI must be registered in the service container for `ServiceFilter`.
- **Minimal APIs** don't use these. Use `IEndpointFilter` (`.AddEndpointFilter(...)`) instead.
