# Backgrounds, Gradients, Shadows and Outline

> CSS · Topic 8 · Demo: [index.html](index.html)

This note covers the properties that paint an element without changing its layout: layered backgrounds, gradients, box and text shadows, and outlines. Multiple backgrounds and gradients let one element carry a photo, an overlay and a pattern with no extra markup. Shadows add depth (cards that "lift" off the page, glowing text), and outlines draw a line around an element without changing its size. None of them take up space in the layout, which makes them different from borders and very useful for hover and focus effects. The demo (`index.html`) shows `box-shadow` and `text-shadow`; the background and gradient examples below are self-contained. The basic background properties (`background-size`, `background-repeat`, `background-position`) are covered in [Object-fit and filters](../20-object-fit-and-filters/notes.md).

Link: https://www.codewithharry.com/tutorial/css-shadows/

## CSS Multiple Backgrounds

CSS allows you to add multiple background images to an element through the `background-image` property. The different background images are separated by commas, and the images are stacked on top of each other, where **the first image is closest to the viewer**.

The following example has two background images: the first image is a flower (aligned to the bottom and right) and the second image is a paper background (aligned to the top-left corner):

```css
#example1 {
  background-image: url(img_flwr.gif), url(paper.gif);
  background-position: right bottom, left top;
  background-repeat: no-repeat, repeat;
}
```

How the comma-separated lists match up:

| Layer | `background-image` | `background-position` | `background-repeat` |
|---|---|---|---|
| 1 (top) | `img_flwr.gif` | `right bottom` | `no-repeat` |
| 2 (bottom) | `paper.gif` | `left top` | `repeat` (tiled to fill the box) |

- Each `background-*` property takes a list in the same order as the images. If a list is shorter, it is repeated to match.
- `background-color` is single-valued and is always painted **under** all the images.
- `background-position` accepts keywords (`left`, `center`, `right`, `top`, `bottom`), percentages (`50% 50%`) or lengths (`20px 10px`).

The `background` shorthand can describe each layer too; only the **last** layer may include a color:

```css
#example1 {
  background:
    url(img_flwr.gif) right bottom no-repeat,
    url(paper.gif) left top repeat;
}
```

Gradients count as images, which makes overlays easy. A dark overlay over a photo keeps white text readable:

```css
.hero {
  color: white;
  background:
    linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
    url("hero.jpg") center / cover no-repeat;
}
```

A variation is a **scrim**: a gradient that darkens only the part under the text, such as `linear-gradient(to top, rgb(0 0 0 / 0.7), transparent 50%)` for a caption at the bottom of a card. The [Netflix clone](../../05-projects/01-netflix-clone/notes.md) builds the same overlay with an extra `div` instead, which needs `z-index` on the content.

## Gradients

A gradient is an **image** that the browser generates, not a color. That is why it goes in `background-image` (or the `background` shorthand) and not in `background-color`, and why it also works anywhere an image is accepted: `border-image`, `mask-image`, `list-style-image`. Gradients need no HTTP request and scale to any size without blurring.

| Function | Colors change... | Typical use |
|---|---|---|
| `linear-gradient()` | along a straight line | banners, buttons, overlays, stripes |
| `radial-gradient()` | outward from a centre point, in circles or ellipses | spotlights, glows, vignettes |
| `conic-gradient()` | around a centre point, by angle | pie charts, color wheels, checkerboards |
| `repeating-*` versions | as above, repeating the stop pattern | stripes, rings |

### `linear-gradient()`

```css
.banner {
  background-image: linear-gradient(to right, #4f46e5, #06b6d4);
}
```

- The default direction is `to bottom`. Use a keyword (`to right`, `to top left`) or an angle.
- Angles start at the top and go clockwise: `0deg` = to top, `90deg` = to right, `180deg` = to bottom.
- `to top right` is **not** always `45deg`: with a corner keyword the angle adapts to the box's aspect ratio so the colors meet at the corners.

### Color stops, hard stops and hints

