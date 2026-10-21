using System;
using System.IO;
using System.Text;

static void FileOps()
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