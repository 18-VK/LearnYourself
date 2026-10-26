# C# Fundamentals

## C# Identifiers

In programming languages, identifiers are used for identification purposes. Or in other words, identifiers are the
user-defined name of the program components. In C#, an identifier can be a class name, method name, variable name,
or label.

**Example:**

```csharp
public class GFG {
    static public void Main () 
    {
          int x;
    }
}
```

- **GFG**: Name of the class
- **Main**: Method name
- **x**: Variable name

## C# Data Types

Data types specify the type of data that a valid C# variable can hold. C# is a strongly typed programming language
because in C# each type of data (such as integer, character, float, and so forth) is predefined as part of the
programming language and all constants or variables defined for a given program must be described with one of the
data types.

Data Types in C# is Mainly Divided into 3 Categories:

## 1. Value Types

These store actual values and are allocated on the stack. They're faster and include primitive types.

### 1.1 Integral Types

Used to store whole numbers.

- **`byte`**: 8-bit unsigned integer (0 to 255)
- **`sbyte`**: 8-bit signed integer (-128 to 127)
- **`short`**: 16-bit signed integer (-32,768 to 32,767)
- **`ushort`**: 16-bit unsigned integer (0 to 65,535)
- **`int`**: 32-bit signed integer (-2.1B to +2.1B)
- **`uint`**: 32-bit unsigned integer (0 to 4.2B)
- **`long`**: 64-bit signed integer
- **`ulong`**: 64-bit unsigned integer
- **`char`**: 16-bit Unicode character

**Examples:**

```csharp
byte a = 255;
sbyte b = -100;
short c = -32000;
ushort d = 65000;
int e = 100000;
uint f = 4000000000;
long g = 9223372036854775807;
ulong h = 18446744073709551615;
char ch = 'A';
```

### 1.2 Floating Point Types

Used to store numbers with decimals.

- **`float`**: 32-bit single precision floating point
- **`double`**: 64-bit double precision floating point
- **`decimal`**: 128-bit high precision floating point, used for financial and monetary calculations

**Examples:**

```csharp
float price = 99.99f;
double pi = 3.14159265358979;
decimal balance = 12345.6789m;
```

| Type      | Description                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `float`   | It is 32-bit single-precision floating point type. It has 7 digit Precision.                                            |
| `double`  | It is 64-bit double-precision floating point type. It has 14 - 15 digit Precision.                                      |
| `decimal` | The decimal type is a 128-bit data type suitable for financial and monetary calculations. It has 28-29 digit Precision. |

### 1.3 Boolean

Stores true or false values.

**Example:**

```csharp
bool isOnline = true;
```

### 1.4 Enum

Used to declare a set of named constants.

**Example:**

```csharp
enum Status { Pending, Approved, Rejected }
Status orderStatus = Status.Approved;
```

### 1.5 Struct

A lightweight value type that can contain fields and methods.

**Example:**

```csharp
struct Point {
    public int X;
    public int Y;
}
Point p;
p.X = 10;
p.Y = 20;
```

## 2. Reference Types

Store reference to memory location. Allocated on the heap.

### 2.1 String

Sequence of characters (immutable).

**Example:**

```csharp
string name = "Aman";
```

> **Note:** If a string is immutable, does that mean it can't be overwritten?
>
> You can overwrite a string variable — what you can't do is change the contents of the existing string
> object once it's created. You overwrote the variable reference, not the original string itself.

**e.g.:**

```csharp
string name = "Aman";       // Creates a string object with value "Aman"
name = "Rahul";             // Creates a new string object with value "Rahul"
```

- The original `"Aman"` string still exists in memory (until garbage collected).
- `name` now points to a new string `"Rahul"`.
- You overwrote the variable reference, not the original string itself.

### 2.2 Object

Base class for all types in C#. Can hold any data type.

**Example:**

```csharp
object obj = 123;
```

### 2.3 Dynamic

Allows storing any type and resolves type at runtime.

**Example:**

```csharp
dynamic data = "Hello";
data = 100;
```

## 3. Nullable Types

Allows value types to hold null.

In C#, nullable types allow value types (like `int`, `bool`, `DateTime`, etc.) to represent a valid
value or `null` — something they can't do by default.

**Example:**

```csharp
int? age = null;
bool? isAdmin = true;
```

or

```csharp
Nullable<int> num = null;
Nullable<bool> flag = true;
```

> **Note:**
> The null-coalescing operator (`??`) returns the left-hand value if it is NOT null, otherwise it returns the right-hand value.
>
> ```csharp
> result = left ?? right;
> ```
>
> Meaning:
>
> "If `left` is not null → use it
> If `left` is null → use `right`"

## 4. User-Defined Types

### 4.1 Class

Reference type that defines data and behavior.

**Example:**

```csharp
class Person {
    public string Name;
    public int Age;
}
Person p = new Person();
```

### 4.2 Interface

Defines contract without implementation.

**General Rules for Naming Interfaces**

