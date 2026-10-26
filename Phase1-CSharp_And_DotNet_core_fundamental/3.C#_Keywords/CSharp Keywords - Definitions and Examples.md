# C# Keywords - Definitions and Examples

## 🔐 Access Modifiers

### `public` - Accessible from any code

```csharp
public class A {}
```

### `private` - Accessible only within its containing type

```csharp
private int x;
```

### `protected` - Accessible within type and derived types

```csharp
protected void M() {}
```

### `internal` - Accessible within the same assembly

**Definition:** The `internal` keyword specifies that a member or type is accessible only within the same assembly (project or DLL).

**Use case:** When you want code to be hidden from other projects, but accessible throughout your own project.

**Example:**

```csharp
// In Project A
internal class Helper {
    internal void DoWork() {
        Console.WriteLine("Internal Work");
    }
}

// In Project A - works fine
var h = new Helper();
h.DoWork();

// In Project B (reference added to Project A) - ❌ Error: inaccessible
```

### `protected internal` - Accessible from assembly or derived types

**Definition:** The `protected internal` modifier allows access within the same assembly or from derived classes, even in different assemblies.

**Use case:** When you want to allow access within your project and also allow subclasses in other projects to use it.

**Example:**

```csharp
// In Project A
public class BaseClass {
    protected internal void Show() {
        Console.WriteLine("Protected Internal Method");
    }
}

// In Project B
public class Derived : BaseClass {
    public void CallShow() {
        Show(); // ✅ Allowed: Accessed via inheritance
    }
}  
```

### `private protected`

Accessible only by derived types that are in the same assembly (combines private-like and protected-like restriction).

```csharp
public class Base
{
    private protected string SecretForDerivedInAssembly = "only derived within same assembly";
}

public class DerivedSameAssembly : Base
{
    public void Print() => Console.WriteLine(SecretForDerivedInAssembly); // OK
}

// If Derived is in another assembly, it CANNOT access that member.
```

Introduced in C# 7.2. Use when you want derived access but only inside the same assembly.

### `file` (file-scoped type) — C# 11+

Type is visible only within the same source file. Useful for helpers that must not be visible to other files in the
assembly.

```csharp
// File: Helpers.cs (C# 11+)
file class FileHelper     // 'file' limits this class to this file only
{
    public static void DoIt() => Console.WriteLine("File-only helper");
}

public class PublicApi
{
    public void UseHelper() => FileHelper.DoIt(); // OK: same file
}

// From any other file in the same project:
// FileHelper // not visible -> compile error
```

## 🏷 Modifiers

### `abstract` - Unimplemented, must be overridden

An abstract class in C# is a class that cannot be instantiated directly. It serves as a base class and is designed to be
inherited by other classes. It can contain abstract methods (without implementation) and non-abstract methods (with
implementation).

**e.g.**

```csharp
abstract class C { public abstract void M(); }
```

### `sealed` - Prevents further inheritance

```csharp
sealed class D {}
```

### `static` - Belongs to type, not instance

```csharp
static void E() {}
```

### `readonly` - Field is assigned only during declaration

The `readonly` keyword in C# is used to declare a field that can only be assigned at the point of declaration, or
inside the constructor of the containing class or struct.

**Example:**

```csharp
class Car
{
    public readonly int Year;
    public Car(int year)
    {
        Year = year; // ✅ allowed in constructor
    }
    public void UpdateYear(int newYear)
    {
        // Year = newYear; ❌ ERROR: Cannot assign to readonly field
    }
}  
```

### `const` - Compile-time constant

```csharp
const double Pi = 3.14;
```

### `volatile` - Field may be modified by multiple threads

The `volatile` keyword in C# indicates that a field might be modified by multiple threads simultaneously, and prevents the compiler
and CPU from applying certain optimizations that could cause inconsistent behavior in multithreaded scenarios.

It ensures that the most up-to-date value of the field is always read directly from memory, not from a thread-local cache or CPU register.

