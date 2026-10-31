# Collections in C#

C# provides a rich set of collection classes for storing and managing groups of objects. These include generic collections
(in `System.Collections.Generic`), non-generic legacy collections (in `System.Collections`), concurrent collections (in `System.Collections.Concurrent`),
and observable collections (in `System.Collections.ObjectModel`). Each has its own characteristics, usage scenarios, and typical operations.

## 1) Generic Collections (`System.Collections.Generic`)

### List in C#

A `List<T>` is a type-safe, dynamically sized array of `T` elements. It automatically resizes its internal array as items are added. Elements are
stored in insertion order and can be accessed by index in O(1) time. A `List<T>` allows duplicate items and (null for reference types). Because
it is generic, it avoids the boxing/unboxing and type-safety issues of older collections.

**When to use:** Use `List<T>` when you need an ordered, resizable collection with fast random access. It is the preferred modern replacement for
`ArrayList` and is suitable for most list needs (e.g. maintaining a list of items, implementing a stack or queue, etc.).

- Allows duplicates and null (for reference types)
- Provides methods like `Add`, `Insert`, `Remove`, and indexer access.
- Automatically grows capacity, with amortized O(1) `Add` when capacity is sufficient.

**Example:**

```csharp
var list = new List<int>();
list.Add(10);
list.Add(20);
list.Add(30);
Console.WriteLine(list[1]); // 20
// Output all elements:
foreach (int x in list)
    Console.WriteLine(x);
```

#### Methods of list class

**`List<T>` Methods in C#**

**Searching & Filtering**

- `Contains(item)`: Checks if the list contains a specific item.
- `Find(predicate)`: Returns the first item that matches a condition. `Find()` searches for the first element in the list that matches a given predicate (a condition expressed as a function).
- `FindAll(predicate)`: Returns all items that match a condition.
- `IndexOf(item)`: Returns the index of the first occurrence.
- `LastIndexOf(item)`: Returns the index of the last occurrence.
- `Exists(predicate)`: Checks if any item matches a condition.

**Modifying the List**

- `Add(item)`: Adds an item to the end.
- `AddRange(collection)`: Adds multiple items.
- `Insert(index, item)`: Inserts an item at a specific index.
- `InsertRange(index, collection)`: Inserts multiple items.
- `Remove(item)`: Removes the first occurrence.
- `RemoveAt(index)`: Removes the item at a specific index.
- `RemoveRange(index, count)`: Removes a range of items.
- `Clear()`: Removes all items.

**Sorting & Reversing**

- `Sort()`: Sorts the list using default comparer.
- `Sort(comparer)`: Sorts using a custom comparer.
- `Sort(index, count, comparer)`: Sorts a portion of the list.
- `Reverse()`: Reverses the entire list.
- `Reverse(index, count)`: Reverses a portion of the list.

**Capacity & Size**

- `Count`: Gets the number of elements.
- `Capacity`: Gets or sets the total number of elements the internal data structure can hold.
- `TrimExcess()`: Sets capacity to the actual number of elements.

**Conversion & Copying**

- `ToArray()`: Converts the list to an array.
- `AsReadOnly()`: Returns a read-only wrapper.
- `CopyTo(array)`: Copies elements to an array.
- `CopyTo(index, array, arrayIndex, count)`: Copies a range to an array.

**Example Usage**

```csharp
List<string> fruits = new List<string>();
fruits.Add("Apple");
fruits.Add("Banana");
fruits.Insert(1, "Mango");
fruits.Remove("Banana");

bool hasApple = fruits.Contains("Apple");
string firstFruit = fruits.Find(f => f.StartsWith("A")); //- If no match is found, it returns null (for reference types) or the default value of the type.
```

### Dictionary in C#

A `Dictionary<TKey,TValue>` is a hash-table–based map from keys to values. It stores unique keys (of type `TKey`) and associated values (`TValue`).
Lookups by key are very fast (average-case O(1)), as keys are hashed. Duplicate keys are not allowed (attempting to add a key that already
exists causes an exception), and null keys are not permitted. Values can be duplicates or null. Because `Dictionary<TKey,TValue>` is generic and
strongly typed, it avoids casting overhead.

**When to use:** Use `Dictionary<TKey,TValue>` for lookups by a key. It is ideal for implementing look-up tables, caches, or any scenario where you
need to retrieve data by a unique key (e.g. mapping user IDs to user objects).

