// Functional patterns in JavaScript: run with `node script.js`
// Each section prints what the matching section of notes.md describes.

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
section("1. Pure functions and side effects");

const addTax = (price, rate) => price * (1 + rate); // pure: output depends only on input
let runningTotal = 0;
const addToTotal = (n) => (runningTotal += n); // impure: reads and changes outer state

console.log(addTax(100, 0.2), addTax(100, 0.2)); // same input, same output
console.log(addToTotal(5), addToTotal(5)); // same input, different output

const scores = [30, 10, 20];
const sortedCopy = scores.toSorted((a, b) => a - b); // pure: returns a new array
console.log(sortedCopy, scores); // original untouched
const sortedInPlace = scores.sort((a, b) => a - b); // impure: mutates its input
console.log(sortedInPlace === scores, scores); // same array, now reordered

// ---------------------------------------------------------------------------
section("2. Immutability: freeze, copies and structural sharing");

const config = Object.freeze({ retries: 3, api: { url: "/v1" } });
config.retries = 10; // ignored silently: this file is a sloppy-mode CommonJS script
config.api.url = "/v2"; // works: freeze is shallow
console.log(config.retries, config.api.url, Object.isFrozen(config.api));

(function () {
  "use strict";
  try {
    config.retries = 10;
  } catch (err) {
    console.log("strict mode:", err.constructor.name); // assignment throws instead
  }
})();

const state = {
  user: { name: "Asha" },
  todos: [
    { id: 1, text: "Learn pipe", done: false },
    { id: 2, text: "Learn throttle", done: false },
  ],
};

// Immutable update: copy only the path that changes, share everything else
const next = {
  ...state,
  todos: state.todos.map((t) => (t.id === 2 ? { ...t, done: true } : t)),
};
console.log("state changed?   ", next !== state);
console.log("user shared?     ", next.user === state.user);
console.log("todos copied?    ", next.todos !== state.todos);
console.log("todo 1 shared?   ", next.todos[0] === state.todos[0]);
console.log("todo 2 replaced? ", next.todos[1] !== state.todos[1]);
console.log("old todo 2 done: ", state.todos[1].done);

const nums = [3, 1, 2];
console.log(nums.toSorted(), nums.toReversed(), nums.with(0, 9), nums.toSpliced(1, 1), nums);

// ---------------------------------------------------------------------------
section("3. Higher-order functions");

const withLogging = (fn, name = fn.name) => (...args) => {
  const result = fn(...args);
  console.log(`${name}(${args.join(", ")}) → ${result}`);
  return result;
};
const add = (a, b) => a + b;
const loggedAdd = withLogging(add);
loggedAdd(2, 3);

// ---------------------------------------------------------------------------
section("4. Currying and partial application");

function curry(fn, arity = fn.length) {
  return function curried(...args) {
    if (args.length >= arity) return fn.apply(this, args);
    return (...more) => curried.apply(this, [...args, ...more]);
  };
}

const volume = (l, w, h) => l * w * h;
const curriedVolume = curry(volume);
console.log(curriedVolume(2)(3)(4), curriedVolume(2, 3)(4), curriedVolume(2)(3, 4), curriedVolume(2, 3, 4));

// curry relies on fn.length, which stops counting at a default or rest parameter
console.log(((a, b) => 0).length, ((a, b = 2) => 0).length, ((...xs) => 0).length);

function partial(fn, ...preset) {
  return (...later) => fn(...preset, ...later);
}
const greet = (greeting, punctuation, name) => `${greeting}, ${name}${punctuation}`;
const sayHello = partial(greet, "Hello", "!");
const sayHi = greet.bind(null, "Hi", "."); // bind is built-in partial application
console.log(sayHello("Riya"), sayHi("Sam"));

// ---------------------------------------------------------------------------
section("5. compose and pipe");

const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

const add1 = (n) => n + 1;
const double = (n) => n * 2;
console.log(compose(add1, double)(5)); // add1(double(5))
console.log(pipe(add1, double)(5)); // double(add1(5))

