# StringBuilder

In C#, `StringBuilder` is a mutable string class provided in the `System.Text` namespace. Unlike `string` (which is immutable),
`StringBuilder` allows modification of string content without creating new objects in memory, making it faster for
repeated string manipulations.

## What is StringBuilder?

- A mutable string container.
- Used when you need to modify strings frequently (append, insert, remove, replace).
- Improves performance compared to string concatenation.

**Example:**

```csharp
StringBuilder sb = new StringBuilder();
```

## Important Methods with Examples

### 1. `Append()`

Adds text to the end of the `StringBuilder`.

**Example:**

```csharp
StringBuilder sb = new StringBuilder("Hello");
sb.Append(" World");
Console.WriteLine(sb); // Output: Hello World
```

### 2. `AppendLine()`

Adds text with a new line.

**Example:**

```csharp
sb.AppendLine("C# is awesome");
Console.WriteLine(sb);
```

### 3. `Insert()`

Inserts text at a specific position.

**Example:**

```csharp
sb.Insert(6, "C# ");
Console.WriteLine(sb); // Output: Hello C# World
```

### 4. `Remove()`

Removes a range of characters.

**Example:**

```csharp
sb.Remove(6, 3); // Removes "C# "
Console.WriteLine(sb); // Output: Hello World
```

### 5. `Replace()`

Replaces text within the `StringBuilder`.

**Example:**

```csharp
sb.Replace("World", "Universe");
Console.WriteLine(sb); // Output: Hello Universe
```

### 6. `Clear()`

Clears the `StringBuilder` content.

**Example:**

```csharp
sb.Clear();
Console.WriteLine(sb.Length); // Output: 0
```

## Properties

| Property      | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `Length`      | Gets or sets the number of characters in the `StringBuilder`.               |
| `Capacity`    | Gets or sets the number of characters that can be stored without resizing.  |
| `MaxCapacity` | Gets the maximum capacity.                                                  |

**Example:**

```csharp
Console.WriteLine($"Length: {sb.Length}, Capacity: {sb.Capacity}");
```

## Performance Difference

- Using string concatenation in loops creates multiple string objects, which is slow and memory-inefficient.
- Using `StringBuilder` modifies the same object, which is faster and more efficient for large or repeated modifications.

## Full Example Demonstrating All

```csharp
using System;
using System.Text;

class Program
{
    static void Main()
    {
        StringBuilder sb = new StringBuilder("Hello");

        sb.Append(" World");
        sb.AppendLine("!");
        sb.Insert(6, "C# ");
        sb.Replace("World", "Universe");

        Console.WriteLine(sb); // Output: Hello C# Universe!

        sb.Remove(6, 3);
        Console.WriteLine(sb); // Output: Hello Universe!

        Console.WriteLine($"Length: {sb.Length}, Capacity: {sb.Capacity}");
    }
}
```

## Key Points

- `StringBuilder` is mutable and ideal for scenarios involving frequent string modifications.
- Provides better performance than `string` for concatenations in loops.
