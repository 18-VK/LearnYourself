# Filters/ValidationFilter.cs

**Why it exists**

To centralize request validation handling instead of repeating checks in every controller.

❌ **Without Filter (bad practice)**

```csharp
[HttpPost]
public IActionResult Create(CreateTaskRequest request)
{
    if (!ModelState.IsValid)
        return BadRequest(ModelState);

    // logic...
}
```

👉 **Problem:**

- Repeated in every endpoint
- Easy to forget
- Controllers become messy

✅ **With Validation Filter (clean approach)**

```csharp
[HttpPost]
[ServiceFilter(typeof(ValidationFilter))]
public IActionResult Create(CreateTaskRequest request)
{
    // No validation code here
}
```

🔧 **Example Implementation**

```csharp
public class ValidationFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.ModelState.IsValid)
        {
            context.Result = new BadRequestObjectResult(context.ModelState);
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
```

💡 **In Production**

You usually:

- Replace with FluentValidation
- Or use `[ApiController]` auto-validation

But knowing filters = important for interviews + customization.

## How to use Validation Filter (clean approach) with fluent validation

**Goal**

- Use FluentValidation for rules
- Use `ValidationFilter` to return consistent errors
- Keep controllers 100% clean

📦 **Step 1: Install FluentValidation**

```bash
dotnet add package FluentValidation.AspNetCore
```

📁 **Step 2: Create Validator**

Example: `CreateTaskRequest`

```csharp
public class CreateTaskRequest
{
    public string Title { get; set; }
    public string Description { get; set; }
    public DateTimeOffset DueDate { get; set; }
}
```

✅ **Fluent Validator**

```csharp
using FluentValidation;

public class CreateTaskValidator : AbstractValidator<CreateTaskRequest>
{
    public CreateTaskValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required")
            .MaximumLength(100);

        RuleFor(x => x.DueDate)
            .GreaterThan(DateTimeOffset.UtcNow)
            .WithMessage("Due date must be in the future");
    }
}
```

⚙️ **Step 3: Register FluentValidation**

```csharp
builder.Services.AddControllers();

builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<CreateTaskValidator>();
```

🔥 **Important Note**

FluentValidation automatically adds errors into `ModelState`

👉 That's why your `ValidationFilter` works perfectly with it

📁 **Step 4: Create ValidationFilter (Improved Version)**

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

