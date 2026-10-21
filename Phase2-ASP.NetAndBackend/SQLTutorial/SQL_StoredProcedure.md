# SQL View

>> Definition:
A view is a virtual table created from the result of a query. It doesn’t store data itself, but shows 
data from one or more tables.

In SQL Server, a View is essentially a stored query that acts like a virtual table. It doesn't store data itself; 
instead, it dynamically fetches data from the underlying tables whenever you query it.

>> Purpose: 
Simplifies complex queries, provides a layer of abstraction, and can restrict access to certain columns/rows.

>> Usage: 
Often used for reporting, security, or making queries more readable.
returns dataset result only.

>> Note : 

Stores only the query definition (metadata). It’s like a saved SELECT statement. When you query a view, the database 
engine runs the underlying query against the base tables and returns the current data.

That means if the data in the base tables changes, the view will automatically reflect those changes.

No separate copy of the data is kept (unless you create a materialized view, which does store data physically for 
performance reasons).

## Creating a View
To create a view, you use the CREATE VIEW statement followed by a standard SELECT query.

Syntax:

CREATE VIEW ViewName AS
SELECT Column1, Column2
FROM BaseTable
WHERE Condition;

Example:
If you have a complex join between Employees and Departments, you can wrap it in a view so you don't have to write 
the join every time.


CREATE VIEW EmployeeDetails AS
SELECT 
    e.EmployeeID, 
    e.FirstName + ' ' + e.LastName AS FullName, 
    d.DepartmentName
FROM Employees e
JOIN Departments d ON e.DepartmentID = d.DepartmentID;

## Using a View
Once a view is created, you treat it exactly like a table. You can select from it, join it to other tables, or even apply additional WHERE clauses.

Syntax:

SELECT * FROM ViewName;

Example:
-- Querying our newly created view

SELECT FullName 
FROM EmployeeDetails 
WHERE DepartmentName = 'Engineering';

## Altering a View
If you need to change the logic inside the view (like adding a new column or changing a filter), you use the ALTER 
VIEW statement. This is better than dropping and recreating the view because it preserves permissions associated 
with the object.

Syntax:

ALTER VIEW ViewName AS
SELECT NewColumn1, NewColumn2
FROM BaseTable
WHERE NewCondition;

Example:
Let's update our previous view to include the employee's hire date.

ALTER VIEW EmployeeDetails AS
SELECT 
    e.EmployeeID, 
    e.FirstName + ' ' + e.LastName AS FullName, 
    e.HireDate, -- Added this column
    d.DepartmentName
FROM Employees e
JOIN Departments d ON e.DepartmentID = d.DepartmentID;

# SQL Stored Procedures

>> Purpose: 
Encapsulates business logic, automates repetitive tasks, and improves performance by reducing network traffic.
To perform actions—insert, update, delete, or complex logic.

>> Usage: 
Often used for inserting, updating, or processing data with conditional logic.
Executed explicitly with EXEC or CALL.
May return datasets, messages, or nothing at all.

>> Example:

CREATE PROCEDURE AddCustomer
@Name NVARCHAR(50), @Email NVARCHAR(50)
AS
BEGIN
    INSERT INTO Customers (Name, Email)
    VALUES (@Name, @Email);
END;

## Basics of Stored Procedure 

### Creating a procedure

CREATE PROCEDURE dbo.GetEmployees
AS
BEGIN
    SELECT * FROM Employees;
END;

## Executing a procedure

EXEC dbo.GetEmployees;

### Passing Parameters

>> By Position: Provide values in the exact order the parameters are defined in the procedure.
e.g : 

EXEC dbo.GetEmployees 1, 30; -- PageNumber = 1, RowsPerPage = 30

>> By Name (Recommended): Explicitly assign values to parameter names using @ParameterName = Value. This is clearer and allows parameters to be passed in any order.
e.g : 

EXEC dbo.GetEmployees @PageNumber = 1, @RowsPerPage = 30;
EXEC dbo.GetEmployees @RowsPerPage = 30, @PageNumber = 1; -- Order doesn't matter

