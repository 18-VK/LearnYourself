/**
 * Practice mode, build side: from a note's implementation (a C# block) and the test cases in
 * src/data/practice/<lesson id>.yaml, make
 * - the starter code: the note's code with every method body emptied (types such as `class Employee` stay as they are);
 * - the test harness: statements that call the learner's method once per case and print each result between markers
 *   (parsed on the page by src/scripts/practice/protocol.ts);
 * - the text shown for each case's input and expected value.
 * The harness is compiled by the C# runner together with the learner's code (a "MembersWithHarness" program, see
 * runner/NOTES.md), so it can call the learner's methods directly.
 */
import type { PracticeExercise, PracticeValue } from './schema';

export interface Param {
  type: string;
  name: string;
}
export interface Signature {
  name: string;
  returnType: string;
  params: Param[];
}

// ── a tiny C# scanner: positions of code outside strings, chars and comments ───────────────────
/** For each index of `code`, whether it is code (not inside a string, char literal or comment). */
function codeMask(code: string): boolean[] {
  const mask = new Array<boolean>(code.length).fill(true);
  let i = 0;
  const mark = (from: number, to: number) => {
    for (let k = from; k < to && k < code.length; k++) mask[k] = false;
  };
  while (i < code.length) {
    const c = code[i]!;
    const n = code[i + 1];
    if (c === '/' && n === '/') {
      const end = code.indexOf('\n', i);
      const stop = end < 0 ? code.length : end;
      mark(i, stop);
      i = stop;
    } else if (c === '/' && n === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? code.length : end + 2;
      mark(i, stop);
      i = stop;
    } else if (c === '"' || ((c === '$' || c === '@') && (n === '"' || ((n === '$' || n === '@') && code[i + 2] === '"')))) {
      const start = i;
      const verbatim = code.slice(i, i + 3).includes('@');
      while (code[i] !== '"') i++;
      i++;
      while (i < code.length) {
        if (!verbatim && code[i] === '\\') i += 2;
        else if (code[i] === '"') {
          if (verbatim && code[i + 1] === '"') i += 2;
          else {
            i++;
            break;
          }
        } else i++;
      }
      mark(start, i);
    } else if (c === "'") {
      const start = i;
      i++;
      while (i < code.length && code[i] !== "'") i += code[i] === '\\' ? 2 : 1;
      i++;
      mark(start, i);
    } else i++;
  }
  return mask;
}

function matchBrace(code: string, mask: boolean[], open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (!mask[i]) continue;
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return i;
  }
  return code.length - 1;
}

const TYPE_DECL = /^\s*(?:(?:public|private|protected|internal|static|sealed|abstract|partial|readonly|file)\s+)*(?:class|struct|record|interface|enum|namespace)\b/;
const METHOD_HEAD = /^\s*(?:(?:public|private|protected|internal|static|override|virtual|async|unsafe|new)\s+)*([\w<>[\],.? ]+?)\s+(\w+)\s*\(([^()]*)\)\s*$/;

/** Top-level members of a block of bare methods and types: [start, end) ranges with what they are. */
function members(code: string): { start: number; headEnd: number; bodyStart: number; end: number; kind: 'method' | 'type' | 'other'; head: string }[] {
  const mask = codeMask(code);
  const out: { start: number; headEnd: number; bodyStart: number; end: number; kind: 'method' | 'type' | 'other'; head: string }[] = [];
  let start = 0;
  let i = 0;
  while (i < code.length) {
    if (!mask[i]) {
      i++;
      continue;
    }
    const c = code[i]!;
    if (c === '{' || (c === '=' && code[i + 1] === '>')) {
      const headText = code
        .slice(start, i)
        .split('')
        .map((ch, k) => (mask[start + k] ? ch : ' '))
        .join('');
      const head = headText.replace(/\s+/g, ' ').trim();
      if (c === '{') {
        const close = matchBrace(code, mask, i);
        const kind = TYPE_DECL.test(head) ? 'type' : METHOD_HEAD.test(head) ? 'method' : 'other';
        out.push({ start, headEnd: i, bodyStart: i, end: close + 1, kind, head });
        i = close + 1;
      } else {
        let k = i;
        while (k < code.length && !(mask[k] && code[k] === ';')) k++;
        const kind = METHOD_HEAD.test(head) ? 'method' : 'other';
        out.push({ start, headEnd: i, bodyStart: i, end: k + 1, kind, head });
        i = k + 1;
      }
      start = i;
      continue;
    }
    if (c === ';') start = i + 1;
    i++;
  }
  return out;
}

