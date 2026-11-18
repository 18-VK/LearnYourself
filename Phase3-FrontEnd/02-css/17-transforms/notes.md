# CSS Transforms

> CSS · Topic 17 · Demo: [index.html](index.html) · [demo.html](demo.html) · [style.css](style.css)

The `transform` property moves, rotates, scales and skews an element visually without changing the page layout around it. Transforms are the backbone of hover effects, transitions and animations, because browsers can animate them smoothly and cheaply.

> **Note:** The lecture covers **2D transforms only** (original note: "2D tranforms only - https://www.codewithharry.com/tutorial/css-2d-transform/"). `index.html` is the hands-on demo. `demo.html` + `style.css` is a showcase of every transform function, including 3D ones: hover over each grey tile to see its effect. The 3D functions are summarised briefly at the end.

## What `transform` Does

```css
selector {
  transform: none;                       /* default */
  transform: rotate(45deg);              /* one function */
  transform: translateX(20px) scale(1.2);  /* several functions, separated by spaces */
}
```

Key behaviour:

- **The layout does not change.** The element keeps its original space in the flow, and neighbouring elements do not move. Only the drawing of the element changes. Compare this with changing `margin` or `left`, which pushes other content around.
- **The whole element is transformed**, including its border, background, text and children.
- A transformed element can stick out of its parent and may add scrollbars, because transformed boxes count towards the page's scrollable area.
- **Transforms don't apply to non-replaced inline elements** such as a plain `<span>` or `<a>`. Give them `display: inline-block` (or `block`) first.
- Any value other than `none` creates a new **stacking context** and makes the element the **containing block** for its `position: fixed` and `position: absolute` descendants (see Common Mistakes).

## 2D Transform Functions

### `translate()`: move

| Function | Effect |
|---|---|
| `translateX(x)` | Move horizontally. Positive = right. |
| `translateY(y)` | Move vertically. Positive = down. |
| `translate(x, y)` | Move on both axes. `translate(x)` alone means `y = 0`. |

```css
.box { transform: translate(20px, -10px); }  /* 20px right, 10px up */
```

Percentages are relative to the **element's own size** (its border box), not its parent. `translateX(50%)` moves the element by half of its own width. That is what makes the classic centring trick work:

```css
.parent { position: relative; }
.child {
  position: absolute;
  top: 50%;                          /* top-left corner at the parent's centre */
  left: 50%;
  transform: translate(-50%, -50%);  /* pull back by half of its own width and height */
}
```

### `rotate()`: turn

`rotate(angle)` turns the element around its `transform-origin` (the centre by default). Positive angles turn clockwise.

| Unit | Full circle | Example |
|---|---|---|
| `deg` | 360deg | `rotate(45deg)` |
| `turn` | 1turn | `rotate(0.125turn)` = 45deg (used in `index.html`) |
| `rad` | about 6.2832rad | `rotate(0.785rad)` is about 45deg |
| `grad` | 400grad | `rotate(50grad)` = 45deg |

`rotateZ(9deg)` (commented out in `index.html`) gives the same result as `rotate(9deg)`: a 2D rotation is a rotation around the Z axis, which points out of the screen towards you.

### `scale()`: resize

| Function | Effect |
|---|---|
| `scaleX(sx)` | Stretch or squash horizontally. |
| `scaleY(sy)` | Stretch or squash vertically. |
| `scale(sx, sy)` | Both axes. `scale(1.5)` with one value scales both axes equally. |

Values are plain numbers: `1` = normal size, `2` = double, `0.5` = half, `0` = invisible. Negative values flip the element: `scaleX(-1)` mirrors it horizontally.

```css
.card:hover { transform: scale(1.05); }  /* a common subtle hover zoom */
```

Scaling does not change layout, so a scaled-up element overlaps its neighbours instead of pushing them away.

### `skew()`: slant

| Function | Effect |
|---|---|
| `skewX(angle)` | Slants along the X axis: the left and right edges tilt, the top and bottom stay horizontal. |
| `skewY(angle)` | Slants along the Y axis: the top and bottom edges tilt, the left and right stay vertical. |
| `skew(ax, ay)` | Both. `skew(ax)` alone means `ay = 0`. |

