import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverCourses } from "./discover.mjs";
import { courseHref, renderCourse } from "./render-course.mjs";
import { renderHome } from "./render-home.mjs";
import { lessonHref, readLessons, renderLesson } from "./render-lessons.mjs";
import { renderAssessment } from "./render-assessments.mjs";
import { mountApp } from "./mount-app.mjs";
import { emitMeta } from "./emit.mjs";
import { checkLinks } from "./linkcheck.mjs";

/** Shared chrome shipped to /assets/ on every build. */
const SITE_ASSETS = ["shell.css", "shell.js", "assessment.js", "assessment-core.mjs"];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Full pipeline: discover → render → mount → emit → link-check.
 * Throws before writing anything when a manifest is invalid, and after the
 * render when any internal link is unresolved.
 *
 * @param {{ rootDir: string, distDir: string, siteUrl?: string }} options
 * @returns {Promise<{ courses: object[], summaries: object[] }>}
 */
export async function build({ rootDir, distDir, siteUrl }) {
  const { courses, errors } = await discoverCourses({ rootDir });
  if (errors.length) {
    throw new Error(`manifest errors:\n${errors.map((line) => `  ${line}`).join("\n")}`);
  }

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const siteDir = new URL("../site/", import.meta.url).pathname;
  await mkdir(join(distDir, "assets"), { recursive: true });
  for (const name of SITE_ASSETS) await copyFile(join(siteDir, name), join(distDir, "assets", name));

  await writeFile(join(distDir, "index.html"), renderHome(courses));

  /** @type {{ slug: string, route: string, entry: string, lessons: number, assessments: object[] }[]} */
  const summaries = [];

  for (const course of courses) {
    const courseDir = join(distDir, "courses", course.slug);
    await mkdir(courseDir, { recursive: true });

    const lessons = course.lessons ? await readLessons(course) : [];
    if (course.lessons) course.lessons.items = lessons.map(({ id, title }) => ({ id, title }));

    await writeFile(join(courseDir, "index.html"), renderCourse(course));

    for (let i = 0; i < lessons.length; i += 1) {
      const prev = i > 0 ? { id: lessons[i - 1].id, title: lessons[i - 1].title } : null;
      const next = i < lessons.length - 1 ? { id: lessons[i + 1].id, title: lessons[i + 1].title } : null;
      await writeFile(join(courseDir, `${lessons[i].id}.html`), renderLesson({ course, lesson: lessons[i], prev, next }));
    }

    for (const assessment of course.assessments) {
      if (assessment.engine !== "items") continue;
      const bank = JSON.parse(await readFile(join(course.dir, assessment.file), "utf8"));
      await mkdir(join(courseDir, "a"), { recursive: true });
      await writeFile(join(courseDir, "a", `${assessment.id}.html`), renderAssessment({ course, assessment, bank }));
    }

    if (course.app) {
      if (course.app.build === "vite") await buildViteApp(course, distDir);
      await mountApp({ course, distDir });
    }

    summaries.push({
      slug: course.slug,
      route: courseHref(course),
      entry: course.app
        ? `${courseHref(course)}${course.app.mountDir}/${course.app.entry}`
        : lessonHref(course, course.lessons?.order?.[0] ?? ""),
      lessons: lessons.length,
      assessments: course.assessments.map((assessment) => ({ id: assessment.id, engine: assessment.engine })),
    });
  }

  await emitMeta({ courses, distDir, rootDir, siteUrl });

  const { broken } = await checkLinks({ distDir });
  if (broken.length) {
    throw new Error(`broken links (fix before shipping):\n${broken.map((b) => `  ${b.page} → ${b.href}`).join("\n")}`);
  }

  return { courses, summaries };
}

/**
 * Run a course's own Vite build and place its output where the mount expects it.
 * Fails with the tail of the build log on non-zero exit.
 *
 * @param {object} course
 * @param {string} distDir
 */
async function buildViteApp(course, distDir) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);

  const appDir = join(course.dir, course.app.mountDir);
  await run("npm", ["ci", "--silent"], { cwd: appDir });
  await run("npm", ["run", "build"], { cwd: appDir });

  const source = join(course.dir, course.app.mountDir, "dist");
  if (!(await exists(source))) {
    throw new Error(`${course.slug}: app build "vite" produced no app/dist output`);
  }
  await import("node:fs/promises").then((fs) => fs.cp(source, join(distDir, "courses", course.slug, "app"), { recursive: true }));
}
