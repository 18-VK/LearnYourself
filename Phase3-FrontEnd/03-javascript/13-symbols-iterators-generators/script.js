// Symbols, Iterators and Generators
// Run with: node script.js   (Node 20+; section 13 uses iterator helpers when the runtime has them)

const section = (title) => console.log(`\n=== ${title} ===`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── 1. Symbols are unique primitives ────────────────────────────────────────
section("1. Symbols are unique primitives");
const id = Symbol("id"); // "id" is only a description, for debugging
console.log(typeof id); // symbol
console.log(Symbol("id") === Symbol("id")); // false
console.log(id.description, String(id)); // id Symbol(id)
try {
  new Symbol();
} catch (e) {
  console.log(`${e.name}: ${e.message}`); // TypeError: Symbol is not a constructor
}
try {
  console.log(`key: ${id}`);
} catch (e) {
  console.log(`${e.name}: ${e.message}`); // TypeError: Cannot convert a Symbol value to a string
}

// ─── 2. Symbol keys are hidden, not private ──────────────────────────────────
section("2. Symbol keys are hidden, not private");
const user = { name: "Sara", [id]: 101 }; // computed key in [ ]
console.log(user[id]); // 101
console.log(Object.keys(user)); // [ 'name' ]
console.log(JSON.stringify(user)); // {"name":"Sara"}
for (const key in user) console.log("for...in sees:", key); // name
console.log(Object.getOwnPropertySymbols(user)); // [ Symbol(id) ]
console.log(Reflect.ownKeys(user)); // [ 'name', Symbol(id) ]
console.log({ ...user }[id]); // 101: spread and Object.assign DO copy symbol keys
console.log(structuredClone(user)[id]); // undefined: structuredClone drops them

// ─── 3. The global symbol registry ───────────────────────────────────────────
section("3. Symbol.for and Symbol.keyFor");
console.log(Symbol.for("app.id") === Symbol.for("app.id")); // true
console.log(Symbol.keyFor(Symbol.for("app.id"))); // app.id
console.log(Symbol.keyFor(id)); // undefined: id is not in the registry

// ─── 4. Well-known symbols ───────────────────────────────────────────────────
section("4. Well-known symbols");
class Money {
  constructor(amount, currency) {
    this.amount = amount;
    this.currency = currency;
  }
  [Symbol.toPrimitive](hint) {
    if (hint === "string") return `${this.amount.toFixed(2)} ${this.currency}`;
    return this.amount; // "number" and "default"
  }
  get [Symbol.toStringTag]() {
    return "Money";
  }
}
const price = new Money(499, "INR");
console.log(+price); // 499 (hint "number")
console.log(`${price}`); // 499.00 INR (hint "string")
console.log(price + 1); // 500 (hint "default")
console.log(Object.prototype.toString.call(price)); // [object Money]
console.log(Object.prototype.toString.call(new Map())); // [object Map]

class Even {
  static [Symbol.hasInstance](value) {
    return Number.isInteger(value) && value % 2 === 0;
  }
}
console.log(4 instanceof Even, 5 instanceof Even); // true false

// ─── 5. The iteration protocol by hand ───────────────────────────────────────
section("5. The iteration protocol by hand");
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
      return() {
        console.log("  range: return() called, cleaning up");
        return { value: undefined, done: true };
      },
    };
  },
};
console.log([...range]); // [ 1, 2, 3 ]  (ran to the end: no return())
console.log(Math.max(...range)); // 3
const [first] = range; // destructuring stopped early: return() is called
console.log("first:", first); // first: 1
for (const n of range) {
  if (n === 2) break; // break: return() is called
}
const it = range[Symbol.iterator]();
console.log(it.next(), it.next(), it.next(), it.next());
// { value: 1, done: false } { value: 2, done: false } { value: 3, done: false } { value: undefined, done: true }

// ─── 6. Built-in iterables ───────────────────────────────────────────────────
section("6. Built-in iterables");
console.log("a😀".split(""), [..."a😀"]); // [ 'a', '\ud83d', '\ude00' ] [ 'a', '😀' ]
for (const [key, value] of new Map([["a", 1], ["b", 2]])) console.log(key, value); // a 1, b 2
console.log([...new Set([1, 1, 2])]); // [ 1, 2 ]
console.log([...["x", "y"].entries()]); // [ [ 0, 'x' ], [ 1, 'y' ] ]
console.log(Object.fromEntries(new Map([["k", "v"]]))); // { k: 'v' }
const values = [10, 20].values();
console.log([...values], [...values]); // [ 10, 20 ] []  (an iterator is single-use)
console.log(typeof {}[Symbol.iterator]); // undefined: plain objects are not iterable

