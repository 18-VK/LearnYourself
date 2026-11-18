# CSS Basics and Ways to Add CSS

> CSS · Topic 1 · Demo: [index.html](index.html) · [linking.html](linking.html) · [style.css](style.css)

CSS (Cascading Style Sheets) is the language that controls how an HTML page looks. HTML creates the structure of the page; CSS adds the styling (colors, fonts, spacing, layout) to that structure. This note covers the basic rule syntax, where styles come from, how the browser applies them, and the three ways to attach CSS to a page (inline, internal and external), including which one wins when they conflict. Every later CSS note builds on these basics.

## What Is CSS?

CSS stands for **Cascading Style Sheets**. It is a stylesheet language used to describe the visual presentation of a web page written in HTML (HyperText Markup Language).

- **HTML** creates the structure of the page: headings, paragraphs, lists, links, forms.
- **CSS** adds styling to that structure: colors, fonts, spacing, sizes, layout, animation.
- **JavaScript** (later in the course) adds behaviour: reacting to clicks, fetching data, changing the page.

| Layer | Language | Answers the question |
|---|---|---|
| Structure / content | HTML | *What* is on the page? |
| Presentation | CSS | *How* does it look? |
| Behaviour | JavaScript | *What happens* when the user interacts? |

### What the name means

- **Cascading**: several rules can target the same element. The browser uses a fixed algorithm, the *cascade*, to decide which value wins (importance, specificity, then source order). This is covered in detail in [Specificity and the cascade](../03-specificity-and-cascade/notes.md).
- **Style**: the visual presentation of the content.
- **Sheets**: rules are collected in sheets. The browser has its own default sheet, and you add your own on top of it.

### Why CSS exists

In early HTML, styling was done with tags and attributes such as `<font color="red">` and `bgcolor`. That mixed content with presentation, so changing the look of a site meant editing every page. CSS separates the two:

- One stylesheet can restyle a whole website.
- The same HTML can look different on phones, desktops and printers (media queries).
- Stylesheets are cached by the browser, so pages load faster.
- HTML stays clean and meaningful, which helps accessibility and SEO.

## Anatomy of a CSS Rule

```css
selector {
  property: value;
  property: value;
}
```

A real rule from the `index.html` demo:

```css
p {
  color: cadetblue;
}
```

| Term | In the example | Meaning |
|---|---|---|
| Rule (ruleset) | the whole block | A selector plus its declaration block |
| Selector | `p` | *Which* elements the rule applies to |
| Declaration block | `{ ... }` | Everything between the curly braces |
| Declaration | `color: cadetblue;` | One property-value pair |
| Property | `color` | *What* you want to change |
| Value | `cadetblue` | *How* you want to change it |

### Syntax rules

- A colon `:` separates the property from the value.
- A semicolon `;` ends each declaration. The last one may omit it, but always write it so adding a new line later does not break anything.
- Whitespace and line breaks are ignored, so `p{color:red}` is valid. Format for readability.
- Property names and keywords are case-insensitive (`COLOR: Red` works), but class names, IDs, URLs and font names can be case-sensitive. Write CSS in lowercase.
- Comments use `/* ... */` only. CSS has no `//` line comment.

```css
/* This is a CSS comment */
p {
  color: cadetblue; /* comments can also go at the end of a line */
}
```

### Invalid code is skipped, not fatal

If the browser does not understand a declaration, it ignores just that declaration and continues with the rest. This is why a typo does not "crash" the page but the style silently does not apply.

```css
p {
  colr: red;        /* unknown property: ignored */
  color: cadetblue; /* still applied */
}
```

## Grouping Selectors

The `index.html` demo has a rule with two selectors separated by a comma (the HTML comment calls it "two selector"):

```css
p, div {
  background-color: burlywood;
}
```

A comma means "apply the same declarations to each of these selectors". It is exactly the same as writing:

```css
p {
  background-color: burlywood;
}

div {
  background-color: burlywood;
}
```

