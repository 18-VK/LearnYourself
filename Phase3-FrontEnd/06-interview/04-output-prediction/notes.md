# Output Prediction Puzzles

> Interview · Topic 4 · Demo: [puzzles.js](puzzles.js) · Run with `node puzzles.js`

"What does this print?" questions test whether your mental model of the language matches what the engine actually does: hoisting, scope, `this`, coercion, references, and the order of tasks and microtasks. This note is a rapid revision bank grouped by topic. Each puzzle gives a snippet, the answer, a one- to three-line explanation and a link to the note that teaches the topic properly. `puzzles.js` runs every snippet (puzzles and interview questions) and prints what each one really logs under its label, so you can check yourself. The last main section lists the puzzles that already live in other notes.

## How to Use This Bank

- Cover the answer, predict the **exact** output (including errors and their order), then compare with `node puzzles.js`.
- Snippets run as a **classic, non-strict script** unless they say otherwise. In an ES module or strict-mode code, some `this` answers become `undefined` or a `TypeError`.
- Output is shown as Node prints it (`[ 1, 2 ]`). A browser console formats values differently, but the values and the order are the same.
- Work in a fixed order: declarations and hoisting, then synchronous code top to bottom, then **all** microtasks, then **one** task, then microtasks again. For coercion, convert objects to primitives first, then apply the operator's rule.

## Hoisting and the TDZ

**P1. A function declaration and a `var` with the same name**
```js
console.log(typeof foo);
var foo = 1;
function foo() {}
console.log(typeof foo);
```
**Answer:** `function`, then `number`. Function declarations are hoisted with their body; the duplicate `var foo` declaration adds nothing, but the assignment `foo = 1` still runs in order. See [Types, variables and hoisting](../../03-javascript/02-types-variables-hoisting/notes.md).

**P2. `typeof` and the TDZ**
```js
console.log(typeof notDeclaredAnywhere);
console.log(typeof later);
let later = 1;
```
**Answer:** `undefined`, then `ReferenceError: Cannot access 'later' before initialization`. `typeof` is safe on names that were never declared, but a `let`/`const` binding exists from the start of its scope and throws until its declaration runs, even inside `typeof`. See [Types, variables and hoisting](../../03-javascript/02-types-variables-hoisting/notes.md).

**P3. Default parameters**
```js
function range(start = end - 5, end = 10) {
  return [start, end];
}
console.log(range(1));
console.log(range());
```
**Answer:** `[ 1, 10 ]`, then `ReferenceError: Cannot access 'end' before initialization`. Parameters are initialised left to right, each with its own TDZ, and a default is evaluated only when the argument is missing. See [Functions](../../03-javascript/05-functions/notes.md).

## Scope and Closures in Loops

**P4. `let` declared outside the loop header**
```js
const fns = [];
let i;
for (i = 0; i < 3; i++) fns.push(() => i);
console.log(fns.map((f) => f()));
```
**Answer:** `[ 3, 3, 3 ]`. A fresh binding per iteration exists only when `let` is declared **in** the `for` header. Here every closure shares one `i`, which is 3 when they run. See [Closures, destructuring and spread](../../03-javascript/12-closures-destructuring-spread/notes.md).

**P5. Changing the loop variable inside the body**
```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));
  i++;
}
```
**Answer:** `1`, then `3`. Each iteration's binding is copied into the next one *before* the increment runs. The first binding ends at 1 (its own `i++`); the second starts at 1, becomes 2 in the header and 3 in the body, and then the loop stops. See [Loops](../../03-javascript/04-loops/notes.md).

**P6. What a closure captures**
```js
let count = 0;
const report = (() => {
  const snapshot = count;
  return () => console.log(snapshot, count);
})();
count = 5;
report();
```
**Answer:** `0 5`. A closure keeps a live reference to the **variable** `count`, so it sees 5; `snapshot` is a separate variable that copied the value when the IIFE ran. See [Closures, destructuring and spread](../../03-javascript/12-closures-destructuring-spread/notes.md).

## `this` Binding

**P7. A regular callback inside a method**
```js
const counter = {
  count: 10,
  doubled() {
    return [1, 2].map(function (n) { return n * this.count; });
  },
};
console.log(counter.doubled());
```
**Answer:** `[ NaN, NaN ]`. `map` calls the callback as a plain function, so its `this` is `globalThis` (in strict mode `undefined`, and the code throws), not `counter`; `n * undefined` is `NaN`. Use an arrow callback or `map(fn, this)`. See [this, call, apply and bind](../../03-javascript/10-this-call-apply-bind/notes.md).

