# CSS Grid Layout

> CSS · Topic 14 · Demo: [grid-1.html](grid-1.html) · [grid-2.html](grid-2.html)

CSS Grid is a two-dimensional layout system. You define rows and columns on a parent (the grid container), then place its children (grid items) into cells, between numbered or named lines, or into named areas. It is the right tool for page layouts and anything that must line up in both directions at once, and it replaces most of the old float- and table-based layout hacks.

> **Note:** This topic is flagged for a second pass. `grid-1.html` covers track sizing, gaps, alignment and line-based placement. `grid-2.html` covers named template areas.

## Grid Terminology

| Term | Meaning |
|---|---|
| Grid container | The element with `display: grid` (or `display: inline-grid`). |
| Grid item | A **direct** child of the container. Grandchildren are not grid items unless you nest another grid or use `subgrid`. |
| Grid line | A dividing line between tracks. Numbered from `1` at the start edge, and from `-1` backwards from the end edge. |
| Grid track | One row or one column: the space between two neighbouring lines. |
| Grid cell | The intersection of one row and one column. |
| Grid area | A rectangle of one or more cells, optionally given a name. |
| Gap (gutter) | Space between tracks. There is no gap before the first track or after the last one. |

A grid with 4 columns has **5** column lines:

```text
line:  1       2       3       4       5
       | col 1 | col 2 | col 3 | col 4 |
line: -5      -4      -3      -2      -1
```

## Creating a Grid

```css
.container {
  display: grid;           /* block-level grid container */
  /* display: inline-grid;    the container itself behaves like inline-block */
}
```

`display: grid` on its own gives you a single column with each child in its own row, which looks almost like normal block flow. Columns only appear once you define them.

Grid properties are split between the parent and the children:

| On the container | On the items |
|---|---|
| `display: grid` | `grid-column`, `grid-row` (and their `-start`/`-end` longhands) |
| `grid-template-columns`, `grid-template-rows` | `grid-area` |
| `grid-template-areas` | `justify-self`, `align-self`, `place-self` |
| `gap`, `row-gap`, `column-gap` | `order`, `z-index` |
| `justify-items`, `align-items`, `justify-content`, `align-content` | |
| `grid-auto-rows`, `grid-auto-columns`, `grid-auto-flow` | |

## Defining Tracks: `grid-template-columns` and `grid-template-rows`

From `grid-1.html`:

```css
.container {
  display: grid;
  grid-template-columns: repeat(4, 80px);  /* 4 columns, each 80px wide */
  grid-template-rows: repeat(2, 80px);     /* 2 rows, each 80px tall */
}
```

Each value in the list is one track. The commented-out lines in the demo show other ways to write tracks:

```css
grid-template-rows: 100px 100px 100px;                    /* 3 rows, written out */
grid-template-columns: repeat(4, minmax(100px, 1fr));     /* 4 flexible columns, never under 100px */
grid-template-columns: [pehla] 120px [doosra] 100px [t];  /* 2 columns with named lines */
```

### Track sizing values

| Value | Meaning |
|---|---|
| `100px`, `10rem` | Fixed length. |
| `20%` | Percentage of the container's size on that axis. |
| `1fr` | One *fraction* of the free space left after fixed tracks and gaps are subtracted. |
| `auto` | Sized by its content; also absorbs leftover space when the content alignment is `normal`/`stretch`. |
| `min-content` | As narrow as possible without overflowing (wraps at every opportunity). |
| `max-content` | As wide as the content wants (no wrapping). |
| `minmax(min, max)` | At least `min`, at most `max`. |
| `fit-content(300px)` | Like `auto`, but never larger than the given size. |

How `fr` shares space:

```css
.layout {
  width: 800px;
  display: grid;
  grid-template-columns: 200px 1fr 2fr;
  /* 800 - 200 = 600px free, split 1:2 -> columns are 200px, 200px, 400px */
}
```

With a `gap`, the gaps are subtracted first: `gap: 20px` here leaves `800 - 200 - 2 x 20 = 560px`, so the `fr` columns become about 186.7px and 373.3px.

