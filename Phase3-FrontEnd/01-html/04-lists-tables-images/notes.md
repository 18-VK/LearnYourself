# Images, Lists and Tables

> HTML · Topic 4 · Demo: [index.html](index.html)

Images, lists and tables are the three most common ways to present content beyond plain paragraphs. The demo shows a Doraemon picture (`doremon_img.jpg`), a table that uses `colspan`/`rowspan`, unordered, ordered and definition lists.

## Images: `<img>`

```html
<img height="450" width="300" src="doremon_img.jpg" alt="Doremon">
```

`<img>` is a **void element** (no closing tag) and an **inline** element, so it sits in a line of text unless CSS changes that. The `src` and `alt` attributes are essential for the `<img>` tag to work properly.

| Attribute | Purpose |
|-----------|---------|
| `src` | Path or URL of the image file. Required. |
| `alt` | Text description of the image. Read aloud by screen readers, shown if the image fails to load, and used by search engines. |
| `width`, `height` | Display size in CSS pixels, written **without units** (`width="300"`, not `"300px"`). |
| `loading="lazy"` | Delays loading off-screen images until the user scrolls near them. |
| `srcset`, `sizes` | Offer several file sizes so the browser can pick the best one for the screen. |

### Writing good `alt` text

- Describe what the image shows **in context**: `alt="Doraemon waving, smiling"` is more useful than `alt="image"`.
- Do not start with "Image of..."; screen readers already announce it as an image.
- For purely decorative images, use an **empty** `alt=""` so screen readers skip it. Leaving `alt` out entirely is different: some screen readers then read the file name ("doremon underscore img dot jpg").

### Why `width` and `height` matter

The browser does not know an image's size until it downloads it. If you set `width` and `height`, it reserves the right amount of space immediately, so the text below does not jump when the image arrives. That jump is measured as **Cumulative Layout Shift (CLS)**, a Core Web Vital (see [SEO and Core Web Vitals](../10-seo-and-core-web-vitals/notes.md)).

> **Note:** Keep the original aspect ratio. `doremon_img.jpg` is 599 x 709 pixels, but the demo displays it at 300 x 450, so it is stretched vertically. Either use matching numbers (300 x 355), or set both attributes for space-reservation and then let CSS scale it: `img { max-width: 100%; height: auto; }`.

### Image formats

| Format | Best for |
|--------|----------|
| JPEG (`.jpg`) | Photos; small files, no transparency |
| PNG | Screenshots, graphics needing transparency; larger files |
| WebP / AVIF | Modern replacements for both; much smaller files |
| SVG | Logos, icons, illustrations; vector, sharp at any size |
| GIF | Simple animations (a video is usually smaller) |

### Images with captions

```html
<figure>
    <img src="doremon_img.jpg" alt="Doraemon standing with his hands raised" width="300" height="355">
    <figcaption>Doraemon, the robot cat from the 22nd century.</figcaption>
</figure>
```

## Lists

HTML provides three types of list. Each list contains one or more items.

| List | Tag | Item tag | Displays |
|------|-----|----------|----------|
| Unordered | `<ul>` | `<li>` | Bullets; order does not matter |
| Ordered | `<ol>` | `<li>` | Numbers, letters or Roman numerals; order matters |
| Description (definition) | `<dl>` | `<dt>` term + `<dd>` description | Dictionary-like pairs |

### Unordered list

```html
<ul type="square"> <!-- disc by default -->
    <li>apple</li>
    <li>orange</li>
    <li>Banana</li>
</ul>
```

The default bullet is a filled circle (`disc`); other shapes are `circle` and `square`.

> **Note:** `type` on `<ul>` is obsolete in HTML5 (browsers still honour it). Change bullets with CSS instead: `ul { list-style-type: square; }`. `list-style-type: none` removes them, which is how navigation menus are built from lists. (Safari then stops announcing the element as a list; Q15 below explains the `role="list"` fix.)

### Ordered list

```html
<ol type="a">
    <li>apple</li>
    <li>orange</li>
    <li>Banana</li>
</ol>
<!-- → a. apple   b. orange   c. Banana -->
```

| Attribute | Example | Effect |
|-----------|---------|--------|
| `type` | `1` (default), `a`, `A`, `i`, `I` | Arabic numbers, lower/upper-case letters, lower/upper-case Roman numerals |
| `start` | `start="5"` | Begin counting at 5 |
| `reversed` | `reversed` | Count downwards |
| `value` (on `<li>`) | `<li value="10">` | Set this item's number; the following items continue from it |