```csharp
volatile int counter;
```

### `unsafe` - Permits pointers and unmanaged code

```csharp
unsafe { int* p; }
```

## 💾 Types

### `class` - Defines a reference type

```csharp
class E {}
```

### `struct` - Defines a value type

```csharp
struct F { public int X; }
```

### `interface` - Defines a contract for types

```csharp
interface IG { void M(); }
```

### `enum` - Defines a set of named constants

```csharp
enum Color { Red, Green }
```

### `delegate` - Type-safe method pointer

```csharp
delegate void G(int x);
```

> **Note:** Will go through in detail further

### `record` - Defines an immutable reference type (C# 9+)

```csharp
record Person(string Name, int Age);
```

> **Note:** Will go through in detail further

### `dynamic` - Type bound at runtime

```csharp
dynamic d = "hi";
```

### `var` - Implicit local variable type

```csharp
var list = new List<int>();
```

> **Note:** should comapre `var` and `dynamic`

## 🔄 Control Flow

### `if` - Executes code block if condition true

```csharp
if (x > 0) {}
```

### `else` - Alternative when `if` is false

```csharp
else {}
```

### `switch` - Multi-way branch based on value

```csharp
switch (x) { case 1: break; }
```

### `case` - One branch in `switch`

```csharp
case 2: break;
```

### `default` - Fallback in `switch`

```csharp
default: break;
```

### `for` - Loop with initializer, condition, iterator

```csharp
for(int i=0;i<3;i++) {}
```

### `foreach` - Loop over a collection

```csharp
foreach(var v in list) {}
```

### `while` - Loops while condition is true

```csharp
while (x > 0) x--;
```

### `do` - Executes once, then loops while condition holds

```csharp
do {} while(false);
```

### `break` - Exits nearest loop or switch

```csharp
if(x==0) break;
```

### `continue` - Skips to next loop iteration

```csharp
if(x<0) continue;
```

### `return` - Exits method, optionally returns value

```csharp
return 5;
```

### `throw` - Throws an exception

```csharp
throw new Exception();
```

### `try` - Block to handle exceptions

```csharp
try { } catch{}
```

### `catch` - Catches exceptions

```csharp
catch(Exception ex) {}
```

### `finally` - Executes after try/catch always

```csharp
finally { }
```

### `checked` / `unchecked` - Controls overflow checking

```csharp
checked { int a = int.MaxValue + 1; }
unchecked { int b = int.MaxValue + 1; }
```

**Definition:**

In C#, `checked` and `unchecked` are keywords used to control integer overflow checking at runtime.
They are primarily relevant when performing arithmetic operations with integral types (like `int`, `byte`, `short`, etc.)
where an operation might exceed the type's maximum or minimum bounds.

- **`checked`: Enables Overflow Detection**

  **e.g.:**

  ```csharp
  checked
  {
      int a = int.MaxValue;
      int b = a + 1;  // ❌ Throws OverflowException
  }
  ```

- **`unchecked`: Suppresses Overflow Detection (default in most builds)**

  **e.g.:**

  ```csharp
  unchecked
  {
      int a = int.MaxValue;
      int b = a + 1;  // ✅ No error; wraps to int.MinValue
      Console.WriteLine(b);  // Output: -2147483648
  }
  ```

| Context              | Example                             |
| -------------------- | ----------------------------------- |
| **Block level**      | `checked { int x = a + b; }`        |
| **Expression level** | `int x = checked(a + b);`           |
| **Type cast**        | `byte b = checked((byte)intValue);` |

## 🧬 Type Conversion & Testing

### `is` - Tests if object is a type

Check type compatibility at runtime, Evaluates to true or false, Safe and null-aware.

```csharp
if (o is string) {}
```

**e.g.:**

```csharp
object obj = "Hello";
if (obj is string)
{
  Console.WriteLine("obj is a string");
}
```

### `as` - Safe cast; returns null if incompatible