**P8. Strict vs sloppy `this`**
```js
function strictWho() { 'use strict'; return this; }
function sloppyWho() { return this; }
console.log(strictWho(), strictWho.call(null), strictWho.call(2));
console.log(sloppyWho() === globalThis, typeof sloppyWho.call(2));
```
**Answer:** `undefined null 2`, then `true object`. Strict functions receive `this` exactly as passed; sloppy functions replace `null`/`undefined` with `globalThis` and box primitives into wrapper objects. See [this, call, apply and bind](../../03-javascript/10-this-call-apply-bind/notes.md).

**P9. A detached class method vs an arrow field**
```js
class Button {
  label = 'Save';
  click() { return this?.label; }
  handle = () => this.label;
}
const { click, handle } = new Button();
console.log(click(), handle());
```
**Answer:** `undefined Save`. Class bodies are always strict, so the detached `click` runs with `this === undefined` (the `?.` avoids a `TypeError`). The arrow field captured the instance when the object was created. See [Prototypes and classes](../../03-javascript/11-prototypes-and-classes/notes.md).

## Coercion and Equality

**P10. The `+` operator**
```js
console.log([] + []);
console.log([] + {});
console.log(1 + '2' - 1);
console.log('3' * '4', true + true);
```
**Answer:** an empty string, `[object Object]`, `11`, then `12 2`. `+` converts objects to primitives first (`[]` → `''`, `{}` → `'[object Object]'`) and concatenates if either side is then a string; `-` and `*` always convert to numbers. See [Operators and control flow](../../03-javascript/03-operators-and-control-flow/notes.md).

**P11. `null`, `undefined` and `NaN`**
```js
console.log(null == 0, null >= 0, null == undefined);
console.log(NaN == NaN, undefined == 0);
```
**Answer:** `false true true`, then `false false`. With `==`, `null` equals only `undefined`; relational operators such as `>=` convert `null` to 0. `NaN` is not equal to anything, itself included. See [Operators and control flow](../../03-javascript/03-operators-and-control-flow/notes.md).

**P12. `[] == ![]`**
```js
console.log([] == ![]);
console.log([0] == false, [1, 2] == '1,2', [] == 0);
```
**Answer:** `true`, then `true true true`. `![]` is `false` (every object is truthy). Comparing an object with a boolean or number converts both to numbers: `[]` → `''` → 0, `[0]` → `'0'` → 0; against a string, `[1, 2]` becomes `'1,2'`. See [Operators and control flow](../../03-javascript/03-operators-and-control-flow/notes.md).

**P13. Chained comparisons**
```js
console.log(1 < 2 < 3, 3 > 2 > 1);
```
**Answer:** `true false`. Comparisons run left to right: `(1 < 2) < 3` is `true < 3`, that is `1 < 3`; `(3 > 2) > 1` is `true > 1`, that is `1 > 1`. See [Operators and control flow](../../03-javascript/03-operators-and-control-flow/notes.md).

## `typeof` Quirks

**P14. What `typeof` really returns**
```js
console.log(typeof typeof 1, typeof NaN, typeof [], typeof class {});
console.log(typeof new Number(1), typeof Number('1'));
console.log(new Boolean(false) ? 'truthy' : 'falsy');
```
**Answer:** `string number object function`, `object number`, then `truthy`. `typeof` always returns a string; `NaN` is a number; arrays are objects and classes are functions. `new Number()` and `new Boolean()` create wrapper **objects**, and every object is truthy. See [Types, variables and hoisting](../../03-javascript/02-types-variables-hoisting/notes.md).

## Numbers and Floating Point

**P15. Converting strings to numbers**
```js
console.log(Number(''), Number(' 12 '), Number('12px'), Number(null), Number(undefined));
console.log(parseInt('12px'), parseFloat('.5.5'), parseInt(0.0000005));
```
**Answer:** `0 12 NaN 0 NaN`, then `12 0.5 5`. `Number()` converts the whole trimmed string or returns `NaN` (`''` and `null` become 0). `parseInt`/`parseFloat` read a valid prefix and stop. `parseInt(0.0000005)` first turns the number into the string `'5e-7'`. See [Types, variables and hoisting](../../03-javascript/02-types-variables-hoisting/notes.md).

