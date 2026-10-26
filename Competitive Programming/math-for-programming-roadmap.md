# Math for Programming: Roadmap by Difficulty

A practical roadmap of the math a programmer should know, ordered from easiest to hardest. Tick the boxes as you go.

**How to use this:**
- Levels 1-2 are useful for almost every developer.
- Levels 3-4 matter for algorithms, interviews, databases, graphics, and system design.
- Levels 5-6 are specialization (AI/ML, cryptography, game engines, research).
- Don't try to finish one level "completely" before moving on. Learn the topic when a project or problem needs it.

---

## Level 1: Foundations (Beginner)

*Needed for everyday coding. Most of this is school-level math.*

### Arithmetic & Number Sense
- [ ] Integer vs. decimal numbers, negative numbers
- [ ] Order of operations (BODMAS/PEMDAS)
- [ ] Modulo (`%`) and integer division, with even/odd checks, wrap-around, and clock math
- [ ] Rounding, floor, ceiling, truncation
- [ ] Percentages, ratios, proportions
- [ ] Powers, roots, exponents
- [ ] Absolute value

### Number Systems
- [ ] Binary (base 2), octal, decimal, hexadecimal
- [ ] Converting between bases
- [ ] Bits, bytes, powers of 2 (1KB = 1024 bytes)
- [ ] Two's complement (how negative numbers are stored)
- [ ] Floating-point basics, and why `0.1 + 0.2 != 0.3`
- [ ] Integer overflow/underflow

### Basic Algebra
- [ ] Variables, expressions, equations
- [ ] Solving linear equations
- [ ] Inequalities
- [ ] Functions as input → output (`f(x)`)
- [ ] Graphing a function on x-y axes

### Basic Logic
- [ ] Boolean values: true/false
- [ ] AND, OR, NOT, XOR
- [ ] Truth tables
- [ ] Comparison operators and short-circuit evaluation

**Where you'll use it:** conditionals, loops, indexing, pagination, formatting, currency and percentage calculations, bit flags.

---

## Level 2: Core Programming Math (Easy to Intermediate)

*The math behind most algorithm and data-structure work.*

### Boolean Algebra & Bitwise Operations
- [ ] De Morgan's laws
- [ ] Simplifying boolean expressions
- [ ] Bitwise AND, OR, XOR, NOT
- [ ] Bit shifts (`<<`, `>>`)
- [ ] Bit masks, and setting/clearing/toggling bits
- [ ] Bit tricks (check power of 2, count set bits)

### Discrete Math: Sets & Logic
- [ ] Sets: union, intersection, difference, subset
- [ ] Venn diagrams
- [ ] Propositional logic: implication, equivalence
- [ ] Predicates and quantifiers (for all, there exists)
- [ ] Proof basics: direct proof, contradiction, counter-example

### Sequences, Series & Summations
- [ ] Arithmetic and geometric sequences
- [ ] Sigma (Σ) notation
- [ ] Sum of first n numbers: n(n+1)/2
- [ ] Geometric series formula
- [ ] Reading loops as summations

### Exponents & Logarithms
- [ ] Log base 2, log base 10, natural log (ln)
- [ ] Log rules: product, quotient, power
- [ ] Why binary search is O(log n)
- [ ] Exponential growth vs. logarithmic growth

### Basic Counting
- [ ] Sum rule and product rule
- [ ] Factorials
- [ ] Permutations (order matters)
- [ ] Combinations, "n choose k" (order doesn't matter)

### Coordinate Geometry
- [ ] 2D coordinates, distance between two points
- [ ] Midpoint, slope, equation of a line
- [ ] Rectangles, circles, area, perimeter
- [ ] Pythagorean theorem

**Where you'll use it:** Big-O analysis, bitmasking, permissions/flags, hash tables, UI layout, collision checks, simple graphics.

---

## Level 3: Intermediate (Algorithms & Real Systems)

*Where math starts shaping how you design solutions.*

### Algorithm Analysis
- [ ] Big-O, Big-Omega, Big-Theta
- [ ] Common complexities: O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ), O(n!)
- [ ] Best, average, and worst case
- [ ] Amortized analysis (e.g., dynamic array resizing)
- [ ] Space complexity

### Recurrences & Induction
- [ ] Mathematical induction
- [ ] Recurrence relations (e.g., T(n) = 2T(n/2) + n)
- [ ] Master theorem
- [ ] Recursion and how it relates to induction
- [ ] Fibonacci and how memoization changes its complexity

### Number Theory (Basics)
- [ ] Divisibility, prime numbers, factorization
- [ ] GCD and LCM, Euclidean algorithm
- [ ] Sieve of Eratosthenes
- [ ] Modular arithmetic: addition, multiplication, exponentiation
- [ ] Modular inverse
- [ ] Hashing and hash-function basics

