// Regular expressions and Intl: run with `node regex-and-intl.js`
// Every section prints what the "Regular expressions" and "Intl" sections of notes.md describe.

const section = (title) => console.log(`\n--- ${title} ---`);

// 1. Literal vs RegExp constructor
section("Literal vs RegExp constructor");
const literal = /\d+/g;
const built = new RegExp("\\d+", "g"); // the backslash must be doubled inside a string
console.log(literal.source === built.source); // true
console.log("Order 66 shipped 3 items".match(built)); // [ '66', '3' ]

// 2. Flags
section("Flags");
console.log(/hello/i.test("HELLO")); // true  (i: ignore case)
console.log("a\nb".match(/^b$/) ?? "no match without m"); // ^ and $ are whole-string anchors
console.log("a\nb".match(/^b$/m)[0]); // b      (m: ^ and $ match at line breaks)
console.log(/a.b/.test("a\nb"), /a.b/s.test("a\nb")); // false true  (s: dot matches newlines)
console.log(/^.$/.test("😀"), /^.$/u.test("😀")); // false true  (u: works on code points)
console.log(/\p{Lu}/u.test("É")); // true   (Unicode property escape needs u or v)
console.log(/[\p{L}--[a-z]]/v.test("a"), /[\p{L}--[a-z]]/v.test("É")); // false true (v: set subtraction)
console.log(/(?<year>\d{4})/d.exec("Since 2024").indices.groups.year); // [ 6, 10 ]  (d: match indices)
const sticky = /\d+/y;
sticky.lastIndex = 3;
console.log(sticky.exec("ab 42")?.[0], sticky.exec("ab 42")); // 42 null (y: only matches at lastIndex)

// 3. Groups, named groups and back-references
section("Groups");
const date = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const m = "Released 2026-11-18".match(date);
console.log(m[0], m[1], m.groups.month, m.index); // 2026-11-18 2026 11 9
console.log("2026-11-18".replace(date, "$<day>/$<month>/$<year>")); // 18/11/2026
console.log(/(\w)\1/.test("hello"), /(?<ch>\w)\k<ch>/.test("world")); // true false (back-references)
console.log("a1b2".replace(/(?:[a-z])(\d)/g, "[$1]")); // [1][2]  (?: ) groups without capturing

// 4. Lookahead and lookbehind
section("Lookaround");
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;
console.log(strongPassword.test("correcthorse"), strongPassword.test("CorrectHorse42")); // false true
console.log("Total: $42, tax: $3, 7 items".match(/(?<=\$)\d+/g)); // [ '42', '3' ]
console.log("Total: $42, tax: $3, 7 items".match(/(?<!\$)\b\d+/g)); // [ '7' ]
console.log("1234567".replace(/\B(?=(\d{3})+(?!\d))/g, ",")); // 1,234,567

// 5. test / exec / match / matchAll / replace with a function
section("Methods");
const log = "GET /users 200 12ms\nPOST /login 401 30ms\nGET /orders 500 95ms";
const line = /(?<method>[A-Z]+) (?<path>\S+) (?<status>\d{3})/g;
console.log(log.match(line)); // all full matches, no groups (g flag)
for (const { groups } of log.matchAll(line)) {
  console.log(groups.method, groups.path, groups.status);
}
console.log(log.match(/(?<status>5\d\d)/).groups.status); // 500 (no g: first match with groups)
console.log("backgroundColor".replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())); // background-color
const data = { name: "Asha", amount: "₹500" };
console.log("Hi {name}, you owe {amount}. {unknown}".replace(/\{(\w+)\}/g, (match, key) => data[key] ?? match));
console.log("a, b;c".split(/[,;]\s*/)); // [ 'a', 'b', 'c' ]

// 6. The lastIndex gotcha with /g
section("lastIndex gotcha");
const digits = /^\d+$/g; // the g flag is the bug
console.log(["123", "456", "789"].map((s) => digits.test(s))); // [ true, false, true ]
const digitsFixed = /^\d+$/;
console.log(["123", "456", "789"].map((s) => digitsFixed.test(s))); // [ true, true, true ]

