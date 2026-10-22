# Content issues

Problems found in the notes while building the site. The notes are the source of truth, so nothing
here has been changed in them. The site renders each note as written. Where a visualizer has to make
a choice, the entry says what it does. Fix a note yourself and delete its entry; the site picks up the
change on the next build.

Status: `open` (needs your call), `info` (no action needed; recorded so nothing is silently decided).

## Possible errors

| # | File › heading | Observation | Site behaviour | Status |
|---|---|---|---|---|
| 5 | `Competitive Programming/sorting-algorithms-notes.md` › 9. Bucket Sort | "Sort each bucket individually (often with insertion sort)", while the code calls `List<float>.Sort()`, which is not stable. The stability line ("depends on the sort used within buckets") therefore means this implementation is not guaranteed stable. | Each bucket's sort is shown as a single step labelled `buckets[i].Sort()`, matching the code. | info |

## Resolved

Fixed in the notes on 2026-10-21 with your approval. These are the only edits made to the notes.

| # | File › heading | What was wrong | Change made |
|---|---|---|---|
| 1 | `Competitive Programming/sorting-algorithms-notes.md` › The mechanism | The diagram showed the array `[1,2,3,4,5,6,7,n]` but labelled the pivot "7 (last, largest)". | First line is now `[1,2,3,4,5,6,7]`, so the pivot label and every comparison count below it (n-1, n-2, …) are consistent. |
| 2 | `sorting-algorithms-notes.md` › Why this makes it O(n²) | The sum read `n + (n-1) + … + 1 = n(n+1)/2`, but a range of size m makes m − 1 comparisons. | Now `(n-1) + (n-2) + ... + 1 = n(n-1)/2`. The O(n²) conclusion is unchanged. |
| 3 | `sorting-algorithms-notes.md` › 6. Heap Sort | Space O(1), although the note's `Heapify` is recursive. | Space line now adds: the recursive `Heapify` also uses O(log n) call-stack space; an iterative heapify keeps it at O(1). |
| 4 | `sorting-algorithms-notes.md` › 8. Radix Sort | Unstated assumptions: non-negative integers, non-empty array. | New Cons bullet stating both assumptions. |
| 6 | `Phase2-ASP.NetAndBackend/SQLTutorial/4.SQL_JoinsNMore.md` › Why This Happens (Logical Order) | Listed only FROM, JOIN, WHERE, GROUP BY, SELECT, ORDER BY. | Now the full logical processing order from Microsoft Learn's [SELECT (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql) page: FROM, ON, JOIN, WHERE, GROUP BY, WITH CUBE or WITH ROLLUP, HAVING, SELECT, DISTINCT, ORDER BY, TOP. The query-order visualizer animates this list. |
| 7 | `Phase1-CSharp_And_DotNet_core_fundamental/Note.md` | Read as if `csc`/`mono` were the .NET 8/9 workflow and `dotnet script` were a .NET 7 feature. | The note now says `csc`/`mono` are the .NET Framework / Mono toolchain, shows `dotnet run program.cs` for .NET 10 and later, and shows `dotnet script` (a community global tool, with its install command) for .NET 6 to 9. |

## Structure and duplication

| # | File › heading | Observation | Site behaviour | Status |
|---|---|---|---|---|
| 8 | `Phase1-CSharp_And_DotNet_core_fundamental/Dot Net_CLI.md` and `15.C#_AdvanceTopics/Dot Net_CLI.md` | Same content; the folder-15 copy adds code fences and formatting. | The lesson uses the folder-15 copy. The build re-checks on every run that the root copy has nothing extra, and fails if the two diverge. | info |
| 9 | `SQLTutorial/3.SQL_commands.md` › ALTER and `SQL_Server_ALTER_Command_Guide.md` | Mostly the same material. The section in note 3 has two warnings the guide lacks ("Cannot shrink size if data truncation occurs", "Column must not contain NULL values"); the guide has an intro, interview summary and real-world usage. | Both kept: the section in note 3 is a lesson, the guide is in the Reference module. | info |
| 10 | `20.WFA_and_WPF/WPF_Tutorial/12.AdvanceTopics.md` and `12.Tips.md` | Both numbered 12. | Ordered alphabetically (AdvanceTopics, then Tips). | info |
| 11 | `19. OtherTopics/Notes.md` › Using keyword | The heading says "Using keyword" but the section is about `AppDomain.CurrentDomain.AssemblyResolve`; the `using` keyword is covered later under "using keyword in C#". | The lesson is titled by its content ("ResourceManager & assembly resolution"). | info |
| 12 | `19. OtherTopics/Notes.md` › C++ questions for interview | C++ material inside a C# note. | Routed to Interview Prep as notes-origin questions tagged `notCoveredYet`. | info |
| 13 | `Competitive Programming/searching-algorithms-notes.md` › 9. Hash-Based Search | Says "(see hashing notes)"; no note has that name. The closest is `csharp-dsa-collections-cheatsheet.md` › 3. Hashing — Fast Lookup. | Text shown as written, plus a related link to that section. | info |

## Formatting that affects rendering

These do not change meaning, but plain Markdown would render them badly. The pipeline handles them
without editing the notes. Fencing the code in the source would make the notes render well on GitHub too.

