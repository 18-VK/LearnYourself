# Health Checks for a Production-Grade API

Notes with explanations and ASP.NET Core (.NET 8+) examples.

---

## 1. What is a health check?

A health check is a lightweight endpoint (e.g. `/health/live`) that reports whether your service is able to do its job. It is called by machines, not people: load balancers, Kubernetes, Docker, uptime monitors, and deployment pipelines.

**Why it matters in production**

- **Traffic routing:** a load balancer stops sending requests to an instance that isn't ready.
- **Self-healing:** an orchestrator restarts a process that is stuck or deadlocked.
- **Safe deployments:** a rolling update only continues once the new instance reports healthy.
- **Faster incident detection:** you learn a dependency is down from an alert, not from a customer.

---

## 2. The three kinds of probes

This is the most important idea in these notes. "Is the process alive?" and "Can it serve traffic right now?" are different questions and need different endpoints.

| Probe | Question it answers | What happens on failure | What it should check |
|---|---|---|---|
| **Startup** | Has the app finished booting (migrations, cache warm-up, config load)? | Orchestrator waits; kills it if startup takes too long | One-time init flags |
| **Liveness** | Is the process alive and not deadlocked? | Container is **restarted** | Almost nothing: the app can respond |
| **Readiness** | Can this instance handle requests right now? | Instance is **removed from the load balancer** (not restarted) | Critical dependencies (DB, cache, required downstream) |

**The classic mistake:** putting database checks in the *liveness* probe. If the DB has a 30-second blip, every instance fails liveness, every container restarts at once, and a small outage becomes a full one (and the restarts overload the DB when it comes back). Dependencies belong in **readiness**, never liveness.

**Rule of thumb**

- Liveness = "restarting me would fix this" (hung process, deadlock).
- Readiness = "I'm fine, but I shouldn't get traffic right now" (DB down, warming up, shutting down).

---

## 3. Health states

ASP.NET Core defines three statuses:

| Status | Meaning | Default HTTP code |
|---|---|---|
| `Healthy` | Everything works | 200 |
| `Degraded` | Working, but something non-critical is impaired (e.g. cache down, so slower) | 200 |
| `Unhealthy` | Cannot serve correctly | 503 |

`Degraded` is useful: it lets you alert on a problem without pulling the instance out of rotation.

---

## 4. Basic setup in ASP.NET Core

Packages (community checks from the Xabaril `AspNetCore.HealthChecks.*` family):

```bash
dotnet add package AspNetCore.HealthChecks.SqlServer
dotnet add package AspNetCore.HealthChecks.Redis
```

`Program.cs`:

```csharp
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks()
    // Liveness: no dependencies, just "the app responds"
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: new[] { "live" })

    // Readiness: critical dependency. Failing means "don't send me traffic"
    .AddSqlServer(
        connectionString: builder.Configuration.GetConnectionString("Default")!,
        name: "sqlserver",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "ready" },
        timeout: TimeSpan.FromSeconds(3))

    // Readiness: non-critical dependency. Failing means "degraded", still serve
    .AddRedis(
        redisConnectionString: builder.Configuration["Redis:Connection"]!,
        name: "redis",
        failureStatus: HealthStatus.Degraded,
        tags: new[] { "ready" },
        timeout: TimeSpan.FromSeconds(2));

var app = builder.Build();

// Liveness: only checks tagged "live"
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("live")
});

// Readiness: only checks tagged "ready"
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready")
});

app.Run();
```
I’ll check the tagged notes to see how this question fits their existing health-check section, then clarify the difference and what registering multiple checks does.


`AddCheck` registers a health check you provide—typically a class that implements `IHealthCheck`. `AddSqlServer` is a convenience extension that registers a check for SQL Server connectivity; it doesn’t replace `AddCheck`.

You can register several checks on the same builder:

```csharp
builder.Services.AddHealthChecks()
    .AddCheck<ExternalApiHealthCheck>("external-api")
    .AddSqlServer(connectionString, name: "sql");
```

When the health endpoint runs, it runs the registered checks and combines their results into one report. The overall status is the worst result: **Unhealthy** takes precedence over **Degraded**, which takes precedence over **Healthy**. The report also includes each check’s individual result, **so give checks unique names**.

Use `AddSqlServer` for a straightforward database connectivity check; use `AddCheck` when you need custom health-check logic.

**Explanation**

