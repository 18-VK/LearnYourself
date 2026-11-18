# Display and Visibility

> CSS · Topic 6 · Demo: [index.html](index.html) · [display-menu.html](display-menu.html)

The `display` property decides how an element generates its box: whether it starts on a new line, whether `width` and `height` apply, how its children are laid out, or whether it is rendered at all. Together with `visibility` and `opacity`, it is also the main way CSS hides things. This note covers the default `display` of HTML elements, `block` vs `inline` vs `inline-block`, every `display` value and the two-value syntax, the global keywords (`initial`, `unset`, `revert`), and the different ways to hide an element and what each one does to layout, interaction and screen readers. `index.html` turns `<div>`s into `inline-block` boxes; `display-menu.html` turns a list into a horizontal menu.

> **Note:** Flexbox and grid have their own notes, [Flexbox](../13-flexbox/notes.md) and [Grid](../14-grid/notes.md). Here they appear only as `display` values.

## Every Element Has a Default

Browsers give every HTML element a default `display` value. Most are `block` or `inline`:

| Default | Elements |
|---|---|
| `block` | `div`, `p`, `h1`–`h6`, `ul`, `ol`, `section`, `article`, `header`, `footer`, `nav`, `main`, `form` |
| `inline` | `span`, `a`, `strong`, `em`, `b`, `i`, `code`, `label`, `img` |
| `inline-block` (in practice) | form controls such as `button`, `input`, `select` |
| `list-item` | `li` |
| `table`, `table-row`, `table-cell` | `table`, `tr`, `td` / `th` |
| `none` | `head`, `title`, `script`, `style`, `meta` |

CSS can change any of these. `index.html` turns block-level `<div>`s into `inline-block` boxes, and `display-menu.html` turns `list-item` elements into `inline` ones. The HTML side of block and inline elements is covered in [Block, inline, id and class](../../01-html/05-block-inline-id-class/notes.md).

## `block` vs `inline` vs `inline-block`

| Behaviour | `block` | `inline` | `inline-block` |
|---|---|---|---|
| Starts on a new line | yes | no, flows with the text | no, flows with the text |
| Default width | fills the parent's width | as wide as its content | as wide as its content |
| `width` / `height` | respected | **ignored** | respected |
| Horizontal padding, border, margin | yes | yes (pushes neighbours left/right) | yes |
| Vertical padding and border | yes | painted, but **do not push** lines above/below (can overlap them) | yes, push surrounding content |
| Vertical margin | yes | **ignored** | yes |
| Typical use | sections, cards, paragraphs | words inside text: links, bold, icons | buttons, badges, items side by side |

> **Note:** The demo comment says that with `inline`, "width, padding and margin will not work". More precisely: `width` and `height` are ignored and vertical margins have no effect, but left/right padding, border and margin *do* apply, and top/bottom padding is drawn but does not move the surrounding lines.

`<img>` is a special case: it is `inline` by default, but as a *replaced element* (its content comes from outside the document), it respects `width` and `height`.

## The Demo: `inline-block` Boxes (`index.html`)

```css
* {
  margin: 0;
  padding: 0;
}

.box {
  border: 2px solid blue;
  /* we can use inline or inline-block to make a block element like div behave as inline */
  display: inline-block;
  width: 344px;
  padding: 45px;
  margin: 34px;
}

.box1 {
  /* display: none; */
  /* visibility: hidden; */  /* takes its defined size, but the element is hidden */
}
```

```html
<div class="box box1">I am a box</div>
<div class="box">also a nice box</div>

<span>I am a good</span>
<span>boy</span>
```

What you see:

- The two `<div>`s sit **side by side** (if the window is wide enough) because they are `inline-block`, yet each keeps its 344px width, 45px padding and 34px margin.
- The two `<span>`s are `inline` by default, so they flow on the same line like words in a sentence.
- Change `.box` to `display: inline` and the width is ignored, the boxes shrink to their text, and vertical margins disappear.
- Change `.box` to `display: block` (the `<div>` default) and each box takes its own line.

### The gap between `inline-block` elements

`inline-block` elements are treated like words, so the line break or space between them in the HTML becomes a visible gap (roughly 4px, depending on the font size). Ways to remove it:

- Use a flex container on the parent instead (`display: flex; gap: 16px;`). This is the modern solution.
- Remove the whitespace between the tags in the HTML.
- Set `font-size: 0` on the parent and reset it on the children (a hack that breaks `em` sizing inside).

