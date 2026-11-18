# Block and Inline Elements, IDs and Classes

> HTML · Topic 5 · Demo: [index.html](index.html) · [style.css](style.css) · [id-and-class.html](id-and-class.html) · [id-and-class.css](id-and-class.css)

Every element is displayed either as a **block** (starts on a new line and takes the full width) or **inline** (flows inside a line of text, only as wide as its content). Knowing which is which explains most "why is this on the same line?" and "why does `width` do nothing?" questions in CSS. The second half of the note covers `id` and `class`, the global attributes that name elements so CSS can style them and JavaScript can find them: an `id` identifies **one unique element**, a `class` labels **a group of elements**, and one element can have several classes. `index.html` with `style.css` demonstrates block vs inline; `id-and-class.html` with `id-and-class.css` demonstrates ids and classes.

## Block vs inline

| | Block elements | Inline elements |
|-|----------------|-----------------|
| Starts on a new line | Yes | No, sits next to neighbouring text |
| Default width | Full width of the parent | Only as wide as the content |
| `width` / `height` | Respected | **Ignored** (except replaced elements like `<img>`, `<input>`) |
| Vertical `margin` | Pushes other elements away | **No effect** |
| Vertical `padding` | Adds space and pushes content | Painted, but does not move surrounding lines (it overlaps them) |
| Typical content | Other blocks and inline content | Text and other inline elements |
| Examples | `<div>`, `<p>`, `<h1>`, `<ul>`, `<form>` | `<span>`, `<a>`, `<strong>`, `<img>`, `<input>` |

### What the demo shows

`style.css` gives each element a background colour, which makes the size of its box visible:

```html
<p>Hey I am a para</p>                      <!-- block: aquamarine strip across the whole page -->
<a href="https://google.com">Google</a>     <!-- inline: orange only behind the word -->
<div> I am a block element</div>            <!-- block: yellow full-width strip, new line -->
<span>I am span and I am inline</span>      <!-- inline: purple behind the text only -->
<a href="">yes he is inline</a>             <!-- inline: same line as the span -->
```

The two inline elements at the end share a line; each block starts its own line.

### `<div>` and `<span>`: the generic containers

- `<div>` is a generic **block** container with no meaning of its own. Use it to group content for layout or styling.
- `<span>` is a generic **inline** container. Use it to style or script part of a line of text.

```html
<p>Price: <span class="price">499</span> rupees</p>
```

Prefer a meaningful element (`<section>`, `<nav>`, `<strong>`, `<time>`...) when one fits; use `div`/`span` only when none does.

### Changing the behaviour with CSS

Block or inline is just the element's **default** CSS `display` value, and you can change it:

```css
span { display: block; }          /* now starts on a new line, full width */
li   { display: inline; }         /* horizontal menu items */
a.button { display: inline-block; } /* stays in the line, but accepts width, height and vertical margin */
```

| `display` | New line? | Accepts width/height? |
|-----------|-----------|----------------------|
| `block` | Yes | Yes |
| `inline` | No | No |
| `inline-block` | No | Yes |

Changing `display` changes only the look, not the meaning: a `<span>` with `display: block` is still a span. The `display` property itself is covered in [Display and visibility](../../02-css/06-display-and-visibility/notes.md).

> **Note:** HTML5 no longer officially uses the terms "block" and "inline" for elements. It groups them by content model (for example *flow content* and *phrasing content*), and the visual behaviour comes from the CSS `display` property. The terms are still used everywhere in practice.

## Block elements (most commonly used first)

| Element | Meaning |
|---------|---------|
| `<div>` | A generic container for flow content |
| `<p>` | Paragraph |
| `<h1>`–`<h6>` | Headings |
| `<ul>` | Unordered list |
| `<ol>` | Ordered list |
| `<li>` | List item (`display: list-item`, a block that also draws a marker) |
| `<form>` | A section containing form controls |
| `<table>` | Table (`display: table`, which behaves like a block) |
| `<section>` | A standalone section of a document |
| `<header>` | Introductory content or a set of navigational links |
| `<footer>` | Footer of a section or page |
| `<nav>` | A section of a page that contains navigation links |
| `<article>` | A self-contained composition in a document |
| `<aside>` | Content indirectly related to the main content |
| `<main>` | The main content of a document |
| `<fieldset>` | A set of form controls grouped under a common name |
| `<blockquote>` | A block of text quoted from another source |
| `<pre>` | Preformatted text |
| `<dl>` | Description list |
| `<dt>` | Term in a description list |
| `<dd>` | Description in a description list |
| `<figure>` | Self-contained content (image, diagram, code) referenced from the main content |
| `<figcaption>` | A caption for a `<figure>` |
| `<address>` | Contact information for the author or owner of the document |
| `<hr>` | A thematic break, shown as a horizontal rule |
| `<tfoot>` | Footer rows of a table (`display: table-footer-group`, part of the table) |

