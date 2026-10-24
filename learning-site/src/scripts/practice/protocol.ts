/**
 * Practice mode, page side: reads what the test harness (scripts/practice/harness.ts) printed, and compares each
 * case's result with the expected value. Pure functions, unit-tested in tests/unit/practice/.
 *
 * The harness prints, for case n:  \u0001ly-case n start  …anything the learner's code prints…
 *                                  \u0001ly-case n result <escaped value>   or   \u0001ly-case n error <Type: message>
 */
export const MARKER = '\u0001ly-case ';

export type CaseStatus = 'pass' | 'fail' | 'error' | 'timeout' | 'crash' | 'not-run';

export interface CaseOutcome {
  n: number;
  status: CaseStatus;
  actual?: string;
  error?: string;
  /** What the learner's code printed during this case. */
  printed: string;
}

const unescape = (s: string) => s.replace(/\\(\\|n|r)/g, (_, c: string) => (c === 'n' ? '\n' : c === 'r' ? '\r' : '\\'));

/**
 * Splits the program's output into cases. `ended` says how the run ended: 'completed' (every started case finished),
 * 'timeout' (the started-but-unfinished case ran out of time) or 'crash' (the runtime stopped during it).
 */
export function parseCases(output: string, expected: string[], ended: 'completed' | 'timeout' | 'crash' = 'completed'): CaseOutcome[] {
  const results = expected.map((_, i): CaseOutcome => ({ n: i + 1, status: 'not-run', printed: '' }));
  let current: CaseOutcome | null = null;
  // parts[0] is output printed before the first case (none, normally)
  for (const part of output.split(MARKER).slice(1)) {
    const nl = part.indexOf('\n');
    const head = (nl < 0 ? part : part.slice(0, nl)).replace(/\r$/, '');
    const rest = nl < 0 ? '' : part.slice(nl + 1);
    const m = /^(\d+) (start|result|error)(?: (.*))?$/.exec(head);
    const c = m ? results[Number(m[1]) - 1] : undefined;
    if (!m || !c) {
      if (current) current.printed += MARKER + part; // the learner printed something that looks like a marker
      continue;
    }
    if (m[2] === 'start') {
      current = c;
      c.status = ended === 'completed' ? 'crash' : ended; // until its result arrives
      c.printed += rest;
    } else {
      if (m[2] === 'result') {
        c.actual = unescape(m[3] ?? '');
        c.status = c.actual === expected[c.n - 1] ? 'pass' : 'fail';
      } else {
        c.error = unescape(m[3] ?? '');
        c.status = 'error';
      }
      current = null;
    }
  }
  return results;
}

/** Top-level items of a printed list "[a, b, [c, d]]", or null if the text isn't a list. */
export function listItems(text: string): string[] | null {
  if (!text.startsWith('[') || !text.endsWith(']')) return null;
  const inner = text.slice(1, -1);
  if (!inner) return [];
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (depth === 0 && ch === ',' && inner[i + 1] === ' ') {
      out.push(cur);
      cur = '';
      i++;
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export interface DiffPart {
  text: string;
  /** This item differs from the other side at the same position. */
  differs: boolean;
}

/** Item-by-item comparison of two printed values: list items by position, other values as a whole. */
export function diff(expected: string, actual: string): { expected: DiffPart[]; actual: DiffPart[]; firstDifference: number | null; lists: boolean } {
  const a = listItems(expected);
  const b = listItems(actual);
  if (!a || !b) {
    const same = expected === actual;
    return { expected: [{ text: expected, differs: !same }], actual: [{ text: actual, differs: !same }], firstDifference: same ? null : 0, lists: false };
  }
  let first: number | null = null;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      first = i;
      break;
    }
  }
  const mark = (list: string[], other: string[]) => list.map((text, i) => ({ text, differs: other[i] !== text }));
  return { expected: mark(a, b), actual: mark(b, a), firstDifference: first, lists: true };
}
