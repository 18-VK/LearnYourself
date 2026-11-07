# WHAT IConfiguration IS

- `IConfiguration` is the unified configuration abstraction in `Microsoft.Extensions.Configuration`.
- It aggregates values from multiple providers (JSON files, environment variables, command line, secrets stores,
  etc.) and exposes a hierarchical key/value API and binding helpers for POCOs.
- In non-ASP apps you typically use the Generic Host (`Host.CreateDefaultBuilder`) which wires configuration for
  you, or build a `ConfigurationBuilder` manually when you need config before host creation.

## OPTION 1 — Recommended: use Generic Host (production style)

`Host.CreateDefaultBuilder` wires config sources in this order (later sources override earlier):

- `appsettings.json`
- `appsettings.{ENVIRONMENT}.json`
- Environment variables
- Command-line args

Above is the sequence of priority.

This is the simplest production-ready approach.

# Example Program.cs (Generic Host + DI, non-ASP)

```csharp
using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

class Program
{
    static async Task Main(string[] args)
    {
        var host = Host.CreateDefaultBuilder(args) // loads appsettings.json, env-specific, env vars, command line
            .ConfigureServices((context, services) =>
            {
                // Bind strongly-typed options
                services.Configure<AppOptions>(context.Configuration.GetSection("App"));

                // Register a hosted background service (or some worker class)
                services.AddHostedService<Worker>();

                // Register any other services that need IConfiguration injected
                services.AddSingleton<IMyService, MyService>();
            })
            .ConfigureLogging((context, logging) =>
            {
                logging.AddConsole(); // or use Serilog via UseSerilog(...)
            })
            .Build();

        await host.RunAsync();
    }
}

public class AppOptions
{
    public string Name { get; set; } = "";
    public int MaxItemsPerRun { get; set; } = 100;
}
```

# How to read config inside services

```csharp
public class MyService : IMyService
{
    private readonly IConfiguration _config;
    private readonly ILogger<MyService> _logger;

    public MyService(IConfiguration config, ILogger<MyService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public void DoSomething()
    {
        // ad-hoc read
        var mode = _config["FeatureFlags:FastMode"];            // returns string "true"/"false" or null
        var conn = _config.GetConnectionString("Default");     // extension method
        _logger.LogInformation("FastMode={FastMode} Conn={Conn}", mode, conn);
    }
}
```

## OPTION 2 — Manual ConfigurationBuilder (small tools or early bootstrap)

Use this when you need configuration before building the Host — for example to bootstrap Serilog or to decide which host to create.

```csharp
using var config = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")}.json", optional: true)
    .AddEnvironmentVariables()
    .AddCommandLine(args)
    .Build();

var conn = config.GetConnectionString("Default");
var fastMode = config.GetValue<bool>("FeatureFlags:FastMode");
Console.WriteLine($"Conn={conn}, FastMode={fastMode}");
```

**Notes:**

- `reloadOnChange: true` allows the config to be reloaded when the JSON file changes (useful with `IOptionsMonitor<T>`).

- `GetValue<T>("path")` converts values to typed values and supports default values: `config.GetValue<int>("App:MaxItemsPerRun", 100)`.

**Get section directly:**

```csharp
var app = config.GetSection("App").Get<AppOptions>();
// or
var hosts = config.GetSection("Hosts").Get<List<string>>();
```

**Connection strings common pattern:**

`config.GetConnectionString("Default")` reads `ConnectionStrings:Default`.

# Note

Yes — `appsettings.{Environment}.json` overrides `appsettings.json`.

Here's the exact configuration precedence order used in .NET (for both ASP.NET Core and non-ASP.NET Core apps
that use `Host.CreateDefaultBuilder`).

## Configuration Precedence (from lowest → highest priority)

When you use:

```csharp
Host.CreateDefaultBuilder(args)
```

or manually add configuration in the same order as Microsoft does internally, the order is:

