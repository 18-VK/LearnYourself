# JSON in C#

Serialization is the process of converting a .NET object into a JSON string so that it can be stored or transmitted.
Deserialization is the reverse process: converting JSON data back into a .NET object (class, struct, list, etc.).

In .NET (C#), you have multiple ways (classes/libraries) to work with JSON. Each has different strengths, weaknesses,
and use cases.

## 1) Newtonsoft.Json (Json.NET) (most popular, older library)

**Namespace:** `Newtonsoft.Json`

**Main Classes:**

- `JsonConvert` → Serialize/Deserialize objects
- `JObject`, `JArray`, `JToken` → LINQ-to-JSON API for dynamic manipulation
- `JsonSerializer` → More control over serialization

**✅ Pros:**

- Feature-rich & flexible → supports dynamic, LINQ-to-JSON, converters, camelCase naming, custom date formats, etc.
- Works with old .NET Framework and .NET Core
- Handles complex scenarios (polymorphism, references, circular objects, custom contracts)
- Mature, widely used, battle-tested

**❌ Cons:**

- Slower than `System.Text.Json` (more memory allocations)
- Extra dependency (not built-in, need NuGet install)
- May be overkill for simple use cases

## 2) System.Text.Json (modern, built-in since .NET Core 3.0)

**Namespace:** `System.Text.Json`

**Main Classes:**

- `JsonSerializer` → Serialize/Deserialize objects
- `JsonDocument` → Read-only DOM (efficient, forward-only reader)
- `JsonElement` → Represents an element inside JSON (like `JObject` in Newtonsoft)
- `Utf8JsonReader` / `Utf8JsonWriter` → Low-level high-performance streaming

**✅ Pros:**

- Built-in → no external dependency, part of .NET Core and .NET 5+
- Very fast (optimized for UTF-8 & performance)
- `Span<T>` support → low allocations, great for high-performance apps
- Async APIs (`SerializeAsync`, `DeserializeAsync`)
- Secure (strict by default, e.g., no comments in JSON)

**❌ Cons:**

- Limited features compared to Newtonsoft (e.g., missing advanced polymorphic serialization until .NET 7+)
- Case sensitivity by default (need options to ignore case)
- No built-in support for some advanced scenarios (e.g., `DataTable`, dynamic mapping, custom date formats require
  converters)

## Using Newtonsoft

To use Newtonsoft, you need to add its reference through NuGet Package Manager.

**Package Manager Console:** In Visual Studio go to Tools > NuGet Package Manager > Package Manager Console and run:

```powershell
Install-Package Newtonsoft.Json
```

This will add a reference to the latest `Newtonsoft.Json` package in your project.

**.NET CLI:** From the command line, navigate to your project folder and run:

```bash
dotnet add package Newtonsoft.Json
```

This will update your `.csproj` with a `<PackageReference>` for `Newtonsoft.Json`.

After installation, include the namespace:

```csharp
using Newtonsoft.Json;
```

## Basic Serialization and Deserialization

For simple scenarios, use `JsonConvert.SerializeObject` to convert an object to a JSON string, and
`JsonConvert.DeserializeObject<T>` to convert JSON back into a .NET object. For example:

```csharp
public class Product {
    public string Name { get; set; }
    public int Stock { get; set; }
}

var product = new Product { Name = "Apple", Stock = 100 };
string json = JsonConvert.SerializeObject(product);
// json: {"Name":"Apple","Stock":100}

Product copy = JsonConvert.DeserializeObject<Product>(json);
// copy.Name == "Apple", copy.Stock == 100
```

## Complex and Nested Objects

Json.NET automatically handles nested objects and collections. For example:

```csharp
public class Address {
    public string Street { get; set; }
    public string City { get; set; }
}

public class Order {
    public int OrderId { get; set; }
    public Address ShippingAddress { get; set; }
    public List<string> Items { get; set; }
}

var order = new Order {
    OrderId = 123,
    ShippingAddress = new Address { Street = "123 Main St", City = "Anytown" },
    Items = new List<string> { "Apple", "Banana" }
};
string jsonOrder = JsonConvert.SerializeObject(order, Formatting.Indented);
Console.WriteLine(jsonOrder);
```

## Collections, Dictionaries, and Anonymous Types

Json.NET has excellent support for .NET collections. Lists and arrays are serialized as JSON arrays and deserialized
back automatically.

For example:

```csharp
var fruits = new List<string> { "Apple", "Banana" };
string fruitsJson = JsonConvert.SerializeObject(fruits);
// fruitsJson: ["Apple","Banana"]

var fruits2 = JsonConvert.DeserializeObject<List<string>>(fruitsJson);
// fruits2 is a List<string> with two items
```

Dictionaries become JSON objects, with key/value pairs. E.g.:

```csharp
var dict = new Dictionary<string,int> { ["one"] = 1, ["two"] = 2 };
string dictJson = JsonConvert.SerializeObject(dict);
// dictJson: {"one":1,"two":2}

var dict2 = JsonConvert.DeserializeObject<Dictionary<string,int>>(dictJson);
// dict2["one"] == 1
```

## How Fields mapping work

In Newtonsoft.Json (Json.NET), the JSON property name does not have to match your C# variable/field name exactly.
Instead, matching works like this:

### By default

Json.NET matches JSON property names to C# properties (not fields/variables).
Matching is case-insensitive.

**e.g.:**

```csharp
class Person
{
    public string Name { get; set; }
    public int Age { get; set; }
}

string json = @"{ ""name"": ""Aman"", ""AGE"": 25 }";
var p = JsonConvert.DeserializeObject<Person>(json);

Console.WriteLine($"{p.Name}, {p.Age}"); 
```

Even though JSON had `"name"` (lowercase) and `"AGE"` (uppercase), it still mapped correctly.

### When names differ

If JSON has a property that doesn't match any class property:

- That JSON field is ignored.
- The C# property remains default value.

**e.g.:**

```csharp
class Person { public string Name { get; set; } }
string json = @"{ ""FullName"": ""Aman"" }";
var p = JsonConvert.DeserializeObject<Person>(json);
Console.WriteLine(p.Name ?? "NULL");
```

## Controlling Serialization with Attributes

You can influence how Json.NET serializes/deserializes properties using attributes on your classes:

### `[JsonProperty("name")]` – Renames a property in JSON

For example:

```csharp
public class User {
    [JsonProperty("username")]
    public string UserName { get; set; }
}
```

### `[JsonIgnore]` – Excludes a property from JSON

For example:

```csharp
public class Account {
    public string FullName { get; set; }
    [JsonIgnore]
    public string Password { get; set; }
}
```

The `Password` property will not appear in the serialized JSON.

### `[JsonConverter]` – Specifies a custom converter for a class or property

For example:

```csharp
[JsonConverter(typeof(StringEnumConverter))]
public enum Color { Red, Green, Blue }
```

will serialize `Color.Red` as `"Red"` (using `StringEnumConverter`). For a more custom example, you can create a converter
class by inheriting `JsonConverter` and attach it.

**e.g.:**

```csharp
[JsonConverter(typeof(UserConverter))]
public class User {
    public string UserName { get; set; }
}
```

## Custom Class example

```csharp
using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CustomDateTimeConverter : JsonConverter<DateTime>
{
    private const string Format = "dd-MM-yyyy"; // Custom date format

    public override void WriteJson(JsonWriter writer, DateTime value, JsonSerializer serializer)
    {
        writer.WriteValue(value.ToString(Format)); // Serialize as string
    }

    public override DateTime ReadJson(JsonReader reader, Type objectType, DateTime existingValue, bool hasExistingValue, JsonSerializer serializer)
    {
        var str = reader.Value?.ToString();
        return DateTime.ParseExact(str!, Format, null); // Deserialize from string
    }
}

public class Event
{
    public string Name { get; set; }

    [JsonConverter(typeof(CustomDateTimeConverter))] // Apply converter
    public DateTime EventDate { get; set; }
}

class Program
{
    static void Main()
    {
        var ev = new Event { Name = "Conference", EventDate = new DateTime(2025, 08, 31) };

        // Serialize
        string json = JsonConvert.SerializeObject(ev, Formatting.Indented);
        Console.WriteLine("Serialized:\n" + json);

        // Deserialize
        var deserialized = JsonConvert.DeserializeObject<Event>(json);
        Console.WriteLine($"\nDeserialized:\n{deserialized.Name} on {deserialized.EventDate:yyyy-MM-dd}");
    }
}
```

Notice how `DateTime` got stored as `"31-08-2025"` instead of the default ISO format.

### Example 2: Custom Converter for Bool (Y/N)

```csharp
public class YesNoBoolConverter : JsonConverter<bool>
{
    public override void WriteJson(JsonWriter writer, bool value, JsonSerializer serializer)
    {
        writer.WriteValue(value ? "Y" : "N");
    }

    public override bool ReadJson(JsonReader reader, Type objectType, bool existingValue, bool hasExistingValue, JsonSerializer serializer)
    {
        var str = reader.Value?.ToString()?.ToUpper();
        return str == "Y";
    }
}

public class User
{
    public string Name { get; set; }

    [JsonConverter(typeof(YesNoBoolConverter))]
    public bool IsActive { get; set; }
}

var user = new User { Name = "Alice", IsActive = true };
string json = JsonConvert.SerializeObject(user, Formatting.Indented);
Console.WriteLine(json);
// { "Name": "Alice", "IsActive": "Y" }

var obj = JsonConvert.DeserializeObject<User>("{\"Name\":\"Bob\",\"IsActive\":\"N\"}");
Console.WriteLine($"{obj.Name} active? {obj.IsActive}"); // Bob active? False
```

## Format options

### 1) Basic pretty / compact formatting

```csharp
using Newtonsoft.Json;
var person = new { Name="Aman", Age=30, Active=true };

// compact
string compact = JsonConvert.SerializeObject(person, Formatting.None);

// pretty / indented
string pretty = JsonConvert.SerializeObject(person, Formatting.Indented);
Console.WriteLine(pretty);
```

**Output (Indented):**

```json
{
  "Name": "Aman",
  "Age": 30,
  "Active": true
}
```

### 2) Use `JsonSerializerSettings` (common, recommended)

```csharp
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using Newtonsoft.Json.Converters;

var settings = new JsonSerializerSettings {
    Formatting = Formatting.Indented,
    NullValueHandling = NullValueHandling.Ignore,
    DefaultValueHandling = DefaultValueHandling.Ignore,
    ContractResolver = new CamelCasePropertyNamesContractResolver(),
    DateFormatString = "yyyy-MM-dd",
    Converters = { new StringEnumConverter() }
};

var obj = new {
    FirstName = "Aman",
    LastName = (string?)null,
    Role = DayOfWeek.Monday,
    Created = DateTime.UtcNow
};

string json = JsonConvert.SerializeObject(obj, settings);
Console.WriteLine(json);
```

**Sample output (camel-cased, no nulls, enum as string):**

```json
{
  "firstName": "Aman",
  "role": "Monday",
  "created": "2025-08-31"
}
```

(Actual `created` value will include time if you remove `DateFormatString` or use a different format.)

## Reading and Writing JSON from Files/Streams

Json.NET can read/write directly to streams or files using `JsonTextReader`/`JsonTextWriter` and `JsonSerializer`. For most
cases, you can simply read/write the JSON text using File I/O and then serialize/deserialize. For example:

```csharp
// Write to file (string-based)
File.WriteAllText("data.json", JsonConvert.SerializeObject(myObj, Formatting.Indented));
```

This serializes `myObj` to JSON and writes it to `data.json` in one line. For larger scenarios, you can write
via a stream:

```csharp
using (StreamWriter sw = new StreamWriter("data.json"))
using (JsonWriter writer = new JsonTextWriter(sw)) {
    JsonSerializer serializer = new JsonSerializer();
    serializer.Serialize(writer, myObj);
}
```

Similarly, reading is straightforward. To read the entire file into a string and deserialize:

```csharp
string json = File.ReadAllText("data.json");
MyType obj = JsonConvert.DeserializeObject<MyType>(json);
```

Or to stream-read:

```csharp
using (StreamReader sr = File.OpenText("data.json")) {
    JsonSerializer serializer = new JsonSerializer();
    MyType obj = (MyType)serializer.Deserialize(sr, typeof(MyType));
}
```

## JSON structure is unknown

When the JSON structure is unknown at compile time (like dynamic APIs, logs, config files), you can't deserialize into
a strongly typed C# class.
Instead, you use Newtonsoft.Json's LINQ-to-JSON API (`JObject`, `JArray`, `JToken`) to explore and extract values dynamically.

```csharp
using Newtonsoft.Json.Linq;
using System;

class Program
{
    static void Main()
    {
        string json = @"{
            'id': 101,
            'name': 'Alice',
            'roles': ['Admin', 'Editor'],
            'profile': {
                'email': 'alice@example.com',
                'age': 28
            }
        }";

        // Parse into JObject
        JObject obj = JObject.Parse(json);

        // Access values dynamically
        int id = (int)obj["id"];
        string name = (string)obj["name"];
        string email = (string)obj["profile"]["email"];
        int age = (int)obj["profile"]["age"];

        Console.WriteLine($"ID={id}, Name={name}, Email={email}, Age={age}");

        // Iterate through array
        foreach (var role in obj["roles"])
        {
            Console.WriteLine("Role: " + role);
        }
    }
}
```

## Newtonsoft.Json.Linq

These are LINQ-to-JSON classes that let you parse, query, and manipulate JSON without needing strongly typed C# classes. They work like a tree
(similar to `XmlDocument` for XML).

### 🔹 Main Classes in Newtonsoft.Json.Linq

| Class    | Description                                                       | Example                                                |
| ---------| ------------------------------------------------------------------| ------------------------------------------------------ |
|JObject   | Represents a JSON **object** (`{}`)                               | `JObject obj = JObject.Parse(jsonString);`             |
|JArray    | Represents a JSON **array** (`[]`)                                | `JArray arr = JArray.Parse(jsonString);`               |
|JProperty | Represents a **name-value pair** inside a `JObject`               | `foreach (JProperty prop in obj.Properties()) { ... }` |
|JValue    | Represents a **primitive value** (string, int, bool, etc.)        | `JValue val = new JValue("Aman");`                     |
|JToken    | Base class for all JSON elements (object, array, property, value) | You can cast to `JObject`, `JArray`, etc.              |

**Example:**

```csharp
using System;
using Newtonsoft.Json.Linq;

class Program
{
    static void Main()
    {
        string json = "{ \"Name\": \"Aman\", \"Age\": 25, \"Country\": \"India\" }";

        JObject obj = JObject.Parse(json);

        Console.WriteLine(obj["Name"]);   // Aman
        Console.WriteLine(obj["Age"]);    // 25
        Console.WriteLine(obj["Country"]); // India

        string json1 = "[ {\"Id\":1,\"Product\":\"Laptop\"}, {\"Id\":2,\"Product\":\"Phone\"} ]";

        JArray arr = JArray.Parse(json1);

        foreach (JObject item in arr)
        {
            Console.WriteLine($"{item["Id"]}: {item["Product"]}");
        }

        string json3 = "{ \"Name\": \"Aman\", \"Age\": 25 }";
        
        JToken token = JToken.Parse(json3);

        foreach (JProperty prop in token.Children<JProperty>())
        {
            Console.WriteLine($"{prop.Name} = {prop.Value}");
        }

         JValue name = new JValue("Aman");   // string
    }
}
```

> **Note:**
>
> **Making It Case-Insensitive (Optional)**
>
> If you want to ignore case when querying:
>
> 1. Use `SelectToken` with `StringComparison`
>
> ```csharp
> var roles = (JArray)obj.SelectToken("$.user.roles",
>     false, StringComparison.OrdinalIgnoreCase);
> ```

## Preparing JSON

**Example:**

```csharp
using System;
using Newtonsoft.Json.Linq;

class Program
{
    static void Main()
    {
        JObject person = new JObject
        {
            { "Name", "Aman" },
            { "Age", 25 }, or {"Age", new JValue(25)}
            { "Country", "India" },
            { "Skills", new JArray("C#", ".NET", "SQL") }, // nested array
            { "Address", new JObject {
                { "City", "Delhi" },
                { "Zip", "110001" }
            }}
        };

        string jsonString = person.ToString();
        Console.WriteLine(jsonString);
    }
}
```

**Example 2: Using C# class**

```csharp
using System;
using System.Collections.Generic;
using Newtonsoft.Json;

public class Address
{
    public string City { get; set; }
    public string Zip { get; set; }
}

public class Person
{
    public string Name { get; set; }
    public int Age { get; set; }
    public string Country { get; set; }
    public List<string> Skills { get; set; }
    public Address Address { get; set; }
}

class Program
{
    static void Main()
    {
        var person = new Person
        {
            Name = "Aman",
            Age = 25,
            Country = "India",
            Skills = new List<string> { "C#", ".NET", "SQL" },
            Address = new Address { City = "Delhi", Zip = "110001" }
        };

        string jsonString = JsonConvert.SerializeObject(person, Formatting.Indented);

        Console.WriteLine(jsonString);
    }
}
```

## JSON Field mapping with class in deserialization

When you deserialize JSON into a C# class, libraries like Newtonsoft.Json (Json.NET) or System.Text.Json need to
decide which JSON fields map to which C# properties.

### 1) By Name

JSON field names must match C# property names (case-insensitive by default).

### 2) Property Must Be Public with Setter

Only public properties with a public setter can be set during deserialization.

**e.g.:**

```csharp
public string Name { get; private set; } // ❌ won't be set
public string Name { get; set; }         // ✅ will be set
```

### 3) Attributes Can Control Mapping

If names differ between JSON and class, use attributes:

```csharp
public class Person
{
    [JsonProperty("full_name")]
    public string Name { get; set; }
}
```

### 4) Ignoring Fields

Properties not present in JSON → get default value (null/0/false).

JSON fields without a matching property → ignored (unless configured otherwise).

```json
{ "Name": "Aman", "Age": 25, "ExtraField": "ignored" }
```

```csharp
public class Person
{
    public string Name { get; set; }
    public int Age { get; set; }
}
```

`ExtraField` will be skipped.

### 5) Fields vs Properties

By default, JSON serializers work with properties, not fields.
