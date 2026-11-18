# Map, Set, WeakMap and Memory Management

> JavaScript · Topic 14 · Demo: [script.js](script.js) · Run with `node script.js` (no HTML page); `node --expose-gc script.js` also runs the WeakRef section

`Map` and `Set` are the keyed collections JavaScript gained in ES2015 because plain objects and arrays are poor dictionaries and poor sets: object keys are always strings, objects inherit keys you never added, and checking "is this in the list?" with an array is a linear scan. `WeakMap` and `WeakSet` are their garbage-collector-friendly versions, which let you attach data to an object without keeping that object alive. That leads straight into how garbage collection works, why front-end apps still leak memory, and how to find a leak with DevTools. This note covers all of it, including the ES2025 set methods (`union`, `intersection` and friends).

## Map

A `Map` holds key/value pairs, remembers insertion order, and accepts **any value** as a key: objects, functions, `NaN`, numbers and strings are all distinct keys.

```js
const user = { id: 1 };
const meta = new Map([
  [user, 'an object key'],
  [NaN, 'NaN works as a key'],
  [1, 'the number 1'],
  ['1', 'the string "1"'],
]);

meta.get(user);       // → 'an object key'
meta.get({ id: 1 });  // → undefined (a different object: object keys compare by identity)
meta.get(NaN);        // → 'NaN works as a key'
meta.get(1);          // → 'the number 1' (1 and '1' are different keys)
meta.size;            // → 4
```

| Method / property | What it does |
|---|---|
| `map.set(key, value)` | Adds or replaces; returns the map, so calls chain |
| `map.get(key)` | The value, or `undefined` |
| `map.has(key)` / `map.delete(key)` | Membership test / removal (returns `true` if something was removed) |
| `map.size` | Number of entries, O(1) |
| `map.clear()` | Removes everything |
| `map.keys()`, `map.values()`, `map.entries()`, `for (const [k, v] of map)` | Iterate in insertion order |
| `map.forEach((value, key) => ...)` | Note the order: value first, like arrays |

Keys are compared with **SameValueZero**: like `===`, except that `NaN` equals `NaN`. `-0` and `+0` are the same key.

### Map vs plain object

| | `Map` | Plain object `{}` |
|---|---|---|
| Key types | Any value, compared by identity | Strings and symbols only; anything else is converted to a string |
| Inherited keys | None | Inherits from `Object.prototype` (`constructor`, `toString`, `__proto__`) unless created with `Object.create(null)` |
| Order | Pure insertion order | Integer-like keys first (ascending), then string keys in insertion order |
| Size | `map.size`, O(1) | `Object.keys(obj).length`, O(n) |
| Iteration | Directly iterable | Needs `Object.keys/values/entries` |
| Frequent add/delete | Optimised for it | `delete` can push V8 into a slower "dictionary mode" for that object |
| JSON | `JSON.stringify(map)` → `"{}"` | Works directly |
| Best for | Dictionaries whose keys come from data or users, caches, lookup tables keyed by objects | Records with a fixed, known shape (`{ id, name, email }`) |

The two problems people hit in real code are key conversion and inherited keys. The demo's word counter:

```js
const plain = {};
plain[user] = 'stored under an object?';
Object.keys(plain);                 // → [ '[object Object]' ]  every object key collides

const words = ['constructor', 'map', 'map'];

// ❌ Plain object: "constructor" already exists on Object.prototype
const countsObj = {};
for (const w of words) countsObj[w] = (countsObj[w] || 0) + 1;
countsObj.constructor;              // → 'function Object() { [native code] }1'

// ✅ Map: no inherited keys, no string conversion
const countsMap = new Map();
for (const w of words) countsMap.set(w, (countsMap.get(w) ?? 0) + 1);
countsMap;                          // → Map(2) { 'constructor' => 1, 'map' => 2 }
```

When the keys come from user input (a query string, a form, JSON), a plain object is also a **prototype pollution** risk: assigning to `obj['__proto__']` changes the prototype instead of storing a key. A `Map` has no such special keys.

> **Note:** "Map is always faster" is not true. For records with a fixed shape, V8's hidden classes make plain objects very fast. Pick `Map` for dynamic keys and frequent add/remove, and objects for structured data. See [Objects](../09-objects-and-enums/notes.md) for object basics.

### Converting and serialising

