/**
 * Validates the hand-edited data (quizzes, cheat sheets, interview questions) against src/data/schema.ts and
 * against the lessons and notes they point at, then resolves it into the JSON the pages read:
 *
 *   src/data/generated/lesson-index.json   lesson → title, course and every heading with its anchor id
 *   src/data/generated/quizzes.json        lesson → questions, each with the anchor of its source section
 *   src/data/generated/cheatsheets.json    sheets with every `from` resolved to a lesson anchor
 *   src/data/generated/interview.json      topics, questions (notes answers copied from the notes), lesson links
 *
 * Nothing here invents content: notes-origin interview answers are copied from the note, and their short
 * answer, pitfalls, follow-ups and code must be verbatim excerpts of that note section.
 */
import fs from 'node:fs';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import type { Heading, Root } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import YAML from 'yaml';
import { CheatSheetSchema, InterviewFileSchema, QuizFileSchema, type CheatSheet, type InterviewQuestion, type NoteSection, type QuizQuestion } from '../../src/data/schema';
import { exactCaseExists, findHeading, loadNote, normText, parseHeadingLine, sectionEnd } from './notes';
import { SITE_ROOT } from './paths';

export const DATA_DIR = path.join(SITE_ROOT, 'src', 'data');

export interface LessonRecord {
  /** Full id "course/module/lesson" (the URL path). */
  id: string;
  /** The manifest's lesson id, unique across courses. Data files refer to lessons by this. */
  slug: string;
  title: string;
  course: string;
  courseTitle: string;
  module: string;
  kind: 'lesson' | 'checklist' | 'roadmap';
  /** The generated lesson Markdown (what Astro renders). */
  body: string;
  /** The note ranges the lesson is made of (0-based, end exclusive). */
  slices: { rel: string; start: number; end: number }[];
}
export interface LessonHeading {
  depth: number;
  text: string;
  id: string;
}
export interface DataSummary {
  quizzes: { lessons: number; questions: number; missing: string[] };
  cheatsheets: { sheets: number; items: number; fromDocs: number; missing: string[] };
  interview: { topic: string; notes: number; web: number; reviewed: number }[];
}
interface Ctx {
  lessons: LessonRecord[];
  sheetIds: { id: string; title: string }[];
  topics: { id: string; title: string; subtopics?: string[]; notCoveredYet?: boolean }[];
  /** Note ranges routed to Interview Prep in _site.yaml; every non-blank line must be used by a notes question. */
  interviewSlices: { rel: string; start: number; end: number }[];
  omitted: Map<string, Set<number>>;
  /** normText of headings that say "interview" but aren't interview material (_interview.yaml falsePositives). */
  falsePositives: Set<string>;
  errors: string[];
  warnings: string[];
}

