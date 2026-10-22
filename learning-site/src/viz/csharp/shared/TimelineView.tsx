import type { SegKind, TimelineState } from './timeline';

const KIND_TEXT: Record<SegKind, string> = {
  run: 'running',
  blocked: 'blocked',
  free: 'free',
  wait: 'waiting (no thread)',
  inside: 'inside, awaiting',
  done: 'done',
};

function ticks(axis: number): number[] {
  const step = axis <= 1200 ? 250 : axis <= 2400 ? 500 : 1000;
  const out: number[] = [];
  for (let t = 0; t <= axis + 1e-9; t += step) out.push(t);
  return out;
}

/**
 * Draws a TimelineState: one row per lane (label, status, track with segments) and a time cursor. The
 * segments carry text in their title and the status line says what each lane is doing, so nothing depends on
 * colour alone.
 */
export function TimelineView({ s, forever }: { s: TimelineState; forever?: string[] }) {
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / s.axis) * 100))}%`;
  const groups: { name: string | undefined; lanes: TimelineState['lanes'] }[] = [];
  for (const l of s.lanes) {
    const g = groups[groups.length - 1];
    if (g && g.name === l.group) g.lanes.push(l);
    else groups.push({ name: l.group, lanes: [l] });
  }
  return (
    <div className="cs-tl" role="group" aria-label={`Timeline at ${s.now} ms`}>
      <div className="cs-tl-axis" aria-hidden="true">
        <span className="cs-tl-label" />
        <div className="cs-tl-track cs-tl-ticks">
          {ticks(s.axis).map((t, i, all) => (
            <span key={t} className={i % 2 === 1 && i !== all.length - 1 ? 'is-minor' : undefined} style={{ left: pct(t) }}>
              {i === all.length - 1 ? `${t} ms` : t}
            </span>
          ))}
        </div>
      </div>
      {groups.map((g, gi) => (
        <div key={gi} className="cs-tl-group">
          {g.name && <div className="cs-tl-group-name">{g.name}</div>}
          {g.lanes.map((l) => {
            const segs = s.segs.filter((x) => x.lane === l.id && x.from <= s.now);
            const isForever = forever?.includes(l.id);
            return (
              <div key={l.id} className={`cs-tl-row${s.focus.includes(l.id) ? ' is-focus' : ''}`}>
                <div className="cs-tl-label">
                  <b>{l.label}</b>
                  {l.sub && <span className="cs-tl-sub">{l.sub}</span>}
                </div>
                <div className="cs-tl-track">
                  {segs.map((x, i) => {
                    const to = x.to === null ? s.now : Math.min(x.to, s.now);
                    const zero = to - x.from <= 0;
                    return (
                      <span
                        key={i}
                        className={`cs-seg cs-seg-${x.kind}${zero ? ' is-instant' : ''}${x.to === null ? ' is-open' : ''}`}
                        style={{ left: pct(x.from), width: zero ? undefined : `calc(${pct(to)} - ${pct(x.from)})` }}
                        title={`${l.label}: ${x.label ?? KIND_TEXT[x.kind]} (${x.from}–${x.to === null ? 'now' : x.to} ms)`}
                      >
                        {!zero && x.label && <em>{x.label}</em>}
                      </span>
                    );
                  })}
                  {isForever && <span className="cs-seg-forever" aria-hidden="true">… forever</span>}
                </div>
                {s.status[l.id] && <div className="cs-tl-status">{s.status[l.id]}</div>}
              </div>
            );
          })}
        </div>
      ))}
      <div className={`cs-tl-cursor${s.now / s.axis > 0.8 ? ' is-end' : s.now / s.axis < 0.12 ? ' is-start' : ''}`} aria-hidden="true" style={{ ['--f' as string]: Math.min(1, s.now / s.axis) }}>
        <i>t = {s.now} ms</i>
      </div>
    </div>
  );
}
