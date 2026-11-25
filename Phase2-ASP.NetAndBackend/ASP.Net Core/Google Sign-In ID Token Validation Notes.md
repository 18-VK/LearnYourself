# Google Sign-In: ID Token Validation Notes

Nov 22, 2026 · @Aman Kumar

## Login flow

Google handles the credentials; your API only ever receives a signed `id_token` and must prove it is genuine.

1. The user clicks "Sign in with Google" in the Angular frontend.
2. The frontend redirects the browser to `accounts.google.com` with your `client_id`, `redirect_uri` and requested scopes.
3. Google shows its login and consent screen. This happens on Google's page, so your app has no visibility into it.
4. Google redirects the browser back to your redirect URI with an `id_token` attached.
5. The frontend sends the token to the API: `POST /api/auth/google` with body `{ "idToken": "eyJhbGciOi..." }`.
6. The API validates the token (signature, issuer, audience) and extracts `sub` (the providerKey), `email` and `name`.
7. The API checks its database for a matching user.

## How the API verifies the signature

Google signs the token with a private key only it holds; your API checks the signature with Google's published public keys, so it never calls Google's auth server per login.

1. The `id_token` is a JWT with three parts: `header.payload.signature`.
2. The header carries a `kid` (key ID) and `alg` (RS256), which identify the key that signed this token.
3. Google publishes its current public keys (a JWKS) at `https://www.googleapis.com/oauth2/v3/certs`.
4. The API fetches that key set, finds the key whose ID matches the token's `kid`, and verifies the signature with it.
5. A valid signature means the token was signed by Google's private key and the payload was not altered. Nobody else can produce a valid signature without that key.

Keys rotate, so the library caches them (honoring the HTTP cache headers) and refetches when it sees an unknown `kid`. Never hardcode the keys.

The frontend is untrusted: anyone can send your API a fake token. The signature check is what proves the token really came from Google.

## Claims to validate

A valid signature alone is not enough; the API must also check these claims.

| Claim | Must be | Why it matters |
| --- | --- | --- |
| `iss` | `https://accounts.google.com` or `accounts.google.com` | Confirms Google issued the token |
| `aud` | Your own `client_id` | Stops a token issued for another app being accepted by yours |
| `exp` | Not yet passed | Rejects expired tokens |

## ASP.NET Core implementation

Use Google's library instead of validating the JWT by hand. `GoogleJsonWebSignature.ValidateAsync` fetches and caches Google's public keys, verifies the signature, and checks `iss` and `exp`; the `Audience` setting makes it check `aud`.

```csharp
using Google.Apis.Auth;

var settings = new GoogleJsonWebSignature.ValidationSettings
{
    Audience = new[] { configuration["Google:ClientId"] }
};

try
{
    GoogleJsonWebSignature.Payload payload =
        await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);

    var providerKey = payload.Subject;   // "sub"
    var email = payload.Email;
    var name = payload.Name;
}
catch (InvalidJwtException)
{
    return Unauthorized();
}
```

Alternative: `AddJwtBearer` with `Authority = "https://accounts.google.com"` and `Audience = <client_id>`. The middleware discovers the keys through OpenID Connect metadata, so the `[Authorize]` pipeline can handle Google tokens directly.

## Reading Google:ClientId from configuration

`configuration["Google:ClientId"]` reads from `IConfiguration`, and the colon separates nested sections. With this `appsettings.json` it returns the client ID string:

```json
{
  "Google": {
    "ClientId": "1234567890-abc123.apps.googleusercontent.com"
  }
}
```

`IConfiguration` merges several sources, and later ones override earlier ones:

1. `appsettings.json`
2. `appsettings.{Environment}.json`, for example `appsettings.Production.json`
3. User secrets (Development only)
4. Environment variables
5. Command-line arguments

In environment variables, use a double underscore instead of the colon (`Google__ClientId=...`). This suits Docker or GitHub Actions without committing the value.

