# Objects, Constructors and Enums

> JavaScript · Topic 9 · Demo: [script.js](script.js) · [enums-and-call.js](enums-and-call.js) · Run with `node script.js` and `node enums-and-call.js` (no HTML page)

Part 1 of the OOP notes: objects, constructor functions, `new` and encapsulation, then the object model underneath them: property descriptors, getters and setters, freezing, the frozen-object enum pattern, and `Proxy`/`Reflect`. Part 2 covers prototypes, classes and inheritance: [Prototypes, Prototype Inheritance and Classes](../11-prototypes-and-classes/notes.md). How `this` is decided, and `call()`, `apply()` and `bind()`, have their own note: [this, call(), apply() and bind()](../10-this-call-apply-bind/notes.md).

Object-oriented programming (OOP) is a way of organising code so that data and the functions that work on that data live together in one unit, an object. JavaScript supports OOP, but it does it with **prototypes** instead of classic classes, so knowing how objects and `new` really work, and what a property actually is, is the base for classes, framework reactivity (Vue 3 is built on `Proxy`), immutable state and most interview questions.

> **Note:** Both demos run in Node.js and use no browser APIs. `enums-and-call.js` also contains the `call()` example that [this, call(), apply() and bind()](../10-this-call-apply-bind/notes.md) explains. The `index.html` in [Prototypes and Classes](../11-prototypes-and-classes/notes.md) still has a commented-out `<script>` tag for `script.js` if you prefer the browser console.

## What Is OOP?

OOP is a programming paradigm that groups **data (properties)** and **actions (methods)** together inside one box, the object. It mirrors real-world things: a car has data (colour, speed) and actions (drive, brake).

> **Note:** JavaScript is neither a purely object-oriented language like Java nor a purely functional one. It is a **multi-paradigm, prototype-based** language: you can write procedural, functional or object-oriented code. Almost everything in JavaScript is an object, but objects inherit from other objects (prototypes) instead of from classes.

### OOP concepts in JavaScript

| Concept | Meaning | How JavaScript does it |
| --- | --- | --- |
| Object | A bundle of related state and behaviour | Object literal `{}`, `new`, `Object.create()` |
| Class | A blueprint for creating many similar objects | `class` (ES6) or a constructor function |
| Encapsulation | Hide internal state; expose a controlled interface | Closures, `#private` fields, getters/setters |
| Abstraction | Show *what* an object does, hide *how* | Public methods hiding helpers; no `abstract` keyword |
| Inheritance | Reuse the behaviour of another type | Prototype chain, `extends` |
| Polymorphism | Same method name, different behaviour per type | Method overriding, duck typing |

Inheritance, polymorphism and abstraction with `class` syntax are in [Part 2](../11-prototypes-and-classes/notes.md).

## Is JavaScript Object-Oriented?

To answer this common question, first compare the two styles:

- **Object-oriented (class-based) programming:** data and actions are grouped inside **classes**. You create a class first, then create its instances, called objects.
- **Prototype-based programming:** objects are derived from **other, already existing objects**. There is no separate "class" thing at runtime; an object simply points to another object (its prototype) and borrows its features.

> **Note:** "Prototypes are the mechanism by which JavaScript objects inherit features from one another." (MDN)

| | Class-based (Java, C#) | Prototype-based (JavaScript) |
| --- | --- | --- |
| Blueprint | A class, separate from objects | Any object can act as a blueprint |
| Inheritance | Class extends class (copied at compile time) | Object links to object (looked up at runtime) |
| Change behaviour at runtime | Not possible for compiled classes | Add a method to a prototype and every linked object gets it |
| `class` keyword | Real class | Syntactic sugar over constructor functions + prototypes |

So the answer: JavaScript **is** object-oriented, but its OOP is prototype-based, not class-based.

## Objects

An object is a collection of related data and/or functionality. It usually consists of several variables and functions, which are called **properties** and **methods** when they live inside an object.

```js
const person = {
  name: ["Bob", "Smith"],
  age: 32,
  bio: function () {
    console.log(`${this.name[0]} ${this.name[1]} is ${this.age} years old.`);
  },
  introduceSelf: function () {
    console.log(`Hi! I'm ${this.name[0]}.`);
  },
};

person.bio();           // → Bob Smith is 32 years old.
person.introduceSelf(); // → Hi! I'm Bob.
console.log(typeof person.name); // → "object" (arrays are objects)
```

Modern code usually writes methods with the shorter **method shorthand**: `bio() { ... }` instead of `bio: function () { ... }`. Both get the object as `this` when called as `person.bio()`; why that is, and when it breaks, is explained in [this, call(), apply() and bind()](../10-this-call-apply-bind/notes.md).

> **Note:** The demo writes `console.log(person.bio())`. That prints the bio and then `undefined`, because `bio()` logs its text but returns nothing. Call `person.bio()` on its own, or make `bio` `return` the string.

### Objects as object properties

A property can itself be an object (nesting):

```js
const person2 = {
  name: {
    first: "Bob",
    last: "Smith",
  },
  age: 32,
};

