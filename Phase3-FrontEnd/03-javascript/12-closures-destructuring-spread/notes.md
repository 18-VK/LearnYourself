# Destructuring, Spread, Rest, IIFE and Closures

> JavaScript · Topic 12 · Demo: [index.html](index.html) · [script.js](script.js) · Run with `node script.js`, or open index.html and check the devtools console

This note covers five features you will use every day in modern JavaScript and React: destructuring to unpack values, the spread operator to expand them, rest parameters to collect them, IIFEs to create a private scope, and closures, which let a function remember the variables around it. Closures in particular are one of the most asked interview topics.

## Destructuring

The destructuring assignment syntax is a JavaScript expression that unpacks values from arrays, or properties from objects, into separate variables.

### Object destructuring

```js
const person = {
  name: "Sara",
  age: 25,
  gender: "female",
};

// Without destructuring
// let name = person.name;
// let age = person.age;
// let gender = person.gender;

// With destructuring
let { name, age, gender } = person;
console.log(name); // → "Sara"
console.log(age);  // → 25
```

> **Note:** The order of the names does not matter in object destructuring, because values are matched by **key**, not by position. You could write the program above as:
>
> ```js
> let { age, gender, name } = person;
> console.log(name); // → "Sara"
> ```

> **Note:** When destructuring objects, the variable name must match the object key. To use a different variable name, rename it with `key: newName`:
>
> ```js
> // using different variable names
> let { name: name1, age: age1, gender: gender1 } = person;
> console.log(name1); // → "Sara"
> ```

#### Default values

A default is used when the property is missing (its value is `undefined`):

```js
let { name: nameTemp, Height = 168 } = person;
console.log(Height); // → 168 (person has no Height, so the default is used instead of undefined)

// Rename and default together
const { name: userName = "Guest", city = "Delhi" } = person;
console.log(userName, city); // → "Sara" "Delhi"
```

> **Note:** Defaults apply only to `undefined`, not to `null`. `const { x = 5 } = { x: null }` gives `x === null`.

#### Nested objects and function parameters

```js
const user = { id: 1, address: { city: "Delhi", pin: 110001 } };
const { address: { city: userCity } } = user;
console.log(userCity); // → "Delhi"

// Destructuring in parameters (very common for React props and options objects)
function greet({ name, age = 18 } = {}) {
  return `${name} is ${age}`;
}
console.log(greet(person)); // → "Sara is 25"
console.log(greet());       // → "undefined is 18" (the `= {}` default stops a TypeError)
```

#### Assigning to existing variables

Without `let`/`const`, wrap the statement in parentheses; otherwise `{` starts a code block and you get a `SyntaxError`:

```js
let a1, b1;
({ a1, b1 } = { a1: 1, b1: 2 });
console.log(a1, b1); // → 1 2
```

### Array destructuring

Arrays are destructured by **position**:

```js
const profile = ["Oluwatobi", "Sofela", "codesweetly.com"];

const [firstName, lastName, website] = profile;
console.log(firstName); // → "Oluwatobi"
console.log(lastName);  // → "Sofela"
console.log(website);   // → "codesweetly.com"

// Default values work the same way
let [firstName1, lastName1, website1, Domain = ".com"] = profile;
console.log(Domain); // → ".com" (there is no 4th item)
```

#### Skipping items

Leave a hole with an extra comma to skip values you do not need:

```js
const arrValue = ["one", "two", "three"];
const [i, , j] = arrValue;
console.log(i); // → "one"
console.log(j); // → "three"
```

#### Swapping variables

```js
let x = 4;
let y = 7;
[x, y] = [y, x];
console.log(x); // → 7
console.log(y); // → 4
```

### Rest element in destructuring

`...name` collects all remaining items into one variable: an **array** for array destructuring, an **object** for object destructuring.

```js
let [first, ...all] = arrValue;
console.log(first); // → "one"
console.log(all);   // → ["two", "three"]

let { name: propFirst, ...rest } = person;
console.log(propFirst); // → "Sara"
console.log(rest);      // → { age: 25, gender: "female" }
```

> **Note (demo fix):** `script.js` writes `let {PropFirst, ...rest} = person;` with a comment saying `PropFirst` is `"Sara"`. It is actually `undefined`, because `person` has no key called `PropFirst`, and `rest` then contains the whole object. Rename the key instead: `let { name: PropFirst, ...rest } = person;`.

