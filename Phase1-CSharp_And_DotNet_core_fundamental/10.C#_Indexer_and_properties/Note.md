# Indexer and Properties in C#

## Indexer in C#

An indexer in C# is a special kind of property that allows you to access an object's data like an array, using the `[]`
index syntax.

In C#, an indexer allows an instance of a class or struct to be indexed as an array. When an indexer is defined for a
class, then that class will behave like a virtual array. Array access operator i.e. (`[ ]`) is used to access the
instance of the class which uses an indexer.

It's often used when your class or struct represents a collection or list of items, but you want to provide a cleaner,
array-like way to access those items without explicitly exposing the internal data structure.

**Example:**

```csharp
class MyCollection
{
    private string[] data = new string[5];

    // Indexer declaration
    public string this[int index]
    {
        get { return data[index]; }  // Get accessor
        set { data[index] = value; } // Set accessor
    }

    // Indexer overloading
    public string this[int index, Bool append]
    {
        get { 
            if(append)
                return data[index] + ":val";
            Else
                return data[index];
            
        }  // Get accessor
        set { 
            data[index] = value;
        } // Set accessor
    }
}

class Program
{
    static void Main()
    {
        MyCollection collection = new MyCollection();

        // Using indexer like an array
        collection[0] = "Hello";
        collection[1] = "World";

        Console.WriteLine(collection[0]); // Output: Hello
        Console.WriteLine(collection[1]); // Output: World
    }
}
```

### Key points

- Declared using `this[parameterType index]`.
- Can have `get` and/or `set` accessors.
- Can be overloaded (different parameter lists).
- Does not have a name — accessed with `[]` directly on the object.
- Useful when your class represents a collection, container, or data structure.

## Properties in C#

Properties are the special types of class members that provide a flexible mechanism to read, write, or compute the
value of a private field.

Properties also support encapsulation and abstraction through `get` and `set` methods for accessing and modifying them. There are two main reasons to use properties:

- To access private data members of the class from another class throw accessors.
- To protect members of the class so another class may not misuse those members.

**Accessors:** The block of `set` and `get` is known as Accessors. It is very essential to restrict the accessibility of
the property. There are two types of accessors i.e. get accessors and set accessors.

**Syntax:**

```csharp
// Demonstrating a Read-Write Property
using System;

public class Geeks
{
    private int r; 

    // Read-Write Property
    public int RollNo
    {
        get { 
          return r; 
        }
        set { 
          r = value; 
        }
    }

    public Geeks(int r)
    {
        this.RollNo = r;
    }
}

class MainClass
{
    public static void Main(string[] args)
    {
        Geeks o = new Geeks(147);
        Console.WriteLine($"Current Roll No: {o.RollNo}");

        // Modify RollNo using setter
        o.RollNo = 357;
        Console.WriteLine($"Changed Roll No: {o.RollNo}");
    }
}
```

### Key points

- The property itself can have one access modifier (`public`, `private`, `protected`, etc.).
  `get` and `set` can have different access levels.

  **e.g.:**

  ```csharp
  public int Age { get; private set; } // ✅ Read public, write private
  ```

- **Static and Abstract Restrictions**

  A property can be `static`, `abstract`, `virtual`, `override`, or `sealed` depending on the class context.
  `abstract` properties cannot have a body for `get` or `set` — must be implemented in derived classes.

  **e.g.:**

  ```csharp
  public abstract int Age { get; set; } // no body here
  ```

  An abstract property is a contract. It tells every derived class that the property must exist, but it does not
  define how the property stores or calculates its value. Therefore, an abstract property must be declared inside an
  abstract class or interface.

  ```csharp
  public abstract class Person
  {
      public abstract int Age { get; set; }
  }

  // Person person = new Person(); // ❌ Cannot create an abstract class
  ```

  A derived class must implement the property with the `override` keyword:

  ```csharp
  public class Student : Person
  {
      private int age;

      public override int Age
      {
          get { return age; }
          set
          {
              if (value < 0)
                  throw new ArgumentException("Age cannot be negative");

              age = value;
          }
      }
  }

  Person student = new Student();
  student.Age = 20;
  Console.WriteLine(student.Age); // 20
  ```

  If a derived class does not implement every inherited abstract property, that derived class must also be declared
  `abstract`.

  ### Property Modifier Summary

  - `static`: belongs to the class rather than to an object. It cannot be `abstract`, `virtual`, or `override`.
  - `virtual`: provides a default implementation that a derived class may replace.
  - `abstract`: provides no implementation; a non-abstract derived class must implement it.
  - `override`: provides the implementation of an inherited `abstract` or `virtual` property.
  - `sealed`: prevents further derived classes from overriding an already overridden property.

  ```csharp
  public class Base
  {
      public virtual int Value { get; set; }
  }

  public class Middle : Base
  {
      public sealed override int Value { get; set; }
  }

  // A class derived from Middle cannot override Value.
  ```

  ### Abstract Class and Interface Members

  An abstract class does not have to implement an interface member immediately. It can declare the member as
  abstract and allow a concrete derived class to implement it.

  ```csharp
  public interface IWorker
  {
      void Work();
  }

  public abstract class Employee : IWorker
  {
      public abstract void Work();
  }

  public class Developer : Employee
  {
      public override void Work()
      {
          Console.WriteLine("Developer is working");
      }
  }
  ```

  An abstract class can also provide the implementation itself. Derived classes can then reuse that implementation:

  ```csharp
  public abstract class Manager : IWorker
  {
      public void Work()
      {
          Console.WriteLine("Manager is working");
      }
  }
  ```

  A concrete class must implement all interface members. An abstract class may implement them, declare them abstract,
  or defer them to a later derived class.

### Restrictions on properties

**1) A property is restricted from being passed via the `ref` or `out` parameter to a method.** Properties are methods and both
`ref` and `out` are not considered part of the method signature at the time of compilation.

In C#, a property is not like a field — under the hood, it's actually two methods:

- `get_PropertyName()` → called when you read it.
- `set_PropertyName(value)` → called when you write to it.

When you pass something as `ref` or `out`, the method needs the actual storage location (memory address) of the variable,
not a copy of its value.
Since a property doesn't have a variable name you can reference directly (only hidden backing fields), you can't pass
it by `ref` or `out`.

**2) Overloading:**
C# does not allow overloading of properties. Each property can have only one `get` and one `set` accessor. If we attempt
to define multiple accessors with the same name, it will lead to a compilation error.

### Init-Only Properties (C# 9+)

Value can be set at object initialization only, not modified later.

```csharp
public class Student
{
    public string Name { get; init; }
    public int RollNo { get; init; }
}

var s = new Student { Name = "Aman", RollNo = 101 };
// s.Name = "Raj"; ❌ Not allowed
```

### ✅ 2.4 Properties with Validation (Custom Logic)

You can use a backing field and add logic.

```csharp
public class BankAccount
{
    private decimal balance;

    public decimal Balance
    {
        get => balance;
        set
        {
            if (value < 0)
                throw new ArgumentException("Balance cannot be negative");
            balance = value;
        }
    }
}
```
