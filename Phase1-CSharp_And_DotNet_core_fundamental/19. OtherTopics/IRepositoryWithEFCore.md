# IRepository

Repository is a layer that abstracts data access logic from the rest of the application.
This is a user-defined interface that provides methods to access and manipulate data source.

# Explained using EFCore as Data source

Instead of writing EF Core code everywhere:

```csharp
_context.Orders.Add(order);
_context.SaveChanges();
```

You hide it behind:

```csharp
_orderRepository.Add(order);
```

## Why do we need IRepository?

**Problems without Repository ❌**

- EF Core code spread everywhere
- Tight coupling to `DbContext`
- Hard to test (mocking `DbContext` is painful)
- Business logic polluted with data access logic

**Benefits with Repository ✅**

- ✔ Separation of concerns
- ✔ Easier unit testing
- ✔ Centralized data access
- ✔ Clean architecture (Service → Repository → DB)

## Repository pattern structure

```text
UI / ViewModel / Controller
        ↓
     Service
        ↓
   IRepository<T>
        ↓
   EF Core (DbContext)
        ↓
     Database
```

## Step-by-step implementation with EF Core

### Step 1️⃣ Entity

```csharp
public class Order
{
    public int Id { get; set; }
    public string CustomerName { get; set; }
    public decimal Amount { get; set; }
}
```

### Step 2️⃣ DbContext

```csharp
public class AppDbContext : DbContext
{
    public DbSet<Order> Orders => Set<Order>();

    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }
}
```

### Step 3️⃣ IRepository&lt;T&gt; (Generic Repository)

```csharp
public interface IRepository<T> where T : class
{
    T? GetById(int id);
    IEnumerable<T> GetAll();
    void Add(T entity);
    void Update(T entity);
    void Delete(T entity);
    void Save();
}
```

### Step 4️⃣ EF Core Repository implementation

```csharp
public class EfRepository<T> : IRepository<T> where T : class
{
    protected readonly AppDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public EfRepository(AppDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public T? GetById(int id)
        => _dbSet.Find(id);

    public IEnumerable<T> GetAll()
        => _dbSet.ToList();

    public void Add(T entity)
        => _dbSet.Add(entity);

    public void Update(T entity)
        => _dbSet.Update(entity);

    public void Delete(T entity)
        => _dbSet.Remove(entity);

    public void Save()
        => _context.SaveChanges();
}
```

✔ EF Core logic is fully hidden

### 5️⃣ Injecting Repository using DI

```csharp
services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
```

**Why Scoped?**

- `DbContext` is scoped per request / operation
- Repository should share the same lifetime

### 6️⃣ Using Repository in Service layer

```csharp
public class OrderService
{
    private readonly IRepository<Order> _orderRepository;

    public OrderService(IRepository<Order> orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public void CreateOrder(Order order)
    {
        _orderRepository.Add(order);
        _orderRepository.Save();
    }

    public IEnumerable<Order> GetOrders()
        => _orderRepository.GetAll();
}
```

- ✔ No EF Core here
- ✔ Easy to mock `IRepository<Order>`

### 7️⃣ Using Repository in Controller / ViewModel

```csharp
public class OrderViewModel
{
    private readonly OrderService _service;

    public OrderViewModel(OrderService service)
    {
        _service = service;
    }

    public void SaveOrder()
    {
        _service.CreateOrder(new Order
        {
            CustomerName = "Aman",
            Amount = 1000
        });
    }
}
```

### Register services in DI

`App.xaml.cs`

```csharp
public partial class App : Application
{
    public IHost Host { get; }

    public App()
    {
        Host = Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                services.AddDbContext<AppDbContext>(options =>
                    options.UseSqlServer("connection-string"));

                services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
                services.AddScoped<OrderService>();

                services.AddTransient<OrderViewModel>();
                services.AddTransient<MainWindow>();
            })
            .Build();
    }

    protected override void OnStartup(StartupEventArgs e)
    {
        Host.Start();

        var window = Host.Services.GetRequiredService<MainWindow>();
        window.Show();
    }
}
```

## When to use which?

### ✅ Use open generic (BEST PRACTICE)

```csharp
services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
```

**When:**

- ✔ Generic repository pattern
- ✔ Many entities
- ✔ EF Core based app
- ✔ Clean architecture

This is 99% of cases.

### ✅ Use closed generic (special case)

```csharp
services.AddScoped<IRepository<Order>, EfRepository<Order>>();
```

**When:**

- ✔ Only one entity
- ✔ Special repository logic
- ✔ You want different implementation per entity

## Common mistakes ❌

**❌ Registering open generic but implementation is not generic**

```csharp
services.AddScoped(typeof(IRepository<>), typeof(OrderRepository)); // ❌
```

Implementation must also be generic.

**❌ Forgetting DbContext registration**

```csharp
services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
// but no AddDbContext
```

➡ DI resolution failure
