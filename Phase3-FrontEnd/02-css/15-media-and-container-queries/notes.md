# CSS Media Queries and Container Queries

> CSS · Topic 15 · Demo: [index.html](index.html)

A media query applies a block of CSS only when a condition about the device or viewport is true, for example "the screen is narrower than 480px" or "the user prefers dark mode". Media queries are the core tool of **responsive design**: one HTML page that adapts its layout to phones, tablets, laptops and large screens. Their limit is that they only know about the viewport, so a reusable component cannot tell whether it sits in a narrow sidebar or a wide main column. **Container queries** fill that gap: they test the size (or a custom property) of an ancestor element. The note covers media queries first, using the demo, then container queries in full: `container-type`, named containers, container query units and style queries.

## The viewport meta tag comes first

Every responsive page needs this line in `<head>` (the demo has it):

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

Without it, mobile browsers pretend the screen is about 980px wide and zoom the page out. Your `max-width: 480px` queries would never match on a phone, because the browser reports 980px, not the real width.

## Syntax

The demo's comment shows the general form:

```css
@media not|only mediatype and (expressions) {
  CSS-Code;
}
```

| Part | Meaning | Example |
| --- | --- | --- |
| `@media` | starts the media query | |
| `not` / `only` | optional modifiers (see below) | `only screen` |
| media type | the kind of device | `screen`, `print`, `all` |
| `and` | combines the type and the conditions | `screen and (max-width: 455px)` |
| `(expressions)` | media features to test, always in parentheses | `(orientation: portrait)` |
| `{ ... }` | ordinary CSS rules that apply only when the query matches | `body { background: blue; }` |

The demo uses two queries:

```css
body {
  background-color: red;                 /* default for every screen */
}

@media screen and (orientation: portrait) {
  body {
    border: 2px solid purple;            /* only when taller than wide */
  }
}

@media only screen and (max-width: 455px) {
  body {
    background-color: blue;              /* only on viewports 455px wide or less */
  }

  .boxes {
    flex-direction: column;              /* stack the boxes vertically */
  }
}

.boxes {
  display: flex;
}
```

What you see when you resize the window:

- Wider than 455px: red body, the three 344px boxes side by side.
- 455px or narrower: blue body and the boxes stacked in a column.
- Whenever the window is **taller than it is wide** (even on a desktop): a purple border.

> **Note:** `.boxes { display: flex; }` is written **after** the media query and still works together with it, because it sets a different property (`display`, not `flex-direction`). If that later rule also said `flex-direction: row`, it would override the media query, because media queries add no specificity and the later rule wins. Put media queries **after** the base styles they modify.

## Media types

| Type | Matches |
| --- | --- |
| `all` | every device (the default if you leave the type out) |
| `screen` | screens: phones, tablets, computers, TVs |
| `print` | printing and print preview |

Older types such as `handheld`, `tv` and `projection` are deprecated and should not be used. Most modern queries leave the type out entirely: `@media (max-width: 600px)` means `all and (max-width: 600px)`.

## Logical operators

| Operator | Meaning | Example |
| --- | --- | --- |
| `and` | all conditions must be true | `@media screen and (min-width: 768px) and (orientation: landscape)` |
| `,` (comma) | OR: any of the queries can match | `@media (max-width: 480px), print` |
| `not` | negates the whole query | `@media not print` (everything except printing) |
| `only` | hides the query from very old browsers that do not understand media features. Modern browsers ignore it, so `only screen` = `screen`. | `@media only screen and (max-width: 455px)` |

## Media features you will actually use