### `repeat()`

`repeat(count, tracks)` saves typing the same size again and again:

```css
grid-template-columns: repeat(3, 1fr);         /* = 1fr 1fr 1fr */
grid-template-columns: repeat(2, 100px 1fr);   /* = 100px 1fr 100px 1fr */
grid-template-columns: 200px repeat(3, 1fr);   /* can be mixed with other tracks */
```

### `minmax()`

`minmax(100px, 1fr)` means "share the space like `1fr`, but never get narrower than 100px". If the container is too small for every column's minimum, the grid overflows the container instead of squashing the columns.

### Responsive columns without media queries: `auto-fill` vs `auto-fit`

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}
```

The browser fits as many columns of at least 200px as it can, then stretches them equally with `1fr`. As the screen narrows, columns drop off one at a time, down to a single column. No media query needed.

| | `auto-fill` | `auto-fit` |
|---|---|---|
| Creates as many tracks as fit | Yes | Yes |
| Empty tracks (fewer items than columns that fit) | Kept: they still take up space | Collapsed to 0, so the filled tracks stretch across the row |
| When you see a difference | Only when there are not enough items to fill one row | Same |

### Named lines

Line names go in square brackets between the track sizes. The demo uses Hindi names, `pehla` ("first") and `doosra` ("second"), plus `t`:

```css
.container {
  grid-template-columns: [pehla] 120px [doosra] 100px [t];
}

.item-4 {
  grid-row: 1 / 2;
  grid-column: pehla / t;  /* from the first line to the last line: spans both columns */
}
```

- One line can have several names: `[sidebar-end content-start]`.
- Names make placement readable and survive changes to the number of tracks.

> **Note:** In the demo the named-line template is commented out, so the names `pehla` and `t` don't exist while `repeat(4, 80px)` is active. If no line has the name you use, the browser assumes the name refers to implicit lines after the explicit grid and adds extra tracks there. If an item suddenly lands outside your grid, check for a typo in a line name.

## Gaps

```css
.container {
  row-gap: 10px;       /* space between rows */
  column-gap: 44px;    /* space between columns */
  /* gap: 34px;           shorthand: same value for both */
  /* gap: 10px 44px;      shorthand: row-gap first, then column-gap */
}
```

- Gaps only exist *between* tracks. For space around the outside of the grid, use `padding` on the container.
- Older code uses `grid-gap`, `grid-row-gap` and `grid-column-gap`. Browsers still accept them as aliases, but the unprefixed `gap` names are the standard, and they work in flexbox too.
- Prefer `gap` over margins on items: margins add space on the outer edges too, and you end up undoing them with `:last-child` rules.

## Placing Items on Lines

By default items are **auto-placed**: one item per cell, filling row 1 left to right, then row 2, and so on. To place an item yourself, say which line it starts on and which line it ends on.

```css
/* longhands */
.item-1 {
  grid-row-start: 1;
  grid-row-end: 2;
  grid-column-start: 1;
  grid-column-end: 2;
}

/* the same thing with shorthands: start / end */
.item-1 {
  grid-row: 1 / 2;
  grid-column: 1 / 2;
}
```

More ways to write the end position:

```css
.hero { grid-column: 1 / -1; }      /* first line to last line: full width */
.wide { grid-column: 2 / span 2; }  /* start on line 2 and span 2 tracks (ends on line 4) */
.tall { grid-row: span 3; }         /* let auto-placement choose where, but make it 3 rows tall */
```

> **Note:** You count **lines**, not tracks. `grid-column: 1 / 3` covers columns 1 and 2. This off-by-one mistake is the most common placement bug.

Negative line numbers count back from the end of the **explicit** grid only (the tracks you defined), not from the end of any implicit rows the browser added.

### The `grid-area` shorthand

`grid-area` has two different jobs:

```css
/* 1. Line placement: row-start / column-start / row-end / column-end */
.item { grid-area: 1 / 1 / 3 / 4; }  /* rows 1-2, columns 1-3 */

