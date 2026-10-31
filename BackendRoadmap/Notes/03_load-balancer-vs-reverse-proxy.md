# Load Balancer vs Reverse Proxy: Study Notes

## 1. The question

If I already have a reverse proxy like Nginx, why would I also need a load balancer?

**Short answer:** often you don't. A reverse proxy can also load balance, and many small setups use one tool for both jobs. A dedicated load balancer earns its place when scale and reliability requirements grow.

---

## 2. What each one is for

### Reverse proxy
Sits in front of your app and handles:
- TLS termination
- Compression
- Caching and static files
- Header rewriting
- Forwarding requests to the app
- Hiding the app server from the internet

### Load balancer
Sits in front of multiple servers and handles:
- Spreading incoming traffic across servers
- Health checks
- Removing failed servers from rotation
- Failover across zones or regions (managed cloud versions)

### They overlap
Nginx, HAProxy, and Envoy can do both jobs. Cloud load balancers (AWS ALB, Azure Application Gateway, GCP HTTP(S) Load Balancing) also do reverse-proxy work such as TLS termination and path-based routing. The names describe *roles*, and one tool can fill several roles.

---

## 3. When one reverse proxy is enough

With one server, or a few servers behind a single Nginx, an `upstream` block gives you load balancing too:

```nginx
upstream app_servers {
    server 10.0.0.11:5000;
    server 10.0.0.12:5000;
    server 10.0.0.13:5000;
}

server {
    listen 443 ssl;
    server_name example.com;

    location / {
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

```
Client -> Nginx (reverse proxy + load balancing) -> App server 1, 2, 3
```

---

## 4. When you need a separate load balancer

1. **The proxy is a single point of failure.** If your one Nginx dies, the site is down. A load balancer spreads traffic across several proxy instances.
2. **One proxy can't handle the traffic.** At high volume you need multiple proxy instances, and something has to distribute traffic between them.
3. **Multiple availability zones or regions.** Cloud load balancers distribute across zones and fail over automatically.
4. **Auto scaling.** Cloud load balancers integrate with scaling groups, so new instances are registered and removed ones are drained without editing config.
5. **Managed reliability.** The provider handles patching, capacity, failover, health checks, and metrics.

---

## 5. Typical layered setup

```
Client -> Load balancer -> Reverse proxy (Nginx) x2-3 -> App servers x N
```

The load balancer keeps the proxy tier highly available. Each proxy handles TLS, caching, and routing close to the app.

---

## 6. Comparison

| | Reverse proxy | Load balancer |
|---|---|---|
| Main job | Front the app: TLS, caching, routing, hiding servers | Distribute traffic across servers |
| Health checks and failover | Basic (open-source Nginx) | Built in, core feature |
| Needed with one server | Yes, still useful | No |
| Needed for high availability | Not enough alone | Yes |
| Examples | Nginx, Apache, Caddy, Traefik | AWS ALB/NLB, Azure Load Balancer, HAProxy, Envoy |

---

## 7. Why a load balancer can't always replace a reverse proxy

A load balancer **can** replace a reverse proxy in some setups, but not in all. It depends on the layer the load balancer works at and on what you need in front of your app.

### Naming the layers

These numbers come from the OSI model:

- **Layer 4 = transport layer.** Works with IPs, ports, and TCP/UDP connections. It doesn't understand HTTP.
- **Layer 7 = application layer.** Works with HTTP/HTTPS: URLs, headers, cookies, methods. It understands requests.

A reverse proxy always works at layer 7 (application layer). A load balancer may work at layer 4 (transport layer) or layer 7 (application layer).

### Detailed comparison

| | Layer 4 load balancer (transport layer) | Layer 7 load balancer (application layer) | Reverse proxy (layer 7, application layer) |
|---|---|---|---|
| Main goal | Spread TCP/UDP connections across servers | Spread HTTP requests across servers | Front door for an app: handle, shape, protect requests |
| Understands HTTP | No | Yes | Yes |
| Route by URL path or host | No | Yes | Yes |
| TLS termination | Usually passes through | Yes | Yes |
| Health checks and failover | Core feature | Core feature | Basic (open-source Nginx) |
| Scaling and multi-zone | Built in (managed) | Built in (managed) | You build it yourself |
| Serve static files | No | No | Yes |
| Response caching and compression | No | Rarely | Yes |
| Rewrites, redirects, custom headers | No | Limited | Full control |
| Buffer slow clients | No | Limited | Yes |
| Per-route timeouts, upload limits, rate limits | No | Limited | Fine-grained |
| Examples | AWS NLB, Azure Load Balancer | AWS ALB, Azure Application Gateway, GCP HTTPS LB | Nginx, Apache, Caddy, Traefik |

### Why a load balancer often can't replace a reverse proxy

1. **A layer 4 load balancer doesn't understand HTTP.** It forwards TCP connections and can't route by path, rewrite headers, redirect, or inspect requests. It can't act as a reverse proxy at all.
2. **Static files, compression, and caching.** Nginx can serve a `/static` folder from disk, gzip responses, and cache them. A load balancer can't, so every request would hit your app.
3. **Slow client buffering.** App servers like Kestrel, Gunicorn, or Node tie up a worker while a slow client uploads or downloads. A reverse proxy absorbs the slow connection and hands the request over fast. Most load balancers don't buffer this way.
4. **Fine-grained control.** Rewrites, per-route timeouts, upload size limits, custom error pages, basic auth on an admin path, and local rate limiting are far richer in Nginx config.
5. **Local protection of the app.** The proxy sits next to the app and can talk to it over localhost or a unix socket, so the app doesn't need a public network port.
6. **Inspection add-ons.** Modules such as ModSecurity run in the proxy, not in a typical load balancer.
7. **Different jobs.** A load balancer decides *which server* gets the request. A reverse proxy decides *how the request is handled* on the way to the app.

### When a load balancer can replace the proxy

A layer 7 (application layer) managed load balancer already does TLS termination, path and host routing, redirects, and WAF integration. It can replace Nginx when:

- you run on the cloud and don't need static file serving, caching, or heavy rewrites,
- the app server is production-grade and safe to sit directly behind a load balancer (or runs in containers),
- or you use Kubernetes, where the ingress controller (often Nginx or Envoy) plays the reverse proxy role anyway.

### Rule of thumb

- **Small project or single server:** reverse proxy only. It can also do the load balancing.
- **Cloud app with simple needs:** a layer 7 load balancer may be enough.
- **Production with uptime and control needs:** load balancer in front for availability, reverse proxy behind it for control (the layered setup in section 5).

---

## 8. Load balancing algorithms

| Algorithm | How it works | Good for |
|---|---|---|
| Round robin | Sends requests to servers in turn | Equal servers, similar request cost |
| Weighted round robin | Gives stronger servers a larger share | Mixed server sizes |
| Least connections | Sends to the server with fewest active connections | Long-lived or uneven requests |
| IP hash | Same client IP maps to the same server | Simple session stickiness |
| Least response time | Prefers the fastest-responding server | Latency-sensitive apps |

---

## 9. Layer 4 vs Layer 7 load balancing

Layer 4 is the **transport layer** (TCP/UDP). Layer 7 is the **application layer** (HTTP/HTTPS).


| | Layer 4 (transport layer) | Layer 7 (application layer) |
|---|---|---|
| Looks at | IP, port, TCP/UDP | HTTP: URL, headers, cookies |
| Speed | Faster, lower overhead | Slightly slower, more capable |
| Can route by path or host | No | Yes (`/api` to one pool, `/static` to another) |
| Can terminate TLS | Usually passes through | Yes |
| Examples | AWS NLB | AWS ALB, Nginx, HAProxy (HTTP mode) |

---

## 10. Why apps must be stateless behind a load balancer

Consecutive requests from one user may land on different servers. If a server keeps session data in its own memory, the next request may not find it.

Fixes:
- Store sessions in a shared store such as Redis or in the database
- Use signed tokens (for example JWT) so any server can validate the user
- Use sticky sessions only as a fallback, since they reduce balance and make failover harder
- Keep uploaded files in shared storage such as object storage, not on one server's disk

---

## 11. Health checks

The load balancer regularly calls an endpoint (for example `GET /health`) on each server.

- Healthy servers receive traffic
- Failing servers are removed from rotation automatically
- Recovered servers are added back

Good practice: make the health endpoint cheap, and have it confirm real dependencies only when appropriate. A health check that fails whenever the database blips can take every server out at once.

---

## 12. Pros and cons

### Using a reverse proxy only (Nginx handles both roles)
**Pros**
- Simple, one tool, low cost
- Full control over config
- Good enough for small and medium apps

**Cons**
- The proxy itself is a single point of failure unless you run several
- You manage scaling, patching, and failover
- Open-source Nginx health checks are basic

### Adding a dedicated or managed load balancer
**Pros**
- High availability across servers and zones
- Auto scaling integration and built-in health checks
- Provider handles capacity and failover

**Cons**
- Extra cost and one more component to understand
- Another hop, adding a little latency
- Cloud-specific features can cause vendor lock-in

---

## 13. Rule of thumb

- **One server, small project:** Nginx alone is fine.
- **Several app servers on one network:** Nginx as proxy and load balancer works well.
- **Production with uptime requirements:** put a load balancer in front so no single component is a point of failure. On the cloud this is usually a managed one.

---

## 14. Quick revision checklist

- [ ] Can I explain the difference between a reverse proxy and a load balancer in one sentence?
- [ ] Do I know why they overlap and when one tool can do both?
- [ ] Can I name three situations that justify a dedicated load balancer?
- [ ] Can I describe round robin and least connections?
- [ ] Do I know the difference between layer 4 (transport layer) and layer 7 (application layer) load balancing?
- [ ] Can I list at least four reasons a load balancer can't always replace a reverse proxy, and when it can?
- [ ] Can I explain why apps must be stateless behind a load balancer?
- [ ] Do I know what a health check does?

---

## 15. Interview-style questions

1. What is the difference between a reverse proxy and a load balancer?
2. Can Nginx act as a load balancer? How?
3. Why is a single Nginx instance a single point of failure, and how would you fix that?
4. When would you pick a layer 4 (transport layer) load balancer over layer 7 (application layer)?
5. What breaks if your app stores sessions in server memory behind a load balancer?
6. How do health checks prevent users from hitting a dead server?
7. Why can't a layer 4 load balancer replace Nginx as a reverse proxy, and when can a layer 7 load balancer replace it?
