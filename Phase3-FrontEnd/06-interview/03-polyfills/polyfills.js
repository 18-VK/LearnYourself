// Polyfills and implement-it-yourself interview questions, each with a self-test.
// Run with: node polyfills.js   (Node 18+; prints one "pass" line per item)
'use strict';

const assert = require('node:assert/strict');

const sleep = (ms, value) => new Promise((resolve) => setTimeout(resolve, ms, value));

// ---------------------------------------------------------------------------
// 0. Installing a polyfill safely: feature-detect, then add a NON-enumerable property
// ---------------------------------------------------------------------------
function definePolyfill(target, name, impl) {
  if (name in target) return false; // the platform already has it: never overwrite
  Object.defineProperty(target, name, { value: impl, writable: true, configurable: true });
  return true;
}

// The interview convention is a "my" prefix so the real method is not replaced.
const install = (target, name, impl) =>
  Object.defineProperty(target, name, { value: impl, writable: true, configurable: true });

// ---------------------------------------------------------------------------
// 1-3. Function.prototype.call / apply / bind
// ---------------------------------------------------------------------------
install(Function.prototype, 'myCall', function (thisArg, ...args) {
  if (typeof this !== 'function') throw new TypeError('myCall must be called on a function');
  // Sloppy-mode rules: null/undefined -> globalThis, primitives are boxed
  const context = thisArg == null ? globalThis : Object(thisArg);
  const key = Symbol('fn'); // unique key: cannot clash with an existing property
  context[key] = this; // calling it as context[key]() makes `this` === context
  try {
    return context[key](...args);
  } finally {
    delete context[key]; // clean up even if the function throws
  }
});

install(Function.prototype, 'myApply', function (thisArg, argsArray) {
  if (argsArray != null && typeof argsArray !== 'object') {
    throw new TypeError('CreateListFromArrayLike called on non-object');
  }
  return this.myCall(thisArg, ...(argsArray == null ? [] : Array.from(argsArray)));
});

install(Function.prototype, 'myBind', function (thisArg, ...preset) {
  const target = this;
  if (typeof target !== 'function') throw new TypeError('Bind must be called on a function');

  function bound(...later) {
    const args = [...preset, ...later];
    if (new.target) {
      // `new bound()` ignores thisArg and constructs the original function
      return Reflect.construct(target, args, new.target === bound ? target : new.target);
    }
    return Reflect.apply(target, thisArg, args);
  }

  // Native bound functions delegate instanceof to the target
  Object.defineProperty(bound, Symbol.hasInstance, { value: (v) => v instanceof target });
  Object.defineProperty(bound, 'name', { value: `bound ${target.name}` });
  Object.defineProperty(bound, 'length', { value: Math.max(0, target.length - preset.length) });
  return bound;
});

// ---------------------------------------------------------------------------
// 4-7. Array.prototype.map / filter / reduce / flat
// ---------------------------------------------------------------------------
function assertCallable(fn) {
  if (typeof fn !== 'function') throw new TypeError(`${String(fn)} is not a function`);
}

install(Array.prototype, 'myMap', function (callback, thisArg) {
  assertCallable(callback);
  const arr = Object(this);
  const len = arr.length >>> 0; // read once: items pushed during the loop are not visited
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    if (i in arr) result[i] = callback.call(thisArg, arr[i], i, arr); // holes stay holes
  }
  return result;
});

install(Array.prototype, 'myFilter', function (callback, thisArg) {
  assertCallable(callback);
  const arr = Object(this);
  const len = arr.length >>> 0;
  const result = [];
  for (let i = 0; i < len; i++) {
    if (i in arr && callback.call(thisArg, arr[i], i, arr)) result.push(arr[i]);
  }
  return result;
});

install(Array.prototype, 'myReduce', function (callback, ...rest) {
  assertCallable(callback);
  const arr = Object(this);
  const len = arr.length >>> 0;
  let i = 0;
  let acc;
  if (rest.length > 0) {
    acc = rest[0]; // an explicit `undefined` initial value still counts
  } else {
    while (i < len && !(i in arr)) i++; // skip leading holes
    if (i >= len) throw new TypeError('Reduce of empty array with no initial value');
    acc = arr[i++];
  }
  for (; i < len; i++) {
    if (i in arr) acc = callback(acc, arr[i], i, arr);
  }
  return acc;
});

