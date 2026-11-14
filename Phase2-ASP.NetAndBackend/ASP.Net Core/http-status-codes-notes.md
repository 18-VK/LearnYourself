# HTTP Status Codes: Detailed Notes with Examples
**Focus: REST APIs in ASP.NET Core**

---

## 1. The big picture

A status code is a 3-digit number in the response that tells the client **what happened** before it reads the body.

| Range | Meaning | Who "owns" the problem |
|---|---|---|
| 1xx | Informational | n/a (rarely seen in APIs) |
| 2xx | Success | nobody, it worked |
| 3xx | Redirection / caching | client must take another step |
| 4xx | Client error | the **caller** sent something wrong, so retrying the same request won't help |
| 5xx | Server error | the **server** failed, so retrying later may help |

Rule of thumb: **4xx = "fix your request", 5xx = "we broke, try again later".** Clients, gateways, retry libraries and monitoring all rely on this split, so picking the wrong range causes real damage (for example, returning 500 for a validation error pages your on-call for a client mistake).

---

## 2. Use a consistent error body: RFC 9457 Problem Details

Return the same error shape for every 4xx/5xx. ASP.NET Core has `ProblemDetails` built in.

```json
{
  "type": "https://example.com/probs/out-of-stock",
  "title": "Item out of stock",
  "status": 409,
  "detail": "Product 12 has 0 units available.",
  "instance": "/api/orders",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00"
}
```

Enable it once:

```csharp
builder.Services.AddProblemDetails();   // standard error bodies
app.UseExceptionHandler();              // turns unhandled exceptions into 500 ProblemDetails
app.UseStatusCodePages();               // gives bare 404/405 etc. a ProblemDetails body
```

---

## 3. 2xx: Success

### 200 OK
Request succeeded and the response has a body.
Use for: `GET`, and `PUT`/`PATCH` when you return the updated resource.

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<ProductDto>> Get(int id)
{
    var product = await _db.Products.FindAsync(id);
    return product is null ? NotFound() : Ok(product.ToDto());   // 200 or 404
}
```

### 201 Created
A `POST` created a new resource. **Always include a `Location` header** pointing at it, and usually return the created resource.

```csharp
[HttpPost]
public async Task<IActionResult> Create(CreateOrderRequest req)
{
    var order = await _service.CreateAsync(req);
    return CreatedAtAction(nameof(Get), new { id = order.Id }, order);
}
```
```http
HTTP/1.1 201 Created
Location: /api/orders/834
```

### 202 Accepted
Request was accepted but **processing isn't finished** (async/queued work). Return a URL the client can poll.
Example: generating a report, bulk import, refund processing.

```csharp
[HttpPost("reports")]
public IActionResult StartReport(ReportRequest req)
{
    var jobId = _queue.Enqueue(req);
    return Accepted($"/api/jobs/{jobId}", new { jobId });   // 202 + Location
}
```

### 204 No Content
Success with **no body**. Typical for `DELETE`, and for `PUT`/`PATCH` when you don't return the resource.

```csharp
[HttpDelete("{id:int}")]
public async Task<IActionResult> Delete(int id)
{
    var rows = await _db.Products.Where(p => p.Id == id).ExecuteDeleteAsync();
    return rows == 0 ? NotFound() : NoContent();
}
```

Note: don't send a body with 204; clients are told to ignore it.

---

## 4. 3xx: Redirection and caching

### 301 Moved Permanently / 302 Found
Mostly for web pages. 301 = permanent (browsers and search engines cache it), 302 = temporary.
Gotcha: older clients may change a `POST` into a `GET` when following 301/302.

### 307 Temporary Redirect / 308 Permanent Redirect
Same as 302/301 but **the HTTP method and body are preserved**. Prefer these for APIs.

```csharp
return RedirectPreserveMethod("/api/v2/orders");            // 307
return RedirectPermanentPreserveMethod("/api/v2/orders");   // 308
```

HTTPS redirection middleware (`app.UseHttpsRedirection()`) issues a 307 by default.

### 304 Not Modified (conditional GET / caching)
The client already has the latest copy, so the server sends **no body** and saves bandwidth.

Flow:
1. First request: server returns `200` with `ETag: "v7"`.
2. Next request: client sends `If-None-Match: "v7"`.
3. If unchanged, server returns `304` with no body.

```csharp
[HttpGet("{id:int}")]
public async Task<IActionResult> Get(int id)
{
    var product = await _db.Products.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id);
    if (product is null) return NotFound();

    var etag = $"\"{product.RowVersionHex}\"";                 // derive from a version/hash
    if (Request.Headers.IfNoneMatch.Contains(etag))
        return StatusCode(StatusCodes.Status304NotModified);

    Response.Headers.ETag = etag;
    return Ok(product.ToDto());
}
```

---

## 5. 4xx: Client errors

### 400 Bad Request
The request is **malformed or unreadable**: invalid JSON, wrong types, missing required header, bad query string.

```json
{ "type": "https://example.com/probs/invalid-request", "title": "Bad Request",
  "status": 400, "detail": "Invalid JSON: unexpected token at line 3." }
