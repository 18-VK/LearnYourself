# Backend Developer Roadmap: Beginner to Advanced

Oct 24, 2026 · @Aman Kumar

This roadmap merges three earlier versions into one path: learn HTTP, SQL and REST first, then build real systems, then learn to keep them fast and reliable at scale.

## Beginner: the foundations

These eight topics are the base for everything else; learn HTTP, SQL and REST especially well.

- **Programming language fundamentals**: pick one language (C#, Java, Go, Node or Python). Cover OOP, collections, async/await, error handling, LINQ or the equivalent, and Big-O at a working level.
- **How the web works**: what happens when you type a URL; HTTP/HTTPS, methods, status codes, headers, cookies, DNS, TCP/IP (TCP vs UDP, ports), and TLS basics.
- **Building a first backend**: a web server is a program listening on a port. Learn routing, middleware, and configuration through environment variables (never hardcode secrets).
- **REST API design**: resource naming, idempotency, pagination, filtering, versioning, validation, and consistent error responses.
- **Relational databases and SQL**: joins, GROUP BY, subqueries, normalization, primary and foreign keys, constraints, views, stored procedures, and transactions.
- **Git and GitHub**: commits, branching, pull requests, merge vs. rebase, resolving conflicts.
- **Authentication basics**: authentication vs. authorization, password hashing (bcrypt/Argon2), sessions vs. tokens, JWT.
- **Debugging, logging and Linux**: structured logging, reading stack traces, using a debugger; processes, file permissions, environment variables, ssh.

## Intermediate: building real systems

This level covers what you need to build and ship production-grade APIs.

- **Authorization**: RBAC, claims and policy-based access, OAuth2, OpenID Connect, refresh tokens.
- **ORMs and data access**: EF Core or Dapper, migrations, N+1 problems, change tracking, raw SQL vs. ORM tradeoffs.
- **Database design and performance**: indexes (clustered, non-clustered, covering), execution plans, query tuning, isolation levels, deadlocks, optimistic vs. pessimistic concurrency.
- **Caching**: in-memory vs. distributed (`IMemoryCache` vs. `IDistributedCache`, Redis), cache-aside, write-through, write-behind, TTLs, invalidation, cache stampede.
- **Architecture and patterns**: layered and Clean Architecture, SOLID, Repository, Unit of Work, CQRS, DDD basics, dependency injection; monolith vs. microservices trade-offs.
- **Testing**: unit, integration and contract tests, mocking, test containers, TDD basics.
- **Background jobs**: Hangfire, Quartz, hosted services, retry policies.
- **Messaging basics**: queues vs. topics, RabbitMQ, Azure Service Bus, Kafka basics, why queues decouple slow work from the request.
- **Containers and CI/CD**: Docker, Docker Compose, GitHub Actions pipelines, environment configuration, secrets management.
- **API documentation and tooling**: OpenAPI/Swagger, Postman, API gateways.
- **Security fundamentals**: OWASP Top 10, SQL injection, XSS, CSRF, CORS, IDOR, rate limiting, input validation.
- **NoSQL**: document stores (MongoDB) and key-value stores (Redis), and when to choose them over SQL.
- **Reverse proxy and load balancing hands-on**: Nginx `upstream` and `proxy_pass`, forwarded headers, TLS termination, L4 vs. L7, health checks, and why sticky sessions fight stateless API design.

## Advanced: scale, reliability and design

This level is about keeping systems correct, fast and observable as they grow across services and teams.

- **Distributed systems theory**: CAP theorem, consistency models, eventual consistency, idempotency, at-least-once vs. exactly-once delivery.
- **Microservices**: service boundaries, communication (REST, gRPC, messaging), API gateways (Ocelot, YARP, Kong), service discovery, BFF pattern, modular monolith as the alternative.
- **Distributed patterns**: Saga, Outbox, event sourcing, circuit breaker, retry with backoff, bulkhead (Polly in .NET), distributed locking.
- **Event-driven architecture**: Kafka internals, partitions, consumer groups, schema evolution, dead-letter queues.
- **Scaling databases**: replication, read replicas, sharding, partitioning, connection pooling, CQRS read models, when to denormalize.
- **Performance engineering**: profiling, memory and GC behavior, thread pool starvation, sync-over-async deadlocks, load testing (k6, JMeter), p95/p99 latency.
- **Observability**: logs, metrics and traces; OpenTelemetry, Prometheus, Grafana, Serilog with Seq or ELK, correlation IDs, alerting and SLOs.
- **Cloud and infrastructure**: Azure/AWS core services, Kubernetes (pods, services, ingress), Helm, Infrastructure as Code (Terraform, Bicep), blue-green and canary deployments.
- **System design**: load balancers, CDNs, edge vs. app-level rate limiters, URL shortener, notification system, high availability and fault tolerance.
- **Advanced API topics**: GraphQL, gRPC, WebSockets/SignalR, webhooks, versioning strategies.
- **Security at scale**: zero trust, secrets rotation (Key Vault, Vault), mTLS, audit logging, encryption at rest and in transit, GDPR basics.
- **Engineering practices**: ADRs, code reviews, technical debt management, mentoring, estimating and scoping.

## The request lifecycle

The intermediate and advanced topics all map onto this path. For each hop, know why it exists and what breaks without it.

&#91;embedded content: request lifecycle · 12 components\]

A request crosses the edge, load balancer, gateway and proxy before reaching your app, which then reads from the cache, the database or a queue.

## Learning order

Follow this sequence so each step rests on the one before it, and build one project alongside rather than finishing all theory first.

1. HTTP, SQL and REST, since everything builds on them
2. A first backend with a real database, then Git and basic auth
3. Authorization, caching (Redis) and testing
4. Docker and CI/CD
5. Messaging, background processing, and Nginx plus a load balancer hands-on
6. Security hardening (OWASP) and observability once several moving parts exist
7. Distributed patterns, Kubernetes and cloud
8. System design practice as the capstone

Evolve one project over time: ship a small CRUD API first, add a database, containerize it, add auth, deploy it somewhere real, and only then layer in caching, queues and the request-path components above.

## Practice projects

One project per level; the intermediate and advanced ones extend the same codebase where possible.

| Level | Project | What it exercises |
| --- | --- | --- |
| Beginner | CRUD API with auth | HTTP, REST, SQL, JWT, Git |
| Intermediate | E-commerce API with caching, background jobs and tests; Nginx in front of two containerized instances | Redis, queues, EF Core, Docker, CI/CD, load balancing |
| Advanced | Small microservices system with an event bus, an outbox, tracing and Kubernetes deployment | Saga/Outbox, Kafka or RabbitMQ, OpenTelemetry, Kubernetes |
