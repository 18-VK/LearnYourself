# CSS Float, Clear and Block Formatting Context

> CSS · Topic 12 · Demo: [index.html](index.html)

`float` pushes an element to the left or right side of its container and lets text and inline content wrap around it, the way text wraps around a photo in a newspaper. `clear` makes an element move below floats instead of wrapping beside them. Floats were once used to build whole page layouts. Today flexbox and grid do that job, and `float` is back to its original purpose: wrapping text around images. The note also covers the problem floats cause for their parent (it collapses), the three ways to contain floats (clearfix, `overflow`, `display: flow-root`), and the block formatting context that explains why the fixes work.

## What `float` is for

```html
<div class="cards">
  <img src="photo.jpg" alt="" width="230">
  <div class="card"><p>Lorem ipsum ...</p></div>
</div>
```

```css
img {
  float: left;   /* image goes to the left, the text flows around its right side */
}
```

In the demo, the fishing photo floats left and the paragraphs wrap around it.

## `float` values

| Value | Effect |
| --- | --- |
| `none` | Default. The element is not floated. |
| `left` | Moves the element to the left edge of its container. Content wraps on its right. |
| `right` | Moves the element to the right edge. Content wraps on its left. |
| `inline-start` | Floats to the start side of the text direction (left in English, right in Arabic). |
| `inline-end` | Floats to the end side of the text direction. |

There is **no `float: center`**. To center something, use `margin: 0 auto`, flexbox or grid.

## How a floated element behaves

1. **It is shifted left or right** as far as it can go inside its container, starting at the vertical position where it would have been in normal flow.
2. **It is partly taken out of the normal flow.** Following **block boxes** act as if the float is not there: their background and border extend underneath it. But their **lines of text** get shorter so the text wraps around the float.
3. **It becomes block-level.** A floated `<span>` or `<img>` behaves like `display: block`, so `width`, `height` and vertical margins work.
4. **It shrinks to fit its content** if no width is set.
5. **Several floats line up side by side** in the same direction, and drop to the next line when there is no room left.

Point 2 is visible in the demo. Each `.card` has a red border, and that border runs the full width of the container, **behind** the image. Only the text inside the card moves out of the image's way.

## `clear`

`clear` says: "do not sit next to earlier floats, move down below them".

| Value | Moves the element below... |
| --- | --- |
| `none` | Default. Nothing, the element can sit next to floats. |
| `left` | earlier left floats |
| `right` | earlier right floats |
| `both` | earlier left and right floats |
| `inline-start` / `inline-end` | floats on the start/end side of the text direction |

`clear` goes on the element that comes **after** the float, not on the float itself, and it only reacts to floats that come **earlier** in the same container (block formatting context).

### The demo, step by step

```css
.card:nth-child(3) {
  background-color: aqua;
  clear: both;
}
```

The children of `.cards` are:

| Position | Element | Matched by `.card:nth-child(3)`? |
| --- | --- | --- |
| 1 | `<img>` | No (not a `.card`) |
| 2 | first `.card` (short paragraph) | No |
| 3 | second `.card` (the long lorem text) | **Yes** |
| 4 | third `.card` ("Card 3") | No |

> **Note:** `:nth-child()` counts **all** siblings, including the `<img>`. So `.card:nth-child(3)` selects the **second** card (the long text), not the one labelled "Card 3". To target "Card 3", use `.card:nth-child(4)` or `.card:nth-of-type(3)` (it is the third `<div>`).

Result: the first card's text wraps beside the image, the long card gets an aqua background and starts **below** the image because of `clear: both`, and "Card 3" follows normally.

## The collapsing parent problem

Floats do not add to their parent's height in normal flow. If a container holds **only** floated children (or the float is taller than everything else), the container collapses. Its border and background shrink to the height of the non-floated content, or to zero, and the float sticks out of the bottom.

```html
<div class="row">
  <div class="col" style="float: left">A</div>
  <div class="col" style="float: left">B</div>
</div>
<!-- .row has height 0: its border is drawn as a flat line above A and B -->
```

The demo prevents this with `display: flow-root` on `.cards`:

```css
.cards {
  border: 2px solid black;
  display: flow-root;   /* the container now wraps around its floats */
}
```

(In this particular demo, the cleared long card already pushes the container below the image. Remove `clear: both` and shorten the text, and you will see why `flow-root` matters.)

### Clearfix

