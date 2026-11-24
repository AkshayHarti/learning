import { escapeHtml } from "./html.mjs";
import { page } from "../site/layout.mjs";
import { validateBank, storageKeyFor } from "../site/assessment-core.mjs";

export function assessmentHref(course, assessment) {
  return `/courses/${course.slug}/a/${assessment.id}.html`;
}

/** JSON safe to embed inside a <script> element. */
export function embedBank(bank) {
  return JSON.stringify(bank).replace(/</g, "\\u003c");
}

/**
 * @param {{ course: object, assessment: { id: string, title: string }, bank: object }} options
 * @returns {string}
 * @throws when the bank is invalid — a broken assessment must fail the build
 */
export function renderAssessment({ course, assessment, bank }) {
  const errors = validateBank(bank);
  if (errors.length) {
    throw new Error(`${course.slug}/${assessment.id}: ${errors.join("; ")}`);
  }

  const storageKey = storageKeyFor(course.progressKey, bank);
  const intro = bank.intro ? `          <p class="lede">${escapeHtml(bank.intro)}</p>\n` : "";
  const count = bank.items.length;

  const body = `      <article class="assessment-page">
        <p class="eyebrow">${escapeHtml(course.title)}</p>
        <h1>${escapeHtml(assessment.title || bank.title)}</h1>
${intro}        <p class="note">${count} ${count === 1 ? "item" : "items"} · pass at ${Math.round(
    (typeof bank.passRatio === "number" ? bank.passRatio : 0.7) * 100,
  )}%</p>
        <div id="assessment" class="assessment" data-storage-key="${escapeHtml(storageKey)}">
          <noscript><p>This assessment needs JavaScript. Every item is also readable in the course.</p></noscript>
        </div>
        <p class="assessment-back"><a href="/courses/${escapeHtml(course.slug)}/">← Back to ${escapeHtml(course.title)}</a></p>
      </article>
      <script type="application/json" id="bank">${embedBank(bank)}</script>
      <script type="module" src="/assets/assessment.js"></script>`;

  return page({
    title: assessment.title || bank.title,
    description: bank.intro || `${count} items to check your understanding of ${course.title}.`,
    body,
    active: "assessment",
  });
}
