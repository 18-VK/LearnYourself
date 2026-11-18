# Error Handling in JavaScript

> JavaScript · Topic 16 · Demo: [index.html](index.html) · [script.js](script.js) · Open index.html in a browser (the demo uses `prompt()`, which Node does not have)

When something goes wrong at runtime (bad user input, a missing value, a failed network request), JavaScript **throws** an error. If nothing catches it, the current script stops and the error is printed in the console. Error handling with `try`, `catch`, `finally` and `throw` lets you detect these problems, show a useful message, clean up, and keep the rest of the app running.

## What the Demo Does

`script.js` asks for two numbers with `prompt()`, divides them, and treats a result of `NaN` or `Infinity` as an error:

```js
let num1 = prompt("Enter a number below");
let num2 = prompt("Enter another number below");

function ErrorHandlingExample() {
    try {
        const result = num1 / num2;
        if (isNaN(result) || result === Infinity)
            throw Error('input numbers are not valid ');   // throw a custom error
        console.log(result);
        return true;
    }
    catch (err) {
        console.log(err);
        return false;
    }
    finally {
        // We return in both try and catch, so will this still run?
        // Yes: finally runs even after a return. If we want to execute something
        // after returning from a block within a function, we use finally.
        console.log("Task completed.");
    }
}
ErrorHandlingExample();
```

Why the demo has to throw by hand: dividing by zero or by a non-number is **not** an error in JavaScript. `10 / 0` is `Infinity` and `'abc' / 2` is `NaN`, and the code carries on silently. These are *logic* errors, so the program has to detect them and `throw` itself.

| `num1` | `num2` | `num1 / num2` | Output |
|---|---|---|---|
| `'10'` | `'2'` | `5` | `5`, `Task completed.` (returns `true`) |
| `'10'` | `'0'` | `Infinity` | `Error: input numbers are not valid`, `Task completed.` (returns `false`) |
| `'abc'` | `'2'` | `NaN` | `Error: input numbers are not valid`, `Task completed.` |
| `'10'` | Cancel (`null`) | `Infinity` (`null` becomes `0`) | `Error: input numbers are not valid`, `Task completed.` |
| `'-10'` | `'0'` | `-Infinity` | `-Infinity`, `Task completed.` (not caught!) |
| `''` (empty) | `'5'` | `0` (`''` becomes `0`) | `0`, `Task completed.` (not caught!) |

`prompt()` returns a **string** (or `null` on Cancel). The `/` operator converts both sides to numbers, which is why `'10' / '2'` works, but also why an empty box silently counts as `0`.

> **Note:** `result === Infinity` misses `-Infinity`. Use `!Number.isFinite(result)`, which is `true` for `NaN`, `Infinity` and `-Infinity`. Better still, validate each input before doing the maths (see the improved version under Custom Errors).

The first, commented-out version in `script.js` is the same logic without the function. The function version was added to show that `finally` runs even when `try` or `catch` has already executed `return`.

## Kinds of Errors

| Kind | When it happens | Can `try`/`catch` handle it? |
|---|---|---|
| Syntax error | The code is not valid JavaScript (`if (x {`). Detected while the script is parsed | No: the whole script fails before any of it runs |
| Runtime error (exception) | Valid code fails while running (`null.length`, calling an undefined function) | Yes |
| Logic error | The code runs but gives a wrong result (`10 / 0` giving `Infinity`) | Only if you check for it and `throw` |

## try...catch...finally

```js
try {
    // code that might throw
} catch (err) {
    // runs only if something in try threw; err is the thrown value
} finally {
    // always runs: after try, after catch, even after return/break/continue
}
```

- `try` must be followed by `catch`, `finally`, or both.
- When a line in `try` throws, the rest of the `try` block is skipped and control jumps to `catch`.
- If nothing throws, `catch` is skipped.
- The catch parameter is optional (ES2019): `catch { ... }` when you do not need the error object.
- `try`/`catch` only catches errors thrown **synchronously** while the `try` block runs (see Async Errors below).

### finally and return

