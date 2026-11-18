# CSS Selectors

> CSS · Topic 2 · Demo: [index.html](index.html) · [more-selectors.html](more-selectors.html)

A selector is the part of a CSS rule that decides *which* elements the declarations apply to. Choosing selectors well is the difference between CSS that is easy to change and CSS that fights itself. This note walks through every selector family: simple and compound selectors, combinators, the `.a.b` vs `.a .b` trap, pseudo-classes (state, structural, logical and form), pseudo-elements and attribute selectors. `index.html` demonstrates the basic selectors, combinators and link states; `more-selectors.html` demonstrates the universal selector, attribute selectors, structural pseudo-classes and pseudo-elements.

> **Note:** In `more-selectors.html` only the pseudo-element rules (`::before`, `::after`, `::selection`, `::first-letter`, `::placeholder`) are active. The universal, grouping and structural rules are commented out; uncomment one at a time to see its effect.

## The Five Categories of Selectors

| Category | Selects elements based on | Examples |
|---|---|---|
| Simple selectors | name, id, class | `div`, `.Sel`, `#ID_sel`, `*` |
| Combinator selectors | a specific relationship between them | `main p`, `span > p`, `div + p`, `div ~ p` |
| Pseudo-class selectors | a certain state or position | `a:hover`, `li:first-child`, `input:focus` |
| Pseudo-element selectors | a *part* of an element (to style it) | `p::first-line`, `h1::before`, `::selection` |
| Attribute selectors | an attribute or attribute value | `a[href]`, `[data-x="a"]`, `a[href^="https"]` |

## 1. Simple Selectors

| Selector | Syntax | Matches | Demo |
|---|---|---|---|
| Element (type) | `div` | every `<div>` | `div { color: darkgreen; }` |
| Class | `.Sel` | every element with `class="Sel"` | `.Sel { color: blue; }` |
| ID | `#ID_sel` | the element with `id="ID_sel"` | `#ID_sel { color: brown; }` |
| Universal | `*` | every element | `.boxes * { ... }` |
| Grouping | `h1, h2` | elements matching any selector in the list | `p, a, .box { ... }` |

```css
/* Element selector */
div {
  color: darkgreen;
}

/* Class selector */
.Sel {
  color: blue;
}

/* ID selector */
#ID_sel {
  color: brown;
}
```

- A **class** can be used on many elements, and one element can have many classes: `class="box box1"`.
- An **ID** must be unique in the page. Use IDs for anchors (`#section`), form labels and JavaScript hooks; prefer classes for styling (see [Specificity and the cascade](../03-specificity-and-cascade/notes.md)).
- Class and ID names are **case-sensitive**: `.Sel` does not match `class="sel"`.

### Universal selector `*`

`*` matches every element. `index.html` lists it ("6.Universal Seclector") but has no rule for it; `more-selectors.html` combines it with a descendant selector to match every element inside `.boxes`:

```css
.boxes * {
  color: blue;
  border: 2px solid black;   /* every box AND the input get a border */
}
```

`*` has zero specificity, so almost any other rule overrides it. A common use is a global reset: `* { margin: 0; padding: 0; box-sizing: border-box; }`.

### Grouping selector (comma)

A comma applies one set of declarations to several selectors:

```css
p, a, .box, [data-color="primary"] {
  padding-top: 45px;
}
```

This is the same as writing four separate rules with the same body.

> **Note:** If **any** selector in a group is invalid or unsupported, the browser drops the **whole rule**. `p, .box, :not-a-real-thing { ... }` styles nothing. This is why old vendor-prefixed selectors (for example the different placeholder prefixes) were always written as separate rules. `:is()` and `:where()` (below) take a *forgiving* list instead.

### Compound selectors (no space)

Writing simple selectors together with **no space** means "the same element must match all of them":

```css
div.Sel { }          /* a <div> that has class Sel */
.box.box1 { }        /* an element with both classes */
h1.yellow { }        /* an <h1> with class yellow */
```

A type selector, if present, must come first: `div.Sel` is valid, `.Seldiv` is a class called `Seldiv`.

## 2. Combinator Selectors

A combinator describes a relationship between two selectors.

| Combinator | Syntax | Selects | Demo |
|---|---|---|---|
| Descendant | `A B` (space) | every `B` anywhere inside `A` (child, grandchild, ...) | `main p` |
| Child | `A > B` | `B` that is a **direct** child of `A` | `span > p` |
| Adjacent sibling | `A + B` | the `B` that comes **immediately after** `A`, same parent | `div + p` |
| General sibling | `A ~ B` | **every** `B` that comes after `A`, same parent | `div ~ p` |