const slugify = pipe(
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.replace(/[^a-z0-9]+/g, "-"),
  (s) => s.replace(/^-|-$/g, "")
);
console.log(slugify("  Hello World, JS!  "));

// ---------------------------------------------------------------------------
section("6. Memoization: cache keys, LRU limit and WeakMap caches");

function memoize(fn, { key = (first) => first, maxSize = Infinity } = {}) {
  const cache = new Map();
  return function (...args) {
    const k = key(...args);
    if (cache.has(k)) {
      const value = cache.get(k);
      cache.delete(k); // re-insert so the Map's order tracks "recently used"
      cache.set(k, value);
      return value;
    }
    const value = fn.apply(this, args);
    cache.set(k, value);
    if (cache.size > maxSize) cache.delete(cache.keys().next().value); // evict the oldest
    return value;
  };
}

let slowCalls = 0;
const slowSquare = (n) => {
  slowCalls++;
  return n * n;
};
const fastSquare = memoize(slowSquare, { maxSize: 2 });
[4, 4, 5, 4, 6, 5].forEach((n) => fastSquare(n));
console.log("6 calls, real computations:", slowCalls); // 4 miss, 4 hit, 5 miss, 4 hit, 6 miss (evicts 5), 5 miss again

// Multi-argument keys
const distance = memoize((x, y) => Math.hypot(x, y), { key: (x, y) => `${x},${y}` });
console.log(distance(3, 4));

// JSON.stringify as a key is order-sensitive and lossy
console.log(JSON.stringify({ a: 1, b: 2 }) === JSON.stringify({ b: 2, a: 1 }));
console.log(JSON.stringify({ when: undefined, fn() {} }));

// WeakMap cache: keyed by object identity, entry disappears with the object
function memoizeByObject(fn) {
  const cache = new WeakMap();
  return (obj) => {
    if (!cache.has(obj)) cache.set(obj, fn(obj));
    return cache.get(obj);
  };
}
let totalRuns = 0;
const cartTotal = memoizeByObject((cart) => {
  totalRuns++;
  return cart.items.reduce((sum, item) => sum + item.price * item.qty, 0);
});
const cart = { items: [{ price: 10, qty: 2 }, { price: 5, qty: 1 }] };
console.log(cartTotal(cart), cartTotal(cart), "computed", totalRuns, "time(s)");
const updatedCart = { ...cart, items: [...cart.items, { price: 1, qty: 3 }] };
console.log(cartTotal(updatedCart), "computed", totalRuns, "time(s)"); // new object, new entry

// ---------------------------------------------------------------------------
section("7. once");

function once(fn) {
  let done = false;
  let result;
  return function (...args) {
    if (!done) {
      done = true;
      result = fn.apply(this, args);
      fn = null; // let the original function (and what it captured) be garbage-collected
    }
    return result;
  };
}
const initAnalytics = once(() => {
  console.log("analytics initialised");
  return "ready";
});
console.log(initAnalytics(), initAnalytics(), initAnalytics());

// ---------------------------------------------------------------------------
section("8. Point-free pitfalls");

console.log(["1", "2", "3"].map(parseInt)); // parseInt receives (value, index)
console.log(["1", "2", "3"].map(Number), ["1", "2", "3"].map((s) => parseInt(s, 10)));

// ---------------------------------------------------------------------------
// Debounce and throttle (full versions), used by the async part below

function debounce(fn, wait, { leading = false, trailing = true } = {}) {
  let timerId = null;
  let lastArgs;
  let lastThis;

  function invoke() {
    const args = lastArgs;
    const ctx = lastThis;
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
      if (trailing && lastArgs) invoke(); // only if calls arrived after a leading call
      lastArgs = lastThis = undefined;
    }, wait);
    if (leading && startsBurst) invoke();
  }

  debounced.cancel = () => {
    clearTimeout(timerId);
    timerId = null;
    lastArgs = lastThis = undefined;
  };
  debounced.flush = () => {
    if (timerId === null) return;
    clearTimeout(timerId);
    timerId = null;
    if (lastArgs) invoke();
  };
  return debounced;
}