> **Note:** `<canvas>` (a container used to draw graphics with JavaScript) often appears in lists of block elements, including the W3Schools list, but browsers display it **inline** by default, like `<img>`. That is why a canvas can leave a small gap below it; add `display: block` if needed.

## Inline elements (most commonly used first)

| Element | Meaning |
|---------|---------|
| `<a>` | Anchor or hyperlink |
| `<img>` | Image (a *replaced* element, so it accepts `width`/`height`) |
| `<span>` | Generic inline container |
| `<input>` | Input field (form controls render as `inline-block`) |
| `<label>` | Label for a form element |
| `<strong>` | Strong importance |
| `<em>` | Emphasised text |
| `<br>` | Line break |
| `<code>` | Code snippet |
| `<b>` | Text to draw attention to, without extra importance (bold) |
| `<i>` | Alternate voice or technical term (italic) |
| `<u>` | Unarticulated annotation, e.g. a spelling error (underlined) |
| `<small>` | Side comments and small print |
| `<sub>` | Subscript |
| `<sup>` | Superscript |
| `<mark>` | Marked or highlighted text |
| `<q>` | Short inline quotation |
| `<cite>` | Title of a creative work |
| `<kbd>` | Keyboard input |
| `<samp>` | Sample output from a program |
| `<var>` | Variable in a mathematical expression or programming context |
| `<time>` | A date or time (with a machine-readable `datetime` attribute) |
| `<abbr>` | Abbreviation |
| `<data>` | Links content to a machine-readable value |
| `<acronym>` | Acronym. **Not supported in HTML5**; use `<abbr>` instead |

## Quick quiz from the lecture

**Without using the `<br>` tag, write a vertically aligned form asking for the name, city and pin code of a user.**

Answer: wrap each label + input pair in a `<div>`. Because `<div>` is a block element, each pair starts on a new line.

```html
<form>
    <div>
        <label for="name">Name</label>
        <input type="text" id="name" name="name">
    </div>
    <div>
        <label for="city">City</label>
        <input type="text" id="city" name="city">
    </div>
    <div>
        <label for="pincode">Pincode</label>
        <input type="text" id="pincode" name="pincode" inputmode="numeric" pattern="[0-9]{6}">
    </div>
</form>
```

## The `title` attribute

The `title` attribute adds extra information about an element. Its value is displayed as a **tooltip** when you hover the mouse over the element:

```html
<p title="I'm a 'paragraph' ">This is a paragraph.</p>
```

`title` is a global attribute, so it works on any element (and is the standard way to expand an `<abbr>`).

> **Note:** Do not put important information only in `title`. The tooltip never appears on touch screens or for keyboard users, and screen readers do not announce it consistently.

## Single or double quotes?

Double quotes around attribute values are the most common in HTML, but single quotes work too. When the value itself contains double quotes, wrap it in single quotes:

```html
<p title='John "ShotGun" Nelson'>
```

Or vice versa:

```html
<p title="John 'ShotGun' Nelson">
```

If a value must contain both kinds, use an entity: `&quot;` for `"` or `&#39;` for `'`. Quotes can be left out when the value has no spaces or special characters (`<input type=text>`), but always quoting is the safer habit.

## IDs and classes: the demo

`id-and-class.html` styled by `id-and-class.css`:

```html
<div id="firstdiv" class="red bg-yellow">First</div>  <!-- two classes, separated by a space -->
<div id="seconddiv">Second</div>
<span class="red">Aman</span>                          <!-- single class -->
```

```css
.red {
    color: red;
}

.bg-yellow {
    background-color: yellow;
}

#seconddiv {
    background-color: rgb(68, 216, 105);
}
```