| **Order** | **Source**                         | **Description**  |
| --------- | ---------------------------------- |------------------|
| 1️⃣       | `appsettings.json`                 | Base/default settings for all environments.                       |
| 2️⃣       | `appsettings.{Environment}.json`   | Overrides keys in `appsettings.json` when environment matches.    |
| 3️⃣       | User Secrets (in Development only) | Developer-only secrets stored outside source control.             |
| 4️⃣       | Environment Variables              | Overrides JSON values for deployment (e.g., `App__Name=ProdApp`). |
| 5️⃣       | Command-line arguments             | Highest priority; overrides everything else.                      |

Environment variable set before run:

```cmd
set DOTNET_ENVIRONMENT=Production
```

# AppSettings.json

Checkout this to get understanding of basics:

<https://youtu.be/tQdNlju2UXo>

Practical guide you can use right away to run your .NET app with environment-specific appsettings (Development,
QA, Production). It covers file naming, folder layout, how the host picks files, how to set the environment
locally, in CI/CD, Docker and systemd, and safe secret handling. All examples assume a non-ASP .NET Core / .NET
5+ app using the Generic Host.

> **Note:** Will not cover CI/CD, docker and systemd; will only go through how to do it locally.

## Overview — the idea

- Keep a base file `appsettings.json` with defaults.
- Add environment-specific overrides `appsettings.Development.json`, `appsettings.QA.json`, `appsettings.Production.json`.
- Set the environment name (`DOTNET_ENVIRONMENT` or `ASPNETCORE_ENVIRONMENT`). The host loads `appsettings.json`
  first, then the environment file which overrides keys.
- Use environment variables or a secret store for secrets (never commit secrets into JSON).

## File layout (project root)

- `appsettings.json`
- `appsettings.Development.json`
- `appsettings.QA.json`
- `appsettings.Production.json`
- `Program.cs`, `Worker.cs`, etc.

## Example contents

**appsettings.json (defaults)**

```json
{
  "App": {
    "Name": "MyApp",
    "MaxItems": 50
  },
  "ConnectionStrings": {
    "Default": "Server=(local);Database=MyAppDev;Trusted_Connection=True;"
  }
}
```

**appsettings.Development.json**

```json
{
  "App": {
    "MaxItems": 20
  },
  "ConnectionStrings": {
    "Default": "Server=(localdb)\\mssqllocaldb;Database=MyAppDev;Trusted_Connection=True;"
  }
}
```

**appsettings.QA.json**

```json
{
  "App": {
    "MaxItems": 200
  },
  "ConnectionStrings": {
    "Default": "Server=qa-db:1433;Database=MyAppQa;User Id=qauser;Password=__FROM_ENV__;"
  }
}
```

**appsettings.Production.json**

```json
{
  "App": {
    "MaxItems": 1000
  },
  "ConnectionStrings": {
    "Default": "Server=prod-db:1433;Database=MyApp;User Id=produser;Password=__FROM_ENV__;"
  }
}
```

## Key points

- JSON keys merge; values in `appsettings.{ENV}.json` override `appsettings.json` for matching keys.
- Never store real passwords in JSON in production — use environment variables or a secret provider. In sample
  above put placeholders and set actual secrets elsewhere.

## How .NET chooses which environment file to load

- `Host.CreateDefaultBuilder` reads:
- `appsettings.json`
- `appsettings.{Environment}.json` (Environment comes from `DOTNET_ENVIRONMENT` or `ASPNETCORE_ENVIRONMENT`)
- Environment variables
- Command-line args

So `appsettings.Production.json` overrides `appsettings.json` but environment variables override both.

**Example:** Generic host — can use `ConfigurationBuilder` manually also.

**Program.cs — recommended pattern (Generic Host)**

```csharp
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

var host = Host.CreateDefaultBuilder(args) // loads appsettings.json + appsettings.{env}.json + env vars + cmdline
    .ConfigureServices((ctx, services) =>
    {
        services.Configure<AppOptions>(ctx.Configuration.GetSection("App"));
        services.AddHostedService<Worker>();
    })
    .ConfigureLogging((ctx, logging) =>
    {
        logging.AddConsole();
    })
    .Build();

await host.RunAsync();
```

## How to set the environment locally

**PowerShell (Windows)**

```powershell
($env:DOTNET_ENVIRONMENT="Development") // Without braces
dotnet run
```

