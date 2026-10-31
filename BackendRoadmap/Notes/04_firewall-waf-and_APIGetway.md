# Firewall and WAF: Study Notes

## 1. The one-line idea

- **Firewall (network-level):** decides *who can connect to which port*. It looks at IPs, ports, and protocols.
- **WAF (application-level):** decides *whether an HTTP request looks malicious*. It reads the actual request content (URL, headers, body, cookies).

Think of a building: the firewall is the security gate that checks which doors people may approach. The WAF is the guard inside who opens the bag and checks what you're carrying.

---

## 2. Where it sits in the request flow

```
Client -> DNS -> CDN -> Firewall / WAF -> Load balancer -> API gateway
       -> Reverse proxy (Nginx) -> App server -> Cache / Database
```

In practice the WAF is often built into the CDN or cloud edge (Cloudflare, AWS CloudFront + AWS WAF), so it may sit before or alongside the CDN. Network firewalls also exist deeper in the stack, around your servers and database.

---

## 3. Network firewall

### What it does
Filters traffic using rules on OSI layers 3 and 4:

| Rule input | Example |
|---|---|
| Source / destination IP | Allow only office IP range to SSH |
| Port | Allow 80 and 443, block everything else |
| Protocol | Allow TCP, block ICMP |

### Types
- **Stateless:** checks each packet on its own. Fast, but simple.
- **Stateful:** tracks connections, so reply traffic for an allowed outgoing request is automatically permitted. Most modern firewalls work this way.

### Example
A server running a web app and PostgreSQL:

| Port | Service | Rule |
|---|---|---|
| 443 | HTTPS | Allow from anywhere |
| 80 | HTTP | Allow (redirect to 443) |
| 22 | SSH | Allow only from your IP |
| 5432 | PostgreSQL | Deny public. Allow only from the app server |

Result: attackers scanning the internet can see only your web ports. They can't even attempt to connect to the database.

**Cloud equivalents:** AWS Security Groups and NACLs, Azure NSGs, GCP firewall rules, Linux `ufw` / `iptables`.

---

## 4. WAF (Web Application Firewall)

### What it does
Inspects HTTP/HTTPS requests at layer 7 (the application layer) and blocks, allows, or challenges them based on rules. Typical protections:

- SQL injection
- Cross-site scripting (XSS)
- Path traversal and file inclusion
- Bad bots and scrapers
- Rate limiting and brute-force protection (login, OTP endpoints)
- Geo or IP reputation blocking
- Protection against the OWASP Top 10 categories

### Example: SQL injection blocked

Normal request:

```
GET /products?id=42
```

Malicious request:

```
GET /products?id=42' OR '1'='1' --
```

A network firewall sees a valid HTTPS request to port 443 and lets it through. The WAF reads the query string, matches a SQL injection pattern, and returns:

```
HTTP/1.1 403 Forbidden
```

The request never reaches your app.

### Example: brute-force login
Rule: more than 10 `POST /login` requests per minute from one IP triggers a block or CAPTCHA for 15 minutes.

### Modes
- **Detect / log only:** records matches without blocking. Use this first.
- **Block:** actively rejects. Switch on after tuning.

### Common tools
- Managed: Cloudflare WAF, AWS WAF, Azure Front Door WAF, Google Cloud Armor
- Self-hosted: ModSecurity with the OWASP Core Rule Set (CRS), often paired with Nginx

---

## 5. How a WAF reads HTTPS traffic (TLS termination)

A WAF can't read a request while it is still encrypted. It has to be the point where the encryption ends, or it has to receive the decrypted traffic. This is called **TLS termination**.

HTTPS encrypts traffic between the browser and whichever server holds your certificate's private key. If the WAF is that server, it can read everything.

```
Browser --(HTTPS, encrypted)--> WAF / CDN / Load balancer
                                  | decrypts and inspects the request
                                  v
                          Your app server
                  (HTTP, or re-encrypted HTTPS)
```