`type` *is* valid on `<ol>`, because the numbering style can be part of the meaning (for example legal clauses "a, b, c").

```html
<ol type="i">
    <li>apple</li>
    <li>orange</li>
    <li>Banana</li>
</ol>
<!-- → i. apple   ii. orange   iii. Banana -->
```

### Description list

```html
<dl>
    <dt>HTML</dt>
    <dd>HyperText Markup Language: The standard language for creating web pages.</dd>

    <dt>CSS</dt>
    <dd>Cascading Style Sheets: A stylesheet language used for describing the look and formatting of a document written in HTML.</dd>

    <dt>JavaScript</dt>
    <dd>A programming language commonly used in web development to add interactive features.</dd>
</dl>
```

Browsers indent each `<dd>` under its `<dt>`. Use it for glossaries, FAQs and metadata (`Author: ...`, `Published: ...`).

### Nesting lists

A nested list goes **inside an `<li>`**, never directly inside `<ul>`/`<ol>`:

```html
<ul>
    <li>Fruits
        <ul>
            <li>apple</li>
            <li>orange</li>
        </ul>
    </li>
</ul>
```

## Tables

HTML tables arrange data such as text, images and links in rows and columns. Use them for **tabular data** (timetables, price lists, results), not for page layout.

| Tag | Meaning |
|-----|---------|
| `<table>` | The table itself; starts and ends it |
| `<tr>` | Table row |
| `<th>` | Header cell (bold and centred by default) |
| `<td>` | Data cell |
| `<caption>` | Title of the table, first child of `<table>` |
| `<thead>`, `<tbody>`, `<tfoot>` | Group header rows, body rows and footer rows |

A complete, well-structured table:

```html
<table>
    <caption>Players</caption>
    <thead>
        <tr>
            <th scope="col">Name</th>
            <th scope="col">Age</th>
            <th scope="col">Fav food</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Aman</td>
            <td>20</td>
            <td>pizza</td>
        </tr>
    </tbody>
</table>
```

`scope="col"` tells screen readers that a header applies to its column (`scope="row"` for row headers). If you leave out `<tbody>`, the browser inserts one into the DOM anyway.

### Spanning cells: `colspan` and `rowspan`

- **`colspan="n"`** makes a cell stretch across `n` columns.
- **`rowspan="n"`** makes a cell stretch down `n` rows. The rows below must then have one fewer cell, because the space is already taken.

The demo's table:

```html
<tr><th>Name</th><th>Age</th><th>Fav food</th></tr>
<tr><td>Aman</td><td>20</td></tr>
<tr>
    <td colspan="2">Sarthak</td>
    <td rowspan="2">25</td>
    <td>sandwich</td>
</tr>
<tr><td>Chaman</td></tr>
```

How the browser lays it out (the demo has no border, which is why the comment says you will only "see the diff" once a border is added):

| col 1 | col 2 | col 3 | col 4 |
|-------|-------|-------|-------|
| **Name** | **Age** | **Fav food** | |
| Aman | 20 | | |
| Sarthak (spans cols 1–2) | | 25 (spans rows 3–4) | sandwich |
| Chaman | | (25 continues) | |

Row 3 needs 2 + 1 + 1 = **4 columns**, so the whole table becomes 4 columns wide, and "25" ends up under "Fav food". The demo is a span experiment, but in a real table every row must add up to the same number of columns (counting spans) so the data lines up under its headings.

### Adding borders (CSS)

```css
table, th, td {
    border: 1px solid black;
}
table {
    border-collapse: collapse; /* merge double borders into one */
}
th, td {
    padding: 8px;
}
```

## Common Mistakes

- **Missing or useless `alt`** (`alt="image"`, `alt="photo123.jpg"`) — fails accessibility checks and gives search engines nothing.
- **Width/height that do not match the aspect ratio** — the image is distorted (as in the demo).
- **Writing units in the attributes** (`width="300px"`) — the attribute takes a bare number; use CSS for other units.
- **Content directly inside `<ul>`/`<ol>`** — only `<li>` (and script-supporting elements) may be direct children; nested lists go inside an `<li>`.
- **Rows that do not add up** — forgetting that a `rowspan` cell occupies space in the rows below shifts every following cell.
- **Using tables for layout** — confuses screen readers and is hard to make responsive; use CSS Flexbox or Grid.
- **Using `<th>` just to get bold text** — `<th>` means "header"; use CSS for styling.

