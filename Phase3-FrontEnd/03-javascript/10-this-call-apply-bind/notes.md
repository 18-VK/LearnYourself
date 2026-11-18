# this, call(), apply() and bind()

> JavaScript · Topic 10 · Demo: [script.js](script.js) · Run with `node script.js` (no HTML page)

`this` is the most misunderstood keyword in JavaScript because it does not work like `this` in Java or C#. It is not fixed when a function is written: it is decided **each time the function is called**, by how it is called. This note explains the four binding rules and their precedence, arrow functions (which have no `this` of their own), how `this` gets lost in callbacks, class methods vs class-field arrow functions, event handlers, strict vs sloppy mode, `globalThis` and `new.target`, and the three methods that set `this` explicitly: `call()`, `apply()` and `bind()`. Every rule has a runnable example in [script.js](script.js).

## The mental model: `this` is decided at call time

In JavaScript, `this` refers to an object, and **which** object depends on how the code is invoked (called), not where it is written.

`this` refers to the context in which a piece of code, such as a function body, runs. Most typically it is used in object methods, where `this` refers to the object the method is attached to. That lets the same method be reused on different objects.

The value of `this` is decided at call time (**runtime binding**). When a regular function is called as a method, `obj.method()`, `this` is `obj`. When it is called as a standalone function, `func()`, `this` is the global object in sloppy mode and `undefined` in strict mode.

A useful way to think about it: `this` is a **hidden extra argument**. `user.greet()` is roughly `greet.call(user)`, and a plain `greet()` is `greet.call(undefined)`. Every rule below is about what gets passed as that hidden argument.

## The four binding rules

### 1. Default binding: a plain call

```js
function sloppyWhoAmI() { return this; }
function strictWhoAmI() { "use strict"; return this; }

console.log(sloppyWhoAmI() === globalThis); // → true  (sloppy mode: the global object)
console.log(strictWhoAmI());                // → undefined (strict mode)
```

Classes and ES modules are always strict, so in modern code a plain call gives `undefined`, and `this.x` throws `TypeError: Cannot read properties of undefined`. That error is much better than sloppy mode silently reading or writing global variables.

### 2. Implicit binding: a method call

When the call has the form `something.method()`, `this` is **the object directly before the dot at the moment of the call**:

```js
const user = {
  firstName: "Aman",
  greet() { return `Hi, ${this.firstName}`; },
  address: {
    city: "Delhi",
    show() { return this.city; },
  },
};
console.log(user.greet());        // → Hi, Aman
console.log(user.address.show()); // → Delhi  (this is user.address, not user)
```

**Implicit binding is lost** as soon as the function is called without the object in front of it:

```js
const detached = user.greet;     // the method is copied out of the object
console.log(detached());         // → "Hi, undefined" in sloppy mode (TypeError in strict mode)

const { greet } = user;          // destructuring detaches it too
console.log((user.greet)());     // → Hi, Aman   (parentheses alone keep the reference)
console.log((0, user.greet)());  // → Hi, undefined (the comma operator returns a bare function)
```

The `(0, obj.fn)()` form looks odd, but bundlers emit it on purpose to call imported functions without a `this`.

### 3. Explicit binding: `call()`, `apply()` and `bind()`

With the `call()` method, you can write a method once and use it on different objects.

- In JavaScript, all functions are object methods. If a function is not a method of a JavaScript object, it is a function of the global object. (More precisely: in a non-strict browser script, top-level function declarations become properties of `window`, and a plain call `fn()` gets the global object as `this`. In strict mode a plain call gets `this === undefined`, and in Node modules top-level functions are not added to the global object.)
- `call()` is a predefined method available on every function.
- It **invokes** (calls) the function immediately, with an **owner object** passed as the first argument; inside the function, `this` refers to that object.
- With `call()`, an object can use a method belonging to another object.

From [enums-and-call.js](../09-objects-and-enums/enums-and-call.js):

```js
// Object 1
const person = {
  fullName: function () {
    return this.firstName + " " + this.lastName;
  },
};

// Object 2
const person1 = {
  firstName: "John",
  lastName: "Doe",
};

console.log(person.fullName.call(person1)); // → John Doe
```

