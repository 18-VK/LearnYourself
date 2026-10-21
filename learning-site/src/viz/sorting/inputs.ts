import type { InputKind } from './traces';

export type PresetName = 'random' | 'sorted' | 'reversed' | 'nearly' | 'dupes';
export const PRESETS: { id: PresetName; label: string }[] = [
  { id: 'random', label: 'Random' },
  { id: 'sorted', label: 'Sorted' },
  { id: 'reversed', label: 'Reversed' },
  { id: 'nearly', label: 'Nearly sorted' },
  { id: 'dupes', label: 'Many duplicates' },
];

interface Range {
  kind: InputKind;
  min: number;
  max: number;
}
const rnd = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const roundFor = (kind: InputKind, v: number) => (kind === 'unit-float' ? Math.round(v * 100) / 100 : Math.round(v));

/** Generates `n` values for a preset inside the algorithm's allowed range. */
export function makePreset(preset: PresetName, n: number, r: Range): number[] {
  const lo = r.kind === 'unit-float' ? 0 : r.min;
  const hi = r.kind === 'unit-float' ? 0.99 : r.max;
  const span = hi - lo;
  const ascending = () => Array.from({ length: n }, (_, i) => roundFor(r.kind, lo + span * 0.08 + (span * 0.88 * i) / Math.max(1, n - 1)));
  switch (preset) {
    case 'sorted':
      return ascending();
    case 'reversed':
      return ascending().reverse();
    case 'nearly': {
      const a = ascending();
      const swaps = Math.max(1, Math.floor(n / 5));
      for (let s = 0; s < swaps; s++) {
        const i = rnd(0, n - 2);
        [a[i], a[i + 1]] = [a[i + 1]!, a[i]!];
      }
      return a;
    }
    case 'dupes': {
      const pool = [0.2, 0.45, 0.45, 0.7].map((f) => roundFor(r.kind, lo + span * f));
      return Array.from({ length: n }, () => pool[rnd(0, pool.length - 1)]!);
    }
    default:
      return Array.from({ length: n }, () => (r.kind === 'unit-float' ? rnd(0, 99) / 100 : rnd(Math.max(lo, 1), hi)));
  }
}

export function formatValues(values: readonly number[], kind: InputKind): string {
  return values.map((v) => (kind === 'unit-float' ? v.toFixed(2) : String(v))).join(', ');
}

/** Parses the learner's input; returns an error message instead when it does not fit the algorithm. */
export function parseValues(text: string, r: Range & { maxLength: number }): number[] | string {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const values = parts.map(Number);
  const describe =
    r.kind === 'unit-float'
      ? `numbers from 0 to 0.99 (bucket sort in the notes assumes input in [0, 1))`
      : r.kind === 'non-negative-int'
        ? `whole numbers from 0 to ${r.max} (radix sort in the notes needs non-negative integers)`
        : `whole numbers from ${r.min} to ${r.max}`;
  if (values.length < 2 || values.length > r.maxLength) return `Enter 2 to ${r.maxLength} ${describe}, separated by commas.`;
  if (values.some((v) => Number.isNaN(v))) return `Only numbers, please: ${describe}.`;
  if (r.kind === 'unit-float') {
    if (values.some((v) => v < 0 || v >= 1)) return `Use ${describe}.`;
    return values.map((v) => Math.round(v * 100) / 100);
  }
  if (values.some((v) => !Number.isInteger(v) || v < (r.kind === 'non-negative-int' ? 0 : r.min) || v > r.max)) return `Use ${describe}.`;
  return values;
}
