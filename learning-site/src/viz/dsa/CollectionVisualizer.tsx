import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CodePanel, Controls } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { STRUCTURES, type AnyDef } from './collections';
import { LINKED_EXAMPLE, noteExample } from './collections/linkedlist';
import { LIST_DEF } from './collections/list';
import type { ArgKind, Cost, OpDef, OpTrace } from './collections/types';
import { HashView, LinkedListView, ListView, PQView, QueueView, SortedView, StackView } from './collections/views';
import './dsa.css';

export interface CollectionVisualizerProps {
  /** Which collections to show, as tabs: list-capacity, linked-list, dictionary-buckets, hash-set, sorted-dictionary, stack, queue, priority-queue-heap. */
  structures?: string[];
  placement?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function View({ def, state, hl }: { def: AnyDef; state: any; hl: any }) {
  switch (def.id) {
    case 'list-capacity':
      return <ListView s={state} hl={hl} />;
    case 'linked-list':
      return <LinkedListView s={state} hl={hl} />;
    case 'dictionary-buckets':
      return <HashView s={state} hl={hl} name="dict" typeName="Dictionary<int, int>" />;
    case 'hash-set':
      return <HashView s={state} hl={hl} name="set" typeName="HashSet<int>" />;
    case 'sorted-dictionary':
      return <SortedView s={state} hl={hl} />;
    case 'stack':
      return <StackView s={state} hl={hl} />;
    case 'queue':
      return <QueueView s={state} hl={hl} />;
    default:
      return <PQView s={state} hl={hl} />;
  }
}

const plain = (s: string) => s.replace(/`|\*\*/g, '');
const fromDocs = (c: Cost) => c.source !== 'notes';

interface Ran {
  defId: string;
  trace: OpTrace<any>;
  n: number;
  example?: boolean;
}

/** Which inputs each kind of operation reads. */
const NEEDS: Record<ArgKind, ('a' | 'b')[]> = { none: [], value: ['a'], index: ['b'], 'index-value': ['b', 'a'], key: ['a'], 'key-value': ['a', 'b'], 'element-priority': ['a', 'b'] };

export default function CollectionVisualizer(props: CollectionVisualizerProps) {
  const id = useId();
  const defs = useMemo(() => (props.structures ?? ['list-capacity']).map((s) => STRUCTURES[s]).filter((d): d is AnyDef => Boolean(d)), [props.structures]);
  const [tab, setTab] = useState(0);
  const def: AnyDef = defs[Math.min(tab, defs.length - 1)] ?? (LIST_DEF as AnyDef);
  const [states, setStates] = useState<Record<string, any>>(() => Object.fromEntries(defs.map((d) => [d.id, d.initial()])));
  const [ran, setRan] = useState<Ran | null>(null);
  const [log, setLog] = useState<{ call: string; work: string; error?: string }[]>([]);
  const [a, setA] = useState(25);
  const [b, setB] = useState(defs[0]?.id === 'priority-queue-heap' ? 2 : 1);
  const counter = useRef(0);

  const current = ran && ran.defId === def.id ? ran : null;
  const steps = current?.trace.steps ?? [];
  const p = usePlayer(steps.length, () => false, current?.n ?? -1);
  useEffect(() => {
    if (current && steps.length > 1) p.play();
    // play once per new operation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.n]);
  const step = steps.length ? steps[Math.min(p.index, steps.length - 1)] : null;
  const shown = step ? step.state : states[def.id];
  const hl = step?.hl ?? {};

  const labels = (op: OpDef<any>): [string, string] => {
    switch (op.arg) {
      case 'key-value':
        return ['key', 'value'];
      case 'element-priority':
        return ['element', 'priority'];
      case 'index-value':
        return ['value', def.id === 'linked-list' ? 'position' : 'index'];
      default:
        return [def.id === 'dictionary-buckets' || def.id === 'sorted-dictionary' ? 'key' : 'value', def.id === 'linked-list' ? 'position' : 'index'];
    }
  };
  const needed = new Set(def.ops.flatMap((o) => NEEDS[o.arg]));
  const [aLabel, bLabel] = labels(def.ops.find((o) => o.arg !== 'none' && o.arg !== 'index') ?? def.ops[0]!);

  const runOp = (op: OpDef<any>) => {
    const trace = op.run(states[def.id], a, b);
    counter.current++;
    setRan({ defId: def.id, trace, n: counter.current });
    if (trace.steps.length) setStates((s) => ({ ...s, [def.id]: trace.steps.at(-1)!.state }));
    setLog((l) => [{ call: trace.call, work: trace.work, ...(trace.error ? { error: trace.error } : {}) }, ...l].slice(0, 30));
  };
  const runExample = () => {
    const trace = noteExample();
    counter.current++;
    setRan({ defId: def.id, trace, n: counter.current, example: true });
    setStates((s) => ({ ...s, [def.id]: trace.steps.at(-1)!.state }));
    setLog((l) => [{ call: "the cheat sheet's LinkedList example", work: trace.work }, ...l].slice(0, 30));
  };
  const reset = () => {
    setStates((s) => ({ ...s, [def.id]: def.initial() }));
    setRan(null);
    setLog([]);
  };

  const cost = current?.trace.cost ?? null;
  const narration = current?.trace.error && (!step || p.atEnd) ? current.trace.error : step?.narration ?? `Pick an operation. The starting state is: ${def.setup.replace(/\/\/.*$/, '').trim()}`;

  return (
    <div className="viz cv" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard} role="region" aria-label={`${def.title} visualizer`}>
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Visualizer</span>
        {defs.length > 1 ? (
          <div className="cv-tabs" role="group" aria-label="Collection">
            {defs.map((d, k) => (
              <button key={d.id} type="button" className="chipbtn mono" aria-pressed={k === tab} onClick={() => (setTab(k), setRan(null))}>
                {d.title}
              </button>
            ))}
          </div>
        ) : (
          <strong className="viz-title mono">{def.title}</strong>
        )}
        <span className="viz-keys muted">{def.summary(states[def.id])}</span>
      </div>

      <div className="viz-input">
        {needed.has('a') && (
          <label htmlFor={`${id}-a`}>
            {aLabel}
            <input id={`${id}-a`} className="cv-num" type="number" min={0} max={999} value={a} onChange={(e) => setA(Math.max(-999, Math.min(999, Math.trunc(Number(e.target.value) || 0))))} />
          </label>
        )}
        {needed.has('b') && (
          <label htmlFor={`${id}-b`}>
            {bLabel}
            <input id={`${id}-b`} className="cv-num" type="number" min={def.id === 'priority-queue-heap' ? -999 : 0} max={999} value={b} onChange={(e) => setB(Math.max(-999, Math.min(999, Math.trunc(Number(e.target.value) || 0))))} />
          </label>
        )}
        <div className="cv-ops" role="group" aria-label="Operations">
          {def.ops.map((op) => {
            const blocked = op.blocked?.(states[def.id]) ?? null;
            return (
              <button key={op.id} type="button" className="btn" onClick={() => runOp(op)} disabled={blocked !== null} title={blocked ?? undefined}>
                {op.label}
              </button>
            );
          })}
          {def.id === 'linked-list' && (
            <button type="button" className="btn btn-primary" onClick={runExample}>
              Run the cheat sheet's example
            </button>
          )}
          <button type="button" className="chipbtn" onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      {current && (
        <div className="cv-call">
          <code>{current.trace.call}</code>
          {cost && (
            <span className="cv-cost">
              <span className="muted">{fromDocs(cost) ? 'Cost (Microsoft docs):' : 'Cost (from the notes):'}</span>
              <b>{plain(cost.cost)}</b>
            </span>
          )}
          <span className="muted">This call: {current.trace.work}.</span>
        </div>
      )}

      <div className="cv-stage">
        <View def={def} state={shown} hl={hl} />
      </div>
      {def.simplified && <p className="viz-hint">Simplified: {def.simplified}</p>}

      {steps.length > 0 && <Controls p={p} label={def.title} />}
      <div className={current?.example ? 'viz-panels' : 'cv-side'}>
        {current?.example && <CodePanel code={LINKED_EXAMPLE} line={step?.codeLine ?? 1} title="C# from the cheat sheet" />}
        <div className="viz-side">
          <p className={`narr${current?.trace.error && (!step || p.atEnd) ? ' cv-error' : ''}`} aria-live="polite">
            {narration}
          </p>
          <ul className="legend" aria-label="Colour legend">
            <li><span className="sw sw-compare" aria-hidden="true" />Compared or looked at</li>
            <li><span className="sw sw-swap" aria-hidden="true" />Written or moved</li>
            <li><span className="sw sw-active" aria-hidden="true" />Current</li>
            <li><span className="sw sw-settled" aria-hidden="true" />Found or returned</li>
            {(def.id === 'dictionary-buckets' || def.id === 'hash-set') && (
              <li><span className="sw sw-bucket" aria-hidden="true" />Bucket being looked at</li>
            )}
            {def.id === 'sorted-dictionary' && (
              <>
                <li><span className="sw sw-black" aria-hidden="true" />Black node</li>
                <li><span className="sw sw-red" aria-hidden="true" />Red node</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="cv-costs">
        <table className="cv-cost-table">
          <caption className="sr-only">Costs of {def.title} operations</caption>
          <thead>
            <tr>
              <th scope="col">Operation</th>
              <th scope="col">Cost</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {def.costs.map((c) => (
              <tr key={c.ops} className={cost && cost.ops === c.ops ? 'is-current' : undefined}>
                <th scope="row" className="mono">{plain(c.ops)}</th>
                <td className="mono">{plain(c.cost)}</td>
                <td>
                  {c.note ? plain(c.note) : ''}
                  {fromDocs(c) && (
                    <>
                      {c.note ? ' ' : ''}
                      <a href={c.source} rel="noopener" target="_blank">Microsoft docs</a>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="cv-caption">Costs from the notes' "{def.section.replace(/^#+\s*/, '')}" section, unless marked as Microsoft docs.</p>
      </div>
      {log.length > 0 && (
        <ol className="cv-log" aria-label="Operations so far, newest first">
          {log.map((l, k) => (
            <li key={log.length - k}>
              <code>{l.call}</code>
              <span>{l.error ? l.error.split(':')[0] : l.work}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
