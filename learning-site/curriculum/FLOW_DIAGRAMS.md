# Flow diagrams: ASCII inventory

Every fenced code block in a lesson that looks like a flow diagram (arrows such as `▼ ↓ │ -> → =>`, boxes
drawn with `┌─┐` or `+--+`, numbered pipelines) was reviewed. A block is **converted** when it shows boxes or
steps joined by arrows: it becomes an animated `FlowDiagram` placed with `diagram: <id>` and
`at: { section, codeBlock }`, and the original ASCII stays on the page behind the "Show text version" toggle.
Folder trees, URLs, HTTP examples, console output, formulas and code stay as code blocks, as do the other
cases listed below with the reason.

How the conversions stay faithful:
- Diagram data lives in `src/viz/flow/diagrams/<id>.ts`. Labels are copied from the ASCII, never reworded.
- `tests/unit/flow/diagrams.test.ts` reads each note, finds the wrapped block and fails if any node label, extra
  line or arrow label is not in that block, if a chain's boxes are out of order, or if the placement and the
  diagram's `source` disagree. It also checks that every edge and step refers to real nodes and edges.
- Narration is built from the same labels. The four diagrams that existed in the curriculum plan
  (`aspnet-architecture`, `auth-three-parties`, `mvvm-layers`, `sql-server-hierarchy`) quote the note text
  around the diagram instead.

