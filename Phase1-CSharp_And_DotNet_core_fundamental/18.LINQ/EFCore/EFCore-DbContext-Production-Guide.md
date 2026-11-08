# EF Core DbContext in Production .NET Apps

A practical guide to registering, injecting and operating `DbContext` in a production-grade ASP.NET Core application using Clean Architecture.

---

## 1. Registration

```csharp
// Infrastructure/DependencyInjection.cs
public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
{
    services.AddDbContext<AppDbContext>((sp, options) =>
    {
        options.UseSqlServer(
            config.GetConnectionString("Default"),
            sql =>
            {
                sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                sql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null);
                sql.CommandTimeout(30);
                sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            });

        options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking); // opt in to tracking for writes
        options.AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>());
    });

    services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<AppDbContext>());
    services.AddScoped<AuditSaveChangesInterceptor>();
    return services;
}
```

Key points:
- `AddDbContext` registers the context as **Scoped**, meaning one instance per HTTP request. This is correct for almost everything.
- `AddDbContextPool` reuses context instances and reduces allocation under high throughput. Use it only if the context holds **no per-request state**. A tenant ID or current user stored as a field would leak between requests.
- Never enable `EnableSensitiveDataLogging()` or `EnableDetailedErrors()` outside Development.

### 1.1 Explanation of each point in the registration

**`public static IServiceCollection AddInfrastructure(...)` (extension method)**
Registration lives in the Infrastructure project as an extension method, so `Program.cs` only calls `builder.Services.AddInfrastructure(builder.Configuration)`. The Api project never needs to know about SQL Server or EF details, which keeps the Clean Architecture dependency rule intact (Infrastructure depends on Application, not the other way around).

**`services.AddDbContext<AppDbContext>((sp, options) => { ... })`**
Registers `AppDbContext` with the DI container and its `DbContextOptions<AppDbContext>`. The default lifetime is **Scoped**: in a web app, one instance is created per HTTP request and disposed when the request ends. This matches the DbContext's design: a short-lived Unit of Work. The overload with `(sp, options)` gives you the `IServiceProvider` so you can resolve other services (interceptors, loggers, tenant providers) while configuring options.

**`options.UseSqlServer(connectionString, sql => { ... })`**
Selects the database provider (SQL Server here) and gives access to provider-specific options in the inner lambda. `config.GetConnectionString("Default")` reads `ConnectionStrings:Default`, which should come from environment variables, user-secrets or a vault in production, not from a committed file.

**`sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)`**
Tells EF which assembly holds migration files. By default EF looks in the assembly that contains the DbContext, which is already Infrastructure, so this line is mostly explicit documentation. It becomes essential if the startup project (Api) is different from where you want migrations stored, or if you ever move the DbContext to a separate project.

**`sql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: 10s, errorNumbersToAdd: null)`**
Turns on the SQL Server **connection resiliency** execution strategy. If a *transient* error occurs (deadlock victim, timeout, brief network drop, Azure SQL failover), EF retries the operation automatically with exponential backoff.
- `maxRetryCount: 5` is the maximum number of retries before the exception is surfaced.
- `maxRetryDelay: 10s` caps the wait between attempts.
- `errorNumbersToAdd: null` means "use only EF's built-in list of transient SQL error numbers". Pass extra SQL error numbers here if you know of app-specific ones worth retrying.
- Side effect: once enabled, **user-initiated transactions must run inside `CreateExecutionStrategy().ExecuteAsync(...)`** (see section 6), otherwise EF throws `InvalidOperationException`.

**`sql.CommandTimeout(30)`**
Maximum seconds a single SQL command may run before it is cancelled (default is 30 anyway, but being explicit makes it visible and tunable). It protects you from runaway queries holding connections and locks. Don't raise it globally to hide slow queries. Raise it per operation (for example a reporting query) if truly needed.

