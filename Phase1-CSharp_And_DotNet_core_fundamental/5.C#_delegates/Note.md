# Delegate in C#

A delegate is a type that represents references to methods with a specific parameter list and return type. You can
use it to pass methods as arguments or call methods asynchronously.
Think of a delegate as a type-safe function pointer.

## Why Use Delegates?

- To pass methods as parameters to other methods
- To implement callback mechanisms
- Used in events and event handling
- Support for multicasting (invoking multiple methods)

## Declaring and Using a Delegate

### ✅ Step 1: Declare a delegate

**e.g.:**

```csharp
public delegate void GreetDelegate(string name); // method signature 
```

### ✅ Step 2: Create a method matching the delegate signature

**e.g.:**

```csharp
public class Greeter
{
    public void SayHello(string name)
    {
        Console.WriteLine("Hello, " + name);
    }
}
```

### ✅ Step 3: Use the delegate

**e.g.:**

```csharp
class Program
{
    static void Main()
    {
        Greeter greeter = new Greeter();
        GreetDelegate del = new GreetDelegate(greeter.SayHello);
        del("Aman");
    }
}
```

or we can simple write as:

```csharp
// declaration of delegate
delegate public void DelegateSayHello(string msg);

//Creaing function and assigning it to delegate object
DelegateSayHello PrintMsg = (string msg) => 
{
    Console.WriteLine(msg);
}
```

## Types of Delegates

### 1. Single-cast delegate

Points to only one method.

### 2. Multicast delegate

Can point to multiple methods, called in order.

**e.g.:**

```csharp
public delegate void Notify();

public class Alerts
{
    public void SendEmail() => Console.WriteLine("Email sent");
    public void SendSMS() => Console.WriteLine("SMS sent");
}

class Program
{
    static void Main()
    {
        Alerts alerts = new Alerts();
        Notify notify = alerts.SendEmail;
        notify += alerts.SendSMS;

        notify(); // Calls both methods
    }
}
```

> **Note:** every method should has same method signature

## Built-in delegate types

- **`Action<...>`** — represents a method that returns `void`. The generic type parameters (0..16) are the parameter types.
  Example: `Action<int,string>` → method `(int, string) => void`.

- **`Func<..., TResult>`** — represents a method that returns a value. The last generic parameter is the return type;
  any earlier ones are argument types.
  Example: `Func<int,int,string>` → method `(int, int) => string`.

- **`Predicate<T>`** — shorthand for `Func<T,bool>`: takes one `T` and returns `bool`. Used for tests/filters.
  Equivalent signature: `bool Predicate<T>(T obj)`.

**Example:**

```csharp
// Action: no return
Action<string> greet = name => Console.WriteLine($"Hello, {name}!");
greet("Aman"); // prints Hello, Aman!

// Func: returns value (last type is return type)
Func<int,int,int> add = (a,b) => a + b;
int sum = add(3,4); // 7

// Predicate: returns bool (same as Func<T,bool>)
Predicate<int> isEven = x => x % 2 == 0;
bool r = isEven(10); // true
```

## Func vs Action

### 1. Definitions (core difference)

**`Func<bool>`**

- Takes no parameters
- Returns a `bool`
- Represents a question / condition

**`Action<bool>`**

- Takes one `bool` parameter
- Returns nothing (`void`)
- Represents an operation / instruction

## Multicast behavior (`+=` / `-=`)

`Action` and `Predicate`/`Func` are multicast-capable (you can `+=` multiple handlers).

- For `Action` (void) all handlers are invoked in order.
- For `Func` with return value and multiple handlers: all are invoked, but only the last return value is provided to the caller. This makes multicast `Func`
  rarely useful for combining results.
- If any handler throws, invocation stops and exception propagates.

**Example:**

```csharp
Action a = () => Console.WriteLine("A");
a += () => Console.WriteLine("B");
a(); // prints A then B
```

## Anonymous Method in C#

An anonymous method is a method which doesn't contain any name which is introduced in C# 2.0. It is useful when the
user wants to create an inline method and also wants to pass parameter in the anonymous method like other methods. An
Anonymous method is defined using the `delegate` keyword and the user can assign this method to a variable of the
delegate type.

```csharp
class GFG {

    public delegate void petanim(string pet);

    // Main method
    static public void Main()
    {

        // An anonymous method with one parameter
        petanim p = delegate(string mypet)
        {
            Console.WriteLine("My favorite pet is: {0}",
                                                 mypet);
        };
        p("Dog");
    }
}
```

## Callback in C#

A callback is a method you pass to another method so the callee can call it later (synchronously or asynchronously). In C# callbacks are most commonly implemented with delegates, `Action`/`Func`, or events.

### 1) Basic delegate callback

```csharp
using System;

delegate void ResultCallback(int result);

class Program
{
    static void Main()
    {
        DoWork(5, PrintResult);
    }

    static void DoWork(int x, ResultCallback callback)
    {
        int result = x * 2;       // do some work
        callback(result);         // call back
    }

    static void PrintResult(int r) => Console.WriteLine($"Result: {r}");
}
```

### 2) Using built-in `Action` / `Func` (preferred)

```csharp
using System;

class Program
{
    static void Main()
    {
        DoWork(3, r => Console.WriteLine($"Got: {r}")); // lambda callback
        DoWork(3,PrintResult); // function callback
    }
    
    static void PrintResult(int r)
    {
        Console.WriteLine($"Got: {r}");
    }
    static void DoWork(int x, Action<int> callback)
    {
        var result = x + 10;
        callback?.Invoke(result);   // null-safe invoke
    }
}
```

> **Note:** Delegates must be declared inside a class/struct/namespace, but outside a method.
