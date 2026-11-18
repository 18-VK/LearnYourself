# Styling Lists in CSS

> CSS · Topic 9 · Demo: [index.html](index.html)

Lists (`<ul>`, `<ol>`) are everywhere on the web: navigation menus, feature lists, steps, sidebars. CSS gives you a small family of `list-style-*` properties to change the bullet or number (the "marker"), where it sits, or replace it with an image, the `::marker` pseudo-element to style it directly, and CSS counters and `@counter-style` for custom numbering. The HTML side of lists is in [Lists, tables and images](../../01-html/04-lists-tables-images/notes.md).

## What the browser gives you by default

Before you write any CSS, a list already has some built-in styling from the browser's default stylesheet:

| Element | Default marker | Default spacing |
| --- | --- | --- |
| `<ul>` | `disc` (filled circle) | `padding-left: 40px` (logically `padding-inline-start`), `margin: 1em 0` |
| `<ul>` nested one level | `circle` (hollow) | same |
| `<ul>` nested two+ levels | `square` | same |
| `<ol>` | `decimal` (1, 2, 3) | same |

Each `<li>` has `display: list-item`. That display value is what makes a marker appear. The `list-style-*` properties only do something on elements with `display: list-item`.

> **Note:** The `list-style-*` properties are **inherited**. You can set them on the `<ul>`/`<ol>` and every `<li>` inside picks them up. The demo sets them directly on `nav ul li`, which works too.

## The list properties at a glance

| Property | What it controls | Default |
| --- | --- | --- |
| `list-style-type` | The shape of the marker (disc, number, roman, a custom string, `none`) | `disc` |
| `list-style-position` | Whether the marker sits outside or inside the `<li>` box | `outside` |
| `list-style-image` | Use an image as the marker | `none` |
| `list-style` | Shorthand for all three | — |

## `list-style-type`

Sets the marker style.

```css
ul { list-style-type: square; }
ol { list-style-type: upper-roman; }
.no-bullets { list-style-type: none; }
```

Common values:

| Value | Looks like |
| --- | --- |
| `disc` | filled circle (default for `ul`) |
| `circle` | hollow circle |
| `square` | filled square |
| `decimal` | 1, 2, 3 (default for `ol`) |
| `decimal-leading-zero` | 01, 02, 03 |
| `lower-alpha` / `upper-alpha` | a, b, c / A, B, C |
| `lower-roman` / `upper-roman` | i, ii, iii / I, II, III |
| `lower-greek` | α, β, γ |
| `devanagari` | Devanagari digits: १, २, ३ (used in the demo) |
| `none` | no marker |
| `"any string"` | that exact string as the marker |

The demo uses `list-style: devanagari;`, so the menu items are numbered १, २, ३ even though it is a `<ul>`. A `<ul>` is not limited to bullets and an `<ol>` is not limited to numbers: the type is just a style.

### String markers

You can pass any string in quotes. The demo has a commented-out line that uses an emoji string as the bullet. Any character works:

```css
li { list-style-type: "-> "; }
li { list-style-type: "\2713  "; }   /* a check mark via a Unicode escape */
```

> **Note:** Add a trailing space inside the string, otherwise the marker touches the text.

## `list-style-position`

Decides where the marker is placed relative to the `<li>`'s box.

| Value | Behaviour |
| --- | --- |
| `outside` (default) | The marker hangs outside the `<li>` box, to the left. Wrapped lines line up with the first line of text, not with the marker. |
| `inside` | The marker becomes the first inline piece of content inside the `<li>`. Wrapped lines start under the marker. |

The demo puts `border: 2px solid black` on every `<li>` exactly so you can see this:

- With `outside`, the number/bullet appears **outside** the black border.
- With `inside` (the commented `list-style-position: inside;`), the marker moves **inside** the border.

```css
li {
  border: 2px solid black;
  list-style-position: inside;
}
```

Adding `background-color: yellow` (also commented in the demo) shows the same thing: the background covers an `inside` marker but not an `outside` one.

## `list-style-image`

Uses an image as the marker.

```css
li {
  list-style-image: url("https://user-images.githubusercontent.com/14011726/94132137-7d4fc100-fe7c-11ea-8512-69f90cb65e48.gif");
}
```

That is the animated GIF used in the demo.