| Feature | True when | Example |
| --- | --- | --- |
| `min-width` | viewport is **at least** this wide | `(min-width: 768px)` |
| `max-width` | viewport is **at most** this wide | `(max-width: 480px)` |
| `min-height` / `max-height` | same, for height | `(max-height: 500px)` |
| `orientation` | `portrait` (height >= width) or `landscape` | `(orientation: portrait)` |
| `aspect-ratio` | width/height ratio | `(min-aspect-ratio: 16/9)` |
| `resolution` | pixel density | `(min-resolution: 2dppx)` for high-DPI screens |
| `hover` | the main input can hover | `(hover: hover)` |
| `pointer` | precision of the main pointer | `(pointer: coarse)` for touch |
| `prefers-color-scheme` | the OS/browser theme | `(prefers-color-scheme: dark)` |
| `prefers-reduced-motion` | the user asked for less animation | `(prefers-reduced-motion: reduce)` |
| `prefers-contrast` | the user asked for more (or less) contrast | `(prefers-contrast: more)` |
| `forced-colors` | a forced high-contrast palette is active (Windows contrast themes) | `(forced-colors: active)` |

> **Note:** `min-width` and `max-width` in a media query test the **viewport**, not an element. They are not the same as the `min-width`/`max-width` properties you put on elements.

### Modern range syntax

Media Queries Level 4 lets you write comparisons with `<`, `<=`, `>` and `>=`. It is supported in all current major browsers and is easier to read:

```css
@media (width <= 480px) { /* same as max-width: 480px */ }

@media (481px <= width <= 767px) { /* between 481 and 767 */ }

@media (width > 1280px) { /* strictly greater than 1280 */ }
```

## Common breakpoints (from the lecture)

These ranges are the ones the lecture uses. The comments are the usual device labels:

```css
/* Media Query for Mobile Devices */
@media (max-width: 480px) {
  body {
    background-color: red;
  }
}

/* Media Query for low resolution Tablets, iPads */
@media (min-width: 481px) and (max-width: 767px) {
  body {
    background-color: yellow;
  }
}

/* Media Query for Tablets, iPads portrait mode */
@media (min-width: 768px) and (max-width: 1024px) {
  body {
    background-color: blue;
  }
}

/* Media Query for Laptops and Desktops */
@media (min-width: 1025px) and (max-width: 1280px) {
  body {
    background-color: green;
  }
}

/* Media Query for Large screens */
@media (min-width: 1281px) {
  body {
    background-color: white;
  }
}
```

Things to know about breakpoints:

- There are **no official breakpoints**. These numbers are conventions. Good practice is to add a breakpoint where **your content** starts to look broken, not where a particular device happens to be.
- **Fractional widths** fall through the gaps. With browser zoom or high-DPI screens the viewport can be 480.5px wide, which matches neither `max-width: 480px` nor `min-width: 481px`. The range syntax avoids gaps:
  ```css
  @media (width <= 480px) { ... }
  @media (480px < width <= 767px) { ... }
  ```
- **Overlaps** cause the opposite problem: `max-width: 768px` and `min-width: 768px` both match at exactly 768px.

## Mobile-first vs desktop-first

| | Mobile-first | Desktop-first |
| --- | --- | --- |
| Base styles (no media query) | for small screens | for large screens |
| Media queries use | `min-width` (add things as the screen grows) | `max-width` (undo things as it shrinks) |
| Typical result | simpler base CSS, phones apply fewer overrides | more overriding and resetting for mobile |

Mobile-first example:

```css
.boxes {
  display: flex;
  flex-direction: column;     /* phones: stacked */
}

@media (min-width: 600px) {
  .boxes {
    flex-direction: row;      /* bigger screens: side by side */
  }
}
```

The demo is desktop-first: the boxes are in a row by default, and a `max-width` query stacks them on small screens. Both approaches work. Mobile-first is the common recommendation today because most traffic is mobile and the base CSS stays simpler.

## Other places media queries appear

**In HTML, to load a stylesheet only for some media:**

```html
<link rel="stylesheet" href="print.css" media="print">
```

**In `<picture>`, to serve different images:**

```html
<picture>
  <source media="(min-width: 800px)" srcset="large.jpg">
  <img src="small.jpg" alt="Product photo">
</picture>
```

