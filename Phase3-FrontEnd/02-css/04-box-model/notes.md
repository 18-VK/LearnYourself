# The CSS Box Model: Margin, Padding & Borders

> CSS · Topic 4 · Demo: [index.html](index.html)

The CSS box model defines how elements are rendered and how their dimensions are calculated. Every element on the page is a rectangular box made of content, padding, a border and a margin. Almost every layout bug ("why is this 4px too wide?", "why is there a gap here?") comes back to the box model, so it is worth knowing exactly. This note covers the four parts of the box, shorthand order, `box-sizing`, margin collapse, and logical properties (`margin-inline`, `padding-block`, `inset-inline-start`), which name the sides by text direction so the same CSS works in right-to-left and vertical writing.

Link: https://www.codewithharry.com/tutorial/css-box-model/

## The Four Parts of the Box

The box model consists of four main components:

1. **Content**: the text, image or child elements. Sized by `width` and `height`.
2. **Padding**: transparent space *inside* the border, around the content. The element's background shows through it.
3. **Border**: a line around the padding. It has a width, a style and a color.
4. **Margin**: transparent space *outside* the border, which pushes other elements away. The background does not extend into it.

```text
+---------------------------------------------+
|                   margin                    |
|   +-------------------------------------+   |
|   |               border                |   |
|   |   +-----------------------------+   |   |
|   |   |           padding           |   |   |
|   |   |   +---------------------+   |   |   |
|   |   |   |       content       |   |   |   |
|   |   |   +---------------------+   |   |   |
|   |   +-----------------------------+   |   |
|   +-------------------------------------+   |
+---------------------------------------------+
```

| Part | Inside or outside the border | Shows background? | Can be negative? | Clickable area? |
|---|---|---|---|---|
| Content | inside | yes | no | yes |
| Padding | inside | yes | **no** | yes |
| Border | the edge | (has its own color) | no | yes |
| Margin | outside | **no** (transparent) | **yes** | no |

## 1. Padding

Padding is the space between the content and the border.

Link: https://www.codewithharry.com/tutorial/css-padding/

```css
.card {
  padding-top: 10px;
  padding-right: 20px;
  padding-bottom: 10px;
  padding-left: 20px;

  /* same thing, shorthand */
  padding: 10px 20px;
}
```

- Padding **cannot be negative**.
- Padding increases the clickable area of buttons and links, which is good for touch targets.
- A **percentage** padding is calculated from the **width** of the containing block, even for `padding-top` and `padding-bottom`.

## 2. Border

The border sits between the padding and the margin.

Link: https://www.codewithharry.com/tutorial/css-borders/

```css
.box {
  border: 2px solid blue;          /* shorthand: width style color */

  /* longhands */
  border-width: 2px;
  border-style: solid;
  border-color: blue;

  /* one side only */
  border-bottom: 4px dashed red;

  /* rounded corners (not part of the box model size, but usually set with borders) */
  border-radius: 8px;
}
```

Border styles: `none` (the default), `solid`, `dashed`, `dotted`, `double`, `groove`, `ridge`, `inset`, `outset`, `hidden`.

> **Note:** `border-style` defaults to `none`. `border: 2px red;` draws **nothing** because no style is given. Always include a style: `border: 2px solid red;`.

## 3. Margin

Margin is the space outside the border that separates the element from its neighbours.

Link: https://www.codewithharry.com/tutorial/css-margin/

```css
.box {
  margin: 35px;              /* all four sides */
  margin-top: 0;             /* override one side */
}

.container {
  width: 600px;
  margin: 0 auto;            /* center a block horizontally */
}

.pull-up {
  margin-top: -20px;         /* negative margins are allowed */
}
```

- `margin: auto` on the left and right splits the free space equally, which centers a block element **that has a width** smaller than its container. Vertical `auto` margins compute to `0` in normal block flow.
- Margins **can be negative**, pulling the element (or its neighbours) closer.
- Percentage margins, like padding, are calculated from the containing block's **width**.

## Shorthand Value Order

`margin` and `padding` (and `border-width`, `border-color`, `border-style`) accept 1 to 4 values, going clockwise from the top: **Top, Right, Bottom, Left** (remember "TRouBLe").

