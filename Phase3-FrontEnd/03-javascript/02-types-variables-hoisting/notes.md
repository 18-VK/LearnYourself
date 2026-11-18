# Data Types, var/let/const and the Node REPL

> JavaScript · Topic 2 · Demo: [script.js](script.js) · Run with `node script.js` (no HTML page)

Every value in JavaScript has a type, and every value lives in a variable declared with `var`, `let` or `const`. This note covers the eight data types, how the three declaration keywords differ in scope, redeclaration and hoisting (including the Temporal Dead Zone), and the Node.js REPL for trying code interactively.

## JavaScript's type system

JavaScript is a **dynamically typed** (also called loosely typed) scripting language. Variables in JavaScript are not directly associated with any particular value type, and any variable can be assigned (and re-assigned) values of all types over time:

```js
var a = 12;        // number
console.log("Number:" + a);   // → Number:12
a = "Aman";        // re-assigned as a string
console.log("String: " + a);  // → String: Aman
```

JavaScript is also a **weakly typed** language, which means it allows implicit type conversion (coercion) when an operation involves mismatched types, instead of throwing type errors:

```js
console.log("5" * 2);  // → 10   (the string is converted to a number)
console.log("5" + 2);  // → "52" (the number is converted to a string)
```

| Term | Meaning | JavaScript? |
| --- | --- | --- |
| Dynamically typed | Types are checked at runtime; a variable can hold any type | Yes |
| Statically typed | Types are fixed at compile time (Java, C#, TypeScript) | No |
| Weakly typed | Mismatched types are converted automatically | Yes |
| Strongly typed | Mismatched types cause an error (Python: `"5" + 2` is a TypeError) | No |

## Data types overview

JavaScript has **seven primitive types** and **one non-primitive type** (Object).

| Type | Example | `typeof` result |
| --- | --- | --- |
| Number | `42`, `3.14`, `NaN`, `Infinity` | `"number"` |
| String | `"hello"`, `'hi'`, `` `hey` `` | `"string"` |
| Boolean | `true`, `false` | `"boolean"` |
| Undefined | `undefined` | `"undefined"` |
| Null | `null` | `"object"` (a historical bug) |
| Symbol | `Symbol("id")` | `"symbol"` |
| BigInt | `10n`, `BigInt("123")` | `"bigint"` |
| Object (non-primitive) | `{}`, `[]`, functions, `Date`, `Map` | `"object"` (`"function"` for functions) |

**Primitives** are immutable and are compared and copied **by value**. **Objects** are mutable and are compared and copied **by reference** (see [Pass by value, references and copying](../06-pass-by-value-and-copying/notes.md)).

### Primitive data types

#### Number

JavaScript numbers are always stored in double-precision 64-bit binary format (IEEE 754). Unlike other programming languages, you don't need `int`, `float`, etc. to declare different numeric values; integers and decimals are the same type.

```js
let int = 42;
let dec = 3.14;
console.log(typeof int, typeof dec); // → number number
console.log(1 / 0);       // → Infinity
console.log(10 / "a");    // → NaN  ("Not a Number", but typeof NaN is "number")
console.log(0.1 + 0.2);   // → 0.30000000000000004  (binary floating-point rounding)
console.log(Number.MAX_SAFE_INTEGER); // → 9007199254740991  (2^53 − 1)
```

#### String

A string is a sequence of characters such as `"Hello GeeksforGeeks"`. You can read characters by index and get a `length`, so strings look a bit like an array of characters, but they are **not** arrays and they are immutable: string methods always return a new string. Strings are covered in detail in [Strings](../07-strings-and-regex/notes.md).

#### Boolean

Represents a logical entity and can have only two values: `true` or `false`.

#### Undefined

A variable that has been declared but not assigned a value is `undefined`. Functions with no `return` also return `undefined`, and reading a missing object property gives `undefined`.

```js
var b;
console.log(b); // → undefined
```

#### Null

This type has only one value: `null`. It means "intentionally empty": you assign it yourself to say "there is no value here".

```js
b = null;
console.log(b); // → null
```

| | `undefined` | `null` |
| --- | --- | --- |
| Meaning | Not assigned yet / missing | Deliberately empty |
| Who sets it | Usually the engine | Usually the programmer |
| `typeof` | `"undefined"` | `"object"` (bug kept for backward compatibility) |
| `null == undefined` | `true` (loose equality treats them as equal) | |
| `null === undefined` | `false` (different types) | |

#### Symbol

`Symbol()` returns a unique identifier that can be used as a property key on an object. Such a key won't collide with keys added by any other code, even if both use the same description.

```js
const id = Symbol("id");
const user = { name: "Aman", [id]: 101 };
console.log(user[id]);                    // → 101
console.log(Symbol("id") === Symbol("id")); // → false (every symbol is unique)
```

More on symbols in [Symbols, iterators and generators](../13-symbols-iterators-generators/notes.md).

#### BigInt

BigInt is a primitive type for whole numbers of **any size**, beyond the safe limit of `Number`. The largest integer that JavaScript can reliably represent with the Number primitive is **2^53 − 1** (`9007199254740991`), which is stored in the `Number.MAX_SAFE_INTEGER` constant. Past that, numbers lose precision:

```js
console.log(2 ** 53 + 1);  // → 9007199254740992  (wrong: the +1 is lost)
console.log(BigInt(Number.MAX_SAFE_INTEGER) + 2n); // → 9007199254740993n (exact)
```

You create a BigInt by adding `n` to an integer literal or by calling the global `BigInt()` function. The demo passes strings in decimal, hexadecimal and binary format:

```js
let bigNum = BigInt("123422222222222222222222222222222222222");
console.log(bigNum); // → 123422222222222222222222222222222222222n  (the console appends 'n')

// Parameter in hexadecimal format
let bigHex = BigInt("0x1ffffffeeeeeeeeef");
console.log(bigHex); // → 36893488074118328047n

// Parameter in binary format
let bigBin = BigInt("0b1010101001010101001111111111111111");
console.log(bigBin); // → 11430854655n
```

BigInt rules:

```js
console.log(typeof 10n);  // → bigint
console.log(10n + 5n);    // → 15n
console.log(7n / 2n);     // → 3n  (division truncates; there are no decimals)
console.log(10n == 10);   // → true
console.log(10n === 10);  // → false (different types)
// 10n + 5;   // TypeError: Cannot mix BigInt and other types, use explicit conversions
// BigInt(1.5); // RangeError: ... cannot be converted to a BigInt because it is not an integer
```

This has various uses where operations on very large numbers are required: database IDs, cryptography, precise timestamps in nanoseconds.

### Non-primitive data type: Object

Object is the most important data type and forms the building block of modern JavaScript. An object stores a collection of key-value pairs. Arrays, functions, dates, maps and sets are all objects. These are covered in detail in [Arrays](../08-arrays/notes.md), [Objects and enums](../09-objects-and-enums/notes.md), [Functions](../05-functions/notes.md) and [Map, Set, WeakMap and memory](../14-map-set-weakmap-memory/notes.md).

```js
// Object literal (preferred)
var obj = { Name: "aman", Age: 20 };
console.log(obj.Name);  // → aman

// Object constructor
var obj1 = new Object();
obj1.Name = "harry";
console.log(obj1.Name); // → harry
```

> **Note:** `Object()` can be called with or without `new`. Both create a new empty object. The literal `{}` is shorter and is what everyone uses.

### The `typeof` operator

`typeof` returns a string naming the type of a value:

```js
console.log(typeof 1);            // → number
console.log(typeof "x");          // → string
console.log(typeof true);         // → boolean
console.log(typeof undefined);    // → undefined
console.log(typeof null);         // → object   (bug from the first version of JS)
console.log(typeof Symbol());     // → symbol
console.log(typeof 10n);          // → bigint
console.log(typeof {});           // → object
console.log(typeof []);           // → object   (use Array.isArray([]) to detect arrays)
console.log(typeof function(){}); // → function
```

To check for `null`, compare directly: `value === null`.

## Declaring variables: var, let and const

In JavaScript, you can declare variables with the `var`, `let` and `const` keywords.

- `var` and `let` create variables that can be reassigned another value.
- `const` creates "constant" variables that cannot be reassigned another value.
- Developers shouldn't use `var` anymore. They should use `let` or `const` instead.
- If you're not going to change the value of a variable, it is good practice to use `const`.

### var vs let vs const: what's the difference?

To analyse the differences between these keywords, we use three factors:

1. **Scope** of variables
2. **Redeclaration and reassignment**
3. **Hoisting**: in JavaScript, a declaration is processed before the code runs, so a variable can (in some cases) be used before the line where it is declared.

Source: [freeCodeCamp – var, let, and const](https://www.freecodecamp.org/news/differences-between-var-let-const-javascript/)

### Scope

| Scope | Where the variable is visible |
| --- | --- |
| Global | Declared outside any function or block; visible everywhere |
| Function (local) | Declared inside a function; visible only inside that function |
| Block | Declared inside `{ }` (an `if`, a loop, or a bare block); visible only inside those braces |

**Block scope** means that the variable is accessible only within the block between the curly braces:

```js
if (true) {
  var v1 = 10;
  let v2 = 20;
  console.log(v1); // → 10
  console.log(v2); // → 20
}

console.log(v1); // → 10   accessible here (var ignores the block)
console.log(v2); // ReferenceError: v2 is not defined
```

> **Note:** Variables declared with `var` cannot have block scope. A `var` declared inside a `{ }` block can be accessed from outside the block. Only a *function* limits a `var`.

### var

- **Scope:** variables declared with `var` have global scope or function (local) scope. Global scope is for variables declared outside functions, while local scope is for variables declared inside functions. Blocks do not create a new scope for `var`.
- **Redeclaration and reassignment:** variables declared with `var` can be both redeclared and reassigned.

  ```js
  var b;
  console.log(b);  // → undefined
  var b = true;    // redeclaring and reassigning: no error
  console.log(b);  // → true
  ```

- **Hoisting:** variables declared with `var` are hoisted to the top of their global or function scope, which makes them accessible before the line they are declared on.

> **Note:** `var` variables are hoisted with a default value of `undefined`. Only the declaration is hoisted, not the assignment.

```js
console.log(score); // → undefined (no error)
var score = 50;
console.log(score); // → 50
```

### let

- **Scope:** variables declared with `let` can have global, local (function) or block scope.
- **Redeclaration and reassignment:** just like `var`, variables declared with `let` can be reassigned to other values, but they cannot be redeclared in the same scope.

  ```js
  let count = 1;
  count = 2;      // OK
  // let count = 3; // SyntaxError: Identifier 'count' has already been declared
  ```

- **Hoisting:** `let` declarations are hoisted too, but they are not initialised. If you try to access such a variable before its declaration, instead of getting `undefined` or a "variable is not defined" error, you get `ReferenceError: Cannot access 'x' before initialization`.

### const

- **Scope:** `const` is the same as `let` in regard to scope: global, local or block.
- **Redeclaration and reassignment:** `const` declares constant variables, variables whose binding cannot be changed. They can be neither redeclared nor reassigned, and they must be initialised on the same line.

  ```js
  const PI = 3.14;
  // PI = 3.1416;  // TypeError: Assignment to constant variable.
  // const X;      // SyntaxError: Missing initializer in const declaration
  ```

- **Hoisting:** accessing a variable declared with `const` before the line of declaration throws `ReferenceError: Cannot access ... before initialization`.

> **Note:** `const` makes the *variable binding* constant, not the value. An object or array stored in a `const` can still be changed. To make the object itself read-only, use `Object.freeze()` (see [Objects and enums](../09-objects-and-enums/notes.md)).

```js
const user = { name: "Aman" };
user.name = "Harry";        // allowed: changing a property
console.log(user.name);     // → Harry
// user = { name: "New" };  // TypeError: Assignment to constant variable.
```

### Comparison table

| | `var` | `let` | `const` |
| --- | --- | --- | --- |
| Scope | Function or global | Block | Block |
| Redeclare in same scope | Yes | No (SyntaxError) | No (SyntaxError) |
| Reassign | Yes | Yes | No (TypeError) |
| Must initialise on declaration | No | No | Yes |
| Hoisted | Yes, initialised to `undefined` | Yes, but uninitialised (TDZ) | Yes, but uninitialised (TDZ) |
| Access before declaration | `undefined` | ReferenceError | ReferenceError |
| Top-level declaration becomes a `window` property (browser, classic script) | Yes | No | No |
| Use today? | Avoid | When the value will change | By default |

## Hoisting and the Temporal Dead Zone (TDZ)

**Hoisting** is the engine's behaviour of registering all declarations in a scope *before* running the code in that scope. It looks as if declarations were moved to the top.

- `var` is registered and initialised to `undefined`.
- `let` and `const` are registered but **not initialised**.
- Function declarations are registered together with their whole body, so they can be called before they appear (see [Functions](../05-functions/notes.md#function-declaration)).

The JS engine doesn't allow access to variables declared with `let` and `const` before their declarations. The period between the start of the scope and the line where the variable is declared is called the **Temporal Dead Zone**. So `let` and `const` variables are hoisted too, but they cannot be accessed before their declarations.

Source: [Are let and const hoisted?](https://dev.to/anku/are-let-and-const-hoisted-4kbi)

```js
console.log(a); // → undefined
var a = 5;

console.log(b); // ReferenceError: Cannot access 'b' before initialization  (TDZ)
let b = 5;

console.log(c); // ReferenceError: c is not defined  (never declared at all)
```

Proof that `let` is hoisted: an inner `let` shadows an outer variable from the very start of its block.

```js
let x = 1;
{
  console.log(x); // ReferenceError: Cannot access 'x' before initialization
  let x = 2;      // this inner x is hoisted to the top of the block
}
```

If the inner `x` were not hoisted, the `console.log` would simply print the outer `1`.

> **Note:** `typeof` is normally safe on undeclared names (`typeof notDeclared` gives `"undefined"`), but `typeof` on a `let`/`const` variable inside its TDZ still throws a ReferenceError.

## The Node.js REPL

**REPL** stands for **Read–Eval–Print Loop**: it *reads* what you type, *evaluates* it, *prints* the result and *loops* back for more. Node.js ships with one, which is handy for testing small snippets without creating a file.

Start it by running `node` in a terminal with no file name:

```js
// $ node
// Welcome to Node.js v20.x.
// > 2 + 3
// 5
// > let name = "Aman"
// undefined            ← a declaration itself has no value, so the REPL prints undefined
// > name.toUpperCase()
// 'AMAN'
// > _                   ← _ holds the last result
// 'AMAN'
```

Useful REPL features:

| Command / key | What it does |
| --- | --- |
| `.help` | Lists all dot-commands |
| `.editor` | Multi-line editor mode; Ctrl+D runs the code, Ctrl+C cancels |
| `.break` | Abandons a multi-line input you are stuck in |
| `.clear` | Resets the REPL context (clears variables) |
| `.load file.js` | Runs a file inside the current session |
| `.save file.js` | Saves everything typed in this session to a file |
| `.exit` | Leaves the REPL (same as Ctrl+D, or Ctrl+C twice) |
| `_` / `_error` | The last result / the last error |
| Tab | Autocompletes variable and method names (try `"abc".` then Tab) |
| Up / Down arrows | Scroll through command history |

Typing an opening `{` and pressing Enter makes the REPL wait for more input (it shows `...`) until the block is closed.

To run a whole file instead, pass its name: `node script.js`. That is how this topic's demo runs.

## Common Mistakes

- **Using `var` in new code.** Its function scope and silent redeclaration cause bugs; use `const` by default and `let` when you must reassign.
- **Thinking `const` makes objects immutable.** It only stops reassignment of the variable; properties can still change.
- **Checking `typeof x === "object"` to detect objects.** It is also true for `null` and arrays. Add `x !== null` and use `Array.isArray()` for arrays.
- **Comparing with `NaN`.** `NaN === NaN` is `false`; use `Number.isNaN(value)`.
- **Expecting exact decimal maths.** `0.1 + 0.2 !== 0.3`. Compare with a tolerance or work in whole units (paise/cents).
- **Mixing BigInt and Number** (`10n + 5`) throws a TypeError; convert one side explicitly.
- **Reading a `let`/`const` before its declaration** (TDZ) throws, unlike `var`.

## Key Takeaways

- JavaScript is dynamically typed (types are checked at runtime) and weakly typed (it coerces mismatched types).
- There are 7 primitives (Number, String, Boolean, Undefined, Null, Symbol, BigInt) plus Object.
- `typeof null` is `"object"` and `typeof []` is `"object"`; use `=== null` and `Array.isArray()`.
- Numbers are 64-bit floats; integers are safe only up to 2^53 − 1. Use BigInt beyond that.
- Prefer `const`, use `let` when the value changes, avoid `var`.
- `var` is function-scoped and hoisted as `undefined`; `let`/`const` are block-scoped and stay in the TDZ until their declaration runs.
- `const` freezes the binding, not the object.
- `node` with no arguments opens the REPL; `node file.js` runs a file.

## Interview Questions

### Junior (0–1 year)

**Q1. What data types does JavaScript have?**
Seven primitive types: Number, String, Boolean, Undefined, Null, Symbol and BigInt, plus one non-primitive type, Object. Arrays, functions, dates, maps and sets are all kinds of objects. Primitives are immutable and copied by value; objects are copied by reference.

**Q2. What is the difference between `null` and `undefined`?**
`undefined` means a value has not been assigned: an unassigned variable, a missing property, or a function with no `return`. `null` is assigned on purpose to mean "no value". `null == undefined` is `true`, but `null === undefined` is `false`, and `typeof null` is `"object"` while `typeof undefined` is `"undefined"`.

**Q3. What are the differences between `var`, `let` and `const`?**
`var` is function-scoped, can be redeclared, and is hoisted with the value `undefined`. `let` and `const` are block-scoped, cannot be redeclared in the same scope, and throw a ReferenceError if used before their declaration (TDZ). `let` can be reassigned; `const` cannot and must be initialised immediately.

**Q4. What will this print?**

```js
console.log(a);
var a = 10;
console.log(b);
let b = 20;
```

The first line prints `undefined`, because `var a` is hoisted and initialised to `undefined`. The third line throws `ReferenceError: Cannot access 'b' before initialization`, because `b` is in the Temporal Dead Zone.

**Q5. Can you change an object declared with `const`?**
Yes, you can change its properties (`user.name = "Harry"`) or push into a `const` array. What you cannot do is assign a new value to the variable (`user = {}` throws a TypeError). To prevent property changes, use `Object.freeze()`.

**Q6. What is `typeof null`, and why?**
It returns `"object"`. This is a bug from the first implementation of JavaScript, where values were stored with a type tag and `null` shared the tag used for objects. It cannot be fixed without breaking existing websites, so to test for null use `value === null`.

**Q7. What is BigInt and when would you use it?**
BigInt is a primitive type for integers of arbitrary size, written with an `n` suffix (`10n`) or created with `BigInt("...")`. Use it when integers can exceed `Number.MAX_SAFE_INTEGER` (2^53 − 1), for example 64-bit database IDs or cryptographic values. You cannot mix BigInt and Number in arithmetic without converting, and BigInt has no decimals.

### Mid-level (2–4 years)

**Q8. What is the Temporal Dead Zone? What does this print?**

```js
let x = 1;
function show() {
  console.log(x);
  let x = 2;
}
show();
```

It throws `ReferenceError: Cannot access 'x' before initialization`. The inner `let x` is hoisted to the top of the function and shadows the outer `x`, but it stays uninitialised (in the TDZ) until its declaration line runs. This is also the proof that `let` is hoisted.

**Q9. Is JavaScript statically or dynamically typed, strongly or weakly typed?**
It is dynamically typed: types belong to values, not variables, and are checked at runtime. It is also weakly typed: operators coerce mismatched types instead of throwing (`"5" * 2` is `10`, `"5" + 2` is `"52"`). TypeScript adds static type checking at compile time, but the emitted JavaScript is still dynamically typed.

**Q10. Why is `0.1 + 0.2 !== 0.3`, and how should you compare decimals?**
Numbers are IEEE 754 binary floating-point values, and 0.1 and 0.2 have no exact binary representation, so the sum is `0.30000000000000004`. Compare with a tolerance: `Math.abs(a - b) < Number.EPSILON`. For money, store whole units (paise/cents) as integers, or format with `toFixed()` only for display.

**Q11. What is the difference between a top-level `var` and a top-level `let` in a browser script?**
In a classic (non-module) browser script, a top-level `var` (and a function declaration) becomes a property of the global object, so `var a = 1` makes `window.a === 1`. A top-level `let` or `const` is global but lives in a separate declarative scope and does not create a `window` property. In ES modules and Node CommonJS files, top-level declarations are module-scoped, so neither creates a global property.

**Q12. An API returns `{"id": 9007199254740993}` and your code shows the ID as `9007199254740992`. What happened and how do you fix it?**
The ID is larger than `Number.MAX_SAFE_INTEGER`, so `JSON.parse` converts it to the nearest representable double and the last digit changes. Converting to BigInt afterwards does not help, because the precision is already lost. The fix is for the API to send large IDs as strings, and to treat them as strings (or convert them with `BigInt("9007199254740993")`) in the client.

**Q13. What does this print, and why?**

```js
function test() {
  if (true) {
    var msg = "hi";
    let other = "hello";
  }
  console.log(msg);
  console.log(other);
}
test();
```

It prints `hi`, then throws `ReferenceError: other is not defined`. `var msg` is scoped to the whole function, so the `if` block does not limit it. `let other` is block-scoped and does not exist outside the `if` braces.

### Senior (5+ years)

**Q14. After a refactor, the app crashes on load with `ReferenceError: Cannot access 'API_URL' before initialization`, but only from one entry point. What is the likely cause, and how do you stop it happening again?**
Almost always a **circular import** hitting the TDZ. If `config.js` imports `api.js` and `api.js` imports `config.js`, one module starts evaluating before the other has finished. Imports are live bindings, so the name exists, but the `const` it points to is still uninitialised when the other module reads it at top level. Which module runs first depends on which file the entry point imports first, so the crash appears in one entry point and not another.

```js
// a.mjs
import { b } from "./b.mjs";      // b.mjs is evaluated first, before a.mjs's own code
export const a = "A";
console.log(b);

// b.mjs
import { a } from "./a.mjs";
export const b = "B uses " + a;   // `node a.mjs` → ReferenceError: Cannot access 'a' before initialization
```

With `var` the same cycle would silently read `undefined`, which is a worse bug, so the TDZ is doing its job. Fix the cycle, not the symptom: move the shared values into a third module that both import, or read them inside a function that runs after all modules have loaded. Recommendation: treat circular imports as a build error (the `import/no-cycle` lint rule or a dependency-graph check in CI). More in [Modules](../15-modules/notes.md).

**Q15. You want to ban `var` in a large legacy codebase. Is a find-and-replace to `let` safe? How would you roll it out?**
It is not safe, because code may depend on exactly the behaviour `let` removes:

- a `var` declared inside an `if` or loop and read after the block (now a ReferenceError);
- the same `var` declared twice in one function (now a SyntaxError);
- reads before the declaration that used to give `undefined` (now a TDZ ReferenceError);
- top-level `var` in classic scripts that other scripts or inline handlers read as `window.x` (no longer created);
- callbacks in loops that shared one `var` counter (each now gets its own binding: usually a fix, but still a behaviour change).

Roll it out with tooling: enable ESLint `no-var` and `prefer-const`, apply their autofix (it skips declarations it cannot convert safely), fix the remaining cases by hand with tests, module by module, and make any intentional global explicit (`window.appConfig = ...`). Recommendation: a lint-enforced, gradual migration, never a blind replace.

**Q16. You are writing `isArray`, `isDate` and `isPlainObject` helpers for a shared library used in pages with iframes, in Web Workers and in Node. Why are `typeof` and `instanceof` not enough, and what would you use?**
`typeof` only distinguishes the primitive categories: arrays, dates, `null` and plain objects are all `"object"`. `instanceof` compares against one specific constructor, and every realm (each window or iframe, each Node `vm` context) has its own `Array`, `Date` and `Object`. An array created in an iframe therefore fails `arr instanceof Array` in the parent page.

Use checks that work across realms:

```js
Array.isArray(value);                                     // arrays, any realm
Object.prototype.toString.call(value) === "[object Date]"; // built-in "brand" check

function isPlainObject(x) {
  if (x === null || typeof x !== "object") return false;
  const proto = Object.getPrototypeOf(x);
  return proto === null || Object.getPrototypeOf(proto) === null; // {} or Object.create(null), any realm
}
```

`Symbol.toStringTag` lets ordinary objects fake the `toString` brand, so these checks are for trusted values. Data from the network needs runtime validation with a schema, because TypeScript types disappear at runtime. Recommendation: never use `instanceof` for built-ins in library code; use `Array.isArray`, brand checks and prototype checks, and validate external data at the boundary.

**Q17. A front end talks to a .NET or Java back end that uses 64-bit IDs and `decimal` money amounts. What number-handling rules would you set for the team?**

- **IDs:** 64-bit integers above 2^53 − 1 lose digits in `JSON.parse` (see Q12). Make the API contract send IDs as JSON strings and type them as strings in the client. IDs are labels; nobody should do arithmetic on them.
- **Money:** never compute with binary floats. Send amounts as integers in minor units (paise, cents) with a currency code, or as decimal strings, and use a decimal library if the client really must calculate. Format for display with `Intl.NumberFormat`, not `toFixed` (`(1.005).toFixed(2)` is `"1.00"`).
- **Rounding:** decide where it happens (once, on the server) and which rule. .NET's `Math.Round` uses banker's rounding by default (`2.5` → `2`), while JavaScript's `Math.round(2.5)` is `3`; mixing them gives off-by-one-paisa differences.
- **BigInt:** only for real large-integer arithmetic. `JSON.stringify({ id: 10n })` throws `TypeError: Do not know how to serialize a BigInt`, so it always needs explicit conversion at the boundary.

Recommendation: strings for IDs, integer minor units or decimal strings for money, rounding in one place on the server, all enforced through the API schema and shared types.

## References

- [GeeksforGeeks – JavaScript Data Types](https://www.geeksforgeeks.org/javascript-data-types/)
- [MDN – JavaScript data types and data structures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures)
- [freeCodeCamp – var, let, and const: what's the difference?](https://www.freecodecamp.org/news/differences-between-var-let-const-javascript/)
- [DEV – Are let and const hoisted?](https://dev.to/anku/are-let-and-const-hoisted-4kbi)
- [MDN – let](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let)
- [MDN – const](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const)
- [MDN – Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)
- [MDN – BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
- [MDN – typeof](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof)
- [MDN – Array.isArray()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray)
- [ESLint – no-var](https://eslint.org/docs/latest/rules/no-var)
