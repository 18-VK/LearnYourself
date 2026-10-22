/// <reference types="vite/client" />
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { highlightSql } from './highlight';
import { fmtCell, type Mark, type TableView } from './model';
import './sql.css';

const MARK_CLASS: Record<Mark, string> = {
  compare: 'is-compare',
  write: 'is-swap',
  active: 'is-active',
  settled: 'is-settled',
  out: 'is-out',
  removed: 'is-removed',
};
/** Text equivalents, so a row's state never depends on colour alone. */
const MARK_SYMBOL: Record<Mark, { sym: string; label: string }> = {
  compare: { sym: '?', label: 'being checked' },
  write: { sym: '+', label: 'just added' },
  active: { sym: '▸', label: 'current row' },
  settled: { sym: '✓', label: 'done' },
  out: { sym: '', label: '' },
  removed: { sym: '✕', label: 'removed' },
};

export interface SqlBlock {
  /** Small label above the block, e.g. "Session 1". */
  label?: string;
  code: string;
  /** Lines (1-based) drawn faded, e.g. an INCLUDE clause the current mode leaves out. */
  faded?: number[];
  /** Plain text (the note's text diagrams): no SQL colouring. */
  plain?: boolean;
}

/** The SQL code panel: one or more verbatim blocks from the notes, with the running lines highlighted. */
export function SqlPanel({ blocks, active, title = 'SQL from the notes', note }: { blocks: SqlBlock[]; active: { block: number; lines: number[] }; title?: string; note?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const first = active.lines[0] ?? 0;
  useEffect(() => {
    const b = box.current;
    const el = b?.querySelector<HTMLElement>(`[data-block="${active.block}"] [data-line="${first}"]`);
    if (!el || !b) return;
    const top = el.offsetTop;
    if (top < b.scrollTop + 32 || top + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = Math.max(0, top - b.clientHeight / 2);
  }, [active.block, first]);
  const range = active.lines.length > 1 ? `lines ${Math.min(...active.lines)}–${Math.max(...active.lines)}` : active.lines.length ? `line ${first}` : '';
  return (
    <div className="viz-code sql-code" ref={box} tabIndex={0} aria-label={`${title}${range ? `, ${range} highlighted` : ''}`}>
      <div className="viz-code-head"><span>{title}</span><span className="mono">{blocks.length > 1 && active.lines.length ? `${blocks[active.block]?.label ?? ''} ${range}` : range}</span></div>
      {blocks.map((b, bi) => (
        <div key={bi} data-block={bi} className="sql-block">
          {b.label && <div className="sql-block-label">{b.label}</div>}
          <ol>
            {b.code.split('\n').map((l, i) => {
              const cur = bi === active.block && active.lines.includes(i + 1);
              const cls = [cur ? 'is-current' : '', b.faded?.includes(i + 1) ? 'is-faded' : ''].filter(Boolean).join(' ');
              return (
                <li key={i} data-line={i + 1} className={cls || undefined} aria-current={cur ? 'step' : undefined}>
                  {l ? (b.plain ? l : highlightSql(l)) : ' '}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      {note && <p className="sql-code-note">{note}</p>}
    </div>
  );
}

/** One table on the stage. NULL cells are drawn as a labelled NULL marker. */
export function DataTable({ t, compact }: { t: TableView; compact?: boolean }) {
  const reduce = useReducedMotion();
  const groupAt = new Map((t.groups ?? []).map((g) => [g.from, g]));
  const cols = t.columns.length + 1 + (t.notes?.some(Boolean) ? 1 : 0);
  return (
    <figure className={`sql-tbl${compact ? ' is-compact' : ''}`} data-table={t.id}>
      <figcaption>{t.caption}</figcaption>
      <div className="sql-tbl-scroll">
        <table>
          <thead>
            <tr>
              <th className="mk" aria-hidden="true" />
              {t.columns.map((c) => (
                <th key={c} scope="col">{c}</th>
              ))}
              {t.notes?.some(Boolean) && <th className="nt"><span className="sql-vh">Note</span></th>}
            </tr>
          </thead>
          <tbody>
            {t.rows.length === 0 && (
              <tr className="empty">
                <td colSpan={cols}>{t.empty ?? 'No rows yet'}</td>
              </tr>
            )}
            {t.rows.map((r, i) => {
              const mark = t.marks?.[i] ?? null;
              const g = groupAt.get(i);
              const sym = mark ? MARK_SYMBOL[mark] : null;
              const rowEl = (
                <motion.tr
                  key={t.rowIds?.[i] ?? i}
                  className={mark ? MARK_CLASS[mark] : undefined}
                  initial={reduce ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.22 }}
                >
                  <td className="mk">{sym?.sym}{sym?.label && <span className="sql-vh"> {sym.label}</span>}</td>
                  {r.map((v, c) => {
                    const cm = t.cellMarks?.[`${i}:${c}`];
                    const cls = [v === null ? 'is-null' : '', typeof v === 'number' ? 'num' : '', cm ? MARK_CLASS[cm] : ''].filter(Boolean).join(' ');
                    return (
                      <td key={c} className={cls || undefined}>
                        {fmtCell(v, t.decimals?.[c])}
                      </td>
                    );
                  })}
                  {t.notes?.some(Boolean) && <td className="nt">{t.notes?.[i] ?? ''}</td>}
                </motion.tr>
              );
              return g ? (
                <GroupRows key={`g${i}`} label={g.label} cols={cols} row={rowEl} />
              ) : (
                rowEl
              );
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function GroupRows({ label, cols, row }: { label: string; cols: number; row: ReactNode }) {
  return (
    <>
      <tr className="grp">
        <th colSpan={cols} scope="rowgroup">{label}</th>
      </tr>
      {row}
    </>
  );
}

export function Tables({ tables, compact }: { tables: TableView[]; compact?: boolean }) {
  return (
    <div className="sql-tables">
      {tables.map((t) => (
        <DataTable key={t.id} t={t} compact={compact} />
      ))}
    </div>
  );
}

export function SqlCounters({ items }: { items: [string, number | string][] }) {
  return (
    <div className="counters sql-counters" aria-label="Counters">
      {items.map(([l, v]) => (
        <div key={l}><b>{v}</b><span>{l}</span></div>
      ))}
    </div>
  );
}

const LEGEND: Record<string, string> = {
  active: 'Current row',
  compare: 'Being checked',
  write: 'Just added to the result',
  settled: 'Matched or done',
  removed: 'Removed by this step',
};

export function SqlLegend({ items, extra }: { items: (keyof typeof LEGEND)[]; extra?: [string, string][] }) {
  const sw: Record<string, string> = { active: 'active', compare: 'compare', write: 'swap', settled: 'settled', removed: 'removed' };
  return (
    <ul className="legend sql-legend" aria-label="Colour legend">
      {items.map((k) => (
        <li key={k}><span className={`sw sw-${sw[k]}`} aria-hidden="true">{k === 'removed' ? '✕' : ''}</span>{LEGEND[k]}</li>
      ))}
      <li><span className="sw sw-null" aria-hidden="true">N</span>NULL</li>
      {extra?.map(([cls, label]) => (
        <li key={label}><span className={`sw ${cls}`} aria-hidden="true" />{label}</li>
      ))}
    </ul>
  );
}

export interface ChipOption<T extends string> {
  id: T;
  label: string;
  title?: string;
}

export function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: ChipOption<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="presets sql-chips" role="group" aria-label={label}>
      <span className="sql-chips-label" aria-hidden="true">{label}</span>
      {options.map((o) => (
        <button key={o.id} type="button" className="chipbtn" aria-pressed={value === o.id} title={o.title} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled select for the input bar. */
export function Pick<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <label htmlFor={id}>
      {label}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** The visualizer header row, matching the sorting visualizer's. */
export function VizTop({ title }: { title: string }) {
  return (
    <div className="viz-top">
      <span className="eyebrow viz-eyebrow">Visualizer</span>
      <strong className="viz-title">{title}</strong>
      <span className="viz-keys muted">Space plays or pauses · ← → step</span>
    </div>
  );
}

/** "Edit data" disclosure used for the learner's own values. */
export function DataEditor({ title, children, edited, onReset }: { title: string; children: ReactNode; edited: boolean; onReset: () => void }) {
  return (
    <details className="sql-edit">
      <summary>
        {title}
        {edited && <span className="sql-edited">edited</span>}
      </summary>
      <div className="sql-edit-body">
        {children}
        <button type="button" className="chipbtn" onClick={onReset} disabled={!edited}>
          Reset to the note's data
        </button>
      </div>
    </details>
  );
}