`finally` runs even if `try` or `catch` returns, which is exactly what the demo shows:

```js
function test() {
    try {
        return 'from try';
    } finally {
        console.log('finally runs first');
    }
}
console.log(test());
// finally runs first
// from try
```

The return value is decided first, then `finally` runs, then the function actually returns. That makes `finally` the right place for cleanup: closing a file, hiding a loading spinner, re-enabling a button.

> **Note:** A `return` inside `finally` overrides the `return` from `try`/`catch` **and** swallows any thrown error. Never return from `finally`.

```js
function risky() {
    try {
        throw new Error('lost');
    } finally {
        return 'finally wins';
    }
}
console.log(risky()); // finally wins   (the error disappeared)
```

## throw

`throw` stops the current function and hands a value to the nearest enclosing `catch`. If there is none, it becomes an uncaught error.

```js
function withdraw(balance, amount) {
    if (amount > balance) {
        throw new Error(`Insufficient funds: balance ${balance}, requested ${amount}`);
    }
    return balance - amount;
}

try {
    withdraw(100, 250);
} catch (err) {
    console.log(err.message); // Insufficient funds: balance 100, requested 250
}
```

- `throw Error('...')` (as in the demo) and `throw new Error('...')` do the same thing: `Error` creates a new object even without `new`. `new Error(...)` is the usual style.
- You *can* throw anything (`throw 'oops'`, `throw 42`), but don't. A string has no `message`, no `name` and no `stack`, so the catch code and the debugging tools get much less information.

```js
try {
    throw 'oops';
} catch (err) {
    console.log(typeof err, err.message); // string undefined
}
```

## The Error Object

| Property | Meaning |
|---|---|
| `name` | The error type, e.g. `"Error"`, `"TypeError"` |
| `message` | The human-readable description you passed in |
| `stack` | The call stack where the error was created (not in the spec, but supported by all engines) |
| `cause` | (ES2022) The original error, when you wrap one error in another |

```js
const err = new Error('input numbers are not valid');
console.log(err.name);      // Error
console.log(err.message);   // input numbers are not valid
console.log(String(err));   // Error: input numbers are not valid
console.log(err.stack);     // Error: input numbers are not valid \n    at ... (script.js:...)
```

`console.log(err)` in the demo prints the message and the stack trace. Use `console.error(err)` in real code so the output is marked as an error.

## Built-in Error Types

All of these inherit from `Error`:

| Type | Thrown when | Example that throws it |
|---|---|---|
| `ReferenceError` | Using a variable that does not exist | `undefinedVariable` → `undefinedVariable is not defined` |
| `TypeError` | A value is the wrong type for the operation | `null.length`, `const x = 1; x = 2;`, calling a non-function |
| `RangeError` | A number is outside the allowed range | `new Array(-1)`, `(1.5).toFixed(200)` |
| `SyntaxError` | Code or data cannot be parsed | Invalid source code, `JSON.parse('{bad json}')` |
| `URIError` | Bad input to URI functions | `decodeURIComponent('%')` → `URI malformed` |
| `EvalError` | Kept for backward compatibility; modern engines do not throw it | — |
| `AggregateError` | Several errors reported together | `Promise.any()` when every promise rejects |

Browsers also throw `DOMException` objects for Web API failures, e.g. `AbortError` and `TimeoutError` from `fetch` with an abort signal.

### Checking the Type With instanceof

```js
function parseSettings(text) {
    try {
        return JSON.parse(text);
    } catch (err) {
        if (err instanceof SyntaxError) {
            console.log('Settings file is not valid JSON, using defaults');
            return {};
        }
        throw err; // not the error we expected: rethrow it
    }
}

console.log(parseSettings('{"theme":"dark"}')); // { theme: 'dark' }
console.log(parseSettings('{theme: dark}'));    // Settings file is not valid JSON, using defaults / {}
```

Catch only the errors you know how to handle and **rethrow** the rest. A catch block that hides every error also hides your bugs.

## Custom Errors

Extend `Error` to create your own error types. This lets callers tell different failures apart with `instanceof` and attach extra data.

