import { useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, ChipGroup, SourcePanel, StatusPill, VizShell } from './common/ui';
import { rawOf, REFRESH_CODE, STORIES, traceRefresh, type Action, type RefreshState } from './auth/refresh';

export interface RefreshRotationProps {
  showReuseDetection?: boolean;
  predictMode?: boolean;
  placement?: string;
}

const MAX_ACTIONS = 14;

export default function RefreshRotationVisualizer(props: RefreshRotationProps) {
  const [story, setStory] = useState('stolen');
  const [actions, setActions] = useState<Action[]>(STORIES.find((s) => s.id === 'stolen')!.actions);
  const [reuse, setReuse] = useState(props.showReuseDetection !== false);
  const trace = useMemo(() => traceRefresh(actions, reuse), [actions, reuse]);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${JSON.stringify(actions)}:${reuse}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  const final = trace.at(-1)!.state;
  const add = (a: Action) => {
    setStory('custom');
    setActions((old) => [...old, a].slice(0, MAX_ACTIONS));
  };
  const code = s.code ? REFRESH_CODE[s.code] : REFRESH_CODE.lookup;
  return (
    <VizShell title="Refresh-token rotation and reuse detection" label="Refresh token rotation visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input asp-input-stack">
        <div className="asp-field">
          <span className="asp-label">Story</span>
          <ChipGroup
            label="Story"
            value={story}
            options={STORIES.map((x) => ({ id: x.id, label: x.label }))}
            onChange={(id) => {
              setStory(id);
              setActions(STORIES.find((x) => x.id === id)!.actions);
            }}
          />
        </div>
        <div className="asp-field">
          <span className="asp-label">Add a step</span>
          <button type="button" className="chipbtn" onClick={() => add({ kind: 'refresh', who: 'user' })} disabled={!final.holds.user}>
            User refreshes
          </button>
          <button type="button" className="chipbtn" onClick={() => add({ kind: 'steal' })} disabled={!final.holds.user}>
            Attacker steals the user&apos;s token
          </button>
          <button type="button" className="chipbtn" onClick={() => add({ kind: 'refresh', who: 'attacker' })} disabled={!final.holds.attacker}>
            Attacker refreshes
          </button>
          <button type="button" className="chipbtn" onClick={() => add({ kind: 'login' })}>
            User logs in (again)
          </button>
          <label className="toggle">
            <input type="checkbox" checked={reuse} onChange={(e) => setReuse(e.target.checked)} /> Reuse detection
          </label>
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        </div>
      </div>
      <div className="viz-stage rf-stage">
        <div className="rf-holders">
          <Holder who="user" s={s} />
          <Holder who="attacker" s={s} />
          {s.response && (
            <p className="rf-response" role="status">
              <StatusPill code={s.response.status} text={s.response.text} />
            </p>
          )}
        </div>
        <RowsTable s={s} />
      </div>
      <Controls p={p} label="Refresh tokens" />
      <div className="viz-panels">
        <SourcePanel code={code.code} lines={s.code ? s.codeLines : []} title={code.title} />
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['active', 'Row looked up now'], ['settled', 'Row created now'], ['swap', 'Revoked'], ['idle', 'Revoked earlier']]} />
        </div>
      </div>
    </VizShell>
  );
}

function Holder({ who, s }: { who: 'user' | 'attacker'; s: RefreshState }) {
  const id = s.holds[who];
  const row = id ? s.rows.find((r) => r.id === id) : undefined;
  return (
    <div className={`asp-card rf-holder${s.actor === who ? ' is-actor' : ''}`}>
      <p className="asp-card-head">{who === 'user' ? "User's app" : 'Attacker'}</p>
      <p className="rf-hold">
        Refresh token:{' '}
        {id ? (
          <>
            <b className="mono">{id}</b> <span className="mono asp-muted">{rawOf(id)}</span> {row?.revokedAt ? <span className="asp-bad">(revoked)</span> : <span className="asp-good">(valid)</span>}
          </>
        ) : (
          <span className="asp-muted">none</span>
        )}
      </p>
      <p className="rf-hold">Access token: {s.access[who] ? <span className="asp-good">valid for 15 min</span> : <span className="asp-muted">none</span>}</p>
    </div>
  );
}

function RowsTable({ s }: { s: RefreshState }) {
  return (
    <div className="table-wrap rf-table-wrap">
      <table className="rf-table">
        <caption>RefreshTokens table (only hashes are stored)</caption>
        <thead>
          <tr>
            <th scope="col">Id</th>
            <th scope="col">TokenHash</th>
            <th scope="col">TokenFamilyId</th>
            <th scope="col">RevokedAtUtc</th>
            <th scope="col">ReplacedByTokenId</th>
          </tr>
        </thead>
        <tbody>
          {s.rows.length === 0 && (
            <tr>
              <td colSpan={5} className="asp-muted">
                No rows yet.
              </td>
            </tr>
          )}
          {s.rows.map((r) => {
            const cls = s.revokedNow.includes(r.id) ? 'is-revoked-now' : s.created === r.id ? 'is-created' : s.lookedUp === r.id ? 'is-looked' : r.revokedAt ? 'is-revoked' : '';
            return (
              <tr key={r.id} className={cls}>
                <td className="mono">{r.id}</td>
                <td className="mono">{r.hash}</td>
                <td className="mono">{r.family}</td>
                <td>{r.revokedAt ? `${r.revokedAt} (${r.why})` : 'null'}</td>
                <td className="mono">{r.replacedBy ?? 'null'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
