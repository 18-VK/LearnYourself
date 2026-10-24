/**
 * A small SQL tokenizer for the runnable-SQL checks (src/scripts/sqlrun/classify.ts) and the browser runner.
 *
 * It knows just enough of both dialects to tell code from strings and comments: '…' strings (with '' escapes and the
 * T-SQL N'…' prefix), "…" and […] quoted names, `…` (MySQL/SQLite), -- and /* *\/ comments, @variables, #temp tables,
 * numbers, words and operators. Positions are kept so findings can name a line.
 */

export type TokenKind = 'ws' | 'comment' | 'string' | 'number' | 'word' | 'dquote' | 'bracket' | 'backtick' | 'var' | 'temp' | 'op';

export interface Token {
  kind: TokenKind;
  text: string;
  /** Upper-cased text for words (keywords and names compare case-insensitively in both dialects). */
  upper: string;
  start: number;
  line: number;
  /** N'…' (T-SQL Unicode string literal). */
  national?: boolean;
}

const WORD_START = /[A-Za-z_À-￿]/;
const WORD = /[A-Za-z0-9_$À-￿]/;
const TWO_CHAR_OPS = new Set(['<=', '>=', '<>', '!=', '==', '||', '::', '!<', '!>']);

export function tokenize(sql: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let line = 1;
  const push = (kind: TokenKind, start: number, end: number, extra: Partial<Token> = {}) => {
    const text = sql.slice(start, end);
    out.push({ kind, text, upper: kind === 'word' ? text.toUpperCase() : text, start, line, ...extra });
    for (let k = start; k < end; k++) if (sql.charCodeAt(k) === 10) line++;
  };
  while (i < sql.length) {
    const c = sql[i]!;
    const n = sql[i + 1] ?? '';
    const start = i;
    if (/\s/.test(c)) {
      while (i < sql.length && /\s/.test(sql[i]!)) i++;
      push('ws', start, i);
    } else if (c === '-' && n === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      push('comment', start, i);
    } else if (c === '/' && n === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end < 0 ? sql.length : end + 2;
      push('comment', start, i);
    } else if (c === "'" || ((c === 'N' || c === 'n') && n === "'")) {
      const national = c !== "'";
      i += national ? 2 : 1;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") i += 2;
          else {
            i++;
            break;
          }
        } else i++;
      }
      push('string', start, i, national ? { national: true } : {});
    } else if (c === '"' || c === '`') {
      i++;
      while (i < sql.length && sql[i] !== c) i++;
      i = Math.min(sql.length, i + 1);
      push(c === '"' ? 'dquote' : 'backtick', start, i);
    } else if (c === '[') {
      while (i < sql.length && sql[i] !== ']') i++;
      i = Math.min(sql.length, i + 1);
      push('bracket', start, i);
    } else if (c === '@' || c === '#') {
      i++;
      if (sql[i] === c) i++; // @@ROWCOUNT, ##global
      while (i < sql.length && WORD.test(sql[i]!)) i++;
      if (i - start === 1) push('op', start, i);
      else push(c === '@' ? 'var' : 'temp', start, i);
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(n))) {
      while (i < sql.length && /[0-9.]/.test(sql[i]!)) i++;
      if (/[eE]/.test(sql[i] ?? '') && /[-+0-9]/.test(sql[i + 1] ?? '')) {
        i += 2;
        while (i < sql.length && /[0-9]/.test(sql[i]!)) i++;
      }
      push('number', start, i);
    } else if (WORD_START.test(c)) {
      while (i < sql.length && WORD.test(sql[i]!)) i++;
      push('word', start, i);
    } else {
      i += TWO_CHAR_OPS.has(c + n) ? 2 : 1;
      push('op', start, i);
    }
  }
  return out;
}

/** Tokens without whitespace and comments. */
export const significant = (tokens: Token[]): Token[] => tokens.filter((t) => t.kind !== 'ws' && t.kind !== 'comment');

/** The code with comments blanked out (same length and line breaks), for simple text searches. */
export function stripComments(sql: string): string {
  return tokenize(sql)
    .map((t) => (t.kind === 'comment' ? t.text.replace(/[^\n]/g, ' ') : t.text))
    .join('');
}

/** Statements split at top-level semicolons (each with its tokens, without the semicolon). */
export function splitStatements(tokens: Token[]): Token[][] {
  const out: Token[][] = [];
  let cur: Token[] = [];
  let depth = 0;
  for (const t of tokens) {
    if (t.kind === 'op' && t.text === '(') depth++;
    if (t.kind === 'op' && t.text === ')') depth = Math.max(0, depth - 1);
    if (t.kind === 'op' && t.text === ';' && depth === 0) {
      if (significant(cur).length) out.push(cur);
      cur = [];
      continue;
    }
    cur.push(t);
  }
  if (significant(cur).length) out.push(cur);
  return out;
}

/** Index of the token that closes the parenthesis opened at `open` (or tokens.length). */
export function matchParen(tokens: Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.kind !== 'op') continue;
    if (t.text === '(') depth++;
    else if (t.text === ')' && --depth === 0) return i;
  }
  return tokens.length;
}

/** The value of a '…' string token (quotes removed, '' unescaped). */
export const stringValue = (t: Token): string => t.text.replace(/^[Nn]?'/, '').replace(/'$/, '').replace(/''/g, "'");
