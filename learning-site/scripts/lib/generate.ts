import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { countMarkers } from '../../src/markdown/html-policy';
import { VERBATIM_CHECKS } from '../../src/viz/verbatim';
import { processAssets, type AssetOut } from './assets';
import { writeCoverage, type CoverageData, type LessonCoverage, type NoteCoverage } from './coverage';
import { checkData, type LessonRecord } from './data-check';
import { countMarkdown, readingMinutes, type MdCounts } from './mdcount';
import {
  clearNoteCache,
  contentLines,
  exactCaseExists,
  findHeading,
  findLine,
  inventory,
  loadNote,
  normText,
  parseHeadingLine,
  sectionEnd,
  type Note,
} from './notes';
import { CURRICULUM_DIR, OUT_DATA, OUT_LANDING, OUT_LESSONS } from './paths';
import { findUnfencedCode, type RecoveredBlock } from './recover';
import {
  AssetsSchema,
  CheatsheetsSchema,
  CourseSchema,
  InterviewSchema,
  SiteSchema,
  type Course,
  type ManifestLesson,
  type ManifestModule,
  type Placement,
  type Slice,
} from './schema';

export const COURSE_FILES = ['phase-1', 'desktop', 'phase-2', 'sql-server', 'dsa', 'math', 'backend-roadmap'] as const;

export interface BuildOptions {
  mode: 'build' | 'dev' | 'check';
  log?: (msg: string) => void;
  /** false = validate only: no files are written and binary assets are not processed (safe to run concurrently). */
  write?: boolean;
}
export interface BuildResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  lessons: number;
}

interface Range {
  rel: string;
  start: number;
  end: number;
}
interface Insertion {
  line: number;
  text: string;
}
interface LessonPlan {
  course: Course;
  module: ManifestModule;
  lesson: ManifestLesson;
  id: string;
  slices: Range[];
  inserts: Map<string, Insertion[]>;
  order: number;
}

const readYaml = (name: string): unknown => YAML.parse(fs.readFileSync(path.join(CURRICULUM_DIR, name), 'utf8'), { version: '1.2' });

const encodePath = (relPath: string) => relPath.split('/').map(encodeURIComponent).join('/');

export function githubBlobUrl(repo: string, relPath: string, start?: number, end?: number): string {
  const plain = /\.md$/i.test(relPath) ? '?plain=1' : '';
  const lines = start === undefined ? '' : end !== undefined && end - 1 > start ? `#L${start + 1}-L${end}` : `#L${start + 1}`;
  return `${repo}/blob/main/${encodePath(relPath)}${plain}${lines}`;
}
export const githubTreeUrl = (repo: string, relPath: string) => `${repo}/tree/main/${encodePath(relPath)}`;

