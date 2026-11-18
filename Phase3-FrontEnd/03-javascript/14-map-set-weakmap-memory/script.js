// Map, Set, WeakMap and memory management: runnable demo for notes.md
// Run:           node script.js
// Optional:      node --expose-gc script.js   (also runs the WeakRef / FinalizationRegistry section)

const section = (title) => console.log(`\n=== ${title} ===`);

// ---------------------------------------------------------------------------
section('1. Map keys can be any value');

const user = { id: 1 };
const onSave = () => {};
const meta = new Map([
  [user, 'an object key'],
  [onSave, 'a function key'],
  [NaN, 'NaN works as a key'],
  [1, 'the number 1'],
  ['1', 'the string "1"'],
]);

console.log(meta.get(user));                // an object key
console.log(meta.get({ id: 1 }));           // undefined (a different object: keys compare by identity)
console.log(meta.get(NaN));                 // NaN works as a key (SameValueZero equality)
console.log(meta.get(1), '|', meta.get('1')); // the number 1 | the string "1"
console.log('size:', meta.size);            // size: 5

const plain = {};
plain[user] = 'stored under an object?';
plain[1] = 'number key';
console.log(Object.keys(plain));            // [ '1', '[object Object]' ]  (every key became a string)

// ---------------------------------------------------------------------------
section('2. Iteration order');

const asObject = { b: 'b', 2: 'two', a: 'a', 1: 'one' };
const asMap = new Map([['b', 'b'], [2, 'two'], ['a', 'a'], [1, 'one']]);
console.log(Object.keys(asObject));         // [ '1', '2', 'b', 'a' ]  integer-like keys jump to the front
console.log([...asMap.keys()]);             // [ 'b', 2, 'a', 1 ]      pure insertion order

// ---------------------------------------------------------------------------
section('3. Inherited keys: the word-count bug');

const words = ['constructor', 'map', 'map'];

const countsObj = {};
for (const w of words) countsObj[w] = (countsObj[w] || 0) + 1;
console.log(countsObj.constructor);         // function Object() { [native code] }1   (inherited from Object.prototype)

const countsMap = new Map();
for (const w of words) countsMap.set(w, (countsMap.get(w) ?? 0) + 1);
console.log(countsMap);                     // Map(2) { 'constructor' => 1, 'map' => 2 }

// ---------------------------------------------------------------------------
section('4. Map and JSON');

console.log(JSON.stringify(asMap));                         // {}  (entries are not own enumerable properties)
const asJson = JSON.stringify([...asMap]);
console.log(asJson);                                        // [["b","b"],[2,"two"],["a","a"],[1,"one"]]
const revived = new Map(JSON.parse(asJson));
console.log(revived.get(2));                                // two  (number key survived as a number)
console.log(JSON.stringify(Object.fromEntries(asMap)));     // {"1":"one","2":"two","b":"b","a":"a"}  (keys become strings)

// ---------------------------------------------------------------------------
section('5. Grouping with Map.groupBy (ES2024)');

const orders = [
  { id: 1, status: 'paid' },
  { id: 2, status: 'pending' },
  { id: 3, status: 'paid' },
];
const groupBy = (items, keyFn) =>
  typeof Map.groupBy === 'function'
    ? Map.groupBy(items, keyFn)
    : items.reduce((map, item) => {
        const key = keyFn(item);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
        return map;
      }, new Map());
const byStatus = groupBy(orders, (o) => o.status);
console.log(typeof Map.groupBy === 'function' ? '(native Map.groupBy)' : '(fallback: this Node has no Map.groupBy)');
console.log(byStatus.get('paid').map((o) => o.id));         // [ 1, 3 ]

// ---------------------------------------------------------------------------
section('6. A tiny LRU cache (Map remembers insertion order)');

