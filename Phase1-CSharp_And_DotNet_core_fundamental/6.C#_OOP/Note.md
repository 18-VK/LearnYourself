# OOP in C#

Object-oriented programming in C# organizes code into classes (blueprints) and objects (instances) to model real-world
entities. A class is a user-defined type that combines data (fields) and behavior (methods) into a single unit. An
object is a concrete instance of a class, holding its own data state and allowing calls to its methods.

## 1. Class and Object

```csharp
// Initialization of an object
using System;

// Class Declaration
public class Dog
{

	// Instance Variables
	String name;
	int age;

	// Constructor Declaration of Class
	// same name as class
	public Dog(String name,int age)
	{
		this.name = name;
		this.age = age;
	}

	public String GetName()
	{
		return name;
	}

	public int GetAge()
	{
		return age;
    }

	public static void Main(String[] args)
	{
		// Creating object
		Dog tuffy = new Dog("tuffy", 5);
		Console.WriteLine(tuffy.GetName());
	}
}
```

## What is a Partial Class?

A partial class in C# allows you to split the definition of a class, struct, interface, or record across multiple files.
At compile time, the compiler combines them into one single class.

### 🔹 Why use Partial Classes?

- **Code organization** → Large classes can be split into smaller files.
- **Team collaboration** → Different developers can work on different parts of the same class without file conflicts.
- **Auto-generated code separation** → Tools (like Visual Studio WinForms/WPF designer, EF Core) often use partial classes
  to generate code separately, while you can safely write your custom logic in another file.

### 🔹 Syntax

```csharp
// File: Person1.cs
public partial class Person
{
    public string FirstName { get; set; }
}

// File: Person2.cs
public partial class Person
{
    public string LastName { get; set; }
    public void ShowName()
    {
        Console.WriteLine($"{FirstName} {LastName}");
    }
}
```

**Usage:**

```csharp
class Program
{
    static void Main()
    {
        var p = new Person { FirstName = "Aman", LastName = "Kumar" };
        p.ShowName(); // Output: Aman Kumar
    }
}
```

✅ Both files define parts of `Person`, but at runtime it's one single class.

### 🔹 Rules for Partial Classes

- Use the `partial` keyword on all parts of the class.
- All parts must be in the same namespace and same assembly.
- Access modifiers must be consistent across parts.
- You can define fields, methods, properties, events, etc. in any part.
- You can also split structs, interfaces, and records using `partial`.
- `partial` classes can have different attributes applied on each part, and the compiler merges them.

## 2. Constructor and destructor

Constructor is a special method of the class which gets automatically invoked whenever an instance of the class
is created. Constructors in C# are fundamental components of object-oriented programming. Like methods, It contains
the collection of instructions that are executed at the time of Object creation. It is used to assign initial values
to the data members of the same class. Some important points about Constructors are mentioned below:

- The constructor of a class must have the same name as the class name in which it resides.
- A class can have any number of constructors.
- A constructor can not be abstract, final, and Synchronized.
- A constructor doesn't have any return type.

### Types of constructor

- **Default Constructor**
- **Parameterized Constructor**
- **Copy Constructor**: A copy constructor is used to create a new object by copying the values from an existing object
  of the same class. Useful when you need to duplicate an object or create a new object based on the state of another.
- **Private Constructor**: If a constructor is created with a private specifier is known as Private Constructor. It is
  not possible for other classes to derive from this class and also it's not possible to create an instance
  of this class. Some important points regarding the topic is mentioned below.

  - It is the implementation of a singleton class pattern.
  - Use a private constructor when we have only static members.
  - Using a private constructor prevents the creation of the instances of that class.

- **Static Constructor**: Static Constructor has to be invoked only once in the class and it has been invoked during the
  creation of the first reference to a static member in the class. A static constructor is initialized static fields or data of the class and is to be executed only once.

  **Points To Remember:**

  - It can't be called directly.
  - When it is executing then the user has no control.
  - It does not take access modifiers or any parameters.
  - It is called automatically to initialize the class before the first instance is created.

### Destructor

Destructors in C# are methods inside the class used to destroy instances of that class when they are no longer needed.

- A Destructor is unique to its class i.e. there cannot be more than one destructor in a class.
- A Destructor has no return type and has exactly the same name as the class name (Including the same case).
- It is distinguished apart from a constructor because of the Tilde symbol (`~`) prefixed to its name.
- A Destructor does not accept any parameters and modifiers.
- It cannot be defined in Structures. It is only used with classes.
- It cannot be overloaded or inherited.
- It is called when the program exits.

