/**
 * The C# blocks of every generated lesson (src/content/lessons/**.md), in page order.
 *
 * Parsed with the same Markdown parser the site renders with (remark + GFM), so "the 3rd C# block" here is the 3rd
 * C# code frame on the page. Recovered blocks (```csharp recovered, fenced by the pipeline from unfenced note text)
 * count too, because the page shows them as code.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Code } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { codeHash } from '../../src/scripts/runner/hash';
import { OUT_LESSONS } from '../lib/paths';

export const CSHARP_LANGS = new Set(['csharp', 'cs', 'c#']);

export interface CsBlock {
  /** Stable id: `<lesson id>#cs<index>-<hash>`. */
  id: string;
  lesson: string;
  /** 1-based position among the lesson's C# blocks. */
  index: number;
  /** FNV-1a of the code (8 hex digits); the page checks it before attaching a Run button. */
  hash: string;
  code: string;
  recovered: boolean;
}

export { codeHash };

const stripFrontmatter = (md: string) => md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

export function blocksOfLesson(lessonId: string, markdown: string): CsBlock[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(stripFrontmatter(markdown));
  const out: CsBlock[] = [];
  visit(tree, 'code', (node: Code) => {
    const lang = (node.lang ?? '').toLowerCase();
    if (!CSHARP_LANGS.has(lang)) return;
    const index = out.length + 1;
    const hash = codeHash(node.value);
    out.push({ id: `${lessonId}#cs${index}-${hash}`, lesson: lessonId, index, hash, code: node.value, recovered: /\brecovered\b/.test(node.meta ?? '') });
  });
  return out;
}

/** Every lesson's C# blocks, keyed by lesson id (course/module/lesson). */
export function allBlocks(dir = OUT_LESSONS): Map<string, CsBlock[]> {
  const map = new Map<string, CsBlock[]>();
  if (!fs.existsSync(dir)) return map;
  const files = fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
  for (const file of files) {
    const id = path.relative(dir, file).split(path.sep).join('/').replace(/\.md$/, '');
    const blocks = blocksOfLesson(id, fs.readFileSync(file, 'utf8'));
    if (blocks.length) map.set(id, blocks);
  }
  return map;
}
