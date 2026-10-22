/**
 * Cheat sheet filter: narrows items and table rows as you type (every word must match), hides groups with
 * nothing left, and reports "n of m items". Esc clears. ?q=… pre-fills it. Printing always shows everything.
 */
const input = document.getElementById('cs-filter') as HTMLInputElement | null;
const count = document.getElementById('cs-count');
const empty = document.getElementById('cs-empty');
const groups = [...document.querySelectorAll<HTMLElement>('.cs-group')];
const total = Number(count?.dataset.total ?? 0);

function apply(raw: string) {
  const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (text: string) => words.every((w) => text.includes(w));
  let shown = 0;
  for (const g of groups) {
    const whole = words.length > 0 && hit(g.dataset.filterTitle ?? '');
    let inGroup = 0;
    g.querySelectorAll<HTMLElement>('[data-filter]').forEach((el) => {
      const on = !words.length || whole || hit(el.dataset.filter ?? '');
      el.classList.toggle('is-filtered-out', !on);
      if (on) inGroup++;
    });
    const table = g.querySelector<HTMLElement>('[data-filter-table]');
    if (table) table.classList.toggle('is-filtered-out', !table.querySelector('tr[data-filter]:not(.is-filtered-out)'));
    g.classList.toggle('is-filtered-out', inGroup === 0);
    shown += inGroup;
  }
  if (count) count.textContent = words.length ? `${shown} of ${total} items` : `${total} items`;
  if (empty) empty.hidden = !(words.length && shown === 0);
}

if (input) {
  const q = new URLSearchParams(location.search).get('q');
  if (q) {
    input.value = q;
    apply(q);
  }
  input.addEventListener('input', () => apply(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      input.value = '';
      apply('');
    }
  });
}
document.querySelector('[data-clear]')?.addEventListener('click', () => {
  if (!input) return;
  input.value = '';
  apply('');
  input.focus();
});
document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