### Descendant selector (space)

```css
/* Descendant selector */
main p {
  color: chocolate;
}
```

In the demo, the `<p>` is inside a `<div>` inside `<main>`. It is not a direct child of `main`, but the descendant selector matches at any depth.

### Child selector (`>`)

```css
/* Child selector */
span > p {
  color: blueviolet;
}
```

Matches only a `<p>` whose **parent** is a `<span>`. A `<p>` nested one level deeper would not match.

> **Note:** The demo places a `<p>` inside a `<span>`. That is invalid HTML (`<span>` may only contain inline/phrasing content, and `<p>` is a block). Browsers still build `span > p` in the DOM, so the rule works, but in real code use a `<div>` as the wrapper.

### Adjacent sibling selector (`+`)

The adjacent sibling selector selects an element that is directly after another specific element. Sibling elements must have the same parent element, and "adjacent" means "immediately following".

The following example selects every `<p>` element that is placed immediately after a `<div>` element:

```css
/* Adjacent sibling */
div + p {
  background-color: yellow;
}
```

The relevant part of the demo, as a tree:

```text
body
├── div
│   ├── p  Paragraph 1 in the div.     (first child, no div before it)
│   └── p  Paragraph 2 in the div.
├── p  Paragraph 3. After a div.       <-- matched by div + p
├── p  Paragraph 4. After a div.       (follows a p, not a div)
├── div
│   ├── p  Paragraph 5 in the div.
│   └── p  Paragraph 6 in the div.
├── p  Paragraph 7. After a div.       <-- matched by div + p
└── p  Paragraph 8. After a div.
```

Only **Paragraph 3** and **Paragraph 7** get the yellow background.

### General sibling selector (`~`)

The general sibling selector selects all elements that are next siblings of a specified element (they share the parent and come after it, not necessarily immediately).

```css
div ~ p {
  background-color: yellow;
}
```

In the tree above, `div ~ p` would highlight Paragraphs 3, 4, 7 and 8 (plus the two explanation paragraphs earlier in the body, since they also come after a `<div>` at the same level). Paragraphs 1, 2, 5 and 6 are not matched: they are inside a `<div>`, not after one.

> **Note:** Sibling combinators only look **forward**. There is no "previous sibling" combinator, but `:has()` can do it: `h2:has(+ p)` selects an `<h2>` that is immediately followed by a `<p>`.

## 3. `.class.class` vs `.class .class`

A classic question: what is the difference between the selectors `.class.class` and `.class .class`? That one space completely changes the meaning:

| Selector | Name | Matches |
|---|---|---|
| `.card.featured` (no space) | Compound selector | **One** element that has **both** classes. |
| `.card .featured` (space) | Descendant combinator | An element with class `featured` **anywhere inside** an element with class `card` (child, grandchild, and so on). |
| `.card > .featured` | Child combinator | An element with class `featured` that is a **direct child** of a `.card`. |

```html
<div class="card featured">A</div>      <!-- .card.featured matches A -->

<div class="card">
  <p class="featured">B</p>             <!-- .card .featured and .card > .featured match B -->
  <section>
    <p class="featured">C</p>           <!-- .card .featured matches C; .card > .featured does not -->
  </section>
</div>
```

```css
.card.featured  { border: 2px solid gold; }   /* only A */
.card .featured { color: crimson; }           /* B and C */
.card > .featured { font-weight: bold; }      /* only B */
```

The same idea applies to other simple selectors: `div.Sel` (a `<div>` with class `Sel`) vs `div .Sel` (an element with class `Sel` inside a `<div>`), and `.box:first-child` (a `.box` that is a first child) vs `.box :first-child` (the first child *inside* a `.box`).

> **Note:** All three selectors in the table have the same specificity, (0, 2, 0): two classes. The combinator (space or `>`) adds nothing. If they set the same property on the same element, the one that comes later in the CSS wins.

## 4. Pseudo-class Selectors

A pseudo-class (single colon `:`) selects an element based on its **state** or **position**, information that is not in the HTML source.

### Link and user-action states

```css
/* Pseudo-class selectors from index.html */
a:visited {
  color: darkmagenta;
}

a:link {
  color: green;
}

a:hover {
  color: crimson;
}
```

| Pseudo-class | Matches |
|---|---|
| `:link` | a link that has **not** been visited |
| `:visited` | a link the user has visited |
| `:hover` | element under the mouse pointer |
| `:active` | element being pressed/clicked right now |
| `:focus` | element that has keyboard/input focus |
| `:focus-visible` | focused element when the browser decides a focus ring should be shown (usually keyboard focus) |
| `:focus-within` | element that has focus itself or contains the focused element |

