# LINQ (Language-Integrated Query)

LINQ (Language-Integrated Query) is a set of features in C# that lets you query collections (and other data sources) with
a readable, composable syntax. It brings SQL-like querying capabilities directly into the language and works across many
providers: in-memory collections (LINQ to Objects), databases (LINQ to Entities / LINQ to SQL), XML (LINQ to XML), and
more.

## Basics & syntax

Two main styles:

**Query syntax (looks like SQL)**

```csharp
from x in collection where ... select ...
```

**Method (fluent) syntax (uses extension methods)**

```csharp
collection.Where(...).Select(...).OrderBy(...)
```

Both compile to the same underlying calls and you can mix them.

## Use cases — when LINQ shines

- Filtering and transforming in-memory collections cleanly and readably.
- Building composable query pipelines (you can build parts of a query in different methods).
- Querying databases with ORM (EF Core) — expressive queries that turn into SQL.
- Querying XML/JSON-like trees.
- Grouping, aggregation and reporting.
- Pagination (`Skip`/`Take`) and projections to DTOs for APIs.
- Merging/joining related collections (orders/customers, parent/child lists).

## When not to use LINQ

- Very hot inner-loop code with micro-optimizations — a simple loop can be faster and clearer.
- When the logic is easier to express with imperative code (very complex stateful transforms).
- When you need fine-grained control over SQL (sometimes raw SQL is better).

## Query-expression keywords (SQL-like)

### Common operators (cheat-sheet)

- **Filtering:** `Where`
- **Projection:** `Select`, `SelectMany`
- **Sorting:** `OrderBy`, `OrderByDescending`, `ThenBy`
- **Grouping:** `GroupBy`
- **Joining:** `Join`, `GroupJoin`
- **Quantifiers / existence:** `Any`, `All`
- **Aggregates:** `Count`, `Sum`, `Min`, `Max`, `Average`, `Aggregate`
- **Pagination:** `Skip`, `Take`
- **Conversion:** `ToList`, `ToArray`, `AsEnumerable`
- **Element operators:** `First`, `FirstOrDefault`, `Single`, `SingleOrDefault`, `ElementAt`
- **Set operations:** `Distinct`, `Union`, `Intersect`, `Except`

### 1) `from`

**Definition:** Introduces a range variable and the data source for a query (like the `FROM` clause in SQL).

**Example:**

```csharp
var nums = new[] {1,2,3};
var q = from n in nums
        select n * 2; // {2,4,6}
```

**Note:** Every query-expression starts with one or more `from`.

### 2) `where`

**Definition:** Filters elements by a boolean predicate (like SQL `WHERE`).

**Example:**

```csharp
var adults = from p in people
             where p.Age >= 21
             select p.Name;
```

**Note:** Translates to `.Where(...)` in method syntax.

### 3) `select`

**Definition:** Projects each element into a new form (like SQL `SELECT`).

**Example:**

```csharp
var names = from p in people
            select p.Name;
```

**Note:** Query-expression `select` corresponds to `.Select(...)`.

### 4) `orderby` / `ascending` / `descending`

**Definition:** Sorts the query results by one or more keys. Default is ascending.

**Example:**

```csharp
var q = from p in people
        orderby p.LastName descending, p.FirstName ascending
        select p;
```

**Note:** Multiple keys supported; maps to `.OrderBy(...)`, `.OrderByDescending(...)`, `.ThenBy(...)`.

### 5) `join`

**Definition:** Performs an inner join between two sequences based on matching keys.

**Example:**

```csharp
var q = from c in customers
        join o in orders on c.Id equals o.CustomerId
        select new { c.Name, o.Id };
```

**Note:** Use `into` after `join` for group joins / outer joins.

### 6) `group` / `by`

**Definition:** Groups elements by a key; creates `IGrouping<TKey, TElement>`.

**Example:**

```csharp
var q = from p in products
        group p by p.Category into g
        select new { Category = g.Key, Count = g.Count() };
```

**Note:** `into` names the group to continue query operations on it.

### 7) `let`

**Definition:** Introduces a temporary range variable to store a sub-expression result.

**Example:**

```csharp
var q = from s in sentences
        let words = s.Split(' ')
        where words.Length > 3
        select new { s, WordCount = words.Length };
```

**Note:** Helps avoid recomputing expressions and improves readability.

### 8) `from ... in ...` (multiple `from`) — query form of `SelectMany`

**Definition:** Flatten nested collections (one `from` inside another) to enumerate inner elements.

**Example:**

