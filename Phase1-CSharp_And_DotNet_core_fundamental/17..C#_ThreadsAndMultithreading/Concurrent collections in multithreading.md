# Concurrent collections

Concurrent collections provide thread-safe implementations of common containers so multiple threads can read/write
without you putting `lock(...)` around every access. They use fine-grained locking or lock-free algorithms internally for
better scalability and fewer bugs.

## 1) `ConcurrentDictionary<TKey,TValue>`

**Use case:** thread-safe cache, memoization, counters, or any shared lookup where multiple threads add/update/remove keys
concurrently.

### Most common methods

- `GetOrAdd(key, valueFactory)` — add-if-missing atomically
- `AddOrUpdate(key, addValueFactory, updateFactory)` — atomic add-or-update
- `TryGetValue(key, out value)` — safe read
- `TryRemove(key, out value)` — remove atomically
- `TryUpdate(key, newValue, comparisonValue)` — conditional update

### Example

```csharp
using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

var cache = new ConcurrentDictionary<string, int>();

// parallel to simulate 10 tasks 
Parallel.For(0, 10, i =>
{
    // atomic add-or-increment
    cache.AddOrUpdate("count", 1, (k, old) => old + 1);
    /*
        If "count" doesn’t exist → insert "count" = 1.
        If "count" already exists → update it using the function (k, old) => old + 1.
    */
});

if (cache.TryGetValue("count", out var total))
    Console.WriteLine($"count = {total}"); // expected 10
```

## 2) `ConcurrentQueue<T>`

**Use case:** lightweight, non-blocking FIFO queue for producer/consumer where order matters and consumers poll/dequeue items.

### Most common methods

- `Enqueue(item)` — push item
- `TryDequeue(out item)` — pop item safely
- `TryPeek(out item)` — look at head without removing
- `IsEmpty` / `Count` (`Count` is approximate under concurrency)

### Example

```csharp
using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

var q = new ConcurrentQueue<int>();

// producer
Task.Run(() => { for (int i = 0; i < 5; i++) q.Enqueue(i); });

// consumer
Task.Run(() =>
{
    int item;
    while (!q.IsEmpty || !Task.WaitAll()) // simplified demo loop
    {
        if (q.TryDequeue(out item))
            Console.WriteLine($"Dequeued {item}");
    }
});
```

## 3) `ConcurrentStack<T>`

**Use case:** LIFO scenarios (object pools, last-used-first reuse) where multiple threads push/pop concurrently.

### Most common methods

- `Push(item)` — push on top
- `TryPop(out item)` — pop top item
- `TryPeek(out item)` — inspect top without removing
- `ToArray()` — snapshot

### Example

```csharp
using System;
using System.Collections.Concurrent;

var stack = new ConcurrentStack<int>();
stack.Push(1);
stack.Push(2);

if (stack.TryPop(out var top))
    Console.WriteLine($"Popped {top}"); // 2
```

## 4) `ConcurrentBag<T>`

**Use case:** unordered thread-local-optimized collection for object pooling or when order doesn't matter. Good when threads mostly reuse their own items.

### Most common methods

- `Add(item)` — add an item
- `TryTake(out item)` — remove an item (thread-local biased)
- `TryPeek(out item)` — (if available in your framework) peek without removing
- `ToArray()` / `Count` — snapshot / approximate count

### Example

```csharp
using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

var pool = new ConcurrentBag<byte[]>();

// producer: add reusable buffers
for (int i = 0; i < 5; i++) pool.Add(new byte[1024]);

// consumer: take a buffer, use it, then return it
Parallel.For(0, 10, i =>
{
    if (pool.TryTake(out var buf))
    {
        // use buffer...
        pool.Add(buf); // return for reuse
    }
    else
    {
        // allocate if none available
        var newBuf = new byte[1024];
        // use and return
        pool.Add(newBuf);
    }
});
```

## 5) `BlockingCollection<T>`

**Use case:** robust producer/consumer pipelines with optional bounding, blocking producers when full, and graceful shutdown
(`CompleteAdding`). Often backed by `ConcurrentQueue<T>` by default.

### Most common methods