**LVHA order.** All four link states have the same specificity, so the *later* rule wins when several apply. Write them in the order `:link`, `:visited`, `:hover`, `:active` ("LoVe HAte"). If `:hover` came before `:visited`, hovering a visited link would show no change. The demo puts `:visited` before `:link`, which is fine because a link is never both at once; what matters is that `:hover` comes after them.

> **Note:** For privacy, browsers only let `:visited` change color-related properties (such as `color`, `background-color`, `border-color`, `outline-color`). Otherwise a page could detect which sites you have visited.

### Structural pseudo-classes

These select elements by their position among their siblings.

| Selector | Matches |
|---|---|
| `:first-child` / `:last-child` | the first / last element child of its parent |
| `:only-child` | an element with no element siblings |
| `:nth-child(n)` | the nth child among **all** element siblings (counting starts at 1) |
| `:nth-last-child(n)` | the nth child counting from the end |
| `:first-of-type` / `:last-of-type` | the first / last sibling **of the same tag name** |
| `:nth-of-type(n)` | the nth sibling of the same tag name |
| `:empty` | an element with no children and no text |

From `more-selectors.html` (commented out in the demo; uncomment one at a time):

```css
.box:first-child {
  background-color: red;     /* "I am first box" */
}

.box:nth-child(odd) {
  background-color: blue;    /* children 1 and 3: the first and third boxes */
}

.box:nth-last-child(2) {
  background-color: red;     /* 2nd from the end: the third box (the input is last) */
}
```

#### Reading `.box:first-child` correctly

`.box:first-child` does **not** mean "the first element with class `box`". It means "an element that has class `box` **and** is the first child of its parent". If the first child of `.boxes` were an `<h2>`, `.box:first-child` would match nothing.

#### Formulas for `:nth-child()`

The argument can be a number, `odd`, `even`, or a formula `An+B`, where `n` counts 0, 1, 2, ...

| Argument | Matches children |
|---|---|
| `3` | only the 3rd |
| `odd` (= `2n+1`) | 1, 3, 5, ... |
| `even` (= `2n`) | 2, 4, 6, ... |
| `3n` | 3, 6, 9, ... |
| `3n+1` | 1, 4, 7, ... |
| `n+3` | 3, 4, 5, ... (from the 3rd onward) |
| `-n+3` | 1, 2, 3 (the first three) |

```css
tr:nth-child(even)  { background: #f2f2f2; }  /* zebra-striped table */
li:nth-child(-n+3)  { font-weight: bold; }    /* first three items */
li:nth-last-child(-n+3) { color: gray; }      /* last three items */
```

#### `:nth-child` vs `:nth-of-type`

`:nth-child()` counts **all** siblings, whatever their tag or class. `:nth-of-type()` counts only siblings with the **same tag name**. Neither counts by class.

```html
<section>
  <h2>Title</h2>
  <p>One</p>
  <p>Two</p>
</section>
```

| Selector | Matches |
|---|---|
| `p:nth-child(1)` | nothing (child 1 is the `<h2>`) |
| `p:nth-child(2)` | "One" |
| `p:nth-of-type(1)` | "One" |
| `p:first-of-type` | "One" |

To count by class, use the `of S` syntax (supported in all current major browsers since 2023): `:nth-child(2 of .box)` matches the second element that has class `box`, ignoring other siblings.

### Logical pseudo-classes: `:not()`, `:is()`, `:where()`, `:has()`

```css
:is(h1, h2, h3) a { color: teal; }               /* shorter than three selectors */
:where(.card, .panel) p { margin: 0; }           /* same idea, but zero specificity */
.box:not(:last-child) { margin-bottom: 1rem; }   /* every box except the last */
button:not(.primary, .danger) { background: white; }
.card:has(img) { padding-top: 0; }               /* a card that contains an image */
form:has(input:invalid) button { opacity: 0.5; } /* dim submit while any input is invalid */
```

| Pseudo-class | Matches | Forgiving list? |
|---|---|---|
| `:is(a, b)` | elements matching any selector in the list | yes: an invalid entry is ignored |
| `:where(a, b)` | same as `:is()` | yes |
| `:not(a, b)` | elements matching none of them | no |
| `:has(rel)` | elements that **contain** (or are followed by) something matching the relative selector | no |

