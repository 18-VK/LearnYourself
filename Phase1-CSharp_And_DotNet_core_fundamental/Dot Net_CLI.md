# .NET CLI Cheat Sheet

This file combines the core commands and the more advanced .NET CLI reference into one practical cheat sheet.

General form:
```bash
dotnet <command> [arguments] [options]
```

Quick help for anything:
```bash
dotnet <command> --help
# example:
dotnet new --help
```

---

## 1. Must-know basics

Goal: create, run, build, restore, add a package, and inspect the SDK environment.

### Quick checks & environment

```bash
dotnet --info
```
What it does: shows installed SDK(s), runtime(s), OS, and PATH info. Useful to confirm installation and the active SDK.

```bash
dotnet --version
dotnet --list-sdks
dotnet --list-runtimes
dotnet --help
```

**Pin an SDK version for a repo** (`global.json`):
```bash
dotnet new globaljson --sdk-version 8.0.404 --roll-forward latestFeature
```

---

## 2. Create projects (`dotnet new`)

Create a console app:
```bash
dotnet new console -n MyApp
cd MyApp
```

`dotnet new` scaffolds a project from templates such as `console`, `web`, `mvc`, `classlib`, `worker`, `sln`, and more.
Use:
```bash
dotnet new list
```

### Selecting a programming language
```bash
dotnet new console -n MyApp --language "C#"
dotnet new console -n MyApp --language "F#"
dotnet new console -n MyApp --language "VB"
```

- C# → creates a C# console app (default if you don’t specify)
- F# → creates an F# console app
- VB → creates a Visual Basic console app

### Common templates
```bash
dotnet new list
dotnet new console -n MyApp
// or
dotnet new classlib -n MyLib
dotnet new webapi -n MyApi
dotnet new web -n MyWeb
dotnet new mvc -n MyMvc
dotnet new blazor -n MyBlazor
dotnet new worker -n MyWorker
dotnet new xunit -n MyApp.Tests
dotnet new gitignore
dotnet new editorconfig
dotnet new sln -n MySolution
```

### Useful options

| Option | Example | Meaning |
|---|---|---|
| `-n`, `--name` | `-n MyApp` | Project name |
| `-o`, `--output` | `-o src/MyApp` | Output folder |
| `-f`, `--framework` | `-f net8.0` | Target framework |
| `--use-program-main` | | Classic `Main` instead of top-level statements |
| `--no-https` | | Skip HTTPS for web templates |
| `--auth` | `--auth Individual` | Authentication type for web templates |
| `--use-controllers` | | Controllers instead of minimal APIs |
| `--force` | | Overwrite existing files |

```bash
dotnet new webapi -n Orders.Api -o src/Orders.Api -f net8.0 --use-controllers
```

---

## 3. Restore, build, run, and clean

### Restore dependencies
```bash
dotnet restore
```
Most commands restore automatically when needed, but explicit restore is useful in CI or during troubleshooting.

### Build explicitly
```bash
dotnet build -c Release
```
This produces binaries in `bin/`.

### Run directly
```bash
dotnet run
```
`dotnet run` builds and runs under the hood.

### Typical build/run commands
```bash
dotnet build
dotnet build -c Release
dotnet build --no-restore
dotnet run
dotnet run --project src/Shop.Api
dotnet run -c Release
dotnet run -- --port 5001 --verbose
```

### Clean outputs
```bash
dotnet clean
```

### Watch mode
```bash
dotnet watch run
dotnet watch test
```

### Build options

| Option | Meaning |
|---|---|
| `-c`, `--configuration` | `Debug` (default) or `Release` |
| `-o`, `--output` | Output folder |
| `-f`, `--framework` | Build for one target framework |
| `-r`, `--runtime` | Runtime identifier (for example `linux-x64`) |
| `-v`, `--verbosity` | `q`, `m`, `n`, `d`, `diag` |
| `--no-restore` / `--no-build` | Skip restore/build |

**Run profile / environment**
```bash
dotnet run --launch-profile https
ASPNETCORE_ENVIRONMENT=Development dotnet run
# PowerShell:
$env:ASPNETCORE_ENVIRONMENT="Development"; dotnet run
```

**File-based apps (.NET 10+)**
```bash
dotnet run hello.cs
```

---

## 4. Solutions and multiple projects

Create a solution and add projects:
```bash
dotnet new sln -n MySolution
dotnet new classlib -n MyLib
dotnet new console -n MyApp
dotnet sln MySolution.sln add MyLib/MyLib.csproj
dotnet sln MySolution.sln add MyApp/MyApp.csproj
```

Reference a project:
```bash
cd MyApp
dotnet add reference ../MyLib/MyLib.csproj
```

### Modern solution workflow
```bash
dotnet new sln -n Shop
dotnet new webapi -n Shop.Api -o src/Shop.Api
dotnet new classlib -n Shop.Core -o src/Shop.Core
dotnet new xunit -n Shop.Tests -o tests/Shop.Tests
dotnet sln add src/Shop.Api src/Shop.Core tests/Shop.Tests
dotnet add src/Shop.Api reference src/Shop.Core
dotnet add tests/Shop.Tests reference src/Shop.Core
```

