# Timers in C#

.NET has several timer classes. They all run code repeatedly or after a delay, but they differ in **which thread the code runs on** and **how they behave when work is slow**.

## 1. `System.Threading.Timer` (low-level, thread pool)

Calls a callback on a **thread pool thread**. It is lightweight and works in any app type.

```csharp
using System.Threading;

var timer = new Timer(
    callback: state => Console.WriteLine($"Tick at {DateTime.Now:T}"),
    state: null,
    dueTime: TimeSpan.FromSeconds(1),   // wait before the first tick
    period: TimeSpan.FromSeconds(2));   // then repeat every 2 seconds

Console.ReadLine();     // keep the console app alive

await timer.DisposeAsync();   // stops the timer and waits for a running callback
```

Useful members:

| Member | Purpose |
|---|---|
| `Change(dueTime, period)` | Restart or reschedule the timer |
| `Change(Timeout.Infinite, Timeout.Infinite)` | Pause it |
| `period = Timeout.InfiniteTimeSpan` | Fire **once only** |
| `Dispose()` / `DisposeAsync()` | Stop and release it |

## 2. `System.Timers.Timer` (event-based wrapper)

The same engine, exposed with an `Elapsed` event and a friendlier API.

```csharp
using System.Timers;

var timer = new System.Timers.Timer(2000);   // interval in milliseconds
timer.Elapsed += (sender, e) => Console.WriteLine($"Elapsed at {e.SignalTime:T}");
timer.AutoReset = true;    // false = fire once
timer.Start();             // same as Enabled = true

Console.ReadLine();
timer.Stop();
timer.Dispose();
```

It also runs on the **thread pool**. It is a good fit when you want `Start`/`Stop` semantics and an event.

## 3. `PeriodicTimer` (.NET 6+, best for async code)

Designed for `async` loops. You **await** each tick, so ticks never overlap.

```csharp
using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));

while (await timer.WaitForNextTickAsync())
{
    await DoWorkAsync();      // if this takes longer than 2 s, the next tick simply waits
}
```

With cancellation, inside a background service:

```csharp
public class CleanupWorker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await CleanUpAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // normal during shutdown
        }
    }
}
```

Key behavior: if your work is slower than the period, missed ticks are **not queued up**. At most one pending tick is kept, so you never get a burst of catch-up runs.

## 4. UI timers

These raise events on the **UI thread**, so you can touch controls safely.

```csharp
// WinForms: System.Windows.Forms.Timer
var uiTimer = new System.Windows.Forms.Timer { Interval = 1000 };
uiTimer.Tick += (s, e) => clockLabel.Text = DateTime.Now.ToString("T");
uiTimer.Start();

// WPF: DispatcherTimer
var dt = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
dt.Tick += (s, e) => clockText.Text = DateTime.Now.ToString("T");
dt.Start();
```

Heavy work in these handlers **freezes the UI**, since they share the UI thread. They are also less precise than thread pool timers.

## 5. Simple `Task.Delay` loop

```csharp
while (!ct.IsCancellationRequested)
{
    await DoWorkAsync();
    await Task.Delay(TimeSpan.FromSeconds(5), ct);
}
```

Easy and readable. The interval is **delay after the work finishes**, so the schedule drifts by the work duration. Use `PeriodicTimer` if you want a steady cadence.

## Comparison

| Timer | Runs on | Overlapping runs? | Async-friendly | Best for |
|---|---|---|---|---|
| `System.Threading.Timer` | Thread pool | **Yes**, if callback is slow | Awkward (`async void`) | Low-level, lightweight scheduling |
| `System.Timers.Timer` | Thread pool | **Yes**, if handler is slow | Awkward | Start/stop style with events |
| `PeriodicTimer` | Your own async loop | **No** | **Yes** | Background jobs in modern .NET |
| `Forms.Timer` | UI thread | No (same thread) | N/A | WinForms UI updates |
| `DispatcherTimer` | UI thread | No (same thread) | N/A | WPF UI updates |
| `Task.Delay` loop | Your own async loop | No | Yes | Simple loops where drift is fine |

## Common pitfalls

### 1. Overlapping callbacks

With the two thread pool timers, a new tick fires **even if the previous one is still running**. Two runs may then execute at the same time.

Fix A: stop the timer while working.

```csharp
timer.Elapsed += (s, e) =>
{
    timer.Stop();
    try { DoWork(); }
    finally { timer.Start(); }
};
```

Fix B: skip the tick if still busy.

```csharp
int running = 0;

timer.Elapsed += (s, e) =>
{
    if (Interlocked.Exchange(ref running, 1) == 1) return;   // already running, skip
    try { DoWork(); }
    finally { Interlocked.Exchange(ref running, 0); }
};
```

Fix C: use `PeriodicTimer`, which can't overlap.

### 2. The timer gets garbage collected

If nothing references a `Threading.Timer`, the GC may collect it and the ticks silently stop.

```csharp
void Start()
{
    var timer = new Timer(_ => Console.WriteLine("tick"), null, 0, 1000);
}   // 'timer' is unreachable now, so it may stop at any time
```

Keep it in a **field** and dispose it when done.

### 3. `async void` callbacks swallow or crash on exceptions

```csharp
timer.Elapsed += async (s, e) =>
{
    await DoWorkAsync();    // an exception here is hard to observe
};
```

Always wrap the body in `try/catch` and log. Exception handling for timer callbacks differs between .NET Framework (often swallowed) and modern .NET (can bring down the process), so never rely on either.

### 4. Not disposing

Timers hold resources and can keep callbacks running. Dispose them. `DisposeAsync()` on `Threading.Timer` also waits for an in-flight callback to finish.

### 5. Cross-thread UI access

Touching a control from a `Threading.Timer` or `Timers.Timer` callback throws in WinForms and WPF. Use the UI timers, or marshal to the UI thread (`Invoke`, `Dispatcher.Invoke`).

### 6. Expecting exact precision

Timers are **not real-time**. Ticks can be late by tens of milliseconds, depending on OS timer resolution (about 15 ms on Windows) and thread pool load. Don't use them for precise timing. Use `Stopwatch` to measure elapsed time.

### 7. Console app exits immediately

A timer doesn't keep the process alive. Add `Console.ReadLine()`, or better, use a hosted service.

### 8. Time zone and DST

For "run at 9:00 every day," don't compute with `DateTime.Now` plus fixed intervals. Daylight saving changes and drift will bite you. Use a scheduler (Quartz.NET, Hangfire, cron in your platform) for calendar-based schedules.

## Which one to pick

| Situation | Use |
|---|---|
| Periodic job in an ASP.NET Core or worker app | `PeriodicTimer` inside a `BackgroundService` |
| Simple periodic call with start/stop and an event | `System.Timers.Timer` |
| Minimal, low-level timer | `System.Threading.Timer` |
| Update a UI clock or progress | `DispatcherTimer` (WPF) or `Forms.Timer` (WinForms) |
| Run something once after a delay | `await Task.Delay(...)` |
| Cron-style or calendar schedules, persistence, retries | Quartz.NET or Hangfire |

## One-line summary

> Use **`PeriodicTimer`** for modern async background work, **`System.Timers.Timer`** or **`Threading.Timer`** for simple thread pool callbacks (and guard against overlap), and the **UI timers** when you must update controls. Always keep a reference, dispose the timer, and catch exceptions inside the callback.

I can also add a Timers section to your notes files or show how to build a daily scheduled job with `BackgroundService` if that's useful.