`index.html` ends up applying `skewY(34deg)`: the box's top and bottom edges slope down to the right, and the text inside is slanted too. Prefer `skewX()`/`skewY()` over two-value `skew()`, which mostly exists for compatibility.

### `matrix()`: all of the above in one function

`matrix(a, b, c, d, e, f)` describes any 2D transform with six numbers. A point `(x, y)` of the element ends up at:

```text
x' = a*x + c*y + e
y' = b*x + d*y + f
```

| Value | Role when used on its own |
|---|---|
| `a` | horizontal scale |
| `b` | vertical skew (tangent of the `skewY` angle) |
| `c` | horizontal skew (tangent of the `skewX` angle) |
| `d` | vertical scale |
| `e` | horizontal translation (px) |
| `f` | vertical translation (px) |

- `matrix(1, 0, 0, 1, 0, 0)` is the identity: no change.
- The hover state in `style.css`, `matrix(1, -1, 0, 1, 0, 0)`, is the same as `skewY(-45deg)`, because tan(-45deg) = -1.
- Once rotation is involved, `a`, `b`, `c` and `d` mix scale, rotation and skew together, so you rarely write a matrix by hand.

The place you will meet `matrix()` is JavaScript: `getComputedStyle(el).transform` always returns the final combined transform as a `matrix(...)` (or `matrix3d(...)`), never as the functions you wrote.

## Combining Transforms

### Use one declaration with several functions

```css
/* WRONG: the second declaration replaces the first */
.box {
  transform: rotate(0.125turn);
  transform: skewY(34deg);       /* only this one applies */
}

/* RIGHT: list the functions in one declaration */
.box {
  transform: rotate(0.125turn) skewY(34deg);
}
```

This is exactly what happens in `index.html`: `rotate(0.125turn)` is written first, but the later `transform: skewY(34deg)` overrides it, so the box is only skewed. `transform` is a single property, and the normal cascade rule applies: the last declaration wins.

The same applies across rules. A `:hover` transform **replaces** the base transform completely:

```css
.modal {
  transform: translate(-50%, -50%);   /* used for centring */
}

/* WRONG: the centring translate is lost, so the modal jumps on hover */
.modal:hover {
  transform: scale(1.05);
}

/* RIGHT: repeat the base functions, then add the new one */
.modal:hover {
  transform: translate(-50%, -50%) scale(1.05);
}
```

### Order matters

The functions are applied one after another, and each one works in the coordinate system left behind by the previous one.

```css
.a { transform: translateX(100px) rotate(45deg); }
.b { transform: rotate(45deg) translateX(100px); }
```

- `.a` moves 100px to the right, then rotates in place. It ends up 100px to the right, tilted.
- `.b` rotates first, which also rotates its X axis by 45deg, then moves 100px along that tilted axis. It ends up about 71px right and 71px **down**, tilted.

The commented-out line in `index.html`, `translateY(100%) skewX(40deg) translateX(45%)`, is a good one to experiment with: reorder the three functions and watch the result change.

## `transform-origin`

`transform-origin` sets the fixed point that rotation, scaling and skewing happen around. The default is the centre of the element, `50% 50%`, so the `transform-origin: 50% 50%;` line in `index.html` simply restates the default.

```css
transform-origin: center;      /* default, same as 50% 50% */
transform-origin: top left;    /* keywords: top, right, bottom, left, center */
transform-origin: 0 0;         /* same as top left */
transform-origin: 100% 50%;    /* right edge, vertical middle */
transform-origin: 20px 10px;   /* lengths from the top-left corner */
transform-origin: 50% 50% 30px;  /* optional third value: Z position (3D only) */
```

Example: a box that swings from its top-left corner instead of spinning around its centre:

```css
.door {
  transform-origin: top left;
  transform: rotate(20deg);
}
```

`translate()` is not affected by `transform-origin`: moving 20px is the same from any origin.

## Individual Transform Properties (Modern CSS)

