/**
 * src/data/runnable/<lesson id>.yaml: harnesses and overrides for one lesson's C# blocks.
 * Documented in the README ("Mark a code block runnable, or add a harness for it").
 */
import { z } from 'zod';

const common = {
  /** Guard against drift: the block (the first block, for a merge) must start with this text, ignoring indentation. */
  startsWith: z.string().min(1).optional(),
  /**
   * Statements that call the note's code with the note's own sample input. Shown to learners behind
   * "Show harness" and marked as added code. Plain statements: the runner decides where they go.
   */
  harness: z.string().min(1).optional(),
  /** Where the harness's input comes from in the note (heading or quoted line). Required with a harness. */
  input: z.string().min(1).optional(),
  /** Text fed to Console.ReadLine (from the note's own example). */
  stdin: z.string().optional(),
  /** true: skip the build-time exclusions (it must still compile); false: never runnable. */
  runnable: z.boolean().optional(),
  /** Why `runnable` is forced. Required with `runnable`. */
  reason: z.string().min(1).optional(),
};

export const RunnableEntrySchema = z
  .union([
    z.object({ block: z.number().int().positive(), ...common }).strict(),
    z.object({ merge: z.array(z.number().int().positive()).min(2), ...common }).strict(),
  ])
  .superRefine((e, ctx) => {
    if (e.harness && !e.input) ctx.addIssue({ code: 'custom', message: 'a harness needs `input:` saying where in the note its sample input comes from' });
    if (e.runnable !== undefined && !e.reason) ctx.addIssue({ code: 'custom', message: '`runnable:` needs a `reason:`' });
    if ('merge' in e) {
      for (let i = 1; i < e.merge.length; i++) {
        if (e.merge[i] !== e.merge[i - 1]! + 1) ctx.addIssue({ code: 'custom', message: '`merge:` must list consecutive block numbers, e.g. [3, 4]' });
      }
    }
  });

export const RunnableFileSchema = z
  .object({
    blocks: z.array(RunnableEntrySchema).min(1),
  })
  .strict();

export type RunnableEntry = z.infer<typeof RunnableEntrySchema>;
export type RunnableFile = z.infer<typeof RunnableFileSchema>;
