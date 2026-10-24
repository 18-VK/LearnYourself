import siteData from '../data/generated/site.json';

export type SiteData = typeof siteData;
export type CourseData = SiteData['courses'][number];
export type ModuleData = CourseData['modules'][number];
export type LessonSummary = ModuleData['lessons'][number];

export const site = siteData;

/**
 * Every internal URL goes through here so the site works under any base path
 * (/LearnYourself/ on GitHub Pages, / on a custom domain). Never hardcode a leading slash.
 */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return base + path.replace(/^\/+/, '');
}
/** Lesson ids are "course/module/lesson"; their pages live at /<id>/. */
export const lessonUrl = (id: string): string => url(`${id}/`);
export const courseUrl = (id: string): string => url(`${id}/`);

export const courses: CourseData[] = site.courses;
export function courseById(id: string): CourseData {
  const c = courses.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown course ${id}`);
  return c;
}
export const lessonsOf = (c: CourseData): LessonSummary[] => c.modules.flatMap((m) => m.lessons);

/** Short glyphs shown in the course tiles (text, so no icon font or image requests). */
export const GLYPH: Record<string, string> = {
  'phase-1': 'C#',
  desktop: 'WPF',
  'phase-2': 'API',
  'sql-server': 'SQL',
  dsa: 'O(n)',
  math: '∑',
  'backend-roadmap': '↗',
  'git-github': 'git',
};

export function readingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `≈ ${h < 10 ? h.toFixed(1) : Math.round(h)} h`;
}

export function courseMeta(c: CourseData): string {
  const ready = c.modules.filter((m) => m.status !== 'planned').length;
  const parts = [`${ready} module${ready === 1 ? '' : 's'}`, `${c.lessonCount} ${c.kind === 'roadmap' ? 'checklists' : 'lessons'}`];
  if (c.kind === 'course' && c.lessonCount > 4) parts.push(`${readingTime(c.minutes)} reading`);
  if (c.plannedModules) parts.push(`${c.plannedModules} topic modules coming`);
  return parts.join(' · ');
}
