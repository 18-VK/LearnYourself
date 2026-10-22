import { chains, sizeOf, type HashHighlight, type HashTableState } from './model';
import './hash.css';

/**
 * Buckets and their chains. Simplified: .NET keeps all entries in one array and links a bucket's chain
 * through `next` indexes; here each bucket is drawn with its chain under it, front first.
 */
export function HashTableView({ table, name, typeName, hl, dimmed }: { table: HashTableState | null; name: string; typeName: string; hl: HashHighlight; dimmed?: boolean }) {
  if (!table) return null;
  const all = chains(table);
  const size = table.buckets?.length ?? 0;
  const count = sizeOf(table);
  return (
    <div className={`hv${dimmed ? ' is-dim' : ''}`}>
      <div className="hv-head">
        <span className="mono">
          {name}: {typeName}
        </span>
        <span className="muted">
          {count} {table.kind === 'dict' ? 'key' : 'value'}
          {count === 1 ? '' : 's'} · {size ? `${size} buckets` : 'no buckets yet'}
        </span>
      </div>
      {size > 0 && (
        <div className="hv-buckets" role="list" aria-label={`${name} buckets`}>
          {all.map((chain, b) => (
            <div key={b} role="listitem" className={`hv-bucket${hl.bucket === b ? ' is-active' : ''}${chain.length > 1 ? ' has-collision' : ''}`}>
              <span className="hv-idx">[{b}]</span>
              {chain.length === 0 ? (
                <span className="hv-empty" aria-label="empty">∅</span>
              ) : (
                chain.map((i, k) => {
                  const e = table.entries[i]!;
                  const cls = hl.compare === i ? 'is-compare' : hl.write === i ? 'is-swap' : hl.found === i ? 'is-settled' : '';
                  return (
                    <span key={i} className="hv-link">
                      {k > 0 && <span className="hv-arrow" aria-hidden="true">↓</span>}
                      <span className={`hv-entry ${cls}`}>
                        {e.key}
                        {table.kind === 'dict' && <span className="hv-val"> → {e.value}</span>}
                      </span>
                    </span>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
