# Problem Details (RFC 9457) in ASP.NET Core: Notes

Consolidated from our discussion: the error body format, the three setup lines, how each piece works, the full implementation, and the pitfalls.

---

## 1. What Problem Details is

**Problem Details** is a standard JSON format for API errors (RFC 9457, which replaced RFC 7807). Instead of every endpoint inventing its own error shape (HTML, plain text, `{ "success": false }`, empty bodies), every 4xx/5xx returns the same structure. ASP.NET Core supports it natively through the `ProblemDetails` class.

Content type: `application/problem+json`

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

| Field | Meaning |
|---|---|
| `type` | A URI that identifies the kind of problem (can be a docs link; defaults to an RFC link by status code) |
| `title` | Short, human-readable summary of the problem type. Should not change between occurrences |
| `status` | The HTTP status code, repeated in the body |
| `detail` | Explanation of **this** occurrence |
| `instance` | URI of this specific occurrence (often the request path) |
| extensions | Any extra fields you add, such as `traceId`, `errors`, `errorCode` |

Why use it:
- Clients parse every error the same way, so one error handler on the frontend covers everything.
- You get a `traceId` in every error to correlate with logs.
- It's built in, so no custom error DTO is needed.

For validation failures there is a subtype, `ValidationProblemDetails`, which adds an `errors` dictionary:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "email": ["Invalid email format"],
    "quantity": ["Must be greater than 0"]
  }
}
```

---

## 2. The three setup lines

```csharp
builder.Services.AddProblemDetails();   // standard error bodies
app.UseExceptionHandler();              // turns unhandled exceptions into 500 ProblemDetails
app.UseStatusCodePages();               // gives bare 404/405 etc. a ProblemDetails body
```

Together they make **every** error your API returns come back as Problem Details, instead of a mix of HTML, plain text and empty bodies.

### 2.1 `AddProblemDetails()` (service registration)
Registers the machinery (`IProblemDetailsService`) that knows how to write a `ProblemDetails` JSON body. It changes no behaviour by itself. The two middlewares below look for it and use it to write their responses.

### 2.2 `UseExceptionHandler()` (catches exceptions)
Wraps the rest of the pipeline in a try/catch. If anything later in the pipeline throws an unhandled exception, it catches it and returns a clean 500 instead of crashing the request.

- Without it: an empty 500, or the developer exception page with the stack trace in Development.
- With it:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
  "title": "An error occurred while processing your request.",
  "status": 500,
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00"
}
```

Key points:
- Needs `AddProblemDetails()` to know how to write the body (in .NET 8+ the parameterless call works because of that registration; older versions needed an error path or handler lambda).
- Must be placed **early** in the pipeline. It can only catch exceptions from middleware that runs *after* it.
- If you register a custom `IExceptionHandler`, it runs first. If it returns `true`, the response is done. If it returns `false`, the default Problem Details handler takes over.
- In Development, `WebApplication` adds the developer exception page automatically, so locally you may see an HTML stack trace instead of JSON.

### 2.3 `UseStatusCodePages()` (fills empty error bodies)
Handles errors that **aren't exceptions**: responses with a 400 to 599 status and an empty body. Typical sources:
- a URL that matches no route (bare 404)
- a wrong verb (bare 405)
- `[Authorize]` rejections from the auth middleware (bare 401/403)
- your own code returning `NotFound()` or `StatusCode(403)` with no body

