# Loops

> JavaScript · Topic 4 · Demo: [script.js](script.js) · Run with `node script.js` (no HTML page)

A loop runs the same block of code repeatedly, either a fixed number of times or until a condition becomes false. JavaScript has five loop statements: `for`, `while`, `do...while`, `for...in` (keys of an object) and `for...of` (values of an iterable), plus array methods such as `forEach`. Choosing the right one, and knowing `for...in` from `for...of`, is a classic interview topic.

## Why loops?

Without a loop, printing a line five times means writing `console.log` five times. With a loop, you write it once and say how many times it should run. Loops are also how you process every element of an array, every character of a string, or every property of an object.

## The `for` loop

Use `for` when you know how many times the loop should run, or you need the index.

```js
// for (initialisation; condition; update) { body }
for (let i = 0; i < 5; i++) {
  console.log("Sigma Web Dev");
}
// → "Sigma Web Dev" printed 5 times (i = 0, 1, 2, 3, 4)
```

How it runs:

1. **Initialisation** (`let i = 0`) runs once, before anything else.
2. **Condition** (`i < 5`) is checked before every iteration. If it is falsy, the loop ends.
3. **Body** runs.
4. **Update** (`i++`) runs after the body, then go back to step 2.

Variations:

```js
// Count down
for (let i = 3; i > 0; i--) console.log(i);        // → 3, 2, 1

// Step by 2
for (let i = 0; i <= 6; i += 2) console.log(i);    // → 0, 2, 4, 6

// Loop over an array by index
const fruits = ["apple", "mango", "kiwi"];
for (let i = 0; i < fruits.length; i++) {
  console.log(i, fruits[i]);                        // → 0 apple, 1 mango, 2 kiwi
}
```