- **Tags** let one registration list serve several endpoints. Each endpoint filters with `Predicate`.
- **`failureStatus`** controls how a failing check is reported. A broken Redis (cache) is `Degraded`, a broken SQL Server is `Unhealthy`.
- **`timeout`** is essential. A check that hangs is worse than one that fails, because the probe itself times out and gives a confusing result.
- **`AddCheck` vs. `AddSqlServer`:** `AddCheck` is the general-purpose API for registering a custom check (for example, an `IHealthCheck` implementation or a delegate). `AddSqlServer` is a SQL Server-specific extension provided by the `AspNetCore.HealthChecks.SqlServer` package; it registers a check that tests the database connection.
- **Registering multiple checks:** Chaining several registrations adds all of them to the health-check service; they do not replace one another. When an endpoint is requested, its `Predicate` selects which registered checks run (so the `live` endpoint above runs only `self`, while `ready` runs SQL Server and Redis). The report includes each selected check, and its overall status is the most severe result: `Unhealthy` > `Degraded` > `Healthy`. Give checks distinct names so their results are easy to identify.

---

### Does placing of health check endpoints matter like middlewares

Yes, but the order of the `Use*` middleware matters much more than where you put `MapHealthChecks`.

`MapHealthChecks` registers an endpoint, so health requests go through the same pipeline as every other request. Any middleware that runs before the endpoint also runs for `/health/*`, and it can block or alter probes.

**What can break probes**

| Middleware | Effect on health probes | Fix |
|---|---|---|
| `UseHttpsRedirection` | Probe over HTTP gets a 307 redirect and may be marked failed | Probe the HTTPS port, or skip redirection when TLS is terminated at the proxy |
| `UseAuthentication` / `UseAuthorization` (especially with a fallback policy) | Probe gets 401/403 and the instance looks dead | `.AllowAnonymous()` on the health endpoints |
| `UseRateLimiter` | Frequent probes can hit 429 | `.DisableRateLimiting()` |
| Request logging (e.g. Serilog) | Logs flooded by probes every few seconds | Filter out `/health` |
| `UseForwardedHeaders` | Wrong IP or scheme if it runs after other middleware | Keep it first |

**A sensible order**

```csharp
app.UseForwardedHeaders();
app.UseExceptionHandler("/error");
// app.UseHttpsRedirection();    // only if the app itself terminates TLS
app.UseRequestTimeouts();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapHealthChecks("/health/live",  new() { Predicate = r => r.Tags.Contains("live") })
   .AllowAnonymous()
   .DisableRateLimiting();

app.MapHealthChecks("/health/ready", new() { Predicate = r => r.Tags.Contains("ready") })
   .AllowAnonymous()
   .DisableRateLimiting();

app.MapControllers();
```

With `WebApplication`, routing is added automatically at the start of the pipeline, so all your `Use*` calls already sit after routing. That's why `UseAuthorization` and `UseRateLimiter` can see the endpoint metadata (`AllowAnonymous`, `DisableRateLimiting`) on the health endpoints. If you call `UseRouting()` yourself, keep auth, CORS, and the rate limiter after it and before the endpoints.

**Where `Map*` order doesn't matter**

The order of `MapHealthChecks`, `MapControllers`, and other `Map*` calls rarely matters, because routing picks the best match, not the first one. The exception is a catch-all route (`MapFallback` or `{**slug}`). Specific routes like `/health/live` still win there, but check it if you see odd behavior.

**Alternative: the middleware version**

`app.UseHealthChecks("/health/live")` is plain middleware, so its position matters directly. It answers the request and stops the pipeline. If you place it before auth and the rate limiter, those never run for health requests, which saves you the `.AllowAnonymous()` and `.DisableRateLimiting()` calls. The downside is that it doesn't use endpoint metadata, so you lose per-endpoint policies and `RequireHost`. I'd stay with `MapHealthChecks` plus explicit opt-outs, since the intent is visible on each endpoint.
## 5. Custom health check

For anything without a ready-made package (a downstream API, a queue, disk space), implement `IHealthCheck`:

```csharp
public class PaymentApiHealthCheck : IHealthCheck
{
    private readonly IHttpClientFactory _factory;
    public PaymentApiHealthCheck(IHttpClientFactory factory) => _factory = factory;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            var client = _factory.CreateClient("payments");
            using var response = await client.GetAsync("/ping", ct);

            if (response.IsSuccessStatusCode)
                return HealthCheckResult.Healthy("Payment API reachable");

            return HealthCheckResult.Degraded(
                $"Payment API returned {(int)response.StatusCode}");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Payment API unreachable", ex);
        }
    }
}

// Registration
builder.Services.AddHealthChecks()
    .AddCheck<PaymentApiHealthCheck>(
        "payment-api",
        failureStatus: HealthStatus.Degraded,
        tags: new[] { "ready" },
        timeout: TimeSpan.FromSeconds(3));
```

**Explanation:** the check returns a result instead of throwing, includes a short description, and uses the cancellation token so the timeout actually stops the call.

---

