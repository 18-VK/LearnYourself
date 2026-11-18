// main.mjs: entry point of the modules demo. Run with `node main.mjs`.
// Import declarations are hoisted: every module below is loaded, linked and evaluated
// before the first line of this file's body runs, whatever their position in the file.

import multiply, { add, PI as pi, circleArea } from './math.mjs'; // default + named + renamed
import * as math from './math.mjs';                                 // namespace import
import { count, increment } from './counter.mjs';                   // live binding
import { multiply as times, counter } from './utils.mjs';           // through the barrel
import cjsCounter, { count as cjsCount } from './counter.cjs';      // CommonJS from ESM
import { createRequire } from 'node:module';
import path from 'node:path';

const section = (title) => console.log(`\n=== ${title} ===`);

// ---------------------------------------------------------------------------
section('1. Named, default and namespace imports');

console.log(add(2, 3));                      // 5
console.log(multiply(4, 5));                 // 20
console.log(pi);                             // 3.14159
console.log(circleArea(2));                  // 12.57
console.log(Object.keys(math));              // [ 'PI', 'add', 'circleArea', 'default' ]
console.log(math.default === multiply);      // true: "default" is just an export name
console.log(typeof math.round);              // undefined: not exported, so private

// ---------------------------------------------------------------------------
section('2. Live bindings (ESM) vs copies (CommonJS)');

console.log('ESM count before:', count);     // 0
increment();
increment();
console.log('ESM count after: ', count);     // 2  (the import is a live view of the variable)
console.log('via the barrel:  ', counter.count); // 2  (same module instance)

try {
  count = 10;                                // imports are read-only
} catch (err) {
  console.log(`${err.constructor.name}: ${err.message}`); // TypeError: Assignment to constant variable.
}

cjsCounter.increment();
cjsCounter.increment();
console.log('CJS count:     ', cjsCounter.count);      // 0  (copied when module.exports was built)
console.log('CJS named:     ', cjsCount);              // 0
console.log('CJS getCount():', cjsCounter.getCount()); // 2

// ---------------------------------------------------------------------------
section('3. A module is evaluated once');

console.log(times === multiply);             // true: utils.mjs re-exports the same function
console.log(counter.increment === increment); // true: one counter.mjs instance for the whole app

// ---------------------------------------------------------------------------
section('4. Dynamic import()');

console.log('before import()');
const { formatReport } = await import('./lazy.mjs');   // top-level await: ES modules only
console.log(formatReport([{ name: 'Alice', total: 1234.5 }, { name: 'Bob', total: 99 }]));
// Alice    1,234.5
// Bob      99

const again = await import('./lazy.mjs');              // cached: no "[lazy.mjs]" lines this time
console.log('same module instance:', again.formatReport === formatReport); // true

const feature = process.argv.includes('--math') ? './math.mjs' : './counter.mjs';
const chosen = await import(feature);                  // the specifier can be computed at runtime
console.log('loaded at runtime:', Object.keys(chosen)); // [ 'count', 'increment' ]

// ---------------------------------------------------------------------------
section('5. JSON module with an import attribute');

const { default: config } = await import('./config.json', { with: { type: 'json' } });
console.log(config);                         // { appName: 'Task Board', pageSize: 20 }

try {
  await import('./config.json');             // no { type: 'json' }
} catch (err) {
  console.log('without the attribute →', err.constructor.name); // TypeError
}

// ---------------------------------------------------------------------------
section('6. import.meta and the missing CommonJS globals');

console.log(path.basename(new URL(import.meta.url).pathname)); // main.mjs
console.log(path.basename(import.meta.dirname ?? '(needs Node 20.11+)')); // 15-modules
console.log(typeof require, typeof module, typeof __dirname);  // undefined undefined undefined
console.log(this);                           // undefined (top-level `this` in a module)

// ---------------------------------------------------------------------------
section('7. Interop: require() inside ESM, and require(esm)');

// Usually written `const require = createRequire(import.meta.url)`. It is named cjsRequire here because
// section 6 reads `typeof require`, and a `const require` declared later in the file would put that
// line in the temporal dead zone (ReferenceError).
const cjsRequire = createRequire(import.meta.url);
console.log(cjsRequire('./counter.cjs') === cjsCounter);  // true: one cached module.exports object

try {
  const mathViaRequire = cjsRequire('./math.mjs');        // require(esm): Node 20.19+ / 22.12+
  console.log('require(esm) works:', mathViaRequire.add(1, 1), mathViaRequire.default(2, 3)); // 2 6
} catch (err) {
  console.log('require(esm) is not available in this Node version:', err.code);
}