**P16. `NaN` and `-0`**
```js
console.log(NaN === NaN, Object.is(NaN, NaN), [NaN].includes(NaN), [NaN].indexOf(NaN));
console.log(0 === -0, Object.is(0, -0), 1 / -0);
```
**Answer:** `false true true -1`, then `true false -Infinity`. `===` and `indexOf` use strict equality; `includes`, `Map` and `Set` use SameValueZero, where `NaN` matches itself; only `Object.is` tells `0` and `-0` apart. See [Operators and control flow](../../03-javascript/03-operators-and-control-flow/notes.md).

**P17. Rounding**
```js
console.log((1.005).toFixed(2), (1.255).toFixed(2));
console.log(Math.round(2.5), Math.round(-2.5), Math.round(-2.6));
```
**Answer:** `1.00 1.25`, then `3 -2 -3`. `1.005` is stored as `1.00499999…`, so it rounds down (likewise `1.255`). `Math.round` rounds halves towards +∞, so `-2.5` becomes `-2`. For money, calculate in integer minor units. See [Types, variables and hoisting](../../03-javascript/02-types-variables-hoisting/notes.md).

## Objects and References

**P18. Objects as object keys**
```js
const cache = {};
const a = { id: 1 };
const b = { id: 2 };
cache[a] = 'first';
cache[b] = 'second';
console.log(cache[a], Object.keys(cache));
```
**Answer:** `second [ '[object Object]' ]`. Plain-object keys are strings (or symbols), so both objects become the key `'[object Object]'` and the second write overwrites the first. Use a `Map` for object keys. See [Map, Set, WeakMap and memory](../../03-javascript/14-map-set-weakmap-memory/notes.md).

**P19. `a.x = a = {...}`**
```js
let a = { n: 1 };
const b = a;
a.x = a = { n: 2 };
console.log(a.x, b.x);
```
**Answer:** `undefined { n: 2 }`. The target `a.x` is evaluated first and pins the **old** object; then `a = { n: 2 }` runs and its value is stored on the old object's `x`. `b` is the old object. See [Pass by value and copying](../../03-javascript/06-pass-by-value-and-copying/notes.md).

**P20. Property order**
```js
const o = { b: 1, 10: 'ten', a: 2, 2: 'two', '-1': 'minus' };
console.log(Object.keys(o));
```
**Answer:** `[ '2', '10', 'b', 'a', '-1' ]`. Integer-like keys come first in ascending order, then string keys in insertion order (then symbols). `'-1'` is not an array index, so it keeps its insertion position. See [Objects and enums](../../03-javascript/09-objects-and-enums/notes.md).

## Array Method Gotchas

**P21. Default `sort`**
```js
console.log([-1, -2, 3, 10, 1].sort());
```
**Answer:** `[ -1, -2, 1, 10, 3 ]`. Without a comparator, `sort` compares values as strings: `'-1' < '-2'` because `'1' < '2'`, and `'10' < '3'`. Pass `(a, b) => a - b`. See [Arrays](../../03-javascript/08-arrays/notes.md).

**P22. `map(parseInt)` with other numbers**
```js
console.log(['1', '7', '11'].map(parseInt));
```
**Answer:** `[ 1, NaN, 3 ]`. `map` passes `(value, index)`, so the calls are `parseInt('1', 0)` (radix 0 means 10), `parseInt('7', 1)` (invalid radix) and `parseInt('11', 2)` (binary 11 is 3). Use `map(Number)`. See [Arrays](../../03-javascript/08-arrays/notes.md).

**P23. `fill` with an object**
```js
const grid = new Array(2).fill([]);
grid[0].push('x');
console.log(grid, grid[0] === grid[1]);
```
**Answer:** `[ [ 'x' ], [ 'x' ] ] true`. `fill` stores the **same** array in every slot. Use `Array.from({ length: 2 }, () => [])` to get a new array per slot. See [Arrays](../../03-javascript/08-arrays/notes.md).

## Classes and Prototypes

**P24. A base constructor calls an overridden method**
```js
class Base {
  constructor() { this.describe(); }
  describe() { console.log('base'); }
}
class Child extends Base {
  label = 'child';
  describe() { console.log('child:', this.label); }
}
new Child();
```
**Answer:** `child: undefined`. The base constructor runs before the subclass's fields are initialised, yet `this.describe()` already dispatches to `Child`'s override. Avoid calling overridable methods from constructors. See [Prototypes and classes](../../03-javascript/11-prototypes-and-classes/notes.md).

