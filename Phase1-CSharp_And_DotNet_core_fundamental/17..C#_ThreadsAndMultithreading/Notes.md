# Threads and Multithreading in C#

> Must check this link: <https://stackify.com/c-threading-and-multithreading-a-guide-with-examples/>

## Introduction to multithreading in C#

In .NET, a thread is the basic unit of execution that the OS scheduler runs; all threads of a process share the same
memory space. By default a C# program starts with a single (main) thread. Creating additional threads can boost
responsiveness and throughput: e.g. in a GUI app offload long-running or I/O-bound tasks to background threads so the UI
thread doesn't freeze. On a multi-core CPU, independent tasks (such as parallel computations or background network I/O)
can run concurrently to decrease total run time.

However, multithreading adds complexity: accessing shared data requires synchronization (to avoid race conditions).
In modern .NET it's often better to use the Task Parallel Library (TPL) and the thread pool for most parallel work.

- **Use threads for responsiveness:** offload lengthy or blocking operations (disk access, network calls, heavy computation)
  to worker threads so the main thread stays responsive.

- **Use threads for parallelism:** split CPU-bound work into independent tasks when running on a multi-core machine, which
  can reduce total execution time.

- **Preferred alternatives:** .NET's built-in `ThreadPool` and TPL (Tasks, PLINQ) should be used when possible, since they
  efficiently manage threads under the hood.

## The Thread class

The `System.Threading.Thread` class represents a managed thread. It lets you create a new OS thread, set its priority,
check its state, etc. To start a thread, supply a delegate (the method to run) to the `Thread` constructor and then call `Start()`.

## Thread lifecycle methods

- **`Thread.Join()`** – blocks the calling thread until the target thread finishes. This is a synchronization method: the main
  thread (for example) waits inside `Join()` until the worker thread has terminated.

- **`Thread.Sleep(milliseconds)`** – suspends the current thread for the given time. It pauses execution (changing the thread
  state to `WaitSleepJoin`) for that interval.
  **Note:** using `Thread.Sleep` for coordination is generally discouraged; prefer synchronization primitives. For instance,
  instead of sleeping to wait forever, use wait handles (`Mutex`, `Monitor`, `EventWaitHandle`, `Semaphore`, etc.)

- **`Thread.Abort()`** – obsolete. In .NET Core / .NET 5+ calling `Abort()` is not supported (it will throw a
  `PlatformNotSupportedException`). `Thread.Abort` was intended to forcefully terminate another thread by throwing a
  `ThreadAbortException`, but it is unsafe and unreliable. As best practice, use cooperative cancellation or other
  coordination instead of aborting threads.

> **Note:** For above methods and given suggestion, we will go through them further.

## Passing methods (delegate) to thread

In C#, you can create threads that execute methods with parameters or without parameters.

### 1) Thread Running a Method Without Parameters

When the method takes no arguments, you can pass a `ThreadStart` delegate.

```csharp
class Program
{
    static void Main()
    {
        // Create a thread that calls the PrintMessage method
        Thread t1 = new Thread(new ThreadStart(PrintMessage));
        t1.Start();

        Console.WriteLine("Main thread completed.");
    }

    static void PrintMessage()
    {
        Console.WriteLine("Hello from thread without parameters!");
    }
}
```

**Key Points:**

`ThreadStart` is a delegate with no parameters and no return value.

You can simplify:

```csharp
Thread t1 = new Thread(PrintMessage);
```

### 2) Thread Running a Method With Parameters

When the method requires an argument, use the `ParameterizedThreadStart` delegate.

```csharp
class Program
{
    static void Main()
    {
        // Create a thread that calls PrintWithParameter and pass a value
        Thread t2 = new Thread(new ParameterizedThreadStart(PrintWithParameter));
        t2.Start("Aman");  // Passing a string argument

        Console.WriteLine("Main thread completed.");
    }

    static void PrintWithParameter(object name)
    {
        Console.WriteLine($"Hello {name}, from thread with parameter!");
    }
}
```

**Key Points:**

- The method signature must accept one `object` parameter.
- You can pass any type, but you need to cast it inside the method if you expect a specific type.

### 3) Modern Alternative: Lambda with Strongly Typed Parameters

Instead of using `ParameterizedThreadStart`, you can capture variables in a lambda, giving you strong typing.

