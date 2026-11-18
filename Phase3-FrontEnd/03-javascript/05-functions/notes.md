# Functions

> JavaScript · Topic 5 · Demo: [script.js](script.js) · Run with `node script.js` (no HTML page) · Companion note: [Pass by value, references and copying](../06-pass-by-value-and-copying/notes.md)

A function is a reusable block of code that takes inputs (parameters), does some work and can return a result. In JavaScript functions are also **values**: they can be stored in variables, passed to other functions (callbacks) and returned from functions. This note covers the three ways to create a function (declaration, expression, arrow), hoisting, callbacks, IIFEs, and the difference between synchronous and asynchronous code.

## Function basics

```js
function add(a, b) {   // a and b are parameters
  return a + b;        // return sends a value back to the caller
}

let c = add(3, 5);     // 3 and 5 are arguments
console.log(c);        // → 8
```

| Term | Meaning |
| --- | --- |
| Parameter | The variable name listed in the definition (`a`, `b`) |
| Argument | The actual value passed when calling (`3`, `5`) |
| Return value | The value produced by `return`; if there is no `return`, the function returns `undefined` |
| Calling / invoking | Running the function with `name(arguments)` |

A function name without parentheses (`add`) is the function object itself; with parentheses (`add(3, 5)`) it is a call.

## Function declaration

A **function declaration** (also known as a function statement) defines a function with a name right after the `function` keyword.

```js
function functionDeclaration(para1, para2) {
  // statements
}
```

One major feature of the function declaration is that it can be called **before** it is defined in the code. This is possible because of **hoisting**.

> "JavaScript Hoisting refers to the process whereby the interpreter appears to move the declaration of functions, variables, or classes to the top of their scope, prior to execution of the code."

For function declarations, the whole function (name **and** body) is hoisted, which is why this demo code works:

```js
let diff = subtract(2, 4);   // calling the function before its declaration

function subtract(a, b) {
  return (a >= b) ? (a - b) : (b - a);
}

console.log(diff);           // → 2
```

> **Note:** Function declarations are scoped like `var` to the enclosing function. Inside a block (`if`, `{ }`) in strict mode or ES modules they are block-scoped; avoid declaring functions inside blocks.

## Function expression

A **function expression** creates a function as part of an expression, usually by assigning it to a variable. Most function expressions have no name of their own, which makes them **anonymous functions**; they are called using the variable name.

```js
let addition = function (a, b) {
  return a + b;
};

let total = addition(5, 5);
console.log(total);   // → 10
```

Unlike a function declaration, you **can't call a function expression before the line that creates it**. Only the variable is hoisted, not the function:

```js
// square(3);  // with var:       TypeError: square is not a function   (square is undefined)
//             // with let/const: ReferenceError: Cannot access 'square' before initialization
var square = function (n) { return n * n; };
```

A function expression **can** also have a name (a *named function expression*). The name is visible only inside the function, which is useful for recursion and for clearer stack traces:

```js
const factorial = function fact(n) {
  return n <= 1 ? 1 : n * fact(n - 1);
};
console.log(factorial(5)); // → 120
// fact(5);                // ReferenceError: fact is not defined (only visible inside)
```

### Advantages of function expressions

#### 1. Callbacks

A **callback** is a function passed into another function as an argument, to be called later by that function. Function expressions can be used as callbacks: we can pass them directly to other functions without having to assign them to a variable first.

```js
button.addEventListener("click", function () {
  console.log("Function expression is used here"); // definition of the function expression
});
```

(`button` would be a DOM element, e.g. from `document.querySelector("button")`; this snippet runs in a browser.)

#### 2. Immediately Invoked Function Expression (IIFE)

An IIFE is a function expression that is executed immediately after being defined. You write one by wrapping the function in parentheses and adding another pair of parentheses straight after it to call it:

```js
(function () {
  // statements
  const secret = "only visible in here";
  console.log("IIFE ran");  // → IIFE ran
})();

// Arrow-function version
(() => console.log("Arrow IIFE ran"))(); // → Arrow IIFE ran
```

Why IIFEs exist: they create a private scope, so variables inside do not leak into the global scope. Before `let`, `const` and ES modules, this was the main way to avoid polluting globals. Today modules and block scope cover most cases, but IIFEs are still used for one-off setup code and for running `async` code at the top level: `(async () => { await ... })();`.

## Arrow functions

Arrow functions were introduced in ES6. They provide a shorter syntax for writing function expressions, which makes code more compact and often more readable.

