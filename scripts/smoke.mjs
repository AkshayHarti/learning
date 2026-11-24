#!/usr/bin/env node
/**
 * Route smoke test: serve dist/ and GET every generated route plus every
 * course entry, asserting 200 and a non-empty <title>.
 *
 * usage: node scripts/smoke.mjs [distDir]
 */
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createStaticServer } from "../platform/site/dev.mjs";

const distDir = resolve(process.argv[2] ?? "dist");

const routes = JSON.parse(await readFile(join(distDir, "search-index.json"), "utf8")).map((entry) => entry.route);
const manifest = JSON.parse(await readFile(join(distDir, "build.json"), "utf8"));
for (const course of manifest.courses) {
  if (course.entry && !routes.includes(course.entry)) routes.push(course.entry);
}

const server = createStaticServer(distDir);
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const { port } = server.address();

let failures = 0;
for (const route of routes) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  const body = await response.text();
  const title = /<title>([^<]*)<\/title>/i.exec(body)?.[1]?.trim();
  if (response.status !== 200 || !title) {
    failures += 1;
    console.error(`✖ ${route} → ${response.status}${title ? "" : " (no <title>)"}`);
  }
}

server.close();

if (failures > 0) {
  console.error(`${failures} of ${routes.length} routes failed`);
  process.exit(1);
}
console.log(`ok ${routes.length} routes`);