/* 2. Put the item into a named template area (next section) */
.item { grid-area: nav; }
```

> **Note:** The line order for `grid-area` is row-start, column-start, row-end, column-end (top, left, bottom, right). That is **not** the clockwise top, right, bottom, left order used by `margin` and `padding`.

### Overlapping items

Grid happily puts two items in the same cells. The one later in the HTML is painted on top, unless you change that with `z-index`. Grid items accept `z-index` without needing `position: relative`.

## Named Template Areas: `grid-template-areas`

`grid-2.html` draws the layout as text:

```css
.container {
  display: grid;
  grid-template-areas:
    "nav    nav     nav"
    "side   article article"
    "footer footer  footer";
}

.item-1 { grid-area: nav; }
.item-2 { grid-area: side; }
.item-3 { grid-area: article; }
.item-4 { grid-area: footer; }
.item-5 { grid-area: nav; }   /* also "nav" */
```

How to read it:

- Each string is one row; each word is one column. This creates a 3 x 3 grid.
- Repeating a name across cells makes that area span them: `nav` spans all three columns, `article` spans two.
- A `.` (or several dots, like `...`) marks an empty cell: `"side . article"`.
- Every row string must have the same number of cells, and each named area must be a **rectangle**. An L-shape, or a name that appears in two separate places, makes the whole `grid-template-areas` declaration invalid, and the browser ignores it.
- The demo sets no `grid-template-columns`, so the three columns are `auto`. They size to their content and then share the leftover width.

**What happens to item 5?** `.item-1` and `.item-5` are both assigned to `nav`, so they occupy the same cells. Grid does not push the second one somewhere else. They overlap, and item 5 (later in the HTML) is drawn on top of item 1. An area name is not "used up" when one item claims it.

### Combining areas with track sizes

```css
.page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 200px 1fr 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "nav    nav     nav"
    "side   article article"
    "footer footer  footer";
}

header { grid-area: nav; }
aside  { grid-area: side; }
main   { grid-area: article; }
footer { grid-area: footer; }
```

The middle row is `1fr`, so the footer sits at the bottom of the screen even when the content is short.

### Responsive layouts by redrawing the map

```css
@media (max-width: 600px) {
  .page {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto auto;
    grid-template-areas:
      "nav"
      "article"
      "side"
      "footer";
  }
}
```

The HTML doesn't change; only the map does.

## Alignment

Grid has two groups of alignment properties, and they are easy to mix up.

| Property | Set on | What it moves | Axis |
|---|---|---|---|
| `justify-items` | container | every item inside its own cell | inline (horizontal, in English) |
| `align-items` | container | every item inside its own cell | block (vertical) |
| `justify-self` | item | that one item inside its cell | inline |
| `align-self` | item | that one item inside its cell | block |
| `justify-content` | container | the whole set of tracks inside the container | inline |
| `align-content` | container | the whole set of tracks inside the container | block |
| `place-items` | container | shorthand: `align-items justify-items` | both |
| `place-content` | container | shorthand: `align-content justify-content` | both |
| `place-self` | item | shorthand: `align-self justify-self` | both |

- `*-items` / `*-self` values: `stretch` (what the default `normal` does for most items), `start`, `end`, `center`.
- `*-content` values: `start`, `end`, `center`, `stretch`, `space-between`, `space-around`, `space-evenly`.

### What the alignment does in `grid-1.html`

```css
.container {
  width: 80vw;
  height: 100vh;
  display: grid;
  grid-template-columns: repeat(4, 80px);
  grid-template-rows: repeat(2, 80px);
  row-gap: 10px;
  column-gap: 44px;
  justify-items: center;
  align-items: center;
}

