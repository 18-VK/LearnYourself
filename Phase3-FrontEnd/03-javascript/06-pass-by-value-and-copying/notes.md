# Pass by Value, References and Copying

> JavaScript · Topic 6 · Companion to [Functions](../05-functions/notes.md) · Demo: [script.js](../05-functions/script.js) · Examples run with `node`

When you pass a variable to a function, does the function get a copy, or the original? In JavaScript the answer is always "a copy of the value", but for objects that value is a **reference**, which is why changes to an object's properties are visible outside the function. This note covers call by value vs call by reference, why JavaScript is "call by sharing", and how to copy objects and arrays safely (shallow vs deep copies, `structuredClone`). Understanding this explains a whole class of bugs with arrays, objects and React state.

## The two terms

| Term | Meaning | Can the function change the caller's variable? |
| --- | --- | --- |
| Call (pass) by value | The function receives a **copy** of the value | No |
| Call (pass) by reference | The function receives the caller's **variable itself** (an alias) | Yes, even reassigning it |

Languages like C++ (with `&` parameters) support true pass by reference. JavaScript does not.

## JavaScript is always pass by value

It's always pass by value, but for objects the value of the variable **is a reference** (an address pointing to the object in memory). Because of this, when you pass an object and change its members, those changes persist outside the function. This makes it *look* like pass by reference. But if you actually change the value of the object variable itself (assign a new object to the parameter), you will see that the change does **not** persist, proving it's really pass by value.

This behaviour is sometimes called **call by sharing**: the caller and the function share the same object, but not the same variable.

## Primitives: the function gets a copy

Numbers, strings, booleans, `null`, `undefined`, symbols and BigInts are copied. Changing the parameter never affects the caller.

```js
function inc(n) {
  n++;            // changes only the local copy
  return n;
}

let num = 5;
console.log(inc(num)); // → 6
console.log(num);      // → 5  (unchanged)
```

## Objects: the function gets a copy of the reference

```text
caller:    x ──────┐
                   ├──►  { member: "foo" }   (one object in memory)
function:  param ──┘
```

Both variables point to the **same** object. Through either one you can change that object's properties. But assigning a new object to `param` only re-points `param`; `x` still points to the original.

## The proof: `changeObject` vs `changeMember`

```js
function changeObject(x) {
  x = { member: "bar" };          // re-points the local parameter only
  console.log("in changeObject: " + x.member);
}

function changeMember(x) {
  x.member = "bar";               // mutates the shared object
  console.log("in changeMember: " + x.member);
}

var x = { member: "foo" };

console.log("before changeObject: " + x.member);
changeObject(x);
console.log("after changeObject: " + x.member);   /* change did not persist */

console.log("before changeMember: " + x.member);
changeMember(x);
console.log("after changeMember: " + x.member);   /* change persists */
```

Output:

```text
before changeObject: foo
in changeObject: bar
after changeObject: foo

before changeMember: foo
in changeMember: bar
after changeMember: bar
```

- `changeObject` assigns a brand-new object to its parameter. The caller's `x` is not affected, which would be impossible with true pass by reference.
- `changeMember` changes a property of the object both variables point to, so the caller sees the change.

> **Note:** The parameter is also called `x`, but it is a separate local variable that shadows the outer `x`. The names don't matter; the behaviour is the same with any name.

## Arrays behave the same way

Arrays are objects, so the same two rules apply:

```js
function addItem(arr) { arr.push(4); }  // mutation: visible outside
function reset(arr)   { arr = []; }     // reassignment: not visible outside

const list = [1, 2, 3];
addItem(list);
console.log(list); // → [ 1, 2, 3, 4 ]
reset(list);
console.log(list); // → [ 1, 2, 3, 4 ]
```

Watch out for array methods that mutate in place, such as `sort`, `reverse`, `splice`, `push` and `pop`:

```js
function sortScores(a) {
  return a.sort((p, q) => p - q);   // sorts the caller's array too
}
const scores = [3, 1, 2];
const sorted = sortScores(scores);
console.log(scores);            // → [ 1, 2, 3 ]  (the original changed)
console.log(sorted === scores); // → true         (same array)
```

## `const` does not protect the contents

