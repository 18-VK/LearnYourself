# Overflow and Scrolling

> CSS · Topic 10 · Demo: [index.html](index.html)

Sometimes the content is too large to fit in a single line or inside the box (division) it was given. The `overflow` property decides what happens to the part that does not fit: show it spilling out, cut it off, or add scrollbars so the information is not lost. This note covers the `overflow` values and their side effects, truncating text on one or several lines, long words, unwanted and intentional horizontal scrollbars, and the modern scrolling properties: scroll snap, `scrollbar-gutter`, `overscroll-behavior`, smooth scrolling and scrollbar styling.

## When does overflow happen?

Content overflows when its box has a **constrained size** and the content needs more room than that. Typical causes:

- A fixed `height` (or `max-height`) with more text than fits. The demo box is `width: 30vw; height: 30vh;` and holds a long paragraph.
- A long unbreakable word or URL, or text with `white-space: nowrap`, inside a narrow box.
- An image or table wider than its container.

> **Note:** If a block has no fixed height, it simply grows taller to fit its content, so there is no vertical overflow to control. `overflow` only matters once something limits the box's size.

## The `overflow` values

| Value | What happens to the extra content |
| --- | --- |
| `visible` | **Default.** The overflow is not clipped. The content renders outside the element's box and can overlap whatever comes next. |
| `hidden` | The overflow is clipped and the rest of the content is invisible. No scrollbar, but the box can still be scrolled from JavaScript (`el.scrollTop = 100`). |
| `clip` | Like `hidden`, but even programmatic scrolling is forbidden and the box does not become a scroll container. |
| `scroll` | The overflow is clipped and a scrollbar is added to see the rest of the content. Scrollbars show **even when nothing overflows**. |
| `auto` | Similar to `scroll`, but scrollbars are added only when necessary. |

```css
.box {
  width: 30vw;
  height: 30vh;
  border: 2px solid black;
  overflow: auto;   /* scrollbar appears only if the text does not fit */
}
```

> **Note:** On systems with overlay scrollbars (macOS, most phones), `scroll` and `auto` can look identical because scrollbars are hidden until you scroll. On Windows, `scroll` always shows the scrollbar tracks. In practice `auto` is the right choice almost every time.

## `overflow-x` and `overflow-y`

The `overflow-x` and `overflow-y` properties specify whether to change the overflow of content just horizontally or vertically (or both):

- `overflow-x` specifies what to do with the **left/right** edges of the content.
- `overflow-y` specifies what to do with the **top/bottom** edges of the content.

```css
.box {
  overflow-x: hidden;   /* never scroll sideways */
  overflow-y: scroll;   /* always offer a vertical scrollbar */
}
```

`overflow` itself is a shorthand for these two.

### The two-value shorthand (used in the demo)

```css
overflow: auto hidden;
```

With two values, the **first is `overflow-x`** and the **second is `overflow-y`**. So the demo means:

- horizontal: `auto` (scrollbar only if needed)
- vertical: `hidden` (clip, no scrollbar)

In the demo the text wraps normally, so nothing overflows sideways and no horizontal scrollbar appears. The paragraph is taller than `30vh`, so the bottom of the text is simply cut off with no way to scroll to it.

> **Note:** You cannot mix `visible` with a scrolling/hidden value. If one axis is anything other than `visible`/`clip`, a `visible` on the other axis is computed as `auto`. `overflow-x: hidden; overflow-y: visible;` actually behaves like `overflow-y: auto`.

## Truncating text with an ellipsis (`text-overflow`)

The commented lines in the demo show the classic one-line truncation ("This is a long ti..."). It needs **all three** declarations, plus a box with a limited width:

```css
.truncate {
  white-space: nowrap;       /* keep the text on one line */
  overflow: hidden;          /* clip what does not fit */
  text-overflow: ellipsis;   /* show "..." where it was cut */
}
```

| Missing piece | Result |
| --- | --- |
| no `white-space: nowrap` | Text wraps onto new lines, so nothing overflows horizontally and no ellipsis appears. |
| no `overflow: hidden` | Text spills out of the box. `text-overflow` only acts on clipped content. |
| element is `display: inline` | Inline elements have no width to overflow. Use a block, inline-block or flex item. |

