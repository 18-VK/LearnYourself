# Callbacks and Promises

> JavaScript · Topic 17 · Demo: [index.html](index.html) · [script.js](script.js) · [promise-methods.js](promise-methods.js) · Open index.html in a browser and check the devtools console

Callbacks and promises are the two building blocks JavaScript uses to deal with work that finishes later: timers, network requests, file and database access. A callback is a function you hand over to be called when the work is done; a promise is an object that stands for the future result. Everything else in async JavaScript (`async`/`await`, `fetch`) is built on top of these two ideas.

> **Note:** `index.html` loads only `promise-methods.js`; the `script.js` tag is commented out. To run the callback demo, swap the comments. Do not load both at once: they share the global scope and both declare a top-level `result`, so the second file would fail with `SyntaxError: Identifier 'result' has already been declared`.

## How JavaScript Runs Asynchronous Code

The original note said "JavaScript is an asynchronous language, which means that it can handle multiple tasks simultaneously." That needs a correction:

- The JavaScript language itself is **single-threaded and synchronous**: there is one call stack and it runs one piece of code at a time.
- The **runtime** (the browser or Node.js) provides asynchronous APIs such as `setTimeout`, `fetch`, DOM events and file I/O. The slow work happens outside the JavaScript thread.
- When that work finishes, the runtime puts a callback in a queue. The **event loop** moves it onto the call stack once the stack is empty.

So JavaScript can *start* many tasks and handle each result when it arrives. That is concurrency (taking turns), not code running in parallel. Callbacks are the basic way to say "run this code after the asynchronous operation has completed".

### The Event Loop: Call Stack, Microtasks and Macrotasks

| Part | What lives there | Examples |
|---|---|---|
| Call stack | The function that is running right now | Your synchronous code |
| Web APIs / runtime | Work running outside the JS thread | Timers, network, file I/O |
| Macrotask (task) queue | Callbacks waiting for their turn | `setTimeout`, `setInterval`, DOM events, I/O callbacks |
| Microtask queue | Higher-priority callbacks | `.then`/`.catch`/`.finally` handlers, code after `await`, `queueMicrotask` |

The loop follows these rules:

1. Run the current synchronous code until the call stack is empty.
2. Run **every** microtask in the microtask queue (including microtasks added while draining it).
3. The browser may repaint the page.
4. Take **one** macrotask, run it, then go back to step 2.

```js
console.log('1: sync start');

setTimeout(() => console.log('5: setTimeout (macrotask)'), 0);

Promise.resolve().then(() => console.log('3: promise.then (microtask)'));

queueMicrotask(() => console.log('4: queueMicrotask (microtask)'));

console.log('2: sync end');

// Output:
// 1: sync start
// 2: sync end
// 3: promise.then (microtask)
// 4: queueMicrotask (microtask)
// 5: setTimeout (macrotask)
```

`setTimeout(fn, 0)` does not mean "run now". It means "run as a macrotask after at least 0 ms", which is always after the current code and after all pending promise handlers.

> **Note:** These four rules are the simplified model, and they are enough for this note. [The Event Loop](../19-event-loop/notes.md) is the deep dive: when exactly microtasks run (not only after tasks), how `await` resumes, where rendering and `requestAnimationFrame` fit, timer clamping, yielding to the main thread, and Node's event loop phases.

## Callback Functions

### What a Callback Is

You can pass a function as an argument to another function. The function passed as an argument is called a **callback function**. The receiving function decides when to call it.

```js
// From script.js
let callbck = () => {
    console.log("Callback function called!!");
}

function print(value, callbck) {
    console.log('passed value :' + value);
    callbck();          // print() decides when the callback runs
}

print('aman', callbck);
// passed value :aman
// Callback function called!!
```

Note that you pass `callbck` (the function itself), not `callbck()` (the result of calling it).

### Why Callbacks Exist: Non-blocking Code

Callbacks are used to handle the results of asynchronous operations in a non-blocking manner. Asynchronous operations are operations that take a significant amount of time to complete, such as network requests, file I/O and database queries. If these operations were executed synchronously, the program would freeze and wait for the operation to complete before continuing. This leads to a poor user experience: the page would appear unresponsive (no clicks, no scrolling) until the work finished.

### Example: setTimeout Runs Later

The `setTimeout()` method executes a block of code after the specified time.

```js
function greet() {
    console.log('Hello world');
}

function sayName(name) {
    console.log('Hello' + ' ' + name);
}

setTimeout(greet, 2000);   // schedule greet() for 2 seconds from now
sayName('John');            // runs immediately

// Output:
// Hello John      (immediately)
// Hello world     (after 2 s)
```