**Bash (Linux/macOS)**

```bash
export DOTNET_ENVIRONMENT=QA
dotnet run
```

You can also pass command-line override for a single run:

```bash
dotnet run -- --DOTNET_ENVIRONMENT=QA
```

(note: that's passing an argument to your app; environment variable is preferred)

## How to check the active environment in code

```csharp
var env = host.Services.GetRequiredService<IHostEnvironment>();
Console.WriteLine("Environment: " + env.EnvironmentName);
```

# Example flow for developer → QA → Prod

- Developer uses `appsettings.Development.json` + user-secrets for local dev. Set `DOTNET_ENVIRONMENT=Development`
  in IDE launchSettings or env.
- CI builds artifact including `appsettings.json` and `appsettings.QA.json`. Pipeline deploys to QA and sets
  `DOTNET_ENVIRONMENT=QA`; secrets injected via pipeline variables.
- For Production, pipeline deploys artifact (may be same artifacts) and sets `DOTNET_ENVIRONMENT=Production` and
  supplies secrets via secure store. `appsettings.Production.json` can be present with non-secret overrides (or
  you can avoid having any production file and rely solely on env vars/secret provider).

> **Note:** you can set environment variable to project — go to project properties, select debug and click on open
> debug launch profile UI.

Checkout this link, to use environment variable: <https://youtu.be/m0yjMV7LA1U>

# Host.CreateDefaultBuilder() vs ConfigurationBuilder()

👉 **For modern WPF apps (production)**

✅ Prefer `Host.CreateDefaultBuilder()`

👉 **Use `ConfigurationBuilder()` only**

⚠ when you want full manual control or a very small/simple app

## ConfigurationBuilder – LOW LEVEL

**What it is**

A configuration-only builder.

```csharp
var configuration = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json")
    .AddEnvironmentVariables()
    .Build();
```

**What it gives you**

- ✔ `IConfiguration`
- ❌ No DI
- ❌ No logging
- ❌ No lifetime management

You must do everything yourself:

- DI container
- Logging
- App lifetime
- Hosted services

**When ConfigurationBuilder makes sense**

- ✔ Small tools
- ✔ Legacy WPF (.NET Framework)
- ✔ Libraries
- ✔ You want absolute control

## Host.CreateDefaultBuilder() – HIGH LEVEL (RECOMMENDED)

**What it is**

A full application host (same infra used by ASP.NET Core).

```csharp
Host.CreateDefaultBuilder()
```

**What it gives you AUTOMATICALLY**

| Feature                          | Included |
| -------------------------------- | -------- |
| `appsettings.json`               | ✅        |
| `appsettings.{Environment}.json` | ✅        |
| Environment variables            | ✅        |
| Command line args                | ✅        |
| Logging (Console, Debug)         | ✅        |
| DI container                     | ✅        |
| App lifetime                     | ✅        |
| Background services              | ✅        |

**Comparison side-by-side**

| Feature              | ConfigurationBuilder | Host.CreateDefaultBuilder |
| -------------------- | -------------------- | ------------------------- |
| appsettings.json     | ✅                    | ✅                         |
| Environment configs  | ❌ manual             | ✅ automatic               |
| Dependency Injection | ❌                    | ✅                         |
| Logging              | ❌                    | ✅                         |
| Background services  | ❌                    | ✅                         |
| Graceful shutdown    | ❌                    | ✅                         |
| Production-ready     | ⚠                    | ✅                         |

# The Options Pattern

The options pattern binds a **configuration section** (`appsettings.json`, environment variables, and so on) to a
strongly typed class and injects it through DI. This keeps services from repeatedly reading raw strings such as
`configuration["Email:Port"]`.

```json
{
  "Email": {
    "SmtpServer": "smtp.example.com",
    "Port": 587,
    "UseSsl": true
  }
}
```

```csharp
public class EmailOptions
{
    public const string SectionName = "Email";

    public string SmtpServer { get; set; } = string.Empty;
    public int Port { get; set; }
    public bool UseSsl { get; set; }
}
```

Register the binding with the host's service collection:

```csharp
builder.Services.Configure<EmailOptions>(
    builder.Configuration.GetSection(EmailOptions.SectionName));
```

## Why use it?

- **Type safety.** `options.Port` is an `int`; you do not parse a string yourself.
- **Separation of concerns.** A service receives only the settings it needs, not the entire `IConfiguration`.
- **Validation.** Validate settings at startup so invalid configuration fails fast.
- **Reloading.** React to configuration changes with the appropriate options interface and reloadable source.
- **Testability.** Create options directly in tests with `Options.Create(new EmailOptions { ... })`.

## The three interfaces

### `IOptions<T>`

```csharp
public class EmailService
{
    private readonly EmailOptions _options;

    public EmailService(IOptions<EmailOptions> options)
        => _options = options.Value;
}
```

- Registered as a **singleton**.
- The value is created on first access and cached; it does not observe later configuration changes.
- Does not support named options.
- Can be injected into Singleton, Scoped, or Transient services.

### `IOptionsSnapshot<T>`

```csharp
public class OrderController : ControllerBase
{
    private readonly EmailOptions _options;

    public OrderController(IOptionsSnapshot<EmailOptions> options)
        => _options = options.Value;
}
```

- Registered as **Scoped**.
- The value is created once per scope. In a web app, each request gets a fresh value, which remains consistent
  for that request.
- Supports named options with `options.Get("Backup")`.
- **Cannot be injected into a Singleton**; scope validation reports a captive dependency.
- In a console app, it is only available after creating a DI scope.

### `IOptionsMonitor<T>`

```csharp
public class MailWorker : BackgroundService
{
    private readonly IOptionsMonitor<EmailOptions> _monitor;
    private readonly ILogger<MailWorker> _logger;

    public MailWorker(
        IOptionsMonitor<EmailOptions> monitor,
        ILogger<MailWorker> logger)
    {
        _monitor = monitor;
        _logger = logger;

        _monitor.OnChange(updated =>
            _logger.LogInformation("Email settings changed for {Server}", updated.SmtpServer));
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var currentOptions = _monitor.CurrentValue;
        // Use currentOptions for this operation.
        return Task.CompletedTask;
    }
}
```

- Registered as a **Singleton**.
- `CurrentValue` returns the latest options value when the configuration source supports reload.
- `OnChange(listener)` notifies the consumer when the options value changes.
- Supports named options with `monitor.Get("Backup")`.
- Can be injected into any service, including Singletons and background services.
- The value can change during a request or operation; read `CurrentValue` when needed if it must be current.

## Comparison

| | `IOptions<T>` | `IOptionsSnapshot<T>` | `IOptionsMonitor<T>` |
|---|---|---|---|
| Lifetime | Singleton | Scoped | Singleton |
| Sees configuration changes? | No; reads once | Yes, per scope/request | Yes, when the source reloads |
| Change notification | No | No | Yes, with `OnChange` |
| Named options | No | Yes, with `Get(name)` | Yes, with `Get(name)` |
| Can be injected into a Singleton? | Yes | **No** | Yes |
| Value stable during a request? | Yes | Yes | Not guaranteed |
| Access the value | `.Value` | `.Value` | `.CurrentValue` |
| Typical use | Settings fixed for the app's life | Request-level settings | Singletons, workers, live reload |

### Decision guide

```text
Does the value need to change while the app is running?
├─ No  → IOptions<T> (simplest)
└─ Yes
    ├─ Consumer is scoped/transient and needs one consistent value per request
    │     → IOptionsSnapshot<T>
    └─ Consumer is a singleton/background service, or needs change callbacks
          → IOptionsMonitor<T>
```

## Named options

Use named options when you have multiple configurations of the same type, such as primary and backup SMTP servers:

```csharp
builder.Services.Configure<EmailOptions>("Primary",
    builder.Configuration.GetSection("Email:Primary"));
builder.Services.Configure<EmailOptions>("Backup",
    builder.Configuration.GetSection("Email:Backup"));

public class EmailSender
{
    private readonly EmailOptions _primary;
    private readonly EmailOptions _backup;

    public EmailSender(IOptionsSnapshot<EmailOptions> options)
    {
        _primary = options.Get("Primary");
        _backup = options.Get("Backup");
    }
}
```

## Validation

Catch invalid configuration early instead of failing later during an operation:

```csharp
using System.ComponentModel.DataAnnotations;

public class EmailOptions
{
    public const string SectionName = "Email";

    [Required, MinLength(3)]
    public string SmtpServer { get; set; } = string.Empty;

    [Range(1, 65535)]
    public int Port { get; set; }

    public bool UseSsl { get; set; }
}

builder.Services
    .AddOptions<EmailOptions>()
    .Bind(builder.Configuration.GetSection(EmailOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

Without `ValidateOnStart()`, validation runs when the options are first accessed, so a bad value may surface late.
For rules that attributes cannot express, use a validation delegate or implement `IValidateOptions<T>`:

```csharp
.Validate(options => options.UseSsl || options.Port != 465, "Port 465 requires SSL")
```

## Other useful features

| Feature | Purpose |
| ------- | ------- |
| `PostConfigure<T>` | Run code after all `Configure` calls, for example to apply or override a default. |
| `Configure<T>(options => ...)` | Set option values in code instead of binding a configuration section. |
| `AddOptions<T>().BindConfiguration("Email")` | Shorter binding syntax available in .NET 8 and later. |
| `Options.Create(value)` | Create an `IOptions<T>` manually, useful in unit tests. |
| `IOptionsFactory<T>` / `IOptionsMonitorCache<T>` | Advanced customization of how options instances are created and cached. |

## Common mistakes

- **Expecting `IOptions<T>` to reload.** It does not; use `IOptionsSnapshot<T>` or `IOptionsMonitor<T>` when reload is needed.
- **Injecting `IOptionsSnapshot<T>` into a Singleton.** It is Scoped; use `IOptionsMonitor<T>` instead.
- **Keeping a stale copy of `monitor.CurrentValue`.** Options are replaced on change. Keep the monitor and read
  `CurrentValue` when needed, or update your copy in `OnChange`.
- **Assuming `OnChange` fires exactly once per file save.** File watchers may report duplicate events; make the
  handler idempotent or debounce it if necessary.
- **Assuming every configuration source reloads.** JSON files configured with `reloadOnChange: true` can reload.
  Environment variables and command-line arguments do not change automatically while the app is running.
- **Mutating the options object.** Treat bound options as read-only; mutations are not persisted and may affect other
  consumers sharing the instance.
- **Skipping validation.** Missing values can silently remain `null` or the type's default, moving the failure far
  from the configuration mistake.
- **Misspelling the section name.** A missing section usually binds default values rather than throwing an error.

## Interview-style summary

> **Options pattern:** bind configuration sections to strongly typed classes and inject them through DI, with built-in
> support for validation, named options, and reloading.
>
> - **`IOptions<T>`**: Singleton, read once, no reload. Use for static settings.
> - **`IOptionsSnapshot<T>`**: Scoped, recomputed per scope/request, consistent within that scope. Use for request-level
>   settings; it cannot be injected into Singletons.
> - **`IOptionsMonitor<T>`**: Singleton, current value with `OnChange` notifications. Use in Singletons and background
>   services.

# Background service

A `BackgroundService` is a host-managed, cancellable, long-running task used for background work.

It runs in parallel with the UI, starts with the app,
stops gracefully when the app shuts down.

**It is NOT:**

- ❌ a UI timer
- ❌ a `Task.Run` helper
- ❌ a replacement for async commands

UI never blocks.
Services never touch UI directly.

## Basic structure of BackgroundService

```csharp
public class MyService : BackgroundService
{
    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            // background work
            await Task.Delay(1000, stoppingToken);
        }
    }
}
```

## Lifecycle explained (IMPORTANT)

**Startup**

```csharp
_host.Start();
```

➡ Host calls:

```csharp
ExecuteAsync(stoppingToken)
```

**Shutdown**

```csharp
_host.StopAsync();
```

➡ Host:

- Cancels `stoppingToken`
- Waits for task to finish
- Disposes service

No forced thread aborts.

## Multiple background services

Yes — totally fine:

```csharp
services.AddHostedService<MyService>();
services.AddHostedService<AutoSaveService>();
services.AddHostedService<SyncService>();
services.AddHostedService<CleanupService>();
```

Host manages all.

## Common mistakes ❌

| Mistake              | Why bad              |
| -------------------- | -------------------- |
| `while(true)`        | No cancellation      |
| Blocking calls       | App hangs on exit    |
| UI access            | Cross-thread crashes |
| Doing business logic | Hard to test         |
| Using static state   | Memory leaks         |

# Console app vs Web API: how configuration differs

The concepts are the same in both app types: DI, configuration, logging, and options. What differs is how the host starts, what it does while running, and what you must set up yourself.

## The core difference

|                         | Console app | Web API |
| ----------------------- | ----------- | ------- |
| Project SDK             | `Microsoft.NET.Sdk` | `Microsoft.NET.Sdk.Web` |
| Host built by default?  | No. A plain console app starts with `Main` and no host, DI, configuration, or logging setup. | Yes. `WebApplication.CreateBuilder(args)` sets up the web host. |
| What runs               | Your code runs, then the process exits unless you keep it alive. | Kestrel listens for HTTP requests until the app is stopped. |
| Request pipeline        | None | Middleware and endpoint routing (`app.Use...`, `app.Map...`) |
| Per-request scope       | None | One DI scope per HTTP request |
| `appsettings.json`      | Configure it to copy to the output directory. | Included and copied by the Web SDK. |
| Typical lifetime        | Short-lived, or long-lived when used as a worker service. | Long-lived server process. |

## 1. Console app: opt in to the host

A plain console project does not include the Generic Host. Add it when you need the same application infrastructure used by web apps:

```shell
dotnet add package Microsoft.Extensions.Hosting
```

```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args); // .NET 7+