### Multi-line truncation

To cut text after N lines (card descriptions, previews), use line clamping. The prefixed version works in all modern browsers:

```css
.clamp-3 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;     /* show at most 3 lines, then "..." */
  overflow: hidden;
}
```

A standard, unprefixed `line-clamp` property is specified but not yet broadly supported, so keep the prefixed form. The full text is still in the DOM, so screen readers read all of it.

## Long words: `overflow-wrap` and `word-break`

A long URL or word with no spaces cannot wrap, so it overflows even without a fixed height. Fix it with wrapping instead of clipping:

| Property | Effect |
| --- | --- |
| `overflow-wrap: break-word` | Breaks a long word only if it would otherwise overflow. |
| `overflow-wrap: anywhere` | Same, and the breaking opportunities also count when calculating min-content width (useful inside flex/grid items). |
| `word-break: break-all` | Breaks between any two characters, even in normal words. Usually too aggressive for English text. |

```css
.comment { overflow-wrap: break-word; }
```

## Side effects of a non-`visible` overflow

Setting `overflow` to `hidden`, `scroll` or `auto` does more than clip:

1. **It creates a block formatting context (BFC).** The box now contains its floats (it no longer collapses to zero height around floated children) and its margins stop collapsing with its children's margins. This is the old "`overflow: hidden` clearfix" trick (see [Float, clear and BFC](../12-float-clear-bfc/notes.md)).
2. **It becomes a scroll container.** Any `position: sticky` descendant sticks relative to this box, not the page. That is why a sticky header "stops working" inside a parent with `overflow: hidden` (see [Position and z-index](../11-position-and-z-index/notes.md)).
3. **It clips more than text.** Box shadows, focus outlines and dropdown menus of children are cut off at the edge. An absolutely positioned child is clipped when the overflow element (or something inside it) is its containing block, for example a `position: relative; overflow: hidden;` card with a dropdown inside.

`overflow: clip` gives you clipping without the scroll container, so sticky descendants keep working.

## Horizontal Scrollbars

"Horizontal scrollbar" can mean two different things: a bug, or a deliberate scrolling row.

### a) An unwanted horizontal scrollbar (a bug)

The page scrolls sideways because something is wider than the viewport. Common causes:

| Cause | Fix |
| --- | --- |
| A fixed `width` larger than small screens (`width: 500px`) | Use `max-width` (see [Units and sizing](../05-units-and-sizing/notes.md)) |
| `width: 100vw`: `100vw` includes the vertical scrollbar's width on Windows, so the element is slightly wider than the page | Use `width: 100%` |
| `width: 100%` plus padding or border with `box-sizing: content-box` | `box-sizing: border-box` |
| Large images or videos | `max-width: 100%; height: auto;` |
| Long unbroken text (URLs, long words) | `overflow-wrap: anywhere;` (or `break-word`) |
| Elements moved off-screen with `transform`, negative margins or absolute positioning | Clip them inside a parent with `overflow: hidden` or `overflow: clip` |

To find the culprit, temporarily outline everything and look for the box that sticks out:

```css
* {
  outline: 1px solid red;
}
```

`overflow-x: hidden` on the page hides the scrollbar, but it also hides the cause and can cut off content. Use it as a last resort. On a wrapper element, `overflow-x: hidden` creates a scroll container, which stops `position: sticky` from working for its descendants. `overflow-x: clip` (supported in all modern browsers) cuts off the overflow without creating a scroll container.

### b) An intentional horizontal scrolling row (a carousel)

A row of cards that scrolls sideways is built with `overflow-x: auto` and, for nicer behaviour, scroll snapping (next section):

```css
.row {
  display: flex;
  gap: 1rem;
  overflow-x: auto;                /* scrollbar appears only when needed */
  scroll-snap-type: x mandatory;   /* stop on a card, not halfway between two */
  padding-bottom: 0.5rem;          /* room for the scrollbar */
}

.row > .card {
  flex: 0 0 80%;                   /* don't grow, don't shrink: each card is 80% of the row */
  scroll-snap-align: start;
}

@media (min-width: 768px) {
  .row > .card { flex-basis: calc((100% - 2rem) / 3); }   /* 3 cards visible (2 gaps of 1rem) */
}
```