`person1` has no `fullName` method, but `call` runs `person`'s method with `this` set to `person1`.

The `call()` method can also accept arguments. They are passed one by one after the `this` object:

```js
const objperson = {
  fullName: function (city, country) {
    return this.firstName + " " + this.lastName + "," + city + "," + country;
  },
};

console.log(objperson.fullName.call(person1, "Delhi", "India")); // → John Doe,Delhi,India
```

All three methods set `this` explicitly. The difference is how arguments are passed and whether the function runs now:

| | Runs immediately? | Arguments | Returns |
| --- | --- | --- | --- |
| `fn.call(thisArg, a, b)` | Yes | One by one | The function's result |
| `fn.apply(thisArg, [a, b])` | Yes | As an array | The function's result |
| `fn.bind(thisArg, a, b)` | No | One by one (pre-filled, "partial application") | A **new function** with `this` fixed |

```js
function introduce(city, country) {
  return `${this.name} from ${city}, ${country}`;
}
const aman = { name: "Aman" };

introduce.call(aman, "Delhi", "India");     // → "Aman from Delhi, India"
introduce.apply(aman, ["Delhi", "India"]);  // → "Aman from Delhi, India"
const fromDelhi = introduce.bind(aman, "Delhi");
fromDelhi("India");                         // → "Aman from Delhi, India"
```

Memory trick: **c**all = **c**ommas, **a**pply = **a**rray, **b**ind = **b**e called later. Since ES2015, `fn.call(obj, ...args)` covers almost every `apply` use case.

### 4. `new` binding

Calling a function with `new` creates a brand-new object, links it to the function's `prototype`, and runs the function with `this` set to that object (the full steps are in [Objects, Constructors and Enums](../09-objects-and-enums/notes.md)).

```js
function Player(name) {
  this.name = name;            // this = the new object
}
const virat = new Player("Virat");
console.log(virat.name);       // → Virat
```

### Precedence

When more than one rule could apply, the stronger one wins:

| Priority | Rule | Example | `this` is |
| --- | --- | --- | --- |
| 1 (highest) | `new` | `new BoundPlayer("Faf")` | The new object, even if the function was bound |
| 2 | Explicit (`bind`, then `call`/`apply`) | `team.getName.call(other)` | `other`; a bound function ignores later `call`/`bind` |
| 3 | Implicit | `team.getName()` | `team` |
| 4 (lowest) | Default | `getName()` | `undefined` (strict) or `globalThis` (sloppy) |

```js
const team = { name: "RCB", getName() { return this.name; } };
console.log(team.getName.call({ name: "CSK" }));      // → CSK   (explicit beats implicit)

function getName() { return this.name; }
const boundToA = getName.bind({ name: "A" });
console.log(boundToA.call({ name: "B" }));            // → A     (bind beats call)
console.log(boundToA.bind({ name: "C" })());          // → A     (can't re-bind)

const BoundPlayer = Player.bind({ name: "ignored" });
console.log(new BoundPlayer("Faf").name);             // → Faf   (new beats bind)
```

Arrow functions sit outside this table: they never get their own `this`, so none of the four rules applies to them.

## Cheat sheet: `this` in different contexts

| How the code runs | Value of `this` |
| --- | --- |
| Object method: `obj.method()` | `obj` (the object before the dot) |
| Alone, at the top level of a classic browser script | The global object, `window` |
| Alone, at the top level of a Node.js CommonJS file | `module.exports` (an empty `{}`), **not** the `global` object |
| Alone, at the top level of an ES module | `undefined` |
| Plain function call `f()`, sloppy mode | The global object (`window` in browsers, `globalThis` / `global` in Node.js) |
| Plain function call `f()`, strict mode | `undefined` |
| Event listener written as a regular function | The element the listener is attached to (same as `event.currentTarget`) |
| Constructor called with `new` | The newly created object |
| `f.call(obj)`, `f.apply(obj)`, `f.bind(obj)` | `obj` (set explicitly) |
| Static class method `Cls.create()` | The class itself (so `new this()` creates the right subclass) |
| Arrow function | No own `this`; uses `this` of the surrounding code |

## Arrow functions: lexical `this`

