# Steps to run a `.cs` file without creating any project

1. Create a `.cs` file (e.g., `program.cs`)
2. Open terminal in VS Code and run:

   ```bash
   csc program.cs
   ```

3. Run the compiled `.exe` (Windows):

   ```bash
   ./program.exe
   ```

   or on Linux/macOS:

   ```bash
   mono program.exe
   ```

> **Note:** `csc` and `mono` above are the .NET Framework / Mono toolchain. On modern .NET, use one of the options below.

## .NET 10 and later

```bash
dotnet run program.cs
```

## Earlier .NET versions (6 to 9): dotnet script

`dotnet script` is a community global tool, not part of the SDK. Install it once, then run the file:

```bash
dotnet tool install -g dotnet-script
dotnet script <filename>
```
