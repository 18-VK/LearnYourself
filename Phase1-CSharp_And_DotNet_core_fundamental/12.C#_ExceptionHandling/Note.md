# Exception Handling in C#

**Example:**

```csharp
using System;

class BasicExample
{
    static void Main()
    {
        try
        {
            Console.WriteLine("Before exception");
            int x = int.Parse("not-a-number"); // throws FormatException
            Console.WriteLine("This line will NOT run");
        }
        catch (FormatException ex)
        {
            Console.WriteLine("Caught FormatException: " + ex.Message);
        }
        catch (Exception ex) // fallback for unexpected exceptions
        {
            Console.WriteLine("General error: " + ex.Message);
        }
        finally
        {
            // Runs whether or not an exception was thrown
            Console.WriteLine("Finally block: cleanup here");
        }
    }
}
```

> **Note:** we can have multiple Catch blocks

## Re-Throwing exceptions

**Example:**

```csharp
using System;

class Program
{
    static void Main()
    {
        try
        {
            ProcessData();
        }
        catch (Exception ex)
        {
            Console.WriteLine("Exception caught in Main: " + ex.Message);
        }
    }

    static void ProcessData()
    {
        try
        {
            int[] numbers = { 1, 2, 3 };
            Console.WriteLine(numbers[5]); // This will throw IndexOutOfRangeException
        }
        catch (Exception ex)
        {
            Console.WriteLine("Exception caught in ProcessData: " + ex.Message);
            throw; // Re-throws the same exception
        }
    }
}
```

**What's Happening Here:**

- `numbers[5]` causes an `IndexOutOfRangeException`.
- The catch block in `ProcessData()` catches it, logs a message, and then re-throws the exception using `throw;`.
- The exception is then caught again in `Main()`, where it's logged once more.

### ⚠️ Why Use `throw;` Instead of `throw ex;`

- `throw;` keeps the original stack trace, which helps you trace the error back to its origin.
- `throw ex;` resets the stack trace to the current method, which can obscure the real source of the problem.

## Exception filters (`when`)

Instead of catching and inspecting inside the catch, use `when` for clearer intent.

```csharp
try
{
    // ...
}
catch (Exception ex) when (ex is InvalidOperationException || ex is FormatException)
{
    Console.WriteLine("Either InvalidOperation or Format occurred: " + ex.Message);
}
```

## Custom error

```csharp
void SetAge(int age)
{
    if (age < 0 || age > 120)
        throw new ArgumentOutOfRangeException(nameof(age), "Age must be between 0 and 120.");
}
```

> **Note:** `nameof(x)` → returns the identifier name of `x` as a string (not the value).

## Custom exception

### Step 1: Create a Custom Exception

A custom exception is just a class that inherits from `Exception`.

```csharp
using System;

public class InsufficientFundsException : Exception
{
    // Default constructor
    public InsufficientFundsException() 
    {
    }

    // Constructor that takes a message
    public InsufficientFundsException(string message) 
        : base(message) 
    {
    }

    // Constructor that takes a message and inner exception
    public InsufficientFundsException(string message, Exception inner) 
        : base(message, inner) 
    {
    }
}
```

### 🔹 Step 2: Throw the Custom Exception

You throw it just like any other exception using the `throw` keyword.

```csharp
public class BankAccount
{
    private decimal balance;

    public BankAccount(decimal initialBalance)
    {
        balance = initialBalance;
    }

    public void Withdraw(decimal amount)
    {
        if (amount > balance)
        {
            throw new InsufficientFundsException(
                $"Cannot withdraw {amount}. Available balance is {balance}.");
        }

        balance -= amount;
        Console.WriteLine($"Withdrawal successful! Remaining balance: {balance}");
    }
}
```

### 🔹 Step 3: Catch and Handle the Custom Exception

You handle it in a `try-catch` block just like built-in exceptions.

```csharp
class Program
{
    static void Main()
    {
        BankAccount account = new BankAccount(500);

        try
        {
            account.Withdraw(700); // Will throw custom exception
        }
        catch (InsufficientFundsException ex)
        {
            Console.WriteLine($"Custom Exception Caught: {ex.Message}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"General Exception: {ex.Message}");
        }
    }
}
```

```csharp
public InsufficientFundsException(string message, Exception inner) 
    : base(message, inner) 
{
}
```

### 🔹 Why do we need inner exception?

Sometimes one exception is caused by another exception.
Instead of losing the original error details, we "wrap" it inside a custom exception.

👉 This is called **exception chaining**.

### 🔹 Example Inner Exception

```csharp
try
{
    int x = int.Parse("abc"); // FormatException will occur
}
catch (FormatException ex)
{
    throw new InsufficientFundsException("Something went wrong!", ex);
}
```

Here:

- `FormatException` is the root cause.
- We wrap it inside our `InsufficientFundsException` with extra context.
