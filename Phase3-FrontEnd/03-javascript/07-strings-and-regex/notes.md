# Strings, Regular Expressions and Intl

> JavaScript · Topic 7 · Demo: [script.js](script.js) · [regex-and-intl.js](regex-and-intl.js) · Run with `node script.js` and `node regex-and-intl.js` (no HTML page)

A string is a sequence of characters used to represent text. JavaScript strings are primitives, they are immutable, and they come with a large set of built-in methods for searching, extracting and transforming text. Template literals (backticks) make building strings with variables much easier than concatenation. This note covers the string basics first, then the two tools you reach for when plain string methods are not enough: **regular expressions** for pattern matching (with the `lastIndex` and catastrophic-backtracking traps that interviews love), and the **`Intl`** APIs for locale-aware numbers, dates, plurals, sorting and counting the characters a user actually sees.

## Creating strings

The `String` object is used to represent and manipulate a sequence of characters. Strings can be created as **primitives**, from string literals, or as **objects**, using the `String()` constructor:

```js
const string1 = "A string primitive";
const string2 = 'Also a string primitive';
const string3 = `Yet another string primitive`;

const string4 = new String("A String object");
```

String literals can be written with single quotes or double quotes, which are treated identically, or with the backtick character `` ` ``. Only backticks let you interpolate expressions (see [Template literals](#template-literals)).

### String primitive vs `String` object

| | Primitive (`"abc"`) | Object (`new String("abc")`) |
| --- | --- | --- |
| `typeof` | `"string"` | `"object"` |
| Compared with `===` | By value | By reference |
| `new String("a") === new String("a")` | | `false` (two different objects) |
| Truthiness of the empty string | `""` is falsy | `new String("")` is truthy (all objects are) |
| Use it? | Always | Practically never |

```js
console.log(typeof string1);              // → string
console.log(typeof string4);              // → object
console.log("a" === new String("a"));     // → false
console.log("a" == new String("a"));      // → true (the object is converted)
```

**How can a primitive have methods?** When you call `"abc".toUpperCase()`, JavaScript temporarily wraps the primitive in a `String` object (auto-boxing), calls the method, and throws the wrapper away. You get all the methods without ever creating string objects yourself.

> **Note:** `String(value)` *without* `new` is useful: it converts any value to a primitive string (`String(123)` gives `"123"`). Only `new String(...)` creates the unwanted object.

## Template literals

With template literals (backticks) you can avoid the concatenation operator, and improve the readability of your code, by using placeholders of the form `${expression}` to perform substitutions for embedded expressions:

```js
const a = 3, b = 5;
console.log(`${a} is less than ${b}`);   // → 3 is less than 5
console.log(a + " is less than " + b);   // same result with concatenation

// Any expression works inside ${ }
console.log(`Sum: ${a + b}`);                  // → Sum: 8
console.log(`${a < b ? "yes" : "no"}`);        // → yes
```

Template literals also keep line breaks, so multi-line strings need no `\n`:

```js
const html = `
<ul>
  <li>Item</li>
</ul>`;
```

## Escape sequences

Inside quotes, a backslash starts an escape sequence:

| Sequence | Meaning |
| --- | --- |
| `\n` | New line |
| `\t` | Tab |
| `\\` | Backslash |
| `\'` `\"` | Quote inside a string using the same quote |
| `` \` `` | Backtick inside a template literal |
| `A` / `\u{1F600}` | Unicode code point (`"A"` is `"A"`) |

```js
console.log('It\'s easy');   // → It's easy
console.log("Line1\nLine2"); // → Line1 (new line) Line2
```

## Strings are immutable

You can't change a character inside an existing string. Every string method returns a **new** string and leaves the original untouched.

```js
let t = "Hello";
t[0] = "J";         // silently ignored (TypeError in strict mode)
console.log(t);     // → Hello