> **Note:** In C#, a destructor is automatically called by the Garbage Collector (GC) — but with important details you
> should understand.
> The exact timing is non-deterministic — you don't know when the GC will run.

## Inheritance in C#

Inheritance in C# is a fundamental object-oriented feature that allows a class (the derived or child class) to reuse,
extend, or modify the behavior of another class (the base or parent class). It promotes code reuse, establishes a
natural hierarchy, and enables polymorphism.

### Access Modifiers & Inheritance

| Modifier      | Inherited By Derived? | Visible To Outside?  |
| ------------- | --------------------- | -------------------- |
| **public**    | Yes                   | Yes                  |
| **protected** | Yes                   | No (only in derived) |
| **private**   | No                    | No                   |
| **internal**  | Yes (same assembly)   | Yes (same assembly)  |

### Types of Inheritance in C#

- **Single Inheritance**: A derived class that inherits from only one base class.
- **Multi-level Inheritance**: A derived class that inherits from a base class and the derived class itself becomes the
  base class for another derived class.
- **Hierarchical Inheritance**: A base class that serves as a parent class for two or more derived classes.
- **Multiple Inheritance**: A derived class that inherits from two or more base classes (Using Interface).
- **Hybrid Inheritance**: A Hybrid Inheritance is a mix of two or more inheritances.

> **Note:** No, you cannot override a method unless it is marked as `virtual`, `abstract`, or `override` in the base class.

### Keywords use in Inheritance Context

C# Inheritance Keywords Explained: `virtual`, `override`, `sealed`, `base`

#### 🔹 1. `virtual` – Allow overriding

**Meaning:**

- Declares a method in the base class that can be overridden by a derived class.

**Example:**

```csharp
class Animal
{
    public virtual void Speak()
    {
        Console.WriteLine("Animal speaks");
    }
}
```

#### 🔹 2. `override` – Replace base implementation

**Meaning:**

- Used in a derived class to provide a new implementation for a virtual method.

**Example:**

```csharp
class Dog : Animal
{
    public override void Speak()
    {
        Console.WriteLine("Dog barks");
    }
}
```

**Usage:**

```csharp
Animal animal = new Dog();
animal.Speak();  // Output: Dog barks
```

#### 🔹 3. `sealed` – Prevent further overriding

**Meaning:**

- Prevents further overriding of a method that was overridden in a derived class.

**Example:**

```csharp
class GermanShepherd : Dog
{
    public sealed override void Speak()
    {
        Console.WriteLine("German Shepherd barks loudly");
    }
}
```

Attempting to override it again:

```csharp
class SuperDog : GermanShepherd
{
    // Error: Cannot override sealed method
}
```

#### 🔹 4. `base` – Call base class version

**Meaning:**

- Used to call the base class's version of a method or constructor.

**Example:**

```csharp
class Cat : Animal
{
    public override void Speak()
    {
        base.Speak();  // Output: Animal speaks
        Console.WriteLine("Cat meows");
    }
}
```

#### ✅ Summary Table

| Keyword     | Used In       | Purpose                                         |
|-------------|---------------|--------------------------------------------------|
| virtual     | Base class     | Allows method to be overridden                  |
| override    | Derived class  | Replaces a virtual method from base class       |
| sealed      | Derived class  | Prevents further overriding of an overridden method |
| base        | Derived class  | Access base class method or constructor         |

## Encapsulation in C#

It refers to the concept of hiding internal object details and exposing only what is necessary — a way to protect an
object from unintended interference and misuse.

**Key Concepts of Encapsulation:**

- In encapsulation, the variables or data of a class are hidden from any other class and can be accessed only through
  any member function of its class in which they are declared.
- As the data in a class is hidden from other classes, it is also known as data-hiding.
- Encapsulation can be achieved by declaring all the variables in the class as `private` and using C# Properties in the
  class to set and get the values of the variables.

## Abstraction – "Hiding implementation"

**Definition:**
Abstraction means hiding the internal details and showing only essential features of an object. It focuses on what an object does rather than how it does it.

**Key Features:**

- Achieved through abstract classes and interfaces.
- Forces derived classes to implement abstract members.
- Promotes design flexibility and loosely coupled code.

**Purpose:**

- Reduce complexity.
- Expose only relevant functionality to the user.

## Polymorphism in C#

### 1. Compile-Time Polymorphism (Method Overloading)

