# HTTPS Implementation

Here's the complete setup to lock your API down to HTTPS-only with proper authentication and authorization enforced.

# Force HTTPS — reject/redirect plain HTTP

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

// ... your existing AddIdentityCore, AddJwtBearer, etc. registrations ...

builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
    options.HttpsPort = 443;
});

// HSTS - tells browsers to NEVER even try HTTP again for a while
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();   // sends Strict-Transport-Security header — only in prod, HSTS + local dev certs don't mix well
}

app.UseHttpsRedirection();   // redirects any http:// request to https://
```

## UseHttpsRedirection — server-side redirect, per request

This runs on every incoming request. If it arrives over plain HTTP, the middleware sends back a redirect response pointing to the HTTPS version of the
same URL.

```csharp
builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
    options.HttpsPort = 443;
});

var app = builder.Build();
app.UseHttpsRedirection();
```

**What actually happens on the wire:**

- Request arrives over HTTP

```http
GET http://yourapi.com/api/tasks HTTP/1.1
Host: yourapi.com
```

- Server responds — doesn't process the request, just redirects

```http
HTTP/1.1 308 Permanent Redirect
Location: https://yourapi.com/api/tasks
```

The client then has to make a second request, this time over HTTPS, to actually get data. This means the first request already happened over an insecure
channel — anyone intercepting that initial HTTP request could see the URL path, headers, and (if it's a POST) part of the body, even though the redirect
itself is harmless.

## UseHsts — browser-side instruction, cached ahead of time

This doesn't redirect anything itself. It adds one response header telling the browser: "remember this domain, and never even attempt HTTP for it again
for the next N seconds."

```csharp
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}
```

**What actually happens on the wire:**

Any HTTPS response from your server includes this header:

```http
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Once the browser has seen this header even once, on the next visit, it rewrites `http://yourapi.com` to `https://yourapi.com` internally, before sending
anything over the network at all — no insecure first request, no interception window, nothing to redirect.

**Why you need both, not just one**

```csharp
app.UseHttpsRedirection();   // handles: user typed http://, or an old bookmark/link uses http://
app.UseHsts();               // handles: browser remembers and skips http:// entirely on repeat visits
```

`UseHttpsRedirection` is your safety net for the very first contact — someone typing the bare domain, an old link floating around, a script hardcoded to
`http://`. `UseHsts` is what prevents that insecure first contact from recurring on every future visit once the browser has learned about your HTTPS policy.

### UseHsts options

```csharp
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});
```

Each of these three options controls exactly what gets written into the `Strict-Transport-Security` header, and each one has a real consequence if set
wrong — HSTS is one of the few settings where misconfiguring it can lock you out of your own domain over HTTP for a long time, so it's worth
understanding precisely.

#### MaxAge

```csharp
options.MaxAge = TimeSpan.FromDays(365);
```

This becomes the `max-age` directive in the header, in seconds:

```http
Strict-Transport-Security: max-age=31536000
```

It tells the browser: "for the next 31,536,000 seconds (365 days) after seeing this header, never attempt a plain HTTP request to this domain — always
upgrade to HTTPS automatically, without asking the server first."

**The critical gotcha:** this is a rolling window. Every time the browser sees the header again (on any HTTPS response), the countdown resets to a full 365
days from that moment. So as long as users keep visiting your site regularly, they effectively stay locked into HTTPS-only indefinitely — not just for
one year total.

**Why this matters practically:** if you ever need to roll back to plain HTTP (e.g. testing, a misconfigured cert, migrating domains), any browser that
already cached this header will simply refuse to make HTTP requests to your domain for up to a year, even if your server itself would now accept HTTP.
There's no way to "un-send" this to browsers that already saw it — you'd have to wait out the `max-age`, or serve a new HSTS header with `max-age=0` to
explicitly clear it.

```csharp
// Emergency "undo" — tells browsers to forget the HSTS policy immediately
options.MaxAge = TimeSpan.Zero;
```

#### IncludeSubDomains

```csharp
options.IncludeSubDomains = true;
```

Adds `includeSubDomains` to the header:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Without this, HSTS only applies to the exact domain that sent the header — `yourapi.com`. With it, the policy extends to every subdomain too — `api.yourapi.com`,
`admin.yourapi.com`, `staging.yourapi.com`, all of them, even ones that haven't been created yet.

**Why you'd want this:** prevents an attacker from bypassing your HSTS protection by tricking a user into visiting `http://some-forgotten-subdomain.yourapi.com`
that you never got around to serving HTTPS on.

**The real risk if you set this carelessly:** if you have any subdomain that genuinely can't run HTTPS — an old internal tool, a third-party-hosted
subdomain, a staging environment without a valid cert — turning this on breaks it for every visitor whose browser has cached your main domain's HSTS
header, because the policy now applies there too, whether that subdomain is ready for it or not.

#### Preload

```csharp
options.Preload = true;
```

Adds `preload` to the header:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## Avoid HSTS in Development