- `:is()` and `:where()` match the same elements; they differ only in specificity. That difference, and when to use each, is explained in [Specificity and the cascade](../03-specificity-and-cascade/notes.md).
- None of them can contain pseudo-elements: `:is(::before)` is invalid.
- `:has()` is the long-awaited "parent selector": it styles an element based on what it contains. It is supported in all current major browsers. It also gives a "previous sibling" selector: `h2:has(+ p)`.

### Form pseudo-classes

`:checked`, `:disabled`, `:enabled`, `:required`, `:optional`, `:valid`, `:invalid`, `:user-invalid`, `:placeholder-shown`.

```css
input:user-invalid { border-color: red; }
input[type="checkbox"]:checked + label { text-decoration: line-through; }
```

`:invalid` matches an empty required field as soon as the page loads, so the form looks full of errors before the user has typed anything. `:user-invalid` (supported in current major browsers since 2023) matches only after the user has interacted with the field, which is usually what designers want.

## 5. Pseudo-element Selectors

A CSS pseudo-element (double colon `::`) is used to style **specified parts** of an element, or to insert generated content that is not in the HTML.

| Pseudo-element | Styles / creates |
|---|---|
| `::before` | a generated child **before** the element's content |
| `::after` | a generated child **after** the element's content |
| `::first-letter` | the first letter of a block |
| `::first-line` | the first rendered line of a block |
| `::selection` | the part of the text the user has selected |
| `::placeholder` | placeholder text of an `<input>`/`<textarea>` |
| `::marker` | the bullet or number of a list item |

### Pseudo-class vs pseudo-element

| | Pseudo-class | Pseudo-element |
|---|---|---|
| Syntax | single colon `:hover` | double colon `::before` |
| Selects | an existing element in a certain state or position | a part of an element, or generated content that is not in the HTML |
| Example | `a:hover`, `li:first-child`, `:nth-child(2)` | `p::first-line`, `h1::before`, `::selection` |
| How many per selector | as many as you like | one, at the end of the selector |
| Specificity | same as a class (0,1,0) | same as an element (0,0,1) |

Older pseudo-elements (`:before`, `:after`, `:first-line`, `:first-letter`) also accept a single colon for backward compatibility. Use `::` in new code.

### `::before` and `::after`

They insert **generated content** as the first (`::before`) or last (`::after`) child **inside** the element. `more-selectors.html` adds text to both ends of `.boxes`:

```css
.boxes::before {
  content: "Harry is good";
  color: blue;
}

.boxes::after {
  content: "Sigma course is also good";
  color: red;
}
```

"Harry is good" appears inside `.boxes` above the first box, and "Sigma course is also good" appears inside `.boxes` after the input.

`content` can be text, an image, an attribute value, a counter, or empty (for purely decorative shapes):

```css
h1::before {
  content: url(smiley.gif);
}

.required::after {
  content: " *";
  color: red;
}

a[data-tooltip]::after {
  content: attr(data-tooltip);
}

.badge::before {
  content: "";          /* empty, but still required */
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: green;
}
```

Rules:

- **`content` is required.** Without it, even `content: ""`, nothing is generated.
- They are **inline** by default. Set `display: block`/`inline-block` or `position: absolute` to size and place them.
- They go **inside** the element, not before or after it in the page. That is why they **do not work on elements that cannot have children**, such as `<img>`, `<br>` and text `<input>`s. You cannot add `::before` to the demo's `<input>`; wrap it in a `<label>` or `<span>` and style the wrapper instead.
- They are not in the DOM. JavaScript cannot select them (`getComputedStyle(el, "::after")` can only read them), users usually cannot select or copy their text, and screen-reader support varies. Use them for decoration (icons, quotes, overlays, clearfix), not for important content.

### `::first-letter`

Styles the first letter of the first line of a block. The demo makes it a large coloured initial:

```css
.box::first-letter {
  color: peru;
  font-size: 45px;
}
```

This is how "drop caps" in articles are made (often with `float: left` too). Only some properties apply: font, color, background, margin, padding, border, `float` and a few text properties.

### `::first-line`

Styles the first rendered line of a block:

```css
.box::first-line {
  color: yellow;
}
```

What counts as the first line depends on the element's width, so it changes when you resize the window. It accepts font, color, background and text properties, but not margin, padding or border.

### `::selection`

Styles the part of the page the user highlights with the mouse or keyboard. Only a few properties work on it: `color`, `background-color` (the `background` shorthand works only for its color), `text-decoration` and its longhands, and `text-shadow`. (Older references also list `cursor` and `outline`; current browsers do not apply those.)

```css
::selection {
  background-color: black;
  color: aqua;
}
```

