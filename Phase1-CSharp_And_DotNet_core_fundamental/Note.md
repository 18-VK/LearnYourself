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

> **Note:** for newer versions like .NET 8 and 9

## For version 7

```bash
dotnet script <filename>
```