public class ValidationFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.ModelState.IsValid)
        {
            var errors = context.ModelState
                .Where(x => x.Value.Errors.Count > 0)
                .Select(x => new
                {
                    Field = x.Key,
                    Errors = x.Value.Errors.Select(e => e.ErrorMessage)
                });

            context.Result = new BadRequestObjectResult(new
            {
                Message = "Validation Failed",
                Errors = errors
            });
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
```

🧩 **Step 5: Register Filter**

```csharp
builder.Services.AddScoped<ValidationFilter>();
```

🚀 **Step 6: Use in Controller**

```csharp
[ApiController]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    [HttpPost]
    [ServiceFilter(typeof(ValidationFilter))]
    public IActionResult Create(CreateTaskRequest request)
    {
        return Ok("Task created");
    }
}
```

✅ **Result Response (Clean & Standard)**

```json
{
  "message": "Validation Failed",
  "errors": [
    {
      "field": "Title",
      "errors": ["Title is required"]
    }
  ]
}
```

## [ServiceFilter(typeof(ValidationFilter))] vs global filter registration

```csharp
builder.Services.AddControllers(options =>
{
    // Apply the filter globally to all controllers
    options.Filters.Add<ValidationFilter>();
});
```

The difference comes down to scope (Global vs. Specific) and flexibility. Both require you to register `ValidationFilter` in the DI container first (`builder.Services.AddScoped<ValidationFilter>();`).

### 1. Global Filter (options.Filters.Add)

Adding it in the `AddControllers` setup applies the filter to every single controller and action in your entire application.

- **Pros:** "Set it and forget it." You don't have to remember to add attributes to new controllers. It ensures a consistent validation experience across the whole API.
- **Cons:** Not flexible. If you have a specific endpoint that shouldn't use this validation logic (e.g., a simple health check or a legacy endpoint), it's harder to exclude it.

### 2. Service Filter ([ServiceFilter])

This is an Attribute you place on top of a specific Controller or a specific Action method.

- **Pros:** Granular control. You can pick and choose exactly where the validation logic runs.
- **Cons:** High maintenance. You have to manually add `[ServiceFilter(typeof(ValidationFilter))]` to every new controller you create. If you forget it on one, that endpoint will have no validation.

## Recommendation for production grade - Web API

It's still a good idea to use both `[ApiController]` and filters together in a production-grade Web API. They solve different parts of the validation story:

📌 **Why Keep [ApiController]**

- It gives you automatic model validation for free.
- If a request body doesn't match the model (e.g., missing required fields, invalid types), ASP.NET Core will
  short-circuit with a 400 Bad Request before your filter even runs.
- It ensures consistent error responses using `ProblemDetails`, which is a standard format many clients expect.

📌 **Why Keep Your ValidationFilter**

- Your filter integrates FluentValidation (or similar libraries) for business rule validation beyond simple data
  annotations.
- It lets you enforce complex rules (e.g., "Age must be greater than 18 if Country = US") that `[ApiController]`
  alone cannot handle.
- You can customize the error payload (like adding `TraceId`, `Instance`, etc.) for observability and debugging.

**How They Work Together**

- **Step 1:** `[ApiController]` runs first → catches invalid model binding and basic annotation errors.
- **Step 2:** Your `ValidationFilter` runs → applies advanced, reusable validation logic using FluentValidation.
- **Step 3:** If both pass → controller action executes.

# Extensions/ServiceCollectionExtensions.cs

🎯 **Why it exists**

To move all dependency injection code out of `Program.cs`.

❌ **Without Extension (messy Program.cs)**

```csharp
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<ITaskService, TaskService>();
builder.Services.AddDbContext<AppDbContext>();
builder.Services.AddAutoMapper(typeof(Program));
```

👉 **Problem:**

- `Program.cs` becomes huge
- Hard to maintain

✅ **With Extension (clean & modular)**

```csharp
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices();
```

🔧 **Example**

```csharp
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IProjectService, ProjectService>();
        services.AddScoped<ITaskService, TaskService>();

        return services;
    }
}
```

💡 **Benefit**

- Clean startup
- Reusable across projects
- Easy to test

# Extensions/ApplicationBuilderExtensions.cs

🎯 **Why it exists**

To cleanly configure middleware pipeline.

❌ **Without Extension**

```csharp
app.UseMiddleware<ExceptionMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseSwagger();
```

👉 Looks fine now, but grows messy later

✅ **With Extension**

```csharp
app.UseCustomMiddleware();
```

🔧 **Example**

```csharp
public static class ApplicationBuilderExtensions
{
    public static IApplicationBuilder UseCustomMiddleware(this IApplicationBuilder app)
    {
        app.UseMiddleware<ExceptionMiddleware>();
        return app;
    }
}
```

💡 **Why this matters**

- Keeps `Program.cs` minimal
- Groups related middleware
- Easier to scale (logging, security, etc.)

# Fluent API configurations with separate configuration class

**Goal**

- Keep Domain clean
- Move DB rules to Configurations
- Plug everything into `DbContext` automatically

🧱 **Step 1: Create Entity (Domain Layer)**

```csharp
public class TaskItem
{
    public Guid Id { get; set; }

    public string Title { get; set; }

    public string Description { get; set; }

    public Guid ProjectId { get; set; }

    public Project Project { get; set; }
}
```

👉 No `[Required]`, no `[MaxLength]` → clean domain

⚙️ **Step 2: Create Fluent Configuration**

📁 `Infrastructure/Persistence/Configurations/TaskConfig.cs`

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class TaskConfig : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        // Table name
        builder.ToTable("Tasks");

        // Primary key
        builder.HasKey(x => x.Id);

        // Properties
        builder.Property(x => x.Title)
               .IsRequired()
               .HasMaxLength(100);

        builder.Property(x => x.Description)
               .HasMaxLength(500);

        // Relationship
        builder.HasOne(x => x.Project)
               .WithMany()
               .HasForeignKey(x => x.ProjectId)
               .OnDelete(DeleteBehavior.Cascade);

        // Index (important for performance)
        builder.HasIndex(x => x.ProjectId);
    }
}
```

🧱 **Step 3: Add Configuration to DbContext**

