# CSS Flexbox

> CSS · Topic 13 · Demo: [index.html](index.html) · Diagram: [flexbox.drawio.pdf](flexbox.drawio.pdf)

Flexbox (the Flexible Box Layout) is a **one-dimensional** layout system: it arranges items in a row or a column, distributes the free space between them, and aligns them, all from a few properties on the parent. It replaced float- and table-based hacks for navbars, centering, equal-height columns and wrapping card rows, and it is the tool you will use most often for component layout.

## Flex container and flex items

Flexbox always involves two levels:

- The **flex container**: the element you give `display: flex` (or `inline-flex`).
- The **flex items**: its **direct children**. Grandchildren are not affected.

```html
<div class="container">        <!-- flex container -->
  <div class="item">1</div>    <!-- flex item -->
  <div class="item">2</div>    <!-- flex item -->
  <div class="item">3</div>    <!-- flex item -->
</div>
```

```css
.container {
  display: flex;   /* children are now laid out in a row */
}
```

| Value | Container itself behaves like | Children |
| --- | --- | --- |
| `display: flex` | a block (takes the full width, starts on a new line) | flex items |
| `display: inline-flex` | an inline-block (sits in a line of text, as wide as its content) | flex items |

What changes for the children once they become flex items:

- They line up in a row by default, even if they are block elements.
- An inline element such as `<span>` becomes block-level, so `width`/`height` work.
- `float` and `vertical-align` are ignored.
- Margins between items do **not** collapse.

## Main axis and cross axis

Every flex container has two axes. The diagram in [flexbox.drawio.pdf](flexbox.drawio.pdf) shows them for both directions:

- The **main axis** runs in the direction the items are placed (set by `flex-direction`).
- The **cross axis** runs perpendicular to it.

| `flex-direction` | Main axis | Main start → main end | Cross axis | Cross start → cross end |
| --- | --- | --- | --- | --- |
| `row` (default) | horizontal | left → right | vertical | top → bottom |
| `column` | vertical | top → bottom | horizontal | left → right |

This matters because the alignment properties are defined by **axis**, not by "horizontal" and "vertical":

- `justify-content` works on the **main** axis.
- `align-items`, `align-self` and `align-content` work on the **cross** axis.

So with `flex-direction: column`, `justify-content: center` centers vertically and `align-items: center` centers horizontally. This trips up almost everyone at first.

## Container properties

### `flex-direction`

Sets the main axis.

| Value | Items placed |
| --- | --- |
| `row` (default) | left to right (in left-to-right languages) |
| `row-reverse` | right to left |
| `column` | top to bottom |
| `column-reverse` | bottom to top |

### `flex-wrap`

By default all items are forced onto one line, shrinking if needed.

| Value | Behaviour |
| --- | --- |
| `nowrap` (default) | One line. Items shrink, and overflow the container if they cannot shrink enough. |
| `wrap` | Items move onto new lines when there is no room. |
| `wrap-reverse` | Wraps, but new lines are added above (in the reverse cross direction). |

### `flex-flow` (shorthand)

`flex-flow: <flex-direction> <flex-wrap>`.

```css
.container {
  flex-direction: column;
  flex-wrap: wrap;
  flex-flow: row wrap;   /* same as flex-direction: row; flex-wrap: wrap; */
}
```

> **Note:** In the demo, `flex-direction: column` is written first and `flex-flow: row wrap` comes later in the same rule. The later declaration wins, so the demo actually lays items out in a **row** that wraps. Delete the `flex-flow` line to see the column version.

### `justify-content`: alignment on the main axis

Distributes the free space along the main axis.

