# Ways to use relational database in C# Application

## 1. ADO.NET (Low-Level, Manual Control)

**What it is:**
The oldest and most direct way to interact with databases in .NET — uses `SqlConnection`, `SqlCommand`,
`SqlDataReader`, etc.

**When to use:**
When you need maximum control, high performance, or want to execute raw SQL queries manually.

**Pros**

- Very fast and lightweight.
- Full control over SQL, transactions, and parameters.

**Cons**

- Verbose and error-prone.
- You manually handle mapping between rows and objects.

## 2. Dapper (Micro-ORM)

**What it is:**
A lightweight ORM developed by Stack Overflow. It maps query results to objects automatically but leaves SQL control to you.

**When to use:**
When you want performance + object mapping without heavy frameworks like EF Core.

**Example:**

```csharp
using Dapper;
using System.Data.SqlClient;

string connectionString = "Server=.;Database=ShopDB;Trusted_Connection=True;";

using (var connection = new SqlConnection(connectionString))
{
    var products = connection.Query<Product>(
        "SELECT * FROM Products WHERE Price > @price", new { price = 100 });

    foreach (var p in products)
        Console.WriteLine($"{p.Name} - {p.Price}");
}
```

**Pros**

- Fast (near ADO.NET performance).
- Simple object mapping.
- No context or tracking overhead.

**Cons**

- You still write SQL manually.
- No migrations or schema management.

## 3. Entity Framework Core (ORM)

**What it is:**
A full-fledged Object Relational Mapper that lets you work with data as C# objects. You can use LINQ instead of raw SQL.

**When to use:**
For enterprise apps, CRUD-heavy systems, or when productivity > raw speed.

**Example (Code-First):**

```csharp
public class ShopContext : DbContext
{
    public DbSet<Product> Products { get; set; }
}

var context = new ShopContext();
var products = context.Products.Where(p => p.Price > 100).ToList();
```

**Pros**

- No SQL writing needed (can use LINQ).
- Handles migrations, relationships, and tracking.
- Supports lazy loading and change tracking.

**Cons**

- Slower than Dapper or ADO.NET for large queries.
- Requires more configuration and understanding.

## 4. EF Core + Raw SQL

EF Core allows mixing LINQ and SQL:

```csharp
var result = context.Products
    .FromSqlRaw("SELECT * FROM Products WHERE Price > {0}", 100)
    .ToList();
```

Best of both worlds — ORM mapping + SQL control.

## Recommended in Modern .NET Apps

- **Small projects / APIs:** Dapper
- **Enterprise or complex apps:** EF Core (with migrations)
- **Performance-critical reporting:** ADO.NET or Dapper for raw queries
- **Hybrid:** Use EF Core + Dapper together (common in real-world apps)

# Note

Should have knowledge of ADO.NET, Dapper also with EFCore.
Can ignore ADO.NET but the other two are must.

# String Interpolation

String Interpolation in C# is a concise and readable way to embed variables or expressions directly inside a
string. It was introduced in C# 6.0 and has become the standard way to format strings.

## Basic Syntax

You prefix the string with a `$` symbol and insert variables or expressions inside curly braces `{}`.

```csharp
string name = "Aman";
int age = 25;

string message = $"My name is {name} and I am {age} years old.";
Console.WriteLine(message);
```

# Environment Variables in C#

Environment variables are system-wide or user-specific key–value pairs that store configuration settings
outside your application code.
They're often used for secrets, connection strings, or environment-specific settings like "Development",
"Staging", or "Production".

## Reading Environment Variables

You can access environment variables via the `System.Environment` class.

```csharp
using System;

class Program
{
    static void Main()
    {
        string? path = Environment.GetEnvironmentVariable("PATH");
        Console.WriteLine(path);
    }
}
```

Returns the value of the environment variable `PATH`.

## Setting Environment Variables

**On Windows (PowerShell)**

```powershell
setx MyApp_ConnectionString "Server=.;Database=ProdDB;Trusted_Connection=True;"
```

# launchSettings.json

## What launchSettings.json is — short

