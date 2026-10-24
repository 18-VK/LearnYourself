/**
 * The debugger in the CodeMirror editor: a breakpoint gutter (click a line number's gutter, or F9 on the cursor's
 * line), the current line highlighted, and a callback when the code is edited (the trace no longer matches it).
 * Added to an open editor with StateEffect.appendConfig, so editor.ts needs no debugger code.
 */
import { RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, GutterMarker, gutter, keymap } from '@codemirror/view';
import type { EditorHandle } from '../editor';
import type { CodeView, LineKind } from './code-view';

class BreakpointMarker extends GutterMarker {
  override toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-dbg-bp-dot';
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
}
const marker = new BreakpointMarker();

/** Line start positions to toggle, or a full list of line numbers to set. */
const toggleEffect = StateEffect.define<number>();
const setEffect = StateEffect.define<number[]>();
const currentEffect = StateEffect.define<{ line: number; kind: LineKind } | null>();

const breakpointField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    set = set.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(toggleEffect)) {
        let on = false;
        set.between(e.value, e.value, () => {
          on = true;
        });
        set = on ? set.update({ filter: (from) => from !== e.value }) : set.update({ add: [marker.range(e.value)], sort: true });
      } else if (e.is(setEffect)) {
        const doc = tr.state.doc;
        set = RangeSet.of(e.value.filter((l) => l >= 1 && l <= doc.lines).map((l) => marker.range(doc.line(l).from)), true);
      }
    }
    return set;
  },
});

const currentField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(currentEffect)) {
        if (!e.value || e.value.line < 1 || e.value.line > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(e.value.line);
        return Decoration.set([Decoration.line({ class: e.value.kind === 'exception' ? 'cm-dbg-current cm-dbg-current-exception' : 'cm-dbg-current', attributes: { 'aria-current': 'step' } }).range(line.from)]);
      }
    }
    // the trace describes the code as it was; once it changes, the highlight would point at the wrong line
    return tr.docChanged ? Decoration.none : deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function toggleAt(view: EditorView, pos: number): void {
  view.dispatch({ effects: toggleEffect.of(view.state.doc.lineAt(pos).from) });
}

const attached = new WeakMap<EditorView, { listeners: Set<() => void>; onEdit: Set<() => void> }>();

function extension(hooks: { listeners: Set<() => void>; onEdit: Set<() => void> }): Extension {
  return [
    breakpointField,
    currentField,
    gutter({
      class: 'cm-dbg-gutter',
      markers: (v) => v.state.field(breakpointField),
      initialSpacer: () => marker,
      domEventHandlers: {
        mousedown(view, line) {
          toggleAt(view, line.from);
          return true;
        },
      },
    }),
    keymap.of([{ key: 'F9', run: (view) => (toggleAt(view, view.state.selection.main.head), true) }]),
    EditorView.updateListener.of((u) => {
      if (u.transactions.some((t) => t.effects.some((e) => e.is(toggleEffect) || e.is(setEffect)))) for (const l of hooks.listeners) l();
      if (u.docChanged) for (const l of hooks.onEdit) l();
    }),
  ];
}

export function editorView(handle: EditorHandle, onEdit: () => void): CodeView {
  const view = handle.view;
  let hooks = attached.get(view);
  if (!hooks) {
    hooks = { listeners: new Set(), onEdit: new Set() };
    attached.set(view, hooks);
    view.dispatch({ effects: StateEffect.appendConfig.of(extension(hooks)) });
  }
  const h = hooks;
  h.onEdit.add(onEdit);
  const lines = (): Set<number> => {
    const out = new Set<number>();
    const doc = view.state.doc;
    view.state.field(breakpointField).between(0, doc.length, (from) => {
      out.add(doc.lineAt(from).number);
    });
    return out;
  };
  return {
    setCurrent(line, kind = 'line') {
      const effects: StateEffect<unknown>[] = [currentEffect.of(line ? { line, kind } : null)];
      if (line && line <= view.state.doc.lines) effects.push(EditorView.scrollIntoView(view.state.doc.line(line).from, { y: 'nearest' }));
      view.dispatch({ effects });
    },
    breakpoints: lines,
    setBreakpoints: (list) => view.dispatch({ effects: setEffect.of([...list]) }),
    onBreakpoints(listener) {
      h.listeners.add(listener);
      return () => h.listeners.delete(listener);
    },
    destroy() {
      h.onEdit.delete(onEdit);
      h.listeners.clear();
      view.dispatch({ effects: currentEffect.of(null) });
    },
  };
}
