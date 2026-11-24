import { marked } from "marked";

/** URL-safe id from heading text. Unicode letters survive; punctuation collapses. */
export function slugifyHeading(text) {
  const stripped = String(text).replace(/<[^>]+>/g, "");
  const slug = stripped
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "section";
}

/** Markdown → HTML. Marked escapes code fences; we never disable that. */
export function renderMarkdown(markdown) {
  return marked.parse(String(markdown), { gfm: true, breaks: false, headerIds: false, mangle: false });
}

/**
 * Give every h2/h3 a unique id and collect them for the table of contents.
 *
 * @param {string} html
 * @returns {{ html: string, headings: { depth: number, id: string, text: string }[] }}
 */
export function withHeadingIds(html) {
  const used = new Map();
  const headings = [];
  const withIds = html.replace(/<h([2-3])>([\s\S]*?)<\/h\1>/g, (match, depth, inner) => {
    const base = slugifyHeading(inner);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen}`;
    headings.push({ depth: Number(depth), id, text: inner.replace(/<[^>]+>/g, "").trim() });
    return `<h${depth} id="${id}">${inner}</h${depth}>`;
  });
  return { html: withIds, headings };
}

/** First `# heading` in a markdown body, used when frontmatter omits a title. */
export function firstHeading(markdown) {
  const match = /^#[ \t]+(.+)$/m.exec(String(markdown));
  return match ? match[1].trim() : null;
}
