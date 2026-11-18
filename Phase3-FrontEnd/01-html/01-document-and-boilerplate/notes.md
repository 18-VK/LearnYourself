# HTML Document Basics

> HTML · Topic 1 · Demo: [index.html](index.html) · [style.css](style.css) · [script.js](script.js)

Every web page is an HTML document: a text file that the browser reads top to bottom and turns into what you see. This note covers the standard skeleton (the "boilerplate") every page starts with, what each line of it does, and how a CSS file and a JavaScript file get attached to the page.

## What the demo does

| File | Content | Effect |
|------|---------|--------|
| `index.html` | Boilerplate, the text "Hey Welcome." and a `<script>` tag at the end of `<body>` | The page itself |
| `style.css` | `body { background-color: aqua; color: beige; }` | Aqua page background, beige text |
| `script.js` | `alert("Do you want to continue?")` | Shows a pop-up message when the page loads |

Open `index.html` in a browser (double-click it, or use the VS Code "Live Server" extension so the page reloads on save).

## HTML in one minute

- **HTML** = HyperText Markup Language. It is a *markup* language, not a programming language: it describes the **structure and meaning** of content (this is a heading, this is a paragraph, this is a link). It has no variables, loops or logic.
- **CSS** describes how that content **looks**; **JavaScript** adds **behaviour**.
- The browser parses the HTML into a tree of objects called the **DOM** (Document Object Model). CSS and JS both work on that tree.

### Elements, tags and attributes

```html
<a href="https://www.codewithharry.com/" target="_blank">CodeWithHarry</a>
<!-- └ opening tag with two attributes ┘  └ content ┘  └ closing tag -->
```

| Term | Meaning | Example |
|------|---------|---------|
| Tag | The markup in angle brackets | `<p>`, `</p>` |
| Element | Opening tag + content + closing tag (the whole thing) | `<p>Hello</p>` |
| Attribute | Extra information in the opening tag, as `name="value"` | `href="..."`, `lang="en"` |
| Void (empty) element | Has no content and no closing tag | `<meta>`, `<link>`, `<br>`, `<img>`, `<input>`, `<hr>` |

Elements **nest** inside each other, and they must close in reverse order of opening:

```html
<p>This is <strong>correct</strong>.</p>
<p>This is <strong>wrong.</p></strong>  <!-- tags overlap: invalid -->
```

Comments are written `<!-- like this -->`. The browser ignores them; they are visible to anyone who opens "View source", so never put secrets in them.

## The boilerplate, line by line

In VS Code, typing `!` and pressing Tab (an Emmet shortcut) generates this skeleton. It is exactly what the demo uses:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lecture_2</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    Hey Welcome.
    <script src="script.js"></script>
</body>
</html>
```

### `<!DOCTYPE html>`

- Not an HTML element: it is an instruction to the browser that says "this is a modern HTML document".
- Without it, browsers render the page in **quirks mode**, which imitates bugs of 1990s browsers (for example, how percentage heights, table cells and unitless CSS lengths such as `width: 100` are handled). With it, they use **standards mode**.
- It must be the very first thing in the file. It is case-insensitive (`<!doctype html>` is equally valid).

### `<html lang="en">`

- The **root element**: everything else lives inside it.
- `lang` declares the language of the content. Screen readers use it to pick the right pronunciation, browsers use it for translation prompts, spell-checking and hyphenation, and search engines use it as a hint.

### `<head>` — information *about* the page

Nothing inside `<head>` is shown in the page area. It holds metadata and links to resources.

| Line | Purpose |
|------|---------|
| `<meta charset="UTF-8">` | Tells the browser the file's character encoding. UTF-8 covers every language and symbol. It must appear within the first 1024 bytes of the file, so keep it as the first line of `<head>`. |
| `<meta name="viewport" content="width=device-width, initial-scale=1.0">` | On phones, makes the page as wide as the screen instead of pretending to be a ~980px desktop page and shrinking it. Essential for responsive design. |
| `<title>` | Text shown in the browser tab, in bookmarks and history, and as the clickable headline in search results. Every page should have one, unique and descriptive. |
| `<link rel="stylesheet" href="style.css">` | Loads an external CSS file. |

### `<body>` — the visible content

Everything the user sees goes here. In the demo it is just the text "Hey Welcome." followed by the `<script>` tag.

> **Note:** Text placed directly in `<body>` (like "Hey Welcome.") is valid, but real pages wrap text in meaningful elements such as `<h1>` or `<p>` so that browsers, screen readers and search engines understand what it is.

### Whitespace

The browser collapses any run of spaces, tabs and newlines in normal text into a single space. Indentation in the source is only for humans; it does not change the layout.

## Attaching CSS

There are three ways to add CSS to a page:

| Method | How | When to use |
|--------|-----|-------------|
| External (used in the demo) | `<link rel="stylesheet" href="style.css">` in `<head>` | Almost always. One file can style many pages and the browser caches it. |
| Internal | `<style> body { color: red; } </style>` in `<head>` | Small single-page demos, or critical CSS inlined for speed. |
| Inline | `<p style="color: red;">` | One-off overrides, or styles set by JavaScript. Hard to maintain. |

When the same property is set in several places, inline styles win over internal/external ones (which compete by specificity and source order). The full rules are in [Specificity and the cascade](../../02-css/03-specificity-and-cascade/notes.md).

> **Note:** `href="style.css"` is a **relative path**: the browser looks for `style.css` in the same folder as the HTML file. On Linux servers (and GitHub Pages) file names are case-sensitive, so `Style.css` and `style.css` are different files there even though Windows treats them as the same.

## Attaching JavaScript

```html
<!-- External file (used in the demo) -->
<script src="script.js"></script>

