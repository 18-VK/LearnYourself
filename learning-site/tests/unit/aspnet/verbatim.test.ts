import { describe, expect, it } from 'vitest';
import { REGISTRY } from '../../../src/viz/aspnet/registry';
import { VERBATIM } from '../../../src/viz/aspnet/verbatim';
import { noteText } from './helpers';

/** The same rule the content pipeline applies (scripts/lib/generate.ts): notes inside a fenced block, source files anywhere. */
function fencedBlocks(text: string): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  let open: { marker: string; start: number } | null = null;
  lines.forEach((l, i) => {
    const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(l);
    if (open) {
      if (m && m[1]![0] === open.marker[0] && m[1]!.length >= open.marker.length && !m[2]!.trim()) {
        out.push(lines.slice(open.start + 1, i).join('\n'));
        open = null;
      }
    } else if (m) open = { marker: m[1]!, start: i };
  });
  return out;
}

describe('ASP.NET Core verbatim checks', () => {
  it.each(VERBATIM.map((v) => [v.label, v] as const))('%s still matches its source', (_label, v) => {
    const text = noteText(v.file);
    if (/\.(md|txt)$/i.test(v.file)) expect(fencedBlocks(text).some((b) => b.includes(v.code))).toBe(true);
    else expect(text).toContain(v.code);
  });

  it('registers every visualizer this area ships, in the shape the smoke test reads', () => {
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        'CapstoneTraceVisualizer',
        'CorsPreflightVisualizer',
        'HttpClientPoolingVisualizer',
        'HttpsHstsVisualizer',
        'JwtDecoderVisualizer',
        'JwtSequenceVisualizer',
        'MiddlewarePipelineVisualizer',
        'ModelBindingVisualizer',
        'ProblemDetailsVisualizer',
        'RateLimiterVisualizer',
        'RefreshRotationVisualizer',
        'RouteMatcherVisualizer',
        'Rs256Visualizer',
      ].sort(),
    );
  });
});
