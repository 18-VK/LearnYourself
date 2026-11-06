/**
 * Keeps the curriculum in step with the notes, so that adding to the notes never needs a manifest or code change.
 * It runs after the manifests are parsed and before anything else reads them, and only rewrites what they say:
 * the rest of the pipeline (rendering, counts, quizzes, the runner) sees an ordinary, complete manifest.
 *
 *   1. Renamed or moved note     → its manifest entries follow it, so lesson URLs and quizzes survive.
 *   2. Renamed or removed heading → the closest heading stands in; if none does, the neighbouring lesson absorbs
 *                                   the text. Every line of a note still ends up in exactly one place.
 *   3. New note                  → extends the section it belongs to, or starts a new one:
 *        - in a folder a module claims with `noteFolder` (a planned module wakes up) → that module
 *        - beside notes already in lessons → the section of its nearest numbered neighbour, else the best match by title
 *        - in a new sub-folder → a new section in the course that owns the parent folder
 *        - in a new top-level folder → a new course
 *      A long note is split into lessons at its own headings.
 *
 * A hand-written manifest entry always wins: this only touches what the manifests don't cover or no longer resolve.
 * The notes themselves are never edited, and nothing is invented: titles come from the notes' headings and file names.
 * Copies, near-empty files and anything that looks personal stay off the public site; see `autoExclude` in _site.yaml.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { cleanHeading, contentLines, exactCaseExists, findLine, loadNote, normHeading, resolveHeading, type Note } from './notes';
import { abs } from './paths';
import { holdBackFindings } from './personal-rules';
import type { Course, ManifestLesson, ManifestModule, SiteManifest, Slice } from './schema';

/** Longest automatic lesson. Hand-made lessons run to a median of about 1,050 words and a maximum of 3,300. */
export const MAX_LESSON_WORDS = 3000;
/** When a long note is split, sections are packed into lessons of about this size. */
const PACK_LESSON_WORDS = 2000;
/** A last part smaller than this joins the lesson before it. */
const MIN_PART_WORDS = 300;
/** Below this a note is a placeholder, not a lesson. */
const MIN_NOTE_WORDS = 12;

/** Site routes a new course must not take over. */
const RESERVED_COURSE_IDS = new Set(['cheat-sheets', 'documents', 'interview-prep', 'progress', 'review', 'review-data', 'runner', 'generated', 'pagefind', '404', 'index']);
/** File names that say nothing about the topic, so the folder has to help. */
const GENERIC_STEMS = new Set(['note', 'notes', 'readme', 'index', 'intro', 'introduction', 'overview', 'summary', 'question', 'questions', 'tutorial']);
/** Words too common in these notes to say which section a note belongs to. */
const STOP_WORDS = new Set(
  'a an and or of in on for to with vs from how what why your using use the is are it its this that notes note study guide intro introduction overview basics complete api apis net dotnet core asp aspnet c csharp part beginner advanced'.split(' '),
);

export interface PlacedNote {
  file: string;
  /** Full lesson ids, in reading order. */
  lessons: string[];
  /** Where it went, for the report: "course › section". */
  where: string;
  /** What this note added to the site's structure. */
  created: 'course' | 'section' | null;
  why: string;
}
export interface ReconcileResult {
  placed: PlacedNote[];
  /** Old note path → new note path. */
  renames: Map<string, string>;
  /** The current path of anything that was named by its old path: a renamed note, or any file in a folder that moved. */
  followPath: (rel: string) => string;
}
/** How this module reaches the notes, so tests can use notes that are not on disk. */
export interface NoteSource {
  exists(rel: string): boolean;
  load(rel: string): Note;
  /** True when a .NET project folder contains this file: a .txt there is project data, not a note. */
  inProject(rel: string): boolean;
}

// ── small helpers ─────────────────────────────────────────────────────────────────────────

const dirOf = (rel: string) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
const baseOf = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);
const stemOf = (rel: string) => baseOf(rel).replace(/\.(md|txt)$/i, '');

/** "12.1.ASP_Cookies" → [12, 1]; "01-1_roadmap" → [1, 1]; "notes" → null. */
export function numberOf(name: string): number[] | null {
  const m = /^\d+(?:[.-]\d+)*/.exec(name);
  return m ? m[0].split(/[.-]/).map(Number) : null;
}
export function compareNumbers(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return 0;
}
const withoutNumber = (name: string) => name.replace(/^\d+(?:[.-]\d+)*[.\s_-]*/, '');