```csharp
class Program
{
    static void Main()
    {
        string user = "Aman";

        Thread t3 = new Thread(() => PrintUser(user));
        t3.Start();

        Console.WriteLine("Main thread completed.");
    }

    static void PrintUser(string name)
    {
        Console.WriteLine($"Hello {name}, from lambda thread!");
    }
}
```

**Advantages:**

- No need to box/unbox or cast.
- Supports multiple parameters easily.

## Returning value from Thread delegate

In C#, a `Thread` does not directly return a value because it represents a fire-and-forget operation.
However, you can still capture results using a few different approaches:

### 1) Use a Shared Variable with `Thread.Join()`

You can store the result in a variable accessible to both the main thread and the worker thread, then wait for the thread to finish.

```csharp
class Program
{
    static void Main()
    {
        int result = 0;

        Thread t = new Thread(() =>
        {
            // Work in the background
            result = Add(10, 20);
        });

        t.Start();
        t.Join();   // Wait for the thread to finish

        Console.WriteLine($"Result from thread: {result}");
    }

    static int Add(int a, int b) => a + b;
}
```

**Points:**

- `t.Join()` blocks the calling thread until the worker completes.

- Ensure the variable (`result`) is accessible and properly synchronized if multiple threads may write to it.
  For simple one-writer scenarios like above, no extra synchronization is needed.

### 2) Use a `Task` (Recommended Modern Approach)

`Task` supports return values out of the box and is easier to manage than raw `Thread`.

```csharp
class Program
{
    static void Main()
    {
        Task<int> t = Task.Run(() => Add(10, 20));

        // Wait and get the result
        int result = t.Result;

        Console.WriteLine($"Result from Task: {result}");
    }

    static int Add(int a, int b) => a + b;
}
```

**Why Prefer `Task`**

- Built-in result (`Task<TResult>`).
- Better error handling (exceptions are captured).
- Integrates with async/await.

> **Note:** will be go through it seperatly

### 3) Using `Thread` with a Strongly Typed Delegate

If you must stay with `Thread` but want strong typing, you can wrap the work in a delegate that returns a value, capture
it, and join.

```csharp
class Program
{
    static void Main()
    {
        int result = 0;
        Thread t = new Thread(() =>
        {
            result = Multiply(7, 6);
        });

        t.Start();
        t.Join();

        Console.WriteLine($"Thread returned: {result}");
    }

    static int Multiply(int x, int y) => x * y;
}
```

## Thread class commonly use methods

### 1) Creating and Starting a Thread

**`Thread.Start([object parameter])`**

Starts the execution of the thread.
Optional parameter is used if you created the thread with `ParameterizedThreadStart`.

```csharp
Thread t = new Thread(PrintMessage);
t.Start();               // start without parameter
// OR
Thread t2 = new Thread(PrintWithParam);
t2.Start("Aman");        // start with a parameter
```

### 2) Controlling Execution

| Member                                 | Purpose                                                                                           | Example                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------- |
| **`Join()`**                           | Blocks the calling thread until the target thread terminates.                                     | `t.Join();`                       |
| **`Sleep(int milliseconds)`** (static) | Suspends the current thread for a given time.                                                     | `Thread.Sleep(1000); // 1 second` |
| **`Interrupt()`**                      | Interrupts a thread that is in the `WaitSleepJoin` state, causing a `ThreadInterruptedException`. | `t.Interrupt();`                  |
| **`Abort()`** *(obsolete)*             | Requests to abort the thread. **Not recommended**—use cancellation tokens instead.                | –                                 |

**Example: Waiting for a worker thread to finish**

```csharp
Thread t = new Thread(() =>
{
    Console.WriteLine("Worker started");
    Thread.Sleep(2000);
    Console.WriteLine("Worker done");
});
t.Start();
t.Join();  // main waits until t finishes
Console.WriteLine("Main continues");
```

### 3) Properties for Thread Information

| Property                     | Type           | Description                                                                         | Example                                    |
| ---------------------------- | -------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| **`Name`**                   | string         | Friendly name for debugging.                                                        | `t.Name = "WorkerThread";`                 |
| **`IsAlive`**                | bool           | True if the thread is still running.                                                | `if(t.IsAlive){...}`                       |
| **`ThreadState`**            | enum           | Current state (Running, WaitSleepJoin, etc.).                                       | `Console.WriteLine(t.ThreadState);`        |
| **`ManagedThreadId`**        | int            | Unique ID assigned by the CLR.                                                      | `Console.WriteLine(t.ManagedThreadId);`    |
| **`IsBackground`**           | bool           | If true, thread does not keep the process alive when all foreground threads finish. | `t.IsBackground = true;`                   |
| **`Priority`**               | ThreadPriority | Scheduling hint (Lowest, BelowNormal, Normal, AboveNormal, Highest).                | `t.Priority = ThreadPriority.AboveNormal;` |
| **`CurrentThread`** (static) | Thread         | Gets the currently executing thread.                                                | `Thread cur = Thread.CurrentThread;`       |

