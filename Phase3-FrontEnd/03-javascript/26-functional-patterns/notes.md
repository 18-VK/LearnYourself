# Functional Patterns in JavaScript

> JavaScript · Topic 26 · Demo: [script.js](script.js) · Run with `node script.js` (no HTML page)

JavaScript is not a purely functional language, but functions are values, and that makes a small set of functional patterns part of everyday front-end work: pure functions, immutable updates, higher-order functions, currying and partial application, `compose`/`pipe`, and the "function decorators" `debounce`, `throttle`, `memoize` and `once`. This note explains each pattern, gives production-quality implementations, shows where the patterns break down (unbounded caches, unreadable point-free code), and connects them to the places interviews probe: React render purity, reducers, selectors and event handlers. The closure mechanics behind all of them are in [Closures](../12-closures-destructuring-spread/notes.md#closures).

## Pure functions and side effects

A **pure function** has two properties:

1. Given the same arguments, it always returns the same result.
2. It has no **observable side effects**: it does not change anything outside itself.

Side effects include mutating an argument or outer variable (`arr.sort()`, `total += n`), reading state that can change (`Date.now()`, `Math.random()`, globals, `localStorage`), I/O (`fetch`, `console.log`), touching the DOM, and scheduling work (`setTimeout`).

```js
const addTax = (price, rate) => price * (1 + rate); // pure
let runningTotal = 0;
const addToTotal = (n) => (runningTotal += n);       // impure: changes outer state

addTax(100, 0.2); addTax(100, 0.2);      // → 120 120 (same input, same output)
addToTotal(5); addToTotal(5);            // → 5 10   (same input, different output)

const scores = [30, 10, 20];
scores.toSorted((a, b) => a - b);        // → [10, 20, 30], scores unchanged (pure)
scores.sort((a, b) => a - b);            // → sorts scores itself (side effect on the argument)
```

Why it matters in practice: pure functions are **testable** without mocks, **cacheable** (only a pure function can be memoized safely), **safe to call again** (React may render twice, a retry may repeat a call), and **easy to reason about**, because everything they depend on is in the parameter list.

Programs need side effects (that is how anything appears on screen), so the goal is not to remove them but to **push them to the edges**: a "functional core" of pure functions that compute what should happen, and a thin "imperative shell" (event handlers, effects, API clients) that does it.

## Immutability

Immutability means never changing a value after it is created; to "change" it, you create a new value. In front-end code it matters mostly for **change detection**: if updates always create new objects, then `prev !== next` is a complete and cheap test for "something changed". React's `memo`, `useMemo` dependencies and memoized selectors all rely on that.

### Shallow vs deep

| Tool | What it copies or protects | Depth |
|---|---|---|
| `{ ...obj }`, `[...arr]`, `Object.assign`, `slice()` | Copies the top level; nested objects are shared | Shallow |
| `structuredClone(obj)` | Copies everything (not functions or DOM nodes) | Deep |
| `Object.freeze(obj)` | Blocks adding, changing and deleting properties | Shallow |
| `const` | Blocks reassigning the variable, not changing the object | Not about the value at all |

```js
const config = Object.freeze({ retries: 3, api: { url: "/v1" } });
config.retries = 10;     // silently ignored in sloppy mode, TypeError in strict mode
config.api.url = "/v2";  // works: the nested object is not frozen
console.log(config.retries, config.api.url); // → 3 "/v2"
```

ES modules and class bodies are always strict, so in modern code writing to a frozen object throws. `freeze` vs `seal`, and a deep-freeze helper, are in [Objects and enums](../09-objects-and-enums/notes.md); copying in general is in [Pass by value and copying](../06-pass-by-value-and-copying/notes.md#how-to-avoid-accidental-mutation).

### Structural sharing

An immutable update copies only the **path** from the root to the changed value and reuses every untouched branch by reference:

```js
const state = {
  user: { name: "Asha" },
  todos: [{ id: 1, done: false }, { id: 2, done: false }],
};

const next = {
  ...state,                                                          // new root
  todos: state.todos.map((t) => (t.id === 2 ? { ...t, done: true } : t)), // new array, one new item
};

next.user === state.user;         // → true  (shared: nothing changed there)
next.todos === state.todos;       // → false (copied: on the changed path)
next.todos[0] === state.todos[0]; // → true  (shared)
next.todos[1] === state.todos[1]; // → false (replaced)
state.todos[1].done;              // → false (the old version is intact)
```

The cost of an update is proportional to the depth of the change, not the size of the state, and every unchanged branch keeps its identity, so components that receive `next.user` can skip re-rendering. Deep paths get verbose (`{ ...s, a: { ...s.a, b: { ...s.a.b, c: 1 } } }`); libraries like Immer let you write mutating code against a draft and produce a structurally shared result.

### Non-mutating array methods

| Mutates | Non-mutating equivalent (ES2023, all modern browsers and Node.js 20+) |
|---|---|
| `arr.sort(fn)` | `arr.toSorted(fn)` |
| `arr.reverse()` | `arr.toReversed()` |
| `arr.splice(i, n, ...items)` | `arr.toSpliced(i, n, ...items)` |
| `arr[i] = v` | `arr.with(i, v)` |
| `arr.push(x)` | `[...arr, x]` or `arr.concat(x)` |

For `nums = [3, 1, 2]`, the demo prints `nums.with(0, 9)` → `[9, 1, 2]` and `nums.toSpliced(1, 1)` → `[3, 2]`, and `nums` is unchanged afterwards. The full table is in [Arrays](../08-arrays/notes.md#mutating-vs-non-mutating-methods).

## First-class and higher-order functions

Functions in JavaScript are **first-class values**: you can store them in variables, pass them as arguments and return them from other functions. A **higher-order function** (HOF) does one of the last two: `map`, `filter`, `addEventListener` and `setTimeout` take functions; factories return them. The basics are in [Functions](../05-functions/notes.md#higher-order-functions).

Every pattern below is a HOF that takes a function and returns an enhanced one with the same call signature, a "decorator":

```js
const withLogging = (fn, name = fn.name) => (...args) => {
  const result = fn(...args);
  console.log(`${name}(${args.join(", ")}) → ${result}`);
  return result;
};
const loggedAdd = withLogging((a, b) => a + b, "add");
loggedAdd(2, 3); // logs → add(2, 3) → 5
```

A good decorator forwards **all** arguments, preserves `this` (use a regular `function` and `fn.apply(this, args)` when it may wrap methods) and returns the wrapped function's result unless its purpose is to delay the call.

## Currying vs partial application

| | Currying | Partial application |
|---|---|---|
| What it does | Turns `f(a, b, c)` into `f(a)(b)(c)` | Fixes some arguments now, returns a function for the rest |
| Calls needed | One per argument (auto-curry allows groups) | One more call with all remaining arguments |
| Built in | No | `fn.bind(thisArg, ...presetArgs)` |
| Typical use | Building specialised functions step by step, point-free pipelines | Pre-configuring callbacks and handlers |

```js
function curry(fn, arity = fn.length) {
  return function curried(...args) {
    if (args.length >= arity) return fn.apply(this, args);       // enough arguments: call it
    return (...more) => curried.apply(this, [...args, ...more]); // otherwise collect more
  };
}

const volume = (l, w, h) => l * w * h;
const cVolume = curry(volume);
cVolume(2)(3)(4); cVolume(2, 3)(4); cVolume(2)(3, 4); // → 24 24 24

function partial(fn, ...preset) {
  return (...later) => fn(...preset, ...later);
}
const greet = (greeting, punctuation, name) => `${greeting}, ${name}${punctuation}`;
partial(greet, "Hello", "!")("Riya");   // → "Hello, Riya!"
greet.bind(null, "Hi", ".")("Sam");     // → "Hi, Sam."
```

`curry` decides when to call the original function by comparing with `fn.length`, which counts only parameters **before the first default or rest parameter**: `((a, b = 2) => 0).length` is `1` and `((...xs) => 0).length` is `0`, so curry would call them too early. For such functions pass the arity explicitly (`curry(fn, 3)`). A practical use of both techniques is configuring callbacks: `items.filter(hasStatus("done"))`, where `const hasStatus = (status) => (item) => item.status === status`.

## Compose and pipe

`compose` and `pipe` combine single-argument functions into one function. They differ only in order:

```js
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x); // right to left
const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);         // left to right

const add1 = (n) => n + 1;
const double = (n) => n * 2;
compose(add1, double)(5); // → 11  add1(double(5)), like math notation f(g(x))
pipe(add1, double)(5);    // → 12  double(add1(5)), reads in execution order
```

`pipe` is usually easier to read because the steps appear in the order they run; the demo builds `slugify = pipe(trim, lowercase, replace non-alphanumerics with "-", strip edge dashes)`, so `slugify("  Hello World, JS!  ")` → `"hello-world-js"`. When some steps return promises, chain with `.then` instead of calling directly (see Q9).

> **Note:** A pipeline operator (`value |> fn(%)`) has been a TC39 proposal for years and is still not part of the language. Use a `pipe` helper or plain intermediate variables.

## Debounce and throttle

Both limit how often a function runs when it is triggered by a burst of events (`input`, `scroll`, `resize`, `mousemove`), but they answer different questions:

- **Debounce:** "run once the burst is over". Every call restarts a timer; the function runs only after `wait` ms without calls (trailing), or once at the start of a burst (leading).
- **Throttle:** "run at most once every `wait` ms while the burst continues". The user gets regular updates; a trailing call makes sure the final state is processed.

The demo feeds the same input stream ("promise" typed one character every 100 ms) into a trailing debounce (250 ms), a leading-only debounce (250 ms) and a throttle (350 ms):

```text
t=  0ms input "p"        → debounce (leading) "p", throttle "p"
t=100ms input "pr"
t=200ms input "pro"
t=300ms input "prom"     → throttle "prom"     (at ~350 ms, end of the first window)
t=400ms input "promi"
t=500ms input "promis"
t=600ms input "promise"  → throttle "promise"  (at ~700 ms, trailing call)
                         → debounce (trailing) "promise" (at ~850 ms, 250 ms after the last input)
7 input events → debounce: 1, leading debounce: 1, throttle: 3
```

### Choosing

| Situation | Choice | Why |
|---|---|---|
| Search as you type, form validation | Debounce, trailing (~300 ms) | Only the final value matters |
| Autosave a draft | Debounce plus `flush()` on `pagehide` (or a `maxWait`) | Save after a pause, but never lose the last edit |
| Prevent double submit | Leading debounce, or disable the button while the request runs | The first click counts, the rest are noise |
| Expensive recalculation on `resize` | Debounce | Only the final size matters |
| Scroll progress bar, drag position | Throttle, or `requestAnimationFrame` | The user needs continuous feedback |
| Analytics on `mousemove` | Throttle (e.g. 1 s) | Sample regularly, not on every event |
| Infinite scroll, lazy loading | Neither: `IntersectionObserver` | The browser reports visibility without scroll listeners |

### Debounce with leading/trailing, `cancel` and `flush`

```js
function debounce(fn, wait, { leading = false, trailing = true } = {}) {
  let timerId = null;
  let lastArgs, lastThis;

  function invoke() {
    const args = lastArgs, ctx = lastThis;
    lastArgs = lastThis = undefined;
    fn.apply(ctx, args);
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    const startsBurst = timerId === null;
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      if (trailing && lastArgs) invoke(); // skipped if only the leading call happened
      lastArgs = lastThis = undefined;
    }, wait);
    if (leading && startsBurst) invoke();
  }

  // cancel: drop the pending call (e.g. on unmount); flush: run it now (e.g. before the page closes)
  debounced.cancel = () => { clearTimeout(timerId); timerId = null; lastArgs = lastThis = undefined; };
  debounced.flush = () => {
    if (timerId === null) return;
    clearTimeout(timerId);
    timerId = null;
    if (lastArgs) invoke();
  };
  return debounced;
}
```

With `leading: true, trailing: true`, a single call runs once (leading) and a burst runs twice (start and end). The basic version and why the closure makes it work are in the [Closures interview questions](../12-closures-destructuring-spread/notes.md#interview-questions); how it is wired to a search box is in [Events](../24-events-and-delegation/notes.md#debounce-and-throttle).

### Throttle with leading/trailing and `cancel`

```js
function throttle(fn, wait, { leading = true, trailing = true } = {}) {
  let timerId = null;
  let lastRun = 0;
  let lastArgs, lastThis;

  function invoke() {
    lastRun = Date.now();
    const args = lastArgs, ctx = lastThis;
    lastArgs = lastThis = undefined;
    fn.apply(ctx, args);
  }

  function throttled(...args) {
    const now = Date.now();
    if (!lastRun && !leading) lastRun = now;  // start the window without running
    lastArgs = args;                          // always keep the latest arguments
    lastThis = this;
    const remaining = wait - (now - lastRun);
    if (remaining <= 0 || remaining > wait) { // window over (or system clock moved back)
      clearTimeout(timerId);
      timerId = null;
      invoke();
    } else if (timerId === null && trailing) {
      timerId = setTimeout(() => {            // one trailing run at the end of the window
        timerId = null;
        if (lastArgs) invoke();
        if (!leading) lastRun = 0;
      }, remaining);
    }
  }

  throttled.cancel = () => { clearTimeout(timerId); timerId = null; lastRun = 0; lastArgs = lastThis = undefined; };
  return throttled;
}
```

For purely visual updates, a `requestAnimationFrame` throttle (shown in [Events](../24-events-and-delegation/notes.md#debounce-and-throttle)) is better than a fixed interval: it runs at most once per frame and never between frames. Lodash implements `throttle` as a `debounce` with `maxWait` equal to `wait`, which shows how close the two ideas are.

> **Note:** A debounced or throttled function only works if every call goes to the **same** instance, because the timer lives in its closure. Creating it inside a React component body without `useMemo`/`useRef`, or inside the event handler itself, creates a new timer each time and nothing is debounced.

## Memoization

Memoization caches a function's results by its arguments. It is only correct for **pure** functions, and only worth it when the function is expensive and called repeatedly with the same inputs. The basic single-argument version is in the [Closures interview questions](../12-closures-destructuring-spread/notes.md#interview-questions); production use raises three questions: what the cache key is, how big the cache may grow, and how async results are cached.

### Cache keys

| Arguments | Key strategy | Watch out for |
|---|---|---|
| One primitive | The value itself in a `Map` | Nothing; this is the easy case |
| Several primitives | A key function, e.g. `` (x, y) => `${x},${y}` `` | Separator collisions if values can contain it |
| Objects, compared by identity | `WeakMap` keyed by the object | A new object with equal content is a cache miss |
| Objects, compared by content | A key built from the fields that matter | Building the key can cost more than the work |

`JSON.stringify` looks like a universal key but is a trap:

```js
JSON.stringify({ a: 1, b: 2 }) === JSON.stringify({ b: 2, a: 1 }); // → false (key order)
JSON.stringify({ when: undefined, fn() {} });                      // → "{}" (values dropped)
```

It also turns `Date`s into strings and `Map`/`Set` into `{}`, throws on circular references and `BigInt`, and walks the whole object on every call.

### Bounding the cache

A module-level cache that is never cleared grows for as long as the page is open. A `Map` remembers insertion order, which makes a least-recently-used (LRU) limit a few lines:

```js
function memoize(fn, { key = (first) => first, maxSize = Infinity } = {}) {
  const cache = new Map();
  return function (...args) {
    const k = key(...args);
    if (cache.has(k)) {
      const value = cache.get(k);
      cache.delete(k);       // re-insert: now the most recently used
      cache.set(k, value);
      return value;
    }
    const value = fn.apply(this, args);
    cache.set(k, value);
    if (cache.size > maxSize) cache.delete(cache.keys().next().value); // evict the oldest
    return value;
  };
}

const fastSquare = memoize(slowSquare, { maxSize: 2 }); // slowSquare counts its calls in the demo
[4, 4, 5, 4, 6, 5].forEach((n) => fastSquare(n));      // real computations → 4 (5 was evicted by 6)
```

When the arguments are objects, a `WeakMap` cache cleans itself up: once nothing else references the object, the entry can be garbage-collected:

```js
function memoizeByObject(fn) {
  const cache = new WeakMap();
  return (obj) => {
    if (!cache.has(obj)) cache.set(obj, fn(obj));
    return cache.get(obj);
  };
}
const cartTotal = memoizeByObject((c) => c.items.reduce((s, i) => s + i.price * i.qty, 0));
const cart = { items: [{ price: 10, qty: 2 }, { price: 5, qty: 1 }] };
cartTotal(cart); cartTotal(cart);  // → 25 25, computed once
cartTotal({ ...cart, items: [...cart.items, { price: 1, qty: 3 }] }); // → 28, new object = new entry
```

This pairs naturally with immutable updates: a changed state is a new object, so identity is a correct and cheap cache key. Weak collections are covered in [Map, Set, WeakMap and memory](../14-map-set-weakmap-memory/notes.md).

The smallest bounded cache is **memoize-one**: remember only the last arguments and result. That is what `useMemo` and memoized selectors do, because in UI code the common case is "same input as last render".

### Async functions

Cache the **promise**, not the resolved value, so concurrent callers share one request, and remove failed entries so an error is not cached forever:

```js
function memoizeAsync(fn) {
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) {
      cache.set(key, fn(key).catch((err) => { cache.delete(key); throw err; }));
    }
    return cache.get(key);
  };
}
// Promise.all([getUser(7), getUser(7)]) → one request; a failed getUser(-1) is retried on the next call
```

Real data caches also need expiry and invalidation, which is why apps use a data-fetching library (TanStack Query, SWR) rather than a hand-written memoizer for server data.

## `once`

`once(fn)` runs `fn` on the first call and returns the same result on every later call: initialising an SDK, registering a service worker, showing a one-time hint.

```js
function once(fn) {
  let done = false;
  let result;
  return function (...args) {
    if (!done) {
      done = true;
      result = fn.apply(this, args);
      fn = null; // release the function and everything its closure holds
    }
    return result;
  };
}
const initAnalytics = once(() => "ready");
initAnalytics(); initAnalytics(); // → "ready" "ready" (the body ran once)
```

For event listeners, `addEventListener(type, handler, { once: true })` does the same job natively. For async initialisation, `once(async () => ...)` returns the same promise to every caller, so concurrent callers wait for one initialisation instead of starting several. A simpler `once` appears in [Closures](../12-closures-destructuring-spread/notes.md#practical-uses-of-closures).

## When point-free style hurts readability

**Point-free** (tacit) style passes functions without naming their arguments: `ids.map(String)` instead of `ids.map((id) => String(id))`. It is concise when the function is unary and well named, and harmful otherwise:

```js
["1", "2", "3"].map(parseInt);               // → [1, NaN, NaN]: map passes (value, index)
["1", "2", "3"].map(Number);                 // → [1, 2, 3]
["1", "2", "3"].map((s) => parseInt(s, 10)); // → [1, 2, 3]: explicit is safer
```

(Why `parseInt` fails here is explained in the [Arrays interview questions](../08-arrays/notes.md#interview-questions).)

Other costs of heavy point-free code:

- The data shape disappears: `pipe(groupBy(prop("team")), map(sumBy(prop("hours"))))` says nothing about what flows through it.
- Stack traces fill with anonymous `curried` and `pipe` frames instead of named functions.
- TypeScript struggles to infer types through generic `compose`/`curry`, and `any` creeps in.
- A callback that later grows a second parameter silently changes behaviour (exactly the `parseInt` bug).

Use point-free for short chains of named, unary functions you control; otherwise write the arrow function or an intermediate variable.

## Where these ideas show up in front-end work

| Area | Pattern | What it means in practice |
|---|---|---|
| React rendering | Pure functions | A component must return the same JSX for the same props, state and context, without side effects. React may render twice (StrictMode does it on purpose in development), pause, discard or replay renders. |
| Reducers (`useReducer`, Redux) | Pure functions plus immutability | `(state, action) => newState`: no API calls, no `Math.random()`, no mutation. Redux Toolkit uses Immer, so "mutating" code inside its reducers is safe. |
| Selectors | Memoization plus structural sharing | Derived data (`selectVisibleTodos`) is recomputed only when its inputs change by reference (`createSelector` in Reselect, `useMemo`). |
| Props and `React.memo` | Immutability | Memoized components skip rendering when props are referentially equal, which only works if updates create new objects on the changed path only. |
| Event handlers | Where side effects belong; debounce, throttle | Handlers and effects are the "imperative shell". High-frequency handlers are debounced or throttled, with a stable instance per component and `cancel()` on unmount. |
| Utilities | Currying, partial application, `once` | `onClick={() => select(id)}` and `hasStatus("done")` are partial application; one-time setup uses `once`. |

## Common Mistakes

- **Memoizing an impure function.** If it reads `Date.now()`, a global or a store, the cache returns stale results.
- **Unbounded module-level caches** in a long-running single-page app: memory grows with every new input. Bound them (LRU, TTL), use a `WeakMap`, or memoize only the last call.
- **`JSON.stringify` as a cache key** for objects: key order and dropped `undefined` values make different inputs collide and equal inputs miss.
- **Creating a new debounced or throttled function on every call or render.** Each instance has its own timer, so nothing is limited.
- **Forgetting `cancel()` on unmount**, so a debounced save or fetch runs after the component or page section is gone.
- **Throttling without a trailing call** for state that must end up correct (scroll position, slider value): the last event is dropped.
- **"Immutable" updates that mutate shared nested data:** `const copy = { ...state }; copy.todos.push(t);` changes `state.todos` too, because spread is shallow.
- **Trusting `Object.freeze` or `const` to make data immutable.** Both are shallow or not about the value at all.
- **Currying functions with default or rest parameters**, where `fn.length` gives the wrong arity.
- **Point-free callbacks with extra parameters**, such as `map(parseInt)`.

## Key Takeaways

- A pure function depends only on its arguments and changes nothing outside; keep the core of your logic pure and push side effects to handlers and effects.
- Immutable updates with structural sharing make "did it change?" a cheap reference comparison, which is what React, `memo` and selectors rely on.
- Currying turns `f(a, b, c)` into `f(a)(b)(c)`; partial application fixes some arguments now (`bind` does it natively); both are about building specialised functions.
- `compose` runs right to left, `pipe` left to right; prefer `pipe` and short, named steps.
- Debounce waits for a pause; throttle runs regularly during the burst. Production versions need leading/trailing options, `cancel`, and for debounce `flush`.
- Memoize only pure, expensive, repeatedly called functions, and decide the cache key and the cache bound up front; cache promises, not values, for async work.
- Decorators (`debounce`, `throttle`, `memoize`, `once`) keep state in a closure, so every caller must share the same instance.

## Interview Questions

### Junior (0–1 year)

**Q1. What is a pure function? Are `Math.random()` and `Date.now()` pure?**
A pure function always returns the same output for the same arguments and has no observable side effects (it does not mutate its arguments or outer variables, do I/O, or touch the DOM). `Math.random()` and `Date.now()` are not pure: they return different values on every call because they read changing state, and any function that calls them becomes impure too. Impure code is necessary, but it should live at the edges (handlers, effects), with the calculations in pure functions.

**Q2. What is a higher-order function? Give built-in and custom examples.**
A function that takes a function as an argument or returns one. Built-in examples: `map`, `filter`, `reduce`, `addEventListener`, `setTimeout`, `Promise.prototype.then`. Custom examples: `debounce`, `throttle`, `memoize` and `once` all take a function and return an enhanced version with the same signature. This is possible because functions are first-class values in JavaScript.

**Q3. What is the difference between debounce and throttle? Which would you use for search-as-you-type, a scroll progress bar, autosaving a draft and a window resize?**
Debounce runs the function once after the events stop for a given time; throttle runs it at most once per interval while the events continue. Search-as-you-type: debounce, because only the final query matters. Scroll progress bar: throttle (or `requestAnimationFrame`), because the user needs continuous feedback. Autosave: debounce, plus `flush()` when the page is hidden or a `maxWait`, so a long typing session still gets saved. Resize: debounce when an expensive recalculation is only needed at the end, throttle when the layout must follow the resize live. The quick test: "do I need the intermediate updates?" Yes: throttle. No: debounce.

**Q4. What is currying? Write a curried `multiply` and use it with `map`.**
Currying transforms a function of several arguments into a chain of functions that each take one argument.
```js
const multiply = (a) => (b) => a * b;
const double = multiply(2);       // a specialised function
[1, 2, 3].map(double);            // → [2, 4, 6]
multiply(3)(4);                   // → 12
```
Fixing the first argument produces a reusable, specialised function, which is the main practical benefit.

**Q5. What is the difference between `compose` and `pipe`? What do these print?**
```js
const add1 = (n) => n + 1;
const double = (n) => n * 2;
console.log(compose(add1, double)(5));
console.log(pipe(add1, double)(5));
```
`11`, then `12`. Both combine single-argument functions into one. `compose` applies them right to left, like mathematical notation: `add1(double(5))`. `pipe` applies them left to right, in reading order: `double(add1(5))`. Both are a one-line `reduceRight`/`reduce` over the list of functions.

**Q6. What is memoization, and when is it a bad idea?**
Memoization caches a function's results by its arguments, so repeated calls with the same input return the cached result. It is a bad idea when the function is cheap (the cache lookup and memory cost more than the work), impure (cached results become stale), called with inputs that rarely repeat (the cache only grows), or returns large values that would be kept in memory. Measure first; memoize hot, pure, expensive functions with repeating inputs.

### Mid-level (2–4 years)

**Q7. Implement a generic `curry(fn)` that supports `f(a)(b)(c)`, `f(a, b)(c)` and `f(a)(b, c)`. Where does it break?**
```js
const curry = (fn, arity = fn.length) => function curried(...args) {
  return args.length >= arity ? fn.apply(this, args) : (...more) => curried.apply(this, [...args, ...more]);
};
curry((l, w, h) => l * w * h)(2)(3, 4); // → 24
```
It collects arguments until it has as many as the function expects. It breaks when `fn.length` is wrong: default parameters and rest parameters are not counted, and variadic functions like `Math.max` have no fixed arity, which is why the version above accepts an explicit `arity`. Each intermediate step also creates a new closure, so very hot code paths pay an allocation cost.

**Q8. What is the difference between currying and partial application? How does `bind` relate to them?**
Currying converts a function into a sequence of functions that take one argument each (auto-curry utilities relax this to "one or more"). Partial application fixes some arguments now and returns a function that takes **all** the remaining arguments in one call. `fn.bind(thisArg, a, b)` is built-in partial application that also fixes `this`: `greet.bind(null, "Hi")("Sam")`. In day-to-day code partial application is far more common, for example `onClick={() => remove(id)}` or `items.filter(hasStatus("done"))`.

**Q9. Implement `pipe` so that any step can be asynchronous.**
```js
const pipeAsync = (...fns) => (input) =>
  fns.reduce((promise, fn) => promise.then(fn), Promise.resolve(input));

const loadProfileName = pipeAsync(fetchUser, (user) => user.name, (name) => name.toUpperCase());
await loadProfileName(7);
```
Starting from `Promise.resolve(input)` and chaining with `.then` works whether each step returns a value or a promise, because `.then` flattens returned promises. If any step throws or rejects, the remaining steps are skipped and the returned promise rejects, so the caller handles errors once with `try`/`catch` around `await`. The steps still run one after another; for independent async work use `Promise.all` instead.

**Q10. A throttled scroll handler shows or hides a "back to top" button, but after a quick flick the button is sometimes left in the wrong state. Why, and how do you fix it?**
The throttle runs on the leading edge only: the last scroll events of the flick fell inside the throttle window and were dropped, so the final position was never processed. Use a throttle with a trailing call, which runs once more at the end of the window with the latest arguments, or a `requestAnimationFrame` throttle that reads the current `scrollY` instead of a stale value. For a pure visibility question ("are we past the hero section?") an `IntersectionObserver` on a sentinel element avoids scroll listeners entirely and always reports the final state.

**Q11. A memoized function takes a `filters` object. Why is `JSON.stringify(filters)` a poor cache key, and what are the alternatives?**
Property order changes the string (`{a, b}` and `{b, a}` produce different keys), `undefined` values, functions and symbols are dropped (so different inputs can collide), `Date`, `Map` and `Set` lose information, circular references throw, and serialising a large object on every call can cost more than the computation. Alternatives: if updates are immutable, cache by **identity** with a `WeakMap` (a changed filter is a new object); build an explicit key from the fields that matter (`` `${f.status}|${f.page}` ``); use nested `Map`s, one level per argument; or use memoize-one with a shallow comparison of the last arguments, which is what memoized selectors do.

**Q12. What is structural sharing, and why is it better than deep cloning for state updates? What does it cost?**
Structural sharing copies only the objects on the path from the root to the changed value and reuses every untouched branch by reference. An update costs work proportional to the depth of the change, not the size of the state, and unchanged branches keep their identity, so `prev.user === next.user` tells memoized components and selectors that nothing changed there. A deep clone gives every object a new identity, so every `memo` and selector misses and the whole tree re-renders. The costs: extra allocations and garbage collection on each update, verbose nested spreads (Immer fixes that), and the risk that someone mutates a shared node and changes both versions at once.

**Q13. In a dashboard that stays open all day, memory grows steadily, and the heap snapshot points at a memoized formatter. Why, and how do you fix it?**
The memoizer uses an unbounded `Map` at module level, and its inputs rarely repeat (timestamps, IDs, generated strings), so every call adds an entry that is never removed; keys and results stay reachable for the life of the page. Fixes: bound the cache with an LRU limit (a `Map` plus eviction of the oldest key) or a time-to-live; use a `WeakMap` when the keys are objects, so entries are collected with them; use memoize-one when only "same as last time" matters; or scope the cache to a component's lifetime (`useMemo`) instead of the module. Then confirm with a second heap snapshot that the retained size stays flat.

### Senior (5+ years)

**Q14. You own the shared utilities package used by many teams. How would you design the `debounce` and `throttle` APIs, and how do they integrate with React?**
Expose one audited implementation with explicit semantics rather than letting teams copy snippets. The API: `debounce(fn, wait, { leading, trailing, maxWait })` and `throttle(fn, wait, { leading, trailing })`, each returning a function that forwards the latest arguments and `this`, plus `cancel()`, `flush()` and `pending()`. Return `void` from the wrapped function: returning "the last result", as lodash does, confuses callers because the result belongs to an earlier call. Type it generically (`(...args: Parameters<F>) => void`) and test it with fake timers (`vi.useFakeTimers()` or `jest.useFakeTimers()`), covering leading-only, trailing-only and cancel during a pending call.

For React, ship a hook such as `useDebouncedCallback(fn, wait)` that creates the debounced instance once per component (`useRef`/`useMemo`), always calls the latest `fn` through a ref (so it never captures stale props), and calls `cancel()` in the effect cleanup on unmount. Recommendation: a single implementation (your own or `lodash-es` per-function imports) plus the hook, and code review that rejects ad hoc `setTimeout` debouncing.

**Q15. A team adopted heavily curried, point-free code (Ramda style). Onboarding and debugging have become slow. What guidance do you give?**
The style trades explicitness for brevity. In a large codebase the cost shows up as pipelines that hide the data shape, stack traces full of anonymous `curried`/`pipe` frames, weak TypeScript inference through generic `compose` and `curry` (with `any` leaking in), and "data-last" argument conventions that newcomers find backwards. None of that is a bug, but it slows every reader.

Guidance: prefer native array methods and plain named functions; give each pipeline step a name (`const isActive = (u) => u.active`) and keep pipelines short; use intermediate `const`s for long transformations so each one can be inspected in a debugger; allow point-free only with unary functions the team owns; never curry functions with optional parameters. Recommendation: put these rules in the style guide (for example "no `pipe` chains longer than about five steps, no point-free callbacks to third-party functions"), and migrate opportunistically as files are touched rather than in one big rewrite.

**Q16. How would you enforce immutability across a large front-end codebase? Should you deep-freeze state in production?**
Use layers, cheapest first. Compile time: TypeScript `readonly`, `Readonly<T>`, `ReadonlyArray<T>` and `as const` catch most accidental mutation at zero runtime cost. Lint: rules such as `no-param-reassign` with property checks, or a dedicated immutability plugin, for code TypeScript cannot see. Updates: Immer (built into Redux Toolkit) lets developers write simple mutating code against a draft and get a structurally shared, frozen result. Development checks: Redux Toolkit's immutability middleware (development only) or dev-only freezing turn hidden mutations into immediate errors.

Deep-freezing all state by hand in production costs time on every update for little benefit: by then the bugs should have been caught. Recommendation: `readonly` types plus Immer for updates plus development-only mutation checks; reserve `Object.freeze` for small constant tables (enums, config).

**Q17. A component behaves differently in development than in production: a render counter goes up by two, a module-level array keeps growing, and `Date.now()` in render causes a hydration mismatch. What principle is being broken, and how do you fix it?**
React requires rendering to be pure: for the same props, state and context, a component returns the same output and changes nothing outside itself. React may call a component more than once, pause and throw away a render (concurrent rendering), and render once on the server and again on the client. StrictMode deliberately calls components, state initialisers and reducers twice in development to expose impure code, which is why the counter goes up by two and the module-level array grows. `Date.now()` returns different values on the server and the client, so the markup does not match.

Fix by moving each side effect to the right place: user-triggered work into event handlers; synchronisation with the outside world (subscriptions, logging, DOM measurements) into `useEffect`; time-dependent values into state set after mount, or passed from the server; random IDs into `useId()` or action creators rather than reducers. Never mutate props, module-level variables or shared objects during render. Recommendation: keep StrictMode on in development, enforce the hooks lint rules, and treat any render-time side effect as a bug, because tools like the React Compiler assume components are pure.

## References

- [MDN: First-class function](https://developer.mozilla.org/en-US/docs/Glossary/First-class_Function)
- [MDN: Object.freeze()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze)
- [MDN: Array.prototype.toSorted()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted)
- [MDN: Function.prototype.bind()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)
- [MDN: Function.length](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length)
- [MDN: WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)
- [React: Keeping Components Pure](https://react.dev/learn/keeping-components-pure)
- [Redux: Deriving Data with Selectors](https://redux.js.org/usage/deriving-data-selectors)
- [Immer documentation](https://immerjs.github.io/immer/)
- [Lodash: debounce](https://lodash.com/docs/#debounce)
- [CSS-Tricks: Debouncing and Throttling Explained Through Examples](https://css-tricks.com/debouncing-throttling-explained-examples/)
- [TC39: Pipe operator proposal](https://github.com/tc39/proposal-pipeline-operator)
