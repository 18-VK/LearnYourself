# SQL CASE Clause

The CASE statement is basically if–else logic inside SQL.

>> Syntax

SELECT 
    column_name,
    CASE 
        WHEN condition1 THEN result1
        WHEN condition2 THEN result2
        ELSE default_result
    END AS alias_name
FROM table_name;

>> Example 1: Basic Usage
SELECT 
    Name,
    Salary,
    CASE 
        WHEN Salary > 100000 THEN 'High'
        WHEN Salary BETWEEN 50000 AND 100000 THEN 'Medium'
        ELSE 'Low'
    END AS SalaryCategory
FROM Employees;

👉 Output adds a new computed column

>> Example 2: Inside ORDER BY
SELECT Name, Status
FROM Tasks
ORDER BY 
    CASE 
        WHEN Status = 'Pending' THEN 1
        WHEN Status = 'InProgress' THEN 2
        WHEN Status = 'Completed' THEN 3
    END;


- How It Works
Normally, ORDER BY Status would sort alphabetically (Completed, InProgress, Pending).

Here, the CASE expression assigns numeric ranks:

Pending → 1
InProgress → 2
Completed → 3

The query then sorts rows by these numeric values, so the order is:

Pending
InProgress
Completed

- Suppose your table is:

| Name | Status |
| --- | --- |
| Task A | Completed |
| Task B | Pending |
| Task C | InProgress |
| Task D | Pending |

Result after query:

| Name | Status |
| --- | --- |
| Task B | Pending |
| Task D | Pending |
| Task C | InProgress |
| Task A | Completed |

>> Example 3: Conditional Aggregation

SELECT 
    COUNT(CASE WHEN Status = 'Completed' THEN 1 END) AS CompletedTasks,
    COUNT(CASE WHEN Status = 'Pending' THEN 1 END) AS PendingTasks
FROM Tasks;

👉 Used in dashboards / reports

- For each row in Tasks, if Status = 'Completed', the CASE returns 1. Otherwise, it returns NULL.
- COUNT then counts how many 1s exist → total completed tasks.

>>CASE inside UPDATE

UPDATE Employees
SET Bonus = 
    CASE 
        WHEN Salary > 100000 THEN 10000
        ELSE 5000
    END;

## Real Interview-Level Use Case

SELECT 
    Department,
    COUNT(*) AS TotalEmployees,
    SUM(CASE WHEN Gender = 'Male' THEN 1 ELSE 0 END) AS MaleCount,
    SUM(CASE WHEN Gender = 'Female' THEN 1 ELSE 0 END) AS FemaleCount
FROM Employees
GROUP BY Department;

👉 This is very commonly asked

## When to Use CASE (Important Insight)

Use CASE when:

You need derived columns
You want conditional aggregation
You need custom sorting
You want inline business logic in SQL

Avoid overusing it when:
Logic becomes complex → move to backend (.NET service layer)

# IIF (Shortcut for CASE – SQL Server)

SELECT Name,
       IIF(Salary > 50000, 'Good', 'Average') AS SalaryStatus
FROM Employees;

# COALESCE (Handle NULLs)

COALESCE(expr1, expr2, expr3, …) returns the first non‑NULL value in the list.
If all values are NULL, it returns NULL.
It’s very handy for handling missing data in SQL queries.

📌 Your Example

SELECT Name, COALESCE(Phone, 'Not Available') AS Phone
FROM Users;
For each row:

If Phone has a value → show that value.
If Phone is NULL → show 'Not Available'.

## ISNULL (SQL Server specific)

SELECT Name, ISNULL(Phone, 'Not Available') AS Phone
FROM Users;

# NULLIF 

>> Why Use NULLIF

To convert specific values into NULLs (often sentinel values like 0, -1, or empty strings).
Useful when you want to avoid division by zero:

SELECT Value / NULLIF(Divisor, 0) 
FROM Table;

→ If Divisor = 0, it becomes NULL instead of throwing an error.

# EXISTS (Better than IN sometimes)

SELECT Name
FROM Customers c
WHERE EXISTS (
    SELECT 1 FROM Orders o WHERE o.CustomerId = c.Id
);

👉 More performant in many cases

# UNION vs UNION ALL

## UNION

Combines results
Removes duplicate rows
Slightly slower (because DB checks duplicates)

>> example : 

SELECT Name FROM Employees
UNION
SELECT Name FROM Managers;

>> Example Output

Employees:

Aman
Rahul

Managers:

Rahul
Vikas

Result:

Aman
Rahul
Vikas

👉 Rahul appears only once

## UNION ALL
Combines results
Keeps duplicates
Faster than UNION

SELECT Name FROM Employees
UNION ALL
SELECT Name FROM Managers;

Result:

Aman
Rahul
Rahul
Vikas

👉 Duplicate rows are preserved