**`sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)`**
Changes the default for queries with multiple collection `Include`s:
- **SingleQuery** (EF default): one big JOIN. Can cause a *cartesian explosion*: duplicate parent data multiplied by each child collection.
- **SplitQuery**: one SQL query per collection. Less data transferred and faster for wide graphs, but multiple round trips and no snapshot consistency unless you use a transaction.
- You can override per query with `.AsSingleQuery()` or `.AsSplitQuery()`.
- 📖 Deep dive: [1.3 Deep dive: UseQuerySplittingBehavior](#13-deep-dive-usequerysplittingbehavior)
- 🔀 Side-by-side with worked data and row counts: [Section 9: SingleQuery vs SplitQuery](#9-singlequery-vs-splitquery-detailed-comparison)

**`options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)`**
Makes every query **no-tracking by default**, so EF doesn't keep entities in the change tracker. Reads are faster and use less memory, which suits APIs that are mostly read-heavy.
- **Important:** with this default, entities you load are *not* tracked, so modifying them and calling `SaveChangesAsync` will do nothing. For write paths, use `.AsTracking()` on the query, or `Attach`/`Update` explicitly.

**`options.AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>())`**
Plugs a `SaveChangesInterceptor` into EF's pipeline. It runs automatically on every `SaveChanges`/`SaveChangesAsync`, which is a good place for cross-cutting concerns such as audit fields (`CreatedAt`, `UpdatedAt`, `CreatedBy`), soft delete conversion or domain event dispatch. Resolving it through `sp` lets the interceptor get its own dependencies (`ICurrentUser`, `TimeProvider`) via DI. See section 8.

**`services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<AppDbContext>())`**
Exposes the same scoped `AppDbContext` instance under the Application-layer abstraction. Because it forwards to the already-registered context (instead of registering a second one), `IApplicationDbContext` and `AppDbContext` are the **same object within a request**, so they share the change tracker and transaction. Handlers depend on the interface, never on EF Core's concrete context.

#### When is `IApplicationDbContext` required?

> **Note:** this registration line is only needed if something asks DI for `IApplicationDbContext`. `AddDbContext<AppDbContext>` registers only the concrete type, so the container does not know that `AppDbContext` also implements the interface.

| Your design | Who injects what | Forwarding line required? |
|---|---|---|
| **Context-as-abstraction** (section 3): handlers/services in the Application layer use the context directly | Application layer injects `IApplicationDbContext` | **Yes** |
| **Repository pattern**: repositories live in Infrastructure and wrap the context | Repositories inject `AppDbContext`; Application layer injects `IProjectRepository` (or similar) | **No** |
| Everything injects `AppDbContext` directly (no Clean Architecture boundary) | Concrete `AppDbContext` everywhere | **No** |

**Required: example**

```csharp
// Application layer: depends only on the interface
public class GetOrdersHandler(IApplicationDbContext db) { ... }

// Infrastructure registration: without the forwarding line, resolving the handler fails with
// "Unable to resolve service for type 'IApplicationDbContext'"
services.AddDbContext<AppDbContext>(...);
services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<AppDbContext>());
```

**Not required: repository pattern example**

```csharp
// Application layer: abstraction is the repository
public interface IProjectRepository { Task<Project?> GetByIdAsync(int id, CancellationToken ct); }

// Infrastructure layer: the repository may reference AppDbContext directly
public class ProjectRepository(AppDbContext appDbContext, ILogger<ProjectRepository> logger) : IProjectRepository { ... }

// Registration: no IApplicationDbContext line needed
services.AddDbContext<AppDbContext>(...);
services.AddScoped<IProjectRepository, ProjectRepository>();
```

Repositories are in Infrastructure, so they can depend on `AppDbContext` without breaking the Clean Architecture dependency rule.

**Pick one approach and stay consistent.** Do not register `services.AddScoped<IApplicationDbContext, AppDbContext>()` as a shortcut: that creates a *second* context instance per request, separate from the one the rest of your code gets via `AppDbContext`. The two would have different change trackers, connections and transactions. The lambda form above forwards to the single existing instance instead.

If you use repositories, also remember that every repository shares the same scoped context, so one `SaveChangesAsync` call persists pending changes from all of them. Decide whether repositories save themselves or the service layer (or a Unit of Work) does.

**`services.AddScoped<AuditSaveChangesInterceptor>()`**
Registers the interceptor itself as scoped, because it depends on scoped services such as `ICurrentUser`. Registration order in DI does not matter; it just needs to exist before the first context is resolved.

**`return services;`**
Returns the collection so calls can be chained fluently in `Program.cs`.

**The three "Key points" bullets, explained**
- *`AddDbContext` is Scoped*: one context per request means every query and `SaveChanges` in that request shares one Unit of Work and one change tracker, and nothing leaks across users. A Singleton context would be shared by concurrent requests and is not thread-safe (see section 4).
- *`AddDbContextPool` and state*: pooling resets and reuses context instances instead of constructing new ones. This is only safe when the context has no mutable per-request fields. Details and trade-offs are in 1.2 below.
- *Never enable `EnableSensitiveDataLogging()` / `EnableDetailedErrors()` in production*: sensitive-data logging writes **parameter values** (emails, tokens, personal data) into your logs, which is a security and compliance risk. Detailed errors add overhead and can expose internals. Gate them behind `if (env.IsDevelopment())`.

### 1.2 `AddDbContext` vs `AddDbContextPool`

```csharp
// Standard (a new context instance per scope)
services.AddDbContext<AppDbContext>(options => options.UseSqlServer(cs));

// Pooled (instances are reset and reused)
services.AddDbContextPool<AppDbContext>(options => options.UseSqlServer(cs), poolSize: 1024);
```

**How each works**

| | `AddDbContext` | `AddDbContextPool` |
|---|---|---|
| Lifetime | Scoped | Scoped (from the caller's view) |
| Instance creation | New `AppDbContext` for every scope | Takes an instance from a pool, resets its state, returns it to the pool on dispose |
| Options configuration | Lambda runs **per scope** | Lambda runs **once**, at pool creation |
| Constructor | Any dependencies allowed | Only `DbContextOptions` (no scoped state via constructor) |

**`AddDbContext`: pros**
- Simplest and safest model; no state-leak risk.
- Constructor injection works for any service (`ICurrentUser`, `ITenantProvider`).
- The options lambda runs per scope, so it can resolve **scoped** services (the `sp` parameter is the request scope).
- Per-request customization (tenant-specific connection string, per-request interceptors) is easy.

**`AddDbContext`: cons**
- Allocates a new context and its internals per request. This is a small cost (microseconds), but it adds GC pressure at very high request rates.

**`AddDbContextPool`: pros**
- Fewer allocations and less GC pressure, so a measurable throughput gain in very high-RPS APIs with short, simple requests.
- Faster context "creation" because the heavy internal service graph is reused.
- A configurable pool size (default 1024) caps the number of retained instances.

**`AddDbContextPool`: cons**
- **State leak risk:** EF resets *its own* state (change tracker, etc.) when returning a context to the pool, but it does not reset **your** fields. Anything you add such as `public string TenantId` or `CurrentUserId` could leak to the next request that picks up that instance.
- The options lambda runs **once**, so you can't resolve scoped services (like `ICurrentUser`) there for per-request behavior. Services resolved at configuration time come from the root provider. The registration in section 1 resolves a scoped `AuditSaveChangesInterceptor` through `sp`, which would **not** be safe under pooling.
- Constructor must be simple: only `DbContextOptions<T>`. Per-request dependencies must be passed in differently (for example, interceptors that read `ICurrentUser` from `IHttpContextAccessor` at the time of the call).
- Once the pool is exhausted (more concurrent requests than `poolSize`), EF just creates new instances, so there is no benefit under that load.
- Harder to reason about. The gain is often negligible compared with actual database latency.

**When to use what**

| Situation | Choice |
|---|---|
| Default for most business apps / APIs | **`AddDbContext`** |
| Multi-tenant app with per-tenant connection string or tenant field in the context | **`AddDbContext`** (or `IDbContextFactory` with per-tenant logic) |
| Context needs scoped services via constructor or in options (current user, audit, etc.) | **`AddDbContext`** |
| Very high throughput, stateless context, simple constructor, and profiling shows context creation as a measurable cost | **`AddDbContextPool`** |
| Blazor Server, background jobs, parallel work | **`AddDbContextFactory`** (or `AddPooledDbContextFactory`), see section 4 |

**Rule of thumb:** start with `AddDbContext`. Switch to pooling only after a benchmark or profile proves context construction is a bottleneck *and* you have verified the context holds no per-request state.

If you do need pooling and per-request data, keep the context itself stateless and read the data from a scoped service at the time of use (for example, through a global query filter that calls an injected accessor, or interceptors that resolve `ICurrentUser` lazily from the `DbContext`'s service provider).

### 1.3 Deep dive: `UseQuerySplittingBehavior`

It controls how EF Core translates a LINQ query that **includes more than one collection navigation** (`Include` on a one-to-many) into SQL. There are two modes: one big JOIN (`SingleQuery`, the EF default) or several separate queries (`SplitQuery`).

> 🔀 See the full comparison with sample data in [Section 9: SingleQuery vs SplitQuery](#9-singlequery-vs-splitquery-detailed-comparison).

#### The problem: cartesian explosion

Take an `Order` that has two child collections:

```csharp
var orders = await db.Orders
    .Include(o => o.Items)       // 50 items per order
    .Include(o => o.Payments)    // 20 payments per order
    .Where(o => o.CustomerId == id)
    .ToListAsync(ct);
```

**SingleQuery (EF default).** EF generates one SQL statement with `LEFT JOIN`s to both tables:

```sql
SELECT o.*, i.*, p.*
FROM Orders o
LEFT JOIN OrderItems i ON i.OrderId = o.Id
LEFT JOIN Payments  p ON p.OrderId = o.Id
WHERE o.CustomerId = @id
ORDER BY o.Id, i.Id, p.Id
```

The database returns the **cross product** of the two child sets per order: 50 items × 20 payments = **1,000 rows for one order**. Every row repeats all the `Orders` columns, and each item is repeated 20 times and each payment 50 times. For 100 orders that is 100,000 rows, mostly duplicate data, which wastes network bandwidth, database memory and EF's materialization time. It grows multiplicatively with each extra collection you include.

With only **one** collection include, the result is 1 row per child, with no explosion. Single query is fine there, and often faster.

**SplitQuery.** EF sends one query per collection:

```sql
-- Query 1: parents
SELECT o.* FROM Orders o
WHERE o.CustomerId = @id
ORDER BY o.Id;

-- Query 2: items
SELECT i.*, o.Id
FROM Orders o
INNER JOIN OrderItems i ON i.OrderId = o.Id
WHERE o.CustomerId = @id
ORDER BY o.Id;

-- Query 3: payments
SELECT p.*, o.Id
FROM Orders o
INNER JOIN Payments p ON p.OrderId = o.Id
WHERE o.CustomerId = @id
ORDER BY o.Id;
```

Now it is 1 + 50 + 20 = **71 rows per order** instead of 1,000. Growth is additive instead of multiplicative. EF stitches the results back into the object graph in memory.

#### Trade-offs

| | SingleQuery | SplitQuery |
|---|---|---|
| Round trips | 1 | 1 + number of collection includes |
| Data volume | Can explode with 2+ collections | Small, no duplication |
| Consistency | One statement, so one consistent snapshot | Separate statements, so data may change between them |
| Latency sensitivity | Better when the DB is far away (cloud, cross-region) | Each extra round trip adds latency |
| Pagination | Straightforward | Works, but you need a deterministic `OrderBy` |

- **Consistency:** if another transaction inserts an item between query 1 and query 2, you may get a parent without that item, or children that don't match the parent. If this matters, wrap the query in a transaction with `Snapshot` or `Serializable` isolation. Most read-only API screens don't care.
- **Ordering:** always use a deterministic `OrderBy` (ideally by a unique key) with `Skip`/`Take` in split queries. Without it, the separate queries can disagree on which parents they are returning. EF logs a warning when it detects this.

#### What the setting does in the registration

```csharp
sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
```

This changes the **default for every query in the application**. Any query with a collection `Include` becomes a split query unless you override it. Per-query overrides:

```csharp
// Force one query even though the global default is split
db.Orders.Include(o => o.Items).AsSingleQuery();

// Force split even when the global default is single
db.Orders.Include(o => o.Items).Include(o => o.Payments).AsSplitQuery();
```

#### What triggers splitting and what doesn't

- Only **collection** navigations (`Order.Items`, one-to-many) cause an extra query.
- **Reference** navigations (`Order.Customer`, many-to-one or one-to-one) are always JOINed in the main query. They don't multiply rows.
- Projections (`Select(o => new Dto(...))`) generally don't need this at all, because you only fetch the columns you ask for. A collection inside a projection can still be split, though.

#### The warning EF gives you

If you leave the default as single query and write a query with multiple collection includes, EF logs `MultipleCollectionIncludeWarning` at runtime. It is EF telling you that you may have a cartesian explosion. Setting a global default of `SplitQuery` removes that warning for the whole app.

#### Which should you choose?

| Situation | Choice |
|---|---|
| Query includes 2+ collections, or a large collection | **Split** |
| Include of a single small collection | **Single** (one round trip, consistent) |
| Database is far from the app (high network latency) | Lean to **Single**, or reduce includes with a projection |
| You need a consistent snapshot without a transaction | **Single** |
| Read model / API response | Best option: **projection with `Select`** and neither |

A global `SplitQuery` default is a sensible choice for typical APIs with rich aggregates. But the real fix for most read endpoints is to avoid `Include` and project only the columns you need. Treat `SplitQuery` as protection for the cases where you do need to load a graph, mostly on write paths where you load a tracked aggregate.

---

## 2. The DbContext itself

```csharp
public class AppDbContext : DbContext, IApplicationDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Customer> Customers => Set<Customer>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}

// Fluent config in its own class, not in OnModelCreating
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("Orders");
        b.HasKey(x => x.Id);
        b.Property(x => x.Total).HasPrecision(18, 2);
        b.Property(x => x.RowVersion).IsRowVersion();          // optimistic concurrency
        b.HasIndex(x => new { x.CustomerId, x.CreatedAt });
        b.HasOne(x => x.Customer).WithMany(c => c.Orders).HasForeignKey(x => x.CustomerId);
    }
}
```

---

## 3. Injection with Clean Architecture

Since you're on Clean Architecture, define an abstraction in **Application** and implement it in **Infrastructure**:

```csharp
// Application layer
public interface IApplicationDbContext
{
    DbSet<Order> Orders { get; }
    DbSet<Customer> Customers { get; }
    Task<int> SaveChangesAsync(CancellationToken ct);
}

// Application layer: handler/service
public class GetOrdersHandler(IApplicationDbContext db)
{
    public async Task<PagedResult<OrderDto>> Handle(int page, int size, CancellationToken ct)
    {
        var query = db.Orders.AsNoTracking().OrderByDescending(o => o.CreatedAt);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * size).Take(size)
            .Select(o => new OrderDto(o.Id, o.Total, o.Customer.Name))   // project, don't load entities
            .ToListAsync(ct);

        return new(items, total);
    }
}
```

**Repository or not?** `DbContext` already implements Unit of Work and `DbSet` is a repository. A generic `IRepository<T>` on top usually adds noise and leaks `IQueryable` anyway. Using `IApplicationDbContext` directly in handlers is the common approach. Add a repository only for complex aggregates or where you want to hide persistence entirely (DDD).

> **Note:** if you use the repository pattern instead (repositories in Infrastructure injecting `AppDbContext`, Application layer injecting `IProjectRepository`), you do **not** need `IApplicationDbContext` or its forwarding registration. See [When is `IApplicationDbContext` required?](#when-is-iapplicationdbcontext-required) in section 1.1 for both setups side by side.

---

## 4. Lifetime pitfalls

DbContext is **not thread-safe** and is meant to be short-lived.

| Scenario | Wrong | Right |
|---|---|---|
| Singleton service needs DB | Inject `AppDbContext` (captive dependency) | Inject `IServiceScopeFactory` or `IDbContextFactory<T>` |
| `BackgroundService` / `IHostedService` | Inject context in constructor | Create a scope per unit of work |
| `Task.WhenAll` with parallel queries | Same context for all tasks | Factory: one context per task |
| Blazor Server | Scoped context (lives for the whole circuit) | `IDbContextFactory` |

```csharp
services.AddDbContextFactory<AppDbContext>(...); // alongside or instead of AddDbContext

public class OutboxWorker(IServiceScopeFactory scopeFactory) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            // process batch...
            await db.SaveChangesAsync(ct);
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }
}
```

### 4.1 Why these pitfalls exist

Three properties of `DbContext` cause all of them:

1. **Not thread-safe.** It holds a single change tracker and a single database connection state. Two threads using it at once cause errors such as *"A second operation was started on this context instance before a previous operation completed"*, or silent data corruption in the tracker.
2. **Stateful.** It tracks every entity it loads. The longer it lives, the more memory it uses and the staler its data becomes (it may return cached tracked entities instead of fresh rows).
3. **Intended as a Unit of Work.** One context = one logical operation (usually one request).

DI lifetimes must respect this: a long-lived (Singleton) service must never hold a short-lived (Scoped) one.

### 4.2 Pitfall 1: Singleton service that needs the database (captive dependency)

**Wrong**

```csharp
services.AddSingleton<IPriceCache, PriceCache>();

public class PriceCache(AppDbContext db) : IPriceCache   // Singleton holding a Scoped service!
{
    private readonly Dictionary<int, decimal> _prices = new();

    public async Task<decimal> GetPrice(int productId)
    {
        if (!_prices.TryGetValue(productId, out var price))
        {
            price = await db.Products.Where(p => p.Id == productId)
                                     .Select(p => p.Price).FirstAsync();
            _prices[productId] = price;
        }
        return price;
    }
}
```

What goes wrong: the one `AppDbContext` is created once and lives for the entire application lifetime. Every concurrent request uses that same instance, producing concurrency exceptions under load. The change tracker also grows forever (a memory leak), and the connection state can go stale. In Development, the default DI scope validation throws *"Cannot consume scoped service 'AppDbContext' from singleton 'PriceCache'"*. In Production, scope validation is off by default, so the bug ships silently.

**Right (option A): `IServiceScopeFactory`**

```csharp
public class PriceCache(IServiceScopeFactory scopeFactory) : IPriceCache
{
    private readonly ConcurrentDictionary<int, decimal> _prices = new();

    public async Task<decimal> GetPrice(int productId, CancellationToken ct = default)
    {
        if (_prices.TryGetValue(productId, out var cached)) return cached;

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var price = await db.Products.AsNoTracking()
            .Where(p => p.Id == productId)
            .Select(p => p.Price)
            .FirstAsync(ct);

        _prices[productId] = price;
        return price;
    }
}
```

**Right (option B): `IDbContextFactory<T>`**

```csharp
// Registration: AddDbContext and AddDbContextFactory can coexist (the factory is Singleton by default;
// pass ServiceLifetime.Scoped as a second argument if the options lambda needs scoped services)
services.AddDbContextFactory<AppDbContext>(options => options.UseSqlServer(cs));

public class PriceCache(IDbContextFactory<AppDbContext> factory) : IPriceCache
{
    public async Task<decimal> GetPrice(int productId, CancellationToken ct = default)
    {
        await using var db = await factory.CreateDbContextAsync(ct);   // short-lived, you own disposal
        return await db.Products.AsNoTracking()
            .Where(p => p.Id == productId)
            .Select(p => p.Price)
            .FirstAsync(ct);
    }
}
```

Use the factory when you want the simplest "create, use, dispose" pattern with no DI scope. Use `IServiceScopeFactory` when the unit of work also needs other scoped services (a repository, `ICurrentUser`, a mediator).

**Catch it early:** turn on scope validation in every environment, including your integration-test environment:

```csharp
builder.Host.UseDefaultServiceProvider(o =>
{
    o.ValidateScopes = true;
    o.ValidateOnBuild = true;
});
```

### 4.3 Pitfall 2: `BackgroundService` / `IHostedService`

Hosted services are registered as **Singletons**, so the exact same problem applies, and it is the most common real-world version of it.

**Wrong**

```csharp
public class OutboxWorker(AppDbContext db) : BackgroundService   // captive dependency
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var batch = await db.OutboxMessages.Where(m => !m.Sent).Take(50).ToListAsync(ct);
            // ... publish ...
            await db.SaveChangesAsync(ct);
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }
}
```

What goes wrong:
- One context for the lifetime of the app: after hours, the change tracker holds thousands of entities (memory growth) and may return stale tracked data.
- If one `SaveChanges` throws (constraint violation, concurrency), the failed entities **stay tracked in the context**. Every later loop iteration retries the same bad entities and fails again forever (a "poisoned" context).
- A dropped connection state or an un-rolled-back transaction affects every later iteration.

**Right:** create a scope **per iteration (per unit of work)**, which is the `OutboxWorker` shown earlier in the code block. Every batch gets a fresh context, a clean change tracker and a clean connection state, and a failure in one batch cannot poison the next. Also wrap the loop body in `try/catch` and log, otherwise one unhandled exception stops the host.

```csharp
protected override async Task ExecuteAsync(CancellationToken ct)
{
    while (!ct.IsCancellationRequested)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            // process batch...
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Outbox batch failed");
        }
        await Task.Delay(TimeSpan.FromSeconds(5), ct);
    }
}
```

### 4.4 Pitfall 3: Parallel queries with `Task.WhenAll`

**Wrong**

```csharp
public async Task<DashboardDto> GetDashboard(CancellationToken ct)
{
    var ordersTask    = db.Orders.CountAsync(ct);
    var customersTask = db.Customers.CountAsync(ct);
    var revenueTask   = db.Orders.SumAsync(o => o.Total, ct);

    await Task.WhenAll(ordersTask, customersTask, revenueTask);   // all three on the SAME context
    return new(ordersTask.Result, customersTask.Result, revenueTask.Result);
}
```

What goes wrong: it throws `InvalidOperationException: A second operation was started on this context instance before a previous operation completed`. Even if it appears to work sometimes, it is a race condition.

**Right: one context per parallel task**

```csharp
public class DashboardService(IDbContextFactory<AppDbContext> factory)
{
    public async Task<DashboardDto> GetDashboard(CancellationToken ct)
    {
        async Task<T> Run<T>(Func<AppDbContext, Task<T>> query)
        {
            await using var db = await factory.CreateDbContextAsync(ct);
            return await query(db);
        }

        var ordersTask    = Run(db => db.Orders.CountAsync(ct));
        var customersTask = Run(db => db.Customers.CountAsync(ct));
        var revenueTask   = Run(db => db.Orders.SumAsync(o => o.Total, ct));

        await Task.WhenAll(ordersTask, customersTask, revenueTask);
        return new(ordersTask.Result, customersTask.Result, revenueTask.Result);
    }
}
```

Notes:
- Each task uses its own connection from the pool, so parallelism is bounded by your connection pool size (default 100). Don't fan out hundreds of tasks.
- Often it is simpler and fast enough to `await` the queries **sequentially** on one context. Parallelize only when profiling shows it matters.
- Parallel reads on separate contexts do not share a transaction or snapshot, so numbers may be slightly inconsistent.

### 4.5 Pitfall 4: Blazor Server

In Blazor Server, a DI "scope" is the **user's circuit**, which can live for minutes or hours across many clicks, not one request. A scoped `DbContext` injected into a component therefore becomes long-lived, with all the problems above (stale data, growing tracker, concurrent event handlers hitting the same instance).

**Right**

```csharp
@inject IDbContextFactory<AppDbContext> Factory

@code {
    private List<Order> _orders = new();

    private async Task LoadAsync()
    {
        await using var db = await Factory.CreateDbContextAsync();
        _orders = await db.Orders.AsNoTracking().Take(50).ToListAsync();
    }

    private async Task SaveAsync(Order order)
    {
        await using var db = await Factory.CreateDbContextAsync();
        db.Orders.Update(order);
        await db.SaveChangesAsync();
    }
}
```

One short-lived context per operation (load, save), never one per component.

### 4.6 Quick decision guide

| You are in... | Lifetime of the host | Get a context by |
|---|---|---|
| Controller / Minimal API / MediatR handler | Scoped (per request) | Constructor injection |
| Singleton service, `BackgroundService`, `IHostedService` | Singleton | `IServiceScopeFactory` (per unit of work) or `IDbContextFactory` |
| Parallel tasks inside one request | N/A | `IDbContextFactory`, one context per task |
| Blazor Server component | Per circuit | `IDbContextFactory`, one context per operation |
| Console app / one-off job | Whole process | `IDbContextFactory` or manual scope |

Rule of thumb: **never store a `DbContext` in a field of something that outlives a unit of work.**

---

## 5. Query and performance habits

- `AsNoTracking()` (or the global default above) for reads, and `Select` projections instead of loading full entities.
- Always pass `CancellationToken`.
- Avoid N+1: use `Include` or, better, a projection. Use `AsSplitQuery()` when including multiple collections to avoid cartesian explosion.
- Bulk operations: `ExecuteUpdateAsync` and `ExecuteDeleteAsync` (EF 7+) skip loading entities.
- Hot paths: `EF.CompileAsyncQuery`.
- Always paginate. Don't call `ToListAsync()` on unbounded sets.
- Never return `IQueryable` from your data layer to the API.

---

## 6. Transactions and concurrency

- A single `SaveChangesAsync` is already one transaction.
- With `EnableRetryOnFailure`, a manual transaction **must** go through the execution strategy, or EF throws:

```csharp
var strategy = db.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync(ct);
    // multiple SaveChanges / raw SQL
    await tx.CommitAsync(ct);
});
```

- Handle `DbUpdateConcurrencyException` for entities with a `rowversion` token, and return 409 to the client.

---

## 7. Migrations in production

Don't call `Database.Migrate()` at app startup in production. It races across multiple instances and gives the app too many DB privileges. Instead, in your GitHub Actions pipeline, generate a **migration bundle** and run it as a deploy step:

```bash
dotnet ef migrations bundle --project src/Infrastructure --startup-project src/Api --self-contained -r linux-x64 -o efbundle
./efbundle --connection "$CONNECTION_STRING"
```

An idempotent SQL script (`dotnet ef migrations script --idempotent`) is the alternative if a DBA reviews changes.

---

## 8. Observability and safety

```csharp
services.AddHealthChecks().AddDbContextCheck<AppDbContext>();   // /health

// Audit interceptor, for example CreatedAt/UpdatedAt/CreatedBy
public class AuditSaveChangesInterceptor(ICurrentUser user, TimeProvider clock) : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData e, InterceptionResult<int> result, CancellationToken ct = default)
    {
        foreach (var entry in e.Context!.ChangeTracker.Entries<IAuditable>())
        {
            if (entry.State == EntityState.Added)    entry.Entity.CreatedAt = clock.GetUtcNow();
            if (entry.State is EntityState.Added or EntityState.Modified)
                entry.Entity.UpdatedAt = clock.GetUtcNow();
        }
        return base.SavingChangesAsync(e, result, ct);
    }
}
```

- Use `LogTo` or the standard `ILogger` category `Microsoft.EntityFrameworkCore.Database.Command` at Warning in prod, and enable slow-query alerting through your APM.
- Use **global query filters** for soft delete and multi-tenancy: `builder.Entity<Order>().HasQueryFilter(o => !o.IsDeleted)`.
- Keep connection strings in secrets or environment variables, never in `appsettings.json`.

### 8.1 Health checks

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database", tags: new[] { "ready" });

app.MapHealthChecks("/health/live",  new HealthCheckOptions { Predicate = _ => false });          // process is up
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") }); // dependencies OK
```

- `AddDbContextCheck<T>` (package `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`) calls `Database.CanConnectAsync()`, so it verifies the app can actually reach the database with its configured credentials.
- Split **liveness** ("is the process running? restart if not") from **readiness** ("can it serve traffic? remove from the load balancer if not"). Don't make liveness depend on the database, or a DB outage will cause your orchestrator to restart healthy pods in a loop.
- In Docker/Kubernetes, point the probes at these endpoints. Don't expose detailed health output publicly; it reveals infrastructure details.
- You can supply a custom query via the `customTestQuery` parameter if `CanConnect` alone is too shallow.

### 8.2 Audit interceptor, explained

**What it does:** automatically stamps `CreatedAt`, `UpdatedAt` (and optionally `CreatedBy` / `UpdatedBy`) on every entity that implements `IAuditable`, so developers cannot forget and the logic is not duplicated in every handler.

**How it works, step by step**
1. EF calls `SavingChangesAsync` right *before* sending SQL.
2. `ChangeTracker.Entries<IAuditable>()` returns every tracked entity of that type along with its state (`Added`, `Modified`, `Deleted`, `Unchanged`).
3. New rows get `CreatedAt` and `UpdatedAt`; modified rows get only `UpdatedAt`.
4. The values are persisted in the same `SaveChanges` call and the same transaction.

**Supporting types**

```csharp
public interface IAuditable
{
    DateTimeOffset CreatedAt { get; set; }
    DateTimeOffset UpdatedAt { get; set; }
    string? CreatedBy { get; set; }
    string? UpdatedBy { get; set; }
}

public interface ICurrentUser { string? Id { get; } }

public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public string? Id => accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
}

// Registration
services.AddHttpContextAccessor();
services.AddScoped<ICurrentUser, CurrentUser>();
services.AddSingleton(TimeProvider.System);   // testable clock instead of DateTime.UtcNow
```

**Extending it for `CreatedBy` / `UpdatedBy`**

```csharp
if (entry.State == EntityState.Added)
{
    entry.Entity.CreatedAt = now;
    entry.Entity.CreatedBy = user.Id;
}
if (entry.State is EntityState.Added or EntityState.Modified)
{
    entry.Entity.UpdatedAt = now;
    entry.Entity.UpdatedBy = user.Id;
}
```

**Why it's a good practice**
- Single place for cross-cutting logic; it applies to *all* `SaveChanges` calls, including those in background jobs.
- `TimeProvider` (.NET 8+) lets tests inject `FakeTimeProvider` for deterministic timestamps.
- Always use **UTC**.

**Gotchas**
- It only sees **tracked** entities. With the global `NoTracking` default, make sure write paths load with tracking.
- `ExecuteUpdateAsync` / `ExecuteDeleteAsync` bypass the change tracker, so the interceptor does **not** run. Set `UpdatedAt` manually in those calls.
- The interceptor depends on a scoped service (`ICurrentUser`), so it must be resolved per scope, as in the registration in section 1. This will not work with `AddDbContextPool`.
- For a stronger audit trail (who changed *what* from *what* to *what*), extend the interceptor to write an `AuditLog` table from `entry.Properties` (`OriginalValue` / `CurrentValue`), or use a library such as Audit.EntityFramework.

### 8.3 Logging EF Core safely

EF logs under the `Microsoft.EntityFrameworkCore.*` categories. The most useful one is `Microsoft.EntityFrameworkCore.Database.Command`, which logs every SQL command with its duration.

```json
// appsettings.Production.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.EntityFrameworkCore": "Warning",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
    }
  }
}
```

```json
// appsettings.Development.json: see every SQL statement while developing
{
  "Logging": {
    "LogLevel": {
      "Microsoft.EntityFrameworkCore.Database.Command": "Information"
    }
  }
}
```

- At `Information`, every query is logged. That is great in Development but noisy and costly in Production, so keep it at `Warning` there.
- EF already emits **warnings** for risky patterns (for example, a query that may cause a cartesian explosion, or comparing nullable values incorrectly). Keeping the category at `Warning` ensures these surface.
- `EnableSensitiveDataLogging()` adds parameter values to logs. Restrict it to Development only:

```csharp
if (env.IsDevelopment())
{
    options.EnableSensitiveDataLogging();
    options.EnableDetailedErrors();
}
```

- `LogTo` is a lightweight alternative to `ILogger` for quick local debugging: `options.LogTo(Console.WriteLine, LogLevel.Information)`. Prefer `ILogger` in production so logs flow into your normal pipeline (Serilog, Seq, Application Insights, ELK).

### 8.4 Slow-query detection and alerting

Options, from simplest to richest:

**a) Use an interceptor to log slow commands yourself**

```csharp
public class SlowQueryInterceptor(ILogger<SlowQueryInterceptor> logger) : DbCommandInterceptor
{
    private static readonly TimeSpan Threshold = TimeSpan.FromMilliseconds(500);

    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken ct = default)
    {
        if (eventData.Duration > Threshold)
            logger.LogWarning("Slow query ({Ms} ms): {Sql}", eventData.Duration.TotalMilliseconds, command.CommandText);

        return base.ReaderExecutedAsync(command, eventData, result, ct);
    }
}

// options.AddInterceptors(sp.GetRequiredService<SlowQueryInterceptor>());
```

Log the SQL text and duration, **not** parameter values, to avoid leaking data.

**b) Use your APM.** Application Insights, Datadog, New Relic and Elastic APM all capture EF/SQL dependency timings automatically, and you can build alerts such as "p95 SQL duration > 1s" or "failed dependency rate > 2%".

**c) Use OpenTelemetry.** The `OpenTelemetry.Instrumentation.EntityFrameworkCore` / `SqlClient` packages emit traces and metrics for each command, which you can ship to any OTel backend and correlate with the originating HTTP request.

**d) Database-side tools.** SQL Server **Query Store** and **Extended Events** identify the worst queries over time, and are a good source of truth when the app and the database disagree.

Also useful to monitor: connection pool exhaustion (timeouts waiting for a connection), retry counts from `EnableRetryOnFailure`, deadlock counts, and `DbUpdateConcurrencyException` rates.

### 8.5 Global query filters (soft delete and multi-tenancy)

**Soft delete**

```csharp
// Entity configuration
b.HasQueryFilter(o => !o.IsDeleted);
```

Every query on `Orders` now automatically appends `WHERE IsDeleted = 0`, including navigation properties and `Include`s, so deleted rows can't leak into results by accident.

To convert real deletes into soft deletes, handle `EntityState.Deleted` in a `SaveChangesInterceptor`:

```csharp
foreach (var entry in context.ChangeTracker.Entries<ISoftDeletable>())
{
    if (entry.State == EntityState.Deleted)
    {
        entry.State = EntityState.Modified;
        entry.Entity.IsDeleted = true;
        entry.Entity.DeletedAt = clock.GetUtcNow();
    }
}
```

**Multi-tenancy**

```csharp
public class AppDbContext(DbContextOptions<AppDbContext> options, ITenantProvider tenant) : DbContext(options)
{
    private readonly Guid _tenantId = tenant.TenantId;   // captured per context instance

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<Order>().HasQueryFilter(o => o.TenantId == _tenantId);
    }
}
```

EF evaluates the `_tenantId` field **per context instance**, so each request sees only its tenant's data. This is also why this pattern requires `AddDbContext` (not `AddDbContextPool`).

**Gotchas**
- Use `.IgnoreQueryFilters()` deliberately for admin or reporting paths, and for restoring soft-deleted rows.
- Filters do **not** apply to `ExecuteUpdate`/`ExecuteDelete`-style raw SQL (`FromSqlRaw`, `ExecuteSqlRaw`), so add the tenant/deleted predicate yourself there.
- Required relationships to a filtered entity can produce surprising results (a child whose parent is filtered out). Use matching filters on related entities or make the relationship optional.
- Unique indexes should account for soft delete (for example, a filtered unique index `WHERE IsDeleted = 0`), otherwise a deleted row blocks re-creating the same value.
- Multi-tenancy via query filters is a convenience, not a security boundary on its own. Combine it with authorization checks, and consider row-level security in the database for stricter isolation.

### 8.6 Secrets and connection strings

- **Never** commit real connection strings to `appsettings.json` or source control.
- Local development: `dotnet user-secrets set "ConnectionStrings:Default" "<value>"`.
- Production: environment variables (`ConnectionStrings__Default`, with a double underscore for the colon), or a vault: Azure Key Vault, AWS Secrets Manager, HashiCorp Vault. In GitHub Actions, use encrypted **Secrets** and inject them at deploy time.
- Prefer **passwordless / managed identity** authentication where available (for example Azure SQL with Entra ID managed identity), so there is no password to leak at all.
- Give the application's database login the **least privilege** it needs (read/write on its schema; no `db_owner`, no DDL). Run migrations with a separate, more privileged identity from the pipeline (see section 7).
- Use `Encrypt=True` and a valid certificate in the connection string; avoid `TrustServerCertificate=True` in production.

---

## 9. SingleQuery vs SplitQuery: Detailed Comparison

> ⬅️ Back to the explanation of the setting: [1.3 Deep dive: UseQuerySplittingBehavior](#13-deep-dive-usequerysplittingbehavior) · Registration line: [1.1 Registration explained](#11-explanation-of-each-point-in-the-registration)

This section uses one small, concrete data set so you can see exactly what each strategy returns.

**Sample data**

| Orders | | |
|---|---|---|
| Id | Customer | |
| 1 | Alice | |

| OrderItems (3 rows) | | | |
|---|---|---|---|
| Id | OrderId | Product | Price |
| 1 | 1 | Keyboard | 5000 |
| 2 | 1 | Mouse | 2000 |
| 3 | 1 | Cable | 500 |

| Payments (2 rows) | | | |
|---|---|---|---|
| Id | OrderId | Method | Amount |
| 1 | 1 | UPI | 5000 |
| 2 | 1 | Card | 2000 |

### 9.1 `AsSingleQuery()`: one JOIN, duplicated data

```csharp
var order = context.Orders
    .Include(o => o.Items)
    .Include(o => o.Payments)
    .AsSingleQuery()
    .Single(o => o.Id == 1);