### Steps
1. The browser does the TLS handshake with the WAF, not your app server.
2. The WAF decrypts the request and checks the URL, headers, cookies, and body against its rules.
3. If it passes, the WAF forwards it to your app. If not, it returns a 403.

### Common setups

| Setup | Who terminates TLS |
|---|---|
| Managed edge WAF (Cloudflare, CloudFront + AWS WAF, Azure Front Door) | The provider, using a certificate for your domain |
| WAF on a load balancer (AWS ALB + AWS WAF) | The load balancer |
| Self-hosted (Nginx + ModSecurity) | Nginx, with ModSecurity inspecting the decrypted request |

### The hop between WAF and app
- **Plain HTTP over a private network:** simple and common when the hop stays inside a trusted VPC.
- **Re-encrypted HTTPS (end-to-end):** use when the traffic crosses the public internet or compliance requires it. With Cloudflare, use "Full (strict)" and avoid "Flexible", which leaves the last hop unencrypted.

### Things to know
- The WAF holds your certificate or private key, so choose a reputable provider and protect access to its configuration.
- A network firewall can't do this. It sees only IPs, ports, and encrypted bytes, so it can't catch SQL injection inside HTTPS.
- Some metadata is visible without decrypting: destination IP, port, and usually the domain name (via SNI). That's enough for network rules but not content inspection.
- Decryption adds a small CPU and latency cost, usually negligible.
- After termination, your app sees the WAF's IP. Read the real client IP from headers such as `X-Forwarded-For` or `CF-Connecting-IP`, and trust those headers only from your WAF.

---

## 6. Where to place the WAF in the request cycle

Ideally the WAF sits at the **edge**, as the first thing that handles decrypted traffic, before the load balancer and your servers.

```
Client -> DNS -> [CDN + WAF at the edge] -> Load balancer -> Reverse proxy -> App server -> Database
```

### Why the edge is best
- Bad traffic is dropped early, so attacks and bots never use your bandwidth, load balancer, or app resources.
- Edge networks (Cloudflare, CloudFront, Azure Front Door) have far more capacity than your own servers, which helps against DDoS and bot floods.
- One place protects every app and endpoint behind it.
- It needs TLS termination (see section 5), which edge providers handle for you.

### Common placements

| Placement | When to use it | Trade-off |
|---|---|---|
| Edge, integrated with the CDN (Cloudflare, CloudFront + AWS WAF) | Default for public sites | Easiest, but you depend on the provider |
| On the load balancer (AWS ALB + AWS WAF) | Everything runs in one cloud, no CDN | Traffic reaches your network before it is filtered |
| On the reverse proxy (Nginx + ModSecurity) | Self-hosted, small budgets, custom rules | You manage rules, updates, and capacity yourself |
| Inside the app (middleware) | Extra, app-specific checks | Attacks have already reached your servers |

### What "origin" means in these notes

"Origin" is the CDN's term for the endpoint it forwards requests to. It is **not** the app server. The CDN connects to the load balancer, or to the reverse proxy if there is no load balancer, and never directly to the app server.

| Setup | CDN origin | Path |
|---|---|---|
| Production with a load balancer | Load balancer (DNS name or IP) | CDN -> Load balancer -> Reverse proxy -> App servers |
| Small setup, no load balancer | Reverse proxy (Nginx) | CDN -> Nginx -> App server |
| Cloud-native (for example CloudFront + ALB) | The ALB | CDN -> ALB -> app instances |

Why not point the CDN at the app server directly:
- The app server would be publicly reachable, which defeats locking everything down.
- You lose TLS handling, routing, and health checks, and you'd have to expose the app port.
- With several app servers, the CDN couldn't spread traffic or avoid a dead one.
- Dev servers like Kestrel aren't meant to face the internet.

**Access chain:** internet -> CDN only -> load balancer only -> reverse proxy only -> app only -> data stores only. Each layer accepts connections solely from the one before it, and everything behind the load balancer has no public IP.