> **Note:** The rest element must be the **last** item and cannot have a trailing comma. `let [a, ...rest, b] = arr` and `let [a, ...rest,] = arr` are both `SyntaxError`s.

## Spread Operator

The spread operator `...` **expands** (spreads out) the elements of an iterable such as an array or string, or the properties of an object. It is useful for combining arrays, passing array items to a function as separate arguments, and copying arrays and objects.

```js
let arr = ["RCB", "MI", "KKR", "GT"];
let Obj = { Name: "AMAN", Age: 21, Height: 168 };

console.log(arr[0], arr[1], arr[2]);   // → RCB MI KKR
console.log(...arr);                   // → RCB MI KKR GT  (each item becomes an argument)

// Inside arrays
let arr2 = ["RR", ...arr, "CSK", "SRH"];
console.log(arr2); // → ["RR", "RCB", "MI", "KKR", "GT", "CSK", "SRH"]

// Inside objects: merge
let obj2 = { weight: 59, city: "Delhi" };
let obj3 = { ...Obj, ...obj2 };
console.log(obj3); // → { Name: "AMAN", Age: 21, Height: 168, weight: 59, city: "Delhi" }

// Copy an object, then change the copy
let copyObj = { ...Obj };
copyObj.Name = "harry";
console.log(copyObj.Name, Obj.Name); // → "harry" "AMAN" (the original is untouched)

// More uses
console.log([..."hi"]);              // → ["h", "i"]
console.log(Math.max(...[3, 9, 4])); // → 9
console.log({ ...{ a: 1, b: 2 }, ...{ b: 3 } }); // → { a: 1, b: 3 } (later keys win)
```

