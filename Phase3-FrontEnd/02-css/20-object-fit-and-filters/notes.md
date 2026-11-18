# Object-fit, Object-position and Filters

> CSS · Topic 20 · Demo: [index.html](index.html) · [filter.html](filter.html)

Images and videos have their own shape (aspect ratio). When you force an `<img>` into a box of a different shape, the browser stretches it by default. `object-fit` decides how the picture fits inside its box (keep the whole picture, fill and crop, or stretch), and `object-position` decides which part of it stays visible. They do for `<img>` and `<video>` what `background-size` and `background-position` do for background images, which `index.html` also uses. The second half of the note covers `filter`, which changes how an element is drawn (blur, brightness, grayscale, drop shadows) without editing the image file, plus `backdrop-filter` for frosted-glass effects; `filter.html` is its demo. Both topics are about presenting images well, and both have performance and accessibility costs worth knowing.

## The Problem: Squashed Images

```css
img {
  width: 300px;
  height: 300px;   /* a 1600 x 900 photo is squeezed into a square: it looks distorted */
}
```

By default an image is stretched to exactly the width and height you give it, ignoring its natural aspect ratio. If you only set one of them (`width: 300px; height: auto;`), the ratio is kept, but then you don't control the height. `object-fit` lets you set both and still avoid distortion.

## `object-fit`

`object-fit` works on **replaced elements**: elements whose content comes from outside the CSS, mainly `<img>` and `<video>`. It has no effect on a `<div>`.

| Value | Keeps aspect ratio? | Fills the whole box? | Crops? | Result |
|---|---|---|---|---|
| `fill` (default) | No | Yes | No | Stretched or squashed to fit exactly. |
| `contain` | Yes | Not always | No | The whole image is visible; empty bands appear on two sides (letterboxing). |
| `cover` | Yes | Yes | Yes | The box is completely filled; whatever doesn't fit is cut off. |
| `none` | Yes | Not always | Yes, if bigger than the box | Shown at its natural size, not resized at all. |
| `scale-down` | Yes | Not always | No | Whichever of `none` or `contain` gives the **smaller** image: it shrinks big images but never enlarges small ones. |

```css
.thumbnail {
  width: 200px;
  height: 200px;
  object-fit: cover;     /* square thumbnail, no distortion, edges cropped */
}

.logo {
  width: 200px;
  height: 80px;
  object-fit: contain;   /* the whole logo stays visible */
}
```

`cover` vs `contain` is the pair people mix up:

| | `cover` | `contain` |
|---|---|---|
| Goal | Cover the whole box | Contain the whole image |
| Empty space in the box | Never | Possible (top/bottom or left/right) |
| Part of the image cut off | Possible | Never |
| Typical use | Hero images, cards, avatars, thumbnails | Logos, product photos, diagrams where every part matters |

## `object-position`

When `object-fit` leaves empty space (`contain`) or crops (`cover`, `none`), `object-position` says where the image sits inside the box. It works like `background-position`.

```css
img {
  object-fit: cover;
  object-position: 50% 50%;     /* default: centred, so cropping happens equally on both sides */
  object-position: top left;    /* keep the top-left corner, crop from the right and bottom */
  object-position: center top;  /* keep the top: good for portraits so heads aren't cut off */
  object-position: 50% 20%;     /* percentages: the 50%/20% point of the image lines up with the 50%/20% point of the box */
  object-position: 10px 20px;   /* lengths: offset from the top-left corner */
}
```

> **Note:** With `object-fit: fill` (the default), the image always fills the box exactly, so `object-position` has no visible effect.

## The `index.html` Demo, Part 1: `object-fit` on an `<img>` (commented out)

```html
<div class="container">
  <img src="..." alt="">
</div>
```

```css
.container {
  width: 60vw;
  height: 60vh;
}

img {
  width: 90%;
  height: 50%;
  object-fit: cover;
  object-position: top left;
}
```

