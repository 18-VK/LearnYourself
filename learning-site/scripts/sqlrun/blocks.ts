/**
 * The SQL blocks of every generated lesson (src/content/lessons/**.md), in page order: "SQL block 3" is the third
 * ```sql code frame on the page, the numbering the data files in src/data/sqlrun/ and the page script use.
 * Same Markdown parser as the site (and as scripts/runner/blocks.ts for C#).
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

export const SQL_LANGS = new Set(['sql', 'tsql', 'mssql']);

export interface SqlBlock {
  /** `<lesson id>#sql<index>-<hash>` */
  id: string;
  lesson: string;
  /** 1-based position among the lesson's SQL blocks. */
  index: number;
  hash: string;
  code: string;
}

const stripFrontmatter = (md: string) => md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

export function sqlBlocksOfLesson(lessonId: string, markdown: string): SqlBlock[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(stripFrontmatter(markdown));
  const out: SqlBlock[] = [];
  visit(tree, 'code', (node: Code) => {
    if (!SQL_LANGS.has((node.lang ?? '').toLowerCase())) return;
    const index = out.length + 1;
    const hash = codeHash(node.value);
    out.push({ id: `${lessonId}#sql${index}-${hash}`, lesson: lessonId, index, hash, code: node.value });
  });
  return out;
}

/** Every lesson's SQL blocks, keyed by lesson id (course/module/lesson). */
export function allSqlBlocks(dir = OUT_LESSONS): Map<string, SqlBlock[]> {
  const map = new Map<string, SqlBlock[]>();
  if (!fs.existsSync(dir)) return map;
  const files = fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
  for (const file of files) {
    const id = path.relative(dir, file).split(path.sep).join('/').replace(/\.md$/, '');
    const blocks = sqlBlocksOfLesson(id, fs.readFileSync(file, 'utf8'));
    if (blocks.length) map.set(id, blocks);
  }
  return map;
}