function throttle(fn, wait, { leading = true, trailing = true } = {}) {
  let timerId = null;
  let lastRun = 0;
  let lastArgs;
  let lastThis;

  function invoke() {
    lastRun = Date.now();
    const args = lastArgs;
    const ctx = lastThis;
    lastArgs = lastThis = undefined;
    fn.apply(ctx, args);
  }

  function throttled(...args) {
    const now = Date.now();
    if (!lastRun && !leading) lastRun = now; // start the window without running
    lastArgs = args;
    lastThis = this;
    const remaining = wait - (now - lastRun);
    if (remaining <= 0 || remaining > wait) {
      // the window has passed (or the clock jumped back): run now
      clearTimeout(timerId);
      timerId = null;
      invoke();
    } else if (timerId === null && trailing) {
      // inside the window: run once more at its end with the latest arguments
      timerId = setTimeout(() => {
        timerId = null;
        if (lastArgs) invoke();
        if (!leading) lastRun = 0;
      }, remaining);
    }
  }

  throttled.cancel = () => {
    clearTimeout(timerId);
    timerId = null;
    lastRun = 0;
    lastArgs = lastThis = undefined;
  };
  return throttled;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function asyncSections() {
  // -------------------------------------------------------------------------
  section("9. Async memoize and async pipe");

  let requests = 0;
  const fakeFetchUser = async (id) => {
    requests++;
    await sleep(50);
    if (id < 0) throw new Error("bad id");
    return { id, name: `user-${id}` };
  };

  function memoizeAsync(fn) {
    const cache = new Map();
    return (key) => {
      if (!cache.has(key)) {
        const promise = fn(key).catch((err) => {
          cache.delete(key); // never cache a failure
          throw err;
        });
        cache.set(key, promise); // cache the promise, so concurrent callers share one request
      }
      return cache.get(key);
    };
  }

  const getUser = memoizeAsync(fakeFetchUser);
  const [a, b] = await Promise.all([getUser(7), getUser(7)]);
  console.log(a === b, "requests:", requests);
  await getUser(-1).catch((e) => console.log("first try:", e.message));
  await getUser(-1).catch((e) => console.log("retry:", e.message, "requests:", requests));

  const pipeAsync = (...fns) => (x) => fns.reduce((p, fn) => p.then(fn), Promise.resolve(x));
  const loadProfileName = pipeAsync(getUser, (user) => user.name, (name) => name.toUpperCase());
  console.log(await loadProfileName(7), "requests:", requests);

  // -------------------------------------------------------------------------
  section("10. Debounce vs throttle on the same input stream (timers)");

  // A user types "promise", one character every 100 ms (t = 0 ... 600 ms)
  const word = "promise";
  const calls = { debounce: 0, leading: 0, throttle: 0 };

  const onSearch = debounce((q) => { calls.debounce++; console.log(`         debounce 250 ms (trailing) → "${q}"`); }, 250);
  const onSearchLeading = debounce((q) => { calls.leading++; console.log(`         debounce 250 ms (leading)  → "${q}"`); }, 250, { leading: true, trailing: false });
  const onSearchThrottled = throttle((q) => { calls.throttle++; console.log(`         throttle 350 ms            → "${q}"`); }, 350);

  for (let i = 0; i < word.length; i++) {
    setTimeout(() => {
      const value = word.slice(0, i + 1);
      console.log(`t=${String(i * 100).padStart(3)}ms input "${value}"`);
      onSearch(value);
      onSearchLeading(value);
      onSearchThrottled(value);
    }, i * 100);
  }

  await sleep(1100); // the last input is at 600 ms, the trailing debounce fires at about 850 ms
  console.log(`${word.length} input events → debounce: ${calls.debounce}, leading debounce: ${calls.leading}, throttle: ${calls.throttle}`);

  // -------------------------------------------------------------------------
  section("11. cancel() and flush()");

  const save = debounce((draft) => console.log("saved:", draft), 200);
  save("draft 1");
  save.cancel(); // e.g. the component unmounted: nothing is saved
  save("draft 2");
  save.flush(); // e.g. the user closes the tab: save now instead of waiting
  await sleep(300);
  console.log("done (draft 1 was never saved)");
}

asyncSections();
