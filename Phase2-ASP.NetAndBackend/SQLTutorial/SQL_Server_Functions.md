# SQL Server Functions with Examples

## 1. Scalar Functions

A scalar function returns a single value.

### Examples

```sql
SELECT GETDATE();
SELECT ABS(-25);
SELECT LEN('SQL Server');
SELECT UPPER('sql');
```

### Custom scalar function example

```sql
CREATE FUNCTION dbo.GetAnnualSalary
(
    @salary DECIMAL(10,2)
)
RETURNS DECIMAL(10,2)
AS
BEGIN
    RETURN @salary * 12;
END;
```

Use it:

```sql
SELECT dbo.GetAnnualSalary(50000);
```

---

## 2. Aggregate Functions

Aggregate functions work on multiple rows and return one result.

### Examples

```sql
SELECT COUNT(*) FROM Employees;
SELECT SUM(Salary) FROM Employees;
SELECT AVG(Salary) FROM Employees;
SELECT MIN(Salary) FROM Employees;
SELECT MAX(Salary) FROM Employees;
```

### Example with table

```sql
SELECT Department, SUM(Salary) AS TotalSalary
FROM Employees
GROUP BY Department;
```

---

## 3. Inline Table-Valued Functions (TVF)

An inline table-valued function returns a table and is typically written with a single `SELECT` statement.

### Example

```sql
CREATE FUNCTION dbo.GetEmployeesByDept
(
    @DeptName NVARCHAR(50)
)
RETURNS TABLE
AS
RETURN
(
    SELECT Id, Name, Salary
    FROM Employees
    WHERE Department = @DeptName
);
```

Use it:

```sql
SELECT *
FROM dbo.GetEmployeesByDept('IT');
```

---

## 4. Multi-Statement Table-Valued Functions

These functions also return a table, but they can contain multiple SQL statements.

### Example

```sql
CREATE FUNCTION dbo.GetHighEarners()
RETURNS @Result TABLE
(
    Id INT,
    Name NVARCHAR(100),
    Salary DECIMAL(10,2)
)
AS
BEGIN
    INSERT INTO @Result
    SELECT Id, Name, Salary
    FROM Employees
    WHERE Salary > 50000;

    RETURN;
END;
```

Use it:

```sql
SELECT *
FROM dbo.GetHighEarners();
```

---

## 5. Window Functions

Window functions calculate values across rows without collapsing the result into a single group.

### Examples

```sql
SELECT
    Name,
    Salary,
    ROW_NUMBER() OVER (ORDER BY Salary DESC) AS RankBySalary
FROM Employees;
```

```sql
SELECT
    Name,
    Salary,
    SUM(Salary) OVER () AS TotalSalary
FROM Employees;
```

### Common window functions

- `ROW_NUMBER()`
- `RANK()`
- `DENSE_RANK()`
- `SUM() OVER (...)`
- `AVG() OVER (...)`

---

## 6. Built-in System Functions

SQL Server includes many predefined system functions.

### Examples

```sql
SELECT UPPER('sql');
SELECT LOWER('SQL');
SELECT CAST(123 AS VARCHAR(10));
SELECT CONVERT(VARCHAR, GETDATE(), 106);
SELECT CURRENT_TIMESTAMP;
```

---

## Quick Summary

| Function Type | Returns | Example |
| --- | --- | --- |
| Scalar | Single value | `LEN('SQL')` |
| Aggregate | One value from many rows | `SUM(Salary)` |
| Inline TVF | Table | `GetEmployeesByDept('IT')` |
| Multi-statement TVF | Table | custom result set |
| Window | Value per row with window context | `ROW_NUMBER()` |
| System | Built-in SQL utility | `GETDATE()` |

---

## Important Notes

- Scalar functions are used for single-value calculations.
- Aggregate functions summarize data across rows.
- Table-valued functions are useful for reusable table-based logic.
- Window functions are useful for ranking and running totals.
- System functions help with date, string, and conversion operations.

---

## Final Interview Tip

If someone asks, “What are the types of functions in SQL Server?” the standard answer is:

- Scalar functions
- Aggregate functions
- Table-valued functions
- Window functions
- System functions

These are the main categories used in SQL Server development.