In recent SDKs (.NET 10+) `dotnet new sln` creates a `.slnx` file by default; older SDKs create `.sln`.

```bash
dotnet sln list
dotnet sln remove src/Shop.Api/Shop.Api.csproj
```

---

## 5. NuGet packages

```bash
dotnet add package Newtonsoft.Json
dotnet add package Serilog --version 3.1.1
dotnet add package Serilog --prerelease
dotnet remove package Newtonsoft.Json
dotnet list package
dotnet list package --outdated
dotnet list package --vulnerable --include-transitive
dotnet list package --deprecated
```

Add a package to a specific project:
```bash
dotnet add src/Shop.Api package Dapper
```

### Package versioning
```bash
dotnet add package Newtonsoft.Json --version 13.0.3
```

### NuGet sources
```bash
dotnet nuget list source
dotnet nuget add source https://my.feed/v3/index.json -n MyFeed
dotnet nuget remove source MyFeed
dotnet nuget locals all --clear
```

### Pack and publish your own package
```bash
dotnet pack -c Release -o ./nupkgs
dotnet nuget push ./nupkgs/MyLib.1.0.0.nupkg --api-key <KEY> --source https://api.nuget.org/v3/index.json
```

### Install local package for testing
```bash
dotnet add package MyLibrary --source ./bin/Release
dotnet add package MyLibrary --version 1.0.0
```

---

## 6. Project references

```bash
dotnet add src/Shop.Api reference src/Shop.Core
dotnet remove src/Shop.Api reference src/Shop.Core
dotnet list src/Shop.Api reference
```

---

## 7. Testing

Create a test project:
```bash
dotnet new xunit -n MyApp.Tests
```
Then add it to the solution:
```bash
dotnet sln add MyApp.Tests/MyApp.Tests.csproj
```

Reference the app under test:
```bash
dotnet add MyApp.Tests/MyApp.Tests.csproj reference MyApp/MyApp.csproj
```

Run tests:
```bash
dotnet test
dotnet test tests/Shop.Tests
dotnet test --no-build
dotnet test --filter "FullyQualifiedName~OrderServiceTests"
dotnet test --filter "Category=Unit"
dotnet test --filter "Name=Should_Add_Item"
dotnet test --logger "console;verbosity=detailed"
dotnet test --collect:"XPlat Code Coverage"
dotnet test --list-tests
```

---

## 8. Publish and deploy

Publishing packages your app so it can run elsewhere on a server, VM, container, or PC.

When you build, you get compiled files for development. When you publish, .NET does the extra work of copying dependencies, preparing the runtime, and producing deployable output.

### Types of publish

| Type | Runtime Included? | Target Machine Needs .NET? | Size |
|---|---|---|---|
| Framework-dependent | ❌ No | ✅ Yes | Smaller |
| Self-contained | ✅ Yes | ❌ No | Bigger |
| Single-file | Depends on `--self-contained` | Varies | One executable |
| Trimmed | No | No | Smaller |
| Native AOT | No | No | Fast startup, smaller, restrictions |

### Framework-dependent deployment (FDD)
```bash
dotnet publish -c Release
```
Output typically: `bin/Release/netX.Y/publish/`

### Self-contained deployment (SCD)
```bash
dotnet publish -c Release -r win-x64 --self-contained true
```
This runs even if .NET is not installed.

### Single-file publish
```bash
dotnet publish -c Release -r win-x64 --self-contained false /p:PublishSingleFile=true
# or
dotnet publish -c Release /p:PublishSingleFile=true
```

### More publish examples
```bash
dotnet publish -c Release -o ./publish
# includes runtime
dotnet publish -c Release -r linux-x64 --self-contained
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true
dotnet publish -c Release -p:PublishTrimmed=true -r linux-x64 --self-contained
dotnet publish -c Release -p:PublishAot=true -r linux-x64
dotnet publish --os linux --arch x64 -c Release
```

Run the published app:
```bash
dotnet ./publish/Shop.Api.dll
```

**Common RIDs:** `win-x64`, `win-arm64`, `linux-x64`, `linux-arm64`, `osx-x64`, `osx-arm64`

### Real-world deployment example

You built a WPF app and got a `.dll`. Another person cannot easily run a DLL directly.

They need either an EXE or an installer.

#### Option 1 — Publish as EXE (most common)
```bash
dotnet publish -c Release -r win-x64 --self-contained true
```
Now inside: `bin/Release/net8.0-windows/win-x64/publish/`

You will see a `YourApp.exe`.

#### Option 2 — Single-file EXE (cleaner)
```bash
dotnet publish -c Release -r win-x64 /p:PublishSingleFile=true --self-contained true
```

#### Option 3 — Framework-dependent EXE (smaller)
```bash
dotnet publish -c Release -r win-x64 --self-contained false
```

### CI/CD flow
```bash
git push -> CI build -> dotnet publish -> artifact -> deploy -> restart service
```

