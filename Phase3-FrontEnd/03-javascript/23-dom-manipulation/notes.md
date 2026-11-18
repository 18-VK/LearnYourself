# DOM Element Properties, Attributes, and Inserting/Removing Elements

> JavaScript · Topic 23 · Demo: [index.html](index.html) · [script.js](script.js) · Open index.html in a browser and check the devtools console.

Once you have selected an element, you need to read and change it: its tag, its HTML, its text, its attributes and classes. You also need to build new elements and put them into the page, move them, copy them and remove them. This lecture covers those everyday DOM operations, plus the security (XSS) and performance (reflow) issues that come with them.

## Printing an element: `console.log` vs `console.dir`

| Method | Shows |
|---|---|
| `console.log(el)` | The element as a DOM tree (HTML-like markup you can expand) |
| `console.dir(el)` | The element as a JavaScript object, with all its properties (`id`, `className`, `childNodes`, `style`, ...) |

```js
const box = document.querySelector(".box");
console.log(box); // → <div class="box " data-boxnumber="4">Box1</div>
console.dir(box); // → div.box  (expand it to see every property of the object)
```

> **Note:** The console shows objects lazily. When you expand a logged element or collection, you see its state **at the moment you expand it**, not when it was logged. In this demo the script changes the page after logging, so expanded objects can look different from what the code had at that line.

## Tag name: `tagName` vs `nodeName`

Both are used to read the tag name of an element.

| | `tagName` | `nodeName` |
|---|---|---|
| Defined on | Elements only | Every node |
| For an element | `"DIV"` (uppercase in HTML) | `"DIV"` (same as `tagName`) |
| For a text node | `undefined` | `"#text"` |
| For a comment | `undefined` | `"#comment"` |

```js
let cont = document.body.getElementsByClassName("container");
console.log(cont);                            // → HTMLCollection [div.container]
console.log(cont[0].tagName);                 // → "DIV"   (nodeName would also work here)
console.log(document.body.firstChild.nodeName); // → "#text" (a whitespace text node)
console.log(document.body.firstChild.tagName);  // → undefined (tagName does not exist on non-elements)
```

## `innerHTML` and `outerHTML`

- **`innerHTML`** gets or sets the HTML **inside** the element as a string. It is valid for element nodes only.
- **`outerHTML`** contains the full HTML: `innerHTML` plus the element itself.

```js
const box1 = cont[0].firstElementChild;

console.log(box1.innerHTML); // → "Box1"
console.log(box1.outerHTML); // → '<div class="box " data-boxnumber="4">Box1</div>'

box1.innerHTML = "<b>Box1</b>";            // replaces the children; the string is parsed as HTML
box1.outerHTML = "<section>New</section>"; // replaces the whole element in the page
console.log(box1.isConnected);             // → false: box1 still points to the OLD, now-detached div
```

> **Note:** `innerHTML` and `outerHTML` are only valid for element nodes. For other node types (text, comment) use `nodeValue` or `data`.

## `nodeValue` and `data` for text and comment nodes

```js
console.log(cont[0].childNodes);
// → NodeList(11) [text, comment, text, div.box, text, div.box, text, div.box, text, div.box, text]
//   the second node is the comment <!-- Comment node data -->

console.log(cont[0].childNodes[1].nodeValue); // → " Comment node data "
console.log(cont[0].childNodes[1].data);      // → " Comment node data " (same thing)
```

## `textContent`

The `textContent` property sets or returns the text content of the specified node **and all its descendants**.

```js
console.log(cont[0].textContent);
// → "\n        \n        Box1\n        Box2\n        Box3\n        Box4\n    "
//   all text from all descendants, whitespace included; comments are not included

const p = document.createElement("p");
p.textContent = "<b>not bold</b>";
console.log(p.innerHTML); // → "&lt;b&gt;not bold&lt;/b&gt;" (shown as literal text, nothing parsed)
```

Setting `textContent` removes all children and puts a single text node in their place.

### `innerHTML` vs `textContent` vs `innerText`

