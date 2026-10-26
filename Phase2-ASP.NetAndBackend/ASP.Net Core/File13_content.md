## About Signing Key (VERY IMPORTANT)

There are 2 cases:

### 🔐 Case 1: Symmetric Key (Shared Secret)

Auth Server and API both know same secret.

```csharp
IssuerSigningKey = new SymmetricSecurityKey(...)
```

❌ **Problem:**

- Not scalable
- Risky (key shared across services)

### 🔐 Case 2: Asymmetric Key (Recommended ✅)

- Auth Server → signs with PRIVATE key
- API → validates using PUBLIC key

👉 This is what happens in production

- ✔ API does NOT need secret
- ✔ Only needs public key (safe)

> **Note:** will go through second option later.

## So how does Auth server validate user login?

**What happens internally (IMPORTANT)**

✅ **Step 1: Receive credentials**

```json
POST /login
{
  "username": "aman",
  "password": "12345"
}
```

✅ **Step 2: Fetch user from DB**

```csharp
var user = db.Users.FirstOrDefault(u => u.Username == request.Username);
```

👉 If user not found → ❌ reject

✅ **Step 3: Verify password (hashed)**

Passwords are NOT stored like this:

```text
❌ "12345"
```

They are stored like:

```text
✔ HASH("12345" + salt)
```

✅ **Step 4: Create claims**

```csharp
var claims = new[]
{
    new Claim("sub", user.Id.ToString()),
    new Claim("email", user.Email),
    new Claim("role", user.Role)
};
```

✅ **Step 5: Generate JWT**

```csharp
var token = new JwtSecurityToken(
    issuer: "auth-server",
    audience: "my-api",
    claims: claims,
    expires: DateTime.UtcNow.AddMinutes(30),
    signingCredentials: creds
);
```

✅ **Step 6: Return token**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

## How does this user get created?

**How users are created (3 real ways)**

### ✅ 1. Self Registration (Most common)

User creates their own account:

```text
Client → /register
Auth Server → creates user in DB
```

**Example flow:**

1. User enters email + password
2. Auth Server validates input
3. Password is hashed
4. User saved in database

### ✅ 2. Admin creates users (Enterprise apps)

👉 Admin panel / backend system creates users

```text
Admin → creates employee accounts
Auth Server → stores them
```

Used in:

- Company internal tools
- Banking systems
- ERP systems

### ✅ 3. External Identity Providers (Modern approach)

👉 You don't create users manually

**Examples:**

- Google login
- Microsoft login
- OTP login

```text
User → Google login
Auth Server → gets user info
Auth Server → creates user (first time only)
```

👉 This is called:
**Just-in-time user provisioning**

## How to share signing key between auth server and API

**Short answer:**

- ❗ In production, you don't "share" a secret key
- ✅ You use asymmetric keys (public/private)

**Two ways to handle signing keys**

### ❌ Option 1: Shared Secret (Symmetric key)

Auth Server ↔ API use same secret key.

**Example:**

```csharp
IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("my-secret"))
```

🚫 **Problems:**

- Secret must be copied to all APIs
- If leaked → attacker can create tokens
- Hard to rotate keys

👉 Only okay for learning / small apps

### ✅ Option 2: Public / Private Key (Asymmetric) ⭐

- Auth Server → PRIVATE key (signs token)
- API → PUBLIC key (validates token)

✔ **Benefits:**

- API never sees private key
- Much more secure
- Scales to multiple APIs

🔐 **2) How it actually works**

- Auth Server signs JWT using PRIVATE key
- API receives JWT
- API verifies signature using PUBLIC key
- If valid → trusted

> **Watch this to get idea of how to use keys:** <https://youtu.be/mtZS6Cg6Nd8>

# Production-grade JWT signing

A real-world, end-to-end approach (Auth Server + API) using asymmetric keys (RSA) — exactly how production systems work.

## What we are building

```text
[ Auth Server ]
   - Has PRIVATE key
   - Generates JWT

[ Web API ]
   - Has PUBLIC key
   - Validates JWT

[ Client ]
   - Gets token → calls API
```

# Where to store keys (DO THIS)

❌ **Bad:**

- `appsettings.json`
- source code
- environment variables (for private key)

✅ **Good:**

- Windows Certificate Store
- Azure Key Vault
- AWS Secrets Manager / KMS

# In production, you usually use the metadata endpoint (Authority), not a hardcoded public key

## 1) Two approaches

### ✅ Approach 1: Use Authority (Recommended ⭐)

```csharp
options.Authority = "https://auth-server";
options.Audience = "my-api";
```

👉 This internally calls:

```text
https://auth-server/.well-known/openid-configuration
```

🔍 **What API gets from this:**

- Issuer
- JWKS endpoint
- Public keys
- Key rotation support

✔ **Why this is best**

- No manual key handling
- Automatic key rotation
- Standard (OAuth / OpenID Connect)
- Works with multiple keys (`kid`)

### ⚙️ Approach 2: Hardcode Public Key

```csharp
options.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuerSigningKey = true,
    IssuerSigningKey = new RsaSecurityKey(publicKey),
    ValidateIssuer = true,
    ValidIssuer = "https://auth-server",
    ValidateAudience = true,
    ValidAudience = "my-api"
};
```

❌ **Problems:**

- No key rotation
- Manual updates required
- Risk of downtime
- Not scalable

## What actually happens in production

👉 Even when you use `Authority`:

- API calls metadata only initially
- Then caches keys
- Refreshes periodically

