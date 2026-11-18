// The Event Loop: ordering examples for notes.md
// Run with: node script.js   (Node 18+)
//
// Each example starts from a timer callback (a task), and the next example starts only after
// the previous one has finished, so their output never interleaves. For examples with a fixed
// order, the runner compares what was printed with the order described in notes.md.

'use strict';
const fs = require('node:fs');

let seen = [];
function log(label) {
    seen.push(label);
    console.log('  ' + label);
}

const ms = (start) => Math.round(performance.now() - start);

function busyWait(duration) {
    const end = performance.now() + duration;
    while (performance.now() < end) { /* block the thread on purpose */ }
}

const examples = [
    {
        title: '1. Sync code first, then every microtask, then the next task',
        expected: ['sync 1', 'sync 2', 'promise.then', 'queueMicrotask', 'setTimeout 0'],
        run(done) {
            log('sync 1');
            setTimeout(() => { log('setTimeout 0'); done(); }, 0);
            Promise.resolve().then(() => log('promise.then'));
            queueMicrotask(() => log('queueMicrotask'));
            log('sync 2');
        },
    },
    {
        title: '2. The microtask queue is drained after every task, not after all tasks',
        expected: ['timer 1', 'microtask queued by timer 1', 'timer 2'],
        run(done) {
            setTimeout(() => {
                log('timer 1');
                Promise.resolve().then(() => log('microtask queued by timer 1'));
            }, 0);
            setTimeout(() => { log('timer 2'); done(); }, 0);
        },
    },
    {
        title: '3. Code after await resumes as a microtask',
        expected: ['script start', 'a1 start', 'a2', 'p1 executor', 'script end', 'a1 end', 'p2', 'setTimeout'],
        run(done) {
            async function a1() {
                log('a1 start');
                await a2();
                log('a1 end');
            }
            async function a2() {
                log('a2');
            }

            log('script start');
            setTimeout(() => { log('setTimeout'); done(); }, 0);
            a1();
            new Promise((resolve) => {
                log('p1 executor');
                resolve();
            }).then(() => log('p2'));
            log('script end');
        },
    },
    {
        title: '4. Resolving a promise with another promise costs two extra microtask ticks',
        expected: ['B', 'C', 'A', 'D'],
        run(done) {
            const p = Promise.resolve();
            new Promise((resolve) => resolve(p)).then(() => log('A'));
            p.then(() => log('B')).then(() => log('C')).then(() => log('D'));
            setTimeout(done, 0);
        },
    },
    {
        title: '5. "return promise" settles a tick later than "return await promise"',
        expected: ['return await', 'return (no await)'],
        run(done) {
            async function withoutAwait() { return Promise.resolve(); }
            async function withAwait() { return await Promise.resolve(); }
            withoutAwait().then(() => log('return (no await)'));   // called first...
            withAwait().then(() => log('return await'));          // ...but settles first
            setTimeout(done, 0);
        },
    },
    {
        title: '6. dispatchEvent() runs listeners synchronously, so microtasks wait for all of them',
        expected: ['listener 1', 'listener 2', 'after dispatchEvent', 'microtask 1', 'microtask 2'],
        run(done) {
            const target = new EventTarget();
            target.addEventListener('ping', () => {
                log('listener 1');
                queueMicrotask(() => log('microtask 1'));
            });
            target.addEventListener('ping', () => {
                log('listener 2');
                queueMicrotask(() => log('microtask 2'));
            });
            target.dispatchEvent(new Event('ping'));
            log('after dispatchEvent');
            setTimeout(done, 0);
        },
    },
    {
        title: '7. Node: nextTick queue, then promise microtasks, then check phase, then next timers phase',
        expected: ['sync', 'process.nextTick', 'promise.then', 'queueMicrotask', 'setImmediate', 'setTimeout 0'],
        run(done) {
            setTimeout(() => { log('setTimeout 0'); done(); }, 0);
            setImmediate(() => log('setImmediate'));
            Promise.resolve().then(() => log('promise.then'));
            queueMicrotask(() => log('queueMicrotask'));
            process.nextTick(() => log('process.nextTick'));
            log('sync');
        },
    },
    {
        title: '8. Node: inside an I/O callback, setImmediate always runs before setTimeout(0)',
        expected: ['readFile callback', 'setImmediate', 'setTimeout 0'],
        run(done) {
            fs.readFile(__filename, () => {
                log('readFile callback');
                setTimeout(() => { log('setTimeout 0'); done(); }, 0);
                setImmediate(() => log('setImmediate'));
            });
        },
    },
    {
        title: '9. MessageChannel: postMessage queues a task, so it runs after the microtasks',
        expected: ['sync', 'microtask', 'message event'],
        run(done) {
            const { port1, port2 } = new MessageChannel();
            port1.onmessage = () => {
                log('message event');
                port1.close();   // in Node an open port keeps the process alive
                done();
            };
            port2.postMessage('ping');
            Promise.resolve().then(() => log('microtask'));
            log('sync');
        },
    },
    {
        title: '10. Microtask starvation: a 0 ms timer waits for a chain of 200,000 microtasks',
        run(done) {
            const start = performance.now();
            setTimeout(() => {
                log(`setTimeout 0 finally ran after ${ms(start)} ms`);
                done();
            }, 0);
            let count = 0;
            (function spin() {
                count += 1;
                if (count < 200_000) queueMicrotask(spin);   // each microtask queues the next one
                else log(`microtask chain finished: ${count} microtasks in ${ms(start)} ms`);
            })();
        },
    },
    {
        title: '11. A long task: a 10 ms timer cannot run until 200 ms of blocking work ends',
        run(done) {
            const start = performance.now();
            setTimeout(() => {
                log(`10 ms timer ran after ${ms(start)} ms`);
                done();
            }, 10);
            busyWait(200);
            log(`200 ms of blocking work finished at ${ms(start)} ms`);
        },
    },
    {
        title: '12. The same 200 ms of work in 20 ms chunks, yielding with setImmediate between chunks',
        run(done) {
            const start = performance.now();
            setTimeout(() => log(`10 ms timer ran after ${ms(start)} ms (between two chunks)`), 10);
            (async () => {
                for (let chunk = 1; chunk <= 10; chunk++) {
                    busyWait(20);
                    await new Promise((resolve) => setImmediate(resolve));   // yield: let other tasks run
                }
                log(`10 chunks finished at ${ms(start)} ms`);
                done();
            })();
        },
    },
    {
        title: '13. What one yield costs: 100 yields through each API (timings vary by machine and OS)',
        run(done) {
            const viaTimeout = () => new Promise((resolve) => setTimeout(resolve, 0));
            const viaImmediate = () => new Promise((resolve) => setImmediate(resolve));
            const { port1, port2 } = new MessageChannel();
            let pending = null;
            port1.onmessage = () => pending();
            const viaChannel = () => new Promise((resolve) => {
                pending = resolve;
                port2.postMessage(null);
            });

            async function measure(name, yieldOnce) {
                const start = performance.now();
                for (let i = 0; i < 100; i++) await yieldOnce();
                log(`${name.padEnd(16)} ${ms(start)} ms`);
            }

            (async () => {
                await measure('setTimeout(0)', viaTimeout);     // >= 1 ms each in Node (coarser on Windows)
                await measure('setImmediate', viaImmediate);
                await measure('MessageChannel', viaChannel);
                port1.close();
                done();
            })();
        },
    },
];

function runExample(index) {
    if (index >= examples.length) return;
    const example = examples[index];
    seen = [];
    console.log(`\n${example.title}`);
    example.run(() => {
        if (example.expected) {
            const same = example.expected.join('|') === seen.join('|');
            console.log(same
                ? '  -> same order as in notes.md'
                : `  -> DIFFERENT from notes.md, which expects: ${example.expected.join(', ')}`);
        }
        setTimeout(() => runExample(index + 1), 0);
    });
}

// Start from a timer callback so every example begins inside a task, like event-handler code.
setTimeout(() => runExample(0), 0);