Written without a selector in front, it applies to the whole page. `index.html` uses `::selection { background-color: blue; }`; `more-selectors.html` uses the black/aqua rule above.

### `::placeholder`

Styles the placeholder text of an `<input>` or `<textarea>`:

```css
input::placeholder {
  color: rgb(84, 84, 88);
}
```

> **Note:** A placeholder is a hint, not a label. It disappears when the user starts typing and is often low-contrast. Always add a real `<label>` as well.

### `::marker`

Styles the bullet or number of a list item. See [Styling lists](../09-lists/notes.md).

## 6. Attribute Selectors

Attribute selectors select elements based on an attribute or its value. In `more-selectors.html` the first box carries a `data-*` attribute, `data-color="primary"` (the demo only mentions the matching rule in a comment). A rule like this targets it:

```css
[data-color="primary"] {
  background-color: gold;   /* only the first box has this attribute */
}
```

| Selector | Matches when the attribute ... | Example |
|---|---|---|
| `[attr]` | exists (any value) | `a[href]`, `[disabled]` |
| `[attr="v"]` | equals `v` exactly | `input[type="email"]` |
| `[attr~="v"]` | is a space-separated list containing the word `v` | `[class~="card"]` |
| `[attr\|="v"]` | is `v` or starts with `v-` | `[lang\|="en"]` matches `en`, `en-US` |
| `[attr^="v"]` | starts with `v` | `a[href^="https"]` |
| `[attr$="v"]` | ends with `v` | `a[href$=".pdf"]` |
| `[attr*="v"]` | contains `v` anywhere | `a[href*="instagram"]` |
| `[attr="v" i]` | matches case-insensitively | `a[href$=".PDF" i]` |

```css
a[href^="http"]  { padding-right: 16px; }   /* external-looking links */
a[href$=".pdf"]::after { content: " (PDF)"; }
[data-x="a"]     { color: maroon; }          /* used in the specificity demo */
```

`data-*` attributes are a clean way to attach state or variants to HTML. JavaScript reads them with `element.dataset.color` (`"primary"`), and CSS can display them with `content: attr(data-color);` inside `::before`/`::after`. The `[data-x=a]` rule is used in the [Specificity and the cascade](../03-specificity-and-cascade/notes.md) demo.

## Specificity of These Selectors

| Selector | Specificity (id, class, type) |
|---|---|
| `*` | (0,0,0) |
| `[data-color="primary"]` | (0,1,0), same as a class |
| `:first-child`, `:nth-child()`, `:hover` | (0,1,0), same as a class |
| `::before`, `::first-letter` | (0,0,1), same as a type selector |
| `.box:first-child` | (0,2,0) |
| `.boxes .box:nth-child(2)::before` | (0,3,1) |
| `input::placeholder` | (0,0,2) |

The full rules (including `:is()`, `:not()`, `:has()` and `:where()`) are in [Specificity and the cascade](../03-specificity-and-cascade/notes.md).

## Common Mistakes

- **Space vs no space.** `div.Sel` is one element; `div .Sel` is a descendant. `.box :first-child` (with a space) means "the first child inside a `.box`". A stray space silently changes the meaning.
- **`::before`/`::after` without `content`.** Nothing is rendered.
- **Adding `::before` to `<img>` or `<input>`.** They cannot hold generated content.
- **Putting real content in `::before`/`::after`.** It cannot be selected or copied and may not be read by assistive technology.
- **Wrong link-state order.** Putting `:hover` before `:link`/`:visited` makes hover appear broken. Follow LVHA.
- **Expecting `+` to match any later sibling.** `+` only matches the element *immediately* after; use `~` for all later siblings.
- **Expecting `:nth-child()` or `:first-child` to count by type or class.** `p:nth-child(2)` means "a `<p>` that is the second child", not "the second `<p>`"; use `p:nth-of-type(2)`, or `:nth-child(2 of .box)` to count by class.
- **One bad selector in a group** silently disabling the whole rule.
- **Case mismatch.** `.sel` does not match `class="Sel"`.
- **Styling with IDs everywhere.** It works, but the high specificity makes later overrides painful.
- **Nested comments.** CSS comments cannot nest. In `more-selectors.html`, a `/* ... */` comment sits inside another comment; it only works because the first `*/` closes the outer comment at the right place. Do not rely on that.

## Key Takeaways