t = "J" + t.slice(1);   // build a new string and reassign the variable
console.log(t);         // → Jello
```

## Length and accessing characters

```js
const s = "Hello";
console.log(s.length);      // → 5
console.log(s[0]);          // → H
console.log(s.charAt(1));   // → e
console.log(s.at(-1));      // → o   (negative index counts from the end, ES2022)
console.log(s[10]);         // → undefined
console.log(s.charAt(10));  // → ""  (empty string, not undefined)
console.log(s[-1]);         // → undefined (brackets don't support negative indexes)
```

Indexes start at 0, so the last character is at `length - 1`. `length` counts UTF-16 code units, not what the user sees as characters; see [Intl.Segmenter](#intlsegmenter-counting-what-the-user-sees).

## Searching in a string

| Method | Returns | Example (`s = "A string primitive"`) |
| --- | --- | --- |
| `indexOf(x)` | Index of the **first** occurrence, or `-1` | `s.indexOf("s")` → `2` |
| `lastIndexOf(x)` | Index of the **last** occurrence, or `-1` | `s.lastIndexOf("i")` → `15` |
| `includes(x)` | `true` / `false` | `s.includes("string")` → `true` |
| `startsWith(x)` | `true` / `false` | `s.startsWith("A ")` → `true` |
| `endsWith(x)` | `true` / `false` | `s.endsWith("ive")` → `true` |
| `search(regex)` | Index of the first regex match, or `-1` | `s.search(/p/)` → `9` |

All of these are **case-sensitive**. For a case-insensitive check, lower-case both sides first: `s.toLowerCase().includes("STRING".toLowerCase())`, or use a regex with the `i` flag.

## Extracting part of a string

```js
const str = "Yet another string primitive";
console.log(str.slice(0, 6));     // → Yet an   (from index 0 up to, not including, 6)
console.log(str.slice(4));        // → another string primitive
console.log(str.slice(-9));       // → primitive (negative = from the end)
console.log(str.substring(4, 11)); // → another
console.log(str);                 // unchanged: Yet another string primitive
```

### `slice` vs `substring`

| | `slice(start, end)` | `substring(start, end)` |
| --- | --- | --- |
| `end` | Excluded | Excluded |
| Negative arguments | Count from the end: `"Hello".slice(-3)` → `"llo"` | Treated as `0`: `"Hello".substring(-3)` → `"Hello"` |
| `start > end` | Returns `""`: `"Hello".slice(4, 1)` → `""` | Swaps them: `"Hello".substring(4, 1)` → `"ell"` |
| Recommended | Yes (same behaviour as `Array.prototype.slice`) | Fine, but less flexible |

> **Note:** `substr(start, length)` is a deprecated legacy method. Use `slice` instead.

## Changing case, trimming and padding

```js
console.log("Hello".toUpperCase());   // → HELLO
console.log("Hello".toLowerCase());   // → hello
console.log("  hi  ".trim());         // → "hi"   (both ends)
console.log("  hi  ".trimStart());    // → "hi  "
console.log("  hi  ".trimEnd());      // → "  hi"
console.log("5".padStart(3, "0"));   // → 005    (useful for times, IDs)
console.log("5".padEnd(3, "*"));     // → 5**
```

## Splitting, joining, replacing and repeating

```js
console.log("a-b-c".split("-"));        // → [ 'a', 'b', 'c' ]
console.log("abc".split(""));           // → [ 'a', 'b', 'c' ]
console.log(["a", "b", "c"].join("+")); // → a+b+c   (join is an array method)

console.log("a.b.c".replace(".", "-"));    // → a-b.c   (first match only)
console.log("a.b.c".replaceAll(".", "-")); // → a-b-c   (all matches, ES2021)
console.log("a.b.c".replace(/\./g, "-"));  // → a-b-c   (regex with the g flag)

console.log("ha".repeat(3));               // → hahaha
console.log("Hello".concat(" ", "World")); // → Hello World (same as using +)
```

`split` + `reverse` + `join` is the classic way to reverse a string:

```js
console.log("hello".split("").reverse().join("")); // → olleh
console.log([..."hello"].reverse().join(""));      // → olleh (spread handles all Unicode characters)
```

## Comparing strings

```js
console.log("abc" === "abc");            // → true
console.log("apple" < "banana");         // → true
console.log("apple" < "Banana");         // → false (uppercase letters sort before lowercase)
console.log("Apple".toLowerCase() === "APPLE".toLowerCase()); // → true (case-insensitive)

// localeCompare: -1 (before), 0 (equal), 1 (after), using language rules
console.log("abc".localeCompare("abd")); // → -1
console.log(["b", "a", "C"].sort());                              // → [ 'C', 'a', 'b' ]
console.log(["b", "a", "C"].sort((x, y) => x.localeCompare(y)));  // → [ 'a', 'b', 'C' ]
```

The same text can be stored in more than one way: `"é"` can be one code point (U+00E9) or `"e"` plus a combining accent (U+0301). They look identical but are not `===`. Call `normalize()` (NFC by default) on both sides before comparing text from different sources:

```js
console.log("café" === "café");                         // → false
console.log("café".normalize() === "café".normalize()); // → true
```

## Converting between strings and numbers

```js
console.log(String(123));        // → "123"
console.log((123).toString());   // → "123"
console.log(5 + "");             // → "5"

console.log(Number("42"));       // → 42
console.log(Number("42px"));     // → NaN   (the whole string must be numeric)
console.log(Number(""));         // → 0     (watch out)
console.log(parseInt("42px"));   // → 42    (reads digits until the first non-digit)
console.log(parseFloat("3.14abc")); // → 3.14
```

## Method cheat sheet

| Task | Method |
| --- | --- |
| Length | `str.length` (a property, not a method) |
| Character at index | `str[i]`, `str.charAt(i)`, `str.at(i)` |
| Find position | `indexOf`, `lastIndexOf`, `search` |
| Contains? | `includes`, `startsWith`, `endsWith` |
| Extract | `slice`, `substring` |
| Case | `toUpperCase`, `toLowerCase` |
| Whitespace | `trim`, `trimStart`, `trimEnd` |
| Pad | `padStart`, `padEnd` |
| To array | `split` |
| Replace | `replace`, `replaceAll` |
| Repeat / join | `repeat`, `concat`, `+`, template literals |
| Compare | `===`, `<`, `localeCompare`, `Intl.Collator` |
| Pattern matching | `test`, `match`, `matchAll`, `replace` with a regex |
| Unicode | `normalize`, `isWellFormed`, `toWellFormed` (ES2024), `Intl.Segmenter` |

## Demo walkthrough

```js
const string1 = "A string primitive";
const string3 = `Yet another string primitive`;