install(Array.prototype, 'myFlat', function (depth = 1) {
  const result = [];
  const visit = (arr, d) => {
    for (let i = 0; i < arr.length; i++) {
      if (!(i in arr)) continue; // flat() removes holes
      const v = arr[i];
      if (Array.isArray(v) && d > 0) visit(v, d - 1);
      else result.push(v);
    }
  };
  visit(Object(this), Math.trunc(Number(depth)) || 0);
  return result;
});

// Iterative flat: an explicit stack instead of recursion, so very deep nesting cannot overflow the call stack
function flatIterative(input, depth = 1) {
  const result = [];
  const stack = [{ arr: input, i: 0, depth }];
  while (stack.length) {
    const top = stack[stack.length - 1];
    if (top.i >= top.arr.length) { stack.pop(); continue; }
    const i = top.i++;
    if (!(i in top.arr)) continue; // skip holes
    const v = top.arr[i];
    if (Array.isArray(v) && top.depth > 0) stack.push({ arr: v, i: 0, depth: top.depth - 1 });
    else result.push(v);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 8-11. Promise.all / allSettled / any / race
// ---------------------------------------------------------------------------
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve(results);
    items.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value; // input order, not finish order
        if (--remaining === 0) resolve(results);
      }, reject); // first rejection wins
    });
  });
}

function promiseAllSettled(iterable) {
  return promiseAll(
    Array.from(iterable, (item) =>
      Promise.resolve(item).then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason }),
      ),
    ),
  );
}

function promiseAny(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const errors = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return reject(new AggregateError([], 'All promises were rejected'));
    items.forEach((item, i) => {
      Promise.resolve(item).then(resolve, (err) => {
        errors[i] = err;
        if (--remaining === 0) reject(new AggregateError(errors, 'All promises were rejected'));
      });
    });
  });
}

function promiseRace(iterable) {
  return new Promise((resolve, reject) => {
    for (const item of iterable) Promise.resolve(item).then(resolve, reject); // [] -> pending forever
  });
}

// ---------------------------------------------------------------------------
// 12. A minimal Promise (then / catch / finally / resolve / reject)
// ---------------------------------------------------------------------------
class MyPromise {
  #state = 'pending';
  #value;
  #handlers = [];