Modern browsers (all major ones since 2022) also support three separate properties: `translate`, `rotate` and `scale`. Note the syntax: no brackets, values separated by spaces.

```css
.btn {
  translate: 0 -2px;
  rotate: 5deg;
  scale: 1;
  transition: scale 0.2s ease;
}

.btn:hover {
  scale: 1.1;     /* translate and rotate are kept */
}
```

| | `transform: ...` | `translate` / `rotate` / `scale` properties |
|---|---|---|
| Order | Whatever order you write | Always translate, then rotate, then scale, then `transform` |
| Changing one part | Must repeat the whole list | Change just one property |
| Animating separately | One combined value | Each can have its own transition or animation |
| Skew / matrix | Yes | No: use `transform` |

## How `demo.html` Works

Each grey `.box` tile contains a blue child. The rule is triggered by hovering the **parent** tile:

```css
.scaleX {
  transform: scaleX(1);
  transition: transform 0.5s ease;   /* animate changes over 0.5s */
}

.box:hover .scaleX {
  transform: scaleX(2);
}
```

The `transition` line is what makes the change smooth instead of instant; see [CSS Transitions](../18-transitions/notes.md).

| Tile | Hover transform | What you see |
|---|---|---|
| scaleX / scaleY | `scaleX(2)` / `scaleY(2)` | Doubles in width / height. |
| scale | `scale(1.5, 1.5)` | Grows by 50% on both axes. |
| translateX / translateY / translate | `translateX(2em)` etc. | Slides right / down / diagonally. |
| matrix | `matrix(1, -1, 0, 1, 0, 0)` | Slanted, the same as `skewY(-45deg)`. |
| rotate | `rotate(270deg)` | Three-quarter turn clockwise. |
| skew / skewX / skewY | `skew(30deg, 20deg)` etc. | Slants on one or both axes. |
| matrix3d, translate3d, rotateX, rotateY, translateZ | 3D functions | Tilts and turns in 3D (see below). |

> **Note:** Several "resting state" values in `style.css` are invalid CSS: `translateX(1)`, `translateY(1)`, `translate(1, 1)`, `skew(1, 1)`, `skewX(1)`, `skewY(1)` (lengths and angles need units; only `0` may be written without one), `matrix(1, 1, 1, 1)` (needs exactly 6 numbers), `matrix3d(1)` (needs 16), `translate3d(1px, 1px, 1)` (the Z value needs a unit) and `perspective(1)` (needs a length). The browser throws away an invalid declaration, so those tiles really start at `transform: none`. The demo still works because a transition from `none` animates fine. In your own code, write valid values such as `translateX(0)` or leave the base transform out.

## A Taste of 3D (seen in `demo.html`)

Not part of the 2D lecture, but the showcase uses these:

| Function | Effect |
|---|---|
| `rotateX(angle)` / `rotateY(angle)` | Tilt around the horizontal / vertical axis, like a flipping card. |
| `translateZ(z)` | Move towards (+) or away from (-) the viewer. |
| `translate3d(x, y, z)` | Move on all three axes. |
| `scaleZ(sz)` | Scale along Z (only visible combined with other 3D transforms). |
| `rotate3d(x, y, z, angle)` | Rotate around any axis given as a vector. |
| `matrix3d(16 numbers)` | Any 3D transform as a 4 x 4 matrix. |
| `perspective(length)` | Gives depth to the transforms that come after it in the list. |

Without perspective, 3D rotations look flat (rotateY just looks like a horizontal squash) and moving along Z alone shows no visible change. You can add perspective either with the `perspective()` function inside the `transform` list (as `style.css` does with `perspective(500px)`) or with the `perspective` property on the **parent**, which gives all the children a shared viewpoint.

Two more properties you need for real 3D components such as a flip card:

| Property | What it does |
|---|---|
| `transform-style: preserve-3d` | On a parent: its children stay in the same 3D space instead of being flattened onto the parent's plane. |
| `backface-visibility: hidden` | Hides an element when it is turned away from the viewer, so the back of the front face doesn't show through. |

## Performance

