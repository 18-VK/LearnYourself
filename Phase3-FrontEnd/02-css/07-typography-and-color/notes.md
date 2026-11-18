# Typography and Color

> CSS · Topic 7 · Demo: [index.html](index.html) · [colors.html](colors.html)

Typography and color make up most of how a page "feels", and they are also where performance (font loading), accessibility (contrast) and theming (light/dark, brand colors) meet. This note covers choosing and loading fonts (`font-family`, Google Fonts, self-hosting with `@font-face`, `font-display`, `unicode-range`, preloading, variable fonts), styling text (`text-align`, `text-decoration`, `text-transform`, `text-overflow` and friends), and writing colors, from keywords, hex, RGB and HSL to the modern `oklch()`, `color-mix()`, relative color syntax, `light-dark()` and wide-gamut colors. `index.html` demonstrates fonts and text; `colors.html` demonstrates colors.

Original lecture links:

- Fonts: https://www.codewithharry.com/tutorial/css-fonts/
- Colors: https://www.codewithharry.com/tutorial/css-colors/
- Text styling: https://www.codewithharry.com/tutorial/css-text-styling/

## Fonts

### `font-family` and font stacks

`font-family` takes a comma-separated list called a **font stack**. The browser uses the first font in the list that is available, and the last entry should be a **generic family** that always exists.

```css
h1 {
  font-family: 'Poppins', 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande',
               'Lucida Sans Unicode', Geneva, Verdana, sans-serif;
}
```

In the demo, the Poppins import is commented out, so `'Poppins'` is not loaded (unless it happens to be installed locally) and the `<h1>` falls back to the next font in the list that is installed on the computer. This is exactly what a stack is for.

| Generic family | Look | Typical fonts |
|---|---|---|
| `serif` | small strokes ("feet") on letters | Times New Roman, Georgia |
| `sans-serif` | clean, no strokes | Arial, Helvetica, Verdana |
| `monospace` | every character the same width | Courier New, Consolas |
| `cursive` | handwriting style | Comic Sans MS |
| `fantasy` | decorative | Impact |
| `system-ui` | the operating system's UI font | Segoe UI (Windows), San Francisco (macOS) |

- Quote font names that contain spaces (`'Lucida Sans'`). Quotes are optional for simple names (`Verdana`).
- **Never** quote generic families: `"sans-serif"` would look for a font literally named "sans-serif".

### Loading web fonts (Google Fonts)

A web font is downloaded by the browser, so it looks the same on every device. The demo loads the "Honk" font from Google Fonts with `@import` at the top of the `<style>` block:

```css
/* @import url('https://fonts.googleapis.com/css2?family=Baloo+Bhai+2&family=Poppins:wght@300&display=swap'); */
@import url('https://fonts.googleapis.com/css2?family=Honk&display=swap');

p {
  font-family: 'Honk', system-ui;
  font-size: 20px;
}
```

- `@import` must come **before** all other rules in the stylesheet.
- `display=swap` in the URL makes Google add `font-display: swap`: text is shown immediately in the fallback font and swapped once the web font arrives (no invisible text while loading).
- `wght@300` loads only the 300 (light) weight. Asking for `font-weight: 700` with only 300 loaded makes the browser fake a bold ("faux bold"), which looks worse. Load every weight you use.

