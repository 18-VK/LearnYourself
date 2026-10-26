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


**Span<T> and ReadOnlySpan<T>**

Span<T> and ReadOnlySpan<T> are stack-only, ref-struct types in C# that provide a type-safe and memory-safe view over a contiguous region of memory. They let you work with arrays, strings, stack memory, and unmanaged buffers without copying data or allocating on the heap. This makes them highly efficient for performance-sensitive code.

- Span<T>: mutable view, supports reading and writing
- ReadOnlySpan<T>: read-only view, supports reading only
- They are fast because they avoid extra copies and heap allocation
- They are useful for slicing, parsing, text processing, and serialization
- Introduced in C# 7.2
- They are ref structs, so they cannot be boxed, used as fields, or captured by async methods

```csharp
using System;

class Program
{
    static void Main()
    {
        int[] numbers = { 10, 20, 30, 40 };

        Span<int> span = numbers;
        span[0] = 100; // modifies original data

        ReadOnlySpan<int> ro = numbers;
        Console.WriteLine(ro[1]); // 20
    }
}
```

**Why they matter**

Operations like Substring, Array.Copy, or Split allocate new objects. A span is just a pointer plus a length, so slicing is O(1) and allocation-free. That means less GC pressure in hot paths such as parsing, serialization, and I/O.

Basic usage

```csharp
int[] numbers = { 1, 2, 3, 4, 5, 6 };

Span<int> all = numbers;             // view over the whole array
Span<int> middle = all.Slice(1, 3);  // { 2, 3, 4 } - no copy
middle[0] = 99;                      // writes through to the original array

Console.WriteLine(numbers[1]);       // 99
```
---

## 2. Lists & Dynamic Arrays

| Type | Use Case | Complexity |
|---|---|---|
| `List<T>` | Dynamic array — most common general-purpose collection | Add: O(1) amortized, Insert/Remove(i): O(n), Index: O(1) |
| `LinkedList<T>` | Frequent insert/delete at both ends or middle (rarely beats `List<T>` in practice) | Add/Remove: O(1) if you hold the node reference |


**Difference between RemoveAt, Remove**

**RemoveAt(index)**
Used for List<T> and removes an element by its index.

- Fast for index-based access
- Works well when data is stored in an array-like structure
- Shifts elements after the removed one to fill the gap

**Remove(value)**
Removes the first matching element by value, not by index.

- Searches the list to find the value
- Removes only the first match
- Returns true if removed, otherwise false


### LinkedList<T> in C# - Quick Notes

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
