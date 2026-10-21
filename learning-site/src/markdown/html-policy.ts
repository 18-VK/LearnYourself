/**
 * What happens to raw HTML found in a note. Shared by the remark plugin (rendering) and the content
 * pipeline (coverage counts) so both always agree.
 *
 * - keep: harmless formatting tags with no attributes (<br>, <sub>, <kbd>, <details>…) and comments.
 * - code: block-level HTML/XAML that would otherwise vanish from the page; shown as an XML code block.
 * - text: inline tags such as a bare <T> in a sentence; shown literally.
 */
export type HtmlTreatment = 'keep' | 'code' | 'text';

const ALLOWED_TAG = /^<\/?(br|sub|sup|kbd|b|i|u|em|strong|mark|small|s|del|ins|details|summary|hr|p)\s*\/?>$/i;
const COMMENT = /^<!--[\s\S]*-->$/;

export function isAllowedHtml(value: string): boolean {
  const v = value.trim();
  if (COMMENT.test(v)) return true;
  const tags = v.match(/<[^>]*>/g) ?? [];
  return tags.length > 0 && tags.every((t) => ALLOWED_TAG.test(t) || COMMENT.test(t));
}

export function treatHtml(value: string, isBlock: boolean): HtmlTreatment {
  if (isAllowedHtml(value)) return 'keep';
  return isBlock ? 'code' : 'text';
}

/** Parent node types whose html children are block-level. */
export const BLOCK_PARENTS = new Set(['root', 'blockquote', 'listItem']);

/** Emoji markers counted to prove callouts and ❌/✅ comparisons survive rendering. */
export const MARKERS = ['❌', '✅', '👉', '💡', '⚠', '🔥'] as const;
export function countMarkers(text: string): Record<(typeof MARKERS)[number], number> {
  const out = {} as Record<(typeof MARKERS)[number], number>;
  for (const m of MARKERS) out[m] = text.split(m).length - 1;
  return out;
}