### Important details
- **Lock down the origin.** If attackers can reach the origin's IP directly (the load balancer, or the reverse proxy if there is no load balancer), they bypass the WAF. Allow inbound web traffic only from the WAF or CDN's published IP ranges (or use a private tunnel or mTLS), and keep your origin IP out of public DNS records.
- **Cached content skips inspection.** A CDN serving a cached file doesn't run it through the WAF rules for the origin. This is usually fine for static assets, but make sure dynamic and API routes are never cached by mistake.
- **Defense in depth for high-risk apps.** Run an edge WAF for broad threats, plus a second layer at the reverse proxy or API gateway for app-specific rules, such as stricter checks on admin or payment endpoints.
- **Network firewall still applies at every layer.** Its main job here is to make the origin reachable only from the WAF.

**Rule of thumb:** edge WAF in front, origin locked down so it can't be bypassed, and an optional second layer inside for sensitive routes.

---

## 7. Edge-to-origin encryption: can the proxy reject plain HTTP?

When the WAF sits on the CDN, the CDN decrypts the user's HTTPS request to inspect it. What your load balancer and reverse proxy receive depends on how the CDN connects to your origin (the load balancer, or the reverse proxy if there is no load balancer).

### Case 1: CDN connects to the origin over HTTPS (recommended)

```
Browser --HTTPS--> CDN/WAF (decrypt, inspect, re-encrypt) --HTTPS--> Load balancer --> Reverse proxy --> App
```

