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
  const text = fs.readFileSync(abs(relPath), 'utf8').replace(/^﻿/, '');
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
  const note: Note = { rel: relPath, isTxt: /\.txt$/i.test(relPath), lines, inFence, headings, fences };
  cache.set(relPath, note);
  return note;
}

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
