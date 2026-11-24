import { escapeHtml } from "./html.mjs";
import { courseHref, startHref } from "./render-course.mjs";
import { page } from "../site/layout.mjs";

function cardMeta(course) {
  const parts = [course.kind === "app" ? "interactive" : course.kind === "hybrid" ? "interactive + lessons" : "lessons"];
  if (course.hours) parts.push(`${course.hours}h`);
  if (course.app) parts.push(`${course.contents.length} ${course.contents.length === 1 ? "lab" : "labs"}`);
  if (course.lessons) {
    const n = course.lessons.order.length;
    parts.push(`${n} ${n === 1 ? "lesson" : "lessons"}`);
  }
  return parts.join(" · ");
}

function card(course) {
  return `        <article class="card">
          <p class="card-meta">${escapeHtml(cardMeta(course))}</p>
          <h2><a href="${escapeHtml(courseHref(course))}">${escapeHtml(course.title)}</a></h2>
          <p class="card-promise">${escapeHtml(course.promise)}</p>
          <p class="card-open"><a href="${escapeHtml(startHref(course))}">Open course <span aria-hidden="true">→</span></a></p>
        </article>`;
}

export function renderHome(courses) {
  const body = courses.length
    ? `      <section class="hero">
        <h1>Learning</h1>
        <p class="lede">Courses built from first principles: interactive labs, written lessons and assessments you can run yourself.</p>
      </section>
      <section class="grid" aria-label="Courses">
${courses.map(card).join("\n")}
      </section>`
    : `      <section class="hero">
        <h1>Learning</h1>
        <p class="lede">No courses yet. Add one under <code>courses/</code> and run <code>npm run build</code>.</p>
      </section>`;

  return page({
    title: "Learning",
    description: "Interactive courses, written lessons and assessments built from first principles.",
    body,
    active: "home",
  });
}
