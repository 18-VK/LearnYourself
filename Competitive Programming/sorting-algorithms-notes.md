# Sorting Algorithms — Detailed Notes (C#)

Each algorithm below includes: how it works, time/space complexity, pros/cons, stability, and a C# implementation.

### Quick concept: What does "stable" mean?
A stable sort preserves the original relative order of elements that compare equal.

Example: if two items both have the same key (for example, both are value `5`), a stable sort keeps their original order from the input array. This is useful when sorting records by one field but still wanting to keep the original order of ties.

**Watch this:** https://youtu.be/5d1pyghLs3M

---

## 1. Bubble Sort

**How it works:** Repeatedly compare adjacent elements and swap if out of order. Largest element "bubbles" to the end each pass.

| Case | Time |
|---|---|
| Best (already sorted) | O(n) — with early-exit flag |
| Average | O(n²) |
| Worst | O(n²) |

**Space:** O(1) — in-place
**Stable:** Yes

**Pros:**
- Extremely simple to implement and understand
- In-place, no extra memory
- Stable
- Detects already-sorted input in O(n) with an early-termination flag

**Cons:**
- Very slow on large inputs (O(n²))
- Almost never used in practice or interviews except to demonstrate understanding

```csharp
void BubbleSort(int[] arr)
{
    int n = arr.Length;
    for (int i = 0; i < n - 1; i++)
    {
        bool swapped = false;
        for (int j = 0; j < n - i - 1; j++)
        {
            if (arr[j] > arr[j + 1])
            {
                (arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);
                swapped = true;
            }
        }
        if (!swapped) break; // already sorted
    }
}
```

---

## 2. Selection Sort

**How it works:** Repeatedly find the minimum element from the unsorted portion and move it to the front.

| Case | Time |
|---|---|
| Best | O(n²) |
| Average | O(n²) |
| Worst | O(n²) |

**Space:** O(1) — in-place
**Stable:** No (swaps can reorder equal elements)

**Pros:**
- Simple, in-place
- Minimizes number of swaps — O(n) swaps total, useful when writes are expensive (e.g. flash memory)

**Cons:**
- Always O(n²) regardless of input — no best-case improvement
- Not stable
- Outperformed by insertion sort in practice for small arrays

```csharp
void SelectionSort(int[] arr)
{
    int n = arr.Length;
    for (int i = 0; i < n - 1; i++)
    {
        int minIdx = i;
        for (int j = i + 1; j < n; j++)
            if (arr[j] < arr[minIdx]) minIdx = j;

        if (minIdx != i)
            (arr[i], arr[minIdx]) = (arr[minIdx], arr[i]);
    }
}
```

---

## 3. Insertion Sort

**How it works:** Build a sorted portion one element at a time, like sorting playing cards in your hand. Take the next element as the `key`, compare it with the sorted portion from right to left, and shift every value larger than the `key` one position to the right to make space. Then insert the `key` into its correct position. The key is placed according to its value, not necessarily before the smallest value.

For example, inserting `3` into the sorted portion `[2, 5, 7]` shifts `7` and `5` to the right, then places `3` after `2`:

```text
[2, 5, 7, 3]  ->  [2, 5, 7, 7]  ->  [2, 5, 5, 7]  ->  [2, 3, 5, 7]
```

| Case | Time |
|---|---|
| Best (already sorted) | O(n) |
| Average | O(n²) |
| Worst (reverse sorted) | O(n²) |

**Space:** O(1) — in-place
**Stable:** Yes

**Pros:**
- Fast on nearly-sorted or small data sets (used internally by hybrid sorts like Timsort/Introsort below a threshold, typically ~16-32 elements)
- Stable, in-place, adaptive (best case O(n))
- Online — can sort a stream of incoming data as it arrives

**Cons:**
- O(n²) on large/random data
- Shifting elements is costly for arrays (O(n) per insertion)

```csharp
void InsertionSort(int[] arr)
{
    for (int i = 1; i < arr.Length; i++)
    {
        int key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key)
        {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}
```

---

## 4. Merge Sort

**How it works:** Divide-and-conquer — recursively split the array in half, sort each half, then merge the two sorted halves.