/** "01_Http_TCP-IP_andMore" → "Http TCP-IP and More". */
export function humanize(name: string): string {
  const words = withoutNumber(name)
    .replace(/[_.]+/g, ' ')
    .replace(/(^|\s)-+|-+(\s|$)/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : name;
}
export function slugify(text: string): string {
  return text
    .replace(/C#/gi, 'csharp')
    .replace(/\.NET/gi, 'dotnet')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '');
}
const shortHash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 4);

/** Case-insensitive path glob: `**` crosses folders, `*` doesn't. */
export function matchesGlob(pattern: string, rel: string): boolean {
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*');
  return new RegExp(`^${re}$`, 'i').test(rel);
}

const wordCount = (note: Note, start: number, end: number) => {
  let n = 0;
  for (let i = start; i < end; i++) n += note.lines[i]!.match(/\S+/g)?.length ?? 0;
  return n;
};
const hasText = (note: Note, start: number, end: number) => note.lines.slice(start, end).some((l) => l.trim());
const majority = <T>(items: T[]): T => {
  const counts = new Map<T, number>();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]![0];
};
const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9#]+/)
      .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w))
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w)),
  );

/** The note's own name for itself: its opening heading, else its file name. */
export function noteTitle(note: Note): string {
  const first = note.headings[0];
  const cleaned = first && first.line < 10 ? cleanHeading(first.text).replace(/\s*[:–—-]\s*(study\s+)?notes$/i, '') : '';
  return cleaned && cleaned.length <= 90 ? cleaned : humanize(stemOf(note.rel));
}

/**
 * Splits a long note into parts at its headings, using the shallowest level that gets the parts under the limit
 * and going deeper only inside an oversized section. Parts tile the note, and a split never lands inside a code
 * block because fenced lines are never headings.
 */
export function splitNote(note: Note, limit = MAX_LESSON_WORDS): { start: number; end: number }[] {
  const total = note.lines.length;
  if (wordCount(note, 0, total) <= limit) return [{ start: 0, end: total }];
  const pieces: { start: number; end: number }[] = [];
  const cut = (start: number, end: number, minDepth: number) => {
    const inside = note.headings.filter((h) => h.line > start && h.line < end && h.depth >= minDepth);
    if (wordCount(note, start, end) <= PACK_LESSON_WORDS || !inside.length) {
      pieces.push({ start, end });
      return;
    }
    const depth = Math.min(...inside.map((h) => h.depth));
    const marks = [start, ...inside.filter((h) => h.depth === depth).map((h) => h.line), end];
    for (let i = 0; i + 1 < marks.length; i++) cut(marks[i]!, marks[i + 1]!, depth + 1);
  };
  cut(0, total, 1);
  const parts: { start: number; end: number }[] = [];
  for (const p of pieces) {
    const last = parts[parts.length - 1];
    if (last && wordCount(note, last.start, p.end) <= PACK_LESSON_WORDS) last.end = p.end;
    else parts.push({ ...p });
  }
  const tail = parts[parts.length - 1]!;
  if (parts.length > 1 && wordCount(note, tail.start, tail.end) < MIN_PART_WORDS) {
    parts.pop();
    parts[parts.length - 1]!.end = tail.end;
  }
  return parts;
}

/**
 * A part's name is the heading it opens with. Notes repeat headings ("Interview questions and answers" under every
 * topic), so a heading used more than once is named with the section above it, or the sidebar would list it five times.
 */
export function partTitle(note: Note, start: number): string {
  const at = note.headings.findIndex((h) => h.line >= start);
  const h = note.headings[at];
  if (!h) return '';
  const text = cleanHeading(h.text);
  if (note.headings.filter((x) => x.norm.slice(x.norm.indexOf(' ')) === h.norm.slice(h.norm.indexOf(' '))).length < 2) return text;
  const parent = note.headings.slice(0, at).reverse().find((x) => x.depth < h.depth);
  return parent ? `${cleanHeading(parent.text)}: ${text}` : text;
}

// ── 1 & 2: bring the hand-written entries back in line with the notes ─────────────────────

interface Owned {
  slice: Slice;
  owner: string;
}
function ownedSlices(courses: Course[], site: SiteManifest): Owned[] {
  const out: Owned[] = [];
  for (const c of courses) {
    for (const slice of c.landing?.sources ?? []) out.push({ slice, owner: `${c.id} landing page` });
    for (const m of c.modules) for (const l of m.lessons) for (const slice of l.sources) out.push({ slice, owner: `${c.id}/${m.id}/${l.id}` });
  }
  for (const slice of site.interview) out.push({ slice, owner: 'Interview Prep' });
  return out;
}

