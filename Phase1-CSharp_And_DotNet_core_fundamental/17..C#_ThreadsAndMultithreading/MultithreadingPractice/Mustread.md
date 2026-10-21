# Must read — exceptions in threads

**Code snippet:**

```csharp
private static void Practice5()
{
    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));

    Thread thrdHigh = new Thread(() => { 
        while(!cts.Token.IsCancellationRequested)
        {
            CounterHigherPriority++;
        }
        cts.Token.ThrowIfCancellationRequested();
    }) { Priority = ThreadPriority.Highest };


    Thread thrdlow = new Thread(() => {
        while (!cts.Token.IsCancellationRequested)
        {
            CounterLowerPriority++;
        }
        cts.Token.ThrowIfCancellationRequested();
    }) { Priority = ThreadPriority.Lowest };

         
    try
    {
        thrdlow.Start();
        thrdHigh.Start();

        //wait for cancellation 
        //cts.Token.WaitHandle.WaitOne();

        thrdlow.Join();
        thrdHigh.Join();
    }catch(OperationCanceledException)
    {
        Console.WriteLine("Cancelled called : " + Thread.CurrentThread.ManagedThreadId);
    }

    Console.WriteLine(ClsMain.CounterHigherPriority);
    Console.WriteLine(ClsMain.CounterLowerPriority);
        }
```

## 1️⃣ Key observation

You wrote inside the thread loops:

```csharp
while (!cts.Token.IsCancellationRequested)
{
    CounterHigherPriority++;
}
cts.Token.ThrowIfCancellationRequested();
```

- `ThrowIfCancellationRequested()` is inside the worker thread, not in the main thread.
- Your `try/catch` in `Practice5()` surrounds the `Join()` calls, which are executed on the main thread.
- Threads do not propagate exceptions automatically to the caller.

✅ In other words: the exception is thrown in the worker thread, not the thread running the `try/catch`.

## 2️⃣ Behavior of exceptions in threads

If a thread created via `new Thread(...)` throws an exception uncaught, the runtime:

- Prints it to the console (unhandled exception) in .NET Framework.
- In .NET Core, the process may terminate if the exception is unhandled.
- The main thread cannot catch exceptions from other threads using a normal `try/catch`.

## 3️⃣ Correct ways to handle exceptions

### Option A: Catch inside the thread itself

```csharp
Thread thrdHigh = new Thread(() =>
{
    try
    {
        while (!cts.Token.IsCancellationRequested)
        {
            CounterHigherPriority++;
        }
        cts.Token.ThrowIfCancellationRequested();
    }
    catch (OperationCanceledException)
    {
        Console.WriteLine("High priority thread canceled");
    }
});
```

Now the thread itself handles the exception.

### Option B: Use `Task` instead of `Thread`

`Task` automatically propagates exceptions to the calling thread when you `Wait()` or `await` it:

```csharp
var tHigh = Task.Run(() =>
{
    while (!cts.Token.IsCancellationRequested)
    {
        CounterHigherPriority++;
    }
    cts.Token.ThrowIfCancellationRequested();
}, cts.Token);

var tLow = Task.Run(() =>
{
    while (!cts.Token.IsCancellationRequested)
    {
        CounterLowerPriority++;
    }
    cts.Token.ThrowIfCancellationRequested();
}, cts.Token);

try
{
    Task.WaitAll(tHigh, tLow);
}
catch (OperationCanceledException)
{
    Console.WriteLine("Caught cancellation in main thread");
}
```

Now the exception bubbles to the main thread, and your catch works as intended.
