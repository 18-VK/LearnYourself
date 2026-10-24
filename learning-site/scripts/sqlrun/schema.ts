/**
 * src/data/sqlrun/<lesson id>.yaml: which of a lesson's own SQL blocks hold its sample data, and which queries run
 * on it. Documented in the README ("Runnable SQL").
 */
import { z } from 'zod';

const blockList = z.array(z.number().int().positive()).min(1);

export const SqlSetupSchema = z
  .object({
    /** Name used by `uses:` (letters, digits, dashes). */
    id: z.string().regex(/^[a-z0-9-]+$/),
    /** The lesson's SQL blocks that create and fill the tables, in the order they run. */
    blocks: blockList,
    /** Guard against drift: the first setup block must start with this text. */
    startsWith: z.string().min(1),
    /** Where the sample data is in the note (shown under "Show setup"). */
    from: z.string().min(1),
  })
  .strict();

export const SqlUseSchema = z
  .object({
    setup: z.string(),
    /** Query blocks that run on this setup's tables. */
    blocks: blockList,
  })
  .strict();

export const SqlOverrideSchema = z
  .object({
    block: z.number().int().positive(),
    /** Only `false`: the build decides "runnable" itself and can't be overruled towards running. */
    runnable: z.literal(false),
    reason: z.string().min(1),
  })
  .strict();

export const SqlRunFileSchema = z
  .object({
    setups: z.array(SqlSetupSchema).default([]),
    uses: z.array(SqlUseSchema).default([]),
    overrides: z.array(SqlOverrideSchema).default([]),
  })
  .strict()
  .superRefine((f, ctx) => {
    const ids = new Set(f.setups.map((s) => s.id));
    if (ids.size !== f.setups.length) ctx.addIssue({ code: 'custom', message: 'setup ids must be unique' });
    for (const u of f.uses) if (!ids.has(u.setup)) ctx.addIssue({ code: 'custom', message: `uses: unknown setup "${u.setup}"` });
    const seen = new Set<number>();
    for (const b of f.uses.flatMap((u) => u.blocks)) {
      if (seen.has(b)) ctx.addIssue({ code: 'custom', message: `block ${b} is listed under uses twice` });
      seen.add(b);
    }
    const setupBlocks = new Set(f.setups.flatMap((s) => s.blocks));
    for (const b of seen) if (setupBlocks.has(b)) ctx.addIssue({ code: 'custom', message: `block ${b} is a setup block and can't also use a setup` });
  });

export type SqlRunFile = z.infer<typeof SqlRunFileSchema>;
