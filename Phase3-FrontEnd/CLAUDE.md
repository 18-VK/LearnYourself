# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this folder is

The front-end phase of the learning repo (see `../CLAUDE.md` for the repo as a whole): HTML, CSS, JavaScript and
browser-platform study notes aimed at **experienced-level front-end interviews**, each topic next to a small demo page
or script. There is no `package.json`, bundler, linter, formatter, framework or test suite. Nothing is built.

Layout: numbered section folders, then numbered topic folders in reading order. Every topic folder holds `notes.md`
plus its demo files. `README.md` at the root is the index and reading order.

```text
01-html/  02-css/  03-javascript/  04-browser-platform/   topics, e.g. 02-css/13-flexbox/notes.md
05-projects/            Netflix clone, FAQ accordion, responsive navbar, carousel
05-projects/exercises/  demo-only practice pages with no notes
06-interview/           front-end system design, machine coding, polyfills, output-prediction puzzles
_resources/             chapter-wise course PDFs that notes link to
```

Naming rules: folders are `NN-kebab-case` (zero-padded so they sort; the site orders by the number), every note is
`notes.md`, and the main demo files are lowercase `index.html` / `style.css` / `script.js`. A folder that combines
several old lectures keeps the extra demos under descriptive names (`linking.html`, `filter.html`, `id-and-class.html`).
The folders used to be named after a video course's lecture numbers ("Lecture 38"); those numbers are gone, so never
reintroduce "Lecture N" references.

## Running demos

- **HTML/CSS topics, DOM topics (`03-javascript/20`–`24`) and projects**: open the folder's HTML file in a browser, or
  use the VS Code Live Server extension. The breadcrumb on line 3 of each note names the demo files.
- **JavaScript language topics**: `node "03-javascript/02-types-variables-hoisting/script.js"`. `15-modules` uses `.mjs`
  files (`node main.mjs`). `06-interview/03-polyfills/polyfills.js` and `04-output-prediction/puzzles.js` self-check with node.
- `03-javascript/18-async-await-and-fetch` calls `jsonplaceholder.typicode.com`, so it needs network access.

## Note format

Every `notes.md` uses the same template. Keep new or edited notes on it:

```markdown
# Topic Title

> Section · Topic N · Demo: [index.html](index.html) · [script.js](script.js) · <optional run hint>

One-paragraph intro: what it is and why it exists.

## ...topic sections...
## Common Mistakes
## Key Takeaways
## Interview Questions
### Junior (0–1 year)
**Q1. Question?**
Answer paragraph.
### Mid-level (2–4 years)
**Q7. ...**            ← numbering continues across all three tiers
### Senior (5+ years)
**Q13. ...**           ← trade-offs, scale, production debugging; 3–4 per note
> **Note:** Related questions answered elsewhere: [...](...) (...)   ← optional pointer callout
## References          ← MDN, web.dev, specs
```

- Breadcrumb sections are `HTML`, `CSS`, `JavaScript`, `Browser platform`, `Project`, `Interview`; `Topic N` is the folder
  number. Demo links use the **exact filename case**.
- Callouts use only `> **Note:**`. Code examples show output inline as `// → value`. Comparisons go in tables.
- Each interview question has one home. When a question belongs to another note, link to it in the pointer callout
  instead of repeating it.
- Explanations reference the topic's own demo code and link to other notes with relative paths to their `notes.md`.
- When demo code has a bug or a bad practice, explain it in the note and leave the demo code as it is, unless asked to
  fix it. The Netflix clone's notes keep its bugs as a "Common Mistakes" to-do list on purpose.

## Publishing and case sensitivity

The notes feed the "LearnYourself" site (Astro + Pagefind on GitHub Pages). Its project lives in a **separate repo**
(`18-VK/LearnYourself`, local clone `D:\Data\Dot-net-main\Dot-net-main\learning-site`, not this repo). Its
`auto-curriculum.ts` places new notes, follows renames and orders folders by their number prefix, so moving or adding
notes needs no manifest change there. Its build screens notes for personal data (emails, `C:\Users\...` paths), so keep
those out of notes.

`../.github/workflows/deploy-learning-site.yml` in this repo refers to a `learning-site/` folder that this checkout
doesn't contain. Keep relative links and `#anchor` links valid by hand when you rename headings or files; anchors
use GitHub-style slugs. The site builds on Linux, where paths are case-sensitive even though Windows ignores case, so
match the exact case in every link and `href`.