👉 So:

- ❌ Not called on every request
- ✔ Efficient and scalable

## When can you use public key directly?

Use hardcoded public key only when:

- Internal system (controlled env)
- No key rotation needed
- Simple microservice setup
- Offline validation required

## Real-world industry practice

Most systems use:

- OAuth2 / OpenID Connect
- Identity providers

So they always use:

```csharp
options.Authority = "https://auth-server";
```

## What happens during key rotation

👉 Auth Server changes key:

```text
Old Key → expires
New Key → added in JWKS
```

👉 API automatically:

- Fetches new keys
- Uses correct key via `kid`

## Important clarification

👉 API does NOT call auth server for every request

Instead:

```text
Startup → fetch metadata
Runtime → validate locally using cached keys
```

# What happens really with example?

In a production setup, the Auth Server issues the token, and the Web API validates that token locally using the auth server's metadata/public key. In ASP.NET
Core, this is typically done with JwtBearer by setting `Authority` and `Audience`; the handler uses OpenID Connect discovery metadata and refreshes keys as
needed. The API then extracts the bearer token from the `Authorization` header, validates signature, issuer, audience, and expiration, and builds the user
identity from claims.

**Here is a realistic production-style example.**

## 1) System names

```text
Auth Server: https://auth.contoso.com
Web API:     https://api.contoso.com
Client:      web app / mobile app / backend service
```

The access token is a sensitive credential and should be treated like a password for API access.

## 2) Auth Server endpoints

### A. Discovery endpoint

This is what the API uses to discover issuer and signing keys.

```http
GET /.well-known/openid-configuration
```

**Example response:**

```json
{
  "issuer": "https://auth.contoso.com",
  "authorization_endpoint": "https://auth.contoso.com/connect/authorize",
  "token_endpoint": "https://auth.contoso.com/connect/token",
  "jwks_uri": "https://auth.contoso.com/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
  "scopes_supported": ["openid", "profile", "email", "api.read", "api.write"]
}
```

OpenID Connect metadata is the standard place the API or client reads these values from.

### B. JWKS endpoint

This exposes the public keys only.

```http
GET /.well-known/jwks.json
```

**Example response:**

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key-2026-04",
      "alg": "RS256",
      "n": "base64url-modulus",
      "e": "AQAB"
    }
  ]
}
```

# Where does /.well-known/openid-configuration come from?

- This endpoint is NOT something you automatically get in a normal Web API
- ❗ It is exposed by an Auth Server that implements OpenID Connect

## Who provides this endpoint?

✅ **If you use a real Auth Server:**

- IdentityServer / OpenIddict
- Azure AD
- Auth0

👉 They automatically expose:

```text
https://your-auth-server/.well-known/openid-configuration
```

## What happens in your current demo?

In your example:

```text
https://localhost:5001
```

👉 Your Auth Server does NOT have this endpoint yet

Because:

- You only created a custom controller (`/api/auth/login`)
- You did NOT implement OpenID Connect

## So your API config currently is misleading

```csharp
options.Authority = "https://localhost:5001";
```

👉 This will FAIL unless:

That URL exposes `.well-known/openid-configuration`

## How to fix (2 options)

### Option 1: Use OpenIddict (REAL production way ⭐)

This will automatically create:

```text
/.well-known/openid-configuration
/.well-known/jwks.json
/connect/token
/connect/authorize
```

**Example (Auth Server setup):**

```csharp
builder.Services.AddOpenIddict()
    .AddServer(options =>
    {
        options.SetTokenEndpointUris("/connect/token");

        options.AllowPasswordFlow();
        options.AcceptAnonymousClients();

        options.AddDevelopmentEncryptionCertificate()
               .AddDevelopmentSigningCertificate();

        options.UseAspNetCore()
               .EnableTokenEndpointPassthrough();
    });
```

👉 Now this works:

```text
https://localhost:5001/.well-known/openid-configuration
```

### Option 2: Don't use Authority (manual key setup)

If you don't implement OpenID Connect:

👉 Remove `Authority` and use public key manually:

```csharp
options.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuer = true,
    ValidIssuer = "https://localhost:5001",

    ValidateAudience = true,
    ValidAudience = "orders-api",

    ValidateIssuerSigningKey = true,
    IssuerSigningKey = new X509SecurityKey(cert) // public key
};
```

## Difference (VERY IMPORTANT)

| Feature       | Manual JWT      | OpenID Connect |
| ------------- | --------------- | -------------- |
| `.well-known` | ❌ Not available | ✅ Available    |
| Key rotation  | ❌ Manual        | ✅ Automatic    |
| Standard      | ❌ Custom        | ✅ Industry     |
| Scaling       | ❌ Hard          | ✅ Easy         |

## Real-world answer

👉 In production:

- You ALWAYS use an Auth Server that exposes `.well-known`
- Your API uses `Authority`
- Everything is automatic

## Final Answer

👉 That endpoint exists only if:

✔ You use OpenID Connect compliant Auth Server

👉 In your current demo:

❌ It does NOT exist yet

# How to implement .well-known/openid-configuration in auth server

**What is `.well-known/openid-configuration`?**

It's a standard discovery endpoint that tells your API:

- Who is the issuer?
- Where is token endpoint?
- Where are public keys (JWKS)?
- What flows are supported?

**Example URL:**

```text
https://auth.myapp.com/.well-known/openid-configuration
```

> **Note:** before getting into how to implement it, we need to get to know about OpenIddict and how it works.
