/**
 * Runnable SQL on lesson pages: Edit / Run / Reset on the SQL blocks the build found runnable
 * (scripts/sqlrun/check.ts → #sqlrun-data), and small labels on the blocks that aren't: "T-SQL only", "SQLite could
 * give a different result", and "Sample data" on setup blocks.
 *
 * Same buttons, panel and editor as the C# runner (src/scripts/runner/*, styled by runner.css); sql.js loads in a Web
 * Worker on the first Run (src/scripts/sqlrun/host.ts) and every run starts from the lesson's own sample data.
 */
import '../../styles/runner.css';
import '../../styles/sqlrun.css';
import type { ExpectedStatement, LessonSqlRunPage, SqlLabel, SqlRunnableBlock } from '../../lib/sqlrun';
import type { EditorHandle } from '../runner/editor';
import { codeHash } from '../runner/hash';
import { dialectFindings, groupingFindings } from './classify';
import type { Cell, RunResult } from './engine';
import { sqlHost, TIMEOUT_MS } from './host';

const SQL_LANGS = new Set(['sql', 'tsql', 'mssql']);
const data = JSON.parse(document.getElementById('sqlrun-data')?.textContent ?? '{"blocks":[],"labels":[],"setups":{}}') as LessonSqlRunPage;

let editorModule: Promise<{ createEditor: typeof import('../runner/editor').createEditor; sql: import('@codemirror/state').Extension }> | null = null;
const loadEditor = () =>
  (editorModule ??= Promise.all([import('../runner/editor'), import('@codemirror/language'), import('@codemirror/legacy-modes/mode/sql')]).then(([ed, lang, modes]) => ({
    createEditor: ed.createEditor,
    sql: lang.StreamLanguage.define(modes.msSQL),
  })));

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

// ── result tables ───────────────────────────────────────────────────────────────────────────
interface ShownStatement {
  kind: 'rows' | 'changes' | 'none';
  columns?: string[];
  rows?: Cell[][];
  total?: number;
  truncated?: boolean;
  changes?: number;
  order?: ExpectedStatement['order'];
}

function renderTable(columns: string[], rows: Cell[][], caption: string): HTMLElement {
  const table = el('table', { className: 'sqlrun-table' });
  table.append(el('caption', { textContent: caption }));
  const head = el('tr');
  for (const c of columns) head.append(el('th', { scope: 'col', textContent: c }));
  table.append(el('thead', {}, head));
  const body = el('tbody');
  for (const r of rows) {
    const tr = el('tr');
    for (const v of r) tr.append(v === null ? el('td', { className: 'sqlrun-null', textContent: 'NULL' }) : el('td', { textContent: v }));
    body.append(tr);
  }
  table.append(body);
  const wrap = el('div', { className: 'table-wrap sqlrun-table-wrap', tabIndex: 0 });
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', caption);
  wrap.append(table);
  return wrap;
}

const ORDER_NOTES = {
  none: 'No ORDER BY: SQL Server may return these rows in a different order.',
  ties: 'Rows that tie on the ORDER BY columns may come out in another order on SQL Server.',
};

function renderStatements(list: ShownStatement[], context: string): HTMLElement {
  const box = el('div', { className: 'sqlrun-results' });
  const queries = list.filter((s) => s.kind === 'rows').length;
  let q = 0;
  for (const s of list) {
    if (s.kind === 'changes') box.append(el('p', { className: 'sqlrun-message', textContent: `(${plural(s.changes ?? 0, 'row')} affected)` }));
    if (s.kind !== 'rows') continue;
    q++;
    const total = s.total ?? s.rows?.length ?? 0;
    const caption = `${context}${queries > 1 ? ` ${q} of ${queries}` : ''}: ${plural(total, 'row')}`;
    box.append(renderTable(s.columns ?? [], s.rows ?? [], caption));
    if (s.truncated) box.append(el('p', { className: 'runner-note', textContent: `Showing the first ${s.rows?.length ?? 0} of ${total} rows.` }));
    if (s.order) box.append(el('p', { className: 'runner-note sqlrun-order', textContent: ORDER_NOTES[s.order] }));
  }
  if (!list.length) box.append(el('p', { className: 'sqlrun-message', textContent: '(nothing to show)' }));
  return box;
}

/** Same rows and columns as the build recorded (row order included: SQLite's order is the same in both runs). */
const sameAsExpected = (got: RunResult, expected: ExpectedStatement[]) =>
  got.statements.length === expected.length &&
  got.statements.every((s, i) => {
    const e = expected[i]!;
    if (s.kind !== e.kind) return false;
    if (s.kind === 'changes') return s.changes === e.changes;
    if (s.kind !== 'rows') return true;
    return JSON.stringify(s.table!.columns) === JSON.stringify(e.columns) && JSON.stringify(s.table!.rows) === JSON.stringify(e.rows) && s.table!.total === e.total;
  });

