# Idempotency-Key Implementation Notes
**Example: Create Order + Process Payment (ASP.NET Core, EF Core, SQL Server)**

---

## 0. The problem

`POST /api/orders` creates an order and charges the customer. If the client times out and retries, or the user double-clicks, you can end up with **two orders and two charges**. An `Idempotency-Key` makes the retry safe: same key → same result, side effects run once.

## 1. Define the contract

| Case | Server behaviour |
|---|---|
| Header missing | `400 Bad Request` |
| New key | Process request, store response, return it |
| Same key, same body, already completed | Return the **stored** response (add `Idempotent-Replayed: true`) |
| Same key, **different** body | `422 Unprocessable Entity` (client bug) |
| Same key, first request still running | `409 Conflict` (client retries later) |
| Request failed with 5xx / exception | Release the key so the client can retry |

Rules:
- Key = client-generated GUID, one per *logical* operation (not per HTTP attempt).
- Scope every key to the user: unique on `(UserId, Key)`.
- Keys expire after 24 hours.
- Applies to `POST` (and `PATCH`). `GET`, `PUT`, `DELETE` are already idempotent.

## 2. Create the table

```sql
CREATE TABLE IdempotencyKeys (
    Id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserId              NVARCHAR(64)   NOT NULL,
    [Key]               NVARCHAR(100)  NOT NULL,
    RequestHash         CHAR(64)       NOT NULL,   -- SHA-256 hex of request body
    Status              TINYINT        NOT NULL,   -- 0 = InProgress, 1 = Completed
    ResponseStatusCode  INT            NULL,
    ResponseBody        NVARCHAR(MAX)  NULL,
    CreatedAt           DATETIME2      NOT NULL,
    CompletedAt         DATETIME2      NULL,
    ExpiresAt           DATETIME2      NOT NULL,
    CONSTRAINT UQ_IdempotencyKeys_User_Key UNIQUE (UserId, [Key])
);

CREATE INDEX IX_IdempotencyKeys_ExpiresAt ON IdempotencyKeys (ExpiresAt);
```

The **unique constraint is the lock**. It makes "check then insert" atomic, so two concurrent requests with the same key cannot both win.

## 3. Entity and DbContext

```csharp
public class IdempotencyRecord
{
    public long Id { get; set; }
    public string UserId { get; set; } = default!;
    public string Key { get; set; } = default!;
    public string RequestHash { get; set; } = default!;
    public IdempotencyStatus Status { get; set; }
    public int? ResponseStatusCode { get; set; }
    public string? ResponseBody { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public enum IdempotencyStatus : byte { InProgress = 0, Completed = 1 }
```

```csharp
// In OnModelCreating
modelBuilder.Entity<IdempotencyRecord>(e =>
{
    e.ToTable("IdempotencyKeys");
    e.HasIndex(x => new { x.UserId, x.Key }).IsUnique();
    e.Property(x => x.Key).HasMaxLength(100);
    e.Property(x => x.RequestHash).HasMaxLength(64).IsFixedLength();
});
```

## 4. The store: claim a key atomically

```csharp
public enum BeginOutcome { Started, Replay, Mismatch, InProgress }

public record BeginResult(BeginOutcome Outcome, int? StatusCode = null, string? Body = null);

public interface IIdempotencyStore
{
    Task<BeginResult> TryBeginAsync(string userId, string key, string requestHash, CancellationToken ct);
    Task CompleteAsync(string userId, string key, int statusCode, string body, CancellationToken ct);
    Task ReleaseAsync(string userId, string key, CancellationToken ct);
}
```

