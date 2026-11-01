# Dependency Injection (DI)

Dependency Injection (DI) is a design pattern used to achieve loose coupling between classes.
Instead of a class creating its dependencies directly, the dependencies are injected (provided) from the
outside.

A class should not create its own dependencies; they should be provided to it.

## Without Dependency Injection (Tight Coupling)

Let's say we have a `CustomerService` class that needs `EmailService` to send emails.

```csharp
public class EmailService
{
    public void SendEmail(string message)
    {
        Console.WriteLine($"Email sent: {message}");
    }
}

public class CustomerService
{
    private EmailService _emailService;

    public CustomerService()
    {
        // tightly coupled — CustomerService decides which EmailService to use
        _emailService = new EmailService();
    }

    public void RegisterCustomer(string name)
    {
        Console.WriteLine($"Customer {name} registered!");
        _emailService.SendEmail("Welcome " + name);
    }
}
```

**Problems:**

- `CustomerService` depends directly on `EmailService`.
- You can't easily replace `EmailService` (e.g., with `SmsService` or a mock for testing).
- Harder to maintain and test.

## With Dependency Injection (Loose Coupling)

We introduce an abstraction (interface) and let something else (like .NET's DI container) provide the
implementation.

```csharp
public interface IEmailService
{
    void SendEmail(string message);
}

public class EmailService : IEmailService
{
    public void SendEmail(string message)
    {
        Console.WriteLine($"Email sent: {message}");
    }
}

public class CustomerService
{
    private readonly IEmailService _emailService;

    // Dependency is injected via constructor
    public CustomerService(IEmailService emailService)
    {
        _emailService = emailService;
    }

    public void RegisterCustomer(string name)
    {
        Console.WriteLine($"Customer {name} registered!");
        _emailService.SendEmail("Welcome " + name);
    }
}
```

Now we don't create `EmailService` inside `CustomerService`.
It's injected (supplied) by an external mechanism — like a DI Container.

> **Note:** Now it can be replaced by an SMS service class, by creating a class like
> `public class SmsService : IEmailService` and passing it into the constructor `CustomerService(IEmailService emailService)`.

# Why Use Dependency Injection?

| **Benefit**                | **Explanation**                                                    |
| -------------------------- | ------------------------------------------------------------------ |
| **Loose Coupling**         | Classes depend on abstractions, not concrete classes.              |
| **Easier Testing**         | You can inject mock or fake dependencies in unit tests.            |
| **Better Maintainability** | You can change implementations without touching other classes.     |
| **Reusability**            | Components are more reusable and interchangeable.                  |
| **Cleaner Code**           | Reduces boilerplate and object creation logic in business classes. |

# How DI Works in .NET Core

In .NET Core, Dependency Injection is built-in.
We configure dependencies in the Service Container (via `IServiceCollection`) and the framework automatically
injects them where required.

## Example — Built-in DI in .NET Core Console App

### Step 1: Create the interfaces and classes

```csharp
public interface IMessageService
{
    void Send(string message);
}

public class EmailService : IMessageService
{
    public void Send(string message)
    {
        Console.WriteLine($"Email sent: {message}");
    }
}

public class SmsService : IMessageService
{
    public void Send(string message)
    {
        Console.WriteLine($"SMS sent: {message}");
    }
}

public class NotificationManager
{
    private readonly IMessageService _messageService;

    public NotificationManager(IMessageService messageService)
    {
        _messageService = messageService;
    }

    public void Notify(string message)
    {
        _messageService.Send(message);
    }
}
```

### Step 2: Register dependencies in the DI Container

```csharp
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();

// Register dependencies
services.AddTransient<IMessageService, EmailService>();
services.AddTransient<NotificationManager>();

var provider = services.BuildServiceProvider();

// Resolve NotificationManager — dependencies are automatically injected
var notifier = provider.GetRequiredService<NotificationManager>();
notifier.Notify("Hello from DI!");
```

**Output:**

```text
Email sent: Hello from DI!
```

### Step 3: Changing Implementation Easily

You can switch implementation without touching other code:

```csharp
services.AddTransient<IMessageService, SmsService>();
```

Now the output becomes:

```text
SMS sent: Hello from DI!
```

That's the power of DI 💪 — your business logic (`NotificationManager`) didn't change at all.

# Example + Explained

**1. Register service**

```csharp
// 🔑 Register services
services.AddTransient<IMessageService, EmailService>();
services.AddTransient<NotificationManager>();

Services = services.BuildServiceProvider();

var Obj = Services.GetRequiredService<NotificationManager>();
```

**2. When this line runs:**

```csharp
var Obj = Services.GetRequiredService<NotificationManager>();
```

DI does:

- Sees `NotificationManager` needs `IMessageService`
- Looks up registration: `services.AddTransient<IMessageService, EmailService>();`
- Creates `EmailService`
- Passes it into the constructor
- `Obj` is an object of class `NotificationManager`

✨ Automatic constructor injection

# 🧩 How It Works Internally

Simplified flow:

- You register dependencies in the DI container:

```csharp
services.AddTransient<IEmailService, EmailService>();
```

- When you request a class (e.g., `CustomerService`), .NET:
  - Scans its constructor.
  - Finds what dependencies it needs.
  - Automatically creates and injects those dependencies.
- You get a fully constructed object.

# DI Lifetimes in .NET

| Lifetime      | Description                                 | Example Use                     |
| ------------- | ------------------------------------------- | ------------------------------- |
| **Transient** | New instance every time it's requested      | Lightweight, stateless services |
| **Scoped**    | One instance per request (in web apps)      | Web request-specific data       |
| **Singleton** | Single instance for the entire app lifetime | Logging, configuration, caching |

**Example:**

```csharp
services.AddTransient<IEmailService, EmailService>();
services.AddScoped<IRepository, Repository>();
services.AddSingleton<ILogger, Logger>();
```

# What is a "Type" of Dependency Injection?

There are 3 main types of Dependency Injection in C# (and in general software design):

| **Type**                     | **How Dependency is Injected**             | **When Used**                                          |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| **1. Constructor Injection** | Through the class **constructor**          | Most common; preferred in .NET Core                    |
| **2. Property Injection**    | Through a **public property** of the class | When dependency is optional or changeable              |
| **3. Method Injection**      | Through a **method parameter**             | When dependency is used only within a single method    |

We have seen Constructor Injection.

## 2. Property Injection

Dependencies are provided via a public property (setter).

**Used when:**

- Dependency is optional, or
- May change after object creation.

e.g.:

```csharp
public class NotificationManager
{
    // Property Injection
    public IEmailService? EmailService { get; set; }

    public void Notify(string msg)
    {
        EmailService?.SendEmail(msg);
    }
}
```

**Drawbacks**

- The dependency might not be set (can lead to null reference errors).
- Harder to enforce dependencies at compile-time.
- Not recommended for critical dependencies (use constructor injection instead).

## 3. Method Injection

Dependencies are provided as parameters to a method.

**Example**

```csharp
public class NotificationManager
{
    // Method Injection
    public void Notify(string msg, IEmailService emailService)
    {
        emailService.SendEmail(msg);
    }
}
```

**When to Use**

- When a dependency is used only once, or
- When it's not needed throughout the lifetime of the class.

**Drawback**

- Can become messy if many methods require multiple dependencies.
- Doesn't store the dependency for reuse.

# If for the same interface we have two implementation classes, which one does constructor injection get?

Constructor injection receives the last registered implementation for that interface, unless you ask for multiple
implementations explicitly.

## Detailed Explanation

**Scenario**

```csharp
public interface ILogger
{
    void Log(string message);
}

public class FileLogger : ILogger { }
public class DbLogger : ILogger { }
```

### 1. Multiple Registrations for Same Interface

```csharp
services.AddTransient<ILogger, FileLogger>();
services.AddTransient<ILogger, DbLogger>();
```

**Constructor Injection**

```csharp
public class MyService
{
    public MyService(ILogger logger)
    {
        // Which one?
    }
}
```

✅ **Result**

👉 `DbLogger` (the last registered) is injected.

**Why?**

- Microsoft DI container resolves one service
- Last registration wins
- No ambiguity error is thrown

### 2. Getting ALL Implementations (Recommended Pattern)

```csharp
public class MyService
{
    public MyService(IEnumerable<ILogger> loggers)
    {
        foreach (var logger in loggers)
        {
            logger.Log("Hello");
        }
    }
}
```

**Result**

Injection order:

```text
FileLogger
DbLogger
```

✔️ Order = registration order

# DI Lifetimes in .NET: Scoped, Transient, Singleton

These three lifetimes control how long a service instance lives and how many instances get created. Getting this wrong causes subtle bugs — memory
leaks, stale data, shared state corruption.

## The core idea

When you register a service with the DI container, you're telling it: "Every time someone asks for this, give them..."

- **Singleton** → the same instance, always, for the entire app lifetime
- **Scoped** → the same instance within a single HTTP request (or scope), but a new one per request
- **Transient** → a brand new instance every single time it's requested

## Deep dive

### Singleton

Registered once, lives forever. The container creates it on first request and caches it. Thread-safety is your responsibility — multiple requests can
hit the same instance simultaneously.

```csharp
builder.Services.AddSingleton<IEmailConfig, EmailConfig>();
```

**Use for:** configuration objects, in-memory caches, connection pool managers, HttpClient factories — things that are expensive to create and safe to share.

**Danger:** if you inject a Scoped or Transient dependency into a Singleton, that dependency gets "captured" — it lives as long as the singleton
(forever), which is called a captive dependency bug. The DI container throws an `InvalidOperationException` by default in Development mode if it detects
this.

### Scoped

Created once per request (or per `IServiceScope`). Two components resolving the same scoped service within the same request get the same object. A new
request gets a new instance.

```csharp
builder.Services.AddScoped<IUserContext, UserContext>();
builder.Services.AddScoped<AppDbContext>();
```

**Use for:** `DbContext` (Entity Framework), Unit of Work, anything that holds per-request state like the current user. This is the most common lifetime in
web APIs.

**Danger:** never resolve a Scoped service from a Singleton — captive dependency. Also, don't use Scoped services in background tasks (`IHostedService`)
without manually creating a scope first.

### Transient

A new instance created every time it's injected or resolved from the container. No shared state, no coordination required.

```csharp
builder.Services.AddTransient<IOrderProcessor, OrderProcessor>();
```

**Use for:** lightweight, stateless services — validators, mappers, formatters. Services where you explicitly don't want shared state.

**Danger:** if a Transient service holds unmanaged resources (implements `IDisposable`), the container disposes it at the end of the scope (not immediately
after use), which can accumulate many open handles within a single request.

## The Captive Dependency trap

This is the #1 lifetime bug. A longer-lived service holds a reference to a shorter-lived one, defeating the purpose of the shorter lifetime:

```csharp
// BUG: Singleton captures a Scoped service

public class MySingleton
{
    private readonly IScopedService _scoped; // This instance lives forever now!
    public MySingleton(IScopedService scoped) => _scoped = scoped;
}
```

The `IServiceScopeFactory` pattern is the correct fix when a Singleton genuinely needs to do scoped work.

**Manual scope creation (background services)**

```csharp
public class MyBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _factory;
    public MyBackgroundService(IServiceScopeFactory factory) => _factory = factory;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var scope = _factory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // db is now properly scoped to this block
    }
}
```

Now here's the interactive visual:

## Scoped vs Transient

The key question to ask yourself:

> "Within the same request, do I want two components to share the same instance?"

- Yes → **Scoped**
- No → **Transient**

**Concrete example: Same request, two services inject the same dependency**

Imagine you have `ServiceA` and `ServiceB`, both injected into the same controller. Both need `ICounter`.

```csharp
public interface ICounter
{
    int Id { get; }
}

public class Counter : ICounter
{
    private static int _next = 0;
    public int Id { get; } = Interlocked.Increment(ref _next);
}

public class ServiceA
{
    public ICounter Counter { get; }
    public ServiceA(ICounter counter) => Counter = counter;
}

public class ServiceB
{
    public ICounter Counter { get; }
    public ServiceB(ICounter counter) => Counter = counter;
}

[ApiController]
public class TestController : ControllerBase
{
    private readonly ServiceA _a;
    private readonly ServiceB _b;

    public TestController(ServiceA a, ServiceB b)
    {
        _a = a;
        _b = b;
    }

    [HttpGet("/test")]
    public IActionResult Get()
    {
        return Ok(new {
            ServiceA_CounterId = _a.Counter.Id,
            ServiceB_CounterId = _b.Counter.Id
        });
    }
}
```

**What happens with each lifetime?**

If `ICounter` is **Transient**:

```text
Request 1:  ServiceA gets Counter #1,  ServiceB gets Counter #2   ← different
Request 2:  ServiceA gets Counter #3,  ServiceB gets Counter #4   ← different
```

If `ICounter` is **Scoped**:

```text
Request 1:  ServiceA gets Counter #1,  ServiceB gets Counter #1   ← SAME
Request 2:  ServiceA gets Counter #2,  ServiceB gets Counter #2   ← SAME (but new from req 1)
```

If `ICounter` is **Singleton**:

```text
Request 1:  ServiceA gets Counter #1,  ServiceB gets Counter #1   ← SAME
Request 2:  ServiceA gets Counter #1,  ServiceB gets Counter #1   ← SAME (forever)
```

## Why does this matter in real code?

The `DbContext` example — the most important one in your day-to-day:

```csharp
// Both registered as Scoped (EF Core default)
builder.Services.AddScoped<AppDbContext>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
```

Within one request:

```csharp
public class OrderService
{
    private readonly IOrderRepository _orders;
    private readonly IProductRepository _products;

    public OrderService(IOrderRepository orders, IProductRepository products)
    {
        _orders = orders;
        _products = products;
    }

    public async Task PlaceOrder(int productId, int qty)
    {
        var product = await _products.GetById(productId); // uses DbContext #1
        var order   = new Order { ProductId = productId, Qty = qty };

        await _orders.Add(order);  // uses SAME DbContext #1
        // SaveChanges sees BOTH changes — product read + order insert
        // This only works because they share the same DbContext instance
    }
}
```

If `DbContext` were Transient, `_orders` and `_products` would each hold a different `DbContext`. Change tracking breaks. Transactions break. You'd have two
separate connections open for one request.

## DI lifetime dangers, explained with examples
**Note : Gone through it after once you have idea that how request life cycle works**

The central rule is:

> A service must not hold a dependency for longer than that dependency is intended to live.

| Consumer ↓ / Dependency → | Singleton | Scoped | Transient |
| ------------------------- | --------- | ------ | --------- |
| **Singleton**             | OK        | Captive dependency | Captured instance behaves like a singleton |
| **Scoped**                | OK        | OK     | OK |
| **Transient**             | OK        | OK when resolved inside a scope | OK |

### Singleton dangers

#### Shared mutable state is not thread-safe

A singleton can serve many requests at the same time. Any mutable state it owns must be safe for concurrent access.

```csharp
public class VisitCounter
{
    private int _count;
    public int Increment() => ++_count; // Not atomic
}
```

`++_count` is a read, increment, and write. Two requests can read the same value and overwrite each other's update. A plain `Dictionary` or `List` modified by multiple threads can also corrupt data or throw.

Use an atomic operation for a simple counter, a concurrent collection for concurrent updates, or a `lock` for compound operations:

```csharp
public class VisitCounter
{
    private int _count;
    public int Increment() => Interlocked.Increment(ref _count);
}

public class ProductCache
{
    private readonly ConcurrentDictionary<int, Product> _cache = new();
}
```

Prefer keeping singletons stateless or immutable where possible.

#### Captive Scoped dependency

`AddDbContext` registers a context as Scoped by default. Injecting it into a Singleton makes the Singleton retain one context beyond its intended scope:

```csharp
builder.Services.AddDbContext<AppDbContext>();
builder.Services.AddSingleton<ReportCache>();

public class ReportCache
{
    private readonly AppDbContext _db;
    public ReportCache(AppDbContext db) => _db = db;
}
```

This can cause concurrent operations on a non-thread-safe `DbContext`, stale tracked entities, growing tracked state, or incorrect per-request data (such as retaining the first request's user identity). The context's database connection is generally opened for individual operations, rather than held open continuously.

With scope validation enabled, the container reports this lifetime mismatch:

```text
InvalidOperationException: Cannot consume scoped service 'AppDbContext' from singleton 'ReportCache'.
```

Choose the fix that matches the work:

- Change `ReportCache` to Scoped if it does not need to be a Singleton.
- Inject `IDbContextFactory<AppDbContext>` and create a short-lived context for each operation.
- Inject `IServiceScopeFactory` and create a scope for each unit of scoped work:

```csharp
public class ReportCache
{
    private readonly IServiceScopeFactory _scopeFactory;
    public ReportCache(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    public async Task<int> CountAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Reports.CountAsync();
    }
}
```

#### Transient captured by a Singleton

The built-in container's scope validation detects Scoped dependencies captured by a Singleton, but does not reject a Transient dependency in the same way:

```csharp
builder.Services.AddTransient<IPriceCalculator, PriceCalculator>();
builder.Services.AddSingleton<OrderService>();

public class OrderService
{
    public OrderService(IPriceCalculator calculator) { }
}
```

The Singleton gets one calculator when it is constructed and retains that instance. It no longer behaves like a newly created Transient for each use. If the calculator has mutable state or is not thread-safe, the problem can be silent. Use a factory or resolve the dependency within a scope when a fresh instance is required.

### Scoped dangers

#### Resolving a Scoped service from the root provider

Resolving a Scoped service directly from the root provider effectively retains it until the root provider is disposed. With scope validation enabled, this throws instead:

```csharp
var provider = services.BuildServiceProvider();
var db = provider.GetRequiredService<AppDbContext>();
```

Create and use an explicit scope:

```csharp
using var scope = provider.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
```

#### Scoped services in background work

Hosted services (`IHostedService` and `BackgroundService`) are singletons, and there is no HTTP request scope for their work. Do not inject a Scoped `DbContext` into the hosted service constructor. Create a scope for each unit of work so its services are disposed before the next iteration:

```csharp
public class CleanupWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    public CleanupWorker(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            using (var scope = _scopeFactory.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.Logs.RemoveRange(db.Logs.Where(log => log.IsOld));
                await db.SaveChangesAsync(ct);
            }

            await Task.Delay(TimeSpan.FromMinutes(5), ct);
        }
    }
}
```

#### Sharing scoped state across parallel tasks

A Scoped service is shared throughout its scope. Running parallel operations in one request with the same `DbContext` can trigger the context's thread-safety exception. For parallel work, create a separate scope (and therefore a separate context) for each task.

### Transient dangers

#### Disposable Transients accumulate until the scope ends

The container tracks disposable services it creates and disposes them when their scope ends, not immediately after each use. Resolving a disposable Transient repeatedly in one request can therefore retain many resources until the request finishes:

```csharp
builder.Services.AddTransient<FileExporter>();

public class ReportService
{
    private readonly IServiceProvider _services;
    public ReportService(IServiceProvider services) => _services = services;

    public void ExportAll(IEnumerable<string> rows)
    {
        foreach (var row in rows)
        {
            var exporter = _services.GetRequiredService<FileExporter>();
            exporter.Export(row);
        }
    }
}
```

For a large loop, this can mean many open file handles or other resources at once. Options include reusing one instance, creating a scope per iteration, or using a factory where your code owns and disposes the created instance. Do not manually dispose an object that the container created and owns.

#### Disposable Transients resolved from the root

A disposable Transient resolved from the root provider remains tracked by that provider until application shutdown. Repeated resolutions can retain resources for the lifetime of the app:

```csharp
public class Worker
{
    private readonly IServiceProvider _root;
    public Worker(IServiceProvider root) => _root = root;

    public void DoWork()
    {
        var exporter = _root.GetRequiredService<FileExporter>();
        exporter.Export("data");
    }
}
```

Resolve it inside a scope instead, so the instance is disposed when the scope ends.

#### Expensive construction

Transient services are recreated each time they are resolved. If a stateless Transient has an expensive constructor and is requested frequently, consider whether it should be shared or whether its expensive work should be moved elsewhere.

### Catch lifetime bugs early

Enable scope and build validation so the container can report lifetime mismatches and missing registrations early:

```csharp
builder.Host.UseDefaultServiceProvider(options =>
{
    options.ValidateScopes = true;
    options.ValidateOnBuild = true;
});
```

For `WebApplication`, both validations are enabled by default in Development, but not generally in Production. Scope validation does not detect a Transient captured by a Singleton.

### Lifetime danger summary

| Lifetime | Danger | Typical symptom | Safer approach |
| -------- | ------ | --------------- | -------------- |
| Singleton | Mutable shared state | Lost updates or concurrent collection errors | Use atomic operations, locks, concurrent collections, or immutable state |
| Singleton | Scoped dependency captured | Validation exception, stale state, or concurrent `DbContext` use | Use a scope or `IDbContextFactory`, or change the Singleton's lifetime |
| Singleton | Transient dependency captured | Transient silently retained for the Singleton's lifetime | Use a factory or resolve within a scope |
| Scoped | Resolved from root | Behaves like a Singleton or throws with validation | Always create a scope |
| Scoped | Used in a background service | Captive context or incorrect state | Create a scope for each unit of work |
| Scoped | Shared across parallel operations | Thread-safety errors, especially with `DbContext` | Use a separate scope per parallel task |
| Transient | Disposable instances repeatedly resolved in a scope | Resource buildup until the scope ends | Reuse, scope each unit of work, or own the created instance |
| Transient | Disposable instance resolved from root | Resources retained until application shutdown | Resolve inside a scope |

> **In short:** Keep shared Singleton state thread-safe, and ensure services and disposable dependencies are resolved and disposed within the scope that matches their work.
