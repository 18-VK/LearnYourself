# Struct vs Class in C#

Both `struct` and `class` can contain fields, properties, methods, constructors, and operators. The main difference is that a struct is a **value type**, while a class is a **reference type**.

## Struct

A struct is a value type. A variable normally contains the value itself, and assigning it creates an independent copy.

```csharp
public struct Point
{
    public int X { get; set; }
    public int Y { get; set; }
}

Point first = new Point { X = 10, Y = 20 };
Point second = first;

second.X = 100;

Console.WriteLine(first.X);  // 10
Console.WriteLine(second.X); // 100
```

Changing `second` does not change `first` because the value was copied.

## Class

A class is a reference type. Assigning a class variable copies the reference to the same object.

```csharp
public class Person
{
    public string Name { get; set; } = string.Empty;
}

Person first = new Person { Name = "Aman" };
Person second = first;

second.Name = "Rahul";

Console.WriteLine(first.Name);  // Rahul
Console.WriteLine(second.Name); // Rahul
```

Both variables refer to the same object, so changing it through either reference is visible through the other.

## Main Differences

| Struct | Class |
|---|---|
| Value type | Reference type |
| Assignment copies the value | Assignment copies the reference |
| Cannot inherit from another class or struct | Can inherit from one base class |
| Can implement interfaces | Can inherit and implement interfaces |
| Does not support class inheritance | Supports inheritance and polymorphism |
| Cannot normally be `null` | Can be `null` |
| Can use `Nullable<T>` or `?` for null | Can use nullable reference type syntax, such as `Person?` |
| Usually best for small data values | Best for objects with identity, behavior, or shared state |
| Has an implicit parameterless initialization | Can define constructors; modern C# also supports parameterless constructors |
| A mutable copy can be easy to misuse | Shared mutable state can be easy to misuse |

## Default Access Modifier

- `class` default access is `internal`
- `struct` default access is `internal`
- Members of a `class` default to `private`
- Members of a `struct` default to `private`

```csharp
class Person
{
    string name;   // private by default
}

struct Point
{
    int x;         // private by default
}
```

If no access modifier is written, the type itself is `internal`, and its members are private by default unless you specify otherwise.

## Memory Behavior

It is common to say that structs are stored on the stack and classes are stored on the heap. This is an oversimplification.

- A struct can be stored inline inside another object, in an array, on the stack, or boxed on the heap.
- A class object is normally allocated on the managed heap, while the variable stores a reference to it.
- The important difference is value semantics versus reference semantics, not simply stack versus heap location.

## Nullability

A normal struct cannot contain `null`:

```csharp
int number = 10;
// number = null; // ❌ Not allowed
```

Use a nullable value type when `null` is required:

```csharp
int? optionalNumber = null;
```

A class reference can be null. With nullable reference types enabled, use `?` to state this explicitly:

```csharp
Person? person = null;
```

## Inheritance

A class can inherit from another class:

```csharp
public class Animal
{
    public virtual void Speak()
    {
        Console.WriteLine("Animal speaks");
    }
}

public class Dog : Animal
{
    public override void Speak()
    {
        Console.WriteLine("Dog barks");
    }
}
```

A struct cannot inherit from another user-defined class or struct. All structs implicitly derive from `System.ValueType`, which derives from `System.Object`.

A struct can implement interfaces:

```csharp
public interface IPrintable
{
    void Print();
}

public struct Report : IPrintable
{
    public void Print()
    {
        Console.WriteLine("Printing report");
    }
}
```

## Boxing and Unboxing

When a struct is assigned to an `object` or interface reference, it is boxed. A copy of the value is placed inside an object on the managed heap.

```csharp
int number = 10;
object boxed = number; // Boxing

int copy = (int)boxed;  // Unboxing
```

Classes do not need boxing when assigned to an `object` reference because they are already reference types.

## When to Use a Struct

Use a struct when the type:

- Represents a small value, such as a point, date, color, or measurement.
- Has value-based equality.
- Is usually immutable.
- Is small enough that copying it is inexpensive.
- Does not need inheritance.

