# Dapper in C#: from first query to production

C# Dapper is a lightweight ORM. In the world of software development, interacting with databases is a common
task. Developers often use Object-Relational Mapping (ORM) tools to simplify the process of database
operations. Dapper is one such ORM tool. Dapper is a lightweight, open-source library that provides simple and
fast database operations.

- Dapper = micro-ORM: very thin mapper on top of ADO.NET. You write SQL, it maps rows to C# objects fast.
- Main benefits: tiny surface area, near-ADO.NET performance, automatic POCO mapping.

These notes go from the first query to a production-ready data layer in ASP.NET Core.

## 1. When to use Dapper

Use Dapper when you want full control of SQL and near-raw ADO.NET speed. Skip it if you need change tracking, migrations or LINQ-to-SQL; EF Core fits that better. Many production apps use both: EF Core for writes and migrations, Dapper for hot read paths and reports.

## 2. Setup

### Install the packages

```bash
dotnet add package Dapper
dotnet add package Microsoft.Data.SqlClient
```

Then add `using Microsoft.Data.SqlClient;` and `using Dapper;`. Use `Microsoft.Data.SqlClient`, not the old `System.Data.SqlClient`.

### Open a connection

**Example:**

```csharp
using Microsoft.Data.SqlClient;
using Dapper;

var cs = "Server=.;Database=Shop;Trusted_Connection=True;";
using var conn = new SqlConnection(cs);
await conn.OpenAsync();           // open explicitly when needed
// use conn with Dapper
// once disposed (using) it returns to pool
```

### Put the connection string in configuration

```json
{
  "ConnectionStrings": {
    "Default": "Server=...;Database=...;User Id=...;Password=...;TrustServerCertificate=False;Encrypt=True;Max Pool Size=100;Connect Timeout=15"
  }
}
```

Keep secrets in User Secrets locally and in environment variables or a vault (Azure Key Vault) in production, never in source control.

### Create a connection factory

```csharp
public interface IDbConnectionFactory
{
    Task<IDbConnection> CreateOpenConnectionAsync(CancellationToken ct = default);
}

public sealed class SqlConnectionFactory : IDbConnectionFactory
{
    private readonly string _cs;
    public SqlConnectionFactory(IConfiguration config) =>
        _cs = config.GetConnectionString("Default")
              ?? throw new InvalidOperationException("Missing connection string");

    public async Task<IDbConnection> CreateOpenConnectionAsync(CancellationToken ct = default)
    {
        var conn = new SqlConnection(_cs);
        await conn.OpenAsync(ct);
        return conn;
    }
}
```

Connections are pooled by ADO.NET, so opening one per operation and disposing it quickly is the correct pattern. Do not keep a connection in a singleton field.

## 3. Querying data

### Example : Querying data

```csharp
// POCO
public class Product { 
    public int Id {get;set;}
    public string Sku {get;set;} 
    public string Name {get;set;} 
    public decimal Price {get;set;} 
}

// Query all
IEnumerable<Product> products = conn.Query<Product>("SELECT Id, Sku, Name, Price FROM Products");

// Single by parameter (safe)
var product = conn.QuerySingleOrDefault<Product>(
    "SELECT Id, Sku, Name, Price FROM Products WHERE Sku = @sku",
    new { sku = "A100" });
```

**Notes:**

- Dapper maps columns → properties by name (case-insensitive).
- Use anonymous object for parameters; Dapper parameterizes automatically.

### Methods

Every method has a sync and an async version; the async one returns a `Task` of the same result (for example `QueryAsync<T>` returns `Task<IEnumerable<T>>`).

| Method (sync / async) | Returns | Use for |
| --- | --- | --- |
| `Query<T>` / `QueryAsync<T>` | `IEnumerable<T>` (buffered by default) | Many rows |
| `QueryFirst<T>`, `QueryFirstOrDefault<T>` (+ `Async`) | `T` / `T?` | First row; `QueryFirst` throws if there is none, `QueryFirstOrDefault` returns null |
| `QuerySingle<T>`, `QuerySingleOrDefault<T>` (+ `Async`) | `T` / `T?` | Exactly one row expected; throws if there is more than one |
| `Execute` / `ExecuteAsync` | rows affected (int) | INSERT, UPDATE, DELETE |
| `ExecuteScalar<T>` / `ExecuteScalarAsync<T>` | single value | COUNT, new identity |
| `QueryMultiple` / `QueryMultipleAsync` | `GridReader` | Several result sets in one round trip |

