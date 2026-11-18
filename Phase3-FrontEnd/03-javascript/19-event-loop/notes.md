# The Event Loop

> JavaScript · Topic 19 · Demo: [script.js](script.js) · [index.html](index.html) · Run with `node script.js`; open index.html in a browser for the rendering demos

JavaScript runs your code on a single thread, yet a page can wait for the network, run timers, react to clicks and animate smoothly at the same time. The **event loop** is the host's scheduler that makes this possible. Whenever the call stack is empty, it decides what runs next on that one thread: the next task, the queued microtasks, or a rendering update. [Introduction to JavaScript](../01-how-js-runs/notes.md) and [Callbacks and Promises](../17-callbacks-and-promises/notes.md) give the short version; this note is the deep dive: the call stack and run-to-completion, host APIs, tasks vs microtasks and exactly when microtasks run, how `await` resumes, where rendering fits into a browser frame, timer clamping, long tasks and yielding to the main thread, microtask starvation, `MessageChannel`, and Node's event loop phases, with ordering puzzles throughout. `script.js` prints every ordering example in Node and checks it against this note; `index.html` shows the rendering side in a browser.

## The Big Picture

| Part | Owned by | What it does |
|---|---|---|
| Call stack | Engine (V8, SpiderMonkey, JavaScriptCore) | Runs one function at a time; each call pushes an execution context |
| Heap | Engine | Holds objects; shared by all code on this thread |
| Host APIs | Browser or Node.js | Timers, network, file I/O, user input. The waiting happens here, off the JavaScript thread |
| Task queues | Host | Callbacks that are ready to run: timer callbacks, events, messages, I/O completions |
| Microtask queue | Host (fed by the engine) | Promise reactions, `await` continuations, `queueMicrotask`, `MutationObserver` |
| Rendering steps | Browser only | `requestAnimationFrame`, style, layout, paint, once per frame |
| Event loop | Host | Picks the next thing to run when the call stack is empty |

> **Note:** ECMAScript defines the language and promise "jobs", but not the event loop. The loop is defined by the host: the HTML Standard for browsers, libuv for Node.js. That is why browser and Node ordering differ in the details.

One turn of a browser's event loop, simplified from the HTML Standard:

```text
1. Take ONE task from a task queue (the browser chooses which queue) and run it to completion.
2. Microtask checkpoint: run microtasks until the queue is empty, including ones queued meanwhile.
3. If it is time for a new frame: rAF callbacks → style → layout → ResizeObserver → paint.
4. If there is spare time before the next frame: requestIdleCallback callbacks.
5. Go back to 1.
```

The rest of this note is the detail behind these five lines.

## Call Stack and Run-to-Completion

Every function call pushes an execution context onto the call stack and pops it on return. Two consequences shape everything else:

- **Run-to-completion.** Once a task starts, nothing interrupts it until the call stack is empty: no other callback, no event handler, no repaint. You never need locks around ordinary JavaScript objects, but a slow task freezes everything else on the page.
- **The loop acts only on an empty stack.** Queued callbacks, however urgent, wait for the running code to return.

```js
function countDown(n) { return n === 0 ? 0 : countDown(n - 1); }
countDown(1e6); // → RangeError: Maximum call stack size exceeded (each call is a stack frame)
```

## Host APIs: Where the Waiting Happens