An arrow function has no `this` of its own. It uses the `this` of the code around it at the moment it is **created**, exactly like it uses any other outer variable. That makes arrows wrong as methods and perfect as callbacks inside methods.

| | Regular function | Arrow function |
| --- | --- | --- |
| Own `this` | Yes, set by how it is called | No, uses `this` of the enclosing scope (lexical) |
| Good as object method | Yes | No (`this` will not be the object) |
| Good as callback inside a method | Needs `bind` or `that = this` | Yes, this is what arrows are for |
| Can be used with `new` | Yes | No (`TypeError`) |
| `call`/`apply`/`bind` change `this` | Yes | No (ignored) |
| Own `arguments` / `prototype` | Yes | No |

```js
const counter = {
  count: 0,
  incArrow: () => this.count++,    // `this` is NOT counter
  incRegular() { return ++this.count; },
};
console.log(counter.incArrow());   // → NaN (it touched the outer `this`, not counter)
console.log(counter.incRegular()); // → 1

const team = {
  name: "RCB",
  players: ["Virat", "Faf"],
  list() {
    // the arrow callback borrows `this` from list(), so this.name works
    return this.players.map((p) => `${p} plays for ${this.name}`);
  },
};
console.log(team.list()); // → ["Virat plays for RCB", "Faf plays for RCB"]
```

> **Note:** In the `counter` example, the outer `this` at the top level of a CommonJS file is `module.exports` (`{}`), so `this.count++` turns `undefined` into `NaN` and stores it on `module.exports`. In an ES module the outer `this` is `undefined` and the same line throws.

## Losing `this` in callbacks

Passing a method as a callback passes **only the function**. Whoever calls it later calls it as a plain function, so `this` is lost:

```js
setTimeout(user.greet, 1000);               // this is not `user` → "Hi, undefined"
setTimeout(() => user.greet(), 1000);       // fix 1: call it as a method → "Hi, Aman"
setTimeout(user.greet.bind(user), 1000);    // fix 2: bind `this` permanently → "Hi, Aman"
```

Inside a timer callback `this` is `window` in browsers and the internal `Timeout` object in Node.js; neither is `user`. The same happens with `addEventListener("click", obj.method)`, `promise.then(obj.method)`, `array.map(obj.method)` and passing `onClick={this.handleClick}` in a React class component.

A regular function nested inside a method has the same problem, because it is called as a plain function:

```js
const report = {
  title: "Q3",
  items: ["sales", "costs"],
  print() {
    this.items.forEach(function (item) {
      console.log(this.title, item);   // ❌ `this` is undefined/globalThis, not report
    });
    this.items.forEach((item) => console.log(this.title, item));        // ✅ arrow
    this.items.forEach(function (item) { console.log(this.title, item); }, this); // ✅ thisArg
  },
};
```

Most array methods (`forEach`, `map`, `filter`, `some`, `every`, `find`) accept a `thisArg` as their last argument. The old pattern `const self = this;` does the same job and is still seen in legacy code.

## Class methods and class-field arrow functions

Class bodies are always strict, so a detached class method gets `this === undefined` and fails loudly:

```js
class Button {
  label = "Save";
  handleArrow = () => this.label;      // class field: created per instance, `this` captured
  handleMethod() { return this.label; } // prototype method: shared, `this` depends on the call
}
const btn = new Button();
const { handleArrow, handleMethod } = btn;
console.log(handleArrow());   // → Save
handleMethod();               // TypeError: Cannot read properties of undefined (reading 'label')
```

| | Prototype method + `bind` in constructor | Class-field arrow function | Arrow wrapper at the call site |
| --- | --- | --- | --- |
| Where it lives | Method on the prototype, bound copy on the instance | Only on the instance | Nothing stored |
| Memory | One shared method + one bound function per instance | One function per instance | A new function per render/call |
| Can a subclass override and call `super.method()`? | Yes | No (fields are not on the prototype) | Yes |
| Can tests spy on `Cls.prototype.method`? | Yes | No | Yes |
| Typical use | Older React class components | Event handlers in classes | Occasional callbacks |

In a **static** method `this` is the class, which is useful for factories that respect subclasses: `static create() { return new this(); }` returns a `User` when called as `User.create()`.