| | `innerHTML` | `textContent` | `innerText` |
|---|---|---|---|
| Reads | Markup as an HTML string | All text of all descendants, raw whitespace, including hidden elements and `<script>`/`<style>` contents | Only the **rendered** text a user sees: hidden elements skipped, whitespace collapsed |
| Writing | Parses the string as HTML | Inserts plain text | Inserts plain text; `\n` becomes `<br>` |
| Speed | Slower (HTML parsing) | Fastest | Slow: needs up-to-date layout, so it can trigger a reflow |
| XSS risk | **Yes**, with untrusted input | No | No |
| Exists on | Elements | All nodes | HTML elements |

### Security: `innerHTML` and XSS

Any string you assign to `innerHTML` is parsed as HTML. If any part of it comes from a user (form input, URL, API response), an attacker can inject markup that runs JavaScript. This is called cross-site scripting (XSS).

```js
const userInput = `<img src="x" onerror="alert('hacked')">`;

el.innerHTML = userInput;   // the image fails to load, onerror runs → the attacker's code executes
el.textContent = userInput; // shown as harmless text
```

`<script>` tags inserted through `innerHTML` do not run, but inline event attributes such as `onerror` do, so "it has no script tag" is not protection.

Safe options:
- use `textContent` (or `createTextNode`) for text;
- build elements with `createElement` and set properties;
- if you must insert user-provided HTML, sanitize it with a library such as DOMPurify;
- React escapes text by default; its `dangerouslySetInnerHTML` is the `innerHTML` equivalent and carries the same risk.

## The `hidden` property

The `hidden` attribute and the matching DOM property specify whether the element is visible or not.

```html
<div hidden>I am hidden</div>                 <!-- hidden using the hidden attribute -->
<div id="NotHiddenEle">I am not hidden</div>  <!-- made hidden using JS -->
```

```js
let ele = document.getElementById("NotHiddenEle");
ele.hidden = true;  // adds the hidden attribute → element disappears
ele.hidden = false; // removes it → element shows again
```

- `hidden` is a **boolean attribute**: its presence hides the element, whatever its value. `<div hidden="false">` is still hidden.
- The browser implements it as `display: none`. A CSS rule that sets `display` on the element (for example `.card { display: flex; }`) wins, and the element stays visible. Add `[hidden] { display: none !important; }` to your CSS if you rely on it.

| | `hidden` / `display: none` | `visibility: hidden` | `opacity: 0` |
|---|---|---|---|
| Takes up space | No | Yes | Yes |
| Can be clicked | No | No | Yes |
| Read by screen readers | No | No | Yes |

## Attribute methods

| Method / property | What it does | Demo result |
|---|---|---|
| `el.hasAttribute(name)` | Returns `true` if the attribute exists, otherwise `false` | |
| `el.getAttribute(name)` | Gets the value of an attribute (`null` if it does not exist) | `"NotHiddenEle"` |
| `el.setAttribute(name, value)` | Sets the value of an attribute (adds it if missing); the value is converted to a string | |
| `el.removeAttribute(name)` | Removes the attribute from the element | |
| `el.attributes` | A **property** (not a method) that returns the collection of all attributes as a `NamedNodeMap` | |
| `document.createAttribute(name)` | Creates an attribute and returns it as an `Attr` object; add it with `el.setAttributeNode(attr)` | |
| `el.toggleAttribute(name)` | Adds the attribute if missing, removes it if present (handy for boolean attributes) | |

From the demo:

```js
let ele = document.getElementById("NotHiddenEle");
ele.hidden = true;

if (ele.hasAttribute("hidden")) {          // true, because ele.hidden = true added the attribute
  console.log("using hasAttribute");
  ele.hidden = false;
}

console.log(ele.getAttribute("id"));       // → "NotHiddenEle"

ele.setAttribute("class", "Class1");
console.log(ele.hasAttribute("class"));    // → true

ele.removeAttribute("class");
console.log(ele.hasAttribute("class"));    // → false

console.log(ele.attributes);               // → NamedNodeMap {0: id, id: id, length: 1}

const att = document.createAttribute("hidden");
att.value = true;                          // stored as the string "true"
ele.setAttributeNode(att);
console.log(ele.attributes);               // → NamedNodeMap {0: id, 1: hidden, id: id, hidden: hidden, length: 2}
console.log(ele.outerHTML);                // → '<div id="NotHiddenEle" hidden="true">I am not hidden</div>'
```

So at the end of the demo "I am not hidden" is in fact hidden again.

