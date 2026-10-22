/**
 * Extension point for buttons next to Edit / Run / Reset on a runnable C# block.
 *
 * The tracing debugger (a later checkpoint) registers its "Debug" button here instead of editing the Run UI:
 *
 *   registerRunnerAction({ id: 'debug', label: 'Debug', order: 20, onClick: (ctx) => startDebugger(ctx) });
 *
 * Register before src/scripts/runner/attach.ts mounts the blocks (import the module from attach.ts's
 * `loadExtensions()`); see runner/NOTES.md, "Adding the debugger".
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
}

export interface RunnerAction {
  id: string;
  label: string;
  /** Edit = 0, Run = 10, Reset = 30; a Debug button would use 20. */
  order?: number;
  onClick(ctx: RunnerBlockContext): void | Promise<void>;
}

const registry: RunnerAction[] = [];

export function registerRunnerAction(action: RunnerAction): void {
  if (!registry.some((a) => a.id === action.id)) registry.push(action);
}

export const runnerActions = (): RunnerAction[] => [...registry].sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
