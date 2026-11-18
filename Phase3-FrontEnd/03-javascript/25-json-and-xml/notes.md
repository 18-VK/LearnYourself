# Parsing XML and JSON in JavaScript

> JavaScript · Topic 25 · Demo: [index.html](index.html) · [script.js](script.js) · Run with `node script.js` after `npm install xml2js xmldom` (the HTML page stops at `require`)

APIs and config files send data as text, usually in JSON and sometimes in XML. Before you can use that data you have to **parse** it: turn the text into objects your code can read. This page covers `DOMParser` for XML in the browser, the `xml2js` and `xmldom` libraries for XML in Node.js, `JSON.parse()`/`JSON.stringify()` for JSON, and how to loop over the resulting object.

> **Note:** The active code in `script.js` uses `require('xml2js')` and `require('xmldom')`, which only exist in **Node.js**. Opening `index.html` in a browser stops at `ReferenceError: require is not defined`. Run it from the folder with `npm install xml2js xmldom` and then `node script.js`. The `DOMParser` block (commented out) is the browser-only version.

## XML vs JSON

| | XML | JSON |
|---|---|---|
| Looks like | Tags: `<age>30</age>` | Key/value pairs: `"age": 30` |
| Data types | Everything is text | String, number, boolean, null, object, array |
| Attributes | Yes (`<person id="7">`) | No (just more keys) |
| Comments | Yes | No |
| Size | Larger (closing tags) | Smaller |
| Parse in the browser | `DOMParser` | `JSON.parse()` (built in) |
| Typical use today | SOAP services, RSS feeds, office documents, SVG, config files | REST APIs, config files, browser storage |

## Parsing XML in the Browser: DOMParser

Link: https://developer.mozilla.org/en-US/docs/Web/API/DOMParser

The `DOMParser` interface provides the ability to parse XML or HTML source code from a string into a DOM `Document`. Once parsed, you navigate it with the same DOM methods you already use on web pages (`getElementsByTagName`, `querySelector`, `textContent`, ...).

```js
const parser = new DOMParser();
const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
```

The second argument is the MIME type, which decides how the string is parsed: `'text/xml'` or `'application/xml'` for XML, `'text/html'` for HTML, `'image/svg+xml'` for SVG.

### The Demo's DOMParser Code

The commented-out block in `script.js`, using the `XmlData` string (a `<root>` with several `<person>` and two `<book>` elements):

```js
const ObjDOM = new DOMParser();
let ParsedObj = ObjDOM.parseFromString(XmlData, 'text/xml');
console.log(typeof ParsedObj);               // object  (an XMLDocument)

ParsedObj.createElement("Temp");             // creates a <Temp> element (not added to the document)

let Ele_Book = ParsedObj.getElementsByTagName('book');   // HTMLCollection of the 2 <book> elements
console.log(Ele_Book[Ele_Book.length - 1].firstElementChild);
// <title>The Adventure Begins</title>       (first child element of the last <book>)
```

### Turning XML Into Plain Objects

Usually you want an array of normal objects, not DOM nodes. XML content is always text, so convert numbers yourself:

```js
const xmlDoc = new DOMParser().parseFromString(XmlData, 'text/xml');

const people = [...xmlDoc.querySelectorAll('person')].map((p) => ({
    name: p.querySelector('name').textContent,
    age: Number(p.querySelector('age').textContent),     // "30" -> 30
    email: p.querySelector('email').textContent,
}));

console.log(people.length);   // 6
console.log(people[2]);       // { name: 'Jane Smith', age: 25, email: 'jane.smith@example.com' }

// Attributes: <person id="7"> -> p.getAttribute('id')  (returns a string, or null if missing)
```

> **Note:** Tag names in XML are **case-sensitive**: `querySelector('Name')` will not find `<name>`.

### Detecting Invalid XML

`DOMParser` does **not** throw on bad XML. It returns a document that contains a `<parsererror>` element instead, so you must check for it:

```js
function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new SyntaxError('Invalid XML');
    }
    return doc;
}

parseXml('<root><item>1</item></root>');   // OK
parseXml('<root><item>1</root>');          // SyntaxError: Invalid XML
```

To turn a document back into a string, use `new XMLSerializer().serializeToString(doc)`.

