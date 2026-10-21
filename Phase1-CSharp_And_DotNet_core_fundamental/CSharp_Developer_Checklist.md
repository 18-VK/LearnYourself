# ✅ C# Developer Knowledge Checklist

## 1. C# Language Fundamentals
- [*] Program structure & syntax
- [*] Data types (value vs. reference)
- [*] Variables, constants, readonly, `var`, `dynamic`
- [*] Operators (arithmetic, logical, bitwise)
- [*] Control statements (`if`, `switch`, `for`, `foreach`, `while`, `do-while`)
- [*] Type conversions (`implicit`, `explicit`, `Convert`, `Parse`, `TryParse`)
- [*] Nullable types (`int?`, `??`, `?.`)
- [*] `nameof`, `typeof`, `as`, `is`
- [*] `checked` and `unchecked`

## 2. Object-Oriented Programming (OOP)
- [*] Classes & Objects
- [*] Constructors (default, parameterized, copy, static)
- [*] Destructors & Garbage collection
- [*] Access modifiers
- [*] Properties (auto, read-only, init-only, restrictions with ref/out)
- [*] Indexers
- [*] Static members
- [*] Partial classes
- [*] Sealed classes
- [*] Structs vs Classes
- [*] Records (C# 9+)
- [*] Abstract classes & methods
- [*] Interfaces & default implementations
- [*] Virtual, override, new, sealed, base
- [*] Inheritance & polymorphism
- [*] Encapsulation & Abstraction
- [*] Diamond problem & resolution

## 3. Advanced C# Concepts
- [*] Delegates (`Action`, `Func`, `Predicate`)
- [*] Events & event handlers
- [*] Callbacks (with & without lambdas)
- [*] Lambda expressions & expression-bodied members
- [*] Anonymous methods
- [*] Generics (classes, methods, constraints, variance) variance not covered
- [*] Tuples & nested tuples
- [*] `dynamic` vs `var`
- [*] Extension methods
- [*] Anonymous types
- [ ] `yield return` & iterators
- [ ] Attributes & Reflection
- [ ] Partial methods
- [*] Nullable reference types (C# 8+)

## 4. Memory Management & Safety
- [*] `using` keyword & `IDisposable`
- [*] `Dispose()` vs Finalizer(destructor)
- [*] Garbage Collector basics
- [*] `unsafe` code & pointers

**Will not go through these**

- [ ] `stackalloc`
- [ ] `Span<T>` & `Memory<T>`

## 5. Exception Handling
- [*] `try`, `catch`, `finally`
- [*] Multiple `catch` blocks
- [*] Exception hierarchy
- [*] Custom exceptions
- [*] Throw vs Rethrow
- [*] Exception filters (`catch when`)
- [ ] Global exception handling - link <https://chatgpt.com/share/68a219d3-27f4-8006-86f7-b8273f651ca4>

## 6. Collections & Data Structures
- [*] Arrays (single, multi-dimensional, jagged)
- [*] Strings & StringBuilder
- [*] ArrayList
- [*] Dictionary<TKey, TValue>
- [*] List<T>, Queue<T>, Stack<T>
- [*] HashSet<T>, SortedSet<T>
- [*] LinkedList<T>
- [ ] ObservableCollection<T>
- [ ] ReadOnlyCollection<T>
- [*] Concurrent collections
- [*] LINQ with collections

## 7. File Handling & IO
- [*] File vs FileStream
- [*] StreamReader / StreamWriter
- [*] BinaryReader / BinaryWriter(Did'nt cover)
- [*] Path, Directory, File classes
- [*] File modes & access
- [*] Async file operations (`WriteAsync`, `ReadAsync`)
- [*] JSON serialization/deserialization
- [*] XML serialization/deserialization
- [*] MemoryStream

## 8. Asynchronous & Multithreading
- [*] Thread class & ThreadPool
- [ ] Task Parallel Library (TPL) // Skipping 
- [*] async & await
- [*] CancellationToken
- [*] ConfigureAwait
- [ ] Parallel.For, Parallel.ForEach // Skipping 
- [*] ValueTask
- [*] Deadlocks & race conditions
- [*] Locks (`lock`, `Monitor`, `Mutex`, `SemaphoreSlim`)
- [*] Concurrent collections in multithreading

## 9. LINQ & Data Queries
- [*] LINQ basics (query & method syntax)
- [*] Filtering, projection, ordering
- [*] Aggregation (`Sum`, `Count`, `Average`)
- [*] Grouping (`group by`, `ToLookup`)
- [*] Joins
- [*] Deferred execution
- [ ] PLINQ (Parallel LINQ) // skipping for now,  it is use for parallel operation by assigning diff    thread
- [*] LINQ with Collections, XML, EF

## 10. Modern C# Features (C# 7+)
- [*] Pattern matching (`is`, `switch` expressions, relational patterns)
- [*] Local functions
- [*] Default interface methods
- [*] Records (C# 9)
- [*] Init-only setters
- [*] Nullable reference types
- [*] Target-typed `new`
- [*] Global usings
- [*] Top-level statements
- [*] Required properties (C# 11)

## 11. Design & Architecture
- [ ] SOLID principles
- [*] Dependency Injection (DI)
- [ ] Inversion of Control (IoC)
- [ ] Repository & Unit of Work pattern
- [ ] Factory pattern
- [ ] Singleton pattern
- [ ] Observer pattern
- [ ] Strategy pattern
- [*] Event-driven programming
- [*] Loose vs Tight coupling(Can check DI Tutorial for this)

## 12. Testing & Debugging
- [ ] Debugging in Visual Studio
- [ ] Unit testing frameworks (MSTest, NUnit, xUnit)
- [ ] Mocking frameworks (Moq, NSubstitute)
- [ ] Test-Driven Development (TDD)
- [ ] Logging (`ILogger`, Serilog, NLog)

## 13. .NET & Framework Integration
- [*] .NET Core vs .NET Framework vs .NET 5+
- [ ] CLR, CTS, CLS
- [ ] JIT Compilation
- [ ] Assemblies & GAC
- [*] Namespaces
- [*] NuGet package management

## 14. Miscellaneous
- [*] String interpolation (`$""`)
- [*] Environment variables
- [*] Command-line arguments
- [*] Config management (`appsettings.json`)
- [ ] Globalization & Localization
- [ ] Security basics (hashing, encryption)
- [ ] Networking (`HttpClient`, sockets)
