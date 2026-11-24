import { z } from "zod";

/** Slugs that would collide with paths the build itself owns. */
export const RESERVED_SLUGS = new Set([
  "assets",
  "courses",
  "a",
  "search-index.json",
  "sitemap.xml",
  "robots.txt",
  "404.html",
]);

export class CourseManifestError extends Error {
  constructor(message, { file } = {}) {
    super(message);
    this.name = "CourseManifestError";
    this.file = file ?? null;
  }
}

const slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,40}$/, "must match ^[a-z0-9][a-z0-9-]{1,40}$");

const assessment = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    engine: z.enum(["items", "custom"]),
    file: z.string().min(1).optional(),
    href: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.engine === "items" && !value.file) {
      ctx.addIssue({ code: "custom", path: ["file"], message: 'is required when engine is "items"' });
    }
    if (value.engine === "custom" && !value.href) {
      ctx.addIssue({ code: "custom", path: ["href"], message: 'is required when engine is "custom"' });
    }
  });

export const courseSchema = z
  .object({
    slug,
    title: z.string().min(1),
    promise: z.string().min(1).max(160),
    kind: z.enum(["app", "lessons", "hybrid"]),
    status: z.enum(["live", "draft"]).default("live"),
    order: z.number().int(),
    hours: z.number().positive().optional(),
    tags: z.array(z.string()).default([]),
    app: z
      .object({
        entry: z.string().min(1),
        build: z.enum(["vite"]).optional(),
      })
      .optional(),
    lessons: z
      .object({
        root: z.string().min(1).default("lessons"),
        order: z.array(z.string().min(1)).default([]),
      })
      .optional(),
    assessments: z.array(assessment).default([]),
    contents: z
      .array(z.object({ title: z.string().min(1), href: z.string().min(1), note: z.string().optional() }))
      .default([]),
    progressKey: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const wantsApp = value.kind === "app" || value.kind === "hybrid";
    const wantsLessons = value.kind === "lessons" || value.kind === "hybrid";
    if (wantsApp && !value.app) {
      ctx.addIssue({ code: "custom", path: ["app"], message: `is required when kind is "${value.kind}"` });
    }
    if (!wantsApp && value.app) {
      ctx.addIssue({ code: "custom", path: ["app"], message: `must be omitted when kind is "${value.kind}"` });
    }
    if (wantsLessons && !value.lessons) {
      ctx.addIssue({ code: "custom", path: ["lessons"], message: `is required when kind is "${value.kind}"` });
    }
    if (!wantsLessons && value.lessons) {
      ctx.addIssue({ code: "custom", path: ["lessons"], message: `must be omitted when kind is "${value.kind}"` });
    }
  });

/**
 * Validate one manifest and normalise it into the `Course` shape every other
 * module consumes.
 *
 * @param {unknown} raw parsed JSON from courses/<slug>/course.json
 * @param {{ dir: string, file?: string }} options dir = absolute course directory
 * @returns {object} Course
 * @throws {CourseManifestError}
 */
export function parseCourse(raw, { dir, file } = {}) {
  const result = courseSchema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new CourseManifestError(`invalid manifest: ${detail}`, { file });
  }
  const c = result.data;
  return {
    slug: c.slug,
    title: c.title,
    promise: c.promise,
    kind: c.kind,
    status: c.status,
    order: c.order,
    hours: c.hours ?? null,
    tags: c.tags,
    app: c.app ? { entry: c.app.entry, build: c.app.build ?? null, mountDir: "app" } : null,
    lessons: c.lessons ? { root: c.lessons.root, order: c.lessons.order, items: [] } : null,
    assessments: c.assessments,
    contents: c.contents,
    progressKey: c.progressKey ?? `learning:${c.slug}:v1`,
    dir,
  };
}
