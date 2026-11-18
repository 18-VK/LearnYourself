# Operators and Control Statements

> JavaScript · Topic 3 · Demo: [script.js](script.js) · Run with `node script.js` (no HTML page)

Operators combine and compare values (`+`, `**`, `===`, `&&`, `? :`), and control statements (`if`, `else if`, `switch`) choose which code runs based on those comparisons. Together they are how a program makes decisions. The parts that trip people up most are type coercion with `==` and the values JavaScript treats as `false`.

## What the demo covers

```js
let a = 3;
let b = 4;

// exponentiation operator (arithmetic operator)
console.log(a ** b);   // → 81   (3^4)

// strict equality operator
b = "3";
console.log(a == b);   // → true   only the value is compared; the type is converted first
console.log(a === b);  // → false  the type is compared too (number vs string)

// strict inequality operator
if (a !== b) {
  console.log("May the value or their type is not equal"); // ← this runs
} else {
  console.log("Equal");
}

// ternary operator
console.log((a === b) ? "true" : "false"); // → false
```

The rest of these notes explain each operator family and each control statement in detail.

## Operators

An **operator** acts on one or more values (operands) and produces a new value. `typeof x` and `!x` take one operand (unary), `a + b` takes two (binary), and `cond ? x : y` takes three (ternary).

### Arithmetic operators

| Operator | Name | Example | Result |
| --- | --- | --- | --- |
| `+` | Addition (or string concatenation) | `5 + 2` | `7` |
| `-` | Subtraction | `5 - 2` | `3` |
| `*` | Multiplication | `5 * 2` | `10` |
| `/` | Division (always decimal) | `5 / 2` | `2.5` |
| `%` | Remainder | `5 % 2` | `1` |
| `**` | Exponentiation (ES2016) | `3 ** 4` | `81` |
| `++` | Increment by 1 | `x++` / `++x` | |
| `--` | Decrement by 1 | `x--` / `--x` | |

```js
console.log(-7 % 3);       // → -1  (the sign follows the left operand)
console.log(2 ** 3 ** 2);  // → 512 (** is right-associative: 2 ** 9)
console.log((-2) ** 2);    // → 4   (writing -2 ** 2 is a SyntaxError)
```

**Prefix vs postfix increment:** `x++` returns the old value and then increments; `++x` increments first and returns the new value.

```js
let n = 5;
console.log(n++); // → 5  (returns 5, n becomes 6)
console.log(++n); // → 7  (n becomes 7, returns 7)
```

**`+` with strings:** if either operand is a string, `+` concatenates. The other arithmetic operators convert strings to numbers.

```js
console.log("5" + 3);   // → "53"
console.log("5" - 3);   // → 2
console.log("5" * "2"); // → 10
console.log(true + 1);  // → 2   (true becomes 1)
console.log(+"42");     // → 42  (unary plus converts to a number)
console.log(+"abc");    // → NaN
```

### Assignment operators

| Operator | Same as |
| --- | --- |
| `x = y` | assign |
| `x += y` | `x = x + y` |
| `x -= y` | `x = x - y` |
| `x *= y` | `x = x * y` |
| `x /= y` | `x = x / y` |
| `x %= y` | `x = x % y` |
| `x **= y` | `x = x ** y` |
| `x \|\|= y` | `x \|\| (x = y)`: assign only if `x` is falsy (ES2021) |
| `x &&= y` | `x && (x = y)`: assign only if `x` is truthy |
| `x ??= y` | `x ?? (x = y)`: assign only if `x` is `null` or `undefined` |

```js
let a = 0;  a ||= 5;  // a → 5  (0 is falsy)
let b = 0;  b ??= 5;  // b → 0  (0 is not null/undefined)
let c = 1;  c &&= 9;  // c → 9  (1 is truthy)
```

### Comparison operators

| Operator | Meaning |
| --- | --- |
| `==` | Loose equality: converts types, then compares |
| `!=` | Loose inequality |
| `===` | Strict equality: same type **and** same value |
| `!==` | Strict inequality: different type **or** different value |
| `>` `<` `>=` `<=` | Greater / less than (or equal) |

All comparison operators return a boolean.

#### `==` vs `===`

