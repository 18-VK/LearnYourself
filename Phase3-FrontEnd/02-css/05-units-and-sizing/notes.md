# Sizing and Units in CSS

> CSS · Topic 5 · Demo: [index.html](index.html)

Every length in CSS (widths, font sizes, margins) needs a unit, and the unit decides what the number is relative to. Fixed units like `px` stay the same everywhere; relative units like `%`, `em`, `rem`, `vw` and `vh` adapt to the parent, the font size or the screen. This note covers the units, the values `width` and `height` accept, why `max-width` and `min-height` beat fixed sizes on small screens, the sizing functions `calc()`, `min()`, `max()` and `clamp()`, and the basics of responsive sizing. Picking the right unit is the foundation of responsive design.

Sizing in CSS: https://www.codewithharry.com/tutorial/css-size/

## Absolute Units

| Unit | Meaning | Use |
|---|---|---|
| `px` | CSS pixel (1/96 of an inch, not a physical device pixel) | borders, shadows, small fixed details |
| `pt` | point, 1pt = 1/72 inch (1in = 96px = 72pt) | print stylesheets |
| `cm`, `mm`, `in`, `pc` | physical sizes | print only |

`px` is predictable, but a layout built only from pixels does not adapt to different screen sizes or to the user's font size setting.

## Relative Units

### Percentage (`%`)

A percentage is relative to the parent (more exactly, the *containing block*). The demo's comment puts it as: *percentage is used to define how much percent of space the child will take from the parent's space.*

```css
.container > div {
  width: 50%;        /* half the width of .container */
}

.container > div > div {
  width: 50%;        /* half of its parent, so about a quarter of .container */
}
```

What a percentage refers to depends on the property:

| Property | `%` is relative to |
|---|---|
| `width`, `margin`, `padding` (all sides!) | the containing block's **width** |
| `height` | the containing block's **height**, but only if that height is set explicitly |
| `font-size` | the parent's font size |
| `line-height` | the element's own font size |
| `transform: translate()` | the element's own size |

> **Note:** `height: 50%` does nothing if the parent's height is `auto` (determined by its content); the percentage then behaves like `auto`. Give the parent a definite height, or use `vh`, flexbox or grid.

### `em`

`em` is relative to a **font size**:

- In `font-size`, `1em` = the **parent's** font size. The demo comment: *"2em - 2 times of font size defined"*.
- In every other property (`padding`, `margin`, `width`, ...), `1em` = the element's **own** computed font size.

```css
.container       { font-size: 18px; }
.container > div { font-size: 2em; }   /* 2 x 18px = 36px */
.container > div { padding: 1em; }     /* 1 x its own 36px = 36px */
```

`em` values **compound** when nested: if every `<li>` has `font-size: 1.2em`, a list nested three levels deep ends up at 1.2 x 1.2 x 1.2 = 1.728 times the base size.

### `rem`

`rem` means "root em": it is relative to the font size of the **root element** (`<html>`), no matter how deeply the element is nested. It never compounds.

```css
html { font-size: 12px; }   /* the demo sets the root size to 12px */

h1   { font-size: 2rem; }   /* 2 x 12px = 24px, everywhere */
.card { padding: 1.5rem; }  /* 18px */
```

Browsers default the root font size to 16px, so without the demo's `html` rule `1rem` = 16px.

> **Note:** Setting `html { font-size: 12px; }` (as the demo does) overrides the user's browser font-size preference, which hurts people who increase it for readability. Leave the root size alone, or use a percentage (`html { font-size: 100%; }` or the common `62.5%`, which makes `1rem` = 10px by default but still scales with user settings).

Video explaining em and rem (linked in the demo): https://youtu.be/DVjrb52C5Gs

### Viewport units (`vw`, `vh`, `vmin`, `vmax`)

The **viewport** is the total visible page area the user sees in the browser window.

| Unit | Equals |
|---|---|
| `1vw` | 1% of the viewport **width** |
| `1vh` | 1% of the viewport **height** |
| `1vmin` | 1% of the **smaller** of width and height |
| `1vmax` | 1% of the **larger** of width and height |

```css
.box {
  width: 80vw;     /* 80% of the window width */
  height: 10vh;    /* 10% of the window height */
}
```

- `100vw` includes the vertical scrollbar on desktop browsers, so `width: 100vw` often causes a small horizontal scrollbar. Use `width: 100%` for "full width".
- On phones, `100vh` is the height with the browser's address bar *hidden*, so a `100vh` section can be taller than the visible screen. Newer units fix this: `svh` (small: bars shown), `lvh` (large: bars hidden) and `dvh` (dynamic: updates as the bars move). `min-height: 100dvh` is the modern full-screen section.

