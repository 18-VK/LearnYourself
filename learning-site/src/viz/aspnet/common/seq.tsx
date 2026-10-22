/**
 * A small sequence diagram (lanes with lifelines, arrows between them, notes on one lane) in the same style as the
 * JWT sequence visualizer. Used by the CORS and HSTS visualizers.
 */

export interface SeqLane {
  id: string;
  label: string;
}

export interface SeqItem {
  from: string;
  to: string;
  label: string;
  headers?: string[];
  tone?: 'ok' | 'bad';
}

export function SeqDiagram({ lanes, items, label }: { lanes: SeqLane[]; items: SeqItem[]; label: string }) {
  const idx = (l: string) => Math.max(0, lanes.findIndex((x) => x.id === l));
  const n = lanes.length;
  return (
    <div className="seq" role="img" aria-label={`${label}: ${items.length} messages. Latest: ${items.at(-1)?.label ?? 'none'}`}>
      <div className="seq-grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${Math.max(1, items.length)}, auto)` }}>
        {lanes.map((l, c) => (
          <div key={l.id} className="seq-head" style={{ gridColumn: c + 1, gridRow: 1 }}>
            {l.label}
          </div>
        ))}
        {lanes.map((l, c) => (
          <div key={`life-${l.id}`} className="seq-life" style={{ gridColumn: c + 1, gridRow: `2 / ${Math.max(1, items.length) + 2}` }} aria-hidden="true" />
        ))}
        {items.map((e, i) => {
          const a = idx(e.from);
          const b = idx(e.to);
          const cur = i === items.length - 1;
          const tone = e.tone === 'bad' ? ' is-bad' : e.tone === 'ok' ? ' is-ok' : '';
          if (a === b) {
            const end = a === n - 1 ? a + 2 : n + 1;
            return (
              <div key={i} className={`seq-self${cur ? ' is-current' : ''}${tone}`} style={{ gridColumn: `${a + 1} / ${end}`, gridRow: i + 2, ['--span' as string]: end - a - 1 }}>
                <span>{e.label}</span>
              </div>
            );
          }
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          return (
            <div key={i} className={`seq-msg ${b > a ? 'ltr' : 'rtl'}${cur ? ' is-current' : ''}${tone}`} style={{ gridColumn: `${lo + 1} / ${hi + 2}`, gridRow: i + 2, ['--span' as string]: hi - lo + 1 }}>
              <span className="seq-label">{e.label}</span>
              <span className="seq-arrow" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The latest message's headers, shown full width under the diagram (they don't fit between narrow lanes). */
export function LatestHeaders({ items }: { items: SeqItem[] }) {
  const last = items.at(-1);
  if (!last?.headers?.length) return null;
  return (
    <div className="seq-detail" aria-label="Headers of the latest message">
      <p className="seq-detail-head mono">{last.label}</p>
      <pre className="mono">
        {last.headers.map((h) => (
          <span key={h} className="seq-detail-line">
            {h}
          </span>
        ))}
      </pre>
    </div>
  );
}
