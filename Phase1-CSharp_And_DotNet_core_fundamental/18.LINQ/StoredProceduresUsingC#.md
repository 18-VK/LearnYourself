# Calling Stored Procedures in .NET

In .NET you can call stored procedures in different ways depending on which data access approach you're using.
Let's look at each one briefly with examples so you understand how to use them safely and effectively.

## 1. Using ADO.NET

You manually handle the connection, command type, and parameters.

```csharp
using System.Data;
using System.Data.SqlClient;

string connectionString = "Server=.;Database=ShopDB;Trusted_Connection=True;";

using (SqlConnection conn = new SqlConnection(connectionString))
{
    conn.Open();

    using (SqlCommand cmd = new SqlCommand("GetProductsByCategory", conn))
    {
        cmd.CommandType = CommandType.StoredProcedure;
        cmd.Parameters.AddWithValue("@categoryId", 2);

        using (SqlDataReader reader = cmd.ExecuteReader())
        {
            while (reader.Read())
            {
                Console.WriteLine($"{reader["Name"]} - {reader["Price"]}");
            }
        }
    }
}
```

**Key points:**

- `CommandType = CommandType.StoredProcedure` is required
- Parameters must match the stored procedure signature
- Returns raw data — you manually read and map it.

## 2. Using Dapper

Dapper makes calling stored procedures simple and clean, while still allowing parameter binding.

```csharp
using Dapper;
using System.Data;
using System.Data.SqlClient;

string connectionString = "Server=.;Database=ShopDB;Trusted_Connection=True;";

using (var connection = new SqlConnection(connectionString))
{
    var products = connection.Query<Product>(
        "GetProductsByCategory",
        new { categoryId = 2 },
        commandType: CommandType.StoredProcedure
    );

    foreach (var p in products)
        Console.WriteLine($"{p.Name} - {p.Price}");
}
```

**Key points**

- Automatically maps result sets to your model class (`Product`).
- You just pass an anonymous object for parameters.
- Cleaner and safer than ADO.NET for most use cases.

## 3. Using Entity Framework Core

EF Core supports stored procedures via `FromSqlRaw()` for queries and `ExecuteSqlRaw()` for non-queries.

**For SELECT / returning entities**

```csharp
var products = context.Products
    .FromSqlRaw("EXEC GetProductsByCategory @categoryId = {0}", 2)
    .ToList();
```

or (parameterized safely):

```csharp
var param = new SqlParameter("@categoryId", 2);
var products = context.Products
    .FromSqlRaw("EXEC GetProductsByCategory @categoryId", param)
    .ToList();
```

**For INSERT / UPDATE / DELETE (no return)**

```csharp
context.Database.ExecuteSqlRaw("EXEC UpdateProductPrice @productId, @newPrice",
    new SqlParameter("@productId", 10),
    new SqlParameter("@newPrice", 150));
```

**Key points**

- Maps returned results to entity classes.
- Works with EF change tracking (if results match entity schema).
- Can mix stored procedures and LINQ in the same `DbContext`.
