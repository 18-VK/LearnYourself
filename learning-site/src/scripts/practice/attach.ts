/**
 * Practice mode ("Try it yourself", src/components/TryIt.astro): Start opens an editor with the starter code (the
 * note's method with its body emptied), Run tests compiles the learner's code with the exercise's test harness in the
 * C# runner (src/scripts/runner/host.ts, the same worker as Run) and shows pass/fail per case, and Show solution
 * reveals the note's own implementation. Loaded only on lessons that have exercises (#practice-data).
 */
import '../../styles/runner.css';
import type { LessonPractice, PracticeExerciseData } from '../../lib/practice';
import type { EditorHandle, Marker } from '../runner/editor';
import { runner, TIMEOUT_MS, type Diagnostic, type RunOutcome } from '../runner/host';
import { diff, parseCases, type CaseOutcome } from './protocol';

const data = JSON.parse(document.getElementById('practice-data')?.textContent ?? '{"downloadMB":7,"exercises":[]}') as LessonPractice;

let editorModule: Promise<typeof import('../runner/editor')> | null = null;
const loadEditor = () => (editorModule ??= import('../runner/editor'));

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

/** The result cell of one case: pass, or what the learner's code returned (lists item by item) or threw. */
function renderOutcome(cell: HTMLTableCellElement, c: CaseOutcome, expected: string, hint?: string): void {
  cell.replaceChildren();
  cell.dataset.status = c.status;
  cell.className = `practice-result is-${c.status}`;
  // a failed case says what it tests (the case's own description), which is the hint most learners need first
  const withHint = () => {
    if (hint && c.status !== 'pass' && c.status !== 'not-run') cell.append(el('span', { className: 'practice-hint', textContent: ` Tests: ${hint.replace(/^Generated:\s*/i, '')}` }));
  };
  switch (c.status) {
    case 'pass':
      cell.append(el('span', { className: 'practice-mark', textContent: '✓' }), ' pass');
      return;
    case 'not-run':
      cell.textContent = 'not run';
      return;
    case 'fail': {
      const d = diff(expected, c.actual ?? '');
      cell.append(el('span', { className: 'practice-mark', textContent: '✗' }), ' got ');
      const code = el('code', { className: 'practice-diff' });
      if (d.lists) {
        code.append('[');
        d.actual.forEach((p, i) => {
          if (i > 0) code.append(', ');
          code.append(p.differs ? el('mark', { textContent: p.text }) : p.text);
        });
        code.append(']');
        if (d.actual.length !== d.expected.length) code.append(el('span', { className: 'practice-note', textContent: ` (${d.actual.length} items, expected ${d.expected.length})` }));
      } else code.append(el('mark', { textContent: c.actual ?? '' }));
      cell.append(code);
      break;
    }
    case 'error':
      cell.append(el('span', { className: 'practice-mark', textContent: '✗' }), ' threw ', el('code', { textContent: c.error ?? 'an exception' }));
      break;
    case 'timeout':
      cell.append(el('span', { className: 'practice-mark', textContent: '✗' }), ` stopped after ${TIMEOUT_MS / 1000} seconds (an endless loop?)`);
      break;
    case 'crash':
      cell.append(el('span', { className: 'practice-mark', textContent: '✗' }), ' the program stopped during this case');
      break;
  }
  withHint();
}

/** The solution's lines, for the hint ladder: the method's signature stays, the body is revealed line by line. */
function hintLines(code: string): string[] {
  return code.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
}