A typical query in an app:

```csharp
using var conn = await _factory.CreateOpenConnectionAsync(ct);

const string sql = @"
    SELECT Id, Title, Status, DueDate
    FROM Tasks
    WHERE UserId = @UserId AND Status = @Status
    ORDER BY DueDate";

var tasks = await conn.QueryAsync<TaskItem>(
    new CommandDefinition(sql, new { UserId = userId, Status = status }, cancellationToken: ct));
```

Always pass values as parameters. Never build SQL by concatenating user input; that is how SQL injection happens. Wrapping the call in `CommandDefinition` lets you pass the cancellation token, timeout and transaction in one place.

### Parameters & DynamicParameters

- You can pass an anonymous object: `new { id = 1 }`.
- IN lists work with a collection: `WHERE Id IN @Ids` and `new { Ids = idList }`.
- Use `DynamicParameters` when you need output parameters, return values, or more control (example under "Stored procedures" below).

## 4. Writing data

### Execute (non-query)

`Execute` / `ExecuteAsync` runs INSERT, UPDATE or DELETE and returns the affected row count.

```csharp
int affected = await conn.ExecuteAsync("UPDATE Products SET Price = @Price WHERE Id = @Id", new { Id = 10, 
Price = 9.99m });
```

### Insert and return the new id

With `SCOPE_IDENTITY()`:

```csharp
string insertSql = @"
INSERT INTO Products (Sku, Name, Price) 
VALUES (@Sku, @Name, @Price);
SELECT CAST(SCOPE_IDENTITY() AS int);";

int newId = await conn.QuerySingleAsync<int>(insertSql, new { Sku="B200", Name="Banana", Price=0.75m });
```

With `OUTPUT INSERTED.Id`:

```csharp
const string sql = @"
    INSERT INTO Tasks (UserId, Title, Status)
    OUTPUT INSERTED.Id
    VALUES (@UserId, @Title, @Status)";
var id = await conn.ExecuteScalarAsync<int>(new CommandDefinition(sql, task, cancellationToken: ct));
```

### ExecuteScalar (single value)

```csharp
int count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Products WHERE IsActive = 1");
```

## 5. Mapping results

### Column names

- Dapper maps columns to properties by name (case-insensitive).
- Map `snake_case` columns to `PascalCase` properties once at startup: `DefaultTypeMap.MatchNamesWithUnderscores = true;`

### Mapping to dynamic or dictionaries

```csharp
var rows = conn.Query("SELECT TOP 10 * FROM Products");
foreach (var row in rows)
{
    Console.WriteLine(row.Name); // dynamic object
}
```

`Query` without generic type returns `IEnumerable<dynamic>`.

### One-to-one / simple multi-mapping (entity + navigation)

Multi-mapping joins one row into two objects. Use Dapper's multi-mapping overload `Query<T1,T2,TReturn>` with `splitOn`.

```csharp
public class Student {
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public Department? Department { get; set; }
}
public class Department {
    public int Id { get; set; }
    public string DeptName { get; set; } = "";
}

var sql = @"
SELECT s.Id, s.Name, d.Id AS DeptId, d.DeptName
FROM Students s
LEFT JOIN Departments d ON s.DepartmentId = d.Id;
";

using var conn = GetConnection();
var result = await conn.QueryAsync<Student, Department, Student>(
    sql,
    (student, dept) => {
        student.Department = dept;
        return student;
    },
    splitOn: "DeptId" // column at which Dapper starts mapping the second object
);
```

`splitOn`: value(s) specifying column name(s) where next type mapping starts. Defaults to `"Id"` if not provided.
Use aliasing in SQL (e.g., `d.Id AS DeptId`) that matches the `splitOn`.

Another example, where both tables call their key `Id`, so the split column is `Id`:

```csharp
const string sql = @"
    SELECT t.Id, t.Title, c.Id, c.Name
    FROM Tasks t JOIN Categories c ON c.Id = t.CategoryId";

var rows = await conn.QueryAsync<TaskItem, Category, TaskItem>(
    sql,
    (task, cat) => { task.Category = cat; return task; },
    splitOn: "Id");
```