  constructor(executor) {
    let done = false; // resolve/reject work only once, even if resolved with a pending thenable
    const resolve = (v) => { if (!done) { done = true; this.#resolveWith(v); } };
    const reject = (r) => { if (!done) { done = true; this.#settle('rejected', r); } };
    try {
      executor(resolve, reject); // the executor runs synchronously
    } catch (err) {
      reject(err);
    }
  }

  #resolveWith(value) {
    if (value === this) return this.#settle('rejected', new TypeError('Chaining cycle detected'));
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
      let then;
      try {
        then = value.then; // read once: a getter could change its answer
      } catch (err) {
        return this.#settle('rejected', err);
      }
      if (typeof then === 'function') {
        // Adopt the thenable's state. Native promises also do this in a microtask.
        queueMicrotask(() => {
          let called = false;
          try {
            then.call(
              value,
              (v) => { if (!called) { called = true; this.#resolveWith(v); } },
              (r) => { if (!called) { called = true; this.#settle('rejected', r); } },
            );
          } catch (err) {
            if (!called) { called = true; this.#settle('rejected', err); }
          }
        });
        return;
      }
    }
    this.#settle('fulfilled', value);
  }

  #settle(state, value) {
    if (this.#state !== 'pending') return;
    this.#state = state;
    this.#value = value;
    this.#handlers.forEach((h) => this.#schedule(h));
    this.#handlers = [];
  }

  #schedule({ onFulfilled, onRejected, resolve, reject }) {
    queueMicrotask(() => { // handlers always run asynchronously, even if already settled
      const fulfilled = this.#state === 'fulfilled';
      const handler = fulfilled ? onFulfilled : onRejected;
      if (typeof handler !== 'function') {
        return fulfilled ? resolve(this.#value) : reject(this.#value); // pass through
      }
      try {
        resolve(handler(this.#value));
      } catch (err) {
        reject(err);
      }
    });
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const handler = { onFulfilled, onRejected, resolve, reject };
      if (this.#state === 'pending') this.#handlers.push(handler);
      else this.#schedule(handler);
    });
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  finally(onFinally) {
    return this.then(
      (value) => MyPromise.resolve(onFinally()).then(() => value),
      (reason) => MyPromise.resolve(onFinally()).then(() => { throw reason; }),
    );
  }

  static resolve(value) {
    return value instanceof MyPromise ? value : new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }
}

// ---------------------------------------------------------------------------
// 13-15. debounce, throttle, setInterval via setTimeout
// ---------------------------------------------------------------------------
function debounce(fn, wait, { leading = false, trailing = true } = {}) {
  let timer = null;
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
    const callNow = leading && timer === null; // first call of a burst
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs) invoke(); // only if there were calls after the leading one
    }, wait);
    if (callNow) invoke();
  }

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
    lastArgs = lastThis = undefined;
  };
  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    if (lastArgs) invoke();
  };
  return debounced;
}

function throttle(fn, wait) {
  let last = 0; // time of the last real call
  let timer = null;
  let pendingArgs = null;
  let pendingThis;

  function invoke(ctx, args) {
    last = Date.now();
    fn.apply(ctx, args);
  }

  function throttled(...args) {
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      invoke(this, args); // leading edge
    } else {
      pendingArgs = args; // remember only the latest call
      pendingThis = this;
      timer ??= setTimeout(() => {
        timer = null;
        invoke(pendingThis, pendingArgs); // trailing edge: the final state is never lost
        pendingArgs = null;
      }, remaining);
    }
  }

  throttled.cancel = () => {
    clearTimeout(timer);
    timer = null;
    pendingArgs = null;
    last = 0;
  };
  return throttled;
}

function mySetInterval(fn, delay, ...args) {
  const handle = { id: null, active: true };
  const schedule = () => {
    handle.id = setTimeout(() => {
      if (!handle.active) return;
      fn(...args);
      if (handle.active) schedule(); // next tick only after this one finished: no overlap
    }, delay);
  };
  schedule();
  return handle;
}

function myClearInterval(handle) {
  handle.active = false;
  clearTimeout(handle.id);
}

// ---------------------------------------------------------------------------
// 16-17. Deep clone (cycles, special types) and deep equal
// ---------------------------------------------------------------------------
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value; // primitives; functions are shared
  if (seen.has(value)) return seen.get(value); // cycles and shared references

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);
    value.forEach((v, k) => copy.set(deepClone(k, seen), deepClone(v, seen)));
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    value.forEach((v) => copy.add(deepClone(v, seen)));
    return copy;
  }

  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy); // register BEFORE recursing, or a cycle recurses forever
  for (const key of Reflect.ownKeys(value)) { // includes symbol keys
    if (Object.getOwnPropertyDescriptor(value, key).enumerable) {
      copy[key] = deepClone(value[key], seen);
    }
  }
  return copy;
}

function deepEqual(a, b, seen = new Map()) {
  if (a === b || (a !== a && b !== b)) return true; // same value, or both NaN
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (seen.get(a) === b) return true; // already comparing this pair: a cycle
  seen.set(a, b);

  if (a instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp) return a.source === b.source && a.flags === b.flags;
  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !deepEqual(v, b.get(k), seen)) return false;
    return true;
  }
  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false; // members compared by identity
    return true;
  }
  if (Array.isArray(a) && a.length !== b.length) return false;

  const keysA = Reflect.ownKeys(a).filter((k) => Object.prototype.propertyIsEnumerable.call(a, k));
  const keysB = Reflect.ownKeys(b).filter((k) => Object.prototype.propertyIsEnumerable.call(b, k));
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k], seen));
}

// ---------------------------------------------------------------------------
// 18. EventEmitter: on / off / once / emit
// ---------------------------------------------------------------------------
class EventEmitter {
  #events = new Map(); // event name -> array of listeners

