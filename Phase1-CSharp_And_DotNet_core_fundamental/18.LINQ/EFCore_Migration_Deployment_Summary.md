# EF Core Database Migration Deployment Summary

## 1. Create Migration

```bash
dotnet ef migrations add AddOrdersTable
```

Commit generated migration files to source control.

------------------------------------------------------------------------

## 2. Generate Production SQL Script

```bash
dotnet ef migrations script --idempotent -o migration.sql
```

This generates an idempotent SQL script that applies only missing
migrations by checking `__EFMigrationsHistory`.

------------------------------------------------------------------------

## 3. Review the Script

Open `migration.sql` and review all:

-   CREATE TABLE
-   ALTER TABLE
-   CREATE INDEX
-   DROP COLUMN

Never deploy an unreviewed script.

------------------------------------------------------------------------

## 4. Production Deployment Flow

```text
Backup Database
        ↓
Execute migration.sql
        ↓
Verify Migration Success
        ↓
Deploy API
        ↓
Smoke Test
```

------------------------------------------------------------------------

## 5. Execute the Script

### Manual (SSMS)

Open `migration.sql` in SQL Server Management Studio and execute it.

Verify:

```sql
SELECT *
FROM __EFMigrationsHistory;
```

### Automated (CI/CD)

```powershell
Invoke-Sqlcmd `
    -ServerInstance "ProdServer" `
    -Database "MyAppDb" `
    -InputFile "migration.sql"
```

------------------------------------------------------------------------

## 6. Best Practices

### Do

-   Keep migrations in source control.
-   Generate SQL scripts for releases.
-   Backup the database before migration.
-   Test in Staging first.
-   Deploy database changes before API deployment.
-   Use idempotent scripts.

### Don't

```csharp
db.Database.Migrate();
```

at application startup in production.

Reasons:

-   Multiple app instances may run migrations simultaneously.
-   Slower startup.
-   Requires elevated DB permissions.
-   Harder to audit and control.

------------------------------------------------------------------------

## 7. Useful Commands

### Create Migration

```bash
dotnet ef migrations add MigrationName
```

### List Migrations

```bash
dotnet ef migrations list
```

### Remove Last Migration

```bash
dotnet ef migrations remove
```

### Generate Script

```bash
dotnet ef migrations script --idempotent -o migration.sql
```

### Update Local Database

```bash
dotnet ef database update
```

(Local development only)

------------------------------------------------------------------------

## 8. Clean Architecture Example

```bash
dotnet ef migrations add AddOrders \
    --project Infrastructure \
    --startup-project Api
```

Generate script:

```bash
dotnet ef migrations script \
    --project Infrastructure \
    --startup-project Api \
    --idempotent \
    -o migration.sql
```

------------------------------------------------------------------------

## Production Workflow

```text
Entity Change
      ↓
Add Migration
      ↓
Commit Migration Files
      ↓
Generate migration.sql
      ↓
Test in Staging
      ↓
Backup Production DB
      ↓
Run migration.sql
      ↓
Deploy API
      ↓
Verify Application
```