`setAttribute(name, value)` and `setAttributeNode(attrObject)` do the same job; the second takes an `Attr` object made with `createAttribute`. In modern code `setAttribute` is simpler and almost always used. (The difference is explained in the W3Schools link in the references.)

### Attributes vs properties

HTML **attributes** are what is written in the markup. DOM **properties** are fields on the JavaScript object. Many are linked, but not all in the same way:

```html
<input id="name" value="hello">
<a id="link" href="/about">About</a>
```

```js
const input = document.getElementById("name");
input.value = "typed by user";
console.log(input.getAttribute("value")); // → "hello"          (attribute = initial/default value)
console.log(input.value);                 // → "typed by user"  (property = current value)

const link = document.getElementById("link");
console.log(link.getAttribute("href"));   // → "/about"          (exactly as written)
console.log(link.href);                   // → "http://.../about" (resolved full URL)
```

| Attribute | Property | Note |
|---|---|---|
| `class` | `className` / `classList` | `class` is a reserved word in JS |
| `for` (on `<label>`) | `htmlFor` | `for` is a reserved word in JS |
| `value` | `value` | Attribute = default value; property = current value |
| `checked` | `checked` | Attribute = default; property = current state (boolean) |
| `data-user-id` | `dataset.userId` | See next section |

## Custom data: `data-*` attributes and `dataset`

HTML is designed with extensibility in mind for data that should be associated with a particular element but need not have any defined meaning. `data-*` attributes allow us to store extra information on standard HTML elements, without hacks like non-standard attributes.

The `dataset` read-only property of the `HTMLElement` interface provides read/write access to custom data attributes (`data-*`) on elements. It exposes a map of strings (`DOMStringMap`) with an entry for each `data-*` attribute. ("Read-only" means you cannot replace `el.dataset` itself; its entries can be read, changed, added and deleted.)

```html
<button id="buy" data-product-id="42" data-in-stock="true">Buy</button>
```

```js
const btn = document.getElementById("buy");
console.log(btn.dataset.productId);  // → "42"   (data-product-id → productId)
console.log(btn.dataset.inStock);    // → "true" (always a string, not a boolean)

btn.dataset.color = "red";           // adds data-color="red"
delete btn.dataset.inStock;          // removes data-in-stock
console.log(btn.outerHTML);
// → '<button id="buy" data-product-id="42" data-color="red">Buy</button>'
```

Naming rule: after `data-`, each dash followed by a letter becomes camelCase: `data-product-id` ↔ `dataset.productId`.

> **Note:** The demo writes `data-BoxNumber = "4"`. HTML attribute names are case-insensitive and the parser lowercases them, so the attribute becomes `data-boxnumber` and the demo logs `DOMStringMap {boxnumber: '4'}`. `dataset.boxNumber` is `undefined`; you would need `data-box-number` in the HTML to get `dataset.boxNumber`.

## Creating, inserting and removing nodes

### Creating nodes

```js
const div_box = document.createElement("div"); // a new, detached <div>
div_box.setAttribute("class", "box");          // or: div_box.className = "box"
div_box.innerHTML = "Box5";                    // or (safer for plain text): div_box.textContent = "Box5"

const text_node = document.createTextNode("This is new text node");
```

A new element exists only in memory until you insert it somewhere in the document.

### Classic methods (called on the parent)

| Method | Description |
|---|---|
| `document.createElement(tag)` | Create an HTML element |
| `parent.appendChild(child)` | Add a child as the last child of `parent` |
| `parent.insertBefore(newNode, referenceNode)` | Insert `newNode` before `referenceNode`, as a child of `parent` |
| `parent.replaceChild(newChild, oldChild)` | Replace `oldChild` with `newChild` |
| `parent.removeChild(child)` | Remove a child from `parent` |

> **Note:** The original notes (copied from a W3Schools table) wrote `document.removeChild(element)`, `document.appendChild(element)` and `document.replaceChild(new, old)`. These methods are called on the **parent** of the node you want to change, for example `container.appendChild(box)`. Calling them on `document` makes the document itself the parent, which is almost never what you want: `document.appendChild(div)` throws, because a document can have only one root element.

### `insertBefore()`

