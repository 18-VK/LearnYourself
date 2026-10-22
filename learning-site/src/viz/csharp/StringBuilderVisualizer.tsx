import { useMemo, useState } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { ConsoleOut, CsLegend, PartPicker, Tally, VizShell } from './shared/panels';
import { sbPart, type SbState } from './traces/stringbuilder';

export interface StringBuilderProps {
  scenario?: string;
  predictMode?: boolean;
  placement?: string;
}

function Strings({ s }: { s: SbState }) {
  return (
    <div className="cs-sb-strings">
      <div className="cs-inv-holders">
        {s.vars.map((v) => (
          <span key={v.name} className="cs-inv-holder">
            <span className="mono">{v.name}</span> <span className="cs-ref">→ {v.ref}</span>
          </span>
        ))}
      </div>
      <div className="cs-sb-objs">
        {s.strings.map((x) => (
          <div key={x.id} className={`cs-obj cs-obj-string${s.changed === x.id ? ' is-swap' : ''}${x.referenced ? '' : ' is-orphan'}`}>
            <div className="cs-obj-head">
              <span className="cs-obj-id">{x.id}</span>
              <span className="cs-type">string</span>
            </div>
            <span className="cs-val">"{x.value}"</span>
            {!x.referenced && <span className="cs-obj-note">no variable refers to it</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Buffer({ s }: { s: SbState }) {
  const sb = s.sb;
  if (!sb) return <p className="cs-empty">No StringBuilder yet.</p>;
  // one cell per character slot; escaped \r\n shows as two cells
  const chars: string[] = [];
  for (let i = 0; i < sb.text.length; i++) {
    if (sb.text[i] === '\\' && (sb.text[i + 1] === 'r' || sb.text[i + 1] === 'n')) {
      chars.push(`\\${sb.text[i + 1]}`);
      i++;
    } else chars.push(sb.text[i]!);
  }
  const bounds: number[] = [];
  let acc = 0;
  for (const g of sb.growths) {
    acc += g;
    bounds.push(acc);
  }
  return (
    <div className={`cs-sb${s.grew ? ' is-grew' : ''}`}>
      <div className="cs-di-head">
        StringBuilder sb <span className="muted">one object</span>
      </div>
      <div className="cs-sb-cells" role="img" aria-label={`Buffer: ${sb.length} of ${sb.capacity} character slots used`}>
        {Array.from({ length: sb.capacity }, (_, i) => (
          <span key={i} className={`cs-sb-cell${i < sb.length ? ' is-used' : ''}${bounds.includes(i + 1) && i + 1 < sb.capacity ? ' is-edge' : ''}${s.grew && i >= sb.capacity - (sb.growths[sb.growths.length - 1] ?? 0) ? ' is-new' : ''}`}>
            {i < chars.length ? chars[i] === ' ' ? '·' : chars[i] : ''}
          </span>
        ))}
      </div>
      <div className="cs-sb-meta">
        <span>
          Length <b className="mono">{sb.length}</b>
        </span>
        <span>
          Capacity <b className="mono">{sb.capacity}</b>
        </span>
        <span className="muted">· = space, \r \n = line break</span>
      </div>
    </div>
  );
}

export default function StringBuilderVisualizer(props: StringBuilderProps) {
  const [partId, setPartId] = useState<'string' | 'builder'>('builder');
  const part = useMemo(() => sbPart(partId), [partId]);
  const trace = part.trace;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), partId, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;
  const s = shownStep.state;

  return (
    <VizShell
      title="string vs StringBuilder"
      label="String immutability versus StringBuilder visualizer"
      p={p}
      options={
        <PartPicker
          parts={[
            { id: 'string', label: 'string: a new object each time' },
            { id: 'builder', label: 'StringBuilder: one growing buffer' },
          ]}
          value={partId}
          onChange={(v) => setPartId(v as 'string' | 'builder')}
        />
      }
      hint={
        partId === 'builder'
          ? 'Length and Capacity were measured by running this exact code on .NET 7 on Windows, where AppendLine adds \\r\\n. The docs say capacity doubles when it runs out; here Insert and Replace added just the room they needed.'
          : 'Every string method that seems to change a string returns a new one.'
      }
      stage={
        <>
          {partId === 'string' ? <Strings s={s} /> : <Buffer s={s} />}
          <ConsoleOut lines={s.output} />
        </>
      }
      doc={part.doc}
      line={step.codeLine}
      narration={step.narration}
      prediction={step.predict}
      vars={shownStep.variables}
      side={
        <>
          <Tally
            items={
              partId === 'string'
                ? [
                    ['string objects', s.strings.length],
                    ['Still referenced', s.strings.filter((x) => x.referenced).length],
                  ]
                : [
                    ['StringBuilder objects', 1],
                    ['Length', s.sb?.length ?? 0],
                    ['Capacity', s.sb?.capacity ?? 0],
                    ['Times it grew', Math.max(0, (s.sb?.growths.length ?? 1) - 1)],
                  ]
            }
          />
          <CsLegend
            items={
              partId === 'string'
                ? [
                    { kind: 'swap', label: 'Created in this step' },
                    { kind: 'orphan', label: 'No variable refers to it' },
                  ]
                : [
                    { kind: 'active', label: 'Slot in use' },
                    { kind: 'idle', label: 'Free capacity' },
                    { kind: 'swap', label: 'Room added in this step' },
                  ]
            }
          />
        </>
      }
    />
  );
}
