# Checkpoint 2: Foundation + Sorting showcase

Status: **waiting for your review of the look and feel.** Nothing has been committed, pushed or deployed.

## What was built

- **Content pipeline** (`scripts/build-content.ts`, `scripts/lib/*`): reads the 7 course manifests and
  `_site.yaml`, slices the notes, and generates all **178 lessons**. Along the way it:
  - recovers code that the notes write as plain text (165 blocks);
  - drops the 7 approved chatbot lines;
  - shifts headings so each page has a single h1;
  - injects visualizer placeholders;
  - processes the 19 approved binary files as view-only assets (images → WebP, PDFs → inline viewer,
    DOCX → read-only pages);
  - writes `coverage-report.md`.

  It runs automatically before `astro dev`/`astro build`, and dev regenerates when a note or manifest changes.
- **Rendering** (`src/markdown/*`): the notes' conventions become components:
  - callouts (👉 💡 ⚠️ 🔥 and VERY IMPORTANT);
  - side-by-side ❌/✅ cards;
  - interview callouts;
  - code frames with a language label, copy button and line highlighting (Shiki, light and dark);
  - scrollable tables with sticky headers;
  - note-to-note links rewritten to lesson URLs;
  - raw HTML escaped so XAML and `<T>` show instead of vanishing.
- **Site**:
  - home, a catalogue laid out as the suggested path;
  - course landing pages with modules, facts, prerequisites and "coming soon" planned modules;
  - lesson pages with breadcrumb, reading time, links to the original note, objectives, sticky TOC with
    scroll-spy, reading progress bar, resources, related lessons, mark complete and previous/next;
  - persistent checklists on checklist and roadmap lessons;
  - Pagefind search (press `/`);
  - a progress page with JSON export and import;
  - a custom 404, light/dark/system themes and a mobile layout;
  - placeholder pages for Cheat Sheets and Interview Prep.
- **Visualizer engine**:
  - `src/viz/engine/`: player with play/pause, step back/forward, scrubber, 0.25×–4× speed, keyboard
    (Space, ←, →) and predict mode;
  - synchronized code, narration (`aria-live`), variables, counters and legend panels;
  - reduced-motion support.
- **Sorting showcase (DSA course)**:
  - all 11 trace generators (bubble, selection, insertion, merge, quick, heap, counting stable/simple/by-age,
    radix, bucket), each mirroring the notes' C# line by line;
  - the code panel shows that C# verbatim, and the build fails if it ever drifts from the note;
  - heap sort has array and tree views in sync;
  - the quick sort worst-case preset is placed at the note's "The mechanism" section;
  - stability demos, including the note's Employee example with names;
  - an interactive summary table that launches compare mode;
  - compare mode races two algorithms side by side with live counters;
  - learner input, size slider and five presets.
- **GitHub Actions** (`.github/workflows/deploy-learning-site.yml`): build, test and smoke-test on pull requests;
  the same plus deploy on `main`. Minimal permissions and a concurrency group.

Visualizers for other courses (joins, middleware, JWT, async, …) are Checkpoint 4. Their placements already
exist, and until then they show the note's original text with a short "planned" note.

## How to run

```bash
cd learning-site
source scripts/local-env.sh   # this machine only: portable Node 24 + D:-based caches
npm ci                        # once
npm run dev                   # http://localhost:4321/LearnYourself/
npm run build && npm run preview   # the production build under the base path
```

## Results

| Check | Result |
|---|---|
| Content pipeline | 140 of 140 notes mapped or explicitly excluded; 0 gaps, 0 overlaps, 0 broken anchors |
| Source vs rendered output | All 178 lessons match: headings, code blocks, tables and ❌/✅/👉/💡/⚠/🔥 markers |
| Internal links, assets, anchors | 12,128 checked under `/LearnYourself/`, 0 broken |
| Unit tests (`npm test`) | 163 passed (all 11 sorting traces: final state, invariants at every step, hand-computed counters, exact C# line sequences) |
| Smoke tests (`npm run test:e2e`) | 190 passed: every course and lesson page with no console errors, every visualizer placement mounts (or shows "planned"), keyboard control, predict mode, search and the 404 page |
| Type check (`npm run check`) | 0 errors, 0 warnings |
| Build time | ≈ 50 s (content 13 s, Astro 30 s, Pagefind 1 s, verify 5 s) |

## Budgets

| Budget | Limit | Now |
|---|---|---|
| Total size | 200 MB | 16.1 MB |
| Files | 20,000 | 469 |
| Largest file | 25 MiB | 642 KB (a PDF) |
| Binaries outside the approved list | 0 | 0 |

## Decisions made while building

- **Package versions**: pinned to releases at least 7 days old, a supply-chain precaution. Astro is
  7.3.8 (7.4.1 was 2 days old); TypeScript is 6.0.3 because `astro check` does not support TS 7 yet.
- **Fonts**: self-hosted (Literata, JetBrains Mono) instead of Google Fonts, so pages make no third-party
  requests. Code ligatures are turned off, so `!=`, `->` and `>=` show exactly as written in the notes.
- **Unfenced code**: recovered blocks are listed in `coverage-report.md` (section "Recovered code blocks")
  for a spot check. The heuristics are conservative: they never drop text, only wrap it in a code block.
- **Objectives**: lessons without hand-written objectives show "What this lesson covers" from their own
  headings, labelled as such. Hand-written objectives come with the quizzes at Checkpoint 4.
- **Interview Prep and Cheat Sheets**: their pages exist with topic lists only; content is Checkpoint 5.

## New entries in CONTENT_ISSUES.md

None. The six issues you approved fixing are under "Resolved".

## Open questions for you

1. **Look and feel**: does the site look right to you? This is the review point before scaling to the other
   visualizers.
2. **Publishing**: may I commit `learning-site/` and the workflow, add `https://github.com/18-VK/LearnYourself.git`
   as `origin` and push `main`? Pages also needs Settings → Pages → Source → "GitHub Actions" turned on.
   You can do that yourself, or tell me to and I'll ask first. The personal-data scan from Checkpoint 7 runs
   before the first public deploy.
