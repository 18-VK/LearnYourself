# Task Management API - Auth Server Module

Drop-in auth module for the Task Management API, built RS256/JWT + rotating refresh tokens,
following the same Clean Architecture layering as the rest of the project (Domain / Application /
Infrastructure / Api).

## 1. Generate the RSA signing key pair

Run once per environment (dev keys should NOT be reused in production):

```bash
openssl genrsa -out jwt_private.pem 2048
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
```

Store `jwt_private.pem` somewhere only the auth server process can read (e.g. a mounted secret,
Azure Key Vault, AWS Secrets Manager). The public key can be distributed more freely to any
resource server that needs to validate tokens.

## 2. appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.;Database=TaskManagementDb;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Issuer": "https://api.taskmanagement.yourcompany.com",
    "Audience": "https://api.taskmanagement.yourcompany.com",
    "AccessTokenExpiryMinutes": 15,
    "RefreshTokenExpiryDays": 14,
    "PrivateKeyPath": "/run/secrets/jwt_private.pem",
    "PublicKeyPath": "/run/secrets/jwt_public.pem"
  }
}
```

In local dev, point the paths at files outside source control (add `*.pem` to `.gitignore`).

## 3. Wire into Program.cs

```csharp
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddAuthInfrastructure(builder.Configuration);

builder.Services.AddValidatorsFromAssembly(typeof(RegisterRequestValidator).Assembly);
builder.Services.AddControllers();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
```

`AddAuthInfrastructure` (in `Infrastructure/DependencyInjection.cs`) registers Identity, the JWT
bearer scheme, and the auth services in one call - it's an extension method so it merges cleanly
with whatever DI setup your existing Task Management project already has.

## 4. Seed roles and create the migration

```bash
dotnet ef migrations add AddAuthSchema -p Infrastructure -s Api
dotnet ef database update -p Infrastructure -s Api
```

Seed at least the roles your app uses (e.g. `Member`, `Admin`) on startup or via a migration data seed,
since `RegisterAsync` assigns the `"Member"` role by default.

## 5. Endpoints exposed

| Method | Route              | Auth required | Purpose                                   |
|--------|---------------------|----------------|--------------------------------------------|
| POST   | /api/auth/register  | No             | Create account, returns initial token pair |
| POST   | /api/auth/login      | No             | Validate credentials, returns token pair   |
| POST   | /api/auth/refresh    | No (refresh token in body) | Rotate refresh token, issue new access token |
| POST   | /api/auth/revoke     | Yes            | Revoke a single refresh token (logout)     |

`RevokeAllTokensForUserAsync` on `IIdentityService` is available for "log out everywhere" /
forced password-change scenarios but isn't wired to an endpoint here - hook it up wherever your
password-change flow lives.

## 6. Protecting your existing Task endpoints

Once this is wired in, your existing `TasksController` (or wherever your task CRUD endpoints live)
just needs `[Authorize]` on the controller or individual actions, and can read the current user via
`ICurrentUserService` rather than touching `HttpContext` directly - keeping your Application layer
handlers testable without a web host.