console.log(`String2 value : ${string1.indexOf('s')}`);          // → String2 value : 2
console.log(`String1 value at index 2: ${string1.charAt(3)}`);   // → String1 value at index 2: t
console.log(`String3 value : ${string3.slice(0,6)}`);            // → String3 value : Yet an
console.log(`String3 value after slice : ${string3}`);           // → ...: Yet another string primitive
```

- `indexOf('s')` returns the **first** occurrence: index 2 ("A", " ", "s").
- `charAt(3)` returns `"t"`.
- `slice(0, 6)` returns the characters at indexes 0 to 5, and the last line proves the original string did not change.

> **Note:** Two labels in the demo don't match the code: the first line says "String2" but reads `string1`, and the second says "index 2" but calls `charAt(3)`. The printed values are correct for the code as written.

## Regular expressions

A regular expression (regex) describes a **pattern** of text. You use it to validate input, extract parts of a string and do search-and-replace that plain `indexOf`/`replace` can't express. Every example in this section is in [regex-and-intl.js](regex-and-intl.js).

### Literal vs `RegExp` constructor

```js
const literal = /\d+/g;                    // literal: pattern known when you write the code
const built = new RegExp("\\d+", "g");     // constructor: pattern built at runtime
console.log(literal.source === built.source); // → true
```

| | Literal `/.../flags` | `new RegExp(string, flags)` |
| --- | --- | --- |
| When to use | Fixed patterns (almost always) | Patterns built from variables or user input |
| Backslashes | Written once: `/\d/` | Doubled, because the string parser eats one: `"\\d"` |
| Syntax errors | Reported when the script is parsed | Thrown at runtime (`SyntaxError: Invalid regular expression`) |
| User input inside | Not possible | Must be **escaped** first (see [Escaping user input](#escaping-user-input-regexpescape)) |

### Flags

| Flag | Name | Effect |
| --- | --- | --- |
| `g` | global | Find all matches; `match` returns every match, `replace` replaces all. Makes `test`/`exec` stateful through `lastIndex` |
| `i` | ignoreCase | `/hello/i` matches `"HELLO"` |
| `m` | multiline | `^` and `$` match at the start and end of every **line**, not only the whole string |
| `s` | dotAll (ES2018) | `.` also matches line breaks |
| `u` | unicode (ES2015) | Works on code points instead of UTF-16 units, enables `\p{...}` property escapes, stricter syntax |
| `y` | sticky | Matches only at exactly `lastIndex` (tokenisers and parsers) |
| `d` | hasIndices (ES2022) | Adds `indices` (start/end of every group) to match results |
| `v` | unicodeSets (ES2024) | Upgraded `u`: set operations in classes (`[\p{L}--[a-z]]`, `&&`), multi-character string properties such as `\p{RGI_Emoji}`. Can't be combined with `u` |

```js
console.log(/^.$/.test("😀"), /^.$/u.test("😀"));  // → false true (the emoji is two UTF-16 units)
console.log(/\p{Lu}/u.test("É"));                    // → true (any uppercase letter, not only A–Z)
console.log(/[\p{L}--[a-z]]/v.test("a"));            // → false (letters minus ASCII lower-case)
```

> **Note:** Use `u` (or `v` in modern code) for any pattern that touches user text. Without it, `.` and quantifiers can split an emoji in half, and `\p{...}` is a syntax error.

### Character classes, anchors and quantifiers

| Token | Matches |
| --- | --- |
| `.` | Any character except line breaks (unless `s`) |
| `\d` `\w` `\s` | Digit `[0-9]`, word char `[A-Za-z0-9_]`, whitespace. Upper-case versions (`\D`, `\W`, `\S`) negate |
| `[abc]` `[^abc]` `[a-z]` | One of, none of, a range |
| `\p{L}` `\p{Lu}` `\p{Script=Devanagari}` | Unicode property escapes (need `u` or `v`) |
| `^` `$` | Start / end of input (of each line with `m`) |
| `\b` | Word boundary |
| `*` `+` `?` `{n}` `{n,m}` | 0+, 1+, 0 or 1, exactly n, n to m (greedy: take as much as possible) |
| `*?` `+?` `{n,m}?` | Lazy versions: take as little as possible |
| `a\|b` | Alternation |

> **Note:** `\d`, `\w` and `\b` are ASCII-only even with the `u` flag. `/\bcafé\b/.test("un café noir")` is `false`, because `é` is not a `\w` character, so there is no word boundary after it. For international text use `\p{L}` and lookarounds instead of `\w` and `\b`.

### Groups and named groups

| Syntax | Meaning |
| --- | --- |
| `(...)` | Capturing group: `m[1]`, `$1` in a replacement, `\1` back-reference inside the pattern |
| `(?:...)` | Group without capturing (just for alternation or quantifiers) |
| `(?<name>...)` | Named group (ES2018): `m.groups.name`, `$<name>` in a replacement, `\k<name>` back-reference |

```js
const date = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const m = "Released 2026-11-18".match(date);
console.log(m[0], m[1], m.groups.month, m.index);              // → 2026-11-18 2026 11 9
console.log("2026-11-18".replace(date, "$<day>/$<month>/$<year>")); // → 18/11/2026
console.log(/(\w)\1/.test("hello"));                           // → true (the double "l")
```

Prefer named groups: `m.groups.year` still works when someone adds a group earlier in the pattern, while `m[1]` silently shifts. ES2025 also allows the same group name in different alternatives (`/(?<y>\d{4})-\d\d|\d\d\/(?<y>\d{4})/`); check support before relying on it.

### Lookahead and lookbehind

Lookarounds check what comes before or after a position **without consuming** it:

| Syntax | Name | Meaning |
| --- | --- | --- |
| `X(?=Y)` | Positive lookahead | `X` followed by `Y` |
| `X(?!Y)` | Negative lookahead | `X` not followed by `Y` |
| `(?<=Y)X` | Positive lookbehind (ES2018) | `X` preceded by `Y` |
| `(?<!Y)X` | Negative lookbehind (ES2018) | `X` not preceded by `Y` |

```js
// Several lookaheads at the start = "the whole string must satisfy all of these"
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;
console.log(strongPassword.test("CorrectHorse42"));                // → true

