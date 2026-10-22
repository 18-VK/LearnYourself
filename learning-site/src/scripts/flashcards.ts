/**
 * Interview flashcards. Card flow: question → short answer → full answer (read from the topic page).
 * Piles and the current session live in localStorage under ly-flashcards-v1:
 *   { version: 1, piles: { <question id>: "know" | "review" }, session: { ids, index, topics, which } | null }
 * ?topics=a,b preselects topics.
 */
import { badges, loadAnswer, loadBank, readStore, shuffle, writeStore, type QMeta } from './interview-data';

const KEY = 'ly-flashcards-v1';
type Pile = 'know' | 'review';
interface Session {
  ids: string[];
  index: number;
  topics: string[];
  which: 'all' | 'fresh' | 'review';
  /** ids sorted during this session, for the summary */
  sorted: Record<string, Pile>;
}
interface State {
  version: 1;
  piles: Record<string, Pile>;
  session: Session | null;
}

const root = document.querySelector<HTMLElement>('[data-fc]');
if (root) void init(root);

function load(): State {
  const s = readStore<Partial<State>>(KEY);
  const piles: Record<string, Pile> = {};
  for (const [k, v] of Object.entries(s?.piles ?? {})) if (v === 'know' || v === 'review') piles[k] = v;
  const ses = s?.session;
  const session =
    ses && Array.isArray(ses.ids) && typeof ses.index === 'number'
      ? { ids: ses.ids.filter((x) => typeof x === 'string'), index: ses.index, topics: ses.topics ?? [], which: ses.which ?? 'all', sorted: ses.sorted ?? {} }
      : null;
  return { version: 1, piles, session };
}

