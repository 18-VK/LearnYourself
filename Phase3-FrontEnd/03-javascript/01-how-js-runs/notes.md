# How JavaScript Runs

> JavaScript · Topic 1

JavaScript is the programming language of the web: HTML gives a page its structure, CSS gives it its looks, and JavaScript gives it behaviour. This note is the entry point to the JavaScript section. It explains what JavaScript is, where it runs (engine vs runtime), how an engine executes your code, how to load a script into an HTML page (`async`, `defer`, modules) and what strict mode changes. The topics after it go from the language core through objects, asynchronous code and the event loop to the DOM, and [JS_Chapterwise_Notes.pdf](../../_resources/JS_Chapterwise_Notes.pdf) has chapter-wise PDF notes for the whole section.

## Topics in this section

| Group | Topics |
| --- | --- |
| Language basics | [2. Data types, variables and hoisting](../02-types-variables-hoisting/notes.md) · [3. Operators and control flow](../03-operators-and-control-flow/notes.md) · [4. Loops](../04-loops/notes.md) · [5. Functions](../05-functions/notes.md) · [6. Pass by value and copying](../06-pass-by-value-and-copying/notes.md) |
| Built-in types and objects | [7. Strings and regex](../07-strings-and-regex/notes.md) · [8. Arrays](../08-arrays/notes.md) · [9. Objects and enums](../09-objects-and-enums/notes.md) · [10. `this`, `call`, `apply` and `bind`](../10-this-call-apply-bind/notes.md) · [11. Prototypes and classes](../11-prototypes-and-classes/notes.md) · [12. Closures, destructuring and spread](../12-closures-destructuring-spread/notes.md) · [13. Symbols, iterators and generators](../13-symbols-iterators-generators/notes.md) · [14. Map, Set, WeakMap and memory](../14-map-set-weakmap-memory/notes.md) · [15. Modules](../15-modules/notes.md) |
| Errors and async | [16. Error handling](../16-error-handling/notes.md) · [17. Callbacks and promises](../17-callbacks-and-promises/notes.md) · [18. async/await and fetch](../18-async-await-and-fetch/notes.md) · [19. The event loop](../19-event-loop/notes.md) |
| The DOM | [20. DOM and BOM](../20-dom-and-bom/notes.md) · [21. DOM tree navigation](../21-dom-tree-navigation/notes.md) · [22. Selecting elements](../22-dom-selecting/notes.md) · [23. DOM manipulation](../23-dom-manipulation/notes.md) · [24. Events and delegation](../24-events-and-delegation/notes.md) · [25. JSON and XML](../25-json-and-xml/notes.md) |
| Patterns | [26. Functional patterns](../26-functional-patterns/notes.md): currying, composition, debounce, throttle, memoisation |

Browser APIs beyond the DOM (rendering, storage, networking, security, performance) continue in the [Browser platform](../../04-browser-platform/01-rendering-pipeline/notes.md) section.

## What is JavaScript?

JavaScript is a programming language initially designed to interact with elements of web pages. It allows you to add interactivity to a web page. Typically you use JavaScript together with HTML and CSS to enhance a web page's functionality, for example:

- reacting to clicks, key presses and form input
- showing, hiding or changing content without reloading the page
- validating a form before it is sent
- loading data from a server in the background (`fetch`)
- drawing animations, games and charts

The programs written in this language are called **scripts**. They can be written right in a web page's HTML and run automatically as the page loads. They don't need special preparation or a separate compilation step to run: you ship the source code and the engine takes care of the rest.

> **Note:** "No compilation step" is true from the developer's point of view. Modern engines do compile JavaScript internally, just in time (JIT), while the program runs. See [How a JavaScript engine runs your code](#how-a-javascript-engine-runs-your-code).

### Key characteristics

| Characteristic | What it means |
| --- | --- |
| High-level | You never manage memory by hand; a garbage collector frees values you no longer use. |
| Dynamically typed | A variable's type is decided at runtime and can change (see [Data types, variables and hoisting](../02-types-variables-hoisting/notes.md)). |
| Single-threaded | Your code runs on one call stack, one statement at a time. Waiting (timers, network) is handled by the environment, and callbacks run later via the event loop (see [The event loop](../19-event-loop/notes.md)). |
| First-class functions | Functions are values: they can be stored in variables, passed as arguments and returned (see [Functions](../05-functions/notes.md)). |
| Multi-paradigm | You can write procedural, object-oriented (prototypes and `class`) and functional code. |
| Prototype-based objects | Objects inherit directly from other objects; `class` is a cleaner syntax over prototypes. |