/** Method signatures declared at the top level of the block (not inside types). */
export function signatures(code: string): Signature[] {
  return members(code)
    .filter((m) => m.kind === 'method')
    .map((m) => {
      const [, returnType, name, params] = METHOD_HEAD.exec(m.head)!;
      return {
        name: name!,
        returnType: returnType!.trim(),
        params: splitParams(params!)
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => {
            const at = p.lastIndexOf(' ');
            return { type: p.slice(0, at).trim(), name: p.slice(at + 1).trim() };
          }),
      };
    });
}

/** The note's code with each top-level method body replaced by a TODO (and a throw, for methods that return). */
export function starterFrom(code: string): string {
  let out = '';
  let last = 0;
  for (const m of members(code)) {
    if (m.kind !== 'method') continue;
    const [, returnType, name] = METHOD_HEAD.exec(m.head)!;
    const head = code.slice(m.start, m.headEnd).replace(/\s*=?$/, '').trimEnd();
    const indent = /^[ \t]*/.exec(code.slice(code.lastIndexOf('\n', m.headEnd - 1) + 1))?.[0] ?? '';
    const body = returnType!.trim() === 'void' ? [`${indent}    // TODO: write ${name}`] : [`${indent}    // TODO: write ${name}`, `${indent}    throw new NotImplementedException();`];
    // the head keeps comments around the signature (e.g. TernaryMaxIndex's precondition on the same line)
    out += code.slice(last, m.start) + head + `\n${indent}{\n${body.join('\n')}\n${indent}}`;
    last = m.end;
  }
  return out + code.slice(last);
}

/** Parameters split at commas outside <…> (Dictionary<int, List<int>> graph). */
function splitParams(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '<') depth++;
    if (ch === '>') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  return [...out, cur];
}

// ── values ────────────────────────────────────────────────────────────────────────────────
const isRaw = (v: PracticeValue): v is { csharp: string; show: string } => typeof v === 'object' && !Array.isArray(v);

