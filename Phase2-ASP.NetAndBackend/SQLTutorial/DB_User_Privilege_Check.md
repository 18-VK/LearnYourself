# Database User Privilege Check, Permissions, and Roles

## 1. What is a database user?

A database user is an identity inside a specific database. It is usually mapped to a server login.

```text
Server Login
     ↓
Database User
     ↓
Permissions on database objects
```

A login authenticates at the SQL Server instance level, while the user authorizes access inside a specific database.

---

## 2. Why check user privileges?

You need to check privileges to answer questions like:

- Can this user read data?
- Can this user insert/update/delete records?
- Can this user create tables or views?
- Can this user manage security roles?
- Does this user have too much access?

This is important for:

- security review
- troubleshooting access issues
- interview questions
- production support

---

## 3. Common privilege checks

### A. Check current login and user

```sql
SELECT
    SUSER_SNAME() AS LoginName,
    USER_NAME() AS DatabaseUser,
    DB_NAME() AS DatabaseName;
```

### B. Check permissions of the current user

```sql
SELECT *
FROM fn_my_permissions(NULL, 'DATABASE');
```

This shows permissions like:

- CONNECT
- SELECT
- INSERT
- UPDATE
- DELETE
- CREATE TABLE
- VIEW DEFINITION

### C. Check permissions on a specific object

```sql
SELECT *
FROM fn_my_permissions('dbo.Customers', 'OBJECT');
```

### D. Check if a user has permission on a table

```sql
SELECT HAS_PERMS_BY_NAME('dbo.Customers', 'OBJECT', 'SELECT');
```

Returns:

- `1` = permission exists
- `0` = permission does not exist

### E. Check all database permissions for users

```sql
SELECT
    dp.name AS UserName,
    dp.type_desc AS UserType,
    pe.permission_name,
    pe.state_desc,
    pe.class_desc
FROM sys.database_permissions pe
JOIN sys.database_principals dp
    ON pe.grantee_principal_id = dp.principal_id;
```

### F. Check permissions assigned by role membership

```sql
SELECT
    dp.name AS UserName,
    dpr.name AS RoleName,
    dpr.type_desc AS RoleType
FROM sys.database_role_members drm
JOIN sys.database_principals dp
    ON drm.member_principal_id = dp.principal_id
JOIN sys.database_principals dpr
    ON drm.role_principal_id = dpr.principal_id;
```

---

## 4. Granting database privileges

### Grant SELECT on a table

```sql
GRANT SELECT ON dbo.Customers TO AppUser;
```

### Grant INSERT, UPDATE, DELETE

```sql
GRANT INSERT, UPDATE, DELETE ON dbo.Customers TO AppUser;
```

### Grant permissions on all objects in a schema

```sql
GRANT SELECT, INSERT ON SCHEMA::Sales TO AppUser;
```

### Grant CREATE TABLE permission

```sql
GRANT CREATE TABLE TO AppUser;
```

### Revoke privilege

```sql
REVOKE SELECT ON dbo.Customers FROM AppUser;
```

### Deny privilege

```sql
DENY SELECT ON dbo.Customers TO AppUser;
```

> `DENY` is stronger than `REVOKE` and blocks access even if another role grants it.

---

## 5. Common database roles in SQL Server

Database roles are containers of permissions. Instead of granting each permission one by one, you assign a role.

### 1. `db_owner`

- Full control of the database
- Can create/drop objects
- Can manage security settings
- Can do most database administration tasks

Use for:

- database administrators
- developers in controlled environments

### 2. `db_datareader`

- Can read data from all user tables
- Cannot insert, update, or delete data

```sql
ALTER ROLE db_datareader ADD MEMBER AppUser;
```

### 3. `db_datawriter`

- Can insert, update, and delete data in user tables
- Cannot usually create/drop tables

```sql
ALTER ROLE db_datawriter ADD MEMBER AppUser;
```

### 4. `db_ddladmin`

- Can run DDL commands like create/drop tables, views, procedures, indexes

