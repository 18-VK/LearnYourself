/**
 * Edit / Run / Reset on runnable C# blocks (the ones listed in #runnable-data, decided at build time).
 *
 * Loaded by src/scripts/lesson.ts only on lessons that have runnable blocks. It adds buttons and an output panel to
 * each block; CodeMirror loads on the first Edit and the .NET runner (a Web Worker) on the first Run.
 */
import '../../styles/runner.css';
import type { LessonRunnable, RunnableBlockData } from '../../lib/runnable';
import { runnerActions, type RunnerBlockContext } from './actions';
import type { EditorHandle, Marker } from './editor';
import { codeHash } from './hash';
import { MAX_OUTPUT, runner, TIMEOUT_MS, type Diagnostic, type RunOutcome, type WorkerResult } from './host';

const CSHARP = new Set(['csharp', 'cs', 'c#']);
const data = JSON.parse(document.getElementById('runnable-data')?.textContent ?? '{"blocks":[]}') as LessonRunnable;

let editorModule: Promise<typeof import('./editor')> | null = null;
const loadEditor = () => (editorModule ??= import('./editor'));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...children);
  return e;
}
const button = (label: string, className: string, aria?: string) => {
  const b = el('button', { type: 'button', className: `runner-btn ${className}`, textContent: label });
  if (aria) b.setAttribute('aria-label', aria);
  return b;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const kb = (chars: number) => `${Math.round(chars / 1024)} KB`;

function describeExpected(entry: RunnableBlockData): HTMLElement | null {
  const box = el('div', { className: 'runner-expected' });
  if (entry.varies) {
    box.append(el('p', { className: 'runner-label', textContent: 'Expected output' }), el('p', { className: 'runner-note', textContent: 'The output changes from run to run (for example random numbers or the current time), so none is shown here.' }));
    return box;
  }
  if (!entry.expected) {
    if (!entry.readsInput) return null;
    box.append(el('p', { className: 'runner-note', textContent: 'This program reads input with Console.ReadLine(). Type the input into the Input box under the code, then press Run.' }));
    return box;
  }
  const e = entry.expected;
  let text = e.stdout.replace(/\n$/, '');
  if (e.error) text += `${text ? '\n' : ''}Unhandled exception: ${e.error.type}: ${e.error.message}${e.error.line ? ` (line ${e.error.line})` : ''}`;
  if (e.outcome === 'output-limit') text += `\n… (stopped: more than ${kb(MAX_OUTPUT)} of output)`;
  box.append(el('p', { className: 'runner-label', textContent: 'Expected output' }), el('pre', { className: 'runner-pre', tabIndex: 0, textContent: text || '(no output)' }));
  return box;
}

function mount(frame: HTMLElement, entry: RunnableBlockData, ordinal: number): void {
  const pre = frame.querySelector('pre')!;
  const head = frame.querySelector('.code-head');
  const original = entry.code ?? pre.textContent ?? '';
  const name = `C# example ${ordinal}`;
  let editor: EditorHandle | null = null;
  let editorHost: HTMLElement | null = null;
  let running = false;

  // ── toolbar ──
  const bar = el('span', { className: 'runner-actions' });
  const editBtn = button('Edit', 'runner-edit', `Edit ${name}`);
  const runBtn = button('Run', 'runner-run', `Run ${name}`);
  const resetBtn = button('Reset', 'runner-reset', `Reset ${name} to the note's code`);
  resetBtn.hidden = true;
  bar.append(editBtn, runBtn, resetBtn);
  head?.insertBefore(bar, head.querySelector('.code-copy'));
  frame.classList.add('is-runnable');
  frame.dataset.runId = entry.id;

  // ── panel under the block ──
  const panel = el('div', { className: 'runner' });
  panel.dataset.runId = entry.id;
  if (entry.merged?.length) {
    const first = entry.merged[0]!;
    panel.append(el('p', { className: 'runner-note', textContent: `Runs together with the block${entry.merged.length > 1 ? 's' : ''} above: this program is C# blocks ${first}–${entry.index} of this lesson, in order.` }));
  }
  const io = el('div', { className: 'runner-io' });
  io.hidden = true;
  const stdinId = `stdin-${entry.id.replace(/[^\w-]/g, '_')}`;
  const stdin = el('textarea', { className: 'runner-stdin', id: stdinId, rows: 2, spellcheck: false, value: entry.stdin });
  stdin.setAttribute('autocapitalize', 'off');
  const stdinLabel = el('label', { className: 'runner-label', htmlFor: stdinId, textContent: 'Input (stdin): one line per Console.ReadLine()' });
  const stdinBox = el('div', { className: 'runner-stdin-box' }, stdinLabel, stdin);
  const progress = el('div', { className: 'runner-progress' });
  progress.hidden = true;
  const bar2 = el('progress', { max: 1, value: 0 });
  const progressText = el('span', { textContent: `Loading the C# compiler, one-time download of about ${data.downloadMB ?? 7} MB…` });
  bar2.setAttribute('aria-label', 'C# compiler download');
  progress.append(progressText, bar2);
  const status = el('p', { className: 'runner-status' });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const outLabel = el('p', { className: 'runner-label', textContent: 'Output' });
  const output = el('pre', { className: 'runner-pre runner-output', tabIndex: 0 });
  output.setAttribute('aria-label', `Output of ${name}`);
  const problems = el('ul', { className: 'runner-problems' });
  problems.hidden = true;
  io.append(stdinBox, progress, status, problems, outLabel, output);
  panel.append(io);
  const expected = describeExpected(entry);
  if (expected) panel.append(expected);
  if (entry.harness) {
    const toggle = button('Show harness', 'runner-harness-toggle');
    toggle.setAttribute('aria-expanded', 'false');
    const body = el('div', { className: 'runner-harness' });
    body.hidden = true;
    body.id = `harness-${entry.id.replace(/[^\w-]/g, '_')}`;
    toggle.setAttribute('aria-controls', body.id);
    body.append(
      el('p', { className: 'runner-note' }, el('strong', { textContent: 'Added code, not from the note. ' }), `To run this example, the runner calls the note's code with the note's own sample input${entry.input ? ` (${entry.input})` : ''}:`),
      el('pre', { className: 'runner-pre', tabIndex: 0, textContent: entry.harness }),
    );
    toggle.addEventListener('click', () => {
      body.hidden = !body.hidden;
      toggle.setAttribute('aria-expanded', String(!body.hidden));
      toggle.textContent = body.hidden ? 'Show harness' : 'Hide harness';
    });
    panel.append(el('div', { className: 'runner-harness-row' }, toggle), body);
  }
  frame.after(panel);
  if (entry.readsInput || entry.stdin) io.hidden = false;

  // ── helpers ──
  const setStatus = (text: string, kind: 'info' | 'ok' | 'error' = 'info') => {
    status.textContent = text;
    status.dataset.kind = kind;
  };
  const clearMarks = () => {
    pre.querySelectorAll('.runner-mark').forEach((l) => l.classList.remove('runner-mark'));
    editor?.setMarkers([]);
    problems.replaceChildren();
    problems.hidden = true;
  };
  const markStaticLine = (line: number) => {
    const lines = pre.querySelectorAll('code > .line');
    lines[line - 1]?.classList.add('runner-mark');
  };
  const getCode = () => editor?.getCode() ?? original;

  async function openEditor(): Promise<EditorHandle> {
    if (editor) return editor;
    const { createEditor } = await loadEditor();
    if (editor) return editor;
    editorHost = el('div', { className: 'runner-editor' });
    pre.after(editorHost);
    editor = createEditor(editorHost, original, { label: `${name} (editable C# code)`, onRun: () => void run() });
    pre.hidden = true;
    editBtn.hidden = true;
    resetBtn.hidden = false;
    io.hidden = false;
    return editor;
  }

  // the Copy button copies what is in the editor once it is open
  frame.querySelector('.code-copy')?.addEventListener('click', (e) => {
    if (!editor) return;
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    void navigator.clipboard?.writeText(editor.getCode()).then(
      () => {
        btn.textContent = 'Copied';
        window.setTimeout(() => (btn.textContent = 'Copy'), 1600);
      },
      () => undefined,
    );
  });

  function showDiagnostics(list: Diagnostic[]): void {
    const errors = list.filter((d) => d.severity === 'error');
    const inCode = errors.filter((d) => d.file === 'snippet.cs');
    problems.replaceChildren(
      ...errors.map((d) =>
        el('li', { textContent: `${d.file === 'harness.cs' ? 'Harness, line' : 'Line'} ${d.line}, column ${d.column}: ${d.id}: ${d.message}` }),
      ),
    );
    problems.hidden = errors.length === 0;
    editor?.setMarkers(inCode.map((d): Marker => ({ line: d.line, column: d.column, endLine: d.endLine, endColumn: d.endColumn, message: `${d.id}: ${d.message}`, kind: 'error' })));
  }

  function showOutcome(o: RunOutcome): void {
    output.textContent = o.output;
    if (o.kind === 'timeout') {
      output.textContent = o.output + (o.output && !o.output.endsWith('\n') ? '\n' : '');
      setStatus(`Stopped after ${TIMEOUT_MS / 1000} seconds: the program was still running (an endless loop?). The C# runner was restarted.`, 'error');
      panel.dataset.outcome = 'timeout';
      return;
    }
    if (o.kind === 'fatal') {
      setStatus(`The C# runner stopped working: ${o.message}. Reload the page to try again.`, 'error');
      panel.dataset.outcome = 'fatal';
      return;
    }
    const r: WorkerResult = o.result;
    // timings for tests and measurements (runner/spike/measure.mjs)
    if (r.compileMs !== undefined) panel.dataset.compileMs = String(Math.round(r.compileMs));
    if (r.run) panel.dataset.runMs = String(Math.round(r.run.ms));
    if (r.internalError) {
      setStatus('The C# runner hit an internal error. Reload the page to try again.', 'error');
      problems.replaceChildren(el('li', { textContent: r.internalError.split('\n')[0] ?? '' }));
      problems.hidden = false;
      panel.dataset.outcome = 'fatal';
      return;
    }
    if (r.problem) {
      setStatus(r.problem, 'error');
      panel.dataset.outcome = 'problem';
      return;
    }
    if (!r.compiled) {
      const errors = (r.diagnostics ?? []).filter((d) => d.severity === 'error');
      if (!errors.length) {
        setStatus('There is nothing to run: the code only declares types or methods. Add statements that call them.', 'error');
        panel.dataset.outcome = 'nothing';
        return;
      }
      const onlyHarness = errors.every((d) => d.file === 'harness.cs');
      setStatus(
        onlyHarness
          ? `It doesn't compile: ${plural(errors.length, 'error')} in the harness, which calls the note's code. Keep the names it uses, or press Reset.`
          : `It doesn't compile: ${plural(errors.length, 'error')}.`,
        'error',
      );
      showDiagnostics(r.diagnostics ?? []);
      panel.dataset.outcome = 'compile-error';
      // show the messages on their lines
      if (!editor && errors.some((d) => d.file === 'snippet.cs')) void openEditor().then(() => showDiagnostics(r.diagnostics ?? []));
      return;
    }
    const run = r.run!;
    panel.dataset.outcome = run.outcome;
    if (!o.output) output.textContent = '(no output)';
    if (run.outcome === 'output-limit') {
      output.textContent = `${o.output}\n…`;
      setStatus(`Stopped: the program printed more than ${kb(MAX_OUTPUT)} of output.`, 'error');
      return;
    }
    if (run.outcome === 'exception' && run.error) {
      const e = run.error;
      const where = e.line ? ` at ${e.file === 'harness.cs' ? 'harness line' : 'line'} ${e.line}` : '';
      output.append(el('span', { className: 'runner-exception', textContent: `${o.output && !o.output.endsWith('\n') ? '\n' : ''}Unhandled exception${where}: ${e.type}: ${e.message}` }));
      setStatus(`The program threw ${e.type.split('.').pop()}${where}.`, 'error');
      if (e.file === 'snippet.cs' && e.line) {
        const marker: Marker = { line: e.line, column: 1, endLine: e.line, endColumn: 1, message: `${e.type}: ${e.message}`, kind: 'exception' };
        if (editor) editor.setMarkers([marker]);
        // a merged program's line numbers count across its blocks, so show them in the editor (which holds all of it)
        else if (entry.merged?.length) void openEditor().then((ed) => ed.setMarkers([marker]));
        else markStaticLine(e.line);
      }
      return;
    }
    const same = Boolean(entry.expected && entry.expected.outcome === 'completed' && o.output === entry.expected.stdout);
    panel.dataset.matches = String(same);
    setStatus(`Finished in ${run.ms < 10 ? run.ms.toFixed(1) : Math.round(run.ms)} ms${run.exitCode ? ` with exit code ${run.exitCode}` : ''}${same ? ': same as the expected output' : ''}.`, 'ok');
  }

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    runBtn.disabled = true;
    runBtn.setAttribute('aria-busy', 'true');
    io.hidden = false;
    resetBtn.hidden = false;
    clearMarks();
    output.textContent = '';
    delete panel.dataset.outcome;
    delete panel.dataset.matches;
    try {
      const outcome = await runner.run(
        { code: getCode(), harness: entry.harness ?? null, stdin: stdin.value },
        {
          onPhase: (p) => {
            progress.hidden = p !== 'loading';
            setStatus(p === 'loading' ? '' : p === 'compiling' ? 'Compiling…' : 'Running…');
          },
          onProgress: (loaded, total) => {
            progress.hidden = false;
            bar2.value = total ? loaded / total : 0;
            progressText.textContent = `Loading the C# compiler, one-time download of about ${data.downloadMB ?? 7} MB… ${total ? Math.round((loaded / total) * 100) : 0} %`;
          },
          onOutput: (text) => {
            output.textContent += text;
          },
        },
      );
      progress.hidden = true;
      showOutcome(outcome);
    } finally {
      running = false;
      runBtn.disabled = false;
      runBtn.removeAttribute('aria-busy');
    }
  }

  editBtn.addEventListener('click', async () => {
    runner.warmUp(); // the learner will probably press Run next: get the compiler ready meanwhile
    const ed = await openEditor();
    ed.focus();
  });
  runBtn.addEventListener('click', () => void run());
  resetBtn.addEventListener('click', () => {
    clearMarks();
    editor?.setCode(original);
    stdin.value = entry.stdin;
    output.textContent = '';
    setStatus('Back to the code from the note.');
    delete panel.dataset.outcome;
  });

  const ctx: RunnerBlockContext = {
    id: entry.id,
    index: entry.index,
    frame,
    panel,
    getCode,
    harness: entry.harness ?? null,
    stdin: () => stdin.value,
    openEditor,
    setStatus,
    run: (callbacks) => runner.run({ code: getCode(), harness: entry.harness ?? null, stdin: stdin.value }, callbacks),
  };
  for (const action of runnerActions()) {
    const b = button(action.label, `runner-${action.id}`, `${action.label} ${name}`);
    b.addEventListener('click', () => void action.onClick(ctx));
    bar.insertBefore(b, (action.order ?? 50) < 30 ? resetBtn : null);
  }
}

/** Extensions that add buttons through registerRunnerAction (the debugger will be imported here). */
async function loadExtensions(): Promise<void> {}

function mountAll(): void {
  const frames = [...document.querySelectorAll<HTMLElement>('#lesson-body figure.code-frame')].filter((f) => CSHARP.has(f.dataset.lang ?? ''));
  for (const entry of data.blocks) {
    const frame = frames[entry.index - 1];
    const pre = frame?.querySelector('pre');
    // never attach a program to a block whose code is not the one the build checked
    if (!frame || !pre || codeHash(pre.textContent ?? '') !== entry.hash) continue;
    mount(frame, entry, entry.index);
  }
  document.body.dataset.runnerReady = 'true';
}

void loadExtensions().then(mountAll);
