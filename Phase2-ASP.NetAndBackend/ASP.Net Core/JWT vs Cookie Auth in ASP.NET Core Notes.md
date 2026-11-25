# JWT vs Cookie Auth in ASP.NET Core: Notes

Nov 22, 2026 · @Aman Kumar

## Core idea

Use cookies for browser apps you control end to end, and JWTs for APIs consumed by non-browser clients or across services. They are not opposites: a cookie is a *transport* (how the credential travels), and a JWT is a *token format* (what the credential looks like). You can put a JWT inside a cookie.

## When to use cookie-based auth

Pick cookies when the client is a browser app and you want the server to own the session.

- **Browser clients:** MVC, Razor Pages, Blazor Server, or an SPA on the same site as the API.
- **Server-controlled sessions:** logout, "sign out everywhere" and force-expiry are easy because the session lives server-side or can be revoked.
- **XSS resilience:** an `HttpOnly` cookie can't be read by JavaScript, so an injected script can't steal the credential directly.
- **Simplicity:** `AddAuthentication().AddCookie()` handles sliding expiration, encryption and data protection out of the box.

Watch out for CSRF: set `SameSite=Lax` or `Strict`, use `Secure`, and add antiforgery tokens for state-changing requests.

## When to use JWT

Pick JWTs when the client isn't a browser or when several services must trust the same identity.

- **Non-browser clients:** mobile apps, desktop apps, CLI tools and third-party API consumers.
- **Multiple services or domains:** microservices, an API gateway, or a separate auth server such as Keycloak, Entra ID or Duende.
- **Stateless verification:** any service holding the public key can validate the token without calling a session store.
- **Delegated access (OAuth2/OIDC):** access tokens are typically JWTs.

Watch out for revocation: a JWT stays valid until it expires. Use short lifetimes (5-15 minutes) plus refresh tokens, and keep a deny-list only if you truly need instant revocation, since that erodes the stateless benefit.

## Common mistakes

The most damaging one is keeping a JWT where scripts can read it.

- **Storing JWTs in `localStorage`:** any XSS can read it. In a browser, keep the token in an `HttpOnly` cookie, or hold the access token in memory with the refresh token in an `HttpOnly` cookie.
- **JWTs for a simple server-rendered app** "because it's modern": you take on refresh, revocation and storage complexity for no benefit.
- **Long-lived JWTs** to avoid building a refresh flow.
- **Sensitive data in the payload:** JWTs are signed, not encrypted, so anyone can decode them.

## Quick decision guide

Match the scenario to the pick; the last row is the deciding factor when you need instant logout.

| Scenario | Pick |
| --- | --- |
| Razor Pages / MVC / Blazor Server | Cookie |
| SPA + API on the same domain (BFF pattern) | Cookie (session via BFF) |
| SPA + API on different domains | JWT (access + refresh), or BFF with cookies |
| Mobile app + API | JWT |
| Public API for third parties | JWT / OAuth2 |
| Microservices behind a gateway | JWT |
| Need instant logout / revocation | Cookie / session |

## Hybrid: the BFF pattern

For SPAs, a Backend-for-Frontend gives you cookie-grade browser security and JWT-based service-to-service auth. The browser talks to the BFF using a secure `HttpOnly` cookie. The BFF holds the JWT or access tokens server-side and calls downstream APIs on the browser's behalf, so tokens never reach JavaScript.

## Implementing JWT in an HttpOnly cookie

The server issues a JWT on login and stores it in an `HttpOnly` cookie. The JWT middleware reads the token from that cookie instead of the `Authorization` header, so the browser sends it automatically and JavaScript never touches it.

### 1. Configure JWT validation to read the cookie

```csharp
// Program.cs
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                // Fall back to the cookie if there is no Authorization header
                ctx.Token ??= ctx.Request.Cookies["access_token"];
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

app.UseAuthentication();
app.UseAuthorization();
```

### 2. Issue the JWT and set the cookie on login

```csharp
[HttpPost("login")]
public IActionResult Login(LoginRequest req)
{
    var user = _userService.Validate(req.Email, req.Password);
    if (user is null) return Unauthorized();

    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim(ClaimTypes.Name, user.Email),
        new Claim(ClaimTypes.Role, user.Role)
    };

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
    var token = new JwtSecurityToken(
        issuer: _config["Jwt:Issuer"],
        audience: _config["Jwt:Audience"],
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(15),
        signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

    var jwt = new JwtSecurityTokenHandler().WriteToken(token);

    Response.Cookies.Append("access_token", jwt, new CookieOptions
    {
        HttpOnly = true,                 // JS can't read it
        Secure = true,                   // HTTPS only
        SameSite = SameSiteMode.Lax,     // CSRF mitigation (Strict if possible)
        Expires = DateTimeOffset.UtcNow.AddMinutes(15),
        Path = "/"
    });

    return Ok();
}
```

### 3. Logout

Delete the cookie using the same `Path` and `Domain` it was created with. The JWT itself stays valid until it expires if someone copied it earlier, which is why lifetimes stay short.

```csharp
[HttpPost("logout")]
public IActionResult Logout()
{
    Response.Cookies.Delete("access_token", new CookieOptions
    {
        Secure = true,
        SameSite = SameSiteMode.Lax,
        Path = "/"
    });
    return NoContent();
}
```

### 4. Add a refresh token cookie

With a 15-minute access token you need a refresh flow. Store the refresh token in a second cookie scoped to the refresh endpoint only:

```csharp
Response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Strict,
    Expires = DateTimeOffset.UtcNow.AddDays(7),
    Path = "/auth/refresh"   // only sent to this endpoint
});
```

On `/auth/refresh`, validate the refresh token against your database (store a hash, not the raw value), rotate it (issue a new one and invalidate the old one), and set a fresh access cookie. Rotation plus reuse detection is what gives you real revocation.

### 5. Handle CSRF

The browser attaches cookies automatically, so you need CSRF protection.

- `SameSite=Lax` or `Strict` blocks most cross-site requests.
- For extra safety on POST/PUT/DELETE, add antiforgery, then serve a token the SPA can read and send back as a header. Validate it with `[ValidateAntiForgeryToken]` or `AutoValidateAntiforgeryToken`.

**Must check**

[CSRF protection for cookie-based SPAs](<CSRF Protection for Cookie-Based SPA in ASP.NET Core.md>)

```csharp
builder.Services.AddAntiforgery(o => o.HeaderName = "X-XSRF-TOKEN");
```

### 6. If the frontend is on a different origin

```csharp
builder.Services.AddCors(o => o.AddPolicy("spa", p => p
    .WithOrigins("https://app.example.com")   // no wildcard with credentials
    .AllowCredentials()
    .AllowAnyHeader()
    .AllowAnyMethod()));
```

```js
fetch("https://api.example.com/orders", { credentials: "include" });
```

Cross-site cookies require `SameSite=None; Secure`, which weakens CSRF protection. Where possible, serve the API under the same site (for example `app.example.com` and `api.example.com`) so `Lax` still works.

## Gotchas

JWT-in-cookie only pays off when one API must also serve mobile or third-party clients; for a same-site browser app, plain cookie auth is simpler.

- Cookies are limited to about 4 KB, so keep claims minimal.
- Use a strong signing key (32+ bytes) from user secrets or a vault, never from source control.
- Require `Secure` (HTTPS) in every environment except local dev.
- The code above also accepts the `Authorization` header, which is how non-browser clients use the same API.
