/**
 * Code-line lookup by marker text instead of hard-coded numbers. A trace says "highlight the line that
 * contains `if (arr[j] > arr[j + 1])`", and this resolves it to a 1-based line number. If the C# in the
 * notes changes so a marker no longer exists, `lineOf` throws, and the trace tests fail loudly instead of
 * highlighting the wrong line.
 */
export function lineOf(code: string, marker: string, occurrence = 1): number {
  const lines = code.split('\n');
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(marker) && ++seen === occurrence) return i + 1;
  }
  throw new Error(`Code marker not found (occurrence ${occurrence}): ${marker}`);
}

export type LineSpec = string | readonly [marker: string, occurrence: number];

/** Resolves a whole table of markers at once: `lines(CODE.bubble, { compare: 'if (arr[j] > arr[j + 1])' })`. */
export function lines<K extends string>(code: string, spec: Record<K, LineSpec>): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const key of Object.keys(spec) as K[]) {
    const s = spec[key];
    out[key] = typeof s === 'string' ? lineOf(code, s) : lineOf(code, s[0], s[1]);
  }
  return out;
}