| Values | Example | Meaning |
|---|---|---|
| 1 | `margin: 10px;` | all four sides 10px |
| 2 | `margin: 10px 20px;` | top/bottom 10px, left/right 20px |
| 3 | `margin: 10px 20px 30px;` | top 10px, left/right 20px, bottom 30px |
| 4 | `margin: 10px 20px 30px 40px;` | top 10, right 20, bottom 30, left 40 |

## `box-sizing`: What Does `width` Mean?

By default, `width` and `height` set only the **content** box. Padding and border are added on top.

| `box-sizing` | `width`/`height` includes | Rendered width for `width: 200px; padding: 10px; border: 2px` |
|---|---|---|
| `content-box` (default) | content only | 200 + 10 + 10 + 2 + 2 = **224px** |
| `border-box` | content + padding + border | **200px** (content shrinks to 176px) |

The demo uses `border-box`, with the comment: *"this means we are giving a new definition of height and width; NOW THE HEIGHT will be (border + padding + content) instead of content only."*

```css
.box1 {
  padding: 10px;
  border: 2px solid blue;
  height: 200px;
  box-sizing: border-box;   /* total height stays 200px; content gets 200 - 20 - 4 = 176px */
}
```

`border-box` is far easier to reason about ("this card is 300px wide, full stop"), so most projects set it globally:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

Margin is **never** included in `width`, whichever value you choose.

## Margin Collapse

Top and bottom margins of block elements are sometimes collapsed into a single margin that is equal to the **largest** of the two margins. This does not happen on left and right margins! Only top and bottom (vertical) margins collapse.

### Collapse between siblings (seen in the demo)

```css
.box1 { margin: 35px; }
.box2 { margin: 25px; }
```

You might expect a gap of 35 + 25 = 60px between the two boxes, but the gap is **35px**: the larger margin wins.

### Collapse between parent and first/last child

If a parent has no border, no padding and no content between it and its first child, the child's top margin "leaks" out and becomes the parent's top margin.

```html
<section class="parent">
  <h2 class="child">Heading</h2>
</section>
```

```css
.parent { background: lightgray; }
.child  { margin-top: 40px; }
/* The 40px appears ABOVE the gray background, not inside it. */
```

Fixes: give the parent `padding-top` or a `border-top`, or make it a new block formatting context with `display: flow-root`.

### Collapse rules in short

- Only **vertical** margins of **block-level boxes in normal flow** collapse.
- Margins do **not** collapse for flex items, grid items, floats, absolutely positioned elements or `inline-block` elements.
- Padding, a border, or a new formatting context (`display: flow-root`, `overflow: hidden/auto`) between parent and child stops parent-child collapse.
- An empty block with no height, padding or border collapses its own top and bottom margins together.
- With a negative margin, the result is the largest positive margin plus the most negative one (`30px` and `-10px` give `20px`).

## Logical Properties

Physical properties (`margin-left`, `padding-top`, `width`) name fixed sides of the screen. **Logical properties** name sides relative to the flow of text, so they adapt when the text direction or writing mode changes.

- The **inline** axis is the direction text runs within a line: left to right in English, right to left in Arabic and Hebrew, top to bottom in vertical Japanese.
- The **block** axis is the direction blocks (paragraphs) stack: top to bottom in horizontal writing.
- **Start** and **end** are where a line or a block begins and ends.

| Physical | Logical | Left-to-right English | Right-to-left Arabic |
|---|---|---|---|
| `margin-left` | `margin-inline-start` | left | right |
| `margin-right` | `margin-inline-end` | right | left |
| `margin-top` / `margin-bottom` | `margin-block-start` / `margin-block-end` | top / bottom | top / bottom |
| `margin-left` + `margin-right` | `margin-inline` (shorthand) | left and right | left and right |
| `padding-top` + `padding-bottom` | `padding-block` (shorthand) | top and bottom | top and bottom |
| `border-left` | `border-inline-start` | left | right |
| `border-top-left-radius` | `border-start-start-radius` | top-left | top-right |
| `left` / `top` | `inset-inline-start` / `inset-block-start` | left / top | right / top |
| `width` / `height` | `inline-size` / `block-size` | width / height | width / height |
| `max-width` | `max-inline-size` | max width | max width |
| `text-align: left` | `text-align: start` | left | right |

