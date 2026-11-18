# DOM Node Properties and Tree Navigation

> JavaScript · Topic 21 · Demo: [index.html](index.html) · [script.js](script.js) · Open index.html in a browser and run the commented snippets from script.js in the devtools console.

Every part of a page in the DOM is a **node**, and every node knows its parent, its children and its siblings. This lecture covers the read-only properties that describe a node (`nodeName`, `nodeType`, `nodeValue`) and the two families of properties for walking the tree: one that sees **all nodes** (including whitespace text and comments) and one that sees **elements only**.

## Nodes vs elements

An **element** is a node created from an HTML tag (`<div>`, `<p>`). A **node** is anything in the tree: elements, text, comments, the document itself.

The whitespace and newlines you type between tags to indent your HTML become **text nodes** too. That is why "all node" properties often return a `#text` node when you expected an element.

### Node types (`nodeType`)

| `nodeType` | Constant | Example | `nodeName` |
|---|---|---|---|
| 1 | `Node.ELEMENT_NODE` | `<div>`, `<p>` | Tag name in uppercase: `"DIV"`, `"P"` |
| 2 | `Node.ATTRIBUTE_NODE` | `class="box"` (an `Attr` object) | Attribute name: `"class"` |
| 3 | `Node.TEXT_NODE` | Text, including whitespace between tags | `"#text"` |
| 8 | `Node.COMMENT_NODE` | `<!-- note -->` | `"#comment"` |
| 9 | `Node.DOCUMENT_NODE` | `document` | `"#document"` |
| 10 | `Node.DOCUMENT_TYPE_NODE` | `<!DOCTYPE html>` | `"html"` |
| 11 | `Node.DOCUMENT_FRAGMENT_NODE` | `document.createDocumentFragment()` | `"#document-fragment"` |

> **Note:** The original notes said "1 = element, 2 = text". That is wrong: **2 is an attribute, 3 is text.** Prefer the named constants over magic numbers: `node.nodeType === Node.TEXT_NODE`.

## Node properties

| Property | Description |
|---|---|
| `attributes` | Read-only. Returns a `NamedNodeMap` containing the node's attributes. Only elements have it (it lives on `Element`); other nodes return `undefined`. |
| `childNodes` | Read-only. Returns a `NodeList` of **all** child nodes: elements, text and comments. |
| `firstChild` | Read-only. The first child node (often a whitespace `#text`), or `null`. |
| `lastChild` | Read-only. The last child node, or `null`. |
| `nextSibling` | Read-only. The next node with the same parent, or `null`. |
| `previousSibling` | Read-only. The previous node with the same parent, or `null`. |
| `nodeName` | Read-only. The node's name as a string: the uppercase tag name for elements (`"P"`, `"DIV"`, `"TABLE"`), `"#text"` for text, `"#comment"` for comments, `"#document"` for the document. |
| `nodeType` | Read-only. A number for the kind of node (1 = element, 3 = text, 8 = comment, 9 = document; see the table above). |
| `nodeValue` | The content of a text, comment or attribute node. For elements and the document it is `null`. |
| `ownerDocument` | Read-only. The `document` that the node belongs to (`null` for the document itself). |
| `parentNode` | Read-only. The parent node of the specified node in the tree, or `null` if it has none (for example a newly created, not-yet-inserted element). |

### Walking the demo page with "all node" properties

The demo `<body>` looks like this:

```html
<body>
    <div class="container">
        <div class="box">Box1</div>
        <div class="box">Box2</div>
        <div class="box">Box3</div>
        <div class="box">Box4</div>
        <div class="box">Box5</div>
    </div>
</body>
```

Run these in the console after the page has loaded:

```js
// Get all nodes of <body>
document.body.childNodes;
// → NodeList(3) [text, div.container, text]
// The blank space/newline after <body> and after </div> are text nodes.

// First and last child of .container
document.body.childNodes[1].firstChild;  // → #text  (the newline + spaces before Box1)
document.body.childNodes[1].lastChild;   // → #text  (the newline after Box5)

// Next sibling of that first text node
document.body.childNodes[1].firstChild.nextSibling;
// → <div class="box">Box1</div>

// Parent of the text node
document.body.childNodes[1].firstChild.parentNode;
// → <div class="container">...</div>

// Name and type
document.body.childNodes[1].nodeName;    // → "DIV" (always uppercase for HTML elements)
document.body.childNodes[1].nodeType;    // → 1
document.body.firstChild.nodeName;       // → "#text"
document.body.firstChild.nodeType;       // → 3
document.body.firstChild.nodeValue;      // → "\n    " (the whitespace itself)
document.body.childNodes[1].nodeValue;   // → null (elements have no nodeValue)
document.body.ownerDocument === document; // → true
```