The client ID is public (it is visible in the browser during the redirect), so `appsettings.json` is fine. A client secret, if you ever use the authorization code flow, must not be committed: use user secrets locally and environment variables or a secret store in production.

A cleaner approach is to bind the value to a typed options class and avoid magic strings:

```csharp
public class GoogleAuthOptions
{
    public string ClientId { get; set; } = string.Empty;
}

// Program.cs
builder.Services.Configure<GoogleAuthOptions>(
    builder.Configuration.GetSection("Google"));

// In your service/controller
public AuthService(IOptions<GoogleAuthOptions> options)
{
    _clientId = options.Value.ClientId;
}
```

## Using Google login with your own JWT

Google only proves who the user is. Your API then issues its own JWT, and every later request uses that token. The Google `id_token` is used once, at login, and never to call your API.

1. The frontend sends the Google `id_token` to `POST /api/auth/google`.
2. The API validates it with `GoogleJsonWebSignature.ValidateAsync`.
3. The API finds or creates the user, using `sub` as the provider key and `email` and `name` as profile data.
4. The API issues your own access token (and usually a refresh token).
5. The frontend sends `Authorization: Bearer <your jwt>` on every later call.
6. `AddJwtBearer` validates your token with your signing key, not Google's.

### Login endpoint

```csharp
[HttpPost("google")]
public async Task<IActionResult> GoogleLogin(GoogleLoginRequest request)
{
    GoogleJsonWebSignature.Payload payload;
    try
    {
        payload = await GoogleJsonWebSignature.ValidateAsync(
            request.IdToken,
            new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _config["Google:ClientId"] }
            });
    }
    catch (InvalidJwtException)
    {
        return Unauthorized();
    }

    var user = await _userService.FindOrCreateExternalAsync(
        provider: "Google",
        providerKey: payload.Subject,
        email: payload.Email,
        name: payload.Name);

    var accessToken = _tokenService.CreateAccessToken(user);
    return Ok(new { accessToken });
}
```

### Issuing your own JWT

```csharp
public string CreateAccessToken(User user)
{
    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Email, user.Email),
        new Claim(ClaimTypes.Role, user.Role)
    };

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    var token = new JwtSecurityToken(
        issuer: _jwt.Issuer,
        audience: _jwt.Audience,
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(15),
        signingCredentials: creds);

    return new JwtSecurityTokenHandler().WriteToken(token);
}
```

### Validating your JWT in Program.cs

```csharp
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            ValidateLifetime = true
        };
    });
```

Do not set `Authority = "https://accounts.google.com"` here. The middleware would then expect Google tokens and reject yours. Google tokens are validated only inside the login endpoint.

### Design points

- **Database:** a `Users` table plus an external-logins table (`UserId`, `Provider`, `ProviderKey`), like ASP.NET Identity's `AspNetUserLogins`. Look users up by `Provider + ProviderKey` (`sub`), not by email, because `sub` is stable and email can change.
- **Local login too:** an email/password endpoint (`/api/auth/login`) ends the same way, with `CreateAccessToken(user)`. Everything downstream is identical whichever way the user signed in.
- **Linking accounts:** if a Google login's email matches an existing local user, link them only when the payload's `EmailVerified` is true.
- **Refresh tokens:** keep access tokens short (about 15 minutes) and add a server-side refresh token, so Google is not needed again until the session ends.
- **Secrets:** keep `Jwt:Key` out of source control (user secrets locally, an environment variable or secret store in production). Unlike the Google client ID, it is private. Use at least 32 random characters for HS256.

## Key takeaways

- Google signs with a private key; your API verifies with Google's public keys (JWKS), matched by the token's `kid`.
- Keys rotate, so rely on the library's caching and never hardcode them.
- Check `iss`, `aud` and `exp` in addition to the signature.
- Use `GoogleJsonWebSignature.ValidateAsync` rather than hand-rolled validation.
- The client ID is public and can live in `appsettings.json`; the client secret cannot.
