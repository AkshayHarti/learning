import { escapeHtml } from "../build/html.mjs";
import { page } from "../site/layout.mjs";

const KIND_LABEL = { app: "interactive", lessons: "lessons", hybrid: "interactive + lessons" };

export function courseHref(course) {
  return `/courses/${course.slug}/`;
}

/** Where a visitor should start: the app entry, else the first lesson. */
export function startHref(course) {
  if (course.app) return `${courseHref(course)}${course.app.mountDir}/${course.app.entry}`;
  const first = course.lessons?.order?.[0];
  return first ? `${courseHref(course)}${first}.html` : courseHref(course);
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function metaPairs(course) {
  const pairs = [["Format", KIND_LABEL[course.kind] ?? course.kind]];
  if (course.hours) pairs.push(["Time", `${course.hours}h`]);
  if (course.app && course.contents.length) pairs.push(["Labs", plural(course.contents.length, "lab", "labs")]);
  if (course.lessons) pairs.push(["Lessons", plural(course.lessons.order.length, "lesson", "lessons")]);
  return pairs;
}

function assessmentHref(course, assessment) {
  return assessment.engine === "items"
    ? `${courseHref(course)}a/${assessment.id}.html`
    : `${courseHref(course)}${course.app?.mountDir ?? "app"}/${assessment.href}`;
}

function contentsHref(course, item) {
  // A leading slash means "somewhere else on this site", not "inside this course".
  return item.href.startsWith("/") ? item.href : courseHref(course) + item.href;
}

export function renderCourse(course) {
  const pairs = metaPairs(course)
    .map(([term, value]) => `        <div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("\n");

  const contents = course.contents.length
    ? `      <section aria-labelledby="contents">
        <h2 id="contents">Contents</h2>
        <ol class="contents">
${course.contents
  .map(
    (item) =>
      `          <li><a href="${escapeHtml(contentsHref(course, item))}">${escapeHtml(item.title)}</a>${
        item.note ? ` <span class="note">${escapeHtml(item.note)}</span>` : ""
      }</li>`,
  )
  .join("\n")}
        </ol>
      </section>`
    : "";

  const assessments = course.assessments.length
    ? `      <section aria-labelledby="assessments">
        <h2 id="assessments">Assess yourself</h2>
        <ul class="assessments">
${course.assessments
  .map(
    (a) =>
      `          <li><a href="${escapeHtml(assessmentHref(course, a))}">${escapeHtml(a.title)}</a>${
        a.engine === "custom" ? ' <span class="note">scenario simulation</span>' : ""
      }</li>`,
  )
  .join("\n")}
        </ul>
      </section>`
    : "";

  const appNote = course.app
    ? `      <p class="note">This course opens in its own full-screen interface. Every simulation runs locally in your browser.</p>`
    : "";

  const body = `      <article class="landing">
        <p class="eyebrow">${escapeHtml(KIND_LABEL[course.kind] ?? course.kind)}</p>
        <h1>${escapeHtml(course.title)}</h1>
        <p class="lede">${escapeHtml(course.promise)}</p>
        <p class="cta"><a class="button" href="${escapeHtml(startHref(course))}">Start here</a></p>
        <dl class="meta">
${pairs}
        </dl>
${appNote}
${contents}
${assessments}
      </article>`;

  return page({ title: course.title, description: course.promise, body, active: "course" });
}
