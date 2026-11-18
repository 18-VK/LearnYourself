// counter.mjs: importers get a LIVE, read-only binding to `count`.

export let count = 0;

export function increment() {
  count += 1; // only the exporting module can reassign the binding
}