builder.Services.AddTransient<IEmailService, EmailService>();
builder.Services.AddTransient<CustomerService>();

using var host = builder.Build();

// There is no HTTP request scope in a console app, so create one for scoped services.
using var scope = host.Services.CreateScope();
var customerService = scope.ServiceProvider.GetRequiredService<CustomerService>();
customerService.RegisterCustomer("Aman");
```

The Generic Host provides configuration providers, logging, DI, and application lifetime management. Its default configuration includes `appsettings.json`, environment-specific settings, environment variables, and command-line arguments. User Secrets are added in Development when configured for the project. For older .NET versions, use `Host.CreateDefaultBuilder(args).ConfigureServices(...)`.

### Copy `appsettings.json` to the output directory

The Web SDK handles this for web projects. In a console project, add this to the `.csproj` so the file is available beside the built application:

```xml
<ItemGroup>
  <None Update="appsettings.json">
    <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
  </None>
</ItemGroup>
```

### Content root gotcha

The host uses a content root to locate `appsettings.json`. A console app launched with a different current working directory may not find the file where expected. If the file is deployed beside the application, set the content root explicitly:

```csharp
var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});
```

### Long-running console app (Worker Service)

For a background job, queue consumer, or scheduled loop, register a hosted service and run the host:

```csharp
var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddHostedService<Worker>();