```csharp
var q = from c in customers
        from o in c.Orders
        select new { c.Name, o.Id };
```

**Note:** Equivalent to `.SelectMany(...)` in method syntax.

### 9) `into`

**Definition:** Gives a name to an intermediate query result for further chaining (commonly used after `group` or `join`).

**Example:**

```csharp
var q = from p in products
        group p by p.Category into g
        where g.Count() > 1
        select g;
```

**Note:** Without `into` you cannot continue the query on the grouped results.

## Standard query operators (method/fluent syntax)

### 1) `Where(predicate)`

**Definition:** Returns elements that satisfy the predicate.

**Example:**

```csharp
var even = nums.Where(n => n % 2 == 0);
```

**Note:** Deferred execution; invoked when enumerated.

### 2) `Select(selector)`

**Definition:** Projects each element into a new form.

**Example:**

```csharp
var squares = nums.Select(n => n * n);
```

**Note:** Use to shape DTOs or anonymous types.

### 3) `SelectMany(selector)`

**Definition:** Projects each element to an `IEnumerable<T>` and flattens into a single sequence.

**Example:**

```csharp
var allOrders = customers.SelectMany(c => c.Orders);
```

**Example:**

```csharp
var students = new List<Student>
        {
            new Student { Name = "Aman",  Subjects = new List<string> { "Math", "Physics" } },
            new Student { Name = "Priya", Subjects = new List<string> { "Chemistry", "Biology" } },
            new Student { Name = "Rohit", Subjects = new List<string> { "Math", "English" } }
        };

        // SelectMany flattens list of subjects
        var allSubjects = students
            .SelectMany(s => s.Subjects)
            .Distinct(); // remove duplicates for clarity
```

**Note:** Useful for nested collections (orders per customer).

**Example 2:**

`SelectMany` projects each element of a sequence to an `IEnumerable` and then flattens the resulting sequences into one
single sequence.

👉 In simple terms:

- `Select` → gives you a sequence of sequences.
- `SelectMany` → flattens that into one sequence.

🧠 **Syntax**

```csharp
var result = collection.SelectMany(selector);
```

Or with a result selector:

```csharp
var result = collection.SelectMany(
    collectionSelector,
    (outer, inner) => new { outer, inner }
);
```

📌 **Example 1 — Flattening a List of Lists**

```csharp
var numbers = new List<List<int>>
{
    new List<int> { 1, 2 },
    new List<int> { 3, 4 },
    new List<int> { 5, 6 }
};

// Select → produces a sequence of lists
var selectResult = numbers.Select(n => n);
Console.WriteLine("Using Select:");
foreach (var list in selectResult)
    Console.WriteLine(string.Join(", ", list));

// SelectMany → flattens into one sequence
var selectManyResult = numbers.SelectMany(n => n);
Console.WriteLine("Using SelectMany:");
Console.WriteLine(string.Join(", ", selectManyResult));
```

✅ **Output:**

```text
Using Select:
1, 2
3, 4
5, 6

Using SelectMany:
1, 2, 3, 4, 5, 6
```

### 4) `OrderBy(keySelector)` / `OrderByDescending(...)` / `ThenBy(...)`

**Definition:** Sorts elements by key(s).

**Example:**

```csharp
var sorted = people.OrderBy(p => p.LastName).ThenBy(p => p.FirstName);
```

**Note:** Use `ThenBy`/`ThenByDescending` for secondary keys.

### 5) `Take(n)` / `Skip(n)`

**Definition:** `Take` returns the first n elements; `Skip` bypasses the first n elements.

**Take:**

```csharp
int[] numbers = { 10, 20, 30, 40, 50, 60 };

var result = numbers.Take(3);

foreach (var n in result)
    Console.WriteLine(n);
```

**Skip:**

```csharp
int[] numbers = { 10, 20, 30, 40, 50, 60 };

var result = numbers.Skip(3);

foreach (var n in result)
    Console.WriteLine(n);
```

**Combine take and skip:**

```csharp
int[] numbers = { 10, 20, 30, 40, 50, 60, 70, 80, 90 };

// Page 2 (Skip 3 elements of Page 1, Take next 3)
int pageSize = 3;
int pageNumber = 2;

var pageData = numbers
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize);
```

### 6) `TakeWhile(predicate)` / `SkipWhile(predicate)`

**Definition:** Take/skip elements while predicate holds (based on sequence order).

**Example:**

```csharp
var head = nums.TakeWhile(n => n < 10);
```

**Note:** Order-sensitive.