## 6. Startup probe (slow initialization)

If the app does heavy work on boot (migrations, loading reference data), use a flag that flips when it finishes:

```csharp
public class StartupState { public volatile bool IsReady; }

public class StartupHealthCheck : IHealthCheck
{
    private readonly StartupState _state;
    public StartupHealthCheck(StartupState state) => _state = state;

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext ctx, CancellationToken ct = default) =>
        Task.FromResult(_state.IsReady
            ? HealthCheckResult.Healthy("Startup complete")
            : HealthCheckResult.Unhealthy("Still starting"));
}

// Registration
builder.Services.AddSingleton<StartupState>();
builder.Services.AddHealthChecks()
    .AddCheck<StartupHealthCheck>("startup", tags: new[] { "startup" });

app.MapHealthChecks("/health/startup", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("startup")
});

// After warm-up finishes (e.g. in a hosted service or after migrations):
app.Services.GetRequiredService<StartupState>().IsReady = true;
```

Without a startup probe, you'd have to make the liveness probe very lenient to survive slow boots, which delays detection of real hangs later.

---

## 7. Graceful shutdown

When an instance receives a stop signal (SIGTERM), it should tell the load balancer to stop sending traffic *before* it exits. Otherwise in-flight and new requests hit a dying process.

```csharp
public class ShutdownHealthCheck : IHealthCheck
{
    private volatile bool _stopping;

    public ShutdownHealthCheck(IHostApplicationLifetime lifetime) =>
        lifetime.ApplicationStopping.Register(() => _stopping = true);

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext ctx, CancellationToken ct = default) =>
        Task.FromResult(_stopping
            ? HealthCheckResult.Unhealthy("Shutting down")
            : HealthCheckResult.Healthy());
}

builder.Services.AddSingleton<ShutdownHealthCheck>();
builder.Services.AddHealthChecks()
    .AddCheck<ShutdownHealthCheck>("shutdown", tags: new[] { "ready" });
```

Register it under the **ready** tag so readiness flips to failing at the start of shutdown. In Kubernetes, also add a short `preStop` sleep (see below) so the endpoint removal has time to propagate before the process stops accepting connections.

---

## 8. Readable JSON output (for internal tools)

The default response is just the text `Healthy`. For dashboards and debugging, return details, but only on internal endpoints (see security section):

```csharp
using System.Text.Json;

app.MapHealthChecks("/health/details", new HealthCheckOptions
{
    Predicate = _ => true,
    ResponseWriter = async (ctx, report) =>
    {
        ctx.Response.ContentType = "application/json";
        var result = new
        {
            status = report.Status.ToString(),
            totalDurationMs = report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                durationMs = e.Value.Duration.TotalMilliseconds,
                description = e.Value.Description
            })
        };
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(result));
    }
}).RequireHost("*:5001");   // example: internal-only port
```

Example output:

```json
{
  "status": "Degraded",
  "totalDurationMs": 142.3,
  "checks": [
    { "name": "sqlserver", "status": "Healthy",  "durationMs": 12.1, "description": null },
    { "name": "redis",     "status": "Unhealthy", "durationMs": 2001.0, "description": null }
  ]
}
```

(Note: when any check is `Unhealthy`/`Degraded`, the overall status is the worst of all checks. Redis is registered with `failureStatus: Degraded`, so in practice its failure shows as `Degraded`.)

---

## 9. Kubernetes configuration

```yaml
containers:
  - name: api
    image: myorg/api:1.0.0
    ports:
      - containerPort: 8080

    startupProbe:
      httpGet: { path: /health/startup, port: 8080 }
      periodSeconds: 5
      failureThreshold: 30        # up to 150s to boot

    livenessProbe:
      httpGet: { path: /health/live, port: 8080 }
      periodSeconds: 10
      timeoutSeconds: 2
      failureThreshold: 3         # restart after ~30s of failure

    readinessProbe:
      httpGet: { path: /health/ready, port: 8080 }
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 2         # pull from rotation after ~10s

    lifecycle:
      preStop:
        exec: { command: ["sleep", "10"] }   # let the endpoint removal propagate

terminationGracePeriodSeconds: 30
```

**Explanation of the knobs**

- `periodSeconds`: how often to probe.
- `failureThreshold`: consecutive failures before acting. Avoids reacting to a single blip.
- `timeoutSeconds`: must be longer than your slowest check timeout, otherwise the probe fails before the check can report.
- Liveness is slower and more forgiving (restarts are disruptive). Readiness is faster (removing from rotation is cheap and reversible).

---

## 10. Docker (`HEALTHCHECK`)