  on(name, listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    if (!this.#events.has(name)) this.#events.set(name, []);
    this.#events.get(name).push(listener);
    return this; // chainable
  }

  off(name, listener) {
    const list = this.#events.get(name);
    if (!list) return this;
    // match the wrapper created by once() too; remove the most recently added copy
    const i = list.findLastIndex((l) => l === listener || l.listener === listener);
    if (i !== -1) list.splice(i, 1);
    if (list.length === 0) this.#events.delete(name);
    return this;
  }

  once(name, listener) {
    const wrapper = (...args) => {
      this.off(name, wrapper); // remove first, so a re-entrant emit cannot call it twice
      listener.apply(this, args);
    };
    wrapper.listener = listener; // lets off(name, listener) find it
    return this.on(name, wrapper);
  }

  emit(name, ...args) {
    const list = this.#events.get(name);
    if (!list) return false;
    for (const listener of [...list]) listener.apply(this, args); // snapshot: safe if listeners change
    return true;
  }

  listenerCount(name) {
    return this.#events.get(name)?.length ?? 0;
  }
}

// ---------------------------------------------------------------------------
// 19-21. curry, compose / pipe, once
// ---------------------------------------------------------------------------
function curry(fn, arity = fn.length) {
  return function curried(...args) {
    if (args.length >= arity) return fn.apply(this, args);
    return (...more) => curried.apply(this, [...args, ...more]);
  };
}

// Variadic "sum(1)(2)(3)()" variant: an empty call ends the chain
function sum(a) {
  return (b) => (b === undefined ? a : sum(a + b));
}

const pipe = (...fns) => (input) => fns.reduce((acc, fn) => fn(acc), input);
const compose = (...fns) => (input) => fns.reduceRight((acc, fn) => fn(acc), input);
const pipeAsync = (...fns) => (input) => fns.reduce((p, fn) => p.then(fn), Promise.resolve(input));

function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true; // set first: a throwing or re-entrant fn still runs only once
      result = fn.apply(this, args);
      fn = null; // release the function (and its closure) for garbage collection
    }
    return result;
  };
}

// ---------------------------------------------------------------------------
// 22-23. The new operator and instanceof
// ---------------------------------------------------------------------------
function myNew(Constructor, ...args) {
  if (typeof Constructor !== 'function') throw new TypeError(`${String(Constructor)} is not a constructor`);
  const proto = Constructor.prototype;
  const obj = Object.create(proto !== null && typeof proto === 'object' ? proto : Object.prototype);
  const result = Constructor.apply(obj, args);
  // An object (or function) returned by the constructor replaces `obj`; primitives are ignored
  return result !== null && (typeof result === 'object' || typeof result === 'function') ? result : obj;
}

function myInstanceOf(value, Constructor) {
  if (typeof Constructor !== 'function') {
    throw new TypeError("Right-hand side of 'instanceof' is not callable");
  }
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  const target = Constructor.prototype;
  for (let proto = Object.getPrototypeOf(value); proto !== null; proto = Object.getPrototypeOf(proto)) {
    if (proto === target) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 24-25. Retry with exponential backoff, concurrency-limited task pool
// ---------------------------------------------------------------------------
function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(signal.reason);
    }, { once: true });
  });
}

async function retry(task, {
  retries = 3, baseDelay = 200, maxDelay = 5000, factor = 2,
  jitter = true, shouldRetry = () => true, signal,
} = {}) {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await task(attempt); // `await` here so a rejection is caught by this try
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const cap = Math.min(maxDelay, baseDelay * factor ** attempt);
      await abortableSleep(jitter ? Math.random() * cap : cap, signal); // "full jitter"
    }
  }
}

async function runWithConcurrency(tasks, limit) {
  if (!(limit >= 1)) throw new RangeError('limit must be at least 1');
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++; // claimed synchronously, so two workers never take the same task
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Self-tests
// ---------------------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('definePolyfill: feature detection, non-enumerable install', () => {
  const nativeFlat = Array.prototype.flat;
  assert.equal(definePolyfill(Array.prototype, 'flat', () => 'fake'), false);
  assert.equal(Array.prototype.flat, nativeFlat); // the real one was not overwritten
  const target = {};
  assert.equal(definePolyfill(target, 'shiny', () => 42), true);
  assert.equal(target.shiny(), 42);
  assert.deepEqual(Object.keys(target), []); // invisible to for...in and Object.keys
});