## Foreground vs background thread

The `IsBackground` property of a `Thread` determines whether that thread is a foreground or background thread.
This setting does not change the code the thread runs—the logic of the thread is identical—but it changes how the CLR
(Common Language Runtime) manages the lifetime of the process.

| **Foreground Thread (`IsBackground = false`)**        | **Background Thread (`IsBackground = true`)**                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keeps the **entire process alive** until it finishes. | **Does not keep the process alive.** When all foreground threads end, the CLR will terminate the process, even if background threads are still running. |
| The runtime waits for it to complete before exiting.  | The runtime ends the background thread *abruptly* when the process shuts down—no guarantee of cleanup/finalization.                                     |
| Default for `Thread` if you don’t set `IsBackground`. | Must be explicitly set (or created by the CLR as background, e.g., thread pool threads).                                                                |

### Effect on Program Behavior

**1) With `IsBackground = false` (Foreground – Default)**

```csharp
Thread t = new Thread(LongWork);
t.IsBackground = false; // default anyway
t.Start();
```

If `Main` finishes, the process waits until `t` completes.
Example: a server's main thread ends, but a worker is still saving data → application stays alive until worker finishes.

**2) With `IsBackground = true` (Background)**

```csharp
Thread t = new Thread(LongWork);
t.IsBackground = true;
t.Start();
```

If `Main` finishes before `LongWork` ends, the CLR terminates the entire process immediately, stopping the background thread
mid-execution.
Any work, file writes, or cleanup in that thread may be incomplete.

### Demonstration

```csharp
using System;
using System.Threading;

class Demo
{
    static void Main()
    {
        Thread t = new Thread(() =>
        {
            for (int i = 0; i < 5; i++)
            {
                Console.WriteLine($"Working {i}");
                Thread.Sleep(1000);
            }
            Console.WriteLine("Thread finished");
        });

        // Change this to false and see the difference
        t.IsBackground = true;  

        t.Start();
        Console.WriteLine("Main exiting");
    }
}
```

**If `IsBackground = true`**

Output might be:

```text
Main exiting
Working 0
Working 1
```

Process ends abruptly after `Main` returns—background thread stops before finishing.

**If `IsBackground = false`**

Output:

```text
Main exiting
Working 0
Working 1
Working 2
Working 3
Working 4
Thread finished
```

The process stays alive until the worker completes.

> **Note:** Thread Pool threads (Tasks, `ThreadPool.QueueUserWorkItem`, async/await) are always background threads, which is
> why the process can exit when all foreground work is done.

## Interrupt Method

`Interrupt()` does not kill a thread; it just throws an exception inside it if/when the thread is in a wait/sleep/join
state.

**If the Thread Isn't Sleeping**

If the thread is running normally (not blocked), the interrupt request is "remembered."
The exception is thrown the next time the thread enters a blocking call such as `Sleep`, `Join`, or a wait handle.

**When to Use:**

To cancel or signal a thread that might be waiting for I/O, sleeping, or joined, and you want a graceful stop.
For example:

- Stopping a polling thread that sleeps between checks.
- Cancelling a thread that waits on `Thread.Join` or `Monitor.Wait`.

## Pause the thread

Because `Suspend` is unsafe, .NET provides cooperative suspension techniques — meaning the thread decides when to pause,
rather than being forced externally.

**Option 1: Using a flag and `ManualResetEventSlim`**

```csharp
ManualResetEventSlim pauseEvent = new ManualResetEventSlim(true);
bool running = true;

Thread t = new Thread(() =>
{
    while (running)
    {
        pauseEvent.Wait(); // wait here if paused
        Console.WriteLine("Working...");
        Thread.Sleep(500);
    }
    Console.WriteLine("Thread stopped.");
});

t.Start();

Thread.Sleep(2000);
Console.WriteLine("Pausing...");
pauseEvent.Reset();  // pauses the thread

Thread.Sleep(2000);
Console.WriteLine("Resuming...");
pauseEvent.Set();    // resumes the thread

Thread.Sleep(2000);
running = false;     // signal exit
t.Join();
```