> **Note:** Use `let` for the counter, not `const` (the update `i++` would throw `TypeError: Assignment to constant variable.`) and not `var` (see [Closures in loops](#closures-in-loops-var-vs-let)).

## The `while` loop

Use `while` when you don't know in advance how many iterations you need; the loop runs **as long as** the condition is truthy. The condition is checked **before** each iteration, so the body may run zero times.

```js
let c = 4;
while (c < 8) {
  console.log(c);
  c++;               // without this the loop would never end
}
// → 4, 5, 6, 7
```

## The `do...while` loop

`do...while` checks the condition **after** the body, so the body always runs **at least once**, even when the condition is false from the start.

```js
c = 11;
do {
  console.log(c);    // → 11  (runs once even though 11 < 10 is false)
  c++;
} while (c < 10);
```

Typical use: show a menu or ask for input at least once, then repeat while the input is invalid.

| | `while` | `do...while` |
| --- | --- | --- |
| Condition checked | Before each iteration | After each iteration |
| Minimum runs | 0 | 1 |
| Syntax ends with | `}` | `} while (condition);` (note the semicolon) |

## The `for...in` loop (keys of an object)

`for...in` iterates over the **enumerable property names (keys)** of an object, as strings. Use the key to read the value with bracket notation.

```js
let person = { Name: "Aman", Age: 20 };

for (const key in person) {
  const value = person[key];
  console.log(key + " : " + value);
}
// → Name : Aman
// → Age : 20
```

Things to know:

- Keys are always **strings**, even for arrays (`"0"`, `"1"`).
- It also visits **inherited** enumerable properties from the prototype chain. Filter with `Object.hasOwn(obj, key)` if that matters.
- Order: integer-like keys first in ascending order, then string keys in the order they were added.

```js
const o = { b: 1, 2: "two", a: 2, 1: "one" };
for (const k in o) console.log(k); // → 1, 2, b, a
```

## The `for...of` loop (values of an iterable)

`for...of` (ES6) iterates over the **values** of an **iterable**: arrays, strings, `Map`, `Set`, `arguments`, NodeLists and so on.

```js
var Name = "Aman";       // must be an iterable, such as a string or an array
for (const i of Name) {
  console.log(i);
}
// → A, m, a, n
```

The demo's comment says the value "should be string or array, can't be a number". More precisely: it must be **iterable** (it has a `Symbol.iterator` method; see [Symbols, iterators and generators](../13-symbols-iterators-generators/notes.md)). Numbers and plain objects are not iterable:

```js
// for (const d of 1234) {}           // TypeError: 1234 is not iterable
// for (const v of { a: 1 }) {}       // TypeError: ... is not iterable
```

More `for...of` examples:

```js
for (const n of [10, 20, 30]) console.log(n);       // → 10, 20, 30

// Need the index too? Use entries() with destructuring
for (const [i, v] of ["x", "y"].entries()) console.log(i, v); // → 0 x, 1 y

// Map gives [key, value] pairs
const m = new Map([["a", 1], ["b", 2]]);
for (const [k, v] of m) console.log(k, v);          // → a 1, b 2
```

## `for...in` vs `for...of`

| | `for...in` | `for...of` |
| --- | --- | --- |
| Iterates over | Keys (property names) | Values |
| Works on | Any object | Iterables only (array, string, Map, Set, ...) |
| On an array `["a","b"]` gives | `"0"`, `"1"` (strings) | `"a"`, `"b"` |
| On a plain object | Works | TypeError: not iterable |
| Includes inherited / extra properties | Yes | No |
| Introduced | ES1 | ES6 (2015) |
| Best for | Plain objects | Arrays, strings, Maps, Sets |

Why `for...in` is wrong for arrays:

```js
const arr = [10, 20];
arr.extra = "x";               // arrays are objects; this adds a property
for (const k in arr) console.log(k);  // → "0", "1", "extra"
for (const v of arr) console.log(v);  // → 10, 20
```

## Looping over objects with `for...of`

Plain objects are not iterable, but `Object.keys`, `Object.values` and `Object.entries` return arrays you can loop over. They include only the object's **own** properties.

```js
const person = { Name: "Aman", Age: 20 };

for (const key of Object.keys(person)) console.log(key);       // → Name, Age
for (const value of Object.values(person)) console.log(value); // → Aman, 20
for (const [key, value] of Object.entries(person)) {
  console.log(`${key} : ${value}`);                             // → Name : Aman, Age : 20
}
```

## `break` and `continue`

- `break` exits the loop immediately.
- `continue` skips the rest of the current iteration and moves to the next one.

```js
for (let i = 1; i <= 10; i++) {
  if (i === 3) continue;  // skip 3
  if (i === 6) break;     // stop completely at 6
  console.log(i);
}
// → 1, 2, 4, 5
```

### Labels for nested loops

A plain `break` only exits the innermost loop. A **label** lets you break out of (or continue) an outer loop.

```js
outer: for (let r = 1; r <= 3; r++) {
  for (let c = 1; c <= 3; c++) {
    if (c === 2) continue outer; // jump to the next r
    if (r === 3) break outer;    // leave both loops
    console.log(r, c);
  }
}
// → 1 1
// → 2 1
```

## `forEach` (array method)

Arrays also have a `forEach` method that calls a function for every element. It is covered with the other array methods in [Arrays](../08-arrays/notes.md).

```js
[10, 20, 30].forEach((value, index) => console.log(index, value));
// → 0 10, 1 20, 2 30
```

> **Note:** You cannot `break` out of `forEach`, and it ignores `await`. If you need either, use a `for...of` loop.

## Closures in loops: `var` vs `let`

A `let` counter gets a **fresh binding per iteration**. A `var` counter is a single variable shared by the whole function, so callbacks created in the loop all see its final value.

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var", i), 0);
}
// → var 3, var 3, var 3

for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let", j), 0);
}
// → let 0, let 1, let 2
```

The timers run after the loop has finished. With `var` there is only one `i`, which is `3` by then. With `let` each callback closes over its own `j`. Closures themselves are explained in [Closures, destructuring and spread](../12-closures-destructuring-spread/notes.md).

## Which loop should I use?

| Situation | Loop |
| --- | --- |
| Fixed number of repetitions, or you need the index | `for` |
| Repeat until something happens, count unknown | `while` |
| Body must run at least once | `do...while` |
| Values of an array, string, Map or Set | `for...of` |
| Keys of a plain object | `for...in`, or `for...of` with `Object.keys/entries` |
| Run a function for each array element, no early exit | `forEach` |
| Build a new array from an old one | `map` / `filter` (not a loop that pushes) |

## Common Mistakes

- **Infinite loops.** Forgetting the update (`c++`) in a `while`, or writing a condition that never becomes false, freezes the browser tab or the Node process.
- **Off-by-one errors.** `i <= arr.length` reads one element past the end (`undefined`). Use `i < arr.length`.
- **Using `for...in` on arrays.** You get string indexes and any extra or inherited properties. Use `for...of` or a plain `for`.
- **Using `for...of` on a plain object** throws "is not iterable". Use `Object.entries()`.
- **Declaring the classic `for` counter with `const`.** The `i++` update throws a TypeError. (`const` is fine in `for...of` and `for...in`, because each iteration gets a new binding.)
- **Removing array items while looping forward with an index.** The next element shifts into the current index and is skipped. Loop backwards, or build a new array with `filter`.
- **Expecting `break` or `await` to work inside `forEach`.**
- **Using `var` for loop counters with async callbacks** (all callbacks see the final value).

## Key Takeaways

- `for` is for counted loops, `while` for unknown counts, `do...while` when the body must run at least once.
- `for...in` gives an object's keys (as strings); `for...of` gives an iterable's values.
- Use `for...of` for arrays and strings; use `Object.keys/values/entries` with `for...of` for objects.
- `break` exits a loop, `continue` skips to the next iteration, and labels let you control outer loops.
- `let` creates a new binding per iteration, which fixes the classic "all callbacks print the last value" bug.
- `forEach` cannot be stopped early and does not wait for `await`.

## Interview Questions

### Junior (0–1 year)

**Q1. What kinds of loops does JavaScript have?**
`for`, `while`, `do...while`, `for...in` and `for...of`. Arrays also provide iteration methods such as `forEach`, `map`, `filter` and `reduce`. `for` suits counted loops, `while`/`do...while` suit condition-based loops, `for...in` walks object keys and `for...of` walks iterable values.

**Q2. What is the difference between `while` and `do...while`? What does this print?**

```js
let n = 10;
do {
  console.log(n);
  n++;
} while (n < 5);
```

It prints `10`. `while` checks its condition before each iteration, so its body can run zero times. `do...while` checks after the body, so it always runs at least once, even though `10 < 5` is false.

**Q3. What is the difference between `for...in` and `for...of`?**
`for...in` iterates over the enumerable property **keys** of any object, as strings, including inherited ones. `for...of` iterates over the **values** of an iterable such as an array, string, Map or Set. On `["a", "b"]`, `for...in` gives `"0"` and `"1"`, while `for...of` gives `"a"` and `"b"`.

**Q4. What does this print?**

```js
for (let i = 1; i <= 5; i++) {
  if (i === 2) continue;
  if (i === 4) break;
  console.log(i);
}
```

`1` and `3`. When `i` is 2, `continue` skips the `console.log`; when `i` is 4, `break` ends the loop before printing, so 4 and 5 are never logged.

**Q5. How do you loop over the properties of an object?**
Use `for...in` (and optionally filter with `Object.hasOwn`), or use `for...of` with `Object.keys(obj)`, `Object.values(obj)` or `Object.entries(obj)`. `Object.entries` with destructuring, `for (const [key, value] of Object.entries(obj))`, is the most common modern form.

**Q6. Why does `for (const x of { a: 1 })` throw an error?**
`for...of` only works on iterables, values that implement the `Symbol.iterator` method. Arrays, strings, Maps and Sets do; plain objects and numbers do not, so you get `TypeError: ... is not iterable`. Convert the object first with `Object.entries()`, `Object.keys()` or `Object.values()`.

### Mid-level (2–4 years)

**Q7. What does this print, and how do you fix it?**

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
```

