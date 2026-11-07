import fs from 'node:fs';
import path from 'node:path';
import { abs, REPO_ROOT, SKIP_DIRS, SKIP_FILES } from './paths';

export interface NoteHeading {
  /** 0-based line index */
  line: number;
  depth: number;
  text: string;
  norm: string;
}

export interface Fence {
  /** 0-based line of the opening fence */
  start: number;
  /** 0-based line of the closing fence (or last line if unclosed) */
  end: number;
  lang: string;
}

export interface Note {
  rel: string;
  isTxt: boolean;
  lines: string[];
  /** true for lines inside (or delimiting) a fenced code block */
  inFence: boolean[];
  headings: NoteHeading[];
  fences: Fence[];
}

/** Every .md/.txt note in the repo outside the skipped folders, as repo-relative POSIX paths. */
export function inventory(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name));
      } else if (/\.(md|txt)$/i.test(e.name)) {
        const r = path.relative(REPO_ROOT, path.join(dir, e.name)).split(path.sep).join('/');
        if (!SKIP_FILES.has(r)) out.push(r);
      }
    }
  };
  walk(REPO_ROOT);
  return out.sort();
}

/**
 * True only if every path segment exists with exactly this spelling. Windows file systems are
 * case-insensitive, the Linux CI runner is not, so this check makes a case typo fail locally too.
 */
export function exactCaseExists(relPath: string): boolean {
  let cur = REPO_ROOT;
  for (const part of relPath.split('/')) {
    let names: string[];
    try {
      names = fs.readdirSync(cur);
    } catch {
      return false;
    }
    if (!names.includes(part)) return false;
    cur = path.join(cur, part);
  }
  return true;
}

import { normText } from '../../src/markdown/text';
export { normText };

const ATX = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
export function parseHeadingLine(line: string): { depth: number; text: string } | null {
  const m = ATX.exec(line);
  if (!m || !m[2]) return null;
  return { depth: m[1]!.length, text: m[2] };
}
export function normHeading(anchor: string): string {
  const h = parseHeadingLine(anchor);
  if (!h) throw new Error(`Not a heading anchor (it must start with #): ${anchor}`);
  return `${h.depth} ${normText(h.text)}`;
}

const cache = new Map<string, Note>();
export function clearNoteCache(): void {
  cache.clear();
}

export function loadNote(relPath: string): Note {
  const hit = cache.get(relPath);
  if (hit) return hit;
  const note = parseNote(relPath, fs.readFileSync(abs(relPath), 'utf8'));
  cache.set(relPath, note);
  return note;
}

/** Splits a note's text into lines, headings and code fences. */
export function parseNote(relPath: string, raw: string): Note {
  const text = raw.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const inFence: boolean[] = new Array(lines.length).fill(false);
  const headings: NoteHeading[] = [];
  const fences: Fence[] = [];
  let open: { marker: string; start: number; lang: string } | null = null;
  lines.forEach((line, i) => {
    const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (open) {
      inFence[i] = true;
      if (m && m[1]![0] === open.marker[0] && m[1]!.length >= open.marker.length && !m[2]!.trim()) {
        fences.push({ start: open.start, end: i, lang: open.lang });
        open = null;
      }
      return;
    }
    if (m && !(m[1]![0] === '`' && m[2]!.includes('`'))) {
      open = { marker: m[1]!, start: i, lang: (m[2]!.trim().split(/\s+/)[0] ?? '').toLowerCase() };
      inFence[i] = true;
      return;
    }
    const h = parseHeadingLine(line);
    if (h) headings.push({ line: i, depth: h.depth, text: h.text, norm: `${h.depth} ${normText(h.text)}` });
  });
  if (open) fences.push({ start: (open as { start: number }).start, end: lines.length - 1, lang: (open as { lang: string }).lang });
  return { rel: relPath, isTxt: /\.txt$/i.test(relPath), lines, inFence, headings, fences };
}

/** A heading's words, without bare numbers: renumbering a section doesn't rename it. */
const anchorWords = (norm: string): string[] => {
  const words = norm.split(' ').filter(Boolean);
  const named = words.filter((w) => !/^\d+$/.test(w));
  return named.length ? named : words;
};

/**
 * Finds a heading the way findHeading does, but also survives a renamed one: when no heading has this exact
 * text, the closest heading stands in if it clearly is the same section (most words shared, and no other
 * heading as close), and a numbered section keeps its number even when it was reworded completely.
 * Returns null when nothing qualifies or the anchor is not a heading at all.
 */