.item {
  height: 55px;
  width: 55px;
}
```

- Each cell is 80px x 80px, but each item is only 55px x 55px. `justify-items: center` and `align-items: center` centre every item inside its cell.
- Without them, the items would sit in the top-left corner of their cells. They can't stretch, because they have a fixed `width` and `height`.
- The tracks take up `4 x 80 + 3 x 44 = 452px` horizontally and `2 x 80 + 10 = 170px` vertically, much less than the 80vw x 100vh container. Where that whole 452 x 170 block sits is controlled by `justify-content` and `align-content`. With fixed-size tracks the default packs them at the top-left. Try `justify-content: space-evenly; align-content: center;` to see the whole grid move.
- 4 columns x 2 rows = 8 cells, but there are only 5 items. Items 1 to 4 fill row 1, and item 5 goes to row 2, column 1.

### Centering with grid

```css
.center {
  min-height: 100vh;
  display: grid;
  place-items: center;  /* centres the child horizontally and vertically */
}
```

This is the shortest way to centre something in CSS.

## Explicit vs Implicit Grid

- The **explicit** grid is the tracks you define with `grid-template-rows`, `grid-template-columns` and `grid-template-areas`.
- If there are more items than explicit cells, or an item is placed outside them, the browser adds **implicit** tracks.

In `grid-1.html` there are 8 explicit cells. Add 4 more items (9 in total) and the 9th lands in an implicit third row. Implicit rows are sized by `grid-auto-rows`, which defaults to `auto` (the height of the content).

```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: minmax(100px, auto);  /* every extra row is at least 100px */
  grid-auto-flow: row;                  /* default: fill row by row */
  /* grid-auto-flow: column;              fill column by column, adding implicit columns */
  /* grid-auto-flow: row dense;           backfill earlier holes with later, smaller items */
}
```

> **Note:** `dense` can make the visual order differ from the HTML order. Keyboard Tab order and screen readers follow the HTML, so this confuses users. Use `dense` for image galleries, not for content where order matters.

## Grid vs Flexbox

| | Grid | Flexbox |
|---|---|---|
| Dimensions | Two: rows and columns at the same time | One: a row *or* a column |
| Approach | Layout-first: define tracks, then place items into them | Content-first: items size themselves, then share the space in a line |
| Typical use | Page layouts, card galleries, forms, dashboards | Navbars, toolbars, button groups, centring, spacing items in one line |
| Alignment across rows | Columns stay lined up across every row | Each wrapped line is laid out on its own, so items in different lines don't line up |
| Overlapping items | Easy: place them in the same cells | Needs negative margins or positioning |
| Spacing | `gap` | `gap` |

They are not rivals. A grid for the page and flexbox inside the header or a card is a normal combination.

## Subgrid

A nested grid normally has its own tracks, which have nothing to do with the parent's. With `subgrid`, a child grid reuses the tracks it spans in its parent, so content inside separate cards can line up:

```css
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.card {
  display: grid;
  grid-row: span 3;              /* each card covers 3 rows of the parent */
  grid-template-rows: subgrid;   /* title, body and footer rows line up across all cards */
}
```

`subgrid` has been supported in all major browsers since 2023.

## Accessibility

- Grid only changes how things **look**. The HTML order is still the reading order for screen readers and the Tab order for keyboard users.
- If you move items around with line numbers, `grid-template-areas`, `order` or `dense`, make sure the visual order still matches the HTML order, or fix the HTML order instead.
- Use real landmark elements (`header`, `nav`, `main`, `aside`, `footer`) for the areas of a page layout, as in the combined example above, not just `div`s with class names.

## Common Mistakes

- Putting grid properties on the wrong element. `grid-template-columns` and `gap` go on the container; `grid-column`, `grid-row` and `grid-area` go on the items.
- Off-by-one placement: `grid-column: 1 / 3` spans two columns, not three.
- Template areas that aren't rectangles, or row strings with different numbers of cells. The whole `grid-template-areas` declaration is silently dropped.
- Assigning two items to the same area (like `.item-5` in `grid-2.html`) and expecting the second one to go somewhere else. They overlap.
- Confusing `justify-items` (each item inside its cell) with `justify-content` (the whole grid inside the container).
- `1fr` columns that overflow. `1fr` really means `minmax(auto, 1fr)`, so a column can't shrink below its content's minimum width (a long URL, a wide image, a `<pre>` block). Use `minmax(0, 1fr)` to allow it to shrink.
- Expecting `fr` rows to fill the screen in a container with no set height. `fr` rows only share out space when the container has a definite height (for example `height` or `min-height: 100vh`); otherwise they just fit their content.
- Using a misspelled or undefined line name, which quietly creates implicit tracks.
- Reordering items visually so the screen order no longer matches the Tab order.

## Key Takeaways

- `display: grid` on the parent; children become grid items and are auto-placed one per cell unless you place them.
- Define tracks with `grid-template-columns` / `grid-template-rows` using lengths, `fr`, `auto`, `repeat()` and `minmax()`.
- Place items between **lines** (`grid-column: 1 / 3`, `span 2`, `1 / -1`), by line name, or by area name with `grid-template-areas` + `grid-area`.
- `gap` adds space only between tracks.
- `*-items` / `*-self` align items inside their cells; `*-content` aligns the whole grid inside the container.
- `repeat(auto-fit, minmax(200px, 1fr))` gives a responsive card grid without media queries.
- Extra items create implicit tracks, sized by `grid-auto-rows` / `grid-auto-columns`.
- Grid is two-dimensional, flexbox is one-dimensional, and they work best together.

## Interview Questions

### Junior (0–1 year)

**Q1. What is CSS Grid, and how is it different from Flexbox?**
Grid is a two-dimensional layout system: you control rows and columns at the same time, and items can be placed into specific cells or areas. Flexbox is one-dimensional: it lays items out in a single row or column and distributes space along that line. Use grid when things must line up in both directions (page layouts, galleries), and flexbox for a single line of items (navbars, button groups). They are often used together.

**Q2. What does the `fr` unit mean?**
`fr` is a fraction of the free space left in the grid container after fixed-size tracks and gaps have been taken out. With `grid-template-columns: 200px 1fr 2fr` in an 800px container, the free 600px is split 1:2, so the columns are 200px, 200px and 400px. `fr` can only be used for grid tracks.

**Q3. What do `repeat()` and `minmax()` do in `grid-template-columns: repeat(4, minmax(100px, 1fr))`?**
`repeat(4, ...)` creates four columns with the same size, so you don't have to type it four times. `minmax(100px, 1fr)` makes each column share the space equally like `1fr` but never get narrower than 100px. If the container is too narrow for four 100px columns, the grid overflows instead of shrinking further.

**Q4. What is the difference between a grid line and a grid track? How many columns does `grid-column: 2 / 4` cover?**
A track is a row or column; a line is the boundary between tracks. Lines are numbered from 1, so a 3-column grid has lines 1 to 4. `grid-column: 2 / 4` starts at line 2 and ends at line 4, which covers **two** columns (columns 2 and 3).

**Q5. How does `grid-template-areas` work? What happens here?**

```css
.container { display: grid; grid-template-areas: "nav nav nav" "side article article"; }
.a { grid-area: nav; }
.b { grid-area: nav; }
```

Each string is a row, each word is a cell, and repeating a name makes that area span those cells. Items are placed with `grid-area: <name>`. Here both `.a` and `.b` go into the `nav` area, so they overlap; `.b` is painted on top because it comes later in the HTML. Grid does not move the second item to a free cell.

**Q6. How would you centre a child element horizontally and vertically using grid?**

```css
.parent {
  display: grid;
  place-items: center;
  min-height: 100vh;
}
```

`place-items: center` sets both `align-items` and `justify-items` to `center`, so the child is centred inside its cell, and with one child that cell fills the container.

**Q7. Why use `gap` instead of margins on grid items?**
`gap` only adds space between tracks, never around the outer edge, so the items line up flush with the container. Margins would add space on every side, and you would need extra rules to remove it from the edges. `gap` also doesn't collapse or combine with other margins, and it works the same way in flexbox.

### Mid-level (2–4 years)

**Q8. What is the difference between `auto-fill` and `auto-fit` in `repeat()`?**
Both create as many tracks as will fit in the container, which makes `repeat(auto-fit, minmax(200px, 1fr))` responsive without media queries. The difference shows when there aren't enough items to fill a row. `auto-fill` keeps the empty tracks, so the items stay at their minimum-ish width and leave empty space. `auto-fit` collapses the empty tracks to zero width, so the existing items stretch to fill the row.

**Q9. Explain `justify-items` vs `justify-content` in grid.**
`justify-items` aligns each item inside its own grid cell along the inline axis (for example, centring a 55px item inside an 80px cell). `justify-content` aligns the whole set of tracks inside the container when the tracks are smaller than the container (for example, spreading fixed 80px columns across a wide container with `space-evenly`). The same split exists for `align-items` and `align-content` on the block axis.

**Q10. What is the implicit grid, and how do you control it?**
When there are more items than explicit cells, or an item is placed outside the defined tracks, the browser creates implicit tracks. Their size comes from `grid-auto-rows` and `grid-auto-columns` (default `auto`), and the direction new tracks are added in comes from `grid-auto-flow` (`row` by default, or `column`). For example, `grid-auto-rows: minmax(150px, auto)` keeps every extra row at least 150px tall. `grid-auto-flow: dense` backfills holes but can break the reading order.

**Q11. A column defined as `1fr` overflows its container when it contains a long URL. Why, and how do you fix it?**
`1fr` is shorthand for `minmax(auto, 1fr)`, and the `auto` minimum means the track can't shrink below the content's minimum width. An unbreakable string or wide image therefore forces the track wider than its share. Define the track as `minmax(0, 1fr)` so it can shrink, and handle the content itself with `overflow-wrap: anywhere`, `min-width: 0` on the item, or `max-width: 100%` on images.

**Q12. Build a layout with a header, sidebar, main content and footer that stacks into one column on mobile.**

```css
.page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
}
header { grid-area: header; }
aside  { grid-area: sidebar; }
main   { grid-area: main; }
footer { grid-area: footer; }