// ─── 7. Generators: function* and yield ──────────────────────────────────────
section("7. Generators: function* and yield");
function* countdown(n) {
  console.log("  countdown body starts");
  while (n > 0) yield n--;
  return "liftoff";
}
const gen = countdown(2); // nothing printed: the body has not started
console.log("generator created");
console.log(gen.next()); // body starts, then { value: 2, done: false }
console.log(gen.next()); // { value: 1, done: false }
console.log(gen.next()); // { value: 'liftoff', done: true }
console.log(gen.next()); // { value: undefined, done: true }
console.log([...countdown(3)]); // [ 3, 2, 1 ]  (the return value is not included)
console.log(gen[Symbol.iterator]() === gen); // true: a generator is its own iterator

// ─── 8. Generator methods and yield* ─────────────────────────────────────────
section("8. Generator methods and yield*");
class Range {
  constructor(from, to, step = 1) {
    this.from = from;
    this.to = to;
    this.step = step;
  }
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i += this.step) yield i;
  }
}
const r = new Range(0, 10, 5);
console.log([...r], [...r]); // [ 0, 5, 10 ] [ 0, 5, 10 ]  (an iterable: fresh iterator each time)

const tree = {
  value: 1,
  children: [
    { value: 2, children: [{ value: 3, children: [] }] },
    { value: 4, children: [] },
  ],
};
function* walk(node) {
  yield node.value;
  for (const child of node.children) yield* walk(child);
}
console.log([...walk(tree)]); // [ 1, 2, 3, 4 ]

function* inner() {
  yield "a";
  return "inner done";
}
function* outer() {
  const result = yield* inner(); // yield* evaluates to the delegate's return value
  yield result;
  yield* ["b", "c"]; // any iterable can be delegated to
}
console.log([...outer()]); // [ 'a', 'inner done', 'b', 'c' ]

// ─── 9. Two-way communication with next(value) ───────────────────────────────
section("9. Two-way communication with next(value)");
function* conversation() {
  const name = yield "What is your name?";
  const lang = yield `Hi ${name}, favourite language?`;
  return `${name} likes ${lang}`;
}
const chat = conversation();
console.log(chat.next("ignored").value); // What is your name?  (the first argument is ignored)
console.log(chat.next("Sara").value); // Hi Sara, favourite language?
console.log(chat.next("JavaScript")); // { value: 'Sara likes JavaScript', done: true }

function* runningTotal() {
  let total = 0;
  while (true) total += yield total;
}
const totals = runningTotal();
totals.next(); // "prime" it: run to the first yield
console.log(totals.next(5).value, totals.next(10).value); // 5 15

// ─── 10. return() and throw() ────────────────────────────────────────────────
section("10. return() and throw()");
function* worker() {
  try {
    while (true) {
      try {
        yield "working";
      } catch (err) {
        console.log("  caught inside the generator:", err.message);
      }
    }
  } finally {
    console.log("  finally: resources released");
  }
}
const w = worker();
console.log(w.next().value); // working
console.log(w.throw(new Error("bad input")).value); // caught inside..., then working
console.log(w.return("stopped")); // finally..., then { value: 'stopped', done: true }
console.log(w.next()); // { value: undefined, done: true }

function* fragile() {
  yield 1;
  yield 2;
}
const f = fragile();
f.next();
try {
  f.throw(new Error("boom")); // not caught inside: it comes back out to the caller
} catch (e) {
  console.log("caller got:", e.message); // caller got: boom
}
console.log(f.next()); // { value: undefined, done: true }  (the generator is closed)

// ─── 11. Lazy and infinite sequences ─────────────────────────────────────────
section("11. Lazy and infinite sequences");
function* naturals() {
  let n = 1;
  while (true) yield n++;
}
function* take(iterable, count) {
  if (count <= 0) return;
  for (const x of iterable) {
    yield x;
    if (--count === 0) return; // stop without pulling one extra value
  }
}
function* filter(iterable, predicate) {
  for (const x of iterable) if (predicate(x)) yield x;
}
function* map(iterable, fn) {
  for (const x of iterable) yield fn(x);
}
let squared = 0;
const evenSquares = take(
  map(filter(naturals(), (n) => n % 2 === 0), (n) => (squared++, n * n)),
  3,
);
console.log([...evenSquares], "squares computed:", squared); // [ 4, 16, 36 ] squares computed: 3