// ── labels on blocks without a Run button ──────────────────────────────────────────────────
const LABEL_TEXT: Record<SqlLabel['kind'], string> = {
  'tsql-only': 'T-SQL only — runs on SQL Server, not in the browser',
  typing: 'Not run in the browser: SQLite could return a different result',
  setup: 'Sample data for the Run buttons below',
};

function addLabel(frame: HTMLElement, label: SqlLabel): void {
  const head = frame.querySelector('.code-head');
  if (!head) return;
  const span = el('span', { className: `sqlrun-label sqlrun-label-${label.kind}` });
  span.append(LABEL_TEXT[label.kind]);
  if (label.kind !== 'setup' && label.construct) span.append(el('span', { className: 'sqlrun-label-why', textContent: ` (${label.construct})` }));
  span.title = label.detail;
  frame.dataset.sqlLabel = label.kind;
  head.insertBefore(span, head.querySelector('.code-copy'));
}

// ── a runnable block ────────────────────────────────────────────────────────────────────────
function mount(frame: HTMLElement, entry: SqlRunnableBlock): void {
  const pre = frame.querySelector('pre')!;
  const head = frame.querySelector('.code-head');
  const original = pre.textContent ?? '';
  const name = `SQL example ${entry.index}`;
  const setup = entry.setup ? data.setups[entry.setup] : undefined;
  let editor: EditorHandle | null = null;
  let running = false;

  const bar = el('span', { className: 'runner-actions' });
  const editBtn = button('Edit', 'runner-edit', `Edit ${name}`);
  const runBtn = button('Run', 'runner-run', `Run ${name}`);
  const resetBtn = button('Reset', 'runner-reset', `Reset ${name} to the note's code`);
  resetBtn.hidden = true;
  bar.append(editBtn, runBtn, resetBtn);
  head?.insertBefore(bar, head.querySelector('.code-copy'));
  frame.classList.add('is-runnable', 'is-sql-runnable');
  frame.dataset.sqlRunId = entry.id;

  const panel = el('div', { className: 'runner sqlrun' });
  panel.dataset.sqlRunId = entry.id;
  const io = el('div', { className: 'runner-io' });
  io.hidden = true;
  const status = el('p', { className: 'runner-status' });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const problems = el('ul', { className: 'runner-problems' });
  problems.hidden = true;
  const output = el('div', { className: 'sqlrun-output' });
  const hint = el('p', { className: 'runner-note sqlrun-hint' });
  hint.hidden = true;
  io.append(status, problems, output, hint);
  panel.append(io);

  const toggles = el('div', { className: 'runner-harness-row sqlrun-toggles' });
  const sections: HTMLElement[] = [];
  const toggle = (label: string, hide: string, body: HTMLElement) => {
    const b = button(label, 'runner-harness-toggle');
    body.hidden = true;
    body.id = `${label.replace(/\W+/g, '-').toLowerCase()}-${entry.id.replace(/[^\w-]/g, '_')}`;
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', body.id);
    b.addEventListener('click', () => {
      body.hidden = !body.hidden;
      b.setAttribute('aria-expanded', String(!body.hidden));
      b.textContent = body.hidden ? label : hide;
    });
    toggles.append(b);
    sections.push(body);
  };
  const expectedBox = el('div', { className: 'runner-expected sqlrun-expected' });
  expectedBox.append(
    el('p', { className: 'runner-note', textContent: 'Recorded when the site was built, by running this block in SQLite (sql.js) on the sample data. The build also checked that SQL Server gives the same rows.' }),
    renderStatements(entry.expected, 'Expected result'),
  );
  toggle('Show expected result', 'Hide expected result', expectedBox);
  if (setup) {
    const box = el('div', { className: 'runner-harness sqlrun-setup' });
    box.append(
      el('p', { className: 'runner-note' }, el('strong', { textContent: 'From the note. ' }), `Before each run, a fresh in-memory database is filled with ${setup.from} (SQL block${setup.blocks.length > 1 ? 's' : ''} ${setup.blocks.join(', ')} of this lesson):`),
      el('pre', { className: 'runner-pre', tabIndex: 0, textContent: setup.code }),
    );
    toggle('Show setup', 'Hide setup', box);
  }
  panel.append(toggles, ...sections);
  frame.after(panel);

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
  const getCode = () => editor?.getCode() ?? original;

  async function openEditor(): Promise<EditorHandle> {
    if (editor) return editor;
    const { createEditor, sql } = await loadEditor();
    if (editor) return editor;
    const host = el('div', { className: 'runner-editor' });
    pre.after(host);
    editor = createEditor(host, original, { label: `${name} (editable SQL)`, onRun: () => void run(), language: sql });
    pre.hidden = true;
    editBtn.hidden = true;
    resetBtn.hidden = false;
    io.hidden = false;
    return editor;
  }

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

  function show(result: RunResult, code: string): void {
    const shown: ShownStatement[] = result.statements.map((s) => ({ kind: s.kind, changes: s.changes, columns: s.table?.columns, rows: s.table?.rows, total: s.table?.total, truncated: s.table?.truncated }));
    // the build's order notes apply to the note's own query; an edited one gets them from its text
    if (code === original) shown.forEach((s, i) => (s.order = entry.expected[i]?.order));
    output.replaceChildren(renderStatements(shown, 'Result'));
    if (result.error) {
      const e = result.error;
      const where = e.phase === 'setup' ? "the lesson's setup" : e.line ? `line ${e.line}` : 'the code';
      setStatus(`SQLite stopped at ${where}: ${e.message}`, 'error');
      problems.replaceChildren(el('li', { textContent: `${e.phase === 'setup' ? 'Setup' : 'Line'}${e.line ? ` ${e.line}` : ''}: ${e.message}` }));
      problems.hidden = false;
      panel.dataset.outcome = 'error';
      if (e.phase === 'code' && e.line) {
        if (editor) editor.setMarkers([{ line: e.line, column: 1, endLine: e.line, endColumn: 1, message: e.message, kind: 'error' }]);
        else pre.querySelectorAll('code > .line')[e.line - 1]?.classList.add('runner-mark');
      }
      return;
    }
    const same = sameAsExpected(result, entry.expected);
    panel.dataset.outcome = 'completed';
    panel.dataset.matches = String(same);
    const rows = result.statements.filter((s) => s.kind === 'rows').reduce((n, s) => n + (s.table?.total ?? 0), 0);
    setStatus(`Ran in SQLite ${sqlHost.sqlite} in ${result.ms < 1 ? '<1' : result.ms} ms: ${plural(rows, 'row')}${same ? ', the same as the expected result' : ''}.`, 'ok');
    // an edited query may have left the ground both dialects share: say so
    if (code !== original) {
      const findings = [...dialectFindings(code), ...groupingFindings(code)];
      if (findings.length) {
        hint.textContent = `Heads-up: ${findings
          .slice(0, 2)
          .map((f) => f.detail)
          .join(' ')} SQLite ran it anyway; SQL Server ${findings.some((f) => f.category === 'not-tsql') ? 'would reject or treat it differently' : 'may behave differently'}.`;
        hint.hidden = false;
      }
    }
  }

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    runBtn.disabled = true;
    runBtn.setAttribute('aria-busy', 'true');
    io.hidden = false;
    resetBtn.hidden = false;
    clearMarks();
    hint.hidden = true;
    output.replaceChildren();
    delete panel.dataset.outcome;
    delete panel.dataset.matches;
    const code = getCode();
    setStatus('Running…');
    try {
      const outcome = await sqlHost.run(setup?.code ?? '', code, () => setStatus(`Loading SQLite (sql.js), a one-time download of about ${data.downloadKB} KB…`));
      if (outcome.kind === 'timeout') {
        setStatus(`Stopped after ${TIMEOUT_MS / 1000} seconds: the query was still running (a recursive CTE without an end?).`, 'error');
        panel.dataset.outcome = 'timeout';
      } else if (outcome.kind === 'fatal') {
        setStatus(`SQLite stopped working: ${outcome.message}. Reload the page to try again.`, 'error');
        panel.dataset.outcome = 'fatal';
      } else show(outcome.result, code);
    } finally {
      running = false;
      runBtn.disabled = false;
      runBtn.removeAttribute('aria-busy');
    }
  }

  editBtn.addEventListener('click', async () => {
    const ed = await openEditor();
    ed.focus();
  });
  runBtn.addEventListener('click', () => void run());
  resetBtn.addEventListener('click', () => {
    clearMarks();
    editor?.setCode(original);
    output.replaceChildren();
    hint.hidden = true;
    setStatus('Back to the query from the note.');
    delete panel.dataset.outcome;
  });
}

function mountAll(): void {
  const frames = [...document.querySelectorAll<HTMLElement>('#lesson-body figure.code-frame')].filter((f) => SQL_LANGS.has(f.dataset.lang ?? ''));
  const matches = (index: number, hash: string) => {
    const frame = frames[index - 1];
    const pre = frame?.querySelector('pre');
    // never attach anything to a block whose code is not the one the build checked
    return frame && pre && codeHash(pre.textContent ?? '') === hash ? frame : null;
  };
  for (const entry of data.blocks) {
    const frame = matches(entry.index, entry.hash);
    if (frame) mount(frame, entry);
  }
  for (const label of data.labels) {
    const frame = matches(label.index, label.hash);
    if (frame) addLabel(frame, label);
  }
  document.body.dataset.sqlrunReady = 'true';
}

mountAll();