The faster, recommended way is `<link>` tags in the HTML `<head>` (this is the snippet Google Fonts itself gives you), because the browser discovers them earlier than an `@import` inside CSS:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300&display=swap" rel="stylesheet">
```

### Self-hosting fonts with `@font-face`

`@font-face` defines a font family name and tells the browser where its files are. Google Fonts' stylesheet is nothing more than a list of these rules, so you can do the same with files on your own server:

```css
@font-face {
  font-family: "Inter";
  src: local("Inter"),                                   /* use an installed copy if there is one */
       url("/fonts/inter-regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Inter";                                  /* same family name ... */
  src: url("/fonts/inter-bold.woff2") format("woff2");
  font-weight: 700;                                      /* ... different weight */
  font-style: normal;
  font-display: swap;
}

body { font-family: "Inter", system-ui, sans-serif; }
strong { font-weight: 700; }                             /* picks the second file */
```

- One family name with several `@font-face` rules is how regular, bold and italic map to separate files. `font-weight` and `font-style` inside `@font-face` describe the file; the same properties on elements choose a file.
- The browser downloads a font file **only when some text on the page actually uses it**, not when it parses the rule.
- `src` is a fallback list. The `format()` hint lets the browser skip files it cannot use without downloading them.

| Format | Use today? |
|---|---|
| WOFF2 | **Yes.** Best compression, supported by every current browser. On its own it is enough. |
| WOFF | Only if you must support very old browsers. |
| TTF / OTF | Desktop formats; larger files. Convert them to WOFF2 for the web. |
| EOT, SVG fonts | Obsolete (old Internet Explorer and old iOS). |

#### `font-display`: what happens while the font loads

| Value | Block period (text invisible) | Swap period (fallback shown, may switch later) | Good for |
|---|---|---|---|
| `auto` | browser decides (usually like `block`) | | rarely chosen on purpose |
| `block` | short (about 3s) | infinite | icon fonts, where fallback glyphs would be wrong |
| `swap` | almost none | infinite | brand headings that must use the web font |
| `fallback` | almost none (about 100ms) | short (about 3s), then the fallback stays | body text |
| `optional` | almost none (about 100ms) | none: if the font is not ready, this page view keeps the fallback | body text when layout stability matters most; the cached font is used on the next page |

#### `unicode-range`: download only the characters you need

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F;   /* basic Latin and punctuation */
}

@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-cyrillic.woff2") format("woff2");
  unicode-range: U+0400-045F, U+0490-0491;                        /* Cyrillic */
}
```

The browser downloads a subset file only if the page contains a character in its range, so an English page never fetches the Cyrillic file. Google Fonts does this automatically, which is why its CSS contains many `@font-face` blocks for one family.

#### Preloading the critical font

The browser discovers a font late: it has to download the HTML, then the CSS, then build the render tree and find text that uses the font. A preload starts the download straight away:

```html
<link rel="preload" href="/fonts/inter-regular.woff2" as="font" type="font/woff2" crossorigin>
```

- `crossorigin` is **required**, even for fonts on your own domain, because fonts are always fetched in CORS mode. Without it the preloaded file does not match the real request and is downloaded twice.
- Preload only the one or two files used above the fold. Every preload competes for bandwidth with the CSS and the LCP image.

#### Reducing the layout shift when fonts swap

When the web font replaces the fallback, the text often changes width and height, which moves the layout (CLS). You can adjust the **fallback** font's metrics to match the web font:

```css
@font-face {
  font-family: "Inter Fallback";
  src: local("Arial");
  size-adjust: 107%;          /* illustrative values: tools calculate them for you */
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}

body { font-family: "Inter", "Inter Fallback", sans-serif; }
```

Tools such as Next.js `next/font` and Fontaine generate these values automatically. `size-adjust` works in all current browsers; Safari did not support the `*-override` descriptors at the time of writing, so check support before relying on them.

### Variable fonts

A **variable font** is one file that contains a whole range of styles along one or more **axes**, instead of one file per weight. The standard (registered) axes map to normal CSS properties:

| Axis tag | CSS property | Example |
|---|---|---|
| `wght` (weight) | `font-weight` | `font-weight: 650;` (any value in the range, not just multiples of 100) |
| `wdth` (width) | `font-stretch` (renamed `font-width` in newer specs) | `font-stretch: 85%;` |
| `ital` (italic) | `font-style` | `font-style: italic;` |
| `slnt` (slant) | `font-style` | `font-style: oblique 10deg;` |
| `opsz` (optical size) | `font-optical-sizing` | `auto` (default): small text gets sturdier shapes, large text finer ones |

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-variable.woff2") format("woff2");
  font-weight: 100 900;       /* a range: this one file covers every weight */
  font-display: swap;
}