Grouping avoids repeating the same declarations (the DRY principle: Don't Repeat Yourself).

> **Note:** In a normal selector list, if *one* selector is invalid, the **whole rule** is thrown away. For example, `p, div:hovr { ... }` (typo in `:hover`) styles neither `p` nor `div`. [CSS selectors](../02-selectors/notes.md) covers this and the forgiving `:is()` / `:where()` lists.

## How the `index.html` Demo Works

The first demo puts the CSS inside a `<style>` tag in the `<head>`. This is *internal CSS*, one of the three ways of adding CSS described in [The Three Ways to Add CSS](#the-three-ways-to-add-css) below.

```html
<style>
  p {
    color: cadetblue;
  }
  p, div {
    background-color: burlywood;
  }
</style>
```

| Element | Rules that match | Result |
|---|---|---|
| `<p>` | `p` and `p, div` | cadetblue text on a burlywood background |
| `<span>` | none | browser default: black text, no background ("i am a span without css") |
| `<div>` | `p, div` | default black text on a burlywood background |

Two things to notice:

1. The `<p>` matches **two** rules. Their declarations are merged, so it gets both the color and the background. If both rules had set the same property, the cascade would decide which one wins.
2. The `<span>` has no CSS of its own, so it shows the browser's default styling.

## The Three Ways to Add CSS

- **Inline CSS**: written on one element through its `style` attribute.
- **Internal CSS**: a `<style>` element in the page holds that page's styles.
- **External CSS**: the styles live in a separate `.css` file that the HTML links to.

The `linking.html` demo shows all three on one page, each styling its own `<span>`:

| Method | Demo element | Where the CSS is | Result |
|---|---|---|---|
| Inline | `<span id="Inline">` | its `style` attribute | blue text on brown |
| Internal | `<span id="Internal">` | `<style>` in `<head>` | chartreuse text on brown |
| External | `<span Id="External">` | `style.css` | chocolate text on brown |

### 1. Inline CSS

Inline CSS is written directly on an element with the `style` attribute. The value is a list of declarations, without a selector or braces.

```html
<span id="Inline" style="color: blue; background-color: brown;">
  This is used in an HTML Page using style attributes.
</span>
```

- Applies to **that one element only**.
- Has the highest priority of normal author styles (it beats any selector, even an ID).
- Cannot use selectors, so it cannot do `:hover`, `::before`, media queries or animations with `@keyframes`.
- Repeats styles on every element and mixes presentation into the HTML, so it is hard to maintain.
- Pages with a strict Content Security Policy (CSP) may block `style` attributes unless `'unsafe-inline'` is allowed.

**When inline style is reasonable today:**

- Values calculated by JavaScript at runtime (`element.style.width = progress + "%"`, or the `style` prop in React).
- Passing a value into CSS through a custom property: `<div class="bar" style="--progress: 40%">`.
- HTML emails, where many email clients ignore `<style>` blocks.

### 2. Internal CSS

Internal (or embedded) CSS goes inside a `<style>` element, normally in the `<head>`. It uses full CSS syntax with selectors.

```html
<head>
  <style>
    #Internal {
      color: chartreuse;
      background-color: brown;
    }
  </style>
</head>
```

- Applies to **one page only**.
- No extra network request, so it is handy for small demos (most demos in these notes use it) and for inlining "critical" above-the-fold CSS.
- If several pages need the same styles, you would copy them into every page, and the browser cannot cache them separately from the HTML.

### 3. External CSS

External CSS lives in its own `.css` file and is connected with a `<link>` element in the `<head>`.

```html
<head>
  <link rel="stylesheet" href="style.css">
</head>
```

```css
/* style.css */
#External {
  color: chocolate;
  background-color: brown;
}
```

| `<link>` attribute | Purpose |
|---|---|
| `rel="stylesheet"` | Required. Tells the browser this file is a stylesheet. Without it, the file is not applied. |
| `href="style.css"` | Path to the file, relative to the HTML file (or an absolute URL). |
| `media="print"` (optional) | Apply only for that media. Non-matching stylesheets are still downloaded but do not block rendering. |

- One file can style **every page** of a site: change it once, update everywhere.
- The browser **caches** it, so later pages load faster.
- Keeps HTML clean (separation of concerns).
- Costs one extra request, and the stylesheet is render-blocking, so keep the number of files small.
- This is the default choice for real projects.

> **Note:** A `.css` file contains only CSS. Do not put `<style>` tags inside it; the tag text is invalid CSS and breaks the first rule.

### `@import` (another way to load external CSS)

A stylesheet can pull in another one with `@import`, which must come before all other rules (only `@charset` and `@layer` statements may precede it):

```css
@import url("reset.css");

body {
  margin: 0;
}
```

The browser only discovers the imported file after downloading and parsing the first one, so files load one after another instead of in parallel. Prefer several `<link>` tags (or a build tool that bundles files) over `@import` in production.

### Comparison

| | Inline | Internal | External |
|---|---|---|---|
| Where | `style` attribute | `<style>` in the page | separate `.css` file + `<link>` |
| Scope | one element | one page | any page that links it |
| Selectors, `:hover`, media queries | no | yes | yes |
| Reusable across pages | no | no (copy/paste) | yes |
| Cached separately by the browser | no | no | yes |
| Extra HTTP request | no | no | yes |
| Maintainability | poor | fine for one page | best |
| Typical use | JS-driven values, emails | demos, critical CSS | real sites |

### Which one wins?

A common belief is "inline > internal > external". The first part is true, the second is not.

1. **Inline styles** beat any selector in internal or external stylesheets (only `!important` in a stylesheet can override a normal inline style).
2. **Internal and external stylesheets have equal priority.** Between them, the normal cascade applies: the more specific selector wins, and if specificity is equal, the rule that appears **later** in the document wins.

```html
<head>
  <style>
    p { color: red; }              /* internal, comes first */
  </style>
  <link rel="stylesheet" href="style.css">  <!-- contains: p { color: green; } -->
</head>
```

The paragraph is **green**, because the external file is loaded later. Swap the order of `<style>` and `<link>` and it becomes red. In `linking.html`, `<style>` also comes before `<link>`, so if both styled the same element with equal specificity, `style.css` would win. The demo avoids the conflict by giving each span its own ID.

### Notes on the `linking.html` markup

> **Note:** The demo writes `Id = "External"` with a capital `I`. HTML attribute names are case-insensitive, so this works. Attribute *values* are not: `#External` matches, but `#external` would not.

> **Note:** In the demo, each `<span>` sits directly inside `<ol>`, between the `<li>` elements. That is invalid HTML: an `<ol>` may only contain `<li>` (plus `<script>` and `<template>`). Browsers still render it, but the correct structure puts the description inside the list item.

```html
<ol>
  <li>
    Inline CSS
    <span id="Inline" style="color: blue; background-color: brown;">
      This is used in an HTML Page using style attributes.
    </span>
  </li>
  <li>
    Internal CSS
    <span id="Internal">It means to add a style tag and place the HTML page's style within it.</span>
  </li>
  <li>
    External CSS
    <span id="External">It means to create a .css file and place all style inside that .css file.</span>
  </li>
</ol>
```

## Where Styles Come From

Even with no CSS at all, a page is not unstyled. Styles come from three places, called *origins*:

| Source | Example |
|---|---|
| **User-agent stylesheet** (browser defaults) | `<h1>` is big and bold, `<p>` has top and bottom margins, `<body>` has an 8px margin |
| **User styles** | A user's browser settings, such as a larger default font size |
| **Author styles** (yours) | Everything you write in `<style>`, `.css` files and `style` attributes |

Your author styles override browser defaults. This is why many projects start with a small "reset" such as `* { margin: 0; padding: 0; }` (used in later demos) to remove default spacing.

## Inheritance in One Minute

Some properties are passed down from a parent to its children automatically; others are not.

| Usually inherited (text-related) | Not inherited (box-related) |
|---|---|
| `color`, `font-family`, `font-size`, `font-weight`, `line-height`, `text-align`, `visibility` | `background-color`, `border`, `margin`, `padding`, `width`, `height`, `display` |

```html
<div style="color: green; border: 1px solid red;">
  Parent text
  <p>Child text is green too, but has no red border.</p>
</div>
```

> **Note:** A child often *looks* like it has the parent's background. It does not inherit it: its own background is `transparent` by default, so the parent's background shows through.

## How the Browser Applies CSS

1. Parse the HTML into the **DOM** (Document Object Model).
2. Parse all CSS into the **CSSOM** (CSS Object Model).
3. Combine both into the **render tree**: the visible elements with their final computed styles.
4. **Layout**: calculate the size and position of every box.
5. **Paint**: draw pixels on the screen.

CSS in the `<head>` is **render-blocking**: the browser waits for it before the first paint. That is deliberate. Otherwise users would see a flash of unstyled content (FOUC) before the styles arrive.

## Properties to Start With

| Property | What it controls | Covered in |
|---|---|---|
| `color` | Text color | [Typography and color](../07-typography-and-color/notes.md) |
| `background-color` | Background color of the box | [Typography and color](../07-typography-and-color/notes.md) |
| `font-family`, `font-size` | Typeface and text size | [Typography and color](../07-typography-and-color/notes.md) |
| `margin`, `padding`, `border` | Spacing and edges of the box | [Box model](../04-box-model/notes.md) |
| `width`, `height` | Size of the box | [Units and sizing](../05-units-and-sizing/notes.md) |
| `display` | How the element is laid out (block, inline, ...) | [Display and visibility](../06-display-and-visibility/notes.md) |

## Best Practice

- Use **external** stylesheets for anything shared across pages.
- Put `<link>` tags in the `<head>` so styles load before the content is painted (no flash of unstyled content).
- Order stylesheets from general to specific: reset/normalize, base styles, components, utilities.
- Use **internal** CSS for quick demos, single-page prototypes or small critical CSS.
- Use **inline** styles only for values that really are per-element and dynamic.
- Match the file name's exact case in `href`. Windows ignores case, but most web servers (Linux, GitHub Pages) do not, so `href="Style.css"` for a file named `style.css` breaks after deployment.

## Common Mistakes

- **Missing semicolon.** `color: red background-color: blue;` is read as one invalid value for `color`, so *both* styles are lost.
- **Using `//` for comments.** The comment text becomes part of the next selector, so the following rule is silently dropped.
- **A space between number and unit.** `10 px` is invalid; write `10px`. Only `0` may be written without a unit.
- **Missing closing brace `}`.** Every rule after it can break.
- **Confusing `color` with `background-color`.** `color` changes the text, not the box.
- **Forgetting `rel="stylesheet"`.** The file is never applied as CSS.
- **Wrong path or wrong case in `href`.** `href="style.css"` looks in the same folder as the HTML file; use `css/style.css` or `../style.css` as needed. Check the Network tab in DevTools for a 404.
- **Wrong inline syntax.** `style="color=blue"` is invalid; use `style="color: blue;"`.
- **Expecting internal CSS to beat external CSS.** It is source order (and specificity) that decides.
- **Putting `<style>` tags in a `.css` file**, or putting CSS in a `<link>` tag.
- **Overusing inline styles** to "win" conflicts, which makes later overrides need `!important`.
- **Typos are silent.** Open DevTools (F12), select the element and look at the Styles panel: unknown properties and invalid values are crossed out or flagged with a warning icon.

## Key Takeaways

- CSS describes presentation; HTML describes structure. Keep them separate.
- A rule is `selector { property: value; }`. Each declaration ends with a semicolon, and a comma groups selectors that share declarations.
- When several rules match one element, their declarations merge; conflicts are resolved by the cascade.
- The browser ignores declarations it does not understand, so errors fail silently. Use DevTools to spot them.
- Browsers have default styles (the user-agent stylesheet); your CSS overrides them. Text properties like `color` inherit; box properties like `background-color`, `margin` and `border` do not.
- Inline = `style` attribute on one element; internal = `<style>` in one page; external = `.css` file linked with `<link rel="stylesheet">`. External is the default for real projects: reusable, cacheable, maintainable.
- Inline styles beat stylesheet selectors (only `!important` overrides them); internal and external CSS have the **same** priority, so specificity and then source order decide.
- CSS in the `<head>` is render-blocking on purpose; prefer `<link>` over `@import` so files download in parallel.

## Interview Questions

### Junior (0–1 year)

**Q1. What is CSS and why is it kept separate from HTML?**
CSS (Cascading Style Sheets) is a stylesheet language that describes how HTML elements are displayed. Keeping it separate means HTML holds meaning and structure while CSS holds presentation. One stylesheet can restyle many pages, it can be cached by the browser, and the same content can be styled differently for screen, mobile or print.

**Q2. Name the parts of a CSS rule.**
In `p { color: red; }`, `p` is the selector, everything in braces is the declaration block, `color: red;` is a declaration, `color` is the property and `red` is the value. A rule can contain many declarations, each ending with a semicolon.

**Q3. What does the comma mean in `p, div { background-color: burlywood; }`?**
It is a selector list (grouping). The declarations apply to every element that matches *any* of the selectors, so all `<p>` and all `<div>` elements get the background. It is shorthand for writing two separate rules with the same declarations.

**Q4. What does "cascading" mean in Cascading Style Sheets?**
It refers to the algorithm the browser uses when more than one declaration sets the same property on the same element. The browser compares origin and importance (`!important`), then specificity of the selectors, then source order, and the winning value is applied. Styles "cascade" down from many sources into one final value.

**Q5. What happens if you write an invalid property or value in CSS?**
The browser ignores that single declaration and keeps applying the rest of the rule. No error is shown on the page, which is why typos fail silently. DevTools marks invalid declarations so you can find them.

**Q6. What are the three ways to add CSS to an HTML page, and which is preferred?**
Inline CSS uses the `style` attribute on an element, internal CSS uses a `<style>` element in the page, and external CSS puts the rules in a separate `.css` file connected with `<link rel="stylesheet" href="...">`. External is preferred for real sites: one file styles the whole site, so a change is made once; the browser caches it, so other pages load faster; and HTML stays focused on content.

**Q7. Which has the highest priority: inline, internal or external CSS?**
Inline styles have the highest priority among normal author styles; they beat any selector in a stylesheet. Internal and external stylesheets are equal, so the more specific selector wins, and on a tie the one that appears later in the document wins. A declaration marked `!important` in a stylesheet can override a normal inline style.

**Q8. What does `rel="stylesheet"` do in a `<link>` tag?**
`rel` describes the relationship between the page and the linked resource. `stylesheet` tells the browser to download the file and apply it as CSS. Without it the browser does not treat the file as a stylesheet.

**Q9. Can you use `:hover` in an inline style?**
No. An inline style is a list of declarations with no selector, so it cannot use pseudo-classes, pseudo-elements or media queries. Use a class with an internal or external rule such as `.btn:hover { ... }` instead.

### Mid-level (2–4 years)

**Q10. Explain how the browser turns HTML and CSS into pixels, and why CSS is called render-blocking.**
The browser builds the DOM from HTML and the CSSOM from CSS, combines them into a render tree of visible elements with computed styles, runs layout to compute geometry, and then paints. Because the render tree needs the CSSOM, the browser delays the first paint until stylesheets in the `<head>` are loaded, which prevents a flash of unstyled content. That is why large or slow stylesheets hurt first-render performance.

**Q11. Given the CSS below, what color and background does the `<span>` get?**

```css
div { color: green; background-color: yellow; border: 1px solid red; }
```

```html
<div>Text <span>inside span</span></div>
```

The span text is green because `color` is inherited. It has no border of its own because `border` is not inherited. Its background is `transparent`, so the parent's yellow shows through; it looks yellow but the span itself has no background color set.

**Q12. What is the user-agent stylesheet, and why do projects use a reset or normalize stylesheet?**
It is the browser's built-in default CSS (margins on `<body>` and `<p>`, bold large headings, list bullets and so on). Defaults differ slightly between browsers. A reset removes them (for example `* { margin: 0; padding: 0; }`), while a normalize stylesheet keeps useful defaults but makes them consistent, so the team starts from a predictable baseline.

**Q13. What color is the paragraph, and why?**

```html
<head>
  <link rel="stylesheet" href="style.css"> <!-- p { color: green; } -->
  <style>
    p { color: red; }
  </style>
</head>
```

Red. Both rules have the same origin and the same specificity (one type selector), so source order decides, and the `<style>` block comes later. If the `<link>` were placed after the `<style>`, the paragraph would be green.

**Q14. A style you wrote is not being applied. How do you debug it?**
Inspect the element in DevTools and look at the Styles panel. If the rule is missing, the selector does not match (typo, wrong class, wrong case) or the stylesheet did not load: check the Network tab for a 404, which is often a case mismatch between `href="style.css"` and a file named `Style.css` (Windows ignores case, Linux servers do not). If the rule is present but crossed out, another declaration won the cascade; the panel shows which one, so you can compare specificity and order. A warning icon means the property or value is invalid.

**Q15. Why is `@import` slower than `<link>`?**
With `<link>`, the browser's preload scanner finds all stylesheets in the HTML and downloads them in parallel. A file referenced by `@import` is only discovered after the importing stylesheet has been downloaded and parsed, creating a sequential chain that delays rendering. Bundling or using multiple `<link>` tags avoids this.

**Q16. What is critical CSS, and why would you inline it in a `<style>` tag?**
Critical CSS is the minimum CSS needed to render the above-the-fold content. Inlining it in the `<head>` lets the browser paint the first screen without waiting for an external stylesheet request; the full stylesheet is then loaded in a way that does not block rendering. It improves metrics such as First Contentful Paint, at the cost of extra build complexity and HTML size.

**Q17. A security team enables a strict Content Security Policy and some styles stop working. Why?**
A CSP `style-src` directive without `'unsafe-inline'` blocks inline `style` attributes and `<style>` blocks (a `<style>` block is still allowed if it carries a nonce or hash listed in the policy). External stylesheets from allowed sources still load. The fix is to move styles to external files, or to add nonces/hashes for the `<style>` blocks that must stay.

**Q18. In a modern component-based app, when is an inline style still the right tool?**
When the value is truly dynamic per element and computed at runtime, such as a drag position, a progress percentage or a user-chosen color. A clean pattern is to set only a CSS custom property inline (`style="--progress: 40%"`) and keep the actual styling in a stylesheet (`width: var(--progress)`). Static styling should stay in classes so it can use media queries, pseudo-classes and caching.

### Senior (5+ years)

**Q19. How would you deliver CSS for a large site so that it is both fast on first load and cache-friendly on repeat visits?**
The tension is that one big bundle caches well but blocks first paint with CSS the page does not need, while many tiny files waste requests and complicate ordering. A practical setup:

- Inline a small critical CSS block (layout shell, above-the-fold components) and load the rest with a normal `<link>`; keep the inline part small, because it is re-downloaded with every HTML response.
- Split the remaining CSS along stable boundaries: a shared core file that changes rarely, plus per-route or per-feature files. HTTP/2 and HTTP/3 make a handful of files cheap; dozens are not.
- Fingerprint file names (`app.3f9a1c.css`) and serve them with `Cache-Control: max-age=31536000, immutable`, while the HTML is served with short or no caching so it always points at the current files.
- Use `media` attributes for print or rarely matching styles, and avoid `@import` chains.

Recommendation: critical inline CSS plus a small number of hashed, long-cached files, with a performance budget for the CSS shipped per route (tracked in CI) so it does not creep.

**Q20. After a deploy, some users report pages that look broken or half-styled, and it fixes itself after a hard refresh. How do you investigate and prevent it?**
This is almost always a version mismatch between HTML and CSS. Typical causes: the stylesheet URL is not versioned (`style.css`), so browsers or a CDN keep serving the old file with the new HTML; the HTML itself is cached too long and references old hashed files that were deleted in the deploy; or a CDN edge has a mix of old and new assets. Confirm it in DevTools by checking which file the page requested, its response headers (`Cache-Control`, `Age`, CDN cache status) and whether its content matches the release.

Prevention: content-hashed asset names, immutable caching only on hashed assets, short caching on HTML, and keeping the previous release's assets available for a while so pages already open in a tab do not 404 on lazily loaded CSS. Recommendation: treat "assets are immutable, HTML is not" as a deployment rule, and verify headers in the release checklist.

**Q21. You are building an embeddable widget that third-party sites will drop into their pages. How do you stop the host's CSS from breaking it, and your CSS from leaking into the host?**
Global CSS works against you in both directions: the host's resets and element selectors (`button { ... }`, `* { box-sizing: content-box }`) reach your markup, and your selectors can restyle the host. Options, from weakest to strongest isolation:

| Approach | Isolation | Cost |
|---|---|---|
| Prefixed class names (`.acme-widget__btn`) | Stops your CSS leaking out; host element selectors still reach you | Cheap, fragile |
| Prefix + `all: revert` on `.acme-widget, .acme-widget *` | Resets inherited and host-applied values on your elements, but host rules with higher specificity can still win | Must re-declare fonts and colors yourself |
| Shadow DOM | Host selectors do not match inside; your styles do not leak out. Inherited properties (`color`, `font`) and custom properties still flow in | Needs JavaScript; theming goes through custom properties and `::part()` |
| `<iframe>` | Complete isolation | Sizing, communication and accessibility are harder |

Recommendation: use Shadow DOM for a styled widget, expose a small theming API through custom properties, and set your own `font` and `color` on the host so inherited values from the page are deliberate rather than accidental.

> **Note:** Related questions answered elsewhere: [CSS selectors](../02-selectors/notes.md#interview-questions) (one invalid selector drops the whole rule).

## References

- [MDN: CSS reference](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [MDN: Selector list](https://developer.mozilla.org/en-US/docs/Web/CSS/Selector_list)
- [MDN: `<link>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
- [MDN: `<style>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style)
- [MDN: `style` global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/style)
- [MDN: `@import`](https://developer.mozilla.org/en-US/docs/Web/CSS/@import)
- [MDN: Content-Security-Policy: style-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src)
- [web.dev: Learn CSS](https://web.dev/learn/css)
- [web.dev: Extract critical CSS](https://web.dev/articles/extract-critical-css)