console.log(person2.name);       // → { first: "Bob", last: "Smith" }
console.log(person2.name.first); // → "Bob"
```

### Dot notation vs bracket notation

Bracket notation is an alternative way to access properties: `person2["age"]` and `person2["name"]["first"]` instead of `person2.age` and `person2.name.first`. This looks like accessing array items, and it is basically the same thing: instead of an index number you use the **name** (key) associated with the value. That is why objects are sometimes called **associative arrays**: they map strings to values the same way arrays map numbers to values.

| | Dot `obj.key` | Bracket `obj["key"]` / `obj[variable]` |
| --- | --- | --- |
| Key must be a valid identifier | Yes (no spaces or hyphens, cannot start with a digit) | No, any string or symbol |
| Key from a variable or expression | No | Yes |
| Symbol keys | No | Yes: `obj[sym]` |
| Readability | Better | Use when needed |
| Example | `person2.age` | `person2["first-name"]`, `freightTrain["flat car"]`, `obj[key]` |

```js
const field = "age";
console.log(person2[field]); // → 32
console.log(person2.field);  // → undefined (looks for a property literally called "field")
```

### Adding, updating and deleting properties

Objects are dynamic: you can add properties at any time.

```js
person.phone = "555-0100";       // add (as in the demo)
person.age = 33;                   // update
delete person.phone;               // delete
console.log("age" in person);      // → true
console.log(Object.hasOwn(person, "phone")); // → false
```

### Keys with spaces: the `Train` demo

[enums-and-call.js](enums-and-call.js) ends with a small class whose property names come from a variable and contain spaces:

```js
class Train {
  constructor() {
    this.length = 0;
  }
  add(car, contents) {
    this[car] = contents;   // bracket notation: the property name comes from a variable
    this.length++;
  }
}

let freightTrain = new Train();
freightTrain.add("refrigerator car", "cattle");
freightTrain.add("flat car", "aircraft parts");
freightTrain.add("tank car", "milk");
freightTrain.add("hopper car", "coal");

console.log(freightTrain["refrigerator car"]); // → cattle
console.log(freightTrain.length);              // → 4
// freightTrain.flat car                       // SyntaxError
```

- `class` defines a blueprint; `constructor` runs when you call `new Train()`, and `this` inside it is the new object. Classes are covered properly in [Prototypes and Classes](../11-prototypes-and-classes/notes.md).
- `this[car] = contents` creates a property whose **name is the value of `car`**. Since `"refrigerator car"` contains a space, it can only be read with bracket notation.

## Functions Are Objects

In JavaScript, functions are called **function objects** because they are objects. Like other objects they have properties and methods, they can be stored in a variable or an array, and they can be passed as arguments to other functions (that is what makes callbacks possible).

```js
function message() {
  console.log("Greetings Linda!");
}

console.log(typeof message);            // → "function"
console.log(message instanceof Object); // → true
console.log(message.name, message.length); // → "message" 0 (name and number of parameters)

message.calls = 0; // a function can carry its own properties
```

## Constructor Functions

A constructor function defines a custom type, and the `new` operator creates multiple objects from that type. Technically a constructor is just a regular function that follows two conventions:

- Its name starts with a capital letter, like `Person` or `Document`.
- It should be called only with the `new` operator.

> **Note:** ES6 introduced the `class` keyword for defining custom types. Classes are mostly syntactic sugar over constructor functions with some enhancements (see [Part 2](../11-prototypes-and-classes/notes.md)).

```js
function FuncPerson(firstName, lastName) {
  // this = {};  (done for you by `new`)

  // add properties to this
  this.firstName = firstName;
  this.lastName = lastName;

  // add a method to this
  this.getFullName = function () {
    return this.firstName + " " + this.lastName;
  };
  // return this;  (done for you by `new`)
}

const objFuncPerson = new FuncPerson("Aman", "Kumar");
const objectPerson2 = new FuncPerson("Virat", "Kohli");
console.log(objFuncPerson.getFullName()); // → "Aman Kumar"
```

### What `new` does

To create a new instance, use `new`: `let person = new Person('John', 'Doe');`. In simple terms, `new`:

1. Creates a new empty object and assigns it to `this`.
2. Assigns the arguments `'John'` and `'Doe'` to the `firstName` and `lastName` properties of that object.
3. Returns `this`.

The full, precise version has one more step that makes inheritance work:

1. Create a new empty object.
2. Link it to the constructor's prototype: the new object's `[[Prototype]]` (visible as `__proto__`) becomes `Person.prototype`.
3. Run the constructor with `this` bound to the new object.
4. Return the new object, **unless** the constructor explicitly returns another object. A returned primitive (number, string...) is ignored.

```js
// A hand-written version of `new`, to show the steps
function myNew(Constructor, ...args) {
  const obj = Object.create(Constructor.prototype);   // steps 1 and 2
  const result = Constructor.apply(obj, args);        // step 3
  const isObject = (typeof result === "object" && result !== null) || typeof result === "function";
  return isObject ? result : obj;                     // step 4
}