function greet(greeting, punct) {
  return `${greeting}, ${this.name}${punct}`;
}

test('Function.prototype.call', () => {
  const ada = { name: 'Ada' };
  assert.equal(greet.myCall(ada, 'Hi', '!'), 'Hi, Ada!');
  assert.deepEqual(Object.getOwnPropertySymbols(ada), []); // temporary key removed
  assert.equal(function () { return typeof this; }.myCall(5), 'object'); // boxed primitive
});

test('Function.prototype.apply', () => {
  assert.equal(greet.myApply({ name: 'Ada' }, ['Hello', '?']), 'Hello, Ada?');
  assert.equal(Math.max.myApply(null, [1, 7, 3]), 7);
  assert.equal(function () { return arguments.length; }.myApply(null), 0);
});

test('Function.prototype.bind (including new)', () => {
  const hello = greet.myBind({ name: 'Ada' }, 'Hello');
  assert.equal(hello('.'), 'Hello, Ada.');
  assert.equal(hello.myCall({ name: 'Bob' }, '!'), 'Hello, Ada!'); // cannot re-bind this
  assert.equal(hello.name, 'bound greet');
  assert.equal(hello.length, 1);

  function Point(x, y) { this.x = x; this.y = y; }
  const PointAtX1 = Point.myBind({ ignored: true }, 1);
  const p = new PointAtX1(2);
  assert.deepEqual({ ...p }, { x: 1, y: 2 }); // bound this ignored by new
  assert.ok(p instanceof Point && p instanceof PointAtX1);
  assert.equal(Object.getPrototypeOf(p), Point.prototype);

  class Box { constructor(v) { this.v = v; } }
  assert.equal(new (Box.myBind(null, 9))().v, 9); // works with classes too
});

test('Array.prototype.map', () => {
  assert.deepEqual([1, 2, 3].myMap((n, i) => n * 10 + i), [10, 21, 32]);
  const sparse = [1, , 3].myMap((n) => n * 2); // eslint-disable-line no-sparse-arrays
  assert.equal(1 in sparse, false); // hole preserved
  assert.equal(sparse.length, 3);
  assert.deepEqual([1].myMap(function () { return this.k; }, { k: 'ctx' }), ['ctx']);
  const grow = [1, 2];
  assert.deepEqual(grow.myMap((n) => { grow.push(0); return n; }), [1, 2]); // length read once
  assert.throws(() => [1].myMap(null), TypeError);
});

test('Array.prototype.filter', () => {
  assert.deepEqual([1, 2, 3, 4].myFilter((n) => n % 2 === 0), [2, 4]);
  assert.deepEqual([0, , 2].myFilter(() => true), [0, 2]); // eslint-disable-line no-sparse-arrays
  assert.deepEqual(Array.prototype.myFilter.call('abc', (c) => c !== 'b'), ['a', 'c']); // array-like
});

test('Array.prototype.reduce', () => {
  assert.equal([1, 2, 3].myReduce((a, b) => a + b), 6);
  assert.equal([1, 2, 3].myReduce((a, b) => a + b, 10), 16);
  assert.throws(() => [].myReduce((a, b) => a + b), TypeError);
  assert.equal([].myReduce((a, b) => a + b, undefined), undefined); // explicit undefined is an initial value
  assert.equal([, 5].myReduce((a, b) => a + b), 5); // eslint-disable-line no-sparse-arrays
});