- Fast retrieval/insertion by key (constant-time on average).
- Keys must be unique and non-null; values can duplicate or be null.
- Offers methods like `Add`, `TryGetValue`, indexer `dict[key]`, `ContainsKey`, etc.

#### `Dictionary<TKey, TValue>` Methods in C#

**Adding & Updating**

- `Add(key, value)`: Adds a new key-value pair.
- `TryAdd(key, value)`: Adds only if the key doesn't exist.
- `this[key] = value`: Adds or updates a value for a key.

**Accessing & Checking**

- `ContainsKey(key)`: Checks if a key exists.
- `ContainsValue(value)`: Checks if a value exists.
- `TryGetValue(key, out value)`: Safely gets a value.

**Removing**

- `Remove(key)`: Removes a key-value pair.
- `Clear()`: Removes all entries.

**Properties**

- `Count`: Number of key-value pairs.
- `Keys`: Collection of all keys.
- `Values`: Collection of all values.

**Example: Using Dictionary in C#**

```csharp
class Program
{
    static void Main()
    {
        Dictionary<string, int> ages = new Dictionary<string, int>();

        // Add entries
        ages.Add("Alice", 30);
        ages["Bob"] = 25; // Add or update
        // TryAdd (won't overwrite existing key)
        bool added = ages.TryAdd("Alice", 35); // false
        // Access value
        Console.WriteLine("Alice's age: " + ages["Alice"]);
        // Safe access
        if (ages.TryGetValue("Charlie", out int age))
        {
            Console.WriteLine("Charlie's age: " + age);
        }
        else
        {
            Console.WriteLine("Charlie not found.");
        }
        // Check key
        if (ages.ContainsKey("Bob"))
        {
            Console.WriteLine("Bob is in the dictionary.");
        }
        // Remove entry
        ages.Remove("Alice");
        // Loop through dictionary
        foreach (var kvp in ages)
        {
            Console.WriteLine($"{kvp.Key}: {kvp.Value}");
        }
    }
}
```

### `HashSet<T>`

A `HashSet<T>` is an unordered collection of unique items. It uses a hash table internally to provide fast set operations. By definition, adding
a duplicate item has no effect; each value can appear only once. `HashSet<T>` does not preserve order of elements. It allows null (for reference
types) and duplicates are automatically discarded.

**When to use:** Use `HashSet<T>` when you need to maintain a collection of distinct elements or
perform set operations (union, intersection, difference). It's useful for fast membership tests, eliminating duplicates, or mathematical set
operations.

- Unordered and holds no duplicates
- Supports typical set operations (`UnionWith`, `IntersectWith`, etc.).
- `Add`/`Remove`/`Contains` are typically O(1).

> `Dictionary<TKey, TValue>` and `HashSet<T>` are different:
> - `Dictionary` stores `key -> value` pairs and is used for lookup by key.
> - `HashSet` stores only unique values and is used for membership and set math.
> - `Dictionary` does not support `UnionWith`/`IntersectWith`; those belong to `HashSet<T>`.

#### Set operations in `HashSet<T>`

`HashSet<T>` supports mathematical set operations. These are very useful when working with unique values.

- `Union`: all unique items from both sets.
- `Intersection`: common items present in both sets.
- `Difference`: items in one set that are not in the other.

**Common methods:**

- `UnionWith(otherSet)`: combines the current set with another set.
- `IntersectWith(otherSet)`: keeps only the elements that exist in both sets.
- `ExceptWith(otherSet)`: removes elements that are also present in another set.
- `IsSubsetOf(otherSet)`: checks whether all elements are contained in another set.
- `IsSupersetOf(otherSet)`: checks whether the set contains all elements of another set.

**Example:**

```csharp
var setA = new HashSet<int> { 1, 2, 3, 4 };
var setB = new HashSet<int> { 3, 4, 5, 6 };

setA.UnionWith(setB);       // {1, 2, 3, 4, 5, 6}
setA = new HashSet<int> { 1, 2, 3, 4 };
setA.IntersectWith(setB);   // {3, 4}
setA = new HashSet<int> { 1, 2, 3, 4 };
setA.ExceptWith(setB);       // {1, 2}
```

#### Methods

**Common HashSet Methods**