For plain Docker or Compose (no orchestrator):

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8080/health/live || exit 1
```

Caveat: the default .NET `aspnet` images, and especially the chiseled ones, may not include `curl`. Either install it, use a tiny health-check binary, or rely on the orchestrator's HTTP probes instead.

---

## 11. Best practices

1. **Keep liveness dumb.** No dependency calls. It should basically only prove the process can answer.
2. **Put dependencies in readiness.** And only the ones the service truly cannot work without.
3. **Use `Degraded` for non-critical dependencies** so a cache outage doesn't pull every instance out of rotation.
4. **Always set timeouts** on every check, shorter than the probe timeout.
5. **Keep checks cheap.** `SELECT 1`, not a heavy query. Probes run every few seconds, on every instance.
6. **Cache expensive checks.** If a check calls a rate-limited third party, cache its result for 15-30s instead of hitting it on every probe.
7. **Don't cascade.** Don't have service A's readiness depend on service B's readiness, or one failure takes down the whole chain. Check that you can *reach* a dependency you require, not that its whole system is healthy.
8. **Protect the details.** Detailed output reveals your infrastructure. Expose only a bare status publicly, and keep JSON details on an internal port or behind authorization (`.RequireAuthorization()` / `.RequireHost(...)`).
9. **Exclude health endpoints from rate limiting, auth, and noisy logging.** Otherwise probes can trip your own limiter (`.DisableRateLimiting()`) or flood your logs.
10. **Handle shutdown.** Fail readiness first, drain, then exit.
11. **Alert on trends, not single failures.** One failed probe is noise. Alert on sustained failures, or on instances flapping between ready and not ready.

---

## 12. Common pitfalls

| Pitfall | Consequence | Fix |
|---|---|---|
| DB check in liveness | DB blip causes mass restarts | Move to readiness |
| No check timeouts | Probe hangs, confusing failures | Set `timeout` on every check |
| Probe timeout shorter than check timeout | Healthy instances marked failed | Probe timeout > slowest check |
| Failing readiness on any optional dependency | Whole fleet removed, total outage | Use `Degraded` for optional dependencies |
| Public detailed health endpoint | Information leak | Internal port or auth |
| Health endpoint behind auth middleware | Probes get 401 and instance looks dead | Map health endpoints so they bypass auth, or use an internal route |
| Rate limiter applies to probes | Probes get 429 | `.DisableRateLimiting()` on health routes |
| Aggressive thresholds | Flapping restarts under load | Use `failureThreshold` of 2-3 and sensible periods |

---

## 13. Pushing health into monitoring (optional)

To get health into Prometheus, Application Insights, or similar, use an `IHealthCheckPublisher`. It runs checks on a schedule in the background and pushes results, without any external probe:

```csharp
public class MetricsPublisher : IHealthCheckPublisher
{
    public Task PublishAsync(HealthReport report, CancellationToken ct)
    {
        foreach (var (name, entry) in report.Entries)
        {
            // e.g. emit a gauge: 1 = healthy, 0 = unhealthy
            // metrics.Gauge("health_check", entry.Status == HealthStatus.Healthy ? 1 : 0, name);
        }
        return Task.CompletedTask;
    }
}

builder.Services.AddSingleton<IHealthCheckPublisher, MetricsPublisher>();
builder.Services.Configure<HealthCheckPublisherOptions>(o =>
{
    o.Delay = TimeSpan.FromSeconds(5);
    o.Period = TimeSpan.FromSeconds(30);
});
```

Alert on: any check unhealthy for more than N minutes, rising check duration (an early warning of a slow dependency), and instances flapping.

---

## 14. Production checklist

- [ ] Separate `/health/live`, `/health/ready`, and `/health/startup`
- [ ] Liveness has **no** external dependencies
- [ ] Critical dependencies in readiness, optional ones return `Degraded`
- [ ] Every check has a timeout
- [ ] Checks are cheap and expensive ones are cached
- [ ] Probe timeouts and thresholds tuned (probe timeout > check timeout)
- [ ] Readiness fails on shutdown, with a `preStop` delay in Kubernetes
- [ ] Detailed output restricted to internal access
- [ ] Health routes exempt from auth, rate limiting, and request logging noise
- [ ] Alerts on sustained failure and flapping
- [ ] Health behavior tested: stop the DB and confirm readiness fails but liveness stays up

---

## 15. Quick reference

| Endpoint | Used by | Checks | Failure means |
|---|---|---|---|
| `/health/startup` | Kubernetes startup probe | Init finished | Keep waiting, or kill if too slow |
| `/health/live` | Liveness probe, Docker | Process responds | Restart container |
| `/health/ready` | Readiness probe, load balancer | Critical dependencies, not shutting down | Remove from rotation |
| `/health/details` (internal) | Dashboards, humans | Everything | Diagnose |