### Vertical alignment of `inline-block`

`inline-block` boxes sit on the text **baseline**, so boxes with different amounts of text can look misaligned. Add `vertical-align: top;` to line up their top edges.

## The Demo: A Horizontal Menu (`display-menu.html`)

```html
<style>
  li {
    display: inline;
  }
  p {
    display: none;
  }
</style>

<p>Display a list of links as a horizontal menu:</p>

<ul>
  <li><a href="/html/default.asp" target="_blank">HTML</a></li>
  <li><a href="/css/default.asp" target="_blank">CSS</a></li>
  <li><a href="/js/default.asp" target="_blank">JavaScript</a></li>
</ul>
```

- `<li>` elements are `list-item` by default (block-like, one per line, with a bullet). `display: inline` puts them on one line and removes the bullets, because only `list-item` boxes get a marker. The list becomes a horizontal menu.
- `p { display: none; }` hides the paragraph completely; it takes no space.
- The `href` values are copied from the W3Schools example and point to paths on their site, so they do not work when the file is opened locally.

Today, horizontal menus are usually built with flexbox, which gives easy spacing and alignment (more in [Lists](../09-lists/notes.md)):

```css
ul {
  display: flex;
  gap: 16px;
  list-style: none;
  padding: 0;
}
```

## Overriding the Default `display`

Changing an inline element to a block element, or vice versa, lets you keep the right HTML element for the meaning while making it look the way the design needs. Making `<li>` elements `inline` for a menu is one example. Others:

```css
a.button {
  display: inline-block;   /* a link that can have width, height and vertical padding */
  padding: 8px 16px;
}

img {
  display: block;          /* removes the small gap under inline images */
}

span.tag {
  display: block;          /* a span that takes its own line */
}
```

> **Note:** Changing `display` only changes how an element is laid out; it does not change what kind of element it is. An inline element styled as `display: block` still follows HTML's content rules, and a `<div>` styled as `inline` still cannot go inside a `<p>`.

## All `display` Values

| Value | What it does | More in |
|---|---|---|
| `block` | Block-level box: new line, fills the width | |
| `inline` | Inline box: flows with text, ignores `width`/`height` | |
| `inline-block` | Inline on the outside, block on the inside | |
| `flex` | Block-level flex container: lays children out in a row or column | [Flexbox](../13-flexbox/notes.md) |
| `inline-flex` | Flex container that itself behaves inline | [Flexbox](../13-flexbox/notes.md) |
| `grid` | Block-level grid container: two-dimensional layout | [Grid](../14-grid/notes.md) |
| `inline-grid` | Grid container that itself behaves inline | [Grid](../14-grid/notes.md) |
| `flow-root` | Block that creates a new block formatting context: contains floats and stops margin collapse with its children | [Float, clear and BFC](../12-float-clear-bfc/notes.md) |
| `contents` | The element's own box disappears; its children act as children of the grandparent | below |
| `list-item` | Behaves like `<li>` (gets a marker) | [Lists](../09-lists/notes.md) |
| `table`, `inline-table` | Behave like `<table>` (block-level or inline-level) | |
| `table-row`, `table-cell`, `table-caption` | Behave like `<tr>`, `<td>`, `<caption>` | |
| `table-row-group`, `table-header-group`, `table-footer-group` | Behave like `<tbody>`, `<thead>`, `<tfoot>` | |
| `table-column`, `table-column-group` | Behave like `<col>`, `<colgroup>` | |
| `none` | The element and all its descendants are not rendered and take no space | |
| `run-in` | Block or inline depending on context. **Not supported by current browsers; do not use it.** | |

### Two-value syntax

Modern CSS describes `display` as two parts: an **outer** type (how the box behaves among its siblings: `block` or `inline`) and an **inner** type (how it lays out its children: `flow`, `flow-root`, `flex`, `grid`, `table`). The single keywords are shortcuts:

| Single keyword | Two-value equivalent |
|---|---|
| `block` | `block flow` |
| `inline` | `inline flow` |
| `inline-block` | `inline flow-root` |
| `flow-root` | `block flow-root` |
| `flex` | `block flex` |
| `inline-flex` | `inline flex` |
| `grid` | `block grid` |
| `list-item` | `block flow list-item` |