It prints `3`, `3`, `3`. `var` creates a single function-scoped `i`, and the callbacks run after the loop has finished, when `i` is 3. Fix it by using `let`, which creates a new binding for each iteration (prints `0`, `1`, `2`). Before ES6 the fix was an IIFE that captured the current value as a parameter.

**Q8. Why should you avoid `for...in` on arrays?**
It returns indexes as strings, not numbers, so `i + 1` concatenates. It also visits any extra enumerable properties on the array or inherited ones (for example, if a library adds a method to `Array.prototype`), and order is not something to rely on for general objects. `for...of`, a classic `for`, or array methods are the correct tools.

**Q9. How do you exit a `forEach` early?**
You can't: `return` inside the callback only ends that one call, and `break` is a SyntaxError there. Use a `for...of` loop with `break`, or a method that stops by design: `some` (stops when the callback returns `true`), `every` (stops at `false`), `find` or `findIndex`. Throwing an exception also stops it, but that is a hack.

**Q10. You need to call an API for each user ID in an array. What is the difference between using `forEach` with `async`/`await`, `for...of` with `await`, and `Promise.all`?**
`forEach` does not wait for the promises returned by an async callback, so all requests start at once and the code after the loop runs before they finish. `for...of` with `await` runs the requests one after another, which is slower but keeps order and limits load on the server. `Promise.all(ids.map(id => fetchUser(id)))` runs them in parallel and waits for all of them; it is the fastest, but it rejects as soon as one fails (`Promise.allSettled` does not).

**Q11. What is wrong with this code that removes all `2`s from an array?**

```js
const nums = [1, 2, 2, 3];
for (let i = 0; i < nums.length; i++) {
  if (nums[i] === 2) nums.splice(i, 1);
}
console.log(nums); // → [ 1, 2, 3 ]
```

After `splice` removes the item at index 1, the second `2` shifts into index 1, but the loop moves on to index 2 and skips it. Fix it by looping backwards (`for (let i = nums.length - 1; i >= 0; i--)`), by decrementing `i` after a removal, or, best, by creating a new array: `const result = nums.filter(n => n !== 2)`.

