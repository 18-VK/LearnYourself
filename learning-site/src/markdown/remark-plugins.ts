/**
 * Remark plugins that turn the notes' conventions into components. They only regroup or relabel
 * existing content; no text from the notes is dropped (the coverage check proves it after the build).
 */
import GithubSlugger from 'github-slugger';
import type { Blockquote, Code, Heading, Html, Image, Paragraph, Parent, Root, RootContent } from 'mdast';
import { toString } from 'mdast-util-to-string';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';
import { BLOCK_PARENTS, treatHtml } from './html-policy';
import { normText } from './text';

type Props = Record<string, string | number | boolean | string[]>;
/** A custom mdast node rendered as an HTML element by remark-rehype (via data.hName). */
function element(hName: string, hProperties: Props, children: RootContent[]): RootContent {
  return { type: 'lyElement', data: { hName, hProperties }, children } as unknown as RootContent;
}
const text = (value: string): RootContent => ({ type: 'text', value }) as RootContent;
/** Sets HTML attributes on an mdast node (remark-rehype copies data.hProperties onto the element). */
function setProps(node: { data?: unknown }, props: Props): void {
  const data = (node.data ?? {}) as { hProperties?: Props };
  node.data = { ...data, hProperties: { ...(data.hProperties ?? {}), ...props } };
}
const frontmatter = (file: VFile): Record<string, unknown> => {
  const data = file.data as { astro?: { frontmatter?: Record<string, unknown> } };
  data.astro ??= {};
  data.astro.frontmatter ??= {};
  return data.astro.frontmatter;
};

// ── Visualizer placeholders ───────────────────────────────────────────────────────────────
/** ```viz fences (injected by the content pipeline) → <div class="viz-slot" data-viz=… data-props=…>. */
export function remarkVizSlots() {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (node.type !== 'code' || node.lang !== 'viz' || !parent || index === undefined) return;
      let spec: { name: string; props: Record<string, unknown>; tier: number; wraps: boolean; id: string };
      try {
        spec = JSON.parse(node.value);
      } catch {
        return;
      }
      const children: RootContent[] = [];
      let remove = 1;
      if (spec.wraps) {
        const next = parent.children[index + 1];
        if (next?.type === 'code') {
          // keep the original ASCII as the "Text version" and as the no-JavaScript fallback
          children.push(element('div', { className: ['viz-text'] }, [next]));
          remove = 2;
        }
      } else {
        children.push(element('p', { className: ['viz-skeleton'], dataPagefindIgnore: '' }, [text('Interactive visualizer. It loads when it scrolls into view.')]));
      }
      const slot = element(
        'div',
        {
          className: ['viz-slot'],
          dataViz: spec.name,
          dataProps: JSON.stringify(spec.props ?? {}),
          dataTier: spec.tier,
          dataPlacement: spec.id,
          dataWraps: spec.wraps,
        },
        children,
      );
      parent.children.splice(index, remove, slot as never);
      return index + 1;
    });
  };
}

// ── Raw HTML ──────────────────────────────────────────────────────────────────────────────
/** Keeps harmless tags, shows block HTML/XAML as XML code and inline tags such as a bare <T> as text. */
export function remarkEscapeHtml() {
  return (tree: Root) => {
    visit(tree, 'html', (node: Html, index, parent) => {
      if (!parent || index === undefined) return;
      const treatment = treatHtml(node.value, BLOCK_PARENTS.has(parent.type));
      if (treatment === 'keep') return;
      const replacement =
        treatment === 'code'
          ? element('div', { className: ['code-from-html'] }, [{ type: 'code', lang: 'xml', value: node.value } as Code])
          : text(node.value);
      parent.children.splice(index, 1, replacement as never);
    });
  };
}

// ── Remote images ─────────────────────────────────────────────────────────────────────────
/** Hotlinked images are not loaded (privacy, bandwidth); they become an "Original image" link. */
export function remarkRemoteImages() {
  return (tree: Root) => {
    visit(tree, 'image', (node: Image, index, parent) => {
      if (!parent || index === undefined || !/^https?:\/\//.test(node.url)) return;
      parent.children.splice(index, 1, {
        type: 'link',
        url: node.url,
        children: [text(`Original image: ${node.alt || 'external image'} ↗`) as never],
      } as never);
    });
  };
}

// ── Links between notes ───────────────────────────────────────────────────────────────────
/** `lesson:<id>/` links (written by the content pipeline for note-to-note links) → URLs under the site base. */
export function remarkLessonLinks(options: { base: string }) {
  const base = options.base.endsWith('/') ? options.base : `${options.base}/`;
  return (tree: Root) => {
    visit(tree, 'link', (node) => {
      if (node.url.startsWith('lesson:')) node.url = base + node.url.slice('lesson:'.length);
    });
  };
}

// ── Callouts ──────────────────────────────────────────────────────────────────────────────
const CALLOUTS: [RegExp, string, string][] = [
  [/^👉/u, 'key', 'Key point'],
  [/^💡/u, 'tip', 'Tip'],
  [/^⚠/u, 'warning', 'Warning'],
  [/^🔥/u, 'important', 'Important'],
];
function calloutKind(p: Paragraph | Blockquote): [string, string] | null {
  const t = toString(p).trimStart();
  for (const [re, kind, label] of CALLOUTS) if (re.test(t)) return [kind, label];
  if (/VERY IMPORTANT/.test(t)) return ['important', 'Important'];
  return null;
}
/** Paragraphs or quotes starting with 👉 💡 ⚠️ 🔥 (or containing "VERY IMPORTANT") become callouts. */
export function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined || !(parent.type === 'root' || parent.type === 'blockquote')) return;
      if (node.type === 'heading' && /VERY IMPORTANT/.test(toString(node))) {
        setProps(node, { className: ['heading-important'] });
        return;
      }
      if (node.type !== 'paragraph' && node.type !== 'blockquote') return;
      const first = node.type === 'blockquote' ? node.children[0] : node;
      if (!first || first.type !== 'paragraph') return;
      const kind = calloutKind(first);
      if (!kind) return;
      const body = node.type === 'blockquote' ? node.children : [node];
      const box = element('div', { className: ['callout', `callout-${kind[0]}`], role: 'note' }, [
        element('span', { className: ['callout-label'], dataPagefindIgnore: '' }, [text(kind[1])]),
        ...body,
      ]);
      parent.children.splice(index, 1, box as never);
      return index + 1;
    });
  };
}