The repo has a complete example with arrow buttons, dragging and JavaScript: [Infinite card carousel](../../05-projects/04-horizontal-carousel/notes.md). It uses a grid (`grid-auto-flow: column`) instead of flexbox, plus `scroll-snap-type`, and hides the scrollbar with `scrollbar-width: none` and `::-webkit-scrollbar { display: none; }`.

Accessibility for scrolling rows:

- If you hide the scrollbar, provide another visible way to scroll, such as arrow buttons, and keep them keyboard accessible.
- Make the scrolling region focusable so keyboard users can scroll it with the arrow keys: `<div class="row" tabindex="0" role="region" aria-label="Featured products">`. (Chrome since version 130 and Firefox make scroll containers focusable on their own when they contain nothing focusable; Safari does not, so keep the `tabindex`.)
- `scroll-behavior: smooth` is motion too: turn it off inside `@media (prefers-reduced-motion: reduce)`.

## Scroll Snap

Scroll snap makes a scroll container come to rest on defined positions (a card, a slide, a section) instead of anywhere in between. It is pure CSS and keeps native scrolling: touch momentum, trackpads, the keyboard and scrollbars all still work.

```css
.carousel {
  overflow-x: auto;
  scroll-snap-type: x mandatory;   /* axis + strictness */
  scroll-padding-inline: 1rem;     /* snap positions start 1rem inside the edge */
}

.carousel > .slide {
  scroll-snap-align: start;        /* or center / end */
  scroll-snap-stop: always;        /* a fast swipe cannot skip past this slide */
}
```

| Property | Set on | What it does |
| --- | --- | --- |
| `scroll-snap-type` | container | Axis (`x`, `y`, `both`, `inline`, `block`) and strictness: `mandatory` always rests on a snap point, `proximity` snaps only when the scroll ends near one |
| `scroll-padding` | container | Moves the snap area inward, for example to leave room for a sticky header |
| `scroll-snap-align` | child | Which edge of the child lines up with the container: `start`, `center`, `end` |
| `scroll-snap-stop` | child | `always` stops on every child even after a fast swipe |
| `scroll-margin` | child | Adds space around one child's snap area |

- Use `mandatory` for carousels whose items are smaller than the container. For full-page vertical sections, prefer `proximity`: with `mandatory`, a section taller than the screen or content that changes height can make parts hard to reach.
- `scroll-padding-top` on the page's scroll container also stops in-page anchor links from landing under a fixed header; that question is answered in [Headings, links and bookmarks](../../01-html/02-headings-links-bookmarks/notes.md#interview-questions).

## `scrollbar-gutter`: no layout shift when a scrollbar appears

With classic (non-overlay) scrollbars, a scrollbar takes about 15–17px of width. When content grows past the container and the scrollbar appears, everything inside shifts sideways; the same happens to the whole page when a modal locks scrolling and the page scrollbar disappears.

```css
.panel {
  overflow-y: auto;
  scrollbar-gutter: stable;          /* always reserve the scrollbar's space */
}

html {
  scrollbar-gutter: stable both-edges;   /* reserve it on both sides to keep content centred */
}
```

It only affects classic scrollbars (overlay scrollbars take no space anyway) and only applies to boxes whose `overflow` is `hidden`, `scroll` or `auto`, plus the root. It works in all major browsers since late 2024 (Safari 18.2).

## `overscroll-behavior`: stop scroll chaining

When a nested scroll container reaches its end, further scrolling "chains" to its parent, usually the page. Scrolling to the bottom of a chat panel or a modal then starts scrolling the page behind it.

```css
.chat-messages {
  overflow-y: auto;
  overscroll-behavior: contain;    /* scrolling stops at this box's edges */
}

body {
  overscroll-behavior-y: none;     /* also disables pull-to-refresh and the bounce effect */
}
```

| Value | Scroll chaining to the parent | Overscroll effects (bounce, glow, pull-to-refresh) |
| --- | --- | --- |
| `auto` (default) | yes | yes |
| `contain` | no | yes, inside this box |
| `none` | no | no |

