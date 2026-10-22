/** Turns a resolved cheat sheet (src/data/generated/cheatsheets.json) into render-ready HTML pieces. */
import GithubSlugger from 'github-slugger';
import { lessonRefUrl, type SectionRef, type Sheet, type WebSource } from './data';
import { inlineText, renderCode, renderInline } from './markdown';

export interface SourceView {
  kind: 'lesson' | 'docs';
  href: string;
  /** "Lesson title › Section" or the docs page title (tooltips, screen readers, footers). */
  label: string;
  /** What an item shows: the section heading, or the docs page title. */
  text: string;
  /** Short form for table cells. */
  short: string;
  accessed?: string;
}
export interface ItemView {
  term: string;
  desc: string | null;
  code: string | null;
  source: SourceView | null;
  filter: string;
}
export interface RowView {
  cells: string[];
  source: SourceView | null;
  filter: string;
}
export interface GroupView {
  id: string;
  title: string;
  /** The title as plain text. */
  label: string;
  note: string | null;
  items: ItemView[];
  /** `docs`: the official pages "From docs" rows cite, once each. */
  table: { columns: string[]; rows: RowView[]; from: SourceView | null; docs: SourceView[]; wide: boolean } | null;
  filter: string;
}
export interface SheetView {
  id: string;
  title: string;
  summary: string;
  groups: GroupView[];
  count: number;
  lessons: { title: string; href: string; course: string; courseTitle: string }[];
  fromDocs: number;
}

const sectionTitle = (s: string) => s.replace(/^\s*#{1,6}\s+/, '');
function lessonSource(f: SectionRef): SourceView {
  return { kind: 'lesson', href: lessonRefUrl(f, f.anchor), label: `${f.title} › ${sectionTitle(f.section)}`, text: sectionTitle(f.section), short: 'Lesson' };
}
function docsSource(d: WebSource): SourceView {
  return { kind: 'docs', href: d.url, label: d.title, text: d.title, short: 'Docs', accessed: d.accessed };
}
const norm = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).map((p) => inlineText(p!)).join(' ').toLowerCase();

const cache = new Map<string, Promise<SheetView>>();
export function prepareSheet(sheet: Sheet): Promise<SheetView> {
  let hit = cache.get(sheet.id);
  if (!hit) {
    hit = build(sheet);
    cache.set(sheet.id, hit);
  }
  return hit;
}

async function build(sheet: Sheet): Promise<SheetView> {
  const slugger = new GithubSlugger();
  // ids the layout already uses: a group called "Main" becomes #main-1
  for (const id of ['main', 'toast', 'search-dialog', 'search-input', 'search-results', 'search-open', 'theme-toggle', 'theme-label', 'cs-filter', 'cs-count', 'cs-groups', 'cs-empty']) slugger.slug(id);
  const lessons = new Map<string, { title: string; href: string; course: string; courseTitle: string }>();
  let fromDocs = 0;
  const note = (f: SectionRef | null) => {
    if (f) lessons.set(f.path, { title: f.title, href: lessonRefUrl(f), course: f.course, courseTitle: f.courseTitle });
  };
  let n = 0;
  const groups: GroupView[] = [];
  for (const g of sheet.groups) {
    const items: ItemView[] = [];
    for (const it of g.items) {
      note(it.from);
      if (it.docs) fromDocs++;
      items.push({
        term: renderInline(it.term),
        desc: it.desc ? renderInline(it.desc) : null,
        code: it.code?.trim() ? await renderCode(it.code, it.lang ?? 'text', `cs-${sheet.id}-${n++}`) : null,
        source: it.from ? lessonSource(it.from) : it.docs ? docsSource(it.docs) : null,
        filter: norm(it.term, it.desc, it.code),
      });
    }
    let table: GroupView['table'] = null;
    if (g.table) {
      note(g.table.from);
      const rows = g.table.rows.map((r) => {
        note(r.from);
        if (r.docs) fromDocs++;
        return { cells: r.cells.map((c) => renderInline(c)), source: r.docs ? docsSource(r.docs) : r.from ? lessonSource(r.from) : null, filter: norm(...r.cells) };
      });
      table = { columns: g.table.columns.map((c) => renderInline(c)), rows, from: g.table.from ? lessonSource(g.table.from) : null, docs: [...new Map(rows.filter((r) => r.source?.kind === 'docs').map((r) => [r.source!.href, r.source!])).values()], wide: g.table.columns.length >= 3 };
    }
    groups.push({ id: slugger.slug(inlineText(g.title)) || 'group', title: renderInline(g.title), label: inlineText(g.title), note: g.note ? renderInline(g.note) : null, items, table, filter: norm(g.title) });
  }
  const count = groups.reduce((s, g) => s + g.items.length + (g.table?.rows.length ?? 0), 0);
  return { id: sheet.id, title: sheet.title, summary: sheet.summary, groups, count, lessons: [...lessons.values()], fromDocs };
}
