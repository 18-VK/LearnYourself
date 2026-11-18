# Polyfills and Implement-It-Yourself Questions

> Interview · Topic 3 · Demo: [polyfills.js](polyfills.js) · Run with `node polyfills.js`

"Implement `bind`", "write `Promise.any`", "build an EventEmitter": these questions check whether you understand a built-in well enough to rebuild it, including the edge cases its specification quietly handles for you. This note first separates the three ways of supporting older browsers (polyfills, ponyfills and transpiling) and explains why application code should not patch built-ins. It then walks through the classic implementations, from `call`/`apply`/`bind` to a concurrency-limited task pool, with the edge cases interviewers probe. Every implementation is in `polyfills.js` with `node:assert` self-tests that print one `pass` line per item; the snippets here are trimmed to the core logic, so read the file for argument checks and tests.

## Polyfill, Ponyfill or Transpile?

| | What it does | Example | Handles new syntax? |
|---|---|---|---|
| **Polyfill** | Adds a missing API to the global object or a prototype, under its standard name, only when it is missing | `Array.prototype.flat`, `structuredClone`, `Promise.withResolvers` (core-js provides most) | No |
| **Ponyfill** | Same behaviour exported as an ordinary function; never touches globals | `import { flat } from './utils.js'`, then `flat(arr, 2)` | No |
| **Transpiler** | Rewrites newer **syntax** into older syntax at build time | Babel, TypeScript, SWC, esbuild turning `a?.b` into `a == null ? void 0 : a.b` | Yes, but cannot add runtime APIs |

- **Syntax cannot be polyfilled, and APIs cannot be transpiled.** An engine that does not know `?.`, `??` or `#private` fails with a `SyntaxError` while *parsing* the file, before any polyfill code could run. Conversely, Babel can rewrite an `async` function, but if the engine has no `Promise`, a polyfill must supply it, so real projects combine both.
- **Some features cannot be polyfilled faithfully:** `Proxy`, `WeakRef`, real private fields, and most new CSS (`:has()`, container queries) can only be approximated, slowly or not at all. Plan a fallback instead.
- **Modern setup:** declare target browsers once (a `browserslist` query), then Babel's `preset-env` with core-js and `useBuiltIns: "usage"` adds only the polyfills the code actually uses *and* the targets lack. If you target only current evergreen browsers, you may need none.

> **Note:** Never load polyfills from a third-party CDN that generates them per visitor. In 2024 the `polyfill.io` domain changed owner and started injecting malicious code into the sites that still referenced it. Bundle or self-host polyfills, with pinned versions.

## Feature Detection

```js
if (!('flat' in Array.prototype)) {
  Object.defineProperty(Array.prototype, 'flat', {
    value: function flat(depth = 1) { /* ... */ },
    writable: true, configurable: true, // enumerable defaults to false, like native methods
  });
}
```

- **Detect the feature, not the browser.** User-agent strings are spoofed and frozen, and a version number says nothing about flags or partial support. Test the exact thing you need: `'IntersectionObserver' in window`, `typeof structuredClone === 'function'`, `CSS.supports('display', 'grid')`, or `@supports` in CSS.
- **Use `Object.defineProperty`.** `Array.prototype.flat = fn` creates an **enumerable** property, so it shows up in every `for...in` over every array in the app.
- **Test behaviour when presence is not enough.** Some engines shipped buggy early versions of methods; core-js checks how a method behaves, not just whether it exists. The demo's `definePolyfill()` wraps this pattern and never overwrites a native method.

## Why Not Patch Built-ins in Application Code

- **Collisions with future standards.** When a popular library adds a non-standard method and a standard later uses the same name with different behaviour, websites break, and the committee has to pick another name. MooTools' `Array.prototype.contains` is why the standard method is called `includes`, and its `flatten` is why we have `flat` (the 2018 "smooshgate").
- **Collisions between libraries.** Two scripts define `String.prototype.capitalize` differently; whichever loads last silently wins. And a method on a built-in that is not on MDN sends every new team member searching.
- **The exception** is a standards-compliant polyfill library loaded once at the app entry point, which only fills gaps. Everything else should be a ponyfill: a plain function you import. [Prototypes and classes](../../03-javascript/11-prototypes-and-classes/notes.md) covers the prototype mechanics behind this.

## How to Answer an "Implement X" Question

