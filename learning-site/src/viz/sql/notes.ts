/**
 * SQL and sample data copied from the SQL Server notes, verbatim.
 *
 * Every string in `SQL` is shown in a code panel. `verbatim.ts` turns each one into a VerbatimCheck, so the
 * build fails if the note changes and a visualizer would show stale SQL. The sample rows below are the
 * notes' own INSERT values; `tests/unit/sql/notes-data.test.ts` re-reads the notes and checks them.
 */

export const NOTE = {
  joins: 'Phase2-ASP.NetAndBackend/SQLTutorial/4.SQL_JoinsNMore.md',
  subqueries: 'Phase2-ASP.NetAndBackend/SQLTutorial/5.SQL_Subqueries.md',
  indexes: 'Phase2-ASP.NetAndBackend/SQLTutorial/6.SQL_IndexNKeys.md',
  plans: 'Phase2-ASP.NetAndBackend/SQLTutorial/7.SQL_ExecutionPlanNMore.md',
  window: 'Phase2-ASP.NetAndBackend/SQLTutorial/8.SQL_WindowsfunctionsNMore.md',
  cte: 'Phase2-ASP.NetAndBackend/SQLTutorial/9.SQL_CTE.md',
  tx: 'Phase2-ASP.NetAndBackend/SQLTutorial/10.SQL_Transactions&Concurrency.md',
} as const;

export interface NoteSql {
  file: string;
  heading: string;
  code: string;
}

const sql = (file: string, heading: string, code: string): NoteSql => ({ file, heading, code });