Here, `greet()` is called after 2000 milliseconds (2 seconds). During this wait, `sayName('John')` is executed. That is why `Hello John` is printed before `Hello world`. The code is executed asynchronously: the second function, `sayName()`, does not wait for the first function, `greet()`, to complete.

### Benefit of Callbacks: Run Code After a Previous Step

The benefit of using a callback function is that you can wait for the result of a previous function call and then execute another function call. The demo uses `setTimeout()` to mimic a program that takes time to execute, such as data coming from the server.

```js
function greet(name, myFunction) {
    console.log('Hello world');
    // callback: executed only after greet() has done its own work
    myFunction(name);
}

function sayName(name) {
    console.log('Hello' + ' ' + name);
}

// Extra arguments after the delay are passed to the handler:
// after 2 s this calls greet('John', sayName)
setTimeout(greet, 2000, 'John', sayName);

// Output (after 2 s):
// Hello world
// Hello John
```

> **Note:** In `script.js` both versions of `greet` and `sayName` are written as function declarations in the same file. Function declarations are hoisted, and the **last one wins**, so the earlier `setTimeout(greet, 2000)` actually calls the two-parameter `greet()` with no arguments. It prints `Hello world` and then throws `TypeError: myFunction is not a function`. Give the functions different names, or use `const greet = ...` (a redeclared `const` is a `SyntaxError`, so the mistake is caught early).

Two more properties that make callbacks useful:

- **Non-blocking:** callbacks allow non-blocking programming. The program does not stop and wait for an operation to complete before continuing. This is important for the performance and responsiveness of applications.
- **Closure:** a closure is a function that has access to variables in its outer scope, even after the outer function has returned. This lets the callback use variables from the function that created it, even after that function has finished running.

```js
function loadUser(id, onDone) {
    const requestedAt = Date.now();
    setTimeout(() => {
        // This arrow function is a closure: loadUser() has already returned,
        // but id and requestedAt are still available here.
        onDone({ id, name: 'User ' + id, waitedMs: Date.now() - requestedAt });
    }, 500);
}

loadUser(7, (user) => console.log(user.name)); // User 7 (after ~0.5 s)
```

### Not Every Callback Is Asynchronous

A callback is just a function passed to another function. Array methods call their callbacks **synchronously**:

```js
console.log('before');
[1, 2].forEach((n) => console.log('item', n));
console.log('after');
// before, item 1, item 2, after
```

Only callbacks handed to asynchronous APIs (`setTimeout`, event listeners, `fs.readFile`...) run later.

### Callback Hell (Pyramid of Doom)

When each step depends on the previous one, callbacks nest inside callbacks. Node-style APIs pass an error as the first argument (`(err, result)`), so every level also needs its own error check:

```js
getUser(1, (err, user) => {
    if (err) return console.error(err);
    getOrders(user.id, (err, orders) => {
        if (err) return console.error(err);
        getOrderDetails(orders[0].id, (err, details) => {
            if (err) return console.error(err);
            console.log(details);   // the real work is buried 3 levels deep
        });
    });
});
```

Problems with this style:

- The code drifts to the right and is hard to read and change.
- Error handling is repeated at every level and easy to forget.
- **Inversion of control:** you trust the other function to call your callback exactly once. A buggy library could call it twice or never.

Promises were added (ES2015) to solve exactly these problems.

## Promises

### What a Promise Is

Before creating your own promises, see how they are used: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises

A **Promise** is an object representing the eventual completion or failure of an asynchronous operation. Instead of passing callbacks *into* a function, the function returns a promise and you attach callbacks *to* it:

```js
// Callback style: createAudioFileAsync(audioSettings, successCallback, failureCallback);
// Promise style:
createAudioFileAsync(audioSettings).then(successCallback, failureCallback);
```

### Promise States

A promise is in one of these states:

| State | Meaning |
|---|---|
| `pending` | Initial state, neither fulfilled nor rejected |
| `fulfilled` | The operation completed successfully; the promise has a **value** |
| `rejected` | The operation failed; the promise has a **reason** (usually an `Error`) |

A promise that is fulfilled or rejected is called **settled**. A settled promise never changes state again: calling `resolve` or `reject` a second time is silently ignored.

Links:
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
- https://www.freecodecamp.org/news/javascript-promise-tutorial-how-to-resolve-or-reject-promises-in-js/

### Why Use Promises?

Before promises, events and callback functions were used, but they had limited functionality and created unmanageable code. Multiple nested callbacks create **callback hell** (the pyramid of doom). Promises are the standard way to handle asynchronous operations in JavaScript.