It's a developer-only file that configures how the project is launched when debugging locally (Visual Studio,
Rider, VS Code C# extension) or when using `dotnet run --launch-profile`.

It lives under the project `Properties` folder and is not used in production. It helps set environment variables,
command-line args, which "profile" to use (IIS Express, Project, Executable), URLs, whether to launch a
browser, etc.

It is intended only for local debugging/development workflows — it is not part of the app runtime config for
production. Treat it as a dev convenience.

## Where it is

- File path: `<project-root>/Properties/launchSettings.json`
- If missing, you can create it manually (create `Properties` folder then the file).

## Basic structure and important fields (explained)

A `launchSettings.json` contains a top-level `"profiles"` object (plus optionally `iisSettings`). Each profile
configures a launch scenario.

## Key fields you'll encounter

- `commandName` — type of launch:
- `"Project"`: run the project (`dotnet run` behavior).
- `"IISExpress"`: Visual Studio IIS Express for web apps.
- `"Executable"`: run an external executable with args.
- `"Docker"`: Docker launch (when using container tools).
- `applicationUrl` — for web projects: the URL(s) Kestrel will bind to (example `"https://localhost:5001;http://localhost:5000"`).
- `environmentVariables` — key/value pairs set for the launched process (commonly `DOTNET_ENVIRONMENT`).
- `launchBrowser` (bool) — for web projects, whether to open a browser when starting.
- `launchUrl` — for web projects, the path opened in the browser.
- `commandLineArgs` — string of arguments passed to the app when launched through the profile.
- `dotnetRunMessages` — (true/false) show SDK run messages.
- `inspectUri` — used for certain debugger integrations (auto-populated by VS).
- `iisSettings` — top-level IISExpress configuration (ssl port, site name); used by Visual Studio for web projects.

**Explanation:**

- `DOTNET_ENVIRONMENT=Development` means `Host.CreateDefaultBuilder` will load `appsettings.Development.json`
  after `appsettings.json`.
- `App__MaxItemsPerRun` maps to the configuration key `App:MaxItemsPerRun` (double-underscore maps to colons).
- `commandLineArgs` will be visible to `args[]` or Host if you read them.

**Example:**

**Web project example (ASP.NET Core — dev only)**

```json
{
  "iisSettings": {
    "windowsAuthentication": false,
    "anonymousAuthentication": true,
    "iisExpress": {
      "applicationUrl": "http://localhost:49270",
      "sslPort": 44300
    }
  },
  "profiles": {
    "IIS Express": {
      "commandName": "IISExpress",
      "launchBrowser": true,
      "launchUrl": "weatherforecast",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    },
    "MyWebApp": {
      "commandName": "Project",
      "launchBrowser": true,
      "applicationUrl": "https://localhost:5001;http://localhost:5000",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "ConnectionStrings__Default": "Server=.;Database=DevDb;Trusted_Connection=True;"
      }
    }
  }
}
```

# OpenFileDialog and SaveFileDialog

These are built-in dialog boxes in Windows Forms used to let the user:

- ✔ Pick a file from the computer → `OpenFileDialog`
- ✔ Choose a location and name to save a file → `SaveFileDialog`

They are convenient because you don't need to build your own custom UI for browsing files.

## 1) OpenFileDialog

**Basic Example: Open a text file and display its content**

```csharp
private void btnOpen_Click(object sender, EventArgs e)
{
    using (OpenFileDialog ofd = new OpenFileDialog())
    {
        ofd.Title = "Select a Text File";
        ofd.Filter = "Text Files (*.txt)|*.txt|All Files (*.*)|*.*";
        ofd.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

        if (ofd.ShowDialog() == DialogResult.OK)
        {
            string filePath = ofd.FileName;
            string content = File.ReadAllText(filePath);

            textBox1.Text = content;
        }
    }
}
```

**What this code does:**

- Opens a file browser window
- Allows only `.txt` or all files
- If file selected → reads it → displays in textbox
- `using` automatically disposes dialog

**Some common properties:**