console.log("Total: $42, tax: $3, 7 items".match(/(?<=\$)\d+/g));  // → [ '42', '3' ]
console.log("1234567".replace(/\B(?=(\d{3})+(?!\d))/g, ","));      // → 1,234,567
```

> **Note:** Lookbehind has worked in every major engine since Safari 16.4 (2023). Before that, one lookbehind in a shared bundle crashed the whole script in Safari with a `SyntaxError`, a classic production incident. The thousands-separator regex is a good interview exercise, but in real code use `Intl.NumberFormat`.

### `test`, `exec`, `match`, `matchAll`, `replace`

| Method | Returns | With `g` |
| --- | --- | --- |
| `regex.test(str)` | `true` / `false` | Stateful: starts at `lastIndex` and moves it |
| `regex.exec(str)` | One match array (with `index`, `groups`) or `null` | Each call returns the next match |
| `str.match(regex)` | Without `g`: same as `exec`. No match: `null` | Array of all **full** matches, **no groups**, or `null` |
| `str.matchAll(regex)` | Iterator of match arrays with groups (ES2020) | **Required**: throws `TypeError` without `g` |
| `str.replace(regex, x)` | New string; `x` is a string or a function | Replaces all matches |
| `str.replaceAll(regex, x)` | New string | **Required**: throws `TypeError` without `g` |
| `str.split(regex)` | Array; capturing groups are included in the result | |
| `str.search(regex)` | Index of the first match or `-1` | Ignores `g` and `lastIndex` |

```js
const log = "GET /users 200 12ms\nPOST /login 401 30ms\nGET /orders 500 95ms";
const line = /(?<method>[A-Z]+) (?<path>\S+) (?<status>\d{3})/g;

console.log(log.match(line));        // → [ 'GET /users 200', 'POST /login 401', 'GET /orders 500' ] (no groups)
for (const { groups } of log.matchAll(line)) {
  console.log(groups.method, groups.path, groups.status); // → GET /users 200 ... (groups for every match)
}
```

**`replace` with a function.** The function is called once per match with `(match, p1, p2, ..., offset, input, groups)` and its return value is inserted. Use it whenever the replacement depends on the match:

```js
console.log("backgroundColor".replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())); // → background-color

const data = { name: "Asha", amount: "₹500" };
const tpl = "Hi {name}, you owe {amount}. {unknown}";
console.log(tpl.replace(/\{(\w+)\}/g, (match, key) => data[key] ?? match));
// → Hi Asha, you owe ₹500. {unknown}
```

In a replacement **string**, `$&` is the whole match, `$1`/`$<name>` are groups and `$$` is a literal `$`. A function avoids all of that escaping.

### The `lastIndex` gotcha with `/g`

A regex with the `g` (or `y`) flag remembers where its last match ended in `lastIndex`, and `test`/`exec` start from there. Reusing one global regex for several strings gives alternating results:

```js
const digits = /^\d+$/g;                                      // ❌ g on a validation regex
console.log(["123", "456", "789"].map((s) => digits.test(s))); // → [ true, false, true ]

const digitsFixed = /^\d+$/;                                   // ✅ no g
console.log(["123", "456", "789"].map((s) => digitsFixed.test(s))); // → [ true, true, true ]
```

After the first success `lastIndex` is 3, so the second test starts at index 3 of `"456"`, fails, and resets `lastIndex` to 0. Fixes: drop `g` for `test`, create the regex inside the function, or reset `re.lastIndex = 0`. `matchAll`, `match`, `replace` and `search` don't have this problem because they reset or copy the regex internally.

### Catastrophic backtracking (ReDoS)

JavaScript's regex engine is a **backtracking** engine: when a path fails, it goes back and tries every other way the pattern could have matched. With nested or overlapping quantifiers, the number of ways grows exponentially with the input length:

```js
const input = "a".repeat(24) + "!";
/^(a+)+$/.test(input);   // ❌ ~0.2 s, and twice as long for every extra "a"
/^a+$/.test(input);      // ✅ same language, microseconds
```

Because JavaScript is single-threaded, one such match blocks the whole page or the whole Node.js server. Sending crafted input to trigger it is called **ReDoS** (regular expression denial of service). Real incidents: Stack Overflow went down in 2016 because a whitespace-trimming regex hit a post with about 20,000 spaces, and Cloudflare's 2019 global outage was a WAF rule containing `.*(?:.*=.*)`.

How to avoid it:

- Avoid nested quantifiers over overlapping patterns: `(a+)+`, `(\w+\s?)*`, `(.*)*`, `(a|aa)+`.
- Be specific: `"[^"]*"` instead of `".*"`, and anchor patterns (`^...$`).
- Limit the input length **before** running the regex (an email is not 10,000 characters long).
- Lint for it (`eslint-plugin-regexp` flags super-linear backtracking) and never run user-supplied patterns on the server without a linear-time engine such as RE2.