- `Add(item)` / `TryAdd(item, timeout)` — producer adds (blocks if bounded full)
- `Take()` / `TryTake(out item, timeout)` — consumer removes (blocks if empty)
- `CompleteAdding()` — signal no more items will be added
- `GetConsumingEnumerable()` — iterate until completed (convenient consumer loop)

### Example

```csharp
using System;
using System.Collections.Concurrent; 
using System.Threading.Tasks;

var bc = new BlockingCollection<int>(boundedCapacity: 3);

// producer
var producer = Task.Run(() =>
{
    for (int i = 1; i <= 10; i++)
    {
        bc.Add(i); // blocks if capacity reached
        Console.WriteLine($"Produced {i}");
    }
    bc.CompleteAdding();
});

// consumer
var consumer = Task.Run(() =>
{
    foreach (var item in bc.GetConsumingEnumerable()) // stops when CompleteAdding + empty
        Console.WriteLine($"Consumed {item}");
});
```

### The setup

You have a `BlockingCollection<T>` like this:

```csharp
BlockingCollection<int> collection = new BlockingCollection<int>(boundedCapacity: 5);
```

Then you have two tasks:

```csharp
// Producer
Task.Run(() =>
{
    for (int i = 0; i < 20; i++)
    {
        collection.Add(i);
        Console.WriteLine($"Produced: {i}");
    }
    collection.CompleteAdding();
});

// Consumer
Task.Run(() =>
{
    foreach (var item in collection.GetConsumingEnumerable())
    {
        Console.WriteLine($"Consumed: {item}");
        Thread.Sleep(500); // simulate slow consumer
    }
});
```

### 2️⃣ What happens when producer and consumer run

**✅ While the collection is not full**

Producer calls `Add(item)` → item is added immediately.
Consumer calls `Take()` or enumerates via `GetConsumingEnumerable()` → consumes as soon as an item is available.

**⚠️ When the collection reaches its bound (capacity)**

If the collection has reached the bounded capacity,
then the next `Add(item)` call blocks (waits) until space becomes available.

The producer does not add new items beyond that bound.
It waits until the consumer removes at least one item.

### 3️⃣ When the consumer consumes

When the consumer takes an item (using `Take()` or the enumerator), the count decreases.
This frees up a slot in the bounded collection.
The producer's blocked `Add()` call now unblocks and adds the next item.
So the producer and consumer are effectively synchronized — the collection acts as a buffer between them.

| Time | Producer action                        | Collection contents | Consumer action |
| ---- | -------------------------------------- | ------------------- | --------------- |
| t0   | Add(1)                                 | [1]                 | —               |
| t1   | Add(2)                                 | [1,2]               | —               |
| t2   | Add(3)                                 | [1,2,3]             | —               |
| t3   | Add(4) → **blocks** (capacity reached) | [1,2,3]             | —               |
| t4   | Consumer takes(1)                      | [2,3]               | frees 1 slot    |
| t5   | Producer’s blocked Add(4) completes    | [2,3,4]             | —               |

> **Note:**
>
> **Work-Stealing in `ConcurrentBag<T>`**
>
> - Each thread has its own local bag.
> - `TryTake`:
>   - First looks in the current thread's bag (LIFO).
>   - If empty, it will steal from another thread's bag (order undefined).
>
> 👉 This "stealing" behavior is unique to `ConcurrentBag<T>` among the concurrent collections.

## Other Concurrent Collections

### 1) `ConcurrentQueue<T>`

- Global FIFO queue (first in, first out).
- Items are stored in a single shared queue.
- Any thread can `Enqueue` or `TryDequeue` — there's no concept of "ownership".
- No stealing needed, because the data structure is already shared.

### 2) `ConcurrentStack<T>`

- Global LIFO stack (last in, first out).
- Any thread can `Push` or `TryPop`.
- Again, no stealing — all items are in the same shared stack.

### 3) `ConcurrentDictionary<TKey,TValue>`

- Global hash table, divided internally into buckets.
- Any thread can `TryAdd`, `TryUpdate`, `TryGetValue`, `TryRemove`.
- Ownership doesn't exist here either.

Only `ConcurrentBag<T>` has the concept of "per-thread local collection" and therefore may take items from another thread's.
The other collections are global, so all threads are always taking from the same shared structure.