**P25. `instanceof` after replacing a prototype**
```js
function F() {}
const f = new F();
F.prototype = { reassigned: true };
console.log(f instanceof F, f.constructor === F, new F() instanceof F);
```
**Answer:** `false true true`. `instanceof` looks for the **current** `F.prototype` in the chain; `f` still links to the old prototype object, whose `constructor` still points to `F`. See [Prototypes and classes](../../03-javascript/11-prototypes-and-classes/notes.md).

## Promises and the Event Loop

**P26. Two promise chains**
```js
Promise.resolve().then(() => console.log('a1')).then(() => console.log('a2'));
Promise.resolve().then(() => console.log('b1')).then(() => console.log('b2'));
```
**Answer:** `a1 b1 a2 b2`. Each handler is queued only when the previous promise in its chain settles, so independent chains take turns, one step per microtask. See [The event loop](../../03-javascript/19-event-loop/notes.md).

**P27. A microtask queued inside a timer**
```js
setTimeout(() => {
  console.log('t1');
  Promise.resolve().then(() => console.log('p1'));
});
setTimeout(() => console.log('t2'));
```
**Answer:** `t1 p1 t2`. The microtask queue is drained after **every** task, so the promise queued in the first timer runs before the second timer (Node before v11 printed `t1 t2 p1`). See [The event loop](../../03-javascript/19-event-loop/notes.md).

**P28. Returning a promise from `then`**
```js
Promise.resolve()
  .then(() => { console.log('a'); return Promise.resolve('x'); })
  .then((v) => console.log(v));
Promise.resolve()
  .then(() => console.log('b'))
  .then(() => console.log('c'))
  .then(() => console.log('d'))
  .then(() => console.log('e'));
```
**Answer:** `a b c d x e`. Returning a promise from a handler makes the next promise *adopt* it, which costs two extra microtask ticks, so `x` arrives three steps after `a`. The tick count is an engine detail: know why it happens, never depend on it. See [Callbacks and promises](../../03-javascript/17-callbacks-and-promises/notes.md).

## `async`/`await` Ordering

**P29. `await` vs `then`**
```js
async function a() {
  console.log('a start');
  await b();
  console.log('a end');
}
async function b() { console.log('b'); }
console.log('script start');
a();
Promise.resolve().then(() => console.log('then'));
console.log('script end');
```
**Answer:** `script start`, `a start`, `b`, `script end`, `a end`, `then`. An async function runs synchronously until its first `await`. `b()` returns an already-fulfilled promise, so `a`'s continuation is queued first, before the `then` registered after it. See [Async/await and fetch](../../03-javascript/18-async-await-and-fetch/notes.md).

**P30. An async function that returns a promise**
```js
async function viaPromise() { return Promise.resolve('promise'); }
async function viaValue() { return 'value'; }
viaPromise().then(console.log);
viaValue().then(console.log);
```
**Answer:** `value`, then `promise`. Returning a promise from an async function resolves its result promise with another promise, which costs the same extra ticks as P28. This is why a "harmless" refactor can break a test that checks log order. See [The event loop](../../03-javascript/19-event-loop/notes.md).

**P31. The missing `await`**
```js
async function save() { throw new Error('disk full'); }
async function handler() {
  try {
    save();
    console.log('saved?');
  } catch (err) {
    console.log('caught', err.message);
  }
}
handler().then(() => console.log('handler done'));
```
**Answer:** `saved?`, `handler done`, then an unhandled rejection (`disk full`). Without `await`, `save()` just returns a rejected promise; `try`/`catch` only sees synchronous throws and **awaited** rejections. Node 15+ crashes the process on an unhandled rejection; browsers log "Uncaught (in promise)". See [Error handling](../../03-javascript/16-error-handling/notes.md).

## Getters and `JSON.stringify`

**P32. What `JSON.stringify` drops**
```js
console.log(JSON.stringify({ a: undefined, f() {}, n: NaN, d: new Date(0), list: [undefined, () => 1] }));
console.log(JSON.stringify({ m: new Map([[1, 2]]), s: new Set([1]) }));
console.log(JSON.stringify({ id: 1n }));
```
**Answer:** `{"n":null,"d":"1970-01-01T00:00:00.000Z","list":[null,null]}`, then `{"m":{},"s":{}}`, then `TypeError: Do not know how to serialize a BigInt`. `undefined` and functions are skipped in objects but become `null` in arrays; `NaN` becomes `null`; `Date` has a `toJSON`; `Map`/`Set` have no own enumerable properties. See [JSON and XML](../../03-javascript/25-json-and-xml/notes.md).

