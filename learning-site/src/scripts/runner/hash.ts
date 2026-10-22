/**
 * FNV-1a (32-bit) over the UTF-16 code units of a code block, with \r\n normalised and trailing newlines dropped.
 * The build (scripts/runner/blocks.ts) stores it per block; the page recomputes it from the rendered code before it
 * attaches a Run button, so a stale runnable.json can never put the wrong program behind a block.
 */
export function codeHash(code: string): string {
  const s = code.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
