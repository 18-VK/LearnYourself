/**
 * Builds RoadmapGraph props from a roadmap note (runs in the content pipeline, never in the browser).
 *
 * Every heading becomes a node (the note's opening `#` title is the graph title), nested by heading
 * level. Items are the list items and table rows between a heading and the next one. List-item keys are
 * computed over every list item in the lesson, in document order, exactly as src/scripts/lesson.ts does
 * on the page, so the graph and the page checklist read and write the same progress entries.
 */
import type { Heading, ListItem, Nodes, Root, RootContent, Table } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { normText } from '../../markdown/text';
import { itemKeys } from './keys';
import type { RoadmapData, RoadmapItem, RoadmapLink, RoadmapNode } from './types';

export type ResolveLink = (ref: string) => RoadmapLink | null;

const TAG = /^[🟢🟡⚪]/u;

/** A list item's own text: its content without nested lists (what the page shows next to its checkbox). */
function ownText(li: ListItem): string {
  return li.children
    .filter((c) => c.type !== 'list')
    .map((c) => toString(c))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collect(node: Nodes, out: { li: ListItem[]; tables: Table[]; headings: Heading[] }): void {
  if (node.type === 'listItem') out.li.push(node);
  if (node.type === 'table') out.tables.push(node);
  if (node.type === 'heading') out.headings.push(node);
  if ('children' in node) for (const c of node.children as Nodes[]) collect(c, out);
}

const headingKey = (depth: number, text: string) => `${depth} ${normText(text)}`;
function anchorKey(anchor: string): string | null {
  const m = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(anchor);
  return m ? headingKey(m[1]!.length, m[2]!) : null;
}

export function buildRoadmap(opts: { lessonId: string; markdown: string; nodeLinks?: Record<string, string[]>; resolve: ResolveLink; fallbackTitle: string }): RoadmapData {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(opts.markdown) as Root;
  const found = { li: [] as ListItem[], tables: [] as Table[], headings: [] as Heading[] };
  for (const c of tree.children as RootContent[]) collect(c, found);
  const pos = (n: Nodes) => n.position?.start.offset ?? 0;

  // the opening "# Title" names the graph instead of becoming a node
  let headings = found.headings;
  let title = opts.fallbackTitle;
  const first = headings[0];
  if (first && first.depth === 1 && !tree.children.slice(0, tree.children.indexOf(first as RootContent)).some((c) => c.type !== 'thematicBreak' && c.type !== 'html')) {
    title = toString(first).trim();
    headings = headings.slice(1);
  }

  const headingTexts = headings.map((h) => toString(h).replace(/\s+/g, ' ').trim());
  const nodeKeys = itemKeys(headingTexts, 'n');
  const links = new Map<string, RoadmapLink[]>();
  for (const [anchor, refs] of Object.entries(opts.nodeLinks ?? {})) {
    const k = anchorKey(anchor);
    if (k) links.set(k, refs.map(opts.resolve).filter((x): x is RoadmapLink => x !== null));
  }
  const nodes: RoadmapNode[] = headings.map((h, i) => ({
    id: `h${i + 1}`,
    title: headingTexts[i]!,
    depth: h.depth,
    key: nodeKeys[i]!,
    items: [],
    links: links.get(headingKey(h.depth, headingTexts[i]!)) ?? [],
    children: [],
  }));
  /** the node whose section contains source offset `at` (null before the first heading) */
  const owner = (at: number): RoadmapNode | null => {
    let hit: RoadmapNode | null = null;
    headings.forEach((h, i) => {
      if (pos(h) < at) hit = nodes[i]!;
    });
    return hit;
  };

  const placed: { at: number; item: RoadmapItem }[] = [];
  // list items: keys over the whole lesson (the page numbers duplicates the same way)
  const liTexts = found.li.map(ownText);
  const liKeys = itemKeys(liTexts, 'k');
  found.li.forEach((li, i) => placed.push({ at: pos(li), item: { key: liKeys[i]!, text: liTexts[i]! } }));

  // table rows (graph-only checkboxes): first cell is the item, a 🟢/🟡/⚪ cell is its tag
  const rows: { at: number; item: Omit<RoadmapItem, 'key'> }[] = [];
  for (const t of found.tables) {
    for (const row of t.children.slice(1)) {
      const cells = row.children.map((c) => toString(c).replace(/\s+/g, ' ').trim());
      const tagAt = cells.findIndex((c, k) => k > 0 && TAG.test(c));
      const rest = cells.filter((c, k) => k > 0 && k !== tagAt && c);
      rows.push({ at: pos(row), item: { text: cells[0] ?? '', ...(tagAt > 0 ? { tag: cells[tagAt] } : {}), ...(rest.length ? { detail: rest.join(' · ') } : {}), row: true } });
    }
  }
  const rowKeys = itemKeys(rows.map((r) => r.item.text), 'r');
  rows.forEach((r, i) => placed.push({ at: r.at, item: { key: rowKeys[i]!, ...r.item } }));
  // each node gets the items of its own section, in document order (lists and tables can alternate)
  placed.sort((a, b) => a.at - b.at);
  for (const p of placed) owner(p.at)?.items.push(p.item);

  // nest by heading level
  const roots: RoadmapNode[] = [];
  const stack: RoadmapNode[] = [];
  for (const n of nodes) {
    while (stack.length && stack[stack.length - 1]!.depth >= n.depth) stack.pop();
    if (stack.length) stack[stack.length - 1]!.children.push(n);
    else roots.push(n);
    stack.push(n);
  }
  return { lessonId: opts.lessonId, title, nodes: roots };
}

/** Every item and node key in a roadmap (for tests and progress totals). */
export function allKeys(d: RoadmapData): string[] {
  const out: string[] = [];
  const walk = (n: RoadmapNode) => {
    out.push(n.key, ...n.items.map((i) => i.key));
    n.children.forEach(walk);
  };
  d.nodes.forEach(walk);
  return out;
}
