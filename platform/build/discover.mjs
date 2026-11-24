import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { CourseManifestError, parseCourse, RESERVED_SLUGS } from "./schema.mjs";

async function statKind(path) {
  try {
    const s = await stat(path);
    return s.isDirectory() ? "dir" : s.isFile() ? "file" : "other";
  } catch {
    return null;
  }
}

const toPosix = (p) => p.split("\\").join("/");

/**
 * Read every courses/<slug>/course.json under rootDir, validate each manifest
 * and the files it points at, and return the live courses sorted by order.
 *
 * Never throws on bad input: every problem becomes a line in `errors`.
 *
 * @param {{ rootDir: string }} options
 * @returns {Promise<{ courses: object[], errors: string[], drafts: object[] }>}
 */
export async function discoverCourses({ rootDir }) {
  const coursesDir = join(rootDir, "courses");
  const errors = [];

  let entries = [];
  try {
    entries = await readdir(coursesDir, { withFileTypes: true });
  } catch {
    return { courses: [], errors, drafts: [] };
  }

  const dirNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  /** @type {{ course: object, dirName: string, file: string }[]} */
  const parsed = [];

  for (const dirName of dirNames) {
    const dir = join(coursesDir, dirName);
    const file = toPosix(relative(rootDir, join(dir, "course.json")));

    let raw;
    try {
      raw = JSON.parse(await readFile(join(dir, "course.json"), "utf8"));
    } catch (error) {
      const reason = error instanceof SyntaxError ? "invalid JSON" : "unreadable";
      errors.push(`${file}: ${reason} (${error.message})`);
      continue;
    }

    try {
      parsed.push({ course: parseCourse(raw, { dir, file }), dirName, file });
    } catch (error) {
      if (!(error instanceof CourseManifestError)) throw error;
      errors.push(`${file}: ${error.message}`);
    }
  }

  const clean = [];

  for (const { course, dirName, file } of parsed) {
    const before = errors.length;

    if (RESERVED_SLUGS.has(course.slug)) {
      errors.push(`${file}: reserved slug ${course.slug}`);
    }
    if (course.slug !== dirName) {
      errors.push(`${file}: slug "${course.slug}" does not match directory "${dirName}"`);
    }
    if (course.app) {
      const entryPath = join(course.dir, course.app.mountDir, course.app.entry);
      if ((await statKind(entryPath)) !== "file") {
        errors.push(`${file}: missing app entry ${course.app.entry} under ${course.app.mountDir}/`);
      }
    }
    if (course.lessons) {
      if ((await statKind(join(course.dir, course.lessons.root))) !== "dir") {
        errors.push(`${file}: lessons directory ${course.lessons.root} does not exist`);
      }
    }
    for (const item of course.contents) {
      if ((await statKind(join(course.dir, item.href))) !== "file") {
        errors.push(`${file}: contents href ${item.href} does not exist`);
      }
    }
    for (const assessment of course.assessments) {
      const target =
        assessment.engine === "items"
          ? join(course.dir, assessment.file)
          : join(course.dir, course.app?.mountDir ?? "app", assessment.href);
      if ((await statKind(target)) !== "file") {
        errors.push(`${file}: assessment ${assessment.id} target ${assessment.file ?? assessment.href} does not exist`);
      }
    }

    if (errors.length === before) clean.push(course);
  }

  // Duplicate slugs are reported across every manifest that parsed, including
  // ones that failed a later check, so the message names both files once.
  const bySlug = new Map();
  for (const { course, file } of parsed) {
    if (!bySlug.has(course.slug)) bySlug.set(course.slug, []);
    bySlug.get(course.slug).push(file);
  }
  const duplicatedSlugs = new Set();
  for (const [slug, files] of bySlug) {
    if (files.length > 1) {
      duplicatedSlugs.add(slug);
      errors.push(`duplicate slug ${slug} in ${files.join(", ")}`);
    }
  }

  const byOrder = new Map();
  for (const course of clean) {
    if (!byOrder.has(course.order)) byOrder.set(course.order, []);
    byOrder.get(course.order).push(course.slug);
  }
  for (const [order, slugs] of byOrder) {
    if (slugs.length > 1) errors.push(`duplicate order ${order} in ${slugs.join(", ")}`);
  }

  const unique = clean
    .filter((course) => !duplicatedSlugs.has(course.slug))
    .filter((course) => byOrder.get(course.order).length === 1);

  const drafts = unique.filter((course) => course.status === "draft");
  const courses = unique
    .filter((course) => course.status === "live")
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));

  return { courses, errors, drafts };
}