h1 { font-weight: 750; }
.link { transition: font-weight 0.2s; }
.link:hover { font-weight: 600; }   /* weight can be animated smoothly */
```

With Google Fonts, ask for a range (`family=Inter:wght@100..900`) to get the variable file. Variable fonts work in all current browsers.

Custom axes (written in capitals, such as `GRAD` for grade) can only be set with the low-level `font-variation-settings`. That property sets **all** axes at once, so a child that sets one axis silently resets the others. Drive it with custom properties so each axis can be changed on its own:

```css
.text {
  font-variation-settings: "GRAD" var(--grad, 0), "CASL" var(--casl, 0);
}
.text.dark-mode { --grad: -50; }   /* only GRAD changes; CASL keeps its value */
```

> **Note:** A variable font file is larger than any single static weight. It saves bytes only when you use several weights or styles (roughly three or more); with one or two weights, static files can be smaller.

### Other font properties

| Property | Common values | Notes |
|---|---|---|
| `font-size` | `16px`, `1.25rem`, `120%`, `small`, `large` | Units are covered in [Units and sizing](../05-units-and-sizing/notes.md) |
| `font-weight` | `100` to `900`, `normal` (= 400), `bold` (= 700), `bolder`, `lighter` | Only weights the font provides look right |
| `font-style` | `normal`, `italic`, `oblique` | The demo has `font-style: italic` commented out |
| `line-height` | `1.5` (unitless), `24px`, `150%` | Prefer unitless; see Q9 |
| `font-variant` | `small-caps` | |
| `font-synthesis` | `none`, `weight`, `style` | `none` stops the browser faking bold/italic when a face is missing |

### The `font` shorthand

```css
/* font: [style] [variant] [weight] size[/line-height] family; */
p {
  font: italic 500 20px/1.5 'Poppins', sans-serif;
}
```

`font-size` and `font-family` are **required** in the shorthand, and any part you leave out is reset to its default (for example `font-weight` back to `normal`).

## Text Styling

| Property | What it does | Example |
|---|---|---|
| `color` | text color | `color: #333;` |
| `text-align` | horizontal alignment of inline content | `left`, `right`, `center`, `justify`, `start`, `end` |
| `text-transform` | changes letter case visually | `uppercase`, `lowercase`, `capitalize`, `none` |
| `text-decoration` | lines on text | `underline`, `overline`, `line-through`, `none` |
| `text-decoration-color` | color of that line | `blue` |
| `text-decoration-style` | style of that line | `solid`, `dotted`, `dashed`, `wavy`, `double` |
| `text-decoration-thickness` | thickness of that line | `7px` |
| `text-underline-offset` | gap between text and underline | `4px` |
| `text-indent` | indents the first line of a block | `45px` |
| `letter-spacing` | space between characters | `0.05em` |
| `word-spacing` | space between words | `4px` |
| `white-space` | how spaces and line breaks are handled | `normal`, `nowrap`, `pre`, `pre-wrap` |
| `word-break` | where lines may break inside words | `normal`, `break-all`, `keep-all` |
| `overflow-wrap` | break a long word only if it would overflow | `normal`, `break-word`, `anywhere` |
| `text-overflow` | how clipped overflowing text is shown | `clip`, `ellipsis` |

The demo's heading styles:

```css
h2 {
  text-align: center;
  text-transform: uppercase;          /* "about Fonts" is displayed as "ABOUT FONTS" */
  text-decoration: underline;
  text-decoration-color: blue;
  /* text-decoration-style: dotted; */
  text-decoration-thickness: 7px;
  /* text-indent: 45px; */
}
```

`text-decoration` is a shorthand, so the same line can be written as:

```css
h2 {
  text-decoration: underline dotted blue;
  text-decoration-thickness: 7px;
}
```

> **Note:** `text-transform` only changes how text *looks*. The underlying text (what screen readers read and what is copied) is unchanged, which is why it is better than typing headings in capitals in the HTML.

### Truncating text with an ellipsis

The demo tries to cut off text with "..." inside a narrow box:

```css
.lorem {
  border: 2px solid red;
  width: 145px;
  /* word-break: break-all; */
  text-overflow: ellipsis;
  overflow: hidden;
}
```

`text-overflow: ellipsis` only works when the text actually overflows **horizontally**. Without `white-space: nowrap`, the paragraph simply wraps onto more lines, so usually no ellipsis appears (only a single word wider than the box is clipped with "..."). The correct single-line recipe needs all three properties:

```css
.truncate {
  white-space: nowrap;       /* keep the text on one line */
  overflow: hidden;          /* hide what does not fit */
  text-overflow: ellipsis;   /* show "..." where it is cut */
}
```

Clamping text to several lines ("show 3 lines then ...") uses `-webkit-line-clamp`, covered in [Overflow and Scrolling](../10-overflow-and-scrolling/notes.md).

