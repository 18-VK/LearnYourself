# Arrays and Array Methods

> JavaScript · Topic 8 · Demo: [script.js](script.js) · [array-methods.js](array-methods.js) · Run with `node script.js` and `node array-methods.js` (no HTML page)

An array stores an ordered list of values in a single variable. Arrays are the most used data structure in JavaScript: API responses, lists in React, form data and almost every algorithm use them. This note covers creating and accessing arrays, the methods that add, remove and combine elements, `slice` vs `splice`, the three most important higher-order methods (`map`, `filter` and `reduce`), and the modern additions that interviews now expect you to know: `at`, `findLast`, `flatMap`, `Object.groupBy`/`Map.groupBy` and the non-mutating "change by copy" methods `toSorted`, `toReversed`, `toSpliced` and `with`. For every method, the two key questions are: **what does it return, and does it change the original array?**

## What is an array?

A JavaScript array is a data structure that allows you to store and organise multiple values within a single variable. It is a versatile and dynamic object: it can hold various data types, including numbers, strings, objects, and even other arrays. Arrays in JavaScript are **zero-indexed**, i.e. the first element is accessed with index `0`.

- JavaScript arrays are **resizable** (they grow and shrink as you add or remove items) and can contain a **mix of different data types**.
- Arrays are a special kind of **object**: the indexes are property keys and `length` is kept up to date automatically.

```js
let array = ["Perry", "smriti", "RCB"];
console.log(array[1]);       // → smriti
console.log(typeof array);   // → object  (an array is an object in JS)
console.log(Array.isArray(array)); // → true (the correct way to check for an array)
```

## Creating arrays

```js
const a = [1, 2, 3];                     // literal: the normal way
const b = Array.of(3);                   // → [ 3 ]
const c = Array.from("abc");             // → [ 'a', 'b', 'c' ]  (from any iterable or array-like)
const d = Array.from({ length: 3 }, (_, i) => i * 2); // → [ 0, 2, 4 ]
const e = new Array(3);                  // → [ <3 empty items> ]  (length 3, no values!)
const f = new Array(3, 4);               // → [ 3, 4 ]
const g = new Array(3).fill(0);          // → [ 0, 0, 0 ]
```

> **Note:** `new Array(3)` creates an array with three **empty slots**, not `[3]`. This inconsistency is why array literals (or `Array.of`) are preferred.

`Array.from(source, mapFn)` is the general converter. It accepts anything **iterable** (strings, `Set`, `Map`, `NodeList`, generators) or **array-like** (an object with `length` and numeric keys, such as `arguments`), and its optional second argument maps each element in the same pass:

```js
console.log(Array.from(new Set([1, 2, 2])));          // → [ 1, 2 ]  (Set to array)
console.log(Array.from(new Map([["a", 1]])));         // → [ [ 'a', 1 ] ]
console.log(Array.from([1, 2, 3], (x) => x * x));     // → [ 1, 4, 9 ]
function f() { return Array.from(arguments); }
console.log(f(1, 2));                                 // → [ 1, 2 ]
```

`Array.from({ length: n }, fn)` is the clean way to build `[0, 1, ..., n-1]` or a grid; `Array.fromAsync()` (Baseline 2024) does the same for async iterables and returns a promise.

## Accessing elements and `length`

```js
const nums = [10, 20, 30];
console.log(nums[0]);          // → 10
console.log(nums[nums.length - 1]); // → 30  (last element)
console.log(nums.at(-1));      // → 30  (ES2022: negative index counts from the end)
console.log(nums.at(-10));     // → undefined (out of range, no error)
console.log(nums[5]);          // → undefined (no error for out-of-range indexes)

nums[1] = 25;                  // update in place
console.log(nums);             // → [ 10, 25, 30 ]
```

`arr[-1]` does not work, because brackets look up the property named `"-1"`; that is why `at()` was added.

`length` is one more than the highest index, and it is writable:

```js
const x = [1, 2, 3, 4, 5];
x.length = 3;          // truncates the array
console.log(x);        // → [ 1, 2, 3 ]

const y = [1, 2];
y[5] = 9;              // creates holes at indexes 2–4
console.log(y, y.length); // → [ 1, 2, <3 empty items>, 9 ] 6
```

## Adding and removing elements

| Method | What it does | Returns | Mutates? |
| --- | --- | --- | --- |
| `push(...items)` | Adds to the **end** | New length | Yes |
| `pop()` | Removes from the **end** | Removed element (`undefined` if empty) | Yes |
| `unshift(...items)` | Adds to the **start** | New length | Yes |
| `shift()` | Removes from the **start** | Removed element (`undefined` if empty) | Yes |

From the demo:

```js
let array = ["Perry", "smriti", "RCB"];

console.log(array.pop());     // → RCB  (removes the element from the end of the array)
console.log(array);           // → [ 'Perry', 'smriti' ]

console.log(array.push("Into the final of 2024")); // → 3  (push returns the new length)
console.log(array);           // → [ 'Perry', 'smriti', 'Into the final of 2024' ]

// A single array can hold more than one type of element
array.push(2024);
console.log(array.length);    // → 4
console.log(typeof array[3]); // → number
console.log(typeof array[2]); // → string

let obj = { 1: "all rounder", 2: "Opener" };
array.push(obj);
console.log(typeof array[4]); // → object

console.log(array.shift());   // → Perry  (removes the element from the start)
array.unshift("Perry");       // adds an element at the start again
```

> **Note:** `push`/`pop` are fast. `shift`/`unshift` must re-index every element, so they get slower as the array grows.

### `delete` leaves a hole

```js
const arr = ["smriti", "Into the final of 2024", 2024, { 1: "all rounder" }];
delete arr[2];            // deletes the element, but the slot (space) is not removed
console.log(arr);         // → [ 'smriti', 'Into the final of 2024', <1 empty item>, { '1': 'all rounder' } ]
console.log(arr.length);  // → 4  (length does not change)
console.log(arr[2]);      // → undefined
```

To actually remove an element and close the gap, use `splice(index, 1)` (or `filter` for a new array).

An array with holes is called **sparse**, and methods disagree about holes, which is why you should never create them on purpose:

| Treats a hole as... | Methods |
| --- | --- |
| Skipped | `forEach`, `map` (keeps the hole in the result), `filter`, `reduce`, `some`, `every`, `indexOf`, `Object.keys` |
| `undefined` | `for...of`, spread, `Array.from`, `includes`, `find`, `at`, and the ES2023 methods `toSorted`, `toReversed`, `toSpliced`, `with` |
| `null` | `JSON.stringify([1, , 3])` → `"[1,null,3]"` |

## Converting to a string

```js
console.log(["Perry", "smriti", 2024].toString()); // → Perry,smriti,2024
console.log(["a", "b", "c"].join(" | "));          // → a | b | c
console.log([{ a: 1 }].toString());                // → [object Object]
```

`toString()` always joins with commas; `join(separator)` lets you choose. Objects inside become `"[object Object]"`, as the demo's output shows.

## Combining and copying arrays

`concat` merges two or more arrays into a **new** array; the originals are not changed.

```js
let arr1 = ["VK", 18];
let arr2 = ["ABD", 17];
let final = arr1.concat(arr2);
console.log(final);   // → [ 'VK', 18, 'ABD', 17 ]

final[2] = "565";     // changing the new array...
console.log(arr2);    // → [ 'ABD', 17 ]  ...does not affect arr2
```

`concat` also accepts plain values, and it flattens array arguments by **one** level only:

```js
console.log([1, 2, 3].concat(4, [5, [6]])); // → [ 1, 2, 3, 4, 5, [ 6 ] ]
```

The spread operator does the same and is the modern favourite:

```js
const merged = [...arr1, ...arr2];   // → [ 'VK', 18, 'ABD', 17 ]
const copy = [...arr1];              // shallow copy
```

> **Note:** `concat`, spread and `slice()` make **shallow** copies: nested objects are still shared between the old and new array. See [Call by Value vs Call by Reference](../06-pass-by-value-and-copying/notes.md) for deep copies and `structuredClone`.

## `splice` vs `slice`

`splice(start, deleteCount, ...itemsToAdd)` **changes** the original array: it removes and/or inserts elements, and returns an array of the removed elements.

```js
let nums = [1, 2, 3, 4, 5];

// nums.splice(1, 3);           // arg1 = start index, arg2 = number of elements to remove
nums.splice(1, 3, 22, 33);      // removes 3 elements (2, 3, 4) and adds 2 in their place
console.log(nums);              // → [ 1, 22, 33, 5 ]

const letters = ["a", "b", "c"];
letters.splice(1, 0, "x");      // deleteCount 0: insert only
console.log(letters);           // → [ 'a', 'x', 'b', 'c' ]
```

`slice(start, end)` returns a **new** array with the elements from `start` up to, but not including, `end`. The original is not changed. Negative indexes count from the end, and `slice()` with no arguments makes a shallow copy.

```js
let part1 = nums.slice(0, 2);
console.log(part1);             // → [ 1, 22 ]
console.log(nums);              // → [ 1, 22, 33, 5 ]  (unchanged)
console.log(nums.slice(-2));    // → [ 33, 5 ]  (last two)
```

| | `slice(start, end)` | `splice(start, count, ...items)` |
| --- | --- | --- |
| Changes the original array? | No | Yes |
| Returns | New array of the selected elements | Array of the **removed** elements |
| Second argument | End index (excluded) | Number of elements to remove |
| Can insert elements? | No | Yes |
| Typical use | Copy part of an array | Remove, replace or insert in place |
| Non-mutating version | (already non-mutating) | `toSpliced()` (ES2023) |

## Sorting and reversing

`sort()` sorts **in place** and, without a compare function, converts elements to **strings** and sorts them in UTF-16 order:

