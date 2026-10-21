# MemoryStream in C#

A `MemoryStream` is a stream that stores data in memory (RAM) instead of on disk.

**Namespace:** `System.IO`

It is useful when:

- You want temporary data storage in memory
- Convert data to/from byte arrays
- Work with XML/JSON serialization without writing files
- Prepare data to send via network, API, or database.

## Properties

| Property      | Description                                             |
| ------------- | ------------------------------------------------------- |
| `Capacity`    | Total size of internal buffer (auto-expands if needed). |
| `Length`      | Number of bytes written to stream.                      |
| `Position`    | Current cursor (read/write pointer).                    |
| `CanRead`     | `true` if stream supports reading.                      |
| `CanWrite`    | `true` if stream supports writing.                      |
| `CanSeek`     | `true` if stream supports seeking.                      |
| `ToArray()`   | Copies the stream content to a new `byte[]`.            |
| `GetBuffer()` | Returns underlying buffer (may include unused bytes).   |

## Methods

| Method                     | Usage Example                               |
| -------------------------- | ------------------------------------------- |
| `Write(byte[], int, int)`  | Write data into stream.                     |
| `Read(byte[], int, int)`   | Read data from stream.                      |
| `Seek(offset, SeekOrigin)` | Move cursor (beginning, current, end).      |
| `Flush()`                  | Clears buffer (not needed much for memory). |
| `SetLength(n)`             | Resize stream.                              |
| `CopyTo(Stream)`           | Copy contents to another stream.            |
| `Dispose()` / `Close()`    | Release resources.                          |
