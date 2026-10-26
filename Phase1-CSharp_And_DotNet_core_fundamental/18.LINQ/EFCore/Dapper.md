# C Sharp Dapper

C# Dapper is a lightweight ORM. In the world of software development, interacting with databases is a common
task. Developers often use Object-Relational Mapping (ORM) tools to simplify the process of database
operations. Dapper is one such ORM tool. Dapper is a lightweight, open-source library that provides simple and
fast database operations.

- Dapper = micro-ORM: very thin mapper on top of ADO.NET
- Main benefits: tiny surface area, near-ADO.NET performance, automatic POCO mapping.

## Steps to setup

1. Install the Dapper NuGet package.
2. Add `using System.Data.SqlClient;`

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

## Example : Querying data

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

## Methods

**Useful variants (sync + async)**

- `Query<T>(...)` — returns `IEnumerable<T>` (buffered by default).
- `QueryAsync<T>(...)` — async version returning `Task<IEnumerable<T>>`.
- `QueryFirst<T>`, `QueryFirstOrDefault<T>` — gets first row (throws if none for `First`).
- `QuerySingle<T>`, `QuerySingleOrDefault<T>` — expects exactly one row (throws if more than one).
- `Execute(...)` / `ExecuteAsync(...)` — for INSERT/UPDATE/DELETE, returns affected row count.

e.g.:

```csharp
string insertSql = @"
INSERT INTO Products (Sku, Name, Price) 
VALUES (@Sku, @Name, @Price);
SELECT CAST(SCOPE_IDENTITY() AS int);";

int newId = await conn.QuerySingleAsync<int>(insertSql, new { Sku="B200", Name="Banana", Price=0.75m });
```

# Execute (non-query)

```csharp
int affected = await conn.ExecuteAsync("UPDATE Products SET Price = @Price WHERE Id = @Id", new { Id = 10, 
Price = 9.99m });
```

# ExecuteScalar (single value)

```csharp
int count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Products WHERE IsActive = 1");
```

# Parameters & DynamicParameters

- You can pass an anonymous object: `new { id = 1 }`.
- Use `DynamicParameters` when you need output parameters, return values, or more control.

**Example: stored procedure with output parameter**

```csharp
var p = new DynamicParameters();
p.Add("@CustomerId", 5);
p.Add("@NewOrderId", dbType: DbType.Int32, direction: ParameterDirection.Output);

await conn.ExecuteAsync("dbo.CreateOrder", p, commandType: CommandType.StoredProcedure);

int newOrderId = p.Get<int>("@NewOrderId");
```

# Transactions

Share the same `IDbTransaction` with Dapper calls so everything is atomic:

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

# QueryMultiple (multiple result sets)

```csharp
using var multi = await conn.QueryMultipleAsync("EXEC GetOrderAndItems @orderId", new { orderId });
var order = await multi.ReadSingleAsync<Order>();
var items = (await multi.ReadAsync<OrderItem>()).ToList();
```

`QueryMultiple` returns a `SqlMapper.GridReader` with `Read()` / `ReadAsync()` methods.

# Mapping to dynamic or dictionaries

```csharp
var rows = conn.Query("SELECT TOP 10 * FROM Products");
foreach (var row in rows)
{
    Console.WriteLine(row.Name); // dynamic object
}
```

`Query` without generic type returns `IEnumerable<dynamic>`.

# Stored procedures

Query or Execute stored procedures with `commandType`:

```csharp
var products = await conn.QueryAsync<Product>("GetProductsByCategory", new { categoryId = 3 }, commandType: 
CommandType.StoredProcedure);
```

Use `DynamicParameters` for IN/OUT params.

# Async & cancellation

Prefer async in server code:

```csharp
var rows = await conn.QueryAsync<Product>("SELECT ... WHERE Price > @p", new { p = 10 });
```

For cancellation/control, pass a `CommandDefinition`:

```csharp
var cd = new CommandDefinition(sql, new { p = 10 }, cancellationToken: ct, commandTimeout: 60);
var rows = await conn.QueryAsync<Product>(cd);
```

# Transactions + Dapper + EF Core in same transaction

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

# One-to-one / simple multi-mapping (entity + navigation)

Use Dapper's multi-mapping overload `Query<T1,T2,TReturn>` with `splitOn`.

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