So `inline-block` simply means "behaves inline on the outside, like a block on the inside". All major browsers accept the two-value form (since 2023), but the single keywords remain the norm in real code. The model is still useful: it separates "how do I sit among my siblings" from "how do I lay out my children".

### `display: contents`

```html
<ul class="grid">
  <li>One</li>
  <li class="group">        <!-- display: contents -->
    <span>Two</span>        <!-- these become grid items of .grid -->
    <span>Three</span>
  </li>
</ul>
```

With `.group { display: contents; }`, the `<li>` generates no box (no background, border, padding or margin), and its children are laid out as if they were children of `.grid`. It is useful when a wrapper exists for semantic or framework reasons but would break a flex or grid layout. Do not use it on elements whose meaning matters (buttons, lists, tables, headings): older browser versions removed those elements from the accessibility tree, and the element can no longer be styled as a box or receive focus styles.

## Global Keywords: `initial`, `inherit`, `unset`, `revert`

Every property, `display` included, accepts these keywords:

| Keyword | Result for `div { display: ...; }` |
|---|---|
| `initial` | `inline` (the property's initial value from the spec) |
| `unset` | `inline` (`display` is not inherited, so it behaves like `initial`) |
| `inherit` | whatever the parent's `display` is |
| `revert` | `block` (the browser's default for `<div>`) |

> **Note:** `initial` does **not** mean "the browser's default for this element". The initial value of `display` is `inline` for every element, so `div { display: initial; }` makes a `<div>` inline. To go back to the browser's default, use `revert`. (`revert-layer` does the same but only rolls back to the previous cascade layer, see [Specificity and cascade](../03-specificity-and-cascade/notes.md).)

## Hiding Elements

### `display: none` vs `visibility: hidden` vs `opacity: 0`

The demo's `.box1` has the first two options commented out:

```css
.box1 { display: none; }        /* removed: the second box moves into its place */
.box1 { visibility: hidden; }   /* invisible, but its space stays empty */
```

| | `display: none` | `visibility: hidden` | `opacity: 0` |
|---|---|---|---|
| Takes up space in the layout | no | **yes** | **yes** |
| Visible | no | no | no |
| Can be clicked / receives events | no | no | **yes** |
| Reachable with Tab key | no | no | **yes** |
| Read by screen readers | no | no | **yes** |
| A child can override it | no | yes (`visibility: visible` on a child shows it) | no |
| Can be smoothly transitioned | not by default (see below) | switches at the start/end of a transition | yes |

> **Note:** `opacity: 0` alone hides an element only visually; it can still be clicked and focused, which confuses keyboard and screen-reader users.

`visibility` has a third value, `collapse`. On table rows and columns it removes them like `display: none` but without recalculating the other columns' widths; on other elements it behaves like `hidden`.

`display: none` switches instantly. Fading an element out and then removing it needs `opacity` plus `visibility`, or in current browsers `transition-behavior: allow-discrete` with `@starting-style`; see [Transitions](../18-transitions/notes.md).

### Hiding from some users but not others

`display: none` and `visibility: hidden` hide content from **everyone**, screen readers included. Sometimes you need a different audience:

| Goal | Use |
|---|---|
| Hidden from everyone | `display: none`, or the `hidden` attribute |
| Hidden visually, still read by screen readers | a `.visually-hidden` utility class (below) |
| Visible, but ignored by screen readers (a decorative icon next to text) | `aria-hidden="true"` (never on something focusable) |
| Visible, but not interactive or focusable (content behind a modal) | the `inert` attribute |

The usual "visually hidden" (also called `sr-only`) class shrinks the element to a clipped 1px box, so it is invisible but still in the accessibility tree:

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);       /* older syntax, kept for old browsers */
  clip-path: inset(50%);
  white-space: nowrap;       /* stops the text from being read word by word */
  border: 0;
}
```

```html
<button>
  <svg aria-hidden="true">...</svg>
  <span class="visually-hidden">Close dialog</span>
</button>
```

It is used for labels on icon-only buttons, extra context such as "(opens in a new tab)", and "skip to content" links (which are shown again on `:focus`).

### Showing and hiding with JavaScript

`display: none` is commonly toggled from JavaScript to hide and show elements without deleting and recreating them:

```html
<button id="toggle">Show / hide details</button>
<div id="details" class="box1">Some extra details...</div>
```

```js
const details = document.getElementById("details");