| | Callbacks | Promises |
|---|---|---|
| Sequencing steps | Nesting | Flat `.then()` chain |
| Error handling | Check `err` at every level | One `.catch()` for the whole chain |
| Called how often | Up to the library (could be 0 or 2 times) | A promise settles exactly once |
| Combining several operations | Manual counters | `Promise.all`, `allSettled`, `race`, `any` |
| Works with `async`/`await` | No | Yes |

### Creating a Promise

```js
// From script.js
let promise1 = new Promise(function (resolve, reject) {
    if (Math.random() >= 0.5)
        resolve("I am done");          // fulfil with a value
    else
        reject('request rejected');    // reject with a reason
});
```

- The function passed to `new Promise(...)` is called the **executor**. It runs **immediately and synchronously**.
- `resolve` and `reject` are functions created by the `Promise` constructor and passed in. You do not define them yourself (the commented-out `resolve()`/`reject()` functions in `script.js` are never used). The parameter names are up to you: the demo's second promise calls them `Success` and `Failed`.
- Real code should reject with an `Error` object (`reject(new Error('request rejected'))`) so you get a stack trace. The demo uses strings to keep it short.

```js
console.log('A');
const p = new Promise((resolve) => {
    console.log('B: executor runs immediately');
    resolve('done');
});
p.then((value) => console.log('D:', value));
console.log('C');

// A
// B: executor runs immediately
// C
// D: done
```

Shortcuts for promises that are already settled: `Promise.resolve(value)` and `Promise.reject(reason)`.

A common use of the constructor is wrapping a callback API ("promisifying" it):

```js
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

delay(1000).then(() => console.log('1 second later'));
```

### Consuming a Promise: then(), catch(), finally()

**`then()`** is used with a callback that runs when the promise is fulfilled (resolved). It can also take a second callback for the rejected case:

```js
promiseObject.then(onFulfilled, onRejected);
```

```js
promise1.then((value) => {
    // fulfilled
    console.log(value);
}, (err) => {
    // rejected
    console.log(err);
});
```

The parameters (`value`, `err`) receive whatever was passed to `resolve()` or `reject()`. They are optional if you do not need the value.

**`catch()`** is used with a callback that runs when the promise is rejected or an error is thrown. It is shorthand for `.then(undefined, onRejected)`.

```js
promise1.then((val) => {
    console.log(val);           // "I am done"
}).catch((err) => {
    console.log(err);           // "request rejected"
});
```

**`finally()`** runs when the promise settles, whether it was fulfilled or rejected. Its callback receives no argument and the original value or error passes through unchanged. Use it for cleanup such as hiding a loading spinner.

```js
promise1
    .then((val) => console.log(val))
    .catch((err) => console.log(err))
    .finally(() => console.log('request finished'));   // always logs
```

> **Note:** `then(onOk, onFail)` and `then(onOk).catch(onFail)` are **not** the same. In the first form, an error thrown inside `onOk` is not caught by `onFail`. In the second form, `.catch()` catches rejections of the original promise *and* errors thrown inside `onOk`. Prefer `.then().catch()`.

### Chaining Promises

`Promise.prototype.then()`, `catch()` and `finally()` all associate further actions with a promise that becomes settled. Because each of these methods **returns a new promise**, they can be chained.

`.then()` takes up to two arguments: the first is a callback for the fulfilled case, the second a callback for the rejected case. Each `.then()` returns a newly generated promise object, which can be used for chaining.

Here's the magic: the `then()` function returns a new promise, different from the original:

```js
const promise = doSomething();
const promise2 = promise.then(successCallback, failureCallback);
```

This second promise (`promise2`) represents the completion not just of `doSomething()`, but also of the `successCallback` or `failureCallback` you passed in. Those can be other asynchronous functions returning a promise. When that's the case, any callbacks added to `promise2` get queued behind the promise returned by either `successCallback` or `failureCallback`.

What the promise returned by `then()` does depends on what your handler does:

| Your handler... | The promise returned by `then()`... |
|---|---|
| returns a value `v` | fulfills with `v` |
| returns nothing | fulfills with `undefined` |
| returns a promise | waits for it and copies its result |
| throws an error | rejects with that error |

The demo builds a chain in two steps:

```js
// From script.js
let ObjPromise = new Promise((Success, Failed) => {
    if (Math.random() >= 0.5)
        Success("Request successfully completed");
    else
        Failed('Error as Request rejected');
});

let result = ObjPromise.then((val) => {
    console.log(val);
    return "Result :" + val;   // without this return, the next step receives undefined
});
// console.log(result) here would show a pending Promise, not the string

// The next step waits for ObjPromise and the first handler, then uses their result
result.then((resultofObjPromise) => {
    console.log(resultofObjPromise);
}).catch((err) => {
    console.log(err);          // a rejection of ObjPromise skips the handlers above and lands here
});

// Fulfilled run:
// Request successfully completed
// Result :Request successfully completed
// Rejected run:
// Error as Request rejected
```

