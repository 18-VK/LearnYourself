/**
 * Interview question filters (Browse and topic pages): topic, difficulty, origin, reviewed status, lesson
 * and full-text search, kept in the URL (?topic=…&q=…) so a filtered view can be bookmarked or linked.
 * Browse holds short answers only; the full answer is fetched from the topic page when a card opens, and
 * search covers full answers via search.json (loaded on the first search).
 */
import { loadAnswer, loadSearchText } from './interview-data';

const form = document.querySelector<HTMLFormElement>('form.iq-filters');
if (form) init(form);

function init(form: HTMLFormElement) {
  const browse = form.dataset.mode === 'browse';
  const cards = [...document.querySelectorAll<HTMLElement>('.iq-card')];
  const sections = [...document.querySelectorAll<HTMLElement>('.iq-section')];
  const count = document.querySelector<HTMLElement>('[data-iq-count]');
  const empty = document.querySelector<HTMLElement>('[data-iq-empty]');
  const chip = document.querySelector<HTMLElement>('[data-iq-lesson-chip]');
  const lessonNames = JSON.parse(document.querySelector('[data-iq-lessons]')?.textContent ?? '{}') as Record<string, string>;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  const NAMES = ['q', 'topic', 'difficulty', 'origin', 'reviewed', 'lesson'] as const;

  // text per card: topic pages have the whole answer in the DOM; Browse adds search.json once loaded (by card id)
  const textOf = (c: HTMLElement) =>
    [...c.querySelectorAll('.iq-q, .iq-short p, .iq-badges, .iq-body:not([data-iq-slot])')].map((e) => e.textContent ?? '').join(' ').toLowerCase();
  const ownText = new Map(cards.map((c) => [c, textOf(c)]));
  let answers: Record<string, string> | null = null;
  let loadingAnswers = false;

  const params = new URLSearchParams(location.search);
  for (const n of NAMES) {
    const el = field(n);
    const v = params.get(n);
    if (el && v !== null && (el.tagName !== 'SELECT' || [...(el as HTMLSelectElement).options].some((o) => o.value === v))) el.value = v;
  }

  function apply(syncUrl = true) {
    const v = Object.fromEntries(NAMES.map((n) => [n, (field(n)?.value ?? '').trim()])) as Record<(typeof NAMES)[number], string>;
    const words = v.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (browse && words.length && !answers && !loadingAnswers) {
      loadingAnswers = true;
      void loadSearchText().then((a) => {
        answers = a;
        apply(false);
      });
    }
    let shown = 0;
    for (const c of cards) {
      const d = c.dataset;
      let on =
        (!v.topic || d.topic === v.topic) &&
        (!v.difficulty || d.difficulty === v.difficulty) &&
        (!v.origin || d.origin === v.origin) &&
        (!v.reviewed || d.reviewed === v.reviewed) &&
        (!v.lesson || (d.lessons ?? '').split(' ').includes(v.lesson));
      if (on && words.length) {
        const text = `${ownText.get(c)} ${answers?.[c.id] ?? ''}`;
        on = words.every((w) => text.includes(w));
      }
      c.classList.toggle('is-filtered-out', !on);
      if (on) shown++;
    }
    for (const s of sections) s.classList.toggle('is-filtered-out', !s.querySelector('.iq-card:not(.is-filtered-out)'));
    const total = cards.length;
    const filtered = NAMES.some((n) => v[n]);
    if (count) count.textContent = filtered ? `Showing ${shown} of ${total} question${total === 1 ? '' : 's'}${words.length && browse && !answers ? ' (searching full answers…)' : ''}` : `${total} question${total === 1 ? '' : 's'}`;
    if (empty) empty.hidden = !(filtered && shown === 0 && total > 0);
    if (chip) {
      chip.hidden = !v.lesson;
      const name = chip.querySelector('[data-iq-lesson-name]');
      if (name) name.textContent = lessonNames[v.lesson] ?? v.lesson;
    }
    if (syncUrl) {
      const p = new URLSearchParams();
      for (const n of NAMES) if (v[n]) p.set(n, v[n]);
      const qs = p.toString();
      history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
    }
  }

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', () => apply());
  form.addEventListener('change', () => apply());
  form.addEventListener('reset', () => {
    const lesson = field('lesson');
    window.setTimeout(() => {
      if (lesson) lesson.value = '';
      apply();
    });
  });
  document.querySelector('[data-iq-lesson-clear]')?.addEventListener('click', () => {
    const lesson = field('lesson');
    if (lesson) lesson.value = '';
    apply();
  });
  document.querySelector('[data-iq-reset]')?.addEventListener('click', () => form.reset());
  form.querySelector<HTMLInputElement>('input[name="q"]')?.addEventListener('keydown', (e) => {
    const t = e.target as HTMLInputElement;
    if (e.key === 'Escape' && t.value) {
      e.preventDefault();
      t.value = '';
      apply();
    }
  });

  // expand / collapse every answer (topic pages)
  const expand = document.querySelector<HTMLButtonElement>('[data-iq-expand]');
  expand?.addEventListener('click', () => {
    const open = expand.getAttribute('aria-pressed') !== 'true';
    document.querySelectorAll<HTMLDetailsElement>('.iq-card:not(.is-filtered-out) details.iq-more').forEach((d) => (d.open = open));
    expand.setAttribute('aria-pressed', String(open));
    expand.textContent = open ? 'Collapse all answers' : 'Expand all answers';
  });

  // Browse: fetch a full answer from its topic page the first time its card opens
  document.addEventListener(
    'toggle',
    (e) => {
      const d = e.target as HTMLDetailsElement;
      if (!(d instanceof HTMLDetailsElement) || !d.open || !d.matches('details.iq-more') || d.dataset.loaded) return;
      const slot = d.querySelector<HTMLElement>('[data-iq-slot]');
      const card = d.closest<HTMLElement>('.iq-card');
      if (!slot || !card) return;
      d.dataset.loaded = 'loading';
      slot.setAttribute('aria-busy', 'true');
      loadAnswer(card.querySelector<HTMLAnchorElement>('.iq-permalink')!.href, card.id)
        .then((body) => {
          if (!body) throw new Error('not found');
          slot.replaceWith(body);
          d.dataset.loaded = 'true';
        })
        .catch(() => {
          slot.removeAttribute('aria-busy');
          delete d.dataset.loaded;
        });
    },
    true,
  );

  // a #question link on a topic page opens that answer
  const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (target?.classList.contains('iq-card')) {
    const d = target.querySelector<HTMLDetailsElement>('details.iq-more');
    if (d && !d.querySelector('[data-iq-slot]')) d.open = true;
  }

  apply(false);
}