### 7) `Distinct()`

**Definition:** Removes duplicate elements using default equality comparer.

**Example:**

```csharp
var uniq = values.Distinct();
```

**Note:** Uses `Equals`/`GetHashCode` of element type.

### 8) `Any(predicate?)` / `All(predicate)` / `Contains(item)`

**Definition:** Quantifiers and membership checks. `Any` tests for existence, `All` tests if all satisfy, `Contains` checks membership.

**Example:**

```csharp
bool hasAdults = people.Any(p => p.Age >= 21);
bool allPositive = nums.All(n => n > 0);
bool contains = nums.Contains(5);
```

**Note:** `Any()` without predicate returns true if sequence non-empty.

### 9) `Count()` / `LongCount()` / `Sum(selector)` / `Min(selector)` / `Max(selector)` / `Average(selector)`

**Definition:** Aggregation operators returning counts, sums, min/max, average.

**Example:**

```csharp
int c = items.Count();
double total = products.Sum(p => p.Price);
var minPrice = products.Min(p => p.Price);
```

**Note:** These execute immediately (not deferred).

**`Count()`**

- **Return Type:** `int`
- **Purpose:** Counts the number of elements in a collection.
- **Use When:** The total count is expected to fit within the range of a 32-bit integer (`int.MaxValue` = 2,147,483,647).

**`LongCount()`**

- **Return Type:** `long`
- **Purpose:** Also counts elements but returns a 64-bit integer.
- **Use When:** The collection may contain more elements than `int.MaxValue`.

### 10) `Aggregate(seed?, func, resultSelector?)`

The `Aggregate` method applies an accumulator function over a sequence.

You can:

- Use it without a seed (first element used as the initial value),
- Use it with a seed (you provide the initial value),
- Use it with a seed and a result selector (to shape the final result).

**No seed, just an accumulator function.**

```csharp
var numbers = new[] { 2, 3, 4 };
int result = numbers.Aggregate((acc, n) => acc * n);
Console.WriteLine(result);  // Output: 24 (2*3*4)
```

**With a seed (you provide the initial accumulator).**

```csharp
var numbers = new[] { 2, 3, 4 };
// Start with seed = 10
int result = numbers.Aggregate(10, (acc, n) => acc + n);
Console.WriteLine(result);  // Output: 19 (10+2+3+4)
```

**With seed + result selector (final transformation of the result).**

- `seed`: initial value
- `func`: accumulation logic
- `resultSelector`: shape or project the final result

**Example — Counting and formatting**

```csharp
var numbers = new[] { 2, 3, 4 };

string result = numbers.Aggregate(
    0,                                 // seed: start count
    (acc, n) => acc + n,               // func: sum numbers
    sum => $"The total is {sum}"       // resultSelector: format string
);

Console.WriteLine(result);  // Output: "The total is 9"
```

### 11) `First()` / `FirstOrDefault()` / `Single()` / `SingleOrDefault()` / `ElementAt()` / `ElementAtOrDefault()`

**`First()`**

Returns the first element of a sequence.
If no element is found — throws an exception (`InvalidOperationException`).

```csharp
var first = people.First();
```

**`FirstOrDefault()`**

Returns the first element of a sequence or the default value if not found (e.g., 0 for `int`, `null` for reference types).

```csharp
int result = numbers.FirstOrDefault(n => n > 50);
```

**`Single()`**

Returns the only element in the sequence.
Throws exception if no elements or more than one element exist.
Often used when you expect exactly one match.

```csharp
int result = list.Single(n => n == 20);
```

**Exception case:**

```csharp
var list = new[] { 10, 20, 30 };
int result = list.Single();  // ❌ Throws: sequence contains more than one element
```

**`SingleOrDefault()`**

Returns the only element if it exists, or default if sequence is empty.
❌ Throws exception if there is more than one element.

```csharp
int result = list.SingleOrDefault(); 
```

**Exception case:**

```csharp
var list = new[] { 10, 20 };
int result = list.SingleOrDefault();  // ❌ Throws exception (more than one element)
```

**`ElementAt()`**

Returns the element at a specific zero-based index.
❌ Throws exception if index is out of range.

**`ElementAtOrDefault()`**

Returns the element at the specified index, or default if index is out of range.

```csharp
var numbers = new[] { 10, 20, 30 };

int value = numbers.ElementAtOrDefault(10);
Console.WriteLine(value); // Output: 0 (default int)
```

### 12) `OfType<TResult>()` / `Cast<TResult>()`