## Event handlers

With a regular function listener, `this` is the element **the listener is attached to**, the same as `event.currentTarget`:

```js
list.addEventListener("click", function (event) {
  console.log(this === event.currentTarget); // → true: the <ul>
  console.log(event.target);                 // → the <li> that was actually clicked
});
list.addEventListener("click", (event) => {
  console.log(event.currentTarget);          // arrow: `this` is the outer scope, so use currentTarget
});
```

> **Note:** In an event listener, `this` is the element **the listener is attached to**, which is not always the element that was clicked. With event bubbling, the clicked element is `event.target`, and the element running the handler is `event.currentTarget` (= `this`). See [Events and delegation](../24-events-and-delegation/notes.md).

Two more details:

- You can pass an **object** with a `handleEvent` method instead of a function: `el.addEventListener("click", controller)`. The browser calls `controller.handleEvent(event)` with `this === controller`, so no `bind` is needed.
- `bind` returns a **new** function every time, so `el.removeEventListener("click", this.onClick.bind(this))` removes nothing. Store the bound function once (`this.onClick = this.onClick.bind(this)`), or pass `{ signal }` from an `AbortController` and call `abort()` to remove the listener.

## Strict vs sloppy mode, and `globalThis`

Strict mode (turned on by `"use strict"`, and always on in classes and ES modules) changes how the `this` argument is treated. Strict mode itself is covered in [How JavaScript runs](../01-how-js-runs/notes.md).

| Call | Sloppy mode | Strict mode |
| --- | --- | --- |
| `f()` | `globalThis` | `undefined` |
| `f.call(null)` / `f.call(undefined)` | `globalThis` | `null` / `undefined` |
| `f.call(5)` | A `Number` wrapper object (`typeof this` is `"object"`) | `5` (`typeof this` is `"number"`) |

**`globalThis`** (ES2020) is the standard name for the global object everywhere: `window` in browser pages, `self` in workers, `global` in Node.js. Before it, cross-environment code needed checks such as `typeof window !== "undefined" ? window : global`. Use `globalThis` when you genuinely need the global object; never rely on `this` to reach it, because `this` at the top level is `module.exports` in CommonJS and `undefined` in ES modules.

## `new.target`

Inside a function or constructor, `new.target` is the function that `new` was called on, or `undefined` for a plain call. Arrow functions don't have their own; they see the enclosing function's.

```js
function Shape() {
  if (new.target === Shape) throw new TypeError("Shape is abstract"); // abstract base
  this.kind = new.target.name;
}
// new Shape();          // TypeError: Shape is abstract

function Probe() {
  console.log(new.target === undefined ? "plain call" : new.target.name);
}
Probe();      // → plain call
new Probe();  // → Probe
```

Uses: guarding a constructor that was called without `new` (`if (!new.target) return new Person(name)`, shown in [Objects, Constructors and Enums](../09-objects-and-enums/notes.md)), abstract base classes, and in a class constructor `new.target` is the **subclass** being constructed, which lets a base class read static configuration from it.

## Borrowing methods

Explicit binding lets one object use another object's method without copying it:

```js
// 1. Borrowing a method
const numbers = [1, 5, 3];
console.log(Math.max.apply(null, numbers)); // → 5   (modern: Math.max(...numbers))

// 2. Converting the array-like arguments object to an array
function argsToArray() {
  return Array.prototype.slice.call(arguments); // modern: Array.from(arguments) or rest params
}
console.log(argsToArray(1, 2)); // → [ 1, 2 ]

// 3. Array methods on strings, NodeLists and other array-likes
console.log(Array.prototype.map.call("abc", (c) => c.toUpperCase())); // → [ 'A', 'B', 'C' ]

// 4. Reliable type checks and safe own-property checks
console.log(Object.prototype.toString.call(null)); // → [object Null]
const dict = Object.create(null);                   // has no hasOwnProperty method
dict.key = 1;
console.log(Object.prototype.hasOwnProperty.call(dict, "key")); // → true (modern: Object.hasOwn)

// 5. Fixing a lost `this` with bind
const clicks = {
  label: "clicks",
  getLabel() { return this.label; },
};
const fixed = clicks.getLabel.bind(clicks);
console.log(fixed());                        // → clicks
```

