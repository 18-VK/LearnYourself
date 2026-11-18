# Selecting DOM Elements

> JavaScript · Topic 22 · Demo: [index.html](index.html) · [script.js](script.js) · Open index.html in a browser and check the devtools console.

Before you can change an element, you have to find it. JavaScript gives several ways to select DOM elements: by ID, by class, by tag name, or by any CSS selector. They differ in what they return (one element or a collection), what they return when nothing matches, and whether the result updates itself when the page changes.

## Quick comparison

| Method | Selects by | Returns | Nothing found | Live? |
|---|---|---|---|---|
| `getElementById("id")` | ID | One `Element` | `null` | n/a |
| `getElementsByClassName("cls")` | Class name(s) | `HTMLCollection` | Empty collection | **Live** |
| `getElementsByTagName("tag")` | Tag name | `HTMLCollection` | Empty collection | **Live** |
| `querySelector("css")` | Any CSS selector | First matching `Element` | `null` | n/a |
| `querySelectorAll("css")` | Any CSS selector | `NodeList` | Empty `NodeList` | **Static** |

The demo page used in every example below:

```html
<div class="container">
    <div class="box">BOX1</div>
    <div id="B2" class="box">BOX2</div>
    <div class="box box3">BOX3</div>
    <div class="box">BOX4</div>
    <div class="box">BOX5</div>
</div>
```

## Using `getElementById`

`getElementById` selects an element by its `id`. It returns the element object if it finds one with that ID, otherwise `null`.

```js
let element = document.getElementById("myId");
```

From the demo:

```js
let box2 = document.getElementById("B2");
console.log(box2);                 // → <div id="B2" class="box">BOX2</div>
box2.style.backgroundColor = "green";

console.log(document.getElementById("nope")); // → null
```

- Pass the ID **without** `#`. `getElementById("#B2")` looks for an element whose id is literally `#B2` and returns `null`.
- IDs should be unique. If the page has duplicates, the first one in document order is returned.
- It exists on `document` (and `DocumentFragment`), not on ordinary elements. To search inside an element, use `element.querySelector("#id")`.
- It is the fastest selector, because browsers keep an internal map from ID to element.

## Using `getElementsByClassName`

`getElementsByClassName` selects elements by class name. It returns a collection (`HTMLCollection`) of all elements in the document with that class, even if there is only one.

```js
let elements = document.getElementsByClassName("myClass");
```

From the demo:

```js
let box3 = document.getElementsByClassName("box3");
console.log(box3);       // → HTMLCollection [div.box.box3]   (a collection, not an element)

box3[0].style.backgroundColor = "red"; // index into the collection to get the element
```

- Pass the class name **without** a dot.
- Pass several names separated by spaces to match elements that have **all** of them: `getElementsByClassName("box box3")` matches only BOX3.
- It can be called on any element to search only inside it: `container.getElementsByClassName("box")`.
- The result has no `.style`. `box3.style.backgroundColor = "red"` throws `TypeError: Cannot set properties of undefined`.

## Using `getElementsByTagName`

This method returns all the elements that match the given tag name, as a live `HTMLCollection`.

```js
let listElements = document.getElementsByTagName("li");
```

From the demo:

```js
let divElements = document.getElementsByTagName("div");
console.log(divElements); // → HTMLCollection(6) [div.container, div.box, div#B2.box, div.box.box3, div.box, div.box, ...]

for (let index = 0; index < divElements.length; index++) {
  divElements[index].style.textAlign = "center";
}
```

> **Note:** The collection has 6 items, not 5, because the `.container` div is a `div` too. A tag selector catches every element of that type in the searched area.

`getElementsByTagName("*")` returns every element.

## Using `querySelector`

`querySelector` returns the **first** element that matches a CSS selector, searching in document order. The remaining matches are ignored. If nothing matches it returns `null`.

- `document.querySelector("li")` returns the first element matching the CSS selector `li`.
- `document.querySelector(".heading")` returns the first element matching the selector `.heading`.
- `document.querySelector("#item")` returns the first element matching the selector `#item`.

