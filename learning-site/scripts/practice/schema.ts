/**
 * src/data/practice/<lesson id>.yaml: "Try it yourself" exercises for a DSA lesson. Documented in the README
 * ("Practice mode").
 */
import { z } from 'zod';

/** A test value: plain YAML (numbers, strings, booleans, lists of them) or raw C# for anything else. */
export const ValueSchema: z.ZodType<PracticeValue> = z.lazy(() =>
  z.union([z.number(), z.string(), z.boolean(), z.array(ValueSchema), z.object({ csharp: z.string().min(1), show: z.string().min(1) }).strict()]),
);
export type PracticeValue = number | string | boolean | PracticeValue[] | { csharp: string; show: string };

export const CaseSchema = z
  .object({
    /** Values for the variables the call uses, by name (the method's parameter names unless `types` says otherwise). */
    given: z.record(z.string(), ValueSchema),
    /** The value `result` (or the call's return value) must print as. */
    expected: ValueSchema,
    /** Another call for this case (e.g. UpperBound next to LowerBound). */
    call: z.string().min(1).optional(),
    result: z.string().min(1).optional(),
    /** true only when input and expected output are both in a note; `quote` must then be copied from it. */
    reviewed: z.boolean(),
    /** Verbatim text from the note that states this case (checked against the lesson). Required with reviewed: true. */
    quote: z.string().min(1).optional(),
    /** Lesson that holds the quote (short or full id), when it isn't this lesson. */
    quoteFrom: z.string().min(1).optional(),
    /** Where the case comes from, or why it was added. Shown as a tooltip. */
    source: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.reviewed && !c.quote) ctx.addIssue({ code: 'custom', message: 'a reviewed case needs `quote:`, copied from the note' });
    if (!c.reviewed && c.quote) ctx.addIssue({ code: 'custom', message: '`quote:` marks a case taken from the note: set reviewed: true, or use `source:` instead' });
  });

export const ExerciseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    /** One sentence: what the method must do. */
    task: z.string().min(1),
    /** The note's implementation: its C# block number on the page (C# blocks only), with a drift guard. */
    solution: z.object({ block: z.number().int().positive(), startsWith: z.string().min(1) }).strict(),
    /** How a test calls the method, e.g. `InsertionSort(arr)` or `MergeSort(arr, 0, arr.Length - 1)`. */
    call: z.string().min(1),
    /** What is compared after the call (e.g. `arr` for an in-place sort); default: the call's return value. */
    result: z.string().min(1).optional(),
    /** C# types of `given` variables that aren't parameters of the called method. */
    types: z.record(z.string(), z.string()).optional(),
    /** Starter code, when stripping the bodies of the note's methods isn't right. */
    starter: z.string().min(1).optional(),
    cases: z.array(CaseSchema).min(1),
  })
  .strict();

export const PracticeFileSchema = z.object({ exercises: z.array(ExerciseSchema).min(1) }).strict();

export type PracticeCase = z.infer<typeof CaseSchema>;
export type PracticeExercise = z.infer<typeof ExerciseSchema>;
export type PracticeFile = z.infer<typeof PracticeFileSchema>;
