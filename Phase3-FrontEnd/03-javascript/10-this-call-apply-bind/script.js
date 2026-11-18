// this, call(), apply() and bind(): run with `node script.js`
// The file is a CommonJS script without "use strict", so it starts in sloppy mode.
// Functions that need strict mode opt in with their own "use strict" directive.

const section = (title) => console.log(`\n--- ${title} ---`);

// 0. Top level and globalThis
section("Top level");
console.log("top-level this === module.exports:", this === module.exports); // true in a CommonJS file
console.log("globalThis === global:", globalThis === global); // true in Node.js (window in browsers)

// 1. Default binding: a plain call
section("1. Default binding");
function sloppyWhoAmI() {
  return this;
}
function strictWhoAmI() {
  "use strict";
  return this;
}
console.log("sloppy plain call -> globalThis:", sloppyWhoAmI() === globalThis); // true
console.log("strict plain call ->", strictWhoAmI()); // undefined

// 2. Implicit binding: the object before the dot, at call time
section("2. Implicit binding");
const user = {
  firstName: "Aman",
  greet() {
    return `Hi, ${this.firstName}`;
  },
  address: {
    city: "Delhi",
    show() {
      return this.city; // `this` is user.address, the object directly before the dot
    },
  },
};
console.log(user.greet()); // Hi, Aman
console.log(user.address.show()); // Delhi

// Implicit binding is lost when the function is taken off the object
const detached = user.greet;
console.log("detached call:", detached()); // Hi, undefined (sloppy: this is globalThis)
const { greet } = user; // destructuring a method detaches it too
console.log("destructured call:", greet()); // Hi, undefined
console.log("(user.greet)():", (user.greet)(), "| (0, user.greet)():", (0, user.greet)()); // parentheses keep it, the comma operator loses it

// 3. Explicit binding: call, apply, bind
section("3. Explicit binding");
function introduce(city, country) {
  return `${this.name} from ${city}, ${country}`;
}
const aman = { name: "Aman" };
console.log(introduce.call(aman, "Delhi", "India")); // arguments one by one
console.log(introduce.apply(aman, ["Delhi", "India"])); // arguments as an array
const fromDelhi = introduce.bind(aman, "Delhi"); // returns a new function, `this` and "Delhi" fixed
console.log(fromDelhi("India"));

// Method borrowing, as in ../09-objects-and-enums/enums-and-call.js
const person = {
  fullName: function () {
    return this.firstName + " " + this.lastName;
  },
};
const person1 = { firstName: "John", lastName: "Doe" };
console.log(person.fullName.call(person1)); // John Doe

// 4. new binding
section("4. new binding");
function Player(name) {
  this.name = name; // `this` is the brand-new object
}
const virat = new Player("Virat");
console.log(virat.name, virat instanceof Player); // Virat true

// 5. Precedence: new > explicit (bind) > implicit > default
section("5. Precedence");
const team = { name: "RCB", getName() { return this.name; } };
const other = { name: "CSK" };
console.log("explicit beats implicit:", team.getName.call(other)); // CSK

function getName() { return this.name; }
const boundToA = getName.bind({ name: "A" });
console.log("bound function ignores call/bind:", boundToA.call({ name: "B" }), boundToA.bind({ name: "C" })()); // A A

const BoundPlayer = Player.bind({ name: "ignored" });
const p = new BoundPlayer("Faf");
console.log("new beats bind:", p.name, p instanceof Player); // Faf true

// 6. Arrow functions: lexical this
section("6. Arrow functions");
const counter = {
  count: 0,
  incArrow: () => typeof this.count, // `this` is module.exports here, not counter
  incRegular() { return ++this.count; },
  delayedLabels() {
    // the arrow callback borrows `this` from delayedLabels(), so this.count works
    return [1, 2].map((n) => `${n}/${this.count}`);
  },
};
console.log("arrow method:", counter.incArrow()); // undefined
console.log("regular method:", counter.incRegular()); // 1
console.log("arrow callback inside a method:", counter.delayedLabels()); // [ '1/1', '2/1' ]
const arrow = () => this;
console.log("call() cannot change an arrow's this:", arrow.call({ x: 1 }) === module.exports); // true

