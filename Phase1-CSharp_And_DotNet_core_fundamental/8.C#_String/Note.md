# C# Strings

In C#, a string is a sequence of Unicode characters or an array of characters. So the string is the representation of
the text. A string is an important concept, and sometimes people get confused about whether the string is a keyword,
an object, or a class. So, let's clear out this concept.

A string is represented by the class `System.String`. The `string` keyword is an alias for `System.String` class, and
instead of writing `System.String` one can use `String`, which is a shorthand for `System.String` class. So we can say that
both `string` and `String` can be used as an alias of `System.String` class. So string is an object of `System.String` class.

**Example:**

```csharp
// creating the string using string keyword
string s1 = "GeeksforGeeks";

// creating the string using String class
String s2 = "GFG";

// creating the string using String class
System.String s3 = "Pro Geek";
```

> **Note:** If a string is immutable, does that mean it can't be overwritten?
>
> You can overwrite a string variable — what you can't do is change the contents of the existing string
> object once it's created. You overwrote the variable reference, not the original string itself.

**e.g.:**

```csharp
string name = "Aman";       // Creates a string object with value "Aman"
name = "Rahul";             // Creates a new string object with value "Rahul"
```

- The original `"Aman"` string still exists in memory (until garbage collected).
- `name` now points to a new string `"Rahul"`.
- You overwrote the variable reference, not the original string itself.

## Interpolation of string

**Example:**

```csharp
// Interpolation is performed
string res = $"{name} is the Organisation Name.";
```

## Methods and properties

The `String` class in C# (in the `System` namespace) provides many methods and properties for working with text.

- Strings in C# are immutable (cannot be changed after creation).
- Any operation that modifies a string creates a new string.
- Belongs to the `System` namespace.

| Property       | Description                                  |
| -------------- | -------------------------------------------- |
| `Length`       | Gets the number of characters in the string. |
| `Chars[index]` | Access character at a specific index.        |

**Example:**

```csharp
string str = "Hello";
Console.WriteLine(str.Length);    // Output: 5
Console.WriteLine(str[1]);       // Output: e
```

## Important Methods with Examples

### 1. `Compare()`

Compares two strings.

**Example:**

```csharp
Console.WriteLine(string.Compare("apple", "banana"));  // Output: -1
```

### 2. `Concat()`

Concatenates strings.

**Example:**

```csharp
string result = string.Concat("Hello", " ", "World");
Console.WriteLine(result);  // Output: Hello World
```

### 3. `Contains()`

Checks if a string contains a substring.

**Example:**

```csharp
Console.WriteLine("Hello World".Contains("World"));  // Output: True
```

### 4. `EndsWith()`

Checks if a string ends with a specific substring.

**Example:**

```csharp
Console.WriteLine("Hello".EndsWith("lo"));  // Output: True
```

### 5. `StartsWith()`

Checks if a string starts with a specific substring.

**Example:**

```csharp
Console.WriteLine("Hello".StartsWith("He"));  // Output: True
```

### 6. `Equals()`

Compares two strings for equality.

**Example:**

```csharp
Console.WriteLine("test".Equals("test"));  // Output: True
```

### 7. `Format()`

Formats a string using placeholders.

**Example:**

```csharp
string name = "John";
int age = 25;
Console.WriteLine(string.Format("Name: {0}, Age: {1}", name, age));
// Output: Name: John, Age: 25
```

### 8. `IndexOf()`

Returns the index of the first occurrence of a character or substring.

**Example:**

```csharp
Console.WriteLine("Hello".IndexOf('e'));  // Output: 1
```

### 9. `LastIndexOf()`

Returns the last occurrence index.

**Example:**

```csharp
Console.WriteLine("Hello Hello".LastIndexOf("Hello"));  // Output: 6
```

### 10. `Insert()`

Inserts a string at a specified index.

**Example:**

```csharp
string str = "Hello";
string result = str.Insert(5, " World");
Console.WriteLine(result);  // Output: Hello World
```

### 11. `Join()`

Joins elements of an array with a separator.

**Example:**

```csharp
string[] words = { "Apple", "Banana", "Cherry" };
Console.WriteLine(string.Join(", ", words));
// Output: Apple, Banana, Cherry
```

### 12. `Remove()`

Removes characters from a string.

**Example:**

```csharp
string str = "Hello";
Console.WriteLine(str.Remove(2));   // Output: He
Console.WriteLine(str.Remove(1, 2)); // Output: Hlo
```

### 13. `Replace()`

Replaces characters or substrings.

**Example:**

```csharp
string str = "Hello World";
Console.WriteLine(str.Replace("World", "C#"));
// Output: Hello C#
```

### 14. `Split()`

Splits a string into an array.

**Example:**

```csharp
string str = "a,b,c";
string[] parts = str.Split(',');
foreach (var p in parts) Console.WriteLine(p);
```

### 15. `Substring()`

Extracts part of a string.

**Example:**

```csharp
string str = "Hello World";
Console.WriteLine(str.Substring(6));    // Output: World
Console.WriteLine(str.Substring(0, 5)); // Output: Hello
```

### 16. `ToLower()` and `ToUpper()`

Converts to lowercase or uppercase.

**Example:**

```csharp
Console.WriteLine("Hello".ToUpper()); // Output: HELLO
Console.WriteLine("Hello".ToLower()); // Output: hello
```

### 17. `Trim()`, `TrimStart()`, `TrimEnd()`

Removes whitespace.

**Example:**

```csharp
string str = "   Hello   ";
Console.WriteLine(str.Trim()); // Output: Hello
```

### 18. `IsNullOrEmpty()`

Checks if string is null or empty.

**Example:**

```csharp
string str = "";
Console.WriteLine(string.IsNullOrEmpty(str)); // Output: True
```

### 19. `IsNullOrWhiteSpace()`

Checks if string is null, empty, or only whitespace.

**Example:**

```csharp
string str = "   ";
Console.WriteLine(string.IsNullOrWhiteSpace(str)); // Output: True
```

### 20. `CopyTo()`

Copies characters to a character array.

**Example:**

```csharp
string str = "Hello";
char[] arr = new char[5];
str.CopyTo(0, arr, 0, 5);
Console.WriteLine(new string(arr)); // Output: Hello
```

## Verbatim string literal

In C#, a verbatim string is created using a special symbol `@`. The symbol (`@`) is known as a verbatim identifier. If a
string contains `@` as a prefix followed by double quotes, then compiler identifies that string as a verbatim string and
compile that string.

The main advantage of `@` symbol is to tell the string constructor to ignore escape characters and line breaks.

**Key Features of Verbatim String**

- **No Escape Sequences:** It does not support backslashes (`\`).
- **Useful for file paths**
- **Readable multi-line strings:** Allows for strings to span multi lines.