test('Array.prototype.flat (and an iterative version)', () => {
  const nested = [1, [2, [3, [4]]], , 5]; // eslint-disable-line no-sparse-arrays
  assert.deepEqual(nested.myFlat(), [1, 2, [3, [4]], 5]); // hole removed
  assert.deepEqual(nested.myFlat(Infinity), [1, 2, 3, 4, 5]);
  assert.deepEqual(nested.myFlat(Infinity), nested.flat(Infinity)); // same as the native one
  assert.deepEqual([[1]].myFlat(0), [[1]]);

  assert.deepEqual(flatIterative(nested, Infinity), [1, 2, 3, 4, 5]);
  assert.deepEqual(flatIterative(nested), nested.flat());
  let deep = [42];
  for (let i = 0; i < 50_000; i++) deep = [deep]; // far deeper than the call stack allows
  assert.throws(() => deep.myFlat(Infinity), RangeError); // recursive version overflows
  assert.deepEqual(flatIterative(deep, Infinity), [42]); // iterative version copes
});

test('Promise.all', async () => {
  assert.deepEqual(await promiseAll([sleep(20, 'slow'), 'plain', Promise.resolve('fast')]), ['slow', 'plain', 'fast']);
  assert.deepEqual(await promiseAll([]), []);
  await assert.rejects(promiseAll([sleep(20, 1), Promise.reject(new Error('boom'))]), /boom/);
});

test('Promise.allSettled', async () => {
  const err = new Error('no');
  assert.deepEqual(await promiseAllSettled([1, Promise.reject(err)]), [
    { status: 'fulfilled', value: 1 },
    { status: 'rejected', reason: err },
  ]);
});

test('Promise.any', async () => {
  assert.equal(await promiseAny([Promise.reject(new Error('a')), sleep(80, 'b'), sleep(5, 'c')]), 'c');
  const err = await promiseAny([Promise.reject(new Error('x')), Promise.reject(new Error('y'))]).catch((e) => e);
  assert.ok(err instanceof AggregateError);
  assert.deepEqual(err.errors.map((e) => e.message), ['x', 'y']); // input order
  assert.ok((await promiseAny([]).catch((e) => e)) instanceof AggregateError);
});

test('Promise.race', async () => {
  assert.equal(await promiseRace([sleep(80, 'slow'), sleep(5, 'fast')]), 'fast');
  await assert.rejects(promiseRace([sleep(20, 'slow'), Promise.reject(new Error('first'))]), /first/);
  const winner = await Promise.race([promiseRace([]), sleep(20, 'timeout')]);
  assert.equal(winner, 'timeout'); // race([]) never settles
});

test('Minimal Promise (MyPromise)', async () => {
  const log = [];
  const p = new MyPromise((resolve) => { log.push('executor'); resolve(1); resolve(2); });
  p.then((v) => log.push(`then ${v}`));
  log.push('sync');
  await sleep(0);
  assert.deepEqual(log, ['executor', 'sync', 'then 1']); // executor sync, handlers async, settle once

  const chained = await new MyPromise((resolve) => setTimeout(resolve, 5, 2))
    .then((v) => v * 10)
    .then((v) => new MyPromise((resolve) => resolve(v + 1))) // adopts a MyPromise
    .then((v) => Promise.resolve(v + 1)) // adopts a native promise (any thenable)
    .then((v) => { throw new Error(`fail at ${v}`); })
    .then(() => 'skipped')
    .catch((e) => e.message)
    .finally(() => 'ignored'); // finally passes the value through
  assert.equal(chained, 'fail at 22'); // await works because MyPromise is a thenable

  const selfRef = MyPromise.resolve(1).then(() => selfRef);
  await assert.rejects(selfRef.then(), TypeError); // chaining cycle detected
  assert.equal(await MyPromise.reject(new Error('r')).catch((e) => e.message), 'r');

  const query = { then(resolve) { resolve('rows'); } }; // any object with a then() method
  assert.equal(await query, 'rows'); // await calls then()
  assert.equal(await MyPromise.resolve(query), 'rows'); // MyPromise adopts thenables too
});

test('debounce (trailing, leading, cancel, flush)', async () => {
  const calls = [];
  const d = debounce((v) => calls.push(v), 20);
  d(1); d(2); d(3);
  assert.deepEqual(calls, []);
  await sleep(40);
  assert.deepEqual(calls, [3]); // one call, latest arguments

  const lead = [];
  const l = debounce((v) => lead.push(v), 20, { leading: true });
  l('a'); l('b'); l('c');
  assert.deepEqual(lead, ['a']); // immediately on the first call
  await sleep(40);
  assert.deepEqual(lead, ['a', 'c']); // plus a trailing call for the rest of the burst

  const c = debounce(() => calls.push('cancelled'), 10);
  c(); c.cancel();
  const f = debounce((v) => calls.push(v), 1000);
  f('flushed'); f.flush();
  await sleep(20);
  assert.deepEqual(calls, [3, 'flushed']);
});