| Property           | What it does                          |
| ------------------ | ------------------------------------- |
| `Filter`           | Restrict file types                   |
| `InitialDirectory` | Start dialog from Desktop / Documents |
| `Multiselect`      | Allow selecting multiple files        |
| `Title`            | Set dialog title                      |
| `CheckFileExists`  | Default true — ensures real files     |

**Advanced Example: Select multiple images**

```csharp
private void btnSelectImages_Click(object sender, EventArgs e)
{
    OpenFileDialog ofd = new OpenFileDialog();
    ofd.Filter = "Image Files|*.jpg;*.jpeg;*.png;*.bmp";
    ofd.Multiselect = true;

    if (ofd.ShowDialog() == DialogResult.OK)
    {
        foreach (string file in ofd.FileNames)
        {
            listBox1.Items.Add(file);
        }
    }
}
```

## 2) SaveFileDialog (Save files)

**Basic Example: Save text from TextBox to a file**

```csharp
private void btnSave_Click(object sender, EventArgs e)
{
    using (SaveFileDialog sfd = new SaveFileDialog())
    {
        sfd.Title = "Save Text File";
        sfd.Filter = "Text Files (*.txt)|*.txt";
        sfd.DefaultExt = "txt";
        sfd.FileName = "MyFile";

        if (sfd.ShowDialog() == DialogResult.OK)
        {
            File.WriteAllText(sfd.FileName, textBox1.Text);
        }
    }
}
```

✔ **Explanation:**

- Only allow `.txt` file
- Default name = "MyFile.txt"
- Writes content from textbox into selected file

**Advanced Example: Export DataGridView → CSV**

```csharp
private void btnExportCSV_Click(object sender, EventArgs e)
{
    SaveFileDialog sfd = new SaveFileDialog();
    sfd.Filter = "CSV Files (*.csv)|*.csv";
    sfd.FileName = "export.csv";

    if (sfd.ShowDialog() == DialogResult.OK)
    {
        using (StreamWriter sw = new StreamWriter(sfd.FileName))
        {
            // Header
            var header = string.Join(",", 
                dataGridView1.Columns.Cast<DataGridViewColumn>()
                .Select(c => c.HeaderText));
            sw.WriteLine(header);

            // Rows
            foreach (DataGridViewRow row in dataGridView1.Rows)
            {
                if (!row.IsNewRow)
                {
                    var cells = row.Cells.Cast<DataGridViewCell>()
                        .Select(c => c.Value?.ToString()?.Replace(",", " "));
                    sw.WriteLine(string.Join(",", cells));
                }
            }
        }
    }
}
```

## Filter

**Format:**

```text
Description | extension | description | extension
```

**Example:**

```csharp
ofd.Filter = "Text Files (*.txt)|*.txt|Images (*.png;*.jpg)|*.png;*.jpg|All Files|*.*";
```

# Using keyword

## What is AppDomain.CurrentDomain.AssemblyResolve

`AppDomain.CurrentDomain.AssemblyResolve` is an event in .NET that fires when the runtime fails to locate or load an assembly. By handling this event, you can provide custom logic to load missing assemblies—for example, from a specific folder, embedded resources, or even dynamically generated assemblies.

### 🔑 Key Facts About AssemblyResolve

**Event Trigger:** Raised when the CLR cannot bind to an assembly by name during runtime.

**Scope:** Applies to the current AppDomain (`AppDomain.CurrentDomain`).

**Handler Role:** Your event handler must return a valid `Assembly` object that satisfies the request. If it returns `null`, the load attempt fails.

**Common Use Cases:**

- Load assemblies from non-standard locations (e.g., custom folders, network paths).
- Select between multiple versions of an assembly.
- Load assemblies stored as byte arrays (e.g., from a database).
- Provide assemblies embedded as resources inside your executable.

### ⚙️ How It Works

**Register the Event Handler:**

```csharp
AppDomain.CurrentDomain.AssemblyResolve += (sender, args) =>
{
    string assemblyName = new AssemblyName(args.Name).Name;
    string path = Path.Combine("CustomLibs", assemblyName + ".dll");
    if (File.Exists(path))
    {
        return Assembly.LoadFrom(path);
    }
    return null;
};
```

