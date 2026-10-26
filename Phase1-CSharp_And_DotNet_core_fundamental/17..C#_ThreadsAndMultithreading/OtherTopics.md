# Other Topics — continuations, locking primitives and ValueTask

Here's a deeper look at continuations—the code that runs after an `await`—and how different threads and the caller thread
behave.

## 1) Setting the stage

When an async method reaches an `await`:

```csharp
await SomeTask();
```

The compiler turns the method into a state machine.
At the `await` point it:

Checks if `SomeTask` is already complete.

- If complete, it continues synchronously on the current thread.
- If not complete, it registers a continuation (the code after the `await`) to run later and returns control immediately.

## 2) How continuation thread selection works

The continuation is scheduled according to the `SynchronizationContext` or `TaskScheduler` that's captured at the moment of
`await`.

| Situation                                           | Thread that runs the continuation                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| **WPF/WinForms UI thread**                          | The same UI thread (message loop).                                            |
| **ASP.NET (classic)**                               | The ASP.NET request context thread (similar to UI context).                   |
| **ASP.NET Core / Console / Library code** (default) | A *ThreadPool* thread. Might be the same one as before or a different worker. |
| **`ConfigureAwait(false)` used**                    | No context captured → runs on a ThreadPool thread, even in UI or ASP.NET.     |

## 3) Example: seeing the thread flow

```csharp
static async Task Demo()
{
    Console.WriteLine($"Before await: {Thread.CurrentThread.ManagedThreadId}");

    await Task.Run(() => {
        Console.WriteLine($"Task running on: {Thread.CurrentThread.ManagedThreadId}");
        Thread.Sleep(500);
    });

    Console.WriteLine($"After await:  {Thread.CurrentThread.ManagedThreadId}");
}
```

**Console app**

```text
Before await: 1
Task running on: 4
After await:  5  // Different ThreadPool thread
```

**WPF app**

```text
Before await: 1
Task running on: 4
After await:  1  // Back to UI thread
```

## ConfigureAwait method

`ConfigureAwait` is a method on every `Task`/`ValueTask` that tells the awaiter whether to capture and resume on the original
synchronization context (such as a UI thread or ASP.NET request context) after the `await` completes.

### The Problem It Solves

When you `await` inside code that started on a context (e.g., WPF/WinForms UI thread, ASP.NET request context):

```csharp
await SomeAsyncOperation();
UpdateUI();  // <-- resumes on the UI thread by default
```