```csharp
public class IdempotencyStore : IIdempotencyStore
{
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(24);
    private static readonly TimeSpan StaleLock = TimeSpan.FromMinutes(2);
    private readonly AppDbContext _db;

    public IdempotencyStore(AppDbContext db) => _db = db;

    public async Task<BeginResult> TryBeginAsync(
        string userId, string key, string requestHash, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        _db.Set<IdempotencyRecord>().Add(new IdempotencyRecord
        {
            UserId = userId, Key = key, RequestHash = requestHash,
            Status = IdempotencyStatus.InProgress,
            CreatedAt = now, ExpiresAt = now.Add(Ttl)
        });

        try
        {
            await _db.SaveChangesAsync(ct);
            return new BeginResult(BeginOutcome.Started);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            _db.ChangeTracker.Clear();   // discard the failed insert
        }

        // Key already exists: inspect it.
        var existing = await _db.Set<IdempotencyRecord>().AsNoTracking()
            .SingleAsync(x => x.UserId == userId && x.Key == key, ct);

        if (existing.RequestHash != requestHash)
            return new BeginResult(BeginOutcome.Mismatch);

        if (existing.Status == IdempotencyStatus.Completed)
            return new BeginResult(BeginOutcome.Replay, existing.ResponseStatusCode, existing.ResponseBody);

        // In progress. If the lock is stale (process crashed), let it be retried later.
        return new BeginResult(BeginOutcome.InProgress);
    }

    public async Task CompleteAsync(string userId, string key, int statusCode, string body, CancellationToken ct)
    {
        await _db.Set<IdempotencyRecord>()
            .Where(x => x.UserId == userId && x.Key == key)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, IdempotencyStatus.Completed)
                .SetProperty(x => x.ResponseStatusCode, statusCode)
                .SetProperty(x => x.ResponseBody, body)
                .SetProperty(x => x.CompletedAt, DateTime.UtcNow), ct);
    }

    public async Task ReleaseAsync(string userId, string key, CancellationToken ct)
    {
        await _db.Set<IdempotencyRecord>()
            .Where(x => x.UserId == userId && x.Key == key
                        && x.Status == IdempotencyStatus.InProgress)
            .ExecuteDeleteAsync(ct);
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };
}
```

Stale-lock handling: a crash after `TryBeginAsync` leaves an `InProgress` row forever. The cleanup job (step 9) should delete `InProgress` rows older than `StaleLock`, or `TryBeginAsync` can take over a stale row with a conditional `UPDATE`.

## 5. Request fingerprint

Hash the *meaningful* request content so a reused key with different data is detected.

```csharp
public static class RequestHasher
{
    public static string Hash(object? payload)
    {
        var json = JsonSerializer.Serialize(payload);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes);   // 64 chars
    }
}
```

## 6. The filter that wraps the endpoint

Opt in per action with an attribute, so only payment/order endpoints pay the cost.

```csharp
[AttributeUsage(AttributeTargets.Method)]
public class IdempotentAttribute : Attribute, IFilterFactory
{
    public bool IsReusable => false;
    public IFilterMetadata CreateInstance(IServiceProvider sp) =>
        ActivatorUtilities.CreateInstance<IdempotencyFilter>(sp);
}
```

```csharp
public class IdempotencyFilter : IAsyncActionFilter
{
    private readonly IIdempotencyStore _store;
    public IdempotencyFilter(IIdempotencyStore store) => _store = store;

    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var http = ctx.HttpContext;
        var ct = http.RequestAborted;

        if (!http.Request.Headers.TryGetValue("Idempotency-Key", out var keyValues)
            || string.IsNullOrWhiteSpace(keyValues) || keyValues.ToString().Length > 100)
        {
            ctx.Result = new BadRequestObjectResult(
                new ProblemDetails { Title = "A valid Idempotency-Key header is required." });
            return;
        }

        var key = keyValues.ToString();
        var userId = http.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var hash = RequestHasher.Hash(ctx.ActionArguments);

        var begin = await _store.TryBeginAsync(userId, key, hash, ct);

        switch (begin.Outcome)
        {
            case BeginOutcome.Mismatch:
                ctx.Result = new ObjectResult(new ProblemDetails
                    { Title = "Idempotency-Key was already used with a different request." })
                    { StatusCode = StatusCodes.Status422UnprocessableEntity };
                return;

            case BeginOutcome.InProgress:
                ctx.Result = new ObjectResult(new ProblemDetails
                    { Title = "A request with this Idempotency-Key is still being processed." })
                    { StatusCode = StatusCodes.Status409Conflict };
                return;

            case BeginOutcome.Replay:
                http.Response.Headers["Idempotent-Replayed"] = "true";
                ctx.Result = new ContentResult
                {
                    StatusCode = begin.StatusCode,
                    Content = begin.Body,
                    ContentType = "application/json"
                };
                return;
        }

        // Started: run the real action.
        var executed = await next();

        if (executed.Exception is not null && !executed.ExceptionHandled)
        {
            await _store.ReleaseAsync(userId, key, CancellationToken.None);  // allow retry
            return;
        }

        if (executed.Result is ObjectResult { StatusCode: var code } r)
        {
            var status = code ?? 200;
            if (status >= 500)
                await _store.ReleaseAsync(userId, key, CancellationToken.None);
            else
                await _store.CompleteAsync(userId, key, status,
                    JsonSerializer.Serialize(r.Value), CancellationToken.None);
        }
    }
}
```