```

One SQL statement:

```sql
SELECT o.Id, o.Customer, i.Id, i.Product, i.Price, p.Id, p.Method, p.Amount
FROM Orders o
LEFT JOIN OrderItems i ON i.OrderId = o.Id
LEFT JOIN Payments  p ON p.OrderId = o.Id
WHERE o.Id = 1
ORDER BY o.Id, i.Id, p.Id
```

Result set (3 items × 2 payments = **6 rows**):

| Order Id | Customer | Item Id | Product | Payment Id | Method |
|---|---|---|---|---|---|
| 1 | Alice | 1 | Keyboard | 1 | UPI |
| 1 | Alice | 1 | Keyboard | 2 | Card |
| 1 | Alice | 2 | Mouse | 1 | UPI |
| 1 | Alice | 2 | Mouse | 2 | Card |
| 1 | Alice | 3 | Cable | 1 | UPI |
| 1 | Alice | 3 | Cable | 2 | Card |

Notice that "Alice" is repeated 6 times, "Keyboard" twice, and "UPI" three times. EF has to de-duplicate this back into 1 order, 3 items and 2 payments.

### 9.2 `AsSplitQuery()`: same data, no duplication

#### The query

```csharp
var order = context.Orders
    .Include(o => o.Items)
    .Include(o => o.Payments)
    .AsSplitQuery()
    .Single(o => o.Id == 1);
