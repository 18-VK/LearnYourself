# C# Data Types & Collections Cheat Sheet for LeetCode / DSA

A quick-reference of the collections and types most useful for competitive programming and problem-solving in C#, organized by use case.

---

## 1. Arrays & Basic Types

| Type | Use Case | Notes |
|---|---|---|
| `int[]`, `long[]`, `char[]`, `bool[]` | Fixed-size storage, matrix problems, frequency counts | O(1) access; `Array.Sort()`, `Array.BinarySearch()` are O(n log n)/O(log n) |
| `int[,]` / `int[][]` | 2D grids (matrix, DP tables, BFS/DFS grids) | Jagged arrays (`int[][]`) are usually faster than multidimensional (`int[,]`) |
| `Span<T>` / `ReadOnlySpan<T>` | Slicing arrays/strings without allocation | Great for substring/subarray problems to avoid extra memory |
| `long` / `ulong` | Overflow-prone sums, products, big counts | Default to `long` when constraints suggest values > 2³¹ |


### `Span<T>` and `ReadOnlySpan<T>`

`Span<T>` and `ReadOnlySpan<T>` are stack-only, `ref struct` types in C# that provide a type-safe and memory-safe view over a contiguous region of memory. They let you work with arrays, strings, stack memory, and unmanaged buffers without copying data or allocating on the heap. This makes them highly efficient for performance-sensitive code.

- `Span<T>`: mutable view, supports reading and writing
- `ReadOnlySpan<T>`: read-only view, supports reading only
- They are fast because they avoid extra copies and heap allocation
- They are useful for slicing, parsing, text processing, and serialization
- Introduced in C# 7.2
- They are ref structs, so they cannot be boxed, used as fields, or captured by async methods

#### `ref struct` and `Span<T>`

##### What is a `ref struct`?

A `ref struct` is a struct that is **only allowed to live on the stack**. You declare it by adding the `ref` keyword:

```csharp
public ref struct MyBuffer
{
    public int Length;
}
```

##### Why does this exist?

Remember from stack vs heap: stack memory disappears when the method returns. Some data (like a view into stack memory) is only safe while that stack frame is alive. If such a value were stored on the heap, it could outlive the stack frame and point to memory that no longer exists (a dangling pointer). A `ref struct` makes the compiler **forbid** every way of putting it on the heap.

##### The rules (what you cannot do)

| Restriction | Why |
|---|---|
| Can't be a field of a `class` or a normal `struct` | That would put it on the heap |
| Can't be boxed (no `object x = mySpan`) | Boxing copies to the heap |
| Can't be captured by a lambda or local function | Captured variables move to the heap |
| Can't be held across `await` or `yield` | Async and iterator state machines live on the heap |
| Can't be used as a normal generic argument (`List<Span<int>>`) | Generics could box or store it on the heap |

Newer C# versions (C# 13) relax a few of these, for example allowing ref structs in async methods as long as they are not used across an `await`, and allowing generics with `allows ref struct`. The core rule remains: **it must never end up on the heap.**

##### What is `Span<T>`?

`Span<T>` is the most famous `ref struct`. It is a **window (view) over a continuous block of memory**. It does not own the memory and does not copy it. It only knows:

1. **where** the memory starts (a reference), and
2. **how long** the window is (a length).

```
   Array on the heap:  [ 10 | 20 | 30 | 40 | 50 | 60 ]
                              └───────────┘
                          Span<int> slice (start=1, length=3)
                          sees: 20, 30, 40  (no copy made)
```

The memory it points to can be:

- a heap array,
- part of an array,
- stack memory (`stackalloc`),
- native/unmanaged memory,
- a string's characters (as `ReadOnlySpan<char>`).

This is the key benefit: **one type that works over all of them, with zero allocation and zero copying.**

#### Does it get freed with the stack frame?

**It depends on what the `Span<T>` points to.** The span itself is a small `ref struct` that holds a reference and a length (typically 16 bytes on a 64-bit runtime). Its lifetime is restricted by the stack frame, so it cannot outlive the method when it refers to stack memory. The span does not own the memory it points to, so it does not free that memory when its own lifetime ends.

The referenced memory follows its own lifetime rules:

- **Stack memory** allocated with `stackalloc` is reclaimed when its stack frame ends.
- **Managed memory**, such as an array or string, is reclaimed by the garbage collector when it is no longer reachable.
- **Native or unmanaged memory** must be released by whichever code owns and allocated it.

#### Examples

##### Example 1: Slicing an array without copying

```csharp
int[] numbers = { 10, 20, 30, 40, 50, 60 };

Span<int> slice = numbers.AsSpan(1, 3);   // view of 20, 30, 40

Console.WriteLine(slice[0]);   // 20
Console.WriteLine(slice.Length); // 3
```

