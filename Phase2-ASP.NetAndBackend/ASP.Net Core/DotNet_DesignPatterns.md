# SOLID Principle

SOLID is a set of 5 design principles that help you write code that is easier to maintain, test, extend, and refactor.

## 1) S — Single Responsibility Principle

A class should have only one reason to change.

**Bad example:**

```csharp
public class Invoice
{
    public void CalculateTotal() { }
    public void SaveToDatabase() { }
    public void PrintInvoice() { }
}
```

This class is doing 3 different jobs:

- calculating
- saving
- printing

**Better example:**

```csharp
public class InvoiceCalculator
{
    public decimal CalculateTotal() => 1000;
}

public class InvoiceRepository
{
    public void Save(Invoice invoice) { }
}

public class InvoicePrinter
{
    public void Print(Invoice invoice) { }
}
```

Now each class has one responsibility.

## 2) O — Open/Closed Principle

A class should be open for extension, but closed for modification.
That means you should be able to add new behavior without changing existing code.

**Bad example:**

```csharp
public class DiscountCalculator
{
    public decimal GetDiscount(string customerType, decimal amount)
    {
        if (customerType == "Regular") return amount * 0.1m;
        if (customerType == "Premium") return amount * 0.2m;

        return 0;
    }
}
```

Every time a new customer type comes, you must modify this class.

**Better example:**

```csharp
public interface IDiscountStrategy
{
    decimal GetDiscount(decimal amount);
}

public class RegularDiscount : IDiscountStrategy
{
    public decimal GetDiscount(decimal amount) => amount * 0.1m;
}

public class PremiumDiscount : IDiscountStrategy
{
    public decimal GetDiscount(decimal amount) => amount * 0.2m;
}

public class DiscountCalculator
{
    public decimal Calculate(IDiscountStrategy strategy, decimal amount)
    {
        return strategy.GetDiscount(amount);
    }
}
```

Now new discount types can be added without changing `DiscountCalculator`.

## 3) L — Liskov Substitution Principle

The Liskov Substitution Principle (LSP) states that objects of a superclass should be replaceable with objects of its
subclasses without affecting the correctness of the program. In C#, this means a derived class must adhere to the "contract"
defined by the base class, ensuring that polymorphism doesn't lead to unexpected runtime errors like `NotImplementedException`.

**Violation Example: The Bird Dilemma**

A common violation occurs when a base class defines a behavior that not all its children can perform.

```csharp
// VIOLATION
public class Bird {
    public virtual void Fly() => Console.WriteLine("Flying!");
}

public class Ostrich : Bird {
    public override void Fly() {
        // Ostriches can't fly, so this throws an error
        throw new NotSupportedException("Ostriches can't fly!");
    }
}

// Client code that breaks
public void MakeBirdFly(Bird bird) {
    bird.Fly(); // If 'bird' is an Ostrich, the program crashes
}
```

**Why it's a violation:** The `MakeBirdFly` method expects any `Bird` to be able to fly. Substituting an `Ostrich` breaks this
expectation.

**Correct Implementation: Using Interfaces**

To fix this, segregate behaviors so that only classes capable of an action inherit or implement it.

```csharp
// REFACTORED (Adheres to LSP)
public interface IBird {
    void Move();
}

public interface IFlyable {
    void Fly();
}

public class Sparrow : IBird, IFlyable {
    public void Move() => Console.WriteLine("Sparrow moving");
    public void Fly() => Console.WriteLine("Sparrow flying");
}

public class Ostrich : IBird {
    public void Move() => Console.WriteLine("Ostrich running");
}

// Client code now only accepts birds that can actually fly
public void MakeBirdFly(IFlyable bird) {
    bird.Fly(); 
}
```

**Why it works:** The code no longer forces `Ostrich` to implement a `Fly` method it cannot support. The `IFlyable` interface acts as a
specific contract for flying behavior.

## 4) I — Interface Segregation Principle

A class should not be forced to implement methods it does not use.

**Bad example:**

```csharp
public interface IWorker
{
    void Work();
    void Eat();
}

public class Robot : IWorker
{
    public void Work() { }
    public void Eat()
    {
        throw new NotImplementedException();
    }
}
```

`Robot` does not eat, so it should not be forced to implement `Eat()`.

**Better example:**

```csharp
public interface IWorkable
{
    void Work();
}

public interface IEatable
{
    void Eat();
}

public class Human : IWorkable, IEatable
{
    public void Work() { }
    public void Eat() { }
}

public class Robot : IWorkable
{
    public void Work() { }
}
```

## 5) D — Dependency Inversion Principle

High-level modules should depend on abstractions, not concrete classes.

**Bad example:**

```csharp
public class EmailService
{
    public void Send(string message) { }
}

public class NotificationManager
{
    private EmailService _emailService = new EmailService();

    public void Notify(string message)
    {
        _emailService.Send(message);
    }
}
```

`NotificationManager` is tightly coupled to `EmailService`.

**Better example:**

```csharp
public interface IMessageSender
{
    void Send(string message);
}

public class EmailService : IMessageSender
{
    public void Send(string message) { }
}

public class SmsService : IMessageSender
{
    public void Send(string message) { }
}

public class NotificationManager
{
    private readonly IMessageSender _messageSender;

    public NotificationManager(IMessageSender messageSender)
    {
        _messageSender = messageSender;
    }

    public void Notify(string message)
    {
        _messageSender.Send(message);
    }
}
```

Now `NotificationManager` can work with email, SMS, or any future sender.

## Easy way to remember SOLID

