import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';

interface ArrowPath {
  key: string;
  d: string;
  cls: string;
}

/**
 * Draws reference arrows inside `container`: from every element with `data-ref="<id>"` to the element with
 * `data-obj="<id>"`. Positions are measured after layout and again whenever the container resizes, so the
 * arrows follow the stacked phone layout as well as the side-by-side one. The SVG is decorative: every
 * reference also shows its target as text ("→ #1").
 */
export function RefArrows({ container, deps }: { container: RefObject<HTMLElement | null>; deps: unknown }) {
  const [paths, setPaths] = useState<ArrowPath[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const frame = useRef(0);
  const markerId = `cs-head-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const compute = () => {
      const base = el.getBoundingClientRect();
      const out: ArrowPath[] = [];
      const lanes = new Map<string, number>();
      el.querySelectorAll<HTMLElement>('[data-ref]').forEach((src, k) => {
        const id = src.dataset.ref;
        if (!id) return;
        const tgt = el.querySelector<HTMLElement>(`[data-obj="${CSS.escape(id)}"]`);
        if (!tgt) return;
        const s = src.getBoundingClientRect();
        const t = tgt.getBoundingClientRect();
        const sx = s.right - base.left;
        const sy = s.top + s.height / 2 - base.top;
        const cls = `cs-arrow${src.dataset.arrow ? ` is-${src.dataset.arrow}` : ''}`;
        if (t.left - base.left >= sx + 12) {
          // side by side: a smooth curve into the object's left edge
          const tx = t.left - base.left - 2;
          const ty = Math.min(t.bottom - base.top - 10, Math.max(t.top - base.top + 14, sy));
          const mx = (sx + tx) / 2;
          out.push({ key: `${id}:${k}`, d: `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`, cls });
        } else {
          // stacked: run down a lane on the right, then into the object's right edge
          const lane = lanes.get(id) ?? lanes.size;
          lanes.set(id, lane);
          const x = base.width - 6 - lane * 7;
          const tx = t.right - base.left + 2;
          const ty = t.top - base.top + 16;
          const r = 6;
          const down = ty > sy ? 1 : -1;
          out.push({
            key: `${id}:${k}`,
            d: `M${sx},${sy} H${x - r} Q${x},${sy} ${x},${sy + r * down} V${ty - r * down} Q${x},${ty} ${x - r},${ty} H${tx}`,
            cls,
          });
        }
      });
      setPaths(out);
      setSize({ w: base.width, h: base.height });
    };
    compute();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(compute);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);

  return (
    <svg className="cs-arrows" width={size.w} height={size.h} viewBox={`0 0 ${Math.max(1, size.w)} ${Math.max(1, size.h)}`} aria-hidden="true">
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="cs-arrowhead" />
        </marker>
      </defs>
      {paths.map((p) => (
        <path key={p.key} d={p.d} className={p.cls} markerEnd={`url(#${markerId})`} />
      ))}
    </svg>
  );
}