The default `await` captures that context so that `UpdateUI()` can safely run on it.
In library or server code (where you don't care about resuming on a specific thread) this capture:

- adds overhead, and
- can cause deadlocks if someone blocks on `.Result` or `.Wait()`.

### Syntax

```csharp
await someTask.ConfigureAwait(false);
```

- `false` → do NOT capture the current context. The continuation may run on any thread-pool thread.
- `true` → (default) capture the context and resume on it.

### Deadlock Example (classic ASP.NET or WinForms)

```csharp
// UI thread
var result = GetDataAsync().Result; // blocks

async Task<string> GetDataAsync()
{
    await Task.Delay(1000);   // captures UI context by default
    return "done";            // can't resume, UI thread is blocked -> deadlock
}
```

**Fix:**

```csharp
await Task.Delay(1000).ConfigureAwait(false);
```

Now the continuation runs on a thread-pool thread and no deadlock occurs.

## `lock` (keyword) – Syntactic sugar for Monitor

### Use case

Protect a single-process, in-memory critical section.

Lightweight, fast, only blocks other threads inside the same process.

### Example

```csharp
using System;
using System.Threading;

class LockDemo
{
    static readonly object sync = new();
    static int counter = 0;

    static void Main()
    {
        Thread[] threads = new Thread[5];
        for (int i = 0; i < threads.Length; i++)
        {
            threads[i] = new Thread(Increment);
            threads[i].Start();
        }
        foreach (var t in threads) t.Join();
        Console.WriteLine($"Counter = {counter}");
    }

    static void Increment()
    {
        for (int i = 0; i < 100_000; i++)
        {
            lock (sync)        // same as Monitor.Enter/Exit
            {
                counter++;
            }
        }
    }
}
```

**Key points:**

- Automatically calls `Monitor.Enter` and `Monitor.Exit` in a try/finally.
- Single-process only.
- Cannot be awaited; it blocks the thread.

## Monitor – More control than `lock`

`lock` is shorthand for `Monitor.Enter`/`Exit`. Use `Monitor` when you need:

- Timeouts (`TryEnter`)
- `Pulse`/`Wait` for signaling (producer/consumer)

### Example: timeout

```csharp
using System;
using System.Threading;

class MonitorTimeout
{
    static readonly object sync = new();

    static void Main()
    {
        if (Monitor.TryEnter(sync, TimeSpan.FromSeconds(2)))
        {
            try
            {
                Console.WriteLine("Entered critical section.");
            }
            finally { Monitor.Exit(sync); }
        }
        else
        {
            Console.WriteLine("Timeout acquiring lock.");
        }
    }
}
```

### Example: producer/consumer signaling

```csharp
// Thread A
lock (sync)
{
    while (!condition) Monitor.Wait(sync); // releases lock and waits
    // condition met
}

// Thread B
lock (sync)
{
    condition = true;
    Monitor.Pulse(sync); // wake one waiter
}
```

## Mutex

`Mutex` — a mutual-exclusion primitive. Usually used when you need exclusive access to a resource. Can be named to
synchronize across processes.

A mutex is a locking mechanism used to synchronize access to a resource. Only one task (can be a thread or process based
on OS abstraction) can acquire the resource at a time.

### When to use

Ensure only one thread/process at a time accesses a resource (e.g., only one instance of an app writes to a file;
single-app-instance detection).

### Useful members

- `new Mutex(bool initiallyOwned)` / `new Mutex(bool, string name)` — create (optionally named).
- `WaitOne()` / `WaitOne(int millisecondsTimeout)` / `WaitOne(TimeSpan)` — acquire the mutex (blocking).
- `ReleaseMutex()` — release it.
- `OpenExisting(string name)` — open a named mutex created by another process which is not acquired.
- `Dispose()` — release native handle when done.
- If a mutex is abandoned (owner terminated without releasing) other waiters get `AbandonedMutexException`.

### Example

```csharp
using System;
using System.Threading;

class SingleInstanceDemo
{
    static void Main()
    {
        // Use a unique name (Global\ prefix for machine-wide; Local\ or no prefix for session).
        const string name = "Global\\MyUniqueAppMutex_1512";

        bool createdNew;
        using (var mutex = new Mutex(initiallyOwned: true, name: name, createdNew: out createdNew))
        {
            if (!createdNew)
            {
                Console.WriteLine("Another instance is already running. Exiting.");
                return;
            }

            try
            {
                Console.WriteLine("This is the only instance. Press Enter to exit.");
                Console.ReadLine();
            }
            finally
            {
                // Mutex disposed by using; ReleaseMutex would be used if we had WaitOne earlier
            }
        }
    }
}
```

### How to Observe Each Feature

- **Create vs. `OpenExisting`**
  First run of the program sets `createdNew = true`.
  Second run (while first still holds the mutex) sets `createdNew = false`.

- **`WaitOne` Overloads**
  - `WaitOne()` blocks indefinitely.
  - `WaitOne(TimeSpan)` or `WaitOne(int milliseconds)` time out if the mutex isn't free.

- **`ReleaseMutex`**
  Must be called once for every successful `WaitOne` on that thread.

- **`Dispose`**
  The `using` statement calls `Dispose()`, freeing the OS handle.

- **`AbandonedMutexException`**
  Start two copies. While the second is waiting, kill the first process (close console window or use Task Manager) without
  releasing. The second copy will acquire the mutex and immediately receive `AbandonedMutexException`.

## Semaphore — definition & use cases

**Definition:** A `Semaphore` (from `System.Threading.Semaphore`) is a kernel-backed synchronization primitive that maintains a
count of how many threads (or processes) may enter a protected section. It can be named, so different processes can open
the same semaphore and coordinate across process boundaries. It exposes a `WaitHandle` (so it works with `WaitOne`, `WaitAny`,
`WaitAll`).

### Typical use cases

- **Cross-process coordination** — e.g., ensure only one instance of an application (or only N instances) access a shared
  resource (file, device, license file) at a time.

### Useful members

- `new Semaphore(int initialCount, int maximumCount, string name, out bool createdNew)` — create (optionally named).
- `Semaphore.OpenExisting(string name)` / `Semaphore.TryOpenExisting(string name, out Semaphore sem)` — open a named semaphore created by another process.
- `WaitOne()` / `WaitOne(int millisecondsTimeout)` / `WaitOne(TimeSpan timeout)` — block until entered or timeout; returns bool (true = acquired).
- `Release()` / `Release(int releaseCount)` — release and return the previous count (int).
- `Close()` / `Dispose()` — free native handle.
- Inherited `WaitHandle` methods: `WaitAny`, `WaitAll` work with kernel wait handles.

### Example

Limit to 2 concurrent processes system-wide (e.g., only 2 instances of your program can run heavy work).

```csharp
using System;
using System.Threading;

class Demo
{
    static void Main()
    {
        const string name = "Global\\MyNamedSemaphore";
        using var sem = new Semaphore(initialCount: 2, maximumCount: 2, name: name);

        Console.WriteLine("Waiting for a slot...");
        sem.WaitOne(); // Blocks thread until slot is free
        try
        {
            Console.WriteLine("Acquired slot. Doing work...");
            Console.ReadLine(); // Hold slot until user presses Enter
        }
        finally
        {
            sem.Release();
        }
    }
}
```

## SemaphoreSlim — definition & use cases

`SemaphoreSlim` is a lightweight, managed semaphore designed for in-process synchronization. It avoids kernel transitions
for most operations, supports `WaitAsync` for async/await workflows, and is much faster than the kernel `Semaphore` for
thread/task coordination inside the same process.

### Typical use cases

- **Limit concurrent tasks/threads inside a process** — e.g., throttle number of parallel background jobs, limit concurrent
  HTTP requests/worker threads, cap number of concurrent DB calls.
- **Async-friendly throttling** — use `WaitAsync` in code that uses async/await to avoid blocking threads.

> **Note:**
>
> Think of a scenario, using semaphore slim with 2 concurrent task.. and both task is calling a async function with wait..
> and updating a value.. does it affect other thread also?
>
> Yes — if `SemaphoreSlim` is created with a concurrency of 2, two tasks may be inside the protected section at the same
> time, so they can affect each other when they both call an async function that awaits and then updates a shared value.
> `SemaphoreSlim` only limits how many can enter; it does not prevent interference between those that are allowed in
> concurrently.

### SemaphoreSlim (recommended for in-process & async)

**Useful members**

- `new SemaphoreSlim(int initialCount, int maxCount = Int32.MaxValue)` — create.
- `Wait()` — synchronous blocking acquire.
- `Wait(int millisecondsTimeout)` / `Wait(TimeSpan)` — sync with timeout; returns bool.
- `WaitAsync()` / `WaitAsync(CancellationToken)` — async acquire (returns `Task`).
- `Release()` / `Release(int releaseCount)` — release and returns previous count (int).
- `CurrentCount` — how many remaining slots are available.
- `AvailableWaitHandle` — a `WaitHandle` (creates kernel object; costly).
- `Dispose()` — clean up.

### Example

**A. Simple async throttling (limit 2 concurrent tasks)**

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    static SemaphoreSlim sem = new SemaphoreSlim(2); // allow 2 concurrent

    static async Task Worker(int id)
    {
        await sem.WaitAsync();
        try
        {
            Console.WriteLine($"[{id}] Entered. CurrentCount={sem.CurrentCount}");
            await Task.Delay(1000); // simulate async work while inside
            Console.WriteLine($"[{id}] Leaving.");
        }
        finally
        {
            int prev = sem.Release();
            Console.WriteLine($"[{id}] Released (previous count was {prev}).");
        }
    }

    static async Task Main()
    {
        var tasks = new Task[5];
        for (int i = 0; i < tasks.Length; i++) tasks[i] = Worker(i);
        await Task.WhenAll(tasks);
        sem.Dispose();
    }
}
```

**B. Wait with timeout and cancellation**

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

class TimeoutDemo
{
    static SemaphoreSlim sem = new SemaphoreSlim(1);

    static async Task TryEnter(int id, int waitMs, CancellationToken ct)
    {
        try
        {
            // Try to acquire with timeout + cancellation:
            var waitTask = sem.WaitAsync(ct);
            if (await Task.WhenAny(waitTask, Task.Delay(waitMs, ct)) == waitTask && waitTask.IsCompletedSuccessfully)
            {
                try
                {
                    Console.WriteLine($"{id}: Acquired");
                    await Task.Delay(500, ct); // do work
                }
                finally
                {
                    sem.Release();
                    Console.WriteLine($"{id}: Released");
                }
            }
            else
            {
                Console.WriteLine($"{id}: Could not acquire within {waitMs}ms");
            }
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine($"{id}: Cancelled while waiting/working");
        }
    }

    static async Task Main()
    {
        using var cts = new CancellationTokenSource();
        var a = TryEnter(1, 2000, cts.Token);
        var b = TryEnter(2, 2000, cts.Token);
        await Task.WhenAll(a, b);
    }
}
```

