/**
 * The C# from `Competitive Programming/searching-algorithms-notes.md`, verbatim.
 *
 * The code panels show these strings and the trace generators resolve their highlighted lines from them
 * (see `lines()` in src/viz/engine/code.ts). src/viz/searching/verbatim.ts makes the build fail if a string
 * stops appearing in the note, so a panel can never show stale code.
 */
export const SEARCH_CODE = {
  linear: `int LinearSearch(int[] arr, int target)
{
    for (int i = 0; i < arr.Length; i++)
        if (arr[i] == target) return i;
    return -1;
}`,

  binary: `int BinarySearch(int[] arr, int target)
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
}`,

  binaryRec: `int BinarySearchRec(int[] arr, int target, int left, int right)
{
    if (left > right) return -1;
    int mid = left + (right - left) / 2;
    if (arr[mid] == target) return mid;
    return arr[mid] < target
        ? BinarySearchRec(arr, target, mid + 1, right)
        : BinarySearchRec(arr, target, left, mid - 1);
}`,

  bounds: `int LowerBound(int[] arr, int target)
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
}`,

  sqrt: `int MySqrt(int x)
{
    int lo = 0, hi = x, ans = 0;
    while (lo <= hi)
    {
        int mid = lo + (hi - lo) / 2;
        if ((long)mid * mid <= x) { ans = mid; lo = mid + 1; }
        else hi = mid - 1;
    }
    return ans;
}`,

  jump: `int JumpSearch(int[] arr, int target)
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
}`,

  interpolation: `int InterpolationSearch(int[] arr, int target)
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
}`,

  exponential: `int ExponentialSearch(int[] arr, int target)
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
}`,

  ternary: `int TernaryMaxIndex(int[] arr)   // arr strictly increases then strictly decreases
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
}`,

  hash: `var seen = new HashSet<int>(arr);
bool exists = seen.Contains(target);          // O(1) average

var index = new Dictionary<int, int>();       // value -> index
for (int i = 0; i < arr.Length; i++) index[arr[i]] = i;`,

  bfs: `int BFS(Dictionary<int, List<int>> graph, int start, int target)
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
}`,

  dfs: `bool DFS(Dictionary<int, List<int>> graph, int node, int target, HashSet<int> visited)
{
    if (node == target) return true;
    visited.Add(node);

    foreach (int next in graph.GetValueOrDefault(node, new List<int>()))
        if (!visited.Contains(next) && DFS(graph, next, target, visited))
            return true;
    return false;
}`,
} as const;

export type SearchCodeId = keyof typeof SEARCH_CODE;

/** The note heading each block sits under (for build errors and tests). */
export const SEARCH_SOURCE_HEADING: Record<SearchCodeId, string> = {
  linear: '## 1. Linear Search',
  binary: '## 2. Binary Search',
  binaryRec: '## 2. Binary Search',
  bounds: '## 3. Lower Bound / Upper Bound (Binary Search Variants)',
  sqrt: '## 4. Binary Search on Answer (Very Common in LeetCode)',
  jump: '## 5. Jump Search',
  interpolation: '## 6. Interpolation Search',
  exponential: '## 7. Exponential Search',
  ternary: '## 8. Ternary Search',
  hash: '## 9. Hash-Based Search',
  bfs: '### Breadth-First Search (BFS)',
  dfs: '### Depth-First Search (DFS)',
};

export const SEARCH_NOTE = 'Competitive Programming/searching-algorithms-notes.md';
