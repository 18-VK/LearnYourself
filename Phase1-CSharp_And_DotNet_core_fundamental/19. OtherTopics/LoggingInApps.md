# Logging in .NET

In .NET, `ILogger` is an abstraction.
How the log looks depends on where it's written (Console, Debug, File, App Insights, etc.).

## Logging levels

.NET's `Microsoft.Extensions.Logging` uses 6 built-in levels:

- **Trace** — extremely detailed, diagnostic (very noisy; usually off in prod).
- **Debug** — information useful to developers while debugging.
- **Information** — normal runtime events (startup/shutdown, user actions).
- **Warning** — something unexpected but recoverable (degraded behavior).
- **Error** — an operation failed (exceptions you handle or report).
- **Critical** — application crash or unrecoverable failure.

Use the appropriate level to control verbosity and cost.

## ILogger and helper methods

`ILogger` exposes generic `Log` and convenient typed methods:

- `_logger.Log(LogLevel level, EventId id, Exception ex, string message, params object[] args)` — low-level call.
- Convenience methods: `_logger.LogTrace(...)`, `_logger.LogDebug(...)`, `_logger.LogInformation(...)`, `_logger.LogWarning(...)`,
  `_logger.LogError(...)`, `_logger.LogCritical(...)`.
- `ILogger<T>` is the common pattern for DI to get a logger instance tied to your class.

**Example:**

```csharp
public class OrderService
{
    private readonly ILogger<OrderService> _logger;

    public OrderService(ILogger<OrderService> logger)
    {
      _logger = logger;  
    }

    public void PlaceOrder(Order order)
    {
        _logger.LogInformation("Placing order {OrderId} for {Customer}", order.Id, order.CustomerId);
        try
        {
            // process
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to place order {OrderId}", order.Id);
        }
    }
}
```

> **Note:** Structured logging (message templates)

Always prefer message templates with placeholders, not string interpolation:

```csharp
// Good — structured
_logger.LogInformation("User {UserId} uploaded file {FileName} ({Size} bytes)", userId, fileName, size);

// Bad — loses structure, may evaluate even if log disabled
_logger.LogDebug($"User {userId} uploaded file {fileName} size {ExpensiveSizeCalc()}");
```

## Exception logging

Include the exception object to capture stack trace and exception details:

```csharp
try { /* ... */ }
catch (Exception ex)
{
    _logger.LogError(ex, "Error while processing item {ItemId}", itemId);
}
```

`LogError(ex, ...)` stores the exception stack trace and inner exceptions for downstream sinks.

## Checking IsEnabled for expensive operations

If you need to compute expensive values only when a level is enabled:

```csharp
if (_logger.IsEnabled(LogLevel.Debug))
{
    var heavy = ComputeHeavyState();
    _logger.LogDebug("Heavy state: {State}", heavy);
}
```

## Logger scopes and structured state example

```csharp
using var scope = _logger.BeginScope("Order {OrderId}", orderId);
_logger.LogInformation("Step 1: validation");
_logger.LogInformation("Step 2: saving to DB");
```

## Configuring logging (Generic Host / Console app)

Simple .NET Core host example using built-in providers:

```csharp
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureLogging(logging =>
    {
        logging.ClearProviders();
        logging.AddConsole();       // console output
        logging.AddDebug();         // Visual Studio debug output
        logging.SetMinimumLevel(LogLevel.Information);
    })
    .ConfigureServices((ctx, services) =>
    {
        services.AddTransient<OrderService>();
    })
    .Build();

var svc = host.Services.GetRequiredService<OrderService>();
svc.PlaceOrder(...);
await host.RunAsync();
```

> **Note:** the built-in providers do not include a file provider — use a third-party provider (Serilog, NLog, etc.) for robust file/sink features.

# Writing logs to files — recommended approach : Serilog (recommended, easy and powerful)

Do not implement your own file append strategy for production logging. Use a mature provider:

## Example

```csharp
using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/myapp-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    var host = Host.CreateDefaultBuilder(args)
        .UseSerilog() // <-- replaces Microsoft logger with Serilog
        .ConfigureServices((ctx, services) => { /* ... */ })
        .Build();

    await host.RunAsync();
}
finally
{
    Log.CloseAndFlush();
}
```

## WPF: where to configure logging

WPF apps can also use the Generic Host pattern to get DI & logging in a WPF app:

```csharp
// App.xaml.cs OnStartup
var host = Host.CreateDefaultBuilder()
    .ConfigureServices((context, services) =>
    {
        services.AddSingleton<MainWindow>();
        services.AddTransient<MyViewModel>();
    })
    .UseSerilog() // optional : if no file logging
    .Build();

var main = host.Services.GetRequiredService<MainWindow>();
main.Show();
```