The engine has no timers, sockets or files. `setTimeout`, `fetch` and `fs.readFile` hand the work to the host (browser network threads, the operating system, Node's libuv thread pool). When it completes, the host **queues** a callback, and which queue it lands in decides when it runs:

| API | What gets queued | Queue |
|---|---|---|
| `setTimeout`, `setInterval` | The callback, once the delay has passed | Task (timer task source) |
| Clicks, key presses, pointer events | Dispatching the event to its listeners | Task (user interaction task source) |
| `postMessage`, `MessageChannel` | A `message` event | Task (posted message task source) |
| `fetch` | Settling the `fetch` promise, in a networking task; your `.then` then runs as a microtask | Task, then microtask |
| `.then`/`.catch`/`.finally`, code after `await` | The reaction | Microtask |
| `queueMicrotask(fn)` | `fn` | Microtask |
| `MutationObserver` | One batched callback with all records | Microtask |
| `requestAnimationFrame` | The callback | Rendering step, before the next paint |
| `requestIdleCallback` | The callback | Idle period after a frame |
| Node: `setImmediate` | The callback | Check phase |
| Node: `process.nextTick` | The callback | nextTick queue, before promise microtasks |

## Tasks vs Microtasks

"Macrotask" is an informal word; the HTML Standard just says **task**. And there is not one task queue but several, one per *task source* (timers, user interaction, networking, posted messages...). On each turn the browser picks a task from a queue of its choice, which lets it prioritise input over timers. Order is guaranteed only **within** a task source: two `setTimeout(fn, 0)` calls run in the order they were made, but a timer and a click have no fixed order.

There is a single **microtask queue**, and it is always drained completely: microtasks queued by microtasks run in the same checkpoint, before anything else.

| | Task | Microtask |
|---|---|---|
| Scheduled by | `setTimeout`, events, `postMessage`, I/O | Promise reactions, `await`, `queueMicrotask`, `MutationObserver` |
| How many per loop turn | One | All of them, until the queue is empty |
| Can the browser render in between? | Yes, between two tasks | No: rendering waits for the whole queue |
| Can input be handled in between? | Yes | No |
| Typical risk | A long task blocks input and paint | An endless chain starves everything (see Microtask Starvation) |

### When the Microtask Queue Is Drained

"After each task" is the short answer. The precise rule is: there is a microtask checkpoint **whenever the JavaScript call stack becomes empty** after the host invoked a callback. So microtasks also run:

- between two `<script>` elements (each script runs from an empty stack),
- between the listeners of an event that the **browser** dispatched (a real click or key press),
- between two `requestAnimationFrame` callbacks in the same frame.

The event case is a favourite interview puzzle, and the second demo in `index.html`:

```js
button.addEventListener('click', () => {
    console.log('listener 1');
    queueMicrotask(() => console.log('microtask 1'));
});
button.addEventListener('click', () => {
    console.log('listener 2');
    queueMicrotask(() => console.log('microtask 2'));
});

// The user clicks the button:
// → listener 1, microtask 1, listener 2, microtask 2

button.click();                  // dispatched from your own code
console.log('after click()');
// → listener 1, listener 2, after click(), microtask 1, microtask 2
```

For a real click the browser calls each listener from an empty stack, so a checkpoint follows each one. With `button.click()` or `dispatchEvent()`, the listeners run synchronously **inside** your code, and the stack is not empty until your code finishes. Example 6 in `script.js` shows the same thing with `EventTarget` in Node.

### queueMicrotask()

`queueMicrotask(fn)` puts `fn` on the same queue as promise reactions, without creating a promise. Two differences from `Promise.resolve().then(fn)`: no promise object is allocated, and an exception thrown by `fn` is reported like any uncaught error (the `window` `error` event) instead of as an unhandled rejection.

Use it to run something after the current synchronous code but before the browser renders, for example to coalesce several updates into one DOM write:

```js
const pending = [];
let scheduled = false;

function queueUpdate(change) {
    pending.push(change);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {             // once, after all sync updates, before paint
        scheduled = false;
        applyToDom(pending.splice(0));
    });
}

queueUpdate('a'); queueUpdate('b'); queueUpdate('c');   // → one applyToDom(['a', 'b', 'c'])
```

Frameworks batch state updates on the same idea.

## How await Resumes

An `async` function runs synchronously up to its first `await`. `await value` then behaves roughly like `Promise.resolve(value).then(resumeHere)`: the function is suspended, control returns to the caller, and the rest of the function runs as a **microtask** once the promise has settled. The basics are in [async/await and the Fetch API](../18-async-await-and-fetch/notes.md#how-await-works-with-the-event-loop). The details that output puzzles test:

- Every `await` costs at least one microtask "tick", even `await null` or awaiting an already-fulfilled promise.
- Since a 2019 spec change (V8 7.2 / Chrome 72, Node 12), awaiting a **native** promise costs exactly one tick. Older engines took three, which is why old blog posts show different answers.
- Resolving a promise **with another promise** (`resolve(p)`, or `return p` from an `async` function) adds two extra ticks, because the engine must first call `p.then(...)` in a separate job. Awaiting a non-native thenable adds extra ticks for the same reason.

**Puzzle 1.** What does this print? (Example 3 in `script.js`.)

```js
async function a1() {
    console.log('a1 start');
    await a2();
    console.log('a1 end');
}
async function a2() {
    console.log('a2');
}

console.log('script start');
setTimeout(() => console.log('setTimeout'), 0);
a1();
new Promise((resolve) => {
    console.log('p1 executor');
    resolve();
}).then(() => console.log('p2'));
console.log('script end');
```

Answer: `script start`, `a1 start`, `a2`, `p1 executor`, `script end`, `a1 end`, `p2`, `setTimeout`. `a2()` runs synchronously inside `a1` and returns an already-fulfilled promise, so `await` queues `a1`'s continuation at once. The promise executor is synchronous too. When the sync code ends, the microtasks run in the order they were queued (`a1 end`, then `p2`), and the timer task runs last.

**Puzzle 2.** What does this print? (Example 4 in `script.js`.)

```js
const p = Promise.resolve();
new Promise((resolve) => resolve(p)).then(() => console.log('A'));
p.then(() => console.log('B')).then(() => console.log('C')).then(() => console.log('D'));
```

Answer: `B`, `C`, `A`, `D`. `resolve(p)` does not fulfil the outer promise directly: tick 1 calls `p.then(...)`, tick 2 fulfils the outer promise, and only tick 3 runs `A`. Meanwhile the `B → C → D` chain advances one step per tick, so `B` and `C` come first, and `A` was queued just before `D`. The same cost explains why an `async` function that does `return somePromise` settles a tick later than one that does `return await somePromise` (Example 5). Worth knowing to explain a puzzle; never something to rely on in real code (Q17).

## Rendering: Where the Browser Paints

Rendering is a step of the event loop, not a separate thread that interrupts your code. At each **rendering opportunity**, usually once per display refresh (every 16.7 ms at 60 Hz, 8.3 ms at 120 Hz), the browser runs "update the rendering". It may skip the step when nothing changed or the page is hidden, so several tasks can run between two frames.

Inside a frame, roughly in this order (simplified from the HTML Standard):

1. Fire `resize` and `scroll` events, re-evaluate media queries, update CSS animations and fire their events.
2. Run `requestAnimationFrame` callbacks (with a microtask checkpoint after each one).
3. Recalculate style and layout.
4. Deliver `ResizeObserver` callbacks (going back to style and layout if they changed something), and compute `IntersectionObserver` updates.
5. Paint, then composite the layers into the frame on screen.

What each stage costs, and which CSS properties trigger which stage, is in [How the Browser Renders a Page](../../04-browser-platform/01-rendering-pipeline/notes.md).

### requestAnimationFrame in the Loop

- rAF callbacks run after the current task and its microtasks, right before the next frame's style and layout, so a change made in rAF lands in that frame.
- All callbacks registered before a frame run in that frame and receive the same timestamp. A callback registered **inside** a rAF callback runs in the **next** frame, which is how an animation loop advances one frame at a time.
- rAF is paused in background tabs and hidden iframes.
- The order of a rAF callback and a `setTimeout(fn, 0)` scheduled at the same moment is **not fixed**: it depends on how much of the current frame is left. The first ordering demo in `index.html` may show either order.
- To run code **after** the next paint, use a double rAF (`requestAnimationFrame(() => requestAnimationFrame(fn))`) or a rAF that schedules a task (`requestAnimationFrame(() => setTimeout(fn, 0))`).

### Why a Long Task Blocks Rendering

The browser can only render between tasks. DOM changes made during a task are painted after the task and its microtasks finish:

```js
// ❌ "Loading..." is never painted
button.addEventListener('click', () => {
    status.textContent = 'Loading...';
    runHeavyFilter();                    // 800 ms of synchronous work in the same task
    status.textContent = 'Done';         // the only text the user ever sees
});

// ✅ End the task so the browser can paint, then do the heavy part
button.addEventListener('click', async () => {
    status.textContent = 'Loading...';
    await yieldToMain();                 // defined under "Ways to Yield" below
    runHeavyFilter();                    // still one long task: chunk it or use a worker
    status.textContent = 'Done';
});
```

While a task runs, clicks and key presses wait, and animations driven by JavaScript freeze. The first demo in `index.html` shows it: during the 2-second task the red ball (moved by rAF) stops, but the blue ball keeps moving, because a CSS `transform` animation runs on the **compositor thread**. Animations of `transform` and `opacity` survive a busy main thread; anything that needs style or layout on each frame does not.

> **Note:** Reading layout (`offsetHeight`, `getBoundingClientRect()`) after changing styles in the same task forces the browser to run style and layout synchronously inside your task. See [Layout thrashing and forced synchronous layout](../../04-browser-platform/01-rendering-pipeline/notes.md#layout-thrashing-and-forced-synchronous-layout).

## Timers: setTimeout Is a Minimum, Not a Schedule

`setTimeout(fn, delay)` means "queue `fn` as a task once at least `delay` ms have passed". After that it still waits for the current task, the microtasks, possibly a frame, and any other tasks the browser picks first.

| Situation | Effective delay |
|---|---|
| `setTimeout(fn, 0)` | As soon as possible, but always after the current task and all its microtasks |
| Nested timers (a timer set from a timer callback, 5 or more levels deep) | At least 4 ms (HTML Standard clamp) |
| Background (hidden) tab | About once per second at most; Chrome can throttle chained timers to once per minute after 5 minutes hidden |
| Busy main thread | Whenever the long task ends (Example 11: a 10 ms timer runs after 200 ms) |
| Delay above 2,147,483,647 ms (~24.8 days) | Overflows a 32-bit integer: browsers fire it almost immediately; Node.js uses 1 ms and prints a warning |
| Node.js | At least 1 ms (`0` becomes `1`), no 4 ms nesting clamp |

The nesting clamp catches code that yields in a loop with `await new Promise((r) => setTimeout(r, 0))`: the continuation runs inside the timer task, so every new timer is nested one level deeper, and after a few rounds each yield costs at least 4 ms. Example 13 in `script.js` measures 100 yields through each API in Node. On Windows the `setTimeout` number is much larger, because Node's timers there follow the system's coarse timer resolution.

For clocks, countdowns and progress, compute elapsed time from `performance.now()` or `Date.now()` instead of counting callbacks: a counter that adds one per `setInterval(fn, 1000)` drifts, and stalls completely in a background tab.

## Long Tasks and Yielding to the Main Thread

A **long task** is a task that keeps the main thread busy for more than **50 ms**. While it runs, the page cannot respond to input or paint, which shows up directly in **Interaction to Next Paint** (INP): input that arrives during a long task waits (input delay), long event handlers delay the next frame (processing duration), and a heavy DOM update slows the frame itself (presentation delay). The metric, its thresholds and how to measure it are in [Web Performance](../../04-browser-platform/05-web-performance/notes.md#inp-sub-parts).

### Ways to Yield

To **yield** is to end the current task so the browser can handle input and render, and continue the work in a later task. The techniques differ in where the continuation goes:

| Technique | Where the continuation runs | Notes |
|---|---|---|
| `await new Promise((r) => setTimeout(r, 0))` | At the back of the timer queue | Works everywhere; 4 ms clamp once nested; throttled in background tabs |
| `MessageChannel` message to yourself | At the back of the posted-message queue | No clamp; a little boilerplate (see below) |
| `await scheduler.yield()` | In a new task that runs **ahead** of other queued tasks of the same priority | Made for this; Chromium 129+ and Firefox 142+, not Safari: feature-detect |
| `scheduler.postTask(fn, { priority, delay, signal })` | A task with priority `user-blocking`, `user-visible` (default) or `background` | Chromium 94+ and Firefox 101+, not Safari; cancellable with an `AbortSignal` |
| `requestIdleCallback(fn, { timeout })` | In idle time after a frame | Only for work nobody is waiting for (analytics, prefetching); Safari support has lagged, so feature-detect |
| `requestAnimationFrame(fn)` | Before the next paint | For visual updates, not for spreading non-visual work |
| A Web Worker | On another thread | For CPU-heavy work that does not need the DOM |
| `await Promise.resolve()`, `queueMicrotask` | In the same task's microtask checkpoint | **Does not yield**: input and rendering still wait |

```js
function yieldToMain() {
    if (globalThis.scheduler?.yield) return scheduler.yield();   // keeps its place near the front
    return new Promise((resolve) => setTimeout(resolve, 0));       // fallback: back of the queue
}
```

Yield on a **time budget** (for example every 50 ms of work), not after every item: each yield costs at least one loop turn, so yielding per item makes the job several times slower. A complete budgeted loop is in the "100,000 rows" question of [Loops](../04-loops/notes.md#interview-questions), and the handler pattern ("update the UI, yield, then do the work") in [Web Performance](../../04-browser-platform/05-web-performance/notes.md#long-tasks-and-yielding). The second button in `index.html` runs 2 s of work in 50 ms chunks: the status text keeps updating and the red ball keeps moving. Moving the work off the main thread entirely is covered in [Observers, history and workers](../../04-browser-platform/06-observers-history-workers/notes.md).

## Microtask Starvation

Because the microtask queue is drained until it is empty, a microtask that always queues another one never lets the loop move on: no next task, no input, no paint. The page freezes just like with `while (true)`, even though each microtask is tiny.

```js
// ❌ Freezes the page: rendering and input wait for an empty microtask queue
function poll() {
    checkForUpdates();
    Promise.resolve().then(poll);
}

// ✅ Each round is a separate task: the browser renders and handles input in between
function poll() {
    checkForUpdates();
    setTimeout(poll, 250);   // or requestAnimationFrame(poll) for visual work
}
```

Example 10 in `script.js` queues 200,000 chained microtasks: a `setTimeout(fn, 0)` scheduled before them runs only after the whole chain. In Node, a recursive `process.nextTick` starves I/O in the same way, while a recursive `setImmediate` does not.

## MessageChannel

`MessageChannel` creates two connected ports; a message posted on one port arrives as a `message` event on the other. It exists for talking to iframes and workers, but posting to yourself is also the cheapest way to get a **new task** without timer clamping:

```js
const channel = new MessageChannel();
channel.port1.onmessage = () => console.log('message (a new task)');
channel.port2.postMessage(null);
Promise.resolve().then(() => console.log('microtask'));
console.log('sync');
// → sync
// → microtask
// → message (a new task)
```

React's scheduler uses exactly this (it prefers `setImmediate` where that exists, as in Node, and falls back to `setTimeout`) to run rendering work in small slices. In Node, an open port with an `onmessage` handler keeps the process alive, so close it (`port1.close()`) when you are done (Example 9).

## The Node.js Event Loop

Node has no rendering steps and no `requestAnimationFrame`. Its loop comes from **libuv** and runs in phases, each with its own queue of callbacks:

```text
   ┌───────────────────────┐
┌─>│        timers         │  setTimeout / setInterval callbacks that are due
│  ├───────────────────────┤
│  │   pending callbacks   │  some system I/O callbacks deferred from the previous turn
│  ├───────────────────────┤
│  │     idle, prepare     │  internal
│  ├───────────────────────┤
│  │         poll          │  wait for I/O and run its callbacks (fs, net)
│  ├───────────────────────┤
│  │         check         │  setImmediate callbacks
│  ├───────────────────────┤
└──┤    close callbacks    │  'close' events, e.g. socket.on('close')
   └───────────────────────┘
```

The rules interviews probe:

- **After every single callback** (since Node 11), Node drains the `process.nextTick` queue completely, then the promise microtask queue completely, and repeats until both are empty. Before Node 11 they were drained only between phases, so two timers could both run before either one's promise callbacks.
- **`process.nextTick` runs before promise callbacks** in CommonJS code. The names are misleading: `nextTick` does not wait for the next turn of the loop, `setImmediate` does. The Node docs recommend `queueMicrotask` for most new code.
- **ES module gotcha:** the top-level code of an ES module is itself evaluated inside a promise job, so there promise callbacks run *before* `nextTick` callbacks queued at the top level (`sync, promise, nextTick` instead of `sync, nextTick, promise`).
- **`setTimeout(fn, 0)` vs `setImmediate(fn)` from the main module has no guaranteed order**: it depends on whether 1 ms has already passed when the loop reaches its first timers phase. Inside an I/O callback, or inside a timer callback, `setImmediate` always wins, because the check phase comes before the next timers phase (Examples 7 and 8).

**Puzzle 3.** What does this print?

```js
const fs = require('node:fs');
fs.readFile(__filename, () => {
    setTimeout(() => console.log('timeout'), 0);
    setImmediate(() => console.log('immediate'));
    process.nextTick(() => console.log('nextTick'));
    Promise.resolve().then(() => console.log('promise'));
});
```

Answer: `nextTick`, `promise`, `immediate`, `timeout`. When the `readFile` callback returns (poll phase), Node drains the nextTick queue and then the promise queue. The loop then moves on to the check phase (`setImmediate`) and only reaches the timers phase on the next turn.

| | Browser | Node.js |
|---|---|---|
| Loop defined by | HTML Standard | libuv phases |
| Tasks | Several task queues; the browser picks one per turn | One queue per phase |
| Microtasks | Whenever the stack empties after a callback | After every callback: nextTick queue first, then promises |
| Rendering | rAF, style, layout, paint once per frame | None |
| "Run soon" APIs | `setTimeout`, `MessageChannel`, `scheduler.postTask` | `setImmediate`, `setTimeout`, `MessageChannel` |
| `setTimeout(fn, 0)` minimum | 0 ms; 4 ms once nested 5 levels | 1 ms |
| Host-only APIs | `requestAnimationFrame`, `requestIdleCallback`, `scheduler` | `process.nextTick`, `setImmediate` |

> **Note:** More output-prediction practice across topics is in [Output prediction](../../06-interview/04-output-prediction/notes.md).

## Common Mistakes

- **Thinking `setTimeout(fn, 0)` runs "now".** It runs after the current task, every pending microtask, possibly a frame, and possibly other tasks.
- **Thinking `async`, `await` or `new Promise` moves work off the main thread.** CPU work inside an async function blocks exactly like synchronous code; only the waiting is free.
- **"Yielding" with `await Promise.resolve()` or `queueMicrotask`.** Microtasks run before rendering and input, so nothing else gets a turn.
- **Setting a loading message and then doing heavy synchronous work in the same task.** The message is never painted.
- **Polling with an endless promise or `process.nextTick` chain**, which freezes the page or starves Node's I/O.
- **Relying on the order of `setTimeout(0)` vs `requestAnimationFrame`, or `setTimeout(0)` vs `setImmediate` in Node's main module.** Neither is guaranteed.
- **Relying on exact microtask tick counts** (`return p` vs `return await p`, `resolve(p)`) for correctness. They are implementation details and have changed before.
- **Assuming timers run on schedule in a background tab or during a long task.** Measure elapsed time with `performance.now()` or `Date.now()`.
- **Yielding after every item** of a big loop instead of on a time budget, which makes the job several times slower.
- **Leaving a `MessagePort` open in Node**, which keeps the process from exiting.

## Key Takeaways

- One thread, one call stack: a task runs to completion, and the event loop acts only when the stack is empty.
- Each turn of the browser loop: one task, then **all** microtasks, then (when a frame is due) rAF → style → layout → paint.
- Microtasks run whenever the stack empties after a host callback: after each task, between the listeners of a real user event, and between rAF callbacks.
- `await` resumes as a microtask; it pauses one function, it does not free the thread from CPU work.
- The browser renders and handles input only between tasks, so every task over 50 ms is a long task. Split the work and yield with `scheduler.yield()` (feature-detected) or a task-based fallback, or move it to a worker.
- `setTimeout` delays are minimums: 4 ms clamp once nested, heavy throttling in background tabs.
- Node runs phases (timers → poll → check → close), drains `process.nextTick` before promises after every callback, and runs `setImmediate` before `setTimeout(0)` inside I/O callbacks.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the event loop, and why does JavaScript need one?**
JavaScript runs on one thread with one call stack, so it executes one piece of code at a time. Waiting for timers, the network or the disk is done by the host outside that thread. The event loop is the host's scheduler: whenever the call stack is empty, it takes the next thing that is ready (a task, the pending microtasks, or a rendering step in the browser) and runs it. That is how a single thread handles many operations concurrently: it never sits waiting, it only runs callbacks when their results are ready.

**Q2. What does "run to completion" mean, and what is its practical consequence?**
Once a task starts, it runs until the call stack is empty; no other callback, event handler or repaint can interrupt it. The upside is that no other code can change your variables halfway through a function, so ordinary JavaScript needs no locks. The downside is that a slow function blocks everything: clicks queue up, JavaScript-driven animations stop, and the page does not repaint until the task ends.

**Q3. What is the difference between a task (macrotask) and a microtask? Give examples.**
Tasks are `setTimeout`/`setInterval` callbacks, user events, `postMessage` messages and I/O completions; the loop runs one task per turn and may render between tasks. Microtasks are promise reactions (`then`/`catch`/`finally`), code after `await`, `queueMicrotask` callbacks and `MutationObserver` callbacks; after each task the loop runs all of them, including ones queued meanwhile, before it renders or takes the next task. So a `.then` callback always runs before a `setTimeout(fn, 0)` callback scheduled at the same moment.

**Q4. Does `setTimeout(fn, 1000)` run exactly one second later?**
No, the delay is a minimum. After one second the callback is queued as a task, and it still waits for the running task, all microtasks, and possibly other tasks and a frame. Browsers also clamp nested timers to at least 4 ms and throttle timers in background tabs to about once per second or less. If you need accurate elapsed time, read `performance.now()` or `Date.now()` instead of counting callbacks.

**Q5. A click handler sets `status.textContent = 'Loading...'` and then runs a loop that takes two seconds. Why does the user never see "Loading..."?**
The browser paints only between tasks. The text is changed inside the click task, and the loop keeps that same task running, so no rendering step can happen until the handler returns, and by then the text has changed again. For those two seconds the page ignores input too. Fix: set the text, yield (`await scheduler.yield()` or a `setTimeout` fallback) so the browser can paint, then do the work, in chunks or in a Web Worker.

**Q6. In what order does this log?**
```js
console.log('A');
setTimeout(() => {
    console.log('B');
    Promise.resolve().then(() => console.log('C'));
}, 0);
setTimeout(() => console.log('D'), 0);
Promise.resolve().then(() => console.log('E'));
console.log('F');
```
`A F E B C D`. The synchronous code logs `A` and `F`, then the microtask queue is drained (`E`). The first timer task logs `B` and queues a microtask; the microtask queue is drained after **every** task, so `C` runs before the second timer task logs `D`. (Node versions before 11 printed `B D C`, because they drained microtasks only between phases.)

### Mid-level (2–4 years)

**Q7. When exactly is the microtask queue drained? Why can a real click and `button.click()` log in a different order?**
At a microtask checkpoint, which happens whenever the call stack becomes empty after the host invoked a callback: after each task, but also between the listeners of a browser-dispatched event, between rAF callbacks and between `<script>` elements. For a real click the browser calls each listener from an empty stack, so the microtasks queued by listener 1 run before listener 2. With `button.click()` or `dispatchEvent()` the listeners run synchronously inside your code, so all listeners run first and their microtasks run after your code finishes. It matters in tests: code driven by `.click()` can see a different order than a real user.

**Q8. What is microtask starvation? Why does a recursive promise chain freeze the page when a recursive `setTimeout` does not?**
The microtask queue is drained until it is empty before the loop moves on. A microtask that keeps queueing another one keeps the queue non-empty forever, so the loop never reaches the next task, input handling or the rendering step: the page freezes as if it ran `while (true)`. A recursive `setTimeout` makes each round a separate task, and the browser renders and handles input between tasks. In Node, a recursive `process.nextTick` starves I/O in the same way. Repeating work belongs in tasks (`setTimeout`, `scheduler.postTask`) or rAF, never in a microtask chain.

**Q9. Predict the output.**
```js
async function first() {
    console.log('1');
    await second();
    console.log('2');
}
async function second() {
    console.log('3');
    await null;
    console.log('4');
}
setTimeout(() => console.log('5'), 0);
first();
Promise.resolve().then(() => console.log('6'));
console.log('7');
```
`1 3 7 4 6 2 5`. `first()` logs `1` and calls `second()`, which logs `3` and suspends at `await null`, queueing its continuation. `second()` returns a still-pending promise, so `first` suspends waiting for it. The `.then` that logs `6` is queued behind `second`'s continuation, and `7` is the last synchronous log. Microtasks: `second` resumes and logs `4`; finishing fulfils its promise, which queues `first`'s continuation behind `6`. So `6`, then `2`, and the timer task logs `5` last.

**Q10. In Node.js, explain the order of `process.nextTick`, a promise callback, `setImmediate` and `setTimeout(fn, 0)`.**
After each callback Node drains the nextTick queue, then the promise queue, so in CommonJS code `nextTick` runs before `.then`. `setImmediate` runs in the check phase, right after poll, and `setTimeout` in the timers phase at the start of the next turn. Inside an I/O callback `setImmediate` therefore always runs before `setTimeout(0)`; from the main module their order is not guaranteed, because it depends on whether 1 ms has passed when the loop starts. Two traps: in an ES module's top-level code promises run before `nextTick`, and a recursive `nextTick` starves I/O.

**Q11. Compare `setTimeout(fn, 0)`, a `MessageChannel` message, `scheduler.yield()` and `await Promise.resolve()` as ways to "continue later". Which ones actually yield?**
The first three end the current task, so the browser can handle input and paint before the work continues. `setTimeout(0)` puts the continuation at the back of the timer queue and is clamped to 4 ms once nested, which adds up in a loop. A `MessageChannel` message is a new task with no clamp, which is why schedulers such as React's use it. `scheduler.yield()` is designed for this: its continuation runs ahead of other queued tasks of the same priority, so a third-party script cannot jump in front of your half-finished work, but it is not in Safari, so feature-detect it. `await Promise.resolve()` only queues a microtask in the same checkpoint: nothing else runs in between, so it does not yield at all.

**Q12. How does `queueMicrotask(fn)` differ from `Promise.resolve().then(fn)` and from `setTimeout(fn, 0)`? When would you use it?**
`queueMicrotask` and `Promise.resolve().then` use the same microtask queue, so they run at the same point: after the current synchronous code, before rendering and before any task. `queueMicrotask` does not allocate a promise, and an error thrown in `fn` is reported as a normal uncaught error rather than an unhandled rejection. `setTimeout(fn, 0)` is a task: it runs later, after rendering may have happened. Use `queueMicrotask` to batch work that must complete before the next paint, for example coalescing several state changes into one DOM update; use a task when you want the browser to paint or handle input first.

**Q13. Where does a `requestAnimationFrame` callback run relative to tasks and microtasks? Is the order of rAF and `setTimeout(fn, 0)` predictable?**
rAF callbacks run in the rendering step: after the current task and its microtasks, right before style, layout and paint of the next frame, with a microtask checkpoint after each callback. That step happens only when a frame is due (once per display refresh), so several tasks may run before it, or it may come right after the current task. That is why rAF vs `setTimeout(fn, 0)` has no fixed order: it depends on where in the frame you scheduled them. Code that needs "after the DOM change is painted" should use a double rAF or rAF followed by `setTimeout`, not a guess about ordering.

### Senior (5+ years)

**Q14. A dashboard loads 20 widgets, each fetching data and rendering. On mid-range phones the first interaction after load feels stuck. How would you schedule the work?**
The problem is not the network but the many render tasks that land together when responses arrive, plus their parsing, all competing with the user's first click. Give work explicit priorities: render above-the-fold widgets first as normal tasks; schedule below-the-fold widgets with `scheduler.postTask(..., { priority: 'background' })` or when they scroll into view (`IntersectionObserver`); keep analytics and prefetching in `requestIdleCallback`; batch DOM writes per frame with rAF; and give each widget an `AbortSignal` so navigating away cancels both fetches and queued work. Large JSON transforms go to a worker.

Because `scheduler` and `requestIdleCallback` are not everywhere, wrap them in one small scheduling module with fallbacks (`MessageChannel`/`setTimeout`) so widgets express intent ("background", "user-visible") rather than calling primitives directly. Recommendation: one shared scheduler with priorities and cancellation, viewport-driven rendering for below-the-fold widgets, and an INP and long-task check on a throttled CPU before release.

**Q15. A Node.js API's p99 latency jumps from 40 ms to 2 s under load, while CPU looks moderate and the database is fast. How do you check whether the event loop is the problem, and how do you fix it?**
In Node, every request shares one thread, so one slow synchronous operation delays every other request's callbacks. Measure event loop delay directly: `perf_hooks.monitorEventLoopDelay()` gives a histogram of how late the loop runs, and `performance.eventLoopUtilization()` shows how busy it is; export both as metrics next to latency. If delay spikes match the latency spikes, take a CPU profile under load (`node --cpu-prof`, or the inspector) and look for the usual suspects: large `JSON.parse`/`JSON.stringify`, synchronous `fs` or `crypto` calls, catastrophic regexes, big in-memory sorts, or a recursive `process.nextTick`/promise loop starving I/O.

Fixes: replace sync APIs with async ones, stream large payloads instead of buffering them, move CPU-heavy work to `worker_threads` (or another service), chunk unavoidable loops with `setImmediate`, and cap request body size. Recommendation: alert on event loop delay as a first-class health metric, because a blocked loop looks like "everything is slow" and is otherwise easy to misdiagnose as a database or network problem.

**Q16. A teammate says: "I made the CSV parser async, so it can't freeze the UI anymore." What do you tell them, and how do you keep the team from making this mistake?**
`async` changes how a result is delivered, not where the work runs. An async function runs synchronously until its first `await`, and awaiting something that is already available only queues a microtask, which still runs before input and paint. A parser that awaits nothing slow is one long task wrapped in a promise. Real options: parse in chunks with real yields, stream the file and parse incrementally, or, for multi-megabyte input, parse in a Web Worker so the main thread stays free.

To stop it recurring, make main-thread cost visible and give people a default: long-task or Long Animation Frame monitoring in RUM, a Total Blocking Time budget in CI, a short guideline ("`async` is not 'off the main thread': anything over about 50 ms of CPU must chunk or go to a worker"), and a performance trace in reviews of data-heavy features. Recommendation: move heavy parsing to a worker, and enforce budgets in CI so the next one is caught automatically.

**Q17. Some tests and production code depend on the exact order of microtasks and timers, and they break between browsers or Node versions. How do you make them robust?**
Only a few ordering rules are guaranteed: synchronous code before microtasks, microtasks in FIFO order, tasks from the same source in order. Everything else (rAF vs `setTimeout`, `setTimeout(0)` vs `setImmediate`, how many ticks `return p` takes, the order of tasks from different sources) is an implementation detail, and some of it has already changed (Node 11's microtask semantics, the 2019 `await` optimisation). Code that relies on it is a race condition that happens to pass today.

Express the real dependency instead: return and await the promise you depend on, resolve a promise or emit an event when the state is ready, and never "wait one tick" with `setTimeout(fn, 0)` added until it works. In tests, use fake timers (`vi.useFakeTimers()` / `jest.useFakeTimers()` with `advanceTimersByTimeAsync`) or wait for an observable outcome (`await findByText(...)`), not a fixed number of `await Promise.resolve()` calls. Recommendation: treat a `setTimeout(fn, 0)` or tick-counting "fix" in code review as a bug report, and ask for the dependency to be made explicit.

## References

- [HTML Standard: Event loops](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops)
- [MDN: The event loop (JavaScript execution model)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop)
- [MDN: Using microtasks in JavaScript with queueMicrotask()](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide)
- [MDN: In depth: Microtasks and the JavaScript runtime environment](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth)
- [MDN: setTimeout()](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)
- [MDN: requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN: Prioritized Task Scheduling API](https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API)
- [MDN: Scheduler.yield()](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)
- [MDN: MessageChannel](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel)
- [web.dev: Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
- [web.dev: Interaction to Next Paint (INP)](https://web.dev/articles/inp)
- [Jake Archibald: Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/)
- [V8 blog: Faster async functions and promises](https://v8.dev/blog/fast-async)
- [Node.js: The Node.js Event Loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)
- [Node.js: Understanding process.nextTick()](https://nodejs.org/en/learn/asynchronous-work/understanding-processnexttick)
- [Node.js: perf_hooks.monitorEventLoopDelay()](https://nodejs.org/api/perf_hooks.html#perf_hooksmonitoreventloopdelayoptions)