The commented-out `word-break: break-all` would instead allow the browser to break words at any character so nothing overflows. For long URLs or IDs, `overflow-wrap: anywhere` (or `break-word`) is usually nicer, because it only breaks a word when it cannot fit on its own line.

## Colors

`color` sets the **text** color; `background-color` sets the **box** color. The `colors.html` demo shows that a color can be represented in several formats:

1. Color keywords
2. Hex color code
3. RGB
4. RGBA
5. HSL (and HSLA)

```css
h1 {
  /* color: darkred; */                    /* keyword */
  /* color: #0BEE0B; */                    /* hex */
  /* color: rgb(76, 125, 59); */           /* RGB */
  /* color: rgba(255, 22, 5, 0.175) */     /* RGBA: RGB + alpha (transparency) */
  color: hsl(130, 61%, 44%);               /* HSL */
  background-color: rgb(76, 125, 59);
}
```

| Format | Syntax | Range | Notes |
|---|---|---|---|
| Keyword | `darkred`, `tomato`, `cadetblue` | about 140 named colors | Easy to read; limited palette |
| Hex | `#RRGGBB`, `#RGB` | `00` to `ff` per channel | `#0f0` = `#00ff00`. Add 2 digits for alpha: `#00ff0080` |
| RGB | `rgb(76, 125, 59)` | 0 to 255 per channel | Red, green and blue light mixed together |
| RGBA | `rgba(255, 22, 5, 0.175)` | alpha 0 (transparent) to 1 (opaque) | Transparency for just this color |
| HSL | `hsl(130, 61%, 44%)` | hue 0 to 360 deg, saturation 0 to 100%, lightness 0 to 100% | Easy to make lighter/darker variants |
| HSLA | `hsla(130, 61%, 44%, 0.5)` | alpha 0 to 1 | HSL with transparency |
| OKLCH | `oklch(62% 0.15 145)` | lightness 0 to 100%, chroma 0 to about 0.4, hue 0 to 360 | Perceptually even; can express wide-gamut colors (below) |

### Understanding HSL

- **Hue** is a position on the color wheel in degrees: 0 = red, 120 = green, 240 = blue (360 = red again).
- **Saturation** is how colorful: 0% is gray, 100% is fully vivid.
- **Lightness**: 0% is black, 100% is white, 50% is the "pure" color.

Because hue stays the same, it is easy to build a palette: `hsl(130, 61%, 44%)` for a button and `hsl(130, 61%, 34%)` for its hover state.

### Space-separated syntax

Current CSS lets `rgb()` and `hsl()` take an alpha value directly, with spaces instead of commas (`rgba()` and `hsla()` are now just aliases):

```css
.overlay {
  background-color: rgb(0 0 0 / 50%);        /* same as rgba(0, 0, 0, 0.5) */
  color: hsl(130 61% 44% / 0.8);
}
```

### Perceptual color: `oklch()` and `oklab()`

HSL's "lightness" is a formula, not what the eye sees. `hsl(60 100% 50%)` (yellow) and `hsl(240 100% 50%)` (blue) both claim 50% lightness, but the yellow looks far lighter, so white text is readable on the blue and unreadable on the yellow. Palettes built by rotating the hue in HSL look uneven for the same reason.

`oklch(L C H)` is built on a perceptual color model:

- **L** (lightness, `0%` to `100%` or `0` to `1`): equal L looks equally light across hues.
- **C** (chroma): how colorful, from `0` (gray) to about `0.37` for the most vivid colors screens can show.
- **H** (hue): an angle in degrees, like HSL.

```css
:root {
  --brand:         oklch(55% 0.18 250);   /* blue */
  --brand-hover:   oklch(48% 0.18 250);   /* same hue and chroma, just darker */
  --success:       oklch(55% 0.15 145);   /* same lightness, different hue: similar contrast */
}
```

`oklab(L a b)` uses the same lightness with two color axes (green–red and blue–yellow) instead of chroma and hue. It is mostly used for mixing and gradients; `oklch()` is easier to edit by hand. Both work in all major browsers since 2023.

### Mixing and deriving colors: `color-mix()` and relative color syntax

`color-mix()` blends two colors in a chosen color space:

```css
.button:hover {
  background: color-mix(in oklch, var(--brand), black 15%);   /* 15% darker */
}
.badge {
  background: color-mix(in srgb, var(--brand) 20%, transparent);   /* a light tint */
}
```

The color space changes the result: mixing blue and yellow `in srgb` passes through a dull gray, while `in oklch` keeps the colors vivid. `color-mix()` works in all major browsers since 2023.

**Relative color syntax** takes an existing color, exposes its channels as keywords, and lets you change some of them:

```css
.button:hover { background: oklch(from var(--brand) calc(l - 0.07) c h); }   /* darker */
.overlay      { background: rgb(from var(--brand) r g b / 50%); }            /* brand at 50% alpha */
.muted        { color: hsl(from var(--brand) h calc(s * 0.5) l); }            /* less saturated */
```

This is what makes a full theme from one brand color possible in plain CSS. It works in all major browsers since 2024; for older browsers, declare a static color first and the relative one second (the browser keeps the last declaration it understands).

### Light and dark themes: `color-scheme` and `light-dark()`

```css
:root {
  color-scheme: light dark;                   /* opt in to both: form controls and scrollbars follow too */
  --surface: light-dark(#ffffff, #121212);
  --text:    light-dark(#1a1a1a, #e8e8e8);
}

body {
  background: var(--surface);
  color: var(--text);
}

[data-theme="dark"] { color-scheme: dark; }  /* a manual toggle only switches color-scheme */
```

- `light-dark(a, b)` returns `a` when the element's used color scheme is light and `b` when it is dark. It only works if `color-scheme` allows both, and it accepts colors only (not lengths or images, at the time of writing).
- Because it follows `color-scheme`, a theme toggle does not need a second set of variables, only a different `color-scheme`.
- It works in all major browsers since 2024. Theming with custom properties is covered in [Custom properties](../16-custom-properties/notes.md), and the `prefers-color-scheme` media query in [Media and container queries](../15-media-and-container-queries/notes.md).

### Wide-gamut color

`rgb()`, hex and `hsl()` can only describe colors inside **sRGB**, the classic web color space. Most current phones, Macs and many monitors can show the larger **Display P3** gamut, with noticeably more vivid reds, greens and oranges. CSS can now ask for those colors:

```css
.cta {
  background: #e4572e;                          /* sRGB fallback for old browsers */
  background: oklch(64% 0.23 35);               /* vivid orange; may be outside sRGB */
}

@media (color-gamut: p3) {
  .hero { background: color(display-p3 1 0.25 0.1); }   /* only on screens that can show it */
}
```

- On an sRGB screen, a color outside its gamut is mapped to the nearest color the screen can show, so the page still works.
- `oklch()` with a high chroma and `color(display-p3 ...)` are the two ways to write P3 colors. Both work in all major browsers since 2023.
- Check contrast against the sRGB fallback too: the WCAG 2 contrast formula is defined for sRGB.

### Special color keywords

- `transparent`: fully transparent (equal to `rgb(0 0 0 / 0)`).
- `currentColor`: the element's current `color` value. Useful for borders and SVG icons that should match the text: `border: 1px solid currentColor;`.

### Color contrast and accessibility

Text must contrast enough with its background to be readable. The WCAG guideline (level AA) asks for a contrast ratio of at least **4.5:1** for normal text and **3:1** for large text. The `colors.html` demo puts a green `hsl(130, 61%, 44%)` heading on a green `rgb(76, 125, 59)` background, which is below 2:1 and hard to read. Browser DevTools show the contrast ratio when you click a color in the Styles panel.

## Notes on the Demo Markup

> **Note:** `colors.html` puts an `<ol>` inside a `<p>`. A paragraph cannot contain a list, so the browser closes the `<p>` just before the `<ol>`, and the later `</p>` creates an extra empty paragraph. Use a `<div>`, or end the `<p>` before the list.

> **Note:** In `index.html`, `font-family: 'Honk', system-ui;;` has a double semicolon. The empty declaration is harmless (it is ignored), but it is a typo.

## Common Mistakes

