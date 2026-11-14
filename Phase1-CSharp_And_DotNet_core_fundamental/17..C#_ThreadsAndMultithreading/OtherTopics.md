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

A **mutex** (mutual exclusion) lets only **one thread at a time** own a resource or enter a critical section. Others calling `WaitOne()` block until the owner releases it.

### When to use

Use a mutex when you need to ensure only one thread or process at a time accesses a resource, such as a single-instance application, file writes, or shared hardware access.

### Is it an OS-level object?

Yes. `System.Threading.Mutex` is a thin wrapper over a **kernel object** (a Windows mutex handle; on Linux/macOS, .NET emulates the same semantics through its own runtime layer). Because it lives in the OS and not inside your process's memory, it has two properties that `lock`/`Monitor` do not:

| | `lock` / `Monitor` | `Mutex` |
|---|---|---|
| Lives in | Your process (managed object header) | The OS (kernel object) |
| Scope | One process only | Can span **processes** (if named) |
| Speed | Fast (nanoseconds) | Slower (kernel transition, ~10-100x) |
| Ownership | Thread-affine | Thread-affine |
| Recursive | Yes | Yes (same thread can acquire repeatedly, and must release the same number of times) |

### Can other processes use it once created?

**Only if it's named.** An unnamed mutex is visible only through the handle in your process. A **named** mutex is registered with the OS under that name, so any process that knows the name can open the same mutex.

Naming notes:
- On Windows, a name like `Global\MyApp` is visible machine-wide, and `Local\MyApp` is visible only within the current session. Without a prefix, it defaults to the session namespace.
- On Linux/macOS, named mutexes are supported in .NET Core, but they are visible machine-wide (backed by files under a temp directory), and the `Global\`/`Local\` distinction is simulated.

The named mutex exists as long as **at least one handle** to it is open. When the last process disposes or exits, the OS destroys it.

---

### Members, with examples

#### 1. `new Mutex(bool initiallyOwned)` / `new Mutex(bool, string name)`

```csharp
// Unnamed, not owned: only usable within this process
var m1 = new Mutex(false);

// Unnamed, initially owned by the creating thread
var m2 = new Mutex(true);

// Named: visible to other processes. "createdNew" tells you if YOU created it
using var m3 = new Mutex(initiallyOwned: false, name: @"Global\MyApp.Mutex", out bool createdNew);
Console.WriteLine(createdNew ? "I created it" : "It already existed, I opened it");
```

The 3-argument overload with `out bool createdNew` is the one to prefer for named mutexes, because it tells you whether you are the first owner.

**Gotcha:** `initiallyOwned: true` only grants ownership if `createdNew` is true. If the mutex already existed, you do not own it even though you passed `true`.

#### 2. `WaitOne()` / `WaitOne(int ms)` / `WaitOne(TimeSpan)`: acquire

```csharp
using System;
using System.Threading;

class Program
{
    static readonly Mutex _mutex = new Mutex();
    static int _balance = 0;

    static void Main()
    {
        var threads = new Thread[4];
        for (int i = 0; i < threads.Length; i++)
        {
            threads[i] = new Thread(Deposit);
            threads[i].Start();
        }
        foreach (var t in threads) t.Join();

        Console.WriteLine($"Balance: {_balance}");   // always 4000
    }