### Output Parameters
If a procedure has output parameters, use the OUTPUT keyword when executing to capture the returned value.
e.g : 

DECLARE @TotalCount INT;
EXEC dbo.GetEmployees @PageNumber = 1, @RowsPerPage = 30, @TotalCount = @TotalCount OUTPUT;

-- The @TotalCount variable now holds the value returned by the procedure

## Altering and dropping

-- Alter --
ALTER PROCEDURE dbo.GetEmployees
AS
BEGIN
    SELECT Id, Name FROM Employees;
END;

-- Dropping--
DROP PROCEDURE dbo.GetEmployees;

## Naming conventions

Use meaningful names like:

- dbo.GetEmployees
- dbo.GetEmployeeById
- dbo.CreateOrder

Prefix by action helps a lot:

- Get
- Create
- Update
- Delete
- Search
- Upsert

## Parameter's in Stored procedure

### Input parameter

CREATE PROCEDURE dbo.GetEmployeeById
    @EmployeeId INT
AS
BEGIN
    SELECT * FROM Employees WHERE Id = @EmployeeId;
END;

### Multiple parameters

CREATE PROCEDURE dbo.SearchEmployees
    @Name NVARCHAR(100),
    @DepartmentId INT
AS
BEGIN
    SELECT *
    FROM Employees
    WHERE Name LIKE '%' + @Name + '%'
      AND DepartmentId = @DepartmentId;
END;

### Default Values & Optional Parameters

A parameter becomes optional by assigning it a default value using = value in the procedure definition.

CREATE PROCEDURE dbo.SampleProc
    @RequiredParam INT,          -- Required
    @OptionalParam INT = 10,     -- Optional, defaults to 10
    @StringParam NVARCHAR(50) = 'Default Text' -- Optional string
AS

You can omit optional parameters when executing the procedure, and it will use the default value

### NULL Handling in Parameters

- Using NULL as Default: A common pattern is to use = NULL as the default for optional parameters, especially 
for filtering. 

- The NULL Override Gotcha: If you declare a variable and don't assign it a value, it defaults to NULL. 
Passing this uninitialized variable to a procedure will send NULL, which overrides the procedure's default 
value.

>> Example : 

DECLARE @MyPage INT; -- This is NULL by default
EXEC dbo.GetEmployees @PageNumber = @MyPage; -- Sends NULL, not the proc's default!

>> Note : To use the procedure's default, call the parameter by name without assigning a variable, or 
explicitly use the DEFAULT keyword.

-- Create a procedure with a default parameter value
CREATE PROCEDURE dbo.TestProc
    @Name NVARCHAR(50) = 'DefaultName'
AS
BEGIN
    PRINT 'Hello, ' + @Name;
END;
GO

-- Scenario 1: Execute without providing a value.
-- This uses the procedure's default 'DefaultName'.
EXEC dbo.TestProc; -- Output: Hello, DefaultName

-- Scenario 2: Declare a variable but don't assign it a value (it's NULL).
-- Passing this NULL variable OVERRIDES the procedure's default.
DECLARE @MyName NVARCHAR(50); -- Value is NULL
EXEC dbo.TestProc @Name = @MyName; -- Output: Hello, (nothing after comma, because NULL + string = NULL)

-- Scenario 3: To use the procedure's default, omit the parameter or use the DEFAULT keyword.
EXEC dbo.TestProc; -- Uses default
EXEC dbo.TestProc @Name = DEFAULT; -- Explicitly uses the default value

### Creating Output Parameters

To define an output parameter, use the OUTPUT keyword in the parameter declaration within the CREATE PROCEDURE statement. The procedure can modify the 
parameter's value, and it will be returned to the calling program. 

SQL Server supports various data types for output parameters, including integers, strings, decimals, and even cursor types. 

e.g : 

CREATE PROCEDURE GetProductCountByYear
    @ModelYear SMALLINT,
    @ProductCount INT OUTPUT
AS
BEGIN
    SELECT @ProductCount = COUNT(*)
    FROM production.products
    WHERE model_year = @ModelYear;
END;

>> Using Output Parameters in Practice

To capture an output parameter, the calling program must:

- Declare a variable to hold the result.
- Pass the variable with the OUTPUT keyword during execution. 

DECLARE @Count INT;
EXEC GetProductCountByYear @ModelYear = 2023, @ProductCount = @Count OUTPUT;
SELECT @Count AS 'Number of Products';

>> Note : 
If the OUTPUT keyword is omitted during execution, the variable will remain NULL, even if the procedure assigns a value.

### Handling Errors with Output Parameters
Output parameters can return error codes or messages when exceptions occur. Use TRY...CATCH blocks to manage errors and set meaningful output values. 

CREATE PROCEDURE CalculateSalesTotal
    @Year INT,
    @Total DECIMAL(18,2) OUTPUT,
    @ErrorCode INT OUTPUT
AS
BEGIN
    SET @ErrorCode = 0;
    BEGIN TRY
        IF @Year < 2000
            THROW 50001, 'Invalid year', 1;

        SELECT @Total = SUM(sales_amount)
        FROM sales
        WHERE sale_year = @Year;
    END TRY
    BEGIN CATCH
        SET @Total = 0;
        SET @ErrorCode = ERROR_NUMBER();
    END CATCH
END;

### Using RETURN Values
In addition to output parameters, stored procedures can use the RETURN statement to send an integer status code back to the caller. By convention, 0 
indicates success, and non-zero values indicate errors. 

CREATE PROCEDURE CheckInventory
    @ProductID INT
AS
BEGIN
    DECLARE @Stock INT;
    SELECT @Stock = quantity FROM inventory WHERE product_id = @ProductID;

    IF @Stock > 0
        RETURN 0; -- In stock
    ELSE
        RETURN 1; -- Out of stock
END;

Callers can capture the return value:

DECLARE @Status INT;
EXEC @Status = CheckInventory @ProductID = 101;
PRINT 'Return Status: ' + CAST(@Status AS VARCHAR);

## Assign result set into a variable 
You can’t assign a full result set directly into a scalar variable, but you can store it in a table variable or temp table:

DECLARE @Result TABLE (
    EmployeeID INT,
    FirstName NVARCHAR(50),
    LastName NVARCHAR(50)
);

INSERT INTO @Result
EXEC GetEmployeesByDept @DeptID = 5;

-- Now you can query the variable
SELECT * FROM @Result;

## Variable Declaration and Assignment

You use DECLARE to define a variable (prefixed with @) and SET or SELECT to assign values.

CREATE PROCEDURE usp_VariableExample
AS
BEGIN
    DECLARE @EmployeeName NVARCHAR(100);
    DECLARE @Age INT;

    -- Assigning via SET
    SET @EmployeeName = 'John Doe';
    
    -- Assigning via SELECT (fetching from a table)
    SELECT @Age = 30; 

    PRINT 'Employee: ' + @EmployeeName + ', Age: ' + CAST(@Age AS VARCHAR);
END;

- SET is ANSI standard and is meant only for variable assignment.
- SELECT is more flexible: it can assign values from queries, and even multiple variables at once

>> Note : 

When you write SELECT @Age = 30;, SQL Server interprets it as: “Assign the constant value 30 to the variable @Age.”
This is equivalent to SET @Age = 30; — both will store 30 in the variable.

## Conditional Statements 

SQL Server uses IF...ELSE for logic

>> Basic Syntax

IF condition
    BEGIN
        -- statements if condition is true
    END
ELSE
    BEGIN
        -- statements if condition is false
    END

>> Example 1: With Queries

DECLARE @DeptID INT = 5;

IF EXISTS (SELECT 1 FROM Employees WHERE DepartmentID = @DeptID)
    BEGIN
        PRINT 'Department has employees';
    END
ELSE
    BEGIN
        PRINT 'No employees in this department';
    END

>> Example 2 : Nested IF…ELSE

DECLARE @Score INT = 75;

IF @Score >= 90
    PRINT 'Grade A';
ELSE IF @Score >= 75
    PRINT 'Grade B';
ELSE IF @Score >= 50
    PRINT 'Grade C';
ELSE
    PRINT 'Fail';

