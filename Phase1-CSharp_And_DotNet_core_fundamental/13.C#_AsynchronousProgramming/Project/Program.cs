using System;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        Console.WriteLine($"Main start: Thread {Thread.CurrentThread.ManagedThreadId}");
        await func();
        Console.WriteLine($"Main end: Thread {Thread.CurrentThread.ManagedThreadId}");
    }

    static async Task func()
    {
        var task = DemoAsync();
        Console.WriteLine($"func start: Thread {Thread.CurrentThread.ManagedThreadId}");
        await task;
        Console.WriteLine($"func completed: Thread {Thread.CurrentThread.ManagedThreadId}");
    }
    static async Task DemoAsync()
    {
        Console.WriteLine($"Demo start: Thread {Thread.CurrentThread.ManagedThreadId}");

        // This simulates async I/O. No thread is blocked while waiting.
        await Task.Delay(500); // Free current thread for other task, assign a new thread from threadpool for this task..
        Console.WriteLine($"After Task.Delay: Thread {Thread.CurrentThread.ManagedThreadId}");

        //// Task.Run schedules work on a thread-pool thread (often different ID)
        //await Task.Run(() =>
        //{
        //    Console.WriteLine($"Inside Task.Run: Thread {Thread.CurrentThread.ManagedThreadId}");
        //    Thread.Sleep(200); // blocking inside thread-pool thread (only this thread is blocked)
        //});

        //Console.WriteLine($"After Task.Run: Thread {Thread.CurrentThread.ManagedThreadId}");
    }
}
