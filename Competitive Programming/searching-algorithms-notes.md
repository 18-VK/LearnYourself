# Searching Algorithms — Detailed Notes (C#)

Each algorithm includes: how it works, time/space complexity, prerequisites, pros/cons, and a C# implementation.

---

## 1. Linear Search

**How it works:** Scan every element from start to end, comparing each with the target.

| Case | Time |
|---|---|
| Best (target at index 0) | O(1) |
| Average | O(n) |
| Worst (last / not found) | O(n) |

**Space:** O(1)
**Requires sorted input:** No

**Pros:**
- Works on any collection: unsorted arrays, linked lists, streams
- Trivial to implement
- Fastest choice for very small n or a one-time search

**Cons:**
- O(n) — too slow for large data or repeated queries

```csharp
int LinearSearch(int[] arr, int target)
{
    for (int i = 0; i < arr.Length; i++)
        if (arr[i] == target) return i;
    return -1;
}
```

> Built-ins that do this internally: `Array.IndexOf`, `List<T>.Contains`, `List<T>.IndexOf`, LINQ `Any` / `FirstOrDefault`.

---

## 2. Binary Search

**How it works:** On a **sorted** array, compare the target with the middle element and discard half the range each step.

| Case | Time |
|---|---|
| Best | O(1) |
| Average | O(log n) |
| Worst | O(log n) |

**Space:** O(1) iterative, O(log n) recursive
**Requires sorted input:** Yes

**Pros:**
- Extremely fast — 1 billion elements need only ~30 comparisons
- O(1) space when iterative

**Cons:**
- Input must be sorted (sorting costs O(n log n) if not already)
- Needs random access — poor fit for linked lists
- Easy to get off-by-one bugs (`<` vs `<=`, `mid ± 1`)

```csharp
int BinarySearch(int[] arr, int target)
{
    int left = 0, right = arr.Length - 1;
    while (left <= right)
    {
        int mid = left + (right - left) / 2;   // avoids int overflow
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}
```

**Recursive version:**
```csharp
int BinarySearchRec(int[] arr, int target, int left, int right)
{
    if (left > right) return -1;
    int mid = left + (right - left) / 2;
    if (arr[mid] == target) return mid;
    return arr[mid] < target
        ? BinarySearchRec(arr, target, mid + 1, right)
        : BinarySearchRec(arr, target, left, mid - 1);
}
```

**Why `left + (right - left) / 2` and not `(left + right) / 2`?** For huge indices, `left + right` can overflow `int` and go negative.

---

## 3. Lower Bound / Upper Bound (Binary Search Variants)

Standard binary search returns *any* matching index. With **duplicates**, LeetCode usually wants the **first** or **last** occurrence, or an insertion position.

- **Lower bound:** first index where `arr[i] >= target`
- **Upper bound:** first index where `arr[i] > target`

| Use | Formula |
|---|---|
| First occurrence | `lower = LowerBound(target)`, valid if `arr[lower] == target` |
| Last occurrence | `UpperBound(target) - 1` |
| Count of target | `UpperBound(target) - LowerBound(target)` |
| Insertion position | `LowerBound(target)` |

```csharp
int LowerBound(int[] arr, int target)
{
    int left = 0, right = arr.Length;      // right = Length (exclusive)
    while (left < right)
    {
        int mid = left + (right - left) / 2;
        if (arr[mid] < target) left = mid + 1;
        else right = mid;
    }
    return left;
}

int UpperBound(int[] arr, int target)
{
    int left = 0, right = arr.Length;
    while (left < right)
    {
        int mid = left + (right - left) / 2;
        if (arr[mid] <= target) left = mid + 1;
        else right = mid;
    }
    return left;
}
```

**Complexity:** O(log n) time, O(1) space.

**Example:** `arr = [1, 2, 2, 2, 3]`, `target = 2`
- `LowerBound = 1`, `UpperBound = 4`
- Count = `4 - 1 = 3`, first index = 1, last index = 3

