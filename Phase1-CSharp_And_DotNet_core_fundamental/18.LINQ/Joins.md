# LINQ Joins

## Shared dataset used in all examples

These sample collections are simple and intentionally small so you can see exactly how each LINQ join behaves.

```csharp
var departments = new[]
{
    new { Id = 1, Name = "Engineering" },
    new { Id = 2, Name = "HR" },
    new { Id = 3, Name = "Finance" },
    new { Id = 4, Name = "Marketing" }
};

var employees = new[]
{
    new { Id = 1, Name = "Alice", DepartmentId = 1 },
    new { Id = 2, Name = "Bob", DepartmentId = 1 },
    new { Id = 3, Name = "Cathy", DepartmentId = 2 },
    new { Id = 4, Name = "David", DepartmentId = 99 }, // no matching department
    new { Id = 5, Name = "Emma", DepartmentId = 3 }
};

var products = new[]
{
    new { Id = 1, Name = "Laptop", Price = 1200m },
    new { Id = 2, Name = "Mouse", Price = 35m },
    new { Id = 3, Name = "Keyboard", Price = 70m }
};

var orderItems = new[]
{
    new { OrderId = 1001, ProductId = 1, Quantity = 2, UnitPrice = 1200m },
    new { OrderId = 1001, ProductId = 2, Quantity = 1, UnitPrice = 35m },
    new { OrderId = 1002, ProductId = 3, Quantity = 3, UnitPrice = 70m },
    new { OrderId = 1003, ProductId = 99, Quantity = 1, UnitPrice = 5m } // no matching product
};

var students = new[]
{
    new { Id = 1, Name = "Aisha", DepartmentId = 1 },
    new { Id = 2, Name = "Ben", DepartmentId = 4 },
    new { Id = 3, Name = "Chloe", DepartmentId = 99 }, // no matching department
    new { Id = 4, Name = "Daniel", DepartmentId = 3 }
};

var numbersA = new[] { 1, 2, 2, 3, 4 };
var numbersB = new[] { 2, 3, 5 };
```

This dataset gives us:

- matching employees and departments for `Engineering`, `HR`, and `Finance`
- one employee with no matching department (`David`)
- one order item with no matching product (`ProductId = 99`)
- one student with no matching department (`Chloe`)

---

## Join — Inner Join (one-to-one / many-to-one)

**Definition:**
`Join` matches elements from two collections based on a common key.
Only elements that have matching keys in both collections are returned.

**Syntax (Method)**

```csharp
var result = outer.Join(
    inner,
    outerKeySelector,
    innerKeySelector,
    resultSelector
);
```

✅ Think of it like `INNER JOIN` in SQL.

**Example: Products & Orders (get product name and total for each valid order item)**

```csharp
var joinResult = orderItems.Join(
    products,
    item => item.ProductId,
    product => product.Id,
    (item, product) => new
    {
        OrderId = item.OrderId,
        ProductId = item.ProductId,
        ProductName = product.Name,
        Quantity = item.Quantity,
        Total = item.Quantity * item.UnitPrice
    });

foreach (var x in joinResult)
{
    Console.WriteLine($"Order {x.OrderId}: {x.ProductName} x {x.Quantity} = {x.Total}");
}
```

**Output:**

```text
Order 1001: Laptop x 2 = 2400
Order 1001: Mouse x 1 = 35
Order 1002: Keyboard x 3 = 210
```

The last record in `orderItems` has `ProductId = 99`, but there is no product with `Id = 99`, so it is excluded by the inner join.

---

## GroupJoin — Left Outer Join (grouped results)

**Definition:**
`GroupJoin` correlates elements of two sequences and groups the matches.
Even if there's no match, the outer element is still included with an empty group.

**Syntax (Method)**

```csharp
var result = outer.GroupJoin(
    inner,
    outerKeySelector,
    innerKeySelector,
    (outerItem, matchingGroup) => new { outerItem, matchingGroup }
);
```