/** Points manifest entries at the new path of a note that moved. An old path with no credible new home stays as it is. */
function followRenames(courses: Course[], site: SiteManifest, notes: string[], source: NoteSource, warn: (m: string) => void): Pick<ReconcileResult, 'renames' | 'followPath'> {
  const owned = ownedSlices(courses, site);
  const named = [
    ...owned.map((o) => o.slice.file),
    ...site.duplicates.flatMap((d) => [d.file, d.duplicateOf]),
    ...site.linkOnly.map((l) => l.file),
    ...site.excluded.map((x) => x.file),
    ...site.recoverUnfencedCode.map((r) => r.file),
    ...site.omitLines.map((o) => o.file),
  ];
  const renames = new Map<string, string>();
  const free = new Set(notes.filter((n) => !named.includes(n)));
  const stemKey = (rel: string) => withoutNumber(stemOf(rel)).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const hasHeading = (rel: string, anchor: string) => {
    try {
      const key = normHeading(anchor);
      return source.load(rel).headings.some((h) => h.norm === key);
    } catch {
      return false;
    }
  };
  const unclear: string[] = [];
  for (const old of [...new Set(named)].filter((f) => !source.exists(f))) {
    const anchors = owned.filter((o) => o.slice.file === old).flatMap((o) => [o.slice.from, o.slice.until]).filter((a): a is string => Boolean(a));
    const found = (rel: string) => anchors.filter((a) => hasHeading(rel, a)).length;
    const generic = GENERIC_STEMS.has(stemKey(old));
    let hits = [...free].filter((n) => stemKey(n) === stemKey(old) && found(n) * 2 >= anchors.length && (!generic || baseOf(dirOf(n)) === baseOf(dirOf(old))));
    if (hits.length !== 1 && anchors.length >= 2) hits = [...free].filter((n) => found(n) === anchors.length);
    if (hits.length === 1) {
      renames.set(old, hits[0]!);
      free.delete(hits[0]!);
    } else {
      unclear.push(old);
    }
  }
  // notes that clearly moved to another folder say where the rest of that folder went
  const folderMoves = new Map<string, string>();
  for (const [from, to] of renames) if (baseOf(from) === baseOf(to) && dirOf(from) && dirOf(to) && dirOf(from) !== dirOf(to)) folderMoves.set(dirOf(from), dirOf(to));
  const moved = (rel: string): string => {
    for (let dir = dirOf(rel); dir; dir = dirOf(dir)) {
      const to = folderMoves.get(dir);
      if (to) return to + rel.slice(dir.length);
    }
    return rel;
  };
  for (const old of unclear) {
    const target = moved(old);
    if (free.has(target)) {
      renames.set(old, target);
      free.delete(target);
    }
  }
  const followPath = (rel: string): string => {
    const known = renames.get(rel);
    if (known) return known;
    const target = moved(rel);
    return target !== rel && source.exists(target) ? target : rel;
  };
  if (!renames.size) return { renames, followPath };
  for (const [from, to] of renames) warn(`${from} moved to ${to}: its lessons follow it (no action needed; update the manifest when convenient).`);
  const follow = followPath;
  for (const { slice } of owned) slice.file = follow(slice.file);
  for (const d of site.duplicates) {
    d.file = follow(d.file);
    d.duplicateOf = follow(d.duplicateOf);
  }
  for (const list of [site.linkOnly, site.excluded, site.recoverUnfencedCode, site.omitLines]) for (const e of list) e.file = follow(e.file);
  for (const c of courses) {
    for (const m of c.modules) {
      for (const l of m.lessons) {
        for (const r of l.resources) {
          if ('linkFrom' in r) r.linkFrom = follow(r.linkFrom);
          else if ('asset' in r) r.asset = follow(r.asset);
          else r.tryLocally = follow(r.tryLocally);
        }
      }
    }
  }
  return { renames, followPath };
}

/**
 * Resolves every entry's anchors to line ranges. Where the note changed underneath them the entries are re-tiled:
 * a lesson whose `until` is gone runs up to the next lesson, a lesson whose `from` is gone is dropped and its text
 * goes to the lesson before it, and text outside every entry joins its neighbour. Returns the entries to drop.
 */
