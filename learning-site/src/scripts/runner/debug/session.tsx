/**
 * One debugging session per code block: runs the program in debug mode (the worker records a trace), then shows the
 * panel (Panel.tsx) under the block and the current line in the code. Pressing Debug again records a new trace.
 *
 * Where the current line and breakpoints live: the code block as rendered (code-view.ts) until the learner opens the
 * editor, then the editor (editor-view.ts); breakpoints carry over. A merged program's line numbers count across
 * several blocks, so it is always debugged in the editor, which holds all of it.
 */
import '../../../styles/debugger.css';
import { createRoot, type Root } from 'react-dom/client';
import type { RunnerBlockContext } from '../actions';
import type { EditorHandle } from '../editor';
import { staticView, type CodeView } from './code-view';
import { editorView } from './editor-view';
import { DebuggerPanel } from './Panel';
import { Trace } from './trace';

interface Session {
  box: HTMLElement;
  root: Root;
  view: CodeView | null;
  viewKey: number;
  bpKey: number;
  stale: boolean;
  props: { trace: Trace; output: string; outcome: string } | null;
  cleanups: (() => void)[];
}

const sessions = new WeakMap<HTMLElement, Session>();
/** Breakpoints per code block: they survive Stop and Debug again. */
const breakpoints = new WeakMap<HTMLElement, Set<number>>();

function describeFailure(ctx: RunnerBlockContext, kind: string, reason?: string | null): void {
  if (kind === 'timeout') ctx.setStatus('The program was stopped after 5 seconds before any steps could be shown. The C# runner was restarted.', 'error');
  else if (kind === 'untraceable') ctx.setStatus(`This program runs, but it can't be stepped through${reason ? ` (${reason})` : ''}. Use Run instead.`, 'error');
  else ctx.setStatus('The debugger got no steps back from the C# runner. Try Run instead.', 'error');
}

export async function startDebugging(ctx: RunnerBlockContext): Promise<void> {
  if (ctx.merged && !ctx.editor()) await ctx.openEditor();
  const s = sessions.get(ctx.frame) ?? createSession(ctx);
  ctx.setStatus('Recording every step of the program…');
  const outcome = await ctx.debug();
  if (!outcome) return; // compile errors or a runner failure: already shown by the Run UI
  const r = outcome.kind === 'result' ? outcome.result : null;
  if (r?.debug && r.debug.level < 0) return describeFailure(ctx, 'untraceable', r.debug.error);
  if (!outcome.trace) return describeFailure(ctx, outcome.kind === 'timeout' ? 'timeout' : 'none');
  const trace = Trace.parse(outcome.trace);
  if (!trace.length) return describeFailure(ctx, 'none');

  s.props = { trace, output: outcome.output, outcome: outcome.kind === 'timeout' ? 'timeout' : (r?.run?.outcome ?? 'completed') };
  s.stale = false;
  ensureView(ctx, s);
  const steps = trace.length.toLocaleString('en-US');
  ctx.setStatus(`Debugging: ${steps} step${trace.length === 1 ? '' : 's'} recorded. Step through them below, or set breakpoints by clicking line numbers.`, 'ok');
  ctx.panel.dataset.debug = 'on';
  render(ctx, s);
  // the first control, so keyboard users land in the debugger
  s.box.querySelector<HTMLButtonElement>('.dbg-toolbar button:not(:disabled)')?.focus({ preventScroll: true });
}

function createSession(ctx: RunnerBlockContext): Session {
  const box = document.createElement('section');
  box.className = 'dbg';
  box.setAttribute('aria-label', `Debugger for ${ctx.name}`);
  // right under the code block, above Run's input and output
  ctx.panel.prepend(box);
  const s: Session = { box, root: createRoot(box), view: null, viewKey: 0, bpKey: 0, stale: false, props: null, cleanups: [] };
  sessions.set(ctx.frame, s);
  // opening the editor mid-session moves the current line and breakpoints into it
  s.cleanups.push(
    ctx.onEditorOpen((ed) => {
      if (!s.props) return;
      attachEditor(ctx, s, ed);
      render(ctx, s);
    }),
  );
  return s;
}

/** Picks the view: the editor when it is open, otherwise the rendered code block. */
function ensureView(ctx: RunnerBlockContext, s: Session): void {
  const ed = ctx.editor();
  if (ed) {
    if (!s.view || s.view.kind !== 'editor') attachEditor(ctx, s, ed);
    return;
  }
  if (s.view) return;
  setView(ctx, s, Object.assign(staticView(ctx.pre, ctx.name), { kind: 'static' as const }));
}

function attachEditor(ctx: RunnerBlockContext, s: Session, ed: EditorHandle): void {
  const view = editorView(ed, () => {
    if (s.stale || !s.props) return;
    s.stale = true;
    render(ctx, s);
  });
  setView(ctx, s, Object.assign(view, { kind: 'editor' as const }));
}

function setView(ctx: RunnerBlockContext, s: Session, view: CodeView): void {
  const marks = breakpoints.get(ctx.frame) ?? new Set<number>();
  if (s.view) {
    for (const l of s.view.breakpoints()) marks.add(l);
    s.view.destroy();
  }
  breakpoints.set(ctx.frame, marks);
  view.setBreakpoints(marks);
  s.view = view;
  s.viewKey++;
  s.cleanups.push(
    view.onBreakpoints(() => {
      breakpoints.set(ctx.frame, view.breakpoints());
      s.bpKey++;
      render(ctx, s);
    }),
  );
}

function render(ctx: RunnerBlockContext, s: Session): void {
  if (!s.props) return;
  s.root.render(
    <DebuggerPanel
      trace={s.props.trace}
      output={s.props.output}
      outcome={s.props.outcome}
      harness={ctx.harness}
      name={ctx.name}
      view={s.view}
      viewKey={s.viewKey}
      bpKey={s.bpKey}
      stale={s.stale}
      keyTargets={[s.box, ctx.frame]}
      onStop={() => stop(ctx, s)}
      onDebugAgain={() => void startDebugging(ctx)}
    />,
  );
}

function stop(ctx: RunnerBlockContext, s: Session): void {
  if (s.view) {
    breakpoints.set(ctx.frame, s.view.breakpoints());
    s.view.destroy();
  }
  for (const c of s.cleanups) c();
  s.root.unmount();
  s.box.remove();
  sessions.delete(ctx.frame);
  delete ctx.panel.dataset.debug;
  ctx.setStatus('Debugging stopped.');
  ctx.frame.querySelector<HTMLButtonElement>('.runner-debug')?.focus({ preventScroll: true });
}