Many of these have modern replacements (spread, `Array.from`, rest parameters, `Object.hasOwn`), but you will still meet them in libraries and interviews.

## Common Mistakes

- **Passing a method as a callback** (`setTimeout(obj.method, 100)`, `addEventListener("click", obj.method)`, `promise.then(obj.method)`) and losing `this`. Use an arrow wrapper or `bind`.
- **Writing object methods as arrow functions.** An arrow method's `this` is the outer scope, never the object.
- **Using a regular `function` callback inside a method** and expecting it to see the method's `this`. Use an arrow function or the `thisArg` parameter.
- **Confusing `call`/`apply` with `bind`.** `bind` does not run the function; it returns a new one.
- **Expecting `call`/`apply`/`bind` to change `this` of an arrow function.** Arrow functions ignore the `this` argument.
- **Trying to re-bind a bound function.** `fn.bind(a).bind(b)` still uses `a`.
- **Removing a listener with a fresh `bind`.** `removeEventListener("click", this.onClick.bind(this))` removes nothing; keep a reference or use an `AbortController` signal.
- **Assuming top-level `this` is the global object.** It is `module.exports` in a CommonJS file and `undefined` in an ES module; use `globalThis`.
- **Writing wrappers (debounce, logging, memoise) with arrow functions** or calling `fn(...args)` instead of `fn.apply(this, args)`, which drops the caller's `this`.

## Key Takeaways

- `this` is decided by **how a function is called**, not where it is written: think of it as a hidden argument.
- Four rules, in order of precedence: `new` > explicit (`bind`, `call`, `apply`) > implicit (`obj.method()`) > default (`undefined` in strict mode, `globalThis` in sloppy mode).
- `call` and `apply` run the function now (arguments one by one vs as an array); `bind` returns a new function with `this` and leading arguments fixed, and it can't be re-bound.
- Arrow functions have no own `this`: use them for callbacks inside methods, never as methods.
- Detaching a method (assigning it, destructuring it, passing it as a callback) loses implicit binding; class code then throws because classes are strict.
- In regular event listeners `this === event.currentTarget`; with arrows, read `event.currentTarget`.
- Use `globalThis` for the global object and `new.target` to detect `new` calls.

## Interview Questions

### Junior (0–1 year)

**Q1. What does `this` refer to inside a function?**
It depends on how the function is called. As a method (`obj.fn()`) it is `obj`; as a plain call it is the global object in sloppy mode and `undefined` in strict mode; with `new` it is the new object; with `call`/`apply`/`bind` it is whatever you pass. Arrow functions have no own `this` and use the enclosing scope's `this`.

**Q2. What does the `call()` method do?**
`call()` invokes a function immediately and lets you choose what `this` refers to inside it: `fn.call(obj, arg1, arg2)`. It allows an object to use a method that belongs to another object, for example `person.fullName.call(person1)` runs `fullName` with `this` set to `person1`.

**Q3. What is the difference between `call`, `apply` and `bind`?**
`call` and `apply` both run the function immediately with the given `this`; `call` takes the arguments one by one and `apply` takes them as an array. `bind` does not run the function; it returns a new function whose `this` (and optionally some leading arguments) is permanently fixed, to be called later, for example as an event handler.

**Q4. Why shouldn't you write object methods as arrow functions?**
An arrow function takes `this` from the scope where it is created, which for an object literal is the code around the object (the module, the global scope or an outer function), not the object itself. So `const o = { n: 1, get: () => this.n }` returns `undefined` (or throws in an ES module). Use method shorthand, `get() { return this.n; }`, for methods, and arrows for callbacks inside methods.

**Q5. What is `this` at the top level of a browser script, a Node.js CommonJS file and an ES module?**
In a classic browser script it is `window`. In a CommonJS file it is `module.exports`, an empty object at first, not Node's `global`. In an ES module (browser or Node) it is `undefined`, because modules are strict and have no receiver. That is why you should never use top-level `this` to reach the global object.

