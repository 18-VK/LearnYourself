# JavaScript Events, Event Bubbling and Capturing, and Timers

> JavaScript · Topic 24 · Demo: [index.html](index.html) · [script.js](script.js) · Open index.html in a browser, click the coloured boxes and check the devtools console.

Events are how a web page reacts to the user and the browser: a click, a key press, a form submission, the page finishing loading. This lecture covers how to listen for events, what the event object tells you, how an event travels through nested elements (capturing and bubbling), how to stop it, and how to run code later or repeatedly with timers.

## What is an event?

JavaScript events are actions or occurrences that happen in the browser. They can be triggered by user interactions or by the browser itself. Common events include mouse clicks, keyboard presses, page loads and form submissions.

To react to an event, you attach an **event handler** to it: a block of code (a function) that runs when the event fires. When we define such a function to run in response to an event, we say we are **registering an event handler**. Event handlers are also called **event listeners**. Strictly, the *listener* is the registration made with `addEventListener()` and the *handler* is the function that runs, but the two words are used interchangeably.

## Three ways to register a handler

### 1. Inline HTML attribute

```html
<button type="button" onclick="hiThere()">
  Click me event
</button>

<script>
  function hiThere() {
    alert("Hi there!");
  }
</script>
```

Here, on a button click, the function `hiThere()` is called. The attribute value is JavaScript code, and `hiThere` must be a global function.

### 2. Event handler property

```js
const btn = document.querySelector("button");
btn.onclick = () => console.log("first");
btn.onclick = () => console.log("second"); // replaces the first one
// clicking logs only → "second"
btn.onclick = null; // removes it
```

### 3. `addEventListener()` (recommended)

```js
const btn = document.querySelector("button");

function random(number) {
  return Math.floor(Math.random() * (number + 1)); // 0 to number, inclusive
}

btn.addEventListener("click", () => {
  const rndCol = `rgb(${random(255)} ${random(255)} ${random(255)})`;
  document.body.style.backgroundColor = rndCol;
});
```

Clicking the button gives the page a random background colour. The demo does the same to the `.box` element.

| | Inline `onclick="..."` | `el.onclick = fn` | `el.addEventListener("click", fn)` |
|---|---|---|---|
| Handlers per event | One | One (assigning again overwrites) | Many |
| Mixes HTML and JS | Yes | No | No |
| Capturing phase | No | No | Yes (`capture: true`) |
| Options (`once`, `passive`, `signal`) | No | No | Yes |
| Remove | Remove the attribute | Set to `null` | `removeEventListener()` with the same function |
| Works with a strict Content Security Policy | No (inline code is usually blocked) | Yes | Yes |

Use `addEventListener` in real code. Inline attributes are fine for quick experiments.

## Common JavaScript events

The names in the original list (`onclick`, `onmouseover`, ...) are the **handler property / attribute** names. The **event name** itself has no `on` prefix: you write `addEventListener("click", ...)`, not `addEventListener("onclick", ...)`.

| Event | Handler property | Fires when |
|---|---|---|
| `click` | `onclick` | The element is clicked (also Enter/Space on a focused button) |
| `mouseover` | `onmouseover` | The mouse pointer moves onto the element (or one of its children) |
| `mouseout` | `onmouseout` | The mouse pointer leaves the element (or moves into a child) |
| `keydown` | `onkeydown` | A key is pressed down (repeats while held) |
| `keyup` | `onkeyup` | A key is released |
| `change` | `onchange` | The value of an input is **committed**: on blur for text inputs, immediately for checkboxes, radios and `<select>` |
| `input` | `oninput` | The value changes at all (every keystroke, paste, etc.) |
| `load` | `onload` | The page has finished loading, **including** images and stylesheets (also fires on `<img>`, `<script>`) |
| `DOMContentLoaded` | (none; use `addEventListener`) | The HTML is fully parsed; images may still be loading |
| `submit` | `onsubmit` | A form is submitted (fires on the `<form>`, by button click or Enter) |
| `focus` | `onfocus` | An element gets focus |
| `blur` | `onblur` | An element loses focus |

For many more event types, see the data-flair link in the references.

## The event object

An event object is the argument passed into an event handler function. It represents the event and carries contextual information about what caused the handler to run.

Inside a handler you will often see a parameter named `event`, `evt` or `e`. This is the event object; the browser passes it **automatically** to every handler, giving extra features and information. Rewriting the random colour example to use it:

```js
const btn = document.querySelector("button");

function random(number) {
  return Math.floor(Math.random() * (number + 1));
}

function bgChange(e) {
  const rndCol = `rgb(${random(255)} ${random(255)} ${random(255)})`;
  e.target.style.backgroundColor = rndCol; // e.target is the button that was clicked
  console.log(e);                          // → PointerEvent {isTrusted: true, ...} (MouseEvent in some browsers)
}

btn.addEventListener("click", bgChange);
```

Now the button changes its own colour. The same `bgChange` function can be attached to many buttons, and `e.target` tells it which one was clicked.

Useful properties and methods:

| Member | Meaning |
|---|---|
| `e.type` | The event name, e.g. `"click"` |
| `e.target` | The element where the event **started** (the innermost element clicked) |
| `e.currentTarget` | The element whose listener is **running now** |
| `e.eventPhase` | 1 = capturing, 2 = at target, 3 = bubbling |
| `e.preventDefault()` | Cancel the browser's default action (following a link, submitting a form) |
| `e.stopPropagation()` | Stop the event travelling to other elements |
| `e.key`, `e.code` | Keyboard events: the character/key name (`"a"`, `"Enter"`) and the physical key (`"KeyA"`) |
| `e.clientX`, `e.clientY` | Mouse events: pointer position in the viewport |
| `e.isTrusted` | `true` if the user/browser caused it, `false` if a script dispatched it |

### `target` vs `currentTarget`

| | `e.target` | `e.currentTarget` |
|---|---|---|
| Is | The element the event originated on | The element the handler is attached to |
| Changes while bubbling? | No, same for every handler | Yes, a different element for each handler |
| Inside a regular `function` handler | Not necessarily `this` | Same as `this` |
| After the handler finishes | Still set | Becomes `null` |

```js
// Without the demo's stopPropagation() calls: click the red "Innermost elements" box
const outermost = document.querySelector(".outermost");
outermost.addEventListener("click", (e) => {
  console.log(e.target.className);        // → "innermost" (where the click happened)
  console.log(e.currentTarget.className); // → "outermost" (where this listener lives)
});
```

> **Note:** The demo logs `e` with `console.log(e)`. When you expand that object later in devtools, `currentTarget` shows `null`, because it is only set while the handler is running. Log `e.currentTarget` directly (or copy it to a variable) if you need it.

### `this` inside a handler

```js
btn.addEventListener("click", function () {
  console.log(this === btn); // → true: a regular function gets this = currentTarget
});

btn.addEventListener("click", () => {
  console.log(this); // → window (in a classic script): arrow functions do not get their own this
});
```

With arrow functions, use `e.currentTarget` instead of `this`.

## `addEventListener()` in detail

The `addEventListener()` method attaches an event handler to an element **without overwriting** existing event handlers.

- You can add many event handlers to one element.
- You can add many handlers of the **same type** to one element, e.g. two `"click"` handlers. They run in the order they were added.
- `addEventListener()` makes it easier to control how the event reacts to bubbling.

Syntax:

```js
element.addEventListener(event, function, useCapture);
```

1. The first parameter is the type of the event, like `"click"` or `"mousedown"` or any other HTML DOM event (no `on` prefix).
2. The second parameter is the function to call when the event occurs. Pass the function itself (`handler`), not its result (`handler()`).
3. The third parameter is optional. As a boolean, it says whether to use event **capturing** (`true`) or **bubbling** (`false`, the default). Modern code can pass an options object instead:

```js
element.addEventListener("click", handler, {
  capture: false, // same as the old boolean third parameter
  once: true,     // remove the listener automatically after it runs once
  passive: true,  // promise not to call preventDefault() (lets scrolling stay smooth)
  signal,         // an AbortSignal: calling controller.abort() removes the listener
});
```

### `removeEventListener()`

To remove a listener, pass the **same event type, the same function reference and the same capture flag** you used to add it. That is why the demo stores the handler in a variable:

```js
let box = document.querySelector(".box");
let btn = document.getElementById("BTN1");

let eventHandler = () => {
  box.style.backgroundColor = `rgb(${random(255)},${random(255)},${random(255)})`;
};

btn.addEventListener("click", eventHandler);
btn.removeEventListener("click", eventHandler); // removed: the button now does nothing
```

In the demo the listener is removed on the very next line, so clicking "Click me" does nothing. Comment out the `removeEventListener` line to see the box change colour.

An anonymous function can never be removed, because each arrow function expression creates a new, different function:

```js
btn.addEventListener("click", () => console.log("hi"));
btn.removeEventListener("click", () => console.log("hi")); // does nothing: a different function object
```

Removing many listeners at once with an `AbortController`:

```js
const controller = new AbortController();
btn.addEventListener("click", eventHandler, { signal: controller.signal });
window.addEventListener("resize", eventHandler, { signal: controller.signal });

controller.abort(); // both listeners are removed
```

## Event propagation: capturing and bubbling

There are two ways of event propagation in the HTML DOM: **bubbling** and **capturing**.

Event propagation defines the order in which elements receive an event. If you have a `<p>` element inside a `<div>` element and the user clicks on the `<p>`, which element's `"click"` handler should run first?

- In **bubbling**, the innermost element's handler runs first, then the outer ones: the `<p>` element's click handler runs first, then the `<div>`'s.
- In **capturing**, the outermost element's handler runs first, then the inner ones: the `<div>` element's click handler runs first, then the `<p>`'s.

With `addEventListener()` you choose the type with the `useCapture` parameter:

```js
addEventListener(event, function, useCapture);
```

The default is `false`, which uses bubbling. When it is set to `true`, the handler runs during capturing.

### The three phases

In fact every event goes through **both**, in this order. Each listener runs in only one of the phases, depending on its capture flag:

```text
            window
              |
           document
              |
            <html>                1. CAPTURING phase: window → down to the target's parent
              |                      (runs listeners added with capture: true)
            <body>
              |                   2. TARGET phase: at the element that was clicked
       <div.outermost>               (capturing listeners first, then non-capturing ones)
              |
         <div.middle>             3. BUBBLING phase: target's parent → back up to window
              |                      (runs listeners added with capture: false, the default)
       <div.innermost>  ← target
```

## Event bubbling

Event bubbling describes how the browser handles events targeted at nested elements. For example:

```html
<div class="outermost">
  <div class="middle">
    <div class="innermost">
      Innermost elements
    </div>
  </div>
</div>
```

Here there are three nested elements with a click handler on each. What happens if the user clicks on `innermost`? The event is handled on `innermost` and then **propagates up** to the other two as well, because they are its parent and grandparent: the click happened inside them too.

```js
const innermost = document.querySelector(".innermost");
const middle = document.querySelector(".middle");
const outermost = document.querySelector(".outermost");

innermost.addEventListener("click", () => console.log("innermost called!"));
middle.addEventListener("click", () => console.log("middle called!"));
outermost.addEventListener("click", () => console.log("outermost called!"));

// click the red innermost box:
// → innermost called!
// → middle called!
// → outermost called!
```

### Fixing the problem with `stopPropagation()`

Event bubbling can sometimes create problems, but there is a way to stop it. The event object has a method called `stopPropagation()` which, when called inside an event handler, prevents the event from travelling on to any other elements.

The active code in the demo:

```js
innermost.addEventListener("click", (e) => {
  alert("innermost called!");
  e.stopPropagation(); // stop the event reaching the parent "middle" element
  console.log(e);
});

middle.addEventListener("click", (e) => {
  e.stopPropagation(); // stop the event reaching the parent "outermost" element
  alert("middle called!");
});

outermost.addEventListener("click", (e) => {
  alert("outermost called!");
});
```

| Where you click | Alerts shown |
|---|---|
| Red `innermost` | "innermost called!" only |
| Brown `middle` (outside the red box) | "middle called!" only |
| Green `outermost` (outside the brown box) | "outermost called!" |

Where in the handler `stopPropagation()` is called does not matter (before or after the alert); it only affects what happens after this handler returns.

> **Note:** `alert()` blocks the page until you close it, which makes the order hard to follow when several handlers fire. Use `console.log()` when experimenting.

## Event capturing

The commented-out part of the demo registers the same three handlers with `true` as the third argument, so they run in the **capturing** phase, from the outside in:

```js
innermost.addEventListener("click", (e) => {
  alert("innermost called!");
  console.log(e);
}, true);

middle.addEventListener("click", (e) => {
  alert("middle called!");
}, true);

outermost.addEventListener("click", (e) => {
  e.stopPropagation();
  alert("outermost called!");
}, true);
```

- Without the `stopPropagation()` line, clicking the red box alerts **outermost, middle, innermost**: the reverse of bubbling.
- With it, `outermost` is reached first and stops the event there, so clicking **anywhere** inside the green box shows only "outermost called!". The inner handlers never run.

To try it, comment out the bubbling block and uncomment the capturing block (they declare the same `const`/`let` names, so only one can be active).

### Mixed capture and bubble: what order?

```html
<div id="outer"><button id="inner">Click</button></div>
```

