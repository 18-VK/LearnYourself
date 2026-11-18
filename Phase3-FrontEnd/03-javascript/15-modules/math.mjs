// math.mjs: named exports, a default export and a private helper.

export const PI = 3.14159;

export function add(a, b) {
  return a + b;
}

export function circleArea(radius) {
  return round(PI * radius * radius);
}

// Not exported, so it is private to this module (no IIFE needed).
function round(n) {
  return Math.round(n * 100) / 100;
}

// One default export per module. It is just an export named "default".
export default function multiply(a, b) {
  return a * b;
}
