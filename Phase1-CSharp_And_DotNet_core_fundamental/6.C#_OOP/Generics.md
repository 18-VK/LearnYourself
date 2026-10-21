# Generic class

A generic class lets you define a class with type parameters so one implementation works for many types without
casting or boxing. Syntax: `class MyClass<T> { ... }`.

**Example:**

```csharp
public class Box<T>
{
    public T Value { get; set; }

    public Box(T value) => Value = value;

    public override string ToString() => $"Box holding: {Value}";
}

// Usage:
var intBox = new Box<int>(42);
var strBox = new Box<string>("hello");
Console.WriteLine(intBox); // Box holding: 42
Console.WriteLine(strBox); // Box holding: hello
```

**Explained:**

### Why `Console.WriteLine(intBox)` prints nicely

Normally, if you write:

```csharp
Console.WriteLine(intBox);
```

C# will call `.ToString()` on the object.
You overrode `ToString()`:

```csharp
public override string ToString() => $"Box holding: {Value}";
```

For `intBox`, `Value = 42`, so it prints:

```text
"Box holding: 42"
```

For `strBox`, `Value = "hello"`, so it prints:

```text
"Box holding: hello"
```

## Type parameter constraints

In C# you can put multiple constraints on a generic type parameter.

### Kinds of constraints you can combine

- **Base class constraint** → `where T : SomeBaseClass`
  (T must inherit from `SomeBaseClass`)

- **Interface constraint(s)** → `where T : IDisposable, IComparable`
  (T must implement all these interfaces)

- **Reference/value type constraint**
  - `where T : class` (must be reference type)
  - `where T : struct` (must be value type, non-nullable)

- **Constructor constraint** → `where T : new()`
  (must have a public parameterless constructor)

### Example 1: Multiple constraints

```csharp
// Base entity
public class Entity
{
    public int Id { get; set; }
}

// Example entity
public class Customer : Entity
{
    public string Name { get; set; }
}

// Generic repository
public interface IRepository<T>
{
    void Add(T item);
    T GetById(int id);
}

// Implementation using in-memory storage
public class InMemoryRepository<T> : IRepository<T> where T : Entity, new()
{
    private readonly List<T> _items = new();

    public void Add(T item) => _items.Add(item);

    public T GetById(int id) => _items.FirstOrDefault(x => x.Id == id);
}

// Usage
var customerRepo = new InMemoryRepository<Customer>();
customerRepo.Add(new Customer { Id = 1, Name = "Aman" });
var c = customerRepo.GetById(1);
Console.WriteLine(c.Name); // Aman
```

Here:

- `T` must be `Entity` class or a class inherit from `Entity` (so it has `Id`).
- `T` must implement `IDisposable`.
- `T` must have a parameterless constructor.

### 📌 Example 2: Mixing struct/class constraint

```csharp
public class Cache<T> where T : struct, IComparable
{
    public bool IsDefault(T value) => value.Equals(default(T));
}
```

- `T` must be a value type.
- Must also implement `IComparable`.

So `int`, `DateTime` work ✅, but `string` doesn't ❌ (because `string` is class, not struct).

### 📌 Example 3: Multiple type parameters each with own constraints

```csharp
public class Mapper<TSource, TDestination>
    where TSource : class
    where TDestination : new()
{
    public TDestination Map(TSource source)
    {
        return new TDestination(); // allowed because of new()
    }
}
```

## Generic Method

A generic method declares its own type parameter(s) (like `<T>`) so the method can operate on values of different types
in a type-safe way without casting or boxing.

You can have generic methods inside generic classes or non-generic classes.

**Example:**

Swap two variables:

```csharp
public static void Swap<T>(ref T a, ref T b)
{
    T tmp = a;
    a = b;
    b = tmp;
}
```

## Generic methods with constants

### 1) `Max` with constraint

```csharp
public static T Max<T>(T a, T b) where T : IComparable<T>
{
    return a.CompareTo(b) >= 0 ? a : b;
}
```

### 2) Return object of given parameter type

```csharp
public static T CreateInstance<T>() where T : new()
{
    return new T();
}
```

## Overloading with generics

Generic methods can be overloaded like normal methods; overload resolution considers generic parameter inference and
specificity. Be careful — ambiguous overloads can occur.

### Example

```csharp
public static void Print<T>(T value)
{
    Console.WriteLine($"Generic: {value}");
}

public static void Print(string value)
{
    Console.WriteLine($"String overload: {value}");
}

public static void Print(int value)
{
    Console.WriteLine($"Int overload: {value}");
}

// Calls
Print(10);      // Int overload
Print("hello"); // String overload
Print(3.14);    // Generic overload
```

Here, the compiler prefers the more specific non-generic overloads (`string`, `int`) when they match exactly.
For `3.14`, no specific overload is available, so the generic method is used.

⚠️ If two generic overloads are equally specific, the compiler may not be able to choose one, and the call becomes ambiguous.