Before `display: flow-root` existed, the standard fix was the **clearfix** hack (see [W3Schools: How to clear floats](https://www.w3schools.com/howto/howto_css_clearfix.asp)). It adds an invisible pseudo-element as the **last child** of the container and clears it:

```css
.clearfix::after {
  content: "";      /* a pseudo-element is only generated when it has content */
  display: table;   /* display: block works too for this ::after version */
  clear: both;      /* forced below every earlier float */
}
```

```html
<div class="row clearfix">
  <div class="col" style="float: left">A</div>
  <div class="col" style="float: left">B</div>
</div>
<!-- .row now wraps A and B -->
```

Why it works: the pseudo-element is ordinary in-flow content. `clear: both` pushes it below the floats, and a parent always grows to contain its in-flow content, so its bottom edge ends up below the floats too. The parent does **not** become a block formatting context, so its other behaviour (margin collapsing, overlapping floats outside it) is unchanged.

Variants you will meet in older code:

| Variant | What the extra part does |
| --- | --- |
| `::after { display: block; }` | Same float containment as `table` |
| "Micro clearfix": `::before, ::after { content: ""; display: table; }` plus `::after { clear: both; }` | The `::before` table box also stops the first child's top margin from collapsing through the parent. A table box is a BFC root, and margins cannot collapse through one. |
| `*zoom: 1` next to it | Triggered "hasLayout" in Internet Explorer 6 and 7. Dead code today: delete it. |

> **Note:** A clearfix on a container that later becomes `display: flex` or `grid` turns its `::before`/`::after` into **flex or grid items**. With `justify-content: space-between` they take the first and last slots and push the real items inward. Remove the clearfix class when you migrate a container to flex or grid.

### Clearfix vs `overflow` vs `display: flow-root`

This is the comparison interviewers ask for. All of these make the parent wrap its floats; they differ in side effects.

| Fix | How it works | Creates a BFC? | Trade-offs |
| --- | --- | --- | --- |
| `display: flow-root` | Makes the parent a block formatting context root, which contains its floats | Yes | Supported everywhere since 2019 and side-effect free. **Recommended.** |
| `overflow: hidden` / `auto` | A non-`visible` overflow also makes a BFC | Yes | Clips shadows, dropdowns and focus outlines that stick out. `auto` can show scrollbars. `overflow: clip` does **not** create a BFC and does not contain floats. |
| Clearfix (`::after { clear: both }`) | A cleared pseudo-element at the end stretches the parent | No | Works even in very old browsers, but it is extra CSS, uses up the `::after` slot, and turns into a stray item under flex or grid. |
| Empty `<div style="clear: both">` at the end | The cleared div sits below the floats and stretches the parent | No | Adds meaningless markup. Avoid. |
| Float the parent too | Floats contain their floated children | Yes | Just moves the problem one level up. |

For new code use `display: flow-root`. Keep clearfix only where an existing codebase already relies on it, and reach for `overflow: hidden` only when you also want the clipping.

## Block formatting context (BFC) in short

A block formatting context is an independent layout area. Inside it, floats and margins do not interact with anything outside. A BFC is created by, among others:

- the root `<html>` element
- floated elements and `position: absolute`/`fixed` elements
- `display: inline-block`, `flow-root`, table cells
- `overflow` other than `visible` and `clip`
- flex items and grid items
- `contain: layout`, `content` or `paint`

What a BFC does:

1. **Contains its floats**, which fixes the collapsing parent.
2. **Stops margin collapsing** between itself and its children.
3. **Does not overlap floats.** A BFC placed next to a float sits **beside** it and gets narrower, instead of running underneath it.

Point 3 gives you a "media object" (image on the left, text that never wraps under the image):

```css
img       { float: left; margin-right: 1rem; }
.card     { display: flow-root; }   /* the card sits beside the image as a column */
```

## Floats today: when to use them

| Task | Use |
| --- | --- |
| Text wrapping around an image or pull-quote | `float` |
| Page layout, columns, navbars, card grids | Flexbox or grid |
| Centering | Flexbox, grid or `margin: auto` |
| Image beside text, text never wrapping under it | Flexbox (or float + `flow-root`) |

> **Note:** `float` is **ignored** on flex items and grid items, and on `position: absolute`/`fixed` elements. If you add `display: flex` to `.cards`, the image stops floating and becomes a flex item.

## Beyond the lecture: `shape-outside`

Floats can make text wrap around a shape instead of a rectangle:

```css
img.avatar {
  float: left;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  shape-outside: circle(50%);   /* text follows the circle */
  margin-right: 1rem;
}
```

`shape-outside` only works on floated elements.

## Common Mistakes

- **Collapsed parent:** the container's border or background does not surround the floated children. Use `display: flow-root`.
- **Expecting neighbouring blocks to move aside.** Only their text wraps. Their background and border still run behind the float.
- **Putting `clear` on the float** instead of on the element that should go below it.
- **Miscounting with `:nth-child()`.** It counts every sibling, not just elements with the class (see the demo).
- **Floating items inside a flex or grid container** and wondering why nothing happens.
- **Using floats for page layout** in new code. Flexbox and grid are simpler and more robust.
- **Using `overflow: hidden` just to contain floats**, then fighting clipped shadows, dropdowns and focus rings. Use `flow-root`.
- **Keeping a clearfix on a container that became flex or grid.** Its `::before`/`::after` turn into empty items that take up slots.

## Key Takeaways

- `float: left | right` moves an element to the side of its container and lets inline content wrap around it.
- Floated elements leave the normal flow for block boxes, but line boxes (text) still wrap around them.
- `clear: left | right | both` moves an element below earlier floats.
- Parents do not grow to contain floats by default. `display: flow-root` fixes this without side effects; clearfix and `overflow: hidden` are the older fixes, each with a side effect.
- A block formatting context contains floats, stops margin collapse and does not overlap floats.
- Use floats for text wrapping, and flexbox/grid for layout. `float` has no effect on flex and grid items.

## Interview Questions

### Junior (0–1 year)

**Q1. What does `float` do?**
It moves an element to the left or right edge of its container and lets text and inline content wrap around it. The floated element is taken out of the normal flow for block-level layout, but surrounding text still makes room for it.

**Q2. What does `clear` do?**
It prevents an element from sitting next to earlier floats. `clear: left`, `right` or `both` moves the element down until it is below those floats. It is set on the element after the float.

**Q3. Why does a parent with floated children sometimes have zero height, and how do you fix it?**
Floats do not add to their parent's height in normal flow, so a parent containing only floats collapses. Fix it with `display: flow-root` on the parent (modern), `overflow: auto`/`hidden`, or the clearfix `::after` hack.

**Q4. What is `display: flow-root`?**
A display value that makes the element a normal block that also creates a new block formatting context. It exists precisely to contain floats (and prevent margin collapse with children) without the side effects of `overflow: hidden`.

**Q5. Can you center an element with `float`?**
No, `float` only accepts `left`, `right`, `none`, `inline-start` and `inline-end`. To center, use `margin: 0 auto` on a block with a width, `text-align: center` for inline content, or flexbox/grid.

### Mid-level (2–4 years)

**Q6. What is a block formatting context, and why does it matter for floats?**
It is an independent layout region in which floats and margins are contained. It is created by `flow-root`, a non-visible `overflow`, `inline-block`, floats, absolute positioning, flex/grid items and more. A BFC contains its floated children (fixing the collapse), stops its margins collapsing with its children, and does not overlap neighbouring floats.

**Q7. Compare clearfix, `overflow: hidden` and `display: flow-root` for containing floats.**
All three make the parent wrap its floats, but in different ways:

- **Clearfix** (`::after { content: ""; display: table; clear: both; }`) adds a cleared pseudo-element at the end, and the parent grows to contain it. It does not create a BFC, works even in very old browsers, but is extra code, occupies `::after`, and becomes a stray flex/grid item if the container later switches to flex or grid.
- **`overflow: hidden`** (or `auto`) creates a BFC, so the parent contains its floats, but it clips anything that sticks out (shadows, dropdowns, focus rings), and `auto` may add scrollbars.
- **`display: flow-root`** creates a BFC with no side effects. It exists for exactly this job and is the modern choice.

Recommendation: `flow-root` in new code, clearfix only where legacy code already depends on it, and `overflow: hidden` only when you also want clipping.

**Q8. Given the markup below, which element does `.card:nth-child(3)` select?**
```html
<div class="cards">
  <img src="a.jpg" alt="">
  <div class="card">One</div>
  <div class="card">Two</div>
  <div class="card">Three</div>
</div>
```
It selects "Two". `:nth-child()` counts all siblings regardless of class, and the `<img>` is child 1. `.card:nth-child(3)` means "the third child, if it has class `card`". To select "Three", use `.card:nth-child(4)` or `.card:nth-of-type(3)`.

**Q9. In a modern codebase, when would you still use `float`?**
For its original purpose: wrapping text around an image, figure or pull-quote inside an article, optionally with `shape-outside` for non-rectangular wrapping. Flexbox and grid cannot make text flow around an element. For layouts (columns, navbars, card grids), flexbox and grid are the right tools.

**Q10. A developer adds `float: right` to a button inside a `display: flex` container and it does not move. Why, and what should they do?**
`float` has no effect on flex items. Inside a flex container, push the button to the right with `margin-left: auto`, or use `justify-content: space-between` on the container.

**Q11. You float an image left, but you want the text column next to it to never wrap under the image, even when the text is longer than the image. How?**
Make the text container a block formatting context with `display: flow-root` (or `overflow: hidden`). A BFC does not overlap floats, so it sits beside the image as a narrower column. The modern alternative is a flex container with the image and the text as two flex items.

### Senior (5+ years)

**Q12. You inherit a float-based grid system (`.row` with clearfix, `.col-6 { float: left; width: 50%; }`) used on hundreds of pages. How do you migrate it to flexbox or grid without breaking production?**
Do not rewrite it in one go. Re-implement the **same public classes** on top of flexbox or grid, so templates do not change, and roll the change out page by page behind a modifier class or feature flag. Watch for the behaviour differences that cause regressions:

- The clearfix `::before`/`::after` become flex/grid items, so remove the clearfix from `.row` in the same change.
- Floats shrink-wrap and sit side by side by width, while flex items also shrink (`flex-shrink: 1`), so add `flex-shrink: 0` or use `flex: 0 0 50%` to keep the old widths.
- Negative-margin gutters (`margin: 0 -15px`) can be replaced by `gap`, but only once every column uses the new widths, because `gap` plus percentage widths overflows (`50% + 50% + gap > 100%`).
- `float` and `clear` left on children do nothing inside a flex or grid container, so leftovers are harmless but should be deleted later.

Recommendation: keep the class API, swap the engine, protect it with visual-regression screenshots of the busiest templates, and delete the float code only after the last page has moved.

**Q13. A design-system Card uses `overflow: hidden` to contain floated content and clip its rounded corners. Teams report clipped dropdowns and cut-off focus rings. What do you change?**
The card is using one property for two unrelated jobs. Split them:

- **Containing floats:** `display: flow-root`, which has no clipping.
- **Rounded corners on media:** clip only the element that needs it (`.card__media { border-radius: inherit; overflow: hidden; }`), or use `overflow: clip`, which clips without making a scroll container. Note that `overflow: clip` does **not** create a BFC, so it no longer contains floats on its own.
- **Dropdowns:** render them in the top layer (`popover`) or a portal so no ancestor can clip them (see [Position and z-index](../11-position-and-z-index/notes.md#interview-questions)).
- **Focus rings:** draw them inside the card with a negative `outline-offset`, or on a child that is not clipped.

Recommendation: `flow-root` on the card root, clipping only on the media slot, and a rule in the design system that component roots never use `overflow: hidden` just to contain floats.

**Q14. Components in your library keep "leaking" margins: a heading's top margin collapses through its card and pushes the whole card down. Do you fix it with BFCs?**
You can: `display: flow-root` on each component root stops child margins from collapsing through it. But that only treats the symptom. The cause is components that carry **outer** margins and therefore make layout decisions they do not have the context for.

A sturdier policy for a design system:

1. Components have **no outer margin** on their root or on their first and last children.
2. Spacing between components belongs to layout primitives (a Stack using `display: flex; flex-direction: column; gap: var(--space-4)`, or grid `gap`). Flex and grid items never collapse margins.
3. Use `flow-root` where a component must contain floats from user content (rich text, CMS output).

Recommendation: fix the spacing model with `gap`-based layout primitives, and keep `flow-root` as a targeted tool rather than a global patch.

**Q15. A CMS lets editors float images inside articles. What can go wrong in production, and what guardrails would you add?**
Typical issues: a 600px floated image leaves a 40px sliver of text beside it on phones; a float taller than its section pokes into the next section or the footer; `shape-outside: url(...)` silently does nothing for images served from another origin without CORS headers, because the browser must read the image's pixels; and floats inside a container that a later redesign makes `display: flex` stop floating at all.

Guardrails: cap floated media (`max-width: 50%`), drop the float on narrow screens (`@media (width < 40em) { .article img { float: none; margin-inline: auto; } }`), make the article body and each section a `flow-root` so floats never escape, and serve shape images same-origin or with `crossorigin` and the right CORS headers. Recommendation: let editors choose "left/right/full" options mapped to classes, never free-form inline styles, so the rules above are always applied.

## References

- [CodeWithHarry: CSS Float](https://www.codewithharry.com/tutorial/css-float/)
- [MDN: float](https://developer.mozilla.org/en-US/docs/Web/CSS/float)
- [MDN: clear](https://developer.mozilla.org/en-US/docs/Web/CSS/clear)
- [MDN: display](https://developer.mozilla.org/en-US/docs/Web/CSS/display)
- [MDN: Block formatting context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_display/Block_formatting_context)
- [MDN: shape-outside](https://developer.mozilla.org/en-US/docs/Web/CSS/shape-outside)
- [W3Schools: How to clear floats (clearfix)](https://www.w3schools.com/howto/howto_css_clearfix.asp)
- [MDN: overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)