function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
console.log([...take(fibonacci(), 10)].join(" ")); // 0 1 1 2 3 5 8 13 21 34
// [...naturals()] would never finish: always limit an infinite generator first.

// ─── 12. Async iterators and async generators ────────────────────────────────
// A fake paginated API: every page says where the next one is (null on the last page).
const PAGES = {
  1: { items: ["ana", "ben"], nextPage: 2 },
  2: { items: ["chen", "dev"], nextPage: 3 },
  3: { items: ["eva"], nextPage: null },
};
async function fakeFetchPage(page) {
  await sleep(30);
  console.log(`  GET /users?page=${page}`);
  return PAGES[page];
}

async function* fetchAllUsers() {
  let page = 1;
  try {
    while (page) {
      const { items, nextPage } = await fakeFetchPage(page);
      yield* items; // hand the page's items over one at a time
      page = nextPage;
    }
  } finally {
    console.log("  fetchAllUsers: closed");
  }
}

async function asyncDemos() {
  section("12. Async generators: a paginated API");
  for await (const name of fetchAllUsers()) console.log(name); // 3 requests, 5 names

  console.log("-- stop at the first match --");
  for await (const name of fetchAllUsers()) {
    console.log("checking", name);
    if (name === "chen") break; // return(): finally runs, page 3 is never requested
  }

  console.log("-- a custom async iterable --");
  const ticker = {
    async *[Symbol.asyncIterator]() {
      for (let tick = 1; tick <= 3; tick++) {
        await sleep(20);
        yield tick;
      }
    },
  };
  for await (const tick of ticker) console.log("tick", tick);

  console.log("-- for await over a sync iterable of promises --");
  for await (const v of [Promise.resolve("p1"), "plain", sleep(10).then(() => "p2")]) console.log(v);

  if (typeof Array.fromAsync === "function") {
    console.log("Array.fromAsync:", await Array.fromAsync(ticker)); // [ 1, 2, 3 ]
  } else {
    console.log(`Array.fromAsync is not available in Node ${process.version} (Node 22+)`);
  }
}

// ─── 13. Iterator helpers (ES2025) ───────────────────────────────────────────
function iteratorHelperDemos() {
  section("13. Iterator helpers (ES2025)");
  const hasIteratorHelpers =
    typeof Iterator === "function" && typeof Iterator.prototype.map === "function";

  if (!hasIteratorHelpers) {
    console.log(`Iterator helpers are not available in Node ${process.version} (they need Node 22+).`);
    console.log("Same pipeline with the generators from section 11:");
    console.log([...take(map(filter(naturals(), (n) => n % 2 === 0), (n) => n * n), 3)]); // [ 4, 16, 36 ]
    return;
  }

  const result = naturals()
    .filter((n) => n % 2 === 0)
    .map((n) => n * n)
    .take(3)
    .toArray();
  console.log(result); // [ 4, 16, 36 ]
  console.log(naturals().drop(5).take(3).toArray()); // [ 6, 7, 8 ]
  console.log([1, 2, 3].values().map((x) => x * 10).toArray()); // [ 10, 20, 30 ]
  console.log(new Map([["a", 1], ["b", 2]]).keys().map((k) => k.toUpperCase()).toArray()); // [ 'A', 'B' ]
  console.log(fibonacci().find((n) => n > 50)); // 55 (stops as soon as it finds one)
  console.log(fibonacci().take(5).reduce((sum, n) => sum + n, 0)); // 7 (0 + 1 + 1 + 2 + 3)

  // Iterator.from: give an iterator-like object (only next()) the helper methods
  let n = 0;
  const counter = { next: () => ({ value: n++, done: false }) };
  console.log(Iterator.from(counter).drop(1).take(3).toArray()); // [ 1, 2, 3 ]
}

// Run the async part, then the helpers, so the output follows the order of the note.
(async () => {
  await asyncDemos();
  iteratorHelperDemos();
})();
