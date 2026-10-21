/**
 * The C# implementations from `Competitive Programming/sorting-algorithms-notes.md`, verbatim.
 *
 * The code panel shows these strings, and the trace generators resolve their highlighted lines from
 * them. `scripts/build-content.ts` checks that every string below still appears as a fenced block in the
 * note, so if the note's code changes the build fails instead of showing stale code.
 */
export const SORT_CODE = {
  bubble: `void BubbleSort(int[] arr)
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
}`,

  selection: `void SelectionSort(int[] arr)
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
}`,

  insertion: `void InsertionSort(int[] arr)
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
}`,

  merge: `void MergeSort(int[] arr, int left, int right)
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
}`,

  quick: `void QuickSort(int[] arr, int low, int high)
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
}`,

  heap: `void HeapSort(int[] arr)
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
}`,

  countingStable: `void CountingSort(int[] arr)
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
}`,

  countingSimple: `void CountingSortSimple(int[] arr)
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
}`,

  countingByAge: `void CountingSortByAge(Employee[] employees)
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
}`,

  radix: `void RadixSort(int[] arr)
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
}`,

  bucket: `void BucketSort(float[] arr)
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
}`,
} as const;

export type SortAlgorithm = keyof typeof SORT_CODE;

/** Which note section each implementation comes from (used by the build's verbatim check and the UI). */
export const SORT_SOURCE_HEADING: Record<SortAlgorithm, string> = {
  bubble: '## 1. Bubble Sort',
  selection: '## 2. Selection Sort',
  insertion: '## 3. Insertion Sort',
  merge: '## 4. Merge Sort',
  quick: '## 5. Quick Sort',
  heap: '## 6. Heap Sort',
  countingStable: '##### 1. Stable version (cumulative count)',
  countingSimple: '##### 2. Simple/unstable version',
  countingByAge: '#### Worked example: sorting objects by a key',
  radix: '## 8. Radix Sort',
  bucket: '## 9. Bucket Sort',
};

export const SORT_LABEL: Record<SortAlgorithm, string> = {
  bubble: 'Bubble sort',
  selection: 'Selection sort',
  insertion: 'Insertion sort',
  merge: 'Merge sort',
  quick: 'Quick sort',
  heap: 'Heap sort',
  countingStable: 'Counting sort (stable)',
  countingSimple: 'Counting sort (simple)',
  countingByAge: 'Counting sort by age (objects)',
  radix: 'Radix sort',
  bucket: 'Bucket sort',
};
