# async/await and the Fetch API

> JavaScript · Topic 18 · Demo: [index.html](index.html) · [script.js](script.js) · Open index.html in a browser and check the devtools console (needs network access)

"`async` and `await` make promises easier to write." They let you write promise-based code that reads top to bottom like ordinary synchronous code, with normal `try`/`catch` for errors. The Fetch API is the modern, promise-based way to make HTTP requests from JavaScript, so it is the most common place you will use `await`.

## async/await in One Sentence Each

- `async` makes a function return a Promise.
- `await` makes the function wait for a Promise (it pauses only that function, not the whole program).

Links:
- https://www.programiz.com/javascript/async-await
- https://www.freecodecamp.org/news/javascript-async-await/
- https://w3schools.com/js/js_async.asp

`async`/`await` (ES2017) is not a new kind of asynchrony. It is syntax on top of promises: everything in [Callbacks and Promises](../17-callbacks-and-promises/notes.md) (states, microtasks, `Promise.all`) still applies.

## The async Keyword

We use the `async` keyword with a function to mark it as an asynchronous function. An async function **always returns a promise**.

```js
async function name(parameter1, parameter2, ...parameterN) {
    // statements
}
```

```js
async function myFunction() {
    return "Hello";
}

// Is the same as:

function myFunction() {
    return Promise.resolve("Hello");
}
```

The rules for the returned promise:

| Inside the async function you... | The returned promise... |
|---|---|
| `return value` | fulfills with `value` |
| return nothing | fulfills with `undefined` |
| `return somePromise` | follows `somePromise` |
| `throw error` (or an awaited promise rejects) | rejects with `error` |

`async` works with every function form:

```js
async function f() {}                  // declaration
const g = async function () {};        // expression
const h = async () => {};              // arrow function
const obj = { async load() {} };       // method
class Api { async get() {} }           // class method
```

The commented-out start of `script.js` shows that you get a promise back, not the string:

```js
async function getDataFromServer() {
    return "Data from server!!";
}
console.log("Fetching data from server");
let result = getDataFromServer();   // returns a promise
result.then((data) => {
    console.log(result);   // Promise { 'Data from server!!' }  (Chrome: Promise {<fulfilled>: 'Data from server!!'})
    console.log(data);     // Data from server!!
}).catch((Err) => {
    console.log(Err);
});
```

## The await Keyword

The `await` keyword is used inside an async function to wait for an asynchronous operation.

```js
let result = await promise;
```

The fulfilled value of the promise becomes the value of the `await` expression. In other words, without `await` you get the **Promise object**; with `await` you get the **value inside it**.

The original note said that with `await` "we get the resolved value or rejected value". More precisely:

- If the promise **fulfills**, `await` returns its value.
- If the promise **rejects**, `await` **throws** the rejection reason at that line. You handle it with `try`/`catch` (see below), not by reading a return value.

### Demo Walkthrough

```js
// Simulating the process of fetching data from a server
let promise = new Promise(function (resolve, reject) {
    setTimeout(function () {
        resolve('Promise resolved');
    }, 4000);
});

async function asyncFunc() {
    // without await
    let ObjResult;
    ObjResult = promise;
    console.log("Without await promise as object returned : ");
    console.log(ObjResult);                  // Promise { <pending> }

    // wait until the promise resolves
    ObjResult = await promise;
    console.log("With await promise's rejected or resolved value returned : ");
    console.log(ObjResult);                  // Promise resolved
    // ObjResult is now a plain string, so .then()/.catch() cannot be used on it
    console.log("Process completed");
}

asyncFunc().then(() => {
    console.log('Successfully completed');   // asyncFunc() itself returns a promise
}).catch(() => {
    console.log("error");
});
```

Output, together with the `UseOfFetch()` call at the end of `script.js`:

```js
// Without await promise as object returned :
// Promise { <pending> }
// { userId: 1, id: 1, title: 'delectus aut autem', completed: false }   <- fetch finishes first (well under 4 s)
// With await promise's rejected or resolved value returned :           <- after 4 s
// Promise resolved
// Process completed
// Successfully completed
```

`UseOfFetch()` is called while `asyncFunc()` is still paused at its `await`. That proves `await` does not block the page: other code keeps running.

### How await Works With the Event Loop

When execution reaches `await`, the async function is **suspended** and control returns to the caller. When the awaited promise settles, the rest of the function is scheduled as a **microtask**.