- **No generic fallback** at the end of a font stack, so a missing font falls back to the browser default (often a serif).
- **Quoting a generic family** (`"sans-serif"`), which turns it into an unknown font name.
- **`@import` after other rules.** It is ignored unless it comes first.
- **Using a weight that was not loaded**, producing faux bold or faux italic.
- **Preloading a font without `crossorigin`**, so it is downloaded twice; or preloading every font file, which delays the CSS and the LCP image.
- **Setting one axis with `font-variation-settings`** and resetting the others by accident. Use `font-weight`/`font-stretch` for registered axes, and custom properties for the rest.
- **`text-overflow: ellipsis` without `white-space: nowrap` and `overflow: hidden`.** No "..." appears.
- **Using `opacity` to fade a background**, which also fades the text and children. Use an RGBA/HSLA background instead.
- **Treating HSL lightness as perceived lightness**, then getting uneven palettes and surprising contrast. Use `oklch()` for palettes.
- **Using `light-dark()` without `color-scheme: light dark`**, so it always returns the light value.
- **Low contrast** between text and background.

## Key Takeaways

- `font-family` takes a fallback stack; always end it with a generic family like `sans-serif`.
- Load web fonts with `<link>` + `preconnect`, or self-host WOFF2 files with `@font-face`; pick a `font-display` value on purpose, subset with `unicode-range`, and preload only the critical file (with `crossorigin`).
- A variable font covers a range of weights or widths in one file; use it when you need several styles.
- `text-decoration`, `text-transform`, `text-align` and `text-indent` handle most text styling; `text-transform` changes looks, not content. Ellipsis needs `white-space: nowrap`, `overflow: hidden` and `text-overflow: ellipsis` together.
- Colors can be keywords, hex, `rgb()`, `hsl()` or `oklch()`; `oklch()` is perceptually even and reaches wide-gamut colors.
- `color-mix()` and relative color syntax derive hover, tint and transparent variants from one token; `light-dark()` with `color-scheme` handles light and dark themes.
- RGBA/HSLA transparency affects one color; `opacity` affects the whole element. Check contrast: 4.5:1 for normal text, 3:1 for large text.

## Interview Questions

### Junior (0–1 year)

**Q1. What is a font stack and why does it end with a generic family?**
A font stack is the comma-separated list in `font-family`; the browser uses the first font that is available. Fonts may be missing on a device or fail to download, so the list ends with a generic family such as `sans-serif` or `serif`, which always resolves to some installed font. This keeps the page readable and close to the intended look.

**Q2. What is the difference between hex, RGB and HSL colors?**
They describe the same colors in different notations. Hex (`#4c7d3b`) and RGB (`rgb(76, 125, 59)`) both give red, green and blue amounts (hex in base 16, RGB in decimal 0 to 255). HSL (`hsl(105, 36%, 36%)`) gives hue, saturation and lightness, which makes it easier to create lighter, darker or less saturated variants by hand.

**Q3. What is the difference between `rgba(0, 0, 0, 0.5)` as a background and `opacity: 0.5`?**
An RGBA background makes only that background color semi-transparent; the text and child elements stay fully opaque. `opacity: 0.5` makes the whole element, including its text, borders and children, 50% transparent. For a see-through background with readable text, use RGBA/HSLA.

**Q4. In the demo, `.lorem` has `text-overflow: ellipsis` and `overflow: hidden`, but no "..." appears. Why?**
`text-overflow` only acts on text that overflows horizontally, and the paragraph's text simply wraps onto more lines inside the 145px box, so nothing overflows sideways. Adding `white-space: nowrap;` keeps the text on one line; it then overflows, `overflow: hidden` clips it and the ellipsis appears. All three properties are needed, plus a constrained width.

**Q5. What do `font-weight: normal` and `font-weight: bold` correspond to numerically?**
`normal` is 400 and `bold` is 700. Weights go from 100 (thin) to 900 (black). A weight only renders correctly if the font file for it is available; otherwise the browser picks the nearest weight or synthesizes bold.

**Q6. What does `text-transform: uppercase` do, and why use it instead of typing capitals?**
It displays the text in capital letters without changing the actual text in the HTML. Screen readers and copy/paste still get the original text, and the design can change later in CSS alone. Text typed in capitals may be read letter by letter by some screen readers.

### Mid-level (2–4 years)