#### Always Return From a Handler ("Floating" Promises)

If the previous handler started a promise but did not return it, there's no way to track its settlement anymore, and the promise is said to be **floating**.

```js
doSomething()
    .then((url) => {
        // Missing `return` keyword in front of fetch(url).
        fetch(url);
    })
    .then((result) => {
        // result is undefined, because nothing is returned from the previous
        // handler. There's no way to know the return value of the fetch()
        // call anymore, or whether it succeeded at all.
    });
```

By returning the result of the `fetch` call (which is a promise), we can both track its completion and receive its value when it completes:

```js
doSomething()
    .then((url) => {
        // `return` keyword added
        return fetch(url);
    })
    .then((result) => {
        // result is a Response object
    });
```

#### Flat Chains Instead of Nesting

It's better to use a chain of promises than a chain of callbacks. One `.catch()` at the end handles a failure in any step above it:

```js
promise.then(result => {
    // result is a JSON string here (for example the text of a PokeAPI response)
    let onePokemon = JSON.parse(result).results[0].url;
    return onePokemon;
}).then(onePokemonURL => {
    console.log(onePokemonURL);
}).catch(error => {
    console.log('In the catch', error);
});
```

A rejection skips every following `.then()` until it reaches a `.catch()`. After the `.catch()` handler runs, the chain continues as fulfilled with whatever the handler returned, so `.catch()` can also be used to recover with a default value.

## Promise Static Methods (Combinators)

These methods take an iterable (usually an array) of promises and return **one** promise. Non-promise values in the array (like `93` in the demo) are treated as already-fulfilled promises.

Links:
- https://dev.to/swarnaliroy94/methods-of-promise-all-any-finally-o2e
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
- https://www.programiz.com/javascript/promise

| Method | Settles when | Fulfills with | Rejects with | Empty array |
|---|---|---|---|---|
| `Promise.all()` | All fulfill, or the first one rejects | Array of values, in input order | The first rejection reason | Fulfills with `[]` |
| `Promise.allSettled()` | All have settled | Array of `{ status, value }` / `{ status, reason }` | Never rejects | Fulfills with `[]` |
| `Promise.race()` | The first one settles (either way) | That first value | That first reason | Stays pending forever |
| `Promise.any()` | The first one fulfills, or all reject | That first value | `AggregateError` with all reasons | Rejects with `AggregateError` |

The demo (`promise-methods.js`) uses these inputs:

```js
const ObjPromise1 = new Promise((resolve, reject) => {
    setTimeout(resolve, 300, "resolved");   // handler, time, argument to handler
});
const ObjPromise2 = new Promise((resolve, reject) => {
    if (Math.random() >= 0.5)
        setTimeout(resolve, 100, "resolved2");
    else
        reject("Rejected!");                 // rejects immediately
});
const ObjPromise3 = 93;                      // a non-promise value
```

### Promise.all()

Waits for all promises to be fulfilled, or for any one to be rejected.

`Promise.all()` accepts an iterable, such as an array of promises, and returns a single promise that fulfills with an array of the results. The results are in the **same order as the input**, not the order in which they finished. When all input promises have been fulfilled, or the input contains no promises, the returned promise is fulfilled.

It rejects as soon as any input promise rejects, with that first rejection reason.

**Rejection of `Promise.all()`: fail-fast behavior.** `Promise.all()` rejects with the reason of the promise that rejected first, without waiting for the others. For example, if we pass in two promises that resolve after a timeout and one promise that rejects immediately, then `Promise.all()` rejects immediately; it does not matter whether the other promises have resolved yet.

```js
const pro1 = new Promise((resolve, reject) => {
    setTimeout(() => resolve("one"), 1000);
});

const pro2 = new Promise((resolve, reject) => {
    setTimeout(() => resolve("two"), 2000);
});

const pro3 = new Promise((resolve, reject) => {
    setTimeout(() => reject("rejected"), 3000);
});

Promise.all([pro1, pro2, pro3])
    .then((values) => {
        console.log(values);
    })
    .catch((error) => {
        console.log(error);
    });

// expected output: rejected   (after 3 s)
```

> **Note:** In this example the rejection happens *last* (3 s), so it does not really show fail-fast. Change `3000` to `500` and `rejected` is printed after 0.5 s, without waiting for `"one"` and `"two"`. The other promises are **not cancelled**: their timers still run, their results are just ignored.

Demo (`promise-methods.js`):