```js
// Syntax:
// const functionName = (arg1, arg2, ...) => {
//   // body of the function
// };

const greet = name => console.log("Hello " + name);   // one parameter: parentheses optional
const print = () => console.log("Arrow function without any parameter");

greet("Aman"); // → Hello Aman
print();       // → Arrow function without any parameter
```

When the body is a single expression, you don't need braces or `return`: the value of the expression is returned automatically (**implicit return**). With braces you must write `return` yourself.

```js
const double = n => n * 2;                 // implicit return
const add = (a, b) => { return a + b; };   // block body: explicit return
const makeUser = () => ({ id: 1 });        // returning an object literal: wrap it in ( )
const broken = () => { id: 1 };            // braces are read as a block, so this returns undefined

console.log(double(4), add(2, 3), makeUser(), broken()); // → 8 5 { id: 1 } undefined
```

Arrow functions are anonymous functions: they are written without the `function` keyword and without a name of their own, so they are always part of an expression (usually assigned to a variable or passed as a callback). When assigned to a variable they still get that variable's name for debugging (`greet.name` is `"greet"`).

> **Correction to the original notes:** the source said arrow functions "don't return any value". That is wrong. Arrow functions return values just like other functions: implicitly for an expression body, or with `return` in a block body.

Arrow functions cannot be used as constructors: `new` on an arrow function throws `TypeError: ... is not a constructor`.

### Arrow functions vs regular functions

| | Regular function | Arrow function |
| --- | --- | --- |
| Syntax | `function (a) { return a; }` | `a => a` |
| Own `this` | Yes, decided by how it is called | No, uses `this` from the surrounding scope |
| `arguments` object | Yes | No (use rest parameters `...args`) |
| Can be used with `new` | Yes (declarations and expressions) | No |
| Has `prototype` property | Yes | No |
| Implicit return | No | Yes, for expression bodies |
| Good for object methods that use `this` | Yes | No |
| Good for short callbacks (`map`, `setTimeout`) | Works | Yes, the usual choice |

```js
const user = {
  firstName: "Aman",
  regular() { return this.firstName; },   // this = user
  arrow: () => this.firstName,            // this = outer scope's this, not user
};
console.log(user.regular()); // → Aman
console.log(user.arrow());   // → undefined
```

The rules that decide `this` for regular functions are in [`this`, `call`, `apply` and `bind`](../10-this-call-apply-bind/notes.md).

## Declaration vs expression vs arrow: summary

| | Declaration | Expression | Arrow |
| --- | --- | --- | --- |
| Example | `function f() {}` | `const f = function () {};` | `const f = () => {};` |
| Hoisted with body (callable before definition) | Yes | No | No |
| Name | Required | Optional | None (inferred from variable) |
| Own `this` / `arguments` | Yes | Yes | No |
| Constructor (`new`) | Yes | Yes | No |
| Typical use | Top-level named helpers | Callbacks, conditional definitions | Short callbacks, functions that need the outer `this` |