Without Span, you would do `numbers.Skip(1).Take(3).ToArray()` or `Array.Copy`, which **allocates a new array**. Span allocates nothing.

##### Example 2: A Span writes through to the original

Because it is only a view, changing the span changes the real data.

```csharp
int[] numbers = { 10, 20, 30, 40, 50, 60 };
Span<int> slice = numbers.AsSpan(1, 3);

slice[0] = 999;

Console.WriteLine(numbers[1]);  // 999 (the original array changed)

slice.Fill(0);                  // sets 999,30,40 → 0,0,0 in the original
```

##### Example 3: Substring without allocation

`string.Substring` creates a **new string on the heap** each time. A `ReadOnlySpan<char>` just points into the existing string.

```csharp
string text = "Name: Aman Kumar";

// Old way: allocates a new string
string name1 = text.Substring(6);

// Span way: no allocation
ReadOnlySpan<char> name2 = text.AsSpan(6);

Console.WriteLine(name2.ToString());   // "Aman Kumar" (allocates only here, if you need a string)
```

##### Example 4: Parsing without allocating substrings

```csharp
string line = "100,200,300";
ReadOnlySpan<char> span = line;

int comma = span.IndexOf(',');
int first = int.Parse(span.Slice(0, comma));   // parses "100" with no substring created

Console.WriteLine(first);  // 100
```

This is common in high-performance code such as parsers, CSV reading, and network protocols, where creating thousands of small strings would stress the GC.

##### Example 5: `stackalloc` (a Span on the stack)

**What it is:** `stackalloc` allocates a block of memory on the stack instead of creating a managed array on the heap.

```csharp
Span<int> numbers = stackalloc int[5]; // Space for 5 integers on the stack
```

By comparison, `new int[5]` creates an array on the heap that the garbage collector later reclaims. Stack memory is reclaimed automatically when its stack frame ends.

```text
new int[5]                         stackalloc int[5]

STACK          HEAP                STACK
┌────────┐    ┌──────────┐        ┌──────────────────┐
│ ref ───┼───►│ 5 ints   │        │ 5 ints (in frame)│
└────────┘    └──────────┘        └──────────────────┘
               GC reclaims it      reclaimed on return
```

**Why use it?** It avoids a heap allocation and the associated garbage-collection work. This makes it useful for small, short-lived temporary buffers.

**Safe usage with `Span<T>` (recommended):**

```csharp
Span<byte> buffer = stackalloc byte[64];

buffer[0] = 1;
buffer[1] = 2;
buffer.Fill(0);
```

No `unsafe` code is needed, and `Span<T>` provides bounds checks. An out-of-range access throws `IndexOutOfRangeException` rather than writing outside the buffer.

You can also initialize the values directly:

```csharp
Span<int> primes = stackalloc int[] { 2, 3, 5, 7, 11 };
```

**Pointer usage (requires `unsafe`; usually avoid this):**

```csharp
unsafe
{
    int* pointer = stackalloc int[5];
    pointer[0] = 1;
}
```

Pointer access has no span bounds checks. Prefer the `Span<T>` form unless unsafe code is specifically required.

**Practical example: format without a temporary heap array**

```csharp
string FormatSlow(int value)
{
    char[] buffer = new char[20];
    value.TryFormat(buffer, out int written);
    return new string(buffer, 0, written);
}

string FormatFast(int value)
{
    Span<char> buffer = stackalloc char[20];
    value.TryFormat(buffer, out int written);
    return new string(buffer[..written]); // The result string is still allocated.
}
```

The faster version avoids allocating a temporary `char[]`; returning a string still requires allocating that string.

**Use the stack for small buffers and a pooled array for larger ones:**

```csharp
using System.Buffers;

void Process(int size)
{
    byte[]? rented = null;
    Span<byte> buffer;

    if (size <= 256)
    {
        buffer = stackalloc byte[256];
    }
    else
    {
        rented = ArrayPool<byte>.Shared.Rent(size);
        buffer = rented;
    }

    try
    {
        // Use buffer.
    }
    finally
    {
        if (rented is not null)
            ArrayPool<byte>.Shared.Return(rented);
    }
}
```

The pooled array must be returned to the pool. Keep stack allocations small because the stack is limited, and avoid `stackalloc` inside loops: repeated allocations can remain on the stack until the method returns. A `Span<T>` is a `ref struct`, so it cannot escape the scope in a way that would outlive the stack memory it references.

##### Example 6: Passing a Span to a method

One method can accept arrays, slices, and stack memory alike:

```csharp
static int Sum(ReadOnlySpan<int> values)
{
    int total = 0;
    foreach (var v in values) total += v;
    return total;
}

int[] arr = { 1, 2, 3, 4, 5 };

Console.WriteLine(Sum(arr));                    // whole array → 15
Console.WriteLine(Sum(arr.AsSpan(1, 3)));       // part of array → 9
Console.WriteLine(Sum(stackalloc int[] { 7, 8 })); // stack memory → 15
```