function resolveRanges(owned: Owned[], source: NoteSource, warn: (m: string) => void): Set<Slice> {
  const dropped = new Set<Slice>();
  const byFile = new Map<string, Owned[]>();
  for (const o of owned) byFile.set(o.slice.file, [...(byFile.get(o.slice.file) ?? []), o]);
  for (const [rel, list] of byFile) {
    if (!source.exists(rel)) {
      for (const o of list) {
        dropped.add(o.slice);
        warn(`${o.owner}: its note ${rel} is gone, so that part of the lesson is no longer shown.`);
      }
      continue;
    }
    const note = source.load(rel);
    const total = note.lines.length;
    const locate = (anchor: string | undefined, line: string | undefined, occurrence: number | undefined, owner: string): number | null | undefined => {
      if (anchor) {
        const found = resolveHeading(note, anchor, occurrence);
        if (!found) return null;
        if (found.fuzzy) warn(`${owner}: heading "${anchor}" is now "${'#'.repeat(found.heading.depth)} ${found.heading.text}" in ${rel}; followed it (no action needed).`);
        return found.heading.line;
      }
      if (line) {
        try {
          return findLine(note, line);
        } catch {
          return null;
        }
      }
      return undefined; // this entry has no such anchor
    };
    const spans: { o: Owned; start: number; end: number | null; exact: boolean }[] = [];
    for (const o of list) {
      const s = o.slice;
      const start = locate(s.from, s.fromLine, s.fromOccurrence, o.owner);
      if (start === null) {
        dropped.add(s);
        warn(`${o.owner}: heading "${s.from ?? s.fromLine}" is gone from ${rel}; its text joined the lesson before it.`);
        continue;
      }
      const end = locate(s.until, s.untilLine, s.untilOccurrence, o.owner);
      spans.push({ o, start: start ?? 0, end: end === undefined ? total : end, exact: !s.from || note.headings.some((h) => h.norm === normHeading(s.from!)) });
    }
    spans.sort((a, b) => a.start - b.start || Number(b.exact) - Number(a.exact));
    const kept = spans.filter((sp, i) => {
      if (i === 0 || spans[i - 1]!.start !== sp.start) return true;
      dropped.add(sp.o.slice);
      warn(`${sp.o.owner}: now starts at the same place in ${rel} as ${spans[i - 1]!.o.owner}, so it was merged into that one.`);
      return false;
    });
    kept.forEach((sp, i) => {
      const next = kept[i + 1]?.start ?? total;
      const keepEnd = sp.end !== null && sp.end > sp.start && sp.end <= next && !hasText(note, sp.end, next);
      sp.o.slice.range = [sp.start, keepEnd ? sp.end! : next];
    });
    if (kept[0] && hasText(note, 0, kept[0].start)) kept[0].o.slice.range![0] = 0;
  }
  return dropped;
}

/** Removes dropped entries, then any lesson left with nothing to show. */
function pruneLessons(courses: Course[], site: SiteManifest, dropped: Set<Slice>, warn: (m: string) => void): void {
  const keep = (s: Slice) => !dropped.has(s);
  site.interview = site.interview.filter(keep);
  for (const c of courses) {
    if (c.landing) c.landing.sources = c.landing.sources.filter(keep);
    for (const m of c.modules) {
      m.lessons = m.lessons.filter((l) => {
        l.sources = l.sources.filter(keep);
        if (!l.sources.length) warn(`Lesson ${c.id}/${m.id}/${l.id} has no text left, so it was removed. Its URL and quiz go with it.`);
        return l.sources.length > 0;
      });
    }
  }
}

/** A section or course with nothing in it has no page to show. Runs after placement, which may have refilled one. */
function dropEmpty(courses: Course[]): void {
  for (const c of courses) c.modules = c.modules.filter((m) => m.lessons.length > 0 || m.status === 'planned');
  for (let i = courses.length - 1; i >= 0; i--) if (!courses[i]!.modules.length) courses.splice(i, 1);
}

/** Clears site-level entries whose note is gone. A "duplicate" that has grown new content stops being one. */
function tidySiteLists(site: SiteManifest, source: NoteSource, warn: (m: string) => void): void {
  const there = (e: { file: string }) => source.exists(e.file);
  site.duplicates = site.duplicates.filter((d) => {
    if (!source.exists(d.file)) return false;
    if (!source.exists(d.duplicateOf)) {
      warn(`${d.file} was a copy of ${d.duplicateOf}, which is gone; it now gets its own lesson.`);
      return false;
    }
    const have = contentLines(source.load(d.duplicateOf));
    const extra = [...contentLines(source.load(d.file))].filter((l) => !have.has(l));
    if (extra.length) warn(`${d.file} is no longer a copy of ${d.duplicateOf} (${extra.length} new line${extra.length === 1 ? '' : 's'}); it now gets its own lesson.`);
    return extra.length === 0;
  });
  site.linkOnly = site.linkOnly.filter(there);
  site.excluded = site.excluded.filter(there);
  site.recoverUnfencedCode = site.recoverUnfencedCode.filter(there);
  site.omitLines = site.omitLines.filter(there);
}