**Q12. Which loop is the fastest?**
For typical application code the difference between `for`, `for...of` and `forEach` is negligible, because engines optimise all of them, so choose for readability. A classic `for` loop can be slightly faster in very hot code on huge arrays, and it allows early exit. Bigger wins come from avoiding unnecessary work: not re-running `filter`/`map` chains inside loops, using a `Set` for lookups instead of `includes` in nested loops, and stopping early with `break` or `some`.

### Senior (5+ years)

**Q13. Processing 100,000 rows in a loop freezes the page for three seconds. JavaScript is single-threaded, so what are your options?**
A loop on the main thread blocks painting and input until it ends; anything over about 50 ms is a "long task" and directly hurts Interaction to Next Paint (INP). Work through the options in this order:

1. **Do less work.** Replace nested `includes`/`find` with a `Set` or `Map` index, stop early, never touch the DOM per iteration (build the result and insert it once; never read layout such as `offsetHeight` in a loop that also writes styles), and render only the visible rows (virtualisation).
2. **Move pure CPU work off the main thread.** Parsing, sorting and aggregation that don't need the DOM belong in a Web Worker; transfer large `ArrayBuffer`s instead of copying them.
3. **Split work that must stay on the main thread, and yield between chunks** so the browser can paint and respond:

```js
const yieldToMain = () =>
  globalThis.scheduler?.yield ? scheduler.yield() : new Promise((resolve) => setTimeout(resolve, 0));

async function processInChunks(items, handle, budgetMs = 8) {
  let deadline = performance.now() + budgetMs;
  for (const item of items) {
    handle(item);
    if (performance.now() > deadline) {   // budget used up: let the browser paint and handle input
      await yieldToMain();
      deadline = performance.now() + budgetMs;
    }
  }
}
```

`scheduler.yield()` is new and not available in every browser yet, hence the `setTimeout` fallback. Recommendation: remove unnecessary work first, use a Worker for CPU-heavy work, and chunk with yielding only for what must touch the main thread. Why yielding works is explained in [The event loop](../19-event-loop/notes.md).

**Q14. You need to call an API for 2,000 IDs. `Promise.all` triggers rate limiting, and a sequential `for...of` with `await` takes minutes. Design a reusable helper.**
Keep a fixed number of requests in flight: N "workers" share one cursor into the array, and each takes the next item as soon as its previous request finishes.

```js
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;                          // shared cursor: safe, because JS runs one piece of code at a time
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;                        // same order as items
}

// const users = await mapWithConcurrency(ids, 5, (id) => fetchUser(id));
```

Design decisions to make explicit in the API: the **error policy** (as written it is fail-fast: the returned promise rejects on the first error, but workers that are already running finish their current request; for batch jobs return per-item `{ status, value | reason }` results like `Promise.allSettled`), **cancellation** (accept an `AbortSignal` and pass it to `fetch`), and **retries** with exponential backoff that honour `Retry-After` on 429 and 503 responses. Recommendation: one tested helper (or a well-known small library such as `p-limit`) with the concurrency limit tuned to the API's rate limit, instead of ad-hoc loops in every feature.

**Q15. Your team argues about loop style: some want `for` loops banned in favour of `map`/`filter`/`reduce` chains, others the opposite. What policy would you set?**
Choose by intent, not fashion:

| Intent | Use |
| --- | --- |
| Transform or query a collection | `map`, `filter`, `find`, `some`, `every` |
| Need `break`/`continue`, sequential `await`, or side effects | `for...of` |
| Index arithmetic, or a measured hot path | Classic `for` |
| Build a single value (sum, grouped object) | `reduce`, or `Object.groupBy` for grouping |

Avoid `reduce` where a clearer method exists (re-implementing `map` or `filter` with it), and never pass an `async` callback to `forEach`. Method chains create an intermediate array at every step: irrelevant for hundreds of items, measurable for hundreds of thousands in hot code. Iterator helpers (ES2025: `arr.values().filter(...).map(...).take(10).toArray()`) run lazily without intermediate arrays; they work in current browsers and Node 22+, but are newer than everything else here, so check your support targets.

Encode the objective rules in lint (`no-await-in-loop` as a warning, so sequential awaits are deliberate; `array-callback-return`) and leave the rest to a short written guideline. Recommendation: methods for transformations, `for...of` for control flow, and optimise loop style only where a profile shows it matters.

## References

- [MDN – Loops and iteration](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration)
- [MDN – for...in](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in)
- [MDN – for...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of)
- [MDN – do...while](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/do...while)
- [MDN – label](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/label)
- [web.dev – Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
- [MDN – Iterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator)
- [ESLint – no-await-in-loop](https://eslint.org/docs/latest/rules/no-await-in-loop)