### QueryMultiple (multiple result sets)

Several result sets in one round trip:

```csharp
using var multi = await conn.QueryMultipleAsync("EXEC GetOrderAndItems @orderId", new { orderId });
var order = await multi.ReadSingleAsync<Order>();
var items = (await multi.ReadAsync<OrderItem>()).ToList();
```

`QueryMultiple` returns a `SqlMapper.GridReader` with `Read()` / `ReadAsync()` methods. The batch can also be plain SQL statements:

```csharp
using var grid = await conn.QueryMultipleAsync(
    "SELECT * FROM Tasks WHERE Id = @Id; SELECT * FROM Comments WHERE TaskId = @Id", new { Id = id });
var task = await grid.ReadSingleOrDefaultAsync<TaskItem>();
var comments = (await grid.ReadAsync<Comment>()).ToList();
```

### Type handlers

Register custom handlers once at startup for types Dapper does not map, such as `DateOnly` or enums stored as strings, using `SqlMapper.AddTypeHandler`.

## 6. Async & cancellation

Prefer async in server code:

```csharp
var rows = await conn.QueryAsync<Product>("SELECT ... WHERE Price > @p", new { p = 10 });
```

For cancellation/control, pass a `CommandDefinition`:

```csharp
var cd = new CommandDefinition(sql, new { p = 10 }, cancellationToken: ct, commandTimeout: 60);
var rows = await conn.QueryAsync<Product>(cd);
```

## 7. Transactions

Use a transaction when several writes must succeed together. Share the same `IDbTransaction` with Dapper calls so everything is atomic:

```csharp
await conn.OpenAsync();
using var tx = conn.BeginTransaction();
try
{
    await conn.ExecuteAsync("INSERT ...", param1, tx);
    await conn.ExecuteAsync("UPDATE ...", param2, tx);
    tx.Commit();
}
catch
{
    tx.Rollback();
    throw;
}
```

Pass `transaction: tx` to Dapper calls.

**Example: moving money between two accounts**

```csharp
using var conn = (SqlConnection)await _factory.CreateOpenConnectionAsync(ct);
using var tx = conn.BeginTransaction();
try
{
    await conn.ExecuteAsync(new CommandDefinition(
        "UPDATE Accounts SET Balance = Balance - @Amt WHERE Id = @From",
        new { Amt = amount, From = fromId }, tx, cancellationToken: ct));

    await conn.ExecuteAsync(new CommandDefinition(
        "UPDATE Accounts SET Balance = Balance + @Amt WHERE Id = @To",
        new { Amt = amount, To = toId }, tx, cancellationToken: ct));

    tx.Commit();
}
catch
{
    tx.Rollback();
    throw;
}
```

- Every command inside the transaction must receive `tx`; Dapper does not pick it up automatically.
- Keep transactions short. Do no HTTP calls or slow work between BeginTransaction and Commit.
- Use `TransactionScope` only if you need to span several connections; it can escalate to a distributed transaction.

### Transactions + Dapper + EF Core in same transaction

If you need to mix EF and Dapper in same transaction, begin EF transaction and pass the underlying
`DbTransaction` to Dapper:

```csharp
await using var efTx = await dbContext.Database.BeginTransactionAsync();
var dbTx = efTx.GetDbTransaction(); // underlying DbTransaction

// use Dapper with same connection and transaction
var conn = dbContext.Database.GetDbConnection();
await conn.ExecuteAsync(sql, param, transaction: dbTx);

// commit via EF
await efTx.CommitAsync();
```

For transactions that span several repositories, see "Unit of work" in section 9.

## 8. Stored procedures

Query or Execute stored procedures with `commandType`:

```csharp
var products = await conn.QueryAsync<Product>("GetProductsByCategory", new { categoryId = 3 }, commandType: 
CommandType.StoredProcedure);
```

Use `DynamicParameters` for IN/OUT params.

**Example: stored procedure with output parameter**