## Key Takeaways

- `<img>` needs `src` and a meaningful `alt` (`alt=""` for decorative images).
- Set `width` and `height` with the real aspect ratio to prevent layout shift; scale with `max-width: 100%; height: auto;`.
- `<ul>` for unordered items, `<ol>` when order matters (`type`, `start`, `reversed`), `<dl>`/`<dt>`/`<dd>` for term–description pairs.
- Style bullets with CSS `list-style-type`, not the obsolete `type` attribute on `<ul>`.
- Tables are for data: `<table>`, `<tr>`, `<th>`, `<td>`, plus `<caption>`, `<thead>`, `<tbody>` and `scope` for accessibility.
- `colspan` merges across columns, `rowspan` merges down rows; every row must add up to the same column count.

## Interview Questions

### Junior (0–1 year)

**Q1. Why is the `alt` attribute important on images?**
Screen readers read it to blind users, the browser shows it if the image fails to load, and search engines use it to understand the image. Decorative images should have `alt=""` so assistive technology skips them.

**Q2. What is the difference between `<ul>`, `<ol>` and `<dl>`?**
`<ul>` is a bulleted list where order does not matter, `<ol>` is a numbered list where order matters, and `<dl>` is a description list of terms (`<dt>`) and their descriptions (`<dd>`), like a glossary.

**Q3. What is the difference between `colspan` and `rowspan`?**
`colspan` makes a cell span several columns horizontally; `rowspan` makes it span several rows vertically. With `rowspan`, the rows below must contain fewer cells because that column is already occupied.

**Q4. What is the difference between `<th>` and `<td>`?**
`<th>` is a header cell that labels a row or column; browsers render it bold and centred, and screen readers announce it when reading the related data cells. `<td>` is an ordinary data cell.

**Q5. What does this render?**

```html
<ol start="5" reversed>
  <li>Plan</li>
  <li>Build</li>
  <li>Ship</li>
</ol>
```

`5. Plan`, `4. Build`, `3. Ship`. `start` sets the first number and `reversed` makes the list count down.

**Q6. How do you change list bullets to squares, or remove them?**
With CSS: `ul { list-style-type: square; }` or `list-style-type: none;`. The `type` attribute on `<ul>` still works in browsers but is obsolete; on `<ol>`, `type` is still valid because numbering can carry meaning.

### Mid-level (2–4 years)

**Q7. Why should you set `width` and `height` on `<img>` even when CSS resizes the image?**
Modern browsers compute the aspect ratio from those attributes and reserve the correct space before the file downloads. Without them the content below jumps when the image loads, which increases Cumulative Layout Shift. Pair them with `max-width: 100%; height: auto;` so the image stays responsive.

**Q8. When would you not use `loading="lazy"` on an image?**
Not on images visible in the first screen, especially the hero image that is often the Largest Contentful Paint element: lazy-loading delays it and worsens LCP. Use it for images further down the page. For the hero image you can instead add `fetchpriority="high"`.

**Q9. How do you make a data table accessible?**
Add a `<caption>` describing the table, use `<th>` for headers with `scope="col"` or `scope="row"`, group rows with `<thead>`/`<tbody>`/`<tfoot>`, and avoid complex merged cells where possible. For very complex headers, use `id` on the `<th>` and `headers="..."` on the `<td>`. Never use tables for layout.

**Q10. A colleague's table has data showing under the wrong headings. What do you check?**
Count the columns each row occupies, including `colspan`, and account for any cell above with `rowspan` that reaches into the row. In this note's demo, the third row needs four columns (a `colspan="2"` cell plus two more cells), so the table grows to four columns and "25" lands under "Fav food". Every row must add up to the same total.

**Q11. What is the difference between `srcset`/`sizes` and the `<picture>` element?**
`srcset` with `sizes` lists the same image at different resolutions and lets the browser choose the most efficient file for the screen size and pixel density. `<picture>` with `<source>` elements gives you control: you can serve different formats (AVIF, then WebP, then JPEG as fallback) or different crops for different media queries (art direction). The inner `<img>` is still required and carries the `alt`.

**Q12. Why is using `<table>` for page layout considered bad practice?**
Screen readers announce tables as data and read row/column information that makes no sense for layout, the markup is heavy and hard to maintain, and tables cannot easily rearrange for small screens. CSS Grid and Flexbox do layout without misrepresenting the content.

