import { z } from 'zod';

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids must be lowercase kebab-case');

export const SliceSchema = z
  .object({
    file: z.string(),
    from: z.string().optional(),
    until: z.string().optional(),
    fromLine: z.string().optional(),
    untilLine: z.string().optional(),
    fromOccurrence: z.number().int().positive().optional(),
    untilOccurrence: z.number().int().positive().optional(),
    reason: z.string().optional(),
  })
  .strict();
export type Slice = z.infer<typeof SliceSchema>;

const AtSchema = z
  .object({
    section: z.string(),
    codeBlock: z.number().int().positive().optional(),
    atOccurrence: z.number().int().positive().optional(),
  })
  .strict();

const PlacementSchema = z
  .object({
    viz: z.string().optional(),
    diagram: z.string().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    tier: z.number().int().min(1).max(3).optional(),
    at: AtSchema,
  })
  .strict()
  .refine((p) => Boolean(p.viz) !== Boolean(p.diagram), { message: 'a placement needs exactly one of viz or diagram' });
export type Placement = z.infer<typeof PlacementSchema>;

const ResourceSchema = z.union([
  z.object({ asset: z.string() }).strict(),
  z.object({ linkFrom: z.string() }).strict(),
  z.object({ tryLocally: z.string() }).strict(),
]);
export type Resource = z.infer<typeof ResourceSchema>;

const LessonSchema = z
  .object({
    id: Slug,
    title: z.string(),
    kind: z.enum(['lesson', 'checklist', 'roadmap']).default('lesson'),
    reason: z.string().optional(),
    sources: z.array(SliceSchema).min(1),
    place: z.array(PlacementSchema).default([]),
    related: z.array(z.string()).default([]),
    cheatsheets: z.array(z.string()).default([]),
    resources: z.array(ResourceSchema).default([]),
    nodeLinks: z.record(z.string(), z.array(z.string())).optional(),
    objectives: z.array(z.string()).min(3).max(5).optional(),
  })
  .strict();
export type ManifestLesson = z.infer<typeof LessonSchema>;

const ModuleSchema = z
  .object({
    id: Slug,
    title: z.string(),
    status: z.literal('planned').optional(),
    noteFolder: z.string().optional(),
    covers: z.array(z.string()).optional(),
    lessons: z.array(LessonSchema),
  })
  .strict();
export type ManifestModule = z.infer<typeof ModuleSchema>;

export const CourseSchema = z
  .object({
    id: Slug,
    title: z.string(),
    shortTitle: z.string(),
    kind: z.enum(['course', 'roadmap']),
    accent: z.string(),
    icon: z.string(),
    prerequisites: z.array(z.string()),
    summary: z.string(),
    landing: z.object({ sources: z.array(SliceSchema) }).strict().optional(),
    modules: z.array(ModuleSchema).min(1),
  })
  .strict();
export type Course = z.infer<typeof CourseSchema>;

const FileReason = z.object({ file: z.string(), reason: z.string() }).strict();

export const SiteSchema = z
  .object({
    site: z.object({ name: z.string(), repo: z.url() }).strict(),
    catalogue: z.object({ order: z.array(Slug) }).strict(),
    suggestedPath: z
      .object({
        main: z.array(Slug),
        parallel: z.array(z.object({ course: Slug, alongside: z.array(Slug), note: z.string() }).strict()),
        branches: z.array(z.object({ course: Slug, after: Slug, note: z.string() }).strict()),
      })
      .strict(),
    topNav: z.array(z.string()),
    interview: z.array(SliceSchema),
    duplicates: z.array(
      z.object({ file: z.string(), duplicateOf: z.string(), check: z.literal('formatting-insensitive'), reason: z.string() }).strict(),
    ),
    linkOnly: z.array(z.object({ file: z.string(), usedBy: z.string(), reason: z.string() }).strict()),
    excluded: z.array(FileReason),
    ignore: z.array(z.string()),
    recoverUnfencedCode: z.array(z.object({ file: z.string() }).strict()).default([]),
    omitLines: z
      .array(
        z.union([
          z.object({ file: z.string(), startsWith: z.string() }).strict(),
          z.object({ file: z.string(), section: z.string() }).strict(),
        ]),
      )
      .default([]),
  })
  .strict();
export type SiteManifest = z.infer<typeof SiteSchema>;

export const AssetsSchema = z
  .object({
    assets: z.array(
      z
        .object({
          file: z.string(),
          usedBy: z.string().nullable(),
          authorship: z.enum(['yours', 'third-party', 'unknown', 'likely-yours', 'likely-third-party']),
          credit: z.string().optional(),
          alt: z.string().optional(),
          publish: z.boolean(),
          mode: z.literal('view').optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type AssetEntry = z.infer<typeof AssetsSchema>['assets'][number];

export const CheatsheetsSchema = z
  .object({ sheets: z.array(z.object({ id: Slug, title: z.string(), sources: z.array(z.string()) }).strict()) })
  .strict();

export const InterviewSchema = z.object({
  topics: z.array(z.object({ id: Slug, title: z.string() }).passthrough()),
  falsePositives: z.array(z.string()).default([]),
}).passthrough();