**In JavaScript, with `matchMedia`:**

```js
const mq = window.matchMedia('(max-width: 455px)');

console.log(mq.matches);          // true or false right now

mq.addEventListener('change', (e) => {
  console.log(e.matches ? 'small screen' : 'large screen');
});
```

**Print styles and user preferences:**

```css
@media print {
  nav, .ads { display: none; }
  body { color: black; background: white; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none; transition: none; }
}
```

## Container queries

Media queries look at the **viewport**. A card in a narrow sidebar and the same card in a wide main column see the same viewport width, so they cannot style themselves differently. **Container queries** solve that by testing the size of an **ancestor element** instead, so a component adapts to the space it is actually given, wherever it is placed.

It takes two steps: mark an ancestor as a container, then write `@container` rules for its descendants.

```css
.card-slot {
  container-type: inline-size;   /* step 1: descendants may now query this element's width */
}

.card {
  display: grid;
  gap: 1rem;
}

@container (width >= 30rem) {    /* step 2: true when the nearest container is at least 30rem wide */
  .card {
    grid-template-columns: 10rem 1fr;   /* image beside the text */
  }
}
```

The same `.card` markup now stacks in a narrow slot and goes side by side in a wide one, on any screen size. Size queries and container query units have been supported in every major browser since 2023.

### `container-type`

| Value | Descendants can query | Containment applied to the element | When to use |
| --- | --- | --- | --- |
| `normal` (default) | no size queries, only style queries | none | every element is this by default |
| `inline-size` | its width (inline size) | inline-size, layout and style containment | almost always |
| `size` | its width **and** height | size (both axes), layout and style containment | only when the element has a definite height |

Containment is what makes container queries possible without infinite loops: if the container's width could depend on its children, and the children's styles depend on the container's width, the browser could never settle. So `inline-size` tells the browser "this element's width never comes from its content". That has consequences:

- **The container must get its width from outside.** A normal block, a grid area or a growing flex item is fine. An element that normally shrinks to fit its content (a float, `inline-block`, an absolutely positioned box, a flex item with `flex: none`) collapses to zero width, because its content no longer counts.
- **`size` ignores the content in both directions**, so without an explicit `height` the container collapses to zero height. That is why `inline-size` is the usual choice.
- **The container cannot query itself.** An `@container` rule styles descendants of the container. A rule that targets the container element looks for a container further up the tree. In practice you add `container-type` to a wrapper or slot element, not to the component root you want to restyle.
- **Layout containment makes the container a containing block for `absolute` and `fixed` descendants and a stacking context**, so a "fixed" toast inside it stops being fixed to the viewport. See [Position and z-index](../11-position-and-z-index/notes.md#things-other-than-position-that-create-the-reference-box).

### `@container` syntax

The conditions are the media-query size features, evaluated against the container instead of the viewport:

```css
@container (min-width: 400px) { ... }                 /* classic min/max form */
@container (400px <= width < 700px) { ... }           /* range syntax */
@container (inline-size > 30em) { ... }               /* logical axis names: inline-size, block-size */
@container (orientation: landscape) { ... }           /* needs container-type: size */
@container (width > 40rem) and (height > 20rem) { ... }   /* and, or, not work as in media queries */
```

An unnamed `@container` rule uses the **nearest ancestor that is a container able to answer the query**: for a width query, the nearest `inline-size` or `size` container.

### Named containers

When containers nest (a card inside a sidebar inside a page section), the nearest one may not be the one you mean. Give containers names and query by name:

```css
.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

.main {
  container: main / inline-size;   /* shorthand: <name> / <type> */
}

@container sidebar (width < 20rem) {
  .card { font-size: 0.875rem; }   /* only when the card's nearest "sidebar" ancestor is narrow */
}
```

- A named query skips any closer containers with other names and uses the nearest ancestor with that name.
- An element can have several names (`container-name: sidebar layout-slot;`), so one slot can answer to a generic and a specific name.
- If no ancestor with that name exists, the query simply does not match.

### Container query units

| Unit | 1 unit equals |
| --- | --- |
| `cqw` | 1% of the container's width |
| `cqh` | 1% of the container's height |
| `cqi` | 1% of the container's inline size |
| `cqb` | 1% of the container's block size |
| `cqmin` | the smaller of `cqi` and `cqb` |
| `cqmax` | the larger of `cqi` and `cqb` |

```css
.card h2 {
  /* grows with the card, not the viewport; the rem parts keep it readable and zoomable */
  font-size: clamp(1rem, 0.75rem + 2cqi, 1.75rem);
}
```

- They resolve against the nearest container that can measure that axis: `cqi`/`cqw` need an `inline-size` or `size` container, `cqb`/`cqh` need a `size` container.
- If there is no eligible container, they quietly fall back to the small viewport units (`svw`, `svh`), so a missing `container-type` gives you viewport-based sizes, not an error.
- Prefer `cqi`/`cqb` over `cqw`/`cqh`: logical units keep working in vertical writing modes.

### Style queries

A style query tests the computed value of a **custom property** on the container, instead of its size:

```css
.promo-slot {
  --variant: compact;
}

@container style(--variant: compact) {
  .card {
    padding: 0.5rem;
    gap: 0.25rem;
  }
}
```

- No `container-type` is needed: every element is a container for style queries. An unnamed style query checks the nearest ancestor, and because custom properties inherit, a value set higher up is still seen.
- Only **custom properties** can be queried in practice. The spec also allows normal properties (`style(display: flex)`), but no browser implements that.
- Use them to switch a component's variant from a parent (a "dense" region, a dark band in a light page) without adding a class to every child. Combine with size queries when needed: `@container sidebar (width < 20rem) and style(--variant: compact)`.

> **Note:** Style queries for custom properties work in Chromium-based browsers and Safari, but not yet in Firefox at the time of writing. Treat them as an enhancement: the component must still look acceptable when the query never matches.

### Support at a glance

| Feature | Support (2026) |
| --- | --- |
| Size queries: `container-type`, `container-name`, `@container` | All major browsers since 2023 |
| Container query units (`cqi`, `cqb`...) | All major browsers since 2023 |
| Style queries on custom properties | Chromium and Safari, not Firefox yet |
| Style queries on normal properties | Not implemented anywhere |
| Scroll-state queries (`container-type: scroll-state`, `@container scroll-state(stuck: top)`) | Chromium only |

Check [caniuse.com](https://caniuse.com/css-container-queries) before relying on the newer rows, and use `@supports (container-type: inline-size)` if you must serve very old browsers.

### Media queries vs container queries

| | Media queries | Container queries |
| --- | --- | --- |
| Test | viewport size, device and user preferences | size (or custom properties) of an ancestor element |
| Set-up needed | none | `container-type` on an ancestor |
| Can read user preferences (`prefers-*`, `hover`, `print`) | Yes | No |
| Best for | page layout, preferences, print, input type | reusable components that appear in slots of different widths |

They complement each other: media queries decide the page layout and react to preferences, container queries live inside components.

> **Note:** To try container queries on the demo, add `body { container-type: inline-size; }` and change `@media only screen and (max-width: 455px)` to `@container (width <= 455px)`. The boxes still stack on narrow windows, because `.boxes` is a descendant of `body`. The background no longer turns blue, because the `body { background-color: blue; }` rule targets the container itself, and a container cannot query itself.

## Common Mistakes

- **Missing viewport meta tag**, so phone-sized queries never match on real phones.
- **Media query written before the base rule** for the same property and selector. The base rule comes later and wins.
- **No space after `and`:** `screen and(max-width: 455px)` is invalid. Write `and (max-width: 455px)`.
- **Gaps and overlaps** between `max-width` and `min-width` ranges (see the breakpoints section).
- **Designing for device names** ("iPhone width") instead of content. Devices change every year.
- **Testing only by resizing the desktop window.** Also use the DevTools device toolbar and a real phone: touch (`hover`, `pointer`) and pixel density behave differently.
- **Using media queries inside reusable components.** The component then breaks when it is placed in a narrower slot than the one it was designed for. Use container queries.
- **Putting `container-type` on the element you want to restyle.** A container cannot query itself; put it on a wrapper or slot.
- **Putting `container-type: inline-size` on a shrink-to-fit element** (float, `inline-block`, `flex: none` item) and watching it collapse to zero width.
- **Using `container-type: size` without a height.** The container ignores its content's height and collapses.
- **Using `cqi` with no container in the tree.** It silently falls back to viewport units instead of failing.

## Key Takeaways

- A media query applies CSS only when its conditions match: `@media [not|only] type and (feature) { ... }`.
- Always include `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.
- `min-width` means "this wide or wider"; `max-width` means "this wide or narrower". Both test the viewport.
- Media queries add no specificity, so place them after the base styles.
- Breakpoints are conventions. Choose them where the content needs them, and use range syntax to avoid gaps.
- Mobile-first (`min-width`) is the common modern approach.
- Use `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`, `hover` and `pointer` for preferences and input types.
- Container queries make components respond to their own space: `container-type: inline-size` on an ancestor, then `@container (width >= 30rem) { ... }` for its descendants.
- Name containers (`container: sidebar / inline-size`) when they nest, and size things relative to the container with `cqi`/`cqb`.
- Size queries and units work everywhere; style queries (`@container style(--x: y)`) are not in Firefox yet, so use them as an enhancement.

## Interview Questions

### Junior (0–1 year)

**Q1. What is a media query?**
A CSS rule that applies a set of styles only when certain conditions about the device or viewport are true, such as width, orientation, print mode or the user's colour-scheme preference. It is the main tool for responsive design.

**Q2. Explain each part of `@media only screen and (max-width: 455px) { ... }`.**
`@media` starts the query, `only` is a legacy keyword that hides the query from very old browsers, `screen` is the media type, `and` combines conditions, and `(max-width: 455px)` is a media feature that is true when the viewport is 455px wide or narrower. The rules inside the braces apply only while the whole query is true.

**Q3. What is the difference between `min-width` and `max-width` in a media query?**
`(min-width: 768px)` matches viewports 768px **or wider**. `(max-width: 768px)` matches viewports 768px **or narrower**. Mobile-first CSS mostly uses `min-width`, and desktop-first CSS mostly uses `max-width`.

**Q4. Why do responsive pages need the viewport meta tag?**
Without `<meta name="viewport" content="width=device-width, initial-scale=1.0">`, mobile browsers lay the page out on a virtual viewport about 980px wide and zoom out. Small-screen media queries never match and the text is tiny. The tag tells the browser to use the device's real width.

**Q5. Using the demo, what does the page look like on a 400px-wide phone held upright?**
The body is blue (the `max-width: 455px` rule overrides the red default), it has a purple border (portrait orientation), and the three boxes are stacked in a column because `flex-direction: column` applies inside the small-screen query.

**Q6. How do you write styles that apply only when printing?**
Use `@media print { ... }` in the stylesheet, or a separate file with `<link rel="stylesheet" href="print.css" media="print">`. Typical print styles hide navigation and ads, switch to black text on white, and remove backgrounds.

### Mid-level (2–4 years)

**Q7. What is mobile-first CSS, and why is it usually preferred?**
Base styles target small screens and `min-width` media queries add enhancements as the screen grows. The base CSS stays simple (usually a single column), mobile devices apply fewer overrides, and it pushes you to prioritise content. Desktop-first does the opposite with `max-width` and tends to need more undoing.

**Q8. Your breakpoints are `max-width: 767px` and `min-width: 768px`. A tester at 767.5px (browser zoom) sees broken styles. Why, and how do you fix it?**
At 767.5px neither query matches, so neither set of styles applies. Use the range syntax, which has no gaps: `(width < 768px)` and `(width >= 768px)`. In older code, a common workaround was `max-width: 767.98px`.

**Q9. What is the difference between media queries and container queries?**
Media queries respond to the viewport (or device features and user preferences). Container queries respond to the size of an ancestor element marked with `container-type` (or, with style queries, to a custom property on it). A reusable component, such as a card used in both a sidebar and a main column, should use container queries, because its available space does not depend on the viewport. Container queries cannot read user preferences such as `prefers-color-scheme`, so both are needed.

**Q10. How do you react to a breakpoint in JavaScript?**
Use `window.matchMedia('(max-width: 455px)')`. Its `.matches` property gives the current state, and `mq.addEventListener('change', handler)` fires only when the query flips. This is more efficient than listening to every `resize` event and checking `innerWidth`.

**Q11. How would you respect users who get motion sickness or prefer dark mode?**
Wrap non-essential animation in a check, or disable it with `@media (prefers-reduced-motion: reduce) { ... }`. Provide a dark theme with `@media (prefers-color-scheme: dark)`, ideally by redefining CSS variables so the rest of the stylesheet does not change.

**Q12. Your media query styles are not applying. What is your debugging checklist?**
1) Is the viewport meta tag present? 2) Is the syntax valid (space after `and`, parentheses around features, no stray semicolon before `{`)? 3) Is the media query placed before a later base rule that overrides it, or does it lose on specificity? 4) Does the query actually match? Check the viewport size in DevTools, which also lists matching media rules in the Styles panel. 5) Is the stylesheet linked with a restrictive `media` attribute?

**Q13. On touch devices, your `:hover` dropdown gets stuck open. How can media queries help?**
Apply hover-only effects inside `@media (hover: hover) and (pointer: fine) { ... }`, so they run only on devices with a real mouse. Touch devices then rely on a click or tap interaction that you provide separately.

**Q14. You added `container-type: inline-size` and an `@container (width > 30rem)` rule, but either the rule never applies or the component collapses to zero width. What do you check?**
1) Is `container-type` on an **ancestor** of the element being styled? A container cannot query itself, so `container-type` and the `@container` rule on the same element never match. 2) Is the container shrink-to-fit (a float, `inline-block`, `position: absolute`, a `flex: none` item)? Inline-size containment means its content no longer gives it a width, so it collapses; move `container-type` to a block-level wrapper whose width comes from its parent. 3) With `container-type: size`, does it have an explicit height? 4) Is a closer, unnamed container answering the query instead of the one you meant? Name the container and query it by name. DevTools shows a "container" badge on query containers and lists the matched `@container` rule in the Styles panel.

### Senior (5+ years)

**Q15. Your design system's components use viewport media queries, and they break when product teams place them in sidebars and modals. How would you migrate the library to container queries?**
Split responsibilities first: **page layout** stays on media queries (and preferences always do), **components** respond only to their container. Then:

1. **Make layout slots the containers.** The layout primitives (page regions, sidebar, modal body, grid cells) set `container: <name> / inline-size`. Components never set `container-type` on themselves, which avoids the "cannot query itself" trap and accidental zero-width collapses.
2. **Express component breakpoints in container terms** (`@container (width >= 30rem)`), sized for the component's content, not for devices.
3. **Migrate component by component**, keeping the old media query until the new rule ships, and test each component in a resizable frame (Storybook with a resizable wrapper), not by resizing the browser.
4. **Watch the containment side effects:** containers become containing blocks for `fixed` descendants and stacking contexts, so toasts and dropdowns rendered inside them must use portals or the top layer.

Recommendation: containers at the layout level, queries at the component level, and a lint rule that flags `@media (width...)` inside component styles once the migration is done.

**Q16. The same breakpoints are written in Sass, in a JavaScript `matchMedia` call and in `<picture>` markup, and they drift apart. How do you keep them in sync?**
`var()` cannot be used inside a media condition (see [Custom Properties](../16-custom-properties/notes.md#interview-questions)), and `@custom-media` (`@custom-media --md (width >= 48rem);`) is specified but not shipped in browsers, so the breakpoint must be shared at **build time**:

- Keep breakpoints in one design-token file (JSON), the source of truth.
- Generate from it: Sass variables or PostCSS `@custom-media` definitions (compiled away by `postcss-custom-media`), a TypeScript module for `matchMedia`, and constants for `sizes`/`<source media>` in templates.
- Prefer `em` or `rem` breakpoints so they react to the user's default font size.

Recommendation: one token source, generated outputs, and no hand-written breakpoint numbers in application code. Better still, move component-level breakpoints to container queries, which reduces how many viewport breakpoints exist at all.

**Q17. Cards now resize with container queries, but their images are still downloaded at the wrong size. Why can't `sizes` use the container width, and what can you do?**
The browser picks a candidate from `srcset` very early, often in the preload scanner before CSS and layout exist, so it only knows the viewport. `sizes` therefore accepts media conditions, not container conditions. Options:

- Write a `sizes` value that approximates the card's width per viewport range (`sizes="(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw"`). It is imprecise but cheap.
- For lazy-loaded images, `sizes="auto"` (with `loading="lazy"`) lets the browser use the laid-out width, because the image is fetched after layout. It shipped in Chromium; other engines ignore `auto` and need the explicit list as a fallback (`sizes="auto, (min-width: 40rem) 50vw, 100vw"`).
- Let an image CDN serve width-specific variants, so a slightly wrong choice costs little.

Recommendation: explicit `sizes` for above-the-fold images (which should not be lazy-loaded anyway), and `sizes="auto, <fallback>"` for lazy images below the fold.

**Q18. Beyond dark mode and reduced motion, which user preferences should a production stylesheet respect, and what usually breaks?**

- **`forced-colors: active`** (Windows contrast themes): the browser replaces your colours with a small system palette and removes `box-shadow`, `text-shadow` and gradient backgrounds. Focus rings drawn with `box-shadow` disappear, and icons drawn as background images keep their original colours, so they can vanish against the new background. Use real `outline`s (a `transparent` outline is recoloured and becomes visible), inline SVG with `fill: currentColor`, and system colour keywords (`CanvasText`, `Highlight`) for custom controls. Use `forced-color-adjust: none` only on things like colour swatches.
- **`prefers-contrast: more`**: strengthen borders and muted text colours, usually by redefining a few custom properties.
- **Zoom and text size:** media queries in `em`/`rem` respond to the user's default font size (relative units in media queries use the browser's initial font size, not your `html { font-size }`), and layouts must reflow at 320 CSS px wide (WCAG 1.4.10).

Recommendation: implement preferences by redefining design tokens, not by sprinkling overrides, and add forced-colours and 400% zoom checks to the accessibility test pass. More in [Accessibility](../../01-html/11-accessibility/notes.md).

## References

- [CodeWithHarry: CSS Media Queries](https://www.codewithharry.com/tutorial/css-media-queries/)
- [CodeWithHarry: CSS Media Queries (Advanced)](https://www.codewithharry.com/tutorial/css-media-queries-advanced/)
- [MDN: @media](https://developer.mozilla.org/en-US/docs/Web/CSS/@media)
- [MDN: Using media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries)
- [MDN: Window.matchMedia()](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
- [MDN: Container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
- [MDN: Using container size and style queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries)
- [MDN: container-type](https://developer.mozilla.org/en-US/docs/Web/CSS/container-type)
- [MDN: @container](https://developer.mozilla.org/en-US/docs/Web/CSS/@container)
- [MDN: forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)
- [Can I use: CSS container queries](https://caniuse.com/css-container-queries)
- [web.dev Learn Responsive Design: Media queries](https://web.dev/learn/design/media-queries)