```css
.card {
  max-inline-size: 60ch;
  margin-inline: auto;                  /* centered, like margin: 0 auto for the sides */
  padding-block: 1rem;                  /* top and bottom */
  padding-inline: 1.5rem;               /* left and right */
  border-inline-start: 4px solid teal;  /* accent bar on the side where text starts */
}

.badge {
  position: absolute;
  inset-block-start: 0;                 /* top */
  inset-inline-end: 0;                  /* right in LTR, left in RTL */
}
```

```html
<html lang="ar" dir="rtl">  <!-- the accent bar and the badge move to the other side automatically -->
```

### Writing modes and RTL: why they matter

- **One stylesheet for both directions.** With physical properties, every RTL language needs override rules (`[dir="rtl"] .card { margin-left: 0; margin-right: 1rem; }`) that drift out of sync. Logical properties flip by themselves when `dir="rtl"` is set.
- **Vertical writing.** With `writing-mode: vertical-rl` (used for Chinese, Japanese and Korean, and for rotated labels), the inline axis becomes vertical: `inline-size` is now the height and `margin-block-start` is the right side.
- **User-generated content.** With `dir="auto"`, the browser picks the direction from the text, so a comment box can hold Arabic or English and still be laid out correctly.
- **Flexbox and grid are already logical.** `justify-content: flex-start` and grid column order follow the text direction. Physical margins and paddings inside them are what usually break in RTL.

Things that stay physical: the `margin`, `padding` and `inset` shorthands with several values (always top, right, bottom, left), `transform: translateX()`, `box-shadow` offsets and `background-position`. Icons that point (arrows, "back" chevrons) need mirroring separately, for example with `:dir(rtl) .icon-back { transform: scaleX(-1); }`.

> **Note:** Logical longhands and the `margin-inline`/`padding-block` shorthands are supported in all current browsers, so they are safe to use as the default in new code. `inset: 0` is handy for overlays, but it is a shorthand for the physical `top`, `right`, `bottom` and `left`.

## Demo Walkthrough

```css
* {
  margin: 0;
  padding: 0;
}
```

This reset removes the browser's default margins and padding (for example the 8px margin on `<body>`), so every space you see comes from your own CSS.

| | `.box1` | `.box2` |
|---|---|---|
| Classes | `box box1` | `box box2` |
| Background (from `.box`) | aqua | aqua |
| Text color | yellow | red |
| Padding | 10px | 10px |
| Border | 2px solid blue | 2px solid black |
| Margin | 35px | 25px |
| Height | 200px total (border-box) | 200px total (border-box) |
| Content height | 176px | 176px |
| Width | auto: container width minus 70px of margin | auto: container width minus 50px of margin |

Gap between the boxes: **35px** (margin collapse), not 60px. Notice the aqua background fills the padding and sits under the border, but not the margin.

## Inspecting the Box Model

In Chrome or Edge DevTools, select an element and open the **Computed** tab: a diagram shows the exact content, padding, border and margin values. Hovering an element in the Elements panel also highlights the margin (orange) and padding (green) areas on the page.

## Common Mistakes

- **Forgetting the border style.** `border: 2px red;` shows nothing.
- **Width overflow with `content-box`.** `width: 100%` plus padding makes the element wider than its parent. Use `box-sizing: border-box`.
- **Expecting vertical margins to add up.** Adjacent vertical margins collapse to the larger one.
- **A child's `margin-top` moving the parent.** Parent-child margin collapse; add padding/border to the parent or use `display: flow-root`.
- **`margin: auto` not centering.** The element needs a set `width` (or `max-width`) and must be block-level.
- **Using margin for inner space or padding for outer space.** Padding is inside (has background, increases click area); margin is outside (separates elements).
- **Negative padding.** It is invalid and ignored. Use negative margin if you need to pull something.
- **Mixing physical and logical properties for the same side.** `margin-left: 1rem; margin-inline-start: 0;` set the same side in LTR (the later one wins) but different sides in RTL, so the layout differs between languages. Pick one system per component.
- **Assuming `inset` and multi-value `margin`/`padding` shorthands are logical.** They are always top, right, bottom, left.

## Key Takeaways