Browsers draw a page in stages: **layout** (work out sizes and positions), **paint** (fill in pixels) and **composite** (stack the painted layers). `transform` and `opacity` can usually be handled in the composite stage alone, often on the GPU, so animating them skips layout and paint.

| To animate... | Prefer | Avoid |
|---|---|---|
| Movement | `transform: translate()` | `top`, `left`, `margin` |
| Size changes | `transform: scale()` | `width`, `height` |
| Fading | `opacity` | Fading `color` / `background-color` (repaints every frame) |

`will-change: transform` tells the browser in advance that an element will be transformed, so it can prepare a separate layer. Use it sparingly, on elements that really animate, because every extra layer costs memory.

## Accessibility

Large or fast motion (spinning, zooming, sliding) can cause dizziness and nausea for people with vestibular disorders. Respect the user's operating-system "reduce motion" setting:

```css
.card {
  transition: transform 0.3s ease;
}

.card:hover {
  transform: scale(1.05) rotate(2deg);
}

@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
  .card:hover { transform: none; }
}
```

Also:

- If a hover effect conveys something useful, also trigger it on `:focus-visible` so keyboard users get it too.
- Mirrored (`scaleX(-1)`) or heavily skewed text is hard to read. Keep transforms on text subtle.

The full reduced-motion strategy (opt-in vs opt-out, what to keep, WCAG rules) is in [CSS Animations](../19-animations/notes.md#accessibility).

## FLIP: Animating Layout Changes with Transforms

Layout changes (an item moving to another position in a list, a card expanding into a detail view) can't be animated cheaply, because `top`, `left`, `width` and `height` trigger layout on every frame. The **FLIP** technique fakes them with a transform:

1. **First**: measure the element's current box with `getBoundingClientRect()`.
2. **Last**: apply the layout change (move the node, toggle a class), then measure again.
3. **Invert**: apply a transform that puts the element back where it was (`translate(first - last)`, plus `scale()` if the size changed).
4. **Play**: animate that transform back to `none`.

```js
const first = card.getBoundingClientRect();
list.prepend(card);                                  // the real layout change
const last = card.getBoundingClientRect();

card.animate(
  [
    { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px)` },
    { transform: 'none' },
  ],
  { duration: 300, easing: 'ease-out' }
);
```

Layout runs once (at step 2), and the motion itself is a compositor-friendly transform. `getBoundingClientRect()` includes transforms, while `offsetLeft`/`offsetWidth` ignore them, which is why FLIP measures with the former. The [View Transitions API](../19-animations/notes.md#view-transitions) now does the same job for whole-page or whole-component state changes without hand-written measuring.

## Common Mistakes

- Writing `transform` twice and expecting both to apply. The last declaration wins; put all functions in one list.
- A `:hover` transform that wipes out a base transform (for example the `translate(-50%, -50%)` used for centring).
- Forgetting units: `translateX(10)`, `rotate(45)` and `skewX(1)` are invalid and silently ignored.
- Transforming a plain inline element like `<span>`: nothing happens until it is `inline-block` or `block`.
- Expecting surrounding elements to move out of the way. Transforms don't affect layout.
- A `position: fixed` element (a modal, toast or dropdown) inside a transformed ancestor. The transformed ancestor becomes its containing block, so it is positioned relative to that ancestor instead of the viewport. Move the fixed element outside the transformed one (details in [CSS Positioning](../11-position-and-z-index/notes.md)).
- Putting `will-change: transform` on every card "for performance". Each one becomes its own layer, which costs GPU memory and can make low-end phones slower, not faster.
- Assuming the order of functions doesn't matter. `rotate() translate()` and `translate() rotate()` give different results.

## Key Takeaways

- `transform` changes how an element is drawn (move, rotate, scale, skew) without affecting layout.
- 2D functions: `translate()`, `rotate()`, `scale()`, `skew()` (each with X/Y versions) and `matrix()`.
- Percentages in `translate()` are relative to the element's own size, which enables `translate(-50%, -50%)` centring.
- Put several functions in **one** `transform` declaration; their order changes the result.
- `transform-origin` (default `50% 50%`) is the pivot for rotate, scale and skew.
- The separate `translate`, `rotate` and `scale` properties let you change one part without repeating the rest.
- Animate `transform` and `opacity` for smooth, cheap motion, and respect `prefers-reduced-motion`.
- FLIP turns an expensive layout change into a cheap transform animation: measure, change, invert, play.

## Interview Questions

### Junior (0–1 year)

**Q1. What does the CSS `transform` property do, and does it affect layout?**
It visually moves, rotates, scales or skews an element (and everything inside it). It does not affect layout: the element keeps its original space in the document flow, and neighbouring elements don't move. That is why transforms are the preferred way to animate movement.

**Q2. Name the 2D transform functions.**
`translate()`, `translateX()`, `translateY()` to move; `rotate()` to turn; `scale()`, `scaleX()`, `scaleY()` to resize; `skew()`, `skewX()`, `skewY()` to slant; and `matrix()`, which combines all of them in six numbers.

**Q3. What will this box look like?**

```css
.box {
  transform: rotate(45deg);
  transform: scale(2);
}
```

It is scaled to twice its size but **not** rotated. Both declarations set the same property, so the second one overrides the first. To get both, write `transform: rotate(45deg) scale(2);`.

**Q4. What is `transform-origin` and what is its default value?**
It is the point that the element rotates, scales and skews around. The default is the centre of the element, `50% 50%`. Changing it to `top left` makes a rotation swing around the top-left corner instead of spinning in place. It has no effect on `translate()`.

**Q5. In `transform: translate(-50%, -50%)`, 50% of what?**
Of the element's own width and height, not its parent's. Combined with `position: absolute; top: 50%; left: 50%;`, which puts the element's top-left corner at the parent's centre, it shifts the element back by half its own size, so it ends up exactly centred whatever its size.

### Mid-level (2–4 years)

**Q6. Why do `translateX(100px) rotate(45deg)` and `rotate(45deg) translateX(100px)` give different results?**
Transform functions are applied in sequence, and each one works in the coordinate system produced by the previous ones. In the first, the element moves 100px right and then rotates in place. In the second, rotating first also rotates the element's X axis, so the following `translateX(100px)` moves it along a 45-degree diagonal (about 71px right and 71px down). Transforms are matrix multiplications, and matrix multiplication is not commutative.

**Q7. Why is animating `transform` better than animating `top`/`left` or `width`?**
Changing `top`, `left`, `width` or `margin` forces the browser to recalculate layout and repaint on every frame, which can drop frames on slower devices. `transform` (like `opacity`) can usually be handled by the compositor, often on the GPU, without layout or paint, so the animation stays smooth. `will-change: transform` can hint at this ahead of time but should be used sparingly.

**Q8. What does `matrix(a, b, c, d, e, f)` represent, and where would you come across it?**
It is a 2D transform written as a 3 x 3 matrix: `a` and `d` handle scaling, `b` and `c` skewing (and rotation in combination), and `e` and `f` the translation in pixels. For example, `matrix(1, -1, 0, 1, 0, 0)` equals `skewY(-45deg)`. You rarely write it yourself, but `getComputedStyle(el).transform` always returns the resolved transform in this form, so you see it when reading transforms in JavaScript.

**Q9. When would you use the individual `translate`, `rotate` and `scale` properties instead of `transform`?**
When different states or animations need to change different parts of the transform. With `transform`, a hover rule must repeat every function or it loses them; with `scale: 1.1` on hover, an existing `translate` stays untouched. They can also have separate transitions or animations. They are always applied in the order translate, rotate, scale, then `transform`, and they don't cover skew or matrix.

**Q10. A card flip with `rotateY(180deg)` looks flat, and you can see the front through the back. What is missing?**
Two things. Without perspective, a 3D rotation is projected flat, so `rotateY()` looks like a horizontal squash: add `perspective: 800px` on the parent (a shared viewpoint for all children) or `perspective()` as the first function in the transform list (a separate viewpoint per element). And the back face of the front side is still drawn: set `backface-visibility: hidden` on both faces, keep the faces in 3D space with `transform-style: preserve-3d` on the rotating wrapper, and pre-rotate the back face with `rotateY(180deg)`.

### Senior (5+ years)

**Q11. Your design system's `Button` uses `transform: scale(0.97)` for its pressed state. Product teams also put `transform` on buttons for their own layouts and animations, and the two keep overwriting each other. How do you design this?**
`transform` is one property, so whoever writes it last wins, and a component that owns it internally is fragile. Options, from best to worst: use the individual properties internally (`scale` for the press effect) and document that `transform` and `translate` are free for consumers; or compose through custom properties (`transform: translate(var(--btn-x, 0), var(--btn-y, 0)) scale(var(--btn-scale, 1))`) and expose the variables as the public API; or put the internal effect on an inner element so the outer one stays untouched. The first is the simplest and needs no wrapper. Recommendation: reserve one individual transform property per component, publish which ones are "internal", and add a visual regression test for pressed and hover states.

**Q12. Explain the FLIP technique. When would you use it, and when would you reach for something else?**
FLIP (First, Last, Invert, Play) animates a layout change with a transform: measure the element, apply the real change, measure again, apply the inverse `translate()`/`scale()`, then animate that transform to `none`. Layout runs once, and the animation itself runs on the compositor, so reordering a list or expanding a card stays smooth. Pitfalls: measure with `getBoundingClientRect()` (it includes transforms), batch all reads before writes to avoid layout thrashing, and correct for `scale()` distorting children (counter-scale them or animate only position). Recommendation: use FLIP (or a small library built on it) for in-component reorders; use the View Transitions API for route or state changes that swap whole regions of the page.

**Q13. A product grid with `will-change: transform` on every card and a hover zoom stutters, and the tab crashes on low-end Android phones. How do you investigate and fix it?**
Each `will-change: transform` element is promoted to its own compositor layer, and every layer holds a GPU texture roughly the size of the element. Hundreds of cards can mean hundreds of megabytes of GPU memory, which leads to jank, blank tiles, and crashes on devices with little memory. Confirm it in DevTools: the Layers panel (layer count and memory estimate), Rendering > Layer borders, and a Performance trace on a throttled CPU. Fix: remove the blanket `will-change`, let the browser promote the card only while its transition runs (it does this automatically for running transform animations), or add `will-change` from JavaScript just before a known animation and remove it afterwards. Recommendation: treat `will-change` as a targeted fix for a measured problem, never as a default, and test motion on a real low-end device.

**Q14. After centring a modal with `translate(-50%, -50%)`, its text looks slightly blurry. Why, and what do you do?**
If the modal's width or height is an odd number of pixels, `-50%` lands on a half pixel. When the element is on its own compositor layer, the texture is drawn at a fractional offset and the text loses its crisp edges. A similar blur appears when an element is scaled up as a bitmap during an animation (browsers re-rasterise only when the animation ends). Fix the cause rather than nudging pixels: centre with layout instead of a transform (`display: grid; place-items: center` on an overlay, or `position: fixed; inset: 0; margin: auto` with a known size), or use `<dialog>`, which is centred by default. For zoom effects, animate from a smaller scale up to `1`, so the resting state is the native size. Recommendation: use transforms for motion, not for static positioning.

> **Note:** Related questions answered elsewhere: [CSS Positioning](../11-position-and-z-index/notes.md#interview-questions) (`position: fixed` broken by a transformed ancestor) · [CSS Animations](../19-animations/notes.md#interview-questions) (reduced motion).

## References

- [CodeWithHarry: CSS 2D Transform](https://www.codewithharry.com/tutorial/css-2d-transform/)
- [MDN: transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)
- [MDN: transform functions](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function)
- [MDN: transform-origin](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin)
- [MDN: Using CSS transforms](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transforms/Using_CSS_transforms)
- [MDN: translate property](https://developer.mozilla.org/en-US/docs/Web/CSS/translate)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [MDN: will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)
- [MDN: backface-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/backface-visibility)
- [Paul Lewis: FLIP Your Animations](https://aerotwist.com/blog/flip-your-animations/)