test('throttle (leading and trailing)', async () => {
  const calls = [];
  const t = throttle((v) => calls.push(v), 30);
  for (let i = 1; i <= 5; i++) t(i); // a burst within one window
  assert.deepEqual(calls, [1]); // leading call
  await sleep(50);
  assert.deepEqual(calls, [1, 5]); // trailing call with the latest value
  await sleep(40);
  t(6);
  assert.deepEqual(calls, [1, 5, 6]); // window passed: runs immediately again
  t.cancel();
});

test('setInterval via setTimeout', async () => {
  let count = 0;
  const handle = mySetInterval(() => {
    count++;
    if (count === 3) myClearInterval(handle); // clearing from inside the callback works
  }, 10);
  await sleep(80);
  assert.equal(count, 3);
});

test('deep clone (cycles, shared refs, special types)', () => {
  class User { constructor(n) { this.name = n; } hi() { return `hi ${this.name}`; } }
  const shared = { id: 1 };
  const sym = Symbol('tag');
  const original = {
    date: new Date(0), re: /a+/gi, map: new Map([['k', shared]]), set: new Set([1, 2]),
    list: [shared, shared], user: new User('Ada'), [sym]: 'symbol value', fn: Math.max,
  };
  original.self = original;

  const copy = deepClone(original);
  assert.notEqual(copy, original);
  assert.equal(copy.self, copy); // cycle points to the copy
  assert.equal(copy.list[0], copy.list[1]); // shared reference stays shared
  assert.notEqual(copy.list[0], shared);
  assert.equal(copy.map.get('k'), copy.list[0]);
  assert.ok(copy.date instanceof Date && copy.date !== original.date);
  assert.equal(copy.re.flags, 'gi');
  assert.equal(copy.user.hi(), 'hi Ada'); // prototype kept (structuredClone would drop it)
  assert.equal(copy[sym], 'symbol value');
  assert.equal(copy.fn, Math.max); // functions are shared, not cloned
});

test('deep equal', () => {
  assert.ok(deepEqual({ a: [1, { b: NaN }], d: new Date(5) }, { a: [1, { b: NaN }], d: new Date(5) }));
  assert.ok(!deepEqual({ a: 1 }, { a: 1, b: undefined })); // extra key
  assert.ok(!deepEqual([1, 2], { 0: 1, 1: 2, length: 2 })); // different prototypes
  assert.ok(!deepEqual([, 1], [undefined, 1])); // eslint-disable-line no-sparse-arrays
  assert.ok(deepEqual(new Map([['x', { y: 1 }]]), new Map([['x', { y: 1 }]])));
  assert.ok(!deepEqual(new Set([1]), new Set([2])));
  const a = { v: 1 }; a.self = a;
  const b = { v: 1 }; b.self = b;
  assert.ok(deepEqual(a, b)); // cycles terminate
});

test('EventEmitter (on, off, once, emit)', () => {
  const bus = new EventEmitter();
  const log = [];
  const onSave = (id) => log.push(`save ${id}`);
  const selfRemoving = () => { log.push('self'); bus.off('save', selfRemoving); };
  const onceListener = (id) => log.push(`once ${id}`);

  bus.on('save', selfRemoving).on('save', onSave).once('save', onceListener);
  assert.equal(bus.emit('save', 1), true);
  bus.emit('save', 2);
  assert.deepEqual(log, ['self', 'save 1', 'once 1', 'save 2']); // no listener skipped

  bus.once('close', onceListener);
  bus.off('close', onceListener); // off() with the original function removes a once wrapper
  assert.equal(bus.emit('close'), false);
  assert.equal(bus.listenerCount('save'), 1);
});

