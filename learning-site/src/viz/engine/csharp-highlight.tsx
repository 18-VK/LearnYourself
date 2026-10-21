import type { ReactNode } from 'react';

/**
 * A tiny C# tokenizer for the visualizer code panel (lesson code blocks use Shiki at build time; this
 * keeps Shiki out of the browser bundle). Only colours keywords, types, strings, numbers and comments.
 */
const KEYWORDS = new Set(
  'void int bool float double for foreach in if else while do return true false new break continue var class public private static string out ref null this'.split(' '),
);
const TOKEN = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?f?\b)|([A-Za-z_]\w*)|([\s\S])/g;

export function highlightCSharp(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let m: RegExpExecArray | null;
  let k = 0;
  TOKEN.lastIndex = 0;
  let plain = '';
  const flush = () => {
    if (plain) out.push(plain);
    plain = '';
  };
  while ((m = TOKEN.exec(line)) !== null) {
    if (m[1]) {
      flush();
      out.push(<span key={k++} className="tk-com">{m[1]}</span>);
    } else if (m[2]) {
      flush();
      out.push(<span key={k++} className="tk-str">{m[2]}</span>);
    } else if (m[3]) {
      flush();
      out.push(<span key={k++} className="tk-num">{m[3]}</span>);
    } else if (m[4]) {
      if (KEYWORDS.has(m[4])) {
        flush();
        out.push(<span key={k++} className="tk-kw">{m[4]}</span>);
      } else if (/^[A-Z]/.test(m[4])) {
        flush();
        out.push(<span key={k++} className="tk-type">{m[4]}</span>);
      } else plain += m[4];
    } else plain += m[5];
  }
  flush();
  return out;
}