> **Note:** This gives you `ILogger<T>` by DI in viewmodels/services.

## MinimumLevel — What logs are allowed to be written

**What it means**

`MinimumLevel` defines the lowest severity level that Serilog will record.

Any log below this level is ignored (not written anywhere).

**Log level order (low → high)**

- Verbose (same as Trace)
- Debug
- Information
- Warning
- Error
- Fatal (same as Critical)

If you set:

```csharp
.MinimumLevel.Information()
```

Then Serilog will log:

- ✅ Information
- ✅ Warning
- ✅ Error
- ✅ Fatal

And it will ignore:

- ❌ Debug
- ❌ Verbose

**Logging code**

```csharp
Log.Verbose("Very detailed trace");
Log.Debug("Debugging info");
Log.Information("App started");
Log.Warning("Low disk space");
Log.Error("Database failed");
```

**Output**

```text
App started
Low disk space
Database failed
```

`Verbose` and `Debug` are not even evaluated.

### Per-sink minimum level (advanced but important)

You can override per output:

```csharp
.WriteTo.Console(restrictedToMinimumLevel: LogEventLevel.Information)
.WriteTo.File("logs/app.log", restrictedToMinimumLevel: LogEventLevel.Warning)
```

Console gets more logs, file stores only warnings+.

## Typical configuration

| Environment | MinimumLevel          |
| ----------- | --------------------- |
| Development | Debug                 |
| QA          | Information           |
| Production  | Warning / Information |

## More things

You can write:

```csharp
ILogger logger;
```

But you should write:

```csharp
ILogger<OrderService> logger;
```

### What does &lt;OrderService&gt; actually do?

`ILogger<T>` uses `T` as the log category.

So this:

```csharp
ILogger<OrderService>
```

means:

> "All logs from this logger belong to `OrderService`"

**Log output**

```text
info: MyApp.Services.OrderService
      Order created successfully
```

The category name = `MyApp.Services.OrderService`

### What if you use ILogger without type?

```csharp
public class OrderService
{
    private readonly ILogger _logger;

    public OrderService(ILogger logger)
    {
        _logger = logger;
    }
}
```

**Problems ❌**

1. 1️⃣ DI cannot automatically create it
2. 2️⃣ No category → logs become generic
3. 3️⃣ Hard to filter logs per class
4. 4️⃣ Bad for large apps

You must do this manually:

```csharp
ILogger logger = loggerFactory.CreateLogger("OrderService");
```

> **Note:** Not recommended.

# Serilog with AppSettings - Really recommended

**Recommended appsettings.json (Best Practice)**

```json
{
  "Serilog": {
    "Using": [
      "Serilog.Sinks.Console",
      "Serilog.Sinks.File"
    ],

    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning"
      }
    },

    "Enrich": [
      "FromLogContext",
      "WithMachineName",
      "WithThreadId"
    ],

    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "Logs/app-.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 7,
          "shared": true,
          "outputTemplate": "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"
        }
      }
    ]
  }
}
```

## Explanation — WHY this setup is best practice

### 1️⃣ MinimumLevel

```json
"MinimumLevel": {
  "Default": "Information",
  "Override": {
    "Microsoft": "Warning",
    "System": "Warning"
  }
}
```

**Why?**

- Your code logs: Information, Warning, Error
- Framework logs (`Microsoft.*`) are VERY noisy
- You don't want EF Core, DI, Hosting spam

| Source           | Level        |
| ---------------- | ------------ |
| Your app         | Information+ |
| Microsoft/System | Warning+     |

### 2️⃣ Enrich

```json
"Enrich": [
  "FromLogContext",
  "WithMachineName",
  "WithThreadId"
]
```

| Enricher          | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `FromLogContext`  | Enables scopes (CorrelationId, UserId)     |
| `WithMachineName` | Identify which PC / server                 |
| `WithThreadId`    | Debug multithreading / background services |

Never skip `FromLogContext` — without it → scopes do nothing.

### 3️⃣ Console Sink

```json
{
  "Name": "Console",
  "Args": {
    "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"
  }
}
```

**Why?**

Useful for:

- Development
- Debugging
- CI pipelines
- Short timestamp
- Structured properties included

**Example output:**

```text
[23:14:05 INF] Order saved {"OrderId":101}
```

### 4️⃣ File Sink (Rolling logs)