test('curry', () => {
  const volume = curry((l, w, h) => l * w * h);
  assert.equal(volume(2)(3)(4), 24);
  assert.equal(volume(2, 3)(4), 24);
  assert.equal(volume(2)(3, 4), 24);
  const withDefault = (a, b = 2) => a * b; // length is 1, so pass the arity explicitly
  assert.equal(curry(withDefault, 2)(5)(3), 15);
  assert.equal(sum(1)(2)(3)(), 6);
});

test('compose / pipe', async () => {
  const add1 = (n) => n + 1;
  const double = (n) => n * 2;
  assert.equal(pipe(add1, double)(5), 12); // left to right: (5 + 1) * 2
  assert.equal(compose(add1, double)(5), 11); // right to left: 5 * 2 + 1
  assert.equal(pipe()(7), 7); // no functions = identity
  assert.equal(await pipeAsync(add1, async (n) => n * 10)(1), 20);
});

test('once', () => {
  let runs = 0;
  const init = once((x) => { runs++; return x * 2; });
  assert.equal(init(5), 10);
  assert.equal(init(100), 10); // same result, not re-run
  assert.equal(runs, 1);
});

test('new operator', () => {
  function Person(name) { this.name = name; }
  Person.prototype.hi = function () { return `hi ${this.name}`; };
  const p = myNew(Person, 'Ada');
  assert.equal(p.hi(), 'hi Ada');
  assert.ok(p instanceof Person);

  function ReturnsObject() { this.a = 1; return { b: 2 }; }
  function ReturnsPrimitive() { this.a = 1; return 42; }
  assert.deepEqual(myNew(ReturnsObject), { b: 2 }); // object return wins
  assert.deepEqual({ ...myNew(ReturnsPrimitive) }, { a: 1 }); // primitive return ignored
  assert.throws(() => myNew(class X {}), TypeError); // classes need real `new` (or Reflect.construct)
});

test('instanceof', () => {
  class Animal {}
  class Dog extends Animal {}
  const d = new Dog();
  assert.equal(myInstanceOf(d, Dog), true);
  assert.equal(myInstanceOf(d, Animal), true);
  assert.equal(myInstanceOf(d, Object), true);
  assert.equal(myInstanceOf('text', String), false); // primitives are never instances
  assert.equal(myInstanceOf(Object.create(null), Object), false);
  assert.throws(() => myInstanceOf(d, {}), TypeError);
});

test('retry with exponential backoff', async () => {
  let attempts = 0;
  const flaky = async () => {
    attempts++;
    if (attempts < 3) throw new Error(`fail ${attempts}`);
    return 'ok';
  };
  const start = Date.now();
  assert.equal(await retry(flaky, { baseDelay: 10, jitter: false }), 'ok');
  assert.equal(attempts, 3);
  assert.ok(Date.now() - start >= 25); // waited about 10 + 20 ms

  let calls = 0;
  const notFound = Object.assign(new Error('404'), { status: 404 });
  await assert.rejects(
    retry(async () => { calls++; throw notFound; }, { baseDelay: 1, shouldRetry: (e) => e.status >= 500 }),
    /404/,
  );
  assert.equal(calls, 1); // client errors are not retried

  const controller = new AbortController();
  const pending = retry(async () => { throw new Error('down'); }, { baseDelay: 1000, signal: controller.signal });
  controller.abort(new Error('user left the page'));
  await assert.rejects(pending, /user left the page/); // abort stops the backoff wait
});

test('concurrency-limited task pool', async () => {
  let running = 0;
  let maxRunning = 0;
  const makeTask = (ms, value) => async () => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    await sleep(ms);
    running--;
    return value;
  };
  const tasks = [makeTask(30, 'a'), makeTask(10, 'b'), makeTask(20, 'c'), makeTask(5, 'd'), makeTask(5, 'e')];
  assert.deepEqual(await runWithConcurrency(tasks, 2), ['a', 'b', 'c', 'd', 'e']); // input order
  assert.equal(maxRunning, 2);
  assert.deepEqual(await runWithConcurrency([], 3), []);
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`pass  ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${name}\n      ${err.message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exitCode = failed ? 1 : 0;
})();