export function resolveHeading(note: Note, anchor: string, occurrence = 1): { heading: NoteHeading; fuzzy: boolean } | null {
  let key: string;
  try {
    key = normHeading(anchor);
  } catch {
    return null;
  }
  const exact = note.headings.filter((h) => h.norm === key);
  if (exact.length) return exact[occurrence - 1] ? { heading: exact[occurrence - 1]!, fuzzy: false } : null;
  const textOf = (h: NoteHeading) => h.norm.slice(h.norm.indexOf(' ') + 1);
  const want = key.slice(key.indexOf(' ') + 1);
  const sameLevel = note.headings.filter((h) => key.startsWith(`${h.depth} `));
  for (const pool of [sameLevel, note.headings]) {
    const at = closestText(want, pool.map(textOf));
    if (at >= 0) return { heading: pool[at]!, fuzzy: true };
  }
  const [number, ...rest] = want.split(' ');
  if (rest.length && /^\d+$/.test(number!)) {
    const same = sameLevel.filter((h) => textOf(h).split(' ')[0] === number);
    if (same.length === 1) return { heading: same[0]!, fuzzy: true };
  }
  return null;
}

/**
 * The candidate (normText form) that is clearly the same phrase as `want`, or -1. Scores how much of the two phrases
 * overlaps and how much of the shorter one the other contains, so "git add" still finds "the git add command"
 * but "merge sort" doesn't find "heap sort". A tie means it isn't clear, so nothing is chosen.
 */
export function closestText(want: string, candidates: string[]): number {
  const mine = new Set(anchorWords(want));
  const scored = candidates
    .map((text, i) => {
      const theirs = new Set(anchorWords(text));
      const shared = [...mine].filter((w) => theirs.has(w)).length;
      const overlap = shared / (mine.size + theirs.size - shared || 1);
      const contained = shared / (Math.min(mine.size, theirs.size) || 1);
      return { i, score: (overlap + contained) / 2 };
    })
    .filter((x) => x.score >= 0.6)
    .sort((a, b) => b.score - a.score);
  if (!scored[0] || scored[1]?.score === scored[0].score) return -1;
  return scored[0].i;
}

/** Cleans a heading into a short phrase for titles and "What this lesson covers". */
export const cleanHeading = (t: string): string =>
  t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[*`_]/g, '')
    .replace(/\p{Extended_Pictographic}|️|⃣/gu, '')
    .replace(/^\s*(\d+[.)]|[A-Z]\)|[➤▶•-])\s*/u, '')
    .replace(/\s*[:–—-]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Finds a heading by its anchor text; throws with the closest candidates when it is missing. */
export function findHeading(note: Note, anchor: string, occurrence = 1): NoteHeading {
  const key = normHeading(anchor);
  const hits = note.headings.filter((h) => h.norm === key);
  const hit = hits[occurrence - 1];
  if (hit) return hit;
  const words = new Set(key.split(' ').slice(1));
  const near = note.headings
    .map((h) => ({ h, score: h.norm.split(' ').slice(1).filter((w) => words.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => `    ${'#'.repeat(x.h.depth)} ${x.h.text}  (line ${x.h.line + 1})`);
  throw new Error(
    `Heading not found in ${note.rel}: "${anchor}"` +
      (hits.length ? ` (only ${hits.length} match${hits.length === 1 ? '' : 'es'}, wanted occurrence ${occurrence})` : '') +
      (near.length ? `\n  Closest headings:\n${near.join('\n')}` : ''),
  );
}

/** Finds a plain line (outside code fences) whose trimmed text equals `text`; it must be unique. */
export function findLine(note: Note, text: string): number {
  const want = text.trim();
  const hits = note.lines.map((l, i) => (!note.inFence[i] && l.trim() === want ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) throw new Error(`Line anchor "${text}" matched ${hits.length} lines in ${note.rel} (it must match exactly one).`);
  return hits[0]!;
}

/** End (exclusive) of the section that starts at heading `h`: the next heading of the same or a higher level. */
export function sectionEnd(note: Note, h: NoteHeading, limit = note.lines.length): number {
  const next = note.headings.find((x) => x.line > h.line && x.depth <= h.depth);
  return Math.min(next ? next.line : note.lines.length, limit);
}

/** Text normalised for the formatting-insensitive duplicate check. */
export function contentLines(note: Note): Set<string> {
  const out = new Set<string>();
  for (const raw of note.lines) {
    let l = raw.replace(/`{3,}[a-z]*/gi, '').replace(/\*\*/g, '').replace(/`/g, '');
    l = l.replace(/^\s*#+\s*/, '').replace(/^\s*(>\s*)+/, '').replace(/^\s*[-*]\s+/, '').replace(/^\s*cmd\s*:\s*/i, '');
    // compare letters and digits only: spacing, quotes, backticks and punctuation are formatting
    l = l.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (l) out.add(l);
  }
  return out;
}