| Method                              | Description                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `Add(T item)`                       | Adds an element to the set. Returns true if added, false if it already exists.      |
| `Remove(T item)`                    | Removes the specified element. Returns true if removed.                            |
| `Contains(T item)`                  | Checks if the set contains the specified element.                                  |
| `Clear()`                           | Removes all elements from the set.                                                 |
| `Count`                             | Gets the number of elements in the set.                                            |
| `IsSubsetOf(IEnumerable<T>)`        | Checks if the current set is a subset of the specified collection.                 |
| `IsSupersetOf(IEnumerable<T>)`      | Checks if the current set is a superset of the specified collection.               |
| `UnionWith(IEnumerable<T>)`         | Modifies the set to include all elements from itself and the specified collection. |
| `IntersectWith(IEnumerable<T>)`     | Modifies the set to include only elements also in the specified collection.        |
| `ExceptWith(IEnumerable<T>)`        | Removes all elements in the specified collection from the set.                     |
| `SymmetricExceptWith(IEnumerable<T>)` | Modifies the set to include elements in either set but not both.                 |
| `SetEquals(IEnumerable<T>)`         | Checks if the set contains the same elements as the specified collection.          |
| `RemoveWhere(Predicate<T>)`         | Removes all elements that match the given condition.                               |
| `CopyTo(T[] array)`                 | Copies elements to an array.                                                       |
| `Overlaps(IEnumerable<T>)`          | Checks if the set shares any elements with the specified collection.               |

### `Queue<T>`

A `Queue<T>` is a first-in, first-out (FIFO) collection. You enqueue items at the end and dequeue them from the front. Internally, .NET
implements `Queue<T>` with a circular array that resizes automatically. It preserves insertion order, allows duplicates and null
(for reference types), and provides `Peek` to view the next item without removing it.

**When to use:** Use `Queue<T>` when you need to process items
in the order they arrive (e.g. task scheduling, breadth-first search, buffering). It is ideal for producer-consumer patterns or any scenario
where order matters.

- FIFO behavior: use `Enqueue(item)`, `Dequeue()` (oldest item removed) and `Peek()`.
- Thread-unsafe by default (use `ConcurrentQueue<T>` for multithreading).

#### Common `Queue<T>` Methods in C#

| Method                | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `Enqueue(item)`       | Adds an item to the end of the queue.                                        |
| `Dequeue()`           | Removes and returns the item at the front of the queue.                      |
| `Peek()`              | Returns the item at the front without removing it.                           |
| `Contains(item)`      | Checks if the queue contains a specific item.                                |
| `Clear()`             | Removes all items from the queue.                                            |
| `Count`               | Gets the number of items in the queue.                                       |
| `ToArray()`           | Copies the queue elements to a new array.                                    |
| `CopyTo(array, index)`| Copies the queue elements to an existing array starting at a specific index. |
| `TrimExcess()`        | Sets the capacity to the actual number of elements, minimizing memory usage. |

### `Stack<T>`

A `Stack<T>` is a last-in, first-out (LIFO) collection.
You push items onto the top and pop them off from the top. Internally, `Stack<T>` uses an array that grows dynamically.
It allows duplicates and null values (for reference types). Common operations are `Push`, `Pop` (removes and returns top),
and `Peek` (views top without removing).

**When to use:** Use `Stack<T>` when you need LIFO behavior, such as undo mechanisms, depth-first search, or preserving
context (function call stacks). It's also useful to reverse order of processing.

- LIFO behavior: last item added is first retrieved
- Typical use-case: nested or recursive algorithms, backtracking.

#### Common Stack Methods in C#

| Method          | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `Push(T item)`  | Adds an item to the top of the stack.                        |
| `Pop()`         | Removes and returns the item at the top of the stack.        |
| `Peek()`        | Returns the item at the top of the stack without removing it.|
| `Contains(T)`   | Checks whether an item exists in the stack.                  |
| `Clear()`       | Removes all items from the stack.                            |
| `ToArray()`     | Copies the stack to a new array.                             |
| `Count`         | Gets the number of elements in the stack.                    |

### LinkedList in C#

A `LinkedList<T>` is a doubly-linked list of nodes. Each node (`LinkedListNode<T>`) points to its predecessor and successor.
This structure allows efficient O(1) insertion and removal of nodes given a reference. However, it has no fast random
access (getting an element by index is O(n)). `LinkedList<T>` maintains order of insertion, allows duplicate and null
elements.