function R1() { this.a = 1; return { b: 2 }; }
function R2() { this.a = 1; return 42; }
console.log(new R1()); // → { b: 2 }  (the returned object wins)
console.log(new R2()); // → R2 { a: 1 }  (the primitive 42 is ignored)
```

The return-value rules (and more) are explained in the link from the original notes: [JavaScript Constructor Function](https://www.javascripttutorial.net/javascript-constructor-function/) ("read it to get more info about return type and more").

### Forgetting `new`

```js
function Person(name) {
  this.name = name;
}
const p = Person("Aman"); // no `new`
console.log(p);           // → undefined (the function returns nothing)
// Sloppy mode: `this` was the global object, so a global `name` variable was created.
// Strict mode: `this` is undefined → TypeError: Cannot set properties of undefined
```

A guard with `new.target` makes the constructor safe to call either way:

```js
function SafePerson(name) {
  if (!new.target) return new SafePerson(name); // called without new
  this.name = name;
}
console.log(SafePerson("Aman").name); // → "Aman"
```

Classes do this check for you: calling a class without `new` throws a `TypeError`. Why a plain call gets the global object or `undefined` as `this`, and what else `new.target` is used for, is in [this, call(), apply() and bind()](../10-this-call-apply-bind/notes.md).

### The problem: methods duplicated in every instance

When you create many instances, `this.getFullName = function () {...}` creates a **new copy of the function for every object**. That wastes memory.

```js
console.log(objFuncPerson.getFullName === objectPerson2.getFullName); // → false (two copies)
```

The fix is the **prototype**: put methods on `Constructor.prototype` so all instances share one copy.

```js
function Person(firstName, lastName) {
  this.firstName = firstName;  // data stays per instance
  this.lastName = lastName;
}
Person.prototype.getFullName = function () {   // one shared method
  return `${this.firstName} ${this.lastName}`;
};

const p1 = new Person("Aman", "Kumar");
const p2 = new Person("Virat", "Kohli");
console.log(p1.getFullName());                  // → "Aman Kumar"
console.log(p1.getFullName === p2.getFullName); // → true (one shared copy)
```

### Instance properties vs properties on the constructor

```js
// Adding a property to one existing object affects only that object
objectPerson2.Age = 37;
console.log(objectPerson2.Age); // → 37
console.log(objFuncPerson.Age); // → undefined (Age belongs only to objectPerson2)

// Adding a property to the constructor function itself
FuncPerson.City = "Delhi";
console.log(objFuncPerson.City); // → undefined
console.log(FuncPerson.City);    // → "Delhi"
```

`FuncPerson.City` puts the property on the **function object** (like a static property). Instances do not inherit from the constructor function; they inherit from `FuncPerson.prototype`.

> **Note (corrected from the original notes):** The original notes said that new methods or properties for a constructor "must be added inside the constructor function". You **cannot** add them the way you add a property to an existing object (`FuncPerson.City = ...` does not reach instances), but there are two ways that work: inside the constructor (`this.x = ...`, one copy per instance) or on the prototype (`FuncPerson.prototype.x = ...`, shared, and it can be done later, even after instances exist).

```js
FuncPerson.prototype.City = "Delhi";
console.log(objFuncPerson.City); // → "Delhi" (found on the prototype)
```

### Function prototype and object prototype (the `Car` demo)

```js
function Car() {
  console.log("Car instance created!");
}
Car.prototype.color = "Red";                  // property on the prototype
Car.prototype.drive = function () {           // method on the prototype
  console.log(`Driving the car painted in ${this.color}...`);
};

console.log(`The car's color is: ${Car.prototype.color}`); // → The car's color is: Red
Car.prototype.drive();       // → Driving the car painted in Red...  (this = Car.prototype)

const objCar = new Car();    // → Car instance created!
console.log(objCar.__proto__);                  // → { color: "Red", drive: f }
console.log(objCar.__proto__ === Car.prototype); // → true
```

`Car.prototype` is the **function's prototype property**; `objCar.__proto__` is the **object's prototype link**. They point to the same object. [Part 2](../11-prototypes-and-classes/notes.md) explains the difference in detail.

## Encapsulation

Encapsulation means keeping an object's internal data private and letting the outside world change it only through methods you control. In JavaScript it is done with **closures** or with **private fields** (`#`). The demo code for both is in [prototypes.js](../11-prototypes-and-classes/prototypes.js).

### With closures

Variables declared with `let`/`const` inside the constructor are not properties of the object, so nothing outside can reach them. Only the methods created in the same scope can read them, because they close over them.

```js
function Person(firstName, lastName) {
  let _firstName = firstName;   // private: a local variable, not a property
  let _lastName = lastName;

  this.getFirstName = function () { return _firstName; };
  this.getLastName = function () { return _lastName; };
  this.greet = function () {
    console.log(`Hello, my name is ${this.getFirstName()} ${this.getLastName()}`);
  };
}

const sam = new Person("Sam", "Smith");
sam.greet();                 // → Hello, my name is Sam Smith
console.log(sam._firstName); // → undefined (not reachable from outside)
```

### With private fields (`#`)

The `#` prefix defines **private fields** inside a class. They cannot be accessed outside the class that defines them, which prevents accidental or unauthorised access to an object's internal data.

```js
class Person {
  #firstName;
  #lastName;

  constructor(firstName, lastName) {
    this.#firstName = firstName;
    this.#lastName = lastName;
  }

  greet() {
    console.log(`Hello, my name is ${this.#firstName} ${this.#lastName}`);
  }
}

const alice = new Person("Alice", "Johnson");
alice.greet();                 // → Hello, my name is Alice Johnson
// alice.#firstName;           // SyntaxError: private field must be declared in an enclosing class
console.log(alice.firstName);  // → undefined (#firstName and firstName are different names)
```

> **Note (corrected):** The original notes said private fields arrived in ECMAScript 2020 (ES11). Private fields were standardised in **ECMAScript 2022 (ES13)**, together with public class fields, although Chrome and Node.js shipped them earlier (2019).

### Controlled access with a getter

```js
class BankAccount {
  #balance = 0;