### Senior (5+ years)

**Q13. Images are most of your page weight and LCP is poor across a large site. How would you set up image handling so every team gets it right by default?**
Make the right thing the default instead of a checklist:

- **An image service or CDN** that resizes and converts on request (`/img/hero.jpg?w=800&format=auto`) and serves AVIF or WebP based on the browser's `Accept` header, so nobody exports sizes by hand.
- **One `Image` component** that requires `alt`, `width` and `height` (so space is always reserved), generates `srcset` from the service, asks for `sizes`, and defaults to `loading="lazy"` and `decoding="async"`. A `priority` prop for the LCP image turns lazy loading off and adds `fetchpriority="high"`.
- **Guard rails**: a lint rule that bans a raw `<img>` outside the component, a performance budget in CI (for example Lighthouse CI), and real-user LCP and CLS monitoring per page template so regressions show up where they happen.

Recommendation: a central image service plus one component with safe defaults. Most frameworks ship such a component (`next/image`, Angular's `NgOptimizedImage`), so adopt it rather than build one. The metrics themselves are covered in [SEO and Core Web Vitals](../10-seo-and-core-web-vitals/notes.md).

**Q14. A report table has 20 columns and thousands of rows, and it must work on phones and with screen readers. What are your options and their trade-offs?**
Keep a real `<table>`. Rebuilding it from `<div>`s loses the row and column announcements unless you add the full set of ARIA table roles yourself.

- **Narrow screens**: wrap the table in a scroll container (`overflow-x: auto`) with `tabindex="0"`, `role="region"` and an `aria-label`, so keyboard users can scroll it and screen readers name it. Make the header row and first column `position: sticky` so the context stays visible; the container becomes the scroll container for both axes, so give it a `max-height` or the sticky header never sticks. Reflowing rows into "cards" with CSS reads well, but changing `display` on table elements has removed table semantics in some browsers, so you then have to add `role="table"`, `row` and `cell` back and test with a screen reader.
- **Many rows**: paginate or filter on the server when users look for specific records; virtualise (render only the visible rows) when they really scroll. Virtualisation breaks the browser's find-in-page and the row count that screen readers announce, so set `aria-rowcount` on the table and `aria-rowindex` on each rendered row.

Recommendation: a real table in a scroll container with sticky headers by default, pagination before virtualisation, and a screen-reader test whenever the table's `display` or rendering strategy changes.

**Q15. After a new CSS reset, VoiceOver on Safari stops announcing the navigation as "list, 5 items", although the HTML did not change. Why, and what is the team-wide fix?**
WebKit deliberately drops the list semantics of a `<ul>` or `<ol>` styled with `list-style: none`, on the reasoning that a list that does not look like a list may not be one. Resets such as Tailwind's Preflight remove the bullets from every list, so every list on the site loses its semantics in Safari at once.

Where grouping and item count matter (navigation, card grids, search results), add `role="list"` to the element. It is redundant in other browsers, so configure lint rules such as `jsx-a11y/no-redundant-roles` to allow it on lists. Put it inside the design system's `List` and `Nav` components rather than relying on every team to remember. Recommendation: add `role="list"` in the shared components and include VoiceOver in manual testing of key flows, because automated checkers do not catch this.

**Q16. How do you get good `alt` text across a large site where content comes from many authors through a CMS?**
Good alt text depends on why the image is on that page, so neither developers nor tools can produce it alone. Make it part of the content workflow:

- In the CMS, make alt text a required field for each *use* of an image (the same photo can need different alt text on two pages), with an explicit "decorative" checkbox that outputs `alt=""`, so an empty value is a decision rather than an omission.
- In code, make `alt` a required prop of the `Image` component and lint for missing `alt` (`jsx-a11y/alt-text`).
- Treat automatically generated descriptions as a draft that an author confirms: they describe the pixels, not the purpose.
- Audit periodically for meaningless values such as `alt="image"` or file names; a query over the CMS finds most of them.

Recommendation: a required per-use alt field with a decorative option, lint in code, and human review of generated text. Accessibility practice in general is covered in [Accessibility](../11-accessibility/notes.md).

## References
- [MDN: `<img>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img)
- [MDN: `<ul>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ul)
- [MDN: `<ol>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ol)
- [MDN: `<dl>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dl)
- [MDN: `<table>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table)
- [web.dev: Cumulative Layout Shift (CLS)](https://web.dev/articles/cls)
