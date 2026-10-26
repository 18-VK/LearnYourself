# Using EF Core for writes / ORM conveniences and Dapper for raw, high-performance read queries

This is a common, pragmatic pattern. Below I'll give:

- When and why to combine them
- A small, realistic code example (DbContext + DTO + repository) showing EF for writes and Dapper for heavy reads
  — including an example that shares the same DB connection/transaction so Dapper and EF participate in one
  transaction.
- Best practices and pitfalls.

## When to combine EF Core + Dapper

- Use EF Core for create/update/delete, change-tracking, relationships, migrations and where LINQ is convenient.

Use Dapper for:

- Very large read queries returning DTOs (faster mapping, lower overhead).
- Complex SQL (window functions, CTEs, tuned queries) where you want full SQL control.
- Multi-row/bulk read scenarios where EF is too slow or memory-heavy.
- Combining gives productivity + performance.

## 1. Minimal model + DbContext

```csharp
// Product.cs
public class Product
{
    public int Id { get; set; }
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public bool IsActive { get; set; }
}

// AppDbContext.cs
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>()
            .HasKey(p => p.Id);
        modelBuilder.Entity<Product>()
            .Property(p => p.Sku)
            .HasMaxLength(50)
            .IsRequired();
    }
}
```

## 2. DTO (data transfer object) for read-heavy query (returned by Dapper)

```csharp
public class ProductSalesDto
{
    public int ProductId { get; set; }
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal TotalSales { get; set; }
    public int UnitsSold { get; set; }
}
```

## Repository showing both EF Core and Dapper usage (async)

```csharp
using System.Data;
using Dapper;
using Microsoft.Data.SqlClient; // or provider-specific
using Microsoft.EntityFrameworkCore;

public class ProductRepository
{
    private readonly AppDbContext _db;

    public ProductRepository(AppDbContext db)
    {
        _db = db;
    }

    // --- EF Core for writes (create/update/delete) ---
    public async Task<Product> CreateAsync(Product p, CancellationToken ct = default)
    {
        _db.Products.Add(p);
        await _db.SaveChangesAsync(ct);
        return p;
    }

    public async Task UpdatePriceAsync(int productId, decimal newPrice, CancellationToken ct = default)
    {
        var product = await _db.Products.FindAsync(new object[] { productId }, ct);
        if (product == null) throw new KeyNotFoundException();
        product.Price = newPrice;
        await _db.SaveChangesAsync(ct);
    }

    // --- Dapper for heavy read (returns DTO) ---
    public async Task<IEnumerable<ProductSalesDto>> GetTopSellingProductsAsync(DateTime since, int limit = 50, 
    CancellationToken ct = default)
    {
        // Get the underlying DbConnection from the DbContext
        var conn = _db.Database.GetDbConnection();

        const string sql = @"
            SELECT p.Id AS ProductId, p.Sku, p.Name,
                   SUM(oi.Quantity * oi.UnitPrice) AS TotalSales,
                   SUM(oi.Quantity) AS UnitsSold
            FROM Products p
            JOIN OrderItems oi ON oi.ProductId = p.Id
            JOIN Orders o ON o.Id = oi.OrderId
            WHERE o.OrderDate >= @since
            GROUP BY p.Id, p.Sku, p.Name
            ORDER BY TotalSales DESC
            OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY;";

        // Ensure the connection is open
        if (conn.State == ConnectionState.Closed) await conn.OpenAsync(ct);

        // QueryAsync mapped to DTO
        var result = await conn.QueryAsync<ProductSalesDto>(
            new CommandDefinition(sql, new { since, limit }, cancellationToken: ct));

        return result;
    }

    // --- Example: perform Dapper read and EF update inside the same transaction ---
    public async Task IncreasePriceForTopSellersAsync(DateTime since, decimal percent, int topN, CancellationToken ct = default)
    {
        // Use a DB transaction via EF Core so EF SaveChanges and Dapper use same db transaction
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            // 1) Use Dapper on the same connection and enlist it in the EF transaction
            var conn = _db.Database.GetDbConnection();
            if (conn.State == ConnectionState.Closed) await conn.OpenAsync(ct);

            const string sqlTopIds = @"
                SELECT TOP(@topN) p.Id
                FROM Products p
                JOIN OrderItems oi ON oi.ProductId = p.Id
                JOIN Orders o ON o.Id = oi.OrderId
                WHERE o.OrderDate >= @since
                GROUP BY p.Id
                ORDER BY SUM(oi.Quantity * oi.UnitPrice) DESC;";

            var topIds = (await conn.QueryAsync<int>(
                new CommandDefinition(sqlTopIds, new { since, topN }, transaction: tx.GetDbTransaction(), cancellationToken: ct)))
                .ToList();

            // 2) Use EF to update those products (EF is already using the same transaction)
            var products = await _db.Products.Where(p => topIds.Contains(p.Id)).ToListAsync(ct);
            foreach (var p in products)
            {
                p.Price *= 1 + percent;
            }
            await _db.SaveChangesAsync(ct);

            // Commit
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
}
```

## Pitfalls & best practices

- Don't mix Dapper results (entity instances) into EF's change tracker directly. If you need to update an
  entity you queried via Dapper, re-query with EF or attach carefully.

- Use DTOs for reads — keeps clear separation of read model vs write model (CQRS-friendly).

- Be careful about connection lifetime: if EF manages connection, opening it manually is fine but close it when
  done (or rely on transaction scope to maintain state). Prefer opening explicitly in code that uses Dapper to
  control behavior.

- **Transactions:** always pass the same `DbTransaction` to Dapper commands if you need atomicity across EF & Dapper
  operations.

- Use `AsNoTracking()` for EF queries you will not update — reduces memory and improves speed.

- Avoid relying on EF mapping conventions when you return non-entity DTO via raw SQL — map column aliases to
  DTO property names or use Dapper attribute mappings.