With it (and `AddProblemDetails()`), the empty body becomes:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Not Found",
  "status": 404
}
```

Without `AddProblemDetails()`, it falls back to plain text such as `Status Code: 404; Not Found`.

### 2.4 How the pieces divide the work

| What goes wrong | Handled by | Result |
|---|---|---|
| Code throws an exception | `UseExceptionHandler` | 500 (or mapped status) + Problem Details |
| No route matches, wrong verb, auth rejection | `UseStatusCodePages` | 404/405/401/403 + Problem Details |
| Your code returns an error with its own body | neither, left alone | your body |
| Both rely on | `AddProblemDetails` | the JSON writer |

---

## 3. How `UseStatusCodePages` works internally

It acts **on the way back out** of the pipeline. It lets the rest of the pipeline run, then inspects the response.

Simplified:

```csharp
public async Task Invoke(HttpContext context)
{
    await _next(context);          // 1. let everything after it run first

    // 2. on the way back, decide whether to step in
    if (context.Response.HasStarted
        || context.Response.StatusCode < 400
        || context.Response.StatusCode >= 600
        || context.Response.ContentLength.HasValue
        || !string.IsNullOrEmpty(context.Response.ContentType))
    {
        return;                    // leave the response alone
    }

    await _options.HandleAsync(...);   // 3. write the error body
}
```

It steps in only when **all** of these are true:
- status is 400 to 599
- the response hasn't started sending
- no `Content-Type` has been set
- no `Content-Length` has been set

### Walkthrough: `GET /api/nonexistent`

```
Request goes DOWN the pipeline          Response comes back UP
------------------------------          ----------------------
UseExceptionHandler        ->                                      <- (passes through)
UseStatusCodePages         ->  await _next(...)                    <- 5. sees 404 + empty body, writes Problem Details
UseRouting / endpoints     ->  no route matches                    <- 4. pipeline ends, status 404, body empty
```

### What the default handler does (.NET 8+)
1. If `AddProblemDetails()` is registered, it asks `IProblemDetailsService` to write a body with the status code, title (`"Not Found"`) and a `type` link.
2. If it can't, it falls back to plain text.

The plain-text fallback happens when:
- `AddProblemDetails()` wasn't called, or
- the client's `Accept` header doesn't allow JSON (a browser asking only for `text/html`). API clients like curl, Postman and `HttpClient` normally send `*/*` or `application/json`, so they get JSON.

### Why some errors are skipped

| Response | Why it's left alone |
|---|---|
| `return Conflict(new ProblemDetails {...})` | Body and content type already set |
| `[ApiController]` `NotFound()` | MVC already writes a Problem Details body for client errors |
| Exception caught by `UseExceptionHandler` | The exception handler already wrote the body |
| `200 OK` | Status below 400 |
| Response already streaming | `HasStarted` is true; headers can't change once the body begins |

So it only **fills gaps**, mostly routing misses (404), wrong verb (405), auth rejections (401/403), and manual `StatusCode(...)` results with no body.

### Overloads

| Call | Behaviour |
|---|---|
| `UseStatusCodePages()` | Default: Problem Details or plain text |
| `UseStatusCodePages("text/plain", "Error {0}")` | Fixed content type and body template |
| `UseStatusCodePages(async ctx => {...})` | Your own code writes the body |
| `UseStatusCodePagesWithRedirects("/error/{0}")` | Sends a **302 redirect** to an error page. The client then sees a 200 from that page, so it's a poor fit for APIs |
| `UseStatusCodePagesWithReExecute("/error/{0}")` | Re-runs the pipeline for the error path and keeps the original status. Good for MVC/Razor sites |

For an API, plain `UseStatusCodePages()` with `AddProblemDetails()` is the right choice. Avoid the redirect variant.

---

## 4. Pipeline placement (order matters)

```csharp
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();   // first, so it catches exceptions from everything below
app.UseStatusCodePages();    // above auth/routing, so it sees their empty 401/403/404 responses

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
```

- `UseExceptionHandler` can only catch exceptions from middleware **after** it.
- `UseStatusCodePages` works on the way back up, so it must be **before** the middleware whose responses it should fill. If it sat after `UseAuthorization()`, the 401/403 responses would already be finished when it runs, and it would never see them.

---

## 5. Full implementation: exceptions mapped to status codes

**Idea:** your services throw meaningful exceptions (`NotFoundException`, `ConflictException`). One global handler converts them to the right status code with a Problem Details body. Controllers and services stay free of `return StatusCode(409, ...)` clutter.

### Step 1: Define your own exceptions

```csharp
public abstract class AppException : Exception
{
    public int StatusCode { get; }
    public string Title { get; }

    protected AppException(int statusCode, string title, string detail) : base(detail)
    {
        StatusCode = statusCode;
        Title = title;
    }
}

public class NotFoundException(string detail)
    : AppException(StatusCodes.Status404NotFound, "Not Found", detail);

public class ConflictException(string detail)
    : AppException(StatusCodes.Status409Conflict, "Conflict", detail);

public class BusinessRuleException(string detail)
    : AppException(StatusCodes.Status422UnprocessableEntity, "Business rule violated", detail);
```

### Step 2: Write the global exception handler

```csharp
public class GlobalExceptionHandler(
    IProblemDetailsService problemDetails,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var (status, title, detail) = ex switch
        {
            AppException app => (app.StatusCode, app.Title, (string?)app.Message),
            _                => (500, "An unexpected error occurred.", (string?)null)  // never expose ex.Message
        };

        if (status >= 500)
            logger.LogError(ex, "Unhandled exception. TraceId {TraceId}", ctx.TraceIdentifier);
        else
            logger.LogWarning("Handled {Status}: {Message}", status, ex.Message);

        ctx.Response.StatusCode = status;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = ctx,
            Exception = ex,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = detail
            }
        });
    }
}
```

Points to notice:
- **4xx are logged as warnings, 5xx as errors.** A user asking for a missing order isn't an incident.
- **Unknown exceptions get a generic message.** The real exception goes to the log only, so no stack traces, SQL or file paths reach the client.

### Step 3: Register in `Program.cs`

```csharp
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails(options =>
{
    // Runs for every Problem Details response, including 404s from UseStatusCodePages
    options.CustomizeProblemDetails = ctx =>
        ctx.ProblemDetails.Extensions["traceId"] = ctx.HttpContext.TraceIdentifier;
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
// ... rest of pipeline
```

`CustomizeProblemDetails` is where cross-cutting fields go. Adding `traceId` here means every error carries it, so a client can quote it to support and you can find the exact log entry.

### Step 4: Throw from services

```csharp
public async Task<OrderDto> GetAsync(int id, string userId)
{
    var order = await _db.Orders
        .SingleOrDefaultAsync(o => o.Id == id && o.UserId == userId)
        ?? throw new NotFoundException($"Order {id} was not found.");

    return order.ToDto();
}

public async Task RegisterAsync(RegisterRequest req)
{
    if (await _db.Users.AnyAsync(u => u.Email == req.Email))
        throw new ConflictException($"A user with email {req.Email} already exists.");
    // ...
}
```

The controller stays clean:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<OrderDto>> Get(int id) =>
    Ok(await _service.GetAsync(id, User.GetUserId()));
```

### Step 5: Model validation (not an exception)

With `[ApiController]`, an invalid DTO returns a **400** automatically with `ValidationProblemDetails` and never reaches your exception handler. To switch to 422 and add `traceId`:

```csharp
builder.Services.AddControllers().ConfigureApiBehaviorOptions(o =>
{
    o.InvalidModelStateResponseFactory = ctx =>
    {
        var problem = new ValidationProblemDetails(ctx.ModelState)
        {
            Status = StatusCodes.Status422UnprocessableEntity,
            Title = "Validation failed"
        };
        problem.Extensions["traceId"] = ctx.HttpContext.TraceIdentifier;
        return new ObjectResult(problem) { StatusCode = 422 };
    };
});
```

Many teams just keep 400 for all validation and reserve 409 for state conflicts. Pick one convention and document it.

---

## 6. Returning Problem Details manually

Sometimes you return the error from the action instead of throwing.

```csharp
// 409 with a custom body
return Conflict(new ProblemDetails
{
    Title = "Email already registered",
    Detail = $"A user with email {req.Email} already exists.",
    Status = StatusCodes.Status409Conflict
});

// Shortcut helper on ControllerBase
return Problem(
    title: "Item out of stock",
    detail: "Product 12 has 0 units available.",
    statusCode: StatusCodes.Status409Conflict,
    type: "https://example.com/probs/out-of-stock");

// Validation errors with a field dictionary
return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
{
    ["email"] = ["Invalid email format"]
}) { Status = 422 });
```

Adding custom fields (extensions):

```csharp
var problem = new ProblemDetails { Status = 409, Title = "Out of stock" };
problem.Extensions["errorCode"] = "OUT_OF_STOCK";
problem.Extensions["productId"] = 12;
return Conflict(problem);
```

Use a stable machine-readable `errorCode` for clients to branch on, not the `title` or `detail` text, which are for humans and may change.

---

## 7. What the client sees

| Request | Handled by | Response |
|---|---|---|
| `GET /api/orders/999` (service throws `NotFoundException`) | `GlobalExceptionHandler` | `404` + `{ "status": 404, "title": "Not Found", "detail": "Order 999 was not found.", "traceId": "..." }` |
| Register an existing email | `GlobalExceptionHandler` | `409` + conflict body |
| Unexpected bug (null reference) | `GlobalExceptionHandler` | `500` + generic message + `traceId` (details only in logs) |
| `GET /api/nonexistent` | `UseStatusCodePages` | `404` + Problem Details body |
| Missing or expired JWT | `UseStatusCodePages` | `401` + Problem Details, `WWW-Authenticate` header kept |
| `quantity: 0` in the DTO | `InvalidModelStateResponseFactory` | `422` (or 400) + field-level `errors` |
| Rate limit hit | rate limiter + `UseStatusCodePages` | `429` + `Retry-After` |

Example `Retry-After` setup for 429/503, since clients need to know when to retry:

```csharp
Response.Headers.RetryAfter = "120";
return StatusCode(StatusCodes.Status503ServiceUnavailable,
    new ProblemDetails { Title = "Service temporarily unavailable" });
```

---

## 8. Mapping to the order + payment endpoint

How Problem Details responses map to each outcome of `POST /api/orders`:

| Outcome | Status | Problem Details notes |
|---|---|---|
| Missing `Idempotency-Key` header | 400 | `title: "A valid Idempotency-Key header is required."` |
| Same key, **different** body | 422 | `title: "Idempotency-Key was already used with a different request."` |
| Same key, still processing | 409 | `title: "A request with this Idempotency-Key is still being processed."` |
| Item out of stock | 409 | `errorCode: "OUT_OF_STOCK"` |
| Card declined | 422 (or 402) | Business failure, not a server error |
| Payment gateway down | 503 | `Retry-After` header; release the idempotency key |
| Unhandled bug | 500 | Generic message + `traceId`; release the key |

The idempotency filter in my earlier notes already returns these as `ProblemDetails` objects, so they match the same format.

---

## 9. Pitfalls and good practices

1. **Order matters.** `UseExceptionHandler()` must come before the middleware it should protect; `UseStatusCodePages()` must come before the middleware whose empty responses it should fill.
2. **Development shows a different page.** `WebApplication` adds the developer exception page automatically, so locally you may see an HTML stack trace instead of JSON. Test the JSON path with `ASPNETCORE_ENVIRONMENT=Production` (or `Staging`).
3. **Never leak internals.** Don't put `ex.Message`, stack traces, SQL or file paths in `detail` for 500s. Log them; return a generic message plus `traceId`.
4. **Don't use exceptions as normal control flow in hot paths.** They're slow compared to returning a result. Fine for genuine error cases like "not found" on one request, not for validation in a tight loop.
5. **Interaction with `IdempotencyFilter`.** An action filter sees the exception first. In my notes it releases the key and lets the exception continue, so `GlobalExceptionHandler` still produces the response. A thrown 4xx such as `ConflictException` is therefore **not** stored as a replayable response. If you want 4xx results replayed, return `Conflict(...)` from the action instead of throwing.
6. **`IExceptionHandler` needs .NET 8 or later.** On older versions use a custom middleware or the `UseExceptionHandler(app => ...)` lambda overload. Primary constructors need C# 12.
7. **Don't return 200 with an error in the body.** Use a real 4xx/5xx status with Problem Details.
8. **Keep error shapes consistent.** One format across all endpoints is the whole point.
9. **Don't use the redirect variants of `UseStatusCodePages` in APIs.** A 302 to an error page breaks clients.
10. **Use a stable `errorCode` extension** for client logic instead of matching on `title` or `detail` text.

---

## 10. Quick way to test

Run in a non-Development environment and compare:

```bash
curl -i http://localhost:5000/api/nonexistent
```

- With `UseStatusCodePages()` and `AddProblemDetails()`: `404` with `Content-Type: application/problem+json` and a JSON body.
- With neither: `404` with an empty body.

More checks:

```bash
# 404 via NotFoundException  -> expect 404 + detail + traceId
curl -i http://localhost:5000/api/orders/999 -H "Authorization: Bearer <token>"

# 401 -> expect 401 + WWW-Authenticate header + Problem Details body
curl -i http://localhost:5000/api/orders/1

# Validation -> expect 422 (or 400) + errors dictionary
curl -i -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{ "items": [], "currency": "INR" }'
```

---

## 11. Cheat sheet

| Piece | Role |
|---|---|
| `ProblemDetails` | Standard error body class (`type`, `title`, `status`, `detail`, `instance`, extensions) |
| `ValidationProblemDetails` | Adds an `errors` dictionary for field-level validation |
| `AddProblemDetails()` | Registers the JSON writer |
| `CustomizeProblemDetails` | Adds fields (like `traceId`) to every Problem Details response |
| `UseExceptionHandler()` | Catches unhandled exceptions, returns 500 (or mapped status) |
| `IExceptionHandler` | Your custom exception to status code mapping (.NET 8+) |
| `UseStatusCodePages()` | Fills empty 4xx/5xx bodies (404, 405, 401, 403) |
| `InvalidModelStateResponseFactory` | Customizes the auto-generated validation response |
| `traceId` | Correlates a client error with your server logs |