@media (max-width: 700px) {
  .page {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr auto;
    grid-template-areas: "header" "sidebar" "main" "footer";
  }
}
```

The HTML stays the same; only the area map changes per breakpoint. The `1fr` row keeps the footer at the bottom on short pages.

**Q13. What accessibility problems can grid cause, and how do you avoid them?**
Grid can place items in a visual order that is different from the HTML order (explicit line placement, `grid-template-areas`, `order`, `grid-auto-flow: dense`). Screen readers and keyboard Tab order follow the HTML, so users can jump around the page unpredictably. Keep the HTML in a logical order and use grid placement for layout, not to fix a wrong order. Also use semantic elements (`header`, `nav`, `main`, `footer`) for the grid areas.

**Q14. What is `subgrid` and when would you use it?**
`grid-template-rows: subgrid` (or `columns`) makes a nested grid use the tracks of its parent grid instead of creating its own. The classic use is a row of cards where each card's title, body and button should line up with the other cards even when the text lengths differ. Without subgrid each card sizes its rows independently and they don't line up. It is supported in all major browsers since 2023.

### Senior (5+ years)

**Q15. You are defining the page layout grid for a large site that many teams build pages on. Most content should sit in a readable column, but some sections (hero images, banners) must go edge to edge. How do you design it?**
Use one grid with **named lines** instead of a wrapper `div` per section and negative-margin "breakout" hacks:

```css
.page-grid {
  --gutter: 1rem;
  display: grid;
  grid-template-columns:
    [full-start] minmax(var(--gutter), 1fr)
    [content-start] min(65ch, 100% - 2 * var(--gutter)) [content-end]
    minmax(var(--gutter), 1fr) [full-end];
}
.page-grid > *            { grid-column: content; }  /* default: readable column */
.page-grid > .full-bleed  { grid-column: full; }     /* opt-in: edge to edge */
```

Lines named `content-start`/`content-end` create an implicit area called `content`, so teams write `grid-column: content` or `full` and never count line numbers. The outer `1fr` tracks absorb spare width, and the gutter minimum keeps text off the screen edge on phones. Recommendation: publish the grid as a layout primitive with two or three named zones (`content`, `wide`, `full`), and make raw line numbers in page code a review flag, because named lines survive later changes to the track list and line numbers do not.

**Q16. A dashboard grid with hundreds of widgets lags when the window is resized. The columns are `repeat(4, auto)` and the rows are `auto`. What do you look at?**
Intrinsic track sizes are the expensive part of grid. `auto`, `min-content`, `max-content`, `fit-content()` and even plain `1fr` (which means `minmax(auto, 1fr)`) make the browser measure the content of every item in a track before it can size the track, and a resize repeats that for every widget.

Remove measurement from the hot path: use definite or content-independent sizes (`minmax(16rem, 1fr)`, `minmax(0, 1fr)`), give implicit rows a fixed size or minimum (`grid-auto-rows: 12rem`), put `contain: layout paint` on each widget so its internal changes do not invalidate the outer grid, add `content-visibility: auto` with `contain-intrinsic-size` for widgets below the fold, and virtualise if the count keeps growing. Confirm each change in the Performance panel's Layout events. Recommendation: in large grids the container should dictate sizes; let content size tracks only in small, bounded grids.

**Q17. Your design system has a Card that should align its title, body and footer with neighbouring cards when it is in a card grid, but must also work on its own. How would you design that component's CSS API?**
Split responsibilities: the **parent** decides placement, the **card** decides its internal structure.

```css
.card {
  display: grid;
  grid-template-rows: auto 1fr auto;   /* works standalone */
  gap: var(--space-2);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: var(--space-4);
}
.card-grid > .card {
  grid-row: span 3;                    /* the parent reserves three rows per card */
  grid-template-rows: subgrid;         /* title/body/footer rows are shared across the row of cards */
}
```

The card never assumes it is inside a grid, and the alignment only switches on in the context that provides the tracks. Document the contract ("Card has exactly three row slots"), because adding a fourth slot later is a breaking change for every grid that spans three rows. Recommendation: put subgrid wiring in the container's styles, not inside the component, and avoid JavaScript height-equalisers now that subgrid is supported everywhere.

**Q18. Design asks for a Pinterest-style masonry gallery. What are your options, and which would you pick?**

| Option | Order | Trade-off |
| --- | --- | --- |
| CSS multi-column (`columns: 18rem`) | Top-to-bottom down each column | No JavaScript and fast, but item 2 appears below item 1 instead of beside it, and reading order looks random across the page |
| Grid with small rows (`grid-auto-rows: 8px`) + JS that sets `grid-row: span N` from each item's height (`ResizeObserver`) | Roughly left to right | Correct order, but needs JavaScript and re-measuring when images load |
| A JavaScript masonry library | Left to right | Absolute positioning, layout shift while loading, more code to maintain |
| Native CSS masonry | Left to right | Still being standardised and only in experimental or preview builds at the time of writing |

Recommendation: if the order of items does not matter (a photo wall), use multi-column. If it does (newest first, search results), use the grid + `span` technique behind a component, and feature-detect native masonry with `@supports` so you can switch to it later without changing the component's API.

## References

- [MDN: CSS grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
- [MDN: Basic concepts of grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Basic_concepts_of_grid_layout)
- [MDN: grid-template-columns](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns)
- [MDN: grid-template-areas](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-areas)
- [MDN: repeat()](https://developer.mozilla.org/en-US/docs/Web/CSS/repeat)
- [MDN: minmax()](https://developer.mozilla.org/en-US/docs/Web/CSS/minmax)
- [MDN: Subgrid](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid)
- [web.dev: Learn CSS - Grid](https://web.dev/learn/css/grid)
- [MDN: Grid layout using named grid lines](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Grid_layout_using_named_grid_lines)
- [MDN: CSS multi-column layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_multicol_layout)