Occurs when multiple methods have the same name but different parameters in the same class.

**Example:**

```csharp
public class Printer
{
    public void Print(string message)
    {
        Console.WriteLine(message);
    }

    public void Print(int number)
    {
        Console.WriteLine(number);
    }
}
```

### Operator Overloading

Operator overloading allows a custom class or struct to define how operators such as `+`, `-`, `==`, or `>` work with
its objects. It is another form of compile-time polymorphism.

```csharp
public struct Point
{
    public int X { get; }
    public int Y { get; }

    public Point(int x, int y)
    {
        X = x;
        Y = y;
    }

    public static Point operator +(Point first, Point second)
    {
        return new Point(first.X + second.X, first.Y + second.Y);
    }

    public override string ToString()
    {
        return $"({X}, {Y})";
    }
}
```

Usage:

```csharp
Point point1 = new Point(2, 3);
Point point2 = new Point(4, 5);

Point result = point1 + point2;

Console.WriteLine(result); // (6, 8)
```

The expression `point1 + point2` calls the overloaded `operator +` method defined in `Point`.

### Rules for Operator Overloading

- Operators must be declared `public static`.
- At least one operand must be the containing custom type.
- You cannot create a new operator or change an operator's precedence.
- Some operators must be overloaded in pairs:
  - `==` and `!=`
  - `<` and `>`
  - `<=` and `>=`
  - `true` and `false`
- When overloading `==` and `!=`, also override `Equals()` and `GetHashCode()` so equality behaves consistently.

Example of equality operators:

```csharp
public static bool operator ==(Point first, Point second)
{
    return first.X == second.X && first.Y == second.Y;
}

public static bool operator !=(Point first, Point second)
{
    return !(first == second);
}
```

Operator overloading should be used when the operation is natural and easy to understand. Avoid it when the operator
would make the code surprising or unclear.

### 2. Run-Time Polymorphism (Method Overriding)

Occurs when a derived class overrides a method defined in the base class using the same signature.

**Example:**

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

## Boxing and unboxing

### Boxing

**Definition:** Boxing is the process of converting a value type (like `int`, `struct`, `bool`, etc.) into a reference type
(`object` or `System.ValueType`).

**How it works:** The value is copied from the stack (where value types live) into the heap (where reference types live).

**Syntax:** Implicit conversion (automatic).

```csharp
int num = 10;           // value type (stored on stack)
object obj = num;       // Boxing (num copied into obj on heap)
```

📌 Here, `num` still exists separately on the stack, but now `obj` is a reference to a boxed copy in the heap.

### Unboxing

**Definition:** Unboxing is the reverse process → converting a boxed object back into a value type.

**How it works:** The runtime extracts the value type from the object on the heap and copies it back to the stack.

**Syntax:** Explicit conversion (requires casting).

```csharp
object obj = 20;        // Boxing
int num = (int)obj;     // Unboxing (explicit cast required)
```

📌 If the type doesn't match during unboxing, you'll get an `InvalidCastException`.

## Struct vs Class

**Class** = reference type: stored as an object on the heap; variables hold references; assignment copies the reference;
can be null; supports inheritance.

**Struct** = value type: stored by value (stack or inline inside another object); assignment copies the entire value;
cannot be null (but can be `T?`); cannot inherit from other structs/classes (can implement interfaces).

### Default access specifier

- **class** → default access is `internal`
- **struct** → default access is `internal`
- **class members** → default access is `private`
- **struct members** → default access is `private`

Example:

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

This means that if no access modifier is written, the type itself is `internal` and its members are private unless specified.

### Memory & copying semantics

**class:** `Person a = new Person(); Person b = a;` → `a` and `b` refer to the same object. Mutating via `b.Name = ...` affects `a`.

**struct:** `Point p1 = new Point { X = 1 }; Point p2 = p1;` → `p2` is a copy. Mutating `p2.X` does not change `p1`.

### Boxing / Unboxing

Passing a struct to `object` or to an interface variable causes boxing (a heap allocation). Unboxing copies back.
Boxing breaks the "no-heap" benefit and has performance cost.

**Example:**

```csharp
Point p = new Point { X = 1 };
object o = p;        // boxing: copy of p placed on heap
Point p2 = (Point)o; // unboxing: copy back
```

### Nullability

- **Classes:** can be null (unless non-nullable annotations and compiler check).
- **Structs:** cannot be null by default; use `Nullable<T>` / `T?` to allow null (e.g., `int?`).
