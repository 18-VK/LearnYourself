# Symbols, Iterators and Generators

> JavaScript · Topic 13 · Demo: [script.js](script.js) · Run with `node script.js` (no HTML page)

`Symbol` is the primitive type that gives JavaScript collision-free property keys, and a small set of built-in ("well-known") symbols are the hooks the language itself calls: `for...of` looks up `Symbol.iterator`, `instanceof` looks up `Symbol.hasInstance`, `+obj` looks up `Symbol.toPrimitive`. The most important hook is the **iteration protocol**, the contract behind `for...of`, spread, array destructuring, `Array.from`, `new Map(...)` and `Promise.all`. Generators are the easy way to implement that contract, and they add lazy evaluation, infinite sequences and two-way communication. Async generators apply the same idea to data that arrives over time, such as a paginated API. This note goes from symbols to the protocols, generators, async iteration and the ES2025 iterator helpers; every section has a matching part in `script.js`.

## Symbols

### Creating symbols

ES6 introduced a new primitive data type called **Symbol**. Symbols are **immutable** (cannot be changed) and **unique**: every call to `Symbol()` produces a value that is not equal to any other value.

```js
const id = Symbol("id");          // "id" is only a description, for debugging
console.log(typeof id);           // → "symbol"
console.log(Symbol("id") === Symbol("id")); // → false
console.log(id.description);      // → "id"
// new Symbol();                  // TypeError: Symbol is not a constructor
```

`Symbol` is a function, not a constructor: there is no wrapper object to create with `new`. Symbols also refuse to convert implicitly, so a symbol can never turn into a string key by accident:

| Expression | Result |
|---|---|
| `String(sym)`, `sym.toString()` | `"Symbol(id)"` |
| `sym.description` | `"id"` |
| `` `${sym}` ``, `"key: " + sym` | `TypeError: Cannot convert a Symbol value to a string` |
| `+sym` | `TypeError: Cannot convert a Symbol value to a number` |
| `Boolean(sym)`, `!!sym` | `true` (the only conversion that works implicitly) |
| `JSON.stringify({ a: sym })` | `"{}"` (symbol values are skipped) |

### Symbols as object keys

The main use of symbols is as property keys that can't clash with other keys, for example when a library adds data to an object it doesn't own. Use a computed key (`[sym]`) to create one:

```js
const user = { name: "Sara", [id]: 101 };
console.log(user[id]);                      // → 101
console.log(Object.keys(user));             // → ["name"]
console.log(JSON.stringify(user));          // → '{"name":"Sara"}'
console.log(Object.getOwnPropertySymbols(user)); // → [Symbol(id)]
```

Symbol-keyed properties are **hidden** from normal iteration, but they are **not private**:

| Operation | Sees symbol keys? |
|---|---|
| `Object.keys`, `Object.values`, `Object.entries`, `for...in` | No |
| `JSON.stringify`, `structuredClone` | No (both drop them) |
| `Object.getOwnPropertyNames` | No (strings only) |
| `Object.getOwnPropertySymbols` | Yes (symbols only) |
| `Reflect.ownKeys` | Yes (strings and symbols) |
| `{ ...obj }`, `Object.assign` | Yes, enumerable symbol keys are copied |

Typical uses: metadata a library attaches to objects it doesn't own, "brand" tags that mark an object as a certain kind (React elements carry a `$$typeof` property whose value is a `Symbol.for(...)` symbol), and enum values that can never be confused with plain strings (see [Objects and enums](../09-objects-and-enums/notes.md)). For real privacy use `#private` fields or closures.

### Global symbols: `Symbol.for`

`Symbol.for(key)` looks up a shared, global registry: the same key always returns the same symbol, even across files, modules and iframes (realms).

```js
console.log(Symbol.for("app.id") === Symbol.for("app.id")); // → true
console.log(Symbol.keyFor(Symbol.for("app.id")));          // → "app.id"
console.log(Symbol.keyFor(Symbol("app.id")));              // → undefined (not registered)
```

| | `Symbol("x")` | `Symbol.for("x")` |
|---|---|---|
| Identity | A new, unique symbol on every call | The same symbol for the same key, everywhere |
| The string is | Only a description | The registry key; `Symbol.keyFor(sym)` returns it |
| Across iframes / two copies of a library | Different symbols | The same symbol |
| Usable as a `WeakMap` key (ES2023) | Yes | No: it can never be garbage-collected, so it throws |
| Use it for | Keys private to one module (export it if others need it) | Protocols that independent code must agree on |

