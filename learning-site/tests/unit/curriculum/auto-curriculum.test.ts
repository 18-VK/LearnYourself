import { describe, expect, it } from 'vitest';
import { compareNumbers, humanize, matchesGlob, MAX_LESSON_WORDS, numberOf, partTitle, reconcileCurriculum, slugify, splitNote, type NoteSource } from '../../../scripts/lib/auto-curriculum';
import { parseNote, type Note } from '../../../scripts/lib/notes';
import type { Course, ManifestLesson, ManifestModule, SiteManifest } from '../../../scripts/lib/schema';

// ── a small repo in memory ────────────────────────────────────────────────────────────────

const para = (words: number) => Array.from({ length: words }, (_, i) => `word${i}`).join(' ');
/** A note with enough text to count as one. */
const textOf = (title: string, extra = '') => `# ${title}\n\n${para(40)} ${slugify(title)}\n${extra}`;

function repo(files: Record<string, string>, projects: string[] = []): NoteSource {
  const cache = new Map<string, Note>();
  return {
    exists: (rel) => rel in files,
    load: (rel) => cache.get(rel) ?? cache.set(rel, parseNote(rel, files[rel]!)).get(rel)!,
    inProject: (rel) => projects.some((p) => rel.startsWith(`${p}/`)),
  };
}
const lesson = (id: string, file: string, extra: Partial<ManifestLesson['sources'][number]> = {}, title = id): ManifestLesson => ({
  id,
  title,
  kind: 'lesson',
  sources: [{ file, ...extra }],
  place: [],
  related: [],
  cheatsheets: [],
  resources: [],
});
const mod = (id: string, lessons: ManifestLesson[], extra: Partial<ManifestModule> = {}): ManifestModule => ({ id, title: extra.title ?? id, lessons, ...extra });
const course = (id: string, modules: ManifestModule[]): Course => ({ id, title: id, shortTitle: id, kind: 'course', accent: 'x', icon: 'x', prerequisites: [], summary: 's', modules });
const site = (over: Partial<SiteManifest> = {}): SiteManifest => ({
  site: { name: 'n', repo: 'https://example.com/r' },
  catalogue: { order: ['alpha'] },
  suggestedPath: { main: ['alpha'], parallel: [], branches: [] },
  topNav: [],
  interview: [],
  duplicates: [],
  linkOnly: [],
  excluded: [],
  ignore: [],
  autoExclude: [],
  publishAnyway: [],
  recoverUnfencedCode: [],
  omitLines: [],
  ...over,
});
function run(files: Record<string, string>, courses: Course[], s = site(), projects: string[] = []) {
  const warnings: string[] = [];
  const result = reconcileCurriculum({ courses, site: s, notes: Object.keys(files), warnings, source: repo(files, projects) });
  return { ...result, warnings, courses, site: s };
}
const idsIn = (c: Course | undefined, moduleId: string) => c?.modules.find((m) => m.id === moduleId)?.lessons.map((l) => l.id);

// ── helpers ───────────────────────────────────────────────────────────────────────────────

