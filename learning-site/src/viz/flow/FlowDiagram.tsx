import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Controls, Narration } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { DIAGRAMS } from './diagrams';
import { layoutDiagram, pointAt, type Layout } from './layout';
import { stepState } from './state';
import type { FlowDiagramData } from './types';
import './flow.css';

export interface FlowDiagramProps {
  /** Diagram id from src/viz/flow/diagrams (the manifest's `diagram:` value). */
  diagram?: string;
  placement?: string;
}

/** Loads the diagram data (one small chunk per diagram) and hands it to the player. */
export default function FlowDiagram({ diagram = '' }: FlowDiagramProps) {
  const [data, setData] = useState<FlowDiagramData | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const load = DIAGRAMS[diagram];
    if (!load) {
      setProblem(`There is no diagram called "${diagram}". The text version below is the original.`);
      return;
    }
    let live = true;
    load().then(
      (m) => live && setData(m.default),
      () => live && setProblem('The diagram could not be loaded. The text version below is the original.'),
    );
    return () => {
      live = false;
    };
  }, [diagram]);
  if (!data) {
    return (
      <div className="viz flow" role="region" aria-label="Diagram">
        <div className="viz-top"><span className="eyebrow viz-eyebrow">Diagram</span></div>
        <p className="viz-hint flow-wait">{problem ?? 'Loading the diagram…'}</p>
      </div>
    );
  }
  return <FlowPlayer data={data} />;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Container width, kept current with a ResizeObserver so the layout reflows instead of scaling text. */
function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function FlowPlayer({ data }: { data: FlowDiagramData }) {
  const p = usePlayer(data.steps.length, () => false, data.id);
  const [stageRef, width] = useWidth<HTMLDivElement>();
  const layout = useMemo(() => (width ? layoutDiagram(data, width - 4) : null), [data, width]);
  const st = stepState(data, p.index);
  const reduced = useReducedMotion();
  const titleId = useId();
  const step = data.steps[p.index]!;

  // token travel along the edge that leads into this step (forward moves only)
  const token = useRef<SVGCircleElement>(null);
  const prev = useRef(p.index);
  useEffect(() => {
    const from = prev.current;
    prev.current = p.index;
    const el = token.current;
    if (!el || !layout) return;
    const geom = step.edge ? layout.edges.get(step.edge) : undefined;
    if (!geom || reduced || p.index !== from + 1) {
      el.style.opacity = '0';
      return;
    }
    const pts = step.reverse ? [...geom.points].reverse() : geom.points;
    const duration = Math.min(1100, Math.max(160, 520 / p.speed));
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const [x, y] = pointAt(pts, 1 - (1 - t) * (1 - t));
      el.setAttribute('cx', String(x));
      el.setAttribute('cy', String(y));
      el.style.opacity = t < 1 ? '1' : '0';
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [p.index, layout, step, reduced, p.speed]);

  const goToNode = (id: string) => {
    const i = data.steps.findIndex((s, k) => stepState(data, k).focus.has(id));
    if (i >= 0) p.seek(i);
  };
  const onNodeKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToNode(id);
    }
  };

  return (
    <div className="viz flow" role="region" aria-labelledby={titleId} onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Diagram</span>
        <strong className="viz-title" id={titleId}>{data.title}</strong>
        <span className="viz-keys muted">Space plays or pauses · ← → step</span>
      </div>
      <div className="flow-stage" ref={stageRef}>
        {layout && <Drawing data={data} layout={layout} st={st} tokenRef={token} onNode={goToNode} onNodeKey={onNodeKey} />}
      </div>
      <Controls p={p} label={data.title} />
      <div className="flow-foot">
        <Narration text={step.narration} prediction={undefined} p={p} />
        <ul className="legend" aria-label="Colour legend">
          <li><span className="sw sw-active" aria-hidden="true" />This step</li>
          <li><span className="sw sw-settled" aria-hidden="true" />Already passed</li>
          <li><span className="sw flow-sw-idle" aria-hidden="true" />Not reached yet</li>
          {!reduced && <li><span className="flow-sw-token" aria-hidden="true" />Moving along an arrow</li>}
        </ul>
      </div>
    </div>
  );
}

function Drawing({
  data,
  layout,
  st,
  tokenRef,
  onNode,
  onNodeKey,
}: {
  data: FlowDiagramData;
  layout: Layout;
  st: ReturnType<typeof stepState>;
  tokenRef: RefObject<SVGCircleElement | null>;
  onNode: (id: string) => void;
  onNodeKey: (e: KeyboardEvent, id: string) => void;
}) {
  const centred = layout.mode !== 'tree';
  const summary = `${data.title}: ${data.nodes.map((n) => n.label).join(', ')}`;
  return (
    <svg className="flow-svg" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label={summary}>
      {data.edges.map((e) => {
        const g = layout.edges.get(e.id);
        if (!g) return null;
        const cls = st.edge === e.id ? 'is-active' : st.visitedEdges.has(e.id) ? 'is-visited' : '';
        return (
          <g key={e.id} className={`flow-edge ${cls}`} data-edge={e.id}>
            <polyline points={g.points.map((pt) => pt.join(',')).join(' ')} />
            {g.heads.map((h, i) => (
              <polygon key={i} className="head" points={h.map((pt) => pt.join(',')).join(' ')} />
            ))}
          </g>
        );
      })}
      {data.edges.map((e) => {
        const l = layout.edges.get(e.id)?.label;
        if (!l) return null;
        return (
          <g key={`l-${e.id}`} className={`flow-label${st.edge === e.id ? ' is-active' : ''}`}>
            <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={4} />
            {l.lines.map((line, i) => (
              <text key={i} x={l.x + l.w / 2} y={l.y + 12 + i * 14} textAnchor="middle">{line}</text>
            ))}
          </g>
        );
      })}
      {data.nodes.map((n) => {
        const b = layout.boxes.get(n.id)!;
        const cls = st.focus.has(n.id) ? 'is-active' : st.visited.has(n.id) ? 'is-visited' : '';
        const tx = centred ? b.x + b.w / 2 : b.x + 10;
        return (
          <g
            key={n.id}
            className={`flow-node ${cls}${b.plain ? ' plain' : ''}`}
            data-node={n.id}
            role="button"
            tabIndex={0}
            aria-label={`Show the step for: ${[n.label, ...(n.lines ?? [])].join(' ')}`}
            onClick={() => onNode(n.id)}
            onKeyDown={(e) => onNodeKey(e, n.id)}
          >
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} />
            {b.lines.map((line, i) => (
              <text key={i} x={tx} y={b.y + (layout.mode === 'tree' ? 6 : 8) + 13 + i * 17} textAnchor={centred ? 'middle' : 'start'} className={i < b.labelLines ? 'lbl' : 'sub'}>
                {line}
              </text>
            ))}
          </g>
        );
      })}
      <circle ref={tokenRef} className="flow-token" r={6} cx={-20} cy={-20} style={{ opacity: 0 }} aria-hidden="true" />
    </svg>
  );
}