The `insertBefore()` method of the `Node` interface inserts a node before a reference node, as a child of the specified parent node.

Syntax: `parent.insertBefore(newNode, referenceNode)`

```js
const container = document.querySelector(".container");
const temp_box = document.createElement("div");
temp_box.setAttribute("class", "box");
temp_box.innerHTML = "temp box";

container.insertBefore(temp_box, div_box); // temp_box goes just before div_box
container.insertBefore(temp_box, null);    // a null reference means "append at the end"
```

For more on insertion methods, check [JS_Chapterwise_Notes.pdf](../../_resources/JS_Chapterwise_Notes.pdf) in the `_resources` folder.

### Modern methods

| Method | Where it inserts / what it does |
|---|---|
| `parent.append(...nodesOrStrings)` | At the end, inside `parent` |
| `parent.prepend(...nodesOrStrings)` | At the start, inside `parent` |
| `el.before(...nodesOrStrings)` | Just before `el`, as a sibling |
| `el.after(...nodesOrStrings)` | Just after `el`, as a sibling |
| `el.replaceWith(...nodesOrStrings)` | Replaces `el` |
| `el.remove()` | Removes `el` ("remove yourself") |
| `parent.replaceChildren(...nodes)` | Replaces all children; with no arguments it empties `parent` |

Using the variables from the demo's `script.js`:

```js
container.append(div_box);       // add node at the end
document.body.append(text_node); // a text node works too
container.prepend("Start: ");    // strings become text nodes
temp_box.after(cloneEle);        // put cloneEle right after temp_box
div_box.remove();                // remove yourself
container.removeChild(temp_box); // remove your child (old way)
```

### `append()` vs `appendChild()`

| | `append()` | `appendChild()` |
|---|---|---|
| Arguments | Any number of nodes **and strings** | Exactly one node |
| Strings | Inserted as text nodes | `TypeError` |
| Return value | `undefined` | The appended node (so calls can be chained) |
| Available on | Elements, `Document`, `DocumentFragment` | Every `Node` |

```js
container.append("Hi", document.createElement("hr")); // OK, two nodes at once
container.appendChild("Hi"); // → TypeError: parameter 1 is not of type 'Node'
```

### Inserting an existing node moves it

A node can be in only one place. Appending or inserting a node that is already in the document **moves** it; it does not copy it. In the demo, `container.replaceChild(cloneEle, div_box)` takes `cloneEle` from its old position and puts it where `div_box` was.

### `cloneNode()`

```js
const shallow = temp_box.cloneNode();     // copies the element and its attributes, but NOT its children
const deep = temp_box.cloneNode(true);    // copies the element and its whole subtree

console.log(shallow.outerHTML); // → '<div class="box"></div>'
console.log(deep.outerHTML);    // → '<div class="box">temp box</div>'
```

- The demo uses a shallow clone, which is why it sets `cloneEle.innerHTML = "clone"` afterwards.
- Clones copy `id` attributes, so you can end up with duplicate IDs. Change or remove the ID after cloning.
- Event listeners added with `addEventListener` are **not** copied (inline `onclick="..."` attributes are, since they are attributes).

### `insertAdjacentHTML()`, `insertAdjacentText()`, `insertAdjacentElement()`

`insertAdjacentHTML()` parses the given text as HTML (or XML) and inserts the resulting nodes into the DOM tree at a given position, relative to the element.

Syntax: `el.insertAdjacentHTML(position, text)`

`position` must be one of these strings:

| Position | Where |
|---|---|
| `"beforebegin"` | Before the element itself. Only valid if the element is in the DOM tree and has a parent element. |
| `"afterbegin"` | Just inside the element, before its first child. |
| `"beforeend"` | Just inside the element, after its last child. |
| `"afterend"` | After the element itself. Only valid if the element is in the DOM tree and has a parent element. |

```html
<!-- beforebegin -->
<div class="target">
  <!-- afterbegin -->
  existing content
  <!-- beforeend -->
</div>
<!-- afterend -->
```

```js
temp_box.insertAdjacentHTML("afterend", "<p> insert adjacent html </p>");
list.insertAdjacentHTML("beforeend", "<li>New item</li>");          // add to the end of a list
el.insertAdjacentText("afterbegin", "Plain text, never parsed");   // text version
el.insertAdjacentElement("beforebegin", document.createElement("hr")); // element version
```