// ── 3: place new notes ────────────────────────────────────────────────────────────────────

/** Author lines at the top of a note, as document exports write them. Dropped from the lesson and listed in the report. */
export function bylines(note: Note): string[] {
  return note.lines
    .slice(0, 10)
    .filter((l, i) => !note.inFence[i] && /^[A-Z][a-z]+ \d{1,2}, \d{4}\s*·\s*@\S/.test(l.trim()))
    .map((l) => l.trim());
}

interface Home {
  course: Course;
  mod: ManifestModule;
  created: 'course' | 'section' | null;
  why: string;
}
interface Src {
  course: Course;
  mod: ManifestModule;
  file: string;
  dir: string;
  num: number[] | null;
}

function placeNewNotes(courses: Course[], site: SiteManifest, notes: string[], source: NoteSource, warn: (m: string) => void): PlacedNote[] {
  const mapped = new Set(ownedSlices(courses, site).map((o) => o.slice.file));
  for (const l of site.linkOnly) mapped.add(l.file);
  const excludedFiles = new Set(site.excluded.map((x) => x.file));
  const handled = (rel: string) => mapped.has(rel) || excludedFiles.has(rel) || site.duplicates.some((d) => d.file === rel);
  const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;
  // shallowest first, so a note's section doesn't depend on whether a sub-folder has appeared beside it since
  const depth = (rel: string) => rel.split('/').length;
  const fresh = notes.filter((n) => !handled(n)).sort((a, b) => depth(a) - depth(b) || natural(a, b));
  if (!fresh.length) return [];

  const srcs: Src[] = [];
  const indexModule = (course: Course, mod: ManifestModule) => {
    for (const l of mod.lessons) {
      for (const s of l.sources) {
        if (!srcs.some((x) => x.file === s.file && x.mod === mod)) srcs.push({ course, mod, file: s.file, dir: dirOf(s.file), num: numberOf(baseOf(s.file)) });
      }
    }
  };
  for (const c of courses) for (const m of c.modules) indexModule(c, m);
  const usedLessonIds = new Set(courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id))));
  const lineSets = new Map<string, Set<string>>();
  const linesOf = (rel: string) => lineSets.get(rel) ?? lineSets.set(rel, contentLines(source.load(rel))).get(rel)!;
  const isCopyOf = (rel: string, other: string) => other !== rel && source.exists(other) && [...linesOf(rel)].every((l) => linesOf(other).has(l));

  const moduleNumber = (m: ManifestModule): number[] | null => {
    const nums = [m.noteFolder ?? '', ...m.lessons.flatMap((l) => l.sources.map((s) => dirOf(s.file)))].map((d) => numberOf(baseOf(d))).filter((n): n is number[] => n !== null);
    return nums.length ? nums.sort(compareNumbers)[nums.length - 1]! : null;
  };
  /** New sections go in number order when their folder is numbered, otherwise after the last section that has lessons. */
  const insertModule = (course: Course, mod: ManifestModule, num: number[] | null) => {
    let at = course.modules.reduce((last, m, i) => (m.status === 'planned' ? last : i + 1), 0);
    if (num) {
      const numbered = course.modules.map((m, i) => ({ n: moduleNumber(m), i })).filter((x) => x.n !== null);
      const lower = numbered.filter((x) => compareNumbers(x.n!, num) <= 0).pop();
      if (lower) at = lower.i + 1;
      else if (numbered[0]) at = numbered[0].i;
    }
    course.modules.splice(at, 0, mod);
  };
  const uniqueModuleId = (course: Course, wanted: string) => {
    const base = wanted || 'notes';
    return course.modules.some((m) => m.id === base) ? `${base}-${shortHash(base + course.id)}` : base;
  };
  const folderModule = (course: Course, folder: string): ManifestModule => {
    const known = course.modules.find((m) => m.noteFolder === folder);
    if (known) return known;
    const name = baseOf(folder);
    // "Notes" says nothing in a sidebar, so a folder with a generic name borrows the course's
    const title = GENERIC_STEMS.has(humanize(name).toLowerCase()) ? `${course.shortTitle} ${humanize(name).toLowerCase()}` : humanize(name);
    const mod: ManifestModule = { id: uniqueModuleId(course, slugify(humanize(name))), title, noteFolder: folder, lessons: [] };
    insertModule(course, mod, numberOf(name));
    return mod;
  };
  const namedModule = (course: Course, id: string, title: string): { mod: ManifestModule; created: boolean } => {
    const known = course.modules.find((m) => m.id === id);
    if (known) return { mod: known, created: false };
    const mod: ManifestModule = { id, title, lessons: [] };
    insertModule(course, mod, null);
    return { mod, created: true };
  };
  const newCourse = (name: string): Course => {
    let id = slugify(humanize(name)) || 'notes';
    if (RESERVED_COURSE_IDS.has(id) || courses.some((c) => c.id === id)) id = `${id}-notes`;
    const title = humanize(name);
    const course: Course = { id, title, shortTitle: title, kind: 'course', accent: 'brand', icon: 'notes', prerequisites: [], summary: `Notes from the ${name} folder.`, modules: [] };
    courses.push(course);
    return course;
  };
  /** The section whose name and lesson titles share the most words with this note; a tie picks nothing. */
  const bestByWords = (note: Note, candidates: ManifestModule[], minShared: number): ManifestModule | null => {
    const mine = words(`${noteTitle(note)} ${humanize(stemOf(note.rel))}`);
    const scored = candidates
      .map((mod) => {
        const theirs = words(`${mod.id.replace(/-/g, ' ')} ${mod.title} ${mod.lessons.map((l) => l.title).join(' ')}`);
        return { mod, score: [...mine].filter((w) => theirs.has(w)).length };
      })
      .sort((a, b) => b.score - a.score);
    if (!scored[0] || scored[0].score < minShared || scored[1]?.score === scored[0].score) return null;
    return scored[0].mod;
  };
  const moreNotes = (course: Course): Home => {
    const { mod, created } = namedModule(course, 'more-notes', 'More notes');
    return { course, mod, created: created ? 'section' : null, why: 'no section matches its folder, number or title' };
  };

  const findHome = (rel: string, note: Note): Home => {
    const dir = dirOf(rel);
    // a section that names this folder, including a planned one waiting for its first note
    const claims = courses
      .flatMap((course) => course.modules.map((mod) => ({ course, mod })))
      .filter(({ mod }) => mod.noteFolder && (dir === mod.noteFolder || dir.startsWith(`${mod.noteFolder}/`)))
      .sort((a, b) => b.mod.noteFolder!.length - a.mod.noteFolder!.length);
    if (claims[0]) return { ...claims[0], created: null, why: `the section owns ${claims[0].mod.noteFolder}` };

    // the repo root is not a course's folder
    if (!dir) {
      const known = courses.find((c) => c.id === 'more-notes');
      const created: Home['created'] = known ? null : 'course';
      const course = known ?? newCourse('More notes');
      return { course, mod: namedModule(course, 'general', 'General notes').mod, created, why: 'it sits at the top of the repository' };
    }

    // notes in lessons right beside it
    const beside = srcs.filter((s) => s.dir === dir);
    if (beside.length) {
      const mods = [...new Set(beside.map((s) => s.mod))];
      const course = majority(beside.map((s) => s.course));
      if (mods.length === 1) return { course: beside[0]!.course, mod: mods[0]!, created: null, why: 'its folder belongs to this section' };
      const num = numberOf(baseOf(rel));
      if (num) {
        const numbered = beside.filter((s) => s.num).sort((a, b) => compareNumbers(a.num!, b.num!));
        const near = numbered.filter((s) => compareNumbers(s.num!, num) <= 0).pop() ?? numbered[0];
        if (near) return { course: near.course, mod: near.mod, created: null, why: `it follows ${baseOf(near.file)}` };
      }
      const byTitle = bestByWords(note, mods, 1) ?? bestByWords(note, course.modules, 2);
      if (byTitle) return { course, mod: byTitle, created: null, why: 'its title matches this section' };
      return moreNotes(course);
    }

    // a new folder: the nearest parent folder with notes in lessons says which course owns it
    for (let anc = dir; anc; anc = dirOf(anc)) {
      const below = srcs.filter((s) => s.dir.startsWith(`${anc}/`) || s.dir === anc);
      if (!below.length) continue;
      const course = majority(below.map((s) => s.course));
      if (anc === dir) {
        const byTitle = bestByWords(note, course.modules, 2);
        return byTitle ? { course, mod: byTitle, created: null, why: 'its title matches this section' } : moreNotes(course);
      }
      const folder = `${anc}/${dir.slice(anc.length + 1).split('/')[0]!}`;
      return { course, mod: folderModule(course, folder), created: 'section', why: `new folder ${folder}` };
    }

    // a new top-level folder
    const [top, sub] = dir.split('/') as [string, string | undefined];
    const known = courses.find((c) => c.modules.some((m) => m.noteFolder?.startsWith(`${top}/`) || m.noteFolder === top));
    const course = known ?? newCourse(top);
    const created = known ? 'section' : 'course';
    if (sub) return { course, mod: folderModule(course, `${top}/${sub}`), created, why: `new folder ${top}` };
    const title = /notes$/i.test(humanize(top)) ? humanize(top) : `${humanize(top)} notes`;
    return { course, mod: namedModule(course, slugify(humanize(top)) || 'notes', title).mod, created, why: `new folder ${top}` };
  };

  const lessonId = (rel: string, part: { start: number }, note: Note, index: number): string => {
    const stem = stemOf(rel);
    let base = slugify(humanize(stem)) || 'lesson';
    if (index > 0) base = `${base}-${slugify(partTitle(note, part.start)) || `part-${index + 1}`}`.slice(0, 80).replace(/-+$/, '');
    const folder = slugify(humanize(baseOf(dirOf(rel))));
    let id = base;
    if (GENERIC_STEMS.has(base) && folder) id = `${folder}-${base}`;
    if (usedLessonIds.has(id) && folder) id = `${folder}-${base}`.slice(0, 80).replace(/-+$/, '');
    if (usedLessonIds.has(id)) id = `${id}-${shortHash(`${rel}#${index}`)}`;
    usedLessonIds.add(id);
    return id;
  };
  const kindOf = (rel: string, course: Course, parts: number): ManifestLesson['kind'] => {
    if (parts > 1) return 'lesson';
    const has = (k: ManifestLesson['kind']) => course.modules.some((m) => m.lessons.some((l) => l.kind === k));
    if (/roadmap/i.test(stemOf(rel)) && has('roadmap')) return 'roadmap';
    if (/checklist/i.test(stemOf(rel)) && has('checklist')) return 'checklist';
    return 'lesson';
  };
  const insertLessons = (mod: ManifestModule, lessons: ManifestLesson[], rel: string) => {
    const num = numberOf(baseOf(rel));
    let at = mod.lessons.length;
    if (num) {
      let after = -1;
      let firstHigher = -1;
      mod.lessons.forEach((l, i) => {
        for (const s of l.sources) {
          const n = dirOf(s.file) === dirOf(rel) ? numberOf(baseOf(s.file)) : null;
          if (!n) continue;
          if (compareNumbers(n, num) <= 0) after = i;
          else if (firstHigher < 0) firstHigher = i;
        }
      });
      if (after >= 0) at = after + 1;
      else if (firstHigher >= 0) at = firstHigher;
    }
    mod.lessons.splice(at, 0, ...lessons);
  };

  const placed: PlacedNote[] = [];
  for (const rel of fresh) {
    const exclude = (reason: string) => {
      site.excluded.push({ file: rel, reason });
      excludedFiles.add(rel);
    };
    const rule = site.autoExclude.find((x) => matchesGlob(x.pattern, rel));
    if (rule) {
      exclude(rule.reason);
      continue;
    }
    const note = source.load(rel);
    if (note.isTxt && (source.inProject(rel) || /^(license|licence|notice|third.?party|requirements|changelog|cmakelists)/i.test(baseOf(rel)))) {
      exclude('A text file that belongs to a project, not a note.');
      continue;
    }
    if (wordCount(note, 0, note.lines.length) < MIN_NOTE_WORDS || !linesOf(rel).size) {
      exclude('Almost empty: it appears on the site once it has content.');
      continue;
    }
    const excludedOriginal = [...excludedFiles].find((x) => isCopyOf(rel, x));
    if (excludedOriginal) {
      exclude(`A copy of ${excludedOriginal}, which is kept off the site.`);
      continue;
    }
    const original = [...mapped].find((x) => isCopyOf(rel, x));
    if (original) {
      site.duplicates.push({ file: rel, duplicateOf: original, check: 'formatting-insensitive', reason: 'Found automatically: every line of this note is already in the other one.' });
      continue;
    }
    const findings = site.publishAnyway.some((x) => x.file === rel) ? [] : holdBackFindings(note.lines.join('\n'));
    if (findings.length) {
      const f = findings[0]!;
      exclude(`Held back: ${f.label.toLowerCase()} at line ${f.line}. Remove it from the note, or list the note under publishAnyway in _site.yaml.`);
      warn(`${rel} was NOT published: ${f.label.toLowerCase()} at line ${f.line} ("${f.match.slice(0, 40)}"). Remove it from the note, or list the note under publishAnyway in _site.yaml.`);
      continue;
    }

    // an exported document opens with its author's name ("Oct 24, 2026 · @Name"): that's a signature, not lesson text
    for (const line of bylines(note)) site.omitLines.push({ file: rel, startsWith: line });

    const home = findHome(rel, note);
    const parts = splitNote(note);
    const title = noteTitle(note);
    const lessons: ManifestLesson[] = parts.map((part, i) => {
      return {
        id: lessonId(rel, part, note, i),
        title: (i > 0 && partTitle(note, part.start)) || (i === 0 ? title : `${title}, part ${i + 1}`),
        kind: kindOf(rel, home.course, parts.length),
        reason: `Placed automatically: ${home.why}.`,
        sources: [{ file: rel, range: [part.start, part.end] as [number, number] }],
        place: [],
        related: [],
        cheatsheets: [],
        resources: [],
      };
    });
    if (home.mod.status === 'planned') delete home.mod.status;
    insertLessons(home.mod, lessons, rel);
    indexModule(home.course, home.mod);
    mapped.add(rel);
    placed.push({
      file: rel,
      lessons: lessons.map((l) => `${home.course.id}/${home.mod.id}/${l.id}`),
      where: `${home.course.title} › ${home.mod.title}`,
      created: home.created,
      why: home.why,
    });
  }
  return placed;
}