```js
const outer = document.getElementById("outer");
const inner = document.getElementById("inner");

outer.addEventListener("click", () => console.log("outer bubble"));
outer.addEventListener("click", () => console.log("outer capture"), true);
inner.addEventListener("click", () => console.log("inner bubble"));
inner.addEventListener("click", () => console.log("inner capture"), true);

// click the button:
// → outer capture
// → inner capture
// → inner bubble
// → outer bubble
```

Capturing listeners on ancestors run on the way down, then the target's own listeners, then bubbling listeners on ancestors on the way up. At the target itself, current browsers run capturing listeners before non-capturing ones (older browsers ran them in the order they were added).

## Stopping and cancelling: `stopPropagation()` vs `preventDefault()`

These are often confused. They do completely different things.

| | `stopPropagation()` | `stopImmediatePropagation()` | `preventDefault()` |
|---|---|---|---|
| Stops the event reaching other elements | Yes | Yes | No |
| Stops other listeners on the **same** element | No | Yes | No |
| Cancels the browser's default action | No | No | Yes |
| Typical use | A click inside a modal should not reach the overlay's "close" handler | One listener must be the only one to handle the event | Handle a form with JS instead of reloading; stop a link navigating |

```html
<form id="signup">
  <input name="email" type="email" required>
  <button>Sign up</button>
</form>
```

```js
document.getElementById("signup").addEventListener("submit", (e) => {
  e.preventDefault(); // stop the page from reloading / navigating
  const data = new FormData(e.target);
  console.log(data.get("email")); // → whatever the user typed
});
```

Listen for `submit` on the form, not `click` on the button: `submit` also fires when the user presses Enter in a field.

> **Note:** `return false` only cancels the default action in inline attributes (`onclick="return false"`) and handler properties (`el.onclick = () => false`). Inside an `addEventListener` callback the return value is ignored; call `e.preventDefault()`.

> **Note:** Use `stopPropagation()` sparingly. It also hides the event from code higher up that has a good reason to see it: delegated listeners, analytics, and "click outside to close" logic on `document`.

## Events that do not bubble

A few events do not bubble. Listeners on ancestors do not see them in the bubbling phase:

| Does not bubble | Bubbling alternative |
|---|---|
| `focus` | `focusin` |
| `blur` | `focusout` |
| `mouseenter` | `mouseover` |
| `mouseleave` | `mouseout` |
| `load` on `<img>`, `<script>` | none; listen on the element, or use capturing on an ancestor |
| `scroll` on an element | none; listen on the scrolling element |

Every event still goes through the **capturing** phase, so an ancestor can catch a non-bubbling event with `addEventListener("focus", fn, true)`.

`mouseover` fires again every time the pointer moves into a child; `mouseenter` fires only once when the pointer enters the element, which is usually what you want for hover effects.

## Event delegation

Because events bubble, you can put **one** listener on a parent and handle events for all its children, including children added later. This is called event delegation.

```html
<ul id="todo-list">
  <li>Learn DOM <button class="delete">Delete</button></li>
  <li>Learn events <button class="delete">Delete</button></li>
</ul>
<button id="add">Add item</button>
```

```js
const list = document.getElementById("todo-list");

// one listener for every current and future delete button
list.addEventListener("click", (e) => {
  const btn = e.target.closest(".delete"); // the click might land on a child of the button
  if (!btn) return;                        // clicked somewhere else in the list
  btn.closest("li").remove();
});

document.getElementById("add").addEventListener("click", () => {
  const li = document.createElement("li");
  li.textContent = "New item ";
  const del = document.createElement("button");
  del.className = "delete";
  del.textContent = "Delete";
  li.append(del);
  list.append(li); // its delete button works without adding a new listener
});
```

Benefits:
- **Memory and speed:** one listener instead of hundreds or thousands.
- **Dynamic content:** new items work automatically; no need to attach listeners after every insert.
- **Less cleanup:** removing items does not leave listeners behind.

Use `e.target.closest(selector)` rather than checking `e.target` directly, because the click may land on an icon or `<span>` inside the element you care about.

## Keyboard events in brief

```js
document.addEventListener("keydown", (e) => {
  console.log(e.key);  // → "a", "A", "Enter", "ArrowUp", "Escape" (the character / key meaning)
  console.log(e.code); // → "KeyA", "Enter", "ArrowUp" (the physical key, ignores layout and Shift)
  if (e.key === "Escape") closeModal();
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault(); // stop the browser's "Save page" dialog
    saveDraft();
  }
});
```

(`closeModal` and `saveDraft` stand for your own functions.) `e.keyCode` and the `keypress` event are deprecated; use `e.key`/`e.code` and `keydown`.