✅ Think of it like `LEFT JOIN` + `GROUP BY` in SQL.

**Example: Departments & Employees**

```csharp
var groupJoinResult = departments.GroupJoin(
    employees,
    dept => dept.Id,
    emp => emp.DepartmentId,
    (dept, emps) => new
    {
        DepartmentName = dept.Name,
        Employees = emps.Select(e => e.Name)
    });

foreach (var dept in groupJoinResult)
{
    Console.WriteLine($"{dept.DepartmentName}: {string.Join(", ", dept.Employees)}");
}
```

**Output:**

```text
Engineering: Alice, Bob
HR: Cathy
Finance: Emma
Marketing:
```

**Key points:**

- Every department appears (even if it has no employees).
- Employees are grouped under their department.
- `GroupJoin` is useful for hierarchical results.
- `Marketing` appears with an empty group because no employee belongs to that department.

---

## Types of joins

Just like SQL, LINQ supports:

- `Join` → Inner Join
- `GroupJoin` → Left Join with grouping
- `SelectMany` + `DefaultIfEmpty` → Left Outer Join
- Swapping collections → Right Outer / Full Outer Join simulation

### 1) Inner Join

An inner join returns only the matching elements from both collections based on a specified key.

**Query Syntax:**

```csharp
var innerJoinQuery = from employee in employees
                     join department in departments on employee.DepartmentId equals department.Id
                     select new
                     {
                         employee.Name,
                         DepartmentName = department.Name
                     };

foreach (var item in innerJoinQuery)
{
    Console.WriteLine($"{item.Name} -> {item.DepartmentName}");
}
```

**Output:**

```text
Alice -> Engineering
Bob -> Engineering
Cathy -> HR
Emma -> Finance
```

`David` is missing because his `DepartmentId = 99` has no matching department.

**Method Syntax:**

```csharp
var innerJoinMethod = employees.Join(
    departments,
    employee => employee.DepartmentId,
    department => department.Id,
    (employee, department) => new
    {
        employee.Name,
        DepartmentName = department.Name
    });
```

---

### 2) Left Outer Join

A left outer join returns all elements from the left collection and the matching elements from the right collection. If no match is found in the right collection, the corresponding value is null or default.

**Query Syntax:**

```csharp
var leftOuterJoinQuery = from employee in employees
                         join department in departments on employee.DepartmentId equals department.Id into empDeptGroup
                         from dept in empDeptGroup.DefaultIfEmpty()
                         select new
                         {
                             employee.Name,
                             DepartmentName = dept != null ? dept.Name : "N/A"
                         };

foreach (var item in leftOuterJoinQuery)
{
    Console.WriteLine($"{item.Name} -> {item.DepartmentName}");
}
```

**Output:**

```text
Alice -> Engineering
Bob -> Engineering
Cathy -> HR
David -> N/A
Emma -> Finance
```

**Method Syntax:**

```csharp
var leftOuterJoinMethod = employees.GroupJoin(
    departments,
    employee => employee.DepartmentId,
    department => department.Id,
    (employee, empDeptGroup) => new { employee, empDeptGroup })
    .SelectMany(
        x => x.empDeptGroup.DefaultIfEmpty(),
        (x, dept) => new
        {
            x.employee.Name,
            DepartmentName = dept != null ? dept.Name : "N/A"
        });
```

`David` still appears, but with `N/A` because no department matches.

---

### 3) Group Join

A group join is similar to a left outer join, but it groups the matching elements from the right collection for each element in the left collection.

**Query Syntax:**

```csharp
var groupJoinQuery = from department in departments
                     join employee in employees on department.Id equals employee.DepartmentId into departmentEmployees
                     select new
                     {
                         DepartmentName = department.Name,
                         Employees = departmentEmployees.Select(e => e.Name)
                     };

foreach (var item in groupJoinQuery)
{
    Console.WriteLine($"{item.DepartmentName}: {string.Join(", ", item.Employees)}");
}
```

