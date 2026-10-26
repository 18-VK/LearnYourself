# File Handling in C#

## Basics & terminology

- **`System.IO.File`** — convenient static helpers (`ReadAllText`, `WriteAllBytes`, `Exists`, etc.). Good for small files.
- **`System.IO.FileInfo`** — object-oriented wrapper with same operations but instance-based.
- **`System.IO.FileStream`** — low-level stream for reading/writing bytes. Use for large files or streamed/async I/O.
- **`System.IO.StreamReader` / `StreamWriter`** — wrapper for text reading/writing over streams (handles encodings).
- **`System.IO.Path`** — path helpers (`Combine`, `GetFileName`, `GetExtension`).
- **`System.IO.Directory`** — directory helpers (`CreateDirectory`, `EnumerateFiles`).
- **`FileOptions.Asynchronous`** — hint for async `FileStream` usage.
- Always dispose streams (`using` or `using var`) to free resources.

## Usage of These

### 1) Simple text file — synchronous

```csharp
using System;
using System.IO;

class Program
{
    static void Main()
    {
        string path = Path.Combine(Environment.CurrentDirectory, "example.txt");

        // Write text (overwrites)
        File.WriteAllText(path, "Hello, file!\nLine 2");

        // Append text
        File.AppendAllText(path, "\nAppended line");

        // Read entire file
        string content = File.ReadAllText(path);
        Console.WriteLine(content);

        // Read lines lazily (streaming)
        foreach (var line in File.ReadLines(path))
        {
            Console.WriteLine("LINE: " + line);
        }
    }
}
```

Use `File.ReadAllText`/`WriteAllText` for small files. `File.ReadLines` returns an `IEnumerable<string>` and reads lazily
line-by-line.

### 2) Simple text file — asynchronous (recommended for non-blocking I/O)

```csharp
using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        string path = Path.Combine(Environment.CurrentDirectory, "example-async.txt");

        // Write text async (overwrites)
        await File.WriteAllTextAsync(path, "Hello async file!\nLine 2", Encoding.UTF8);

        // Append text async
        await File.AppendAllTextAsync(path, "\nAppended async line");

        // Read entire file async
        string content = await File.ReadAllTextAsync(path, Encoding.UTF8);
        Console.WriteLine(content);

        // Stream and read line-by-line async
        using var sr = new StreamReader(path, Encoding.UTF8);
        string? line;
        while ((line = await sr.ReadLineAsync()) != null)
        {
            Console.WriteLine("LINE-ASYNC: " + line);
        }
    }
}
```

`File.*Async` helpers are convenient and non-blocking — use in server or UI apps to avoid blocking threads.

### 3) Binary file — synchronous and async

```csharp
// Write bytes
byte[] data = { 0x01, 0x02, 0x03 };
File.WriteAllBytes("data.bin", data);

// Read bytes
byte[] read = File.ReadAllBytes("data.bin");

// Async via FileStream (good for large files)
using (var fs = new FileStream("large.bin", FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.Asynchronous))
{
    await fs.WriteAsync(read, 0, read.length);
}

// Read asyncLength
using (var fs = new FileStream("large.bin", FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous))
{
    byte[] buffer = new byte[8192];
    int bytesRead;
    while ((bytesRead = await fs.ReadAsync(buffer, 0, buffer.Length)) > 0)
    {
        // process bytesRead from buffer
    }
}
```

## StreamReader / StreamWriter in C#

Both are classes in `System.IO` namespace that work on top of streams (like `FileStream`) but are specialized for text
data (characters, strings).

### 1. StreamReader

- Used for reading text from a stream (like `FileStream`, `MemoryStream`, or even a network stream).
- Reads characters, lines, or the whole file as string.
- Handles encoding (UTF8 by default).

**Example (Read with StreamReader):**

```csharp
using System;
using System.IO;

class Program
{
    static void Main()
    {
        string path = "example.txt";

        // Write some content first
        File.WriteAllText(path, "Line1\nLine2\nLine3");

        // Reading file with StreamReader
        using (StreamReader reader = new StreamReader(path))
        {
            string line;
            while ((line = reader.ReadLine()) != null)
            {
                Console.WriteLine(line); // Reads line by line
            }
        }
    }
}
```