---

## 4. Binary Search on Answer (Very Common in LeetCode)

**Idea:** When the answer lies in a numeric range and the condition is **monotonic** (false…false, true…true), binary search the *answer space* instead of an array.

**Template:**
```csharp
int lo = minPossible, hi = maxPossible;
while (lo < hi)
{
    int mid = lo + (hi - lo) / 2;
    if (IsFeasible(mid)) hi = mid;      // try smaller
    else lo = mid + 1;                  // need bigger
}
return lo;
```

**Classic problems:** Koko Eating Bananas, Capacity to Ship Packages, Split Array Largest Sum, Sqrt(x), Minimum Days to Make Bouquets.

**Complexity:** O(log(range) × cost of `IsFeasible`)

**Example — integer square root:**
```csharp
int MySqrt(int x)
{
    int lo = 0, hi = x, ans = 0;
    while (lo <= hi)
    {
        int mid = lo + (hi - lo) / 2;
        if ((long)mid * mid <= x) { ans = mid; lo = mid + 1; }
        else hi = mid - 1;
    }
    return ans;
}
```
(Note the `(long)` cast — `mid * mid` can overflow `int`.)

---

## 5. Jump Search

**How it works:** On a sorted array, jump ahead in blocks of size √n until you overshoot the target, then do a linear scan inside the last block.

| Case | Time |
|---|---|
| Average / Worst | O(√n) |

**Space:** O(1)
**Requires sorted input:** Yes

**Pros:**
- Fewer comparisons than linear search
- Only moves forward (unlike binary search which jumps back) — useful when backward traversal is costly

**Cons:**
- Slower than binary search (O(√n) vs O(log n))
- Rarely used in practice or on LeetCode

```csharp
int JumpSearch(int[] arr, int target)
{
    int n = arr.Length;
    int step = (int)Math.Sqrt(n);
    int prev = 0;

    while (prev < n && arr[Math.Min(step, n) - 1] < target)
    {
        prev = step;
        step += (int)Math.Sqrt(n);
        if (prev >= n) return -1;
    }

    for (int i = prev; i < Math.Min(step, n); i++)
        if (arr[i] == target) return i;
    return -1;
}
```

---

## 6. Interpolation Search

**How it works:** Like binary search, but instead of always probing the middle, it *estimates* the position based on the target's value (like looking for "Zebra" near the end of a dictionary).

```
pos = left + ((target - arr[left]) * (right - left)) / (arr[right] - arr[left])
```

| Case | Time |
|---|---|
| Best / Average (uniformly distributed) | O(log log n) |
| Worst (skewed data) | O(n) |

**Space:** O(1)
**Requires sorted input:** Yes, and ideally **uniformly distributed**

**Pros:**
- Can beat binary search on uniform numeric data

**Cons:**
- Degrades to O(n) on skewed/clustered data
- Only makes sense for numeric keys
- Risk of divide-by-zero / overflow if not careful

```csharp
int InterpolationSearch(int[] arr, int target)
{
    int left = 0, right = arr.Length - 1;

    while (left <= right && target >= arr[left] && target <= arr[right])
    {
        if (arr[left] == arr[right])
            return arr[left] == target ? left : -1;

        int pos = left + (int)(((long)(target - arr[left]) * (right - left))
                               / (arr[right] - arr[left]));

        if (arr[pos] == target) return pos;
        if (arr[pos] < target) left = pos + 1;
        else right = pos - 1;
    }
    return -1;
}
```

---

## 7. Exponential Search

**How it works:** Find a range where the target might exist by doubling an index (1, 2, 4, 8, …), then binary search inside that range.

| Case | Time |
|---|---|
| Average / Worst | O(log n) — more precisely O(log i), where i = target's position |

**Space:** O(1)
**Requires sorted input:** Yes

**Pros:**
- Great for **unbounded / infinite** sorted sequences (size unknown)
- Faster than binary search when the target is near the start