| Value | Meaning |
| --- | --- |
| `flex-start` | Items are positioned at the beginning of the container (main start). This is the default behaviour (strictly, the initial value is `normal`, which acts like `flex-start` in a flex container). |
| `flex-end` | Items are positioned at the end of the container (main end). |
| `center` | Items are positioned in the center of the container. |
| `space-between` | The first item touches the start, the last touches the end, and the remaining space is shared equally **between** items. No space at the edges. |
| `space-around` | Each item gets equal space on **both sides**, so the gap between two items is twice the gap at the edges. |
| `space-evenly` | All gaps are equal: between items **and** between the items and the edges. |
| `initial` | Sets this property to its default value. |
| `inherit` | Inherits this property from its parent element. |

`initial` and `inherit` are not specific to `justify-content`: they are global keywords that work on every CSS property (along with `unset` and `revert`).

A picture of each value with three items in a row (`.` is free space):

```
flex-start     [1][2][3]............
flex-end       ............[1][2][3]
center         ......[1][2][3]......
space-between  [1]......[2]......[3]
space-around   ..[1]....[2]....[3]..
space-evenly   ...[1]...[2]...[3]...
```

> **Note:** `flex-start`/`flex-end` follow the flex direction, so with `row-reverse` `flex-start` is on the right. `start`/`end` follow the text direction instead and ignore the reversal. For everyday `row`/`column` layouts they behave the same.

### `align-items`: alignment on the cross axis

Aligns the items **within their line** along the cross axis.

| Value | Meaning |
| --- | --- |
| `stretch` (default behaviour) | Items stretch to fill the line's cross size, **if** they have no fixed cross size (no `height` in a row). |
| `flex-start` | Items sit at the cross start (top, in a row). |
| `flex-end` | Items sit at the cross end (bottom, in a row). |
| `center` | Items are centered on the cross axis. |
| `baseline` | Items are aligned so their first lines of text sit on the same baseline. |

The demo uses `align-items: center`. Because each `.item` has `height: 92px`, the default `stretch` would have had no visible effect anyway: stretch only works when the cross size is `auto`.

### `align-content`: spacing between lines

When items wrap onto **several lines**, `align-content` distributes the space between those lines along the cross axis. It accepts the same values as `justify-content` (`flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`) plus `stretch`.

| | `align-items` | `align-content` |
| --- | --- | --- |
| Moves | items inside each line | the lines themselves |
| Needs wrapping? | No | Yes. It only works when `flex-wrap` is `wrap` or `wrap-reverse`. A `nowrap` container has a single line that always fills the cross size. |
| Default | `stretch` | `normal` (behaves like `stretch`: lines share the extra space) |

In the demo (`height: 80vh`, `flex-wrap: wrap`), the lines stretch to share the container's height and each item is centered inside its own line. Uncomment `align-content: flex-start;` to pack all lines at the top.

### No `justify-items` in flexbox

As the demo's comment says, there is **no `justify-items`** (and no `justify-self`) in flexbox. They are ignored on flex containers because the main axis is handled as a whole by `justify-content`. To move a single item along the main axis, use an **auto margin**:

```css
.nav .logo {
  margin-right: auto;   /* eats all free space, pushing the other items to the right */
}
```

### `gap`, `row-gap`, `column-gap`

Adds space **between** items (never at the outer edges), so you do not need margins on items.

```css
.container {
  gap: 30px;            /* 30px between rows and between columns */
  row-gap: 40px;        /* space between lines */
  column-gap: 10px;     /* space between items in the same line */
  gap: 40px 10px;       /* shorthand: row-gap column-gap (what the demo uses) */
}
```

## Item properties

### `order`

Changes the **visual** order of an item without changing the HTML. Default `0`. Items are sorted by `order` (lowest first), and items with the same value keep their HTML order. Negative values are allowed.

```css
.order-1 { order: 1; }
.order-2 { order: 2; }
.order-3 { order: 3; }
```

In the demo, item **4** has class `order-1`. Every other item has `order: 0`, so item 4 moves to the **end** of the row.

> **Note:** `order` (and `row-reverse`/`column-reverse`) only change what you see. Keyboard tab order and screen readers still follow the HTML order, so do not use it to reorder meaningful content.

### `flex-grow`

How much of the **positive free space** an item takes. Default `0` (do not grow).

