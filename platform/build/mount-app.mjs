import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PILL_MARKER, pillHtml } from "../site/layout.mjs";

async function listFiles(dir, base = dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await listFiles(full, base, out);
    else if (entry.isFile()) out.push(full.slice(base.length + 1));
  }
  return out;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function injectPill(html) {
  if (html.includes(PILL_MARKER)) return html;
  const index = html.lastIndexOf("</body>");
  const pill = `${pillHtml()}\n`;
  return index === -1 ? `${html}\n${pill}` : `${html.slice(0, index)}${pill}${html.slice(index)}`;
}

function redirectHtml(entry) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${entry}">
<title>Redirecting</title>
<link rel="canonical" href="${entry}">
</head>
<body>
<p>This course opens at <a href="${entry}">${entry}</a>.</p>
</body>
</html>
`;
}

/**
 * Copy one course's interactive app into the build output, unchanged except
 * for a single injected "All courses" pill in each HTML file.
 *
 * @param {{ course: object, distDir: string }} options
 * @returns {Promise<{ files: number }>}
 */
export async function mountApp({ course, distDir }) {
  if (!course.app) return { files: 0 };

  const source = join(course.dir, course.app.mountDir);
  const destination = join(distDir, "courses", course.slug, course.app.mountDir);
  const files = await listFiles(source);
  let written = 0;

  for (const relative of files) {
    const from = join(source, relative);
    const to = join(destination, relative);
    await mkdir(dirname(to), { recursive: true });
    if (relative.toLowerCase().endsWith(".html")) {
      await writeFile(to, injectPill(await readFile(from, "utf8")));
    } else {
      await copyFile(from, to);
    }
    written += 1;
  }

  // The generated landing owns /courses/<slug>/, so an app entry that is not
  // index.html needs a redirect for links that assume index.html.
  if (course.app.entry !== "index.html") {
    const indexPath = join(destination, "index.html");
    if (!(await exists(indexPath))) {
      await writeFile(indexPath, redirectHtml(course.app.entry));
      written += 1;
    }
  }

  return { files: written };
}
