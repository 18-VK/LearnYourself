import { motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { RefArrows } from './shared/arrows';
import { ConsoleOut, CsLegend, PartPicker, Tally, VizShell } from './shared/panels';
import { SH_SCENARIOS, shPart, toShScenario, type ShField, type ShMarks, type ShObject, type ShVar } from './traces/stack-heap';

export interface StackHeapProps {
  /** value-vs-reference | struct-vs-class-copy | boxing */
  scenario?: string;
  /** Start on this part instead of the scenario's first one. */
  part?: string;
  predictMode?: boolean;
  placement?: string;
}

const markClass = (marks: ShMarks, id: string) => (marks.write?.includes(id) ? ' is-swap' : marks.read?.includes(id) ? ' is-compare' : '');

function Fields({ fields, marks, prefix }: { fields: ShField[]; marks: ShMarks; prefix: string }) {
  return (
    <dl className="cs-fields">
      {fields.map((f) => (
        <div key={f.name} className={`cs-field${markClass(marks, `${prefix}.${f.name}`)}`}>
          <dt>{f.name}</dt>
          <dd className={f.value === '?' ? 'is-unassigned' : undefined}>{f.value === '?' ? 'unassigned' : f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function VarBox({ x, marks }: { x: ShVar; marks: ShMarks }) {
  const id = `v:${x.name}`;
  return (
    <div className={`cs-var${markClass(marks, id)}`}>
      <div className="cs-var-head">
        <span className="cs-type">{x.type}</span> <b className="mono">{x.name}</b>
        <span className="cs-kind">{x.kind === 'ref' ? 'reference' : 'value'}</span>
      </div>
      {x.kind === 'ref' ? (
        x.ref ? (
          <span className="cs-ref" data-ref={x.ref}>
            → {x.ref}
          </span>
        ) : (
          <span className="cs-ref is-null">null</span>
        )
      ) : x.fields ? (
        <Fields fields={x.fields} marks={marks} prefix={id} />
      ) : (
        <span className="cs-val">{x.value}</span>
      )}
    </div>
  );
}

function HeapObj({ h, marks }: { h: ShObject; marks: ShMarks }) {
  const id = `o:${h.id}`;
  return (
    <motion.div
      className={`cs-obj cs-obj-${h.kind}${markClass(marks, id)}${h.orphan ? ' is-orphan' : ''}`}
      data-obj={h.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="cs-obj-head">
        <span className="cs-obj-id">{h.id}</span>
        <span className="cs-type">{h.type}</span>
      </div>
      {h.fields ? <Fields fields={h.fields} marks={marks} prefix={id} /> : <span className="cs-val">{h.value}</span>}
      {h.orphan && <span className="cs-obj-note">no variable shown refers to it</span>}
    </motion.div>
  );
}

export default function StackHeapVisualizer(props: StackHeapProps) {
  const scenario = toShScenario(props.scenario);
  const def = SH_SCENARIOS[scenario];
  const [partId, setPartId] = useState(() => (props.part && def.parts.includes(props.part) ? props.part : def.parts[0]!));
  const part = useMemo(() => shPart(partId), [partId]);
  const parts = useMemo(() => def.parts.map((id) => ({ id, label: shPart(id).label })), [def]);
  const trace = part.trace;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), partId, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const mem = useRef<HTMLDivElement>(null);
  // while a prediction is pending, show the state before the step (the answer is not given away)
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;
  const shown = shownStep.state;
  const refs = shown.vars.filter((x) => x.kind === 'ref' && x.ref).length;
  const hasOutput = part.doc.parts.some((pt) => pt.code.includes('Console.WriteLine'));

  return (
    <VizShell
      title={def.title}
      label={`${def.title} visualizer`}
      p={p}
      options={<PartPicker parts={parts} value={partId} onChange={setPartId} />}
      hint={
        <>
          Simplified picture: locals are drawn in one stack frame and objects on the managed heap. As the struct vs class note says, where a value lives can vary (inside
          another object, in an array, boxed); what matters is value semantics versus reference semantics.
        </>
      }
      stage={
        <>
          <div className="cs-mem" ref={mem}>
            <section className="cs-col cs-stack" aria-label="Stack frame">
              <div className="cs-col-head">
                <span>Stack</span>
                <span className="muted mono">{shown.frame}()</span>
              </div>
              <div className="cs-frame">
                {shown.vars.length ? shown.vars.map((x) => <VarBox key={x.name} x={x} marks={shown.marks} />) : <p className="cs-empty">No locals yet.</p>}
              </div>
            </section>
            <section className="cs-col cs-heap" aria-label="Managed heap">
              <div className="cs-col-head">
                <span>Managed heap</span>
              </div>
              <div className="cs-heap-objs">
                {shown.heap.length ? shown.heap.map((h) => <HeapObj key={h.id} h={h} marks={shown.marks} />) : <p className="cs-empty">Empty: nothing allocated.</p>}
              </div>
            </section>
            <RefArrows container={mem} deps={`${partId}:${p.index}:${p.awaitingPrediction}`} />
          </div>
          {hasOutput && <ConsoleOut lines={shown.output} />}
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
            items={[
              ['Heap objects', shown.heap.length],
              ['References', refs],
              ['Value copies', shown.copies],
            ]}
          />
          <CsLegend
            items={[
              { kind: 'swap', label: 'Written or created in this step' },
              { kind: 'compare', label: 'Read in this step' },
              { kind: 'ptr-line', label: 'Reference (arrow)' },
              { kind: 'orphan', label: 'Object nothing shown refers to' },
            ]}
          />
        </>
      }
    />
  );
}