Source: [Functions in JavaScript: declaration, expression, arrow (Medium)](https://mayanovarini.medium.com/functions-in-javascript-declaration-expression-arrow-d6f907dc850a#:~:text=There%20is%20also%20%E2%80%9CArrow%20Function,in%20the%20main%20code%20flow.&text=Function%20Expressions%20are%20created%20inside,such%20as%20a%20variable%20declaration.)

## Parameters and arguments in detail

JavaScript does not check how many arguments you pass. Missing ones are `undefined`; extra ones are ignored (but still available in `arguments`).

```js
function show(a, b) {
  return [a, b, arguments.length];
}
console.log(show(1));        // → [ 1, undefined, 1 ]
console.log(show(1, 2, 3));  // → [ 1, 2, 3 ]
```

**Default parameters** (ES6) are used when the argument is missing or `undefined`. They can refer to earlier parameters:

```js
function greet(name = "Guest", greeting = `Hello ${name}`) {
  return greeting;
}
console.log(greet());        // → Hello Guest
console.log(greet("Aman"));  // → Hello Aman
```

**Rest parameters** collect any number of arguments into a real array. They must be the last parameter:

```js
function sum(...nums) {
  return nums.reduce((total, n) => total + n, 0);
}
console.log(sum(1, 2, 3)); // → 6
```

Arguments are passed **by value**; for objects, the value is a reference. See [Pass by value, references and copying](../06-pass-by-value-and-copying/notes.md).

## Scope and closures (preview)

A function can read variables from the scope where it was **defined**. A **closure** is a function together with the variables it remembers from that outer scope, even after the outer function has returned.

```js
function counter() {
  let count = 0;            // private: no outside code can touch it
  return () => ++count;     // the inner function "closes over" count
}

const next = counter();
next();
console.log(next()); // → 2
```

Closures power callbacks, event handlers, private state and React hooks. They are covered in depth in [Closures, destructuring and spread](../12-closures-destructuring-spread/notes.md).

## Callback functions

A callback is a function passed as an argument to another function, which calls it at the right time. The demo uses `setTimeout`, which takes a callback and a delay in milliseconds:

```js
function paritech() {
  console.log("Hello world");
}

function sayName(name) {
  console.log("Hello" + " " + name);
}

// calling the functions
setTimeout(paritech, 2000);   // pass the function itself, do not call it: no ()
sayName("John");

// Output:
// → Hello John
// → Hello world   (about 2 seconds later)
```

Explanation: `setTimeout` only *schedules* `paritech`; it does not wait. So `sayName("John")` runs straight away and prints "Hello John", and about two seconds later the timer fires and `paritech` prints "Hello world". (The demo's comment calls it the "greet" function, but the callback in the code is `paritech`.)

> **Note:** `setTimeout(paritech(), 2000)` would be a bug: it calls `paritech` immediately and passes its return value (`undefined`) to `setTimeout`.

### Synchronous vs asynchronous code

- **Synchronous** code runs one statement at a time, in order. Each statement must finish before the next starts, so a slow operation blocks everything after it.
- **Asynchronous** code starts an operation (a timer, a network request, reading a file) and moves on without waiting. When the operation finishes, a callback is queued and runs later.

JavaScript itself runs on a single thread, so asynchronous operations are not running your JavaScript in parallel. The waiting happens in the environment (browser or Node), and the event loop runs the queued callbacks one at a time when the call stack is empty. This lets one thread keep many tasks in progress concurrently. The full model is in [The event loop](../19-event-loop/notes.md).

```js
console.log("start");
setTimeout(() => console.log("timeout"), 0);
console.log("end");
// → start
// → end
// → timeout   (even with 0 ms, it waits until the current code finishes)
```

### Why do we need callbacks?

One place you need a callback is anywhere the language doesn't give you **coordination**. Coordination means code doesn't execute until the data it needs is ready. Synchronous calls are coordinated: the call doesn't return until the sub-computation is finished. Asynchronous calls don't give you coordination (the call returns immediately, before the result exists), so you pass a callback that runs when the data is ready.

Nesting many callbacks inside each other ("callback hell") quickly becomes hard to read; Promises and `async`/`await` solve this and are covered in [Callbacks and Promises](../17-callbacks-and-promises/notes.md) and [async/await and the Fetch API](../18-async-await-and-fetch/notes.md).

## Higher-order functions

A **higher-order function** takes a function as an argument or returns a function. `setTimeout`, `addEventListener`, `map`, `filter` and `reduce` take functions; `counter()` above returns one. This works because functions in JavaScript are **first-class values**.

```js
const nums = [1, 2, 3];
const doubled = nums.map(n => n * 2);   // map is a higher-order function
console.log(doubled);                   // → [ 2, 4, 6 ]

const multiplier = factor => n => n * factor; // returns a function
const triple = multiplier(3);
console.log(triple(5));                 // → 15
```

Higher-order functions are the basis of the reusable patterns in [Functional patterns](../26-functional-patterns/notes.md): currying, composition, debounce, throttle and memoisation.

## Common Mistakes

- **Calling a function expression or arrow function before its definition.** Only declarations are hoisted with their body.
- **Passing `fn()` instead of `fn` as a callback.** The function runs immediately instead of later.
- **Forgetting `return` in a block-bodied arrow function** (`n => { n * 2 }` returns `undefined`).
- **Returning an object literal from an arrow without parentheses** (`() => { id: 1 }` returns `undefined`).
- **Using an arrow function as an object method** that needs `this`; it gets the outer `this` instead of the object.
- **Expecting code after `setTimeout` to wait for the timer.** It doesn't; put dependent code inside the callback.
- **Forgetting `return` entirely.** The caller receives `undefined`.

## Key Takeaways

- Three ways to create a function: declaration (`function f() {}`), expression (`const f = function () {}`) and arrow (`const f = () => {}`).
- Function declarations are hoisted with their body and can be called before they appear; expressions and arrows cannot.
- Arrow functions are shorter, return implicitly for single expressions, have no own `this` or `arguments`, and cannot be used with `new`.
- A callback is a function passed to another function to be called later; IIFEs run immediately and create a private scope.
- Default parameters handle missing arguments; rest parameters collect extra ones into an array.
- Asynchronous operations don't block; their callbacks run later via the event loop, which is why callbacks (and later Promises) are needed.
- Functions are first-class values, which makes closures and higher-order functions possible.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between a function declaration and a function expression?**
A declaration (`function add() {}`) is a standalone statement with a required name, and it is hoisted with its body, so it can be called before it appears in the code. An expression (`const add = function () {}`) creates the function as part of an expression, usually assigned to a variable; only the variable is hoisted, so calling it early throws. Expressions are commonly used as callbacks and IIFEs.

**Q2. What does this print?**

```js
console.log(hello());
console.log(typeof bye);
function hello() { return "hi"; }
var bye = function () { return "bye"; };
```

`hi`, then `undefined`. `hello` is a function declaration, hoisted with its body. `bye` is a `var` holding a function expression; only the `var` is hoisted and initialised to `undefined`, so `typeof bye` is `"undefined"`. Calling `bye()` on the second line would throw `TypeError: bye is not a function`.

**Q3. How are arrow functions different from regular functions?**
They have shorter syntax and implicitly return the value of a single-expression body. They do not have their own `this` (they use the `this` of the surrounding scope), they have no `arguments` object, and they cannot be used as constructors with `new`. That makes them ideal for callbacks but unsuitable for object methods that rely on `this`.

**Q4. What is a callback function?**
A function passed as an argument to another function, which calls it later, for example `setTimeout(fn, 1000)`, `button.addEventListener("click", fn)` or `arr.map(fn)`. Callbacks let code run at the right time, such as after a timer, an event or an asynchronous operation finishes.

**Q5. What does a function return if it has no `return` statement?**
It returns `undefined`. The same is true for `return;` with no value, and for a block-bodied arrow function without `return`, such as `const f = n => { n * 2 };`, which returns `undefined` rather than the doubled value.

**Q6. What is the difference between parameters and arguments? What happens if you pass fewer arguments than parameters?**
Parameters are the names in the function definition; arguments are the actual values passed in a call. JavaScript does not enforce the count: missing arguments become `undefined` (unless a default parameter is set), and extra arguments are ignored but still available via `arguments` or rest parameters.

### Mid-level (2–4 years)

**Q7. What does this print, and why?**

```js
const user = {
  firstName: "Aman",
  regular() { return this.firstName; },
  arrow: () => this.firstName,
};
console.log(user.regular());
console.log(user.arrow());
```

`Aman`, then `undefined` (when run as a plain script in Node or the browser). In `regular`, `this` is the object before the dot, `user`. The arrow function has no own `this`; it uses `this` from the scope where the object literal was written (the module or global scope), which has no `firstName`. In an ES module, top-level `this` is `undefined`, so the second call would throw a TypeError instead.

**Q8. What is a closure? Give a practical use.**
A closure is a function bundled with the variables of the scope it was defined in; it keeps access to them even after that outer function has returned. Practical uses: private state (a `counter()` that returns an increment function), function factories (`multiplier(3)`), memoisation caches, and event handlers or React hooks that remember values. A common pitfall is a stale closure that keeps an old value.

**Q9. What is the output order?**

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
(function () { console.log("3"); })();
console.log("4");
```

`1`, `3`, `4`, `2`. The IIFE runs synchronously right where it is defined. The `setTimeout` callback is queued by the timer and only runs after all synchronous code has finished, even with a delay of 0.

**Q10. What is the difference between rest parameters and the `arguments` object?**
`arguments` is an array-like object (not a real array) containing all arguments; it exists only in regular functions, not arrow functions. Rest parameters (`...args`) create a real array containing only the arguments not matched by earlier parameters, and they work in arrow functions. Prefer rest parameters in modern code, because array methods like `map` and `reduce` work on them directly.

**Q11. Why can't arrow functions be used as constructors, and where would using one as a method or event handler cause a bug?**
Arrow functions have no `prototype` property and no own `this`, so there is nothing for `new` to bind a new object to; `new` throws a TypeError. As an object method, an arrow's `this` is not the object. In a DOM event handler, `this` would not be the element (use `event.currentTarget` or a regular function). In a class or React component, arrows are often used on purpose so callbacks keep the instance's `this`.

**Q12. A teammate writes `setTimeout(saveData(), 5000)` and the data is saved immediately with no delay. What is wrong?**
`saveData()` is called immediately, and its return value (probably `undefined`) is what gets passed to `setTimeout`. The callback must be the function itself: `setTimeout(saveData, 5000)`, or, if it needs arguments, a wrapper: `setTimeout(() => saveData(id), 5000)`.

### Senior (5+ years)

**Q13. A widely used helper has the signature `formatPrice(amount, currency, locale, showSymbol, decimals)`. What would you change, and what rules would you set for public functions in a shared library?**
Five positional parameters force every caller to remember the order, a call such as `formatPrice(10, "INR", "en-IN", false, 2)` is unreadable (what does `false` mean?), and every new option is either appended as a sixth positional parameter or becomes a breaking change. Keep the required input positional and move optional settings into an options object with destructured defaults:

```js
function formatPrice(amount, { currency = "INR", locale = "en-IN", showSymbol = true, decimals = 2 } = {}) {
  return new Intl.NumberFormat(locale, {
    style: showSymbol ? "currency" : "decimal",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

formatPrice(1234.5);                                       // → ₹1,234.50
formatPrice(1234.5, { currency: "USD", locale: "en-US" }); // → $1,234.50
formatPrice(1234.5, { showSymbol: false, decimals: 0 });   // → 1,235
```

Rules worth writing down: at most two or three positional parameters, all optional ones in an options object (with `= {}` so it can be omitted); no positional booleans; asynchronous functions return promises (not callbacks) and accept `{ signal }` for cancellation; never mutate arguments; validate at the public boundary and throw `TypeError`/`RangeError` with clear messages. Adding an option is non-breaking; removing one or changing a default is a major version. Recommendation: options objects for anything optional, so the API can grow without breaking callers.

**Q14. Production stack traces are full of frames with no function name and of generic wrappers such as `withRetry` and `compose`, and on-call engineers can't tell what failed. How do you make function-heavy code debuggable?**

- **Source maps** uploaded to the error-monitoring service (not served publicly), so minified names and lines map back to the source.
- **Names where traces need them.** JavaScript infers names for `const save = () => {}` and object methods, but not for inline callbacks (`items.map(() => ...)`) or functions returned from a factory (`make().name` is `""`). Give important callbacks a name, or assign them to a `const` before passing them.
- **Keep the original error.** Wrappers should add context, not replace it: `throw new Error("Saving order failed", { cause: err })`, never a bare `catch {}` or a new error that drops the stack.
- **Prefer `async`/`await` over long `.then()` chains.** V8 reconstructs async stack traces across `await`, so the trace shows which caller was waiting; plain `.then()` chains lose most of that context.

Recommendation: source maps plus named functions at module boundaries plus `cause` chaining; together they turn "anonymous at bundle.js:1:48213" into an actionable trace.

**Q15. Your team mixes function declarations and `const` arrow functions with no rule. Would you standardise, and on what?**
Yes, because the choice has real behavioural differences, and an unwritten rule gets re-argued in every review:

| | `function` declaration | `const` arrow |
| --- | --- | --- |
| Hoisting | Callable anywhere in its scope, so "main logic first, helpers below" works | TDZ: calling it before the line at module top level throws |
| Own `this` / `arguments` | Yes | No (lexical), which is ideal for callbacks |
| Accidental `new` | Possible | Impossible (TypeError) |
| Name in stack traces | Always | Inferred from the variable |

A common, defensible rule: declarations for named top-level and exported functions, arrows for callbacks and inline functions (and wherever the outer `this` is needed), method shorthand in objects and classes. Encode it in lint with `func-style: ["error", "declaration", { "allowArrowFunctions": true }]`, `prefer-arrow-callback`, and `no-use-before-define` with `{ "functions": false }` so top-down ordering of declarations is allowed while TDZ mistakes with variables are caught. Recommendation: pick one rule, put it in the lint config, and stop discussing it in reviews.

> **Note:** Related questions answered elsewhere: [Destructuring, Spread, Rest, IIFE and Closures](../12-closures-destructuring-spread/notes.md#interview-questions) (IIFEs).

## References

- [Functions in JavaScript: declaration, expression, arrow (Medium)](https://mayanovarini.medium.com/functions-in-javascript-declaration-expression-arrow-d6f907dc850a#:~:text=There%20is%20also%20%E2%80%9CArrow%20Function,in%20the%20main%20code%20flow.&text=Function%20Expressions%20are%20created%20inside,such%20as%20a%20variable%20declaration.)
- [MDN – Functions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions)
- [MDN – Arrow function expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
- [MDN – IIFE](https://developer.mozilla.org/en-US/docs/Glossary/IIFE)
- [MDN – Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)
- [MDN – Callback function](https://developer.mozilla.org/en-US/docs/Glossary/Callback_function)
- [MDN – Rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters)
- [MDN – Function: name](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name)
- [MDN – Error: cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
- [ESLint – func-style](https://eslint.org/docs/latest/rules/func-style)
- [Pass by value, references and copying (companion note)](../06-pass-by-value-and-copying/notes.md)