### Escaping user input: `RegExp.escape()`

To search for text the user typed, you must escape characters that mean something in a regex, or `"1+1=2?"` turns into a pattern and a stray `(` throws a `SyntaxError`.

```js
const escapeRegExp = RegExp.escape ?? ((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const userInput = "1+1=2?";
console.log(new RegExp(userInput).test("1+1=2?"));               // → false (+ and ? are regex syntax)
console.log(new RegExp(escapeRegExp(userInput), "i").test("1+1=2?")); // → true
```

`RegExp.escape()` is part of **ES2025**. It shipped in Firefox 134, Safari 18.2, Chrome 136 and Node.js 24, so it is Baseline 2025 but missing from older browsers and Node 20/22. Until your support matrix allows it, use the one-line fallback above (it is the version MDN documents). The built-in also escapes a leading letter or digit as `\x..` (`RegExp.escape("foo")` is `"\\x66oo"`), so the result is safe even when concatenated after a back-reference like `\1`.

## Intl: locale-aware formatting

`Intl` is the built-in internationalisation API. It formats numbers, dates, lists and plurals, and compares and segments text, using the locale data (CLDR) shipped with the browser or Node.js. It replaces most of what libraries such as Moment.js or Numeral.js were used for, at zero bundle cost. All examples are in [regex-and-intl.js](regex-and-intl.js).

> **Note:** Creating a formatter is expensive (it resolves locale data); calling `format` is cheap. Create formatters once and reuse them, especially in render loops and table cells. `value.toLocaleString(...)` builds a new formatter on every call.

### `Intl.NumberFormat`

```js
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
console.log(inr.format(1234567.891));                                    // → ₹12,34,567.89 (lakh grouping)
console.log(new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(1234567.891)); // → 1.234.567,89 €
console.log(new Intl.NumberFormat("en", { notation: "compact" }).format(1234567));      // → 1.2M
console.log(new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(0.1234)); // → 12.3%
console.log(new Intl.NumberFormat("en", { style: "unit", unit: "kilometer-per-hour" }).format(80));   // → 80 km/h
```

`formatToParts()` returns the pieces (`currency`, `integer`, `group`, `decimal`, `fraction`) so you can style them separately, for example a smaller currency symbol, without parsing the formatted string.

### `Intl.DateTimeFormat`

A `Date` holds one instant in time (milliseconds since 1970 UTC). The **time zone and format are decided when you display it**:

```js
const instant = new Date(Date.UTC(2026, 10, 18, 9, 30));
console.log(new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(instant));
// → 18 November 2026
console.log(new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(instant));
// → Nov 18, 2026, 3:00 PM
console.log(Intl.DateTimeFormat().resolvedOptions().timeZone); // the user's IANA time zone, e.g. "Europe/London"
```

Without `timeZone`, the runtime's zone is used. That is why server-rendered dates often differ from the browser's (a React hydration mismatch): pass the user's zone explicitly on the server or format on the client. `formatRange(start, end)` gives `"Jan 1 – 5, 2026"`. `Temporal`, the modern replacement for `Date`, is shipping in browsers from 2025 onward; until it is Baseline, keep `Date` + `Intl.DateTimeFormat`.

### `Intl.RelativeTimeFormat`

```js
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
console.log(rtf.format(-1, "day"), rtf.format(3, "hour"), rtf.format(-2, "week"));
// → yesterday in 3 hours 2 weeks ago
```

It only formats: you compute the difference and pick the unit yourself. `numeric: "auto"` gives "yesterday" instead of "1 day ago".

### `Intl.PluralRules`

Plural rules differ by language: English has two cardinal categories (`one`, `other`), Arabic has six. `select(n)` returns the category and you map it to text:

```js
const cardinal = new Intl.PluralRules("en-US");
const itemLabel = (n) => `${n} ${cardinal.select(n) === "one" ? "item" : "items"}`;
console.log(itemLabel(0), itemLabel(1), itemLabel(2)); // → 0 items 1 item 2 items

const ordinal = new Intl.PluralRules("en-US", { type: "ordinal" });
const suffix = { one: "st", two: "nd", few: "rd", other: "th" };
console.log([1, 2, 3, 11, 22].map((n) => n + suffix[ordinal.select(n)]).join(" ")); // → 1st 2nd 3rd 11th 22nd
```

`n === 1 ? "item" : "items"` is wrong for many languages; translation libraries (ICU MessageFormat, i18next) use `PluralRules` underneath.

### `Intl.Collator`: sorting for humans

```js
const files = ["item10", "Item2", "item1", "éclair", "apple", "Zebra"];
console.log([...files].sort());
// → [ 'Item2', 'Zebra', 'apple', 'item1', 'item10', 'éclair' ] (code-unit order)

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
console.log([...files].sort(collator.compare));
// → [ 'apple', 'éclair', 'item1', 'Item2', 'item10', 'Zebra' ]
console.log(collator.compare("resume", "Résumé"));  // → 0 (equal at base sensitivity)
```