| | `==` (loose) | `===` (strict) |
| --- | --- | --- |
| Type conversion | Yes, converts operands to a common type first | No |
| `3 == "3"` / `3 === "3"` | `true` | `false` |
| `0 == ""` / `0 === ""` | `true` | `false` |
| `null == undefined` / `null === undefined` | `true` | `false` |
| `NaN == NaN` / `NaN === NaN` | `false` | `false` |
| Predictable? | No, the conversion rules are complex | Yes |
| Use it? | Only for the `x == null` shortcut (matches `null` and `undefined`) | Always, by default |

Some surprising results of loose equality:

```js
console.log(0 == "0");      // → true
console.log("" == "0");     // → false  (both strings, compared as text)
console.log(false == "0");  // → true   (both become the number 0)
console.log([] == false);   // → true   ([] → "" → 0, false → 0)
console.log([1] == 1);      // → true
console.log(null == 0);     // → false  (null only loosely equals undefined)
```

Objects (including arrays) are compared **by reference**, not by content:

```js
console.log({} === {});      // → false (two different objects)
const o = {};
console.log(o === o);        // → true  (same object)
```

#### Relational comparison and strings

When both operands are strings, they are compared character by character using UTF-16 code values ("dictionary order", but all uppercase letters come before lowercase). If one side is a number, the other is converted to a number.

```js
console.log("apple" < "banana"); // → true
console.log("Z" < "a");          // → true   ("Z" is 90, "a" is 97)
console.log("10" < "9");         // → true   (string comparison: "1" < "9")
console.log("10" < 9);           // → false  (numeric comparison: 10 < 9)
console.log(null >= 0);          // → true   (null becomes 0 for >=)
console.log(null > 0);           // → false
```

### Logical operators