/** Cleans a heading into a short phrase for "What this lesson covers". */
const cleanHeading = (t: string) =>
  t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[*`_]/g, '')
    .replace(/\p{Extended_Pictographic}|️|⃣/gu, '')
    .replace(/^\s*(\d+[.)]|[A-Z]\)|[➤▶•-])\s*/u, '')
    .replace(/\s*[:–—-]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

function writeIfChanged(file: string, content: string): void {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** Removes generated files that are no longer produced. */
function prune(dir: string, keep: Set<string>): void {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile()) continue;
    const full = path.join(e.parentPath, e.name);
    if (!keep.has(path.resolve(full))) fs.rmSync(full);
  }
}

export async function buildContent(opts: BuildOptions): Promise<BuildResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const log = opts.log ?? ((m: string) => console.log(m));
  const write = opts.write !== false;
  const emit = (file: string, content: string) => {
    if (write) writeIfChanged(file, content);
  };
  clearNoteCache();

  // ── 1. Manifests ───────────────────────────────────────────────────────────────────────
  const parse = <T>(name: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }): T | null => {
    try {
      const r = schema.safeParse(readYaml(name));
      if (r.success) return r.data;
      for (const i of r.error.issues) errors.push(`curriculum/${name}: ${i.path.join('.') || '(root)'}: ${i.message}`);
    } catch (e) {
      errors.push(`curriculum/${name}: ${(e as Error).message}`);
    }
    return null;
  };
  const site = parse('_site.yaml', SiteSchema);
  const assetsManifest = parse('_assets.yaml', AssetsSchema);
  const cheatsheets = parse('_cheatsheets.yaml', CheatsheetsSchema);
  const interviewManifest = parse('_interview.yaml', InterviewSchema);
  const courses: Course[] = [];
  for (const c of COURSE_FILES) {
    const course = parse(`${c}.yaml`, CourseSchema);
    if (course) {
      if (course.id !== c) errors.push(`curriculum/${c}.yaml: id is "${course.id}" but the file is ${c}.yaml`);
      courses.push(course);
    }
  }
  if (!site || !assetsManifest || !cheatsheets || !interviewManifest || courses.length !== COURSE_FILES.length) {
    return { ok: false, errors, warnings, lessons: 0 };
  }
  const repo = site.site.repo;
  const sheetIds = new Map(cheatsheets.sheets.map((s) => [s.id, s.title]));

  // ── 2. Notes and slice resolution ──────────────────────────────────────────────────────
  const notes = inventory();
  const coverage = new Map<string, { start: number; end: number; owner: string }[]>();
  const cover = (r: Range, owner: string) => {
    const list = coverage.get(r.rel) ?? [];
    list.push({ start: r.start, end: r.end, owner });
    coverage.set(r.rel, list);
  };
  const noteOrNull = (rel: string, ctx: string): Note | null => {
    if (!exactCaseExists(rel)) {
      errors.push(`${ctx}: file not found with this exact case: ${rel}`);
      return null;
    }
    return loadNote(rel);
  };
  const resolveSlice = (s: Slice, ctx: string): Range | null => {
    const note = noteOrNull(s.file, ctx);
    if (!note) return null;
    try {
      let start = 0;
      let end = note.lines.length;
      if (s.from) start = findHeading(note, s.from, s.fromOccurrence).line;
      if (s.fromLine) start = findLine(note, s.fromLine);
      if (s.until) end = findHeading(note, s.until, s.untilOccurrence).line;
      if (s.untilLine) end = findLine(note, s.untilLine);
      if (end <= start) throw new Error(`empty slice (${start + 1}..${end}) in ${s.file}`);
      return { rel: s.file, start, end };
    } catch (e) {
      errors.push(`${ctx}: ${(e as Error).message}`);
      return null;
    }
  };

  const lessonIds = new Set<string>();
  /** short lesson id (the manifest's `id`) → full id; data files refer to lessons by the short id */
  const lessonSlugs = new Map<string, string>();
  const moduleIds = new Set<string>();
  const plans: LessonPlan[] = [];
  const vizFence = (p: Placement, id: string, wraps: boolean) =>
    '```viz\n' + JSON.stringify({ name: p.viz ?? 'FlowDiagram', props: p.diagram ? { diagram: p.diagram, ...(p.props ?? {}) } : (p.props ?? {}), tier: p.tier ?? 1, wraps, id }) + '\n```';

  for (const course of courses) {
    let order = 0;
    for (const mod of course.modules) {
      const mid = `${course.id}/${mod.id}`;
      if (moduleIds.has(mid)) errors.push(`duplicate module id ${mid}`);
      moduleIds.add(mid);
      if (mod.status === 'planned' && mod.lessons.length) errors.push(`${mid}: planned modules must have no lessons (remove "status: planned" once lessons exist)`);
      if (mod.status !== 'planned' && !mod.lessons.length) errors.push(`${mid}: module has no lessons and is not "status: planned"`);
      for (const cov of mod.covers ?? []) {
        const [rel, heading] = cov.split(' › ');
        const note = rel ? noteOrNull(rel, `${mid} covers`) : null;
        if (note && heading) {
          try {
            findHeading(note, heading);
          } catch (e) {
            errors.push(`${mid} covers: ${(e as Error).message}`);
          }
        }
      }
      for (const lesson of mod.lessons) {
        const id = `${mid}/${lesson.id}`;
        if (lessonIds.has(id)) errors.push(`duplicate lesson id ${id}`);
        lessonIds.add(id);
        if (lessonSlugs.has(lesson.id)) {
          errors.push(`lesson id "${lesson.id}" is used twice (${lessonSlugs.get(lesson.id)} and ${id}); quizzes, cheat sheets and interview questions refer to lessons by this id, so it must be unique across courses`);
        }
        lessonSlugs.set(lesson.id, id);
        const slices: Range[] = [];
        for (const s of lesson.sources) {
          const r = resolveSlice(s, id);
          if (r) {
            slices.push(r);
            cover(r, id);
          }
        }
        const inserts = new Map<string, Insertion[]>();
        lesson.place.forEach((p, pi) => {
          let placed = false;
          for (const r of slices) {
            const note = loadNote(r.rel);
            let h;
            try {
              h = findHeading(note, p.at.section, p.at.atOccurrence);
            } catch {
              continue;
            }
            if (h.line < r.start || h.line >= r.end) continue;
            const secEnd = sectionEnd(note, h, r.end);
            let line = secEnd;
            let wraps = false;
            if (p.at.codeBlock) {
              const f = note.fences.filter((x) => x.start > h.line && x.start < secEnd)[p.at.codeBlock - 1];
              if (!f) {
                errors.push(`${id}: placement ${pi + 1} wants code block ${p.at.codeBlock} under "${p.at.section}", but that section has fewer fenced blocks`);
                placed = true;
                break;
              }
              line = f.start;
              wraps = true;
            }
            const list = inserts.get(r.rel) ?? [];
            list.push({ line, text: vizFence(p, `${id}#${pi + 1}`, wraps) });
            inserts.set(r.rel, list);
            placed = true;
            break;
          }
          if (!placed) errors.push(`${id}: placement ${pi + 1} (${p.viz ?? p.diagram}) anchors to "${p.at.section}", which is not inside this lesson's sources`);
        });
        plans.push({ course, module: mod, lesson, id, slices, inserts, order: order++ });
      }
    }
  }

  // landing, interview, duplicates, link-only, excluded
  const landingSlices = new Map<string, Range[]>();
  for (const course of courses) {
    for (const s of course.landing?.sources ?? []) {
      const r = resolveSlice(s, `${course.id} landing`);
      if (r) {
        cover(r, `${course.id} (landing page)`);
        landingSlices.set(course.id, [...(landingSlices.get(course.id) ?? []), r]);
      }
    }
  }
  const interviewSlices: Range[] = [];
  for (const s of site.interview) {
    const r = resolveSlice(s, 'interview');
    if (r) {
      cover(r, 'Interview Prep');
      interviewSlices.push(r);
    }
  }
  const wholeFile = (rel: string, owner: string, ctx: string) => {
    const note = noteOrNull(rel, ctx);
    if (note) cover({ rel, start: 0, end: note.lines.length }, owner);
    return note;
  };
  for (const d of site.duplicates) {
    const dup = wholeFile(d.file, `duplicate of ${d.duplicateOf}`, 'duplicates');
    const orig = noteOrNull(d.duplicateOf, 'duplicates');
    if (dup && orig) {
      const have = contentLines(orig);
      const missing = [...contentLines(dup)].filter((l) => !have.has(l));
      if (missing.length) {
        errors.push(
          `${d.file} is no longer a duplicate of ${d.duplicateOf}. Lines only in the first file:\n` +
            missing.slice(0, 8).map((l) => `    ${l}`).join('\n') +
            '\n  Merge the new content into the other copy, or map this file to a lesson.',
        );
      }
    }
  }
  const linkOnly = new Map<string, { url: string; title: string }>();
  for (const l of site.linkOnly) {
    const note = wholeFile(l.file, `link on ${l.usedBy}`, 'linkOnly');
    if (!note) continue;
    if (!lessonIds.has(l.usedBy)) errors.push(`linkOnly ${l.file}: usedBy lesson ${l.usedBy} does not exist`);
    const url = note.lines.join('\n').match(/https?:\/\/[^\s<>)]+/)?.[0];
    const title = note.headings[0]?.text ?? path.basename(l.file);
    if (!url) errors.push(`linkOnly ${l.file}: no URL found in the file`);
    else linkOnly.set(l.file, { url, title });
  }
  for (const x of site.excluded) wholeFile(x.file, `excluded: ${x.reason}`, 'excluded');

  // ── 3. Partition: every note mapped, every line exactly once ───────────────────────────
  const noteCoverage: NoteCoverage[] = [];
  for (const rel of notes) {
    const list = coverage.get(rel);
    if (!list) {
      errors.push(`Unmapped note: ${rel}\n  Add it to a lesson's sources in a course manifest, or list it under excluded/linkOnly/duplicates in _site.yaml.` + suggestLesson(rel, courses));
      noteCoverage.push({ file: rel, targets: [], status: 'unmapped' });
      continue;
    }
    const note = loadNote(rel);
    const owner: (string | null)[] = new Array(note.lines.length).fill(null);
    for (const c of list) {
      for (let i = c.start; i < c.end; i++) {
        if (owner[i] && owner[i] !== c.owner) {
          errors.push(`Overlap in ${rel} at line ${i + 1}: mapped to both ${owner[i]} and ${c.owner}`);
          break;
        }
        owner[i] = c.owner;
      }
    }
    const gaps = owner.map((o, i) => (o === null && note.lines[i]!.trim() ? i + 1 : 0)).filter(Boolean);
    if (gaps.length) errors.push(`Gap in ${rel}: ${gaps.length} non-blank line(s) not mapped, first at line ${gaps[0]}`);
    noteCoverage.push({ file: rel, targets: [...new Set(list.map((c) => c.owner))], status: 'mapped' });
  }
  for (const rel of coverage.keys()) if (!notes.includes(rel)) errors.push(`Mapped file is not a note in the inventory: ${rel}`);

  // ── 4. Omissions and unfenced-code recovery ────────────────────────────────────────────
  const omitted = new Map<string, Set<number>>();
  const omittedReport: CoverageData['omitted'] = [];
  for (const o of site.omitLines) {
    const note = noteOrNull(o.file, 'omitLines');
    if (!note) continue;
    const set = omitted.get(o.file) ?? new Set<number>();
    if ('startsWith' in o) {
      const hits = note.lines.map((l, i) => (!note.inFence[i] && l.trim().startsWith(o.startsWith) ? i : -1)).filter((i) => i >= 0);
      if (hits.length !== 1) errors.push(`omitLines: "${o.startsWith}" matched ${hits.length} lines in ${o.file} (it must match exactly one)`);
      for (const i of hits.slice(0, 1)) {
        set.add(i);
        omittedReport.push({ file: o.file, lines: `${i + 1}`, text: note.lines[i]!.trim() });
      }
    } else {
      try {
        const h = findHeading(note, o.section);
        const end = sectionEnd(note, h);
        for (let i = h.line; i < end; i++) set.add(i);
        omittedReport.push({ file: o.file, lines: `${h.line + 1}-${end}`, text: `${o.section} (whole section)` });
      } catch (e) {
        errors.push(`omitLines: ${(e as Error).message}`);
      }
    }
    omitted.set(o.file, set);
  }
  const recovered = new Map<string, RecoveredBlock[]>();
  const recoveredReport: CoverageData['recovered'] = [];
  for (const r of site.recoverUnfencedCode) {
    const note = noteOrNull(r.file, 'recoverUnfencedCode');
    if (!note) continue;
    const om = omitted.get(r.file) ?? new Set<number>();
    const skip = note.lines.map((_, i) => note.inFence[i]! || om.has(i));
    const blocks = findUnfencedCode(note.lines, skip);
    recovered.set(r.file, blocks);
    for (const b of blocks) recoveredReport.push({ file: r.file, lines: `${b.start + 1}-${b.end + 1}`, lang: b.lang, first: note.lines[b.start]!.trim().slice(0, 80), label: b.labelLine !== undefined });
  }

  // ── 5. Visualizer code must still match the notes verbatim ─────────────────────────────
  for (const check of VERBATIM_CHECKS) {
    if (!exactCaseExists(check.file)) {
      errors.push(`The ${check.label} copies code from ${check.file}, which no longer exists. Update ${check.fix}.`);
      continue;
    }
    const note = loadNote(check.file);
    // a note must contain the code inside a fenced block; a source file (e.g. the capstone's .cs) anywhere in its text
    // (loadNote strips the BOM and splits on CRLF or LF, so line endings never cause a mismatch)
    const isNote = /\.(md|txt)$/i.test(check.file);
    const blocks = isNote ? note.fences.map((f) => note.lines.slice(f.start + 1, f.end).join('\n')) : [note.lines.join('\n')];
    if (!blocks.some((b) => b.includes(check.code))) {
      errors.push(
        `The code in the ${check.label} no longer matches ${check.file} (section "${check.heading}").\n` +
          `  Update ${check.fix} so the code panel stays truthful.`,
      );
    }
  }

  // ── 6. Assets ──────────────────────────────────────────────────────────────────────────
  for (const a of assetsManifest.assets) {
    if (!exactCaseExists(a.file)) errors.push(`_assets.yaml: file not found with this exact case: ${a.file}`);
    if (a.usedBy && !a.usedBy.startsWith('interview-prep/') && !lessonIds.has(a.usedBy)) errors.push(`_assets.yaml: ${a.file} usedBy ${a.usedBy}, which is not a lesson id`);
  }
  let assetsOut: AssetOut[] = [];
  try {
    if (write) assetsOut = await processAssets(assetsManifest.assets.filter((a) => a.publish && exactCaseExists(a.file)), repo);
  } catch (e) {
    errors.push(`assets: ${(e as Error).message}`);
  }
  const assetByFile = new Map(assetsOut.map((a) => [a.file, a]));

  // ── 7. Generate lessons ────────────────────────────────────────────────────────────────
  const falsePositives = new Set(interviewManifest.falsePositives.map((fp) => normText(fp.split(' › ').pop() ?? '')));
  // links between notes ("](1.1%20SQLServerSetup.md)") → the lesson that renders the target, else the note on GitHub
  const lessonOfFile = new Map<string, string>();
  for (const p of plans) for (const r of p.slices) if (!lessonOfFile.has(r.rel) || r.start === 0) lessonOfFile.set(r.rel, p.id);
  const resolveNoteLink = (fromRel: string, target: string): string | null => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      return null;
    }
    const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), decoded));
    const lesson = lessonOfFile.get(joined);
    if (lesson) return `lesson:${lesson}/`;
    return exactCaseExists(joined) ? githubBlobUrl(repo, joined) : null;
  };
  const titleOf = new Map(plans.map((p) => [p.id, p.lesson.title]));
  const courseTitle = new Map(courses.map((c) => [c.id, c.title]));
  const lessonCoverage: LessonCoverage[] = [];
  const lessonRecords: LessonRecord[] = [];
  const written = new Set<string>();
  const siteCourses = [];

  for (const course of courses) {
    const coursePlans = plans.filter((p) => p.course.id === course.id);
    let courseMinutes = 0;
    let courseViz = 0;
    const modules = [];
    for (const mod of course.modules) {
      const lessons = [];
      for (const plan of coursePlans.filter((p) => p.module.id === mod.id)) {
        const { lesson } = plan;
        const sourceTexts: string[] = [];
        const bodies: string[] = [];
        const interviewHeadings: string[] = [];
        const headingsForObjectives: { depth: number; text: string }[] = [];
        let recoveredCount = 0;
        const absorbed = new Set<number>();
        let sourceOffset = 0;
        for (const r of plan.slices) {
          const out = renderSlice(r, loadNote(r.rel), omitted.get(r.rel), recovered.get(r.rel), plan.inserts.get(r.rel), (t) => resolveNoteLink(r.rel, t));
          for (const k of out.absorbed) absorbed.add(sourceOffset + k);
          sourceOffset += out.source.split('\n').length + 1; // parts are joined with a blank line
          sourceTexts.push(out.source);
          bodies.push(out.body);
          recoveredCount += out.recovered;
          for (const h of loadNote(r.rel).headings) {
            if (h.line < r.start || h.line >= r.end || omitted.get(r.rel)?.has(h.line)) continue;
            headingsForObjectives.push({ depth: h.depth, text: h.text });
            if (/interview/i.test(h.text) && !falsePositives.has(normText(h.text))) interviewHeadings.push(normText(h.text));
          }
        }
        const body = bodies.join('\n\n');
        const source = sourceTexts.join('\n\n');
        const src = countMarkdown(source, absorbed);
        const gen = countMarkdown(body);
        if (gen.code !== src.code + recoveredCount) {
          errors.push(`${plan.id}: generated ${gen.code} code blocks but expected ${src.code} from the notes + ${recoveredCount} recovered`);
        }
        if (gen.tables !== src.tables) errors.push(`${plan.id}: generated ${gen.tables} tables but the notes have ${src.tables}`);
        if (gen.headings !== src.headings) errors.push(`${plan.id}: generated ${gen.headings} headings but the notes have ${src.headings}`);
        const minutes = readingMinutes(gen);
        const vizCount = lesson.place.length;
        courseMinutes += minutes;
        courseViz += vizCount;

        const resolveRef = (ref: string) => {
          if (lessonIds.has(ref)) return { id: ref, title: titleOf.get(ref)!, course: ref.split('/')[0]!, courseTitle: courseTitle.get(ref.split('/')[0]!)! };
          errors.push(`${plan.id}: related lesson ${ref} does not exist`);
          return null;
        };
        const related = lesson.related.map(resolveRef).filter((x) => x !== null);
        for (const [key, refs] of Object.entries(lesson.nodeLinks ?? {})) {
          const found = plan.slices.some((r) => loadNote(r.rel).headings.some((h) => h.line >= r.start && h.line < r.end && `${h.depth} ${normText(h.text)}` === `${parseHeadingLine(key)?.depth} ${normText(parseHeadingLine(key)?.text ?? '')}`));
          if (!found) errors.push(`${plan.id}: nodeLinks heading not found in this lesson: ${key}`);
          for (const ref of refs) if (!lessonIds.has(ref) && !moduleIds.has(ref)) errors.push(`${plan.id}: nodeLinks target does not exist: ${ref}`);
        }
        const sheets = lesson.cheatsheets.map((id) => {
          if (!sheetIds.has(id)) errors.push(`${plan.id}: unknown cheat sheet ${id}`);
          return { id, title: sheetIds.get(id) ?? id };
        });
        type ResolvedResource =
          | ({ type: 'asset' } & AssetOut)
          | { type: 'link'; url: string; title: string; from: string }
          | { type: 'tryLocally'; path: string; url: string };
        const resources = lesson.resources.flatMap((res): ResolvedResource[] => {
          if ('asset' in res) {
            const a = assetByFile.get(res.asset);
            if (!assetsManifest.assets.some((x) => x.file === res.asset)) errors.push(`${plan.id}: asset not listed in _assets.yaml: ${res.asset}`);
            return a ? [{ type: 'asset' as const, ...a }] : [];
          }
          if ('linkFrom' in res) {
            const l = linkOnly.get(res.linkFrom);
            if (!l) errors.push(`${plan.id}: linkFrom ${res.linkFrom} is not listed under linkOnly in _site.yaml`);
            return l ? [{ type: 'link' as const, url: l.url, title: l.title, from: res.linkFrom }] : [];
          }
          if (!exactCaseExists(res.tryLocally)) errors.push(`${plan.id}: tryLocally path not found: ${res.tryLocally}`);
          return [{ type: 'tryLocally' as const, path: res.tryLocally, url: githubTreeUrl(repo, res.tryLocally) }];
        });
        const objectives = lesson.objectives ?? deriveObjectives(headingsForObjectives);

        const frontmatter = {
          title: lesson.title,
          course: course.id,
          courseTitle: course.title,
          module: mod.id,
          moduleTitle: mod.title,
          lesson: lesson.id,
          kind: lesson.kind,
          order: plan.order,
          minutes,
          objectives,
          objectivesDerived: !lesson.objectives,
          sources: plan.slices.map((r) => ({ file: r.rel, lines: `${r.start + 1}-${r.end}`, url: githubBlobUrl(repo, r.rel, r.start, r.end) })),
          related,
          cheatsheets: sheets,
          resources,
          interviewHeadings,
          nodeLinks: lesson.nodeLinks ?? {},
          vizCount,
          counts: { source: pickCounts(src), generated: pickCounts(gen), recovered: recoveredCount, markers: countMarkers(source) },
        };
        const file = path.resolve(OUT_LESSONS, course.id, mod.id, `${lesson.id}.md`);
        emit(file, `---\n${YAML.stringify(frontmatter, { lineWidth: 0 })}---\n\n${body}\n`);
        written.add(file);
        lessonCoverage.push({
          id: plan.id,
          title: lesson.title,
          sources: frontmatter.sources.map((s) => `${s.file}:${s.lines}`),
          source: { headings: src.headings, code: src.code, recovered: recoveredCount, htmlAsCode: gen.htmlAsCode, tables: src.tables },
          markers: frontmatter.counts.markers,
          minutes,
        });
        lessons.push({ id: plan.id, slug: lesson.id, title: lesson.title, kind: lesson.kind, minutes, viz: vizCount });
        lessonRecords.push({ id: plan.id, slug: lesson.id, title: lesson.title, course: course.id, courseTitle: course.title, module: mod.id, kind: lesson.kind, body, slices: plan.slices });
      }
      modules.push({ id: mod.id, title: mod.title, status: mod.status ?? 'ready', noteFolder: mod.noteFolder ?? null, covers: mod.covers ?? [], lessons });
    }
    // course landing page
    const landing = landingSlices.get(course.id);
    if (landing) {
      const body = landing.map((r) => renderSlice(r, loadNote(r.rel), omitted.get(r.rel), recovered.get(r.rel), undefined).body).join('\n\n');
      const file = path.resolve(OUT_LANDING, `${course.id}.md`);
      emit(file, `---\n${YAML.stringify({ course: course.id, sources: landing.map((r) => ({ file: r.rel, url: githubBlobUrl(repo, r.rel, r.start, r.end) })) })}---\n\n${body}\n`);
      written.add(file);
    }
    for (const p of course.prerequisites) if (!COURSE_FILES.includes(p as (typeof COURSE_FILES)[number])) errors.push(`${course.id}: unknown prerequisite course ${p}`);
    const all = modules.flatMap((m) => m.lessons);
    siteCourses.push({
      id: course.id,
      title: course.title,
      shortTitle: course.shortTitle,
      kind: course.kind,
      accent: course.accent,
      icon: course.icon,
      prerequisites: course.prerequisites,
      summary: course.summary,
      hasLanding: Boolean(landing),
      lessonCount: all.length,
      minutes: courseMinutes,
      vizCount: courseViz,
      plannedModules: modules.filter((m) => m.status === 'planned').length,
      firstLesson: all[0]?.id ?? null,
      modules,
    });
  }

  for (const c of site.catalogue.order) if (!courses.some((x) => x.id === c)) errors.push(`_site.yaml catalogue: unknown course ${c}`);

  const siteData = {
    name: site.site.name,
    repo,
    catalogue: site.catalogue.order,
    suggestedPath: site.suggestedPath,
    courses: siteCourses,
    cheatsheets: cheatsheets.sheets.map((s) => ({ id: s.id, title: s.title })),
    interviewTopics: interviewManifest.topics.map((t) => ({ id: t.id, title: t.title })),
  };
  const siteFile = path.resolve(OUT_DATA, 'site.json');
  emit(siteFile, JSON.stringify(siteData, null, 2));
  written.add(siteFile);
  const assetsFile = path.resolve(OUT_DATA, 'assets.json');
  emit(assetsFile, JSON.stringify(assetsOut, null, 2));
  written.add(assetsFile);
  const interviewFile = path.resolve(OUT_DATA, 'interview-sources.json');
  emit(
    interviewFile,
    JSON.stringify(
      interviewSlices.map((r) => ({ file: r.rel, lines: `${r.start + 1}-${r.end}`, url: githubBlobUrl(repo, r.rel, r.start, r.end) })),
      null,
      2,
    ),
  );
  written.add(interviewFile);

  // ── 8. Quizzes, cheat sheets and interview questions (src/data/*, see src/data/schema.ts) ──
  const dataInput = {
    lessons: lessonRecords,
    sheetIds: cheatsheets.sheets.map((x) => ({ id: x.id, title: x.title })),
    topics: interviewManifest.topics as { id: string; title: string; subtopics?: string[]; notCoveredYet?: boolean }[],
    interviewSlices,
    omitted,
    falsePositives,
  };
  const data = checkData({ ...dataInput, errors, warnings });
  // lets `npm run data:check` re-validate src/data/* in seconds without re-running the pipeline
  const ctxFile = path.resolve(OUT_DATA, 'data-context.json');
  emit(
    ctxFile,
    JSON.stringify({
      ...dataInput,
      omitted: Object.fromEntries([...omitted].map(([k, v]) => [k, [...v]])),
      falsePositives: [...falsePositives],
    }),
  );
  written.add(ctxFile);
  for (const [name, value] of Object.entries(data.outputs)) {
    const f = path.resolve(OUT_DATA, name);
    emit(f, JSON.stringify(value, null, 1));
    written.add(f);
  }

  // ── 9. Coverage report (output counts are added by verify-output after the build) ──────
  const coverageData: CoverageData = {
    notes: noteCoverage,
    lessons: lessonCoverage,
    excluded: site.excluded,
    duplicates: site.duplicates.map((d) => ({ file: d.file, duplicateOf: d.duplicateOf, reason: d.reason })),
    linkOnly: site.linkOnly,
    interview: site.interview.map((s) => ({ file: s.file, ...(s.from ? { from: s.from } : {}), reason: s.reason ?? '' })),
    omitted: omittedReport,
    recovered: recoveredReport,
    planned: courses.flatMap((c) => c.modules.filter((m) => m.status === 'planned').map((m) => ({ id: `${c.id}/${m.id}`, title: m.title, noteFolder: m.noteFolder ?? '' }))),
    assets: assetsManifest.assets.map((a) => ({ file: a.file, publish: a.publish, mode: a.mode ?? null, credit: a.credit ?? null })),
    errors,
    warnings,
    data: data.summary,
    output: null,
  };
  const covFile = path.resolve(OUT_DATA, 'coverage.json');
  emit(covFile, JSON.stringify(coverageData, null, 2));
  written.add(covFile);
  if (write) writeCoverage(coverageData);

  // ── 10. Remove stale generated files ────────────────────────────────────────────────────
  if (write && errors.length === 0) {
    prune(OUT_LESSONS, written);
    prune(OUT_LANDING, written);
  }

  const q = data.summary;
  log(
    `content: ${plans.length} lessons from ${notes.length} notes, ${recoveredReport.length} recovered code blocks; ` +
      `quizzes ${q.quizzes.lessons}/${q.quizzes.lessons + q.quizzes.missing.length} lessons, cheat sheets ${q.cheatsheets.sheets}, ` +
      `interview ${q.interview.reduce((n, t) => n + t.notes + t.web, 0)} questions; ${errors.length} error(s), ${warnings.length} warning(s)`,
  );
  return { ok: errors.length === 0, errors, warnings, lessons: plans.length };
}

