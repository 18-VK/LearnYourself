# Asynchronous Programming in C#

> **Note:** Must watch this, <https://youtu.be/il9gl8MH17s>
>
> **Note:** Go through `using` keyword uses

## Threads

A thread is the smallest unit of execution in an operating system. In .NET, threads are managed by the Common Language
Runtime (CLR). Each thread can execute code independently. When you run a C# application, it starts in a single thread
created by the CLR, known as the main thread. Additional threads can be created and used to perform other tasks
concurrently.

## Thread Pool

The thread pool is a collection of worker threads maintained by the CLR. When a task is ready to run, a thread from
the pool is assigned to it. Once the task is completed, the thread returns to the pool, ready to be reused for another
task.
These threads are managed efficiently to handle multiple tasks without the overhead of creating and destroying threads
repeatedly.

## Threads in Asynchronous Programming

In synchronous programming, each task would require a dedicated thread that would be blocked while waiting for the
task to complete, like waiting for a file to be read or a network response. This can be inefficient, especially under
heavy load, as it can lead to a large number of threads, each consuming system resources.

Asynchronous programming changes this by allowing threads to be used more efficiently.

## Where is Asynchronous Programming helpful?

**Web/UI Applications:** To keep the UI responsive while performing long-running tasks like file I/O, network requests, or
complex calculations and to handle multiple requests simultaneously.

**Server Applications:** For handling a large number of concurrent connections without tying up threads.

## `async` and `await`

`async` and `await` are two keywords in C# that are central to writing asynchronous code. They were introduced to simplify
writing asynchronous code, which is crucial for performing non-blocking operations and for improving the scalability
and responsiveness of applications.

### `async` Keyword

- The `async` keyword is used to declare a method as asynchronous.
- An `async` method can contain one or more `await` expressions or statements. It indicates that the method contains
  operations that may take some time and are performed asynchronously.
- An `async` method can return `Task`, or `Task<T>`. `Task` is used for asynchronous methods that do not return a value, and
  `Task<T>` is used for those that return a value.

### `await` Keyword

- The `await` keyword is used in front of a call to an async method or task.
- The `await` keyword yields control back to the caller of the async method. This means that the thread that called the
  method can continue doing other work rather than waiting for the async operation to complete.

## Code Snippets

### How to Return Data with Async Programming

To return data from an asynchronous method, you use the `Task<T>` type.

```csharp
public async Task<string> GetDataAsync()
{
    // simulate a task like fetching data from a database
    await Task.Delay(1000);

    return "Sample Data";
}
```

### How to Call a Void Method with Async

For methods that do not return a value, use the `Task` type without a generic type parameter.

```csharp
public async Task PerformTaskAsync()
{
    // perform some asynchronous operation
    await Task.Delay(1000);
}
```

## Cancel async request / Cancelling an Async Call

Cancellation a async call is handled using the `CancellationToken` and `CancellationTokenSource` classes. Suppose you have
a web service that processes data, but you want to give the client the ability to cancel the request if it takes too
long.

**For example:**

```csharp
async Task CancellableDelay(CancellationToken ct)
{
    Console.WriteLine("Work started");
    // Pass token to Task.Delay so it cancels cooperatively
    await Task.Delay(5000, ct);
    Console.WriteLine("Work finished");
}

var cts = new CancellationTokenSource();
var task = CancellableDelay(cts.Token);

// cancel after 1 second
cts.CancelAfter(1000);

try
{
    await task;
}
catch (OperationCanceledException)
{
    Console.WriteLine("Task was canceled");
}
```

**Example:**

```csharp
// cancelling HttpClient requests

using var http = new HttpClient();
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3)); // 3s timeout

try
{
    var response = await http.GetAsync("https://example.com/large", cts.Token);
    response.EnsureSuccessStatusCode();
    var text = await response.Content.ReadAsStringAsync(cts.Token);
    Console.WriteLine("Downloaded " + text.Length);
}
catch (OperationCanceledException)
{
    Console.WriteLine("Request was canceled (timeout or explicit).");
}
catch (Exception ex)
{
    Console.WriteLine("Other error: " + ex.Message);
}
```
## What happens when you call an async method or do async I/O

### The short version