### Other relative units

- `ch`: width of the "0" character. `max-width: 65ch` gives a comfortable line length for reading.
- `ex`: height of the lowercase "x". Rarely used.

## Units Compared

| Unit | Relative to | Good for | Watch out for |
|---|---|---|---|
| `px` | nothing (fixed) | borders, shadows, hairlines | does not scale with user font settings |
| `%` | parent / containing block | fluid widths, columns | height needs a definite parent height |
| `em` | parent font size (for `font-size`), own font size (others) | padding/margins that scale with the component's text | compounds when nested |
| `rem` | root (`<html>`) font size | font sizes, consistent spacing scale | root size set in px breaks user zoom preference |
| `vw` / `vh` | viewport size | full-screen sections, fluid type | scrollbar width, mobile address bar |
| `vmin` / `vmax` | smaller / larger viewport side | squares that fit any orientation | can get very small or very large |

## Values for `width` and `height`

The `height` and `width` properties can take the following values:

| Value | Meaning |
|---|---|
| `auto` | The default. The browser calculates the size. For a block element's width, that means "fill the available width of the parent"; for height, "as tall as the content". |
| length | A fixed or relative size in `px`, `em`, `rem`, `vw`, `vh`, etc. |
| `%` | A percentage of the **containing block**: its width for `width`, its height for `height`. |
| `initial` | Sets the property to its **initial value** from the CSS specification, which for `width` and `height` is `auto`. |
| `inherit` | Takes the same value as the parent element. |
| `min-content` | As narrow as possible: the width of the longest word. |
| `max-content` | As wide as the content wants, with no wrapping. |
| `fit-content` | Like `max-content`, but never wider than the available space. |

> **Note:** `initial` means the property's initial value defined by CSS (`auto` here), **not** the browser's default style for that element. That difference matters for properties like `display`, whose initial value is `inline` even for a `<div>`.

Things that often surprise learners:

- **Percentage heights need a parent with a definite height** (see the note in the percentage section above).
- **Padding and border are added on top** of `width` and `height` by default (`box-sizing: content-box`). With `box-sizing: border-box`, `width` includes them, which is easier to reason about. See [The CSS box model](../04-box-model/notes.md).
- **`width` and `height` are ignored on non-replaced inline elements** such as a plain `<span>`. Use `display: inline-block` or `block`.

## Setting `max-width` (and the Other Limits)

The `max-width` property sets the **maximum** width of an element. It can be a length (`px`, `rem`, etc.), a percentage (`%`) of the containing block, or `none`, which is the default and means there is no maximum width. Limits instead of fixed sizes are what make layouts flexible.

### The problem with a fixed width

```css
div.fixed {
  width: 500px;
  margin: auto;
  border: 3px solid #73ad21;
}
```

When the browser window is smaller than the width of the element (500px), the element doesn't shrink. It sticks out of the window and the browser adds a **horizontal scrollbar** to the page.

### The fix: `max-width`

```css
div.fluid {
  max-width: 500px;
  margin: auto;
  border: 3px solid #73ad21;
}
```

On a wide screen the box is 500px, exactly as before; on a narrow screen it simply becomes as wide as the window, and no scrollbar appears.

Common real-world versions of the same idea:

```css
/* centered page container with a maximum width */
.container {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;     /* centers it (same as margin-left/right: auto) */
  padding-inline: 1rem;    /* breathing room on small screens */
}

/* the same in one line with min(): whichever value is smaller wins */
.container {
  width: min(100% - 2rem, 1200px);
  margin-inline: auto;
}

/* images that never overflow their container */
img {
  max-width: 100%;
  height: auto;            /* keeps the aspect ratio when the width shrinks */
}
```

### `width` vs `min-width` vs `max-width`

| Property | Meaning | Default |
|---|---|---|
| `width` | The preferred width. | `auto` |
| `max-width` | The element can never be **wider** than this. | `none` |
| `min-width` | The element can never be **narrower** than this. | `auto` (effectively 0 for most elements) |

When they conflict, `min-width` wins over `max-width`, and both win over `width`:

```css
.box {
  width: 800px;
  max-width: 500px;   /* overrides width: the box is 500px */
  min-width: 600px;   /* overrides max-width: the box is 600px */
}
```

### `height` vs `min-height`

The same rules apply to `height`, `min-height` and `max-height`, and `min-height` is especially useful:

```css
.hero {
  min-height: 80vh;    /* at least 80% of the screen, but grows with content */
}
```

