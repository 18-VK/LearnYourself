import fs from 'node:fs';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { findHeading, loadNote } from '../../../scripts/lib/notes';
import { allKeys, buildRoadmap, type ResolveLink } from '../../../src/viz/roadmap/extract';
import { itemKeys, keyText } from '../../../src/viz/roadmap/keys';
import { comingSoon, nodeKeys, progressOf, setKeys } from '../../../src/viz/roadmap/progress';
import type { RoadmapData, RoadmapNode } from '../../../src/viz/roadmap/types';

describe('checklist keys', () => {
  it('ignore formatting, emoji, punctuation and spacing', () => {
    expect(keyText('**DNS Resolution** — already covered in Stage 1')).toBe(keyText('DNS Resolution - already  covered in Stage 1'));
    expect(keyText('- [ ] Modulo (`%`) and integer division')).toBe(keyText('Modulo (%) and integer division'));
    expect(keyText('🟢 **MUST** — core')).toBe('mustcore');
    expect(keyText('Sum of first n numbers: n(n+1)/2')).toBe('sumoffirstnnumbersnn12');
  });
  it('number repeated items in document order', () => {
    const k = itemKeys(['Retry', 'Fail', 'Retry', '**Retry**']);
    expect(k[0]).toMatch(/^k[0-9a-z]+$/);
    expect(k[2]).toBe(`${k[0]}-2`);
    expect(k[3]).toBe(`${k[0]}-3`);
    expect(new Set(k).size).toBe(4);
    expect(itemKeys(['Retry'], 'r')[0]).toBe(`r${k[0]!.slice(1)}`);
  });
});

