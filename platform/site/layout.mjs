import { attr, escapeHtml } from "../build/html.mjs";

/** Marker used to make pill injection idempotent. */
export const PILL_MARKER = "<!--learning-pill-->";

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230a0a0b'/%3E%3Cpath d='M9 22V10h10v3h-6.5v2h5.5v3h-5.5v4z' fill='%23e2b055'/%3E%3C/svg%3E";

/**
 * The floating "All courses" anchor mounted on every interactive app.
 * Kept inline and self-contained so it cannot be affected by the host app's CSS.
 */
export function pillHtml() {
  const style = [
    "position:fixed",
    "left:16px",
    "bottom:16px",
    "z-index:2147483000",
    "height:32px",
    "display:inline-flex",
    "align-items:center",
    "padding:0 12px",
    "border-radius:999px",
    "background:#141416",
    "color:#ecebe7",
    "border:1px solid #2a2a2e",
    "font:500 12px/1 ui-sans-serif,system-ui,-apple-system,sans-serif",
    "letter-spacing:.02em",
    "text-decoration:none",
    "box-shadow:0 6px 24px rgba(0,0,0,.45)",
    "transition:background 150ms ease,border-color 150ms ease",
  ].join(";");
  return `${PILL_MARKER}<a class="learning-pill" href="/" style="${style}" title="All courses">← All courses</a>`;
}

/**
 * One full HTML document with the shared chrome.
 *
 * @param {{ title?: string, description?: string, body: string, active?: string }} options
 * @returns {string}
 */
export function page({ title = "", description = "", body, active = "" }) {
  const documentTitle = !title || title === "Learning" ? "Learning" : `${title} · Learning`;
  const current = (key) => (active === key ? ' aria-current="page"' : "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(documentTitle)}</title>
<meta name="description" content="${attr(description)}">
<meta name="color-scheme" content="dark">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="/assets/shell.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-head">
  <a class="brand" href="/">Learning</a>
  <nav class="site-nav" aria-label="Site">
    <a href="/"${current("home")}>Courses</a>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <p>Built from first principles. Static pages, no accounts, no tracking.</p>
</footer>
<script type="module" src="/assets/shell.js"></script>
</body>
</html>
`;
}