- `height: 80vh` is a **fixed** height: extra content overflows the box.
- `min-height: 80vh` is a **minimum**: the box grows if the content needs more space. The demo's `.container` uses `min-height` (with `height: 80vh` commented out); its comment says to add a lot more text (Emmet `lorem999`) to see the container grow.

## Sizing Functions

```css
.sidebar  { width: calc(100% - 2rem); }        /* mix units */
.card     { width: min(100%, 600px); }         /* the smaller of the two */
.panel    { width: max(50%, 300px); }          /* the larger of the two */
h1        { font-size: clamp(1.5rem, 4vw, 3rem); } /* fluid, between a min and a max */
```

> **Note:** In `calc()`, the `+` and `-` operators need spaces around them: `calc(100% - 2rem)` works, `calc(100%-2rem)` is invalid.

## Demo Walkthrough

| Element | Key CSS | Computed result |
|---|---|---|
| `html` | `font-size: 12px` | `1rem` = 12px |
| `.box` | `width: 80vw; height: 10vh; margin: auto` | 80% of window width, 10% of window height, centered horizontally |
| `.container` | `width: 80vw; min-height: 80vh; font-size: 18px; margin: 23px auto` | at least 80% of window height, grows with content |
| `.container > div` | `font-size: 2em; width: 50%` | font 36px (2 x 18px), half the container's width |
| `.container > div > div` | `width: 50%` | font 36px (inherited, not doubled again), a quarter of the container's width |
| `.mycont` | `width: 80vw; font-size: 22px` (`100vmin` commented out) | 80% of window width; with `100vmin` it would be as wide as the shorter window side |

`.box`, `.container` and `.mycont` use `box-sizing: border-box`, so their 2px borders fit inside the given widths. The inner divs keep the default `content-box`, so their red and blue borders are added on top of the 50% (see [The CSS box model](../04-box-model/notes.md)). Resize the browser window to watch the `vw`/`vh` boxes change.

## Responsive Design

Various ways to achieve responsive design:

1. **Setting up the viewport.** Without this tag, phones render the page at a desktop width (around 980px) and zoom out.

   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   ```

2. **Using `max-width`/`max-height`** instead of fixed sizes, so elements shrink on small screens but stop growing on large ones (see [Setting `max-width`](#setting-max-width-and-the-other-limits)).

3. **Using CSS media queries** to change styles at certain screen widths (covered in [Media and container queries](../15-media-and-container-queries/notes.md)):

   ```css
   .grid { display: block; }

   @media (min-width: 768px) {
     .grid { display: flex; }
   }
   ```

4. **Using `rem`/`%`/`vh`/`vw` units over pixels** so sizes adapt to the screen and the user's font settings.

More on `max-height`, `min-height`, `max-width` and `min-width`: https://www.freecodecamp.org/news/css-properties-examples/

## Common Mistakes

- **Forgetting the unit**: `width: 200;` is invalid (only `0` can be unitless).
- **`height: %` with an auto-height parent**: it has no effect.
- **Nesting `em` font sizes** and getting text that keeps growing (or shrinking).
- **Using a fixed `width` for main containers**, which causes horizontal scrolling on phones. Use `max-width` (plus `width: 100%` if needed).
- **`width: 100vw`** causing a horizontal scrollbar on desktops with visible scrollbars.
- **`height: 100vh` on mobile** being taller than the visible screen; use `dvh`/`svh` or `min-height`.
- **Fixed `height` on text containers**: text overflows when content or font size grows. Prefer `min-height`.
- **Thinking `initial` means "the browser's default for this element".** It is the CSS initial value (`auto` for `width`, `inline` for `display`).
- **Setting the root font size in `px`**, which ignores the user's preferred text size.
- **Missing viewport meta tag**, making the page tiny on phones.

## Key Takeaways

- `px` is fixed; `%`, `em`, `rem`, `vw`, `vh` are relative.
- `%` is relative to the containing block (width for `width`, `margin` and `padding`; height only if the parent height is definite).
- `em` is relative to the parent's font size for `font-size`, and to the element's own font size elsewhere; it compounds.
- `rem` is relative to the root font size and does not compound; use it for font sizes and spacing.
- `vw`/`vh` are 1% of the viewport; use `dvh` for mobile full-height sections.
- `width`/`height` accept `auto` (default), lengths, `%`, `initial` (= `auto`), `inherit` and the content-based keywords `min-content`, `max-content` and `fit-content`.
- Use `max-width` and `min-height` instead of fixed sizes for flexible layouts; `min-width` beats `max-width`, which beats `width`.
- `calc()`, `min()`, `max()` and `clamp()` combine units for fluid designs.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between `px`, `em` and `rem`?**
`px` is a fixed CSS pixel. `em` is relative to a font size: the parent's for `font-size`, the element's own for other properties. `rem` is always relative to the root `<html>` font size (16px by default). `rem` is the usual choice for font sizes because it scales with the user's settings and does not compound.

**Q2. What do `vw` and `vh` mean?**
`1vw` is 1% of the viewport width and `1vh` is 1% of the viewport height, where the viewport is the visible browser window area. `height: 100vh` makes an element as tall as the window. `vmin` and `vmax` use the smaller or larger of the two dimensions.

**Q3. An element has `width: 50%`. Fifty percent of what?**
Of the width of its containing block, which is normally the content box of the parent element. If the parent is 600px wide, the child is 300px wide. For `height` in percent, the parent must have an explicit height or the percentage is ignored.

**Q4. What is the difference between `height` and `min-height`?**
`height` fixes the height; if the content needs more space, it overflows the box. `min-height` sets a minimum; the box is at least that tall but grows to fit its content. For containers with text, `min-height` is usually the safer choice.

**Q5. The root font size is 16px. A parent has `font-size: 20px`. Its child has `font-size: 1.5em; padding: 1em; margin: 2rem;`. What are the computed values?**
Font size is 1.5 x 20px = 30px (relative to the parent). Padding is 1 x 30px = 30px, because `em` in other properties uses the element's own font size. Margin is 2 x 16px = 32px, because `rem` uses the root font size.

**Q6. What is the difference between `width: 500px` and `max-width: 500px`, and which would you use for a page container?**
`width: 500px` makes the element exactly 500px wide, even if the screen is narrower, which causes overflow and a horizontal scrollbar. `max-width: 500px` lets the element be as wide as the available space but never more than 500px, so on a small screen it shrinks to fit. Page containers therefore use `max-width` (usually with `width: 100%` and `margin-inline: auto`), and images use `max-width: 100%; height: auto;` to stay inside their container.

### Mid-level (2–4 years)

**Q7. Nested lists get bigger text at each level. What is happening and how do you fix it?**
A rule like `li { font-size: 1.2em; }` is relative to the parent's font size, so each nested `<li>` multiplies again (1.2, 1.44, 1.728 ...). Use `rem` for font sizes (`li { font-size: 1.2rem; }`), or set the size on the list once and use `1em`/`inherit` for nested levels.

**Q8. A full-width banner with `width: 100vw` causes a horizontal scrollbar. Why, and how do you fix it?**
On desktop browsers with classic scrollbars (common on Windows), `100vw` includes the width of the vertical scrollbar, so the element is a few pixels wider than the visible content area and the page scrolls sideways. Use `width: 100%` (of the parent) instead; for a full-bleed element inside a narrower container, use techniques such as a grid layout with full-width columns rather than `100vw`.

**Q9. A hero section uses `height: 100vh` but on phones the bottom is hidden behind the browser toolbar. How do you fix it?**
On mobile, `vh` is calculated for the largest viewport (toolbars hidden), so `100vh` is taller than the visible area while the toolbars are shown. Use the newer viewport units: `min-height: 100svh` (always fits with toolbars shown) or `100dvh` (updates as toolbars appear and disappear). Keep a `100vh` declaration before it as a fallback for old browsers.

**Q10. How does `clamp()` help with fluid typography?**
`clamp(min, preferred, max)` returns the preferred value but never less than `min` or more than `max`. For example `font-size: clamp(1.5rem, 4vw, 3rem)` grows with the window width yet stays readable on phones and does not become huge on wide screens, replacing several media queries. Including `rem` in the bounds keeps it respectful of user font settings.

**Q11. `height: 50%` on a child has no effect. Why, and what are the options?**
A percentage height needs a parent with a definite height; if the parent's height is `auto` (based on its content), the percentage computes to `auto`. Options: give the parent an explicit height (for example `height: 100vh` or a fixed value), make the parent a flex or grid container and let the child stretch or use `flex: 1`, or use `vh`/`dvh` directly on the child.

**Q12. Why should you avoid `html { font-size: 12px; }` or `16px`?**
Browsers let users set a preferred default font size, and a pixel value on the root overrides it, so every `rem` size ignores the user's choice. That is an accessibility problem for people with low vision. Leave the root at its default or use a percentage (such as `100%` or `62.5%`), which scales with the user's setting.

**Q13. What is the final width of this box?**

```css
.box { width: 800px; max-width: 500px; min-width: 600px; }
```

600px. `max-width` overrides `width` (800px is limited to 500px), but `min-width` overrides `max-width`, so the box can't be narrower than 600px. The order of priority is `min-width` > `max-width` > `width`, and the same applies to the height properties.

**Q14. A developer writes `div { display: initial; }` to "reset" a div to its default, and the div becomes inline. Why?**
`initial` sets a property to its initial value from the CSS specification, not to the browser's default style for that element. The initial value of `display` is `inline`; `<div>` is only `block` because the user-agent stylesheet says so. To roll back to the browser's default for that element, use `revert` (`display: revert`), which removes author styles and falls back to the user-agent stylesheet. For `width` and `height` the difference rarely shows, because their initial value `auto` is also the default.

### Senior (5+ years)

**Q15. You are defining unit conventions for a design system used by many teams. What do you choose, and how do you enforce it?**
Pick each unit for what it should scale with:

| What | Unit | Why |
|---|---|---|
| Font sizes | `rem` | Follows the user's default font size; no compounding |
| Spacing tokens | `rem` | Spacing keeps its proportion to text when users enlarge it |
| Component-internal sizes (button padding, icon size) | `em` | A smaller button variant only needs a smaller `font-size` |
| Borders, hairlines, shadows | `px` | Should stay crisp and thin at any text size |
| Text measure and widths | `ch`, `%`, `min()`, `max-inline-size` | Fluid, never wider than readable |
| Full-screen sections | `svh`/`dvh` | Correct on mobile browser chrome |

Never set the root font size in `px`, and test at 200% text zoom, with a larger browser default font size, and at 320 CSS pixels wide (the WCAG reflow width). Recommendation: publish the units as tokens, enforce them with Stylelint (for example `declaration-property-unit-allowed-list` so `font-size` only accepts `rem`), and include zoom and reflow checks in component acceptance criteria.

**Q16. Designers want headings that scale smoothly with the viewport. How do you build fluid type without breaking accessibility?**
`font-size: 5vw` looks fluid but fails users who zoom: browser zoom makes CSS pixels larger, so the viewport gets *narrower* in CSS pixels, and a `vw`-only size shrinks in CSS pixels by the same factor: on a desktop the text stays the same physical size however far the user zooms. It also ignores the user's default font size. That can fail WCAG 1.4.4 (Resize Text, 200%).

Mix a `rem` part into the preferred value and bound it: `font-size: clamp(1.75rem, 1.2rem + 2vw, 3rem);`. The `rem` part grows with zoom and font settings while the `vw` part adds fluidity. A commonly cited rule of thumb is to keep the maximum no more than about 2.5 times the minimum, so 200% zoom can still double the text at every width. Recommendation: generate the `clamp()` values from a type scale (tools such as Utopia do this), keep the ratio modest, and verify headings at 200% zoom at several viewport widths before signing off.

**Q17. A card component uses `vw` units for its padding and title size. It looks right full-width but broken in a sidebar. What is wrong, and what should it use?**
`vw` is relative to the browser window, not to the space the component actually gets. A reusable card can sit in a 300px sidebar on a 1440px screen, where `4vw` padding is about 58px. Components should size from their container or their content:

```css
.card-list { container-type: inline-size; }