```csharp
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();            // then set the header on the (now-HTTPS) response, so future visits skip HTTP
}
```

Local development typically uses a self-signed dev certificate (`dotnet dev-certs https`), and HSTS is aggressive — once a browser caches the HSTS policy
for `localhost`, it'll refuse plain HTTP to `localhost` for the `MaxAge` duration, which can break other local projects or tools running on plain HTTP during
development. Keeping it prod-only avoids that friction.

# Enforce it at the hosting level too (defense in depth)

`UseHttpsRedirection` is an app-level redirect — for real production hardening, also configure this outside the app:

"Defense in depth" here means: don't rely on your ASP.NET Core middleware alone to guarantee HTTPS — because in many real deployments, your app code
isn't actually the first thing that receives the request. Something else (a reverse proxy, a load balancer, the OS-level web server) sits in front of it,
and if that layer isn't also configured correctly, your `UseHttpsRedirection`/`UseHsts` code can end up not doing what you think it's doing.

**Why app-level redirect alone isn't enough**

```csharp
app.UseHttpsRedirection();
```

This only works correctly if ASP.NET Core actually knows the original request came in over HTTP. But in most production setups, your app isn't directly
facing the internet:

```text
Internet → Reverse Proxy / Load Balancer (terminates TLS here) → Kestrel (your app, plain HTTP internally)
```

The proxy decrypts HTTPS from the client, then forwards the request to your app over plain HTTP on the internal network. From Kestrel's point of view,
every single request looks like HTTP — even ones that were genuinely HTTPS from the client's perspective. If you don't tell your app about this
arrangement, `UseHttpsRedirection` might think every request needs redirecting (including ones that were already secure), causing an infinite redirect
loop, or it might silently do nothing useful at all.

## The three layers where this needs to be configured

### 1. Kestrel itself — don't even listen on HTTP in production

```json
// appsettings.Production.json
{
  "Kestrel": {
    "Endpoints": {
      "Https": {
        "Url": "https://0.0.0.0:5001",
        "Certificate": {
          "Path": "/etc/certs/yourapi.pfx",
          "Password": "from-env-or-keyvault"
        }
      }
    }
  }
}
```

If Kestrel has no HTTP endpoint configured at all, there's nothing to redirect — a plain HTTP connection attempt fails to even establish, rather than
succeeding and then bouncing to HTTPS. This is the strongest possible guarantee, but it only works if nothing sits between the client and Kestrel (rare
in production — usually there's a proxy).

### 2. Reverse proxy (Nginx/IIS/Azure)

Nginx handles the actual TLS termination and the HTTP→HTTPS redirect entirely on its own — your app never even sees the insecure request. But it forwards
the original scheme via the `X-Forwarded-Proto` header so your app can still correctly answer "was this request secure?" if it needs to (e.g. for building
absolute URLs, or `Request.IsHttps` checks).

**Nginx example**

```nginx
server {
    listen 80;
    server_name yourapi.com;
    return 301 https://$host$request_uri;   # redirect at the proxy, before it even reaches Kestrel
}

server {
    listen 443 ssl;
    server_name yourapi.com;

    ssl_certificate /etc/ssl/certs/yourapi.crt;
    ssl_certificate_key /etc/ssl/private/yourapi.key;

    location / {
        proxy_pass http://localhost:5000;   # internal call to Kestrel is plain HTTP — normal and fine
        proxy_set_header X-Forwarded-Proto https;   # tells your app "this WAS https, even though I'm sending it as http now"
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }
}
```

**IIS example (if hosting on Windows Server)**

```xml
<!-- web.config, or via IIS Manager's URL Rewrite module -->
<system.webServer>
  <rewrite>
    <rules>
      <rule name="Force HTTPS" stopProcessing="true">
        <match url="(.*)" />
        <conditions>
          <add input="{HTTPS}" pattern="off" ignoreCase="true" />
        </conditions>
        <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
      </rule>
    </rules>
  </rewrite>
</system.webServer>
```

### 3. Your app must trust and read those forwarded headers

This is the piece that's easy to miss — without it, your app doesn't know the proxy already handled HTTPS, and things like `Request.IsHttps`, `Request.Scheme`, and any redirect logic inside your app will be wrong:

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    // IMPORTANT: by default, ASP.NET Core only trusts forwarded headers from
    // known proxy IPs — if your proxy isn't in that list, headers are ignored
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
    // In practice, either add your proxy's actual IP/network here,
    // or (only if the proxy is fully trusted and on a private network) clear both lists to trust any source — be careful with this in shared/cloud environments
});

var app = builder.Build();

app.UseForwardedHeaders();   // MUST come before UseHttpsRedirection/UseAuthentication
app.UseHttpsRedirection();
```

Without `UseForwardedHeaders()`, your app sees every request as arriving over HTTP (since that's genuinely how Nginx forwarded it internally), which can
cause `UseHttpsRedirection` to try redirecting requests that are actually already secure from the client's perspective — leading to a redirect loop between
the proxy and your app.
