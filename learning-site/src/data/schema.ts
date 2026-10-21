/**
 * Schemas for the hand-edited data files. The content pipeline (scripts/lib/data-check.ts) validates every
 * file against these on each build and also checks the references inside them (lesson ids, section headings,
 * verbatim quotes from the notes). A file that fails stops the build with a message naming the file and field.
 *
 *   src/data/quizzes/<lesson-id>.json      "Check your understanding" at the end of a lesson (§6)
 *   src/data/cheatsheets/<sheet-id>.yaml   one quick-reference sheet (§9)
 *   src/data/interview/<topic-id>.json     interview questions for one topic (§10)
 */
import { z } from 'zod';

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case');
const Text = z.string().trim().min(1);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date like 2026-10-21');

/**
 * A heading inside a lesson, written as it appears in the note, with or without the leading #s:
 * "## 5. Quick Sort" or "5. Quick Sort". Matching ignores case, punctuation, emoji and formatting.
 */
const SectionText = Text;

/** A web page used as a source. */
export const WebSourceSchema = z
  .object({
    url: z.url(),
    title: Text,
    /** When the page was read. */
    accessed: IsoDate,
  })
  .strict();
export type WebSource = z.infer<typeof WebSourceSchema>;

/** A section of a note. `section` is the heading line exactly as in the note, including its #s. */
export const NoteSectionSchema = z
  .object({
    file: Text,
    section: Text,
    /** Use when the same heading appears more than once in the file. */
    occurrence: z.number().int().positive().optional(),
    /** Stop before this heading instead of at the end of the section (to split a long section). */
    until: Text.optional(),
  })
  .strict();
export type NoteSection = z.infer<typeof NoteSectionSchema>;

const CodeSchema = z.object({ lang: z.enum(['csharp', 'sql', 'json', 'xml', 'bash', 'text', 'http']), source: Text }).strict();

// ── Quizzes ─────────────────────────────────────────────────────────────────────────────────────

const QuestionBase = {
  /** q1, q2, … unique within the file. */
  id: z.string().regex(/^q\d+$/, 'must be q1, q2, …'),
  /** The question (inline Markdown). */
  prompt: Text,
  /** Why the answer is right, in a sentence or two, grounded in the source section (inline Markdown). */
  explanation: Text,
  /** The lesson section the answer comes from. */
  source: z.object({ section: SectionText }).strict(),
  /** false until the author has checked the question. */
  reviewed: z.boolean(),
};

const McqSchema = z
  .object({
    ...QuestionBase,
    type: z.literal('mcq'),
    options: z.array(Text).min(2).max(6),
    /** Index into options. */
    answer: z.number().int().min(0),
  })
  .strict();

const PredictOutputSchema = z
  .object({
    ...QuestionBase,
    type: z.literal('predict-output'),
    /** Copied verbatim from the lesson (the build checks this). Use the smallest block that makes the point. */
    code: CodeSchema,
    options: z.array(Text).min(2).max(6),
    answer: z.number().int().min(0),
  })
  .strict();

const OrderStepsSchema = z
  .object({
    ...QuestionBase,
    type: z.literal('order-steps'),
    /** The steps in the CORRECT order; the page shuffles them. */
    steps: z.array(Text).min(3).max(8),
  })
  .strict();

export const QuizQuestionSchema = z.discriminatedUnion('type', [McqSchema, PredictOutputSchema, OrderStepsSchema]);
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizFileSchema = z
  .object({
    /** Must equal the file name (without .json) and an existing lesson id. */
    lesson: Slug,
    questions: z.array(QuizQuestionSchema).min(3).max(6),
  })
  .strict();
export type QuizFile = z.infer<typeof QuizFileSchema>;

// ── Cheat sheets ────────────────────────────────────────────────────────────────────────────────

/** Where an item came from: a lesson section, or (only for gaps the notes don't cover) official docs. */
const SheetFrom = z.object({ lesson: Slug, section: SectionText }).strict();

const SheetItemSchema = z
  .object({
    /** The keyword, syntax, command or concept (inline Markdown; `code` allowed). */
    term: Text,
    /** One-line definition or "when to use" (inline Markdown). */
    desc: Text.optional(),
    /** A short snippet; gets a copy button. */
    code: z.string().optional(),
    lang: z.string().optional(),
    from: SheetFrom.optional(),
    /** Set only for items added from official documentation; shown with a "from docs" label. */
    docs: WebSourceSchema.optional(),
  })
  .strict()
  .refine((x) => Boolean(x.from) !== Boolean(x.docs), { message: 'an item needs exactly one of from (a lesson section) or docs (an official page)' });