export const SQL = {
  // ── 4.SQL_JoinsNMore.md ────────────────────────────────────────────────────────────────
  inner: sql(NOTE.joins, '## INNER JOIN (most common)', `SELECT c.CustomerId, c.Name, o.OrderId, o.Amount
FROM Customers c
INNER JOIN Orders o
  ON c.CustomerId = o.CustomerId;`),
  left: sql(NOTE.joins, '## LEFT (LEFT OUTER) JOIN', `SELECT c.CustomerId, c.Name, o.OrderId, o.Amount
FROM Customers c
LEFT JOIN Orders o
  ON c.CustomerId = o.CustomerId;`),
  right: sql(NOTE.joins, '## RIGHT JOIN', `SELECT c.CustomerId, c.Name, o.OrderId, o.Amount
FROM Customers c
RIGHT JOIN Orders o
  ON c.CustomerId = o.CustomerId;`),
  full: sql(NOTE.joins, '## FULL OUTER JOIN', `SELECT c.CustomerId, c.Name, o.OrderId, o.Amount
FROM Customers c
FULL OUTER JOIN Orders o
  ON c.CustomerId = o.CustomerId;`),
  cross: sql(NOTE.joins, '## CROSS JOIN (Cartesian product)', `SELECT c.Name, o.OrderId
FROM Customers c
CROSS JOIN Orders o;`),
  self: sql(NOTE.joins, '## SELF JOIN (join a table to itself)', `SELECT e.Name AS Employee, m.Name AS Manager
FROM Employees e
LEFT JOIN Employees m
  ON e.ManagerId = m.EmpId;`),
  outerApply: sql(NOTE.joins, '### OUTER APPLY', `SELECT c.CustomerId, c.Name, lo.OrderId, lo.Amount
FROM Customers c
OUTER APPLY (
  SELECT TOP(1) o.OrderId, o.Amount
  FROM Orders o
  WHERE o.CustomerId = c.CustomerId
  ORDER BY o.OrderId DESC
) lo;`),
  crossApply: sql(NOTE.joins, '### CROSS APPLY', `SELECT c.CustomerId, c.Name, lo.OrderId, lo.Amount
FROM Customers c
CROSS APPLY (
  SELECT TOP(1) o.OrderId, o.Amount
  FROM Orders o
  WHERE o.CustomerId = c.CustomerId
  ORDER BY o.OrderId DESC
) lo;`),
  antiLeft: sql(NOTE.joins, '## Anti-join (find unmatched rows)', `SELECT c.CustomerId, c.Name
FROM Customers c
LEFT JOIN Orders o ON c.CustomerId = o.CustomerId
WHERE o.OrderId IS NULL;`),
  antiNotExists: sql(NOTE.joins, '## Anti-join (find unmatched rows)', `SELECT c.CustomerId, c.Name
FROM Customers c
WHERE NOT EXISTS (
  SELECT 1 FROM Orders o WHERE o.CustomerId = c.CustomerId
);`),
  leftWhereMistake: sql(NOTE.joins, '## ❌ The Mistake', `SELECT c.Name, o.OrderId
FROM Customers c
LEFT JOIN Orders o
ON c.CustomerId = o.CustomerId
WHERE o.Amount > 60;`),
  leftOnFix: sql(NOTE.joins, '## ✅ Correct Way (Condition in ON)', `SELECT c.Name, o.OrderId
FROM Customers c
LEFT JOIN Orders o
ON c.CustomerId = o.CustomerId
   AND o.Amount > 60;`),
  distinctJoin: sql(NOTE.joins, '## Semi-join (existence check) vs INNER JOIN', `SELECT DISTINCT c.CustomerId, c.Name
FROM Customers c
INNER JOIN Orders o ON c.CustomerId = o.CustomerId;`),

  // ── 7.SQL_ExecutionPlanNMore.md (query over note 5's Customers/Orders) ──────────────────────
  groupCount: sql(NOTE.plans, '## Examples: query rewrites & fixes', `-- GOOD (set-based)
SELECT c.Id, COUNT(o.Id) AS OrderCount
FROM Customers c
LEFT JOIN Orders o ON o.CustomerId = c.Id
GROUP BY c.Id;`),

  // ── 5.SQL_Subqueries.md ─────────────────────────────────────────────────────────────────
  correlated: sql(NOTE.subqueries, '## Correlated Subquery', `SELECT *
FROM Employees e
WHERE Salary > (
    SELECT AVG(Salary)
    FROM Employees
    WHERE DepartmentId = e.DepartmentId
);`),

  // ── 9.SQL_CTE.md ────────────────────────────────────────────────────────────────────────
  recursive: sql(NOTE.cte, '# Recursive CTE (Very Important)', `WITH EmployeeHierarchy AS
(
    -- Anchor member
    SELECT Id, Name, ManagerId, 0 AS Level
    FROM Employees
    WHERE ManagerId IS NULL

    UNION ALL

    -- Recursive member
    SELECT e.Id, e.Name, e.ManagerId, Level + 1
    FROM Employees e
    JOIN EmployeeHierarchy h
        ON e.ManagerId = h.Id
)
SELECT *
FROM EmployeeHierarchy;`),

  // ── 8.SQL_WindowsfunctionsNMore.md ──────────────────────────────────────────────────────
  rowNumber: sql(NOTE.window, '## ROW_NUMBER()', `SELECT *,
       ROW_NUMBER() OVER (ORDER BY Salary DESC) AS RowNum
FROM Employees;`),
  /** As written in the note, including the comma before FROM (see CONTENT_ISSUES.md). */
  rank: sql(NOTE.window, '## RANK()', `SELECT *,
       RANK() OVER (ORDER BY Salary DESC) AS RankNum,
FROM Employees;`),
  denseRank: sql(NOTE.window, '## DENSE_RANK()', `SELECT *,
       DENSE_RANK() OVER (ORDER BY Salary DESC) AS DenseRankNum
FROM Employees;`),
  deptRank: sql(NOTE.window, '## Key Components of Window Functions', `SELECT *,
       ROW_NUMBER() OVER (
           PARTITION BY Department
           ORDER BY Salary DESC
       ) AS DeptRank
FROM Employees;`),
  runningTotal: sql(NOTE.window, '# 🔥 Advanced Test Case — Running Total with Frame', `SELECT Name, Salary,
       SUM(Salary) OVER (
           ORDER BY Salary DESC
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS RunningTotal
FROM Employees;`),

  // ── 6.SQL_IndexNKeys.md / 7.SQL_ExecutionPlanNMore.md ───────────────────────────────────
  coveringQuery: sql(NOTE.indexes, '## Covering Index', `SELECT Name, Salary
FROM Employee
WHERE Name = 'Aman';`),
  coveringIndex: sql(NOTE.indexes, '## Covering Index', `CREATE INDEX IX_Employee_Name
ON Employee(Name)
INCLUDE (Salary);`),
  seekScan: sql(NOTE.plans, '## Index Scan', `-- Good: seek (assumes index on CustomerId)
SELECT * FROM Orders WHERE CustomerId = 123;

-- Likely scan (no useful predicate)
SELECT * FROM Orders WHERE Amount > 0;`),
  customerIdIndex: sql(NOTE.plans, '## Real Example: Before Index', `CREATE INDEX IX_Orders_CustomerID
ON Orders(CustomerID);`),
  updateClusteredKey: sql(NOTE.indexes, '### Why updating a clustered key is expensive', `UPDATE Orders
SET OrderId = 5000
WHERE OrderId = 100;`),
} satisfies Record<string, NoteSql>;

export type SqlId = keyof typeof SQL;

// ── Sample data ───────────────────────────────────────────────────────────────────────────