<!-- Inline script -->
<script>
    console.log("Hello from inline JS");
</script>
```

- A `<script>` with `src` must still have a closing `</script>` tag, and any code written between the tags is ignored.
- The `.js` extension is a convention; the browser runs whatever the URL returns.

### Where to put the `<script>` tag

When the parser reaches a normal `<script>` tag it **stops building the page**, downloads the file, runs it, and only then continues. That has two consequences:

1. A script in `<head>` delays everything below it from appearing.
2. A script in `<head>` runs before the `<body>` elements exist, so `document.querySelector(...)` returns `null`.

The demo avoids both problems the classic way: the `<script>` is the **last thing inside `<body>`**. The modern alternative is to keep it in `<head>` with `defer`:

| Attribute | Download | Runs when | Order between scripts | Typical use |
|-----------|----------|-----------|----------------------|-------------|
| none | Blocks parsing | Immediately when reached | In document order | Rare today; or at the end of `<body>` |
| `defer` | In parallel with parsing | After the whole document is parsed (before `DOMContentLoaded`) | In document order | Your own scripts that use the DOM |
| `async` | In parallel with parsing | As soon as it finishes downloading | Not guaranteed | Independent scripts (analytics, ads) |
| `type="module"` | In parallel | Deferred by default | In document order | Modern ES-module code |

```html
<head>
    <script src="script.js" defer></script>