```js
const result = Promise.all([ObjPromise1, ObjPromise2, ObjPromise3]); // includes a non-promise
console.log(result);                 // Promise { <pending> }  (logged synchronously)

result.then((values) => {
    console.log("Using Promise.all()");
    console.log(values);             // [ 'resolved', 'resolved2', 93 ]  (after 300 ms)
}).catch((msg) => {
    console.log("Using Promise.all()");
    console.log(msg);                // "Rejected!"  (when ObjPromise2 rejects)
});
```

### Promise.allSettled()

Waits until all promises are settled (fulfilled or rejected).

`Promise.allSettled()` takes an iterable of promises and returns a single promise. That promise fulfills when all of the input's promises settle (including when an empty iterable is passed), with an array of objects that describe the outcome of each promise. It never rejects, which makes it the right choice when you want every result even if some fail.

```js
const objAllSettle = Promise.allSettled([ObjPromise1, ObjPromise2, ObjPromise3]);

objAllSettle.then((values) => {
    console.log("Using Promise.allsettle()");
    console.log(values);
});

// When ObjPromise2 rejected:
// [
//   { status: 'fulfilled', value: 'resolved' },
//   { status: 'rejected',  reason: 'Rejected!' },
//   { status: 'fulfilled', value: 93 }
// ]
```

### Promise.race()

Waits until any one of the promises settles (fulfilled **or** rejected).

`Promise.race()` returns a promise that is fulfilled or rejected as soon as one of the promises in the iterable fulfills or rejects, with the value or reason from that promise. If the iterable is empty, the returned promise stays pending forever.

```js
const pro1 = new Promise((resolve) => setTimeout(() => resolve("one"), 200));
const pro2 = new Promise((resolve) => setTimeout(() => resolve("two"), 100));
const pro3 = new Promise((resolve, reject) => setTimeout(() => reject("rejected"), 300));
const pro4 = new Promise((resolve) => setTimeout(() => resolve("four"), 400));

Promise.race([pro1, pro2, pro3, pro4])
    .then((response) => console.log(response))   // two  (fastest, at 100 ms)
    .catch((err) => console.log(err));
```

A common use is adding a timeout to any promise:

```js
function withTimeout(promise, ms) {
    let timerId;
    const timeout = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    });
    // clearTimeout so the timer does not keep running after the race is decided
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}

withTimeout(new Promise((r) => setTimeout(r, 2000, 'slow')), 500)
    .then(console.log)
    .catch((err) => console.log(err.message));    // Timed out after 500 ms
```

### Promise.any()

Fulfills as soon as any one of the promises **fulfills**. Rejections are ignored unless every promise rejects.

Unlike `Promise.all()`, this method returns the first promise that fulfills. It short-circuits: as soon as one promise is fulfilled, it does not wait for the others.

```js
const resultAny = Promise.any([ObjPromise1, ObjPromise2]);

resultAny.then((value) => {
    console.log("Using Promise.any()");
    console.log(value);
    // "resolved2" if ObjPromise2 fulfilled (100 ms beats 300 ms)
    // "resolved"  if ObjPromise2 rejected (the rejection is ignored)
});
```

**Rejection of `Promise.any()`:** it rejects with an `AggregateError` if no promise fulfills. `AggregateError` represents several errors wrapped in a single error; its `errors` property is an array of all the rejection reasons. It is used when an operation needs to report multiple errors.

> **Note:** The "Rejection of Promise.any()" part of `promise-methods.js` attaches `.then()/.catch()` to `ObjPromise` instead of to `rejection`. So the `catch` logs `Reject` (not an `AggregateError`), and the `AggregateError` from `rejection` has no handler, which shows up as `Uncaught (in promise) AggregateError: All promises were rejected` in the console. Attach the handlers to the promise returned by `Promise.any()`:

```js
const onlyPromise = new Promise((resolve, reject) => {
    setTimeout(reject, 100, "Reject");
});

Promise.any([onlyPromise])
    .then((value) => console.log(value))
    .catch((err) => {
        console.log(err instanceof AggregateError); // true
        console.log(err.errors);                    // [ 'Reject' ]
        console.log(err.message);                   // e.g. "All promises were rejected" (text varies by browser)
    });
```

### Full Output of promise-methods.js

`ObjPromise2` is random, so there are two possible runs:

```js
// Run 1: ObjPromise2 fulfilled
// Promise { <pending> }
// Using Promise.any()
// resolved2
// Reject
// Uncaught (in promise) AggregateError: All promises were rejected
// Using Promise.race()
// two
// Using Promise.all()
// [ 'resolved', 'resolved2', 93 ]
// Using Promise.allsettle()
// [ {status:'fulfilled', value:'resolved'}, {status:'fulfilled', value:'resolved2'}, {status:'fulfilled', value:93} ]

// Run 2: ObjPromise2 rejected
// Promise { <pending> }
// Using Promise.all()
// Rejected!
// Reject
// Uncaught (in promise) AggregateError: All promises were rejected
// Using Promise.race()
// two
// Using Promise.any()
// resolved
// Using Promise.allsettle()
// [ {status:'fulfilled', value:'resolved'}, {status:'rejected', reason:'Rejected!'}, {status:'fulfilled', value:93} ]
```