**Q6. What is `globalThis` and why was it added?**
`globalThis` (ES2020) is a standard way to access the global object in every environment: it is `window` in a browser page, `self` in a web worker and `global` in Node.js. Before it, code that ran in several environments needed feature checks to find the global object. Use it for things like feature detection (`"fetch" in globalThis`) instead of relying on `this` or `window`.

### Mid-level (2–4 years)

**Q7. What does this code print?**
```js
const obj = {
  title: "OOP",
  regular() { return this.title; },
  arrow: () => this === obj,
  nested() {
    const inner = () => this.title;
    return inner();
  },
};
console.log(obj.regular());
console.log(obj.arrow());
console.log(obj.nested());
const fn = obj.regular;
console.log(fn());
```
`"OOP"`, `false`, `"OOP"`, then `undefined` in sloppy mode (a `TypeError` in strict mode). `regular` is called as a method. The arrow `arrow` captures the outer `this` (the global object, `module.exports` or `undefined`, never `obj`). `inner` is an arrow inside a method, so it borrows `nested`'s `this`, which is `obj`. `fn()` is a plain call, so `this` is not `obj`.

**Q8. A teammate writes `setTimeout(user.greet, 1000)` and it prints "Hi, undefined". Why, and how do you fix it?**
`setTimeout` receives only the function, not the object, so `greet` later runs as a plain function call and `this` is not `user` (in a browser it is `window`; in Node it is the internal `Timeout` object). Fix it with an arrow wrapper, `setTimeout(() => user.greet(), 1000)`, or with `setTimeout(user.greet.bind(user), 1000)`. The same bug appears with event listeners, promise callbacks, array callbacks and React class component handlers.

**Q9. What does this print, and can you re-bind a bound function?**

```js
function show() { return this.name; }
const a = show.bind({ name: "A" });
const b = a.bind({ name: "B" });
console.log(b());
```

`A`. A bound function's `this` is fixed permanently; binding it again (or using `call`/`apply` on it) cannot change `this`, although extra arguments can still be pre-filled. The only exception is calling a bound function with `new`, which ignores the bound `this` and creates a new object.

**Q10. Can you change `this` in an arrow function with `call()`?**
No. Arrow functions don't have their own `this`; they use the `this` of the scope in which they were defined. `arrowFn.call(obj)` still runs the function and passes the remaining arguments, but the `this` argument is ignored. If a function needs a dynamic `this`, write it as a regular function or method.

**Q11. In an event listener, what is the difference between `this`, `event.target` and `event.currentTarget`?**
With a regular function listener, `this` equals `event.currentTarget`: the element the listener is attached to. `event.target` is the element where the event started, which can be a child because of bubbling. With an arrow function listener, `this` is the outer scope's `this`, so use `event.currentTarget` instead. In event delegation you attach one listener to a parent and inspect `event.target` (usually with `closest()`).

**Q12. List the `this` binding rules in order of precedence, and predict the output.**

```js
function Player(name) { this.name = name; }
const Bound = Player.bind({ name: "ignored" });
const team = { name: "RCB", get() { return this.name; } };
console.log(new Bound("Faf").name, team.get.call({ name: "CSK" }));
```

`Faf CSK`. The order is: `new` binding (a new object), explicit binding (a `bind` result first, then `call`/`apply`), implicit binding (`obj.method()`), default binding (`undefined` in strict mode, `globalThis` in sloppy mode). `new` overrides the bound `this`, and `call` overrides the implicit `team`. Arrow functions are outside the rules: their `this` is lexical and none of the four can change it.

**Q13. Implement a simplified `bind`.**

```js
Function.prototype.myBind = function (thisArg, ...preset) {
  const fn = this;
  if (typeof fn !== "function") throw new TypeError("myBind must be called on a function");
  return function bound(...args) {
    if (new.target) return new fn(...preset, ...args); // `new` wins over the bound this
    return fn.apply(thisArg, [...preset, ...args]);
  };
};

function introduce(city, country) { return `${this.name} from ${city}, ${country}`; }
const fromDelhi = introduce.myBind({ name: "Aman" }, "Delhi");
console.log(fromDelhi("India")); // → Aman from Delhi, India
```