- Five families: simple, combinator, pseudo-class, pseudo-element, attribute. `*` matches everything (zero specificity), and a comma groups selectors that share declarations.
- Space = descendant (any depth), `>` = direct child, `+` = the very next sibling, `~` = every later sibling. No space = the same element (`.a.b`).
- Pseudo-classes (`:`) select by state or position; pseudo-elements (`::`) select a part of an element or create generated content.
- `:nth-child(An+B)` handles odd/even, every nth and first-N patterns. It counts all siblings; `:nth-of-type` counts siblings of the same tag; `of S` counts by selector.
- `:is()`/`:where()` shorten selector lists and forgive invalid entries; `:has()` selects by descendants or following siblings.
- `::before`/`::after` need `content`, are inline by default, live inside the element and do not work on `<img>`/`<input>`.
- Write link states in LVHA order: `:link`, `:visited`, `:hover`, `:active`.
- Attribute selectors can match presence, exact value, prefix (`^=`), suffix (`$=`) or substring (`*=`), including `data-*` attributes.
- Prefer classes for styling; keep selectors short and specific enough, not more.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between a class selector and an ID selector?**
A class selector (`.name`) matches every element with that class, and one element can have many classes. An ID selector (`#name`) matches the single element with that ID, which must be unique in the page. IDs also have much higher specificity (1,0,0 vs 0,1,0), so they are harder to override; classes are preferred for styling.

**Q2. What is the difference between `div p` and `div > p`?**
`div p` (descendant) matches every `<p>` anywhere inside a `<div>`, at any depth. `div > p` (child) matches only a `<p>` whose direct parent is a `<div>`. A `<p>` inside a `<section>` inside a `<div>` matches the first but not the second.

**Q3. With the HTML below, which paragraphs does `h2 + p` select, and which does `h2 ~ p` select?**

```html
<h2>Title</h2>
<p>A</p>
<p>B</p>
<div><p>C</p></div>
<p>D</p>
```

`h2 + p` selects only **A**, the element immediately after the `<h2>`. `h2 ~ p` selects **A, B and D**, every later sibling `<p>` with the same parent. **C** is never selected because it is inside the `<div>`, not a sibling of the `<h2>`.

**Q4. Which elements do `.box.red`, `.box .red` and `.box > .red` match?**

```html
<div class="box red">1</div>
<div class="box"><span class="red">2</span></div>
<div class="box"><p><span class="red">3</span></p></div>
```

`.box.red` (no space) matches only element 1, because it needs one element with both classes. `.box .red` (with a space) matches the spans 2 and 3, because it looks for a `.red` element anywhere inside a `.box`. `.box > .red` matches only span 2, the direct child; span 3 is a grandchild. Element 1 is not matched by the last two, since it is not inside another `.box`.

**Q5. What is the difference between a pseudo-class and a pseudo-element?**
A pseudo-class (single colon, e.g. `:hover`, `:first-child`) selects an existing element when it is in a particular state or position. A pseudo-element (double colon, e.g. `::before`, `::first-line`) targets a part of an element or creates a virtual element that is not in the HTML. Pseudo-classes count like a class in specificity; pseudo-elements count like an element.

**Q6. You wrote `.icon::before { color: red; }` but nothing appears. Why?**
`::before` is only generated when the `content` property is set. Add `content: "";` (or some text/image). An empty one is also inline and zero-sized, so give it `display: inline-block` and a size. Finally, check the element is not something like `<img>` or `<input>`, which cannot host generated content.

**Q7. Why must link styles be written in LVHA order?**
`:link`, `:visited`, `:hover` and `:active` have the same specificity, so when more than one applies, the one written later wins. If `:hover` is written before `:visited`, a visited link that is hovered keeps the `:visited` color. Writing `:link`, `:visited`, `:hover`, `:active` makes each state override the previous one correctly.

**Q8. Write a selector for all links that point to PDF files, and one for links to HTTPS sites.**
`a[href$=".pdf"]` uses the "ends with" attribute selector; to also match `.PDF`, add the case-insensitive flag: `a[href$=".pdf" i]`. `a[href^="https"]` uses the "starts with" selector.

**Q9. How do you style every odd row of a table, and what is the difference between `:nth-child()` and `:nth-of-type()`?**
`tr:nth-child(odd) { background: #f2f2f2; }`; `odd` is the same as `2n+1`, and `even` is `2n`. `:nth-child()` counts all element siblings, so `p:nth-child(2)` matches a `<p>` only if it is the second child of its parent. `:nth-of-type()` counts only siblings of the same tag, so `p:nth-of-type(2)` matches the second `<p>` even if other elements come before it. The same applies to `:first-child` vs `:first-of-type`: in `<div><h2></h2><p></p></div>`, `p:first-child` matches nothing but `p:first-of-type` matches the `<p>`.

### Mid-level (2–4 years)