---

## 9. Containers (SDK built-in, no Dockerfile)

```bash
dotnet publish -c Release /t:PublishContainer
dotnet publish -c Release /t:PublishContainer -p:ContainerRepository=shop-api -p:ContainerImageTags='"1.0;latest"'
```

(For ASP.NET Core / worker projects. On older SDKs, add the `Microsoft.NET.Build.Containers` package first.)

---

## 10. Entity Framework Core (`dotnet-ef` tool)

Install once, then use from the project folder or pass `-p` / `-s`:

```bash
dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialCreate
dotnet ef migrations add AddOrderStatus -p src/Shop.Data -s src/Shop.Api
dotnet ef migrations list
dotnet ef migrations remove
dotnet ef database update
dotnet ef database update InitialCreate
dotnet ef database update 0
dotnet ef migrations script -o migrate.sql
dotnet ef migrations script --idempotent -o migrate.sql
dotnet ef dbcontext scaffold "Server=.;Database=Shop;Trusted_Connection=True;TrustServerCertificate=True" Microsoft.EntityFrameworkCore.SqlServer -o Models
dotnet ef dbcontext list
```

Needs the `Microsoft.EntityFrameworkCore.Design` package in the startup project.

---

## 11. Tools

```bash
dotnet tool install --global dotnet-ef
dotnet tool install dotnet-reportgenerator-globaltool --tool-path ./tools
dotnet tool list --global
dotnet tool update --global dotnet-ef
dotnet tool uninstall --global dotnet-ef
dotnet tool search ef
```

### Local (per-repo) tools via manifest
```bash
dotnet new tool-manifest
dotnet tool install dotnet-ef
dotnet tool restore
dotnet tool run dotnet-ef
```

Handy tools: `dotnet-ef`, `dotnet-format`, `dotnet-outdated-tool`, `dotnet-counters`, `dotnet-trace`, `dotnet-dump`, `dotnet-reportgenerator-globaltool`.

---

## 12. Format and analyze

```bash
dotnet format
dotnet format --verify-no-changes
dotnet format whitespace
dotnet format style
dotnet format analyzers
```

---

## 13. User secrets (development config)

```bash
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Default" "Server=...;******"
dotnet user-secrets list
dotnet user-secrets remove "ConnectionStrings:Default"
dotnet user-secrets clear
```

---

## 14. HTTPS development certificate

```bash
dotnet dev-certs https --trust
dotnet dev-certs https --check
dotnet dev-certs https --clean
```

---

## 15. Workloads (MAUI, WASM, etc.)

```bash
dotnet workload list
dotnet workload search
dotnet workload install maui
dotnet workload update
dotnet workload uninstall maui
```

---

## 16. Handy project-level tweaks (via `-p:` or `.csproj`)

```bash
dotnet build -p:Version=1.2.3
dotnet build -p:TreatWarningsAsErrors=true
dotnet build -p:DefineConstants=MY_FLAG
dotnet publish -p:PublishReadyToRun=true -r win-x64 --self-contained
```

---

## 17. Common workflows

### New Web API from scratch
```bash
dotnet new webapi -n Shop.Api --use-controllers
cd Shop.Api
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet ef migrations add InitialCreate
dotnet ef database update
dotnet watch run
```

### CI pipeline (typical steps)
```bash
dotnet restore
dotnet build -c Release --no-restore
dotnet test -c Release --no-build --collect:"XPlat Code Coverage"
dotnet format --verify-no-changes --no-restore
dotnet publish src/Shop.Api -c Release -o ./out --no-build
```

### Clean slate when things act weird
```bash
dotnet clean
rm -rf bin obj
# PowerShell:
Remove-Item -Recurse -Force bin,obj
dotnet nuget locals all --clear
dotnet restore
dotnet build
```

---

## 18. Troubleshooting quick hits

| Problem | Try |
|---|---|
| "No SDK found" / wrong version | `dotnet --list-sdks`, check `global.json` |
| Package won't restore | `dotnet nuget locals all --clear` then `dotnet restore` |
| Stale build output | `dotnet clean`, delete `bin/` and `obj/` |
| `dotnet ef` not found | `dotnet tool install --global dotnet-ef` or `dotnet tool restore` |
| Need more build detail | add `-v detailed` or `-bl` to create `msbuild.binlog` |
| Port in use | `dotnet run --urls "http://localhost:5050"` |
| HTTPS cert warning | `dotnet dev-certs https --trust` |

---

## Quick memory aid

```text
new → add → restore → build → run → test → publish
```

---

## Quick start summary

```bash
dotnet new console -n MyApp
dotnet restore
dotnet build -c Release
dotnet run
dotnet add package Newtonsoft.Json
dotnet test
dotnet publish -c Release -o ./publish
```

This is the essential loop for most .NET development work.

### What I Recommend For You (Based on Your Learning Stage)

Since you're aiming to become production ready:

Step 1 → Learn publish EXE
Step 2 → Learn single-file publish
Step 3 → Learn ClickOnce
Step 4 → Later MSIX / WiX