**`OfType<TResult>()`**

Filters the elements of an `IEnumerable` based on a specified type.
Keeps only elements that can be assigned to the specified type.
Skips others silently (no exceptions).

```csharp
IEnumerable<object> mixed = new object[]{1,"a",2};
var ints = mixed.OfType<int>(); // yields 1,2
```

**`Cast<TResult>()`**

Casts all elements of a collection to the specified type.
Assumes all elements are of that type (or compatible).
❌ Throws `InvalidCastException` if any element cannot be cast.

```csharp
var intNumbers = numbers.Cast<int>();
```

### 13) `ToList()` / `ToArray()` / `ToDictionary()` / `ToLookup()`

**`ToList()`**

Executes the LINQ query and converts the result into a `List<T>`.
Useful when you want a mutable, indexable collection.
Forces immediate execution (important for deferred queries).

✅ **Example:**

```csharp
var numbers = Enumerable.Range(1, 5);  // Deferred

List<int> list = numbers.ToList();     // Immediate execution

list.Add(6);
foreach (var n in list)
    Console.WriteLine(n);
```

**`ToArray()`**

Executes the LINQ query and converts the result into an array (`TSource[]`).
Also forces immediate execution.
Useful when you need fixed-size collections or performance optimization.

✅ **Example:**

```csharp
var numbers = Enumerable.Range(1, 5);
int[] array = numbers.ToArray();

Console.WriteLine(array[0]);  // Output: 1
```

**`ToDictionary()`**

Converts a sequence into a `Dictionary<TKey, TValue>`.
Requires a key selector function.
Optional value selector (otherwise the element itself is the value).
❌ Throws an exception if duplicate keys exist.

🧾 **Syntax:**

```csharp
Dictionary<TKey, TSource> ToDictionary(
    Func<TSource, TKey> keySelector
);

Dictionary<TKey, TValue> ToDictionary(
    Func<TSource, TKey> keySelector,
    Func<TSource, TValue> elementSelector
);
```

✅ **Example — Simple**

```csharp
var people = new[]
{
    new { Id = 1, Name = "Aman" },
    new { Id = 2, Name = "Rahul" },
    new { Id = 3, Name = "Sara" }
};

var dict = people.ToDictionary(p => p.Id);
Console.WriteLine(dict[2].Name);  // Output: Rahul
```

✅ **Example — With element selector**

```csharp
var dict2 = people.ToDictionary(p => p.Id, p => p.Name);
Console.WriteLine(dict2[3]);  // Output: Sara
```

❌ **Example — Duplicate keys:**

```csharp
var numbers = new[] { 1, 2, 2, 3 };
var dict = numbers.ToDictionary(x => x); // ❌ Will throw ArgumentException
```

✅ **When to use:**

- When you need fast lookups by key.
- When keys are unique and well-defined.

**`ToLookup()`**

✅ **Definition:**

Converts a sequence into an `ILookup<TKey, TElement>` (like a dictionary but allows multiple values per key).
Does not throw exception for duplicate keys.
Similar to `GroupBy()`, but materializes immediately and gives fast lookup.

🧾 **Syntax:**

```csharp
ILookup<TKey, TSource> ToLookup(
    Func<TSource, TKey> keySelector
);

ILookup<TKey, TElement> ToLookup(
    Func<TSource, TKey> keySelector,
    Func<TSource, TElement> elementSelector
);
```

✅ **Example:**

```csharp
var numbers = new[] { 1, 2, 3, 4, 5, 6 };

// Group numbers by even/odd
var lookup = numbers.ToLookup(n => n % 2 == 0 ? "Even" : "Odd");

foreach (var num in lookup["Even"])
    Console.WriteLine(num);
```

🖨️ **Output:**

```text
2
4
6
```

👉 Unlike `Dictionary`, this groups multiple elements under the same key.

✅ **When to use:**

- When keys are not unique.
- When you want grouped lookups instead of single-value mappings.
- Alternative to `GroupBy().ToDictionary()`.

### 14) `Reverse()`

**Definition:** Reverses the order of elements in a sequence.

**Example:**

```csharp
var rev = seq.Reverse();
```

**Note:** Executes when enumerated; may buffer if source is streaming.

### 15) `SequenceEqual(other)`

The `SequenceEqual()` method in LINQ is used to compare two sequences element by element to determine if they are equal in
length and contain the same elements in the same order.

Compares two sequences for equality.
Returns true if:

- Both sequences have the same number of elements.
- Corresponding elements are equal (by default using `Equals` or with a custom comparer).

