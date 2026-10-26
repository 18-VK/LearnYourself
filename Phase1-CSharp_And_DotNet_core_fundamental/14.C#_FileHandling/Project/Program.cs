using System;
using System.IO;
using System.Text;

class Program
{
    static async Task Main()
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
        String Filepath = Path.Combine(Environment.CurrentDirectory, "exampleSample.txt");
        using (var fs = new FileStream(Filepath, FileMode.OpenOrCreate, FileAccess.Write, FileShare.None, 4046, FileOptions.Asynchronous))
        {
            string StrContent = "Hello, this is async write using FileStream!";

            // Convert string to byte array
            byte[] buffer = Encoding.UTF8.GetBytes(StrContent);

            await fs.WriteAsync(buffer);
            Console.WriteLine(Encoding.UTF8.GetChars(buffer));
        }
    }
}