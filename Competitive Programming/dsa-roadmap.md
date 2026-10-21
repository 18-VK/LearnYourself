# DSA Roadmap (C# / LeetCode Focused)

A level-wise path from basics to advanced. Every topic is tagged:

- 🟢 **MUST** — core; appears constantly in interviews and LeetCode
- 🟡 **GOOD TO HAVE** — shows up regularly, learn after the musts
- ⚪ **OPTIONAL** — rare, niche, or competitive-programming-only; skip until you're comfortable

> **Rule of thumb:** Finish all 🟢 items in a level before moving to the next. Don't touch ⚪ items until Level 4.

---

## Level 0 — Foundations (1–2 weeks)

**Goal:** Be fluent with C# syntax, complexity analysis, and basic problem-solving habits.

| Topic | Tag | What to learn |
|---|---|---|
| Time & Space Complexity (Big-O) | 🟢 | O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ); how to analyze loops and recursion |
| C# basics for DSA | 🟢 | Arrays, `List<T>`, `string`, `StringBuilder`, tuples, `long` vs `int` overflow |
| Recursion basics | 🟢 | Base case, recursive case, call stack, factorial / fibonacci / power |
| Math basics | 🟢 | Modulo, GCD/LCM, prime check, digit manipulation, even/odd |
| Bit manipulation basics | 🟡 | `&`, `\|`, `^`, `<<`, `>>`, check/set/clear a bit, count set bits |
| Reading constraints | 🟢 | Learn to pick an approach from limits (n ≤ 10⁵ → need O(n log n) or better) |

**Practice:** 15–20 easy problems (sum of digits, reverse number, palindrome number, fizzbuzz, power of two).

---

## Level 1 — Core Data Structures & Basic Patterns (3–4 weeks)

**Goal:** Know every common collection and solve easy problems with the right one.

### Data structures
| Topic | Tag | Notes |
|---|---|---|
| Arrays | 🟢 | Traversal, prefix sums, in-place modification, 2D arrays/matrix |
| Strings | 🟢 | Reverse, palindrome, anagram, substring, `StringBuilder` usage |
| `List<T>` / dynamic arrays | 🟢 | Add/Remove costs, sorting, slicing |
| `HashSet<T>` / `Dictionary<K,V>` | 🟢 | Frequency map, seen-set, two-sum pattern; understand `Equals`/`GetHashCode` |
| Stack | 🟢 | Balanced parentheses, next greater element, undo-style problems |
| Queue | 🟢 | FIFO simulation, basic BFS prerequisite |
| Linked List (singly) | 🟢 | Reverse, find middle, detect cycle, merge two sorted lists |
| Linked List (doubly / circular) | ⚪ | Mostly for LRU cache design |
| `LinkedList<T>`, `SortedSet<T>`, `SortedDictionary` | 🟡 | Know they exist and their complexities |

### Patterns
| Pattern | Tag | Typical problems |
|---|---|---|
| Frequency counting | 🟢 | Valid anagram, first unique character |
| Two pointers | 🟢 | Reverse array, two-sum on sorted array, remove duplicates |
| Prefix sum | 🟢 | Range sum query, subarray sum equals K (with hashmap) |
| Fast & slow pointers | 🟢 | Linked list cycle, middle of list |
| Simple sliding window (fixed size) | 🟢 | Max sum of subarray of size K |