There are per-axis versions (`overscroll-behavior-x`, `-y`). It works in all major browsers. It only acts when the element itself is a scroll container that has reached its edge; it does not stop the page from scrolling if the pointer is over a non-scrolling element.

## Smooth Scrolling and Scrollbar Styling

```css
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }   /* animated scrolling for anchor links and scrollTo() */
}

.panel {
  scrollbar-width: thin;              /* auto | thin | none */
  scrollbar-color: #888 transparent;  /* thumb color, track color */
}
```

- `scroll-behavior: smooth` animates jumps to `#anchors` and `element.scrollIntoView()`/`scrollTo()` calls. Wrapping it in a reduced-motion media query respects users who turn animations off.
- `scrollbar-width` and `scrollbar-color` are the standard styling properties. Chrome and Firefox support both; Safari added `scrollbar-width` late (18.2) and still relies on the non-standard `::-webkit-scrollbar` pseudo-elements for anything more, so check support before depending on colors.
- `scrollbar-width: none` hides the scrollbar but the box stays scrollable. Hidden scrollbars remove a visual cue, so pair them with visible controls.

## Common Mistakes

- **Expecting `overflow` to do something on a box without a size limit.** Without a `height`/`max-height`, a block just grows.
- **Using `scroll` instead of `auto`.** `scroll` shows empty scrollbar tracks on Windows even when nothing overflows.
- **Hiding a horizontal scrollbar with `body { overflow-x: hidden; }`.** This hides the symptom, not the bug. Find the element that is too wide instead; common culprits are fixed widths, images without `max-width: 100%` and `width: 100vw`.
- **`text-overflow: ellipsis` with no visible effect.** One of `white-space: nowrap`, `overflow: hidden` or a constrained width is missing.
- **Clipping things you need.** A parent with `overflow: hidden` cuts off dropdowns, tooltips and shadows, and breaks `position: sticky` children.
- **Hiding a scrollbar without another way to scroll**, and leaving a scrolling region unreachable by keyboard.
- **`scroll-snap-type: y mandatory` on long page sections**, which makes content taller than the screen hard to reach. Use `proximity`.
- **Smooth scrolling without a reduced-motion check.**

## Key Takeaways

- `overflow` controls content that does not fit in its box: `visible` (default), `hidden`, `clip`, `scroll`, `auto`. `auto` adds scrollbars only when needed; prefer it over `scroll`.
- `overflow-x` handles the left/right edges, `overflow-y` the top/bottom edges. `overflow: X Y` sets both (x first).
- One-line ellipsis needs `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis` on a box with a width; multi-line truncation uses `-webkit-line-clamp`.
- Any non-`visible`, non-`clip` overflow creates a BFC and a scroll container, which contains floats but can break `position: sticky` and clip dropdowns. `overflow: clip` clips without those side effects.
- Fix unwanted horizontal scrollbars at the source; build intentional ones with `overflow-x: auto`, scroll snap and keyboard access.
- `scrollbar-gutter: stable` prevents layout shift when scrollbars appear; `overscroll-behavior: contain` stops scroll chaining from panels and modals to the page.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the `overflow` property and what is its default value?**
It controls what happens when content is larger than its box. The default is `visible`, which lets the content spill out of the box and overlap the elements after it.

**Q2. What is the difference between `hidden`, `scroll` and `auto`?**
`hidden` clips the extra content with no scrollbar. `scroll` clips it and always shows scrollbars, even if nothing overflows. `auto` clips it and shows a scrollbar only on the axis that actually overflows.

**Q3. What do `overflow-x` and `overflow-y` do?**
They set overflow behaviour for one axis only: `overflow-x` for the left/right edges and `overflow-y` for the top/bottom edges. A common example is `overflow-x: auto` on a wide table wrapper so it scrolls sideways on small screens while the page itself does not.

**Q4. What does `overflow: auto hidden;` mean?**
With two values, the first is `overflow-x` and the second is `overflow-y`. So horizontal overflow gets a scrollbar when needed and vertical overflow is clipped with no scrollbar.