</head>
```

The JavaScript side of this (how the engine runs the script, `DOMContentLoaded`, module scripts) is covered in [How JavaScript runs](../../03-javascript/01-how-js-runs/notes.md#async-and-defer).

## `alert()` and its relatives

`alert("Do you want to continue?")` shows a modal dialog with **only an OK button**. It returns nothing, so it cannot actually ask a yes/no question. While any of these dialogs is open, the page's JavaScript is paused and the user cannot interact with the page.

| Function | Buttons | Returns |
|----------|---------|---------|
| `alert(message)` | OK | `undefined` |
| `confirm(message)` | OK / Cancel | `true` or `false` |
| `prompt(message, default)` | Text box + OK / Cancel | The typed string, or `null` if cancelled |

```js
const goOn = confirm("Do you want to continue?");
console.log(goOn); // → true if the user clicked OK, false if Cancel
```

These are fine for learning, but real applications use custom, styled dialogs (for example the `<dialog>` element) because the built-in ones block the page and cannot be styled.

## Common Mistakes

- **Missing `<!DOCTYPE html>`** — the page silently falls into quirks mode and CSS layouts behave strangely.
- **Visible content inside `<head>`** — when the parser meets text or a `<p>` in `<head>`, it silently ends `<head>` there and starts `<body>`, so the elements after it land in `<body>`. Inspect the DOM in DevTools to see the result.
- **Wrong path or file-name case** in `href`/`src` — the CSS or JS simply does not load. Check the browser DevTools Network/Console tabs for 404 errors.
- **`<script>` in `<head>` without `defer`** that touches the DOM — results in `TypeError: Cannot read properties of null`.
- **Self-closing `<script src="..." />`** — `<script>` is not a void element; the browser keeps treating everything after it as script content. Always write `</script>`.
- **Using `alert()` to ask a question** — use `confirm()` if you need the answer.
- **Low-contrast colours** — the demo's beige text on aqua is hard to read; real pages must meet contrast guidelines for accessibility.

## Key Takeaways

- HTML gives content structure and meaning; CSS styles it; JavaScript makes it interactive.
- `<!DOCTYPE html>` switches the browser into standards mode and must be the first line.
- `<head>` holds metadata (`charset`, viewport, `<title>`, stylesheets); `<body>` holds visible content.
- Keep `<meta charset="UTF-8">` first in `<head>` and always include the viewport meta tag.
- Prefer external CSS via `<link>` in `<head>`.
- Load scripts at the end of `<body>` or, better, in `<head>` with `defer`; use `async` only for independent scripts.
- `alert()` only informs; `confirm()` returns `true`/`false`; `prompt()` returns a string or `null`.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the purpose of `<!DOCTYPE html>`?**
It tells the browser the document is modern HTML so it renders in standards mode. Without it the browser uses quirks mode, which emulates old browser bugs (for example a different box model and table sizing), so layouts can break. It is not an HTML tag and must be the first line of the file.

**Q2. What is the difference between `<head>` and `<body>`?**
`<head>` contains information about the page that is not displayed in the content area: character set, viewport, title, links to CSS, meta descriptions, and so on. `<body>` contains everything the user sees and interacts with: text, images, links, forms.

**Q3. What is the difference between a tag, an element and an attribute?**
A tag is the markup itself, like `<p>` or `</p>`. An element is the complete unit: opening tag, content and closing tag (`<p>Hi</p>`). An attribute adds extra information inside the opening tag, such as `href` in `<a href="/about">`.

**Q4. What does `<meta name="viewport" content="width=device-width, initial-scale=1.0">` do?**
It tells mobile browsers to make the layout viewport as wide as the device screen and to start at 100% zoom. Without it, phones render the page at a desktop-like width (around 980px) and shrink it, so text is tiny and media queries do not behave as expected.

**Q5. Why is the `<script>` tag often placed just before `</body>`?**
A normal script blocks HTML parsing while it downloads and runs. Placing it at the end lets the page content render first, and guarantees that all the elements above it already exist when the script runs, so DOM lookups do not return `null`.

### Mid-level (2–4 years)

**Q6. Why should `<meta charset="UTF-8">` be the first element in `<head>`?**
The encoding declaration must be within the first 1024 bytes of the document. If the browser has already started decoding text (for example the `<title>`) with a guessed encoding, it may have to re-parse the page, or it may display garbled characters ("mojibake") for non-ASCII text. Declaring it first avoids both.

**Q7. What is quirks mode and how can you check which mode a page is in?**
Quirks mode is a compatibility rendering mode that browsers use when a page has no doctype (or an old one). It changes things such as how `width`/`height` are calculated and how inline images sit in table cells. In the console, `document.compatMode` returns `"CSS1Compat"` for standards mode and `"BackCompat"` for quirks mode.

**Q8. Why is CSS in `<head>` described as "render-blocking", and is that a bad thing?**
The browser will not paint the page until the stylesheets in `<head>` have loaded, because painting unstyled content and then restyling it would cause a flash of unstyled content (FOUC) and layout shifts. Blocking is intentional; the optimisation is to keep critical CSS small, avoid long chains of `@import`, and let the browser cache shared stylesheets.

**Q9. Why does the `lang` attribute on `<html>` matter?**
Screen readers use it to choose the correct voice and pronunciation, browsers use it for translation offers, spell-checking, hyphenation and font selection, and search engines use it as a language signal. Parts of a page in another language can be marked with their own `lang`, for example `<span lang="hi">नमस्ते</span>`.

**Q10. Browsers render broken HTML without complaint. How does that work, and why validate anyway?**
The HTML parser's error handling is fully specified, so every modern browser recovers from the same mistake in the same way: an unclosed `<p>` is closed implicitly, misnested tags such as `<b><i></b></i>` are repaired by the "adoption agency" algorithm, and text found in `<head>` starts `<body>` early. The page never fails to load, but the DOM you get can differ from the markup you wrote, so CSS selectors and JavaScript that assume the written structure quietly stop matching. Check the real tree in the DevTools Elements panel (not "View source") and run a validator, such as the W3C Nu checker or `html-validate`, in CI.

### Senior (5+ years)

**Q11. After a move to a new server, some pages show "Ã©" instead of "é", although the HTML still has `<meta charset="UTF-8">`. How do you debug it?**
The meta tag is the lowest-priority source of the encoding. The browser decides in this order: a byte order mark (BOM) at the start of the file, then the `charset` in the HTTP `Content-Type` header, then `<meta charset>`, and only then guessing. If the new server sends `Content-Type: text/html; charset=ISO-8859-1`, the header wins, and the two UTF-8 bytes of "é" (`C3 A9`) are decoded as two Latin-1 characters, "Ã©". The opposite fault, a file saved as Windows-1252 but declared UTF-8, shows `�` instead.

To debug, check the response headers in the DevTools Network panel, run `document.characterSet` in the console, and open the file in an editor that shows its real encoding. Recommendation: make the server send `charset=utf-8` for every text response (HTML, CSS, JavaScript), keep `<meta charset="UTF-8">` as the fallback for files opened locally, and fix the editor encoding for the repo (for example in `.editorconfig`).

**Q12. A legacy internal app has no doctype and has run in quirks mode for years. How would you move it to standards mode safely?**
Adding one line changes layout rules for every page, so treat it as a migration, not a fix. What usually breaks: percentage heights (in quirks mode `body` fills the viewport, so `height: 100%` "just worked"), unitless lengths such as `width: 100` (accepted as pixels in quirks mode, ignored in standards mode), hex colours written without `#`, a gap appearing below images in table cells (images now sit on the text baseline), and font sizes inside tables (in quirks mode tables do not inherit them).