- If the image fails to load, the browser falls back to `list-style-type`.
- You **cannot resize or reposition** the image with this property. A large image gives a huge bullet.

For a bullet whose size and position you control, hide the marker and draw your own with `::before` (see below), or use a `background-image` on the `<li>`.

## The `list-style` shorthand

Sets type, position and image in one line. The values can come in any order and any of them can be left out.

```css
li { list-style: devanagari; }                       /* demo: type only */
li { list-style: square inside; }                    /* type + position */
li { list-style: disc inside url("bullet.gif"); }    /* all three (as in the demo) */
li { list-style: none; }                             /* remove markers */
```

> **Note:** Like every shorthand, values you leave out are reset to their initial value. `list-style: square;` also resets `list-style-image` to `none` and `list-style-position` to `outside`.

## Styling the marker itself with `::marker`

`::marker` selects the bullet or number of a list item. Use it when you want to change only the marker, for example its colour, without touching the text.

```css
li::marker {
  color: crimson;
  font-weight: bold;
}

ol li::marker {
  content: counter(list-item) ") ";   /* 1) 2) 3) */
}
```

Only a limited set of properties work on `::marker`: `color`, the `font-*` properties, `content`, `white-space`, and a few animation/transition properties. You cannot give it padding, margins or a background.

> **Note:** Safari's `::marker` support is partial (mainly `color` and `font-size`). If you need a custom marker that looks the same everywhere, use the `::before` technique below.

## Custom bullets with `::before`

The most flexible approach: remove the default marker and draw your own.

```css
.checklist {
  list-style: none;
  padding-left: 0;
}

.checklist li {
  position: relative;
  padding-left: 1.5em;
}

.checklist li::before {
  content: "\2713";          /* check mark */
  position: absolute;
  left: 0;
  color: green;
}
```

You can size, colour, position and even animate this pseudo-element like any other box.

> **Note:** `padding-left` and `left: 0` keep the bullet on the left even in a right-to-left page. Write `padding-inline-start` and `inset-inline-start: 0` instead, and the custom bullet flips with `dir="rtl"` just like a native marker.

## Custom numbering with CSS counters

For numbering like "Step 1:", "Step 2:", use counters:

```css
ol.steps {
  list-style: none;
  counter-reset: step;           /* create a counter named "step" starting at 0 */
}

ol.steps li {
  counter-increment: step;       /* +1 for every li */
}

ol.steps li::before {
  content: "Step " counter(step) ": ";
  font-weight: bold;
}
```

### Nested numbering with `counters()`

`counter()` prints the innermost value; `counters()` joins the values of all nested levels with a separator, which gives outline numbering:

```css
ol.outline {
  list-style: none;
  counter-reset: item;            /* every nested <ol> starts a new level */
}

ol.outline > li {
  counter-increment: item;
}

ol.outline > li::before {
  content: counters(item, ".") " ";   /* 1, 1.1, 1.2, 1.2.1, 2 ... */
}
```

### Custom counter styles with `@counter-style`

When none of the built-in `list-style-type` values fit, define your own and use it like any keyword. It keeps working with `::marker`, `start` and `reversed`:

```css
@counter-style circled-alpha {
  system: fixed;
  symbols: Ⓐ Ⓑ Ⓒ Ⓓ Ⓔ;
  suffix: " ";
}

ol.choices {
  list-style-type: circled-alpha;   /* Ⓐ Ⓑ Ⓒ, then decimal after Ⓔ */
}
```

`system` decides how symbols are used (`cyclic`, `fixed`, `numeric`, `alphabetic`, `symbolic`, `additive`), and a style falls back to `decimal` when it runs out of symbols. `@counter-style` works in all major browsers since 2023.

## Turning a list into a navigation bar

Navigation menus are almost always a `<ul>` inside a `<nav>`, exactly like the demo. A horizontal menu needs three things: remove the markers, remove the default indent, and lay the items out in a row.

```css
nav ul {
  list-style: none;   /* no bullets */
  margin: 0;
  padding: 0;         /* remove the default 40px indent */
  display: flex;      /* items side by side */
  gap: 1rem;
}
```

> **Note:** In Safari, VoiceOver may stop announcing a list as a list once `list-style: none` is applied. If the "list of 3 items" announcement matters, add `role="list"` to the `<ul>`.