As you can see, any CSS selector you would write in a normal CSS file works inside `querySelector`:

```js
document.querySelector(".container > .box:nth-child(2)"); // → BOX2
document.querySelector(".box.box3");                       // → BOX3 (has both classes)
document.querySelector("div[id='B2']");                    // attribute selector → BOX2
document.querySelector(".box:last-child");                 // → BOX5
document.querySelector("input[type='email']");             // first email input, or null
```

From the demo:

```js
let element = document.querySelector(".box"); // the first .box → BOX1
element.style.width = "50px";
```

An invalid selector throws an error instead of returning `null`:

```js
document.querySelector("#1st");  // → SyntaxError: '#1st' is not a valid selector (CSS ids cannot start with a digit)
document.getElementById("1st");  // → works, no CSS parsing involved
document.querySelector("#" + CSS.escape("1st")); // → works, the id is escaped
```

## Using `querySelectorAll`

`querySelectorAll` returns **all** elements that match the CSS selector, as a static `NodeList`. If nothing matches, it returns an empty `NodeList` (length 0), not `null`.

```js
let elements = document.querySelectorAll(".box");
console.log(elements.length); // → 5

for (let index = 0; index < elements.length; index++) {
  elements[index].style.height = "120px";
}

// NodeList has forEach, so this also works:
elements.forEach((el) => (el.style.height = "120px"));

// Several selectors at once (comma = OR), returned in document order
document.querySelectorAll("#B2, .box3"); // → NodeList(2) [div#B2.box, div.box.box3]
```

## Live `HTMLCollection` vs static `NodeList`

This is the most important difference between the old `getElementsBy*` methods and the `querySelector*` methods.

| | `getElementsByClassName` / `getElementsByTagName` | `querySelectorAll` |
|---|---|---|
| Return type | `HTMLCollection` | `NodeList` |
| Live or static | **Live**: updates automatically when matching elements are added, removed or change class | **Static**: a snapshot taken when you called it |
| `forEach` | No | Yes |
| Can contain | Elements only | Elements only (from `querySelectorAll`) |
| Selector power | One class list or one tag name | Any CSS selector |

```js
const live = document.getElementsByClassName("box");
const snapshot = document.querySelectorAll(".box");
console.log(live.length, snapshot.length); // → 5 5

const extra = document.createElement("div");
extra.className = "box";
document.querySelector(".container").append(extra);

console.log(live.length, snapshot.length); // → 6 5
```

> **Note:** `childNodes` is also a `NodeList`, but a **live** one. "NodeList means static" is only true for `querySelectorAll`.

The classic bug with live collections: changing the property you selected on while looping forward.

```js
// suppose three elements have class "red"
const reds = document.getElementsByClassName("red"); // live, length 3
for (let i = 0; i < reds.length; i++) {
  reds[i].classList.remove("red"); // the element leaves the collection immediately
}
// Only the 1st and 3rd elements changed. The 2nd moved to index 0 and was skipped.

// Fix: use a static list
document.querySelectorAll(".red").forEach((el) => el.classList.remove("red"));
```

## Searching inside an element (scoped queries)

All of these methods except `getElementById` can be called on an element, to search only among its descendants:

```js
const container = document.querySelector(".container");
container.querySelectorAll(".box");          // only boxes inside .container
container.getElementsByTagName("div");       // only divs inside .container (5, the container itself is not included)
container.querySelector(":scope > .box");    // a direct child .box of container
```

> **Note:** With `element.querySelectorAll(selector)` the selector is still matched against the **whole document**; only the results are limited to descendants. So `container.querySelectorAll("body .box")` finds the boxes even though `body` is outside `container`. Use `:scope` to anchor the selector to the element itself.

## Related helpers: `closest()` and `matches()`

```js
const box2 = document.getElementById("B2");

box2.matches(".box");         // → true   (does this element match the selector?)
box2.matches(".box3");        // → false

box2.closest(".container");   // → <div class="container">  (nearest ancestor matching, starting with itself)
box2.closest(".box");         // → box2 itself
box2.closest("table");        // → null
```