**Cons:**
- Extra step vs plain binary search when the array size is known

```csharp
int ExponentialSearch(int[] arr, int target)
{
    if (arr.Length == 0) return -1;
    if (arr[0] == target) return 0;

    int bound = 1;
    while (bound < arr.Length && arr[bound] <= target)
        bound *= 2;

    int left = bound / 2;
    int right = Math.Min(bound, arr.Length - 1);
    return Array.BinarySearch(arr, left, right - left + 1, target) is int idx && idx >= 0
        ? idx : -1;
}
```

---

## 8. Ternary Search

**How it works:** Splits the range into three parts using two midpoints. Mainly used to find the **maximum/minimum of a unimodal function** (goes up then down, or down then up), not to search sorted arrays.

| Case | Time |
|---|---|
| All | O(log₃ n) — asymptotically O(log n) |

**Space:** O(1)

**Pros:**
- Finds the peak/valley of unimodal functions where derivatives aren't available

**Cons:**
- For plain sorted-array lookup, binary search is *faster* in practice (fewer comparisons per step)
- Requires a strictly unimodal function (plateaus break it)

```csharp
int TernaryMaxIndex(int[] arr)   // arr strictly increases then strictly decreases
{
    int left = 0, right = arr.Length - 1;
    while (right - left > 2)
    {
        int m1 = left + (right - left) / 3;
        int m2 = right - (right - left) / 3;
        if (arr[m1] < arr[m2]) left = m1;
        else right = m2;
    }
    int best = left;
    for (int i = left + 1; i <= right; i++)
        if (arr[i] > arr[best]) best = i;
    return best;
}
```

> For the peak in a mountain array, a simpler binary search comparing `arr[mid]` with `arr[mid + 1]` also works (LeetCode 852 / 162).

---

## 9. Hash-Based Search

**How it works:** Uses `GetHashCode()` to jump directly to a bucket (see hashing notes).

| Case | Time |
|---|---|
| Average | O(1) |
| Worst (heavy collisions) | O(n) |

**Space:** O(n)
**Requires sorted input:** No

**Pros:**
- Fastest general-purpose lookup
- Works on unsorted data

**Cons:**
- Extra memory
- No ordering / range queries (`next greater`, `between a and b`)
- Requires correct `Equals`/`GetHashCode`

```csharp
var seen = new HashSet<int>(arr);
bool exists = seen.Contains(target);          // O(1) average

var index = new Dictionary<int, int>();       // value -> index
for (int i = 0; i < arr.Length; i++) index[arr[i]] = i;
```

---

## 10. Graph / Tree Searching (BFS & DFS)

Used when data is a **graph, tree, or grid** rather than a flat array.

### Breadth-First Search (BFS)
Explores level by level using a `Queue<T>`.

| | |
|---|---|
| Time | O(V + E) |
| Space | O(V) |
| Best for | **Shortest path in unweighted graphs**, level-order traversal, nearest-target problems |

```csharp
int BFS(Dictionary<int, List<int>> graph, int start, int target)
{
    var queue = new Queue<(int node, int dist)>();
    var visited = new HashSet<int> { start };
    queue.Enqueue((start, 0));

    while (queue.Count > 0)
    {
        var (node, dist) = queue.Dequeue();
        if (node == target) return dist;

        foreach (int next in graph.GetValueOrDefault(node, new List<int>()))
            if (visited.Add(next))               // Add returns false if already present
                queue.Enqueue((next, dist + 1));
    }
    return -1;
}
```

### Depth-First Search (DFS)
Goes as deep as possible before backtracking, using recursion or a `Stack<T>`.

| | |
|---|---|
| Time | O(V + E) |
| Space | O(V) (recursion depth / stack) |
| Best for | Path existence, cycle detection, topological sort, backtracking, connected components |

