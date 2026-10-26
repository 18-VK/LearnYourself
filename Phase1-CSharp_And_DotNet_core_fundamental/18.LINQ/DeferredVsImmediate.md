# Deferred vs Immediate Execution

## Deferred Execution

- Means the query is defined, but not executed immediately.
- Execution happens only when you iterate (e.g., `foreach`, `.ToList()`, `.Count()`, etc.).
- Each time you iterate, the query re-executes on the current data source.
- Deferred queries are lazy — they wait until you actually need the result.

🧠 Think: "LINQ query is just a plan, not an action, until I loop over it."

## ⚡ Immediate Execution

- The query is executed as soon as it is defined.
- The results are stored in memory (e.g., a `List`, array, or scalar value).
- Further changes in the data source don't affect the stored results.

🧠 Think: "Run it now and store the result."

## 🧪 2️⃣ Examples

### 🕓 Deferred Execution Example

```csharp
var numbers = new List<int> { 1, 2, 3, 4 };

// Query definition (not executed yet)
var query = numbers.Where(n => n > 2);

// Modify the source BEFORE iterating
numbers.Add(5);

// Now execution happens during iteration
foreach (var n in query)
{
    Console.WriteLine(n);
}
```

**Output:**

```text
3
4
5
```

✅ Because the query executes after adding `5`, the new element is included.

### ⚡ Immediate Execution Example

```csharp
var numbers = new List<int> { 1, 2, 3, 4 };

// Query executed immediately by ToList()
var result = numbers.Where(n => n > 2).ToList();

// Modify the source
numbers.Add(5);

// Iterating over the result
foreach (var n in result)
{
    Console.WriteLine(n);
}
```

**Output:**

```text
3
4
```

✅ Because `ToList()` executed the query immediately, it captured the results before `5` was added.

## 🧭 3️⃣ How to Trigger Immediate Execution

LINQ methods that force execution:

**Materialization methods:**

`ToList()`, `ToArray()`, `ToDictionary()`, `ToLookup()`

**Aggregation methods:**

`Count()`, `Sum()`, `Average()`, `Min()`, `Max()`, `First()`, `FirstOrDefault()`, `Single()`, `Any()`, etc.

## Why It Matters

These execute right away and return a result.

| Aspect         | Deferred Execution                            | Immediate Execution               |
| -------------- | --------------------------------------------- | --------------------------------- |
| Performance    | Can be more efficient — runs only when needed | May be wasteful if results unused |
| Data freshness | Reflects latest data                          | Uses snapshot at query time       |
| Memory use     | Low (streamed as you iterate)                 | Higher (stores all results)       |

## `ToLookup()`

Creates an immutable, one-to-many dictionary-like structure
that maps a key → collection of values.

It's like `GroupBy()`, but it immediately executes and returns an `ILookup<TKey, TElement>`.

🧠 Think of it as:

```csharp
Dictionary<TKey, List<TElement>>
```

that is read-only and auto-groups your data.

### 📘 Syntax

```csharp
ILookup<TKey, TElement> lookup = collection.ToLookup(
    keySelector,
    elementSelector   // optional
);
```

- `keySelector` → defines how to group
- `elementSelector` → defines what to include in each group (optional)

### 🧪 Example 1 — Basic grouping

```csharp
var lookup = products.ToLookup(p => p.Category);

foreach (var group in lookup)
{
    Console.WriteLine($"Category: {group.Key}");
    foreach (var item in group)
        Console.WriteLine($"  {item.Name}");
}
```

Similar to `GroupBy()`, but the result is already evaluated and can be reused multiple times efficiently.