/** 4.SQL_JoinsNMore.md › Sample data (use these for all examples). */
export interface Customer {
  CustomerId: number;
  Name: string;
}
export interface Order {
  OrderId: number;
  CustomerId: number;
  Amount: number;
}
export const CUSTOMERS: readonly Customer[] = [
  { CustomerId: 1, Name: 'Alice' },
  { CustomerId: 2, Name: 'Bob' },
  { CustomerId: 3, Name: 'Carol' },
];
/** Includes the orphan order 104 (CustomerId = 4 has no matching customer). */
export const ORDERS: readonly Order[] = [
  { OrderId: 101, CustomerId: 1, Amount: 100 },
  { OrderId: 102, CustomerId: 1, Amount: 50 },
  { OrderId: 103, CustomerId: 2, Amount: 75 },
  { OrderId: 104, CustomerId: 4, Amount: 60 },
];

/** 4.SQL_JoinsNMore.md › SELF JOIN. */
export interface SelfEmployee {
  EmpId: number;
  Name: string;
  ManagerId: number | null;
}
export const SELF_EMPLOYEES: readonly SelfEmployee[] = [
  { EmpId: 1, Name: 'John', ManagerId: null },
  { EmpId: 2, Name: 'Sarah', ManagerId: 1 },
  { EmpId: 3, Name: 'Mike', ManagerId: 1 },
  { EmpId: 4, Name: 'Anna', ManagerId: 2 },
];

/** 5.SQL_Subqueries.md › Sample Table (Employees, Departments). */
export interface DeptEmployee {
  Id: number;
  Name: string;
  Salary: number;
  DepartmentId: number;
}
export const SUBQUERY_EMPLOYEES: readonly DeptEmployee[] = [
  { Id: 1, Name: 'Aman', Salary: 60000, DepartmentId: 1 },
  { Id: 2, Name: 'Rahul', Salary: 50000, DepartmentId: 1 },
  { Id: 3, Name: 'Priya', Salary: 40000, DepartmentId: 2 },
  { Id: 4, Name: 'Neha', Salary: 45000, DepartmentId: 2 },
  { Id: 5, Name: 'Karan', Salary: 70000, DepartmentId: 3 },
];
export const DEPARTMENTS: readonly { Id: number; DeptName: string }[] = [
  { Id: 1, DeptName: 'IT' },
  { Id: 2, DeptName: 'HR' },
  { Id: 3, DeptName: 'Finance' },
];

/** 5.SQL_Subqueries.md › Commonly used commands › Sample Tables (Customers Id/Name, Orders Id/CustomerId/Amount). */
export const SUBQUERY_CUSTOMERS: readonly { Id: number; Name: string }[] = [
  { Id: 1, Name: 'Aman' },
  { Id: 2, Name: 'Rahul' },
  { Id: 3, Name: 'Priya' },
  { Id: 4, Name: 'Neha' },
];
export const SUBQUERY_ORDERS: readonly { Id: number; CustomerId: number; Amount: number }[] = [
  { Id: 1, CustomerId: 1, Amount: 1000 },
  { Id: 2, CustomerId: 1, Amount: 2000 },
  { Id: 3, CustomerId: 2, Amount: 1500 },
];

/** 8.SQL_WindowsfunctionsNMore.md › Sample Data. */
export interface WindowEmployee {
  Id: number;
  Name: string;
  Department: string;
  Salary: number;
}
export const WINDOW_EMPLOYEES: readonly WindowEmployee[] = [
  { Id: 1, Name: 'Aman', Department: 'IT', Salary: 60000 },
  { Id: 2, Name: 'Rahul', Department: 'IT', Salary: 50000 },
  { Id: 3, Name: 'Priya', Department: 'HR', Salary: 40000 },
  { Id: 4, Name: 'Neha', Department: 'HR', Salary: 45000 },
  { Id: 5, Name: 'Karan', Department: 'Finance', Salary: 70000 },
];

/** 9.SQL_CTE.md › Sample Data. */
export interface CteEmployee {
  Id: number;
  Name: string;
  Department: string;
  Salary: number;
  ManagerId: number | null;
}
export const CTE_EMPLOYEES: readonly CteEmployee[] = [
  { Id: 1, Name: 'Aman', Department: 'IT', Salary: 60000, ManagerId: null },
  { Id: 2, Name: 'Rahul', Department: 'IT', Salary: 50000, ManagerId: 1 },
  { Id: 3, Name: 'Priya', Department: 'IT', Salary: 45000, ManagerId: 1 },
  { Id: 4, Name: 'Neha', Department: 'HR', Salary: 40000, ManagerId: null },
  { Id: 5, Name: 'Riya', Department: 'HR', Salary: 42000, ManagerId: 4 },
  { Id: 6, Name: 'Karan', Department: 'Finance', Salary: 70000, ManagerId: null },
];