### Probability (Basics)
- [ ] Sample space, events, probability rules
- [ ] Independent vs. dependent events
- [ ] Conditional probability
- [ ] Bayes' theorem
- [ ] Expected value
- [ ] Random number generation (pseudo-random vs. true random)

### Basic Statistics
- [ ] Mean, median, mode
- [ ] Variance and standard deviation
- [ ] Percentiles (p50, p95, p99 for latency and performance)
- [ ] Normal distribution
- [ ] Correlation vs. causation
- [ ] Outliers

### Graph Theory (Basics)
- [ ] Nodes, edges, directed/undirected, weighted
- [ ] Degree, paths, cycles
- [ ] Trees and DAGs
- [ ] Adjacency list vs. adjacency matrix
- [ ] BFS, DFS
- [ ] Connected components

### Trigonometry
- [ ] Sine, cosine, tangent
- [ ] Unit circle
- [ ] Degrees vs. radians
- [ ] Angles between vectors/points
- [ ] Rotations in 2D

**Where you'll use it:** choosing efficient algorithms, sorting/searching, dynamic programming, caching, load and latency analysis, A/B testing, hashing, pathfinding, animation, game rotation.

---

## Level 4: Upper-Intermediate (Interview & Engineering Depth)

*Common in advanced algorithm work, data engineering, graphics, and backend scale problems.*

### Linear Algebra (Fundamentals)
- [ ] Scalars, vectors, matrices
- [ ] Vector addition, scaling, dot product, cross product
- [ ] Vector length (norm) and normalization
- [ ] Matrix addition, multiplication, transpose
- [ ] Identity matrix and inverse
- [ ] Determinant
- [ ] Systems of linear equations
- [ ] Linear transformations (scale, rotate, translate)

### Advanced Combinatorics
- [ ] Pigeonhole principle
- [ ] Inclusion-exclusion
- [ ] Binomial theorem, Pascal's triangle
- [ ] Catalan numbers
- [ ] Stars and bars
- [ ] Counting with constraints

### Dynamic Programming Math
- [ ] Optimal substructure and overlapping subproblems
- [ ] State definition and transitions
- [ ] Knapsack, LCS, edit distance, coin change patterns

### Advanced Graph Theory
- [ ] Shortest paths: Dijkstra, Bellman-Ford, Floyd-Warshall
- [ ] Minimum spanning trees: Kruskal, Prim
- [ ] Topological sort
- [ ] Bipartite graphs
- [ ] Network flow (max-flow/min-cut)
- [ ] Strongly connected components

### Probability Distributions
- [ ] Uniform, binomial, Poisson, geometric
- [ ] Normal (Gaussian) in depth
- [ ] Exponential distribution
- [ ] Law of large numbers, central limit theorem
- [ ] Randomized algorithms (quicksort, hashing, Bloom filters)

### Inferential Statistics
- [ ] Sampling
- [ ] Confidence intervals
- [ ] Hypothesis testing, p-values
- [ ] Statistical significance in A/B tests
- [ ] Regression basics

### Number Theory (Intermediate)
- [ ] Fast (binary) exponentiation
- [ ] Extended Euclidean algorithm
- [ ] Fermat's little theorem
- [ ] Euler's totient function
- [ ] Chinese remainder theorem
- [ ] Primality tests

### Geometry for Computing
- [ ] Line intersection, point-in-polygon
- [ ] Convex hull
- [ ] Areas via cross products
- [ ] Bounding boxes and collision detection
- [ ] 3D coordinates

**Where you'll use it:** graphics and game dev, competitive programming, routing/maps, recommendation systems, scheduling, analytics, performance testing, cryptography groundwork.

---

## Level 5: Advanced (Specialization Math)

*Core for machine learning, data science, cryptography, and simulation.*

### Calculus
- [ ] Limits and continuity
- [ ] Derivatives, and rate of change
- [ ] Differentiation rules: product, quotient, chain
- [ ] Partial derivatives
- [ ] Gradient
- [ ] Integrals, and area under a curve
- [ ] Optimization: minima and maxima
- [ ] Taylor series (approximations)

### Multivariable Calculus
- [ ] Functions of several variables
- [ ] Gradient descent, intuition and math
- [ ] Jacobian and Hessian
- [ ] Multiple integrals
- [ ] Constrained optimization (Lagrange multipliers)

### Linear Algebra (Advanced)
- [ ] Vector spaces, basis, span
- [ ] Linear independence, rank
- [ ] Eigenvalues and eigenvectors
- [ ] Matrix decompositions: LU, QR, SVD
- [ ] Principal component analysis (PCA)
- [ ] Orthogonality and projections
- [ ] Least squares