Restate the contract (parameters, return value, sync or async, does it mutate), write the simplest correct version out loud, then walk through the edge cases: `this`, empty input, holes, ordering, errors and rejections, re-entrancy, cleanup of timers and listeners, memory. Finish by testing two or three calls, including one edge case. Most of the marks are in the edge cases, so each section below ends with them. By convention, interview versions use a `my` prefix (`Function.prototype.myBind`) so the real method is not replaced.

## Function Methods: `call`, `apply`, `bind`

```js
Function.prototype.myCall = function (thisArg, ...args) {
  const context = thisArg == null ? globalThis : Object(thisArg);
  const key = Symbol('fn');      // a unique key cannot overwrite a real property
  context[key] = this;           // `this` is the function myCall was called on
  try {
    return context[key](...args); // called as a method, so inside it this === context
  } finally {
    delete context[key];         // clean up even if the function throws
  }
};

Function.prototype.myApply = function (thisArg, args) {
  return this.myCall(thisArg, ...(args == null ? [] : Array.from(args)));
};

Function.prototype.myBind = function (thisArg, ...preset) {
  const target = this;
  function bound(...later) {
    const args = [...preset, ...later];
    if (new.target) {            // called with `new`: the bound this is ignored
      return Reflect.construct(target, args, new.target === bound ? target : new.target);
    }
    return Reflect.apply(target, thisArg, args);
  }
  Object.defineProperty(bound, Symbol.hasInstance, { value: (v) => v instanceof target });
  return bound;
};
```

- **The `call` trick** is that a method call sets `this` to the object before the dot. It cannot work on a frozen object (the temporary key cannot be added), a limitation the real `call` does not have.
- **`null`/`undefined` become `globalThis` and primitives are boxed**, which are sloppy-mode rules. The real `call` passes `thisArg` unchanged to a strict-mode function (`undefined` stays `undefined`, `5` stays a number); the method-call trick cannot reproduce that.
- **`bind`** pre-fills arguments (partial application) and ignores any later `call`, `apply` or second `bind`. With `new`, it must construct the *target* and ignore `thisArg`; the instance's prototype is `target.prototype`, and `instanceof` works with both functions. The old pre-ES2015 polyfill tested `this instanceof bound` instead of `new.target`, which `bound.call(new bound())` fools and which fails for classes. The demo also sets `name` (`"bound greet"`) and `length` (target's length minus the preset count), as native bound functions do. See [this, call, apply and bind](../../03-javascript/10-this-call-apply-bind/notes.md).

## Array Methods: `map`, `filter`, `reduce`, `flat`

[Arrays](../../03-javascript/08-arrays/notes.md) has a basic `map`; this version follows the specification more closely.

```js
Array.prototype.myMap = function (callback, thisArg) {
  if (typeof callback !== 'function') throw new TypeError(`${callback} is not a function`);
  const arr = Object(this);       // also works on array-likes: myMap.call('abc', fn)
  const len = arr.length >>> 0;   // read once: items pushed during the loop are not visited
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    if (i in arr) result[i] = callback.call(thisArg, arr[i], i, arr); // holes stay holes
  }
  return result;
};
// myFilter: the same loop, pushing arr[i] when the callback returns a truthy value

Array.prototype.myReduce = function (callback, ...rest) {
  const arr = Object(this);
  const len = arr.length >>> 0;
  let i = 0;
  let acc;
  if (rest.length > 0) {
    acc = rest[0];                // reduce(fn, undefined) DOES have an initial value
  } else {
    while (i < len && !(i in arr)) i++;
    if (i >= len) throw new TypeError('Reduce of empty array with no initial value');
    acc = arr[i++];
  }
  for (; i < len; i++) if (i in arr) acc = callback(acc, arr[i], i, arr);
  return acc;
};

Array.prototype.myFlat = function (depth = 1) {
  const result = [];
  const visit = (arr, d) => {
    for (let i = 0; i < arr.length; i++) {
      if (!(i in arr)) continue;  // flat() removes holes
      if (Array.isArray(arr[i]) && d > 0) visit(arr[i], d - 1);
      else result.push(arr[i]);
    }
  };
  visit(this, depth);
  return result;
};
```