`closest()` is used a lot in event delegation to find which item was clicked (see [Events and event delegation](../24-events-and-delegation/notes.md#event-delegation)).

## Changing styles through the `style` object

Once you have an element, its `style` property gives access to its **inline** styles. CSS property names become camelCase, and values are strings with units:

```js
const box = document.getElementById("B2");
box.style.backgroundColor = "green"; // background-color
box.style.width = "50px";            // "50" without a unit is ignored
box.style.textAlign = "center";      // text-align
box.style.setProperty("border-radius", "8px"); // the CSS name also works through setProperty
box.style.backgroundColor = "";      // remove the inline style again
```

`element.style` only **reads** inline styles, not the styles coming from a stylesheet:

```js
console.log(box.style.marginTop);             // → "" (the margin comes from the <style> block, not inline)
console.log(getComputedStyle(box).marginTop); // → "10px" (the final value the browser uses)
```

For more than one or two properties, it is cleaner to toggle a CSS class (`box.classList.add("active")`) and keep the styles in CSS.

## Common Mistakes

- **Adding `#` or `.` to the wrong method.** `getElementById("#B2")` and `getElementsByClassName(".box")` find nothing. Only `querySelector*` takes CSS syntax.
- **Treating a collection like an element.** `getElementsByClassName(...)` and `querySelectorAll(...)` return lists; use `[0]`, a loop, or `querySelector` for one element.
- **Not checking for `null`.** `document.querySelector(".missing").style...` throws `TypeError: Cannot read properties of null`. Check first, or use optional chaining when the element is optional: `document.querySelector(".missing")?.remove()`.
- **Calling `forEach` on an `HTMLCollection`.** It does not exist; use `for...of` or `Array.from()`.
- **Changing a live collection while looping forward over it** (see the example above).
- **Selecting before the element exists.** In this demo the script is at the end of `<body>`, so all boxes are already parsed.
- **Re-querying the same element inside a loop.** Store the result in a variable once.
- **Reading styles with `element.style`.** It only sees inline styles; use `getComputedStyle()` for the real value.

## Key Takeaways

- `getElementById` returns one element or `null`; it is the fastest way to grab a single, unique element.
- `getElementsByClassName` and `getElementsByTagName` return a **live** `HTMLCollection` that you must index or loop over.
- `querySelector` returns the first match of any CSS selector or `null`; `querySelectorAll` returns a **static** `NodeList` (empty if nothing matches) that supports `forEach`.
- Live collections change while you modify the DOM; use `querySelectorAll` or `Array.from()` when looping and modifying.
- Every method except `getElementById` can be scoped to an element; use `:scope` to anchor selectors.
- `matches()` tests an element against a selector, `closest()` finds the nearest matching ancestor.
- `element.style` writes inline styles in camelCase and only reads inline styles; use `getComputedStyle()` to read final values.

## Interview Questions

### Junior (0–1 year)

**Q1. What are the different ways to select elements in the DOM?**
`getElementById` (one element by ID), `getElementsByClassName` and `getElementsByTagName` (live collections), `querySelector` (first match of a CSS selector) and `querySelectorAll` (all matches, static NodeList). There is also `getElementsByName` for the `name` attribute, and `closest()` to search upwards from an element.

**Q2. What is the difference between `getElementById("x")` and `querySelector("#x")`?**
Both return the first element with id `x` or `null`. `getElementById` takes a plain ID string and only exists on `document`; it is slightly faster and works with IDs that are not valid CSS (such as `"1st"`). `querySelector` takes a CSS selector, so the ID needs `#` (and escaping if it starts with a digit), but it can be called on any element and can combine the ID with other conditions, such as `"#x.active"`.

**Q3. What do these return when nothing matches: `querySelector`, `querySelectorAll`, `getElementsByClassName`?**
`querySelector` returns `null`. `querySelectorAll` returns an empty `NodeList` and `getElementsByClassName` an empty `HTMLCollection`, both with `length` 0. So you check `if (el)` for a single element, but `if (list.length)` for collections, since an empty collection is still truthy.

**Q4. Why does this throw an error?**
```js
document.getElementsByClassName("box").style.color = "red";
```
`getElementsByClassName` returns an `HTMLCollection`, which has no `style` property, so `.style` is `undefined` and setting `.color` on it throws `TypeError: Cannot set properties of undefined`. Index into it (`[0]`) or loop over every element.

**Q5. With the demo HTML, what do these log?**
```js
console.log(document.querySelectorAll(".box").length);
console.log(document.getElementsByTagName("div").length);
console.log(document.querySelector(".box").textContent);
```
`5`, `6` and `"BOX1"`. There are five `.box` elements, but six `div`s because the `.container` is also a `div`. `querySelector` returns only the first match in document order, which is BOX1.

**Q6. How would you select all checked checkboxes inside a form with id `signup`?**
```js
const checked = document.querySelectorAll("#signup input[type='checkbox']:checked");
checked.forEach((cb) => console.log(cb.value));
```
`querySelectorAll` accepts any CSS selector, including attribute selectors and pseudo-classes like `:checked`.

### Mid-level (2–4 years)

**Q7. Explain live vs static collections and describe a bug caused by a live collection.**
`getElementsByClassName`, `getElementsByTagName`, `children` and `childNodes` are live: they always reflect the current DOM. `querySelectorAll` returns a static snapshot. The classic bug: you loop forward over `getElementsByClassName("todo")` and remove the `todo` class from each item. Each removed item drops out of the collection immediately, the next one shifts into its index, and the loop skips every second item. Use `querySelectorAll`, iterate over `Array.from(collection)`, or loop backwards.

**Q8. Which selector method is fastest, and does it matter?**
`getElementById` is fastest because browsers keep an ID-to-element map; `getElementsBy*` are also fast, and browsers can reuse their live collection objects between calls. `querySelector*` has to parse the selector and match it, which is slower on paper. In real apps the difference rarely matters compared to layout and paint. What does matter: avoid re-querying in loops or hot paths (cache the result), scope queries to a container, and avoid very broad selectors over huge DOMs.

**Q9. `el.style.color` returns an empty string even though the text is visibly blue. Why?**
`element.style` only reflects the element's inline `style` attribute. The blue comes from a stylesheet, so the inline value is empty. Use `getComputedStyle(el).color`, which returns the final resolved value (as `rgb(...)`). Note that `getComputedStyle` can force a style/layout calculation, so do not call it repeatedly inside a loop that also writes styles.

**Q10. What do `closest()` and `matches()` do and where are they useful?**
`el.matches(selector)` returns `true` if the element itself matches the selector. `el.closest(selector)` walks up from the element (including itself) and returns the first ancestor that matches, or `null`. In event delegation, `e.target` may be a nested `<span>` or `<svg>` inside the button you care about, so `e.target.closest("button.delete")` finds the real button.

**Q11. `document.querySelector("#2024-report")` throws a `SyntaxError`. Why, and how do you fix it?**
HTML allows an `id` that starts with a digit, but CSS identifiers cannot, so `#2024-report` is not a valid selector and `querySelector` throws instead of returning `null`. (In a stylesheet the same selector is simply invalid, and the whole rule is dropped.) Fixes:
```js
document.getElementById("2024-report");                     // no CSS parsing involved
document.querySelector('[id="2024-report"]');               // attribute selector, any string works
document.querySelector("#" + CSS.escape("2024-report"));    // the selector becomes #\32 024-report
```
In a stylesheet, write the escaped form by hand: `#\32 024-report { ... }`. Here `\32` is the hex code point of "2", and the space after it only ends the escape. The same applies to IDs with characters like `.` or `:` (common in generated IDs; React 18's `useId()` returns values like `:r0:`). Always use `CSS.escape()` when you build a selector from a value you do not control, and prefer IDs that start with a letter (`report-2024`) when you name them yourself.

**Q12. `container.querySelectorAll("div .item")` returns items you did not expect. What is going on?**
The selector is matched against the whole document and only the results are restricted to descendants of `container`. If `container` itself is a `div`, or sits inside one, then every `.item` inside it satisfies `div .item`, even if no `div` exists between the container and the item. Anchor the selector with `:scope`: `container.querySelectorAll(":scope div .item")` or `":scope > .item"` for direct children.

### Senior (5+ years)

**Q13. In a large codebase, what should JavaScript and tests use to find elements: IDs, styling classes, `data-*` attributes or ARIA roles?**
Styling classes are the worst hook: they change whenever someone refactors CSS, and with CSS Modules or utility frameworks they are hashed or meaningless (`.flex.p-4`). Global IDs collide as soon as a component renders twice. Behaviour should hook onto something whose only job is to be selected, such as `data-action="delete"` or `data-js="search"`, so designers can change classes without breaking scripts.

For tests, query the way users find things: by role and accessible name (`getByRole("button", { name: "Delete" })` in Testing Library), falling back to `data-testid` only when there is no accessible handle. That keeps tests stable and catches accessibility regressions for free. Recommendation: a written convention (roles and labels for tests, `data-*` hooks for behaviour, classes for styling only), enforced with an ESLint rule that bans selecting by class in tests.

**Q14. A reusable component calls `document.querySelector(".dropdown-panel")`. It works on the demo page but breaks when two instances are on the same page. Why, and what is the right pattern?**
`document.querySelector` searches the whole page and returns the first match, which belongs to whichever instance came first in the document. Hard-coded IDs have the same problem and also make the HTML invalid. A reusable component must only ever look inside its own root: keep a reference to the root element and query with `root.querySelector(...)`, or in a framework use refs instead of selectors. When IDs are needed for `aria-controls`, `aria-labelledby` or `<label for>`, generate unique ones per instance (`useId()` in React, or a counter). Recommendation: lint against `document.querySelector` inside component code; components receive or own their root and never search outside it.

**Q15. A module caches `const header = document.querySelector("#header")` at load time. After a few navigations in the single-page app, updates to `header` stop appearing on screen. What is happening?**
The router or framework replaced the header element with a new node, so the cached reference points to a detached element: writes succeed without errors but nothing on screen changes, and the old node cannot be garbage-collected. `header.isConnected === false` confirms it. Caching is right for elements whose lifetime matches the module (for example `document.body`); for anything a framework renders, query lazily from a stable root when you need it, or get the element through the framework's ref and lifecycle. Recommendation: cache only elements you created or that live as long as the page, and add an `isConnected` assertion in development builds for long-lived references.

**Q16. You want to use `:has()` in `querySelector`, for example `form:has(input:invalid)`. What do you need to consider?**
`:has()` has been supported in all major engines since late 2023, but an older browser treats it as an invalid selector, and in JavaScript an invalid selector **throws a `SyntaxError`** instead of returning `null`. In CSS, by contrast, the rule is just ignored. So in JavaScript, guard new selector syntax with `CSS.supports("selector(:has(*))")` and fall back to code (for example `[...forms].filter((f) => f.querySelector("input:invalid"))`). Performance is rarely a problem for one-off queries, but a broad `:has()` re-evaluated on every DOM change in CSS can be costly on large pages. Recommendation: feature-detect any selector newer than your browser support matrix before using it in JavaScript, and keep `:has()` anchored to a specific element rather than `*` or `body`.

## References
- [W3Schools: DOM Style object properties](https://www.w3schools.com/jsref/dom_obj_style.asp)
- [MDN: Document.getElementById()](https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById)
- [MDN: Document.querySelector()](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector)
- [MDN: Document.querySelectorAll()](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll)
- [MDN: HTMLCollection](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCollection)
- [MDN: NodeList](https://developer.mozilla.org/en-US/docs/Web/API/NodeList)
- [MDN: Element.closest()](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest)
- [MDN: Window.getComputedStyle()](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)
- [MDN: CSS.escape()](https://developer.mozilla.org/en-US/docs/Web/API/CSS/escape_static)
- [MDN: :has()](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)
- [Testing Library: About queries (priority)](https://testing-library.com/docs/queries/about/#priority)