## Useful HTML attributes on ordered lists

These are HTML, not CSS, but they pair with list styling:

```html
<ol start="5">          <!-- start counting at 5 -->
<ol reversed>           <!-- count down: 3, 2, 1 -->
<ol type="A">           <!-- A, B, C (CSS list-style-type overrides this) -->
<li value="10">         <!-- this item becomes 10, the next ones continue from 11 -->
```

## Common Mistakes

- **Removing bullets but not the indent.** `list-style: none` removes the marker, but the `<ul>`'s default `padding-left` stays, so the list still looks indented. Reset `padding` (and usually `margin`) too.
- **Expecting `list-style-image` to be resizable.** It cannot be resized. Use `::before` or a background image.
- **Applying `list-style` to a `<div>`.** It does nothing unless the element has `display: list-item`.
- **Overwriting values with the shorthand.** `list-style: square` written after `list-style-image: url(...)` resets the image to `none`.
- **Confusing `inside` and `outside`.** Put a border on the `<li>` (as the demo does) to see where the marker really is.
- **Positioning custom bullets with `left`/`padding-left`**, which breaks in right-to-left languages. Use logical properties.
- **Putting meaningful numbers or words only in CSS `content`.** Generated text is usually not copied or found by find-in-page, and translation pipelines never see it.

## Key Takeaways

- Markers only appear on elements with `display: list-item` (every `<li>` by default).
- `list-style-type` picks the marker (including custom strings and `none`), `list-style-position` puts it `outside` (default) or `inside` the box, and `list-style-image` swaps in an image.
- `list-style` is a shorthand in any order; omitted parts reset to defaults.
- List properties are inherited, so you can set them once on the `<ul>`/`<ol>`.
- `::marker` styles the marker's colour and font without touching the text.
- For full control (size, position, icons), use `list-style: none` + `::before`.
- CSS counters (`counter-reset`, `counter-increment`, `counter()`/`counters()`) and `@counter-style` handle custom and nested numbering.
- For nav menus, reset `list-style`, `margin` and `padding`, then use flexbox.

## Interview Questions

### Junior (0–1 year)

**Q1. How do you remove the bullets from an unordered list?**
Set `list-style: none` (or `list-style-type: none`) on the `<ul>` or its `<li>` elements. Usually you also reset `padding: 0; margin: 0;` on the `<ul>`, because the default left padding is still there after the bullets are gone.

**Q2. What is the difference between `list-style-position: inside` and `outside`?**
With `outside` (the default), the marker hangs outside the `<li>` box and wrapped lines align with the text. With `inside`, the marker is placed inside the box as the first inline content, so it sits inside any border or background and wrapped lines start under the marker.

**Q3. What does `list-style: square inside;` set?**
It is the shorthand: `list-style-type: square`, `list-style-position: inside`, and, because it was omitted, `list-style-image: none`. Shorthands reset any sub-property you do not mention.

**Q4. How do you use an image as a bullet, and what is the limitation?**
Use `list-style-image: url("icon.png")`. The limitation is that you cannot control its size or alignment. For full control, set `list-style: none` and add the icon with `li::before` or a background image.

**Q5. What are the default markers for `<ul>` and `<ol>`, and what happens with nested lists?**
`<ul>` uses `disc` and `<ol>` uses `decimal`. Browsers change the bullet of nested `<ul>`s: `circle` at the second level and `square` at the third and deeper.

### Mid-level (2–4 years)

**Q6. How would you make the bullets red while keeping the text black?**
Use the `::marker` pseudo-element: `li::marker { color: red; }`. Before `::marker`, the usual trick was `list-style: none` plus a red `::before` bullet, which still works and gives more control (size, position) when `::marker`'s limited property set is not enough.

**Q7. Write the CSS to turn `<nav><ul><li>...</li></ul></nav>` into a horizontal menu.**
```css
nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 1.5rem;
}
nav a { text-decoration: none; }
```
Flexbox lays the `<li>`s in a row, and the resets remove the bullets and the default indent.

**Q8. After adding `list-style: none`, a screen-reader user says your list is no longer announced as a list. Why, and how do you fix it?**
Safari with VoiceOver drops list semantics from lists that have no visible markers. Adding `role="list"` to the `<ul>`/`<ol>` restores them. It is a deliberate WebKit behaviour, so this is a known fix rather than a hack.

