# JavaScript Modules (ESM and CommonJS)

> JavaScript · Topic 15 · Demo: [main.mjs](main.mjs) · [math.mjs](math.mjs) · [counter.mjs](counter.mjs) · [counter.cjs](counter.cjs) · [utils.mjs](utils.mjs) · [lazy.mjs](lazy.mjs) · [config.json](config.json) · Run with `node main.mjs`

A module is a file with its own scope that states what it needs (`import`) and what it offers (`export`). JavaScript ran for twenty years without a module system, so the ecosystem invented its own (IIFEs, CommonJS, AMD) before ES2015 standardised **ES modules (ESM)**. Today ESM is the standard in browsers, Node.js and every bundler, but CommonJS is still everywhere in Node packages and tooling, and the two interact in ways interviews like to probe. This note covers the syntax, how ESM differs from CommonJS (live bindings, static structure, async loading), dynamic `import()`, modules in the browser (import maps, `import.meta`, JSON modules), the Node.js rules, circular dependencies, side effects and what bundlers do with all of it.

## Why Modules Exist

Classic `<script>` files all share **one global scope**. Every top-level `var` and function becomes a property of `window`, so two scripts that both declare `init` overwrite each other, and the order of `<script>` tags is the only way to express "this file needs that one".

The pre-module workaround was the **IIFE module pattern**: wrap the file in a function so its variables are private, and expose a single global object (see [The module pattern](../12-closures-destructuring-spread/notes.md#the-module-pattern)):

```js
// ❌ Before modules: one global per file, dependencies implied by script order
window.TaskApp = window.TaskApp || {};
TaskApp.storage = (function () {
  const KEY = 'tasks';                       // private
  return { load: () => JSON.parse(localStorage.getItem(KEY) ?? '[]') };
})();

// ✅ With modules: private by default, dependencies explicit
// storage.js
const KEY = 'tasks';
export const load = () => JSON.parse(localStorage.getItem(KEY) ?? '[]');
// app.js
import { load } from './storage.js';
```

| System | Where | Loading | Status |
|---|---|---|---|
| IIFE + global namespace | Browser | Script tag order | Legacy; still seen in bundler output |
| CommonJS (`require`, `module.exports`) | Node.js (2009) | Synchronous, from disk | Still common in Node packages and config files |
| AMD (RequireJS) / UMD | Browser / both | Asynchronous / wrapper for both | Obsolete |
| ES modules (`import`, `export`) | Language standard (ES2015) | Asynchronous, statically analysable | The default for new code everywhere |

## ES Module Syntax

### Named and default exports

```js
// math.mjs
export const PI = 3.14159;
export function add(a, b) { return a + b; }
export function circleArea(r) { return round(PI * r * r); }
function round(n) { return Math.round(n * 100) / 100; }   // not exported: private
export default function multiply(a, b) { return a * b; }  // at most one default per module
```

```js
// main.mjs
import multiply, { add, PI as pi, circleArea } from './math.mjs'; // default + named + renamed
import * as math from './math.mjs';                                 // namespace import

add(2, 3);              // → 5
multiply(4, 5);         // → 20
Object.keys(math);      // → [ 'PI', 'add', 'circleArea', 'default' ]
math.default === multiply; // → true
typeof math.round;      // → 'undefined' (private)
```

A default export is simply an export named `default`; `import multiply from` is shorthand for `import { default as multiply } from`. Importing a name that does not exist fails at **link time**, before any code runs: `SyntaxError: The requested module './math.mjs' does not provide an export named 'nope'`.

| | Named exports | Default export |
|---|---|---|
| Import name | Fixed by the exporter (rename with `as`) | Chosen by every importer |
| Refactoring and search | Rename once, find all usages | Each file may call it something different |
| Tree shaking | Per export | Fine for a function or class; an exported object literal is one indivisible value |
| Typical use | Utilities, constants, most library APIs | One main thing per file (a component, a class), frameworks that expect it (route files) |

Many teams prefer named exports in shared code for consistent names and better tooling, and use defaults only where a framework requires them.

### Re-exports and barrel files

```js
// utils.mjs: no code of its own, only re-exports
export { add, PI } from './math.mjs';
export { default as multiply } from './math.mjs';
export * as counter from './counter.mjs';    // namespace re-export (ES2020)
export * from './dates.mjs';                 // everything except the default (not in the demo)
```

An `index.js` that re-exports a whole folder is called a **barrel**. It gives a tidy import path (`from './utils'`), but every importer now depends on every module behind it. That slows dev servers and test runners, can pull side-effectful modules into bundles, and makes circular imports easy to create.

### Imports are hoisted, static and read-only

- `import` declarations are processed before the module body runs, wherever they appear in the file.
- They must be at the top level with a string literal specifier: no `import` inside `if`, no variables in the path. Use `import()` for that.
- An imported binding is **read-only** in the importer: `count = 10` throws `TypeError: Assignment to constant variable.` Only the exporting module can change it.
- Module code is always in **strict mode**, and top-level variables are module-scoped, not globals.
- Each module is evaluated **once** per module graph; every importer shares the same instance (a natural singleton).

## CommonJS vs ES Modules

| | CommonJS | ES modules |
|---|---|---|
| Syntax | `const x = require('./x')`, `module.exports = ...` | `import x from './x.js'`, `export ...` |
| Loading | Synchronous: `require` reads, runs and returns immediately | Asynchronous, in phases: fetch and parse the whole graph, link, then evaluate |
| When dependencies are known | At runtime (`require` is a function call, can be conditional) | At parse time (static declarations) |
| What you import | A **copy** of whatever `module.exports` held | A **live binding** to the exporter's variable |
| Top-level `this` | `module.exports` | `undefined` |
| `__dirname`, `__filename`, `require`, `module` | Available (Node wraps each file in a function that provides them) | Not defined; use `import.meta.dirname`, `import.meta.filename`, `import.meta.url` |
| Top-level `await` | No | Yes (ES2022) |
| Strict mode | Opt in with `'use strict'` | Always |
| Tree shaking | Hard (exports are dynamic) | Designed for it |
| Browsers | Only through a bundler | Native |

### Live bindings vs copies

The demo exports the same counter both ways:

```js
// counter.mjs
export let count = 0;
export function increment() { count += 1; }

// counter.cjs
let count = 0;
function increment() { count += 1; }
module.exports = { count, increment, getCount: () => count };
```

```js
import { count, increment } from './counter.mjs';
import cjsCounter from './counter.cjs';

increment(); increment();
count;                    // → 2  the import is a view of the exporter's variable

cjsCounter.increment(); cjsCounter.increment();
cjsCounter.count;         // → 0  copied into the exports object when it was created
cjsCounter.getCount();    // → 2  a function reads the current value
```

> **Note:** In CommonJS, `exports` is only a shortcut variable pointing at `module.exports`. `exports.add = add` works; `exports = { add }` reassigns the local variable and exports nothing. Use `module.exports = { ... }` to replace the whole object.

### How ES modules load

1. **Construction:** starting from the entry, fetch each file, parse it, read its `import` declarations, and fetch those too. The whole graph is known before any code runs, and the browser can fetch files in parallel.
2. **Linking:** create every module's exports and connect each import to the exporter's binding (that is what makes bindings live). Missing exports fail here.
3. **Evaluation:** run each module's top-level code once, dependencies before the modules that import them.

Because step 1 can see every import and export without running code, tools can **tree shake**: remove exports nobody imports. CommonJS can't be analysed the same way, because `require(someVariable)` and `module.exports[name] = fn` are only known at runtime.

### Top-level await

ES modules can use `await` at the top level (the demo's `lazy.mjs` does). Any module that imports it, directly or indirectly, waits for that promise before it is evaluated. That is useful for one-off setup (loading a config file, a WebAssembly module, a locale), but a slow `await fetch(...)` in a widely imported module delays the start of the whole app. In CommonJS and classic scripts it is a `SyntaxError`; see [async/await](../18-async-await-and-fetch/notes.md#where-you-can-use-await).

## Dynamic `import()` and Code Splitting

`import(specifier)` is a function-like expression that returns a **promise of the module namespace**. It works anywhere, including classic scripts and CommonJS files, and the specifier can be computed at runtime.

```js
console.log('before import()');
const { formatReport } = await import('./lazy.mjs');   // lazy.mjs is evaluated now, not at startup
const again = await import('./lazy.mjs');              // cached: not evaluated a second time
again.formatReport === formatReport;                   // → true

const feature = process.argv.includes('--math') ? './math.mjs' : './counter.mjs';
const chosen = await import(feature);                  // computed specifier
```

In the browser, bundlers turn each `import()` into a separate **chunk** that is downloaded only when the code runs. That is code splitting: load a route, a chart library or an editor when the user needs it, not in the initial bundle.

```js
// Load the heavy editor only when the user clicks "Edit"
editButton.addEventListener('click', async () => {
  const { openEditor } = await import('./editor.js');
  openEditor(document.querySelector('#doc'));
});
```

Things to know:

- A default export arrives as the `default` property: `const { default: Chart } = await import('./chart.js')`.
- Bundlers can only split on specifiers they can see. `` import(`./locales/${lang}.js`) `` works (the bundler creates one chunk per matching file); a fully dynamic `import(url)` is left to the runtime.
- The network request can fail (offline, or a new deploy removed the old chunk), so handle rejections; see Q15.
- `<link rel="modulepreload" href="/editor.js">` fetches, parses and compiles a module ahead of time without running it (browsers may also fetch its dependencies).

## Modules in the Browser

`<script type="module">` turns on everything in this note. It is deferred by default, always strict, has its own scope, is fetched with CORS (so pages opened from `file://` fail; use a local server), and runs once per URL. These differences from classic scripts, and how `async`/`defer` compare, are covered in [Introduction to JavaScript](../01-how-js-runs/notes.md#async-and-defer).

Rules that catch people out:

- **Specifiers must be URLs.** `./math.js` works; `./math` (no extension) 404s, and a bare specifier like `'date-fns'` throws `TypeError: Failed to resolve module specifier` unless an import map defines it.
- **The server must send a JavaScript MIME type** (`text/javascript`). Module scripts use strict MIME checking, so an `.mjs` file served as `application/octet-stream`, or an SPA server that answers a missing `.js` file with `index.html`, fails with "Expected a JavaScript module script".
- `<script nomodule src="legacy.js">` is ignored by browsers that support modules; it was the fallback for very old browsers (IE11) and is rarely needed now.
- The same file loaded under two URLs (`/app.js` and `/app.js?v=2`) is **two module instances**, with two copies of any module-level state.

### Import maps

An import map tells the browser how to resolve bare specifiers, so you can write `import { format } from 'date-fns'` without a bundler:

```html
<script type="importmap">
{
  "imports": {
    "date-fns": "https://cdn.example.com/date-fns@4.1.0/index.js",
    "app/": "/src/"
  }
}
</script>
<script type="module">
  import { format } from 'date-fns';
  import { load } from 'app/storage.js';   // → /src/storage.js
</script>
```

Entries ending in `/` map a prefix, and a `"scopes"` key can give different folders different versions of a package. The map must appear before any module script that uses it. Import maps are Baseline 2023 (Chrome 89, Firefox 108, Safari 16.4) and suit small apps, prototypes and server-rendered pages without a build step. For large apps a bundler is still the norm.

### `import.meta`

`import.meta` is an object with information about the current module.

| Property | Where | Value |
|---|---|---|
| `import.meta.url` | Browser and Node | The module's own URL (`https://...` or `file:///...`) |
| `import.meta.resolve(specifier)` | Browser and Node | The URL a specifier would resolve to, without loading it |
| `import.meta.dirname`, `import.meta.filename` | Node 20.11+ | Replacements for `__dirname` and `__filename` |
| `import.meta.env`, `import.meta.hot` | Vite and similar tools | Build-time values and hot-reload API (tool-specific, not standard) |

```js
// Load a file next to this module, in the browser or in Node
const workerUrl = new URL('./worker.js', import.meta.url);
```

### JSON modules and import attributes

```js
import config from './config.json' with { type: 'json' };
config.appName;  // → 'Task Board'

const { default: sameConfig } = await import('./config.json', { with: { type: 'json' } });
```

The `with { type: 'json' }` part is an **import attribute** (ES2025). It exists for security: the browser decides how to run a file from the server's MIME type, so without the attribute a compromised or misconfigured server could send JavaScript where you expected inert data. With it, the import fails unless the response really is JSON. Omitting it throws a `TypeError` (the demo shows this). A JSON module has only a default export.

- Older code used `assert { type: 'json' }`. That syntax was replaced by `with`; Node 22 removed `assert`.
- Support: Node 18.20+ and 20.10+ understand `with`; all current major browsers support JSON modules since 2025 (Firefox was last). CSS module scripts (`with { type: 'css' }`) exist but are not yet supported everywhere.

## Modules in Node.js

### How Node decides which system a file uses

| File | Treated as |
|---|---|
| `.mjs` | ES module |
| `.cjs` | CommonJS |
| `.js` | Whatever the nearest `package.json` says: `"type": "module"` → ESM, `"type": "commonjs"` or no `"type"` → CommonJS |

Since Node 22.7 (and 20.19), a `.js` file with no `"type"` that contains `import`/`export` syntax is detected and run as ESM. Don't rely on detection: set `"type"` explicitly so tools and readers agree, and use `.cjs` for the odd file that must stay CommonJS (some config files).

ESM in Node follows the browser rules more closely than CommonJS did: relative imports need the **full file name** (`./math.mjs`, not `./math`), there is no automatic `index.js` lookup, built-ins are best imported with the `node:` prefix (`import fs from 'node:fs'`), and `require`, `module`, `__dirname` and `__filename` don't exist.

### The `"exports"` field

`"exports"` in a package's `package.json` defines its public entry points. Anything not listed can't be imported from outside (`ERR_PACKAGE_PATH_NOT_EXPORTED`), so internals are private, and **conditions** pick a file per environment:

```json
{
  "name": "@example/ui",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./button": "./dist/button.js",
    "./package.json": "./package.json"
  },
  "sideEffects": ["*.css"]
}
```

Conditions are checked in object order, so put `"types"` first and a generic `"default"` last. Bundlers add their own conditions (`"browser"`, `"development"`). The sibling `"imports"` field defines private aliases inside a package (`import { db } from '#db'`).

### Interop between CommonJS and ESM

| Direction | How | Notes |
|---|---|---|
| ESM imports CommonJS | `import pkg from './counter.cjs'` | The default import is `module.exports`. Named imports (`import { count } from`) work when Node can detect them by static analysis of the CommonJS source; otherwise use the default. |
| CommonJS loads ESM, async | `const m = await import('./math.mjs')` | Works in every Node version with ESM support |
| CommonJS loads ESM, sync | `require('./math.mjs')` ("require(esm)") | On by default in Node 20.19+, 22.12+ and 23+ (behind a flag in some earlier 20.x/22.x releases). Returns the module namespace object. Throws `ERR_REQUIRE_ASYNC_MODULE` if the ES module graph uses top-level await. |
| ESM needs `require` | `const require = createRequire(import.meta.url)` | From `node:module`; useful for CommonJS-only packages or `require.resolve` |

`require(esm)` changed the ecosystem: before it, a CommonJS project could not load an ESM-only package synchronously, which is why many libraries shipped two builds. Dual builds bring the **dual package hazard**: if one part of an app gets the CommonJS copy and another gets the ESM copy, the library is loaded twice, so module-level state is duplicated and `instanceof` checks fail between the two copies.

## Circular Dependencies

ES modules allow cycles. When the graph is linked, every binding exists, but a `let`/`const`/`class` export is in its temporal dead zone until the exporting module's body has run. Function declarations are initialised during linking, so calling them works:

```js
// ca.mjs (entry)
import { fromB } from './cb.mjs';
export const valueA = 'A';
export function helloA() { return 'hello from A'; }

// cb.mjs
import { valueA, helloA } from './ca.mjs';
console.log(helloA());   // → 'hello from A' (function declarations are ready)
console.log(valueA);     // → ReferenceError: Cannot access 'valueA' before initialization
export const fromB = 'B';
```

`cb.mjs` runs first because `ca.mjs` imports it, and at that moment `ca.mjs` hasn't executed `export const valueA`. CommonJS behaves differently but no better: the second module receives the first one's **partially filled** `module.exports`, so values are silently `undefined` instead of throwing.

Fixes: move the shared code into a third module that both import; read the import inside a function that runs later instead of at the top level; or invert the dependency (pass a callback or register a handler). Lint rules such as `import/no-cycle` (eslint-plugin-import) and tools like madge find cycles in a large codebase.

## Side-Effect Imports and `sideEffects`

```js
import './polyfills.js';      // runs the file, imports nothing
import './styles.css';        // a bundler feature, not standard JavaScript
```

A module has **side effects** if evaluating it does something beyond defining exports: patching globals, registering a custom element, injecting CSS, starting a timer. Tree shaking can drop unused *exports*, but it must keep a whole module whose top-level code might matter.

`"sideEffects": false` in `package.json` promises bundlers that no file in the package has side effects, so any module whose exports are unused can be dropped entirely. An array lists the exceptions (`["*.css", "./src/polyfills.js"]`). Getting it wrong is a production-only bug: with `false` on a package that imports its own CSS, the styles vanish from the build while everything works in development.

## What Bundlers Do

Browsers can load ES modules natively, but production apps are still bundled (Vite, webpack, esbuild, Rspack, Rollup/Rolldown). A bundler:

- builds the module graph from the entry points and resolves bare specifiers through `node_modules` and `"exports"` conditions,
- transforms code (TypeScript, JSX, newer syntax for older targets, CSS and asset imports),
- tree shakes unused exports and concatenates modules into fewer files (scope hoisting),
- splits code at `import()` boundaries and shares common chunks,
- minifies and adds content hashes to file names for long-term caching.

Why bundle at all? An unbundled deep graph is a **waterfall**: the browser discovers each level of imports only after parsing the previous one, so hundreds of small files load slowly even over HTTP/2. Vite uses native ESM during development (fast startup, the browser requests only what a page uses) and bundles for production.

## Common Mistakes

- **Leaving out the file extension** (`import { add } from './math'`): fine in a bundler, a resolution error in Node ESM and in the browser.
- **Opening a module page from `file://`:** module scripts are fetched with CORS and fail; serve the folder over HTTP.
- **Using `require`, `module.exports` or `__dirname` in an ES module:** they are not defined; use `import`, `export` and `import.meta.dirname`.
- **Writing `exports = { ... }` in CommonJS**, which exports nothing; use `module.exports = { ... }`.
- **Expecting a CommonJS export of a primitive to update** (`module.exports = { count }`): it is a copy; export a function or a getter.
- **Importing a default with braces or a named export without them:** `import { multiply } from './math.mjs'` fails when `multiply` is the default export.
- **A circular import that reads a `const` at the top level**, giving `ReferenceError: Cannot access ... before initialization`.
- **Barrel files that re-export everything**, slowing dev servers and tests and dragging side-effectful modules into bundles.
- **`"sideEffects": false` on a package with CSS or polyfill imports**, which silently removes them from production builds.
- **A slow top-level `await` in a shared module**, which delays every module that imports it.

## Key Takeaways

- Modules give each file its own scope and explicit dependencies; they replaced globals, IIFEs and script-order tricks.
- ES module imports are static, hoisted, read-only **live bindings**; CommonJS `require` is a runtime function call that returns a **copy** of `module.exports`.
- Static structure is what makes tree shaking, early "missing export" errors and parallel loading possible.
- `import()` loads a module on demand and returns a promise of its namespace; bundlers turn it into code splitting.
- In the browser, module specifiers are URLs: full file names, a JavaScript MIME type, CORS, and an import map for bare names.
- In Node, `.mjs`/`.cjs` and `"type"` decide the module system, `"exports"` defines a package's public API, and `require(esm)` (Node 20.19+, 22.12+) works for ES modules without top-level await.
- Avoid circular imports and broad barrels, and declare `sideEffects` accurately.

## Interview Questions

### Junior (0–1 year)

**Q1. Why do we need modules? What did people do before them?**
Without modules every script shares the global scope, so names collide, any file can change any other file's variables, and dependencies are expressed only by the order of `<script>` tags. Before ES modules, developers wrapped files in IIFEs that exposed one global namespace object (the module pattern), and Node used CommonJS. Modules give each file a private scope and make dependencies explicit with `import` and `export`.

**Q2. What is the difference between named and default exports, and how do you import each?**
A module can have many named exports (`export function add`), imported with braces and the exact name (`import { add } from './math.js'`, renamed with `as`). It can have at most one default export (`export default function multiply`), imported without braces under any name (`import times from './math.js'`). Named exports keep names consistent across a codebase; defaults suit modules that export one main thing.

**Q3. What are the main differences between CommonJS and ES modules?**
CommonJS uses `require()` and `module.exports`, loads synchronously, resolves dependencies at runtime and is native only in Node. ES modules use `import`/`export`, are standard in browsers and Node, are statically analysable (so bundlers can tree shake), load asynchronously, support top-level `await`, always run in strict mode, and give importers live bindings instead of copies.

**Q4. What is dynamic `import()` and when would you use it?**
`import('./module.js')` loads a module at runtime and returns a promise that resolves to its namespace object. Use it to load code only when needed (a route, a modal, a chart library), to choose a module based on a condition, or to load ESM from a CommonJS file. Bundlers put dynamically imported modules in separate chunks, which reduces the initial bundle size.

**Q5. How do you use ES modules in Node.js?**
Name the file `.mjs`, or set `"type": "module"` in the nearest `package.json` so `.js` files are treated as ES modules (then `.cjs` marks CommonJS files). Write relative imports with the full file name (`./math.mjs`), import built-ins with the `node:` prefix, and replace `__dirname` with `import.meta.dirname` (Node 20.11+) or `fileURLToPath(new URL('.', import.meta.url))`.

**Q6. `import { add } from './math'` works in your Vite project but fails in plain Node and in a browser. Why?**
Bundlers and TypeScript resolve extensionless paths and `index.js` files for you, but native ES modules treat specifiers as URLs: the browser requests exactly `./math` (a 404), and Node's ESM resolver does not guess extensions. Write `./math.js` (or `.mjs`). Bare specifiers like `'lodash-es'` additionally need an import map in the browser.

### Mid-level (2–4 years)

**Q7. What does this print, and why?**
```js
// counter.mjs
export let count = 0;
export const increment = () => { count++; };
// counter.cjs
let count = 0;
module.exports = { count, increment: () => { count++; } };
// main.mjs
import { count, increment } from './counter.mjs';
import cjs from './counter.cjs';
increment(); cjs.increment();
console.log(count, cjs.count);
```
`1 0`. An ES module import is a live binding to the exporter's `count` variable, so it reflects the increment. The CommonJS module copied the value `0` into the `module.exports` object when it was created; `increment` changes the local variable, not the property. To expose current state from CommonJS, export a function (`getCount`) or a getter.

**Q8. How does tree shaking work, and what prevents it?**
The bundler starts from the entry points, follows the static `import`/`export` graph, marks which exports are actually used, and drops the rest during minification. It is prevented by anything it can't analyse or can't prove harmless: CommonJS modules, dynamic property access on a namespace (`utils[name]`), exporting one big object (`export default { add, sub }`), and module-level side effects such as patching globals. Help it with named exports, ESM builds of dependencies, an accurate `"sideEffects"` field and `/*#__PURE__*/` annotations on top-level calls that are safe to drop.

**Q9. Two modules import each other. One crashes with `ReferenceError: Cannot access 'config' before initialization`. Why, and how do you fix it?**
In a cycle, one module must be evaluated first, and at that time the other module's `const`/`let` exports exist but are still in the temporal dead zone. Reading one at the top level throws (function declarations are fine because they are initialised during linking). Fix it by moving the shared value into a third module both can import, by reading it lazily inside a function called later, or by inverting the dependency. Add `import/no-cycle` to lint to stop new cycles.

**Q10. What is top-level `await`, where can you use it, and what does it cost?**
It lets an ES module `await` at the top level, for example `const config = await loadConfig()`. It only works in ES modules, not in classic scripts or CommonJS. Every module that imports it, directly or indirectly, waits until the promise settles before it is evaluated, so a slow network call in a widely shared module delays the whole app's start. It also stops synchronous `require()` of that module in Node (`ERR_REQUIRE_ASYNC_MODULE`). Use it for genuinely required setup in entry points or leaf modules, not for convenience in shared utilities.

**Q11. What is an import map, and when would you use one?**
A `<script type="importmap">` JSON block that maps bare specifiers (`'date-fns'`) or prefixes (`'app/'`) to URLs, so native ES modules can use package names without a bundler. It must appear before the module scripts that use it, and `"scopes"` can map different versions for different folders. It suits small apps, demos, server-rendered pages with a little JavaScript, and micro-frontends sharing one copy of a library. For larger apps a bundler is still better, because it also tree shakes, splits and avoids request waterfalls.

**Q12. Your CommonJS Node app needs a package that is now ESM-only. What are your options?**
Load it with `await import('pkg')`, which works in every ESM-capable Node version but makes the calling code async. On Node 20.19+ and 22.12+, `require('pkg')` works directly if the package does not use top-level await, and returns its namespace object (a default export is in `.default`). Longer term, migrate that part of the app to ESM. Pinning an older CommonJS version of the package is a temporary fix that leaves you without security updates.

**Q13. What does the `"exports"` field in `package.json` do?**
It defines the package's public entry points. Paths not listed can't be imported from outside, which turns deep imports of internals into `ERR_PACKAGE_PATH_NOT_EXPORTED` errors and lets authors refactor freely. Conditions select files per environment: `"types"` for TypeScript, `"import"` and `"require"` for ESM and CommonJS consumers, `"browser"`, `"development"` and `"default"`. Adding `"exports"` to an existing package is a breaking change, because consumers' deep imports stop working.

### Senior (5+ years)

**Q14. You maintain an internal UI library consumed by dozens of apps: some Vite, some webpack, some Node SSR still on CommonJS. How do you publish it in 2026?**
Publish ESM first: `"type": "module"`, an `"exports"` map with `"types"` first, explicit subpath entries for each public area, named exports only, and an accurate `"sideEffects"` list (CSS files). Since every supported Node release line now has `require(esm)` (22.12+, 24+), a CommonJS SSR app can `require()` the ESM build as long as the library avoids top-level await, so a separate CommonJS build is optional. Keep one only if you still support older runtimes, and then make sure both entry points share state through one implementation to avoid the dual package hazard.
Enforce it in CI with `publint` and "Are the types wrong?" checks, and a smoke test that imports the package from a Vite app, a webpack app and a CommonJS Node script. Recommendation: ESM-only with a precise `"exports"` map, unless a named consumer truly cannot upgrade Node.

**Q15. After a deploy, error monitoring shows a spike of "Failed to fetch dynamically imported module" (or `ChunkLoadError`). What happened, and how do you fix it?**
Users who loaded the previous version still run the old entry code, which references old hashed chunk names. The deploy removed those files, so the next `import()` fails with a 404. If the server answers unknown paths with `index.html`, the browser gets HTML where it expected JavaScript and reports a MIME type error instead. It spikes right after a deploy and fades as tabs are reloaded.
Fixes, in order: keep the previous one or two releases' assets available (hashed files are immutable, so there's no conflict); return a real 404 for missing `.js` files instead of the SPA fallback; and handle the failure in the app: catch rejected `import()` calls (Vite fires a `vite:preloadError` event) and do one guarded full reload so the user gets the new version, with a flag in `sessionStorage` to avoid reload loops. Recommendation: retain old assets as the real fix, the reload handler as the safety net.

**Q16. A large codebase uses `index.ts` barrels in every folder. Tests and the dev server are slow, bundles include unused code, and circular import errors keep appearing. What do you do?**
Barrels make every importer depend on everything behind them. A test that needs one helper loads a whole folder graph, the dev server transforms modules nobody uses, side-effectful modules in the barrel defeat tree shaking, and two folders that import each other's barrels form cycles. Measure first: module counts per test, bundle analyser output, cycle reports from madge.
Then migrate gradually: keep barrels only as the public entry point of a package or feature (a deliberate API boundary), switch internal imports to direct file paths with a codemod, and add lint rules (`no-restricted-imports` against internal barrels, `import/no-cycle`). For third-party barrels, tools such as Next.js's `optimizePackageImports` rewrite imports. Recommendation: one barrel per public boundary, none inside features, enforced by lint.

**Q17. How would you migrate a large CommonJS Node codebase (an SSR server and tooling) to ES modules?**
Migrate bottom-up and in slices, never as one big-bang change. Find the blockers first: `__dirname`/`__filename`, conditional or dynamic `require`, `require.cache` tricks, JSON `require` calls, test runner and mocking setup (module mocking works differently with ESM), and config files that tools load as CommonJS. With `require(esm)` available, converted leaf modules can still be `require`d by unconverted CommonJS callers, so you can convert one package or folder at a time.
Use a codemod for the mechanical part (`require` → `import`, extensions on relative paths), set `"type": "module"` per package when it is fully converted, keep `.cjs` for config files that must stay CommonJS, and gate each slice on the existing test suite plus a startup smoke test. Recommendation: plan by dependency layer, automate the syntax change, and spend the human effort on the runtime differences (live bindings, async loading, top-level await, mocking).

> **Note:** Related questions answered elsewhere: [Introduction to JavaScript](../01-how-js-runs/notes.md#interview-questions) (`async` vs `defer`, and how `<script type="module">` differs from a classic script).

## References

- [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [MDN: import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
- [MDN: export](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [MDN: import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- [MDN: import.meta](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta)
- [MDN: Import attributes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with)
- [MDN: `<script type="importmap">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)
- [Node.js: ECMAScript modules](https://nodejs.org/api/esm.html)
- [Node.js: CommonJS modules (including loading ES modules with require)](https://nodejs.org/api/modules.html)
- [Node.js: Packages (`"type"`, `"exports"`, `"imports"`)](https://nodejs.org/api/packages.html)
- [V8: JavaScript modules](https://v8.dev/features/modules)
- [Mozilla Hacks: ES modules, a cartoon deep-dive](https://hacks.mozilla.org/2018/03/es-modules-a-cartoon-deep-dive/)
- [webpack: Tree shaking and `sideEffects`](https://webpack.js.org/guides/tree-shaking/)