```js
const asMap = new Map([['b', 'b'], [2, 'two'], ['a', 'a'], [1, 'one']]);

JSON.stringify(asMap);                       // → '{}'  (entries are not own properties)
const json = JSON.stringify([...asMap]);     // → '[["b","b"],[2,"two"],["a","a"],[1,"one"]]'
new Map(JSON.parse(json)).get(2);            // → 'two' (number keys survive as numbers)

Object.fromEntries(asMap);                   // → { '1': 'one', '2': 'two', b: 'b', a: 'a' }  keys become strings, order changes
new Map(Object.entries({ x: 1 }));           // → Map(1) { 'x' => 1 }
```

`structuredClone(map)` deep-copies a `Map` (and a `Set`), which `JSON` cannot do. See [JSON and XML](../25-json-and-xml/notes.md) for the reviver/replacer approach and [Pass by value and copying](../06-pass-by-value-and-copying/notes.md) for copying in general.

### Grouping with `Map.groupBy` (ES2024)

```js
const orders = [{ id: 1, status: 'paid' }, { id: 2, status: 'pending' }, { id: 3, status: 'paid' }];
const byStatus = Map.groupBy(orders, (o) => o.status);
byStatus.get('paid').map((o) => o.id);       // → [ 1, 3 ]
```

`Object.groupBy` does the same into a null-prototype object; use `Map.groupBy` when the group keys are not strings (dates, objects, numbers you don't want stringified). Both are Baseline 2024 and need Node 21+; the demo falls back to `reduce` on older Node.

### Map remembers order: a tiny LRU cache

Because a `Map` iterates in insertion order, "delete then set" moves a key to the end, and `map.keys().next().value` is the oldest key. That is a complete O(1) least-recently-used cache:

```js
get(key) {
  if (!this.#map.has(key)) return undefined;
  const value = this.#map.get(key);
  this.#map.delete(key);          // move to the "most recently used" end
  this.#map.set(key, value);
  return value;
}
set(key, value) {
  this.#map.delete(key);
  this.#map.set(key, value);
  if (this.#map.size > this.limit) this.#map.delete(this.#map.keys().next().value); // evict oldest
}
```

## Set

A `Set` stores **unique values** in insertion order, with the same SameValueZero equality as `Map` keys. `add`, `has` and `delete` are O(1) on average, compared with O(n) for `array.includes`.

```js
const unique = new Set(['js', 'css', 'js', 'html', 'css']);
[...unique];                          // → [ 'js', 'css', 'html' ]  (first occurrence wins)
unique.has('css');                    // → true
new Set([{ a: 1 }, { a: 1 }]).size;   // → 2  (two different objects: identity, not content)
new Set([NaN, NaN]).size;             // → 1
```

To deduplicate objects by a field, key a `Map` by that field: `[...new Map(users.map((u) => [u.id, u])).values()]` (the last duplicate wins).

### The ES2025 set methods

Set algebra used to need `[...a].filter((x) => b.has(x))`. ES2025 added seven methods to `Set.prototype`:

| Method | Returns | Meaning |
|---|---|---|
| `a.union(b)` | new `Set` | Everything in `a` or `b` |
| `a.intersection(b)` | new `Set` | Only what is in both |
| `a.difference(b)` | new `Set` | In `a` but not in `b` |
| `a.symmetricDifference(b)` | new `Set` | In exactly one of them |
| `a.isSubsetOf(b)` | boolean | Every element of `a` is in `b` |
| `a.isSupersetOf(b)` | boolean | Every element of `b` is in `a` |
| `a.isDisjointFrom(b)` | boolean | No element in common |

```js
const frontend = new Set(['js', 'css', 'html', 'react']);
const backend = new Set(['js', 'sql', 'csharp', 'react']);

frontend.union(backend);                // → Set { 'js', 'css', 'html', 'react', 'sql', 'csharp' }
frontend.intersection(backend);         // → Set { 'js', 'react' }
frontend.difference(backend);           // → Set { 'css', 'html' }
frontend.symmetricDifference(backend);  // → Set { 'css', 'html', 'sql', 'csharp' }
new Set(['js']).isSubsetOf(frontend);   // → true
frontend.isDisjointFrom(new Set(['sql'])); // → true
```

Details that interviews and code reviews probe:

- The methods never mutate; they return a new `Set` or a boolean.
- The argument must be **set-like**: an object with a numeric `size`, a `has()` and a `keys()`. A `Set` or a `Map` works (a `Map` contributes its **keys**); an **array throws a `TypeError`**. Wrap it: `a.union(new Set(arr))`.
- Do not rely on element order of the result for `intersection` and `difference`: the algorithm iterates whichever side is smaller.
- Support: Chrome 122, Firefox 127, Safari 17, Node 22 (Baseline 2024). They are missing on Node 20 and on older browsers still in your support matrix, so check before relying on them without a polyfill (core-js has one). The demo detects this and uses small fallbacks with the same set-like contract.

## WeakMap and WeakSet

### What "weak" means

A normal `Map` holds its keys **strongly**: as long as the map is reachable, every key object in it is reachable too, so it can never be garbage-collected. A `WeakMap` holds its keys **weakly**: the entry does not keep the key alive. When nothing else references the key object, the garbage collector may remove the key and its value together.

The value is held strongly, but only for as long as its key is alive. Even a value that refers back to its own key does not keep the key alive (this key-to-value relationship is called an *ephemeron*).

| | `Map` / `Set` | `WeakMap` / `WeakSet` |
|---|---|---|
| Keys | Any value | Objects, or symbols that are not registered with `Symbol.for` (ES2023) |
| Keeps keys alive | Yes | No |
| Iterable, `size`, `clear()` | Yes | No |
| Methods | Full API | `get`, `set`, `has`, `delete` (`WeakSet`: `add`, `has`, `delete`) |
| Typical use | Your own data | Data **about** objects someone else owns |

Why no iteration or `size`? Because the contents depend on when the garbage collector last ran. If you could list the keys, your program's output would depend on GC timing, which the language deliberately keeps unobservable.

### Use cases

**1. Private per-instance data** (how private fields were done before `#private`, and still how transpilers implement them for old targets):

```js
const secrets = new WeakMap();

class Account {
  constructor(owner, balance) {
    this.owner = owner;
    secrets.set(this, { balance });   // nothing stored on the instance
  }
  deposit(amount) {
    return (secrets.get(this).balance += amount);
  }
}

const acc = new Account('Asha', 100);
acc.deposit(50);                      // → 150
JSON.stringify(acc);                  // → '{"owner":"Asha"}'
```

For new code, prefer `#private` fields (see [Objects](../09-objects-and-enums/notes.md#with-private-fields-)). `WeakMap` is still the right tool when you attach data to objects you **don't own**, such as DOM nodes or objects from a library.

**2. Metadata and caches keyed by DOM nodes or objects:**

```js
const tooltipFor = new WeakMap();

function attachTooltip(button, text) {
  tooltipFor.set(button, createTooltip(text));
}
// When the button is removed from the page and your code drops its references,
// the tooltip object becomes collectable too. A Map would keep both alive forever.
```

```js
const statsCache = new WeakMap();
function getStats(list) {
  if (statsCache.has(list)) return statsCache.get(list);
  const stats = { count: list.length, total: list.reduce((s, n) => s + n, 0) };
  statsCache.set(list, stats);        // no eviction policy needed: the entry dies with `list`
  return stats;
}
```

This is how selector libraries and frameworks memoise per object without leaking. It only works when the input is an object whose identity stays the same while it is unchanged (immutable updates make this work well).

**3. WeakSet for marking objects** you don't own: "already processed", "already initialised", or the `visited` set in a recursive walk over a structure that may contain cycles:

```js
const visited = new WeakSet();
function countNodes(node) {
  if (node === null || typeof node !== 'object' || visited.has(node)) return 0;
  visited.add(node);
  return 1 + Object.values(node).reduce((sum, child) => sum + countNodes(child), 0);
}
```

## WeakRef and FinalizationRegistry

ES2021 added two lower-level tools:

- `new WeakRef(obj)` holds `obj` weakly; `ref.deref()` returns the object, or `undefined` once it has been collected.
- `new FinalizationRegistry(callback)`; `registry.register(obj, heldValue)` asks the engine to call `callback(heldValue)` some time after `obj` is collected.

```js
const registry = new FinalizationRegistry((label) => console.log(`${label} was collected`));
let big = { payload: new Array(1_000_000).fill(0) };
const ref = new WeakRef(big);
registry.register(big, 'big object');
big = null;
// later, in another task, after a GC:
ref.deref();   // → undefined (maybe)
// "big object was collected" (maybe, at some point, or never)
```

Every "maybe" in that comment is real, which is why both MDN and the proposal's authors advise avoiding these where possible:

- **Timing is unspecified.** Collection can happen much later or never (a short-lived page may never need a GC).
- A `WeakRef` target that you created or `deref()`-ed stays alive at least until the current synchronous job ends, so a `deref()` straight after dropping the strong reference still returns the object.
- **Finalizers may never run**: not when the tab closes, and not at all if the registry itself becomes unreachable. The demo's `--expose-gc` section keeps `registry` referenced from a later callback for exactly this reason.
- Behaviour differs between engines and versions, so code that "works" can break later.

Legitimate uses are narrow: a cache of large, re-creatable objects (decoded images, parsed documents) where losing an entry only costs a recomputation, and finalizers as a **backup** for releasing external resources (WebAssembly memory, worker handles) that also have an explicit `close()`/`dispose()`. Never use them for logic that must happen: saving data, closing a connection, unsubscribing.

## How Garbage Collection Works

JavaScript has automatic memory management: you allocate by creating values, and the engine frees memory that can no longer be used. You never free memory yourself; you only **drop references**.

### Reachability

An object is kept if it is **reachable** from a *root*:

- the global object (`window`, `globalThis`) and module-level variables of loaded modules,
- local variables and arguments of functions currently on the call stack,
- variables captured by closures that are themselves reachable,
- anything the host holds on your behalf: event listeners on live nodes, pending timers, in-flight requests and their callbacks, active observers, the document's DOM tree.

Everything reachable by following references from those roots is alive; everything else is garbage, even if garbage objects still reference each other.

### Mark-and-sweep, not reference counting

| Algorithm | How it works | Cycles |
|---|---|---|
| Reference counting | Free an object when its count of incoming references drops to 0 | Two objects that point at each other never reach 0, so they leak (the classic old-IE DOM/JS cycle leak) |
| Mark-and-sweep (all modern engines) | **Mark** everything reachable from the roots, then **sweep** (free) everything unmarked | Unreachable cycles are collected normally |

So `a.other = b; b.other = a;` is **not** a leak in modern browsers. A leak is always something that is still *reachable* but no longer *needed*.

### Generational collection (conceptual, V8)

Most objects die young (temporary arrays, strings, closures for a single event). Engines exploit this "generational hypothesis":

| | Young generation | Old generation |
|---|---|---|
| Holds | Newly allocated objects | Objects that survived a couple of young collections |
| Collector | Scavenger: copies the few survivors out, frees the rest in bulk | Mark-compact: marks reachable objects, sweeps, compacts to reduce fragmentation |
| Frequency and cost | Frequent, very fast | Rarer, more expensive |

V8's collector (Orinoco) does much of the marking concurrently or incrementally on helper threads to keep pauses short, but a large heap and a high allocation rate still cost main-thread time. Practical consequences: avoid allocating heavily in hot paths (scroll, `mousemove`, animation frames), and expect a sawtooth heap graph (grow, collect, grow) in a healthy app. A staircase that never comes back down is the leak pattern.

## Common Front-end Memory Leaks

In a long-lived single-page app, "unneeded but still reachable" accumulates on every route change or every open/close of a dialog.

| Leak | What keeps it alive | Fix |
|---|---|---|
| Detached DOM nodes | A JS reference (array, cache, closure, component field) to an element removed from the page | Drop the reference on removal; key metadata in a `WeakMap` |
| Forgotten listeners | A listener on `window`/`document`/a long-lived element whose closure references component state | `removeEventListener`, `{ once: true }` or an `AbortController` `signal` |
| Timers | `setInterval` (or a self-rescheduling `setTimeout`) callback and its closure | `clearInterval` / `clearTimeout` on teardown |
| Observers and subscriptions | `ResizeObserver`, `IntersectionObserver`, `MutationObserver`, store subscriptions, WebSocket or `EventEmitter` handlers | `observer.disconnect()`, call the unsubscribe function |
| Closures holding large data | A long-lived closure capturing (or sharing a scope with) a big object | Capture only what you need; null out big locals |
| Unbounded caches | A module-level `Map` used for memoisation that only grows | Bound it (LRU), give entries a TTL, or key a `WeakMap` by object |
| Accidental globals | `x = 1` in sloppy mode, `window.debugData = ...` | Modules and strict mode; never park data on `window` |
| `console.log(obj)` | DevTools keeps logged objects alive so you can inspect them | Remove debug logging; clear the console while measuring |

Detached DOM nodes are the most common. A node removed from the document is still a normal object; if anything references it, it stays in memory, and because nodes reference their parents and children, **one** retained detached `<li>` can keep its whole detached `<ul>` alive:

```js
// ❌ The cache outlives the rows it points to
const rowCache = [];
function renderRows(items) {
  list.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    li.textContent = item.name;
    rowCache.push(li);              // every render adds more detached <li>s
    return li;
  }));
}

// ✅ Keep data about nodes in a WeakMap, or don't keep the nodes at all
const itemForRow = new WeakMap();
function renderRowsFixed(items) {
  list.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    li.textContent = item.name;
    itemForRow.set(li, item);       // collectable once the <li> leaves the page
    return li;
  }));
}
```

For listeners, one `AbortController` per component makes teardown hard to forget (see [removeEventListener()](../24-events-and-delegation/notes.md#removeeventlistener)):

```js
function mountSearchPanel(panel) {
  const controller = new AbortController();
  const { signal } = controller;
  window.addEventListener('resize', onResize, { signal });
  document.addEventListener('keydown', onKey, { signal });
  const observer = new ResizeObserver(onPanelResize);
  observer.observe(panel);
  const timer = setInterval(refresh, 30_000);

  return function unmount() {        // call this when the panel goes away
    controller.abort();              // removes both listeners
    observer.disconnect();
    clearInterval(timer);
  };
}
```

The closure case is subtle. In V8, all closures created in the same scope share **one** context object holding every variable that *any* of them uses. A tiny closure can therefore keep a large object alive that it never mentions:

```js
function setup() {
  const hugeData = new Array(1_000_000).fill('x');
  const logSize = () => console.log(hugeData.length); // uses hugeData
  logSize();
  return () => console.log('tiny handler');            // never mentions hugeData...
}
window.handler = setup();  // ...but shares the context with logSize, so hugeData stays alive
```

Fix it by moving the big work into a separate function, or setting `hugeData = null` (declare it with `let`) once it is no longer needed. More on closures in [Closures](../12-closures-destructuring-spread/notes.md#closures).

## Finding Leaks in DevTools

The Chrome (and Edge) workflow; Firefox has equivalent tools in its Memory panel.

1. **Confirm there is a leak.** Open the **Performance monitor** panel and watch *JS heap size*, *DOM Nodes* and *JS event listeners* while you repeat an action (open and close a dialog, navigate away and back). Numbers that climb and never fall back are suspicious. A Performance recording with the *Memory* checkbox shows the same as a graph: sawtooth is fine, a rising staircase is a leak.
2. **Take heap snapshots** (Memory panel → *Heap snapshot*). Taking a snapshot runs a garbage collection first, so it only contains objects that are still reachable. Key columns: *Shallow size* is the object's own memory; *Retained size* is what would be freed if it were collected, including everything only it keeps alive. Sort by retained size to find the expensive objects.
3. **Use the Comparison view** with the three-snapshot technique: snapshot 1 at a baseline, perform the action several times, snapshot 2, perform it again, snapshot 3. Select snapshot 3 and compare it with snapshot 2 (or view *Objects allocated between snapshots 1 and 2*). Objects whose *# Delta* grows by a multiple of your repetitions (5 repeats → 5 new `SearchPanel`, 500 new `<li>`) are leak candidates.
4. **Read the Retainers pane.** Select a leaked object and follow the retaining path up to a root: it names the array, closure (`context`), listener or global that holds it. That path is the bug.
5. **Find detached DOM.** In a snapshot's *Summary* view, type `Detached` in the class filter to list DOM nodes that are no longer in the document but still retained. Recent Chromium-based DevTools (Chrome and Edge) also offer a *Detached elements* profiling type in the Memory panel, which lists detached nodes and their retainers directly; it began as a separate Detached Elements tool in Edge.
6. **Find where it was allocated.** *Allocations on timeline* records allocations over time with stack traces: blue bars are allocations still alive at the end of the recording, grey bars were collected. *Allocation sampling* is the cheaper option for long sessions.

> **Note:** Measure in a fresh incognito window without extensions, with the console cleared, and in a production build if you can. Extensions, logged objects and development-only tooling (hot reload, React DevTools) all retain objects and make the heap look worse than it is.

The Chrome console also has `queryObjects(SearchPanel)`, which lists every live instance of a constructor: a quick check that "5 opens and 5 closes" left zero panels behind.

## Common Mistakes

- **Using a plain object as a dictionary for user-supplied keys:** inherited keys like `constructor` give wrong results, and `__proto__` opens the door to prototype pollution. Use a `Map` (or `Object.create(null)`).
- **Using objects as keys of a plain object:** every key becomes `'[object Object]'` and they overwrite each other.
- **Expecting `map.get({ id: 1 })` to find an entry stored under another `{ id: 1 }`:** object keys compare by identity. Key by `obj.id` instead.
- **`JSON.stringify(map)`:** gives `"{}"` and silently loses the data. Serialise `[...map]` or `Object.fromEntries(map)`.
- **Passing an array to the new set methods:** `set.union([1, 2])` throws a `TypeError`; the argument must be set-like.
- **Using a `Map` as a cache for objects that come and go** (DOM nodes, component instances) and wondering why memory grows. Use a `WeakMap`, or bound the cache.
- **Expecting a `WeakMap` to clean up immediately** or trying to test it with `console.log(weakMap)`. Collection happens whenever the GC decides.
- **Building logic on `WeakRef`/`FinalizationRegistry`:** finalizers may run late or never.
- **Removing an element from the DOM and thinking it is freed** while an array, closure or listener still references it.
- **Measuring memory with DevTools extensions, logged objects and a dev build:** they retain objects and create false leaks.

## Key Takeaways

- Use `Map` for dictionaries with dynamic or non-string keys and frequent add/remove; use plain objects for fixed-shape records.
- `Set` gives O(1) membership and easy deduplication; ES2025 adds `union`, `intersection`, `difference`, `symmetricDifference`, `isSubsetOf`, `isSupersetOf` and `isDisjointFrom`, which take set-like arguments (not arrays).
- `Map`, `Set`, `WeakMap` and `WeakSet` compare keys by identity (SameValueZero), so two equal-looking objects are two keys.
- `WeakMap`/`WeakSet` don't keep their keys alive, which is why they can't be iterated or sized. Use them for data *about* objects you don't own.
- `WeakRef` and `FinalizationRegistry` are non-deterministic; use them only for optional caches and backup cleanup.
- Modern GC is mark-and-sweep from roots (with generations): cycles are fine, and a leak is anything still reachable but no longer needed.
- Front-end leaks come from detached DOM, listeners, timers, observers, subscriptions, closures and unbounded caches; give every component a teardown that undoes everything it set up.
- Find leaks with the Performance monitor, heap snapshot Comparison view, the Retainers pane and the `Detached` filter.

## Interview Questions

### Junior (0–1 year)

**Q1. What are the differences between a `Map` and a plain object?**
A `Map` accepts any value as a key (objects, functions, `NaN`) and compares keys by identity, while an object converts keys to strings. A `Map` has no inherited keys, iterates in insertion order, has an O(1) `size`, and is optimised for frequent additions and deletions. Objects are better for fixed-shape records, work directly with `JSON.stringify`, and have literal syntax. Use a `Map` for dictionaries and caches, an object for structured data.

**Q2. Why does `JSON.stringify(new Map([['a', 1]]))` return `"{}"`, and how do you serialise a Map?**
`JSON.stringify` only serialises an object's own enumerable properties, and a `Map` stores its entries internally, not as properties. Convert it first: `JSON.stringify([...map])` keeps non-string keys and order, and `new Map(JSON.parse(json))` restores it. `Object.fromEntries(map)` works when all keys are strings. `structuredClone` copies a `Map` without going through JSON.

**Q3. What is a `WeakMap` and how is it different from a `Map`?**
A `WeakMap` is a map whose keys must be objects (or non-registered symbols) and are held weakly: an entry does not stop its key from being garbage-collected, and when the key is collected the value goes too. Because entries can disappear at any time, a `WeakMap` has no `size`, no iteration and no `clear()`; only `get`, `set`, `has` and `delete`. It is used to attach data to objects without keeping them alive.

**Q4. When does JavaScript free an object's memory?**
When the object is no longer reachable from any root (globals, the current call stack, live closures, listeners and timers held by the browser). The garbage collector finds unreachable objects and frees them at a time of its choosing; you can't free memory directly, only remove references, for example by removing an item from an array or setting a variable to `null`.

**Q5. What is a memory leak in a single-page app? Give examples.**
Memory that is still reachable but no longer needed, so it can never be collected and builds up over time. Typical examples: an event listener on `window` that is never removed after its component is gone, a `setInterval` that keeps running, a DOM element removed from the page but still stored in an array, and a cache `Map` that only grows. The symptom is memory that rises with every navigation and the tab getting slower or crashing.

### Mid-level (2–4 years)

**Q6. What does this print?**
```js
const m = new Map();
m.set({ id: 1 }, 'a');
m.set(NaN, 'b');
m.set('1', 'c');
console.log(m.get({ id: 1 }), m.get(NaN), m.get(1), m.size);
```
`undefined b undefined 3`. The two `{ id: 1 }` literals are different objects, and object keys compare by identity. `NaN` is found because `Map` uses SameValueZero, where `NaN` equals `NaN`. `1` and `'1'` are different keys because a `Map` does not convert keys to strings. All three entries are stored, so `size` is 3.

**Q7. Explain the ES2025 set methods. Why does `new Set([1, 2]).union([3])` throw?**
`union`, `intersection`, `difference` and `symmetricDifference` return a new `Set`; `isSubsetOf`, `isSupersetOf` and `isDisjointFrom` return booleans; none of them mutate. They accept any *set-like* argument, meaning an object with a numeric `size` and `has()` and `keys()` methods, so they can work efficiently without converting the argument. An array has no `size` or `has`, so it throws a `TypeError`; wrap it in `new Set(arr)`. A `Map` is set-like and contributes its keys. They are Baseline 2024 (Node 22+), so check your browser and Node support before using them without a polyfill.

**Q8. Why can't you iterate a `WeakMap` or read its `size`?**
Its contents depend on when the garbage collector last ran. If you could list keys or count entries, a program's behaviour would change with GC timing, which differs between engines, devices and runs. The language keeps GC unobservable for ordinary code, so `WeakMap` only allows lookups by a key you already hold, and holding the key means the entry is alive anyway. If you need iteration, you need strong references: use a `Map` and manage removal yourself.

**Q9. Implement an LRU cache with O(1) `get` and `set`.**
Use a `Map`, because it keeps insertion order and its delete/set/keys are O(1). On `get`, delete the key and set it again to move it to the "most recent" end. On `set`, do the same, then if `size` exceeds the limit, delete the first key, `map.keys().next().value`, which is the least recently used. The demo's `LRUCache` class is the complete implementation. Without `Map` you would need a hash map plus a doubly linked list.

**Q10. You need to store state per DOM element (a tooltip instance, a drag state). Where do you put it?**
In a `WeakMap` keyed by the element. Unlike a `Map` or an array, it does not keep removed elements alive, and unlike an expando property (`el._tooltip = ...`) it doesn't touch the DOM object or risk name clashes with other scripts. `data-*` attributes are only for strings and are visible in the HTML, so they suit configuration, not object state. Still remove listeners and timers the state uses: the `WeakMap` frees the data, not the side effects.

**Q11. What is a detached DOM node, and how do you find one?**
An element that is no longer in the document but is still referenced from JavaScript, so it can't be collected, together with its subtree and parent chain. In Chrome's Memory panel take a heap snapshot, type `Detached` in the class filter of the Summary view, select a node and read the Retainers pane to see which array, closure or listener holds it. Recent Chrome and Edge versions also have a *Detached elements* profiling type in the Memory panel that lists them directly.

**Q12. Do circular references cause memory leaks in JavaScript?**
Not in modern engines. They use mark-and-sweep: starting from the roots, they mark everything reachable and free everything else, so two objects that reference only each other are unreachable and are collected. Reference-counting collectors can't free cycles, which is why old Internet Explorer leaked when a DOM node and a JS object referenced each other. Today a leak means something is still reachable, not that a cycle exists.

### Senior (5+ years)

**Q13. After each route change in a large SPA, memory grows by a few MB and never comes back. How do you investigate, and how do you stop it coming back?**
Reproduce it with a fixed, repeatable action (navigate A → B → A ten times) in a clean incognito window and a production build, then confirm with the Performance monitor that heap size and DOM node count step up per round. Use the three-snapshot technique and the Comparison view: look for constructors whose delta is a multiple of the round count (component instances, detached nodes, closures), then read the Retainers pane to the root: usually a global store subscription, a `window` listener, an interval, an observer or a module-level cache. `queryObjects(Constructor)` in the console confirms the fix.
To stop regressions, give every component one teardown path (an `AbortController` for listeners, `disconnect()` for observers, unsubscribe functions collected in one place), make the lint rules and code review check for it, and add an automated check: a Puppeteer or Playwright script that repeats the navigation and fails CI if the heap or DOM node count grows past a budget (tools like Meta's MemLab automate this). My recommendation: fix the specific retainer, then invest in the teardown convention and the CI check, because leaks in SPAs are always reintroduced otherwise.

**Q14. A teammate proposes `FinalizationRegistry` to close WebSocket connections automatically when the owning component object is garbage-collected. What is your review?**
Reject it as the primary mechanism. Finalizers run at an unspecified time or never: the socket could stay open for minutes, keep receiving messages and keep the server's connection count up, and on a page that never triggers a major GC it will never close. Behaviour also differs between browsers, so it can pass testing and fail in production. Worse, the socket's message handler usually references the component, so the component may never become unreachable in the first place.
Resource lifetime must be explicit: the component opens the socket on mount and closes it in its teardown (`useEffect` cleanup, `disconnectedCallback`, an `unmount()` function), ideally through a shared connection manager with reference counting so several components can share one socket. A `FinalizationRegistry` is acceptable only as a logged safety net that reports "socket collected while still open", which turns a silent leak into a visible bug.

**Q15. You are designing a memoisation utility that many teams will use for expensive derived data. How do you choose between `Map`, `WeakMap` and an LRU?**
It depends on the key. If the input is an object with stable identity (immutable state slices, API response objects), key a `WeakMap` by it: entries die with the input, nobody has to configure eviction, and it cannot leak. If inputs are primitives or composite arguments (IDs, query strings, several arguments), a `WeakMap` can't be used, and an unbounded `Map` is a guaranteed leak in a long session, so use an LRU with a size limit (and optionally a TTL for data that goes stale). For multiple object arguments, a nested `WeakMap` per argument works.
For the API: default to a bounded cache, make the size explicit (`memoize(fn, { max: 100 })`), expose `clear()` for logout and tests, and document that object arguments are compared by identity, because mutating an object in place will return stale results. Recommendation: `WeakMap` for single object keys, bounded LRU for everything else, never an unbounded `Map` in shared code.

**Q16. A heap snapshot shows a 50 MB array retained by a closure that never references it. How is that possible, and how do you prevent this class of bug?**
In V8, closures created in the same function share one context object containing every variable that *any* of those closures uses. If one inner function uses the big array (say, a one-off logging or processing helper) and another inner function survives (an event handler or a returned callback), the survivor keeps the shared context, and therefore the array, alive. The Retainers pane shows this as the handler → `context` → the variable.
Fixes: do the heavy work in a separate function so the large data never enters the long-lived function's scope, set the variable to `null` when done, or capture only the derived small value. Across a team, explain the rule as "anything a long-lived callback's enclosing function touches may live as long as that callback", keep event handlers and subscriptions in small factory functions, and include a retainer-path check in leak investigations rather than trusting what the source code appears to capture.

> **Note:** Related questions answered elsewhere: [Events and delegation](../24-events-and-delegation/notes.md#interview-questions) (a `resize` listener that keeps running after its component is gone); [Arrays and Array Methods](../08-arrays/notes.md#interview-questions) (removing duplicates from an array).

## References

- [MDN: Keyed collections](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Keyed_collections)
- [MDN: Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
- [MDN: Map.groupBy()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy)
- [MDN: Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
- [MDN: Set.prototype.union()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/union)
- [MDN: WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)
- [MDN: WeakSet](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet)
- [MDN: WeakRef](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef)
- [MDN: FinalizationRegistry](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry)
- [MDN: Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management)
- [TC39: Set methods proposal](https://github.com/tc39/proposal-set-methods)
- [V8: Trash talk, the Orinoco garbage collector](https://v8.dev/blog/trash-talk)
- [V8: Weak references and finalizers](https://v8.dev/features/weak-references)
- [Chrome DevTools: Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems)
- [Chrome DevTools: Record heap snapshots](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots)
- [Microsoft Edge DevTools: Debug DOM memory leaks](https://learn.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/memory-problems/dom-leaks)