- `numeric: true` gives **natural sort** (`item2` before `item10`).
- `sensitivity: "base"` ignores case and accents, which is also what you want for case- and accent-insensitive search.
- Order is language-specific: `"ä"` sorts before `"z"` in German and after it in Swedish.
- Pass `collator.compare` to `sort`; it is much faster than calling `a.localeCompare(b, ...)` with options on every comparison.

### `Intl.Segmenter`: counting what the user sees

`length` counts UTF-16 code units; spreading (`[...str]`) counts code points. Neither counts **grapheme clusters**, the characters a user perceives. A skin-tone emoji is two code points; a family emoji is five code points joined by zero-width joiners; `"é"` is an `e` plus a combining accent.

```js
const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
const count = (s) => [...graphemes.segment(s)].length;

console.log("👍🏽".length, [..."👍🏽"].length, count("👍🏽"));          // → 4 2 1
console.log("👨‍👩‍👧".length, [..."👨‍👩‍👧"].length, count("👨‍👩‍👧"));       // → 8 5 1
console.log("é".length, count("é"));                  // → 2 1
```

Use it for character counters ("12/280"), truncation (`str.slice(0, n)` can cut an emoji in half and leave a broken `�`) and cursor movement. `granularity: "word"` splits words correctly even in languages without spaces (Japanese, Thai), and `isWordLike` filters out punctuation. `Intl.Segmenter` has been in every major engine since Firefox 125 (2024).

### Other `Intl` APIs

| API | Example |
| --- | --- |
| `Intl.ListFormat` | `["card", "UPI", "cash"]` → `"card, UPI, or cash"` |
| `Intl.DisplayNames` | `"IN"` → `"India"`, `"de"` → `"allemand"` in French |
| `Intl.DurationFormat` (2025) | `{ hours: 1, minutes: 5 }` → `"1 hr, 5 min"`; newer, check support |

## Common Mistakes

- **Trying to change a character with `str[i] = "x"`.** Strings are immutable; build a new string instead.
- **Forgetting that methods return a new string.** `name.trim();` on its own does nothing useful; write `name = name.trim();`.
- **Using `new String()`.** It creates an object that breaks `===` comparisons and is always truthy.
- **Checking `indexOf(x)` as a boolean.** `if (str.indexOf("A"))` is false when the match is at index 0 and true when not found (`-1`). Use `includes`.
- **Expecting `replace` with a string pattern to replace all matches.** It replaces only the first; use `replaceAll` or a `/g` regex.
- **Using quotes instead of backticks for interpolation.** `"Hi ${name}"` prints the literal text `${name}`.
- **Case-sensitive comparisons** of user input; normalise with `toLowerCase()` (or `localeCompare`/`Intl.Collator` with options).
- **Assuming `length` counts visible characters.** Many emoji take two or more UTF-16 code units; use `Intl.Segmenter` for user-facing counts and truncation.
- **Reusing a `/g` regex with `test` or `exec`** across different strings; `lastIndex` makes results alternate.
- **Building a regex from user input without escaping it**, which breaks on `+`, `?` or `(` and lets users inject patterns.
- **Writing `new RegExp("\d+")`.** The string parser drops the backslash and you get `/d+/`; write `"\\d+"`.
- **Nested quantifiers such as `(a+)+` or `(.*)*`** on untrusted input: catastrophic backtracking can freeze the page or server.
- **Creating an `Intl` formatter (or calling `toLocaleString`) inside a loop** instead of creating it once and reusing it.

## Key Takeaways

- Create strings with `'...'`, `"..."` or `` `...` ``; use backticks when you need `${}` interpolation or multiple lines.
- Use string primitives, never `new String()`; primitives get methods through auto-boxing.
- Strings are immutable: every method returns a new string.
- Prefer `slice` over `substring` (supports negative indexes) and avoid deprecated `substr`; `replace` with a string changes only the first match.
- Write regex literals for fixed patterns and `new RegExp` only for dynamic ones, escaping user input (`RegExp.escape`, ES2025, or the fallback).
- Use named groups, `matchAll` for all matches with groups, and `replace` with a function for computed replacements; keep `g` off validation regexes.
- Avoid nested quantifiers and limit input length: JavaScript regexes backtrack and can be exponential.
- Use `Intl` (created once, reused) for numbers, dates, plurals and sorting, and `Intl.Segmenter` to count or cut what the user sees.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between a string primitive and a `String` object?**
A primitive (`"abc"`) has `typeof` `"string"`, is compared by value and is what you should always use. `new String("abc")` creates an object: `typeof` is `"object"`, two such objects are never `===` equal, and even `new String("")` is truthy. Primitives can still call methods because JavaScript temporarily wraps them in a `String` object.

**Q2. What are template literals and why are they useful?**
Strings written with backticks that support `${expression}` interpolation and multi-line text. They replace long chains of `+` concatenation, so code such as `` `Hello ${name}, you have ${count} messages` `` is easier to read and less error-prone. Any JavaScript expression can go inside `${}`.

**Q3. What is the difference between `slice` and `substring`?**
Both extract characters from `start` up to (not including) `end`. `slice` accepts negative indexes, counting from the end (`"Hello".slice(-3)` is `"llo"`), and returns `""` if `start > end`. `substring` treats negative values as `0` and swaps the arguments if `start > end` (`"Hello".substring(4, 1)` is `"ell"`).