**Output:**

```text
Engineering: Alice, Bob
HR: Cathy
Finance: Emma
Marketing:
```

**Method Syntax:**

```csharp
var groupJoinMethod = departments.GroupJoin(
    employees,
    department => department.Id,
    employee => employee.DepartmentId,
    (department, departmentEmployees) => new
    {
        DepartmentName = department.Name,
        Employees = departmentEmployees.Select(e => e.Name)
    });
```

This is useful when you want one department with a collection of related employees.

---

### 4) Simulating Right Outer Join

LINQ does not support a direct `Right Join`, but you can simulate it by swapping the left and right collections and doing a left join.

**Example:**

```csharp
var rightJoin = from student in students
                join department in departments on student.DepartmentId equals department.Id into studentDeptGroup
                from dept in studentDeptGroup.DefaultIfEmpty()
                select new
                {
                    Student = student.Name,
                    Department = dept != null ? dept.Name : "No Department"
                };

foreach (var item in rightJoin)
{
    Console.WriteLine($"{item.Student} -> {item.Department}");
}
```

**Output:**

```text
Aisha -> Engineering
Ben -> Marketing
Chloe -> No Department
Daniel -> Finance
```

Here, `Chloe` is included even though there is no matching department.

---

### 5) Full Outer Join (Simulated)

A full outer join combines all rows from both sides. LINQ does not provide a direct full outer join, so we simulate it with a left join + right join + `Union`.

**Example:**

```csharp
var left = from department in departments
           join student in students on department.Id equals student.DepartmentId into studentGroup
           from student in studentGroup.DefaultIfEmpty()
           select new
           {
               Department = department.Name,
               Student = student != null ? student.Name : "No student"
           };

var right = from student in students
            join department in departments on student.DepartmentId equals department.Id into departmentGroup
            from department in departmentGroup.DefaultIfEmpty()
            select new
            {
                Department = department != null ? department.Name : "No department",
                Student = student.Name
            };

var fullOuter = left.Union(right);

foreach (var item in fullOuter)
{
    Console.WriteLine($"{item.Department} -> {item.Student}");
}
```

**Output:**

```text
Engineering -> Aisha
HR -> No student
Finance -> Daniel
Marketing -> Ben
Engineering -> No student
HR -> Aisha
Finance -> Daniel
Marketing -> Ben
No department -> Chloe
```

The `Union` removes duplicates, so if the same row appears in both left and right results, it appears only once.

---

## `Union(other)` / `Intersect(other)` / `Except(other)`

These operators work on sequences, not on object joins.

### `Union` — Combine without duplicates

**Definition:**
`Union` combines two sequences and returns distinct elements that appear in either sequence.
Duplicates are removed automatically.

```csharp
var unionResult = numbersA.Union(numbersB);
Console.WriteLine(string.Join(", ", unionResult));
```

**Output:**

```text
1, 2, 3, 4, 5
```

### `Intersect` — Common elements only

**Definition:**
`Intersect` returns elements that are present in both sequences.

```csharp
var intersectResult = numbersA.Intersect(numbersB);
Console.WriteLine(string.Join(", ", intersectResult));
```

**Output:**

```text
2, 3
```

### `Except` — Elements in the first but not in the second

**Definition:**
`Except` returns elements that exist in the first sequence but not in the second.

```csharp
var exceptResult = numbersA.Except(numbersB);
Console.WriteLine(string.Join(", ", exceptResult));
```

**Output:**

```text
1, 4
```

---

## Quick memory trick

- `Join` → only matching rows
- `GroupJoin` → keep everything on the left and group matches on the right
- `DefaultIfEmpty()` → keep unmatched rows and fill with default/null
- `Union` → unique items from both sets
- `Intersect` → only common items
- `Except` → remove items present in the second set

If you remember one rule, remember this:

`Join` is for matching rows.
`GroupJoin` is for keeping the left side visible even when there is no match.
