import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { doublingFactor, formatLog10, GROWTH_CLASSES, N_STEPS, opsAt, pickClasses } from '../../../src/viz/dsa/bigo';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const roadmap = readFileSync(root('Competitive%20Programming/dsa-roadmap.md'), 'utf8');

describe('Big-O growth classes', () => {
  it("are exactly the roadmap's list, in its order", () => {
    expect(roadmap).toContain(GROWTH_CLASSES.map((c) => c.label).join(', '));
  });
  it("match the roadmap placement's props", () => {
    const dsa = parse(readFileSync(root('learning-site/curriculum/dsa.yaml'), 'utf8')) as { modules: { lessons: { place?: { viz?: string; props?: { classes?: string[] } }[] }[] }[] };
    const place = dsa.modules.flatMap((m) => m.lessons.flatMap((l) => l.place ?? [])).filter((p) => p.viz === 'BigOGrowthVisualizer');
    expect(place).toHaveLength(1);
    expect(pickClasses(place[0]!.props!.classes).map((c) => c.id)).toEqual(place[0]!.props!.classes);
  });
  it('count operations by hand at n = 8: 1, 3, 8, 24, 64, 256', () => {
    expect(GROWTH_CLASSES.map((c) => Math.round(opsAt(c, 8)))).toEqual([1, 3, 8, 24, 64, 256]);
  });
  it('grow by the expected factor when n doubles', () => {
    const byId = Object.fromEntries(GROWTH_CLASSES.map((c) => [c.id, c]));
    expect(doublingFactor(byId['O(1)']!, 50)).toBe('×1.00');
    expect(doublingFactor(byId['O(n)']!, 50)).toBe('×2.00');
    expect(doublingFactor(byId['O(n²)']!, 50)).toBe('×4.00');
    expect(doublingFactor(byId['O(log n)']!, 8)).toBe('×1.33');
    expect(doublingFactor(byId['O(2ⁿ)']!, 8)).toBe('×256.00');
  });
  it('format small counts exactly and huge ones in scientific notation, even past double overflow', () => {
    expect(formatLog10(Math.log10(1_000_000))).toBe('1,000,000');
    expect(formatLog10(Math.log10(Math.log2(100)))).toBe('6.6');
    expect(formatLog10(100 * Math.log10(2))).toBe('1.27 × 10³⁰');
    const huge = GROWTH_CLASSES.at(-1)!.log10(1_000_000);
    expect(formatLog10(huge)).toMatch(/^\d\.\d\d × 10[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/);
    expect(formatLog10(-Infinity)).toBe('0');
  });
  it('has slider steps that increase and include the roadmap example n = 10⁵', () => {
    for (let k = 1; k < N_STEPS.length; k++) expect(N_STEPS[k]!).toBeGreaterThan(N_STEPS[k - 1]!);
    expect(N_STEPS).toContain(100_000);
    expect(roadmap).toContain('n ≤ 10⁵ → need O(n log n) or better');
  });
});
