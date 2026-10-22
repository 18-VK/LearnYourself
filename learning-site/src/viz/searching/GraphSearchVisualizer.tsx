import { useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { CodePanel, Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { SEARCH_CODE } from './csharp';
import { buildAdjacency, edgeKey, formatEdges, GRAPH_PRESET, GRID_PRESET, gridGraph, parseEdges, type Edge, type GraphNode } from './graph-model';
import { traceBFS, traceDFS, type GraphState } from './traces/graph';
import './searching.css';

export interface GraphSearchVisualizerProps {
  algorithm?: string;
  /** Show the editing tools (start, target, edges, nodes, walls). */
  editable?: boolean;
  /** Which layouts to offer: `graph` (nodes and edges) and `grid-as-graph` (a grid whose open cells are nodes). */
  presets?: string[];
  predictMode?: boolean;
  placement?: string;
}

type Layout = 'graph' | 'grid';
type Tool = 'start' | 'target' | 'edge' | 'node' | 'wall';
const MAX_NODES = 12;

/** Summary Table rows for BFS and DFS in the note: Time (avg), Time (worst), Space. */
const COMPLEXITY = { bfs: ['O(V+E)', 'O(V+E)', 'O(V)'], dfs: ['O(V+E)', 'O(V+E)', 'O(V)'] } as const;

function nodeClass(id: number, st: GraphState, target: number): string {
  const cls = ['gs-node'];
  if (st.found === id) cls.push('is-settled', 'is-found');
  else if (st.next === id) cls.push('is-compare');
  else if (st.current === id) cls.push('is-active');
  else if (st.done.includes(id)) cls.push('is-settled');
  else if (st.visited.includes(id) || st.stack?.includes(id)) cls.push('is-visited');
  if (id === target) cls.push('is-target');
  return cls.join(' ');
}

export default function GraphSearchVisualizer(props: GraphSearchVisualizerProps) {
  const id = useId();
  const algorithm = props.algorithm === 'dfs' ? 'dfs' : 'bfs';
  const isBfs = algorithm === 'bfs';
  const layouts: Layout[] = (props.presets ?? ['graph']).map((p) => (p === 'grid-as-graph' || p === 'grid' ? 'grid' : 'graph'));
  const [layout, setLayout] = useState<Layout>(layouts[0] ?? 'graph');
  const [nodes, setNodes] = useState<GraphNode[]>(GRAPH_PRESET.nodes);
  const [edges, setEdges] = useState<Edge[]>(GRAPH_PRESET.edges);
  const [walls, setWalls] = useState<Set<number>>(() => new Set(GRID_PRESET.walls));
  const [start, setStart] = useState<Record<Layout, number>>({ graph: GRAPH_PRESET.start, grid: GRID_PRESET.start });
  const [target, setTarget] = useState<Record<Layout, number>>({ graph: GRAPH_PRESET.target, grid: GRID_PRESET.target });
  const [tool, setTool] = useState<Tool>('start');
  const [pending, setPending] = useState<number | null>(null);
  const [edgeDraft, setEdgeDraft] = useState(() => formatEdges(GRAPH_PRESET.edges));
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { rows, cols } = GRID_PRESET;
  const grid = useMemo(() => gridGraph(rows, cols, walls), [rows, cols, walls]);
  const adjacency = useMemo(() => (layout === 'grid' ? grid.graph : buildAdjacency(edges)), [layout, grid, edges]);
  const s = start[layout];
  const t = target[layout];
  const trace = useMemo(() => (isBfs ? traceBFS(adjacency, s, t) : traceDFS(adjacency, s, t)), [isBfs, adjacency, s, t]);
  const signature = `${layout}:${s}:${t}:${layout === 'grid' ? [...walls].sort().join(',') : formatEdges(edges)}`;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), signature, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const st = step.state;
  const code = isBfs ? SEARCH_CODE.bfs : SEARCH_CODE.dfs;
  const label = isBfs ? 'Breadth-first search (BFS)' : 'Depth-first search (DFS)';

  const setEdgesBoth = (next: Edge[]) => {
    setEdges(next);
    setEdgeDraft(formatEdges(next));
  };
  const toggleEdge = (a: number, b: number) => {
    if (a === b) return;
    const k = edgeKey(a, b);
    const has = edges.some(([x, y]) => edgeKey(x, y) === k);
    setEdgesBoth(has ? edges.filter(([x, y]) => edgeKey(x, y) !== k) : [...edges, [Math.min(a, b), Math.max(a, b)] as const]);
  };
  const removeNode = (n: number) => {
    if (nodes.length <= 2) {
      setError('Keep at least two nodes.');
      return;
    }
    const rest = nodes.filter((x) => x.id !== n);
    setNodes(rest);
    setEdgesBoth(edges.filter(([a, b]) => a !== n && b !== n));
    if (s === n) setStart((v) => ({ ...v, graph: rest[0]!.id }));
    if (t === n) setTarget((v) => ({ ...v, graph: -1 }));
  };
  const addNode = (x: number, y: number) => {
    if (nodes.length >= MAX_NODES) {
      setError(`At most ${MAX_NODES} nodes.`);
      return;
    }
    let nid = 0;
    while (nodes.some((n) => n.id === nid)) nid++;
    setNodes([...nodes, { id: nid, x: Math.max(6, Math.min(94, x)), y: Math.max(6, Math.min(54, y)) }]);
  };
  const addNodeSomewhere = () => {
    for (const y of [30, 9, 51, 20, 40]) {
      for (let x = 8; x <= 92; x += 12) {
        if (nodes.every((n) => Math.hypot(n.x - x, n.y - y) > 12)) return addNode(x, y);
      }
    }
    addNode(50, 30);
  };

  const pickNode = (n: number) => {
    if (props.editable === false) return;
    setError(null);
    if (tool === 'start') setStart((v) => ({ ...v, [layout]: n }));
    else if (tool === 'target') setTarget((v) => ({ ...v, [layout]: n === t ? -1 : n }));
    else if (tool === 'edge') {
      if (pending === null) setPending(n);
      else {
        toggleEdge(pending, n);
        setPending(null);
      }
    } else if (tool === 'node') removeNode(n);
  };
  const pickCell = (cell: number) => {
    setError(null);
    if (tool === 'wall') {
      if (cell === s || cell === t) {
        setError('The start and target cells cannot be walls.');
        return;
      }
      const next = new Set(walls);
      if (next.has(cell)) next.delete(cell);
      else next.add(cell);
      setWalls(next);
    } else if (!walls.has(cell)) pickNode(cell);
  };
  const onSvgClick = (e: MouseEvent<SVGSVGElement>) => {
    if (tool !== 'node' || e.target !== svgRef.current) return;
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    addNode(pt.x, pt.y);
  };
  const keyActivate = (e: KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };
  const commitEdges = () => {
    const r = parseEdges(edgeDraft, new Set(nodes.map((n) => n.id)));
    if (typeof r === 'string') setError(r);
    else {
      setError(null);
      setEdges(r);
    }
  };
  const resetLayout = () => {
    setError(null);
    setPending(null);
    if (layout === 'graph') {
      setNodes(GRAPH_PRESET.nodes);
      setEdgesBoth(GRAPH_PRESET.edges);
      setStart((v) => ({ ...v, graph: GRAPH_PRESET.start }));
      setTarget((v) => ({ ...v, graph: GRAPH_PRESET.target }));
    } else {
      setWalls(new Set(GRID_PRESET.walls));
      setStart((v) => ({ ...v, grid: GRID_PRESET.start }));
      setTarget((v) => ({ ...v, grid: GRID_PRESET.target }));
    }
  };
  const switchLayout = (l: Layout) => {
    setLayout(l);
    setPending(null);
    setError(null);
    setTool(l === 'grid' ? 'wall' : 'start');
  };

  const tools: [Tool, string][] =
    layout === 'grid'
      ? [['wall', 'Toggle walls'], ['start', 'Set start'], ['target', 'Set target']]
      : [['start', 'Set start'], ['target', 'Set target'], ['edge', 'Add or remove an edge'], ['node', 'Add or remove a node']];
  const toolHint: Record<Tool, string> = {
    start: 'Click a node to start the search there.',
    target: 'Click a node to make it the target; click the target again for no target.',
    edge: pending === null ? 'Click two nodes to connect them, or to remove the edge between them.' : `Now click the node to connect with ${pending}.`,
    node: 'Click empty space to add a node, or click a node to remove it with its edges.',
    wall: 'Click cells to add or remove walls. Walls are not nodes.',
  };
  const examining = st.current !== null && st.next !== null ? edgeKey(st.current, st.next) : null;
  const curList = st.current !== null ? adjacency.get(st.current) : undefined;
  const [avg, worst, space] = COMPLEXITY[algorithm];

  return (
    <div className="viz sv gs" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard} role="region" aria-label={`${label} visualizer`}>
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Visualizer</span>
        <strong className="viz-title">{label}</strong>
        {layouts.length > 1 && (
          <div className="presets" role="group" aria-label="Layout">
            {(['graph', 'grid'] as const).filter((l) => layouts.includes(l)).map((l) => (
              <button key={l} type="button" className="chipbtn" aria-pressed={layout === l} onClick={() => switchLayout(l)}>
                {l === 'graph' ? 'Graph' : 'Grid (as a graph)'}
              </button>
            ))}
          </div>
        )}
        <span className="viz-keys muted">Space plays or pauses · ← → step</span>
      </div>

      {props.editable !== false && (
        <div className="viz-input">
          <div className="presets" role="group" aria-label="Edit tool">
            {tools.map(([k, l]) => (
              <button key={k} type="button" className="chipbtn" aria-pressed={tool === k} onClick={() => (setTool(k), setPending(null))}>
                {l}
              </button>
            ))}
          </div>
          {layout === 'graph' && tool === 'node' && (
            <button type="button" className="chipbtn" onClick={addNodeSomewhere}>
              + Add a node
            </button>
          )}
          <button type="button" className="chipbtn" onClick={() => setTarget((v) => ({ ...v, [layout]: -1 }))} aria-pressed={t < 0}>
            No target
          </button>
          <button type="button" className="chipbtn" onClick={resetLayout}>
            Reset {layout === 'grid' ? 'grid' : 'graph'}
          </button>
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
          {layout === 'graph' && (
            <>
              <label htmlFor={`${id}-edges`}>Edges</label>
              <input
                id={`${id}-edges`}
                type="text"
                autoComplete="off"
                className="gs-edges"
                value={edgeDraft}
                onChange={(e) => setEdgeDraft(e.target.value)}
                onBlur={commitEdges}
                onKeyDown={(e) => e.key === 'Enter' && commitEdges()}
                aria-invalid={Boolean(error)}
              />
            </>
          )}
          <p className="gs-hint muted">{toolHint[tool]}</p>
          {error && <p className="viz-err" role="alert">{error}</p>}
        </div>
      )}

      <p className="sv-facts">
        <span className="muted">From the notes' summary table:</span> time <b>{avg}</b> · worst <b>{worst}</b> · space <b>{space}</b> · start <b>{s}</b> · target <b>{t < 0 ? 'none' : t}</b>
      </p>

      <div className="viz-stage">
        {layout === 'graph' ? (
          <svg ref={svgRef} className={`gs-graph${tool === 'node' && props.editable !== false ? ' is-adding' : ''}`} viewBox="0 0 100 60" onClick={onSvgClick} role="group" aria-label="Graph. Nodes are buttons when an edit tool is active.">
            {edges.map(([a, b]) => {
              const na = nodes.find((n) => n.id === a);
              const nb = nodes.find((n) => n.id === b);
              if (!na || !nb) return null;
              return <line key={edgeKey(a, b)} className={`gs-edge${examining === edgeKey(a, b) ? ' is-compare' : ''}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} />;
            })}
            {nodes.map((n) => (
              <g
                key={n.id}
                className={`${nodeClass(n.id, st, t)}${pending === n.id ? ' is-pending' : ''}`}
                transform={`translate(${n.x} ${n.y})`}
                role="button"
                tabIndex={props.editable === false ? -1 : 0}
                aria-label={`Node ${n.id}${n.id === s ? ', start' : ''}${n.id === t ? ', target' : ''}`}
                onClick={(e) => (e.stopPropagation(), pickNode(n.id))}
                onKeyDown={(e) => keyActivate(e, () => pickNode(n.id))}
              >
                {n.id === t && <circle className="gs-ring" r={6.4} />}
                <circle r={4.6} />
                <text dy="0.36em" textAnchor="middle">{n.id}</text>
                {n.id === s && <text className="gs-tag" y={-6.4} textAnchor="middle">start</text>}
                {isBfs && st.dist[n.id] !== undefined && <text className="gs-dist" x={5.6} y={5.8}>d={st.dist[n.id]}</text>}
              </g>
            ))}
          </svg>
        ) : (
          <div className="gs-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 52px))` }} role="group" aria-label="Grid. Each open cell is a node.">
            {Array.from({ length: rows * cols }, (_, cell) =>
              walls.has(cell) ? (
                <button key={cell} type="button" className="gs-cell is-wall" aria-label={`Cell ${cell}, wall`} onClick={() => pickCell(cell)} disabled={props.editable === false} />
              ) : (
                <button key={cell} type="button" className={`gs-cell ${nodeClass(cell, st, t)}`} aria-label={`Cell ${cell}${cell === s ? ', start' : ''}${cell === t ? ', target' : ''}`} onClick={() => pickCell(cell)} disabled={props.editable === false}>
                  <span className="gs-cell-id">{cell}</span>
                  {cell === s && <span className="gs-cell-tag">start</span>}
                  {cell === t && <span className="gs-cell-tag">target</span>}
                  {isBfs && st.dist[cell] !== undefined && <span className="gs-cell-dist">d={st.dist[cell]}</span>}
                </button>
              ),
            )}
          </div>
        )}

        <div className="gs-panels">
          {isBfs ? (
            <div className="gs-box">
              <span className="eyebrow">queue (front → back)</span>
              <div className="gs-chips">
                {st.queue!.length === 0 ? <span className="muted">empty</span> : st.queue!.map((q, k) => <span key={`${q.node}-${k}`} className={`gs-chip${k === 0 ? ' is-front' : ''}`}>({q.node}, {q.dist})</span>)}
              </div>
            </div>
          ) : (
            <div className="gs-box">
              <span className="eyebrow">call stack (innermost first)</span>
              <div className="gs-chips">
                {st.stack!.length === 0 ? <span className="muted">empty</span> : [...st.stack!].reverse().map((n, k) => <span key={`${n}-${k}`} className={`gs-chip${k === 0 ? ' is-front' : ''}`}>DFS({n})</span>)}
              </div>
            </div>
          )}
          <div className="gs-box">
            <span className="eyebrow">visited (HashSet)</span>
            <div className="gs-chips mono">{st.visited.length ? `{ ${[...st.visited].sort((a, b) => a - b).join(', ')} }` : '{ }'}</div>
          </div>
          <div className="gs-box">
            <span className="eyebrow">{isBfs ? 'dequeue order' : 'call order'}</span>
            <div className="gs-chips mono">{st.order.length ? st.order.join(' → ') : '—'}</div>
          </div>
          {st.current !== null && (
            <div className="gs-box">
              <span className="eyebrow">foreach over graph[{st.current}]</span>
              <div className="gs-list mono">
                {curList === undefined ? (
                  <span className="muted">no key: GetValueOrDefault gives an empty list</span>
                ) : (
                  <>
                    [
                    {curList.map((n, k) => (
                      <span key={n}>
                        {k > 0 ? ', ' : ''}
                        <span className={st.next === n ? 'gs-next' : undefined}>{n}</span>
                      </span>
                    ))}
                    ]
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {p.atEnd && st.result !== undefined && (
        <p className="viz-verdict" role="status">
          {isBfs ? `BFS returns ${st.result}` : `DFS returns ${st.result}`}
        </p>
      )}
      <Controls p={p} label={label} />
      <div className="viz-panels">
        <CodePanel code={code} line={step.codeLine} />
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <div className="counters sv-counters" aria-label="Counters" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div>
              <b>{st.stats.visits}</b>
              <span>{isBfs ? 'Nodes dequeued' : 'DFS calls'}</span>
            </div>
            <div>
              <b>{st.stats.edges}</b>
              <span>Neighbours examined</span>
            </div>
            <div>
              <b>{st.stats.peak}</b>
              <span>{isBfs ? 'Longest queue' : 'Deepest stack'}</span>
            </div>
          </div>
          <ul className="legend" aria-label="Colour legend">
            <li><span className="sw sw-active" aria-hidden="true" />{isBfs ? 'Node just dequeued' : 'Current call'}</li>
            <li><span className="sw sw-compare" aria-hidden="true" />Neighbour being examined</li>
            <li><span className="sw sw-visited" aria-hidden="true" />{isBfs ? 'Visited, waiting in the queue' : 'On the call stack'}</li>
            <li><span className="sw sw-settled" aria-hidden="true" />{isBfs ? 'Dequeued and expanded' : 'Call returned'}</li>
            <li><span className="sw sw-idle" aria-hidden="true" />Not visited yet</li>
            <li><span className="sw sw-target" aria-hidden="true" />Target</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
