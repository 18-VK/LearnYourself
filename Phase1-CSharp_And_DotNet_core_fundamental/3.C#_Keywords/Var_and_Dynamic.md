# `var` and `dynamic`

## `var` type

`var` is implicitly typed — the compiler infers the type at compile-time based on the right-hand expression.
Once inferred, the type is fixed and strong (i.e., behaves like an explicitly typed variable).

**Example:**

```csharp
var x = 10;          // x is inferred as int
var name = "Aman";   // name is inferred as string

// Behind the scenes:
// int x = 10;
// string name = "Aman";
```

> **Note:** No, you cannot change the type of a `var` variable after assigning a value in C#. The type is statically and permanently
> inferred at compile-time based on the initial assignment.

## `dynamic`

`dynamic` is resolved at runtime. The compiler skips type checking.
You can change its type on the fly, but lose compile-time checking.

**Example:**

```csharp
dynamic val = 10;         // Initially an int
val = "Hello";            // Now a string
val = new DateTime();     // Now a DateTime object
```

## Comparison

| Feature                | `var`                      | `dynamic`                         |
| ---------------------- | -------------------------- | --------------------------------- |
| Type resolved at       | Compile-time               | Runtime                           |
| Compile-time check     | ✅ Yes                      | ❌ No                              |
| Type safe              | ✅ Yes                      | ❌ No (risk of runtime exceptions) |
| IntelliSense support   | ✅ Full                     | ❌ Limited                         |
| Reflection/COM support | ❌ Not ideal                | ✅ Preferred                       |
| Performance            | ⚡ Fast (no binding needed) | 🐢 Slower (uses runtime binder)   |

## Usage

### `var`

🔹 **LINQ Queries**

```csharp
var results = from x in students where x.Age > 18 select x;
```

🔹 **Anonymous Types**

```csharp
var person = new { Name = "Aman", Age = 25 };
Console.WriteLine(person.Name);  // "Aman"
```

🔹 **Avoid Redundant Typing**

```csharp
var dict = new Dictionary<string, List<int>>();
```

### `dynamic`

🔹 **Working with JSON or ExpandoObject**

```csharp
dynamic json = Newtonsoft.Json.JsonConvert.DeserializeObject("{\"name\":\"Aman\"}");
Console.WriteLine(json.name);  // No compile-time validation
```

🔹 **Reflection-based or Late-bound APIs**

```csharp
Type t = typeof(String);
dynamic obj = Activator.CreateInstance(t);
Console.WriteLine(obj.ToUpper()); // Works at runtime
```

🔹 **COM Interop**

```csharp
dynamic excel = Activator.CreateInstance(Type.GetTypeFromProgID("Excel.Application"));
excel.Visible = true;
```