```js
console.log(["ABD", 17].sort());      // → [ 17, 'ABD' ]  ("17" < "ABD": digits come before letters)
console.log([10, 1, 5, 100].sort());  // → [ 1, 10, 100, 5 ]  (string order, not numeric!)
console.log([10, 1, 5, 100].sort((a, b) => a - b)); // → [ 1, 5, 10, 100 ]  ascending
console.log([10, 1, 5, 100].sort((a, b) => b - a)); // → [ 100, 10, 5, 1 ]  descending
```

The compare function returns a negative number if `a` should come first, a positive number if `b` should come first, and `0` to keep them as they are. Sorting objects by a property:

```js
const people = [{ name: "A", age: 30 }, { name: "B", age: 20 }];
people.sort((p, q) => p.age - q.age);
console.log(people.map(p => p.name)); // → [ 'B', 'A' ]
```

Since ES2019 `sort` is guaranteed to be **stable**: elements that compare equal keep their original order, so you can sort by a secondary key first and then by the primary key. For strings use `localeCompare` or an `Intl.Collator` (see [Strings, Regular Expressions and Intl](../07-strings-and-regex/notes.md#intlcollator-sorting-for-humans)).

`reverse()` also mutates. The ES2023 copies `toSorted()` and `toReversed()` return a new array instead (see [Change array by copy](#change-array-by-copy-tosorted-toreversed-tospliced-with)).

## Iterating over an array

```js
const nums = [1, 22, 33, 5];

// Classic for loop: needed when you want the index or to break early
for (let i = 0; i < nums.length; i++) {
  console.log(nums[i]);              // → 1, 22, 33, 5
}

// for...of: values only, can break
for (const n of nums) console.log(n);

// forEach method: calls the function for every element
nums.forEach((value, index) => console.log(index, value)); // → 0 1, 1 22, 2 33, 3 5
```

`forEach` always returns `undefined` and cannot be stopped with `break`. See [Loops](../04-loops/notes.md) for the loop comparison.

## `map`, `filter` and `reduce`

These three **higher-order methods** take a callback and are the backbone of data processing in modern JavaScript (and React rendering).

### `map()`

- Creates a **new array** from calling a function for every array element.
- Does not execute the function for empty elements (holes).
- Does **not** change the original array.

**Syntax:** `array.map(function(currentValue, index, arr), thisValue)`

| Parameter | Required? | Description |
| --- | --- | --- |
| `function()` | Required | A function to be run for each array element |
| `currentValue` | Required | The value of the current element |
| `index` | Optional | The index of the current element |
| `arr` | Optional | The array of the current element |
| `thisValue` | Optional | A value to use as `this` inside the function. Default `undefined`. (Ignored by arrow functions.) |

```js
let nums = [1, 22, 33, 5];
let newNumsArr = nums.map(e => e * 2);  // arrow function as the callback
console.log(newNumsArr);                // → [ 2, 44, 66, 10 ]
console.log(nums);                      // → [ 1, 22, 33, 5 ] (unchanged)
```

The new array always has the **same length** as the original. Whatever the callback returns becomes the new element, so forgetting `return` in a block body gives an array of `undefined`.

### `filter()`

Creates a new array containing only the elements for which the callback returns a **truthy** value.

```js
// From the demo
let filteredArr = nums.filter(value => { return (value % 2) == 0 ? value : undefined; });
console.log(filteredArr);  // → [ 22 ]

// Clearer: return a boolean
console.log(nums.filter(value => value % 2 === 0)); // → [ 22 ]

// filter + map is the everyday pair
const users = [{ name: "A", active: true }, { name: "B", active: false }];
console.log(users.filter(u => u.active).map(u => u.name)); // → [ 'A' ]
```

- If nothing matches you get an empty array `[]`, never `undefined`.
- Need only the first match? Use `find()`, which stops as soon as it finds one.

> **Note:** The demo's version returns the value itself, which works only because non-zero numbers are truthy. With a `0` in the array it breaks: `[0, 1, 2, 3].filter(v => v % 2 == 0 ? v : undefined)` gives `[ 2 ]` and loses the `0`. A filter callback should return `true` or `false`.

### `map` vs `filter`

`map` is used to apply a function to every item in an array and return the new array. `filter` is used to create a new array from an existing one, containing only those items that satisfy a condition specified in a function.

| | `map` | `filter` |
| --- | --- | --- |
| Callback returns | The new value for each element | `true`/`false` (keep or drop) |
| Result length | Always the same as the original | Same or shorter |
| Element values | Transformed | Unchanged (the originals that passed) |
| Example | `[1, 2, 3].map(n => n * 2)` → `[2, 4, 6]` | `[1, 2, 3].filter(n => n > 1)` → `[2, 3]` |

### `reduce()`

The `reduce()` method executes a **reducer** function for each array element and returns a **single value**: the function's accumulated result.

**Syntax:** `array.reduce(function(accumulator, currentValue, index, arr), initialValue)`

```js
const add = (a, b) => a + b;      // add function used as the reducer
console.log(nums.reduce(add));    // → 61   (1 + 22 + 33 + 5)
```

How it works: the **accumulator** starts as `initialValue` (or, if none is given, the first element, and iteration starts from the second). Each call returns the new accumulator.

| Call | accumulator | currentValue | returns |
| --- | --- | --- | --- |
| 1 | 1 | 22 | 23 |
| 2 | 23 | 33 | 56 |
| 3 | 56 | 5 | 61 |

Always pass an initial value; it makes the result type clear and avoids an error on empty arrays:

```js
console.log([].reduce(add, 0));   // → 0
// [].reduce(add);                // TypeError: Reduce of empty array with no initial value

// reduce can build any value, e.g. an object that counts items
const fruits = ["apple", "banana", "apple"];
const count = fruits.reduce((acc, f) => {
  acc[f] = (acc[f] || 0) + 1;
  return acc;
}, {});
console.log(count); // → { apple: 2, banana: 1 }
```

### Chaining

Because `map` and `filter` return arrays, calls can be chained:

```js
const total = [1, 2, 3, 4]
  .map(n => n * 2)        // [2, 4, 6, 8]
  .filter(n => n > 4)     // [6, 8]
  .reduce((s, n) => s + n, 0);
console.log(total);       // → 14
```

Each step is a full loop that allocates a new array. That is fine for normal sizes; for very large arrays in hot code see Q16.

## Searching

| Method | Returns | Example on `[1, 2, 3]` |
| --- | --- | --- |
| `indexOf(x)` | First index of `x`, or `-1` | `indexOf(2)` → `1` |
| `includes(x)` | `true` / `false` | `includes(2)` → `true` |
| `find(fn)` | First element that passes, or `undefined` | `find(n => n > 1)` → `2` |
| `findIndex(fn)` | Its index, or `-1` | `findIndex(n => n > 5)` → `-1` |
| `findLast(fn)` (ES2023) | **Last** element that passes, or `undefined` | `findLast(n => n < 3)` → `2` |
| `findLastIndex(fn)` (ES2023) | Its index, or `-1` | `findLastIndex(n => n < 3)` → `1` |
| `some(fn)` | `true` if **at least one** passes | `some(n => n > 2)` → `true` |
| `every(fn)` | `true` if **all** pass | `every(n => n > 0)` → `true` |

`findLast` replaces the old `[...arr].reverse().find(fn)`, which copied the whole array just to search from the end (typical use: the latest message from a user, the last completed step).

> **Note:** `includes` finds `NaN` but `indexOf` does not: `[NaN].includes(NaN)` is `true`, `[NaN].indexOf(NaN)` is `-1`.

## Flattening: `flat` and `flatMap`

```js
console.log([1, [2, [3, [4]]]].flat());          // → [ 1, 2, [ 3, [ 4 ] ] ] (one level)
console.log([1, [2, [3, [4]]]].flat(2));         // → [ 1, 2, 3, [ 4 ] ]
console.log([1, [2, [3, [4]]]].flat(Infinity));  // → [ 1, 2, 3, 4 ]
```

`flatMap(fn)` is `map(fn).flat()` in one pass. Because the callback can return zero, one or many elements, it can **filter and map at the same time**:

```js
console.log(["a b", "c"].flatMap(s => s.split(" ")));             // → [ 'a', 'b', 'c' ]
console.log([1, 2, 3].flatMap(n => (n % 2 ? [n, n * 10] : [])));  // → [ 1, 10, 3, 30 ]  ([] drops the element)
```

Other one-liners worth knowing:

```js
console.log([...new Set([1, 2, 2, 3, 1])]);      // → [ 1, 2, 3 ]  (remove duplicates)
console.log([1, 2, 3].join("-"));                // → 1-2-3
console.log([1, 2, 3].fill(0, 1));              // → [ 1, 0, 0 ]  (mutates)
```

## Grouping: `reduce`, `Object.groupBy` and `Map.groupBy`

Grouping a list by a key used to be a `reduce` exercise:

```js
const people = [{ dept: "IT", name: "A" }, { dept: "HR", name: "B" }, { dept: "IT", name: "C" }];
const byDept = people.reduce((groups, p) => {
  (groups[p.dept] ??= []).push(p.name);
  return groups;
}, {});
console.log(byDept); // → { IT: [ 'A', 'C' ], HR: [ 'B' ] }
```

ES2024 added it to the language (Baseline 2024; Node.js 21+):

```js
const grouped = Object.groupBy(people, (p) => p.dept);
// → [Object: null prototype] { IT: [ {...}, {...} ], HR: [ {...} ] }

const byAgeBand = Map.groupBy([15, 25, 70], (age) => (age < 18 ? "minor" : "adult"));
// → Map(2) { 'minor' => [ 15 ], 'adult' => [ 25, 70 ] }
```

| | `Object.groupBy` | `Map.groupBy` |
| --- | --- | --- |
| Returns | Null-prototype object | `Map` |
| Keys | Converted to strings (or symbols) | Any value, including objects, kept as is |
| Good for | Grouping by a string field, JSON output | Object keys, insertion order, `size`, frequent add/delete |

> **Note:** They are static methods (`Object.groupBy(arr, fn)`), not `arr.groupBy(fn)`: adding the method to `Array.prototype` broke existing websites whose libraries had added a method of the same name, so the committee moved it. The result has a **null prototype**, so a group named `"constructor"` or `"__proto__"` can't clash with `Object.prototype` (see Q20).

## Change array by copy: `toSorted`, `toReversed`, `toSpliced`, `with`

ES2023 added non-mutating twins of the mutating methods. They return a new array and leave the original alone, which is exactly what React state, Redux reducers and other immutable code need:

| Mutating (in place) | Copy version (ES2023) |
| --- | --- |
| `arr.sort(fn)` | `arr.toSorted(fn)` |
| `arr.reverse()` | `arr.toReversed()` |
| `arr.splice(start, count, ...items)` | `arr.toSpliced(start, count, ...items)` (returns the new array, not the removed items) |
| `arr[i] = value` | `arr.with(i, value)` (negative `i` allowed; out of range throws `RangeError`) |

```js
const arr = [3, 1, 2];
console.log(arr.toSorted());             // → [ 1, 2, 3 ]
console.log(arr.toReversed());           // → [ 2, 1, 3 ]
console.log(arr.toSpliced(1, 1, "x", "y")); // → [ 3, 'x', 'y', 2 ]
console.log(arr.with(-1, 9));            // → [ 3, 1, 9 ]
console.log(arr);                        // → [ 3, 1, 2 ]  (unchanged)
```

Before ES2023 the idiom was `[...arr].sort(fn)`; the new methods say the intent directly (`toSorted`, `toReversed` and `with` also exist on typed arrays).

## Mutating vs non-mutating methods

| Mutates the original (in place) | Returns a new array / value (original unchanged) |
| --- | --- |
| `push`, `pop`, `shift`, `unshift` | `concat`, spread `[...a]` |
| `splice` | `slice`, `toSpliced` (ES2023) |
| `sort` | `toSorted` (ES2023) |
| `reverse` | `toReversed` (ES2023) |
| `fill`, `copyWithin` | `map`, `filter`, `reduce`, `flat`, `flatMap` |
| Assigning `arr[i] = v`, `delete arr[i]`, setting `length` | `with(i, v)` (ES2023) |

In React and other state-based code, prefer the right-hand column so you never mutate state directly. More on immutable update patterns in [Functional patterns](../26-functional-patterns/notes.md).

## Demo walkthrough: `array-methods.js`

[array-methods.js](array-methods.js) is a quick-revision run through the everyday methods, all starting from `let Values = [12, 34, 56, 0, 3, 4];`:

| Line | Prints | Original changed? |
| --- | --- | --- |
| `Values.filter(num => num % 2 == 0)` | `[ 12, 34, 56, 0, 4 ]` | No |
| `Values.map(num => num * 2)` | `[ 24, 68, 112, 0, 6, 8 ]` | No |
| `Values.concat(result)` | `[ 12, 34, 56, 0, 3, 4, 24, 68, 112, 0, 6, 8 ]` | No |
| `Values.reduce((Initial, Current) => Initial + Current)` | `109` | No |
| `Values.splice(0, 3)` then `Values` / `removedValues` | `[ 0, 3, 4 ]` / `[ 12, 34, 56 ]` | **Yes** |
| `removedValues.slice(0, 2)` | `[ 12, 34 ]` (`removedValues` unchanged) | No |
| `Values.push(90)`, then `Values.push(98, 99)` | `[ 0, 3, 4, 90 ]`, then `[ 0, 3, 4, 90, 98, 99 ]` | **Yes** |
| `Values.pop()` | `[ 0, 3, 4, 90, 98 ]` | **Yes** |

> **Note:** The demo names the reducer's first parameter `Initial`, but it is really the **accumulator** (the running total), not the initial value. The initial value is the optional *second argument* to `reduce`: `Values.reduce((acc, cur) => acc + cur, 0)`. With no initial value, the accumulator starts as `12` and iteration starts at `34`.

## Common Mistakes

- **Using `typeof` to detect arrays.** It returns `"object"`; use `Array.isArray()`.
- **Using `delete arr[i]` to remove an element.** It leaves a hole and keeps the length; use `splice` or `filter`.
- **Building a range with `new Array(n).map(...)`.** `map` skips holes, so you get `n` empty slots; use `Array.from({ length: n }, fn)`.
- **Sorting numbers without a compare function.** `[10, 1, 5].sort()` gives `[1, 10, 5]`.
- **Forgetting that `sort`, `reverse` and `splice` change the original array.** Use `toSorted`, `toReversed`, `toSpliced` when the original must stay as it is.
- **Mixing up `slice` and `splice`.** The second argument means "end index" for `slice` but "how many to remove" for `splice`.
- **Expecting `push` to return the array.** It returns the new length, so `arr = arr.push(x)` replaces your array with a number.
- **Calling `splice` inside a forward loop over the same array.** Removing shifts the next element into the current index, so it is skipped: `[1, 2, 2, 3]` becomes `[1, 2, 3]`. Loop backwards or use `filter`.
- **Using `map` just to loop** (and ignoring the result). Use `forEach` or `for...of`; use `map` only when you need the new array.
- **Using `filter(...)[0]` to get one item.** It scans the whole array; `find` stops at the first match.
- **Forgetting `return` in a `map`/`filter` callback with braces**, which produces `undefined` values or an empty result.
- **Calling `reduce` without an initial value** on an array that might be empty.
- **Returning the value instead of a boolean from `filter`**, which drops `0`, `""` and other falsy elements.
- **Expecting `concat`, spread or `slice` to deep-copy** nested objects.

## Key Takeaways

- Arrays are zero-indexed, resizable, can mix types, and are objects (`typeof` gives `"object"`; use `Array.isArray`).
- `push`/`pop` work at the end, `unshift`/`shift` at the start; all four mutate the array.
- `slice` copies part of an array; `splice` removes/inserts in place and returns the removed items.
- `sort()` compares as strings by default; pass `(a, b) => a - b` for numbers. It is stable since ES2019.
- `map` transforms every element, `filter` keeps some elements, `reduce` combines everything into one value; `flatMap` can do map and filter in one pass. None of them changes the original.
- Use `find`, `findLast`, `some`, `every`, `includes` and `at` instead of manual loops and index arithmetic.
- Group with `Object.groupBy` / `Map.groupBy` (ES2024) or `reduce` on older runtimes.
- Prefer the change-by-copy methods (`toSorted`, `toReversed`, `toSpliced`, `with`) and spread when the original must stay unchanged, and never create sparse arrays.

## Interview Questions

### Junior (0–1 year)

**Q1. How do you check if a value is an array?**
Use `Array.isArray(value)`. `typeof []` returns `"object"`, so it cannot distinguish arrays from other objects. `value instanceof Array` also works in most cases, but fails for arrays created in another frame or realm (for example an iframe), so `Array.isArray` is the reliable choice.

**Q2. Explain `push`, `pop`, `shift` and `unshift`.**
`push` adds elements to the end and returns the new length; `pop` removes the last element and returns it. `unshift` adds elements to the start and returns the new length; `shift` removes the first element and returns it. All four modify the original array, and `shift`/`unshift` are slower on large arrays because every element must be re-indexed.

**Q3. What is the difference between `slice` and `splice`?**
`slice(start, end)` returns a new array with the elements from `start` up to (not including) `end`, and leaves the original untouched. `splice(start, count, ...items)` modifies the original array by removing `count` elements from `start` and optionally inserting new ones, and returns the removed elements. On `[10, 20, 30, 40, 50]`, `slice(1, 3)` returns `[20, 30]`, while `splice(1, 3)` returns `[20, 30, 40]` and leaves `[10, 50]`.

**Q4. What is the difference between `map` and `forEach`?**
`map` returns a new array built from the callback's return values, and is used to transform data. `forEach` returns `undefined` and is used only for side effects such as logging. Neither can be stopped with `break`. Use `map` when you need the result (for example, rendering a list in React), otherwise `forEach` or `for...of`.

**Q5. What is the difference between `map` and `filter`?**
`map` returns an array of the same length with every element transformed by the callback. `filter` returns an array with only the elements for which the callback returned a truthy value; the elements themselves are unchanged. For example, `[1, 2, 3].map(n => n * 2)` gives `[2, 4, 6]`, while `[1, 2, 3].filter(n => n > 1)` gives `[2, 3]`.

**Q6. What does this print?**

```js
const arr = [1, 2, 3];
delete arr[1];
console.log(arr.length, arr[1]);
```

`3 undefined`. `delete` removes the value but leaves an empty slot (a hole), so the length stays 3 and reading the slot gives `undefined`. Use `arr.splice(1, 1)` to remove the element and shift the rest down.

**Q7. What does `[10, 1, 5, 100].sort()` return, and how do you sort numbers correctly?**
It returns `[1, 10, 100, 5]`, because without a compare function `sort` converts elements to strings and compares them character by character. Pass a compare function: `sort((a, b) => a - b)` for ascending or `(a, b) => b - a` for descending. Remember that `sort` mutates the array; use `toSorted` or sort a copy if the original must stay unchanged.

**Q8. What does `filter` return if no element matches, and how is that different from `find`?**
An empty array `[]`. `filter` always returns a new array, never `undefined` or `null`, so `result.length === 0` is the check. `find` returns the first matching element or `undefined` when nothing matches, so check its result before using it (`user?.name`). Use `find` when you need one item: it stops at the first match instead of scanning everything.

### Mid-level (2–4 years)

**Q9. What happens when you call `reduce` on an empty array without an initial value? Why should you usually pass one?**
It throws `TypeError: Reduce of empty array with no initial value`. Without an initial value, the first element becomes the accumulator, so there is nothing to start with. Passing an initial value (`0` for sums, `{}` or `[]` when building objects or arrays) avoids the error, makes the result type explicit, and ensures the callback runs for every element.

**Q10. Why does `["1", "2", "3"].map(parseInt)` return `[1, NaN, NaN]`?**
`map` calls the callback with three arguments: `(value, index, array)`. `parseInt` accepts `(string, radix)`, so the calls become `parseInt("1", 0)` (radix 0 means "detect", giving 1), `parseInt("2", 1)` (radix 1 is invalid, `NaN`) and `parseInt("3", 2)` ("3" is not a binary digit, `NaN`). Fix it with `.map(Number)` or `.map(s => parseInt(s, 10))`.

**Q11. How do you remove duplicates from an array?**
For primitives, `[...new Set(arr)]` is the shortest and runs in linear time. `arr.filter((v, i) => arr.indexOf(v) === i)` also works but is O(n²). For objects, deduplicate by a key, for example with a `Map`: `[...new Map(users.map(u => [u.id, u])).values()]`, which keeps the last object for each id. More on `Set` and `Map` in [Map, Set, WeakMap and memory](../14-map-set-weakmap-memory/notes.md).

**Q12. In React you `push` an item into a state array and call `setItems(items)`, but the list doesn't re-render. Why, and what is the fix?**
`push` mutates the existing array, so the reference passed to `setItems` is the same object React already has; React compares references and decides nothing changed. Create a new array instead: `setItems([...items, newItem])`, or `setItems(prev => [...prev, newItem])`. The same applies to `sort`, `reverse` and `splice`; use `toSorted`, `toReversed`, `toSpliced`, `with`, `map` or `filter`.

**Q13. Implement your own version of `map`.**

```js
function myMap(arr, callback) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i in arr) result[i] = callback(arr[i], i, arr); // skip holes like the real map
  }
  return result;
}
console.log(myMap([1, 2, 3], n => n * 10)); // → [ 10, 20, 30 ]
```

The key points interviewers look for: return a **new** array, pass `(value, index, array)` to the callback, and leave the original unchanged. The real `map` also skips holes and supports a `thisArg`.

**Q14. Implement `filter` using `reduce`.**

```js
const myFilter = (arr, predicate) =>
  arr.reduce((acc, item, i) => {
    if (predicate(item, i, arr)) acc.push(item);
    return acc;
  }, []);

console.log(myFilter([1, 2, 3, 4], n => n % 2 === 0)); // → [ 2, 4 ]
```

Start with an empty array as the initial value and add each item only if the predicate passes. You will often see `(acc, item) => predicate(item) ? [...acc, item] : acc`, which looks more "functional" but copies the accumulator on every step and makes the function O(n²); mutating the accumulator you created yourself is safe and O(n).

**Q15. You need to check thousands of times whether an ID is in a list of 50,000 IDs. Is `includes` a good choice?**
`includes` scans the array from the start each time (O(n)), so thousands of calls means tens of millions of comparisons. Build a `Set` once (`const ids = new Set(list)`) and use `ids.has(id)`, which is O(1) on average. Likewise prefer `find` over `filter(...)[0]`, because `find` stops at the first match.

**Q16. `data.filter(...).map(...).reduce(...)` runs on a million items in a hot path. What are the costs, and when would you use a single `reduce` or loop instead?**
Each step loops over the data again, and `filter` and `map` each allocate an intermediate array: three passes, two temporary arrays of up to a million entries, and extra garbage-collection work. For normal data sizes chaining is more readable and the cost doesn't matter. In a measured hot path, combine the work into a single `reduce` or `for` loop that filters, transforms and accumulates in one pass, or use the ES2025 iterator helpers (`data.values().filter(f).map(g).reduce(h, 0)`, Baseline 2025, Node.js 22+), which are lazy and allocate no intermediate arrays; see [Symbols, iterators and generators](../13-symbols-iterators-generators/notes.md). `reduce` is also the natural choice when the result is not an array: a sum, a lookup object, a `Map`. Measure before optimising.

**Q17. You need to group a list of orders by status. How would you do it?**
On current runtimes, `Object.groupBy(orders, o => o.status)` (ES2024, Baseline 2024, Node.js 21+) returns `{ pending: [...], shipped: [...] }` as a null-prototype object. Use `Map.groupBy` when the keys are not strings (objects, or numbers you don't want converted) or when you need `size` and guaranteed insertion order. On older runtimes use `reduce` with `(groups[o.status] ??= []).push(o)`, ideally starting from `Object.create(null)` rather than `{}` (Q20 explains why), or ship a polyfill.

### Senior (5+ years)

**Q18. A teammate builds `[0, 1, 2, 3, 4]` with `new Array(5).map((_, i) => i)` and gets `[ <5 empty items> ]`. Explain, and would you ban sparse arrays in a large codebase?**
`new Array(5)` creates five holes, and `map` skips holes, so the callback never runs. Holes are treated inconsistently (skipped by `forEach`/`map`/`filter`, `undefined` for `for...of`, spread and the ES2023 methods, `null` in `JSON.stringify`), so the same data behaves differently depending on which method touches it. There is a performance cost too: V8 tracks an "elements kind" per array, and once an array becomes HOLEY (through `new Array(n)`, `delete`, or writing past the end) it never goes back to PACKED, so every read must check for holes and possibly walk the prototype chain.

Recommendation: yes, ban them by convention and lint. Build arrays with literals, `Array.from({ length: n }, fn)` or `new Array(n).fill(x)`; remove with `splice`/`filter`, never `delete`; enable ESLint's `no-sparse-arrays` (catches `[1, , 3]`) and, if you use eslint-plugin-unicorn, `unicorn/no-new-array`, and catch the rest in code review.

**Q19. A data grid sorts 100,000 rows on the client and the tab freezes for two seconds every time the user clicks a column header. How would you fix it?**
Measure first, but the usual causes are: an expensive comparator (sorting calls it about n·log₂n ≈ 1.7 million times; `a.name.localeCompare(b.name, "en", { sensitivity: "base" })` resolves locale data on each call), re-sorting on every render instead of when the sort key changes, and rendering all 100,000 rows to the DOM. Fixes in order of payoff: virtualise the list so only visible rows are rendered; memoise the sorted array (`toSorted` once per sort-key change); use one cached `Intl.Collator().compare`; precompute sort keys once (decorate, sort, undecorate) instead of deriving them inside the comparator; and if it is still too slow, move the sort to a Web Worker or to the server with pagination.

Recommendation: for data sets that keep growing, make sorting, filtering and paging a server concern early; on the client, keep a sorted copy keyed by the sort state and always virtualise large lists.

**Q20. You are writing a shared `groupBy(items, keyFn)` utility used by many teams. A bug report says it crashes with `push is not a function` when a product tag is `"constructor"`. Why, and how would you design the API?**
The implementation uses a `{}` accumulator: `(groups[key] ??= []).push(item)`. For `key === "constructor"`, `groups.constructor` is inherited from `Object.prototype` (the `Object` function), so it isn't nullish, no array is created, and `.push` fails. With `"__proto__"` it is worse: you read or replace the object's prototype, which is the root of prototype-pollution bugs. User-controlled strings must never be used as keys of a plain object.

Recommendation: mirror the platform. Return a `Map` (`Map.groupBy` semantics) when keys can be arbitrary values, or a null-prototype object (`Object.groupBy` semantics, `Object.create(null)`) when callers want plain-object access or JSON output, and document which one you return. Better still, use the built-ins and ship a small polyfill for older targets, so every team gets the same, well-specified behaviour.

**Q21. Your team keeps shipping bugs where shared arrays are mutated in place (a sorted copy in one component reorders a list in another). How would you enforce immutability across a large codebase without hurting performance?**
Make the safe path the default and the unsafe path visible. In TypeScript, type shared data as `readonly T[]` / `ReadonlyArray<T>`, which removes `push`, `sort` and `splice` from the type, so in-place mutation becomes a compile error while `toSorted`, `with` and `map` still work. Add lint rules (`no-param-reassign` with `props: true`, or an immutability plugin) and, in development builds, freeze state objects so accidental writes throw in strict-mode code (Immer freezes the state it produces, and Redux Toolkit adds a mutation-check middleware in development).

Watch the cost: every copy is O(n), so replacing one element of a 50,000-item array on each keystroke adds up. Use normalised state (`byId` map plus an `ids` array) so an update copies one small object, structural sharing (Immer) for nested updates, and plain local mutation inside a function on data that function created itself. Recommendation: `readonly` types plus change-by-copy methods for shared data, normalised state for large collections, and freezing only in development.

## References

- [MDN – Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)
- [MDN – Array.from()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from)
- [MDN – Array.prototype.map()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
- [MDN – Array.prototype.filter()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)
- [MDN – Array.prototype.reduce()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce)
- [MDN – Array.prototype.concat()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat)
- [MDN – Array.prototype.splice()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice)
- [MDN – Array.prototype.slice()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice)
- [MDN – Array.prototype.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
- [MDN – Array.prototype.toSorted()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted)
- [MDN – Array.prototype.with()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/with)
- [MDN – Array.prototype.findLast()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findLast)
- [MDN – Array.prototype.flatMap()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap)
- [MDN – Object.groupBy()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy)
- [MDN – Map.groupBy()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy)
- [V8 – Elements kinds in V8](https://v8.dev/blog/elements-kinds)
