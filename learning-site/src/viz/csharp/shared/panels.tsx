import { MotionConfig } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { highlightCSharp } from '../../engine/csharp-highlight';
import { Controls, Narration, Variables } from '../../engine/panels';
import type { Prediction } from '../../engine/types';
import type { PlayerApi } from '../../engine/usePlayer';
import { locate, type CodeDoc } from './step';
import '../csharp.css';

/**
 * Code panel for one or more verbatim snippets. Each snippet keeps its own line numbers (as in the note)
 * and a small source caption, so a scenario that spans two blocks of a note never shows joined text.
 * `line` is the global line used by the traces; `also` marks extra lines (a second thread, the other side
 * of a comparison) with a softer highlight.
 */
export function DocPanel({ doc, line, also = [], title = 'C# from the notes' }: { doc: CodeDoc; line: number; also?: number[]; title?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const cur = locate(doc, line);
  const extra = also.map((l) => locate(doc, l));
  useEffect(() => {
    const b = box.current;
    const el = b?.querySelector<HTMLElement>('li.is-current');
    if (!el || !b) return;
    const top = el.offsetTop;
    if (top < b.scrollTop + 32 || top + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = Math.max(0, top - b.clientHeight / 2);
  }, [line]);
  return (
    <div className="viz-code cs-doc" ref={box} tabIndex={0} aria-label={`${title}, line ${cur.line} of ${doc.parts[cur.part]?.title ?? 'the code'} is running`}>
      <div className="viz-code-head">
        <span>{title}</span>
        <span className="mono">line {cur.line}</span>
      </div>
      {doc.parts.map((p, pi) => (
        <div key={pi} className="cs-doc-part">
          <div className={`cs-doc-src${p.key ? '' : ' is-composed'}`}>{p.key ? p.title : `${p.title} (not a block from the notes)`}</div>
          <ol>
            {p.code.split('\n').map((l, i) => {
              const isCur = cur.part === pi && cur.line === i + 1;
              const isAlso = !isCur && extra.some((x) => x.part === pi && x.line === i + 1);
              return (
                <li key={i} data-line={i + 1} className={isCur ? 'is-current' : isAlso ? 'is-also' : undefined} aria-current={isCur ? 'step' : undefined}>
                  {l ? highlightCSharp(l) : ' '}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

/** Small labelled numbers, styled like the engine's counters panel. */
export function Tally({ items, label = 'Counters' }: { items: [string, number | string][]; label?: string }) {
  if (!items.length) return null;
  return (
    <div className="counters cs-tally" aria-label={label} style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
      {items.map(([l, v]) => (
        <div key={l}>
          <b>{v}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

/** What the program has printed so far. */
export function ConsoleOut({ lines, title = 'Console output', empty = 'Nothing printed yet.' }: { lines: string[]; title?: string; empty?: string }) {
  return (
    <div className="cs-console" aria-label={title}>
      <div className="cs-console-head">{title}</div>
      {lines.length ? (
        <pre>{lines.map((l, i) => (i === lines.length - 1 ? <span key={i} className="is-new">{l}</span> : <span key={i}>{l}{'\n'}</span>))}</pre>
      ) : (
        <p className="cs-console-empty">{empty}</p>
      )}
    </div>
  );
}

export interface LegendItem {
  /** A shared colour class (compare, swap, active, settled, idle, ptr) or an area class (blocked, free, wait, lost). */
  kind: string;
  label: string;
}

/** Legend with the same swatches and meanings as the sorting visualizer, plus area-specific extras. */
export function CsLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="legend cs-legend" aria-label="Colour legend">
      {items.map((it) => (
        <li key={it.kind + it.label}>
          <span className={`sw sw-${it.kind}`} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export interface PartOption {
  id: string;
  label: string;
}

/** Chip buttons that pick which example (part) of the scenario is playing. */
export function PartPicker({ parts, value, onChange, label = 'Example' }: { parts: PartOption[]; value: string; onChange: (id: string) => void; label?: string }) {
  if (parts.length < 2) return null;
  return (
    <div className="presets cs-parts" role="group" aria-label={label}>
      <span className="cs-parts-label">{label}</span>
      {parts.map((pt) => (
        <button key={pt.id} type="button" className="chipbtn" aria-pressed={value === pt.id} onClick={() => onChange(pt.id)}>
          {pt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The frame every C# visualizer shares: title bar, options row, stage, playback controls, then code and
 * the side panels (narration first, so it sits right under the controls on a phone).
 */
export function VizShell({
  title,
  label,
  p,
  options,
  hint,
  stage,
  doc,
  line,
  also,
  codeTitle,
  narration,
  prediction,
  vars,
  side,
  predictable = true,
}: {
  title: string;
  label: string;
  p: PlayerApi & { claimKeyboard: () => void };
  options?: ReactNode;
  hint?: ReactNode;
  stage: ReactNode;
  doc: CodeDoc;
  line: number;
  also?: number[];
  codeTitle?: string;
  narration: string;
  prediction: Prediction | undefined;
  vars?: Record<string, string | number | boolean>;
  side?: ReactNode;
  /** false hides the predict-mode toggle (for scenarios with no questions). */
  predictable?: boolean;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="viz cs-viz" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard} aria-label={label} role="region">
        <div className="viz-top">
          <span className="eyebrow viz-eyebrow">Visualizer</span>
          <strong className="viz-title">{title}</strong>
          <span className="viz-keys muted">Space plays or pauses · ← → step</span>
        </div>
        {(options || predictable) && (
          <div className="viz-input">
            {options}
            {predictable && (
              <label className="toggle">
                <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
              </label>
            )}
          </div>
        )}
        {hint && <div className="viz-hint cs-hint">{hint}</div>}
        <div className="viz-stage cs-stage">{stage}</div>
        <Controls p={p} label={title} />
        <div className="viz-panels">
          <DocPanel doc={doc} line={line} also={also} title={codeTitle} />
          <div className="viz-side">
            <Narration text={narration} prediction={prediction} p={p} />
            {vars && <Variables vars={vars} />}
            {side}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