Result:

| Element | Gets styles from | Looks like |
|---------|------------------|-----------|
| `First` | `.red` and `.bg-yellow` | Red text on a yellow strip |
| `Second` | `#seconddiv` | Black text on a green strip |
| `Aman` | `.red` | Red text, inline |

The `.red` class is reused by two different elements (a `<div>` and a `<span>`), and the first `<div>` combines two classes. That is the whole point of classes. The strips are full width because `<div>` is a block element; the `<span>` is coloured only behind its text because it is inline.

## The `id` attribute

```html
<div id="firstdiv">First</div>
```

- Must be **unique** in the page: no two elements may share an id.
- An element can have **only one** id.
- **Case-sensitive** (`firstDiv` and `firstdiv` are different) and must not contain spaces.
- Used for:
  - CSS: `#firstdiv { ... }`
  - JavaScript: `document.getElementById("firstdiv")`
  - Bookmarks / fragment links: `<a href="#firstdiv">` (see [Headings, links and bookmarks](../02-headings-links-bookmarks/notes.md#bookmarks-fragment-links))
  - Connecting a `<label for="...">` to its form control (see [Forms](../07-forms/notes.md))
  - Accessibility relationships: `aria-labelledby="..."`, `aria-describedby="..."`

## The `class` attribute

```html
<div class="red bg-yellow">First</div>
```

- Many elements can share the same class.
- One element can have **many classes**, separated by spaces. `class="red bg-yellow"` means two classes, `red` and `bg-yellow`.
- Class names are case-sensitive.
- Used for:
  - CSS: `.red { ... }`
  - JavaScript: `document.querySelectorAll(".red")`, `element.classList`

## id vs class

| | `id` | `class` |
|-|------|---------|
| Uniqueness | One element per page | Any number of elements |
| Per element | One id | Many classes (space-separated) |
| CSS selector | `#name` | `.name` |
| JS lookup | `getElementById("name")` | `getElementsByClassName("name")`, `querySelectorAll(".name")` |
| CSS specificity | High (1,0,0) | Medium (0,1,0) |
| Other uses | Fragment links, `label for`, ARIA references | Reusable styling, JS state (`.active`, `.open`) |
| Best for | A unique hook for JavaScript, links or accessibility | Styling |

## Using ids and classes in CSS

```css
#seconddiv     { }  /* the element with id="seconddiv" */
.red           { }  /* every element with class "red" */
div.red        { }  /* only <div>s with class "red" */
.red.bg-yellow { }  /* elements that have BOTH classes (no space) */
.red .bg-yellow{ }  /* .bg-yellow elements INSIDE a .red element (space = descendant) */
.red, .bg-yellow { } /* elements with EITHER class (comma = group) */
```

The full list of selectors and combinators is in [Selectors](../../02-css/02-selectors/notes.md).

### Specificity: which rule wins?

When rules conflict, the more specific selector wins, regardless of order:

| Selector | Specificity |
|----------|-------------|
| `p` (element) | 0,0,1 |
| `.red` (class) | 0,1,0 |
| `#seconddiv` (id) | 1,0,0 |
| `style="..."` (inline) | Beats all of the above |

```html
<p id="intro" class="red">Hello</p>
```

```css
#intro { color: blue; }
.red   { color: red; }
/* → the text is blue: the id selector is more specific, even though .red comes later */
```

If two selectors have the **same** specificity, the one that comes **later** in the CSS wins. The full rules are in [Specificity and the cascade](../../02-css/03-specificity-and-cascade/notes.md).

## Using ids and classes in JavaScript

```js
const first = document.getElementById("firstdiv"); // one element (or null)
const reds  = document.querySelectorAll(".red");   // NodeList of all .red elements
console.log(reds.length); // → 2

first.classList.add("active");      // add a class
first.classList.remove("red");      // remove a class
first.classList.toggle("hidden");   // add if missing, remove if present
first.classList.contains("bg-yellow"); // → true
```

Toggling classes is the standard way to change styles from JavaScript: keep the styles in CSS (`.hidden { display: none; }`) and let JS switch the class on or off.

## Naming conventions

- Use lowercase words joined with hyphens: `bg-yellow`, `main-nav`, `card-title`.
- Name by **purpose**, not appearance, for reusable components: `.error-message` survives a redesign better than `.red`. (Small "utility" classes like `bg-yellow` that do exactly one thing are a deliberate exception; frameworks such as Tailwind CSS are built on that idea.)
- Larger projects often use a convention like BEM: `.card`, `.card__title`, `.card--featured`.

> **Note:** HTML allows an id or class that starts with a digit (`id="1st"`), but the CSS selector `#1st` is invalid and must be escaped (`#\31 st`). Starting names with a letter avoids the problem; the JavaScript side is explained in [Selecting DOM elements](../../03-javascript/22-dom-selecting/notes.md).

## Common Mistakes

- **Setting `width`, `height` or vertical `margin` on a `<span>` or `<a>`** and wondering why nothing changes — make it `inline-block` or `block` first.
- **Putting a block element inside `<p>`** — a `<div>` inside a `<p>` makes the browser close the paragraph early, which breaks your CSS.
- **Using `<br>` (or empty `<p>`s) for spacing** — use margins on block elements instead.
- **Choosing `<div>` for everything** ("div soup") — use semantic elements where they exist.
- **Expecting a gap-free row of `inline-block` items** — the whitespace between the tags in the source becomes a visible space (fixes in [Display and visibility](../../02-css/06-display-and-visibility/notes.md)).
- **Using `<acronym>`** — obsolete; use `<abbr title="...">`.
- **Reusing an id** on several elements — invalid HTML; `getElementById` and fragment links only ever find the first one.
- **Writing a dot or hash in the attribute** — `class=".red"` or `id="#firstdiv"`; the `.`/`#` belong only in the CSS selector.
- **Separating classes with commas** — `class="red, bg-yellow"` creates the classes `red,` and `bg-yellow`; use spaces only.
- **Case mismatch** — `class="Red"` is not matched by `.red`.
- **Styling everything with ids** — their high specificity makes styles hard to override later; prefer classes for styling.
- **Confusing `.a.b` with `.a .b`** — one space completely changes the meaning.

## Key Takeaways

- Block elements start on a new line and take the full width; inline elements flow within text and are only as wide as their content.
- Inline elements ignore `width`, `height` and vertical margins; replaced elements such as `<img>` and form controls are the exception.
- `<div>` is the generic block container, `<span>` the generic inline container. Block or inline is just a default `display` value; `inline-block` combines staying in the line with accepting a size.
- `<canvas>` is inline by default, despite appearing in many "block element" lists.
- `title` shows a hover tooltip, but is not accessible enough for essential information. Use single quotes around a value that contains double quotes, and vice versa.
- `id` = unique name for one element; `class` = reusable label for many elements. An element has at most one id but can have many classes, separated by spaces.
- CSS uses `#id` and `.class`; JavaScript uses `getElementById`, `querySelector(All)` and `classList`.
- Specificity: id beats class beats element; with equal specificity, the later rule wins. Style with classes; keep ids for unique hooks (JavaScript, fragment links, `label for`, ARIA).
- Names are case-sensitive; use lowercase-hyphenated names starting with a letter.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between block and inline elements?**
A block element starts on a new line and stretches to the full width of its container; it respects width, height and all margins. An inline element stays within the flow of text, is only as wide as its content, and ignores width, height and vertical margins.

**Q2. What is the difference between `<div>` and `<span>`?**
Both are generic containers with no meaning. `<div>` is block-level and is used to group larger sections; `<span>` is inline and is used to wrap part of a line of text for styling or scripting.

**Q3. You set `width: 200px` on a `<span>` and nothing happens. Why, and how do you fix it?**
`<span>` is inline, and inline boxes ignore `width` and `height`. Change its display: `display: block` puts it on its own line; `display: inline-block` keeps it in the line, but its box then behaves like a block inside, so width, height, padding and vertical margins all apply. `inline-block` is the usual choice for buttons, badges and navigation items.

**Q4. Is `<img>` inline or block?**
It is inline by default, which is why images sit next to text and leave a small gap below them (space for letters' descenders). Unlike other inline elements it is a replaced element, so `width` and `height` work on it.

**Q5. How do you write an attribute value that contains double quotes?**
Wrap the value in single quotes, `title='John "ShotGun" Nelson'`, or use the `&quot;` entity inside double quotes.

**Q6. What is the difference between an id and a class? Can an element have more than one of each?**
An id must be unique on the page and is selected with `#id`; a class can be shared by any number of elements and is selected with `.class`. An element can have only one id, but any number of classes, listed in the `class` attribute and separated by spaces (`<div class="red bg-yellow">`); it receives the styles of every class. Ids are for unique elements, classes for reusable styling or grouping.

**Q7. What colour is the text?**

```html
<p id="intro" class="red">Hello</p>
<style>
  #intro { color: blue; }
  .red   { color: red; }
</style>
```

Blue. The id selector `#intro` has higher specificity than the class selector `.red`, so it wins even though `.red` comes later.

**Q8. What happens if two elements on a page have the same id?**
The HTML is invalid. Browsers still render it, but `document.getElementById` and `querySelector("#id")` return only the first element, fragment links go to the first one, and `label for` points to the first one, which leads to confusing bugs.

**Q9. How do you add or remove a class with JavaScript?**
Use the element's `classList`: `el.classList.add("active")`, `el.classList.remove("active")`, `el.classList.toggle("active")` and `el.classList.contains("active")`.

### Mid-level (2–4 years)

**Q10. What DOM does the browser build from `<p><div>Hi</div></p>`?**
`<p></p><div>Hi</div><p></p>`. A `<p>` cannot contain block content, so the `<div>` start tag implicitly closes the paragraph. The stray `</p>` then has no open paragraph, so the parser creates an empty `<p></p>`. That is why styles meant for "the div inside the p" do not apply.

**Q11. Is it valid to put a `<div>` inside an `<a>`?**
Yes, in HTML5. `<a>` has a *transparent* content model: it may contain whatever its parent may contain, so a link can wrap a whole card made of block elements. It must not contain interactive content such as another link or a button.

**Q12. Is block/inline an HTML concept or a CSS concept?**
Today it is a CSS concept: each element has a default `display` value in the browser's stylesheet, and you can change it. HTML itself classifies elements by content categories (flow, phrasing, interactive, etc.), which decide what may be nested where. Changing `display` never changes an element's semantics.

**Q13. Why shouldn't essential information be placed only in the `title` attribute?**
Tooltips appear only on mouse hover after a delay, never on touch devices or for keyboard focus in most browsers, and screen-reader support is inconsistent. Put important text in visible content, use a real `<label>` for form fields, and use `aria-describedby` for extra descriptions.

**Q14. Why does vertical padding on an inline `<a>` overlap the lines above and below instead of pushing them away?**
Inline boxes do not take part in vertical layout: the line height is set by the text, and vertical padding and borders are painted around the text without enlarging the line box. To make the padding take space, use `display: inline-block` (or `block`).

**Q15. Why do many teams avoid using ids for styling?**
An id selector's specificity (1,0,0) beats any number of class selectors, so overriding it later requires another id, `!important` or inline styles, which leads to "specificity wars". Ids also cannot be reused, which defeats component-based styling. Classes keep specificity low and predictable; ids are kept for JavaScript hooks, anchors and accessibility references.

**Q16. Does the order of names in `class="red bg-yellow"` affect which style wins?**
No. The order inside the attribute is irrelevant. When two class rules set the same property, the winner is decided by specificity and then by the order of the rules in the stylesheet: the rule that appears later in the CSS wins.

**Q17. Elements with an id become global variables in the browser (`window.firstdiv`). Should you use that?**
No. This "named access" is a legacy feature: the variable can be shadowed by any real global with the same name, it breaks if the id changes, it makes code hard to read, and it does not work for ids that are not valid JavaScript identifiers. Always look elements up explicitly with `getElementById` or `querySelector`.

**Q18. How would you show and hide a dropdown menu using classes rather than inline styles?**
Define the visual states in CSS, for example `.menu { display: none; }` and `.menu.open { display: block; }`, then toggle the class in JavaScript: `button.addEventListener("click", () => menu.classList.toggle("open"))`. This keeps styling in CSS, makes states easy to animate, and avoids inline styles that are hard to override. Also update `aria-expanded` on the button for screen readers.

### Senior (5+ years)

**Q19. Class names in your codebase are used for styling, by JavaScript and by end-to-end tests at the same time, so every CSS refactor breaks something. How do you separate those concerns?**
Give each consumer its own hook, so each can change without breaking the others:

| Consumer | Hook |
|----------|------|
| Styling | Classes, free to rename (BEM names, utilities or CSS Modules) |
| JavaScript behaviour | `data-*` attributes (`data-action="close"`), or `js-` prefixed classes that carry no styles |
| Tests | The accessible role and name first (`getByRole("button", { name: "Save" })`), `data-testid` as a fallback |
| UI state | ARIA or data attributes (`aria-expanded="true"`, `data-state="open"`) that CSS also selects on |

The last row matters most. If the open/closed state lives in `aria-expanded` and CSS styles `[aria-expanded="true"]`, the visual state and the state announced to screen readers cannot drift apart, which easily happens when JavaScript toggles `.is-open` and someone forgets the ARIA attribute. Recommendation: write the convention down, and enforce what lint can check, for example `testing-library/no-node-access`, which flags tests that dig through the DOM by class.

**Q20. A reusable `TextField` component hardcodes `id="email"` for its `<label for>` and `aria-describedby`. What breaks, and how should components get ids?**
Ids are global to the document. When the component appears twice on a page (a login form and a newsletter form), both labels point at the first input, the second field's error message is announced for the first one, and `getElementById` returns the wrong element. Nothing fails visibly; only assistive-technology users and automated checks such as axe's duplicate-id rules notice.

Reusable components must never hardcode ids. Generate one per instance, stable between server and client rendering so hydration does not break: `useId()` in React 18+ and Vue 3.5+, or your framework's equivalent. `Math.random()` and module-level counters produce different values on the server and the client. Derive the related ids from it (`${id}-hint`, `${id}-error`), and accept an `id` prop so a page can set its own when it needs a fragment link. Recommendation: generated, SSR-stable ids with an override prop, plus an axe check in the component tests.

**Q21. Your design system's `Text` component renders a `<div>`. Teams put it inside `<p>`, `<button>` and `<a>`, and the server-rendered app starts reporting hydration errors. What is happening, and how should the component be designed?**
The server sends `<p><div>…</div></p>` as HTML. The browser's parser closes the `<p>` when it meets the `<div>` (Q10), so the real DOM is `<p></p><div>…</div><p></p>`. On the client, React expects the `<div>` inside the paragraph, finds a different tree, reports a hydration mismatch and re-renders that part on the client, losing the benefit of server rendering. A client-only app hides the bug, because `appendChild` does not apply the parser's nesting rules. `<div>` inside `<button>` is invalid as well (a button may contain only phrasing content), even though browsers render it.

Design text components around HTML content models: default to a phrasing element (`<span>`), offer a polymorphic `as` prop (`as="p"`, `as="h2"`, `as="label"`) for the semantic choice, and let only layout components (`Box`, `Stack`) render `<div>`. React's development warnings about invalid DOM nesting catch most cases; make them fail the component tests. Recommendation: a phrasing default plus an `as` prop, with nesting warnings treated as errors.

> **Note:** Related questions answered elsewhere: [Display and visibility](../../02-css/06-display-and-visibility/notes.md#interview-questions) (gaps between inline-block items); [Selectors](../../02-css/02-selectors/notes.md#interview-questions) (`.a.b` vs `.a .b` vs `.a > .b`); [Selecting DOM elements](../../03-javascript/22-dom-selecting/notes.md#interview-questions) (an id that starts with a digit).

## References
- [W3Schools: HTML block and inline elements](https://www.w3schools.com/html/html_blocks.asp)
- [CodeWithHarry: HTML inline elements](https://www.codewithharry.com/tutorial/html-inline-elements/#)
- [CodeWithHarry: HTML id and classes](https://www.codewithharry.com/tutorial/html-id-and-classes/)
- [MDN: Block-level content](https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content)
- [MDN: Inline-level content](https://developer.mozilla.org/en-US/docs/Glossary/Inline-level_content)
- [MDN: CSS `display`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display)
- [MDN: `title` global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/title)
- [MDN: `id` global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/id)
- [MDN: `class` global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/class)
- [MDN: `Element.classList`](https://developer.mozilla.org/en-US/docs/Web/API/Element/classList)
- [MDN: Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Specificity)
- [React: `useId`](https://react.dev/reference/react/useId)