- Loop with `for` and `i in arr`; `forEach` or `for...of` in a polyfill hides your handling of sparse arrays (`[1, , 3]`). And never call the native method you are replacing. The callback receives `(value, index, array)`, which is the root of the `map(parseInt)` puzzle in [Output prediction](../04-output-prediction/notes.md).
- `flat(Infinity)` works because `Infinity - 1` is still `Infinity`. Recursion can overflow the stack on extremely deep nesting; an explicit stack array avoids that.

## Promise Combinators: `all`, `allSettled`, `any`, `race`

| Method | Fulfils | Rejects | Empty input |
|---|---|---|---|
| `all` | When every input fulfils, with values in **input** order | On the first rejection | Fulfils with `[]` |
| `allSettled` | When every input settles, with `{ status, value / reason }` objects | Never | Fulfils with `[]` |
| `any` | With the first fulfilment | When all reject, with an `AggregateError` (errors in input order) | Rejects with `AggregateError` |
| `race` | Settles like the first input to settle | (same) | Stays pending forever |

`promiseAll` is walked through in [Callbacks and promises](../../03-javascript/17-callbacks-and-promises/notes.md) (and is in the demo, accepting any iterable); the other three build on the same pattern:

```js
const promiseAllSettled = (iterable) => promiseAll(Array.from(iterable, (item) =>
  Promise.resolve(item).then(
    (value) => ({ status: 'fulfilled', value }),
    (reason) => ({ status: 'rejected', reason }),
  )));

function promiseAny(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const errors = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return reject(new AggregateError([], 'All promises were rejected'));
    items.forEach((item, i) => Promise.resolve(item).then(resolve, (err) => {
      errors[i] = err;
      if (--remaining === 0) reject(new AggregateError(errors, 'All promises were rejected'));
    }));
  });
}

const promiseRace = (iterable) => new Promise((resolve, reject) => {
  for (const item of iterable) Promise.resolve(item).then(resolve, reject);
});
```

- Count with a counter, not `results.length` (holes make the length lie), and store by index so the order is the input order. `Array.from(iterable)` accepts any iterable, and `Promise.resolve(item)` accepts plain values.
- Calling `resolve` or `reject` again after a promise has settled is ignored, so `race` and `any` need no "already done" flag. None of these **cancel** the losing work; they only stop waiting. Cancelling needs an `AbortController` passed to the tasks.

## A Minimal Promise

```js
class MyPromise {
  #state = 'pending'; #value; #handlers = [];

  constructor(executor) {
    let done = false;             // resolve/reject take effect only once
    const resolve = (v) => { if (!done) { done = true; this.#resolveWith(v); } };
    const reject = (r) => { if (!done) { done = true; this.#settle('rejected', r); } };
    try { executor(resolve, reject); } catch (err) { reject(err); } // executor runs synchronously
  }

  #resolveWith(value) {
    if (value === this) return this.#settle('rejected', new TypeError('Chaining cycle detected'));
    const then = Object(value) === value ? value.then : undefined; // objects and functions
    if (typeof then === 'function') { // a promise or any thenable: adopt its state
      queueMicrotask(() => then.call(value, (v) => this.#resolveWith(v), (r) => this.#settle('rejected', r)));
    } else {
      this.#settle('fulfilled', value);
    }
  }

  #settle(state, value) {
    if (this.#state !== 'pending') return;
    [this.#state, this.#value] = [state, value];
    this.#handlers.forEach((h) => this.#schedule(h));
  }

  #schedule({ onFulfilled, onRejected, resolve, reject }) {
    queueMicrotask(() => {        // always asynchronous, even if already settled
      const ok = this.#state === 'fulfilled';
      const handler = ok ? onFulfilled : onRejected;
      if (typeof handler !== 'function') return ok ? resolve(this.#value) : reject(this.#value);
      try { resolve(handler(this.#value)); } catch (err) { reject(err); }
    });
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const h = { onFulfilled, onRejected, resolve, reject };
      if (this.#state === 'pending') this.#handlers.push(h);
      else this.#schedule(h);
    });
  }

  catch(onRejected) { return this.then(undefined, onRejected); }
}
```

What interviewers look for:

- `then` returns a **new** promise resolved with the handler's return value; that is the whole chaining mechanism.
- A missing handler **passes the value or reason through**, which is why one `.catch()` at the end of a chain catches everything.
- Handlers run as **microtasks**, never synchronously, even on an already-settled promise, so callers see one consistent order.
- Resolving with a thenable **adopts its state**; resolving a promise with itself is a `TypeError`.
- `await` works on `MyPromise` because `await` accepts any thenable. The demo adds what is trimmed here: guards around reading `then`, `finally`, `MyPromise.resolve`/`reject`. Still missing: unhandled-rejection reporting.