Example:

```csharp
public readonly struct Temperature
{
    public double Celsius { get; }

    public Temperature(double celsius)
    {
        Celsius = celsius;
    }
}
```

`readonly struct` is useful when the value should not change after creation.

## When to Use a Class

Use a class when the type:

- Has a distinct identity.
- Is large or expensive to copy.
- Needs inheritance or polymorphism.
- Has shared mutable state.
- Represents an entity or service.
- Should be passed by reference.

Examples include `Customer`, `Order`, `BankAccount`, and `FileService`.

## Important Struct Behavior

A property or indexer that returns a struct usually returns a copy. Mutating that copy does not update the original value:

```csharp
public class Container
{
    public Point Location { get; set; }
}

var container = new Container
{
    Location = new Point { X = 1, Y = 2 }
};

// container.Location.X = 10; // May fail because Location returns a value copy.

Point location = container.Location;
location.X = 10;
container.Location = location; // Assign the modified copy back.
```

Prefer immutable structs or replace the complete struct value instead of mutating individual members through a property.

## Quick Example

```csharp
Point point1 = new Point { X = 1, Y = 2 };
Point point2 = point1;
point2.X = 10;

Person person1 = new Person { Name = "Aman" };
Person person2 = person1;
person2.Name = "Rahul";

Console.WriteLine(point1.X);  // 1
Console.WriteLine(person1.Name); // Rahul
```

## Interview Questions

### 1. What is the main difference between a struct and a class?

A struct is a value type, while a class is a reference type. Struct assignment copies the value; class assignment copies the reference.

### 2. Are structs always stored on the stack and classes always stored on the heap?

No. Storage depends on context. A struct can be inline inside an object or array, stored on the stack, or boxed on the heap. The key distinction is value semantics versus reference semantics.

### 3. Can a struct inherit from a class or another struct?

No. A struct cannot inherit from user-defined classes or structs. It implicitly derives from `System.ValueType`, but it can implement multiple interfaces.

### 4. Can a class implement an interface?

Yes. A class can inherit from one base class and implement multiple interfaces.

### 5. Can a struct implement an interface?

Yes:

```csharp
public struct Point : IComparable<Point>
{
    public int X { get; set; }
    public int Y { get; set; }

    public int CompareTo(Point other)
    {
        return X.CompareTo(other.X);
    }
}
```

### 6. Can a struct contain methods, properties, and constructors?

Yes. A struct can contain fields, properties, methods, constructors, events, and operators.

### 7. Can a struct have a parameterless constructor?

Modern C# allows a struct to declare a parameterless constructor. Structs also have a default initialization in which fields receive their default values.

```csharp
public struct Counter
{
    public int Value { get; }

    public Counter()
    {
        Value = 10;
    }
}
```

### 8. Can a struct be null?

A normal struct cannot be null. Use a nullable value type:

```csharp
Point? point = null;
```

### 9. What happens when a class object is assigned to another variable?

The reference is copied. Both variables refer to the same object.

### 10. What happens when a struct is assigned to another variable?

The value is copied. The two variables are independent values.

### 11. What is boxing?

Boxing converts a value type into an `object` or interface reference by wrapping a copy of the value in an object.

```csharp
int number = 10;
object value = number;
```

### 12. Why are structs usually recommended to be immutable?

Because structs are copied by value. Mutable structs can lead to accidental modifications of a copy rather than the original value, especially when returned from properties or collections.

### 13. When should you choose a class instead of a struct?

Choose a class when the type is large, needs inheritance, has identity, requires shared state, or is expensive to copy.

### 14. When should you choose a struct instead of a class?

Choose a struct for a small, value-like type that is usually immutable and does not require inheritance.

### 15. What is the difference between `Equals()` for classes and structs?

Classes use reference equality by default unless equality is overridden. Structs inherit value-based equality behavior, comparing their fields by default, although implementing explicit equality can make the intended behavior clearer and more efficient.
