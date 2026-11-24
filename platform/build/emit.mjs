import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { escapeHtml } from "./html.mjs";
import { courseHref } from "./render-course.mjs";
import { lessonHref } from "./render-lessons.mjs";
import { page } from "../site/layout.mjs";

const run = promisify(execFile);

async function gitSummary(rootDir) {
  try {
    const { stdout } = await run("git", ["-C", rootDir, "log", "-1", "--format=%h %cs"], { timeout: 5000 });
    return stdout.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

/** Every generated route, in a deterministic order. */
export function routesFor(courses) {
  const routes = [{ route: "/", title: "Learning", headings: [] }];
  for (const course of courses) {
    const base = courseHref(course);
    routes.push({ route: base, title: course.title, headings: [] });
    for (const item of course.lessons?.items ?? []) {
      routes.push({ route: lessonHref(course, item.id), title: item.title, headings: [] });
    }
    for (const assessment of course.assessments ?? []) {
      if (assessment.engine === "items") {
        routes.push({ route: `${base}a/${assessment.id}.html`, title: assessment.title, headings: [] });
      }
    }
  }
  return routes;
}

/**
 * sitemap, robots, 404, search index and the build manifest.
 * No timestamps: two builds of the same commit produce identical files.
 *
 * @param {{ courses: object[], distDir: string, rootDir: string, siteUrl?: string }} options
 */
export async function emitMeta({ courses, distDir, rootDir, siteUrl = process.env.SITE_URL || "" }) {
  const routes = routesFor(courses);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `  <url><loc>${escapeHtml(siteUrl + route.route)}</loc></url>`).join("\n")}
</urlset>
`;
  await writeFile(join(distDir, "sitemap.xml"), sitemap);

  await writeFile(join(distDir, "robots.txt"), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ""}`);

  const notFound = page({
    title: "Page not found",
    description: "That page does not exist.",
    body: `      <section class="hero">
        <p class="eyebrow">404</p>
        <h1>That page does not exist</h1>
        <p class="lede">The course may have moved. <a href="/">All courses</a>.</p>
      </section>`,
    active: "",
  });
  await writeFile(join(distDir, "404.html"), notFound);

  await writeFile(join(distDir, "search-index.json"), `${JSON.stringify(routes, null, 2)}\n`);

  const manifest = {
    builtFrom: await gitSummary(rootDir),
    courses: courses.map((course) => ({
      slug: course.slug,
      route: courseHref(course),
      entry: course.app ? `${courseHref(course)}${course.app.mountDir}/${course.app.entry}` : lessonHref(course, course.lessons?.order?.[0] ?? ""),
      lessons: course.lessons?.items?.length ?? 0,
      assessments: (course.assessments ?? []).map((assessment) => ({
        id: assessment.id,
        engine: assessment.engine,
      })),
    })),
  };
  await writeFile(join(distDir, "build.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  return { routes, manifest };
}
