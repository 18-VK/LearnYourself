# EF Core Migrations and Database Commands

A practical command reference with examples for a Clean Architecture solution (Api / Application / Infrastructure).

---

## Table of contents

- [0. Setup (once)](#0-setup-once)
- [1. Why `--project` and `--startup-project`](#1-why---project-and---startup-project)
- [2. Migration commands](#2-migration-commands)
- [3. Database commands](#3-database-commands)
- [4. Generating SQL scripts](#4-generating-sql-scripts)
- [5. Migration bundle (recommended for CI/CD)](#5-migration-bundle-recommended-for-cicd)
- [6. DbContext commands](#6-dbcontext-commands)
- [7. Useful options on most commands](#7-useful-options-on-most-commands)
- [8. Package Manager Console equivalents (Visual Studio)](#8-package-manager-console-equivalents-visual-studio)
- [9. Editing migrations by hand](#9-editing-migrations-by-hand)
- [10. Common problems and fixes](#10-common-problems-and-fixes)
- [11. Deploying migrations manually to production (no CI/CD)](#11-deploying-migrations-manually-to-production-no-cicd)
- [12. Rules of thumb](#12-rules-of-thumb)
- [Quick cheat sheet](#quick-cheat-sheet)

---

## 0. Setup (once)

```bash
# Install or update the CLI tool
dotnet tool install --global dotnet-ef
dotnet tool update  --global dotnet-ef
dotnet ef --version
```

The **startup project** (your Api) needs the design-time package:

```bash
dotnet add src/Api package Microsoft.EntityFrameworkCore.Design
```

Because the DbContext is in Infrastructure and the app starts from Api, almost every command needs both flags:

```bash
--project src/Infrastructure      # where the DbContext and migrations live
--startup-project src/Api         # where configuration and DI are built
```

To avoid repeating them, run commands from the solution root and use a shell variable:

```bash
EF="--project src/Infrastructure --startup-project src/Api"
dotnet ef migrations list $EF
```

All examples below use `$EF` for these two flags.

---

## 1. Why `--project` and `--startup-project`

The EF tools need two pieces of information that live in different projects, and the CLI can't guess which is which.

### What each flag does

| Flag | Role | What EF uses it for |
|---|---|---|
| `--project` | **Target project**: where EF *writes* files and *finds* the model | Locates `AppDbContext` and the `Migrations` folder; new migration files are created here |
| `--startup-project` | **Startup project**: what EF *runs* to build the app | Builds your host (`Program.cs`), reads `appsettings.json`, user-secrets and environment variables, and runs your DI setup |

### Why they differ in Clean Architecture

```
src/
  Api/              <- Program.cs, appsettings.json, connection string, AddInfrastructure(...)
  Application/
  Infrastructure/   <- AppDbContext, entity configurations, Migrations/
```

- The `DbContext` and migrations live in **Infrastructure**, so EF must write migration files there.
- Infrastructure is a class library. It has no `Program.cs`, no `appsettings.json` and no entry point, so it can't be *executed*.
- To create an `AppDbContext`, EF needs its `DbContextOptions` (provider, connection string, interceptors). Those are configured by `AddInfrastructure(...)` and the configuration files in **Api**.

So EF does this:

1. Builds and starts the host from `--startup-project` (Api) to get the configured services and connection string.
2. Resolves `AppDbContext` from that container.
3. Reads the model and writes migration files into `--project` (Infrastructure).

### What happens if you leave them out

| Missing | Result |
|---|---|
| `--startup-project` | EF tries to use Infrastructure as the startup project and fails: *"Unable to create a DbContext"* or *"Startup project doesn't reference Microsoft.EntityFrameworkCore.Design"*, because there is no host or config to run |
| `--project` | If you run from the solution root, EF can't tell which project holds the migrations, and it fails or targets the wrong one |
| Neither, with the current directory set to `src/Api` | EF uses Api for both. Migrations then get generated inside Api, in the wrong layer |

### When you can skip them

If everything is in one project (a single Web API with the DbContext inside it), the current directory is both the target and the startup project, so plain `dotnet ef migrations add Name` works with no flags. Running the commands from inside `src/Infrastructure` while passing only `--startup-project ../Api` also works, because `--project` defaults to the current directory.

### Alternatives to typing them every time

- Use a shell variable: `EF="--project src/Infrastructure --startup-project src/Api"`.
- In Visual Studio's Package Manager Console, the **Default project** dropdown is `--project` and Solution Explorer's **Startup Project** is `--startup-project`.
- If the CLI can't build your host at all (for example, it needs services unavailable at design time), an `IDesignTimeDbContextFactory<AppDbContext>` in Infrastructure lets EF create the context without running the Api project (see section 10).

---

## 2. Migration commands

### Add a migration

```bash
dotnet ef migrations add InitialCreate $EF --output-dir Persistence/Migrations
dotnet ef migrations add AddOrderDescription $EF
```

EF compares your current model with the last migration's snapshot (`AppDbContextModelSnapshot.cs`) and generates a new migration class with `Up` (apply) and `Down` (revert).

**Example:** you add `public string? Description { get; set; }` to `Order`. The generated file:

```csharp
public partial class AddOrderDescription : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Description",
            table: "Orders",
            type: "nvarchar(max)",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "Description", table: "Orders");
    }
}
```

### List migrations

```bash
dotnet ef migrations list $EF
dotnet ef migrations list $EF --connection "<connection-string>"   # shows which are applied to that database
```

### Remove the last migration

```bash
dotnet ef migrations remove $EF            # only if it has NOT been applied
dotnet ef migrations remove $EF --force    # also reverts it in the database if applied (dev only)
```

Use this when you realize the model change is wrong before you commit. **Never remove a migration that has been applied to a shared or production database.** Add a new migration that fixes it instead.

### Check for pending model changes (EF 8+, useful in CI)

```bash
dotnet ef migrations has-pending-model-changes $EF
```

Exits with an error if the model differs from the latest migration, so it catches "developer changed an entity but forgot to add a migration."

---

## 3. Database commands

### Apply migrations

```bash
dotnet ef database update $EF                              # apply everything pending
dotnet ef database update AddOrderDescription $EF          # apply up to this migration
dotnet ef database update $EF --connection "Server=...;Database=App;..."   # target a specific database
```

EF records applied migrations in the `__EFMigrationsHistory` table, so only pending ones run.

### Roll back (revert)

```bash
dotnet ef database update InitialCreate $EF   # run Down() of every migration after InitialCreate
dotnet ef database update 0 $EF               # revert ALL migrations (empty schema)
```

Rolling back runs each `Down` method, so columns dropped by `Down` lose their data. After reverting, use `migrations remove` if you also want to delete the files.

### Drop the database

```bash
dotnet ef database drop $EF --dry-run   # shows which database WOULD be dropped, changes nothing
dotnet ef database drop $EF             # shows the database name and asks for confirmation (y/N)
dotnet ef database drop $EF --force     # no prompt, drops immediately (local/dev only)
```

#### What it does

- Drops the **entire database** that your DbContext's connection string points to, not just the EF tables. Anything else in it (tables you created manually, stored procedures, data) goes too.
- It doesn't need migrations to have been applied, and it doesn't touch your migration files. Those stay in the project.
- It typically disconnects other open connections first, so it can drop a database that is in use.
- Afterwards, `dotnet ef database update $EF` recreates the database and applies all migrations from scratch.

#### Which database it targets

The connection string comes from the **startup project's** configuration (Api): `appsettings.json`, user-secrets and environment variables. To avoid dropping the wrong one:

1. Run `--dry-run` first and read the database and server name.
2. Check the environment: `dotnet ef database drop $EF --dry-run -- --environment Development`.
3. Check that no `ConnectionStrings__Default` environment variable in your shell points to a shared or production server.

#### When to use it

| | |
|---|---|
| **Fine** | Local development, throwaway test databases, resetting after a messy migration history |
| **Never** | Staging or production. Use a corrective migration instead, and keep `--force` out of any pipeline that has production credentials |

#### Equivalents

| Where | Command |
|---|---|
| Package Manager Console | `Drop-Database` (add `-WhatIf` for a dry run) |
| In code (for example, integration tests) | `await db.Database.EnsureDeletedAsync(ct);` then `await db.Database.MigrateAsync(ct);` |

### A typical dev reset

```bash
dotnet ef database drop $EF --force
dotnet ef database update $EF
```

---

## 4. Generating SQL scripts

```bash
# Everything, from empty database to latest
dotnet ef migrations script $EF -o migrate.sql

# Idempotent: safe to run repeatedly, each step is guarded by a history check
dotnet ef migrations script $EF --idempotent -o migrate.sql

# Only a range: from migration A (exclusive) to migration B
dotnet ef migrations script InitialCreate AddOrderDescription $EF -o upgrade.sql

# From "nothing" to a specific migration
dotnet ef migrations script 0 InitialCreate $EF -o initial.sql
```

An idempotent script is what you hand to a DBA or run in a release pipeline, because it works regardless of what state the target database is in.

---

## 5. Migration bundle (recommended for CI/CD)

```bash
dotnet ef migrations bundle $EF --self-contained -r linux-x64 -o efbundle --force

# Run it on the target
./efbundle --connection "$CONNECTION_STRING"
./efbundle --connection "$CONNECTION_STRING" AddOrderDescription   # up to a specific migration
```

A bundle is a single executable containing all migrations. It needs no .NET SDK or source code on the deploy agent, runs with a dedicated privileged connection string, and fails the pipeline step if the migration fails. Prefer this over `Database.Migrate()` at app startup, which races across multiple instances and gives the app too many database privileges.

**GitHub Actions step example**

```yaml
- name: Build migration bundle
  run: |
    dotnet tool install --global dotnet-ef
    dotnet ef migrations bundle --project src/Infrastructure --startup-project src/Api \
      --self-contained -r linux-x64 -o efbundle

- name: Apply migrations
  run: ./efbundle --connection "${{ secrets.DB_CONNECTION_STRING }}"
```

---

## 6. DbContext commands

```bash
dotnet ef dbcontext list $EF                  # list all DbContext classes found
dotnet ef dbcontext info $EF                  # provider, database name, data source
dotnet ef dbcontext script $EF -o schema.sql  # SQL for the whole model, ignoring migrations
dotnet ef dbcontext optimize $EF              # generate compiled model (faster startup for big models)
```

If you have more than one context, add `--context AppDbContext` to every command.

### Reverse engineering: scaffold from an existing database (database-first)

```bash
dotnet ef dbcontext scaffold "Server=.;Database=Legacy;Trusted_Connection=True;TrustServerCertificate=True" \
  Microsoft.EntityFrameworkCore.SqlServer \
  --project src/Infrastructure --startup-project src/Api \
  --output-dir Entities --context-dir Persistence --context LegacyDbContext \
  --data-annotations --table Orders --table Customers --force
```

- `--table` / `--schema` limit what is generated.
- `--data-annotations` uses attributes instead of fluent config where possible.
- `--force` overwrites existing files.
- Use `--no-onconfiguring` so the connection string is not hardcoded into the generated context.

---

## 7. Useful options on most commands

| Option | Purpose |
|---|---|
| `--project <path>` | Target project: where the DbContext and migrations live |
| `--startup-project <path>` | Startup project: builds the host and reads configuration |
| `--context <name>` | Choose the DbContext when there are several |
| `--output-dir <path>` | Folder for new migration files (`migrations add`) |
| `--connection <string>` | Override the connection string (`database update`, `migrations list`, bundle) |
| `--configuration Release` | Build configuration |
| `--no-build` | Skip building if you already built (faster in CI) |
| `--verbose` | Show detailed logs; first thing to try when a command fails |
| `-- --environment Production` | Pass arguments to the app; the `--` is required. This picks the environment's `appsettings` |

Example: `dotnet ef database update $EF -- --environment Staging`

---

## 8. Package Manager Console equivalents (Visual Studio)

| CLI | PMC |
|---|---|
| `migrations add Name` | `Add-Migration Name` |
| `migrations remove` | `Remove-Migration` |
| `migrations list` | `Get-Migration` |
| `database update` | `Update-Database` |
| `database update Name` | `Update-Database Name` |
| `migrations script --idempotent` | `Script-Migration -Idempotent` |
| `database drop` | `Drop-Database` |
| `dbcontext scaffold ...` | `Scaffold-DbContext ...` |

In PMC, set the **Default project** dropdown to Infrastructure and the Startup Project to Api in Solution Explorer.

---

## 9. Editing migrations by hand

Migrations are code, so you can and sometimes must edit them before applying.

**Custom SQL / data fix**

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<string>("Status", "Orders", nullable: false, defaultValue: "Pending");
    migrationBuilder.Sql("UPDATE Orders SET Status = 'Completed' WHERE PaidAt IS NOT NULL");
}
```

**Rename instead of drop + add.** If you rename a property, EF often can't tell and generates `DropColumn` + `AddColumn`, which **loses the data**. Replace them with:

```csharp
migrationBuilder.RenameColumn(name: "Total", table: "Orders", newName: "GrandTotal");
```

Always read the generated `Up` method before applying, especially for renames, type changes and `NOT NULL` additions, and watch for EF's warning: *"An operation was scaffolded that may result in the loss of data."*

---

## 10. Common problems and fixes

| Problem | Cause / fix |
|---|---|
| *"Unable to create a DbContext... at design time"* | The CLI can't build the host or find the connection string. Check `--startup-project`, or add an `IDesignTimeDbContextFactory<AppDbContext>` (below) |
| *"Your startup project doesn't reference Microsoft.EntityFrameworkCore.Design"* | Add the package to the startup project |
| *"There is already an object named 'X' in the database"* | Database has tables but no migration history. Baseline by generating an initial migration and marking it applied, or drop and recreate in dev |
| *"Pending model changes"* at runtime (EF 9+) | You changed the model without adding a migration. Run `migrations add` |
| Merge conflicts in `...ModelSnapshot.cs` | Two branches added migrations. Remove your migration, merge, then re-add it so the snapshot is regenerated |
| Migration applied but wrong | In dev: `database update <previous>` then `migrations remove`. In prod: add a new corrective migration |

**Design-time factory (for when the CLI can't build your host)**

```csharp
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var cs = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
                 ?? "Server=localhost;Database=App_Dev;Trusted_Connection=True;TrustServerCertificate=True";

        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(cs).Options;
        return new AppDbContext(options);
    }
}
```

---

## 11. Deploying migrations manually to production (no CI/CD)

The safest manual approach is to **generate an SQL script, review it, and run it against production yourself**. A migration bundle is the second-best option. Avoid running `dotnet ef database update` from your laptop or calling `Database.Migrate()` at startup.

### Option A: Idempotent SQL script (recommended)

**1. Find what production already has**

```sql
SELECT TOP 5 MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId DESC;
```

**2. Generate the script from the exact commit you are deploying**

```bash
EF="--project src/Infrastructure --startup-project src/Api"

# Safest: idempotent, skips anything already applied
dotnet ef migrations script --idempotent $EF -o migrate.sql

# Smaller: only what's new, from the last migration prod has
dotnet ef migrations script <LastAppliedMigration> $EF -o upgrade.sql
```

An idempotent script wraps each migration in an `IF NOT EXISTS (SELECT ... FROM __EFMigrationsHistory ...)` check, so running it twice does no harm.

**3. Review it.** Read the SQL, and look hard for `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN` (type or length changes), and new `NOT NULL` columns without defaults on large tables. These can lose data, fail on existing rows, or lock a big table.

**4. Run it against production**

- SSMS or Azure Data Studio: open `migrate.sql`, connect to the prod database, run it.
- Command line: `sqlcmd -S <server> -d <db> -U <migration-user> -i migrate.sql -b` (`-b` stops on the first error).

### Option B: Migration bundle

Use it if you want one executable instead of a script:

```bash
# On your build machine; use win-x64 for a Windows server, linux-x64 for Linux
dotnet ef migrations bundle $EF --self-contained -r linux-x64 -o efbundle --force

# Copy efbundle to the server (or a machine that can reach the prod DB), then:
./efbundle --connection "Server=...;Database=App;User Id=migrator;Password=...;Encrypt=True"
```

It needs no SDK or source on the target. The downside versus a script is that you can't read what it will run, so generate and review the script anyway.

### Why not the alternatives

| Approach | Problem |
|---|---|
| `dotnet ef database update --connection "<prod>"` from your laptop | Needs the SDK and exact source version, exposes prod to your machine, and a wrong branch or config silently applies the wrong migrations |
| `Database.Migrate()` at app startup | Races if more than one instance starts, and the app login needs schema-change rights |

### Step-by-step deployment procedure

1. **Back up** the production database (full backup or snapshot) and confirm you can restore it.
2. **Rehearse on a copy**: restore that backup to a test server, run the script, and start the new app against it.
3. **Pick the order** based on the migration type:
   - *Backward-compatible* (adds a nullable column, new table, new index): run the script first, then deploy the new app. The old app keeps working in between.
   - *Breaking* (rename, drop, new required column): take a short maintenance window, stop the app, run the script, deploy the new version, start it.
4. **Run the script** with a dedicated migration login that has DDL rights. The app's own login should have only read/write.
5. **Verify**: re-run the history query to see the new `MigrationId`, hit your health endpoint, and do a quick smoke test.
6. Keep the script in source control or a release folder together with the version it belongs to.

### Rollback plan

- **Real rollback is the backup.** Restore it if data was changed or lost.
- **Revert script**, for structure-only changes: generate it with the range reversed (from the newer migration to the older one), review it, and run it:

```bash
dotnet ef migrations script <NewMigration> <PreviousMigration> $EF -o rollback.sql
```

Generate and review this **before** the deployment, so you aren't writing it under pressure. Note that reverting `Down` methods that drop columns can't bring back the data in them.

### Tips for safer manual deployments

- Make migrations **backward compatible** (expand, deploy, contract) so the old app version keeps working if you must roll back the app.
- For big tables, schedule heavy operations (index builds, column type changes) off-peak, and consider `migrationBuilder.Sql(...)` with online options where your SQL Server edition supports them.
- Don't hand-edit a script that's already been applied somewhere; if it's wrong, add a new corrective migration.

### Pre-deployment checklist

- [ ] Backup taken and restore verified
- [ ] Script generated from the exact commit being deployed
- [ ] `__EFMigrationsHistory` on prod checked, so you know the starting point
- [ ] Script reviewed for drops, type changes and `NOT NULL` additions
- [ ] Script rehearsed on a restored copy
- [ ] Rollback script generated and reviewed
- [ ] Maintenance window agreed (only if the change is breaking)
- [ ] Dedicated migration login used, not the app's login

---

## 12. Rules of thumb

- **One migration per logical change**, with a descriptive name (`AddOrderDescription`, not `Update1`).
- **Commit migration files and the snapshot** to source control.
- **Never edit or delete a migration that has been applied** to a shared database; add a new one.
- **Review the generated code and SQL** (`migrations script`) before production.
- **Production:** bundle or idempotent script from the pipeline, not `Database.Migrate()` at startup and not `database update` from a developer laptop.
- **Make changes backward compatible** (expand, deploy, then contract) when old and new app versions run side by side during a rolling deploy: add the new column as nullable first, deploy, backfill, then enforce `NOT NULL` in a later migration.

---

## Quick cheat sheet

```bash
EF="--project src/Infrastructure --startup-project src/Api"

dotnet ef migrations add <Name> $EF                       # create migration
dotnet ef migrations remove $EF                           # delete last (unapplied) migration
dotnet ef migrations list $EF                             # list migrations
dotnet ef migrations has-pending-model-changes $EF        # CI check
dotnet ef migrations script --idempotent $EF -o m.sql     # SQL script for DBA / release
dotnet ef migrations bundle $EF --self-contained -r linux-x64 -o efbundle   # CI/CD bundle

dotnet ef database update $EF                             # apply all pending
dotnet ef database update <Name> $EF                      # apply / roll back to a migration
dotnet ef database update 0 $EF                           # revert everything
dotnet ef database drop $EF --dry-run                     # show which database would be dropped
dotnet ef database drop $EF --force                       # drop database (dev only)

dotnet ef dbcontext info $EF                              # provider and database info
dotnet ef dbcontext scaffold "<cs>" Microsoft.EntityFrameworkCore.SqlServer $EF   # database-first
```
