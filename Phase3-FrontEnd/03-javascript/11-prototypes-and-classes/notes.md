# Prototypes, Prototype Inheritance and Classes

> JavaScript · Topic 11 · Demo: [index.html](index.html) · [prototypes.js](prototypes.js) · Open index.html in a browser and check the devtools console

Every JavaScript object has a hidden link to another object, its **prototype**, and that link is how objects share methods and inherit behaviour. ES6 `class` syntax is a cleaner way to write the same prototype wiring, so understanding prototypes explains how classes, `extends` and built-in methods like `array.map()` really work. This note builds on [Objects and enums](../09-objects-and-enums/notes.md) (objects, constructor functions, `new`, encapsulation) and [`this`, call, apply and bind](../10-this-call-apply-bind/notes.md).

> **Note (demo bug):** `prototypes.js` does not run as written. It declares both `function Person` and `class Person` in the same scope, which is a parse-time `SyntaxError: Identifier 'Person' has already been declared`, so the browser runs **none** of the file. Even after renaming one of them, `get_value()` throws `ReferenceError: myField is not defined` (it should be `this.myField`). Both fixes are shown below. `index.html` also has a stray `s` after the closing `</script>` tag, which shows up as text on the page.

## Prototype in JavaScript

JavaScript is a prototype-based language. Whenever you create a regular function, the JavaScript engine adds a `prototype` property to it. That property is an object (the **prototype object**) where you can attach properties and methods. Every object created from that function with `new` inherits them.

In short: **prototypes let properties and methods be shared among all instances of a function or object.**

```js
function Car() {}
console.log(typeof Car.prototype);           // → "object"
console.log(Car.prototype.constructor === Car); // → true (it points back to the function)
```

> **Note:** Not every function gets a `prototype` property. Arrow functions, method shorthand (`{ m() {} }`) and `async` functions have none, which is one reason they cannot be used with `new`.

### How do strings and arrays "know" their methods?

Have you ever wondered how a string knows it can call `.toUpperCase()`, or an array knows it can `.sort()`? We never defined these methods ourselves.

The answer is **prototype inheritance**. In JavaScript an object can inherit properties from another object; the object it inherits from is called its **prototype**. Arrays inherit from `Array.prototype`, strings from `String.prototype`, and those in turn inherit from `Object.prototype`.

```js
const arr = [3, 1, 2];
console.log(Object.getPrototypeOf(arr) === Array.prototype);              // → true
console.log(Object.getPrototypeOf(Array.prototype) === Object.prototype); // → true
console.log(Object.getPrototypeOf(Object.prototype));                     // → null (end of chain)
console.log(arr.hasOwnProperty("sort")); // → false: sort lives on Array.prototype, not on arr
console.log("hi".toUpperCase());         // → "HI": the primitive is wrapped in a String object for the call
```

### The prototype chain (how property lookup works)

When you read a property, JavaScript does not only look in the object itself. It searches:

1. the object itself,
2. then its prototype,
3. then the prototype's prototype, and so on,

until it finds a property with that name or reaches the end of the chain (`null`). Only if the property is not found anywhere in the chain does JavaScript return `undefined`.

```text
arr  ──►  Array.prototype  ──►  Object.prototype  ──►  null
(own: 0, 1, 2, length)   (map, sort, push...)   (toString, hasOwnProperty...)
```

```js
const animal = { eats: true };
const rabbit = Object.create(animal);   // rabbit's prototype is animal
rabbit.jumps = true;

console.log(rabbit.jumps); // → true      (own property)
console.log(rabbit.eats);  // → true      (found on the prototype)
console.log(rabbit.flies); // → undefined (not found anywhere in the chain)

rabbit.eats = false;       // WRITING creates an own property that shadows the prototype's
console.log(rabbit.eats, animal.eats); // → false true
```

> **Note:** Reading walks the chain; **writing** (`obj.x = ...`) always creates or updates an own property on the object itself, unless the prototype defines a setter for `x`.

## `prototype` vs `__proto__`

These two names confuse almost everyone. They point to the same object in the common case, but they live on different things.

| | `Fn.prototype` | `obj.__proto__` |
|---|---|---|
| Exists on | Functions (constructors and classes) | Every object |
| What it is | The object that will become the prototype of instances created with `new Fn()` | The object's own prototype link (its `[[Prototype]]`) |
| Set when | The function is created | The object is created (`new`, `Object.create`, literal) |
| Standard way to read it | `Fn.prototype` | `Object.getPrototypeOf(obj)` |
| Status | Normal property | Legacy accessor; avoid in real code (the `__proto__:` key inside an object literal is fine) |