// ── ❌ / ✅ comparisons ───────────────────────────────────────────────────────────────────
const markOf = (t: string): 'bad' | 'good' | null => (t.includes('❌') ? 'bad' : t.includes('✅') ? 'good' : null);
const startsWithMark = (n: RootContent | undefined): 'bad' | 'good' | null => {
  if (!n || n.type !== 'paragraph') return null;
  const t = toString(n).trim();
  if (t.length > 160) return null;
  return t.startsWith('❌') ? 'bad' : t.startsWith('✅') ? 'good' : null;
};
const isBoundary = (n: RootContent | undefined) => !n || n.type === 'heading' || n.type === 'thematicBreak' || startsWithMark(n) !== null;
const side = (kind: 'bad' | 'good', nodes: RootContent[]) => element('div', { className: ['compare-side', `compare-${kind}`] }, nodes);

/**
 * Pairs adjacent ❌/✅ material into side-by-side "Bad vs Good" cards (stacked on narrow screens):
 * - two sibling sections whose headings carry ❌ and ✅, when each is short and has no sub-headings;
 * - a ❌ label paragraph and a ✅ label paragraph, each followed by up to four blocks.
 * Unpaired ❌/✅ label paragraphs are just tagged so they can be styled.
 */
export function remarkCompare() {
  return (tree: Root) => {
    const kids = tree.children;
    // sections
    for (let i = 0; i < kids.length; i++) {
      const h = kids[i];
      if (h?.type !== 'heading') continue;
      const a = markOf(toString(h));
      if (!a) continue;
      const endOf = (start: number, depth: number) => {
        let e = start + 1;
        while (e < kids.length && !(kids[e]!.type === 'heading' && (kids[e] as Heading).depth <= depth)) e++;
        return e;
      };
      const e1 = endOf(i, h.depth);
      const h2 = kids[e1];
      if (h2?.type !== 'heading' || h2.depth !== h.depth) continue;
      const b = markOf(toString(h2));
      if (!b || b === a) continue;
      const e2 = endOf(e1, h2.depth);
      const sec1 = kids.slice(i, e1);
      const sec2 = kids.slice(e1, e2);
      const short = (s: RootContent[]) => s.length <= 16 && !s.slice(1).some((n) => n.type === 'heading');
      if (!short(sec1) || !short(sec2)) continue;
      kids.splice(i, e2 - i, element('div', { className: ['compare'] }, [side(a, sec1), side(b, sec2)]) as never);
    }
    // label paragraphs
    for (let i = 0; i < kids.length; i++) {
      const a = startsWithMark(kids[i]);
      if (!a) continue;
      let j = i + 1;
      while (j < kids.length && j - i <= 4 && !isBoundary(kids[j])) j++;
      const b = startsWithMark(kids[j]);
      if (b && b !== a) {
        let k = j + 1;
        while (k < kids.length && k - j <= 4 && !isBoundary(kids[k])) k++;
        kids.splice(i, k - i, element('div', { className: ['compare'] }, [side(a, kids.slice(i, j)), side(b, kids.slice(j, k))]) as never);
        continue;
      }
      setProps(kids[i] as Paragraph, { className: [`mark-${a}`] });
    }
  };
}

// ── Interview sections ────────────────────────────────────────────────────────────────────
/** Sections under headings listed in the lesson's `interviewHeadings` become interview callouts. */
export function remarkInterviewSections() {
  return (tree: Root, file: VFile) => {
    const wanted = new Set((frontmatter(file).interviewHeadings as string[] | undefined) ?? []);
    if (!wanted.size) return;
    // Explicit walk: wrapped sections are never revisited, so a section can't be wrapped twice.
    const walk = (parent: Parent) => {
      const kids = parent.children as RootContent[];
      for (let i = 0; i < kids.length; i++) {
        const h = kids[i]!;
        if (h.type === 'heading' && wanted.has(normText(toString(h)))) {
          let e = i + 1;
          while (e < kids.length && !(kids[e]!.type === 'heading' && (kids[e] as Heading).depth <= h.depth)) e++;
          kids.splice(i, e - i, element('section', { className: ['interview-callout'], dataInterview: normText(toString(h)) }, kids.slice(i, e)) as never);
          continue;
        }
        if ((h as { type: string }).type === 'lyElement' && 'children' in h) walk(h as Parent);
      }
    };
    walk(tree);
  };
}

// ── Heading ids + table of contents ───────────────────────────────────────────────────────
/** Stable heading ids (GitHub style) and a table of contents passed to the page as frontmatter.toc. */
export function remarkHeadingIds() {
  return (tree: Root, file: VFile) => {
    const slugger = new GithubSlugger();
    const toc: { depth: number; id: string; text: string }[] = [];
    visit(tree, 'heading', (h: Heading) => {
      const t = toString(h).trim();
      const id = slugger.slug(t) || 'section';
      setProps(h, { id });
      if (h.depth <= 3) toc.push({ depth: h.depth, id, text: t });
    });
    frontmatter(file).toc = toc;
  };
}