// 7. Class methods and class-field arrow functions
section("7. Classes");
class Button {
  label = "Save";
  handleArrow = () => this.label; // class field: one function per instance, `this` fixed
  handleMethod() {
    return this.label; // prototype method: shared, `this` depends on the call
  }
}
const btn = new Button();
const { handleArrow, handleMethod } = btn;
console.log("detached class-field arrow:", handleArrow()); // Save
try {
  handleMethod(); // class bodies are strict, so `this` is undefined
} catch (e) {
  console.log("detached class method:", `${e.constructor.name}: ${e.message}`);
}
console.log("method on prototype:", Object.hasOwn(Button.prototype, "handleMethod"), "| arrow on instance:", Object.hasOwn(btn, "handleArrow"));

// 8. Event handlers (Node.js has the same EventTarget API as the browser)
section("8. Event listeners");
const target = new EventTarget();
target.addEventListener("ping", function (event) {
  console.log("regular listener: this === currentTarget:", this === event.currentTarget);
});
target.addEventListener("ping", (event) => {
  // In an arrow listener, read the element from the event (event.currentTarget in the browser)
  console.log("arrow listener: this === module.exports:", this === module.exports, "| event.target === target:", event.target === target);
});
const listenerObject = {
  name: "listenerObject",
  handleEvent(event) {
    console.log("handleEvent object: this.name =", this.name);
  },
};
target.addEventListener("ping", listenerObject);
target.dispatchEvent(new Event("ping"));

// 9. Strict vs sloppy with primitives and null
section("9. Strict vs sloppy");
console.log("sloppy call(5):", typeof sloppyWhoAmI.call(5), "| strict call(5):", typeof strictWhoAmI.call(5)); // object number
console.log("sloppy call(null) -> globalThis:", sloppyWhoAmI.call(null) === globalThis, "| strict call(null):", strictWhoAmI.call(null)); // true null

// 10. new.target
section("10. new.target");
function Shape() {
  if (new.target === Shape) throw new TypeError("Shape is abstract");
  this.kind = new.target.name;
}
function Circle() {
  return Reflect.construct(Shape, [], Circle); // runs Shape with new.target === Circle
}
Circle.prototype = Object.create(Shape.prototype);
try {
  new Shape();
} catch (e) {
  console.log(e.message); // Shape is abstract
}
console.log(new Circle().kind); // Circle
function Probe() {
  console.log("new.target is", new.target === undefined ? "undefined (plain call)" : new.target.name);
}
Probe(); // new.target is undefined (plain call)
new Probe(); // new.target is Probe

// 11. Borrowing methods
section("11. Borrowing methods");
console.log(Math.max.apply(null, [1, 5, 3]), Math.max(...[1, 5, 3])); // 5 5
function argsToArray() {
  return Array.prototype.slice.call(arguments); // modern: Array.from(arguments) or rest parameters
}
console.log(argsToArray(1, 2)); // [ 1, 2 ]
console.log(Array.prototype.map.call("abc", (c) => c.toUpperCase())); // [ 'A', 'B', 'C' ]
console.log(Object.prototype.toString.call([]), Object.prototype.toString.call(null)); // [object Array] [object Null]
const dict = Object.create(null); // no prototype, so no hasOwnProperty method
dict.key = 1;
console.log(Object.prototype.hasOwnProperty.call(dict, "key"), Object.hasOwn(dict, "key")); // true true

// 12. Wrappers must forward `this`
section("12. Wrappers");
function logCalls(fn) {
  return function (...args) { // a regular function, so it receives the caller's `this`
    console.log(`calling ${fn.name}`);
    return fn.apply(this, args); // forward `this` and the arguments
  };
}
const account = { balance: 100, add: logCalls(function add(n) { return (this.balance += n); }) };
console.log(account.add(50)); // calling add, then 150

// 13. Callbacks lose `this` (timers run after all synchronous code above)
section("13. setTimeout (async, printed last)");
const greeter = {
  firstName: "Aman",
  logGreeting() {
    console.log(`setTimeout(greeter.logGreeting) -> Hi, ${this.firstName}`);
  },
};
setTimeout(greeter.logGreeting, 0); // the timer calls it as a plain function: Hi, undefined
setTimeout(function () {
  console.log("inside a plain function run by setTimeout, this is a", this.constructor.name); // Timeout in Node.js, window in browsers
  console.log("fix 1, arrow wrapper:", (() => user.greet())());
  console.log("fix 2, bind:", user.greet.bind(user)());
}, 0);
