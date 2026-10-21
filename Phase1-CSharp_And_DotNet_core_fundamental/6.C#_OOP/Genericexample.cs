public class Entity
{
    public int Id { get; set; }
}

public class Customer : Entity
{
    public string Name { get; set; }
    public Customer() { Name = "Default Customer"; } // default constructor
}

public class InMemoryRepository<T> where T : Entity, new()
{
    private readonly List<T> _items = new();

    // Creates a new blank item (using new()) when needed
    public T CreateDefault()
    {
        var entity = new T(); // ✅ possible only because of new()
        entity.Id = _items.Count + 1;
        _items.Add(entity);
        return entity;
    }
}

// Usage
var repo = new InMemoryRepository<Customer>();
var c1 = repo.CreateDefault();
Console.WriteLine($"{c1.Id} - {c1.Name}");