## Timing events

The `window` object allows code to run at specified time intervals. These are called **timing events**. The two key methods are `setTimeout()` and `setInterval()`.

### `setTimeout(function, milliseconds)`

Runs a function **once**, after waiting the given number of milliseconds. It returns a numeric ID, which `clearTimeout()` uses to cancel it before it runs.

### `setInterval(function, milliseconds)`

Same as `setTimeout()`, but repeats the function **continuously**, every given number of milliseconds. `clearInterval()` stops it.

Syntax:

```js
window.setTimeout(function, milliseconds);
```

`window.setTimeout()` can be written without the `window` prefix. The same goes for `setInterval()`.

From the demo:

```js
let ret = setInterval(eventHandler, 2000); // would change the box colour every 2 s
clearInterval(ret);                        // ...but is cancelled immediately

let ret1 = setTimeout(eventHandler, 2000); // would change it once, after 2 s
clearTimeout(ret1);                        // ...but is cancelled immediately
```

Comment out the `clear...` lines to see them work.

More details:

```js
// Extra arguments are passed to the function
setTimeout((name) => console.log("Hi " + name), 1000, "Aman"); // → after 1 s: Hi Aman

// Common mistake: calling the function instead of passing it
setTimeout(eventHandler(), 2000); // runs NOW, then passes its return value (undefined) to setTimeout

// Stop an interval after 5 runs
let count = 0;
const id = setInterval(() => {
  count++;
  console.log("tick", count);
  if (count === 5) clearInterval(id);
}, 1000);
// → tick 1 ... tick 5, one per second, then stops
```

### The delay is a minimum, not a guarantee

Timer callbacks go into a queue and only run when the call stack is empty (the event loop). So even a delay of `0` waits for the current code to finish:

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
console.log("3");
// → 1
// → 3
// → 2
```

Browsers also throttle timers in background tabs (often to about once per second), and long-running synchronous code delays every timer. The queues behind this (tasks, microtasks, rendering) are covered in [The event loop](../19-event-loop/notes.md).

### Recursive `setTimeout` vs `setInterval`

`setInterval` schedules the next run regardless of how long the previous one took. When each run must finish before the next one is scheduled (for example, polling a server), chain `setTimeout` instead:

```js
let timerId;
function poll() {
  console.log("checking at", new Date().toLocaleTimeString());
  timerId = setTimeout(poll, 3000); // schedule the next run only after this one finished
}
poll();
// later: clearTimeout(timerId) stops it
```

### Debounce and throttle

Events like `input`, `scroll`, `resize` and `mousemove` can fire dozens of times per second. Timers let you limit how often the expensive work runs.

**Debounce:** wait until the events stop for a moment, then run once (e.g. search as you type).

```js
function debounce(fn, delay) {
  let timerId;
  return function (...args) {
    clearTimeout(timerId);                           // cancel the previous pending call
    timerId = setTimeout(() => fn.apply(this, args), delay);
  };
}

