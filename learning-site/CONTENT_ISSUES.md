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
