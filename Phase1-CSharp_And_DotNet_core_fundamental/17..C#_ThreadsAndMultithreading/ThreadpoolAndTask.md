# ThreadPool

`ThreadPool` is a CLR-managed pool of worker threads (and I/O completion threads). Use it for many short-lived background
tasks. Most code uses `Task.Run` (which uses the pool) instead of calling `ThreadPool` directly.

## ThreadPool methods

- `ThreadPool.QueueUserWorkItem(WaitCallback callback)`
- `ThreadPool.QueueUserWorkItem(WaitCallback callback, object? state)` — queue a simple work item to run on a pool thread.

- `ThreadPool.GetMaxThreads(out int workerThreads, out int completionPortThreads)` — read caps.
- `ThreadPool.GetAvailableThreads(out int workerThreads, out int completionPortThreads)` — how many worker threads are free right now.

- `ThreadPool.GetMinThreads(out int workerThreads, out int completionPortThreads)` — read minimums.
- `ThreadPool.SetMinThreads(int workerThreads, int completionPortThreads)` — request a higher minimum so threads are pre-created (global process setting).

- `ThreadPool.SetMaxThreads(int workerThreads, int completionPortThreads)` — set an upper bound (use with care).
- `ThreadPool.RegisterWaitForSingleObject(WaitHandle waitObject, WaitOrTimerCallback callback, object? state, uint millisecondsTimeOutInterval, bool executeOnlyOnce)` — run a callback when a wait-handle is signaled or times out (runs on pool thread).

> **Notes:** ThreadPool threads are background threads and reused. Don't block them long — use async I/O or dedicated threads
> for long-blocking work.

## Examples

### 1) Basic `QueueUserWorkItem` + observing pool capacity

```csharp
using System;
using System.Threading;

class ThreadPoolExamples {
    static void Main() {
        // Simple work item
        ThreadPool.QueueUserWorkItem(state => {
            Console.WriteLine($"Hello from pool thread {Thread.CurrentThread.ManagedThreadId}");
        });

        // With state, state is nothing, you can consider it as parameter with delegate
        ThreadPool.QueueUserWorkItem(state => {
            Console.WriteLine($"Got state: {state} on thread {Thread.CurrentThread.ManagedThreadId}");
        }, "my-state");

        // Inspect pool counts
        ThreadPool.GetMaxThreads(out int maxW, out int maxIO);
        ThreadPool.GetAvailableThreads(out int availW, out int availIO);
        Console.WriteLine($"Max worker threads: {maxW}, available worker right now: {availW}");

        // Register for wait handle (callback on pool thread)
        using (AutoResetEvent ev = new AutoResetEvent(false)) {
            RegisteredWaitHandle reg = ThreadPool.RegisterWaitForSingleObject(
                ev,
                (state, timedOut) => Console.WriteLine($"Wait callback on {Thread.CurrentThread.ManagedThreadId}, timedOut={timedOut}"),
                null,
                millisecondsTimeOutInterval: 2000,
                executeOnlyOnce: true);

            // signal the event after a short delay
            ThreadPool.QueueUserWorkItem(_ => {
                Thread.Sleep(300);
                ev.Set();
            });

            // wait a bit so callbacks run before process exits
            Thread.Sleep(1000);
            reg.Unregister(null);
        }
    }
}
```

**When to use direct `ThreadPool` APIs:**

- Low-level scenarios, integration with native wait handles, or extreme performance tuning.
- Otherwise prefer `Task`/`Task.Run` — they wrap `ThreadPool` and give better composition, cancellation, and exception
  handling.

### 2) Example with main thread activity

