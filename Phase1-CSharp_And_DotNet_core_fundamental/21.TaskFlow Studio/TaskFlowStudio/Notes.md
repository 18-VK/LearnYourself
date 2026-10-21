# This is a classic autosave problem

If a background process saves in-memory changes without explicit user intent, it MUST be treated as a draft, not
a final save.

- If you treat it as a final save → ❌ design bug
- If you treat it as autosave/draft → ✅ correct

**What is actually happening**

```text
User edits UI
→ ViewModel updates in-memory entity
→ Background service calls SaveChanges()
→ Data persisted
```

EF Core cannot tell whether the change was "confirmed" or not.

So YOU must decide the semantics.

## When this is WRONG

Saving in background is wrong if:

- User expects Save button to be authoritative
- There is business validation
- Undo / cancel is expected
- "Cancel" should discard changes
- Legal / financial / irreversible data

**Example:**

User edits invoice amount → autosave commits → user clicks Cancel → too late ❌

## Correct production patterns (choose one)

### 🟢 Pattern 1: Draft vs Final (BEST PRACTICE)

**DB design**

```text
Task
- Id
- Title
- Description
- IsDraft
- LastAutoSavedAt
```

**Flow**

- Background saves → `IsDraft = true`
- User clicks Save → `IsDraft = false`
- Cancel → discard draft

- ✔ Used by Google Docs
- ✔ Used by Jira
- ✔ Used by IDEs

| Action           | What happens        |
| ---------------- | ------------------- |
| User types       | In-memory changes   |
| Autosave runs    | Draft saved         |
| User closes app  | Draft exists        |
| User clicks Save | Draft becomes Final |

### 1️⃣ Database design (foundation)

**Example: TaskItem table**

```csharp
public class TaskItem
{
    public int Id { get; set; }

    public int ProjectId { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    // ⭐ Draft tracking
    public bool IsDraft { get; set; }
    public DateTime LastAutoSavedAt { get; set; }

    public Project Project { get; set; } = null!;
}
```

**Meaning**

| Column            | Purpose                   |
| ----------------- | ------------------------- |
| `IsDraft`         | Distinguish auto vs final |
| `LastAutoSavedAt` | UI feedback, recovery     |

### 2️⃣ UI editing flow (VERY IMPORTANT)

❌ **Wrong (what many beginners do)**

```xml
<TextBox Text="{Binding Task.Description}" />
```

This binds EF entity directly → dangerous.

✅ **Correct (production)**

```xml
<TextBox Text="{Binding EditableDescription, UpdateSourceTrigger=PropertyChanged}" />
```

You edit ViewModel state, not EF entity.

### 3️⃣ Autosave implementation

**Autosave service (background)**

```csharp
public async Task AutoSaveAsync(TaskItem task)
{
    task.IsDraft = true;
    task.LastAutoSavedAt = DateTime.UtcNow;

    await _dbContext.SaveChangesAsync();
}
```

**Key points**

- ✔ Saves without user confirmation
- ✔ Marks as draft
- ✔ Does NOT finalize

### 4️⃣ Explicit Save (user clicks Save)

```csharp
public async Task SaveAsync()
{
    _task.IsDraft = false;
    await _dbContext.SaveChangesAsync();
}
```

**Meaning**

> "User has confirmed this data"

### 5️⃣ Cancel behavior (this is why the pattern exists)

**User clicks Cancel**

```csharp
public void Cancel()
{
    if (_task.IsDraft)
    {
        _dbContext.Entry(_task).Reload(); // discard
    }
}
```

- ✔ Draft is discarded
- ✔ DB returns to last final state

### 6️⃣ App crash / restart recovery

**On app startup**

```csharp
var drafts = db.TaskItems
    .Where(t => t.IsDraft)
    .ToList();
```

UI shows:

```text
You have unsaved drafts.
Resume?
```

- ✔ Zero data loss
- ✔ User stays in control

### 7️⃣ UI feedback (critical UX detail)

| State           | UI Text                |
| --------------- | ---------------------- |
| Draft autosaved | "Draft saved at 14:31" |
| Final saved     | "Saved ✔"              |
| Unsaved changes | "Unsaved changes"      |

# Inside a background service, how can you be sure this is the "same instance" that is actually doing the tasks, e.g., querying or saving to the database?

## 1️⃣ The lifetime of the instance

When you registered your repository like this:

```csharp
services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
```

you told the DI container:

> "Whenever someone asks for `IRepository<T>` within a scope, give the same instance."

Then, inside your background service, when you create a scope:

```csharp
using var scope = _scopeFactory.CreateScope();
```

…this is a new DI scope.

When you resolve:

```csharp
var myRepo = scope.ServiceProvider.GetRequiredService<IRepository<MyEntity>>();
```

the DI container:

- Checks: "Do I already have an instance of `IRepository<MyEntity>` in this scope?"
- If no, it creates a new instance and stores it inside this scope.
- If yes, it returns the existing instance.

✅ This guarantees that all repository calls inside this scope share the same instance, including the `DbContext`
inside it.

## 2️⃣ Why this matters for tasks

Your `EfRepository` usually depends on `DbContext`:

```csharp
public class EfRepository<T> : IRepository<T> where T : class
{
    private readonly AppDbContext _context;
    public EfRepository(AppDbContext context)
    {
        _context = context;
    }

    public Task<List<T>> GetAllAsync() => _context.Set<T>().ToListAsync();
    public Task SaveChangesAsync() => _context.SaveChangesAsync();
}
```

Since both `EfRepository` and `DbContext` are scoped, and you resolved them inside the same scope, all operations
(`GetAllAsync`, `SaveChangesAsync`, etc.) use the same `DbContext` instance.

That means if you:

```csharp
var tasks = await myRepo.GetAllAsync();
tasks[0].Status = "Processed";
await myRepo.SaveChangesAsync();
```

…the changes are tracked by that same `DbContext`, and when you call `SaveChangesAsync`, they persist to the database. ✅

# Add validation so your app fails fast if config is wrong

```csharp
services.AddOptions<ApplicationSettings>()
    .Bind(context.Configuration.GetSection("ApplicationSettings"))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

# If after _host.StartAsync() lines are not getting hit

## ✅ METHOD 1 (BEST): Force DI validation at build time

By default, Generic Host does NOT validate DI.
So missing / broken registrations fail silently at runtime.

🔹 **Enable full DI validation**

```csharp
_host = Host.CreateDefaultBuilder(e.Args)
    .UseDefaultServiceProvider(options =>
    {
        options.ValidateScopes = true;
        options.ValidateOnBuild = true; // 🔥 THIS is the key
    })
    .ConfigureServices((context, services) =>
    {
        // services...
    })
    .UseSerilog(...)
    .Build();
```

✅ **Result**

If any service is broken, you will immediately get a clear exception like:

```text
InvalidOperationException:
Unable to resolve service for type
'IMessageBusService' while attempting to activate
'AutoSaveBackgroundService'
```

👉 This is the single most important fix you should keep permanently.

## ✅ METHOD 2: Wrap StartAsync() and log exceptions

This catches hosted service startup failures.

```csharp
try
{
    _ = _host.StartAsync().ContinueWith(t =>
    {
        if (t.Exception != null)
        {
            MessageBox.Show(
                t.Exception.Flatten().ToString(),
                "Host startup failed");
        }
    }, TaskContinuationOptions.OnlyOnFaulted);
}
catch (Exception ex)
{
    MessageBox.Show(ex.ToString(), "Host.StartAsync sync failure");
}
```

🔹 **This reveals:**

- Background service constructor errors
- `ExecuteAsync` startup failures

## ✅ METHOD 3: Temporarily isolate hosted services (binary search)

When you have multiple background services:

```csharp
// services.AddHostedService<AutoSaveBackgroundService>();
// services.AddHostedService<AnotherService>();
```

Enable one at a time:

```csharp
services.AddHostedService<AutoSaveBackgroundService>();
```

- ✔️ If app breaks → this is the offender
- ✔️ If app starts → enable next

This is crude but effective.

## ✅ METHOD 4: Explicitly resolve suspicious services

Force DI to resolve services before `StartAsync`:

```csharp
using var scope = _host.Services.CreateScope();