```csharp
var p = new DynamicParameters();
p.Add("@CustomerId", 5);
p.Add("@NewOrderId", dbType: DbType.Int32, direction: ParameterDirection.Output);

await conn.ExecuteAsync("dbo.CreateOrder", p, commandType: CommandType.StoredProcedure);

int newOrderId = p.Get<int>("@NewOrderId");
```

**Example: a stored procedure that returns rows and an output parameter**

```csharp
var p = new DynamicParameters();
p.Add("@UserId", userId);
p.Add("@Total", dbType: DbType.Int32, direction: ParameterDirection.Output);

var rows = await conn.QueryAsync<TaskItem>(new CommandDefinition(
    "dbo.usp_GetUserTasks", p, commandType: CommandType.StoredProcedure, cancellationToken: ct));

var total = p.Get<int>("@Total");
```

Read output and return values only after the result set has been fully consumed (the `ToList()` or `await` above has finished).

## 9. Production structure in ASP.NET Core

Keep SQL out of controllers. Put it in repositories behind interfaces, register them with DI, and let controllers or handlers depend on the interfaces.

```
src/
  Domain/            entities, interfaces (ITaskRepository)
  Application/       services, DTOs
  Infrastructure/
    Data/            IDbConnectionFactory, SqlConnectionFactory
    Repositories/    TaskRepository (Dapper + SQL)
  Api/               controllers, Program.cs
```

### Register services in Program.cs

```csharp
builder.Services.AddSingleton<IDbConnectionFactory, SqlConnectionFactory>();
builder.Services.AddScoped<ITaskRepository, TaskRepository>();
```

The factory is a singleton because it holds only the connection string. Repositories are scoped, matching the request lifetime.

### Repository example

```csharp
public sealed class TaskRepository : ITaskRepository
{
    private readonly IDbConnectionFactory _factory;
    public TaskRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<TaskItem?> GetByIdAsync(int id, CancellationToken ct)
    {
        const string sql = "SELECT Id, Title, Status, DueDate FROM Tasks WHERE Id = @Id";
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<TaskItem>(
            new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));
    }
}
```

### Unit of work for multi-repository transactions

When one use case writes through several repositories, create one scoped `IUnitOfWork` that owns the connection and transaction, and have repositories take `uow.Connection` and `uow.Transaction`. Commit once at the end of the use case.

**Unit of work, explained with an example**

Placing an order needs two writes: insert the order, then reduce stock. If the stock update fails, the order must be undone. A transaction lives on one connection, but with a connection per method, `OrderRepository` and `InventoryRepository` each open their own, so no single transaction covers both. The unit of work fixes this: it opens one connection and one transaction, both repositories use them, and you commit once at the end. If anything throws before `Commit()`, disposing the unit of work rolls everything back.

```csharp
// 1. The unit of work owns ONE connection + ONE transaction
public sealed class UnitOfWork : IUnitOfWork
{
    public IDbConnection Connection { get; }
    public IDbTransaction Transaction { get; private set; }

    public UnitOfWork(IDbConnectionFactory factory)
    {
        Connection = factory.CreateOpenConnectionAsync().GetAwaiter().GetResult();
        Transaction = Connection.BeginTransaction();
    }

    public void Commit()  { Transaction.Commit(); }
    public void Dispose() { Transaction.Dispose(); Connection.Dispose(); } // uncommitted = rolled back
}

// 2. Repositories use the unit of work's connection instead of opening their own
public sealed class OrderRepository : IOrderRepository
{
    private readonly IUnitOfWork _uow;
    public OrderRepository(IUnitOfWork uow) => _uow = uow;

    public Task<int> AddAsync(Order o, CancellationToken ct) =>
        _uow.Connection.ExecuteScalarAsync<int>(new CommandDefinition(
            "INSERT INTO Orders (UserId, Total) OUTPUT INSERTED.Id VALUES (@UserId, @Total)",
            o, _uow.Transaction, cancellationToken: ct));
}

public sealed class InventoryRepository : IInventoryRepository
{
    private readonly IUnitOfWork _uow;
    public InventoryRepository(IUnitOfWork uow) => _uow = uow;

    public Task<int> ReduceStockAsync(int productId, int qty, CancellationToken ct) =>
        _uow.Connection.ExecuteAsync(new CommandDefinition(
            "UPDATE Products SET Stock = Stock - @Qty WHERE Id = @Id AND Stock >= @Qty",
            new { Id = productId, Qty = qty }, _uow.Transaction, cancellationToken: ct));
}

// 3. The service (use case) coordinates and commits once
public async Task PlaceOrderAsync(Order order, CancellationToken ct)
{
    await _orders.AddAsync(order, ct);
    var updated = await _inventory.ReduceStockAsync(order.ProductId, order.Qty, ct);
    if (updated == 0) throw new InvalidOperationException("Out of stock");
    _uow.Commit();
}
```

