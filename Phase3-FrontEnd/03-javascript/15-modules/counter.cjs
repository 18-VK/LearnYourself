// counter.cjs: the same counter written as CommonJS.
// module.exports is a plain object, so `count` is COPIED when the object is built.

let count = 0;

function increment() {
  count += 1;
}

module.exports = {
  count,                 // a snapshot of the number 0, never updated
  increment,
  getCount: () => count, // the CommonJS way to expose current state
};