| Rule               | Description                                      | Example                          |
| ------------------ | ------------------------------------------------ | -------------------------------- |
| ✅ Start with 'I'  | Prefix interface names with uppercase `I`        | `IShape`, `IAnimal`, `IService`  |
| ✅ Use PascalCase  | Capitalize the first letter of each word         | `ICarEngine`, `IDataProvider`    |
| ✅ Be Descriptive  | Name should clearly describe purpose or behavior | `ILogger`, `IDatabaseConnection` |

**Example:**

```csharp
interface IAnimal {
    void Speak();
}
class Dog : IAnimal {
    public void Speak() {
        Console.WriteLine("Woof!");
    }
}
```

## 5. Pointer Types (Unsafe)

Used in low-level code. Requires `unsafe` keyword.

C# supports pointers in a limited extent. A C# pointer is nothing but a variable that holds the memory address of
another type. But in C# pointer can only be declared to hold the memory address of value types and arrays. Unlike
reference types, pointer types are not tracked by the default garbage collection mechanism. For the same reason
pointers are not allowed to point to a reference type or even to a structure type which contains a reference type.
We can say that pointers can point to only unmanaged types which includes all basic data types, enum types, other
pointer types and structs which contain only unmanaged types.

**Example:**

```csharp
unsafe {
    int x = 10;
    int* ptr = &x;
}
```

**e.g.:**

```csharp
public unsafe void Method()
{
    int x = 10;
    int* ptr1 = &x;
    Console.WriteLine((int)ptr1);
    Console.WriteLine(*ptr1);
}
```

## 6. Type Aliases (C# -> .NET)

C# provides aliases for .NET framework types.

| C# Keyword | .NET Type       |
|------------|------------------|
| int        | System.Int32     |
| string     | System.String    |
| bool       | System.Boolean   |
| float      | System.Single    |
| double     | System.Double    |
| char       | System.Char      |
| object     | System.Object    |
| decimal    | System.Decimal   |

## Summary

- Value types: `int`, `bool`, `char`, `float`, etc.
- Reference types: `string`, `object`, `class`, etc.
- Nullable types: `int?`, `bool?`
- `dynamic` allows flexibility, use cautiously.
- Use `decimal` for financial calculations.

## Unsafe Keyword in C#

In C#, the unsafe keyword is used to enable pointer operations and direct memory manipulation, which are normally 
restricted in managed code. It allows you to write code similar to C/C++ inside C#, but requires explicit marking and 
compiler options (/unsafe) since the runtime cannot verify its safety. 

### What `unsafe` Does

- **Declares an unsafe context:** You can mark a method, type, or block with `unsafe` to allow pointer usage.

- **Pointer operations:** Enables declaring pointers (`int* p`), dereferencing (`*p`), and using the address-of
    operator (`&`).

- **Direct memory access:** Useful for performance-critical code, interop with native APIs, or working with
    memory-mapped hardware.

- **Compiler requirement:** Must compile with `AllowUnsafeBlocks` enabled (`csc /unsafe`).

- **Runtime behavior:** The CLR cannot verify unsafe code, so it is considered unverifiable, though not inherently
    dangerous.

### Examples

#### Method with `unsafe`

```csharp
unsafe static void SquarePtrParam(int* p)
{
    *p *= *p;
}
```

#### Unsafe block

```csharp
unsafe
{
    int i = 5;
    SquarePtrParam(&i); // using address-of operator
    Console.WriteLine(i); // Output: 25
}
```

#### Pointer-based array copy

```csharp
unsafe static void FastCopy(byte* src, byte* dst, int count)
{
    for (int i = 0; i < count; i++)
        dst[i] = src[i];
}
```

In C#, you do not explicitly deallocate pointers like in C/C++ with `free` or `delete`. Memory management is handled by
the .NET garbage collector (GC). However, when you use the `unsafe` keyword and pointers, you are stepping outside the
GC's safety net, so the rules change depending on where the memory came from.

### Scenarios for Pointer Deallocation

#### 1. Pointer to Managed Objects

```csharp
unsafe
{
    int[] arr = new int[10];
    fixed (int* p = arr)
    {
        // p points to managed array memory
    }
}
```

No manual deallocation is needed.

The GC owns the array. When it is no longer referenced, the GC will reclaim it.

You must use `fixed` to pin the object so the GC does not move it during collection.

#### 2. Pointer to Stack Memory (`stackalloc`)

```csharp
unsafe
{
    Span<int> span = stackalloc int[10];
}
```

No manual deallocation is needed.

Stack memory is automatically reclaimed when the method scope ends.

#### 3. Pointer to Unmanaged Memory (`Marshal` / native allocation)

```csharp
using System;
using System.Runtime.InteropServices;

unsafe
{
    IntPtr ptr = Marshal.AllocHGlobal(100); // allocate unmanaged memory
    byte* p = (byte*)ptr;

    // use memory...

    Marshal.FreeHGlobal(ptr); // must free manually
}
```

Manual deallocation is required.

If you allocate unmanaged memory via `Marshal.AllocHGlobal`, `Marshal.AllocCoTaskMem`, or native interop, you must
explicitly free it with `Marshal.FreeHGlobal` or `Marshal.FreeCoTaskMem`.

Forgetting to free unmanaged memory causes memory leaks.

In summary, you only manually deallocate memory when you have allocated unmanaged memory. For managed arrays or stack
allocations, the runtime takes care of cleanup.