// Try resolving manually
scope.ServiceProvider.GetRequiredService<IMessageBusService>();
scope.ServiceProvider.GetRequiredService<TaskItemService>();
scope.ServiceProvider.GetRequiredService<AutoSaveBackgroundService>();
```

💥 The exact failing service will throw immediately.

## ✅ METHOD 5: Enable first-chance exceptions in Visual Studio

This catches swallowed exceptions.

**Steps**

- Debug → Windows → Exception Settings
- Enable:
  - ✔️ Common Language Runtime Exceptions
- Check:
  - ✔️ Break on thrown

Now when `StartAsync()` throws:

- Visual Studio will break on the exact line
- Even if WPF swallows it

## 🚨 MOST COMMON REAL PROBLEMS (from your code)

Based on what you showed, 90% likely one of these:

### ❌ 1. Scoped service inside singleton background service

```csharp
services.AddHostedService<AutoSaveBackgroundService>(); // Singleton
services.AddScoped<TaskItemService>(); // Scoped
```

✔️ **Correct usage (you already fixed this):**

```csharp
using var scope = _scopeFactory.CreateScope();
```

### ❌ 2. Missing registration

**Example:**

```csharp
AutoSaveBackgroundService(
    IMessageBusService bus, // not registered
    IOptions<ApplicationSettings> settings // missing Configure<>
)
```

✔️ **Fix:**

```csharp
services.AddSingleton<IMessageBusService, MessageBusService>();
services.Configure<ApplicationSettings>(
    context.Configuration.GetSection("ApplicationSettings"));
```

### ❌ 3. AppSettings value missing

```json
"ApplicationSettings": {
  "AutoSaveIntervalSeconds": 10
}
```

If missing → constructor throws.

## 🟢 RECOMMENDED FINAL SETUP (KEEP THIS)

```csharp
_host = Host.CreateDefaultBuilder(e.Args)
    .UseDefaultServiceProvider(o =>
    {
        o.ValidateScopes = true;
        o.ValidateOnBuild = true;
    })
    .ConfigureServices(...)
    .UseSerilog(...)
    .Build();
```

This single setting will save you days of debugging in the future.

# For AddScoped Service

It can't be got from the service provider directly — it needs `CreateScope`.

**E.g.:**

```csharp
using var scope = _host.Services.CreateScope();
var projectService = scope.ServiceProvider.GetRequiredService<ProjectService>();
```

In WPF:

- There is NO automatic scope (unlike ASP.NET)
- Scoped services (DbContext, repositories) must live inside a scope
- A scope should represent a UI lifetime boundary

## BEST PLACES to create scopes (in order)

**WindowService / NavigationService (BEST)**

**Why this is the best place**

- A window has a clear lifetime
- When window closes → scope can be disposed
- All ViewModels + services in that window share one scope
- Matches mental model of "per window unit of work"

**Example: WindowService creates scope per window**

```csharp
public class WindowService : IWindowService
{
    private readonly IServiceProvider _rootProvider;

    public WindowService(IServiceProvider rootProvider)
    {
        _rootProvider = rootProvider;
    }

    public void Show<TWindow, TViewModel>()
        where TWindow : Window
        where TViewModel : class
    {
        var scope = _rootProvider.CreateScope();

        var window = scope.ServiceProvider.GetRequiredService<TWindow>();
        window.Closed += (_, __) => scope.Dispose();

        window.Show();
    }
}
```


✔ Clean
✔ Automatic disposal
✔ No leaks
✔ Scoped DbContext works perfectly


# services.AddOptions<T>() vs services.Configure<T>()

These are two ways to configure the Options Pattern in .NET/ASP.NET Core.  Both ultimately do the same thing under the hood, but AddOptions<T>() 
returns an OptionsBuilder<T> that unlocks additional capabilities.

When They're Equivalent
```csharp
// These two do EXACTLY the same thing:
services.Configure<MyOptions>(config.GetSection("MyOptions"));

services.AddOptions<MyOptions>()
        .Bind(config.GetSection("MyOptions"));

Both register a transient IConfigureNamedOptions<T> that binds the configuration section to your options class. 

When AddOptions<T>() Is Better
// ✅ Full power: Bind + Validate + Fail Fast
builder.Services.AddOptions<MyOptions>()
    .Bind(builder.Configuration.GetSection("MyOptions"))
    .ValidateDataAnnotations()   // Uses [Required], [Range], etc.
    .ValidateOnStart();          // Throws at startup if invalid

// ❌ Can't do this with services.Configure<T>() alone
services.Configure<MyOptions>(config.GetSection("MyOptions"));
// No validation, no chaining

When Configure<T>() Is Still Fine
// Simple case: just bind config, no validation needed
services.Configure<MyOptions>(config.GetSection("MyOptions"));

// Or: manual configuration with an Action
services.Configure<MyOptions>(options =>
{
    options.MaxRetries = 3;
    options.Timeout = TimeSpan.FromSeconds(30);
});
```csharp