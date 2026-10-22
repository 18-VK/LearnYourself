/**
 * Every C# (and console-output) block the Phase 1 visualizers show, copied verbatim from the notes.
 *
 * The code panels render these strings and the trace generators resolve their highlighted lines from them
 * (`lines(SNIPPETS.x.code, {...})`), so a trace can't point at a line that isn't there. `verbatim.ts` hands
 * every entry to the content pipeline, which fails the build if a string no longer appears inside a fenced
 * block of its note. Text blocks (sample output) are checked the same way.
 *
 * Generated once from the notes with the pipeline's own loader; edit by hand only to follow a note change.
 */
export interface Snippet {
  /** Repo-relative note path, exact case. */
  file: string;
  /** The heading the block sits under (for error messages and the panel's source line). */
  heading: string;
  code: string;
}

export const SNIPPETS = {
  fundStruct: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/1.C#_Basics/C#_Fundamentals.md",
    heading: "### 1.5 Struct",
    code: `struct Point {
    public int X;
    public int Y;
}
Point p;
p.X = 10;
p.Y = 20;`,
  },
  fundClass: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/1.C#_Basics/C#_Fundamentals.md",
    heading: "### 4.1 Class",
    code: `class Person {
    public string Name;
    public int Age;
}
Person p = new Person();`,
  },
  fundString: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/1.C#_Basics/C#_Fundamentals.md",
    heading: "### 2.1 String",
    code: `string name = "Aman";       // Creates a string object with value "Aman"
name = "Rahul";             // Creates a new string object with value "Rahul"`,
  },
  fundObject: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/1.C#_Basics/C#_Fundamentals.md",
    heading: "### 2.2 Object",
    code: `object obj = 123;`,
  },
  svcStruct: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/6.C#_OOP/Struct_vs_Class.md",
    heading: "## Struct",
    code: `public struct Point
{
    public int X { get; set; }
    public int Y { get; set; }
}

Point first = new Point { X = 10, Y = 20 };
Point second = first;

second.X = 100;

Console.WriteLine(first.X);  // 10
Console.WriteLine(second.X); // 100`,
  },
  svcClass: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/6.C#_OOP/Struct_vs_Class.md",
    heading: "## Class",
    code: `public class Person
{
    public string Name { get; set; } = string.Empty;
}

Person first = new Person { Name = "Aman" };
Person second = first;

second.Name = "Rahul";

Console.WriteLine(first.Name);  // Rahul
Console.WriteLine(second.Name); // Rahul`,
  },
  svcQuick: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/6.C#_OOP/Struct_vs_Class.md",
    heading: "## Quick Example",
    code: `Point point1 = new Point { X = 1, Y = 2 };
Point point2 = point1;
point2.X = 10;

Person person1 = new Person { Name = "Aman" };
Person person2 = person1;
person2.Name = "Rahul";

Console.WriteLine(point1.X);  // 1
Console.WriteLine(person1.Name); // Rahul`,
  },
  svcBoxing: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/6.C#_OOP/Struct_vs_Class.md",
    heading: "## Boxing and Unboxing",
    code: `int number = 10;
object boxed = number; // Boxing

int copy = (int)boxed;  // Unboxing`,
  },
  oopBox: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/6.C#_OOP/Note.md",
    heading: "### Boxing",
    code: `int num = 10;           // value type (stored on stack)
object obj = num;       // Boxing (num copied into obj on heap)`,
  },
  oopUnbox: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/6.C#_OOP/Note.md",
    heading: "### Unboxing",
    code: `object obj = 20;        // Boxing
int num = (int)obj;     // Unboxing (explicit cast required)`,
  },
  oopStructBox: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/6.C#_OOP/Note.md",
    heading: "### Boxing / Unboxing",
    code: `Point p = new Point { X = 1 };
object o = p;        // boxing: copy of p placed on heap
Point p2 = (Point)o; // unboxing: copy back`,
  },
  asyncGetData: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/13.C#_AsynchronousProgramming/Note.md",
    heading: "### How to Return Data with Async Programming",
    code: `public async Task<string> GetDataAsync()
{
    // simulate a task like fetching data from a database
    await Task.Delay(1000);

    return "Sample Data";
}`,
  },
  dlAsyncProblem: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/DeadlockNRaceCondition.md",
    heading: "### Async/await deadlock (UI or legacy SynchronizationContext)",
    code: `// UI thread
string GetDataSync() => GetDataAsync().Result; // blocks UI thread

async Task<string> GetDataAsync()
{
    await Task.Delay(1000); // by default captures the UI context
    return "data";
}`,
  },
  dlAsyncFix: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/DeadlockNRaceCondition.md",
    heading: "### Async/await deadlock (UI or legacy SynchronizationContext)",
    code: `async Task UseDataAsync()
{
    string data = await GetDataAsync();
    // update UI
}`,
  },
  otDemo: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/OtherTopics.md",
    heading: "## 3) Example: seeing the thread flow",
    code: `static async Task Demo()
{
    Console.WriteLine($"Before await: {Thread.CurrentThread.ManagedThreadId}");

    await Task.Run(() => {
        Console.WriteLine($"Task running on: {Thread.CurrentThread.ManagedThreadId}");
        Thread.Sleep(500);
    });

    Console.WriteLine($"After await:  {Thread.CurrentThread.ManagedThreadId}");
}`,
  },
  otDemoConsole: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/OtherTopics.md",
    heading: "## 3) Example: seeing the thread flow",
    code: `Before await: 1
Task running on: 4
After await:  5  // Different ThreadPool thread`,
  },
  otDemoWpf: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/OtherTopics.md",
    heading: "## 3) Example: seeing the thread flow",
    code: `Before await: 1
Task running on: 4
After await:  1  // Back to UI thread`,
  },
  otThrottle: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/OtherTopics.md",
    heading: "### Example",
    code: `using System;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    static SemaphoreSlim sem = new SemaphoreSlim(2); // allow 2 concurrent

    static async Task Worker(int id)
    {
        await sem.WaitAsync();
        try
        {
            Console.WriteLine($"[{id}] Entered. CurrentCount={sem.CurrentCount}");
            await Task.Delay(1000); // simulate async work while inside
            Console.WriteLine($"[{id}] Leaving.");
        }
        finally
        {
            int prev = sem.Release();
            Console.WriteLine($"[{id}] Released (previous count was {prev}).");
        }
    }

    static async Task Main()
    {
        var tasks = new Task[5];
        for (int i = 0; i < tasks.Length; i++) tasks[i] = Worker(i);
        await Task.WhenAll(tasks);
        sem.Dispose();
    }
}`,
  },
  dlDeadlock: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/DeadlockNRaceCondition.md",
    heading: "### Classic deadlock: inconsistent lock ordering",
    code: `using System;
using System.Threading;

class DeadlockDemo
{
    static readonly object lockA = new();
    static readonly object lockB = new();

    static void Main()
    {
        var t1 = new Thread(() => {
            lock (lockA)
            {
                Thread.Sleep(100); // simulate work
                lock (lockB) { Console.WriteLine("T1 got both"); }
            }
        });

        var t2 = new Thread(() => {
            lock (lockB)
            {
                Thread.Sleep(100);
                lock (lockA) { Console.WriteLine("T2 got both"); }
            }
        });

        t1.Start(); t2.Start();
        t1.Join(); t2.Join();
        Console.WriteLine("Done");
    }
}`,
  },
  dlFixOrder: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/DeadlockNRaceCondition.md",
    heading: "### Fix 1 — consistent lock ordering",
    code: `// Acquire lockA then lockB everywhere
lock (lockA)
{
    lock (lockB)
    {
        // safe
    }
}`,
  },
  dlRace: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/DeadlockNRaceCondition.md",
    heading: "### Example: lost increments",
    code: `using System;
using System.Threading;

class RaceDemo
{
    static int counter = 0;
    static void Main()
    {
        Thread[] threads = new Thread[10];
        for (int i = 0; i < 10; i++)
        {
            threads[i] = new Thread(() =>
            {
                for (int j = 0; j < 100_000; j++)
                {
                    counter++; // not atomic -> race
                }
            });
            threads[i].Start();
        }
        foreach (var t in threads) t.Join();
        Console.WriteLine($"Counter = {counter} (expected 1_000_000)");
    }
}`,
  },
  dlLockFix: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/DeadlockNRaceCondition.md",
    heading: "### Fix A — `lock`",
    code: `static object sync = new();
...
lock (sync)
{
    counter++;
}`,
  },
  dlInterlocked: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/DeadlockNRaceCondition.md",
    heading: "### Fix B — `Interlocked` (fast, atomic)",
    code: `using System.Threading;
Interlocked.Increment(ref counter);`,
  },
  dviDeferred: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/DeferredVsImmediate.md",
    heading: "### 🕓 Deferred Execution Example",
    code: `var numbers = new List<int> { 1, 2, 3, 4 };

// Query definition (not executed yet)
var query = numbers.Where(n => n > 2);

// Modify the source BEFORE iterating
numbers.Add(5);

// Now execution happens during iteration
foreach (var n in query)
{
    Console.WriteLine(n);
}`,
  },
  dviImmediate: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/DeferredVsImmediate.md",
    heading: "### ⚡ Immediate Execution Example",
    code: `var numbers = new List<int> { 1, 2, 3, 4 };

// Query executed immediately by ToList()
var result = numbers.Where(n => n > 2).ToList();

// Modify the source
numbers.Add(5);

// Iterating over the result
foreach (var n in result)
{
    Console.WriteLine(n);
}`,
  },
  linqSelect: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/Notes.md",
    heading: "### 2) `Select(selector)`",
    code: `var squares = nums.Select(n => n * n);`,
  },
  diCounter: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Dependency_Injection.md",
    heading: "## Scoped vs Transient",
    code: `public interface ICounter
{
    int Id { get; }
}

public class Counter : ICounter
{
    private static int _next = 0;
    public int Id { get; } = Interlocked.Increment(ref _next);
}

public class ServiceA
{
    public ICounter Counter { get; }
    public ServiceA(ICounter counter) => Counter = counter;
}

public class ServiceB
{
    public ICounter Counter { get; }
    public ServiceB(ICounter counter) => Counter = counter;
}

[ApiController]
public class TestController : ControllerBase
{
    private readonly ServiceA _a;
    private readonly ServiceB _b;

    public TestController(ServiceA a, ServiceB b)
    {
        _a = a;
        _b = b;
    }

    [HttpGet("/test")]
    public IActionResult Get()
    {
        return Ok(new {
            ServiceA_CounterId = _a.Counter.Id,
            ServiceB_CounterId = _b.Counter.Id
        });
    }
}`,
  },
  diTransientOut: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Dependency_Injection.md",
    heading: "## Scoped vs Transient",
    code: `Request 1:  ServiceA gets Counter #1,  ServiceB gets Counter #2   ← different
Request 2:  ServiceA gets Counter #3,  ServiceB gets Counter #4   ← different`,
  },
  diScopedOut: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Dependency_Injection.md",
    heading: "## Scoped vs Transient",
    code: `Request 1:  ServiceA gets Counter #1,  ServiceB gets Counter #1   ← SAME
Request 2:  ServiceA gets Counter #2,  ServiceB gets Counter #2   ← SAME (but new from req 1)`,
  },
  diSingletonOut: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Dependency_Injection.md",
    heading: "## Scoped vs Transient",
    code: `Request 1:  ServiceA gets Counter #1,  ServiceB gets Counter #1   ← SAME
Request 2:  ServiceA gets Counter #1,  ServiceB gets Counter #1   ← SAME (forever)`,
  },
  diCaptive: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Dependency_Injection.md",
    heading: "## The Captive Dependency trap",
    code: `// BUG: Singleton captures a Scoped service

public class MySingleton
{
    private readonly IScopedService _scoped; // This instance lives forever now!
    public MySingleton(IScopedService scoped) => _scoped = scoped;
}`,
  },
  diScopeFactory: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Dependency_Injection.md",
    heading: "## The Captive Dependency trap",
    code: `public class MyBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _factory;
    public MyBackgroundService(IServiceScopeFactory factory) => _factory = factory;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var scope = _factory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // db is now properly scoped to this block
    }
}`,
  },
  efInsert: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore/Notes.md",
    heading: "## Inserting Data",
    code: `using (var db = new EFContext())
{
    // 1️⃣ Create a new entity
    var product = new Product
    {
        Name = "Laptop",
        Price = 75000
    };

    // 2️⃣ Add to DbSet
    db.Products.Add(product);      // Or AddAsync(product) in async code

    // 3️⃣ Save to database
    db.SaveChanges();              // Or await context.SaveChangesAsync()
    
    Console.WriteLine($"Product inserted with ID: {product.Id}");
}`,
  },
  efUpdate: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore/Notes.md",
    heading: "## Update the Record",
    code: `static void updateProduct()
{
    using (var db = new EFContext())
    {
        Product product = db.Products.Find(1); // or can use where
        product.Name = "Better Pen Drive";
        db.SaveChanges();
    }
    return;
}`,
  },
  efDelete: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore/Notes.md",
    heading: "## Delete the Record",
    code: `static void deleteProduct()
{
    using (var db = new EFContext())
    {
 
        Product product = db.Products.Find(1);
        if (product !=null) 
        {   
            db.Products.Remove(product);
            db.SaveChanges();
        }
    }
    return;
}`,
  },
  efNoTracking: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore/Notes.md",
    heading: "# What is AsNoTracking()?",
    code: `using (var context = new AppDbContext())
{
    // Normal tracked query
    var trackedCustomer = context.Customers.FirstOrDefault(c => c.Id == 1);
    trackedCustomer.Name = "Updated Name";
    context.SaveChanges();  // ✅ Works — entity is tracked

    // No-tracking query
    var untrackedCustomer = context.Customers
                                   .AsNoTracking()
                                   .FirstOrDefault(c => c.Id == 2);

    untrackedCustomer.Name = "Won't be saved";
    context.SaveChanges();  // ❌ No effect — not tracked
}`,
  },
  efLazyLoop: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore/Notes2.md",
    heading: "### 2. Lazy Loading",
    code: `using var context = new SchoolContext();

var students = context.Students.ToList();

foreach (var s in students)
{
    // Lazy loading triggers separate query here
    Console.WriteLine($"{s.Name} - {s.Courses.Count}");
}`,
  },
  qNPlusOne: {
    file: "Phase2-ASP.NetAndBackend/SQLTutorial/11.Question.md",
    heading: "## Example (Entity Framework)",
    code: `var users = context.Users.ToList();

foreach (var user in users)
{
    var orders = context.Orders
        .Where(o => o.UserId == user.Id)
        .ToList();
}`,
  },
  qInclude: {
    file: "Phase2-ASP.NetAndBackend/SQLTutorial/11.Question.md",
    heading: "### 🔸 1. Eager Loading (Best Solution)",
    code: `var users = context.Users
    .Include(u => u.Orders)
    .ToList();`,
  },
  qProjection: {
    file: "Phase2-ASP.NetAndBackend/SQLTutorial/11.Question.md",
    heading: "### 🔸 2. Projection",
    code: `var users = context.Users
    .Select(u => new {
        u.Name,
        Orders = u.Orders
    })
    .ToList();`,
  },
  delAction: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/5.C#_delegates/Note.md",
    heading: "## Multicast behavior (`+=` / `-=`)",
    code: `Action a = () => Console.WriteLine("A");
a += () => Console.WriteLine("B");
a(); // prints A then B`,
  },
  delNotify: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/5.C#_delegates/Note.md",
    heading: "### 2. Multicast delegate",
    code: `public delegate void Notify();

public class Alerts
{
    public void SendEmail() => Console.WriteLine("Email sent");
    public void SendSMS() => Console.WriteLine("SMS sent");
}

class Program
{
    static void Main()
    {
        Alerts alerts = new Alerts();
        Notify notify = alerts.SendEmail;
        notify += alerts.SendSMS;

        notify(); // Calls both methods
    }
}`,
  },
  evButton: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/EventsNEventHandling.md",
    heading: "# How it works (Publisher-Subscriber Model)",
    code: `using System;

// 1. Define a delegate for the event
public delegate void ButtonClickHandler(object sender, EventArgs e);

public class Button
{
    // 2. Declare an event using the delegate
    public event ButtonClickHandler Click;

    // 3. Method to raise the event
    public void SimulateClick()
    {
        Console.WriteLine("Button is being clicked...");
        // Check if there are any subscribers before raising the event
        Click?.Invoke(this, EventArgs.Empty); 
    }
}

public class Program
{
    public static void Main(string[] args)
    {
        Button myButton = new Button();

        // 4. Subscribe an event handler
        myButton.Click += MyButton_Click;

        // 5. Simulate the event
        myButton.SimulateClick();

        // 6. Unsubscribe the event handler
        myButton.Click -= MyButton_Click;

        // Simulate again, no output from handler
        myButton.SimulateClick(); 
    }

    // 4. Event handler method
    private static void MyButton_Click(object sender, EventArgs e)
    {
        Console.WriteLine("Button was clicked! (Handler executed)");
    }
}`,
  },
  evSensor: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/EventsNEventHandling.md",
    heading: "# How it works (Publisher-Subscriber Model)",
    code: `using System;

// 1) custom EventArgs to carry data
public class TemperatureChangedEventArgs : EventArgs
{
    public double Old { get; }
    public double New { get; }
    public TemperatureChangedEventArgs(double oldTemp, double newTemp)
    {
        Old = oldTemp;
        New = newTemp;
    }
}

// 2) Publisher
public class TemperatureSensor
{
    private double _temp;
    // standard event pattern
    public event EventHandler<TemperatureChangedEventArgs>? TemperatureChanged; // this is the event

    public double Temperature
    {
        get => _temp;
        set
        {
            if (Math.Abs(_temp - value) < 0.0001) return;
            var old = _temp;
            _temp = value;
            OnTemperatureChanged(old, _temp);
        }
    }

    // protected virtual so subclasses can override/extend behavior
    protected virtual void OnTemperatureChanged(double oldVal, double newVal)
    {
        // capture local copy for thread-safety
        var handler = TemperatureChanged;
        handler?.Invoke(this, new TemperatureChangedEventArgs(oldVal, newVal)); // raise the event
    }
}

// 3) Subscriber
public class Display
{
    public void Subscribe(TemperatureSensor sensor)
    {
        sensor.TemperatureChanged += Sensor_TemperatureChanged;
    }

    private void Sensor_TemperatureChanged(object? sender, TemperatureChangedEventArgs e) // this is the event handler
    {
        Console.WriteLine($"Temp changed from {e.Old} to {e.New}");
    }
}

public class Program
{
    public static void Main(string[] args)
    {
        var sensor = new TemperatureSensor(); //Publisher
        var display = new Display(); // subscriber
        display.Subscribe(sensor);

        sensor.Temperature = 22.5; // publishing new data
        sensor.Temperature = 23.0; // publishing new data
    }
}`,
  },
  exBasic: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/12.C#_ExceptionHandling/Note.md",
    heading: "# Exception Handling in C",
    code: `using System;

class BasicExample
{
    static void Main()
    {
        try
        {
            Console.WriteLine("Before exception");
            int x = int.Parse("not-a-number"); // throws FormatException
            Console.WriteLine("This line will NOT run");
        }
        catch (FormatException ex)
        {
            Console.WriteLine("Caught FormatException: " + ex.Message);
        }
        catch (Exception ex) // fallback for unexpected exceptions
        {
            Console.WriteLine("General error: " + ex.Message);
        }
        finally
        {
            // Runs whether or not an exception was thrown
            Console.WriteLine("Finally block: cleanup here");
        }
    }
}`,
  },
  exRethrow: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/12.C#_ExceptionHandling/Note.md",
    heading: "## Re-Throwing exceptions",
    code: `using System;

class Program
{
    static void Main()
    {
        try
        {
            ProcessData();
        }
        catch (Exception ex)
        {
            Console.WriteLine("Exception caught in Main: " + ex.Message);
        }
    }

    static void ProcessData()
    {
        try
        {
            int[] numbers = { 1, 2, 3 };
            Console.WriteLine(numbers[5]); // This will throw IndexOutOfRangeException
        }
        catch (Exception ex)
        {
            Console.WriteLine("Exception caught in ProcessData: " + ex.Message);
            throw; // Re-throws the same exception
        }
    }
}`,
  },
  exCustomThrow: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/12.C#_ExceptionHandling/Note.md",
    heading: "### 🔹 Step 2: Throw the Custom Exception",
    code: `public class BankAccount
{
    private decimal balance;

    public BankAccount(decimal initialBalance)
    {
        balance = initialBalance;
    }

    public void Withdraw(decimal amount)
    {
        if (amount > balance)
        {
            throw new InsufficientFundsException(
                $"Cannot withdraw {amount}. Available balance is {balance}.");
        }

        balance -= amount;
        Console.WriteLine($"Withdrawal successful! Remaining balance: {balance}");
    }
}`,
  },
  exCustomCatch: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/12.C#_ExceptionHandling/Note.md",
    heading: "### 🔹 Step 3: Catch and Handle the Custom Exception",
    code: `class Program
{
    static void Main()
    {
        BankAccount account = new BankAccount(500);

        try
        {
            account.Withdraw(700); // Will throw custom exception
        }
        catch (InsufficientFundsException ex)
        {
            Console.WriteLine($"Custom Exception Caught: {ex.Message}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"General Exception: {ex.Message}");
        }
    }
}`,
  },
  sbFull: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/8.C#_String/StringBuilder.md",
    heading: "## Full Example Demonstrating All",
    code: `using System;
using System.Text;

class Program
{
    static void Main()
    {
        StringBuilder sb = new StringBuilder("Hello");

        sb.Append(" World");
        sb.AppendLine("!");
        sb.Insert(6, "C# ");
        sb.Replace("World", "Universe");

        Console.WriteLine(sb); // Output: Hello C# Universe!

        sb.Remove(6, 3);
        Console.WriteLine(sb); // Output: Hello Universe!

        Console.WriteLine($"Length: {sb.Length}, Capacity: {sb.Capacity}");
    }
}`,
  },
  strInsert: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/8.C#_String/Note.md",
    heading: "### 10. `Insert()`",
    code: `string str = "Hello";
string result = str.Insert(5, " World");
Console.WriteLine(result);  // Output: Hello World`,
  },
  strReplace: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/8.C#_String/Note.md",
    heading: "### 13. `Replace()`",
    code: `string str = "Hello World";
Console.WriteLine(str.Replace("World", "C#"));
// Output: Hello C#`,
  },
  strReassign: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/8.C#_String/Note.md",
    heading: "# C# Strings",
    code: `string name = "Aman";       // Creates a string object with value "Aman"
name = "Rahul";             // Creates a new string object with value "Rahul"`,
  },
  tpMain: {
    file: "Phase1-CSharp_And_DotNet_core_fundamental/17..C#_ThreadsAndMultithreading/ThreadpoolAndTask.md",
    heading: "### 2) Example with main thread activity",
    code: `using System;
using System.Threading;

class Program
{
    static void Main()
    {
        Console.WriteLine($"[Main]   ID: {Thread.CurrentThread.ManagedThreadId}");

        // Queue a background task on the ThreadPool
        ThreadPool.QueueUserWorkItem(WorkerTask, "Task 1");

        Console.WriteLine("[Main]   Doing other work...");

        // Simulate some main thread work
        for (int i = 1; i <= 5; i++)
        {
            Console.WriteLine($"[Main]   Step {i}");
            Thread.Sleep(500);
        }

        // Wait a bit so we can observe ThreadPool activity
        Thread.Sleep(3000);

        Console.WriteLine("[Main]   Finished");
    }

    // ThreadPool callback signature: void(object state)
    static void WorkerTask(object state)
    {
        Console.WriteLine($"[Worker] Started on ID: {Thread.CurrentThread.ManagedThreadId}, State: {state}");

        for (int i = 1; i <= 3; i++)
        {
            Console.WriteLine($"[Worker] Processing {i}");
            Thread.Sleep(700); // simulate work
        }

        Console.WriteLine("[Worker] Done");
    }
}`,
  },
} satisfies Record<string, Snippet>;

export type SnippetKey = keyof typeof SNIPPETS;

/** "Struct_vs_Class.md › ## Struct": the short source label shown above a code panel. */
export function sourceLabel(key: SnippetKey): string {
  const s = SNIPPETS[key];
  return `${s.file.split('/').pop()} › ${s.heading.replace(/^#+\s*/, '')}`;
}