```csharp
bool DFS(Dictionary<int, List<int>> graph, int node, int target, HashSet<int> visited)
{
    if (node == target) return true;
    visited.Add(node);

    foreach (int next in graph.GetValueOrDefault(node, new List<int>()))
        if (!visited.Contains(next) && DFS(graph, next, target, visited))
            return true;
    return false;
}
```

**BFS vs DFS quick pick:**

| Need | Use |
|---|---|
| Shortest path (unweighted) | BFS |
| Explore all possibilities / backtracking | DFS |
| Very deep graph (risk of stack overflow) | BFS or iterative DFS |
| Very wide graph (memory heavy queue) | DFS |

---

## Built-in C# Search Methods

| Method | Requires sorted? | Complexity | Notes |
|---|---|---|---|
| `Array.IndexOf(arr, x)` | No | O(n) | Linear scan |
| `list.Contains(x)` / `list.IndexOf(x)` | No | O(n) | Linear scan |
| `Array.BinarySearch(arr, x)` | **Yes** | O(log n) | Returns **negative** value (`~insertionIndex`) if not found |
| `list.BinarySearch(x)` | **Yes** | O(log n) | Same negative-complement convention |
| `HashSet<T>.Contains` | No | O(1) avg | |
| `Dictionary.ContainsKey` / `TryGetValue` | No | O(1) avg | |
| `SortedSet<T>.Contains` | No (self-sorted) | O(log n) | Also supports `GetViewBetween` for range queries |
| `SortedSet<T>.Min / Max` | — | O(log n) | |

```csharp
int idx = Array.BinarySearch(arr, 7);
if (idx < 0)
{
    int insertPos = ~idx;   // bitwise complement gives where it WOULD be inserted
}
```

---

## Summary Table

| Algorithm | Time (avg) | Time (worst) | Space | Needs Sorted? | Best For |
|---|---|---|---|---|---|
| Linear Search | O(n) | O(n) | O(1) | No | Small / unsorted data |
| Binary Search | O(log n) | O(log n) | O(1) | Yes | Sorted arrays |
| Lower/Upper Bound | O(log n) | O(log n) | O(1) | Yes | Duplicates, insertion point, counts |
| Binary Search on Answer | O(log R · f) | O(log R · f) | O(1) | Monotonic condition | Min/max optimization problems |
| Jump Search | O(√n) | O(√n) | O(1) | Yes | Backward traversal is expensive |
| Interpolation Search | O(log log n) | O(n) | O(1) | Yes (uniform) | Uniformly distributed numbers |
| Exponential Search | O(log n) | O(log n) | O(1) | Yes | Unbounded / target near start |
| Ternary Search | O(log n) | O(log n) | O(1) | Unimodal function | Peak / valley finding |
| Hash Lookup | O(1) | O(n) | O(n) | No | Fast membership / frequency |
| BFS | O(V+E) | O(V+E) | O(V) | — | Shortest path (unweighted) |
| DFS | O(V+E) | O(V+E) | O(V) | — | Backtracking, connectivity |

---

## When to Use What (LeetCode Cheat Guide)

- **"Find element in sorted array"** → Binary Search
- **"First / last occurrence", "count of X", "insert position"** → Lower/Upper Bound
- **"Minimum X such that condition holds" / "maximum minimum"** → Binary Search on Answer
- **"Rotated sorted array"** → Modified binary search (compare `arr[mid]` with `arr[left]` / `arr[right]` to detect the sorted half)
- **"Peak element" / "mountain array"** → Binary search comparing `arr[mid]` with `arr[mid+1]`
- **"Does X exist?" in unsorted data, repeated queries** → `HashSet<T>`
- **"Two Sum"-style pair lookups** → `Dictionary<TKey,TValue>`
- **"Nearest / next greater / range in dynamic data"** → `SortedSet<T>`
- **"Shortest path in grid / unweighted graph"** → BFS
- **"Find any path / explore all combinations"** → DFS / backtracking
- **Tiny arrays or a single query** → Linear search is perfectly fine