// ── the real roadmap lessons, built the way the content pipeline builds them ──────────────
const COURSES = ['phase-1', 'desktop', 'phase-2', 'sql-server', 'dsa', 'math', 'backend-roadmap'];
interface Lesson {
  id: string;
  title: string;
  kind: string;
  sources: { file: string; from?: string; until?: string }[];
  nodeLinks?: Record<string, string[]>;
}
const courses = COURSES.map((c) => YAML.parse(fs.readFileSync(`curriculum/${c}.yaml`, 'utf8')));
const lessonIds = new Set<string>();
const modules = new Map<string, { title: string; planned: boolean; first?: string }>();
for (const c of courses) {
  for (const m of c.modules) {
    modules.set(`${c.id}/${m.id}`, { title: m.title, planned: m.status === 'planned', first: m.lessons[0]?.id });
    for (const l of m.lessons) lessonIds.add(`${c.id}/${m.id}/${l.id}`);
  }
}
const resolve: ResolveLink = (ref) => {
  if (lessonIds.has(ref)) return { title: ref, href: `${ref}/`, planned: false };
  const m = modules.get(ref);
  return m ? { title: m.title, href: m.planned ? '' : `${ref}/${m.first}/`, planned: m.planned } : null;
};
const roadmaps: [string, RoadmapData, string][] = [];
for (const c of courses) {
  for (const m of c.modules) {
    for (const l of m.lessons as Lesson[]) {
      const kind = l.kind ?? 'lesson';
      if (!(kind === 'roadmap' || (c.kind === 'roadmap' && kind === 'checklist'))) continue;
      const markdown = l.sources
        .map((s) => {
          const note = loadNote(s.file);
          const start = s.from ? findHeading(note, s.from).line : 0;
          const end = s.until ? findHeading(note, s.until).line : note.lines.length;
          return note.lines.slice(start, end).join('\n');
        })
        .join('\n\n');
      const id = `${c.id}/${m.id}/${l.id}`;
      roadmaps.push([id, buildRoadmap({ lessonId: id, markdown, nodeLinks: l.nodeLinks, resolve, fallbackTitle: l.title }), markdown]);
    }
  }
}
const flat = (d: RoadmapData): RoadmapNode[] => {
  const out: RoadmapNode[] = [];
  const walk = (n: RoadmapNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  d.nodes.forEach(walk);
  return out;
};

describe('roadmap lessons', () => {
  it('are the backend roadmaps, the DSA roadmap and the six math levels', () => {
    expect(roadmaps.map(([id]) => id).sort()).toEqual(
      [
        'backend-roadmap/roadmaps/beginner-to-job-ready',
        'backend-roadmap/roadmaps/database-design-roadmap',
        'backend-roadmap/roadmaps/request-to-response',
        'dsa/roadmap/dsa-roadmap',
        'math/level-1/foundations',
        'math/level-2/core-programming-math',
        'math/level-3/intermediate',
        'math/level-4/upper-intermediate',
        'math/level-5/advanced',
        'math/level-6/expert',
      ].sort(),
    );
  });
});

describe.each(roadmaps)('roadmap %s', (id, d, markdown) => {
  it('has a node for every heading but the title, nested by level', () => {
    const headings = markdown.split('\n').filter((l) => /^#{1,6}\s/.test(l));
    const nodes = flat(d);
    const titled = /^#\s/.test(headings[0] ?? '') ? 1 : 0;
    expect(nodes.length).toBe(headings.length - titled);
    for (const n of nodes) for (const c of n.children) expect(c.depth).toBeGreaterThan(n.depth);
  });
  it('has unique keys and every list item of the note', () => {
    const keys = allKeys(d);
    expect(new Set(keys).size).toBe(keys.length);
    const listLines = markdown.split('\n').filter((l) => /^\s*([-*+]|\d+[.)])\s/.test(l)).length;
    const lis = flat(d).flatMap((n) => n.items.filter((i) => !i.row));
    const beforeFirstHeading = markdown.split(/(?:^|\n)#{2,6}\s/)[0]!.split('\n').filter((l) => /^\s*([-*+]|\d+[.)])\s/.test(l)).length;
    expect(lis.length).toBe(listLines - beforeFirstHeading);
  });
  it('turns nodeLinks into links, with planned modules marked "coming soon"', () => {
    const linked = flat(d).filter((n) => n.links.length);
    const want = courses.flatMap((c) => c.modules.flatMap((m: { id: string; lessons: Lesson[] }) => m.lessons.filter((l) => `${c.id}/${m.id}/${l.id}` === id))).at(0)?.nodeLinks ?? {};
    expect(linked.length).toBe(Object.keys(want).length);
    for (const n of linked) for (const l of n.links) expect(l.planned ? l.href === '' : l.href.endsWith('/')).toBe(true);
  });
});

describe('roadmap content', () => {
  const get = (id: string) => roadmaps.find(([x]) => x === id)![1];
  it('beginner roadmap: eleven stages plus "How to actually use this"', () => {
    const d = get('backend-roadmap/roadmaps/beginner-to-job-ready');
    expect(d.title).toBe('Backend Developer Roadmap — Complete Beginner to Job-Ready');
    expect(d.nodes.map((n) => n.title)).toHaveLength(12);
    expect(d.nodes[0]!.title).toBe('Stage 0 — Programming Foundations');
    expect(d.nodes[0]!.items.map((i) => i.text)[4]).toBe('Version control: Git — commits, branches, merges, resolving conflicts, pull requests');
    const testing = d.nodes.find((n) => n.title.startsWith('Stage 7'))!;
    expect(comingSoon(testing)).toBe(true);
    expect(testing.links).toEqual([{ title: 'Testing', href: '', planned: true }]);
    const stage4 = d.nodes.find((n) => n.title.startsWith('Stage 4'))!;
    expect(comingSoon(stage4)).toBe(false);
    expect(stage4.items[0]!.text).toBe('DNS Resolution — already covered in Stage 1, revisit in context of production domains');
  });
  it('DSA roadmap: levels branch into topic tables with MUST/GOOD/OPTIONAL tags', () => {
    const d = get('dsa/roadmap/dsa-roadmap');
    const l1 = d.nodes.find((n) => n.title.startsWith('Level 1'))!;
    expect(l1.children.map((c) => c.title)).toEqual(['Data structures', 'Patterns', 'Sorting & searching']);
    const ds = l1.children[0]!;
    expect(ds.items[0]).toMatchObject({ text: 'Arrays', tag: '🟢', row: true, detail: 'Traversal, prefix sums, in-place modification, 2D arrays/matrix' });
    expect(ds.items.filter((i) => i.tag === '⚪').map((i) => i.text)).toEqual(['Linked List (doubly / circular)']);
    const core = d.nodes.find((n) => n.title.startsWith('Absolute Must-Know'))!;
    expect(core.items).toHaveLength(20);
  });
  it('math level 1: one level with four topics', () => {
    const d = get('math/level-1/foundations');
    expect(d.nodes).toHaveLength(1);
    expect(d.nodes[0]!.children.map((c) => [c.title, c.items.length])).toEqual([
      ['Arithmetic & Number Sense', 7],
      ['Number Systems', 6],
      ['Basic Algebra', 5],
      ['Basic Logic', 4],
    ]);
  });
});

describe('roadmap progress', () => {
  const leaf = (id: string, items: string[]): RoadmapNode => ({ id, title: id, depth: 3, key: `n-${id}`, items: items.map((k) => ({ key: k, text: k })), links: [], children: [] });
  const root: RoadmapNode = { ...leaf('root', []), depth: 2, children: [leaf('a', ['a1', 'a2']), leaf('b', [])] };
  it('a node stands for its items and its children; prose-only leaves use their own key', () => {
    expect(nodeKeys(root)).toEqual(['a1', 'a2', 'n-b']);
    expect(nodeKeys(leaf('x', ['x1']))).toEqual(['x1']);
  });
  it('reports done, partial and todo', () => {
    expect(progressOf(['a', 'b'], {})).toEqual({ done: 0, total: 2, state: 'todo' });
    expect(progressOf(['a', 'b'], { a: true })).toEqual({ done: 1, total: 2, state: 'partial' });
    expect(progressOf(['a', 'b'], { a: true, b: true })).toEqual({ done: 2, total: 2, state: 'done' });
    expect(progressOf([], {}).state).toBe('todo');
  });
  it('ticks and clears groups of keys without touching others', () => {
    const on = setKeys({ z: true }, ['a', 'b'], true);
    expect(on).toEqual({ z: true, a: true, b: true });
    expect(setKeys(on, ['a', 'b'], false)).toEqual({ z: true });
  });
  it('treats a node as "coming soon" only when every link is to a planned module', () => {
    expect(comingSoon({ ...leaf('s', []), links: [{ title: 'T', href: '', planned: true }] })).toBe(true);
    expect(comingSoon({ ...leaf('s', []), links: [{ title: 'T', href: '', planned: true }, { title: 'L', href: 'x/', planned: false }] })).toBe(false);
    expect(comingSoon(leaf('s', []))).toBe(false);
  });
});
