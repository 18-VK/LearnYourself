// lazy.mjs: loaded on demand with import() from main.mjs.
// Its top-level code runs once, the first time it is imported.

console.log('  [lazy.mjs] evaluating...');

// Top-level await: whoever imports this module waits until it finishes.
const locale = await Promise.resolve('en-GB');

console.log('  [lazy.mjs] ready');

export function formatReport(rows) {
  return rows
    .map((row) => `${row.name.padEnd(8)} ${row.total.toLocaleString(locale)}`)
    .join('\n');
}
