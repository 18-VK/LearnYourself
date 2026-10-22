import { getPrime } from '../dsa/hash/model';
import { isStrictlyUnimodal } from './traces/ternary';
import type { InputKind, SearchAlgorithmInfo } from './traces';

export interface Preset {
  id: string;
  label: string;
}

/** The input presets each kind of input offers. */
export const PRESETS: Record<InputKind, Preset[]> = {
  any: [
    { id: 'random', label: 'Random' },
    { id: 'dupes', label: 'Many duplicates' },
    { id: 'collisions', label: 'Many collisions' },
  ],
  sorted: [
    { id: 'random', label: 'Random sorted' },
    { id: 'even', label: 'Evenly spaced' },
    { id: 'dupes', label: 'With duplicates' },
    { id: 'skewed', label: 'Skewed' },
  ],
  unimodal: [
    { id: 'peak-left', label: 'Peak near the start' },
    { id: 'peak-middle', label: 'Peak in the middle' },
    { id: 'peak-right', label: 'Peak near the end' },
    { id: 'random', label: 'Random mountain' },
  ],
  number: [
    { id: 'square', label: 'Perfect square' },
    { id: 'between', label: 'Between squares' },
    { id: 'tiny', label: 'x = 1' },
    { id: 'random', label: 'Random x' },
  ],
};

type Rnd = () => number;
const int = (rnd: Rnd, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const asc = (a: number[]) => [...a].sort((x, y) => x - y);

/** Generates `n` values for a preset, inside the algorithm's value range. */
export function makeValues(info: SearchAlgorithmInfo, preset: string, n: number, rnd: Rnd = Math.random): number[] {
  const { min, max } = info;
  switch (info.input) {
    case 'number': {
      if (preset === 'square') return [[16, 25, 36, 49, 64, 81][int(rnd, 0, 5)]!];
      if (preset === 'between') return [[30, 40, 50, 70, 90][int(rnd, 0, 4)]!];
      if (preset === 'tiny') return [1];
      return [int(rnd, 0, max)];
    }
    case 'unimodal': {
      const peak = preset === 'peak-left' ? Math.min(1, n - 1) : preset === 'peak-right' ? Math.max(0, n - 2) : preset === 'peak-middle' ? Math.floor(n / 2) : int(rnd, 0, n - 1);
      const top = int(rnd, Math.floor(max * 0.8), Math.floor(max * 0.95));
      const up = asc(distinct(rnd, peak, min + 1, top - 1));
      const down = asc(distinct(rnd, n - peak - 1, min, top - 1)).reverse();
      return [...up, top, ...down];
    }
    case 'sorted': {
      if (preset === 'even') {
        const stepSize = Math.max(1, Math.floor((max - min) / Math.max(1, n)));
        return Array.from({ length: n }, (_, i) => min + stepSize * (i + 1));
      }
      if (preset === 'dupes') {
        const pool = asc(distinct(rnd, Math.max(2, Math.ceil(n / 3)), min, Math.min(max, 40)));
        return asc(Array.from({ length: n }, () => pool[int(rnd, 0, pool.length - 1)]!));
      }
      if (preset === 'skewed') {
        // most values packed at the low end, a few far away: interpolation search's bad case
        const lowCount = Math.max(1, n - 2);
        return [...Array.from({ length: lowCount }, (_, i) => min + 1 + i), ...asc(distinct(rnd, n - lowCount, Math.floor(max * 0.8), max))];
      }
      return asc(distinct(rnd, n, min, max));
    }
    default: {
      if (preset === 'dupes') {
        const pool = distinct(rnd, Math.max(2, Math.ceil(n / 3)), min, max);
        return Array.from({ length: n }, () => pool[int(rnd, 0, pool.length - 1)]!);
      }
      if (preset === 'collisions') {
        // values that share a remainder land in the same bucket (the bucket count is a prime ≥ n)
        const m = getPrime(n);
        const base = int(rnd, 0, m - 1);
        return Array.from({ length: n }, (_, i) => (i % 3 === 2 ? int(rnd, min, max) : base + m * int(rnd, 0, Math.floor((max - base) / m))));
      }
      return Array.from({ length: n }, () => int(rnd, min, max));
    }
  }
}

function distinct(rnd: Rnd, count: number, lo: number, hi: number): number[] {
  const span = hi - lo + 1;
  if (count >= span) return Array.from({ length: Math.max(0, Math.min(count, span)) }, (_, i) => lo + i);
  const set = new Set<number>();
  while (set.size < count) set.add(int(rnd, lo, hi));
  return [...set];
}

export interface Parsed {
  values: number[];
  /** Shown when the input was changed to fit the algorithm (for example sorted). */
  notice?: string;
}

/** Parses the learner's values; returns an error message when they do not fit the algorithm. */
export function parseValues(text: string, info: SearchAlgorithmInfo): Parsed | string {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const values = parts.map(Number);
  const { min, max, minLength, maxLength } = info;
  if (info.input === 'number') {
    if (values.length !== 1 || !Number.isInteger(values[0]) || values[0]! < min || values[0]! > max) return `Enter one whole number x from ${min} to ${max}.`;
    return { values };
  }
  if (values.length < minLength || values.length > maxLength) return `Enter ${minLength} to ${maxLength} whole numbers from ${min} to ${max}, separated by commas.`;
  if (values.some((v) => !Number.isInteger(v) || v < min || v > max)) return `Use whole numbers from ${min} to ${max}.`;
  if (info.input === 'unimodal' && !isStrictlyUnimodal(values))
    return 'TernaryMaxIndex needs values that strictly increase and then strictly decrease (no equal neighbours: plateaus break it).';
  if (info.input === 'sorted') {
    const sorted = asc(values);
    if (sorted.some((v, i) => v !== values[i])) return { values: sorted, notice: `${info.label} needs sorted input, so the values were sorted first.` };
  }
  return { values };
}

export const formatValues = (values: readonly number[]) => values.join(', ');

/** A target that is in the array (the "found" case). */
export function pickPresent(values: readonly number[], rnd: Rnd = Math.random): number {
  return values.length ? values[int(rnd, 0, values.length - 1)]! : 0;
}

/** A target that is not in the array but inside or near its range (the "not found" case). */
export function pickMissing(values: readonly number[], info: SearchAlgorithmInfo, rnd: Rnd = Math.random): number {
  const set = new Set(values);
  const lo = Math.max(info.min, Math.min(...values, info.max) - 3);
  const hi = Math.min(info.max, Math.max(...values, info.min) + 3);
  const gaps: number[] = [];
  for (let v = lo; v <= hi; v++) if (!set.has(v)) gaps.push(v);
  if (gaps.length) return gaps[int(rnd, 0, gaps.length - 1)]!;
  for (let v = info.min; v <= info.max; v++) if (!set.has(v)) return v;
  return info.max + 1;
}
