# C# Architecture: How Code Compiles and Runs

## 1. The core idea

Think of C# like writing a recipe in English, then having it translated for different kitchens.

- **You** write the recipe (your C# code).
- A **translator** converts it into a universal "middle language" (IL).
- A **chef** in each kitchen (the CLR) reads that middle language and cooks it using the local tools (your CPU).

That's why the same compiled C# program can run on Windows, Linux, or Mac.

## 2. The journey of your code

```
Your C# code  →  Compiler  →  IL  →  CLR + JIT  →  Machine code  →  CPU runs it
 (.cs file)      (Roslyn)    (.dll)               (1s and 0s)
```

Two stages:

1. **Build time**: C# is converted to IL.
2. **Run time**: IL is converted to machine code, right as the program runs.

### Detailed pipeline

```
 .cs files
    │  Roslyn compiler (csc)
    ▼
 Assembly (.dll/.exe) = IL + metadata + manifest
    │  dotnet host (hostfxr → hostpolicy → coreclr)
    ▼
 CLR loads assembly
    │  JIT compiler (RyuJIT)
    ▼
 Native machine code → executed by CPU
    │
    └── managed by: GC, type system, exception handling, threading
```

## 3. Key terms

| Term | Full form | Simple meaning |
|---|---|---|
| **IL** | Intermediate Language | The universal "middle" code your C# is compiled into |
| **CLR** | Common Language Runtime | The engine that runs your program and manages memory |
| **JIT** | Just-In-Time compiler | The tool inside the CLR that turns IL into machine code on demand |

### What is IL?

**IL = Intermediate Language** (also called CIL or MSIL).

- A simple, low-level language that sits **between** C# and machine code.
- **Not tied to any CPU** (Intel, AMD, ARM, etc.).
- Stored inside your `.dll` or `.exe` file.

Example: this C# code

```csharp
int result = a + b;
```

becomes IL like this:

```
ldarg.1    // load a
ldarg.2    // load b
add        // add them
```

Why not compile straight to machine code? Machine code only works on one type of CPU. IL works everywhere and is translated at the last moment for whatever machine it lands on.

### What is CLR?

**CLR = Common Language Runtime.** The **engine that runs your program**. In modern .NET it is called **CoreCLR**.

Its main jobs:

- **Loads** your assemblies (`.dll` files).
- **Runs** your code (using the JIT).
- **Manages memory** automatically (the Garbage Collector frees unused objects).
- **Handles exceptions** (try/catch).
- **Manages threads** and security checks.

### What is JIT?

**JIT = Just-In-Time compiler.** The part of the CLR that converts **IL into machine code** while the program is running. It translates a method **only when that method is first called**.

1. Your program calls `Calculate()` for the first time.
2. The JIT converts that method's IL into machine code.
3. The machine code is kept in memory.
4. Every later call runs the already-translated version, so it is fast.

**Tiered compilation**: .NET first compiles quickly (fast startup, Tier 0). Methods called often (about 30+ times) are recompiled with heavy optimization (Tier 1), using runtime data (Dynamic PGO). OSR (On-Stack Replacement) lets long-running loops switch to optimized code mid-execution.

## Q&A: Why not compile C# straight to machine code?

**Question:** Why does C# go through IL and a JIT? Why doesn't the compiler just produce machine code directly?

**Answer:**

1. **Machine code is tied to one CPU and OS.**
   Code for Intel/AMD (x64) won't run on ARM64, and Windows and Linux differ in calling conventions and system calls. Compiling straight to machine code means building and shipping a separate binary for every combination. IL is CPU-independent, so you build **once** and it runs anywhere a .NET runtime exists.

2. **The JIT can optimize for the actual machine.**
   At run time the JIT knows the exact CPU it is running on (for example, whether AVX2 or AVX-512 instructions are available) and can generate code that uses them. A compiler building ahead of time has to assume a generic CPU.

3. **The JIT can optimize based on real behavior.**
   With tiered compilation and Dynamic PGO, the runtime watches which methods are hot and which branches are taken, then re-optimizes them (inlining, devirtualization). A compiler working before the program runs cannot see this.

4. **IL and metadata enable runtime services.**
   Because the runtime understands IL and metadata, it can provide the GC, type safety, exception handling, reflection, dependency injection, serialization, and dynamic assembly loading. Plain machine code carries none of this information.

5. **Many languages share one runtime.**
   C#, F#, and VB.NET all compile to the same IL, so they can call each other's code and share the same libraries and runtime.

### The trade-off

The cost of this design is **startup time and memory**, because methods must be JIT-compiled on first use. .NET offers ways to reduce that cost:

| Option | What it does |
|---|---|
| **Tiered compilation** | Quick, unoptimized JIT first, then re-optimize hot methods |
| **ReadyToRun (R2R)** | Ships precompiled native code alongside IL for faster startup |
| **NativeAOT** | Compiles fully to machine code ahead of time (no IL, no JIT), at the cost of portability and some reflection features |

So you *can* compile straight to machine code in .NET (NativeAOT), but you give up the "build once, run anywhere" flexibility and runtime optimizations.

## 4. Compile time: Roslyn

When you run `dotnet build`, MSBuild invokes **Roslyn** (`csc`), which does:

1. **Lexing/parsing**: source becomes a syntax tree.
2. **Semantic analysis**: binds symbols, resolves types, checks overloads, nullability, definite assignment. Analyzers and source generators run here.
3. **Lowering**: high-level constructs become simpler ones:
   - `async/await` becomes a state machine
   - `foreach` becomes a `while` loop with an enumerator
   - `using` becomes `try/finally`
   - lambdas become closure classes
   - `yield return` becomes an iterator class
4. **Emit**: produces an **assembly**.

### What's inside an assembly

- **IL (CIL)**: stack-based, CPU-independent instructions.
- **Metadata**: tables describing every type, method, field, and reference. This enables reflection, DI, and serialization.
- **Manifest**: assembly name, version, referenced assemblies.
- **Resources**, plus an optional PDB (debug symbols).

Inspect IL with `ildasm`, ILSpy, or `dotnet-ildasm`.

## 5. Runtime architecture (CLR components)

| Component | Role |
|---|---|
| **Host** (`dotnet` / apphost) | Resolves the runtime from `*.runtimeconfig.json`, loads `hostfxr` → `hostpolicy` → `coreclr`, reads `*.deps.json` |
| **Assembly loader** | Loads assemblies lazily, on first use, into an `AssemblyLoadContext` |
| **Type loader / type system** | Builds `MethodTable` and `EEClass` structures per type |
| **JIT (RyuJIT)** | Compiles IL to native code per method, on first call |
| **GC** | Generational, compacting garbage collector (Gen0/1/2, LOH, POH) |
| **Execution/Exception engine** | Stack walking, two-pass exception handling |
| **Threading** | ThreadPool, synchronization, async infrastructure |
| **BCL** (System.*) | The class libraries (`System.Private.CoreLib` etc.) |

## 6. How a program actually runs

1. `dotnet MyApp.dll` starts the host, which picks the runtime version and initializes CoreCLR.
2. The runtime loads your assembly and finds the entry point (`Main`, or the compiler-generated one for top-level statements).
3. The **first call to any method** hits a stub that triggers the JIT. The JIT compiles the method, patches the stub, and later calls go direct.
4. Types are loaded and static constructors run on first access.
5. The GC manages the heap. Value types (`struct`) live on the stack or inline in objects; reference types (`class`) live on the heap.

## 7. Memory in simple terms

- **Stack**: fast, small, temporary storage for simple values and method calls.
- **Heap**: bigger storage for objects (anything created with `new` from a class).
- **Garbage Collector (GC)**: automatically removes heap objects that nobody uses anymore.

Other notes:

- **Boxing**: converting a value type to `object` copies it to the heap, a common hidden allocation.
- **`Span<T>` / `ref struct`**: stack-only slices that avoid allocations.
- **Unsafe / P-Invoke**: lets you escape to native code when needed.

## 8. Do we need the CLR installed to run a C# app?

**Yes, the CLR must be present, but it doesn't always have to be installed separately.** It depends on how you publish.

### Option 1: Framework-dependent (default)

Your app contains only your code (IL). The machine must already have the **.NET Runtime** installed.

```bash
dotnet publish -c Release
dotnet MyApp.dll        # needs .NET Runtime installed
```

- Small output size.
- Many apps share one installed runtime.
- Runtime security updates are applied separately from your app.
- Fails with "You must install .NET to run this application" if the runtime is missing.

### Option 2: Self-contained

The CLR, JIT, and libraries are **bundled in your published folder**. Nothing needs to be installed on the target machine.

```bash
dotnet publish -c Release --self-contained -r linux-x64
./MyApp                 # runs with no .NET installed
```

- Larger output (roughly 70 MB+, less with trimming).
- You choose the exact runtime version.
- Must publish per OS/CPU (`win-x64`, `linux-x64`, `osx-arm64`, ...).
- You are responsible for updating the app to get runtime security patches.

### Option 3: NativeAOT

Your code is compiled **fully to machine code** ahead of time. No IL and no JIT at runtime; the output is a plain native executable.

```bash
dotnet publish -c Release -r linux-x64 -p:PublishAot=true
```

- Fast startup, small footprint.
- Still has a tiny built-in runtime (mainly the GC), but no full CLR to install.
- Restrictions: limited reflection, no dynamic assembly loading.

### Comparison

| Publish type | Needs runtime installed? | Contains IL? | JIT at runtime? |
|---|---|---|---|
| Framework-dependent | **Yes** | Yes | Yes |
| Self-contained | No (bundled) | Yes | Yes |
| NativeAOT | No | No | No |

### .dll vs .exe

A `.dll` can't run on its own; it needs `dotnet MyApp.dll`. The `.exe` on Windows (or the extensionless executable on Linux/Mac) is a small launcher (the *apphost*) that finds the runtime and starts your `.dll`. For a framework-dependent app, the runtime is still required.

### SDK vs Runtime

The **SDK** (for developers) includes the compiler, build tools, and runtime. A server that only *runs* apps needs just the **Runtime** (or the **ASP.NET Core Runtime** for web apps).

### Docker tip

Dockerfiles typically build on `mcr.microsoft.com/dotnet/sdk` and run on the smaller `mcr.microsoft.com/dotnet/aspnet` image. The final image only needs the runtime, not the compiler.

## 9. Other execution options

- **ReadyToRun (R2R)**: precompiled native code bundled alongside IL for faster startup (the framework itself ships this way).
- **NativeAOT**: see above.
- **Mono / Blazor WebAssembly**: IL interpreted or AOT-compiled to WASM.

## 10. Project-level structure

- **Solution** (`.sln`) holds **projects** (`.csproj`); each project builds to one **assembly**.
- `dotnet restore` fetches NuGet packages, `build` compiles, `publish` produces deployable output.
- The **Target Framework Moniker** (`net9.0`, etc.) and the **runtime pack** decide which BCL and runtime you run against.

## Q&A: Can C code use a C# DLL?

**Question:** Can I use a C# `.dll` from a C program?

**Answer:** **Yes, but not directly.** A C# `.dll` is a *managed* assembly (IL), not a native library, so C can't just `LoadLibrary` it and call a function the way it would with a C DLL. You need a bridge. The reverse (C# calling C) is easy with P/Invoke.

### Options

| Approach | How it works | Needs .NET runtime on target? | Platform |
|---|---|---|---|
| **NativeAOT shared library** (best modern choice) | Compile C# into a real native `.dll`/`.so` with exported C functions | No | Windows, Linux, macOS |
| **Host the CLR from C** (`nethost`/`hostfxr`) | Your C program starts the .NET runtime and gets function pointers to C# methods | Yes | Windows, Linux, macOS |
| **COM interop** | Expose C# classes as COM objects, and C calls them via COM | Yes | Windows only |
| **C++/CLI wrapper** | A mixed-mode C++ DLL sits between C and C# | Yes | Windows only |

### Example: NativeAOT export

**C# side**

```csharp
using System.Runtime.InteropServices;

public static class MathLib
{
    [UnmanagedCallersOnly(EntryPoint = "add")]
    public static int Add(int a, int b) => a + b;
}
```

**`.csproj`**

```xml
<PropertyGroup>
  <TargetFramework>net9.0</TargetFramework>
  <PublishAot>true</PublishAot>
  <NativeLib>Shared</NativeLib>
  <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
</PropertyGroup>
```

**Publish**

```bash
dotnet publish -c Release -r linux-x64
```

This produces a native `MathLib.so` (or `MathLib.dll` on Windows) that exports a plain C function named `add`.

**C side**

```c
#include <stdio.h>

int add(int a, int b);   // declaration

int main(void) {
    printf("%d\n", add(2, 3));
    return 0;
}
```

```bash
gcc main.c -L. -lMathLib -o app
```

You can also load it at run time with `dlopen`/`LoadLibrary` instead of linking at build time.

### Rules to keep in mind

- **Use simple types** across the boundary: `int`, `double`, `byte`, pointers. Classes, generics, and `List<T>` can't cross into C.
- **Strings** must be passed as `char*` pointers and converted on the C# side (for example with `Marshal.PtrToStringUTF8`). You are responsible for who allocates and frees the memory.
- **Don't let exceptions escape** into C. Catch them in C# and return an error code.
- **NativeAOT limits** apply: limited reflection and no dynamic assembly loading.

### When to pick which

- **Shipping a native library to C/C++ users with no .NET installed:** NativeAOT.
- **Existing C app that needs to call a full C# library (with reflection, DI, etc.):** host the CLR with `hostfxr`.
- **Windows-only, legacy:** COM.

## One-line summary

> You write C#. The **compiler** turns it into **IL**. When you run the app, the **CLR** starts, and its **JIT** converts IL into machine code that your CPU executes, while the CLR handles memory and safety.