| Case | Time |
|---|---|
| Best | O(n log n) |
| Average | O(n log n) |
| Worst | O(n log n) |

**Space:** O(n) — auxiliary array for merging
**Stable:** Yes

**Pros:**
- Guaranteed O(n log n) — no bad worst case, unlike quicksort
- Stable — important when sorting objects by one key but needing to preserve relative order of another
- Well-suited for linked lists (O(1) extra space in that case) and external sorting (sorting data too large for memory, e.g. on disk)
- Easily parallelizable

**Cons:**
- O(n) extra space for arrays — not in-place
- Slower than quicksort in practice for arrays due to the overhead of copying/merging, despite same asymptotic average

During the merge step, `i` and `j` start at `0` because they point into the temporary `left` and `right` arrays. The write index `k` starts at `start`, not `0`, because the merged values must be written back into the correct portion of the original array. Starting `k` at `0` would overwrite elements outside the current subarray during recursive merges.

```csharp
void MergeSort(int[] arr, int left, int right)
{
    if (left >= right) return;
    int mid = left + (right - left) / 2;
    MergeSort(arr, left, mid);
    MergeSort(arr, mid + 1, right);
    Merge(arr, left, mid, right);
}

void Merge(int[] arr, int left, int mid, int right)
{
    int[] leftArr = arr[left..(mid + 1)];
    int[] rightArr = arr[(mid + 1)..(right + 1)];
    int i = 0, j = 0, k = left;

    while (i < leftArr.Length && j < rightArr.Length)
        arr[k++] = leftArr[i] <= rightArr[j] ? leftArr[i++] : rightArr[j++];

    while (i < leftArr.Length) arr[k++] = leftArr[i++];
    while (j < rightArr.Length) arr[k++] = rightArr[j++];
}
```

> Note: `arr[left..(mid + 1)]` and `arr[(mid + 1)..(right + 1)]` use C# range syntax (`..`), which creates new array slices. So `leftArr` contains elements from `left` through `mid`, and `rightArr` contains elements from `mid + 1` through `right`. This syntax is available in modern C# versions (C# 8+). If you're using an older C# version, you must copy these ranges manually using loops or `Array.Copy`.

The range operator (..) in C# provides a concise syntax to extract a sub-range of elements from an array or other countable sequences.  Introduced in C# 8, it creates a slice where the start index is inclusive and the end index is exclusive. 

Syntax and Behavior :

**array[start..end]**: Extracts elements from index start up to, but not including, index end.
**array[..end]**: Equivalent to array[0..end], extracting elements from the beginning.

---

## 5. Quick Sort

**How it works:** Divide-and-conquer — pick a pivot, partition the array so smaller elements go left and larger go right, then recursively sort each partition.

| Case | Time |
|---|---|
| Best | O(n log n) |
| Average | O(n log n) |
| Worst (bad pivot, e.g. already sorted with naive pivot choice) | O(n²) |

**Space:** O(log n) average (recursion stack) — in-place partitioning
**Stable:** No (standard implementation)

**Pros:**
- Fastest in practice for arrays among comparison sorts — excellent cache locality, small constant factor
- In-place (only needs stack space for recursion)
- `Array.Sort()` in .NET actually uses an Introsort — quicksort that falls back to heapsort when recursion gets too deep, plus insertion sort for small partitions

**Cons:**
- Worst case O(n²) — mitigated with randomized pivot or median-of-three pivot selection
- Not stable
- Performance is pivot-choice-dependent; adversarial/sorted input can degrade a naive implementation

```csharp
void QuickSort(int[] arr, int low, int high)
{
    if (low < high)
    {
        int pivotIndex = Partition(arr, low, high);
        QuickSort(arr, low, pivotIndex - 1); // don't need to consider current pivot as it is on sorted position after first iteration
        QuickSort(arr, pivotIndex + 1, high);
    }
}

int Partition(int[] arr, int low, int high)
{
    int pivot = arr[high]; // last element as pivot
    int i = low - 1;
    for (int j = low; j < high; j++)
    {
        if (arr[j] <= pivot)
        {
            i++;
            (arr[i], arr[j]) = (arr[j], arr[i]);
        }
    }
    (arr[i + 1], arr[high]) = (arr[high], arr[i + 1]); // placing pivot on right sorted position
    return i + 1;
}
```