**Runtime Behavior:**

- When the runtime cannot find `SomeLibrary.dll` in the default probing paths, it raises `AssemblyResolve`.
- Your handler inspects `args.Name` (the requested assembly's display name).
- If you can locate or generate the assembly, you return it; otherwise, the load fails.

### 📂 Example Scenarios

| Scenario          | Handler Action                                                   |
| ----------------- | ---------------------------------------------------------------- |
| Custom folder     | Load DLL from `CustomLibs` directory.                            |
| Embedded resource | Extract DLL from resources, load via `Assembly.Load(byte[])`.    |
| Version control   | Decide which version of an assembly to load based on business rules. |
| Dynamic assembly  | Generate assembly at runtime and return it.                      |

### ⚠️ Risks & Best Practices

**Do not use for general assembly loading** → It should only be a fallback mechanism.

**Performance impact** → Overuse can slow down startup if many assemblies are resolved this way.

**Security considerations** → Ensure assemblies are loaded from trusted sources to avoid injection attacks.

**Reflection-only context** → Use `AppDomain.ReflectionOnlyAssemblyResolve` instead if you're loading assemblies for inspection only.

👉 In short: `AppDomain.CurrentDomain.AssemblyResolve` lets you intercept failed assembly loads and provide your own resolution logic. It's powerful for scenarios like loading plugins, handling version mismatches, or shipping assemblies as embedded resources.

Would you like me to show you a step-by-step example of loading an embedded DLL via `AssemblyResolve` (a common real-world use case)?

## foreach (string path in assemblyReferencePaths) — explain this

That line:

```csharp
foreach (string path in assemblyReferencePaths)
```

is a `foreach` loop in C#. Let's break it down:

### 🧩 Explanation

- `foreach` → A loop construct in C# that iterates over each element in a collection (like arrays, lists, or any enumerable).
- `string path` → Declares a loop variable named `path` of type `string`. On each iteration, it holds the current element from the collection.
- `assemblyReferencePaths` → This is the collection being iterated. From the name, it's likely a `List<string>` or `string[]` containing file paths to assemblies (DLLs).

So, the loop means:

👉 "For each string value inside `assemblyReferencePaths`, assign it to the variable `path` and execute the loop body."

### ⚙️ Example

Suppose you have:

```csharp
string[] assemblyReferencePaths = 
{
    @"C:\Libs\MyLibrary.dll",
    @"D:\Plugins\PluginA.dll",
    @"E:\Tools\Utility.dll"
};

foreach (string path in assemblyReferencePaths)
{
    Console.WriteLine($"Loading assembly from: {path}");
}
```

**Output:**

```text
Loading assembly from: C:\Libs\MyLibrary.dll
Loading assembly from: D:\Plugins\PluginA.dll
Loading assembly from: E:\Tools\Utility.dll
```

### 📂 Why It's Useful Here

In the context of `AssemblyResolve`, this loop is often used to:

- Search through a list of possible directories or file paths.
- Try to locate the missing assembly.
- Load it dynamically using something like `Assembly.LoadFrom(path)`.

👉 In short: That line is looping through all the assembly reference paths one by one, so you can perform an action (like loading or checking) on each path.

Would you like me to show you a full example of using this loop inside an `AssemblyResolve` handler—so you see how it fits into real-world code?

## Where does ResolveEventArgs come from?

```csharp
public Assembly ResolveAssembly(object sender, ResolveEventArgs args)

AppDomain.CurrentDomain.AssemblyResolve += new ResolveEventHandler(ResolveAssembly);
```

Great question! Let's unpack this clearly:

### 🔑 Where ResolveEventArgs Comes From

When the CLR (Common Language Runtime) tries to load an assembly and fails, it raises the `AssemblyResolve` event.

The event handler you attach (`ResolveAssembly`) receives two parameters:

- `object sender` → The source of the event (usually the current AppDomain).
- `ResolveEventArgs args` → An object containing details about the assembly that failed to load.

### 📂 What's Inside ResolveEventArgs

The `ResolveEventArgs` class provides information about the missing assembly:

- `args.Name` → The display name of the assembly that the runtime is trying to load (e.g., `"MyLibrary, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null"`).
- `args.RequestingAssembly` → The assembly that triggered the load request (optional, sometimes null).

So, when your handler runs:

```csharp
public Assembly ResolveAssembly(object sender, ResolveEventArgs args)
{
    Console.WriteLine("Missing assembly: " + args.Name);
    // custom logic to locate and load the assembly
}
```

👉 The `args` parameter is automatically provided by the runtime when the event is raised. You don't create it yourself—it's constructed internally by the CLR and passed into your handler.

### ⚙️ Flow of Events

Your code subscribes:

```csharp
AppDomain.CurrentDomain.AssemblyResolve += new ResolveEventHandler(ResolveAssembly);
```

- Later, the runtime tries to load an assembly (say `MyLibrary.dll`) but fails.
- CLR raises `AssemblyResolve` → calls your `ResolveAssembly` method.
- CLR passes a new `ResolveEventArgs` object into your method, containing the missing assembly's name.
- Your handler decides how to load it (from disk, embedded resource, etc.) and returns an `Assembly` object.

👉 In short: `ResolveEventArgs` is created by the .NET runtime when an assembly load fails, and it's passed into your event handler so you know which assembly needs resolving.

Would you like me to show you a practical example where `ResolveEventArgs.Name` is used to load an embedded DLL? That's one of the most common real-world uses.

## C++ questions for interview

If you're preparing for a C++ interview, expect questions ranging from fundamentals (syntax, memory management) to advanced topics like templates, STL, and multithreading. Below is a structured list of commonly asked C++ interview questions with examples to help you practice.

### 🔰 Beginner-Level Questions

**What is C++ and how is it different from C?**
C++ adds object-oriented features (classes, inheritance, polymorphism) to C.

**Explain the difference between `struct` and `class`.**
By default, members of a `struct` are public, while members of a `class` are private.

**What is the difference between `new` and `malloc`?**
`new` calls constructors and returns typed pointers; `malloc` just allocates raw memory.

**What are references in C++?**
An alias for another variable, unlike pointers which store addresses.

**Explain function overloading vs operator overloading.**
Both allow polymorphism: functions with same name but different parameters, or redefining operators for custom types.

### ⚙️ Intermediate-Level Questions

**What is the difference between shallow copy and deep copy?**
Shallow copy duplicates only pointers; deep copy duplicates the actual data.

**Explain virtual functions and pure virtual functions.**
Virtual functions enable runtime polymorphism; pure virtual functions (`=0`) make a class abstract.

**What is the difference between stack and heap memory?**
Stack is automatic, fast, and limited; heap is dynamic, larger, but requires manual management.

**What are templates in C++?**
Generic programming feature allowing functions/classes to work with any data type.

**Explain exception handling in C++.**
Uses `try`, `catch`, and `throw` to handle runtime errors gracefully.

### 🚀 Advanced-Level Questions

**What is RAII (Resource Acquisition Is Initialization)?**
A design principle where resources (memory, file handles) are tied to object lifetime.

**Difference between `std::vector` and `std::list`?**

- `vector`: contiguous memory, fast random access, slow insert/delete in middle.
- `list`: doubly linked, fast insert/delete, slow random access.

**What is the difference between `std::map` and `std::unordered_map`?**

- `map`: ordered, implemented as balanced tree, O(log n).
- `unordered_map`: hash table, average O(1), but unordered.

**Explain multithreading in C++.**
Using `<thread>` library, synchronization with mutexes, condition variables.

**What is the difference between compile-time and runtime polymorphism?**

- Compile-time: function overloading, operator overloading.
- Runtime: virtual functions, dynamic binding.

### 📊 Quick Comparison Table

| Concept | Key Difference |
| ------- | -------------- |
| `struct` vs `class` | Default access: public vs private |
| `new` vs `malloc` | Constructor call vs raw memory |
| `map` vs `unordered_map` | Ordered O(log n) vs Hash O(1) |
| Shallow vs Deep copy | Pointer copy vs Data copy |
| Compile-time vs Runtime polymorphism | Overloading vs Virtual functions |

### ⚠️ Risks & Best Practices

**Memory leaks:** Always pair `new` with `delete`, or better use smart pointers (`std::unique_ptr`, `std::shared_ptr`).

**Multiple inheritance:** Can cause ambiguity (diamond problem); use virtual inheritance carefully.

**Templates:** Powerful but can lead to code bloat if misused.

**Exception safety:** Always ensure destructors are `noexcept` to avoid undefined behavior.

👉 Aman, since you're exploring IT job opportunities, I'd recommend practicing STL containers, memory management, and OOP principles—these are the most common areas interviewers test in C++ interviews.

Would you like me to create a mini practice test with C++ coding questions (like writing code for deep copy, template usage, or STL operations) so you can simulate an interview?

# using keyword in C#

In C#, the `using` keyword has two main roles: (1) as a directive to import namespaces or create aliases, and (2) as a statement to ensure proper disposal of resources that implement `IDisposable`.

## 1️⃣ using Directive (Namespace Import / Alias)

**Purpose:** Lets you reference types without writing their full namespace.

**Example:**

```csharp
using System;
using System.IO;
using Project = MyCompany.Project; // alias
```

**Modifiers:**

- `global using` → applies to all files in the project.
- `static using` → imports static members of a type.

👉 This is why you can write `Console.WriteLine()` instead of `System.Console.WriteLine()`.

## 2️⃣ using Statement (Resource Management)

**Purpose:** Defines a scope where an `IDisposable` object is used, ensuring it's automatically disposed at the end of the block—even if an exception occurs.

**Example:**

```csharp
using (StreamReader reader = File.OpenText("data.txt"))
{
    string line;
    while ((line = reader.ReadLine()) != null)
    {
        Console.WriteLine(line);
    }
} // reader.Dispose() is called here automatically
```

**Async Variant:**

```csharp
await using (var resource = new AsyncDisposableExample())
{
    // use resource
}
```

**Using Declaration (C# 8+):**

```csharp
using StreamReader reader = File.OpenText("data.txt");
// disposed automatically at end of method scope
```

Exactly 👍 — if you don't use a `using` statement (or declaration), then you must call `.Dispose()` explicitly on objects that implement `IDisposable`.

## Best Practices

- Always use `using` for files, streams, DB connections, sockets—anything that implements `IDisposable`.
- Prefer `using` declarations in modern C# for cleaner code.
- Use `global using` directives in .NET 6+ projects to reduce boilerplate.
- Avoid overusing aliases unless they improve clarity.

## 🔑 Why?

Classes like `StreamReader`, `SqlConnection`, `FileStream`, etc. hold unmanaged resources (file handles, DB connections).

The `using` statement is just syntactic sugar that ensures `.Dispose()` is called automatically at the end of the scope.

Without `using`, the runtime won't clean up those resources for you — you're responsible for calling `.Dispose()` manually.

## ⚙️ Example Without using

```csharp
StreamReader reader = new StreamReader("data.txt");
try
{
    string line = reader.ReadLine();
    Console.WriteLine(line);
}
finally
{
    // Must call Dispose explicitly
    reader.Dispose();
}
```

## ✅ Example With using

```csharp
using (StreamReader reader = new StreamReader("data.txt"))
{
    string line = reader.ReadLine();
    Console.WriteLine(line);
} // Dispose called automatically here
```

## ⚠️ Best Practice

Always prefer `using` (or `using` declarations in C# 8+) for cleaner, safer code.

If you skip `using`, wrap your object in a `try`/`finally` block and call `.Dispose()` in `finally` to guarantee cleanup even if exceptions occur.

For async resources, use `await using` to ensure proper disposal.

👉 So yes, without `using`, you must explicitly call `.Dispose()` — otherwise you risk memory leaks, locked files, or exhausted DB connections.
