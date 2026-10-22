import { useMemo, useState, type ReactNode } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, ChipGroup, SourcePanel, StatusPill, VizShell } from './common/ui';
import { CONFIG, LANES, PHASE_LABEL, PHASES, SEQ_SCENARIOS, traceJwtSequence, type Phase, type SeqScenario, type SeqState } from './jwt/sequence';
import { JWT_VALIDATION_CODE } from './sources';

export interface JwtSequenceProps {
  /** which parts of the flow to show (the placement lists all four) */
  steps?: string[];
  predictMode?: boolean;
  placement?: string;
}

export default function JwtSequenceVisualizer(props: JwtSequenceProps) {
  const phases = (props.steps ?? PHASES).filter((x): x is Phase => (PHASES as string[]).includes(x));
  const [scenario, setScenario] = useState<SeqScenario>('ok');
  const trace = useMemo(() => traceJwtSequence(scenario, phases), [scenario, phases.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), scenario, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  return (
    <VizShell title="JWT: login → token → API call → validation" label="JWT authentication sequence visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input">
        <ChipGroup label="Scenario" value={scenario} options={SEQ_SCENARIOS} onChange={setScenario} />
        <label className="toggle">
          <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
        </label>
      </div>
      <div className="viz-stage seq-stage">
        <Diagram state={s} />
        <TokenCard state={s} />
      </div>
      <Controls p={p} label="JWT sequence" />
      <div className="viz-panels">
        <SourcePanel code={JWT_VALIDATION_CODE} lines={s.codeLines} title="Configuration (App Setup), from the note" />
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['active', 'Current step'], ['settled', 'Check passed / 2xx'], ['swap', 'Check failed / 4xx']]} />
        </div>
      </div>
    </VizShell>
  );
}

function Diagram({ state }: { state: SeqState }) {
  const idx = (l: string) => LANES.findIndex((x) => x.id === l);
  let lastPhase = '';
  return (
    <div className="seq" role="img" aria-label={`Sequence diagram, ${state.events.length} messages so far. Latest: ${state.events.at(-1)?.label ?? ''}`}>
      <div className="seq-grid" style={{ gridTemplateRows: `auto repeat(${state.events.length * 2}, auto)` }}>
        {LANES.map((l, c) => (
          <div key={l.id} className="seq-head" style={{ gridColumn: c + 1, gridRow: 1 }}>
            {l.label}
          </div>
        ))}
        {LANES.map((l, c) => (
          <div key={`life-${l.id}`} className="seq-life" style={{ gridColumn: c + 1, gridRow: `2 / ${state.events.length * 2 + 2}` }} aria-hidden="true" />
        ))}
        {state.events.map((e, i) => {
          const row = i * 2 + 2;
          const phase = PHASE_LABEL[e.phase];
          const showPhase = phase !== lastPhase;
          lastPhase = phase;
          const cur = i === state.current;
          const tone = e.result === 'fail' || (e.status && e.status >= 400) ? ' is-bad' : e.result === 'pass' || (e.status && e.status < 300) ? ' is-ok' : '';
          const a = idx(e.from);
          const b = idx(e.to);
          if (e.kind === 'self') {
            const end = a === LANES.length - 1 ? a + 2 : LANES.length + 1;
            return (
              <SeqRow key={i} row={row} phase={showPhase ? phase : null}>
                <div className={`seq-self${cur ? ' is-current' : ''}${tone}`} style={{ gridColumn: `${a + 1} / ${end}`, gridRow: row + 1, ['--span' as string]: end - a - 1 }}>
                  <span>{e.label}</span>
                  {e.result && <b aria-hidden="true">{e.result === 'pass' ? ' ✓' : ' ✗'}</b>}
                </div>
              </SeqRow>
            );
          }
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          return (
            <SeqRow key={i} row={row} phase={showPhase ? phase : null}>
              <div className={`seq-msg ${b > a ? 'ltr' : 'rtl'}${cur ? ' is-current' : ''}${tone}`} style={{ gridColumn: `${lo + 1} / ${hi + 2}`, gridRow: row + 1, ['--span' as string]: hi - lo + 1 }}>
                <span className="seq-label">{e.label}</span>
                <span className="seq-arrow" aria-hidden="true" />
              </div>
            </SeqRow>
          );
        })}
      </div>
    </div>
  );
}

function SeqRow({ row, phase, children }: { row: number; phase: string | null; children: ReactNode }) {
  return (
    <>
      {phase ? (
        <div className="seq-phase" style={{ gridColumn: '1 / -1', gridRow: row }}>
          {phase}
        </div>
      ) : (
        <div style={{ gridColumn: '1 / -1', gridRow: row }} aria-hidden="true" />
      )}
      {children}
    </>
  );
}

function TokenCard({ state }: { state: SeqState }) {
  const t = state.token;
  return (
    <div className="asp-card seq-card" aria-label="Token and checks">
      <p className="asp-card-head">The token vs the API&apos;s settings</p>
      {t ? (
        <dl>
          <dt>iss</dt>
          <dd className="mono">{t.iss}</dd>
          <dt>aud</dt>
          <dd className="mono">
            {t.aud} {t.aud !== CONFIG.audience && <span className="asp-bad">(API expects {CONFIG.audience})</span>}
          </dd>
          <dt>role</dt>
          <dd className="mono">{t.role}</dd>
          <dt>exp</dt>
          <dd>{t.exp}</dd>
          <dt>signature</dt>
          <dd>{t.signature === 'valid' ? 'as signed' : <span className="asp-bad">payload edited after signing</span>}</dd>
        </dl>
      ) : (
        <p className="asp-muted">No token.</p>
      )}
      <ul className="seq-checks">
        {state.checks.map((c) => (
          <li key={c.name} className={`chk-${c.result}`}>
            <span aria-hidden="true">{c.result === 'pass' ? '✓' : c.result === 'fail' ? '✗' : c.result === 'skipped' ? '–' : '·'}</span> {c.name}
            <span className="asp-vh"> {c.result}</span>
          </li>
        ))}
      </ul>
      {state.outcome && (
        <p className="asp-outcome" role="status">
          <StatusPill code={state.outcome.status} text={state.outcome.text} />
        </p>
      )}
    </div>
  );
}