**When to use:** Use `LinkedList<T>` when you need frequent insertions or deletions in the middle of a list, and you can hold
references to nodes. It's useful for implementing queues or deques where you often remove from both ends,
or any algorithm requiring frequent list splicing.

- Each insertion/removal at a known node is O(1).
- Maintains order, but traversal/search is O(n).
- Useful when number of insertions/deletions is large compared to accesses.

#### Methods of LinkedList class

- `AddFirst(T value)` — Adds a new node containing the specified value at the beginning of the list.
- `AddLast(T value)` — Adds a new node containing the specified value at the end of the list.
- `AddBefore(LinkedListNode<T> node, T value)` — Inserts a new node before the specified existing node.
- `AddAfter(LinkedListNode<T> node, T value)` — Inserts a new node after the specified existing node.
- `Remove(T value)` — Removes the first occurrence of the specified value.
- `RemoveFirst()` — Removes the first node of the list.
- `RemoveLast()` — Removes the last node of the list.
- `Find(T value)` — Returns the first node that contains the specified value.
- `FindLast(T value)` — Returns the last node that contains the specified value.

**Example:**

```csharp
using System;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        LinkedList<string> list = new LinkedList<string>();
        list.AddLast("apple");
        list.AddFirst("banana");
        list.AddAfter(list.First, "cherry");

        foreach (var item in list)
        {
            Console.WriteLine(item);
        }
    }
}
```

## 2) Non-Generic Collections (`System.Collections`)

The non-generic collections were originally used before generics were introduced. They store items as `object`, so they
are not type-safe and incur boxing/unboxing for value types. Microsoft recommends using the generic equivalents in new
code. These legacy types accept null and duplicates (unless noted) but should mainly be used for compatibility with
older APIs.

### ArrayList

`ArrayList` is a dynamically resizable array of `object`. It allows heterogeneous elements and automatically grows its
capacity as needed. Because it stores `object`, inserting value types involves boxing. It maintains insertion order and
allows duplicates and null. However, it is not recommended for new development; use `List<T>` instead.

**When to use:** Mostly for backward compatibility. If you need a non-generic list of objects (rare in modern code), you
can use `ArrayList`. Otherwise, prefer `List<T>` for type safety and performance.

**Example:**

```csharp
ArrayList alist = new ArrayList();
alist.Add("hello");
alist.Add(123);     // int boxed as object
alist.Add(null);
Console.WriteLine(alist[1]); // 123 (as object)
```

### Hashtable

`Hashtable` is a non-generic key/value map based on hashing. It stores keys and values as `object`. Keys must be unique
and non-null; values can be null. Lookup by key is fast, but because it uses `object`, it requires casting when
retrieving. As with `ArrayList`, `Hashtable` is not type-safe. Use `Dictionary<TKey,TValue>` instead for new code.

**When to use:** Only for legacy code. Use cases include older APIs that return `Hashtable` or when key/value types aren't
known at compile time (though even then `Dictionary<object,object>` would be better).

**Example:**

```csharp
Hashtable table = new Hashtable();
table["apple"] = 1;
table["banana"] = 2;
if (table.ContainsKey("apple"))
    Console.WriteLine(table["apple"]); // 1 (retrieved as object)
```

### Queue (`System.Collections`)

This non-generic `Queue` implements a FIFO queue using a circular array. It operates similarly to `Queue<T>`, but holds
`object` elements. It accepts null and duplicates. Because it is not type-safe, one must cast elements when dequeuing.
Use generic `Queue<T>` in new code.

**Example:**

```csharp
Queue oldQueue = new Queue();
oldQueue.Enqueue("first");
oldQueue.Enqueue("second");
string s = (string)oldQueue.Dequeue();
Console.WriteLine(s); // "first"
```

### Stack (`System.Collections`)

This non-generic `Stack` is a LIFO stack of `object`. It provides `Push`, `Pop`, and `Peek`, just like `Stack<T>`, but stores items
as `object`. It allows duplicates and null. Prefer `Stack<T>` for new development.

**Example:**

```csharp
Stack oldStack = new Stack();
oldStack.Push("one");
oldStack.Push("two");
var top = oldStack.Pop();   // object, value "two"
Console.WriteLine(top);
```