builder.Build().Run(); // Blocks until shutdown.
```

```csharp
public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    public Worker(ILogger<Worker> logger) => _logger = logger;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            _logger.LogInformation("Working at {time}", DateTimeOffset.Now);
            await Task.Delay(1000, ct);
        }
    }
}
```

The `Microsoft.NET.Sdk.Worker` template (`dotnet new worker`) creates a project with the worker-service setup.

## 2. Web API: the host is already built

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<CustomerService>();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.MapPost("/customers/{name}", (string name, CustomerService service) =>
{
    service.RegisterCustomer(name);
    return Results.Ok();
});

app.Run(); // Starts Kestrel and blocks.
```

In addition to DI and configuration, the Web API host provides:

- Kestrel and URL binding (including `ASPNETCORE_URLS` and development launch settings).
- The HTTP middleware and routing pipeline for authentication, CORS, exception handling, and endpoints.
- An automatic DI scope per request; Scoped services such as `DbContext` are created and disposed for each request.
- Model binding and validation, controllers or minimal APIs, and optional Swagger/OpenAPI setup.
- Web-host environment configuration, including `ASPNETCORE_ENVIRONMENT`.

## 3. Side by side

| Task | Console (Generic Host) | Web API |
| ---- | ---------------------- | ------- |
| Create builder | `Host.CreateApplicationBuilder(args)` | `WebApplication.CreateBuilder(args)` |
| Register services | `builder.Services.Add...` | `builder.Services.Add...` |
| Read configuration | `builder.Configuration["Key"]` | `builder.Configuration["Key"]` |
| Configure logging | `builder.Logging.Add...` | `builder.Logging.Add...` |
| Build | `builder.Build()` returns an `IHost` | `builder.Build()` returns a `WebApplication` |
| Configure pipeline | Not applicable | `app.Use...`, `app.Map...` |
| Start | Run your code, or `host.Run()` for hosted work | `app.Run()` |
| Environment variable | `DOTNET_ENVIRONMENT` | `ASPNETCORE_ENVIRONMENT`; `DOTNET_ENVIRONMENT` is also recognized by modern `WebApplication` hosting |
| Resolve a Scoped service | Create a scope with `CreateScope()` | Automatically scoped to each request |