# Why quicksort is O(n²) on a sorted array

Quicksort's worst case happens when every partition splits as unevenly as possible — one side gets nearly all the elements, the other gets none (or almost none). A sorted array triggers exactly this **if the pivot is chosen naively** (always the first or last element).

## The mechanism

If the array is already sorted and you always pick the **last element as pivot**, that pivot is the largest value in the current subarray. Partitioning around it puts every other element on the "smaller" side and nothing on the "larger" side. So instead of splitting into two roughly equal halves, you get one subarray of size `n-1` and one of size `0`.

```
[1,2,3,4,5,6,7]        pivot = 7 (last, largest)   -> n-1 comparisons, right side empty
  -> [1,2,3,4,5,6]     pivot = 6                    -> n-2 comparisons
    -> [1,2,3,4,5]     pivot = 5                    -> n-3 comparisons
      -> [1,2,3,4]     pivot = 4                    -> n-4 comparisons
        -> ...
          -> [1]       base case
```

## Why this makes it O(n²)

A balanced split (like merge sort always gets) produces a recursion tree of height `log n`. A degenerate split like the one above produces a tree of height `n` — one level per element, because each partition step only peels off a single element (the pivot) instead of dividing the array in half.

At each of those `n` levels, the partition step still has to scan and compare every remaining element against the pivot:

```
(n-1) + (n-2) + ... + 1 = n(n-1)/2
```

which is `O(n²)`.

## Notes

- This isn't unique to sorted arrays — a **reverse-sorted** array triggers the same worst case with a first-element pivot, for the mirror-image reason.
- It's specifically a problem with **deterministic** pivot selection (always first or always last).
- Picking the pivot **randomly**, or using **median-of-three** (median of first/middle/last elements), makes the odds of hitting this pathological pattern on sorted input vanishingly small. This is why real-world quicksort implementations almost never just take the last element as the pivot.
- With a good pivot strategy, the average case returns to `O(n log n)` — the same as merge sort. The difference is that merge sort *guarantees* `O(n log n)` regardless of input, while quicksort's guarantee depends on avoiding worst-case pivot selection.

---

## 6. Heap Sort

**How it works:** Build a max-heap from the array, then repeatedly swap the root (max) with the last element and shrink the heap, re-heapifying each time.

**Watch this:** https://www.youtube.com/shorts/i7xGwTRarl0?feature=share