// 7. Catastrophic backtracking (ReDoS): time doubles with every extra character
section("Catastrophic backtracking");
for (const n of [18, 20, 22, 24]) {
  const input = "a".repeat(n) + "!";
  let start = performance.now();
  /^(a+)+$/.test(input); // nested quantifier: exponential on a failing match
  const bad = performance.now() - start;
  start = performance.now();
  /^a+$/.test(input); // same language, linear
  const good = performance.now() - start;
  console.log(`${n} chars: nested ${bad.toFixed(1)} ms, flat ${good.toFixed(3)} ms`);
}

// 8. Escaping user input: RegExp.escape (ES2025, Node 24+) with a fallback for older runtimes
section("Escaping user input");
const escapeRegExp =
  typeof RegExp.escape === "function"
    ? RegExp.escape
    : (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
console.log("RegExp.escape available:", typeof RegExp.escape === "function");
const userInput = "1+1=2?";
console.log(new RegExp(userInput).test("1+1=2?")); // false: + and ? are treated as regex syntax
console.log(new RegExp(escapeRegExp(userInput)).test("1+1=2?")); // true

// 9. Intl
section("Intl.NumberFormat");
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
console.log(inr.format(1234567.891)); // ₹12,34,567.89 (lakh grouping)
console.log(new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(1234567.891)); // 1.234.567,89 €
console.log(new Intl.NumberFormat("en", { notation: "compact" }).format(1234567)); // 1.2M
console.log(new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(0.1234)); // 12.3%
console.log(new Intl.NumberFormat("en", { style: "unit", unit: "kilometer-per-hour" }).format(80)); // 80 km/h
console.log(inr.formatToParts(1500).map((p) => `${p.type}:${p.value}`).join(" | "));

section("Intl.DateTimeFormat");
const instant = new Date(Date.UTC(2026, 10, 18, 9, 30)); // one moment in time
console.log(new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(instant)); // 18 November 2026
console.log(new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(instant)); // Nov 18, 2026, 3:00 PM
console.log(new Intl.DateTimeFormat("ja-JP", { dateStyle: "full", timeZone: "Asia/Tokyo" }).format(instant));
console.log("This machine's time zone:", Intl.DateTimeFormat().resolvedOptions().timeZone);

section("Intl.RelativeTimeFormat");
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
console.log(rtf.format(-1, "day"), "|", rtf.format(3, "hour"), "|", rtf.format(-2, "week")); // yesterday | in 3 hours | 2 weeks ago

section("Intl.PluralRules");
const cardinal = new Intl.PluralRules("en-US");
const itemLabel = (n) => `${n} ${cardinal.select(n) === "one" ? "item" : "items"}`;
console.log(itemLabel(0), "|", itemLabel(1), "|", itemLabel(2)); // 0 items | 1 item | 2 items
const ordinal = new Intl.PluralRules("en-US", { type: "ordinal" });
const suffix = { one: "st", two: "nd", few: "rd", other: "th" };
console.log([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map((n) => n + suffix[ordinal.select(n)]).join(" "));
console.log(new Intl.PluralRules("ar").select(3)); // few (Arabic has six plural categories)

section("Intl.Collator");
const files = ["item10", "Item2", "item1", "éclair", "apple", "Zebra"];
console.log([...files].sort()); // code-unit order: uppercase first, é last, item10 before item2
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
console.log([...files].sort(collator.compare)); // [ 'apple', 'éclair', 'item1', 'Item2', 'item10', 'Zebra' ]
console.log(collator.compare("resume", "Résumé")); // 0 (base sensitivity ignores case and accents)
console.log(new Intl.Collator("de").compare("ä", "z"), new Intl.Collator("sv").compare("ä", "z")); // -1 1

section("Intl.Segmenter: counting what the user sees");
const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
for (const s of ["hello", "\u{1D11E}", "é", "👍🏽", "👨‍👩‍👧"]) {
  console.log(JSON.stringify(s), "length:", s.length, "code points:", [...s].length, "graphemes:", [...graphemes.segment(s)].length);
}
const words = new Intl.Segmenter("en", { granularity: "word" });
console.log([...words.segment("Hello, world! It's 2026.")].filter((w) => w.isWordLike).map((w) => w.segment));
const truncate = (text, max) => {
  const parts = [...graphemes.segment(text)].map((g) => g.segment);
  return parts.length <= max ? text : parts.slice(0, max).join("") + "…";
};
console.log("👨‍👩‍👧👨‍👩‍👧".slice(0, 3), "|", truncate("👨‍👩‍👧👨‍👩‍👧", 1)); // slice cuts the family apart; truncate keeps it whole
