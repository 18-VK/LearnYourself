/**
 * Build-time Markdown for data files (quiz explanations, cheat sheet snippets, interview answers).
 *
 * - renderBlock(): full Markdown through the same processor Astro uses for lessons
 *   (@astrojs/markdown-remark), with the site's own plugins where they apply and Shiki dual themes, so code
 *   looks exactly like lesson code and gets the same copy button.
 * - renderCode(): one highlighted code frame.
 * - renderInline(): a light inline renderer for one-liners (prompts, options, table cells). It escapes all
 *   HTML first, so a bare <T> in a note shows as text, then handles `code`, **bold**, *em* and [links](https://…).
 *
 * Only used in page frontmatter (Node, at build time). Nothing here ships to the browser.
 */
import path from 'node:path';
import { createMarkdownProcessor, type MarkdownRenderer } from '@astrojs/markdown-remark';
import { transformerMetaHighlight } from '@shikijs/transformers';
import GithubSlugger from 'github-slugger';
import type { Element, ElementContent, Root, RootContent } from 'hast';
import remarkBreaks from 'remark-breaks';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import { site } from './site';
import { rehypeCodeFrame, rehypeExternalLinks, rehypeTables } from '../markdown/rehype-plugins';
import { remarkCallouts, remarkCompare, remarkEscapeHtml, remarkRemoteImages } from '../markdown/remark-plugins';

/** Keep in step with markdown.shikiConfig in astro.config.ts. */
const SHIKI = {
  themes: { light: 'github-light', dark: 'github-dark' } as const,
  defaultColor: false as const,
  langAlias: { cmd: 'bat', xpath: 'xml', cs: 'csharp', 'c#': 'csharp', none: 'plaintext' },
  transformers: [transformerMetaHighlight()],
};

interface RenderOptions {
  /** Prefix for heading ids, so several answers on one page never share an id. */
  idPrefix: string;
  /** The note an answer was copied from: its relative links are resolved against it (to GitHub). */
  baseFile?: string;
}

const textNode = (value: string): ElementContent => ({ type: 'text', value });
const plainText = (node: Element | RootContent): string =>
  node.type === 'text' ? node.value : 'children' in node ? (node.children as RootContent[]).map(plainText).join('') : '';

function githubBlob(file: string): string {
  return `${site.repo}/blob/main/${file.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Answers are copied from notes and shown away from their note, so:
 * - heading ids get a per-answer prefix (unique on the page);
 * - links to other notes point at the note on GitHub; links to the note's own #headings become plain text;
 * - local images (not published with the answer) become a short text label.
 */
function rehypeAnswerFixups() {
  return (tree: Root, file: VFile) => {
    const fm = (file.data.astro?.frontmatter ?? {}) as Partial<RenderOptions>;
    const prefix = fm.idPrefix ?? 'md';
    const slugger = new GithubSlugger();
    visit(tree, 'element', (node: Element, index, parent) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        node.properties = { ...node.properties, id: `${prefix}-${slugger.slug(plainText(node)) || 'section'}` };
        return;
      }
      if (!parent || index === undefined) return;
      if (node.tagName === 'a') {
        const href = String(node.properties?.href ?? '');
        if (/^(https?:|mailto:)/i.test(href)) return;
        const local = !href.startsWith('#') && !href.startsWith('/') && fm.baseFile;
        if (local) {
          const [p] = href.split('#');
          try {
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(fm.baseFile!), decodeURIComponent(p ?? '')));
            if (!target.startsWith('..')) {
              node.properties = { ...node.properties, href: githubBlob(target) };
              return;
            }
          } catch {
            /* fall through: keep the text */
          }
        }
        parent.children.splice(index, 1, ...(node.children as ElementContent[]));
        return index;
      }
      if (node.tagName === 'img') {
        const src = String(node.properties?.src ?? '');
        if (/^https?:/i.test(src)) return;
        parent.children.splice(index, 1, textNode(`[Image: ${String(node.properties?.alt ?? 'not shown here')}]`));
        return index;
      }
    });
  };
}

let renderer: Promise<MarkdownRenderer> | null = null;
function getRenderer(): Promise<MarkdownRenderer> {
  renderer ??= createMarkdownProcessor({
    syntaxHighlight: 'shiki',
    shikiConfig: SHIKI,
    gfm: true,
    smartypants: false,
    remarkPlugins: [remarkBreaks, remarkEscapeHtml, remarkRemoteImages, remarkCallouts, remarkCompare],
    rehypePlugins: [rehypeAnswerFixups, rehypeCodeFrame, rehypeTables, rehypeExternalLinks],
  });
  return renderer;
}

const cache = new Map<string, string>();
/** Full Markdown → HTML (cached: several pages render the same answer). */
export async function renderBlock(md: string, opts: RenderOptions): Promise<string> {
  const key = `${opts.idPrefix}\u0000${opts.baseFile ?? ''}\u0000${md}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const r = await getRenderer();
  const { code } = await r.render(md, { frontmatter: { ...opts } });
  cache.set(key, code);
  return code;
}

/** Source code → a highlighted code frame with a language label and a copy button. */
export async function renderCode(source: string, lang = 'text', idPrefix = 'code'): Promise<string> {
  const longest = Math.max(2, ...[...source.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  const safeLang = /^[\w#+-]+$/.test(lang) ? lang : 'text';
  return renderBlock(`${fence}${safeLang}\n${source.replace(/\n+$/, '')}\n${fence}`, { idPrefix });
}

// ── inline ────────────────────────────────────────────────────────────────────────────────────
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]!);

/** Inline Markdown → safe HTML. Everything is escaped; only code spans, bold, italics and http(s) links are rendered. */
export function renderInline(md: string): string {
  const slots: string[] = [];
  const hold = (html: string) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = md
    .replace(/\\([\\`*_[\]()#+\-.!|<>~])/g, (_, c: string) => hold(escapeHtml(c)))
    .replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_, _ticks: string, body: string) => hold(`<code>${escapeHtml(body.replace(/^ (.*) $/s, '$1'))}</code>`));
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, text: string, href: string) => hold(`<a href="${href}" class="external" target="_blank" rel="noopener noreferrer">${text}</a>`));
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>').replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*(?=[^\s*])([^*]*?[^\s*])\*(?![*\w])/g, '$1<em>$2</em>').replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/\s*\n\s*/g, ' ');
  // slots can nest (a link whose text holds code), so restore until none are left
  for (let i = 0; i < 3 && s.includes('\u0000'); i++) s = s.replace(/\u0000(\d+)\u0000/g, (_, n: string) => slots[Number(n)] ?? '');
  return s;
}

/** Inline Markdown → plain text (for filters, search and aria-labels). */
export function inlineText(md: string): string {
  return md
    .replace(/\\(.)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|\W)[*_](\S.*?\S|\S)[*_](?=\W|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Block Markdown → plain text, roughly (for client-side full-text search). */
export function markdownText(md: string): string {
  return md
    .replace(/^```.*$/gm, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+|^\s*\d+[.)]\s+|^\s*>\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
