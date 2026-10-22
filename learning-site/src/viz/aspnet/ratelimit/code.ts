import { lineOf } from '../../engine/code';
import { ALL_FOUR_LIMITERS_CODE } from '../sources';
import type { Algo, RlStep } from './sim';

/** The first line at or after the line containing `start` that contains `marker` (1-based). */
function lineAfter(code: string, start: string, marker: string): number {
  const rows = code.split('\n');
  const from = lineOf(code, start) - 1;
  for (let i = from; i < rows.length; i++) if (rows[i]!.includes(marker)) return i + 1;
  throw new Error(`Code marker not found after "${start}": ${marker}`);
}

const C = ALL_FOUR_LIMITERS_CODE;
const block = {
  'fixed-window': 'options.AddFixedWindowLimiter("fixed"',
  'sliding-window': 'options.AddSlidingWindowLimiter("sliding"',
  'token-bucket': 'options.AddTokenBucketLimiter("token"',
  concurrency: 'options.AddConcurrencyLimiter("concurrency"',
} as const;

type Lines = Partial<Record<NonNullable<RlStep['line']> | 'head', number[]>>;

/** For each limiter, the note's lines that each kind of step is about. */
export const LIMITER_LINES: Record<Exclude<Algo, 'leaky-bucket'>, Lines> = {
  'fixed-window': {
    head: [lineOf(C, block['fixed-window'])],
    limit: [lineAfter(C, block['fixed-window'], 'opt.PermitLimit')],
    window: [lineAfter(C, block['fixed-window'], 'opt.Window')],
    queue: [lineAfter(C, block['fixed-window'], 'opt.QueueProcessingOrder'), lineAfter(C, block['fixed-window'], 'opt.QueueLimit')],
  },
  'sliding-window': {
    head: [lineOf(C, block['sliding-window'])],
    limit: [lineAfter(C, block['sliding-window'], 'opt.PermitLimit')],
    segments: [lineAfter(C, block['sliding-window'], 'opt.Window'), lineAfter(C, block['sliding-window'], 'opt.SegmentsPerWindow')],
    queue: [lineAfter(C, block['sliding-window'], 'opt.QueueLimit')],
  },
  'token-bucket': {
    head: [lineOf(C, block['token-bucket'])],
    limit: [lineAfter(C, block['token-bucket'], 'opt.TokenLimit')],
    period: [lineAfter(C, block['token-bucket'], 'opt.TokensPerPeriod'), lineAfter(C, block['token-bucket'], 'opt.ReplenishmentPeriod'), lineAfter(C, block['token-bucket'], 'opt.AutoReplenishment')],
    queue: [lineAfter(C, block['token-bucket'], 'opt.QueueLimit')],
  },
  concurrency: {
    head: [lineOf(C, block.concurrency)],
    limit: [lineAfter(C, block.concurrency, 'opt.PermitLimit')],
    queue: [lineAfter(C, block.concurrency, 'opt.QueueLimit')],
  },
};

export function linesForStep(algo: Algo, step: Pick<RlStep, 'line'> | undefined): number[] {
  if (algo === 'leaky-bucket') return [1];
  const l = LIMITER_LINES[algo];
  return (step?.line ? l[step.line] : undefined) ?? l.head ?? [];
}