1. The method **starts on the caller's thread** and runs like normal code.
2. At the first `await` on something **not yet finished**, the method **pauses** and returns an incomplete `Task` to its caller. The thread is released.
3. The **OS, hardware, or a timer** does the waiting. No thread is involved.
4. When it finishes, the **rest of the method (the continuation)** is scheduled.
5. Where it runs depends on the **context captured at the `await`**, not on which thread started the method.

### Step by step

```csharp
static async Task<string> GetAsync()
{
    Console.WriteLine("A");                         // (1) caller's thread
    string s = await http.GetStringAsync(url);      // (2) pause here
    Console.WriteLine("B");                         // (4) continuation
    return s;
}
```

```
Calling thread        OS / hardware / timer           Who runs the continuation
──────────────        ────────────────────            ─────────────────────────
(1) runs "A"
(2) sends request ──► I/O in progress
    returns Task          (no .NET thread waiting)
    thread is FREE             │
        │                      ▼
   other work             I/O done: OS signals
                               │
                               ▼
                          (3) completion is queued ──► (4) runs "B" on a thread
                                                           chosen by the rules below
```

### Who does what

| Part | Who does it |
|---|---|
| Code before the first incomplete `await` | **The caller's thread**, synchronously |
| The actual I/O (network, disk) | **OS and hardware** (DMA, interrupts). No .NET thread |
| `Task.Delay` waiting | **A timer**. No thread waits |
| Noticing the completion | A tiny runtime mechanism (IOCP on Windows, epoll on Linux, a timer thread) that only **queues** the continuation |
| Code after the `await` | **A thread chosen by the scheduling rules**, see below |

### Where does the continuation resume?

At the `await`, the runtime looks at the **context of the code that awaited**:

```
Is there a SynchronizationContext (UI app, old ASP.NET)?
├─ Yes → post the continuation back to it
│        (WinForms/WPF: back on the UI thread)
└─ No
    Is there a custom TaskScheduler?
    ├─ Yes → queue to that scheduler
    └─ No (the normal console / ASP.NET Core case)
         → the continuation runs on the thread pool
           (either inline on the thread that completed the awaited task,
            or queued to a free pool thread)
```

| App type | After `await` you usually resume on |
|---|---|
| **WinForms / WPF** | The **UI thread** (context captured) |
| **ASP.NET Core** | **Any thread pool thread** (no context). Not the original request thread |
| **Console app** | **A thread pool thread**, usually |
| **Any app with `ConfigureAwait(false)`** | A thread pool thread, ignoring the context |

Two things are **not guaranteed** and shouldn't be relied on:

- That the continuation runs on a thread **different** from the starting one.
- That it runs on the **same** thread. Pool threads are interchangeable, and a thread may be reused or not.

### Special case: the awaited task is already finished

```csharp
await Task.CompletedTask;          // already complete
await Task.Delay(0);               // already complete
await cachedTask;                  // finished earlier
```

If the task is already complete at the `await`, the method **doesn't pause at all**. It continues **synchronously on the same thread**, with no thread switch.

### Nested async calls (what your program does)

```
Main awaits func(), func awaits DemoAsync(), DemoAsync awaits Task.Delay
```

Each `await` registers its **own** continuation. When the inner task completes, its continuation runs, then that completes the next task up, whose continuation runs, and so on. The chain unwinds from the inside out.

Each continuation uses the same rules from the diagram above, based on the context at **its own** `await`. By default, the awaiter of a task tries to run its continuation **inline on the thread that completed it**. Both "same thread" and "different thread" results are normal and valid.

### Who triggers completion

| Awaiting | Completion signaled by | Continuation runs on |
|---|---|---|
| `GetStringAsync`, `ToListAsync`, `ReadAsync` (real I/O) | OS I/O completion | Per the rules (pool thread, or UI thread in a UI app) |
| `Task.Delay(500)` | A timer | Per the rules |
| `Task.Run(() => Work())` | A **pool thread finishing your delegate** | Per the rules |
| `await someTcs.Task` | Whoever calls `SetResult` | Per the rules (it can run inline on the thread calling `SetResult`, which is why `RunContinuationsAsynchronously` exists) |

Only `Task.Run` (and similar) uses a pool thread for the **work itself**. For I/O and timers, a thread only appears at the **end**, to run the continuation.

### `ConfigureAwait(false)`

```csharp
string s = await http.GetStringAsync(url).ConfigureAwait(false);
// resume on a pool thread, don't go back to the captured context
```

