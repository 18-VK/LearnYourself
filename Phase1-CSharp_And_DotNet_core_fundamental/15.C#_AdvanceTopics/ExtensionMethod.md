# Extension method

An extension method is a static method in a static class whose first parameter is prefixed with `this` — that parameter
is the type you're extending. It lets you call the method like an instance method: `myObj.MyExt()`.

An extension method lets you "add" new methods to existing types without modifying their source code or using
inheritance.

- They are static methods in a static class.
- They use the `this` keyword before the first parameter to "attach" to a type.

## Uses of Extension Methods

### 1. Add methods to built-in types

You can extend `string`, `int`, `DateTime`, etc., with custom logic.

**Example:**

```csharp
public static class StringExtensions
{
    public static bool IsNullOrEmpty(this string s)
        => string.IsNullOrEmpty(s);

    public static string FirstLetterUpper(this string s)
        => string.IsNullOrEmpty(s) ? s : char.ToUpper(s[0]) + s.Substring(1);
}

class Program
{
    static void Main()
    {
        string text = "hello";
        Console.WriteLine(text.FirstLetterUpper()); // Hello
        Console.WriteLine(text.IsNullOrEmpty());    // False
    }
}
```

### 2. Work with Interfaces without modifying implementations

You can add functionality to all classes implementing an interface without touching them.

```csharp
public interface IEntity
{
    int Id { get; }
}

public class Customer : IEntity { public int Id { get; set; } }

public static class EntityExtensions
{
    public static bool IsValidId(this IEntity entity)
        => entity.Id > 0;
}

class Program
{
    static void Main()
    {
        var c = new Customer { Id = 5 };
        Console.WriteLine(c.IsValidId()); // True
    }
}
```

### ✅ Use-case: Enrich interfaces without changing all implementations

**Add Missing Functionality to Framework Classes**

If a library type doesn't have what you need, you extend it.

```csharp
public static class DateTimeExtensions
{
    public static int Age(this DateTime dob)
    {
        var today = DateTime.Today;
        int age = today.Year - dob.Year;
        if (dob.Date > today.AddYears(-age)) age--;
        return age;
    }
}

class Program
{
    static void Main()
    {
        DateTime dob = new DateTime(2000, 1, 1);
        Console.WriteLine(dob.Age()); // Person's age
    }
}
```

✅ **Use-case:** Business-specific utility methods.

## Rules (must-knows)

- Defined in a static class and must be static methods.
- First parameter: `this TypeName name` — the type being extended.
- You must `using` the namespace that contains the static class for the method to appear in IntelliSense.
- If the type already has an instance method with the same signature, the instance method wins.
- Resolved at compile time — no virtual dispatch.
- You can call an extension method like a static method: `MyExtensions.MyMethod(obj)`.

**Explaining this:** If the type already has an instance method with the same signature, the instance method wins.

```csharp
using System;

public class Person
{
    public string Name { get; set; }

    // Instance method
    public void Print()
    {
        Console.WriteLine($"Instance Print: {Name}");
    }
}

// Extension method
public static class PersonExtensions
{
    public static void Print(this Person p)
    {
        Console.WriteLine($"Extension Print: {p.Name}");
    }
}

class Program
{
    static void Main()
    {
        var p = new Person { Name = "Aman" };

        // Which Print is called?
        p.Print(); // ✅ Instance Print: Aman
    }
}
```
