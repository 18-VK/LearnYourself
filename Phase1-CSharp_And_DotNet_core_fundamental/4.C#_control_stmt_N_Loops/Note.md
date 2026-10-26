# Control Statements and Loops in C#

## Conditional Statements of C#

There are few conditional statements of C# is mentioned below:

### `if`

**e.g.:**

```csharp
if(i==0)
{
    //code block
}
```

### `if-else`

**e.g.:**

```csharp
if(i==0)
{
    //code block
}
else
{
    //code block
}
```

### `if-else-if`

**e.g.:**

```csharp
if(i==0)
{
    //code block
}
elseif(i >=1)
{
    //code block
}
else
{
    //code block
}
```

### Nested `if`

**e.g.:**

```csharp
if(i==0)
{
    //code block
}
else
{
    //code block
}
```

### `Switch`

**e.g.:**

```csharp
switch(Expression)
{
    case value1 :
        break;
    case value2
        break;
    case value3
        break;
    default:
        break;
}
```

### Nested `Switch`

**e.g.:**

```csharp
switch(outter){
    case 1:
        Console.WriteLine("Outter Case 1");
        break;
    case 2:
        Console.WriteLine("Outter Case 2");
        switch(inner)
        {
            case 1:
                Console.WriteLine("Inner Case 1");
                break;
            case 2:
                Console.WriteLine("Inner Case 2");
                break;
            case 3:
                Console.WriteLine("Inner Case 3");
                break;
            default:
                Console.WriteLine("Default Inner Run");
                break;
        }
        break;
    default:
        Console.WriteLine("Default Outter Run");
        break;
}
```

## Loops in C#

### Types of Loops in C#

Loops are mainly divided into two categories:

- **Entry Controlled Loops** — e.g.: `for`, `while`
- **Exit Controlled Loops** — e.g.: `do-while`

### 1. `for` Loop

- **Syntax:** `for(initialization; condition; increment) { ... }`
- **Use Case:** When the number of iterations is known.
- **Example:**

  ```csharp
  for (int i = 0; i < 5; i++) {
      Console.WriteLine(i);
  }
  ```

### 2. `while` Loop

- **Syntax:** `while(condition) { ... }`
- **Use Case:** When the number of iterations is unknown.
- **Example:**

  ```csharp
  int i = 0;
  while (i < 5) {
      Console.WriteLine(i);
      i++;
  }
  ```

### 3. `do-while` Loop

- **Syntax:** `do { ... } while(condition);`
- **Use Case:** When the loop must execute at least once.
- **Example:**

  ```csharp
  int i = 0;
  do {
      Console.WriteLine(i);
      i++;
  } while (i < 5);
  ```

### 4. `foreach` Loop

- **Syntax:** `foreach(type item in collection) { ... }`
- **Use Case:** To iterate over collections (arrays, lists, etc.)
- **Example:**

  ```csharp
  string[] names = { "Alice", "Bob" };
  foreach (string name in names) {
      Console.WriteLine(name);
  }
  ```

### 5. `break` and `continue` (Control Statements)

- **`break`**: Exits the loop early.
- **`continue`**: Skips the current iteration.

**Example with `break` and `continue`:**

```csharp
for (int i = 0; i < 5; i++) {
    if (i == 2) continue;
    if (i == 4) break;
    Console.WriteLine(i);
}
```

> **Note:** C# does not have a "for-in" loop like some other languages.
> Use `foreach (var item in collection)` instead.

## C# Jump Statements

In C#, Jump statements are used to transfer control from one point to another point in the program due to some
specified code while executing the program.

### Types of Jump Statements

There are mainly five keywords in the Jump Statements which are mentioned below:

- **`break`**: The break statement is used to terminate the loop or statement in which it is present.
- **`continue`**: continue statement used to skip over the execution part of the loop on a certain condition.
- **`goto`**: Goto statement is used to transfer control to the labeled statement. The label is the valid identifier and
  is placed just before the statement from where the control is transferred.

  **e.g.:**

  ```csharp
  switch (number) 
  {
      case 5:
          Console.WriteLine("case 5");
          break;
      case 10:
          Console.WriteLine("case 10");
          break;
      case 20:
          Console.WriteLine("case 20");

          // goto statement transfers 
          // control to case 5
          goto case 5;

      default:
          Console.WriteLine("No match found");
          break; 
  }
  ```

- **`return`**: This statement terminates the execution of the method and returns the control to the calling method. It returns
  an optional value.
- **`throw`**: throw statement is used to raise exceptions in C#. When an error occurs or a specific condition is met, we
  use throw to signal that something unexpected happened. It is used as jump statement we can create custom
  exception and throw it when the condition is not met accordingly.

  **e.g.:**

  ```csharp
  static void displaysubject(string sub1)
  {
      if (sub1 == null)
          throw new NullReferenceException("Exception Message");
  }
  ```
