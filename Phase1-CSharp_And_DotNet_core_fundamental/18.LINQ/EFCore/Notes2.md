# EF Core Notes and Migration Reference

This note combines the conceptual EF Core notes with the practical migration and database command reference, arranged into a single learning guide.

---

## Table of contents

- [1. Configure the model](#1-configure-the-model)
- [2. Navigation data loading](#2-navigation-data-loading)
- [3. Change tracking](#3-change-tracking)
- [4. Cascade delete](#4-cascade-delete)
- [5. EF Core migrations and database commands](#5-ef-core-migrations-and-database-commands)
- [6. Database-first / reverse engineering](#6-database-first--reverse-engineering)
- [7. Raw SQL and parameterized queries](#7-raw-sql-and-parameterized-queries)
- [8. IQueryable vs IEnumerable](#8-iqueryable-vs-ienumerable)
- [9. Concurrency and update patterns](#9-concurrency-and-update-patterns)
- [10. Quick cheat sheet](#10-quick-cheat-sheet)

---

# 1. Configure the model

## 1) Configure using conventions

EF Core conventions are the default rules used while creating the entity model. EF Core infers database schema from POCO classes automatically: table name, column name, data type, primary keys, and relationships are derived from class and property names and types.

Example:

```csharp
public class Student
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
```

This convention maps to a table like `Students` with an `Id` primary key and `Name` column.

## 2) Configure using data annotations

Data annotations allow us to add metadata directly onto the class or properties. They override conventions and are common for database schema and validation rules.

**Two groups:**

- Data modeling attributes (`System.ComponentModel.DataAnnotations.Schema`)
- Validation related attributes (`System.ComponentModel.DataAnnotations`)

### Data modeling attributes

These specify the shape of the database, for example:

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class Product
{
    [Key]
    public int ProductId { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("PriceInINR")]
    public decimal Price { get; set; }
}
```

### Validation attributes

These enforce rules:

```csharp
public class Customer
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Range(18, 100)]
    public int Age { get; set; }
}
```

> Note: some attributes belong to general .NET validation, not EF Core specifically.

### Extra: what `C` and `C2` mean

These are numeric format specifiers used in C# for currency formatting:

```csharp
decimal price = 1234.5m;

Console.WriteLine($"{price:C}");   // ₹1,234.50  (India locale)
Console.WriteLine($"{price:C0}");  // ₹1,235     (no decimals)
Console.WriteLine($"{price:C1}");  // ₹1,234.5   (1 decimal place)
Console.WriteLine($"{price:C2}");  // ₹1,234.50  (2 decimal places)
Console.WriteLine($"{price:C3}");  // ₹1,234.500 (3 decimal places)
```

## 3) Configure using Fluent API

Fluent API gives you the most control and is usually the cleanest choice for complex relationships and database configuration.

```csharp
modelBuilder.Entity<Student>()
    .Property(s => s.Name)
    .IsRequired()
    .HasMaxLength(100);
```

> Note: in many projects this is usually placed in separate entity configuration classes rather than inside `OnModelCreating()` directly.

---

# 2. Navigation data loading

In EF Core, loading means how related (navigation) data is fetched from the database.

```csharp
public class Student
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public ICollection<Course> Courses { get; set; } = new List<Course>();
}

public class Course
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public ICollection<Student> Students { get; set; } = new List<Student>();
}
```

When you query students, EF Core may load their `Courses` in different ways.

## 1. Eager loading

Related data is loaded immediately with `Include` / `ThenInclude`.

```csharp
var students = context.Students
    .Include(s => s.Courses)
    .ThenInclude(c => c.Teacher)
    .ToList();
```

**SQL:** single query with JOINs (or a set of joined rows)

**Use when:**

- You know the related data is needed immediately
- Example: dashboard showing students and all courses in one view

**Avoid when:**

- Data is large or not always required
- Risk of unnecessary data being loaded

## 2. Lazy loading

Related data is loaded only when a navigation property is accessed.

**Setup:**

```text
Microsoft.EntityFrameworkCore.Proxies
```

```csharp
protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
{
    optionsBuilder
        .UseSqlServer(connectionString)
        .UseLazyLoadingProxies();
}
```

Make navigation properties virtual:

```csharp
public class Student
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public virtual ICollection<Course> Courses { get; set; } = new List<Course>();
}
```

Example:

```csharp
using var context = new SchoolContext();

var students = context.Students.ToList();

foreach (var s in students)
{
    Console.WriteLine($"{s.Name} - {s.Courses.Count}");
}
```

**SQL generated:**

- First query loads students
- Then another query loads courses when `s.Courses` is accessed

**Use when:**

- Related data may not always be needed
- UI flows where details are expanded on demand

**Avoid when:**

- N+1 queries are likely
- Large datasets with many related loads

## 3. Explicit loading

You manually load related data after the main entity is retrieved.

```csharp
using var context = new SchoolContext();

var student = context.Students.First(s => s.Id == 1);

context.Entry(student)
    .Collection(s => s.Courses)
    .Load();
```

**Use when:**

- Fine-grained control is required
- Load only related data for selected entities

**Avoid when:**

- You need related data for all entities; eager loading is simpler and more efficient

---

# 3. Change tracking

The `ChangeTracker` in EF Core tracks changes made to every entity and stores them with `EntityEntry`. Entity state can be `Added`, `Deleted`, `Modified`, `Unchanged`, or `Detached`.

Examples:

- `Add` / `AddRange` → entity is marked `Added`
- Query from DbContext → entity is `Unchanged`
- Edit a property → state becomes `Modified`
- `SaveChanges` performs the SQL insert/update/delete based on the state

## `ChangeTracker`

The `ChangeTracker` keeps track of entities loaded into the context and stores the original and current values for each entity.

## `EntityEntry`

Each tracked entity gets an `EntityEntry` object that holds change tracking metadata and helper methods.

---

# 4. Cascade delete

Entity Framework Core cascade delete defines what happens to dependent rows when the parent row is deleted.

Available behaviors:

- `Cascade` / `ClientCascade` — delete the related rows
- `SetNull` / `ClientSetNull` — set foreign key to `NULL`
- `Restrict` / `NoAction` / `ClientNoAction` — do nothing / reject depending on configuration

Configure with Fluent API:

```csharp
modelBuilder.Entity<Employee>()
    .HasOne(e => e.Department)
    .WithMany(d => d.Employees)
    .OnDelete(DeleteBehavior.Cascade);
```

The database mapping uses the corresponding referential action:

| Action | Database mapping |
|---|---|
| `Cascade` | `ON DELETE CASCADE` |
| `NoAction` | `ON DELETE NO ACTION` |
| `SetNull` | `ON DELETE SET NULL` |
| `Restrict` | `ON DELETE RESTRICT` |

When using `ClientCascade`, `ClientSetNull`, or `ClientNoAction`, the migration will not generate referential actions at the database level; the behavior is enforced in the client (EF Core) during `SaveChanges`.

---

# 5. EF Core migrations and database commands

This is the practical migration reference for Clean Architecture solutions where the `DbContext` lives in Infrastructure and the ASP.NET app is in Api.

## 5.1 Setup (once)

```bash
# Install or update the CLI tool
dotnet tool install --global dotnet-ef
dotnet tool update --global dotnet-ef
dotnet ef --version
```

The startup project needs the design-time package:

```bash
dotnet add src/Api package Microsoft.EntityFrameworkCore.Design
```

Because the DbContext and migrations live in Infrastructure, almost every command needs both flags:

```bash
--project src/Infrastructure      # where the DbContext and migrations live
--startup-project src/Api        # where configuration and DI are built
```

To avoid repeating them:

```bash
EF="--project src/Infrastructure --startup-project src/Api"
dotnet ef migrations list $EF
```

## 5.2 Why `--project` and `--startup-project`

The EF tools need two pieces of information that live in different projects.

| Flag | Role | What EF uses it for |
|---|---|---|
| `--project` | Target project | Locates `AppDbContext` and the `Migrations` folder |
| `--startup-project` | Startup project | Builds the app host and reads config (`Program.cs`, appsettings, env vars) |

In Clean Architecture:

```text
src/
  Api/              <- Program.cs, appsettings.json, connection string
  Application/
  Infrastructure/   <- AppDbContext, entity configs, Migrations/
```

- DbContext and migrations live in Infrastructure
- Infrastructure is a class library and has no entry point
- EF reads configuration from Api to build the host and the `DbContextOptions`

### What happens if you leave them out

| Missing | Result |
|---|---|
| `--startup-project` | EF cannot build the host or read configuration |
| `--project` | EF can't tell which project contains the migrations |
| Neither | EF may generate files in the wrong project |

### When you can skip them

If the app is a single-project app, the current directory can act as both startup and target project, so plain commands work.

## 5.3 Add a migration

```bash
dotnet ef migrations add InitialCreate $EF --output-dir Persistence/Migrations
dotnet ef migrations add AddOrderDescription $EF
```

EF compares the model with the last migration snapshot and creates a migration class with `Up` and `Down` methods.

Example:

```csharp
public partial class AddOrderDescription : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Description",
            table: "Orders",
            type: "nvarchar(max)",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "Description", table: "Orders");
    }
}
```

## 5.4 List migrations

```bash
dotnet ef migrations list $EF
dotnet ef migrations list $EF --connection "<connection-string>"
```

## 5.5 Remove the last migration

```bash
dotnet ef migrations remove $EF
dotnet ef migrations remove $EF --force
```

Use this only before the migration is applied to a shared or production database. Never remove a migration that was already applied to a real environment; instead add a corrective migration.

## 5.6 Check pending model changes

```bash
dotnet ef migrations has-pending-model-changes $EF
```

This is very useful in CI to catch cases where the entity model changed but the migration was forgotten.

## 5.7 Apply migrations

```bash
dotnet ef database update $EF
dotnet ef database update AddOrderDescription $EF
dotnet ef database update $EF --connection "Server=...;Database=App;..."
```

EF uses `__EFMigrationsHistory` to know which migrations are already applied.

## 5.8 Roll back

```bash
dotnet ef database update InitialCreate $EF
dotnet ef database update 0 $EF
```

This runs the `Down()` methods for later migrations and can lead to data loss if you drop columns or other schema elements. After a rollback, you can remove the migration files if you want to clean the project.

## 5.9 Drop the database

```bash
dotnet ef database drop $EF --dry-run
dotnet ef database drop $EF
dotnet ef database drop $EF --force
```

**Important:** this drops the whole database pointed to by the startup project's connection string — not just EF tables.

### Typical dev reset

```bash
dotnet ef database drop $EF --force
dotnet ef database update $EF
```

**When to use it:**

- local development
- throwaway database
- reset after messy migration history

**Never use it on staging/production without a deliberate plan.**

## 5.10 Generate SQL scripts

```bash
# Everything from empty database to latest
dotnet ef migrations script $EF -o migrate.sql

# Idempotent script
dotnet ef migrations script $EF --idempotent -o migrate.sql

# Range between two migrations
dotnet ef migrations script InitialCreate AddOrderDescription $EF -o upgrade.sql

# From nothing to a specific migration
dotnet ef migrations script 0 InitialCreate $EF -o initial.sql
```

An idempotent script is safe for deployment pipelines because it only applies missing migrations.

## 5.11 Migration bundle

```bash
dotnet ef migrations bundle $EF --self-contained -r linux-x64 -o efbundle --force

./efbundle --connection "$CONNECTION_STRING"
./efbundle --connection "$CONNECTION_STRING" AddOrderDescription
```

A migration bundle packages the migration logic into a single executable. It is useful in CI/CD where you want a clean, repeatable database migration step without installing extra tooling on the target environment.

## 5.12 DbContext commands

```bash
dotnet ef dbcontext list $EF
dotnet ef dbcontext info $EF
dotnet ef dbcontext script $EF -o schema.sql
dotnet ef dbcontext optimize $EF
```

If there are multiple contexts, add `--context AppDbContext` to commands.

## 5.13 Reverse engineering an existing database

```bash
dotnet ef dbcontext scaffold "Server=.;Database=Legacy;Trusted_Connection=True;TrustServerCertificate=True" \
  Microsoft.EntityFrameworkCore.SqlServer \
  --project src/Infrastructure --startup-project src/Api \
  --output-dir Entities --context-dir Persistence --context LegacyDbContext \
  --data-annotations --table Orders --table Customers --force
```

- `--table` / `--schema` limit what is generated
- `--data-annotations` uses attributes where possible
- `--force` overwrites existing files
- `--no-onconfiguring` can avoid hardcoded connection strings in generated code

## 5.14 Useful options on most commands

| Option | Purpose |
|---|---|
| `--project <path>` | Target project where the DbContext and migrations live |
| `--startup-project <path>` | Startup project used to build the host and read config |
| `--context <name>` | Choose the DbContext when there are multiple |
| `--output-dir <path>` | Folder for migration files |
| `--connection <string>` | Override the connection string |
| `--configuration Release` | Build configuration |
| `--no-build` | Skip rebuild if already built |
| `--verbose` | Show more detailed logs |
| `-- --environment Production` | Pass arguments to the app at runtime |

## 5.15 Package Manager Console equivalents

| CLI | PMC |
|---|---|
| `migrations add Name` | `Add-Migration Name` |
| `migrations remove` | `Remove-Migration` |
| `migrations list` | `Get-Migration` |
| `database update` | `Update-Database` |
| `database drop` | `Drop-Database` |
| `migrations script --idempotent` | `Script-Migration -Idempotent` |
| `dbcontext scaffold ...` | `Scaffold-DbContext ...` |

## 5.16 Editing migrations by hand

Migrations are code; read them before applying them.

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<string>("Status", "Orders", nullable: false, defaultValue: "Pending");
    migrationBuilder.Sql("UPDATE Orders SET Status = 'Completed' WHERE PaidAt IS NOT NULL");
}
```

### Rename column safely

EF often generates `DropColumn` + `AddColumn` which can lose data. Replace it with:

```csharp
migrationBuilder.RenameColumn(name: "Total", table: "Orders", newName: "GrandTotal");
```

## 5.17 Common problems and fixes

| Problem | Cause / fix |
|---|---|
| "Unable to create a DbContext" | Startup project or configuration is wrong |
| "Startup project doesn't reference Microsoft.EntityFrameworkCore.Design" | Add the design package to the startup project |
| "There is already an object named 'X' in the database" | Database already exists without migration history |
| Migrations created in the wrong project | Use `--project` and `--startup-project` correctly |
| Missing connection string | Re-check configuration in the startup project |

---

# 6. Database-first / reverse engineering

EF Core supports both Code First and Database First approaches. In Database First, you use `Scaffold-DbContext` to generate the model from an existing database.

This is useful when the database already exists and you need to map it to code quickly.

## Setup

```powershell
Install-Package Microsoft.EntityFrameworkCore.Tools
```

## `scaffold-dbcontext`

```powershell
Scaffold-DbContext "<connection-string>" Microsoft.EntityFrameworkCore.SqlServer -OutputDir Models
```

### Important notes

- The generated context inherits from `DbContext`
- The context class is usually created in the Models folder
- The generated `OnConfiguring` may contain a hardcoded connection string
- EF Core creates the model based on the database schema, not vice versa

### What if the database changes?

EF Core does not automatically update the model when the database changes. You must reverse engineer again or manually update the model.

### What if the model changes?

You may need to do the following:

1. Create models via reverse engineering
2. Run `add-migration`
3. Generate a script with `script-migration`
4. Create `__EFMigrationsHistory` if required
5. Insert the initial migration history rows into the database

---

# 7. Raw SQL and parameterized queries

Examples showing how to run parameterized raw SQL safely with EF Core.

## Safe raw SQL using interpolation

```csharp
using var ctx = new AppDbContext();

var products = await ctx.Products
    .FromSqlInterpolated($@"
        SELECT Id, Name, Price
        FROM Products
        WHERE Price > {minPrice}
    ")
    .ToListAsync();
```

## Safe raw SQL using explicit parameters

```csharp
using var ctx = new AppDbContext();

var param = new SqlParameter("@name", SqlDbType.NVarChar, 200) { Value = name };

var product = await ctx.Products
    .FromSqlRaw(@"
        SELECT Id, Name, Price
        FROM Products
        WHERE Name = @name
    ", param)
    .FirstOrDefaultAsync();
```

> Note: `FromSqlInterpolated` is usually the cleanest and safest option because parameters are generated automatically.

---

# 8. IQueryable vs IEnumerable

This is about where and how the query executes.

## `IEnumerable`

- Executes in memory
- LINQ operators run after the data is loaded
- Best for small, already-in-memory collections

```csharp
IEnumerable<Tasks> enumerableTasks = _appContext.Tasks.ToList().Where(t => t.IsCompleted);
```

This first loads all tasks into memory, then filters locally.

## `IQueryable`

- Query is executed at the data source
- LINQ is translated into SQL or another query language
- Reduces memory usage and network load
- Best for EF Core and database-backed queries

```csharp
IQueryable<Tasks> queryableTasks = _appContext.Tasks.Where(t => t.IsCompleted);
```

EF Core will translate this into a SQL `WHERE` clause and execute it on the server.

### Quick summary

- `IEnumerable` = in-memory, client-side filtering
- `IQueryable` = database-side, server-side filtering

---

# 9. Concurrency and update patterns

## `DbUpdateConcurrencyException`

EF Core throws `DbUpdateConcurrencyException` when a concurrency token is set and the row changed since it was last read.

### How EF Core detects concurrency

It includes the concurrency token in the generated `UPDATE` or `DELETE` statement.

If no row matches, it throws the exception.

### Mark a normal property as concurrency token

```csharp
modelBuilder.Entity<Project>()
    .Property(p => p.Name)
    .IsConcurrencyToken();
```

### Better option: `RowVersion` with `[Timestamp]`

```csharp
public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}
```

This is the recommended approach for SQL Server because the database updates the rowversion automatically whenever the row changes.

## `Update` vs `ExecuteUpdateAsync`

### `Update` + `SaveChangesAsync`

```csharp
var project = await _context.Projects.FindAsync(id);
project.Name = "New Name";
await _context.SaveChangesAsync();
```

**Pros:**

- tracked update
- concurrency checks active
- works well with validation and business logic

**Cons:**

- extra round trip
- more memory usage

### `ExecuteUpdateAsync`

```csharp
await _context.Projects
    .Where(p => p.IsActive)
    .ExecuteUpdateAsync(p =>
        p.SetProperty(x => x.DueDate, x => DateTimeOffset.UtcNow.AddDays(7)));
```

**Pros:**

- efficient bulk update
- no entity materialization
- single SQL statement

**Cons:**

- no tracking
- no automatic concurrency validation
- limited to simple property updates

### Rule of thumb

- business logic + concurrency safety → use tracked `Update` + `SaveChangesAsync`
- bulk data changes / performance optimization → use `ExecuteUpdateAsync`

---

# 10. Quick cheat sheet

## Common commands

```bash
# Create migration
dotnet ef migrations add AddOrderDescription --project src/Infrastructure --startup-project src/Api

# List migrations
dotnet ef migrations list --project src/Infrastructure --startup-project src/Api

# Apply all pending migrations
dotnet ef database update --project src/Infrastructure --startup-project src/Api

# Rollback to a specific migration
dotnet ef database update InitialCreate --project src/Infrastructure --startup-project src/Api

# Drop database
dotnet ef database drop --project src/Infrastructure --startup-project src/Api --force

# Generate SQL script
dotnet ef migrations script --project src/Infrastructure --startup-project src/Api -o migration.sql
```

## Best practices

- Keep `DbContext` and migrations in Infrastructure
- Use `--project` and `--startup-project` explicitly in Clean Architecture
- Read generated migrations before applying them
- Prefer idempotent deployment scripts for production
- Use `RowVersion` / `[Timestamp]` for concurrency-sensitive entities
- Use eager loading when related data is required immediately
- Avoid lazy loading on large datasets without careful review
- Use bulk methods for bulk changes, but not when concurrency is critical

---

This combined note is intended to serve both as a study guide and a practical command reference for EF Core work in .NET applications.
