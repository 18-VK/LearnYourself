import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { normText } from '../../markdown/text';
import { loadProgress, updateProgress } from '../../scripts/progress';
import { comingSoon, nodeKeys, progressOf, type NodeProgress } from './progress';
import type { RoadmapData, RoadmapItem, RoadmapNode } from './types';
import './roadmap.css';

/**
 * The roadmap as a graph: top-level headings form the path, sub-headings branch off them, and each node
 * opens its own checklist. Ticks are stored in the same place as the page's checklist (keys.ts), so the
 * two stay in sync; table rows (DSA levels) are ticked here only.
 */
export default function RoadmapGraph(props: Partial<RoadmapData> & { placement?: string }) {
  const data: RoadmapData = { lessonId: props.lessonId ?? (props.placement ?? '').split('#')[0] ?? '', title: props.title ?? 'Roadmap', nodes: props.nodes ?? [] };
  const [ticked, setTicked] = useState<Record<string, boolean>>(() => loadProgress().checklists[data.lessonId] ?? {});
  useEffect(() => {
    const reload = () => setTicked(loadProgress().checklists[data.lessonId] ?? {});
    reload();
    window.addEventListener('ly:progress', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('ly:progress', reload);
      window.removeEventListener('storage', reload);
    };
  }, [data.lessonId]);

  const toggle = useCallback(
    (keys: string[], on: boolean) => {
      updateProgress((p) => {
        const list = (p.checklists[data.lessonId] ??= {});
        for (const k of keys) {
          if (on) list[k] = true;
          else delete list[k];
        }
      });
    },
    [data.lessonId],
  );

  // headings on the page, so each node can jump to its section
  const [anchors, setAnchors] = useState<Map<string, string>>(() => new Map());
  useEffect(() => {
    const map = new Map<string, string>();
    document.querySelectorAll<HTMLElement>('#lesson-body :is(h2, h3, h4, h5, h6)[id]').forEach((h) => {
      const k = normText(h.textContent ?? '');
      if (!map.has(k)) map.set(k, h.id);
    });
    setAnchors(map);
  }, []);

  const all = useMemo(() => data.nodes.flatMap(nodeKeys), [data.nodes]);
  const total = progressOf(all, ticked);
  const [open, setOpen] = useState<string | null>(null);
  const titleId = useId();

  return (
    <div className="viz roadmap" role="region" aria-labelledby={titleId}>
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Roadmap</span>
        <strong className="viz-title" id={titleId}>{data.title}</strong>
        <span className="rm-total" aria-live="polite">
          <span className="rm-bar" aria-hidden="true"><span style={{ width: `${total.total ? (100 * total.done) / total.total : 0}%` }} /></span>
          {total.done} of {total.total} done
        </span>
      </div>
      <p className="viz-hint">Tick a stop to mark everything in it done, or open it to tick single items. Ticks are saved in this browser and match the checklist below.</p>
      <ol className="rm-path">
        {data.nodes.map((n, i) => (
          <Stop key={n.id} node={n} index={i} ticked={ticked} toggle={toggle} open={open} setOpen={setOpen} anchors={anchors} root />
        ))}
      </ol>
    </div>
  );
}

function Stop({
  node,
  index,
  ticked,
  toggle,
  open,
  setOpen,
  anchors,
  root,
}: {
  node: RoadmapNode;
  index: number;
  ticked: Record<string, boolean>;
  toggle: (keys: string[], on: boolean) => void;
  open: string | null;
  setOpen: (id: string | null) => void;
  anchors: Map<string, string>;
  root?: boolean;
}) {
  const keys = useMemo(() => nodeKeys(node), [node]);
  const pr = progressOf(keys, ticked);
  const soon = comingSoon(node);
  const isOpen = open === node.id;
  const panelId = useId();
  const anchor = anchors.get(normText(node.title));
  const hasPanel = node.items.length > 0;
  return (
    <li className={`rm-stop${root ? ' rm-root' : ' rm-branch'} is-${pr.state}${soon ? ' is-soon' : ''}`} data-node={node.id}>
      {root && <span className="rm-marker" aria-hidden="true">{pr.state === 'done' ? '✓' : index + 1}</span>}
      <div className="rm-card">
        <div className="rm-head">
          <NodeCheck progress={pr} label={node.title} onChange={(on) => toggle(keys, on)} />
          {hasPanel ? (
            <button type="button" className="rm-name" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(isOpen ? null : node.id)}>
              {node.title}
              <span className="rm-chev" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            </button>
          ) : (
            <span className="rm-name rm-name-static">{node.title}</span>
          )}
          <span className="rm-count">
            {pr.done}/{pr.total}
          </span>
        </div>
        <div className="rm-meta">
          <span className="rm-bar" aria-hidden="true"><span style={{ width: `${pr.total ? (100 * pr.done) / pr.total : 0}%` }} /></span>
          {soon && <span className="badge rm-soon-badge">Coming soon</span>}
          {node.links.map((l) =>
            l.planned || !l.href ? (
              <span key={l.title} className="rm-link is-planned" title="This topic has no lesson yet">{l.title} · coming soon</span>
            ) : (
              <a key={l.href} className="rm-link" href={siteUrl(l.href)}>{l.title}</a>
            ),
          )}
          {anchor && (
            <a className="rm-jump" href={`#${anchor}`}>
              Section ↓
            </a>
          )}
        </div>
        {hasPanel && isOpen && (
          <ul className="rm-items" id={panelId}>
            {node.items.map((it) => (
              <Item key={it.key} item={it} on={Boolean(ticked[it.key])} toggle={toggle} />
            ))}
          </ul>
        )}
      </div>
      {node.children.length > 0 && (
        <ul className="rm-children">
          {node.children.map((c, k) => (
            <Stop key={c.id} node={c} index={k} ticked={ticked} toggle={toggle} open={open} setOpen={setOpen} anchors={anchors} />
          ))}
        </ul>
      )}
    </li>
  );
}

function NodeCheck({ progress, label, onChange }: { progress: NodeProgress; label: string; onChange: (on: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = progress.state === 'partial';
  }, [progress.state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="rm-check"
      checked={progress.state === 'done'}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={`Mark everything in "${label}" as done (${progress.done} of ${progress.total} done)`}
    />
  );
}

function Item({ item, on, toggle }: { item: RoadmapItem; on: boolean; toggle: (keys: string[], on: boolean) => void }) {
  const id = useId();
  return (
    <li className={on ? 'is-done' : undefined}>
      <input id={id} type="checkbox" checked={on} onChange={(e) => toggle([item.key], e.target.checked)} />
      <label htmlFor={id}>
        {item.tag && <span className="rm-tag">{item.tag}</span>}
        {item.text}
        {item.detail && <span className="rm-detail">{item.detail}</span>}
      </label>
    </li>
  );
}

/** Site paths go through the base path (/LearnYourself/ on GitHub Pages). */
function siteUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return (base.endsWith('/') ? base : `${base}/`) + path.replace(/^\/+/, '');
}