- The CDN opens a new TLS connection to the origin, so the origin sees encrypted traffic.
- Cloudflare: "Full (strict)" mode. CloudFront: origin protocol policy "HTTPS only".
- The origin needs a valid certificate (Let's Encrypt or a Cloudflare Origin Certificate).
- The origin can safely reject plain HTTP, and the CDN won't use it anyway.

### Case 2: CDN connects to the origin over plain HTTP

This happens with Cloudflare "Flexible" mode or a CDN set to an HTTP-only origin.

- If the proxy has a rule "redirect all HTTP to HTTPS", it redirects every CDN request, the CDN follows the redirect and hits the rule again, and the user gets a **redirect loop** (`ERR_TOO_MANY_REDIRECTS`).
- Rejecting plain HTTP outright would return errors for all users.
- Instead, check the original protocol reported by the CDN in a header: `X-Forwarded-Proto` or Cloudflare's `CF-Visitor`.

```nginx
if ($http_x_forwarded_proto = "http") {
    return 301 https://$host$request_uri;
}
```

This redirects only when the user's own connection was plain HTTP, not when the CDN-to-origin hop was.

### Why Case 2 is a weak setup
- The CDN-to-origin hop crosses the public internet unencrypted, so traffic, cookies, and tokens can be intercepted or altered.
- Users see a padlock while the last hop isn't protected.
- Some compliance standards (PCI DSS, for example) don't accept it.
- It is only reasonable inside a private network you control, and end-to-end TLS is still the safer default.

### What the origin should enforce
- **Accept traffic only from the CDN.** Allow the CDN's published IP ranges or use authenticated origin pulls (mTLS), so nobody can bypass the WAF by hitting the origin directly. Otherwise forwarded headers such as `X-Forwarded-Proto` can be forged.
- **Redirect HTTP to HTTPS at the edge** with the CDN's "Always use HTTPS" option, so plain-HTTP users never reach the origin.
- **Trust forwarded headers only from known sources.** Accept `X-Forwarded-For` and `X-Forwarded-Proto` only from the CDN or load balancer.

### Summary

| Setup | Origin receives | Can the proxy reject plain HTTP? |
|---|---|---|
| CDN re-encrypts to origin (Full strict) | HTTPS | Yes, and it should |
| CDN sends plain HTTP to origin | HTTP | No. Check `X-Forwarded-Proto` instead, or you'll cause redirect loops |

---

## 8. Recommended architecture and full request flow

The recommended setup puts the WAF on the CDN at the edge and locks the origin down so nothing can bypass it.

```
Browser -> DNS -> CDN + WAF (edge) -> Origin firewall -> Load balancer
        -> Reverse proxy -> App server -> Cache -> Database
                                      \-> Message queue (async)
```

The origin firewall is not a separate box. It is the security group or firewall rules on the load balancer (or on the reverse proxy if there is no load balancer).

### Step by step

1. **Browser and DNS.** The browser looks up your domain. DNS points it to the CDN, not your server, so the origin IP stays hidden.
2. **CDN + WAF (edge).** The browser does its TLS handshake with the CDN. The CDN decrypts the request and runs the WAF rules, rate limiting, and bot checks. Attacks get a 403 here. Cacheable static files are served straight from the edge.
3. **Re-encryption to the origin.** For requests that pass, the CDN opens a new HTTPS connection to your origin, which is the load balancer (or the reverse proxy if there is no load balancer). (Cloudflare "Full (strict)", or CloudFront "HTTPS only").
4. **Origin firewall.** Security groups or firewall rules on the load balancer (or the reverse proxy if there is none) allow inbound 443 only from the CDN's IP ranges, or require authenticated origin pulls (mTLS). Direct hits on the origin IP are dropped, so the WAF can't be bypassed. Behind the load balancer, the proxy and app servers accept traffic only from the layer before them and have no public IP.
5. **Load balancer.** Spreads traffic across healthy proxy or app instances. TLS can end here or pass through to the proxy.
6. **Reverse proxy (Nginx).** Handles routing, compression, and headers. Trusts `X-Forwarded-For` and `X-Forwarded-Proto` only from the CDN or load balancer. An API gateway sits here, or replaces the proxy in smaller setups.
7. **App server.** Runs your code on a private port that is never public. Reads the cache first, falls back to the database, and publishes slow work (emails, reports) to the queue.
8. **Database, cache, and queue.** Live on private subnets with no public access. Only the app servers may connect.

### Layer summary

| Layer | Role | Exposure |
|---|---|---|
| CDN + WAF | TLS termination, attack filtering, caching | Public |
| Origin firewall (rules on the load balancer, or the proxy if no load balancer) | Accept only CDN traffic | Public IP, locked to CDN ranges |
| Load balancer | Distribute traffic, health checks | Reachable only from CDN or edge |
| Reverse proxy | Routing, TLS, headers | Private |
| App server | Business logic | Private |
| Cache, database, queue | Data and async work | Private, app servers only |

### Why this placement works
- Attacks and bots are stopped at the edge before using your bandwidth or servers.
- The edge network absorbs large floods your own servers couldn't.
- Locking the origin to the CDN means every request has passed through the WAF.
- Traffic is encrypted end to end, with no plain HTTP on the public internet.

### Optional extras
- **Second WAF layer** on the reverse proxy (ModSecurity) or API gateway for sensitive routes such as admin and payments.
- **Rollout:** start in detect-only mode and tune before blocking.
- **Monitoring:** alert on spikes in 403s and on requests reaching the origin without CDN headers.

---

## 9. API gateway

An API gateway is a single entry point in front of your backend services. It handles the cross-cutting work every API needs, so each service doesn't have to. It works at layer 7 (the application layer) and understands API requests: paths, methods, headers, and tokens.

### What it does
- **Routing:** sends `/users/*` to the user service, `/orders/*` to the order service, and so on.
- **Authentication and authorization:** validates API keys, JWTs, or OAuth tokens once, before the request reaches any service.
- **Rate limiting and quotas:** limits requests per user, API key, or plan (for example 100 per minute on the free tier).
- **Transformation:** rewrites paths, adds or removes headers, converts formats, maps versions (`/v1` to a legacy service).
- **Aggregation:** combines results from several services into one response, so a mobile app makes one call instead of five.
- **Caching:** caches common responses to reduce load.
- **Observability:** central logging, metrics, tracing, and request IDs.
- **Protocol handling:** may translate between REST, gRPC, and WebSocket, and terminate TLS.
- **Resilience:** timeouts, retries, and circuit breakers, so one failing service doesn't drag everything down.

### Example flow

```
Mobile app -> API gateway -> checks JWT, applies rate limit -> routes request
                                   |-> /users    -> User service
                                   |-> /orders   -> Order service
                                   |-> /payments -> Payment service
```

- `GET /orders/42` with a valid token goes to the order service.
- A request without a token gets `401` at the gateway, and the order service never sees it.
- A client over its limit gets `429 Too Many Requests`.

### Where it sits

```
Client -> CDN + WAF -> Load balancer -> API gateway -> Services
```

The gateway comes after the load balancer and before the application services (each service may sit behind its own proxy or load balancer). In small setups the gateway and reverse proxy can be the same tool, since Nginx, Kong, and Traefik do both. The WAF still sits in front at the edge, and the gateway handles API-specific rules such as auth and per-key limits.

### Load balancer vs reverse proxy vs API gateway

| | Load balancer | Reverse proxy | API gateway |
|---|---|---|---|
| Main question | Which server gets this request? | How is this request handled on its way to the app? | Is this API call allowed, and which service handles it? |
| Layer | 4 (transport) or 7 (application) | 7 (application) | 7 (application) |
| Auth, API keys, JWT | No | Basic | Core feature |
| Per-client rate limits and quotas | No | Basic, per IP | Core feature, per key or plan |
| Routing to many services | By server pool | Basic path routing | Rich, API-aware routing |
| Request aggregation | No | No | Yes |
| API versioning, developer portal | No | No | Often |
| Typical use | Availability and scaling | App front door | Managing an API platform |

The three overlap, and one tool may fill several roles, but the focus differs.

### WAF vs API gateway
- The **WAF** looks for malicious patterns (SQL injection, XSS, bots) in any web traffic.
- The **API gateway** enforces API rules (who may call what, how often, which version).
- They complement each other. Use both for a public API.

### Why it is useful
- Common logic (auth, limits, logging) lives in one place instead of being copied into every service.
- Clients use one stable URL, and you can change or split services behind it.
- Bad or unauthorized calls are rejected early, and services stay private.
- It supports versioning, gradual rollouts, and consistent monitoring.

### Drawbacks
- **Single point of failure** unless you run several instances behind a load balancer.
- **Extra hop**, adding a little latency.
- **Can become a bottleneck or "god component"** if business logic ends up in it. Keep it to cross-cutting concerns.
- **More to operate**, and a misconfigured rule can break every API at once.

### When you need one

| Situation | Need a gateway? |
|---|---|
| Microservices or many APIs | Yes, the main use case |
| Public or partner APIs with keys, plans, and quotas | Yes |
| Mobile and web clients needing one entry point | Often |
| Single monolith with one app | Usually no. A reverse proxy is enough |

### Common tools
- **Managed:** AWS API Gateway, Azure API Management, Google Cloud API Gateway / Apigee, Cloudflare API Gateway
- **Self-hosted:** Kong, Traefik, Envoy-based gateways (Ambassador/Emissary, Istio ingress), Nginx, Tyk, KrakenD

### Best practices
- Run several instances behind a load balancer for high availability.
- Validate tokens at the gateway, but still authorize inside each service, so one bypass doesn't expose everything.
- Keep it stateless and free of business logic.
- Keep backend services private so they accept traffic only from the gateway.
- Set sensible timeouts and limits, and return clear errors (`401`, `403`, `429`, `503`).

---

## 10. Firewall vs WAF

| | Firewall | WAF |
|---|---|---|
| Layer | 3 / 4 (network, transport) | 7 (application) |
| Looks at | IP, port, protocol | URL, headers, body, cookies |
| Stops | Unwanted connections, port scans | SQLi, XSS, bots, abusive requests |
| Understands HTTP? | No | Yes |
| Example rule | Block port 5432 from internet | Block requests containing SQL injection patterns |

They complement each other. You need both.

---

## 11. Why it is required

1. **Reduce attack surface.** Unused ports stay unreachable.
2. **Public apps are scanned constantly.** Bots probe new servers within minutes of going online.
3. **Stop common attacks early.** Malicious traffic is dropped before consuming app, database, or bandwidth resources.
4. **Virtual patching.** When a vulnerability is announced, a WAF rule can block exploit attempts while you prepare a proper code fix.
5. **Compliance.** Standards such as PCI DSS expect firewall and web application protections.
6. **Visibility.** Logs show what attackers try, which helps with monitoring and incident response.

---

## 12. Pros and cons

### Firewall
**Pros**
- Very fast and low overhead
- Simple, well-understood rules
- Strong first line of defense, built into every cloud and OS
- Cheap or free

**Cons**
- Blind to application-level attacks (SQLi, XSS pass through on open ports)
- Misconfiguration can lock you out or accidentally expose services
- Rules need ongoing maintenance as architecture changes

### WAF
**Pros**
- Blocks common web attacks before they reach your code
- Virtual patching buys time during zero-day events
- Rate limiting and bot control in one place
- Managed WAFs update rules automatically

**Cons**
- **False positives:** legitimate requests can be blocked (a blog post containing SQL code, for example), so tuning is required
- **Not a substitute for secure code:** attackers can sometimes bypass rules with encoding tricks or novel payloads
- Adds some latency and cost, especially at high traffic volumes
- Can't inspect encrypted traffic unless TLS is terminated at or before the WAF
- Needs ongoing monitoring and rule updates

---

## 13. Best practices

- Default deny: block everything, then open only what you need
- Never expose databases or caches (PostgreSQL, Redis) to the public internet
- Restrict SSH and admin panels to known IPs or a VPN
- Start the WAF in detect mode, review logs, then switch to block
- Enable managed rule sets (OWASP CRS) and add custom rate limits for login and API endpoints
- Keep fixing vulnerabilities in code. Treat the WAF as defense in depth, not the only defense
- Review rules and logs regularly

---

## 14. Quick revision checklist

- [ ] Can I explain the difference between a firewall and a WAF in one sentence?
- [ ] Do I know which ports should be public on a typical web server?
- [ ] Can I describe how a SQL injection request is detected and blocked?
- [ ] Do I know what a false positive is and why detect mode comes first?
- [ ] Can I name one managed and one self-hosted WAF?
- [ ] Can I explain how a WAF inspects HTTPS traffic and what TLS termination means?
- [ ] Do I know where a WAF should sit and why the origin must be locked down?
- [ ] Can I explain why a proxy behind a CDN shouldn't blindly reject plain HTTP, and what causes a redirect loop?
- [ ] Can I walk through the full request flow from browser to database and say which layers are public and which are private?
- [ ] Do I know what the CDN's "origin" actually points to (load balancer or reverse proxy, never the app server)?
- [ ] Can I explain what an API gateway does and how it differs from a load balancer, a reverse proxy, and a WAF?

---

## 15. Interview-style questions

1. Why isn't a network firewall enough to protect a web application?
2. What is virtual patching?
3. How would you roll out a WAF on a live production site without breaking users?
4. Where does a WAF sit relative to a CDN and load balancer?
5. Why should a database never be directly reachable from the internet?
6. How can a WAF inspect HTTPS traffic, and what are the security trade-offs of terminating TLS there?
7. Where would you place a WAF, and how do you stop attackers from bypassing it by hitting the origin directly?
8. Your site behind a CDN shows a redirect loop after you add an HTTP-to-HTTPS redirect on Nginx. What is the likely cause and fix?
9. Walk through the full request path for a production web app protected by a WAF, and explain where each security control sits.
10. What should a CDN's origin point to, and why not straight at the app server?
11. What does an API gateway do that a reverse proxy doesn't, and when would you skip one?
12. Why should services still authorize requests even if the API gateway already validated the token?