In C#, the `as` keyword is used to safely cast an object to a reference type or
nullable value type. If the cast fails, it returns `null` instead of throwing an exception.

**e.g.:**

```csharp
var s = o as string;
```

> **Note:**
> Unlike direct casting:
>
> ```csharp
> object obj = 42;
> string str = (string)obj; // ❌ Throws InvalidCastException
> ```
>
> But:
>
> ```csharp
> string str = obj as string; // ✅ No exception, str becomes null
> ```

**Rules and Limitations:**

| Feature                        | `as`                         |
| ------------------------------ | ---------------------------- |
| Works with **reference types** | ✅ Yes                        |
| Works with **nullable types**  | ✅ Yes (`as int?`, etc.)      |
| Works with **value types**     | ❌ No (use explicit cast)     |
| Throws exception on failure    | ❌ No, returns `null` instead |

### `implicit` - Defines an automatic type conversion

```csharp
public static implicit operator MyInt(int x) => new();
```

### `explicit` - Defines a manual type conversion

```csharp
public static explicit operator int(MyInt m) => 0;
```

##### Custom Type Conversions: `implicit` and `explicit`

C# allows a custom type to define how it can be converted to or from another type. Conversion operators are useful
when a type wraps another value and you want to provide natural conversion syntax.

###### `implicit` Conversion

The `implicit` keyword defines an automatic conversion. The caller does not need to write a cast.

```csharp
public struct MyInt
{
    private int value;

    public MyInt(int value)
    {
        this.value = value;
    }

    public static implicit operator MyInt(int x)
    {
        return new MyInt(x);
    }
}

MyInt number = 10; // int is automatically converted to MyInt
```

Use `implicit` when the conversion is safe, lossless, and unsurprising.

###### `explicit` Conversion

The `explicit` keyword defines a manual conversion. The caller must write a cast, which makes the conversion visible.

```csharp
public struct MyInt
{
    private int value;

    public MyInt(int value)
    {
        this.value = value;
    }

    public static explicit operator int(MyInt number)
    {
        return number.value;
    }
}

MyInt number = 10;       // uses the implicit conversion
int value = (int)number;  // uses the explicit conversion
```

Use `explicit` when the conversion may lose information, fail, or is not obvious to the caller.

###### Complete Example

```csharp
public struct MyInt
{
    private int value;

    public MyInt(int value)
    {
        this.value = value;
    }

    // int -> MyInt: automatic conversion
    public static implicit operator MyInt(int x)
    {
        return new MyInt(x);
    }

    // MyInt -> int: manual conversion
    public static explicit operator int(MyInt number)
    {
        return number.value;
    }
}

MyInt number = 10;       // implicit: int -> MyInt
int value = (int)number; // explicit: MyInt -> int

Console.WriteLine(value); // 10
```

Conversion operators must be `public static`, and at least one side of the conversion must be the containing custom
type. Use these operators carefully because automatic conversions can make code harder to understand when the
conversion is not obvious.

### `typeof` - Gets the `Type` object

Get the `Type` object of a type at compile-time.

**e.g.:**

```csharp
var t = typeof(string); 
```

or

```csharp
Type t = typeof(int);
Console.WriteLine(t.FullName); // Output: System.Int32
```

### `sizeof` - Gets size in bytes of unmanaged type

```csharp
var sz = sizeof(int);
```

## 📋 Parameters & Method Control

### `params` - Accepts variable number of args

```csharp
void Log(params string[] msgs) {}
```

### `ref` - Passes arg by reference; requires initialization

```csharp
void M(ref int x) { x++; }
```

### `out` - Passes arg by reference; doesn't require initialization

```csharp
void M(out int x) { x = 5; }
```

### `in` - Passes arg by reference as readonly

```csharp
void M(in int x) { }
```

### `yield` - Used in iterator methods to produce sequence

```csharp
IEnumerable<int> Gen() { yield return 1; }
```