## Timing Utilities: `debounce`, `throttle`, `setInterval` via `setTimeout`

The basic `debounce` is in [Closures, destructuring and spread](../../03-javascript/12-closures-destructuring-spread/notes.md); a library-grade one adds a leading edge and `cancel`/`flush`:

```js
function debounce(fn, wait, { leading = false, trailing = true } = {}) {
  let timer = null, lastArgs, lastThis;
  const invoke = () => {
    const [args, ctx] = [lastArgs, lastThis];
    lastArgs = lastThis = undefined;
    fn.apply(ctx, args);
  };
  function debounced(...args) {   // a regular function, so callers' `this` is kept
    [lastArgs, lastThis] = [args, this];
    const callNow = leading && timer === null; // first call of a burst
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs) invoke();     // skip if the leading call was the only one
    }, wait);
    if (callNow) invoke();
  }
  debounced.cancel = () => { clearTimeout(timer); timer = null; lastArgs = lastThis = undefined; };
  return debounced;               // the demo also has flush()
}

function throttle(fn, wait) {
  let last = 0, timer = null, pendingArgs, pendingThis;
  return function throttled(...args) {
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0) {          // leading edge: run now
      clearTimeout(timer);
      [timer, last] = [null, Date.now()];
      fn.apply(this, args);
    } else {                       // inside the window: keep only the latest call
      [pendingArgs, pendingThis] = [args, this];
      timer ??= setTimeout(() => {
        [timer, last] = [null, Date.now()];
        fn.apply(pendingThis, pendingArgs); // trailing edge: the final state is never lost
      }, remaining);
    }
  };
}

function mySetInterval(fn, delay, ...args) {
  const handle = { id: null, active: true }; // the timer id changes every tick
  const schedule = () => {
    handle.id = setTimeout(() => {
      if (!handle.active) return;
      fn(...args);
      if (handle.active) schedule(); // the callback may have cleared the interval
    }, delay);
  };
  schedule();
  return handle;
}
const myClearInterval = (handle) => { handle.active = false; clearTimeout(handle.id); };
```

- Debounce waits for a pause; throttle guarantees at most one call per window. [Functional patterns](../../03-javascript/26-functional-patterns/notes.md) compares them.
- A chained `setTimeout` never overlaps runs, but it drifts: the gap is `delay` plus the callback's run time. For a fixed rate, compute each delay from the start time: `start + n * delay - Date.now()`. Browsers throttle timers in hidden tabs (to about once a second, and far less often after several minutes in Chrome), so neither version is a reliable clock.

## Object Utilities: Deep Clone and Deep Equal

```js
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value; // primitives; functions shared
  if (seen.has(value)) return seen.get(value);     // cycles and shared references
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);
    value.forEach((v, k) => copy.set(deepClone(k, seen), deepClone(v, seen)));
    return copy;
  }
  // (Set is handled like Map in the demo)
  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);                           // register BEFORE recursing
  for (const key of Reflect.ownKeys(value)) {      // includes symbol keys
    if (Object.prototype.propertyIsEnumerable.call(value, key)) copy[key] = deepClone(value[key], seen);
  }
  return copy;
}

function deepEqual(a, b, seen = new Map()) {
  if (a === b || (a !== a && b !== b)) return true;  // same value, or both NaN
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (seen.get(a) === b) return true;                // this pair is already being compared
  seen.set(a, b);
  if (a instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && a.length !== b.length) return false;
  // (RegExp, Map and Set branches are in the demo)
  const keysA = Object.keys(a), keysB = Object.keys(b);
  return keysA.length === keysB.length &&
    keysA.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k], seen));
}
```

- **Clone:** one `WeakMap` from original to copy fixes both cycles and shared references, but only if the copy is registered *before* the recursion. `Object.create(proto)` keeps class instances' methods, which `structuredClone` drops ([Pass by value and copying](../../03-javascript/06-pass-by-value-and-copying/notes.md)).
- **Not handled:** functions are shared, getters are run and stored as plain values, non-enumerable properties and frozen state are lost, typed arrays, `Error` objects and DOM nodes need their own branches. Class instances with `#private` fields cannot be cloned this way at all: the copy has no private slots, so its methods throw.
- **Equal:** state your choices. Here `NaN` equals `NaN`, `0` equals `-0` (like lodash `isEqual`; use `Object.is` to tell them apart), prototypes must match, a hole is not equal to `undefined`, and `Set` members and `Map` keys are matched by identity, because structural matching of keys is O(n²).

