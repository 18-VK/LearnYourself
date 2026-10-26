using System;
using System.Threading;
using System.Threading.Tasks;

async Task MainEntry()
{
    var result = await MakeTeaAsync();
    Console.WriteLine($"{result}, Thread {Thread.CurrentThread.ManagedThreadId}");
}
async Task<string> MakeTeaAsync()
{
    var boilingWater = BoilWaterAsync();
    Console.WriteLine($"take the cups out, Thread {Thread.CurrentThread.ManagedThreadId}");
    Console.WriteLine($"put tea in cups, Thread {Thread.CurrentThread.ManagedThreadId}");
    var water = await boilingWater;
    var tea = $"pour {water} in cups";
    return tea;
}
async Task<string> BoilWaterAsync()
{
    Console.WriteLine($"Start the kettle, Thread {Thread.CurrentThread.ManagedThreadId}");
    Console.WriteLine($"waiting for the kettle, Thread {Thread.CurrentThread.ManagedThreadId}");
    await Task.Delay(2000);
    Console.WriteLine($"kettle finished boiling, Thread {Thread.CurrentThread.ManagedThreadId}");
    return "water";
}

await MainEntry();