## What is ValueTask?

- `Task` → a reference type (class). Always allocates on the heap.
- `ValueTask` → a value type (struct). Can avoid allocations if the result is already available synchronously.

It represents an asynchronous operation just like `Task`, but with potential performance benefits in high-throughput
scenarios.

### Why ValueTask Exists

Imagine you write an async method that often completes synchronously (e.g., a cache lookup):

```csharp
async Task<int> GetDataAsync()
{
    if (_cache.TryGetValue("key", out var value))
        return value;              // already ready
    return await FetchFromDb();    // fallback to async
}
```

Here, even when the value is in cache (fast path), the compiler still creates a `Task` object on the heap.
`ValueTask` avoids that by being able to wrap either a result directly or a `Task`.

### Example 1 — Returning ValueTask

```csharp
using System;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        var result1 = await GetValueAsync(true);   // fast path (sync)
        Console.WriteLine($"Result1 = {result1}");

        var result2 = await GetValueAsync(false);  // slow path (async)
        Console.WriteLine($"Result2 = {result2}");
    }

    static ValueTask<int> GetValueAsync(bool fromCache)
    {
        if (fromCache)
        {
            // immediate result, no Task allocation
            return new ValueTask<int>(42);
        }
        else
        {
            // fall back to async Task
            return new ValueTask<int>(Task.Run(async () =>
            {
                await Task.Delay(500);
                return 99;
            }));
        }
    }
}
```

🔍 **Behavior:**

- When `fromCache = true`, no heap allocation → result comes directly.
- When `fromCache = false`, it wraps a `Task`.

## Things to Watch Out For

**Don't `await` a `ValueTask` multiple times**

```csharp
var v = GetValueAsync(true);
var r1 = await v;   // OK
var r2 = await v;   // ❌ undefined behavior
```

With `Task`, you can await multiple times safely. With `ValueTask`, you should only await once.

**Use only if needed**

- If your method is always async, use `Task`.
- If it's sometimes sync, sometimes async, `ValueTask` makes sense.

**Slightly more complex**

- Since `ValueTask` is a struct, passing it around may involve copies. So only use when allocation saving really matters
  (e.g., inside high-performance libraries, servers, etc.).
