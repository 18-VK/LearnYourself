/**
 * Code and text copied verbatim from the ASP.NET Core notes. `verbatim.ts` registers each one with the
 * build, which fails if the note changes and these copies no longer appear in it.
 */

export const NOTES = {
  middleware: 'Phase2-ASP.NetAndBackend/ASP.Net Core/8.ASP_MiddlewareNMore.md',
  auth: 'Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md',
  moreAuth: 'Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md',
  authServer: 'Phase2-ASP.NetAndBackend/ASP.Net Core/12.ASP_AuthServer.md',
  rateLimiting: 'Phase2-ASP.NetAndBackend/ASP.Net Core/15.ASP_RateLimitingNmore.md',
} as const;

// ── 8.ASP_MiddlewareNMore.md ────────────────────────────────────────────────────────────────

/** "## How middleware works internally" (a text block). */
export const MIDDLEWARE_FLOW_TEXT = `Request -> Middleware A -> Middleware B -> Middleware C -> Controller
-> Middleware C -> Middleware B -> Middleware A -> Response`;

/** "# Final Production Order (VERY IMPORTANT)". */
export const PRODUCTION_ORDER_CODE = `app.UseExceptionHandler();     // 1. Catch errors first

app.UseStaticFiles();          // 2. Serve static files fast

app.UseRouting();              // 3. Match endpoint

app.UseCors("AllowFrontend");  // 4. Allow frontend

app.UseAuthentication();       // 5. Identify user
app.UseAuthorization();        // 6. Check access

app.UseRateLimiter();          // 7. Protect API

app.MapControllers();          // 8. Execute endpoint`;

/** "## UseCors()" step 1: the "AllowFrontend" policy the production order refers to. */
export const CORS_POLICY_CODE = `builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins("http://localhost:3000")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});`;

/** "## UseRateLimiter()" step 1: the "fixed" limiter the production order's sample endpoint uses. */
export const MIDDLEWARE_RATE_LIMIT_CODE = `builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("fixed", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromSeconds(10);
        opt.QueueLimit = 2;
    });
});`;

// ── 15.ASP_RateLimitingNmore.md ─────────────────────────────────────────────────────────────

/** "## 2. All Four Limiter Types". */
export const ALL_FOUR_LIMITERS_CODE = `builder.Services.AddRateLimiter(options =>
{
    // Fixed Window
    options.AddFixedWindowLimiter("fixed", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromSeconds(60);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 2;
    });

    // Sliding Window
    options.AddSlidingWindowLimiter("sliding", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromSeconds(60);
        opt.SegmentsPerWindow = 4;   // divides window into 4 sub-segments
        opt.QueueLimit = 2;
    });

    // Token Bucket
    options.AddTokenBucketLimiter("token", opt =>
    {
        opt.TokenLimit = 20;
        opt.TokensPerPeriod = 5;
        opt.ReplenishmentPeriod = TimeSpan.FromSeconds(10);
        opt.AutoReplenishment = true;
        opt.QueueLimit = 2;
    });

    // Concurrency Limiter (not rate over time, but limits parallel requests)
    options.AddConcurrencyLimiter("concurrency", opt =>
    {
        opt.PermitLimit = 5;
        opt.QueueLimit = 10;
    });
});`;

/** "### Leaky Bucket" (theory only: ASP.NET Core has no built-in leaky bucket limiter). */
export const LEAKY_BUCKET_TEXT = `Requests queue up and are processed at a constant outflow rate regardless of burst size, smoothing traffic instead of allowing bursts.`;

/** "## 1. Basic Setup": the rejection settings (429 + Retry-After). */
export const REJECTION_CODE = `    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.Headers["Retry-After"] = "60";
        await context.HttpContext.Response.WriteAsync(
            "Too many requests. Please try again later.", token);
    };`;

// ── 10.ASP_AuthenticationNAuthorisation.md ──────────────────────────────────────────────────

/** "### 1. Header". */
export const JWT_HEADER_JSON = `{
    "alg": "HS256",
    "typ": "JWT",
    "kid": "abc123"
}`;

/** "### 3. Signature". */
export const JWT_SIGNATURE_TEXT = `HMACSHA256(
    base64UrlEncode(header) + "." + base64UrlEncode(payload),
    secret
)`;

/** "### 4. Final JWT token" (the note breaks it over two lines). */
export const JWT_NOTE_TOKEN = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNzA4MzQ1MTIzLCJleHAiOjE3MDgzNTUxMjN9.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`;

/** "### Configuration (App Setup)" under "## Authentication". */
export const JWT_VALIDATION_CODE = `builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],

            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],

            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,

            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:SigningKey"]!)),

            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });`;

/** "### How Validation Happens (RUNTIME FLOW)": signing and verifying with RSA. */
export const RSA_SIGN_TEXT = `signing_input = base64url(header) + "." + base64url(payload)
hash = SHA256(signing_input)
signature = hash ^ d mod n        ← d = private exponent (secret)`;

export const RSA_VERIFY_TEXT = `recomputed_hash = SHA256(header + "." + payload)   ← computed fresh from the token
recovered_hash  = signature ^ e mod n              ← e = public exponent (shared freely)`;

// ── 11.ASP_MoreOnAuth.md ────────────────────────────────────────────────────────────────────

/** "#### How to Use These Keys in .NET" → "For Asymmetric (RS256)". */
export const RSA_SIGNING_CREDENTIALS_CODE = `// To Sign (Auth Server side)
var rsa = RSA.Create();
rsa.ImportFromPem(File.ReadAllText("private.pem"));
var key = new RsaSecurityKey(rsa);
var credentials = new SigningCredentials(key, SecurityAlgorithms.RsaSha256);`;
