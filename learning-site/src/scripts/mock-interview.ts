/**
 * Mock interview: a random set from the chosen topics with an overall time limit. For each question the
 * learner answers (out loud or in the text box), reveals the model answer and rates themselves; the summary
 * lists weak topics/subtopics with the lessons that teach them. History is kept in localStorage under
 * ly-mock-v1 ({ version: 1, history: [...] }, newest first, at most 30). ?topics=a,b preselects topics.
 */
import { badges, esc, loadAnswer, loadBank, readStore, shuffle, writeStore, type QMeta } from './interview-data';

const KEY = 'ly-mock-v1';
type Rating = 'good' | 'partial' | 'missed';
interface HistoryEntry {
  at: number;
  topics: string[];
  asked: number;
  rated: number;
  good: number;
  partial: number;
  missed: number;
  limitMin: number;
  seconds: number;
  weak: string[];
}
interface Turn {
  q: QMeta;
  text: string;
  rating: Rating | null;
}

const root = document.querySelector<HTMLElement>('[data-mk]');
if (root) void init(root);

async function init(root: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const setup = $('[data-mk-setup]');
  const run = $('[data-mk-run]');
  const summary = $('[data-mk-summary]');
  const countText = $('[data-mk-setup-count]');
  const startBtn = $<HTMLButtonElement>('[data-mk-start]');
  const topicBoxes = [...root.querySelectorAll<HTMLInputElement>('input[name="mk-topic"]')];
  const wanted = new URLSearchParams(location.search).get('topics')?.split(',').filter(Boolean);
  if (wanted?.length) topicBoxes.forEach((b) => (b.checked = wanted.includes(b.value)));

  let all: QMeta[] = [];
  let topicTitle = new Map<string, string>();
  try {
    const bank = await loadBank();
    all = bank.questions;
    topicTitle = new Map(bank.topics.map((t) => [t.id, t.title]));
  } catch {
    countText.textContent = 'The questions could not be loaded. Check your connection and reload the page.';
    startBtn.disabled = true;
    return;
  }

  const history = (): HistoryEntry[] => {
    const h = readStore<{ history?: HistoryEntry[] }>(KEY)?.history;
    return Array.isArray(h) ? h.filter((x) => x && typeof x.at === 'number') : [];
  };
  const chosen = () => topicBoxes.filter((b) => b.checked).map((b) => b.value);
  const countSel = $<HTMLSelectElement>('select[name="mk-count"]');
  const timeSel = $<HTMLSelectElement>('select[name="mk-time"]');
  const show = (w: 'setup' | 'run' | 'summary') => {
    setup.hidden = w !== 'setup';
    run.hidden = w !== 'run';
    summary.hidden = w !== 'summary';
  };

  function renderSetup() {
    const avail = all.filter((q) => chosen().includes(q.topic)).length;
    const want = Number(countSel.value);
    countText.textContent = !chosen().length
      ? 'Choose at least one topic.'
      : avail >= want
        ? `${want} of ${avail} questions will be drawn at random.`
        : `Only ${avail} question${avail === 1 ? '' : 's'} in these topics; you'll get all of them.`;
    startBtn.disabled = avail === 0;
    const h = history();
    $('[data-mk-history-wrap]').hidden = h.length === 0;
    $('[data-mk-history]').innerHTML = h
      .slice(0, 10)
      .map((e) => {
        const pct = e.asked ? Math.round(((e.good + e.partial / 2) / e.asked) * 100) : 0;
        const when = new Date(e.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        return `<li><strong>${pct}%</strong> · ${e.asked} question${e.asked === 1 ? '' : 's'} on ${esc(e.topics.map((t) => topicTitle.get(t) ?? t).join(', '))} <span class="muted">· ${esc(when)}${e.weak.length ? ` · revise: ${esc(e.weak.slice(0, 3).join(', '))}` : ''}</span></li>`;
      })
      .join('');
  }

  // ── session ───────────────────────────────────────────────────────────────────────────
  let turns: Turn[] = [];
  let index = 0;
  let endsAt = 0;
  let startedAt = 0;
  let limitMin = 0;
  let timer = 0;
  let warned = false;
  const text = $<HTMLTextAreaElement>('[data-mk-text]');
  const reveal = $<HTMLButtonElement>('[data-mk-reveal]');
  const model = $('[data-mk-model]');
  const next = $<HTMLButtonElement>('[data-mk-next]');
  const timerEl = $('[data-mk-timer]');
  const alertEl = $('[data-mk-alert]');

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function tick() {
    if (!endsAt) {
      timerEl.textContent = `${fmt((Date.now() - startedAt) / 1000)} elapsed`;
      return;
    }
    const left = Math.max(0, (endsAt - Date.now()) / 1000);
    timerEl.textContent = `${fmt(Math.ceil(left))} left`;
    timerEl.classList.toggle('is-low', left <= 60);
    if (left <= 60 && !warned) {
      warned = true;
      alertEl.textContent = 'One minute left.';
    }
    if (left <= 0) {
      alertEl.textContent = 'Time is up.';
      finish(true);
    }
  }
  function renderTurn() {
    const t = turns[index]!;
    $('[data-mk-pos]').textContent = `Question ${index + 1} of ${turns.length}`;
    $('[data-mk-badges]').innerHTML = badges(t.q);
    $('[data-mk-q]').innerHTML = t.q.question;
    text.value = t.text;
    model.hidden = true;
    reveal.hidden = false;
    $('[data-mk-full]').innerHTML = '';
    root.querySelectorAll<HTMLInputElement>('input[name="mk-rate"]').forEach((r) => (r.checked = false));
    next.disabled = true;
    next.textContent = index === turns.length - 1 ? 'Finish the interview' : 'Next question';
    $('[data-mk-card]').focus();
  }
  function start() {
    const pool = all.filter((q) => chosen().includes(q.topic));
    turns = shuffle(pool)
      .slice(0, Number(countSel.value))
      .map((q) => ({ q, text: '', rating: null }));
    if (!turns.length) return;
    index = 0;
    limitMin = Number(timeSel.value);
    startedAt = Date.now();
    endsAt = limitMin ? startedAt + limitMin * 60_000 : 0;
    warned = false;
    show('run');
    renderTurn();
    tick();
    window.clearInterval(timer);
    timer = window.setInterval(tick, 1000);
  }
  reveal.addEventListener('click', () => {
    const t = turns[index]!;
    t.text = text.value;
    reveal.hidden = true;
    model.hidden = false;
    $('[data-mk-short]').innerHTML = t.q.short;
    const full = $('[data-mk-full]');
    full.innerHTML = '<p class="muted">Loading the full answer…</p>';
    loadAnswer(t.q.href, t.q.id)
      .then((body) => {
        if (turns[index] !== t) return;
        full.innerHTML = '';
        if (body) full.append(body);
        else full.innerHTML = `<p class="muted">Read the full answer on <a href="${t.q.href}">its topic page</a>.</p>`;
      })
      .catch(() => {
        if (turns[index] === t) full.innerHTML = `<p class="muted">The full answer could not be loaded: <a href="${t.q.href}">open it on its topic page</a>.</p>`;
      });
    root.querySelector<HTMLInputElement>('input[name="mk-rate"]')?.focus();
  });
  text.addEventListener('input', () => (turns[index]!.text = text.value));
  root.addEventListener('change', (e) => {
    const r = e.target as HTMLInputElement;
    if (r.name === 'mk-rate') {
      turns[index]!.rating = r.value as Rating;
      next.disabled = false;
    } else if (r.closest('[data-mk-setup]')) renderSetup();
  });
  next.addEventListener('click', () => {
    if (index < turns.length - 1) {
      index++;
      renderTurn();
    } else finish(false);
  });
  $('[data-mk-end]').addEventListener('click', () => finish(false));

  function finish(timeUp: boolean) {
    window.clearInterval(timer);
    if (run.hidden) return;
    if (turns[index]) turns[index]!.text = text.value;
    const rated = turns.filter((t) => t.rating);
    const good = rated.filter((t) => t.rating === 'good').length;
    const partial = rated.filter((t) => t.rating === 'partial').length;
    const missed = rated.filter((t) => t.rating === 'missed').length;
    const pct = turns.length ? Math.round(((good + partial / 2) / turns.length) * 100) : 0;
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    $('[data-mk-score]').textContent =
      `${timeUp ? 'Time ran out. ' : ''}Score ${pct}%: ${good} got it, ${partial} partly, ${missed} missed` +
      `${turns.length - rated.length ? `, ${turns.length - rated.length} not rated` : ''} · ${fmt(seconds)} taken${limitMin ? ` of ${limitMin}:00` : ''}.`;

    // weak areas: anything not rated "got it", grouped by topic › subtopic, with the lessons that teach them
    const weakTurns = turns.filter((t) => t.rating !== 'good');
    interface WeakGroup {
      label: string;
      qs: Turn[];
      lessons: Map<string, string>;
    }
    const groups = new Map<string, WeakGroup>();
    for (const t of weakTurns) {
      const key = `${t.q.topic}/${t.q.subtopic}`;
      const g: WeakGroup = groups.get(key) ?? { label: `${t.q.topicTitle} › ${t.q.subtopicLabel}`, qs: [], lessons: new Map() };
      g.qs.push(t);
      for (const l of t.q.lessons) g.lessons.set(l.href, l.title);
      groups.set(key, g);
    }
    const weak = [...groups.values()].sort((a, b) => b.qs.length - a.qs.length);
    $('[data-mk-weak]').innerHTML = weak.length
      ? `<h3>What to revise</h3><ul class="mk-weak">${weak
          .map(
            (g) =>
              `<li><strong>${esc(g.label)}</strong> <span class="muted">(${g.qs.length} question${g.qs.length === 1 ? '' : 's'})</span>` +
              (g.lessons.size ? `<br><span class="muted">Lessons:</span> ${[...g.lessons].map(([href, title]) => `<a href="${esc(href)}">${esc(title)}</a>`).join(' · ')}` : '<br><span class="muted">No lesson covers this yet.</span>') +
              '</li>',
          )
          .join('')}</ul>`
      : '<p>Nothing to revise from this set: every answer rated “Got it”.</p>';
    const label: Record<Rating, string> = { good: 'Got it', partial: 'Partly', missed: 'Missed it' };
    $('[data-mk-results]').innerHTML = turns
      .map(
        (t) =>
          `<li class="mk-r-${t.rating ?? 'none'}"><a href="${esc(t.q.href)}">${t.q.question}</a> <span class="badge mk-rating">${t.rating ? label[t.rating] : 'Not rated'}</span>` +
          (t.text.trim() ? `<details><summary>Your answer</summary><p class="mk-yours">${esc(t.text.trim()).replace(/\n/g, '<br>')}</p></details>` : '') +
          '</li>',
      )
      .join('');
    const topics = [...new Set(turns.map((t) => t.q.topic))];
    $<HTMLAnchorElement>('[data-mk-flash]').href = `${$<HTMLAnchorElement>('[data-mk-flash]').href.split('?')[0]}?topics=${topics.join(',')}`;
    const entry: HistoryEntry = { at: Date.now(), topics, asked: turns.length, rated: rated.length, good, partial, missed, limitMin, seconds, weak: weak.map((g) => g.label) };
    writeStore(KEY, { version: 1, history: [entry, ...history()].slice(0, 30) });
    show('summary');
    summary.focus();
  }

  // ── setup wiring ──────────────────────────────────────────────────────────────────────
  $('[data-check-all]').addEventListener('click', () => {
    topicBoxes.forEach((b) => (b.checked = true));
    renderSetup();
  });
  $('[data-check-none]').addEventListener('click', () => {
    topicBoxes.forEach((b) => (b.checked = false));
    renderSetup();
  });
  startBtn.addEventListener('click', start);
  $('[data-mk-again]').addEventListener('click', () => {
    show('setup');
    renderSetup();
    startBtn.focus();
  });
  const clearBtn = $<HTMLButtonElement>('[data-mk-clear]');
  let armed = 0;
  clearBtn.addEventListener('click', () => {
    if (!armed) {
      clearBtn.textContent = 'Select again to clear the history';
      armed = window.setTimeout(() => {
        armed = 0;
        clearBtn.textContent = 'Clear history';
      }, 5000);
      return;
    }
    window.clearTimeout(armed);
    armed = 0;
    writeStore(KEY, null);
    clearBtn.textContent = 'Clear history';
    renderSetup();
  });
  show('setup');
  renderSetup();
}
