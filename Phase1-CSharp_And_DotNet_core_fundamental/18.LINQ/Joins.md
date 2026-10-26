# LINQ Joins

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

**Example: Products & Orders (Join to get product name per order item)**

```csharp
var joinResult = orderItems.Join(
    products,                          // inner collection
    item => item.ProductId,            // key from order items
    product => product.Id,             // key from products
    (item, product) => new
    {
        ProductId = item.ProductId,
        ProductName = product.Name,
        Quantity = item.Quantity,
        Total = item.Quantity * item.UnitPrice
    });
```

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
    dept => dept.Id,                // key from departments
    emp => emp.DepartmentId,        // key from employees
    (dept, emps) => new
    {
        DepartmentName = dept.Name,
        Employees = emps
    });
```

**Key points:**

- Every department appears (even if it has no employees).
- Employees are grouped under their department.
- `GroupJoin` is useful for hierarchical results.

## Types of joins

Just like SQL, LINQ supports:

- `Join` → (Inner Join)
- `GroupJoin` → (Left Join with grouping)
- `SelectMany` + `DefaultIfEmpty` → (Left Outer Join)
- Join combinations → (Right Outer / Full Outer Join — not directly supported but can be simulated)

### 1) Inner Join

An inner join returns only the matching elements from both collections based on a specified key.

**Query Syntax:**

```csharp
var innerJoinQuery = from employee in employees
                     join department in departments on employee.DepartmentId equals department.Id
                     select new { employee.Name, department.DepartmentName };
```

**Method Syntax:**

```csharp
var innerJoinMethod = employees.Join(departments,
                                     employee => employee.DepartmentId,
                                     department => department.Id,
                                     (employee, department) => new { employee.Name, department.DepartmentName });
```

### 2) Left Outer Join

A left outer join returns all elements from the left collection and the matching elements from the right collection. If no match is found in the
right collection, the corresponding properties from the right collection will be null or default values.

**Query Syntax:**

```csharp
var leftOuterJoinQuery = from employee in employees
                         join department in departments on employee.DepartmentId equals department.Id into empDeptGroup
                         from dept in empDeptGroup.DefaultIfEmpty()
                         select new { employee.Name, DepartmentName = (dept != null ? dept.DepartmentName : "N/A") };
```

**Method Syntax:**

```csharp
var leftOuterJoinMethod = employees.GroupJoin(departments,
                                              employee => employee.DepartmentId,
                                              department => department.Id,
                                              (employee, empDeptGroup) => new { employee, empDeptGroup })
                                   .SelectMany(x => x.empDeptGroup.DefaultIfEmpty(),
                                               (x, dept) => new { x.employee.Name, DepartmentName = (dept != null ? dept.DepartmentName : "N/A") });
```

### 3) Group Join

A group join is similar to a left outer join but it groups the matching elements from the right collection for each element in the left collection.

**Query Syntax:**

```csharp
var groupJoinQuery = from department in departments
                     join employee in employees on department.Id equals employee.DepartmentId into departmentEmployees
                     select new { department.DepartmentName, Employees = departmentEmployees };
```

**Method Syntax:**

```csharp
var groupJoinMethod = departments.GroupJoin(employees,
                                            department => department.Id,
                                            employee => employee.DepartmentId,
                                            (department, departmentEmployees) => new { department.DepartmentName, Employees = departmentEmployees });
```

### 4) Simulating Right Outer Join

LINQ doesn't support right join directly.
But you can swap collections and do a left join.

**Example:**

```csharp
var rightJoin = from s in students
                join d in departments
                on s.Id equals d.Id into dGroup
                from d in dGroup.DefaultIfEmpty()
                select new
                {
                    Student = s.Name,
                    Department = d?.DeptName ?? "No Department"
                };
```

### 5) Full Outer Join (Simulated)

Combine a left join and a right join with a union.

**Example (concept):**

```csharp
var left = from d in departments
           join s in students
           on d.Id equals s.Id into sGroup
           from s in sGroup.DefaultIfEmpty()
           select new { Department = d.DeptName, Student = s?.Name };

var right = from s in students
            join d in departments
            on s.Id equals d.Id into dGroup
            from d in dGroup.DefaultIfEmpty()
            select new { Department = d?.DeptName, Student = s.Name };

var fullOuter = left.Union(right);
```

## `Union(other)` / `Intersect(other)` / `Except(other)`

### `Union` — Combine without duplicates

**Definition:**
`Union` combines two sequences and returns distinct elements that appear in either sequence.
Duplicates are removed automatically.

```csharp
var result = seq1.Union(seq2);
```

### `Intersect` — Common elements only

**Definition:**
`Intersect` returns elements that are present in both sequences.

```csharp
var result = seq1.Intersect(seq2);
```

### `Except` — Elements in the first but not in the second

**Definition:**
`Except` returns elements that exist in the first sequence but not in the second.

```csharp
var result = seq1.Except(seq2);
```