Notes:
- Store 2xx **and** 4xx responses (a validation failure replays as the same failure). Do **not** store 5xx; release the key instead.
- Use `CancellationToken.None` for completing/releasing so a client disconnect doesn't leave the key stuck.

### 6a. What `[Idempotent]` is

`[Idempotent]` is a custom attribute defined above. It is a **marker** placed on an action method to say "run the idempotency logic for this endpoint." It does nothing by itself; it tells ASP.NET Core to attach `IdempotencyFilter` to that action.

```csharp
[HttpPost]
[Idempotent]          // attaches IdempotencyFilter to this action only
public async Task<IActionResult> CreateOrder(...) { ... }
```

How it works:
- The attribute implements `IFilterFactory`. When a request hits an action carrying `[Idempotent]`, ASP.NET Core calls `CreateInstance`, which builds an `IdempotencyFilter` and injects its dependencies (`IIdempotencyStore`) from DI.
- The filter then runs around the action: **before** it (claim the key or replay a stored response) and **after** it (save the response).
- `IFilterFactory` is used instead of a plain `ActionFilterAttribute` because attributes cannot take constructor-injected services. A normal attribute would force you to resolve the store manually via `HttpContext.RequestServices`.
- Alternative with no custom attribute: `[ServiceFilter(typeof(IdempotencyFilter))]` does the same job.

### 6b. Why opt-in per action instead of global

- **Cost:** every idempotent request does a DB insert (claim) plus an update (complete). Running that on every endpoint adds latency and table growth for no benefit.
- **Not every endpoint needs it:** `GET`, `PUT` and `DELETE` are already idempotent. Only endpoints that create something or trigger a side effect (`POST /orders`, `POST /payments`) are at risk from retries.
- **The header becomes mandatory:** the filter returns `400` when `Idempotency-Key` is missing. Applied globally, it would break every endpoint that doesn't need the header.
- **Clarity:** looking at a controller, `[Idempotent]` shows at a glance which endpoints have retry protection.

### 6c. Applying it more broadly

- To protect a whole controller, put `[Idempotent]` on the class and change `AttributeTargets.Method` to `AttributeTargets.Method | AttributeTargets.Class`.
- Or register the filter globally (`options.Filters.Add<IdempotencyFilter>()`), which is only sensible if every endpoint is a non-idempotent `POST`.
- For a payments-only controller, class-level is reasonable. For a mixed controller, per-action is safer.

## 7. The order + payment endpoint

```csharp
public record CreateOrderRequest(List<OrderItemDto> Items, string PaymentMethodId, string Currency);

[HttpPost]
[Idempotent]
public async Task<IActionResult> CreateOrder(
    [FromBody] CreateOrderRequest request,
    [FromHeader(Name = "Idempotency-Key")] string idempotencyKey,
    CancellationToken ct)
{
    var result = await _orderService.PlaceOrderAsync(User.GetUserId(), request, idempotencyKey, ct);
    return result.Success
        ? CreatedAtAction(nameof(GetOrder), new { id = result.OrderId }, result)
        : UnprocessableEntity(new ProblemDetails { Title = result.Error });
}
```

## 8. The service: order + payment flow

Order of operations matters. The payment gateway call is an external side effect that cannot join your DB transaction, so structure it as:

1. Create the order as `Pending` and save (own transaction).
2. Call the payment gateway, **forwarding a key derived from the client's key**.
3. Update the order to `Paid` or `PaymentFailed` and save.

```csharp
public async Task<PlaceOrderResult> PlaceOrderAsync(
    string userId, CreateOrderRequest req, string idempotencyKey, CancellationToken ct)
{
    // 1. Create the order in Pending state.
    var order = new Order
    {
        UserId = userId,
        Status = OrderStatus.Pending,
        Total = req.Items.Sum(i => i.Price * i.Quantity),
        Currency = req.Currency,
        Items = req.Items.Select(i => new OrderItem(i.ProductId, i.Quantity, i.Price)).ToList()
    };
    _db.Orders.Add(order);
    await _db.SaveChangesAsync(ct);

    // 2. Charge. Forward a derived key so the gateway also dedupes.
    var charge = await _paymentGateway.ChargeAsync(new ChargeRequest(
        Amount: order.Total,
        Currency: order.Currency,
        PaymentMethodId: req.PaymentMethodId,
        Reference: order.Id.ToString(),
        IdempotencyKey: $"{idempotencyKey}:payment"), ct);

    // 3. Record the outcome.
    order.Status = charge.Succeeded ? OrderStatus.Paid : OrderStatus.PaymentFailed;
    order.PaymentReference = charge.TransactionId;
    await _db.SaveChangesAsync(ct);

    return charge.Succeeded
        ? PlaceOrderResult.Ok(order.Id)
        : PlaceOrderResult.Fail("Payment was declined.");
}
```

Why forward the key to the gateway: if the app crashes **after** the charge but **before** step 3, the retry re-runs the flow. The gateway sees the same `...:payment` key and returns the original charge instead of charging again. (Stripe supports an `Idempotency-Key` header natively. For providers without it, deduplicate by using your `order.Id` as the merchant reference and checking for an existing payment before charging.)

## 9. Register services and clean up

```csharp
builder.Services.AddScoped<IIdempotencyStore, IdempotencyStore>();
```

Daily cleanup (a `BackgroundService` or SQL Agent job):

```sql
DELETE FROM IdempotencyKeys WHERE ExpiresAt < SYSUTCDATETIME();
DELETE FROM IdempotencyKeys
WHERE Status = 0 AND CreatedAt < DATEADD(MINUTE, -2, SYSUTCDATETIME());  -- stale locks
```

## 10. Client side

```http
POST /api/orders
Authorization: Bearer <token>
Idempotency-Key: 3f1c5a0e-8d7b-4c21-9a55-0d6b2f9e1a77
Content-Type: application/json

{ "items": [{ "productId": 12, "quantity": 2, "price": 499.00 }],
  "paymentMethodId": "pm_abc", "currency": "INR" }
```

- Generate the GUID **once** when the user clicks "Pay", store it, and reuse it for every retry of that same attempt.
- Generate a **new** key for a genuinely new order.
- On `409`, wait and retry with the same key. On `422`, fix the bug; never retry blindly.

## 11. Test cases

1. Send the same request twice → one order, one charge, second response has `Idempotent-Replayed: true`.
2. Same key, different body → `422`.
3. Fire 10 parallel requests with one key → exactly one order created, the rest get `409` or the replay.
4. Gateway throws a 5xx → key released; retry succeeds and creates the order.
5. Kill the process between charge and `Paid` update → retry finishes the order without a second charge.
6. Two different users use the same key string → no collision.
7. Missing header → `400`.
8. Expired key → treated as new.

## 12. Checklist

- [ ] Unique index on `(UserId, Key)`
- [ ] Atomic claim via insert, not check-then-insert
- [ ] Request hash compared on reuse
- [ ] 409 for in-flight, 422 for body mismatch
- [ ] 5xx and exceptions release the key
- [ ] Derived key forwarded to the payment gateway
- [ ] Order starts `Pending`, ends `Paid` / `PaymentFailed`
- [ ] TTL cleanup and stale-lock cleanup job
- [ ] Parallel-request test passes