```sql
ALTER ROLE db_ddladmin ADD MEMBER AppUser;
```

### 5. `db_securityadmin`

- Can manage permissions and roles
- Can grant/revoke access to database users and roles

### 6. `db_accessadmin`

- Can add/remove users from a database
- Helps with user management

### 7. `db_backupoperator`

- Can back up the database

### 8. `db_backupoperator` / `db_monitor` / etc.

These are utility roles used for maintenance and monitoring responsibilities.

### 9. `public`

- Default role for every user
- Contains basic permissions
- You should not rely on it for security design

> `public` is not a real user role; it is a built-in role that every database user belongs to.

---

## 6. Server roles in SQL Server

Server roles apply at the SQL Server instance level.

### 1. `sysadmin`

- Highest-level server role
- Full access to all databases and server-level resources
- Can do everything

Use with caution:

- not for application users
- only for trusted administrators

### 2. `serveradmin`

- Can configure server-wide settings
- Can shut down the server

### 3. `securityadmin`

- Can manage server logins and permissions
- Important for security administration

### 4. `processadmin`

- Manages SQL Server processes

### 5. `setupadmin`

- Can add and remove linked servers and setup tasks

### 6. `dbcreator`

- Can create, alter, or drop databases

### 7. `diskadmin`

- Manages disk files

### 8. `bulkadmin`

- Can run bulk insert operations

---

## 7. Example: assign a user a role

### Create login

```sql
CREATE LOGIN AppLogin WITH PASSWORD = 'StrongPass@123';
```

### Create user inside database

```sql
USE MyDB;
CREATE USER AppUser FOR LOGIN AppLogin;
```

### Add user to a database role

```sql
ALTER ROLE db_datareader ADD MEMBER AppUser;
```

### Add user to another role

```sql
ALTER ROLE db_datawriter ADD MEMBER AppUser;
```

This gives the user:

- read permission from tables
- insert/update/delete permission on tables

---

## 8. Example: check if user has the right role

```sql
SELECT
    dp.name AS UserName,
    dpr.name AS RoleName
FROM sys.database_role_members drm
JOIN sys.database_principals dp
    ON drm.member_principal_id = dp.principal_id
JOIN sys.database_principals dpr
    ON drm.role_principal_id = dpr.principal_id
WHERE dp.name = 'AppUser';
```

---

## 9. Best practices for permissions

- Grant minimum required permissions
- Prefer roles over direct user grants
- Use schema-level security when possible
- Avoid giving `db_owner` to application users
- Use `DENY` carefully
- Review permissions regularly

---

## 10. Quick summary

### If you want a user to only read data:

```sql
ALTER ROLE db_datareader ADD MEMBER AppUser;
```

### If you want a user to read and write data:

```sql
ALTER ROLE db_datareader ADD MEMBER AppUser;
ALTER ROLE db_datawriter ADD MEMBER AppUser;
```

### If you want a user to manage tables:

```sql
ALTER ROLE db_ddladmin ADD MEMBER AppUser;
```

### If you want a user to manage all database tasks:

```sql
ALTER ROLE db_owner ADD MEMBER AppUser;
```

> `db_owner` is powerful and should be used carefully.

---

## 11. Interview-friendly explanation

A database user gets access through permissions and roles. Roles are groups of permissions that simplify security management.

- `db_datareader` = read-only user
- `db_datawriter` = write data
- `db_ddladmin` = create/alter/drop database objects
- `db_owner` = full database control
- `sysadmin` = full server control

This is the standard pattern used in SQL Server security design.

---

## 12. Practical checklist

Before giving access to a user, ask:

- What does the user need to do?
- Should they only read data?
- Should they create tables?
- Should they manage security?
- Do they need server-level or database-level rights?
- Are we using a role instead of direct object permission?

If the answer is clear, then assign the least privileged role that fits the requirement.

---

## 13. Final takeaway

The safest and most professional approach is:

1. create a login
2. map it to a database user
3. assign the correct database role
4. grant object-level permissions only if needed
5. avoid excessive privileges

This follows the principle of least privilege.
