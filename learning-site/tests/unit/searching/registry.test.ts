import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { SEARCH_CODE, SEARCH_SOURCE_HEADING, type SearchCodeId } from '../../../src/viz/searching/csharp';
import { makeValues, parseValues, PRESETS } from '../../../src/viz/searching/inputs';
import { isStrictlyUnimodal } from '../../../src/viz/searching/traces/ternary';
import { SEARCH_ALGORITHMS, SEARCH_ORDER, toSearchAlgorithm } from '../../../src/viz/searching/traces/index';
import { VERBATIM } from '../../../src/viz/searching/verbatim';
import { rng } from './helpers';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const note = readFileSync(root('Competitive%20Programming/searching-algorithms-notes.md'), 'utf8').replace(/\r\n/g, '\n');

function summaryRow(name: string): string[] {
  const line = note.slice(note.indexOf('## Summary Table')).split('\n').find((l) => l.startsWith(`| ${name} |`));
  if (!line) throw new Error(`No Summary Table row for ${name}`);
  return line.split('|').slice(2, -1).map((c) => c.trim());
}

describe('searching code panels', () => {
  it('copy every code block verbatim from a fenced block of the note, under its heading', () => {
    const fences = [...note.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]!);
    for (const id of Object.keys(SEARCH_CODE) as SearchCodeId[]) {
      expect(fences.some((f) => f.includes(SEARCH_CODE[id])), id).toBe(true);
      const at = note.indexOf(SEARCH_CODE[id]);
      const heading = note.lastIndexOf(SEARCH_SOURCE_HEADING[id], at);
      expect(heading, `${id} sits under ${SEARCH_SOURCE_HEADING[id]}`).toBeGreaterThanOrEqual(0);
      expect(note.slice(heading, at).match(/^#{2,3} /gm)?.length ?? 0, `${id}: no other heading in between`).toBe(1);
    }
    expect(VERBATIM.map((v) => v.code).sort()).toEqual(Object.values(SEARCH_CODE).sort());
  });
});

describe('search algorithm registry', () => {
  it('lists every algorithm once', () => {
    expect([...SEARCH_ORDER].sort()).toEqual(Object.keys(SEARCH_ALGORITHMS).sort());
  });

  describe.each(SEARCH_ORDER)('%s', (id) => {
    const info = SEARCH_ALGORITHMS[id];
    it("matches the note's Summary Table row", () => {
      const [avg, worst, space, sorted] = summaryRow(info.summaryRow);
      expect([info.complexity.average, info.complexity.worst, info.complexity.space, info.complexity.sorted]).toEqual([avg, worst, space, sorted]);
    });
    it('has defaults that fit its own input rules', () => {
      const r = parseValues(info.defaults.values.join(', '), info);
      expect(typeof r).not.toBe('string');
      if (typeof r !== 'string') {
        expect(r.values).toEqual(info.defaults.values);
        expect(r.notice).toBeUndefined();
      }
    });
    it('makes valid inputs from every preset at every size', () => {
      const next = rng(31);
      for (const pr of PRESETS[info.input]) {
        for (let n = info.minLength; n <= (info.input === 'number' ? 1 : info.maxLength); n++) {
          const v = makeValues(info, pr.id, n, next);
          const r = parseValues(v.join(', '), info);
          expect(typeof r, `${pr.id} n=${n}: ${v.join(',')}`).not.toBe('string');
          if (info.input !== 'number') expect(v).toHaveLength(n);
        }
      }
    });
  });

  it('sorts unsorted input for algorithms that need sorted input, and says so', () => {
    const r = parseValues('5, 1, 3', SEARCH_ALGORITHMS.binary);
    expect(r).toEqual({ values: [1, 3, 5], notice: 'Binary search (iterative) needs sorted input, so the values were sorted first.' });
    expect(parseValues('5, 1, 3', SEARCH_ALGORITHMS.linear)).toEqual({ values: [5, 1, 3] });
  });
  it('rejects input that is not strictly unimodal for ternary search', () => {
    expect(typeof parseValues('1, 3, 3, 1', SEARCH_ALGORITHMS.ternary)).toBe('string');
    expect(isStrictlyUnimodal(makeValues(SEARCH_ALGORITHMS.ternary, 'random', 9, rng(5)))).toBe(true);
  });
  it('makes hash collision presets that really collide', () => {
    const v = makeValues(SEARCH_ALGORITHMS.hash, 'collisions', 9, rng(8));
    const buckets = v.map((x) => x % 11);
    expect(new Set(buckets).size).toBeLessThan(v.length);
  });
});

describe('lesson placements', () => {
  const dsa = parse(readFileSync(root('learning-site/curriculum/dsa.yaml'), 'utf8')) as {
    modules: { lessons: { place?: { viz?: string; props?: Record<string, unknown> }[] }[] }[];
  };
  const places = dsa.modules.flatMap((m) => m.lessons.flatMap((l) => l.place ?? []));

  it('every SearchVisualizer placement names an algorithm this visualizer has', () => {
    const search = places.filter((p) => p.viz === 'SearchVisualizer');
    expect(search.length).toBe(9);
    for (const p of search) {
      const name = p.props?.algorithm as string;
      const id = toSearchAlgorithm(name, (p.props?.variants as string[] | undefined)?.[0]);
      expect(id === 'linear' ? name === 'linear' : true, name).toBe(true);
      expect(SEARCH_ALGORITHMS[id]).toBeDefined();
      for (const k of Object.keys(p.props ?? {})) expect(['algorithm', 'variants', 'predictMode', 'preset', 'target', 'view', 'showCollisions']).toContain(k);
    }
  });
  it("the bounds placement uses the note's own example", () => {
    const b = places.find((p) => p.viz === 'SearchVisualizer' && p.props?.algorithm === 'bounds')!;
    expect(b.props).toMatchObject({ preset: [1, 2, 2, 2, 3], target: 2 });
    expect(note).toContain('**Example:** `arr = [1, 2, 2, 2, 3]`, `target = 2`');
  });
  it('every GraphSearchVisualizer placement uses supported props', () => {
    const graph = places.filter((p) => p.viz === 'GraphSearchVisualizer');
    expect(graph.map((p) => p.props?.algorithm).sort()).toEqual(['bfs', 'dfs']);
    for (const p of graph) {
      for (const k of Object.keys(p.props ?? {})) expect(['algorithm', 'editable', 'presets', 'predictMode']).toContain(k);
      for (const pr of p.props?.presets as string[]) expect(['graph', 'grid-as-graph']).toContain(pr);
    }
  });
});
