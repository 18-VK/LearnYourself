import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { BLOCK_PARENTS, treatHtml } from '../../src/markdown/html-policy';

const parser = unified().use(remarkParse).use(remarkGfm);

export interface MdCounts {
  headings: number;
  /** fenced or indented code blocks (excluding injected `viz` placeholders) */
  code: number;
  tables: number;
  /** block-level raw HTML that renders as an XML code block */
  htmlAsCode: number;
  words: number;
  codeWords: number;
}

export function parseMarkdown(md: string): Root {
  return parser.runSync(parser.parse(md)) as Root;
}

const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;

/**
 * Counts Markdown structure. `absorbed` holds 0-based lines of `md` that the pipeline wraps into
 * recovered code blocks; indented code blocks or HTML starting on those lines are part of a recovered
 * block in the output, so they are not counted separately here.
 */
export function countMarkdown(md: string, absorbed: ReadonlySet<number> = new Set()): MdCounts {
  const tree = parseMarkdown(md);
  const lines = md.split('\n');
  const c: MdCounts = { headings: 0, code: 0, tables: 0, htmlAsCode: 0, words: 0, codeWords: 0 };
  visit(tree, (node, _index, parent) => {
    const startLine = (node.position?.start.line ?? 1) - 1;
    switch (node.type) {
      case 'heading':
        c.headings++;
        break;
      case 'code': {
        if (node.lang === 'viz') return;
        const fenced = /^\s*(`{3,}|~{3,})/.test(lines[startLine] ?? '');
        if (!fenced && absorbed.has(startLine)) return;
        c.code++;
        c.codeWords += wordCount(node.value);
        break;
      }
      case 'table':
        c.tables++;
        break;
      case 'html':
        if (absorbed.has(startLine)) return;
        if (treatHtml(node.value, BLOCK_PARENTS.has(parent?.type ?? 'root')) === 'code') {
          c.htmlAsCode++;
          c.codeWords += wordCount(node.value);
        }
        break;
      case 'text':
      case 'inlineCode':
        c.words += wordCount(node.value);
        break;
    }
  });
  return c;
}

/** Reading time: ~220 words/min for prose, half speed for code; at least one minute. */
export function readingMinutes(c: Pick<MdCounts, 'words' | 'codeWords'>): number {
  return Math.max(1, Math.round(c.words / 220 + c.codeWords / 110));
}