How the search was done: all 2311 fenced blocks in the lessons were scanned for arrow and box-drawing
characters (138 candidates), and every `text`/unlabelled block without them was read for numbered pipelines
and step lists (3 more). Blocks in other languages (C#, SQL, JSON, XML, HTTP, shell) were only flagged when they
contained box-drawing characters or `▼ ↓`; none did.

**Totals: 61 converted, 80 left as code.**

Judgement calls, so they can be revisited:
- `mvvm-layers`: the ASCII's vertical arrow starts under the gap between View and ViewModel. It is drawn from
  ViewModel, because the bullets under the diagram say the View never talks to the Model directly.
- `auth-three-parties`: the ASCII has no Client ↔ Resource API arrow, so the step "Client calls Resource API"
  highlights both boxes rather than adding an arrow.
- `openiddict-architecture`: "Generates Tokens" is written once on the stem that splits into Access Token and
  ID Token; both branches carry the label, drawn on the shared stem.
- `cte-join-steps` and `rs256-end-to-end`: numbered lists ("Step 1 → …", "1. … 2. …") drawn as a chain in
  their numbered order.
- `wpf-app-lifecycle`: the `├─` sub-items under OnStartup and OnExit are lines inside those boxes.
- `jwks-public-keys`: lines with no arrow between them (Auth Server / Private Key, API downloads / Public Key)
  share a box; "Signs JWT", written between two `│`, is the arrow's label.
- Actor → action lists ("Client → calls API with token", "Auth Server → validates identity") are left as code:
  their arrows mean "does", and drawing them as boxes would reinterpret the note.

## Converted

| Lesson | Section | Block | Diagram |
|---|---|---|---|
| `phase-1/getting-started/dotnet-cli` | ### Industry CI/CD Publish Flow | 1 | `cicd-publish-flow` |
| `phase-1/advanced-csharp/records-equality-partial` | ## How Lookup Works | 2 | `dictionary-lookup` |
| `phase-1/ef-core/ef-core-indexes-tracking-bulk-concurrency` | ## If you want real optimistic concurrency | 1 | `optimistic-concurrency-flow` |
| `phase-1/ef-core/ef-core-indexes-tracking-bulk-concurrency` | ### Microsoft's Recommended Pattern | 1 | `concurrency-conflict-pattern` |
| `phase-1/ef-core/ef-core-migrations-and-scaffolding` | ## 4. Production Deployment Flow | 1 | `migration-deployment-flow` |
| `phase-1/ef-core/ef-core-migrations-and-scaffolding` | ## Production Workflow | 1 | `migration-production-workflow` |
| `phase-1/dapper-patterns-logging/repository-pattern` | ## Repository pattern structure | 1 | `repository-pattern-layers` |
| `desktop/mvvm/mvvm` | # MVVM in WPF | 1 | `mvvm-layers` |
| `desktop/mvvm/commands` | ## 7️⃣ What happens internally (important) | 1 | `requery-suggested-flow` |
| `desktop/mvvm/real-mvvm-example` | ## 6️⃣ Flow (How data moves) | 1 | `mvvm-data-flow` |
| `desktop/mvvm/real-mvvm-example` | ## 6️⃣ Flow (How data moves) | 2 | `mvvm-command-chain` |
| `desktop/mvvm/project-example-with-commands` | # Flow summary | 1 | `relaycommand-flow-summary` |
| `desktop/mvvm/dialog-service-and-message-bus` | ### 1. Introduce an interface | 2 | `dialog-service-layers` |
| `desktop/real-app-architecture/real-app-setup` | # Example | 1 | `wpf-app-lifecycle` |
| `desktop/real-app-architecture/window-shell-pattern` | ## What Dependency Properties fix | 1 | `dependency-property-flow` |
| `desktop/real-app-architecture/app-state-and-communication` | ## 🧩 Real flow example | 1 | `selection-state-flow` |
| `desktop/real-app-architecture/app-state-and-communication` | ## 4️⃣ What actually happens at runtime | 1 | `appstate-runtime-flow` |
| `desktop/capstone-taskflow-studio/taskflow-studio` | # This is a classic autosave problem | 1 | `autosave-flow` |
| `phase-2/foundations/aspnet-core-overview` | ## ASP .Net Architecture | 1 | `aspnet-architecture` |
| `phase-2/foundations/aspnet-core-overview` | ### 3. Middleware | 1 | `middleware-request-order` |
| `phase-2/foundations/aspnet-core-overview` | ### 6. Response Passes Through Middleware | 1 | `middleware-response-order` |
| `phase-2/foundations/aspnet-core-overview` | ## What is ASP.NET Core Web API? | 1 | `web-api-architecture` |
| `phase-2/foundations/aspnet-core-overview` | ## What is ASP.NET Core MVC? | 1 | `mvc-request-flow` |
| `phase-2/foundations/aspnet-core-overview` | ## When to Use Web API | 1 | `web-api-example` |
| `phase-2/foundations/aspnet-core-overview` | ## When to Use MVC | 1 | `mvc-example` |
| `phase-2/foundations/aspnet-core-overview` | ## Why Web API is More Popular Today | 1 | `web-api-popular` |
| `phase-2/controllers-and-routing/routing` | ### Visual Flow | 1 | `route-to-action` |
| `phase-2/controllers-and-routing/model-binding` | ## How Model Binding Works | 1 | `model-binding-flow` |
| `phase-2/calling-apis/client-calling-web-api` | ### Add retry for failure scenario | 3 | `retry-one-line` |
| `phase-2/calling-apis/client-calling-web-api` | ### Add retry for failure scenario | 6 | `retry-flow` |
| `phase-2/calling-apis/client-calling-web-api` | ## Extra | 1 | `api-client-layers` |
| `phase-2/pipeline/https-and-hsts` | # Enforce it at the hosting level too (defense in depth) | 2 | `tls-termination-chain` |
| `phase-2/auth-fundamentals/authn-and-authz-basics` | ### HTTP Basic Authentication | 1 | `basic-auth-flow` |
| `phase-2/auth-fundamentals/authn-and-authz-basics` | ### API Keys | 3 | `api-key-flow` |
| `phase-2/auth-fundamentals/authn-and-authz-basics` | #### OAuth 2.0 | 1 | `oauth-spotify-example` |
| `phase-2/auth-fundamentals/authn-and-authz-basics` | #### OAuth 2.0 | 2 | `oauth-roles` |
| `phase-2/auth-fundamentals/jwt-authentication-setup` | ### Full Runtime Flow (IMPORTANT) | 1 | `jwt-runtime-flow` |
| `phase-2/auth-fundamentals/claims-identity-and-principal` | ## How Claims Become HttpContext.User | 1 | `claims-to-httpcontext-user` |
| `phase-2/auth-fundamentals/auth-server-concepts` | ## Before any code, understand the shape of the system. There are always **3 parties**: | 1 | `auth-three-parties` |
| `phase-2/auth-fundamentals/auth-server-concepts` | ## Introduction: Auth Server | 1 | `auth-server-intro` |
| `phase-2/auth-fundamentals/auth-server-concepts` | ## Why Separate the Auth Server? | 1 | `auth-server-shared` |
| `phase-2/auth-fundamentals/identity-providers-and-oidc` | # How Auth Server, OpenIddict, OAuth 2.0, and OpenID Connect (OIDC) relate to each other | 1 | `auth-server-openiddict-oauth-oidc` |
| `phase-2/auth-server/refresh-tokens` | #### What does a refresh token contain? | 2 | `refresh-token-protect` |
| `phase-2/auth-server/usermanager-external-logins-and-2fa` | ### External logins | 3 | `external-login-lookup` |
| `phase-2/auth-server/openiddict` | ### Your Architecture | 1 | `openiddict-architecture` |
| `phase-2/auth-server/openiddict` | ### 2. JWT Creation | 1 | `jwt-creation-steps` |
| `phase-2/auth-server/openiddict` | ### 2. JWT Creation | 2 | `openiddict-jwt-generation` |
| `phase-2/auth-server/openiddict` | ### 3. Refresh Tokens | 1 | `refresh-token-timeline` |
| `phase-2/auth-server/openiddict` | ### 5. Public Keys (JWKS) | 1 | `jwks-public-keys` |
| `phase-2/auth-server/openiddict` | ### 6. Token Validation | 1 | `openiddict-token-validation` |
| `phase-2/auth-server/openiddict` | ### Why This Matters for Your API | 3 | `jwt-validation-pipeline` |
| `phase-2/auth-server/openiddict` | ### 3. Social Login (Google, Microsoft, GitHub, etc.) | 1 | `social-login-providers` |
| `phase-2/architecture/clean-architecture` | ## 🔁 Dependency Direction (Very Important) | 1 | `clean-architecture-dependencies` |
| `phase-2/architecture/clean-architecture` | ## 🔁 Flow Example | 1 | `clean-architecture-model-flow` |
| `phase-2/capstone/ef-configuration-and-automapper` | # Fluent API configurations with separate configuration class | 7 | `fluent-config-to-schema` |
| `phase-2/capstone/ef-configuration-and-automapper` | # AutoMapper : for object mapping | 5 | `automapper-flow` |
| `sql-server/setup-and-security/server-database-schema` | ## High-level logical tree (big picture) | 1 | `sql-server-hierarchy` |
| `sql-server/setup-and-security/server-database-schema` | ## Complete security flow (end-to-end) | 1 | `sql-security-flow` |
| `sql-server/setup-and-security/user-privileges-and-roles` | ## 1. What is a database user? | 1 | `login-user-permissions` |
| `sql-server/advanced-queries-and-programmability/ctes` | ## 2️⃣ JOIN / Derived Table Version | 3 | `cte-join-steps` |
| `phase-2/auth-fundamentals/creating-and-signing-jwts` | # End-to-end flow | 1 | `rs256-end-to-end` |

## Left as code

| Lesson | Section | Block | Why |
|---|---|---|---|
| `phase-1/advanced-csharp/records-equality-partial` | ## Hash Collisions | 1 | Two-line key → bucket mapping (a collision example), not a flow. |
| `phase-1/advanced-csharp/dependency-injection` | ## Scoped vs Transient | 2 | Annotated output: which Counter each service gets per request. The DiLifetimesVisualizer in this lesson animates lifetimes. |
| `phase-1/advanced-csharp/dependency-injection` | ## Scoped vs Transient | 3 | Annotated output (as above). |
| `phase-1/advanced-csharp/dependency-injection` | ## Scoped vs Transient | 4 | Annotated output (as above). |
| `phase-1/advanced-csharp/configuration` | ## 1. Default Configuration Files (What & Why) | 1 | File → purpose mapping, not a flow. |
| `phase-1/advanced-csharp/configuration` | ## 2. Create Configuration Files | 1 | Folder tree. |
| `phase-1/ef-core/ef-core-crud-and-relationships` | ## What is the Foreign Key? | 5 | One-line relationship statement (a foreign key references a key), not a flow. |
| `phase-1/ef-core/ef-core-raw-sql-iqueryable-concurrency` | ## [Timestamp] | 1 | Before/after values, not a flow. |
| `phase-1/dapper-patterns-logging/logging` | ### 4️⃣ File Sink (Rolling logs) | 2 | Folder tree (log files). |
| `desktop/mvvm/project-example-with-commands` | # Project structure | 1 | Folder tree (project structure). |
| `desktop/real-app-architecture/real-app-setup` | # Final architecture (clean mental model) | 1 | Containment tree with several roots (where settings are used), not a flow. |
| `desktop/real-app-architecture/window-shell-pattern` | ## Example | 1 | ViewModel containment tree, not a flow. |
| `desktop/real-app-architecture/window-shell-pattern` | ## Example | 2 | Folder tree (Views). |
| `desktop/real-app-architecture/app-state-and-communication` | ## What your scenario is | 1 | Window layout tree, not a flow. |
| `desktop/real-app-architecture/app-state-and-communication` | ## 🥇 Shared State / Store (MOST POPULAR) | 1 | Two-word sketch (Left → Right): nothing to step through. |
| `desktop/real-app-architecture/app-state-and-communication` | ## 🥇 Shared State / Store (MOST POPULAR) | 2 | Three-word sketch (Left → State ← Right) with no order to step through. |
| `desktop/real-app-architecture/debounce-search` | # What debouncing actually means | 1 | Keystroke → search list. The DebounceTimelineVisualizer placed in this section animates it. |
| `desktop/real-app-architecture/debounce-search` | # What debouncing actually means | 2 | One-line result. |
| `desktop/real-app-architecture/debounce-search` | ### How this works (timeline) | 1 | Three separate event groups with no arrows between them; the DebounceTimelineVisualizer in this lesson animates the same timeline. |
| `phase-2/foundations/http-headers` | ### `ETag` + `If-None-Match` | 1 | HTTP request/response example. |
| `phase-2/foundations/http-headers` | ### `Last-Modified` + `If-Modified-Since` | 1 | HTTP request/response example. |
| `phase-2/foundations/http-headers` | ### `If-Match` | 1 | HTTP request/response example. |
| `phase-2/foundations/http-headers` | ### `Access-Control-Allow-Methods` / `Access-Control-Allow-Headers` | 1 | HTTP request/response example. |
| `phase-2/foundations/http-headers` | ### `X-Total-Count` | 1 | HTTP request/response example. |
| `phase-2/controllers-and-routing/routing` | ### How Routing Maps URLs → Methods | 2 | Route values → controller mapping. |
| `phase-2/controllers-and-routing/routing` | ### 4. Important Concepts | 1 | Route value → controller mapping. |
| `phase-2/controllers-and-routing/routing` | ### 4. Important Concepts | 2 | URL → action mapping. |
| `phase-2/controllers-and-routing/routing` | ### 4. Important Concepts | 6 | URL → validity examples. |
| `phase-2/controllers-and-routing/routing` | ## Final Mental Model | 1 | Code → meaning glossary. |
| `phase-2/controllers-and-routing/model-validation` | # ASP - Model validation | 1 | One-line sentence where the arrows mean "does" (Client → sends data → …), not a diagram of boxes. |
| `phase-2/controllers-and-routing/project-setup` | # Recommended folder structure : Web API | 1 | Folder tree. |
| `phase-2/calling-apis/client-calling-web-api` | ### Project Structure (Production Ready) | 1 | Folder tree. |
| `phase-2/calling-apis/client-calling-web-api` | ### Add retry for failure scenario | 7 | Call log with status codes (console-style output). |
| `phase-2/pipeline/middleware` | ## How middleware works internally | 1 | Already wrapped by MiddlewarePipelineVisualizer (in-and-out scenario). |
| `phase-2/pipeline/global-exception-handling` | ### Step-by-step execution | 1 | Two-item mapping. |
| `phase-2/pipeline/global-exception-handling` | ### HttpContext | 1 | One-line sentence where the arrows mean "does". |
| `phase-2/pipeline/global-exception-handling` | ## Full Execution Flow | 1 | Already wrapped by ProblemDetailsVisualizer. |
| `phase-2/auth-fundamentals/jwt-authentication-setup` | ### How Validation Happens (RUNTIME FLOW) | 3 | Formula. |
| `phase-2/auth-fundamentals/jwt-authentication-setup` | ### How Validation Happens (RUNTIME FLOW) | 4 | Formula. |
| `phase-2/auth-fundamentals/claims-identity-and-principal` | ## So the hierarchy is: | 1 | Object containment hierarchy (ClaimsPrincipal → identities → claims), not a flow. |
| `phase-2/auth-fundamentals/auth-server-concepts` | ## How the token is created | 1 | Actor → action list: each arrow means "does", so drawing boxes would reinterpret it. |
| `phase-2/auth-fundamentals/auth-server-concepts` | ### ✅ Option 1: Same API handles Auth + Tokens (Beginner / Small apps) | 1 | Actor → action list. |
| `phase-2/auth-fundamentals/auth-server-concepts` | ## 2) Option 2: Separate Auth Server (Production approach) | 1 | Who-does-what list. |
| `phase-2/auth-fundamentals/auth-server-concepts` | ## 2) Option 2: Separate Auth Server (Production approach) | 2 | Actor → action list. |
| `phase-2/auth-fundamentals/auth-server-concepts` | ## Real-world production architecture | 1 | A single arrow points at a stack of three boxes; a diagram would need invented arrows or merged boxes. |
| `phase-2/auth-fundamentals/identity-providers-and-oidc` | ## Identity provider vs auth server | 1 | Capability tree, not a flow. |
| `phase-2/auth-server/openid-connect` | #### Where each one comes from | 1 | Two-message exchange whose point is the literal values (client_id, client_secret). |
| `phase-2/auth-server/openid-connect` | #### Where each one comes from | 2 | Sequence whose point is the literal authorization code value. |
| `phase-2/auth-server/refresh-tokens` | #### Note : Below is the in-depth understanding of refresh token encryption, you may skip it | 2 | Formula. |
| `phase-2/auth-server/refresh-tokens` | #### Note : Below is the in-depth understanding of refresh token encryption, you may skip it | 3 | Formula. |
| `phase-2/auth-server/identity-and-its-tables` | ### IdentityUser&lt;TKey&gt; — the user model | 1 | Type declarations (inheritance), not a flow. |
| `phase-2/auth-server/identity-and-its-tables` | #### IdentityRole&lt;TKey&gt; | 1 | Type declarations (inheritance), not a flow. |
| `phase-2/auth-server/usermanager-users-and-passwords` | #### GeneratePasswordResetTokenAsync | 5 | Two request descriptions built around literal URLs. |
| `phase-2/auth-server/usermanager-external-logins-and-2fa` | ### Two-factor authentication (2FA) | 4 | Two separate sketches and a sentence in one block; one diagram would have to merge them. |
| `phase-2/auth-server/signing-keys-and-discovery` | ### ✅ 1. Self Registration (Most common) | 1 | Two-line actor → action list. |
| `phase-2/auth-server/signing-keys-and-discovery` | ### ✅ 2. Admin creates users (Enterprise apps) | 1 | Two-line actor → action list. |
| `phase-2/auth-server/signing-keys-and-discovery` | ### ✅ 3. External Identity Providers (Modern approach) | 1 | Actor → action list. |
| `phase-2/auth-server/signing-keys-and-discovery` | ## What we are building | 1 | Component list with bullets; the only arrow is inside a bullet. |
| `phase-2/auth-server/signing-keys-and-discovery` | ## What happens during key rotation | 1 | Two-line actor → action list. |
| `phase-2/auth-server/signing-keys-and-discovery` | ## Important clarification | 1 | Two-line actor → action list. |
| `phase-2/auth-server/openiddict` | # OpenIddict : Introduction | 1 | Feature tree, not a flow. |
| `phase-2/auth-server/openiddict` | # OpenIddict : Introduction | 2 | Two-item sketch. |
| `phase-2/architecture/clean-architecture` | ## 🔁 Dependency Direction (Very Important) | 2 | Two two-item counter-examples (wrong dependency directions). |
| `phase-2/capstone/ef-configuration-and-automapper` | # Fluent API configurations with separate configuration class | 8 | Folder tree. |
| `sql-server/setup-and-security/server-database-schema` | #### What is a user? | 1 | Two-item mapping with a label. |
| `sql-server/setup-and-security/server-database-schema` | #### What belongs to a schema? | 1 | Containment tree (Database → Schema → Table). |
| `sql-server/data-types-and-commands/data-types` | ### 🔹 A) IDENTITY (Most Common) | 2 | Value example. |
| `sql-server/querying/subqueries` | ## Using NOT IN (Problem) | 7 | Evaluation example. |
| `sql-server/indexes-and-performance/execution-plans-and-sargability` | ### 1️⃣ Read From Right to Left | 1 | Reading-direction hints. |
| `sql-server/advanced-queries-and-programmability/ctes` | ## 1️⃣ Correlated Subquery Query | 3 | The same step repeated per row; the CorrelatedSubqueryVisualizer in SQL › Subqueries animates per-row evaluation. |
| `sql-server/transactions/transactions-and-concurrency` | # Deadlock | 5 | Two-line wait-for statement; the IsolationSimulator in this lesson animates deadlocks. |
| `sql-server/transactions/transactions-and-concurrency` | # Deadlock | 7 | Two-line wait-for statement. |
| `sql-server/transactions/transactions-and-concurrency` | ## How to prevent deadlocks | 1 | One-line lock order. |
| `sql-server/transactions/transactions-and-concurrency` | ## How to prevent deadlocks | 2 | Two-line lock order. |
| `sql-server/transactions/transactions-and-concurrency` | ## 2️⃣ Deadlock (Waiting forever) | 5 | Two-line wait-for statement. |
| `sql-server/transactions/transactions-and-concurrency` | ## 2️⃣ Deadlock (Waiting forever) | 6 | Two-line wait-for cycle. |
| `dsa/sorting/stability-and-simple-sorts` | ## 3. Insertion Sort | 1 | Array states (an insertion sort trace); the SortVisualizer in this lesson animates it. |
| `dsa/sorting/merge-and-quick-sort` | ## The mechanism | 1 | Already wrapped by SortVisualizer (quick sort, sorted preset). |
| `sql-server/transactions/transactions-and-concurrency` | # Blocking | 4 | Two-session timeline written as console-style lines; the IsolationSimulator in this lesson animates blocking. |
| `sql-server/transactions/transactions-and-concurrency` | ## 1️⃣ Blocking (Waiting but will finish) | 4 | Two-session timeline (as above). |

## Adding one later

1. Write `src/viz/flow/diagrams/<id>.ts` with `chain(...)` (a straight sequence) or `diagram(...)` (grid or tree),
   pointing `source` at the block, then add the id to `src/viz/flow/diagrams/index.ts`.
2. Add the placement to the lesson: `- diagram: <id>` with `at: { section: "<heading as written>", codeBlock: N }`
   (`atOccurrence` if the heading repeats in that note).
3. Run `npx vitest run tests/unit/flow` and `npm run content`.