**Common Methods:**

- `Read()` → Reads one character
- `ReadLine()` → Reads a full line
- `ReadToEnd()` → Reads entire stream

### 2. StreamWriter

- Used for writing text into a stream (like `FileStream`, or directly into a file).
- Writes strings, characters, lines.
- Handles encoding (UTF8 by default).
- Has buffering → content may not be written until `Flush()` or `Close()`.

**Example (Write with StreamWriter):**

```csharp
using System;
using System.IO;

class Program
{
    static void Main()
    {
        string path = "output.txt";

        // Writing with StreamWriter
        using (StreamWriter writer = new StreamWriter(path))
        {
            writer.WriteLine("Hello, StreamWriter!");
            writer.WriteLine("This is line 2.");
            writer.Write("Partial line... ");
            writer.Write("continued here.");
        }

        Console.WriteLine("File written successfully.");
    }
}
```

**Common Methods:**

- `Write(string)` → Writes text without newline
- `WriteLine(string)` → Writes text + newline
- `Flush()` → Forces buffer to be written to file

### 🔑 Where They Fit vs FileStream

| Feature           | **FileStream**                    | **StreamReader / StreamWriter**              |
| ----------------- | --------------------------------- | -------------------------------------------- |
| Works With        | **Bytes**                         | **Characters / Strings (text only)**         |
| Encoding Handling | ❌ No                              | ✅ Yes (UTF-8, UTF-16, etc.)                  |
| Best For          | Binary files (images, PDFs, etc.) | Text files (logs, configs, JSON, etc.)       |
| Example           | `fs.Read(buffer, 0, len);`        | `reader.ReadLine();` / `writer.WriteLine();` |

## File modes & access (C# / System.IO)

### Quick definitions

- **`FileMode`** — how to open/create the file (create, open, truncate, append, etc.).
- **`FileAccess`** — what operations you plan to do (Read, Write, or ReadWrite).
- **`FileShare`** — what other processes/threads are allowed to do while you hold the file (Read, Write, None, etc.).
- **`FileOptions`** — advanced flags (Asynchronous, SequentialScan, RandomAccess, DeleteOnClose, etc.).

You pass these into `new FileStream(path, FileMode, FileAccess, FileShare, bufferSize, FileOptions)`.

### FileMode — meanings & when to use

| Value          |                                                                                        Behavior | Use-case                                       |
| -------------- | ----------------------------------------------------------------------------------------------: | ---------------------------------------------- |
| `CreateNew`    |                                                     Throw if file exists; otherwise create new. | You must not overwrite existing file (safety). |
| `Create`       |                                                           Create new or **overwrite** existing. | Replace an existing file.                      |
| `Open`         |                                                    Open existing file; **throws** if not found. | Read or update existing file only.             |
| `OpenOrCreate` |                                                                Open if exists, else create new. | Upsert-style open.                             |
| `Truncate`     |                   Open existing file and set length = 0 (clears contents). Throws if not found. | Replace contents but keep same file.           |
| `Append`       | Open if exists or create; position at end for writes. Only supports `Write` access effectively. | Add data to end (logs).                        |

### FileAccess

- **`Read`** — only read operations.
- **`Write`** — only write operations.
- **`ReadWrite`** — both read and write.

### FileShare — concurrency control

| Value         | Allowed for other processes while you hold the file             |
| ------------- | --------------------------------------------------------------- |
| `None`        | No other process/stream may open the file.                      |
| `Read`        | Others can open for **read** only.                              |
| `Write`       | Others can open for **write** only.                             |
| `ReadWrite`   | Others can open for read and/or write.                          |
| `Delete`      | Others can delete file while open (Windows-specific semantics). |
| `Inheritable` | Child processes inherit handle.                                 |

### FileOptions — useful flags

- **`Asynchronous`** — optimized for async I/O (use with async APIs).
- **`SequentialScan`** — hint for OS to optimize sequential reads.
- **`RandomAccess`** — hint for random-access patterns.
- **`DeleteOnClose`** — file deleted when handle closed.
- **`None`** — default.

**Example:** `FileOptions.SequentialScan` can improve performance for big file reads.