![Heap sort: build a max-heap, move the root to the end, and heapify again](https://imgs.search.brave.com/R_IdGArhcrqREasvlsBTZOyb1Wwr3BMyTPAK_ZG0_ug/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4uYnVpbHRpbi5jb20vY2RuLWNnaS9pbWFnZS9mPWF1dG8vc2l0ZXMvd3d3LmJ1aWx0aW4uY29tL2ZpbGVzL3N0eWxlcy9ja2VkaXRvcl9vcHRpbWl6ZS9wdWJsaWMvaW5saW5lLWltYWdlcy83JTIwaGVhcGlmeSUyMGhlYXAlMjB0cmVlJTIwbGFzdCUyMG5vYiUyMGxlYXklMjBuY29kZS5wbmc)

| Case | Time |
|---|---|
| Best | O(n log n) |
| Average | O(n log n) |
| Worst | O(n log n) |

**Space:** O(1) — in-place (the recursive `Heapify` below also uses O(log n) call-stack space; an iterative heapify keeps it at O(1))
**Stable:** No

**Pros:**
- Guaranteed O(n log n) with O(1) extra space — best worst-case-space combination among comparison sorts
- No worst-case degradation like quicksort
- Good when memory is tight and you still need guaranteed performance

**Cons:**
- Poor cache locality (jumps around the array via heap indices) — slower in practice than quicksort despite same complexity
- Not stable
- More complex to implement correctly than merge/quick sort

```csharp
void HeapSort(int[] arr)
{
    int n = arr.Length;

    // Build a max-heap from the array.
    // We start from the last non-leaf node (index n/2 - 1) and go upward.
    // This works because nodes after n/2 - 1 are leaves, and leaves already satisfy heap property.
    // Going backward ensures child heaps are fixed before their parents are processed.
    for (int i = n / 2 - 1; i >= 0; i--)
        Heapify(arr, n, i);

    // Repeatedly move the current maximum (root) to the end
    // and rebuild the heap on the remaining unsorted portion.
    for (int i = n - 1; i > 0; i--)
    {
        // Swap root (largest element) with the last element
        (arr[0], arr[i]) = (arr[i], arr[0]);

        // Heapify the reduced heap (size i)
        Heapify(arr, i, 0);
    }
}

void Heapify(int[] arr, int n, int i)
{
    int largest = i;         // Assume current node is the largest
    int left = 2 * i + 1;     // Left child index
    int right = 2 * i + 2;    // Right child index

    // If left child exists and is larger than current node,
    // update the largest index.
    if (left < n && arr[left] > arr[largest]) largest = left;

    // If right child exists and is larger than the current largest,
    // update the largest index.
    if (right < n && arr[right] > arr[largest]) largest = right;

    // If a child is larger than the parent, swap them
    // and continue heapifying the affected subtree.
    if (largest != i)
    {
        (arr[i], arr[largest]) = (arr[largest], arr[i]);
        Heapify(arr, n, largest);
    }
}
```

---

## 7. Counting Sort

**How it works:** Count occurrences of each distinct value, then use those counts to place elements directly into output positions. Non-comparison-based.

| Case | Time |
|---|---|
| All cases | O(n + k), where k = range of input values |

**Space:** O(n + k)
**Stable:** Yes (when implemented with the standard cumulative-count technique)

**Pros:**
- Faster than O(n log n) comparison sorts when k = O(n) (small value range)
- Stable
- Great for problems with bounded integer ranges (e.g. sorting ages 0-120, exam scores 0-100)

**Cons:**
- Only works on integers (or discretizable keys), not arbitrary comparables
- Impractical/wasteful when k is very large relative to n (e.g. sorting 10 numbers where values range up to 10⁹)
- O(k) space overhead

### Counting Sort: Stable vs Unstable (Int-Only) Approach

Counting sort has two common implementations. Both sort integers correctly and both run in `O(n + range)` time — but they differ in *how* they place elements, and that difference matters the moment you're sorting more than plain numbers.

#### The two approaches

##### 1. Stable version (cumulative count)

```csharp
void CountingSort(int[] arr)
{
    if (arr.Length == 0) return;

    int max = arr.Max(), min = arr.Min();
    int range = max - min + 1;
    int[] count = new int[range];

    // Step 1: count occurrences of each value
    foreach (int num in arr) count[num - min]++;

    // Step 2: cumulative counts -> last valid output slot per value
    for (int i = 1; i < range; i++) count[i] += count[i - 1];

    // Step 3: place elements right to left (preserves original order for ties)
    int[] output = new int[arr.Length];
    for (int i = arr.Length - 1; i >= 0; i--)
    {
        output[count[arr[i] - min] - 1] = arr[i];
        count[arr[i] - min]--;
    }

    // Step 4: copy back
    Array.Copy(output, arr, arr.Length);
}
```

##### 2. Simple/unstable version

```csharp
void CountingSortSimple(int[] arr)
{
    if (arr.Length == 0) return;

    int min = arr.Min();
    int max = arr.Max();
    int[] count = new int[max - min + 1];

    // Count occurrences
    foreach (int num in arr)
        count[num - min]++;

    // Rewrite the array: for each bucket, in order, write the value
    // down as many times as it occurred
    int index = 0;
    for (int i = 0; i < count.Length; i++)
    {
        while (count[i] > 0)
        {
            arr[index] = i + min;
            index++;
            count[i]--;
        }
    }
}
```

#### Comparison

| | **Stable (cumulative count)** | **Simple (unstable)** |
|---|---|---|
| **Core idea** | Convert counts into *positions*, place each element into its exact final slot | Convert counts into *repetitions*, rewrite the array bucket by bucket |
| **Stability** | ✅ Preserves original relative order of equal elements | ❌ No memory of which original element was which — ties can end up reordered |
| **Extra array** | Needs an `output` array, then copies it back | Writes directly into `arr` — no second array |
| **Placement logic** | `output[count[value] - 1] = value; count[value]--;` — one write per element into a specific slot | `while (count[i] > 0) { arr[index++] = i + min; count[i]--; }` — dump the value however many times it appeared |
| **Sorts objects by key?** | Yes — it moves the *original element*, so it can sort structs/objects by one field and keep ties in original order | No — it only reconstructs a sequence of *values*, not original elements |
| **Readability** | Slightly more abstract — the cumulative-count trick takes a moment to click | More intuitive — "count it, then write it back that many times" |
| **Time complexity** | O(n + range) | O(n + range) |

#### Why it matters (or doesn't) for plain integers

If you're only sorting an `int[]`, the two produce **identical output**. Stability is invisible here — a `3` is indistinguishable from any other `3`, so it doesn't matter whether ties get "reordered" or not. In this case the simple version is objectively easier to write and reason about.

#### Why it matters for objects

The distinction becomes real the moment you sort **objects** by a key instead of raw numbers — e.g. sorting `Employee[]` by `Age`, where employees with the same age should keep their original relative order (say, alphabetical, or insertion order).

- The **stable** version can do this, because it moves the actual object into `output[...]`, not just a number.
- The **simple** version cannot — it only knows how to rebuild a list of values (ages), with no way to carry the rest of the object (name, ID, etc.) along with it.

#### Worked example: sorting objects by a key

```csharp
class Employee
{
    public string Name;
    public int Age;

    public Employee(string name, int age)
    {
        Name = name;
        Age = age;
    }

    public override string ToString() => $"{Name} ({Age})";
}

void CountingSortByAge(Employee[] employees)
{
    if (employees.Length == 0) return;

    int min = employees.Min(e => e.Age);
    int max = employees.Max(e => e.Age);
    int range = max - min + 1;
    int[] count = new int[range];

    // Step 1: count how many employees have each age
    foreach (var e in employees)
        count[e.Age - min]++;

    // Step 2: cumulative counts -> last valid output slot for each age
    for (int i = 1; i < range; i++)
        count[i] += count[i - 1];

    // Step 3: place employees right to left to preserve original order among ties
    Employee[] output = new Employee[employees.Length];
    for (int i = employees.Length - 1; i >= 0; i--)
    {
        var e = employees[i];
        output[count[e.Age - min] - 1] = e;
        count[e.Age - min]--;
    }

    Array.Copy(output, employees, employees.Length);
}
```

Input:
```csharp
var staff = new Employee[]
{
    new Employee("Aman", 30),
    new Employee("Riya", 25),
    new Employee("Karan", 30),
    new Employee("Sana", 25),
    new Employee("Vikram", 28)
};

CountingSortByAge(staff);
```

Output:
```
Riya (25)
Sana (25)
Vikram (28)
Aman (30)
Karan (30)
```

Riya comes before Sana, and Aman comes before Karan — same as their order in the input — because they tie on age. That's stability: the array is sorted by `Age` alone, but employees who share an age keep their original relative order.

The simple/unstable version can't do this at all — it only knows how to rebuild a sequence of `int` values, with no way to carry the rest of the object (`Name`, etc.) along with each age.

#### Rule of thumb

- Sorting **plain integers**, don't care about ties (they're indistinguishable anyway) → simple version is fine and easier to read.
- Sorting **objects/records by a key**, and ties should keep their original order → use the stable (cumulative-count) version.