async function init(root: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const setup = $('[data-fc-setup]');
  const run = $('[data-fc-run]');
  const done = $('[data-fc-done]');
  const live = $('[data-fc-live]');
  const countText = $('[data-fc-setup-count]');
  const topicBoxes = [...root.querySelectorAll<HTMLInputElement>('input[name="fc-topic"]')];
  const startBtn = $<HTMLButtonElement>('[data-fc-start]');
  let state = load();
  const save = () => writeStore(KEY, state);

  const wanted = new URLSearchParams(location.search).get('topics')?.split(',').filter(Boolean);
  if (wanted?.length) topicBoxes.forEach((b) => (b.checked = wanted.includes(b.value)));

  let byId = new Map<string, QMeta>();
  let all: QMeta[] = [];
  try {
    const bank = await loadBank();
    all = bank.questions;
    byId = new Map(all.map((q) => [q.id, q]));
  } catch {
    countText.textContent = 'The cards could not be loaded. Check your connection and reload the page.';
    startBtn.disabled = true;
    return;
  }

  const which = () => (root.querySelector<HTMLInputElement>('input[name="fc-which"]:checked')?.value ?? 'all') as Session['which'];
  const chosenTopics = () => topicBoxes.filter((b) => b.checked).map((b) => b.value);
  const pool = (topics: string[], w: Session['which']) =>
    all.filter((q) => topics.includes(q.topic) && (w === 'all' || (w === 'fresh' ? state.piles[q.id] !== 'know' : state.piles[q.id] === 'review')));

  const renderPiles = () => {
    const know = Object.values(state.piles).filter((p) => p === 'know').length;
    const review = Object.values(state.piles).filter((p) => p === 'review').length;
    root.querySelectorAll<HTMLElement>('[data-pile="know"]').forEach((e) => (e.textContent = String(know)));
    root.querySelectorAll<HTMLElement>('[data-pile="review"]').forEach((e) => (e.textContent = String(review)));
  };
  const renderSetup = () => {
    const n = pool(chosenTopics(), which()).length;
    countText.textContent = n ? `${n} card${n === 1 ? '' : 's'} selected.` : chosenTopics().length ? 'No cards match. Choose “All” or more topics.' : 'Choose at least one topic.';
    startBtn.disabled = n === 0;
    const resume = $('[data-fc-resume]');
    const s = state.session;
    resume.hidden = !(s && s.index < s.ids.length);
    if (s && !resume.hidden) $('[data-fc-resume-text]').textContent = `card ${s.index + 1} of ${s.ids.length}${s.topics.length ? ` (${s.topics.map((t) => all.find((q) => q.topic === t)?.topicTitle ?? t).join(', ')})` : ''}.`;
    renderPiles();
  };
  const show = (which: 'setup' | 'run' | 'done') => {
    setup.hidden = which !== 'setup';
    run.hidden = which !== 'run';
    done.hidden = which !== 'done';
  };

  // ── a card ────────────────────────────────────────────────────────────────────────────
  const revealBtn = $<HTMLButtonElement>('[data-fc-reveal]');
  const moreBtn = $<HTMLButtonElement>('[data-fc-more]');
  const shortBox = $('[data-fc-short]');
  const fullBox = $('[data-fc-full]');
  let stage = 0; // 0 question, 1 short answer, 2 full answer

  const current = () => {
    const s = state.session!;
    return byId.get(s.ids[s.index]!);
  };
  function renderCard(announce = true) {
    const s = state.session;
    if (!s) return;
    s.ids = s.ids.filter((id) => byId.has(id));
    if (s.index >= s.ids.length) return finish();
    const q = current()!;
    stage = 0;
    $('[data-fc-pos]').textContent = `Card ${s.index + 1} of ${s.ids.length}`;
    $('[data-fc-badges]').innerHTML = badges(q, state.piles[q.id]);
    $('[data-fc-q]').innerHTML = q.question;
    $('[data-fc-short-text]').innerHTML = q.short;
    shortBox.hidden = true;
    fullBox.hidden = true;
    fullBox.innerHTML = '';
    $('[data-fc-link-wrap]').hidden = true;
    $<HTMLAnchorElement>('[data-fc-link]').href = q.href;
    revealBtn.hidden = false;
    moreBtn.hidden = true;
    $<HTMLButtonElement>('[data-fc-prev]').disabled = s.index === 0;
    renderPiles();
    if (announce) live.textContent = `Card ${s.index + 1} of ${s.ids.length}: ${$('[data-fc-q]').textContent ?? ''}`;
  }
  function reveal() {
    if (stage === 0) {
      stage = 1;
      shortBox.hidden = false;
      revealBtn.hidden = true;
      moreBtn.hidden = false;
      live.textContent = `Short answer: ${shortBox.textContent?.replace(/^\s*Short answer\s*/, '') ?? ''}`;
      moreBtn.focus();
    } else if (stage === 1) {
      stage = 2;
      moreBtn.hidden = true;
      fullBox.hidden = false;
      $('[data-fc-link-wrap]').hidden = false;
      const q = current()!;
      fullBox.innerHTML = '<p class="muted">Loading the full answer…</p>';
      loadAnswer(q.href, q.id)
        .then((body) => {
          if (current()?.id !== q.id) return;
          fullBox.innerHTML = '';
          if (body) fullBox.append(body);
          else fullBox.innerHTML = '<p class="muted">The full answer is on the topic page (link below).</p>';
        })
        .catch(() => {
          if (current()?.id === q.id) fullBox.innerHTML = '<p class="muted">The full answer could not be loaded. Use the link below.</p>';
        });
      $<HTMLButtonElement>('[data-fc-know]').focus();
    }
  }
  function step(dir: 1 | -1, pile?: Pile) {
    const s = state.session;
    if (!s) return;
    const q = current();
    if (pile && q) {
      state.piles[q.id] = pile;
      s.sorted[q.id] = pile;
    }
    s.index = Math.max(0, s.index + dir);
    save();
    if (s.index >= s.ids.length) finish();
    else {
      renderCard();
      revealBtn.focus();
    }
  }
  function start(ids: string[], topics: string[], w: Session['which']) {
    state.session = { ids, index: 0, topics, which: w, sorted: {} };
    save();
    show('run');
    renderCard();
    revealBtn.focus();
  }
  function finish() {
    const s = state.session;
    const sorted = s ? Object.values(s.sorted) : [];
    const know = sorted.filter((p) => p === 'know').length;
    const again = sorted.filter((p) => p === 'review').length;
    $('[data-fc-done-text]').textContent = s
      ? `You went through ${s.ids.length} card${s.ids.length === 1 ? '' : 's'}: ${know} into “Know it”, ${again} into “Review again”${s.ids.length - know - again > 0 ? `, ${s.ids.length - know - again} skipped` : ''}.`
      : 'Session ended.';
    const topics = s?.topics ?? chosenTopics();
    const reviewLeft = pool(topics, 'review').length;
    const againBtn = $<HTMLButtonElement>('[data-fc-again-pile]');
    againBtn.hidden = reviewLeft === 0;
    againBtn.textContent = `Go through “Review again” (${reviewLeft})`;
    againBtn.dataset.topics = topics.join(',');
    state.session = null;
    save();
    show('done');
    renderPiles();
    done.focus();
  }

  // ── wiring ────────────────────────────────────────────────────────────────────────────
  root.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).closest('[data-fc-setup]')) renderSetup();
  });
  $('[data-check-all]').addEventListener('click', () => {
    topicBoxes.forEach((b) => (b.checked = true));
    renderSetup();
  });
  $('[data-check-none]').addEventListener('click', () => {
    topicBoxes.forEach((b) => (b.checked = false));
    renderSetup();
  });
  startBtn.addEventListener('click', () => {
    const topics = chosenTopics();
    const w = which();
    let list = pool(topics, w).map((q) => q.id);
    if (root.querySelector<HTMLInputElement>('input[name="fc-shuffle"]')?.checked) list = shuffle(list);
    if (list.length) start(list, topics, w);
  });
  $('[data-fc-resume-btn]').addEventListener('click', () => {
    if (!state.session) return;
    show('run');
    renderCard();
    revealBtn.focus();
  });
  revealBtn.addEventListener('click', reveal);
  moreBtn.addEventListener('click', reveal);
  $('[data-fc-know]').addEventListener('click', () => step(1, 'know'));
  $('[data-fc-again]').addEventListener('click', () => step(1, 'review'));
  $('[data-fc-prev]').addEventListener('click', () => step(-1));
  $('[data-fc-skip]').addEventListener('click', () => step(1));
  $('[data-fc-shuffle]').addEventListener('click', () => {
    const s = state.session;
    if (!s) return;
    s.ids = [...s.ids.slice(0, s.index), ...shuffle(s.ids.slice(s.index))];
    save();
    renderCard();
    live.textContent = `Shuffled the remaining ${s.ids.length - s.index} cards. ${live.textContent}`;
  });
  $('[data-fc-end]').addEventListener('click', finish);
  $('[data-fc-new]').addEventListener('click', () => {
    show('setup');
    renderSetup();
    startBtn.focus();
  });
  $('[data-fc-again-pile]').addEventListener('click', (e) => {
    const topics = ((e.currentTarget as HTMLElement).dataset.topics ?? '').split(',').filter(Boolean);
    const list = shuffle(pool(topics, 'review').map((q) => q.id));
    if (list.length) start(list, topics, 'review');
  });
  const resetBtn = $<HTMLButtonElement>('[data-fc-reset]');
  let armed = 0;
  resetBtn.addEventListener('click', () => {
    if (!armed) {
      resetBtn.textContent = 'Select again to clear both piles';
      armed = window.setTimeout(() => {
        armed = 0;
        resetBtn.textContent = 'Reset piles';
      }, 5000);
      return;
    }
    window.clearTimeout(armed);
    armed = 0;
    state.piles = {};
    state.session = null;
    save();
    resetBtn.textContent = 'Reset piles';
    renderSetup();
    countText.textContent = `Piles cleared. ${countText.textContent}`;
  });
  document.addEventListener('keydown', (e) => {
    if (run.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || t.closest('dialog')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' && t.tagName !== 'BUTTON' && t.tagName !== 'A') {
      e.preventDefault();
      reveal();
    } else if (k === 'k') step(1, 'know');
    else if (k === 'r') step(1, 'review');
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft' && state.session && state.session.index > 0) step(-1);
  });

  show('setup');
  renderSetup();
}