If both `DOTNET_ENVIRONMENT` and `ASPNETCORE_ENVIRONMENT` are set for a modern `WebApplication`, `DOTNET_ENVIRONMENT` takes precedence. For a console Generic Host, use `DOTNET_ENVIRONMENT`.

## 4. Configuration and options work the same in both

Given this `appsettings.json`:

```json
{
  "Email": {
    "SmtpServer": "smtp.example.com",
    "Port": 587
  }
}
```

Bind the section and inject the options into a service:

```csharp
public class EmailSettings
{
    public string SmtpServer { get; set; } = string.Empty;
    public int Port { get; set; }
}

builder.Services.Configure<EmailSettings>(
    builder.Configuration.GetSection("Email"));

public class EmailService : IEmailService
{
    private readonly EmailSettings _settings;

    public EmailService(IOptions<EmailSettings> options)
        => _settings = options.Value;

    public void SendEmail(string message)
        => Console.WriteLine($"[{_settings.SmtpServer}:{_settings.Port}] {message}");
}
```

This service and options-binding code works in either app type. That is a benefit of the Generic Host: application services can be shared between a console worker and a Web API without knowing which host provides them.

## 5. Common mistakes when moving between them

- **Resolving a Scoped service from the root in a console app.** With scope validation enabled, resolving `AppDbContext` directly from `host.Services` throws. Create a scope first.
- **`appsettings.json` is not found.** Check that the file is copied to the output directory and that the content root points to the expected location.
- **Using the wrong environment variable.** A console Generic Host uses `DOTNET_ENVIRONMENT`. A modern web host recognizes both `ASPNETCORE_ENVIRONMENT` and `DOTNET_ENVIRONMENT`; when both are set, `DOTNET_ENVIRONMENT` takes precedence.
- **Using middleware or `Startup` concepts in a plain console app.** Without an HTTP pipeline, middleware and routing do not apply.
- **Expecting a console app to stay alive.** A plain app exits when `Main` completes. Use `Run()` with a hosted service for long-running work.
- **Doing heavy work in a hosted service constructor.** Keep initialization and recurring work in `ExecuteAsync`, and create scopes with `IServiceScopeFactory` when the work needs Scoped dependencies.

## Which approach to pick

| Situation | Use |
| --------- | --- |
| Tiny one-off tool with no configuration needs | Plain console app; manual `ServiceCollection` only if DI is useful |
| Console job needing configuration, logging, or DI | Console app with `Host.CreateApplicationBuilder` |
| Background processing, queue consumer, or scheduled loop | Worker Service with `BackgroundService` |
| HTTP endpoints | Web API with `WebApplication.CreateBuilder` |

> **In short:** A Web API comes with the host, Kestrel, the middleware pipeline, and per-request scopes. A plain console app starts without those pieces, so add the Generic Host when needed, configure its content root and settings files, and create DI scopes yourself. Service registration, configuration, and logging patterns are otherwise largely the same.
