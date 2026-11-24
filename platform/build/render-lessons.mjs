import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { escapeHtml } from "./html.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";
import { firstHeading, renderMarkdown, withHeadingIds } from "./markdown.mjs";
import { page } from "../site/layout.mjs";

export function lessonHref(course, id) {
  return `/courses/${course.slug}/${id}.html`;
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * Read every lesson named by `course.lessons.order`, in that order.
 * Throws when a listed file is missing: a half-populated course must fail the
 * build rather than ship without a week.
 *
 * @param {object} course
 * @returns {Promise<object[]>}
 */
export async function readLessons(course) {
  const root = course.lessons?.root ?? "lessons";
  const ids = course.lessons?.order ?? [];
  const lessons = [];

  for (const id of ids) {
    const relative = `${root}/${id}.md`;
    let text;
    try {
      text = await readFile(join(course.dir, root, `${id}.md`), "utf8");
    } catch {
      throw new Error(`${course.slug}: ${relative} is missing but listed in lessons.order`);
    }

    const { data, body } = parseFrontmatter(text);
    const lab = data.lab || null;
    const solution = data.solution || null;

    lessons.push({
      id,
      title: data.title || firstHeading(body) || id,
      summary: data.summary || "",
      minutes: data.minutes ? Number(data.minutes) : null,
      lab,
      solution,
      run: data.run || null,
      body,
      labCode: lab ? await readOptional(join(course.dir, lab)) : null,
      solutionCode: solution ? await readOptional(join(course.dir, solution)) : null,
    });
  }

  return lessons;
}

function codePanel(label, code) {
  return `          <div class="code-panel">
            <header><span>${escapeHtml(label)}</span><button type="button" data-copy>Copy</button></header>
            <pre><code>${escapeHtml(code)}</code></pre>
          </div>`;
}

function rail(course, lesson) {
  const items = course.lessons?.items?.length
    ? course.lessons.items.map((item) => ({ id: item.id, title: item.title }))
    : (course.lessons?.order ?? []).map((id) => ({ id, title: id }));

  const links = items
    .map(
      (item) =>
        `            <li><a href="${escapeHtml(lessonHref(course, item.id))}"${
          item.id === lesson.id ? ' aria-current="page"' : ""
        }>${escapeHtml(item.title)}</a></li>`,
    )
    .join("\n");

  return `        <details class="rail" open>
          <summary>${escapeHtml(course.title)}</summary>
          <ol>
${links}
          </ol>
        </details>`;
}

export function renderLesson({ course, lesson, prev = null, next = null }) {
  const rendered = withHeadingIds(renderMarkdown(lesson.body));
  const hasH1 = /<h1[\s>]/.test(rendered.html);
  const prose = hasH1 ? rendered.html : `<h1>${escapeHtml(lesson.title)}</h1>\n${rendered.html}`;

  const tocItems = rendered.headings
    .map(
      (heading) =>
        `            <li class="toc-h${heading.depth}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`,
    )
    .join("\n");

  const toc = `        <nav class="toc" aria-label="On this page">
          <h2>On this page</h2>
${tocItems ? `          <ul>\n${tocItems}\n          </ul>` : "          <p class=\"note\">Single section.</p>"}
        </nav>`;

  const meta = [lesson.minutes ? `${lesson.minutes} min` : null, lesson.summary || null].filter(Boolean);
  const metaLine = meta.length ? `          <p class="note">${meta.map(escapeHtml).join(" · ")}</p>` : "";

  const runCallout = lesson.run
    ? `          <aside class="run-callout">
            <p><strong>Run it locally.</strong> From the course directory:</p>
            <pre><code>${escapeHtml(lesson.run)}</code></pre>
          </aside>`
    : "";

  const labPanel = lesson.labCode
    ? `${codePanel(lesson.lab, lesson.labCode)}`
    : lesson.lab
      ? `          <p class="note">Lab source: <code>${escapeHtml(lesson.lab)}</code></p>`
      : "";

  const solutionPanel = lesson.solutionCode
    ? `<details class="solution">
            <summary>Worked solution: <code>${escapeHtml(lesson.solution)}</code></summary>
${codePanel(lesson.solution, lesson.solutionCode)}
          </details>`
    : "";

  const pagerParts = [
    prev ? `<a href="${escapeHtml(lessonHref(course, prev.id))}" rel="prev">← ${escapeHtml(prev.title)}</a>` : "<span></span>",
    next ? `<a href="${escapeHtml(lessonHref(course, next.id))}" rel="next">${escapeHtml(next.title)} →</a>` : "<span></span>",
  ];

  const body = `      <div class="lesson-shell">
${rail(course, lesson)}
        <article class="prose">
          <p class="eyebrow">${escapeHtml(course.title)}</p>
${metaLine}
          ${prose}
${runCallout}
${labPanel}
${solutionPanel}
          <nav class="pager" aria-label="Lesson navigation">
            ${pagerParts.join("\n            ")}
          </nav>
        </article>
${toc}
      </div>
      <div class="reading-progress" id="reading-progress" aria-hidden="true"></div>`;

  return page({ title: lesson.title, description: lesson.summary || course.promise, body, active: "lesson" });
}
