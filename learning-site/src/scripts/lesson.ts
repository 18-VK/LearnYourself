/** Lesson page behaviour. Visualizer code is only fetched when a visualizer scrolls into view. */
import { itemKeys, liText } from '../viz/roadmap/keys';
import { loadProgress, updateProgress } from './progress';

interface LessonData {
  id: string;
  title: string;
  course: string;
  courseTitle: string;
  kind: 'lesson' | 'checklist' | 'roadmap';
  courseLessons: string[];
}
const data = JSON.parse(document.getElementById('lesson-data')?.textContent ?? '{}') as LessonData;

// remember the last lesson opened
updateProgress((p) => {
  p.last = { id: data.id, title: data.title, course: data.course, courseTitle: data.courseTitle, at: Date.now() };
});

// ── Mark complete + course progress ───────────────────────────────────────────────────────
const markBtn = document.getElementById('mark-complete') as HTMLButtonElement | null;
function renderProgress() {
  const p = loadProgress();
  const done = Boolean(p.completed[data.id]);
  if (markBtn) {
    markBtn.setAttribute('aria-pressed', String(done));
    markBtn.textContent = done ? 'Completed ✓ (select to undo)' : 'Mark lesson complete';
  }
  const doneCount = data.courseLessons.filter((id) => p.completed[id]).length;
  document.querySelector<HTMLElement>('#course-progress span')?.style.setProperty('--p', `${Math.round((doneCount / data.courseLessons.length) * 100)}%`);
  const text = document.getElementById('course-progress-text');
  if (text) text.textContent = `${doneCount} of ${data.courseLessons.length} complete`;
  document.querySelectorAll<HTMLElement>('.course-nav [data-lesson-id]').forEach((li) => {
    const dot = li.querySelector('.dot');
    const id = li.dataset.lessonId ?? '';
    dot?.classList.toggle('done', Boolean(p.completed[id]));
    dot?.classList.toggle('here', id === data.id && !p.completed[id]);
  });
}
markBtn?.addEventListener('click', () => {
  updateProgress((p) => {
    if (p.completed[data.id]) delete p.completed[data.id];
    else p.completed[data.id] = Date.now();
  });
});
window.addEventListener('ly:progress', renderProgress);
renderProgress();

// ── Mobile course menu ────────────────────────────────────────────────────────────────────
const navToggle = document.getElementById('course-nav-toggle');
navToggle?.addEventListener('click', () => {
  const nav = document.getElementById('course-nav');
  const open = !nav?.classList.contains('open');
  nav?.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
});

// ── Table of contents scroll-spy + reading progress ───────────────────────────────────────
const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc a')];
if (tocLinks.length) {
  const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const link = byId.get(e.target.id);
        if (!link) continue;
        tocLinks.forEach((l) => l.removeAttribute('aria-current'));
        link.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-90px 0px -65% 0px' },
  );
  byId.forEach((_, id) => {
    const target = document.getElementById(id);
    if (target) spy.observe(target);
  });
}
const bar = document.getElementById('read-progress');
const article = document.getElementById('lesson-article');
function onScroll() {
  if (!bar || !article) return;
  const r = article.getBoundingClientRect();
  const total = Math.max(1, r.height - innerHeight * 0.5);
  bar.style.transform = `scaleX(${Math.min(1, Math.max(0, (90 - r.top) / total)).toFixed(3)})`;
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ── Persistent checklists (checklist and roadmap lessons) ─────────────────────────────────
const body = document.getElementById('lesson-body');
if (body && (data.kind === 'checklist' || data.kind === 'roadmap')) {
  // Keys come from each item's own text (src/viz/roadmap/keys.ts), the same keys the roadmap graph uses,
  // so a tick in either place is the same stored entry. Items inside visualizers are not checklist items.
  const items = [...body.querySelectorAll<HTMLLIElement>('li')].filter((li) => !li.closest('pre, .code-frame, .viz-slot'));
  const texts = items.map(liText);
  const keys = itemKeys(texts);
  const checks: HTMLInputElement[] = [];
  const saved = loadProgress().checklists[data.id] ?? {};
  items.forEach((li, i) => {
    let box = li.querySelector<HTMLInputElement>(':scope > input[type="checkbox"]');
    if (!box) {
      box = document.createElement('input');
      box.type = 'checkbox';
      li.prepend(box);
      li.style.listStyle = 'none';
      li.style.marginLeft = '-1.3em';
    }
    box.disabled = false;
    const key = keys[i]!;
    box.dataset.key = key;
    box.checked = Boolean(saved[key]);
    box.setAttribute('aria-label', texts[i]!.replace(/\s+/g, ' ').trim().slice(0, 80));
    checks.push(box);
  });
  const status = document.createElement('p');
  status.className = 'muted';
  status.style.fontSize = '14px';
  status.setAttribute('aria-live', 'polite');
  body.prepend(status);
  const renderStatus = () => {
    const n = checks.filter((c) => c.checked).length;
    status.textContent = `${n} of ${checks.length} items checked. Your ticks are saved in this browser.`;
  };
  body.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement;
    if (box.type !== 'checkbox' || !box.dataset.key) return;
    updateProgress((p) => {
      const list = (p.checklists[data.id] ??= {});
      if (box.checked) list[box.dataset.key!] = true;
      else delete list[box.dataset.key!];
    });
    renderStatus();
  });
  // ticks made in the roadmap graph (or in another tab) show up here too
  window.addEventListener('ly:progress', () => {
    const now = loadProgress().checklists[data.id] ?? {};
    for (const c of checks) c.checked = Boolean(now[c.dataset.key!]);
    renderStatus();
  });
  renderStatus();
}

// ── Visualizers: hydrate each placeholder when it approaches the viewport ─────────────────
if (document.querySelector('.viz-slot[data-viz]')) void import('./viz-loader');
