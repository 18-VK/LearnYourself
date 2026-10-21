# HTTP Headers in REST APIs — Reference Guide

A practical reference for the HTTP headers that matter most when designing and consuming REST APIs, organized by purpose, with request/response examples and ASP.NET Core notes where relevant.

---

## 1. Authentication & Authorization

### `Authorization`
Carries the client's credentials on every request.

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Authorization: Basic dXNlcjpwYXNzd29yZA==
Authorization: ApiKey sk_live_51Hxy...
```

**Use cases:**
- Bearer scheme for JWT-based APIs (SPAs, mobile apps, microservices)
- Basic scheme for simple internal/trusted-network tools
- Custom schemes (`ApiKey`) for machine-to-machine integrations

**ASP.NET Core example — reading the bearer token in middleware config:**
```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new RsaSecurityKey(rsaPublicKey)
        };
    });
```

### `WWW-Authenticate`
Sent by the server in a `401 Unauthorized` response to tell the client what authentication scheme it should use.

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="api", error="invalid_token", error_description="The token expired"
```

**Use case:** Lets a well-behaved client distinguish "you sent no token" from "your token expired" from "wrong scheme" — useful for triggering an automatic refresh-token flow client-side.

---

## 2. Content Negotiation

### `Content-Type`
Declares the media type of the body being sent (request) or returned (response).

```
Content-Type: application/json; charset=utf-8
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
Content-Type: application/x-www-form-urlencoded
```

**Use cases:**
- `application/json` — the default for REST APIs
- `multipart/form-data` — file uploads alongside form fields
- `application/x-www-form-urlencoded` — legacy form posts

### `Accept`
The client tells the server which response formats it can handle, optionally with quality weighting.

```
Accept: application/json
Accept: application/json, application/xml;q=0.8, */*;q=0.1
```

**Use case:** Supporting both JSON and XML consumers from the same endpoint; return `406 Not Acceptable` if none of the requested types can be produced.

**ASP.NET Core example:**
```csharp
[Produces("application/json", "application/xml")]
[HttpGet]
public IActionResult GetTasks() => Ok(tasks);
```

### `Accept-Language` / `Content-Language`
Negotiates localization.

```
Accept-Language: en-US, en;q=0.9, hi;q=0.5
Content-Language: en-US
```

**Use case:** An API serving error messages or task descriptions in multiple languages based on user locale.

---

## 3. Caching

### `Cache-Control`
The primary caching directive, usable on both requests and responses.

```
Cache-Control: no-store                  # never cache (sensitive data)
Cache-Control: no-cache                  # cache, but revalidate every time
Cache-Control: private, max-age=3600     # cache per-user for 1 hour
Cache-Control: public, max-age=86400     # cache and share across users for 1 day
```

**Use case:** A `GET /api/tasks/categories` endpoint that rarely changes can set `public, max-age=3600` to cut DB load; a `GET /api/tasks/me` (per-user, sensitive) should use `private, no-store`.

### `ETag` + `If-None-Match`
`ETag` is a fingerprint of the current resource state, returned by the server. The client echoes it back on the next request via `If-None-Match`; if unchanged, the server replies `304 Not Modified` with an empty body.

```
# First request
GET /api/tasks/42
→ 200 OK
  ETag: "a1b2c3d4"

# Later request
GET /api/tasks/42
If-None-Match: "a1b2c3d4"
→ 304 Not Modified   (no body sent)
```

**Use case:** A client polling a task list for updates avoids re-downloading unchanged data — saves bandwidth and DB reads.

### `Last-Modified` + `If-Modified-Since`
Same idea as ETag, but using a timestamp instead of a hash. Coarser (second-level precision) but cheaper to compute.

```
Last-Modified: Wed, 03 Sep 2026 10:15:00 GMT
If-Modified-Since: Wed, 03 Sep 2026 10:15:00 GMT
→ 304 Not Modified
```

**Use case:** Static or rarely-changing resources where computing a hash isn't worth it.

---

## 4. Concurrency Control

### `If-Match`
The client sends the `ETag` it last read; the server rejects the write with `412 Precondition Failed` if the resource has changed since, preventing a "lost update."

```
PUT /api/tasks/42
If-Match: "a1b2c3d4"
Content-Type: application/json

{ "title": "Updated title", "status": "InProgress" }

→ 412 Precondition Failed   (someone else updated it first)
```

**Use case:** Two users editing the same task concurrently — without this, the second write silently overwrites the first user's change. This is the standard fix for "lost update" bugs on `PUT`/`PATCH` endpoints.

**ASP.NET Core pattern:**
```csharp
[HttpPut("{id}")]
public async Task<IActionResult> UpdateTask(int id, [FromHeader(Name = "If-Match")] string? ifMatch, TaskDto dto)
{
    var task = await _repo.GetAsync(id);
    var currentEtag = GenerateEtag(task);

    if (ifMatch != null && ifMatch != currentEtag)
        return StatusCode(412); // Precondition Failed

    // proceed with update...
}
```

---

## 5. CORS (Cross-Origin Resource Sharing)

### `Origin`
Sent automatically by the browser, identifying where the request originated.

```
Origin: https://app.yourdomain.com
```

### `Access-Control-Allow-Origin`
Server response header naming which origins may read the response.

```
Access-Control-Allow-Origin: https://app.yourdomain.com
Access-Control-Allow-Origin: *
```

