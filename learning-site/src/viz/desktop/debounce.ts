/**
 * Trace for DebounceTimelineVisualizer, from DebounceSearch.md ("In WPF"): every keystroke sets
 * SearchText, whose setter calls _searchTimer.Stop() then _searchTimer.Start(); only when the interval
 * passes with no keystroke does Tick run ApplySearch(). The learner sets the text, the gap between
 * keystrokes, the interval, and optionally a pause, and the timeline shows each countdown being
 * cancelled or firing, next to the "search on every keystroke" lane the note starts from.
 */
import { lines } from '../engine/code';
import { DEBOUNCE_WPF } from './csharp';

export interface DebounceOptions {
  text?: string;
  /** ms between keystrokes */
  gapMs?: number;
  /** the timer interval (the note uses 300 ms) */
  delayMs?: number;
  /** pause for twice the interval after this many letters (0 = no pause) */
  pauseAfter?: number;
}

export interface TimerBar {
  start: number;
  due: number;
  /** when it was cancelled or fired; null while counting down */
  end: number | null;
  status: 'pending' | 'cancelled' | 'fired';
}
export interface DebounceState {
  /** the moment this step happens, in ms */
  time: number;
  keys: { t: number; text: string }[];
  timers: TimerBar[];
  searches: { t: number; text: string }[];
  /** "Instead of": one search per keystroke */
  naive: { t: number; text: string }[];
  phase: 'type' | 'stop' | 'start' | 'wait' | 'tick' | 'search' | 'done';
}
export interface DebounceStep {
  state: DebounceState;
  codeLine: number;
  narration: string;
}

export const DEBOUNCE_LINES = lines(DEBOUNCE_WPF, {
  tickStop: ['_searchTimer.Stop();', 1],
  apply: 'ApplySearch();',
  check: 'if (_searchText != value)',
  stop: ['_searchTimer.Stop();', 2],
  start: '_searchTimer.Start();',
});

export const clampOptions = (o: DebounceOptions): Required<DebounceOptions> => {
  const text = (o.text ?? 'Task').replace(/\s+/g, '').slice(0, 12) || 'Task';
  return {
    text,
    gapMs: Math.round(Math.min(800, Math.max(40, o.gapMs ?? 120))),
    delayMs: Math.round(Math.min(1000, Math.max(100, o.delayMs ?? 300))),
    pauseAfter: Math.min(text.length - 1, Math.max(0, Math.floor(o.pauseAfter ?? 0))),
  };
};

/** Keystroke times: one every gap, plus a pause of twice the interval after `pauseAfter` letters. */
export function keystrokeTimes(o: Required<DebounceOptions>): number[] {
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < o.text.length; i++) {
    if (i > 0) t += o.gapMs + (o.pauseAfter && i === o.pauseAfter ? 2 * o.delayMs : 0);
    out.push(t);
  }
  return out;
}

export function debounceTrace(input: DebounceOptions = {}): DebounceStep[] {
  const o = clampOptions(input);
  const L = DEBOUNCE_LINES;
  const times = keystrokeTimes(o);
  const steps: DebounceStep[] = [];
  let st: DebounceState = { time: 0, keys: [], timers: [], searches: [], naive: [], phase: 'type' };
  const push = (codeLine: number, narration: string, change: Partial<DebounceState>) => {
    st = { ...st, ...change };
    steps.push({ state: st, codeLine, narration });
  };
  const pending = () => st.timers.find((x) => x.status === 'pending');
  const setTimer = (t: TimerBar, change: Partial<TimerBar>) => st.timers.map((x) => (x === t ? { ...x, ...change } : x));
  const fire = (t: TimerBar, current: string, lastKey: boolean) => {
    if (lastKey) push(0, `You stop typing at "${current}". No more setter calls. ⏱ ${o.delayMs} ms passes…`, { time: t.due, phase: 'wait' });
    else push(0, `No keystroke for ${o.delayMs} ms: the countdown reaches the end before the next letter.`, { time: t.due, phase: 'wait' });
    push(L.tickStop, 'Timer fires (Tick event): the handler stops the timer first…', { time: t.due, timers: setTimer(t, { end: t.due, status: 'fired' }), phase: 'tick' });
    const first = st.searches.length === 0;
    push(L.apply, `…then ApplySearch() runs for "${current}".${lastKey && first ? ' Only NOW does ApplySearch() run, exactly one time.' : ''}`, {
      time: t.due,
      searches: [...st.searches, { t: t.due, text: current }],
      phase: 'search',
    });
  };

  times.forEach((t, i) => {
    const text = o.text.slice(0, i + 1);
    const before = pending();
    if (before && before.due <= t) fire(before, o.text.slice(0, i), false);
    push(L.check, `You type: SearchText = "${text}". The setter runs (${t} ms).`, {
      time: t,
      keys: [...st.keys, { t, text }],
      naive: [...st.naive, { t, text }],
      phase: 'type',
    });
    const p = pending();
    push(
      L.stop,
      p ? `_searchTimer.Stop() → the previous countdown (due at ${p.due} ms) is cancelled.` : '_searchTimer.Stop() → nothing to stop yet.',
      { time: t, timers: p ? setTimer(p, { end: t, status: 'cancelled' }) : st.timers, phase: 'stop' },
    );
    push(L.start, `_searchTimer.Start() → a new ${o.delayMs} ms countdown starts (due at ${t + o.delayMs} ms).`, {
      time: t,
      timers: [...st.timers, { start: t, due: t + o.delayMs, end: null, status: 'pending' }],
      phase: 'start',
    });
  });
  const last = pending();
  if (last) fire(last, o.text, true);

  const cancelled = st.timers.filter((x) => x.status === 'cancelled').length;
  push(
    0,
    `${o.text.length} keystrokes: without debounce that is ${o.text.length} searches; with a ${o.delayMs} ms debounce, ${st.searches.length} search${st.searches.length === 1 ? '' : 'es'} (${cancelled} countdown${cancelled === 1 ? '' : 's'} cancelled). As long as the user keeps typing, the timer never reaches Tick.`,
    { phase: 'done' },
  );
  return steps;
}