### Well-known symbols

The language looks up these symbols on your objects, so defining them customises built-in behaviour:

| Symbol | Used by | What you customise |
|---|---|---|
| `Symbol.iterator` | `for...of`, spread, destructuring, `Array.from` | How the object is iterated ([below](#the-iteration-protocols)) |
| `Symbol.asyncIterator` | `for await...of` | Async iteration ([below](#async-iterators-and-async-generators)) |
| `Symbol.toPrimitive` | `+obj`, `` `${obj}` ``, `obj + 1`, `==` | Conversion to a primitive |
| `Symbol.toStringTag` | `Object.prototype.toString` | The `X` in `[object X]` |
| `Symbol.hasInstance` | `instanceof` | What counts as an instance |
| `Symbol.species` | `map`, `filter`, `then` in subclasses | Which constructor builds derived objects |
| `Symbol.isConcatSpreadable` | `Array.prototype.concat` | Whether an object is flattened |
| `Symbol.dispose`, `Symbol.asyncDispose` | `using` / `await using` declarations | Cleanup at the end of a block (explicit resource management, new in 2025, not in every engine yet) |

```js
class Money {
  constructor(amount, currency) { this.amount = amount; this.currency = currency; }
  [Symbol.toPrimitive](hint) {          // hint: "number", "string" or "default"
    if (hint === "string") return `${this.amount.toFixed(2)} ${this.currency}`;
    return this.amount;
  }
  get [Symbol.toStringTag]() { return "Money"; }
}
const price = new Money(499, "INR");
console.log(+price);                                 // → 499          (hint "number")
console.log(`${price}`);                             // → "499.00 INR" (hint "string")
console.log(price + 1);                              // → 500          (hint "default")
console.log(Object.prototype.toString.call(price)); // → "[object Money]"

class Even {
  static [Symbol.hasInstance](value) { return Number.isInteger(value) && value % 2 === 0; }
}
console.log(4 instanceof Even, 5 instanceof Even);   // → true false
```

Without `Symbol.toPrimitive`, JavaScript calls `valueOf()` then `toString()` (or the other way round for the `"string"` hint). `Symbol.hasInstance` is also why `instanceof` can be overridden, one of the reasons it is not fully reliable (see [Prototypes and classes](../11-prototypes-and-classes/notes.md)).

## The Iteration Protocols

Two small contracts, two roles:

| | Iterable | Iterator |
|---|---|---|
| What it is | An object that can **produce** an iterator | An object that **walks** a sequence one step at a time |
| Required method | `[Symbol.iterator]()`, returning an iterator | `next()`, returning `{ value, done }` |
| Optional methods | | `return(value)` (consumer stopped early), `throw(error)` |
| Examples | Arrays, strings, `Map`, `Set`, `arguments`, `NodeList` | `arr.values()`, `map.entries()`, generator objects |
| Reusable? | Usually: each call returns a fresh iterator | No: once `done`, it stays done |

`for (const x of obj)` roughly does this:

```js
const iterator = obj[Symbol.iterator]();
let step;
while (!(step = iterator.next()).done) {
  const x = step.value;
  // loop body; on break, return or throw: iterator.return?.()
}
```

### Writing an iterator by hand

```js
const range = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        return current <= last ? { value: current++, done: false } : { value: undefined, done: true };
      },
      return() {                                   // called when the consumer stops early
        console.log("cleaning up");
        return { value: undefined, done: true };
      },
    };
  },
};

console.log([...range]);        // → [1, 2, 3]   (ran to the end: no return())
console.log(Math.max(...range)); // → 3
const [first] = range;          // → logs "cleaning up": destructuring stopped early
for (const n of range) {
  if (n === 2) break;           // → logs "cleaning up"
}
```

### `return()`: closing an iterator early

A consumer that stops before `done: true` calls the iterator's `return()` method: `break`, `return` or an exception inside `for...of`, array destructuring that doesn't take every value, and `yield*` when the outer generator is closed. Consumers that run to the end (spread, `Array.from`) don't call it. This is the hook for releasing resources: a file handle, a database cursor, an event listener. Generators implement `return()` for you and run their `finally` blocks.

### Built-in iterables and who consumes them

| Produce iterators | Consume iterables |
|---|---|
| `Array`, `String` (by code point), `Map` (`[key, value]` pairs), `Set`, typed arrays | `for...of`, `for await...of` |
| `arguments`, DOM `NodeList` | Spread in calls and array literals: `f(...it)`, `[...it]` |
| `arr.keys()` / `values()` / `entries()`, same on `Map` and `Set` | Array destructuring: `const [a, b] = it` |
| `str.matchAll(regex)`, `Intl.Segmenter` segments | `Array.from`, `new Map(it)`, `new Set(it)`, `Object.fromEntries(it)` |
| Generator objects | `Promise.all` / `allSettled` / `race` / `any`, `yield*` |

```js
console.log("a😀".split(""));          // → ["a", "\ud83d", "\ude00"] (UTF-16 code units)
console.log([..."a😀"]);               // → ["a", "😀"]                (code points)
console.log(Object.fromEntries(new Map([["k", "v"]]))); // → { k: "v" }

const values = [10, 20].values();       // an iterator, not the array
console.log([...values], [...values]);  // → [10, 20] []  (single-use)
```

> **Note:** Plain objects are **not** iterable (`{}[Symbol.iterator]` is `undefined`), so `for...of` over one throws. Iterate `Object.entries(obj)` instead, or add a `[Symbol.iterator]` method. The difference between `for...in` and `for...of` is covered in [Loops](../04-loops/notes.md).

## Generators

### `function*` and `yield`

A **generator function** (`function*`) can pause itself. Calling it does **not** run the body; it returns a **generator object**, which is both an iterator and an iterable (`gen[Symbol.iterator]() === gen`). Each `next()` runs the body until the next `yield`, pauses there, and returns `{ value, done: false }`. A `return` (or the end of the body) finishes it with `done: true`.

```js
function* countdown(n) {
  console.log("body starts");
  while (n > 0) yield n--;
  return "liftoff";
}

const gen = countdown(2);  // nothing logged yet
console.log(gen.next());   // → logs "body starts", then { value: 2, done: false }
console.log(gen.next());   // → { value: 1, done: false }
console.log(gen.next());   // → { value: "liftoff", done: true }
console.log(gen.next());   // → { value: undefined, done: true }
console.log([...countdown(3)]); // → [3, 2, 1]  (spread and for...of ignore the return value)
```

Forms: `function* f() {}`, `const f = function* () {}`, a method `*items() {}`, a computed method `*[Symbol.iterator]() {}`, and `async function*`. There are no arrow-function generators.

### Generators make iterables easy

The hand-written `range` above needs about 15 lines; a generator method does the same in three, and handles `return()` correctly for free:

```js
class Range {
  constructor(from, to, step = 1) { this.from = from; this.to = to; this.step = step; }
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i += this.step) yield i;
  }
}
const r = new Range(0, 10, 5);
console.log([...r], [...r]); // → [0, 5, 10] [0, 5, 10]  (a fresh generator every time)
```

### `yield*`: delegating to another iterable

`yield*` yields every value of another iterable (a generator, an array, a string), and evaluates to that generator's **return value**. It makes recursive walks short:

```js
const tree = { value: 1, children: [{ value: 2, children: [{ value: 3, children: [] }] }, { value: 4, children: [] }] };
function* walk(node) {               // depth-first tree traversal
  yield node.value;
  for (const child of node.children) yield* walk(child);
}
console.log([...walk(tree)]);         // → [1, 2, 3, 4]

function* inner() { yield "a"; return "inner done"; }
function* outer() {
  const result = yield* inner();      // result = "inner done"
  yield result;
  yield* ["b", "c"];
}
console.log([...outer()]);            // → ["a", "inner done", "b", "c"]
```

### Two-way communication: `next(value)`

`yield` is an expression: the value passed to the **next** `next(value)` call becomes the result of the paused `yield`. The argument of the **first** `next()` is ignored, because no `yield` is waiting yet; that first call just runs the body up to the first `yield` ("priming").

```js
function* conversation() {
  const name = yield "What is your name?";
  const lang = yield `Hi ${name}, favourite language?`;
  return `${name} likes ${lang}`;
}
const chat = conversation();
console.log(chat.next("ignored").value); // → "What is your name?"
console.log(chat.next("Sara").value);    // → "Hi Sara, favourite language?"
console.log(chat.next("JavaScript"));    // → { value: "Sara likes JavaScript", done: true }
```

| Method | Resumes the paused generator by... | Typical use |
|---|---|---|
| `next(v)` | making the paused `yield` evaluate to `v` | Iterate, send input in |
| `return(v)` | acting as if `return v` were written at the paused `yield`; `finally` blocks still run | Stop early, clean up |
| `throw(err)` | throwing `err` at the paused `yield`; a `try/catch` inside can handle it | Report an error into the generator |

### `return()` and `throw()`

```js
function* worker() {
  try {
    while (true) {
      try { yield "working"; }
      catch (err) { console.log("caught inside:", err.message); }
    }
  } finally {
    console.log("resources released");
  }
}
const w = worker();
w.next();                         // → { value: "working", done: false }
w.throw(new Error("bad input"));  // → logs "caught inside: bad input", then { value: "working", done: false }
w.return("stopped");              // → logs "resources released", then { value: "stopped", done: true }
```

If the generator does not catch the error, `throw()` rethrows it to the caller and the generator is closed: every later `next()` returns `{ value: undefined, done: true }`.

> **Note:** Before `async`/`await`, libraries such as `co` (and Redux-Saga today) ran async code with generators: the generator `yield`s a promise, the runner waits for it and calls `next(result)` or `throw(error)`. `async`/`await` is that pattern built into the language; see [async/await and fetch](../18-async-await-and-fetch/notes.md).

### Lazy and infinite sequences

A generator computes a value only when someone asks for it, so a sequence can be infinite as long as the consumer stops. Small generator helpers then form a lazy pipeline in which each value flows through every step before the next one is produced:

```js
function* naturals() { let n = 1; while (true) yield n++; }
function* take(iterable, count) {
  if (count <= 0) return;
  for (const x of iterable) {
    yield x;
    if (--count === 0) return;     // stop without pulling one extra value
  }
}
function* filter(iterable, pred) { for (const x of iterable) if (pred(x)) yield x; }
function* map(iterable, fn) { for (const x of iterable) yield fn(x); }

const evenSquares = take(map(filter(naturals(), (n) => n % 2 === 0), (n) => n * n), 3);
console.log([...evenSquares]); // → [4, 16, 36]  (only 6 naturals were ever produced)
// [...naturals()] never finishes: limit an infinite generator before spreading it

function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) { yield a; [a, b] = [b, a + b]; }
}
console.log([...take(fibonacci(), 10)].join(" ")); // → "0 1 1 2 3 5 8 13 21 34"
```

| | Array methods | Generator / iterator pipeline |
|---|---|---|
| Evaluation | Eager: each step builds a whole new array | Lazy: one value at a time through all steps |
| Memory | An intermediate array per step | Constant per step |
| Infinite or huge sources | Impossible | Fine, with `take` or an early `break` |
| `length`, index access, iterate twice | Yes | No (single pass) |
| Speed on small arrays | Usually faster | A function call per value per step |

Use generators for large, expensive, streamed or infinite data, and plain arrays for small in-memory lists.

## Async Iterators and Async Generators

### The async iteration protocol

An **async iterable** has a `[Symbol.asyncIterator]()` method returning an async iterator, whose `next()` returns a **promise** of `{ value, done }`. `for await...of` awaits each step. It works inside `async` functions and at the top level of ES modules. An `async function*` can both `await` and `yield`, which makes it the easiest way to build one.

```js
const ticker = {
  async *[Symbol.asyncIterator]() {
    for (let tick = 1; tick <= 3; tick++) { await sleep(20); yield tick; }
  },
};
for await (const tick of ticker) console.log(tick); // → 1, 2, 3 (20 ms apart)
```

`for await` also accepts a sync iterable and awaits each value in order (`for await (const v of [p1, p2])`), but that is not a replacement for `Promise.all`: if `p2` rejects while the loop is still waiting for `p1`, nothing is handling `p2` yet, and Node reports an unhandled rejection and exits even though the loop is inside `try/catch`.

### Example: a paginated API

Many APIs return a page of results plus a pointer to the next page. An async generator hides the paging and gives the caller a simple stream of items:

```js
async function* fetchAll(url, { signal } = {}) {
  let next = url;
  while (next) {
    const res = await fetch(next, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${next}`);
    const { items, nextPage } = await res.json(); // nextPage is null on the last page
    yield* items;                                  // hand the items over one by one
    next = nextPage;
  }
}

try {
  for await (const user of fetchAll("https://api.example.com/users?page=1")) {
    if (user.email.endsWith("@example.com")) {
      console.log("found", user.id);
      break;                                       // no further pages are requested
    }
  }
} catch (err) {
  console.error("listing users failed:", err);     // network errors and HTTP errors land here
}
```

Why this shape works well:

- **The consumer sets the pace.** The next page is fetched only when the loop asks for more items, so a slow consumer never builds up a backlog (pull-based backpressure).
- **Stopping early is free.** `break` calls `return()` on the generator, its `finally` blocks run and no more requests are made. `script.js` shows the second request being the last one when the loop breaks on page 2.
- **Errors flow to the consumer.** A `throw` inside the generator rejects the pending `next()`, which `for await` turns into an exception in the loop.
- **Cancelling a request already in flight** (the user navigates away while page 3 loads) needs an `AbortSignal`: `return()` is queued until the generator next reaches a `yield`, so it cannot interrupt an `await fetch(...)`.

### Other async iterables

- Node.js: readable streams, `readline` interfaces (`for await (const line of rl)`), `events.on(emitter, "data")`, `fs.promises.opendir()`.
- Browsers: `ReadableStream` (for example `response.body`) is async iterable in Chromium, Firefox and Node, but Safari has lagged behind, so check current support before relying on it in a browser.
- `Array.fromAsync(asyncIterable)` collects everything into an array (Node 22+, current browsers). Use it only for finite sources.

## Iterator Helpers (ES2025)

Until ES2025 an iterator had only `next()`. To `map` or `filter` one you either converted it to an array (eager, and impossible for infinite sources) or wrote generator helpers like `take` above. ES2025 adds methods to `Iterator.prototype`, which every built-in iterator inherits: array, `Map` and `Set` iterators, generator objects and `matchAll` results.

| Method | Returns | Behaviour |
|---|---|---|
| `map(fn)`, `filter(fn)`, `flatMap(fn)` | A new iterator | Lazy |
| `take(n)`, `drop(n)` | A new iterator | Lazy |
| `toArray()` | An array | Consumes the iterator |
| `reduce(fn, init)`, `forEach(fn)` | A value / `undefined` | Consumes the iterator |
| `some(fn)`, `every(fn)`, `find(fn)` | A value | Stop as soon as the answer is known |
| `Iterator.from(obj)` (static) | An iterator with the helpers | Wraps an iterable or an object that only has `next()` |

```js
naturals().filter((n) => n % 2 === 0).map((n) => n * n).take(3).toArray(); // → [4, 16, 36]
naturals().drop(5).take(3).toArray();                // → [6, 7, 8]
new Map([["a", 1], ["b", 2]]).keys().map((k) => k.toUpperCase()).toArray(); // → ["A", "B"]
[1, 2, 3].values().map((x) => x * 10).toArray();     // → [10, 20, 30] (arrays need .values() first)
fibonacci().find((n) => n > 50);                     // → 55

let n = 0;
const counter = { next: () => ({ value: n++, done: false }) }; // iterator-like, no helpers
Iterator.from(counter).drop(1).take(3).toArray();    // → [1, 2, 3]
```

**Support status:** Chrome and Edge 122+ (early 2024), Firefox 131+ (late 2024), Safari 18.4+ (2025) and Node.js 22+. That makes them Baseline since 2025, but not in Node 20 or older Safari, which is why `script.js` feature-detects them and falls back to the generator helpers:

```js
const hasIteratorHelpers =
  typeof Iterator === "function" && typeof Iterator.prototype.map === "function";
```

`core-js` provides a polyfill. Helpers for **async** iterators, and follow-ups such as `Iterator.concat`, are separate, newer proposals; check their status before using them.

## Common Mistakes

- **Treating symbol keys as private:** `Object.getOwnPropertySymbols` and `Reflect.ownKeys` list them, and spread copies them. Use `#private` fields for privacy.
- **Concatenating a symbol into a string:** `"id: " + sym` and `` `${sym}` `` throw; use `String(sym)` or `sym.description`.
- **Using `Symbol("x")` where two modules or library copies must agree:** each call is a new symbol. Export the symbol, or use `Symbol.for("x")`.
- **Using `for...of` on a plain object:** it is not iterable; use `Object.entries(obj)`.
- **Reusing an exhausted iterator:** `arr.values()`, `map.entries()` and generator objects are single-use; ask the iterable for a new iterator.
- **Calling the generator function inside the loop condition:** `while (!gen().next().done)` creates a new generator every time and never ends. Create it once and keep the object.
- **Expecting the first `next(value)` to deliver `value`:** the first call only starts the body.
- **Spreading or `Array.from`-ing an infinite generator:** it never finishes; apply `take` first.
- **Holding a resource in a generator without `try/finally`:** an early `break` or `return()` skips the rest of the body, so cleanup must live in `finally`.
- **Using `for await` over an array of promises instead of `Promise.all`:** a promise that rejects before the loop reaches it is an unhandled rejection.

## Key Takeaways

- `Symbol()` creates a unique, immutable primitive, mainly used as a collision-free property key; symbol keys are hidden from `Object.keys`, `for...in` and `JSON.stringify`, but not private.
- `Symbol.for(key)` returns a shared symbol from a global registry; well-known symbols (`iterator`, `asyncIterator`, `toPrimitive`, `toStringTag`, `hasInstance`) let objects customise language behaviour.
- An **iterable** has `[Symbol.iterator]()`; an **iterator** has `next()` returning `{ value, done }`, plus an optional `return()` that consumers call when they stop early.
- Generators (`function*`) return a paused generator object; `yield` pauses, `next(value)` resumes and sends a value in, `return()` and `throw()` stop it or inject an error, and `finally` blocks always run.
- Generators are lazy, so they can describe infinite or huge sequences; always limit them before collecting.
- Async generators plus `for await...of` turn paged or streamed data into a simple loop with built-in backpressure and early exit.
- ES2025 iterator helpers (`map`, `filter`, `take`, `drop`, `toArray`, `Iterator.from` and more) give every iterator lazy chaining; they need Node 22+ and 2024–2025 browsers.

## Interview Questions

### Junior (0–1 year)

**Q1. What is a Symbol in JavaScript?**
A primitive type (added in ES6) whose values are unique and immutable: `Symbol("id") === Symbol("id")` is `false`. Symbols are mainly used as object property keys that cannot collide with other keys, and they are skipped by `Object.keys`, `for...in` and `JSON.stringify`. Built-in symbols such as `Symbol.iterator` customise language behaviour.

**Q2. What is the difference between an iterable and an iterator?**
An iterable is an object with a `[Symbol.iterator]()` method, which returns an iterator. An iterator is the object that does the walking: its `next()` method returns `{ value, done }` each time it is called. Arrays, strings, `Map`s and `Set`s are iterables; `arr.values()` and generator objects are iterators (and generator objects are iterable too, returning themselves).

**Q3. Which built-in values are iterable, and which language features consume iterables?**
Arrays, strings, `Map`, `Set`, typed arrays, `arguments`, DOM `NodeList`s and the iterators returned by `keys()`, `values()`, `entries()` and `matchAll()`. Consumers are `for...of`, spread (`[...x]`, `f(...x)`), array destructuring, `Array.from`, `new Map()`/`new Set()`, `Object.fromEntries`, the `Promise` combinators and `yield*`. Plain objects are not iterable.

**Q4. What is a generator function, and what happens when you call it?**
A function declared with `function*` that can pause at each `yield` and resume later. Calling it does not run any of its body; it returns a generator object. Each call to `next()` runs the body until the next `yield` and returns `{ value, done: false }`; when the body returns, `next()` returns `{ value: returnValue, done: true }`.

**Q5. What does this print?**
```js
function* g() {
  yield 1;
  yield 2;
  return 3;
}
console.log([...g()]);
const it = g();
console.log(it.next().value, it.next().value, it.next());
```
`[1, 2]`, then `1 2 { value: 3, done: true }`. Spread and `for...of` stop when `done` is `true` and ignore the value that comes with it, so the `return` value only shows up when you call `next()` yourself.

**Q6. What is `for await...of` used for?**
Looping over an async iterable, a source whose values arrive over time: an async generator, a Node stream, or lines from a file. Each step's promise is awaited before the loop body runs. It can only be used inside an `async` function or at the top level of an ES module.

### Mid-level (2–4 years)

**Q7. How are Symbol-keyed properties different from string-keyed ones? Are they private?**
Symbol keys can't collide with any other key, and they are skipped by `Object.keys`, `Object.entries`, `for...in` and `JSON.stringify`, so they are hidden from normal iteration and serialisation. They are **not** private: `Object.getOwnPropertySymbols(obj)` and `Reflect.ownKeys(obj)` list them, spread and `Object.assign` copy them, and anyone holding the symbol can read the property. For real privacy, use class private fields (`#field`) or closures.

**Q8. What is the difference between `Symbol("x")` and `Symbol.for("x")`?**
`Symbol("x")` always creates a new, unique symbol; the string is only a description. `Symbol.for("x")` looks up a global symbol registry and returns the same symbol every time for the same key, even across modules or iframes, creating it on first use. Use `Symbol.for` when separate parts of an application must agree on one symbol; `Symbol.keyFor(sym)` returns the registry key. Registered symbols can't be used as `WeakMap` keys, because they live for ever.

**Q9. How do you make a custom object work with `for...of` and the spread operator?**
Implement the `Symbol.iterator` method: it must return an iterator, an object with a `next()` method returning `{ value, done }`. The easiest way is a generator method, `*[Symbol.iterator]() { yield ... }`, as in the `Range` class above; it also gives you a correct `return()`. Writing the iterator by hand is fine too, but then add a `return()` method if it holds resources. Arrays, strings, `Map`s and `Set`s already implement it, which is why they work with `for...of`.

**Q10. What does this print?**
```js
function* gen() {
  const x = yield 1;
  const y = yield x * 2;
  return x + y;
}
const it = gen();
console.log(it.next(10).value);
console.log(it.next(5).value);
console.log(it.next(3).value);
```
`1`, `10`, `8`. The first `next(10)` only starts the body and stops at `yield 1`; the `10` is discarded. `next(5)` makes the first `yield` evaluate to 5, so `x = 5` and the generator yields `10`. `next(3)` sets `y = 3` and the generator returns `5 + 3 = 8`.

**Q11. What happens to a generator when the `for...of` loop consuming it exits with `break`?**
The loop calls the generator's `return()` method. The generator resumes as if a `return` statement were at the paused `yield`: any `finally` blocks run, and the generator is closed (later `next()` calls return `done: true`). The same happens for a `return` or an exception in the loop body. This is why cleanup code in a generator must sit in `finally`: code after the loop inside the generator never runs when the consumer stops early.

**Q12. How does JavaScript convert an object to a primitive, and how does `Symbol.toPrimitive` change that?**
The engine first looks for `obj[Symbol.toPrimitive]` and calls it with a hint: `"number"` for maths like `+obj`, `"string"` for template literals and `String(obj)`, `"default"` for `+` with another operand and `==`. Without it, the engine calls `valueOf()` then `toString()` (reversed for the `"string"` hint) and takes the first primitive result. `Date` is the classic special case: its `"default"` hint behaves like `"string"`, so `date + 1` concatenates.

**Q13. Write an async generator that walks a paginated API. What happens if the consumer stops after the first match?**
See `fetchAll` in [Example: a paginated API](#example-a-paginated-api): loop while there is a next URL, `await` the page, `yield*` its items, then move on. When the consumer `break`s, `for await` calls `return()`, the generator's `finally` blocks run and no further pages are fetched. An in-flight request is not cancelled by `return()` (it can only run once the generator is paused at a `yield`), so pass an `AbortSignal` for real cancellation.

### Senior (5+ years)

**Q14. You are designing the data-access API of a shared client library used by many teams. Should a list operation return an array, take a callback, return an async iterator, or return a stream or Observable?**
Arrays (via a promise) are the simplest contract and right when results are small and bounded. They force the library to load everything before the caller sees anything, and break down for large or unbounded data. Callbacks invert control and make errors and early exit awkward. An async iterator is pull-based: the caller gets natural backpressure, early exit with `break`, errors through ordinary `try/catch`, and composes with `for await` without a dependency. Its limits are a single consumer, one value at a time (no built-in concurrency), and cancellation of in-flight work only through an `AbortSignal`. `ReadableStream` adds piping and byte-level backpressure for binary or text data; Observables suit push-based, multi-subscriber events but bring a library and a learning curve.

Recommendation: return an async iterable for paged or streamed data, accept an `AbortSignal`, and also offer a convenience for callers that want everything at once, such as a `listAll()` that resolves to an array (or document `Array.fromAsync(list())`). Document that iteration is single-use and that breaking early is supported and cheap.

**Q15. A Node.js service slowly runs out of database connections. You trace it to async generators that open a cursor and are consumed in many places. What went wrong, and how do you prevent it across the codebase?**
Cleanup only runs if the generator is finished or closed. The usual culprits are cleanup written after the loop instead of in `finally`, consumers that call `next()` by hand and abandon the iterator without calling `return()`, and code that races `it.next()` against a timeout and moves on without closing the iterator. An `await` that never settles (a hung query) also keeps the generator suspended for ever, holding its connection.

Fixes: put every release in `try/finally` inside the generator; consume generators only with `for await` (which closes them on `break` and on errors), or call `return()` in your own `finally` when iterating manually; give the generator an `AbortSignal` and a timeout for the awaits inside it; and add a test that breaks out early and asserts the connection was released. Where the runtime supports it, `await using` with `Symbol.asyncDispose` makes the cleanup scope-based. Recommendation: make "cleanup in `finally`, consume with `for await`" a review rule, and track open connections as a metric so a leak shows up before the pool runs dry.

**Q16. After a release, `value instanceof Widget` checks start failing in production. You find two copies of your library bundled (or objects created in an iframe). How would you design type checks that survive this?**
`instanceof` compares against one specific `Widget.prototype`, so two copies of the class (or two realms) never match. Options: duck typing (check for the methods you need), a brand with a registered symbol (`obj[Symbol.for("acme.widget")] === true`, which every copy and every realm agrees on), or a static `isWidget()` helper that checks that brand, optionally exposed through `static [Symbol.hasInstance]` so existing `instanceof` checks keep working. React uses this approach: elements carry `$$typeof` set to a `Symbol.for(...)` value. A useful side effect is security: JSON cannot contain symbols, so a server response cannot forge a valid element.

Recommendation: for values that cross package or realm boundaries, use a versioned `Symbol.for` brand plus an exported `isX()` function, keep `instanceof` for code that stays inside one module, and also deduplicate the package in the build (lockfile, `dedupe`, a bundler alias), because two copies usually mean other bugs too, such as duplicated state.

**Q17. A team wants to replace array chains with generator pipelines and ES2025 iterator helpers everywhere. The product still supports Node 20 and older Safari. What do you advise?**
Treat them as a tool for specific data, not a style rule. Lazy pipelines win for large, streamed or infinite sources and when you stop early (`find`, `take`); for the usual 50-item array, `map`/`filter` on arrays are simpler, easier to debug (you can log an intermediate array) and usually faster, because every `next()` is a function call. Iterator helpers also don't exist in Node 20 or Safari before 18.4: without a polyfill, the call throws `TypeError: ... is not a function` at runtime, only on those platforms.

Recommendation: set the supported targets (Browserslist, the Node `engines` field) and either add the `core-js` iterator-helpers polyfill or keep using small generator helpers like `take`/`map` until the targets allow the native methods. Enforce the choice with a lint rule for unsupported ES features rather than by review, and use lazy pipelines where profiling or data size justifies them.

## References

- [MDN: Symbol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
- [MDN: Symbol.toPrimitive](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive)
- [MDN: Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols)
- [MDN: Iterators and generators (guide)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_generators)
- [MDN: Generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator)
- [MDN: yield*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield*)
- [MDN: for await...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of)
- [MDN: Iterator (iterator helpers)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator)
- [MDN: Array.fromAsync()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fromAsync)
- [TC39: Iterator helpers proposal](https://github.com/tc39/proposal-iterator-helpers)
- [javascript.info: Generators](https://javascript.info/generators)
- [javascript.info: Async iteration and generators](https://javascript.info/async-iterators-generators)