Plan it in steps: find the quirks pages (log `document.compatMode` from real users or crawl the app; every iframe has its own mode), add the doctype one template at a time, compare before/after screenshots with a visual-regression tool, and fix the differences with targeted CSS (`html, body { height: 100%; }`, units on lengths, `img { display: block; }` in table cells). Recommendation: migrate per template behind visual-regression tests, then add a CI check that every template starts with `<!DOCTYPE html>` so no page slips back.

**Q13. Your product still uses `alert()` and `confirm()`. Would you replace them, and how would you do it across a large codebase?**
Yes, for anything users see. The native dialogs pause all JavaScript on the page and freeze its UI, cannot be styled, branded or given custom button labels, are suppressed inside sandboxed iframes that lack `allow-modals` (`confirm()` then returns `false` without asking), and browsers let users block repeated dialogs from a page.

Build one shared, promise-based utility, for example `confirmDialog({ title, message, confirmLabel })` that resolves to `true` or `false`, on top of `<dialog>` with `showModal()`, which provides focus handling, `Esc` to close and an inert background for free (see [Interactive elements and web components](../12-interactive-elements-and-web-components/notes.md)). The real migration cost is that callers change from `if (confirm(msg))` to `if (await confirmDialog(...))`, so they become async. Roll it out by adding the component to the design system, turning on ESLint's `no-alert` rule as a warning, converting call sites (a codemod handles the simple ones), and then making the rule an error. Recommendation: keep native dialogs for throwaway debugging only.

**Q14. You own the shared page template (`<head>`) that many teams build on. What order do you put things in, and how do you stop it degrading?**
Order matters because the parser acts on each element as it reaches it:

1. `<meta charset>` first (it must be in the first 1024 bytes), then the viewport meta and `<title>`.
2. A `<meta http-equiv="Content-Security-Policy">`, if you use one instead of the header, before any script or stylesheet, because it does not apply to resources that come before it.
3. `preconnect` and `preload` hints for critical origins and fonts, then the critical CSS.
4. Your own scripts with `defer` or `type="module"`: they do not block parsing, so putting them in `<head>` lets the download start early. Independent third-party scripts with `async` last.
5. Description, canonical and social meta tags, which are order-independent.

The template degrades when every team adds "just one tag" to it. Make it a single shared layout component owned by one team, review changes to it like changes to a public API, and fail CI on regressions with a render-blocking-resource budget (for example Lighthouse CI) and an HTML validator. Recommendation: one owned template with a documented order and automated checks.

> **Note:** Related questions answered elsewhere: [How JavaScript runs](../../03-javascript/01-how-js-runs/notes.md#interview-questions) (`async` vs `defer`; a script in `<head>` that finds `null`); [CSS Basics and Ways to Add CSS](../../02-css/01-basics-and-linking/notes.md#interview-questions) (the three ways to add CSS).

## References
- [MDN: `<!DOCTYPE>` (Doctype)](https://developer.mozilla.org/en-US/docs/Glossary/Doctype)
- [MDN: Quirks mode and standards mode](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Quirks_mode_and_standards_mode)
- [MDN: `<meta>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta)
- [MDN: `<link>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link)
- [MDN: `<script>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script)
- [MDN: `Window.alert()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/alert)
- [MDN: `Window.confirm()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm)
- [W3C Internationalization: Declaring character encodings in HTML](https://www.w3.org/International/questions/qa-html-encoding-declarations)
- [WHATWG: Quirks Mode Standard](https://quirks.spec.whatwg.org/)