describe('names and numbers', () => {
  it('reads the numbering styles the notes use', () => {
    expect(numberOf('12.1.ASP_Cookies.md')).toEqual([12, 1]);
    expect(numberOf('01-1_backend.md')).toEqual([1, 1]);
    expect(numberOf('17..C#_Threads')).toEqual([17]);
    expect(numberOf('health-checks.md')).toBeNull();
  });
  it('orders 12 before 12.1 before 13', () => {
    const sorted = [[13], [12, 1], [12]].sort(compareNumbers);
    expect(sorted).toEqual([[12], [12, 1], [13]]);
  });
  it('turns file names into titles and URL-safe ids', () => {
    expect(humanize('01_Http_TCP-IP_andMore')).toBe('Http TCP-IP and More');
    expect(humanize('1.C#_Basics')).toBe('C# Basics');
    expect(slugify('C# & .NET Basics')).toBe('csharp-dotnet-basics');
    expect(slugify('load-balancer vs reverse-proxy')).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
  it('matches globs without caring about case', () => {
    expect(matchesGlob('**/logs/**', 'Phase2/Api/Logs/log-1.txt')).toBe(true);
    expect(matchesGlob('**/.*/**', '.claude/skills/x.md')).toBe(true);
    expect(matchesGlob('**/.*/**', 'Phase1/1.C#_Basics/Note.md')).toBe(false);
    expect(matchesGlob('InterviewPrep/**', 'InterviewPrep/InterviewPrep/Intro/a.txt')).toBe(true);
    expect(matchesGlob('**/*.private.md', 'A/b.private.md')).toBe(true);
    expect(matchesGlob('**/*.private.md', 'A/b.md')).toBe(false);
  });
});

// ── a new note ────────────────────────────────────────────────────────────────────────────

describe('a new note in a folder the site already knows', () => {
  const base = () => ({ 'P/Topic/1.A.md': textOf('A'), 'P/Topic/3.C.md': textOf('C') });
  const courses = () => [course('alpha', [mod('one', [lesson('a', 'P/Topic/1.A.md'), lesson('c', 'P/Topic/3.C.md')])])];

  it('extends that section, in number order', () => {
    const r = run({ ...base(), 'P/Topic/2.B.md': textOf('B') }, courses());
    expect(idsIn(r.courses[0], 'one')).toEqual(['a', 'b', 'c']);
    expect(r.placed[0]).toMatchObject({ file: 'P/Topic/2.B.md', created: null });
    expect(r.courses[0]!.modules).toHaveLength(1);
  });

  it('goes after the note it follows when it is a sub-number', () => {
    const r = run({ ...base(), 'P/Topic/1.1.Extra.md': textOf('Extra') }, courses());
    expect(idsIn(r.courses[0], 'one')).toEqual(['a', 'extra', 'c']);
  });

  it('takes its title from its heading, and its text in full', () => {
    const r = run({ ...base(), 'P/Topic/2.B.md': textOf('What B really is') }, courses());
    const added = r.courses[0]!.modules[0]!.lessons[1]!;
    expect(added.title).toBe('What B really is');
    expect(added.sources[0]!.range).toEqual([0, 3]);
  });

  it('follows the nearest number when a folder feeds several sections', () => {
    const r = run(
      { 'P/1.A.md': textOf('A'), 'P/5.E.md': textOf('E'), 'P/9.I.md': textOf('I'), 'P/6.F.md': textOf('F') },
      [course('alpha', [mod('early', [lesson('a', 'P/1.A.md'), lesson('e', 'P/5.E.md')]), mod('late', [lesson('i', 'P/9.I.md')])])],
    );
    expect(idsIn(r.courses[0], 'early')).toEqual(['a', 'e', 'f']);
    expect(r.placed[0]!.why).toContain('5.E.md');
  });

  it('uses the title when it has no number', () => {
    const r = run(
      { 'P/1.A.md': textOf('A'), 'P/9.I.md': textOf('I'), 'P/health-checks.md': textOf('Health Checks for a Production API') },
      [course('alpha', [mod('basics', [lesson('a', 'P/1.A.md')]), mod('production-concerns', [lesson('i', 'P/9.I.md')], { title: 'Rate limiting' })])],
    );
    expect(idsIn(r.courses[0], 'production-concerns')).toEqual(['i', 'health-checks']);
  });

  it('goes to a More notes section when nothing says where it belongs', () => {
    const r = run(
      { 'P/1.A.md': textOf('A'), 'P/9.I.md': textOf('I'), 'P/gardening.md': textOf('Gardening') },
      [course('alpha', [mod('basics', [lesson('a', 'P/1.A.md')]), mod('later', [lesson('i', 'P/9.I.md')])])],
    );
    expect(idsIn(r.courses[0], 'more-notes')).toEqual(['gardening']);
    expect(r.placed[0]!.created).toBe('section');
  });
});

describe('a new folder', () => {
  it('becomes a new section in the course that owns the parent, in folder-number order', () => {
    const r = run(
      { 'P/1.Basics/A.md': textOf('A'), 'P/5.Later/B.md': textOf('B'), 'P/3.Middle/C.md': textOf('C'), 'P/3.Middle/D.md': textOf('D') },
      [course('alpha', [mod('basics', [lesson('a', 'P/1.Basics/A.md')]), mod('later', [lesson('b', 'P/5.Later/B.md')])])],
    );
    expect(r.courses[0]!.modules.map((m) => m.id)).toEqual(['basics', 'middle', 'later']);
    expect(idsIn(r.courses[0], 'middle')).toEqual(['c', 'd']); // the second note extends the section the first one made
    expect(r.placed.map((p) => p.created)).toEqual(['section', null]);
    expect(r.courses[0]!.modules[1]!.title).toBe('Middle');
  });

  it('goes before sections still waiting for notes', () => {
    const r = run(
      { 'P/A.md': textOf('A'), 'P/Notes/B.md': textOf('B') },
      [course('alpha', [mod('first', [lesson('a', 'P/A.md')]), mod('soon', [], { status: 'planned', noteFolder: 'P/1.Soon' })])],
    );
    expect(r.courses[0]!.modules.map((m) => m.id)).toEqual(['first', 'notes', 'soon']);
    expect(r.courses[0]!.modules[1]!.title).toBe('alpha notes'); // "Notes" alone says nothing in a sidebar
  });

  it('fills a planned section that names it, which then stops being planned', () => {
    const r = run(
      { 'P/A.md': textOf('A'), 'P/1.Caching/2.Redis.md': textOf('Redis') },
      [course('alpha', [mod('first', [lesson('a', 'P/A.md')]), mod('caching', [], { status: 'planned', noteFolder: 'P/1.Caching' })])],
    );
    const caching = r.courses[0]!.modules.find((m) => m.id === 'caching')!;
    expect(caching.status).toBeUndefined();
    expect(caching.lessons.map((l) => l.id)).toEqual(['redis']);
  });

  it('lets noteFolder choose the section for a folder', () => {
    const r = run(
      { 'P/A.md': textOf('A'), 'Q/Z.md': textOf('Z'), 'Elsewhere/Sub/B.md': textOf('B') },
      [course('alpha', [mod('first', [lesson('a', 'P/A.md')]), mod('chosen', [lesson('z', 'Q/Z.md')], { noteFolder: 'Elsewhere' })])],
    );
    expect(idsIn(r.courses[0], 'chosen')).toEqual(['z', 'b']);
    expect(r.courses).toHaveLength(1);
  });
});

describe('a new top-level folder', () => {
  it("doesn't call a section \"Docker Notes notes\"", () => {
    const r = run({ 'P/A.md': textOf('A'), 'Docker Notes/x.md': textOf('X') }, [course('alpha', [mod('first', [lesson('a', 'P/A.md')])])]);
    expect(r.courses.find((c) => c.id === 'docker-notes')!.modules[0]!.title).toBe('Docker Notes');
  });

  it('becomes a new course, with a section per sub-folder, shown on the home page', () => {
    const r = run(
      { 'P/A.md': textOf('A'), 'Docker/Intro to images.md': textOf('Images'), 'Docker/Compose/1.Basics.md': textOf('Compose basics') },
      [course('alpha', [mod('first', [lesson('a', 'P/A.md')])])],
    );
    const docker = r.courses.find((c) => c.id === 'docker')!;
    expect(docker.title).toBe('Docker');
    expect(docker.modules.map((m) => m.id).sort()).toEqual(['compose', 'docker']);
    expect(r.site.catalogue.order).toEqual(['alpha', 'docker']);
    expect(r.site.suggestedPath.branches.map((b) => b.course)).toEqual(['docker']);
    expect(r.placed.filter((p) => p.created === 'course')).toHaveLength(1);
  });

  it('gives a note the same section whether or not a sub-folder exists beside it', () => {
    const courses = () => [course('alpha', [mod('first', [lesson('a', 'P/A.md')])])];
    const before = run({ 'P/A.md': textOf('A'), 'Docker/images.md': textOf('Images') }, courses());
    const after = run({ 'P/A.md': textOf('A'), 'Docker/images.md': textOf('Images'), 'Docker/Compose/x.md': textOf('Compose') }, courses());
    const url = (r: typeof before) => r.placed.find((p) => p.file === 'Docker/images.md')!.lessons[0];
    expect(url(after)).toBe(url(before));
  });

  it("can't take over a page of the site", () => {
    const r = run({ 'P/A.md': textOf('A'), 'Review/X.md': textOf('X') }, [course('alpha', [mod('first', [lesson('a', 'P/A.md')])])]);
    expect(r.courses.map((c) => c.id)).toEqual(['alpha', 'review-notes']);
  });

  it('puts a note at the repo root in a general course', () => {
    const r = run({ 'P/A.md': textOf('A'), 'Loose.md': textOf('Loose') }, [course('alpha', [mod('first', [lesson('a', 'P/A.md')])])]);
    expect(idsIn(r.courses.find((c) => c.id === 'more-notes'), 'general')).toEqual(['loose']);
  });
});

describe('lesson ids', () => {
  it('stay unique across courses, and say something for generic file names', () => {
    const r = run(
      { 'P/A.md': textOf('A'), 'P/Foo/Note.md': textOf('Foo note'), 'P/Bar/Note.md': textOf('Bar note'), 'P/Foo/a.md': textOf('Other A') },
      [course('alpha', [mod('first', [lesson('a', 'P/A.md')])])],
    );
    const ids = r.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('foo-note');
    expect(ids).toContain('bar-note');
    expect(ids).toContain('foo-a');
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});

// ── long notes ────────────────────────────────────────────────────────────────────────────

describe('a long note', () => {
  const section = (title: string, words = 1500) => `## ${title}\n\n${para(words)}\n`;
  const long = `# Big note\n\nIntro text.\n\n${['One', 'Two', 'Three', 'Four', 'Five'].map((t) => section(t)).join('\n')}`;

  it('stays one lesson up to the limit', () => {
    expect(splitNote(parseNote('x.md', `# T\n\n${para(MAX_LESSON_WORDS - 10)}`))).toHaveLength(1);
  });

  it('is split at its headings, and the parts tile the whole note', () => {
    const note = parseNote('x.md', long);
    const parts = splitNote(note);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]!.start).toBe(0);
    expect(parts.at(-1)!.end).toBe(note.lines.length);
    parts.forEach((p, i) => {
      if (i) {
        expect(p.start).toBe(parts[i - 1]!.end);
        expect(note.lines[p.start]).toMatch(/^#/);
      }
    });
  });

  it('never splits inside a code block', () => {
    const fenced = `# Big\n\n${para(1900)}\n\n\`\`\`bash\n# not a heading\n${para(1900)}\n\`\`\`\n\n## Real\n\n${para(1900)}\n`;
    const note = parseNote('x.md', fenced);
    for (const p of splitNote(note)) expect(note.inFence[p.start]).toBe(false);
    expect(splitNote(note).map((p) => note.lines[p.start])).not.toContain('# not a heading');
  });

  it('becomes several lessons in one section, each titled by its heading', () => {
    const r = run({ 'P/A.md': textOf('A'), 'P/Big.md': long }, [course('alpha', [mod('first', [lesson('a', 'P/A.md')])])]);
    const added = r.courses[0]!.modules[0]!.lessons.slice(1);
    expect(added.length).toBeGreaterThan(1);
    expect(added[0]!.title).toBe('Big note');
    expect(added[1]!.title).toMatch(/^(One|Two|Three|Four|Five)$/);
    expect(new Set(added.map((l) => l.id)).size).toBe(added.length);
  });

  it('names a repeated heading after the section above it', () => {
    const note = parseNote('x.md', '# T\n\n## HTTP\n\n### Interview questions\n\n## DNS\n\n### Interview questions\n\n## Plain\n');
    expect(partTitle(note, note.headings[2]!.line)).toBe('HTTP: Interview questions');
    expect(partTitle(note, note.headings[4]!.line)).toBe('DNS: Interview questions');
    expect(partTitle(note, note.headings[5]!.line)).toBe('Plain');
  });
});

// ── what must not become a lesson ─────────────────────────────────────────────────────────

describe('notes that stay off the public site', () => {
  const courses = () => [course('alpha', [mod('first', [lesson('a', 'P/A.md')])])];
  const lessonsOf = (r: { courses: Course[] }) => r.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));

  it('a byte-for-byte copy, or a reformatted one, is a duplicate', () => {
    const r = run({ 'P/A.md': textOf('A'), 'P/A copy.md': textOf('A'), 'Q/Moved.md': textOf('A').replace('# A', '## A') }, courses());
    expect(lessonsOf(r)).toEqual(['a']);
    expect(r.site.duplicates.map((d) => [d.file, d.duplicateOf])).toEqual([
      ['P/A copy.md', 'P/A.md'],
      ['Q/Moved.md', 'P/A.md'],
    ]);
  });

  it('a copy that has its own lines is a note, so nothing is lost', () => {
    const r = run({ 'P/A.md': textOf('A'), 'P/A2.md': textOf('A', 'A brand new paragraph.') }, courses());
    expect(lessonsOf(r)).toContain('a2');
  });

  it('autoExclude patterns win, and copying an excluded note does not publish it', () => {
    const s = site({ autoExclude: [{ pattern: 'InterviewPrep/**', reason: 'personal' }] });
    const r = run({ 'P/A.md': textOf('A'), 'InterviewPrep/plan.md': textOf('My plan'), 'P/my-plan.md': textOf('My plan') }, courses(), s);
    expect(lessonsOf(r)).toEqual(['a']);
    expect(r.site.excluded.map((x) => x.file).sort()).toEqual(['InterviewPrep/plan.md', 'P/my-plan.md']);
  });

  it('a placeholder is left out until it has content', () => {
    const r = run({ 'P/A.md': textOf('A'), 'P/todo.md': '# Todo\n\nwrite this\n', 'P/empty.md': '' }, courses());
    expect(lessonsOf(r)).toEqual(['a']);
    expect(r.site.excluded.map((x) => x.file).sort()).toEqual(['P/empty.md', 'P/todo.md']);
  });

  it('a .txt file inside a project is project data, but a .txt note elsewhere is a note', () => {
    const r = run(
      { 'P/A.md': textOf('A'), 'P/App/sample.txt': `${para(40)} sample`, 'P/LICENSE.txt': `${para(40)} license`, 'P/ideas.txt': `${para(40)} ideas` },
      courses(),
      site(),
      ['P/App'],
    );
    expect(lessonsOf(r)).toEqual(['a', 'ideas']);
  });

  it.each([
    ['a real email address', 'write to someone.real@gmail.com today'],
    ['a user profile path', 'stored in C:\\Users\\amanp\\keys\\key.pem'],
    ['a machine name', 'Server=LAPTOP-0DCLBA10\\SQLEXPRESS;'],
    ['a private key', '-----BEGIN RSA PRIVATE KEY-----'],
    ['a real-looking password', 'Server=x;Password=Tr0ub4dor&3;'],
  ])('%s holds a new note back and says where', (_label, line) => {
    const r = run({ 'P/A.md': textOf('A'), 'P/secret.md': textOf('Secret', `\n${line}\n`) }, courses());
    expect(lessonsOf(r)).toEqual(['a']);
    expect(r.site.excluded[0]!.file).toBe('P/secret.md');
    expect(r.warnings.join()).toMatch(/P\/secret\.md was NOT published.*line 5/);
  });

  it.each([
    ['a sample password', 'Server=x;Password=Strong@123;'],
    ['a demo address', 'login as a@x.com or user@example.com'],
    ['a default instance', 'Server=.\\SQLEXPRESS;'],
    ['a placeholder path', 'C:\\Users\\YourName\\project'],
  ])('%s does not', (_label, line) => {
    const r = run({ 'P/A.md': textOf('A'), 'P/fine.md': textOf('Fine', `\n${line}\n`) }, courses());
    expect(lessonsOf(r)).toEqual(['a', 'fine']);
  });

  it("drops an exported document's author line from a new note, but keeps the same words elsewhere", () => {
    const text = `# Roadmap\n\nOct 24, 2026 · @Some Author\n\n${para(40)}\n\nOct 24, 2026 was the day @x said so, far down the note.\n`;
    const r = run({ 'P/A.md': textOf('A'), 'P/road.md': text }, courses());
    expect(lessonsOf(r)).toEqual(['a', 'road']);
    expect(r.site.omitLines).toEqual([{ file: 'P/road.md', startsWith: 'Oct 24, 2026 · @Some Author' }]);
  });

  it('publishAnyway releases a note the owner has checked', () => {
    const s = site({ publishAnyway: [{ file: 'P/ok.md', reason: 'sample address' }] });
    const r = run({ 'P/A.md': textOf('A'), 'P/ok.md': textOf('Ok', 'mail me at real.person@gmail.com') }, courses(), s);
    expect(lessonsOf(r)).toEqual(['a', 'ok']);
  });
});

// ── notes changing underneath the manifests ───────────────────────────────────────────────

describe('a note that was renamed or moved', () => {
  it('keeps its lessons, so URLs and quizzes survive', () => {
    const c = [course('alpha', [mod('first', [lesson('stable-id', 'P/old-name.md')])])];
    const r = run({ 'P/01_old-name.md': textOf('A') }, c);
    expect(r.placed).toEqual([]);
    expect(r.courses[0]!.modules[0]!.lessons[0]!.sources[0]!.file).toBe('P/01_old-name.md');
    expect(r.renames.get('P/old-name.md')).toBe('P/01_old-name.md');
  });

  it('is followed to a new folder, and by its site-level entries', () => {
    const s = site({ omitLines: [{ file: 'P/a.md', startsWith: 'x' }], recoverUnfencedCode: [{ file: 'P/a.md' }] });
    const c = [course('alpha', [mod('first', [lesson('a', 'P/a.md')])])];
    const r = run({ 'Q/a.md': textOf('A') }, c, s);
    expect(r.courses[0]!.modules[0]!.lessons[0]!.sources[0]!.file).toBe('Q/a.md');
    expect(r.site.omitLines[0]!.file).toBe('Q/a.md');
    expect(r.site.recoverUnfencedCode[0]!.file).toBe('Q/a.md');
  });

  it('is recognised by its headings even under a new name', () => {
    const text = '# T\n\n## Alpha section\n\n' + para(30) + '\n\n## Beta section\n\n' + para(30) + '\n\n## Gamma section\n\n' + para(30);
    const c = [course('alpha', [mod('first', [lesson('one', 'P/old.md', { until: '## Beta section' }), lesson('two', 'P/old.md', { from: '## Beta section', until: '## Gamma section' })])])];
    const r = run({ 'P/totally-new.md': text }, c);
    expect(r.placed).toEqual([]);
    expect(r.courses[0]!.modules[0]!.lessons.map((l) => l.sources[0]!.file)).toEqual(['P/totally-new.md', 'P/totally-new.md']);
  });

  it('is followed when its whole folder moved, even if a copy of it exists elsewhere', () => {
    const c = [course('alpha', [mod('m', [lesson('one', 'Old/One.md'), lesson('two', 'Old/Two.md')])])];
    const r = run({ 'New/One.md': textOf('One'), 'New/Two.md': textOf('Two'), 'Else/Two.md': textOf('Two') }, c);
    expect(r.courses[0]!.modules[0]!.lessons.map((l) => l.sources[0]!.file)).toEqual(['New/One.md', 'New/Two.md']);
    expect(r.site.duplicates.map((d) => d.file)).toEqual(['Else/Two.md']);
    expect(r.followPath('Old/Sub/data.pdf')).toBe('Old/Sub/data.pdf'); // nothing there: the old path stands
    expect(r.followPath('Old/Two.md')).toBe('New/Two.md');
  });

  it('carries the paths of a lesson\'s other files along with a moved folder', () => {
    const l = lesson('one', 'Old/One.md');
    l.resources = [{ tryLocally: 'Old/Practice' }];
    const source = repo({ 'New/One.md': textOf('One'), 'New/Practice': '' });
    const r = reconcileCurriculum({ courses: [course('alpha', [mod('m', [l])])], site: site(), notes: ['New/One.md'], warnings: [], source });
    expect(l.resources[0]).toEqual({ tryLocally: 'New/Practice' });
    expect(r.followPath('Old/Practice')).toBe('New/Practice');
  });

  it('is not confused with an unrelated note of the same generic name elsewhere', () => {
    const c = [course('alpha', [mod('first', [lesson('a', 'A/Note.md')]), mod('second', [lesson('k', 'K/Keep.md')])])];
    const r = run({ 'K/Keep.md': textOf('Keep'), 'B/Note.md': textOf('Something else') }, c);
    expect(r.renames.size).toBe(0);
    expect(r.courses[0]!.modules.flatMap((m) => m.lessons.map((l) => l.id))).not.toContain('a');
    expect(r.placed[0]!.file).toBe('B/Note.md');
  });

  it('that is simply gone loses its lesson, with a warning', () => {
    const c = [course('alpha', [mod('first', [lesson('a', 'P/A.md'), lesson('gone', 'P/Gone.md')])])];
    const r = run({ 'P/A.md': textOf('A') }, c);
    expect(idsIn(r.courses[0], 'first')).toEqual(['a']);
    expect(r.warnings.join()).toContain('P/Gone.md is gone');
    expect(r.warnings.join()).toContain('Lesson alpha/first/gone has no text left');
  });
});

describe('a note that changed inside', () => {
  const text = (h2: string, h3: string) => `# T\n\nIntro.\n\n## ${h2}\n\nOne.\n\n## ${h3}\n\nTwo.\n`;
  const twoLessons = () => [course('alpha', [mod('m', [lesson('first', 'P/n.md', { until: '## Alpha section' }), lesson('second', 'P/n.md', { from: '## Alpha section', until: '## Beta section' }), lesson('third', 'P/n.md', { from: '## Beta section' })])])];
  const ranges = (r: { courses: Course[] }) => r.courses[0]!.modules[0]!.lessons.map((l) => [l.id, l.sources[0]!.range]);

  it('needs nothing when a section grows', () => {
    const r = run({ 'P/n.md': `# T\n\nIntro.\n\n## Alpha section\n\nOne.\n\nMore text.\n\n### New sub-section\n\nEven more.\n\n## Beta section\n\nTwo.\n` }, twoLessons());
    expect(r.warnings).toEqual([]);
    expect(ranges(r).map((x) => x[0])).toEqual(['first', 'second', 'third']);
  });

  it('follows a renumbered or reworded heading', () => {
    const r = run({ 'P/n.md': text('2. Alpha section', 'Beta section explained') }, twoLessons());
    expect(ranges(r)).toEqual([
      ['first', [0, 4]],
      ['second', [4, 8]],
      ['third', [8, 11]],
    ]);
    expect(r.warnings.join()).toContain('followed it');
  });

  it('recognises a section that only gained words', () => {
    const c = [course('alpha', [mod('m', [lesson('a', 'P/n.md', { until: '## 5. git add' }), lesson('b', 'P/n.md', { from: '## 5. git add', until: '## 6. git commit' }), lesson('c', 'P/n.md', { from: '## 6. git commit' })])])];
    const r = run({ 'P/n.md': '# T\n\n## 5. The git add command\n\nOne.\n\n## 6. git commit\n\nTwo.\n' }, c);
    expect(r.courses[0]!.modules[0]!.lessons.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps a numbered section by its number when it was reworded completely', () => {
    const c = [course('alpha', [mod('m', [lesson('a', 'P/n.md', { until: '## 12. Common mistakes' }), lesson('b', 'P/n.md', { from: '## 12. Common mistakes' })])])];
    const r = run({ 'P/n.md': '# T\n\n## 11. Before\n\nOne.\n\n## 12. Something else entirely\n\nTwo.\n' }, c);
    expect(r.courses[0]!.modules[0]!.lessons.map((l) => [l.id, l.sources[0]!.range])).toEqual([
      ['a', [0, 6]],
      ['b', [6, 9]],
    ]);
  });

  it('does not mistake a different section for a renamed one', () => {
    const c = [course('alpha', [mod('m', [lesson('a', 'P/n.md', { until: '## Merge sort' }), lesson('b', 'P/n.md', { from: '## Merge sort' })])])];
    const r = run({ 'P/n.md': '# T\n\nIntro.\n\n## Heap sort\n\nOne.\n' }, c);
    expect(r.courses[0]!.modules[0]!.lessons.map((l) => l.id)).toEqual(['a']);
    expect(r.courses[0]!.modules[0]!.lessons[0]!.sources[0]!.range).toEqual([0, 7]);
  });

  it('gives the text of a removed heading to the lesson before it, losing nothing', () => {
    const r = run({ 'P/n.md': '# T\n\nIntro.\n\n## Unrelated words here\n\nOne.\n\n## Beta section\n\nTwo.\n' }, twoLessons());
    expect(ranges(r)).toEqual([
      ['first', [0, 8]],
      ['third', [8, 11]],
    ]);
    expect(r.warnings.join()).toContain('Lesson alpha/m/second has no text left');
  });

  it('claims text added above the first heading', () => {
    const c = [course('alpha', [mod('m', [lesson('only', 'P/n.md', { from: '# T' })])])];
    const r = run({ 'P/n.md': 'A new first line.\n\n# T\n\nBody.\n' }, c);
    expect(r.courses[0]!.modules[0]!.lessons[0]!.sources[0]!.range).toEqual([0, 5]);
  });

  it('still covers every line when sections swap order', () => {
    const r = run({ 'P/n.md': '# T\n\nIntro.\n\n## Beta section\n\nTwo.\n\n## Alpha section\n\nOne.\n' }, twoLessons());
    const all = ranges(r).map((x) => x[1] as [number, number]).sort((a, b) => a[0] - b[0]);
    expect(all[0]![0]).toBe(0);
    expect(all.at(-1)![1]).toBe(11);
    all.forEach((x, i) => {
      if (i) expect(x[0]).toBe(all[i - 1]![1]);
    });
  });

  it('removes a section left empty by a deleted note, but keeps a planned one', () => {
    const c = [course('alpha', [mod('m', [lesson('a', 'P/A.md')]), mod('dead', [lesson('d', 'P/D.md')]), mod('soon', [], { status: 'planned' })])];
    const r = run({ 'P/A.md': textOf('A') }, c);
    expect(r.courses[0]!.modules.map((m) => m.id)).toEqual(['m', 'soon']);
  });
});

describe('site-level lists', () => {
  const courses = () => [course('alpha', [mod('first', [lesson('a', 'P/A.md')])])];

  it('a duplicate that has grown new content gets its own lesson', () => {
    const s = site({ duplicates: [{ file: 'P/copy.md', duplicateOf: 'P/A.md', check: 'formatting-insensitive', reason: 'r' }] });
    const r = run({ 'P/A.md': textOf('A'), 'P/copy.md': textOf('A', 'Something the original does not say.') }, courses(), s);
    expect(r.site.duplicates).toEqual([]);
    expect(idsIn(r.courses[0], 'first')).toContain('copy');
    expect(r.warnings.join()).toContain('no longer a copy');
  });

  it('entries for deleted files just go away', () => {
    const s = site({
      duplicates: [{ file: 'P/gone copy.md', duplicateOf: 'P/A.md', check: 'formatting-insensitive', reason: 'r' }],
      excluded: [{ file: 'P/gone.md', reason: 'r' }],
      linkOnly: [{ file: 'P/gone-link.md', usedBy: 'alpha/first/a', reason: 'r' }],
    });
    const r = run({ 'P/A.md': textOf('A') }, courses(), s);
    expect([r.site.duplicates, r.site.excluded, r.site.linkOnly]).toEqual([[], [], []]);
    expect(r.warnings).toEqual([]);
  });

  it('a renamed excluded note stays excluded', () => {
    const s = site({ excluded: [{ file: 'P/my plan.md', reason: 'personal' }] });
    const r = run({ 'P/A.md': textOf('A'), 'P/01_my plan.md': textOf('Plan') }, courses(), s);
    expect(r.site.excluded).toEqual([{ file: 'P/01_my plan.md', reason: 'personal' }]);
    expect(idsIn(r.courses[0], 'first')).toEqual(['a']);
  });

  it('the catalogue and home page drop a course that is gone', () => {
    const s = site({ catalogue: { order: ['alpha', 'gone'] }, suggestedPath: { main: ['alpha', 'gone'], parallel: [{ course: 'gone', alongside: ['alpha'], note: 'n' }], branches: [{ course: 'gone', after: 'alpha', note: 'n' }] } });
    const r = run({ 'P/A.md': textOf('A') }, courses(), s);
    expect(r.site.catalogue.order).toEqual(['alpha']);
    expect(r.site.suggestedPath).toEqual({ main: ['alpha'], parallel: [], branches: [] });
  });
});

describe('a note the manifests map by hand', () => {
  it('is left exactly where the manifest puts it, even in a folder with a different section', () => {
    const c = [course('alpha', [mod('chosen', [lesson('pinned', 'P/Other/B.md', {}, 'My own title')]), mod('m', [lesson('a', 'P/A.md')])])];
    const r = run({ 'P/A.md': textOf('A'), 'P/Other/B.md': textOf('Heading in the note') }, c);
    expect(r.placed).toEqual([]);
    expect(r.courses[0]!.modules[0]!.lessons[0]).toMatchObject({ id: 'pinned', title: 'My own title' });
  });
});