**Q7. What are FOIT and FOUT, and how does `font-display` control them?**
FOIT (flash of invisible text) is when text is hidden while a web font downloads; FOUT (flash of unstyled text) is when text shows in a fallback font first and then switches. `font-display: swap` chooses FOUT: text is visible immediately in the fallback and swaps later, which is better for perceived performance. `block` gives a short invisible period, `fallback` and `optional` limit how long the browser will wait before keeping the fallback.

**Q8. Why is loading Google Fonts with `<link>` better than `@import` inside CSS?**
With `<link>` in the HTML, the browser discovers the font stylesheet while scanning the HTML and can fetch it in parallel with other resources. With `@import`, it must first download and parse the CSS that contains the import, which adds a sequential round trip before fonts start loading. Adding `<link rel="preconnect">` to `fonts.googleapis.com` and `fonts.gstatic.com` also sets up the connections early.

**Q9. Why is a unitless `line-height` recommended?**
A unitless value like `1.5` is inherited as a ratio, so each child computes its own line height from its own font size. A value with units like `1.5em` or `24px` is computed once on the parent and the resulting pixel value is inherited, so a child with larger text can get overlapping lines. Unitless values scale correctly everywhere.

**Q10. What is the difference between `word-break: break-all` and `overflow-wrap: anywhere`?**
`word-break: break-all` lets the browser break any word at any character to fill each line, even short words that would fit on the next line, which hurts readability. `overflow-wrap: anywhere` (or `break-word`) keeps normal word wrapping and only breaks a word when it is too long to fit on a line by itself, such as a long URL. The latter is usually the right choice for user content.

**Q11. A designer asks for gray text `#999` on a white background. What would you check?**
The contrast ratio. `#999` on white is roughly 2.8:1, below the WCAG AA minimum of 4.5:1 for normal text, so it fails accessibility guidelines. Suggest a darker gray (around `#767676` or darker reaches 4.5:1) or reserve the light gray for large text and non-essential decoration. DevTools and contrast checkers show the ratio.

**Q12. How can `currentColor` and HSL simplify theming?**
`currentColor` makes borders, outlines, box shadows and SVG `fill` follow the element's text color, so changing `color` once updates the whole component. HSL makes variants predictable: keeping hue and saturation and only changing lightness gives consistent hover, active and disabled shades. Combined with CSS custom properties (for example `--brand-h: 130`), a whole theme can be changed from a few variables.

**Q13. A palette built in HSL with the same lightness for every hue looks uneven, and white text passes contrast on some swatches but not others. Why, and what would you use instead?**
HSL lightness is a simple formula on RGB values, not perceived brightness: at `50%` lightness, yellow and cyan look much lighter than blue or purple, so their contrast with white is very different. `oklch()` uses a perceptual model, so swatches with the same L look about equally light and have similar contrast against the same text color. Define the palette in `oklch()` (keeping L fixed per step and varying hue and chroma), and still verify contrast with a checker, since equal L is close to, but not exactly, equal WCAG contrast.

### Senior (5+ years)

**Q14. Your product has strict LCP and CLS budgets and currently loads four Google Fonts families. How would you design the font-loading strategy?**
Start with an inventory: which families, weights and styles render above the fold on key pages. Usually one family in two or three weights is enough; cut the rest or use `system-ui` for secondary UI. Self-host WOFF2 files: browsers partition their HTTP cache per site, so a third-party font CDN no longer gives a shared-cache benefit, it costs extra connections, and sending visitor IPs to a third party has caused GDPR problems in the EU. Subset the files (`unicode-range`, or a subsetting tool), serve them with long-lived cache headers and hashed names, and preload only the one or two faces used above the fold, with `crossorigin`.

Then choose `font-display` per role: `optional` for body text when CLS matters most (no late swap; the cached font is used on the next page), `swap` for brand headings that must appear in the web font, combined with a metric-adjusted fallback (`size-adjust` and the `*-override` descriptors, generated by tooling) so the swap barely moves anything. Recommendation: fewer faces, self-hosted subset WOFF2, one or two preloads, `optional` or metric-matched `swap`, and verify with field CLS/LCP data rather than one lab run.