```js
function Car() {}
const c = new Car();

console.log(c.__proto__ === Car.prototype);              // → true
console.log(Object.getPrototypeOf(c) === Car.prototype); // → true (preferred)
console.log(Car.__proto__ === Function.prototype);       // → true: Car is itself an object, made by Function
console.log(c.prototype);                                // → undefined: plain objects have no prototype property
```

Prefer `Object.getPrototypeOf(obj)`, `Object.setPrototypeOf(obj, proto)` and `Object.create(proto)` over reading or writing `__proto__`.

## Object Prototype Inheritance (the `human` / `Man` demo)

Objects can inherit directly from other objects without any constructor:

```js
let human = {
  speak: () => {
    console.log("Hey!!!");
  },
  Food_type: ["Veg", "Non-veg"],
};

let Man = {
  Name: "Aman",
  __proto__: human,   // inherit the properties of human
};
// Same effect after creation: Man.__proto__ = human;  (better: Object.setPrototypeOf(Man, human))

console.log(Man);            // → { Name: "Aman" }  (inherited properties are not own properties)
console.log(Man.Food_type);  // → ["Veg", "Non-veg"] (found on human)
Man.speak();                 // → Hey!!!
console.log(Man.speak());    // → Hey!!! then undefined (speak returns nothing)
```

The cleaner, standard way to do the same thing is `Object.create`:

```js
const man = Object.create(human); // new object whose prototype is human
man.Name = "Aman";
```

> **Note:** Arrays and objects on a prototype are **shared** by every object that inherits from it. `Man.Food_type.push("Vegan")` changes `human.Food_type`, so every other object inheriting from `human` sees `"Vegan"` too. Keep per-object data on the object itself.

`Object.create(null)` makes an object with **no** prototype at all: no `toString`, no `hasOwnProperty`. It is handy as a pure dictionary where keys like `"constructor"` cannot clash with inherited ones.

## Classes in JavaScript

Classes define **blueprints** for creating objects with similar properties and methods. They give a more structured approach to object-oriented programming.

Classes are similar to functions: you use the `class` keyword instead of `function`, and `typeof` a class is still `"function"`. The **constructor** method runs when you call `new` and is used to initialise the object. The class name is user-defined (by convention, PascalCase).

### Anatomy of a class

```js
class Automobile {
  wheels = 4;              // public field: own property of every instance
  #engineNo;               // private field: only code inside the class can read it
  static count = 0;        // static field: lives on the class itself

  constructor(name, engineNo) {
    this.name = name;      // no need to declare `name` as a field first
    this.#engineNo = engineNo;
    Automobile.count++;
  }

  describe() {             // method: stored once on Automobile.prototype
    return `${this.name} has ${this.wheels} wheels`;
  }

  get engine() {           // getter: read like a property, car.engine
    return `****${this.#engineNo.slice(-4)}`;
  }

  static compare(a, b) {   // static method: Automobile.compare(x, y)
    return a.wheels - b.wheels;
  }
}

const car = new Automobile("Nexon", "EN12345678");
console.log(car.describe());   // → "Nexon has 4 wheels"
console.log(car.engine);       // → "****5678"
console.log(Automobile.count); // → 1
console.log(Object.keys(car)); // → ["wheels", "name"] (methods and #private fields are not listed)
```

### Fixing the demo's `Automobile` class

The demo reads a field without `this`:

```js
class Automobile {
  myField = "foo";
  constructor(name) { this.name = name; }
  get_value() { return myField; }   // looks for a VARIABLE named myField
}
new Automobile().get_value();       // ReferenceError: myField is not defined
```

Fields are properties of the instance, so they must be read through `this`:

```js
class Automobile {
  myField = "foo";
  constructor(name) {
    this.name = name;
  }
  getValue() {
    return this.myField;
  }
}

const obj = new Automobile("Car"); // the demo called new Automobile() with no name, so name was undefined
console.log(obj.getValue());       // → "foo"
```

### Classes are syntactic sugar

A class and a constructor function with prototype methods produce the same structure:

```js
class PersonClass {
  constructor(name) { this.name = name; }
  greet() { return `Hi, I'm ${this.name}`; }
}