**P33. Getters and `toJSON`**
```js
const account = {
  balance: 100,
  get doubled() { return this.balance * 2; },
  toJSON() { return { balance: this.balance }; },
};
account.balance = 50;
console.log(account.doubled, JSON.stringify(account));
```
**Answer:** `100 {"balance":50}`. A getter runs on every read, so it sees the new balance; `toJSON` replaces the object during serialisation, so the getter's value is not included. See [JSON and XML](../../03-javascript/25-json-and-xml/notes.md).

**P34. Assigning to a getter, then spreading**
```js
const temp = { celsius: 20, get fahrenheit() { return this.celsius * 9 / 5 + 32; } };
temp.fahrenheit = 100;
const copy = { ...temp };
temp.celsius = 30;
console.log(temp.fahrenheit, copy.fahrenheit);
```
**Answer:** `86 68`. Assigning to a getter-only property is silently ignored in sloppy mode (a `TypeError` in strict code). Spread **reads** the getter once and stores a plain value, so `copy` never updates. See [Objects and enums](../../03-javascript/09-objects-and-enums/notes.md).

## Puzzles Elsewhere in These Notes

| Note | Questions and what they test |
|---|---|
| [How JavaScript runs](../../03-javascript/01-how-js-runs/notes.md#interview-questions) | Q9 sync code, a timer and a promise (`A D C B`); Q14 an implicit global and `this` in a classic script vs an ES module |
| [Types, variables and hoisting](../../03-javascript/02-types-variables-hoisting/notes.md#interview-questions) | Q4 `var` and `let` read before declaration; Q8 a shadowing `let` in the TDZ; Q13 `var` vs `let` inside an `if` block |
| [Operators and control flow](../../03-javascript/03-operators-and-control-flow/notes.md#interview-questions) | Q2 `"5" + 3` vs `"5" - 3`; Q7 `[] == ![]`; Q8 `null >= 0`; Q11 `x++ + ++x`; Q13 `switch` compares with `===` |
| [Loops](../../03-javascript/04-loops/notes.md#interview-questions) | Q2 `do...while` runs once; Q4 `continue` and `break`; Q7 `var` in a loop with `setTimeout` |
| [Functions](../../03-javascript/05-functions/notes.md#interview-questions) | Q2 declaration vs expression hoisting; Q7 regular vs arrow method `this`; Q9 an IIFE vs `setTimeout` |
| [Pass by value and copying](../../03-javascript/06-pass-by-value-and-copying/notes.md#interview-questions) | Q2–Q4 primitive vs object parameters, mutating vs reassigning; Q6 spread copies only one level |
| [Strings and regex](../../03-javascript/07-strings-and-regex/notes.md#interview-questions) | Q4 assigning to `s[0]`; Q9 `replace` changes only the first match |
| [Arrays](../../03-javascript/08-arrays/notes.md#interview-questions) | Q6 `delete` leaves a hole; Q7 default `sort` on numbers; Q10 `map(parseInt)`; Q18 `new Array(5).map(...)` |
| [this, call, apply and bind](../../03-javascript/10-this-call-apply-bind/notes.md#interview-questions) | Q7 method, arrow, nested arrow and detached method; Q9 binding twice; Q12 `new` on a bound function and `call` precedence |
| [Prototypes and classes](../../03-javascript/11-prototypes-and-classes/notes.md#interview-questions) | Q7 changing a prototype property after creating instances; Q8 an array shared through `Object.create` |
| [Closures, destructuring and spread](../../03-javascript/12-closures-destructuring-spread/notes.md#interview-questions) | Q6 destructuring with holes, defaults and rest; Q7 `var` loop and `setTimeout`; Q8 shallow spread; Q11 defaults with `null` vs `undefined` |
| [Symbols, iterators and generators](../../03-javascript/13-symbols-iterators-generators/notes.md#interview-questions) | Q5 spreading a generator that `return`s; Q10 values passed to `next()` |
| [Map, Set, WeakMap and memory](../../03-javascript/14-map-set-weakmap-memory/notes.md#interview-questions) | Q6 object, `NaN` and `'1'` keys in a `Map` |
| [Modules](../../03-javascript/15-modules/notes.md#interview-questions) | Q7 live ES module bindings vs a CommonJS copy |
| [Error handling](../../03-javascript/16-error-handling/notes.md#interview-questions) | Q9 `return` in `finally` swallows an error |
| [Callbacks and promises](../../03-javascript/17-callbacks-and-promises/notes.md#interview-questions) | Q5 `A D C B`; Q8 nested `then`, `setTimeout` and `queueMicrotask`; Q12 the executor runs synchronously |
| [Async/await and fetch](../../03-javascript/18-async-await-and-fetch/notes.md#interview-questions) | Q7 code before and after `await` |
| [The event loop](../../03-javascript/19-event-loop/notes.md#interview-questions) | Q6 microtasks queued inside timer tasks; Q9 nested async functions with `await null` |
| [DOM tree navigation](../../03-javascript/21-dom-tree-navigation/notes.md#interview-questions) | Q3 `firstChild` is a whitespace text node |
| [DOM selecting](../../03-javascript/22-dom-selecting/notes.md#interview-questions) | Q5 `querySelectorAll` vs `getElementsByTagName` counts |
| [DOM manipulation](../../03-javascript/23-dom-manipulation/notes.md#interview-questions) | Q4 `tagName` vs `nodeName` on a text node |
| [Events and delegation](../../03-javascript/24-events-and-delegation/notes.md#interview-questions) | Q9 capture and bubble listener order; Q11 `A D C B` |
| [Functional patterns](../../03-javascript/26-functional-patterns/notes.md#interview-questions) | Q5 `compose` vs `pipe` order |
| [Grid](../../02-css/14-grid/notes.md#interview-questions) | Q5 two items placed in the same named area |
| [Media and container queries](../../02-css/15-media-and-container-queries/notes.md#interview-questions) | Q5 what the demo looks like on a 400px phone |
| [Custom properties](../../02-css/16-custom-properties/notes.md#interview-questions) | Q7 a variable that is invalid at computed-value time |
| [Transforms](../../02-css/17-transforms/notes.md#interview-questions) | Q3 two `transform` declarations on one rule |
| [Object-fit and filters](../../02-css/20-object-fit-and-filters/notes.md#interview-questions) | Q4 `background-size: 300px` tiles the image |

## Common Mistakes

- **Treating `async` as "runs later".** An async function runs synchronously until its first `await`.
- **Treating `setTimeout(fn, 0)` as "next".** Every pending microtask runs first, including ones queued by other microtasks.
- **Assuming closures copy values.** They capture variables, which may change before the closure runs.
- **Forgetting where per-iteration bindings come from:** only `let`/`const` declared in the `for` header get a fresh copy each iteration.
- **Deciding `this` from where a regular function is written.** Only arrow functions do that; for regular functions the call site decides, and class bodies are strict.
- **Applying one rule to every operator.** `+` concatenates as soon as one side is a string after conversion; `-`, `*`, `/` and relational operators convert to numbers; `==` with `null` does not convert at all.
- **Forgetting the extra arguments** that array callbacks receive (`value, index, array`).
- **Expecting `JSON.stringify` to round-trip** `undefined`, functions, `Map`, `Set`, `Date` or `BigInt`.
- **Ignoring the environment.** Top-level `this`, `var` creating `window` properties, strict mode in modules and old Node timer ordering all change answers; state your assumption out loud.

## Key Takeaways

- Order of execution: hoisting, then synchronous code, then all microtasks, then one task, then microtasks again.
- Coercion: objects become primitives first (`valueOf`/`toString`), then the operator applies its own rule.
- `this` is set by the call for regular functions and by the surrounding scope for arrow functions.
- Three equality algorithms: `===` (`NaN` never equal), SameValueZero (`includes`, `Map`, `Set`) and `Object.is` (also separates `0` and `-0`).
- References explain most object puzzles: shared arrays from `fill` or prototypes, assignment targets evaluated before values, getters copied as values.
- In an interview, narrate the steps; a clear trace with one slip scores better than a silent correct guess.

## Interview Questions

### Junior (0–1 year)

**Q1. What does this print?**
```js
console.log('b' + 'a' + +'a' + 'a');
```
`baNaNa`. `+'a'` is the unary plus, which converts `'a'` to a number, `NaN`; concatenation then turns it into the string `'NaN'`. Add `.toLowerCase()` and you get `banana`.

**Q2. What does this print?**
```js
console.log('10' < '9', 10 < '9', 'a' < 'B', 'apple' < 'apricot');
```
`true false false true`. Two strings compare character by character by UTF-16 code unit, so `'1' < '9'` decides the first. With a number on one side, the string is converted: `10 < 9` is false. Uppercase letters have lower codes than lowercase (`'B'` is 66, `'a'` is 97). For user-facing sorting, use `localeCompare` or `Intl.Collator`.

**Q3. What does this print?**
```js
console.log([1, 2, 3] + [4, 5], [] + 1, [2] * [3]);
```
`1,2,34,5 1 6`. Arrays convert to strings by joining with commas, so `+` concatenates `'1,2,3'` and `'4,5'`, and `[] + 1` is `'' + 1`, the string `'1'`. `*` converts both sides to numbers: `[2]` → `'2'` → 2.

**Q4. What does this print?**
```js
function a(x, y) {}
function b(x, y = 2, z) {}
function c(...args) {}
const d = (x, { y } = {}) => {};
console.log(a.length, b.length, c.length, d.length);
```
`2 1 0 1`. A function's `length` counts the parameters before the first one with a default value or a rest parameter. Utilities that read it, such as a generic `curry`, break on such functions ([Polyfills](../03-polyfills/notes.md)).

**Q5. What does this print?**
```js
console.log(Math.max([1, 2, 3]), Math.max(...[1, 2, 3]));
console.log(Math.max(), Math.min() > Math.max());
```
`NaN 3`, then `-Infinity true`. `Math.max` takes separate arguments; an array argument is converted to a number (`'1,2,3'` → `NaN`), so spread it. With no arguments `max` returns `-Infinity` and `min` returns `Infinity`, the starting values for those operations. For very large arrays, spreading can exceed the engine's argument limit; use `reduce`.

**Q6. What does this print?**
```js
const list = [10, 20, 30];
console.log(list[-1], list.at(-1), list.includes('10'), list.indexOf(30));
```
`undefined 30 false 2`. `list[-1]` reads a property named `'-1'`, which does not exist; `at()` supports negative indexes. `includes` uses SameValueZero, which never converts types, so the string `'10'` is not found.

### Mid-level (2–4 years)

**Q7. What does this print?**
```js
class User {
  #password = 'secret';
  constructor(name) { this.name = name; }
  get initials() { return this.name[0]; }
}
const u = new User('Ada');
console.log(JSON.stringify(u), Object.keys(u), u.initials, 'initials' in u);
```
`{"name":"Ada"} [ 'name' ] A true`. Class getters live on the prototype, and `JSON.stringify` and `Object.keys` see only own enumerable properties; private fields are invisible to both. `in` checks the whole prototype chain. To include derived values in JSON, add a `toJSON()` method.

**Q8. What does this print?**
```js
const missing = null;
const partial = {};
console.log(missing?.load().data);
console.log(partial.load?.().data);
console.log(partial?.load());
```
`undefined`, `undefined`, then `TypeError: partial?.load is not a function`. When `?.` meets `null` or `undefined` it short-circuits the **whole** rest of the chain, so `.load().data` never runs. `?.()` checks that the function exists before calling it. In the last line `?.` only guards `partial`, which exists, so the missing `load` is still called.

**Q9. What does this print?**
```js
let calls = 0;
const next = () => ++calls;
const { a = next(), b = next(), c = next() } = { a: 'given', b: undefined };
console.log(a, b, c, calls);
```
`given 1 2 2`. Default expressions are evaluated lazily, left to right, and only when the value is `undefined` (a missing property counts as `undefined`). So `next()` runs for `b` and `c` but not for `a`, which means a default may safely be an expensive call.

**Q10. What does this print in Node or Chrome?**
```js
console.log([3, 1, 2].sort((a, b) => a > b));
console.log([3, 1, 2].sort((a, b) => a - b));
```
`[ 3, 1, 2 ]`, then `[ 1, 2, 3 ]`. A comparator must return a negative number, zero or a positive number. A boolean becomes 1 or 0, never negative, so the engine is never told that an element belongs before another. The specification calls this an inconsistent comparator and the result is implementation-defined: V8 leaves this array unchanged, other engines and longer arrays behave differently. Return `a - b` for numbers and `a.localeCompare(b)` for strings.

**Q11. What does this print?**
```js
const id = Symbol('id');
console.log(String(id), id.description);
console.log(`${id}`);
```
`Symbol(id) id`, then `TypeError: Cannot convert a Symbol value to a string`. Explicit `String(symbol)` is allowed, but implicit conversion (a template literal, `+ ''`) throws, so a symbol can never silently become an ordinary string key. See [Symbols, iterators and generators](../../03-javascript/13-symbols-iterators-generators/notes.md).

**Q12. In what order does this log?**
```js
const slow = new Promise((resolve) =>
  setTimeout(() => { console.log('slow finished'); resolve('slow'); }, 20));
Promise.all([slow, Promise.reject(new Error('fast fail'))])
  .then(() => console.log('all done'))
  .catch((err) => console.log('caught', err.message));
```
`caught fast fail`, then `slow finished`. `Promise.all` rejects as soon as one input rejects, but it cannot cancel the others: the slow work still runs, and its result is ignored. To stop it, pass an `AbortSignal` to each task and abort when one fails.

### Senior (5+ years)

**Q13. Users west of UTC report that birthdays and due dates show one day early. The API sends `"2024-01-15"`. What does this print for a user in New York, and how do you fix it for the whole app?**
```js
const fromApi = new Date('2024-01-15');      // date-only string
const local = new Date('2024-01-15T00:00');  // date-time without an offset
console.log(fromApi.getDate(), local.getDate());
console.log(fromApi.toISOString(), local.toISOString());
```
`14 15`, then `2024-01-15T00:00:00.000Z 2024-01-15T05:00:00.000Z`. A date-only ISO string is parsed as **UTC** midnight, which is still the 14th in New York, while a date-time string without an offset is parsed as **local** time; the inconsistency is kept for web compatibility. A calendar date is not an instant, so do not put it in a `Date`. Keep date-only values as `YYYY-MM-DD` strings or `Temporal.PlainDate` (Temporal has started shipping in browsers; a polyfill covers the rest), format them with `Intl.DateTimeFormat` and `timeZone: 'UTC'` if you must use `Date`, and send real instants with an explicit offset (`Z`). Recommendation: one shared date module that owns parsing and formatting, a lint rule against `new Date(string)` elsewhere, and CI tests run with `TZ` set to zones on both sides of UTC.

**Q14. The API returns users sorted by name, keyed by ID. What does this print, and what would you change in the contract?**
```js
const usersById = JSON.parse('{"20":"Ann","b7":"Raj","100":"Zoe"}');
console.log(Object.values(usersById));
```
`[ 'Ann', 'Zoe', 'Raj' ]`. JavaScript orders integer-like keys first, ascending, then string keys in insertion order, so the server's ordering is lost as soon as the JSON is parsed. JSON itself does not promise object key order either, and other clients may not keep it (Swift's `Dictionary`, for example, is unordered). Put ordered data in arrays (`[{ "id": 20, "name": "Ann" }, ...]`); on the client, normalise it into an `ids` array plus a lookup `Map` or object when you need fast access by ID. Recommendation: make "objects are unordered" an explicit API guideline, and add a contract test that fails if an endpoint relies on key order.

**Q15. A feature flag read from environment variables cannot be switched off. What does this print, and how do you prevent this class of bug?**
```js
const env = { NEW_CHECKOUT: 'true', BETA_SEARCH: 'false', MAX_ITEMS: '0' }; // env values are strings
console.log(env.NEW_CHECKOUT == true, Boolean(env.BETA_SEARCH), Boolean(env.MAX_ITEMS));
if (env.BETA_SEARCH) console.log('beta search is ON');
```
`false true true`, then `beta search is ON`. `'true' == true` converts both sides to numbers (`NaN == 1`), and any non-empty string, including `'false'` and `'0'`, is truthy. Environment variables, query parameters, `localStorage` and `dataset` values are always strings. Parse configuration once, at the boundary, with explicit rules (`value === 'true'`, `Number.parseInt(value, 10)` plus range checks) or a schema validator, fail fast at startup on invalid values, and hand the rest of the app a typed config object. Recommendation: a single config module with tests for every flag, plus the `eqeqeq` lint rule so loose comparisons cannot hide the problem again.

## References

- [MDN: Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness)
- [MDN: Type coercion](https://developer.mozilla.org/en-US/docs/Glossary/Type_coercion)
- [MDN: this](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)
- [MDN: Using microtasks in JavaScript with queueMicrotask()](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide)
- [MDN: Array.prototype.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
- [MDN: JSON.stringify()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
- [MDN: Date.parse()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse)
- [Jake Archibald: Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/)
- [V8 blog: Faster async functions and promises](https://v8.dev/blog/fast-async)