📁 `AppDbContext.cs`

```csharp
public class AppDbContext : DbContext
{
    public DbSet<TaskItem> Tasks { get; set; }
    public DbSet<Project> Projects { get; set; }

    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Apply all configs automatically
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }
}
```

🔥 **Why ApplyConfigurationsFromAssembly is important**

👉 Without it:

```csharp
modelBuilder.ApplyConfiguration(new TaskConfig());
modelBuilder.ApplyConfiguration(new ProjectConfig());
```

❌ Manual, error-prone

👉 With it:

```csharp
modelBuilder.ApplyConfigurationsFromAssembly(...)
```

- ✅ Automatically picks all configs
- ✅ Scales when project grows

🧪 **Step 4: Run Migration**

```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
```

📊 **What Happens Internally**

```text
Entity (Domain)
     ↓
Fluent Config (Infrastructure)
     ↓
DbContext builds model
     ↓
Migration generates SQL
     ↓
Database schema created
```

💡 **Real Production Tips**

✅ **1. Always use separate config per entity**

✔ Good:

```text
Configurations/
 ├── TaskConfig.cs
 ├── ProjectConfig.cs
```

❌ Bad:

```text
Everything inside DbContext
```

# AutoMapper : for object mapping

That folder is for object-to-object mapping—converting between:

- API models → DTOs
- DTOs → Domain entities
- Entities → Response models

Instead of writing manual mapping everywhere, you centralize it using AutoMapper.

🎯 **Why Mappings/MappingProfile.cs exists**

Without it, you write this repeatedly:

```csharp
var task = new TaskItem
{
    Title = request.Title,
    Description = request.Description
};
```

👉 This becomes messy and duplicated across controllers/services.

✅ **With AutoMapper (clean approach)**

You define mapping once, reuse everywhere.

📁 `MappingProfile.cs`

🔧 **Example**

```csharp
using AutoMapper;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // API → Application
        CreateMap<CreateTaskRequest, TaskDto>();

        // Application → Domain
        CreateMap<TaskDto, TaskItem>();

        // Domain → API Response
        CreateMap<TaskItem, TaskResponse>();
    }
}
```

🔄 **What this gives you**

Instead of manual mapping:

```csharp
var task = new TaskItem
{
    Title = dto.Title
};
```

👉 You just do:

```csharp
var task = _mapper.Map<TaskItem>(dto);
```

🧠 **Full Flow with Mapping**

```text
Request → (Map) → DTO → (Map) → Entity → DB
Entity → (Map) → DTO → (Map) → Response
```

⚙️ **How to Register It**

```csharp
builder.Services.AddAutoMapper(typeof(MappingProfile));
    // or
builder.Services.AddAutoMapper( cfg => { }, typeof(MappingProfile));
```

🚀 **How to Use in Controller / Service**

```csharp
public class TaskService
{
    private readonly IMapper _mapper;

    public TaskService(IMapper mapper)
    {
        _mapper = mapper;
    }

    public async Task CreateTask(CreateTaskRequest request)
    {
        var dto = _mapper.Map<TaskDto>(request);
        var entity = _mapper.Map<TaskItem>(dto);

        // save to DB...
    }
}
```

## MappingProfile with Conversion

```csharp
using AutoMapper;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // String → Enum
        CreateMap<UserDto, User>()
            .ForMember(dest => dest.Role,
                       opt => opt.MapFrom(src => Enum.Parse<UserRole>(src.Role, true)));

        // Enum → String
        CreateMap<User, UserDto>()
            .ForMember(dest => dest.Role,
                       opt => opt.MapFrom(src => src.Role.ToString()));
    }
}
```

🔹 **How It Works**

- When mapping DTO → Entity, AutoMapper calls `Enum.Parse` to convert the string `"Admin"` into `UserRole.Admin`.
- When mapping Entity → DTO, AutoMapper calls `.ToString()` to convert `UserRole.Admin` back into `"Admin"`.

## Map into existing instance vs create new instance

Great distinction, Aman — these two lines look similar but behave differently in AutoMapper:

🔎 **Difference**

### 1. `_mapper.Map(objProject, dto);`

- This merges values from `objProject` into the existing `dto` instance.
- Only the properties present in `objProject` (and not skipped by conditions) will overwrite values in `dto`.
- Any properties not in `objProject` remain unchanged in `dto`.

