// Output prediction puzzles: runs every snippet from notes.md and prints what it actually logs.
// Run with: node puzzles.js
// The file is deliberately NOT in strict mode (puzzles about `this` need sloppy-mode functions).
// Each puzzle runs inside its own function, so a thrown error is caught and shown as "Uncaught ...".

const util = require('node:util');

const puzzles = [];
const puzzle = (label, fn) => puzzles.push({ label, fn });
let current = null; // output lines of the puzzle that is running
const realLog = console.log;

process.on('unhandledRejection', (err) => {
  if (current) current.push(`Unhandled rejection: ${err.message}`);
});

// ---------------------------------------------------------------- Hoisting and the TDZ
puzzle('P1 function declaration vs var', () => {
  console.log(typeof foo);
  var foo = 1;
  function foo() {}
  console.log(typeof foo);
});

puzzle('P2 typeof and the TDZ', () => {
  console.log(typeof notDeclaredAnywhere);
  console.log(typeof later);
  let later = 1;
});

puzzle('P3 default parameters and the TDZ', () => {
  function range(start = end - 5, end = 10) {
    return [start, end];
  }
  console.log(range(1));
  console.log(range());
});

// ---------------------------------------------------------------- Scope and closures in loops
puzzle('P4 let declared outside the for header', () => {
  const fns = [];
  let i;
  for (i = 0; i < 3; i++) fns.push(() => i);
  console.log(fns.map((f) => f()));
});

puzzle('P5 changing the loop variable inside the body', () => {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => console.log(i));
    i++;
  }
});

puzzle('P6 closures capture variables, not values', () => {
  let count = 0;
  const report = (() => {
    const snapshot = count;
    return () => console.log(snapshot, count);
  })();
  count = 5;
  report();
});

// ---------------------------------------------------------------- this binding
puzzle('P7 a regular callback inside a method', () => {
  const counter = {
    count: 10,
    doubled() {
      return [1, 2].map(function (n) { return n * this.count; });
    },
  };
  console.log(counter.doubled());
});

puzzle('P8 strict vs sloppy this', () => {
  function strictWho() { 'use strict'; return this; }
  function sloppyWho() { return this; }
  console.log(strictWho(), strictWho.call(null), strictWho.call(2));
  console.log(sloppyWho() === globalThis, typeof sloppyWho.call(2));
});

puzzle('P9 detached class method vs arrow field', () => {
  class Button {
    label = 'Save';
    click() { return this?.label; }
    handle = () => this.label;
  }
  const { click, handle } = new Button();
  console.log(click(), handle());
});

// ---------------------------------------------------------------- Coercion and equality
puzzle('P10 the + operator', () => {
  console.log([] + []);
  console.log([] + {});
  console.log(1 + '2' - 1);
  console.log('3' * '4', true + true);
});

puzzle('P11 null, undefined and NaN comparisons', () => {
  console.log(null == 0, null >= 0, null == undefined);
  console.log(NaN == NaN, undefined == 0);
});

puzzle('P12 [] == ![]', () => {
  console.log([] == ![]);
  console.log([0] == false, [1, 2] == '1,2', [] == 0);
});

puzzle('P13 chained comparisons', () => {
  console.log(1 < 2 < 3, 3 > 2 > 1);
});

// ---------------------------------------------------------------- typeof quirks
puzzle('P14 typeof quirks', () => {
  console.log(typeof typeof 1, typeof NaN, typeof [], typeof class {});
  console.log(typeof new Number(1), typeof Number('1'));
  console.log(new Boolean(false) ? 'truthy' : 'falsy');
});

// ---------------------------------------------------------------- Numbers and floating point
puzzle('P15 converting strings to numbers', () => {
  console.log(Number(''), Number(' 12 '), Number('12px'), Number(null), Number(undefined));
  console.log(parseInt('12px'), parseFloat('.5.5'), parseInt(0.0000005));
});

puzzle('P16 NaN and -0', () => {
  console.log(NaN === NaN, Object.is(NaN, NaN), [NaN].includes(NaN), [NaN].indexOf(NaN));
  console.log(0 === -0, Object.is(0, -0), 1 / -0);
});

puzzle('P17 toFixed and Math.round', () => {
  console.log((1.005).toFixed(2), (1.255).toFixed(2));
  console.log(Math.round(2.5), Math.round(-2.5), Math.round(-2.6));
});

