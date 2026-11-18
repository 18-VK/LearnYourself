# CSS Positioning

> CSS · Topic 11 · Demo: [index.html](index.html)

The CSS `position` property lets you precisely control the placement of an element on the web page. It determines how an element is placed inside its container and how it interacts with the other elements on the page: whether it keeps its place in the normal flow, what it is measured from (its **containing block**), and whether it moves when the page scrolls. The second half of the note covers `z-index` and stacking contexts, which decide what is drawn on top when positioned elements overlap.

## Normal flow and offset properties

By default, elements are laid out in **normal flow**: block elements stack top to bottom, inline elements sit side by side in lines. `position` lets you change that.

Once an element is positioned (any value other than `static`), you move it with the **offset properties**:

| Property | Meaning |
| --- | --- |
| `top` | distance from the top edge of the reference box |
| `right` | distance from the right edge |
| `bottom` | distance from the bottom edge |
| `left` | distance from the left edge |
| `inset` | shorthand for all four, like `margin`: `inset: 0;` = `top: 0; right: 0; bottom: 0; left: 0;` |

What the "reference box" is depends on the `position` value, which is what the rest of this lecture is about.

## The five values at a glance

| Value | Stays in normal flow? | Offsets are measured from | Moves when the page scrolls? | Typical use |
| --- | --- | --- | --- | --- |
| `static` (default) | Yes | Offsets are ignored | Yes | Everything, by default |
| `relative` | Yes, its original space is kept | Its own normal position | Yes | Small nudges; parent for absolute children |
| `absolute` | No, removed from the flow | Nearest positioned ancestor (or the initial containing block) | Yes, with that ancestor | Badges, icons, dropdowns, overlays |
| `fixed` | No, removed from the flow | The viewport (screen) | No | Fixed headers/footers, chat buttons, modals |
| `sticky` | Yes, its space is kept | Nearest scrolling ancestor, within its parent | Until it hits the offset, then it sticks | Sticky headers, table headers, sidebars |

## `static` (default)

Elements are positioned according to the normal flow of the document. `top`, `right`, `bottom`, `left` and `z-index` have **no effect** on a static element.

```css
.box { position: static; top: 50px; }   /* top is ignored */
```

## `relative`

Elements are positioned relative to their normal position in the document. You can use the `top`, `right`, `bottom` and `left` properties to move the element from its original position.

```css
.box2 {
  position: relative;
  top: 34px;    /* push 34px down from where it would normally be */
  left: 56px;   /* push 56px to the right */
}
```

This is the commented code for `.box2` in the demo. Key points:

- The element's **original space is kept**. The boxes after it do not move up or sideways, so the shifted box can overlap its neighbours.
- An offset pushes the box **away from that edge**: `top: 34px` moves it down, `left: 56px` moves it right. Negative values move the other way.
- If both `top` and `bottom` are set, `top` wins. If both `left` and `right` are set, `left` wins (in left-to-right text).
- The most common use of `position: relative` has nothing to do with moving the element: it makes the element the **reference box for its absolutely positioned children** (the demo's `.parent` does exactly this).

## `absolute`

An element with `position: absolute` is positioned relative to the **nearest positioned ancestor** (instead of relative to the viewport, like `fixed`). A positioned ancestor is any ancestor whose `position` is not `static`. That means we need a parent (or grandparent, or any ancestor) with a positioning other than `static`.

However, if an absolutely positioned element has no positioned ancestors, it is positioned against the **initial containing block**: a viewport-sized rectangle anchored at the very top of the document. Because that rectangle belongs to the document, the element moves along with page scrolling.

> **Note:** The original notes said it "uses the document body". It is actually the initial containing block (tied to the `<html>` element and the viewport), not `<body>`. In practice it behaves like "the top-left corner of the page", and it scrolls with the page.

Absolutely positioned elements are **removed from the normal flow** and can overlap other elements. The elements after it move up as if it were not there.

### What the demo shows

```css
.parent {
  padding: 43px;
  border: 3px solid purple;
  position: relative;          /* makes .parent the reference box */
}

.box1 {
  position: absolute;
  top: 0px;
  left: 3px;
}
```

- `.box1` is taken out of the flow, so `.box2` moves up into the space `.box1` used to have, and `.box1` sits on top of it.
- `top: 0; left: 3px` is measured from the **padding edge** of `.parent` (just inside its border). The 43px padding is ignored, so `.box1` sits in the parent's top-left corner, over the padding area.
- Remove `position: relative` from `.parent` and `.box1` jumps to the top-left of the page instead.

### Size of an absolute element

- With `width: auto`, an absolute element shrinks to fit its content (it no longer stretches to the full width like a block).
- If you set both `left` and `right` (or `top` and `bottom`) and leave the size `auto`, it stretches between them. `inset: 0` makes it cover its reference box completely, which is the basis of most overlays.

### Things other than `position` that create the reference box

The demo's comment points out an exception: `transform`, `filter` or `perspective` (any value other than `none`) on an ancestor also makes it the containing block for absolutely positioned descendants, even if that ancestor is `position: static`.

```css
.parent {
  /* any one of these turns .parent into the reference box */
  transform: translate(0);
  filter: invert(0);
  perspective: 0em;
}
```

The full list is longer, and every item on it also captures **`position: fixed`** descendants (see the gotcha under `fixed` below):

| Property on an ancestor | Value that creates a containing block |
| --- | --- |
| `transform`, and the individual `translate`, `rotate`, `scale` properties | anything other than `none` (even `translate(0)`) |
| `perspective` | anything other than `none` |
| `filter` | anything other than `none` (even `invert(0)` or `blur(0)`) |
| `backdrop-filter` | anything other than `none` |
| `will-change` | naming any property in this table, such as `will-change: transform` or `will-change: filter` |
| `contain` | `layout`, `paint`, `strict` or `content` |
| `container-type` | `size` or `inline-size` (it applies layout containment) |
| `content-visibility` | `auto` (it applies paint containment) |

> **Note:** All of these also create a **stacking context** (see below), so adding one of them can change both *where* a positioned descendant is placed and *what it can stack above*.

## `fixed`

Elements are positioned relative to the **viewport** (the visible screen area) and do not move when the page is scrolled. This is useful for creating elements like fixed headers, footers, "back to top" buttons and chat widgets.

```css
.box3 {
  position: fixed;
  bottom: 0px;
  left: 8vw;
  height: 111px;
}
```

That is the commented `.box3` code in the demo: the box is glued to the bottom of the screen while everything else scrolls behind it.

- Like `absolute`, a fixed element is **removed from the flow**, so the content it covers does not move out of the way. A fixed header needs matching space, for example `body { padding-top: 60px; }`.
- **Gotcha:** if any ancestor has a `transform`, `filter` or `perspective` (the exception from the demo), or any other property from the [containing-block table above](#things-other-than-position-that-create-the-reference-box) (`backdrop-filter`, `will-change`, `contain`, `container-type`...), the fixed element is positioned relative to that ancestor instead of the viewport, and it scrolls with it. Uncomment `transform: translate(0);` on `.parent` in the demo and `.box3` stops being fixed to the screen.

### Escaping a trapped `fixed` element

The fixed element cannot opt out; the fix is always about where it lives in the DOM or which layer it is drawn in:

| Fix | How | When |
| --- | --- | --- |
| Remove the property from the ancestor | Animate a child instead of the wrapper, drop a leftover `will-change`, move `container-type` lower in the tree | You own the ancestor and the property is not essential |
| Render it outside the ancestor | Append the element to `<body>` (a "portal" in React, Vue's `<Teleport>`) | Toasts, modals and menus in component frameworks |
| Put it in the **top layer** | `<dialog>` opened with `showModal()`, or an element with the `popover` attribute | Modals, menus, tooltips. The top layer is drawn above everything, ignores `z-index` and ancestors' containing blocks, and is positioned against the viewport |

## `sticky`

`position: sticky` is a hybrid between `relative` and `fixed`. The element behaves like `relative` (it stays in the flow and keeps its space) until the page is scrolled to a specified offset. Then it becomes "stuck" at that offset, like `fixed`, until the end of its parent container scrolls past, and then it leaves with the parent.

```css
.box1 {
  position: sticky;
  top: 0px;          /* stick when its top reaches the top of the scroll area */
  height: 111px;
  width: 100%;
  margin: 0;
  padding: 0;
}
```

That is the commented sticky version of `.box1` in the demo.

Rules for sticky to work:

1. You **must** set at least one threshold (`top`, `bottom`, `left` or `right`). Without one, sticky behaves like `relative`.
2. It sticks inside its **nearest scrolling ancestor**: the nearest ancestor with `overflow` set to `hidden`, `auto` or `scroll`, or the page if there is none. If such an ancestor is not the one that actually scrolls, the element never sticks.
3. It can only move within its **parent element**. If the parent is no taller than the sticky element, there is no room to stick. The element stops being stuck when the parent's bottom edge scrolls past.
4. In a flex row, the item is stretched to the full height of the container by default (`align-items: stretch`), so it has no room to stick. Add `align-self: flex-start` to the sticky item.

## `z-index`: who is on top

When positioned elements overlap, `z-index` decides which one is drawn in front.

```css
.modal    { position: fixed;    z-index: 1000; }
.dropdown { position: absolute; z-index: 10; }
```

- It works on **positioned elements** (`relative`, `absolute`, `fixed`, `sticky`) and on **flex and grid items**. It has no effect on a plain `static` element.
- Values are integers and can be negative. The default is `auto`.
- A higher value is drawn closer to the viewer, but **only compared with elements in the same stacking context** (next section).
- Without any `z-index`, positioned elements are drawn above non-positioned ones, and among positioned elements the one that comes **later in the HTML** is drawn on top. In the demo, the absolute `.box1` is drawn over the static `.box2`. Uncomment `position: relative` on `.box2` and it now wins, because it is positioned too and comes later in the HTML.

### Stacking context

A **stacking context** is a group of elements that the browser paints together as one layer. Children's `z-index` values are only compared with each other inside it. The whole group is then placed among its siblings using the parent's own `z-index`.

Common things that create a stacking context:

- the root element (`<html>`)
- `position: relative` or `absolute` **with** a `z-index` other than `auto`
- `position: fixed` or `sticky` (always)
- a flex or grid item with a `z-index` other than `auto`
- `opacity` less than `1`
- `transform`, `filter`, `perspective`, `clip-path`, `mask` or `backdrop-filter` other than `none`
- `mix-blend-mode` other than `normal`
- `isolation: isolate`
- `will-change` naming one of the properties above
- `contain: layout`, `paint`, `strict` or `content`, and `container-type: size` or `inline-size`

> **Note:** The **top layer** sits above all stacking contexts. A modal `<dialog>` (`showModal()`) or an open `popover` is drawn there, so it beats any `z-index` on the page, and nothing on the page can be put above it except a later top-layer element.

### The classic "z-index: 9999 does not work" bug

```html
<header class="header">
  <div class="dropdown">Menu</div>
</header>
<main class="content">Page content</main>
```

```css
.header   { position: relative; z-index: 1; }
.dropdown { position: absolute; z-index: 9999; }
.content  { position: relative; z-index: 2; }
```

The dropdown appears **behind** `.content`. `.header` created a stacking context with `z-index: 1`, so the dropdown's 9999 only counts inside the header. At the top level, the browser compares `.header` (1) with `.content` (2), and `.content` wins. The fix is to raise `.header` above `.content`, or remove the `z-index` that created the extra context.

### Painting order inside one stacking context (back to front)

1. Background and borders of the element that forms the context
2. Positioned descendants with a **negative** `z-index`
3. Normal, non-positioned block boxes (in HTML order)
4. Floated boxes
5. Inline content (text, inline elements)
6. Positioned descendants with `z-index: auto` or `0` (in HTML order)
7. Positioned descendants with a **positive** `z-index` (lowest first)

> **Note:** `isolation: isolate` creates a stacking context without changing anything else. Put it on a component to keep its internal `z-index` values from leaking out and fighting with the rest of the page.

## Common patterns

**Badge in the corner of a card**

```css
.card  { position: relative; }
.badge { position: absolute; top: 8px; right: 8px; }
```

**Center an element of unknown size inside its parent**

```css
.parent { position: relative; }
.child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);   /* pull back by half its own size */
}
```

**Full-screen modal overlay**

```css
.overlay {
  position: fixed;
  inset: 0;                         /* cover the whole viewport */
  background: rgb(0 0 0 / 0.5);
  display: grid;
  place-items: center;              /* center the dialog */
  z-index: 1000;
}
```

**Fixed header that does not hide the content or anchor targets**

```css
.site-header { position: fixed; top: 0; left: 0; right: 0; height: 60px; }
body { padding-top: 60px; }
html { scroll-padding-top: 60px; }   /* #anchor links stop below the header */
```

Why `scroll-padding-top` is needed is explained in [Headings, Links and Bookmarks](../../01-html/02-headings-links-bookmarks/notes.md#interview-questions).

## Common Mistakes

- **Setting `top`/`left` on a static element** and wondering why nothing moves. Offsets need a non-static `position`.
- **Absolute child with no positioned parent.** It flies to the corner of the page. Add `position: relative` to the intended parent.
- **Forgetting that absolute and fixed elements leave the flow.** Content slides under them. Reserve space with padding or margins.
- **Sticky that does not stick:** no `top` value, an ancestor with `overflow: hidden`/`auto`, a parent that is no taller than the element, or a stretched flex item.
- **`z-index` on a static element** (no effect), or ever-larger values that lose to a stacking context.
- **A `transform`, `filter`, `backdrop-filter`, `will-change`, `contain` or `container-type` on an ancestor** quietly changing where `absolute` and `fixed` children are positioned.
- **Leaving `will-change: transform` in the stylesheet permanently** "for performance". It creates a containing block, a stacking context and a compositor layer for as long as it is there.
- **Building whole page layouts with absolute positioning.** It breaks as soon as content or screen size changes. Use flexbox or grid for layout and keep `position` for overlays and small adjustments.

## Key Takeaways

- `static` is the default. Offsets and `z-index` only work on positioned elements (`relative`, `absolute`, `fixed`, `sticky`).
- `relative` moves an element from its normal spot and keeps its original space. Its main use is as the reference box for absolute children.
- `absolute` leaves the flow and is placed against the nearest positioned ancestor's padding box (or the initial containing block if there is none).
- `fixed` is placed against the viewport and ignores scrolling, unless an ancestor has a `transform`, `filter`, `perspective`, `backdrop-filter`, `will-change`, `contain` or `container-type` that makes it the containing block. Portals and the top layer (`<dialog>`, `popover`) escape that trap.
- `sticky` acts like `relative` until a threshold such as `top: 0` is reached, then sticks within its parent and its nearest scrolling ancestor.
- `z-index` is only compared within a stacking context. `opacity`, `transform`, `fixed`/`sticky` and `z-index` on a positioned element all create new ones.
- Use `position` for overlays, badges, dropdowns and sticky bars, and flexbox/grid for page layout.

## Interview Questions

### Junior (0–1 year)

**Q1. What values can the `position` property take, and what is the default?**
`static` (default), `relative`, `absolute`, `fixed` and `sticky`. Static elements follow the normal flow and ignore `top`/`right`/`bottom`/`left` and `z-index`.

**Q2. What is the difference between `relative` and `absolute`?**
A `relative` element stays in the normal flow, keeps its original space and is offset from its own normal position. An `absolute` element is removed from the flow (other elements close the gap) and is placed relative to its nearest positioned ancestor.

**Q3. What is the difference between `absolute` and `fixed`?**
Both are removed from the flow. `absolute` is positioned against the nearest positioned ancestor and scrolls with the page. `fixed` is positioned against the viewport and stays in the same place on screen while the page scrolls.

**Q4. What is `position: sticky` and when would you use it?**
It is a hybrid of `relative` and `fixed`. The element scrolls normally until it reaches a threshold such as `top: 0`, then it sticks there while its parent is still on screen. It is used for sticky navigation bars, section headings and table headers.

**Q5. What does this produce?**
```css
.parent { position: relative; width: 300px; height: 200px; }
.child  { position: absolute; bottom: 0; right: 0; }
```
The child sits in the bottom-right corner inside `.parent` (at the parent's padding edge). Without `position: relative` on `.parent`, it would be placed in the bottom-right corner of the initial containing block, which is the first screenful of the page.

**Q6. What is `z-index`, and why might it have no effect?**
`z-index` sets the stacking order of overlapping elements: higher values are drawn in front. It has no effect on `static` elements (unless they are flex or grid items), and it only competes with elements inside the same stacking context.

### Mid-level (2–4 years)

**Q7. What is a stacking context and how is one created?**
It is a self-contained layer in which child `z-index` values are compared with each other only. The whole layer is then stacked as one unit among its siblings. It is created by the root element, a `relative`/`absolute` element with a non-`auto` `z-index`, any `fixed`/`sticky` element, `opacity < 1`, `transform`/`filter`/`perspective`, `isolation: isolate`, a flex/grid item with `z-index`, and a few others.

**Q8. A dropdown has `z-index: 9999` but still appears behind the next section. How do you debug it?**
Walk up the dropdown's ancestors in DevTools and look for one that creates a stacking context (a `z-index` on a positioned element, `transform`, `opacity`, `filter`, `will-change`). That ancestor is being compared with the next section, not the dropdown itself. Fix it by giving that ancestor a higher `z-index` than the section, by removing the property that created the context, or by rendering the dropdown outside it.

**Q9. Your `position: sticky; top: 0;` header does not stick. What do you check?**
1) That a threshold (`top`) is set. 2) That no ancestor has `overflow: hidden`, `auto` or `scroll`, which would make that ancestor the scroll container. 3) That the parent is taller than the header, since sticky only moves within its parent. 4) If the header is a flex item, that it is not stretched to full height (`align-self: flex-start`).

**Q10. A `position: fixed` modal scrolls with the page and is positioned relative to a card instead of the screen. Why, and how do you fix it?**
A `fixed` element is normally placed against the viewport, but an ancestor with certain properties becomes its containing block instead, and then the "fixed" element is positioned inside that ancestor and scrolls with it. The properties that do this:

- `transform` (including `translate(0)`) and the individual `translate`, `rotate` and `scale` properties, other than `none`
- `perspective` other than `none`
- `filter` other than `none` (even `blur(0)`)
- `backdrop-filter` other than `none` (a frosted-glass header is a common culprit)
- `will-change` naming any of these, such as `will-change: transform`
- `contain: layout`, `paint`, `strict` or `content`, and `container-type: size`/`inline-size`, which applies layout containment

Find it by walking up the ancestors in DevTools' Computed panel. Then remove the property from the ancestor (animate an inner element instead, drop a stale `will-change`), or move the modal out of that subtree: render it into `<body>` with a portal, or use `<dialog>` with `showModal()` or the `popover` attribute, which put it in the top layer, positioned against the viewport and above every `z-index`.

**Q11. How do you center an absolutely positioned element whose size you do not know?**
```css
.child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```
`top`/`left: 50%` moves the top-left corner to the center, and the percentage in `translate` is relative to the element's own size, so it pulls the element back by half its width and height. If the size is known, `inset: 0; margin: auto;` also works.

**Q12. When would you use absolute positioning, and when flexbox or grid?**
Use absolute positioning for elements that must overlap or float above the layout: badges, tooltips, dropdowns, overlays, decorative shapes. Use flexbox or grid for the layout itself (rows, columns, cards), because elements stay in the flow, respond to content size and adapt to screen size. Layouts built from absolute positions break when text length or viewport changes.

### Senior (5+ years)

**Q13. A large app has `z-index: 9999`, `99999` and `2147483647` scattered across many teams' code, and every release brings a new "menu behind the header" bug. How do you fix this for good?**
The numbers are a symptom: nobody owns the layering, and every team escalates locally. Treat layers as a design-system decision:

1. **A small, named scale** as tokens: `--z-base: 0; --z-dropdown: 100; --z-sticky: 200; --z-overlay: 300; --z-modal: 400; --z-toast: 500;`. Components use the token, never a raw number.
2. **Isolate components.** `isolation: isolate` on each component root keeps its internal `z-index: 1/2/3` from competing with the rest of the page.
3. **Move true overlays out of the flow of `z-index` entirely.** Modals, menus, tooltips and toasts go into the top layer (`<dialog>`, `popover`) or a portal root, so they no longer depend on where in the tree they were rendered.
4. **Enforce it:** a Stylelint rule that rejects numeric `z-index` values outside the token file, and a code-review checklist item.

Recommendation: tokens plus `isolation: isolate` for in-flow layering, and the top layer for anything that must appear above everything. After that, raw numbers above about 10 should not pass review.

**Q14. You are designing a reusable Dropdown/Tooltip for a component library. It must work inside cards with `overflow: hidden`, inside transformed carousels and inside modals. How do you position it?**
An absolutely positioned child is clipped by `overflow: hidden` ancestors and trapped by stacking contexts, so "absolute inside the trigger" only works in the demo. The options:

| Approach | Escapes clipping and stacking | Cost |
| --- | --- | --- |
| Absolute inside the trigger | No | Simple, breaks in real layouts |
| Portal to `<body>` + JS positioning (for example Floating UI) | Yes | Must handle scroll, resize, collisions, focus and outside clicks yourself |
| `popover` attribute (top layer) + JS or CSS anchor positioning | Yes | Light dismiss and Esc handling come free. CSS anchor positioning (`anchor-name`, `position-anchor`, `position-area`) is recent, so check support and keep a JS fallback |
| `<dialog>` with `showModal()` | Yes | For modal content only: it makes the rest of the page inert |

Recommendation: build on `popover` for the top-layer rendering, use CSS anchor positioning where supported with a Floating UI fallback, and keep the trigger and popup linked for assistive technology (`aria-expanded`, `aria-controls`, focus return). That combination removes the clipping and `z-index` bug classes instead of patching them per screen.

**Q15. Product wants the sticky header to gain a shadow only while it is stuck, and to slide away on scroll down. How do you build it without hurting scroll performance?**
There is no `:stuck` pseudo-class. Options:

- **IntersectionObserver with a sentinel:** put a 1px element just above the header and observe it. When it leaves the viewport, the header is stuck. No scroll listener, no layout reads, works everywhere. This is the default choice.
- **Scroll-state container queries** (`container-type: scroll-state` and `@container scroll-state(stuck: top)`) do it in pure CSS, but they are Chromium-only at the time of writing, so use them as an enhancement.
- **For hide-on-scroll-down**, a scroll listener is unavoidable: make it `{ passive: true }`, read `scrollY` once per `requestAnimationFrame`, toggle a class, and animate `transform: translateY(-100%)`, not `top`, so the animation runs on the compositor.

Recommendation: sentinel + IntersectionObserver for "stuck", a rAF-throttled passive listener only for direction, and `transform` for movement. Avoid reading `offsetTop` or `getBoundingClientRect()` inside the scroll handler, which forces layout on every frame.

**Q16. A fixed header, a cookie banner and a chat button all passed design review, but an accessibility audit fails the page. What is likely wrong, and what do you change?**
Fixed elements take space from the viewport on every screen and at every zoom level. At 400% zoom or on a phone in landscape, the header and banner can cover most of the screen. Two WCAG 2.2 criteria usually fail: **2.4.11 Focus Not Obscured** (a keyboard user tabs to a link that is hidden behind the banner) and **1.4.10 Reflow** (content cannot be used at a 320 CSS px wide viewport).

Fixes: reserve space with `scroll-padding-top`/`scroll-padding-bottom` so focused elements scroll clear of fixed bars, turn fixed bars back into normal flow on short viewports (`@media (max-height: 30rem) { .site-header { position: static; } }`), make banners dismissible and non-modal, and keep the chat button small and out of the content column. Recommendation: treat every fixed element as a cost against the viewport budget, and test with keyboard-only navigation at 200% and 400% zoom before shipping it. More on the criteria in [Accessibility](../../01-html/11-accessibility/notes.md).

> **Note:** Related questions answered elsewhere: [Headings, Links and Bookmarks](../../01-html/02-headings-links-bookmarks/notes.md#interview-questions) (fixed header hides the anchor target).

## References

- [CodeWithHarry: CSS Positioning](https://www.codewithharry.com/tutorial/css-positioning/)
- [MDN: position](https://developer.mozilla.org/en-US/docs/Web/CSS/position)
- [MDN: z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index)
- [MDN: inset](https://developer.mozilla.org/en-US/docs/Web/CSS/inset)
- [MDN: Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context)
- [MDN: Layout and the containing block](https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block)
- [MDN: Top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer)
- [MDN: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
- [W3C: Understanding SC 2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [web.dev Learn CSS: Z-index and stacking contexts](https://web.dev/learn/css/z-index)