- The image box becomes 90% of the container's width and 50% of its height. The percentage height works because the container has a definite height (`60vh`).
- On a typical desktop screen that box is much wider than it is tall, while the source image is square (1000 x 1000). `cover` scales the image up until it fills the box's width, so the image is taller than the box and part of it is cut off.
- `object-position: top left` keeps the top of the image and crops from the bottom. With the default `50% 50%`, it would crop equally from the top and bottom.

To try it, uncomment the `<img>` and the `img` rule, then switch between `fill`, `contain`, `cover`, `none` and `scale-down`.

## The `index.html` Demo, Part 2: Background Images (active code)

```css
.container {
  width: 60vw;
  height: 60vh;
  border: 2px solid black;
  background-image: url("...");
  background-size: 30vw;
  /* background-repeat: no-repeat; */
}
```

- `background-size: 30vw` with **one** value sets the width to 30vw and the height to `auto`, so the image keeps its proportions.
- The container is 60vw wide, so two copies fit side by side.
- `background-repeat` defaults to `repeat`, so the image is **tiled** horizontally and vertically to fill the container. Uncomment `background-repeat: no-repeat;` to show a single copy in the top-left corner.

### `background-size`

| Value | Result |
|---|---|
| `auto` (default) | The image's natural size. |
| `30vw` / `200px` / `50%` | Sets the width; the height is `auto` (proportional). Percentages are relative to the element's background area. |
| `200px 100px` | Width and height; can distort the image. |
| `cover` | Same idea as `object-fit: cover`: fill the whole element, crop the rest. |
| `contain` | Same idea as `object-fit: contain`: show the whole image; usually combined with `no-repeat`, otherwise the empty space fills with more copies. |

### Related background properties

| Property | Common values | Default |
|---|---|---|
| `background-repeat` | `repeat`, `no-repeat`, `repeat-x`, `repeat-y`, `space`, `round` | `repeat` |
| `background-position` | `center`, `top left`, `50% 20%`, `10px 20px` | `0% 0%` (top left) |
| `background-attachment` | `scroll`, `fixed`, `local` | `scroll` |

The usual "full background" pattern, written with the `background` shorthand (the size goes after the position, separated by `/`):

```css
.hero {
  background: url("hero.jpg") center / cover no-repeat;
  min-height: 60vh;
}
```

> **Note:** The defaults differ: `object-position` starts at the centre (`50% 50%`), but `background-position` starts at the top left (`0% 0%`).

## `object-fit` vs `background-size`: Which One?