#### `Span<T>` vs `ReadOnlySpan<T>`

| Type | Can modify data? | Use when |
|---|---|---|
| `Span<T>` | Yes | You need to read and write |
| `ReadOnlySpan<T>` | No | You only read (strings are always read-only spans) |

Prefer `ReadOnlySpan<T>` for method parameters that don't modify data. It also accepts strings and read-only sources.

#### What if I need to store it or use `async`?

Since `Span<T>` can't live on the heap, it can't be a class field or cross an `await`. For those cases use **`Memory<T>`** (and `ReadOnlyMemory<T>`), which is a normal struct that can live on the heap. You get a `Span<T>` from it when you need to work on the data:

```csharp
class Reader
{
    private Memory<byte> _buffer = new byte[1024];   // allowed as a field

    public async Task ReadAsync()
    {
        await Task.Delay(10);          // fine: Memory<T> survives await
        Span<byte> span = _buffer.Span; // get a Span for the actual work
        span[0] = 1;
    }
}
```

| | `Span<T>` | `Memory<T>` |
|---|---|---|
| Kind | `ref struct` (stack only) | Regular struct (can be on the heap) |
| Class field / async / lambda | Not allowed | Allowed |
| Speed | Fastest | Slightly more overhead |

#### A small custom `ref struct`

```csharp
public ref struct Point3D
{
    public int X, Y, Z;
    public Point3D(int x, int y, int z) { X = x; Y = y; Z = z; }
}

class Program
{
    static void Main()
    {
        Point3D p = new Point3D(1, 2, 3);   // lives on the stack
        Console.WriteLine(p.X);

        // object o = p;                    // ERROR: cannot box a ref struct
        // Func<int> f = () => p.X;         // ERROR: cannot capture in a lambda
    }
}
```

You rarely write your own `ref struct`. It is mostly useful when building something Span-like that wraps a span, such as a custom parser or a reader over a buffer.

#### Quick summary

> A **`ref struct`** is a struct restricted to the stack so it can safely hold references to short-lived memory. **`Span<T>`** is a ref struct that gives you a **zero-copy, zero-allocation window** over arrays, strings, stack memory, or native memory. Use it to slice, parse, and process data without creating extra heap objects, and switch to **`Memory<T>`** when you need to store it or use `async`.

## 2. Lists & Dynamic Arrays

| Type | Use Case | Complexity |
|---|---|---|
| `List<T>` | Dynamic array — most common general-purpose collection | Add: O(1) amortized, Insert/Remove(i): O(n), Index: O(1) |
| `LinkedList<T>` | Frequent insert/delete at both ends or middle (rarely beats `List<T>` in practice) | Add/Remove: O(1) if you hold the node reference |

### `RemoveAt` vs `Remove`

#### `RemoveAt(index)`
Used for `List<T>` and removes an element by its index.

- Fast for index-based access
- Works well when data is stored in an array-like structure
- Shifts elements after the removed one to fill the gap

#### `Remove(value)`
Removes the first matching element by value, not by index.

- Searches the list to find the value
- Removes only the first match
- Returns true if removed, otherwise false


### `LinkedList<T>` in C#: Quick Notes

#### What it is
Doubly linked list (`System.Collections.Generic`). Each element sits in a `LinkedListNode<T>` with `Previous` and `Next` references. No index access.

#### Complexity

| Operation | Cost | Note |
|---|---|---|
| `AddFirst`, `AddLast` | O(1) | |
| `AddBefore`, `AddAfter` | O(1) | Only if you already hold the node |
| `RemoveFirst`, `RemoveLast`, `Remove(node)` | O(1) | |
| `Find`, `Contains`, `Remove(value)` | O(n) | Linear search |
| Insert in middle by position | **O(n)** | Traversal to reach it is O(n); the insert itself is O(1) |
| `First`, `Last`, `Count` | O(1) | |

#### Example

```csharp
var list = new LinkedList<int>(new[] { 10, 20, 30, 40 });

LinkedListNode<int> node = list.Find(30)!;  // O(n) search
list.AddBefore(node, 25);                   // O(1) insert -> 10,20,25,30,40
list.Remove(node);                          // O(1) remove -> 10,20,25,40
```

#### Key points
- Middle insert is O(1) **only when you hold the node reference**, otherwise O(n) because of the walk.
- A node can belong to only one list. Remove it before adding it elsewhere.
- Modifying the list inside `foreach` throws. Use a manual `Next` loop and grab `Next` before removing.
- Extra memory per element (node object + 2 references) and poor cache locality.
- Not thread-safe.