Unlike `el.innerHTML += "..."`, `insertAdjacentHTML` does not re-parse and recreate the existing children, so their event listeners, form values and focus are kept. It still parses HTML, so it has the same XSS risk as `innerHTML` with untrusted input.

### Removing nodes

```js
container.removeChild(temp_box); // remove your child: called on the parent, returns the removed node
div_box.remove();                // remove yourself: modern, no parent reference needed
container.replaceChildren();     // remove all children at once
```

## `classList` and `className`

| | `className` | `classList` |
|---|---|---|
| Type | A string: `"box temp"` | A `DOMTokenList` of individual classes |
| Change one class | String surgery, easy to break | `add`, `remove`, `toggle`, `replace` |
| Check one class | `className.includes()` is unreliable (`"box"` matches `"boxer"`) | `contains("box")` |

```js
console.log(temp_box.classList);  // → DOMTokenList ['box']
console.log(temp_box.className);  // → "box"

temp_box.classList.add("temp");
console.log(temp_box.className);  // → "box temp"

temp_box.classList.toggle("temp"); // if already added then remove, otherwise add
console.log(temp_box.className);  // → "box"

console.log(temp_box.classList.contains("temp")); // → false

temp_box.classList.toggle("active", true);   // force: always add
temp_box.classList.replace("box", "card");   // swap one class for another
temp_box.classList.remove("a", "b");         // several at once; missing classes are ignored
```

Prefer `classList` and keep the actual styles in CSS, instead of setting many `style` properties from JavaScript.

## What the demo page ends up showing

Following `script.js` step by step, the `.container` ends up with:

