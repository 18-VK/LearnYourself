import type { ReactNode } from 'react';

/**
 * A tiny T-SQL tokenizer for the SQL code panels. It reuses the C# panel's token classes (tk-kw, tk-type,
 * tk-str, tk-num, tk-com) so both panels share one colour scheme in both themes.
 */
const KEYWORDS = new Set(
  (
    'select from where join inner left right full outer cross apply on and or not null is exists in top order by desc asc ' +
    'group having distinct as with union all begin tran transaction commit rollback save set update insert into values ' +
    'delete create table index nonclustered clustered include over partition rows between unbounded preceding following ' +
    'current row isolation level read uncommitted committed repeatable serializable snapshot primary key'
  ).split(' '),
);
const FUNCTIONS = new Set('count sum avg min max row_number rank dense_rank percent_rank first_value last_value nth_value int nvarchar decimal'.split(' '));
const TOKEN = /(--.*$)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)|([\s\S])/g;

export function highlightSql(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let m: RegExpExecArray | null;
  let k = 0;
  let plain = '';
  const flush = () => {
    if (plain) out.push(plain);
    plain = '';
  };
  TOKEN.lastIndex = 0;
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
      const w = m[4].toLowerCase();
      if (KEYWORDS.has(w)) {
        flush();
        out.push(<span key={k++} className="tk-kw">{m[4]}</span>);
      } else if (FUNCTIONS.has(w)) {
        flush();
        out.push(<span key={k++} className="tk-type">{m[4]}</span>);
      } else plain += m[4];
    } else plain += m[5];
  }
  flush();
  return out;
}
