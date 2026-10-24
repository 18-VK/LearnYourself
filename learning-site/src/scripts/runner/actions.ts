/**
 * Extension point for buttons next to Edit / Run / Reset on a runnable C# block.
 *
 * The tracing debugger registers its "Debug" button here instead of editing the Run UI (src/scripts/runner/debug/action.ts):
 *
 *   registerRunnerAction({ id: 'debug', label: 'Debug', order: 20, onClick: (ctx) => startDebugger(ctx) });
 *
 * Register before src/scripts/runner/attach.ts mounts the blocks (import the module from attach.ts's
 * `loadExtensions()`); see runner/NOTES.md, "Debugger".
 */
import type { EditorHandle } from './editor';
import type { RunCallbacks, RunOutcome } from './host';

export interface RunnerBlockContext {
  /** The program id (lesson id + block index + hash). */
  id: string;
  index: number;
  /** The block's <figure class="code-frame"> and the runner panel under it. */
  frame: HTMLElement;
  panel: HTMLElement;
  /** The code as the learner sees it now (the editor's text once Edit was pressed). */
  getCode(): string;
  harness: string | null;
  stdin(): string;
  /** Opens the editor (loading CodeMirror if needed) and returns it. */
  openEditor(): Promise<EditorHandle>;
  setStatus(text: string, kind?: 'info' | 'ok' | 'error'): void;
  /** Runs through the shared worker host (queued behind other runs on the page). */
  run(callbacks?: RunCallbacks): Promise<RunOutcome>;
  /** "C# example 3": the block's name in labels. */
  name: string;
  /** The block's code as rendered on the page (the read-only view; hidden once the editor is open). */
  pre: HTMLElement;
  /** True when the program is several blocks merged (its line numbers count across them: use the editor). */
  merged: boolean;
  /** Why the build-time check found the debugger can't step through this program, or null. */
  noDebug: string | null;
  /** The editor, if Edit was pressed. */
  editor(): EditorHandle | null;
  /** Calls `listener` when the editor opens (Edit pressed, or openEditor()). Returns an unsubscribe function. */
  onEditorOpen(listener: (editor: EditorHandle) => void): () => void;
  /**
   * Runs the program in debug mode with the panel's progress bar and status line. Compile errors, runner failures and
   * "nothing to run" are shown exactly as for Run, and resolve to null; otherwise the outcome (with its trace) is the
   * debugger's to show. Also null when a run is already in progress.
   */
  debug(): Promise<RunOutcome | null>;
}

export interface RunnerAction {
  id: string;
  label: string;
  /** Edit = 0, Run = 10, Reset = 30; a Debug button would use 20. */
  order?: number;
  /** Whether the block gets this button (default: every runnable block). */
  available?(ctx: RunnerBlockContext): boolean;
  onClick(ctx: RunnerBlockContext): void | Promise<void>;
}

const registry: RunnerAction[] = [];

export function registerRunnerAction(action: RunnerAction): void {
  if (!registry.some((a) => a.id === action.id)) registry.push(action);
}

export const runnerActions = (): RunnerAction[] => [...registry].sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