- Every element is a box: content, then padding, then border, then margin.
- Padding is inside the border and shows the background; margin is outside and is transparent.
- Shorthands go clockwise: top, right, bottom, left.
- `box-sizing: content-box` (default) adds padding and border to `width`; `border-box` includes them. Use `border-box` globally.
- Vertical margins between blocks collapse into the largest one; horizontal margins never collapse.
- Percentage padding and margin are based on the containing block's **width**, even for top and bottom.
- `margin: 0 auto` centers a block that has a width.
- Logical properties (`margin-inline`, `padding-block`, `inset-inline-start`, `inline-size`) follow the text direction and writing mode; use them by default so RTL and vertical text work without override stylesheets.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the CSS box model?**
It is the model the browser uses to lay out every element as a rectangle made of four layers: the content, padding around the content, a border around the padding, and margin outside the border. The element's size on the page is the sum of these layers, depending on `box-sizing`.

**Q2. What is the difference between padding and margin?**
Padding is space inside the border, between the border and the content; it shows the element's background and is part of the clickable area. Margin is space outside the border that separates the element from others; it is transparent. Padding cannot be negative, margin can, and vertical margins can collapse while padding never does.

**Q3. What does `margin: 10px 20px 30px;` mean?**
Three values mean top, left/right, bottom: top margin 10px, left and right margins 20px, bottom margin 30px. The order is always clockwise from the top (top, right, bottom, left), and missing values copy their opposite side.

**Q4. An element has `width: 200px; padding: 20px; border: 5px solid; margin: 10px;`. How wide is it?**
With the default `box-sizing: content-box`, the visible box is 200 + 2 × 20 + 2 × 5 = 250px wide and it takes 270px of horizontal space including margins. With `box-sizing: border-box`, the visible box is exactly 200px (content shrinks to 150px) and it takes 220px including margins.

**Q5. What is margin collapse?**
When the vertical margins of two block elements touch, they combine into one margin equal to the larger of the two instead of adding up. It happens between adjacent siblings and between a parent and its first or last child (when nothing separates them). Horizontal margins never collapse.

**Q6. Why does `border: 3px red;` not show a border?**
The border style is missing, and `border-style` defaults to `none`, which draws no border (and makes the computed border width 0). The shorthand needs a style: `border: 3px solid red;`.

**Q7. How do you center a block element horizontally?**
Give it a width (or `max-width`) smaller than its container and set the left and right margins to `auto`: `width: 600px; margin: 0 auto;`. The free space is split equally on both sides. Flexbox or grid on the parent are alternatives.

### Mid-level (2–4 years)

**Q8. In the demo, `.box1` has `margin: 35px` and `.box2` has `margin: 25px`. How big is the gap between them, and how could you make it 60px?**
The gap is 35px because the bottom margin of `.box1` and the top margin of `.box2` collapse into the larger value. To get 60px, stop the collapse: make the parent a flex or grid container (`display: flex; flex-direction: column;`), where margins do not collapse, or use one-directional spacing such as `margin-bottom: 60px` on the first box only. Using `gap` on a flex/grid parent is the modern way to space siblings.

**Q9. A child's `margin-top` pushes its parent down instead of creating space inside the parent. Why, and how do you fix it?**
This is parent-child margin collapse: with no border, padding or content separating them, the child's top margin merges with the parent's top margin and ends up outside the parent. Fix it by adding `padding-top` or a border to the parent, by making the parent a new block formatting context with `display: flow-root`, or by using flex/grid on the parent. Often the cleaner fix is to use padding on the parent instead of margin on the child.

**Q10. Why do many codebases start with `*, *::before, *::after { box-sizing: border-box; }`?**
With `border-box`, the width you set is the width you get, so adding padding or a border does not break a layout (for example two `width: 50%` columns with padding still fit side by side). Including `::before` and `::after` makes pseudo-elements behave the same way. A variant sets `html { box-sizing: border-box; }` and `*, *::before, *::after { box-sizing: inherit; }` so a component can switch back to `content-box` for its whole subtree.

**Q11. An element has `padding-top: 50%`. What is that 50% of?**
Of the containing block's **width**, not its height, for both vertical and horizontal padding and margins. This was historically used to create fixed aspect-ratio boxes (`padding-top: 56.25%` for 16:9). Today `aspect-ratio: 16 / 9;` does the same thing more clearly.

**Q12. Do margins collapse inside a flex or grid container?**
No. Margin collapse only applies to block-level boxes in normal block flow. Flex and grid items keep their full margins, so two items with 20px margins have a 40px gap between them. This is one reason layouts sometimes "change spacing" when a parent switches from `block` to `flex`.