The points interviewers check: capture the original function (`this` inside `myBind`), merge pre-filled and call-time arguments, use `apply` to set `this`, and return a regular function (not an arrow) so `new.target` works. The real `bind` also sets `name` to `"bound introduce"` and `length`, and makes `instanceof` work with the bound function; polyfill details are in [Polyfills](../../06-interview/03-polyfills/notes.md).

### Senior (5+ years)

**Q14. You are writing UI classes for a shared component library. Should event handlers be prototype methods bound in the constructor or class-field arrow functions?**
Class-field arrows (`onClick = () => {...}`) are the simplest to use correctly: they can be passed anywhere without losing `this`. But each instance gets its own function, the handler is not on the prototype, so subclasses can't override it and call `super.onClick()`, and tests can't spy on `Component.prototype.onClick`. Prototype methods bound in the constructor keep one shared implementation that can be overridden and mocked, at the cost of boilerplate and a bound copy per instance anyway.

Recommendation: for a library meant to be extended, keep behaviour in prototype methods and bind only the handlers that are passed as callbacks (in the constructor, or by listening with a `handleEvent` object). For leaf components that are never subclassed, class-field arrows are fine. Whatever you choose, make it one documented convention and enforce it with lint rules (`@typescript-eslint/unbound-method` flags passing unbound methods around).

**Q15. After moving a legacy codebase from script tags to ES modules, several features throw `TypeError: Cannot read properties of undefined`. What is the likely cause, and how do you find and prevent it?**
ES modules are always strict. Legacy code that called functions plainly and relied on sloppy mode giving `this === window` (for example `function init() { this.config = ... }` or helpers reading `this.jQuery`) now gets `this === undefined`. Top-level `this` also changed from `window` to `undefined`. The failures are good news: the old code was silently writing globals.

To find them, search for `this` outside methods and classes, and turn on checks that catch it before runtime: TypeScript's `noImplicitThis` (part of `strict`), ESLint's `no-invalid-this`, and `@typescript-eslint/unbound-method`. Fix each case by passing the object explicitly, turning the function into a method, or using `globalThis` where the global object is really meant. Recommendation: treat the migration as the moment to remove reliance on default binding entirely, with the lint rules on in CI so it doesn't come back.

**Q16. You are designing a utility API that accepts callbacks (a test runner, a plugin system, an event emitter). Should the callback receive its context through `this` or through explicit arguments?**
Passing context through `this` has a long history (jQuery handlers get the element as `this`, Mocha tests call `this.timeout()`, Vue 2's Options API uses `this` for the component), but it fails the moment a user writes an arrow function, it's invisible in the callback's signature, it's awkward to type in TypeScript (a `this:` parameter), and wrappers must remember to forward it with `apply`.

Recommendation: pass context as an explicit argument (`(ctx) => ctx.timeout(5000)`, `(event, element) => ...`). It works with arrows and regular functions alike, shows up in autocomplete and types, and survives composition. If you must support an existing `this`-based API, also pass the same object as an argument so users can migrate.

**Q17. A shared `debounce` helper works in plain functions but breaks when used for object or class methods. What is the bug, and what rules would you set for writing wrappers?**
The wrapper usually looks like `return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }`. The outer arrow has no `this` of its own, and `fn(...args)` is a plain call, so when it is used as `obj.save = debounce(obj.save, 300)` and called as `obj.save()`, `this` inside `save` is `undefined`. The fix is to make the returned function a regular `function`, capture its `this`, and forward it: `const ctx = this; ... fn.apply(ctx, args)`.

Rules for any higher-order wrapper (debounce, throttle, memoise, retry, logging decorators): return a regular function; forward both `this` and all arguments with `fn.apply(this, args)`; return the original result (or promise); and preserve `name`/`length` when the API depends on them. Recommendation: put these rules in one well-tested internal utilities package with tests that call the wrapped function as a method, instead of letting each team write its own; see [Functional patterns](../26-functional-patterns/notes.md) for debounce and throttle.

## References

- [MDN – this](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)
- [MDN – Function.prototype.call()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call)
- [MDN – Function.prototype.apply()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply)
- [MDN – Function.prototype.bind()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)
- [MDN – Arrow function expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
- [MDN – globalThis](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis)
- [MDN – new.target](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target)
- [MDN – Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)
- [MDN – EventTarget.addEventListener()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
