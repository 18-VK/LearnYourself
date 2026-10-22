/**
 * Stable keys for checklist items, shared by the lesson page's checkboxes (src/scripts/lesson.ts), the
 * roadmap graph (RoadmapGraph.tsx) and the content pipeline (extract.ts), so a tick made in one place shows
 * in the others. A key depends only on the item's letters and digits, so Markdown formatting, emoji and
 * spacing differences between the note and the rendered page can't change it. Repeated items in the
 * same lesson get a suffix (-2, -3 …) in document order.
 */

/** Letters and digits only, lower case: "**DNS Resolution** — already covered…" → "dnsresolutionalreadycovered…". */
export function keyText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** FNV-1a, 32-bit, base 36. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Keys for a lesson's items in document order. `prefix` separates namespaces: `k` list items (the page
 * checklist), `r` table rows, `n` headings.
 */
export function itemKeys(texts: string[], prefix = 'k'): string[] {
  const seen = new Map<string, number>();
  return texts.map((t) => {
    const base = `${prefix}${hash(keyText(t))}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** The text a list item contributes on the page: its own content, without nested lists or its checkbox. */
export function liText(li: Element): string {
  const copy = li.cloneNode(true) as Element;
  copy.querySelectorAll('ul, ol, input').forEach((el) => el.remove());
  return copy.textContent ?? '';
}
