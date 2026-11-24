import { createServer } from "node:http";
import { readFile, stat, watch } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "../build/build.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
};

async function readIfFile(path) {
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

/**
 * Static file server with directory-index and 404-page handling.
 *
 * @param {string} rootDir directory to serve
 * @returns {import("node:http").Server}
 */
export function createStaticServer(rootDir) {
  const root = resolve(rootDir);

  return createServer(async (request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    } catch {
      response.writeHead(400).end("bad request");
      return;
    }

    // Never serve outside the built directory.
    const target = normalize(join(root, pathname));
    if (!target.startsWith(root)) {
      response.writeHead(403).end("forbidden");
      return;
    }

    let body = await readIfFile(target);
    if (!body && pathname.endsWith("/")) body = await readIfFile(join(target, "index.html"));
    if (!body && !extname(target)) body = await readIfFile(join(target, "index.html"));

    if (!body) {
      const notFound = await readIfFile(join(root, "404.html"));
      response.writeHead(404, { "content-type": MIME[".html"] });
      response.end(notFound ?? "not found");
      return;
    }

    const type = MIME[extname(target)] ?? (pathname.endsWith("/") ? MIME[".html"] : "application/octet-stream");
    response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    response.end(body);
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const rootDir = resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const distDir = join(rootDir, "dist");
  const port = Number(process.env.PORT ?? 4321);

  let building = false;
  let queued = false;

  async function rebuild() {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    const started = Date.now();
    try {
      const { summaries } = await build({ rootDir, distDir });
      console.log(`rebuilt ${summaries.length} courses in ${Date.now() - started}ms`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    } finally {
      building = false;
      if (queued) {
        queued = false;
        void rebuild();
      }
    }
  }

  await rebuild();
  createStaticServer(distDir).listen(port, () => {
    console.log(`serving dist/ on http://localhost:${port}`);
  });

  for (const directory of ["courses", "platform"]) {
    try {
      const watcher = watch(join(rootDir, directory), { recursive: true });
      for await (const event of watcher) {
        if (event.filename && !/[\\/](node_modules|dist)[\\/]/.test(event.filename) && !/\.(log|swp)$/.test(event.filename)) {
          void rebuild();
        }
      }
    } catch {
      console.warn(`not watching ${directory}/ (recursive watch unavailable)`);
    }
  }
}