| | `<img>` + `object-fit` | `background-image` + `background-size` |
|---|---|---|
| Where the image lives | In the HTML | In the CSS |
| Meaning | Content (part of the page's information) | Decoration |
| Screen readers | Read the `alt` text | Ignore it completely |
| Search engines / image search | Indexed | Generally not |
| Fitting values | `fill`, `contain`, `cover`, `none`, `scale-down` | `auto`, lengths, `%`, `cover`, `contain` |
| Positioning | `object-position` (default centre) | `background-position` (default top left) |
| Tiling | Never | By default (`repeat`) |
| Responsive sources and lazy loading | `srcset`, `sizes`, `<picture>`, `loading="lazy"` | `image-set()`, media queries; no `loading="lazy"` |
| Text on top of it | Needs positioning tricks | Easy: just put content inside the element |

Rule of thumb: if removing the image would remove information (a product photo, a profile picture, an article image), use `<img>` with `object-fit`. If it is purely visual (a pattern, a hero backdrop behind a heading), a background image is fine.

## Common `object-fit` Patterns

Uniform thumbnails from images of different sizes:

```css
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

.gallery img {
  width: 100%;
  aspect-ratio: 1;      /* square */
  object-fit: cover;
  display: block;       /* removes the small gap under inline images */
}
```

Round avatar:

```css
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
```

Full-screen background video:

```css
.bg-video {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
}
```

## The `filter` Property

`filter` applies graphical effects to an element when it is drawn. It works on any element, not just images, and is commonly used for image hover effects, "disabled" looks and shadows that follow the shape of transparent images.

```css
selector {
  filter: none;                              /* default */
  filter: blur(3px);                         /* one filter function */
  filter: contrast(175%) brightness(80%);    /* several functions, separated by spaces */
}
```

- `filter` affects the **whole element**: its background, border, text and all its children.
- Several functions go in **one** declaration, separated by spaces. Each function is applied to the result of the previous one, so the order can change the result.
- Like any property, a second `filter` declaration replaces the first one; they don't add up.

## Filter Functions

| Function | Accepts | No change at | Effect |
|---|---|---|---|
| `blur()` | length (`px`, `rem`; no `%`) | `0` | Gaussian blur; the value is the blur radius. |
| `brightness()` | number or `%` | `1` / `100%` | `0` = completely black, above `1` = brighter. |
| `contrast()` | number or `%` | `1` / `100%` | `0` = flat grey, above `1` = more contrast. |
| `grayscale()` | `0`–`1` or `0%`–`100%` | `0` | `1` / `100%` = fully black and white. |
| `sepia()` | `0`–`1` or `0%`–`100%` | `0` | `1` = fully sepia (old-photo brown). |
| `saturate()` | number or `%` | `1` / `100%` | `0` = no colour, above `1` = more vivid. |
| `hue-rotate()` | angle (`deg`, `turn`) | `0deg` | Rotates every colour around the colour wheel. |
| `invert()` | `0`–`1` or `0%`–`100%` | `0` | `1` = colour negative. |
| `opacity()` | `0`–`1` or `0%`–`100%` | `1` / `100%` | `0` = fully transparent. |
| `drop-shadow()` | `offset-x offset-y [blur] [color]` | — | A shadow that follows the element's visible shape. |
| `url()` | link to an SVG `<filter>` | — | Custom filter defined in SVG. |

Numbers and percentages are interchangeable where both are allowed: `brightness(1.5)` = `brightness(150%)`.

```css
.photo-blur   { filter: blur(3px); }
.photo-bright { filter: brightness(150%); }
.photo-punchy { filter: contrast(2); }
.photo-faded  { filter: grayscale(80%); }        /* .Img2 in filter.html: almost black and white */
.photo-retro  { filter: sepia(60%) saturate(120%); }
.photo-shift  { filter: hue-rotate(90deg); }
```

## What the `filter.html` Demo Does

```css
.Img1 {
  width: 30vw;
  height: 40vh;
  /* filter: blur(3px); */
  /* filter: brightness(150%); */
  /* filter: contrast(2); */
  filter: drop-shadow(10%);
  /* Multiple filters */
  filter: contrast(175%) brightness(3%);
  filter: drop-shadow(3px 3px red) drop-shadow(-3px -3px blue);
}

.Img2 {
  width: 30vw;
  height: 40vh;
  filter: grayscale(80%);
}
```

`.Img1` has **three** active `filter` declarations in one rule:

1. `filter: drop-shadow(10%);` is **invalid**. `drop-shadow()` needs at least two lengths (the x and y offsets), and it doesn't accept percentages. The browser throws this declaration away.
2. `filter: contrast(175%) brightness(3%);` is valid and shows how to combine filters in one declaration. `brightness(3%)` makes the image almost completely black.
3. `filter: drop-shadow(3px 3px red) drop-shadow(-3px -3px blue);` is valid and comes last, so **this is the only filter that is applied**.

So `.Img1` ends up with a red shadow towards the bottom-right and a blue shadow towards the top-left, and no contrast or brightness change. To see the contrast/brightness line, comment out the last one. To get all of it at once, combine everything in a single declaration:

```css
.Img1 {
  filter: contrast(175%) brightness(80%) drop-shadow(3px 3px red) drop-shadow(-3px -3px blue);
}
```

`.Img2` simply gets `grayscale(80%)`: most of the colour is removed.

> **Note:** Because each filter works on the result of the previous one, the second (blue) drop shadow is cast by the image **and** its red shadow together. Chained drop shadows are not independent like the comma-separated shadows of `box-shadow`.

### Order matters

```css
.a { filter: grayscale(1) sepia(1); }  /* grey first, then tinted: ends up sepia-toned */
.b { filter: sepia(1) grayscale(1); }  /* tinted first, then grey: ends up plain grey */
```

Likewise with shadows:

```css
.c { filter: drop-shadow(4px 4px red) grayscale(1); }  /* the red shadow is turned grey too */
.d { filter: grayscale(1) drop-shadow(4px 4px red); }  /* grey image, red shadow */
```

## `drop-shadow()` vs `box-shadow`

```css
.icon {
  filter: drop-shadow(2px 4px 6px rgb(0 0 0 / 0.5));
  /*                  x   y   blur  color          */
}
```

| | `filter: drop-shadow()` | `box-shadow` |
|---|---|---|
| Shape of the shadow | Follows the visible pixels (transparent PNG, SVG icon, text) | Always the element's rectangle (respects `border-radius`) |
| Spread value | No | Yes |
| `inset` shadows | No | Yes |
| Several shadows | Chain functions; each one shadows the previous result | Comma-separated list; each shadow is independent |
| Affects children | Yes: the shadow is of the element and everything inside it | Only the element's own box |
| Cost | Usually more expensive to draw | Cheaper |

On a normal rectangular photo (like the images in `filter.html`), the two look almost the same. The difference shows on transparent images: `drop-shadow()` outlines the shape of a cut-out product or a logo, while `box-shadow` draws a rectangle around it.

## `backdrop-filter`

`filter` changes the element itself. `backdrop-filter` changes whatever is **behind** the element. It is how the "frosted glass" effect is made:

```css
.glass-panel {
  background-color: rgb(255 255 255 / 0.3);   /* must be at least partly transparent */
  -webkit-backdrop-filter: blur(10px);        /* for older Safari versions */
  backdrop-filter: blur(10px);
}
```

| | `filter` | `backdrop-filter` |
|---|---|---|
| Applies to | The element and its content | The area behind the element |
| Element needs transparency | No | Yes, otherwise you can't see the effect |
| Typical use | Image effects, shadows, disabled look | Frosted-glass navbars, modals, overlays |

## Practical Filter Uses

Black and white until hover:

```css
.gallery img {
  filter: grayscale(100%);
  transition: filter 0.3s ease;
}

.gallery img:hover,
.gallery a:focus-visible img {
  filter: grayscale(0%);
}
```

Making a background image darker so the text on top is readable, without darkening the text. A filter on the parent would darken the text too, so put the image on a pseudo-element:

```css
.hero {
  position: relative;
  isolation: isolate;          /* keeps the negative z-index inside .hero */
  color: white;
}

.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: url("hero.jpg") center / cover;
  filter: brightness(50%);     /* only the background layer is darkened */
}
```

(For simple darkening, a gradient overlay works too: `background: linear-gradient(rgb(0 0 0 / 0.5), rgb(0 0 0 / 0.5)), url("hero.jpg") center / cover;`.)

A quick colour change for a single-colour icon: `filter: invert(1)` turns a black icon white. For anything more precise, use an SVG with `fill: currentColor` instead.

## Filter Side Effects

- Any `filter` or `backdrop-filter` value other than `none` creates a new **stacking context**, which can change how `z-index` behaves for its children.
- It also makes the element the **containing block** for `position: fixed` and `position: absolute` descendants. A "fixed" modal or dropdown inside a filtered element is positioned relative to that element, not the viewport. The same happens with `transform`; see [CSS Positioning](../11-position-and-z-index/notes.md) for the full list and fixes.
- The filter is applied to the element's painted output, including anything that overflows it. A large `blur()` spreads beyond the element's edges.

## Performance

Images:

- `object-fit` only changes how the image is **displayed**. A 4000 x 3000 photo shown as a 200px thumbnail still downloads in full. Serve suitably sized files with `srcset` and `sizes` (or `<picture>`).
- Give images `width` and `height` attributes (or a CSS `aspect-ratio`) so the browser reserves the space before the image loads. Without them, content jumps when the image arrives (layout shift, measured as CLS).

```html
<img src="photo-800.jpg"
     srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1600.jpg 1600w"
     sizes="(max-width: 600px) 100vw, 50vw"
     width="800" height="600"
     alt="Sunset over the harbour"
     loading="lazy">
```

- Use `loading="lazy"` for images below the fold, but not for the main image at the top of the page.

Filters:

- `blur()` and `drop-shadow()` are the most expensive filters. The cost grows with the blur radius and with the area being filtered.
- Animating `filter` or `backdrop-filter` on large areas (a full-screen blur, a large hero image) can drop frames on slower phones. Keep blurs small, or fade a pre-blurred layer in with `opacity` instead of animating the blur amount.
- For a fade, use the `opacity` **property** rather than `filter: opacity()`; it is the simplest and most widely optimised.
- Many `backdrop-filter` panels on one page add up, because each one filters everything behind it on every frame that changes.

## Accessibility

- Every `<img>` needs an `alt` attribute. Describe meaningful images; use `alt=""` (as both demos do) only for purely decorative images, so screen readers skip them.
- Cropping with `cover` can hide part of the picture. If the hidden part matters, choose `contain`, adjust `object-position`, or describe it in the `alt` text.
- Background images are invisible to assistive technology. Never put important information (text in the image, a chart) only in a background image.
- Text over an image needs enough contrast. Add a dark overlay or a `background-color` fallback in case the image fails to load.
- After using `brightness()`, `contrast()` or `invert()` on elements with text, re-check the colour contrast (WCAG asks for at least 4.5:1 for normal text).
- Don't use `grayscale()` alone to show that something is disabled. Use the `disabled` attribute or `aria-disabled="true"` too, and provide a non-colour cue.
- Animated filters (pulsing brightness, cycling `hue-rotate`) are motion: respect `prefers-reduced-motion`, and never flash more than three times per second.
- Hover effects (such as grayscale to colour) should also run on `:focus-visible` for keyboard users.

## Common Mistakes

- Putting `object-fit` on the wrapper `<div>` instead of on the `<img>` itself.
- Setting `object-fit` but not giving the image a box with a different shape (for example only `width` with `height: auto`), so there is nothing to fit and you see no change.
- A percentage `height` on an image whose parent has no definite height: it behaves like `auto`.
- Forgetting `background-repeat: no-repeat`, which leaves the background tiled (as in `index.html`).
- Mixing up `cover` (fills, may crop) and `contain` (shows everything, may leave gaps).
- Using a background image for content images, which hides them from screen readers and search engines.
- Expecting `object-fit` to make large images load faster.
- Writing several `filter` declarations, as in `filter.html`, and expecting them to combine. Only the last valid one applies; put all functions in one declaration.
- Invalid filter values that are silently ignored: `blur(3)` (needs a unit), `blur(10%)` (no percentages), `drop-shadow(10%)` (needs x and y lengths), `hue-rotate(90)` (needs an angle unit).
- Expecting a filter on a parent to affect only its background. It applies to all its content, including text and children.
- Expecting `drop-shadow()` to support spread or `inset` like `box-shadow`.
- A `position: fixed` child inside a filtered element ending up in the wrong place, or animating large blurs and wondering why scrolling becomes slow.

## Key Takeaways

- By default (`fill`) an image is stretched to its box and can look distorted.
- `object-fit: cover` fills the box and crops; `contain` shows the whole image and may leave gaps; `none` keeps the natural size; `scale-down` never enlarges.
- `object-position` (default `50% 50%`) chooses which part stays visible when cropping or letterboxing.
- Background images use `background-size` (`cover`/`contain`/lengths), `background-position` (default top left) and `background-repeat` (default `repeat`). Use `<img>` + `object-fit` for content images, background images for decoration.
- Pair `object-fit` with `aspect-ratio`, `width`/`height` attributes and `srcset` for layouts that don't jump and images that don't waste bandwidth.
- `filter` applies visual effects (`blur`, `brightness`, `contrast`, `grayscale`, `sepia`, `saturate`, `hue-rotate`, `invert`, `opacity`, `drop-shadow`) to an element and everything inside it, at render time.
- Combine filters in **one** declaration separated by spaces; the order matters, and a second declaration replaces the first.
- `drop-shadow()` follows the visible shape of the content; `box-shadow` follows the box and supports spread and `inset`. `backdrop-filter` filters what is behind a semi-transparent element.
- Filters create a stacking context and a containing block for fixed/absolute children, and `blur()`/`drop-shadow()` are expensive over large areas.

## Interview Questions

### Junior (0–1 year)

**Q1. What does `object-fit` do, and what are its values?**
It controls how the content of a replaced element such as `<img>` or `<video>` is resized to fit its box. The values are `fill` (default: stretch to fit, may distort), `contain` (show the whole image, keep the ratio, may leave gaps), `cover` (fill the box, keep the ratio, crop the overflow), `none` (natural size, no resizing) and `scale-down` (the smaller of `none` and `contain`).

**Q2. What is the difference between `object-fit: cover` and `object-fit: contain`?**
Both keep the image's aspect ratio. `cover` scales the image until the whole box is filled, so parts of the image may be cropped. `contain` scales it until the whole image fits inside the box, so there may be empty space on two sides. Use `cover` for thumbnails and hero images, `contain` for logos or product photos where nothing may be cut off.

**Q3. What does `object-position` do, and what is its default?**
It sets where the image is placed inside its box when `object-fit` crops it or leaves space, using the same syntax as `background-position` (keywords, percentages or lengths). The default is `50% 50%`, centred. For example, `object-position: center top` keeps the top of a portrait visible when `cover` crops it.

**Q4. What will this look like?**

```css
.container {
  width: 600px;
  height: 400px;
  background-image: url("photo.jpg");
  background-size: 300px;
}
```

Each copy of the image is 300px wide with a proportional height, and because `background-repeat` defaults to `repeat`, the image is tiled across the whole container: two copies side by side and as many rows as needed. Add `background-repeat: no-repeat` for a single copy in the top-left corner, or use `background-size: cover` with `background-position: center` to fill the container with one image.

**Q5. Why does `object-fit` have no effect on a `<div>`?**
`object-fit` only applies to replaced elements, whose content comes from an external resource with its own size, such as `<img>` and `<video>`. A `<div>` has no such content to fit. For an image on a `<div>`, use `background-image` with `background-size: cover` or `contain`.

**Q6. What does the CSS `filter` property do? Name some filter functions.**
It applies graphical effects to an element when it is drawn, without changing the original image file. Common functions are `blur()`, `brightness()`, `contrast()`, `grayscale()`, `sepia()`, `saturate()`, `hue-rotate()`, `invert()`, `opacity()` and `drop-shadow()`. It works on any element, and the effect includes the element's children and text.

**Q7. What filter is applied to this image?**

```css
img {
  filter: blur(3px);
  filter: contrast(175%) brightness(3%);
  filter: drop-shadow(3px 3px red) drop-shadow(-3px -3px blue);
}
```

Only the last declaration: two drop shadows, red towards the bottom-right and blue towards the top-left. Each `filter` declaration replaces the previous one, so there is no blur and no contrast or brightness change. To apply several effects, list them in one declaration separated by spaces.

**Q8. How would you show images in black and white and bring back the colour smoothly on hover?**

```css
img { filter: grayscale(100%); transition: filter 0.3s ease; }
img:hover { filter: grayscale(0%); }
```

The `transition` on the base rule makes the change animate both ways. Adding the same effect for `:focus-visible` (for example on the link around the image) makes it work for keyboard users too.

**Q9. What is the difference between `filter` and `backdrop-filter`?**
`filter` changes the element itself and everything inside it. `backdrop-filter` changes the content **behind** the element, which is only visible if the element's background is at least partly transparent. `backdrop-filter: blur(10px)` with a semi-transparent background is the standard "frosted glass" effect.

### Mid-level (2–4 years)

**Q10. When would you use an `<img>` with `object-fit` instead of a CSS background image?**
Use `<img>` when the image is content: it is read by screen readers through `alt`, indexed by search engines, can be lazy-loaded with `loading="lazy"`, and supports `srcset`/`sizes`/`<picture>` for responsive files. Background images suit purely decorative visuals, patterns, or cases where text sits on top of the image. The visual result can be the same (`object-fit: cover` vs `background-size: cover`), so the decision is about meaning and loading behaviour.

**Q11. How would you build a grid of equal square thumbnails from images of different sizes and shapes?**

```css
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.grid img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
```

`aspect-ratio: 1` makes each image box square at whatever width the grid gives it, `object-fit: cover` fills the square without distortion, and `display: block` removes the gap under inline images. Adjust `object-position` if important parts are being cropped.

**Q12. Does `object-fit: cover` reduce the image's file size or improve performance?**
No. It only changes how the image is drawn; the full file is still downloaded and decoded. A huge photo shown as a small thumbnail wastes bandwidth and memory. Serve appropriately sized files with `srcset` and `sizes` or `<picture>`, compress them (for example WebP or AVIF), and lazy-load images below the fold.

**Q13. How do you stop images from causing layout shift while they load?**
Reserve their space before they arrive. Add `width` and `height` attributes to the `<img>` (browsers use them to calculate the aspect ratio even when CSS makes the image responsive with `width: 100%; height: auto;`), or set `aspect-ratio` in CSS. Combined with `object-fit: cover`, the box keeps a fixed shape whatever the real image's ratio is.

**Q14. Does the order of filter functions matter? Give an example.**
Yes. Each function is applied to the output of the previous one. `grayscale(1) sepia(1)` removes the colour and then tints it, giving a sepia image, while `sepia(1) grayscale(1)` tints and then removes all colour, giving plain grey. Similarly, `drop-shadow(4px 4px red) grayscale(1)` turns the red shadow grey along with the image, while `grayscale(1) drop-shadow(4px 4px red)` keeps the shadow red.

**Q15. Animating `filter: blur()` on a large hero image makes the page stutter. What can you do?**
Blur is expensive and its cost grows with the radius and the size of the area, and animating it means re-filtering every frame. Reduce the area or radius, or render a blurred copy once and cross-fade between the sharp and blurred layers using `opacity`, which is cheap to animate. Also respect `prefers-reduced-motion` and avoid stacking many `backdrop-filter` panels.

**Q16. How do you darken a background image so that white text on it is readable, without darkening the text?**
A filter on the element would darken the text too, because filters apply to all content. Put the image on a `::before` pseudo-element behind the content (`position: absolute; inset: 0; z-index: -1;` with `isolation: isolate` on the parent) and apply `filter: brightness(50%)` there, or skip filters and layer a semi-transparent gradient over the image: `background: linear-gradient(rgb(0 0 0 / 0.5), rgb(0 0 0 / 0.5)), url(hero.jpg) center / cover;`. Then check the contrast ratio.

**Q17. How would you build a frosted-glass navbar, and what fallback would you provide?**
Give the navbar a semi-transparent background (`rgb(255 255 255 / 0.6)`) and `backdrop-filter: blur(10px)`, plus `-webkit-backdrop-filter` for older Safari. Where `backdrop-filter` isn't supported, make the background more opaque so the text stays readable, for example with `@supports not (backdrop-filter: blur(1px)) { .nav { background: rgb(255 255 255 / 0.95); } }`. Keep the blurred area small, because a large backdrop blur is expensive while scrolling.

### Senior (5+ years)

**Q18. You are designing the shared `<Image>` component for a large e-commerce front end. What does its API enforce, and why?**
Most image problems (layout shift, wasted bytes, distorted or badly cropped photos, missing `alt`) come from each team making the same decisions differently, so the component should make the right choice the default. Require `alt` (allowing an explicit empty string for decorative images) and either intrinsic `width`/`height` or an `aspectRatio` prop, so space is always reserved. Expose `fit` (`cover` | `contain`, mapped to `object-fit`) and `focalPoint` (mapped to `object-position`) instead of letting callers pass arbitrary styles. Generate `srcset`/`sizes` from an image CDN rather than accepting one `src`, default to `loading="lazy"` with a `priority` prop that switches to eager loading plus `fetchpriority="high"` for the LCP image, and serve AVIF/WebP. Recommendation: one component, no raw `<img>` in feature code (enforce it with a lint rule), and track CLS and LCP per page so regressions show up.

**Q19. Editors upload photos with the subject anywhere in the frame, and `object-fit: cover` cuts off faces on mobile cards. How do you solve this at scale?**
`object-position: center` is a guess that is wrong for many photos, and the crop changes at every breakpoint. Options, in order of effort: store a **focal point** per image in the CMS (the editor clicks the subject) and pass it as `object-position: 30% 20%` (or through a custom property), which keeps the subject visible at any aspect ratio; let the image CDN crop server-side with face or "smart" gravity, which also saves bytes; and for layouts that need genuinely different crops (wide hero on desktop, tight portrait on mobile), use **art direction** with `<picture>` and `<source media="...">` pointing at separately cropped files. Recommendation: focal-point metadata plus `object-position` as the default (cheap and works everywhere), CDN cropping for thumbnails, and `<picture>` only for the few hero images that need a different composition.

**Q20. Someone proposes a "quick dark mode": `html { filter: invert(1) hue-rotate(180deg); }`, then re-inverting images and videos. Would you accept it?**
No, except as a throwaway prototype. It inverts every colour mechanically, so brand colours, shadows (which become glows) and carefully chosen contrast ratios are no longer what the designers specified, and every photo, video, canvas, iframe and embedded widget has to be found and re-inverted, which breaks every time someone adds a new media type. The whole page is filtered on every repaint, which costs performance on low-end devices, and putting the filter on `body` instead of `html` (or on any wrapper) turns it into the containing block for every `position: fixed` element, breaking headers and modals (the root element is exempt from this rule). Recommendation: build dark mode on colour tokens in custom properties (see [CSS Variables](../16-custom-properties/notes.md)), set `color-scheme: light dark` so form controls and scrollbars follow, use `light-dark()` where it helps, and keep `filter: invert()` for single-colour icons only.

**Q21. Design wants frosted-glass (`backdrop-filter`) headers, cards and modals throughout the product. What do you weigh before agreeing?**
Performance: every `backdrop-filter` region re-filters whatever is behind it whenever that content changes, so a sticky blurred header re-blurs on every scroll frame, and many of them stall mid-range phones. Legibility: text sits on top of unpredictable content, so contrast can't be guaranteed; it needs a fairly opaque tint, not just blur. Side effects: like `filter`, it creates a stacking context and a containing block for fixed descendants, which can break dropdowns inside a blurred card. Support and preferences: provide an `@supports` fallback with a solid background, and where browsers support `prefers-reduced-transparency`, honour it. Recommendation: allow it on a small number of surfaces (one sticky header, modal overlays) as a design-system utility with a built-in opaque fallback, measure scrolling performance on a real low-end device, and reject it as a default card style.

> **Note:** Related questions answered elsewhere: [CSS Positioning](../11-position-and-z-index/notes.md#interview-questions) (`position: fixed` broken by a transformed or filtered ancestor); [Backgrounds, Gradients, Shadows and Outline](../08-backgrounds-shadows-outline/notes.md#interview-questions) (`drop-shadow()` vs `box-shadow`).

## References

- [MDN: object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit)
- [MDN: object-position](https://developer.mozilla.org/en-US/docs/Web/CSS/object-position)
- [MDN: background-size](https://developer.mozilla.org/en-US/docs/Web/CSS/background-size)
- [MDN: background-repeat](https://developer.mozilla.org/en-US/docs/Web/CSS/background-repeat)
- [MDN: aspect-ratio](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio)
- [MDN: filter](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)
- [MDN: filter functions](https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function)
- [MDN: drop-shadow()](https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow)
- [MDN: backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)
- [MDN: box-shadow](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow)
- [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [web.dev: Optimize Cumulative Layout Shift](https://web.dev/articles/optimize-cls)