## Common Mistakes

- **Forgetting to `return` inside `.then()`.** The next step gets `undefined` and the inner promise floats with nobody handling its errors.
- **Nesting `.then()` inside `.then()`.** This recreates callback hell. Return the inner promise and continue the chain at the same level.
- **No `.catch()` at the end of a chain.** A rejection without a handler becomes an "unhandled promise rejection": an error in the browser console, and in Node.js (v15+) it crashes the process by default.
- **Attaching handlers to the wrong promise**, as in the demo's `Promise.any()` example.
- **Thinking `new Promise` makes code asynchronous.** The executor runs synchronously; a heavy loop inside it still freezes the page. Only the `.then()` callbacks run later.
- **Rejecting with strings.** `reject('failed')` gives no stack trace. Use `reject(new Error('failed'))`.
- **Expecting `Promise.all()` to cancel the remaining work** when one input rejects. It only stops waiting.
- **Wrapping a promise in `new Promise` for no reason** (`new Promise(res => fetch(url).then(res))`). This loses rejections; just return `fetch(url)`.
- **Declaring the same function twice**, as `script.js` does with `greet`: the last declaration silently replaces the first.

## Key Takeaways

- JavaScript runs on one thread; asynchronous work is done by the runtime and its callbacks are queued by the event loop.
- Promise handlers are **microtasks** and run before the next `setTimeout` callback (a **macrotask**).
- A callback is a function passed to another function to be called later; deep nesting of them is callback hell.
- A promise is `pending`, then settles once to `fulfilled` (value) or `rejected` (reason) and never changes again.
- `then()`, `catch()` and `finally()` each return a new promise, so they chain; always `return` from handlers and end the chain with `.catch()`.
- `all` = all must succeed (fail-fast), `allSettled` = wait for everything, `race` = first to settle, `any` = first to succeed (`AggregateError` if none).

## Interview Questions

### Junior (0–1 year)

**Q1. What is a callback function? Give an example.**
A callback is a function passed as an argument to another function, which calls it at the right moment. For example, `setTimeout(() => console.log('done'), 1000)` passes an arrow function that the timer calls after one second, and `[1, 2].map(n => n * 2)` passes a callback that `map` calls for each element. Callbacks can be synchronous (array methods) or asynchronous (timers, events, I/O).

**Q2. What is callback hell and how do promises fix it?**
Callback hell is deeply nested callbacks where every async step depends on the previous one, with error checks repeated at each level. It is hard to read, easy to get wrong, and you have to trust each library to call your callback exactly once. Promises flatten the code into a `.then()` chain, handle all errors in one `.catch()`, and guarantee that each promise settles only once.

**Q3. What are the states of a promise? Can a fulfilled promise become rejected later?**
`pending`, `fulfilled` and `rejected`; fulfilled and rejected together are called "settled". No: once a promise is settled its state and value are fixed. Any later call to `resolve` or `reject` is ignored.

**Q4. What is the difference between `.then()`, `.catch()` and `.finally()`?**
`.then(onFulfilled, onRejected)` runs when the promise settles and is mainly used for the success value. `.catch(onRejected)` handles rejections and errors thrown earlier in the chain. `.finally(fn)` runs in both cases, receives no argument and passes the original result through; it is used for cleanup like hiding a loader. All three return a new promise.

**Q5. In what order does this log?**
```js
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('D');
```
`A`, `D`, `C`, `B`. Synchronous code runs first (`A`, `D`). Then the microtask queue is drained (`C`, the promise handler). Only then does the event loop take the next macrotask, the `setTimeout` callback (`B`), even though its delay is 0.

**Q6. What does `.then()` return, and what happens if the handler does not return anything?**
`.then()` always returns a new promise. If the handler returns a value, the new promise fulfills with it; if it returns a promise, the new promise follows that one; if it throws, the new promise rejects. If the handler returns nothing, the new promise fulfills with `undefined`, so the next `.then()` receives `undefined`. This is the "floating promise" bug when you forget `return fetch(url)`.

**Q7. What is the difference between `Promise.all()` and `Promise.allSettled()`?**
`Promise.all()` fulfills with an array of values only if every input fulfills, and rejects as soon as one rejects (fail-fast). `Promise.allSettled()` always waits for every input and fulfills with an array of `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }` objects; it never rejects. Use `all` when every result is required, `allSettled` when partial success is acceptable (for example a dashboard with independent widgets).

