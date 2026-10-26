using System;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Reflection.Metadata;
using System.Threading;
using System.Timers;
using System.Collections.Concurrent;
using System.Threading.Tasks;

namespace Multithreading
{
    class ClsMain
    {
        //Prac1 : Create 3 threads; each prints "Hello from thread <id>" and exits.Main waits for all threads to finish
        private static void Prac1Helper()
        {
            Console.WriteLine($"Hello from thread {Thread.CurrentThread.ManagedThreadId}");
        }
        public static void Practice1()
        {
            Console.WriteLine($"Main thread :  {Thread.CurrentThread.ManagedThreadId}");

            Thread[] threads = { new Thread(Prac1Helper), new Thread(Prac1Helper), new Thread(Prac1Helper) };
            // start thread
            foreach (Thread thrd in threads)
            {
                thrd.Start();
            }
            foreach (Thread thrd in threads)
            {
                if (!thrd.Join(TimeSpan.FromSeconds(5)))
                {
                    Console.WriteLine($"Thread {thrd.ManagedThreadId} did not finish in 5 seconds.");
                    // decide how to proceed
                }
            }
            Console.WriteLine($"Main thread :  {Thread.CurrentThread.ManagedThreadId}");
        }
        /*Parameter Thread
            Start a thread that takes a string parameter and prints it 5 times with a 200ms delay.Use both 
            ParameterizedThreadStart and a lambda version.
        */
        private static void PrintMessage(string Str)
        {
            for (int i = 0; i < 5; i++)
            {
                Console.WriteLine("Str");
                Task.Delay(200);
            }

        }
        private static async Task practice2()
        {
            string Str = "Paramterized thread example";
            Task Task1 = new Task(() => PrintMessage(Str)); // just declared
            Task1.Start(); //Manually start
            await Task1;
            return;
        }

        /* Shared Counter(race), prove race condition 

           Spawn 10 threads; each increments a shared int 10000 times without synchronization.Print final value and observe
           it’s < 100000. (Prove the race.)
        */
        static int counter;
        private static void Increment()
        {
            for (int i = 0; i < 10000; i++)
            {
                ClsMain.counter++;
            }
        }
        private static void Practice3()
        {
            Thread[] Threads = new Thread[10];
            for (int i = 0; i < Threads.Length; i++)
            {
                Threads[i] = new Thread(Increment);
                Threads[i].Start();
            }
            foreach(Thread thrd in Threads)
            {
                if (!thrd.Join(TimeSpan.FromSeconds(5)))
                {
                    Console.WriteLine($"Thread {thrd.ManagedThreadId} did not finish in 5 seconds.");
                    // decide how to proceed
                }
            }
            Console.WriteLine(ClsMain.counter);
        }
        /* Fix the Counter
        Repeat problem #3 but make the final value exactly 100000 using lock.
        */
        private static object obj = new();
        private static void IncrementWithLock()
        {
            lock(obj)
            {
                for (int i = 0; i < 10000; i++)
                {
                    ClsMain.counter++;
                }
            }
        }
        private static void Practice4()
        {
            Thread[] Threads = new Thread[10];
            for (int i = 0; i < Threads.Length; i++)
            {
                Threads[i] = new Thread(IncrementWithLock);
                Threads[i].Start();
            }
            foreach (Thread thrd in Threads)
            {
                if (!thrd.Join(TimeSpan.FromSeconds(5)))
                {
                    Console.WriteLine($"Thread {thrd.ManagedThreadId} did not finish in 5 seconds.");
                    // decide how to proceed
                }
            }
            Console.WriteLine(ClsMain.counter);
        }
        /*Thread Priority Demo
        Create two CPU-bound threads with different Thread.Priority values.Run for 3s and report iteration counts for each.
        */
        private static int CounterHigherPriority;
        private static int CounterLowerPriority;

