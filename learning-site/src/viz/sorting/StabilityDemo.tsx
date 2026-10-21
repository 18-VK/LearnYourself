import { useMemo, useState } from 'react';
import type { SortAlgorithm } from './csharp';
import SortVisualizer from './SortVisualizer';
import { tieLetters } from './stage';
import { SORT_ALGORITHMS, SORT_ORDER } from './traces';
import { NOTES_EMPLOYEES } from './traces/counting';

const CHOICES = SORT_ORDER.filter((a) => SORT_ALGORITHMS[a].input.kind === 'int' && a !== 'countingByAge');
const STARTERS = [
  [5, 3, 5, 1, 3],
  [4, 2, 4, 2, 1, 4],
  [7, 7, 3, 7, 1],
];

/**
 * "What does stable mean?" Equal keys carry letters by original position (a = first). Both columns run
 * the real trace generators, so the result is exactly what the notes' C# does on this input.
 */
export default function StabilityDemo(props: { algorithm?: string; input?: string }) {
  if (props.algorithm === 'counting-by-age') {
    // The note's worked example: Employee objects sorted by Age with the stable counting sort.
    return (
      <SortVisualizer
        algorithm="counting-by-age"
        preset={NOTES_EMPLOYEES.map((e) => e.age)}
        labels={NOTES_EMPLOYEES.map((e) => e.name)}
        showTies
        note="The input is the note's staff list. Names travel with their ages; equal ages keep their input order."
      />
    );
  }
  return <StabilityCompare />;
}

function StabilityCompare() {
  const [input, setInput] = useState<number[]>(STARTERS[0]!);
  const [left, setLeft] = useState<SortAlgorithm>('insertion');
  const [right, setRight] = useState<SortAlgorithm>('selection');
  const letters = tieLetters(input);
  const result = (alg: SortAlgorithm) => {
    const t = SORT_ALGORITHMS[alg].trace(input);
    return t[t.length - 1]!.state;
  };
  const a = useMemo(() => result(left), [left, input]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => result(right), [right, input]); // eslint-disable-line react-hooks/exhaustive-deps

  const chips = (values: readonly number[], ids: readonly (number | null)[]) => (
    <span className="chips">
      {values.map((v, k) => {
        const id = ids[k];
        const tie = id !== null && id !== undefined ? letters[id] : null;
        return (
          <span key={k} className="vchip" data-tie={tie ?? undefined}>
            {v}
            {tie && <sub>{tie}</sub>}
          </span>
        );
      })}
    </span>
  );
  const verdict = (ids: readonly (number | null)[], values: readonly number[]) => {
    if (ids.some((x) => x === null)) return 'Rebuilt from counts: original elements are not tracked.';
    const ok = values.every((v, k) => k === 0 || v !== values[k - 1] || (ids[k] ?? 0) > (ids[k - 1] ?? 0));
    return ok ? 'Equal keys kept their input order (a before b).' : 'Equal keys changed order on this input.';
  };
  const picker = (value: SortAlgorithm, set: (x: SortAlgorithm) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => set(e.target.value as SortAlgorithm)}>
      {CHOICES.map((c) => (
        <option key={c} value={c}>{SORT_ALGORITHMS[c].label} ({SORT_ALGORITHMS[c].stable === 'Yes' ? 'stable' : SORT_ALGORITHMS[c].stable === 'No' ? 'not stable' : 'depends'})</option>
      ))}
    </select>
  );
  return (
    <div className="viz stable-demo" role="region" aria-label="Stability demo">
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Stability demo</span>
        <strong className="viz-title">Same input, two sorts from the notes</strong>
        <button type="button" className="btn" onClick={() => setInput(STARTERS[(STARTERS.findIndex((s) => s === input) + 1) % STARTERS.length]!)}>Try another input</button>
      </div>
      <div className="stable-rows">
        <div className="stable-row"><span>Input</span>{chips(input, input.map((_, i) => i))}</div>
        <div className="stable-row">
          {picker(left, setLeft, 'First algorithm')}
          <span>{chips(a.values, a.ids)}<span className="verdict">{verdict(a.ids, a.values)}</span></span>
        </div>
        <div className="stable-row">
          {picker(right, setRight, 'Second algorithm')}
          <span>{chips(b.values, b.ids)}<span className="verdict">{verdict(b.ids, b.values)}</span></span>
        </div>
      </div>
      <p className="viz-hint">Letters mark equal values by their original position. A stable sort keeps a before b.</p>
    </div>
  );
}