```css
.item  { flex-basis: 100px; flex-grow: 1; }
.item1 { flex-grow: 2; }
```

Example: a 600px container with three items whose base size is 100px each has 300px of free space. With `flex-grow` 1, 1 and 2 (total 4), the items get 75px, 75px and 150px extra, ending at **175px, 175px and 250px**. `flex-grow: 2` means "twice the share of the **extra** space", not "twice as wide".

### `flex-shrink`

How much an item gives up when there is **not enough** space. Default `1` (all items shrink). `0` means "never shrink below my base size".

Shrinking is weighted by `flex-shrink` × base size. Example: three items with a 200px base size in a 300px container must lose 300px in total. If the first has `flex-shrink: 2`, it loses twice as much as each of the others: 150px vs 75px, ending at 50px, 125px and 125px.

### `flex-basis`

The item's starting size along the main axis, **before** free space is shared out. Default `auto`, which means "use my `width` (or `height` in a column), or my content size if that is also `auto`". If both `flex-basis` (not `auto`) and `width` are set, `flex-basis` wins for the main axis. `min-width` and `max-width` still limit the result.

### `flex` (shorthand)

`flex: <grow> <shrink> <basis>`. Always prefer the shorthand. Its common values are worth memorising:

| Shorthand | Expands to | Meaning |
| --- | --- | --- |
| `flex: initial` | `0 1 auto` | The default. Do not grow, may shrink, start from width/content. |
| `flex: auto` | `1 1 auto` | Grow and shrink, starting from the content size. Bigger content gets a bigger box. |
| `flex: none` | `0 0 auto` | Rigid: never grow or shrink. |
| `flex: 1` | `1 1 0%` | Grow from zero, so all `flex: 1` items get **equal** widths. |
| `flex: 2` | `2 1 0%` | Twice the size of a `flex: 1` sibling. |
| `flex: 1 1 200px` | — | Start at 200px, then grow or shrink. Great for wrapping cards. |

### `align-self`