        private static void Practice5()
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));

            Thread thrdHigh = new Thread(() => {
                try
                {
                    while (!cts.Token.IsCancellationRequested)
                    {
                        CounterHigherPriority++;
                    }
                    cts.Token.ThrowIfCancellationRequested();
                }catch(OperationCanceledException)
                {
                    Console.WriteLine("Cancelled called : " + Thread.CurrentThread.ManagedThreadId);
                }
                
            }) { Priority = ThreadPriority.Highest };


            Thread thrdlow = new Thread(() => {
                try
                {
                    while (!cts.Token.IsCancellationRequested)
                    {
                        CounterLowerPriority++;
                    }
                    cts.Token.ThrowIfCancellationRequested();
                }
                catch (OperationCanceledException)
                {
                    Console.WriteLine("Cancelled called : " + Thread.CurrentThread.ManagedThreadId);
                }
            
            }) { Priority = ThreadPriority.Lowest };

         
            
            thrdlow.Start();
            thrdHigh.Start();

            //wait for cancellation, not mandatory
            //cts.Token.WaitHandle.WaitOne();

            thrdlow.Join();
            thrdHigh.Join();
           
            Console.WriteLine(ClsMain.CounterHigherPriority);
            Console.WriteLine(ClsMain.CounterLowerPriority);
        }
        /*
         * Bounded Work Queue
           Create a bounded BlockingCollection (capacity 5). Start 3 producers (each producing 20 items) and 4 
           consumers. Ensure producers block when full.
         */

        private static async Task Practice6()
        {
            var BlockCollection = new BlockingCollection<int>( boundedCapacity : 5) ; // capacity 5

            Task Prod = Task.Run(() =>
            {
                for(int i = 0; i< 15; i++)
                {
                    BlockCollection.Add(i);
                    Console.WriteLine("Produce number : " + i);
                }
                BlockCollection.CompleteAdding();
            });

            Task Consumer = Task.Run(() =>
            {
                foreach(var consumer in BlockCollection.GetConsumingEnumerable())
                {
                    
                    Console.WriteLine("Consumer number : " + consumer);
                    Thread.Sleep(100);
                }
               
            });
            Task.WaitAll(Prod, Consumer);
        }
        /*
         SemaphoreSlim Throttling
         Create 10 tasks that call an async worker; permit only 3 concurrent workers via SemaphoreSlim. Each worker 
         delays 1s then completes. Verify concurrency never exceeds 3.
         */
        // allow up to 3 concurrent workers
        private static SemaphoreSlim SemaSlim = new SemaphoreSlim(initialCount: 3, maxCount: 3);

        // for verification only
        private static int currentConcurrent = 0;
        private static int maxObserved = 0;

        private static async Task DoWork(int id)
        {
            await SemaSlim.WaitAsync();
            try
            {
                int now = Interlocked.Increment(ref currentConcurrent);
                Interlocked.Exchange(ref maxObserved, Math.Max(maxObserved, now));

                Console.WriteLine($"[{DateTime.Now:HH:mm:ss.fff}] Task {id} entered. concurrent={now}");

                // asynchronous non-blocking delay
                await Task.Delay(500);

                Console.WriteLine($"[{DateTime.Now:HH:mm:ss.fff}] Task {id} completed.");
            }
            finally
            {
                Interlocked.Decrement(ref currentConcurrent);
                SemaSlim.Release();
            }
        }

        private static async Task Practice7()
        {
            Task[] tasks = new Task[10];
            for (int i = 0; i < 10; i++)
            {
                int copy = i; // capture loop variable safely
                tasks[i] = Task.Run(() => DoWork(copy));
            }

            await Task.WhenAll(tasks);
            Console.WriteLine($"All done. maxObserved concurrency = {maxObserved}");
        }
        public static async Task Main(string[] args)
        {
            //Practice1();
            //await practice2();
            //Practice3();
            //Practice4();
            //Practice5();
            //Practice6();
            await Practice7();
        }
    }
}