## EventEmitter: `on`, `off`, `once`, `emit`

```js
class EventEmitter {
  #events = new Map();                        // name -> array of listeners
  on(name, listener) {
    if (!this.#events.has(name)) this.#events.set(name, []);
    this.#events.get(name).push(listener);
    return this;                              // chainable
  }
  off(name, listener) {
    const list = this.#events.get(name) ?? [];
    const i = list.findLastIndex((l) => l === listener || l.listener === listener);
    if (i !== -1) list.splice(i, 1);
    return this;
  }
  once(name, listener) {
    const wrapper = (...args) => {
      this.off(name, wrapper);                // remove first: a nested emit cannot call it twice
      listener.apply(this, args);
    };
    wrapper.listener = listener;              // so off(name, listener) can find the wrapper
    return this.on(name, wrapper);
  }
  emit(name, ...args) {
    const list = this.#events.get(name);
    if (!list) return false;
    for (const listener of [...list]) listener.apply(this, args); // iterate a snapshot
    return true;
  }
}
```

- Iterating the live array while a listener removes itself shifts the indexes and **skips the next listener**; Node.js iterates a copy for the same reason.
- If a listener throws, the remaining listeners do not run. Node also throws when an `'error'` event has no listener, so errors are never silently lost. Every `on` needs a matching `off` (on unmount, on teardown), or listeners and everything their closures hold leak; Node warns when one event has more than 10 listeners.
- In the browser you often do not need one: `class Bus extends EventTarget {}` with `dispatchEvent(new CustomEvent('save', { detail }))` is built in.

## Functional Helpers: `curry`, `compose`/`pipe`, `once`

```js
function curry(fn, arity = fn.length) {
  return function curried(...args) {
    if (args.length >= arity) return fn.apply(this, args);
    return (...more) => curried.apply(this, [...args, ...more]);
  };
}
const sum = (a) => (b) => (b === undefined ? a : sum(a + b)); // sum(1)(2)(3)() → 6

const pipe = (...fns) => (input) => fns.reduce((acc, fn) => fn(acc), input);         // left to right
const compose = (...fns) => (input) => fns.reduceRight((acc, fn) => fn(acc), input); // right to left

function once(fn) {
  let called = false, result;
  return function (...args) {
    if (!called) {
      called = true;              // set before calling: a throwing or re-entrant fn runs once
      result = fn.apply(this, args);
      fn = null;                  // let the function and its closure be garbage-collected
    }
    return result;
  };
}
```