- Use it in **library code** so a UI thread isn't required for the continuation.
- In ASP.NET Core application code it makes no practical difference, since there is no context.
- Don't use it in UI event handlers if the next line touches controls.

### Concrete examples

**WinForms button click**

```csharp
private async void Button_Click(object sender, EventArgs e)
{
    // runs on UI thread
    var data = await http.GetStringAsync(url);   // UI thread released, window stays responsive
    // resumes on the UI thread (context captured)
    label.Text = data;                           // safe
}
```

**ASP.NET Core endpoint**

```csharp
app.MapGet("/users", async (AppDbContext db) =>
{
    // starts on pool thread X
    var users = await db.Users.ToListAsync();    // thread X released to serve other requests
    // resumes on pool thread Y (maybe X, maybe not)
    return users;
});
```

### About your output

Your output showed `After Task.Delay` on Thread 11 but `func completed` and `Main end` back on Thread 1. That mix isn't the typical pattern for a plain console app, so I don't want to explain it with certainty. The rules above say a continuation can run inline or be queued, and which thread it ends up on is an implementation detail. If you run the diagnostic lines I suggested earlier (`SynchronizationContext.Current`, `TaskScheduler.Current`, runtime version) and tell me how you launched the program, I can say what your environment is doing.

### One-line summary

> The caller's thread runs the method **until the first incomplete `await`**, then is released. The **OS, hardware, or a timer** does the waiting with no thread. When done, the continuation resumes on **whatever the captured context says**: the UI thread in a UI app, otherwise a **thread pool thread**, which may or may not be the original one.

## Dispose in C#

In C#, `Dispose()` is a method defined by the `IDisposable` interface, used to release unmanaged resources (like file
handles, database connections, network sockets, etc.) when an object is no longer needed.

### Why `Dispose()` Exists

- Managed resources (like normal C# objects) are cleaned up automatically by the Garbage Collector (GC).
- Unmanaged resources (like OS file handles, GDI objects, native memory) are not cleaned up automatically.
- `Dispose()` gives you a way to free those resources explicitly instead of waiting for finalization.

**For example:**

```csharp
public class FileWriter : IDisposable
{
    private StreamWriter writer;

    public FileWriter(string path)
    {
        writer = new StreamWriter(path);
    }

    public void WriteData(string data)
    {
        writer.WriteLine(data);
    }

    public void Dispose()
    {
        // Release the StreamWriter and file handle
        writer?.Dispose();
        Console.WriteLine("Resources released.");
    }
}
```

## `using` keyword

In C#, `using` has three different purposes, depending on context — and they're quite different.

### 1) `using` Directive – Import Namespaces

This is the most common usage, placed at the top of a file.

**Example:**

```csharp
using System;
using System.Collections.Generic;
```

### 2) `using` Statement – Automatic Resource Cleanup (`IDisposable`)

This is a special statement for objects that implement `IDisposable` (e.g., files, DB connections, streams).
It ensures the object is disposed of automatically when the block ends — even if an exception occurs.

**Example:**

```csharp
using (var reader = new StreamReader("data.txt"))
{
    string content = reader.ReadToEnd();
    Console.WriteLine(content);
} // reader.Dispose() is automatically called here
```

or

```csharp
using var reader = new StreamReader("data.txt");
string content = reader.ReadToEnd();
// reader.Dispose() automatically called when method ends
```

**Why?**

- Prevents memory leaks and resource locks.
- Cleaner alternative to manually calling `.Dispose()` in try/finally.

### 3) `using` Alias – Shorten or Disambiguate Names

You can use `using` to create an alias for a namespace or type.

```csharp
using ProjectA = MyCompany.ProjectAlpha;
using IntList = System.Collections.Generic.List<int>;

class Program
{
    static void Main()
    {
        IntList numbers = new IntList(); // alias for List<int>
    }
}
```

## Raise flag to stop async call

The "flag" is set by calling `Cancel()` on `CancellationTokenSource`.

```csharp
async Task DoWorkAsync(CancellationToken token)
{
    try
    {
        while (true)
        {
            token.ThrowIfCancellationRequested();
            await Task.Delay(500, token);
        }
    }
    catch (OperationCanceledException)
    {
        // expected, do cleanup
    }
}

CancellationTokenSource cts = new CancellationTokenSource();

// start work
await DoWorkAsync(cts.token)

// raise stop signal (flag)
cts.Cancel();
```
