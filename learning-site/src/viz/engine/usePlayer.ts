import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
const BASE_DELAY_MS = 800;

export interface PlayerState {
  index: number;
  playing: boolean;
  speed: number;
  predict: boolean;
  /** step index → chosen option, for steps answered in predict mode */
  answers: ReadonlyMap<number, number>;
}

export interface PlayerApi extends PlayerState {
  length: number;
  atEnd: boolean;
  /** true when predict mode is on and the current step's question is unanswered */
  awaitingPrediction: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  step: (delta: number) => void;
  seek: (index: number) => void;
  reset: () => void;
  setSpeed: (s: number) => void;
  setPredict: (on: boolean) => void;
  answer: (option: number) => void;
}

// ── keyboard: Space / ← / → go to the visualizer the learner used last ───────────────────
let active: { api: () => PlayerApi } | null = null;
let listening = false;
function ensureKeyboard() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('keydown', (e) => {
    if (!active || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || t.isContentEditable) return;
    const api = active.api();
    if (e.key === ' ' || e.key === 'Spacebar') {
      if (t.tagName === 'BUTTON' || t.getAttribute('role') === 'button') return; // let buttons handle Space
      e.preventDefault();
      api.toggle();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      api.step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      api.step(-1);
    }
  });
}

/**
 * Drives a precomputed trace. `needsPrediction(i)` says whether step i carries a predict-mode question.
 * Playback never runs past an unanswered prediction.
 */
export function usePlayer(
  length: number,
  needsPrediction: (i: number) => boolean,
  resetKey: unknown,
  options: { predict?: boolean } = {},
): PlayerApi & { claimKeyboard: () => void } {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [predict, setPredictState] = useState(Boolean(options.predict));
  const [answers, setAnswers] = useState<Map<number, number>>(() => new Map());

  // a new trace (new input or algorithm) starts from the beginning
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    setAnswers(new Map());
  }, [resetKey]);

  const last = Math.max(0, length - 1);
  const awaitingPrediction = predict && needsPrediction(index) && !answers.has(index);

  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      setIndex((i) => Math.min(last, Math.max(0, i + delta)));
    },
    [last],
  );

  // autoplay
  useEffect(() => {
    if (!playing) return;
    if (index >= last || awaitingPrediction) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setIndex((i) => Math.min(last, i + 1)), BASE_DELAY_MS / speed);
    return () => window.clearTimeout(t);
  }, [playing, index, last, speed, awaitingPrediction]);

  const api = useMemo(() => {
    const a: PlayerApi = {
      index,
      playing,
      speed,
      predict,
      answers,
      length,
      atEnd: index >= last,
      awaitingPrediction,
      play: () => {
        if (index >= last) setIndex(0);
        setPlaying(true);
      },
      pause: () => setPlaying(false),
      toggle: () => (playing ? setPlaying(false) : a.play()),
      step,
      seek: (i) => {
        setPlaying(false);
        setIndex(Math.min(last, Math.max(0, i)));
      },
      reset: () => {
        setPlaying(false);
        setIndex(0);
      },
      setSpeed,
      setPredict: (on) => setPredictState(on),
      answer: (option) => setAnswers((m) => new Map(m).set(index, option)),
    };
    return a;
  }, [index, playing, speed, predict, answers, length, last, awaitingPrediction, step]);

  const apiRef = useRef(api);
  apiRef.current = api;
  const handle = useRef({ api: () => apiRef.current });
  const claimKeyboard = useCallback(() => {
    ensureKeyboard();
    active = handle.current;
  }, []);
  useEffect(() => {
    ensureKeyboard();
    if (!active) active = handle.current;
    const h = handle.current;
    return () => {
      if (active === h) active = null;
    };
  }, []);

  return { ...api, claimKeyboard };
}