### Probability & Statistics (Advanced)
- [ ] Random variables, PDFs/CDFs
- [ ] Joint, marginal, and conditional distributions
- [ ] Maximum likelihood estimation
- [ ] Bayesian inference
- [ ] Markov chains
- [ ] Monte Carlo methods
- [ ] Entropy and information theory basics

### Numerical Methods
- [ ] Floating-point error and numerical stability
- [ ] Root finding: Newton's method, bisection
- [ ] Numerical integration
- [ ] Interpolation
- [ ] Solving large linear systems

### Optimization
- [ ] Convex vs. non-convex problems
- [ ] Gradient descent variants (SGD, momentum, Adam)
- [ ] Linear programming
- [ ] Loss functions

### Cryptography Math
- [ ] Modular arithmetic in depth
- [ ] RSA (prime factoring, modular exponentiation)
- [ ] Diffie-Hellman key exchange
- [ ] Finite fields
- [ ] Elliptic curve basics
- [ ] Hash function properties

### 3D Graphics Math
- [ ] Homogeneous coordinates
- [ ] 4×4 transformation matrices
- [ ] Projection: perspective and orthographic
- [ ] Quaternions (rotation without gimbal lock)
- [ ] Ray-object intersections
- [ ] Lighting and shading equations

**Where you'll use it:** machine learning, deep learning, data science, game engines, simulations, security engineering, computer vision.

---

## Level 6: Expert / Research-Level

*Only if you are going deep into a specialty.*

- [ ] Abstract algebra: groups, rings, fields
- [ ] Advanced number theory and elliptic curve cryptography
- [ ] Computational complexity: P vs. NP, NP-completeness, reductions
- [ ] Computability theory: automata, Turing machines, halting problem
- [ ] Formal languages and grammars (compilers, parsers)
- [ ] Type theory and lambda calculus
- [ ] Formal verification and proof assistants
- [ ] Information theory and coding theory (compression, error correction)
- [ ] Advanced probability: stochastic processes, martingales
- [ ] Differential equations
- [ ] Fourier and wavelet transforms (signals, audio, image compression)
- [ ] Topology and differential geometry (advanced graphics/ML research)
- [ ] Advanced optimization: convex optimization theory, duality
- [ ] Approximation and randomized algorithms
- [ ] Post-quantum cryptography, lattice math

---

## Suggested Learning Paths

Pick the path that matches your goal.

| Goal | Focus on |
|---|---|
| **General software/backend developer** | Level 1, Level 2, Level 3 (Big-O, probability, stats, graphs) |
| **Interviews / competitive programming** | Level 2, Level 3, Level 4 (combinatorics, DP, number theory, graphs) |
| **Data science / ML / AI** | Levels 3-5: linear algebra, calculus, probability, statistics, optimization |
| **Game dev / graphics** | Trigonometry, linear algebra, geometry, quaternions, 3D math |
| **Security / cryptography** | Number theory, modular arithmetic, probability, finite fields |
| **Systems / performance engineering** | Big-O, statistics (percentiles), probability, queueing basics |

---

## Suggested Order (Quick Version)

1. Binary, bitwise operations, modulo, logs
2. Boolean logic, sets, counting basics
3. Big-O and recurrences
4. Probability and statistics basics
5. Graph theory basics
6. Number theory basics
7. Linear algebra
8. Calculus
9. Advanced probability, optimization, and your chosen specialty

---

## Free Resources

- **Khan Academy:** algebra, trigonometry, calculus, linear algebra, statistics
- **3Blue1Brown (YouTube):** visual intuition for linear algebra, calculus, and neural networks
- **MIT OpenCourseWare:** *Mathematics for Computer Science* (6.042J), *Linear Algebra* (18.06, Gilbert Strang)
- **CS50 / CS50 Discrete Math-style courses:** intro to computational thinking
- **Book:** *Concrete Mathematics* (Graham, Knuth, Patashnik), an advanced discrete math classic
- **Book:** *Introduction to Algorithms* (CLRS), math applied to algorithms
- **Book:** *Mathematics for Machine Learning* (Deisenroth, Faisal, Ong), free online
- **Practice:** LeetCode, Project Euler, Codeforces, Brilliant

---

## Progress Tracker

| Level | Status | Notes |
|---|---|---|
| 1. Foundations | ☐ Not started / ☐ In progress / ☐ Done | |
| 2. Core Programming Math | ☐ Not started / ☐ In progress / ☐ Done | |
| 3. Intermediate | ☐ Not started / ☐ In progress / ☐ Done | |
| 4. Upper-Intermediate | ☐ Not started / ☐ In progress / ☐ Done | |
| 5. Advanced | ☐ Not started / ☐ In progress / ☐ Done | |
| 6. Expert | ☐ Not started / ☐ In progress / ☐ Done | |