```css
linear-gradient(#4f46e5, #06b6d4)               /* stops at 0% and 100% */
linear-gradient(#4f46e5 20%, #06b6d4 80%)       /* solid to 20%, blend from 20% to 80%, solid after */
linear-gradient(#4f46e5, 30%, #06b6d4)          /* color hint: the halfway color sits at 30% */
linear-gradient(#4f46e5 50%, #06b6d4 50%)       /* hard stop: a sharp line, no blend */
linear-gradient(#4f46e5 0 50%, #06b6d4 0)       /* the same hard stop, shorter */
```

Two stops at the same position produce a **hard stop**. In the last line, `#4f46e5 0 50%` is a two-position stop (solid from 0 to 50%), and a stop position smaller than the previous one is treated as equal to it, so `#06b6d4 0` starts exactly at 50%. Hard stops are the basis of every CSS stripe, pie and pattern.

### `radial-gradient()`

```css
.spotlight {
  background: radial-gradient(circle at 30% 40%, #fff 0, #ffd166 20%, transparent 60%);
}
```

The parameters are shape (`ellipse` by default, or `circle`), size (`farthest-corner` by default, or `closest-side`, `closest-corner`, `farthest-side`, or a length) and position (`at center` by default).

### `conic-gradient()`

```css
.pie {
  width: 120px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: conic-gradient(#22c55e 0 65%, #e5e7eb 0);   /* a 65% pie or progress ring */
}
```

Colors sweep around the centre, starting at the top (change it with `from 90deg`, move the centre with `at 30% 50%`). With hard stops each color becomes a slice.

### Repeating gradients and layered patterns

```css
.stripes {
  background: repeating-linear-gradient(45deg, #f3f4f6 0 10px, #e5e7eb 10px 20px);
}

.checkerboard {
  background: repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 20px 20px;
}
```

Layering gradients with different `background-clip` boxes gives effects that are otherwise awkward, such as a gradient border that follows `border-radius` (`border-image` ignores the radius):

```css
.gradient-border {
  border: 4px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(white, white) padding-box,              /* covers the inside */
    linear-gradient(45deg, #4f46e5, #ec4899) border-box;    /* shows through the transparent border */
}
```

A single box keyword in the shorthand sets both `background-origin` and `background-clip` for that layer.

### Gradient text

```css
.gradient-text {
  background: linear-gradient(90deg, #4f46e5, #ec4899);
  -webkit-background-clip: text;   /* still needed for some browsers */
  background-clip: text;
  color: transparent;
}
```

The background is clipped to the shape of the glyphs and the transparent text lets it show through. Wrap it in `@supports` with a solid-color fallback, because unsupported `background-clip: text` plus `color: transparent` means invisible text. Contrast checkers cannot measure it, so check both ends of the gradient by hand.

### Interpolation color space

```css
.sunset {
  background: linear-gradient(in oklch, #2563eb, #f59e0b);
}
```

By default gradients blend in sRGB, which can pass through a muddy gray between two vivid colors (blue to amber, for example). `in oklch` or `in oklab` keeps the middle bright and even; see [Typography and Color](../07-typography-and-color/notes.md) for these color spaces. All major browsers support it since 2024 (Firefox was last); older browsers ignore the whole declaration, so put a plain gradient before it as a fallback.

### Animating gradients

`background-image` cannot be interpolated, so a hover that switches one gradient for another jumps instantly even with a `transition`. Options:

- Make the gradient larger than the box (`background-size: 200% 100%`) and transition `background-position`.
- Put the second gradient on a `::before` pseudo-element and transition its `opacity`.
- Register the changing value (a color or angle) with `@property` and animate that; see [Custom properties](../16-custom-properties/notes.md).

> **Note:** In Windows forced-colors (high contrast) mode, browsers remove `box-shadow`, `text-shadow` and gradient backgrounds (`url()` images stay). Never convey information only with a gradient or a shadow.

## `box-shadow`

```css
box-shadow: h-offset v-offset blur spread color inset;
```

| Part | Required? | Meaning |
|---|---|---|
| `h-offset` | yes | Horizontal position of the shadow. Positive moves it right, negative moves it left. |
| `v-offset` | yes | Vertical position of the shadow. Positive moves it down, negative moves it up. |
| `blur` | no (default `0`) | The larger the value, the blurrier (softer) the shadow. Cannot be negative. |
| `spread` | no (default `0`) | Expands (positive) or shrinks (negative) the shadow size. |
| `color` | no (default: the text color, `currentColor`) | Defines the shadow color. Semi-transparent colors look most natural. |
| `inset` | no | Makes the shadow inner, drawn inside the border instead of outside. Can be written first or last. |