✅ Best for PATCH/Update scenarios, because it preserves existing values.

### 2. `DTO = _mapper.Map<ProjectDTO>(objProject);`

- This creates a brand-new `ProjectDTO` object from `objProject`.
- All properties in `ProjectDTO` are set — if `objProject` doesn't provide a value, they'll be defaults (`0`, `false`, `DateTimeOffset.MinValue`).
- ❌ Risky for Update, because defaults overwrite existing values.

✅ Fine for Create, because defaults are valid initial values.

## Why this is happening

AutoMapper sees:

```csharp
Guid? Id = null
```

and maps it to:

```csharp
Guid Id = Guid.Empty
```

because the destination property is non-nullable.

That's why you're seeing:

```text
00000000-0000-0000-0000-000000000000
```

even though the source value was actually `null`.

# Why choose AddDbContext vs AddDbContextPool

## AddDbContext

Every time a request comes in, ASP.NET Core creates a fresh `DbContext` instance.

This guarantees strict isolation: no chance that leftover state from a previous request leaks into the next one.

**Downside:** more memory allocations, slightly less efficient under heavy load.

Best for debugging, prototyping, or apps with low traffic, where safety and clarity matter more than performance.

## AddDbContextPool

Instead of creating a new instance every time, it reuses `DbContext` objects from a pool.

EF Core resets the `DbContext` before reuse (clears tracked entities, resets options).

This is faster and more memory-efficient, especially in high-traffic APIs.

**But:** if you add custom state inside your `DbContext` class (like private fields or caching), that state might accidentally persist across requests.

### 📘 Example

**Safe with AddDbContext**

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
```

- Each request gets a brand-new `AppDbContext`.
- No risk of leftover state.

**Faster with AddDbContextPool**

```csharp
builder.Services.AddDbContextPool<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
```

- `DbContext` instances are reused.
- Great for production APIs with heavy load.

**Rule:** Keep your `AppDbContext` clean — don't add request-specific fields or caches inside it.

### ⚠️ Example of What Not to Do with Pooling

```csharp
public class AppDbContext : DbContext
{
    private string _currentUser; // ❌ bad idea

