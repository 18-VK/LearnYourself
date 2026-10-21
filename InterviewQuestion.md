# Is it mandatory to have .NET installed to run a .NET application (.dll/.exe)?
✅ Interview-Ready Answer

Short Answer (start strong):
👉 No, it is not always mandatory. It depends on how the application is deployed.

🔹 Two Deployment Types in .NET
1. Framework-Dependent Deployment (FDD)

Definition:
Application depends on the .NET runtime installed on the machine

Key Points:

Smaller app size
Requires correct version of .NET runtime
Common in enterprise environments

👉 Yes, .NET must be installed

2. Self-Contained Deployment (SCD)

Definition:
Application is published with its own .NET runtime

Key Points:

No need to install .NET separately
Larger size (includes runtime)
Fully portable

👉 No, .NET installation is NOT required

🔹 Example
dotnet publish -r win-x64 --self-contained true

👉 This creates an app that runs without installing .NET

🔥 Important Interview Point

👉 In .NET Core / .NET 5+, both deployment options are supported
👉 In .NET Framework, runtime must be installed (no self-contained option)

# IActionResult

Definition:
👉 IActionResult is an interface that represents the result of an action method.

Key Points:

Flexible return type
Can return different responses:
Ok()
NotFound()
BadRequest()

Example:

public IActionResult GetUser(int id)
{
    if (id == 0)
        return BadRequest();

    return Ok("User");
}
🔹 ActionResult

Definition:
👉 ActionResult is a concrete class that implements IActionResult and provides additional flexibility.

🔹 ActionResult<T> (IMPORTANT)

👉 Combines:

Strong typing
HTTP responses

Example:

public ActionResult<User> GetUser(int id)
{
    if (id == 0)
        return BadRequest();

    return new User();
}

# Here’s a clear, practical breakdown of IQueryable, IEnumerable, and List in C#, along with when to use each.

1. IEnumerable<T>

- Namespace: System.Collections.Generic
- Purpose: Represents a forward-only cursor over a collection.
- Execution: In-memory iteration (LINQ-to-Objects).
- Deferred Execution: Yes (for LINQ queries).
- Filtering: Happens in memory after the data is loaded.

Best For:
- Iterating over in-memory collections.
- Small to medium datasets.
- When you don’t need query translation to SQL or other providers.

Example:

IEnumerable<int> numbers = new List<int> { 1, 2, 3, 4, 5 };
var evens = numbers.Where(n => n % 2 == 0); // Filtering in memory

2. IQueryable<T>

- Namespace: System.Linq
- Purpose: Extends IEnumerable<T> to allow query translation (e.g., to SQL).
- Execution: Remote (e.g., database) until enumerated.
- Deferred Execution: Yes.
- Filtering: Happens at the data source (e.g., SQL WHERE clause).

Best For:

- Querying remote data sources (Entity Framework, LINQ-to-SQL, OData).
- Large datasets where filtering should happen before fetching data.
- Composable queries.

Example:

IQueryable<User> users = dbContext.Users; // From EF DbSet
var activeUsers = users.Where(u => u.IsActive); // Translates to SQL WHERE

3. List<T>

- Namespace: System.Collections.Generic
- Purpose: A concrete, resizable array implementation.
- Execution: Always in-memory.
- Deferred Execution: No — data is already loaded.
- Filtering: In memory.

Best For:

- Storing and manipulating data in memory.
- Random access by index.
- When you need collection-specific methods (Add, Remove, Sort, etc.).

Example:

List<string> names = new List<string> { "Alice", "Bob", "Charlie" };
names.Add("David");