The demo:

```css
.box {
  border: 2px solid black;
  padding: 34px;
  box-shadow: 5px 15px 5px #70a711;
}
```

This draws a green shadow shifted **5px right** and **15px down**, with a **5px blur** and no spread.

> **Note:** If you give only two lengths they are the offsets; the third is always blur and the fourth is always spread. So `box-shadow: 0 0 10px red` is a blurred glow, while `box-shadow: 0 0 0 10px red` is a solid 10px ring (spread only).

### Common box-shadow patterns

```css
/* Soft card shadow */
.card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Inner shadow, e.g. a pressed input */
.input {
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* Several shadows, comma-separated: the first one is drawn on top */
.raised {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.1),
    0 8px 16px rgba(0, 0, 0, 0.1);
}

/* A "border" that takes no space: spread only */
.selected {
  box-shadow: 0 0 0 3px #4f46e5;
}

/* Shadow only at the bottom: negative spread hides the sides */
.header {
  box-shadow: 0 8px 6px -6px rgba(0, 0, 0, 0.4);
}

/* Remove a shadow */
.flat {
  box-shadow: none;
}
```

Facts worth knowing:

- The shadow follows `border-radius`, so rounded boxes get rounded shadows.
- A shadow does **not** take up space and does not change the element's size or the layout. It can be cut off by a parent with `overflow: hidden`.
- An outer shadow is only painted outside the border box, so it does not show through a semi-transparent background.

## `text-shadow`

`text-shadow` adds a shadow to the **text** (the glyphs), not the box.

```css
text-shadow: h-offset v-offset blur color;
```

The demo:

```css
.text-element {
  text-shadow: 10px 5px 3px #e695f7;
}
```

Each letter gets a pink shadow 10px to the right and 5px down, blurred by 3px.

| | `box-shadow` | `text-shadow` |
|---|---|---|
| Applies to | the element's box | the text glyphs |
| Values | offset-x, offset-y, blur, **spread**, color, **inset** | offset-x, offset-y, blur, color |
| `spread` | yes | no |
| `inset` | yes | no |
| Multiple shadows | yes, comma-separated | yes, comma-separated |

```css
/* Subtle shadow to keep white text readable on a photo */
.hero-title {
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

/* Neon glow with two shadows */
.neon {
  color: #fff;
  text-shadow: 0 0 4px #0ff, 0 0 12px #0ff;
}
```

> **Note:** Heavy text shadows reduce readability. Use them sparingly and keep enough contrast between the text and its background.

## `outline`

```css
outline: width style color;
```

```css
.box {
  outline: 3px dashed crimson;
  outline-offset: 4px;   /* gap between the border edge and the outline */
}
```

| Longhand | Values |
|---|---|
| `outline-width` | `thin`, `medium`, `thick`, or a length like `3px` |
| `outline-style` | `solid`, `dashed`, `dotted`, `double`, `groove`, `ridge`, `inset`, `outset`, `none`, `auto` |
| `outline-color` | any color |
| `outline-offset` | a length; can be negative to draw the outline inside the box |

Like `border-style`, `outline-style` defaults to `none`, so the style is required for the outline to appear.

### Outline vs border

| | `border` | `outline` |
|---|---|---|
| Part of the box model | yes | no |
| Takes up space / changes size | yes (unless `box-sizing: border-box` absorbs it) | **no** |
| Can differ per side | yes (`border-top`, `border-left`, ...) | no, always all four sides |
| Can be moved away from the box | no | yes, with `outline-offset` |
| Follows `border-radius` | yes | yes in current browsers (older ones drew a square outline) |
| Typical use | permanent visual edge | focus indicators, debugging |

Because outlines do not take space, adding one on hover or focus does not make the page jump. Adding a border would (unless a transparent border of the same width was there already).

A handy debugging trick: `* { outline: 1px solid red; }` shows every box on the page without changing the layout.

### Outlines and keyboard focus

Browsers show an outline (the focus ring) around the focused link, button or input. Keyboard users rely on it to know where they are on the page.

