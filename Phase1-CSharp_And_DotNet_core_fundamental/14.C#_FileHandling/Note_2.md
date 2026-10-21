# Path, Directory and File classes

## Path class

**Common uses:**

- `Path.Combine(...)` — join segments safely (use this, not string `+`).
- `Path.GetDirectoryName(path)` — parent folder.
- `Path.GetFileName(path)` / `GetFileNameWithoutExtension`.
- `Path.GetExtension(path)`.
- `Path.GetFullPath(path)` — normalize/resolve relative paths.
- `Path.GetTempPath()` / `GetRandomFileName()`.
- `Path.ChangeExtension(path, ".txt")`.
- `Path.DirectorySeparatorChar`, `Path.AltDirectorySeparatorChar`.
- `Path.GetInvalidFileNameChars()` / `GetInvalidPathChars()`.

## Directory (directory-level I/O)

**Common methods:**

- `Directory.Exists(path)` — check existence.
- `Directory.CreateDirectory(path)` — creates (no-op if exists).
- `Directory.Delete(path, recursive: true/false)` — delete.
- `Directory.Move(src, dest)` — rename/move directory.
- `Directory.GetFiles(path, pattern)` — returns array (eager).
- `Directory.EnumerateFiles(path, pattern)` — returns enumerable (lazy).
- `Directory.GetDirectories(...)`, `EnumerateDirectories(...)`.
- `Directory.GetCurrentDirectory()` / `Directory.SetCurrentDirectory()`.

## `Directory.GetFiles(path, pattern)` vs `Directory.EnumerateFiles(path, pattern)`

### `Directory.GetFiles(path, pattern)`

**Returns:** `string[]` (array of file paths).

**Behavior:**

- Enumerates all matching files immediately (eager execution).
- Loads the entire result set into memory before you can use it.

**Good for:** Small directories where you need all results at once.

### `Directory.EnumerateFiles(path, pattern)`

**Returns:** `IEnumerable<string>` (lazy sequence of file paths).

**Behavior:**

- Uses lazy evaluation (files are returned one by one as you iterate).
- Does not load all results into memory upfront.
- More efficient when working with large directories.

**Good for:**

- Millions of files.
- You want to stop after first few results.
- Streaming processing (process each file as it comes).

## File (file-level I/O, convenience static methods)

**Common methods:**

- `File.Exists(path)`
- `File.WriteAllText(path, text)` / `File.ReadAllText(path)`
- `File.WriteAllBytes` / `File.ReadAllBytes`
- `File.AppendAllText(path, text)`
- `File.Copy(source, dest, overwrite: bool)`
- `File.Move(source, dest)` — throws if dest exists (no overwrite param).
- `File.Delete(path)`
- `File.Open(path, FileMode, FileAccess, FileShare)` — returns `FileStream` for advanced scenarios
- **Async:** `File.ReadAllTextAsync`, `File.WriteAllTextAsync`