1. Box1 to Box4 (unchanged)
2. "temp box" (`temp_box`, inserted before `div_box`)
3. `<p> insert adjacent html </p>` (inserted `afterend` of `temp_box`)
4. "clone" (`cloneEle`, moved into `div_box`'s place by `replaceChild`)

"Box5" (`div_box`) was appended, then replaced, so it is gone. Below the container, "I am not hidden" is hidden (the `hidden="true"` attribute from `setAttributeNode`), and the text node "This is new text node" appears at the end of `<body>`.

## Performance: batch your DOM changes

Every insertion into the live document can invalidate style and layout. The browser usually waits and re-renders once per frame, but two patterns make it slow:

**1. Many separate insertions or `innerHTML +=` in a loop.** `innerHTML +=` serialises the existing content, re-parses all of it and rebuilds every child on every iteration, which gets slower as the list grows and wipes out listeners. Build everything first and insert once:

```js
const items = ["Apple", "Banana", "Cherry"];
const list = document.querySelector("ul");

// Good: build in a DocumentFragment (not part of the page, so no layout work), insert once
const fragment = document.createDocumentFragment();
for (const name of items) {
  const li = document.createElement("li");
  li.textContent = name; // safe text
  fragment.append(li);
}
list.append(fragment); // one insertion; the fragment empties itself into the list

// Also fine: list.append(...items.map(makeLi)) or list.replaceChildren(...nodes)
```

**2. Layout thrashing: reading layout right after writing, in a loop.**

```js
// Bad: each offsetWidth read forces a layout because the previous line changed styles
boxes.forEach((box) => {
  box.style.width = box.parentElement.offsetWidth / 2 + "px";
});

// Better: read everything first, then write everything
const widths = boxes.map((box) => box.parentElement.offsetWidth);
boxes.forEach((box, i) => {
  box.style.width = widths[i] / 2 + "px";
});
```

(`boxes` here is an array, e.g. `Array.from(document.querySelectorAll(".box"))`.)

## Common Mistakes

- **Using `innerHTML` with user input.** Use `textContent` or `createElement`; sanitize if you truly need HTML.
- **`innerHTML +=` to add items.** It rebuilds all children, removes their event listeners and resets form inputs. Use `append` or `insertAdjacentHTML("beforeend", ...)`.
- **Calling `appendChild`/`removeChild` on `document` instead of the parent.**
- **Expecting `appendChild` to copy a node.** It moves it; use `cloneNode(true)` to copy.
- **Forgetting `true` in `cloneNode`.** Without it you get an empty shell.
- **Duplicate IDs after cloning.**
- **Writing `hidden="false"`.** The element is still hidden; remove the attribute instead.
- **Camel-case in `data-*` attributes.** `data-BoxNumber` becomes `dataset.boxnumber`; use `data-box-number`.
- **Expecting `dataset` values to be numbers or booleans.** They are always strings; convert with `Number()` or compare with `"true"`.
- **Treating `attributes` as a method.** It is a property: `el.attributes`, not `el.attributes()`.
- **Reading `getAttribute("value")` to get what the user typed.** Use the `value` property.

## Key Takeaways

- `tagName` works only on elements; `nodeName` works on every node.
- `innerHTML` reads/writes markup inside an element, `outerHTML` includes the element; `textContent` reads/writes plain text and is safe and fast; `innerText` gives rendered text but triggers layout.
- Never put untrusted strings into `innerHTML`, `outerHTML` or `insertAdjacentHTML`.
- Attributes live in the markup, properties live on the object; for `value`, `checked` and `href` they differ.
- `data-*` attributes map to `el.dataset` with camelCase names and string values.
- Create with `createElement`, insert with `append`/`prepend`/`before`/`after`/`insertBefore`/`insertAdjacent*`, remove with `remove()` or `parent.removeChild()`.
- Inserting an existing node moves it; `cloneNode(true)` copies it (without `addEventListener` listeners).
- Batch DOM writes (DocumentFragment, one `append` call) and separate layout reads from writes.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between `innerHTML` and `outerHTML`?**
`innerHTML` is the HTML **inside** the element; `outerHTML` is the element's own tag plus its content. Setting `innerHTML` replaces the children; setting `outerHTML` replaces the element itself in the page. After setting `outerHTML`, the variable still refers to the old element, which is now detached.

**Q2. What is the difference between `innerHTML`, `textContent` and `innerText`?**
`innerHTML` reads and writes HTML markup (parsed on write). `textContent` reads all text from all descendants, including hidden ones, and writes plain text; it is the fastest and safe. `innerText` returns only the visible, rendered text and is slower because it depends on layout. For writing plain text, `textContent` is the usual choice.

**Q3. What is the difference between `append()` and `appendChild()`?**
`appendChild` takes exactly one node and returns it. `append` takes any number of nodes and strings (strings become text nodes) and returns `undefined`. `appendChild("text")` throws a `TypeError`, while `append("text")` works.

**Q4. What does this log?**
```html
<body>
  <div id="box">Hi</div>
  <script>
    const box = document.getElementById("box");
    console.log(box.tagName, box.nodeName);
    console.log(document.body.firstChild.tagName, document.body.firstChild.nodeName);
  </script>
</body>
```
First `DIV` and `DIV`, then `undefined` and `#text`. For elements both properties give the uppercase tag name. The first child of `<body>` is the whitespace text node, which has a `nodeName` of `"#text"` but no `tagName` at all.

**Q5. How do you add, remove and toggle a CSS class on an element?**
Use `classList`: `el.classList.add("active")`, `el.classList.remove("active")`, `el.classList.toggle("active")` and `el.classList.contains("active")`. `className` is the full class string; assigning to it replaces all classes, so it is easy to remove classes by accident.

**Q6. What are `data-*` attributes and how do you read them in JavaScript?**
They store custom data on an element without inventing non-standard attributes, for example `<li data-user-id="7">`. Read and write them through `el.dataset`, where the name after `data-` is converted to camelCase: `el.dataset.userId` returns `"7"`. Values are always strings, and `getAttribute("data-user-id")` also works.

**Q7. How do you remove an element from the page?**
Call `el.remove()` on the element itself, or `parent.removeChild(el)` on its parent (the older way, which also returns the removed node). To clear all children of an element, use `parent.replaceChildren()` or `parent.textContent = ""`.

### Mid-level (2–4 years)

**Q8. Why is setting `innerHTML` with user data dangerous, and how do you prevent it?**
`innerHTML` parses the string as HTML, so input like `<img src=x onerror="stealCookies()">` runs attacker code: a cross-site scripting (XSS) attack. `<script>` tags inserted this way do not run, but inline event attributes do. Prevent it by using `textContent` or `createElement` and setting properties, and if you must render user-supplied HTML, sanitize it with a library like DOMPurify. Frameworks help: React escapes text by default, and `dangerouslySetInnerHTML` is named that way on purpose.

**Q9. Rendering 1,000 rows by appending each one to the page is slow. How do you speed it up?**
Build the rows off-DOM and insert them in one operation: create them inside a `DocumentFragment` and append the fragment once, or call `parent.append(...rows)` / `parent.replaceChildren(...rows)` once. Avoid `innerHTML +=` in a loop, which re-parses everything on every iteration. Do not read layout properties (`offsetHeight`, `getBoundingClientRect`) between the writes. For very large lists, render only the visible rows (virtualization) and attach one delegated event listener to the parent instead of one per row.

**Q10. What is the difference between an attribute and a property? Give an example where they differ.**
Attributes are the name/value pairs in the HTML markup (read with `getAttribute`); properties are fields on the DOM object. For `<input value="hello">`, after the user types, `input.value` is the current text while `input.getAttribute("value")` is still `"hello"` (the default). Similarly `a.getAttribute("href")` returns `"/about"` as written, while `a.href` returns the full resolved URL. Some names differ too: `class`/`className`, `for`/`htmlFor`.

**Q11. You set `el.hidden = true`, but the element is still visible. Why?**
The `hidden` attribute is implemented as `[hidden] { display: none; }` in the browser's default stylesheet, which has the lowest priority in the cascade. If any author CSS sets `display` on that element (for example `.card { display: flex; }` or an accordion's `.panel { display: grid; }`), it overrides it and the element stays visible. Fixes:
- add a global rule `[hidden] { display: none !important; }` (most CSS resets include it);
- or apply the `display` value only when the element is shown: `.panel:not([hidden]) { display: grid; }`;
- or toggle a class that sets `display: none` instead of using `hidden`.