### Sorting & searching
| Topic | Tag |
|---|---|
| Built-in `Array.Sort` / `List.Sort` / `OrderBy` and custom comparers | 🟢 |
| Linear search | 🟢 |
| Binary search (classic) | 🟢 |
| Bubble / Selection / Insertion sort (understand, don't memorize) | 🟡 |
| Merge sort & Quick sort (be able to write from memory) | 🟢 |
| Heap sort, Counting sort | 🟡 |
| Radix, Bucket sort | ⚪ |

**Practice:** 50–60 problems, mostly Easy, some Medium.

---

## Level 2 — Intermediate: Recursion, Trees, Heaps, Graph Basics (4–6 weeks)

**Goal:** Handle the bulk of Medium-level interview questions.

### Recursion & Backtracking
| Topic | Tag | Typical problems |
|---|---|---|
| Recursion on arrays/strings | 🟢 | Subsets, permutations |
| Backtracking template | 🟢 | Subsets, Permutations, Combination Sum, N-Queens (basic), Word Search |
| Pruning / handling duplicates | 🟡 | Subsets II, Combination Sum II |

### Binary Search (advanced)
| Topic | Tag | Typical problems |
|---|---|---|
| Lower bound / upper bound | 🟢 | First/last position, search insert position |
| Rotated sorted array | 🟢 | Search in rotated array, find minimum |
| Binary search on answer | 🟢 | Koko eating bananas, ship packages, sqrt(x) |
| Peak element / mountain array | 🟡 | LC 162, 852 |

### Sliding window & two pointers (advanced)
| Topic | Tag | Typical problems |
|---|---|---|
| Variable-size sliding window | 🟢 | Longest substring without repeating chars, min window substring |
| Sliding window + hashmap | 🟢 | Longest substring with K distinct |
| Monotonic stack | 🟢 | Next greater element, daily temperatures, largest rectangle in histogram |
| Monotonic deque | 🟡 | Sliding window maximum |
| 3Sum / 4Sum style | 🟢 | Sort + two pointers |

### Trees
| Topic | Tag | Typical problems |
|---|---|---|
| Binary tree traversals (pre/in/post/level order) | 🟢 | Recursive and iterative versions |
| Tree DFS patterns | 🟢 | Max depth, diameter, path sum, same tree, invert tree |
| Binary Search Tree (BST) | 🟢 | Validate BST, kth smallest, LCA in BST, insert/delete |
| Lowest Common Ancestor (binary tree) | 🟢 | LC 236 |
| Tree construction from traversals | 🟡 | Build tree from preorder + inorder |
| Serialize / deserialize | 🟡 | LC 297 |
| Balanced trees (AVL, Red-Black) | ⚪ | Understand concept only; C# gives you `SortedSet` |

### Heaps / Priority Queue
| Topic | Tag | Typical problems |
|---|---|---|
| `PriorityQueue<TElement, TPriority>` usage | 🟢 | Kth largest, top K frequent |
| Merge K sorted lists | 🟢 | LC 23 |
| Two-heap pattern (median) | 🟡 | Find median from data stream |
| Implementing a heap from scratch | 🟡 | Understand heapify, sift up/down |

### Graph basics
| Topic | Tag | Typical problems |
|---|---|---|
| Graph representation (adjacency list/matrix) | 🟢 | `Dictionary<int, List<int>>`, `List<int>[]` |
| BFS | 🟢 | Shortest path unweighted, level order, rotting oranges |
| DFS | 🟢 | Number of islands, connected components, flood fill |
| Grid problems (BFS/DFS on matrix) | 🟢 | Islands, word search, surrounded regions |
| Cycle detection (undirected & directed) | 🟢 | Course schedule |
| Topological sort | 🟢 | Course schedule II, alien dictionary |

**Practice:** 100–120 problems, Easy → Medium mix.

---

## Level 3 — Advanced Interview Level (6–8 weeks)

**Goal:** Solve Medium comfortably, and attempt Hard problems at top-tier companies.

### Dynamic Programming (most important topic here)
| Topic | Tag | Typical problems |
|---|---|---|
| Memoization (top-down) with `Dictionary` / array | 🟢 | Fibonacci, climbing stairs |
| 1D DP | 🟢 | House robber, coin change, longest increasing subsequence |
| 2D DP / grid DP | 🟢 | Unique paths, min path sum, edit distance |
| 0/1 Knapsack pattern | 🟢 | Subset sum, partition equal subset, target sum |
| Unbounded knapsack | 🟢 | Coin change, coin change II |
| Longest Common Subsequence / Substring | 🟢 | LCS, longest palindromic substring |
| DP on strings | 🟢 | Palindrome partitioning, word break, decode ways |
| DP on stocks | 🟡 | Best time to buy and sell stock I–IV |
| Interval DP | ⚪ | Burst balloons, matrix chain multiplication |
| Bitmask DP | ⚪ | TSP-style problems |
| Digit DP | ⚪ | Competitive programming only |
| DP on trees | 🟡 | House robber III |
| Space optimization (rolling array) | 🟡 | Reduce O(n·m) to O(m) |

### Greedy
| Topic | Tag | Typical problems |
|---|---|---|
| Interval scheduling / merging | 🟢 | Merge intervals, meeting rooms, non-overlapping intervals |
| Greedy with sorting | 🟢 | Assign cookies, jump game, gas station |
| Greedy with heap | 🟡 | Task scheduler, reorganize string |
| Proving greedy correctness | 🟡 | Exchange argument (conceptual) |

### Advanced Graphs
| Topic | Tag | Typical problems |
|---|---|---|
| Dijkstra (with `PriorityQueue`) | 🟢 | Network delay time, cheapest flights |
| Union-Find / Disjoint Set (path compression + rank) | 🟢 | Number of provinces, redundant connection, accounts merge |
| Minimum Spanning Tree (Kruskal / Prim) | 🟡 | Min cost to connect all points |
| Bellman-Ford | 🟡 | Cheapest flights within K stops |
| Floyd-Warshall | ⚪ | All-pairs shortest path, small n |
| 0-1 BFS, multi-source BFS | 🟡 | Walls and gates, 01 matrix |
| Bipartite check | 🟡 | Is graph bipartite |
| Strongly connected components (Tarjan/Kosaraju) | ⚪ | Rare |
| Bridges / articulation points | ⚪ | Rare |

### Advanced Data Structures
| Topic | Tag | Typical problems |
|---|---|---|
| Trie (prefix tree) | 🟢 | Implement trie, word search II, autocomplete |
| LRU / LFU cache design | 🟢 | `Dictionary` + doubly linked list |
| Segment Tree | ⚪ | Range sum/min with updates |
| Fenwick Tree (BIT) | ⚪ | Range sum with updates |
| Sparse Table | ⚪ | Static range min queries |
| Sorted structures (`SortedSet` as multiset-like) | 🟡 | Sliding window median, calendar problems |

### Advanced patterns
| Topic | Tag |
|---|---|
| Prefix sum + hashmap (subarray sum = K) | 🟢 |
| Difference array | 🟡 |
| Kadane's algorithm | 🟢 |
| Boyer-Moore voting | 🟡 |
| Sweep line | 🟡 |
| Bit manipulation tricks (XOR single number, power of two, subsets via mask) | 🟡 |
| Reservoir sampling / randomization | ⚪ |

**Practice:** 150+ Medium problems, 20–30 Hard.

---

## Level 4 — Expert / Competitive Programming (optional, ongoing)

Only pursue this if you target competitive programming, quant roles, or want maximum depth. **Almost all of it is ⚪ for standard interviews.**

| Topic | Tag |
|---|---|
| String algorithms: KMP, Z-algorithm, Rabin-Karp, rolling hash | ⚪ (KMP is 🟡 if time permits) |
| Manacher's algorithm | ⚪ |
| Suffix array / suffix automaton | ⚪ |
| Number theory: sieve, modular inverse, fast exponentiation, combinatorics (nCr mod p) | 🟡 / ⚪ |
| Lowest Common Ancestor via binary lifting | ⚪ |
| Heavy-light decomposition, centroid decomposition | ⚪ |
| Mo's algorithm | ⚪ |
| Meet in the middle | ⚪ |
| Game theory (Nim, Sprague-Grundy) | ⚪ |
| Network flow (Ford-Fulkerson, Dinic) | ⚪ |
| Geometry (convex hull, line sweep) | ⚪ |

---

## Suggested Timeline

| Level | Duration | Problems to solve | Outcome |
|---|---|---|---|
| 0 — Foundations | 1–2 weeks | 15–20 | Comfortable with C# and Big-O |
| 1 — Core | 3–4 weeks | 50–60 | Solve most Easy problems |
| 2 — Intermediate | 4–6 weeks | 100–120 | Solve most Medium problems |
| 3 — Advanced | 6–8 weeks | 150+ | Crack product-company interviews |
| 4 — Expert | Ongoing | As desired | Competitive programming |

**Total for interview-ready:** about 3–4 months of consistent daily practice (1.5–2 hours/day).

---

## Absolute Must-Know Checklist (the "core 20")

If time is short, make sure you can solve problems from **all** of these categories:

1. Arrays + prefix sum
2. Two pointers
3. Sliding window (fixed + variable)
4. HashMap / HashSet patterns
5. Stack + monotonic stack
6. Queue / BFS
7. Linked list (reverse, cycle, merge)
8. Binary search (classic, bounds, on answer, rotated)
9. Sorting + custom comparers
10. Recursion + backtracking
11. Binary tree DFS / BFS
12. BST operations
13. Heap / `PriorityQueue` (top-K, merge K)
14. Graph BFS / DFS (grid + adjacency)
15. Topological sort
16. Union-Find
17. Dijkstra
18. Dynamic programming (1D, 2D, knapsack, LCS)
19. Greedy + intervals
20. Trie

---

## C# Specific Tips

- Use `long` for sums/products when constraints exceed ~2×10⁹
- Prefer `Dictionary.TryGetValue` over `ContainsKey` + indexer (one lookup instead of two)
- Use `StringBuilder` for string building in loops
- `PriorityQueue<T, P>` is a **min-heap**; negate priority for max-heap
- `Array.Sort` is not stable; use `OrderBy` when stability matters
- `SortedSet<T>` has no duplicates; use `SortedDictionary<T,int>` as a multiset
- Pre-size collections (`new List<int>(n)`, `new HashSet<int>(n)`) when n is known
- Avoid deep recursion beyond ~10⁴–10⁵ frames (stack overflow); convert to iterative or use an explicit `Stack<T>`

---

## How to Practice Effectively

1. **Learn pattern, then drill:** read the concept, solve 3–5 problems of that pattern back to back
2. **Time-box:** 20–30 mins to think, then look at hints/solution; never stare for hours
3. **Re-solve after 1 week:** problems you couldn't solve cleanly go in a revision list
4. **Write down the pattern** (not the code) for each solved problem
5. **State complexity out loud** before coding, as you would in an interview
6. **Mix difficulty:** 60% Easy/Medium in your current level, 30% Medium, 10% stretch
7. **Mock interviews** from Level 3 onward: explain your thought process while coding

## Suggested Problem Lists

- **Blind 75** — the minimum curated list (finish this first)
- **NeetCode 150** — Blind 75 plus extras, organized by pattern
- **LeetCode Top Interview 150** — official curated list
- **Striver's SDE Sheet / A2Z** — structured and thorough (examples in C++/Java, but logic is language-agnostic)