```json
{
  "Name": "File",
  "Args": {
    "path": "Logs/app-.log",
    "rollingInterval": "Day",
    "retainedFileCountLimit": 7
  }
}
```

**Why?**

- ✔ Rolling files (daily)
- ✔ Auto cleanup (7 days)
- ✔ No disk explosion
- ✔ Works well in desktop apps

**Log files:**

```text
Logs/
 ├─ app-2026-01-05.log
 ├─ app-2026-01-06.log
```

## How to initialise

```csharp
using Serilog;

var builder = Host.CreateDefaultBuilder(args);

builder.UseSerilog((context, services, configuration) =>
{
    configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services);
});
```

- ✔ Reads `appsettings.json`
- ✔ Supports DI
- ✔ Supports scopes

| Environment | Level       |
| ----------- | ----------- |
| Development | Debug       |
| Production  | Information |

## Optional improvements (advanced)

**Add async logging (recommended)**

```json
"Using": ["Serilog.Sinks.Async"],
"WriteTo": [
  {
    "Name": "Async",
    "Args": {
      "configure": [
        { "Name": "File", "Args": { "path": "Logs/app-.log" } }
      ]
    }
  }
]
```

## What does WriteTo: Console and WriteTo: File mean?

**Short answer:**

👉 The same log event is written to both places.

Serilog supports multiple sinks.
Each `WriteTo` entry is a sink (destination).

# Explained

```csharp
configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services);
```

**Big picture (what this is)**

`configuration` → `LoggerConfiguration` (from Serilog)

This tells Serilog:

- Read settings from `appsettings.json`
- Use services registered in DI (Host container)
- It bridges Serilog ↔ Host ↔ Dependency Injection.

## 1️⃣ .ReadFrom.Configuration(context.Configuration)

**What it does**

Reads Serilog settings from `appsettings.json` / `appsettings.{Environment}.json`

**Example appsettings.json**

```json
{
  "Serilog": {
    "MinimumLevel": "Information",
    "WriteTo": [
      { "Name": "Console" },
      { "Name": "File", "Args": { "path": "logs/app-.log", "rollingInterval": "Day" } }
    ]
  }
}
```

**What happens internally**

Parses the `Serilog` section.

Configures:

- Minimum log level
- Sinks (Console, File, Seq, etc.)
- Enrichers
- Filters

## 2️⃣ .ReadFrom.Services(services)

**What it does**

Allows Serilog to resolve sinks, enrichers, and dependencies from DI.

**Why this exists**

Some Serilog components need services.

**Examples:**

- `IHttpContextAccessor`
- `IHostEnvironment`
- Custom sinks/enrichers that use DB, HTTP, etc.

**Example use case**

```csharp
services.AddSingleton<MyCustomEnricher>();

.Enrich.With<MyCustomEnricher>()
```

This only works if you add:

```csharp
.ReadFrom.Services(services)
```

**Without this line ❌**

- Serilog cannot resolve DI services
- Runtime error:
- `Unable to resolve service for type ...`

**With this line ✅**

- Serilog uses the same container as Host
- No duplicate registrations
- Clean architecture

📌 Required when using DI-based enrichers or sinks.

# Dedicated log file (Sink) for information and error

If you want Error logs to go only into the dedicated error sink, you'll need to filter them out of the general sink. Serilog provides filters for this
purpose.

## Simpler approach with Filter.ByExcluding

You don't have to write a custom class; you can use Serilog's built-in filter:

```csharp
Log.Logger = new LoggerConfiguration()
    .WriteTo.File("info_only.log",
        restrictedToMinimumLevel: LogEventLevel.Information,
        // exclude Error and Fatal
        filter: Serilog.Filters.Matching.WithoutLevel(LogEventLevel.Error))
    .WriteTo.File("error_only.log",
        restrictedToMinimumLevel: LogEventLevel.Error)
    .CreateLogger();
```

## Recommended : JSON configuration version

```json
{
  "Serilog": {
    "WriteTo": [
      {
        "Name": "File",
        "Args": {
          "path": "info_only.log",
          "restrictedToMinimumLevel": "Information"
        },
        "Filter": [
          {
            "Name": "ByExcluding",
            "Args": { "expression": "Level == Error or Level == Fatal" }
          }
        ]
      },
      {
        "Name": "File",
        "Args": {
          "path": "error_only.log",
          "restrictedToMinimumLevel": "Error"
        }
      }
    ]
  }
}
```

This way, Error logs are excluded from the general sink and only written to the dedicated error sink.

> **Note:** By default, unhandled exceptions logged via `Log.Error()` or `Log.Fatal()` will go to every sink that accepts those levels.