function pickCounts(c: MdCounts) {
  return { headings: c.headings, code: c.code, htmlAsCode: c.htmlAsCode, tables: c.tables, words: c.words, codeWords: c.codeWords };
}

/** "What this lesson covers": the shallowest heading level that has at least two headings. */
function deriveObjectives(headings: { depth: number; text: string }[]): string[] {
  for (let depth = 1; depth <= 4; depth++) {
    const at = headings.filter((h) => h.depth === depth).map((h) => cleanHeading(h.text)).filter(Boolean);
    if (at.length >= 2) return [...new Set(at)].slice(0, 5);
  }
  return headings.map((h) => cleanHeading(h.text)).filter(Boolean).slice(0, 5);
}

/** Proposes a ready-to-paste lesson entry for an unmapped note in a planned module's folder. */
function suggestLesson(rel: string, courses: Course[]): string {
  for (const c of courses) {
    for (const m of c.modules) {
      if (m.noteFolder && rel.startsWith(m.noteFolder + '/')) {
        const base = path.basename(rel).replace(/\.(md|txt)$/i, '');
        const slug = base.replace(/^\d+[.\s_-]*/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lesson';
        return (
          `\n  This note is in the folder of planned module ${c.id}/${m.id}. Add to curriculum/${c.id}.yaml under that module` +
          ` (and remove "status: planned"):\n      - id: ${slug}\n        title: "${base.replace(/^\d+[.\s_-]*/, '')}"\n        sources:\n          - file: "${rel}"`
        );
      }
    }
  }
  return '';
}

/**
 * Renders one slice of a note into lesson Markdown:
 * drops omitted lines, fences recovered code, shifts headings down one level (the page title is the
 * only h1), converts .txt notes lightly, and inserts visualizer placeholders.
 * Also returns the `source` text (omissions applied, nothing else) used for the source-side counts.
 */
function renderSlice(
  r: Range,
  note: Note,
  omitted: Set<number> | undefined,
  blocks: RecoveredBlock[] | undefined,
  inserts: Insertion[] | undefined,
  linkTo?: (target: string) => string | null,
): { body: string; source: string; recovered: number; absorbed: number[] } {
  const out: string[] = [];
  const source: string[] = [];
  const absorbed: number[] = [];
  let recoveredCount = 0;
  const inBlock = (i: number) => (blocks ?? []).some((b) => i >= b.start && i <= b.end);
  const starts = new Map((blocks ?? []).map((b) => [b.start, b]));
  const ends = new Set((blocks ?? []).map((b) => b.end));
  const labels = new Set((blocks ?? []).flatMap((b) => (b.labelLine !== undefined ? [b.labelLine] : [])));
  const insertAt = (line: number) => {
    for (const ins of inserts ?? []) if (ins.line === line) out.push('', ins.text, '');
  };
  let inRecovered = false;
  for (let i = r.start; i < r.end; i++) {
    insertAt(i);
    if (omitted?.has(i)) continue;
    let line = note.lines[i]!;
    if (labels.has(i) || inBlock(i)) absorbed.push(source.length);
    source.push(note.isTxt ? txtLine(note, i).source : line);
    if (labels.has(i)) continue;
    const b = starts.get(i);
    if (b) {
      out.push('```' + b.lang + ' recovered');
      inRecovered = true;
      recoveredCount++;
    }
    if (!note.inFence[i] && !inRecovered) {
      if (note.isTxt) {
        const t = txtLine(note, i);
        if (t.skip) continue;
        line = t.out;
      } else {
        const h = parseHeadingLine(line);
        if (h && h.depth < 6) line = '#'.repeat(h.depth + 1) + line.replace(/^ {0,3}#+/, '');
      }
      if (linkTo) {
        line = line.replace(/\]\(([^)\s]+?\.(?:md|txt))(#[^)\s]*)?\)/gi, (m, target: string, hash: string | undefined) => {
          if (/^[a-z]+:/i.test(target)) return m;
          const to = linkTo(target);
          return to ? `](${to}${hash ?? ''})` : m;
        });
      }
    }
    out.push(line);
    if (inRecovered && ends.has(i)) {
      out.push('```');
      inRecovered = false;
    }
  }
  if (inRecovered) out.push('```');
  insertAt(r.end);
  return { body: out.join('\n'), source: source.join('\n'), recovered: recoveredCount, absorbed };
}

/**
 * Light conversion for .txt notes: setext underlines become ATX headings (one level down), and leading
 * indentation is dropped so wrapped lines are not mistaken for indented code blocks.
 */
function txtLine(note: Note, i: number): { out: string; source: string; skip: boolean } {
  const line = note.lines[i]!;
  const next = note.lines[i + 1] ?? '';
  const isUnderline = (l: string) => /^\s*(=+|-+)\s*$/.test(l) && l.trim().length >= 3;
  if (isUnderline(line) && (note.lines[i - 1] ?? '').trim() && !isUnderline(note.lines[i - 1] ?? '')) return { out: '', source: line, skip: true };
  if (line.trim() && isUnderline(next)) {
    const depth = next.trim().startsWith('=') ? 2 : 3;
    return { out: `${'#'.repeat(depth)} ${line.trim()}`, source: `${'#'.repeat(depth - 1)} ${line.trim()}`, skip: false };
  }
  const listItem = /^\s*([-*+]|\d+[.)])\s/.test(line);
  return { out: listItem ? line : line.trimStart(), source: listItem ? line : line.trimStart(), skip: false };
}