/** The home page and catalogue list courses by id: drop ids that are gone and give new courses a place. */
function alignCatalogue(courses: Course[], site: SiteManifest): void {
  const known = new Set(courses.map((c) => c.id));
  const has = (id: string) => known.has(id);
  const route = site.suggestedPath;
  site.catalogue.order = [...site.catalogue.order.filter(has), ...courses.map((c) => c.id).filter((id) => !site.catalogue.order.includes(id))];
  route.main = route.main.filter(has);
  route.parallel = route.parallel.filter((p) => has(p.course)).map((p) => ({ ...p, alongside: p.alongside.filter(has) }));
  route.branches = route.branches.filter((b) => has(b.course) && has(b.after));
  const onPath = new Set([...route.main, ...route.parallel.map((p) => p.course), ...route.branches.map((b) => b.course)]);
  const after = route.main[route.main.length - 1];
  if (!after) return;
  for (const c of courses) if (!onPath.has(c.id)) route.branches.push({ course: c.id, after, note: 'Added automatically from new notes.' });
}

const projectFolders = new Map<string, boolean>();
const hasProjectFile = (dir: string): boolean => {
  const hit = projectFolders.get(dir);
  if (hit !== undefined) return hit;
  let found = false;
  try {
    found = fs.readdirSync(abs(dir)).some((f) => /\.(cs|fs|vb)proj$|\.slnx?$/i.test(f));
  } catch {
    // an unreadable folder is simply not a project
  }
  projectFolders.set(dir, found);
  return found;
};
const diskNotes: NoteSource = {
  exists: exactCaseExists,
  load: loadNote,
  inProject: (rel) => {
    for (let dir = dirOf(rel); dir; dir = dirOf(dir)) if (hasProjectFile(dir)) return true;
    return false;
  },
};

/** Files the `ignore` globs in _site.yaml rule out: never notes, never reported. */
export const isIgnored = (patterns: string[], rel: string): boolean => patterns.some((p) => matchesGlob(p, rel));

/**
 * Brings the manifests in line with the notes on disk. Mutates `courses` and `site`; afterwards every slice has a
 * `range`, and every note in `notes` is in a lesson or a site-level list. Anything worth a look goes to `warnings`.
 */
export function reconcileCurriculum(input: { courses: Course[]; site: SiteManifest; notes: string[]; warnings: string[]; source?: NoteSource }): ReconcileResult {
  const { courses, site, notes, warnings, source = diskNotes } = input;
  const warn = (m: string) => warnings.push(m);
  const { renames, followPath } = followRenames(courses, site, notes, source, warn);
  pruneLessons(courses, site, resolveRanges(ownedSlices(courses, site), source, warn), warn);
  tidySiteLists(site, source, warn);
  const placed = placeNewNotes(courses, site, notes, source, warn);
  dropEmpty(courses);
  alignCatalogue(courses, site);
  return { placed, renames, followPath };
}