---

## 8. Radix Sort

**How it works:** Sort integers digit by digit (least significant to most significant), using a stable sort (typically counting sort) as a subroutine for each digit.

| Case | Time |
|---|---|
| All cases | O(d × (n + b)), d = number of digits, b = base (usually 10) |

**Space:** O(n + b)
**Stable:** Yes

**Pros:**
- Can beat O(n log n) comparison sorts for large sets of fixed-width integers/strings
- Stable
- No comparisons needed at all

**Cons:**
- Limited to integers or fixed-format strings
- d can be large for very large numbers, reducing the benefit
- More complex to implement; rarely needed for typical LeetCode constraints
- The implementation below assumes a non-empty array of non-negative integers: `arr.Max()` throws on an empty array, and a negative number gives a negative digit index

```csharp
void RadixSort(int[] arr)
{
    int max = arr.Max();
    for (int exp = 1; max / exp > 0; exp *= 10)
        CountingSortByDigit(arr, exp);
}

void CountingSortByDigit(int[] arr, int exp)
{
    int n = arr.Length;
    int[] output = new int[n];
    int[] count = new int[10];

    foreach (int num in arr) count[(num / exp) % 10]++;
    for (int i = 1; i < 10; i++) count[i] += count[i - 1];

    for (int i = n - 1; i >= 0; i--)
    {
        int digit = (arr[i] / exp) % 10;
        output[count[digit] - 1] = arr[i];
        count[digit]--;
    }
    Array.Copy(output, arr, n);
}
```

