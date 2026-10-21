# Backend Developer Roadmap — Complete Beginner to Job-Ready

This roadmap assumes zero prior backend experience. It's organized in stages — do them roughly in order, since later stages lean on earlier ones. The request-flow diagram you shared (browser → DNS → firewall/CDN → load balancer → gateway → reverse proxy → app server → cache/DB/queue → response) maps onto Stage 4 onward, so keep it as a reference point once you get there.

---

## Stage 0 — Programming Foundations

- Pick one language and get genuinely comfortable in it (C#, Python, Java, JS/Node, or Go are all fine choices — pick based on the job market you're targeting)
- Core programming concepts: variables, control flow, functions, data structures (arrays, lists, maps/dictionaries, sets)
- Object-Oriented Programming: classes, inheritance, interfaces, polymorphism, encapsulation
- Basic algorithmic thinking: sorting, searching, recursion, time/space complexity (Big-O) — not competitive-programming depth, just enough to reason about performance
- Version control: Git — commits, branches, merges, resolving conflicts, pull requests

## Stage 1 — How the Internet Actually Works

- What happens when you type a URL and hit enter (this is the single best mental model to build early)
- HTTP: methods (GET/POST/PUT/DELETE/PATCH), status codes, headers, request/response structure
- TCP/IP basics: what a "connection" is, ports, why TCP vs UDP matters
- DNS: domain → IP resolution
- HTTPS/TLS: why encryption exists at this layer, certificates at a conceptual level

## Stage 2 — Building Your First Backend

- What a web server actually is (a program that listens on a port and responds to HTTP requests)
- Pick a framework and build small things: ASP.NET Core (since you're targeting .NET), Express (Node), Django/Flask (Python), or Spring Boot (Java)
- Routing, request/response handling, middleware/pipeline concept
- Environment variables and configuration — never hardcode secrets
- Basic project: a CRUD API for something simple (a to-do list, a notes app)

## Stage 3 — Databases

- Relational databases: tables, rows, columns, primary/foreign keys
- SQL fundamentals: SELECT, JOIN, WHERE, GROUP BY, aggregate functions
- Normalization — why you split data into related tables instead of one giant table
- An ORM (Object-Relational Mapper) for your language — e.g. Entity Framework Core for .NET — and how it maps objects to tables
- Transactions and why they matter (all-or-nothing operations)
- NoSQL basics — document stores (MongoDB) vs relational, and when each makes sense

## Stage 4 — The Request Lifecycle (your diagram)

This is where the flow you shared comes in — now that you understand HTTP and have a backend running, learn what sits *around* it in production:

- **DNS Resolution** — already covered in Stage 1, revisit in context of production domains
- **Firewall** — network-level vs application-level (WAF) filtering
- **CDN** — caching static assets at edge locations close to users
- **Load Balancer** — distributing traffic across multiple servers; algorithms like round robin; why apps need to be stateless to work behind one
- **API Gateway** — a single entry point that handles routing, auth checks, and rate limiting before requests reach your services
- **Reverse Proxy (Nginx)** — sits in front of your app server, handles TLS termination, forwards requests — learn basic Nginx config
- **Application Server** — your own code; learn why raw dev servers (like Kestrel in .NET) aren't meant to face the internet directly
- **Cache (Redis)** — storing frequently-read data in memory so you don't hit the database every time; cache invalidation strategies
- **Database** — covered in Stage 3, now think about it as one component in a larger system
- **Message Queue (Kafka/RabbitMQ)** — decoupling slow or non-urgent work (like sending emails) from the main request/response cycle

## Stage 5 — Authentication & Security

- Authentication vs authorization — know the difference cold
- Password hashing (never store plaintext — bcrypt/Argon2)
- Sessions vs tokens (JWT) — how each works, trade-offs
- OAuth 2.0 / OpenID Connect — the standard flows for "log in with Google" style auth, and API-to-API auth
- Common vulnerabilities: SQL injection, XSS, CSRF, IDOR (accessing another user's data by guessing an ID) — and how to prevent each
- HTTPS everywhere, secrets management (never commit API keys)

## Stage 6 — APIs Beyond Basic REST

- REST conventions done properly (resource naming, status codes, pagination)
- API versioning strategies
- GraphQL — what problem it solves versus REST
- Webhooks — how services notify each other of events

## Stage 7 — Testing

- Unit tests — testing one function/class in isolation
- Integration tests — testing how components work together (e.g., API + real database)
- Mocking dependencies
- Test-driven development (TDD) as a discipline, even if you don't always practice it strictly

## Stage 8 — Architecture & Design

- Layered architecture (controllers → services → repositories → database)
- Clean Architecture / Hexagonal Architecture — separating business logic from frameworks and infrastructure
- Design patterns as they naturally show up: Repository, Unit of Work, Dependency Injection
- SOLID principles
- Monolith vs microservices — understand trade-offs before jumping to microservices (most projects should start as a monolith)

## Stage 9 — DevOps & Deployment

- Docker: containerizing your app so it runs the same everywhere
- CI/CD basics: automatically testing and deploying code on every commit (GitHub Actions is a good starting point)
- Cloud basics: what a VM, a managed database, and object storage are (pick one provider — AWS, Azure, or GCP — to start)
- Logging and monitoring: knowing when something breaks in production before a user tells you

## Stage 10 — System Design (once comfortable with everything above)

- Horizontal vs vertical scaling
- Caching strategies at scale
- Database indexing, query optimization, read replicas
- CAP theorem and consistency trade-offs
- Designing for failure: retries, timeouts, circuit breakers
- Practice: design common systems (URL shortener, rate limiter, chat app) — this is standard senior/interview-level practice

---

## How to actually use this

Don't try to learn all of this linearly before building anything. The pattern that works:

1. Build a small project as soon as you finish Stage 2
2. Add a real database (Stage 3) to that same project
3. Containerize it (pull forward part of Stage 9)
4. Add auth (Stage 5)
5. Deploy it somewhere real, even a free tier
6. Only then start layering in caching, queues, and the production-flow concepts from Stage 4

One project, evolved over time, teaches this better than ten small disconnected tutorials.