```js
class ValidationError extends Error {
    constructor(message, field) {
        super(message);              // sets this.message (and the stack)
        this.name = 'ValidationError';
        this.field = field;          // extra information for the caller
    }
}
```

The demo rewritten with input validation and a custom error:

```js
function parseNumber(input, field) {
    if (input === null || input.trim() === '') {
        throw new ValidationError(`${field} is required`, field);
    }
    const value = Number(input);
    if (Number.isNaN(value)) {
        throw new ValidationError(`${field} must be a number, got "${input}"`, field);
    }
    return value;
}

function divide(aInput, bInput) {
    const a = parseNumber(aInput, 'First number');
    const b = parseNumber(bInput, 'Second number');
    if (b === 0) {
        throw new RangeError('Cannot divide by zero');
    }
    return a / b;
}

function run(aInput, bInput) {
    try {
        console.log('Result:', divide(aInput, bInput));
    } catch (err) {
        if (err instanceof ValidationError) {
            console.log(`Invalid input (${err.field}): ${err.message}`);
        } else if (err instanceof RangeError) {
            console.log(err.message);
        } else {
            throw err; // an unexpected bug: let it surface
        }
    } finally {
        console.log('Task completed.');
    }
}

run('10', '4');   // Result: 2.5           / Task completed.
run('10', 'abc'); // Invalid input (Second number): Second number must be a number, got "abc" / Task completed.
run('10', '0');   // Cannot divide by zero / Task completed.
run('', '5');     // Invalid input (First number): First number is required / Task completed.
```

### Wrapping Errors With cause

When you catch a low-level error and throw a more meaningful one, keep the original as `cause` so no information is lost:

```js
async function loadSettings() {
    try {
        const response = await fetch('/settings.json');
        return await response.json();
    } catch (err) {
        throw new Error('Could not load settings', { cause: err });
    }
}

loadSettings().catch((err) => {
    console.log(err.message);        // Could not load settings
    console.log(err.cause);          // the original TypeError / SyntaxError
});
```

## Async Errors

### try/catch Does Not Catch Errors Thrown Later

`try`/`catch` only covers code that runs while the `try` block is executing. A callback scheduled with `setTimeout` (or an event listener) runs later, after the `try` block has already finished:

```js
try {
    setTimeout(() => {
        throw new Error('Inside timer');
    }, 0);
} catch (err) {
    console.log('Never runs');
}
// Uncaught Error: Inside timer
```

Put the `try`/`catch` **inside** the callback instead. Why the callback runs on a fresh call stack is explained in [The Event Loop](../19-event-loop/notes.md).

The same applies to a promise you do not `await`:

```js
try {
    Promise.reject(new Error('Rejected'));   // not awaited
} catch (err) {
    console.log('Never runs');
}
// Uncaught (in promise) Error: Rejected
```

### Handling Promise Errors

With promises, use `.catch()`. With `async`/`await`, a rejected promise makes `await` throw, so ordinary `try`/`catch` works (details in [Callbacks and Promises](../17-callbacks-and-promises/notes.md) and [async/await and the Fetch API](../18-async-await-and-fetch/notes.md)):

```js
// Promise chain
fetch('https://jsonplaceholder.typicode.com/todos/1')
    .then((res) => res.json())
    .then((todo) => console.log(todo.title))
    .catch((err) => console.error('Request failed:', err));

// async/await
async function showTodo() {
    try {
        const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);   // fetch does not throw on 404/500
        const todo = await res.json();
        console.log(todo.title);                              // delectus aut autem
    } catch (err) {
        console.error('Request failed:', err.message);
    }
}
showTodo();
```

### Global Safety Nets

For errors nobody caught, the browser fires events on `window`. They are useful for logging (e.g. sending errors to a monitoring service), not as a replacement for local handling:

```js
window.addEventListener('error', (event) => {
    console.log('Uncaught error:', event.message);
});

window.addEventListener('unhandledrejection', (event) => {
    console.log('Unhandled promise rejection:', event.reason);
});
```