  deposit(amount) {
    if (amount <= 0) throw new RangeError("Amount must be positive");
    this.#balance += amount;
  }

  get balance() {          // read-only from outside
    return this.#balance;
  }
}

const acc = new BankAccount();
acc.deposit(500);
console.log(acc.balance); // → 500
acc.balance = 1000000;    // ignored (no setter); throws TypeError in strict mode
console.log(acc.balance); // → 500
```

| Technique | Truly private? | Memory | Notes |
| --- | --- | --- | --- |
| `_name` naming convention | No, just a hint to other developers | Shared methods possible | Anyone can still read and write `obj._name` |
| Closures in a constructor | Yes | Methods copied per instance | Works in very old browsers |
| `#private` fields | Yes, enforced by the language | Methods shared on the prototype | Needs `class`; not visible to subclasses |

## Property descriptors and `Object.defineProperty`

A property is more than a key and a value. Every property has hidden **attributes** that decide whether it can be changed, listed or deleted. You read them with `Object.getOwnPropertyDescriptor` and set them with `Object.defineProperty`.

| Attribute | Meaning | Default for `obj.x = 1` or a literal | Default for `defineProperty` |
| --- | --- | --- | --- |
| `value` | The stored value (data property) | the value | `undefined` |
| `writable` | Can the value be changed? | `true` | **`false`** |
| `enumerable` | Is it listed by `Object.keys`, `for...in`, spread, `JSON.stringify`? | `true` | **`false`** |
| `configurable` | Can it be deleted, or its attributes changed? | `true` | **`false`** |
| `get` / `set` | Functions run on read / write (accessor property, instead of `value`/`writable`) | | `undefined` |

```js
"use strict";
const user = { name: "Asha" };
console.log(Object.getOwnPropertyDescriptor(user, "name"));
// → { value: 'Asha', writable: true, enumerable: true, configurable: true }

Object.defineProperty(user, "id", { value: 42 });   // every flag defaults to false
console.log(user.id, Object.keys(user), JSON.stringify(user)); // → 42 [ 'name' ] {"name":"Asha"}
user.id = 7;      // TypeError: Cannot assign to read only property 'id'
delete user.id;   // TypeError: Cannot delete property 'id'
```

Where descriptors matter in practice:

- **Built-ins are non-enumerable.** That is why `for...in` over an array lists only indexes, not `push` or `length`.
- **Hidden metadata.** Libraries define non-enumerable properties so they don't show up in `Object.keys`, spread or JSON.
- **`Object.getOwnPropertyNames`** lists non-enumerable string keys too; **`Reflect.ownKeys`** lists everything, including symbols.
- **Spread and `Object.assign` copy values, not descriptors.** A getter is *called* and its current value copied. To clone an object with its getters and flags, use `Object.defineProperties({}, Object.getOwnPropertyDescriptors(src))`.
- `configurable: false` is permanent: you can't delete the property or turn it back into a configurable one (`TypeError: Cannot redefine property`).

## Getters and setters

An **accessor property** looks like a normal property from outside but runs a function on read (`get`) or write (`set`). Use it for computed values and for validation.

```js
const temp = {
  _celsius: 25,
  get fahrenheit() { return this._celsius * 9 / 5 + 32; },
  set fahrenheit(f) { this._celsius = (f - 32) * 5 / 9; },
};
console.log(temp.fahrenheit); // → 77   (no parentheses: it reads like a property)
temp.fahrenheit = 212;
console.log(temp._celsius);   // → 100
```

In classes, accessors pair naturally with private fields:

```js
class Person {
  #name = "";
  get name() { return this.#name; }
  set name(value) {
    if (typeof value !== "string" || !value.trim()) throw new TypeError("name must be a non-empty string");
    this.#name = value.trim();
  }
}
const p = new Person();
p.name = "  Ravi ";
console.log(p.name, Object.keys(p)); // → Ravi []   (accessors live on the prototype)
p.name = "";                         // TypeError: name must be a non-empty string
```

Things to know:

- A getter without a setter makes a **read-only** property: writes are ignored in sloppy mode and throw in strict mode (the `BankAccount` example above).
- Class accessors live on the **prototype**, so `Object.keys(p)` and `JSON.stringify(p)` don't include them. Add a `toJSON()` method if the object must serialise its computed values.
- A setter that assigns to its own name calls itself forever: `set name(v) { this.name = v; }` throws `RangeError: Maximum call stack size exceeded`. Store the value in a different field (`#name` or `_name`).
- Keep getters cheap and free of side effects. Code reads `obj.total` like a field and may call it in a loop; an expensive or mutating getter surprises the caller. For an expensive value computed once, a "lazy getter" can replace itself with a data property on first access using `Object.defineProperty`.

## Freezing, sealing and preventing extensions

Three built-in levels of locking an object, from weakest to strongest:

| | Add properties | Delete properties | Change values | Check with |
| --- | --- | --- | --- | --- |
| `Object.preventExtensions(obj)` | No | Yes | Yes | `Object.isExtensible` |
| `Object.seal(obj)` | No | No | Yes | `Object.isSealed` |
| `Object.freeze(obj)` | No | No | No | `Object.isFrozen` |

`seal` sets every property to `configurable: false`; `freeze` also sets `writable: false`. All three return the same object.

What a blocked write does depends on the mode:

| Action on a frozen object | Non-strict mode (the demo) | Strict mode (`"use strict"`, ES modules, classes) |
| --- | --- | --- |
| Change a property | Silently ignored | `TypeError: Cannot assign to read only property` |
| Add a property | Silently ignored | `TypeError: Cannot add property ..., object is not extensible` |
| Delete a property | Silently ignored (returns `false`) | `TypeError: Cannot delete property` |
| Read a property | Works | Works |

Array methods are the exception: `Object.freeze([1]).push(2)` throws a `TypeError` even in sloppy mode.

### Freezing is shallow

`freeze`, `seal` and `preventExtensions` affect only the object's own top-level properties. Nested objects, and the internal data of built-ins such as `Map`, `Set` and `Date`, stay mutable:

```js
const Config = Object.freeze({ api: { url: "/v1" }, cache: new Map() });
Config.api.url = "/v2";         // works: the inner object is not frozen
Config.cache.set("k", 1);       // works: Map entries are internal slots, not properties
console.log(Config.api.url, Config.cache.size); // → /v2 1
```

For real immutability, freeze recursively (see Q12) or use immutable data patterns. Also note that copies are not frozen: `structuredClone(frozen)` and `{ ...frozen }` return ordinary mutable objects.

### `const` vs `Object.freeze()`

| | `const obj = {...}` | `Object.freeze(obj)` |
| --- | --- | --- |
| Stops reassigning the variable | Yes | No |
| Stops changing / adding / deleting properties | No | Yes (top level only) |
| Applies to | The variable binding | The object itself |

For a constant object you want both: `const Days = Object.freeze({...})`.

## Enums in JavaScript

An **enum** (enumeration) represents a **fixed set of named values**, for example the days of the week, order statuses or user roles. Enums let developers define a list of named constants that can be used throughout the codebase, which increases readability and maintainability and prevents errors such as typos in "magic strings" or unexplained numbers.

```js
// Without an enum: what does 3 mean? Is it "shipped" or "Shipped"?
if (order.status === 3) { /* ... */ }

// With an enum: self-explanatory, and defined in one place
if (order.status === OrderStatus.SHIPPED) { /* ... */ }
```

However, enums are **not native to JavaScript** (TypeScript has an `enum` keyword; plain JavaScript does not), so they are usually implemented using objects or frozen arrays.

### Creating an enum with `Object.freeze()`

Define a plain object with constant property values, then freeze it so that no property can be added, modified or deleted. From [enums-and-call.js](enums-and-call.js):

```js
console.log("Enum using object.freeze() method");
const DaysOfWeek = Object.freeze({
  Sunday: 1,
  Monday: 2,
  Tuesday: 3,
  Wednesday: 4,
  Thrusday: 5,     // (spelled this way in the demo; it is just a key name)
  Friday: 6,
  Saturday: 7,
});

console.log(DaysOfWeek.Thrusday); // → 5

// try to modify
DaysOfWeek.Thrusday = 10;
console.log(DaysOfWeek.Thrusday); // → 5  (the change was ignored)

// try to add
DaysOfWeek.None = 16;
console.log(DaysOfWeek.None);     // → undefined (the property was not added)
```

The demo is a non-strict CommonJS script, so the writes fail silently; in an ES module or with `"use strict"` they would throw (see the table above).

> **Note:** The demo's key is misspelled `Thrusday` (should be `Thursday`). It works because the same spelling is used everywhere, but this is exactly the kind of typo an enum should protect you from: `DaysOfWeek.Thursday` would silently give `undefined`. Q13 shows how a `Proxy` makes such typos throw.

### Better enum patterns

**String values** are easier to debug and to store in a database or JSON than numbers:

```js
const OrderStatus = Object.freeze({
  PENDING: "pending",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
});
console.log(Object.values(OrderStatus).includes("shipped")); // → true (validate input)
console.log(Object.keys(OrderStatus));  // → [ 'PENDING', 'SHIPPED', 'DELIVERED' ]
```

**Symbol values** guarantee that no other value can accidentally be equal to an enum member (two symbols are never equal, even with the same description):

```js
const Color = Object.freeze({
  RED: Symbol("red"),
  GREEN: Symbol("green"),
});
console.log(Color.RED === Color.RED);   // → true
console.log(Color.RED.description);     // → red
```

The trade-off: symbols cannot be serialised to JSON, so use strings for anything sent to a server.

## Proxy and Reflect

A **`Proxy`** wraps a target object and lets you intercept the basic operations on it: reading (`get`), writing (`set`), `in` (`has`), `delete` (`deleteProperty`), listing keys (`ownKeys`), calling (`apply`) and `new` (`construct`). Each interceptor is a **trap** in a handler object. **`Reflect`** has one method per trap that performs the *default* behaviour, so a trap can add its logic and then forward the operation unchanged.

### Validation

```js
const validator = {
  set(target, key, value, receiver) {
    if (key === "age" && (!Number.isInteger(value) || value < 0)) {
      throw new TypeError(`Invalid age: ${value}`);
    }
    return Reflect.set(target, key, value, receiver); // do the normal assignment
  },
};
const person = new Proxy({}, validator);
person.age = 30;
console.log(person.age); // → 30
person.age = -5;         // TypeError: Invalid age: -5
```

Why `Reflect` instead of `target[key] = value`:

- It passes the **receiver** along, so getters and setters inherited through the prototype chain see the right `this`.
- It returns `true`/`false` instead of throwing (`Reflect.defineProperty` on a frozen object returns `false`, `Object.defineProperty` throws), which is exactly what a `set` or `defineProperty` trap must return.
- `Reflect.ownKeys`, `Reflect.has` and friends are the function versions of operators (`in`, `delete`), which is handy in generic code.

### Real-world example: Vue 3 reactivity

Vue 3's `reactive()` returns a Proxy. The `get` trap records which component or effect read which property (**track**); the `set` trap re-runs everything that depended on it (**trigger**). The core idea fits in a few lines:

```js
let activeEffect = null;
const deps = new WeakMap(); // target → Map(key → Set(effects))

function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (activeEffect) {
        if (!deps.has(target)) deps.set(target, new Map());
        const byKey = deps.get(target);
        if (!byKey.has(key)) byKey.set(key, new Set());
        byKey.get(key).add(activeEffect);            // track
      }
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const ok = Reflect.set(target, key, value, receiver);
      deps.get(target)?.get(key)?.forEach((fn) => fn()); // trigger
      return ok;
    },
  });
}
function effect(fn) { activeEffect = fn; fn(); activeEffect = null; }

const cart = reactive({ qty: 1, price: 250 });
effect(() => console.log(`Total: ${cart.qty * cart.price}`)); // → Total: 250
cart.qty = 3;                                                  // → Total: 750
```

Vue 2 did the same with `Object.defineProperty` getters and setters, which could only watch properties that already existed. Adding a new property or assigning `arr[i] = x` was invisible, hence `Vue.set`. A Proxy sees every key, including new ones, deletes and array indexes, which is why Vue 3 switched. MobX and Immer's drafts are also Proxy-based.

### Limits of Proxy

| Limitation | Example |
| --- | --- |
| Identity: the proxy is a different object | `new Proxy(raw, {}) === raw` → `false`; mixing raw and proxied objects breaks `===`, `Set` and `Map` lookups |
| Private fields don't pass through | A method using `this.#n` called on a proxy throws `TypeError: Cannot read private member #n` |
| Built-ins with internal slots | `new Proxy(new Map(), {}).set("a", 1)` throws `incompatible receiver`; `Map`, `Set` and `Date` need special handling |
| Invariants | A trap can't report a non-configurable, non-writable property with a different value; the engine throws |
| Cost | Every intercepted operation runs a function: fine for state objects, not for hot inner loops |
| No polyfill | Proxy can't be emulated in ES5, which is why Vue 3 dropped IE11 |

## Common Mistakes

- **Logging a method that returns nothing:** `console.log(person.bio())` prints `undefined` after the bio.
- **Using dot notation with a variable** (`obj.key` when you mean `obj[key]`).
- **Forgetting `new`:** the constructor returns `undefined` and, in sloppy mode, writes to global variables. Arrow functions can't be constructors at all (`new arrowFn()` throws `TypeError`).
- **Expecting `Constructor.prop = x` to reach instances:** put shared things on `Constructor.prototype`.
- **Methods defined inside the constructor:** every instance gets its own copy. Prefer the prototype (or class methods).
- **Treating `_name` as private:** it is only a naming convention.
- **Forgetting that `defineProperty` defaults to `false`** for `writable`, `enumerable` and `configurable`, so the new property is read-only and invisible to `Object.keys` and JSON.
- **A setter that assigns to its own property name**, which recurses until the stack overflows.
- **Assuming `Object.freeze()` is deep.** Nested objects and `Map`/`Set`/`Date` contents can still change; write a recursive deep-freeze if you need it.
- **Relying on silent failure.** In non-strict code, writes to a frozen object are ignored without any error, which hides bugs. Use strict mode (ES modules and classes are strict automatically).
- **Thinking `const` freezes an object.** It only prevents reassignment of the variable.
- **Typos in enum keys** (`DaysOfWeek.Thursday` vs `Thrusday`) give `undefined` with no error.
- **Comparing a proxy with its raw object**, or using a Proxy around classes with `#private` fields or around `Map`/`Set` without handling them.

## Key Takeaways

- JavaScript is multi-paradigm; its OOP is **prototype-based**, and `class` is built on top of prototypes.
- Objects hold properties and methods; use bracket notation for dynamic keys, keys with spaces and symbols.
- `new` creates an object, links it to `Constructor.prototype`, runs the constructor with `this` set to it, and returns it. Put shared methods on the prototype, not inside the constructor.
- Encapsulate with closures or `#private` fields plus getters/setters; `_underscore` names are not private.
- Every property has a descriptor (`writable`, `enumerable`, `configurable`, or `get`/`set`); `defineProperty` defaults all flags to `false`.
- `preventExtensions` < `seal` < `freeze`, all shallow; failed writes throw only in strict mode.
- JavaScript has no `enum` keyword; use `const Name = Object.freeze({ ... })` with string values.
- `Proxy` intercepts object operations and `Reflect` performs the default ones; it powers Vue 3 reactivity, but proxies change identity and don't work transparently with private fields or `Map`/`Set`.

## Interview Questions

### Junior (0–1 year)

**Q1. What is OOP and what are its four pillars?**
OOP is a paradigm that bundles data (properties) and behaviour (methods) into objects. The four pillars are encapsulation (hide internal state), abstraction (expose only what is needed), inheritance (reuse behaviour of another type) and polymorphism (one interface, different implementations). In JavaScript they are built on objects and prototypes, with `class` as convenient syntax.