```css
/* Bad: removes the only focus indicator */
button:focus {
  outline: none;
}

/* Good: a clear custom focus style for keyboard users */
button:focus-visible {
  outline: 3px solid #1a73e8;
  outline-offset: 2px;
}
```

`:focus-visible` matches when the browser decides a focus indicator is useful (usually keyboard navigation), so mouse clicks on buttons do not show a ring while Tab navigation still does.

## Shadows and Performance

Large, blurred shadows are relatively expensive to paint. Animating `box-shadow` directly makes the browser repaint it on every frame. A cheaper pattern is to put the hover shadow on a pseudo-element and animate only its `opacity`:

```css
.card {
  position: relative;
  border-radius: 8px;
}

.card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.card:hover::after {
  opacity: 1;
}
```

## `box-shadow` vs `filter: drop-shadow()`

`box-shadow` always follows the rectangular (or rounded) box. `filter: drop-shadow(offset-x offset-y blur color)` follows the actual visible shape, such as a transparent PNG icon or an SVG, but has no `spread` and no `inset`. Filters are covered in [Object-fit and filters](../20-object-fit-and-filters/notes.md).

## Common Mistakes

- **Forgetting that the first background image is on top.** Put overlays first, the photo last.
- **Adding a color to a non-last layer in the `background` shorthand**, which makes the whole declaration invalid.
- **Putting a gradient in `background-color`.** Gradients are images; use `background-image` or `background`.
- **Expecting a `transition` between two gradients to animate.** `background-image` switches instantly; animate position, opacity or registered custom properties instead.
- **Using `color: transparent` gradient text without a fallback**, so the text disappears where `background-clip: text` is not supported.
- **Mixing up blur and spread.** The third length is blur, the fourth is spread.
- **Using a solid, dark shadow color.** Real shadows are soft; use a low alpha (around 0.1 to 0.3, e.g. `rgba(0, 0, 0, 0.2)`) with some blur.
- **Writing `outline: 2px red;`** with no style, so nothing is drawn.
- **Removing focus outlines** (`outline: none`) without providing another visible focus style.
- **Shadows cut off** by a parent with `overflow: hidden`; add padding to the parent or move the shadow.

## Key Takeaways

- Multiple backgrounds are comma-separated layers; the first is on top, and `background-color` is painted below all of them.
- Gradients are generated images: `linear-`, `radial-` and `conic-gradient()`, plus `repeating-*` versions. Two stops at the same position make a hard stop, the basis of stripes, pies and patterns.
- A gradient layer over a photo is the simplest overlay: one element, no extra markup, no `z-index`.
- `box-shadow: h-offset v-offset blur spread color inset;` only the two offsets are required; multiple shadows are comma-separated, with the first drawn on top.
- `text-shadow` shadows the text and has no spread or inset.
- `outline: width style color;` draws outside the border, takes no space and cannot be set per side; `outline-offset` moves it. Never remove focus outlines without a replacement; style `:focus-visible`.
- Backgrounds, shadows and outlines do not affect layout, but shadows can be clipped by `overflow: hidden`, and gradients and shadows disappear in forced-colors mode.

## Interview Questions

### Junior (0–1 year)

**Q1. Explain each value in `box-shadow: 5px 15px 5px 0 #70a711;`.**
`5px` is the horizontal offset (5px to the right), `15px` is the vertical offset (15px down), the next `5px` is the blur radius, `0` is the spread, and `#70a711` is the shadow color. Only the two offsets are required; blur and spread default to 0 and the color defaults to the text color.

**Q2. What does the `inset` keyword do?**
It draws the shadow inside the element's border instead of outside, which makes the element look pressed in or recessed. It is common for input fields and pressed buttons, for example `box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);`.

**Q3. What is the difference between `box-shadow` and `text-shadow`?**
`box-shadow` adds a shadow around the element's box and supports spread and `inset`. `text-shadow` adds a shadow behind each letter of the text and accepts only offsets, blur and color. Both accept multiple comma-separated shadows.

**Q4. What is the difference between `border` and `outline`?**
A border is part of the box model: it takes up space, can be styled per side and affects the element's size. An outline is drawn outside the border, takes no space, is always on all four sides, and can be pushed away with `outline-offset`. Outlines are mainly used for focus indicators.