Register the unit of work as scoped, so every repository in one request shares the same instance:

```csharp
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
```

When to use which:

- A read or a single write: the simple repository with its own connection per method.
- Two or more writes that must succeed or fail together: a unit of work.

Caveat: this version opens the connection and transaction in the constructor, so every request that injects it pays for a transaction, even read-only ones. In a real app, open them lazily on first use, or keep read-only repositories separate from the unit-of-work ones.

## 10. Production hardening

| Concern | What to do |
| --- | --- |
| Timeouts | Set `commandTimeout` in `CommandDefinition` (for example 30 s) and `Connect Timeout` in the connection string. Never rely on defaults for slow queries. |
| Cancellation | Pass `CancellationToken` from the controller down to every `CommandDefinition`. |
| Pagination | Use `OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY` with a stable `ORDER BY`. For large tables prefer keyset paging (`WHERE Id > @LastId`). Cap `Take` (for example 100). |
| Transient faults | Retry connection and deadlock errors (SQL error 1205, 40613, timeouts) with Polly: 3 attempts, exponential backoff with jitter. Retry only idempotent operations. |
| Connection pool | Dispose connections quickly. Set `Max Pool Size` to match load, and watch for pool exhaustion errors, which usually mean a leaked connection. |
| Least privilege | Use a SQL login with only the permissions the app needs (no `db_owner`). Use separate read-only credentials for report queries. |
| Security | Parameterize every value. For dynamic ORDER BY or column names, allow-list them in code; parameters cannot carry identifiers. |
| Logging | Log query name, duration and row count. Do not log parameter values that hold personal data. |
| Observability | Add OpenTelemetry `SqlClient` instrumentation, and a `/health` check using `AspNetCore.HealthChecks.SqlServer`. |
| Buffering | `QueryAsync` buffers by default. For huge exports use `buffered: false` or `QueryUnbufferedAsync` and stream results. |

### Retry example with Polly

```csharp
var retry = Policy
    .Handle<SqlException>(e => e.Number is 1205 or 40613 or -2)
    .WaitAndRetryAsync(3, i => TimeSpan.FromMilliseconds(200 * Math.Pow(2, i)));

return await retry.ExecuteAsync(() => GetByIdCore(id, ct));
```

### Full retry example (Polly v8, registered once and reused)

The snippet above shows the idea. This version is what you would ship: install `Polly.Extensions`, register a named pipeline at startup, and run repository calls through it.

```bash
dotnet add package Polly.Extensions
```

```csharp
// Program.cs: register the pipeline once
using Polly;
using Polly.Retry;

var transientSqlErrors = new HashSet<int> { 1205, 40613, 40501, 40197, 49918, 4060, -2 };
// 1205 deadlock victim, -2 timeout, 40xxx Azure SQL transient faults

builder.Services.AddResiliencePipeline("sql-retry", pipeline =>
{
    pipeline.AddRetry(new RetryStrategyOptions
    {
        MaxRetryAttempts = 3,
        BackoffType = DelayBackoffType.Exponential,
        Delay = TimeSpan.FromMilliseconds(200),
        UseJitter = true,
        ShouldHandle = new PredicateBuilder()
            .Handle<SqlException>(e => transientSqlErrors.Contains(e.Number)),
        OnRetry = args =>
        {
            // log attempt number and error, never parameter values
            Console.WriteLine($"SQL retry {args.AttemptNumber + 1}: {args.Outcome.Exception?.Message}");
            return default;
        }
    });
});
```