| # | File | Observation | Site behaviour |
|---|---|---|---|
| 14 | `20.WFA_and_WPF/WFA_Notes.md` | All C# examples are unfenced plain text (0 code fences, ~4,750 words). | Unfenced code runs are detected and rendered as code blocks. The coverage report counts them separately as "recovered" blocks. |
| 15 | `WPF_Tutorial/2.WPFNotes.md`, `WPF_Tutorial/3.OtherUsefulThings.md`, `WPF_Tutorial/12.AdvanceTopics.md` | 586 lines of unfenced XAML. Plain Markdown treats `<TextBlock … />` as HTML and drops it from the page. | Same recovery. Separately, any raw HTML tag in a note that is not on a small allow-list is escaped, so it shows as text instead of disappearing. |
| 16 | `SQLTutorial/SQL_StoredProcedure.md`, `Phase1-…/Dot Net_CLI.md` (root copy) | Unfenced SQL and shell commands. | Same recovery. |
| 17 | Many notes | Single line breaks inside paragraphs carry meaning (for example "Definition:" on one line, the definition on the next). | Single newlines render as line breaks. |

## C# & .NET visualizers (Phase 1)

Found while building the visualizers in `src/viz/csharp/`. IDs are prefixed `CS` so they don't collide with entries added by other areas.

| # | File › heading | Observation | Site behaviour | Status |
|---|---|---|---|---|
| CS1 | `Phase1-…/17..C#_ThreadsAndMultithreading/ThreadpoolAndTask.md` › 3) `Task.WhenAll` / `WhenAny` and exception handling | The example does not compile (checked with the .NET 7 SDK: `CS0029: Cannot implicitly convert type 'void' to 'int[]'`). The second lambda only throws, so its `Task.Run` call is not `Task<int>`; `tasks` becomes `Task[]` and `await Task.WhenAll(tasks)` has no result to assign to `int[] results`. Casting that lambda to `Func<int>` makes it compile (`Task.Run<int>(…)` alone is ambiguous). With that change it prints `At least one task failed: fail` and the caught exception's type is `Exception`, which contradicts the comment "WhenAll throws the first observed exception as AggregateException when awaited": awaiting rethrows the inner exception itself; the `AggregateException` is the task's `Exception` property. | The async/await visualizer takes its `Task.WhenAll` example from `OtherTopics.md` › SemaphoreSlim example A instead. | open |
| CS2 | `Phase1-…/1.C#_Basics/C#_Fundamentals.md` › 1. Value Types; `6.C#_OOP/Note.md` › Boxing ("copied from the stack (where value types live)") | "Allocated on the stack" is the simplification that `Struct_vs_Class.md` › Memory Behavior itself calls an oversimplification: a value can also live inside an object, in an array, or boxed. | The stack/heap visualizer draws locals in a stack frame, labels the picture "simplified" and repeats the Memory Behavior caveat. | info |
| CS3 | `Phase1-…/18.LINQ/DeferredVsImmediate.md` | No example chains two operators, so the note has no code for "each element passes through Where, then Select, before the next is read". | The LINQ visualizer's third example joins the note's `numbers.Where(n => n > 2)` with LINQ basics' `Select(n => n * n)`. Its code panel says "composed from two note examples (not a block from the notes)". The element-at-a-time order was checked against Microsoft Learn (Where and Select are deferred streaming operators) and by running the chain on .NET. | info |
| CS4 | `Phase1-…/15.C#_AdvanceTopics/EventsNEventHandling.md` › How it works (Publisher-Subscriber Model) | The Publisher bullet runs into the next one: "…provides a method (often named `On<EventName>`) to raise thect interested in the event creates an event handler method…". Text seems to be missing between "raise th" and "ect" (probably the end of the Publisher bullet and the start of a Subscriber bullet). | Rendered as written. The events visualizer uses the note's Button and TemperatureSensor code, not this paragraph. | open |
| CS5 | `Phase1-…/18.LINQ/EFCore/Notes2.md` › 1. Eager loading | `.ThenInclude(c => c.Teacher)`, but the `Course` class shown at the top of the section has no `Teacher` property, so the example doesn't compile against the note's own model. | The N+1 visualizer's Include fix uses `SQLTutorial/11.Question.md` › Eager Loading (`context.Users.Include(u => u.Orders)`) instead. | open |
| CS6 | `Phase1-…/15.C#_AdvanceTopics/Dependency_Injection.md` › Deep dive › Singleton | "If you inject a Scoped or Transient dependency into a Singleton … The DI container throws an `InvalidOperationException` by default in Development mode if it detects this." Microsoft Learn's scope validation checks only scoped services (not resolved from the root provider, not injected into singletons); a transient captured by a singleton is not reported. ([Scope validation](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview#scope-validation)) | The captive-dependency visualizer shows validation for the note's scoped example only. | info |
| CS7 | `Phase1-…/15.C#_AdvanceTopics/Dependency_Injection.md` › Scoped vs Transient | The example doesn't show how `ServiceA` and `ServiceB` are registered. The printed outputs hold when they are transient or scoped; a singleton `ServiceA` would keep its first Counter. | The lifetimes visualizer draws them as transient and says the registration is assumed. | info |