### Mid-level (2–4 years)

**Q8. Predict the output and explain it in terms of the event loop.**
```js
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve()
    .then(() => {
        console.log('C');
        setTimeout(() => console.log('D'), 0);
    })
    .then(() => console.log('E'));
queueMicrotask(() => console.log('F'));
console.log('G');
```
Output: `A G C F E B D`. Sync code logs `A` and `G`. The microtask queue then holds the first `.then` handler and the `queueMicrotask` callback, in that order, so `C` and `F` log. Running the first handler fulfilled its promise, which queued the second handler, so `E` logs while the queue is still being drained. Then the macrotasks run in the order they were scheduled: `B` (scheduled during sync code), then `D` (scheduled inside `C`).

**Q9. What is the difference between `Promise.race()` and `Promise.any()`? What is an `AggregateError`?**
`race` settles with the first promise that settles, success or failure, so one fast rejection makes it reject. `any` waits for the first **fulfillment** and ignores rejections; it only rejects when every input has rejected, and then the reason is an `AggregateError` whose `errors` array holds every individual reason. Use `race` for timeouts; use `any` for "try several mirrors and take the first one that works".

**Q10. What is the difference between `p.then(onOk, onFail)` and `p.then(onOk).catch(onFail)`?**
In `p.then(onOk, onFail)`, `onFail` only handles a rejection of `p`. If `onOk` throws, that error goes to the *next* promise in the chain and may end up unhandled. In `p.then(onOk).catch(onFail)`, the catch is attached to the promise returned by `then`, so it handles both a rejection of `p` and an error thrown in `onOk`. The second form is the safer default.

**Q11. How do you convert a callback-based function into a promise-based one?**
Wrap the call in `new Promise` and map the callback's error and result to `reject` and `resolve`:
```js
function promisify(fn) {
    return (...args) => new Promise((resolve, reject) => {
        fn(...args, (err, result) => (err ? reject(err) : resolve(result)));
    });
}

function readConfig(path, callback) {          // error-first callback API
    setTimeout(() => {
        if (!path) callback(new Error('No path given'));
        else callback(null, { path, debug: true });
    }, 100);
}

const readConfigAsync = promisify(readConfig);
readConfigAsync('app.json').then((cfg) => console.log(cfg)); // { path: 'app.json', debug: true }
```
In Node.js the built-in `util.promisify` does the same for error-first callbacks, and many core modules already have promise versions (`fs/promises`).

**Q12. Does the Promise executor run synchronously? What does this print?**
```js
const p = new Promise((resolve, reject) => {
    console.log(1);
    resolve(2);
    reject(new Error('ignored'));
    console.log(3);
});
p.then((v) => console.log(v));
console.log(4);
```
`1 3 4 2`. The executor runs synchronously during `new Promise`, so `1` and `3` log immediately; `resolve` does not stop the function. The `reject` call is ignored because the promise is already settled. `4` is sync code, and `2` comes last because `.then` handlers always run as microtasks, even for an already-fulfilled promise.

**Q13. Write a simplified `Promise.all()`.**
```js
function promiseAll(items) {
    return new Promise((resolve, reject) => {
        const results = [];
        let remaining = items.length;
        if (remaining === 0) return resolve(results);

        items.forEach((item, index) => {
            Promise.resolve(item).then((value) => {
                results[index] = value;      // keep input order, not finish order
                remaining -= 1;
                if (remaining === 0) resolve(results);
            }, reject);                      // first rejection wins (fail-fast)
        });
    });
}

promiseAll([Promise.resolve(1), 2, new Promise((r) => setTimeout(r, 50, 3))])
    .then(console.log); // [ 1, 2, 3 ]
```
The key points interviewers look for: `Promise.resolve(item)` to accept non-promise values, storing by index to preserve order, a counter rather than `results.length` (arrays with holes), and an immediate resolve for an empty input.

**Q14. How do you run a list of async tasks one after another, using only promises (no `async`/`await`)?**
Chain them with `reduce`, starting from an already-fulfilled promise, so each task starts only after the previous one fulfilled:
```js
const delay = (ms, value) => new Promise((resolve) => setTimeout(resolve, ms, value));
const tasks = [() => delay(300, 'a'), () => delay(100, 'b'), () => delay(200, 'c')];

tasks
    .reduce(
        (chain, task) => chain.then((results) => task().then((value) => [...results, value])),
        Promise.resolve([])
    )
    .then((results) => console.log(results)); // [ 'a', 'b', 'c' ] after about 600 ms
```
The array holds *functions* that create promises. An array of promises would already be running in parallel, because a promise starts its work when it is created.

### Senior (5+ years)