```csharp
// Repository: run the whole operation (open connection + query) inside the pipeline
public sealed class TaskRepository : ITaskRepository
{
    private readonly IDbConnectionFactory _factory;
    private readonly ResiliencePipeline _retry;

    public TaskRepository(IDbConnectionFactory factory, ResiliencePipelineProvider<string> pipelines)
    {
        _factory = factory;
        _retry = pipelines.GetPipeline("sql-retry");
    }

    public async Task<TaskItem?> GetByIdAsync(int id, CancellationToken ct)
    {
        return await _retry.ExecuteAsync(async token =>
        {
            using var conn = await _factory.CreateOpenConnectionAsync(token);
            return await conn.QuerySingleOrDefaultAsync<TaskItem>(new CommandDefinition(
                "SELECT Id, Title, Status FROM Tasks WHERE Id = @Id",
                new { Id = id }, commandTimeout: 30, cancellationToken: token));
        }, ct);
    }
}
```

Rules that keep retries safe:

- Open a fresh connection on every attempt, which is why the `using var conn` sits inside the lambda. A failed connection must not be reused.
- Retry reads freely. Retry writes only if they are idempotent (for example `UPDATE ... SET Status = @Status`) or protected by a unique key. A blind `INSERT` can create duplicates if the first attempt actually committed.
- To retry a transaction, retry the whole unit: begin, all commands, commit. Never retry a single command inside a half-finished transaction.
- Keep attempts low (3) and total time below your HTTP request timeout, or callers will give up before the retries finish.

## 11. Testing repositories

Test repositories against a real database. Dapper runs your SQL, so mocking it proves nothing. Use integration tests against SQL Server in a container (Testcontainers for .NET), apply your schema, then run the repository.

```csharp
public class TaskRepositoryTests : IAsyncLifetime
{
    private readonly MsSqlContainer _db = new MsSqlBuilder().Build();
    public Task InitializeAsync() => _db.StartAsync();
    public Task DisposeAsync() => _db.DisposeAsync().AsTask();

    [Fact]
    public async Task Insert_then_get_returns_same_task()
    {
        // build factory from _db.GetConnectionString(), run schema script,
        // call repo.InsertAsync, then repo.GetByIdAsync and assert
    }
}
```

Unit-test services by mocking `ITaskRepository`, which is the reason for the interface.

## 12. Schema changes and migrations

Manage the schema outside Dapper. Dapper has no migrations. Pick one tool and run it in your pipeline before the app starts:

- **DbUp** or **FluentMigrator**: versioned SQL scripts, simple and Dapper-friendly.
- **EF Core migrations** for schema only, with Dapper for queries.
- **SQL Server Database Project (SSDT)** if your team already uses it.

Make changes backward compatible (add a column, deploy the code, then drop the old column) so rolling deployments in Docker or Kubernetes never hit a mismatched schema. Run migrations as a separate GitHub Actions job or init container, not on every app instance start.

## 13. Common pitfalls

- **`SELECT *`**: breaks mapping when columns change and wastes bandwidth. List the columns.
- **Wrong `splitOn`**: multi-mapping silently fills the second object with defaults. Check the split column name and order.
- **N+1 queries**: a query inside a loop. Use a join, `IN @Ids`, or `QueryMultiple`.
- **Forgetting the transaction**: commands without `tx` run outside it and fail with an error or commit on their own.
- **Leaked connections**: always use `using`. Pool exhaustion shows as timeouts under load.
- **Dynamic SQL from user input**: parameters cannot replace table, column or sort-direction names; allow-list them.
- **Nullable mismatch**: map nullable columns to nullable C# types (`int?`, `DateTime?`).
- **`QuerySingle` vs `QueryFirst`**: `Single` throws if there are two rows; use it when uniqueness is a rule you want enforced.

## 14. Go-live checklist

- [ ] Connection string comes from a vault or environment variable, with `Encrypt=True`
- [ ] SQL login has least privilege
- [ ] Every query is parameterized, and dynamic parts are allow-listed
- [ ] Command timeouts and cancellation tokens set on all calls
- [ ] Pagination capped on every list endpoint
- [ ] Retry policy on idempotent reads and writes
- [ ] Indexes checked with execution plans for the top queries
- [ ] Integration tests run against real SQL Server in CI
- [ ] Migrations run as a separate pipeline step
- [ ] Health check, query duration logging and tracing enabled
- [ ] Load test confirms the connection pool size is enough
