/**
 * The Debug button on runnable C# blocks. Kept tiny: it is imported on every lesson with runnable blocks, and the
 * debugger itself (React panel, CodeMirror gutter, styles) loads on the first press.
 */
import { registerRunnerAction } from '../actions';

registerRunnerAction({
  id: 'debug',
  label: 'Debug',
  order: 20,
  // only where the build checked that the traced program prints what the plain one does
  available: (ctx) => ctx.noDebug === null,
  onClick: async (ctx) => (await import('./session')).startDebugging(ctx),
});
