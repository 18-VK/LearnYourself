# Database Design Roadmap — For Any System

A step-by-step process for designing a database, from a blank page to something that scales. This applies whether it's a to-do app or a multi-tenant SaaS platform — the depth you go into each stage just scales with the system's complexity.

---

## Stage 1 — Understand the Domain Before Touching a Schema

- Identify the core entities: the "nouns" of the system (User, Order, Product, Task, etc.)
- Identify the relationships between them: one-to-one, one-to-many, many-to-many
- Identify the actions/verbs that will happen to this data — this hints at what needs to be fast (reads vs writes) and what needs to be consistent
- Write down actual business rules in plain language before modeling anything: "A user can have many tasks, a task belongs to exactly one user, a task can have zero or more tags"

**Common mistake:** jumping straight to tables before this step. Half of bad schemas come from not understanding the domain first.

## Stage 2 — Conceptual Modeling (Entity-Relationship Diagram)

- Draw an ER diagram: entities as boxes, relationships as connecting lines, cardinality noted (1:1, 1:N, N:M)
- Identify primary keys for each entity (natural key vs surrogate key — usually prefer surrogate/auto-generated IDs)
- Identify foreign keys implied by the relationships
- Resolve many-to-many relationships into junction/bridge tables (e.g., Tasks ↔ Tags becomes Tasks, Tags, and a TaskTags join table)

## Stage 3 — Normalization

- **1NF**: no repeating groups, atomic values in each column (no comma-separated lists in a single field)
- **2NF**: no partial dependency on a composite key (every non-key column depends on the *whole* primary key)
- **3NF**: no transitive dependency (non-key columns depend only on the key, not on other non-key columns)
- Know these well enough to explain *why* each rule prevents a specific kind of data anomaly (update, insert, delete anomalies)
- Understand that normalization reduces redundancy but can increase the number of JOINs — this trade-off matters later

## Stage 4 — Deliberate Denormalization (when it's justified)

- Learn when to break normalization on purpose: read-heavy systems, reporting/analytics tables, caching computed values
- Techniques: storing a computed total instead of recalculating via JOIN every time, duplicating a rarely-changing field to avoid a join on a hot path
- The rule of thumb: normalize by default, denormalize deliberately and document why

## Stage 5 — Choosing Data Types & Constraints

- Pick the narrowest correct data type for each column (don't store everything as string/varchar)
- `NOT NULL` where a value must always exist
- `UNIQUE` constraints for things like emails or usernames
- `CHECK` constraints for value ranges/valid states (e.g., status must be one of a fixed set)
- Default values where appropriate
- Think about nullable foreign keys carefully — they usually mean "this relationship is optional," make sure that's actually true

## Stage 6 — Keys & Relationships in Depth

- Primary key strategy: auto-increment integers vs UUIDs vs composite keys — trade-offs (UUIDs are great for distributed systems, worse for index locality/performance)
- Foreign key constraints and `ON DELETE`/`ON UPDATE` behavior: `CASCADE`, `SET NULL`, `RESTRICT` — pick deliberately per relationship, not by default
- Self-referencing relationships (e.g., a Category that has a parent Category) — recursive structures

## Stage 7 — Indexing Strategy

- Understand what an index actually is (a sorted structure that trades write speed/storage for read speed)
- Index every foreign key that you'll query or join on
- Index columns used in `WHERE`, `ORDER BY`, and `JOIN` clauses frequently
- Composite indexes and column order — the order matters based on query patterns
- Covering indexes — when an index alone can satisfy a query without touching the table
- Know the cost: every index slows down writes and takes storage — don't index everything blindly

## Stage 8 — Query Patterns Drive Design

- Design the schema around how data will actually be *read*, not just how it's conceptually structured
- Identify your system's hot paths: which queries run constantly, which run rarely
- For hot paths, consider: do you need a denormalized view, a materialized view, or a cache layer instead of a raw JOIN every time?
- Write out your top 5–10 expected queries before finalizing the schema — this catches design mistakes early

## Stage 9 — Transactions & Consistency

- ACID properties: Atomicity, Consistency, Isolation, Durability
- Isolation levels: Read Uncommitted, Read Committed, Repeatable Read, Serializable — know the anomalies each one prevents (dirty reads, non-repeatable reads, phantom reads)
- Optimistic vs pessimistic concurrency control (row versioning vs row locking) — relevant any time multiple users can edit the same record
- Where transactions boundaries should sit — usually one business operation, not one database call

## Stage 10 — Scaling Considerations

- Read replicas — offloading read traffic from the primary database
- Connection pooling — why opening a new DB connection per request is expensive
- Partitioning/sharding — splitting a large table across multiple physical stores, and the complexity this adds (cross-shard joins become hard)
- Vertical vs horizontal scaling trade-offs for databases specifically

## Stage 11 — When NOT to Use a Relational Database

- Document stores (MongoDB) — flexible/evolving schemas, nested data that doesn't need joins
- Key-value stores (Redis) — caching, session storage, leaderboards
- Wide-column stores (Cassandra) — massive write throughput, time-series-like data
- Graph databases (Neo4j) — deeply relational data where the relationships *are* the point (social networks, recommendation engines)
- Know this isn't "NoSQL is for scale" — it's about matching the data's natural shape and access pattern to the storage model

## Stage 12 — Migrations & Evolution

- Schema migrations as versioned, reviewable code (EF Core Migrations, Flyway, Liquibase, etc.)
- Never modify a migration that's already been applied to a shared environment — always add a new one
- Backward-compatible migration strategy for zero-downtime deploys: add new column nullable → backfill → make it required in a later migration, rather than one breaking change
- Rollback strategy — know how you'd undo a bad migration before you need to

---

## A Practical Design Checklist (run this on any new schema)

1. Have I listed every entity and its relationships in plain language?
2. Is every table in at least 3NF, with denormalization only where deliberate and documented?
3. Does every foreign key have a defined `ON DELETE` behavior?
4. Are my primary keys and foreign keys indexed?
5. Have I written out the top queries this schema needs to serve, and do they perform well against this design?
6. Are my constraints (`NOT NULL`, `UNIQUE`, `CHECK`) enforcing the business rules I wrote in Stage 1?
7. Do I have a migration path if this schema needs to change later?

If you can answer yes to all seven, the design is solid enough to build on.

# For actual hands-on practice, a few stand out consistently:

### SQLZoo –
free, browser-based, great for absolute fundamentals (SELECT, JOIN, subqueries) with instant feedback.

### SQLBolt –
short interactive lessons, good if you want theory + practice together rather than pure problem-solving.

### LeetCode (SQL section) –
best if you're also prepping for interviews; problems mirror what companies actually ask, and many have company tags.

### HackerRank (SQL track) –
similar to LeetCode but with a gentler difficulty curve early on, plus a certification if you want something to show.

### StrataScratch / DataLemur –
built specifically around real interview questions from companies (data analyst/backend-adjacent roles), good once you're past basics.

### Mode Analytics SQL Tutorial –
works against real, messy datasets rather than toy tables, useful for learning query patterns you'll actually hit in production.


Online platforms are a good fit if you want to jump straight into writing queries without setting up a local database, while local environments like MySQL or PostgreSQL give you more control and 
help you understand what's happening under the hood. Worth doing both eventually — practice online first, then spin up Postgres locally (ties in with the DB design roadmap) so you can actually 
run EXPLAIN ANALYZE and see query plans, not just get a green checkmark