```csharp
using System;
using System.Threading;

class Program
{
    static void Main()
    {
        Console.WriteLine($"[Main]   ID: {Thread.CurrentThread.ManagedThreadId}");

        // Queue a background task on the ThreadPool
        ThreadPool.QueueUserWorkItem(WorkerTask, "Task 1");

        Console.WriteLine("[Main]   Doing other work...");

        // Simulate some main thread work
        for (int i = 1; i <= 5; i++)
        {
            Console.WriteLine($"[Main]   Step {i}");
            Thread.Sleep(500);
        }

        // Wait a bit so we can observe ThreadPool activity
        Thread.Sleep(3000);

        Console.WriteLine("[Main]   Finished");
    }

    // ThreadPool callback signature: void(object state)
    static void WorkerTask(object state)
    {
        Console.WriteLine($"[Worker] Started on ID: {Thread.CurrentThread.ManagedThreadId}, State: {state}");

        for (int i = 1; i <= 3; i++)
        {
            Console.WriteLine($"[Worker] Processing {i}");
            Thread.Sleep(700); // simulate work
        }

        Console.WriteLine("[Worker] Done");
    }
}
```

> **Note:** `QueueUserWorkItem` is fire-and-forget; there's no return value.
> Use `Task.Run` if you need a result.

# Task

