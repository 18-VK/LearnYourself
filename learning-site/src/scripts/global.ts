/** Site-wide behaviour: theme toggle, search (Pagefind), code copy buttons, toasts. */

const base = document.body.dataset.base ?? '/';

export function toast(message: string): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(window.setTimeout(() => (el.hidden = true), 3200));
}

// ── Theme: system → light → dark ──────────────────────────────────────────────────────────
const THEMES = ['system', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];
const themeBtn = document.getElementById('theme-toggle');
const readTheme = (): Theme => {
  try {
    const t = localStorage.getItem('ly-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
};
const applyTheme = (t: Theme) => {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const label = document.getElementById('theme-label');
  if (label) label.textContent = t[0]!.toUpperCase() + t.slice(1);
  themeBtn?.setAttribute('aria-label', `Theme: ${t}. Select to change.`);
};
applyTheme(readTheme());
themeBtn?.addEventListener('click', () => {
  const next = THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length]!;
  try {
    if (next === 'system') localStorage.removeItem('ly-theme');
    else localStorage.setItem('ly-theme', next);
  } catch {
    /* ignore */
  }
  applyTheme(next);
});

// ── Copy buttons on code blocks ───────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.code-copy');
  if (!btn) return;
  const pre = btn.closest('.code-frame')?.querySelector('pre');
  if (!pre) return;
  const text = pre.innerText.replace(/\n$/, '');
  const done = (label: string) => {
    btn.textContent = label;
    window.setTimeout(() => (btn.textContent = 'Copy'), 1600);
  };
  const fallback = () => {
    const range = document.createRange();
    range.selectNodeContents(pre);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    done('Press Ctrl+C');
  };
  try {
    navigator.clipboard.writeText(text).then(() => done('Copied'), fallback);
  } catch {
    fallback();
  }
});

// ── Search (Pagefind, loaded on first use) ────────────────────────────────────────────────
interface PagefindResult {
  data: () => Promise<{ url: string; excerpt: string; meta: { title?: string } }>;
}
interface Pagefind {
  options: (o: Record<string, unknown>) => Promise<void>;
  debouncedSearch: (q: string) => Promise<{ results: PagefindResult[] } | null>;
}
let pagefind: Pagefind | null = null;
const dialog = document.getElementById('search-dialog') as HTMLDialogElement | null;
const input = document.getElementById('search-input') as HTMLInputElement | null;
const list = document.getElementById('search-results');

async function loadPagefind(): Promise<Pagefind | null> {
  if (pagefind) return pagefind;
  try {
    const path = `${base}pagefind/pagefind.js`;
    pagefind = (await import(/* @vite-ignore */ path)) as Pagefind;
    await pagefind.options({ baseUrl: base, excerptLength: 22 });
    return pagefind;
  } catch {
    return null;
  }
}
function openSearch() {
  if (!dialog || !input) return;
  dialog.showModal();
  input.focus();
  void loadPagefind();
}
document.getElementById('search-open')?.addEventListener('click', openSearch);
document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) {
    e.preventDefault();
    openSearch();
  }
});
input?.addEventListener('input', async () => {
  if (!list || !input) return;
  const q = input.value.trim();
  if (!q) {
    list.innerHTML = '';
    return;
  }
  const pf = await loadPagefind();
  if (!pf) {
    list.innerHTML = '<li class="muted" style="padding:10px 12px">Search is available on the built site (it runs on a static index generated at build time).</li>';
    return;
  }
  const res = await pf.debouncedSearch(q);
  if (!res) return; // superseded by a newer keystroke
  const items = await Promise.all(res.results.slice(0, 12).map((r) => r.data()));
  list.innerHTML = items.length
    ? items.map((d) => `<li><a href="${d.url}"><strong>${escapeHtml(d.meta.title ?? d.url)}</strong><span class="excerpt">${d.excerpt}</span></a></li>`).join('')
    : `<li class="muted" style="padding:10px 12px">No results for “${escapeHtml(q)}”.</li>`;
});
function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
