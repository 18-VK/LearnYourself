using System;
using System.Threading;

class Program
{
    static void Main()
    {
        Thread t = new Thread(DoWork)
        {
            Name = "WorkerThread",
            IsBackground = false,                         // keep process alive
            Priority = ThreadPriority.AboveNormal
        };

        Console.WriteLine($"Main ID: {Thread.CurrentThread.ManagedThreadId}");

        t.Start();

        while (t.IsAlive)
        {
            Console.WriteLine($"Thread state: {t.ThreadState}");
            Thread.Sleep(500);
        }

        t.Join();   // ensure finished before exiting
        Console.WriteLine("Worker completed");
    }

    static void DoWork()
    {
        Console.WriteLine($"[{Thread.CurrentThread.Name}] started");
        Thread.Sleep(1500);                                // simulate work
        Console.WriteLine($"[{Thread.CurrentThread.Name}] done");
    }
}