```js
async function task() {
    console.log('2: inside task, before await');
    await null;                                   // even a non-promise value causes a pause
    console.log('4: after await (microtask)');
}

console.log('1: start');
task();
console.log('3: end of sync code');

// 1: start
// 2: inside task, before await
// 3: end of sync code
// 4: after await (microtask)
```

Everything **before** the first `await` runs synchronously, like a promise executor. How many microtask ticks an `await` costs, and output puzzles built on it, are in [The Event Loop](../19-event-loop/notes.md#how-await-resumes).

### Where You Can Use await

- Inside an `async` function.
- At the top level of an **ES module** (`<script type="module">`, or `.mjs` files in Node.js). This is called top-level await.
- **Not** at the top level of a classic script like this demo's `<script src="script.js">`, and not inside a normal (non-async) callback. That is a `SyntaxError`.

## Error Handling With async/await

Use `try`/`catch`/`finally`, exactly like synchronous code:

```js
async function loadTodo(id) {
    try {
        const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        console.error('Could not load todo:', err.message);
        return null;                        // recover with a fallback value
    } finally {
        console.log('loadTodo finished');   // runs on success and on failure
    }
}
```

Or let the error propagate and handle it where the function is called:

```js
loadTodo(1).then((todo) => console.log(todo));
// or, inside another async function:
// const todo = await loadTodo(1);
```

## .then() Chains vs async/await

| | `.then()` chain | `async`/`await` |
|---|---|---|
| Readability | Callbacks inside a chain | Reads top to bottom like sync code |
| Error handling | `.catch()` | `try`/`catch`, or `.catch()` on the call |
| Using earlier results in later steps | Needs nesting or outer variables | Every result is a normal local variable |
| Loops and conditions | Awkward (recursion, `reduce`) | Normal `for`, `if`, `while` |
| Debugging | Stepping jumps between callbacks | Step through line by line |
| Under the hood | Promises | Also promises |

The same request written both ways (the first version is the commented-out code in `script.js`):

```js
// .then() chain
fetch('https://jsonplaceholder.typicode.com/todos/1')
    .then(response => response.json())
    .then(json => console.log(json));

// async/await
async function UseOfFetch() {
    const responseobj = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    const responseData = await responseobj.json();
    console.log(responseData);
    // { userId: 1, id: 1, title: 'delectus aut autem', completed: false }
}
UseOfFetch();
```

## Sequential vs Parallel await

`await` in a row makes each step wait for the previous one. That is right when step 2 needs the result of step 1, but wasteful when the steps are independent.

```js
const delay = (ms, value) => new Promise((resolve) => setTimeout(resolve, ms, value));

async function sequential() {
    console.time('sequential');
    const a = await delay(1000, 'a');   // wait 1 s
    const b = await delay(1000, 'b');   // then wait another 1 s
    console.timeEnd('sequential');      // sequential: ~2000 ms
    return [a, b];
}

async function parallel() {
    console.time('parallel');
    // Both timers start immediately; await waits for both together
    const [a, b] = await Promise.all([delay(1000, 'a'), delay(1000, 'b')]);
    console.timeEnd('parallel');        // parallel: ~1000 ms
    return [a, b];
}
```

Use `Promise.allSettled()` instead of `Promise.all()` when one failure should not throw away the other results.

> **Note:** `array.forEach(async (item) => { await ... })` does **not** wait. `forEach` ignores the promises its callback returns, so the code after the loop runs before the items are processed. Use `for...of` with `await` for one-at-a-time, or `await Promise.all(array.map(async (item) => ...))` for all-at-once.

## The Fetch API

This note covers the basics of `fetch`. CORS, credentials, cookies and HTTP caching are covered in [Networking, CORS and caching](../../04-browser-platform/03-networking-cors-caching/notes.md).

The Fetch API provides a JavaScript interface for making HTTP requests and handling responses. It provides a global `fetch()` method that gives an easy, logical way to fetch resources asynchronously across the network. It is available in all modern browsers and, since Node.js 18, in Node.js too.

Unlike `XMLHttpRequest`, which is a callback/event-based API, Fetch is **promise-based**. It is a better alternative and can also be used in service workers.

### A Simple GET Request

```js
async function logMovies() {
    // a simple "GET" request
    const response = await fetch("http://example.com/movies.json"); // fulfills with a Response object
    const movies = await response.json();   // read the body and parse it as JSON (also a promise)
    console.log(movies);
}
```

### Why Two awaits? The Response Object

`fetch()` fulfills as soon as the **headers** arrive. The body may still be downloading, so reading it is a second asynchronous step.

| Response member | What it gives you |
|---|---|
| `response.ok` | `true` if the status is 200–299 |
| `response.status` / `statusText` | e.g. `404` / `"Not Found"` |
| `response.headers` | `Headers` object: `response.headers.get('Content-Type')` |
| `response.json()` | Promise of the body parsed as JSON |
| `response.text()` | Promise of the body as a string |
| `response.blob()` / `arrayBuffer()` / `formData()` | Promise of the body in other formats |

> **Note:** The body can be read only once. Calling `response.json()` and then `response.text()` on the same response gives a promise that rejects with a `TypeError` (the body was already used). Use `response.clone()` before the first read if you really need the body twice.

### fetch() Does Not Reject on HTTP Errors

`fetch()` only rejects when the request could not be made at all (network down, DNS failure, CORS blocked, request aborted). A `404` or `500` response is still a **fulfilled** promise. You must check `response.ok` yourself:

```js
async function getJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.json();
}

getJSON('https://jsonplaceholder.typicode.com/todos/999999')
    .then((data) => console.log(data))
    .catch((err) => console.log(err.message)); // HTTP 404 Not Found
```

### POST Request With Options

The second argument to `fetch()` is an options object.

```js
// Example POST method implementation:
async function postData(url = "", data = {}) {
    // Default options are marked with *
    const response = await fetch(url, {
        method: "POST",             // *GET, POST, PUT, DELETE, etc.
        mode: "cors",               // no-cors, *cors, same-origin
        cache: "no-cache",          // *default, no-cache, reload, force-cache, only-if-cached
        credentials: "same-origin", // include, *same-origin, omit
        headers: {
            "Content-Type": "application/json",
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: "follow",         // manual, *follow, error
        referrerPolicy: "no-referrer", // no-referrer, no-referrer-when-downgrade, origin, origin-when-cross-origin,
                                       // same-origin, strict-origin, *strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
    return response.json(); // parses JSON response into native JavaScript objects
}

postData("https://example.com/answer", { answer: 42 }).then((data) => {
    console.log(data); // JSON data parsed by the `response.json()` call
});
```

> **Note:** Older versions of this MDN example marked `no-referrer-when-downgrade` as the default referrer policy. Modern browsers default to `strict-origin-when-cross-origin`. Also, `example.com` is a placeholder; to try a POST for real, use `https://jsonplaceholder.typicode.com/posts`, which replies `201` with your data plus an `id` (it does not actually store anything).

The options you will use most:

| Option | Purpose |
|---|---|
| `method` | `GET` (default), `POST`, `PUT`, `PATCH`, `DELETE` |
| `headers` | Request headers, e.g. `Content-Type`, `Authorization` |
| `body` | Request data: a string (`JSON.stringify(obj)`), `FormData`, `Blob`, `URLSearchParams`. Not allowed with `GET` |
| `credentials` | Whether cookies are sent: `omit`, `same-origin` (default), `include` |
| `signal` | An `AbortSignal` used to cancel the request |
| `mode`, `cache`, `redirect`, `referrerPolicy` | CORS mode, HTTP cache use, redirect handling, referrer header |

### Timeouts and Cancelling With AbortController

`fetch()` has no `timeout` option. Use an `AbortSignal`:

```js
// Cancel manually, e.g. when the user leaves the page or types a new search
const controller = new AbortController();
fetch('https://jsonplaceholder.typicode.com/todos/1', { signal: controller.signal })
    .then((res) => res.json())
    .catch((err) => console.log(err.name)); // AbortError
controller.abort();

// Built-in timeout signal
async function fetchWithTimeout(url, ms = 5000) {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(ms) });
        return await response.json();
    } catch (err) {
        if (err.name === 'TimeoutError') throw new Error(`Request took longer than ${ms} ms`);
        throw err;
    }
}
```

### fetch vs XMLHttpRequest

| | `fetch()` | `XMLHttpRequest` (XHR) |
|---|---|---|
| API style | Promises, works with `await` | Events and callbacks (`onload`, `onerror`) |
| HTTP 404/500 | Fulfills; check `response.ok` | `onload` fires; check `xhr.status` |
| Reading JSON | `await response.json()` | `JSON.parse(xhr.responseText)` or `responseType = 'json'` |
| Cancel | `AbortController` | `xhr.abort()` |
| Upload progress events | Not available | `xhr.upload.onprogress` |
| Service workers / Node.js | Available | Browser main thread and workers only |

### JSON.parse() vs response.json()

| | `JSON.parse(text)` | `response.json()` |
|---|---|---|
| Input | A string you already have | The body stream of a `Response` |
| Returns | The parsed value, synchronously | A **promise** of the parsed value |
| Invalid JSON | Throws `SyntaxError` | Rejects with `SyntaxError` |
| Needs `await` | No | Yes |

## Common Mistakes

- **Forgetting `await`.** `const data = response.json(); console.log(data.title)` logs `undefined`, because `data` is a Promise. The same mistake on `fetch()` gives you a Promise instead of a Response.
- **Not checking `response.ok`.** A 404 or 500 page then gets passed to `response.json()`, which usually fails with a confusing `SyntaxError: Unexpected token '<'` (the server sent HTML).
- **Awaiting independent requests one by one** in a loop or in a row. Start them together and `await Promise.all(...)`.
- **Using `async` callbacks with `forEach`**, then expecting the code after the loop to wait.
- **Calling an async function without handling its rejection** (`loadData();` with no `await`, no `.catch()`). Errors become unhandled promise rejections.
- **Using `await` at the top level of a classic script**, which is a `SyntaxError`. Wrap the code in an async function or use `<script type="module">`.
- **Sending an object as `body` without `JSON.stringify()`.** The server receives the string `"[object Object]"`.
- **Forgetting the `Content-Type: application/json` header** on a JSON POST, so the server does not parse the body.

## Key Takeaways

- An `async` function always returns a promise; `return` fulfills it and `throw` rejects it.
- `await` unwraps a promise's value, or throws its rejection reason; it pauses only the current async function.
- Code after `await` continues as a microtask, so `async`/`await` follows the same event loop rules as `.then()`.
- Handle errors with `try`/`catch`/`finally`, or with `.catch()` where the async function is called.
- Independent operations should run in parallel with `Promise.all()` / `Promise.allSettled()`, not in a sequence of awaits.
- `fetch()` needs two steps (`await fetch()`, then `await response.json()`) and does **not** reject on HTTP errors; check `response.ok`.
- Use `AbortController` / `AbortSignal.timeout()` to cancel requests or add a timeout.

## Interview Questions

### Junior (0–1 year)

**Q1. What does the `async` keyword do? What does an async function return?**
`async` marks a function as asynchronous, which lets you use `await` inside it and makes it always return a promise. A returned value becomes the fulfillment value (`async () => 5` returns a promise of `5`), and a thrown error becomes a rejection. So callers use `await fn()` or `fn().then(...)` to get the result.

**Q2. What does `await` do? Does it block the browser?**
`await` pauses the current async function until the promise settles, then returns its value (or throws its rejection reason). It does not block the thread: while the function is paused, the event loop keeps running other code, handling clicks and rendering. The rest of the function resumes later as a microtask.

**Q3. Can you use `await` outside an async function?**
Only at the top level of an ES module (`<script type="module">` or an `.mjs` file), which is called top-level await. In a classic script or inside a normal function, `await` is a `SyntaxError`. The usual fix is to wrap the code in an async function, or call `.then()` on the promise.

**Q4. How do you handle errors with async/await?**
Wrap the awaited calls in `try`/`catch`; a rejected promise makes `await` throw, so it lands in `catch`. Use `finally` for cleanup that must always run, such as hiding a loader. Alternatively, let the error propagate and attach `.catch()` where the async function is called.

**Q5. Why do we need two `await`s with `fetch()`?**
`await fetch(url)` gives a `Response` object as soon as the status and headers arrive. The body may still be streaming, so `response.json()` (or `.text()`) is a second asynchronous step that reads the whole body and parses it. Both return promises, so both need `await`.

**Q6. Does `fetch()` reject when the server returns 404 or 500?**
No. `fetch()` rejects only on network-level failures: no connection, DNS error, CORS block, or an aborted request. Any HTTP response, including 404 and 500, fulfills the promise. Check `response.ok` (or `response.status`) and throw an error yourself if it is false.

**Q7. In what order does this log?**
```js
async function run() {
    console.log('B');
    await Promise.resolve();
    console.log('D');
}
console.log('A');
run();
console.log('C');
```
`A`, `B`, `C`, `D`. `run()` executes synchronously until its first `await`, so `B` logs right after `A`. At `await` the function pauses and `C` logs. The rest of `run()` resumes as a microtask after the synchronous code, so `D` logs last.

### Mid-level (2–4 years)

**Q8. This function takes 3 seconds. How would you speed it up?**
```js
async function loadDashboard() {
    const user = await getUser();        // 1 s
    const orders = await getOrders();    // 1 s
    const offers = await getOffers();    // 1 s
    return { user, orders, offers };
}
```
The three calls do not depend on each other, but each `await` waits for the previous one. Start them together and await them as a group: `const [user, orders, offers] = await Promise.all([getUser(), getOrders(), getOffers()]);`, which takes about 1 second. If the page should still render when one call fails, use `Promise.allSettled()` and check each `status`.

**Q9. How do you add a timeout to a `fetch()` request?**
Pass an abort signal. The simplest is `fetch(url, { signal: AbortSignal.timeout(5000) })`, which rejects with a `DOMException` named `TimeoutError` after 5 seconds. For manual cancellation (user navigates away, a newer search replaces an old one), create an `AbortController`, pass `controller.signal`, and call `controller.abort()`; the promise rejects with an `AbortError`. Check `err.name` in the `catch` to tell a timeout or cancellation apart from a real failure.

**Q10. Write a fetch helper that retries with exponential backoff.**
```js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, retries = 3, baseDelay = 500) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        let response;
        try {
            response = await fetch(url, options);
        } catch (err) {
            if (attempt === retries) throw err;     // network error on the last try
        }
        if (response) {
            if (response.ok) return response;
            // 4xx means the request itself is wrong; retrying will not help
            if (response.status < 500 || attempt === retries) {
                throw new Error(`HTTP ${response.status}`);
            }
        }
        await sleep(baseDelay * 2 ** attempt);      // 500, 1000, 2000 ms ...
    }
}
```
Retry only errors that can be temporary: network failures and 5xx (some APIs also use 429 with a `Retry-After` header). Doubling the delay avoids hammering a struggling server; adding a little random jitter stops many clients from retrying at the same moment. Only retry requests that are safe to repeat (GET, or POSTs with an idempotency key).

**Q11. What is the difference between `return promise` and `return await promise` inside `try`/`catch`?**
```js
async function getUser() {
    try {
        return fetchUser();          // returned before it settles
    } catch (err) {
        return null;                 // never reached if fetchUser() rejects
    }
}
```
With `return fetchUser()`, the function leaves the `try` block immediately and the outer promise follows `fetchUser()`; a later rejection goes straight to the caller and the `catch` is skipped. With `return await fetchUser()`, the rejection is thrown inside the `try`, so the `catch` handles it. Outside `try`/`catch` the two behave the same.

**Q12. Why doesn't `await` work inside `forEach`, and what should you use instead?**
`forEach` calls the async callback for each item and ignores the promise it returns, so it neither waits nor catches errors; code after `forEach` runs immediately. Use `for...of` with `await` when items must be processed one at a time (order matters, or you must limit load). Use `await Promise.all(items.map(async (item) => ...))` when they can run in parallel. For large lists, process in batches to limit concurrency.

**Q13. Compare `fetch`, `XMLHttpRequest` and a library like axios.**
XHR is the old event-based API; it is verbose but supports upload progress events. `fetch` is promise-based and built in, but it does not reject on HTTP errors, needs a separate `response.json()` step, and has no built-in timeout option (use `AbortSignal`). axios is a third-party library (built on XHR in browsers): it rejects on non-2xx statuses by default, parses JSON automatically, and supports interceptors and timeouts. Many teams write a small `fetch` wrapper that adds those features instead of adding a dependency.

**Q14. What error-handling strategy would you use for API calls in a front-end app?**
Put every request behind one helper that checks `response.ok`, parses the body, and throws a consistent error type that includes the status (for example an `HttpError` class). Handle errors at the level that can do something about them: the UI layer shows a message or retry button, while lower layers only add context and rethrow. Distinguish cancellations (`AbortError`, ignore them) from real failures, retry only transient errors, and add a global `unhandledrejection` listener to log anything that slipped through.

### Senior (5+ years)

**Q15. In a search-as-you-type box, the results sometimes match an older query than the one in the input. Why, and how do you fix it properly?**
Responses do not arrive in request order. Typing "re" and then "react" sends two requests; if the "re" request is slower, its response lands last and overwrites the "react" results. Debouncing reduces the number of requests but does not remove the race, because any two requests can still overlap. Fix it where it happens: abort the previous request when a new query starts, ignore `AbortError`, and check that the response still belongs to the latest query before rendering ("latest wins"), which also covers sources you cannot abort.
```js
let controller;

async function search(query) {
    controller?.abort();                         // cancel the previous request
    controller = new AbortController();
    const { signal } = controller;
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const results = await res.json();
        if (signal.aborted) return;              // a newer search started meanwhile
        renderResults(results);
    } catch (err) {
        if (err.name === 'AbortError') return;   // expected: replaced by a newer query
        renderError(err);
    }
}
```
Aborting stops the browser from waiting; it does not necessarily stop the work on the server. Cache results per query so backspacing is instant, and in a framework put this logic in one shared hook (or use a data library such as TanStack Query, which keys requests by query and cancels stale ones) rather than in every component. Recommendation: debounce to reduce load, abort plus latest-wins for correctness, implemented once.

**Q16. Every team has written its own retry loop, and during a backend incident the clients made the outage worse. What retry policy would you define for the whole app?**
Uncoordinated retries multiply load exactly when the server is weakest: three layers that each retry three times turn one failing request into 27 calls, and clients that retry on a fixed schedule hit the recovering server in synchronised waves. Define one policy and implement it once, in the shared HTTP client:

- **Retry only what can succeed next time:** network errors, 408, 429, 502, 503 and 504, never other 4xx. Only idempotent requests (GET, PUT, DELETE), or POSTs carrying an idempotency key that the server honours.
- **Back off with jitter:** exponential delays with full jitter (a random wait between 0 and the current cap), and honour `Retry-After` on 429 and 503.
- **Bound it:** a small attempt limit and an overall deadline, a per-attempt timeout (`AbortSignal.timeout()`) combined with the caller's signal (`AbortSignal.any([...])`) so that navigating away or a newer request stops the retries.
- **Retry in one layer only** (client or gateway, not both), with a retry budget or circuit breaker: when most requests are failing, stop retrying and fail fast.
- **Make it visible:** show "Reconnecting..." during long retries, and count retries in telemetry so a hidden 30% retry rate gets noticed.

Recommendation: one configurable retry policy in the shared client, with jittered backoff, idempotency rules and a budget, and a review rule against hand-written retry loops.

**Q17. How do you design error states in a large front-end so that one failing API does not break the whole page, and users always know what to do next?**
Decide the blast radius first. Wrap independent regions (a widget, a panel, a route) in their own error boundary, so a render error shows a local fallback instead of a blank page, and keep one top-level boundary as the last resort. Know the limits: React error boundaries catch errors thrown while rendering, not in event handlers, timers or promise callbacks. Async failures must be caught in the data layer and turned into state (`{ status: 'error', error }`) that the component renders, or re-thrown during render (as data libraries with Suspense do) so the nearest boundary catches them.

Then design every state, not only the happy path: loading (skeletons that do not shift the layout), empty (no results is not an error), recoverable error (a message and a Retry button that keeps the user's input), stale data with a banner when a refresh fails, offline, and "not found" or "no permission". Map error codes to messages written for users, never `err.message` or a stack trace; announce errors to assistive technology (`role="alert"` or an `aria-live` region) and manage focus; and show a reference id that support can match to the server log. Recommendation: per-region boundaries plus a shared set of state components (`<ErrorState onRetry>`, `<EmptyState>`), so every team handles failure the same way.

## References

- [MDN: Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN: async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
- [MDN: await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)
- [MDN: Response.ok](https://developer.mozilla.org/en-US/docs/Web/API/Response/ok)
- [MDN: Response.json()](https://developer.mozilla.org/en-US/docs/Web/API/Response/json)
- [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Programiz: JavaScript async/await](https://www.programiz.com/javascript/async-await)
- [freeCodeCamp: JavaScript async/await](https://www.freecodecamp.org/news/javascript-async-await/)
- [W3Schools: JavaScript Async](https://w3schools.com/js/js_async.asp)