**Q4. Are strings mutable? What does this print?**

```js
let s = "cat";
s[0] = "b";
console.log(s);
```

It prints `cat`. Strings are immutable, so assigning to an index is silently ignored (or throws a TypeError in strict mode). To "change" a string you create a new one, for example `s = "b" + s.slice(1);`.

**Q5. How do you reverse a string?**
Convert it to an array, reverse the array and join it back: `str.split("").reverse().join("")`. Using `[...str]` instead of `split("")` is safer because spread splits by Unicode code points, so characters made of two UTF-16 units are not broken in half.

**Q6. How do you check whether a string contains another string?**
Use `str.includes(sub)`, which returns `true` or `false`. `startsWith` and `endsWith` check the beginning and end. The older `str.indexOf(sub) !== -1` also works, but `includes` is clearer. All are case-sensitive, so lower-case both strings for a case-insensitive check.

**Q7. When do you write a regex literal and when do you need `new RegExp()`?**
Use a literal (`/\d{4}/g`) when the pattern is fixed: it is checked when the script is parsed and needs no extra escaping. Use `new RegExp(pattern, flags)` only when the pattern is built at runtime, for example from a search box. Then remember two things: backslashes must be doubled inside the string (`"\\d"`), and any user text must be escaped (`RegExp.escape` or a fallback), otherwise characters like `+`, `?` and `(` are treated as regex syntax.

**Q8. What does the `g` flag change in `match` and `replace`?**
Without `g`, `str.match(re)` returns the first match with its groups and `index` (or `null`), and `replace` changes only the first match. With `g`, `match` returns an array of every full match **without** groups, and `replace` changes all matches. When you need all matches **and** their groups, use `str.matchAll(re)`, which requires the `g` flag.

### Mid-level (2–4 years)

**Q9. What is the difference between `replace` and `replaceAll`? What does `"a-b-c".replace("-", "+")` return?**
It returns `"a+b-c"`: with a string pattern, `replace` only replaces the first match. `replaceAll("-", "+")` replaces every match (`"a+b+c"`). Before ES2021 you used a regex with the global flag, `replace(/-/g, "+")`. Note that `replaceAll` with a regex throws a TypeError unless the regex has the `g` flag.

