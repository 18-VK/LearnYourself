# Clean Architecture

In C#, Clean Architecture organizes code into concentric layers where dependencies only point inward toward the core business logic. This ensures that the
application is independent of frameworks, UI, and external databases.

## Standard Layer Structure

A typical C# solution is divided into four main projects:

- **Domain Layer (Core):**
  Contains the "Enterprise Business Rules" such as Entities (e.g., Product, User), Value Objects, and Domain exceptions. It has zero dependencies on other
  layers or external libraries.

- **Application Layer:**
  Contains "Application Business Rules." This is where you define Interfaces (e.g., `IProductRepository`), DTOs, and Use Cases or Handlers (often using patterns
  like CQRS/MediatR).

- **Infrastructure Layer:**
  Implements the interfaces defined in the Application layer. It handles external concerns like Database access (EF Core), File System, or Email services.

- **Presentation (Web API/UI):**
  The entry point. It handles HTTP requests, wires up Dependency Injection, and maps user input to the Application layer.

## Code Example: Product Management

Below is a simplified implementation showing how the Dependency Inversion Principle works across layers.

### 1. Domain Layer

```csharp
public class Product {
    public int Id { get; set; }
    public string Name { get; set; }
}
```

### 2. Application Layer (Interfaces)

```csharp
public interface IProductRepository {
    Task<Product> GetByIdAsync(int id);
}
```

### 3. Infrastructure Layer (Implementation)

```csharp
public class ProductRepository : IProductRepository {
    private readonly AppDbContext _context;
    public ProductRepository(AppDbContext context) => _context = context;

    public async Task<Product> GetByIdAsync(int id) => 
        await _context.Products.FindAsync(id);
}
```

### 4. Presentation Layer (Controller)

```csharp
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase {
    private readonly IProductRepository _repo;
    public ProductsController(IProductRepository repo) => _repo = repo;

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id) => 
        Ok(await _repo.GetByIdAsync(id));
}
```