### `Access-Control-Allow-Methods` / `Access-Control-Allow-Headers`
Sent in response to a preflight `OPTIONS` request, listing what's permitted for the real request.

```
OPTIONS /api/tasks
Origin: https://app.yourdomain.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Content-Type, Authorization

→ 204 No Content
  Access-Control-Allow-Origin: https://app.yourdomain.com
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE
  Access-Control-Allow-Headers: Content-Type, Authorization
```

**Use case:** Once your Angular frontend runs on a different port/origin than the API during development (or a different subdomain in production), the browser blocks the response unless these headers are configured correctly.

**ASP.NET Core example:**
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy =>
        policy.WithOrigins("https://app.yourdomain.com")
              .AllowAnyMethod()
              .AllowAnyHeader());
});
```

---

## 6. Rate Limiting & Throttling

### `Retry-After`
Tells the client how long to wait before retrying, typically alongside `429 Too Many Requests` or `503 Service Unavailable`.

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

**Use case:** Protects the API from being hammered by a misbehaving client; well-built clients back off automatically.

### `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset`
Not officially standardized, but a widely-adopted convention (used by GitHub, Twitter/X, Stripe, etc.).

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1725530400
```

**Use case:** Lets API consumers self-throttle proactively instead of waiting to hit a 429.

---

## 7. Idempotency & Tracing

### `Idempotency-Key`
A client-generated unique key attached to a `POST`, so a retried request (e.g. after a network timeout) doesn't create a duplicate resource.

```
POST /api/tasks
Idempotency-Key: 8f14e45f-ceea-467e-a5b0-38a90b8f6b0e

{ "title": "Finish report" }
```

**Use case:** The client retries a task-creation request after a timeout, unsure if the first attempt succeeded. The server checks if it has already processed this key and returns the original result instead of creating a duplicate task.

### `X-Request-Id` / `X-Correlation-Id`
Not standardized, but the de facto convention for tracing one logical request across multiple services/logs.

```
X-Correlation-Id: 7c9e6679-7425-40de-944b-e07fc1f90ae7
```

**Use case:** Once your API is called by other services (or you split it into microservices), attaching this header at the edge and logging it everywhere lets you trace a single user action through every hop.

**ASP.NET Core middleware example:**
```csharp
app.Use(async (context, next) =>
{
    var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
                         ?? Guid.NewGuid().ToString();
    context.Response.Headers["X-Correlation-Id"] = correlationId;
    using (LogContext.PushProperty("CorrelationId", correlationId))
    {
        await next();
    }
});
```

---

## 8. Security Headers

### `Strict-Transport-Security` (HSTS)
Tells the browser to only ever contact this domain over HTTPS, even if the user types `http://`.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

**Use case:** Prevents downgrade/man-in-the-middle attacks on the initial request. You've already wired this into your API via `UseHttpsRedirection` + HSTS middleware.

### `X-Content-Type-Options: nosniff`
Stops the browser from guessing ("sniffing") a response's content type, which can otherwise be exploited to execute disguised scripts.

```
X-Content-Type-Options: nosniff
```

### `X-Frame-Options` / `Content-Security-Policy`
Mitigate clickjacking and XSS by restricting how the response can be framed or what scripts/styles it can load.

```
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
```

**Use case:** More relevant to browser-rendered content than a pure JSON API, but commonly set defensively on all responses as part of a security baseline.

---

## 9. Pagination & Metadata (Custom Conventions)

### `X-Total-Count`
Total record count for a paginated collection, exposed as a header instead of (or in addition to) the response body.

```
GET /api/tasks?page=2&pageSize=20
→ 200 OK
  X-Total-Count: 187
```

**Use case:** Client can compute total pages without parsing the body, and some API consumers (and API gateway tooling) expect count metadata in headers by convention.

### `Link`
RFC 5988 header for pagination links.

```
Link: <https://api.example.com/tasks?page=3>; rel="next",
      <https://api.example.com/tasks?page=1>; rel="prev"
```

**Use case:** An alternative to embedding `nextPageUrl`/`prevPageUrl` fields in the JSON body — keeps the body focused purely on data.

---

## Quick Reference Table

| Scenario | Header(s) to use |
|---|---|
| Sending a JWT | `Authorization: Bearer <token>` |
| Server rejects an expired/invalid token | `WWW-Authenticate` |
| Client wants JSON specifically | `Accept: application/json` |
| Uploading a file | `Content-Type: multipart/form-data` |
| Avoid re-fetching unchanged data | `ETag` + `If-None-Match` |
| Prevent overwriting concurrent edits | `ETag` + `If-Match` |
| Browser calling API from a different origin | `Origin`, `Access-Control-Allow-Origin` |
| Preventing duplicate POSTs on retry | `Idempotency-Key` |
| Tracing a request across services | `X-Correlation-Id` |
| Exposing rate limit status | `X-RateLimit-*` |
| Client should back off and retry later | `Retry-After` |
| Enforcing HTTPS-only | `Strict-Transport-Security` |
| Exposing pagination total | `X-Total-Count` |

---

## Notes for a Task Management API

Two additions worth prioritizing given a typical task-management API's shape:

1. **`ETag` + `If-Match` on task updates** — directly solves the "two users editing the same task" lost-update problem on `PUT`/`PATCH /api/tasks/{id}`.
2. **`X-Total-Count` on paginated list endpoints** — gives clients an easy, body-independent way to compute total pages, and is a common fix for pagination count bugs where the body's `TotalCount` field falls out of sync with what was actually queried.