/** How a value prints: the same rules as the harness's __LyShow (lists in brackets, strings bare, lower-case booleans). */
export function showValue(v: PracticeValue): string {
  if (isRaw(v)) return v.show;
  if (Array.isArray(v)) return `[${v.map(showValue).join(', ')}]`;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

const csString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

/** A C# expression for a value of the given type. */
export function csharpLiteral(v: PracticeValue, type: string): string {
  if (isRaw(v)) return v.csharp;
  const t = type.replace(/\s+/g, '');
  if (t.endsWith('[]')) {
    if (!Array.isArray(v)) throw new Error(`a value for ${type} must be a list`);
    const el = t.slice(0, -2);
    return `new ${el}[] { ${v.map((x) => csharpLiteral(x, el)).join(', ')} }`;
  }
  if (Array.isArray(v)) throw new Error(`a list can't be a ${type}`);
  if (t === 'string') return csString(String(v));
  if (t === 'bool') {
    if (typeof v !== 'boolean') throw new Error(`a value for bool must be true or false`);
    return v ? 'true' : 'false';
  }
  if (typeof v !== 'number') throw new Error(`a value for ${type} must be a number`);
  if (t === 'int' || t === 'long' || t === 'short' || t === 'byte') {
    if (!Number.isInteger(v)) throw new Error(`${v} is not a whole number (${type})`);
    return t === 'long' ? `${v}L` : String(v);
  }
  if (t === 'double') return Number.isInteger(v) ? `${v}.0` : String(v);
  if (t === 'float') return `${v}f`;
  if (t === 'decimal') return `${v}m`;
  throw new Error(`no literal for type ${type}: give the value as { csharp, show }`);
}

// ── the harness ───────────────────────────────────────────────────────────────────────────
export const MARKER = '\u0001ly-case ';

const HELPERS = `void __LyCase(int n, System.Func<object> body)
{
    System.Console.WriteLine("\\u0001ly-case " + n + " start");
    try
    {
        object actual = body();
        System.Console.WriteLine("\\u0001ly-case " + n + " result " + __LyEscape(__LyShow(actual)));
    }
    catch (System.Exception e)
    {
        System.Console.WriteLine("\\u0001ly-case " + n + " error " + __LyEscape(e.GetType().Name + ": " + e.Message));
    }
}
string __LyShow(object v) => v switch
{
    null => "null",
    string s => s,
    bool b => b ? "true" : "false",
    double d => d.ToString("R", System.Globalization.CultureInfo.InvariantCulture),
    float f => f.ToString("R", System.Globalization.CultureInfo.InvariantCulture),
    System.Collections.IEnumerable e => "[" + string.Join(", ", System.Linq.Enumerable.Select(System.Linq.Enumerable.Cast<object>(e), __LyShow)) + "]",
    _ => System.Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture) ?? "null",
};
string __LyEscape(string s) => s.Replace("\\\\", "\\\\\\\\").Replace("\\r", "\\\\r").Replace("\\n", "\\\\n");`;

export interface BuiltCase {
  /** How the input is shown ("arr = [2, 5, 7, 3], target = 2"). */
  input: string;
  expected: string;
  call: string;
}
export interface BuiltExercise {
  signature: Signature;
  starter: string;
  harness: string;
  cases: BuiltCase[];
}

const calledName = (call: string) => /^\s*(\w+)\s*\(/.exec(call)?.[1] ?? '';

/** Builds starter, harness and case texts; throws with a message naming the problem. */
export function buildExercise(ex: PracticeExercise, solution: string): BuiltExercise {
  const sigs = signatures(solution);
  const find = (call: string) => {
    const name = calledName(call);
    const s = sigs.find((x) => x.name === name);
    if (!s) throw new Error(`\`${call}\` calls ${name || '(nothing)'}, which the note's block doesn't declare (it declares ${sigs.map((x) => x.name).join(', ') || 'no methods'})`);
    return s;
  };
  const main = find(ex.call);
  const lines: string[] = ['// Tests for this exercise (added code, not from the note): each case calls your method and prints its result.'];
  const cases: BuiltCase[] = ex.cases.map((c, i) => {
    const call = c.call ?? ex.call;
    const sig = find(call);
    const result = c.result ?? (c.call ? undefined : ex.result);
    if (!result && sig.returnType === 'void') throw new Error(`case ${i + 1}: ${sig.name} returns void, so the exercise needs \`result:\` (what to compare after the call)`);
    const decls = Object.entries(c.given).map(([name, value]) => {
      const type = ex.types?.[name] ?? sig.params.find((p) => p.name === name)?.type;
      if (!type) throw new Error(`case ${i + 1}: \`${name}\` is not a parameter of ${sig.name} (${sig.params.map((p) => p.name).join(', ')}); declare its type under \`types:\``);
      return `${type} ${name} = ${csharpLiteral(value, type)};`;
    });
    const body = result ? `${decls.join(' ')} ${call}; return ${result};` : `${decls.join(' ')} return ${call};`;
    lines.push(`__LyCase(${i + 1}, () => { ${body.trim()} });`);
    const input = Object.entries(c.given)
      .map(([name, value]) => `${name} = ${showValue(value)}`)
      .join(', ');
    return { input: input || '(none)', expected: showValue(c.expected), call };
  });
  lines.push('', HELPERS);
  return { signature: main, starter: ex.starter ?? starterFrom(solution), harness: lines.join('\n'), cases };
}
