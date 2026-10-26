# Basic command (Must know)

**Goal:** create, run, build, restore, add a package and inspect SDK info.

## Quick checks & environment

Check SDK info:

```bash
dotnet --info
```

**What it does:** shows installed SDK(s), runtime(s), OS, and PATH info. Useful to confirm installation and the active SDK.

## Create a project (templates)

Create a console app:

```bash
dotnet new console -n MyApp
cd MyApp
```

`dotnet new` scaffolds a project from templates (console, web, mvc, classlib, worker, sln, etc.).
Use `dotnet new --list` to see available templates.

> Use of `dotnet new --list` is deprecated. Use `dotnet new list` instead.

### Selecting a Programming Language

You can choose the language explicitly with the `--language` option:

```bash
dotnet new console -n MyApp --language "C#"
dotnet new console -n MyApp --language "F#"
dotnet new console -n MyApp --language "VB"
```

- **C#** → Creates a C# console app (default if you don't specify).
- **F#** → Creates an F# console app.
- **VB** → Creates a Visual Basic console app.

## Run & Build

Run directly (builds implicitly):

```bash
dotnet run
```

Build explicitly (produces binaries in `bin/`):

```bash
dotnet build -c Release
```

**Notes:** `dotnet run` is convenient for iterative development; it invokes a build under the hood.

## Restore dependencies

Restore NuGet packages (most commands perform implicit restore, but you can run explicitly):

```bash
dotnet restore
```

> **Note:** commands like `dotnet build`, `dotnet run`, `dotnet test`, `dotnet publish` will implicitly restore when necessary. Use explicit restore in CI or when
> troubleshooting.

## Add a package

Add `Newtonsoft.Json` (example):

```bash
dotnet add package Newtonsoft.Json
```

This edits the project file to include a `<PackageReference>` and performs compatibility checks.

🔹 **Specify a Package Version**

When adding a package, use the `--version` (or `-v`) flag:

```bash
dotnet add package Newtonsoft.Json --version 13.0.3
dotnet add package Serilog --version 3.1.1
```

🔹 **Check Installed & Outdated Versions**

You can list packages already in your project:

```bash
dotnet list package
```

To see which ones are outdated:

```bash
dotnet list package --outdated
```

# Intermediate — multi-project, testing, tools, and packaging

**Goal:** work with solutions, test projects, tools, and produce NuGet packages or publish artifacts.

## Solutions & multiple projects

Create a solution and add projects:

```bash
dotnet new sln -n MySolution
dotnet new classlib -n MyLib
dotnet new console -n MyApp
dotnet sln MySolution.sln add MyLib/MyLib.csproj
dotnet sln MySolution.sln add MyApp/MyApp.csproj
```

You can reference projects:

```bash
cd MyApp
dotnet add reference ../MyLib/MyLib.csproj
```

## Testing

### Create a Test Project

Inside your solution folder, run:

```bash
dotnet new xunit -n MyApp.Tests
```

- `xunit` → Creates a test project using the xUnit framework (you can also use `mstest` or `nunit`).
- `-n MyApp.Tests` → Names the project `MyApp.Tests`

Then add it to your solution:

```bash
dotnet sln add MyApp.Tests/MyApp.Tests.csproj
```

(Adding test project to main project solution)

### Reference Your Main Project

Link the test project to the project you want to test:

```bash
dotnet add MyApp.Tests/MyApp.Tests.csproj reference MyApp/MyApp.csproj
```

This allows your test project to access classes and methods from your main app.

## Packing (create a NuGet package)

### Create a package from a project

```bash
dotnet pack -c Release
```

**Output:** `.nupkg` files in `bin/Release`.

### Install Locally (for testing)

You can install your package locally before publishing:

```bash
dotnet add package MyLibrary --source ./bin/Release
```

This uses the `.nupkg` file from your local folder.

### Publish to NuGet.org

- Get an API key from NuGet.org.
- Push the package:

```bash
dotnet nuget push bin/Release/MyLibrary.1.0.0.nupkg \
  --api-key <YOUR_API_KEY> \
  --source https://api.nuget.org/v3/index.json
```

### Verify Installation

Once published, you (or anyone) can install it:

```bash
dotnet add package MyLibrary --version 1.0.0
```

## Publishing

Publishing in .NET means packaging your application so it can run on another machine (server, VM, container, or user PC).
When you build, you get compiled files for development.

When you publish, .NET:

- ✅ compiles
- ✅ copies dependencies
- ✅ prepares runtime
- ✅ creates deployable output

### Types of Publish

There are two primary models.

| Type                | Runtime Included? | Target Machine Needs .NET? | Size    |
| ------------------- | ----------------- | -------------------------- | ------- |
| Framework-dependent | ❌ No              | ✅ Yes                      | Smaller |
| Self-contained      | ✅ Yes             | ❌ No                       | Bigger  |

#### 1️⃣ Framework-Dependent Deployment (FDD)

App expects .NET runtime already installed on the server.

**Example:**

```bash
dotnet publish -c Release
```

**Output:**

```text
bin/Release/net8.0/publish/
```

You copy files → run.

**Best for:**

- ✔ servers you control
- ✔ Docker base images
- ✔ cloud platforms

#### 2️⃣ Self-Contained Deployment (SCD)

Runtime ships with your app.

**Example:**

```bash
dotnet publish -c Release -r win-x64 --self-contained true
```

Now it runs even if .NET is not installed.

**Best for:**

- ✔ client machines
- ✔ restricted environments

#### 3️⃣ Single File Publish

Everything bundled into ONE executable.

```bash
dotnet publish -c Release -r win-x64 --self-contained false /p:PublishSingleFile=true
        or 
dotnet publish -c Release /p:PublishSingleFile=true
```

Great for distribution.

### Industry CI/CD Publish Flow

```text
git push →
CI build →
dotnet publish →
artifact →
deploy →
restart service
```

### Real world use

You have a WPF project, you built it, and you now have a `.dll`.
Problem → another person cannot easily run a DLL directly.

They need either:

- ✔ an EXE
- ✔ or an installer

Let's go step by step like it happens in real companies.

#### ✅ Option 1 — Publish as EXE (Most Common)

This is the fastest and professional way.

```bash
dotnet publish -c Release -r win-x64 --self-contained true
```

Now inside:

```text
bin/Release/net8.0-windows/win-x64/publish/
```

You will see:

```text
YourApp.exe  ✅
```

Send this folder to the user → double click → runs.
No .NET installation required.

#### ✅ Option 2 — Single File EXE (Cleaner)

Everything packed into ONE file.

```bash
dotnet publish -c Release -r win-x64 \
  /p:PublishSingleFile=true \
  --self-contained true
```

Now you can send:

```text
YourApp.exe  ✅ (only one file)
```

Best for sharing.

#### ✅ Option 3 — Framework Dependent EXE (Small size)

If the other person already has .NET installed.

```bash
dotnet publish -c Release -r win-x64 --self-contained false
```

Smaller download.

### What I Recommend For You (Based on Your Learning Stage)

Since you're aiming to become production ready:

- Step 1 → Learn publish EXE
- Step 2 → Learn single-file publish
- Step 3 → Learn ClickOnce
- Step 4 → Later MSIX / WiX