Also remember that `hidden` is boolean: `hidden="false"` still hides; remove the attribute (`el.hidden = false`). A newer value, `hidden="until-found"`, keeps collapsed content findable with the browser's find-in-page; check browser support before relying on it.

**Q12. What happens when you `appendChild` a node that is already in the document? How do you duplicate it instead?**
The node is moved: it is removed from its old position and inserted at the new one, because a node can only have one parent. To duplicate it, use `node.cloneNode(true)` (deep copy). Be aware that the clone keeps the same `id` (causing duplicate IDs) and does not get listeners attached with `addEventListener`, so you must re-attach them or rely on event delegation.

**Q13. After running `list.innerHTML += "<li>New</li>"`, click handlers on the existing items stop working. Why?**
`innerHTML +=` reads the current HTML as a string, appends to it, then replaces **all** children with freshly parsed nodes. The old `<li>` elements, together with their listeners, are thrown away, and form fields also lose what the user typed. Use `list.insertAdjacentHTML("beforeend", "<li>New</li>")` or `list.append(newLi)`, which leave existing nodes untouched, and consider one delegated listener on the `<ul>`.

**Q14. In the demo, the HTML has `data-BoxNumber="4"`, but `box.dataset.boxNumber` is `undefined`. Why?**
HTML attribute names are case-insensitive and the HTML parser lowercases them, so the attribute is stored as `data-boxnumber` and exposed as `dataset.boxnumber`. `dataset` only creates camelCase keys from dashes. To get `dataset.boxNumber`, write the attribute as `data-box-number`.

### Senior (5+ years)

