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