const search = document.querySelector("#search"); // <input id="search">
search.addEventListener("input", debounce((e) => {
  console.log("Searching for:", e.target.value);  // runs 300 ms after the user stops typing
}, 300));
```

**Throttle:** run at most once per time window (e.g. scroll position updates). `requestAnimationFrame` is a natural throttle for visual updates, at most once per frame:

```js
let ticking = false;
window.addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    console.log("scrollY:", window.scrollY); // update the UI here
    ticking = false;
  });
}, { passive: true });
```

Production versions add leading/trailing options, `cancel()` and a time-based throttle; see [Functional patterns](../26-functional-patterns/notes.md#debounce-and-throttle) for full implementations and how to choose between them.

## Performance and best practices

- **Delegate** instead of attaching one listener per item in long or dynamic lists.
- **Mark scroll and touch listeners `passive: true`** when they never call `preventDefault()`. Otherwise the browser may have to wait for your handler before it can scroll.
- **Debounce or throttle** high-frequency events; keep handlers short and move heavy work out of them.
- **Remove listeners you no longer need**, especially on `window` and `document` in single-page apps, or they keep running and keep objects in memory. Use `removeEventListener`, `{ once: true }` or an `AbortController`. In React, do this in the cleanup function of `useEffect`.
- **Prefer `addEventListener`** over inline attributes and `on...` properties.

## Accessibility

- Use real interactive elements. A `<button>` is focusable with Tab and fires `click` on Enter and Space automatically. A `<div onclick>` does none of that.
- If you really must make a non-button clickable, add `tabindex="0"`, `role="button"` and a `keydown` handler for Enter and Space.
- Do not rely only on hover (`mouseover`) for important actions; keyboard and touch users cannot hover.
- Use `focusin`/`focusout` (or `:focus-within` in CSS) for things like dropdowns that should react to keyboard focus.

## Common Mistakes

- **Adding `on` to the event name:** `addEventListener("onclick", fn)` never fires. Use `"click"`.
- **Calling the handler instead of passing it:** `addEventListener("click", handler())` or `setTimeout(fn(), 1000)` runs immediately.
- **Trying to remove an anonymous function** or using a different capture flag in `removeEventListener`.
- **Assigning `el.onclick` twice** and wondering why the first handler stopped working.
- **Confusing `stopPropagation()` with `preventDefault()`.**
- **Using `e.target` when you meant `e.currentTarget`** (or the element you delegated to): `e.target` might be a child `<span>`.
- **Using `this` inside an arrow-function handler**, expecting it to be the element.
- **Listening for `click` on a submit button** instead of `submit` on the form.
- **Expecting `focus`, `blur`, `mouseenter` or `mouseleave` to bubble** for delegation.
- **Forgetting to clear intervals**, which keep running (and keep their closures in memory) until the page is closed.

## Key Takeaways

- Register handlers with `addEventListener(type, fn, options)`; it supports many handlers per event, capturing, `once`, `passive` and `signal`.
- The browser passes an event object to the handler: `target` is where the event started, `currentTarget` is where the listener is attached.
- Every event travels in three phases: capturing (down from `window`), target, and bubbling (back up). Listeners run in the bubbling phase unless you pass `true` / `{ capture: true }`.
- `stopPropagation()` stops the event travelling; `preventDefault()` cancels the browser's default action. They are independent.
- Event delegation (one listener on a parent plus `e.target.closest()`) handles many and future children efficiently.
- `removeEventListener` needs the same function reference and capture flag; anonymous functions cannot be removed.
- `setTimeout` runs once, `setInterval` repeats; both return an ID for `clearTimeout`/`clearInterval`, and their delay is a minimum, not a guarantee.
- Debounce or throttle high-frequency events, and use real `<button>` elements for accessible click handling.

## Interview Questions

### Junior (0–1 year)

**Q1. What is an event, and what is an event listener?**
An event is a signal that something happened: a click, a key press, a form submission, the page loading. An event listener (or handler) is a function registered to run when a particular event happens on a particular element, usually with `element.addEventListener("click", handler)`. The browser calls the function and passes it an event object describing what happened.

**Q2. What are the ways to attach an event handler, and why is `addEventListener` preferred?**
Inline HTML attributes (`onclick="..."`), handler properties (`el.onclick = fn`) and `el.addEventListener("click", fn)`. `addEventListener` allows several handlers for the same event without overwriting each other, supports the capturing phase and options like `once` and `passive`, can be removed precisely, and keeps JavaScript out of the HTML. Assigning `el.onclick` a second time silently replaces the first handler.

**Q3. What is event bubbling? With three nested divs each having a click listener (no `stopPropagation`), what runs when you click the innermost one?**
Bubbling means that after an event fires on the target element, it travels up through each ancestor and triggers their listeners for the same event. Clicking the innermost div runs the innermost handler, then the middle one, then the outermost one, and the event continues up to `body`, `document` and `window`.

**Q4. What is event capturing and how do you use it?**
Capturing is the phase before bubbling, in which the event travels from `window` down to the target. Listeners run during capturing only if registered with `addEventListener(type, fn, true)` or `{ capture: true }`. With capture listeners on three nested divs, clicking the innermost one runs outermost first, then middle, then innermost.

**Q5. What is the difference between `stopPropagation()` and `preventDefault()`?**
`stopPropagation()` stops the event from travelling further to other elements, but the browser's default behaviour still happens. `preventDefault()` cancels the default behaviour (submitting a form, following a link, checking a checkbox), but the event still propagates. You can call both when you need both. `stopImmediatePropagation()` also stops other listeners on the same element.

**Q6. What is the difference between `e.target` and `e.currentTarget`?**
`e.target` is the element where the event originated, for example the `<span>` inside a button you clicked. `e.currentTarget` is the element whose listener is currently running. They are the same when you click directly on the element with the listener, and differ when the event has bubbled up from a child, which is exactly the situation in event delegation.

**Q7. What is the difference between `setTimeout` and `setInterval`, and how do you cancel them?**
`setTimeout(fn, ms)` runs `fn` once after at least `ms` milliseconds; `setInterval(fn, ms)` runs it repeatedly every `ms` milliseconds. Both return an ID: pass it to `clearTimeout(id)` or `clearInterval(id)` to cancel. If you never clear an interval, it keeps running for as long as the page is open.

**Q8. Why doesn't this remove the listener?**
```js
btn.addEventListener("click", () => console.log("clicked"));
btn.removeEventListener("click", () => console.log("clicked"));
```
`removeEventListener` must receive the exact same function object that was added. Each arrow function expression creates a new function, so the second one is a different object and nothing is removed. Store the function in a variable and pass that same variable to both calls (and use the same capture flag), or use `{ once: true }` or an `AbortController`.

### Mid-level (2–4 years)

**Q9. In what order do these log when the button is clicked?**
```js
outer.addEventListener("click", () => console.log("outer bubble"));
outer.addEventListener("click", () => console.log("outer capture"), true);
inner.addEventListener("click", () => console.log("inner bubble"));
inner.addEventListener("click", () => console.log("inner capture"), true);
```
(`inner` is the button inside `outer`.) The order is `outer capture`, `inner capture`, `inner bubble`, `outer bubble`. Capture listeners on ancestors run on the way down, then the target's listeners, then bubble listeners on ancestors on the way up. At the target itself, modern browsers run capture listeners before bubble listeners; older browsers ran them in registration order.

**Q10. A list of 1,000 items, each with its own click listener, is slow and new items don't respond to clicks. What do you do?**
Use event delegation: attach a single listener to the list container and work out which item was clicked with `e.target.closest("li")` (or a more specific selector). This replaces 1,000 listeners with one, so less memory and faster setup, and it automatically works for items added later, since their clicks bubble up to the same container. Store per-item data in `data-*` attributes and read it from `dataset` inside the handler.

**Q11. What does this log, and why?**
```js
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");
```
`A`, `D`, `C`, `B`. Synchronous code runs first (A, D). When the call stack is empty, the event loop runs all **microtasks** (promise callbacks) before the next **macrotask** (timer callbacks), so C comes before B even though the timeout delay is 0.

**Q12. A search box calls an API on every keystroke. How do you fix it?**
Debounce the handler: on each `input` event, clear the pending timer and start a new one, so the API is called only after the user pauses typing for, say, 300 ms.
```js
function debounce(fn, delay) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}
input.addEventListener("input", debounce((e) => fetchResults(e.target.value), 300));
```
For a robust solution, also cancel or ignore responses to outdated queries (for example with `AbortController`), so a slow old response cannot overwrite a newer one.

**Q13. Scrolling feels janky after adding a scroll listener. What could be wrong and how do you fix it?**
The handler probably does heavy work, or reads layout (`getBoundingClientRect`, `offsetTop`) and writes styles on every scroll event, which can fire many times per frame. Fixes: add `{ passive: true }` so the browser does not wait for the handler before scrolling; throttle the work with `requestAnimationFrame` (at most once per frame); batch layout reads before writes; and for "is this element visible?" checks (lazy loading, infinite scroll, scroll-spy), use `IntersectionObserver` instead of a scroll listener.

**Q14. You delegate a `focus` listener to a form to highlight the active field, but it never fires. Why?**
`focus` and `blur` do not bubble, so a listener on the form never sees them in the bubbling phase. Use the bubbling equivalents `focusin` and `focusout`, or register the `focus` listener in the capturing phase (`form.addEventListener("focus", fn, true)`), since every event goes through the capturing phase. For pure styling, CSS `:focus-within` on the form needs no JavaScript at all.

**Q15. In a single-page app, a `resize` handler keeps running after the component is gone, and memory grows. How do you prevent this?**
Listeners on long-lived objects like `window` and `document` are not removed when a component's DOM is removed, and they keep their closures (and everything those reference) alive. Always remove them when the component unmounts: call `removeEventListener` with the same function reference, or register all of them with one `AbortController` `signal` and call `abort()`. In React this belongs in the cleanup function returned from `useEffect`. Also clear any timers and intervals the component started.

**Q16. A teammate made a card clickable with `<div class="card" onclick="openCard()">`. What problems does it have?**
Keyboard and screen-reader users cannot use it: a `div` is not focusable, does not respond to Enter or Space, and is not announced as interactive. Use a `<button>` (or an `<a href>` if it navigates), which gives focus, keyboard activation and the right role for free. If a `div` is unavoidable, add `tabindex="0"`, `role="button"` and a `keydown` handler for Enter and Space. Also move the inline handler to `addEventListener`.

### Senior (5+ years)

**Q17. Field data shows a poor Interaction to Next Paint (INP) on a page: clicks feel slow. How do you find the cause and fix it?**
INP (a Core Web Vital since March 2024) measures the delay from a user interaction to the next frame painted, for the slowest interactions on the page; 200 ms or less is "good". The time is spent in three places: input delay (the main thread was busy with something else when the user clicked), processing time (your event handlers), and presentation delay (style, layout and paint of the result). Find the slow interactions with the `web-vitals` library's attribution build or the Long Animation Frames API in real-user monitoring, then reproduce them in the DevTools Performance panel.

Fixes: do the minimum visible update first and move the rest out of the handler by yielding to the main thread (`await scheduler.yield()` where available, otherwise `await new Promise((r) => setTimeout(r, 0))`); debounce work triggered by `input`; break up long tasks running on page load that delay input; and reduce the rendering cost of the update (smaller DOM, no layout thrashing). Recommendation: track INP from real users per page, and make "handlers must paint feedback within one frame and yield before heavy work" a review rule. See [Web performance](../../04-browser-platform/05-web-performance/notes.md).

**Q18. You maintain a component library used by many teams. Should components call `stopPropagation()`? How should they let consumers react to, or cancel, their behaviour?**
No, as a rule. A component that stops propagation breaks things it cannot see: the consumer's delegated listeners, analytics that listen on `document`, and other components' "click outside to close" logic. Let events bubble and coordinate through `defaultPrevented` instead: the component dispatches a cancelable event before acting, and a consumer that calls `preventDefault()` stops the default behaviour.
```js
// inside the dialog component, when the user presses Escape
const event = new CustomEvent("dialog-request-close", { bubbles: true, cancelable: true, composed: true });
if (this.dispatchEvent(event)) this.close(); // dispatchEvent returns false if someone called preventDefault()
```
`composed: true` lets the event cross a Shadow DOM boundary so listeners outside a web component see it. Recommendation: library components never stop propagation of native events; they emit named, documented, cancelable events and check `event.defaultPrevented` before acting.

**Q19. React 17 moved its event delegation from `document` to the app's root container. Why does that matter, and what does it teach about choosing a delegation root?**
Before React 17, all React handlers were delegated to `document`. Two problems followed: several React apps (or versions) on one page, as in micro-frontends or gradual migrations, all shared the same `document` listeners and interfered with each other; and `e.stopPropagation()` in a React handler could not stop native listeners on outer elements (such as a jQuery "shell" around the React part), because by the time React handled the event at `document`, it had already bubbled through them. Delegating to each app's root container isolates apps from each other and makes `stopPropagation()` behave as developers expect.

The general lesson: delegate to the **nearest stable container you own**, not to `document`. A local root keeps handlers scoped to your feature, avoids conflicts with other code on the page, and is cleaned up with that container. Recommendation: use `document`-level listeners only for truly global concerns (keyboard shortcuts, click-outside), registered with an `AbortController` so they can be removed together.

**Q20. How do you design communication between independent parts of a page (widgets, micro-frontends): DOM `CustomEvent`s, a shared event bus, or shared state?**
DOM `CustomEvent`s fit when the relationship follows the DOM: a child component notifies whatever contains it, events bubble to the right ancestor naturally, and no shared import is needed (which is why web components use them). A global pub/sub bus decouples senders from receivers completely, but that is also its weakness at scale: nobody can tell who listens to what, event names collide, and late subscribers miss events that already fired. Shared state (a store, URL parameters, server cache) fits data that several parts must agree on and read at any time, such as the current user or filters.

Recommendation: `CustomEvent`s for "something happened here" signals between nested components, a store or the URL for shared state, and a global bus only with a typed, documented list of events owned by one team.

## References
- [MDN: Introduction to events](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events)
- [DataFlair: JavaScript event types](https://data-flair.training/blogs/javascript-event-types/)
- [MDN: EventTarget.addEventListener()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
- [MDN: Event.stopPropagation()](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation)
- [MDN: Event.preventDefault()](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
- [MDN: Event.target](https://developer.mozilla.org/en-US/docs/Web/API/Event/target)
- [MDN: Event.currentTarget](https://developer.mozilla.org/en-US/docs/Web/API/Event/currentTarget)
- [MDN: CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)
- [web.dev: Interaction to Next Paint (INP)](https://web.dev/articles/inp)
- [web.dev: Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
- [React blog: React v17.0 (changes to event delegation)](https://legacy.reactjs.org/blog/2020/10/20/react-v17.html)