**Q15. You are designing the color system for a design system that needs light and dark themes and per-customer brand colors. What is your approach?**
Two layers of tokens. **Primitive** tokens are palette scales defined in `oklch()`, so each step has even, predictable lightness across hues. **Semantic** tokens (`--color-text`, `--color-surface`, `--color-accent`, `--color-accent-hover`) map to primitives per theme, and components use only semantic tokens. Light and dark come from `color-scheme` with `light-dark()` or from swapping the semantic layer under a theme selector; a customer brand is one input color from which hover, pressed and subtle variants are derived with relative color syntax or `color-mix(in oklch, ...)`.

The risk is that derived colors are no longer reviewed by a human, so automate checks: a CI test that computes WCAG contrast for every text/background token pair in every theme and fails the build below 4.5:1 (3:1 for large text and UI parts). For browsers older than 2024, generate the derived values at build time or provide static fallbacks before the relative-color declarations. Recommendation: oklch primitives, semantic tokens, derived states, and contrast tests in CI rather than manual spot checks.

**Q16. The app is launching in Japanese and Arabic. What changes in your typography CSS?**
Your Latin web font has no glyphs for these scripts, so the browser falls back per character to whatever system font it finds. Set the `lang` attribute correctly (Chinese, Japanese and Korean share code points but use different glyph shapes per language) and give each script an explicit stack with `:lang()`, for example `:lang(ja) { font-family: "Noto Sans JP", system-ui, sans-serif; }`. CJK fonts are several megabytes, so either rely on system fonts or use a host that slices them into many `unicode-range` subsets.

Several Latin habits break: `text-transform` and italics mean nothing in CJK (add `font-synthesis: none` to stop fake italics and bold), `letter-spacing` can break the joined letters of Arabic, and scripts with tall marks need a more generous `line-height` and no fixed text-box heights. Arabic is right-to-left, so use `dir="rtl"` and logical properties (`margin-inline-start`, `text-align: start`) throughout. Recommendation: per-language font stacks keyed on `lang`, system or sliced fonts for CJK, logical properties everywhere, and visual review by native readers.

**Q17. Should the design system switch from four static font files to one variable font?**
Measure before deciding. A variable font is one request, allows any weight (useful for fine-tuning, such as slightly lighter text in dark mode), animates weight smoothly and can include optical sizing. But the file is larger than any one static weight, so if pages use only two weights, two subset static files can be smaller; the break-even is usually around three weights or styles, and italics often come as a second variable file.

If the numbers favour it, roll it out carefully: one `@font-face` with a weight range, design tokens mapped to numeric weights, a lint rule that blocks raw `font-variation-settings` for registered axes (use `font-weight` and `font-stretch`), and visual regression tests, because glyph rendering changes slightly. Recommendation: switch when you use three or more styles and the subset variable file is not larger than the statics it replaces.

> **Note:** Related questions answered elsewhere: [Overflow and Scrolling](../10-overflow-and-scrolling/notes.md#interview-questions) (limiting text to three lines with an ellipsis).

## References

- [CodeWithHarry: CSS Fonts](https://www.codewithharry.com/tutorial/css-fonts/)
- [CodeWithHarry: CSS Colors](https://www.codewithharry.com/tutorial/css-colors/)
- [CodeWithHarry: CSS Text Styling](https://www.codewithharry.com/tutorial/css-text-styling/)
- [CodePen (web.dev): fonts demo, linked in index.html](https://codepen.io/web-dot-dev/pen/yLojraG)
- [CodePen (web.dev): colors demo, linked in colors.html](https://codepen.io/web-dot-dev/pen/ZELGraM)
- [Google Fonts](https://fonts.google.com)
- [MDN: font-family](https://developer.mozilla.org/en-US/docs/Web/CSS/font-family)
- [MDN: @font-face](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face)
- [MDN: font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
- [MDN: unicode-range](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range)
- [MDN: Variable fonts guide](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_fonts/Variable_fonts_guide)
- [web.dev: Best practices for fonts](https://web.dev/articles/font-best-practices)
- [MDN: text-overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow)
- [MDN: color values](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value)
- [MDN: oklch()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch)
- [MDN: color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix)
- [MDN: Using relative colors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors)
- [MDN: light-dark()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)
- [Chrome for Developers: High definition CSS color guide](https://developer.chrome.com/docs/css-ui/high-definition-css-color-guide)
- [web.dev: Learn CSS - Typography](https://web.dev/learn/css/typography)
- [web.dev: Learn CSS - Color](https://web.dev/learn/css/color)
