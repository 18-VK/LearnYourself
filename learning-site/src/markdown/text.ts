const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export const decodeEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);

/**
 * Normalises heading text for matching: entities decoded, accents/emoji/punctuation dropped,
 * lowercase. "## 🧪 2️⃣ Examples" and "## 2 examples" give the same key.
 */
export function normText(text: string): string {
  return decodeEntities(text)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
