import { hierarchy, tree as d3tree } from 'd3-hierarchy';
import type { HashTableState } from '../hash/model';
import { HashTableView } from '../hash/HashTableView';
import type { LinkedListState } from './linkedlist';
import type { ListState } from './list';
import { firstChildOf, type PQState } from './pq';
import type { RBNode, SortedState } from './sorted';
import type { SeqState } from './stackqueue';
import type { CollectionHighlight } from './types';

export function cellClass(i: number, hl: CollectionHighlight): string {
  if (hl.write?.includes(i)) return 'is-swap';
  if (hl.compare?.includes(i)) return 'is-compare';
  if (hl.active?.includes(i)) return 'is-active';
  if (hl.found?.includes(i)) return 'is-settled';
  return '';
}

function Cells({ values, hl, labels, ptr, caption, faded, emptyFrom }: { values: (number | null)[]; hl: CollectionHighlight; labels?: (string | number)[]; ptr?: (string | null)[]; caption?: string; faded?: boolean; emptyFrom?: number }) {
  return (
    <div className="cv-block">
      {caption && <div className="cv-caption">{caption}</div>}
      <div className="cv-row" role="img" aria-label={`${caption ?? 'Cells'}: ${values.map((v) => (v === null ? 'empty' : v)).join(', ') || 'none'}`}>
        {values.length === 0 && <span className="cv-caption">(no slots)</span>}
        {values.map((v, i) => {
          const empty = v === null || (emptyFrom !== undefined && i >= emptyFrom);
          return (
            <div className="cv-cellcol" key={i}>
              <span className={`cv-cell ${empty ? 'is-empty' : ''} ${faded ? 'is-out' : cellClass(i, hl)}`}>{empty ? '' : v}</span>
              <span className="cv-idx">{labels ? labels[i] : i}</span>
              {ptr && <span className="cv-ptr">{ptr[i] ?? ''}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ListView({ s, hl }: { s: ListState; hl: CollectionHighlight }) {
  const ptr = s.items.map((_, i) => (i === s.count ? 'Count' : null));
  return (
    <>
      {s.old && <Cells values={s.old} hl={{}} caption={`old array (Capacity ${s.old.length}), being copied from`} faded />}
      <Cells values={s.items} hl={hl} caption={`items: the backing array, Capacity ${s.items.length}`} ptr={ptr} emptyFrom={s.old ? undefined : s.count} />
    </>
  );
}

export function LinkedListView({ s, hl }: { s: LinkedListState; hl: CollectionHighlight }) {
  return (
    <div className="cv-row cv-linked" role="img" aria-label={`Linked list: ${s.nodes.map((n) => n.value).join(' ⇄ ') || 'empty'}`}>
      <span className="cv-arrow">null ←</span>
      {s.nodes.map((n, k) => (
        <span key={n.id} className="cv-linked-item">
          {k > 0 && <span className="cv-arrow" aria-hidden="true">⇄</span>}
          <span className="cv-cellcol">
            <span className={`cv-cell ${cellClass(k, hl)}`}>{n.value}</span>
            <span className="cv-idx">{k === 0 && k === s.nodes.length - 1 ? 'First, Last' : k === 0 ? 'First' : k === s.nodes.length - 1 ? 'Last' : ''}</span>
            <span className="cv-ptr">{s.held === n.id ? 'node' : ''}</span>
          </span>
        </span>
      ))}
      <span className="cv-arrow">→ null</span>
    </div>
  );
}

export function StackView({ s, hl }: { s: SeqState; hl: CollectionHighlight }) {
  return (
    <div className="cv-stack" role="img" aria-label={`Stack, bottom to top: ${s.items.join(', ') || 'empty'}`}>
      {s.items.length === 0 && <span className="cv-caption">empty</span>}
      {s.items.map((v, i) => (
        <div key={i} className="cv-row">
          <span className={`cv-cell ${cellClass(i, hl)}`}>{v}</span>
          {i === s.items.length - 1 && <span className="cv-ptr">← top</span>}
        </div>
      ))}
    </div>
  );
}

export function QueueView({ s, hl }: { s: SeqState; hl: CollectionHighlight }) {
  const labels = s.items.map((_, i) => (i === 0 && s.items.length === 1 ? 'front, back' : i === 0 ? 'front' : i === s.items.length - 1 ? 'back' : ''));
  return s.items.length ? <Cells values={s.items} hl={hl} labels={labels} caption="front → back" /> : <span className="cv-caption">empty</span>;
}

export function HashView({ s, hl, name, typeName }: { s: HashTableState; hl: CollectionHighlight; name: string; typeName: string }) {
  return <HashTableView table={s} name={name} typeName={typeName} hl={hl.hash ?? {}} />;
}

interface TDatum {
  key: string;
  idx?: number;
  label?: string;
  sub?: string;
  black?: boolean;
  hole?: boolean;
  placeholder?: boolean;
  children?: TDatum[];
}

function TreeSvg({ root, hl, label, width = 44 }: { root: TDatum; hl: CollectionHighlight; label: string; width?: number }) {
  const h = hierarchy(root);
  const laid = d3tree<TDatum>().nodeSize([width, 62])(h);
  const nodes = laid.descendants().filter((d) => !d.data.placeholder);
  const xs = laid.descendants().map((d) => d.x);
  const minX = Math.min(...xs) - 26;
  const w = Math.max(...xs) - minX + 26;
  const hgt = Math.max(...laid.descendants().map((d) => d.y)) + 72;
  return (
    <svg className="cv-tree" viewBox={`${minX} -26 ${w} ${hgt}`} style={{ maxWidth: `${Math.max(240, w * 1.15)}px` }} role="img" aria-label={label}>
      {laid.links().filter((l) => !l.target.data.placeholder).map((l) => (
        <line key={`${l.source.data.key}-${l.target.data.key}`} className="edge" x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} />
      ))}
      {nodes.map((d) => (
        <g key={d.data.key} className={`node ${d.data.black ? 'is-black' : ''} ${d.data.hole ? 'is-hole' : cellClass(d.data.idx ?? -1, hl)}`} transform={`translate(${d.x},${d.y})`}>
          <circle r={19} />
          <text dy="0.35em" textAnchor="middle">{d.data.hole ? '' : d.data.label}</text>
          {d.data.sub && <text className="sub" dy="2.9em" textAnchor="middle">{d.data.sub}</text>}
        </g>
      ))}
    </svg>
  );
}

export function PQView({ s, hl }: { s: PQState; hl: CollectionHighlight }) {
  const n = s.nodes.length;
  const label = (i: number) => {
    const node = s.nodes[i]!;
    return node.element === node.priority ? `${node.priority}` : `${node.element}:${node.priority}`;
  };
  const build = (i: number): TDatum => {
    const kids = Array.from({ length: 4 }, (_, k) => firstChildOf(i) + k).filter((k) => k < n).map(build);
    return { key: `p${i}`, idx: i, label: s.hole === i ? '' : label(i), sub: `[${i}]`, hole: s.hole === i, ...(kids.length ? { children: kids } : {}) };
  };
  return (
    <>
      {s.moving && (
        <p className="cv-caption">
          Moving: <span className="mono">{s.moving.element === s.moving.priority ? s.moving.priority : `${s.moving.element} (priority ${s.moving.priority})`}</span>, looking for its slot. The empty circle is the free slot.
        </p>
      )}
      {n > 0 ? <TreeSvg root={build(0)} hl={hl} label="The heap drawn as a 4-ary tree" width={40} /> : <span className="cv-caption">empty</span>}
      <Cells values={s.nodes.map((x, i) => (s.hole === i ? null : x.priority))} hl={hl} caption="the same heap as an array (priorities)" />
    </>
  );
}

export function SortedView({ s, hl }: { s: SortedState; hl: CollectionHighlight }) {
  const build = (n: RBNode): TDatum => {
    const kids = n.left || n.right ? [n.left ? build(n.left) : { key: `l${n.id}`, placeholder: true }, n.right ? build(n.right) : { key: `r${n.id}`, placeholder: true }] : [];
    return { key: `n${n.id}`, idx: n.id, label: String(n.key), sub: `→ ${n.value}`, black: !n.red, ...(kids.length ? { children: kids } : {}) };
  };
  return s.root ? <TreeSvg root={build(s.root)} hl={hl} label="The red-black tree behind the dictionary" /> : <span className="cv-caption">empty</span>;
}