const SheetRowSchema = z.union([
  z.array(z.string()),
  z
    .object({ cells: z.array(z.string()), from: SheetFrom.optional(), docs: WebSourceSchema.optional() })
    .strict()
    .refine((x) => !(x.from && x.docs), { message: 'a row takes from or docs, not both' }),
]);

const SheetTableSchema = z
  .object({
    columns: z.array(Text).min(2),
    /** Cells are inline Markdown. A row may override the table's `from`, or be a "from docs" row. */
    rows: z.array(SheetRowSchema).min(1),
    from: SheetFrom,
  })
  .strict();

const SheetGroupSchema = z
  .object({
    title: Text,
    /** Optional one-line intro under the group title. */
    note: z.string().optional(),
    items: z.array(SheetItemSchema).optional(),
    table: SheetTableSchema.optional(),
  })
  .strict()
  .refine((g) => (g.items?.length ?? 0) > 0 || Boolean(g.table), { message: 'a group needs items or a table' });

export const CheatSheetSchema = z
  .object({
    /** Must equal the file name and an id in curriculum/_cheatsheets.yaml. */
    id: Slug,
    title: Text,
    /** One sentence shown under the title and on the index page. */
    summary: Text,
    groups: z.array(SheetGroupSchema).min(1),
  })
  .strict();
export type CheatSheet = z.infer<typeof CheatSheetSchema>;

// ── Interview questions ─────────────────────────────────────────────────────────────────────────

export const InterviewQuestionSchema = z
  .object({
    /** Unique across all topics; start with the topic id, e.g. "aspnet-core-middleware-order". */
    id: Slug,
    /** Must equal the file's topic. */
    topic: Slug,
    /** One of the topic's subtopics in curriculum/_interview.yaml. */
    subtopic: Slug,
    difficulty: z.enum(['junior', 'mid', 'senior']),
    question: Text,
    /** The "start strong" answer: one to three sentences. For origin "notes", a verbatim excerpt of the note. */
    shortAnswer: Text,
    /**
     * The full answer (Markdown): key points, then detail. Required for origin "web".
     * For origin "notes" leave it out: the build copies the note section named in answerFrom.
     */
    answer: z.string().optional(),
    /** For origin "notes": the note section that answers the question. */
    answerFrom: NoteSectionSchema.optional(),
    code: CodeSchema.optional(),
    /** Common traps (❌). For origin "notes", verbatim excerpts of the section. */
    pitfalls: z.array(Text),
    /** Likely follow-up questions. For origin "notes", only ones the note itself asks. */
    followUps: z.array(Text),
    origin: z.enum(['notes', 'web']),
    /** web: at least one page (prefer learn.microsoft.com, RFCs, OWASP). notes: the note section(s). */
    sources: z.array(z.union([WebSourceSchema, NoteSectionSchema])).min(1),
    /** Lesson ids that teach this. Required unless notCoveredYet. */
    relatedLessons: z.array(Slug),
    /** The site has no lesson on this yet. */
    notCoveredYet: z.boolean(),
    /** For web questions that depend on the version: what differs (".NET Framework vs .NET 8+", …). */
    versionNote: z.string().optional(),
    /** false until the author has checked the question. */
    reviewed: z.boolean(),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.origin === 'web') {
      if (!q.answer?.trim()) ctx.addIssue({ code: 'custom', message: 'web questions need an answer', path: ['answer'] });
      if (!q.sources.some((s) => 'url' in s)) ctx.addIssue({ code: 'custom', message: 'web questions need at least one web source (url, title, accessed)', path: ['sources'] });
      if (q.answerFrom) ctx.addIssue({ code: 'custom', message: 'answerFrom is only for origin "notes"', path: ['answerFrom'] });
    } else {
      if (!q.answerFrom) ctx.addIssue({ code: 'custom', message: 'notes questions need answerFrom (the note section that answers them)', path: ['answerFrom'] });
      if (q.answer?.trim()) ctx.addIssue({ code: 'custom', message: 'leave answer out for notes questions; it is copied from answerFrom', path: ['answer'] });
    }
    if (!q.notCoveredYet && q.relatedLessons.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'relatedLessons needs at least one lesson id (or set notCoveredYet: true)', path: ['relatedLessons'] });
    }
  });
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;

export const InterviewFileSchema = z
  .object({
    /** Must equal the file name and an id in curriculum/_interview.yaml. */
    topic: Slug,
    questions: z.array(InterviewQuestionSchema),
  })
  .strict();
export type InterviewFile = z.infer<typeof InterviewFileSchema>;
