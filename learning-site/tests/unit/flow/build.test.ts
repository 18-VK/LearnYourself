import { describe as suite, expect, it } from 'vitest';
import { autoSteps, chain, describe, diagram, src } from '../../../src/viz/flow/build';

suite('build helpers', () => {
  it('describes a box from its own lines only', () => {
    expect(describe({ id: 'a', label: 'Kestrel Web Server' })).toBe('Kestrel Web Server');
    expect(describe({ id: 'a', label: 'Authentication Server', lines: ['(Your ASP.NET Core API)'] })).toBe('Authentication Server (Your ASP.NET Core API)');
    expect(describe({ id: 'a', label: 'JWT Handler validates:', lines: ['- Signature ✅', '- Issuer ✅'] })).toBe('JWT Handler validates: Signature ✅; Issuer ✅');
    expect(describe({ id: 'a', label: 'OAuth 2.0', lines: ['(Authorization)', '• Scopes'] })).toBe('OAuth 2.0 (Authorization): Scopes');
  });

  it('chains nodes in order with one edge between neighbours and a step per edge', () => {
    const d = chain({ id: 'x', title: 'X', source: src('f.md', '# H', 2) }, ['A', { label: 'B', lines: ['(b)'] }, 'C'], { edgeLabels: { 2: 'via' } });
    expect(d.layout).toBe('chain');
    expect(d.source).toEqual({ file: 'f.md', section: '# H', codeBlock: 2 });
    expect(d.edges).toEqual([
      { id: 'e1', from: 'n1', to: 'n2' },
      { id: 'e2', from: 'n2', to: 'n3', label: 'via' },
    ]);
    expect(d.steps.map((s) => s.narration)).toEqual(['A', 'A → B (b)', 'B → C: via']);
  });

  it('starts automatic steps at a node nothing points to and lets narration be overridden', () => {
    const nodes = [
      { id: 'b', label: 'B' },
      { id: 'a', label: 'A' },
    ];
    const steps = autoSteps(nodes, [{ id: 'e', from: 'a', to: 'b' }], { 1: 'custom' });
    expect(steps).toEqual([{ focus: ['a'], narration: 'A' }, { edge: 'e', narration: 'custom' }]);
    const d = diagram({ id: 'd', title: 'D', source: src('f.md', '# H', 1, 2), layout: 'grid', nodes, edges: [] });
    expect(d.source.occurrence).toBe(2);
    expect(d.steps).toHaveLength(1);
  });
});