```

#### 3 separate SQL statements executed

> Shown in simplified form. The SQL EF actually generates joins back to `Orders` in queries 2 and 3 so the parent filter and ordering apply, but the rows returned are the same.

**Query 1: Parent**
```sql
SELECT o.Id, o.Customer
FROM Orders o
WHERE o.Id = 1
```
| Id | Customer |
|----|----------|
| 1 | Alice |

→ **1 row**

**Query 2: Items**
```sql
SELECT i.Id, i.OrderId, i.Product, i.Price
FROM OrderItems i
WHERE i.OrderId = 1
```
| Id | OrderId | Product | Price |
|----|---------|---------|-------|
| 1 | 1 | Keyboard | 5000 |
| 2 | 1 | Mouse | 2000 |
| 3 | 1 | Cable | 500 |

→ **3 rows**

**Query 3: Payments**
```sql
SELECT p.Id, p.OrderId, p.Method, p.Amount
FROM Payments p
WHERE p.OrderId = 1
```
| Id | OrderId | Method | Amount |
|----|---------|--------|--------|
| 1 | 1 | UPI | 5000 |
| 2 | 1 | Card | 2000 |

→ **2 rows**

#### Total: **1 + 3 + 2 = 6 rows** (vs 6 rows in single query for this small case, but the difference explodes at scale)

### 9.3 Scale comparison (50 items, 20 payments, 100 orders)

| Strategy | SQL statements | Total rows returned |
|----------|---------------|-------------------|
| `SingleQuery` | 1 | 100 × 50 × 20 = **100,000** |
| `AsSplitQuery()` | 3 | 100 + 5,000 + 2,000 = **7,100** |

**~14× fewer rows** transferred over the network. On top of that, each of the 100,000 single-query rows also repeats the parent's columns, so the byte difference is larger than the row difference.

How the growth behaves as you add data:

| Items per order | Payments per order | SingleQuery rows per order | SplitQuery rows per order |
|---|---|---|---|
| 3 | 2 | 6 | 1 + 3 + 2 = 6 |
| 10 | 5 | 50 | 16 |
| 50 | 20 | 1,000 | 71 |
| 200 | 100 | 20,000 | 301 |

SingleQuery grows as **items × payments**; SplitQuery grows as **items + payments**.

### 9.4 Side-by-side comparison

| | `SingleQuery` | `AsSplitQuery()` |
|--|-------------|--------------|
| SQL statements | 1 | 1 + one per collection include |
| Round trips | 1 | 3 in the example above |
| Rows at scale | N × M × P (multiplicative) | N + M + P (additive) |
| Duplicate parent/child data over the wire | Yes | No |
| Memory and CPU to materialize | Higher at scale (de-duplication) | Lower at scale |
| Consistent snapshot | Yes, one statement | Not by default; use a transaction (Snapshot isolation) if needed |
| Sensitive to DB latency | Low (one round trip) | Higher (extra round trips) |
| Needs deterministic `OrderBy` with paging | Recommended | Required for correct results |
| Cartesian explosion risk | **Yes** with 2+ collections | No |
| EF warning | `MultipleCollectionIncludeWarning` | None |
| Best when | Small collections, 1 collection include | Multiple includes, large collections |
| How to choose per query | `.AsSingleQuery()` | `.AsSplitQuery()` |
| How to set the app-wide default | `QuerySplittingBehavior.SingleQuery` (EF default) | `sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)` |

### 9.5 Mixing strategies: one collection in the main query, one separate

> **Important:** EF Core's split behavior is chosen **per query**, with `AsSplitQuery()` or `AsSingleQuery()`. There is no per-`Include` option (something like `.Include(o => o.Payments).SplitQuery()` does **not** exist). A query is either single or split as a whole.

If you want one small collection in the main query and a large one loaded separately, use **explicit loading** for the large one:

```csharp
// Items come with the parent in one query (small collection)
var order = await context.Orders
    .AsTracking()                                   // explicit loading requires a tracked entity
    .Include(o => o.Items)
    .SingleAsync(o => o.Id == 1, ct);