**Q5. How do you apply more than one shadow to the same element?**
Separate the shadows with commas: `box-shadow: 0 1px 2px rgba(0,0,0,.1), 0 8px 16px rgba(0,0,0,.1);`. The first shadow in the list is drawn on top. Layering a small sharp shadow with a large soft one gives a realistic depth effect.

**Q6. Does adding a `box-shadow` change the size of an element or move other elements?**
No. Shadows are purely visual: they do not change the element's width or height or affect layout, and they can overlap neighbouring elements. They can, however, be clipped if a parent has `overflow: hidden`.

**Q7. With multiple background images, which one appears on top?**
The first image in the comma-separated list is closest to the viewer (on top), and each next one is drawn underneath. `background-color`, if set, is painted below all images.

**Q8. What is the difference between `linear-gradient()`, `radial-gradient()` and `conic-gradient()`?**
All three generate an image from color stops. In a linear gradient the colors change along a straight line in a given direction or angle; in a radial gradient they spread outward from a centre point in circles or ellipses; in a conic gradient they sweep around a centre point by angle, like the hands of a clock, which suits pie charts and color wheels.

### Mid-level (2–4 years)

**Q9. A designer says the focus ring looks ugly and asks you to remove it with `outline: none`. What do you do?**
Explain that keyboard and switch users need a visible focus indicator (it is a WCAG requirement), so it cannot just be removed. Offer a custom style that fits the design instead, applied with `:focus-visible` so it appears for keyboard navigation but not on mouse clicks: `button:focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }`.

**Q10. When would you use `filter: drop-shadow()` instead of `box-shadow`?**
When the visible shape is not a rectangle, such as a transparent PNG, an SVG icon or a clipped element. `box-shadow` always follows the element's box (including `border-radius`), while `drop-shadow()` follows the alpha channel, so the shadow matches the actual shape. `drop-shadow()` has no spread or inset, and filters can be more expensive to render.