**Q10. Why does `"\u{1D11E}".length` return 2, and how do you count characters correctly?**
JavaScript strings are sequences of UTF-16 code units, and characters outside the Basic Multilingual Plane (such as U+1D11E, many emoji) are stored as two units (a surrogate pair). `length` counts code units, not visible characters. `[...str].length` counts code points, which is right for that character but still wrong for emoji with skin tones (`"👍🏽"` is 2 code points) or families joined with zero-width joiners (`"👨‍👩‍👧"` is 5). To count what the user sees, count grapheme clusters with `Intl.Segmenter` (see [Intl.Segmenter](#intlsegmenter-counting-what-the-user-sees)): `[...new Intl.Segmenter().segment(str)].length` gives 1 for each of them.

**Q11. Why is `new String("a") === new String("a")` false while `"a" === "a"` is true?**
Primitives are compared by value. Objects are compared by reference, and each `new String` call creates a separate object at a different memory location, so the references differ. This is one of the reasons the `String` constructor with `new` should not be used.

**Q12. Write a function that checks whether a string is a palindrome, ignoring case and non-alphanumeric characters.**

```js
function isPalindrome(str) {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean === [...clean].reverse().join("");
}
console.log(isPalindrome("A man, a plan, a canal: Panama")); // → true
console.log(isPalindrome("hello"));                          // → false
```

Normalise first (lower-case, remove punctuation and spaces), then compare with the reversed string. A two-pointer loop comparing characters from both ends avoids creating extra strings and is the answer to give if asked to optimise.

**Q13. How would you sort a list of names alphabetically so that "apple", "Banana" and "cherry" come out in that order?**
The default `sort()` compares UTF-16 code values, so all uppercase letters come before lowercase ones and you get `["Banana", "apple", "cherry"]`. Use `names.sort((a, b) => a.localeCompare(b))`, which follows language rules; `localeCompare(b, undefined, { sensitivity: "base" })` also ignores case and accents in the comparison. For large lists, create one `new Intl.Collator(undefined, { numeric: true })` and pass its `compare`, which is faster and also gives natural order for embedded numbers (`file2` before `file10`).

**Q14. Is building a long string with `+=` in a loop slow? What would you use instead?**
In old engines repeated `+=` created many intermediate strings, so collecting parts in an array and calling `join("")` was faster. Modern engines optimise concatenation internally (using rope structures), so `+=` is usually fine. For readability, prefer `array.map(...).join("")` when building a string from a list, and template literals for mixing text and values.

**Q15. A validation helper returns `true`, `false`, `true` for three valid inputs. The regex is `const re = /^[A-Z]{3}\d{4}$/g;`. What is wrong?**
The `g` flag makes `test` stateful: after a successful match it stores the end position in `re.lastIndex` and the next call starts searching there. On a new string that position is past the start, so the match fails and `lastIndex` resets to 0, which is why the results alternate. Remove the `g` flag (a validation regex never needs it), or create the regex inside the function, or set `re.lastIndex = 0` before each call. `str.match`, `replace` and `matchAll` are not affected because they manage `lastIndex` themselves.

**Q16. How would you show prices and dates to users in their own format?**
Use `Intl.NumberFormat` with `style: "currency"` and the currency of the amount (not of the user's locale), and `Intl.DateTimeFormat` with `dateStyle`/`timeStyle` and an explicit `timeZone` when it matters. Pass the user's locale (`navigator.language` or the app's language setting). Create each formatter once and reuse it, because construction is the expensive part. Never build formats by hand (`day + "/" + month`): ordering, separators, digit grouping (lakh vs thousand) and the currency symbol position all differ by locale.

### Senior (5+ years)

**Q17. A Node.js API's CPU jumps to 100% and every request times out. The profiler shows one call stuck in `RegExp.prototype.test` inside email validation. What happened, and how would you prevent it across the codebase?**
This is catastrophic backtracking, probably triggered by a long crafted input (ReDoS). A pattern like `^([a-zA-Z0-9]+\.?)+@` has a quantified group whose body can match the same characters in many ways, so a failing match tries exponentially many splits; since Node runs JavaScript on one thread, one request blocks all of them. Immediate fix: cap the input length before matching (RFC limits an address to 254 characters) and rewrite the pattern without nested overlapping quantifiers, or replace the regex with a simple structural check plus a confirmation email.

To prevent it team-wide: enable `eslint-plugin-regexp` (its `no-super-linear-backtracking` rule) in CI, add input-length limits at the API boundary (schema validation), never accept user-supplied patterns on the server unless they run in a linear-time engine such as RE2, and add a ReDoS item to the security review checklist. Recommendation: treat regexes on untrusted input like SQL, as an attack surface with lint enforcement and length limits.

**Q18. You are building a "highlight search terms" feature for a large product list, with users typing in many languages. What would you watch out for?**
Four things. First, **escaping**: build the pattern with `RegExp.escape(term)` (ES2025, with the MDN fallback for older browsers), or a term like `c++` throws. Second, **case and accent folding**: `i` handles case, but users expect `cafe` to match `café`; normalise both sides with `normalize("NFD")` and strip `\p{Diacritic}` with a `u` regex, keeping an index map back to the original text, or compare with `Intl.Collator` at `sensitivity: "base"`. Third, **Unicode**: use `u`/`v` flags and avoid `\b` and `\w`, which are ASCII-only. Fourth, **safety**: never inject the highlighted string with `innerHTML`; split the text into matched and unmatched parts and render them as text nodes or `<mark>` elements, otherwise product names become an XSS vector.

Recommendation: write one shared `highlight(text, query, locale)` utility that returns segments (`{ text, match }`), with unit tests for emoji, accents and regex metacharacters, and let every component render those segments.

**Q19. How would you design date and number formatting for a large app with many teams, several locales and server-side rendering?**
Centralise it. Provide one formatting module (or hook) that takes the user's locale and time zone from a single source of truth (user profile or request), caches `Intl` formatters by `locale + options`, and exposes semantic helpers such as `formatPrice(amount, currency)` and `formatDate(instant, "short")`. Ban ad-hoc `toLocaleString()` and hand-built date strings with a lint rule, so formats stay consistent and formatters aren't re-created in render loops.

For SSR, the server must format with the **user's** time zone and locale, not the server's, or the HTML won't match the client render (hydration errors, and dates off by a day around midnight). Store and transmit instants as UTC ISO strings and format only at the edge of the UI. Prefer built-in `Intl` over large libraries (Moment.js is in maintenance mode); small helpers such as date-fns are fine for arithmetic, and `Temporal` is the long-term answer once it is Baseline. Recommendation: one cached `Intl`-based formatting layer, explicit time zones everywhere, and no formatting logic inside components.

**Q20. A product requirement says "names may be at most 30 characters". How do you implement and enforce that consistently in the UI, the API and the database?**
First agree on what a "character" is, because there are four answers: UTF-16 code units (`length`, also what `maxlength` on an input counts), code points (`[...s].length`), grapheme clusters (`Intl.Segmenter`, what users see) and bytes (`new TextEncoder().encode(s).length`, what many storage limits are really about). A family emoji is 8 units, 5 code points, 1 grapheme and 18 UTF-8 bytes.

Recommendation: count graphemes for the user-facing rule and the live counter, truncate on grapheme boundaries (never `slice`, which can leave a lone surrogate; `isWellFormed()` detects that), and enforce a generous **byte or code-point** limit in the API and the database column, which is what storage actually needs. Document the definition in the API contract so the web, mobile and backend teams count the same way.

## References

- [MDN – String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)
- [MDN – Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
- [MDN – String.prototype.slice()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice)
- [MDN – String.prototype.replaceAll()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll)
- [MDN – String.prototype.localeCompare()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare)
- [MDN – Regular expressions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions)
- [MDN – RegExp.prototype.lastIndex](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/lastIndex)
- [MDN – String.prototype.matchAll()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll)
- [MDN – RegExp.escape()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/escape)
- [OWASP – Regular expression Denial of Service (ReDoS)](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
- [Cloudflare – Details of the Cloudflare outage on July 2, 2019](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/)
- [MDN – Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [MDN – Intl.Collator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator)
- [MDN – Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