`const` only stops the *variable* from being reassigned (see [`const`](../02-types-variables-hoisting/notes.md#const)). A function receiving a `const` object can still mutate it. To make an object read-only, use `Object.freeze()` (shallow). Writes to a frozen object are silently ignored in sloppy mode and throw a `TypeError` in strict mode (see [Strict mode](../01-how-js-runs/notes.md#strict-mode)).

## How to avoid accidental mutation

Make a copy before changing, or return a new value instead of mutating the input:

| Technique | Example | Depth |
| --- | --- | --- |
| Spread (object) | `const copy = { ...obj }` | Shallow |
| Spread (array) | `const copy = [...arr]` | Shallow |
| `Object.assign` | `Object.assign({}, obj)` | Shallow |
| `slice` | `arr.slice()` | Shallow |
| Non-mutating array methods (ES2023) | `arr.toSorted()`, `arr.toReversed()`, `arr.with(i, v)` | Shallow |
| `structuredClone` | `structuredClone(obj)` | Deep |
| JSON round-trip | `JSON.parse(JSON.stringify(obj))` | Deep, but lossy (see below) |

**Shallow vs deep copy:** a shallow copy duplicates the top level only; nested objects are still shared.

```js
const orig = { name: "A", address: { city: "Delhi" } };

const shallow = { ...orig };
shallow.name = "B";             // top level: independent
shallow.address.city = "Noida"; // nested: shared with orig
console.log(orig.name, orig.address.city); // → A Noida

const deep = structuredClone(orig);
deep.address.city = "Pune";
console.log(orig.address.city); // → Noida (unaffected this time)
```

Writing functions that return new values ("pure functions", see [Functional patterns](../26-functional-patterns/notes.md)) avoids the problem altogether:

```js
const addItemPure = (arr, item) => [...arr, item];
const original = [1, 2];
const updated = addItemPure(original, 3);
console.log(original, updated); // → [ 1, 2 ] [ 1, 2, 3 ]
```

## Why it matters

- **React state:** React detects changes by comparing references. If you `push` into a state array and set the same array again, React sees the same reference and may not re-render. Always create a new array or object.
- **Shared data:** a helper that sorts or edits its input silently changes data used elsewhere in the app.
- **Function contracts:** callers should be able to trust that a function doesn't modify its arguments unless its name says so (`sortInPlace`).

## Common Mistakes

- **Believing JavaScript passes objects by reference** and expecting `param = newObject` inside a function to replace the caller's object.
- **Mutating an argument by accident** with `sort`, `reverse`, `splice`, `push` or direct property assignment.
- **Assuming spread makes a deep copy.** Nested objects and arrays are still shared.
- **Using `JSON.parse(JSON.stringify(x))` for deep copies** of data with dates, `undefined`, functions, `Map`/`Set` or circular references; they get converted, dropped or throw.
- **Thinking `const` prevents mutation** of the object's contents.

## Key Takeaways

- JavaScript is always call by value.
- For primitives the value is the data itself, so the caller's variable can never change.
- For objects and arrays the value is a reference: mutating properties is visible to the caller, reassigning the parameter is not.
- Mutating array methods (`sort`, `reverse`, `splice`, `push`, `pop`) change the caller's array.
- Copy with spread, `slice` or `toSorted` (shallow) or `structuredClone` (deep) before modifying, or return new values.

## Interview Questions

### Junior (0–1 year)

**Q1. Is JavaScript pass by value or pass by reference?**
Always pass by value. For objects and arrays, the value being copied is a reference to the object, so the function and the caller share the same object. Mutating that object's properties is visible outside; assigning a new object to the parameter is not. This is often called "call by sharing".

**Q2. What does this print?**

```js
function change(n) { n = 100; }
let a = 1;
change(a);
console.log(a);
```

`1`. `a` holds a primitive, so the function receives a copy; assigning `100` to the local parameter `n` does not touch `a`.

**Q3. What does this print?**

```js
function rename(obj) { obj.name = "Harry"; }
const user = { name: "Aman" };
rename(user);
console.log(user.name);
```

`Harry`. The parameter `obj` holds a copy of the reference, so it points to the same object as `user`. Changing a property through `obj` changes the shared object.

**Q4. What does this print?**

```js
function replace(obj) { obj = { name: "Harry" }; }
const user = { name: "Aman" };
replace(user);
console.log(user.name);
```

`Aman`. Assigning a new object to `obj` only re-points the local parameter; the caller's `user` still points to the original object. If JavaScript were truly pass by reference, this would print `Harry`.

### Mid-level (2–4 years)

**Q5. Why can't you write a `swap(a, b)` function that swaps two number variables in JavaScript?**
The function receives copies of the two numbers, so swapping the parameters inside it has no effect on the caller's variables. Return the swapped values instead and destructure them: `[a, b] = [b, a];`. Even with objects you can only swap their *contents*, not which object each caller variable points to.

**Q6. What is the difference between a shallow and a deep copy? What does this print?**

```js
const a = { tags: ["js"] };
const b = { ...a };
b.tags.push("react");
console.log(a.tags);
```

`[ 'js', 'react' ]`. Spread makes a shallow copy: `b` is a new object, but `b.tags` and `a.tags` are the same array. A deep copy (`structuredClone(a)`) would copy the nested array too, leaving `a.tags` unchanged.

**Q7. A utility `getTopScores(scores)` returns the sorted scores, but after calling it the leaderboard elsewhere in the app is also re-ordered. What is the bug and the fix?**
`Array.prototype.sort` sorts in place and returns the same array, so the function mutates the caller's array. Fix it by sorting a copy: `[...scores].sort((a, b) => b - a)`, or use the non-mutating `scores.toSorted((a, b) => b - a)` (ES2023). In React this kind of mutation can also cause missed re-renders, because the state reference does not change.

**Q8. When would you use `structuredClone` instead of `JSON.parse(JSON.stringify(obj))`, and what are its limits?**
`structuredClone` (available in modern browsers and Node 17+) deep-copies dates, `Map`, `Set`, typed arrays and circular references correctly. The JSON round-trip turns dates into strings, drops `undefined` and functions, converts `Map`/`Set` to `{}`, and throws on circular references. `structuredClone` still cannot clone functions or DOM nodes (it throws a `DataCloneError`), and class instances come back as plain objects without their prototype methods.

### Senior (5+ years)

**Q9. How would you enforce "don't mutate shared data" across a large codebase? Compare `Object.freeze`, TypeScript `readonly`, Immer and lint rules.**

| Tool | What it catches | Cost and limits |
| --- | --- | --- |
| `Object.freeze` | Writes at runtime (TypeError in strict mode, silently ignored in sloppy mode) | Shallow; deep-freezing on every update costs time; only catches code paths that actually run |
| TypeScript `readonly`, `Readonly<T>`, `ReadonlyArray<T>`, `as const` | Mutation at compile time, including `push` and `sort` on read-only arrays | No runtime cost, but types only: a cast or untyped code bypasses it |
| Immer (`produce`) | Lets you write "mutating" code against a draft and returns a new object with structural sharing; freezes what it produces by default | A dependency and a small overhead; built into Redux Toolkit |
| ESLint `no-param-reassign` with `{ "props": true }` | Assigning to parameters or their properties | Syntactic only; misses `push`, `sort` and mutation through aliases |

They complement each other. Recommendation: `readonly` types on shared data and function parameters as the main guard, Immer or plain spread for state updates, runtime freezing or mutation checks in development only, and the lint rule for parameters.

**Q10. A reducer deep-clones the whole state with `structuredClone` on every keystroke "to be safe". The app gets slower as data grows, and every component re-renders. What is wrong, and what is the right approach?**
A deep clone costs time proportional to the whole state on every update, and it gives **every** nested object a new reference. Memoised selectors, `React.memo` components and `useMemo` dependencies compare references, so they all see "changed" and re-render. Immutability means *not mutating*, not *copying everything*.

The right approach is **structural sharing**: copy only the objects on the path from the root to the changed value and reuse every other reference.

```js
const next = {
  ...state,
  users: {
    ...state.users,
    [id]: { ...state.users[id], name: newName },
  },
};
console.log(next.settings === state.settings); // → true: untouched branches are shared
console.log(next.users[id] === state.users[id]); // → false: only the changed path is new
```

Immer produces exactly this from simpler-looking code. Recommendation: path copying or Immer for every state update; keep `structuredClone` for genuine deep-copy needs at boundaries, such as taking an editable draft of data you don't own.

**Q11. A shared module's `getConfig()` returns its internal object, a feature team mutated it, and other features broke in production. How do you design ownership into module and library APIs?**
Returning an internal reference hands write access to every caller. Decide, per value, who owns it:

- **Read-only data** (config, constants): freeze it once when it is created (cheap, because it happens once), and type it as `Readonly`.
- **Collections callers may legitimately change:** return a copy (`[...this.items]`, `new Map(this.entries)`), or expose query methods (`has`, `get`, an iterator) instead of the collection itself.
- **Inputs:** copy caller-provided objects you keep (`this.options = { ...options }`), so later changes by the caller don't silently change your internal state.
- **Mutation in names:** functions that mutate say so (`sortInPlace`, `appendTo`), and everything else returns new values.

Copying costs allocations, so on hot paths prefer freezing plus read-only types over copying on every call. Recommendation: freeze what is read-only, copy what callers may change, never hand out internal mutable state, and make mutation visible in function names.

## References

- [MDN – Functions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions)
- [MDN – structuredClone()](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone)
- [MDN – Shallow copy](https://developer.mozilla.org/en-US/docs/Glossary/Shallow_copy)
- [MDN – Deep copy](https://developer.mozilla.org/en-US/docs/Glossary/Deep_copy)
- [MDN – Object.freeze()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze)
- [Immer documentation](https://immerjs.github.io/immer/)
- [Functions (companion note)](../05-functions/notes.md)