**Q11. Hovering a card should make its shadow grow, but the animation stutters. How can you make it smoother?**
Animating `box-shadow` forces a repaint of the blurred shadow on every frame. Instead, place the larger shadow on a `::after` pseudo-element covering the card and transition only its `opacity` (and perhaps the card's `transform`), which browsers can composite cheaply. Keeping blur radii moderate also reduces paint cost.

**Q12. You want to highlight a selected item with a 2px ring without the layout jumping. How?**
Adding a border would increase the element's size and shift its neighbours. Use either `outline: 2px solid color` (with `outline-offset` if needed) or a spread-only box shadow, `box-shadow: 0 0 0 2px color`, which follows `border-radius` and takes no space. Another option is to always have a transparent 2px border and only change its color.

**Q13. A card's shadow is cut off on one side inside a carousel. What is the likely cause and fix?**
The carousel container probably has `overflow: hidden` (or `overflow: auto`), which clips anything painted outside its box, including shadows. Add padding to the scrolling container so the shadows fit inside it, use a negative margin with matching padding to keep alignment, or reduce the shadow's offset and blur.

**Q14. How would you put a semi-transparent dark overlay on a background photo using only CSS on one element?**
Use two background layers, with a gradient of a single color as the top layer: `background: linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url(photo.jpg) center / cover no-repeat;`. The gradient is listed first, so it is drawn on top of the photo. No extra HTML element or pseudo-element is needed, and the text inside needs no `z-index`. A gradient that fades to `transparent` darkens only the part behind the text.

**Q15. How do you draw sharp stripes or a pie chart with only CSS gradients?**
Use hard stops: two color stops at the same position switch colors with no blend. Stripes: `repeating-linear-gradient(45deg, #eee 0 10px, #ddd 10px 20px)`. A pie or progress ring: `conic-gradient(#22c55e 0 65%, #e5e7eb 0)` on a square element with `border-radius: 50%`; driving the percentage from a custom property makes it data-driven. For anything users must read, also expose the value as text, because gradients are invisible to screen readers and disappear in forced-colors mode.

### Senior (5+ years)

**Q16. You are defining the focus indicator for a design system used by many teams. What does it look like, and how do you test it?**
Use `outline` on `:focus-visible` as the base, not `box-shadow` alone: in Windows forced-colors mode the browser removes all box shadows, so a shadow-only ring disappears for exactly the users who need it most, while outlines are kept and recolored. If the design wants a shadow-based ring, add `outline: 2px solid transparent` next to it; the transparent outline becomes visible in forced-colors mode. The ring must reach 3:1 contrast against everything around it, so on mixed backgrounds use a two-tone ring (a dark outline plus a light halo from `outline-offset` or an inner shadow). WCAG 2.2 also requires that the focused element is not entirely hidden behind sticky headers or banners.

Ship it as tokens (`--focus-ring-color`, `--focus-ring-width`, `--focus-ring-offset`) applied globally in the base layer, with a documented inset variant (negative `outline-offset`) for components inside `overflow: hidden` containers, so no team reinvents it. Test with a keyboard walkthrough of every component, DevTools forced-colors emulation, light and dark themes and 200% zoom. Recommendation: a global `:focus-visible` outline from tokens, a transparent-outline fallback for any shadow ring, and focus checks in the component review checklist.

**Q17. Every team writes its own `box-shadow` values and the product looks inconsistent, especially in dark mode. How would you fix this at the system level?**
Define a small elevation scale, for example four or five tokens (`--shadow-1` for resting cards up to `--shadow-4` for modals), each a layered shadow: a tight, darker contact shadow plus a large, soft ambient one, with the shadow color taken from a token so it can be tinted to the surface. Tie each level to meaning (resting, hovered, dropdown, dialog) and to the z-index scale, so things that look higher are also on top.

Dark mode needs its own values: shadows barely show on dark surfaces, so higher elevation is usually shown with a slightly lighter surface color plus a stronger shadow; resolve the tokens per theme (with `light-dark()` or a theme class). Add `@media (forced-colors: active)` borders where elevation is the only separation, and use the pseudo-element `opacity` technique for hover changes instead of animating `box-shadow`. Then enforce it: a lint rule that only allows `var(--shadow-*)` in `box-shadow`. Recommendation: a semantic, theme-aware elevation scale and a lint rule, instead of reviewing raw shadow values by eye.

**Q18. Field data shows a poor LCP on the home page. The LCP element is a hero section with `background: linear-gradient(...), url(hero.jpg) center / cover`. What is going on, and how do you fix it?**
CSS background images are discovered late. The browser's preload scanner only reads HTML, so the image URL is found only after the stylesheet has downloaded and parsed and the element has been styled. The LCP breakdown in DevTools shows this as a large "resource load delay". Background images also miss the `<img>` features that help LCP: `srcset`/`sizes`, `fetchpriority` and intrinsic `width`/`height`.

The fix is to make the hero image a real `<img>` in the HTML, with `fetchpriority="high"`, `srcset`/`sizes`, explicit `width`/`height`, `object-fit: cover`, and never `loading="lazy"`; keep the gradient overlay as a pseudo-element or a background on a wrapper (see [Object-fit and filters](../20-object-fit-and-filters/notes.md)). If a CMS forces a background image, add `<link rel="preload" as="image" fetchpriority="high">` (with `imagesrcset` for responsive images) in the `<head>`. Recommendation: an `<img>` with high fetch priority for any above-the-fold hero, a modern format (AVIF/WebP) at the right size, and confirm the improvement in field LCP, not just in a lab run.

## References

- [CodeWithHarry: CSS Shadows](https://www.codewithharry.com/tutorial/css-shadows/)
- [MDN: Using multiple backgrounds](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_backgrounds_and_borders/Using_multiple_backgrounds)
- [MDN: background-image](https://developer.mozilla.org/en-US/docs/Web/CSS/background-image)
- [MDN: Using CSS gradients](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_images/Using_CSS_gradients)
- [MDN: linear-gradient()](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient)
- [MDN: conic-gradient()](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient)
- [MDN: background-clip](https://developer.mozilla.org/en-US/docs/Web/CSS/background-clip)
- [MDN: box-shadow](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow)
- [MDN: text-shadow](https://developer.mozilla.org/en-US/docs/Web/CSS/text-shadow)
- [MDN: outline](https://developer.mozilla.org/en-US/docs/Web/CSS/outline)
- [MDN: :focus-visible](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible)
- [MDN: forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)
- [web.dev: Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp)
