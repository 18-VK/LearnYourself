
# SQL Server ALTER Command – Complete Guide

## 📌 What is ALTER?

The `ALTER` command is used to modify existing database objects without recreating them.

It can modify:

- Tables
- Columns
- Constraints
- Indexes
- Views
- Stored Procedures
- Functions
- Database properties

---

# 1️⃣ ALTER TABLE

## ➤ Add Column

```sql
ALTER TABLE Students
ADD Email NVARCHAR(100);
```

---

## ➤ Add Multiple Columns

```sql
ALTER TABLE Students
ADD Phone NVARCHAR(15),
    DateOfBirth DATE;
```

---

## ➤ Modify Column (Change Data Type)

```sql
ALTER TABLE Students
ALTER COLUMN StudentName NVARCHAR(200);
```

⚠ Cannot shrink size if data truncation occurs.

---

## ➤ Change NULL to NOT NULL

```sql
ALTER TABLE Students
ALTER COLUMN Email NVARCHAR(100) NOT NULL;
```

⚠ Column must not contain NULL values.

---

## ➤ Add DEFAULT Constraint

```sql
ALTER TABLE Students
ADD CONSTRAINT DF_Email
DEFAULT 'Not Provided' FOR Email;
```

---

## ➤ Add PRIMARY KEY

```sql
ALTER TABLE Students
ADD CONSTRAINT PK_Students
PRIMARY KEY (StudentId);
```

---

## ➤ Add FOREIGN KEY

```sql
ALTER TABLE Students
ADD CONSTRAINT FK_Students_Department
FOREIGN KEY (DepartmentId)
REFERENCES Departments(DepartmentId);
```

---

## ➤ Add UNIQUE Constraint

```sql
ALTER TABLE Students
ADD CONSTRAINT UQ_Email UNIQUE (Email);
```

---

## ➤ Add CHECK Constraint

```sql
ALTER TABLE Enrollments
ADD CONSTRAINT CHK_Grade
CHECK (Grade IN ('A','B','C','D','F'));
```

---

## ➤ Drop Column

```sql
ALTER TABLE Students
DROP COLUMN Phone;
```

---

## ➤ Drop Constraint

```sql
ALTER TABLE Students
DROP CONSTRAINT UQ_Email;
```

---

## ➤ Rename Column

```sql
EXEC sp_rename 'Students.Email', 'StudentEmail', 'COLUMN';
```

---

## ➤ Rename Table

```sql
EXEC sp_rename 'Students', 'UniversityStudents';
```

---

## ➤ Disable Constraint

```sql
ALTER TABLE Students
NOCHECK CONSTRAINT FK_Students_Department;
```

---

## ➤ Enable Constraint

```sql
ALTER TABLE Students
CHECK CONSTRAINT FK_Students_Department;
```

---

# 2️⃣ ALTER DATABASE

## ➤ Rename Database

```sql
ALTER DATABASE UniversityDB
MODIFY NAME = CollegeDB;
```

---

## ➤ Set Database to Read-Only

```sql
ALTER DATABASE CollegeDB
SET READ_ONLY;
```

---

## ➤ Set Database Back to Read-Write

```sql
ALTER DATABASE CollegeDB
SET READ_WRITE;
```

---

# 3️⃣ ALTER INDEX

## ➤ Rebuild Index

```sql
ALTER INDEX ALL ON Students
REBUILD;
```

---

## ➤ Disable Index

```sql
ALTER INDEX IX_StudentName ON Students
DISABLE;
```

---

# 4️⃣ ALTER VIEW

```sql
ALTER VIEW vw_StudentDetails
AS
SELECT s.StudentName, d.DepartmentName
FROM Students s
JOIN Departments d
ON s.DepartmentId = d.DepartmentId;
```

---

# 5️⃣ ALTER PROCEDURE

```sql
ALTER PROCEDURE GetStudents
AS
BEGIN
    SELECT * FROM Students;
END;
```

---

# 6️⃣ ALTER FUNCTION

```sql
ALTER FUNCTION dbo.GetStudentCount()
RETURNS INT
AS
BEGIN
    RETURN (SELECT COUNT(*) FROM Students);
END;
```

---

# 🚨 Important Notes

- Cannot modify column if used in index/constraint.
- Cannot drop PK if referenced by FK.
- Cannot make column NOT NULL if NULL data exists.
- Cannot directly add IDENTITY to existing column.

---

# 🎯 Interview Summary

> ALTER modifies existing database objects such as tables, columns, constraints, indexes, views, procedures, and databases without dropping and recreating them.

---

# 🔥 Real-World Usage

| Scenario | ALTER Usage |
|-----------|-------------|
| Add new column | ADD |
| Modify datatype | ALTER COLUMN |
| Add relationship | ADD FOREIGN KEY |
| Enforce business rule | ADD CHECK |
| Improve performance | ALTER INDEX |

---

✅ End of File