// Payments are loaded with a second, separate query
await context.Entry(order)
    .Collection(o => o.Payments)
    .LoadAsync(ct);
```

This runs two statements: parent plus items in one JOIN (no explosion, because only one collection is joined), then payments on their own. Note that `AsTracking()` is needed because the global default in section 1 is `NoTracking`.

An alternative is a projection, which usually beats both:

```csharp
var dto = await context.Orders
    .Where(o => o.Id == 1)
    .Select(o => new OrderDetailDto(
        o.Id,
        o.Customer,
        o.Items.Select(i => new ItemDto(i.Product, i.Price)).ToList(),
        o.Payments.Select(p => new PaymentDto(p.Method, p.Amount)).ToList()))
    .SingleAsync(ct);
```

### 9.6 Choosing between them

| Situation | Choice |
|---|---|
| 2+ collection includes, or any large collection | `AsSplitQuery()` (or set it as the global default) |
| Exactly one small collection include | `AsSingleQuery()` |
| You need a consistent snapshot and can't use a transaction | `AsSingleQuery()` |
| Database is far from the app, and collections are small | `AsSingleQuery()` (fewer round trips) |
| Large collection plus a small one | Split the whole query, or use explicit loading (9.5) |
| Read endpoint returning a DTO | Projection with `Select`, no `Include` |

> ⬅️ Back to: [1.3 Deep dive: UseQuerySplittingBehavior](#13-deep-dive-usequerysplittingbehavior)

---

## Quick checklist

- [ ] Scoped context, never singleton
- [ ] `IApplicationDbContext` abstraction in Application layer
- [ ] Config via `IEntityTypeConfiguration`
- [ ] `EnableRetryOnFailure` plus `CreateExecutionStrategy` for manual transactions
- [ ] No-tracking reads, projections, pagination, `CancellationToken` everywhere
- [ ] Factory or scope for background jobs and parallel work
- [ ] Migration bundle in CI/CD, not at startup
- [ ] Health check, audit interceptor, concurrency tokens
- [ ] `AddDbContext` by default; pooling only after profiling and only with a stateless context
- [ ] `ValidateScopes` / `ValidateOnBuild` enabled to catch captive dependencies
- [ ] Sensitive-data logging off in Production; slow-query alerting in place
- [ ] Secrets from environment/vault, least-privilege DB login
- [ ] Queries with 2+ collection `Include`s use `AsSplitQuery()` (or a global `SplitQuery` default); read endpoints prefer projections (see section 9)
