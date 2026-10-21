import type { Element, ElementContent, Root } from 'hast';
import { visit } from 'unist-util-visit';

const LANG_LABELS: Record<string, string> = {
  csharp: 'C#',
  cs: 'C#',
  sql: 'SQL',
  json: 'JSON',
  xml: 'XML',
  html: 'HTML',
  http: 'HTTP',
  powershell: 'PowerShell',
  bash: 'Bash',
  sh: 'Shell',
  cmd: 'Command prompt',
  bat: 'Command prompt',
  yaml: 'YAML',
  nginx: 'nginx',
  xpath: 'XPath',
  text: 'Text',
  txt: 'Text',
  plaintext: 'Text',
};
const el = (tagName: string, properties: Element['properties'], children: ElementContent[]): Element => ({ type: 'element', tagName, properties, children });

/** Wraps every highlighted <pre> in a frame with a language label and a copy button (wired up client-side). */
export function rehypeCodeFrame() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return;
      if (parent.type === 'element' && (parent as Element).properties?.className?.toString().includes('code-frame')) return;
      const lang = String(node.properties?.dataLanguage ?? 'plaintext').toLowerCase();
      const label = LANG_LABELS[lang] ?? lang.toUpperCase();
      node.properties = { ...node.properties, tabIndex: 0 };
      const frame = el('figure', { className: ['code-frame'], dataLang: lang }, [
        el('figcaption', { className: ['code-head'] }, [
          el('span', { className: ['code-lang'] }, [{ type: 'text', value: label }]),
          el('button', { type: 'button', className: ['code-copy'], ariaLabel: `Copy ${label} code` }, [{ type: 'text', value: 'Copy' }]),
        ]),
        node,
      ]);
      parent.children.splice(index, 1, frame);
      return index + 1;
    });
  };
}

/** Tables scroll horizontally inside their own focusable region instead of widening the page. */
export function rehypeTables() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === undefined) return;
      parent.children.splice(index, 1, el('div', { className: ['table-wrap'], tabIndex: 0, role: 'region', ariaLabel: 'Table' }, [node]));
      return index + 1;
    });
  };
}

/** External links open in a new tab, without leaking the opener. */
export function rehypeExternalLinks() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;
      const href = String(node.properties?.href ?? '');
      if (!/^https?:\/\//.test(href)) return;
      node.properties = { ...node.properties, target: '_blank', rel: ['noopener', 'noreferrer'], className: ['external'] };
    });
  };
}