document.getElementById("toggle").addEventListener("click", () => {
  // inline style: "none" hides, "" removes the inline style (back to the stylesheet value)
  details.style.display = details.style.display === "none" ? "" : "none";
});

// Usually cleaner: keep the styling in CSS and toggle a class
details.classList.toggle("is-hidden");   // .is-hidden { display: none; }
```

> **Note:** The HTML `hidden` attribute hides an element through the browser's default `[hidden] { display: none; }`. Any author rule that sets `display` (like `.box { display: inline-block; }`) overrides it, so `<div class="box" hidden>` stays **visible**. Many projects add `[hidden] { display: none !important; }`. The details are in [DOM manipulation](../../03-javascript/23-dom-manipulation/notes.md#the-hidden-property).

## Common Mistakes

- **Setting `width`/`height` on an inline element** (`span`, `a`) and wondering why nothing happens. Use `inline-block` or `block`.
- **Adding vertical margin to an inline element**, which has no effect.
- **Unexpected gaps between `inline-block` items** caused by whitespace in the HTML. Use flexbox with `gap`.
- **Hiding with `opacity: 0`** and leaving the element clickable and focusable.
- **Hiding with `visibility: hidden` and wondering why there is a gap.** Use `display: none` if the space should collapse.
- **Hiding screen-reader text with `display: none`**, which removes it for screen readers too. Use a visually-hidden class.
- **Expecting `display: none` to animate.** It switches instantly unless you use the techniques in [Transitions](../18-transitions/notes.md).
- **Using `display: flex` and then setting `hidden`**, which no longer hides the element.
- **Using `display: initial` to "reset" an element** and getting `inline` instead of the browser default. Use `revert`.
- **Using `display: contents` on a button, list or table**, which can strip its semantics and makes it impossible to style as a box.

## Key Takeaways

- `display` controls whether an element is block, inline, inline-block, flex, grid, table-like or not rendered at all; every element has a default you can override.
- Block elements start on a new line and fill the width; inline elements flow with text and ignore `width`, `height` and vertical margins; `inline-block` flows like text but respects all of them.
- `display` has an outer type (how the box sits among siblings) and an inner type (how it lays out children): `inline-block` = `inline flow-root`, `inline-flex` = `inline flex`.
- Changing `display` changes layout, not the element's meaning or HTML content rules.
- `display: none` removes the element and its space; `visibility: hidden` hides it but keeps its space; `opacity: 0` hides it only visually.
- To hide something visually but keep it for screen readers, use a visually-hidden class; to hide it from screen readers only, `aria-hidden="true"`.
- `initial` means the spec's initial value (`inline` for `display`); `revert` restores the browser default.

## Interview Questions

### Junior (0–1 year)

**Q1. What is `inline-block` used for?**
It lets elements sit next to each other on a line like inline elements while still respecting `width`, `height`, padding and margin like blocks. It is used for buttons, badges, navigation items and simple side-by-side boxes, as in the demo. For full layouts, flexbox is usually better.

**Q2. What is the difference between `display: none` and `visibility: hidden`?**
`display: none` removes the element from the layout completely, so other elements move into its space, and it cannot be seen, clicked or read by screen readers. `visibility: hidden` makes the element invisible but keeps its space in the layout, leaving a blank area. Both stop clicks and hide it from assistive technology.

**Q3. Why does `span { width: 200px; }` have no effect?**
`<span>` is an inline element, and inline elements ignore `width` and `height`; their size comes from their content. Change it to `display: inline-block` or `display: block` to make the width apply.

**Q4. What is the default `display` value of `<div>`, `<span>`, `<li>` and `<img>`?**
`<div>` is `block`, `<span>` is `inline`, `<li>` is `list-item` (a block that shows a bullet or number), and `<img>` is `inline`. Images are replaced elements, so unlike other inline elements they do respect `width` and `height`. In general most elements are either `block` or `inline`; table elements use the table values, and elements like `<head>` and `<script>` are `display: none`.

**Q5. In the demo, what changes if `.box` is set to `display: inline`?**
The `width: 344px` is ignored, so each box shrinks to its text. The 34px top and bottom margins have no effect, and the 45px top and bottom padding is still painted but may overlap the lines around it. The left and right padding, border and margins still apply, and the boxes still sit on the same line.

**Q6. How can JavaScript hide and show an element?**
Set `element.style.display = "none"` to hide it and `element.style.display = ""` to remove the inline style and return to the stylesheet's value (setting it to `"block"` instead would break an element that is supposed to be `flex` or `inline`). A cleaner approach is toggling a class, `element.classList.toggle("is-hidden")`, with `.is-hidden { display: none; }` defined in CSS, or setting the `hidden` property.

### Mid-level (2–4 years)

**Q7. There are small gaps between `inline-block` navigation items. What causes them and how do you fix them?**
`inline-block` elements are laid out like words, so the whitespace (spaces or line breaks) between the tags in the HTML is rendered as a space character, about 0.25em wide. Fixes include removing the whitespace in the markup or setting `font-size: 0` on the parent, but the clean modern fix is to make the parent `display: flex` and control spacing with `gap`.

**Q8. Compare `display: none`, `visibility: hidden` and `opacity: 0` for accessibility and animation.**
`display: none` and `visibility: hidden` both hide content from screen readers and remove it from keyboard focus; `opacity: 0` hides only visually, so the element can still be focused, clicked and read. For animation, `opacity` transitions smoothly; `visibility` switches at the end of a transition (so `transition: opacity .3s, visibility .3s` gives a fade that also becomes non-interactive); `display` traditionally cannot be transitioned at all (current browsers add `transition-behavior: allow-discrete` for this).

**Q9. Why is there a small gap under an image inside a `<div>`?**
`<img>` is inline, so it sits on the text baseline, and the line box reserves space below the baseline for descenders (letters like g and y). That reserved space shows as a gap. Set `display: block` on the image, or `vertical-align: middle` / `top`.

**Q10. What does `display: contents` do, and what should you be careful about?**
The element's own box is not generated (no background, border, padding or margin), and its children are laid out as if they were direct children of its parent. It is useful when a wrapper element exists for semantic or framework reasons but would otherwise break a flex or grid layout. Be careful with semantic elements such as buttons, lists and tables: some browser versions dropped them from the accessibility tree, and an element without a box cannot show a focus ring or be sized.

**Q11. What does `div { display: initial; }` do, and how would you restore the browser default instead?**
It sets `display` to its initial value from the specification, which is `inline`, so the `<div>` becomes inline. `initial` ignores the browser's default stylesheet, and `unset` gives the same result because `display` is not inherited. To get back the user-agent default (`block` for `<div>`), use `display: revert;`.

**Q12. What is the difference between `display: flex` and `display: inline-flex`?**
Both make the element a flex container, so its children are laid out the same way. The difference is how the container itself behaves among its siblings: `flex` makes it block-level (takes its own line, full width by default), while `inline-flex` makes it inline-level (sits in a line of text and is only as wide as its content). In two-value syntax they are `block flex` and `inline flex`. `inline-flex` suits buttons and badges with an icon and a label that sit inside text.

**Q13. How do you hide content visually but keep it available to screen readers?**
Neither `display: none` nor `visibility: hidden` works, because both remove the content from the accessibility tree, and `opacity: 0` leaves a visible gap and a clickable area. Use a "visually hidden" utility class (shown in [Hiding from some users but not others](#hiding-from-some-users-but-not-others)): absolute position, a 1px size, `overflow: hidden`, `clip-path: inset(50%)` and `white-space: nowrap`. Typical uses are labels on icon-only buttons and "skip to content" links, which are revealed again on `:focus`.

### Senior (5+ years)

**Q14. Your codebase hides things five different ways (`display: none`, an `sr-only` class, `aria-hidden`, `opacity: 0`, `left: -9999px`). How would you standardise it across teams?**
Start from the audience, not the CSS. There are four intents: hidden from everyone (closed panels, inactive tabs: the `hidden` attribute or a state class with `display: none`), hidden visually but announced (one `.visually-hidden` utility), visible but ignored by assistive technology (`aria-hidden="true"` on decorative icons, never on focusable elements), and visible but not interactive (`inert` for content behind a modal, supported in all modern browsers since 2023). `opacity: 0` on its own and off-screen positioning (`left: -9999px`, which can cause scrolling in right-to-left layouts) are not on the list.

Then make the right choice the easy one: ship it as components and props (`<VisuallyHidden>`, `<Icon decorative>`, a `[hidden] { display: none !important; }` reset in the base stylesheet), document the four-row decision table, and enforce it with automated checks (axe in CI catches `aria-hidden` on focusable content and unlabelled icon buttons) plus a code-review checklist. Recommendation: one decision table, components that encode it, and automated a11y checks, rather than a style guide page nobody reads.

**Q15. A long documentation page with hundreds of sections renders slowly. Someone suggests `content-visibility: auto`. What does it do, and what are the risks?**
It lets the browser skip layout and paint for sections that are far off-screen and do that work only when they approach the viewport. Unlike `display: none`, the content stays in the DOM and the accessibility tree, and find-in-page and anchor links still work. It is supported in all major browsers since 2024.

The risks: a skipped section is size-contained, so without a size estimate it counts as 0px tall and the scrollbar jumps as sections render. Set `contain-intrinsic-size: auto 800px` (the `auto` part remembers the last rendered size). It also always applies layout, style and paint containment, so content that should escape the section (shadows, dropdowns, tooltips) is clipped, and the section becomes the containing block for `position: fixed` descendants. And it only saves rendering work; if the cost is JavaScript or tens of thousands of DOM nodes, you need virtualisation instead. Recommendation: measure rendering time in the Performance panel first, apply it to large, self-contained, below-the-fold sections with a realistic intrinsic size, and check CLS and scrollbar behaviour afterwards.

**Q16. To make a data table responsive, a teammate sets `table, thead, tbody, tr, th, td { display: block; }` on small screens. What breaks, and what would you recommend?**
Visually it turns rows into stacked cards, but accessibility suffers. Some browsers (WebKit for the longest time) drop table semantics from the accessibility tree when table elements get a non-table `display`, so screen-reader users lose row/column navigation and header announcements. The header row is usually hidden on mobile too, and the `td::before { content: attr(data-label) }` labels that replace it are generated content, which is announced inconsistently and not copied with the text.

Options, in order of preference: keep the table as a table inside a scroll container (`overflow-x: auto` with `tabindex="0"`, `role="region"` and an `aria-label` so keyboard users can scroll it); or, if the card layout is required, restore semantics with explicit ARIA roles (`role="table"`, `row`, `columnheader`, `cell`); or render a genuinely different structure for small screens, such as a list of cards with `<dl>` pairs. Recommendation: scroll container by default, and test any `display` change on table elements with VoiceOver and NVDA before shipping.

**Q17. In a component library, should a `Card` component set its own `display`, `width` or margins?**
Use the outer/inner model of `display` as the rule. The **inner** layout (how the card arranges its own children: `display: flex; flex-direction: column` or a grid) belongs to the component, because only the component knows its structure. The **outer** behaviour (where it sits, how wide it is, the space to its siblings) belongs to whatever layout contains it. A card that ships with `width: 300px` or `margin-bottom: 24px` breaks as soon as someone puts it in a grid with `gap`, and every consumer ends up overriding it.

In practice: component roots are block-level (or `inline-flex` for things that live in text, like badges and buttons), have no external margins, and fill whatever width the parent gives them; spacing comes from layout primitives (`Stack`, `Cluster`, `Grid`) using `gap`. Recommendation: "components own their inner display, layouts own outer display and spacing", written into the contribution guide and checked in review.

> **Note:** Related questions answered elsewhere: [Float, clear and BFC](../12-float-clear-bfc/notes.md#interview-questions) (containing floats, `display: flow-root`) · [DOM manipulation](../../03-javascript/23-dom-manipulation/notes.md#interview-questions) (`hidden` attribute overridden by `display`) · [Backgrounds, gradients, shadows and outline](../08-backgrounds-shadows-outline/notes.md#interview-questions) (dark overlay on a photo with multiple backgrounds); [Block and Inline Elements, IDs and Classes](../../01-html/05-block-inline-id-class/notes.md#interview-questions) (block vs inline elements); [Styling Lists in CSS](../09-lists/notes.md#interview-questions) (turning a list into a horizontal menu).

## References

- [MDN: display (linked in the demo)](https://developer.mozilla.org/en-US/docs/Web/CSS/display)
- [MDN: visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/visibility)
- [MDN: revert](https://developer.mozilla.org/en-US/docs/Web/CSS/revert)
- [MDN: hidden attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden)
- [MDN: inert attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert)
- [MDN: content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)
- [W3Schools: CSS Layout - display and visibility (source of display-menu.html)](https://www.w3schools.com/css/css_display_visibility.asp)
- [The A11Y Project: How-to: Hide content](https://www.a11yproject.com/posts/how-to-hide-content/)
- [web.dev: content-visibility](https://web.dev/articles/content-visibility)