**Q10. Does `.box:first-child` match anything here? Why?**

```html
<div class="boxes">
  <h2>Boxes</h2>
  <div class="box">A</div>
  <div class="box">B</div>
</div>
```

No. `.box:first-child` means "an element with class `box` that is the first child of its parent". The first child is the `<h2>`, which is not a `.box`. To select "A", use `.box:nth-child(2)`, `div:first-of-type`, or `:nth-child(1 of .box)`, which counts only `.box` siblings.

**Q11. What is the specificity of `.a.b`, `.a .b` and `.a > .b`, and which wins?**
All three are (0, 2, 0): two class selectors, and combinators add no specificity. If they set the same property on the same element, the one declared later in the stylesheet wins. They usually don't conflict anyway, because they match different elements (`.a.b` the element with both classes, the others a `.b` inside an `.a`).

**Q12. Why does `input::before { content: "*"; }` show nothing, and how do you add a required-field asterisk?**
`::before` inserts content inside the element, and an `<input>` is a void/replaced element that cannot have children, so there is nowhere to put it. Add the asterisk to the `<label>` instead, for example `label.required::after { content: " *"; color: red; }`, or style a wrapping element.

**Q13. Select every third item starting from the second (2, 5, 8, ...), and the last three items of a list.**
`li:nth-child(3n+2)` for 2, 5, 8, ... and `li:nth-last-child(-n+3)` for the last three. With `n = 0, 1, 2...`, `-n+3` gives 3, 2, 1 counted from the end.

**Q14. A stylesheet has `input::placeholder, input::-moz-placeholder { color: gray; }` and the color does not apply in Chrome. Why?**
Chrome does not recognise `::-moz-placeholder`, so the whole selector list is invalid and the entire rule is dropped; one invalid selector in a normal list invalidates every selector in it. Write prefixed selectors as separate rules, each with its own declarations. (`:is()`/`:where()` forgive unknown selectors, but they cannot contain pseudo-elements, so they do not help here.) Today plain `::placeholder` is supported everywhere, so the prefix is not needed.

**Q15. How do browsers match selectors, and does selector performance matter?**
Browsers match selectors from right to left: they start from the rightmost part (the key selector) and walk up the tree to check ancestors. For `.nav a`, every `<a>` is checked for a `.nav` ancestor. Modern engines are fast, so selector choice rarely matters for typical pages; problems appear with huge DOMs, very broad key selectors combined with long descendant chains, or heavy use of `:has()` on frequently changing content. Readability and specificity control are usually the bigger concerns.

**Q16. What problem does `:has()` solve? Give examples.**
`:has()` lets you style an element based on what it contains or what follows it, often called a "parent selector", which CSS could not do before without adding a class from JavaScript. For example, `.card:has(img) { padding-top: 0; }` styles cards that contain an image, and `form:has(input:invalid) button { opacity: 0.5; }` dims the submit button while any input is invalid. It also enables previous-sibling selection: `h2:has(+ p)`. It is supported in all current major browsers; give older ones a simpler default style.

**Q17. Why do teams avoid ID selectors and long nested selectors such as `#main .content ul li a` in large codebases?**
High and uneven specificity makes overrides hard, which leads to even longer selectors or `!important`. Long chains also tie CSS to the exact HTML structure, so a small markup change breaks styling. Conventions like BEM (`.menu__link--active`) keep selectors flat, single-class and predictable.

**Q18. A designer wants visited links to show a different background image. Why does `a:visited { background-image: url(tick.png); }` not work?**
Browsers restrict `:visited` to a small set of color properties to prevent history sniffing: if any layout or image could change, a page could measure it and learn which URLs the user has visited. Only properties like `color`, `background-color` and `border-color` are applied, and `getComputedStyle` reports the unvisited values. The feature cannot be implemented with `:visited`.

### Senior (5+ years)

**Q19. A team wants to replace a lot of JavaScript-toggled classes with `:has()`. What would you check before approving it?**
`:has()` moves work from JavaScript into style invalidation: whenever something inside the subject changes, the browser has to re-check whether the `:has()` condition still holds. Engines optimise this well for scoped cases, but some patterns are expensive on large, frequently mutating DOMs:

- Broad subjects with deep arguments, such as `body:has(.modal.open)` or `:has(*)`, on pages with live-updating lists.
- Arguments that use descendant combinators where a child or sibling would do (`.card:has(> img)` is cheaper to reason about than `.card:has(img)`).
- Using it for state that JavaScript already knows (a menu that JS opens anyway can set `aria-expanded`).