.card__title {
  font-size: clamp(1rem, 0.8rem + 3cqi, 1.75rem);  /* cqi: 1% of the container's inline size */
}
```

Container query units (`cqi`, `cqw`, `cqh`, `cqmin`, `cqmax`) are supported in all major browsers since 2023; with no query container ancestor they fall back to the small viewport units. Intrinsic sizing (`%`, `em`, `min()`, `fit-content`) often works without any container. Recommendation: reserve viewport units for page-level layout (hero sections, full-screen panels) and use container units or intrinsic sizing inside components. See [Media and container queries](../15-media-and-container-queries/notes.md).

> **Note:** Related questions answered elsewhere: [HTML Document Basics](../../01-html/01-document-and-boilerplate/notes.md#interview-questions) (the viewport meta tag).

## References

- [CodeWithHarry: Sizing in CSS](https://www.codewithharry.com/tutorial/css-size/)
- [freeCodeCamp: CSS properties examples](https://www.freecodecamp.org/news/css-properties-examples/)
- [MDN: CSS values and units (linked in the demo)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Values_and_Units)
- [YouTube video on em and rem (linked in the demo)](https://youtu.be/DVjrb52C5Gs)
- [MDN: width](https://developer.mozilla.org/en-US/docs/Web/CSS/width)
- [MDN: max-width](https://developer.mozilla.org/en-US/docs/Web/CSS/max-width)
- [MDN: clamp()](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp)
- [MDN: initial](https://developer.mozilla.org/en-US/docs/Web/CSS/initial)
- [web.dev: Learn CSS - Sizing units](https://web.dev/learn/css/sizing)
- [W3C: Understanding WCAG 2.2 Success Criterion 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