## 🧱 Memory, Pointers & Unsafe Context

### `fixed` - Pins an object in memory

```csharp
unsafe { fixed(int* p = &x) {} }
```

### `stackalloc` - Allocates memory in stack

```csharp
Span<int> buf = stackalloc int[10];
```

### `extern` - Declares method implemented externally

```csharp
[DllImport("lib")] extern static void E();
```

## 📦 Namespaces & Imports

### `namespace` - Declares scope for classes

```csharp
namespace Foo { class A {} }
```

### `using` - Imports namespace or manages resources with `IDisposable`

```csharp
using System;
using(var f=new File()){}
```

## 🔧 Operator & Overload

### `operator` - Overloads operator for type

```csharp
public static MyInt operator +(MyInt a, MyInt b) => a;
```

## 🧪 Pattern Matching & LINQ

### `when` - Filters exception or pattern

```csharp
catch(Exception e) when (e is InvalidOpException) {}
```

### `let` - Introduces variable in LINQ

```csharp
var q = from x in xs let y = x*2 select y;
```

### `from`, `where`, `select`, `group`, `into`, `orderby`, `join`, `by`, `ascending`, `descending`

```csharp
var q = from x in xs where x>0 orderby x descending select x;
```

Example: Basic Query
```csharp
int[] numbers = { 1, 2, 3, 4, 5 };

var query = from n in numbers
            where n % 2 == 0
            select n;

foreach (var item in query)
    Console.WriteLine(item); // Output: 2, 4
```

## 🧼 Newer & Misc Contextual

### `async` - Marks async method

```csharp
async Task M() {}
```

### `await` - Waits for async operation

```csharp
await Task.Delay(1);
```

### `partial` - Splits a type across files

```csharp
partial class P {}
```

### `init` - Sets property only during object-init

```csharp
public string Name { get; init; }
```

### `with` - Creates modified copy of record

```csharp
var p2 = p with { Name = "Bob" };
```

### `not` - Pattern matching negation

```csharp
if (x is not null) {}
```

### `and`, `or` - Pattern combining

```csharp
if (x is int and > 0) {}
```

### `nint`, `nuint` - Native-sized integer types

```csharp
nint ni = 0;
```

### `record`, `file`, `required`, `scoped`, `unmanaged`, `alias`, `global`, `managed`

```csharp
required string Name { get; init; }
```

## 🟢 Literals & Constants

### `null` - Represents no object

```csharp
object o = null;
```

### `true`, `false` - Boolean values

```csharp
bool b = true;
```

## Extra

### Params

It is useful when the programmer doesn't have any prior knowledge about the number of parameters to be used. By using
`params` you are allowed to pass any variable number of arguments. Only one `params` keyword is allowed and no additional
Params will be allowed in function declaration after a `params` keyword. The length of `params` will be zero if no
arguments will be passed.

**Example:**

```csharp
class Geeks {

    // function containing params parameters
    public static int mulval(params int[] num)
    {
        int res = 1;
        // foreach loop
        foreach(int j in num)
        {
            res *= j;
        }
        return res;
    }
    static void Main(string[] args)
    {
        // Calling mulval method
        int x = mulval(20, 49, 56, 69, 78);
        // show result
        Console.WriteLine(x);
    }
} 
```

> **Note:** go through some main keywords seperatly..

### `is` Keyword

The `is` keyword checks whether an object is compatible with a given type.
It returns a `bool` (true/false).

**✅ Example: Using `is`**

```csharp
object obj = "Hello World";

if (obj is string)   // checks if obj is a string
{
    Console.WriteLine("obj is a string");
}
else
{
    Console.WriteLine("obj is not a string");
}
```

**Output:**

```text
obj is a string
```

**✅ Pattern Matching with `is` (C# 7+)**

```csharp
object obj = "Hello";

if (obj is string str)   // if true, also casts into str
{
    Console.WriteLine($"String length = {str.Length}");
}
```