/** Lowercase letters and digits only: formatting, punctuation and spacing don't count for quotes. */
const loose = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');
const stripHashes = (s: string) => s.replace(/^\s*#{1,6}\s+/, '');

/** Every heading of a lesson with the id remarkHeadingIds gives it (same parser, same slugger). */
export function lessonHeadings(body: string): LessonHeading[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Root;
  const slugger = new GithubSlugger();
  const out: LessonHeading[] = [];
  visit(tree, 'heading', (h: Heading) => {
    const text = toString(h).trim();
    out.push({ depth: h.depth, text, id: slugger.slug(text) || 'section' });
  });
  return out;
}

function readFiles(dir: string, ext: RegExp): { name: string; file: string; text: string }[] {
  const full = path.join(DATA_DIR, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => ext.test(f))
    .sort()
    .map((f) => ({ name: f.replace(ext, ''), file: `src/data/${dir}/${f}`, text: fs.readFileSync(path.join(full, f), 'utf8') }));
}

function issues(file: string, error: { issues: { path: PropertyKey[]; message: string }[] }, errors: string[]) {
  for (const i of error.issues.slice(0, 12)) errors.push(`${file}: ${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
  if (error.issues.length > 12) errors.push(`${file}: … and ${error.issues.length - 12} more schema problems`);
}

export function checkData(ctx: Ctx): { outputs: Record<string, unknown>; summary: DataSummary } {
  const { errors, warnings } = ctx;
  // data files refer to lessons by their short id (slug); outputs carry `path` (the full id) for URLs
  const lessonById = new Map(ctx.lessons.map((l) => [l.slug, l]));
  const headingsOf = new Map(ctx.lessons.map((l) => [l.slug, lessonHeadings(l.body)]));
  const lessonRef = (slug: string) => {
    const l = lessonById.get(slug)!;
    return { id: slug, path: l.id, title: l.title, course: l.course, courseTitle: l.courseTitle };
  };

  /** Resolves a section heading inside a lesson to its anchor, or records an error. */
  const anchorIn = (lessonId: string, section: string, where: string): string | null => {
    const hs = headingsOf.get(lessonId);
    if (!hs) {
      errors.push(`${where}: lesson "${lessonId}" does not exist`);
      return null;
    }
    const want = normText(stripHashes(section));
    const hit = hs.find((h) => normText(h.text) === want);
    if (hit) return hit.id;
    const words = new Set(want.split(' '));
    const near = hs
      .map((h) => ({ h, score: normText(h.text).split(' ').filter((w) => words.has(w)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => `"${x.h.text}"`);
    errors.push(`${where}: no heading "${section}" in lesson ${lessonId}${near.length ? ` (closest: ${near.join(', ')})` : ''}`);
    return null;
  };

  // ── lesson index ───────────────────────────────────────────────────────────────────────────
  const lessonIndex = Object.fromEntries(
    ctx.lessons.map((l) => [l.slug, { path: l.id, title: l.title, course: l.course, courseTitle: l.courseTitle, module: l.module, kind: l.kind, headings: headingsOf.get(l.slug) }]),
  );

  // ── quizzes ────────────────────────────────────────────────────────────────────────────────
  const quizzes: Record<string, (QuizQuestion & { source: { section: string; anchor: string | null } })[]> = {};
  let quizQuestions = 0;
  for (const f of readFiles('quizzes', /\.json$/)) {
    let raw: unknown;
    try {
      raw = JSON.parse(f.text);
    } catch (e) {
      errors.push(`${f.file}: not valid JSON: ${(e as Error).message}`);
      continue;
    }
    const r = QuizFileSchema.safeParse(raw);
    if (!r.success) {
      issues(f.file, r.error, errors);
      continue;
    }
    const quiz = r.data;
    if (quiz.lesson !== f.name) errors.push(`${f.file}: "lesson" is ${quiz.lesson} but the file name says ${f.name}`);
    const lesson = lessonById.get(quiz.lesson);
    if (!lesson) {
      errors.push(`${f.file}: lesson "${quiz.lesson}" does not exist`);
      continue;
    }
    const ids = new Set<string>();
    const out = [];
    for (const q of quiz.questions) {
      const where = `${f.file} ${q.id}`;
      if (ids.has(q.id)) errors.push(`${where}: duplicate question id`);
      ids.add(q.id);
      if (q.type !== 'order-steps') {
        if (q.answer >= q.options.length) errors.push(`${where}: answer ${q.answer} is out of range (${q.options.length} options)`);
        if (new Set(q.options.map((o) => o.trim())).size !== q.options.length) errors.push(`${where}: options repeat`);
      } else if (new Set(q.steps.map((s) => s.trim())).size !== q.steps.length) {
        errors.push(`${where}: steps repeat`);
      }
      if (q.type === 'predict-output' && !loose(lesson.body).includes(loose(q.code.source))) {
        errors.push(`${where}: the code is not copied from the lesson (predict-output code must appear in the note)`);
      }
      const anchor = anchorIn(quiz.lesson, q.source.section, where);
      out.push({ ...q, source: { section: q.source.section, anchor } });
    }
    quizzes[quiz.lesson] = out;
    quizQuestions += out.length;
  }
  const quizMissing = ctx.lessons.filter((l) => l.kind === 'lesson' && !quizzes[l.slug]).map((l) => l.slug);

  // ── cheat sheets ───────────────────────────────────────────────────────────────────────────
  const sheets: unknown[] = [];
  const sheetsByLesson: Record<string, Set<string>> = {};
  let sheetItems = 0;
  let fromDocs = 0;
  const knownSheets = new Map(ctx.sheetIds.map((s) => [s.id, s.title]));
  const seenSheets = new Set<string>();
  for (const f of readFiles('cheatsheets', /\.ya?ml$/)) {
    let raw: unknown;
    try {
      raw = YAML.parse(f.text, { version: '1.2' });
    } catch (e) {
      errors.push(`${f.file}: not valid YAML: ${(e as Error).message}`);
      continue;
    }
    const r = CheatSheetSchema.safeParse(raw);
    if (!r.success) {
      issues(f.file, r.error, errors);
      continue;
    }
    const sheet: CheatSheet = r.data;
    if (sheet.id !== f.name) errors.push(`${f.file}: id is ${sheet.id} but the file name says ${f.name}`);
    if (!knownSheets.has(sheet.id)) errors.push(`${f.file}: ${sheet.id} is not listed in curriculum/_cheatsheets.yaml`);
    seenSheets.add(sheet.id);
    const resolveFrom = (from: { lesson: string; section: string } | undefined, where: string) => {
      if (!from) return null;
      const anchor = anchorIn(from.lesson, from.section, where);
      if (!anchor) return null;
      (sheetsByLesson[from.lesson] ??= new Set()).add(sheet.id);
      return { ...lessonRef(from.lesson), section: from.section, anchor };
    };
    const groups = sheet.groups.map((g, gi) => {
      const where = `${f.file} groups[${gi}] "${g.title}"`;
      const items = (g.items ?? []).map((it, ii) => {
        sheetItems++;
        if (it.docs) fromDocs++;
        if (it.code !== undefined && !it.code.trim()) errors.push(`${where} items[${ii}]: empty code`);
        return { ...it, from: resolveFrom(it.from, `${where} items[${ii}]`) };
      });
      let table = null;
      if (g.table) {
        const t = g.table;
        const tableFrom = resolveFrom(t.from, `${where} table`);
        const rows = t.rows.map((row, ri) => {
          sheetItems++;
          const cells = Array.isArray(row) ? row : row.cells;
          if (cells.length !== t.columns.length) errors.push(`${where} table row ${ri + 1}: ${cells.length} cells but ${t.columns.length} columns`);
          if (!Array.isArray(row) && row.docs) fromDocs++;
          const from = Array.isArray(row) ? tableFrom : row.docs ? null : row.from ? resolveFrom(row.from, `${where} table row ${ri + 1}`) : tableFrom;
          return { cells, from, docs: Array.isArray(row) ? null : (row.docs ?? null) };
        });
        table = { columns: t.columns, rows, from: tableFrom };
      }
      return { title: g.title, note: g.note ?? null, items, table };
    });
    sheets.push({ id: sheet.id, title: sheet.title, summary: sheet.summary, groups });
  }
  const sheetsMissing = ctx.sheetIds.filter((s) => !seenSheets.has(s.id)).map((s) => s.id);

  // ── interview questions ────────────────────────────────────────────────────────────────────
  const topicById = new Map(ctx.topics.map((t) => [t.id, t]));
  const questions: unknown[] = [];
  const byLesson: Record<string, string[]> = {};
  const questionIds = new Set<string>();
  const counts = new Map<string, { notes: number; web: number; reviewed: number }>();
  /** note file → covered 0-based line ranges, for the routed-notes coverage check */
  const used = new Map<string, [number, number][]>();
  /** lesson-note sections whose heading says "interview" and that some question uses */
  const usedHeadings = new Set<string>();

  const lessonOfLine = (rel: string, line: number) => ctx.lessons.find((l) => l.slices.some((s) => s.rel === rel && line >= s.start && line < s.end));

  /** The note text a notes question answers from: lines after the heading up to the section end (omitted lines dropped). */
  const sectionText = (src: NoteSection, where: string): { md: string; start: number; end: number; plain: string } | null => {
    if (!exactCaseExists(src.file)) {
      errors.push(`${where}: note not found with this exact case: ${src.file}`);
      return null;
    }
    const note = loadNote(src.file);
    try {
      const h = findHeading(note, src.section, src.occurrence ?? 1);
      let end = sectionEnd(note, h);
      if (src.until) {
        const u = note.headings.find((x) => x.line > h.line && x.norm === `${parseHeadingLine(src.until!)?.depth} ${normText(parseHeadingLine(src.until!)?.text ?? '')}`);
        if (!u) errors.push(`${where}: until heading "${src.until}" not found after "${src.section}"`);
        else end = u.line;
      }
      const om = ctx.omitted.get(src.file);
      const kept: string[] = [];
      for (let i = h.line + 1; i < end; i++) {
        if (om?.has(i)) continue;
        let line = note.lines[i]!;
        const inner = !note.inFence[i] ? parseHeadingLine(line) : null;
        // headings inside an answer sit below the question: shallowest inner level becomes h4
        if (inner) line = '#'.repeat(Math.min(6, Math.max(4, inner.depth - h.depth + 3))) + ' ' + inner.text;
        kept.push(line);
      }
      const md = kept.join('\n').trim();
      return { md, start: h.line, end, plain: note.lines.slice(h.line, end).join('\n') };
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      return null;
    }
  };

  for (const f of readFiles('interview', /\.json$/)) {
    let raw: unknown;
    try {
      raw = JSON.parse(f.text);
    } catch (e) {
      errors.push(`${f.file}: not valid JSON: ${(e as Error).message}`);
      continue;
    }
    const r = InterviewFileSchema.safeParse(raw);
    if (!r.success) {
      issues(f.file, r.error, errors);
      continue;
    }
    const file = r.data;
    // <topic>.json, or split by origin as <topic>.notes.json / <topic>.web.json
    const fileTopic = f.name.replace(/\.(notes|web)$/, '');
    if (file.topic !== fileTopic) errors.push(`${f.file}: topic is ${file.topic} but the file name says ${fileTopic}`);
    const part = /\.(notes|web)$/.exec(f.name)?.[1];
    if (part && file.questions.some((q) => q.origin !== part)) errors.push(`${f.file}: a .${part}.json file holds only origin "${part}" questions`);
    const topic = topicById.get(file.topic);
    if (!topic) {
      errors.push(`${f.file}: topic ${file.topic} is not in curriculum/_interview.yaml`);
      continue;
    }
    const c = counts.get(file.topic) ?? { notes: 0, web: 0, reviewed: 0 };
    for (const q of file.questions as InterviewQuestion[]) {
      const where = `${f.file} ${q.id}`;
      if (questionIds.has(q.id)) errors.push(`${where}: duplicate id (ids are unique across all topics)`);
      questionIds.add(q.id);
      if (q.topic !== file.topic) errors.push(`${where}: topic is ${q.topic} but the file is ${file.topic}`);
      if (!q.id.startsWith(`${file.topic}-`)) errors.push(`${where}: id must start with "${file.topic}-"`);
      if (topic.subtopics && !topic.subtopics.includes(q.subtopic)) errors.push(`${where}: subtopic ${q.subtopic} is not one of ${topic.subtopics.join(', ')}`);
      const related = new Set(q.relatedLessons);
      for (const id of q.relatedLessons) if (!lessonById.has(id)) errors.push(`${where}: related lesson ${id} does not exist`);
      let answer = q.answer ?? '';
      if (q.origin === 'notes' && q.answerFrom) {
        const s = sectionText(q.answerFrom, where);
        if (s) {
          answer = s.md;
          const ranges = used.get(q.answerFrom.file) ?? [];
          ranges.push([s.start, s.end]);
          used.set(q.answerFrom.file, ranges);
          const home = lessonOfLine(q.answerFrom.file, s.start);
          if (home) {
            related.add(home.slug);
            usedHeadings.add(`${q.answerFrom.file}#${s.start}`);
          }
          const hay = loose(s.plain);
          const quote = (label: string, text: string) => {
            const parts = text.split(/\s*(?:…|\.\.\.)\s*/).filter((p) => loose(p).length > 0);
            if (!parts.every((p) => hay.includes(loose(p)))) errors.push(`${where}: ${label} must be quoted from the note section (it isn't): "${text.slice(0, 80)}"`);
          };
          quote('shortAnswer', q.shortAnswer);
          q.pitfalls.forEach((p, i) => quote(`pitfalls[${i}]`, p));
          q.followUps.forEach((p, i) => quote(`followUps[${i}]`, p));
          if (q.code) quote('code', q.code.source);
        }
      }
      if (q.origin === 'notes') c.notes++;
      else c.web++;
      if (q.reviewed) c.reviewed++;
      for (const id of related) (byLesson[id] ??= []).push(q.id);
      questions.push({ ...q, answer, relatedLessons: [...related].filter((id) => lessonById.has(id)).map(lessonRef) });
    }
    counts.set(file.topic, c);
  }

  // every line routed to Interview Prep must be used by some notes question
  for (const s of ctx.interviewSlices) {
    const note = loadNote(s.rel);
    const ranges = used.get(s.rel) ?? [];
    const om = ctx.omitted.get(s.rel);
    const missing: number[] = [];
    for (let i = s.start; i < s.end; i++) {
      if (!note.lines[i]!.trim() || om?.has(i)) continue;
      if (!ranges.some(([a, b]) => i >= a && i < b)) missing.push(i);
    }
    if (missing.length) {
      const first = missing.slice(0, 3).map((i) => `${i + 1}: "${note.lines[i]!.trim().slice(0, 60)}"`);
      warnings.push(`interview: ${missing.length} line(s) of ${s.rel} are not used by any notes question yet (first: ${first.join('; ')})`);
    }
  }
  // interview sections inside lessons should also be collected as notes questions
  for (const l of ctx.lessons) {
    for (const s of l.slices) {
      for (const h of loadNote(s.rel).headings) {
        if (h.line < s.start || h.line >= s.end || !/interview/i.test(h.text) || ctx.falsePositives.has(normText(h.text))) continue;
        if (ctx.omitted.get(s.rel)?.has(h.line)) continue;
        if (!usedHeadings.has(`${s.rel}#${h.line}`) && ![...used.get(s.rel) ?? []].some(([a, b]) => h.line >= a && h.line < b)) {
          warnings.push(`interview: lesson ${l.slug} has the interview section "${h.text}" (${s.rel}:${h.line + 1}) that no notes question uses yet`);
        }
      }
    }
  }

  const summary: DataSummary = {
    quizzes: { lessons: Object.keys(quizzes).length, questions: quizQuestions, missing: quizMissing },
    cheatsheets: { sheets: sheets.length, items: sheetItems, fromDocs, missing: sheetsMissing },
    interview: ctx.topics.map((t) => ({ topic: t.id, ...(counts.get(t.id) ?? { notes: 0, web: 0, reviewed: 0 }) })),
  };
  return {
    outputs: {
      'lesson-index.json': lessonIndex,
      'quizzes.json': quizzes,
      'cheatsheets.json': { sheets, byLesson: Object.fromEntries(Object.entries(sheetsByLesson).map(([k, v]) => [k, [...v]])) },
      'interview.json': {
        topics: ctx.topics.map((t) => ({ id: t.id, title: t.title, subtopics: t.subtopics ?? [], notCoveredYet: Boolean(t.notCoveredYet), ...(counts.get(t.id) ?? { notes: 0, web: 0, reviewed: 0 }) })),
        questions,
        byLesson,
      },
    },
    summary,
  };
}