**Q2. Is JavaScript an object-oriented language?**
Yes, but it is prototype-based rather than class-based, and it is multi-paradigm (it also supports functional and procedural styles). Objects inherit directly from other objects through the prototype chain. The `class` keyword is syntax over constructor functions and prototypes, not a separate class system.

**Q3. When must you use bracket notation instead of dot notation?**
When the property name is stored in a variable (`obj[key]`), when it is not a valid identifier (contains spaces or hyphens, or starts with a digit, as in `freightTrain["refrigerator car"]`), when it is computed at runtime, and when the key is a Symbol. `obj.key` always looks for a property literally named `"key"`. Otherwise dot notation is preferred for readability.

**Q4. What does the `new` keyword do?**
It creates an empty object, sets its prototype to `Constructor.prototype`, runs the constructor with `this` bound to that object, and returns the object, unless the constructor returns another object of its own.

**Q5. What is a constructor function, and how is it different from a normal function?**
Technically there is no difference: any regular (non-arrow) function can be called with `new`. By convention a constructor's name is capitalised, it sets properties on `this`, and it is meant to be called only with `new`. Called without `new`, it runs as a plain function and `this` is not a new object.

**Q6. Does JavaScript have enums? How do you create one?**
No, there is no `enum` keyword in JavaScript (TypeScript has one). The common pattern is a frozen object: `const Status = Object.freeze({ ACTIVE: "active", BLOCKED: "blocked" })`. Freezing prevents the values from being changed, added or deleted, and `const` prevents the variable from being reassigned.

**Q7. What does `Object.freeze()` do?**
It makes an object's existing properties read-only and stops new properties from being added or existing ones deleted. In non-strict mode those attempts fail silently; in strict mode they throw a TypeError. It is shallow: nested objects inside a frozen object can still be modified.

**Q8. What is the difference between `const` and `Object.freeze()`?**
`const` protects the variable: you cannot assign a new value to it, but you can still change the object's properties. `Object.freeze()` protects the object: its properties cannot change, but if it is stored in a `let` variable, the variable can still point to another object. Use both together for true constants.

### Mid-level (2–4 years)

**Q9. Why put methods on the prototype instead of inside the constructor?**
Methods defined with `this.method = function () {}` inside the constructor are created again for every instance, which costs memory and makes `a.method === b.method` false. Methods on `Constructor.prototype` exist once and are found by every instance through the prototype chain. Prototype methods can also be changed or added later and every instance sees the change. Class methods are placed on the prototype automatically.

**Q10. How do you implement private state in JavaScript? Compare the options.**
Use closures (local variables inside a constructor or factory function, read by inner functions) or `#private` class fields. Closures work everywhere but need per-instance method copies. `#private` fields are enforced by the language, keep methods on the prototype, and support `#field in obj` checks, but they are visible only inside the class that declares them, so subclasses cannot read them. `_name` is only a convention and gives no privacy.

**Q11. What happens when a constructor function has a `return` statement?**
If it returns an object (including an array or a function), `new` gives you that object and the `this` object is thrown away. If it returns a primitive, or nothing, the return value is ignored and `new` returns `this`. That is why constructors normally do not return anything.

**Q12. `Object.freeze` is shallow. How would you deep-freeze an object?**

```js
function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

const Config = deepFreeze({ api: { url: "/v1" } });
Config.api.url = "/v2";
console.log(Config.api.url); // → /v1
```

Recursively freeze every nested object, then freeze the object itself. The `isFrozen` check skips objects that are already frozen and prevents infinite recursion on simple circular references. It still can't protect the contents of a `Map`, `Set` or `Date`, which live in internal slots rather than properties.

**Q13. Your frozen enum doesn't catch typos: `Status.ACTVE` just returns `undefined`. How could you make invalid keys fail loudly?**
Wrap the frozen object in a `Proxy` whose `get` trap throws for unknown keys:

```js
const Status = new Proxy(Object.freeze({ ACTIVE: "active" }), {
  get(target, key) {
    if (typeof key === "symbol" || key in target || key === "toJSON" || key === "then") return target[key];
    throw new Error(`Unknown enum key: ${key}`);
  },
});
// Status.ACTVE; // Error: Unknown enum key: ACTVE
```

The exceptions matter: `JSON.stringify` reads `toJSON`, `await` and `Promise.resolve` read `then`, and template literals read `Symbol.toPrimitive`, so a naive "throw on anything unknown" trap breaks serialisation and logging. Alternatives are TypeScript (string literal union types checked at compile time) and lint rules; in large codebases TypeScript is usually the better answer because the error appears in the editor, not at runtime.

**Q14. When would you choose Symbols over strings as enum values?**
Symbols guarantee uniqueness: no string or other symbol can accidentally equal `Color.RED`, so two enums can never collide, and code cannot bypass the enum with a raw literal. Strings are better when values must be stored, logged, compared with API data or serialised with `JSON.stringify`, which drops symbol values. Most application code therefore uses string values, and Symbols are used for internal, in-memory states.

**Q15. What does `Object.defineProperty(obj, "id", { value: 42 })` create, and how does it differ from `obj.id = 42`?**
A property whose `writable`, `enumerable` and `configurable` flags are all `false`, because `defineProperty` defaults every omitted flag to `false`. So `obj.id` reads 42, but assigning to it is ignored (TypeError in strict mode), it can't be deleted or redefined, and it is skipped by `Object.keys`, `for...in`, spread and `JSON.stringify`. `obj.id = 42` creates a normal property with all three flags `true`. Always spell out the flags you want when using `defineProperty`.