    public void SetUser(string userId)
    {
        _currentUser = userId;
    }
}
```

If you use `AddDbContextPool`, `_currentUser` might still contain data from a previous request when the `DbContext` is reused.

That's why pooling requires `DbContext` to be stateless.

### ✅ Best Practice

- Use `AddDbContextPool` in production for performance.
- Use `AddDbContext` in development/debugging when you want strict isolation and don't care about performance.
- Always keep your `DbContext` free of request-specific state — treat it as a unit of work for database access only.

# Inside UseSqlServer → sqlOptions

## 1. EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)

Enables resilient retries for transient SQL errors (like network hiccups, deadlocks, or Azure SQL throttling).

**Parameters:**

- `5` → Maximum number of retries.
- `TimeSpan.FromSeconds(10)` → Max delay between retries.
- `null` → Error numbers to retry (`null` = default set of transient errors).

✅ **Production benefit:** Prevents random failures from crashing your app.

## 2. CommandTimeout(60)

Sets the maximum time (in seconds) EF Core will wait for a SQL command to execute before throwing a timeout exception.

Default is usually 30 seconds.

✅ **Production benefit:** Longer timeout for heavy queries, but not infinite — avoids hanging connections.

## 🔑 Outside sqlOptions → General EF Core Options

### 3. UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)

Controls whether EF Core tracks changes to entities after they're loaded.

`NoTracking` → EF won't keep track of objects (faster, less memory).

✅ Best for read-heavy APIs (like GET endpoints).

⚠️ If you need to update entities, override with `.AsTracking()`.

### 4. EnableSensitiveDataLogging(false)

Controls whether EF Core logs sensitive data (like parameter values in SQL queries).

`false` → Prevents logging of potentially sensitive info (user IDs, emails, etc.).

✅ **Production best practice:** Keep this off to avoid leaking PII in logs.

⚠️ Turn it on only in development/debugging.

### 5. EnableDetailedErrors(false)

Controls whether EF Core generates detailed error messages (with extra context about query execution).

`false` → Keeps error messages minimal.

✅ **Production best practice:** Avoids overhead and prevents exposing internal details.

⚠️ Turn it on in development for easier debugging.

# Concurrency update problem

## Merge Strategy

Imagine a `Project` entity with fields like `Name`, `Description`, and `DueDate`. Two users update it at the same time:

```csharp
public async Task<bool> UpdateProjectAsync(Project updatedProject, CancellationToken ct)
{
    const int MaxRetryCount = 3;
    int attempt = 0;

    while (attempt < MaxRetryCount)
    {
        try
        {
            _context.Entry(updatedProject).State = EntityState.Modified;    
            await _context.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateConcurrencyException ex)
        {
            attempt++;

            // ✅ Get the conflicting entry
            var entry = ex.Entries.Single();
            var databaseValues = await entry.GetDatabaseValuesAsync(ct);

            if (databaseValues == null)
            {
                // Entity was deleted by another user
                return false;
            }

            var dbProject = (Project)databaseValues.ToObject();

            // ✅ Merge strategy: field-by-field resolution
            var clientProject = (Project)entry.Entity;

            // Example rules:
            // - Keep DB's DueDate (authoritative)
            // - Use client's Description (latest text)
            // - Use whichever Name is longer (demo rule)
            clientProject.DueDate = dbProject.DueDate; // store wins
            clientProject.Description = clientProject.Description; // client wins
            clientProject.Name = clientProject.Name.Length > dbProject.Name.Length
                ? clientProject.Name
                : dbProject.Name;

            // Refresh original values to match DB
            entry.OriginalValues.SetValues(databaseValues);

            _logger.LogWarning("Concurrency conflict resolved by merge for Project {ProjectId}", clientProject.Id);
        }
    }

    return false;
}
```

## _context.Entry(updatedProject).State = EntityState.Modified;

**Why You Sometimes Need It**

**1. Tracked entity (Find/Attach)**

If you load the entity with `FindAsync` or via a query, EF Core is already tracking it. When you change properties, EF knows what changed. You don't need to set the state manually.

```csharp
var project = await _context.Projects.FindAsync(id);
project.Name = "New Name"; // tracked
await _context.SaveChangesAsync(); // EF generates UPDATE
```

**2. Detached entity (e.g., from API request)**

If you receive an object from outside (like a DTO mapped to an entity), EF Core doesn't know about it yet. You attach it to the context, but EF doesn't know which properties changed.
Setting `EntityState.Modified` tells EF: "treat this entity as updated, and update all properties."

```csharp
var project = new Project { Id = dto.Id, Name = dto.Name };
_context.Entry(project).State = EntityState.Modified;
await _context.SaveChangesAsync(); // EF updates all columns
```

## That line is central to how EF Core handles concurrency retries

```csharp
entry.OriginalValues.SetValues(databaseValues);
```

🔑 **What It Does**

- `entry.OriginalValues` = the snapshot EF Core keeps of the entity's values when you first loaded it.
- `databaseValues` = the current values in the database (retrieved after a concurrency conflict).
- `SetValues(databaseValues)` = replaces EF's snapshot with the latest database values.

So you're telling EF Core:

> "Update your baseline to match what's now in the database, so the next `SaveChanges()` attempt will succeed."

⚡ **Why It's Needed**

When a `DbUpdateConcurrencyException` occurs:

- EF tried to UPDATE using the old `RowVersion` (or concurrency token).
- The database rejected it because the row changed.
- You fetch the latest database values.
- You merge them with your client's changes.
- But EF still thinks the entity's original values are stale.
  → If you retry without resetting, EF will throw the same exception again.

By calling `SetValues(databaseValues)`, you refresh EF's "original snapshot" so the next retry compares against the new `RowVersion`.

**Example**

Imagine you load a `Project` with `RowVersion = 10`.

- EF stores `OriginalValues.RowVersion = 10`.
- You change `Name` and try to save.
- Another user already updated the row → DB now has `RowVersion = 11`.

EF throws `DbUpdateConcurrencyException`.

You fetch `databaseValues` → `RowVersion = 11`.

Then you call:

```csharp
entry.OriginalValues.SetValues(databaseValues);
```

Now EF's snapshot is updated:

`OriginalValues.RowVersion = 11`.

On retry, EF compares against the correct version, so the update can succeed.