- `fn.length` stops counting at the first default or rest parameter, so `curry` needs an explicit `arity` for those.
- `pipe()` with no functions is the identity. To let the first function take several arguments, write `(first, ...rest) => (...args) => rest.reduce((acc, fn) => fn(acc), first(...args))`. An async-capable `pipe` (the demo's `pipeAsync`) and more patterns are in [Functional patterns](../../03-javascript/26-functional-patterns/notes.md).

## Language Operators: `new` and `instanceof`

```js
function myNew(Constructor, ...args) {
  const proto = Constructor.prototype;
  const obj = Object.create(proto !== null && typeof proto === 'object' ? proto : Object.prototype);
  const result = Constructor.apply(obj, args);
  const isObject = result !== null && (typeof result === 'object' || typeof result === 'function');
  return isObject ? result : obj;  // a returned object replaces obj; primitives are ignored
}

function myInstanceOf(value, Constructor) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  for (let p = Object.getPrototypeOf(value); p !== null; p = Object.getPrototypeOf(p)) {
    if (p === Constructor.prototype) return true;
  }
  return false;
}
```

- `myNew` cannot construct a `class`: class constructors throw when called without `new`, and the only userland way around that is `Reflect.construct`, which is `new` itself. Arrow functions and methods are not constructors at all.
- The real `instanceof` checks `Constructor[Symbol.hasInstance]` first (that is how bound functions delegate), and it is fooled across realms: an array from an iframe is not `instanceof Array` in the parent, so use `Array.isArray`. The steps of `new` are in [Objects and enums](../../03-javascript/09-objects-and-enums/notes.md).

## Async Control: Retry with Backoff, Concurrency-Limited Pool

```js
async function retry(task, { retries = 3, baseDelay = 200, maxDelay = 5000,
                             shouldRetry = () => true, signal } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task(attempt);  // `await` inside try, or the rejection escapes
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const cap = Math.min(maxDelay, baseDelay * 2 ** attempt);
      await abortableSleep(Math.random() * cap, signal); // "full jitter"
    }
  }
}

async function runWithConcurrency(tasks, limit) { // tasks are FUNCTIONS returning promises
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;            // claimed synchronously: two workers never take the same task
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;                  // input order, whatever the finish order
}
```

- **Retry:** random jitter stops thousands of clients retrying in lock-step after an outage. Retry only what is safe to repeat (network errors, 5xx, 429), never a 4xx, and stop when `signal` aborts. A `fetch`-specific version is in [Async/await and fetch](../../03-javascript/18-async-await-and-fetch/notes.md).
- **Pool:** pass functions, not promises: a promise is already running, so a list of promises cannot be limited. `Promise.all` over the workers rejects on the first failure, but the other workers keep draining the queue; add a "stop" flag or store `allSettled`-style results if that matters.

## Common Mistakes

- **Plain assignment to a prototype** (`Array.prototype.x = fn`): enumerable, and it overwrites a native method if you skip feature detection.
- **Array polyfills that use `forEach`** (hiding how holes are handled), call the native method they replace, or test `initialValue === undefined` in `reduce` instead of counting the arguments passed.
- **`Promise.all` that pushes results in finish order** or checks `results.length`, and no special case for empty input.
- **A custom Promise that runs handlers synchronously** when it is already settled.
- **`deepClone` that registers the copy after recursing**, so a cycle recurses forever, or a JSON round-trip that loses `Date`, `Map` and `undefined`.
- **`emit` iterating the live listener array**, so self-removing listeners skip their neighbours.
- **Arrow functions as the returned wrapper** in `debounce`/`throttle`/`once`, which loses the caller's `this`.

## Key Takeaways

- Polyfills add missing **APIs** at runtime; transpilers rewrite **syntax** at build time; ponyfills are polyfills that never touch globals.
- Feature-detect, install with `Object.defineProperty`, never overwrite native code, and keep app code free of prototype patches.
- Array methods: read `length` once, skip holes with `i in arr`, pass `(value, index, array)` and `thisArg`.
- Promise combinators: preserve input order, special-case empty input, and remember that none of them cancel work.
- A Promise is a state machine plus a queue of handlers that run as microtasks; `then` returns a new promise. Timers and listeners need cleanup paths (`cancel`, `off`, clear); closures over them are where leaks start.
- Async helpers take **functions** (thunks), not promises, so they control when work starts.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between a polyfill and transpiling? Why can't you polyfill optional chaining?**
A polyfill is runtime code that adds a missing API (a global, a method) when feature detection shows it is absent. Transpiling is a build step that rewrites new syntax into older syntax. `a?.b` is syntax: an engine that does not understand it throws a `SyntaxError` while parsing the file, before any polyfill could run, so only a transpiler helps. The reverse also holds: a transpiler can rewrite an `async` function but cannot create `Promise`, so projects need both.

**Q2. How do you check that a feature is supported before using it, and why not check the browser version?**
Test for the exact feature: `'IntersectionObserver' in window`, `typeof structuredClone === 'function'`, `'flat' in Array.prototype`, `CSS.supports(...)` or `@supports`. Browser sniffing breaks because user-agent strings are spoofed and frozen, and a version number does not reveal flags, policies or partial implementations. When a feature exists but is buggy in some engines, test its behaviour.

**Q3. Implement `once`. What should later calls return, and what if the function throws?**
Later calls return the first call's result without running the function again (see the code above). Setting the flag *before* calling means a function that throws, or calls itself, still runs only once. If you want "retry until it succeeds", set the flag after a successful call; either is valid, but say which one you chose. Setting `fn = null` lets the wrapped function be garbage-collected.

**Q4. Implement `Function.prototype.call` without using `call`, `apply` or `bind`.**
Temporarily attach the function to the target object and call it as a method, because a method call sets `this` to the object before the dot. Use a `Symbol` key so you cannot overwrite an existing property, delete it in `finally` so it is removed even if the function throws, and map `null`/`undefined` to `globalThis` and box primitives with `Object()`. Mention the limitations: it fails on frozen objects and cannot reproduce strict-mode `this`.

**Q5. Why does `Promise.race([])` stay pending forever while `Promise.all([])` fulfils immediately?**
`all` fulfils when every input has fulfilled, which is vacuously true for no inputs, so it fulfils with `[]` (an implementation must special-case this, because no callback would ever run). `race` settles like the first input to settle, and with no inputs nothing ever settles. `any([])` rejects with an `AggregateError`, because "all rejected" is vacuously true. When a list is built dynamically, guard the empty case or race against a timeout.

**Q6. Why would you implement `setInterval` with chained `setTimeout` calls?**
`setInterval` schedules the next run whether or not the previous one has finished, so an async callback such as API polling can overlap and pile up when the server is slow. A chained `setTimeout` schedules the next run only after the current one ends, guaranteeing a gap, and the delay can change each time (for backoff). The trade-off is drift, and you need a handle object for clearing because the timer id changes every tick.

### Mid-level (2–4 years)

**Q7. A simple `bind` polyfill handles `new` by calling `new fn(...args)`. What still differs from the native `bind`, and does it matter?**
Several details. `x instanceof boundFn` checks the polyfill's own `prototype` property (a fresh, empty object), so it is `false`, while the native bound function delegates `instanceof` to the target; fix it with `Symbol.hasInstance` or by sharing `fn.prototype`. Native bound functions have `name` set to `"bound fn"`, a reduced `length`, and no `prototype` property at all. With `Reflect.construct(fn, args, newTarget)` instead of `new fn(...)`, a subclass's `new.target` is preserved too. For application code none of this matters, because every engine has `bind`; it matters when you write a library or polyfill, where `instanceof` checks and `length`-based helpers such as `curry` rely on it. The full version is in the demo; the basic one is in [this, call, apply and bind](../../03-javascript/10-this-call-apply-bind/notes.md).

**Q8. A `reduce` polyfill treats `arr.reduce(fn, undefined)` the same as `arr.reduce(fn)`. Why is that a bug?**
They behave differently. With an explicit `undefined`, the callback runs for every element starting from `acc = undefined`, and an empty array returns `undefined`. Without an initial value, the first element becomes the accumulator, the callback runs one time fewer, and an empty array throws a `TypeError`. Checking `initialValue === undefined` cannot tell these apart; check how many arguments were passed (`arguments.length` or a rest parameter's length).

**Q9. `flat(Infinity)` written recursively throws `RangeError: Maximum call stack size exceeded` on some inputs. Why, and how do you fix it?**
Each nesting level costs one stack frame, so an array nested tens of thousands of levels deep (generated or malicious JSON, for example) exhausts the call stack. Replace the recursion with an explicit stack of `{ arr, i, depth }` entries kept in an ordinary array on the heap: look at the top entry, advance its index, skip holes, push a new entry when the current value is an array with depth left, otherwise push the value to the result, and pop the entry when its index reaches the end. Processing the top entry first keeps the output in the original order. `flatIterative` in the demo does this and handles an array nested 50,000 levels deep, where the recursive version overflows. The same technique applies to deep clone, deep equal and tree walks.

**Q10. In your EventEmitter, a listener that removes itself during `emit` makes the next listener get skipped, and a `once` listener cannot be removed with `off(name, fn)`. Fix both.**
The skip happens because `emit` loops over the live array while `off` splices it, shifting the next listener into the index that was just visited. Iterate over a snapshot (`[...list]`). The `once` problem exists because the stored function is a wrapper, not `fn`; store the original on the wrapper (`wrapper.listener = fn`) and let `off` match either. Also remove the wrapper before calling the listener, so a nested `emit` cannot run it twice.

**Q11. Your `deepClone` overflows the stack on an object that references itself, and two properties that pointed to one shared object now point to two different copies. Fix both.**
Keep a `WeakMap` from each original object to its copy. Before cloning an object, return the existing copy if the map has one; after creating the empty copy, register it **before** recursing into the children. The recursion then reaches the copy again instead of looping, and every later reference to the same original reuses the same copy, so shared structure is preserved. `structuredClone` does the same internally.

**Q12. Why does resolving a promise with any object that has a `then` method call that method, and where does that bite?**
The resolution procedure treats every object or function with a callable `then` as a *thenable* and adopts its state, so promises from different libraries interoperate; `await obj` does the same. The side effect is that any value with a `then` method is never passed through as data: `return queryBuilder` from an `async` function executes the query (some query builders are deliberately thenable), and a domain class that happens to define `then()` gets called with `resolve`/`reject` and may never settle. A correct custom Promise must read `then` exactly once, call it with `this` set to the object, and ignore repeated `resolve`/`reject` calls from it. Avoid naming a method `then` unless the object really is a promise-like.

**Q13. Implement a pool that runs async tasks with at most N in flight. How do you keep results in order, and what happens when a task rejects?**
Start N workers that each loop: claim the next index synchronously (`const i = next++`), await `tasks[i]()`, and store the result at `results[i]`, so order follows the input, not completion. The tasks must be functions, since promises would already be running. If one task rejects, `Promise.all` over the workers rejects immediately, but the other workers keep taking tasks; either set a flag that stops claiming new work, or catch inside the worker and store `{ status, value / reason }` like `allSettled`, depending on whether partial results are useful.

### Senior (5+ years)

**Q14. The app must support browsers up to two years old. How do you decide what to polyfill and how to ship it?**
Make the target list explicit and data-driven: a `browserslist` query based on real analytics, reviewed every few months. Let tooling decide the rest: `preset-env` transpiles only syntax those targets lack, and core-js with `useBuiltIns: "usage"` adds only polyfills for APIs the code uses. Check the bundle cost against your performance budget, because polyfills are shipped to everyone unless you serve separate bundles. Some features cannot be polyfilled well (`Proxy`, `WeakRef`, CSS `:has()` or container queries), so design a progressive-enhancement fallback for them instead.

Self-host and pin the polyfills; after the 2024 `polyfill.io` incident, a third-party script that rewrites itself per visitor is a supply-chain risk. Recommendation: browserslist plus usage-based core-js in the build, a bundle-size check in CI, and a yearly review that drops polyfills for features that have become widely available.

**Q15. You own a shared utilities package. When do you ship your own implementation, when do you rely on the native API, and when do you add a dependency?**
Prefer the platform when the feature is available in all your targets: `structuredClone` instead of a hand-written `deepClone`, `Array.prototype.toSorted` and `Object.groupBy` instead of helpers, `AbortSignal.timeout` instead of a custom timer. Use a ponyfill (an exported function with the standard's behaviour) while a feature is still missing in some targets, so callers can switch to the native API later with a find-and-replace. Add a dependency only when the logic is genuinely hard and well maintained elsewhere (date and time zone handling, for example), and weigh bundle size, tree-shaking, maintenance and supply-chain risk, not just convenience. Make it enforceable: a short decision record in the package's README, a bundle-size budget in CI, and `no-restricted-imports` lint rules that steer people away from whole-library imports or homegrown duplicates. Recommendation: native first, ponyfill second, dependency last, and revisit the list when browser support changes.

**Q16. Your embeddable widget breaks only on some customers' sites. You find that a script on those pages replaced `Array.from` and `Promise` with old, non-standard versions. How do you diagnose and defend against this?**
Confirm it in production first: check whether the suspicious function is still native with `Function.prototype.toString.call(Array.from).includes('[native code]')` and include the result in your error reports, grouped by customer domain. This is the "don't patch built-ins" rule failing on someone else's page: tag managers and old libraries ship outdated polyfills that overwrite native methods unconditionally.

Defences, from strongest: run the widget inside an `<iframe>`, which has its own clean globals; or capture references to the natives your code needs as early as possible (`const { from } = Array; const NativePromise = Promise;`) before other scripts run, which only works if your script loads first; and keep your own code free of reliance on globals other scripts commonly patch. Recommendation: iframe isolation for widgets embedded on pages you do not control, plus telemetry that detects patched built-ins so support can tell the customer which script is responsible.

## References

- [MDN: Polyfill (glossary)](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill)
- [MDN: Function.prototype.bind()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)
- [MDN: new.target](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target)
- [MDN: Symbol.hasInstance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/hasInstance)
- [MDN: Array.prototype.reduce()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce)
- [MDN: Promise.any()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any)
- [MDN: structuredClone()](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)
- [Promises/A+ specification](https://promisesaplus.com/)
- [Node.js: Events](https://nodejs.org/api/events.html)
- [core-js](https://github.com/zloirock/core-js)
- [AWS Architecture Blog: Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
