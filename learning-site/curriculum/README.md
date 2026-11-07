# Curriculum manifests

These YAML files say how the notes become courses. The notes themselves are never edited; the content pipeline
(`scripts/build-content.ts`) reads these manifests, slices the notes and generates lessons.

**A new note needs no entry here.** `scripts/lib/auto-curriculum.ts` places notes the manifests don't mention and keeps
entries in line with notes that were renamed or re-headed (see "Adding notes" in `../README.md`). An entry here always
wins, so write one to choose a title, an order, a section or a stable URL.

| File | What it defines |
|---|---|
| `<course id>.yaml` (any file not starting with `_`) | One course each: modules, lessons, source slices, visualizer/diagram placements. A new file is a new course |
| `_site.yaml` | Catalogue order, suggested learning path, notes routed outside courses (Interview Prep), duplicates, exclusions, `ignore`, `autoExclude` and `publishAnyway` |
| `_assets.yaml` | Every binary file in the repo, with an authorship guess and a publish decision (only `publish: true` files enter the build) |
| `_cheatsheets.yaml` | The proposed cheat sheets and their source notes |
| `_interview.yaml` | Interview Prep topics, sources from the notes, and web-research targets |

## Course file shape

```yaml
id: dsa                     # URL prefix → /dsa/<module>/<lesson>/
title: DSA in C#
kind: course                # course | roadmap
accent: amber               # design-token name (hex values are set in the design system)
icon: algorithm
prerequisites: [phase-1]    # course ids
landing:                    # optional: note slices shown on the course landing page
  sources: [...]
modules:
  - id: sorting
    title: Sorting
    noteFolder: "Competitive Programming/Sorting"  # optional: new notes in this folder (and below it) join this module
    lessons:
      - id: merge-and-quick-sort          # slug; URLs never come from file paths
        title: Merge sort & quick sort
        kind: lesson                       # lesson | checklist | roadmap
        reason: "..."                      # required when a note is unnumbered, moved or merged
        sources:
          - file: "Competitive Programming/sorting-algorithms-notes.md"
            from: "## 4. Merge Sort"       # first heading included (omit = start of file)
            until: "## 6. Heap Sort"       # first heading excluded (omit = end of file)
        place:
          - viz: SortVisualizer
            props: { algorithm: merge }
            tier: 1
            at: { section: "## 4. Merge Sort" }            # injected at the end of that section
          - diagram: quicksort-worst-case
            at: { section: "## The mechanism", codeBlock: 1 }  # replaces that fenced block; ASCII kept behind a "Text version" toggle
        related: [sql-server/querying/joins]   # course/module/lesson ids; must exist
        cheatsheets: [sorting-searching]
        resources:
          - asset: "path/to/file.pdf"          # must have publish: true in _assets.yaml
          - tryLocally: "Competitive Programming/Practice/SortingAlgo"
```

### Anchors

- `from` / `until` / `at.section` name a heading as written in the note, including its `#` level.
  Matching ignores case, punctuation, backticks, emphasis and emoji, so `## 🧪 2️⃣ Examples` and
  `## 2 Examples` are the same anchor. A heading inside a fenced code block never matches.
- `fromLine` / `untilLine` name a plain line instead of a heading (for notes with no sub-headings).
- If an anchor matches more than one heading, add `fromOccurrence: 2` (or `untilOccurrence`, `atOccurrence`).
- File paths are repo-relative with exact case. The build checks them against the real directory
  listing, so a case mismatch doesn't pass on Windows and then break on the Linux CI runner.
- When a note changes, anchors follow it: a reworded or renumbered heading resolves to the closest heading, and an anchor
  with no close match gives its text to the neighbouring lesson. Each case is listed as a warning.

### Guarantees

1. **Partition.** For every note, the slices across all manifests and `_site.yaml` cover every line exactly once. The
   curriculum step tiles each note to make it so, then the build checks it, so nothing is silently dropped.
2. **Coverage.** Every `.md`/`.txt` note in the repo (outside the `ignore` globs in `_site.yaml`, `bin/`, `obj/` and
   `learning-site/`) ends up in a lesson, a landing page, Interview Prep, a verified duplicate, or an exclusion with a reason.
3. **Counts.** Headings, code blocks and tables in each lesson's source slices are compared with the generated lesson.
   A difference is a warning, and fails the build only when more than 5 % of lessons disagree, which means a pipeline bug.
