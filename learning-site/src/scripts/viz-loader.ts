/**
 * Hydrates `.viz-slot[data-viz]` placeholders (written into lessons by the content pipeline) when they
 * come near the viewport. React and each visualizer's code are fetched only at that moment.
 */
import { VIZ_REGISTRY } from '../viz/registry';

const slots = [...document.querySelectorAll<HTMLElement>('.viz-slot[data-viz]')];

async function mount(slot: HTMLElement) {
  const name = slot.dataset.viz ?? '';
  const textVersion = slot.querySelector<HTMLElement>(':scope > .viz-text');
  const load = VIZ_REGISTRY[name];
  if (!load) {
    // Not built yet: keep the original text version (if any) and say so.
    slot.dataset.state = 'unavailable';
    const note = document.createElement('p');
    note.className = 'viz-note';
    note.textContent = 'An interactive version of this is planned for a later build.';
    slot.querySelector('.viz-skeleton')?.remove();
    slot.prepend(note);
    return;
  }
  let props: Record<string, unknown> = {};
  try {
    props = JSON.parse(slot.dataset.props ?? '{}') as Record<string, unknown>;
  } catch {
    /* keep defaults */
  }
  const [{ createElement }, { createRoot }, mod] = await Promise.all([import('react'), import('react-dom/client'), load()]);
  const host = document.createElement('div');
  host.className = 'viz-host';
  slot.querySelector('.viz-skeleton')?.remove();
  slot.prepend(host);
  if (textVersion) {
    // the original ASCII stays available behind a toggle
    textVersion.hidden = true;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn';
    toggle.style.marginTop = '10px';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Show text version';
    toggle.addEventListener('click', () => {
      const open = textVersion.hidden;
      textVersion.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Hide text version' : 'Show text version';
    });
    host.after(toggle);
  }
  createRoot(host).render(createElement(mod.default, { ...props, placement: slot.dataset.placement ?? '' }));
  slot.dataset.state = 'mounted';
}

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      void mount(e.target as HTMLElement);
    }
  },
  { rootMargin: '300px 0px' },
);
slots.forEach((s) => io.observe(s));