## Parsing XML in Node.js

A lot of browser functionality, like DOM manipulation, `DOMParser` or XHR, is not available natively in Node.js, because accessing a DOM is not a typical server task. You have to use an external library for that.

### xml2js

Link: https://www.npmjs.com/package/xml2js

The `xml2js` library converts XML into a plain JavaScript object, so you can access the data with normal property access instead of DOM methods. Its `parseString(xml, callback)` function takes a Node-style callback `(err, result)`.

```js
const ObjXML2JS = require('xml2js');

ObjXML2JS.parseString(XmlData, (err, result) => {
    if (err)
        console.log(err);
    else
        console.log(result);
});
```

Output for the demo data (shortened):

```js
// {
//   root: {
//     person: [
//       { name: [ 'John Doe' ],   age: [ '30' ], email: [ 'john.doe@example.com' ] },
//       { name: [ 'John Doe' ],   age: [ '30' ], email: [ 'john.doe@example.com' ] },
//       { name: [ 'Jane Smith' ], age: [ '25' ], email: [ 'jane.smith@example.com' ] },
//       ... 6 person objects in total
//     ],
//     book: [
//       { title: [ 'The Adventure Begins' ], author: [ 'Robert Johnson' ], year: [ '2022' ] },
//       { title: [ 'The Adventure Begins' ], author: [ 'Robert Johnson' ], year: [ '2022' ] }
//     ]
//   }
// }

// Reading a value: result.root.person[2].name[0]   -> 'Jane Smith'
```

Things to know about this output:

- **Every child element becomes an array** by default, even when there is only one (`name: [ 'John Doe' ]`). Pass `{ explicitArray: false }` as the second argument to get single values as plain strings.
- **All values are strings** (`'30'`, `'2022'`).
- Elements with the same name are **grouped**: all `person` elements end up in one array and all `book` elements in another, so the original order between `<person>` and `<book>` is lost.
- Attributes go into a `$` property (`{ $: { id: '7' }, name: ... }`), unless you pass `{ mergeAttrs: true }`.
- Malformed XML calls the callback with an `err` (e.g. `Unclosed root tag`).

> **Note:** The original note said `parseString` parses "asynchronously". It uses a callback, but by default xml2js calls that callback **synchronously**, before `parseString` returns (there is an `async: true` option to change this). For `async`/`await` code, xml2js also has `parseStringPromise(xml)`, which returns a promise.

### xmldom

`xmldom` gives Node.js a `DOMParser` with the same API as the browser, so code written for the browser works with small changes:

```js
const ObjXMLDOM = require('xmldom').DOMParser;
var parser = new ObjXMLDOM();
var document = parser.parseFromString(XmlData, 'text/xml');
console.log(document.getElementsByTagName('book')[1].textContent);
// "\n  The Adventure Begins\n  Robert Johnson\n  2022\n"
```

`textContent` of an element joins the text of **all** its descendants, including the whitespace and line breaks between tags. Read the individual child (`book.getElementsByTagName('title')[0].textContent`) and `.trim()` the result when you need a clean value.

> **Note:** The unscoped `xmldom` package used here is no longer maintained and `npm audit` reports several critical security advisories for it. New projects should use the maintained fork `@xmldom/xmldom` (`const { DOMParser } = require('@xmldom/xmldom');`), which has the same API.

## Parsing JSON: JSON.parse()

The `JSON.parse()` method parses a string written in JSON format and returns the corresponding JavaScript value.

```js
JSON.parse(text)
JSON.parse(text, reviver)
```

Parameters:

- **`text`** (required): a string written in JSON format.
- **`reviver`** (optional): a function used to transform the result. It is called for each key/value pair, and whatever it returns is used as the new value.

Return value: the JavaScript value described by the JSON text. That is usually an object, but it can also be an array, string, number, boolean or `null` (`JSON.parse('42')` returns `42`).

The demo:

```js
let JSONData = `
  {
    "name": "Adeel Solangi",
    "language": "Sindhi",
    "id": "V59OF92YF627HFY0",
    "bio": "Donec lobortis eleifend condimentum. ...",
    "version": 6.1
  }`;

let JOSNObj = JSON.parse(JSONData);        // string -> object
console.log(JSON.stringify(JOSNObj));      // object -> string (compact, one line)
// {"name":"Adeel Solangi","language":"Sindhi","id":"V59OF92YF627HFY0","bio":"Donec lobortis ...","version":6.1}
console.log(JOSNObj);                      // the object itself
```

