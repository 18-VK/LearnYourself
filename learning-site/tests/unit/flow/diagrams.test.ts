import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { findHeading, loadNote, normHeading, sectionEnd } from '../../../scripts/lib/notes';
import { DIAGRAMS } from '../../../src/viz/flow/diagrams';
import { focusOf } from '../../../src/viz/flow/state';
import type { FlowDiagramData } from '../../../src/viz/flow/types';

const DIR = 'src/viz/flow/diagrams';
const COURSES = ['phase-1', 'desktop', 'phase-2', 'sql-server', 'dsa', 'math', 'backend-roadmap'];

interface Placement {
  lesson: string;
  files: string[];
  diagram: string;
  section: string;
  codeBlock?: number;
  occurrence?: number;
}
const placements: Placement[] = [];
for (const c of COURSES) {
  const course = YAML.parse(fs.readFileSync(`curriculum/${c}.yaml`, 'utf8'));
  for (const m of course.modules) {
    for (const l of m.lessons ?? []) {
      for (const p of l.place ?? []) {
        if (p.diagram) placements.push({ lesson: `${c}/${m.id}/${l.id}`, files: l.sources.map((s: { file: string }) => s.file), diagram: p.diagram, section: p.at.section, codeBlock: p.at.codeBlock, occurrence: p.at.atOccurrence });
      }
    }
  }
}

const all: [string, FlowDiagramData][] = await Promise.all(Object.entries(DIAGRAMS).map(async ([id, load]) => [id, (await load()).default] as [string, FlowDiagramData]));

/** Text of the Nth fenced block under a heading, the same way the content pipeline finds it. */
function asciiBlock(file: string, section: string, codeBlock: number, occurrence = 1): string {
  const note = loadNote(file);
  const h = findHeading(note, section, occurrence);
  const end = sectionEnd(note, h);
  const f = note.fences.filter((x) => x.start > h.line && x.start < end)[codeBlock - 1];
  if (!f) throw new Error(`${file}: no code block ${codeBlock} under ${section}`);
  return note.lines.slice(f.start + 1, f.end).join('\n');
}
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('diagram registry', () => {
  it('lists exactly the files in src/viz/flow/diagrams', () => {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts').map((f) => path.basename(f, '.ts')).sort();
    expect(Object.keys(DIAGRAMS).sort()).toEqual(files);
  });
  it('has a diagram for every diagram: placement, and every diagram is placed exactly once', () => {
    for (const p of placements) expect(DIAGRAMS[p.diagram], `${p.lesson} places unknown diagram ${p.diagram}`).toBeDefined();
    for (const id of Object.keys(DIAGRAMS)) expect(placements.filter((p) => p.diagram === id).length, `${id} placements`).toBe(1);
  });
});

describe.each(all)('diagram %s', (id, d) => {
  it('is well formed', () => {
    expect(d.id).toBe(id);
    expect(d.title.trim()).not.toBe('');
    const nodeIds = d.nodes.map((n) => n.id);
    const edgeIds = d.edges.map((e) => e.id);
    expect(new Set(nodeIds).size, 'unique node ids').toBe(nodeIds.length);
    expect(new Set(edgeIds).size, 'unique edge ids').toBe(edgeIds.length);
    for (const n of d.nodes) expect(n.label.trim(), `node ${n.id} label`).not.toBe('');
    for (const e of d.edges) {
      expect(nodeIds, `edge ${e.id} from`).toContain(e.from);
      expect(nodeIds, `edge ${e.id} to`).toContain(e.to);
      expect(e.from, `edge ${e.id} is a self-loop`).not.toBe(e.to);
    }
    expect(d.steps.length).toBeGreaterThan(0);
    for (const [i, s] of d.steps.entries()) {
      if (s.edge) expect(edgeIds, `step ${i} edge`).toContain(s.edge);
      for (const f of s.focus ?? []) expect(nodeIds, `step ${i} focus`).toContain(f);
      expect(focusOf(d, s).length, `step ${i} highlights something`).toBeGreaterThan(0);
      expect(s.narration.trim(), `step ${i} narration`).not.toBe('');
      if (s.reverse) expect(d.edges.find((e) => e.id === s.edge)?.twoWay, `step ${i} reverses a one-way edge`).toBe(true);
    }
    // every node is reached by some step
    const seen = new Set(d.steps.flatMap((s) => focusOf(d, s)));
    for (const n of d.nodes) expect(seen.has(n.id), `node ${n.id} is never highlighted`).toBe(true);
  });

  it('has the shape its layout expects', () => {
    if (d.layout === 'grid') for (const n of d.nodes) expect(n.at, `grid node ${n.id} needs a position`).toBeDefined();
    if (d.layout === 'chain') {
      expect(d.edges.length).toBe(d.nodes.length - 1);
      d.edges.forEach((e, i) => {
        expect(e.from).toBe(d.nodes[i]!.id);
        expect(e.to).toBe(d.nodes[i + 1]!.id);
      });
    }
    if (d.layout === 'tree') {
      const parents = new Map<string, string>();
      for (const e of d.edges) {
        expect(parents.has(e.to), `${e.to} has two parents`).toBe(false);
        parents.set(e.to, e.from);
      }
      for (const n of d.nodes) {
        const seen = new Set<string>();
        for (let cur: string | undefined = n.id; cur; cur = parents.get(cur)) {
          expect(seen.has(cur), `cycle through ${cur}`).toBe(false);
          seen.add(cur);
        }
      }
    }
  });

  it('is placed on the block it transcribes', () => {
    const p = placements.find((x) => x.diagram === id);
    expect(p, 'placement').toBeDefined();
    expect(p!.files).toContain(d.source.file);
    expect(normHeading(p!.section)).toBe(normHeading(d.source.section));
    expect(p!.codeBlock ?? 0).toBe(d.source.codeBlock);
    expect(p!.occurrence ?? 1).toBe(d.source.occurrence ?? 1);
  });

  it('transcribes the ASCII exactly: every label is in the original block, in order', () => {
    const block = squash(asciiBlock(d.source.file, d.source.section, d.source.codeBlock, d.source.occurrence));
    let at = 0;
    for (const n of d.nodes) {
      for (const text of [n.label, ...(n.lines ?? [])]) {
        const t = squash(text);
        expect(block.includes(t), `"${t}" is not in the original block:\n${block}`).toBe(true);
      }
      if (d.layout === 'chain') {
        const k = block.indexOf(squash(n.label), at);
        expect(k, `"${n.label}" appears out of order`).toBeGreaterThanOrEqual(0);
        at = k + squash(n.label).length;
      }
    }
    for (const e of d.edges) if (e.label) expect(block.includes(squash(e.label)), `edge label "${e.label}"`).toBe(true);
  });
});