Otherwise returns false.

#### Example — Comparing two integer sequences

```csharp
var seq1 = new[] { 1, 2, 3, 4 };
var seq2 = new[] { 1, 2, 3, 4 };

bool isEqual = seq1.SequenceEqual(seq2);
Console.WriteLine(isEqual);
```

#### Example — Custom comparer

When comparing complex objects, you can provide a custom comparer or use `.Select` to project what you want to compare.

✅ **Using `IEqualityComparer`:**

```csharp
class Person
{
    public string Name { get; set; }
}

class PersonComparer : IEqualityComparer<Person>
{
    public bool Equals(Person x, Person y)
    {
        return x.Name == y.Name;
    }

    public int GetHashCode(Person obj)
    {
        return obj.Name.GetHashCode();
    }
}

var list1 = new[] { new Person { Name = "Aman" }, new Person { Name = "Rahul" } };
var list2 = new[] { new Person { Name = "Aman" }, new Person { Name = "Rahul" } };

bool equal = list1.SequenceEqual(list2, new PersonComparer());
Console.WriteLine(equal);
```

🖨️ **Output:**

```text
True
```

✅ **Using projection instead of comparer:**

```csharp
bool equal = list1.Select(p => p.Name)
                  .SequenceEqual(list2.Select(p => p.Name));
```

### 16) `Enumerable.Range(start, count)` / `Enumerable.Repeat(value, count)`

**Definition:** Factory helpers to generate sequences of integers or repeated values.

**Example:**

```csharp
var r = Enumerable.Range(1, 5); // {1,2,3,4,5}
var rep = Enumerable.Repeat("x", 3); // {"x","x","x"}
```

**Note:** Handy for tests and generating synthetic sequences.

### 17) `Zip`

The LINQ `Zip` operator is super useful when you want to pair elements from two sequences together —
like zipping two lists side by side.

🧠 **Basic Syntax**

```csharp
var result = firstSequence.Zip(secondSequence, (first, second) => new { first, second });
```

👉 It goes through both sequences at the same time.
👉 It stops when the shorter sequence ends.

📌 **Example 1 — Zipping two lists**

```csharp
var numbers = new[] { 1, 2, 3 };
var letters = new[] { "A", "B", "C", "D" };

var zipped = numbers.Zip(letters, (n, l) => $"{n}-{l}");

foreach (var item in zipped)
    Console.WriteLine(item);
```

✅ **Output:**

```text
1-A
2-B
3-C
```

Notice it stopped at 3 elements because `numbers` was shorter.

📆 **Example 2 — Consecutive element comparison in one sequence**

👉 Commonly used pattern: pair each element with its next element.
We use `.Skip(1)` for the second sequence.

```csharp
var dates = new[]
{
    new DateTime(2023,1,10),
    new DateTime(2023,3,15),
    new DateTime(2023,4,10)
};

var differences = dates
    .Zip(dates.Skip(1), (prev, next) => (next - prev).Days)
    .ToList();

differences.ForEach(d => Console.WriteLine(d));
```

The LINQ `Zip` operator is super useful when you want to pair elements from two sequences together — like zipping two lists side by side.

🧠 **Basic Syntax**

```csharp
var result = firstSequence.Zip(secondSequence, (first, second) => new { first, second });
```

👉 It goes through both sequences at the same time.
👉 It stops when the shorter sequence ends.

📌 **Example 1 — Zipping two lists**

```csharp
var numbers = new[] { 1, 2, 3 };
var letters = new[] { "A", "B", "C", "D" };

var zipped = numbers.Zip(letters, (n, l) => $"{n}-{l}");

foreach (var item in zipped)
    Console.WriteLine(item);
```

✅ **Output:**

```text
1-A
2-B
3-C
```

Notice it stopped at 3 elements because `numbers` was shorter.

📆 **Example 2 — Consecutive element comparison in one sequence**

👉 Commonly used pattern: pair each element with its next element.
We use `.Skip(1)` for the second sequence.

```csharp
var dates = new[]
{
    new DateTime(2023,1,10),
    new DateTime(2023,3,15),
    new DateTime(2023,4,10)
};

var differences = dates
    .Zip(dates.Skip(1), (prev, next) => (next - prev).Days)
    .ToList();

differences.ForEach(d => Console.WriteLine(d));
```

✅ **Output:**

```text
64
26
```

- 2023-03-15 − 2023-01-10 = 64 days
- 2023-04-10 − 2023-03-15 = 26 days