**Q15. A shared `getConfig(callback)` helper calls the callback synchronously when the config is cached, and asynchronously after a fetch otherwise. Why is that a bug, and what rules should async APIs in a shared library follow?**
The caller cannot know whether the code after `getConfig(...)` runs before or after the callback, so the same code behaves differently depending on the cache: a variable assigned after the call is sometimes still `undefined` inside the callback, and an exception thrown by the callback sometimes escapes into the caller's `try` and sometimes does not. This "sometimes sync, sometimes async" behaviour (nicknamed "releasing Zalgo") causes bugs that appear only with a warm cache, or only in tests.
```js
// ❌ The order depends on the cache
function getConfig(callback) {
    if (cache) return callback(cache);                              // synchronous
    fetchConfig().then((cfg) => { cache = cfg; callback(cfg); });   // asynchronous
}

// ✅ Always asynchronous: promise handlers never run synchronously
function getConfigAsync() {
    if (cache) return Promise.resolve(cache);
    return fetchConfig().then((cfg) => (cache = cfg));
}
```
Rules for a shared library: a function that can be async is always async and always returns a promise (never `T | Promise<T>`); it reports failures by rejecting, never by throwing synchronously (an `async` function does this for you); it rejects with `Error` subclasses that carry a `code`; long operations accept an `AbortSignal`; and one function does not offer both callback and promise styles. Recommendation: return a promise from every function that might wait, and let promise semantics guarantee one consistent order.

**Q16. You need to migrate a large Node.js codebase from error-first callbacks to promises and `async`/`await`. How do you plan it?**

- **Bottom-up, at the boundaries.** Promisify the lowest-level callback APIs first (`util.promisify`, `fs/promises`, or a hand-written wrapper for non-standard callbacks), so new code can `await` immediately while old callers keep working.
- **One implementation.** Where external consumers still need the callback version, implement with promises and add a thin deprecated adapter (`util.callbackify`) instead of keeping two implementations.
- **Watch the semantic traps.** Callbacks that fire more than once (progress, events) must become events or async iterators, not promises; methods that use `this` need binding before promisifying; code that relied on a callback running synchronously changes order.
- **Make rejections safe first.** Since Node 15 an unhandled rejection crashes the process, so a forgotten `await` or `.catch` becomes an outage. Add `@typescript-eslint/no-floating-promises` and process-level `unhandledRejection` logging before the first migrated module ships.
- **Module by module, behind tests,** paying special attention to error paths, timeouts and retries, which are the parts most likely to change behaviour.

Recommendation: wrap at the bottom, migrate callers incrementally, and put the floating-promise lint in place before the first pull request, not after the first incident.

**Q17. In production some operations "hang": the spinner never stops, and logs show the operation started but never finished. How do you debug a promise that never settles, and how do you design against it?**
A promise that never settles produces no error, no rejection and no log: `await` just waits forever, and everything it holds (closures, sockets, DOM nodes) stays in memory. Typical causes: a `new Promise` wrapper with a path that calls neither `resolve` nor `reject` (an `error` event nobody listens for, an early `return`), a callback API that never calls back on some failure, waiting for an event that already fired, or a request with no timeout to a server that never answers.
```js
// ❌ Never settles if the image fails to load
const loadImage = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
});

// ✅ Settles on success, failure, timeout or cancellation
const loadImageSafe = (src, signal = AbortSignal.timeout(10_000)) => new Promise((resolve, reject) => {
    signal.throwIfAborted();                       // throwing in the executor rejects the promise
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    img.src = src;
});
```
Debug by logging start and finish with an operation id, finding which branch of the wrapper ran, and using DevTools' async stack traces to see who is waiting. Design against it: every wrapper handles both the success and the failure signal, every network or I/O call has a deadline (`AbortSignal.timeout()`, combined with the caller's signal through `AbortSignal.any([...])`), and `finally` always resets UI state such as spinners. Recommendation: no unbounded waits at system boundaries; enforce a timeout and a cancellation path in the shared request and promisify helpers so individual call sites cannot forget them.

## References

- [MDN: Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- [MDN: Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [MDN: Promise.all()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
- [MDN: Promise.allSettled()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- [MDN: Promise.race()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race)
- [MDN: Promise.any()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any)
- [MDN: AggregateError](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError)
- [MDN: Callback function](https://developer.mozilla.org/en-US/docs/Glossary/Callback_function)
- [freeCodeCamp: JavaScript Promise tutorial](https://www.freecodecamp.org/news/javascript-promise-tutorial-how-to-resolve-or-reject-promises-in-js/)
- [DEV: Methods of Promise (all, any, finally)](https://dev.to/swarnaliroy94/methods-of-promise-all-any-finally-o2e)
- [Programiz: JavaScript Promise](https://www.programiz.com/javascript/promise)
