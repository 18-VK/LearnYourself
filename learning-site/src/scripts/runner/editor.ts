/**
 * The C# editor (CodeMirror 6), loaded only when a learner presses Edit.
 *
 * - C# highlighting from CodeMirror's own legacy C-like mode (there is no Lezer C# grammar); colours come from
 *   classHighlighter's `tok-*` classes, styled for both site themes in src/styles/runner.css.
 * - Compile errors are shown inline: the span is underlined, the line is tinted, and the compiler's message sits
 *   right under the line (not only in a hover tooltip, so it is visible on touch screens and to screen readers).
 * - A runtime exception's line is tinted the same way.
 * - Tab is left to the browser (moves focus), so the editor never traps keyboard users; Ctrl/Cmd+Enter runs.
 */
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { csharp } from '@codemirror/legacy-modes/mode/clike';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, WidgetType } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';

export interface Marker {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  kind: 'error' | 'warning' | 'exception';
}

export interface EditorHandle {
  view: EditorView;
  getCode(): string;
  setCode(code: string): void;
  setMarkers(markers: Marker[]): void;
  focus(): void;
  destroy(): void;
}

class MessageWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly kind: Marker['kind'],
  ) {
    super();
  }
  override eq(other: MessageWidget) {
    return other.text === this.text && other.kind === this.kind;
  }
  toDOM() {
    const el = document.createElement('div');
    el.className = `cm-runner-msg cm-runner-msg-${this.kind}`;
    el.textContent = this.text;
    return el;
  }
}

const setMarkersEffect = StateEffect.define<Marker[]>();

function buildDecorations(state: EditorState, markers: Marker[]): DecorationSet {
  const doc = state.doc;
  const items: { from: number; to: number; deco: Decoration }[] = [];
  const byLine = new Map<number, Marker[]>();
  for (const m of markers) {
    if (m.line < 1 || m.line > doc.lines) continue;
    byLine.set(m.line, [...(byLine.get(m.line) ?? []), m]);
    const line = doc.line(m.line);
    const from = Math.min(line.to, line.from + Math.max(0, m.column - 1));
    const endLine = doc.line(Math.min(Math.max(m.endLine, m.line), doc.lines));
    let to = Math.min(endLine.to, endLine.from + Math.max(0, m.endColumn - 1));
    if (to <= from) to = Math.min(line.to, from + 1);
    if (to > from && m.kind !== 'exception') items.push({ from, to, deco: Decoration.mark({ class: `cm-runner-range cm-runner-range-${m.kind}` }) });
  }
  for (const [n, list] of byLine) {
    const line = doc.line(n);
    const kind = list.some((m) => m.kind === 'error' || m.kind === 'exception') ? (list[0]!.kind === 'exception' ? 'exception' : 'error') : 'warning';
    items.push({ from: line.from, to: line.from, deco: Decoration.line({ class: `cm-runner-line cm-runner-line-${kind}` }) });
    for (const m of list) items.push({ from: line.to, to: line.to, deco: Decoration.widget({ widget: new MessageWidget(m.message, m.kind), block: true, side: 1 }) });
  }
  return Decoration.set(
    items.map((i) => i.deco.range(i.from, i.to)),
    true, // let CodeMirror order them (by position, then line decorations before marks before widgets)
  );
}

const markersField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) if (e.is(setMarkersEffect)) return buildDecorations(tr.state, e.value);
    // markers describe the code as compiled; once the learner edits it, they are stale
    return tr.docChanged ? Decoration.none : deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  '&': { fontSize: '13.4px', backgroundColor: 'var(--code-bg)', color: 'var(--code-ink)' },
  '.cm-content': { fontFamily: 'var(--mono)', padding: '10px 0', caretColor: 'var(--ink)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.62' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--ink-3)', borderRight: '1px solid var(--line)' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--code-cur)' },
  '&.cm-focused': { outline: '2px solid var(--focus)', outlineOffset: '-2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in srgb, var(--focus) 28%, transparent)' },
  '.cm-cursor': { borderLeftColor: 'var(--ink)' },
});

export function createEditor(parent: HTMLElement, code: string, opts: { label: string; onRun: () => void }): EditorHandle {
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    indentUnit.of('    '),
    StreamLanguage.define(csharp),
    syntaxHighlighting(classHighlighter),
    markersField,
    theme,
    EditorView.lineWrapping,
    keymap.of([
      { key: 'Mod-Enter', run: () => (opts.onRun(), true) },
      { key: 'Mod-]', run: indentMore },
      { key: 'Mod-[', run: indentLess },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.contentAttributes.of({ 'aria-label': opts.label, 'aria-multiline': 'true', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
  ];
  const view = new EditorView({ state: EditorState.create({ doc: code, extensions }), parent });
  return {
    view,
    getCode: () => view.state.doc.toString(),
    setCode: (text) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, effects: setMarkersEffect.of([]) }),
    setMarkers: (markers) => view.dispatch({ effects: setMarkersEffect.of(markers) }),
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