// ---------------------------------------------------------------- Objects and references
puzzle('P18 objects as object keys', () => {
  const cache = {};
  const a = { id: 1 };
  const b = { id: 2 };
  cache[a] = 'first';
  cache[b] = 'second';
  console.log(cache[a], Object.keys(cache));
});

puzzle('P19 a.x = a = {...}', () => {
  let a = { n: 1 };
  const b = a;
  a.x = a = { n: 2 };
  console.log(a.x, b.x);
});

puzzle('P20 property order', () => {
  const o = { b: 1, 10: 'ten', a: 2, 2: 'two', '-1': 'minus' };
  console.log(Object.keys(o));
});

// ---------------------------------------------------------------- Array method gotchas
puzzle('P21 default sort', () => {
  console.log([-1, -2, 3, 10, 1].sort());
});

puzzle('P22 map(parseInt)', () => {
  console.log(['1', '7', '11'].map(parseInt));
});

puzzle('P23 fill with an object', () => {
  const grid = new Array(2).fill([]);
  grid[0].push('x');
  console.log(grid, grid[0] === grid[1]);
});

// ---------------------------------------------------------------- Classes and prototypes
puzzle('P24 base constructor calls an overridden method', () => {
  class Base {
    constructor() { this.describe(); }
    describe() { console.log('base'); }
  }
  class Child extends Base {
    label = 'child';
    describe() { console.log('child:', this.label); }
  }
  new Child();
});

puzzle('P25 instanceof after replacing prototype', () => {
  function F() {}
  const f = new F();
  F.prototype = { reassigned: true };
  console.log(f instanceof F, f.constructor === F, new F() instanceof F);
});

// ---------------------------------------------------------------- Promises and the event loop
puzzle('P26 two promise chains', () => {
  Promise.resolve().then(() => console.log('a1')).then(() => console.log('a2'));
  Promise.resolve().then(() => console.log('b1')).then(() => console.log('b2'));
});

puzzle('P27 microtasks inside a timer', () => {
  setTimeout(() => {
    console.log('t1');
    Promise.resolve().then(() => console.log('p1'));
  });
  setTimeout(() => console.log('t2'));
});

puzzle('P28 returning a promise from then', () => {
  Promise.resolve()
    .then(() => { console.log('a'); return Promise.resolve('x'); })
    .then((v) => console.log(v));
  Promise.resolve()
    .then(() => console.log('b'))
    .then(() => console.log('c'))
    .then(() => console.log('d'))
    .then(() => console.log('e'));
});

// ---------------------------------------------------------------- async/await ordering
puzzle('P29 await vs then', () => {
  async function a() {
    console.log('a start');
    await b();
    console.log('a end');
  }
  async function b() { console.log('b'); }
  console.log('script start');
  a();
  Promise.resolve().then(() => console.log('then'));
  console.log('script end');
});

puzzle('P30 async function returning a promise', () => {
  async function viaPromise() { return Promise.resolve('promise'); }
  async function viaValue() { return 'value'; }
  viaPromise().then(console.log);
  viaValue().then(console.log);
});

puzzle('P31 the missing await', () => {
  async function save() { throw new Error('disk full'); }
  async function handler() {
    try {
      save();
      console.log('saved?');
    } catch (err) {
      console.log('caught', err.message);
    }
  }
  handler().then(() => console.log('handler done'));
});

// ---------------------------------------------------------------- Getters and JSON.stringify
puzzle('P32 what JSON.stringify drops', () => {
  console.log(JSON.stringify({ a: undefined, f() {}, n: NaN, d: new Date(0), list: [undefined, () => 1] }));
  console.log(JSON.stringify({ m: new Map([[1, 2]]), s: new Set([1]) }));
  console.log(JSON.stringify({ id: 1n }));
});

puzzle('P33 getters and toJSON', () => {
  const account = {
    balance: 100,
    get doubled() { return this.balance * 2; },
    toJSON() { return { balance: this.balance }; },
  };
  account.balance = 50;
  console.log(account.doubled, JSON.stringify(account));
});

puzzle('P34 assigning to a getter, then spreading', () => {
  const temp = { celsius: 20, get fahrenheit() { return this.celsius * 9 / 5 + 32; } };
  temp.fahrenheit = 100;
  const copy = { ...temp };
  temp.celsius = 30;
  console.log(temp.fahrenheit, copy.fahrenheit);
});