- **S** — One class, one job
- **O** — Add new behavior without modifying old code
- **L** — Child class must work like parent
- **I** — Small, focused interfaces
- **D** — Depend on interfaces, not concrete classes

# Clean Architecture

> "Clean Architecture is a way of structuring an application so that business logic is independent of frameworks, UI, and
> databases."

👉 **Main goal:**

- Make code maintainable
- Testable
- Flexible to change

🧠 **Core Idea**

> "Dependencies should always point inward toward the core business logic."

Outer layers (UI, DB, APIs) depend on inner layers —
but inner layers should NOT depend on outer layers.

## Outer layer vs Inner layer

✅ **Inner Layers**

Core business logic (most important part of your app):

- Domain (Entities)
- Application (Use cases / Services)

👉 These layers:

- Do NOT depend on anything external
- Contain pure logic

✅ **Outer Layers**

Everything related to external world:

- Database (EF Core)
- Web API (Controllers)
- UI
- External services (Email, APIs)

👉 These layers:

- Depend on inner layers
- Can change frequently

### Example in .NET

**Inner Layer (Application):**

```csharp
public interface IOrderRepository
{
    void Add(Order order);
}

public class OrderService
{
    private readonly IOrderRepository _repo;

    public OrderService(IOrderRepository repo)
    {
        _repo = repo;
    }

    public void CreateOrder(Order order)
    {
        _repo.Add(order);
    }
}
```

👉 Notice:

- No EF Core
- No SQL
- No Controller

✔ Pure business logic

**Outer Layer (Infrastructure):**

```csharp
public class OrderRepository : IOrderRepository
{
    public void Add(Order order)
    {
        // EF Core / DB logic here
    }
}
```

👉 This depends on inner layer (`IOrderRepository`)

**Outer Layer (API)**

```csharp
[ApiController]
public class OrdersController : ControllerBase
{
    private readonly OrderService _service;

    public OrdersController(OrderService service)
    {
        _service = service;
    }
}
```

This depends on inner layer `OrderService`.

## 🔁 Dependency Direction (Very Important)

👉 Always goes INWARD

```text
Controller → Service → Interface → Domain
Infrastructure → Interface (implements it)
```

❌ **NOT allowed:**

```text
Service → EF Core
Domain → Controller
```

## 💡 Why this matters?

Because outer things change often:

- Database can change (SQL → Mongo)
- UI can change (Web → Mobile)
- Framework can change

👉 But your business logic stays stable

# Layers of Clean Architecture

A typical C# solution is divided into four main projects:

## Domain (Core)

Contains entities, value objects, and business rules. It has zero dependencies on other layers or frameworks.

**Example:**

```csharp
public class Product {
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public decimal Price { get; private set; }

    public Product(string name, decimal price) {
        // Business logic: Price cannot be negative
        if (price < 0) throw new ArgumentException("Price invalid");
        Id = Guid.NewGuid();
        Name = name;
        Price = price;
    }
}
```

## Application

Contains use cases, interfaces (contracts), and DTOs. It orchestrates the domain but doesn't know how data is stored.

👉 Contains use cases / business logic

- Interfaces (contracts)
- Services (use cases)

**Example:**

```csharp
public interface IOrderRepository
{
    void Add(Order order);
}

public class CreateOrderService
{
    private readonly IOrderRepository _repo;

    public CreateOrderService(IOrderRepository repo)
    {
        _repo = repo;
    }

    public void Create(Order order)
    {
        _repo.Add(order);
    }
}
```

## Infrastructure

Implements the interfaces defined in the Application layer, such as Entity Framework Core repositories, email services,
or file system access.

👉 Contains external implementations

- Database (EF Core)
- Email, File, APIs

**Example:**

```csharp
public class OrderRepository : IOrderRepository
{
    public void Add(Order order)
    {
        // Save to DB using EF Core
    }
}
```

## Web / Presentation

The entry point (e.g., ASP.NET Core Web API). It handles HTTP requests and uses Dependency Injection to wire up
implementation.

**Example:**

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly CreateOrderService _service;

    public OrdersController(CreateOrderService service)
    {
        _service = service;
    }

    [HttpPost]
    public IActionResult Create(Order order)
    {
        _service.Create(order);
        return Ok();
    }
}
```

## Example

**Ques:** Model is part of which layer?

**Ans:**

> "It depends on what you mean by 'Model'."

- If it represents business data → Domain layer
- If it is used for API request/response → Presentation layer
- If it is for database mapping → Infrastructure layer

🧠 **Break it down clearly**

### ✅ 1. Domain Model (Domain Layer — INNER)

👉 These are your core business entities

**Example:**

```csharp
public class Order
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
}
```

- ✔ Used in business logic
- ✔ No dependency on EF Core / API
- ✔ Most important model

### ✅ 2. API Model / DTO (Presentation Layer — OUTER)

👉 Used to receive/send data via API

```csharp
public class CreateOrderRequest
{
    public decimal Amount { get; set; }
}
```

- ✔ Used in Controller
- ✔ Not part of business logic
- ✔ Helps avoid exposing domain directly

### ✅ 3. Data Model / Entity (Infrastructure Layer — OUTER)

👉 Used for database (EF Core)

```csharp
public class OrderEntity
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
}
```

- ✔ Used in DB context
- ✔ Can have EF Core annotations
- ✔ Maps to Domain model

## 🔁 Flow Example

```text
API Model (Request DTO)
        ↓
Application Service
        ↓
Domain Model (Business Logic)
        ↓
Infrastructure Model (DB Entity)
```
