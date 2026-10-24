/**
 * Where the debugger shows the current line and keeps breakpoints: the code block as rendered on the page (the
 * read-only view, this file) or the CodeMirror editor once Edit was pressed (editor-view.ts). Both have a gutter:
 * click a line number (or press Enter/Space on it, F9 in the editor) to set or clear a breakpoint.
 */

export type LineKind = 'line' | 'call' | 'return' | 'exception';

export interface CodeView {
  /** Highlights the current line (1-based) or clears it (null). */
  setCurrent(line: number | null, kind?: LineKind): void;
  breakpoints(): Set<number>;
  setBreakpoints(lines: Iterable<number>): void;
  /** Called when a breakpoint is set or cleared. Returns an unsubscribe function. */
  onBreakpoints(listener: () => void): () => void;
  /** Removes the highlight and the gutter. */
  destroy(): void;
}

/**
 * The read-only view: Shiki's `<pre><code><span class="line">…` gets a gutter button at the start of each line.
 * The buttons hold no text (the number is CSS generated content), so Copy (innerText) and the code hash are unchanged.
 * Keyboard: one gutter button is in the tab order (roving tabindex); ↑/↓ move between lines.
 */
export function staticView(pre: HTMLElement, label: string): CodeView {
  const frame = pre.closest<HTMLElement>('.code-frame');
  const lines = [...pre.querySelectorAll<HTMLElement>('code > .line')];
  const marks = new Set<number>();
  const listeners = new Set<() => void>();
  let current: HTMLElement | null = null;
  frame?.classList.add('is-debugging');

  const buttons = lines.map((line, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dbg-bp';
    b.dataset.line = String(i + 1);
    b.tabIndex = i === 0 ? 0 : -1;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', `${label}, line ${i + 1}: breakpoint`);
    b.title = 'Set or clear a breakpoint (Enter)';
    line.prepend(b);
    return b;
  });

  const render = () => {
    buttons.forEach((b, i) => {
      const on = marks.has(i + 1);
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-on', on);
    });
  };
  const toggle = (line: number) => {
    if (marks.has(line)) marks.delete(line);
    else marks.add(line);
    render();
    for (const l of listeners) l();
  };
  const focusLine = (i: number) => {
    const b = buttons[Math.max(0, Math.min(buttons.length - 1, i))];
    if (!b) return;
    for (const x of buttons) x.tabIndex = -1;
    b.tabIndex = 0;
    b.focus();
  };
  const onClick = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.dbg-bp');
    if (!b || !pre.contains(b)) return;
    e.preventDefault();
    toggle(Number(b.dataset.line));
  };
  const onKey = (e: KeyboardEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.dbg-bp');
    if (!b) return;
    const i = Number(b.dataset.line) - 1;
    const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    e.stopPropagation();
    focusLine(to);
  };
  pre.addEventListener('click', onClick);
  pre.addEventListener('keydown', onKey);

  return {
    setCurrent(line, kind = 'line') {
      current?.classList.remove('dbg-current', 'dbg-current-exception');
      current?.removeAttribute('aria-current');
      current = line ? (lines[line - 1] ?? null) : null;
      if (!current) return;
      current.classList.add(kind === 'exception' ? 'dbg-current-exception' : 'dbg-current');
      current.setAttribute('aria-current', 'step');
      scrollIntoViewIfNeeded(current);
    },
    breakpoints: () => new Set(marks),
    setBreakpoints(list) {
      marks.clear();
      for (const l of list) if (l >= 1 && l <= lines.length) marks.add(l);
      render();
    },
    onBreakpoints(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      current?.classList.remove('dbg-current', 'dbg-current-exception');
      current?.removeAttribute('aria-current');
      for (const b of buttons) b.remove();
      pre.removeEventListener('click', onClick);
      pre.removeEventListener('keydown', onKey);
      frame?.classList.remove('is-debugging');
      listeners.clear();
    },
  };
}

/** Scrolls a line into view only when it is outside the viewport (stepping must not jump the page around). */
export function scrollIntoViewIfNeeded(el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  // (the sticky site header covers the top ~60 px)
  if (r.top < 64 || r.bottom > window.innerHeight - 8) el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