`Task` is the recommended higher-level abstraction for asynchronous and parallel work. `Task` instances typically run on the
`ThreadPool` (when started with `Task.Run` or queued), but they can represent any asynchronous operation (including I/O that
doesn't use any thread while awaiting).

## Task methods

### 1) Creation / starting

- `Task.Run(Action)` / `Task.Run(Func<Task>)` — schedule work to the thread pool and return a `Task` you can await.
- `Task.Factory.StartNew(Action, TaskCreationOptions)` — older API; use `Task.Run` unless you need advanced options (e.g.
  `LongRunning`).
- `new Task(Action)` + `Start()` — manual start.

### 2) Waiting / composition

- `await task` — preferred (async/await).
- `Task.Wait()` / `Task.WaitAll(...)` — blocking wait.
- `Task.WhenAll(...)` / `Task.WhenAny(...)` — non-blocking composition returning `Task`s you can await.

### 3) Continuation

- `task.ContinueWith(...)` — execute when a task completes (synchronous APIs, not recommended in new async code; prefer async/await).

### 4) Results / status

- `Task<TResult>` exposes `.Result`, `.Status` (`RanToCompletion`, `Faulted`, `Canceled`), `.Exception` (`AggregateException`).

### 5) Cancellation

- Use `CancellationToken` (passed into operation) and cooperatively check `token.ThrowIfCancellationRequested()` or `token.IsCancellationRequested`.

### 6) `TaskCompletionSource<T>`

Create a `Task` and control its completion from outside (useful to bridge callback/APM patterns to Tasks).

### 7) `TaskCreationOptions`

- `LongRunning` (hint to scheduler to create a dedicated thread), `PreferFairness`, `DenyChildAttach`, etc.

### 8) `TaskScheduler`

Controls how tasks are scheduled (default: ThreadPool `TaskScheduler`).

> **Note:** we'll go through `TaskScheduler` and `TaskCompletionSource<T>` seperatly

## Examples

### 1) `Task.Run` + async/await (recommended)

```csharp
using System;
using System.Threading.Tasks;

class TaskExample1 {
    static async Task Main() {
        // CPU-bound short work on ThreadPool
        Task<int> t = Task.Run(() => {
            int sum = 0;
            for (int i = 1; i <= 1000; i++) sum += i;
            return sum;
        });

        int result = await t; // asynchronously wait
        Console.WriteLine($"Sum = {result}");
    }
}
```

### 2) Task with `CancellationToken`

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

class CancellationExample {
    static async Task Main() {
        using CancellationTokenSource cts = new CancellationTokenSource();

        Task longTask = Task.Run(() => {
            for (int i = 0; i < 20; i++) {
                if (cts.Token.IsCancellationRequested) {
                    Console.WriteLine("Cancellation requested, cleaning up...");
                    cts.Token.ThrowIfCancellationRequested();
                }
                Console.WriteLine($"Working {i}");
                Thread.Sleep(200); // simulate work
            }
        }, cts.Token);

        // Cancel after 700ms
        Task.Delay(700).ContinueWith(_ => cts.Cancel());

        try {
            await longTask;
        } catch (OperationCanceledException) {
            Console.WriteLine("Task was cancelled.");
        }
    }
}
```

or

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        // 1️⃣ Create a CancellationTokenSource with a 10-second timeout
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        CancellationToken token = cts.Token;

        Console.WriteLine("Task started. It will be cancelled automatically after 10 seconds.");

        try
        {
            // 2️⃣ Start a long-running task and pass the token
            await Task.Run(() => DoWork(token), token);

            Console.WriteLine("Task completed before timeout.");
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("Task was cancelled due to timeout.");
        }
    }

    static void DoWork(CancellationToken token)
    {
        int i = 0;
        while (true)
        {
            // 3️⃣ Check for cancellation regularly
            token.ThrowIfCancellationRequested();

            Console.WriteLine($"Working... {++i}");
            Thread.Sleep(1000); // simulate work
        }
    }
}
```

> **Note: Handling Cancellation**
> `await Task.Run(...)` is wrapped in a `try/catch (OperationCanceledException)` to handle the graceful exit.

### 3) `Task.WhenAll` / `WhenAny` and exception handling

```csharp
using System;
using System.Threading.Tasks;

class WhenAllExample {
    static async Task Main() {
        var tasks = new[] {
            Task.Run(() => { Task.Delay(200).Wait(); return 1; }),
            Task.Run(() => { Task.Delay(100).Wait(); throw new Exception("fail"); })
        };

        try {
            int[] results = await Task.WhenAll(tasks); // will throw if any task faulted
            Console.WriteLine(string.Join(",", results));
        } catch (Exception ex) {
            // WhenAll throws the first observed exception as AggregateException when awaited
            Console.WriteLine("At least one task failed: " + ex.Message);
            foreach (var t in tasks) {
                if (t.IsFaulted) Console.WriteLine(" - Faulted: " + t.Exception!.Flatten().InnerException?.Message);
            }
        }
    }
}
```

### 4) `Task.Factory.StartNew` vs `Task.Run` (and `LongRunning`)

```csharp
// Task.Run is roughly equivalent to:
// Task.Factory.StartNew(action, CancellationToken.None, TaskCreationOptions.DenyChildAttach, TaskScheduler.Default)

// Use StartNew when you need TaskCreationOptions:
var long = Task.Factory.StartNew(() => {
    // heavy blocking work - prefer LongRunning so scheduler may create dedicated thread
    Thread.Sleep(5000);
}, TaskCreationOptions.LongRunning);

// But most of the time prefer:
var t = Task.Run(() => { /* short CPU work */ });
```

## `task.Wait` vs `await`

> Must check: <https://medium.com/@aliyildizoz/async-programming-await-vs-task-wait-vs-task-waitall-8048ecb14a66>

## `Task<TResult>` and `.Result`

`Task<TResult>` is the generic version of `Task` that represents an asynchronous operation returning a value of type `TResult`.
The `.Result` property lets you retrieve that value synchronously—but there are important caveats.

### 1️⃣ Declaring and using `Task<TResult>`

```csharp
using System;
using System.Threading.Tasks;

class Program {
    static async Task Main() {
        Task<int> t = Task.Run(() => {
            // some CPU-bound work
            int sum = 0;
            for (int i = 0; i < 1000000; i++) sum += i;
            return sum; // TResult is int
        });

        int result = await t;   // Preferred
        Console.WriteLine(result);
    }
}
```

`Task<int>` is a promise that eventually produces an `int`.

When you `await t`, the compiler unwraps the value.

### 2️⃣ Using the `.Result` property

```csharp
Task<int> t = Task.Run(() => 42);
int value = t.Result;  // Blocks until the task completes
Console.WriteLine(value);
```

- Blocks the calling thread until the task finishes.
- If the task faults, `.Result` throws an `AggregateException` that wraps the original exception.
- If the task is cancelled, it throws an `AggregateException` containing an `OperationCanceledException`.

### Best practice

Prefer `await`:

```csharp
int value = await GetNumberAsync();
```

Non-blocking, exceptions are automatically unwrapped.

Only use `.Result` when:

- You're already on a background/console thread and you absolutely need a synchronous value (e.g., in a `Main` method
  before C# 7.1's `async Main` was available).

- You understand the risk of deadlocks and can guarantee none.