```

ASP.NET Core note: with `[ApiController]`, model-validation failures automatically return **400** with a `ValidationProblemDetails` body (not 422). See the 400 vs 422 section below to change that.

### 401 Unauthorized
**Not authenticated**: credentials missing, expired, or invalid. (The name is misleading; it really means "unauthenticated".)
Include a `WWW-Authenticate` header.

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", error_description="The token has expired"
```

```csharp
[Authorize]                       // JWT bearer middleware returns 401 automatically
[HttpGet("me")]
public IActionResult Me() => Ok(User.Identity!.Name);
```

### 403 Forbidden
**Authenticated, but not allowed.** The server knows who you are and refuses anyway. Re-authenticating won't help.

```csharp
[Authorize(Roles = "Admin")]      // logged in as a normal user → 403
[HttpDelete("users/{id}")]
public IActionResult DeleteUser(string id) => NoContent();
```

### 404 Not Found
The resource doesn't exist (or you're deliberately hiding that it exists).
Security tip: if a user requests **another user's** order, return **404** instead of 403 so you don't confirm the order ID exists.

```csharp
var order = await _db.Orders.SingleOrDefaultAsync(o => o.Id == id && o.UserId == currentUserId);
return order is null ? NotFound() : Ok(order);
```

### 405 Method Not Allowed
URL exists but not for that verb (for example `DELETE /api/orders` when only `GET`/`POST` exist). Include an `Allow: GET, POST` header. ASP.NET Core does this automatically.

### 409 Conflict
The request is valid but **conflicts with the current state** of the resource.
Examples: duplicate unique value, editing something already changed, in-flight duplicate with the same `Idempotency-Key`, insufficient stock.

```csharp
if (await _db.Users.AnyAsync(u => u.Email == req.Email))
    return Conflict(new ProblemDetails
    {
        Title = "Email already registered",
        Detail = $"A user with email {req.Email} already exists.",
        Status = StatusCodes.Status409Conflict
    });
```

### 412 Precondition Failed
An `If-Match` condition failed. Used for **optimistic concurrency**: "update only if nobody changed it since I read it".

```csharp
// Client sends: If-Match: "v7"
if (!Request.Headers.IfMatch.Contains($"\"{current.RowVersionHex}\""))
    return StatusCode(StatusCodes.Status412PreconditionFailed);
```
(`428 Precondition Required` is what you return when you *require* `If-Match` and the client didn't send it.)

### 415 Unsupported Media Type
Client sent a `Content-Type` the endpoint can't handle (for example `text/plain` to a JSON-only endpoint). ASP.NET Core returns this automatically.

### 422 Unprocessable Content (Unprocessable Entity)
The JSON is **well-formed and parseable**, but **fails business or semantic validation**.

```json
{ "status": 422, "title": "Validation failed",
  "errors": { "email": ["Invalid email format"], "quantity": ["Must be greater than 0"] } }
```

### 429 Too Many Requests
Rate limit exceeded. **Include `Retry-After`** (seconds or an HTTP date).

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddFixedWindowLimiter("api", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
    });
    o.OnRejected = (ctx, _) =>
    {
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        return ValueTask.CompletedTask;
    };
});

app.UseRateLimiter();
app.MapControllers().RequireRateLimiting("api");
```

---

## 6. 5xx: Server errors

### 500 Internal Server Error
An unexpected failure: unhandled exception, null reference, bug. **Log the details server-side; never leak stack traces or SQL to the client.**

```csharp
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) => _logger = logger;

    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        _logger.LogError(ex, "Unhandled exception. TraceId {TraceId}", ctx.TraceIdentifier);

        ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await ctx.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = 500,
            Title = "An unexpected error occurred.",
            Extensions = { ["traceId"] = ctx.TraceIdentifier }   // client quotes this to support
        }, ct);
        return true;
    }
}

// Program.cs
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
app.UseExceptionHandler();
```

### 501 Not Implemented
The server doesn't support the requested functionality (a feature stub).

### 502 Bad Gateway
A gateway or proxy (Nginx, API gateway) got an **invalid response from the upstream** app. Common when your app container has crashed behind a reverse proxy.

### 503 Service Unavailable
Temporarily can't serve: maintenance, overloaded, a dependency is down. **Include `Retry-After`.**

```csharp
Response.Headers.RetryAfter = "120";
return StatusCode(StatusCodes.Status503ServiceUnavailable,
    new ProblemDetails { Title = "Service temporarily unavailable" });