Measure with a Performance recording ("Recalculate Style" time, and the selector stats option in Chromium DevTools) on a realistic page. Recommendation: use `:has()` freely for local, structure-based styling (cards with images, forms with invalid fields), anchor it on a specific class with a shallow argument, and keep a JavaScript-set attribute for global, high-frequency state.

**Q20. How should a component library expose state for styling: classes, `data-*` attributes or ARIA attributes?**
Each has a place:

| Hook | Good for | Example |
|---|---|---|
| ARIA / native attributes | State that assistive technology must also know | `[aria-expanded="true"]`, `[aria-current="page"]`, `:disabled`, `[aria-invalid="true"]` |
| `data-*` attributes | Visual variants and state with no accessibility meaning | `[data-variant="ghost"]`, `[data-state="loading"]` |
| Classes | Static styling hooks and variants in class-based systems | `.btn--primary` |

Styling from ARIA state ties the visual state to the accessible state, so a button cannot look expanded while screen readers hear "collapsed". `data-*` attributes keep a clean key-value API without class-name string juggling. Recommendation: style real UI state from ARIA or native attributes, variants from `data-*` or modifier classes, and never let consumers depend on internal structure (`.card > div:nth-child(2)`); expose documented classes, custom properties or `::part()` instead.

**Q21. QA's end-to-end tests break every time the design team renames a class. What policy would you set for selectors used by JavaScript and tests?**
The problem is that one hook serves three audiences. Styling classes change for visual reasons, so JavaScript and tests that query them break during harmless refactors, and developers become afraid to delete "unused" CSS because something might query it. Separate the contracts:

- **Styling**: classes and attributes owned by CSS; free to rename.
- **Behaviour**: JavaScript hooks that are clearly not styling, such as `data-js="cart-toggle"` or a `js-` class prefix that CSS never targets.
- **Tests**: query by role and accessible name first (Testing Library's `getByRole('button', { name: 'Add to cart' })`, Playwright's `getByRole`), which also tests accessibility; fall back to `data-testid` for elements with no good role.

Recommendation: write this into the contribution guide, add a lint rule that forbids CSS selectors on `data-js`/`data-testid`, and migrate the flakiest tests to role-based queries first.

**Q22. A designer asks to remove focus outlines because they "look ugly when clicking". How do you handle it across a design system?**
Removing outlines with `*:focus { outline: none; }` makes the site unusable for keyboard users, and it fails WCAG 2.4.7 (Focus Visible). The legitimate need is to avoid rings on mouse clicks, and `:focus-visible` solves exactly that: browsers show it for keyboard focus and for inputs, and usually not for mouse clicks on buttons.

```css
:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
```

Use `outline` (not `box-shadow` alone) because Windows forced-colors mode removes box shadows but keeps outlines; if a component needs a shadow-style ring, add `outline: 2px solid transparent` as well so a ring still appears in forced colors. Recommendation: one shared focus style built on `:focus-visible` as a design token, a lint rule against `outline: none` without a replacement, and keyboard-only checks in component review.

> **Note:** Related questions answered elsewhere: [Specificity and the cascade](../03-specificity-and-cascade/notes.md#interview-questions) (`:is()` vs `:where()`).

## References

- [MDN: CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_selectors)
- [MDN: Pseudo-classes](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes)
- [MDN: Pseudo-elements](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements)
- [MDN: Attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors)
- [MDN: :nth-child()](https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-child)
- [MDN: :has()](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)
- [MDN: :user-invalid](https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid)
- [MDN: ::before](https://developer.mozilla.org/en-US/docs/Web/CSS/::before)
- [MDN: ::selection](https://developer.mozilla.org/en-US/docs/Web/CSS/::selection)
- [MDN: ::placeholder](https://developer.mozilla.org/en-US/docs/Web/CSS/::placeholder)
- [MDN: Descendant combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Descendant_combinator)
- [web.dev: Learn CSS - Selectors](https://web.dev/learn/css/selectors)
- [web.dev: Learn CSS - Pseudo-classes](https://web.dev/learn/css/pseudo-classes)
- [web.dev: Learn CSS - Pseudo-elements](https://web.dev/learn/css/pseudo-elements)
- [W3Schools: CSS Selectors](https://www.w3schools.com/css/css_selectors.asp)
- [W3Schools: CSS Attribute Selectors](https://www.w3schools.com/css/css_attribute_selectors.asp)
- [Stack Overflow: What is the difference between the selectors ".class.class" and ".class .class"?](https://stackoverflow.com/questions/17391364/what-is-the-difference-between-the-selectors-class-class-and-class-class)