> **Note:** Only **iterable** values, like arrays, strings, `Map`s and `Set`s, can be spread into array literals and function arguments. Plain objects are not iterable (see [the iteration protocols](../13-symbols-iterators-generators/notes.md#the-iteration-protocols)), so `console.log(...Obj)` throws `TypeError: Spread syntax requires ...iterable[Symbol.iterator] to be a function`. Plain objects **can** be spread inside an object literal (`{ ...Obj }`), which copies their own enumerable properties.

### Spread makes a shallow copy

Only the top level is copied. Nested objects and arrays are still shared:

```js
const orig = { name: "Aman", skills: ["js"] };
const copy = { ...orig };
copy.skills.push("css");
console.log(orig.skills); // → ["js", "css"]  (the nested array is shared!)

const deep = structuredClone(orig); // deep copy (modern browsers and Node 17+)
deep.skills.push("node");
console.log(orig.skills); // → ["js", "css"]  (unchanged)
```

Shallow vs deep copies, and why objects behave this way, are covered in [Call by value vs call by reference](../06-pass-by-value-and-copying/notes.md).

## Rest Parameters

When `...` is used in a function's **parameter list**, it is called a **rest parameter**. It lets a function accept any number of arguments.

While the spread operator expands elements, the rest syntax **condenses** them into a single variable, in function parameters or in destructuring. It collects the remaining elements into one array, which makes flexible functions easy to write.

```js
function sum(...args) {
  return args;
}
console.log(sum(12, 23, 45));        // → [12, 23, 45]
console.log(typeof sum(12, 23, 45)); // → "object" (arrays are objects; use Array.isArray to check)

// A real sum
function total(...nums) {
  return nums.reduce((acc, n) => acc + n, 0);
}
console.log(total(12, 23, 45)); // → 80
console.log(total());           // → 0
```

> **Note:** Using the rest parameter passes the arguments in as **array elements**, so you can use array methods (`map`, `reduce`, `filter`) on them directly.

Rules: only one rest parameter per function, and it must be the last parameter: `function f(a, b, ...others)`.

### Extra arguments are ignored

```js
function add(num1, num2, num3) {
  return num1 + num2 + num3;
}
console.log(add(1, 2, 4, 5, 6)); // → 7 (only the first three are used)
console.log(add(1, 2));          // → NaN (num3 is undefined, 1 + 2 + undefined = NaN)
```

The demo's comment says the function "can only accept 2 arguments"; it has **three** parameters, so the first three values are used and 5 and 6 are ignored.

### Rest parameters vs the old `arguments` object

| | Rest parameter `...args` | `arguments` |
|---|---|---|
| Type | Real array | Array-like object (no `map`, `reduce`...) |
| Contains | Only the arguments not matched by earlier parameters | All arguments |
| Available in arrow functions | Yes | No |
| Recommended | Yes | Legacy code only |

### Spread vs rest at a glance

| | Spread | Rest |
|---|---|---|
| What it does | Expands one value into many | Collects many values into one |
| Where it appears | Function **calls**, array literals, object literals | Function **parameters**, left side of destructuring |
| Example | `Math.max(...nums)` | `function f(...nums) {}` |

## Immediately Invoked Function Expressions (IIFE)

An IIFE is a function that runs immediately after it is defined. It is typically used to create a **local scope** so its variables do not pollute the global scope.

```js
(function () {
  // IIFE code block
  var localVar = "This is a local variable";
  console.log(localVar); // → This is a local variable
})();
```

How it works: the first pair of parentheses turns the function into an **expression**, and the final `()` calls it. Other valid forms:

```js
(function () { /* ... */ }());   // call inside the parentheses
(() => { /* ... */ })();         // arrow function IIFE
(async () => {                   // async IIFE
  // const res = await fetch(url);
})();
```

### Use cases of IIFE

- **Avoid polluting the global namespace:** variables inside stay private to the IIFE.
- **Create closures:** the returned functions keep access to the IIFE's variables.
- **Create private and public variables and methods** (the module pattern, below).
- **Run `async`/`await` code:** before top-level `await` existed (it works only in ES modules), an `async` IIFE was the way to use `await` at the top of a script.
- **Work with the `require` function:** in Node.js CommonJS files (the ones that use `require`), Node itself wraps every file in a function, so each file already has its own private scope; older Node.js scripts also used an `async` IIFE to `await` inside a file that loads modules with `require`.

### The module pattern

```js
const counterModule = (function () {
  let count = 0;                         // private

  function log() {                       // private helper
    return `count = ${count}`;
  }

  return {                               // public API
    increment() { count++; return log(); },
    reset() { count = 0; return log(); },
  };
})();

console.log(counterModule.increment()); // → "count = 1"
console.log(counterModule.increment()); // → "count = 2"
console.log(counterModule.count);       // → undefined (private)
```

### The demo's IIFE

```js
var print = (function () {
  var StrVar = "RCB";
  console.log("Inside Function: " + StrVar); // → Inside Function: RCB
  console.log(arr2);                         // global variables are still readable inside
})();

console.log(print); // → undefined (the IIFE returns nothing)
```

> **Note (corrected):** The demo's comment suggests `print.StrVar` would give the value outside the function. It does not: `print` holds the IIFE's **return value**, which is `undefined`, so `print.StrVar` throws `TypeError: Cannot read properties of undefined (reading 'StrVar')`. `StrVar` is a local variable and is never reachable from outside, with an IIFE or a normal function. To expose something, `return` it.

> **Note:** If the previous line has no semicolon, a line starting with `(` is read as a function call on that line: `const a = 1` followed by `(function(){})()` becomes `1(function(){})()` → `TypeError`. Code styles without semicolons write `;(function () {})()`.

Today, `let`/`const` block scope (`{ ... }`) and [ES modules](../15-modules/notes.md) give you private scope without an IIFE, but IIFEs are still common in older code, bundler output and interviews.

## Closures

Closures are a powerful and fundamental concept in JavaScript. They allow an inner function to access variables from its outer scope **even after the outer function has finished running**. In simpler terms, a closure "closes over" its lexical scope and keeps the outer function's variables alive.

A closure is the combination of a function bundled together (enclosed) with references to its surrounding state, the **lexical environment**. When you create a closure, the inner function gets access to the outer function's scope.

> **Note:** Closure = function + the lexical environment in which that function was created. Every function declared inside another function has access to the outer function's scope chain, and the variables created in the outer scope are not destroyed (garbage-collected) while the inner function still references them.

```js
function foo(outer_arg) {
  function inner(inner_arg) {
    return outer_arg + inner_arg;
  }
  return inner; // returning a function
}

let innerFunction = foo(5);       // foo has finished; outer_arg = 5 is kept by the closure
console.log(innerFunction(4));    // → 9
```

"Lexical" means the scope is decided by **where the function is written** in the code, not by where it is called.

### Closures store references, not values

```js
function outer() {
  let arr = [];
  let i;                          // ONE variable, shared by every function below
  for (i = 0; i < 4; i++) {
    arr[i] = function () { return i; };
  }
  return arr;
}

let get_arr = outer();
console.log(get_arr[0]()); // → 4
console.log(get_arr[1]()); // → 4
console.log(get_arr[2]()); // → 4
console.log(get_arr[3]()); // → 4
```

Four closures are created, and all of them point to the **same** variable `i`, local to `outer`. A closure does not remember the value a variable had when the function was created; it stores a **reference** to the variable and reads its **current** value when called. When the loop ends, `i` is 4, so all four return 4.

The fix is to give each function its own variable. `let` declared **in the `for` header** creates a new binding for every iteration:

```js
function outerFixed() {
  const arr = [];
  for (let i = 0; i < 4; i++) {   // a fresh `i` per iteration
    arr[i] = () => i;
  }
  return arr;
}
console.log(outerFixed().map((fn) => fn())); // → [0, 1, 2, 3]
```

The same bug with `var` and `setTimeout` is a classic interview question (also covered in [Loops](../04-loops/notes.md)):

```js
for (var k = 0; k < 3; k++) {
  setTimeout(() => console.log(k), 0); // → 3, 3, 3 (one shared var)
}
for (let k = 0; k < 3; k++) {
  setTimeout(() => console.log(k), 0); // → 0, 1, 2
}
for (var k = 0; k < 3; k++) {
  (function (k) {                       // pre-ES6 fix: an IIFE gives each callback its own k
    setTimeout(() => console.log(k), 0); // → 0, 1, 2
  })(k);
}
```

### Practical uses of closures

It can be hard to understand closures in one go. Experiment with them in different scenarios, such as getters/setters, callbacks and factories:

```js
// 1. Private state with a getter
function createCounter() {
  let count = 0;
  return {
    increment() { return ++count; },
    get value() { return count; },
    reset() { count = 0; },
  };
}
const counter = createCounter();
counter.increment();
counter.increment();
console.log(counter.value); // → 2
console.log(counter.count); // → undefined (not reachable)

// 2. Function factory
function multiplier(factor) {
  return (n) => n * factor;
}
const double = multiplier(2);
const triple = multiplier(3);
console.log(double(5), triple(5)); // → 10 15

// 3. Run something only once
function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}
const init = once(() => 42);
console.log(init(), init()); // → 42 42 (fn ran only the first time)
```

Event handlers, `setTimeout` callbacks, React hooks (`useState`, `useEffect`), debounce/throttle and memoization all rely on closures. [Functional patterns](../26-functional-patterns/notes.md) builds debounce, throttle, memoize, currying and composition on top of them.

> **Note:** A closure keeps every variable it references alive. A long-lived closure (an event listener or a global callback) that references a big object keeps that object in memory too. Remove listeners you no longer need and avoid capturing large data unnecessarily. Finding and fixing leaks is covered in [Map, Set, WeakMap and memory](../14-map-set-weakmap-memory/notes.md).

## Common Mistakes

- **Destructuring `undefined` or `null`:** `const { a } = undefined` throws `TypeError: Cannot destructure property 'a' of 'undefined'`. Give parameters a default: `function f({ a } = {})`.
- **Expecting a default for `null`:** destructuring defaults only replace `undefined`.
- **Destructuring a key that does not exist:** `let { PropFirst } = person` gives `undefined`; rename with `{ name: PropFirst }`.
- **Rest not in last position**, or a trailing comma after it: `SyntaxError`.
- **Assuming spread makes a deep copy:** nested objects are shared; use `structuredClone` for a deep copy.
- **Spreading a plain object into an array or a function call:** `TypeError`, because objects are not iterable.
- **Starting a line with an IIFE after a line without a semicolon.**
- **Loop closures sharing one variable** (`var`, or `let` declared outside the loop): use `let` in the `for` header.
- **Reading an IIFE's local variable through its return value:** only what you `return` is reachable.

## Key Takeaways

- Object destructuring matches by **key** (order does not matter); array destructuring matches by **position**.
- Destructuring supports renaming (`key: newName`), defaults (`= value`, only for `undefined`), skipping (`[a, , b]`), nesting and a rest element (last only).
- Spread `...` expands iterables in calls and array literals, and objects in object literals; the copies are **shallow**.
- Rest `...` collects values into a real array (parameters) or an array/object (destructuring).
- An IIFE runs immediately and creates a private scope; the module pattern uses it to expose a public API over private variables.
- A closure is a function plus the lexical environment where it was created; it keeps outer variables alive after the outer function returns.
- Closures hold **references** to variables, not snapshots of values, which explains the classic loop bug.

## Interview Questions

### Junior (0–1 year)

**Q1. What is destructuring? Give an object and an array example.**
Destructuring unpacks values from arrays or properties from objects into variables in one statement. Objects are matched by key: `const { name, age } = person;`. Arrays are matched by position: `const [first, second] = list;`. Both support defaults, renaming (objects) and a rest element.

**Q2. How do you swap two variables without a temporary variable?**
Use array destructuring: `[x, y] = [y, x];`. The right side builds a temporary array `[7, 4]` first, then the left side assigns its items back by position.

**Q3. What is the difference between the spread operator and rest parameters?**
They use the same `...` syntax but do opposite jobs. Spread expands an iterable or object into individual items, in function calls or array/object literals (`Math.max(...nums)`). Rest collects multiple items into one array or object, in parameter lists or destructuring (`function f(...nums)`). Position tells you which one it is.

**Q4. What is an IIFE and why would you use one?**
An Immediately Invoked Function Expression is a function that is defined and called in one step: `(function () { ... })();`. It creates a private scope so variables do not leak into the global scope, and it is the basis of the module pattern. It is also used to run `async` code with `await` where top-level `await` is not available.

**Q5. What is a closure?**
A closure is a function together with the variables from the scope where it was created. Because of closures, an inner function can still read and update its outer function's variables after the outer function has returned. Example: `function counter() { let c = 0; return () => ++c; }`; each call of the returned function increments the same private `c`.

**Q6. What does this print?**
```js
const [a, , b = 10, ...c] = [1, 2, undefined, 4, 5];
console.log(a, b, c);
```
`1 10 [4, 5]`. `a` takes the first item, the hole skips `2`, `b` gets `undefined` so its default `10` applies, and `c` collects the rest.

### Mid-level (2–4 years)

**Q7. What does this print, and how do you fix it?**
```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
```
It prints `3` three times. `var` is function-scoped, so all three callbacks close over one `i`, which is 3 by the time the timers fire. Fix it by using `let i` in the `for` header (a new binding per iteration), or, pre-ES6, by wrapping the body in an IIFE that receives `i` as a parameter.

**Q8. Is `{ ...obj }` a deep copy? What does this print?**
```js
const a = { user: { name: "Aman" } };
const b = { ...a };
b.user.name = "Harry";
console.log(a.user.name);
```
`"Harry"`. Spread copies only the top level, so `b.user` and `a.user` are the same object. For a deep copy use `structuredClone(a)` (it handles nested objects, arrays, `Date`, `Map` and `Set`, but not functions or DOM nodes), or copy the nested levels explicitly: `{ ...a, user: { ...a.user } }`.

**Q9. Write a `memoize` function. Where is the closure?**
```js
function memoize(fn) {
  const cache = new Map();
  return (n) => {
    if (cache.has(n)) return cache.get(n);
    const value = fn(n);
    cache.set(n, value);
    return value;
  };
}
const square = memoize((n) => n * n);
console.log(square(4), square(4)); // → 16 16 (the second call reads from the cache)
```
The returned arrow function closes over `cache` and `fn`. The cache survives between calls but cannot be reached from outside.

**Q10. Implement `debounce` and explain how closures make it work.**
```js
function debounce(fn, delay) {
  let timerId;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delay);
  };
}
const onResize = debounce(() => console.log("resized"), 300);
window.addEventListener("resize", onResize);
```
Each call cancels the previous timer and starts a new one, so `fn` runs only after calls stop for `delay` ms. `timerId` lives in the closure, which is why every call to the returned function shares and resets the same timer. Throttle, leading/trailing calls and cancellation are covered in [Functional patterns](../26-functional-patterns/notes.md).

**Q11. What does this print?**
```js
const { x = 5, y = 5 } = { x: null, y: undefined };
console.log(x, y);
```
`null 5`. Destructuring defaults apply only when the value is `undefined`; `null` is a real value and is kept. Use `??` afterwards if you want `null` replaced too: `const x2 = x ?? 5`.

**Q12. How would you create private variables before ES modules and `#private` fields existed? How does that compare with ES modules today?**
With the module pattern: an IIFE holds the private variables and returns an object of public functions that close over them. ES modules give the same result more simply: everything in a module file is private unless you `export` it, and each module is evaluated once and shared, like a singleton. The IIFE approach still shows up in legacy code and in bundled output.

**Q13. Can closures cause memory leaks? Give a scenario.**
Yes. A closure keeps every variable it references reachable. For example, an event listener added in a component that references a large data array keeps that array in memory as long as the listener is attached, even after the component is removed from the page. Fix it by removing listeners (or using an `AbortController` signal) and clearing timers in cleanup code, such as React's `useEffect` cleanup function.

### Senior (5+ years)

**Q14. A React dashboard has a live counter that goes from 0 to 1 and then stops updating, and a search box whose debounce "doesn't work". Both are closure bugs. How do you diagnose and fix them, and how do you stop them recurring?**
Every render creates new functions that close over **that render's** props and state. The counter's effect runs once (`[]` dependencies), so its interval callback keeps the `count` from the first render: `setCount(count + 1)` sets `1` again and again. That is a **stale closure**. Fix it with a functional update, `setCount((c) => c + 1)`, which needs no captured state; or list the value in the dependency array so the effect re-subscribes; or read the latest value from a `useRef`. In React 19.2+, `useEffectEvent` lets an effect call logic that always sees current values without re-running the effect.

The debounce bug is the opposite: `const onSearch = debounce(search, 300)` in the component body creates a **new** debounced function, with a new `timerId` closure, on every render. Each keystroke re-renders, gets a fresh timer and nothing is ever cancelled. Create it once (`useMemo`/`useRef`), cancel it on unmount, and keep `search` current through a ref. Recommendation: enable the `react-hooks/exhaustive-deps` lint rule as an error, prefer functional state updates inside timers and subscriptions, and treat "a function created during render that must keep state between renders" as a review red flag.

**Q15. A heap snapshot shows a 50 MB array retained by a tiny callback that never mentions it. How can a closure keep alive a variable it doesn't use?**
Engines such as V8 don't give each closure its own copy of the variables it uses. All closures created in the same scope share **one** context object, which holds every variable that **any** of those closures references. If one inner function uses `bigData` (even a logging helper that has already run), `bigData` lives in the shared context, and any other closure from that scope that is still alive (a timer, a listener, a cached callback) keeps the whole context, and so `bigData`, reachable. You can reproduce it with a `WeakRef` and `node --expose-gc`: after a forced garbage collection the big object survives only when another closure in the same scope used it.

To diagnose: take heap snapshots before and after the action, compare them, select the large object and follow its **Retainers** path; a `context` (`system / Context`) entry in that path points to the closure scope holding it. Fixes: set the big variable to `null` once you are done with it, move the long-lived callback into a scope that doesn't contain the big data, or pass the data in as an argument instead of capturing it. Recommendation: keep long-lived callbacks (listeners, intervals, caches, subscriptions) in small functions that capture only what they need, and add a heap-snapshot check to the debugging runbook for any "memory grows over time" report.

**Q16. You are designing the signature of a shared utility (or a design-system component) that will gain options over time. Positional parameters or a destructured options object? And how should a component forward the props it doesn't use?**
Positional parameters suit one or two required, obvious arguments. Beyond that, call sites become unreadable (`format(x, true, false, 2)`) and every new parameter is tied to an order. An options object destructured in the signature, `function formatPrice(value, { currency = "INR", locale = "en-IN", compact = false } = {})`, is self-documenting, order-free, makes adding an option non-breaking, and the `= {}` default makes the whole object optional. Remember that defaults apply only to `undefined` (a caller passing `null` gets `null`), and consider warning in development about unknown keys, because a typo such as `{ curency: "USD" }` is silently ignored.

For components, `const { variant, size, ...rest } = props` followed by `<button {...rest}>` forwards native attributes (`aria-*`, `data-*`, `id`, event handlers) without listing them, which matters for accessibility and testing. Order decides who wins: props written after `{...rest}` override the caller, props written before it can be overridden. Merge `className`, `style` and event handlers on purpose (combine both, call both) instead of letting one silently replace the other, and don't forward non-DOM props to a DOM element. Recommendation: positional parameters for at most two required arguments and an options object for everything optional; in components, destructure what you consume, forward the rest to one documented root element, and merge the shared props explicitly.

## References

- [GeeksforGeeks: Closure in JavaScript](https://www.geeksforgeeks.org/closure-in-javascript/)
- [LinkedIn: Practical applications of closure in JavaScript](https://www.linkedin.com/pulse/practical-applications-closure-javascript-s-heaven)
- [Stack Overflow: What is a practical use for a closure in JavaScript?](https://stackoverflow.com/questions/2728278/what-is-a-practical-use-for-a-closure-in-javascript)
- [MDN: Destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)
- [MDN: Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)
- [MDN: Rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters)
- [MDN: IIFE (glossary)](https://developer.mozilla.org/en-US/docs/Glossary/IIFE)
- [MDN: Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)
- [MDN: structuredClone()](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)