    static void Deposit()
    {
        for (int i = 0; i < 1000; i++)
        {
            _mutex.WaitOne();            // block until we own it
            try
            {
                _balance++;              // critical section
            }
            finally
            {
                _mutex.ReleaseMutex();   // always release, even on exception
            }
        }
    }
}
```

**With a timeout:**

```csharp
if (_mutex.WaitOne(TimeSpan.FromSeconds(2)))
{
    try { /* use resource */ }
    finally { _mutex.ReleaseMutex(); }
}
else
{
    Console.WriteLine("Couldn't get the mutex in 2s, giving up");
}
```

`WaitOne` returns `true` if acquired and `false` on timeout. **Only release if it returned true**, otherwise `ReleaseMutex` throws.

#### 3. `ReleaseMutex()`: release

Shown above. Two rules:

- **Only the owning thread can release.** Calling it from another thread, or without owning it, throws `ApplicationException` (`ReleaseMutex` on a non-owned mutex).
- If the same thread acquired it **N times** (recursion), it must call `ReleaseMutex` **N times**.

```csharp
_mutex.WaitOne();
_mutex.WaitOne();        // same thread: succeeds immediately (count = 2)
_mutex.ReleaseMutex();   // count = 1, still owned
_mutex.ReleaseMutex();   // count = 0, now free
```

This differs from `SemaphoreSlim`, which has no owner and can be released from any thread.

#### 4. `OpenExisting(string name)`: open a mutex created elsewhere

Opens a named mutex that already exists, and **does not acquire it**. You get a handle; you still need to call `WaitOne()` to own it. It throws `WaitHandleCannotBeOpenedException` if no mutex with that name exists.

```csharp
// Process B
try
{
    using var m = Mutex.OpenExisting(@"Global\MyApp.Mutex");
    Console.WriteLine("Opened existing mutex (not owned yet)");

    m.WaitOne();                 // now actually acquire it
    try { /* shared resource */ }
    finally { m.ReleaseMutex(); }
}
catch (WaitHandleCannotBeOpenedException)
{
    Console.WriteLine("Mutex doesn't exist yet");
}
```

There is also `Mutex.TryOpenExisting(name, out Mutex result)`, which returns `false` instead of throwing.

#### 5. `Dispose()`: release the native handle

`Dispose` closes **your handle** to the kernel object. It does **not** release ownership, and it does not destroy the mutex if other handles exist.

```csharp
using (var m = new Mutex(false, @"Global\MyApp.Mutex"))
{
    m.WaitOne();
    try { /* work */ }
    finally { m.ReleaseMutex(); }
}   // Dispose() called here: handle closed
```

If you dispose while still owning the mutex, the OS treats it as abandoned (see below), so release first, then dispose.

#### 6. Abandoned mutex: `AbandonedMutexException`

If a thread **exits without releasing** the mutex (crash, killed process, forgot `ReleaseMutex`), the OS marks it **abandoned**. The next thread to call `WaitOne()` **does acquire it**, but `WaitOne` throws `AbandonedMutexException` to warn you that the protected data may be in an inconsistent state.

```csharp
var m = new Mutex();

var t = new Thread(() =>
{
    m.WaitOne();
    // thread exits WITHOUT calling ReleaseMutex → abandoned
});
t.Start();
t.Join();

try
{
    m.WaitOne();
    Console.WriteLine("Acquired normally");
}
catch (AbandonedMutexException)
{
    // We DO own the mutex now, but the previous owner died mid-work.
    Console.WriteLine("Previous owner died; data may be corrupt. Validate or repair it.");
}
finally
{
    m.ReleaseMutex();      // we own it either way, so release it
}
```

Key point: the exception does not mean you failed to get the lock. **You own it.** Check the shared state, repair if needed, and release.

### Classic use: single-instance application

This is the most common real-world use of a named mutex:

```csharp
using System;
using System.Threading;

class Program
{
    static void Main()
    {
        using var mutex = new Mutex(true, @"Global\MyApp.SingleInstance", out bool createdNew);

        if (!createdNew)
        {
            Console.WriteLine("Another instance is already running.");
            return;
        }

        Console.WriteLine("Running. Press Enter to exit.");
        Console.ReadLine();

        mutex.ReleaseMutex();
    }
}
```

Run two copies: the second prints the message and exits, because the first process holds the named mutex.

### Mutex vs lock: when to use which

- **Threads in one process** → `lock` (faster, simpler).
- **Coordination across processes** (single-instance check, shared file or device access) → named `Mutex`.
- **Need N concurrent holders, not just 1** → `Semaphore`/`SemaphoreSlim`.
- **Async code** → `Mutex` and `lock` don't work across `await` (thread-affine). Use `SemaphoreSlim(1,1)` with `WaitAsync()`.

### Mutex lifetime: handles and destruction

**Yes, that's right.** A named mutex is a kernel object that is **reference-counted by handles**. It lives as long as at least one handle to it is open, anywhere on the machine.

| Situation when you call `Dispose()` | Result |
|---|---|
| **Your handle is the last one** | The mutex is **destroyed** and its name disappears. |
| **Someone else also has a handle** (another thread or process opened it) | Only your handle closes. The mutex **keeps existing**, with the same name, state and owner. |

#### Timeline example

```csharp
Process A: new Mutex(false, @"Global\Demo")        → handles: 1 (A)   mutex created
Process B: Mutex.OpenExisting(@"Global\Demo")      → handles: 2 (A,B) same mutex
Process A: Dispose()                               → handles: 1 (B)   mutex STILL exists
Process B: WaitOne() / ReleaseMutex()              → works normally
Process B: Dispose()                               → handles: 0       mutex DESTROYED
```

If A had disposed while no one else had it open, the mutex would be gone. A later `new Mutex(false, @"Global\Demo", out createdNew)` would create a **brand new** one, and `createdNew` would be `true`. `Mutex.OpenExisting` would throw `WaitHandleCannotBeOpenedException`.

#### What "a handle" means in code

Each of these creates its **own handle**:

```csharp
var a = new Mutex(false, "Demo");           // handle 1
var b = new Mutex(false, "Demo");           // handle 2, same kernel mutex (createdNew = false)
var c = Mutex.OpenExisting("Demo");         // handle 3, same kernel mutex
```

So disposing `a` does not affect `b` or `c`. But if several threads share the **same C# object** (`a`), that's **one handle**, and disposing it closes it for all of them. That's why the "dispose while others use the same object" case breaks things (`ObjectDisposedException`).

#### This is why the single-instance pattern works

```csharp
using var mutex = new Mutex(true, @"Global\MyApp.SingleInstance", out bool createdNew);
```

- First instance creates it and holds the handle until the process exits.
- A second instance sees `createdNew == false`, because the mutex still exists.
- When the first exits, its handle closes, the mutex is destroyed, and the next launch is "first" again.

This is also why you must keep the `Mutex` object **alive for the app's lifetime**. If it gets garbage collected or disposed early, the handle closes, the mutex disappears, and a second instance can start.

#### Caveats

- **Ownership vs handles:** closing a handle does not release ownership by itself. Ownership is tied to the *thread*. Always call `ReleaseMutex()` before `Dispose()` rather than relying on destruction behavior.
- **Linux/macOS:** .NET emulates named mutexes (backed by files/shared memory), so edge-case behavior on destruction and abandonment can differ from Windows. The "last handle closed → gone" rule still holds as the general model.

### One-line summary

A `Mutex` is an OS-level, thread-owned lock. Unnamed it works within one process; **named**, it works across processes. Always acquire with `WaitOne`, release in a `finally`, and handle `AbandonedMutexException` when a previous owner died.

**And:** the mutex object stays alive while **any** handle is open and is destroyed when the **last** one is closed. `Dispose` only removes your handle, so whether the mutex survives depends on whether anyone else still holds one.

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
                Console.WriteLine("Another instance is already running.");
                return;
            }

            Console.WriteLine("Single instance started.");
        }
    }
}
```

