import { MotionConfig } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { highlightCSharp } from '../../engine/csharp-highlight';
import '../aspnet.css';

/**
 * Shared pieces for the ASP.NET Core visualizers. They reuse the engine's classes (`.viz`, `.viz-top`,
 * `.viz-code`, `.counters`, `.legend`) so every visualizer on the site looks and behaves the same, and add
 * only what the request/response pictures need.
 */

export function VizShell({
  title,
  label,
  claimKeyboard,
  children,
  keys = true,
  badge,
}: {
  title: string;
  label: string;
  claimKeyboard?: () => void;
  children: ReactNode;
  keys?: boolean;
  /** A short tag shown next to the title, e.g. "demo keys". */
  badge?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="viz asp" role="region" aria-label={label} onPointerDown={claimKeyboard} onFocus={claimKeyboard}>
        <div className="viz-top">
          <span className="eyebrow viz-eyebrow">Visualizer</span>
          <strong className="viz-title">{title}</strong>
          {badge && <span className="asp-badge">{badge}</span>}
          {keys && <span className="viz-keys muted">Space plays or pauses · ← → step</span>}
        </div>
        {children}
      </div>
    </MotionConfig>
  );
}

/**
 * A code or text panel with any number of highlighted lines (the engine's CodePanel highlights exactly one).
 * `lines` are 1-based; an empty list highlights nothing.
 */
export function SourcePanel({
  code,
  lines,
  title,
  lang = 'csharp',
  note,
}: {
  code: string;
  lines: readonly number[];
  title: string;
  lang?: 'csharp' | 'text';
  /** Shown under the title, e.g. "lines from the note, in your order". */
  note?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const rows = code.split('\n');
  const first = lines.length ? Math.min(...lines) : 0;
  useEffect(() => {
    const b = box.current;
    const el = b?.querySelector<HTMLElement>(`[data-line="${first}"]`);
    if (!el || !b) return;
    const top = el.offsetTop;
    if (top < b.scrollTop + 32 || top + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = Math.max(0, top - b.clientHeight / 2);
  }, [first, code]);
  const where = lines.length ? `line${lines.length > 1 ? 's' : ''} ${lines.join(', ')}` : 'no line';
  return (
    <div className="viz-code" ref={box} tabIndex={0} aria-label={`${title}, ${where} highlighted`}>
      <div className="viz-code-head">
        <span>{title}</span>
        <span className="mono">{lines.length ? where : ''}</span>
      </div>
      {note && <p className="asp-code-note">{note}</p>}
      <ol>
        {rows.map((l, i) => {
          const on = lines.includes(i + 1);
          return (
            <li key={i} data-line={i + 1} className={on ? 'is-current' : undefined} aria-current={on ? 'step' : undefined}>
              {l ? (lang === 'csharp' ? highlightCSharp(l) : l) : ' '}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Counters with area-specific labels, in the engine's `.counters` style. */
export function Stats({ items, label = 'Counters' }: { items: [string, number | string, string?][]; label?: string }) {
  return (
    <div className="counters asp-stats" aria-label={label}>
      {items.map(([l, v, tone]) => (
        <div key={l} className={tone ? `tone-${tone}` : undefined}>
          <b>{v}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

/** A legend using the shared swatch colours (`sw-settled`, `sw-swap`, …) or area swatches (`sw-jwt-h`, …). */
export function AspLegend({ items }: { items: [swatch: string, label: string][] }) {
  return (
    <ul className="legend" aria-label="Colour legend">
      {items.map(([k, label]) => (
        <li key={label}>
          <span className={`sw sw-${k}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** A status-code pill coloured by outcome: 2xx accepted, 4xx/5xx rejected. */
export function StatusPill({ code, text }: { code: number; text?: string }) {
  const tone = code < 300 ? 'ok' : code < 400 ? 'redirect' : 'bad';
  return (
    <span className={`asp-status asp-status-${tone}`}>
      <b>{code}</b>
      {text ? ` ${text}` : ''}
    </span>
  );
}

/** Small labelled radio-like chip group. */
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="presets" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="chipbtn" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "Simplified" label for pictures that leave out real-world detail (always shown next to such a picture). */
export function Simplified({ children }: { children: ReactNode }) {
  return (
    <p className="asp-simplified">
      <span className="asp-tag">Simplified</span> {children}
    </p>
  );
}
