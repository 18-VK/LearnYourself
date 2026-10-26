# Tuple in C#

A Tuple is a data structure in C# that allows you to store a group of related values in a single object, even if those
values are of different types.
Think of a Tuple as a lightweight container for multiple values.

## Why Use a Tuple?

| Reason                  | Description                                                                      |
| ----------------------- | -------------------------------------------------------------------------------- |
| ✅ Group Multiple Values | You can return multiple values from a method without creating a class or struct. |
| ✅ Lightweight           | No need to define a separate class/struct for simple groupings.                  |
| ✅ Readability           | Better than using out/ref parameters.                                            |
| ✅ Type Safety           | All elements are strongly typed.                                                 |
| ✅ Quick Prototyping     | Helpful in writing small helper methods or temporary structures.                 |

## Creating Tuples

### ✅ Before C# 7.0 (Old Style)

```csharp
Tuple<int, string> person = new Tuple<int, string>(1, "Aman");
Console.WriteLine(person.Item1);  // 1
Console.WriteLine(person.Item2);  // Aman
```

### ✅ C# 7.0+ (Modern, Recommended Style — with named elements)

```csharp
var person = (Id: 1, Name: "Aman");
Console.WriteLine(person.Id);    // 1
Console.WriteLine(person.Name);  // Aman
```

## Accessing Tuple Elements

- **Old style:** `.Item1`, `.Item2`, etc.
- **Modern style:** Named properties like `.Id`, `.Name`, etc. (if declared with names).

## Tuple as arguments

```csharp
static void PrintTheTuple(Tuple<string, int, double> mytuple)
{
    Console.WriteLine("Element: " + mytuple.Item1);
    Console.WriteLine("Element: " + mytuple.Item2);
    Console.WriteLine("Element: " + mytuple.Item3);
}
```

or

```csharp
static void PrintTheTuple((string ele1, int age, double weight) mytuple)
{
    Console.WriteLine("Element: " + mytuple.ele1);
    Console.WriteLine("Element: " + mytuple.age);
    Console.WriteLine("Element: " + mytuple.weight);
}
```

or

```csharp
static void PrintTheTuple((string,int, double) mytuple)
{
    Console.WriteLine("Element: " + mytuple.Item1);
    Console.WriteLine("Element: " + mytuple.Item2);
    Console.WriteLine("Element: " + mytuple.Item3);
}
```

## Returning Multiple Values from a Method

```csharp
(string Name, int Age) GetPerson()
{
    return ("Aman", 25);
}
```

or

```csharp
Tuple<string,int> GetPerson()
{
    return ("Aman", 25);
}
```

```csharp
// calling It
var retvalue = GetPerson();
retvalue.Item1 or retvalue.Name
```

## Nested Tuples

**Example:**

```csharp
var nestedTuple = (1, "Aman", (85, "Math"));

Console.WriteLine(nestedTuple.Item1);  // 1
Console.WriteLine(nestedTuple.Item2);  // Aman
Console.WriteLine(nestedTuple.Item3.Item1);  // 85
Console.WriteLine(nestedTuple.Item3.Item2);  // Math
```

> **Note:** In C#, tuples have a maximum direct capacity of 8 elements. However, if you want to store more than 7 values,
> the 8th element itself must be a nested tuple.