| Operator | Name | Returns |
| --- | --- | --- |
| `&&` | AND | The first **falsy** operand, or the last operand if all are truthy |
| `\|\|` | OR | The first **truthy** operand, or the last operand if all are falsy |
| `!` | NOT | `true` or `false` (the opposite of the value's truthiness) |

`&&` and `||` return one of their operands, **not** necessarily a boolean, and they **short-circuit**: they stop evaluating as soon as the result is known.

```js
console.log("a" && "b");   // → "b"
console.log(0 && "b");     // → 0
console.log("" || "default"); // → "default"
console.log(!!"0");        // → true  (!! converts any value to its boolean)

const user = null;
user && console.log(user.name); // nothing runs: && stopped at null
```

#### Truthy and falsy values

In a boolean context (`if`, `while`, `&&`, `||`, `!`, ternary), every value is treated as either truthy or falsy. There are exactly eight **falsy** values; everything else is truthy.

| Falsy values |
| --- |
| `false`, `0`, `-0`, `0n`, `""` (empty string), `null`, `undefined`, `NaN` |

> **Note:** `"0"`, `"false"`, `" "` (a space), `[]` and `{}` are all **truthy**.

### Nullish coalescing `??` and optional chaining `?.`

`a ?? b` returns `b` only when `a` is `null` or `undefined` (ES2020). Unlike `||`, it keeps valid falsy values such as `0` and `""`.

```js
const count = 0;
console.log(count || 10); // → 10  (|| treats 0 as missing)
console.log(count ?? 10); // → 0   (?? only replaces null/undefined)
```

`obj?.prop` reads a property but returns `undefined` instead of throwing if `obj` is `null` or `undefined`:

```js
const person = null;
console.log(person?.address?.city); // → undefined (no TypeError)
// person.address                   // TypeError: Cannot read properties of null
```

> **Note:** `??` cannot be mixed with `||` or `&&` without parentheses: `a || b ?? c` is a SyntaxError. Write `(a || b) ?? c`.

### Ternary (conditional) operator

`condition ? valueIfTrue : valueIfFalse` is the only operator with three operands. It is an **expression**, so it produces a value you can assign, return or print.

```js
const age = 20;
const status = age >= 18 ? "adult" : "minor";
console.log(status); // → adult
```

Use it for short, simple choices between two values. For anything with side effects or more than two branches, an `if` statement is clearer. Avoid nesting ternaries.

### Other operators you will meet

| Operator | Example | Result |
| --- | --- | --- |
| `typeof` | `typeof 42` | `"number"` |
| `instanceof` | `[] instanceof Array` | `true` |
| `in` | `"name" in { name: "A" }` | `true` |
| `delete` | `delete obj.key` | removes a property |
| `...` (spread) | `[...arr, 4]` | copies elements into a new array |

### Operator precedence

When several operators appear in one expression, precedence decides which runs first (higher rows first). When in doubt, add parentheses.

| Precedence (high to low) | Operators |
| --- | --- |
| Grouping | `( )` |
| Member access, call, optional chaining | `.` `[]` `()` `?.` |
| Postfix | `x++` `x--` |
| Unary | `!` `typeof` `+x` `-x` `++x` `--x` |
| Exponent | `**` |
| Multiplicative | `*` `/` `%` |
| Additive | `+` `-` |
| Relational | `<` `<=` `>` `>=` `in` `instanceof` |
| Equality | `==` `!=` `===` `!==` |
| Logical AND | `&&` |
| Logical OR, nullish | `\|\|` `??` |
| Conditional | `? :` |
| Assignment | `=` `+=` `-=` ... |

```js
console.log(2 + 3 * 4);   // → 14
console.log((2 + 3) * 4); // → 20
console.log(1 < 2 < 3);   // → true  ((1 < 2) is true → 1 < 3)
console.log(3 > 2 > 1);   // → false ((3 > 2) is true → 1 > 1 is false)
```

## Control statements

Control statements decide **which** code runs. (Loops, which decide **how many times** code runs, are in [Loops](../04-loops/notes.md).)

### `if`, `else if`, `else`

```js
const marks = 72;

if (marks >= 90) {
  console.log("Grade A");
} else if (marks >= 60) {
  console.log("Grade B");   // ← runs
} else {
  console.log("Grade C");
}
```

- The conditions are checked top to bottom; the first truthy one wins and the rest are skipped.
- The condition can be any value, it is converted to a boolean (truthy/falsy).
- Always use braces, even for one-line bodies; it prevents bugs when a second line is added later.

### `switch`

`switch` compares one value against many `case` values. It is a clean alternative to a long `else if` chain that checks the same variable.

```js
const day = "sat";

switch (day) {
  case "sat":
  case "sun":                 // grouping: both cases share this code
    console.log("Weekend");   // ← runs
    break;
  case "mon":
    console.log("Start of the week");
    break;
  default:
    console.log("Weekday");
}
```

- `switch` uses **strict** comparison (`===`): `switch ("1")` does not match `case 1:`.
- Without `break`, execution **falls through** into the next case and keeps going until a `break` or the end.
- `default` runs when no case matches. It is optional and conventionally placed last.

```js
let dayNum = 2;
switch (dayNum) {
  case 1: console.log("Mon");
  case 2: console.log("Tue");   // matches here...
  case 3: console.log("Wed");   // ...and falls through to here
    break;
  default: console.log("other");
}
// → Tue
// → Wed
```

To test ranges in a `switch`, use `switch (true)` with conditions as cases:

```js
const temp = 35;
switch (true) {
  case temp > 40: console.log("Very hot"); break;
  case temp > 30: console.log("Hot"); break;   // ← runs
  default: console.log("Pleasant");
}
```

### `if` vs `switch` vs ternary

| Use | When |
| --- | --- |
| `if / else if / else` | Different conditions, ranges, or complex logic |
| `switch` | One value compared against many fixed values |
| Ternary `? :` | Choosing between two values inside an expression |
| Object lookup | Mapping many fixed keys to values (see below) |

### Cleaner alternatives: guard clauses and lookup tables

**Guard clauses** return early for invalid cases, so the main logic is not nested:

```js
function getDiscount(user) {
  if (!user) return 0;            // guard
  if (!user.isMember) return 5;   // guard
  return user.years > 2 ? 20 : 10;
}
console.log(getDiscount({ isMember: true, years: 3 })); // → 20
```

**Object lookup** replaces a `switch` that only maps keys to values:

```js
const statusText = { 200: "OK", 404: "Not Found", 500: "Server Error" };
const code = 404;
console.log(statusText[code] ?? "Unknown"); // → Not Found
```

## Common Mistakes

- **Using `=` instead of `===` in a condition.** `if (x = 5)` assigns 5 and is always truthy.
- **Relying on `==`.** Its coercion rules (`0 == ""`, `[] == false`) cause hidden bugs. Use `===` and `!==`.
- **Forgetting `break` in a `switch`.** Execution falls through into the next case.
- **Expecting `switch` to coerce types.** It uses `===`, so `"1"` does not match `case 1`.
- **Using `||` for defaults when `0` or `""` are valid values.** Use `??` instead.
- **Checking `x === NaN`.** It is always `false`. Use `Number.isNaN(x)`.
- **Adding numbers read from inputs or prompts.** They are strings, so `"2" + "3"` is `"23"`; convert with `Number()` first.
- **Chaining comparisons** like `1 < x < 10`. Write `x > 1 && x < 10`.
- **Writing `-2 ** 2`.** It is a SyntaxError; use `(-2) ** 2` or `-(2 ** 2)`.

## Key Takeaways

- `**` is exponentiation; `%` is remainder; `+` concatenates as soon as one operand is a string.
- `===` compares type and value without conversion; prefer it (and `!==`) over `==` and `!=`.
- There are eight falsy values: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`.
- `&&` and `||` short-circuit and return an operand, not always a boolean; `??` only replaces `null`/`undefined`.
- `?.` safely reads properties of possibly `null`/`undefined` values.
- The ternary operator is an expression for two-way choices; `if` is a statement for general branching.
- `switch` uses strict comparison and falls through without `break`.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between `==` and `===`?**
`==` (loose equality) converts both operands to a common type before comparing, so `3 == "3"` is `true`. `===` (strict equality) compares type and value with no conversion, so `3 === "3"` is `false`. Use `===` by default because its result is predictable.

**Q2. What do these lines print?**

```js
console.log("5" + 3);
console.log("5" - 3);
console.log("5" * "2");
console.log(true + 1);
```

`"53"`, `2`, `10`, `2`. `+` concatenates when either operand is a string; `-` and `*` only work on numbers, so the strings are converted; `true` converts to `1`.

**Q3. Which values are falsy in JavaScript?**
`false`, `0`, `-0`, `0n`, `""`, `null`, `undefined` and `NaN`. Every other value is truthy, including `"0"`, `"false"`, `[]` and `{}`. This matters in `if` conditions and with `&&`/`||`.

**Q4. What is the difference between `||` and `??`?**
`a || b` returns `b` whenever `a` is falsy, including `0`, `""` and `false`. `a ?? b` returns `b` only when `a` is `null` or `undefined`. For a setting such as `volume = input ?? 50`, `??` keeps a valid value of `0`, while `||` would wrongly replace it with 50.

**Q5. What happens if you forget `break` in a `switch`?**
Execution "falls through": after the matching case runs, the following cases run too, without checking their values, until a `break`, a `return` or the end of the `switch`. Fall-through is sometimes used on purpose to group cases (`case "sat": case "sun":`), but forgetting `break` is a common bug.

**Q6. What is the ternary operator, and when should you use it?**
`condition ? a : b` evaluates to `a` if the condition is truthy, otherwise `b`. Because it is an expression, it can be used directly in assignments, return statements and template literals. Use it for short two-way choices; use `if/else` for multiple branches or side effects, and avoid nesting ternaries.

### Mid-level (2–4 years)

**Q7. Why is `[] == ![]` true?**
`![]` is evaluated first: `[]` is truthy, so `![]` is `false`. The comparison becomes `[] == false`. Loose equality converts the boolean to a number (`0`), then converts the array to a primitive (`""`) and then to a number (`0`), so `0 == 0` is `true`. It is a good example of why `==` should be avoided.

**Q8. Why is `null >= 0` true while `null > 0` and `null == 0` are both false?**
Relational operators (`>`, `>=`) convert `null` to the number `0`, so `null > 0` is `0 > 0` (false) and `null >= 0` is `0 >= 0` (true). Equality `==` has a special rule instead: `null` only loosely equals `null` and `undefined`, so `null == 0` is false without any number conversion.

**Q9. What do `&&` and `||` actually return? Give a practical use and a pitfall.**
They return one of their operands: `||` returns the first truthy operand (or the last one), and `&&` returns the first falsy operand (or the last one). They are used for defaults (`name || "Guest"`) and conditional execution (`isLoggedIn && showMenu()`; in React, `{items.length && <List />}`). Pitfall: when `items.length` is `0`, that React expression renders `0`, because `&&` returns the falsy operand itself. Use `items.length > 0 && ...` instead.

**Q10. Why is `NaN === NaN` false, and how do you check for `NaN`?**
By the IEEE 754 standard, `NaN` is not equal to anything, including itself. Use `Number.isNaN(x)`, which returns `true` only for the actual `NaN` value. The older global `isNaN(x)` converts its argument first, so `isNaN("abc")` is `true` even though `"abc"` is a string; `Object.is(x, NaN)` also works.

**Q11. What does this print?**

```js
let x = 5;
let y = x++ + ++x;
console.log(x, y);
```

`7 12`. `x++` returns `5` and sets `x` to 6; then `++x` sets `x` to 7 and returns `7`; `5 + 7` is 12. Code like this is legal but unreadable, so avoid mixing increments into larger expressions.

**Q12. You see an `if/else if` chain with 15 branches that maps a product type to a tax rate. How would you refactor it?**
When each branch just maps a fixed key to a value, replace it with an object or `Map` lookup: `const rate = TAX_RATES[type] ?? DEFAULT_RATE;`. The data is then separate from the logic, adding a type is a one-line change, and the lookup is easier to test. When branches contain real logic, guard clauses (early returns) or a `switch` are better than deep nesting.

**Q13. What does this print, and why?**

```js
const input = "1";
switch (input) {
  case 1:
    console.log("number one");
    break;
  default:
    console.log("default");
}
```

It prints `default`. `switch` compares with strict equality (`===`), and the string `"1"` is not strictly equal to the number `1`. Convert first with `switch (Number(input))` if the value comes in as a string.

### Senior (5+ years)

**Q14. How would you enforce consistent equality and coercion rules across a large team, and is there any place where `==` is still acceptable?**
Make the rule mechanical so it never depends on code review. Turn on ESLint `eqeqeq` with the `{ "null": "ignore" }` option: it bans `==` and `!=` everywhere except `x == null`, which is the one idiomatic use (it matches both `null` and `undefined`). With TypeScript, add the typescript-eslint rules `prefer-nullish-coalescing` (flags `||` defaults that would swallow `0` and `""`) and `strict-boolean-expressions` (flags `if (count)` where `count` may be `0`).

The deeper fix is to convert at the boundaries: parse form values, query strings and API fields into the right types once (`Number(input)`, a schema validator) so the rest of the code never compares mixed types. Recommendation: `===` everywhere enforced by lint, `== null` as the single documented exception, and explicit conversion where data enters the app.

**Q15. A screen rendered blank instead of failing, and the root cause was hidden behind `order?.customer?.address?.city ?? ""`. What is your stance on optional chaining and `??` defaults in a large codebase?**
`?.` and `??` are for values that are **legitimately optional**. Used defensively on data that must exist, they turn a contract violation into silently wrong UI: the bug moves from "crash with a stack trace near the cause" to "blank field reported by a user weeks later". Each `?.` is a claim that `undefined` is a valid state that the code handles correctly.

Better: validate API responses at the boundary (a schema such as zod, or generated types plus runtime checks) so required fields are guaranteed afterwards, model truly optional fields as optional in the types, and keep `?.` for those. Where data is missing unexpectedly, fail loudly in development and report it in production (log or error monitoring) instead of rendering `""`. Recommendation: allow `?.`/`??` where absence is part of the domain, and make "required but missing" an error at the boundary.

**Q16. A reducer's `switch (action.type)` has grown to 40 cases owned by several teams, and a newly added action was silently ignored in production because it fell into `default: return state`. How do you make this safe?**
The silent `default` is the bug: it treats "unknown" and "intentionally unhandled" the same way. Options, in order of strength:

- **Compile-time exhaustiveness.** Model actions as a TypeScript discriminated union and end the switch with an assertion, so a new action type that is not handled fails the build:

  ```ts
  default: {
    const unhandled: never = action; // type error if any action type is missing above
    throw new Error(`Unhandled action: ${JSON.stringify(unhandled)}`);
  }
  ```

- **A handler map** (`const handlers: { [K in Action["type"]]: Handler<K> } = {...}`) where the type requires an entry for every action, which also lets each team own its handlers in separate files.
- **A runtime guard** in plain JavaScript: throw or log in development when `default` receives an unknown type.

Recommendation: discriminated unions plus an exhaustive `never` check (or a typed handler map) so the compiler, not production, finds the missing case. For flows with many states and transitions, use an explicit state machine instead of a growing switch.

## References

- [MDN – Expressions and operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators)
- [MDN – Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness)
- [MDN – Operator precedence](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence)
- [MDN – Nullish coalescing operator (??)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing)
- [MDN – switch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/switch)
- [MDN – Falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy)
- [MDN – Truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy)
- [MDN – Optional chaining (?.)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)
- [ESLint – eqeqeq](https://eslint.org/docs/latest/rules/eqeqeq)
- [TypeScript Handbook – Narrowing (exhaustiveness checking)](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking)
