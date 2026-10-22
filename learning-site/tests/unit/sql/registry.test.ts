import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REGISTRY } from '../../../src/viz/sql/registry';
import { VERBATIM } from '../../../src/viz/sql/verbatim';
import { codeBlocks, readNote } from './helpers';

const manifest = readFileSync(fileURLToPath(new URL('../../../curriculum/sql-server.yaml', import.meta.url)), 'utf8');

describe('SQL visualizer registry', () => {
  it('registers every SQL visualizer the manifest places (except the FlowDiagram placement)', () => {
    const placed = new Set([...manifest.matchAll(/- viz: (\w+)/g)].map((m) => m[1]!));
    expect([...placed].sort()).toEqual(Object.keys(REGISTRY).sort());
  });

  it('every placement prop value is one the visualizers support', () => {
    const props = [...manifest.matchAll(/- viz: (\w+)\n\s+props: (\{.*\})/g)].map((m) => `${m[1]} ${m[2]}`);
    for (const p of props) {
      if (p.startsWith('JoinVisualizer')) expect(p).toMatch(/join: (inner|left|right|full|cross|self|outer-apply|anti) \}/);
      if (p.startsWith('IndexVisualizer')) expect(p).toMatch(/scenario: (clustered-vs-nonclustered-covering|write-cost|seek-scan-lookup) \}/);
      if (p.startsWith('IsolationSimulator')) expect(p).toMatch(/scenario: (anomalies|isolation-levels|blocking|deadlock)/);
      if (p.startsWith('WindowFunctionVisualizer')) expect(p).toMatch(/functions: \[(ROW_NUMBER, RANK, DENSE_RANK|SUM)\]/);
    }
  });

  it('uses the registry line shape the smoke test parses', () => {
    const src = readFileSync(fileURLToPath(new URL('../../../src/viz/sql/registry.ts', import.meta.url)), 'utf8');
    const names = [...src.matchAll(/^\s+(\w+): \(\) => import\('\.\/(\w+)'\) as Promise<VizModule>,$/gm)].map((m) => m[1]);
    expect(names.sort()).toEqual(Object.keys(REGISTRY).sort());
  });
});

describe('verbatim SQL', () => {
  it.each(VERBATIM.map((v) => [v.label, v] as const))('%s is inside a fenced block of its note', (_l, v) => {
    const note = readNote(v.file);
    expect(codeBlocks(note).some((b) => b.includes(v.code))).toBe(true);
    expect(note).toContain(v.heading);
  });
});