**Q5. How do you show "..." at the end of a single line of text that is too long?**
```css
.title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```
The element also needs a limited width (a block or inline-block with a width, or a flex item that can shrink).

### Mid-level (2–4 years)

**Q6. Your page has an unwanted horizontal scrollbar on mobile. How do you find the cause?**
Do not just add `overflow-x: hidden` to `body`. In DevTools, look for the element wider than the viewport. A quick trick is a temporary `* { outline: 1px solid red; }` to see which box sticks out. Usual causes are fixed widths in px, `width: 100vw` (includes the scrollbar), `width: 100%` plus padding without `border-box`, images without `max-width: 100%`, long unbroken URLs, and negative margins or `position: absolute` elements pushed off-screen. Fix that element instead of hiding the overflow.

**Q7. A `position: sticky` header inside a container does not stick. What could `overflow` have to do with it?**
Sticky elements stick to their nearest scrolling ancestor. If any ancestor has `overflow: hidden`, `auto` or `scroll`, that ancestor becomes the scroll container. If it is not the element that actually scrolls, the header never sticks. Remove the overflow, move the sticky element, or use `overflow: clip`, which clips without creating a scroll container.

**Q8. What is the difference between `overflow: hidden` and `overflow: clip` (or `overflow-x: hidden` and `overflow-x: clip`)?**
Both clip visually. `hidden` still makes the element a scroll container, so it can be scrolled by JavaScript or by focusing a link inside it, and it breaks `position: sticky` for descendants that should stick to the page. `clip` forbids all scrolling and does not create a scroll container, so sticky keeps working. `clip` also works with `overflow-clip-margin` to let content extend a little past the edge. That makes `overflow-x: clip` the safer choice on a page wrapper that must cut off decorative elements, but both should be a last resort after fixing whatever overflows.

**Q9. How do you limit a card description to three lines with an ellipsis?**
```css
.description {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
```
`text-overflow` only works on a single line, so multi-line truncation uses line clamping instead. Despite the prefix, it works in all modern browsers. If users need the full text, add a "Read more" control, because the clipped part is invisible (though screen readers still read it).

**Q10. A dropdown menu inside a card is being cut off at the card's edge. Why, and what are your options?**
The card probably has `overflow: hidden` (often added to clip rounded image corners), and the dropdown's containing block is inside the card, so it is clipped. Options: remove the overflow and clip the image itself with `border-radius` on the image, move `position: relative` to an ancestor outside the clipped area, or render the dropdown outside the card (a portal or the HTML `popover` attribute).

**Q11. How do you build an accessible horizontally scrolling card row?**
Use `display: flex` (or grid with `grid-auto-flow: column`), `overflow-x: auto`, and `scroll-snap-type: x mandatory` with `scroll-snap-align: start` on the cards. Make the container focusable with `tabindex="0"` and give it `role="region"` and an `aria-label` so keyboard and screen-reader users can find and scroll it. If you hide the scrollbar, provide visible, keyboard-accessible previous/next buttons, and disable smooth scrolling for users with `prefers-reduced-motion: reduce`.

**Q12. Scrolling to the bottom of a chat panel starts scrolling the whole page behind it. Why, and how do you stop it?**
That is scroll chaining: once a nested scroll container reaches its edge, the remaining scroll is passed to the next scrollable ancestor. Add `overscroll-behavior: contain` to the panel (or `overscroll-behavior-y: contain` for one axis) so scrolling stops at its edges while the panel keeps its own bounce effect. `none` would also remove the bounce and pull-to-refresh.

### Senior (5+ years)

**Q13. Product wants a carousel component in the design system. Would you build it on native scrolling with scroll snap, or a JavaScript slider that moves a track with `transform`?**
Native scrolling with scroll snap gives you touch momentum, trackpad and mouse-wheel scrolling, keyboard scrolling, right-to-left support and smooth performance (scrolling runs off the main thread) for free, and it works before JavaScript loads. JavaScript only adds the extras: previous/next buttons with `scrollBy({ left: row.clientWidth })` and slide indicators from an `IntersectionObserver`. A transform-based slider gives exact control and infinite loops, but you rebuild swipe physics, keyboard and focus handling (tabbing to an off-screen card must bring it into view), RTL and reduced motion yourself. The infinite-loop trick of cloning cards, used in the [Infinite card carousel](../../05-projects/04-horizontal-carousel/notes.md), also duplicates content for screen readers unless the clones are `aria-hidden` and `inert`.

