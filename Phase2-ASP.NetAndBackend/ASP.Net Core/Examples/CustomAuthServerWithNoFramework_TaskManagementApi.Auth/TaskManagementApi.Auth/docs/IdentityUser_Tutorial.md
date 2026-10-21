# Understanding IdentityUser<T>: A Practical Tutorial

This tutorial explains `IdentityUser<T>` (from `Microsoft.AspNetCore.Identity`) and shows a focused, runnable example to learn best practices.

## What is `IdentityUser<T>`?

- **`IdentityUser<TKey>`** is the generic user entity used by ASP.NET Core Identity. The `TKey` generic parameter is the type used for the user's primary key (commonly `string`, `Guid`, or `int`).
- The framework also provides a non-generic `IdentityUser` which is equivalent to `IdentityUser<string>`.

Why a generic key?
- Using a generic allows you to choose the data type best suited for your domain (GUIDs for distributed systems, ints for smaller DBs, strings for default GUID-as-string or user-defined keys).

## When to customize the key type

- `string` (default): easiest, compatible with many samples and external libraries.
- `Guid`: good for stronger uniqueness and when you want a typed Guid key.
- `int`: smaller size, simpler sequential keys for some legacy databases.

## Typical customizations

- Add domain properties to the user (e.g., `FirstName`, `LastName`).
- Use a typed primary key like `Guid` for better type-safety across your codebase.

## Minimal runnable example (InMemory EF Core)

This example uses `Guid` as the key type and shows how to register services and create a user using `UserManager<TUser>`.

Files shown:
- `Program.cs` — minimal configuration
- `ApplicationUser.cs` — custom user type
- `ApplicationDbContext.cs` — Identity-aware DbContext

### ApplicationUser.cs

```csharp
using Microsoft.AspNetCore.Identity;
using System;

namespace IdentityDemo;

public class ApplicationUser : IdentityUser<Guid>
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
}
```

### ApplicationDbContext.cs

```csharp
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System;

namespace IdentityDemo;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }
}
```

### Program.cs (minimal console/web host style)

```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System;

var builder = WebApplication.CreateBuilder(args);

// Use InMemory DB so the example is runnable without SQL Server
builder.Services.AddDbContext<ApplicationDbContext>(opt =>
    opt.UseInMemoryDatabase("IdentityDemoDb"));

// Register Identity with Guid keys
builder.Services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
    {
        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

var app = builder.Build();

// Run a small demo on startup to create a user
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = services.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

    // Ensure role exists
    var adminRoleName = "Admin";
    if (await roleManager.FindByNameAsync(adminRoleName) == null)
    {
        await roleManager.CreateAsync(new IdentityRole<Guid>(adminRoleName));
    }

    // Create user
    var user = new ApplicationUser
    {
        Id = Guid.NewGuid(),
        UserName = "alice@example.com",
        Email = "alice@example.com",
        FirstName = "Alice",
        LastName = "Doe",
        EmailConfirmed = true
    };

    var result = await userManager.CreateAsync(user, "P@ssw0rd!");
    if (result.Succeeded)
    {
        await userManager.AddToRoleAsync(user, adminRoleName);
        Console.WriteLine($"Created user {user.Email} with id {user.Id}");
    }
    else
    {
        Console.WriteLine("Failed to create user: " + string.Join(',', result.Errors));
    }
}

app.MapGet("/", () => "IdentityUser<T> demo running. See console output for created user.");

app.Run();
```

Notes on the example:
- We used `IdentityRole<Guid>` alongside `ApplicationUser : IdentityUser<Guid>` so role keys and user keys match.
- For production you would use a persistent database (SQL Server, PostgreSQL) and run migrations.

## Creating migrations when using GUID keys

- In your project, set up EF Core tools and run:

```bash
dotnet ef migrations add InitialIdentity
dotnet ef database update
```

If using `Guid` keys, ensure your entity properties use `Guid` and that your `DbContext` is configured for the right stores.

## Common gotchas and tips

- When switching key types, update *all* Identity generic types: `IdentityUser<TKey>`, `IdentityRole<TKey>`, `IdentityUserClaim<TKey>`, etc., or use `IdentityDbContext<TUser, TRole, TKey>`.
- If you keep `IdentityUser` (non-generic) you implicitly use `string` keys.
- Prefer typed GUIDs (`Guid`) if you want to avoid string parsing and prefer strongly typed IDs.
- For APIs returning IDs, consider returning string representations of `Guid` to clients, or use `ToString()` on the server.

## Extending further

- Add custom `IUserClaimsPrincipalFactory<TUser>` to include extra claims like `FirstName`.
- Add profile pages and map additional properties during registration.
- Implement two-factor authentication with `.AddDefaultTokenProviders()` (already added in the sample).

## Quick reference

- Default (string): `IdentityUser` or `IdentityUser<string>`
- Guid: `IdentityUser<Guid>` and `IdentityRole<Guid>`
- DbContext: `IdentityDbContext<TUser, TRole, TKey>`

---

This file is a hands-on guide. Try the sample by running the project; it will create an in-memory user and print the created user's ID to the console.