**Q16. What is wrong with this setter, and how do you fix it?**

```js
const user = {
  set name(value) { this.name = value.trim(); },
};
user.name = " Asha ";
```

Assigning `this.name` inside the `name` setter calls the setter again, forever, until `RangeError: Maximum call stack size exceeded`. Store the value under a different key: a private field in a class (`#name`), a `_name` property, or a closure variable, and add a matching getter that returns it. Without a getter, reading `user.name` would also return `undefined`, because an accessor property with only a setter has nothing to read.

### Senior (5+ years)

**Q17. Would you `Object.freeze` application state and configuration in a large codebase? What are the trade-offs?**
Freezing turns accidental mutation into an immediate `TypeError` (in strict code, which ES modules and classes always are), which is valuable for shared config and for state that frameworks compare by reference. The costs: freezing is shallow, so you need a deep freeze that walks the whole tree on every new state (O(n)); it does nothing for `Map`, `Set` or `Date` contents; and frozen objects can't be patched by code that legitimately builds them in steps.

Recommendation: freeze configuration once at startup (deep), and for state let the tooling do it, as Immer and Redux Toolkit do, mainly in development. Pair it with compile-time protection (`readonly` and `as const` in TypeScript), which costs nothing at runtime and catches the mistake in the editor. Don't hand-freeze objects in hot paths.

**Q18. Your team proposes a Proxy-based reactive store, similar to Vue 3, for a shared component library. What problems would you plan for?**
Identity first: a proxy is a different object from its target, so a component that compares a raw object with a proxied one, or stores both in a `Set`, sees two objects. Vue solves this with `toRaw()` and by caching one proxy per target in a `WeakMap`; your store needs the same. Second, transparency gaps: classes with `#private` fields throw when their methods run with the proxy as `this`, and `Map`, `Set` and `Date` need instrumented wrapper methods because their data lives in internal slots. Third, cost and debugging: every property read runs a trap, so deep reactive wrapping of large lists is slow (Vue offers `shallowReactive` and `markRaw`), and stack traces and devtools show proxies instead of plain objects.

Recommendation: use an existing, battle-tested implementation (Vue's `@vue/reactivity`, MobX, or a signals library) rather than writing your own; expose plain, serialisable data at the library's API boundary; and document that consumers must not put class instances with private fields or huge collections into reactive state.

**Q19. How would you design enums that cross the API boundary between a JavaScript front end and several back-end services?**
Use **string** values that are the wire format itself (`"shipped"`, not `3`), so logs, JSON and database rows are readable and the front end needs no mapping table. In TypeScript prefer an `as const` object plus a derived union type (`type Status = typeof Status[keyof typeof Status]`) over the `enum` keyword: it is plain JavaScript at runtime, works with type-stripping tools that don't support `enum` (Node's built-in TypeScript stripping, `erasableSyntaxOnly`), and gives the same autocomplete and exhaustiveness checks.

Plan for evolution: a back end will eventually send a value the front end doesn't know yet. Validate at the boundary and map unknown values to an explicit fallback (`"unknown"`) instead of throwing or rendering nothing, and use `switch` statements with an exhaustive `never` check so adding a member forces every consumer to handle it. Recommendation: string literals, generated from one shared schema (OpenAPI or JSON Schema), with tolerant parsing at the edge.

**Q20. A hot loop gets several times slower after a teammate replaced `obj.temp = undefined` with `delete obj.temp`. Why, and what guideline would you give?**
Engines like V8 give objects created the same way a shared hidden class (shape), which lets property reads become fast fixed-offset loads with inline caches. Deleting a property that isn't the last one added usually drops the object into slow "dictionary mode", a hash-table representation, and code that sees many such objects loses its fast inline caches. Setting the property to `undefined` keeps the shape.

Guideline: create objects with all their properties up front, in the same order (constructors and classes do this naturally); don't `delete` properties on hot objects; and when keys really are dynamic (caches, lookups, counters), use a `Map`, which is designed for frequent adds and deletes. Measure with a profiler before rewriting, but make "no `delete` on hot objects" a code-review rule.

> **Note:** Related questions answered elsewhere: [this, call(), apply() and bind()](../10-this-call-apply-bind/notes.md#interview-questions) (what `this` refers to, losing `this` in `setTimeout`, `call`/`apply`/`bind` and re-binding, `this` vs `event.target` vs `event.currentTarget`, arrow functions and `call()`); [How JavaScript runs](../01-how-js-runs/notes.md) (strict mode).

## References

- [JavaScript Constructor Function (javascripttutorial.net)](https://www.javascripttutorial.net/javascript-constructor-function/): read it for more on return values and more
- [MDN: Working with objects](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Working_with_objects)
- [MDN: new operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new)
- [MDN: Property accessors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors)
- [MDN: Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties)
- [MDN: Object.defineProperty()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)
- [MDN: getter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get)
- [MDN: Object.freeze()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze)
- [MDN: Object.seal()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/seal)
- [MDN: Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
- [MDN: Reflect](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect)
- [Vue.js: Reactivity in Depth](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [V8: Fast properties in V8](https://v8.dev/blog/fast-properties)