**Q13. When would you use a negative margin?**
To pull an element outside its container's padding (for example a full-bleed image inside a padded card: `margin-inline: -16px`), to overlap elements slightly, or to cancel out spacing such as the outer gutters of a row of items. Negative margins affect layout, so neighbouring content moves too; for purely visual offsets without layout effect, `transform: translate()` or `position: relative` is often safer.

### Senior (5+ years)

**Q14. The product is launching in Arabic and Hebrew, and the CSS is full of `margin-left` and `padding-right`. How do you plan the right-to-left migration?**
Make the browser know the direction first: set `dir="rtl"` on `<html>` from the locale, and `dir="auto"` on fields that show user-generated text. Then:

- Convert inline-axis physical properties (margins, paddings, borders, radii, `left`/`right`, `text-align`) to logical ones component by component, and add a lint rule (for example the `stylelint-use-logical` plugin) so new physical properties do not creep back in.
- Handle what logical properties do not cover: directional icons, `translateX()` animations that slide in from one side, shadow offsets, and JavaScript that calculates positions or reads `scrollLeft` (which is zero or negative in RTL in current browsers).
- Add RTL screenshots to visual regression tests and review with native readers, because mirroring mistakes are easy to miss.

Tools that generate a flipped RTL copy of the stylesheet (such as RTLCSS) are a valid stopgap for legacy code, but they double what you ship and test. Recommendation: logical properties as the source of truth, enforced by lint, with build-time flipping only for code you cannot touch.

**Q15. In a design system, should components like `Button` or `Card` set their own outer margins?**
No. An outer margin bakes in an assumption about where the component will be placed, so consumers end up writing `margin: 0` overrides. It also behaves differently by context: margins collapse in normal block flow but not in flex or grid (Q12), so the same component gets different spacing in different parents.

Split the responsibility instead: a component owns its **inside** (padding, internal `gap`), and the parent layout owns the **space between** children, through `gap` on flex/grid or small layout primitives such as a Stack (`.stack > * + * { margin-block-start: var(--space-3); }`). Use spacing tokens and logical properties so spacing stays consistent and works in RTL. Recommendation: no external margins on reusable components, `gap`-based layout components for spacing, and catch violations in code review or with a lint rule.

**Q16. The Cumulative Layout Shift (CLS) budget is failing because content jumps while images, ads and embeds load. Which box-model techniques fix it?**
A layout shift happens when a box that is already painted changes size and pushes its neighbours. The fix is to reserve the box before its content arrives:

- **Images and video:** set `width` and `height` attributes (browsers derive the aspect ratio from them) with `max-width: 100%; height: auto;`, or set `aspect-ratio` in CSS.
- **Ads, embeds and late-loading widgets:** reserve the slot with `min-height` or `aspect-ratio` sized for the most common case, and do not collapse the slot if it stays empty.
- **Interactive states:** changing `border-width` or `padding` on hover or selection moves neighbours. Use `outline`, an inset `box-shadow`, or a transparent border that is reserved from the start.
- **Long pages using `content-visibility: auto`:** give sections a `contain-intrinsic-size` so their placeholder height is realistic.

Confirm the culprits with the Layout Shift regions in DevTools or the `web-vitals` library in the field. Recommendation: make "every late-arriving box has reserved dimensions" a component requirement, and track CLS in CI (for example with Lighthouse CI) as well as in real-user monitoring.

## References

- [CodeWithHarry: CSS Box Model](https://www.codewithharry.com/tutorial/css-box-model/)
- [CodeWithHarry: CSS Padding](https://www.codewithharry.com/tutorial/css-padding/)
- [CodeWithHarry: CSS Borders](https://www.codewithharry.com/tutorial/css-borders/)
- [CodeWithHarry: CSS Margin](https://www.codewithharry.com/tutorial/css-margin/)
- [MDN: box-sizing](https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing)
- [MDN: Mastering margin collapsing](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model/Mastering_margin_collapsing)
- [web.dev: Learn CSS - Box model](https://web.dev/learn/css/box-model)
- [MDN: CSS logical properties and values](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values)
- [MDN: writing-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/writing-mode)
- [web.dev: Learn CSS - Logical properties](https://web.dev/learn/css/logical-properties)
- [web.dev: Cumulative Layout Shift (CLS)](https://web.dev/articles/cls)