function PersonFn(name) { this.name = name; }
PersonFn.prototype.greet = function () { return `Hi, I'm ${this.name}`; };

console.log(typeof PersonClass);                                // → "function"
console.log(new PersonClass("Aman").greet());                   // → "Hi, I'm Aman"
console.log(new PersonFn("Aman").greet());                      // → "Hi, I'm Aman"
console.log(Object.hasOwn(PersonClass.prototype, "greet"));     // → true
```

### Hoisting: classes are in the temporal dead zone

The original notes said "unlike functions, classes are not hoisted". More precisely: class declarations **are** hoisted, but like `let` and `const` they stay uninitialised (in the **temporal dead zone**) until the line that declares them runs. Using one earlier throws:

```js
const p = new Person();   // ReferenceError: Cannot access 'Person' before initialization
class Person {}

const f = new FnPerson(); // works: function declarations are fully hoisted
function FnPerson() {}
```

### Classes vs constructor functions

| | Constructor function | `class` |
|---|---|---|
| Hoisting | Fully hoisted, usable before the declaration | Hoisted but in the TDZ; use after declaration |
| Called without `new` | Runs as a normal function (`this` = global / `undefined`) | `TypeError: Class constructor ... cannot be invoked without 'new'` |
| Strict mode | Only if you opt in | Always strict |
| Where methods go | You assign them to `Fn.prototype` yourself | Placed on the prototype automatically |
| Methods in `for...in` | Enumerable (show up) | Non-enumerable (hidden) |
| Inheritance | `Parent.call(this)` + `Object.create(Parent.prototype)` | `extends` + `super` |
| Private state | Closures | `#private` fields and methods |
| Static members | `Fn.helper = ...` | `static helper() {}` |

## Inheritance with `extends` and `super`

`extends` sets up the prototype chain between two classes. `super(...)` calls the parent constructor, and `super.method()` calls the parent's version of a method.

```js
class Vehicle {
  constructor(name) {
    this.name = name;
  }
  move() {
    return `${this.name} is moving`;
  }
}

class Bike extends Vehicle {
  constructor(name, gears) {
    super(name);           // must run before `this` is used
    this.gears = gears;
  }
  move() {                 // override the parent method
    return `${super.move()} on two wheels`;
  }
}

const b = new Bike("Pulsar", 5);
console.log(b.move());                // → "Pulsar is moving on two wheels"
console.log(b instanceof Vehicle);    // → true
console.log(Object.getPrototypeOf(Bike.prototype) === Vehicle.prototype); // → true
```

The chain for `b` is: `b → Bike.prototype → Vehicle.prototype → Object.prototype → null`.

> **Note:** In a derived class, touching `this` before `super()` throws `ReferenceError: Must call super constructor in derived class before accessing 'this'`. If a subclass has no constructor, JavaScript adds one that passes all arguments to `super`.

### The same inheritance without classes

This is what `extends` does for you (and what older code and interview questions use):

```js
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};

function Dog(name) {
  Animal.call(this, name);                         // like super(name)
}
Dog.prototype = Object.create(Animal.prototype);   // link the prototypes
Dog.prototype.constructor = Dog;                   // repair the constructor reference
Dog.prototype.speak = function () {                // override
  return `${this.name} barks`;
};

console.log(new Dog("Tommy").speak());           // → "Tommy barks"
console.log(new Dog("Tommy") instanceof Animal); // → true
```

## Polymorphism

Polymorphism means "many forms": different classes provide the same method name, and calling code does not need to know which class it has.

```js
class Shape {
  area() { return 0; }
}
class Circle extends Shape {
  constructor(r) { super(); this.r = r; }
  area() { return +(Math.PI * this.r ** 2).toFixed(2); }
}
class Square extends Shape {
  constructor(s) { super(); this.s = s; }
  area() { return this.s ** 2; }
}

for (const shape of [new Circle(1), new Square(2)]) {
  console.log(shape.constructor.name, shape.area());
}
// → Circle 3.14
// → Square 4
```

JavaScript also has **duck typing**: any object with an `area()` method works in that loop, whether or not it extends `Shape`.

## Abstraction

Abstraction means exposing *what* an object does and hiding *how*. JavaScript has no `abstract` keyword, but you can block direct instantiation with `new.target` and force subclasses to implement methods:

```js
class AbstractShape {
  constructor() {
    if (new.target === AbstractShape) {
      throw new TypeError("AbstractShape is abstract; extend it instead");
    }
  }
  area() {
    throw new Error("area() must be implemented by the subclass");
  }
}

class Rect extends AbstractShape {
  constructor(w, h) { super(); this.w = w; this.h = h; }
  area() { return this.w * this.h; }
}

// new AbstractShape();          // TypeError: AbstractShape is abstract; extend it instead
console.log(new Rect(2, 3).area()); // → 6
```

Combine this with `#private` fields and methods (for example a `#validate()` helper) to hide implementation details completely.

## Encapsulation Demo (fixed)

The encapsulation examples in `prototypes.js` (closure version and `#private` version) are explained in [Objects and enums: Encapsulation](../09-objects-and-enums/notes.md#encapsulation). To make the file run, give the two `Person` definitions different names:

```js
function PersonClosure(firstName, lastName) { /* closure version */ }
class PersonPrivate { /* #private fields version */ }
```

## Common Mistakes

- **Reading a field without `this`:** `return myField` looks for a variable; use `this.myField`.
- **Two declarations with the same name:** `function Person` and `class Person` in one scope is a `SyntaxError`, and the whole script fails to run.
- **Using a class before its declaration:** classes are in the temporal dead zone until declared.
- **Calling a class without `new`:** always a `TypeError`.
- **Using `this` before `super()`** in a derived constructor: `ReferenceError`.
- **Mutable data on a prototype:** arrays and objects on a prototype are shared by every instance.
- **Replacing `Fn.prototype = { ... }`** wipes out `constructor`; set `Fn.prototype.constructor = Fn` again, or add methods one by one.
- **Using `__proto__` in application code:** use `Object.create`, `Object.getPrototypeOf` and `Object.setPrototypeOf`.
- **Adding methods to built-in prototypes** (`Array.prototype.myHelper = ...`): it can clash with libraries and with future JavaScript features.
- **Arrow functions as class fields everywhere:** `handle = () => {}` fixes `this`, but creates a new function per instance and cannot be called with `super.handle()` from a subclass. Use it for callbacks that need a bound `this`, not for every method.

## Key Takeaways

- Every object has a prototype link; property **reads** walk the prototype chain until `null`, and return `undefined` if nothing matches.
- `Fn.prototype` is the object that instances created with `new Fn()` will use as their prototype; `obj.__proto__` (better: `Object.getPrototypeOf(obj)`) is an object's actual link.
- Built-in methods like `map` and `toUpperCase` come from `Array.prototype` and `String.prototype`.
- `Object.create(proto)` creates an object with a chosen prototype; `Object.create(null)` creates one with none.
- `class` is syntax over constructor functions and prototypes, plus strict mode, `new` enforcement, fields, `#private` members, `static`, `extends` and `super`.
- Class declarations are hoisted but unusable before their line (temporal dead zone).
- Inheritance is a linked prototype chain; polymorphism is overriding methods with the same name; abstraction can be simulated with `new.target`.

## Interview Questions

### Junior (0–1 year)

**Q1. What is a prototype in JavaScript?**
A prototype is an object that another object is linked to and inherits properties from. Every object has an internal `[[Prototype]]` link, and regular functions have a `prototype` property whose object becomes the prototype of instances created with `new`. Methods placed on a prototype are shared by every object linked to it.

**Q2. What is the prototype chain, and what happens when a property is not found?**
When you read `obj.x`, JavaScript checks `obj`'s own properties, then its prototype, then that prototype's prototype, and so on. The chain ends at `Object.prototype`, whose prototype is `null`. If no object in the chain has `x`, the result is `undefined` (no error).

**Q3. What is the difference between `prototype` and `__proto__`?**
`prototype` is a property of functions: the object that `new Fn()` will use as the new instance's prototype. `__proto__` is an accessor on every object that exposes that object's own prototype link. For `const c = new Car()`, `c.__proto__ === Car.prototype` is `true`. Use `Object.getPrototypeOf()` instead of `__proto__` in real code.

**Q4. What is a class in JavaScript, and is it different from a constructor function under the hood?**
A class is a blueprint for objects, written with the `class` keyword. Under the hood it is still a function with a `prototype` object, so `typeof MyClass` is `"function"` and methods live on `MyClass.prototype`. The differences are extra rules and features: classes must be called with `new`, are always strict, are in the TDZ before declaration, have non-enumerable methods, and support fields, `#private`, `static`, `extends` and `super`.

**Q5. Are classes hoisted?**
Technically yes, but they are not initialised until their declaration runs, like `let` and `const`. Using a class before that line throws `ReferenceError: Cannot access 'X' before initialization`. Function declarations, by contrast, can be called before they appear.

**Q6. What does `super` do?**
Inside a derived class constructor, `super(args)` calls the parent class's constructor and must run before `this` is used. Inside methods, `super.method()` calls the parent's version of a method, which is useful when you override a method but still want the parent's behaviour.

### Mid-level (2–4 years)

**Q7. What does this print?**
```js
function Dog(name) { this.name = name; }
Dog.prototype.sound = "woof";
const a = new Dog("Tommy");
const b = new Dog("Bruno");
b.sound = "grr";
Dog.prototype.sound = "bark";
console.log(a.sound, b.sound);
console.log(a.hasOwnProperty("sound"), b.hasOwnProperty("sound"));
```
It prints `bark grr`, then `false true`. `a` has no own `sound`, so it reads the prototype's current value, which was changed to `"bark"`. `b.sound = "grr"` created an own property that shadows the prototype, so later prototype changes do not affect `b`.

**Q8. What does this print, and why?**
```js
const base = { tags: [] };
const x = Object.create(base);
const y = Object.create(base);
x.tags.push("js");
console.log(y.tags);
```
`["js"]`. `x.tags.push` reads `tags` through the prototype chain and mutates the **shared** array on `base`; it does not assign a new property to `x`. Put per-instance arrays in the constructor (or a class field) so each object gets its own.

**Q9. How would you implement inheritance without `class`?**
Call the parent constructor with the child's `this` (`Parent.call(this, args)`), set `Child.prototype = Object.create(Parent.prototype)` to link the chains, and restore `Child.prototype.constructor = Child`. Then add or override methods on `Child.prototype`. This is exactly what `extends` and `super` automate.

**Q10. Class field arrow functions vs prototype methods: what are the trade-offs?**
A class field like `handleClick = () => {...}` is created per instance and has `this` permanently bound to that instance, which is handy for event handlers and React class components. The cost is memory (one function per instance), and subclasses cannot reach it with `super.handleClick()`. Prototype methods are shared and overridable but lose `this` when passed as callbacks unless you bind them.

**Q11. How does `instanceof` work, and when can it give surprising results?**
`obj instanceof C` walks `obj`'s prototype chain and returns `true` if it finds `C.prototype`. It can be fooled by changing prototypes (`Object.setPrototypeOf`) or by a custom `Symbol.hasInstance` (see [Symbols, iterators and generators](../13-symbols-iterators-generators/notes.md#well-known-symbols)). It also fails across realms: an array from an iframe is not `instanceof Array` in the parent page, which is why `Array.isArray()` exists.

**Q12. Why is extending built-in prototypes like `Array.prototype` considered bad practice?**
Every array in the program, and in every library you load, is affected. Your method can clash with another library's method of the same name, or with a future standard method. That has happened: proposed array methods have had to be renamed because popular old libraries had already added a method with the same name. If a helper is needed, write a standalone function or a subclass.

**Q13. When would you use `Object.create(null)`?**
When you need a pure key-value dictionary. The object has no prototype, so keys such as `"constructor"`, `"toString"` or `"__proto__"` cannot collide with inherited members, which also protects against some prototype-pollution bugs. Because it has no `hasOwnProperty`, check keys with `Object.hasOwn(obj, key)` or `key in obj`. Often a `Map` is the better choice.

### Senior (5+ years)

**Q14. A design-system team proposes a `BaseComponent` class that every widget must extend, with shared lifecycle, logging, analytics and theming. What are the risks, and what would you do instead?**
A wide base class becomes the most coupled code in the company. Every change to it ripples into every subclass owned by other teams (the "fragile base class" problem): subclasses come to depend on its internals and on the order in which it calls overridable methods, and forgetting `super.method()` in an override silently drops behaviour. A class can extend only one parent, so cross-cutting features (analytics plus theming plus drag-and-drop) end up in either a growing god class or a chain of mixins (`const Draggable = (Base) => class extends Base {}`), which add name clashes and hard-to-follow `super` chains.

Prefer composition: pass collaborators in (a logger, a theme, an analytics client), or use the framework's composition tools (hooks, slots, controllers). Inheritance still fits when the platform requires it (custom elements must extend `HTMLElement`; custom errors extend `Error` so `instanceof` and stack traces work) or for a shallow, stable hierarchy with a small, documented contract. Recommendation: at most one level of inheritance from a deliberately small base, composition for everything cross-cutting, and treat any base class you do ship as a public, versioned API.

**Q15. A profile shows a hot loop over 200,000 objects is slow. The objects come from a factory that adds properties conditionally, deletes some, and calls `Object.setPrototypeOf` to "upgrade" some objects. Why is this slow, and how would you restructure it?**
Engines such as V8 give each object a hidden class (shape) and cache property lookups per access site. When every object at a site has the same shape, a property read is a fixed-offset load; conditional properties, different insertion orders and `delete` produce many shapes (or push an object into slow "dictionary mode"), so the site becomes polymorphic or megamorphic and falls back to a generic lookup. Changing the prototype of an existing object is worse: MDN warns that `Object.setPrototypeOf` is very slow in every engine and can deoptimise any code that later touches the object. (Engine background: [How JavaScript runs](../01-how-js-runs/notes.md).)

Restructure so every object is created in its final form: use a `class` (or `Object.create(proto)`) so the prototype is right from the start, initialise every field in the constructor in the same order, use `null` instead of a missing property, and set a field to `undefined` instead of deleting it. Keys that are truly dynamic belong in a `Map`. Recommendation: one class per kind of object with all fields declared, no prototype changes on live objects, and confirm the gain with the profiler (DevTools Performance panel or `node --cpu-prof`) rather than assuming it.

**Q16. A security scan reports prototype pollution in your deep-merge utility. What is the attack, what can it do, and how do you fix it across the codebase?**
A merge or `set(obj, "a.b.c", value)` helper that copies keys from untrusted input follows a key named `__proto__` (or `constructor` then `prototype`) and writes onto `Object.prototype`. `JSON.parse('{"__proto__": {"isAdmin": true}}')` creates an ordinary own key called `"__proto__"`; a naive `merge({}, payload)` then reads `target["__proto__"]`, gets `Object.prototype`, and assigns `isAdmin` there, so **every** object in the process now has `user.isAdmin === true`. Results range from authorisation bypasses to crashes (overwriting `toString`) and, in Node.js, remote code execution through libraries that read options such as `shell` or `env` from plain objects.

Fixes, in layers: validate input against a schema that only allows known keys; make merge and path-setting helpers skip `__proto__`, `constructor` and `prototype` and copy only own properties; store user-keyed data in a `Map` or `Object.create(null)`; keep libraries patched. As defence in depth, Node.js can run with `--disable-proto=delete` (removes the `__proto__` accessor, though not the `constructor.prototype` path) and services can `Object.freeze(Object.prototype)` at startup after checking that their dependencies tolerate it. Recommendation: ban hand-written deep merges in favour of one vetted utility with tests for these keys, and validate every external payload at the boundary.

**Q17. You inherit a large codebase built on constructor functions, `Parent.call(this)` and `Object.create` wiring. Would you migrate it to classes, and how?**
Classes are mostly a mechanical rewrite, but not a pure one. Classes throw when called without `new`, run in strict mode (silent failures become errors, `this` can be `undefined`), are in the TDZ before their declaration, and have **non-enumerable** methods, so code that mixes prototypes in with `Object.assign(target, Fn.prototype)` or walks them with `for...in` stops copying them. Inheritance also breaks in one direction: a class can `extend` a constructor function, but a constructor function cannot call a class parent with `Parent.call(this)` (`TypeError: Class constructor Parent cannot be invoked without 'new'`).

So migrate bottom-up: convert leaf subclasses first, and convert a parent only after all its children are classes. Before each step, search for calls without `new`, for `.call(this` / `.apply(this` against the converted constructor, and for prototype mixins; a codemod (for example lebab's class transform) handles the bulk, and tests catch the rest. Recommendation: migrate incrementally, one hierarchy at a time, in code that is actively changing; leave stable legacy code that nobody touches alone, since the migration carries risk and no runtime benefit.

## References

- [MDN: Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)
- [MDN: Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes)
- [MDN: extends](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends)
- [MDN: super](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super)
- [MDN: Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties)
- [MDN: Object.create()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create)
- [MDN: Object.getPrototypeOf()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getPrototypeOf)
- [MDN: Object.prototype.\_\_proto\_\_](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto)