> **Note:** The lecture's console output was `NodeList(4) [text, div.container, text, div#fs_div_all]`. The extra `div#fs_div_all` is not in `index.html`; a browser extension injected it into the page. Extensions often add nodes to `<body>`, which is one more reason not to rely on fixed indexes like `childNodes[1]`.

## Element-only navigation

Usually you want to skip whitespace and comments. These properties return **elements only** (no other node is included):

```js
// First element child of <body>
document.body.firstElementChild;
// → <div class="container">...</div>

// Last element child of the container
document.body.firstElementChild.lastElementChild;
// → <div class="box">Box5</div>

// Parent element
let box = document.body.firstElementChild.lastElementChild; // Box5
box.parentElement;
// → <div class="container">...</div>

// Previous element sibling
box.previousElementSibling;
// → <div class="box">Box4</div>

// Next element sibling
let first = document.body.firstElementChild.firstElementChild; // Box1
first.nextElementSibling;
// → <div class="box">Box2</div>

// All element children and their count
document.querySelector(".container").children;          // → HTMLCollection(5) [div.box, div.box, div.box, div.box, div.box]
document.querySelector(".container").childElementCount; // → 5
document.querySelector(".container").childNodes.length; // → 11 (5 divs + 6 whitespace text nodes)
```

### All nodes vs elements only

| All nodes (includes text and comments) | Elements only |
|---|---|
| `parentNode` | `parentElement` |
| `childNodes` | `children` |
| `firstChild` | `firstElementChild` |
| `lastChild` | `lastElementChild` |
| `previousSibling` | `previousElementSibling` |
| `nextSibling` | `nextElementSibling` |
| `childNodes.length` | `childElementCount` |

### `childNodes` vs `children`

| | `childNodes` | `children` |
|---|---|---|
| Contains | All child nodes: elements, text, comments | Element children only |
| Type | `NodeList` | `HTMLCollection` |
| Live? | Yes, updates when children are added or removed | Yes, updates when children are added or removed |
| `forEach()` | Yes (`NodeList` has `forEach`) | No; convert with `Array.from()` or use `for...of` |
| Defined on | Every `Node` | Elements, `Document` and `DocumentFragment` |

```js
const container = document.querySelector(".container");

container.childNodes.forEach((node) => console.log(node.nodeName));
// → #text, DIV, #text, DIV, ... #text

// children has no forEach: convert it first, or use for...of
Array.from(container.children).forEach((el) => console.log(el.textContent));
// → Box1, Box2, Box3, Box4, Box5

for (const el of container.children) {
  console.log(el.textContent);
}
// → Box1, Box2, Box3, Box4, Box5
```

### `parentNode` vs `parentElement`

They return the same thing in almost every case. The difference is at the top of the tree: the parent of `<html>` is `document`, which is a node but not an element.

```js
document.documentElement.parentNode;    // → #document
document.documentElement.parentElement; // → null
```

## Putting it together: walking the whole tree

Because every node exposes its children, you can visit every node with a short recursive function:

```js
function walk(node, depth = 0) {
  const indent = "  ".repeat(depth);
  if (node.nodeType === Node.ELEMENT_NODE) {
    console.log(indent + node.nodeName);
  } else if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "") {
    console.log(indent + JSON.stringify(node.nodeValue.trim()));
  }
  for (const child of node.childNodes) {
    walk(child, depth + 1);
  }
}

walk(document.body);
// → BODY
//     DIV
//       DIV
//         "Box1"
//       DIV
//         "Box2"
//   ... and so on
```

To check whether one node is inside another, use `contains()`:

```js
const container = document.querySelector(".container");
const box = container.firstElementChild;
container.contains(box);  // → true
box.contains(container);  // → false
container.contains(container); // → true (a node contains itself)
```

## The script is in `<head>`

In this demo, `script.js` is loaded in `<head>` without `defer`. All its DOM code is commented out and meant to be pasted into the console after the page loads. If you uncomment it as-is, it fails, because when the script runs `<body>` has not been parsed yet:

```js
// inside script.js loaded from <head>
console.log(document.body); // → null
document.body.childNodes;   // → TypeError: Cannot read properties of null (reading 'childNodes')
```

