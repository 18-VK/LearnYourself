import { useState } from 'react';
import type { SortAlgorithm } from './csharp';
import { COMPARE_EVENT } from './SortCompare';
import { SORT_ALGORITHMS } from './traces';

/** The nine rows of the note's Summary Table (counting sort = the stable, cumulative-count version). */
const ROWS: SortAlgorithm[] = ['bubble', 'selection', 'insertion', 'merge', 'quick', 'heap', 'countingStable', 'radix', 'bucket'];
const NAME: Partial<Record<SortAlgorithm, string>> = { countingStable: 'Counting sort' };

export default function SortSummaryTable() {
  const [stableOnly, setStableOnly] = useState(false);
  const [inPlaceOnly, setInPlaceOnly] = useState(false);
  const [picked, setPicked] = useState<SortAlgorithm[]>([]);
  const rows = ROWS.filter((r) => (!stableOnly || SORT_ALGORITHMS[r].stable === 'Yes') && (!inPlaceOnly || SORT_ALGORITHMS[r].inPlace === 'Yes'));
  const toggle = (r: SortAlgorithm) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r].slice(-2)));
  const race = () => {
    if (picked.length !== 2) return;
    window.dispatchEvent(new CustomEvent(COMPARE_EVENT, { detail: { a: picked[0], b: picked[1] } }));
  };
  return (
    <div className="viz viz-table" role="region" aria-label="Interactive sorting summary">
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Interactive table</span>
        <label className="toggle"><input type="checkbox" checked={stableOnly} onChange={(e) => setStableOnly(e.target.checked)} /> Stable only</label>
        <label className="toggle"><input type="checkbox" checked={inPlaceOnly} onChange={(e) => setInPlaceOnly(e.target.checked)} /> In-place only</label>
        <button type="button" className="btn btn-primary" disabled={picked.length !== 2} onClick={race}>
          {picked.length === 2 ? `Race ${SORT_ALGORITHMS[picked[0]!].label} vs ${SORT_ALGORITHMS[picked[1]!].label}` : 'Pick two rows to race them'}
        </button>
      </div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Sorting algorithms">
        <table>
          <thead>
            <tr>
              <th scope="col">Race</th>
              <th scope="col">Algorithm</th>
              <th scope="col">Best</th>
              <th scope="col">Average</th>
              <th scope="col">Worst</th>
              <th scope="col">Space</th>
              <th scope="col">Stable</th>
              <th scope="col">In-place</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const info = SORT_ALGORITHMS[r];
              return (
                <tr key={r} className={picked.includes(r) ? 'is-picked' : undefined}>
                  <td><input type="checkbox" checked={picked.includes(r)} onChange={() => toggle(r)} aria-label={`Pick ${info.label} to race`} /></td>
                  <th scope="row">{NAME[r] ?? info.label}</th>
                  <td>{info.complexity.best}</td>
                  <td>{info.complexity.average}</td>
                  <td>{info.complexity.worst}</td>
                  <td>{info.complexity.space}</td>
                  <td>{info.stable}</td>
                  <td>{info.inPlace}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="viz-hint">Values are the note's Summary Table. Racing runs both on the same input in compare mode below.</p>
    </div>
  );
}