function mount(article: HTMLElement, ex: PracticeExerciseData): void {
  const mountBox = article.querySelector<HTMLElement>('.practice-mount')!;
  const startBtn = mountBox.querySelector<HTMLButtonElement>('.practice-start')!;
  const table = article.querySelector<HTMLTableElement>('table.practice-cases')!;
  table.querySelector('thead tr')?.append(el('th', { scope: 'col', textContent: 'Result' }));
  const cells = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')].map((r) => {
    const td = el('td', { className: 'practice-result', textContent: 'not run' });
    td.dataset.status = 'not-run';
    r.append(td);
    return td;
  });
  const expected = ex.cases.map((c) => c.expected);
  const name = ex.title;
  let editor: EditorHandle | null = null;
  let running = false;

  // ── built on Start ──
  const box = el('div', { className: 'practice-work' });
  box.hidden = true;
  const bar = el('div', { className: 'runner-actions practice-toolbar' });
  const runBtn = button('Run tests', 'runner-run practice-run', `Run tests for ${name}`);
  const resetBtn = button('Reset', 'runner-reset', `Reset ${name} to the starter code`);
  // (the toggles keep their visible text as their name: it changes between Show and Hide)
  const solutionBtn = button('Show solution', 'practice-solution-toggle');
  solutionBtn.setAttribute('aria-expanded', 'false');
  const testsBtn = button('Show the tests', 'runner-harness-toggle');
  testsBtn.setAttribute('aria-expanded', 'false');
  const hintBtn = button('Hint', 'practice-hint-btn');
  bar.append(runBtn, resetBtn, hintBtn, solutionBtn, testsBtn);
  const editorHost = el('div', { className: 'runner-editor practice-editor' });
  const io = el('div', { className: 'runner-io' });
  const progress = el('div', { className: 'runner-progress' });
  progress.hidden = true;
  const bar2 = el('progress', { max: 1, value: 0 });
  bar2.setAttribute('aria-label', 'C# compiler download');
  const progressText = el('span', { textContent: `Loading the C# compiler, one-time download of about ${data.downloadMB} MB…` });
  progress.append(progressText, bar2);
  const status = el('p', { className: 'runner-status' });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const problems = el('ul', { className: 'runner-problems' });
  problems.hidden = true;
  const printedLabel = el('p', { className: 'runner-label', textContent: 'What your code printed' });
  const printed = el('pre', { className: 'runner-pre runner-output', tabIndex: 0 });
  printedLabel.hidden = printed.hidden = true;
  io.append(progress, status, problems, printedLabel, printed);
  const solution = el('div', { className: 'runner-harness practice-solution' });
  solution.hidden = true;
  solution.id = `solution-${ex.id}`;
  solutionBtn.setAttribute('aria-controls', solution.id);
  const useBtn = button('Put it in the editor', 'practice-use-solution');
  solution.append(
    el('p', { className: 'runner-note' }, el('strong', { textContent: `The note's implementation (C# block ${ex.solution.index} of this lesson). ` }), 'Compare it with yours, or load it to see the tests pass.'),
    el('pre', { className: 'runner-pre', tabIndex: 0, textContent: ex.solution.code }),
    el('div', { className: 'runner-harness-row' }, useBtn),
  );
  const tests = el('div', { className: 'runner-harness practice-tests' });
  tests.hidden = true;
  tests.id = `tests-${ex.id}`;
  testsBtn.setAttribute('aria-controls', tests.id);
  tests.append(
    el('p', { className: 'runner-note' }, el('strong', { textContent: 'Added code, not from the note. ' }), `The tests call ${ex.signature} once per case and print each result:`),
    el('pre', { className: 'runner-pre', tabIndex: 0, textContent: ex.harness }),
  );
  // the hint ladder: a faded worked example, one more line of the note's solution per press
  const lines = hintLines(ex.solution.code);
  const hints = el('div', { className: 'runner-harness practice-hints' });
  hints.hidden = true;
  const hintNote = el('p', { className: 'runner-note' });
  const hintCode = el('pre', { className: 'runner-pre practice-hint-code', tabIndex: 0 });
  hints.append(hintNote, hintCode);
  let shown = 0;
  hintBtn.addEventListener('click', () => {
    shown = Math.min(lines.length, shown + 1);
    hints.hidden = false;
    hintNote.replaceChildren(el('strong', { textContent: `Hint ${shown} of ${lines.length}: ` }), shown < lines.length ? "the first lines of the note's solution. Press Hint again for one more." : 'that is the whole solution.');
    hintCode.textContent = lines.slice(0, shown).join('\n') + (shown < lines.length ? '\n// …' : '');
    hintBtn.textContent = shown < lines.length ? 'Next hint' : 'Hint';
    hintBtn.disabled = shown >= lines.length;
    article.dataset.hints = String(shown);
  });
  box.append(bar, editorHost, io, hints, solution, tests);
  mountBox.after(box);

  const setStatus = (text: string, kind: 'info' | 'ok' | 'error' = 'info') => {
    status.textContent = text;
    status.dataset.kind = kind;
  };
  const toggle = (btn: HTMLButtonElement, body: HTMLElement, show: string, hide: string) =>
    btn.addEventListener('click', () => {
      body.hidden = !body.hidden;
      btn.setAttribute('aria-expanded', String(!body.hidden));
      btn.textContent = body.hidden ? show : hide;
    });
  toggle(solutionBtn, solution, 'Show solution', 'Hide solution');
  toggle(testsBtn, tests, 'Show the tests', 'Hide the tests');

  function showDiagnostics(list: Diagnostic[]): void {
    const errors = list.filter((d) => d.severity === 'error');
    problems.replaceChildren(...errors.map((d) => el('li', { textContent: `${d.file === 'harness.cs' ? 'Tests, line' : 'Line'} ${d.line}, column ${d.column}: ${d.id}: ${d.message}` })));
    if (errors.some((d) => d.file === 'harness.cs')) problems.append(el('li', { className: 'practice-note', textContent: `The tests call ${ex.signature}: keep that name and those parameters.` }));
    problems.hidden = errors.length === 0;
    editor?.setMarkers(errors.filter((d) => d.file === 'snippet.cs').map((d): Marker => ({ line: d.line, column: d.column, endLine: d.endLine, endColumn: d.endColumn, message: `${d.id}: ${d.message}`, kind: 'error' })));
  }

  function clear(): void {
    problems.replaceChildren();
    problems.hidden = true;
    editor?.setMarkers([]);
    printed.textContent = '';
    printedLabel.hidden = printed.hidden = true;
    delete article.dataset.passed;
    cells.forEach((td) => {
      td.textContent = 'not run';
      td.className = 'practice-result';
      td.dataset.status = 'not-run';
    });
  }

  function showCases(output: string, ended: 'completed' | 'timeout' | 'crash'): void {
    const cases = parseCases(output, expected, ended);
    cases.forEach((c, i) => renderOutcome(cells[i]!, c, expected[i]!, ex.cases[i]?.source));
    const passed = cases.filter((c) => c.status === 'pass').length;
    const all = passed === cases.length;
    article.dataset.passed = String(all);
    const text = cases.map((c) => c.printed).join('');
    if (text) {
      printed.textContent = text;
      printedLabel.hidden = printed.hidden = false;
    }
    if (ended === 'timeout') setStatus(`Stopped after ${TIMEOUT_MS / 1000} seconds: a test was still running (an endless loop?). ${passed} of ${cases.length} passed before that.`, 'error');
    else if (ended === 'crash') setStatus(`The program stopped before the tests finished. ${passed} of ${cases.length} passed.`, 'error');
    else setStatus(all ? `All ${plural(cases.length, 'test')} pass.` : `${passed} of ${plural(cases.length, 'test')} pass. Look at the cases marked ✗ and try again.`, all ? 'ok' : 'error');
  }

  function showOutcome(o: RunOutcome): void {
    if (o.kind === 'timeout') return showCases(o.output, 'timeout');
    if (o.kind === 'fatal') return setStatus(`The C# runner stopped working: ${o.message}. Reload the page to try again.`, 'error');
    const r = o.result;
    if (r.internalError) {
      setStatus('The C# runner hit an internal error. Reload the page to try again.', 'error');
      problems.replaceChildren(el('li', { textContent: r.internalError.split('\n')[0] ?? '' }));
      problems.hidden = false;
      return;
    }
    if (r.problem) return setStatus(r.problem, 'error');
    if (!r.compiled) {
      const errors = (r.diagnostics ?? []).filter((d) => d.severity === 'error');
      setStatus(errors.length ? `It doesn't compile: ${plural(errors.length, 'error')}.` : 'There is nothing to test: the code declares no method.', 'error');
      showDiagnostics(r.diagnostics ?? []);
      return;
    }
    const run = r.run!;
    if (run.outcome === 'output-limit') setStatus('Stopped: the code printed too much output.', 'error');
    showCases(o.output, run.outcome === 'exception' ? 'crash' : 'completed');
    if (run.outcome === 'exception' && run.error) {
      problems.replaceChildren(el('li', { textContent: `Unhandled ${run.error.type}${run.error.line ? ` at line ${run.error.line}` : ''}: ${run.error.message}` }));
      problems.hidden = false;
    }
  }

  async function run(): Promise<void> {
    if (running || !editor) return;
    running = true;
    runBtn.disabled = true;
    runBtn.setAttribute('aria-busy', 'true');
    clear();
    try {
      const outcome = await runner.run(
        { code: editor.getCode(), harness: ex.harness, stdin: '' },
        {
          onPhase: (p) => {
            progress.hidden = p !== 'loading';
            setStatus(p === 'loading' ? '' : p === 'compiling' ? 'Compiling…' : 'Running the tests…');
          },
          onProgress: (loaded, total) => {
            progress.hidden = false;
            bar2.value = total ? loaded / total : 0;
            progressText.textContent = `Loading the C# compiler, one-time download of about ${data.downloadMB} MB… ${total ? Math.round((loaded / total) * 100) : 0} %`;
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

  async function start(): Promise<void> {
    startBtn.disabled = true;
    runner.warmUp(); // the learner will press Run tests soon: get the compiler ready meanwhile
    const { createEditor } = await loadEditor();
    editor = createEditor(editorHost, ex.starter, { label: `${name}: your C# code`, onRun: () => void run() });
    mountBox.hidden = true;
    box.hidden = false;
    article.dataset.started = 'true';
    setStatus('Write the method, then press Run tests (or Ctrl+Enter in the editor).');
    editor.focus();
  }

  startBtn.addEventListener('click', () => void start());
  runBtn.addEventListener('click', () => void run());
  resetBtn.addEventListener('click', () => {
    clear();
    editor?.setCode(ex.starter);
    setStatus('Back to the starter code.');
  });
  useBtn.addEventListener('click', () => {
    clear();
    editor?.setCode(ex.solution.code);
    setStatus("The note's solution is in the editor. Press Run tests to see it pass.");
    editor?.focus();
  });
}

for (const ex of data.exercises) {
  const article = document.querySelector<HTMLElement>(`.practice-exercise[data-exercise="${ex.id}"]`);
  if (article) mount(article, ex);
}
document.body.dataset.practiceReady = 'true';