Node.js has the equivalents `process.on('uncaughtException', ...)` and `process.on('unhandledRejection', ...)`. Since Node.js 15, an unhandled rejection crashes the process by default.

## Best Practices

- Throw `Error` objects (or subclasses), never strings, and write messages that say what was expected and what was received.
- Validate input early and throw at the point where the problem is detected ("fail fast").
- Catch an error only where you can do something useful: show a message, retry, use a default. Otherwise let it propagate.
- Never leave a `catch` block empty. At minimum log the error.
- Rethrow errors you did not expect, or wrap them with `{ cause }` to add context.
- Use `finally` for cleanup, and never `return` from it.
- Do not use exceptions for normal control flow (e.g. "throw to exit a loop"); use `if`, `return`, `break`.

## Common Mistakes

- **Expecting `10 / 0` or `'abc' * 2` to throw.** They produce `Infinity` and `NaN`; check with `Number.isFinite()` / `Number.isNaN()`.
- **Checking only `=== Infinity`**, which misses `-Infinity` (the demo's gap).
- **Forgetting that `prompt()` returns strings**, and that `''` and `null` convert to `0`.
- **Swallowing errors** with `catch (e) {}`, so failures become invisible.
- **Throwing strings**, losing `message`, `name` and the stack trace.
- **Wrapping a `setTimeout` or an un-awaited promise in `try`/`catch`** and expecting it to catch the later error.
- **Not checking `response.ok` with `fetch`**, so HTTP errors pass as success.
- **Returning from `finally`**, which silently discards errors and return values.
- **Catching everything with one generic handler** instead of checking `instanceof` and rethrowing unknown errors.

## Key Takeaways

- `try` runs risky code, `catch` handles a thrown error, `finally` always runs, even after `return`.
- `throw` stops execution and passes an error to the nearest `catch`; always throw `Error` objects.
- Built-in types (`TypeError`, `ReferenceError`, `RangeError`, `SyntaxError`, ...) tell you what kind of failure happened; check them with `instanceof`.
- Extend `Error` for your own error types and use `{ cause }` to wrap errors without losing the original.
- Logic problems such as division by zero do not throw; validate and throw yourself.
- `try`/`catch` is synchronous: for async code use `await` inside `try`, or `.catch()` on the promise.
- Global `error` / `unhandledrejection` listeners are a logging safety net, not a substitute for local handling.

## Interview Questions

### Junior (0–1 year)

**Q1. What are `try`, `catch` and `finally` used for?**
`try` wraps code that might throw. If an error is thrown, the rest of `try` is skipped and `catch` runs with the error object. `finally` runs afterwards in every case (success, error, or `return`), so it is used for cleanup such as hiding a loader or closing a connection. `try` must be followed by `catch`, `finally`, or both.

**Q2. If both `try` and `catch` contain `return`, does `finally` still run?**
Yes. The return value is decided, then `finally` runs, then the function returns. In the demo, `ErrorHandlingExample()` returns `true` or `false`, but `Task completed.` is still logged in both cases. The exception is a `return` inside `finally` itself, which would replace the earlier return value.

**Q3. What is the difference between `throw new Error('x')` and `throw 'x'`?**
Both stop execution and jump to `catch`, but only the `Error` object carries useful information: `name`, `message` and a `stack` trace showing where it was created. With a thrown string, `err.message` is `undefined` and there is no stack, which makes debugging much harder. Code that checks `err instanceof Error` or reads `err.message` will also misbehave.

**Q4. Name some built-in error types and what causes each.**
`ReferenceError`: using an undeclared variable. `TypeError`: wrong type for the operation, such as reading a property of `null` or calling something that is not a function. `RangeError`: a number out of range, e.g. `new Array(-1)`. `SyntaxError`: unparsable code or `JSON.parse` on invalid JSON. Also `URIError` (bad `decodeURIComponent` input) and `AggregateError` (from `Promise.any`).

**Q5. Why doesn't `10 / 0` throw an error? How does the demo deal with it?**
JavaScript numbers follow IEEE 754 floating point, where dividing by zero gives `Infinity` (or `-Infinity`), and invalid maths gives `NaN`. Nothing is thrown, so the demo checks the result and throws its own error with `throw Error('input numbers are not valid ')`. The check `result === Infinity` misses `-Infinity`; `!Number.isFinite(result)` covers `NaN`, `Infinity` and `-Infinity`.

**Q6. Can `try`/`catch` catch a syntax error?**
Not one in your own source code: the script is parsed before it runs, so a syntax error stops the whole script and no `try` block ever executes. It can catch a `SyntaxError` produced at runtime by parsing data, such as `JSON.parse('{bad}')`, or by `eval`/`new Function` on a string.

### Mid-level (2–4 years)

**Q7. Why doesn't this `catch` run, and how do you fix it?**
```js
try {
    setTimeout(() => { throw new Error('boom'); }, 1000);
} catch (err) {
    console.log('caught', err.message);
}
```
`setTimeout` only schedules the callback; the `try` block finishes immediately. One second later the callback runs on an empty call stack, outside the `try`, so the error is uncaught. Move the `try`/`catch` inside the callback, or wrap the timer in a promise and `await` it inside a `try` block. The same problem happens with a promise that is created inside `try` but not awaited.

**Q8. How do you create a custom error class, and why would you?**
Extend `Error`, call `super(message)`, set `this.name`, and add any extra fields:
```js
class NotFoundError extends Error {
    constructor(resource) {
        super(`${resource} not found`);
        this.name = 'NotFoundError';
        this.resource = resource;
    }
}
```
Callers can then branch with `err instanceof NotFoundError` instead of comparing message strings, and the extra fields (status code, field name) travel with the error. Note that when code is transpiled to ES5 (e.g. older TypeScript targets), `instanceof` checks on Error subclasses can fail unless the prototype is fixed with `Object.setPrototypeOf(this, new.target.prototype)`.

**Q9. What does this return, and why is it a problem?**
```js
function save() {
    try {
        throw new Error('Disk full');
    } catch (err) {
        throw new Error('Save failed', { cause: err });
    } finally {
        return 'ok';
    }
}
console.log(save());
```
It logs `ok`. A `return` in `finally` overrides whatever `try` or `catch` was doing, including a thrown error, so the "Save failed" error is silently discarded and the caller thinks the save worked. `finally` should only contain cleanup, never `return` or `throw`.

**Q10. What is an unhandled promise rejection and how do you catch them globally?**
It is a promise that rejects with no `.catch()` handler and no `await` inside a `try`. Browsers log `Uncaught (in promise)` and fire an `unhandledrejection` event on `window`; Node.js (v15+) crashes the process by default. Listen with `window.addEventListener('unhandledrejection', e => log(e.reason))` (or `process.on('unhandledRejection', ...)` in Node) to report them to a monitoring tool, but still fix each one by handling the rejection where it happens.

**Q11. How do you add context to an error without losing the original?**
Catch it and throw a new, higher-level error with the `cause` option: `throw new Error('Could not load user profile', { cause: err })`. The message explains *what* failed in business terms, while `err.cause` keeps the original error and its stack for debugging. Before `cause` (ES2022), people stored the original on a custom property or concatenated messages, which lost the original stack.

**Q12. A user reports the product list is just empty when the API is down. What is wrong with this code?**
```js
fetch('/api/products')
    .then((res) => res.json())
    .then((items) => renderList(items))
    .catch(() => {});
```
Two problems. The empty `catch` swallows every error, so the user sees an empty list instead of an error message, and nothing is logged. And `res.ok` is never checked, so a 500 response is treated as success and `res.json()` may fail or return an error object. Fix: throw on `!res.ok`, and in `catch` log the error and render an error state with a retry button.

**Q13. When should you catch an error, and when should you let it propagate?**
Catch it at the level that can actually respond: the UI layer can show a message or offer a retry, a data layer can fall back to cached data, a retry helper can try again. Lower-level functions should usually let errors propagate, optionally wrapping them with context via `cause`. Catching and ignoring errors everywhere hides bugs; catching only at the top loses context. A common pattern is "throw early, catch late".

### Senior (5+ years)

**Q14. In a shared codebase, when should a function throw, and when should it return an error value (a "result" object)? How do you keep this consistent across teams?**
Throwing fits failures the immediate caller usually cannot handle, and programmer errors (a broken invariant, a missing argument): the error travels to a boundary that can deal with it, and intermediate code does not have to check anything. Returning a value such as `{ ok: false, error: { code: 'EMAIL_TAKEN' } }` fits **expected** outcomes that callers must handle as part of the normal flow: validation results, "not found", a business rule rejecting an action. With TypeScript a discriminated union makes the failure case impossible to ignore, while a thrown error is invisible in the function's type (`catch (err)` gives `unknown`).

The real damage comes from mixing them at random, with the same "not found" thrown in one module and returned in another. Set a rule per layer: validation and domain functions return results; infrastructure (HTTP client, storage) throws typed errors with a stable `code`; boundaries (route handlers, UI event handlers, error boundaries) turn thrown errors into user-facing states. Branch on `code` or `name`, not on message text, and use `instanceof` only inside one package, because two bundled copies of a library break it (see the question on two bundled copies in [Symbols, iterators and generators](../13-symbols-iterators-generators/notes.md#interview-questions)). Recommendation: results for expected outcomes, exceptions for the unexpected, and one documented error shape with codes for the whole app.

**Q15. You are setting up front-end error reporting for a large app. Beyond installing an SDK, what do you need to get right?**

- **Capture everything:** the `error` and `unhandledrejection` events on `window`, framework hooks such as error boundaries, and errors inside workers. Errors from a script on another origin arrive only as `"Script error."` with no stack unless the `<script>` tag has `crossorigin="anonymous"` and the server sends `Access-Control-Allow-Origin`.
- **Make reports actionable:** tag each with the release version, upload source maps privately (readable production stack traces are covered in the interview questions of [Functions](../05-functions/notes.md#interview-questions)), include the route, browser and the `cause` chain, and normalise thrown non-`Error` values so they still carry a stack.
- **Control noise and cost:** drop errors from browser extensions and bots, group by fingerprint, sample very frequent errors, and rate-limit per session so one error in a loop cannot flood the service.
- **Protect privacy:** scrub tokens, emails and form values from messages, URLs and breadcrumbs before sending.
- **Alert on change:** new error types and error-rate jumps per release, not every single event.

Recommendation: treat error reporting as a product with an owner: a release-tagged, source-mapped, de-noised feed with regression alerts. A noisy feed is soon ignored, and then it catches nothing.

**Q16. Users report that "Save" sometimes does nothing, and monitoring shows no errors. How do you find the cause, and how do you stop this class of bug across a team?**
"Nothing happens and nothing is logged" almost always means a swallowed error: an empty `catch {}`, a `.catch(() => {})`, a `catch` that only does `console.log(err)` (invisible in production), a `return` inside `finally`, or a promise that nobody awaits. To find it, reproduce with DevTools' "Pause on caught exceptions" enabled (it stops even at handled errors), search the save path for `catch` blocks and un-awaited calls, and temporarily report every error caught on that path.

To prevent it: lint rules (`no-empty`, `no-throw-literal` or `@typescript-eslint/only-throw-error`, `prefer-promise-reject-errors`, `@typescript-eslint/no-floating-promises`), TypeScript's `useUnknownInCatchVariables` (on under `strict`), one shared `logError(err, context)` helper as the only approved way to report an error and continue, and a review rule: every `catch` must recover, rethrow, or report. Recommendation: make swallowing an error a lint failure, and give the team one blessed way to report and move on.

## References

- [MDN: try...catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch)
- [MDN: throw](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw)
- [MDN: Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)
- [MDN: Error.prototype.cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
- [MDN: Control flow and error handling](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling)
- [MDN: Window: error event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event)
- [MDN: Window: unhandledrejection event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event)