**Q9. How do you produce numbering like "Step 1:", "Step 2:" in CSS?**
Use CSS counters: `counter-reset: step` on the list, `counter-increment: step` on each `<li>`, and `content: "Step " counter(step) ": "` in `li::before` (with `list-style: none` to hide the default numbers). Ordered lists also have a built-in counter called `list-item` that you can use in `::marker` or `::before`.

**Q10. A teammate put `list-style-type: square` on a `<div class="item">` and nothing appeared. What is wrong?**
Markers are generated only for elements with `display: list-item`. A `<div>` is `display: block`, so the property is ignored. Either use real `<ul>/<li>` markup (better for accessibility) or set `display: list-item` on the div.

### Senior (5+ years)

**Q11. You are building a `List` component for a design system with plain, bulleted, numbered and checklist variants. How do you design it?**
Keep semantics and looks independent. The component always renders a real `<ul>` or `<ol>`, chosen by whether the order matters (steps, rankings) and not by whether numbers are shown; the visual variant is a separate prop. Bullets and numbers come from `list-style-type` and `::marker`, which assistive technology understands; icon markers (the checklist) come from `::before`, but the state they show ("done", "not done") must also be in text or ARIA, because a glyph alone means nothing to a screen reader.

Build it with logical properties (`padding-inline-start`, `inset-inline-start`) so right-to-left locales work, let nested lists inherit sensible markers, and add `role="list"` automatically only in the variants that remove markers, so VoiceOver keeps announcing them as lists. Recommendation: an `as="ul" | "ol"` prop for meaning, a `variant` prop for looks, and no `div`-based lists anywhere in the library.

**Q12. A legal-documents page needs nested clause numbers like 4.2.1 that users quote in emails and that screen readers must read. Would you generate them with CSS counters?**
CSS can draw them: `counter-reset` on each `<ol>`, `counter-increment` on each `<li>`, and `content: counters(clause, ".")` in `::before` or `::marker`. But generated content is presentation, not text: it is usually left out when users copy, find-in-page cannot find "4.2.1", screen readers announce it inconsistently, and you cannot link to it.

Here the numbers are content: people reference them, and they must not change if the CSS fails to load. Generate them in the HTML (on the server or at build time), give each clause an `id` such as `clause-4-2-1` for deep links, and turn the native markers off. Recommendation: CSS counters for decorative numbering (steps in a tutorial, figure numbers), real text for numbers that carry meaning.

**Q13. The product is being localised into Arabic and Hindi. What can go wrong with list styling, and how do you prevent it?**
Native lists mostly just work: with `dir="rtl"` the marker moves to the right, and the browser's default indent is `padding-inline-start`. Custom bullets break: `padding-left` and `left: 0` keep them on the wrong side, and directional string markers such as `"→ "` point the wrong way (swap them with `:dir(rtl)`). Words inside CSS `content` ("Step " in a counter) never reach the translation pipeline, so they stay in English.

Numbering style is a locale decision, not a hard-coded one: the demo's `devanagari` digits or `arabic-indic` can be applied per language with `:lang(hi) ol { list-style-type: devanagari; }`, but many Hindi and Arabic interfaces use Western digits, so make it configurable with product and localisation teams. Recommendation: logical properties everywhere, no user-facing words in CSS, locale-driven `list-style-type`, and RTL visual tests (for example a pseudo-locale) in CI.

## References

- [MDN: list-style](https://developer.mozilla.org/en-US/docs/Web/CSS/list-style)
- [MDN: list-style-type](https://developer.mozilla.org/en-US/docs/Web/CSS/list-style-type)
- [MDN: list-style-position](https://developer.mozilla.org/en-US/docs/Web/CSS/list-style-position)
- [MDN: list-style-image](https://developer.mozilla.org/en-US/docs/Web/CSS/list-style-image)
- [MDN: ::marker](https://developer.mozilla.org/en-US/docs/Web/CSS/::marker)
- [MDN: Using CSS counters](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_counter_styles/Using_CSS_counters)
- [MDN: @counter-style](https://developer.mozilla.org/en-US/docs/Web/CSS/@counter-style)
- [web.dev Learn CSS: Lists](https://web.dev/learn/css/lists)