Chrome added CSS-only carousel controls in 2025 (`::scroll-button()` and `::scroll-marker`), but they are Chromium-only, so treat them as progressive enhancement. Whatever you build, do not autoplay without a pause control, and ask whether a carousel is the right pattern at all, since items after the first get little attention. Recommendation: native scroll snap as the foundation, a small amount of JavaScript for buttons and indicators, no cloning unless the product really needs infinite looping.

**Q14. Design the background scroll-lock behaviour for the design system's modal dialog.**
The goals are: the page behind does not scroll, nothing shifts sideways, the scroll position is kept, and it works on iOS. Open the dialog with `showModal()`, which makes the rest of the page inert and manages focus but does **not** stop the page from scrolling. Lock scrolling on the root element, either with a class the component adds and removes (reference-counted if modals can stack) or in pure CSS with `html:has(dialog[open]) { overflow: hidden; }` (`:has()` works in all major browsers since 2023).

Removing the page scrollbar shifts the layout by its width on Windows, so reserve the space with `html { scrollbar-gutter: stable; }` or add an equivalent `padding-right` while locked. Put `overscroll-behavior: contain` on the dialog's scrolling body so reaching its end does not chain to the page. Older iOS Safari ignored `overflow: hidden` on the body for touch scrolling; the old workaround (`position: fixed` on the body plus restoring `scrollY`) is only needed if you still support those versions. Recommendation: `showModal()`, a root-level overflow lock, `scrollbar-gutter: stable` and `overscroll-behavior: contain`, tested on iOS and on Windows with classic scrollbars.

**Q15. A data table must scroll in both directions inside the page, with a sticky header row and a sticky first column. How do you build it, and what usually goes wrong?**
Make one wrapper the scroll container for both axes, `overflow: auto` with a bounded height (`max-height: 70vh`), because sticky elements stick to their nearest scroll container; if the page scrolls vertically and the wrapper horizontally, one of the two sticky directions fails. Then `thead th { position: sticky; top: 0; z-index: 2; }`, row headers `position: sticky; inset-inline-start: 0; z-index: 1;`, and the top-left corner cell gets both offsets and the highest `z-index`. Sticky cells need an opaque background, or the scrolled content shows through.

What usually goes wrong: an ancestor with `overflow: hidden` silently becomes the scroll container; `border-collapse: collapse` borders do not travel with sticky cells (use `border-collapse: separate; border-spacing: 0` with cell borders or an inset `box-shadow`); and with thousands of rows the DOM gets heavy, which leads to virtualisation, where sticky positioning becomes harder. For accessibility, keep native table semantics and give the wrapper `tabindex="0"`, `role="region"` and `aria-labelledby` pointing at the caption. Recommendation: a single two-axis scroll container, separate borders, explicit z-index layers, and virtualise only when row counts demand it.

> **Note:** Related questions answered elsewhere: [Float, clear and BFC](../12-float-clear-bfc/notes.md#interview-questions) (containing floats with `overflow` or `display: flow-root`) · [Units and sizing](../05-units-and-sizing/notes.md#interview-questions) (why `width: 100vw` causes a horizontal scrollbar).

## References

- [MDN: overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)
- [MDN: overflow-x](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-x)
- [MDN: overflow-y](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-y)
- [MDN: text-overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow)
- [MDN: overflow-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap)
- [MDN: -webkit-line-clamp](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp)
- [MDN: CSS scroll snap](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_snap)
- [MDN: scroll-snap-type](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type)
- [MDN: scrollbar-gutter](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter)
- [MDN: overscroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)
- [MDN: scrollbar-width](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width)
- [web.dev Learn CSS: Overflow](https://web.dev/learn/css/overflow)
- [YouTube: Horizontal scrollbar](https://youtu.be/6QE8dXq9SOE)