class LRUCache {
  #map = new Map();
  constructor(limit) { this.limit = limit; }
  get(key) {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key);
    this.#map.delete(key);           // move to the "most recently used" end
    this.#map.set(key, value);
    return value;
  }
  set(key, value) {
    this.#map.delete(key);
    this.#map.set(key, value);
    if (this.#map.size > this.limit) {
      const oldest = this.#map.keys().next().value; // first key = least recently used
      this.#map.delete(oldest);
    }
  }
  keys() { return [...this.#map.keys()]; }
}

const lru = new LRUCache(2);
lru.set('a', 1);
lru.set('b', 2);
lru.get('a');                        // touch "a"
lru.set('c', 3);                     // evicts "b", the least recently used
console.log(lru.keys());             // [ 'a', 'c' ]

// ---------------------------------------------------------------------------
section('7. Set basics');

const tags = ['js', 'css', 'js', 'html', 'css'];
const unique = new Set(tags);
console.log([...unique]);            // [ 'js', 'css', 'html' ]  (first occurrence wins, order kept)
console.log(unique.has('css'));      // true  (fast lookup, no indexOf scan)
console.log(new Set([{ a: 1 }, { a: 1 }]).size); // 2  (objects compare by identity, not by content)

// ---------------------------------------------------------------------------
section('8. ES2025 Set methods');

const hasNativeSetMethods = typeof Set.prototype.union === 'function';
console.log(hasNativeSetMethods
  ? '(native Set methods)'
  : '(fallback: this Node has no Set.prototype.union; Node 22+ has it)');

// Same contract as the built-ins: the argument must be "set-like" (size, has(), keys()).
function asSetLike(other) {
  if (typeof other?.size !== 'number' || typeof other.has !== 'function' || typeof other.keys !== 'function') {
    throw new TypeError('argument is not set-like (needs size, has and keys)');
  }
  return other;
}
const setOps = {
  union: (a, b) => (hasNativeSetMethods ? a.union(b) : new Set([...a, ...asSetLike(b).keys()])),
  intersection: (a, b) => (hasNativeSetMethods ? a.intersection(b) : new Set([...a].filter((x) => asSetLike(b).has(x)))),
  difference: (a, b) => (hasNativeSetMethods ? a.difference(b) : new Set([...a].filter((x) => !asSetLike(b).has(x)))),
  symmetricDifference: (a, b) => (hasNativeSetMethods
    ? a.symmetricDifference(b)
    : new Set([...a].filter((x) => !asSetLike(b).has(x)).concat([...b.keys()].filter((x) => !a.has(x))))),
  isSubsetOf: (a, b) => (hasNativeSetMethods ? a.isSubsetOf(b) : [...a].every((x) => asSetLike(b).has(x))),
  isSupersetOf: (a, b) => (hasNativeSetMethods ? a.isSupersetOf(b) : [...asSetLike(b).keys()].every((x) => a.has(x))),
  isDisjointFrom: (a, b) => (hasNativeSetMethods ? a.isDisjointFrom(b) : [...a].every((x) => !asSetLike(b).has(x))),
};

const frontend = new Set(['js', 'css', 'html', 'react']);
const backend = new Set(['js', 'sql', 'csharp', 'react']);

console.log('union               ', [...setOps.union(frontend, backend)]);
// [ 'js', 'css', 'html', 'react', 'sql', 'csharp' ]
console.log('intersection        ', [...setOps.intersection(frontend, backend)]);
// [ 'js', 'react' ]
console.log('difference          ', [...setOps.difference(frontend, backend)]);
// [ 'css', 'html' ]
console.log('symmetricDifference ', [...setOps.symmetricDifference(frontend, backend)]);
// [ 'css', 'html', 'sql', 'csharp' ]
console.log('isSubsetOf          ', setOps.isSubsetOf(new Set(['js', 'css']), frontend));   // true
console.log('isSupersetOf        ', setOps.isSupersetOf(frontend, new Set(['html'])));      // true
console.log('isDisjointFrom      ', setOps.isDisjointFrom(frontend, new Set(['sql'])));     // true

// A Map is set-like (size, has, keys), so its KEYS take part:
const prices = new Map([['js', 0], ['css', 0], ['figma', 15]]);
console.log('Set vs Map keys     ', [...setOps.intersection(frontend, prices)]);           // [ 'js', 'css' ]

// An array is NOT set-like:
try {
  setOps.union(frontend, ['vue']);
} catch (err) {
  console.log('union with an array →', err.constructor.name);                              // TypeError
}

// ---------------------------------------------------------------------------
section('9. WeakMap for private per-object data');

const secrets = new WeakMap();

class Account {
  constructor(owner, balance) {
    this.owner = owner;
    secrets.set(this, { balance });           // nothing on the instance itself
  }
  deposit(amount) {
    secrets.get(this).balance += amount;
    return secrets.get(this).balance;
  }
}

const acc = new Account('Asha', 100);
console.log(acc.deposit(50));                 // 150
console.log(Object.keys(acc));                // [ 'owner' ]  (balance is not reachable from outside)
console.log(JSON.stringify(acc));             // {"owner":"Asha"}

// ---------------------------------------------------------------------------
section('10. WeakMap as a cache keyed by objects');

const statsCache = new WeakMap();
let computations = 0;

function getStats(list) {                     // list is an object (an array)
  if (statsCache.has(list)) return statsCache.get(list);
  computations++;
  const stats = { count: list.length, total: list.reduce((sum, n) => sum + n, 0) };
  statsCache.set(list, stats);                // entry dies with the array: no manual eviction
  return stats;
}

let numbers = [3, 4, 5];
console.log(getStats(numbers));               // { count: 3, total: 12 }
console.log(getStats(numbers));               // { count: 3, total: 12 }  (cached)
console.log('computations:', computations);   // computations: 1
numbers = null;                               // array and its cache entry are now collectable

// ---------------------------------------------------------------------------
section('11. WeakSet to track objects without owning them');

const visited = new WeakSet();

function countNodes(node) {                   // safe on circular structures
  if (node === null || typeof node !== 'object' || visited.has(node)) return 0;
  visited.add(node);
  return 1 + Object.values(node).reduce((sum, child) => sum + countNodes(child), 0);
}

const parent = { name: 'parent' };
const child = { name: 'child', parent };
parent.child = child;                         // a cycle
console.log(countNodes(parent));              // 2  (no infinite recursion)

// ---------------------------------------------------------------------------
section('12. What you cannot do with a WeakMap');

const wm = new WeakMap();
console.log(typeof wm[Symbol.iterator], wm.size, typeof wm.keys); // undefined undefined undefined
try {
  wm.set('a string', 1);
} catch (err) {
  console.log('primitive key →', err.constructor.name);            // TypeError
}
try {
  wm.set(Symbol.for('registered'), 1);
} catch (err) {
  console.log('registered symbol key →', err.constructor.name);    // TypeError
}
wm.set(Symbol('local'), 1);                                         // non-registered symbols are allowed (ES2023)
console.log('non-registered symbol key → ok');

// ---------------------------------------------------------------------------
section('13. WeakRef and FinalizationRegistry');

if (typeof globalThis.gc !== 'function') {
  console.log('skipped: run "node --expose-gc script.js" to force a garbage collection');
} else {
  const registry = new FinalizationRegistry((label) => {
    console.log(`finalizer callback: ${label} was collected`);
  });

  let big = { payload: new Array(1_000_000).fill(0) };
  const ref = new WeakRef(big);
  registry.register(big, 'big object');
  console.log('before gc, deref() returns the object:', ref.deref() !== undefined); // true
  big = null;                                   // drop the only strong reference

  // WeakRef targets stay alive until the current job finishes, so collect in a later task.
  setTimeout(() => {
    globalThis.gc();
    console.log('after gc, deref():', ref.deref()); // undefined (usually; GC timing is not guaranteed)
    // The finalizer callback, if it runs at all, runs in a later task.
    // The registry itself must stay reachable: if the registry is collected, its callbacks never run.
    // Referencing it in this closure keeps it alive. Delete `registry` below and the callback usually disappears.
    setTimeout(() => console.log('registry still reachable:', registry instanceof FinalizationRegistry), 100);
  }, 0);
}