**Q15. Your product renders user-generated rich text (comments, CMS content). How do you make sure no XSS slips in as dozens of developers touch the code?**
Per-call discipline ("remember to sanitize") does not scale; you need fewer places where it can go wrong and tooling that blocks the rest. Route every HTML sink (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`) through one helper that sanitizes with a maintained allow-list sanitizer such as DOMPurify, configured for the tags your content actually needs. Ban direct sink use with lint rules (for example `react/no-danger` and an "unsanitized" rule for DOM sinks), so new usages need a reviewed exception.

Then enforce it at runtime: a Content Security Policy without `'unsafe-inline'` stops most injected script from running, and Trusted Types (`require-trusted-types-for 'script'`) makes the browser throw when a plain string reaches an HTML sink, so only values created by your sanitizing policy pass. Trusted Types is long supported in Chromium and newer in other engines; the HTML Sanitizer API (`el.setHTML()`) is arriving in browsers as a built-in alternative but is not yet universal. Recommendation: one sanitizing helper, lint to block direct sinks, and CSP plus Trusted Types as the safety net. See [Security: XSS, CSRF and CSP](../../04-browser-platform/04-security-xss-csrf-csp/notes.md).

**Q16. A React app intermittently crashes with `Failed to execute 'removeChild' on 'Node'` after a jQuery plugin (or a browser extension such as an in-page translator) touches the page. What is going on, and how should imperative DOM code coexist with a framework?**
React assumes it is the only owner of the nodes it rendered. When outside code moves, wraps or replaces those nodes (a plugin wrapping elements, a translator replacing text nodes), React's next update tries to remove or insert relative to nodes that are no longer where it left them, and the DOM throws. The fix is clear ownership: give imperative code its own container element that the framework renders **empty** and never puts children into, create and destroy the widget in an effect with a ref, and clean up on unmount.
```js
// React: the framework owns the <div>, the chart library owns everything inside it
useEffect(() => {
  const chart = createChart(containerRef.current);
  return () => chart.destroy();
}, []);
```
Recommendation: never let two systems mutate the same subtree; wrap every imperative library in one adapter component with an explicit mount and cleanup.

**Q17. You are designing a reusable component (a custom element or a design-system component). Which settings should be attributes, which should be properties, and should they reflect?**
Attributes are strings in the markup; they work in plain HTML, server-rendered output and CSS selectors (`:host([disabled])`, `[open]`). Properties can hold any value (objects, arrays, functions) and are what frameworks set. A good convention, used by the built-in elements: simple primitive settings (`disabled`, `open`, `variant="primary"`) are both, and the property **reflects** to the attribute so CSS and devtools see the state; rich data (an `items` array, a formatter function) is property-only, because serializing it into an attribute is lossy and slow. Boolean attributes follow HTML rules: presence means `true`, so use `toggleAttribute("open", value)`, never `setAttribute("open", "false")`.

Avoid reflecting values that change very often (a `value` updated on every keystroke): each reflection is a DOM mutation that triggers attribute observers and style recalculation. Recommendation: primitive configuration as reflected attributes, complex data as properties only, and document both in the component API.

**Q18. Reordering a list moves a node that contains a playing video, an iframe or a focused input, and the user loses their state (the iframe reloads, focus jumps away). Why, and what are your options?**
Moving a node with `append`/`insertBefore` is really a remove followed by an insert. Removing an `<iframe>` unloads its document, so reinserting it reloads it; focus and selection are lost; CSS animations and transitions restart. Options: avoid moving stateful nodes at all and change the visual order with CSS (`order` in flexbox or grid placement), which leaves the DOM untouched (but keep the DOM order sensible, because keyboard and screen-reader order follows the DOM, not the visual order); or keep stable `key`s in a framework so it moves the minimum number of nodes. The newer `parent.moveBefore(node, referenceNode)` method moves a node while preserving its state (iframe document, focus, animations); it shipped first in Chromium and is not yet universal, so feature-detect it (`"moveBefore" in Element.prototype`) and fall back to `insertBefore`. Recommendation: treat iframes, media and focused form controls as non-movable, and reorder visually or with `moveBefore()` behind a feature check.

## References
- [W3Schools: JavaScript HTML DOM Document](https://www.w3schools.com/js/js_htmldom_document.asp)
- [W3Schools: insertAdjacentHTML()](https://w3schools.com/jsref/met_node_insertadjacenthtml.asp)
- [W3Schools: setAttributeNode() (difference from setAttribute)](https://www.w3schools.com/jsref/met_element_setattributenode.asp)
- [MDN: Element.innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML)
- [MDN: Node.textContent](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent)
- [MDN: Element.insertAdjacentHTML()](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML)
- [MDN: HTMLElement.dataset](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset)
- [MDN: Element.classList](https://developer.mozilla.org/en-US/docs/Web/API/Element/classList)
- [MDN: DocumentFragment](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment)
- [MDN: HTMLElement.hidden](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/hidden)
- [MDN: Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)
- [MDN: Element.moveBefore()](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore)
- [DOMPurify](https://github.com/cure53/DOMPurify)