#### Best use case
LRU cache: `Dictionary<TKey, LinkedListNode<...>>` for O(1) lookup + `LinkedList` for O(1) move-to-front and eviction.

#### When to prefer something else
- `List<T>`: faster in most cases (contiguous memory). `Insert` is also O(n) but uses a fast memmove.
- `Queue<T>` / `Stack<T>`: simpler for FIFO / LIFO needs.

---

## 3. Hashing — Fast Lookup

| Type | Use Case | Complexity |
|---|---|---|
| `HashSet<T>` | Membership checks, deduplication, "seen" sets (e.g. two-sum variants, cycle detection) | Add/Contains/Remove: O(1) avg |
| `Dictionary<TKey, TValue>` | Frequency maps, memoization (top-down DP), adjacency lists for graphs, index lookups | Get/Set: O(1) avg |
| `Dictionary<T, List<T>>` | Graph adjacency list representation | — |

---

## 4. Ordered / Sorted Structures

| Type | Use Case | Complexity |
|---|---|---|
| `SortedSet<T>` | Maintain sorted unique elements; range queries; "find next greater/smaller" (`GetViewBetween`) | Add/Remove/Contains: O(log n) |
| `SortedDictionary<TKey, TValue>` | Sorted key-value map, ordered iteration needed | O(log n) per op |
| `SortedList<TKey, TValue>` | Sorted map with binary-search lookup, less memory than `SortedDictionary` for smaller n | O(log n) lookup, O(n) insert |

> C# has no built-in balanced BST like C++'s `multiset`/`map` with duplicates — `SortedSet<T>` disallows duplicates. For duplicates, pair the value with an index/tiebreaker, or use a `SortedDictionary<T, int>` as a multiset (value → count).

---

## 5. Stack, Queue, Deque

| Type | Use Case | Complexity |
|---|---|---|
| `Stack<T>` | DFS (iterative), balanced parentheses, monotonic stack (next greater element), backtracking | Push/Pop/Peek: O(1) |
| `Queue<T>` | BFS, level-order traversal | Enqueue/Dequeue: O(1) |
| `LinkedList<T>` (as deque) | Sliding window maximum, monotonic deque | O(1) at both ends |
| `Deque` (no built-in type) | Simulate with `LinkedList<T>` or a circular array | — |

---

## 6. Heaps / Priority Queues

| Type | Use Case | Complexity |
|---|---|---|
| `PriorityQueue<TElement, TPriority>` (built-in, .NET 6+) | Dijkstra's algorithm, k-th largest/smallest, merge k sorted lists, task scheduling | Enqueue/Dequeue: O(log n) |

```csharp
var pq = new PriorityQueue<int, int>();
pq.Enqueue(item: 5, priority: 5);
pq.Dequeue(); // returns min-priority item — it's a min-heap by default

// For a max-heap, negate the priority:
pq.Enqueue(item, -priority);
```

---

## 7. Strings & Text

| Type/Method | Use Case | Notes |
|---|---|---|
| `StringBuilder` | Building strings in a loop (avoids O(n²) from repeated `string` concatenation) | Append: O(1) amortized |
| `string.ToCharArray()` | Character-level manipulation | Strings are immutable — convert to work in place |
| `Span<char>` / `ReadOnlySpan<char>` | Substring checks without allocation | Useful for palindrome/substring-heavy problems |

---

## 8. Tuples & Multi-Value Returns

| Type | Use Case |
|---|---|
| `(int, int)` value tuple | Returning/pairing coordinates, storing pairs in a queue/stack (e.g. BFS `(row, col, distance)`) |
| `ValueTuple<T1,T2,...>` | Same as above, explicit form |
| Custom `record` / `struct` | When a tuple gets unreadable (3+ named fields) |

---

## 9. Bit Manipulation

| Type | Use Case |
|---|---|
| `int` / `long` as a bitmask | Subset enumeration, DP over bitmask (TSP-style), visited-state tracking |
| `BitArray` | Large boolean arrays (sieve of Eratosthenes at scale), memory-efficient flags |

---

## 10. Quick Decision Guide

- **Need O(1) lookup/dedup?** → `HashSet<T>` / `Dictionary<TKey,TValue>`
- **Need sorted order + O(log n) ops?** → `SortedSet<T>` / `SortedDictionary<TKey,TValue>`
- **Need min/max repeatedly?** → `PriorityQueue<TElement,TPriority>`
- **Need FIFO?** → `Queue<T>`
- **Need LIFO?** → `Stack<T>`
- **Need sliding window min/max?** → `LinkedList<T>` as deque, or `PriorityQueue` with lazy deletion
- **Need graph adjacency?** → `Dictionary<int, List<int>>`
- **Building strings in a loop?** → `StringBuilder`
- **Constraints suggest overflow?** → use `long`
