# ResourceManager in .NET

## 🔎 What is ResourceManager?

`System.Resources.ResourceManager` is a class in .NET used to **access resources embedded in an assembly**.

Resources can include:

- Strings
- Images
- Files (like DLLs, icons, etc.)

It provides a way to retrieve these resources at runtime without needing separate files on disk.

---

## 🛠 How ResourceManager Works

When you create a `.resx` file (e.g., `Properties/Resources.resx`), Visual Studio compiles it into your assembly.
`ResourceManager` lets you fetch those resources by name.

Example:

```csharp
ResourceManager rm = new ResourceManager(
    "MyApp.Properties.Resources",
    Assembly.GetExecutingAssembly());

string message = rm.GetString("WelcomeMessage");
```

Here:

- `"MyApp.Properties.Resources"` → namespace + resource file name.
- `Assembly.GetExecutingAssembly()` → tells `ResourceManager` where to look.
- `GetString("WelcomeMessage")` → retrieves a string resource.

---

## Using ResourceManager to Load Embedded Assemblies

In your code:

```csharp
ResourceManager rm = new ResourceManager(
    Assembly.GetEntryAssembly().GetName().Name + ".Properties.Resources",
    Assembly.GetExecutingAssembly());

byte[] bytes = (byte[])rm.GetObject("exassembly");
Assembly asm = Assembly.Load(bytes);
```

### Step-by-step

1. Create `ResourceManager` → points to the `Resources.resx` file inside your assembly.
2. `GetObject("exassembly")` → retrieves a resource named `exassembly` (stored as a byte array).
3. `Assembly.Load(bytes)` → loads the DLL directly from memory.

This means the DLL (`exassembly.dll`) is embedded inside your EXE and doesn't need to exist on disk.

### Why Use ResourceManager for Assemblies?

- **Single-file deployment:** No need to ship multiple DLLs.
- **Security/obfuscation:** DLLs aren't visible on disk.
- **Dynamic loading:** You can load only when needed.

---

## 🧩 Related Reflection Calls

| Call | Returns |
|---|---|
| `Assembly.GetExecutingAssembly()` | The assembly where the current code is running. |
| `Assembly.GetEntryAssembly()` | The main entry point assembly (your EXE). |
| `Assembly.GetCallingAssembly()` | The assembly that invoked the current method. |

---

## 🎯 Key Takeaway

`ResourceManager` is a powerful way to:

- Access embedded resources in your assembly.
- Load files (like DLLs) directly from memory.
- Keep applications self-contained and secure.

In your scenario, it's used to embed and load `exassembly.dll` dynamically, so the agent doesn't need the DLL on disk.