// ---------------------------------------------------------------- Interview questions
puzzle('Q1 banana', () => {
  console.log('b' + 'a' + +'a' + 'a');
});

puzzle('Q2 comparing strings', () => {
  console.log('10' < '9', 10 < '9', 'a' < 'B', 'apple' < 'apricot');
});

puzzle('Q3 arrays and arithmetic', () => {
  console.log([1, 2, 3] + [4, 5], [] + 1, [2] * [3]);
});

puzzle('Q4 function length', () => {
  function a(x, y) {}
  function b(x, y = 2, z) {}
  function c(...args) {}
  const d = (x, { y } = {}) => {};
  console.log(a.length, b.length, c.length, d.length);
});

puzzle('Q5 Math.max and Math.min', () => {
  console.log(Math.max([1, 2, 3]), Math.max(...[1, 2, 3]));
  console.log(Math.max(), Math.min() > Math.max());
});

puzzle('Q6 negative indexes and includes', () => {
  const list = [10, 20, 30];
  console.log(list[-1], list.at(-1), list.includes('10'), list.indexOf(30));
});

puzzle('Q7 class getters, private fields and JSON', () => {
  class User {
    #password = 'secret';
    constructor(name) { this.name = name; }
    get initials() { return this.name[0]; }
  }
  const u = new User('Ada');
  console.log(JSON.stringify(u), Object.keys(u), u.initials, 'initials' in u);
});

puzzle('Q8 optional chaining short-circuits', () => {
  const missing = null;
  const partial = {};
  console.log(missing?.load().data);
  console.log(partial.load?.().data);
  console.log(partial?.load());
});

puzzle('Q9 when destructuring defaults run', () => {
  let calls = 0;
  const next = () => ++calls;
  const { a = next(), b = next(), c = next() } = { a: 'given', b: undefined };
  console.log(a, b, c, calls);
});

puzzle('Q10 a boolean comparator', () => {
  console.log([3, 1, 2].sort((a, b) => a > b));
  console.log([3, 1, 2].sort((a, b) => a - b));
});

puzzle('Q11 converting a Symbol to a string', () => {
  const id = Symbol('id');
  console.log(String(id), id.description);
  console.log(`${id}`);
});

puzzle('Q12 Promise.all does not cancel', () => {
  const slow = new Promise((resolve) =>
    setTimeout(() => { console.log('slow finished'); resolve('slow'); }, 20));
  Promise.all([slow, Promise.reject(new Error('fast fail'))])
    .then(() => console.log('all done'))
    .catch((err) => console.log('caught', err.message));
});

puzzle('Q13 date-only strings and time zones (TZ=America/New_York)', () => {
  const previousTz = process.env.TZ;
  process.env.TZ = 'America/New_York'; // simulate a user in New York (UTC-5 in January)
  try {
    const fromApi = new Date('2024-01-15'); // date-only string
    const local = new Date('2024-01-15T00:00'); // date-time without an offset
    console.log(fromApi.getDate(), local.getDate());
    console.log(fromApi.toISOString(), local.toISOString());
  } finally {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  }
});

puzzle('Q14 object key order in API data', () => {
  // The API sends users sorted by name, keyed by ID
  const usersById = JSON.parse('{"20":"Ann","b7":"Raj","100":"Zoe"}');
  console.log(Object.values(usersById));
});

puzzle('Q15 feature flags from environment variables', () => {
  const env = { NEW_CHECKOUT: 'true', BETA_SEARCH: 'false', MAX_ITEMS: '0' }; // env values are strings
  console.log(env.NEW_CHECKOUT == true, Boolean(env.BETA_SEARCH), Boolean(env.MAX_ITEMS));
  if (env.BETA_SEARCH) console.log('beta search is ON');
});

// ---------------------------------------------------------------- Runner
(async () => {
  for (const { label, fn } of puzzles) {
    const lines = [];
    current = lines;
    console.log = (...args) => lines.push(util.format(...args));
    try {
      await fn();
    } catch (err) {
      lines.push(`Uncaught ${err.name}: ${err.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 60)); // let timers and microtasks finish
    console.log = realLog;
    current = null;
    realLog(label);
    for (const line of lines) realLog(`    ${line === '' ? '(empty string)' : line}`);
  }
})();