Fix it with `<script src="script.js" defer></script>` or by moving the tag to the end of `<body>` (see [How JavaScript runs](../01-how-js-runs/notes.md#where-do-i-put-the-script-in-html)).

## Common Mistakes

- **Using `firstChild` and getting a text node.** Indentation creates whitespace text nodes. Use `firstElementChild` when you want an element.
- **Hard-coding indexes like `childNodes[1]`.** One extra space, comment or extension-injected node shifts every index. Select by class or ID instead (see [Selecting DOM elements](../22-dom-selecting/notes.md)).
- **Code that works locally but breaks in production.** A minifier that strips whitespace from HTML removes the text nodes, so `firstChild` suddenly returns an element. Element-only properties behave the same either way.
- **Calling `forEach` on `children`.** `HTMLCollection` has no `forEach`; use `for...of` or `Array.from()`.
- **Comparing `nodeName` to a lowercase string.** In HTML documents `nodeName` and `tagName` are uppercase: `el.nodeName === "DIV"`, not `"div"`.
- **Reading `nodeValue` of an element to get its text.** It is always `null`. Use `textContent`.
- **Modifying children while looping over a live collection.** Removing items from `children` or `childNodes` inside a forward index loop skips every other item (see Q7).

## Key Takeaways

- Everything in the DOM is a node; elements are nodes with `nodeType` 1, text nodes are 3, comments 8, the document 9.
- Whitespace between tags becomes `#text` nodes, so `childNodes`, `firstChild` and `nextSibling` often return text.
- Use the element-only family (`children`, `firstElementChild`, `nextElementSibling`, `parentElement`) for everyday work.
- `nodeName` is the uppercase tag name for elements and `#text`/`#comment`/`#document` for other nodes.
- `nodeValue` holds text for text and comment nodes and is `null` for elements.
- `childNodes` (NodeList) and `children` (HTMLCollection) are both live; only NodeList has `forEach`.
- `parentNode` and `parentElement` differ only at the top: `<html>`'s parent node is `document`, its parent element is `null`.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between a node and an element?**
A node is any object in the DOM tree: elements, text, comments, the document and so on. An element is one specific type of node (`nodeType` 1) created from an HTML tag. Every element is a node, but a text node or comment node is not an element.

**Q2. What is the difference between `childNodes` and `children`?**
`childNodes` returns a `NodeList` of every child node, including whitespace text nodes and comments. `children` returns an `HTMLCollection` of element children only. For `<ul>` with three indented `<li>`s, `childNodes.length` is 7 (three `li` plus four text nodes) while `children.length` is 3.

**Q3. What does this log?**
```html
<ul id="list">
  <li>One</li>
</ul>
<script>
  const list = document.getElementById("list");
  console.log(list.firstChild.nodeName);
  console.log(list.firstElementChild.nodeName);
</script>
```
It logs `"#text"` and then `"LI"`. The newline and spaces after `<ul ...>` form a text node, which is the first child. `firstElementChild` skips it and returns the `<li>`, whose `nodeName` is uppercase.

**Q4. What are the common `nodeType` values?**
1 is an element, 3 is a text node, 8 is a comment, 9 is the document and 11 is a document fragment (2 is an attribute node, which belongs to an element but is not a child in the tree). You can compare with constants instead of numbers: `node.nodeType === Node.ELEMENT_NODE`.

**Q5. What is the difference between `parentNode` and `parentElement`?**
`parentNode` returns any parent node; `parentElement` returns the parent only if it is an element, otherwise `null`. They differ only for `<html>`: `document.documentElement.parentNode` is `document`, while `parentElement` is `null`.

**Q6. What is `nodeValue` for an element, and how do you read its text?**
For element and document nodes `nodeValue` is `null`; it only holds data for text, comment and attribute nodes. To read the text of an element use `textContent` (or `innerText` for the rendered text), or read `nodeValue` of its text-node child.

### Mid-level (2–4 years)

**Q7. This code is meant to remove every child of a list but leaves half of them. Why, and how do you fix it?**
```js
const list = document.getElementById("list");
for (let i = 0; i < list.children.length; i++) {
  list.children[i].remove();
}
```
`children` is live. Removing index 0 shifts every remaining item down by one, then `i` becomes 1 and skips the item that moved into index 0. Fixes: loop while a child exists (`while (list.firstElementChild) list.firstElementChild.remove();`), loop backwards, iterate over a static copy (`Array.from(list.children).forEach(el => el.remove())`), or simply call `list.replaceChildren()` to empty it in one step.

**Q8. Code using `el.firstChild` worked in development but breaks after deployment. What could be the cause?**
The production build probably minifies the HTML and strips the whitespace between tags. In development `firstChild` was a whitespace text node and the code compensated (for example by using `.nextSibling`); in production there is no text node, so `firstChild` is the element itself. Use whitespace-independent APIs: `firstElementChild`, `children`, or a selector like `el.querySelector(":scope > li")`.

**Q9. How would you check if a click happened outside a dropdown?**
Listen for clicks on `document` and test whether the click target is inside the dropdown with `Node.contains()`:
```js
document.addEventListener("click", (e) => {
  if (!dropdown.contains(e.target)) dropdown.hidden = true;
});
```
`contains()` returns `true` for the node itself and any descendant, so clicks inside the dropdown keep it open.

**Q10. How do you loop over a `NodeList` or `HTMLCollection` and when do you need to convert it to an array?**
Both are array-like and iterable, so `for...of` works on both. `NodeList` also has `forEach`; `HTMLCollection` does not. Convert with `Array.from(collection)` or `[...collection]` when you need array methods like `map`, `filter` or `reduce`, or when you want a static snapshot that will not change while you modify the DOM.

**Q11. Write a function that counts all element nodes inside a given element, at any depth.**
```js
function countElements(root) {
  let count = 0;
  for (const child of root.children) {
    count += 1 + countElements(child);
  }
  return count;
}
countElements(document.querySelector(".container")); // → 5 in the demo page
```
Using `children` skips text and comments automatically. A shorter alternative is `root.querySelectorAll("*").length`, which also counts all descendant elements.

**Q12. How would you find every text node inside an element that contains a given word, for example to highlight search matches? Why can't `querySelectorAll` do it?**
CSS selectors match elements only, never text nodes, so `querySelectorAll` cannot return them. Walk the tree with a `TreeWalker` filtered to text nodes:
```js
function findTextNodes(root, word) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const matches = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue.includes(word)) matches.push(node);
  }
  return matches;
}
findTextNodes(document.body, "Box3"); // → [#text "Box3"] in the demo page
```
`TreeWalker` is iterative (no recursion depth to worry about) and skips the node types you filter out. To highlight a match, either split the text node and wrap the match in `<mark>`, or use the CSS Custom Highlight API (`CSS.highlights` with `Range` objects), which styles ranges without changing the DOM at all.

### Senior (5+ years)

**Q13. Your "click outside to close" check (`dropdown.contains(e.target)`) closes the menu even when users click inside it, after the design system moved the menu into a web component, or into a React portal. Why, and what is the robust fix?**
`contains()` follows the real DOM tree. With **Shadow DOM**, events are retargeted: a listener on `document` sees `e.target` as the shadow host, not the element clicked inside the shadow root, and `contains()` does not cross shadow boundaries. With a **portal**, the menu is rendered under `<body>`, so in the DOM it is not inside the trigger's container at all, even though it is nested in the React component tree.

Use `e.composedPath()`, which lists every node the event passed through, including nodes inside open shadow roots: `if (!e.composedPath().includes(menuEl)) close();`. For portals, check both the trigger and the portalled panel (keep a ref to each). Recommendation: put one well-tested `onClickOutside(elements, handler)` utility in the design system that uses `composedPath()` and accepts several elements, instead of letting every team write its own `contains()` check.

**Q14. A codebase is full of chains like `btn.parentElement.parentElement.nextElementSibling.firstElementChild`. What is the risk, and what guidance do you give the team?**
The code depends on the exact markup structure. Adding one wrapper `div` for styling, moving an icon, or a framework changing its output breaks it silently: the chain still returns some element, just the wrong one, or `null` and a `TypeError` far from the cause.

Navigate by meaning, not position: find the nearest owning component with `closest("[data-card]")`, then search inside it with `card.querySelector("[data-card-body]")`. Use dedicated `data-*` hooks for JavaScript instead of styling classes, so CSS refactors cannot break behaviour. Recommendation: allow at most one hop of positional navigation (`parentElement`, `nextElementSibling`) in review, and require `closest()` plus a scoped query for anything further.

**Q15. Memory keeps growing in a single-page app even though old views are removed from the page. How can removed DOM nodes leak, and how do you find them?**
A removed node stays in memory as long as JavaScript still references it: a module-level cache, an array of "selected rows", a closure in a listener on `window`, or a third-party library instance. Because every node keeps `parentNode` and child pointers, one reference to a single cell can keep its whole detached table alive.

Find them with a heap snapshot in Chrome DevTools (Memory panel), filtering for "Detached" elements, and follow the retainers path to the variable that holds them. Fix by clearing references when a view unmounts, removing listeners (`AbortController`), and keying element-related data in a `WeakMap` so it disappears with the element. Recommendation: make "take a heap snapshot after navigating away and back five times" part of the performance checklist for long-lived views. See [Map, Set, WeakMap and memory](../14-map-set-weakmap-memory/notes.md).

> **Note:** Related questions answered elsewhere: [How JavaScript runs](../01-how-js-runs/notes.md#interview-questions) (a script in `<head>` logs `null` for `document.body`).

## References
- [MDN: Node](https://developer.mozilla.org/en-US/docs/Web/API/Node)
- [MDN: Node.nodeType](https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType)
- [MDN: Node.childNodes](https://developer.mozilla.org/en-US/docs/Web/API/Node/childNodes)
- [MDN: Element.children](https://developer.mozilla.org/en-US/docs/Web/API/Element/children)
- [MDN: Document.createTreeWalker()](https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker)
- [MDN: Event.composedPath()](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath)
- [Chrome for Developers: Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems)
