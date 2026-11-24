import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

async function statKind(path) {
  try {
    const s = await stat(path);
    return s.isDirectory() ? "dir" : s.isFile() ? "file" : "other";
  } catch {
    return null;
  }
}

async function listFiles(dir, base = dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await listFiles(full, base, out);
    else if (entry.isFile()) out.push(relative(base, full).split("\\").join("/"));
  }
  return out;
}

function refsFrom(source, kind) {
  const refs = [];
  if (kind === "html") {
    for (const match of source.matchAll(/\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      refs.push(match[1] ?? match[2] ?? "");
    }
  } else {
    for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")]+))\s*\)/gi)) {
      refs.push((match[1] ?? match[2] ?? match[3] ?? "").trim());
    }
  }
  return refs;
}

/** Does `href`, written on page `pageRel`, point at something in distDir? */
async function resolves({ distDir, pageRel, href }) {
  const clean = href.split("#")[0].split("?")[0].trim();
  if (!clean) return true; // pure fragment
  if (EXTERNAL.test(clean)) return true; // http:, https:, mailto:, data:, tel:, //cdn

  const target = clean.startsWith("/")
    ? join(distDir, clean)
    : join(distDir, dirname(pageRel), clean);

  const kind = await statKind(target);
  if (kind === "file") return true;
  if (kind === "dir") return (await statKind(join(target, "index.html"))) === "file";
  // `/courses/x` without the trailing slash: accept if it names a directory
  return (await statKind(join(target, "index.html"))) === "file";
}

/**
 * Crawl every HTML file and every stylesheet under distDir and report internal
 * references that do not resolve.
 *
 * @param {{ distDir: string }} options
 * @returns {Promise<{ ok: boolean, broken: { page: string, href: string }[] }>}
 */
export async function checkLinks({ distDir }) {
  const files = await listFiles(distDir);
  const broken = [];

  for (const pageRel of files) {
    const ext = pageRel.toLowerCase().slice(pageRel.lastIndexOf("."));
    if (ext !== ".html" && ext !== ".htm" && ext !== ".css") continue;

    const source = await readFile(join(distDir, pageRel), "utf8");
    for (const href of refsFrom(source, ext === ".css" ? "css" : "html")) {
      if (!(await resolves({ distDir, pageRel, href }))) broken.push({ page: pageRel, href });
    }
  }

  broken.sort((a, b) => a.page.localeCompare(b.page) || a.href.localeCompare(b.href));
  return { ok: broken.length === 0, broken };
}