### JSON Syntax Rules

JSON looks like a JavaScript object literal but is stricter. `JSON.parse()` throws a `SyntaxError` if any rule is broken:

| Valid JSON | Invalid JSON |
|---|---|
| `{"name": "Aman"}` | `{name: "Aman"}` (keys must be in double quotes) |
| `{"name": "Aman"}` | `{'name': 'Aman'}` (single quotes not allowed) |
| `{"a": 1, "b": 2}` | `{"a": 1, "b": 2,}` (no trailing commas) |
| `{"value": null}` | `{"value": undefined}` (no `undefined`, functions, `NaN`, `Infinity`) |
| — | Comments of any kind |

Always wrap `JSON.parse()` on data you did not create yourself in `try`/`catch`:

```js
function safeParse(text, fallback = null) {
    try {
        return JSON.parse(text);
    } catch (err) {
        console.error('Invalid JSON:', err.message);
        return fallback;
    }
}

safeParse('{"ok": true}');   // { ok: true }
safeParse("{'ok': true}");   // logs "Invalid JSON: ..." and returns null
```

### The reviver Function

The reviver runs for every key, from the innermost values outwards, and finally once for the whole result with the key `""`. **Its return value replaces the value**, and returning `undefined` deletes the property.

The demo has this reviver commented out:

```js
let JOSNObj = JSON.parse(JSONData, (key, value) => {
    console.log(key + " : " + value);
});
// name : Adeel Solangi
// language : Sindhi
// id : V59OF92YF627HFY0
// bio : Donec lobortis ...
// version : 6.1
//  : [object Object]          <- the final call, for the root (key is "")
console.log(JOSNObj);           // undefined
```

It logs every pair, but because it returns nothing, every property is deleted and the final result is `undefined`. A reviver must `return value` for anything it does not change. A typical use is converting date strings back into `Date` objects:

```js
const text = '{"title":"Meeting","when":"2024-05-01T10:00:00.000Z"}';

const meeting = JSON.parse(text, (key, value) => {
    if (key === 'when') return new Date(value);
    return value;                       // keep everything else unchanged
});

console.log(meeting.when instanceof Date);   // true
console.log(meeting.when.getUTCFullYear());  // 2024
```

## JSON.stringify()

`JSON.stringify(value, replacer, space)` is the opposite of `JSON.parse()`: it turns a value into a JSON string, for example to send it in a `fetch` body or save it in `localStorage`.

```js
const user = { name: 'Aman', age: 30, tags: ['js', 'node'] };

JSON.stringify(user);                     // '{"name":"Aman","age":30,"tags":["js","node"]}'
JSON.stringify(user, null, 2);            // pretty-printed with 2-space indentation
JSON.stringify(user, ['name', 'age']);    // '{"name":"Aman","age":30}'  (only these keys)
```

What does not survive the round trip:

| Value | In an object | In an array |
|---|---|---|
| `undefined`, functions, symbols | Property is dropped | Becomes `null` |
| `NaN`, `Infinity` | Becomes `null` | Becomes `null` |
| `Date` | Becomes an ISO string (and stays a string after parsing) | Same |
| `Map`, `Set` | Becomes `{}` | Same |
| `BigInt` | Throws `TypeError` | Throws `TypeError` |

### JSON.parse() vs response.json()

| | `JSON.parse(text)` | `response.json()` (Fetch API) |
|---|---|---|
| Input | A string you already have | The body of a `fetch` `Response` |
| Returns | The value, synchronously | A **promise** of the value |
| Invalid JSON | Throws `SyntaxError` | Rejects with `SyntaxError` |
| Supports a reviver | Yes | No (use `JSON.parse(await response.text(), reviver)`) |

## How to Iterate Over a JavaScript Object

Link: https://www.geeksforgeeks.org/how-to-iterate-over-a-javascript-object/

The demo uses `for...in` with a `hasOwnProperty` check:

```js
for (let key in JOSNObj) {
    if (JOSNObj.hasOwnProperty(key)) {
        console.log(key + " : " + JOSNObj[key]);
    }
}
// name : Adeel Solangi
// language : Sindhi
// id : V59OF92YF627HFY0
// bio : Donec lobortis ...
// version : 6.1
```

`for...in` also visits enumerable properties **inherited** from the prototype, which is why the check is needed. Objects from `JSON.parse()` inherit only from `Object.prototype`, whose properties are not enumerable, so here the check changes nothing; it is still a good habit for objects you did not create. The modern options:

| Method | Gives you | Includes inherited keys? |
|---|---|---|
| `for (const key in obj)` | Each key | Yes (filter with `Object.hasOwn(obj, key)`) |
| `Object.keys(obj)` | Array of keys | No |
| `Object.values(obj)` | Array of values | No |
| `Object.entries(obj)` | Array of `[key, value]` pairs | No |

```js
for (const [key, value] of Object.entries(JOSNObj)) {
    console.log(`${key} : ${value}`);
}

Object.hasOwn(JOSNObj, 'name');   // true  (modern replacement for obj.hasOwnProperty('name'))
```

> **Note:** Do not use `for...in` on arrays; it gives string indexes and may include extra properties. Use `for...of`, `forEach` or `map`.

## Common Mistakes

