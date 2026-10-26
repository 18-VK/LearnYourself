# Deadlocks and Race Conditions

## Deadlocks

**Definition:** two or more threads are each waiting for the other to release a resource — none can proceed. The result is a
permanent wait.

### Classic deadlock: inconsistent lock ordering

**Problematic code**

```csharp
using System;
using System.Threading;

class DeadlockDemo
{
    static readonly object lockA = new();
    static readonly object lockB = new();

    static void Main()
    {
        var t1 = new Thread(() => {
            lock (lockA)
            {
                Thread.Sleep(100); // simulate work
                lock (lockB) { Console.WriteLine("T1 got both"); }
            }
        });

        var t2 = new Thread(() => {
            lock (lockB)
            {
                Thread.Sleep(100);
                lock (lockA) { Console.WriteLine("T2 got both"); }
            }
        });

        t1.Start(); t2.Start();
        t1.Join(); t2.Join();
        Console.WriteLine("Done");
    }
}
```

**Why it deadlocks:**
`t1` locks `lockA` then waits for `lockB`. `t2` locks `lockB` then waits for `lockA`. Neither releases their first lock → deadlock.

### Fix 1 — consistent lock ordering

Always acquire locks in the same global order.

```csharp
// Acquire lockA then lockB everywhere
lock (lockA)
{
    lock (lockB)
    {
        // safe
    }
}
```

### Fix 2 — use `Monitor.TryEnter` with timeout (avoid permanent wait)

```csharp
bool acquiredA = false, acquiredB = false;
try
{
    acquiredA = Monitor.TryEnter(lockA, 1000);
    if (!acquiredA) { /* handle timeout */ return; }

    acquiredB = Monitor.TryEnter(lockB, 1000);
    if (!acquiredB) { /* handle timeout */ return; }

    // do work
}
finally
{
    if (acquiredB) Monitor.Exit(lockB);
    if (acquiredA) Monitor.Exit(lockA);
}
```

### Fix 3 — avoid multiple locks: use a single lock or higher-level constructs

If possible, protect shared state with a single lock or use concurrent collections / immutable data.

### Async/await deadlock (UI or legacy SynchronizationContext)

**Problematic scenario (WinForms / WPF / classic ASP.NET)**

```csharp
// UI thread
string GetDataSync() => GetDataAsync().Result; // blocks UI thread

async Task<string> GetDataAsync()
{
    await Task.Delay(1000); // by default captures the UI context
    return "data";
}
```

**Why it deadlocks:**
`GetDataSync()` blocks the UI thread waiting for the Task result. `GetDataAsync()` tries to resume its continuation on the
UI thread (captured context) but the UI thread is blocked → deadlock.

**Fixes:**

Don't block — use `await` all the way:

```csharp
async Task UseDataAsync()
{
    string data = await GetDataAsync();
    // update UI
}
```

Library code: avoid capturing context — use `ConfigureAwait(false)`:

**e.g.:**

```csharp
await Task.Delay(1000).ConfigureAwait(false);
```

This allows continuation on a thread-pool thread, avoiding the deadlock if someone blocks the calling thread (although
blocking is still discouraged).

## Race Conditions

**Definition:** two or more threads access and modify shared data concurrently and at least one of the accesses is a write —
results are unpredictable (lost updates, corrupt state).

### Example: lost increments

**Wrong code (race condition)**

```csharp
using System;
using System.Threading;

class RaceDemo
{
    static int counter = 0;
    static void Main()
    {
        Thread[] threads = new Thread[10];
        for (int i = 0; i < 10; i++)
        {
            threads[i] = new Thread(() =>
            {
                for (int j = 0; j < 100_000; j++)
                {
                    counter++; // not atomic -> race
                }
            });
            threads[i].Start();
        }
        foreach (var t in threads) t.Join();
        Console.WriteLine($"Counter = {counter} (expected 1_000_000)");
    }
}
```

Typical result: `counter` will usually be less than `1_000_000` due to lost updates.

### Fix A — `lock`

```csharp
static object sync = new();
...
lock (sync)
{
    counter++;
}
```

### Fix B — `Interlocked` (fast, atomic)

Best for simple atomic operations:

```csharp
using System.Threading;
Interlocked.Increment(ref counter);
```
