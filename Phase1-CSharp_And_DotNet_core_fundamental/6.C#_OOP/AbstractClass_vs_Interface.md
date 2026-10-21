# Abstract Class vs Interface

Both abstract classes and interfaces define contracts for other classes, but they are used in different situations.

## Abstract Class

An abstract class can contain:

- Abstract methods and properties without implementation
- Concrete methods with implementation
- Fields
- Constructors
- Properties
- Different access modifiers

```csharp
public abstract class Animal
{
    public string Name { get; }

    protected Animal(string name)
    {
        Name = name;
    }

    public abstract void MakeSound();

    public void Sleep()
    {
        Console.WriteLine($"{Name} is sleeping");
    }
}

public class Dog : Animal
{
    public Dog(string name) : base(name)
    {
    }

    public override void MakeSound()
    {
        Console.WriteLine("Bark");
    }
}
```

An abstract class cannot be instantiated directly:

```csharp
// Animal animal = new Animal("Animal"); // ❌ Not allowed
```

Instead, create an object of a concrete derived class:

```csharp
Animal animal = new Dog("Bruno");

animal.MakeSound(); // Bark
animal.Sleep();     // Bruno is sleeping
```

The reference type is `Animal`, but the actual object is `Dog`.

## Interface

An interface mainly defines a contract that a class must implement:

```csharp
public interface IPrintable
{
    void Print();
}

public class Report : IPrintable
{
    public void Print()
    {
        Console.WriteLine("Printing report");
    }
}
```

An interface cannot be instantiated directly:

```csharp
// IPrintable printable = new IPrintable(); // ❌ Not allowed
```

Create an object of the implementing class:

```csharp
IPrintable printable = new Report();

printable.Print();
```

A class can implement multiple interfaces:

```csharp
public class Report : IPrintable, IDisposable
{
    public void Print()
    {
        Console.WriteLine("Printing report");
    }

    public void Dispose()
    {
        Console.WriteLine("Disposed");
    }
}
```

## Main Differences

| Abstract class | Interface |
|---|---|
| Cannot be instantiated | Cannot be instantiated |
| A class can inherit only one class | A class can implement multiple interfaces |
| Can contain fields and constructors | Primarily defines a contract |
| Can contain implemented methods | Can contain default methods in modern C# |
| Members can use access modifiers | Interface members are generally public |
| Useful for closely related classes | Useful for unrelated classes sharing behavior |
| Can hold shared state | Usually does not hold instance state |

## When to Use

Use an **abstract class** when classes have a strong parent-child relationship and need shared code or state:

```csharp
public abstract class Vehicle
{
    public int Speed { get; set; }

    public void Stop()
    {
        Speed = 0;
    }

    public abstract void Move();
}
```

Use an **interface** when different classes need to follow the same capability:

```csharp
public interface IPayment
{
    void Pay();
}

public class CreditCardPayment : IPayment
{
    public void Pay() => Console.WriteLine("Paid by card");
}

public class CashPayment : IPayment
{
    public void Pay() => Console.WriteLine("Paid by cash");
}
```

## Can an Abstract Class Inherit a Class?

Yes. An abstract class can inherit either a concrete class or another abstract class.

### Abstract Class Inheriting a Concrete Class

```csharp
public class Vehicle
{
    public void Start()
    {
        Console.WriteLine("Vehicle started");
    }
}

public abstract class Car : Vehicle
{
    public abstract void Drive();
}
```

`Car` inherits the implemented `Start()` method from `Vehicle` and declares its own abstract `Drive()` method.

### Abstract Class Inheriting Another Abstract Class

```csharp
public abstract class Animal
{
    public abstract void MakeSound();
}

public abstract class Pet : Animal
{
    public abstract void Play();
}
```

`Pet` does not have to implement `MakeSound()` because `Pet` is also abstract. A concrete class must implement all
inherited abstract members:

```csharp
public class Dog : Pet
{
    public override void MakeSound()
    {
        Console.WriteLine("Bark");
    }

    public override void Play()
    {
        Console.WriteLine("Dog is playing");
    }
}
```

C# supports inheriting from only one class, but a class can implement multiple interfaces:

```csharp
public abstract class Employee : Person, IWorker, IDisposable
{
    // One base class, multiple interfaces
}
```

## Object Creation

Neither an abstract class nor an interface can be instantiated directly. An object must be created from a concrete class.

```csharp
// Animal animal = new Animal("Bruno"); // ❌ Abstract class cannot be instantiated
// IPrintable item = new IPrintable();  // ❌ Interface cannot be instantiated

Animal animal = new Dog("Bruno");
IPrintable item = new Report();
```

This is useful because code can depend on the abstraction while the concrete implementation can vary:

```csharp
Animal animal = new Dog("Bruno");
IPrintable item = new Report();
```

## Common Interview Questions

### 1. Can we create an object of an abstract class?

No. However, we can create a derived-class object and store it in an abstract-class reference:

```csharp
Animal animal = new Dog("Bruno");
```

### 2. Can we create an object of an interface?

No. Use an implementing class:

```csharp
IPrintable item = new Report();
```

### 3. Can an abstract class inherit another class?

Yes. It can inherit from one concrete or abstract class. It can also implement multiple interfaces.

```csharp
public abstract class Employee : Person, IWorker, IDisposable
{
}
```

### 4. Can an abstract class have a constructor?

Yes. Its constructor runs when a derived-class object is created:

```csharp
public abstract class Base
{
    protected Base()
    {
        Console.WriteLine("Base constructor");
    }
}
```

### 5. Can an abstract class contain non-abstract methods?

Yes:

```csharp
public abstract class Shape
{
    public abstract double Area();

    public void Display()
    {
        Console.WriteLine("This is a shape");
    }
}
```

### 6. Can an abstract class inherit an interface?

Yes:

```csharp
public interface IWorker
{
    void Work();
}

public abstract class Employee : IWorker
{
    public abstract void Work();
}
```

### 7. Can a class inherit multiple abstract classes?

No. C# supports single class inheritance:

```csharp
// public class C : A, B // ❌ Not allowed if A and B are classes
```

### 8. Can a class implement multiple interfaces?

Yes:

```csharp
public class Printer : IPrintable, IDisposable
{
    public void Print() { }
    public void Dispose() { }
}
```

### 9. Can an interface contain implementation?

Modern C# interfaces can contain default method implementations, but interfaces are still primarily used to define contracts:

```csharp
public interface ILogger
{
    void Log(string message)
    {
        Console.WriteLine(message);
    }
}
```

### 10. Abstract class or interface: which should you choose?

- Choose an abstract class when you need shared code, fields, constructors, or state.
- Choose an interface when you need a common capability across different types.
- Choose an interface when a class must support multiple contracts.
- Use an abstract class when the types have a strong parent-child relationship.
