/**
 * Lanes over time, shared by the async/await and thread-pool visualizers. A lane is a thread, a task or a
 * timer; a segment says what that lane is doing between two instants. Segments left open (`to: null`) run
 * up to the current time `now`.
 */
export type SegKind =
  /** code running on this thread */
  | 'run'
  /** the thread exists but can do nothing else (blocked in .Result, Thread.Sleep, lock wait) */
  | 'blocked'
  /** the thread is free for other work */
  | 'free'
  /** a task or timer is waiting; no thread is tied up */
  | 'wait'
  /** a task holds a semaphore slot while it awaits */
  | 'inside'
  /** finished */
  | 'done';

export interface Lane {
  id: string;
  label: string;
  /** Second line under the label, e.g. "no thread" for a timer. */
  sub?: string;
  /** Lanes with the same group are drawn under one heading. */
  group?: string;
}

export interface Seg {
  lane: string;
  from: number;
  to: number | null;
  kind: SegKind;
  label?: string;
}

export interface TimelineState {
  /** Current time in ms. */
  now: number;
  /** Right end of the axis in ms. */
  axis: number;
  lanes: Lane[];
  segs: Seg[];
  /** Lanes that changed in this step (drawn with the active outline). */
  focus: string[];
  /** One-line status per lane at `now`. */
  status: Record<string, string>;
  output: string[];
}

/** Mutable builder used by trace generators. */
export class Timeline {
  state: TimelineState;
  constructor(lanes: Lane[], axis: number) {
    this.state = { now: 0, axis, lanes, segs: [], focus: [], status: {}, output: [] };
  }
  at(t: number): this {
    if (t < this.state.now) throw new Error(`time went backwards: ${t} < ${this.state.now}`);
    this.state.now = t;
    return this;
  }
  /** Closes the lane's open segment (if any) at `now` and opens a new one. */
  open(lane: string, kind: SegKind, label?: string): this {
    this.close(lane);
    this.state.segs.push({ lane, from: this.state.now, to: null, kind, label });
    return this;
  }
  close(lane: string): this {
    for (const s of this.state.segs) if (s.lane === lane && s.to === null) s.to = this.state.now;
    return this;
  }
  /** The kind of the lane's open segment, if any. */
  current(lane: string): SegKind | null {
    return this.state.segs.find((s) => s.lane === lane && s.to === null)?.kind ?? null;
  }
  status(lane: string, text: string): this {
    this.state.status[lane] = text;
    return this;
  }
  print(line: string): this {
    this.state.output.push(line);
    return this;
  }
  focus(...lanes: string[]): this {
    this.state.focus = lanes;
    return this;
  }
  /** Total ms the lane spent in segments of `kind` up to `now`. */
  total(lane: string, kind: SegKind): number {
    return this.state.segs.filter((s) => s.lane === lane && s.kind === kind).reduce((n, s) => n + ((s.to ?? this.state.now) - s.from), 0);
  }
}