### JavaScript, ECMAScript and Java

- **ECMAScript** is the language *specification* (standard ECMA-262), maintained by a committee called TC39. **JavaScript** is the language that implements it, plus extra APIs from the environment it runs in.
- **ES6 / ES2015** was the big update that added `let`/`const`, arrow functions, classes, template literals, promises and modules. Since 2015 a new edition is released every year (ES2016, ES2017, ...). "JavaScript is constantly evolving with new features and standards" refers to this yearly process.
- **JavaScript is not Java.** It was created by Brendan Eich at Netscape in 1995; the name was a marketing choice. The two languages are unrelated apart from some C-style syntax.

## JavaScript engines

JavaScript can execute not only in the browser, but also on the server, or actually on any device that has a special program called the **JavaScript engine**. The browser has an embedded engine, sometimes called a "JavaScript virtual machine".

Different engines have different "codenames". For example:

| Engine | Used in |
| --- | --- |
| V8 | Chrome, Opera and Edge; also Node.js and Deno |
| SpiderMonkey | Firefox |
| JavaScriptCore | Safari; also the Bun runtime |

### Engine vs runtime

The **engine** only understands the language itself: variables, functions, objects, `if`, loops, promises. Everything else comes from the **runtime** (host environment) that embeds the engine.

| Provided by | Examples |
| --- | --- |
| The language (engine) | `let`, `function`, `Array`, `Math`, `JSON`, `Promise` |
| The browser runtime | `document` (the DOM), `window`, `fetch`, `setTimeout`, `localStorage`, `alert` |
| The Node.js runtime | `require`/`import` of `fs`, `http`, `path`; `process`; `setTimeout` |

That is why `document` works in the browser but gives `ReferenceError: document is not defined` in Node, and why `fs` exists in Node but not in the browser.

## How a JavaScript engine runs your code