- **Running `require` code in the browser.** `require` is Node.js only; in the browser use `DOMParser` (or a bundler for npm packages).
- **Expecting `DOMParser` to throw on bad XML.** It returns a document with a `<parsererror>` element; check for it.
- **Forgetting that XML values are strings.** `'30' + 1` is `'301'`; convert with `Number()`.
- **Using `textContent` of a parent element** and getting all the child text plus whitespace in one string.
- **Calling `JSON.parse()` on something that is already an object.** It is converted to the string `"[object Object]"` first, which throws `SyntaxError`.
- **Writing JSON like a JS object**: single quotes, unquoted keys, trailing commas or comments.
- **A reviver that does not return a value**, which deletes every property (the demo's commented-out version returns `undefined`).
- **Expecting `JSON.stringify()` to keep `Date`, `Map`, `Set` or `undefined` values.**
- **Not wrapping `JSON.parse()` in `try`/`catch`** when the text comes from a user, a file or a server.

## Key Takeaways

- Parsing turns text (XML or JSON) into objects your code can use; serializing (`JSON.stringify`, `XMLSerializer`) turns them back into text.
- In the browser, `DOMParser.parseFromString(text, 'text/xml')` gives a DOM document; read it with DOM methods.
- Node.js has no DOM: use `xml2js` (XML to plain object) or an `xmldom` package (`DOMParser` API); prefer the maintained `@xmldom/xmldom`.
- `JSON.parse(text, reviver)` returns any JSON value and throws `SyntaxError` on invalid input; a reviver must return the value.
- JSON is stricter than JS object syntax: double-quoted keys and strings, no trailing commas, no comments, no `undefined`.
- Iterate objects with `Object.keys/values/entries`; with `for...in`, filter inherited keys with `Object.hasOwn()`.

## Interview Questions

### Junior (0–1 year)

**Q1. What is JSON, and how is it different from a JavaScript object?**
JSON (JavaScript Object Notation) is a text format for exchanging data, based on JavaScript's object syntax. A JavaScript object is a value in memory; JSON is a string. JSON is stricter: keys and strings must use double quotes, and it cannot contain functions, `undefined`, comments or trailing commas. You convert between them with `JSON.parse()` and `JSON.stringify()`.

**Q2. What do `JSON.parse()` and `JSON.stringify()` do?**
`JSON.parse(text)` converts a JSON string into a JavaScript value (object, array, string, number, boolean or `null`). `JSON.stringify(value)` converts a value into a JSON string, for example to send it in a request body or store it in `localStorage`. `parse` accepts an optional reviver function; `stringify` accepts an optional replacer and an indentation (`space`) argument for pretty-printing.

**Q3. How do you handle invalid JSON safely?**
`JSON.parse()` throws a `SyntaxError` when the text is not valid JSON, so wrap it in `try`/`catch` and fall back to a default value or show an error. This matters for any text you did not create: API responses, files, `localStorage`, user input.

**Q4. How do you parse an XML string in the browser and read a value from it?**
Use `new DOMParser().parseFromString(xmlString, 'text/xml')`, which returns an `XMLDocument`. Then use DOM methods: `doc.getElementsByTagName('name')[0].textContent` or `doc.querySelector('person name').textContent`. Remember the values are strings, and tag names are case-sensitive.

**Q5. What happens to `undefined`, functions and `Date` objects in `JSON.stringify()`?**
Properties whose value is `undefined`, a function or a symbol are left out of objects (and become `null` inside arrays). `NaN` and `Infinity` become `null`. A `Date` becomes an ISO string through its `toJSON()` method, and after `JSON.parse()` it is still a string, not a `Date`, unless you convert it with a reviver.

### Mid-level (2–4 years)

**Q6. `DOMParser` never throws. How do you detect that the XML was invalid?**
On a parse failure, `parseFromString` returns a document containing a `<parsererror>` element (where it appears differs between browsers). Check `doc.getElementsByTagName('parsererror').length > 0` (or `doc.querySelector('parsererror')`) right after parsing and throw your own error if it is found. Skipping this check usually leads to confusing `null` errors later, when `querySelector` finds nothing.

**Q7. What is the reviver in `JSON.parse()`? What happens if it returns nothing?**
The reviver is a function `(key, value) => newValue` called for every property, innermost first, and finally for the root with the key `""`. Whatever it returns replaces the value; returning `undefined` deletes the property. So a reviver that only logs (returns nothing) deletes everything and `JSON.parse` returns `undefined`. Typical uses are reviving dates (`if (key === 'createdAt') return new Date(value)`) or converting numeric strings.

**Q8. What is wrong with `JSON.parse(JSON.stringify(obj))` as a deep clone? What should you use instead?**
It loses everything JSON cannot represent: `Date` objects become strings, `Map`/`Set` become `{}`, `undefined` and functions disappear, `NaN`/`Infinity` become `null`, `BigInt` throws, and circular references throw a `TypeError`. It is also slow for big objects. Use `structuredClone(obj)` (built into modern browsers and Node.js 17+), which handles dates, maps, sets and circular references; it still cannot clone functions or DOM nodes.

**Q9. Why isn't `DOMParser` available in Node.js, and how do you parse XML there?**
`DOMParser` is a Web API provided by browsers, not part of the JavaScript language, and Node.js does not ship a DOM. Use a library: `xml2js` converts XML into a plain object (every child is an array by default, attributes go under `$`, values are strings, and it has a promise version `parseStringPromise`), or `@xmldom/xmldom` provides a standards-like `DOMParser` so browser-style code can be reused. For very large files, a streaming parser (such as `sax`, which xml2js uses internally) avoids loading the whole document into memory.

**Q10. An API returns XML and your React component needs an array of objects. How would you structure the code?**
Keep parsing out of the component: a small function fetches the text (`await response.text()` after checking `response.ok`), parses it with `DOMParser`, checks for `<parsererror>`, and maps the elements to plain objects with proper types (`Number(...)`, `.trim()`, defaults for missing nodes). The component receives clean data (e.g. `[{ name, age, email }]`) and never touches XML. This keeps the mapping testable on its own and makes it easy to switch the API to JSON later.

**Q11. When would you use `response.text()` plus `JSON.parse()` instead of `response.json()`?**
When you need features `response.json()` does not have: a reviver (to revive dates), better error messages (log the raw text when parsing fails, which helps when a server returns an HTML error page), or handling an empty body (a `204 No Content` makes `response.json()` reject, while you can check `text === ''` first). Otherwise `response.json()` is simpler and is the default choice.

### Senior (5+ years)

**Q12. The front end is typed with TypeScript, yet production errors show API fields that are `undefined` or the wrong type. How do you protect the app against API contract drift?**
TypeScript types disappear at runtime: `const user = await res.json() as User` is a promise you make to the compiler, not a check. When the backend renames a field or sends `null`, the error appears far from the cause, often as `Cannot read properties of undefined` deep inside a component. Validate at the boundary: parse every response with a runtime schema (for example Zod or Valibot), derive the TypeScript type from the schema so the two cannot drift, and decide per endpoint whether a mismatch should fail loudly or degrade (drop a bad list item, use a default).

Prevent drift upstream as well: generate client types from the OpenAPI or GraphQL schema, and run contract tests in CI on both sides. Recommendation: one typed fetch helper that validates every response, with schema failures reported to monitoring, so a backend change shows up as one clear alert rather than scattered UI bugs.

**Q13. A 30 MB JSON response freezes the page for over a second while it parses. What are your options?**
`JSON.parse` and `response.json()` parse the whole string at once on the thread that calls them, so a large payload blocks input and rendering for the whole duration, and the parsed objects can take several times the text size in memory. The best fix is to send less: paginate, filter and project fields on the server, compress responses (gzip or Brotli shrink transfer time, not parse time), and load details on demand.

When the data really must come to the client, move the work off the main thread: fetch and parse in a Web Worker and send back only what the UI needs (a summary or the first page), since posting the whole object back costs another structured clone. For record-by-record data, a streaming format such as newline-delimited JSON (NDJSON) read through `response.body` lets you process and render rows while they arrive. Recommendation: set a payload budget per endpoint; above it, paginate first and use a worker or streaming only as the second step.

**Q14. User IDs from the API are 64-bit integers, and after `JSON.parse` some of them are wrong by a few units. Why, and how do you design the API to avoid this class of bug?**
JSON numbers become JavaScript `Number`s, which are 64-bit floating point and represent integers exactly only up to `Number.MAX_SAFE_INTEGER` (2^53 − 1, about 9 × 10^15). Larger IDs are silently rounded to the nearest representable value:
```js
JSON.parse('{"id": 9007199254740993}').id; // → 9007199254740992 (off by one, no error)
```
A reviver does not help in most engines, because it receives the already-rounded number. (A newer third reviver argument, `context.source`, exposes the raw text; it ships in Chromium and recent Node.js versions but is not universal yet.) The robust fix is in the contract: send 64-bit IDs as strings (as many large public APIs do with an `id_str` field), money as integer minor units or decimal strings, and dates as ISO 8601 strings in UTC. Use `BigInt` only where you actually do arithmetic on large integers, and remember `JSON.stringify` throws on `BigInt` unless you convert it. Recommendation: make "IDs are opaque strings" an API design rule, so no client ever does math on them.

**Q15. What security risks come with parsing JSON and XML, and what rules would you set for a team?**
For JSON the parser itself is safe, but two patterns are not: evaluating JSON as code (`eval` or `new Function`, which runs anything the server or an attacker put in the text), and **prototype pollution**. `JSON.parse('{"__proto__": {"isAdmin": true}}')` creates an ordinary own property named `__proto__`, but a naive recursive merge or `lodash.merge`-style deep assign then writes into `Object.prototype`, and suddenly every object has `isAdmin`. For XML on servers, parsers that resolve DTDs are open to XML External Entity (XXE) attacks, which read local files or make internal requests, and to "billion laughs" entity expansion that exhausts memory. The browser's `DOMParser` does not fetch external entities, but Node.js libraries vary.

Rules: never `eval` data; validate parsed data against a schema; use merge utilities that skip `__proto__`, `constructor` and `prototype` keys, or create lookup objects with `Object.create(null)` or a `Map`; configure server-side XML parsers with DTDs and external entities disabled; and keep parser libraries patched (the unscoped `xmldom` package above is an example of one that is not). Recommendation: treat every parsed payload as untrusted input until it has passed schema validation.

> **Note:** Related questions answered elsewhere: [Loops](../04-loops/notes.md#interview-questions) (looping over an object's properties).

## References

- [MDN: DOMParser](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser)
- [MDN: XMLSerializer](https://developer.mozilla.org/en-US/docs/Web/API/XMLSerializer)
- [MDN: JSON.parse()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
- [MDN: JSON.stringify()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
- [MDN: Object.entries()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries)
- [npm: xml2js](https://www.npmjs.com/package/xml2js)
- [MDN: Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
- [PortSwigger Web Security Academy: Prototype pollution](https://portswigger.net/web-security/prototype-pollution)
- [OWASP: XML External Entity Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)
- [GeeksforGeeks: How to iterate over a JavaScript object](https://www.geeksforgeeks.org/how-to-iterate-over-a-javascript-object/)