```

### 504 Gateway Timeout
The gateway/proxy **timed out waiting** for the upstream. If this happens on a payment or order call, the operation may still have succeeded, which is exactly why you need an `Idempotency-Key` for safe retries.

---

## 7. Decision guides (the confusing ones)

### 400 vs 422 vs 409

| Situation | Code |
|---|---|
| Invalid JSON, wrong data type, missing header | **400** |
| Valid JSON, but `email` has bad format / `quantity` < 1 | **422** (or 400, see note) |
| Valid input, but email is already taken / item out of stock / state conflict | **409** |

Note: many teams just use **400 for all validation** and reserve 409 for state conflicts. Either is fine. **Pick one convention and document it.** To use 422 with `[ApiController]`:

```csharp
builder.Services.AddControllers().ConfigureApiBehaviorOptions(o =>
{
    o.InvalidModelStateResponseFactory = ctx =>
    {
        var problem = new ValidationProblemDetails(ctx.ModelState)
            { Status = StatusCodes.Status422UnprocessableEntity };
        return new ObjectResult(problem) { StatusCode = 422 };
    };
});
```

### 401 vs 403 vs 404

| Situation | Code |
|---|---|
| No token / expired token / bad token | **401** |
| Valid token, but role/permission is insufficient | **403** |
| Valid token, resource belongs to someone else and you don't want to reveal it exists | **404** |

### 200 vs 201 vs 202 vs 204

| Situation | Code |
|---|---|
| Read or update, returning a body | **200** |
| Created a resource (add `Location`) | **201** |
| Accepted, finishing later (async) | **202** |
| Done, nothing to return | **204** |

---

## 8. Retry behaviour: what clients should do

| Code | Retry the same request? |
|---|---|
| 400, 401, 403, 404, 405, 415, 422 | **No.** Fix the request, token or permissions first |
| 401 (expired token) | Refresh the token, then retry once |
| 409 | Depends. For "in-flight with same Idempotency-Key", wait and retry; for real conflicts, re-fetch state first |
| 408, 429 | **Yes**, after the `Retry-After` delay (use backoff) |
| 500 | Maybe, with backoff and a retry cap. Only safe for non-idempotent calls if you use an `Idempotency-Key` |
| 502, 503, 504 | **Yes**, with exponential backoff and jitter. Honour `Retry-After` |

---

## 9. Worked example: `POST /api/orders` with payment

How the codes map to each outcome of one endpoint:

| Outcome | Status | Notes |
|---|---|---|
| Order created and payment succeeded | **201** | `Location: /api/orders/834` |
| Same `Idempotency-Key` replayed after success | **201** (stored response) | Header `Idempotent-Replayed: true` |
| Missing `Idempotency-Key` header | **400** | |
| Malformed JSON body | **400** | |
| Token missing or expired | **401** | `WWW-Authenticate: Bearer` |
| Not allowed to place orders | **403** | |
| Product ID doesn't exist | **404** or **422** | Depending on your convention |
| `quantity: 0` | **422** (or 400) | Field-level errors in body |
| Item out of stock | **409** | |
| Same key, still processing | **409** | Client retries later |
| Same key, **different** body | **422** | Client bug |
| Card declined | **422** (or **402**) | Business failure, not a server error |
| Too many attempts | **429** | `Retry-After` |
| Payment gateway down | **503** | `Retry-After`; release the idempotency key |
| Unhandled bug | **500** | Release the key; log with `traceId` |
| Gateway timeout | **504** | Retry safely using the same `Idempotency-Key` |

Note on **402 Payment Required**: it's reserved by the spec and rarely used. Many APIs (Stripe uses 402 for card errors) do use it, but a 422 with a clear error code in the body is equally acceptable. Be consistent.

---

## 10. Common mistakes to avoid

1. **Returning 200 with an error inside the body** (`{ "success": false }`). Monitoring, caches and clients all think it succeeded. Use a real 4xx/5xx.
2. **500 for validation or business errors.** Those are 4xx; 500 should mean a real bug.
3. **401 vs 403 mixed up.** 401 = who are you?, 403 = I know who you are, no.
4. **201 without a `Location` header.**
5. **204 with a body**, or 200 with an empty body.
6. **Leaking exception messages and stack traces** in 500 responses.
7. **No `Retry-After` on 429/503**, so clients hammer you.
8. **Inconsistent error shapes** across endpoints. Use Problem Details everywhere.
9. **Using 404 for an empty list.** `GET /orders` with no orders is `200 []`, not 404.
10. **Using 302 for API redirects** when the method must be preserved. Use 307/308.

---

## 11. Quick reference cheat sheet

| Code | Name | One-liner |
|---|---|---|
| 200 | OK | Success with body |
| 201 | Created | Resource created, send `Location` |
| 202 | Accepted | Queued; finishing later |
| 204 | No Content | Success, no body |
| 301 / 308 | Moved Permanently | Permanent redirect (308 keeps method) |
| 302 / 307 | Found / Temporary Redirect | Temporary redirect (307 keeps method) |
| 304 | Not Modified | Use your cached copy |
| 400 | Bad Request | Malformed request |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Authenticated, not permitted |
| 404 | Not Found | Doesn't exist (or hidden) |
| 405 | Method Not Allowed | Wrong verb for this URL |
| 409 | Conflict | Conflicts with current state |
| 412 | Precondition Failed | `If-Match` check failed |
| 415 | Unsupported Media Type | Wrong `Content-Type` |
| 422 | Unprocessable Content | Valid syntax, failed validation |
| 429 | Too Many Requests | Rate limited, send `Retry-After` |
| 500 | Internal Server Error | Unexpected server bug |
| 502 | Bad Gateway | Bad response from upstream |
| 503 | Service Unavailable | Temporarily down, send `Retry-After` |
| 504 | Gateway Timeout | Upstream timed out |