Overrides `align-items` for a single item. Same values: `auto` (default, uses the container's `align-items`), `flex-start`, `flex-end`, `center`, `baseline`, `stretch`.

```css
.item1 {
  align-self: flex-end;   /* demo: item 1 sits at the bottom of its line, the rest stay centered */
}
```

## Common flexbox patterns

**Center anything, horizontally and vertically**

```css
.center {
  display: flex;
  justify-content: center;   /* main axis */
  align-items: center;       /* cross axis */
  min-height: 100vh;
}
```

**Navbar: logo on the left, links on the right**

```css
.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.nav .logo {
  margin-right: auto;
}
```

**Equal-width columns**

```css
.row  { display: flex; gap: 1rem; }
.col  { flex: 1; }
```

**Responsive wrapping cards without media queries**

```css
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.card {
  flex: 1 1 250px;   /* at least about 250px, grow to fill the line */
}
```

**Footer at the bottom of short pages ("sticky footer")**

```css
body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
main {
  flex: 1;   /* takes all the leftover height, pushing the footer down */
}
```

## Flexbox vs Grid

| | Flexbox | Grid |
| --- | --- | --- |
| Dimensions | One: a row **or** a column | Two: rows **and** columns together |
| Sizing driven by | the content of the items | the tracks you define on the container |
| Best for | navbars, toolbars, button groups, centering, a single row of cards | page layouts, galleries, dashboards, anything that must line up in both directions |
| Wrapped items | each line is sized independently, so columns do not line up | items stay aligned to the same columns |

They work well together: grid for the page, flexbox inside the components.

## Common Mistakes

- **Putting `display: flex` on the wrong element.** Only **direct children** become flex items.
- **Mixing up the axes after `flex-direction: column`.** `justify-content` is now vertical and `align-items` is horizontal.
- **Vertical centering with no height.** In a column, or with `align-items: center` in a row, the container needs a height (or `min-height`) for there to be space to center in.
- **Expecting `stretch` to work on items with a fixed `height`.** Stretch only applies when the cross size is `auto`.
- **Using `align-content` without `flex-wrap: wrap`.** On a `nowrap` (single-line) container it does nothing.
- **Looking for `justify-items`/`justify-self`.** They do not exist in flexbox. Use `margin-left: auto` or `justify-content`.
- **Text or a long URL overflowing a flex item.** Flex items have `min-width: auto` and will not shrink below their content. Add `min-width: 0` (or `overflow: hidden`) to the item.
- **Confusing `flex: 1` with `flex-grow: 1`.** `flex: 1` sets the basis to 0, giving equal widths. `flex-grow: 1` alone keeps `flex-basis: auto`, so items with more content stay wider.
- **Spacing items with margins** and then fighting the extra margin on the last item. Use `gap`.
- **Reordering content with `order` or `*-reverse`.** It breaks the reading and tab order for keyboard and screen-reader users.

## Key Takeaways

- `display: flex` makes the direct children flex items laid out along the **main axis**. `flex-direction` sets that axis.
- `justify-content` aligns along the main axis, `align-items`/`align-self` along the cross axis, and `align-content` spaces wrapped lines.
- `space-between` has no edge space, `space-around` has half-size edges, `space-evenly` makes every gap equal.
- `flex-wrap: wrap` allows multiple lines. `flex-flow` is the shorthand for direction + wrap.
- `gap` is the clean way to space items.
- `flex: grow shrink basis`: `flex: 1` = equal shares, `flex: none` = rigid, `flex: 1 1 250px` = responsive cards.
- There is no `justify-items` in flexbox. Auto margins push individual items.
- Use flexbox for one-dimensional component layout and grid for two-dimensional layout.

## Interview Questions

### Junior (0–1 year)

**Q1. What is flexbox, and when do you use it?**
Flexbox is a one-dimensional CSS layout model that places items in a row or a column and controls how free space is distributed and how items are aligned. It is used for navbars, toolbars, centering, equal-height columns and rows of cards. You enable it with `display: flex` on the parent.

**Q2. What are the main axis and the cross axis?**
The main axis is the direction items are laid out in, set by `flex-direction` (horizontal for `row`, vertical for `column`). The cross axis is perpendicular to it. `justify-content` aligns along the main axis and `align-items` along the cross axis, so their visual effect swaps when you switch to `column`.

**Q3. What is the difference between `justify-content` and `align-items`?**
`justify-content` distributes items and free space along the main axis (start, end, center, space-between...). `align-items` positions items along the cross axis within their line (stretch, start, end, center, baseline). In a default row, that means horizontal and vertical respectively.

**Q4. What is the difference between `space-between`, `space-around` and `space-evenly`?**
`space-between` puts the first and last items against the edges and shares the space equally between items. `space-around` gives every item equal space on both sides, so edge gaps are half the size of the gaps between items. `space-evenly` makes all gaps, including the edges, exactly equal.

**Q5. How do you center a div horizontally and vertically with flexbox?**
```css
.parent {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;   /* the parent needs a height to center vertically in */
}
```

**Q6. What does `flex-wrap: wrap` do?**
By default (`nowrap`), all items stay on one line and shrink, overflowing if they cannot shrink enough. `wrap` lets items move onto new lines when they do not fit. Use `gap` for spacing and `align-content` to space the lines.

**Q7. What does the `order` property do?**
It changes the visual position of a flex item without changing the HTML. All items default to `order: 0`, and items are displayed from the lowest value to the highest. It does not change tab order or screen-reader order.

### Mid-level (2–4 years)

**Q8. Explain `flex: 1`. How is it different from `flex: auto` and `flex-grow: 1`?**
`flex: 1` means `flex-grow: 1; flex-shrink: 1; flex-basis: 0%`. Every item starts from zero and shares all the space, so siblings with `flex: 1` end up equal width. `flex: auto` (`1 1 auto`) starts from each item's content or width, so items with more content stay larger. `flex-grow: 1` on its own leaves `flex-basis: auto`, so it behaves like `flex: auto` in that respect.

**Q9. What is the difference between `align-items` and `align-content`?**
`align-items` aligns items within each flex line on the cross axis. `align-content` distributes space between the lines themselves, so it only has an effect on a multi-line container (`flex-wrap: wrap` or `wrap-reverse`). For example, `align-content: flex-start` packs all lines at the top, while `align-items: center` centers each item in its line.

**Q10. Flexbox has no `justify-items` or `justify-self`. How do you push the last nav link to the far right?**
Use an auto margin on that item: `.nav .login { margin-left: auto; }`. An auto margin absorbs all the free space on that side along the main axis. `margin: auto` on a single item centers it on both axes.

**Q11. A flex item contains a long URL and overflows the container even though the item should shrink. Why, and how do you fix it?**
Flex items have `min-width: auto` by default, which prevents them from shrinking below their min-content width (the longest unbreakable word). Set `min-width: 0` on the item (or `overflow: hidden`), and optionally `overflow-wrap: anywhere` on the text. In a column layout the same issue happens with `min-height`.

**Q12. Build a card row that shows 3 cards per line on desktop and wraps to 1 per line on phones, without media queries.**
```css
.cards { display: flex; flex-wrap: wrap; gap: 1rem; }
.card  { flex: 1 1 280px; }
```
Each card wants about 280px and grows to fill the line. Fewer fit on narrow screens, so they wrap. A drawback is that the last line's cards stretch to a different width from the ones above. If they must line up in strict columns, use grid: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`.

**Q13. What layout does this demo code produce?**
```css
.container {
  display: flex;
  height: 80vh;
  align-items: center;
  flex-direction: column;
  flex-wrap: wrap;
  flex-flow: row wrap;
  gap: 40px 10px;
}
.item1 { align-self: flex-end; }
.order-1 { order: 1; }
```
`flex-flow: row wrap` comes last and overrides `flex-direction: column`, so items flow in **rows** and wrap. There is 40px between lines and 10px between items in a line. Lines stretch to share the 80vh height (default `align-content`), and items are centered vertically in their line, except item 1, which sits at the bottom of its line. The item with `order: 1` is moved after all the others.

**Q14. When would you choose grid over flexbox?**
Choose grid when items must align in two dimensions at once (rows and columns), such as page layouts, galleries or dashboards, or when the container should define the track sizes. Choose flexbox when you lay out a single row or column whose sizes come from the content, such as navbars, button groups, form rows and centering. Many layouts use grid for the page and flexbox inside components.

### Senior (5+ years)

**Q15. Teams in your organisation write ad-hoc flexbox in every component, with inconsistent spacing and the same overflow bugs. How would you standardise flex layout in a design system?**
Ship a few **layout primitives** instead of letting every component hand-roll flexbox. Each one owns one job and exposes a tiny API mapped to tokens:

| Primitive | CSS underneath | Props |
| --- | --- | --- |
| Stack (vertical rhythm) | `display: flex; flex-direction: column; gap: var(--space-*)` | `gap`, `align` |
| Cluster (tags, buttons, toolbars) | `display: flex; flex-wrap: wrap; gap; align-items: center` | `gap`, `justify`, `align` |
| Sidebar / Switcher | flex with a fixed-basis side item, or a container-query switch | `sideWidth`, `breakAt` |

Bake the hard-won defaults in once: `gap` instead of margins, `min-width: 0` on flexible children, `flex-wrap` on clusters. Do **not** expose `order` or `*-reverse`, so reordering cannot break reading order by accident. Enforce it with a lint rule that flags `display: flex` inside component styles that could be a primitive, and with review. Recommendation: three or four primitives cover most component layout, and every bug fixed in a primitive is fixed everywhere.

**Q16. A component must show its items in a row when it has room and stack them when it does not, wherever it is placed. Would you use a flexbox trick or container queries?**
There are two good options:

```css
/* 1. Flexbox only ("Switcher"): no wrapper and no query */
.switcher { display: flex; flex-wrap: wrap; gap: 1rem; }
.switcher > * {
  flex-grow: 1;
  flex-basis: calc((40rem - 100%) * 999);  /* container > 40rem: huge negative, clamped to 0, so items share one row;
                                              container < 40rem: huge positive, so each item takes a whole line */
}

/* 2. Container query: needs a wrapper, because a container cannot query itself */
.switcher-wrap { container-type: inline-size; }
.switcher { display: flex; flex-direction: column; gap: 1rem; }
@container (width >= 40rem) {
  .switcher { flex-direction: row; }
  .switcher > * { flex: 1; }
}
```

The flex trick is all-or-nothing (every item stacks at once), needs no extra element and works in any browser with flexbox. Container queries (supported everywhere since 2023) are easier for the next developer to read and let you change more than direction at the breakpoint (padding, font size, hiding a label). Recommendation: container queries as the default in a design system, documented in [Media and container queries](../15-media-and-container-queries/notes.md); keep the Switcher trick for cases where you cannot add a wrapper or need nothing but the row/stack switch.

**Q17. A designer wants the product image to appear above the title on mobile but the HTML has the title first, and the proposed fix is `order: -1`. How do you handle it?**
Visual reordering with `order`, `row-reverse` or `column-reverse` leaves the DOM order unchanged, so screen readers and keyboard focus follow a different sequence from what sighted users see. That can fail WCAG 1.3.2 (Meaningful Sequence) and 2.4.3 (Focus Order). For an image with no focusable content the risk is small. For links, buttons or form fields it is a real defect.

Decision rule:

- If the visual order is the **meaningful** order, change the HTML order and style the other breakpoint around it.
- If the reorder is purely decorative (an image, an icon), `order` is acceptable.
- The new `reading-flow: flex-visual` property makes focus and reading order follow the visual flex order, but it shipped in Chromium in 2025 and is not yet in Firefox or Safari, so it cannot be the only fix.

Recommendation: fix the source order when interactive content moves, allow `order` for decorative content, and add a keyboard tab-through to the review checklist for any component that uses `order`.

**Q18. A dashboard made of deeply nested flex containers takes hundreds of milliseconds of layout every time the window is resized. What is going on, and how do you fix it?**
With the defaults (`flex-basis: auto`, `width: auto`), the browser must measure each item's content before it can share out the space, and nested flex containers, especially columns with `auto` or percentage heights, can make it lay the same subtree out more than once. The cost multiplies with nesting depth and with the number of items.

How to approach it: record a resize in the DevTools Performance panel and confirm the time is in Layout, not Recalculate Style or Paint. Then give items a definite basis (`flex: 1 1 0`, or a fixed width) so content does not need measuring, flatten the nesting (a single grid for the two-dimensional parts usually replaces two or three levels of flex), add `contain: layout` or `content-visibility: auto` to panels so changes inside one do not relayout the others, and virtualise long lists. Recommendation: measure first, then remove intrinsic sizing from the hot path. Flexbox is fast when the browser does not have to ask every item how big it wants to be.

## References

- [GeeksforGeeks: Introduction to CSS Flexbox](https://www.geeksforgeeks.org/introduction-to-css-flexbox/)
- [MDN: Basic concepts of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox)
- [MDN: justify-content](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-content)
- [MDN: align-items](https://developer.mozilla.org/en-US/docs/Web/CSS/align-items)
- [MDN: align-content](https://developer.mozilla.org/en-US/docs/Web/CSS/align-content)
- [MDN: flex](https://developer.mozilla.org/en-US/docs/Web/CSS/flex)
- [web.dev Learn CSS: Flexbox](https://web.dev/learn/css/flexbox)
- [MDN: Ordering flex items](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Ordering_flex_items)
- [Every Layout: The Switcher](https://every-layout.dev/layouts/switcher/)