---

## 9. Bucket Sort

**How it works:** Distribute elements into a number of "buckets" based on value ranges, sort each bucket individually (often with insertion sort), then concatenate.

| Case | Time |
|---|---|
| Best/Average (uniformly distributed input) | O(n + k) |
| Worst (all elements in one bucket) | O(n²) |

**Space:** O(n + k)
**Stable:** Depends on the sort used within buckets (stable if that sort is stable)

**Pros:**
- Near-linear time when input is uniformly distributed over a known range
- Parallelizable — buckets can be sorted independently

**Cons:**
- Degrades to O(n²) with skewed/clustered data or poor bucket sizing
- Needs prior knowledge of the data distribution/range to be effective
- Extra space for buckets

```csharp
void BucketSort(float[] arr)
{
    int n = arr.Length;
    var buckets = new List<float>[n];
    for (int i = 0; i < n; i++) buckets[i] = new List<float>();

    foreach (float num in arr)
    {
        int idx = (int)(num * n); // assumes input in [0, 1)
        buckets[idx].Add(num);
    }

    for (int i = 0; i < n; i++) buckets[i].Sort();

    int pos = 0;
    for (int i = 0; i < n; i++)
        foreach (float num in buckets[i])
            arr[pos++] = num;
}
```

---

## Summary Table

| Algorithm | Best | Average | Worst | Space | Stable | In-Place |
|---|---|---|---|---|---|---|
| Bubble Sort | O(n) | O(n²) | O(n²) | O(1) | Yes | Yes |
| Selection Sort | O(n²) | O(n²) | O(n²) | O(1) | No | Yes |
| Insertion Sort | O(n) | O(n²) | O(n²) | O(1) | Yes | Yes |
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes | No |
| Quick Sort | O(n log n) | O(n log n) | O(n²) | O(log n) | No | Yes |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No | Yes |
| Counting Sort | O(n+k) | O(n+k) | O(n+k) | O(n+k) | Yes | No |
| Radix Sort | O(d(n+b)) | O(d(n+b)) | O(d(n+b)) | O(n+b) | Yes | No |
| Bucket Sort | O(n+k) | O(n+k) | O(n²) | O(n+k) | Depends | No |

---

## When to Use What (LeetCode Context)

- **Default choice / "just sort it":** `Array.Sort()` or `list.Sort()` — .NET's built-in Introsort gives O(n log n) worst case with in-place performance
- **Need stability (preserve original order of equal elements):** Merge Sort, or `OrderBy()` (LINQ, stable) instead of `Array.Sort()` (not guaranteed stable)
- **Known small integer range (e.g. counting frequencies 0-100):** Counting Sort
- **Nearly-sorted data or very small n (<20):** Insertion Sort
- **Guaranteed worst-case time with O(1) space constraint:** Heap Sort
- **Fixed-width large integers, huge n:** Radix Sort
- **Interview/whiteboard explaining a custom sort:** Quick Sort or Merge Sort are the two expected to be reproducible from memory