### How to observe each feature

- **`WaitOne`**: add a `Thread.Sleep` inside the critical section and run multiple threads to see blocking.
- **`TryEnter`**: use `Monitor.TryEnter` with a timeout to see whether it acquired in time.
- **`OpenExisting`**: run one process creating the mutex and another process opening it with the same name.
- **`AbandonedMutexException`**: start two copies. While the second is waiting, kill the first process (close the console window or use Task Manager) without releasing. The second copy will acquire the mutex and immediately receive `AbandonedMutexException`.
## Semaphore — definition & use cases

**Definition:** A `Semaphore` (from `System.Threading.Semaphore`) is a kernel-backed synchronization primitive that maintains a count of how many threads (or processes) may enter a protected section. It can be named, so different processes can open the same semaphore and coordinate across process boundaries. It exposes a `WaitHandle` (so it works with `WaitOne`, `WaitAny`, `WaitAll`).

### Typical use cases

- **Cross-process coordination** — e.g., ensure only one instance of an application (or only N instances) access a shared resource (file, device, license file) at a time.

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
        const string name = "Global\MyNamedSemaphore";
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

`SemaphoreSlim` is a lightweight, managed semaphore designed for in-process synchronization. It avoids kernel transitions for most operations, supports `WaitAsync` for async/await workflows, and is much faster than the kernel `Semaphore` for thread/task coordination inside the same process.

### Typical use cases

- **Limit concurrent tasks/threads inside a process** — e.g., throttle number of parallel background jobs, limit concurrent HTTP requests/worker threads, cap number of concurrent DB calls.
- **Async-friendly throttling** — use `WaitAsync` in code that uses async/await to avoid blocking threads.

> **Note:**
>
> Think of a scenario using `SemaphoreSlim` with a concurrency of 2, where both tasks call an async function and then update a shared value. Does that affect other threads?
>
> Yes — if `SemaphoreSlim` is created with a concurrency of 2, two tasks may be inside the protected section at the same time, so they can affect each other when they both call an async function that awaits and then updates a shared value. `SemaphoreSlim` only limits how many can enter; it does not prevent interference between those that are allowed in concurrently.

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

It represents an asynchronous operation just like `Task`, but with potential performance benefits in high-throughput scenarios.

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

Here, even when the value is in cache (fast path), the compiler still creates a `Task` object on the heap. `ValueTask` avoids that by being able to wrap either a result directly or a `Task`.

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

- Since `ValueTask` is a struct, passing it around may involve copies. So only use when allocation saving really matters (e.g., inside high-performance libraries, servers, etc.).
