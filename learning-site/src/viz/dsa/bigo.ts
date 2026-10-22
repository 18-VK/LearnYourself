/**
 * The growth classes the roadmap note lists under "Time & Space Complexity (Big-O)":
 * O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ). Each is drawn as the operation count it names, with
 * log meaning log₂ (the number of times n can be halved). Values are also computed as log₁₀ so 2ⁿ stays
 * plottable and printable long after it overflows a double (n > 1023).
 */
export interface GrowthClass {
  id: string;
  /** As written in the note. */
  label: string;
  formula: string;
  /** log₁₀ of the operation count at n (−Infinity when the count is 0). */
  log10: (n: number) => number;
}

const LOG10_2 = Math.log10(2);
const log2 = (n: number) => Math.log2(n);

export const GROWTH_CLASSES: GrowthClass[] = [
  { id: 'O(1)', label: 'O(1)', formula: '1', log10: () => 0 },
  { id: 'O(log n)', label: 'O(log n)', formula: 'log₂ n', log10: (n) => Math.log10(log2(n)) },
  { id: 'O(n)', label: 'O(n)', formula: 'n', log10: (n) => Math.log10(n) },
  { id: 'O(n log n)', label: 'O(n log n)', formula: 'n · log₂ n', log10: (n) => Math.log10(n) + Math.log10(log2(n)) },
  { id: 'O(n²)', label: 'O(n²)', formula: 'n²', log10: (n) => 2 * Math.log10(n) },
  { id: 'O(2ⁿ)', label: 'O(2ⁿ)', formula: '2ⁿ', log10: (n) => n * LOG10_2 },
];

const ALIASES: Record<string, string> = { 'O(n^2)': 'O(n²)', 'O(n2)': 'O(n²)', 'O(2^n)': 'O(2ⁿ)', 'O(logn)': 'O(log n)', 'O(nlogn)': 'O(n log n)' };

/** The classes named by a placement's props, in the order given (unknown names are skipped). */
export function pickClasses(names: readonly string[] | undefined): GrowthClass[] {
  if (!names?.length) return GROWTH_CLASSES;
  const out: GrowthClass[] = [];
  for (const raw of names) {
    const c = GROWTH_CLASSES.find((g) => g.id === (ALIASES[raw] ?? raw));
    if (c && !out.includes(c)) out.push(c);
  }
  return out.length ? out : GROWTH_CLASSES;
}

/** The operation count as a number (Infinity once it no longer fits in a double). */
export const opsAt = (c: GrowthClass, n: number) => 10 ** c.log10(n);

const SUPERSCRIPT: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
export const superscript = (k: number) => String(k).replace(/[0-9-]/g, (d) => SUPERSCRIPT[d]!);

/** Formats an operation count given as log₁₀: exact below 10¹⁵, scientific (1.27 × 10³⁰) above. */
export function formatLog10(l: number): string {
  if (l === -Infinity) return '0';
  if (l < 15) {
    const v = 10 ** l;
    const rounded = Math.round(v);
    if (Math.abs(v - rounded) < 1e-9 * Math.max(1, v)) return rounded.toLocaleString('en-US');
    return v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
  }
  const exp = Math.floor(l);
  const mant = 10 ** (l - exp);
  return `${mant.toFixed(2)} × 10${superscript(exp)}`;
}

/** How many times bigger the count gets when n doubles, as text (×2.00, ×4.00, ×1.29…). */
export function doublingFactor(c: GrowthClass, n: number): string {
  const a = c.log10(n);
  const b = c.log10(2 * n);
  if (a === -Infinity) return 'from 0 to 1';
  const d = b - a;
  if (d < 15) return `×${(10 ** d).toFixed(2)}`;
  return `×${formatLog10(d)}`;
}

/** The n values the slider steps through. */
export const N_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 64, 100, 128, 256, 512, 1000, 2048, 10_000, 100_000, 1_000_000];