At a high level, every modern engine does roughly the same thing (V8's component names are shown in brackets):

1. **Parse.** The source text is split into tokens and turned into an Abstract Syntax Tree (AST). Syntax errors are reported here, before any line runs.
2. **Interpret.** An interpreter (V8: *Ignition*) turns the AST into bytecode and starts executing it immediately, so the page starts fast.
3. **Optimise hot code.** While the code runs, the engine watches which functions run often ("hot" code) and what types they receive. An optimising JIT compiler (V8: *TurboFan*) compiles them to fast machine code based on those observations.
4. **De-optimise when assumptions break.** If a function that always received numbers suddenly receives a string, the optimised code is thrown away and execution falls back to bytecode.
5. **Collect garbage.** Values that can no longer be reached from your code are freed automatically.

### Execution context, call stack and event loop

This is an overview; the full model (tasks vs microtasks, when the browser renders, Node's phases) is in [The event loop](../19-event-loop/notes.md).

- Before running a script, the engine creates a **global execution context**. In a *creation phase* it registers all declarations (this is what causes **hoisting**, covered in [Data types, variables and hoisting](../02-types-variables-hoisting/notes.md#hoisting-and-the-temporal-dead-zone-tdz) and [Functions](../05-functions/notes.md#function-declaration)), then it runs the code line by line in the *execution phase*.
- Each function call creates a new execution context that is pushed onto the **call stack** and popped when the function returns.
- There is only one call stack, so only one piece of your JavaScript runs at a time. Slow work such as timers and network requests is handed to the runtime. When that work finishes, its callback is placed in a **queue**, and the **event loop** moves it onto the call stack once the stack is empty.

```js
console.log("1");
setTimeout(() => console.log("3 (from the timer)"), 0);
console.log("2");
// → 1
// → 2
// → 3 (from the timer)
```

Even with a `0` ms delay, the timer callback waits in the queue until the current script has finished.

## Client-side vs server-side JavaScript

When JavaScript is used on a web page, it is executed in web browsers, serving as a **client-side** language.

JavaScript can run on both web browsers and servers. A popular JavaScript server-side environment is **Node.js**. Unlike client-side JavaScript, **server-side** JavaScript executes on the server and allows you to access databases, file systems, etc.

| | Client-side JavaScript | Server-side JavaScript (Node.js) |
| --- | --- | --- |
| Runs on | The user's browser | A server (or your own machine) |
| Can access | The DOM, browser storage, user events, `fetch` | The file system, databases, environment variables, network ports |
| Cannot access | The user's file system or your database directly | The DOM (`document`, `window`) |
| Code is visible to | Everyone (anyone can open DevTools and read it) | Only you; keep secrets such as API keys here |
| Typical use | Interactive UI, React front ends | APIs and web servers, e.g. Express.js |
| How you run it | `<script>` tag in an HTML page | `node file.js` |

In the MERN stack, React (the "R") is client-side JavaScript, while Node.js and Express.js (the "N" and "E") are server-side JavaScript.

## Why JavaScript matters

JavaScript is one of the most widely used languages in the world, and there are several reasons why it is in such demand:

- **Used on both client and server side.** Earlier, JavaScript was used to build client-side applications only, but with the evolution of the Node.js runtime and frameworks such as Express.js, it is now widely used for building server-side applications too.
- **Helps to build a complete solution.** Because JavaScript is used on both the client and the server, one language lets you build an end-to-end solution to a given problem (this is exactly the idea behind the MERN stack).
- **Used everywhere.** It can be used to develop websites, games, mobile apps, desktop apps and more.
- **Constantly evolving.** New features and standards are added every year.
- **Huge community support.** JavaScript has a huge community of users and mentors who love the language and take its legacy forward.

## Ways to run JavaScript

| Way | How | Good for |
| --- | --- | --- |
| Browser console | Open DevTools (F12, or Ctrl+Shift+J in Chrome/Edge, Ctrl+Shift+K in Firefox) and type code into the Console tab | Quick experiments on any page |
| Inline `<script>` | Write code between `<script>` and `</script>` in an HTML file | Tiny demos |
| External `<script src>` | Put code in `script.js` and load it with `<script src="script.js"></script>` | Real projects (cacheable, reusable, keeps HTML clean) |
| Node.js file | `node script.js` in a terminal | Server code and the language topics in this section that have no HTML page |
| Node.js REPL | Type `node` with no file name to get an interactive prompt (see [The Node.js REPL](../02-types-variables-hoisting/notes.md#the-nodejs-repl)) | Trying out language features |

> **Note:** You will also see inline event handler attributes such as `<button onclick="doSomething()">`. They work, but mixing JavaScript into HTML attributes is hard to maintain; prefer `addEventListener` in a script file.

In this section, a topic whose breadcrumb says ``Run with `node script.js` `` has no HTML page: run its demo from the `Phase3-FrontEnd` folder, for example `node "03-javascript/02-types-variables-hoisting/script.js"`. Topics with an `index.html` demo (the DOM topics 20–25 and a few language topics such as 12 and 16–18) are opened in a browser; read the output in the DevTools console.

## Adding JavaScript to an HTML page

> **Note:** The `<script>` tag can be placed anywhere in the HTML document, whether it's in the `<head>`, the `<body>`, or even within a `<div>`.

```html
<!-- Inline script -->
<script>
  console.log("Hello from an inline script");
</script>

<!-- External script (preferred) -->
<script src="script.js"></script>
```

Rules worth remembering:

- When a `<script>` has a `src` attribute, any code written between its tags is **ignored**.
- `<script>` cannot be self-closed. Always write `<script src="x.js"></script>`, never `<script src="x.js" />`.
- `type="text/javascript"` is the default and can be left out.

### Where do I put the script in HTML?

It's recommended to add scripts to the bottom of the `<body>` element, because it can improve a web page's load time. Placing a plain script tag at the top of the HTML document slows the page down, because the browser blocks all other content rendering until the script has been downloaded and executed.

There is a second reason: a script runs at the moment the parser reaches it, so a script in the `<head>` runs before the `<body>` elements exist.

```html
<head>
  <script>
    // The button has not been parsed yet
    document.getElementById("btn").addEventListener("click", () => {});
    // TypeError: Cannot read properties of null (reading 'addEventListener')
  </script>
</head>
<body>
  <button id="btn">Click</button>
</body>
```

Putting the script just before `</body>` fixes both problems, and that is how the DOM demos in this section load their scripts. The modern alternative is the `defer` attribute.

### `async` and `defer`

Both attributes let the browser download an external script **in parallel** with parsing the HTML, so the download no longer blocks the page. They differ in *when* the script runs.

```html
<head>
  <script src="app.js" defer></script>        <!-- runs after the HTML is parsed, in order -->
  <script src="analytics.js" async></script>  <!-- runs as soon as it has downloaded -->
</head>
```

| | Download | When it executes | Order between scripts | Blocks HTML parsing? | Use for |
| --- | --- | --- | --- | --- | --- |
| No attribute | Stops the parser while downloading | Immediately after download | Document order | Yes, for download and execution | Rarely needed today |
| `async` | In parallel | As soon as it finishes downloading (may be before or after `DOMContentLoaded`) | Not guaranteed; whichever finishes first | Only while it executes | Independent scripts: analytics, ads, widgets |
| `defer` | In parallel | After the whole HTML is parsed, just before `DOMContentLoaded` | Document order | No | Your app code, scripts that use the DOM or depend on each other |
| `type="module"` | In parallel | Deferred by default | Document order | No | ES modules (`import`/`export`) |

> **Note:** `async` and `defer` only affect external scripts (those with `src`). On an inline classic script they are ignored. If both are present, modern browsers use `async`.

**Modern best practice:** put `<script src="script.js" defer></script>` in the `<head>`. The download starts as early as possible, the HTML is never blocked, and the DOM is ready when the script runs. Bottom-of-`<body>` placement is still perfectly valid; it just starts the download later.

## Strict mode

Strict mode is an opt-in, stricter variant of JavaScript (added in ES5). It turns some silent mistakes into errors, changes how `this` behaves in plain function calls, and forbids a few legacy features that make code hard to read and optimise. Whether your code is strict depends on **how it is loaded**, which is why it belongs with the rest of this note.

### Turning it on

- Write `"use strict";` as the **first statement** of a script or of a function. Comments before it are fine; anywhere else it is just an unused string and does nothing.
- Code in **ES modules** (`<script type="module">`, `.mjs` files, files with `import`/`export` in a `"type": "module"` package) and inside **`class` bodies** is always strict. You cannot opt out.
- Classic browser scripts and Node CommonJS files are **sloppy** (non-strict) unless they opt in.

### What changes

| Behaviour | Sloppy (normal) mode | Strict mode |
| --- | --- | --- |
| Assigning to an undeclared variable (`x = 5`) | Silently creates a global | `ReferenceError` |
| `this` in a plain function call `f()` | Global object (`window` / `globalThis`) | `undefined` |
| Writing to a read-only property (frozen object, getter-only property, `undefined`) | Silently ignored | `TypeError` |
| Adding a property to a primitive (`"abc".x = 1`) | Silently ignored | `TypeError` |
| Deleting a non-deletable property (`delete Object.prototype`) | Returns `false` | `TypeError` |
| Duplicate parameter names `function f(a, a)` | Allowed | `SyntaxError` |
| Legacy octal literal `010` | Means 8 | `SyntaxError` (write `0o10`) |
| `with` statement | Allowed | `SyntaxError` |
| `arguments` vs parameters | Linked: assigning to `a` also changes `arguments[0]` | Independent copies |
| `var` declared inside `eval("...")` | Leaks into the surrounding scope | Stays inside the `eval` |

```js
"use strict";
function show() {
  return this;
}
console.log(show()); // → undefined (in sloppy mode this would be the global object)

let total = 0;
totl = 10;           // ReferenceError: totl is not defined
                     // (sloppy mode would silently create a global called totl)
```

```js
"use strict";
const config = Object.freeze({ debug: false });
config.debug = true; // TypeError: Cannot assign to read only property 'debug' of object '#<Object>'
                     // (sloppy mode ignores the write, and config.debug stays false)
```

### Strict-mode pitfalls

- **The directive must come first.** `console.log("x"); "use strict";` does nothing: by the time the string appears it is an ordinary expression, not a directive.
- **Functions with default, rest or destructured parameters cannot contain `"use strict"`.** `function f(a = 1) { "use strict"; }` is `SyntaxError: Illegal 'use strict' directive in function with non-simple parameter list`. Put the directive at the top of the file, or use a module.
- **Concatenating files changes strictness.** A script-level directive applies to the whole script. Concatenating a strict file in front of sloppy legacy code makes the legacy code strict (and it may start throwing); putting it after a sloppy file turns the directive into a no-op. Bundlers that output ES modules avoid this, because module code is strict anyway.
- **Moving code into a module or a class changes its behaviour.** Implicit globals throw, top-level `this` is `undefined`, and writes to frozen objects throw instead of failing silently. Code that "worked" in a classic script often relied on one of these.

> **Note:** For a function you write today the difference rarely matters, because modern code lives in modules and classes and is strict already. Strict mode matters when you read or migrate older classic scripts, and when an interviewer asks why `this` is `undefined`. The `this` rules themselves are in [`this`, `call`, `apply` and `bind`](../10-this-call-apply-bind/notes.md).

## Common Mistakes

- **Accessing the DOM from a script in the `<head>` without `defer`.** `getElementById` returns `null` because the element does not exist yet.
- **Expecting `async` scripts to run in order.** If `b.js` depends on `a.js`, use `defer` on both instead.
- **Writing code inside a `<script src="...">` tag.** It is silently ignored.
- **Self-closing the script tag** (`<script src="x.js" />`). The browser treats it as an opening tag and swallows the rest of the page as script content.
- **Wrong file path or wrong letter case in `src`.** It may work on Windows but break on a case-sensitive server such as Linux or GitHub Pages.
- **Using browser APIs in Node or Node APIs in the browser.** `document` does not exist in Node; `require("fs")` does not exist in the browser.
- **Treating Java and JavaScript as related languages.**
- **Relying on sloppy-mode behaviour** (implicit globals, a plain-call `this` that is `window`, writes that fail silently). It breaks as soon as the code moves into an ES module or a class.
- **Putting `"use strict"` after another statement, or inside a function with default parameters.** The first is ignored; the second is a SyntaxError.

## Key Takeaways

- JavaScript adds behaviour to HTML and CSS; it runs in browsers (client side) and, through Node.js, on servers (server side).
- An engine (V8, SpiderMonkey, JavaScriptCore) runs the language; the runtime (browser or Node) adds APIs such as the DOM, `fetch`, `fs` and `setTimeout`.
- Engines parse, interpret and JIT-compile code while it runs; your code runs on a single thread, and async callbacks are scheduled by the event loop.
- ECMAScript is the standard; JavaScript implements it. ES6/ES2015 introduced most of modern syntax, and a new edition arrives every year.
- A plain `<script>` blocks parsing; place it at the end of `<body>`, or better, use `defer` in the `<head>`.
- `defer` keeps order and waits for the HTML; `async` runs as soon as it is downloaded, in any order.
- Run code in the browser console, in a `<script>` tag, or with `node file.js` / the Node REPL.
- Strict mode turns silent mistakes into errors and makes plain-call `this` `undefined`; ES modules and class bodies are always strict.

## Interview Questions

### Junior (0–1 year)

**Q1. What is JavaScript and what is it used for?**
JavaScript is a high-level, dynamically typed, single-threaded programming language. In the browser it makes pages interactive: handling events, updating the DOM, validating forms and fetching data. With Node.js it is also used on the server to build APIs, CLIs and tooling, so a whole application can be written in one language.

**Q2. Is JavaScript an interpreted or a compiled language?**
Traditionally it is called interpreted, because you ship source code and there is no separate build-to-machine-code step. In practice modern engines use both: an interpreter starts running bytecode immediately, and a just-in-time (JIT) compiler turns frequently-run code into optimised machine code while the program runs. The precise answer is "JIT-compiled".

**Q3. What is a JavaScript engine? Name a few.**
It is the program that parses and executes JavaScript code. Examples: V8 (Chrome, Edge, Opera, Node.js), SpiderMonkey (Firefox) and JavaScriptCore (Safari). The engine implements the ECMAScript language; things like the DOM or `setTimeout` come from the environment that embeds it.

**Q4. What is the difference between client-side and server-side JavaScript?**
Client-side JavaScript runs in the user's browser, can access the DOM and browser APIs, and its code is visible to anyone. Server-side JavaScript runs in Node.js on a server, can access files, databases and environment variables, and cannot access the DOM. Secrets such as database passwords belong only on the server side.

**Q5. Where should you place the `<script>` tag, and why?**
A plain `<script>` blocks HTML parsing while it downloads and runs, and it cannot see elements that come after it. So either place it just before `</body>`, or put it in the `<head>` with the `defer` attribute. `defer` is the modern choice because the download starts early without blocking the page.

**Q6. What is the difference between JavaScript and ECMAScript?**
ECMAScript is the specification (ECMA-262) that defines the language's syntax and behaviour; it is updated every year by TC39. JavaScript is an implementation of that specification, plus host APIs. When people say "ES6 features" they mean features added in the 2015 edition of the specification.

**Q7. What is strict mode, how do you turn it on, and when is code strict automatically?**
Strict mode is a stricter variant of JavaScript that throws errors for mistakes that are otherwise silent: assigning to an undeclared variable throws a ReferenceError, writing to a read-only property throws a TypeError, and `this` in a plain function call is `undefined` instead of the global object. You turn it on with `"use strict";` as the first statement of a script or function. ES modules and `class` bodies are always strict, so most modern code is strict without the directive.

### Mid-level (2–4 years)

**Q8. Explain `async` vs `defer`. Which would you use for an analytics script and which for your application bundle?**
Both download the script in parallel with HTML parsing. An `async` script executes as soon as it arrives, possibly before the DOM is ready and in any order relative to other scripts. A `defer` script executes after parsing completes, in document order, before `DOMContentLoaded`. Analytics is independent of everything else, so `async` fits; the application bundle needs the DOM and may depend on other scripts, so it should use `defer` (or `type="module"`, which is deferred by default).

**Q9. JavaScript is single-threaded. How can it handle timers and network requests without freezing? What does this print?**

```js
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");
```

Output: `A`, `D`, `C`, `B`. The engine runs your code on one call stack, but waiting is done by the runtime (browser Web APIs or Node's libuv). Completed work queues a callback, and the event loop runs it only when the call stack is empty. Promise callbacks go to the microtask queue, which is drained before the next task such as a timer callback, so `C` prints before `B`. The full ordering rules are in [The event loop](../19-event-loop/notes.md).

**Q10. Is `setTimeout` part of JavaScript?**
No. `setTimeout` is not in the ECMAScript specification; it is provided by the host environment (the browser's `window` and Node's global object). This is the engine vs runtime distinction: V8 alone has no timers, DOM or file system. It matters in practice because behaviour can differ between environments, for example the browser's `setTimeout` returns a number while Node's returns a `Timeout` object.

**Q11. A script in the `<head>` throws "Cannot read properties of null (reading 'addEventListener')". What is happening and how do you fix it?**
The script runs as soon as the parser reaches it, before the `<body>` elements exist, so `getElementById` returns `null`. Fixes: add `defer` to the script tag, move the script to the end of `<body>`, or wrap the code in a `DOMContentLoaded` listener. Using `defer` is the cleanest.

**Q12. At a high level, how does V8 execute and optimise code, and why can changing a variable's type hurt performance?**
V8 parses the source into an AST, its Ignition interpreter produces and runs bytecode, and its TurboFan compiler optimises hot functions into machine code using the types it has observed. If a function that always got numbers suddenly gets a string or an object of a different shape, the assumptions break and V8 de-optimises back to bytecode. Keeping types and object shapes consistent in hot code lets it stay optimised.

**Q13. How is `<script type="module">` different from a classic script?**
Module scripts are deferred by default, always run in strict mode, and have their own scope, so top-level variables do not become globals. They can use `import` and `export`, and each module is executed only once even if it is imported many times. They are fetched with CORS, so opening the page from `file://` usually fails; serve it from a local server instead. Modules are covered in [Modules](../15-modules/notes.md).

**Q14. What does this print in a classic script, and what happens when the same file becomes an ES module?**

```js
function setup() {
  count = 1;
  return this === globalThis;
}
console.log(setup());
console.log(globalThis.count);
```

In a classic (sloppy) script it prints `true`, then `1`: `count = 1` silently creates a global variable, and in a plain call `this` is the global object. As an ES module the code is strict, so `count = 1` throws `ReferenceError: count is not defined` and nothing is printed. Even with `let count` declared, `this` in the plain call would be `undefined` and the first line would print `false`. The fix is to declare every variable and not rely on `this` in functions that are called plainly.

### Senior (5+ years)

**Q15. You are migrating a large app made of classic `<script>` files that share globals to ES modules. What breaks, and how would you run the migration?**
What breaks: every module is strict, so implicit globals throw and plain-call `this` becomes `undefined`. Modules have their own scope, so top-level `var` and function declarations stop being `window` properties, and other classic scripts or inline handlers such as `onclick="save()"` can no longer find them. Module scripts are deferred, so an inline classic script that used to run after a synchronous script now runs *before* the module code it depends on. And modules are fetched with CORS and fail from `file://`.

How to run it: first turn on lint rules that catch these problems while the code is still classic (`no-undef`, `no-implicit-globals`) and fix implicit globals. Then convert leaf files (nothing depends on them) first, replacing globals with `export`/`import`. Where old code still needs a global, expose it from one explicit bridge module (`window.legacyApi = { save }`) and track its removal; replace inline `onclick` attributes with `addEventListener`. Ship through a bundler so production still loads a few files, and test load order in a real browser. Recommendation: migrate incrementally, leaf-first, with lint catching strict-mode breakage before each switch, never as a big-bang rename.

**Q16. A product page loads your app bundle, a consent manager, analytics, an A/B testing tool and a chat widget, and its Largest Contentful Paint (LCP) and Interaction to Next Paint (INP) are poor. How do you decide how each script loads?**
Classify every script by what it blocks and when it is really needed:

| Script | Loading | Why |
| --- | --- | --- |
| App bundle | `type="module"` (or `defer`) in the `<head>`, `<link rel="modulepreload">` for critical chunks | Starts early, never blocks parsing, keeps order |
| Consent manager | Early and small, before any tag that needs consent | Other tags must not run before consent is known |
| Analytics | `async`, injected only after consent | Independent; nothing waits for it |
| A/B testing | Prefer server-side or edge experiments for above-the-fold changes | A client-side tool either blocks rendering (sync) or causes visible flicker (async) |
| Chat widget | Load on first interaction or when idle, behind a lightweight button | Large, rarely used, and its start-up work hurts INP |

Then make it a process: a budget for third-party JavaScript (bytes and main-thread time), real-user Core Web Vitals monitoring, and review of every new tag like a code change. Recommendation: `defer` or modules for your own code, `async` for independent tags, lazy-load anything not needed for the first interaction, and move render-affecting experiments to the server. More in [Web performance](../../04-browser-platform/05-web-performance/notes.md).

**Q17. Your team publishes a utility package that must work in browsers, Node, server-side rendering (SSR) and Web Workers. How do you keep it from crashing on missing host APIs?**
The root cause is the engine vs runtime split: `window`, `document`, `localStorage` and `process` are host APIs, not JavaScript. Rules that keep a package portable:

- **No host access at import time.** `const store = window.localStorage;` at the top of a module crashes SSR with `ReferenceError: window is not defined` just because the file was imported. Read host APIs lazily, inside functions.
- **Use `globalThis` and feature-detect the exact API** (`typeof globalThis.localStorage !== "undefined"`, inside a `try`, because storage access can throw when storage is blocked) instead of sniffing "am I in a browser".
- **Prefer APIs that every modern runtime now shares:** `fetch`, `URL`, `AbortController`, `structuredClone`, `TextEncoder`, `crypto.randomUUID()`.
- **Put real platform differences in separate entry points** through `package.json` `"exports"` conditions (`"browser"`, `"node"`, `"default"`) rather than runtime `if` checks, and let callers inject platform services such as storage or a clock.
- **Test in every target in CI:** Node, a real browser (not only jsdom) and an SSR build.

Recommendation: treat every host API as optional, keep modules free of side effects at import time, and use `exports` conditions for genuine platform differences.

## References

- [MDN – JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [MDN – What is JavaScript?](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps/What_is_JavaScript)
- [MDN – The `<script>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script)
- [MDN – Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)
- [MDN – JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [How to use strict mode in JavaScript (freeCodeCamp)](https://www.freecodecamp.org/news/how-to-use-strict-mode-in-javascript/)
- [javascript.info – Scripts: async, defer](https://javascript.info/script-async-defer)
- [V8 blog – Launching Ignition and TurboFan](https://v8.dev/blog/launching-ignition-and-turbofan)
- [Node.js – Packages: conditional exports](https://nodejs.org/api/packages.html#conditional-exports)
